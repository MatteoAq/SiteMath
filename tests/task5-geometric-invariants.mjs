// Analytic validation of every task-5 graphical construction.
// Uses the solver's line/plane representation but calculates residuals
// independently of the final SVG and the solver's own K labels.
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const html=fs.readFileSync('index.html','utf8')
 .replace(/<script[^>]*src="\\.\\/variants\\.js"[^>]*><\\/script>/,'')
 .replace(/<script[^>]*src="\\.\\/multi\\.js"[^>]*><\\/script>/,'');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const W=dom.window;
Object.defineProperty(W.SVGElement.prototype,'getTotalLength',{value(){return 100;}});
W.Element.prototype.animate=function(){return {onfinish:null,cancel(){},finish(){}}};
W.print=()=>{};
W.eval(fs.readFileSync('variants.js','utf8'));
const marker='  const remembered=loadSelection();';
const source=fs.readFileSync('multi.js','utf8');
if(source.split(marker).length!==2)throw Error('solver instrumentation anchor changed');
W.eval(source.replace(marker,`  window.__siteMathGeometryProbe={planeFromScheme,planeReferenceLines,task5AuxCandidate,segmentVisibility,task5VisibilityWitness,solveTask5Scheme};\n`+marker));
const audit=W.__siteMathGeometryProbe,issues=[],results=[];
const norm=p=>Math.hypot(p.x,p.y,p.z);
for(const variant of Object.keys(W.SITEMATH_SCHEMES).sort()){
 const s=W.SITEMATH_SCHEMES[variant].task5;
 const plane=audit.planeFromScheme(s);
 const refs=audit.planeReferenceLines(s);
 const lrec=s.lines[s.givenLine||'l'];
 const cuts=['p1','p2'].map(side=>audit.task5AuxCandidate(refs,lrec,side)).filter(Boolean).sort((a,b)=>a.score-b.score);
 if(!cuts.length){issues.push(variant+': no auxiliary cutting plane');continue;}
 const cut=cuts[0];
 const K1=cut.primary==='p1'?cut.KPrimary:cut.KOther;
 const K2=cut.primary==='p2'?cut.KPrimary:cut.KOther;
 const P={x:(K1.x+K2.x)/2,y:K1.y,z:-K2.y};
 const dist=Math.abs(plane.n.x*P.x+plane.n.y*P.y+plane.n.z*P.z+plane.d)/norm(plane.n);
 const xgap=Math.abs(K1.x-K2.x);
 const vis1=audit.segmentVisibility(lrec,plane,'p1',K1);
 const vis2=audit.segmentVisibility(lrec,plane,'p2',K2);
 const witnesses={};
 for(const side of ['p1','p2']){
  const K=side==='p1'?K1:K2;
  const w=audit.task5VisibilityWitness(refs,lrec,side,K);
  if(!w){issues.push(variant+'/'+side+': visibility witness absent');continue;}
  const S=lrec[side],dx=S[1][0]-S[0][0],dy=S[1][1]-S[0][1];
  const t=((w.X.x-S[0][0])*dx+(w.X.y-S[0][1])*dy)/(dx*dx+dy*dy);
  const tk=((K.x-S[0][0])*dx+(K.y-S[0][1])*dy)/(dx*dx+dy*dy);
  const idx=t<tk?0:1;
  const shown=(side==='p1'?vis1:vis2)[idx];
  witnesses[side]={same:shown===w.lineVisible,side:idx,visible:shown,witness:w.lineVisible};
  if(shown!==w.lineVisible)issues.push(variant+'/'+side+': source competitor contradicts visibility, side='+idx);
 }
 results.push({variant,dist:+dist.toFixed(4),xgap:+xgap.toFixed(5),vis1,vis2,witnesses});
 if(!Number.isFinite(dist)||dist>1) issues.push(variant+': task 5 K not on given plane, distance '+dist);
 if(xgap>0.001) issues.push(variant+': K projections do not share x, gap '+xgap);
}
console.log(JSON.stringify({results,issues},null,2));
if(issues.length)process.exitCode=1;
