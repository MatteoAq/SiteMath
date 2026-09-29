import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const failures=[];
const check=(name,cond,detail='')=>{
  if(!cond){failures.push(name+(detail?': '+detail:''));console.error('FAIL',name,detail)}
  else console.log('PASS',name);
};
async function success(page,sel,name){
  const el=page.locator(sel);await el.waitFor({state:'visible'});
  check(name,(await el.getAttribute('class')||'').includes('success'),await el.textContent());
}
async function fillStage(page,root,index,values){
  const stage=page.locator(root+' .notebook-stage').nth(index);
  await stage.waitFor({state:'visible'});
  const inputs=stage.locator('.notebook-input');
  check(root+' stage '+index+' field count',(await inputs.count())===values.length,String(await inputs.count()));
  for(let i=0;i<values.length;i++)await inputs.nth(i).fill(String(values[i]));
  await stage.locator('button.primary').click();
  await success(page,root+' .notebook-stage:nth-child('+(index+1)+') .message',root+' stage '+(index+1));
}
async function fillRankRow(page,values){
  const inputs=page.locator('#rankRowAnswer input');
  check('rank row field count',(await inputs.count())===values.length,String(await inputs.count()));
  for(let i=0;i<values.length;i++)await inputs.nth(i).fill(String(values[i]));
  await page.locator('#checkRankRow').click();
  await success(page,'#rankRowFeedback','rank row arithmetic');
}

const ctx=await browser.newContext({viewport:{width:1365,height:900}});
const page=await ctx.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e)));
await page.goto('http://127.0.0.1:8000/',{waitUntil:'networkidle'});

check('notes visible',await page.locator('#studyNotes').isVisible());
await page.locator('#studyNotes').fill('черновик: 2·3 + 3·2 = 12');
await page.waitForTimeout(350);
await page.reload({waitUntil:'networkidle'});
check('notes persist',(await page.locator('#studyNotes').inputValue())==='черновик: 2·3 + 3·2 = 12');

// Task 1 must contain every arithmetic line, not just final matrices.
check('task1 has five notebook stages',(await page.locator('#task1Notebook .notebook-stage').count())===5);
await fillStage(page,'#task1Notebook',0,[4,6,-2,8]);
await fillStage(page,'#task1Notebook',1,[9,-15,6,-3]);
await fillStage(page,'#task1Notebook',2,[12,-13,5,1]);
await fillStage(page,'#task1Notebook',3,[-5,21,-8,11]);
await fillStage(page,'#task1Notebook',4,[7,8,-3,12]);

// Task 2: powers are expanded into four row×column calculations each.
await page.locator('#openTask2Notebook').click();
check('task2 visible',await page.locator('#task2Notebook').isVisible());
await fillStage(page,'#task2Notebook',0,[1,18,-6,13]);
await fillStage(page,'#task2Notebook',1,[-1,-10,4,-9]);
await fillStage(page,'#task2Notebook',2,[0,8,-2,4]);

// Custom and random practice use the same line-by-line model.
await page.locator('.nav-btn[data-section="practice"]').click();
check('random practice has notebook lines',(await page.locator('#notebookPracticeArea .notebook-line').count())>0);
await page.locator('#notebookPracticeType').selectOption('mul');
await page.locator('#newNotebookPractice').click();
check('random multiplication has four calculations',(await page.locator('#notebookPracticeArea .notebook-line').count())===4);

await page.locator('#customNotebookExpr').selectOption('A*B');
await page.locator('#startCustomNotebook').click();
check('custom matrices produce line-by-line AB',(await page.locator('#customNotebookArea .notebook-line').count())===4);
await fillStage(page,'#customNotebookArea',0,[12,-13,5,1]);

// Teacher examples: 3x4 · 4x2 and f(A).
await page.locator('.nav-btn[data-section="teacher"]').click();
await page.locator('#openTeacherABNotebook').click();
await fillStage(page,'#teacherABNotebook',0,[1,-7,-7,-3,25,0]);
await fillStage(page,'#teacherABNotebook',1,['не существует']);

await page.locator('#openFunctionNotebook').click();
await fillStage(page,'#functionNotebook',0,[11,-5,-10,6]);
await fillStage(page,'#functionNotebook',1,[6,-2,-4,4]);
await fillStage(page,'#functionNotebook',2,[4,0,0,4]);
await fillStage(page,'#functionNotebook',3,[13,-7,-14,6]);

// Symbolic 2x2 tasks.
await page.locator('#openTrigDetNotebook').click();
await fillStage(page,'#trigDetNotebook',0,['sin²α','-cos²α']);
await fillStage(page,'#trigDetNotebook',1,['sin²α+cos²α']);
await fillStage(page,'#trigDetNotebook',2,[1]);

await page.locator('#openSymbolicDetNotebook').click();
await fillStage(page,'#symbolicDetNotebook',0,['a*(a+1)*(b-c)']);
await fillStage(page,'#symbolicDetNotebook',1,['a*(a+1)*(b-c)']);
await fillStage(page,'#symbolicDetNotebook',2,[0]);

