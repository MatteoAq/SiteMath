// Sequential variant-first audit after 20 tasks #4 have been audited.
// Source: source-photos/scans/variant-20.jpg.
// Tasks 1,2,3,5,6 in that order; #4 is covered by task4-paper-order-audit.mjs.
// This tests arithmetic and drawable geometry; manual mobile visual review is separate.
import fs from 'node:fs';

const check=(ok,why)=>{if(!ok)throw new Error('Variant 20: '+why)};
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
source=source.replace(marker,"    window.__section20={P,Q,pair,levelType};\n"+marker);
const probe4='    const norm=normalizeSteps(steps,200,155);';
check(source.split(probe4).length===2,'task 4 probe position changed');
source=source.replace(probe4,"    window.__task4P20={plane,h3,f3,L3,through3,target3};\n"+probe4);
const relationAnchor="      if(R3){\n        const R=project3(R3),Ref=ref3?project3(ref3):null;";
check(source.split(relationAnchor).length===2,'task 4 point relation position changed');
source=source.replace(relationAnchor,"      if(R3){\n        window.__relationP20={R3,ref3};\n        const R=project3(R3),Ref=ref3?project3(ref3):null;");
const cutoff=source.indexOf("  $('variantSelect').addEventListener");
check(cutoff>0,'browser boundary moved');
source=source.slice(0,cutoff)+
 "window.__audit20={solveTask1,solveTask2,solveTask3,solveTask4Scheme,solveTask5Scheme,solveTask6Scheme,planeFromScheme,planeFromDef,schemeLine3};})();";
new Function('window','document',source)(O,{
 getElementById(){return {value:'50'}}
});
const raw=O.SITEMATH_DATA.variants['20'];
const model=O.SITEMATH_SCHEMES['20'];
const table=t=>Object.fromEntries(Object.entries(t).map(([name,v])=>
 [name,{x:v[0],y:v[1],z:v[2]}]));
const values={
 task1:{A:[70,30,-45],B:[35,-40,20],C:[40,-20,-40],D:[30,20,0],E:[50,0,45]},
 task2:{A:[80,30,50],B:[20,-40,-10]},
 task3:{A:[70,30,45],B:[35,-40,20],C:[0,-20,-40]}
};
for(const part of ['task1','task2','task3'])check(
 JSON.stringify(raw[part])===JSON.stringify(values[part]),
 part+': source table differs from paper');

// 20/4 source D has a one-unit horizontal mismatch in the raw scan.
// Preserve its original trace while using a vertical working projector.
const workingD=model.task4.points.D,archivedD=model.task4.sourceGeometry.points.D;
check(near(archivedD.p1[0],910)&&near(archivedD.p2[0],911),
 'task 4 original D projectors must remain available');
check(near(workingD.p1[0],910.5)&&near(workingD.p2[0],910.5)&&
      near(workingD.p1[1],archivedD.p1[1])&&
      near(workingD.p2[1],archivedD.p2[1]),
 'task 4 working D projector or original heights are incorrect');

// 1. All three orthographic projections of A,B,C,D,E (including zero x/y/z).
const g1=O.__audit20.solveTask1(table(raw.task1)),q1=points(g1);
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
const g2=O.__audit20.solveTask2(table(raw.task2));
const A=raw.task2.A,B=raw.task2.B;
const D=B.map((v,i)=>v-A[i]),length=Math.hypot(...D);
const alpha=Math.asin(Math.abs(D[2])/length)*180/Math.PI;
const beta=Math.asin(Math.abs(D[1])/length)*180/Math.PI;
check(near(length,Math.sqrt(12100))&&near(alpha,33.055731150854)&&
 near(beta,39.52119635864218),'task 2 independent trigonometry failed');
check(g2.steps.length===7,'task 2 missing construction steps');
const measure=g2.steps.at(-1).measure.join(' ');
check(measure.includes('AB = 110 мм'),'task 2 natural length wrong');
check(measure.includes('33,1°')&&measure.includes('39,5°'),
 'task 2 independent alpha/beta do not agree with printed answers');
check(points(g2).has('A₀')&&points(g2).has('B₀'),
 'task 2 drawn right-angle triangle endpoint missing');

// 3. K is INSIDE AB; both projected parallels a through C and crossing
// straight line ℓ(C,K) must be drawn, not only named in step text.
const g3=O.__audit20.solveTask3(table(raw.task3)),q3=points(g3);
const K=raw.task3.A.map((v,i)=>v+.50*(raw.task3.B[i]-v));
check(near(K[0],52.5)&&near(K[1],-5)&&near(K[2],32.5),
 'task 3 analytic AB intermediate point wrong');
check(g3.steps[7].measure?.some(x=>x.includes('50%')),
 'task 3 K should match the default 50-percent browser screenshot');
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

// 4. On the original Σ(ABC), ℓ passes through given D parallel to Σ
// and the final point E is below ℓ, never just displaced in one view.
const g4=O.__audit20.solveTask4Scheme(model.task4,{});
const q4=O.__task4P20,rel20=O.__relationP20;
check(g4.steps?.length===18&&
 model.task4.planeType==='ABC'&&
 model.task4.operation.type==='line_parallel_plane'&&
 model.task4.operation.relation==='below_line','task 4 condition or stages changed');
