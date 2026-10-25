// Variant 18, paper-first, ordered assignment 1,2,3,5,6.
// Assignment 1 is a PYRAMID, not five independent points.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const assertNear=(a,b,msg,eps=1e-5)=>assert(Math.abs(a-b)<=eps,msg+' '+a+' != '+b);
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=a=>Math.hypot(a.x,a.y,a.z);
const distance=(a,p)=>Math.abs(dot(a,p.n)+p.d)/norm(p.n);
const inline=(p,a,b)=>{const u=minus(b,a),v=minus(p,a),l=u.x*u.x+u.y*u.y;return l>1e-9&&Math.abs(u.x*v.y-u.y*v.x)/Math.sqrt(l)<1e-4&&((v.x*u.x+v.y*u.y)/l)>-1e-4&&((v.x*u.x+v.y*u.y)/l)<1.0001;};
const coords=t=>Object.fromEntries(Object.entries(t).map(([k,a])=>[k,{x:a[0],y:a[1],z:a[2]}]));
const points=g=>new Map(g.steps.flatMap(st=>st.entities||[]).filter(e=>e.type==='point'&&e.label).map(e=>[e.label,e.p]));
const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
let code=fs.readFileSync('multi.js','utf8');
const probe='    const norm=normalizeSteps(steps,210,170);';
assert.equal(code.split(probe).length,3,'section-plane capture position changed');
code=code.replace(probe,"    window.__p18={P,Q,pair,levelType};\n"+probe);
const probe4='    const norm=normalizeSteps(steps,200,155);';
assert.equal(code.split(probe4).length,2,'variant 18 task 4 probe anchor');
code=code.replace(probe4,'    window.__task4P18={plane,h3,f3,L3,through3,target3};\n'+probe4);
const relationAnchor="      if(R3){\n        const R=project3(R3),Ref=ref3?project3(ref3):null;";
assert.equal(code.split(relationAnchor).length,2,'task 4 point-relation anchor');
code=code.replace(relationAnchor,"      if(R3){\n        window.__relationP18={R3,ref3};\n        const R=project3(R3),Ref=ref3?project3(ref3):null;");
const cut=code.indexOf("  $('variantSelect').addEventListener");
assert(cut>0);
code=code.slice(0,cut)+"window.__18={solveTask1,solveTask2,solveTask3,solveTask4Scheme,solveTask5Scheme,solveTask6Scheme,planeFromScheme,planeFromDef,schemeLine3};})();";
new Function('window','document',code)(W,{getElementById(){return {value:'20'}}});
const raw=W.SITEMATH_DATA.variants['18'];
const scheme=W.SITEMATH_SCHEMES['18'];
assert.equal(raw.task1Mode,'pyramid');
const source={
 task1:{S:[45,50,75],A:[80,70,5],B:[10,70,5],C:[45,5,5]},
 task2:{A:[15,45,20],B:[70,-50,50]},
 task3:{A:[0,60,30],B:[40,50,0],C:[20,-60,10]}
};
for(const [key,expectation] of Object.entries(source))
 assert.deepEqual(raw[key],expectation,'university paper must match '+key);
// The scanned two-view coordinates of A/B in 18/5 and K in 18/6
// differ slightly in x. Keep original raster tracing, use vertical
// projectors for working construction and preserve each depth/height.
for(const [part,work,original] of [
 ['5',scheme.task5.points,scheme.task5.sourceGeometry.points],
 ['6',{K:scheme.task6.pointK},{K:scheme.task6.sourceGeometry.pointK}]
])for(const [name,p] of Object.entries(work)){
 const q=original[name];
 assert(q,'task '+part+' archival '+name+' is absent');
 assertNear(p.p1[0],p.p2[0],'task '+part+' '+name+' projector x',1e-9);
 assertNear(p.p1[0],(q.p1[0]+q.p2[0])/2,
   'task '+part+' '+name+' midpoint x',1e-9);
 assertNear(p.p1[1],q.p1[1],'task '+part+' '+name+' p1 y',1e-9);
 assertNear(p.p2[1],q.p2[1],'task '+part+' '+name+' p2 y',1e-9);
}

