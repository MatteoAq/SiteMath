// One-off, variant-first visual evidence, without generating all 20 variants.
// Captures every visible step (1–6) and metadata for independent review.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
// One-off browser evidence for variant 03. Every step 1-6 is captured.
const dir='variant03-screens';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({
  viewport:{width:393,height:873},
  deviceScaleFactor:2,
  isMobile:true,hasTouch:true
});
await page.addInitScript(()=>localStorage.clear());
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.locator('.first-run-variant[data-variant="03"]').click();
await page.locator('.first-run-task[data-task="1"]').click();
await page.locator('#firstRunStart').click();
const report={variant:'03',tasks:[],errors:[]};
for(let task=1;task<=6;task++){
  const prep=await page.evaluate(task=>{
    const vs=document.querySelector('#variantSelect');
    const ts=document.querySelector('#taskSelect');
    vs.value='03';vs.dispatchEvent(new Event('change'));
    ts.value=String(task);ts.dispatchEvent(new Event('change'));
    document.querySelector('#firstBtn').click();
    return Number(document.querySelector('#stepTotal').textContent);
  },task);
  if(!(prep>0&&prep<60)){
    report.errors.push('task '+task+' invalid step count '+prep);continue;
  }
  const taskReport={task,total:prep,steps:[]};
  for(let index=0;index<prep;index++){
    await page.evaluate(index=>{
      if(index)document.querySelector('#nextBtn').click();
    },index);
    // Each SVG step is laid out after its animation; finish it for evidence.
    await page.evaluate(()=>{
      for(const animation of document.getAnimations()){
        try{animation.finish();}catch{}
      }
    });
    if(task===6 && index>1){
      await page.locator('#mobileFocusBtn').click();
    }else{
      await page.locator('#zoomFitBtn').click();
    }
    // SiteMath reveals active strokes with two nested animation frames
    // followed by a CSS stroke-dashoffset transition. Force the END of
    // that transition before evidence capture; otherwise a valid long
    // section extension may appear as an isolated dot (e.g. 12/6 P₂).
    await page.waitForTimeout(150);
    await page.evaluate(()=>{
      for(const el of document.querySelectorAll(
        '#drawing [data-active="1"].draw-line:not(.hidden-line)')){
        el.style.transition='none';
        el.style.strokeDashoffset='0';
      }
    });
    await page.waitForTimeout(40);
    const meta=await page.evaluate(()=>{
      const svg=document.querySelector('#drawing');
      const title=document.querySelector('#stepTitle')?.textContent.trim()||'';
      const action=document.querySelector('#stepAction')?.textContent.trim()||'';
      const lines=[...svg.querySelectorAll('line')];
      const labels=[...svg.querySelectorAll('circle[data-label]')]
        .map(e=>e.getAttribute('data-label')).filter(Boolean);
      const vb=svg.viewBox.baseVal,rect=svg.getBoundingClientRect();
      return {
        title,action,lines:lines.length,labels,
        zoom:document.querySelector('#zoomLabel')?.textContent.trim(),
        viewBox:[vb.x,vb.y,vb.width,vb.height],
        svgSize:[rect.width,rect.height]
      };
    });
    const filename='v03-t'+task+'-s'+String(index+1).padStart(2,'0')+'.jpg';
    await page.screenshot({
      path:path.join(dir,filename),type:'jpeg',quality:72,fullPage:false
    });
    taskReport.steps.push({step:index+1,file:filename,...meta});
    if(task===6 && index===prep-1){
      await page.locator('#zoomFitBtn').click();
      await page.screenshot({
        path:path.join(dir,'v03-t6-final-overview.jpg'),type:'jpeg',quality:80,fullPage:false
      });
    }
    if(!meta.title||!meta.action||!meta.lines)
      report.errors.push('task '+task+' step '+(index+1)+' incomplete view/action');
  }
  report.tasks.push(taskReport);
  console.log('Captured '+prep+' current frames for variant 03 task '+task);
}
fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(report,null,2));
console.log('Variant 03 total frames: '+
  report.tasks.reduce((n,t)=>n+t.total,0));
await browser.close();
if(report.errors.length){console.error(report.errors);process.exitCode=1;}
