// Independent, variant-first audit for university sheet №12 (all six tasks).
// The exact scanned numeric statements are checked before solver output.
import fs from 'node:fs';

const assert=(condition,message)=>{
  if(!condition) throw Error('Variant 12: '+message);
};
const close=(a,b,tol=1e-5)=>Math.abs(a-b)<=tol;
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=a=>Math.hypot(a.x,a.y,a.z);
const diff=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const point3=q=>({x:q.p1.x,y:q.p1.y,z:-q.p2.y});
const plGap=(p,plane)=>Math.abs(dot(plane.n,p)+plane.d)/norm(plane.n);
const onLine=(p,e,tol=1e-4)=>{
  const u=diff(e.b,e.a),l=Math.hypot(u.x,u.y);
  if(l<1e-9)return false;
  const v=diff(p,e.a),t=(v.x*u.x+v.y*u.y)/(l*l);
  return t>=-1e-5&&t<=1+1e-5&&Math.abs(u.x*v.y-u.y*v.x)/l<=tol;
};
const getPoints=geometry=>{
  const pts=new Map();
  for(const step of geometry.steps)for(const e of step.entities||[])
    if(e.type==='point'&&e.label)pts.set(e.label,e.p);
  return pts;
};
const lineNamed=(geometry,label)=>{
  const step=geometry.steps.find(st=>
    (st.entities||[]).some(e=>e.type==='text'&&e.label===label));
  return (step?.entities||[]).find(e=>e.type==='line'&&e.cls==='answer-line');
};
const results=[];
const record=(task,checks,notes)=>results.push({task,checks,notes});

const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
let js=fs.readFileSync('multi.js','utf8');
const probe='    const norm=normalizeSteps(steps,210,170);';
assert(js.split(probe).length===3,'task 6 instrumentation point changed');
js=js.replace(probe,'    window.__v12Task6={P,Q,pair,levelType};\n'+probe);
const cutoff=js.indexOf("  $('variantSelect').addEventListener");
assert(cutoff>=0,'UI initialization anchor changed');
js=js.slice(0,cutoff)+
 "window.__v12={solveTask1,solveTask2,solveTask3,solveTask4Scheme,solveTask5Scheme,solveTask6Scheme,planeFromScheme,planeFromDef,schemeLine3};})();";
new Function('window','document',js)(W,{
  getElementById(id){return id==='kSlider'?{value:'45'}:{};}
});
const orig=W.SITEMATH_DATA.variants['12'];
const scheme=W.SITEMATH_SCHEMES['12'];
const coords=table=>Object.fromEntries(Object.entries(table).map(([k,v])=>
  [k,{x:v[0],y:v[1],z:v[2]}]));
const expected={
 task1:{A:[25,-10,40],B:[30,50,25],C:[40,30,-60],D:[50,0,50],E:[60,20,15]},
 task2:{A:[50,-15,50],B:[20,20,30]},
 task3:{A:[0,10,50],B:[30,25,30],C:[50,25,60]}
};
for(const name of ['task1','task2','task3'])
 assert(JSON.stringify(orig[name])===JSON.stringify(expected[name]),
   name+': source values do not match university scan');

// 1. All five triples, fifteen orthographic projected points,
// including negative y(A) and negative z(C).
const g1=W.__v12.solveTask1(coords(orig.task1));
assert(g1.steps.length===17,'task1 must contain 17 explicit construction states');
const p1=getPoints(g1),O=g1.O;
for(const [name,[x,y,z]] of Object.entries(expected.task1)){
  for(const [index,P] of [
    ['₁',{x:O.x-x,y:O.y+y}],
    ['₂',{x:O.x-x,y:O.y-z}],
    ['₃',{x:O.x+y,y:O.y-z}]
  ]){
    const actual=p1.get(name+index);
    assert(actual&&close(actual.x,P.x)&&close(actual.y,P.y),
      'task1 '+name+index+' wrong orthographic coordinates');
  }
}
record(1,'15/15 3-plane point projections, all 17 states','Negative y and z verified');

// 2. Real length and both inclinations from independent 3D arithmetic.
const g2=W.__v12.solveTask2(coords(orig.task2));
const A=orig.task2.A,B=orig.task2.B;
const d=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],L=Math.hypot(...d);
const alpha=Math.asin(Math.abs(d[2])/L)*180/Math.PI;
const beta=Math.asin(Math.abs(d[1])/L)*180/Math.PI;
assert(close(L,Math.sqrt(2525))&&L>50&&L<51,'task2 independent AB length');
assert(close(alpha,23.454137315996075)&&close(beta,44.148947407668004),
 'task2 both mathematical inclination angles');
const final2=g2.steps.at(-1).measure.join(' ');
assert(final2.includes(L.toFixed(1).replace('.',',')) &&
       final2.includes(alpha.toFixed(1).replace('.',',')) &&
       final2.includes(beta.toFixed(1).replace('.',',')),
       'task2 displayed values must agree with independent calculation');
