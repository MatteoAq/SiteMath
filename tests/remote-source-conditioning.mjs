// Quantify how the photographed original constrains the TWO unresolved tasks.
// This is an uncertainty experiment on raster tracing, not a new drawing,
// a confidence interval, or permission to move any given line in the site.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scheme = id => JSON.parse(fs.readFileSync(
  'data/variants/' + id + '.json', 'utf8')).scheme;
const s12 = scheme('12').task6, s13 = scheme('13').task5;
for (const [name, s] of [['12/6', s12], ['13/5', s13]]) {
  assert.equal(s.sourceVerified, false, name + ' must not claim metric verification');
  assert.equal(s.sourceRecheckRequired, false, name + ' is a deliberately adapted drawing');
  assert.equal(s.adaptedSource, true, name + ' missing user-approved reconstruction flag');
  assert(s.sourceGeometry && s.sourceAvailable, name + ' original scan data missing');
  assert(!s.teachingScheme, name + ' must not silently replace the given lines');
}

const add = (a,b) => a.map((v,i)=>v+b[i]);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const mul = (a,s) => a.map(v=>v*s);
const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross = (a,b) => [
  a[1]*b[2]-a[2]*b[1],
  a[2]*b[0]-a[0]*b[2],
  a[0]*b[1]-a[1]*b[0]
];
const norm = a => Math.hypot(...a);
const unit = a => mul(a,1/norm(a));
const midpoint = (a,b) => mul(add(a,b),.5);
function lineY(seg,x) {
  return seg[0][1] + (seg[1][1]-seg[0][1]) *
    (x-seg[0][0])/(seg[1][0]-seg[0][0]);
}
function line3(rec) {
  const xs = [...rec.p1,...rec.p2].map(p=>p[0]);
  const c = (Math.min(...xs)+Math.max(...xs))/2;
  const r = Math.max(40,Math.max(...xs)-Math.min(...xs))*.32;
  return [c-r,c+r].map(x=>[x,lineY(rec.p1,x),-lineY(rec.p2,x)]);
}
function crossingCenter(L,M) {
  const p=L[0],q=M[0],u=unit(sub(L[1],p)),v=unit(sub(M[1],q));
  const w=sub(p,q),b=dot(u,v),d=dot(u,w),e=dot(v,w);
  const den=1-b*b;
  if(Math.abs(den)<1e-6)return midpoint(p,q);
  return midpoint(add(p,mul(u,(b*e-d)/den)), add(q,mul(v,(e-b*d)/den)));
}
function plane(def) {
  const [L,M] = Object.values(def.lines).slice(0,2).map(line3);
  const a=unit(sub(L[1],L[0]));
  let b=unit(sub(M[1],M[0])),P,n;
  if(def.type==='parallel_lines' || def.planeType==='parallel_lines') {
    if(dot(a,b)<0)b=mul(b,-1);
    P=midpoint(...L);
    n=cross(unit(add(a,b)),sub(midpoint(...M),P));
  } else {
    P=crossingCenter(L,M);
    n=cross(a,b);
  }
  return {n,d:-dot(n,P)};
}
function xLinePlane(s) {
  const P=plane({type:s.planeType,lines:{a:s.lines.a,b:s.lines.b}});
  const L=line3(s.lines.l),direction=sub(L[1],L[0]);
  const denominator=dot(P.n,direction);
  const t=-(dot(P.n,L[0])+P.d)/denominator;
  return {x:L[0][0]+t*direction[0],
    sine:Math.abs(denominator)/(norm(P.n)*norm(direction))};
}
function atHeight(s,z=-230) {
  const A=plane(s.planeA),B=plane(s.planeB);
  const a=A.n,b=B.n;
  const c1=-(A.d+a[2]*z),c2=-(B.d+b[2]*z);
  const den=a[0]*b[1]-b[0]*a[1];
  const cosine=Math.abs(dot(a,b))/(norm(a)*norm(b));
  return {x:(c1*b[1]-c2*a[1])/den,
    angle:Math.acos(Math.min(1,cosine))*180/Math.PI};
}
function rng(seed) {
  return () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}
const clone=s=>JSON.parse(JSON.stringify(s));
const raw12=s12.sourceGeometry,raw13=s13.sourceGeometry;
const original12=atHeight(raw12),original13=xLinePlane(raw13);
const adapted12=atHeight(s12),adapted13=xLinePlane(s13);
assert(Math.abs(original12.x)>1600&&original12.angle<7,'archived 12/6 must retain challenging source geometry');
assert(Math.abs(original13.x)>1500&&original13.sine<.03,'archived 13/5 must retain challenging source geometry');
assert(adapted12.x>650&&adapted12.x<1500&&adapted12.angle>7,
 '12/6 adapted planes should meet considerably closer to the source drawing');
assert(adapted13.x>620&&adapted13.x<1000&&adapted13.sine>.12,
 '13/5 adapted line and plane must meet near the drawing at a usable angle');
