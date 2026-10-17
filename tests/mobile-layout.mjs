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
  await page.locator('#offerCloseBtn').click();

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

  // A multi-page explanation must be legible and its pager must not sit
  // behind the sticky step navigation. This regressed on 320px phones.
  const guidance=await page.evaluate(()=>{
    const pager=document.querySelector('#stepInfoPager');
    const nav=document.querySelector('.mobile-step-nav');
    const sheet=document.querySelector('#stepSheet');
    if(!pager||!nav||!sheet)return {found:false};
    const showing=getComputedStyle(pager).display!=='none';
    const p=pager.getBoundingClientRect();
    const n=nav.getBoundingClientRect();
    const box=sheet.getBoundingClientRect();
    const pagerAboveNav=p.bottom<=n.top+1;
    const pagerWithinSheet=p.top>=box.top-1&&p.bottom<=box.bottom+1;
    return {found:true,showing,pagerAboveNav,pagerWithinSheet,
      top:Math.round(p.top),bottom:Math.round(p.bottom),navTop:Math.round(n.top)};
  });
  if(!guidance.found||(guidance.showing&&(!guidance.pagerAboveNav||!guidance.pagerWithinSheet)))
    failures.push(vp.name+': explanation pager overlaps bottom navigation '+JSON.stringify(guidance));

  await page.screenshot({path:'mobile-screenshots/'+vp.name+'-drawing.png',fullPage:false});

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