const p2=getPoints(g2);
assert(p2.has('A₀')&&p2.has('B₀'),'task2 both right-triangle constructions absent');
record(2,'AB='+L.toFixed(3)+' mm; α='+alpha.toFixed(3)+'°; β='+beta.toFixed(3)+'°',
  'Independent arithmetic agrees with final measurement labels');

// 3. Three input points; AB segment; a through C parallel AB;
// ℓ through C and real K on AB (not merely on extension).
const g3=W.__v12.solveTask3(coords(orig.task3));
const p3=getPoints(g3),k=.45,c3=orig.task3.C;
const k3=[0,1,2].map(i=>orig.task3.A[i]+k*(orig.task3.B[i]-orig.task3.A[i]));
assert(close(k3[0],13.5)&&close(k3[1],16.75)&&close(k3[2],41),
  'task3 independent K for 45% slider');
for(const [label,x,y,z] of [
 ['K₁',k3[0],k3[1],k3[2]],
 ['K₂',k3[0],k3[1],k3[2]]
]){
 const p=p3.get(label);
 assert(p,'task3 '+label+' absent');
 assert(close(p.x,g3.O.x-x),'task3 '+label+' has wrong abscissa');
 assert(close(p.y,label==='K₁'?g3.O.y+y:g3.O.y-z),
    'task3 '+label+' off AB');
}
for(const label of ['a₁','a₂']){
 const st=g3.steps.find(step=>step.title.includes('Проведи '+label));
 assert(st,'task3 parallel line '+label+' missing');
 const line=(st.entities||[]).find(e=>e.type==='line'&&e.cls==='answer-line');
 assert(line,'task3 drawn '+label+' absent');
 const points=[p3.get('A'+(label==='a₁'?'₁':'₂')),
               p3.get('B'+(label==='a₁'?'₁':'₂'))];
 const v=diff(points[1],points[0]),u=diff(line.b,line.a);
 assert(Math.abs(v.x*u.y-v.y*u.x)/(Math.hypot(v.x,v.y)*Math.hypot(u.x,u.y))<1e-5,
   'task3 '+label+' not parallel to AB');
 assert(onLine(p3.get('C'+(label==='a₁'?'₁':'₂')),line),
   'task3 '+label+' does not pass through C');
}
for(const label of ['ℓ₁','ℓ₂']){
 const st=g3.steps.find(step=>step.title.includes('Проведи '+label));
 const line=(st?.entities||[]).find(e=>e.type==='line'&&e.cls==='answer-line');
 assert(line,'task3 final intersecting line '+label+' absent');
 const suffix=label.slice(-1);
 assert(onLine(p3.get('C'+suffix),line)&&onLine(p3.get('K'+suffix),line),
 'task3 '+label+' not through C and K');
}
record(3,'K=(13.5; 16.75; 41), both ℓ intersections and both parallel a projections',
  'Checks actual 2D drawn strokes, not headings');

// 4. Horizontal, frontal, greatest slope and D–T intersection with a;
// named A behind ℓ differs in depth, not height.
assert(scheme.task4.planeType==='intersecting_lines'&&
       scheme.task4.operation.type==='line_intersects_named'&&
       scheme.task4.operation.target==='a'&&
       scheme.task4.operation.relation==='behind_line',
       'task4 photographed statement or operation mismatched');
const g4=W.__v12.solveTask4Scheme(scheme.task4,{});
assert(g4.steps.length===18,'task4 stage count changed');
const h1=lineNamed(g4,'h₁'),h2=lineNamed(g4,'h₂');
const f1=lineNamed(g4,'f₁'),f2=lineNamed(g4,'f₂');
const s1=lineNamed(g4,'ЛС₁'),s2=lineNamed(g4,'ЛС₂');
for(const [label,item]of Object.entries({h1,h2,f1,f2,s1,s2}))
 assert(item,'task4 visible '+label+' absent');
assert(Math.abs(h2.a.y-h2.b.y)<1e-5,'task4 h₂ is not horizontal');
assert(Math.abs(f1.a.y-f1.b.y)<1e-5,'task4 f₁ is not horizontal');
const vh=diff(h1.b,h1.a),vs=diff(s1.b,s1.a);
assert(Math.abs(vh.x*vs.x+vh.y*vs.y)<1e-4,
  'task4 LS₁ does not form a right angle with h₁');
const points4=getPoints(g4);
for(const n of ['D₁','D₂','T₁','T₂','N₁','N₂','A₁','A₂'])
 assert(points4.has(n),'task4 missing '+n);
assert(close(points4.get('T₁').x,points4.get('T₂').x) &&
  close(points4.get('A₁').x,points4.get('A₂').x),'task4 mismatched projector');
assert(close(points4.get('A₂').y,points4.get('N₂').y) &&
       points4.get('A₁').y<points4.get('N₁').y,
 'task4 point A is not behind ℓ at equal height');
