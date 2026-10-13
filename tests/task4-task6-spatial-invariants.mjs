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
code=code.replace(m4,'    window.__task4Probe={plane,h3,f3};\n'+m4);
const graphEnd="    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps,diagramPending:false,graphicalConstruction:true,paperScale:norm.scale};";
const old=m6+"\n"+graphEnd;
if(code.split(old).length!==2)throw new Error('graphical task 6 probe anchor changed');
code=code.replace(old,"    window.__task6Probe={P,Q};\n"+old);
const cut=code.indexOf("  $('variantSelect').addEventListener");
if(cut<0)throw new Error('initialization boundary changed');
code=code.slice(0,cut)+"  window.__geometry={solveTask4Scheme,solveTask6Graphical,planeFromDef};\n})();";
new Function('window','document',code)(W,{getElementById(){return {};}});
const errors=[],variants=Object.keys(W.SITEMATH_SCHEMES).sort();
const n=p=>Math.hypot(p.x,p.y,p.z);
const signed=(P,plane)=>(plane.n.x*P.x+plane.n.y*P.y+plane.n.z*P.z+plane.d)/n(plane.n);
const xyz=P=>({x:P.p1.x,y:P.p1.y,z:-P.p2.y});
for(const variant of variants){
 const def=W.SITEMATH_SCHEMES[variant];
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
 W.__task6Probe=null;
 const t6=W.__geometry.solveTask6Graphical(def.task6,{});
 if(!t6?.graphicalConstruction || !W.__task6Probe){
   errors.push(variant+'/6: fall back to incomplete analytic construction');
   continue;
 }
 const {P,Q}=W.__task6Probe;
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
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log('Spatial construction geometry OK: '+variants.length+' task-4 horizontal/frontals and task-6 P/Q plane intersections checked.');