// 1. Four pyramid vertices in THREE Monge planes, six physical edges,
// construction in three views and axonometry. Check label coordinates.
const g1=W.__18.solveTask1(coords(raw.task1)),p1=points(g1);
assert.equal(g1.steps.length,17);
for(const [name,[x,y,z]] of Object.entries(source.task1)){
 for(const [suffix,coordinate] of Object.entries({
  '₁':[g1.O.x-x,g1.O.y+y],
  '₂':[g1.O.x-x,g1.O.y-z],
  '₃':[g1.O.x+y,g1.O.y-z]})){
  const found=p1.get(name+suffix);
  assert(found,'missing '+name+suffix);
  assertNear(found.x,coordinate[0],name+suffix+' x');
  assertNear(found.y,coordinate[1],name+suffix+' y');
 }
}
const views=g1.steps.filter(st=>st.title.startsWith('Соедини рёбра пирамиды'));
assert.equal(views.length,3,'pyramid must have all Monge edge networks');
const worldEdges=[['A','B'],['B','C'],['C','A'],['S','A'],['S','B'],['S','C']];
for(const [index,suffix] of ['₁','₂','₃'].entries()){
 const step=views[index];
 assert(step.title.includes(['Π₁','Π₂','Π₃'][index]),'unexpected pyramid projection ordering');
 const strokes=step.entities.filter(e=>e.type==='line'&&
  (e.cls==='answer-line'||e.cls==='hidden-line'));
 const expected=worldEdges.filter(([a,b])=>{
  const A=p1.get(a+suffix),B=p1.get(b+suffix);
  return Math.hypot(A.x-B.x,A.y-B.y)>1e-7;
 });
 assert.equal(strokes.length,expected.length,'wrong number of drawn pyramid edges '+suffix);
 for(const [a,b] of expected) assert(
  strokes.some(e=>(inline(p1.get(a+suffix),e.a,e.b)&&
                  inline(p1.get(b+suffix),e.a,e.b))),
  'missing physical pyramid edge '+a+b+suffix);
}
const final1=g1.steps.at(-1);
assert(final1.title.includes('пирамиды SABC'),'axonometric pyramid missing');
assert.equal(final1.entities.filter(e=>e.type==='line'&&
 (e.cls==='answer-line'||e.cls==='hidden-line')).length,6,
 'axonometry must draw 6 physical pyramid edges');
for(const name of ['S','A','B','C'])
 assert(final1.entities.some(e=>e.type==='point'&&e.label===name),'axonometry '+name);
// 2. Natural length and two angles from the paper's AB.
const g2=W.__18.solveTask2(coords(raw.task2));
const delta=raw.task2.B.map((v,i)=>v-raw.task2.A[i]);
const length=Math.hypot(...delta);
const alpha=Math.asin(Math.abs(delta[2])/length)*180/Math.PI;
const beta=Math.asin(Math.abs(delta[1])/length)*180/Math.PI;
assertNear(length,113.79806676741043,'natural length');
assertNear(alpha,15.285258062536654,'angle to Π1');
assertNear(beta,56.59627499996767,'angle to Π2');
assert.equal(g2.steps.length,7);
const vals=g2.steps.at(-1).measure.join(' ');
for(const val of ['113,8 мм','15,3°','56,6°'])assert(vals.includes(val),'missing value '+val);
// 3. Source C,AB: actual browser default is K at 20% of AB; match the screenshots.
const g3=W.__18.solveTask3(coords(raw.task3)),p3=points(g3);
assert.equal(g3.steps.length,11);
const K=raw.task3.A.map((x,i)=>x+0.20*(raw.task3.B[i]-x));
assert.deepEqual(K,[8,58,24]);
assert(g3.steps.some(st=>st.title.includes('Выбери точку K₁')&&
  st.measure?.some(s=>s.includes('20%'))),
  'task 3 browser default K position must match the step instruction');
for(const suffix of ['₁','₂']){
 const k=p3.get('K'+suffix);
 assert(k,'missing K'+suffix);
 assertNear(k.x,g3.O.x-K[0],'K x '+suffix);
 assertNear(k.y,suffix==='₁'?g3.O.y+K[1]:g3.O.y-K[2],'K y '+suffix);
 for(const label of ['a','ℓ']){
  const step=g3.steps.find(st=>st.title.includes('Проведи '+label+suffix));
  const line=step?.entities.find(e=>e.type==='line'&&e.cls==='answer-line');
  assert(line&&inline(p3.get('C'+suffix),line.a,line.b),'C not on '+label+suffix);
  if(label==='ℓ')assert(inline(k,line.a,line.b),'K not on ℓ'+suffix);
  else{
   const ab=minus(p3.get('B'+suffix),p3.get('A'+suffix));
   const v=minus(line.b,line.a);
   assert(Math.abs(ab.x*v.y-ab.y*v.x)/(Math.hypot(ab.x,ab.y)*Math.hypot(v.x,v.y))<1e-6);
  }
 }
}
// 4. Original Σ(a∥b), frontale crossing from B, and point A BEHIND ℓ.
const g4=W.__18.solveTask4Scheme(scheme.task4,{});
assert.equal(scheme.task4.operation.type,'line_intersects_frontale');
assert.equal(g4.steps.length,18);
const q4=W.__task4P18;
assert(q4?.f3&&q4?.h3&&q4?.L3&&q4?.through3&&q4?.target3,
  'task 4 needs real horizontal, frontal, and crossing line');