// Visual source-fidelity captures for all twenty paper-sourced variants.
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
  await page.locator('#offerCloseBtn').click();
  await page.locator('.first-run-variant[data-variant="12"]').click();
  await page.locator('.first-run-task[data-task="4"]').click();
  await page.locator('#firstRunStart').click();
  await page.waitForTimeout(100);

  const allPaperVariants=Array.from({length:20},(_,i)=>String(i+1).padStart(2,'0'));
  const selectedStepwise=process.env.STEPWISE_AUDIT_VARIANTS?.split(',').map(x=>x.trim()).filter(Boolean);
  const photographed=process.env.STEPWISE_AUDIT==='1' && selectedStepwise?.length
    ? allPaperVariants.filter(x=>selectedStepwise.includes(x))
    : allPaperVariants;
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

      // One-off, opt-in evidence for the still-pending visual review of
      // EVERY intermediate pencil step from available original sheets.
      // Disabled for normal CI so this is not a permanent long QA cycle.
      if(process.env.STEPWISE_AUDIT==='1'){
        const total=await page.evaluate(()=>Number(document.querySelector('#stepTotal')?.textContent)||0);
        const evidence=[];
        const id=String(Number(variant)).padStart(2,'0');
        await page.evaluate(()=>{
          document.querySelector('#firstBtn')?.click();
          document.querySelector('#nextBtn')?.click();
          document.querySelector('#nextBtn')?.click();
        });
        for(let step=2;step<total-1;step++){
          const snapshot=await page.evaluate(step=>{
            const svg=document.querySelector('#drawing');
            const txt=id=>document.getElementById(id)?.textContent?.trim()||'';
            const drawn=[...svg.querySelectorAll('line,circle')];
            const entities=drawn.map(n=>({
              tag:n.tagName.toLowerCase(),
              role:n.getAttribute('data-role')||'',
              label:n.getAttribute('data-label')||'',
              cls:n.getAttribute('class')||''
            }));
            return {
              step,title:txt('stepTitle'),action:txt('stepAction'),
              why:txt('stepWhy'),check:txt('stepCheck'),
              measure:txt('stepMeasure'),drawn:drawn.length,
              pointLabels:[...svg.querySelectorAll('circle[data-label]')]
                .map(p=>p.getAttribute('data-label')),
              entities
            };
          },step);
          await page.locator('#mobileFocusBtn').click();
          await page.waitForTimeout(95);
          await page.evaluate(()=>{
            for(const animation of document.getAnimations())
              try{animation.finish()}catch{}
          });
          await page.screenshot({
            path:'mobile-screenshots/step-v'+id+'-t'+task+'-s'+String(step).padStart(2,'0')+'.jpg',
            type:'jpeg',quality:52,fullPage:false
          });
          evidence.push(snapshot);
          if(!snapshot.drawn||!snapshot.title||!snapshot.action)
            failures.push('incomplete intermediate drawing/action '+variant+'/'+task+'/'+step);
          await page.evaluate(()=>document.querySelector('#nextBtn')?.click());
        }
        fs.writeFileSync(
          'mobile-screenshots/step-v'+id+'-t'+task+'.json',
          JSON.stringify({variant,task,total,evidence},null,2)
        );
        console.log('Saved intermediate construction steps',variant,task,evidence.length);
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
      // These three variants previously had real but needlessly remote
      // pencil constructions: 01/5 ≈1565 units, 05/6 ≈2586,
      // 13/6 ≈6345. The source stays exact; only legitimate auxiliary
      // helpers were changed. Their complete results must remain readable
      // in Fit mode, unlike genuinely remote 12/6 and 13/5.
      if((variant==='01'&&task===5)||
         (variant==='05'&&task===6)||
         (variant==='13'&&task===6)){
        const zoom=await page.evaluate(()=>
          Number(document.querySelector('#zoomLabel').textContent
            .replace('%','').replace(',','.')));
        if(zoom<10)
          failures.push(variant+'/'+task+
            ': avoidable remote auxiliary construction collapsed final Fit view to '+zoom+'%');
      }
      // 17/5 used to be an almost blank sheet at 1.3% although K lay
      // beside the given lines: the auxiliary points were >7000 units away.
      // Its now explicitly constructed g=TU must preserve the first frame
      // while giving a usable overview without needing local-focus mode.
      if((variant==='17'||variant==='19') && task===5){
        const v=await page.evaluate(()=>({
          zoom:Number(document.querySelector('#zoomLabel').textContent.replace('%','').replace(',','.')),
          hasK1:!![...document.querySelectorAll('#drawing circle.answer-dot')].find(n=>n.getAttribute('data-label')==='K₁'),
          hasK2:!![...document.querySelectorAll('#drawing circle.answer-dot')].find(n=>n.getAttribute('data-label')==='K₂')
        }));
        if(v.zoom<10||!v.hasK1||!v.hasK2)
          failures.push(variant+'/5: unnecessary long auxiliary construction or missing K '+JSON.stringify(v));
      }
      // 05/6 and 12/6 have genuinely distant intersections; full fit must remain
      // mathematically exact, while local focus must make the current pencil
      // operation readable and continue to follow Prev/Next steps.
      if(((variant==='12'||variant==='05'||variant==='01') && task===6) || (variant==='20' && task===4)){
        const inspect=()=>page.evaluate((task)=>{
          const svg=document.querySelector('#drawing');
          const lines=[...svg.querySelectorAll('line.answer-line')].slice(-2);
          const wrap=document.querySelector('.paper-wrap');
          const vr=wrap.getBoundingClientRect();
          const panel=document.querySelector('#stepSheet');
          const pr=panel.getBoundingClientRect();
          const bottom=getComputedStyle(panel).position==='fixed'?Math.min(vr.bottom,pr.top-12):vr.bottom;
          const bounds=lines.map(n=>n.getBoundingClientRect());
          // Task 4 ends by placing E. Focus centers that LOCAL final operation;
          // unlike task 6, the full long ℓ segments need not fit simultaneously.
          const targetPoints=task===4
            ? ['E₁','E₂'].map(label=>[...svg.querySelectorAll('circle[data-label]')]
                .find(el=>el.getAttribute('data-label')===label))
            : [];
          const pointVisible=targetPoints.length===2&&targetPoints.every(el=>{
            if(!el)return false;
            const b=el.getBoundingClientRect();
            const cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;
            return cx>vr.left+3 && cx<vr.right-3 && cy>vr.top+3 && cy<bottom-3;
          });
          return {
            zoom:Number(document.querySelector('#zoomLabel').textContent.replace('%','').replace(',','.')),
            viewBox:svg.getAttribute('viewBox'),
            coords:lines.map(n=>[n.getAttribute('x1'),n.getAttribute('y1'),n.getAttribute('x2'),n.getAttribute('y2')]),
            visible:task===4?pointVisible:
              bounds.length===2&&bounds.every(b=>b.right>vr.left && b.left<vr.right && b.bottom>vr.top && b.top<bottom)
          };
        },task);
        const fit=await inspect();
        await page.locator('#mobileFocusBtn').click();
        await page.waitForTimeout(180);
        const local=await inspect();
        if(local.zoom<fit.zoom*(task===4?1.25:2))
          failures.push(''+variant+'/'+task+': local focus did not materially enlarge the distant final answer '+JSON.stringify({fit:fit.zoom,local:local.zoom}));
        if(!local.visible)
          failures.push(''+variant+'/'+task+': focused final '+(task===4?'E₁/E₂':'ℓ')+' is obscured or outside the visible work area');
        if(local.viewBox!==fit.viewBox||JSON.stringify(local.coords)!==JSON.stringify(fit.coords))
          failures.push(''+variant+'/'+task+': camera focus changed true projected coordinates');
        await page.screenshot({path:'mobile-screenshots/focus-v'+variant+'-t'+task+'.png',fullPage:false});
        await page.evaluate(()=>document.querySelector('#prevBtn').click());
        await page.waitForTimeout(110);
        const previous=await inspect();
        if(previous.zoom<=fit.zoom)
          failures.push(''+variant+'/'+task+': local focus lost after switching to previous construction');
        await page.evaluate(()=>document.querySelector('#nextBtn').click());
        await page.locator('#mobileFitBtn').click();
        await page.waitForTimeout(180);
        const restored=await inspect();
        if(Math.abs(restored.zoom-fit.zoom)>.2)
          failures.push(''+variant+'/'+task+': Fit did not restore full-diagram scale');
        if(restored.viewBox!==fit.viewBox||JSON.stringify(restored.coords)!==JSON.stringify(fit.coords))
          failures.push(''+variant+'/'+task+': Fit/Focus altered source geometry');
      }

    }
  }

  // Manual-evidence regression: 13/6 contains very distant auxiliary
  // sections. Its eighth step used to be unreadable at 3.9% zoom.
  await page.evaluate(()=>{
    const v=document.querySelector('#variantSelect');
    const task=document.querySelector('#taskSelect');
    v.value='13';v.dispatchEvent(new Event('change'));
    task.value='6';task.dispatchEvent(new Event('change'));
    document.querySelector('#firstBtn')?.click();
    for(let i=0;i<7;i++) document.querySelector('#nextBtn')?.click();
  });
  await page.locator('#mobileFocusBtn').click();
  await page.waitForTimeout(210);
  const extreme=await page.evaluate(()=>{
    const label=Number(document.querySelector('#zoomLabel')?.textContent.replace('%','').replace(',','.'));
    const wrap=document.querySelector('.paper-wrap')?.getBoundingClientRect();
    const panel=document.querySelector('#stepSheet')?.getBoundingClientRect();
    const dots=[...document.querySelectorAll('#drawing circle.active-dot')];
    const bottom=panel?Math.min(wrap.bottom,panel.top-8):wrap.bottom;
    return {
      label, count:dots.length,
      visible:dots.some(n=>{
        const r=n.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
        return x>wrap.left+4&&x<wrap.right-4&&y>wrap.top+4&&y<bottom-4;
      })
    };
  });
  if(extreme.label<12 || !extreme.count || !extreme.visible)
    failures.push('13/6 step 8: focus did not reveal the active constructed point '+JSON.stringify(extreme));
  await page.screenshot({path:'mobile-screenshots/focus-v13-t6-step08.png',fullPage:false});

  // Recheck four genuinely hard-to-read historical intermediate frames.
  // The one-time 817-step capture predates the local camera correction;
  // these tests assert the current zoom and visibility, not old JPEG values.
  // 01/5 can legitimately acquire extra preliminary T/U/g steps.
  // Locate the actual competing-point construction by its semantic title
  // so subsequent method improvements cannot silently move this regression
  // to an unrelated (and inactive) drawing stage.
  const [visibilityIndex,transferIndex]=await page.evaluate(()=>{
    const vs=document.querySelector('#variantSelect');
    const ts=document.querySelector('#taskSelect');
    vs.value='01';vs.dispatchEvent(new Event('change'));
    ts.value='5';ts.dispatchEvent(new Event('change'));
    document.querySelector('#firstBtn')?.click();
    const count=Number(document.querySelector('#stepTotal').textContent);
    let witness=-1,transfer=-1;
    for(let n=0;n<count;n++){
      const title=document.querySelector('#stepTitle').textContent.trim();
      if(title.startsWith('Видимость на Π₂: отметь'))witness=n;
      if(title.startsWith('Перенеси 5₂≡6₂'))transfer=n;
      if(n<count-1)document.querySelector('#nextBtn')?.click();
    }
    return [witness,transfer];
  });
  if(visibilityIndex<0||transferIndex!==visibilityIndex+1)
    failures.push('01/5: missing consecutive 5₂≡6₂ witness/projector stages');

  for(const [variant,task,index] of [
    ['01',5,visibilityIndex],['01',5,transferIndex],['12',6,20],['13',5,6]
  ].filter(row=>row[2]>=0)){
    await page.evaluate(({variant,task,index})=>{
      const vs=document.querySelector('#variantSelect');
      const ts=document.querySelector('#taskSelect');
      vs.value=variant;vs.dispatchEvent(new Event('change'));
      ts.value=String(task);ts.dispatchEvent(new Event('change'));
      document.querySelector('#firstBtn')?.click();
      for(let n=0;n<index;n++)document.querySelector('#nextBtn')?.click();
    },{variant,task,index});
    await page.locator('#mobileFitBtn').click();
    await page.waitForTimeout(100);
    const before=await page.locator('#drawing').getAttribute('viewBox');
    await page.locator('#mobileFocusBtn').click();
    await page.waitForTimeout(220);
    const evidence=await page.evaluate(()=>{
      const wrap=document.querySelector('.paper-wrap').getBoundingClientRect();
      const panel=document.querySelector('#stepSheet').getBoundingClientRect();
      const bottom=getComputedStyle(document.querySelector('#stepSheet')).position==='fixed'
        ? Math.min(wrap.bottom,panel.top-8):wrap.bottom;
      const dots=[...document.querySelectorAll('#drawing circle.active-dot')];
      return {
        zoom:Number(document.querySelector('#zoomLabel').textContent.replace('%','').replace(',','.')),
        step:Number(document.querySelector('#stepNumber').textContent),
        viewBox:document.querySelector('#drawing').getAttribute('viewBox'),
        count:dots.length,
        visible:dots.some(dot=>{
          const b=dot.getBoundingClientRect();
          const x=(b.left+b.right)/2,y=(b.top+b.bottom)/2;
          return x>wrap.left+4&&x<wrap.right-4&&y>wrap.top+4&&y<bottom-4;
        })
      };
    });
    if(evidence.zoom<12||!evidence.count||!evidence.visible)
      failures.push(variant+'/'+task+' step '+(index+1)+
        ': focused new point still unreadable '+JSON.stringify(evidence));
    if(evidence.viewBox!==before)
      failures.push(variant+'/'+task+' step '+(index+1)+
        ': local camera changed drawing coordinates');

    // The active strokes use a staggered 620–1010 ms CSS drawing animation.
    // An early screenshot showed floating competing dots even when both
    // construction extensions existed and were scheduled to be drawn.
    // Verify actual endpoint connectivity, then capture the completed step.
    if(variant==='01' && task===5){
      const connectivity=await page.evaluate(()=>{
        const active=[...document.querySelectorAll('#drawing line.construction-line[data-active="1"]')];
        const dotOf=label=>[...document.querySelectorAll('#drawing circle[data-label]')]
          .find(el=>el.getAttribute('data-label')===label);
        const touches=label=>{
          const dot=dotOf(label);
          if(!dot)return -1;
          const x=Number(dot.getAttribute('cx')),y=Number(dot.getAttribute('cy'));
          return active.filter(el=>['1','2'].some(k=>
            Math.hypot(Number(el.getAttribute('x'+k))-x,Number(el.getAttribute('y'+k))-y)<1e-4
          )).length;
        };
        const witnessIntersections=label=>{
          const dot=dotOf(label);
          if(!dot)return -1;
          const x=Number(dot.getAttribute('cx')),y=Number(dot.getAttribute('cy'));
          const dirs=[...document.querySelectorAll(
            '#drawing line.object-line, #drawing line.aux-line, #drawing line.construction-line')]
            .map(el=>{
              const a={x:+el.getAttribute('x1'),y:+el.getAttribute('y1')};
              const b={x:+el.getAttribute('x2'),y:+el.getAttribute('y2')};
              const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
              if(len<1e-8)return null;
              const t=((x-a.x)*dx+(y-a.y)*dy)/(len*len);
              const gap=Math.abs(dx*(y-a.y)-dy*(x-a.x))/len;
              return t>=-1e-6&&t<=1+1e-6&&gap<1e-4
                ?{x:dx/len,y:dy/len}:null;
            }).filter(Boolean);
          return dirs.some((a,i)=>dirs.some((b,j)=>
            i!==j&&Math.abs(a.x*b.y-a.y*b.x)>1e-4))?2:0;
        };
        return {witness:witnessIntersections('5₂≡6₂'),
          front:touches('5₁'),plane:touches('6₁')};
      });
      if(index===visibilityIndex && connectivity.witness<2)
        failures.push('01/5 step '+(index+1)+': two nonparallel drawn lines do not meet at 5₂≡6₂ '+JSON.stringify(connectivity));
      if(index===transferIndex && (connectivity.front<1||connectivity.plane<1))
        failures.push('01/5 step '+(index+1)+': drawn projectors do not reach both 5₁ and 6₁ '+JSON.stringify(connectivity));
    }
    await page.waitForTimeout(1250);
    await page.screenshot({
      path:'mobile-screenshots/focus-v'+variant+'-t'+task+'-step'+
        String(index+1).padStart(2,'0')+'.png',
      fullPage:false
    });
  }


  // Current-version visual evidence for the real P/Q section-extension fix:
  // historical screenshots 18/6 and 19/6 showed an isolated P far beyond
  // truncated auxiliary strokes. Verify the entire completed construction.
  for(const variant of ['18','19']){
    const reached=await page.evaluate(variant=>{
      const vs=document.querySelector('#variantSelect');
      const ts=document.querySelector('#taskSelect');
      vs.value=variant;vs.dispatchEvent(new Event('change'));
      ts.value='6';ts.dispatchEvent(new Event('change'));
      document.querySelector('#firstBtn').click();
      for(let n=0;n<30;n++){
        if(document.querySelector('#stepTitle').textContent.includes('Пересеки линии сечения α и получи P'))return true;
        document.querySelector('#nextBtn').click();
      }
      return false;
    },variant);
    if(!reached){failures.push(variant+'/6: no step explaining intersection P');continue;}
    await page.locator('#mobileFocusBtn').click();
    await page.waitForTimeout(1500);
    const section=await page.evaluate(()=>{
      const dot=[...document.querySelectorAll('#drawing circle[data-label]')]
        .find(e=>/^P[₁₂]$/.test(e.getAttribute('data-label')));
      if(!dot)return {count:-1};
      const p={x:+dot.getAttribute('cx'),y:+dot.getAttribute('cy')};
      const lines=[...document.querySelectorAll('#drawing line.aux-line, #drawing line.construction-line')];
      const dirs=[];
      for(const el of lines){
        const a={x:+el.getAttribute('x1'),y:+el.getAttribute('y1')};
        const b={x:+el.getAttribute('x2'),y:+el.getAttribute('y2')};
        const v={x:b.x-a.x,y:b.y-a.y};
        const den=Math.hypot(v.x,v.y);
        if(den<1e-8)continue;
        const t=((p.x-a.x)*v.x+(p.y-a.y)*v.y)/(den*den);
        const off=Math.abs(v.x*(p.y-a.y)-v.y*(p.x-a.x))/den;
        if(t>=-1e-6&&t<=1+1e-6&&off<1e-4)dirs.push({x:v.x/den,y:v.y/den});
      }
      const intersects=dirs.some((v,i)=>dirs.some((w,j)=>i!==j&&Math.abs(v.x*w.y-v.y*w.x)>1e-4));
      const wrap=document.querySelector('.paper-wrap').getBoundingClientRect();
      const bounds=dot.getBoundingClientRect();
      const visible=bounds.left<wrap.right&&bounds.right>wrap.left&&bounds.top<wrap.bottom&&bounds.bottom>wrap.top;
      return {count:dirs.length,intersects,visible,label:dot.getAttribute('data-label')};
    });
    if(!section.intersects||!section.visible)
      failures.push(variant+'/6: completed P cannot be traced to two visible drawing strokes '+JSON.stringify(section));
    await page.screenshot({path:'mobile-screenshots/fixed-v'+variant+'-t6-P.png',fullPage:false});
  }

  // A plane given by A and a needs a *visible* construction of the
  // second in-plane line g=AT before Omega and visibility (02/5).
  // Capture only the three new stages, not the entire 820-stage archive.
  for(const [step,expected] of [
    [3,'Выбери T₁ на '],
    [4,'По линии связи получи T₂ на '],
    [5,'Соедини A с T – построй g₁ и g₂']
  ]){
    const status=await page.evaluate(({step})=>{
      const vs=document.querySelector('#variantSelect');
      const ts=document.querySelector('#taskSelect');
      vs.value='02';vs.dispatchEvent(new Event('change'));
      ts.value='5';ts.dispatchEvent(new Event('change'));
      document.querySelector('#firstBtn').click();
      for(let n=1;n<step;n++)document.querySelector('#nextBtn').click();
      return {
        title:document.querySelector('#stepTitle').textContent.trim(),
        labels:[...document.querySelectorAll('#drawing circle[data-label]')].map(x=>x.getAttribute('data-label')),
        gs:[...document.querySelectorAll('#drawing text')].map(x=>x.textContent).filter(x=>x==='g₁'||x==='g₂'),
        count:[...document.querySelectorAll('#drawing line.aux-line[data-active="1"]')].length
      };
    },{step});
    if(!status.title.startsWith(expected))
      failures.push('02/5 method stage '+step+' wrong title '+JSON.stringify(status));
    if(step===3 && (status.labels.includes('T₂')||status.gs.length))
      failures.push('02/5: derived T₂ or g appears before its projector '+JSON.stringify(status));
    if(step===4 && (!status.labels.includes('T₂')||status.gs.length))
      failures.push('02/5: paired T₂ missing or g prematurely shown '+JSON.stringify(status));
    if(step===5 && (status.gs.length!==2||status.count<2))
      failures.push('02/5: two drawn g projections missing '+JSON.stringify(status));
    await page.locator('#mobileFocusBtn').click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path:'mobile-screenshots/method-v02-t5-step'+String(step).padStart(2,'0')+'.png',
      fullPage:false
    });
  }

  // The one-time 817-frame visual archive exposed 21 historically near-empty
  // focused steps (nearly zero dark geometry pixels), usually because a long
  // auxiliary section determined an enormous camera bounding rectangle.
  // Also cover two 10/4 horizontal-construction stages that were only 3.5%
  // in the original archive. Revisit ONLY the documented problem frames.
  // This is not another 817-frame screenshot cycle.
  for(const [variant,task,index] of [
    ['01',5,10],['01',5,11],
    ['05',6,2],['05',6,9],
    ['10',4,3],['10',4,4],
    ['12',6,7],['12',6,13],['12',6,14],['12',6,20],['12',6,21],
    ['13',5,6],['13',5,7],
    ['13',6,5],['13',6,6],['13',6,7],['13',6,8],
    ['13',6,9],['13',6,12],['13',6,13],['13',6,14],
    ['13',6,15],['13',6,16]
  ]){
    await page.evaluate(({variant,task,index})=>{
      const v=document.querySelector('#variantSelect');
      const t=document.querySelector('#taskSelect');
      v.value=variant;v.dispatchEvent(new Event('change'));
      t.value=String(task);t.dispatchEvent(new Event('change'));
      document.querySelector('#firstBtn')?.click();
      for(let n=0;n<index;n++)document.querySelector('#nextBtn')?.click();
    },{variant,task,index});
    await page.locator('#mobileFitBtn').click();
    const originalViewBox=await page.locator('#drawing').getAttribute('viewBox');
    await page.locator('#mobileFocusBtn').click();
    await page.waitForTimeout(140);
    const evidence=await page.evaluate(()=>{
      const wrap=document.querySelector('.paper-wrap').getBoundingClientRect();
      const panel=document.querySelector('#stepSheet');
      const panelBox=panel.getBoundingClientRect();
      const bottom=getComputedStyle(panel).position==='fixed'
        ? Math.min(wrap.bottom,panelBox.top-8):wrap.bottom;
      const nodes=[...document.querySelectorAll('#drawing circle.active-dot,#drawing line.active-line')];
      // The newest point is the camera anchor if a step introduces points.
      // A line-only step may contain multiple legitimate distant segments;
      // seeing at least one active segment is enough for local manual work.
      const dots=nodes.filter(n=>n.matches('circle.active-dot'));
      const targets=dots.length?[dots[dots.length-1]]:nodes;
      const visible=targets.some(node=>{
        const b=node.getBoundingClientRect();
        return b.right>wrap.left+4&&b.left<wrap.right-4&&
          b.bottom>wrap.top+4&&b.top<bottom-4;
      });
      return {
        zoom:Number(document.querySelector('#zoomLabel').textContent.replace('%','').replace(',','.')),
        viewBox:document.querySelector('#drawing').getAttribute('viewBox'),
        active:nodes.length,visible
      };
    });
    if(evidence.zoom<9||!evidence.active||!evidence.visible)
      failures.push(variant+'/'+task+' step '+(index+1)+
        ': historically near-empty focused operation '+JSON.stringify(evidence));
    if(evidence.viewBox!==originalViewBox)
      failures.push(variant+'/'+task+' step '+(index+1)+
        ': camera changed original geometry');
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

  // Variant 06/4 has a recovered paper original and corrected m/n pairing.
  await context.close();
}

