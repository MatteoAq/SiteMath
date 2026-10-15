// Sequential provenance regression for all 60 graphical tasks (20 variants × 4–6).
// Validates DRAWN support, explanation, and intersection chronology at the point's
// FIRST appearance. This does not certify raster accuracy against original paper.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
const source=fs.readFileSync('multi.js','utf8');
const marker="  $('variantSelect').addEventListener";
const cut=source.indexOf(marker);
assert(cut>0,'UI bootstrap marker missing');
new Function('window','document',source.slice(0,cut)+
  'window.__provenance={solveTask4Scheme,solveTask5Scheme,solveTask6Scheme};})();'
)(W,{getElementById(){return {value:'45'}}});

const onSegment=(point,stroke)=>{
  const dx=stroke.b.x-stroke.a.x,dy=stroke.b.y-stroke.a.y;
  const length=Math.hypot(dx,dy);
  if(length<1e-8)return false;
  const vx=point.x-stroke.a.x,vy=point.y-stroke.a.y;
  const t=(vx*dx+vy*dy)/(length*length);
  const distance=Math.abs(dx*vy-dy*vx)/length;
  return t>=-1e-5&&t<=1+1e-5&&distance<1e-4;
};
const independentDirections=(strokes)=>{
  for(let i=0;i<strokes.length;i++){
    const a=strokes[i],ax=a.b.x-a.a.x,ay=a.b.y-a.a.y;
    for(let j=i+1;j<strokes.length;j++){
      const b=strokes[j],bx=b.b.x-b.a.x,by=b.b.y-b.a.y;
      const denominator=Math.hypot(ax,ay)*Math.hypot(bx,by);
      if(denominator>1e-8&&Math.abs(ax*by-ay*bx)/denominator>1e-5)
        return true;
    }
  }
  return false;
};

const ids=Object.keys(W.SITEMATH_SCHEMES).sort();
assert.equal(ids.length,20,'expected all twenty variants');
let steps=0,points=0,choiceOrProjection=0,intersections=0;
for(const id of ids){
  const schemes=W.SITEMATH_SCHEMES[id];
  for(const task of [4,5,6]){
    const result=W.__provenance['solveTask'+task+'Scheme'](schemes['task'+task],{});
    assert(!result.error,id+'/'+task+': solver failed '+result.error);
    assert(result.steps.length>8,id+'/'+task+': unexpectedly short construction');
    const known=new Set(),strokes=[];
    result.steps.forEach((step,index)=>{
      const tag=id+'/'+task+' step '+(index+1);
      steps++;
      for(const field of ['title','action','why','check'])
        assert(typeof step[field]==='string'&&step[field].trim(),
          tag+': '+field+' missing');
      assert(Array.isArray(step.measure)&&step.measure.length,
        tag+': measure/self-check details missing');
      const now=(step.entities||[]).filter(e=>e.type==='line');
      const drawn=strokes.concat(now);
      for(const point of (step.entities||[]).filter(e=>e.type==='point'&&e.label)){
        if(known.has(point.label))continue;
        known.add(point.label);
        if(index<=1)continue; // given points and the reference axis
        points++;
        const text=[step.title,step.action,step.check,...step.measure].join(' ');
        assert(text.includes(point.label),
          tag+': point '+point.label+' appeared without an explanation');
        const support=drawn.filter(line=>onSegment(point.p,line));
        assert(support.length>0,
          tag+': '+point.label+' is floating: no DRAWN line reaches it');
        // A one-line point is a deliberate free selection or a projected/result
        // endpoint. It must not masquerade as an independently found crossing.
        if(support.length===1){
          choiceOrProjection++;
          assert(/^(Выбери|Построй|Перенеси|По)\b/u.test(step.title)
                 || /^(Выбери|Построй|Перенеси|По) /u.test(step.title),
            tag+': '+point.label+' claims intersection but only one line reaches it');
        }
        // Both K projections in task 5 need TWO nonparallel actual strokes,
        // not merely a vertical projector terminating beyond the printed l/f.
        if(task===5&&/^K[₁₂]$/.test(point.label)){
          intersections++;
          assert(independentDirections(support),
            tag+': '+point.label+' has no extended l/f at the projector crossing');
        }
      }
      strokes.push(...now);
    });
  }
}
assert.equal(steps,1010,'unexpected number of current construction steps');
assert.equal(points,960,'unexpected count of first named point introductions');
assert.equal(intersections,40,'every task-5 K requires both projected intersections');
console.log('TASK 4–6 STEP PROVENANCE OK:',steps,'stages,',points,
  'first named constructed points,',choiceOrProjection,
  'single-line choice/projection endpoints,',intersections,
  'independent drawn task-5 K intersections.');
