const fs=require('fs');
const M=require('./matrix-core.js');

let passed=0;
function assert(name,cond,detail=''){
  if(!cond){console.error('FAIL:',name,detail);process.exitCode=1;return}
  console.log('PASS:',name);passed++;
}
function eqMatrix(a,b){return M.approxEqual(a,b)}

const A=[[2,3],[-1,4]],B=[[3,-5],[2,-1]];
assert('task1 result',eqMatrix(M.parseMatrixExpression('2A-3B+AB',{A,B}).value,[[7,8],[-3,12]]));
assert('task2 result',eqMatrix(M.parseMatrixExpression('A^2+B^2',{A,B}).value,[[0,8],[-2,4]]));
assert('teacher AB',eqMatrix(M.multiply([[2,-1,4,-3],[-2,3,0,1],[4,-2,5,-1]],[[10,5],[3,2],[-1,-3],[4,1]]),[[1,-7],[-7,-3],[25,0]]));
assert('teacher f(A)',eqMatrix(M.parseMatrixExpression('A^2+2A-4I',{A:[[3,-1],[-2,2]],B:[[0,0],[0,0]]}).value,[[13,-7],[-14,6]]));
assert('rank teacher matrix',M.rank([[-1,2,-3],[5,6,-2],[4,-3,1]])===3);
assert('fraction formatting',M.fmt(1/3)==='1/3');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const workbook=fs.readFileSync('workbook.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

for(const id of [
  'studyNotes','task1Notebook','openTask2Notebook','task2Notebook',
  'buildDetNotebook','detNotebook','buildVarDetNotebook','varDetNotebook',
  'rankStairMatrix','rankRowAnswer','rankGuess',
  'teacherABNotebook','functionNotebook','trigDetNotebook','symbolicDetNotebook',
  'notebookPracticeArea','customNotebookArea','startCustomNotebook','teacherSheetImage'
]) assert('HTML #'+id,html.includes('id="'+id+'"'));

assert('notebook engine exists',workbook.includes('sequentialNotebook')&&workbook.includes('multiplyStage')&&workbook.includes('buildVariableDet'));
assert('custom notebook builder',workbook.includes('buildCustomNotebook')&&workbook.includes('buildRandomPractice'));
assert('task1 has natural arithmetic flow',workbook.includes("scalarStage('1. 2A = 2 · A'")&&workbook.includes("multiplyStage('3. AB – строка A × столбец B'")&&workbook.includes("combineThreeStage('4. C = 2A − 3B + AB'"));
assert('det has Sarrus stages',workbook.includes('Три произведения со знаком «+»')&&workbook.includes('Три произведения со знаком «−»'));
assert('rank row arithmetic shown',app.includes("row.className='notebook-line'")&&app.includes('Посчитай каждый элемент новой'));
assert('HQ worksheet source',html.includes('teacher-sheet-hq.jpg')&&app.includes('teacher-sheet-hq.jpg'));
assert('notes persistence',app.includes('matrixStudyNotes'));
assert('mobile notebook CSS',css.includes('.notebook-line')&&css.includes('@media(max-width:360px)'));

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert('no duplicate HTML ids',duplicates.length===0,duplicates.join(', '));

console.log('\nChecks passed:',passed);
if(process.exitCode)process.exit(1);
