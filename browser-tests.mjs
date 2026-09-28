import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
let failures=[];
const check=(name,cond,detail='')=>{
  if(!cond){failures.push(name+(detail?': '+detail:''));console.error('FAIL',name,detail)}
  else console.log('PASS',name);
};
async function fillMatrix(page,root,vals){
  const inputs=page.locator(root+' input');
  check(root+' input count',(await inputs.count())===vals.length,String(await inputs.count()));
  for(let i=0;i<vals.length;i++) await inputs.nth(i).fill(String(vals[i]));
}
async function expectSuccess(page,sel,name){
  const el=page.locator(sel);
  await el.waitFor({state:'visible'});
  check(name,(await el.getAttribute('class')||'').includes('success'),await el.textContent());
}

const ctx=await browser.newContext({viewport:{width:1365,height:900}});
const page=await ctx.newPage();
await page.goto('http://127.0.0.1:8000/',{waitUntil:'networkidle'});

check('notes visible',await page.locator('#studyNotes').isVisible());
await page.locator('#studyNotes').fill('R2 ← R2 + 5R1');
await page.waitForTimeout(350);
await page.reload({waitUntil:'networkidle'});
check('notes persist',(await page.locator('#studyNotes').inputValue())==='R2 ← R2 + 5R1');

const task1=[
  ['2A',[4,6,-2,8]],['3B',[9,-15,6,-3]],['AB',[12,-13,5,1]],
  ['D',[-5,21,-8,11]],['C',[7,8,-3,12]]
];
for(const [key,vals] of task1){
  await fillMatrix(page,'#work'+key,vals);
  await page.locator('.check-work[data-step="'+key+'"]').click();
  await expectSuccess(page,'#feedback'+key,'task1 '+key);
}
check('task2 auto opens',await page.locator('#teacherTask2').isVisible());

for(const [key,vals] of [['A2',[1,18,-6,13]],['B2',[-1,-10,4,-9]],['K',[0,8,-2,4]]]){
  await fillMatrix(page,'#work'+key,vals);
  await page.locator('.check-work[data-step="'+key+'"]').click();
  await expectSuccess(page,'#feedback'+key,'task2 '+key);
}

await page.locator('.nav-btn[data-section="teacher"]').click();
await page.locator('#toggleTeacherAB').click();
await fillMatrix(page,'#workT3AB',[1,-7,-7,-3,25,0]);
await page.locator('.check-work[data-step="T3AB"]').click();
await expectSuccess(page,'#feedbackT3AB','teacher AB');
await page.locator('#baExistsGuess').selectOption('no');
await page.locator('#checkBAExists').click();
await expectSuccess(page,'#baExistsFeedback','BA dimension check');

await page.locator('#toggleFunctionTask').click();
for(const [key,vals] of [
  ['FA2',[11,-5,-10,6]],['F2A',[6,-2,-4,4]],['F4I',[4,0,0,4]],['F',[13,-7,-14,6]]
]){
  await fillMatrix(page,'#work'+key,vals);
  await page.locator('.check-work[data-step="'+key+'"]').click();
  await expectSuccess(page,'#feedback'+key,'function '+key);
}

await page.locator('.nav-btn[data-section="det"]').click();
const defaultDet=await page.evaluate(()=>window.MatrixCore.determinant([[3,-2,1],[-2,1,3],[2,0,-2]]));
await page.locator('#detGuess').fill(String(defaultDet));
await page.locator('#checkDetGuess').click();
await expectSuccess(page,'#detGuessFeedback','det self-check');

await page.locator('#loadTeacherEquation').click();
await page.locator('#varPolyGuess').fill('-14x-42');
await page.locator('#checkVarPolyGuess').click();
await expectSuccess(page,'#varPolyFeedback','det(x) polynomial check');
await page.locator('#varAnswerGuess').fill('x=-3');
await page.locator('#checkVarAnswerGuess').click();
await expectSuccess(page,'#varAnswerFeedback','det(x) final answer');

await page.locator('.nav-btn[data-section="rank"]').click();
await page.locator('#loadTeacherRank').click();
await page.locator('#rankOperation').selectOption('add');
await page.locator('#rankRowA').selectOption('2');
await page.locator('#rankRowB').selectOption('1');
await page.locator('#rankFactor').fill('5');
await page.locator('#applyRankOperation').click();
const rankCells=await page.locator('#rankWorkingMatrix .render-matrix span').allTextContents();
check('rank operation applied',rankCells.join(',')==='-1,2,-3,0,16,-17,4,-3,1',rankCells.join(','));
check('rank history created',(await page.locator('#rankHistory .history-line').count())===1);
await page.locator('#rankGuess').fill('3');
await page.locator('#checkRankGuess').click();
await expectSuccess(page,'#rankGuessFeedback','rank answer');

await page.locator('.nav-btn[data-section="sheet"]').click();
await page.locator('#teacherSheetImage').waitFor({state:'visible'});
const imgInfo=await page.locator('#teacherSheetImage').evaluate(img=>({
  naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,src:img.getAttribute('src'),width:img.style.width
}));
check('HQ worksheet dimensions',imgInfo.naturalWidth>=950&&imgInfo.naturalHeight>=1200,JSON.stringify(imgInfo));
check('HQ worksheet source',imgInfo.src?.startsWith('teacher-sheet-hq.jpg'),imgInfo.src);
await page.locator('#sheetZoomIn').click();
await page.locator('#sheetZoomIn').click();
check('worksheet zoom 150%',(await page.locator('#teacherSheetImage').getAttribute('style')||'').includes('150%'));

await ctx.close();

for(const width of [390,320]){
  const mctx=await browser.newContext({viewport:{width,height:844}});
  const p=await mctx.newPage();
  await p.goto('http://127.0.0.1:8000/',{waitUntil:'networkidle'});
  const metrics=await p.evaluate(()=> {
    const nav=document.querySelector('.sidebar').getBoundingClientRect();
    const notes=document.querySelector('#studyNotesCard').getBoundingClientRect();
    const work=document.querySelector('#teacherTaskWorkspace');
    return {
      viewport:innerWidth,
      pageScrollWidth:document.documentElement.scrollWidth,
      bodyScrollWidth:document.body.scrollWidth,
      navBottom:nav.bottom,
      notesTop:notes.top,
      workClient:work.clientWidth,
      workScroll:work.scrollWidth
    };
  });
  check('mobile '+width+' no page overflow',metrics.pageScrollWidth<=width+1&&metrics.bodyScrollWidth<=width+1,JSON.stringify(metrics));
  check('mobile '+width+' notes below nav',metrics.notesTop>=metrics.navBottom-1,JSON.stringify(metrics));
  check('mobile '+width+' workspace fits',metrics.workScroll<=metrics.workClient+2,JSON.stringify(metrics));
  await mctx.close();
}

await browser.close();
if(failures.length){
  console.error('\nBrowser failures:',failures);
  process.exit(1);
}
console.log('\nAll browser interaction checks passed.');
