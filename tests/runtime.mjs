import fs from 'node:fs';
import {JSDOM, VirtualConsole} from 'jsdom';

const html = fs.readFileSync('index.html','utf8')
  .replace(/<script[^>]*src="\.\/variants\.js"[^>]*><\/script>/,'')
  .replace(/<script[^>]*src="\.\/multi\.js"[^>]*><\/script>/,'');
const vc = new VirtualConsole();
vc.on('jsdomError', e => { throw e; });
const dom = new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const {window} = dom;

Object.defineProperty(window.SVGElement.prototype,'getTotalLength',{value(){ return 100; }});
const fakeAnimate = function(){ return {onfinish:null,cancel(){},finish(){}}; };
window.Element.prototype.animate = fakeAnimate;
window.print = () => {};

window.eval(fs.readFileSync('variants.js','utf8'));
window.eval(fs.readFileSync('multi.js','utf8'));

const $ = id => window.document.getElementById(id);
const onlyVariant = process.env.ONLY_VARIANT || '';
const onlyTask = Number(process.env.ONLY_TASK || 0);
const variants = [...$('variantSelect').options]
  .map(o=>o.value)
  .filter(v=>v!=='custom')
  .filter(v=>!onlyVariant || v===onlyVariant);
const failures = [];

// Drafting-line semantics are part of correctness: construction/auxiliary lines
// stay thin and solid; only hidden geometry may be dashed; paper grid is not
// displayed in the finished drafting field.
try {
  const css=fs.readFileSync('styles.css','utf8');
  const firstRule=name=>{
    const m=css.match(new RegExp('\\.'+name.replace('-','\\-')+'\\s*\\{([^}]*)\\}','s'));
    return m?m[1]:'';
  };
  const aux=firstRule('aux-line');
  const construction=firstRule('construction-line');
  const hidden=firstRule('hidden-line');
  const gridMinor=firstRule('grid-minor');
  const gridMajor=firstRule('grid-major');
  const dashValue=rule=>{
    const m=rule.match(/stroke-dasharray\s*:\s*([^;]+)/i);
    return m?m[1].trim().toLowerCase():'';
  };
  if(dashValue(aux)!=='none') failures.push('drafting style: auxiliary lines are not solid');
  if(dashValue(construction)!=='none') failures.push('drafting style: construction lines are dashed');
  if(!dashValue(hidden) || dashValue(hidden)==='none') failures.push('drafting style: hidden geometry is not dashed');
  if(!/stroke\s*:\s*transparent/i.test(gridMinor)||!/stroke\s*:\s*transparent/i.test(gridMajor)){
    failures.push('drafting style: background grid is visible');
  }
} catch(e) {
  failures.push('drafting style regression: '+e.stack);
}

if (!onlyVariant && !onlyTask) {
  try {
    if ($('firstRunPicker').hidden) failures.push('first run: chooser is not shown with empty storage');
    if ($('variantSelect').value==='10' && $('taskSelect').value==='1') failures.push('first run: silently defaulted to variant 10 task 1');
    const v13=window.document.querySelector('.first-run-variant[data-variant="13"]');
    const t2=window.document.querySelector('.first-run-task[data-task="2"]');
    if(!v13 || !t2) failures.push('first run: variant/task buttons missing');
    else {
      v13.click(); t2.click();
      if ($('firstRunStart').disabled) failures.push('first run: start remains disabled after both choices');
      $('firstRunStart').click();
      if (!$('firstRunPicker').hidden) failures.push('first run: chooser did not close');
      if ($('variantSelect').value!=='13' || $('taskSelect').value!=='2') failures.push('first run: selected values not applied');
    }
  } catch(e) {
    failures.push('first run chooser: '+e.stack);
  }

  const css=fs.readFileSync('styles.css','utf8');
  if(!css.includes('box-sizing:border-box')) failures.push('layout invariant: border-box missing');
  if(!css.includes('max-width:100vw')) failures.push('layout invariant: viewport max-width missing');
  if(!css.includes('grid-template-columns:40px minmax(68px,1fr) 40px')) failures.push('layout invariant: mobile zoom controls are not constrained');


  for (const id of ['zoomOutBtn','zoomFitBtn','zoom100Btn','zoomInBtn','zoomLabel','mobileSetupBtn','mobileSetupClose','mobileBackdrop','stepSheetToggle','mobilePrevBtn','mobilePlayBtn','mobileNextBtn','mobileTaskSummary']) {
    if (!$(id)) failures.push('mobile control missing: '+id);
  }
  
  try {
    $('mobileSetupBtn').click();
    if (!$('controlsPanel').classList.contains('is-open') || $('mobileBackdrop').hidden) failures.push('mobile setup sheet does not open');
    $('mobileSetupClose').click();
    if ($('controlsPanel').classList.contains('is-open') || !$('mobileBackdrop').hidden) failures.push('mobile setup sheet does not close');
    $('stepSheetToggle').click();
    if (!$('stepSheet').classList.contains('is-expanded')) failures.push('step bottom sheet does not expand');
    $('stepSheetToggle').click();
    if ($('stepSheet').classList.contains('is-expanded')) failures.push('step bottom sheet does not collapse');
  } catch (e) {
    failures.push('mobile shell interaction: '+e.stack);
  }
  
  
}

for (const variant of variants) {
  $('variantSelect').value = variant;
  $('variantSelect').dispatchEvent(new window.Event('change'));
  for (let task=1; task<=6; task++) {
    if (onlyTask && task!==onlyTask) continue;
    try {
      $('taskSelect').value = String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      const total = Number($('stepTotal').textContent);
      const title = $('stepTitle').textContent.trim();
      if (!Number.isFinite(total) || total < 1 || !title) {
        failures.push(variant+'/'+task+': empty solver state');
      }
      if (!$('validation').hidden) {
        failures.push(variant+'/'+task+': '+$('validation').textContent);
      }
      console.log('OK', variant, task, 'steps='+total, title);
    } catch (e) {
      failures.push(variant+'/'+task+': '+e.stack);
    }
  }
}


// Variant ordering / display regression.
try {
  const visible=[...window.document.querySelectorAll('.variant-chip[data-variant]')]
    .filter(b=>b.dataset.variant!=='custom' && b.dataset.variant!=='photo-unknown');
  const keys=visible.map(b=>b.dataset.variant);
  const nums=visible.map(b=>Number(b.querySelector('.variant-number')?.textContent));
  const sorted=[...keys].sort((a,b)=>Number(a)-Number(b));
  if (keys.join(',')!==sorted.join(',')) {
    failures.push('variant order: '+keys.join(','));
  }
  for (let i=0;i<visible.length;i++) {
    if (String(nums[i])!==String(Number(keys[i]))) {
      failures.push('variant display has leading zero or wrong number: '+keys[i]+' -> '+visible[i].textContent.trim());
    }
  }
} catch (e) {
  failures.push('variant ordering/display: '+e.stack);
}

// Visual picker regression: the visible cards must drive the same state as the hidden selects.
try {
  const v05=window.document.querySelector('.variant-chip[data-variant="05"]');
  const task6=window.document.querySelector('.task-choice[data-task="6"]');
  if (!v05 || !task6) {
    failures.push('visual picker: variant 05 or task 6 card missing');
  } else {
    v05.click();
    task6.click();
    if ($('variantSelect').value!=='05' || $('taskSelect').value!=='6') {
      failures.push('visual picker: cards do not sync hidden selects');
    }
    if (!v05.classList.contains('is-selected') || !task6.classList.contains('is-selected')) {
      failures.push('visual picker: selected state is not visible');
    }
  }
} catch (e) {
  failures.push('visual picker: '+e.stack);
}

// Projection drafting regression: axes, coordinate feet and paged explanation must be present.
try {
  $('variantSelect').value = '10';
  $('variantSelect').dispatchEvent(new window.Event('change'));

  $('taskSelect').value = '2';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();
  const t2labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
  for (const expected of ['x','y','z','x₁₂','Π₁','Π₂']) {
    if (!t2labels.includes(expected)) failures.push('task2 axes: missing '+expected);
  }
  $('nextBtn').click();
  const aFoot=window.document.querySelector('circle[data-label="Aₓ"]');
  if (!aFoot) failures.push('task2 helpers: Aₓ foot missing');
  const helperLines=window.document.querySelectorAll('#drawing line.construction-line').length;
  const axisLines=window.document.querySelectorAll('#drawing line.axis').length;
  if (helperLines < 4) failures.push('task2 helpers: expected four coordinate/projector guides, got '+helperLines);
  if (axisLines < 3) failures.push('task2 axes: expected x plus explicit y/z axis rays, got '+axisLines);

  $('taskSelect').value = '1';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();
  const t1labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
  for (const expected of ['x','y₁','y₃','z','Π₁','Π₂','Π₃']) {
    if (!t1labels.includes(expected)) failures.push('task1 axes: missing '+expected);
  }

  const tabs=[...window.document.querySelectorAll('.step-info-tab')];
  if (tabs.length!==3) failures.push('step info: expected 3 guidance tabs, got '+tabs.length);
  const why=tabs.find(b=>b.dataset.stepMode==='why');
  if (!why) failures.push('step info: why tab missing');
  else {
    why.click();
    if (!$('stepInfoText').textContent.trim()) failures.push('step info: why page empty');
    if ($('stepInfoText').textContent.length > 115) failures.push('step info: page too long for compact sheet ('+$('stepInfoText').textContent.length+')');
  }
} catch (e) {
  failures.push('projection helpers / step pages: '+e.stack);
}

