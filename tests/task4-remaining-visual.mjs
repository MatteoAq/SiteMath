// One-off original-sheet-first visual pass for TASK 4, variants 01-20
// excluding 12/4 (already independently reviewed and visually inspected).
// This is ONLY assignment 4, not the other five assignments in each sheet.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const dir='task4-remaining-screens';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({
  viewport:{width:393,height:873},
  deviceScaleFactor:2,isMobile:true,hasTouch:true
});
await page.addInitScript(()=>localStorage.clear());
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.locator('.first-run-variant[data-variant="01"]').click();
await page.locator('.first-run-task[data-task="4"]').click();
await page.locator('#firstRunStart').click();

const variants=Array.from({length:20},(_,i)=>String(i+1).padStart(2,'0'))
  .filter(v=>v!=='12');
const report={scope:'assignment 4 only; v12 separately reviewed',
  order:variants,variants:[],errors:[]};
for(const variant of variants){
  const n=await page.evaluate(variant=>{
    const vs=document.querySelector('#variantSelect'),
      ts=document.querySelector('#taskSelect');
    vs.value=variant;vs.dispatchEvent(new Event('change'));
    ts.value='4';ts.dispatchEvent(new Event('change'));
    document.querySelector('#firstBtn').click();
    return Number(document.querySelector('#stepTotal').textContent);
  },variant);
  if(!(n>=10&&n<=30)){
    report.errors.push(variant+'/4 unexpected step count: '+n);continue;
  }
  const entry={variant,task:4,total:n,steps:[]};
  for(let step=0;step<n;step++){
    if(step)await page.evaluate(()=>document.querySelector('#nextBtn').click());
    await page.evaluate(()=>{
      for(const a of document.getAnimations())
        try{a.finish()}catch{}
    });
    await page.locator('#zoomFitBtn').click();
    await page.waitForTimeout(140);
    await page.evaluate(()=>{
      for(const e of document.querySelectorAll(
        '#drawing [data-active="1"].draw-line:not(.hidden-line)')){
        e.style.transition='none';e.style.strokeDashoffset='0';
      }
    });
    await page.waitForTimeout(40);
    const meta=await page.evaluate(()=>{
      const svg=document.querySelector('#drawing');
      return {
        title:document.querySelector('#stepTitle')?.textContent.trim()||'',
        action:document.querySelector('#stepAction')?.textContent.trim()||'',
        lineCount:svg?.querySelectorAll('line').length||0,
        pointLabels:[...svg?.querySelectorAll('circle[data-label]')||[]]
          .map(e=>e.getAttribute('data-label')).filter(Boolean),
        zoom:document.querySelector('#zoomLabel')?.textContent.trim()||'',
        given:document.querySelector('#problemGiven')?.textContent.trim()||'',
        find:document.querySelector('#problemFind')?.textContent.trim()||''
      };
    });
    const name='v'+variant+'-t4-s'+String(step+1).padStart(2,'0')+'.jpg';
    await page.screenshot({
      path:path.join(dir,name),type:'jpeg',quality:67,fullPage:false
    });
    entry.steps.push({step:step+1,file:name,...meta});
    if(!meta.title||!meta.action||!meta.lineCount)
      report.errors.push(variant+'/4 step '+(step+1)+' missing visible construction');
  }
  report.variants.push(entry);
  console.log('Photographed variant '+variant+'/4: '+n+' frames');
}
fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(report,null,2));
console.log('All remaining task4 frames: '+
  report.variants.reduce((n,v)=>n+v.total,0)+
  '; errors='+report.errors.length);
await browser.close();
if(report.errors.length){console.error(report.errors);process.exitCode=1;}
