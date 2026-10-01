import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const viewports = [
  {name:'android-narrow', width:320, height:720},
  {name:'android-common', width:360, height:800},
  {name:'android-tall', width:393, height:873},
  {name:'android-wide', width:412, height:915},
  {name:'landscape', width:800, height:360},
];

const browser = await chromium.launch({headless:true});
const failures = [];
fs.mkdirSync('mobile-screenshots',{recursive:true});

async function visibleOverflow(page,label){
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
    const offenders = [];
    for (const el of document.querySelectorAll('button, input, select, .panel, .mobile-appbar, .stage-toolbar, .controls-panel, .explanation-panel')) {
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

  await context.close();
}

await browser.close();
fs.writeFileSync('mobile-layout-results.json',JSON.stringify({failures},null,2));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('All mobile layout checks passed.');