// Newly photographed variants 3/6/9 must preserve their source points and line labels.
try {
  const checks={
    '03':{
      4:['a₁','a₂','b₁','b₂','A₁','A₂'],
      5:['a₁','a₂','f₁','f₂','ℓ₁','ℓ₂'],
      6:['A₁','A₂','B₁','B₂','C₁','C₂','a₁','a₂','b₁','b₂','K₁','K₂']
    },
    '06':{
      4:['m₁','m₂','n₁','n₂','D₁','D₂'],
      5:['a₁','a₂','b₁','b₂','ℓ₁','ℓ₂'],
      6:['a₁','a₂','b₁','b₂','A₁','A₂','B₁','B₂','C₁','C₂','K₁','K₂']
    },
    '09':{
      4:['b₁','b₂','A₁','A₂','B₁','B₂'],
      5:['a₁','a₂','b₁','b₂','ℓ₁','ℓ₂'],
      6:['a₁','a₂','b₁','b₂','h₁','h₂','h′₁','h′₂','K₁','K₂']
    }
  };
  for(const [variant,tasks] of Object.entries(checks)){
    for(const [task,expected] of Object.entries(tasks)){
      $('variantSelect').value=variant;
      $('variantSelect').dispatchEvent(new window.Event('change'));
      $('taskSelect').value=task;
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();
      const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
      for(const label of expected){
        if(!labels.includes(label)) failures.push('new source '+variant+'/'+task+': missing '+label);
      }
    }
  }
} catch(e) {
  failures.push('new photographed variants: '+e.stack);
}

// Additional-condition points in task 4 must actually be constructed, not only described.
try {
  const expectedResults={ '03':'B', '06':'A', '09':'E', '12':'A', '18':'A' };
  for(const [variant,name] of Object.entries(expectedResults)){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='4';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('lastBtn').click();
    const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    if(!labels.includes(name+'₁') || !labels.includes(name+'₂')) {
      failures.push('task4 result '+variant+': missing constructed '+name+'₁/'+name+'₂');
    }
  }
} catch(e) {
  failures.push('task4 constructed result points: '+e.stack);
}

// Task 4 intersection conditions: choose one projection of T on an existing
// target, derive the paired projection by a projector, only then draw ℓ.
if (!onlyVariant && !onlyTask) try {
  for(const variant of variants){
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task4;
    const op=scheme?.operation||{};
    if(!['line_intersects_named','line_intersects_frontale','line_intersects_horizontal'].includes(op.type)) continue;

    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='4';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();

    const total=Number($('stepTotal').textContent)||1;
    const frames=[];
    for(let n=0;n<total;n++){
      frames.push({
        title:$('stepTitle').textContent.trim(),
        labels:[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent)
      });
      if(n<total-1) $('nextBtn').click();
    }
    const choose=frames.findIndex(f=>f.title.startsWith('Выбери T'));
    const project=frames.findIndex(f=>f.title.startsWith('По линии связи получи T'));
    const draw=frames.findIndex((f,i)=>i>project && (f.title.startsWith('Соедини ')||f.title.startsWith('Проведи ℓ')) && (f.labels.includes('ℓ₁')||f.labels.includes('ℓ₂')));

    if(choose<0||project<0||draw<0||!(choose<project&&project<draw)){
      failures.push('task4 intersection '+variant+': T -> paired T -> ℓ order missing');
      continue;
    }
    const firstCount=['T₁','T₂'].filter(x=>frames[choose].labels.includes(x)).length;
    if(firstCount!==1){
      failures.push('task4 intersection '+variant+': choice step must contain exactly one T projection');
    }
    if(!frames[project].labels.includes('T₁')||!frames[project].labels.includes('T₂')){
      failures.push('task4 intersection '+variant+': paired T projection missing after projector step');
    }
    if(frames.slice(0,draw).some(f=>f.labels.includes('ℓ₁')||f.labels.includes('ℓ₂'))){
      failures.push('task4 intersection '+variant+': ℓ appears before T₁/T₂ are complete');
    }
    if(!frames[draw].labels.includes('ℓ₁')||!frames[draw].labels.includes('ℓ₂')){
      failures.push('task4 intersection '+variant+': ℓ projections missing after T construction');
    }
  }
} catch(e) {
  failures.push('task4 intersection-point sequence regression: '+e.stack);
}

// Every task-4 result point is new construction data. It must be preceded by
// an explicit helper point N on an already existing line/plane; the answer
// point must not exist while N is only being chosen.
if (!onlyVariant && !onlyTask) try {
  const present=variants;
  for(const variant of present){
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task4;
    const resultName=scheme?.operation?.resultPoint;
    if(!resultName) continue;

    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='4';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();

    const total=Number($('stepTotal').textContent)||1;
    let sawN=false,sawResultAfterN=false;
    for(let n=0;n<total;n++){
      const title=$('stepTitle').textContent.trim();
      const labels=[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent);
      const hasResult=labels.includes(resultName+'₁')||labels.includes(resultName+'₂');

      if(title.startsWith('Выбери вспомогательную точку N')){
        sawN=true;
        if(!labels.includes('N₁')||!labels.includes('N₂')){
          failures.push('task4 result derivation '+variant+': helper N projections missing');
        }
        if(hasResult){
          failures.push('task4 result derivation '+variant+': '+resultName+' appears while N is only being chosen');
        }
      } else if(hasResult){
        if(!sawN){
          failures.push('task4 result derivation '+variant+': '+resultName+' appears before helper N');
        } else {
          sawResultAfterN=true;
        }
      }

      if(n<total-1) $('nextBtn').click();
    }
    if(!sawN) failures.push('task4 result derivation '+variant+': helper N step missing');
    if(!sawResultAfterN) failures.push('task4 result derivation '+variant+': final '+resultName+' missing after N');
  }
} catch(e) {
  failures.push('task4 result-point derivation regression: '+e.stack);
}

// Keep the digitized trace immutable, but render the mathematically valid
// reconstruction of that trace. Camera/pixel skew must not make a printed
// a∥b relation look non-parallel or move a common point off its projector.
try {
  const raw4=window.SITEMATH_SCHEMES?.['12']?.task4?.sourceGeometry;
  const raw6=window.SITEMATH_SCHEMES?.['12']?.task6?.sourceGeometry;
  const cleaned6=window.SITEMATH_SCHEMES?.['12']?.task6;
  if(!raw4||!raw6) failures.push('variant12 raw source: preserved sourceGeometry missing');
  else {
    const a2raw4=raw4.lines?.a?.p2;
    if(!a2raw4 ||
       Math.abs(a2raw4[0][0]-162.309)>1e-9 ||
       Math.abs(a2raw4[0][1]-371.433)>1e-9 ||
       Math.abs(a2raw4[1][0]-351.309)>1e-9 ||
       Math.abs(a2raw4[1][1]-257.433)>1e-9){
      failures.push('variant12 raw source: refined paper trace for task 4 changed');
    }

    const rawA2=raw6.planeA?.lines?.a?.p2;
    const cleanA2=cleaned6.planeA?.lines?.a?.p2;
    if(!rawA2 || rawA2[0][0]!==22 || rawA2[0][1]!==227 || rawA2[1][0]!==305 || rawA2[1][1]!==143){
      failures.push('variant12 raw source: original task 6 a₂ trace changed');
    }
    if(JSON.stringify(rawA2)===JSON.stringify(cleanA2)){
      failures.push('variant12 raw source: task 6 cleanup no longer distinguishable from trace');
    }

    $('variantSelect').value='12';
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='6';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const objects=[...window.document.querySelectorAll('#drawing line.object-line')];
    if(objects.length<8) failures.push('variant12 source reconstruction: task 6 source object lines missing');
    else {
      const a2=objects[0];
      const dx=Number(a2.getAttribute('x2'))-Number(a2.getAttribute('x1'));
      const dy=Number(a2.getAttribute('y2'))-Number(a2.getAttribute('y1'));
      const cleanDx=cleanA2[1][0]-cleanA2[0][0],cleanDy=cleanA2[1][1]-cleanA2[0][1];
      if(Math.abs(dx*cleanDy-dy*cleanDx)>1e-6){
        failures.push('variant12 source reconstruction: rendered a₂ is not the constrained geometry');
      }
    }
    const k1=window.document.querySelector('#drawing circle[data-label="K₁"]');
    const k2=window.document.querySelector('#drawing circle[data-label="K₂"]');
    if(!k1||!k2) failures.push('variant12 source reconstruction: K₁/K₂ missing');
    else {
      const x1=Number(k1.getAttribute('cx')),x2=Number(k2.getAttribute('cx'));
      if(Math.abs(x1-x2)>1e-6){
        failures.push('variant12 source reconstruction: K₁/K₂ are not on one projector');
      }
    }
  }
} catch(e) {
  failures.push('variant12 source-reconstruction regression: '+e.stack);
}

// Variant 12 regression: intersecting defining lines must include their common projector,
// and original named points must remain visible.
try {
  $('variantSelect').value='12';
  $('variantSelect').dispatchEvent(new window.Event('change'));

  $('taskSelect').value='4';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();
  const first4=window.document.querySelectorAll('#drawing .source-guide-line').length;
  const labels4=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
  if(first4<2) failures.push('variant12/task4: missing intersection projector or D projector');
  for(const x of ['a₁','a₂','b₁','b₂','D₁','D₂']) if(!labels4.includes(x)) failures.push('variant12/task4: missing '+x);

  $('taskSelect').value='5';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();
  const labels5=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
  for(const x of ['A₁','A₂','B₁','B₂','C₁','C₂','ℓ₁','ℓ₂']) if(!labels5.includes(x)) failures.push('variant12/task5: missing '+x);

  $('taskSelect').value='6';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();
  const labels6=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
  for(const x of ['a₁','a₂','b₁','b₂','h₁','h₂','f₁','f₂','K₁','K₂']) if(!labels6.includes(x)) failures.push('variant12/task6: missing '+x);
} catch(e) {
  failures.push('variant12 source fidelity: '+e.stack);
}