// A variant chooser narrower than six fixed columns must never clip
// option 6, 12, 18 or the custom variant on tablet / laptop layouts.
for(const viewport of [{width:768,height:700},{width:1024,height:768},
                       {width:1440,height:900}]){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  await page.addInitScript(()=>localStorage.clear());
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('#offerCloseBtn').click();
  await page.locator('.first-run-variant[data-variant="12"]').click();
  await page.locator('.first-run-task[data-task="4"]').click();
  await page.locator('#firstRunStart').click();
  const cells=await page.evaluate(()=>{
    const panel=document.querySelector('#controlsPanel').getBoundingClientRect();
    const grid=document.querySelector('#variantChips').getBoundingClientRect();
    const buttons=[...document.querySelectorAll('#variantChips .variant-chip')]
      .filter(el=>getComputedStyle(el).display!=='none')
      .map(el=>{
        const box=el.getBoundingClientRect();
        return {label:el.textContent.trim(),left:box.left,right:box.right,
          clipped:box.left<panel.left-1||box.right>panel.right+1};
      });
    return {buttons,gridClipped:grid.left<panel.left-1||grid.right>panel.right+1,
      panelRight:panel.right,gridRight:grid.right};
  });
  if(cells.buttons.length<20||cells.gridClipped||cells.buttons.some(x=>x.clipped))
    failures.push('variant options clipped '+viewport.width+'px '+JSON.stringify({
      gridClipped:cells.gridClipped,panelRight:cells.panelRight,gridRight:cells.gridRight,
      buttons:cells.buttons.filter(x=>x.clipped)}));
  await context.close();
}

