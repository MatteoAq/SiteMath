// One-off, variant-first visual evidence, without generating all 20 variants.
// Captures every visible step (1–6) and metadata for independent review.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const dir='variant12-screens';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({
  viewport:{width:393,height:873},
  deviceScaleFactor:2,
  isMobile:true,hasTouch:true
});
await page.addInitScript(()=>localStorage.clear());
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.locator('.first-run-variant[data-variant="12"]').click();
await page.locator('.first-run-task[data-task="1"]').click();
await page.locator('#firstRunStart').click();
const report={variant:'12',tasks:[],errors:[]};
for(let task=1;task<=6;task++){
  const prep=await page.evaluate(task=>{
    const vs=document.querySelector('#variantSelect');
    const ts=document.querySelector('#taskSelect');
    vs.value='12';vs.dispatchEvent(new Event('change'));
    ts.value=String(task);ts.dispatchEvent(new Event('change'));
    document.querySelector('#firstBtn').click();
    return Number(document.querySelector('#stepTotal').textContent);
  },task);
  if(!(prep>0&&prep<60)){
    report.errors.push('task '+task+' invalid step count '+prep);continue;
  }
  if(task===6){
    const hAndF=await page.evaluate(()=>{
      const p=window.SITEMATH_SCHEMES?.['12']?.task6?.planeB;
      const raw=window.SITEMATH_SCHEMES?.['12']?.task6?.sourceGeometry?.planeB;
      return {
        workingH2:p?.lines?.h?.p2?.map(x=>x[1]),
        workingF1:p?.lines?.f?.p1?.map(x=>x[1]),
        originalH2:raw?.lines?.h?.p2?.map(x=>x[1]),
        originalF1:raw?.lines?.f?.p1?.map(x=>x[1])
      };
    });
    const [h0,h1]=hAndF.workingH2||[];
    const [f0,f1]=hAndF.workingF1||[];
    const [rh0,rh1]=hAndF.originalH2||[];
    const [rf0,rf1]=hAndF.originalF1||[];
    if(![h0,h1,f0,f1,rh0,rh1,rf0,rf1].every(Number.isFinite) ||
       Math.abs(h1-h0)>1e-8||Math.abs(f1-f0)>1e-8 ||
       Math.abs((rh1-rh0)-2)>1e-3||
       Math.abs((rf1-rf0)-2)>1e-3)
      report.errors.push('12/6 h2/f1 raw-versus-working horizontal invariant '+
        JSON.stringify(hAndF));
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
    const filename='v12-t'+task+'-s'+String(index+1).padStart(2,'0')+'.jpg';
    await page.screenshot({
      path:path.join(dir,filename),type:'jpeg',quality:72,fullPage:false
    });
    taskReport.steps.push({step:index+1,file:filename,...meta});
    if(!meta.title||!meta.action||!meta.lines)
      report.errors.push('task '+task+' step '+(index+1)+' incomplete view/action');
  }
  report.tasks.push(taskReport);
  console.log('Captured '+prep+' current frames for variant 12 task '+task);
}
fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(report,null,2));
console.log('Variant 12 total frames: '+
  report.tasks.reduce((n,t)=>n+t.total,0));
await browser.close();
if(report.errors.length){console.error(report.errors);process.exitCode=1;}