// Every photographed graphical task must render the exact named source objects,
 // not anonymous substitute strips.
if (!onlyVariant && !onlyTask) try {
  const photographed=variants;

  const sourceDisplayName=name=>name==='l'?'ℓ':name;
  function expectedFromPlaneDef(def,out){
    if(!def) return;
    if(def.lines) for(const name of Object.keys(def.lines)) {
      const shown=sourceDisplayName(name);
      out.push(shown+'₁',shown+'₂');
    }
    if(def.points) for(const name of Object.keys(def.points)) {
      out.push(name+'₁',name+'₂');
    }
    if(def.line) {
      const idx=def.type==='frontal_projecting'?'₂':'₁';
      out.push((def.name||'Π')+idx);
    }
  }

  for(const variant of photographed){
    for(const task of [4,5,6]){
      const scheme=window.SITEMATH_SCHEMES?.[variant]?.['task'+task];
      if(!scheme){
        failures.push('source fidelity '+variant+'/'+task+': scheme missing');
        continue;
      }
      $('variantSelect').value=variant;
      $('variantSelect').dispatchEvent(new window.Event('change'));
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();

      const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
      const expected=[];
      if(task===6){
        expectedFromPlaneDef(scheme.planeA,expected);
        expectedFromPlaneDef(scheme.planeB,expected);
        const k=scheme.pointLabel||'K';
        if(scheme.pointK||scheme.pointThrough) expected.push(k+'₁',k+'₂');
      }else{
        if(scheme.lines) for(const name of Object.keys(scheme.lines)) {
          const shown=sourceDisplayName(name);
          expected.push(shown+'₁',shown+'₂');
        }
        if(scheme.points) for(const name of Object.keys(scheme.points)) expected.push(name+'₁',name+'₂');
      }
      for(const label of [...new Set(expected)]){
        if(!labels.includes(label)) failures.push('source fidelity '+variant+'/'+task+': missing '+label);
      }

      const expectsExplicitJunction = task===6
        ? !!scheme.planeA?.junctions?.length || !!scheme.planeB?.junctions?.length
        : !!scheme.junctions?.length;
      if(expectsExplicitJunction && window.document.querySelectorAll('#drawing .source-guide-line').length===0){
        failures.push('source fidelity '+variant+'/'+task+': explicitly traced source projector missing');
      }
    }
  }
} catch(e) {
  failures.push('general source fidelity: '+e.stack);
}


// First frame of every photographed diagram task must contain only what is
// printed in the source sheet: given geometry plus printed source projectors.
if (!onlyVariant && !onlyTask) try {
  const photographed=variants;
  for(const variant of photographed){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    for(const task of [4,5,6]){
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();
      const roles=[...window.document.querySelectorAll('#drawing [data-role]')].map(n=>n.getAttribute('data-role'));
      const bad=roles.filter(r=>!['given','given-guide'].includes(r));
      if(bad.length) failures.push('source roles '+variant+'/'+task+': solution objects on first frame '+[...new Set(bad)].join(','));
      if(!roles.includes('given')) failures.push('source roles '+variant+'/'+task+': no primary given geometry');
      const hasPrintedGuide=window.document.querySelector('#drawing .source-guide-line, #drawing .source-guide-dot');
      const scheme=window.SITEMATH_SCHEMES?.[variant]?.['task'+task];
      const expectsGuide=task===4
        ? !!(scheme?.points && Object.keys(scheme.points).length) || !!scheme?.junctions?.length
        : task===5
          ? !!(scheme?.points && Object.keys(scheme.points).length) || !!scheme?.junctions?.length
          : !!(scheme?.pointK||scheme?.pointThrough) || !!scheme?.planeA?.points || !!scheme?.planeB?.points || !!scheme?.planeA?.junctions?.length || !!scheme?.planeB?.junctions?.length;
      if(expectsGuide && !hasPrintedGuide) failures.push('source roles '+variant+'/'+task+': printed source guide missing');
    }
  }
} catch(e) {
  failures.push('source frame semantic regression: '+e.stack);
}

// Freeze the raw paper traces for every digitized variant. Solver cleanup,
 // refactors and notation work may change derived geometry, but the copied
 // source sheet is immutable unless that variant is explicitly retraced from
 // its exact original photo.
if (!onlyVariant && !onlyTask) try {
  const expected={
    '03':['1f2c1e40',1018],
    '04':['2f31eb2c',959],
    '05':['0553b07a',1017],
    '06':['4066de66',1006],
    '07':['0d133b97',1015],
    '08':['136f8adf',878],
    '09':['8a351d95',1007],
    '10':['211b3839',978],
    '11':['329d0144',847],
    '12':['468c4cd2',1533],
    '13':['ab2af3bb',1072],
    '14':['5cd244bc',937],
    '15':['aed4e407',902],
    '17':['9048e1aa',1028],
    '18':['6a2632fc',991],
    '19':['b65274bf',1025]
  };
  const skip=new Set(['sourceVerified','sourceAvailable','sourceId','sourceRecheckRequired','sourceGeometry']);
  const canon=value=>{
    if(Array.isArray(value)) return value.map(canon);
    if(value&&typeof value==='object'){
      const out={};
      for(const key of Object.keys(value).filter(k=>!skip.has(k)).sort()) out[key]=canon(value[key]);
      return out;
    }
    return value;
  };
  const fnv=str=>{
    let h=0x811c9dc5;
    for(let i=0;i<str.length;i++){
      h^=str.charCodeAt(i);
      h=Math.imul(h,0x01000193)>>>0;
    }
    return (h>>>0).toString(16).padStart(8,'0');
  };
  for(const variant of variants){
    const group=window.SITEMATH_SCHEMES?.[variant];
    if(!group||!expected[variant]) continue;
    const raw={};
    for(const task of [4,5,6]) raw['task'+task]=canon(group['task'+task]?.sourceGeometry||group['task'+task]);
    const serialized=JSON.stringify(canon(raw));
    const [hash,len]=expected[variant];
    if(serialized.length!==len||fnv(serialized)!==hash){
      failures.push('source fingerprint '+variant+': raw paper trace changed without explicit retrace');
    }
  }
} catch(e) {
  failures.push('source fingerprint regression: '+e.stack);
}

// Variant-specific corrections recovered from the photographed sheets / prior
// review must not drift back to generic templates.
if (!onlyVariant && !onlyTask) try {
  const G=window.SITEMATH_SCHEMES;
  const check=(ok,msg)=>{if(!ok) failures.push('variant contract: '+msg);};

  let q=G['04'];
  check(q?.task4?.planeType==='ABC','04/4 must be Σ(ABC)');
  check(q?.task4?.operation?.type==='line_intersects_horizontal' && q.task4.operation.through==='D','04/4 ℓ must go through D and intersect h');
  check(q?.task6?.planeA?.type==='ABC','04/6 first plane must be ABC');
  check(q?.task6?.planeB?.type==='intersecting_lines' && ['h','f'].every(x=>q.task6.planeB.lines?.[x]),'04/6 second plane must be Θ(h∩f)');
  check(q?.task6?.pointLabel==='M','04/6 through-point must be M');

  q=G['07'];
  check(q?.task4?.planeType==='parallel_lines','07/4 plane must be a∥b');
  check(q?.task4?.operation?.type==='line_parallel_plane' && q.task4.operation.through==='D','07/4 ℓ must be through D and parallel to plane');
  check(q?.task4?.operation?.resultPoint==='A' && q.task4.operation.relation==='above_named' && q.task4.operation.target==='a','07/4 A must be above named line a');

  q=G['08'];
  check(q?.task4?.planeType==='line_point' && q.task4.planeLine==='a' && q.task4.planePoint==='A','08/4 must be Σ(A;a)');
  check(q?.task6?.planeB?.type==='horizontal_projecting' && q.task6.planeB.name==='Δ' && q.task6.planeB.projection==='p1','08/6 second plane must be Δ(Δ₁)');

  q=G['12'];
  check(q?.task4?.planeType==='intersecting_lines' && q.task4.planeLines?.join(',')==='a,b','12/4 must be Σ(a∩b)');
  check(q?.task4?.operation?.type==='line_intersects_named' && q.task4.operation.through==='D' && q.task4.operation.target==='a','12/4 ℓ must go through D and intersect a');
  check(q?.task4?.operation?.resultPoint==='A' && q.task4.operation.relation==='behind_line','12/4 result A must be behind ℓ');
  check(q?.task4?.junctions?.length===1,'12/4 photographed intersection projector missing');
  check(q?.task5?.planeType==='ABC' && q.task5.givenLine==='l','12/5 must be ℓ × Σ(ABC)');
  check(q?.task6?.planeA?.type==='parallel_lines' && ['a','b'].every(x=>q.task6.planeA.lines?.[x]),'12/6 first plane must be Σ(a∥b)');
  check(q?.task6?.planeB?.type==='intersecting_lines' && ['h','f'].every(x=>q.task6.planeB.lines?.[x]),'12/6 second plane must be Θ(h∩f)');

  q=G['13'];
  check(q?.task4?.planeType==='parallel_lines','13/4 plane must be a∥b');
  check(q?.task4?.operation?.type==='line_parallel_horizontal' && q.task4.operation.through==='D','13/4 ℓ must be through D and parallel to horizontal');
  check(q?.task4?.operation?.resultPoint==='A' && q.task4.operation.relation==='above_plane','13/4 A must be above Σ');
  check(q?.task6?.planeA?.type==='intersecting_lines' && q?.task6?.planeB?.type==='line_point','13/6 must be Σ(a∩b) × Θ(A;h)');

  q=G['19'];
  check(q?.task4?.planeType==='intersecting_lines','19/4 plane must be a∩b');
  check(q?.task4?.operation?.type==='line_parallel_plane' && q.task4.operation.through==='B','19/4 ℓ must be through B and parallel to Σ');
  check(q?.task4?.operation?.resultPoint==='A' && q.task4.operation.relation==='front_of_plane','19/4 A must be in front of Σ');
  check(q?.task6?.planeA?.type==='intersecting_lines' && q?.task6?.planeB?.type==='ABC','19/6 must be Σ(a∩b) × Ω(ABC)');
} catch(e) {
  failures.push('variant-specific contract regression: '+e.stack);
}

