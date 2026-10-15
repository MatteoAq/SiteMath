// Sequential variant-first audit after 20 tasks #4 have been audited.
// Source: source-photos/scans/variant-03.jpg.
// Tasks 1,2,3,5,6 in that order; #4 is covered by task4-paper-order-audit.mjs.
// This tests arithmetic and drawable geometry; manual mobile visual review is separate.
import fs from 'node:fs';

const check=(ok,why)=>{if(!ok)throw new Error('Variant 03: '+why)};
const near=(a,b,tol=1e-5)=>Math.abs(a-b)<tol;
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm=(p)=>Math.hypot(p.x,p.y,p.z);
const dist=(p,plane)=>Math.abs(dot(plane.n,p)+plane.d)/norm(plane.n);
const inline=(p,a,b,tol=1e-4)=>{
 const d=minus(b,a),v=minus(p,a),sz=d.x*d.x+d.y*d.y;
 return sz>1e-9&&Math.abs(d.x*v.y-d.y*v.x)/Math.sqrt(sz)<tol&&
  (v.x*d.x+v.y*d.y)/sz>=-tol&&(v.x*d.x+v.y*d.y)/sz<=1+tol;
};
const points=g=>{
 const out=new Map();
 for(const step of g.steps)for(const e of step.entities||[])
  if(e.type==='point'&&e.label)out.set(e.label,e.p);
 return out;
};
const O={};
new Function('window',fs.readFileSync('variants.js','utf8'))(O);
let source=fs.readFileSync('multi.js','utf8');
const marker='    const norm=normalizeSteps(steps,210,170);';
check(source.split(marker).length===3,'section-plane probe position moved');
source=source.replace(marker,"    window.__section03={P,Q,pair,levelType};\n"+marker);
const cutoff=source.indexOf("  $('variantSelect').addEventListener");
check(cutoff>0,'browser boundary moved');
source=source.slice(0,cutoff)+
 "window.__audit03={solveTask1,solveTask2,solveTask3,solveTask5Scheme,solveTask6Scheme,planeFromScheme,planeFromDef,schemeLine3};})();";
new Function('window','document',source)(O,{
 getElementById(){return {value:'45'}}
});
const raw=O.SITEMATH_DATA.variants['03'];
const model=O.SITEMATH_SCHEMES['03'];
const table=t=>Object.fromEntries(Object.entries(t).map(([name,v])=>
 [name,{x:v[0],y:v[1],z:v[2]}]));
const values={
 task1:{A:[40,30,-15],B:[25,-30,60],C:[30,65,40],D:[50,0,0],E:[30,50,0]},
 task2:{A:[70,20,-60],B:[10,20,45]},
 task3:{A:[40,30,-15],B:[25,30,-60],C:[0,65,40]}
};
for(const part of ['task1','task2','task3'])check(
 JSON.stringify(raw[part])===JSON.stringify(values[part]),
 part+': source table differs from paper');

// 1. All three orthographic projections of A,B,C,D,E (including zero x/y/z).
const g1=O.__audit03.solveTask1(table(raw.task1)),q1=points(g1);
check(g1.steps.length===17,'task 1 has lost individual construction states');
for(const [name,[x,y,z]] of Object.entries(values.task1)){
 const want={'₁':{x:g1.O.x-x,y:g1.O.y+y},
 '₂':{x:g1.O.x-x,y:g1.O.y-z},
 '₃':{x:g1.O.x+y,y:g1.O.y-z}};
 for(const suffix of ['₁','₂','₃']){
  const p=q1.get(name+suffix),q=want[suffix];
  check(p&&near(p.x,q.x)&&near(p.y,q.y),
   'task 1 incorrect coordinate of '+name+suffix);
 }
}

// 2. Natural magnitude and two true plane-inclination angles; no rounded
// intermediate distances. Reported values must use final independent arithmetic.
const g2=O.__audit03.solveTask2(table(raw.task2));
const A=raw.task2.A,B=raw.task2.B;
const D=B.map((v,i)=>v-A[i]),length=Math.hypot(...D);
const alpha=Math.asin(Math.abs(D[2])/length)*180/Math.PI;
const beta=Math.asin(Math.abs(D[1])/length)*180/Math.PI;
check(near(length,Math.sqrt(14625))&&near(alpha,60.255118703057796)&&
 near(beta,0),'task 2 independent trigonometry failed');
check(g2.steps.length===7,'task 2 missing construction steps');
const measure=g2.steps.at(-1).measure.join(' ');
check(measure.includes('AB = 120,9 мм'),'task 2 natural length wrong');
check(measure.includes('60,3°')&&measure.includes('0°'),
 'task 2 independent alpha/beta do not agree with printed answers');
check(points(g2).has('A₀')&&points(g2).has('B₀'),
 'task 2 drawn right-angle triangle endpoint missing');

// 3. K is INSIDE AB; both projected parallels a through C and crossing
// straight line ℓ(C,K) must be drawn, not only named in step text.
const g3=O.__audit03.solveTask3(table(raw.task3)),q3=points(g3);
const K=raw.task3.A.map((v,i)=>v+.45*(raw.task3.B[i]-v));
check(near(K[0],33.25)&&near(K[1],30)&&near(K[2],-35.25),
 'task 3 analytic AB intermediate point wrong');