// Responsive desktop and narrow-tablet checks. Keep the sidebar usable
// within the window and the drawing free of side-column overlaps.
for (const vp of [
  {name:'tablet-portrait',width:768,height:700},
  {name:'laptop',width:1024,height:768},
  {name:'desktop',width:1440,height:900},
  {name:'wide-desktop',width:1920,height:1080}
]) {
  const context=await browser.newContext({
    viewport:{width:vp.width,height:vp.height},
    deviceScaleFactor:1,
    isMobile:false
  });
  const page=await context.newPage();
  await page.addInitScript(()=>localStorage.clear());
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('#offerCloseBtn').click();
  await page.locator('.first-run-variant[data-variant="12"]').click();
  await page.locator('.first-run-task[data-task="4"]').click();
  await page.locator('#firstRunStart').click();
  await page.locator('#zoomFitBtn').click();
  await visibleOverflow(page,vp.name+' main');
  const layout=await page.evaluate(()=>{
    const rect=s=>document.querySelector(s)?.getBoundingClientRect();
    const sidebar=rect('#controlsPanel');
    const stage=rect('.stage-panel');
    const toolbar=rect('.stage-toolbar');
    const wrap=rect('.paper-wrap');
    const badButtons=[...document.querySelectorAll('.stage-toolbar button')]
      .filter(el=>getComputedStyle(el).display!=='none')
      .map(el=>el.getBoundingClientRect())
      .filter(r=>r.right>toolbar.right+1||r.left<toolbar.left-1||
        r.top<toolbar.top-1||r.bottom>toolbar.bottom+1).length;
    const step=document.querySelector('.step-info-page');
    const guidance=rect('#stepSheet');
    const sideBySide=innerWidth<1360 || (!!guidance && guidance.left>=stage.right-1 && guidance.top<stage.bottom);
    return {
      separated:!!sidebar&&!!stage&&sidebar.right<=stage.left-4,
      sideBySide,
      sidebarScrollable:getComputedStyle(document.querySelector('#controlsPanel')).overflowY==='auto',
      sidebarFits:sidebar.height<=innerHeight-10,
      controlsVisible:sidebar.width>=230,
      clippedVariants:[...document.querySelectorAll('.variant-chip')]
        .filter(el=>{
          const r=el.getBoundingClientRect(), container=rect('#variantChips');
          return container && (r.left<container.left-1||
            r.right>container.right+1||r.width<26);
        }).length,
      drawingVisible:wrap.width>=320&&wrap.height>=350,
      badButtons,
      clippedStep:step.scrollHeight>step.clientHeight+1
    };
  });
  if(!layout.separated||!layout.sideBySide||!layout.sidebarScrollable||!layout.sidebarFits||
     !layout.controlsVisible||!layout.drawingVisible||layout.badButtons||layout.clippedVariants||
     layout.clippedStep) failures.push(vp.name+': responsive desktop regression '+JSON.stringify(layout));
  await page.screenshot({path:'mobile-screenshots/'+vp.name+'-workspace.png',fullPage:false});
  await context.close();
}