// Every photographed variant must have a self-consistent graphical schema:
 // operations reference real source objects and both task-6 plane definitions
 // contain enough data for the selected representation.
if (!onlyVariant && !onlyTask) try {
  const photographed=variants;
  for(const variant of photographed){
    const data=window.SITEMATH_DATA?.variants?.[variant];
    const group=window.SITEMATH_SCHEMES?.[variant];
    if(!data||!group){
      failures.push('schema completeness '+variant+': variant/group missing');
      continue;
    }
    for(const task of [4,5,6]){
      const scheme=group['task'+task];
      if(!scheme || !data['task'+task]?.statement){
        failures.push('schema completeness '+variant+'/'+task+': scheme or statement missing');
        continue;
      }
      if(task===4){
        const op=scheme.operation||{};
        if(op.through && !scheme.points?.[op.through]) failures.push('schema completeness '+variant+'/4: through '+op.through+' missing');
        if(op.target && !scheme.lines?.[op.target]) failures.push('schema completeness '+variant+'/4: target '+op.target+' missing');
        if(op.resultPoint && scheme.points?.[op.resultPoint]) failures.push('schema completeness '+variant+'/4: result '+op.resultPoint+' incorrectly stored as source');
      } else if(task===5){
        const given=scheme.givenLine||'l';
        if(!scheme.lines?.[given]) failures.push('schema completeness '+variant+'/5: given line '+given+' missing');
      } else {
        if(!(scheme.pointK||scheme.pointThrough)) failures.push('schema completeness '+variant+'/6: through point missing');
        for(const [side,def] of [['A',scheme.planeA],['B',scheme.planeB]]){
          if(!def){failures.push('schema completeness '+variant+'/6: plane '+side+' missing');continue;}
          if(def.type==='ABC' && !['A','B','C'].every(x=>def.points?.[x])) failures.push('schema completeness '+variant+'/6: plane '+side+' ABC incomplete');
          if(def.type==='line_point'){
            const ln=def.lineName||Object.keys(def.lines||{})[0];
            const pn=def.pointName||Object.keys(def.points||{})[0];
            if(!def.lines?.[ln]||!def.points?.[pn]) failures.push('schema completeness '+variant+'/6: plane '+side+' line_point incomplete');
          }
          if(['parallel_lines','intersecting_lines'].includes(def.type) && Object.keys(def.lines||{}).length<2){
            failures.push('schema completeness '+variant+'/6: plane '+side+' '+def.type+' incomplete');
          }
          if(['frontal_projecting','horizontal_projecting'].includes(def.type) && !def.line){
            failures.push('schema completeness '+variant+'/6: plane '+side+' projecting line missing');
          }
        }
      }
    }
  }
} catch(e) {
  failures.push('schema completeness regression: '+e.stack);
}

// Source-only frames must not contain inferred projectors. The exact number of
// given-guide lines is determined by explicitly stored source points/junctions.
if (!onlyVariant && !onlyTask) try {
  const photographed=variants;
  const guideCountForDef=def=>{
    if(!def)return 0;
    const points=def.points?Object.keys(def.points).length:0;
    const junctions=def.junctions?.length||0;
    return points+junctions;
  };
  for(const variant of photographed){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    for(const task of [4,5,6]){
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();
      const scheme=window.SITEMATH_SCHEMES?.[variant]?.['task'+task];
      const expected=task===6
        ? guideCountForDef(scheme?.planeA)+guideCountForDef(scheme?.planeB)+((scheme?.pointK||scheme?.pointThrough)?1:0)
        : guideCountForDef(scheme);
      const actual=window.document.querySelectorAll('#drawing line.source-guide-line').length;
      if(actual!==expected){
        failures.push('source exact guides '+variant+'/'+task+': expected '+expected+', got '+actual);
      }
    }
  }
} catch(e) {
  failures.push('source exact guide count: '+e.stack);
}

// Diagram tasks 4-6 use a complete two-plane reference frame after the
// source-only step: x12 plus explicit y/z directions. These are construction
// guides and must never leak into the photographed source frame.
if (!onlyVariant && !onlyTask) try {
  const photographed=variants;
  for(const variant of photographed){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    for(const task of [4,5,6]){
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();
      let labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
      for(const axisLabel of ['x₁₂','y','z']){
        if(labels.includes(axisLabel)) failures.push('diagram axes '+variant+'/'+task+': '+axisLabel+' leaked into source frame');
      }
      $('nextBtn').click();
      labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
      for(const axisLabel of ['x₁₂','y','z','Π₁','Π₂']){
        if(!labels.includes(axisLabel)) failures.push('diagram axes '+variant+'/'+task+': missing '+axisLabel);
      }
      const axes=window.document.querySelectorAll('#drawing line.axis[data-role="construction"]').length;
      if(axes<2) failures.push('diagram axes '+variant+'/'+task+': expected horizontal and vertical construction axes, got '+axes);
    }
  }
} catch(e) {
  failures.push('diagram reference axes: '+e.stack);
}

// Construction pedagogy: arbitrary points must be introduced explicitly,
 // never appear together with a later derived intersection.
try {
  $('variantSelect').value='04';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='4';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();        // source
  $('nextBtn').click();         // axes
  $('nextBtn').click();         // choose 1_2
  let labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
  if(!labels.includes('1₂')) failures.push('task4 pedagogy 04: chosen 1₂ missing');
  if(labels.includes('2₂')) failures.push('task4 pedagogy 04: derived 2₂ appears before h₂ is drawn');
  if(labels.includes('h₂')) failures.push('task4 pedagogy 04: h₂ appears in point-choice step');
  $('nextBtn').click();         // draw h2, derive 2_2
  labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
  if(!labels.includes('2₂')||!labels.includes('h₂')) failures.push('task4 pedagogy 04: h₂/2₂ missing after construction');
} catch(e) {
  failures.push('task4 explicit point construction: '+e.stack);
}

// Task 4 must retain the actual plane symbol from the paper. Variants 06 and
// 09 use Δ rather than Σ; generic solver text must not relabel them.
if (!onlyVariant && !onlyTask) try {
  for(const variant of ['06','09']){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='4';
    $('taskSelect').dispatchEvent(new window.Event('change'));

    const brief=($('problemGiven')?.textContent||'')+' '+($('problemFind')?.textContent||'');
    if(!brief.includes('Δ')) failures.push('task4 plane symbol '+variant+': Δ missing from problem brief');

    $('firstBtn').click();
    const total=Number($('stepTotal').textContent)||1;
    let allStepText='';
    for(let n=0;n<total;n++){
      allStepText+=' '+[
        $('stepTitle')?.textContent||'',
        $('stepAction')?.textContent||'',
        $('stepWhy')?.textContent||'',
        $('stepCheck')?.textContent||''
      ].join(' ');
      if(n<total-1) $('nextBtn').click();
    }
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task4;
    if(scheme?.operation?.type==='line_parallel_plane' && !allStepText.includes('Δ')){
      failures.push('task4 plane symbol '+variant+': Δ missing from solver steps');
    }
    if(allStepText.includes('Σ')){
      failures.push('task4 plane symbol '+variant+': generic Σ leaked into Δ variant');
    }
  }
} catch(e) {
  failures.push('task4 plane-symbol regression: '+e.stack);
}

