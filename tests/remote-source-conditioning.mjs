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
  assert.equal(s.sourceRecheckRequired, true, name + ' source warning was removed');
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
const base13=xLinePlane(s13),base12=atHeight(s12);
assert(base13.x < -8000 && base13.sine < .01,'13/5 conditioning changed');
assert(base12.x > 3000 && base12.angle > 3 && base12.angle < 5,
  '12/6 conditioning changed');

const rand13=rng(981731);
let min13=Infinity,max13=-Infinity,flipped13=0,near13=0;
for(let i=0;i<12000;i++) {
  const s=clone(s13);
  for(const name of ['a','b','l'])for(const proj of ['p1','p2'])
    for(let k=0;k<2;k++)
      s.lines[name][proj][k][1]+=(2*rand13()-1);
  const {x}=xLinePlane(s);
  assert(Number.isFinite(x),'13/5 singular perturbed input');
  min13=Math.min(min13,x);max13=Math.max(max13,x);
  if(x>0)flipped13++;
  if(Math.abs(x)<1200)near13++;
}
assert(flipped13>0 && min13<0 && max13>0,
  '13/5 sub-pixel tracing uncertainty no longer demonstrates sign instability');
assert.equal(near13,0,
  '13/5 unexpected nearby intersection in chosen illustrative tracing ensemble');

const rand12=rng(315);
let min12=Infinity,max12=-Infinity;
for(let i=0;i<4000;i++) {
  const s=clone(s12);
  for(const planeName of ['planeA','planeB']) {
    for(const [name,L] of Object.entries(s[planeName].lines)) {
      for(const proj of ['p1','p2']) {
        // h₂ and f₁ are horizontals in their respective projections.
        // Vary only their position, never the required horizontal direction.
        if((name==='h'&&proj==='p2')||(name==='f'&&proj==='p1')){
          const shift=(2*rand12()-1);
          for(const end of L[proj])end[1]+=shift;
        } else {
          for(const end of L[proj])end[1]+=(2*rand12()-1);
        }
      }
    }
  }
  const {x}=atHeight(s);
  assert(Number.isFinite(x),'12/6 singular perturbed input');
  min12=Math.min(min12,x);max12=Math.max(max12,x);
}
assert(min12>2000 && max12>base12.x+250,
  '12/6 remote intersection or source sensitivity unexpectedly changed');

console.log(JSON.stringify({
  type:'Source-tracing conditioning diagnostic, NOT a metric certification',
  units:'internal image coordinates (not millimetres)',
  perturbation:'uniform independent ordinate deviations within one image unit; fixed-seed demonstration, not a probability model',
  '12/6':{baseline_x:base12.x,plane_angle_deg:base12.angle,
    x_range_at_z_minus_230:[min12,max12],samples:4000},
  '13/5':{baseline_x:base13.x,line_plane_sine:base13.sine,
    sampled_x_extremes:[min13,max13],sign_flips:flipped13,
    nearby_within_1200:near13,samples:12000}
},null,2));
