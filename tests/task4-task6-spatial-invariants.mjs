// Spatial invariants independent of the rendering and step sequence.
// Tests all current task 4 horizontal/frontals and both task 6 planes.
import fs from 'node:fs';
const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
let code=fs.readFileSync('multi.js','utf8');
const m4="    const norm=normalizeSteps(steps,200,155);";
const m6="    const norm=normalizeSteps(steps,210,170);";
if(code.split(m4).length!==2||code.split(m6).length!==3)
 throw new Error('solver probe anchors changed');
code=code.replace(m4,'    window.__task4Probe={plane,h3,f3,L3,through3,target3};\n'+m4);
const relationAnchor="      if(R3){\n        const R=project3(R3),Ref=ref3?project3(ref3):null;";
if(code.split(relationAnchor).length!==2)throw Error('task4 relation probe anchor');
code=code.replace(relationAnchor,"      if(R3){\n        window.__task4Relation={R3,ref3};\n        const R=project3(R3),Ref=ref3?project3(ref3):null;");
const graphEnd="    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps,diagramPending:false,graphicalConstruction:true,paperScale:norm.scale};";
const old=m6+"\n"+graphEnd;
if(code.split(old).length!==2)throw new Error('graphical task 6 probe anchor changed');
code=code.replace(old,"    window.__task6Probe={P,Q,pair,levelType};\n"+old);
const cut=code.indexOf("  $('variantSelect').addEventListener");
if(cut<0)throw new Error('initialization boundary changed');
code=code.slice(0,cut)+"  window.__geometry={solveTask4Scheme,solveTask6Graphical,planeFromDef,planeDefReferenceLines,schemeLine3};\n})();";
new Function('window','document',code)(W,{getElementById(){return {};}});
const errors=[],variants=Object.keys(W.SITEMATH_SCHEMES).sort();
const n=p=>Math.hypot(p.x,p.y,p.z);
const signed=(P,plane)=>(plane.n.x*P.x+plane.n.y*P.y+plane.n.z*P.z+plane.d)/n(plane.n);
const xyz=P=>({x:P.p1.x,y:P.p1.y,z:-P.p2.y});
for(const variant of variants){
 const def=W.SITEMATH_SCHEMES[variant];
 W.__task4Relation=null;
 const t4=W.__geometry.solveTask4Scheme(def.task4,{});
 if(t4?.error||!W.__task4Probe)errors.push(variant+'/4: failed to construct plane special lines');
 else {
  const {plane,h3,f3}=W.__task4Probe;
  if(!h3||!f3)errors.push(variant+'/4: missing horizontal or frontal');
  else{
   for(const [label,seg,component] of [['h',h3,'z'],['f',f3,'y']]){
    if(Math.abs(seg[0][component]-seg[1][component])>1e-5)
      errors.push(variant+'/4: '+label+' is not an actual horizontal/frontal');
    for(const P of seg){
      if(Math.abs(signed(P,plane))>1e-4)
        errors.push(variant+'/4: '+label+' not on the source plane');
    }
   }
  }
 }
 const geom=W.__task4Probe;
 // Confirm that the ACTUALLY DRAWN greatest-slope line is perpendicular
 // to the horizontal in Π₁ and has matching Π₁/Π₂ projectors. This is
 // stricter than checking the analytic direction of the source plane alone.
 const visibleLine=label=>{
   const step=t4.steps.find(step=>(step.entities||[]).some(e=>e.type==='text'&&e.label===label));
   return (step?.entities||[]).find(e=>e.type==='line'&&e.cls==='answer-line');
 };
 const hDrawn=visibleLine('h₁');
 const slope1=visibleLine('ЛС₁'),slope2=visibleLine('ЛС₂');
 if(!hDrawn||!slope1||!slope2)errors.push(variant+'/4: visible horizontal or greatest slope missing');
 else {
   const d1={x:slope1.b.x-slope1.a.x,y:slope1.b.y-slope1.a.y};
   const d2={x:slope2.b.x-slope2.a.x,y:slope2.b.y-slope2.a.y};
   const h={x:hDrawn.b.x-hDrawn.a.x,y:hDrawn.b.y-hDrawn.a.y};
   const perpendicular=Math.abs(d1.x*h.x+d1.y*h.y)/(Math.hypot(d1.x,d1.y)*Math.hypot(h.x,h.y));
   if(!(perpendicular<1e-6))errors.push(variant+'/4: shown LS₁ not perpendicular to h₁');
   if(Math.abs(slope1.a.x-slope2.a.x)>1e-5||Math.abs(slope1.b.x-slope2.b.x)>1e-5)
     errors.push(variant+'/4: LS₁ and LS₂ endpoints not paired on projectors');
   const d3={x:d1.x,y:d1.y,z:-d2.y};
   if(!(Math.abs(signed({x:d3.x,y:d3.y,z:d3.z},{n:geom.plane.n,d:0}))<1e-5))
     errors.push(variant+'/4: drawn greatest slope direction is not in Σ');
 }
 const op=def.task4.operation||{};
 const delta=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
 const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 if(geom?.L3&&geom.through3){
   const d=delta(geom.L3[1],geom.L3[0]);
   const isThrough=geom.L3.some(p=>n(delta(p,geom.through3))<1e-5)
     || n(delta({x:(geom.L3[0].x+geom.L3[1].x)/2,y:(geom.L3[0].y+geom.L3[1].y)/2,z:(geom.L3[0].z+geom.L3[1].z)/2},geom.through3))<1e-5;
   if(!isThrough) errors.push(variant+'/4: ℓ does not pass through given source point '+op.through);
   if(op.type==='line_parallel_plane'){
     if(Math.abs(dot(d,geom.plane.n))/(n(d)*n(geom.plane.n))>1e-5)
       errors.push(variant+'/4: ℓ not parallel to Σ');
   }
   if(op.type==='line_parallel_horizontal'){
     const h=delta(geom.h3[1],geom.h3[0]);
     const cross={x:d.y*h.z-d.z*h.y,y:d.z*h.x-d.x*h.z,z:d.x*h.y-d.y*h.x};
     if(n(cross)/(n(d)*n(h))>1e-5)
       errors.push(variant+'/4: ℓ not parallel to constructed horizontal h');
   }
   if(op.type.startsWith('line_intersects_')&&!geom.target3)
     errors.push(variant+'/4: requested intersection with source line omitted');
 }
 if(op.resultPoint){
   const pair=W.__task4Relation;
   if(!pair?.R3||!pair?.ref3) errors.push(variant+'/4: final '+op.resultPoint+' lacks source reference N');
   else {
     const v=delta(pair.R3,pair.ref3);
     const vertical=['above_named','above_line','below_line','above_plane','below_plane'].includes(op.relation);
     const depth=['behind_line','front_of_line','front_of_plane'].includes(op.relation);
     if(vertical && (Math.abs(v.x)>1e-5||Math.abs(v.y)>1e-5))
       errors.push(variant+'/4: point '+op.resultPoint+' does not share x,y with N');
     if(depth && (Math.abs(v.x)>1e-5||Math.abs(v.z)>1e-5))
       errors.push(variant+'/4: point '+op.resultPoint+' does not share x,z with N');
     if(op.relation?.startsWith('above_')&&!(v.z>0))errors.push(variant+'/4: point not above N');
     if(op.relation?.startsWith('below_')&&!(v.z<0))errors.push(variant+'/4: point not below N');
     if(op.relation?.startsWith('front_of_')&&!(v.y>0))errors.push(variant+'/4: point not in front of N');
     if(op.relation?.startsWith('behind_')&&!(v.y<0))errors.push(variant+'/4: point not behind N');
   }
 }
 // Independent 3D incidence check for all task-4 crossing operations.
 // A point common only on one projection is not a real spatial intersection.
 if(op.type?.startsWith('line_intersects_')){
   const P=geom?.target3,L=geom?.L3;
   const supporting=op.type==='line_intersects_horizontal'?geom.h3
     :op.type==='line_intersects_frontale'?geom.f3
     :op.type==='line_intersects_named'&&def.task4.lines?.[op.target]
       ?W.__geometry.schemeLine3(def.task4.lines[op.target]):null;
   const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
   const pointLineGap=(point,ends)=>{
     if(!point||!ends||ends.length!==2)return Infinity;
     const direction=delta(ends[1],ends[0]),r=delta(point,ends[0]);
     return n(cross(direction,r))/n(direction);
   };
   if(!P||!supporting||!L)
     errors.push(variant+'/4: source crossing lacks a common 3D target');
   else {
     const g1=pointLineGap(P,supporting),g2=pointLineGap(P,L);
     if(g1>1e-5||g2>1e-5||!(n(delta(P,geom.through3))>1e-4))
       errors.push(variant+'/4: invalid 3D source crossing '+op.type+
         ' support='+g1+' result='+g2);
   }
   const titles=t4.steps.map(st=>st.title||'');
   const chosen=titles.findIndex(x=>/^Выбери T[₁₂] на /.test(x));
   const paired=titles.findIndex(x=>/^По линии связи получи T[₁₂]/.test(x));
   const joined=titles.findIndex(x=>x.startsWith('Соедини ')&&x.includes(' с T '));
   if(chosen<0||paired!==chosen+1||joined!==paired+1)
     errors.push(variant+'/4: T projections not separately chosen and transferred before drawing ℓ');
   else {
     const pointLabels=index=>(t4.steps[index].entities||[])
       .filter(e=>e.type==='point'&&/^T[₁₂]$/.test(e.label)).map(e=>e.label);
     const first=pointLabels(chosen),second=pointLabels(paired);
     const projector=(t4.steps[paired].entities||[]).find(e=>
       e.type==='line'&&e.cls==='construction-line'&&
       Math.abs(e.a.x-e.b.x)<1e-6);
     const answer=(t4.steps[joined].entities||[])
       .filter(e=>e.type==='line'&&e.cls==='answer-line');
     if(first.length!==1||second.length!==1||
       first[0]===second[0]||!projector||answer.length!==2)
       errors.push(variant+'/4: crossing-point projector or drawn ℓ missing');
   }
 }
 if(op.type==='line_parallel_plane'&&geom?.through3){
   const distance=Math.abs(signed(geom.through3,geom.plane));
   if(!(distance>1e-4))
     errors.push(variant+'/4: plane-parallel line actually lies IN source plane');
 }
 W.__task6Probe=null;
 const t6=W.__geometry.solveTask6Graphical(def.task6,{});
 if(!t6?.graphicalConstruction || !W.__task6Probe){
   errors.push(variant+'/6: fall back to incomplete analytic construction');
   continue;
 }
 const {P,Q,pair,levelType}=W.__task6Probe;
 // Test every intermediate helper point on both orthogonal projections,
 // including projecting-plane degeneracies. There are 128 such points in
 // the current 16-variant corpus (2 cuts × 2 planes × 2 endpoints).
 for(const cut of pair){
   for(const [label,section,key] of [['A',cut.a,'planeA'],['B',cut.b,'planeB']]){
     const parent=W.__geometry.planeFromDef(def.task6[key]);
     for(let i=0;i<2;i++){
       const p1=section.p1[i],p2=section.p2[i];
       const T={x:p1.x,y:p1.y,z:-p2.y};
       if(Math.abs(p1.x-p2.x)>1e-5)
         errors.push(variant+'/6 section '+label+': auxiliary point missing same-x projector');
       if(!(Math.abs(signed(T,parent))<1e-4))
         errors.push(variant+'/6 section '+label+': section point not on original plane');
       const levelError=levelType==='horizontal'
         ? Math.abs(p2.y-cut.level) : Math.abs(p1.y-cut.level);
       if(levelError>1e-5)
         errors.push(variant+'/6 section '+label+': point not on the chosen auxiliary level');
     }
   }
 }
 // True intersecting horizontal h and frontal f cannot both be cut
 // directly at generic horizontal/frontal levels. Check the displayed
 // construction of a diagonal g=TU through real source-line points instead
 // of accepting a remote/extraneous analytic shortcut.
 for(const [key,planeSymbol] of [['planeA','Σ'],['planeB','Θ']]){
   const original=def.task6[key];
   if(original?.type!=='intersecting_lines'||!original.lines?.h||!original.lines?.f)continue;
   const refs=W.__geometry.planeDefReferenceLines(original);
   const g=refs.find(x=>x.construction==='h-f-diagonal');
   if(!g?.rec){
     errors.push(variant+'/6: h/f plane has no genuine auxiliary diagonal g');
     continue;
   }
   const parent=W.__geometry.planeFromDef(original);
   for(let i=0;i<2;i++){
     const T={x:g.rec.p1[i][0],y:g.rec.p1[i][1],z:-g.rec.p2[i][1]};
     if(Math.abs(g.rec.p1[i][0]-g.rec.p2[i][0])>1e-7 ||
        Math.abs(signed(T,parent))>1e-4)
       errors.push(variant+'/6: generated point on g does not belong to given h/f plane');
   }
   const titles=t6.steps.map(x=>x.title);
   const chosen=titles.findIndex(x=>x.startsWith('Выбери точку T₁ на h₁'));
   const order=[
     'Выбери точку T₁ на h₁','По линии связи получи T₂',
     'Выбери точку U₁ на f₁','По линии связи получи U₂',
     'Соедини T и U – построй вспомогательную прямую g'
   ].map(prefix=>titles.findIndex((x,i)=>i>=Math.max(0,chosen)&&x.startsWith(prefix)));
   const alpha=titles.findIndex(x=>x==='Выбери вспомогательную плоскость α');
   if(order.some(x=>x<0)||order.some((x,i)=>i&&x!==order[i-1]+1)||
      order[4]>=alpha)
     errors.push(variant+'/6: auxiliary g is not constructed T₁→T₂→U₁→U₂→g before section levels');
   if(order.every(x=>x>=0)){
     const first=t6.steps[order[0]].entities.map(x=>x.label).filter(Boolean);
     const second=t6.steps[order[1]].entities.map(x=>x.label).filter(Boolean);
     const third=t6.steps[order[2]].entities.map(x=>x.label).filter(Boolean);
     const fourth=t6.steps[order[3]].entities.map(x=>x.label).filter(Boolean);
     if(first.includes('T₂')||!second.includes('T₂')||
        third.includes('U₂')||!fourth.includes('U₂'))
       errors.push(variant+'/6: paired projections T₂/U₂ appear without an earlier projector');
   }
 }
 // With an explicitly constructed g, distant paper-plane intersections
 // must no longer cause the immense drawing extents observed previously.
 const compactLimit={ '04':1600,'10':900,'12':2300 };
 if(compactLimit[variant]&&t6.width>compactLimit[variant])
   errors.push(variant+'/6: auxiliary section still excessive ('+t6.width.toFixed(1)+')');

 const P3=xyz(P),Q3=xyz(Q);
 const direction={x:Q3.x-P3.x,y:Q3.y-P3.y,z:Q3.z-P3.z};
 if(n(direction)<1e-5)errors.push(variant+'/6: common points coincide');
 for(const side of ['planeA','planeB']){
   const plane=W.__geometry.planeFromDef(def.task6[side]);
   for(const [label,T] of [['P',P3],['Q',Q3]]){
     const distance=Math.abs(signed(T,plane));
     if(!(distance<1e-4))errors.push(variant+'/6 '+side+': '+label+' not on plane (gap='+distance+')');
   }
   const cosine=Math.abs(plane.n.x*direction.x+plane.n.y*direction.y+plane.n.z*direction.z)/(n(plane.n)*n(direction));
   if(cosine>1e-5)errors.push(variant+'/6: intersection r not parallel to '+side);
 }
 // Test the actual final plotted segments after paper-coordinate normalization,
 // not just the analytic direction returned by plane-plane intersection.
 const intersectionStep=t6.steps.find(step=>step.title.startsWith('Соедини P и Q'));
 const throughLabel=def.task6.pointLabel||'K';
 const answerStep=t6.steps.find(step=>step.title.includes('проведи ℓ ∥ обеим плоскостям'));
 const resultSegments=step=>(step?.entities||[]).filter(e=>e.type==='line'&&e.cls==='answer-line');
 const rSegments=resultSegments(intersectionStep);
 const lSegments=resultSegments(answerStep);
 if(rSegments.length!==2||lSegments.length!==2){
   errors.push(variant+'/6: final projected r or ℓ are missing');
 } else {
   const points=(t6.steps[0].entities||[]).filter(e=>e.type==='point');
   const cross2=(a,b)=>a.x*b.y-a.y*b.x;
   const vec2=e=>({x:e.b.x-e.a.x,y:e.b.y-e.a.y});
   for(let i=0;i<2;i++){
     const name=throughLabel+(i===0?'₁':'₂');
     const k=points.find(e=>e.label===name)?.p;
     const u=vec2(rSegments[i]),v=vec2(lSegments[i]);
     const area=Math.abs(cross2(u,v))/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y));
     if(!(area<1e-6))errors.push(variant+'/6: final drawn ℓ not parallel to r on Π'+(i+1));
     if(!k){
       errors.push(variant+'/6: missing given '+name+' on normalized starter');
       continue;
     }
     const dist=Math.abs(cross2(v,{x:k.x-lSegments[i].a.x,y:k.y-lSegments[i].a.y}))
       /Math.hypot(v.x,v.y);
     if(!(dist<1e-5))errors.push(variant+'/6: final drawn ℓ does not pass through '+name);
   }
 }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log('Spatial construction geometry OK: '+variants.length+' task-4 special lines and 128 task-6 auxiliary points + P/Q and final parallel lines checked.');