// Task 4: validate the "choose one point, derive the next one" sequence
// across every currently digitized variant, including the separate point+line
// construction path.
if (!onlyVariant && !onlyTask) try {
  const present=variants;
  for(const variant of present){
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task4;
    if(!scheme) continue;

    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='4';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();

    const total=Number($('stepTotal').textContent)||1;
    const frames=[];
    for(let n=0;n<total;n++){
      frames.push({
        title:$('stepTitle').textContent.trim(),
        labels:[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent)
      });
      if(n<total-1) $('nextBtn').click();
    }

    const findTitle=prefix=>frames.findIndex(f=>f.title.startsWith(prefix));
    if(scheme.planeType==='line_point'){
      const pointName=scheme.planePoint||Object.keys(scheme.points||{})[0]||'A';
      const hIdx=findTitle('Горизонталь h: проведи h₂ через '+pointName+'₂');
      if(hIdx<0){
        failures.push('task4 sequence '+variant+': horizontal through source '+pointName+' missing');
      } else if(!frames[hIdx].labels.includes('1₂')){
        failures.push('task4 sequence '+variant+': derived 1₂ missing from horizontal step');
      }

      const chooseF=findTitle('Выбери точку 3₁');
      if(chooseF<0){
        failures.push('task4 sequence '+variant+': explicit frontal seed 3₁ missing');
      } else {
        if(frames[chooseF].labels.includes('2₁')) failures.push('task4 sequence '+variant+': 2₁ appears before f₁ is drawn');
        const next=frames[chooseF+1];
        if(!next || !next.title.startsWith('Через 3₁ проведи f₁')){
          failures.push('task4 sequence '+variant+': f₁ construction does not follow chosen 3₁');
        } else if(!next.labels.includes('2₁')||!next.labels.includes('f₁')){
          failures.push('task4 sequence '+variant+': derived 2₁/f₁ missing');
        }
      }
    } else {
      const chooseH=findTitle('Выбери точку 1₂');
      if(chooseH<0){
        failures.push('task4 sequence '+variant+': explicit horizontal seed 1₂ missing');
      } else {
        if(frames[chooseH].labels.includes('2₂')||frames[chooseH].labels.includes('h₂')){
          failures.push('task4 sequence '+variant+': h₂/2₂ exists before horizontal is constructed');
        }
        const next=frames[chooseH+1];
        if(!next || !next.title.startsWith('Через 1₂ проведи h₂')){
          failures.push('task4 sequence '+variant+': h₂ construction does not follow chosen 1₂');
        } else if(!next.labels.includes('2₂')||!next.labels.includes('h₂')){
          failures.push('task4 sequence '+variant+': derived 2₂/h₂ missing');
        }
      }

      const chooseF=findTitle('Выбери точку 3₁');
      if(chooseF<0){
        failures.push('task4 sequence '+variant+': explicit frontal seed 3₁ missing');
      } else {
        if(frames[chooseF].labels.includes('4₁')||frames[chooseF].labels.includes('f₁')){
          failures.push('task4 sequence '+variant+': f₁/4₁ exists before frontal is constructed');
        }
        const next=frames[chooseF+1];
        if(!next || !next.title.startsWith('Через 3₁ проведи f₁')){
          failures.push('task4 sequence '+variant+': f₁ construction does not follow chosen 3₁');
        } else if(!next.labels.includes('4₁')||!next.labels.includes('f₁')){
          failures.push('task4 sequence '+variant+': derived 4₁/f₁ missing');
        }
      }
    }
  }
} catch(e) {
  failures.push('task4 all-variant point-sequence regression: '+e.stack);
}

// Generic task-4 greatest-slope construction must not fall back to an
// analytically drawn line whose seed point appears in the same step.
if (!onlyVariant && !onlyTask) try {
  const present=variants;
  for(const variant of present){
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task4;
    if(!scheme || scheme.planeType==='line_point') continue;
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='4';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const titles=[];
    const total=Number($('stepTotal').textContent)||1;
    for(let n=0;n<total;n++){
      titles.push($('stepTitle').textContent.trim());
      if(n<total-1) $('nextBtn').click();
    }
    if(!titles.includes('Выбери точку S₁ на h₁')){
      failures.push('task4 pedagogy '+variant+': greatest-slope seed S₁ is not introduced in a separate step');
    }
    if(titles.includes('Построй линию наибольшего ската ЛС₁')){
      failures.push('task4 pedagogy '+variant+': analytic greatest-slope fallback is still exposed');
    }
  }
} catch(e) {
  failures.push('task4 greatest-slope explicit-seed regression: '+e.stack);
}

// A task-6 plane given by point+line must build its second in-plane line
// without assigning both projections of T at once.
try {
  $('variantSelect').value='13';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='6';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();

  const total=Number($('stepTotal').textContent)||1;
  const frames=[];
  for(let n=0;n<total;n++){
    frames.push({
      title:$('stepTitle').textContent.trim(),
      labels:[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent)
    });
    if(n<total-1) $('nextBtn').click();
  }
  const choose=frames.findIndex(f=>f.title.startsWith('Выбери T₁'));
  const project=frames.findIndex(f=>f.title.startsWith('По линии связи получи T₂'));
  const join=frames.findIndex(f=>f.title.startsWith('Соедини A с T'));
  if(choose<0||project<0||join<0||!(choose<project&&project<join)){
    failures.push('task6 line-point helper 13: T₁ -> T₂ -> AT order missing');
  } else {
    if(!frames[choose].labels.includes('T₁')||frames[choose].labels.includes('T₂')){
      failures.push('task6 line-point helper 13: T₂ appears while only T₁ is chosen');
    }
    if(!frames[project].labels.includes('T₂')){
      failures.push('task6 line-point helper 13: projected T₂ missing');
    }
    for(const x of ['AT₁','AT₂']){
      if(!frames[join].labels.includes(x)) failures.push('task6 line-point helper 13: missing '+x);
    }
    if(frames.slice(0,join).some(f=>f.labels.includes('AT₁')||f.labels.includes('AT₂'))){
      failures.push('task6 line-point helper 13: AT appears before T₁/T₂ are complete');
    }
  }
} catch(e) {
  failures.push('task6 line-point helper regression: '+e.stack);
}

// Printed task-5 source uses script ell. Internal key "l" must never leak
// into the visible source frame or role summary.
if (!onlyVariant && !onlyTask) try {
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='5';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    if(!labels.includes('ℓ₁')||!labels.includes('ℓ₂')){
      failures.push('task5 line notation '+variant+': ℓ₁/ℓ₂ missing from source frame');
    }
    if(labels.includes('l₁')||labels.includes('l₂')){
      failures.push('task5 line notation '+variant+': internal Latin l leaked into source frame');
    }
  }
} catch(e) {
  failures.push('task5 line-notation regression: '+e.stack);
}

// Task 5 must expose the complete manual construction order in every
// digitized variant: Ω first, then section points 1/2, then m and K, then
// competing points, and only after that the final visibility strokes.
if (!onlyVariant && !onlyTask) try {
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='5';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();

    const total=Number($('stepTotal').textContent)||1;
    let sawOmega=false,saw12=false,sawK=false,saw34=false,saw56=false,sawVisibility=false;
    for(let n=0;n<total;n++){
      const title=$('stepTitle').textContent.trim();
      const labels=[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent);

      if(title.startsWith('Заключи ℓ во вспомогательную')){
        sawOmega=true;
        if(labels.some(x=>/^1[₁₂]$|^2[₁₂]$|^K[₁₂]$/.test(x))){
          failures.push('task5 sequence '+variant+': derived points exist while Ω is only introduced');
        }
      }
      if(title.startsWith('Найди 1')){
        if(!sawOmega) failures.push('task5 sequence '+variant+': section points 1/2 before Ω');
        if(!labels.some(x=>/^1[₁₂]$/.test(x))||!labels.some(x=>/^2[₁₂]$/.test(x))){
          failures.push('task5 sequence '+variant+': section points 1/2 missing on derivation step');
        }
        if(labels.some(x=>/^K[₁₂]$/.test(x))) failures.push('task5 sequence '+variant+': K appears before m');
        saw12=true;
      }
      if(title.startsWith('Построй m')){
        if(!saw12) failures.push('task5 sequence '+variant+': m/K before section points 1/2');
        if(!labels.some(x=>/^K[₁₂]$/.test(x))) failures.push('task5 sequence '+variant+': first K projection missing');
        sawK=true;
      }
      if(title.startsWith('Видимость на Π₁')){
        if(!sawK) failures.push('task5 sequence '+variant+': competing 3/4 before K');
        for(const x of ['3₁≡4₁','3₂','4₂']) if(!labels.includes(x)) failures.push('task5 sequence '+variant+': missing '+x);
        saw34=true;
      }
      if(title.startsWith('Видимость на Π₂')){
        if(!sawK) failures.push('task5 sequence '+variant+': competing 5/6 before K');
        for(const x of ['5₂≡6₂','5₁','6₁']) if(!labels.includes(x)) failures.push('task5 sequence '+variant+': missing '+x);
        saw56=true;
      }
      if(title.startsWith('Нанеси видимость ℓ')){
        if(!saw34||!saw56) failures.push('task5 sequence '+variant+': final visibility drawn before both competing-point constructions');
        sawVisibility=true;
      }

      if(n<total-1) $('nextBtn').click();
    }
    if(!sawOmega||!saw12||!sawK||!saw34||!saw56||!sawVisibility){
      failures.push('task5 sequence '+variant+': incomplete Ω/1-2/K/3-4/5-6/visibility chain');
    }
  }
} catch(e) {
  failures.push('task5 all-variant construction sequence regression: '+e.stack);
}

// Once task 5 visibility is established, the unbroken given ℓ must not
// remain behind the dashed occluded segments. Preserve ℓ until that moment.
if (!onlyVariant && !onlyTask) try {
  for (const variant of variants) {
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='5';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const source=()=>[...window.document.querySelectorAll('#drawing line[data-source-given-line="1"]')];
    if(source().length!==2){
      failures.push('task5 occlusion '+variant+': original ℓ should have two source projections');
    }
    $('lastBtn').click();
    if(source().length!==0){
      failures.push('task5 occlusion '+variant+': original solid ℓ survives behind final visibility');
    }
    const hidden=[...window.document.querySelectorAll('#drawing line.hidden-line')];
    if(hidden.length<1){
      failures.push('task5 occlusion '+variant+': no hidden segment in final visibility result');
    }
    if(hidden.some(line=>line.style.strokeDasharray)){
      failures.push('task5 occlusion '+variant+': line animation replaced dashed stroke pattern');
    }
    const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    if(!labels.includes('ℓ₁')||!labels.includes('ℓ₂')){
      failures.push('task5 occlusion '+variant+': given-line labels disappeared');
    }
    $('prevBtn').click();
    if(source().length!==2){
      failures.push('task5 occlusion '+variant+': stepping back did not restore the given line');
    }
  }
} catch (e) {
  failures.push('task5 occlusion regression: '+e.stack);
}

// Task 5 visibility must be demonstrated by actual competing points, not
// assigned analytically with no construction on the sheet.
if (!onlyVariant && !onlyTask) try {
  const photographed=variants;
  for(const variant of photographed){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='5';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('lastBtn').click();
    const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    for(const x of ['3₁≡4₁','3₂','4₂','5₂≡6₂','5₁','6₁']){
      if(!labels.includes(x)) failures.push('task5 competing points '+variant+': missing '+x);
    }
  }
} catch(e) {
  failures.push('task5 competing-points regression: '+e.stack);
}

