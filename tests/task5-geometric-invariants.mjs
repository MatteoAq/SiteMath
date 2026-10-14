// Analytic validation of every task-5 graphical construction.
// Uses the solver's line/plane representation but calculates residuals
// independently of the final SVG and the solver's own K labels.
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const W=dom.window;
Object.defineProperty(W.SVGElement.prototype,'getTotalLength',{value(){return 100;}});
W.Element.prototype.animate=function(){return {onfinish:null,cancel(){},finish(){}}};
W.print=()=>{};
W.eval(fs.readFileSync('variants.js','utf8'));
const bridgeMarker='    const norm=normalizeSteps(steps,200,165);';
const marker='  const remembered=loadSelection();';
const source=fs.readFileSync('multi.js','utf8');
if(source.split(marker).length!==2)throw Error('solver instrumentation anchor changed');
if(source.split(bridgeMarker).length!==2)throw Error('task5 bridge probe anchor changed');
W.eval(source
 .replace(bridgeMarker,'    window.__task5BridgeProbe={bridge,cut,refs,givenRefs,witnessBridge,witness1,witness2};\n'+bridgeMarker)
 .replace(marker,`  window.__siteMathGeometryProbe={planeFromScheme,planeReferenceLines,task5AuxCandidate,segmentVisibility,task5VisibilityWitness,task5VisibilityExtents,solveTask5Scheme};\n`+marker));
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
 const extent=audit.task5VisibilityExtents(lrec,K1);
 const vis1=audit.segmentVisibility(lrec,plane,'p1',K1,extent.p1);
 const vis2=audit.segmentVisibility(lrec,plane,'p2',K2,extent.p2);
 const len1=Math.hypot(extent.p1[1].x-extent.p1[0].x,extent.p1[1].y-extent.p1[0].y);
 const len2=Math.hypot(extent.p2[1].x-extent.p2[0].x,extent.p2[1].y-extent.p2[0].y);
 const splitParameter=(range,K)=>{
   const span=range[1].x-range[0].x;
   return Math.abs(span)>1e-8?(K.x-range[0].x)/span:NaN;
 };
 for(const [side,range,len,K] of [['p1',extent.p1,len1,K1],['p2',extent.p2,len2,K2]]){
   const t=splitParameter(range,K);
   if(!(t>.001&&t<.999))issues.push(variant+'/'+side+': K is not between display endpoints, t='+t);
   if(!(len>5))issues.push(variant+'/'+side+': display line collapsed');
 }
 // Inspect the actual final construction entities: the two visible/hidden
 // strokes must meet ONLY at K and must not overlap even if the input
 // photograph stops before K.
 const drawing=audit.solveTask5Scheme(s,{});
 // Variant 17's first published result was only 1.3% scale because a
 // deliberately constructed Ω∩a witness lay ~7000 units away, even though K
 // was close to the archived source. Require a REAL 3D line g=TU before Ω,
 // keep given a/b on the first frame and reject any invented analytic shortcut.
 if(variant==='17'){
   const probe=W.__task5BridgeProbe;
   if(!probe?.bridge||probe.refs[1]?.name!=='g')
     issues.push('17: remotely intersecting source lines not replaced with a constructed g');
   else{
     const g=probe.bridge.g,plane=audit.planeFromScheme(s);
     const sz=Math.hypot(plane.n.x,plane.n.y,plane.n.z);
     for(let j=0;j<2;j++){
       const T={x:g.p1[j][0],y:g.p1[j][1],z:-g.p2[j][1]};
       const err=Math.abs((plane.n.x*T.x+plane.n.y*T.y+plane.n.z*T.z+plane.d)/sz);
       if(Math.abs(g.p1[j][0]-g.p2[j][0])>1e-6||err>1e-5)
         issues.push('17: auxiliary g endpoint is not a common projected 3D point of original Σ');
     }
     const titles=drawing.steps.map(st=>st.title||'');
     const source=titles.findIndex(t=>t.startsWith('Сверь исходные проекции'));
     const omega=titles.findIndex(t=>t.startsWith('Заключи ℓ во вспомогательную'));
     const stages=[
       'Выбери T₁','По линии связи перенеси T₁','Выбери U₁',
       'По линии связи перенеси U₁','Соедини T и U'
     ].map(prefix=>titles.findIndex(t=>t.startsWith(prefix)));
     if(source!==0||stages.some(x=>x<0)||stages.some((x,i)=>i&&x!==stages[i-1]+1)||
        stages[4]>=omega)
       issues.push('17: g=TU is not explained in five real pencil steps BEFORE Ω');
     if(drawing.width>650||drawing.height>600)
       issues.push('17: unnecessary remote projector still shrinks the full drawing');
     if(drawing.steps[0].entities.some(e=>e.label==='g₁'||e.label==='g₂'))
       issues.push('17: derived g was falsely added to printed source frame');
   }
 }else if(W.__task5BridgeProbe?.bridge)
   issues.push(variant+': extra source-derived g is unnecessary');
 // In 19/5 a photographed source-line competitor was >1200 units
 // outside the printed drawing. A new transverse g must be explicitly
 // built from two GIVEN parallel lines, not silently invented in code.
 if(variant==='19'){
   const probe=W.__task5BridgeProbe,bridge=probe?.witnessBridge;
   if(!bridge||probe.witness1?.ref?.name!=='g')
     issues.push('19: near competitor g missing; source-only witness still remote');
   else{
     const g=bridge.g,plane=audit.planeFromScheme(s),sz=Math.hypot(plane.n.x,plane.n.y,plane.n.z);
     for(let i=0;i<2;i++){
       const P={x:g.p1[i][0],y:g.p1[i][1],z:-g.p2[i][1]};
       const gap=Math.abs((plane.n.x*P.x+plane.n.y*P.y+plane.n.z*P.z+plane.d)/sz);
       if(Math.abs(g.p1[i][0]-g.p2[i][0])>1e-6||gap>1e-5)
         issues.push('19: witness helper g does not belong to original Σ');
     }
     const titles=drawing.steps.map(st=>st.title||'');
     const stages=['Выбери T₁','Перенеси T₁','Выбери U₁','Перенеси U₁','Проведи g=TU']
       .map(x=>titles.findIndex(t=>t.startsWith(x)));
     const witnessStep=titles.findIndex(t=>t.startsWith('Видимость на Π₁'));
     if(stages.some(x=>x<0)||stages.some((x,i)=>i&&x!==stages[i-1]+1)||
        stages[4]>=witnessStep)
       issues.push('19: witness helper points not constructed before comparison');
     if(drawing.width>500||drawing.height>600||
        Math.abs(probe.witness1.X.x)>650)
       issues.push('19: competitor still drawn extremely far from source');
     if(drawing.steps[0].entities.some(e=>e.label==='g₁'||e.label==='g₂'))
       issues.push('19: derived competitor g falsely appears in the printed source');
   }
 }else if(W.__task5BridgeProbe?.witnessBridge)
   issues.push(variant+': unnecessary additional competitor g');
 const givenDisplay=s.givenLine==='f'?'f':'ℓ';
 const finish=drawing.steps.find(st=>st.title?.startsWith('Нанеси видимость '+givenDisplay));
 const strokes=(finish?.entities||[]).filter(e=>e.type==='line'&&(e.cls==='answer-line'||e.cls==='hidden-line'));
 if(strokes.length!==4){
   issues.push(variant+': final stroke geometry missing ('+strokes.length+')');
 }else{
   for(const [n,offset] of [['p1',0],['p2',2]]){
     const A=strokes[offset],B=strokes[offset+1];
     const same=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-4;
     const d=Math.hypot(B.b.x-A.a.x,B.b.y-A.a.y);
     const d1=Math.hypot(A.b.x-A.a.x,A.b.y-A.a.y);
     const d2=Math.hypot(B.b.x-B.a.x,B.b.y-B.a.y);
     if(!same(A.b,B.a)||d1<10||d2<10||Math.abs(d-(d1+d2))>.001)
       issues.push(variant+'/'+n+': final visibility segments overlap or collapse');
   }
 }
 const witnesses={};
 for(const side of ['p1','p2']){
  const K=side==='p1'?K1:K2;
  const w=audit.task5VisibilityWitness(refs,lrec,side,K);
  if(!w){issues.push(variant+'/'+side+': visibility witness absent');continue;}
  const S=extent[side],dx=S[1].x-S[0].x,dy=S[1].y-S[0].y;
  const t=((w.X.x-S[0].x)*dx+(w.X.y-S[0].y)*dy)/(dx*dx+dy*dy);
  const tk=((K.x-S[0].x)*dx+(K.y-S[0].y)*dy)/(dx*dx+dy*dy);
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
