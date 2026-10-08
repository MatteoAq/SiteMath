import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const viewports = [
  {name:'android-narrow', width:320, height:720},
  {name:'android-common', width:360, height:800},
  {name:'android-tall', width:393, height:873},
  {name:'android-wide', width:412, height:915},
  {name:'landscape-mobile', width:700, height:360},
];

const browser = await chromium.launch({headless:true});
const failures = [];
fs.mkdirSync('mobile-screenshots',{recursive:true});

async function gridState(page){
  return page.evaluate(() => {
    const minor=document.querySelector('#drawing .grid-minor');
    const major=document.querySelector('#drawing .grid-major');
    const minorPattern=document.querySelector('#drawing #minorGrid');
    const majorPattern=document.querySelector('#drawing #majorGrid');
    const visible=el=>{
      if(!el) return {ok:false,stroke:null};
      const stroke=getComputedStyle(el).stroke;
      return {
        ok:!!stroke && stroke!=='none' && stroke!=='transparent' &&
           stroke!=='rgba(0, 0, 0, 0)' && stroke!=='rgba(0,0,0,0)',
        stroke
      };
    };
    return {
      minor:visible(minor),
      major:visible(major),
      minorWidth:Number(minorPattern?.getAttribute('width')),
      minorHeight:Number(minorPattern?.getAttribute('height')),
      majorWidth:Number(majorPattern?.getAttribute('width')),
      majorHeight:Number(majorPattern?.getAttribute('height'))
    };
  });
}

async function visibleOverflow(page,label){
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
    const offenders = [];
    for (const el of document.querySelectorAll('button, input, select, .panel, .mobile-appbar, .stage-toolbar, .controls-panel, .explanation-panel')) {
      if (el.closest('#controlsPanel') && !document.querySelector('#controlsPanel')?.classList.contains('is-open')) continue;
      if (el.closest('#firstRunPicker') && document.querySelector('#firstRunPicker')?.hidden) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > vw + 1 || r.left < -1) {
        offenders.push({
          tag:el.tagName,
          id:el.id,
          cls:el.className,
          left:Math.round(r.left*10)/10,
          right:Math.round(r.right*10)/10,
          width:Math.round(r.width*10)/10,
          viewport:vw
        });
      }
    }
    return {docOverflow, offenders:offenders.slice(0,20)};
  });
  if (result.docOverflow > 1) failures.push(label+': document horizontal overflow '+result.docOverflow+'px');
  if (result.offenders.length) failures.push(label+': visible elements outside viewport '+JSON.stringify(result.offenders));
}

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport:{width:vp.width,height:vp.height},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true
  });
  const page = await context.newPage();

  await page.addInitScript(() => localStorage.clear());
  await page.goto(base,{waitUntil:'networkidle'});

  if (!(await page.locator('#firstRunPicker').isVisible())) {
    failures.push(vp.name+': first-run chooser not visible with empty storage');
  }
  await visibleOverflow(page,vp.name+' first-run');
  await page.screenshot({path:'mobile-screenshots/'+vp.name+'-first-run.png',fullPage:true});

  await page.locator('.first-run-variant[data-variant="13"]').click();
  await page.locator('.first-run-task[data-task="2"]').click();
  if (await page.locator('#firstRunStart').isDisabled()) failures.push(vp.name+': Continue remains disabled');
  await page.locator('#firstRunStart').click();
  await page.waitForTimeout(100);

  await visibleOverflow(page,vp.name+' drawing');
  const screenGrid=await gridState(page);
  if(!screenGrid.minor.ok||!screenGrid.major.ok){
    failures.push(vp.name+': 5 mm grid is not visible '+JSON.stringify(screenGrid));
  }
  if(screenGrid.minorWidth!==5||screenGrid.minorHeight!==5||screenGrid.majorWidth!==25||screenGrid.majorHeight!==25){
    failures.push(vp.name+': wrong grid pattern size '+JSON.stringify(screenGrid));
  }
  await page.screenshot({path:'mobile-screenshots/'+vp.name+'-drawing.png',fullPage:false});

  await page.emulateMedia({media:'print'});
  const printGrid=await gridState(page);
  if(!printGrid.minor.ok||!printGrid.major.ok){
    failures.push(vp.name+': print/PDF hides 5 mm grid '+JSON.stringify(printGrid));
  }
  const printScale=await page.evaluate(()=>{
    const svg=document.querySelector('#drawing');
    const w=parseFloat(svg?.getAttribute('width'));
    const h=parseFloat(svg?.getAttribute('height'));
    const rect=svg?.getBoundingClientRect();
    return {expectedWidth:w*96/25.4,expectedHeight:h*96/25.4,width:rect?.width,height:rect?.height};
  });
  if(Math.abs(printScale.width-printScale.expectedWidth)>1 ||
     Math.abs(printScale.height-printScale.expectedHeight)>1){
    failures.push(vp.name+': print grid was changed by screen Fit/Zoom '+JSON.stringify(printScale));
  }
  await page.emulateMedia({media:'screen'});

  await page.locator('#mobileSetupBtn').click();
  await page.waitForTimeout(280);
  if (!(await page.locator('#controlsPanel').isVisible())) failures.push(vp.name+': settings sheet not visible');
  await visibleOverflow(page,vp.name+' settings');
  await page.screenshot({path:'mobile-screenshots/'+vp.name+'-settings.png',fullPage:false});

  const order = await page.locator('.variant-chip[data-variant]').evaluateAll(nodes =>
    nodes.filter(n=>!['custom','photo-unknown'].includes(n.dataset.variant)).map(n=>({
      key:n.dataset.variant,
      text:n.querySelector('.variant-number')?.textContent.trim()
    }))
  );
  const nums=order.map(x=>Number(x.key));
  const sorted=[...nums].sort((a,b)=>a-b);
  if (nums.join(',')!==sorted.join(',')) failures.push(vp.name+': variant order '+nums.join(','));
  for (const x of order) {
    if (x.text !== String(Number(x.key))) failures.push(vp.name+': wrong variant display '+x.key+' -> '+x.text);
  }

  await page.locator('#mobileSetupClose').click();
  await page.waitForTimeout(280);

  // Zoom controls should not alter page width or throw content outside the viewport.
  await page.locator('#zoomInBtn').click();
  await page.locator('#zoomInBtn').click();
  await page.waitForTimeout(50);
  await visibleOverflow(page,vp.name+' zoomed');
  await page.locator('#zoomFitBtn').click();
  await page.waitForTimeout(50);
  await visibleOverflow(page,vp.name+' fitted');

  for (const mode of ['action','why','check']) {
    const tab=page.locator('.step-info-tab[data-step-mode="'+mode+'"]');
    if(await tab.count()){
      await tab.click();
      await page.waitForTimeout(30);
      await visibleOverflow(page,vp.name+' step-'+mode);
      const clipped=await page.locator('#stepInfoPage').count()
        ? await page.locator('#stepInfoPage').evaluate(el=>el.scrollHeight>el.clientHeight+1)
        : await page.locator('.step-info-page').evaluate(el=>el.scrollHeight>el.clientHeight+1);
      if(clipped) failures.push(vp.name+': step '+mode+' text is clipped inside fixed explanation area');
    } else {
      failures.push(vp.name+': missing step info tab '+mode);
    }
  }

  await context.close();
}