// Task 6: the arbitrary auxiliary level, section anchor points and paired
// projections must appear in construction order before the common point P.
try {
  $('variantSelect').value='04';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='6';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();

  const total=Number($('stepTotal').textContent)||1;
  const frames=[];
  for(let n=0;n<total;n++){
    frames.push({
      title:$('stepTitle').textContent.trim(),
      labels:[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent)
    });
    if(n<total-1) $('nextBtn').click();
  }
  const idx=prefix=>frames.findIndex(f=>f.title.startsWith(prefix));
  const alpha=idx('Выбери вспомогательную плоскость α');
  const aPrimary=frames.findIndex(f=>f.title.startsWith('На α')&&f.title.includes('1')&&f.title.includes('2'));
  const aPaired=idx('Перенеси 1');
  const bPrimary=frames.findIndex(f=>f.title.startsWith('На α')&&f.title.includes('3')&&f.title.includes('4'));
  const bPaired=idx('Перенеси 3');
  const p=frames.findIndex(f=>f.title.startsWith('Пересеки линии сечения α')&&f.title.includes('P'));

  if(alpha<0) failures.push('task6 pedagogy 04: auxiliary alpha level missing');
  if([aPrimary,aPaired,bPrimary,bPaired,p].some(x=>x<0)){
    failures.push('task6 pedagogy 04: incomplete 1/2 -> 3/4 -> P construction chain');
  } else {
    if(!(alpha<aPrimary && aPrimary<aPaired && aPaired<bPrimary && bPrimary<bPaired && bPaired<p)){
      failures.push('task6 pedagogy 04: alpha section construction order is wrong');
    }
    for(const n of [1,2]){
      if(!frames[aPrimary].labels.includes(String(n)+'₂')) failures.push('task6 pedagogy 04: missing '+n+'₂ on primary alpha/Σ step');
      if(frames[aPrimary].labels.includes(String(n)+'₁')) failures.push('task6 pedagogy 04: paired '+n+'₁ appears too early');
      if(!frames[aPaired].labels.includes(String(n)+'₁')) failures.push('task6 pedagogy 04: missing paired '+n+'₁');
    }
    for(const n of [3,4]){
      if(!frames[bPrimary].labels.includes(String(n)+'₂')) failures.push('task6 pedagogy 04: missing '+n+'₂ on primary alpha/Θ step');
      if(frames[bPrimary].labels.includes(String(n)+'₁')) failures.push('task6 pedagogy 04: paired '+n+'₁ appears too early');
      if(!frames[bPaired].labels.includes(String(n)+'₁')) failures.push('task6 pedagogy 04: missing paired '+n+'₁');
    }
    if(frames.slice(0,p).some(f=>f.labels.includes('P₁')||f.labels.includes('P₂'))){
      failures.push('task6 pedagogy 04: P appears before both section lines are complete');
    }
    if(!frames[p].labels.includes('P₁')||!frames[p].labels.includes('P₂')){
      failures.push('task6 pedagogy 04: P missing after both section lines');
    }
  }
} catch(e) {
  failures.push('task6 explicit auxiliary-level regression: '+e.stack);
}

// Every currently digitized variant must introduce alpha/beta auxiliary
// planes before the corresponding common points P/Q. This catches "point from
// nowhere" regressions beyond the single variant used in the focused test.
if (!onlyVariant && !onlyTask) try {
  const present=variants;
  for(const variant of present){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='6';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();

    const total=Number($('stepTotal').textContent)||1;
    const seen={alpha:false,beta:false,p:false,q:false};
    for(let n=0;n<total;n++){
      const title=$('stepTitle').textContent.trim();
      const labels=[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent);

      if(title==='Выбери вспомогательную плоскость α'){
        seen.alpha=true;
        if(labels.includes('P₁')||labels.includes('P₂')){
          failures.push('task6 pedagogy '+variant+': P exists while alpha is only being chosen');
        }
      }
      if(title.includes('получи P')){
        if(!seen.alpha) failures.push('task6 pedagogy '+variant+': P constructed before alpha');
        if(!labels.includes('P₁')||!labels.includes('P₂')){
          failures.push('task6 pedagogy '+variant+': P projections missing on derivation step');
        }
        seen.p=true;
      }
      if(title==='Выбери вспомогательную плоскость β'){
        seen.beta=true;
        if(labels.includes('Q₁')||labels.includes('Q₂')){
          failures.push('task6 pedagogy '+variant+': Q exists while beta is only being chosen');
        }
      }
      if(title.includes('получи Q')){
        if(!seen.beta) failures.push('task6 pedagogy '+variant+': Q constructed before beta');
        if(!labels.includes('Q₁')||!labels.includes('Q₂')){
          failures.push('task6 pedagogy '+variant+': Q projections missing on derivation step');
        }
        seen.q=true;
      }

      if(n<total-1) $('nextBtn').click();
    }
    if(!seen.alpha||!seen.beta||!seen.p||!seen.q){
      failures.push('task6 pedagogy '+variant+': incomplete alpha/P/beta/Q construction sequence');
    }
  }
} catch(e) {
  failures.push('task6 all-variant auxiliary sequence regression: '+e.stack);
}

// Task 6: the final parallel line through the given point may only appear
// after r = P Q has actually been constructed.
if (!onlyVariant && !onlyTask) try {
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='6';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();

    const total=Number($('stepTotal').textContent)||1;
    let sawR=false,sawFinal=false;
    for(let n=0;n<total;n++){
      const title=$('stepTitle').textContent.trim();
      const labels=[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent);
      const hasR=labels.includes('r₁')||labels.includes('r₂');
      const hasL=labels.includes('ℓ₁')||labels.includes('ℓ₂');

      if(title.startsWith('Соедини P и Q')){
        if(!labels.includes('r₁')||!labels.includes('r₂')){
          failures.push('task6 final direction '+variant+': r projections missing');
        }
        if(hasL) failures.push('task6 final direction '+variant+': ℓ appears in r-construction step');
        sawR=true;
      }
      if(title.startsWith('Через ') && title.includes('проведи ℓ')){
        if(!sawR) failures.push('task6 final direction '+variant+': ℓ constructed before r');
        if(!labels.includes('ℓ₁')||!labels.includes('ℓ₂')){
          failures.push('task6 final direction '+variant+': final ℓ projections missing');
        }
        sawFinal=true;
      }

      if(n<total-1) $('nextBtn').click();
    }
    if(!sawR||!sawFinal) failures.push('task6 final direction '+variant+': incomplete r then ℓ chain');
  }
} catch(e) {
  failures.push('task6 final-direction sequence regression: '+e.stack);
}

// Task 6 auxiliary-section anchors are part of the construction, not hidden
// solver data. Every non-projecting plane contributes two traced section points
// for alpha and two for beta; their paired projections must remain visible.
if (!onlyVariant && !onlyTask) try {
  const isProjecting=def=>['frontal_projecting','horizontal_projecting'].includes(def?.type);
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='6';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('lastBtn').click();

    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task6;
    const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    const expected=[];
    if(!isProjecting(scheme?.planeA)) expected.push('1','2','5','6');
    if(!isProjecting(scheme?.planeB)) expected.push('3','4','7','8');
    for(const n of expected){
      for(const idx of ['₁','₂']){
        const label=n+idx;
        if(!labels.includes(label)){
          failures.push('task6 auxiliary anchors '+variant+': missing '+label);
        }
      }
    }
  }
} catch(e) {
  failures.push('task6 auxiliary anchor labels: '+e.stack);
}

// Every photographed task 4 must show the real construction path. For a plane
// defined by a point and a line, keep the teacher's 1-2-3-4 sequence instead of
// inventing a second source line. Task 6 must keep both auxiliary projections.
if (!onlyVariant && !onlyTask) try {
  const photographed=variants;
  const genericLabels=['1₂','2₂','1₁','2₁','3₁','4₁','3₂','4₂','S₁','S₂','ЛС₁','ЛС₂'];
  const linePointLabels=['1₂','1₁','2₁','3₁','2₂','3₂','4₁','4₂','ЛС₁','ЛС₂'];
  for(const variant of photographed){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));

    $('taskSelect').value='4';
    $('taskSelect').dispatchEvent(new window.Event('change'));

    // Step 1 is source-only: no solution line may be mixed into the printed givens.
    $('firstBtn').click();
    if(window.document.querySelectorAll('#drawing line[data-role="result"]').length){
      failures.push('task4 roles '+variant+': result mixed into source step');
    }
    if(!window.document.querySelectorAll('#drawing line[data-role="given"]').length){
      failures.push('task4 roles '+variant+': source has no given lines');
    }

    // Next step introduces x12 as a construction reference, not source geometry.
    $('nextBtn').click();
    let labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    if(!labels.includes('x₁₂')) failures.push('task4 axis '+variant+': x₁₂ missing');
    const xAxis=window.document.querySelector('#drawing line.axis[data-role="construction"]');
    if(!xAxis) failures.push('task4 axis '+variant+': x₁₂ is not classified as construction');

    $('lastBtn').click();
    labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task4;
    const expected=scheme?.planeType==='line_point'?linePointLabels:genericLabels;
    for(const label of expected){
      if(!labels.includes(label)) failures.push('task4 construction '+variant+': missing '+label);
    }
    if(scheme?.planeType==='line_point' && (labels.includes('g₁')||labels.includes('g₂'))){
      failures.push('task4 teacher sequence '+variant+': unnecessary helper g returned');
    }
    if(window.document.querySelectorAll('#drawing line.construction-line').length<6){
      failures.push('task4 construction '+variant+': too few projector/helper lines');
    }
    if(!window.document.querySelectorAll('#drawing line[data-role="result"]').length){
      failures.push('task4 roles '+variant+': no result lines');
    }

    $('taskSelect').value='6';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('lastBtn').click();
    const task6=window.SITEMATH_SCHEMES?.[variant]?.task6;
    const hasProjecting=[task6?.planeA?.type,task6?.planeB?.type].some(type=>type==='frontal_projecting'||type==='horizontal_projecting');
    const minProjectors=hasProjecting?4:8;
    if(window.document.querySelectorAll('#drawing line.construction-line').length<minProjectors){
      failures.push('task6 construction '+variant+': too few projector/helper lines');
    }
    if(window.document.querySelectorAll('#drawing line.aux-line').length<4){
      failures.push('task6 construction '+variant+': both auxiliary section projections are not visible');
    }
    const labels6=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    for(const label of ['P₁','P₂','Q₁','Q₂','r₁','r₂']){
      if(!labels6.includes(label)) failures.push('task6 construction '+variant+': missing '+label);
    }
    const through=task6?.pointLabel||'K';
    if(!labels6.includes('ℓ₁')||!labels6.includes('ℓ₂')){
      failures.push('task6 construction '+variant+': final parallel line through '+through+' missing');
    }
  }
} catch(e) {
  failures.push('global graphical construction regression: '+e.stack);
}

