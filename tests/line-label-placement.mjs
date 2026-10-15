// Regression for the shared SVG label renderer. Unlike point labels,
// projected line names must sit by the midpoint of the actual stroke.
// Run every graphical task of all 20 variants, including the raw source frames.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
let src=fs.readFileSync('multi.js','utf8');
const cut=src.indexOf("  $('variantSelect').addEventListener");
assert(cut>0,'UI bootstrap boundary changed');
src=src.slice(0,cut)+
 'window.__labelAudit={positionedLineLabel,isProjectedLineLabel,solveTask4Scheme,solveTask5Scheme,solveTask6Scheme};})();';
new Function('window','document',src)(W,{getElementById(){return {value:'45'}}});

const audit=W.__labelAudit;
assert.equal(audit.isProjectedLineLabel('y₁'),false,'axis is not a drawn line label');
assert.equal(audit.isProjectedLineLabel('A₁'),false,'point A₁ is not a line label');
assert.equal(audit.isProjectedLineLabel('h₁'),true,'horizontal label');
assert.equal(audit.isProjectedLineLabel('ЛС₂'),true,'greatest slope label');
assert.equal(audit.isProjectedLineLabel('fΣ₁'),true,'auxiliary line label');
let checked=0,sourceChecked=0;
for(const [variant,scheme] of Object.entries(W.SITEMATH_SCHEMES)){
  for(const task of [4,5,6]){
    const result=task===4?audit.solveTask4Scheme(scheme.task4,{}):
      task===5?audit.solveTask5Scheme(scheme.task5,{}):
      audit.solveTask6Scheme(scheme.task6,{});
    assert(!result.error,variant+'/'+task+': missing geometric drawing');
    result.steps.forEach((step,stepNumber)=>{
      for(const [kind,entities] of [
        ['drawn',step.entities||[]],['raw',step.sourceEntities||[]]
      ]){
        entities.forEach((entity,i)=>{
          if(entity.type!=='text'||!audit.isProjectedLineLabel(entity.label))return;
          const placed=audit.positionedLineLabel(entities,i);
          assert(placed,variant+'/'+task+' step '+stepNumber+
            ' '+kind+' missing associated line for '+entity.label);
          const stroke=entities.slice(0,i).reverse().find(e=>
            e.type==='line'&&e.cls!=='axis'&&
            e.cls!=='source-guide-line'&&!e.arrow);
          assert(stroke,'cannot associate text to a line');
          const dx=stroke.b.x-stroke.a.x,dy=stroke.b.y-stroke.a.y;
          const len=Math.hypot(dx,dy);
          const tx=placed.x-stroke.a.x,ty=placed.y-stroke.a.y;
          const projection=(tx*dx+ty*dy)/(len*len);
          const gap=Math.abs(tx*dy-ty*dx)/len;
          assert(Math.abs(projection-.5)<1e-6,
            variant+'/'+task+'/'+kind+' '+entity.label+
            ' is not at the line midpoint');
          assert(Math.abs(gap-4.1)<1e-6,
            variant+'/'+task+'/'+kind+' '+entity.label+
            ' has an incorrect perpendicular gap');
          // The renderer must not shift a point, a straight line, or
          // its original un-normalized photographed coordinates.
          assert(Number.isFinite(entity.p.x)&&Number.isFinite(entity.p.y),
            'original source-label coordinates not preserved');
          checked++;
          if(kind==='raw')sourceChecked++;
        });
      }
    });
  }
}
assert(checked>800&&sourceChecked>200,
 'not all original and constructed source line labels were tested');
console.log('LINE LABELS OK:',checked,
 'labels centred beside their own strokes, including',sourceChecked,
 'raw source labels across 20 variants; point and axis labels excluded');