check(q4?.L3&&q4?.through3&&rel20?.R3&&rel20?.ref3,
 'task 4 working geometry missing');
const v4=minus(q4.L3[1],q4.L3[0]);
check(norm(cross(minus(q4.through3,q4.L3[0]),v4))/norm(v4)<1e-5,
 'task 4 ℓ does not pass through D');
check(Math.abs(dot(v4,q4.plane.n))/(norm(v4)*norm(q4.plane.n))<1e-5,
 'task 4 ℓ not spatially parallel to Σ');
const eOffset=minus(rel20.R3,rel20.ref3);
check(near(eOffset.x,0)&&near(eOffset.y,0)&&eOffset.z<0,
 'task 4 E must lie BELOW line ℓ');
// 5. Σ(a∩b) and f: intersection on the extension of the source frontal line.
// Verify constructive auxiliary g, two competition tests, and visible/hidden
// strokes. Do not accept a mere analytical answer with no projectors.
const s5=model.task5,g5=O.__audit20.solveTask5Scheme(s5,{});
check(s5.planeType==='intersecting_lines'&&s5.planeLines.join(',')==='a,b'&&
 s5.givenLine==='f'&&g5.steps.length===14,'task 5 source intersecting lines a/b and source frontal f or 13 stages wrong');
const plane5=O.__audit20.planeFromScheme(s5);
const [p0,p1]=O.__audit20.schemeLine3(s5.lines.f),ld=minus(p1,p0);
const t=-(dot(plane5.n,p0)+plane5.d)/dot(plane5.n,ld);
const crossing={x:p0.x+t*ld.x,y:p0.y+t*ld.y,z:p0.z+t*ld.z};
check(t>2.02&&t<2.03&&dist(crossing,plane5)<1e-6,
 'task 5 infinite source line must intersect plane on its extension');
const q5=points(g5);
check(q5.has('K₁')&&q5.has('K₂')&&
 near(q5.get('K₁').x,q5.get('K₂').x),
 'task 5 K does not have paired projections');
for(const name of ['Найди 1₁ и 2₁','Найди K₂',
 '3₁≡4₁','5₂≡6₂'])
 check(g5.steps.some(st=>st.title.includes(name)),
  'task 5 missing true hand-drawing operation '+name);
const final5=g5.steps.at(-1).entities;
check(final5.some(e=>e.cls==='hidden-line')&&
 final5.some(e=>e.cls==='answer-line'),
 'task 5 visible and hidden straight-line parts not distinguished');

// 6. Σ(ABC) and Θ(DEF). Construct P and Q
// with genuinely drawn auxiliary sections, then a parallel line through K.
const s6=model.task6,g6=O.__audit20.solveTask6Scheme(s6,{});
// Correct the working projection pairs without modifying the archived raster
// tracing. All heights, depths and source point identities remain unchanged.
for(const [name,p] of Object.entries({
 ...s6.planeA.points,...s6.planeB.points,K:s6.pointK
})){
 check(near(p.p1[0],p.p2[0],1e-9),
  'task 6 working '+name+' projections lack a common vertical projector');
 const rawPoint=s6.sourceGeometry.planeA.points[name]||
   s6.sourceGeometry.planeB.points[name]||
   (name==='K'?s6.sourceGeometry.pointK:null);
 check(rawPoint&&
   near(p.p1[0],(rawPoint.p1[0]+rawPoint.p2[0])/2,1e-9)&&
   near(p.p1[1],rawPoint.p1[1],1e-9)&&
   near(p.p2[1],rawPoint.p2[1],1e-9),
   'task 6 '+name+' averaged projector must preserve source heights and depths');
}
const section=O.__section20;
check(s6.planeA.type==='ABC'&&
 s6.planeB.type==='ABC'&&
 g6.graphicalConstruction===true&&g6.steps.length===19&&section,
 'task 6 source independent ABC and DEF triangles or graphical construction invalid');
const planeA=O.__audit20.planeFromDef(s6.planeA);
const planeB=O.__audit20.planeFromDef(s6.planeB);
const projected3=p=>({x:p.p1.x,y:p.p1.y,z:-p.p2.y});
const P=projected3(section.P),Q=projected3(section.Q),r=minus(Q,P);
check(norm(r)>30,'task 6 intersection line P–Q too short');
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
 variant:'20',
 tasks:['1: 15 coordinate projections','2: length/angles/2 triangles',
 '3: ℓ(C,K) and a(C)∥AB','4: ℓ(D)∥Σ and E below ℓ',
 '5: K in f∩Σ and visibility',
 '6: Σ(ABC)∩Θ(DEF), sections, ℓ(K)∥both'],
 stageCounts:[g1.steps.length,g2.steps.length,g3.steps.length,
  g4.steps.length,g5.steps.length,g6.steps.length],
 limit:'No manual mobile screenshot certification'
},null,2));