// Task 6 must keep each variant's actual plane symbols. The second plane can
// be Β, Ω, Δ or Γ; silently relabeling everything as Θ changes the source.
if (!onlyVariant && !onlyTask) try {
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='6';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('lastBtn').click();

    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task6;
    const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    for(const [side,def,fallback] of [['A',scheme?.planeA,'Σ'],['B',scheme?.planeB,'Θ']]){
      const symbol=def?.name||fallback;
      const hasSectionLabel=labels.some(x=>
        x==='h'+symbol+'₁'||x==='h'+symbol+'₂'||
        x==='f'+symbol+'₁'||x==='f'+symbol+'₂'
      );
      if(!hasSectionLabel){
        failures.push('task6 plane symbol '+variant+'/'+side+': section label for '+symbol+' missing');
      }
    }
  }

  const expectedBriefs={
    '11':['Σ(a∥b)','Γ(Γ₂)'],
    '14':['Σ(a∩b)','Ω(Ω₁)'],
    '15':['Σ(Σ₂)','Θ(ABC)']
  };
  for(const [variant,parts] of Object.entries(expectedBriefs)){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='6';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    const text=($('problemGiven')?.textContent||'')+' '+($('problemFind')?.textContent||'');
    for(const part of parts){
      if(!text.includes(part)) failures.push('task6 plane notation '+variant+': missing '+part);
    }
  }
} catch(e) {
  failures.push('task6 plane-symbol regression: '+e.stack);
}

// Auxiliary construction is part of the answer, not disposable UI decoration.
 // Step 1 must stay source-only; by the final step each graphical task must
 // retain the projectors/auxiliary sections that explain how the result was built.
if (!onlyVariant && !onlyTask) try {
  const photographed=variants;
  for(const variant of photographed){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    for(const task of [4,5,6]){
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();

      const sourceConstruction=window.document.querySelectorAll('#drawing line.construction-line').length;
      const sourceAux=window.document.querySelectorAll('#drawing line.aux-line').length;
      if(sourceConstruction!==0 || sourceAux!==0){
        failures.push('auxiliary construction '+variant+'/'+task+': solution helpers leaked into source frame');
      }

      $('lastBtn').click();
      const construction=window.document.querySelectorAll('#drawing line.construction-line').length;
      const aux=window.document.querySelectorAll('#drawing line.aux-line').length;
      const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);

      if(task===4){
        if(construction<6) failures.push('auxiliary construction '+variant+'/4: too few projector/helper lines ('+construction+')');
      } else if(task===5){
        if(construction<3) failures.push('auxiliary construction '+variant+'/5: too few projection-transfer lines ('+construction+')');
        if(aux<2) failures.push('auxiliary construction '+variant+'/5: Ω/m auxiliary lines missing ('+aux+')');
        const hasPrimary1=labels.includes('Ω₁≡ℓ₁')&&labels.includes('m₂');
        const hasPrimary2=labels.includes('Ω₂≡ℓ₂')&&labels.includes('m₁');
        if(!hasPrimary1&&!hasPrimary2){
          failures.push('auxiliary construction '+variant+'/5: neither valid Ω/m auxiliary projection pair is present');
        }
        for(const label of ['K₁','K₂']){
          if(!labels.includes(label)) failures.push('auxiliary construction '+variant+'/5: missing '+label);
        }
      } else {
        const task6=window.SITEMATH_SCHEMES?.[variant]?.task6;
        const hasProjecting=[task6?.planeA?.type,task6?.planeB?.type].some(type=>type==='frontal_projecting'||type==='horizontal_projecting');
        const minProjectors=hasProjecting?4:8;
        if(construction<minProjectors) failures.push('auxiliary construction '+variant+'/6: too few projector/helper lines ('+construction+')');
        if(aux<4) failures.push('auxiliary construction '+variant+'/6: two auxiliary section constructions are incomplete ('+aux+')');
      }
    }
  }
} catch(e) {
  failures.push('auxiliary construction regression: '+e.stack);
}

// Tasks 4-6 expose the source statement as a compact Given/Find block.
if (!onlyVariant && !onlyTask) try {
  for(const variant of ['03','08','12','18']){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    for(const task of [4,5,6]){
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      if($('problemBrief').hidden) failures.push('problem brief '+variant+'/'+task+': hidden');
      if(!$('problemGiven').textContent.trim()) failures.push('problem brief '+variant+'/'+task+': Given empty');
      if(!$('problemFind').textContent.trim()) failures.push('problem brief '+variant+'/'+task+': Find empty');
    }
  }
  $('variantSelect').value='08';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='4';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  if(!$('problemFind').textContent.includes('ЛС')) failures.push('problem brief task4: greatest-slope line missing');
} catch(e) {
  failures.push('problem brief regression: '+e.stack);
}

// Tasks 4-6 must carry an explicit warning to compare the construction with the original sheet.
if (!onlyVariant && !onlyTask) try {
  $('variantSelect').value='12';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  for(const task of [1,2,3]){
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    if(!$('diagramWarning').hidden) failures.push('diagram warning: unexpectedly visible for task '+task);
  }
  for(const task of [4,5,6]){
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    if($('diagramWarning').hidden) failures.push('diagram warning: hidden for task '+task);
    const text=$('diagramWarning').textContent;
    if(!text.includes('оригинал')) failures.push('diagram warning '+task+': original-sheet instruction missing');
    if(!text.includes('ошиб')) failures.push('diagram warning '+task+': possible-error notice missing');
  }
} catch(e) {
  failures.push('diagram warning regression: '+e.stack);
}

// Source-role text must not turn a one-projection plane into a fictitious pair,
// and source verification status must reflect what can actually be rechecked now.
if (!onlyVariant && !onlyTask) try {
  $('variantSelect').value='11';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='6';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  let sourceText=$('dynamicInputs').textContent;
  if(!sourceText.includes('Γ₂')) failures.push('source roles 11/6: Γ₂ missing');
  if(sourceText.includes('Γ₁/Γ₂')) failures.push('source roles 11/6: frontal-projecting plane falsely shown as two projections');

  $('variantSelect').value='08';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='6';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  sourceText=$('dynamicInputs').textContent;
  if(!sourceText.includes('Δ₁')) failures.push('source roles 08/6: Δ₁ missing');
  if(sourceText.includes('Δ₁/Δ₂')) failures.push('source roles 08/6: horizontal-projecting plane falsely shown as two projections');

  $('variantSelect').value='12';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='4';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  if(!$('dynamicInputs').textContent.includes('IMG_20260917_131638')) failures.push('source status 12: exact source id missing');

  $('variantSelect').value='03';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='4';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  if(!$('dynamicInputs').textContent.includes('недоступен')) failures.push('source status 03: unavailable recheck not disclosed');
} catch(e) {
  failures.push('source role/status regression: '+e.stack);
}

// Intermediate geometry must stay visually/semantically auxiliary.
if (!onlyVariant && !onlyTask) try {
  $('variantSelect').value='12';
  $('variantSelect').dispatchEvent(new window.Event('change'));

  $('taskSelect').value='5';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('lastBtn').click();
  for(const label of ['1₁','1₂','2₁','2₂']){
    const p=window.document.querySelector('#drawing circle[data-label="'+label+'"]');
    if(!p || p.dataset.role!=='construction') failures.push('task5 roles: '+label+' is not construction');
  }
  for(const label of ['K₁','K₂']){
    const p=window.document.querySelector('#drawing circle[data-label="'+label+'"]');
    if(!p || p.dataset.role!=='result') failures.push('task5 roles: '+label+' is not result');
  }
  if(window.document.querySelectorAll('#drawing line.aux-line[data-role="auxiliary"]').length<2){
    failures.push('task5 roles: Ω/m auxiliary lines not classified as auxiliary');
  }

  $('taskSelect').value='6';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('lastBtn').click();
  for(const label of ['P₁','P₂','Q₁','Q₂']){
    const p=window.document.querySelector('#drawing circle[data-label="'+label+'"]');
    if(!p || p.dataset.role!=='construction') failures.push('task6 roles: '+label+' is not construction');
  }
} catch(e) {
  failures.push('intermediate-role regression: '+e.stack);
}