const cross=(u,v)=>({x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x});
const lineGap=(p,[a,b])=>norm(cross(minus(p,a),minus(b,a)))/norm(minus(b,a));
assert(lineGap(q4.target3,q4.f3)<1e-5,'task 4 ℓ not intersecting the frontal');
assert(lineGap(q4.target3,q4.L3)<1e-5,'task 4 frontale meeting not on ℓ');
assert(lineGap(q4.through3,q4.L3)<1e-5,'task 4 ℓ missing B');
const behind=W.__relationP18;
assert(behind?.R3&&behind?.ref3,'task 4 A placement missing');
const offset=minus(behind.R3,behind.ref3);
assertNear(offset.x,0,'task 4 A x projector');
assertNear(offset.z,0,'task 4 A z projector');
assert(offset.y<0,'task 4 A must be behind ℓ, not in front');
// 5. True ℓ/Σ(ABC) intersection, two competing point pairs, hidden strokes.
const def5=scheme.task5,g5=W.__18.solveTask5Scheme(def5,{});
assert(def5.planeType==='ABC'&&g5.steps.length===14);
const pl=W.__18.planeFromScheme(def5);
const [a,b]=W.__18.schemeLine3(def5.lines.l),dv=minus(b,a);
const t=-(dot(pl.n,a)+pl.d)/dot(pl.n,dv);
const P={x:a.x+t*dv.x,y:a.y+t*dv.y,z:a.z+t*dv.z};
assert(t>.55&&t<.57&&distance(P,pl)<1e-6);
const pq=points(g5);assert(pq.has('K₁')&&pq.has('K₂'));
assertNear(pq.get('K₁').x,pq.get('K₂').x,'intersection projections');
for(const frag of ['Найди 1₁ и 2₁','Найди K₂','3₁≡4₁','5₂≡6₂'])
 assert(g5.steps.some(st=>st.title.includes(frag)),'missing construction '+frag);
const last5=g5.steps.at(-1).entities;
assert(last5.some(e=>e.cls==='hidden-line')&&last5.some(e=>e.cls==='answer-line'));
// 6. Two intersecting-lines planes, two independent mediator sections P and Q.
const def6=scheme.task6,g6=W.__18.solveTask6Scheme(def6,{});
assert(def6.planeA.type==='intersecting_lines'&&
 def6.planeB.type==='intersecting_lines'&&g6.steps.length===19&&g6.graphicalConstruction);
const sec=W.__p18;
const from=p=>({x:p.p1.x,y:p.p1.y,z:-p.p2.y});
const p=from(sec.P),q=from(sec.Q),r=minus(q,p);
const planeA=W.__18.planeFromDef(def6.planeA);
const planeB=W.__18.planeFromDef(def6.planeB);
assert(norm(r)>50);
for(const x of [p,q])
 assert(distance(x,planeA)<1e-4&&distance(x,planeB)<1e-4,'section endpoint off plane');
for(const plane of [planeA,planeB])
 assert(Math.abs(dot(plane.n,r))/(norm(plane.n)*norm(r))<1e-5,'parallel line wrong');
const ps=points(g6),lineStep=g6.steps.find(st=>st.title.startsWith('Через K проведи ℓ ∥'));
assert(ps.has('K₁')&&ps.has('K₂'));
const strokes=lineStep?.entities.filter(e=>e.type==='line'&&e.cls==='answer-line')||[];
assert(strokes.length>=2&&strokes.some(e=>inline(ps.get('K₁'),e.a,e.b))&&
 strokes.some(e=>inline(ps.get('K₂'),e.a,e.b)));
console.log(JSON.stringify({variant:'18',passed:[1,2,3,4,5,6],
 stages:[g1.steps.length,g2.steps.length,g3.steps.length,g4.steps.length,g5.steps.length,g6.steps.length],
 pyramid:true,original:'University scanned variant-18.jpg',length,alpha,beta,t5:t},null,2));
