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
// stay thin and solid; only hidden geometry may be dashed. The paper grid is
// visible again and represents the 5 mm drafting cell used by coordinate tasks.
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
  const visibleStroke=rule=>{
    const m=rule.match(/stroke\s*:\s*([^;]+)/i);
    if(!m) return false;
    const v=m[1].trim().toLowerCase();
    return v!=='transparent' && v!=='none' && v!=='rgba(0,0,0,0)' && v!=='#0000';
  };
  if(dashValue(aux)!=='none') failures.push('drafting style: auxiliary lines are not solid');
  if(dashValue(construction)!=='none') failures.push('drafting style: construction lines are dashed');
  if(!dashValue(hidden) || dashValue(hidden)==='none') failures.push('drafting style: hidden geometry is not dashed');
  if(!visibleStroke(gridMinor)||!visibleStroke(gridMajor)){
    failures.push('drafting style: 5 mm background grid is hidden');
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


// Task 6: a computed intersection of section lines is not a drawable step
// unless the already constructed segments (or explicit thin continuations)
// actually REACH P/Q. Test all 20 variants and both auxiliary levels.
if (!onlyVariant && !onlyTask) try {
  let confirmed=0;
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='6';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const count=Number($('stepTotal').textContent);
    let inVariant=0;
    for(let index=0;index<count;index++){
      const title=$('stepTitle').textContent.trim();
      if(title.startsWith('Пересеки линии сечения ')){
        const letter=title.includes('получи P')?'P':title.includes('получи Q')?'Q':'';
        const dots=[...window.document.querySelectorAll('#drawing circle[data-label]')];
        const dot=dots.find(x=>x.getAttribute('data-label').startsWith(letter) && letter);
        if(!dot){
          failures.push('task6 section intersection '+variant+': '+title+' has no P/Q marker');
        }else{
          const p={x:Number(dot.getAttribute('cx')),y:Number(dot.getAttribute('cy'))};
          const vectors=[...window.document.querySelectorAll('#drawing line.aux-line, #drawing line.construction-line')]
            .map(el=>({
              a:{x:Number(el.getAttribute('x1')),y:Number(el.getAttribute('y1'))},
              b:{x:Number(el.getAttribute('x2')),y:Number(el.getAttribute('y2'))}
            }))
            .map(({a,b})=>{
              const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
              if(len<1e-7)return null;
              const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(len*len);
              const gap=Math.abs(dx*(p.y-a.y)-dy*(p.x-a.x))/len;
              return t>=-1e-6&&t<=1+1e-6&&gap<1e-4 ? {x:dx/len,y:dy/len}:null;
            }).filter(Boolean);
          const twoDirections=vectors.some((v,i)=>vectors.some((w,j)=>
            i!==j&&Math.abs(v.x*w.y-v.y*w.x)>1e-4
          ));
          if(!twoDirections){
            if(variant==='18' && letter==='P'){
              const closest=[...window.document.querySelectorAll('#drawing line.aux-line, #drawing line.construction-line')].map(el=>{
                const ax=+el.getAttribute('x1'),ay=+el.getAttribute('y1');
                const bx=+el.getAttribute('x2'),by=+el.getAttribute('y2');
                const dx=bx-ax,dy=by-ay,dd=dx*dx+dy*dy;
                const t=dd>0?((p.x-ax)*dx+(p.y-ay)*dy)/dd:0;
                const dist=dd>0?Math.abs(dx*(p.y-ay)-dy*(p.x-ax))/Math.sqrt(dd):1e9;
                return {cls:el.getAttribute('class'),a:[ax,ay],b:[bx,by],t,dist,score:dist+Math.max(0,-t,t-1)*50};
              }).sort((a,b)=>a.score-b.score).slice(0,7);
              failures.push('task6 diagnostic 18/P: '+JSON.stringify({point:p,matchCount:vectors.length,closest}));
            }
            failures.push('task6 section intersection '+variant+': '+title+
              ' is floating; two nonparallel drawn sections do not reach '+letter);
          }
        }
        inVariant++;confirmed++;
      }
      if(index<count-1)$('nextBtn').click();
    }
    if(inVariant!==2)failures.push('task6 section intersection '+variant+': expected P and Q, got '+inVariant);
  }
  console.log('Task6 section endpoints:',confirmed,'intersections checked');
} catch(e){
  failures.push('task6 section endpoint regression: '+e.stack);
}

// Draftability audit for intersections not covered by the task-6 P/Q test:
// task-4 h₂/f₁ must meet real plane lines at 2₂/4₁, and task-5 K must
// visibly belong to both the section m and the given line (or its extension).
if (!onlyVariant && !onlyTask) try {
  const touching=(point,classes)=>{
    const lines=[...window.document.querySelectorAll('#drawing line')];
    return lines.filter(el=>classes.some(c=>el.classList.contains(c))).map(el=>{
      const a={x:+el.getAttribute('x1'),y:+el.getAttribute('y1')};
      const b={x:+el.getAttribute('x2'),y:+el.getAttribute('y2')};
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len<1e-8)return null;
      const t=((point.x-a.x)*dx+(point.y-a.y)*dy)/(len*len);
      const gap=Math.abs(dx*(point.y-a.y)-dy*(point.x-a.x))/len;
      return gap<1e-4&&t>=-1e-6&&t<=1+1e-6
        ?{x:dx/len,y:dy/len,cls:el.getAttribute('class')}:null;
    }).filter(Boolean);
  };
  let count=0;
  for(const variant of variants){
    for(const task of [4,5]){
      $('variantSelect').value=variant;
      $('variantSelect').dispatchEvent(new window.Event('change'));
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();
      const total=Number($('stepTotal').textContent);
      for(let n=0;n<total;n++){
        const title=$('stepTitle').textContent.trim();
        let label='',aClass=[],bClass=[];
        if(task===4 && title.startsWith('Через 1₂ проведи h₂')){
          label='2₂';aClass=['answer-line'];bClass=['object-line','aux-line','construction-line'];
        }else if(task===4 && title.startsWith('Через 3₁ проведи f₁')){
          label=title.includes('получи 2₁')?'2₁':'4₁';
          aClass=['answer-line'];bClass=['object-line','aux-line','construction-line'];
        }else if(task===5 && title.startsWith('Найди K')){
          label=title.includes('K₁')?'K₁':'K₂';
          // If K lies beyond the original section m, its drawn continuation
          // has construction-line class rather than aux-line.
          aClass=['aux-line','construction-line'];bClass=['object-line','construction-line'];
        }
        if(label){
          const dot=window.document.querySelector('#drawing circle[data-label="'+label+'"]');
          if(!dot){
            failures.push('manual intersection '+variant+'/'+task+': missing '+label+' at '+title);
          }else{
            const point={x:+dot.getAttribute('cx'),y:+dot.getAttribute('cy')};
            const first=touching(point,aClass),second=touching(point,bClass);
            const transversal=first.some(u=>second.some(v=>Math.abs(u.x*v.y-u.y*v.x)>1e-4));
            if(!transversal){
              if(variant==='05'&&task===5){
                const nearest=[...window.document.querySelectorAll('#drawing line')].map(el=>{
                  const a={x:+el.getAttribute('x1'),y:+el.getAttribute('y1')};
                  const b={x:+el.getAttribute('x2'),y:+el.getAttribute('y2')};
                  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
                  if(len<1e-8)return null;
                  const t=((point.x-a.x)*dx+(point.y-a.y)*dy)/(len*len);
                  const perpendicular=Math.abs(dx*(point.y-a.y)-dy*(point.x-a.x))/len;
                  return {cls:el.getAttribute('class'),perpendicular,t,
                    a:[a.x,a.y],b:[b.x,b.y],
                    priority:perpendicular+Math.max(0,-t,t-1)*50};
                }).filter(Boolean).sort((x,y)=>x.priority-y.priority).slice(0,9);
                failures.push('manual diagnostic 05/5: '+JSON.stringify({point,nearest}));
              }
              failures.push('manual intersection '+variant+'/'+task+' '+label+
                ': drawn section/level and its second supporting line do not meet visibly '+JSON.stringify({first:first.length,second:second.length}));
            }
          }
          count++;
        }
        if(n<total-1)$('nextBtn').click();
      }
    }
  }
  console.log('Manual task4/task5 intersections:',count,'checked');
} catch(e){failures.push('manual task4/task5 intersection audit: '+e.stack);}

// Methodical correctness also requires transfer projectors, not merely
// coincident x coordinates: audit newly introduced point pairs over all
// task-4/5/6 steps, including helper points and final answer points.
if (!onlyVariant && !onlyTask) try {
  const coord=node=>({x:+node.getAttribute('cx'),y:+node.getAttribute('cy')});
  const connected=(a,b)=>[...window.document.querySelectorAll('#drawing line.construction-line, #drawing line.source-guide-line')]
    .some(el=>{
      const x={x:+el.getAttribute('x1'),y:+el.getAttribute('y1')};
      const y={x:+el.getAttribute('x2'),y:+el.getAttribute('y2')};
      const close=(u,v)=>Math.hypot(u.x-v.x,u.y-v.y)<1e-4;
      return (close(a,x)&&close(b,y))||(close(a,y)&&close(b,x));
    });
  let paired=0,ambiguous=0,coincidentDuplicates=0;
  for(const variant of variants)for(const task of [4,5,6]){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const total=Number($('stepTotal').textContent);
    for(let index=1;index<total;index++){
      $('nextBtn').click();
      const active=[...window.document.querySelectorAll('#drawing circle[data-active="1"][data-label]')];
      for(const dot of active){
        const name=dot.getAttribute('data-label')||'';
        const m=name.match(/^(.+?)([₁₂])$/);
        if(!m||name.includes('≡')||!['construction','result'].includes(dot.getAttribute('data-role')))continue;
        const other=m[1]+(m[2]==='₁'?'₂':'₁');
        const same=[...window.document.querySelectorAll('#drawing circle[data-label="'+name+'"]')];
        const counterparts=[...window.document.querySelectorAll('#drawing circle[data-label="'+other+'"]')];
        if(!counterparts.length)continue;
        if(same.length!==1||counterparts.length!==1){
          const unique=nodes=>{
            const pts=[];
            for(const n of nodes){
              const p=coord(n);
              if(!pts.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-4))pts.push(p);
            }
            return pts;
          };
          const current=unique(same),pairedPositions=unique(counterparts);
          if(current.length!==1||pairedPositions.length!==1){
            ambiguous++;
            console.log('Projector labels noncoincident:',variant+'/'+task,
              'step '+(index+1),name,JSON.stringify(current),other,JSON.stringify(pairedPositions));
            continue;
          }
          coincidentDuplicates++;
        }
        if(counterparts[0].getAttribute('data-active')==='1'&&name>other)continue;
        const a=coord(dot),b=coord(counterparts[0]);
        if(Math.abs(a.x-b.x)>1e-4)
          failures.push('paired projector '+variant+'/'+task+' step '+(index+1)+' '+name+'/'+other+': misaligned x '+a.x+' vs '+b.x);
        if(!connected(a,b))
          failures.push('paired projector '+variant+'/'+task+' step '+(index+1)+' '+name+'/'+other+': missing drawable joining line');
        paired++;
      }
    }
  }
  console.log('Derived paired projectors:',paired,'checked; coincident duplicate labels:',coincidentDuplicates,'; distinct unresolved duplicates:',ambiguous);
} catch(e){failures.push('derived paired projector audit: '+e.stack);}

