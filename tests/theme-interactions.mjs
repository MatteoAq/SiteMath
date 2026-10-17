import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
try {
  for(const vp of [{width:1440,height:900},{width:393,height:873},{width:320,height:720}]){
    const ctx=await browser.newContext({viewport:vp});
    const page=await ctx.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('#offerCloseBtn').click();
    const root=page.locator('html'), catalog=page.locator('#catalogThemeToggle');
    assert.equal(await root.getAttribute('data-theme'),'light');
    await catalog.click();
    assert.equal(await root.getAttribute('data-theme'),'dark','Catalog theme switch failed '+vp.width);
    assert.equal(await catalog.getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>localStorage.getItem('sitemath-theme')),'dark');
    const background=await page.locator('body').evaluate(el=>getComputedStyle(el).background);
    assert(background.includes('23, 18, 31'),'Dark CSS is not applied '+vp.width+': '+background);
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#offerCloseBtn').click();
    assert.equal(await root.getAttribute('data-theme'),'dark','Theme not preserved');
    await catalog.click();
    assert.equal(await root.getAttribute('data-theme'),'light','Cannot switch back');
    await page.locator('#courseCatalog .course-card').click();
    await page.locator('#assignmentCatalog button.assignment-card').click();
    await page.locator('.first-run-variant[data-variant="12"]').click();
    await page.locator('.first-run-task[data-task="4"]').click();
    await page.locator('#firstRunStart').click();
    const paper=page.locator('#drawing');
    assert(await paper.isVisible(),'Drawing hidden '+vp.width);
    assert.equal(await paper.getAttribute('data-paper-format'),'A4');
    const dims=await paper.evaluate(el=>[el.getAttribute('width'),el.getAttribute('height')]);
    assert(dims.includes('210mm')&&dims.includes('297mm'),'A4 dimensions wrong '+dims);
    const wrap=page.locator('.paper-wrap');
    const workspace=await wrap.boundingBox();
    assert(workspace.width>250&&workspace.height>80,'Workspace collapsed '+JSON.stringify(workspace));
    if(vp.width>760){
      await page.locator('#desktopThemeToggle').click();
      assert.equal(await root.getAttribute('data-theme'),'dark','Desktop switch failed');
      for(let i=0;i<7;i++)await page.locator('#zoomInBtn').click();
      await wrap.evaluate(el=>{el.scrollLeft=180;el.scrollTop=120;});
      const before=await wrap.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}));
      await page.mouse.move(workspace.x+workspace.width/2,workspace.y+workspace.height/2);
      await page.mouse.down({button:'left'});
      await page.mouse.move(workspace.x+workspace.width/2-65,workspace.y+workspace.height/2-55,{steps:6});
      await page.mouse.up({button:'left'});
      const after=await wrap.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}));
      assert(after.x>before.x+15||after.y>before.y+15,'Mouse drag failed: '+JSON.stringify({before,after}));
    }else{
      await page.locator('#mobileSetupBtn').click();
      assert(await page.locator('#mobileThemeToggle').isVisible(),'Mobile switch missing');
      await page.locator('#mobileThemeToggle').click();
      assert.equal(await root.getAttribute('data-theme'),'dark','Mobile switch failed');
      assert(await page.locator('#mobileContactLink svg').isVisible(),'Telegram icon missing');
      await page.locator('#mobileSetupClose').click();
    }
    assert.equal(errors.length,0,'Browser errors '+vp.width+': '+errors.join('; '));
    await ctx.close();
  }
  console.log('Theme, persistence, A4 page, desktop pan and Telegram glyph OK');
}finally{await browser.close();}