// Numeric determinant – six Sarrus products, two sums, final difference.
await page.locator('.nav-btn[data-section="det"]').click();
await page.locator('#buildDetNotebook').click();
check('numeric det has four stages',(await page.locator('#detNotebook .notebook-stage').count())===4);
await fillStage(page,'#detNotebook',0,[-6,-12,0]);
await fillStage(page,'#detNotebook',1,[2,-8,0]);
await fillStage(page,'#detNotebook',2,[-18,-6]);
await fillStage(page,'#detNotebook',3,[-12]);

// Equation from the sheet – all Sarrus algebra before x.
await page.locator('#loadTeacherEquation').click();
await page.locator('#buildVarDetNotebook').click();
await fillStage(page,'#varDetNotebook',0,[25,-6,'-4x']);
await fillStage(page,'#varDetNotebook',1,['10x',60,1]);
await fillStage(page,'#varDetNotebook',2,['19-4x','10x+61']);
await fillStage(page,'#varDetNotebook',3,['-14x-42']);
await fillStage(page,'#varDetNotebook',4,[-3]);

// Inequality – products, polynomial, roots, interval.
await page.locator('#loadTeacherIneq').click();
await page.locator('#buildVarDetNotebook').click();
await fillStage(page,'#varDetNotebook',0,['2x','-10x-20',3]);
await fillStage(page,'#varDetNotebook',1,[-5,'x^2+2x',12]);
await fillStage(page,'#varDetNotebook',2,['-8x-17','x^2+2x+7']);
await fillStage(page,'#varDetNotebook',3,['-x^2-10x-24']);
await fillStage(page,'#varDetNotebook',4,[-6,-4]);
await fillStage(page,'#varDetNotebook',5,['-6<x<-4']);

// Rank – every element of every new row is a separate arithmetic line.
await page.locator('.nav-btn[data-section="rank"]').click();
await page.locator('#loadTeacherRank').click();
await page.locator('#rankMultiplierGuess').fill('5');
await page.locator('#checkRankMultiplier').click();
await success(page,'#rankMultiplierFeedback','rank multiplier 1');
check('rank first row shows 3 arithmetic lines',(await page.locator('#rankRowAnswer .notebook-line').count())===3);
await fillRankRow(page,[0,16,-17]);
await page.waitForTimeout(350);

await page.locator('#rankMultiplierGuess').fill('4');
await page.locator('#checkRankMultiplier').click();
await success(page,'#rankMultiplierFeedback','rank multiplier 2');
await fillRankRow(page,[0,5,-11]);
await page.waitForTimeout(350);

check('rank fractionless step visible',(await page.locator('#rankInstruction').textContent()).includes('без дробей'));
check('rank cross step shows 3 arithmetic lines',(await page.locator('#rankRowAnswer .notebook-line').count())===3);
await fillRankRow(page,[0,0,-91]);
await page.waitForTimeout(350);
check('rank staircase complete',(await page.locator('#rankStageTitle').textContent()).includes('готова'));
await page.locator('#rankGuess').fill('3');
await page.locator('#checkRankGuess').click();
await success(page,'#rankGuessFeedback','rank final');

// Worksheet source quality and zoom.
await page.locator('.nav-btn[data-section="sheet"]').click();
await page.locator('#teacherSheetImage').waitFor({state:'visible'});
const img=await page.locator('#teacherSheetImage').evaluate(x=>({w:x.naturalWidth,h:x.naturalHeight,src:x.getAttribute('src')}));
check('worksheet HQ',img.w>=950&&img.h>=1200,JSON.stringify(img));
await page.locator('#sheetZoomIn').click();await page.locator('#sheetZoomIn').click();
check('worksheet zoom',(await page.locator('#teacherSheetImage').getAttribute('style')||'').includes('150%'));

check('no desktop JS errors',pageErrors.length===0,pageErrors.join('\n'));
await ctx.close();

// Mobile: no page overlap/overflow, notebook lines remain usable.
for(const width of [390,360,320]){
  const mctx=await browser.newContext({viewport:{width,height:844}});
  const p=await mctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://127.0.0.1:8000/',{waitUntil:'networkidle'});
  const metrics=await p.evaluate(()=>{
    const nav=document.querySelector('.sidebar').getBoundingClientRect();
    const notes=document.querySelector('#studyNotesCard').getBoundingClientRect();
    const first=document.querySelector('#task1Notebook .notebook-line').getBoundingClientRect();
    return {vw:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,navBottom:nav.bottom,notesTop:notes.top,lineRight:first.right};
  });
  check('mobile '+width+' no page overflow',metrics.doc<=width+1&&metrics.body<=width+1,JSON.stringify(metrics));
  check('mobile '+width+' notes below nav',metrics.notesTop>=metrics.navBottom-1,JSON.stringify(metrics));
  check('mobile '+width+' notebook line fits',metrics.lineRight<=width+1,JSON.stringify(metrics));
  check('mobile '+width+' no JS errors',errs.length===0,errs.join('\n'));
  if(width===360){
    await p.locator('#task1Notebook .notebook-stage').first().scrollIntoViewIfNeeded();
    await p.screenshot({path:'qa-mobile-360.png',fullPage:false});
  }
  await mctx.close();
}

await browser.close();
if(failures.length){console.error('\nFailures:',failures);process.exit(1)}
console.log('\nAll notebook interaction tests passed.');
