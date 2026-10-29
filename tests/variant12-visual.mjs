// One-off, variant-first visual evidence, without generating all 20 variants.
// Captures every visible step (1–6) and metadata for independent review.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
// One-off browser evidence for variant 12. Every step 1-6 is captured.
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
if(await page.locator('#offerOverlay').isVisible())
  await page.locator('#offerCloseBtn').click();
await page.locator('#courseCatalog button.course-card').click();
await page.locator('#assignmentCatalog button.assignment-card').click();
await page.locator('.first-run-variant[data-variant="12"]').click();
await page.locator('.first-run-task[data-task="1"]').click();
await page.locator('#firstRunStart').click();
const report={variant:'12',tasks:[],errors:[]};
const expectedCounts=[17,7,11,18,14,24];
for(let task=1;task<=6;task++){
  const prep=await page.evaluate(task=>{
    const vs=document.querySelector('#variantSelect');
    const ts=document.querySelector('#taskSelect');
    vs.value='12';vs.dispatchEvent(new Event('change'));
    ts.value=String(task);ts.dispatchEvent(new Event('change'));
    document.querySelector('#firstBtn').click();
    return Number(document.querySelector('#stepTotal').textContent);
  },task);
  if(prep!==expectedCounts[task-1]){
    report.errors.push('task '+task+' expected '+expectedCounts[task-1]+' steps, found '+prep);
  }
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
      // Measure *rendered* labels instead of trusting SVG coordinates alone.
      // The same pair can recur on later cumulative drawing steps; the report
      // retains the first occurrence to avoid counting one clash repeatedly.
      const visible=[...svg.querySelectorAll('text')].map((el,i)=>{
        const box=el.getBoundingClientRect(),style=getComputedStyle(el);
        return {id:i,label:(el.textContent||'').trim(),
          x:box.x,y:box.y,w:box.width,h:box.height,
          visible:style.display!=='none'&&style.visibility!=='hidden'&&
            Number(style.opacity)>.08&&box.width>1&&box.height>1};
      }).filter(el=>el.visible&&el.label);
      const collisions=[];
      for(let a=0;a<visible.length;a++){
        const x=visible[a];
        for(let b=a+1;b<visible.length;b++){
          const y=visible[b];
          const w=Math.max(0,Math.min(x.x+x.w,y.x+y.w)-Math.max(x.x,y.x));
          const h=Math.max(0,Math.min(x.y+x.h,y.y+y.h)-Math.max(x.y,y.y));
          const overlap=w*h/Math.max(1,Math.min(x.w*x.h,y.w*y.h));
          if(overlap>.55 && w>3 && h>3)
            collisions.push({a:x.label,b:y.label,overlap:+overlap.toFixed(2),
              at:[+x.x.toFixed(1),+x.y.toFixed(1)]});
        }
      }
      const clipped=visible.filter(x=>
        x.x<rect.left-3||x.y<rect.top-3||
        x.x+x.w>rect.right+3||x.y+x.h>rect.bottom+3)
        .map(x=>x.label).slice(0,12);
      return {
        title,action,lines:lines.length,labels,
        zoom:document.querySelector('#zoomLabel')?.textContent.trim(),
        viewBox:[vb.x,vb.y,vb.width,vb.height],
        svgSize:[rect.width,rect.height],
        renderedLabels:visible.length,
        collisions:collisions.slice(0,25),
        clippedLabels:clipped
      };
    });
    if(task===5&&index===prep-1){
      const finished=await page.evaluate(()=>({
        solid:document.querySelectorAll('#drawing line.answer-line').length,
        dashed:document.querySelectorAll('#drawing line.hidden-line').length,
        originalGiven:document.querySelectorAll(
          '#drawing line[data-source-given-line="1"]').length,
        title:document.querySelector('#stepTitle')?.textContent.trim()
      }));
      if(finished.solid!==2||finished.dashed!==2||
         finished.originalGiven!==0||
         finished.title!=='Готовый чертёж 12/5: пересечение и видимость')
        report.errors.push('12/5 final SVG is not a finished visible/hidden drawing: '+
          JSON.stringify(finished));
    }
    const filename='v12-t'+task+'-s'+String(index+1).padStart(2,'0')+'.jpg';
    await page.screenshot({
      path:path.join(dir,filename),type:'jpeg',quality:72,fullPage:false
    });
    taskReport.steps.push({step:index+1,file:filename,fitted:!(task===6&&index>1),...meta});
    if(task===6 && index===prep-1){
      await page.locator('#zoomFitBtn').click();
      await page.screenshot({
        path:path.join(dir,'v12-t6-final-overview.jpg'),type:'jpeg',quality:80,fullPage:false
      });
    }
    if(!meta.title||!meta.action||!meta.lines)
      report.errors.push('task '+task+' step '+(index+1)+' incomplete view/action');
  }
  report.tasks.push(taskReport);
  console.log('Captured '+prep+' current frames for variant 12 task '+task);
}
fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(report,null,2));
const seen=new Set(),overlaps=[],clipped=[];
for(const task of report.tasks)for(const step of task.steps){
  for(const pair of step.collisions||[]){
    const key=task.task+':'+[pair.a,pair.b].sort().join('|');
    if(seen.has(key))continue;
    seen.add(key);
    overlaps.push({task:task.task,step:step.step,...pair});
  }
  // Focus mode intentionally crops distant geometry. Assess clipping only
  // when the entire source drawing is fitted to the viewport.
  if(step.fitted&&step.clippedLabels.length)
    clipped.push({task:task.task,step:step.step,labels:step.clippedLabels});
}
report.visualDiagnostics={
  uniqueOverlappingLabelPairs:overlaps.length,
  pairs:overlaps.slice(0,150),
  fittedLabelClipping:clipped.slice(0,40)
};
if(overlaps.length)
  report.errors.push('Overlapping labels remain across rendered variant 12 stages: '+
    JSON.stringify(overlaps.slice(0,12)));
if(clipped.length)
  report.errors.push('SVG labels outside fitted drawing in variant 12: '+
    JSON.stringify(clipped.slice(0,12)));
fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(report,null,2));
console.log('Variant 12 total frames: '+
  report.tasks.reduce((n,t)=>n+t.total,0)+
  '; unique label overlaps: '+overlaps.length+
  '; fitted clipping cases: '+clipped.length);
console.log('VARIANT12_RENDERED_LABEL_DIAGNOSTICS '+
  JSON.stringify(report.visualDiagnostics).slice(0,18000));
await browser.close();
if(report.errors.length){console.error(report.errors);process.exitCode=1;}
