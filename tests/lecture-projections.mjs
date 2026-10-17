// Course-grounded projections and triangle-method regression, across all 20 sheets.
// Sources (original teacher handouts in connected Drive):
// Topic 3 "Комплексный чертёж точки" – the three coordinate pairs;
// Topic 4 "Комплексный чертёж прямой" §4.3 – two right triangles;
// Topic 4 §4.4 – spatial collinearity, intersections and parallelism.
// Unlike a text assertion, this reads the actual 2D geometry in solver steps.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
let source=fs.readFileSync('multi.js','utf8');
const bootstrap=source.indexOf("  $('variantSelect').addEventListener");
assert(bootstrap>0,'Solver bootstrap boundary moved');
source=source.slice(0,bootstrap)+
  'window.__course={solveTask1,solveTask2,solveTask3};})();';
new Function('window','document',source)(W,{
  getElementById(){return {value:'45'}}
});
const solver=W.__course;
const pt=(g,label)=>{
  const entities=g.steps.flatMap(s=>s.entities||[]);
  const obj=entities.find(e=>e.type==='point'&&e.label===label);
  assert(obj,'Missing drawn point '+label);
  return obj.p;
};
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const close=(a,b,t=1e-5)=>Math.abs(a-b)<t;
const points=(raw)=>Object.fromEntries(
  Object.entries(raw).map(([key,p])=>[key,{x:p[0],y:p[1],z:p[2]}])
);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const nearLine=(p,a,b)=>Math.abs(cross(a,b,p))<1e-5*Math.max(1,length(a,b));
const parallel=(line,a,b)=>Math.abs(cross({x:0,y:0},
  {x:line.b.x-line.a.x,y:line.b.y-line.a.y},
  {x:b.x-a.x,y:b.y-a.y}))<1e-5*Math.max(1,length(line.a,line.b)*length(a,b));
const lineFrom=(g,prefix)=>g.steps.find(s=>s.title?.startsWith(prefix))
  ?.entities?.find(e=>e.type==='line'&&e.cls==='answer-line');
const issues=[];
let checked=0,pyramids=0,projections=0,triangles=0,intersections=0;