const tStep=g4.steps.find(st=>st.title.startsWith('Проведи ℓ через'));
assert(tStep,'task4 ℓ construction omitted');
const lines4=tStep.entities.filter(e=>e.type==='line'&&e.cls==='answer-line');
assert(lines4.length===2&&
  lines4.some(l=>onLine(points4.get('D₁'),l)&&onLine(points4.get('T₁'),l))&&
  lines4.some(l=>onLine(points4.get('D₂'),l)&&onLine(points4.get('T₂'),l)),
 'task4 ℓ missing D and intersection T');
record(4,'Horizontal, frontal, LS perpendicularity, ℓ(D,T), A behind ℓ',
  '18/18 algorithm states present; source lines stored separately');

// 5. Independent analytic line-plane K and all visibility witness stages.
assert(scheme.task5.planeType==='ABC' &&
       scheme.task5.sourceGeometry?.points?.A?.p1?.[0]===264,
       'task5 photographed ABC geometry altered');
const g5=W.__v12.solveTask5Scheme(scheme.task5,{});
const pl=W.__v12.planeFromScheme(scheme.task5);
const [l0,l1]=W.__v12.schemeLine3(scheme.task5.lines.l);
const ld=diff(l1,l0);
const den=dot(pl.n,ld);
assert(Math.abs(den)>1e-5,'task5 unexpected parallel line');
const t=-(dot(pl.n,l0)+pl.d)/den;
const expectedK={x:l0.x+t*ld.x,y:l0.y+t*ld.y,z:l0.z+t*ld.z};
assert(plGap(expectedK,pl)<1e-6&&t>=0&&t<=1,
  'task5 analytic K outside ℓ or plane');
const points5=getPoints(g5),K1=points5.get('K₁'),K2=points5.get('K₂');
assert(K1&&K2&&close(K1.x,K2.x),'task5 K pair missing/alignment');
const same=label=>g5.steps.find(st=>st.title.includes(label));
for(const fragment of ['3₁≡4₁','5₂≡6₂','3₂ и 4₂','5₁ и 6₁'])
  assert(same(fragment),'task5 visibility construction stage '+fragment+' absent');
const final5=g5.steps.at(-1).entities;
assert(final5.some(e=>e.type==='line'&&e.cls==='hidden-line') &&
       final5.some(e=>e.type==='line'&&e.cls==='answer-line'),
       'task5 visibility not drawn using hidden/visible strokes');
record(5,'K=('+expectedK.x.toFixed(3)+'; '+
  expectedK.y.toFixed(3)+'; '+expectedK.z.toFixed(3)+'); K∈ℓ∩Σ',
  'All four competition/projection stages and two stroke styles present');

// 6. Two independent source planes, P/Q each on both, line through K
// parallel to both planes. Do not accept a change of source-photo numbers.
const s6=scheme.task6;
assert(s6.planeA.type==='parallel_lines'&&
       s6.planeB.type==='intersecting_lines'&&
       JSON.stringify(s6.sourceGeometry.pointK)===
       JSON.stringify({p2:[196,116],p1:[199,465]}),
 'task6 source geometry, source K, or plane designation altered');
const g6=W.__v12.solveTask6Scheme(s6,{});
const pair=W.__v12Task6;
assert(pair&&g6.steps.length===24,'task6 missing helper levels or pairs');
const p6=point3(pair.P),q6=point3(pair.Q);
const planeA=W.__v12.planeFromDef(s6.planeA),
      planeB=W.__v12.planeFromDef(s6.planeB);
for(const [name,P]of [['P',p6],['Q',q6]]){
  assert(plGap(P,planeA)<1e-6&&plGap(P,planeB)<1e-6,
    'task6 '+name+' is not on both source planes');
}
const r=diff(q6,p6),length=norm(r);
assert(length>10,'task6 P/Q not distinct enough to define r');
for(const plane of [planeA,planeB])
 assert(Math.abs(dot(plane.n,r))/(norm(plane.n)*length)<1e-7,
   'task6 r direction not parallel to both planes');
const points6=getPoints(g6),K1s=points6.get('K₁'),K2s=points6.get('K₂');
assert(K1s&&K2s&&close(K1s.x,K2s.x),
 'task6 working K projected x disagreement');
const lastLine=g6.steps.find(st=>st.title.startsWith('Через K проведи ℓ ∥'));
assert(lastLine,'task6 line through K construction absent');
const drawn=lastLine.entities.filter(e=>e.type==='line'&&e.cls==='answer-line');
assert(drawn.length>=2 &&
  drawn.some(e=>onLine(K1s,e)) && drawn.some(e=>onLine(K2s,e)),
 'task6 drawn ℓ does not contain the source K projections');
record(6,'P/Q on Σ and Θ (residual <1e-6); ℓ(K)∥r',
  '24 ordered stages; near-parallel source planes and remote intersection remain');

console.log(JSON.stringify({
  variant:'12',checks:results,
  scope:'Independent arithmetic, spatial invariants, source numbers and drawable strokes',
  limitation:'Not a manual frame-by-frame visual certification of every browser screenshot'
},null,2));