for(const suffix of ['₁','₂']){
 const p=q3.get('K'+suffix);
 check(p&&near(p.x,g3.O.x-K[0])&&
  near(p.y,suffix==='₁'?g3.O.y+K[1]:g3.O.y-K[2]),
  'task 3 K'+suffix+' off AB');
 for(const symbol of ['a','ℓ']){
  const title='Проведи '+symbol+suffix;
  const step=g3.steps.find(st=>st.title.includes(title));
  const stroke=(step?.entities||[]).find(e=>
   e.type==='line'&&e.cls==='answer-line');
  check(stroke,'task 3 '+symbol+suffix+' not drawn');
  const C=q3.get('C'+suffix);
  check(inline(C,stroke.a,stroke.b),
   'task 3 '+symbol+suffix+' does not include C');
  if(symbol==='a'){
   const a=q3.get('A'+suffix),b=q3.get('B'+suffix);
   const dir=minus(stroke.b,stroke.a),ab=minus(b,a);
   check(Math.abs(dir.x*ab.y-dir.y*ab.x)/
      (Math.hypot(dir.x,dir.y)*Math.hypot(ab.x,ab.y))<1e-6,
      'task 3 a'+suffix+' not parallel to AB');
  }else check(inline(q3.get('K'+suffix),stroke.a,stroke.b),
   'task 3 ℓ'+suffix+' not through true K');
 }
}

// 5. Σ(a∩f) and ℓ: intersection on the extension of the source line.
// Verify constructive auxiliary g, two competition tests, and visible/hidden
// strokes. Do not accept a mere analytical answer with no projectors.
const s5=model.task5,g5=O.__audit03.solveTask5Scheme(s5,{});
check(s5.planeType==='intersecting_lines'&&s5.planeLines.join(',')==='a,f'&&
 s5.givenLine==='l'&&g5.steps.length===13,'task 5 source intersecting lines a/f or 13 stages wrong');
const plane5=O.__audit03.planeFromScheme(s5);
const [p0,p1]=O.__audit03.schemeLine3(s5.lines.l),ld=minus(p1,p0);
const t=-(dot(plane5.n,p0)+plane5.d)/dot(plane5.n,ld);
const crossing={x:p0.x+t*ld.x,y:p0.y+t*ld.y,z:p0.z+t*ld.z};
check(t<-.60&&t>-.65&&dist(crossing,plane5)<1e-6,
 'task 5 infinite source line must intersect plane on its extension');
const q5=points(g5);
check(q5.has('K₁')&&q5.has('K₂')&&
 near(q5.get('K₁').x,q5.get('K₂').x),
 'task 5 K does not have paired projections');
for(const name of ['Найди 1₂ и 2₂','Найди K₁',
 '3₁≡4₁','5₂≡6₂'])
 check(g5.steps.some(st=>st.title.includes(name)),
  'task 5 missing true hand-drawing operation '+name);
const final5=g5.steps.at(-1).entities;
check(final5.some(e=>e.cls==='hidden-line')&&
 final5.some(e=>e.cls==='answer-line'),
 'task 5 visible and hidden straight-line parts not distinguished');

// 6. Σ(ABC) and intersecting-lines Θ(a∩b). Construct P and Q
// with genuinely drawn auxiliary sections, then a parallel line through K.
const s6=model.task6,g6=O.__audit03.solveTask6Scheme(s6,{});
const section=O.__section03;
check(s6.planeA.type==='ABC'&&
 s6.planeB.type==='intersecting_lines'&&
 g6.graphicalConstruction===true&&g6.steps.length===19&&section,
 'task 6 source ABC and intersecting-lines plane or graphical construction invalid');
const planeA=O.__audit03.planeFromDef(s6.planeA);
const planeB=O.__audit03.planeFromDef(s6.planeB);
const projected3=p=>({x:p.p1.x,y:p.p1.y,z:-p.p2.y});
const P=projected3(section.P),Q=projected3(section.Q),r=minus(Q,P);
check(norm(r)>50,'task 6 intersection line P–Q too short');
for(const p of [P,Q]){
 check(dist(p,planeA)<1e-4&&dist(p,planeB)<1e-4,
  'task 6 section endpoint not on both given planes');
}
for(const plane of [planeA,planeB])check(
 Math.abs(dot(plane.n,r))/(norm(plane.n)*norm(r))<1e-5,
 'task 6 intersection direction not parallel to a plane');
const q6=points(g6);
check(q6.has('K₁')&&q6.has('K₂')&&
 near(q6.get('K₁').x,q6.get('K₂').x),
 'task 6 original K projections lost');
const through=g6.steps.find(st=>st.title.startsWith('Через K проведи ℓ ∥'));
const drawn=through?.entities.filter(e=>e.type==='line'&&e.cls==='answer-line')||[];
check(drawn.length>=2&&
 drawn.some(e=>inline(q6.get('K₁'),e.a,e.b))&&
 drawn.some(e=>inline(q6.get('K₂'),e.a,e.b)),
 'task 6 drawing ℓ must pass K on both projections');
console.log(JSON.stringify({
 variant:'03',
 tasks:['1: 15 coordinate projections','2: length/angles/2 triangles',
 '3: ℓ(C,K) and a(C)∥AB','5: K in ℓ∩Σ and visibility',
 '6: Σ(ABC)∩Θ(a∩b), sections, ℓ(K)∥both'],
 stageCounts:[g1.steps.length,g2.steps.length,g3.steps.length,
  g5.steps.length,g6.steps.length],
 limit:'No manual mobile screenshot certification'
},null,2));
