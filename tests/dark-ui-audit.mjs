import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const failures=[];
const report=[];
fs.mkdirSync('dark-ui-screenshots',{recursive:true});

async function inspect(page,label){
  const data=await page.evaluate(()=>{
    const viewportWidth=document.documentElement.clientWidth;
    const visible=el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return s.display!=='none'&&s.visibility!=='hidden'&&
        Number(s.opacity)>.15&&r.width>2&&r.height>2&&!el.closest('[hidden],[inert]');
    };
    const isBright=str=>{
      const m=str?.match(/^rgba?\(([^)]+)\)/);
      if(!m)return false;
      const v=m[1].split(',').map(Number);
      return v[0]>=220&&v[1]>=213&&v[2]>=218&&(!Number.isFinite(v[3])||v[3]>.9);
    };
    const buttons=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea')]
      .filter(visible).map(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        const excluded=el.matches('.is-selected,[aria-selected=true],.is-active')||
          !!el.closest('.is-selected,[aria-selected=true]');
        const grad=/rgb\((?:25[0-5],\s*){3}\)|#fff(?:fff)?\b/i.test(s.backgroundImage);
        return {
          element:el.tagName.toLowerCase(),id:el.id,cls:String(el.className).slice(0,80),
          title:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,40),
          background:s.backgroundColor,image:s.backgroundImage.slice(0,95),
          light:!excluded&&(isBright(s.backgroundColor)||grad),
          rect:{x:r.x,y:r.y,width:r.width,height:r.height}
        };
      });
    const groupSelectors=[
      '.catalog-nav-actions','.topbar-links','.stage-toolbar .toolbar-groups',
      '.mobile-appbar','.mobile-sheet-actions'
    ];
    const overlap=[];
    for(const selector of groupSelectors){
      const el=document.querySelector(selector);
      if(!el||!visible(el))continue;
      const items=[...el.querySelectorAll('button,a[href]')].filter(visible);
      for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
        const a=items[i].getBoundingClientRect(),b=items[j].getBoundingClientRect();
        const x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
        const y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
        if(x>3&&y>3)overlap.push({selector,a:items[i].id,b:items[j].id,pixels:Math.round(x*y)});
      }
    }
    const surfaces=['.catalog-start-row','.catalog-work-setup','.offer-dialog',
      '.stage-toolbar','.controls-panel','.first-run-card'];
    const highlights=surfaces.map(selector=>{
      const el=document.querySelector(selector);
      if(!el||!visible(el))return null;
      const s=getComputedStyle(el);
      return {selector,background:s.backgroundColor,image:s.backgroundImage.slice(0,75),bright:isBright(s.backgroundColor)};
    }).filter(Boolean);
    return {theme:document.documentElement.dataset.theme,buttons:buttons.filter(x=>x.light),
      overlap,highlights,overflow:document.documentElement.scrollWidth-viewportWidth,
      buttonCount:buttons.length,viewportWidth};
  });
  const issues=[];
  if(data.theme!=='dark')issues.push('wrong theme');
  if(data.buttons.length)issues.push('bright unselected controls: '+JSON.stringify(data.buttons));
  if(data.overlap.length)issues.push('overlapping action buttons: '+JSON.stringify(data.overlap));
  if(data.highlights.some(s=>s.bright))issues.push('bright interface surfaces: '+JSON.stringify(data.highlights.filter(s=>s.bright)));
  if(data.overflow>3)issues.push('horizontal document overflow '+data.overflow);
  report.push({label,...data,issues});
  if(issues.length)failures.push({label,issues});
}

try{
  for(const vp of [
    {width:320,height:720},{width:393,height:873},{width:700,height:360},
    {width:1024,height:768},{width:1440,height:900}
  ]){
    const context=await browser.newContext({viewport:vp});
    await context.addInitScript(()=>localStorage.setItem('sitemath-theme','dark'));
    const page=await context.newPage(),id=vp.width+'x'+vp.height;
    await page.goto(base,{waitUntil:'networkidle'});
    await inspect(page,id+':offer');
    if(await page.locator('#offerOverlay').isVisible())await page.locator('#offerCloseBtn').click();
    await inspect(page,id+':courses');
    await page.locator('#courseCatalog .course-card').click();
    await inspect(page,id+':assignments');
    await page.locator('#assignmentCatalog button.assignment-card').click();
    await inspect(page,id+':setup');
    await page.locator('.first-run-variant[data-variant="12"]').click();
    await page.locator('.first-run-task[data-task="4"]').click();
    if([320,393,1024,1440].includes(vp.width))
      await page.screenshot({path:'dark-ui-screenshots/setup-'+id+'.png',fullPage:false});
    await inspect(page,id+':setup-selected');
    await page.locator('#firstRunStart').click();
    await inspect(page,id+':solver');
    if(vp.width<=760){
      if(await page.locator('#mobileFitBtn').isVisible())failures.push({label:id,issues:['Duplicate mobile Fit action visible']});
      if(!(await page.locator('#zoomFitBtn').isVisible()))failures.push({label:id,issues:['Drawing Fit action missing']});
      await page.locator('#mobileSetupBtn').click();
      await inspect(page,id+':mobile-settings');
      if([320,393].includes(vp.width))
        await page.screenshot({path:'dark-ui-screenshots/mobile-settings-'+id+'.png',fullPage:false});
      await page.locator('#mobileSetupClose').click();
    }
    if([320,393,1024,1440].includes(vp.width))
      await page.screenshot({path:'dark-ui-screenshots/solver-'+id+'.png',fullPage:false});
    await context.close();
  }
}finally{
  fs.writeFileSync('dark-ui-audit.json',JSON.stringify({report,failures},null,2));
  await browser.close();
}
if(failures.length){
  console.error('DARK_UI_FAIL',JSON.stringify(failures).slice(0,15000));
  process.exitCode=1;
}else console.log('Dark mode visual controls and responsive action groups verified across 5 viewports');