// All task-5 visibility competitors must be created by visible, intersecting
// projections of the line and an actual plane line (or explicit helper).
if (!onlyVariant && !onlyTask) try {
  let witnessed=0;
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='5';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const total=Number($('stepTotal').textContent);
    for(let n=0;n<total;n++){
      const title=$('stepTitle').textContent.trim();
      if(title.startsWith('Видимость на Π₁: отметь')||title.startsWith('Видимость на Π₂: отметь')){
        const label=title.startsWith('Видимость на Π₁')?'3₁≡4₁':'5₂≡6₂';
        const dot=window.document.querySelector('#drawing circle[data-label="'+label+'"]');
        if(!dot){
          failures.push('visibility witness '+variant+': no '+label);
        }else{
          const x=+dot.getAttribute('cx'),y=+dot.getAttribute('cy');
          const dirs=[...window.document.querySelectorAll('#drawing line.object-line, #drawing line.aux-line, #drawing line.construction-line')].map(el=>{
            const ax=+el.getAttribute('x1'),ay=+el.getAttribute('y1');
            const bx=+el.getAttribute('x2'),by=+el.getAttribute('y2');
            const dx=bx-ax,dy=by-ay,l=Math.hypot(dx,dy);
            if(l<1e-8)return null;
            const t=((x-ax)*dx+(y-ay)*dy)/(l*l);
            const gap=Math.abs(dx*(y-ay)-dy*(x-ax))/l;
            return t>=-1e-6&&t<=1+1e-6&&gap<1e-4?{x:dx/l,y:dy/l}:null;
          }).filter(Boolean);
          if(!dirs.some((a,i)=>dirs.some((b,j)=>i!==j&&Math.abs(a.x*b.y-a.y*b.x)>1e-4)))
            failures.push('visibility witness '+variant+' '+label+': not reached by two nonparallel strokes');
        }
        witnessed++;
      }
      if(n<total-1)$('nextBtn').click();
    }
  }
  if(witnessed!==40)failures.push('visibility witness: expected 40 constructed coincidences, got '+witnessed);
  console.log('Visible task5 competitor intersections:',witnessed,'checked');
} catch(e){failures.push('task5 witness endpoint audit: '+e.stack);}

// A point-and-line task-5 plane requires a real second line g=AT.
// The old solver used g analytically for visibility before showing its
// point selection/projector/construction. Keep this derivation explicit.
if (!onlyVariant && !onlyTask) try {
  let checked=0;
  for(const variant of variants){
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task5;
    if(scheme?.planeType!=='line_point')continue;
    checked++;
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='5';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const total=Number($('stepTotal').textContent);
    const steps=[];
    for(let n=0;n<total;n++){
      steps.push({
        title:$('stepTitle').textContent.trim(),
        labels:[...window.document.querySelectorAll('#drawing text')].map(x=>x.textContent)
      });
      if(n<total-1)$('nextBtn').click();
    }
    const idx=prefix=>steps.findIndex(st=>st.title.startsWith(prefix));
    const choose=idx('Выбери T₁ на '),transfer=idx('По линии связи получи T₂ на ');
    const g=steps.findIndex(st=>st.title.startsWith('Соедини ')&&st.title.includes('построй g₁ и g₂'));
    const omega=steps.findIndex(st=>st.title.includes('вспомогательную плоскость Ω'));
    const witness=idx('Видимость на Π₁');
    if(choose<1||transfer!==choose+1||g!==transfer+1||omega<=g||witness<=g){
      failures.push('task5 line-point '+variant+': T₁→T₂→g→Ω→competitor order missing');
      continue;
    }
    if(steps[0].labels.includes('g₁')||steps[0].labels.includes('g₂'))
      failures.push('task5 line-point '+variant+': derived g shown as printed source');
    if(steps[choose].labels.includes('T₂')||steps[choose].labels.includes('g₁'))
      failures.push('task5 line-point '+variant+': premature T₂/g at T₁ choice');
    if(!steps[transfer].labels.includes('T₂')||steps[transfer].labels.includes('g₁'))
      failures.push('task5 line-point '+variant+': T₂ transfer missing/early g');
    if(!steps[g].labels.includes('g₁')||!steps[g].labels.includes('g₂'))
      failures.push('task5 line-point '+variant+': g projections missing');
  }
  console.log('Task5 line-point g constructions:',checked,'checked');
} catch(e){failures.push('task5 line-point g construction audit: '+e.stack);}

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
    if ($('stepInfoText').textContent.length > 1400) failures.push('step info: overly verbose guidance ('+$('stepInfoText').textContent.length+')');
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

// A chosen T is not merely on some parallel level line: it must lie on
// the exact h or f that was constructed and labeled earlier in task 4.
if(!onlyVariant&&!onlyTask)try {
  const point=(label)=>{
    const el=window.document.querySelector('#drawing circle[data-label="'+label+'"]');
    return el?{x:Number(el.getAttribute('cx')),y:Number(el.getAttribute('cy'))}:null;
  };
  const onLine=(p,a,b)=>{
    if(!p||!a||!b)return false;
    const dx=b.x-a.x,dy=b.y-a.y;
    const len=Math.hypot(dx,dy);
    return len>1e-8 && Math.abs(dx*(p.y-a.y)-dy*(p.x-a.x))/len<1e-4;
  };
  for(const variant of variants){
    const kind=window.SITEMATH_SCHEMES?.[variant]?.task4?.operation?.type;
    if(kind!=='line_intersects_frontale'&&kind!=='line_intersects_horizontal')continue;
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='4';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('lastBtn').click();
    const marks=kind==='line_intersects_frontale'
      ? [['T₁','3₁','4₁'],['T₂','3₂','4₂']]
      : [['T₂','1₂','2₂'],['T₁','1₁','2₁']];
    for(const [t,a,b] of marks){
      if(!onLine(point(t),point(a),point(b))){
        failures.push('task4 geometric membership '+variant+': '+t+' is not on the built '+(kind==='line_intersects_frontale'?'frontale':'horizontal'));
      }
    }
  }
}catch(e){failures.push('task4 named-level intersection membership: '+e.stack);}

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
    let sawN=false,sawNPair=false,sawResultAfterN=false;
    for(let n=0;n<total;n++){
      const title=$('stepTitle').textContent.trim();
      const labels=[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent);
      const hasResult=labels.includes(resultName+'₁')||labels.includes(resultName+'₂');

      if(title.startsWith('Выбери вспомогательную точку N')){
        sawN=true;
        // Only one seed projection may be chosen: the other is constructed
        // from its projector on the NEXT distinct drafting step.
        if(labels.includes('N₁')===labels.includes('N₂')){
          failures.push('task4 result derivation '+variant+': both N projections appear before projection step');
        }
        if(hasResult){
          failures.push('task4 result derivation '+variant+': '+resultName+' appears while N is only being chosen');
        }
      } else if(title.startsWith('По линии связи получи N')){
        sawNPair=true;
        if(!sawN || !labels.includes('N₁') || !labels.includes('N₂') || hasResult){
          failures.push('task4 result derivation '+variant+': N pair not properly constructed before answer');
        }
      } else if(hasResult){
        if(!sawNPair){
          failures.push('task4 result derivation '+variant+': '+resultName+' appears before derived helper N pair');
        } else {
          sawResultAfterN=true;
        }
      }

      if(n<total-1) $('nextBtn').click();
    }
    if(!sawN) failures.push('task4 result derivation '+variant+': helper N step missing');
    if(!sawNPair) failures.push('task4 result derivation '+variant+': N second projection step missing');
    if(!sawResultAfterN) failures.push('task4 result derivation '+variant+': final '+resultName+' missing after N');
  }
} catch(e) {
  failures.push('task4 result-point derivation regression: '+e.stack);
}