const xIntersection=(left,right,proj)=>{
 const [a,b]=left,[c,d]=right;
 const den=(a[0]-b[0])*(c[1]-d[1])-(a[1]-b[1])*(c[0]-d[0]);
 assert(Math.abs(den)>1e-10,'parallel source lines have no junction');
 return ((a[0]*b[1]-a[1]*b[0])*(c[0]-d[0]) -
   (a[0]-b[0])*(c[0]*d[1]-c[1]*d[0]))/den;
};
const close=(x,y,tol=1e-5)=>Math.abs(x-y)<=tol;
function fixedJunction(a,b,projection,x){
 const aa=a[projection],bb=b[projection];
 assert(close(xIntersection(aa,bb),x,1e-5),
   'intersecting adapted source lines must meet at stated projector x='+x);
}
for(const projection of ['p1','p2']){
 fixedJunction(s12.planeB.lines.h,s12.planeB.lines.f,projection,452);
 fixedJunction(s13.lines.a,s13.lines.b,projection,418.867);
 const norm12=s12.planeA.lines;
 assert(close((norm12.a[projection][1][1]-norm12.a[projection][0][1])/
   (norm12.a[projection][1][0]-norm12.a[projection][0][0]),
   (norm12.b[projection][1][1]-norm12.b[projection][0][1])/
   (norm12.b[projection][1][0]-norm12.b[projection][0][0]),1e-8),
   '12/6 plane Sigma lost original a parallel b');
}
assert(close(s12.planeB.lines.h.p2[0][1],s12.planeB.lines.h.p2[1][1])&&
 close(s12.planeB.lines.f.p1[0][1],s12.planeB.lines.f.p1[1][1]),
 '12/6 horizontal h and frontal f must remain axis-parallel');
for(const [name,raw,adapted] of [
  ['12/6',raw12,s12],
  ['13/5',raw13,s13]
]){
 const lineSets=name==='12/6'
   ? [['planeA',raw.planeA.lines,adapted.planeA.lines],
      ['planeB',raw.planeB.lines,adapted.planeB.lines]]
   : [['plane',raw.lines,adapted.lines]];
 for(const [kind,rawLines,drawnLines] of lineSets){
  for(const [label,line] of Object.entries(drawnLines)){
   for(const proj of ['p1','p2']){
    const reference=rawLines[label][proj],altered=line[proj];
    assert(Math.abs(reference[1][0]-reference[0][0])>0 &&
      Math.abs(reference[0][0]-altered[0][0])<2 &&
      Math.abs(reference[1][0]-altered[1][0])<2,
      name+' must preserve horizontal segment extents within existing tracing tolerance '+kind+label+proj);
    for(let i=0;i<2;i++)assert(Math.abs(reference[i][1]-altered[i][1])<35,
      name+' reconstructed stroke exceeds silhouette deformation limit: '+kind+label+proj);
   }
  }
 }
}
// Preserve the recognisable upper/lower interior triangles of 13/5.
// Comparing areas explicitly catches the previous regression in which a
// small slope edit made a characteristic triangle half its original size.
function segmentIntersection(a,b){
 const [p,q]=a,[r,t]=b;
 const dx=q[0]-p[0],dy=q[1]-p[1],ex=t[0]-r[0],ey=t[1]-r[1];
 const cross2=(x,y,u,v)=>x*v-y*u,den=cross2(dx,dy,ex,ey);
 assert(Math.abs(den)>1e-8,'source triangle has parallel edges');
 const fraction=cross2(r[0]-p[0],r[1]-p[1],ex,ey)/den;
 return [p[0]+fraction*dx,p[1]+fraction*dy];
}
function enclosedArea(s,projection){
 const A=s.lines.a[projection],B=s.lines.b[projection],
   L=s.lines.l[projection];
 const C=segmentIntersection(A,B),P=segmentIntersection(A,L),
   Q=segmentIntersection(B,L);
 return Math.abs((P[0]-C[0])*(Q[1]-C[1])-
   (P[1]-C[1])*(Q[0]-C[0]))/2;
}
for(const projection of ['p1','p2']){
 const ratio=enclosedArea(s13,projection)/enclosedArea(raw13,projection);
 assert(ratio>.75&&ratio<1.35,
   '13/5 characteristic '+projection+' interior triangle distorted by '+ratio);
}
const rand13=rng(981731),rand12=rng(315);
let range13=[Infinity,-Infinity],range12=[Infinity,-Infinity];
for(let i=0;i<12000;i++){
 const copy=clone(s13);
 for(const name of ['a','b','l'])for(const proj of ['p1','p2'])for(let k=0;k<2;k++)
   copy.lines[name][proj][k][1]+=(2*rand13()-1);
 const {x}=xLinePlane(copy);
 assert(Number.isFinite(x),'13/5 unstable even after deliberate reconstruction');
 range13=[Math.min(range13[0],x),Math.max(range13[1],x)];
}
for(let i=0;i<4000;i++){
 const copy=clone(s12);
 for(const planeName of ['planeA','planeB'])for(const [name,L] of Object.entries(copy[planeName].lines))
  for(const proj of ['p1','p2']){
   const amount=(2*rand12()-1);
   if((name==='h'&&proj==='p2')||(name==='f'&&proj==='p1'))
     L[proj].forEach(p=>p[1]+=amount);
   else L[proj].forEach(p=>p[1]+=(2*rand12()-1));
  }
 const {x}=atHeight(copy);
 assert(Number.isFinite(x),'12/6 unstable even after reconstruction');
 range12=[Math.min(range12[0],x),Math.max(range12[1],x)];
}
assert(range12[0]>500&&range12[1]<2000,'12/6 adapted source now unstable near one-pixel uncertainty');
assert(range13[0]>500&&range13[1]<1150,'13/5 adapted source now unstable near one-pixel uncertainty');
console.log(JSON.stringify({
  source:'Original-photo and adapted geometry comparison, not original-photo measurement',
  '12/6':{original_x:original12.x,adapted_x:adapted12.x,adapted_angle_degrees:adapted12.angle,perturbed_x:range12},
  '13/5':{original_x:original13.x,adapted_x:adapted13.x,adapted_sine:adapted13.sine,perturbed_x:range13}
},null,2));
