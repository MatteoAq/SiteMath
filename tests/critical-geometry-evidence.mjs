// Verify the actual rendered construction AFTER source-line continuation fixes.
// No changes to solver geometry; this is an evidence-only test.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const items=[
  {variant:'04',task:6,needle:'U₂'},
  {variant:'10',task:6,needle:'U₂'},
  {variant:'17',task:5,needle:'T₂'},
  {variant:'12',task:6,needle:'P₂'},
  {variant:'13',task:5,needle:'K₂'}
];
const dir='critical-geometry-evidence';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:393,height:873},
  deviceScaleFactor:2,isMobile:true,hasTouch:true});
await page.addInitScript(()=>localStorage.clear());
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.locator('.first-run-variant[data-variant="04"]').click();
await page.locator('.first-run-task[data-task="6"]').click();
await page.locator('#firstRunStart').click();
const report={items:[],errors:[]};
for(const {variant,task,needle} of items){
  const steps=await page.evaluate(({variant,task})=>{
    const vs=document.querySelector('#variantSelect');
    vs.value=variant;vs.dispatchEvent(new Event('change'));
    const ts=document.querySelector('#taskSelect');
    ts.value=String(task);ts.dispatchEvent(new Event('change'));
    document.querySelector('#firstBtn').click();
    return Number(document.querySelector('#stepTotal')?.textContent);
  },{variant,task});
  if(!(steps>=10&&steps<=35)){
    report.errors.push(variant+'/'+task+' bad steps '+steps);continue;
  }
  const entry={variant,task,total:steps,focus:needle,steps:[]};
  for(let index=0;index<steps;index++){
    if(index)await page.evaluate(()=>document.querySelector('#nextBtn').click());
    await page.evaluate(()=>{for(const a of document.getAnimations())
      try{a.finish()}catch{}});
    if(index>1) await page.locator('#mobileFocusBtn').click();
    else await page.locator('#zoomFitBtn').click();
    await page.waitForTimeout(140);
    await page.evaluate(()=>{
      for(const el of document.querySelectorAll(
        '#drawing [data-active="1"].draw-line:not(.hidden-line)')){
        el.style.transition='none';el.style.strokeDashoffset='0';
      }
    });
    await page.waitForTimeout(40);
    const meta=await page.evaluate(()=>{
      const svg=document.querySelector('#drawing');
      const t=document.querySelector('#stepTitle')?.textContent?.trim()||'';
      const action=document.querySelector('#stepAction')?.textContent?.trim()||'';
      const allLines=[...svg.querySelectorAll('line')];
      const vb=svg.viewBox.baseVal;
      return {title:t,action,drawnLines:allLines.length,
        viewBox:[vb.x,vb.y,vb.width,vb.height],
        zoom:document.querySelector('#zoomLabel')?.textContent?.trim()||''};
    });
    if(!meta.drawnLines||!meta.title||!meta.action)
      report.errors.push(variant+'/'+task+'/'+(index+1)+' incomplete');
    const filename='v'+variant+'-t'+task+'-s'+String(index+1).padStart(2,'0')+'.jpg';
    await page.screenshot({path:path.join(dir,filename),
      type:'jpeg',quality:75,fullPage:false});
    entry.steps.push({index:index+1,file:filename,...meta});
  }
  await page.locator('#zoomFitBtn').click();
  await page.waitForTimeout(100);
  await page.screenshot({path:path.join(dir,'v'+variant+'-t'+task+'-overview.jpg'),
    type:'jpeg',quality:80,fullPage:false});
  if(!entry.steps.some(s=>s.title.includes(needle)||s.action.includes(needle)))
    report.errors.push(variant+'/'+task+' never mentions '+needle);
  report.items.push(entry);
  console.log(variant+'/'+task+' '+steps+' frames');
}
await browser.close();
fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(report,null,2));
console.log('EVIDENCE frames '+report.items.reduce((a,b)=>a+b.total,0)+
  ', errors '+report.errors.length);
if(report.errors.length){console.error(report.errors);process.exitCode=1;}