// First frame shows the exact digitized source; the solver-constrained
// geometry appears only when construction begins. Never silently use corrected
// line slopes or normalize scanned source projector coordinates at step zero.
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
      const rawDx=rawA2[1][0]-rawA2[0][0],rawDy=rawA2[1][1]-rawA2[0][1];
      const cleanDx=cleanA2[1][0]-cleanA2[0][0],cleanDy=cleanA2[1][1]-cleanA2[0][1];
      if(Math.abs(dx*rawDy-dy*rawDx)>1e-6){
        failures.push('variant12 source reconstruction: initial a₂ must use raw photographed direction');
      }
      if(Math.abs(rawDx*cleanDy-rawDy*cleanDx)>1e-6 &&
         Math.abs(dx*cleanDy-dy*cleanDx)<1e-6){
        failures.push('variant12 source reconstruction: solver direction leaked into initial frame');
      }
    }
    const k1=window.document.querySelector('#drawing circle[data-label="K₁"]');
    const k2=window.document.querySelector('#drawing circle[data-label="K₂"]');
    if(!k1||!k2) failures.push('variant12 source reconstruction: K₁/K₂ missing');
    else {
      const x1=Number(k1.getAttribute('cx')),x2=Number(k2.getAttribute('cx'));
      const rawGap=raw6.pointK.p1[0]-raw6.pointK.p2[0];
      const paperScale=Number(window.document.querySelector('#drawing')?.getAttribute('data-paper-scale'))||1;
      if(Math.abs((x1-x2)-rawGap*paperScale)>1e-6){
        failures.push('variant12 source reconstruction: raw K projector gap must remain unchanged on initial frame');
      }
    }
    $('nextBtn').click();
    const c1=[...window.document.querySelectorAll('#drawing circle[data-label="K₁"]')].at(-1);
    const c2=[...window.document.querySelectorAll('#drawing circle[data-label="K₂"]')].at(-1);
    if(!c1||!c2||Math.abs(Number(c1.getAttribute('cx'))-Number(c2.getAttribute('cx')))>1e-6){
      failures.push('variant12 source reconstruction: solver K projections not aligned after original frame');
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
      const source=scheme.sourceGeometry||scheme;
      if(task===6){
        expectedFromPlaneDef(source.planeA,expected);
        expectedFromPlaneDef(source.planeB,expected);
        const k=scheme.pointLabel||'K';
        if(scheme.pointK||scheme.pointThrough) expected.push(k+'₁',k+'₂');
      }else{
        if(source.lines) for(const name of Object.keys(source.lines)) {
          const shown=sourceDisplayName(name);
          expected.push(shown+'₁',shown+'₂');
        }
        if(source.points) for(const name of Object.keys(source.points)) expected.push(name+'₁',name+'₂');
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

// All archived full-size originals must survive as exact raw coordinates
// on the FIRST frame. Earlier only variant 12 had this protection, so a
// mathematically normalized graph could silently replace other paper givens.
if (!onlyVariant && !onlyTask) try {
  const xy=seg=>({x:seg[0][0],y:seg[0][1],X:seg[1][0],Y:seg[1][1]});
  const expectedLines=(task,raw,scheme)=>{
    const out=[];
    const addDef=def=>{
      if(!def)return;
      Object.values(def.lines||{}).forEach(rec=>{
        for(const proj of ['p2','p1']) if(rec?.[proj])out.push(xy(rec[proj]));
      });
      if((def.type==='ABC'||def.planeType==='ABC') &&
         !(task===4 && scheme?.sourceABCVerticesOnly)){
        const names=Object.keys(def.points||{}).slice(0,3);
        if(names.length!==3)throw Error('ABC original has no three named points');
        for(const [a,b] of [[names[0],names[1]],[names[1],names[2]],[names[2],names[0]]])
          for(const proj of ['p2','p1']){
            const A=def.points[a][proj],B=def.points[b][proj];
            out.push({x:A[0],y:A[1],X:B[0],Y:B[1]});
          }
      }
      // A projecting plane has a single source trace on Π₁ or Π₂.
      if(def.line)out.push(xy(def.line));
    };
    if(task===6){addDef(raw.planeA);addDef(raw.planeB);}
    else addDef(raw);
    return out;
  };
  const same=(v,w)=>Math.abs(Number(v)-Number(w))<.001;
  const groups=Object.entries(window.SITEMATH_SCHEMES||{})
    .filter(([variant,group])=>[4,5,6].every(task=>
      group?.['task'+task]?.sourceAvailable===true &&
      !!group?.['task'+task]?.sourceGeometry));
  if(groups.length!==20)failures.push('exact original first-frame audit: expected 20 scanned variants, found '+groups.length);
  for(const [variant,group] of groups){
    for(const task of [4,5,6]){
      $('variantSelect').value=variant;
      $('variantSelect').dispatchEvent(new window.Event('change'));
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();
      const raw=group['task'+task].sourceGeometry;
      const expected=expectedLines(task,raw,group['task'+task]);
      const actual=[...window.document.querySelectorAll('#drawing line.object-line')];
      const key=variant+'/'+task;
      if(expected.length!==actual.length){
        failures.push(key+': first-frame paper lines '+actual.length+' != '+expected.length);
        continue;
      }
      if(!expected.length)continue;
      const scale=Number($('drawing')?.getAttribute('data-paper-scale'))||1;
      const dx=Number(actual[0].getAttribute('x1'))-expected[0].x*scale;
      const dy=Number(actual[0].getAttribute('y1'))-expected[0].y*scale;
      expected.forEach((ref,i)=>{
        const el=actual[i];
        if(!same(el.getAttribute('x1'),ref.x*scale+dx) ||
           !same(el.getAttribute('y1'),ref.y*scale+dy) ||
           !same(el.getAttribute('x2'),ref.X*scale+dx) ||
           !same(el.getAttribute('y2'),ref.Y*scale+dy))
          failures.push(key+': first-frame paper line '+i+' changed by solver normalization');
      });
      // Projectors printed on the assignment sheet must also remain at their
      // raw coordinates. Guide-count checks alone could miss moved projectors.
      const guides=[];
      const addGuides=def=>{
        for(const rec of Object.values(def?.points||{}))
          if(rec?.p1&&rec?.p2)
            guides.push({x:rec.p2[0],y:rec.p2[1],X:rec.p1[0],Y:rec.p1[1]});
        for(const rec of def?.junctions||[])
          if(rec?.p1&&rec?.p2)
            guides.push({x:rec.p2[0],y:rec.p2[1],X:rec.p1[0],Y:rec.p1[1]});
      };
      if(task===6){
        addGuides(raw.planeA);
        addGuides(raw.planeB);
        const K=raw.pointK||raw.pointThrough;
        if(K?.p1&&K?.p2)
          guides.push({x:K.p2[0],y:K.p2[1],X:K.p1[0],Y:K.p1[1]});
      }else addGuides(raw);
      const drawnGuides=[...window.document.querySelectorAll('#drawing line.source-guide-line')];
      if(drawnGuides.length!==guides.length)
        failures.push(key+': original projector count '+drawnGuides.length+' != '+guides.length);
      else guides.forEach((ref,i)=>{
        const el=drawnGuides[i];
        if(!same(el.getAttribute('x1'),ref.x*scale+dx) ||
           !same(el.getAttribute('y1'),ref.y*scale+dy) ||
           !same(el.getAttribute('x2'),ref.X*scale+dx) ||
           !same(el.getAttribute('y2'),ref.Y*scale+dy))
          failures.push(key+': source projector '+i+' changed by solver normalization');
      });
      const names=task===6?{[group.task6.pointLabel||'K']:raw.pointK||raw.pointThrough}:(raw.points||{});
      for(const [name,rec] of Object.entries(names)){
        if(!rec?.p1||!rec?.p2)continue;
        for(const [proj,sub] of [['p1','₁'],['p2','₂']]){
          const reversed=task===6&&group.task6.paperReversedKLabels;
          const label=name+(reversed?(sub==='₁'?'₂':'₁'):sub);
          const el=window.document.querySelector('#drawing circle[data-label="'+label+'"]');
          const P=rec[proj];
          if(!el||!same(el.getAttribute('cx'),P[0]*scale+dx) ||
             !same(el.getAttribute('cy'),P[1]*scale+dy))
            failures.push(key+': first-frame source point '+label+' moved or missing');
        }
      }
    }
  }
} catch(e){failures.push('all original first-frame audit: '+e.stack);}

// Freeze the raw paper traces for every digitized variant. Solver cleanup,
 // refactors and notation work may change derived geometry, but the copied
 // Source fingerprints change only when a variant has been checked against
 // its archived full-size paper original. Variants 06/19 were corrected 13.10.
if (!onlyVariant && !onlyTask) try {
  const expected={
    '03':['9b145448',1224],
    '04':['f165798a',1183],
    '05':['87e8d6e9',1225],
    '06':['01e552f6',1328],
    '07':['256e70a8',1125],
    '08':['136f8adf',878],
    '09':['8fbcfe0a',1224],
    '10':['dc17eba2',1299],
    '11':['329d0144',847],
    '12':['468c4cd2',1533],
    '13':['ca212e69',1223],
    '14':['d4d3057f',1046],
    '15':['907347c7',902],
    '17':['2e806d12',1348],
    '18':['2f9067d1',1429],
    '19':['27f74aca',1215]
  };
  const skip=new Set(['sourceVerified','sourceAvailable','sourceId','sourceRecheckRequired','sourceGeometry','auxBridge']);
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
      failures.push('source fingerprint '+variant+': expected '+hash+'/'+len+', actual '+fnv(serialized)+'/'+serialized.length+'; raw paper trace changed without explicit retrace');
    }
  }
} catch(e) {
  failures.push('source fingerprint regression: '+e.stack);
}

// University album: variants 13/5 and 13/6 explicitly contain the
// intersection projectors already PRINTED on the source drawings.
// Their source coordinates must remain separate from solver correction.
if(!onlyVariant&&!onlyTask)try{
  const G=window.SITEMATH_SCHEMES?.["13"];
  for(const [task,plane,expected] of [
    [5,null,[[416.675,1652.754],[421.059,1857.210]]],
    [6,"planeA",[[927.717,1675.851],[937.5,1814]]]
  ]){
    const raw=G?.["task"+task]?.sourceGeometry;
    const j=plane?raw?.[plane]?.junctions?.[0]:raw?.junctions?.[0];
    if(!j || [j.p2,j.p1].some((p,i)=>
      !p || p.some((v,n)=>Math.abs(v-expected[i][n])>.01))){
      failures.push("variant 13/"+task+": printed a/b projector missing or moved");
    }
  }
}catch(e){failures.push("variant 13 paper junction check: "+e.message)}

// 15/5, original university sheet: the given ℓ₁ is short and does NOT
// cross the PRINTED a₁ segment. Do not replace its paper length with
// the extended mathematical line used to locate K.
if(!onlyVariant&&!onlyTask)try{
  const raw=window.SITEMATH_SCHEMES?.['15']?.task5?.sourceGeometry;
  const l=raw?.lines?.l?.p1, a=raw?.lines?.a?.p1;
  if(!l||!a)failures.push('variant 15/5 paper: raw lower l/a missing');
  else{
    const at=x=>a[0][1]+(a[1][1]-a[0][1])*(x-a[0][0])/(a[1][0]-a[0][0]);
    if(l[0][0]<220 || l[0][0]>255 ||
       l[1][0]<460 || l[1][0]>495 ||
       l.some(p=>p[1]-at(p[0])<10))
      failures.push('variant 15/5 paper: short ℓ₁ has been lengthened into a₁');
  }
}catch(e){failures.push('variant 15/5 paper trace '+e.message)}

