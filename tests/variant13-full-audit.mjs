// Variant 13: review tasks 1,2,3,5,6 in that order after separately audited #4.
// WARNING: Near-parallel original l and Sigma for #5 -> math demonstrable,
// but exact photographed extrapolation is NOT independently certifiable.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const eq=(a,b,e=1e-5)=>Math.abs(a-b)<e;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const len=a=>Math.hypot(a.x,a.y,a.z);
const dist=(p,P)=>Math.abs(dot(p,P.n)+P.d)/len(P.n);
const on=(p,a,b)=>{
 const u=sub(b,a),v=sub(p,a),n=u.x*u.x+u.y*u.y;
 return n>1e-9&&Math.abs(u.x*v.y-u.y*v.x)/Math.sqrt(n)<1e-4 &&
 (v.x*u.x+v.y*u.y)/n>=-1e-4&&(v.x*u.x+v.y*u.y)/n<=1+1e-4;
};
const get=g=>new Map(g.steps.flatMap(s=>s.entities||[])
 .filter(e=>e.type==='point'&&e.label).map(e=>[e.label,e.p]));
const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
let js=fs.readFileSync('multi.js','utf8');
const marker='    const norm=normalizeSteps(steps,210,170);';
assert.equal(js.split(marker).length,3);
js=js.replace(marker,'    window.__section13={P,Q,pair,levelType};\n'+marker);
const c=js.indexOf("  $('variantSelect').addEventListener");
assert(c>0);
js=js.slice(0,c)+'window.__v13={solveTask1,solveTask2,solveTask3,solveTask5Scheme,solveTask6Scheme,planeFromScheme,planeFromDef,schemeLine3};})();';
new Function('window','document',js)(W,{getElementById(){return {value:'45'}}});
const v=W.SITEMATH_DATA.variants['13'],s=W.SITEMATH_SCHEMES['13'];
const original={
 task1:{A:[60,-50,-30],B:[40,-10,50],C:[30,50,40],D:[40,-50,0],E:[45,0,15]},
 task2:{A:[0,50,40],B:[40,10,50]},
 task3:{A:[60,-50,30],B:[40,-10,50],C:[10,50,40]}
};
for(const key of Object.keys(original))
 assert.deepEqual(v[key],original[key],'paper coordinate transcription '+key);
const conv=q=>Object.fromEntries(Object.entries(q).map(([n,p])=>
 [n,{x:p[0],y:p[1],z:p[2]}]));
// Source trace 13/4 D and 13/6 A,K: align working projection x only.
// Explicitly retain the independent 13/5 educational adaptation.
for(const [name,working,original] of [
 ['13/4 D',s.task4.points.D,s.task4.sourceGeometry.points.D],
 ['13/6 A',s.task6.planeB.points.A,s.task6.sourceGeometry.planeB.points.A],
 ['13/6 K',s.task6.pointK,s.task6.sourceGeometry.pointK]
]){
 assert(eq(working.p1[0],working.p2[0],1e-9),
   name+' must use one vertical projector');
 assert(eq(working.p1[0],(original.p1[0]+original.p2[0])/2,1e-9)&&
        eq(working.p1[1],original.p1[1],1e-9)&&
        eq(working.p2[1],original.p2[1],1e-9),
   name+' must preserve source heights/depths and trace');
}
assert(s.task5.adaptedSource===true,
  '13/5 original near-parallel source adaptation must remain identified');

// 1. All 15 Monge projections.
const one=W.__v13.solveTask1(conv(v.task1)),pts=get(one);
assert.equal(one.steps.length,17);
for(const [name,[x,y,z]] of Object.entries(original.task1)){
 const want={'₁':[one.O.x-x,one.O.y+y],'₂':[one.O.x-x,one.O.y-z],
 '₃':[one.O.x+y,one.O.y-z]};
 for(const [suffix,coords] of Object.entries(want)){
  const p=pts.get(name+suffix);
  assert(p&&eq(p.x,coords[0])&&eq(p.y,coords[1]),
   name+suffix+' wrong original coordinates');
 }
}
// 2. Independent length and two angles from unrounded xyz.
const two=W.__v13.solveTask2(conv(v.task2));
const d=v.task2.B.map((q,i)=>q-v.task2.A[i]);
const L=Math.hypot(...d),a=Math.asin(Math.abs(d[2])/L)*180/Math.PI,
 b=Math.asin(Math.abs(d[1])/L)*180/Math.PI;
assert(eq(L,57.445626465380286)&&eq(a,10.024987862075742)&&
 eq(b,44.131749212031046));