// Distant intersections: the source-only camera control must enlarge
// the actual paper scheme without changing the current construction step.
{
  const context=await browser.newContext({
    viewport:{width:360,height:800},deviceScaleFactor:2,isMobile:true,hasTouch:true
  });
  const page=await context.newPage();
  await page.addInitScript(()=>localStorage.clear());
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('#offerCloseBtn').click();
  await page.locator('.first-run-variant[data-variant="12"]').click();
  await page.locator('.first-run-task[data-task="6"]').click();
  await page.locator('#firstRunStart').click();
  for(const [variant,task] of [['12','6'],['13','5']]){
    if(variant==='13')await page.evaluate(()=>{
      const v=document.querySelector('#variantSelect');
      v.value='13';v.dispatchEvent(new Event('change',{bubbles:true}));
      const t=document.querySelector('#taskSelect');
      t.value='5';t.dispatchEvent(new Event('change',{bubbles:true}));
    });
    if(!(await page.locator('#remoteSourceHint').isVisible()))
      failures.push(variant+'/'+task+': source-focus help is missing');
    const visibleHint=await page.locator('#remoteSourceHint span').textContent();
    if(!visibleHint?.includes('учебная реконструкция'))
      failures.push(variant+'/'+task+': reconstruction is not disclosed beside steps');
    const diagramWarning=await page.locator('#diagramWarning').textContent();
    if(!diagramWarning?.includes('Учебная реконструкция исходной схемы'))
      failures.push(variant+'/'+task+': reconstructed source not disclosed in mobile brief');
    const instructionOrder=await page.evaluate(()=>{
      const details=document.querySelector('#problemDetails');
      const text=document.querySelector('#stepInfoText')?.getBoundingClientRect();
      const nav=document.querySelector('.mobile-step-nav')?.getBoundingClientRect();
      return {collapsed:!!details&&!details.open,
        textBeforeNav:!!text&&!!nav&&text.top<nav.top};
    });
    if(!instructionOrder.collapsed||!instructionOrder.textBeforeNav)
      failures.push(variant+'/'+task+': instruction hidden behind recap '+JSON.stringify(instructionOrder));
    // A fit command on the FIRST stage already frames only the original
    // scheme; test the actual problem after the remote answer is drawn.
    await page.evaluate(()=>document.querySelector('#lastBtn').click());
    await page.evaluate(()=>document.querySelector('#zoomFitBtn').click());
    await page.waitForTimeout(70);
    const before=await page.locator('#drawing').evaluate(el=>el.getBoundingClientRect().width);
    const stepBefore=await page.locator('#stepNumber').textContent();
    await page.locator('#zoomSourceBtn').click();
    await page.waitForTimeout(80);
    const after=await page.locator('#drawing').evaluate(el=>el.getBoundingClientRect().width);
    const stepAfter=await page.locator('#stepNumber').textContent();
    if(!(after>before*1.1) || stepBefore!==stepAfter)
      failures.push(variant+'/'+task+': source-only camera not functional '+JSON.stringify({before,after,stepBefore,stepAfter}));
    await page.screenshot({path:'mobile-screenshots/source-focus-'+variant+'-'+task+'.png',fullPage:false});
  }
  await context.close();
}

