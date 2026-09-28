const fs=require('fs');
const M=require('./matrix-core.js');

let passed=0;
function assert(name,cond,detail=''){
  if(!cond){console.error('FAIL:',name,detail);process.exitCode=1;return}
  console.log('PASS:',name);passed++;
}
function eqMatrix(a,b){return M.approxEqual(a,b)}

const A=[[2,3],[-1,4]], B=[[3,-5],[2,-1]];
const twoA=M.scale(A,2), threeB=M.scale(B,3), AB=M.multiply(A,B);
const D=M.sub(twoA,threeB), C=M.add(D,AB);
const A2=M.power(A,2), B2=M.power(B,2), K=M.add(A2,B2);

assert('2A',eqMatrix(twoA,[[4,6],[-2,8]]));
assert('3B',eqMatrix(threeB,[[9,-15],[6,-3]]));
assert('AB',eqMatrix(AB,[[12,-13],[5,1]]));
assert('D=2A-3B',eqMatrix(D,[[-5,21],[-8,11]]));
assert('C=D+AB',eqMatrix(C,[[7,8],[-3,12]]));
assert('A^2',eqMatrix(A2,[[1,18],[-6,13]]));
assert('B^2',eqMatrix(B2,[[-1,-10],[4,-9]]));
assert('K=A^2+B^2',eqMatrix(K,[[0,8],[-2,4]]));
assert('teacher task 3 AB',eqMatrix(M.multiply([[2,-1,4,-3],[-2,3,0,1],[4,-2,5,-1]],[[10,5],[3,2],[-1,-3],[4,1]]),[[1,-7],[-7,-3],[25,0]]));
const FA=[[3,-1],[-2,2]];
assert('f(A) teacher task',eqMatrix(M.parseMatrixExpression('A^2+2A-4I',{A:FA,B:[[0,0],[0,0]]}).value,[[13,-7],[-14,6]]));
assert('rank teacher matrix',M.rank([[-1,2,-3],[5,6,-2],[4,-3,1]])===3);
assert('fraction formatting',M.fmt(1/3)==='1/3',M.fmt(1/3));
assert('irrational rounding',M.fmt(Math.sqrt(2))==='1,414214',M.fmt(Math.sqrt(2)));

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const requiredIds=['studyNotes','workD','teacherTask2','workA2','workB2','workK','detGuess','varPolyGuess','varAnswerGuess','rankWorkingMatrix','rankOperation','rankGuess','teacherABWorkspace','workT3AB','functionTaskWorkspace','workFA2','workF','teacherSheetImage'];
for(const id of requiredIds)assert('HTML #'+id,html.includes('id="'+id+'"'));
assert('HQ worksheet source',html.includes('teacher-sheet-hq.jpg')&&app.includes("teacher-sheet-hq.jpg"));
assert('manual rank handler',app.includes('applyRankOperation')&&app.includes('checkRankGuess'));
assert('manual x determinant handler',app.includes('checkVarPolyGuess')&&app.includes('checkVarAnswerGuess'));
assert('manual teacher function handler',app.includes('toggleFunctionTask')&&app.includes('workFA2'));
assert('manual teacher multiplication handler',app.includes('toggleTeacherAB')&&app.includes('checkBAExists'));
assert('notes persistence',app.includes('matrixStudyNotes'));
assert('mobile notes non-overlay',css.includes('.study-notes{position:relative;top:auto'));

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert('no duplicate HTML ids',duplicates.length===0,duplicates.join(', '));

console.log('\nChecks passed:',passed);
if(process.exitCode)process.exit(1);