// Variant-specific corrections recovered from the photographed sheets / prior
// review must not drift back to generic templates.
if (!onlyVariant && !onlyTask) try {
  const G=window.SITEMATH_SCHEMES;
  const check=(ok,msg)=>{if(!ok) failures.push('variant contract: '+msg);};

  let q=G['04'];
  check(q?.task4?.planeType==='ABC','04/4 must be Σ(ABC)');
  // 1000022483.jpg: C₁ is visibly above B₁; the old flat B₁C₁ edge was invented.
  for(const model of [q.task4,q.task4.sourceGeometry]){
    check(model?.points?.B?.p1?.[1]-model?.points?.C?.p1?.[1] >= 20 &&
      model?.points?.B?.p1?.[1]-model?.points?.C?.p1?.[1] <= 45,
      '04/4 paper: C₁ must be above B₁ with the original non-horizontal B₁C₁ edge');
  }
  check(q?.task4?.operation?.type==='line_intersects_horizontal' && q.task4.operation.through==='D','04/4 ℓ must go through D and intersect h');
  check(q?.task6?.planeA?.type==='ABC','04/6 first plane must be ABC');
  check(q?.task6?.planeB?.type==='intersecting_lines' && ['h','f'].every(x=>q.task6.planeB.lines?.[x]),'04/6 second plane must be Θ(h∩f)');
  check(q?.task6?.pointLabel==='M','04/6 through-point must be M');

  // 1000022482.jpg / 05/6: the crossing of a and b of the SECOND
  // plane has a thin printed projector, separate from the given K line
  // and the three triangle projectors. Do not fabricate extra guides on
  // sheets without this printed trace.
  q=G['05'];
  for(const model of [q.task6,q.task6.sourceGeometry]){
    const J=model?.planeB?.junctions?.[0];
    check(!!J?.p1&&!!J?.p2,'05/6 printed a∩b source projector missing');
    if(J?.p1&&J?.p2){
      check(Math.abs(J.p1[0]-345)<1.5&&Math.abs(J.p2[0]-345)<1.5,
        '05/6 printed a∩b source projector has wrong horizontal location');
      check(Math.abs(J.p1[1]-294)<2&&Math.abs(J.p2[1]-146)<2,
        '05/6 printed a∩b source projector has wrong vertical position');
    }
  }
  // Each listed first-frame line of task 6 is a visibly photographed
  // thin GIVEN crossing projector, not a later auxiliary solution.
  const printedTask6Projectors={
    '04':[['planeB',355.04,355.04,304.01,222.67]],
    '06':[['planeA',202.77,202.77,300.96,159.81]],
    '09':[['planeA',180.66,180.66,310.94,151.12]],
    '10':[['planeB',500.32,500.32,569.73,408.69]],
    '17':[['planeB',530.90,530.90,611.83,473.46]],
    '18':[['planeA',186.89,186.89,419.00,267.00],
          ['planeB',382.48,382.48,407.26,269.60]]
  };
  for(const [variant,specs] of Object.entries(printedTask6Projectors)){
    const data=G[variant]?.task6;
    for(const [plane,x1,x2,y1,y2] of specs){
      const source=data?.sourceGeometry?.[plane]?.junctions;
      const solver=data?.[plane]?.junctions;
      check(source?.length===1 && solver?.length===1,
        variant+'/6: original crossing projector '+plane+' not retained on both copies');
      const J=source?.[0];
      if(!J?.p1||!J?.p2)continue;
      check(Math.abs(J.p1[0]-J.p2[0])<1e-5,
        variant+'/6: printed vertical projector '+plane+' is incorrectly slanted');
      check(Math.abs(J.p1[0]-x1)<2 && Math.abs(J.p2[0]-x2)<2 &&
        Math.abs(J.p1[1]-y1)<2 && Math.abs(J.p2[1]-y2)<2,
        variant+'/6: printed projector '+plane+' moved away from archived source crossing');
    }
  }
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
          if(def.type==='ABC' && Object.keys(def.points||{}).length!==3) failures.push('schema completeness '+variant+'/6: plane '+side+' three-vertex source incomplete');
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
    return points+junctions+(def.sourceGuides?.length||0);
  };
  for(const variant of photographed){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    for(const task of [4,5,6]){
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();
      const scheme=window.SITEMATH_SCHEMES?.[variant]?.['task'+task];
      const raw=scheme?.sourceGeometry||scheme;
      const expected=task===6
        ? guideCountForDef(raw?.planeA)+guideCountForDef(raw?.planeB)+((raw?.pointK||raw?.pointThrough)?1:0)
        : guideCountForDef(raw);
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

// Numeric variants also carry provisional input values; do not imply that their
// source documents have been rechecked merely because the calculations run.
if (!onlyVariant && !onlyTask) try {
  $('variantSelect').value='03';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='1';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  if(!$('variantNote').textContent.includes('доступен для сверки координат')) failures.push('numeric 03/1: recovered sheet not attributed');
  $('variantSelect').value='12';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  if(!$('variantNote').textContent.includes('доступен для сверки координат')) failures.push('numeric 12/1: exact source attribution missing');
} catch(e){ failures.push('numeric source attribution: '+e.stack); }

// In the supplied 11/6 paper original the K subscripts are printed in
// the wrong order. Step 1 is a faithful copy; step 2 must explicitly correct
// the projection names without moving the source point.
if (!onlyVariant && !onlyTask) try {
  $('variantSelect').value='11';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='6';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();
  const height=name=>{
    const node=window.document.querySelector('#drawing circle[data-label="'+name+'"]');
    return node?Number(node.getAttribute('cy')):NaN;
  };
  if(!(height('K₁')<height('K₂'))) failures.push('11/6 original paper K₁/K₂ labels are not faithfully restored');
  if(!$('stepAction').textContent.includes('переобозначь')) failures.push('11/6 paper typo has no construction explanation');
  $('nextBtn').click();
  if(!(height('K₂')<height('K₁'))) failures.push('11/6 corrected K projections are not properly indexed');
} catch(e){failures.push('11/6 source labeling correction: '+e.stack);}

// Derived line orientation matters: these were actual photographed
// mistakes, not merely visual-label differences.
if (!onlyVariant && !onlyTask) try {
  const G=window.SITEMATH_SCHEMES;
  const grade=seg=>(seg[1][1]-seg[0][1])/(seg[1][0]-seg[0][0]);
  for(const model of [G['03'].task5,G['03'].task5.sourceGeometry]){
    if(!(grade(model.lines.a.p2)>0 && grade(model.lines.f.p2)<0)){
      failures.push('03/5: swapped a₂ and f₂ geometry was restored');
    }
    if(!(Math.abs(grade(model.lines.f.p1))<(model===G['03'].task5?1e-9:.15))){
      failures.push('03/5: frontal f₁ must be mathematically horizontal in the solver');
    }
  }
  for(const model of [G['06'].task5,G['06'].task5.sourceGeometry]){
    if(!(grade(model.lines.b.p2)>1.4)){
      failures.push('06/5: source b₂ must descend steeply to the right');
    }
    if(!(grade(model.lines.l.p2)>.2 && grade(model.lines.l.p1)>.2)){
      failures.push('06/5: both given ℓ projections must descend right');
    }
    if(!(grade(model.lines.a.p2)<-.3 && grade(model.lines.a.p1)<-.1)){
      failures.push('06/5: original a projections must rise to the right');
    }
  }
  for(const variant of ['03','06']){
    const task=G[variant].task5;
    for(const model of [task,task.sourceGeometry]){
      if(model.junctions?.length!==1 || !model.junctions[0].p1 || !model.junctions[0].p2){
        failures.push(variant+'/5: source intersection projector omitted');
      }
    }
  }
} catch(e){failures.push('photo 03/5 and 06/5 retrace: '+e.stack);}

// In 14/6 the original a₁ rises to the right. The previous placeholder
// had a₁ descending almost parallel to b₁, removing a finite intersection.
if (!onlyVariant && !onlyTask) try {
  const g=window.SITEMATH_SCHEMES['14'].task6;
  const slope=seg=>(seg[1][1]-seg[0][1])/(seg[1][0]-seg[0][0]);
  for(const model of [g,g.sourceGeometry]){
    const A=model.planeA.lines.a,B=model.planeA.lines.b;
    if(!(slope(A.p2)<0 && slope(A.p1)<-.4)) failures.push('14/6: original a₂/a₁ must rise right');
    if(!(slope(B.p2)>.3 && slope(B.p1)>.3)) failures.push('14/6: original b₂/b₁ must descend right');
    if(!(slope(model.planeB.line)<-.6)) failures.push('14/6: Ω₁ source line is wrongly sloped');
    if(model.planeA.junctions?.length!==1) failures.push('14/6: original crossing projector missing');
  }
} catch(e){failures.push('14/6 original photograph retrace: '+e.stack);}

// Original 05/5 and 03/6 define different spatial lines than the old
// mislabeled traces: assert the actual projected orientations for both.
if (!onlyVariant && !onlyTask) try {
 const g=window.SITEMATH_SCHEMES;
 const slope=seg=>(seg[1][1]-seg[0][1])/(seg[1][0]-seg[0][0]);
 for(const model of [g['05'].task5,g['05'].task5.sourceGeometry]){
   if(!(slope(model.lines.a.p2)>.3 && slope(model.lines.f.p2)<-.3))
     failures.push('05/5: original a₂ / f₂ strokes are wrongly assigned');
   if(!(slope(model.lines.l.p1)>.2))
     failures.push('05/5: original ℓ₁ is ascending right, contrary to paper');
 }
 for(const model of [g['03'].task6,g['03'].task6.sourceGeometry]){
   if(!(slope(model.planeB.lines.a.p2)<-.3 && slope(model.planeB.lines.b.p2)>.3))
     failures.push('03/6: original Θ a₂ / b₂ strokes are wrongly assigned');
 }
 for(const variant of Array.from({length:20},(_,i)=>String(i+1).padStart(2,'0'))){
   for(const task of [4,5,6]){
     const source=g[variant]['task'+task];
     if(!source.sourceAvailable || !source.sourceId==='source-photos/scans/variant-'+variant+'.jpg')
       failures.push('original not connected to '+variant+'/'+task);
   }
 }
} catch(e){failures.push('paper corrections 05/5, 03/6 and recovered source mapping: '+e.stack);}

// Source photos of 10/5 and 17/5 contain a given projector between two
// intersecting source lines. The old data had raw 121/47-unit dislocation.
if (!onlyVariant && !onlyTask) try {
 for(const variant of ['05','10','17']){
  const g=window.SITEMATH_SCHEMES[variant].task5;
  const raw=g.sourceGeometry;
  const projectors=[raw.junctions?.[0],g.junctions?.[0]];
  if(projectors.some(j=>!j?.p1||!j?.p2)) failures.push(variant+'/5: printed intersection projector missing');
  const dx=Math.abs(g.junctions[0].p1[0]-g.junctions[0].p2[0]);
  if(dx>0.001) failures.push(variant+'/5: Monge intersection not on one projector, gap '+dx);
 }
} catch(e){ failures.push('photographic 05/10/17 task5 projector audit: '+e.stack); }

// Graphical task 6 input for 03/19 must retain actual intersections
// in both Monge projections on the same source projector.
if (!onlyVariant && !onlyTask) try {
  const D=window.SITEMATH_SCHEMES;
  for(const [variant,plane] of [['03','planeB'],['19','planeA']]){
    const task=D[variant].task6;
    for(const [kind,model] of [['math',task],['photo',task.sourceGeometry]]){
      const def=model[plane],j=def.junctions?.[0];
      if(!j?.p1||!j?.p2){failures.push(variant+'/6 '+kind+': missing pre-printed intersection projector');continue;}
      const gap=Math.abs(j.p1[0]-j.p2[0]);
      if(gap>(kind==='math'?0.0001:10)) failures.push(variant+'/6 '+kind+': photographed crossing mismatch '+gap);
      const slope=p=>(p[1][1]-p[0][1])/(p[1][0]-p[0][0]);
      if(!(slope(def.lines.a.p2)<0 && slope(def.lines.b.p2)>0))
        failures.push(variant+'/6 '+kind+': wrong source upper a/b line slopes');
    }
  }
} catch(e){failures.push('03/6 and 19/6 full sheet retrace: '+e.stack);}

// Verify the actual source geometry, not just warning text. The 06 photo
// shows n₂ upper, m₂ lower, n₁ upper, m₁ lower; 19 has a named K projector.
if (!onlyVariant && !onlyTask) try {
  const six=window.SITEMATH_SCHEMES['06'].task4;
  for(const model of [six,six.sourceGeometry]){
    const M=model.lines.m,N=model.lines.n;
    const mid=seg=>(seg[0][1]+seg[1][1])/2;
    if(!(mid(N.p2)<mid(M.p2))) failures.push('06/4: n₂ is not above m₂');
    if(!(mid(N.p1)<mid(M.p1))) failures.push('06/4: n₁ is not above m₁');
  }
  const nineteen=window.SITEMATH_SCHEMES['19'].task4;
  for(const model of [nineteen,nineteen.sourceGeometry]){
    const j=model.junctions?.[0];
    if(j?.label1!=='K₁'||j?.label2!=='K₂') failures.push('19/4: given K₁/K₂ projector missing');
  }
  $('variantSelect').value='19';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='4';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  $('firstBtn').click();
  const sourceLabels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
  if(!sourceLabels.includes('K₁') || !sourceLabels.includes('K₂')) failures.push('19/4: photographed K is absent from first frame');
} catch(e){failures.push('photographic source corrections 06/19: '+e.stack);}

// A provisional graphical trace must never present disputed input as verified.
if (!onlyVariant && !onlyTask) try {
  const select=(variant,task)=>{
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
  };
  select('06',4);
  if(!$('dynamicInputs').textContent.includes('верхняя фронтальная прямая – n₂')) failures.push('06/4: actual m/n geometry correction not shown');
  if(!$('dynamicInputs').querySelector('a[href="./source-photos/scans/variant-06.jpg"]')) failures.push('06/4: archived original link is missing');
  if($('diagramWarning').textContent.includes('оспорено преподавателем')) failures.push('06/4: obsolete and incorrect teacher dispute notice was restored');
  if($('problemBrief').textContent.includes('(исходник найден; решение проверяется)')) failures.push('06/4: independently verified source still marked provisional');
  if(!$('variantNote').textContent.includes('Исходные данные и построение сверены')) failures.push('06/4: reviewed original not reflected in variant summary');
  select('03',5);
  if($('problemBrief').textContent.includes('(исходник найден; решение проверяется)')) failures.push('03/5: verified original still marked provisional');
  if(!$('diagramWarning').textContent.includes('Построение сверено с оригиналом')) failures.push('03/5: verified construction method status missing');
  select('13',6);
   if(!$('dynamicInputs').querySelector('a[href="./source-photos/scans/variant-13.jpg"]'))
     failures.push('13/6: public scan link missing');
  if(!window.SITEMATH_SCHEMES['13'].task6.sourceGeometry)
    failures.push('13/6: actual university album tracing missing');
  if($('problemBrief').textContent.includes('(исходник найден; решение проверяется)'))
    failures.push('13/6: verified university source still incorrectly marked provisional');
  if($('dynamicInputs').textContent.includes('не подтверждено бумажным оригиналом'))
    failures.push('13/6: private album original provenance missing');
  select('01',1);
   if(!$('dynamicInputs').querySelector('a[href="./source-photos/scans/variant-01.jpg"]'))
     failures.push('01/1: numeric scan link missing');
   select('12',4);
  if(!$('dynamicInputs').querySelector('a[href="./source-photos/scans/variant-12.jpg"]')) failures.push('source 12/4: direct archived original sheet link missing');
  if($('problemBrief').textContent.includes('Дано (не сверено)')) failures.push('verified 12/4: incorrect provenance warning');
  if($('diagramWarning').textContent.includes('Исходное условие НЕ проверено')) failures.push('verified 12/4: incorrectly labeled unsourced');
} catch(e){ failures.push('visible input provenance: '+e.stack); }

// "Дано / Найти" already exists for graphical tasks and is mandatory.
 // Do not duplicate it in the UI, but never allow later refactors to hide or
 // empty it for a digitized variant.
if (!onlyVariant && !onlyTask) try {
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    for(const task of [4,5,6]){
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      const brief=$('problemBrief');
      const given=($('problemGiven')?.textContent||'').trim();
      const find=($('problemFind')?.textContent||'').trim();
      if(!brief || brief.hidden){
        failures.push('problem brief '+variant+'/'+task+': Дано/Найти block is hidden');
      }
      if(!given) failures.push('problem brief '+variant+'/'+task+': Дано is empty');
      if(!find) failures.push('problem brief '+variant+'/'+task+': Найти is empty');
      // Preserve every original plane notation (including special Greek
      // symbols and projected planes) exactly in the Given/Find summary.
      const statement=window.SITEMATH_DATA.variants[variant]?.['task'+task]?.statement||'';
      const sourceNames=[...statement.matchAll(/([ΣΔΘΩΒΓ]\s*\([^)]*\))/gu)]
        .map(x=>x[1].replace(/\s+/g,''));
      for(const sourceName of sourceNames){
        if(!given.replace(/\s+/g,'').includes(sourceName))
          failures.push('problem brief '+variant+'/'+task+
            ': original plane notation missing: '+sourceName);
      }
      if(task===4){
        const sourceOp=window.SITEMATH_SCHEMES[variant].task4.operation;
        if(sourceOp?.through && !given.includes('т. '+sourceOp.through))
          failures.push('problem brief '+variant+'/4: source through-point missing');
        if(sourceOp?.resultPoint && !find.includes(sourceOp.resultPoint))
          failures.push('problem brief '+variant+'/4: required result point missing');
      }
      if(task===5){
        const actualLine=window.SITEMATH_SCHEMES[variant].task5.givenLine==='f'?'f':'ℓ';
        if(!given.includes('прямая '+actualLine) || !find.includes('K = '+actualLine+' ∩ '))
          failures.push('problem brief '+variant+'/5: paper given-line f/ℓ was relabeled');
      }
      if(task===6){
        const through=window.SITEMATH_SCHEMES[variant].task6.pointLabel||'K';
        if(!given.includes('т. '+through) || !find.includes('через '+through))
          failures.push('problem brief '+variant+'/6: paper through-point was relabeled');
      }
      // Tasks 4-6 are graphical conditions, not numeric coordinate tables.
      // Internal raster tracing or QA notices must never leak into "Дано".
      if($('dataTitle').textContent!=='Исходная схема' ||
         $('dynamicInputs').querySelectorAll('.coord-input').length){
        failures.push('problem brief '+variant+'/'+task+': diagram mistaken for coordinate input');
      }
      if(/координат|скан|проверен|проверяется|сверено|исходник/i.test(given)){
        failures.push('problem brief '+variant+'/'+task+': provenance leaked into paper condition');
      }
      if((variant==='12'&&task===6)||(variant==='13'&&task===5)){
        const notice=$('diagramWarning').textContent;
        const status=$('dynamicInputs').textContent;
        if(!notice.includes('без координат') || !notice.includes('метод построения проверены'))
          failures.push('problem brief '+variant+'/'+task+': graphical-source precision explanation missing');
        if(!status.includes('исходный лист и метод построения проверены'))
          failures.push('problem brief '+variant+'/'+task+': audited method misreported as pending');
      }
      if(task===4 && !/пл\./i.test(given)){
        failures.push('problem brief '+variant+'/4: Дано does not identify the source plane');
      }
      if(task===5 && (!/пл\./i.test(given) || !given.includes(window.SITEMATH_SCHEMES?.[variant]?.task5?.givenLine==='f'?'f':'ℓ'))){
        failures.push('problem brief '+variant+'/5: Дано must contain plane and original given line');
      }
      if(task===6 && (!/пл\./i.test(given) || !/[KM]/.test(given))){
        failures.push('problem brief '+variant+'/6: Дано must contain both planes and the through-point');
      }
    }
  }
} catch(e) {
  failures.push('problem brief regression: '+e.stack);
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

// The original task-5 plane is not always a triangle. The transfer
// instruction must name only the defining objects of the chosen variant.
if (!onlyVariant && !onlyTask) try {
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='5';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const scheme=window.SITEMATH_SCHEMES[variant].task5;
    const action=$('stepAction').textContent;
    if(scheme.planeType==='ABC'){
      if(!action.includes('треугольника ABC')) failures.push('task5 source '+variant+': triangle was not named');
    } else {
      if(action.includes('треугольника ABC')) failures.push('task5 source '+variant+': invented triangle');
      const refs=scheme.planeLines||Object.keys(scheme.lines||{}).filter(x=>x!==scheme.givenLine);
      for(const name of refs.slice(0,2)) if(!action.includes(name)){
        failures.push('task5 source '+variant+': missing given line '+name);
      }
    }
  }
} catch(e){ failures.push('task5 variant-specific source instructions: '+e.stack); }

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
    const shown=window.SITEMATH_SCHEMES?.[variant]?.task5?.givenLine==='f'?'f':'ℓ';
    if(!labels.includes(shown+'₁')||!labels.includes(shown+'₂')){
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
    const givenSymbol=window.SITEMATH_SCHEMES?.[variant]?.task5?.givenLine==='f'?'f':'ℓ';
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value='5';
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();

    const total=Number($('stepTotal').textContent)||1;
    let sawOmega=false,saw12=false,sawM=false,sawK=false,sawPairedK=false;
    let saw34seed=false,saw34=false,saw56seed=false,saw56=false,sawVisibility=false;
    for(let n=0;n<total;n++){
      const title=$('stepTitle').textContent.trim();
      const labels=[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent);
      const kCount=labels.filter(x=>/^K[₁₂]$/.test(x)).length;
      if(title.includes('вспомогательную плоскость Ω')){
        sawOmega=true;
        if(labels.some(x=>/^1[₁₂]$|^2[₁₂]$|^K[₁₂]$/.test(x)))
          failures.push('task5 sequence '+variant+': derived points exist while Ω is only introduced');
      }
      if(title.startsWith('Найди 1')){
        if(!sawOmega)failures.push('task5 sequence '+variant+': section points before Ω');
        if(!labels.some(x=>/^1[₁₂]$/.test(x))||!labels.some(x=>/^2[₁₂]$/.test(x)))
          failures.push('task5 sequence '+variant+': points 1/2 missing');
        if(kCount)failures.push('task5 sequence '+variant+': K appears before m');
        saw12=true;
      }
      if(title.startsWith('Построй m')){
        if(!saw12)failures.push('task5 sequence '+variant+': m before sections 1/2');
        if(!labels.some(x=>/^m[₁₂]$/.test(x)))failures.push('task5 sequence '+variant+': m missing');
        if(kCount)failures.push('task5 sequence '+variant+': K created simultaneously with m');
        sawM=true;
      }
      if(title.startsWith('Найди K')){
        if(!sawM)failures.push('task5 sequence '+variant+': K before m');
        if(kCount!==1)failures.push('task5 sequence '+variant+': first K must be the only K projection');
        sawK=true;
      }
      if(title.startsWith('Перенеси K')){
        if(!sawK)failures.push('task5 sequence '+variant+': paired K before first K');
        if(kCount!==2)failures.push('task5 sequence '+variant+': K paired projection missing');
        sawPairedK=true;
      }
      if(title.startsWith('Видимость на Π₁')){
        if(!sawPairedK)failures.push('task5 sequence '+variant+': competing 3/4 before both K projections');
        if(!labels.includes('3₁≡4₁'))failures.push('task5 sequence '+variant+': 3₁≡4₁ absent at first coincidence');
        if(labels.includes('3₂')||labels.includes('4₂'))
          failures.push('task5 sequence '+variant+': 3₂/4₂ appears before its projector');
        saw34seed=true;
      }
      if(title.startsWith('Перенеси 3₁≡4₁')){
        if(!saw34seed)failures.push('task5 sequence '+variant+': 3₂/4₂ before 3₁≡4₁');
        for(const x of ['3₁≡4₁','3₂','4₂'])
          if(!labels.includes(x))failures.push('task5 sequence '+variant+': missing '+x);
        saw34=true;
      }
      if(title.startsWith('Видимость на Π₂')){
        if(!sawPairedK)failures.push('task5 sequence '+variant+': competing 5/6 before both K projections');
        if(!labels.includes('5₂≡6₂'))failures.push('task5 sequence '+variant+': 5₂≡6₂ absent at first coincidence');
        if(labels.includes('5₁')||labels.includes('6₁'))
          failures.push('task5 sequence '+variant+': 5₁/6₁ appears before its projector');
        saw56seed=true;
      }
      if(title.startsWith('Перенеси 5₂≡6₂')){
        if(!saw56seed)failures.push('task5 sequence '+variant+': 5₁/6₁ before 5₂≡6₂');
        for(const x of ['5₂≡6₂','5₁','6₁'])
          if(!labels.includes(x))failures.push('task5 sequence '+variant+': missing '+x);
        saw56=true;
      }
      if(title.startsWith('Нанеси видимость '+givenSymbol)){
        if(!saw34||!saw56)failures.push('task5 sequence '+variant+': visibility before competing points');
        sawVisibility=true;
      }
      if(n<total-1)$('nextBtn').click();
    }
    if(!sawOmega||!saw12||!sawM||!sawK||!sawPairedK||!saw34seed||!saw34||!saw56seed||!saw56||!sawVisibility)
      failures.push('task5 sequence '+variant+': incomplete Ω / 1-2 / m / K / paired K / competitors / visibility chain');
  }
} catch(e) {
  failures.push('task5 all-variant construction sequence regression: '+e.stack);
}