// Variant 18 is now confirmed by a photographed sheet explicitly labeled "В. 18".
try {
  const v18=window.SITEMATH_DATA.variants['18'];
  if(!v18) failures.push('variant18: confirmed variant missing');
  if(v18 && v18.provisionalNumber) failures.push('variant18: still incorrectly marked provisional');
  if(window.SITEMATH_DATA.variants['photo-unknown']) failures.push('variant18: old photo-unknown key still exists');
} catch(e) {
  failures.push('variant18 mapping: '+e.stack);
}

// Regression: coordinate drawings use the visible 5 mm paper grid as the actual metric grid.
try {
  $('variantSelect').value = '10';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value = '2';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('lastBtn').click();

  const onGrid = value => {
    const v=Number(value);
    const r=((v%5)+5)%5;
    return r<1e-6 || Math.abs(r-5)<1e-6;
  };
  for (const label of ['O','A₁','A₂','B₁','B₂']) {
    const p=window.document.querySelector('circle[data-label="'+label+'"]');
    if (!p) {
      failures.push('grid regression: point '+label+' missing');
      continue;
    }
    if (!onGrid(p.getAttribute('cx')) || !onGrid(p.getAttribute('cy'))) {
      failures.push('grid regression: '+label+' is off 5 mm grid at '+p.getAttribute('cx')+','+p.getAttribute('cy'));
    }
  }
} catch (e) {
  failures.push('grid regression: '+e.stack);
}

// Custom-data UI smoke test, including the profile-line special case in task 3.
if (!onlyVariant && !onlyTask) try {
  $('variantSelect').value = 'custom';
  $('variantSelect').dispatchEvent(new window.Event('change'));

  for (let task=1; task<=6; task++) {
    $('taskSelect').value = String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    if (task <= 3) {
      const inputs = [...window.document.querySelectorAll('.coord-input')];
      if (!inputs.length) failures.push('custom/'+task+': coordinate editor missing');
    } else {
      for (const id of ['schemeImage','cropControls','autoCrop','manualCrop','wholeCrop','applyCrop','markControls','startMarking','undoMark','finishMarking','photoZoomOut','photoZoomFit','photoZoomIn','calibrationCanvas']) {
        if (!$(id)) failures.push('custom/'+task+': control missing '+id);
      }
    }
  }

  $('taskSelect').value = '3';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  const setCoord = (point,axis,value) => {
    const el = window.document.querySelector('.coord-input[data-point="'+point+'"][data-axis="'+axis+'"]');
    el.value = String(value);
  };
  setCoord('A','x',20); setCoord('A','y',10); setCoord('A','z',0);
  setCoord('B','x',20); setCoord('B','y',50); setCoord('B','z',60);
  setCoord('C','x',55); setCoord('C','y',20); setCoord('C','z',30);
  $('buildBtn').click();
  if (!$('validation').hidden) failures.push('custom/3 profile case: '+$('validation').textContent);
  if (!$('stepTitle').textContent.includes('Проведи') && Number($('stepTotal').textContent) < 8) {
    failures.push('custom/3 profile case: solver did not build expected steps');
  }
  console.log('OK custom editors and task 3 profile-line case');
} catch (e) {
  failures.push('custom smoke: '+e.stack);
}

// Declared source-plane relations are mathematical constraints, not merely
// captions. Parallel source lines must remain parallel in both projections;
 // intersecting source lines must meet on one common projector.
try {
  const cross2=(u,v)=>u.x*v.y-u.y*v.x;
  const dir=seg=>({x:+seg[1][0]-+seg[0][0],y:+seg[1][1]-+seg[0][1]});
  const hit=(A,B)=>{
    const [a,b]=A,[c,d]=B;
    const den=(a[0]-b[0])*(c[1]-d[1])-(a[1]-b[1])*(c[0]-d[0]);
    if(Math.abs(den)<1e-9)return null;
    return {
      x:((a[0]*b[1]-a[1]*b[0])*(c[0]-d[0])-(a[0]-b[0])*(c[0]*d[1]-c[1]*d[0]))/den,
      y:((a[0]*b[1]-a[1]*b[0])*(c[1]-d[1])-(a[1]-b[1])*(c[0]*d[1]-c[1]*d[0]))/den
    };
  };
  for(const [variant,group] of Object.entries(window.SITEMATH_SCHEMES||{})){
    for(const task of [4,5,6]){
      const scheme=group?.['task'+task];
      if(!scheme)continue;
      const defs=task===6?[scheme.planeA,scheme.planeB]:[scheme];
      for(const def of defs){
        const type=def?.planeType||def?.type;
        if(!['parallel_lines','intersecting_lines'].includes(type)||!def.lines)continue;
        const names=def.planeLines||Object.keys(def.lines).slice(0,2);
        const A=def.lines[names[0]],B=def.lines[names[1]];
        if(!A||!B)continue;
        if(type==='parallel_lines'){
          for(const proj of ['p1','p2']){
            const da=dir(A[proj]),db=dir(B[proj]);
            const den=Math.hypot(da.x,da.y)*Math.hypot(db.x,db.y)||1;
            if(Math.abs(cross2(da,db))/den>1e-6){
              failures.push('declared parallel '+variant+'/'+task+' '+proj+': defining lines are not parallel');
            }
          }
        }else{
          const p1=hit(A.p1,B.p1),p2=hit(A.p2,B.p2);
          if(!p1||!p2){
            failures.push('declared intersection '+variant+'/'+task+': projected lines do not intersect');
          }else if(Math.abs(p1.x-p2.x)>.5){
            failures.push('declared intersection '+variant+'/'+task+': projected intersections are not on one projector');
          }
        }
      }
    }
  }
} catch(e) {
  failures.push('declared plane geometry regression: '+e.stack);
}

// Explicit source junctions are authoritative: every defining source line
// must actually pass through the stored junction on both projections.
try {
  const pointLineDistance=(p,seg)=>{
    const [a,b]=seg;
    const dx=b[0]-a[0],dy=b[1]-a[1];
    const den=Math.hypot(dx,dy)||1;
    return Math.abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/den;
  };
  for(const [variant,group] of Object.entries(window.SITEMATH_SCHEMES||{})){
    for(const task of [4,5,6]){
      const scheme=group?.['task'+task];
      if(!scheme) continue;
      const defs=task===6?[scheme.planeA,scheme.planeB]:[scheme];
      for(const def of defs){
        if(!def?.junctions?.length || !def.lines) continue;
        const names=def.planeLines||Object.keys(def.lines).slice(0,2);
        const lines=names.map(name=>def.lines[name]).filter(Boolean);
        for(const j of def.junctions){
          if(j.p1 && j.p2 && Math.abs(+j.p1[0]-+j.p2[0])>.5){
            failures.push('source junction '+variant+'/'+task+': p1/p2 are not on one projector');
          }
          for(const L of lines){
            if(j.p1 && pointLineDistance(j.p1,L.p1)>1.1){
              failures.push('source junction '+variant+'/'+task+': p1 does not lie on defining line');
            }
            if(j.p2 && pointLineDistance(j.p2,L.p2)>1.1){
              failures.push('source junction '+variant+'/'+task+': p2 does not lie on defining line');
            }
          }
        }
      }
    }
  }
} catch(e) {
  failures.push('explicit source junction geometry: '+e.stack);
}

// A historical trace is not source verification. At this checkpoint only
// variant 12 has an exact original image that is still addressable and was
// rechecked directly. Do not let metadata drift turn other traces into PASS.
try {
  for(const [variant,group] of Object.entries(window.SITEMATH_SCHEMES||{})){
    for(const task of [4,5,6]){
      const scheme=group?.['task'+task];
      if(!scheme) continue;
      if(variant==='12'){
        if(!scheme.sourceVerified || scheme.sourceRecheckRequired){
          failures.push('source verification 12/'+task+': exact original should be verified');
        }
      } else if(scheme.sourceVerified){
        failures.push('source verification '+variant+'/'+task+': historical trace falsely marked verified');
      }
    }
  }
} catch(e) {
  failures.push('source verification state: '+e.stack);
}

// Exact photographed-source invariants for variant 12 after re-tracing.
try {
  const s12=window.SITEMATH_SCHEMES?.['12'];
  if(!s12?.task4?.junctions?.length) failures.push('variant12/task4: explicit source junction missing');
  if(!s12?.task6?.planeB?.junctions?.length) failures.push('variant12/task6: explicit source junction missing');
  for(const task of [4,5,6]){
    if(window.SITEMATH_SCHEMES?.['12']?.['task'+task]?.sourceId!=='IMG_20260917_131638'){
      failures.push('variant12/task'+task+': source photo id missing');
    }
  }
} catch(e) {
  failures.push('variant12 exact source metadata: '+e.stack);
}

// Coordinate tasks must expose x/y/z reference axes and visible construction guides.
try {
  $('variantSelect').value='10';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  for(const task of [1,2,3]){
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    if(!labels.some(x=>x==='x' || x==='x₁₂')) failures.push('axes '+task+': x missing');
    if(!labels.some(x=>x==='y' || x==='y₁' || x==='y₃')) failures.push('axes '+task+': y missing');
    if(!labels.some(x=>x==='z')) failures.push('axes '+task+': z missing');
    if(window.document.querySelectorAll('#drawing .construction-line').length===0 && task>1){
      // Step 1 is axes only; move one step forward and require guides there.
      $('nextBtn').click();
    }
    if(task>1 && window.document.querySelectorAll('#drawing .construction-line').length===0){
      failures.push('axes '+task+': construction guides missing');
    }
  }
} catch(e) {
  failures.push('axis/construction guide regression: '+e.stack);
}

fs.writeFileSync('runtime-results.json', JSON.stringify({failures}, null, 2));
if (failures.length) {
  console.error('\nFAILURES\n'+failures.join('\n'));
  process.exit(1);
}
console.log('\nAll photographed variant/task combinations rendered without runtime exceptions.');