for(const [variant,entry] of Object.entries(W.SITEMATH_DATA.variants)){
  const c1=points(entry.task1),g1=solver.solveTask1(c1);
  assert(!g1.error,variant+'/1: '+g1.error);
  if(entry.task1Mode==='pyramid'){
    assert.equal(Object.keys(c1).length,4,'Pyramid task must have four vertices');
    pyramids++;
  }
  const O=g1.O;
  for(const [name,P] of Object.entries(c1)){
    const p1=pt(g1,name+'₁'),p2=pt(g1,name+'₂'),p3=pt(g1,name+'₃');
    for(const [actual,expected,which] of [
      [p1.x,O.x-P.x,'P1 x'],[p1.y,O.y+P.y,'P1 y'],
      [p2.x,O.x-P.x,'P2 x'],[p2.y,O.y-P.z,'P2 z'],
      [p3.x,O.x+P.y,'P3 y'],[p3.y,O.y-P.z,'P3 z']]){
      if(!close(actual,expected))issues.push(variant+'/1 '+name+' '+which+' '+actual+' != '+expected);
    }
    projections+=3;
  }
  // The final pictorial view must expose the actual three coordinate
  // transfers x, y, z, not just a radial O→P line ending at the answer.
  const picture=g1.steps.at(-1),pictureAxes=picture.entities.filter(e=>
    e.type==='line'&&e.cls==='axis');
  assert.equal(pictureAxes.length,3,variant+'/1: three pictorial axes missing');
  const pictureO=pictureAxes[0].a;
  const basis=pictureAxes.map(e=>({
    x:(e.b.x-e.a.x)/(55/.52),y:(e.b.y-e.a.y)/(55/.52)
  }));
  const guides=picture.entities.filter(e=>e.type==='line'&&e.cls==='construction-line');
  for(const [name,P] of Object.entries(c1)){
    const path=[pictureO];
    for(const [j,v] of [P.x,P.y,P.z].entries()){
      const last=path.at(-1),u=basis[j];
      path.push({x:last.x+u.x*v,y:last.y+u.y*v});
    }
    const point=picture.entities.find(e=>e.type==='point'&&e.label===name);
    if(!point||length(point.p,path[3])>1e-5)
      issues.push(variant+'/1: axonometric point '+name+' mismatch');
    for(let i=0;i<3;i++){
      if(length(path[i],path[i+1])<1e-7)continue;
      if(!guides.some(e=>length(e.a,path[i])<1e-5&&
         length(e.b,path[i+1])<1e-5))
        issues.push(variant+'/1: missing coordinate transfer '+name+' component '+i);
    }
  }
  const c2=points(entry.task2),g2=solver.solveTask2(c2);
  assert(!g2.error,variant+'/2: '+g2.error);
  const A=c2.A,B=c2.B,D={
    x:B.x-A.x,y:B.y-A.y,z:B.z-A.z
  };
  const L=Math.hypot(D.x,D.y,D.z);
  const A1=pt(g2,'A₁'),B1=pt(g2,'B₁'),
    A2=pt(g2,'A₂'),B2=pt(g2,'B₂'),
    A0=pt(g2,'A₀'),B0=pt(g2,'B₀');
  for(const [value,want,label] of [
    [length(A1,B1),Math.hypot(D.x,D.y),'P1 leg'],
    [length(A2,B2),Math.hypot(D.x,D.z),'P2 leg'],
    [length(A1,A0),Math.abs(D.z),'height difference'],
    [length(B2,B0),Math.abs(D.y),'depth difference'],
    [length(B1,A0),L,'P1 natural length'],
    [length(A2,B0),L,'P2 natural length']]){
    if(!close(value,want))issues.push(variant+'/2 '+label+' '+value+' != '+want);
  }
  triangles+=2;

  const c3=points(entry.task3),g3=solver.solveTask3(c3);
  assert(!g3.error,variant+'/3: '+g3.error);
  const Ka=pt(g3,'K₁'),Kb=pt(g3,'K₂');
  if(!close(Ka.x,Kb.x))issues.push(variant+'/3: K1 and K2 on different projectors');
  const C1=pt(g3,'C₁'),C2=pt(g3,'C₂');
  const e1=lineFrom(g3,'Проведи ℓ₁'),e2=lineFrom(g3,'Проведи ℓ₂');
  if(e1&&!nearLine(C1,e1.a,e1.b))issues.push(variant+'/3: ell1 does not pass through C1');
  if(e2&&!nearLine(C2,e2.a,e2.b))issues.push(variant+'/3: ell2 does not pass through C2');
  if(e1&&!nearLine(Ka,e1.a,e1.b))issues.push(variant+'/3: ell1 does not pass through K1');
  if(e2&&!nearLine(Kb,e2.a,e2.b))issues.push(variant+'/3: ell2 does not pass through K2');
  const a1=lineFrom(g3,'Проведи a₁'),a2=lineFrom(g3,'Проведи a₂');
  const T1=pt(g3,'A₁'),T2=pt(g3,'B₁');
  const U1=pt(g3,'A₂'),U2=pt(g3,'B₂');
  if(a1&&!parallel(a1,T1,T2))issues.push(variant+'/3: a1 not parallel to A1B1');
  if(a2&&!parallel(a2,U1,U2))issues.push(variant+'/3: a2 not parallel to A2B2');
  if(a1&&!nearLine(C1,a1.a,a1.b))issues.push(variant+'/3: a1 misses C1');
  if(a2&&!nearLine(C2,a2.a,a2.b))issues.push(variant+'/3: a2 misses C2');
  const K1frac=(Ka.x-T1.x)/(T2.x-T1.x||1);
  const K2frac=(Kb.x-U1.x)/(U2.x-U1.x||1);
  // If xAB is zero, both projections collapse to the same line of
  // projectors. Verify K membership geometrically instead of a fraction.
  if(!nearLine(Ka,T1,T2)&&length(T1,T2)>1e-6)
    issues.push(variant+'/3: K1 is not on source segment');
  if(!nearLine(Kb,U1,U2)&&length(U1,U2)>1e-6)
    issues.push(variant+'/3: K2 is not on source segment');
  if(Math.abs(T2.x-T1.x)>1e-5&&!close(K1frac,.45))
    issues.push(variant+'/3: chosen K1 fraction diverges from slider');
  if(Math.abs(U2.x-U1.x)>1e-5&&!close(K2frac,.45))
    issues.push(variant+'/3: chosen K2 fraction diverges from slider');
  intersections++;
  checked++;
}
assert.equal(checked,20);
assert.equal(projections,5*3*19+4*3);
assert.equal(triangles,40);
assert.equal(intersections,20);
assert.equal(pyramids,1);
if(issues.length)throw new Error('Course-projection mismatches: '+issues.join('; '));
console.log(JSON.stringify({checked,projections,triangles,intersections,pyramids,
  sources:'Teacher topics 3 and 4, original 20-variant album'},null,2));