// Warn about large mathematical corrections of an unverified paper trace:
 // such a drawing must not be passed off as a faithful copy of the sheet.
if (!onlyVariant && !onlyTask) try {
  $('variantSelect').value='10';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='5';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  const warning=$('dynamicInputs').textContent;
  if(!warning.includes('повторно сверено с доступным оригиналом') ||
     !$('dynamicInputs').querySelector('a[href="./source-photos/scans/variant-10.jpg"]')){
    failures.push('source correction audit: variant 10/5 must show recovered original');
  }
  if(warning.includes('20,8')){
    failures.push('source correction audit: obsolete 20.8-unit mismatch from old 10/5 trace');
  }

  $('variantSelect').value='12';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='4';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  if($('dynamicInputs').textContent.includes('Требуется сверка') ||
     $('dynamicInputs').textContent.includes('Требуется проверка пересечения')){
    failures.push('source correction warning: refined 12/4 should not be flagged as an inconsistent source');
  }

  $('variantSelect').value='14';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='6';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  // The recovered full-size 14/6 original was re-traced. Its projector
  // now intersects at the actual photographed crossing rather than at the
  // old divergent placeholder coordinates.
  if($('dynamicInputs').textContent.includes('Требуется проверка пересечения')){
    failures.push('source intersection warning: 14/6 photographed plane remains geometrically inconsistent');
  }
} catch(e) {
  failures.push('source correction warning regression: '+e.stack);
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
    const coincident=()=>[...window.document.querySelectorAll('#drawing line[data-source-coincident-aux="1"]')];
    $('lastBtn').click();
    if(source().length!==0){
      failures.push('task5 occlusion '+variant+': original solid ℓ survives behind final visibility');
    }
    if(coincident().length!==0){
      failures.push('task5 occlusion '+variant+': solid Ω guide survives underneath dashed ℓ');
    }
    const hidden=[...window.document.querySelectorAll('#drawing line.hidden-line')];
    if(hidden.length<1){
      failures.push('task5 occlusion '+variant+': no hidden segment in final visibility result');
    }
    if(hidden.some(line=>line.style.strokeDasharray)){
      failures.push('task5 occlusion '+variant+': line animation replaced dashed stroke pattern');
    }
    const labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    const shown=window.SITEMATH_SCHEMES?.[variant]?.task5?.givenLine==='f'?'f':'ℓ';
    if(!labels.includes(shown+'₁')||!labels.includes(shown+'₂')){
      failures.push('task5 occlusion '+variant+': given-line labels disappeared');
    }
    $('prevBtn').click();
    if(source().length!==2||coincident().length!==1){
      failures.push('task5 occlusion '+variant+': stepping back did not restore the given line and Ω guide');
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
    const pTransfer=idx('Перенеси P₁');
    if(!frames[p].labels.includes('P₁')||frames[p].labels.includes('P₂'))
      failures.push('task6 pedagogy 04: P must first appear only as P₁');
    if(pTransfer!==p+1||!frames[pTransfer]?.labels.includes('P₂')||!frames[pTransfer]?.labels.includes('P₁'))
      failures.push('task6 pedagogy 04: projector step must subsequently derive P₂');
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
    const seen={alpha:false,beta:false,p:false,q:false,pTransfer:false,qTransfer:false};
    let firstP=null,firstQ=null;
    for(let n=0;n<total;n++){
      const title=$('stepTitle').textContent.trim();
      const labels=[...window.document.querySelectorAll('#drawing text')].map(el=>el.textContent);
      const has=name=>labels.filter(x=>x===name+'₁'||x===name+'₂');
      if(title==='Выбери вспомогательную плоскость α'){
        seen.alpha=true;
        if(has('P').length)failures.push('task6 pedagogy '+variant+': P before alpha section');
      }
      if(title.startsWith('Пересеки линии сечения α и получи P')){
        if(!seen.alpha||seen.p)failures.push('task6 pedagogy '+variant+': premature or duplicate P derivation');
        if(has('P').length!==1)failures.push('task6 pedagogy '+variant+': only one first P projection may appear');
        firstP=n;
        seen.p=true;
      }
      if(title.startsWith('Перенеси P')){
        if(firstP===null||n!==firstP+1)failures.push('task6 pedagogy '+variant+': P projector not immediately after first P');
        if(!labels.includes('P₁')||!labels.includes('P₂'))
          failures.push('task6 pedagogy '+variant+': second P projection missing after projector');
        seen.pTransfer=true;
      }
      if(title==='Выбери вспомогательную плоскость β'){
        if(!seen.pTransfer)failures.push('task6 pedagogy '+variant+': beta before P projector');
        seen.beta=true;
        if(has('Q').length)failures.push('task6 pedagogy '+variant+': Q exists before beta section');
      }
      if(title.startsWith('Пересеки линии сечения β и получи Q')){
        if(!seen.beta||seen.q)failures.push('task6 pedagogy '+variant+': premature or duplicate Q derivation');
        if(has('Q').length!==1)failures.push('task6 pedagogy '+variant+': only one first Q projection may appear');
        firstQ=n;
        seen.q=true;
      }
      if(title.startsWith('Перенеси Q')){
        if(firstQ===null||n!==firstQ+1)failures.push('task6 pedagogy '+variant+': Q projector not immediately after first Q');
        if(!labels.includes('Q₁')||!labels.includes('Q₂'))
          failures.push('task6 pedagogy '+variant+': second Q projection missing after projector');
        seen.qTransfer=true;
      }
      if(n<total-1)$('nextBtn').click();
    }
    if(Object.values(seen).some(x=>!x))
      failures.push('task6 pedagogy '+variant+': incomplete alpha/P₁/P₂/beta/Q₁/Q₂ chain');
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
    const task4Scheme=window.SITEMATH_SCHEMES?.[variant]?.task4;
    const sourceGivenLines=window.document.querySelectorAll('#drawing line[data-role="given"]');
    const sourceGuides=window.document.querySelectorAll('#drawing line.source-guide-line');
    if(task4Scheme?.sourceABCVerticesOnly){
      // Some originals contain only individual vertex projectors.
      // Do not demand invented triangle sides on their first frame.
      if(sourceGivenLines.length!==0 ||
         window.document.querySelectorAll('#drawing line.object-line').length!==0 ||
         sourceGuides.length<4)
        failures.push('task4 roles '+variant+': original vertex-only source was contaminated or projectors missing');
      const labels=[...window.document.querySelectorAll('#drawing text')].map(x=>x.textContent);
      for(const label of ['A₁','A₂','B₁','B₂','C₁','C₂'])
        if(!labels.includes(label))
          failures.push('task4 roles '+variant+': vertex-only source missing '+label);
    } else if(!sourceGivenLines.length){
      failures.push('task4 roles '+variant+': source has no given lines');
    }

    // Next step introduces x12 as a construction reference, not source geometry.
    $('nextBtn').click();
    let labels=[...window.document.querySelectorAll('#drawing text')].map(n=>n.textContent);
    if(!labels.includes('x₁₂')) failures.push('task4 axis '+variant+': x₁₂ missing');
    const xAxis=window.document.querySelector('#drawing line.axis[data-role="construction"]');
    if(!xAxis) failures.push('task4 axis '+variant+': x₁₂ is not classified as construction');

    if(task4Scheme?.sourceABCVerticesOnly){
      // The reference axis is followed by two separate pencil operations:
      // connect A-B-C on Π₁ first, and on Π₂ afterwards.
      const strokeCount=()=>{
        return [...window.document.querySelectorAll('#drawing line.construction-line')]
          .filter(el=>el.getAttribute('data-role')==='construction').length;
      };
      $('nextBtn').click();
      if(!($('stepTitle')?.textContent||'').startsWith('Соедини A₁') ||
         strokeCount()<3)
        failures.push('task4 vertex-only '+variant+': three Π₁ edges not explicitly constructed');
      $('nextBtn').click();
      if(!($('stepTitle')?.textContent||'').startsWith('Соедини A₂') ||
         strokeCount()<6)
        failures.push('task4 vertex-only '+variant+': three Π₂ edges not explicitly constructed');
    }
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
        if(aux<1) failures.push('auxiliary construction '+variant+'/5: section line m missing ('+aux+')');
        const given=window.SITEMATH_SCHEMES?.[variant]?.task5?.givenLine==='f'?'f':'ℓ';
        const hasPrimary1=labels.includes('Ω₁≡'+given+'₁')&&labels.includes('m₂');
        const hasPrimary2=labels.includes('Ω₂≡'+given+'₂')&&labels.includes('m₁');
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
    const sourceVerified=window.SITEMATH_SCHEMES['12']['task'+task].sourceVerified===true;
    if(sourceVerified){
      if(!text.includes('оригинал') || !text.includes('проверены'))
        failures.push('diagram warning '+task+': reviewed construction still presented as unverified');
    }else{
      if(!text.includes('скан'))
        failures.push('diagram warning '+task+': recovered source scan not mentioned');
      if(!text.includes('провер'))
        failures.push('diagram warning '+task+': pending method verification not mentioned');
    }
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
  if(!$('dynamicInputs').textContent.includes('source-photos/scans/variant-12.jpg')) failures.push('source status 12: canonical scan ID missing');

  $('variantSelect').value='03';
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='4';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  if(!$('dynamicInputs').textContent.includes('повторно сверено с доступным оригиналом')) failures.push('source status 03: verified task4 source not reflected in UI');
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
  if(window.document.querySelectorAll('#drawing line.aux-line[data-role="auxiliary"]').length<1){
    failures.push('task5 roles: section line m is not classified as auxiliary');
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

// Audit the provenance AND structural consistency of every programmed
// task. Solver success does not prove any handwritten assignment was copied
// correctly. Only readable, independently cross-checked source material
// may set sourceVerified=true.
try {
  const schemes=window.SITEMATH_SCHEMES||{};
  const originalVariant=window.SITEMATH_DATA.variants||{};
  const complete=Object.keys(originalVariant).filter(v=>schemes[v] && [4,5,6].every(k=>schemes[v]['task'+k]));
  if(complete.length!==20)failures.push('assignment audit: expected 20 digitized variants, got '+complete.length);
  for(const v of complete){
    for(const task of [4,5,6]){
      const g=schemes[v]['task'+task];
      const info=originalVariant[v]['task'+task];
      if(!info?.statement)failures.push('assignment audit '+v+'/'+task+': no preserved condition text');
      if(g.sourceVerified!==(task===4 || ((v==='12'&&task===5)||(v==='13'&&task===6)) || ['01','02','03','04','05','06','07','08','09','10','11','14','15','16','17','18','19','20'].includes(v))){
        failures.push('assignment audit '+v+'/'+task+': source review differs from independently audited original');
      }
      if(task===4){
        if(g.planeType==='line_point' && (!g.lines?.[g.planeLine] || !g.points?.[g.planePoint])){
          failures.push('assignment audit '+v+'/4: point-and-line plane source is incomplete');
        }
        if(g.planeType==='parallel_lines' && !(g.planeLines||[]).every(key=>g.lines?.[key])){
          failures.push('assignment audit '+v+'/4: parallel defining lines missing');
        }
        if(g.planeType==='intersecting_lines' && !(g.planeLines||[]).every(key=>g.lines?.[key])){
          failures.push('assignment audit '+v+'/4: intersecting defining lines missing');
        }
        const op=g.operation;
        if(op?.through && !g.points?.[op.through]){
          failures.push('assignment audit '+v+'/4: named source point '+op.through+' is absent');
        }
        if(op?.type==='line_intersects_named' && !g.lines?.[op.target]){
          failures.push('assignment audit '+v+'/4: named target line '+op.target+' is absent');
        }
      }else if(task===5){
        if(g.planeType==='ABC' && !['A','B','C'].every(k=>g.points?.[k])){
          failures.push('assignment audit '+v+'/5: ABC defining points missing');
        }
        if(g.givenLine && !g.lines?.[g.givenLine]){
          failures.push('assignment audit '+v+'/5: intersecting line '+g.givenLine+' missing');
        }
      }else {
        if(!g.planeA||!g.planeB){
          failures.push('assignment audit '+v+'/6: two defining planes required');
        }
        if(!(g.pointK||g.pointThrough)){
          failures.push('assignment audit '+v+'/6: given point K/M missing');
        }
      }
    }
  }
  if(schemes['06']?.task4?.sourceVerified!==true){
    failures.push('assignment audit 06/4: corrected scanned m₂/n₂ topology must be source-verified');
  }
} catch(e){
  failures.push('assignment source audit: '+e.stack);
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

// The background grid is the only copy guide: its origin follows a given
// point, while the original drawing remains unchanged.
try {
  for(const task of [4,5,6]){
    $('variantSelect').value='12';
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const svg=$('drawing');
    const x=Number(svg.getAttribute('data-grid-phase-x'));
    const y=Number(svg.getAttribute('data-grid-phase-y'));
    const layers=[...svg.querySelectorAll('rect[fill^="url(#"]')];
    if(layers.length!==2 ||
       layers[0].getAttribute('fill')!=='url(#minorGrid)' ||
       layers[1].getAttribute('fill')!=='url(#majorGrid)'){
      failures.push('grid alignment 12/'+task+': grid patterns not composed in one coordinate system');
    }
    for(const p of [svg.querySelector('#minorGrid'),svg.querySelector('#majorGrid')]){
      if(!p || Math.abs(Number(p.getAttribute('x'))-x)>1e-6 ||
        Math.abs(Number(p.getAttribute('y'))-y)>1e-6){
        failures.push('grid alignment 12/'+task+': minor/major pattern origin mismatch');
      }
    }
    // Any given point may lie between cell crossings. The *reference axes*
    // must coincide with full, straight grid lines, as in a squared notebook.
    // The original geometry is never rounded to individual cells.
    if(!svg.querySelector('line.object-line')){
      failures.push('grid alignment 12/'+task+': given geometry missing');
    }
    if($('notebookTransfer')||svg.querySelector('.notebook-origin,.notebook-endpoint,.notebook-grid-offset')){
      failures.push('grid alignment 12/'+task+': unnecessary copy overlay remains');
    }
    $('nextBtn').click();
    const axes=[...svg.querySelectorAll('line.axis')];
    const nearGrid=(value,offset)=>{
      const k=(value-offset)/5;
      return Math.abs(k-Math.round(k))<1e-6;
    };
    const v=axes.find(e=>Math.abs(Number(e.getAttribute('x1'))-Number(e.getAttribute('x2')))<1e-6);
    const h=axes.find(e=>Math.abs(Number(e.getAttribute('y1'))-Number(e.getAttribute('y2')))<1e-6);
    if(!v||!h)failures.push('grid alignment 12/'+task+': reference axes missing');
    else if(!nearGrid(Number(v.getAttribute('x1')),x)||!nearGrid(Number(h.getAttribute('y1')),y)){
      failures.push('grid alignment 12/'+task+': x12 or z axis is between grid lines');
    }
    if(Math.abs(Number(svg.getAttribute('data-grid-phase-x'))-x)>1e-8 ||
       Math.abs(Number(svg.getAttribute('data-grid-phase-y'))-y)>1e-8){
      failures.push('grid alignment 12/'+task+': background grid jumps between steps');
    }
  }
}catch(e){failures.push('grid alignment regression: '+e.stack);}

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
          // Working projections must share ONE projector exactly. The
          // original photo trace (sourceGeometry) may differ by subpixel
          // tracing error, but that discrepancy cannot leak into the solver.
          if(j.p1 && j.p2 && Math.abs(+j.p1[0]-+j.p2[0])>1e-4){
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
      const expected=task===4 || ((variant==='12'&&task===5)||(variant==='13'&&task===6)) || ['01','02','03','04','05','06','07','08','09','10','11','14','15','16','17','18','19','20'].includes(variant);
      if(scheme.sourceVerified!==expected ||
         scheme.sourceRecheckRequired===expected)
        failures.push('source verification '+variant+'/'+task+': status differs from independent source review');
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
    if(window.SITEMATH_SCHEMES?.['12']?.['task'+task]?.sourceId!=='source-photos/scans/variant-12.jpg'){
      failures.push('variant12/task'+task+': canonical scan id missing');
    }
  }
  // The printed variant 19 K₁/K₂ was separately traced at x=589.470/589.906.
  // Verify the immutable source photo data AND the normalized, exact 3D
  // intersection of its defining lines on both orthogonal projections.
  const v19=window.SITEMATH_SCHEMES?.['19']?.task4;
  const raw=v19?.sourceGeometry?.junctions?.[0],work=v19?.junctions?.[0];
  const distance=(p,seg)=>{
    const dx=seg[1][0]-seg[0][0],dy=seg[1][1]-seg[0][1];
    return Math.abs(dx*(p[1]-seg[0][1])-dy*(p[0]-seg[0][0]))/Math.hypot(dx,dy);
  };
  if(!raw||!work||Math.abs(raw.p1[0]-589.470)>1e-5||
     Math.abs(raw.p2[0]-589.906)>1e-5||
     Math.abs(work.p1[0]-work.p2[0])>1e-5)
    failures.push('19/4: source K trace overwritten or working K projections not aligned');
  else for(const side of ['p1','p2']){
    if(distance(work[side],v19.lines.a[side])>1e-4||
       distance(work[side],v19.lines.b[side])>1e-4)
      failures.push('19/4: working K not exactly on both defining '+side+' lines');
  }
  const v03=window.SITEMATH_SCHEMES?.['03']?.task5;
  const raw03=v03?.sourceGeometry?.junctions?.[0];
  const work03=v03?.junctions?.[0];
  if(!raw03||!work03||
     Math.abs(raw03.p1[0]-249.09391049156272)>1e-5||
     Math.abs(raw03.p2[0]-263.0653950953678)>1e-5||
     Math.abs(work03.p1[0]-work03.p2[0])>1e-5)
    failures.push('03/5: original source junction changed or working pair misaligned');
  else for(const side of ['p1','p2']){
    if(distance(work03[side],v03.lines.a[side])>1e-4||
       distance(work03[side],v03.lines.f[side])>1e-4)
      failures.push('03/5: working junction not precisely on a and f '+side);
  }
} catch(e) {
  failures.push('variant12/19 source geometry metadata: '+e.stack);
}

// Full staged-construction dependency regression for the same 20 scanned
// originals. Unlike an isolated final image, this checks the ORDER of every
// pencil operation. Do not assert that this substitutes manual visual proof.
// All 60 graphical tasks are replayed within the existing runtime test;
// no separate STEPWISE_AUDIT screenshot workflow is triggered.
if (!onlyVariant && !onlyTask) try {
  const missing=(variant,task,what)=>failures.push(
    'stepwise sequence '+variant+'/'+task+': '+what);
  let checked=0,checkedTasks=0,explainedNewLabels=0;
  for(const variant of variants){
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    for(const task of [4,5,6]){
      $('taskSelect').value=String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      $('firstBtn').click();
      const total=Number($('stepTotal').textContent);
      if(!(total>=10&&total<=40)){
        missing(variant,task,'implausible step count '+total);continue;
      }
      const titles=[];
      let former=null;
      const previouslyIntroduced=new Set();
      for(let i=0;i<total;i++){
        const title=$('stepTitle').textContent.trim();
        titles.push(title);
        if(!title || !$('stepAction').textContent.trim() ||
           !$('stepWhy').textContent.trim() ||
           !$('stepCheck').textContent.trim()){
          missing(variant,task,'incomplete explanation at step '+(i+1));
        }
        if(!window.document.querySelector('#drawing line, #drawing circle')){
          missing(variant,task,'empty drawing at step '+(i+1));
        }
        if(i>=2){
          checked++;
          // Whenever a new point appears, the student must be told exactly
          // which indexed projection is being marked. Distinguish FIRST
          // introduction from legitimate repeated K₁/K₂ result highlighting.
          const described=[
            $('stepTitle').textContent,$('stepAction').textContent,
            $('stepWhy').textContent,$('stepCheck').textContent,
            $('stepMeasure').textContent
          ].join(' ');
          const active=[...window.document.querySelectorAll(
            '#drawing circle[data-active="1"][data-label]')];
          for(const dot of active){
            const label=dot.getAttribute('data-label');
            const role=dot.getAttribute('data-role');
            if(!label||!['construction','result'].includes(role)||
               previouslyIntroduced.has(label))continue;
            previouslyIntroduced.add(label);
            explainedNewLabels++;
            if(!described.includes(label)){
              missing(variant,task,'introduced point '+label+
                ' is absent from step '+(i+1)+' explanation');
            }
          }
          const labels=new Set([...window.document.querySelectorAll('#drawing circle[data-label]')]
            .map(e=>e.getAttribute('data-label')).filter(Boolean));
          if(former){
            for(const label of former)if(!labels.has(label)){
              missing(variant,task,'previously drawn point '+label+
                ' vanished at step '+(i+1));
            }
          }
          former=labels;
        }
        if(i+1<total)$('nextBtn').click();
      }
      checkedTasks++;
      const find=cue=>titles.findIndex(s=>s.includes(cue));
      const order=(cues,kind)=>{
        const positions=cues.map(find);
        if(positions.some(i=>i<0) ||
           positions.some((p,i)=>i>0 && p<=positions[i-1])){
          missing(variant,task,kind+' incorrect or incomplete: '+
            cues.map((c,i)=>c+'='+positions[i]).join(', '));
        }
      };
      if(task===4){
        order(['h₂','h₁','f₁','f₂','ЛС₁','ЛС₂'],
          'horizontal/frontal/greatest-slope');
        if(!titles[total-2].startsWith('Построй '))
          missing(variant,task,'terminal positioned point missing');
      }else if(task===5){
        order(['вспомогательную плоскость Ω','Найди 1','Перенеси 1','Построй m',
          'Найди K','Перенеси K','Видимость на Π₁',
          'Перенеси 3','Видимость на Π₂','Перенеси 5'],
          'section/intersection/competing-point visibility');
        if(variant==='20' && titles.some(t=>t.includes('ℓ')))
          missing(variant,task,'the given line f was renamed ℓ');
      }else{
        order(['плоскость α','получи P','плоскость β','получи Q',
          'Соедини P и Q','проведи ℓ'],
          'two sections/common points/parallel result');
        const point=variant==='04'?'M':'K';
        if(!titles[total-2].startsWith('Через '+point+' '))
          missing(variant,task,'wrong through-point '+point);
      }
    }
  }
  if(checkedTasks!==60 || checked<890||explainedNewLabels<900)
    failures.push('stepwise sequence coverage: '+checkedTasks+
      ' tasks, '+checked+' post-introduction stages, '+
      explainedNewLabels+' newly explained labeled points');
  else console.log('Stepwise dependencies:',checkedTasks,
    'tasks,',checked,'post-introduction stages and',
    explainedNewLabels,'first-introduced point labels checked');
} catch(e){
  failures.push('all-variant staged method regression: '+e.stack);
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

// Full independent numeric geometry audit for all digitized variants,
// including archival-only 07/13. This checks the actual drawn points and
// displayed 3D lengths/angles, not merely that the page rendered.
if (!onlyVariant && !onlyTask) try {
  const data=window.SITEMATH_DATA.variants;
  const tolerance=(actual,expected,context,eps=.025)=>{
    if(!Number.isFinite(actual)||Math.abs(actual-expected)>eps)
      failures.push('numeric Monge '+context+': drawn '+actual+', required '+expected);
  };
  const dot=label=>{
    const el=window.document.querySelector('#drawing circle[data-label="'+label+'"]');
    return el?{x:Number(el.getAttribute('cx')),y:Number(el.getAttribute('cy'))}:null;
  };
  const choose=(variant,task)=>{
    $('variantSelect').value=variant;
    $('variantSelect').dispatchEvent(new window.Event('change'));
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('lastBtn').click();
  };
  for(const variant of variants){
    for(const task of [1,2,3]){
      choose(variant,task);
      const O=dot('O'),n=task===1?(variant==='18'?'SABC':'ABCDE'):task===2?'AB':'ABC';
      const values=data[variant]['task'+task];
      if(!O){failures.push('numeric Monge '+variant+'/'+task+': origin missing');continue;}
      for(const label of n){
        const p=values[label];
        const q1=dot(label+'₁'),q2=dot(label+'₂');
        if(!q1||!q2){failures.push('numeric Monge '+variant+'/'+task+'/'+label+': projection missing');continue;}
        tolerance(q1.x,q2.x,variant+'/'+task+'/'+label+' same projector x');
        tolerance(q1.x-O.x,-p[0],variant+'/'+task+'/'+label+' x₁');
        tolerance(q1.y-O.y,p[1],variant+'/'+task+'/'+label+' y₁');
        tolerance(q2.y-O.y,-p[2],variant+'/'+task+'/'+label+' z₂');
        if(task===1){
          const q3=dot(label+'₃');
          if(!q3){failures.push('numeric Monge '+variant+'/1/'+label+': profile projection missing');continue;}
          tolerance(q3.x-O.x,p[1],variant+'/1/'+label+' y₃');
          tolerance(q3.y-O.y,-p[2],variant+'/1/'+label+' z₃');
        }
      }
      if(task===2){
        const A=values.A,B=values.B,d=B.map((x,i)=>x-A[i]);
        const length=Math.hypot(...d),alpha=Math.asin(Math.abs(d[2])/length)*180/Math.PI;
        const beta=Math.asin(Math.abs(d[1])/length)*180/Math.PI;
        const displayed=$('stepMeasure').textContent;
        const expected=[['AB =',length],['α(AB,Π₁) =',alpha],['β(AB,Π₂) =',beta]];
        for(const [prefix,value] of expected){
          const q=displayed.indexOf(prefix);
          const match=q<0?null:displayed.slice(q+prefix.length).match(/^\s*([0-9]+(?:[,.][0-9]+)?)/);
          if(!match){failures.push('numeric Monge '+variant+'/2: '+prefix+' missing');continue;}
          tolerance(Number(match[1].replace(',','.')),value,variant+'/2 '+prefix,.055);
        }
      }
      if(task===3){
        const a1=dot('A₁'),b1=dot('B₁'),a2=dot('A₂'),b2=dot('B₂');
        const k1=dot('K₁'),k2=dot('K₂');
        if(!k1||!k2){failures.push('numeric Monge '+variant+'/3: chosen intersection missing');continue;}
        const k=Number($('kSlider').value)/100;
        const check=(q,a,b,key)=>{
          tolerance(q.x,a.x+(b.x-a.x)*k,variant+'/3/K '+key+' x');
          tolerance(q.y,a.y+(b.y-a.y)*k,variant+'/3/K '+key+' y');
        };
        check(k1,a1,b1,'Π₁');
        check(k2,a2,b2,'Π₂');
      }
    }
  }
} catch(e){failures.push('independent all-variant Monge drawing audit: '+e.stack);}

fs.writeFileSync('runtime-results.json', JSON.stringify({failures}, null, 2));
if (failures.length) {
  console.error('\nFAILURES\n'+failures.join('\n'));
  process.exit(1);
}
console.log('\nAll photographed variant/task combinations rendered without runtime exceptions.');
