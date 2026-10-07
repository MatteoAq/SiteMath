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
      5:['a₁','a₂','f₁','f₂','l₁','l₂'],
      6:['A₁','A₂','B₁','B₂','C₁','C₂','a₁','a₂','b₁','b₂','K₁','K₂']
    },
    '06':{
      4:['m₁','m₂','n₁','n₂','D₁','D₂'],
      5:['a₁','a₂','b₁','b₂','l₁','l₂'],
      6:['a₁','a₂','b₁','b₂','A₁','A₂','B₁','B₂','C₁','C₂','K₁','K₂']
    },
    '09':{
      4:['b₁','b₂','A₁','A₂','B₁','B₂'],
      5:['a₁','a₂','b₁','b₂','l₁','l₂'],
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
  for(const x of ['A₁','A₂','B₁','B₂','C₁','C₂','l₁','l₂']) if(!labels5.includes(x)) failures.push('variant12/task5: missing '+x);

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
  const photographed=['03','04','05','06','07','08','09','10','11','12','13','14','15','17','18','19'];

  function expectedFromPlaneDef(def,out){
    if(!def) return;
    if(def.lines) for(const name of Object.keys(def.lines)) {
      out.push(name+'₁',name+'₂');
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
        if(scheme.lines) for(const name of Object.keys(scheme.lines)) expected.push(name+'₁',name+'₂');
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
  const photographed=['03','04','05','06','07','08','09','10','11','12','13','14','15','17','18','19'];
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
  const photographed=['03','04','05','06','07','08','09','10','11','12','13','14','15','17','18','19'];
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
  const photographed=['03','04','05','06','07','08','09','10','11','12','13','14','15','17','18','19'];
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
  const photographed=['03','04','05','06','07','08','09','10','11','12','13','14','15','17','18','19'];
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

// Every photographed task 4 must show the real construction path. For a plane
// defined by a point and a line, keep the teacher's 1-2-3-4 sequence instead of
// inventing a second source line. Task 6 must keep both auxiliary projections.
if (!onlyVariant && !onlyTask) try {
  const photographed=['03','04','05','06','07','08','09','10','11','12','13','14','15','17','18','19'];
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

// Auxiliary construction is part of the answer, not disposable UI decoration.
 // Step 1 must stay source-only; by the final step each graphical task must
 // retain the projectors/auxiliary sections that explain how the result was built.
if (!onlyVariant && !onlyTask) try {
  const photographed=['03','04','05','06','07','08','09','10','11','12','13','14','15','17','18','19'];
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