const labels=two.steps.at(-1).measure.join(' ');
for(const word of ['57,4 мм','10,0°','44,1°'])assert(labels.includes(word));
assert.equal(two.steps.length,7);
assert(get(two).has('A₀')&&get(two).has('B₀'));
// 3. K lies inside AB; each drawn projected a parallel AB,
// and each projected l passes through C and K.
const three=W.__v13.solveTask3(conv(v.task3)),ps=get(three);
assert.equal(three.steps.length,11);
const K=v.task3.A.map((x,i)=>x+.45*(v.task3.B[i]-x));
assert(eq(K[0],51)&&eq(K[1],-32)&&eq(K[2],39));
for(const proj of ['₁','₂']){
 const p=ps.get('K'+proj);
 assert(p&&eq(p.x,three.O.x-K[0])&&
  eq(p.y,proj==='₁'?three.O.y+K[1]:three.O.y-K[2]));
 const C=ps.get('C'+proj);
 for(const symbol of ['a','ℓ']){
  const step=three.steps.find(st=>st.title.includes('Проведи '+symbol+proj));
  const line=step?.entities.find(e=>e.type==='line'&&e.cls==='answer-line');
  assert(line&&on(C,line.a,line.b));
  if(symbol==='ℓ')assert(on(p,line.a,line.b));
  else{
   const aa=ps.get('A'+proj),bb=ps.get('B'+proj);
   const u=sub(line.b,line.a),w=sub(bb,aa);
   assert(Math.abs(u.x*w.y-u.y*w.x)/(Math.hypot(u.x,u.y)*Math.hypot(w.x,w.y))<1e-6);
  }
 }
}
// 5. Line-plane: source l is almost parallel to Sigma(a intersect b).
const five=W.__v13.solveTask5Scheme(s.task5,{});
assert(s.task5.planeType==='intersecting_lines'&&
 s.task5.planeLines.join(',')==='a,b'&&five.steps.length===14);
const calc=scheme=>{
 const pl=W.__v13.planeFromScheme(scheme);
 const [a,b]=W.__v13.schemeLine3(scheme.lines.l),direction=sub(b,a);
 const den=dot(pl.n,direction);
 const t=-(dot(pl.n,a)+pl.d)/den;
 const p={x:a.x+t*direction.x,y:a.y+t*direction.y,z:a.z+t*direction.z};
 return {pl,t,p,direction,den};
};
const baseline=calc(s.task5);
assert(s.task5.adaptedSource && !s.task5.sourceVerified &&
 dist(baseline.p,baseline.pl)<1e-6 && baseline.p.x>650 && baseline.p.x<950,
 '13/5 adapted intersection must lie near the adapted original drawing');
const intersectionSine=Math.abs(baseline.den)/
 (len(baseline.pl.n)*len(baseline.direction));
assert(intersectionSine>.12&&intersectionSine<.30,
 '13/5 adapted geometry must no longer be almost parallel');
const sensitivity=[];
for(const name of ['a','b','l'])
 for(const proj of ['p1','p2'])
  for(let e=0;e<2;e++)
   for(const delta of [-1,1]){
    const copy=JSON.parse(JSON.stringify(s.task5));
    copy.lines[name][proj][e][1]+=delta;
    sensitivity.push(calc(copy).t);
   }
assert(sensitivity.length===24&&sensitivity.every(Number.isFinite),
 'adapted 13/5 must remain well conditioned under one-pixel changes');
const ps5=get(five);
assert(ps5.has('K₁')&&ps5.has('K₂')&&
 eq(ps5.get('K₁').x,ps5.get('K₂').x));
for(const word of ['Найди 1₁ и 2₁','Найди K₂','3₁≡4₁','5₂≡6₂'])
 assert(five.steps.some(st=>st.title.includes(word)));
const last=five.steps.at(-1).entities;
assert(last.some(e=>e.cls==='hidden-line')&&
 last.some(e=>e.cls==='answer-line'));
// 6. Source plane Sigma(a intersect b) and Theta(A;h):
// show derived AT and MN before alpha/beta sections.
const six=W.__v13.solveTask6Scheme(s.task6,{}),sec=W.__section13;
assert(s.task6.planeA.type==='intersecting_lines'&&
 s.task6.planeB.type==='line_point'&&six.graphicalConstruction&&
 six.steps.length===27&&sec);
for(const phrase of ['Выбери T₁','Соедини A с T','Выбери точку M₁',
 'Выбери точку N₁','Соедини M и N'])
 assert(six.steps.some(step=>step.title.includes(phrase)),
 'missing physical pencil construction '+phrase);
const A=W.__v13.planeFromDef(s.task6.planeA),
 B=W.__v13.planeFromDef(s.task6.planeB);
const fromProjection=v=>({x:v.p1.x,y:v.p1.y,z:-v.p2.y});
const P=fromProjection(sec.P),Q=fromProjection(sec.Q),direction=sub(Q,P);
assert(len(direction)>100);
for(const p of [P,Q])assert(dist(p,A)<1e-4&&dist(p,B)<1e-4);
for(const plane of [A,B])
 assert(Math.abs(dot(plane.n,direction))/(len(plane.n)*len(direction))<1e-6);
const ps6=get(six);
assert(ps6.has('K₁')&&ps6.has('K₂')&&
 eq(ps6.get('K₁').x,ps6.get('K₂').x));
const op=six.steps.find(step=>step.title.startsWith('Через K проведи ℓ ∥'));
const strokes=op?.entities.filter(e=>e.type==='line'&&e.cls==='answer-line')||[];
assert(strokes.length>=2&&
 strokes.some(l=>on(ps6.get('K₁'),l.a,l.b))&&
 strokes.some(l=>on(ps6.get('K₂'),l.a,l.b)));
console.log(JSON.stringify({
 variant:'13',
 passedTasks:[1,2,3,5,6],
 stepCounts:[one.steps.length,two.steps.length,three.steps.length,
 five.steps.length,six.steps.length],
 sourceWarning:'13/5 uses identifiable but adapted teaching geometry, raw source retained',
 intersectionAngleDegrees:Math.asin(intersectionSine)*180/Math.PI,
 sourceParameter:baseline.t,
 onePixelParameterRange:[Math.min(...sensitivity),Math.max(...sensitivity)]
},null,2));
