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
    assert(await page.locator('#offerOverlay').isVisible(),
      'Welcome dialog should open once on first entry');
    await page.locator('#offerCloseBtn').click();
    assert(await page.locator('#catalogCoursesView').isVisible(),
      'Library must start with course selection');
    assert.equal(await page.locator('#courseCatalog button.course-card').count(),1);
    await page.locator('#courseCatalog button.course-card').click();
    assert.equal((await page.locator('#assignmentCatalog button.assignment-card').count()),1,
      'Only one available album should be actionable');
    const title=(await page.locator('#assignmentCatalog .assignment-card h3').textContent())?.trim();
    assert.equal(title,'Задание № 1');
    assert(await page.locator('#assignmentCatalog .assignment-future').isVisible(),
      'Non-actionable future slot missing');
    assert(!(await page.locator('#activeAssignment').isVisible()),
      'Variant picker must stay hidden on the actual catalogue screen');
    assert.equal(await page.locator('#firstRunVariants .first-run-variant').count(),21);
    assert.equal(await page.locator('#firstRunTasks .first-run-task').count(),6);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert(overflow<=1,'Catalogue scrolls horizontally at '+size.width+'px: '+overflow);
    await page.locator('#catalogCommissionBtn').click();
    assert(await page.locator('#offerOverlay').isVisible(),
      'Existing offer window must be accessible from catalogue');
    await page.locator('#offerCloseBtn').click();
    await page.locator('#assignmentCatalog button.assignment-card').click();
    assert(!(await page.locator('#catalogListView').isVisible()),
      'Album details should replace the list rather than extend the long page');
    assert(await page.locator('#activeAssignment').isVisible(),
      'Choosing an album did not show its variants and tasks');
    await page.locator('#catalogListBackBtn').click();
    assert(await page.locator('#catalogListView').isVisible(),
      'Cannot return from setup to assignments');
    await page.locator('#catalogListBackBtn').click();
    assert(await page.locator('#catalogCoursesView').isVisible(),
      'Cannot return from assignments to courses');
    await page.locator('#courseCatalog button.course-card').click();
    await page.locator('#assignmentCatalog button.assignment-card').click();
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
    assert(!(await page.locator('#activeAssignment').isVisible()),
      'Return from solver should open the course list');
    assert(await page.locator('#catalogCoursesView').isVisible(),
      'Returning from solver did not show courses');
    const saved=await page.evaluate(()=>localStorage.getItem('sitemath-selection'));
    assert(saved&&saved.includes('"variant":"12"'),'Solver did not persist the chosen variant');
    await page.reload({waitUntil:'networkidle'});
    assert(await home.isVisible(),
      'A returning visitor must see the growing assignment library');
    assert.equal(await page.locator('#firstRunVariantSummary').textContent(),'Вариант 12',
      'Returning visitor lost the selected variant');
    assert(!(await page.locator('#offerOverlay').isVisible()),
      'Welcome dialog should not reappear on reload in the same tab');
    await page.locator('#courseCatalog button.course-card').click();
    await page.locator('#assignmentCatalog button.assignment-card').click();
    assert(!(await page.locator('#firstRunStart').isDisabled()),
      'Saved variant and task should enable reopening the solver');
    await page.close();
  }
  console.log('Course catalogue, concise student title, one-time welcome offer and solver navigation OK');
}finally { await browser.close(); }
