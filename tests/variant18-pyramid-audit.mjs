// Independent paper-original check for the SPECIAL assignment 18/1:
// construct a PYRAMID (S,A,B,C), not five unrelated points.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const data={S:[45,50,75],A:[80,70,5],B:[10,70,5],C:[45,5,5]};
const expectedEdges=[['A','B'],['B','C'],['C','A'],['S','A'],['S','B'],['S','C']];
const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
assert.equal(W.SITEMATH_DATA.variants['18'].task1Mode,'pyramid');
assert.deepEqual(W.SITEMATH_DATA.variants['18'].task1,data);
let script=fs.readFileSync('multi.js','utf8');
const end=script.indexOf("  $('variantSelect').addEventListener");
assert(end>0);
script=script.slice(0,end)+'window.__pyramid=solveTask1;})();';
new Function('window','document',script)(W,{getElementById(){return {value:'45'}}});
const coords=Object.fromEntries(Object.entries(data).map(([name,[x,y,z]])=>
 [name,{x,y,z}]));
const g=W.__pyramid(coords);
assert.equal(g.steps.length,17,
 '4 pyramid vertices × 3 construction steps + 3 projected wireframes + axonometric');
const pts=new Map(g.steps.flatMap(s=>s.entities||[]).filter(e=>e.type==='point')
 .map(e=>[e.label,e.p]));
for(const [name,[x,y,z]] of Object.entries(data)){
 for(const [suffix,xx,yy] of [
   ['₁',g.O.x-x,g.O.y+y],
   ['₂',g.O.x-x,g.O.y-z],
   ['₃',g.O.x+y,g.O.y-z]
 ]){
  const p=pts.get(name+suffix);
  assert(p&&Math.abs(p.x-xx)<1e-6&&Math.abs(p.y-yy)<1e-6,
   'incorrect '+name+suffix+' projection on Monge grid');
 }
}
// The teacher's topic on surfaces marks projections of hidden vertices in
// parentheses. C is hidden by front face SAB on Π2, while B is hidden by
// side face SAC on Π3. Preserve canonical semantic labels and coordinates.
for(const [label,expected] of [['C₂','(C₂)'],['B₃','(B₃)']]){
 const entity=g.steps.flatMap(s=>s.entities||[])
  .find(e=>e.type==='point'&&e.label===label);
 assert(entity&&entity.visualLabel===expected,
  'hidden pyramid vertex '+label+' must be bracketed');
}
for(const label of ['S₁','A₁','B₁','C₁','S₂','A₂','B₂','S₃','A₃','C₃']){
 const entity=g.steps.flatMap(s=>s.entities||[])
  .find(e=>e.type==='point'&&e.label===label);
 assert(entity&&!entity.visualLabel,
  'visible pyramid vertex should not be bracketed: '+label);
}

for(const [suffix,name] of [['₁','горизонтальной'],['₂','фронтальной'],
 ['₃','профильной']]){
 const step=g.steps.find(s=>s.title==='Соедини рёбра пирамиды на '+name+
  (suffix==='₁'?' Π₁':suffix==='₂'?' Π₂':' Π₃'));
 assert(step,'missing '+name+' projected pyramid');
 const lines=step.entities.filter(e=>e.type==='line'&&
  ['answer-line','hidden-line'].includes(e.cls));
 const expected=expectedEdges.filter(([a,b])=>{
  const p=pts.get(a+suffix),q=pts.get(b+suffix);
  return Math.hypot(p.x-q.x,p.y-q.y)>1e-7;
 });
 assert.equal(lines.length,expected.length,'missing/extra projected edges on '+suffix);
 for(const [a,b] of expected){
  const p=pts.get(a+suffix),q=pts.get(b+suffix);
  assert(lines.some(e=>
   (Math.hypot(e.a.x-p.x,e.a.y-p.y)<1e-6 &&
    Math.hypot(e.b.x-q.x,e.b.y-q.y)<1e-6) ||
   (Math.hypot(e.a.x-q.x,e.a.y-q.y)<1e-6 &&
    Math.hypot(e.b.x-p.x,e.b.y-p.y)<1e-6)),
   'no drawn edge '+a+b+suffix);
 }
}
const ax=g.steps.at(-1);
assert(ax.title.includes('пирамиды SABC'));
const axLines=ax.entities.filter(e=>e.type==='line'&&
 ['answer-line','hidden-line'].includes(e.cls));
assert.equal(axLines.length,6,'axonometric pyramid must have six edges');
for(const name of Object.keys(data))
 assert(ax.entities.some(e=>e.type==='point'&&e.label===name),
  'missing axonometric vertex '+name);
assert(g.steps.some(s=>s.entities.some(e=>e.cls==='hidden-line')),
 'visibility of rear pyramid edges not indicated');
console.log('Variant 18/1 PYRAMID OK: original SABC vertices, 12 orthographic points, 17 construction stages, six spatial edges, hidden line distinction');