// Visual source-fidelity captures for every photographed variant.
{
  const context = await browser.newContext({
    viewport:{width:393,height:873},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('.first-run-variant[data-variant="12"]').click();
  await page.locator('.first-run-task[data-task="4"]').click();
  await page.locator('#firstRunStart').click();
  await page.waitForTimeout(100);

  const photographed=['03','04','05','06','07','08','09','10','11','12','13','14','15','17','18','19'];
  for (const variant of photographed) {
    for (const task of [4,5,6]) {
      await page.evaluate(({variant,task})=>{
        const vs=document.querySelector('#variantSelect');
        const ts=document.querySelector('#taskSelect');
        vs.value=variant;
        vs.dispatchEvent(new Event('change'));
        ts.value=String(task);
        ts.dispatchEvent(new Event('change'));
        document.querySelector('#firstBtn')?.click();
      },{variant,task});
      await page.waitForTimeout(40);
      await page.locator('#zoomFitBtn').click();
      // Source lines animate as if drawn by pencil. Wait until long segments finish.
      await page.waitForTimeout(1450);

      const coverage=await page.evaluate(()=>{
        const wrap=document.querySelector('.paper-wrap');
        const nodes=[...document.querySelectorAll('#drawing line.object-line, #drawing line.source-guide-line, #drawing line.construction-line, #drawing circle.point-dot, #drawing circle.source-guide-dot, #drawing circle.answer-dot, #drawing circle.construction-dot')];
        const boxes=nodes.map(n=>n.getBoundingClientRect()).filter(r=>r.width+r.height>0);
        if(!wrap||!boxes.length) return {size:0,visible:0};
        const left=Math.min(...boxes.map(r=>r.left)),right=Math.max(...boxes.map(r=>r.right));
        const top=Math.min(...boxes.map(r=>r.top)),bottom=Math.max(...boxes.map(r=>r.bottom));
        const wr=wrap.getBoundingClientRect();
        const iw=Math.max(0,Math.min(right,wr.right)-Math.max(left,wr.left));
        const ih=Math.max(0,Math.min(bottom,wr.bottom)-Math.max(top,wr.top));
        const area=Math.max(1,(right-left)*(bottom-top));
        return {
          size:Math.max((right-left)/wr.width,(bottom-top)/wr.height),
          visible:(iw*ih)/area,
          bounds:{left,right,top,bottom},
          wrap:{left:wr.left,right:wr.right,top:wr.top,bottom:wr.bottom}
        };
      });
      if(coverage.size<.28) failures.push('source '+variant+'/'+task+': current construction too small after Fit ('+coverage.size.toFixed(2)+')');
      if(coverage.visible<.55) failures.push('source '+variant+'/'+task+': fitted source is mostly outside the paper viewport '+JSON.stringify(coverage));

      const obscured=await page.evaluate(()=>{
        const panel=document.querySelector('#stepSheet');
        const nodes=[...document.querySelectorAll('#drawing line.object-line, #drawing line.construction-line, #drawing circle.point-dot, #drawing circle.answer-dot, #drawing circle.construction-dot')];
        const boxes=nodes.map(n=>n.getBoundingClientRect()).filter(r=>r.width+r.height>0);
        if(!panel||!boxes.length) return false;
        const bottom=Math.max(...boxes.map(r=>r.bottom));
        return bottom>panel.getBoundingClientRect().top-6;
      });
      if(obscured) failures.push('source '+variant+'/'+task+': fitted construction is hidden by the step panel');

      await page.screenshot({
        path:'mobile-screenshots/source-v'+String(Number(variant)).padStart(2,'0')+'-t'+task+'.png',
        fullPage:false
      });

      // Keep a direct visual regression for the working reference frame on the
      // exact source we can currently recheck. It must appear only after the
      // photographed source frame and include x12 plus y/z directions.
      if(variant==='12'){
        await page.evaluate(()=>document.querySelector('#nextBtn')?.click());
        await page.waitForTimeout(60);
        await page.locator('#zoomFitBtn').click();
        await page.waitForTimeout(220);
        await page.screenshot({
          path:'mobile-screenshots/axes-v12-t'+task+'.png',
          fullPage:false
        });
      }

      // Keep a final-frame capture as well. A source can be faithful while the
      // construction itself later drifts into a different topology.
      await page.evaluate(()=>document.querySelector('#lastBtn')?.click());
      await page.waitForTimeout(70);
      await page.locator('#zoomFitBtn').click();
      await page.waitForTimeout(900);
      const finalVisibility=await page.evaluate(()=>{
        const wrap=document.querySelector('.paper-wrap');
        const nodes=[...document.querySelectorAll('#drawing line.object-line, #drawing line.source-guide-line, #drawing line.construction-line, #drawing line.aux-line, #drawing line.answer-line, #drawing circle.point-dot, #drawing circle.source-guide-dot, #drawing circle.answer-dot, #drawing circle.construction-dot')];
        const boxes=nodes.map(n=>n.getBoundingClientRect()).filter(r=>r.width+r.height>0);
        if(!wrap||!boxes.length)return {visible:0,size:0};
        const left=Math.min(...boxes.map(r=>r.left)),right=Math.max(...boxes.map(r=>r.right));
        const top=Math.min(...boxes.map(r=>r.top)),bottom=Math.max(...boxes.map(r=>r.bottom));
        const wr=wrap.getBoundingClientRect();
        const iw=Math.max(0,Math.min(right,wr.right)-Math.max(left,wr.left));
        const ih=Math.max(0,Math.min(bottom,wr.bottom)-Math.max(top,wr.top));
        const area=Math.max(1,(right-left)*(bottom-top));
        return {
          visible:(iw*ih)/area,
          size:Math.max((right-left)/wr.width,(bottom-top)/wr.height),
          bounds:{left,right,top,bottom},
          wrap:{left:wr.left,right:wr.right,top:wr.top,bottom:wr.bottom}
        };
      });
      if(finalVisibility.visible<.45){
        failures.push('final '+variant+'/'+task+': fitted construction is mostly outside the paper viewport '+JSON.stringify(finalVisibility));
      }
      await page.screenshot({
        path:'mobile-screenshots/final-v'+String(Number(variant)).padStart(2,'0')+'-t'+task+'.png',
        fullPage:false
      });
    }
  }

  // Teacher-method captures for point+line planes: these must show the full
  // 1-2-3-4 construction chain, x12 and the compact Given/Find block.
  for (const variant of ['08','09','14','15']) {
    await page.evaluate((variant)=>{
      const vs=document.querySelector('#variantSelect');
      const ts=document.querySelector('#taskSelect');
      vs.value=variant;
      vs.dispatchEvent(new Event('change'));
      ts.value='4';
      ts.dispatchEvent(new Event('change'));
      document.querySelector('#lastBtn')?.click();
    },variant);
    await page.waitForTimeout(80);
    await page.locator('#zoomFitBtn').click();
    await page.waitForTimeout(900);
    const briefOverflow=await page.locator('#problemBrief').evaluate(el=>el.scrollWidth>el.clientWidth+1);
    if(briefOverflow) failures.push('teacher task4 '+variant+': Given/Find block overflows');
    await page.screenshot({
      path:'mobile-screenshots/teacher-v'+String(Number(variant)).padStart(2,'0')+'-t4-final.png',
      fullPage:false
    });
  }

  await context.close();
}

await browser.close();
fs.writeFileSync('mobile-layout-results.json',JSON.stringify({failures},null,2));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('All mobile layout checks passed.');