// Welcome offer appears on a first opening, not after completing a task.
{
  const context=await browser.newContext({
    viewport:{width:360,height:800},deviceScaleFactor:2,isMobile:true,hasTouch:true
  });
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'networkidle'});
  if(!(await page.locator('#offerOverlay').isVisible()))
    failures.push('welcome offer: dialog not visible on first opening');
  if(!(await page.locator('#offerDialogTitle').isVisible()))
    failures.push('welcome offer: dialog heading not visible');
  if(!(await page.locator('#offerCloseBtn').isVisible()))
    failures.push('welcome offer: close button not visible above first-run chooser');
  const tg=await page.locator('.offer-contact').getAttribute('href');
  if(tg!=='https://t.me/shei1ny') failures.push('welcome offer: wrong Telegram address '+tg);
  await visibleOverflow(page,'welcome offer 360px');
  await page.screenshot({path:'mobile-screenshots/welcome-offer.png',fullPage:false});
  await page.locator('#offerCloseBtn').click();
  if(await page.locator('#offerOverlay').isVisible())
    failures.push('welcome offer: dialog did not close');
  if(!(await page.locator('#firstRunPicker').isVisible()))
    failures.push('welcome offer: variant picker is not available after dismissal');
  await page.locator('.first-run-variant[data-variant="12"]').click();
  await page.locator('.first-run-task[data-task="4"]').click();
  await page.locator('#firstRunStart').click();
  // On phones the desktop transport toolbar is intentionally hidden.
  // Trigger the same last-step handler directly for this behavior check.
  await page.evaluate(()=>document.querySelector('#lastBtn')?.click());
  await page.waitForTimeout(250);
  if(await page.locator('#offerOverlay').isVisible())
    failures.push('welcome offer: reappeared at the final step');
  await page.reload({waitUntil:'networkidle'});
  if(!(await page.locator('#offerOverlay').isVisible()))
    failures.push('welcome offer: not shown after reloading the page');
  await page.locator('#offerCloseBtn').click();
  if(await page.locator('#offerOverlay').isVisible())
    failures.push('welcome offer: cannot be dismissed after reload');
  if(await page.locator('#mobileContactLink').getAttribute('href')!=='https://t.me/shei1ny')
    failures.push('welcome offer: mobile persistent contact incorrect');
  if(await page.locator('.site-contact-note a').getAttribute('href')!=='https://t.me/shei1ny')
    failures.push('welcome offer: sidebar persistent contact incorrect');
  await context.close();
}

await browser.close();
fs.writeFileSync('mobile-layout-results.json',JSON.stringify({failures},null,2));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('All mobile layout checks passed.');
