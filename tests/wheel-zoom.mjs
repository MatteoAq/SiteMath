import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1360,height:900}});
const page=await context.newPage();
try{
  await page.goto(base,{waitUntil:'networkidle'});
  if(await page.locator('#offerOverlay').isVisible())await page.locator('#offerCloseBtn').click();
  await page.locator('#courseCatalog button.course-card').click();
  await page.locator('#assignmentCatalog button.assignment-card').click();
  await page.locator('.first-run-variant[data-variant="12"]').click();
  await page.locator('.first-run-task[data-task="6"]').click();
  await page.locator('#firstRunStart').click();
  const snapshot=()=>page.evaluate(()=>{
    const svg=document.querySelector('#drawing'),wrap=document.querySelector('.paper-wrap');
    const r=svg.getBoundingClientRect(),w=wrap.getBoundingClientRect();
    return {
      width:r.width,height:r.height,
      label:document.querySelector('#zoomLabel')?.textContent,
      innerWidth:window.innerWidth,
      dpr:window.devicePixelRatio,
      scale:window.visualViewport?.scale,
      x:Math.min(w.right-45,Math.max(w.left+45,w.left+w.width/2)),
      y:Math.min(w.bottom-45,Math.max(w.top+45,w.top+w.height/2)),
      svgLeft:r.left,svgTop:r.top
    };
  });
  // Begin with a scrollable paper and a known zoom before checking the
  // content-space pointer anchor (rather than relying on a fit-mode camera).
  await page.locator('#zoom100Btn').click();
  await page.locator('#zoomInBtn').click();
  await page.locator('#zoomInBtn').click();
  await page.locator('#zoomInBtn').click();
  await page.locator('.paper-wrap').scrollIntoViewIfNeeded();
  const before=await snapshot();
  await page.mouse.move(before.x,before.y);
  await page.mouse.wheel(0,-180);
  const after=await snapshot();
  assert(after.width>before.width*1.12,
    'Plain wheel over paper should zoom the SVG in');
  assert.equal(after.innerWidth,before.innerWidth,
    'Wheel over paper changed browser page width');
  assert.equal(after.dpr,before.dpr,
    'Wheel over paper unexpectedly changed browser zoom');
  // An interior SVG coordinate under the cursor should remain stable
  // unless the scroll area clamps at an image edge.
  const imageCoord=(state)=>[
    (before.x-state.svgLeft)/state.width,
    (before.y-state.svgTop)/state.height
  ];
  const p=imageCoord(before),q=imageCoord(after);
  if(p.every(v=>v>.1&&v<.9) && before.width>650 && before.height>500){
    assert(Math.abs(p[0]-q[0])<.025 && Math.abs(p[1]-q[1])<.025,
      'Wheel zoom should stay centered near the mouse pointer');
  }
  await page.keyboard.down('Control');
  await page.mouse.wheel(0,-160);
  await page.keyboard.up('Control');
  const ctrl=await snapshot();
  assert(ctrl.width>after.width*1.1,
    'Ctrl+wheel over paper should zoom the drawing');
  assert.equal(ctrl.innerWidth,before.innerWidth,
    'Ctrl+wheel changed page zoom instead of drawing zoom');
  assert.equal(ctrl.dpr,before.dpr,
    'Ctrl+wheel changed browser devicePixelRatio');
  assert.equal(ctrl.scale,before.scale,
    'Ctrl+wheel changed visual viewport scale');

  await page.mouse.wheel(0,200);
  const reverse=await snapshot();
  assert(reverse.width<ctrl.width*.9,'Wheel reversal should zoom back out');

  await page.mouse.move(15,25);
  await page.mouse.wheel(0,250);
  const outside=await snapshot();
  assert(Math.abs(outside.width-reverse.width)<1,
    'Wheel outside drawing must not modify drawing zoom');

  // Exercise both user-approved reconstructions with the wheel-enabled
  // viewer, including their final result and step navigation.
  for(const [variant,task] of [['12','6'],['13','5']]){
    await page.evaluate(({variant,task})=>{
      const v=document.querySelector('#variantSelect'),t=document.querySelector('#taskSelect');
      v.value=variant;v.dispatchEvent(new Event('change'));
      t.value=task;t.dispatchEvent(new Event('change'));
      document.querySelector('#firstBtn').click();
    },{variant,task});
    assert(await page.locator('#drawing line.object-line').count()>3,
      variant+'/'+task+': reconstructed first drawing is not visible');
    await page.locator('#lastBtn').click();
    assert(await page.locator('#drawing line.answer-line').count()>0,
      variant+'/'+task+': final drawn result missing');
    assert((await page.locator('#stageCurrentTitle').textContent())?.trim(),
      variant+'/'+task+': step title missing next to canvas');
  }
  console.log('Mouse wheel, Ctrl+wheel, pointer-anchor and 12/6–13/5 regression OK');
}finally{
  await context.close();
  await browser.close();
}
