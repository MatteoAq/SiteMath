import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try {
  for(const size of [{width:1440,height:900},{width:393,height:873},{width:320,height:720}]){
    const page=await browser.newPage({viewport:size});
    // browser.newPage provides an isolated, empty context. Do not install a
    // persistent init script clearing localStorage: it would also clear the
    // saved selection on the reload being tested.
    await page.goto(base,{waitUntil:'networkidle'});
    const home=page.locator('#firstRunPicker');
    assert(await home.isVisible(),'Catalogue entry missing at '+size.width);
    assert(!(await page.locator('#offerOverlay').isVisible()),
      'Sales dialog should not hide the library on initial load');
    assert.equal((await page.locator('#assignmentCatalog button.assignment-card').count()),1,
      'Only one available album should be actionable');
    const title=(await page.locator('#assignmentCatalog .assignment-card h3').textContent())?.trim();
    assert.equal(title,'Задание № 1 Альбом из 6 задач (для очников)');
    assert(await page.locator('#assignmentCatalog .assignment-future').isVisible(),
      'Non-actionable future slot missing');
    assert.equal(await page.locator('#firstRunVariants .first-run-variant').count(),21);
    assert.equal(await page.locator('#firstRunTasks .first-run-task').count(),6);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert(overflow<=1,'Catalogue scrolls horizontally at '+size.width+'px: '+overflow);
    await page.locator('#catalogCommissionBtn').click();
    assert(await page.locator('#offerOverlay').isVisible(),
      'Existing offer window must be accessible from catalogue');
    await page.locator('#offerCloseBtn').click();
    await page.locator('.first-run-variant[data-variant="12"]').click();
    await page.locator('.first-run-task[data-task="6"]').click();
    await page.locator('#firstRunStart').click();
    assert(!(await home.isVisible()),'Catalogue remained open after solver started');
    assert((await page.locator('#stageCurrentTitle').textContent())?.trim(),
      'Step-by-step drawing missing');
    if(size.width>760)await page.locator('#catalogBackBtn').click();
    else{
      await page.locator('#mobileSetupBtn').click();
      await page.locator('#mobileCatalogBackBtn').click();
    }
    assert(await home.isVisible(),'Cannot return to catalogue from solver');
    assert.equal(await page.locator('#firstRunVariantSummary').textContent(),'Вариант 12');
    const saved=await page.evaluate(()=>localStorage.getItem('sitemath-selection'));
    assert(saved&&saved.includes('"variant":"12"'),'Solver did not persist the chosen variant');
    await page.reload({waitUntil:'networkidle'});
    assert(await home.isVisible(),
      'A returning visitor must see the growing assignment library');
    assert.equal(await page.locator('#firstRunVariantSummary').textContent(),'Вариант 12',
      'Returning visitor lost the selected variant');
    assert(!(await page.locator('#firstRunStart').isDisabled()),
      'Saved variant and task should enable reopening the solver');
    await page.close();
  }
  console.log('Assignment catalogue, exact university title, mobile layout, solver routing and navigation OK');
}finally { await browser.close(); }
