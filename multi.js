(() => {
  'use strict';

  const DATA = window.SITEMATH_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const GRID = 5;
  const EPS = 1e-8;
  const $ = id => document.getElementById(id);
  const svg = $('drawing');

  const state = {
    variant: null,
    task: null,
    step: 0,
    steps: [],
    geometry: null,
    playing: false,
    timer: null,
    customSchemes: {},
    calibrator: null,
    screenZoom: null,
    canvasPointers: new Map(),
    stepInfoMode: 'action',
    stepInfoPage: 0
  };

  const sources = {
    t1: 'Три ортогональные проекции точки определяются её координатами x, y, z.',
    t2: 'Метод прямоугольного треугольника: катет – проекция отрезка, второй катет – разность недостающей координаты.',
    t3: 'Пересекающиеся прямые имеют согласованные проекции общей точки; у параллельных прямых одноимённые проекции параллельны.'
  };

  function E(name, attrs, text) {
    const n = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([k,v]) => {
      if (v !== undefined && v !== null) n.setAttribute(k, String(v));
    });
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  function fmt(n, digits) {
    const d = digits === undefined ? 1 : digits;
    const v = Math.abs(n) < 1e-9 ? 0 : n;
    return Number.isInteger(v) ? String(v) : v.toFixed(d).replace('.', ',');
  }

  function signedCoord(n){
    const v=Math.abs(n)<1e-9?0:n;
    return v<0?'−'+fmt(Math.abs(v)):fmt(v);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function p3(a) { return {x:+a[0], y:+a[1], z:+a[2]}; }
  function sub3(a,b){ return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}; }
  function add3(a,b){ return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}; }
  function mul3(a,t){ return {x:a.x*t,y:a.y*t,z:a.z*t}; }
  function dot3(a,b){ return a.x*b.x+a.y*b.y+a.z*b.z; }
  function cross3(a,b){ return {x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}; }
  function norm3(a){ return Math.hypot(a.x,a.y,a.z); }
  function dist2(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
  function lerp2(a,b,t){ return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}; }
  function lerp3(a,b,t){ return add3(a,mul3(sub3(b,a),t)); }

  function vec2(a,b){ return {x:b.x-a.x,y:b.y-a.y}; }
  function norm2(v){ return Math.hypot(v.x,v.y); }
  function unit2(v){
    const n=norm2(v);
    return n<EPS ? {x:0,y:0} : {x:v.x/n,y:v.y/n};
  }
  function perp2(v){ return {x:-v.y,y:v.x}; }
  function add2(a,b){ return {x:a.x+b.x,y:a.y+b.y}; }
  function mul2(a,t){ return {x:a.x*t,y:a.y*t}; }

  function lineRole(cls){
    if(cls==='object-line') return 'given';
    if(cls==='source-guide-line') return 'given-guide';
    if(cls==='aux-line') return 'auxiliary';
    if(cls==='construction-line' || cls==='axis') return 'construction';
    if(cls==='answer-line' || cls==='hidden-line') return 'result';
    return 'construction';
  }

  function line(step,a,b,cls,extra){
    const className=cls||'construction-line';
    return Object.assign({type:'line',step,a,b,cls:className,role:lineRole(className)},extra||{});
  }
  function pointRole(cls){
    if(cls==='point-dot') return 'given';
    if(cls==='source-guide-dot') return 'given-guide';
    if(cls==='answer-dot') return 'result';
    return 'construction';
  }

  function point(step,p,label,cls){
    const className=cls||'point-dot';
    return {type:'point',step,p,label,cls:className,role:pointRole(className)};
  }
  function textEntity(step,p,label,cls){
    return {type:'text',step,p,label,cls:cls||'svg-note'};
  }
  function dim(step,a,b,label,offset){
    return {type:'dim',step,a,b,label,offset:offset||{x:0,y:0}};
  }
  function arc(step,c,r,a0,a1,label){
    return {type:'arc',step,c,r,a0,a1,label};
  }

  function angleMark(step,c,a,b,r,label){
    const va=unit2(vec2(c,a)), vb=unit2(vec2(c,b));
    let a0=Math.atan2(va.y,va.x);
    let delta=Math.atan2(va.x*vb.y-va.y*vb.x,va.x*vb.x+va.y*vb.y);
    if(delta<0){
      a0=Math.atan2(vb.y,vb.x);
      delta=-delta;
    }
    const mid=a0+delta/2;
    const textPos={
      x:c.x+Math.cos(mid)*(r+5),
      y:c.y+Math.sin(mid)*(r+5)
    };
    return [
      arc(step,c,r,a0,a0+delta,''),
      textEntity(step,textPos,label,'dimension-text')
    ];
  }

  function angleDeg(a,b){
    const v=vec2(a,b);
    if(norm2(v)<EPS) return null;
    return Math.atan2(Math.abs(v.y),Math.abs(v.x))*180/Math.PI;
  }

  function bounds(points, margin) {
    const m = margin === undefined ? 16 : margin;
    const good = points.filter(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!good.length) return {minX:0,minY:0,maxX:180,maxY:150,width:180,height:150,shiftX:0,shiftY:0};
    let minX=Math.min(...good.map(p=>p.x)), maxX=Math.max(...good.map(p=>p.x));
    let minY=Math.min(...good.map(p=>p.y)), maxY=Math.max(...good.map(p=>p.y));
    return {
      minX:minX-m,minY:minY-m,maxX:maxX+m,maxY:maxY+m,
      width:Math.max(150,maxX-minX+2*m),
      height:Math.max(120,maxY-minY+2*m)
    };
  }

  function shiftPoint(p,dx,dy){ return {x:p.x+dx,y:p.y+dy}; }

  function ceilToGrid(v){ return Math.ceil(v/GRID)*GRID; }

  function gridFrame(points,margin,minWidth,minHeight){
    const m=margin===undefined?25:margin;
    const good=points.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    if(!good.length) return {dx:25,dy:25,width:minWidth||180,height:minHeight||150};
    const minX=Math.min(...good.map(p=>p.x)),maxX=Math.max(...good.map(p=>p.x));
    const minY=Math.min(...good.map(p=>p.y)),maxY=Math.max(...good.map(p=>p.y));
    // Critical invariant: dx/dy are whole 5 mm cells. This keeps O on the
    // paper grid and preserves the true millimetre coordinates of every point.
    const dx=ceilToGrid(m-minX);
    const dy=ceilToGrid(m-minY);
    const width=ceilToGrid(Math.max(minWidth||0,maxX+dx+m));
    const height=ceilToGrid(Math.max(minHeight||0,maxY+dy+m));
    return {dx,dy,width,height};
  }

  function allVariantKeys(){
    return Object.keys(DATA.variants).sort((a,b)=>{
      const an=/^\d+$/.test(a), bn=/^\d+$/.test(b);
      if(an && bn) return Number(a)-Number(b);
      if(an) return -1;
      if(bn) return 1;
      return a.localeCompare(b,'ru');
    });
  }

  function variantDisplayNumber(key){
    return /^\d+$/.test(key) ? String(Number(key)) : key;
  }

  function variantDisplayLabel(key){
    if(key==='custom') return 'Свои данные';
    const v=DATA.variants[key];
    if(v && v.verifiedNumber===false) return 'Фото без номера';
    return 'Вариант '+variantDisplayNumber(key);
  }

  function validSelection(sel){
    return !!(sel && (sel.variant==='custom' || DATA.variants[sel.variant]) &&
      Number.isInteger(Number(sel.task)) && Number(sel.task)>=1 && Number(sel.task)<=6);
  }

  function loadSelection(){
    try {
      const saved=JSON.parse(localStorage.getItem('sitemath-selection')||'null');
      if(saved && saved.variant==='photo-unknown') saved.variant='18';
      return validSelection(saved) ? {variant:saved.variant,task:Number(saved.task)} : null;
    } catch (_) { return null; }
  }

  function saveSelection(){
    if(!state.variant || !state.task) return;
    try {
      localStorage.setItem('sitemath-selection',JSON.stringify({variant:state.variant,task:state.task}));
    } catch (_) {}
  }

  function renderFirstRunPicker(){
    const root=$('firstRunPicker');
    if(!root) return;
    const variants=$('firstRunVariants'),tasks=$('firstRunTasks');
    variants.innerHTML='';
    allVariantKeys().forEach(k=>{
      if(DATA.variants[k].verifiedNumber===false) return;
      const b=document.createElement('button');
      b.type='button';
      b.className='first-run-variant';
      b.dataset.variant=k;
      b.textContent=variantDisplayNumber(k);
      b.addEventListener('click',()=>{
        state.variant=k;
        renderFirstRunPicker();
      });
      variants.appendChild(b);
    });
    const own=document.createElement('button');
    own.type='button';
    own.className='first-run-variant';
    own.dataset.variant='custom';
    own.textContent='Свои';
    own.addEventListener('click',()=>{ state.variant='custom'; renderFirstRunPicker(); });
    variants.appendChild(own);

    tasks.innerHTML='';
    Object.keys(DATA.tasks).forEach(k=>{
      const n=Number(k),b=document.createElement('button');
      b.type='button';
      b.className='first-run-task';
      b.dataset.task=k;
      b.innerHTML='<span>'+k+'</span><b>'+esc(taskPickerLabel(n))+'</b><i>›</i>';
      b.addEventListener('click',()=>{ state.task=n; renderFirstRunPicker(); });
      tasks.appendChild(b);
    });

    variants.querySelectorAll('.first-run-variant').forEach(b=>{
      const on=b.dataset.variant===state.variant;
      b.classList.toggle('is-selected',on);
      b.setAttribute('aria-selected',on?'true':'false');
    });
    tasks.querySelectorAll('.first-run-task').forEach(b=>{
      const on=Number(b.dataset.task)===state.task;
      b.classList.toggle('is-selected',on);
      b.setAttribute('aria-selected',on?'true':'false');
    });

    $('firstRunVariantSummary').textContent=state.variant ? variantDisplayLabel(state.variant) : 'не выбран';
    $('firstRunTaskSummary').textContent=state.task ? '№'+state.task+' · '+taskPickerLabel(state.task) : 'не выбрано';
    $('firstRunStart').disabled=!(state.variant&&state.task);
  }

  function showFirstRunPicker(){
    renderFirstRunPicker();
    $('firstRunPicker').hidden=false;
    document.body.classList.add('first-run-open');
  }

  function finishFirstRun(){
    if(!state.variant||!state.task) return;
    $('variantSelect').value=state.variant;
    $('taskSelect').value=String(state.task);
    saveSelection();
    $('firstRunPicker').hidden=true;
    document.body.classList.remove('first-run-open');
    renderInputs();
    rebuild(true);
    setDrawingZoom('fit');
    updateMobileSummary();
  }

  function initSelectors(){
    const vs=$('variantSelect');
    vs.innerHTML='';
    allVariantKeys().forEach(k=>{
      const o=document.createElement('option');
      o.value=k;
      o.textContent=variantDisplayLabel(k);
      vs.appendChild(o);
    });
    const custom=document.createElement('option');
    custom.value='custom';
    custom.textContent='Свои данные';
    vs.appendChild(custom);
    vs.value=state.variant;

    const ts=$('taskSelect');
    ts.innerHTML='';
    Object.keys(DATA.tasks).forEach(k=>{
      const o=document.createElement('option');
      o.value=k;
      o.textContent=k + '. ' + DATA.tasks[k].title;
      ts.appendChild(o);
    });
    ts.value=String(state.task);
    $('knownVariants').textContent=String(allVariantKeys().filter(k=>DATA.variants[k].verifiedNumber!==false).length);
    renderChoicePickers();
  }

  function taskPickerLabel(task){
    return ({
      1:'Точки',
      2:'Отрезок AB',
      3:'Прямые',
      4:'Линии плоскости',
      5:'Прямая × плоскость',
      6:'Две плоскости'
    })[task] || DATA.tasks[task].title;
  }

  function renderChoicePickers(){
    const variants=$('variantChips');
    const tasks=$('taskCards');
    if(variants){
      variants.innerHTML='';
      allVariantKeys().forEach(k=>{
        const v=DATA.variants[k];
        if(v.verifiedNumber===false) return;
        const b=document.createElement('button');
        b.type='button';
        b.className='variant-chip';
        b.dataset.variant=k;
        b.setAttribute('role','option');
        b.innerHTML=k==='photo-unknown'
          ? '<span class="variant-number">?</span>'
          : '<span class="variant-number">'+esc(variantDisplayNumber(k))+'</span>';
        b.addEventListener('click',()=>{
          $('variantSelect').value=k;
          $('variantSelect').dispatchEvent(new Event('change'));
        });
        variants.appendChild(b);
      });
      const own=document.createElement('button');
      own.type='button';
      own.className='variant-chip own-data';
      own.dataset.variant='custom';
      own.setAttribute('role','option');
      own.innerHTML='<span class="variant-number">＋</span><span class="own-label">Свои</span>';
      own.addEventListener('click',()=>{
        $('variantSelect').value='custom';
        $('variantSelect').dispatchEvent(new Event('change'));
      });
      variants.appendChild(own);
    }

    if(tasks){
      tasks.innerHTML='';
      Object.keys(DATA.tasks).forEach(k=>{
        const n=Number(k);
        const b=document.createElement('button');
        b.type='button';
        b.className='task-choice';
        b.dataset.task=k;
        b.setAttribute('role','option');
        b.innerHTML='<span class="task-choice-number">'+k+'</span>'+
          '<span class="task-choice-copy"><b>'+esc(taskPickerLabel(n))+'</b></span>'+
          '<span class="task-choice-arrow">›</span>';
        b.addEventListener('click',()=>{
          $('taskSelect').value=k;
          $('taskSelect').dispatchEvent(new Event('change'));
        });
        tasks.appendChild(b);
      });
    }
    syncChoicePickers();
  }

  function syncChoicePickers(){
    document.querySelectorAll('.variant-chip').forEach(b=>{
      const on=b.dataset.variant===state.variant;
      b.classList.toggle('is-selected',on);
      b.setAttribute('aria-selected',on?'true':'false');
    });
    document.querySelectorAll('.task-choice').forEach(b=>{
      const on=Number(b.dataset.task)===state.task;
      b.classList.toggle('is-selected',on);
      b.setAttribute('aria-selected',on?'true':'false');
    });
    const vs=$('variantChoiceSummary');
    const ts=$('taskChoiceSummary');
    if(vs){
      vs.textContent=state.variant ? variantDisplayLabel(state.variant) : 'не выбран';
    }
    if(ts) ts.textContent=state.task ? '№'+state.task+' · '+taskPickerLabel(state.task) : 'не выбрано';
  }

  function currentVariant(){
    if(state.variant==='custom') return null;
    return DATA.variants[state.variant] || null;
  }

  function defaultTaskData(task){
    if(task===1) return {A:[30,40,20],B:[50,-20,40],C:[10,30,-30],D:[60,10,0],E:[20,-40,15]};
    if(task===2) return {A:[10,20,30],B:[60,-20,50]};
    if(task===3) return {A:[0,10,50],B:[30,25,30],C:[50,25,60]};
    return null;
  }

  function getStoredTaskData(){
    const v=currentVariant();
    return v ? v['task'+state.task] : defaultTaskData(state.task);
  }

  function extractPlaneNotations(statement){
    return [...String(statement||'').matchAll(/([ΣΔΘΩΒΓ]\s*\([^)]*\))/gu)].map(m=>m[1].replace(/\s+/g,''));
  }

  function planeDefNotation(def,symbol){
    const s=symbol||'Σ';
    if(!def) return s;
    if(def.type==='ABC') return s+'(ABC)';
    if(def.type==='line_point'){
      const lineName=def.lineName||Object.keys(def.lines||{})[0]||'a';
      const pointName=def.pointName||Object.keys(def.points||{})[0]||'A';
      return s+'('+lineName+','+pointName+')';
    }
    if(def.type==='parallel_lines') return s+'('+Object.keys(def.lines||{}).slice(0,2).join('∥')+')';
    if(def.type==='intersecting_lines') return s+'('+Object.keys(def.lines||{}).slice(0,2).join('∩')+')';
    if(def.type==='frontal_projecting') return s+'('+(def.name||s)+'₂)';
    if(def.type==='horizontal_projecting') return s+'('+(def.name||s)+'₁)';
    return s;
  }

  function task4OperationBrief(op){
    if(!op) return '';
    let part='';
    if(op.type==='line_parallel_plane') part='ℓ через '+op.through+', ℓ ∥ плоскости';
    else if(op.type==='line_parallel_horizontal') part='ℓ через '+op.through+', ℓ ∥ h';
    else if(op.type==='line_intersects_frontale') part='ℓ через '+op.through+', ℓ ∩ f';
    else if(op.type==='line_intersects_horizontal') part='ℓ через '+op.through+', ℓ ∩ h';
    else if(op.type==='line_intersects_named') part='ℓ через '+op.through+', ℓ ∩ '+(op.target||'a');
    const rel={
      above_line:'над ℓ',below_line:'под ℓ',behind_line:'за ℓ',front_of_line:'перед ℓ',
      above_named:'над '+(op.target||'a'),above_plane:'над плоскостью',
      below_plane:'под плоскостью',front_of_plane:'перед плоскостью'
    }[op.relation]||'';
    if(op.resultPoint && rel) part+=(part?'; ':'')+op.resultPoint+' '+rel;
    return part;
  }

  function renderProblemBrief(){
    const box=$('problemBrief');
    if(!box) return;
    if(!state.task || state.task<=3){
      box.hidden=true;
      return;
    }
    const stored=getStoredTaskData()||{};
    const scheme=state.variant==='custom'
      ? state.customSchemes[state.task]
      : (window.SITEMATH_SCHEMES?.[state.variant]?.['task'+state.task]);
    if(!scheme){
      box.hidden=true;
      return;
    }
    const notations=extractPlaneNotations(stored.statement);
    let given='',find='';
    if(state.task===4){
      let plane=notations[0];
      if(!plane){
        const planeSymbol=scheme.name||'Σ';
        if(scheme.planeType==='ABC') plane=planeSymbol+'(ABC)';
        else if(scheme.planeType==='line_point') plane=planeSymbol+'('+(scheme.planePoint||'A')+';'+(scheme.planeLine||'a')+')';
        else if(scheme.planeType==='parallel_lines') plane=planeSymbol+'('+(scheme.planeLines||[]).join('∥')+')';
        else if(scheme.planeType==='intersecting_lines') plane=planeSymbol+'('+(scheme.planeLines||[]).join('∩')+')';
        else plane='плоскость по исходной схеме';
      }
      given='пл. '+plane+(scheme.operation?.through?'; т. '+scheme.operation.through:'');
      find='h, f, ЛС';
      const extra=task4OperationBrief(scheme.operation);
      if(extra) find+='; '+extra;
    } else if(state.task===5){
      const plane=notations[0]||'Σ по исходной схеме';
      given='пл. '+plane+'; прямая ℓ';
      find='K = ℓ ∩ '+plane+'; видимость ℓ';
    } else {
      const a=notations[0]||planeDefNotation(scheme.planeA,'Σ');
      const b=notations[1]||planeDefNotation(scheme.planeB,'Θ');
      const through=scheme.pointLabel||'K';
      given='пл. '+a+'; пл. '+b+'; т. '+through;
      find='r = '+a+' ∩ '+b+'; через '+through+' провести ℓ ∥ обеим плоскостям';
    }
    $('problemGiven').textContent=given;
    $('problemFind').textContent=find;
    box.hidden=false;
  }

  function coordinateLabelsForTask(task){
    if(task===1) return ['A','B','C','D','E'];
    if(task===2) return ['A','B'];
    if(task===3) return ['A','B','C'];
    return [];
  }

  function sourcePairNames(names){
    return names.map(n=>sourceLineDisplayName(n)+'₁/'+sourceLineDisplayName(n)+'₂').join(', ');
  }

  function planeDefSourceLabels(def){
    if(!def) return [];
    const out=[];
    if(def.lines) for(const name of Object.keys(def.lines)) out.push(name+'₁/'+name+'₂');
    if(def.points) for(const name of Object.keys(def.points)) out.push(name+'₁/'+name+'₂');
    if(def.line){
      const name=def.name||'Π';
      out.push(name+(def.type==='frontal_projecting'?'₂':'₁'));
    }
    return out;
  }

  function diagramRoleSummary(task,scheme){
    if(!scheme) return null;
    if(task===4){
      const given=[];
      if(scheme.lines) given.push(...Object.keys(scheme.lines));
      if(scheme.points) given.push(...Object.keys(scheme.points));
      const op=scheme.operation||{};
      const built=['h','f','ЛС'];
      if(op.type) built.push('ℓ');
      if(op.resultPoint) built.push(op.resultPoint);
      return {
        given:sourcePairNames([...new Set(given)]),
        built:[...new Set(built)].join(', ')+'; N – вспомогательная опорная точка для дополнительного условия; тонкие проекторы и характерные точки – вспомогательные'
      };
    }
    if(task===5){
      const names=[];
      if(scheme.lines) names.push(...Object.keys(scheme.lines));
      if(scheme.points) names.push(...Object.keys(scheme.points));
      return {
        given:sourcePairNames([...new Set(names)]),
        built:'Ω – вспомогательная плоскость; 1/2 – точки её сечения с Σ; m – линия сечения; K – ответ; 3/4 и 5/6 – конкурирующие точки для видимости; штриховая часть ℓ – невидимый участок'
      };
    }
    const labels=[
      ...planeDefSourceLabels(scheme.planeA),
      ...planeDefSourceLabels(scheme.planeB)
    ];
    const through=scheme.pointLabel||'K';
    labels.push(through+'₁/'+through+'₂');
    const isProjecting=def=>['frontal_projecting','horizontal_projecting'].includes(def?.type);
    const sectionPoints=[];
    if(!isProjecting(scheme.planeA)) sectionPoints.push('1/2','5/6');
    if(!isProjecting(scheme.planeB)) sectionPoints.push('3/4','7/8');
    return {
      given:[...new Set(labels)].join(', '),
      built:'α/β – вспомогательные секущие плоскости; '+
        (sectionPoints.length?sectionPoints.join(', ')+' – точки построения сечений непроецирующих плоскостей; ':'')+
        'P/Q – общие точки; r – линия пересечения плоскостей; ℓ через '+through+' ∥ обеим плоскостям'
    };
  }

  function renderInputs(){
    const task=state.task;
    const holder=$('dynamicInputs');
    const v=currentVariant();
    const stored=getStoredTaskData();
    $('taskName').textContent = task + '. ' + DATA.tasks[task].title;
    if($('diagramWarning')) $('diagramWarning').hidden=task<=3;
    $('variantNote').textContent = state.variant==='custom'
      ? 'Ручной режим – координаты можно вводить самостоятельно.'
      : (v && v.provisionalNumber
          ? 'Этот лист временно помечен как вариант 18. Если найдётся другой подтверждённый вариант 18, номер будет исправлен.'
          : 'Данные взяты с присланного листа ' + variantDisplayLabel(state.variant) + '.');

    if(task<=3){
      $('dataTitle').textContent='Координаты, мм';
      const names=coordinateLabelsForTask(task);
      let html='<div class="coord-table"><div></div><div>X</div><div>Y</div><div>Z</div>';
      names.forEach(name=>{
        const a=(stored && stored[name]) ? stored[name] : [0,0,0];
        html += '<label>'+name+'</label>';
        ['x','y','z'].forEach((axis,i)=>{
          html += '<input class="coord-input" data-point="'+name+'" data-axis="'+axis+'" type="number" step="1" value="'+esc(a[i])+'" aria-label="'+name+' '+axis.toUpperCase()+'">';
        });
      });
      html+='</div>';
      holder.innerHTML=html;
      $('solverMode').textContent='точный расчёт';
      $('intersectionChoice').hidden = task!==3;
      $('taskStatement').textContent = task===1
        ? 'По заданным координатам построить комплексный чертёж и наглядное изображение точек в системе трёх плоскостей проекций.'
        : task===2
          ? 'По заданным координатам построить проекции отрезка AB. Определить натуральную величину отрезка двумя способами и углы наклона к плоскостям проекций.'
          : 'Через т. C провести прямую ℓ, пересекающую отрезок прямой AB, и прямую a, параллельную AB.';
    } else {
      $('intersectionChoice').hidden=true;
      $('dataTitle').textContent='Исходная схема';
      const info = stored || {};
      const schemes=window.SITEMATH_SCHEMES||{};
      const knownScheme=state.variant!=='custom' && schemes[state.variant] && schemes[state.variant]['task'+task];

      if(state.variant==='custom'){
        holder.innerHTML = customEditorMarkup(task);
        $('solverMode').textContent=state.customSchemes[task]?'своя схема готова':'разметка фото';
        $('taskStatement').textContent = DATA.tasks[task].short;
        setupCustomDiagramEditor(task);
      } else {
        const roleSummary=knownScheme?diagramRoleSummary(task,knownScheme):null;
        holder.innerHTML =
          '<div class="diagram-info">' +
          '<p><b>Тип данных:</b> графическая схема на листе, а не координаты.</p>' +
          (knownScheme
            ? '<p><b>Статус:</b> '+(
                knownScheme.sourceVerified && knownScheme.sourceId
                  ? 'повторно сверено с доступным оригиналом '+esc(knownScheme.sourceId)+'.'
                  : knownScheme.sourceId
                    ? 'сохранена трассировка с исходника '+esc(knownScheme.sourceId)+', но сам файл сейчас недоступен для повторной визуальной сверки; наклоны, точки и топология не считаются подтверждёнными.'
                    : knownScheme.sourceVerified
                      ? 'перенесено с фото ранее; исходный файл сейчас недоступен для повторной точной сверки.'
                      : 'сохранена трассировка из прошлой работы; оригинальный файл сейчас недоступен для повторной сверки, поэтому её наклоны и точки не считаются подтверждёнными.'
              )+'</p>'+
              (roleSummary?'<p><b>На листе дано:</b> '+esc(roleSummary.given||'графическая схема')+'</p>'+
              '<p><b>Строится:</b> '+esc(roleSummary.built)+'</p>':'')
            : '<p><b>Статус:</b> исходного рисунка пока нет. Сайт не подставляет выдуманную геометрию.</p>') +
          '</div>';
        $('solverMode').textContent=knownScheme?'схема варианта':'нет схемы';
        $('taskStatement').textContent = info.statement || DATA.tasks[task].short;
      }
    }
    holder.querySelectorAll('.coord-input').forEach(i=>i.addEventListener('change',()=>rebuild(true)));
    updateMobileSummary();
    syncChoicePickers();
  }

  function updateMobileSummary(){
    const node=$('mobileTaskSummary');
    const sheet=$('mobileSheetSummary');
    if(!state.variant || !state.task){
      if(node) node.textContent='Выбери вариант и задание';
      if(sheet) sheet.textContent='вариант и задание';
      return;
    }
    const compact=variantDisplayNumber(state.variant)+' · '+taskPickerLabel(state.task);
    if(node) node.textContent=compact;
    if(sheet) sheet.textContent=compact;
  }

  function openMobileSetup(){
    const panel=$('controlsPanel'),backdrop=$('mobileBackdrop');
    if(!panel||!backdrop)return;
    panel.classList.add('is-open');
    backdrop.hidden=false;
    document.body.classList.add('mobile-sheet-open');
  }

  function closeMobileSetup(){
    const panel=$('controlsPanel'),backdrop=$('mobileBackdrop');
    if(!panel||!backdrop)return;
    panel.classList.remove('is-open');
    backdrop.hidden=true;
    document.body.classList.remove('mobile-sheet-open');
  }

  function toggleStepSheet(){
    const sheet=$('stepSheet'),btn=$('stepSheetToggle');
    if(!sheet||!btn)return;
    const expanded=!sheet.classList.contains('is-expanded');
    sheet.classList.toggle('is-expanded',expanded);
    btn.setAttribute('aria-expanded',expanded?'true':'false');
  }


  function customEditorMarkup(task){
    let planeControls='';
    if(task===4 || task===5){
      planeControls=
        '<label>Как плоскость Σ задана в условии?'+
        '<select id="customPlaneType">'+
        '<option value="ABC">Σ(ABC) – тремя точками A, B, C</option>'+
        '<option value="parallel_lines">Σ(a∥b) – двумя параллельными a и b</option>'+
        '<option value="intersecting_lines">Σ(a∩b) – двумя пересекающимися a и b</option>'+
        '<option value="line_point">Σ(A;a) – точкой A и прямой a</option>'+
        '</select></label>';
    } else {
      const opts=
        '<option value="parallel_lines">двумя параллельными прямыми</option>'+
        '<option value="intersecting_lines">двумя пересекающимися прямыми</option>'+
        '<option value="line_point">точкой и прямой</option>'+
        '<option value="ABC">тремя точками</option>'+
        '<option value="frontal_projecting">фронтально-проецирующая – задана одной линией на Π₂</option>'+
        '<option value="horizontal_projecting">горизонтально-проецирующая – задана одной линией на Π₁</option>';
      planeControls=
        '<label>Как задана плоскость Σ?<select id="customPlaneAType">'+opts+'</select></label>'+
        '<label>Как задана плоскость Θ?<select id="customPlaneBType">'+opts+'</select></label>'+
        '<label>Через какую исходную точку провести прямую, параллельную обеим плоскостям?'+
        '<input id="customTask6Through" value="K" maxlength="2"></label>';
    }

    let opControls='';
    if(task===4){
      opControls=
        '<label>Что написано после построения h, f и линии ската?'+
        '<select id="customOperation">'+
        '<option value="line_parallel_plane">через точку провести ℓ ∥ Σ</option>'+
        '<option value="line_parallel_horizontal">через точку провести ℓ ∥ горизонтали h</option>'+
        '<option value="line_intersects_frontale">через точку провести ℓ, пересекающую фронталь f</option>'+
        '<option value="line_intersects_horizontal">через точку провести ℓ, пересекающую горизонталь h</option>'+
        '<option value="line_intersects_named">через точку провести ℓ, пересекающую прямую a</option>'+
        '</select></label>'+
        '<div class="inline-fields">'+
        '<label>Через точку<input id="customThrough" value="D" maxlength="2"></label>'+
        '<label>Построить точку<input id="customResult" value="E" maxlength="2"></label>'+
        '</div>'+
        '<label>Где должна быть новая точка?'+
        '<select id="customRelation">'+
        '<option value="above_line">над ℓ</option>'+
        '<option value="below_line">под ℓ</option>'+
        '<option value="behind_line">за ℓ</option>'+
        '<option value="front_of_line">перед ℓ</option>'+
        '<option value="above_named">над прямой a</option>'+
        '<option value="above_plane">над Σ</option>'+
        '<option value="below_plane">под Σ</option>'+
        '<option value="front_of_plane">перед Σ</option>'+
        '<option value="">в условии новой точки нет</option>'+
        '</select></label>';
    }

    return '<div class="custom-editor">'+
      '<div class="workflow-card">'+
        '<b>Зачем здесь фото?</b>'+
        '<p>В заданиях 4–6 исходные линии уже нарисованы на самом варианте и координат для них нет. Фото нужно только чтобы перенести <b>исходную схему</b> в сайт. После этого решение строится автоматически.</p>'+
        '<ol>'+
          '<li>Загрузи фото листа или самого задания №'+task+'.</li>'+
          '<li>Выдели на фото только область задания №'+task+'.</li>'+
          '<li>Сайт по очереди скажет, какие исходные точки/линии отметить.</li>'+
          '<li>Нажми «Решить» – дальше появится обычное пошаговое построение.</li>'+
        '</ol>'+
      '</div>'+
      '<div class="custom-form">'+planeControls+opControls+
        '<label>Фото варианта<input id="schemeImage" type="file" accept="image/*"></label>'+
      '</div>'+
      '<div id="cropControls" class="crop-controls" hidden>'+
        '<div class="crop-title"><b>2. Выбери область задания №'+task+'</b><span id="cropStatus">не выбрана</span></div>'+
        '<p class="hint">Если загружен весь лист 2×3, «Авто №'+task+'» поставит рамку примерно на нужный квадрант. Проверь её и при необходимости выдели область пальцем или мышью вручную.</p>'+
        '<div class="calibrator-actions">'+
          '<button id="autoCrop" class="ghost small" type="button">Авто №'+task+'</button>'+
          '<button id="manualCrop" class="ghost small" type="button">Выбрать вручную</button>'+
          '<button id="wholeCrop" class="ghost small" type="button">Всё изображение</button>'+
          '<button id="applyCrop" class="primary small" type="button">Использовать область</button>'+
        '</div>'+
      '</div>'+
      '<div id="markControls" class="mark-controls" hidden>'+
        '<div class="crop-title"><b>3. Отметь исходные данные</b><span id="markProgress"></span></div>'+
        '<p class="hint">Это не решение. Ты только показываешь сайту, где на исходном фото находятся напечатанные линии и точки. Для линии нужно нажать две удалённые точки на её штрихе.</p>'+
        '<div id="markChecklist" class="mark-checklist"></div>'+
        '<div class="calibrator-actions">'+
          '<button id="startMarking" class="ghost small" type="button">Начать разметку</button>'+
          '<button id="undoMark" class="ghost small" type="button">Отменить последний клик</button>'+
          '<button id="changeCrop" class="ghost small" type="button">Изменить область</button>'+
          '<button id="finishMarking" class="primary small" type="button" disabled>Решить по разметке</button>'+
        '</div>'+
      '</div>'+
      '<p id="markPrompt" class="mark-prompt">1. Сначала выбери фото.</p>'+
      '<div id="photoViewControls" class="photo-view-controls" hidden>'+
        '<button id="photoZoomOut" class="icon-btn" type="button">−</button>'+
        '<button id="photoZoomFit" class="icon-btn wide" type="button">Вписать</button>'+
        '<button id="photoZoomIn" class="icon-btn" type="button">+</button>'+
        '<span id="photoZoomLabel" class="zoom-label">100%</span>'+
      '</div>'+
      '<div class="calibration-wrap"><canvas id="calibrationCanvas"></canvas></div>'+
      '</div>';
  }

  function pointClickItems(label){
    return [
      {kind:'point',key:label,proj:'p2',part:0,prompt:'Нажми центр '+label+'₂'},
      {kind:'point',key:label,proj:'p1',part:0,prompt:'Нажми центр '+label+'₁'}
    ];
  }

  function lineClickItems(label){
    return [
      {kind:'line',key:label,proj:'p2',part:0,prompt:'Прямая '+label+'₂: нажми первую точку на линии'},
      {kind:'line',key:label,proj:'p2',part:1,prompt:'Прямая '+label+'₂: нажми вторую удалённую точку'},
      {kind:'line',key:label,proj:'p1',part:0,prompt:'Прямая '+label+'₁: нажми первую точку на линии'},
      {kind:'line',key:label,proj:'p1',part:1,prompt:'Прямая '+label+'₁: нажми вторую удалённую точку'}
    ];
  }

  function projectingClickItems(label,proj){
    const idx=proj==='p2'?'₂':'₁';
    return [
      {kind:'projecting',key:label,proj:proj,part:0,prompt:'Проекция '+label+idx+': нажми первую точку линии'},
      {kind:'projecting',key:label,proj:proj,part:1,prompt:'Проекция '+label+idx+': нажми вторую удалённую точку'}
    ];
  }

  function appendPlaneClickItems(sequence,type,names){
    const lineNames=names && names.lines ? names.lines : ['a','b'];
    const pointNames=names && names.points ? names.points : ['A','B','C'];
    if(type==='ABC'){
      pointNames.forEach(n=>sequence.push(...pointClickItems(n)));
    } else if(type==='line_point'){
      sequence.push(...lineClickItems(lineNames[0]||'a'));
      sequence.push(...pointClickItems(pointNames[0]||'A'));
    } else if(type==='parallel_lines' || type==='intersecting_lines'){
      sequence.push(...lineClickItems(lineNames[0]||'a'));
      sequence.push(...lineClickItems(lineNames[1]||'b'));
    } else if(type==='frontal_projecting'){
      sequence.push(...projectingClickItems((names&&names.projecting)||'Σ','p2'));
    } else if(type==='horizontal_projecting'){
      sequence.push(...projectingClickItems((names&&names.projecting)||'Σ','p1'));
    }
  }

  function makeCustomSpec(task){
    const sequence=[];
    const meta={task:task};
    if(task===4){
      const planeType=$('customPlaneType').value;
      const through=($('customThrough').value||'D').trim().toUpperCase();
      const result=($('customResult').value||'E').trim().toUpperCase();
      const op=$('customOperation').value;
      meta.planeType=planeType;
      meta.through=through;
      meta.result=result;
      meta.operation=op;
      meta.relation=$('customRelation').value;
      appendPlaneClickItems(sequence,planeType,{lines:['a','b'],points:['A','B','C']});
      const planePointNames=planeType==='ABC'?['A','B','C']:(planeType==='line_point'?['A']:[]);
      if(!planePointNames.includes(through)) sequence.push(...pointClickItems(through));
    } else if(task===5){
      const planeType=$('customPlaneType').value;
      meta.planeType=planeType;
      appendPlaneClickItems(sequence,planeType,{lines:['a','b'],points:['A','B','C']});
      sequence.push(...lineClickItems('l'));
    } else {
      const typeA=$('customPlaneAType').value;
      const typeB=$('customPlaneBType').value;
      const through=(($('customTask6Through')&&$('customTask6Through').value)||'K').trim().toUpperCase()||'K';
      meta.typeA=typeA; meta.typeB=typeB; meta.through=through;
      appendPlaneClickItems(sequence,typeA,{lines:['a','b'],points:['A','B','C'],projecting:'Σ'});
      appendPlaneClickItems(sequence,typeB,{lines:['c','d'],points:['D','E','F'],projecting:'Θ'});
      sequence.push(...pointClickItems(through));
    }
    return {sequence:sequence,meta:meta};
  }

  function taskCropRect(task,w,h){
    if(task===4) return {x:w*.47,y:h*.27,w:w*.51,h:h*.39};
    if(task===5) return {x:w*.02,y:h*.54,w:w*.50,h:h*.43};
    if(task===6) return {x:w*.47,y:h*.54,w:w*.51,h:h*.43};
    return {x:0,y:0,w:w,h:h};
  }

  function normalizeRect(a,b){
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
    return {x:x,y:y,w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};
  }

  function clampRect(r,w,h){
    const x=Math.max(0,Math.min(w,r.x));
    const y=Math.max(0,Math.min(h,r.y));
    return {
      x:x,y:y,
      w:Math.max(1,Math.min(w-x,r.w)),
      h:Math.max(1,Math.min(h-y,r.h))
    };
  }

  function setPhotoZoom(value){
    const c=state.calibrator;
    const canvas=$('calibrationCanvas');
    if(!c||!canvas) return;
    c.photoZoom=Math.max(.35,Math.min(4,value));
    canvas.style.width=Math.max(160,canvas.width*c.photoZoom)+'px';
    canvas.style.height='auto';
    $('photoZoomLabel').textContent=Math.round(c.photoZoom*100)+'%';
  }

  function fitPhoto(){
    const c=state.calibrator,canvas=$('calibrationCanvas');
    const wrap=canvas&&canvas.parentElement;
    if(!c||!canvas||!wrap||!canvas.width) return;
    const z=Math.min(1,Math.max(.35,(wrap.clientWidth-10)/canvas.width));
    setPhotoZoom(z);
  }

  function renderCropPreview(){
    const c=state.calibrator,canvas=$('calibrationCanvas');
    if(!c||!c.image||!canvas) return;
    const maxRaster=1000;
    c.previewScale=Math.min(1,maxRaster/c.image.naturalWidth);
    canvas.width=Math.max(1,Math.round(c.image.naturalWidth*c.previewScale));
    canvas.height=Math.max(1,Math.round(c.image.naturalHeight*c.previewScale));
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(c.image,0,0,canvas.width,canvas.height);
    c.base=null;
    c.cropApplied=false;

    if(c.crop){
      const r={
        x:c.crop.x*c.previewScale,
        y:c.crop.y*c.previewScale,
        w:c.crop.w*c.previewScale,
        h:c.crop.h*c.previewScale
      };
      ctx.save();
      ctx.fillStyle='rgba(25,25,25,.42)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.clearRect(r.x,r.y,r.w,r.h);
      ctx.drawImage(c.image,c.crop.x,c.crop.y,c.crop.w,c.crop.h,r.x,r.y,r.w,r.h);
      ctx.strokeStyle='#b84f3a';
      ctx.lineWidth=3;
      ctx.setLineDash([10,6]);
      ctx.strokeRect(r.x,r.y,r.w,r.h);
      ctx.restore();
    }
    $('photoViewControls').hidden=false;
    if(c.selectingCrop) setPhotoZoom(c.photoZoom);
    else fitPhoto();
  }

  function applySelectedCrop(){
    const c=state.calibrator,canvas=$('calibrationCanvas');
    if(!c||!c.image||!canvas) return;
    if(!c.crop) c.crop={x:0,y:0,w:c.image.naturalWidth,h:c.image.naturalHeight};
    c.crop=clampRect(c.crop,c.image.naturalWidth,c.image.naturalHeight);
    if(c.crop.w<40||c.crop.h<40){
      $('markPrompt').textContent='Область слишком маленькая. Выдели само задание целиком.';
      return;
    }
    const maxRaster=1200;
    const scale=Math.min(1,maxRaster/c.crop.w);
    c.base=document.createElement('canvas');
    c.base.width=Math.max(1,Math.round(c.crop.w*scale));
    c.base.height=Math.max(1,Math.round(c.crop.h*scale));
    c.base.getContext('2d').drawImage(c.image,c.crop.x,c.crop.y,c.crop.w,c.crop.h,0,0,c.base.width,c.base.height);
    canvas.width=c.base.width;
    canvas.height=c.base.height;
    c.cropApplied=true;
    c.selectingCrop=false;
    c.clicks=[];
    c.spec=null;
    drawCalibrationOverlay();
    $('cropControls').hidden=true;
    $('markControls').hidden=false;
    $('cropStatus').textContent='область выбрана';
    $('markPrompt').textContent='3. Область готова. Нажми «Начать разметку» – сайт будет говорить, что именно отмечать.';
    fitPhoto();
  }

  function drawCalibrationOverlay(){
    const c=state.calibrator,canvas=$('calibrationCanvas');
    if(!c||!canvas||!c.base) return;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(c.base,0,0);
    ctx.lineWidth=2;
    ctx.font='13px system-ui';
    c.clicks.forEach((p,i)=>{
      ctx.beginPath();
      ctx.arc(p.x,p.y,5,0,Math.PI*2);
      ctx.fillStyle='rgba(184,79,58,.92)';
      ctx.fill();
      ctx.strokeStyle='white';ctx.stroke();
      ctx.fillStyle='rgba(120,30,20,.95)';
      ctx.fillText(String(i+1),p.x+7,p.y-7);
    });
    for(let i=1;i<c.clicks.length;i+=2){
      const prev=c.spec&&c.spec.sequence[i-1],cur=c.spec&&c.spec.sequence[i];
      if(prev&&cur&&prev.kind!=='point'&&prev.key===cur.key&&prev.proj===cur.proj){
        const a=c.clicks[i-1],b=c.clicks[i];
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle='rgba(40,95,120,.9)';ctx.lineWidth=2;ctx.stroke();
      }
    }
  }

  function snapDark(x,y){
    const c=state.calibrator;
    if(!c||!c.base) return {x:x,y:y};
    const ctx=c.base.getContext('2d');
    const r=9;
    const x0=Math.max(0,Math.floor(x-r)),y0=Math.max(0,Math.floor(y-r));
    const x1=Math.min(c.base.width-1,Math.ceil(x+r)),y1=Math.min(c.base.height-1,Math.ceil(y+r));
    const img=ctx.getImageData(x0,y0,x1-x0+1,y1-y0+1);
    let best={score:1e9,x:x,y:y};
    for(let yy=0;yy<img.height;yy++){
      for(let xx=0;xx<img.width;xx++){
        const j=(yy*img.width+xx)*4;
        const gray=.299*img.data[j]+.587*img.data[j+1]+.114*img.data[j+2];
        const px=x0+xx,py=y0+yy;
        const dist=Math.hypot(px-x,py-y);
        const score=gray+dist*5.5;
        if(score<best.score) best={score:score,x:px,y:py};
      }
    }
    return {x:best.x,y:best.y};
  }

  function renderMarkChecklist(){
    const c=state.calibrator,list=$('markChecklist');
    if(!list) return;
    if(!c||!c.spec){list.innerHTML='';return;}
    const n=c.clicks.length;
    list.innerHTML=c.spec.sequence.map((item,i)=>{
      const cls=i<n?'done':i===n?'current':'';
      const mark=i<n?'✓':i===n?'→':'·';
      return '<div class="mark-item '+cls+'"><span>'+mark+'</span><span>'+esc(item.prompt)+'</span></div>';
    }).join('');
    $('markProgress').textContent=Math.min(n,c.spec.sequence.length)+' / '+c.spec.sequence.length;
  }

  function updateMarkPrompt(){
    const c=state.calibrator,prompt=$('markPrompt');
    if(!c||!prompt) return;
    if(!c.image){prompt.textContent='1. Сначала выбери фото.';return;}
    if(!c.cropApplied){prompt.textContent='2. Выдели на фото только область задания №'+state.task+' и нажми «Использовать область».';return;}
    if(!c.spec){prompt.textContent='3. Область готова. Нажми «Начать разметку».';renderMarkChecklist();return;}
    const n=c.clicks.length;
    renderMarkChecklist();
    if(n>=c.spec.sequence.length){
      prompt.textContent='Разметка готова. Проверь отмеченные линии и нажми «Решить по разметке».';
      $('finishMarking').disabled=false;
      return;
    }
    $('finishMarking').disabled=true;
    prompt.textContent='Сейчас: '+c.spec.sequence[n].prompt+'. Это только перенос исходных данных с фото.';
  }

  function buildSchemeFromClicks(task){
    const c=state.calibrator,spec=c.spec,clicks=c.clicks;
    if(!spec||clicks.length<spec.sequence.length) return null;
    const points={},lines={},projecting={};
    spec.sequence.forEach((item,i)=>{
      const p=[clicks[i].x,clicks[i].y];
      if(item.kind==='point'){
        if(!points[item.key]) points[item.key]={};
        points[item.key][item.proj]=p;
      }else if(item.kind==='line'){
        if(!lines[item.key]) lines[item.key]={p1:[null,null],p2:[null,null]};
        lines[item.key][item.proj][item.part]=p;
      }else{
        if(!projecting[item.key]) projecting[item.key]={proj:item.proj,line:[null,null]};
        projecting[item.key].line[item.part]=p;
      }
    });

    if(task===4){
      const m=spec.meta;
      const scheme={planeType:m.planeType,points:points,lines:lines};
      if(m.planeType==='line_point'){scheme.planeLine='a';scheme.planePoint='A';}
      if(m.planeType==='parallel_lines'||m.planeType==='intersecting_lines') scheme.planeLines=['a','b'];
      scheme.operation={
        type:m.operation,through:m.through,resultPoint:m.result,
        relation:m.relation,
        target:(m.operation==='line_intersects_named'||m.relation==='above_named')?'a':undefined
      };
      return scheme;
    }
    if(task===5){
      const m=spec.meta;
      const scheme={planeType:m.planeType,points:points,lines:lines,givenLine:'l'};
      if(m.planeType==='line_point'){scheme.planeLine='a';scheme.planePoint='A';}
      if(m.planeType==='parallel_lines'||m.planeType==='intersecting_lines') scheme.planeLines=['a','b'];
      return scheme;
    }

    function planeDef(type,lineNames,pointNames,projectName){
      if(type==='ABC'){
        const ps={};pointNames.forEach(n=>ps[n]=points[n]);
        return {type:'ABC',points:ps};
      }
      if(type==='line_point'){
        const lineName=lineNames[0],pointName=pointNames[0];
        return {
          type:'line_point',
          lineName:lineName,
          pointName:pointName,
          lines:{[lineName]:lines[lineName]},
          points:{[pointName]:points[pointName]}
        };
      }
      if(type==='parallel_lines'||type==='intersecting_lines'){
        const ls={};lineNames.forEach(n=>ls[n]=lines[n]);
        return {type:type,lines:ls};
      }
      const pr=projecting[projectName];
      return {type:type,projection:pr.proj,line:pr.line,name:projectName};
    }
    const through=spec.meta.through||'K';
    return {
      planeA:planeDef(spec.meta.typeA,['a','b'],['A','B','C'],'Σ'),
      planeB:planeDef(spec.meta.typeB,['c','d'],['D','E','F'],'Θ'),
      pointThrough:points[through],
      pointLabel:through
    };
  }

  function setupCustomDiagramEditor(task){
    const canvas=$('calibrationCanvas');
    if(!canvas) return;
    state.calibrator={
      image:null,base:null,clicks:[],spec:null,crop:null,cropApplied:false,
      selectingCrop:false,dragStart:null,dragNow:null,previewScale:1,photoZoom:1
    };

    const canvasPoint=ev=>{
      const rect=canvas.getBoundingClientRect();
      return {
        x:(ev.clientX-rect.left)*canvas.width/rect.width,
        y:(ev.clientY-rect.top)*canvas.height/rect.height
      };
    };

    $('schemeImage').addEventListener('change',ev=>{
      const file=ev.target.files&&ev.target.files[0];
      if(!file) return;
      const img=new Image();
      img.onload=()=>{
        const c=state.calibrator;
        c.image=img;c.base=null;c.clicks=[];c.spec=null;c.crop=null;c.cropApplied=false;
        $('cropControls').hidden=false;
        $('markControls').hidden=true;
        $('photoViewControls').hidden=false;
        $('cropStatus').textContent='не выбрана';
        renderCropPreview();
        $('markPrompt').textContent='2. Выдели область задания №'+task+'. Для полного листа можно начать с «Авто №'+task+'».';
      };
      img.src=URL.createObjectURL(file);
    });

    $('autoCrop').addEventListener('click',()=>{
      const c=state.calibrator;if(!c.image)return;
      c.crop=taskCropRect(task,c.image.naturalWidth,c.image.naturalHeight);
      c.selectingCrop=false;
      renderCropPreview();
      $('cropStatus').textContent='авто – проверь рамку';
    });

    $('wholeCrop').addEventListener('click',()=>{
      const c=state.calibrator;if(!c.image)return;
      c.crop={x:0,y:0,w:c.image.naturalWidth,h:c.image.naturalHeight};
      c.selectingCrop=false;
      renderCropPreview();
      $('cropStatus').textContent='всё изображение';
    });

    $('manualCrop').addEventListener('click',()=>{
      const c=state.calibrator;if(!c.image)return;
      c.selectingCrop=true;c.dragStart=null;c.dragNow=null;
      canvas.style.touchAction='none';
      $('cropStatus').textContent='проведи рамку по заданию';
      $('markPrompt').textContent='Зажми палец/мышь в одном углу задания №'+task+' и протяни до противоположного.';
    });

    $('applyCrop').addEventListener('click',applySelectedCrop);
    $('changeCrop').addEventListener('click',()=>{
      const c=state.calibrator;if(!c.image)return;
      c.cropApplied=false;c.spec=null;c.clicks=[];
      $('cropControls').hidden=false;$('markControls').hidden=true;
      renderCropPreview();updateMarkPrompt();
    });

    $('photoZoomOut').addEventListener('click',()=>setPhotoZoom(state.calibrator.photoZoom*.8));
    $('photoZoomIn').addEventListener('click',()=>setPhotoZoom(state.calibrator.photoZoom*1.25));
    $('photoZoomFit').addEventListener('click',fitPhoto);

    $('startMarking').addEventListener('click',()=>{
      const c=state.calibrator;
      if(!c.image||!c.cropApplied){updateMarkPrompt();return;}
      c.spec=makeCustomSpec(task);c.clicks=[];
      canvas.style.touchAction='pan-x pan-y pinch-zoom';
      drawCalibrationOverlay();updateMarkPrompt();
    });

    $('undoMark').addEventListener('click',()=>{
      const c=state.calibrator;if(!c)return;
      c.clicks.pop();drawCalibrationOverlay();updateMarkPrompt();
    });

    canvas.addEventListener('pointerdown',ev=>{
      const c=state.calibrator;
      if(!c||!c.image)return;
      if(c.selectingCrop&&!c.cropApplied){
        canvas.setPointerCapture&&canvas.setPointerCapture(ev.pointerId);
        c.dragStart=canvasPoint(ev);c.dragNow=c.dragStart;
        ev.preventDefault();
      }
    });
    canvas.addEventListener('pointermove',ev=>{
      const c=state.calibrator;
      if(!c||!c.selectingCrop||!c.dragStart||c.cropApplied)return;
      c.dragNow=canvasPoint(ev);
      const r=normalizeRect(c.dragStart,c.dragNow);
      c.crop={
        x:r.x/c.previewScale,y:r.y/c.previewScale,
        w:r.w/c.previewScale,h:r.h/c.previewScale
      };
      renderCropPreview();
      ev.preventDefault();
    });
    canvas.addEventListener('pointerup',ev=>{
      const c=state.calibrator;
      if(!c||!c.selectingCrop||!c.dragStart||c.cropApplied)return;
      c.selectingCrop=false;
      c.dragStart=null;c.dragNow=null;
      canvas.style.touchAction='pan-x pan-y pinch-zoom';
      $('cropStatus').textContent='ручная область – проверь рамку';
      $('markPrompt').textContent='Если рамка охватывает только задание №'+task+', нажми «Использовать область».';
      ev.preventDefault();
    });

    canvas.addEventListener('pointercancel',()=>{
      const c=state.calibrator;
      if(!c)return;
      c.selectingCrop=false;c.dragStart=null;c.dragNow=null;
      canvas.style.touchAction='pan-x pan-y pinch-zoom';
    });

    canvas.addEventListener('click',ev=>{
      const c=state.calibrator;
      if(!c||!c.cropApplied||!c.spec||c.clicks.length>=c.spec.sequence.length)return;
      const p=canvasPoint(ev);
      c.clicks.push(snapDark(p.x,p.y));
      drawCalibrationOverlay();updateMarkPrompt();
    });

    $('finishMarking').addEventListener('click',()=>{
      const scheme=buildSchemeFromClicks(task);
      if(!scheme)return;
      state.customSchemes[task]=scheme;
      $('solverMode').textContent='своя схема готова';
      rebuild(true);
    });
  }

  function readCoords(){
    const out={};
    document.querySelectorAll('.coord-input').forEach(inp=>{
      const name=inp.dataset.point;
      if(!out[name]) out[name]={x:0,y:0,z:0};
      out[name][inp.dataset.axis]=Number(inp.value);
    });
    return out;
  }

  function validateCoords(coords){
    for(const [name,p] of Object.entries(coords)){
      if(![p.x,p.y,p.z].every(Number.isFinite)) return 'У точки '+name+' есть пустая или нечисловая координата.';
      if(Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))>500) return 'Координата точки '+name+' больше 500 мм. Проверь ввод.';
    }
    return '';
  }

  function solveTask1(coords){
    const names=Object.keys(coords);
    const raw=[];
    names.forEach(n=>{
      const p=coords[n];
      raw.push({x:-p.x,y:p.y},{x:-p.x,y:-p.z},{x:p.y,y:-p.z});
    });
    raw.push({x:0,y:0});
    const frame=gridFrame(raw,25,170,145);
    const dx=frame.dx, dy=frame.dy;
    const O={x:dx,y:dy};
    const project={};
    names.forEach(n=>{
      const p=coords[n];
      project[n]={
        p1:shiftPoint({x:-p.x,y:p.y},dx,dy),
        p2:shiftPoint({x:-p.x,y:-p.z},dx,dy),
        p3:shiftPoint({x:p.y,y:-p.z},dx,dy),
        xFoot:shiftPoint({x:-p.x,y:0},dx,dy),
        yFoot:shiftPoint({x:0,y:p.y},dx,dy),
        y3Foot:shiftPoint({x:p.y,y:0},dx,dy),
        zFoot:shiftPoint({x:0,y:-p.z},dx,dy)
      };
    });

    const complexWidth=frame.width;
    const axOrigin={x:complexWidth+55,y:Math.max(70,O.y)};
    const axScale=.52;
    const ex={x:-.78*axScale,y:.44*axScale};
    const ey={x:.78*axScale,y:.44*axScale};
    const ez={x:0,y:-1*axScale};
    const ax={};
    names.forEach(n=>{
      const p=coords[n];
      ax[n]={
        p:{
          x:axOrigin.x + ex.x*p.x + ey.x*p.y + ez.x*p.z,
          y:axOrigin.y + ex.y*p.x + ey.y*p.y + ez.y*p.z
        }
      };
    });
    const axPoints=[axOrigin];
    Object.values(ax).forEach(v=>axPoints.push(v.p));
    const allPts=raw.map(p=>shiftPoint(p,dx,dy)).concat(axPoints);
    const bb=bounds(allPts,18);
    const width=Math.max(complexWidth+110,bb.maxX+10);
    const height=ceilToGrid(Math.max(frame.height,bb.maxY+15,145));

    const steps=[];
    const push=(meta,entities,tool)=>steps.push(Object.assign({},meta,{entities:entities||[],tool:tool||null}));

    push({
      title:'Разметь три плоскости проекций',
      action:'Проведи оси x, y, z через начало O. Слева от O располагаются П₁ и П₂, справа – профильная П₃.',
      why:'После разворота плоскостей Монжа координаты точки читаются попарно: П₁ = (x,y), П₂ = (x,z), П₃ = (y,z).',
      measure:['Сетка: 5 мм = 1 клетка','Оси строятся под 90°'],
      check:'У всех трёх видов одна и та же точка O.'
    },[
      line(0,O,{x:8,y:O.y},'axis',{arrow:true}),
      line(0,O,{x:complexWidth-8,y:O.y},'axis',{arrow:true}),
      line(0,O,{x:O.x,y:8},'axis',{arrow:true}),
      line(0,O,{x:O.x,y:height-8},'axis',{arrow:true}),
      point(0,O,'O'),
      textEntity(0,{x:10,y:O.y-3},'x','svg-label'),
      textEntity(0,{x:complexWidth-22,y:O.y-3},'y₃','svg-label'),
      textEntity(0,{x:O.x+3,y:11},'z','svg-label'),
      textEntity(0,{x:O.x+3,y:height-9},'y₁','svg-label'),
      textEntity(0,{x:12,y:16},'Π₂','svg-note'),
      textEntity(0,{x:12,y:height-12},'Π₁','svg-note'),
      textEntity(0,{x:complexWidth-26,y:16},'Π₃','svg-note')
    ],{kind:'line',a:{x:8,y:O.y},b:{x:complexWidth-8,y:O.y}});

    names.forEach(name=>{
      const p=coords[name], q=project[name];
      let i=steps.length;
      push({
        title:'Точка '+name+': задай линию связи по x',
        action:'От O по оси x отложи '+Math.abs(p.x)+' мм '+(p.x>=0?'влево':'вправо')+'. Через полученную отметку проведи линию связи перпендикулярно x.',
        why:'Обе основные проекции '+name+'₁ и '+name+'₂ имеют одну координату x, поэтому находятся на одной линии связи.',
        measure:['|x| = '+Math.abs(p.x)+' мм = '+fmt(Math.abs(p.x)/GRID)+' клеток'],
        check:name+'₁ и '+name+'₂ должны оказаться строго друг над другом.'
      },[
        dim(i,O,q.xFoot,Math.abs(p.x)+' мм',{x:0,y:-4}),
        line(i,{x:q.xFoot.x,y:Math.min(q.p1.y,q.p2.y)-5},{x:q.xFoot.x,y:Math.max(q.p1.y,q.p2.y)+5},'construction-line')
      ],{kind:'line',a:O,b:q.xFoot});

      i=steps.length;
      push({
        title:'Построй '+name+'₁ и '+name+'₂',
        action:'На линии связи от x₁₂ отложи y = '+p.y+' мм для '+name+'₁ и z = '+p.z+' мм для '+name+'₂.',
        why:'На П₁ положительный y после разворота откладывается вниз, отрицательный – вверх. На П₂ положительный z откладывается вверх, отрицательный – вниз.',
        measure:[
          '|y| = '+Math.abs(p.y)+' мм = '+fmt(Math.abs(p.y)/GRID)+' клеток',
          '|z| = '+Math.abs(p.z)+' мм = '+fmt(Math.abs(p.z)/GRID)+' клеток'
        ],
        check:'Расстояния '+name+'₁ и '+name+'₂ от оси x равны |y| и |z|.'
      },[
        line(i,q.yFoot,q.p1,'construction-line'),
        line(i,q.zFoot,q.p2,'construction-line'),
        point(i,q.yFoot,'y₁='+signedCoord(p.y),'construction-dot'),
        point(i,q.zFoot,'z='+signedCoord(p.z),'construction-dot'),
        point(i,q.p1,name+'₁'),
        point(i,q.p2,name+'₂'),
        dim(i,q.xFoot,q.p1,Math.abs(p.y)+' мм',{x:3,y:0}),
        dim(i,q.xFoot,q.p2,Math.abs(p.z)+' мм',{x:-3,y:0})
      ]);

      i=steps.length;
      push({
        title:'Дострой профильную проекцию '+name+'₃',
        action:'На П₃ используй те же y и z: от O отложи y по горизонтали и z по вертикали. Пересечение даёт '+name+'₃.',
        why:'Профильная плоскость Π₃ хранит координаты (y,z). x на положение '+name+'₃ не влияет.',
        measure:[
          '|y| = '+Math.abs(p.y)+' мм по профильной оси',
          '|z| = '+Math.abs(p.z)+' мм по вертикали'
        ],
        check:name+'₂ и '+name+'₃ имеют одинаковую высоту z.'
      },[
        line(i,q.yFoot,q.y3Foot,'construction-line'),
        line(i,q.y3Foot,q.p3,'construction-line'),
        line(i,q.zFoot,q.p3,'construction-line'),
        point(i,q.y3Foot,'y₃='+signedCoord(p.y),'construction-dot'),
        point(i,q.p3,name+'₃','answer-dot')
      ],{kind:'line',a:q.zFoot,b:q.p3});
    });

    let i=steps.length;
    const axisLen=55;
    const axEntities=[
      line(i,axOrigin,add2(axOrigin,mul2(ex,axisLen/axScale)),'axis'),
      line(i,axOrigin,add2(axOrigin,mul2(ey,axisLen/axScale)),'axis'),
      line(i,axOrigin,add2(axOrigin,mul2(ez,axisLen/axScale)),'axis'),
      textEntity(i,add2(axOrigin,mul2(ex,axisLen/axScale+4)),'x'),
      textEntity(i,add2(axOrigin,mul2(ey,axisLen/axScale+4)),'y'),
      textEntity(i,add2(axOrigin,mul2(ez,axisLen/axScale+4)),'z')
    ];
    names.forEach(name=>{
      const P=ax[name].p;
      axEntities.push(line(i,axOrigin,P,'construction-line'));
      axEntities.push(point(i,P,name,'answer-dot'));
    });
    push({
      title:'Построй наглядное изображение точек',
      action:'Перенеси те же координаты на три пространственные оси x, y, z. Сайт показывает компактную аксонометрическую схему справа.',
      why:'Наглядное изображение не вводит новые данные – это та же точка (x,y,z), только показанная в пространственной системе осей.',
      measure:['Используются исходные x, y, z без пересчёта значений'],
      check:'Знаки координат определяют, по какую сторону от O лежит каждая составляющая.'
    },axEntities);

    return {width,height,O,steps};
  }

  function twoPlaneAxisEntities(step,O,width,height){
    return [
      line(step,O,{x:8,y:O.y},'axis',{arrow:true}),
      line(step,O,{x:width-8,y:O.y},'axis',{arrow:true}),
      line(step,O,{x:O.x,y:12},'axis',{arrow:true}),
      line(step,O,{x:O.x,y:height-10},'axis',{arrow:true}),
      point(step,O,'O'),
      textEntity(step,{x:10,y:O.y-3},'x','svg-label'),
      textEntity(step,{x:width-20,y:O.y-3},'−x','svg-label'),
      textEntity(step,{x:O.x+3,y:15},'z','svg-label'),
      textEntity(step,{x:O.x+3,y:height-11},'y','svg-label'),
      textEntity(step,{x:O.x+6,y:O.y-3},'x₁₂','svg-note'),
      textEntity(step,{x:width-24,y:15},'Π₂','svg-note'),
      textEntity(step,{x:width-24,y:height-10},'Π₁','svg-note')
    ];
  }

  function coordinateGuideEntities(step,O,name,p1,p2){
    const yFoot={x:O.x,y:p1.y};
    const zFoot={x:O.x,y:p2.y};
    return [
      line(step,yFoot,p1,'construction-line'),
      line(step,zFoot,p2,'construction-line'),
      point(step,yFoot,name+'ᵧ','construction-dot'),
      point(step,zFoot,name+'𝓏','construction-dot')
    ];
  }

  function choosePerpPoint(baseA,baseB,length,side){
    const u=unit2(vec2(baseA,baseB));
    let n=perp2(u);
    if(side<0) n=mul2(n,-1);
    return add2(baseA,mul2(n,length));
  }

  function solveTask2(coords){
    const A=coords.A,B=coords.B;
    const dx3=B.x-A.x, dy3=B.y-A.y, dz3=B.z-A.z;
    const L1=Math.hypot(dx3,dy3);
    const L2=Math.hypot(dx3,dz3);
    const L=Math.hypot(dx3,dy3,dz3);
    if(L<EPS) return {error:'A и B совпадают – длина отрезка равна нулю.'};

    const world={
      O:{x:0,y:0},
      A1:{x:-A.x,y:A.y},
      A2:{x:-A.x,y:-A.z},
      B1:{x:-B.x,y:B.y},
      B2:{x:-B.x,y:-B.z},
      Ax:{x:-A.x,y:0},
      Bx:{x:-B.x,y:0}
    };
    world.A0=choosePerpPoint(world.A1,world.B1,Math.abs(dz3),1);
    world.B0=choosePerpPoint(world.B2,world.A2,Math.abs(dy3),-1);

    const frame=gridFrame(Object.values(world),25,170,150);
    const S=p=>shiftPoint(p,frame.dx,frame.dy);
    const q={
      O:S(world.O),A1:S(world.A1),A2:S(world.A2),
      B1:S(world.B1),B2:S(world.B2),Ax:S(world.Ax),Bx:S(world.Bx),
      A0:S(world.A0),B0:S(world.B0)
    };
    const width=frame.width, height=frame.height;
    const alpha=Math.asin(Math.min(1,Math.abs(dz3)/L))*180/Math.PI;
    const beta=Math.asin(Math.min(1,Math.abs(dy3)/L))*180/Math.PI;

    const steps=[], push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));
    let i=0;
    push({
      title:'Проведи ось x₁₂',
      action:'Раздели поле на фронтальную Π₂ и горизонтальную Π₁ проекции горизонтальной осью x₁₂.',
      why:'Задача решается в системе двух плоскостей проекций.',
      measure:['1 клетка = 5 мм'],
      check:'Π₂ находится над x₁₂, Π₁ – под ней для положительных z и y.'
    },twoPlaneAxisEntities(i,q.O,width,height),{kind:'line',a:{x:8,y:q.O.y},b:{x:width-8,y:q.O.y}});

    i=steps.length;
    push({
      title:'Построй проекции точки A',
      action:'По xA = '+A.x+' мм поставь линию связи. От неё отложи yA = '+A.y+' мм и zA = '+A.z+' мм.',
      why:'A₁=(xA,yA), A₂=(xA,zA).',
      measure:['xA = '+A.x+' мм','yA = '+A.y+' мм','zA = '+A.z+' мм'],
      check:'A₁ и A₂ лежат на одной линии связи.'
    },[
      dim(i,q.O,q.Ax,Math.abs(A.x)+' мм',{x:0,y:-3}),
      line(i,q.Ax,q.A1,'construction-line'),
      line(i,q.Ax,q.A2,'construction-line'),
      ...coordinateGuideEntities(i,q.O,'A',q.A1,q.A2),
      point(i,q.Ax,'Aₓ','construction-dot'),
      point(i,q.A1,'A₁'),point(i,q.A2,'A₂')
    ],{kind:'line',a:q.Ax,b:q.A1});

    i=steps.length;
    push({
      title:'Построй проекции точки B',
      action:'Аналогично построй B₁ и B₂ по координатам B.',
      why:'B₁=(xB,yB), B₂=(xB,zB).',
      measure:['xB = '+B.x+' мм','yB = '+B.y+' мм','zB = '+B.z+' мм'],
      check:'B₁ и B₂ лежат на одной линии связи.'
    },[
      dim(i,q.O,q.Bx,Math.abs(B.x)+' мм',{x:0,y:-3}),
      line(i,q.Bx,q.B1,'construction-line'),
      line(i,q.Bx,q.B2,'construction-line'),
      ...coordinateGuideEntities(i,q.O,'B',q.B1,q.B2),
      point(i,q.Bx,'Bₓ','construction-dot'),
      point(i,q.B1,'B₁'),point(i,q.B2,'B₂')
    ],{kind:'line',a:q.Bx,b:q.B1});

    i=steps.length;
    push({
      title:'Соедини одноимённые проекции AB',
      action:'Соедини A₁–B₁ и A₂–B₂.',
      why:'Это горизонтальная и фронтальная проекции одного пространственного отрезка AB.',
      measure:['A₁B₁ = '+fmt(L1)+' мм','A₂B₂ = '+fmt(L2)+' мм'],
      check:'Обе линии соединяют проекции тех же концов A и B.'
    },[line(i,q.A1,q.B1,'object-line'),line(i,q.A2,q.B2,'object-line')]);

    i=steps.length;
    push({
      title:'Первый прямоугольный треугольник – на Π₁',
      action:'Из A₁ восстанови перпендикуляр к A₁B₁ и отложи на нём |Δz| = '+fmt(Math.abs(dz3))+' мм до A₀. Соедини A₀ с B₁.',
      why:'Катеты A₁B₁ и |zB−zA| взаимно перпендикулярны. Гипотенуза B₁A₀ равна натуральной величине AB.',
      measure:['|Δz| = '+fmt(Math.abs(dz3))+' мм = '+fmt(Math.abs(dz3)/GRID)+' клеток','НВ AB = '+fmt(L)+' мм','α = '+fmt(alpha)+'°'],
      check:'Угол при A₁ – 90°, B₁A₀ должен иметь длину '+fmt(L)+' мм.'
    },[
      line(i,q.A1,q.A0,'construction-line'),
      line(i,q.B1,q.A0,'answer-line'),
      point(i,q.A0,'A₀','answer-dot'),
      dim(i,q.A1,q.A0,'Δz='+fmt(Math.abs(dz3))+' мм'),
      textEntity(i,lerp2(q.B1,q.A0,.45),'НВ='+fmt(L)+' мм','dimension-text')
    ],{kind:'line',a:q.B1,b:q.A0});

    i=steps.length;
    push({
      title:'Второй прямоугольный треугольник – на Π₂',
      action:'Из B₂ восстанови перпендикуляр к A₂B₂ и отложи |Δy| = '+fmt(Math.abs(dy3))+' мм до B₀. Соедини B₀ с A₂.',
      why:'Теперь второй катет – разность удалений точек от Π₂. Полученная гипотенуза снова равна AB, что даёт независимую проверку.',
      measure:['|Δy| = '+fmt(Math.abs(dy3))+' мм = '+fmt(Math.abs(dy3)/GRID)+' клеток','НВ AB = '+fmt(L)+' мм','β = '+fmt(beta)+'°'],
      check:'Обе построенные натуральные величины должны совпасть: '+fmt(L)+' мм.'
    },[
      line(i,q.B2,q.B0,'construction-line'),
      line(i,q.A2,q.B0,'answer-line'),
      point(i,q.B0,'B₀','answer-dot'),
      dim(i,q.B2,q.B0,'Δy='+fmt(Math.abs(dy3))+' мм'),
      textEntity(i,lerp2(q.A2,q.B0,.48),'НВ='+fmt(L)+' мм','dimension-text')
    ],{kind:'line',a:q.A2,b:q.B0});

    i=steps.length;
    push({
      title:'Отметь углы наклона α и β',
      action:'На первом прямоугольном треугольнике отметь α при B₁ между B₁A₁ и натуральной величиной B₁A₀. На втором отметь β при A₂ между A₂B₂ и натуральной величиной A₂B₀.',
      why:'Проекция на соответствующую плоскость является прилежащим катетом прямоугольного треугольника, поэтому эти углы и есть углы наклона AB к Π₁ и Π₂.',
      measure:['α(AB,Π₁) = '+fmt(alpha)+'°','β(AB,Π₂) = '+fmt(beta)+'°','AB = '+fmt(L)+' мм'],
      check:'Две гипотенузы дают одну и ту же натуральную величину AB = '+fmt(L)+' мм.'
    },[
      ...angleMark(i,q.B1,q.A1,q.A0,8,'α='+fmt(alpha)+'°'),
      ...angleMark(i,q.A2,q.B2,q.B0,8,'β='+fmt(beta)+'°')
    ]);

    return {width,height,O:q.O,steps};
  }

  function collinear3(C,A,B){
    const ab=sub3(B,A), ac=sub3(C,A);
    return norm3(cross3(ab,ac)) <= 1e-6*Math.max(1,norm3(ab),norm3(ac));
  }

  function onSegment3(C,A,B){
    if(!collinear3(C,A,B)) return false;
    const ab=sub3(B,A), ac=sub3(C,A);
    const d=dot3(ac,ab), l2=dot3(ab,ab);
    return d>=-EPS && d<=l2+EPS;
  }

  function extendLine(P,Q,ext){
    const u=unit2(vec2(P,Q));
    if(norm2(u)<EPS) return null;
    return {a:add2(P,mul2(u,-ext)),b:add2(P,mul2(u,ext))};
  }

  function solveTask3(coords){
    const A=coords.A,B=coords.B,C=coords.C;
    if(norm3(sub3(B,A))<EPS) return {error:'A и B совпадают – прямая AB не определена.'};
    if(collinear3(C,A,B) && !onSegment3(C,A,B)) {
      return {error:'C лежит на прямой AB вне отрезка. Через такую C нельзя провести другую прямую, пересекающую именно отрезок AB.'};
    }
    const k=Number($('kSlider').value)/100;
    const cOn=onSegment3(C,A,B);
    const K=cOn ? {...C} : lerp3(A,B,k);
    const AB3=sub3(B,A);
    const profileAB=Math.abs(AB3.x)<EPS;
    const D=profileAB ? add3(C,mul3(AB3,.5)) : null;
    const raw=[
      {x:-A.x,y:A.y},{x:-A.x,y:-A.z},
      {x:-B.x,y:B.y},{x:-B.x,y:-B.z},
      {x:-C.x,y:C.y},{x:-C.x,y:-C.z},
      {x:-K.x,y:K.y},{x:-K.x,y:-K.z},{x:0,y:0}
    ];
    if(D) raw.push({x:-D.x,y:D.y},{x:-D.x,y:-D.z});
    const frame=gridFrame(raw,25,180,150), sx=frame.dx, sy=frame.dy;
    const b0=bounds(raw,25);
    const O={x:sx,y:sy};
    const P1=p=>shiftPoint({x:-p.x,y:p.y},sx,sy);
    const P2=p=>shiftPoint({x:-p.x,y:-p.z},sx,sy);
    const AX=p=>shiftPoint({x:-p.x,y:0},sx,sy);
    const q={
      A1:P1(A),A2:P2(A),B1:P1(B),B2:P2(B),C1:P1(C),C2:P2(C),
      K1:P1(K),K2:P2(K),Ax:AX(A),Bx:AX(B),Cx:AX(C),
      D1:D?P1(D):null,D2:D?P2(D):null,Dx:D?AX(D):null
    };
    const ext=Math.max(b0.width,b0.height)*.7;
    const a1=profileAB ? extendLine(q.C1,q.D1,ext) : extendLine(q.C1,add2(q.C1,vec2(q.A1,q.B1)),ext);
    const a2=profileAB ? extendLine(q.C2,q.D2,ext) : extendLine(q.C2,add2(q.C2,vec2(q.A2,q.B2)),ext);
    let l1,l2;
    if(cOn){
      let d={x:1,y:1,z:1};
      if(norm3(cross3(sub3(B,A),d))<1e-5) d={x:1,y:-1,z:1};
      const T=add3(C,mul3(d,30));
      l1=extendLine(q.C1,P1(T),ext);
      l2=extendLine(q.C2,P2(T),ext);
    } else {
      l1=extendLine(q.C1,q.K1,ext);
      l2=extendLine(q.C2,q.K2,ext);
    }
    const width=frame.width,height=frame.height;
    const steps=[],push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));

    let i=0;
    push({
      title:'Проведи ось x₁₂',
      action:'Проведи горизонтальную ось x₁₂. Положительное x на таком эпюре откладываем влево от O.',
      why:'На одной вертикальной линии связи будут находиться горизонтальная и фронтальная проекции каждой точки.',
      measure:['1 клетка = 5 мм'],
      check:'Ось x₁₂ горизонтальна.'
    },twoPlaneAxisEntities(i,O,width,height),{kind:'line',a:{x:8,y:O.y},b:{x:width-8,y:O.y}});

    [['A',A,q.A1,q.A2,q.Ax],['B',B,q.B1,q.B2,q.Bx],['C',C,q.C1,q.C2,q.Cx]].forEach(row=>{
      const name=row[0],p=row[1],p1=row[2],p2=row[3],px=row[4];
      let j=steps.length;
      push({
        title:'Построй проекции точки '+name,
        action:'От O отложи x'+name+' = '+p.x+' мм, затем по одной линии связи y'+name+' = '+p.y+' мм и z'+name+' = '+p.z+' мм.',
        why:name+'₁=(x,y), '+name+'₂=(x,z).',
        measure:['|x| '+Math.abs(p.x)+' мм','|y| '+Math.abs(p.y)+' мм','|z| '+Math.abs(p.z)+' мм'],
        check:name+'₁ и '+name+'₂ находятся на одной вертикали.'
      },[
        dim(j,O,px,Math.abs(p.x)+' мм',{x:0,y:-3}),
        line(j,px,p1,'construction-line'),
        line(j,px,p2,'construction-line'),
        ...coordinateGuideEntities(j,O,name,p1,p2),
        point(j,px,name+'ₓ','construction-dot'),
        point(j,p1,name+'₁'),
        point(j,p2,name+'₂')
      ],{kind:'line',a:px,b:p1});
    });

    i=steps.length;
    push({
      title:'Построй отрезок AB',
      action:'Соедини A₁ с B₁ и A₂ с B₂.',
      why:'Так получаем две одноимённые проекции исходного отрезка AB.',
      measure:[angleDeg(q.A1,q.B1)===null?'A₁B₁ вырождена': 'Наклон A₁B₁ ≈ '+fmt(angleDeg(q.A1,q.B1))+'°',
               angleDeg(q.A2,q.B2)===null?'A₂B₂ вырождена': 'Наклон A₂B₂ ≈ '+fmt(angleDeg(q.A2,q.B2))+'°'],
      check:'Проекции соединяют только одноимённые точки.'
    },[line(i,q.A1,q.B1,'object-line'),line(i,q.A2,q.B2,'object-line')]);

    if(profileAB){
      i=steps.length;
      push({
        title:'Особый случай: AB – профильная прямая',
        action:'Так как xA = xB, простого условия «a₁ ∥ A₁B₁ и a₂ ∥ A₂B₂» недостаточно для фиксации одного пространственного направления. Построй согласованную вспомогательную точку D = C + 0,5·(B−A).',
        why:'У профильной прямой обе основные проекции могут выглядеть вертикальными. Пара D₁/D₂ сохраняет одинаковый коэффициент 0,5 сразу по y и z и тем самым гарантирует a ∥ AB в пространстве.',
        measure:['D = ('+fmt(D.x)+'; '+fmt(D.y)+'; '+fmt(D.z)+')','CD = 0,5·AB по вектору направления'],
        check:'D₁ и D₂ лежат на одной линии связи, а C₁D₁/C₂D₂ задают согласованные проекции одной прямой.'
      },[
        line(i,q.D1,q.D2,'construction-line'),
        point(i,q.D1,'D₁','answer-dot'),
        point(i,q.D2,'D₂','answer-dot')
      ],{kind:'line',a:q.D1,b:q.D2});
    }

    i=steps.length;
    const ae=[];
    if(a1) ae.push(line(i,a1.a,a1.b,'answer-line'));
    else ae.push(point(i,q.C1,'a₁≡C₁','answer-dot'));
    push({
      title:'Проведи a₁ через C₁ параллельно A₁B₁',
      action:a1?'Перенеси направление A₁B₁ линейкой через C₁ и проведи a₁.':'A₁B₁ выродилась в точку – a₁ тоже является точечной проекцией C₁.',
      why:'У параллельных пространственных прямых одноимённые проекции параллельны.',
      measure:[a1?'a₁ ∥ A₁B₁':'точечная проекция'],
      check:a1?'Наклоны a₁ и A₁B₁ одинаковы.':'a₁ совпадает с C₁.'
    },ae,a1?{kind:'line',a:a1.a,b:a1.b}:null);

    i=steps.length;
    const ae2=[];
    if(a2) ae2.push(line(i,a2.a,a2.b,'answer-line'));
    else ae2.push(point(i,q.C2,'a₂≡C₂','answer-dot'));
    push({
      title:'Проведи a₂ через C₂ параллельно A₂B₂',
      action:a2?'Повтори построение на Π₂: a₂ через C₂ параллельно A₂B₂.':'A₂B₂ выродилась в точку – a₂ совпадает с C₂.',
      why:'Обе проекции вместе задают пространственную прямую a, параллельную AB.',
      measure:[a2?'a₂ ∥ A₂B₂':'точечная проекция'],
      check:'Параллельность проверена на обеих проекциях.'
    },ae2,a2?{kind:'line',a:a2.a,b:a2.b}:null);

    if(cOn){
      i=steps.length;
      push({
        title:'C уже лежит на AB',
        action:'В этом частном случае K=C. Выбери через C любое направление ℓ, не совпадающее с AB.',
        why:'Пересечение ℓ с AB уже происходит в C.',
        measure:['K=C'],
        check:'ℓ не должна совпадать с AB.'
      },[point(i,q.C1,'K₁=C₁','answer-dot'),point(i,q.C2,'K₂=C₂','answer-dot')]);
    } else {
      i=steps.length;
      const frac=Math.round(k*100);
      const base1=dist2(q.A1,q.B1);
      if(base1>EPS){
        push({
          title:'Выбери точку K₁ на A₁B₁',
          action:'Отложи K₁ на '+frac+'% пути от A₁ к B₁.',
          why:'Условие не фиксирует точку пересечения. Любая внутренняя точка K отрезка AB даёт корректное решение.',
          measure:['A₁K₁/A₁B₁ = '+frac+'%','A₁K₁ ≈ '+fmt(dist2(q.A1,q.K1))+' мм'],
          check:'K₁ лежит внутри A₁B₁.'
        },[point(i,q.K1,'K₁','answer-dot'),dim(i,q.A1,q.K1,frac+'%')]);
        i=steps.length;
        push({
          title:'Перенеси K₁ на A₂B₂',
          action:'Из K₁ проведи линию связи перпендикулярно x₁₂ до пересечения с A₂B₂. Получишь K₂.',
          why:'K₁ и K₂ – проекции одной пространственной точки K.',
          measure:['K₁K₂ ⟂ x₁₂'],
          check:'K₂ одновременно лежит на A₂B₂ и на линии связи K₁.'
        },[line(i,q.K1,q.K2,'construction-line'),point(i,q.K2,'K₂','answer-dot')],{kind:'line',a:q.K1,b:q.K2});
      } else {
        push({
          title:'A₁B₁ выродилась – выбери K₂',
          action:'Отложи K₂ на '+frac+'% пути от A₂ к B₂, затем перенеси её линией связи в K₁.',
          why:'Когда горизонтальная проекция AB – точка, выбор доли выполняется на невырожденной фронтальной проекции.',
          measure:['A₂K₂/A₂B₂ = '+frac+'%'],
          check:'K₁=A₁=B₁.'
        },[point(i,q.K2,'K₂','answer-dot'),line(i,q.K2,q.K1,'construction-line'),point(i,q.K1,'K₁','answer-dot')]);
      }
    }

    i=steps.length;
    const le1=l1?[line(i,l1.a,l1.b,'answer-line')]:[point(i,q.C1,'ℓ₁','answer-dot')];
    push({
      title:'Проведи ℓ₁',
      action:cOn?'Через C₁ проведи выбранное непараллельное AB направление.':'Через C₁ и K₁ проведи прямую и продли её.',
      why:'Две точки C и K задают искомую прямую ℓ; при K=C направление остаётся свободным.',
      measure:[l1&&angleDeg(l1.a,l1.b)!==null?'Наклон ℓ₁ ≈ '+fmt(angleDeg(l1.a,l1.b))+'°':'точечная проекция'],
      check:cOn?'ℓ₁ проходит через C₁.':'ℓ₁ проходит через C₁ и K₁.'
    },le1,l1?{kind:'line',a:l1.a,b:l1.b}:null);

    i=steps.length;
    const le2=l2?[line(i,l2.a,l2.b,'answer-line')]:[point(i,q.C2,'ℓ₂','answer-dot')];
    push({
      title:'Проведи ℓ₂ и проверь пересечение',
      action:cOn?'Через C₂ проведи согласованную вторую проекцию ℓ₂.':'Соедини C₂ и K₂ и продли прямую.',
      why:'Точки пересечения ℓ₁ с A₁B₁ и ℓ₂ с A₂B₂ должны быть проекциями одной K.',
      measure:['K₁ и K₂ на одной линии связи'],
      check:'a ∥ AB, а ℓ проходит через C и пересекает AB.'
    },le2,l2?{kind:'line',a:l2.a,b:l2.b}:null);

    return {width,height,O,steps};
  }


  function schemePoint3(rec){
    const x=(rec.p1[0]+rec.p2[0])/2;
    return {x:x,y:rec.p1[1],z:-rec.p2[1]};
  }

  function lineY(seg,x){
    const a={x:seg[0][0],y:seg[0][1]}, b={x:seg[1][0],y:seg[1][1]};
    if(Math.abs(b.x-a.x)<EPS) return (a.y+b.y)/2;
    return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);
  }

  function segmentExtensionEntities(step,seg,P,cls){
    if(!seg||!P)return [];
    const s=toSeg(seg),a=s[0],b=s[1];
    const d=vec2(a,b),dd=d.x*d.x+d.y*d.y;
    if(dd<EPS)return [];
    const ap=vec2(a,P);
    const t=(ap.x*d.x+ap.y*d.y)/dd;
    if(t>=-.01&&t<=1.01)return [];
    const end=t<0?a:b;
    if(dist2(end,P)<.5)return [];
    return [line(step,end,P,cls||'construction-line')];
  }

  function schemeLine3(rec){
    const xs=[
      rec.p1[0][0],rec.p1[1][0],rec.p2[0][0],rec.p2[1][0]
    ];
    const lo=Math.min(...xs), hi=Math.max(...xs);
    const span=Math.max(40,hi-lo);
    const x0=(lo+hi)/2-span*.32, x1=(lo+hi)/2+span*.32;
    return [
      {x:x0,y:lineY(rec.p1,x0),z:-lineY(rec.p2,x0)},
      {x:x1,y:lineY(rec.p1,x1),z:-lineY(rec.p2,x1)}
    ];
  }

  function closestLineMidpoint3(L1,L2){
    const p=L1[0],q=L2[0];
    const u=normalize3(sub3(L1[1],L1[0]));
    const v=normalize3(sub3(L2[1],L2[0]));
    const w=sub3(p,q);
    const b=dot3(u,v), d=dot3(u,w), e=dot3(v,w);
    const den=1-b*b;
    if(Math.abs(den)<1e-6) return mul3(add3(p,q),.5);
    const t=(b*e-d)/den;
    const s=(e-b*d)/den;
    const p1=add3(p,mul3(u,t));
    const p2=add3(q,mul3(v,s));
    return mul3(add3(p1,p2),.5);
  }

  function planeFromScheme(scheme){
    let P,Q,R;
    if(scheme.planeType==='ABC'){
      P=schemePoint3(scheme.points.A);
      Q=schemePoint3(scheme.points.B);
      R=schemePoint3(scheme.points.C);
    } else if(scheme.planeType==='line_point'){
      const L=schemeLine3(scheme.lines[scheme.planeLine]);
      P=L[0]; Q=L[1]; R=schemePoint3(scheme.points[scheme.planePoint]);
    } else if(scheme.planeType==='parallel_lines'){
      const names=scheme.planeLines;
      const L1=schemeLine3(scheme.lines[names[0]]);
      const L2=schemeLine3(scheme.lines[names[1]]);
      let u1=normalize3(sub3(L1[1],L1[0]));
      let u2=normalize3(sub3(L2[1],L2[0]));
      if(dot3(u1,u2)<0) u2=mul3(u2,-1);
      const u=normalize3(add3(u1,u2));
      const m1=mul3(add3(L1[0],L1[1]),.5);
      const m2=mul3(add3(L2[0],L2[1]),.5);
      P=m1; Q=add3(m1,u); R=m2;
    } else if(scheme.planeType==='intersecting_lines'){
      const names=scheme.planeLines;
      const L1=schemeLine3(scheme.lines[names[0]]);
      const L2=schemeLine3(scheme.lines[names[1]]);
      const u=normalize3(sub3(L1[1],L1[0]));
      const v=normalize3(sub3(L2[1],L2[0]));
      const c=closestLineMidpoint3(L1,L2);
      P=c; Q=add3(c,u); R=add3(c,v);
    } else {
      throw new Error('Неизвестный способ задания плоскости: '+scheme.planeType);
    }
    const n=cross3(sub3(Q,P),sub3(R,P));
    if(norm3(n)<EPS) throw new Error('Оцифрованные данные плоскости выродились.');
    const d=-dot3(n,P);
    return {P,Q,R,n,d};
  }

  function project3(P){
    return {p1:{x:P.x,y:P.y},p2:{x:P.x,y:-P.z}};
  }

  function normalize3(v){
    const n=norm3(v);
    return n<EPS?{x:0,y:0,z:0}:{x:v.x/n,y:v.y/n,z:v.z/n};
  }

  function line3Extent(P,d,halfLength){
    const u=normalize3(d), L=halfLength||95;
    return [add3(P,mul3(u,-L)),add3(P,mul3(u,L))];
  }

  function planeZAt(plane,x,y){
    if(Math.abs(plane.n.z)<EPS) return null;
    return -(plane.n.x*x+plane.n.y*y+plane.d)/plane.n.z;
  }

  function collectEntityPoints(e,out){
    if(e.a) out.push(e.a);
    if(e.b) out.push(e.b);
    if(e.p) out.push(e.p);
    if(e.c) out.push(e.c);
  }

  function shiftEntity(e,dx,dy){
    const sh=p=>p?{x:p.x+dx,y:p.y+dy}:p;
    if(e.a) e.a=sh(e.a);
    if(e.b) e.b=sh(e.b);
    if(e.p) e.p=sh(e.p);
    if(e.c) e.c=sh(e.c);
    return e;
  }

  function normalizeSteps(steps,minimumWidth,minimumHeight){
    const pts=[];
    steps.forEach(st=>(st.entities||[]).forEach(e=>collectEntityPoints(e,pts)));
    steps.forEach(st=>{
      if(st.tool){ if(st.tool.a) pts.push(st.tool.a); if(st.tool.b) pts.push(st.tool.b); }
    });

    const good=pts.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    const minimumW=minimumWidth||180,minimumH=minimumHeight||145,margin=18;
    if(!good.length) return {width:minimumW,height:minimumH,shift:{x:0,y:0},scale:1};

    const minX=Math.min(...good.map(p=>p.x)),maxX=Math.max(...good.map(p=>p.x));
    const minY=Math.min(...good.map(p=>p.y)),maxY=Math.max(...good.map(p=>p.y));
    const dx=margin-minX,dy=margin-minY;

    // Do not scale photographed source coordinates here. Scaling the whole final
    // solution by its furthest future construction made the first/source step tiny.
    // The mobile viewer now fits the *currently visible* construction instead.
    steps.forEach(st=>{
      (st.entities||[]).forEach(e=>shiftEntity(e,dx,dy));
      if(st.tool){
        if(st.tool.a) st.tool.a=shiftPoint(st.tool.a,dx,dy);
        if(st.tool.b) st.tool.b=shiftPoint(st.tool.b,dx,dy);
      }
    });

    return {
      width:Math.max(minimumW,maxX-minX+2*margin),
      height:Math.max(minimumH,maxY-minY+2*margin),
      shift:{x:dx,y:dy},
      scale:1
    };
  }

  function appendSourceJunctions(out,junctions,step){
    (junctions||[]).forEach(j=>{
      if(!j||!j.p1||!j.p2) return;
      const p2={x:+j.p2[0],y:+j.p2[1]},p1={x:+j.p1[0],y:+j.p1[1]};
      out.push(line(step,p2,p1,'source-guide-line'));
      out.push(point(step,p2,j.label2||'','source-guide-dot'));
      out.push(point(step,p1,j.label1||'','source-guide-dot'));
    });
  }

  function appendIntersectingLineProjector(out,lines,names,step){
    if(!lines || !names || names.length<2) return;
    const A=lines[names[0]],B=lines[names[1]];
    if(!A||!B) return;
    const p2=lineIntersection2(toSeg(A.p2)[0],toSeg(A.p2)[1],toSeg(B.p2)[0],toSeg(B.p2)[1]);
    const p1=lineIntersection2(toSeg(A.p1)[0],toSeg(A.p1)[1],toSeg(B.p1)[0],toSeg(B.p1)[1]);
    if(!p1 || !p2) return;

    // A real common point has p1/p2 on one projector. Old hand traces sometimes
    // contain slightly noisy endpoints; averaging a small x error is harmless.
    // A large mismatch means the trace is not reliable enough to reconstruct
    // the printed projector. Do not invent a remote intersection: it can move
    // the entire source drawing thousands of units away from the viewport.
    const xs=[
      ...A.p1.map(p=>+p[0]),...A.p2.map(p=>+p[0]),
      ...B.p1.map(p=>+p[0]),...B.p2.map(p=>+p[0])
    ].filter(Number.isFinite);
    const minX=Math.min(...xs),maxX=Math.max(...xs);
    const spanX=Math.max(30,maxX-minX);
    const xGap=Math.abs(p1.x-p2.x);
    const outside=Math.max(
      0,minX-p1.x,p1.x-maxX,
      minX-p2.x,p2.x-maxX
    );
    if(xGap>Math.max(18,spanX*.12) || outside>spanX*1.25) return;

    const x=(p1.x+p2.x)/2;
    const q2={x:x,y:p2.y}, q1={x:x,y:p1.y};
    out.push(line(step,q2,q1,'source-guide-line'));
    out.push(point(step,q2,'','source-guide-dot'));
    out.push(point(step,q1,'','source-guide-dot'));
  }

  function sourceLineDisplayName(name){
    return name==='l'?'ℓ':name;
  }

  function sourceLineLabelPoint(owner,name,proj,L){
    const custom=owner?.lineLabels?.[name]?.[proj];
    if(custom && custom.length>=2) return {x:+custom[0],y:+custom[1]};
    const seg=L?.[proj];
    if(!seg||!seg.length)return {x:0,y:0};
    const p=seg[seg.length-1];
    return {x:+p[0]+4,y:+p[1]-2};
  }

  function starterEntitiesFromScheme(scheme,step){
    // sourceGeometry keeps the immutable trace/provenance. The visible source
    // frame uses the relation-constrained copy (parallel/intersecting lines
    // regularized from that trace), so a photographed skew cannot make the
    // displayed givens mathematically contradict their printed condition.
    const src=scheme;
    const out=[];
    Object.entries(src.lines||{}).forEach(([name,L])=>{
      out.push(line(step,{x:L.p2[0][0],y:L.p2[0][1]},{x:L.p2[1][0],y:L.p2[1][1]},'object-line'));
      out.push(textEntity(step,sourceLineLabelPoint(src,name,'p2',L),sourceLineDisplayName(name)+'₂','svg-label'));
      out.push(line(step,{x:L.p1[0][0],y:L.p1[0][1]},{x:L.p1[1][0],y:L.p1[1][1]},'object-line'));
      out.push(textEntity(step,sourceLineLabelPoint(src,name,'p1',L),sourceLineDisplayName(name)+'₁','svg-label'));
    });
    Object.entries(src.points||{}).forEach(([name,P])=>{
      const q=normalizedPointRec(P);
      const p2={x:+q.p2[0],y:+q.p2[1]},p1={x:+q.p1[0],y:+q.p1[1]};
      out.push(line(step,p2,p1,'source-guide-line'));
      out.push(point(step,p2,name+'₂'));
      out.push(point(step,p1,name+'₁'));
    });
    if(src.planeType==='ABC'){
      appendABCPlaneEntities(out,src,step);
    }
    if(src.junctions&&src.junctions.length){
      // A source projector is part of the printed source only when it was
      // explicitly traced from the photographed sheet. Do not infer one merely
      // because the mathematical plane is defined by intersecting lines.
      appendSourceJunctions(out,src.junctions,step);
    }
    return out;
  }

  function median(values){
    const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
    if(!a.length) return null;
    const m=Math.floor(a.length/2);
    return a.length%2?a[m]:(a[m-1]+a[m])/2;
  }

  function diagramAxisFromScheme(scheme){
    const y1=[],y2=[],xs=[];
    const addPoint=(p,proj)=>{
      if(!p||p.length<2)return;
      xs.push(+p[0]);
      (proj==='p1'?y1:y2).push(+p[1]);
    };
    const addDef=def=>{
      if(!def)return;
      Object.values(def.lines||{}).forEach(L=>{
        (L.p1||[]).forEach(p=>addPoint(p,'p1'));
        (L.p2||[]).forEach(p=>addPoint(p,'p2'));
      });
      Object.values(def.points||{}).forEach(P=>{
        if(P.p1)addPoint(P.p1,'p1');
        if(P.p2)addPoint(P.p2,'p2');
      });
      if(def.line){
        const proj=def.type==='frontal_projecting'?'p2':'p1';
        (def.line||[]).forEach(p=>addPoint(p,proj));
      }
    };
    addDef(scheme);
    addDef(scheme?.planeA);
    addDef(scheme?.planeB);
    const through=scheme?.pointK||scheme?.pointThrough;
    if(through){
      if(through.p1)addPoint(through.p1,'p1');
      if(through.p2)addPoint(through.p2,'p2');
    }
    if(!xs.length || !y1.length || !y2.length) return null;
    const y=(median(y1)+median(y2))/2;
    const minX=Math.min(...xs),maxX=Math.max(...xs);
    const allY=y1.concat(y2);
    const originX=minX-18;
    return {
      a:{x:minX-30,y:y},
      b:{x:maxX+18,y:y},
      O:{x:originX,y:y},
      top:Math.min(...allY)-18,
      bottom:Math.max(...allY)+18
    };
  }

  function diagramReferenceAxisEntities(step,frame){
    if(!frame)return [];
    const O=frame.O||{x:frame.a.x+12,y:frame.a.y};
    return [
      line(step,frame.a,frame.b,'axis'),
      line(step,{x:O.x,y:frame.top},{x:O.x,y:frame.bottom},'axis'),
      textEntity(step,{x:frame.a.x+2,y:frame.a.y-3},'x₁₂','svg-label'),
      textEntity(step,{x:O.x+3,y:frame.top+4},'z','svg-label'),
      textEntity(step,{x:O.x+3,y:frame.bottom-2},'y','svg-label'),
      textEntity(step,{x:frame.b.x-14,y:frame.top+4},'Π₂','svg-note'),
      textEntity(step,{x:frame.b.x-14,y:frame.bottom-2},'Π₁','svg-note')
    ];
  }

  function diagramReferenceAxisStep(push,steps,scheme){
    const frame=diagramAxisFromScheme(scheme);
    if(!frame)return null;
    const i=steps.length;
    push({
      title:'Нанеси рабочие оси x₁₂, y и z',
      action:'После переноса исходной схемы проведи x₁₂ между Π₂ и Π₁. Слева добавь вертикальный ориентир: z вверх, y вниз. Это вспомогательная система направлений, а не часть напечатанного условия.',
      why:'По x₁₂ контролируются горизонтали и фронтали, а направления y и z показывают, куда относятся горизонтальная и фронтальная проекции. Следующие линии связи строятся перпендикулярно x₁₂.',
      measure:['x₁₂ – горизонтально','z – вверх от x₁₂','y – вниз от x₁₂'],
      check:'Оси не заменяют исходные линии и появляются только после чистого исходного кадра.'
    },diagramReferenceAxisEntities(i,frame),{kind:'line',a:frame.a,b:frame.b});
    return frame;
  }

  function rightAngleMarkEntities(step,P,uRaw,vRaw,size){
    const u=unit2(uRaw),v=unit2(vRaw),s=size||6;
    if(norm2(u)<EPS||norm2(v)<EPS) return [];
    const a=add2(P,mul2(u,s));
    const b=add2(a,mul2(v,s));
    const c=add2(P,mul2(v,s));
    return [
      line(step,a,b,'construction-line'),
      line(step,b,c,'construction-line')
    ];
  }

  function teacherLinePointTask4(scheme,steps,push){
    const lineName=scheme.planeLine||Object.keys(scheme.lines||{})[0];
    const pointName=scheme.planePoint||Object.keys(scheme.points||{})[0];
    const rec=scheme.lines&&scheme.lines[lineName];
    const rawPoint=scheme.points&&scheme.points[pointName];
    if(!rec||!rawPoint) return null;
    const A=normalizedPointRec(rawPoint);
    const A1={x:A.p1[0],y:A.p1[1]},A2={x:A.p2[0],y:A.p2[1]};
    const x1=lineXAtY(rec.p2,A2.y);
    if(!Number.isFinite(x1)) return null;
    const one2={x:x1,y:A2.y};
    const one1={x:x1,y:lineY(rec.p1,x1)};
    const hVec=vec2(A1,one1);
    if(norm2(hVec)<EPS) return null;

    const three1=lerp2(A1,one1,.58);
    const x2=lineXAtY(rec.p1,three1.y);
    if(!Number.isFinite(x2)) return null;
    const two1={x:x2,y:three1.y};
    const two2={x:x2,y:lineY(rec.p2,x2)};
    const three2={x:three1.x,y:A2.y};

    const lsDir=perp2(unit2(hVec));
    const lsFar=add2(three1,mul2(lsDir,240));
    const b1=toSeg(rec.p1);
    const four1=lineIntersection2(three1,lsFar,b1[0],b1[1]);
    if(!four1) return null;
    const four2={x:four1.x,y:lineY(rec.p2,four1.x)};

    const A3=schemePoint3(rawPoint);
    const one3=line3AtX(rec,one1.x);
    const two3=line3AtX(rec,two1.x);
    const three3={x:three1.x,y:three1.y,z:-three2.y};
    const four3=line3AtX(rec,four1.x);
    const h3=[A3,one3],f3=[two3,three3],ls3=[three3,four3];

    let i=steps.length;
    push({
      title:'Горизонталь h: проведи h₂ через '+pointName+'₂',
      action:'Через '+pointName+'₂ проведи h₂ параллельно x₁₂ до пересечения с '+lineName+'₂. Точку пересечения обозначь 1₂.',
      why:'У горизонтали плоскости фронтальная проекция параллельна x₁₂. Точка 1 принадлежит заданной прямой '+lineName+', поэтому после линии связи её первая проекция 1₁ должна лежать на '+lineName+'₁.',
      measure:['h₂ ∥ x₁₂',pointName+'₂ ∈ h₂','1₂ ∈ '+lineName+'₂'],
      check:'h₂ проходит через исходную точку '+pointName+'₂, а не через произвольное место поля.'
    },[
      ...segmentExtensionEntities(i,rec.p2,one2),
      line(i,A2,one2,'answer-line'),textEntity(i,one2,'h₂','svg-label'),
      point(i,one2,'1₂','construction-dot')
    ],{kind:'line',a:A2,b:one2});

    i=steps.length;
    push({
      title:'Опусти 1₂ на '+lineName+'₁ и получи h₁',
      action:'Из 1₂ проведи линию связи до '+lineName+'₁. Получи 1₁ и соедини '+pointName+'₁ с 1₁.',
      why:'1₁ и 1₂ – проекции одной точки заданной прямой. Две точки '+pointName+' и 1 однозначно задают горизонталь h в плоскости.',
      measure:['1₁1₂ – линия связи','h₁ = '+pointName+'₁1₁'],
      check:'1₁ лежит на '+lineName+'₁; '+pointName+'₁ и 1₁ соединены h₁.'
    },[
      ...segmentExtensionEntities(i,rec.p1,one1),
      line(i,one2,one1,'construction-line'),point(i,one1,'1₁','construction-dot'),
      line(i,A1,one1,'answer-line'),textEntity(i,one1,'h₁','svg-label')
    ],{kind:'line',a:one2,b:one1});

    i=steps.length;
    push({
      title:'Выбери точку 3₁ на уже построенной h₁',
      action:'На h₁ выбери удобную точку 3₁. Она задаёт уровень конкретной фронтали f.',
      why:'Фронталей в плоскости бесконечно много. Поэтому сначала явно выбирают одну точку на уже известной линии плоскости, а не ставят сразу две новые точки.',
      measure:['3₁ ∈ h₁'],
      check:'3₁ лежит на h₁; точки 2₁ на этом шаге ещё нет.'
    },[
      point(i,three1,'3₁','construction-dot')
    ]);

    i=steps.length;
    push({
      title:'Через 3₁ проведи f₁ ∥ x₁₂ и получи 2₁',
      action:'Через 3₁ проведи f₁ параллельно x₁₂ до пересечения с '+lineName+'₁. Пересечение обозначь 2₁.',
      why:'У фронтали горизонтальная проекция параллельна x₁₂. Теперь 2₁ определяется пересечением с заданной прямой '+lineName+', а не выбирается произвольно.',
      measure:['f₁ ∥ x₁₂','3₁ ∈ h₁','2₁ = f₁ ∩ '+lineName+'₁'],
      check:'2₁ появляется только после проведения f₁ и лежит на '+lineName+'₁.'
    },[
      ...segmentExtensionEntities(i,rec.p1,two1),
      line(i,two1,three1,'answer-line'),textEntity(i,two1,'f₁','svg-label'),
      point(i,two1,'2₁','construction-dot')
    ],{kind:'line',a:two1,b:three1});

    i=steps.length;
    push({
      title:'Подними 2₁ и 3₁ и получи f₂',
      action:'Из 2₁ подними проектор до '+lineName+'₂ – это 2₂. Из 3₁ подними проектор до h₂ – это 3₂. Соедини 2₂ и 3₂.',
      why:'2₂ и 3₂ – вторые проекции тех же пространственных точек 2 и 3. Поэтому соединяющая их линия является f₂.',
      measure:['2₁↔2₂ – одна линия связи','3₁↔3₂ – одна линия связи'],
      check:'2₂ лежит на '+lineName+'₂, 3₂ – на h₂.'
    },[
      ...segmentExtensionEntities(i,rec.p2,two2),
      line(i,two1,two2,'construction-line'),point(i,two2,'2₂','construction-dot'),
      line(i,three1,three2,'construction-line'),point(i,three2,'3₂','construction-dot'),
      line(i,two2,three2,'answer-line'),textEntity(i,two2,'f₂','svg-label')
    ],{kind:'line',a:two1,b:two2});

    i=steps.length;
    push({
      title:'Линия наибольшего ската: проведи ЛС₁ ⟂ h₁',
      action:'Через 3₁ проведи ЛС₁ перпендикулярно h₁ до пересечения с '+lineName+'₁. Пересечение обозначь 4₁.',
      why:'Горизонтальная проекция линии наибольшего ската плоскости перпендикулярна горизонтали этой плоскости. Именно это построение показано преподавателем.',
      measure:['ЛС₁ ⟂ h₁','4₁ ∈ '+lineName+'₁'],
      check:'У 3₁ должен быть прямой угол между h₁ и ЛС₁.'
    },[
      ...segmentExtensionEntities(i,rec.p1,four1),
      line(i,three1,four1,'answer-line'),textEntity(i,four1,'ЛС₁','svg-label'),
      point(i,four1,'4₁','construction-dot'),
      ...rightAngleMarkEntities(i,three1,vec2(three1,A1),vec2(three1,four1),5)
    ],{kind:'line',a:three1,b:four1});

    i=steps.length;
    push({
      title:'Подними 4₁ на '+lineName+'₂ и дострой ЛС₂',
      action:'Из 4₁ проведи проектор до '+lineName+'₂ – получишь 4₂. Соедини 3₂ и 4₂: это ЛС₂.',
      why:'Точки 3 и 4 принадлежат линии наибольшего ската и плоскости, поэтому их вторые проекции определяют ЛС₂.',
      measure:['4₁↔4₂ – линия связи','ЛС₂ = 3₂4₂'],
      check:'4₂ лежит на '+lineName+'₂; 3₂ уже лежит на h₂.'
    },[
      ...segmentExtensionEntities(i,rec.p2,four2),
      line(i,four1,four2,'construction-line'),point(i,four2,'4₂','construction-dot'),
      line(i,three2,four2,'answer-line'),textEntity(i,four2,'ЛС₂','svg-label')
    ],{kind:'line',a:four1,b:four2});

    return {
      h3:h3,f3:f3,ls3:ls3,
      dh:sub3(h3[1],h3[0]),
      df:sub3(f3[1],f3[0])
    };
  }

  function solveTask4Scheme(scheme,stored){
    const planeSymbol=scheme?.name||'Σ';
    let plane;
    try { plane=planeFromScheme(scheme); }
    catch(err){ return {error:err.message}; }

    const steps=[];
    const push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));
    let i=0;
    push({
      title:'Перенеси исходную схему варианта',
      action:'Сначала воспроизведи только заданные на листе линии и точки. Их наклоны – часть условия, поэтому сайт использует оцифрованную схему именно выбранного варианта.',
      why:'В заданиях 4–6 исходные данные задаются графически, а не таблицей координат. Нельзя заменять их произвольными наклонами.',
      measure:['Тонкие линии связи проводи перпендикулярно направлению между одноимёнными проекциями.','Сохраняй взаимное положение исходных линий.'],
      check:'До начала решения на листе должны быть только те объекты, которые напечатаны в условии.'
    },starterEntitiesFromScheme(scheme,i));

    const base=plane.P;

    const xAxis=diagramReferenceAxisStep(push,steps,scheme);

    let h3=null,f3=null,dh=null,df=null;
    const teacherBuild=scheme.planeType==='line_point'
      ? teacherLinePointTask4(scheme,steps,push)
      : null;

    if(teacherBuild){
      h3=teacherBuild.h3;
      f3=teacherBuild.f3;
      dh=teacherBuild.dh;
      df=teacherBuild.df;
    } else {
      const refs=planeReferenceLines(scheme);
      const hCut=sourceAnchoredLevelLine(refs,'p2');
      const fCut=sourceAnchoredLevelLine(refs,'p1');

      dh=cross3(plane.n,{x:0,y:0,z:1});
      if(norm3(dh)<EPS) dh={x:1,y:0,z:0};
      df=cross3(plane.n,{x:0,y:1,z:0});
      if(norm3(df)<EPS) df={x:1,y:0,z:0};

      h3=hCut?hCut.p3:line3Extent(base,dh,105);
      f3=fCut?fCut.p3:line3Extent(base,df,105);
      if(hCut) dh=sub3(h3[1],h3[0]);
      if(fCut) df=sub3(f3[1],f3[0]);

      let ds=cross3(plane.n,dh);
      if(norm3(ds)<EPS) ds=cross3(plane.n,df);
      const lsBase=mul3(add3(h3[0],h3[1]),.5);
      const ls3=line3Extent(lsBase,ds,90);

      const h0=project3(h3[0]),h1=project3(h3[1]);
      const f0=project3(f3[0]),f1=project3(f3[1]);
      const ls0=project3(ls3[0]),ls1=project3(ls3[1]);

      const hPrimary=hCut?hCut.primary:[h0.p2,h1.p2];
      const hPaired=hCut?hCut.paired:[h0.p1,h1.p1];

      i=steps.length;
      push({
        title:'Выбери точку 1₂ на '+refs[0].name+'₂',
        action:'На уже существующей линии '+refs[0].name+'₂ выбери удобную точку 1₂. Она задаёт, какую именно горизонталь плоскости будем строить.',
        why:'Горизонталей в одной плоскости бесконечно много. Поэтому первая точка не вычисляется из условия – её разрешено выбрать, но только на линии, принадлежащей плоскости.',
        measure:['1₂ ∈ '+refs[0].name+'₂'],
        check:'1₂ должна лежать точно на '+refs[0].name+'₂. Никакой второй точки на этом шаге ещё нет.'
      },[
        ...(hCut?segmentExtensionEntities(i,refs[0].rec[hCut.proj],hPrimary[0]):[]),
        point(i,hPrimary[0],'1₂','construction-dot')
      ]);

      i=steps.length;
      push({
        title:'Через 1₂ проведи h₂ ∥ x₁₂ и получи 2₂',
        action:'Через 1₂ проведи h₂ параллельно x₁₂ до пересечения с '+refs[1].name+'₂. Полученное пересечение обозначь 2₂.',
        why:'У горизонтали фронтальная проекция параллельна x₁₂. В отличие от 1₂, точка 2₂ уже не выбирается – она определяется пересечением построенной h₂ с другой линией плоскости.',
        measure:['h₂ ∥ x₁₂','2₂ = h₂ ∩ '+refs[1].name+'₂'],
        check:'2₂ появляется только после проведения h₂ и лежит на '+refs[1].name+'₂.'
      },[
        ...(hCut?segmentExtensionEntities(i,refs[1].rec[hCut.proj],hPrimary[1]):[]),
        line(i,hPrimary[0],hPrimary[1],'answer-line'),
        point(i,hPrimary[1],'2₂','construction-dot'),
        textEntity(i,hPrimary[1],'h₂','svg-label')
      ],{kind:'line',a:hPrimary[0],b:hPrimary[1]});

      i=steps.length;
      push({
        title:'Перенеси 1₂ и 2₂ на Π₁ и получи h₁',
        action:'Из 1₂ и 2₂ проведи линии связи до соответствующих первых проекций опорных линий. Получи 1₁ и 2₁ и соедини их.',
        why:'Обе проекции h строятся через одни и те же пространственные точки 1 и 2.',
        measure:['1₂↔1₁ – линия связи','2₂↔2₁ – линия связи'],
        check:'1₁/2₁ принадлежат соответствующим исходным линиям.'
      },[
        ...(hCut?segmentExtensionEntities(i,refs[0].rec[hCut.other],hPaired[0]):[]),
        ...(hCut?segmentExtensionEntities(i,refs[1].rec[hCut.other],hPaired[1]):[]),
        line(i,hPaired[0],hPaired[1],'answer-line'),
        textEntity(i,hPaired[1],'h₁','svg-label'),
        line(i,hPrimary[0],hPaired[0],'construction-line'),
        line(i,hPrimary[1],hPaired[1],'construction-line'),
        point(i,hPaired[0],'1₁','construction-dot'),point(i,hPaired[1],'2₁','construction-dot')
      ],{kind:'line',a:hPaired[0],b:hPaired[1]});

      const fPrimary=fCut?fCut.primary:[f0.p1,f1.p1];
      const fPaired=fCut?fCut.paired:[f0.p2,f1.p2];

      i=steps.length;
      push({
        title:'Выбери точку 3₁ на '+refs[0].name+'₁',
        action:'На уже существующей линии '+refs[0].name+'₁ выбери удобную точку 3₁. Она задаёт конкретную фронталь этой плоскости.',
        why:'Фронталей в плоскости тоже бесконечно много. Первую точку разрешено выбрать только на линии, принадлежащей плоскости.',
        measure:['3₁ ∈ '+refs[0].name+'₁'],
        check:'3₁ лежит на '+refs[0].name+'₁. Точка 4₁ пока не построена.'
      },[
        ...(fCut?segmentExtensionEntities(i,refs[0].rec[fCut.proj],fPrimary[0]):[]),
        point(i,fPrimary[0],'3₁','construction-dot')
      ]);

      i=steps.length;
      push({
        title:'Через 3₁ проведи f₁ ∥ x₁₂ и получи 4₁',
        action:'Через 3₁ проведи f₁ параллельно x₁₂ до пересечения с '+refs[1].name+'₁. Полученное пересечение обозначь 4₁.',
        why:'У фронтали горизонтальная проекция параллельна x₁₂. Точка 4₁ однозначно получается пересечением, а не выбирается произвольно.',
        measure:['f₁ ∥ x₁₂','4₁ = f₁ ∩ '+refs[1].name+'₁'],
        check:'4₁ появляется только после проведения f₁ и лежит на '+refs[1].name+'₁.'
      },[
        ...(fCut?segmentExtensionEntities(i,refs[1].rec[fCut.proj],fPrimary[1]):[]),
        line(i,fPrimary[0],fPrimary[1],'answer-line'),
        point(i,fPrimary[1],'4₁','construction-dot'),
        textEntity(i,fPrimary[1],'f₁','svg-label')
      ],{kind:'line',a:fPrimary[0],b:fPrimary[1]});

      i=steps.length;
      push({
        title:'Перенеси 3₁ и 4₁ на Π₂ и получи f₂',
        action:'Из 3₁ и 4₁ проведи линии связи до соответствующих вторых проекций опорных линий. Соедини 3₂ и 4₂.',
        why:'f₁ и f₂ построены через одни и те же точки 3 и 4.',
        measure:['3₁↔3₂ – линия связи','4₁↔4₂ – линия связи'],
        check:'3₂/4₂ принадлежат тем же исходным объектам.'
      },[
        ...(fCut?segmentExtensionEntities(i,refs[0].rec[fCut.other],fPaired[0]):[]),
        ...(fCut?segmentExtensionEntities(i,refs[1].rec[fCut.other],fPaired[1]):[]),
        line(i,fPaired[0],fPaired[1],'answer-line'),
        textEntity(i,fPaired[1],'f₂','svg-label'),
        line(i,fPrimary[0],fPaired[0],'construction-line'),
        line(i,fPrimary[1],fPaired[1],'construction-line'),
        point(i,fPaired[0],'3₂','construction-dot'),point(i,fPaired[1],'4₂','construction-dot')
      ],{kind:'line',a:fPaired[0],b:fPaired[1]});

      // Build the greatest-slope line graphically from h, as on paper:
      // S lies on h; ЛС₁ ⟂ h₁; point 5 is obtained on a real defining line.
      let slopeGraphic=null;
      if(hCut && refs.length>=2){
        const S1=lerp2(hPaired[0],hPaired[1],.52);
        const S2=lerp2(hPrimary[0],hPrimary[1],.52);
        const hDir=vec2(hPaired[0],hPaired[1]);
        const lsDir2=perp2(unit2(hDir));
        const rayA=add2(S1,mul2(lsDir2,-400));
        const rayB=add2(S1,mul2(lsDir2,400));
        let best=null;
        refs.slice(0,2).forEach((ref,idx)=>{
          if(!ref?.rec?.p1 || !ref?.rec?.p2) return;
          const seg=toSeg(ref.rec.p1);
          const T1=lineIntersection2(rayA,rayB,seg[0],seg[1]);
          if(!T1) return;
          const distance=dist2(S1,T1);
          if(distance<7 || distance>190) return;
          const T2={x:T1.x,y:lineY(ref.rec.p2,T1.x)};
          if(!Number.isFinite(T2.y)) return;
          if(!best || distance<best.distance) best={ref,idx,S1,S2,T1,T2,distance};
        });
        slopeGraphic=best;
      }

      if(slopeGraphic){
        const {ref,S1,S2,T1,T2}=slopeGraphic;
        i=steps.length;
        push({
          title:'Выбери точку S₁ на h₁',
          action:'На уже построенной горизонтали h₁ выбери удобную точку S₁.',
          why:'Линий наибольшего ската в плоскости можно провести несколько параллельных. Поэтому сначала явно задаётся точка, через которую строится конкретная ЛС.',
          measure:['S₁ ∈ h₁'],
          check:'S₁ лежит на h₁; точки 5₁ и линии ЛС₁ на этом шаге ещё нет.'
        },[
          point(i,S1,'S₁','construction-dot')
        ]);

        i=steps.length;
        push({
          title:'Через S₁ проведи ЛС₁ ⟂ h₁ и получи 5₁',
          action:'Через S₁ проведи ЛС₁ перпендикулярно h₁ до пересечения с '+ref.name+'₁. Пересечение обозначь 5₁.',
          why:'Горизонтальная проекция линии наибольшего ската плоскости перпендикулярна горизонтали. Точка 5₁ определяется пересечением с существующей линией плоскости.',
          measure:['ЛС₁ ⟂ h₁','5₁ = ЛС₁ ∩ '+ref.name+'₁'],
          check:'Прямой угол стоит у S₁, а 5₁ появляется только в пересечении с '+ref.name+'₁.'
        },[
          ...segmentExtensionEntities(i,ref.rec.p1,T1),
          line(i,S1,T1,'answer-line'),textEntity(i,T1,'ЛС₁','svg-label'),
          point(i,T1,'5₁','construction-dot'),
          ...rightAngleMarkEntities(i,S1,vec2(S1,hPaired[0]),vec2(S1,T1),5)
        ],{kind:'line',a:S1,b:T1});

        i=steps.length;
        push({
          title:'Перенеси S₁ и 5₁ на Π₂ и получи ЛС₂',
          action:'Из S₁ подними проектор до h₂ – получи S₂. Из 5₁ подними проектор до '+ref.name+'₂ – получи 5₂. Соедини S₂ и 5₂.',
          why:'S и 5 – две реальные точки линии наибольшего ската, поэтому их вторые проекции однозначно задают ЛС₂.',
          measure:['S₁↔S₂ – линия связи','5₁↔5₂ – линия связи','ЛС₂ = S₂5₂'],
          check:'S₂ лежит на h₂, 5₂ – на '+ref.name+'₂.'
        },[
          ...segmentExtensionEntities(i,ref.rec.p2,T2),
          line(i,S1,S2,'construction-line'),point(i,S2,'S₂','construction-dot'),
          line(i,T1,T2,'construction-line'),point(i,T2,'5₂','construction-dot'),
          line(i,S2,T2,'answer-line'),textEntity(i,T2,'ЛС₂','svg-label')
        ],{kind:'line',a:S1,b:S2});
      } else {
        // Fallback only for a degenerate trace where the graphical intersection
        // cannot be recovered reliably.
        i=steps.length;
        const lsCross=project3(lsBase);
        push({
          title:'Построй линию наибольшего ската ЛС₁',
          action:'Через точку S₁ на h₁ проведи ЛС₁ перпендикулярно h₁.',
          why:'Горизонтальная проекция линии наибольшего ската плоскости перпендикулярна её горизонтали.',
          measure:['ЛС₁ ⟂ h₁','Угол = 90°'],
          check:'S₁ лежит на h₁, у пересечения отмечен прямой угол.'
        },[
          line(i,ls0.p1,ls1.p1,'answer-line'),
          point(i,lsCross.p1,'S₁','construction-dot'),
          textEntity(i,ls1.p1,'ЛС₁','svg-label'),
          ...rightAngleMarkEntities(i,lsCross.p1,vec2(lsCross.p1,h0.p1),vec2(lsCross.p1,ls1.p1),5)
        ],{kind:'line',a:ls0.p1,b:ls1.p1});

        i=steps.length;
        push({
          title:'Дострой ЛС₂ по линиям связи',
          action:'Возьми две точки ЛС₁, найди их вторые проекции по принадлежности плоскости и соедини.',
          why:'Этот запасной путь используется только если исходная трассировка вырождена для обычного графического пересечения.',
          measure:['Одноимённые точки ЛС₁/ЛС₂ имеют общий x.'],
          check:'ЛС₁/ЛС₂ задают одну пространственную линию.'
        },[
          line(i,ls0.p2,ls1.p2,'answer-line'),
          textEntity(i,ls1.p2,'ЛС₂','svg-label'),
          line(i,ls0.p1,ls0.p2,'construction-line'),
          line(i,ls1.p1,ls1.p2,'construction-line'),
          point(i,lsCross.p2,'S₂','construction-dot'),
          line(i,lsCross.p1,lsCross.p2,'construction-line')
        ],{kind:'line',a:ls0.p2,b:ls1.p2});
      }
    }

    const op=scheme.operation||{};
    let L3=null,target3=null,through3=null;
    if(op.through && scheme.points && scheme.points[op.through]) through3=schemePoint3(scheme.points[op.through]);

    if(op.type==='line_parallel_horizontal' && through3){
      L3=line3Extent(through3,dh,100);
      i=steps.length;
      const a=project3(L3[0]),b=project3(L3[1]);
      push({
        title:'Через '+op.through+' проведи ℓ ∥ h',
        action:'Через заданную точку проведи ℓ параллельно уже построенной горизонтали h плоскости.',
        why:'Требование относится именно к горизонтали: пространственные направления ℓ и h должны совпадать, поэтому обе пары одноимённых проекций строятся параллельно.',
        measure:['ℓ₁ ∥ h₁','ℓ₂ ∥ h₂'],
        check:'ℓ проходит через '+op.through+', а её обе проекции параллельны соответствующим проекциям h.'
      },[
        line(i,a.p1,b.p1,'answer-line'),textEntity(i,b.p1,'ℓ₁','svg-label'),
        line(i,a.p2,b.p2,'answer-line'),textEntity(i,b.p2,'ℓ₂','svg-label')
      ],{kind:'line',a:a.p1,b:b.p1});
    } else if(op.type==='line_parallel_plane' && through3){
      L3=line3Extent(through3,dh,100);
      i=steps.length;
      const a=project3(L3[0]),b=project3(L3[1]);
      push({
        title:'Через '+op.through+' проведи ℓ ∥ '+planeSymbol,
        action:'Через заданную точку проведи ℓ параллельно построенной горизонтали h плоскости.',
        why:'Если прямая параллельна направлению, лежащему в плоскости, и сама не лежит в этой плоскости, её направление принадлежит плоскости. Поэтому ℓ ∥ h даёт ℓ ∥ '+planeSymbol+'.',
        measure:['ℓ₁ ∥ h₁','ℓ₂ ∥ h₂'],
        check:'Одноимённые проекции ℓ и h попарно параллельны.'
      },[
        line(i,a.p1,b.p1,'answer-line'),textEntity(i,b.p1,'ℓ₁','svg-label'),
        line(i,a.p2,b.p2,'answer-line'),textEntity(i,b.p2,'ℓ₂','svg-label')
      ],{kind:'line',a:a.p1,b:b.p1});
    } else if(op.type==='line_intersects_frontale' && through3){
      target3=add3(base,mul3(normalize3(df),38));
      L3=[through3,target3];
      i=steps.length;
      const T=project3(target3),Q=project3(through3);
      push({
        title:'Выбери T₁ на фронтали f₁',
        action:'На уже построенной f₁ отметь удобную точку T₁.',
        why:'Чтобы задать конкретную точку T фронтали, сначала достаточно выбрать одну её проекцию на существующей f₁. T₂ нельзя ставить независимо.',
        measure:['T₁ ∈ f₁'],
        check:'На этом шаге есть только T₁; T₂ ещё не построена.'
      },[point(i,T.p1,'T₁','construction-dot')]);

      i=steps.length;
      push({
        title:'По линии связи получи T₂ на f₂',
        action:'Из T₁ проведи проектор до f₂. Пересечение обозначь T₂.',
        why:'T₁ и T₂ – проекции одной точки фронтали, поэтому T₂ однозначно определяется линией связи и принадлежностью f₂.',
        measure:['T₁↔T₂ – одна линия связи','T₂ ∈ f₂'],
        check:'T₂ получена пересечением проектора с f₂, а не выбрана отдельно.'
      },[
        line(i,T.p1,T.p2,'construction-line'),
        point(i,T.p2,'T₂','construction-dot')
      ]);

      i=steps.length;
      push({
        title:'Соедини '+op.through+' с T – получишь ℓ',
        action:'Проведи ℓ₁ через '+op.through+'₁ и T₁, затем ℓ₂ через '+op.through+'₂ и T₂.',
        why:'В пространстве две точки однозначно задают прямую. T принадлежит фронтали, поэтому ℓ пересекает фронталь именно в T.',
        measure:['ℓ ∩ f = T'],
        check:'Обе точки пересечения одноимённых проекций соответствуют одной T.'
      },[
        line(i,Q.p1,T.p1,'answer-line'),textEntity(i,T.p1,'ℓ₁','svg-label'),
        line(i,Q.p2,T.p2,'answer-line'),textEntity(i,T.p2,'ℓ₂','svg-label')
      ],{kind:'line',a:Q.p1,b:T.p1});
    } else if(op.type==='line_intersects_horizontal' && through3){
      target3=lerp3(h3[0],h3[1],.58);
      L3=[through3,target3];
      i=steps.length;
      const T=project3(target3),Q=project3(through3);
      push({
        title:'Выбери T₂ на горизонтали h₂',
        action:'На уже построенной h₂ отметь удобную точку T₂.',
        why:'Горизонталь уже построена, поэтому конкретную точку T сначала можно выбрать на её фронтальной проекции h₂. T₁ пока не задаётся.',
        measure:['T₂ ∈ h₂'],
        check:'На этом шаге есть только T₂; T₁ ещё не построена.'
      },[
        point(i,T.p2,'T₂','construction-dot')
      ]);

      i=steps.length;
      push({
        title:'По линии связи получи T₁ на h₁',
        action:'Из T₂ проведи проектор до h₁. Пересечение обозначь T₁.',
        why:'T₁ и T₂ – проекции одной пространственной точки T, поэтому T₁ определяется линией связи и принадлежностью h₁.',
        measure:['T₂↔T₁ – одна линия связи','T₁ ∈ h₁'],
        check:'T₁ получена на h₁ проектором из T₂, а не выбрана отдельно.'
      },[
        line(i,T.p2,T.p1,'construction-line'),
        point(i,T.p1,'T₁','construction-dot')
      ]);

      i=steps.length;
      push({
        title:'Соедини '+op.through+' с T – получишь ℓ',
        action:'Проведи ℓ₁ через '+op.through+'₁ и T₁, затем ℓ₂ через '+op.through+'₂ и T₂.',
        why:'T принадлежит h, поэтому построенная через '+op.through+' и T прямая ℓ гарантированно пересекает горизонталь h.',
        measure:['ℓ ∩ h = T'],
        check:'Обе проекции точки пересечения согласованы одной линией связи.'
      },[
        line(i,Q.p1,T.p1,'answer-line'),textEntity(i,T.p1,'ℓ₁','svg-label'),
        line(i,Q.p2,T.p2,'answer-line'),textEntity(i,T.p2,'ℓ₂','svg-label')
      ],{kind:'line',a:Q.p1,b:T.p1});
    } else if(op.type==='line_intersects_named' && through3 && scheme.lines && scheme.lines[op.target]){
      const targetLine=schemeLine3(scheme.lines[op.target]);
      target3=lerp3(targetLine[0],targetLine[1],.55);
      L3=[through3,target3];
      const T=project3(target3),Q=project3(through3);
      i=steps.length;
      push({
        title:'Выбери T₁ на прямой '+op.target+'₁',
        action:'На уже заданной '+op.target+'₁ отметь удобную точку T₁.',
        why:'Будущая ℓ должна пересечь '+op.target+'. Сначала выбирается одна проекция общей точки T на существующей прямой, а вторая получается по линии связи.',
        measure:['T₁ ∈ '+op.target+'₁'],
        check:'На этом шаге есть только T₁; T₂ ещё не построена.'
      },[point(i,T.p1,'T₁','construction-dot')]);

      i=steps.length;
      push({
        title:'По линии связи получи T₂ на '+op.target+'₂',
        action:'Из T₁ проведи проектор до '+op.target+'₂ и обозначь пересечение T₂.',
        why:'T₂ определяется той же пространственной точкой T на заданной прямой '+op.target+', поэтому отдельно выбирать её нельзя.',
        measure:['T₁↔T₂ – одна линия связи','T₂ ∈ '+op.target+'₂'],
        check:'T₂ стоит на '+op.target+'₂ в пересечении с проектором из T₁.'
      },[
        line(i,T.p1,T.p2,'construction-line'),
        point(i,T.p2,'T₂','construction-dot')
      ]);

      i=steps.length;
      push({
        title:'Проведи ℓ через '+op.through+' и T',
        action:'Соедини одноимённые проекции '+op.through+' и T.',
        why:'Так ℓ гарантированно проходит через заданную точку и пересекает '+op.target+' в T.',
        measure:['ℓ ∩ '+op.target+' = T'],
        check:'Точки пересечения на Π₁ и Π₂ согласованы линией связи.'
      },[
        line(i,Q.p1,T.p1,'answer-line'),textEntity(i,T.p1,'ℓ₁','svg-label'),
        line(i,Q.p2,T.p2,'answer-line'),textEntity(i,T.p2,'ℓ₂','svg-label')
      ],{kind:'line',a:Q.p1,b:T.p1});
    }

    if(op.resultPoint){
      let R3=null,ref3=null;
      if(L3){
        ref3=Array.isArray(L3)?lerp3(L3[0],L3[1],.62):null;
      }
      if(!ref3 && through3) ref3=through3;

      if(op.relation==='above_named' && scheme.lines && scheme.lines[op.target]){
        const named=schemeLine3(scheme.lines[op.target]);
        ref3=lerp3(named[0],named[1],.56);
        R3={x:ref3.x,y:ref3.y,z:ref3.z+52};
      } else if(op.relation==='above_line' && ref3){
        R3={x:ref3.x,y:ref3.y,z:ref3.z+52};
      } else if(op.relation==='below_line' && ref3){
        R3={x:ref3.x,y:ref3.y,z:ref3.z-52};
      } else if(op.relation==='behind_line' && ref3){
        R3={x:ref3.x,y:ref3.y-52,z:ref3.z};
      } else if(op.relation==='front_of_line' && ref3){
        R3={x:ref3.x,y:ref3.y+52,z:ref3.z};
      } else if(op.relation==='above_plane'){
        ref3=lerp3(h3[0],h3[1],.68);
        R3={x:ref3.x,y:ref3.y,z:ref3.z+52};
      } else if(op.relation==='front_of_plane'){
        ref3=lerp3(f3[0],f3[1],.68);
        R3={x:ref3.x,y:ref3.y+52,z:ref3.z};
      } else if(op.relation==='below_plane'){
        ref3=lerp3(h3[0],h3[1],.68);
        R3={x:ref3.x,y:ref3.y,z:ref3.z-52};
      }

      if(R3){
        const R=project3(R3),Ref=ref3?project3(ref3):null;

        if(Ref){
          i=steps.length;
          let refWhere='на опорном объекте';
          if(op.relation==='above_named') refWhere='на прямой '+(op.target||'a');
          else if(['above_line','below_line','behind_line','front_of_line'].includes(op.relation)) refWhere='на построенной прямой ℓ';
          else if(op.relation==='above_plane'||op.relation==='below_plane') refWhere='на горизонтали h плоскости '+planeSymbol;
          else if(op.relation==='front_of_plane') refWhere='на фронтали f плоскости '+planeSymbol;
          push({
            title:'Выбери вспомогательную точку N '+refWhere,
            action:'Отметь N₁ и N₂ '+refWhere+' и свяжи их тонкой линией проекционной связи.',
            why:'Итоговую точку нельзя ставить непосредственно из вычисления. Сначала нужна видимая точка N на уже построенном объекте, относительно которой на чертеже откладывается требуемое положение.',
            measure:['N₁↔N₂ – одна линия связи'],
            check:'Обе проекции N принадлежат одному и тому же построенному объекту.'
          },[
            point(i,Ref.p1,'N₁','construction-dot'),
            point(i,Ref.p2,'N₂','construction-dot'),
            line(i,Ref.p2,Ref.p1,'construction-line')
          ]);
        }

        i=steps.length;
        let relationText='';
        let why='';
        if(op.relation==='above_named'){
          relationText='над прямой '+(op.target||'a');
          why='Для точки над заданной прямой сохраняются x и y выбранной точки этой прямой, а z увеличивается. Поэтому на Π₁ проекция совпадает с точкой прямой, а на Π₂ располагается выше.';
        } else if(op.relation==='above_line'){
          relationText='над прямой ℓ';
          why='Для точки прямо над выбранной точкой ℓ сохраняются x и y, а z увеличивается. Поэтому горизонтальная проекция совпадает, а фронтальная поднимается.';
        } else if(op.relation==='below_line'){
          relationText='под прямой ℓ';
          why='Сохраняем x и y точки на ℓ, уменьшая только z. На Π₁ проекция совпадает с ℓ₁, на Π₂ новая точка располагается ниже.';
        } else if(op.relation==='behind_line'){
          relationText='за прямой ℓ';
          why='Для отношения по глубине сохраняем x и z, меняя y. Поэтому фронтальная проекция совпадает по положению с точкой ℓ₂, а различие видно на Π₁.';
        } else if(op.relation==='front_of_line'){
          relationText='перед прямой ℓ';
          why='Для положения перед прямой сохраняем x и z выбранной точки ℓ и увеличиваем y. Поэтому на Π₂ проекция сохраняет положение по высоте, а на Π₁ точка смещается вперёд по глубине.';
        } else if(op.relation==='above_plane'){
          relationText='над плоскостью '+planeSymbol;
          why='Сначала находим точку плоскости с теми же x и y, затем увеличиваем только z. Так новая точка оказывается строго над '+planeSymbol+'.';
        } else if(op.relation==='front_of_plane'){
          relationText='перед плоскостью '+planeSymbol;
          why='Сначала находим точку плоскости с теми же x и z, затем увеличиваем y. Так новая точка располагается перед '+planeSymbol+' по направлению удаления от фронтальной плоскости проекций.';
        } else {
          relationText='под плоскостью '+planeSymbol;
          why='Сначала вертикалью находим точку плоскости с теми же x,y, затем уменьшаем z. Это даёт точку строго под '+planeSymbol+'.';
        }
        let relationAction='От вспомогательной точки N отложи требуемое положение итоговой точки на той же линии проекционной связи. Условие не задаёт расстояние, поэтому смещение выбирается только для читаемости чертежа.';
        if(op.relation==='above_line' || op.relation==='below_line'){
          relationAction=op.resultPoint+'₁ совмести с N₁ на ℓ₁. По этой линии связи '+op.resultPoint+'₂ располагается '+(op.relation==='above_line'?'выше':'ниже')+' N₂.';
        } else if(op.relation==='behind_line' || op.relation==='front_of_line'){
          relationAction=op.resultPoint+'₂ совмести с N₂ на ℓ₂. По той же линии связи '+op.resultPoint+'₁ располагается '+(op.relation==='front_of_line'?'перед':'за')+' N₁.';
        } else if(op.relation==='above_named'){
          relationAction=op.resultPoint+'₁ совмести с N₁ на '+(op.target||'a')+'₁. На той же линии связи '+op.resultPoint+'₂ располагается выше N₂.';
        }
        push({
          title:'Построй '+op.resultPoint+' '+relationText,
          action:relationAction,
          why:why,
          measure:['Величина смещения не задана условием – выбирается для читаемости чертежа.'],
          check:'Проверь совпадающую координату по соответствующей линии связи.'
        },[
          line(i,R.p1,R.p2,'construction-line'),
          point(i,R.p1,op.resultPoint+'₁','answer-dot'),
          point(i,R.p2,op.resultPoint+'₂','answer-dot')
        ].filter(Boolean),{kind:'line',a:R.p1,b:R.p2});
      }
    }

    i=steps.length;
    push({
      title:'Финальная проверка задания 4',
      action:'Проверь принадлежность h, f и ЛС плоскости и отдельное дополнительное условие выбранного варианта.',
      why:'Проверка выполняется по геометрическим инвариантам, а не по внешнему сходству с образцом.',
      measure:['h₂ ∥ x₁₂','f₁ ∥ x₁₂','ЛС₁ ⟂ h₁'],
      check:'Все одноимённые точки согласованы линиями связи.'
    },[]);

    const norm=normalizeSteps(steps,200,155);
    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps:steps,diagramPending:false};
  }


  function toSeg(seg){
    return [{x:seg[0][0],y:seg[0][1]},{x:seg[1][0],y:seg[1][1]}];
  }

  function lineIntersection2(a,b,c,d){
    const r=vec2(a,b), q=vec2(c,d);
    const den=r.x*q.y-r.y*q.x;
    if(Math.abs(den)<EPS) return null;
    const ca={x:c.x-a.x,y:c.y-a.y};
    const t=(ca.x*q.y-ca.y*q.x)/den;
    return {x:a.x+t*r.x,y:a.y+t*r.y};
  }

  function normalizedPointRec(rec){
    const x=(rec.p1[0]+rec.p2[0])/2;
    return {p1:[x,rec.p1[1]],p2:[x,rec.p2[1]]};
  }

  function abcLineRec(scheme,a,b){
    const A=normalizedPointRec(scheme.points[a]), B=normalizedPointRec(scheme.points[b]);
    return {p1:[A.p1,B.p1],p2:[A.p2,B.p2]};
  }

  function planeReferenceLines(scheme){
    if(scheme.planeType==='ABC'){
      return [
        {name:'AB',rec:abcLineRec(scheme,'A','B')},
        {name:'AC',rec:abcLineRec(scheme,'A','C')}
      ];
    }
    if(scheme.planeType==='line_point'){
      const lineName=scheme.planeLine || Object.keys(scheme.lines||{})[0];
      const pointName=scheme.planePoint || Object.keys(scheme.points||{})[0];
      const source=scheme.lines && scheme.lines[lineName];
      const pointRec=scheme.points && scheme.points[pointName];
      if(!source || !pointRec) return source?[{name:lineName,rec:source}]:[];
      const A=normalizedPointRec(pointRec);
      const xs=[source.p1[0][0],source.p1[1][0],source.p2[0][0],source.p2[1][0]];
      const x=xs.reduce((sum,v)=>sum+v,0)/xs.length;
      const T={p1:[x,lineY(source.p1,x)],p2:[x,lineY(source.p2,x)]};
      const g={p1:[A.p1,T.p1],p2:[A.p2,T.p2]};
      return [
        {name:lineName,rec:source},
        {name:'g',rec:g,auxiliary:true,anchor:T,throughPoint:A,throughName:pointName}
      ];
    }
    const names=scheme.planeLines || Object.keys(scheme.lines||{}).filter(n=>n!==scheme.givenLine).slice(0,2);
    return names.slice(0,2).map(name=>({name:name,rec:scheme.lines[name]}));
  }

  function lineXAtY(seg,y){
    const a={x:seg[0][0],y:seg[0][1]},b={x:seg[1][0],y:seg[1][1]};
    if(Math.abs(b.y-a.y)<EPS) return null;
    return a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y);
  }

  function chooseLevelCut(refs,proj){
    if(!refs || refs.length<2 || !refs[0].rec || !refs[1].rec) return null;
    const segs=refs.slice(0,2).map(ref=>ref.rec[proj]);
    const ys=segs.flat().map(p=>+p[1]).filter(Number.isFinite);
    if(ys.length<4) return null;
    const minY=Math.min(...ys),maxY=Math.max(...ys);
    if(maxY-minY<EPS) return null;
    let best=null;
    for(const t of [.30,.38,.46,.54,.62,.70]){
      const y=minY+(maxY-minY)*t;
      const x0=lineXAtY(segs[0],y),x1=lineXAtY(segs[1],y);
      if(!Number.isFinite(x0)||!Number.isFinite(x1)) continue;
      const separation=Math.abs(x1-x0);
      if(separation<6) continue;
      let outside=0;
      [x0,x1].forEach((x,k)=>{
        const xs=segs[k].map(p=>+p[0]);
        const lo=Math.min(...xs),hi=Math.max(...xs);
        if(x<lo) outside+=lo-x;
        if(x>hi) outside+=x-hi;
      });
      const score=separation-outside*.8;
      if(!best || score>best.score) best={y:y,xs:[x0,x1],score:score};
    }
    return best;
  }

  function sourceAnchoredLevelLine(refs,proj){
    const cut=chooseLevelCut(refs,proj);
    if(!cut) return null;
    const other=proj==='p2'?'p1':'p2';
    const primary=[
      {x:cut.xs[0],y:cut.y},
      {x:cut.xs[1],y:cut.y}
    ];
    const paired=primary.map((p,i)=>({x:p.x,y:lineY(refs[i].rec[other],p.x)}));
    const p3=primary.map((p,i)=>line3AtX(refs[i].rec,p.x));
    return {primary:primary,paired:paired,p3:p3,proj:proj,other:other};
  }

  function auxiliaryReferenceEntities(ref,step){
    if(!ref || !ref.auxiliary || !ref.rec) return [];
    const a1={x:ref.rec.p1[0][0],y:ref.rec.p1[0][1]},b1={x:ref.rec.p1[1][0],y:ref.rec.p1[1][1]};
    const a2={x:ref.rec.p2[0][0],y:ref.rec.p2[0][1]},b2={x:ref.rec.p2[1][0],y:ref.rec.p2[1][1]};
    const out=[
      line(step,a1,b1,'aux-line'),textEntity(step,b1,ref.name+'₁','svg-label'),
      line(step,a2,b2,'aux-line'),textEntity(step,b2,ref.name+'₂','svg-label')
    ];
    if(ref.anchor){
      const t1={x:ref.anchor.p1[0],y:ref.anchor.p1[1]},t2={x:ref.anchor.p2[0],y:ref.anchor.p2[1]};
      out.push(line(step,t2,t1,'construction-line'));
      out.push(point(step,t1,'T₁','construction-dot'),point(step,t2,'T₂','construction-dot'));
    }
    return out;
  }

  function appendABCPlaneEntities(out,scheme,step){
    if(scheme.planeType!=='ABC') return;
    const A=normalizedPointRec(scheme.points.A),B=normalizedPointRec(scheme.points.B),C=normalizedPointRec(scheme.points.C);
    [['A','B',A,B],['B','C',B,C],['C','A',C,A]].forEach(row=>{
      out.push(line(step,{x:row[2].p2[0],y:row[2].p2[1]},{x:row[3].p2[0],y:row[3].p2[1]},'object-line'));
      out.push(line(step,{x:row[2].p1[0],y:row[2].p1[1]},{x:row[3].p1[0],y:row[3].p1[1]},'object-line'));
    });
  }

  function planeYAt(plane,x,z){
    if(Math.abs(plane.n.y)<EPS) return null;
    return -(plane.n.x*x+plane.n.z*z+plane.d)/plane.n.y;
  }

  function line3AtX(rec,x){
    return {x:x,y:lineY(rec.p1,x),z:-lineY(rec.p2,x)};
  }

  function segmentVisibility(rec,plane,proj,K){
    const seg=toSeg(rec[proj]);
    const endA=seg[0],endB=seg[1];
    const k={x:K.x,y:proj==='p1'?lineY(rec.p1,K.x):lineY(rec.p2,K.x)};
    const mids=[lerp2(endA,k,.5),lerp2(k,endB,.5)];
    return mids.map(m=>{
      const P=line3AtX(rec,m.x);
      if(proj==='p1'){
        const zp=planeZAt(plane,P.x,P.y);
        if(zp===null) return true;
        return P.z>=zp;
      }
      const yp=planeYAt(plane,P.x,P.z);
      if(yp===null) return true;
      return P.y>=yp;
    });
  }

  function task5VisibilityWitness(refs,lrec,proj,K){
    const other=proj==='p1'?'p2':'p1';
    const lPrimary=toSeg(lrec[proj]);
    const dir=vec2(lPrimary[0],lPrimary[1]);
    const den=dir.x*dir.x+dir.y*dir.y;
    if(den<EPS)return null;
    const param=P=>((P.x-lPrimary[0].x)*dir.x+(P.y-lPrimary[0].y)*dir.y)/den;
    const kParam=param(K);
    let best=null;
    for(const ref of refs){
      if(!ref?.rec?.[proj]||!ref?.rec?.[other])continue;
      const rPrimary=toSeg(ref.rec[proj]);
      const X=lineIntersection2(lPrimary[0],lPrimary[1],rPrimary[0],rPrimary[1]);
      if(!X)continue;
      const lineOther={x:X.x,y:lineY(lrec[other],X.x)};
      const planeOther={x:X.x,y:lineY(ref.rec[other],X.x)};
      if(!Number.isFinite(lineOther.y)||!Number.isFinite(planeOther.y))continue;
      if(dist2(lineOther,planeOther)<4)continue;
      const t=param(X);
      // A competing pair only has to be distinct from K. Some photographed
      // variants place the most convenient source-line crossing close to K,
      // but it is still a valid visibility witness.
      if(dist2(X,K)<3)continue;
      const side=t<kParam?0:1;
      const lineVisible=proj==='p1'
        ? lineOther.y<planeOther.y
        : lineOther.y>planeOther.y;
      const score=
        segmentOutsideScore(lrec[proj],X)+
        segmentOutsideScore(ref.rec[proj],X)+
        segmentOutsideScore(lrec[other],lineOther)+
        segmentOutsideScore(ref.rec[other],planeOther)+
        Math.abs(t-kParam)*.02;
      if(!best||score<best.score){
        best={proj,other,X,lineOther,planeOther,ref,side,lineVisible,score};
      }
    }
    return best;
  }

  function segmentOutsideScore(seg,P){
    if(!seg||!P)return 0;
    const s=toSeg(seg),a=s[0],b=s[1];
    const d=vec2(a,b),dd=d.x*d.x+d.y*d.y;
    if(dd<EPS)return 0;
    const ap=vec2(a,P);
    const t=(ap.x*d.x+ap.y*d.y)/dd;
    return t<0?-t:(t>1?t-1:0);
  }

  function task5AuxCandidate(refs,lrec,primary){
    const other=primary==='p1'?'p2':'p1';
    const lp=toSeg(lrec[primary]);
    const rA=toSeg(refs[0].rec[primary]);
    const rB=toSeg(refs[1].rec[primary]);
    const I1=lineIntersection2(lp[0],lp[1],rA[0],rA[1]);
    const I2=lineIntersection2(lp[0],lp[1],rB[0],rB[1]);
    if(!I1||!I2)return null;

    const J1={x:I1.x,y:lineY(refs[0].rec[other],I1.x)};
    const J2={x:I2.x,y:lineY(refs[1].rec[other],I2.x)};
    if(!Number.isFinite(J1.y)||!Number.isFinite(J2.y))return null;

    const lOther=toSeg(lrec[other]);
    const KOther=lineIntersection2(lOther[0],lOther[1],J1,J2);
    if(!KOther)return null;
    const KPrimary={x:KOther.x,y:lineY(lrec[primary],KOther.x)};
    if(!Number.isFinite(KPrimary.y))return null;

    let score=0;
    score+=segmentOutsideScore(lrec[primary],I1)+segmentOutsideScore(lrec[primary],I2);
    score+=segmentOutsideScore(refs[0].rec[primary],I1)+segmentOutsideScore(refs[1].rec[primary],I2);
    score+=segmentOutsideScore(refs[0].rec[other],J1)+segmentOutsideScore(refs[1].rec[other],J2);
    score+=segmentOutsideScore(lrec[other],KOther)+segmentOutsideScore([[J1.x,J1.y],[J2.x,J2.y]],KOther);

    return {primary,other,I1,I2,J1,J2,KPrimary,KOther,score};
  }

  function solveTask5Scheme(scheme,stored){
    let plane;
    try { plane=planeFromScheme(scheme); }
    catch(err){ return {error:err.message}; }
    const lrec=scheme.lines[scheme.givenLine||'l'];
    if(!lrec) return {error:'В оцифрованной схеме не найдена прямая ℓ.'};
    const refs=planeReferenceLines(scheme);
    if(refs.length<2) return {error:'Для плоскости не хватает двух опорных линий.'};

    const candidates=[
      task5AuxCandidate(refs,lrec,'p1'),
      task5AuxCandidate(refs,lrec,'p2')
    ].filter(Boolean).sort((a,b)=>a.score-b.score);
    if(!candidates.length){
      return {error:'Обе вспомогательные проецирующие плоскости дают вырожденное построение. Проверь исходную схему.'};
    }
    const cut=candidates[0];
    const primary=cut.primary,other=cut.other;
    const pIdx=primary==='p1'?'₁':'₂',oIdx=other==='p1'?'₁':'₂';
    const pPlane=primary==='p1'?'Π₁':'Π₂',oPlane=other==='p1'?'Π₁':'Π₂';
    const planeKind=primary==='p1'?'горизонтально-проецирующую':'фронтально-проецирующую';
    const lPrimary=toSeg(lrec[primary]),lOther=toSeg(lrec[other]);
    const I1=cut.I1,I2=cut.I2,J1=cut.J1,J2=cut.J2;
    const K1=primary==='p1'?cut.KPrimary:cut.KOther;
    const K2=primary==='p2'?cut.KPrimary:cut.KOther;
    const KPrimary=primary==='p1'?K1:K2;
    const KOther=other==='p1'?K1:K2;

    const steps=[],push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));
    let i=0;
    const starter=starterEntitiesFromScheme(scheme,i);
    push({
      title:'Перенеси исходные проекции плоскости и прямой ℓ',
      action:'Воспроизведи заданные линии без изменения наклонов. Для плоскости через три точки дополнительно соедини A–B–C.',
      why:'В задаче №5 геометрия задаётся самим рисунком. Все последующие точки строятся относительно этих исходных проекций.',
      measure:['Сохраняй пары индексов 1 и 2.','Тонкие вертикали – линии проекционной связи.'],
      check:'ℓ₁/ℓ₂ и плоскость совпадают по форме с исходным вариантом.'
    },starter);

    diagramReferenceAxisStep(push,steps,scheme);

    i=steps.length;
    push({
      title:'Заключи ℓ во вспомогательную проецирующую плоскость Ω',
      action:'Возьми '+planeKind+' плоскость Ω так, чтобы её вырожденная проекция Ω'+pIdx+' совпала с ℓ'+pIdx+'.',
      why:'Из двух стандартных вариантов выбрана та проекция, где вспомогательное построение требует меньших продолжений исходных прямых. Плоскость Ω содержит ℓ, поэтому её пересечение с Σ обязательно проходит через искомую K.',
      measure:['Ω'+pIdx+' ≡ ℓ'+pIdx],
      check:'Прямая ℓ полностью принадлежит Ω.'
    },[
      line(i,lPrimary[0],lPrimary[1],'aux-line'),
      textEntity(i,lerp2(lPrimary[0],lPrimary[1],.18),'Ω'+pIdx+'≡ℓ'+pIdx,'svg-label')
    ],{kind:'line',a:lPrimary[0],b:lPrimary[1]});

    i=steps.length;
    push({
      title:'Найди 1'+pIdx+' и 2'+pIdx+' – точки сечения Ω с плоскостью Σ',
      action:'Продли Ω'+pIdx+'=ℓ'+pIdx+' до пересечения с двумя опорными линиями плоскости: '+refs[0].name+pIdx+' и '+refs[1].name+pIdx+'.',
      why:'Каждая такая точка одновременно принадлежит Ω и Σ. Если точка лежит за концом исходного штриха, сайт показывает тонкое продолжение прямой до неё.',
      measure:['1'+pIdx+' = Ω'+pIdx+' ∩ '+refs[0].name+pIdx,'2'+pIdx+' = Ω'+pIdx+' ∩ '+refs[1].name+pIdx],
      check:'Обе точки лежат на продолжении ℓ'+pIdx+'/Ω'+pIdx+'.'
    },[
      ...segmentExtensionEntities(i,lrec[primary],I1),
      ...segmentExtensionEntities(i,lrec[primary],I2),
      ...segmentExtensionEntities(i,refs[0].rec[primary],I1),
      ...segmentExtensionEntities(i,refs[1].rec[primary],I2),
      point(i,I1,'1'+pIdx,'construction-dot'),
      point(i,I2,'2'+pIdx,'construction-dot')
    ]);

    i=steps.length;
    push({
      title:'Перенеси 1'+pIdx+' и 2'+pIdx+' на '+oPlane,
      action:'Из 1'+pIdx+' и 2'+pIdx+' проведи линии связи. На соответствующих проекциях '+refs[0].name+oIdx+' и '+refs[1].name+oIdx+' получи 1'+oIdx+' и 2'+oIdx+'.',
      why:'Точка на пространственной опорной линии должна одновременно принадлежать обеим её одноимённым проекциям.',
      measure:['1'+pIdx+'↔1'+oIdx+' – одна линия связи','2'+pIdx+'↔2'+oIdx+' – одна линия связи'],
      check:'1'+oIdx+' и 2'+oIdx+' лежат на соответствующих опорных линиях.'
    },[
      ...segmentExtensionEntities(i,refs[0].rec[other],J1),
      ...segmentExtensionEntities(i,refs[1].rec[other],J2),
      line(i,I1,J1,'construction-line'),point(i,J1,'1'+oIdx,'construction-dot'),
      line(i,I2,J2,'construction-line'),point(i,J2,'2'+oIdx,'construction-dot')
    ],{kind:'line',a:I1,b:J1});

    i=steps.length;
    push({
      title:'Построй m'+oIdx+' = 1'+oIdx+'2'+oIdx+' и найди K'+oIdx,
      action:'Соедини 1'+oIdx+' и 2'+oIdx+'. В точке пересечения m'+oIdx+' с ℓ'+oIdx+' поставь K'+oIdx+'.',
      why:'m = Ω ∩ Σ. Поскольку ℓ лежит в Ω, пересечение ℓ с m и есть ℓ ∩ Σ.',
      measure:['m'+oIdx+' = 1'+oIdx+'2'+oIdx,'K'+oIdx+' = m'+oIdx+' ∩ ℓ'+oIdx],
      check:'K'+oIdx+' одновременно лежит на m'+oIdx+' и ℓ'+oIdx+'.'
    },[
      ...segmentExtensionEntities(i,[[J1.x,J1.y],[J2.x,J2.y]],KOther),
      ...segmentExtensionEntities(i,lrec[other],KOther),
      line(i,J1,J2,'aux-line'),textEntity(i,lerp2(J1,J2,.7),'m'+oIdx,'svg-label'),
      point(i,KOther,'K'+oIdx,'answer-dot')
    ],{kind:'line',a:J1,b:J2});

    i=steps.length;
    push({
      title:'Перенеси K'+oIdx+' в K'+pIdx,
      action:'Через K'+oIdx+' проведи линию проекционной связи до ℓ'+pIdx+'. Полученная точка – K'+pIdx+'.',
      why:'K₁ и K₂ – две проекции одной пространственной точки пересечения K.',
      measure:['K₁K₂ – линия связи'],
      check:'K'+pIdx+' лежит на ℓ'+pIdx+'.'
    },[
      line(i,KOther,KPrimary,'construction-line'),point(i,KPrimary,'K'+pIdx,'answer-dot')
    ],{kind:'line',a:KOther,b:KPrimary});

    const l1=toSeg(lrec.p1),l2=toSeg(lrec.p2);
    const vis1=segmentVisibility(lrec,plane,'p1',K1);
    const vis2=segmentVisibility(lrec,plane,'p2',K2);
    const witness1=task5VisibilityWitness(refs,lrec,'p1',K1);
    const witness2=task5VisibilityWitness(refs,lrec,'p2',K2);

    if(witness1){
      i=steps.length;
      const relation=witness1.lineVisible
        ? 'точка 3 линии ℓ выше конкурирующей точки 4 плоскости'
        : 'точка 4 плоскости выше конкурирующей точки 3 линии ℓ';
      push({
        title:'Видимость на Π₁: построй конкурирующие точки 3 и 4',
        action:'На Π₁ возьми пересечение ℓ₁ с '+witness1.ref.name+'₁. В этой проекции 3₁ и 4₁ совпадают. По одной линии связи найди 3₂ на ℓ₂ и 4₂ на '+witness1.ref.name+'₂.',
        why:'Для вида сверху сравниваются высоты z двух разных пространственных точек с одной горизонтальной проекцией. Здесь '+relation+', поэтому именно этот объект виден на соответствующей стороне от K.',
        measure:['3₁ ≡ 4₁','3₂ ∈ ℓ₂','4₂ ∈ '+witness1.ref.name+'₂'],
        check:'3₁/4₁ совпадают, а 3₂ и 4₂ находятся на одной линии связи и на своих исходных прямых.'
      },[
        ...segmentExtensionEntities(i,lrec.p1,witness1.X),
        ...segmentExtensionEntities(i,witness1.ref.rec.p1,witness1.X),
        ...segmentExtensionEntities(i,lrec.p2,witness1.lineOther),
        ...segmentExtensionEntities(i,witness1.ref.rec.p2,witness1.planeOther),
        point(i,witness1.X,'3₁≡4₁','construction-dot'),
        line(i,witness1.X,witness1.lineOther,'construction-line'),
        line(i,witness1.X,witness1.planeOther,'construction-line'),
        point(i,witness1.lineOther,'3₂','construction-dot'),
        point(i,witness1.planeOther,'4₂','construction-dot')
      ]);
    }

    if(witness2){
      i=steps.length;
      const relation=witness2.lineVisible
        ? 'точка 5 линии ℓ находится ближе к наблюдателю, чем точка 6 плоскости'
        : 'точка 6 плоскости находится ближе к наблюдателю, чем точка 5 линии ℓ';
      push({
        title:'Видимость на Π₂: построй конкурирующие точки 5 и 6',
        action:'На Π₂ возьми пересечение ℓ₂ с '+witness2.ref.name+'₂. Здесь 5₂ и 6₂ совпадают. По линии связи найди 5₁ на ℓ₁ и 6₁ на '+witness2.ref.name+'₁.',
        why:'Для фронтальной проекции сравнивается удаление y от Π₂. Здесь '+relation+', что определяет видимость участка ℓ₂ по эту сторону от K.',
        measure:['5₂ ≡ 6₂','5₁ ∈ ℓ₁','6₁ ∈ '+witness2.ref.name+'₁'],
        check:'5₂/6₂ совпадают, а 5₁ и 6₁ лежат на одной линии связи и на своих исходных прямых.'
      },[
        ...segmentExtensionEntities(i,lrec.p2,witness2.X),
        ...segmentExtensionEntities(i,witness2.ref.rec.p2,witness2.X),
        ...segmentExtensionEntities(i,lrec.p1,witness2.lineOther),
        ...segmentExtensionEntities(i,witness2.ref.rec.p1,witness2.planeOther),
        point(i,witness2.X,'5₂≡6₂','construction-dot'),
        line(i,witness2.X,witness2.lineOther,'construction-line'),
        line(i,witness2.X,witness2.planeOther,'construction-line'),
        point(i,witness2.lineOther,'5₁','construction-dot'),
        point(i,witness2.planeOther,'6₁','construction-dot')
      ]);
    }

    i=steps.length;
    const p1a=l1[0],p1b=l1[1],p2a=l2[0],p2b=l2[1];
    push({
      title:'Нанеси видимость ℓ по результату конкурирующих точек',
      action:'Используй сравнение 3/4 для Π₁ и 5/6 для Π₂. После точки пересечения K взаимное положение линии и плоскости меняется, поэтому на противоположной стороне K видимость меняется.',
      why:'Сплошным остаётся участок ℓ, точка которого ближе к наблюдателю, чем конкурирующая точка плоскости. Штриховым показывается участок, закрытый плоскостью.',
      measure:['Π₁: сравнение z через 3₂/4₂','Π₂: сравнение y через 5₁/6₁'],
      check:'Граница смены видимости совпадает с K; никакой участок не помечается видимым без построенных конкурирующих точек.'
    },[
      line(i,p1a,K1,vis1[0]?'answer-line':'hidden-line'),
      line(i,K1,p1b,vis1[1]?'answer-line':'hidden-line'),
      line(i,p2a,K2,vis2[0]?'answer-line':'hidden-line'),
      line(i,K2,p2b,vis2[1]?'answer-line':'hidden-line'),
      point(i,K1,'K₁','answer-dot'),point(i,K2,'K₂','answer-dot')
    ]);

    const norm=normalizeSteps(steps,200,165);
    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps:steps,diagramPending:false};
  }

  function planeFromDef(def){
    if(def.type==='ABC'){
      const pseudo={planeType:'ABC',points:def.points};
      return planeFromScheme(pseudo);
    }
    if(def.type==='parallel_lines' || def.type==='intersecting_lines'){
      const names=Object.keys(def.lines);
      const pseudo={planeType:def.type,planeLines:names.slice(0,2),lines:def.lines};
      return planeFromScheme(pseudo);
    }
    if(def.type==='line_point'){
      const lineName=def.lineName||Object.keys(def.lines||{})[0];
      const pointName=def.pointName||Object.keys(def.points||{})[0];
      return planeFromScheme({
        planeType:'line_point',
        planeLine:lineName,
        planePoint:pointName,
        lines:def.lines,
        points:def.points
      });
    }
    if(def.type==='frontal_projecting' || def.type==='horizontal_projecting'){
      const seg=toSeg(def.line);
      const a=seg[0],b=seg[1];
      const A=a.y-b.y, B=b.x-a.x, C=a.x*b.y-b.x*a.y;
      if(def.type==='frontal_projecting'){
        return {n:{x:A,y:0,z:-B},d:C,P:null};
      }
      return {n:{x:A,y:B,z:0},d:C,P:null};
    }
    throw new Error('Неизвестный тип плоскости '+def.type);
  }

  function starterPlaneDefEntities(def,step,prefix){
    const out=[],pre=prefix||'';
    if(def.type==='ABC'){
      const pseudo={planeType:'ABC',points:def.points};
      Object.entries(def.points).forEach(([name,P])=>{
        const q=normalizedPointRec(P);
        const p2={x:+q.p2[0],y:+q.p2[1]},p1={x:+q.p1[0],y:+q.p1[1]};
        out.push(line(step,p2,p1,'source-guide-line'));
        out.push(point(step,p2,name+'₂'));
        out.push(point(step,p1,name+'₁'));
      });
      appendABCPlaneEntities(out,pseudo,step);
    } else if(def.type==='line_point'){
      Object.entries(def.lines||{}).forEach(([name,L])=>{
        out.push(line(step,{x:L.p2[0][0],y:L.p2[0][1]},{x:L.p2[1][0],y:L.p2[1][1]},'object-line'));
        out.push(textEntity(step,sourceLineLabelPoint(def,name,'p2',L),sourceLineDisplayName(name)+'₂','svg-label'));
        out.push(line(step,{x:L.p1[0][0],y:L.p1[0][1]},{x:L.p1[1][0],y:L.p1[1][1]},'object-line'));
        out.push(textEntity(step,sourceLineLabelPoint(def,name,'p1',L),sourceLineDisplayName(name)+'₁','svg-label'));
      });
      Object.entries(def.points||{}).forEach(([name,P])=>{
        const q=normalizedPointRec(P);
        const p2={x:+q.p2[0],y:+q.p2[1]},p1={x:+q.p1[0],y:+q.p1[1]};
        out.push(line(step,p2,p1,'source-guide-line'));
        out.push(point(step,p2,name+'₂'));
        out.push(point(step,p1,name+'₁'));
      });
    } else if(def.lines){
      Object.entries(def.lines).forEach(([name,L])=>{
        out.push(line(step,{x:L.p2[0][0],y:L.p2[0][1]},{x:L.p2[1][0],y:L.p2[1][1]},'object-line'));
        out.push(textEntity(step,sourceLineLabelPoint(def,name,'p2',L),sourceLineDisplayName(name)+'₂','svg-label'));
        out.push(line(step,{x:L.p1[0][0],y:L.p1[0][1]},{x:L.p1[1][0],y:L.p1[1][1]},'object-line'));
        out.push(textEntity(step,sourceLineLabelPoint(def,name,'p1',L),sourceLineDisplayName(name)+'₁','svg-label'));
      });
      if(def.junctions&&def.junctions.length){
        // Preserve only projectors that are explicitly present in the traced
        // source. A mathematically implied projector is construction data, not
        // automatically part of the original printed drawing.
        appendSourceJunctions(out,def.junctions,step);
      }
    } else if(def.line){
      const seg=toSeg(def.line);
      const idx=def.type==='frontal_projecting'?'₂':'₁';
      out.push(line(step,seg[0],seg[1],'object-line'));
      out.push(textEntity(step,{x:seg[1].x+4,y:seg[1].y-2},(def.name||pre||'Π')+idx,'svg-label'));
    }
    return out;
  }


  function planeDefReferenceLines(def){
    if(!def) return [];
    if(def.type==='ABC'){
      const p=def.points||{};
      const pairs=[['A','B'],['B','C'],['C','A']];
      return pairs.filter(([a,b])=>p[a]&&p[b]).map(([a,b])=>{
        const A=normalizedPointRec(p[a]),B=normalizedPointRec(p[b]);
        return {name:a+b,rec:{p1:[A.p1,B.p1],p2:[A.p2,B.p2]}};
      });
    }
    if(def.type==='line_point'){
      const lineName=def.lineName||Object.keys(def.lines||{})[0];
      const pointName=def.pointName||Object.keys(def.points||{})[0];
      const L=def.lines?.[lineName],P=def.points?.[pointName];
      if(!L) return [];
      if(!P) return [{name:lineName,rec:L}];
      const A=normalizedPointRec(P);
      const xs=[L.p1[0][0],L.p1[1][0],L.p2[0][0],L.p2[1][0]];
      const x=xs.reduce((s,v)=>s+v,0)/xs.length;
      const T={p1:[x,lineY(L.p1,x)],p2:[x,lineY(L.p2,x)]};
      return [
        {name:lineName,rec:L},
        {name:pointName+'T',rec:{p1:[A.p1,T.p1],p2:[A.p2,T.p2]},generated:true}
      ];
    }
    if(def.lines) return Object.entries(def.lines).map(([name,rec])=>({name,rec}));
    return [];
  }

  function task6SourceBounds(scheme){
    const xs=[],p1y=[],p2y=[];
    const addPair=(p,proj)=>{
      if(!p||p.length<2)return;
      xs.push(+p[0]);
      (proj==='p1'?p1y:p2y).push(+p[1]);
    };
    const addDef=def=>{
      if(!def)return;
      Object.values(def.lines||{}).forEach(L=>{
        (L.p1||[]).forEach(p=>addPair(p,'p1'));
        (L.p2||[]).forEach(p=>addPair(p,'p2'));
      });
      Object.values(def.points||{}).forEach(P=>{
        if(P.p1)addPair(P.p1,'p1');
        if(P.p2)addPair(P.p2,'p2');
      });
      if(def.line){
        const proj=def.type==='frontal_projecting'?'p2':'p1';
        def.line.forEach(p=>addPair(p,proj));
      }
    };
    addDef(scheme.planeA);addDef(scheme.planeB);
    const K=scheme.pointK||scheme.pointThrough;
    if(K){if(K.p1)addPair(K.p1,'p1');if(K.p2)addPair(K.p2,'p2');}
    const range=(a,lo,hi)=>{
      if(!a.length)return [lo,hi];
      return [Math.min(...a),Math.max(...a)];
    };
    const [minX,maxX]=range(xs,20,220);
    const [minY1,maxY1]=range(p1y,90,220);
    const [minY2,maxY2]=range(p2y,20,100);
    return {minX,maxX,minY1,maxY1,minY2,maxY2};
  }

  function lineLevelIntersection(seg,level){
    const a={x:+seg[0][0],y:+seg[0][1]},b={x:+seg[1][0],y:+seg[1][1]};
    const dy=b.y-a.y;
    if(Math.abs(dy)<EPS)return null;
    const t=(level-a.y)/dy;
    return {x:a.x+(b.x-a.x)*t,y:level,t};
  }

  function outsideAmount(v,lo,hi){
    if(v<lo)return lo-v;
    if(v>hi)return v-hi;
    return 0;
  }

  function regularPlaneSection(def,levelType,level,bounds){
    const refs=planeDefReferenceLines(def);
    if(refs.length<2)return null;
    const primary=levelType==='horizontal'?'p2':'p1';
    const other=primary==='p2'?'p1':'p2';
    let best=null;
    for(let a=0;a<refs.length;a++)for(let b=a+1;b<refs.length;b++){
      const ra=refs[a].rec,rb=refs[b].rec;
      if(!ra?.[primary]||!rb?.[primary]||!ra?.[other]||!rb?.[other])continue;
      const ia=lineLevelIntersection(ra[primary],level);
      const ib=lineLevelIntersection(rb[primary],level);
      if(!ia||!ib||Math.abs(ia.x-ib.x)<5)continue;
      const oa={x:ia.x,y:lineY(ra[other],ia.x)};
      const ob={x:ib.x,y:lineY(rb[other],ib.x)};
      if(!Number.isFinite(oa.y)||!Number.isFinite(ob.y))continue;
      const pa={x:ia.x,y:level},pb={x:ib.x,y:level};
      const p1=primary==='p1'?[pa,pb]:[oa,ob];
      const p2=primary==='p2'?[pa,pb]:[oa,ob];
      const ext=Math.max(0,-ia.t)+Math.max(0,ia.t-1)+Math.max(0,-ib.t)+Math.max(0,ib.t-1);
      const otherLo=other==='p1'?bounds.minY1:bounds.minY2;
      const otherHi=other==='p1'?bounds.maxY1:bounds.maxY2;
      const spreadPenalty=outsideAmount(oa.y,otherLo-50,otherHi+50)+outsideAmount(ob.y,otherLo-50,otherHi+50);
      const score=ext*25+spreadPenalty*.25;
      if(!best||score<best.score)best={p1,p2,refs:[refs[a],refs[b]],score};
    }
    return best;
  }

  function planeSectionAtLevel(def,levelType,level,bounds){
    if(!def)return null;
    if(def.type!=='frontal_projecting'&&def.type!=='horizontal_projecting'){
      return regularPlaneSection(def,levelType,level,bounds);
    }
    const seg=def.line;
    if(!seg)return null;
    if(levelType==='horizontal'){
      if(def.type==='horizontal_projecting'){
        const p1=toSeg(seg);
        const p2=[{x:p1[0].x,y:level},{x:p1[1].x,y:level}];
        return {p1,p2,refs:[],score:0,projecting:true};
      }
      const hit=lineLevelIntersection(seg,level);
      if(!hit)return null;
      const p2=[{x:hit.x,y:level},{x:hit.x,y:level}];
      const p1=[{x:hit.x,y:bounds.minY1-25},{x:hit.x,y:bounds.maxY1+25}];
      return {p1,p2,refs:[],score:Math.max(0,-hit.t)+Math.max(0,hit.t-1),projecting:true,degenerate:'p2'};
    }
    if(def.type==='frontal_projecting'){
      const p2=toSeg(seg);
      const p1=[{x:p2[0].x,y:level},{x:p2[1].x,y:level}];
      return {p1,p2,refs:[],score:0,projecting:true};
    }
    const hit=lineLevelIntersection(seg,level);
    if(!hit)return null;
    const p1=[{x:hit.x,y:level},{x:hit.x,y:level}];
    const p2=[{x:hit.x,y:bounds.minY2-25},{x:hit.x,y:bounds.maxY2+25}];
    return {p1,p2,refs:[],score:Math.max(0,-hit.t)+Math.max(0,hit.t-1),projecting:true,degenerate:'p1'};
  }

  function sectionCommonPoint(secA,secB,levelType,level){
    if(!secA||!secB)return null;
    const use=levelType==='horizontal'?'p1':'p2';
    const A=secA[use],B=secB[use];
    const P=lineIntersection2(A[0],A[1],B[0],B[1]);
    if(!P)return null;
    if(levelType==='horizontal')return {p1:P,p2:{x:P.x,y:level}};
    return {p1:{x:P.x,y:level},p2:P};
  }

  function task6SectionCandidate(scheme,levelType,level,bounds){
    const a=planeSectionAtLevel(scheme.planeA,levelType,level,bounds);
    const b=planeSectionAtLevel(scheme.planeB,levelType,level,bounds);
    const P=sectionCommonPoint(a,b,levelType,level);
    if(!a||!b||!P)return null;
    const yLo=levelType==='horizontal'?bounds.minY1:bounds.minY2;
    const yHi=levelType==='horizontal'?bounds.maxY1:bounds.maxY2;
    const common=levelType==='horizontal'?P.p1:P.p2;
    const score=(a.score||0)+(b.score||0)
      +outsideAmount(common.x,bounds.minX-70,bounds.maxX+70)*.5
      +outsideAmount(common.y,yLo-70,yHi+70)*.5;
    return {levelType,level,a,b,P,score};
  }

  function sectionDrawEntities(step,sec,label,pointNames){
    const out=[];
    const named=Array.isArray(pointNames)&&pointNames.length===2&&sec?.refs?.length===2;
    const addProjection=(seg,idx)=>{
      if(!seg||!seg[0]||!seg[1])return;
      if(dist2(seg[0],seg[1])>.5){
        out.push(line(step,seg[0],seg[1],'aux-line'));
        if(named){
          out.push(point(step,seg[0],pointNames[0]+idx,'construction-dot'));
          out.push(point(step,seg[1],pointNames[1]+idx,'construction-dot'));
        }
        out.push(textEntity(step,seg[1],label+idx,'svg-note'));
      } else {
        out.push(point(step,seg[0],label+idx,'construction-dot'));
      }
    };
    addProjection(sec.p2,'₂');
    addProjection(sec.p1,'₁');
    if(sec.refs&&sec.refs.length===2){
      for(let i=0;i<2;i++){
        const p2=sec.p2[i],p1=sec.p1[i];
        if(sec.refs[i]?.rec?.p2) out.push(...segmentExtensionEntities(step,sec.refs[i].rec.p2,p2));
        if(sec.refs[i]?.rec?.p1) out.push(...segmentExtensionEntities(step,sec.refs[i].rec.p1,p1));
        out.push(line(step,p2,p1,'construction-line'));
      }
    }
    return out;
  }

  function solveTask6Graphical(scheme,stored){
    const throughRec=scheme.pointK||scheme.pointThrough;
    if(!throughRec)return null;
    const bounds=task6SourceBounds(scheme);
    const hasFrontal=[scheme.planeA,scheme.planeB].some(d=>d?.type==='frontal_projecting');
    const preferredLevelType=hasFrontal?'frontal':'horizontal';

    // A plane can be defined by a source line that is itself a horizontal or
    // frontal. In that case one family of level sections is parallel to the
    // defining line and cannot be recovered by two visible intersections.
    // Try the teacher-preferred family first, then the conjugate family before
    // falling back to the analytic solver.
    const choosePair=(levelType)=>{
      const lo=levelType==='horizontal'?bounds.minY2:bounds.minY1;
      const hi=levelType==='horizontal'?bounds.maxY2:bounds.maxY1;
      const span=Math.max(30,hi-lo);
      const candidates=[];
      for(const frac of [.18,.26,.34,.42,.50,.58,.66,.74,.82]){
        const level=lo+span*frac;
        const c=task6SectionCandidate(scheme,levelType,level,bounds);
        if(c)candidates.push(c);
      }
      candidates.sort((a,b)=>a.score-b.score);
      if(!candidates.length)return null;
      const first=candidates[0];
      let second=candidates.find(c=>
        Math.abs(c.level-first.level)>span*.22 &&
        dist2(c.P.p1,first.P.p1)>12 &&
        dist2(c.P.p2,first.P.p2)>12
      );
      if(!second)second=candidates.find(c=>Math.abs(c.level-first.level)>span*.15);
      if(!second)return null;
      return {levelType,pair:[first,second].sort((a,b)=>a.level-b.level)};
    };

    let picked=choosePair(preferredLevelType);
    if(!picked){
      const alternate=preferredLevelType==='horizontal'?'frontal':'horizontal';
      picked=choosePair(alternate);
    }
    if(!picked)return null;
    const levelType=picked.levelType;
    const pair=picked.pair;
    const P=pair[0].P,Q=pair[1].P;
    const r1=vec2(P.p1,Q.p1),r2=vec2(P.p2,Q.p2);
    if(norm2(r1)<EPS||norm2(r2)<EPS)return null;

    const throughNorm=normalizedPointRec(throughRec);
    const K1={x:+throughNorm.p1[0],y:+throughNorm.p1[1]};
    const K2={x:+throughNorm.p2[0],y:+throughNorm.p2[1]};
    const u1=unit2(r1),u2=unit2(r2),half=85;
    const k1a=add2(K1,mul2(u1,-half)),k1b=add2(K1,mul2(u1,half));
    const k2a=add2(K2,mul2(u2,-half)),k2b=add2(K2,mul2(u2,half));
    const throughLabel=scheme.pointLabel||'K';

    const steps=[],push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));
    const planeASymbol=scheme.planeA?.name||'Σ';
    const planeBSymbol=scheme.planeB?.name||'Θ';
    let i=0;
    const sourceScheme=scheme;
    const sourceThroughRec=sourceScheme.pointK||sourceScheme.pointThrough||throughRec;
    const sourceThroughNorm=normalizedPointRec(sourceThroughRec);
    const sourceK1={x:+sourceThroughNorm.p1[0],y:+sourceThroughNorm.p1[1]};
    const sourceK2={x:+sourceThroughNorm.p2[0],y:+sourceThroughNorm.p2[1]};
    push({
      title:'Перенеси обе плоскости и точку '+throughLabel,
      action:'Сначала воспроизведи только исходные линии, исходные линии связи и точку '+throughLabel+' с листа.',
      why:'Наклоны и взаимное положение напечатанной схемы являются исходными данными. Вспомогательные сечения появятся только на следующих шагах.',
      measure:['Исходные толстые линии не заменяй вспомогательными.','Исходные тонкие проекторы сохраняй тонкими.'],
      check:'На первом шаге нет ни P/Q, ни линии пересечения r, ни новой прямой через '+throughLabel+'.'
    },[
      ...starterPlaneDefEntities(sourceScheme.planeA,i,planeASymbol),
      ...starterPlaneDefEntities(sourceScheme.planeB,i,planeBSymbol),
      line(i,sourceK2,sourceK1,'source-guide-line'),
      point(i,sourceK2,throughLabel+'₂'),
      point(i,sourceK1,throughLabel+'₁')
    ]);

    diagramReferenceAxisStep(push,steps,scheme);

    // A plane defined by a point and a line has only one source line. Before
    // using two-line section constructions, explicitly create a second line
    // inside that plane. Otherwise later section points would appear to come
    // from an invisible helper.
    [
      {def:scheme.planeA,label:'первой плоскости'},
      {def:scheme.planeB,label:'второй плоскости'}
    ].forEach(item=>{
      if(item.def?.type!=='line_point') return;
      const refs=planeDefReferenceLines(item.def);
      const generated=refs.find(r=>r.generated);
      if(!generated?.rec) return;
      const pointName=item.def.pointName||Object.keys(item.def.points||{})[0]||'A';
      const lineName=item.def.lineName||Object.keys(item.def.lines||{})[0]||'a';
      const T1={x:+generated.rec.p1[1][0],y:+generated.rec.p1[1][1]};
      const T2={x:+generated.rec.p2[1][0],y:+generated.rec.p2[1][1]};
      const A1={x:+generated.rec.p1[0][0],y:+generated.rec.p1[0][1]};
      const A2={x:+generated.rec.p2[0][0],y:+generated.rec.p2[0][1]};
      i=steps.length;
      push({
        title:'Выбери T₁ на '+lineName+'₁',
        action:'На уже заданной проекции '+lineName+'₁ отметь удобную точку T₁.',
        why:'Для построения второй прямой плоскости сначала достаточно выбрать одну проекцию точки T на существующей прямой '+lineName+'. Вторая проекция пока не назначается произвольно.',
        measure:['T₁ ∈ '+lineName+'₁'],
        check:'На этом шаге есть только выбранная T₁; T₂ и '+pointName+'T ещё не построены.'
      },[
        point(i,T1,'T₁','construction-dot')
      ]);

      i=steps.length;
      push({
        title:'По линии связи получи T₂ на '+lineName+'₂',
        action:'Из T₁ проведи проектор до '+lineName+'₂. Точку пересечения обозначь T₂.',
        why:'T₁ и T₂ должны быть проекциями одной пространственной точки T, поэтому T₂ определяется линией связи и принадлежностью заданной прямой '+lineName+'.',
        measure:['T₁↔T₂ – одна линия связи','T₂ ∈ '+lineName+'₂'],
        check:'T₂ не выбирается отдельно: она стоит в пересечении проектора из T₁ с '+lineName+'₂.'
      },[
        line(i,T1,T2,'construction-line'),
        point(i,T2,'T₂','construction-dot')
      ]);

      i=steps.length;
      push({
        title:'Соедини '+pointName+' с T – получи вторую прямую плоскости',
        action:'Соедини '+pointName+'₁ с T₁ и '+pointName+'₂ с T₂.',
        why:'Две пространственные точки '+pointName+' и T задают прямую '+pointName+'T. Обе точки принадлежат исходной плоскости, поэтому вся '+pointName+'T также лежит в ней и может использоваться в следующих сечениях.',
        measure:[pointName+'T₁ = '+pointName+'₁T₁',pointName+'T₂ = '+pointName+'₂T₂'],
        check:'Обе проекции '+pointName+'T проходят через соответствующие проекции '+pointName+' и T.'
      },[
        line(i,A2,T2,'aux-line'),textEntity(i,T2,pointName+'T₂','svg-note'),
        line(i,A1,T1,'aux-line'),textEntity(i,T1,pointName+'T₁','svg-note')
      ]);
    });

    const addSectionForPlane=(sec,def,planeSymbol,pointNames,planeName)=>{
      const primary=levelType==='horizontal'?'p2':'p1';
      const other=primary==='p2'?'p1':'p2';
      const pIdx=primary==='p2'?'₂':'₁';
      const oIdx=other==='p2'?'₂':'₁';
      const pPlane=primary==='p2'?'Π₂':'Π₁';
      const oPlane=other==='p2'?'Π₂':'Π₁';
      const sectionSymbol=(levelType==='horizontal'?'h':'f')+planeSymbol;

      if(sec?.refs?.length===2){
        const primarySeg=sec[primary],otherSeg=sec[other];

        i=steps.length;
        push({
          title:'На '+planeName+pIdx+' получи '+pointNames[0]+pIdx+' и '+pointNames[1]+pIdx+' в '+planeSymbol,
          action:'Пересеки '+planeName+pIdx+' с двумя уже существующими опорными линиями плоскости '+planeSymbol+'. Первое пересечение обозначь '+pointNames[0]+pIdx+', второе – '+pointNames[1]+pIdx+'.',
          why:'Эти точки не выбираются произвольно: обе задаются пересечениями вспомогательной плоскости '+planeName+' с линиями, принадлежащими '+planeSymbol+'.',
          measure:[
            pointNames[0]+pIdx+' = '+planeName+pIdx+' ∩ '+sec.refs[0].name+pIdx,
            pointNames[1]+pIdx+' = '+planeName+pIdx+' ∩ '+sec.refs[1].name+pIdx
          ],
          check:'Обе новые точки лежат на '+planeName+pIdx+' и на соответствующих исходных линиях '+planeSymbol+'.'
        },[
          ...segmentExtensionEntities(i,sec.refs[0].rec[primary],primarySeg[0]),
          ...segmentExtensionEntities(i,sec.refs[1].rec[primary],primarySeg[1]),
          point(i,primarySeg[0],pointNames[0]+pIdx,'construction-dot'),
          point(i,primarySeg[1],pointNames[1]+pIdx,'construction-dot'),
          line(i,primarySeg[0],primarySeg[1],'aux-line'),
          textEntity(i,primarySeg[1],sectionSymbol+pIdx,'svg-note')
        ]);

        i=steps.length;
        push({
          title:'Перенеси '+pointNames[0]+pIdx+' и '+pointNames[1]+pIdx+' на '+oPlane,
          action:'Из '+pointNames[0]+pIdx+' и '+pointNames[1]+pIdx+' проведи линии связи до парных проекций тех же опорных линий '+planeSymbol+'. Получи '+pointNames[0]+oIdx+' и '+pointNames[1]+oIdx+', затем соедини их.',
          why:'Так строится вторая проекция линии сечения '+sectionSymbol+'. Ни одна парная точка не ставится без линии связи.',
          measure:[
            pointNames[0]+pIdx+'↔'+pointNames[0]+oIdx+' – одна линия связи',
            pointNames[1]+pIdx+'↔'+pointNames[1]+oIdx+' – одна линия связи'
          ],
          check:pointNames[0]+oIdx+' и '+pointNames[1]+oIdx+' лежат на тех же пространственных опорных линиях.'
        },[
          ...segmentExtensionEntities(i,sec.refs[0].rec[other],otherSeg[0]),
          ...segmentExtensionEntities(i,sec.refs[1].rec[other],otherSeg[1]),
          line(i,primarySeg[0],otherSeg[0],'construction-line'),
          line(i,primarySeg[1],otherSeg[1],'construction-line'),
          point(i,otherSeg[0],pointNames[0]+oIdx,'construction-dot'),
          point(i,otherSeg[1],pointNames[1]+oIdx,'construction-dot'),
          line(i,otherSeg[0],otherSeg[1],'aux-line'),
          textEntity(i,otherSeg[1],sectionSymbol+oIdx,'svg-note')
        ]);
        return;
      }

      i=steps.length;
      push({
        title:'Построй сечение '+planeName+' с проецирующей плоскостью '+planeSymbol,
        action:'Используй заданную вырожденную проекцию '+planeSymbol+' и уровень '+planeName+pIdx+'. Их пересечение или совпадающее направление сразу задаёт одну проекцию линии сечения; вторую дострой линиями связи.',
        why:'Для проецирующей плоскости отдельные опорные точки 1–8 не требуются: положение линии сечения определяется её заданной проецирующей проекцией.',
        measure:['Сечение принадлежит '+planeName,'Сечение принадлежит '+planeSymbol],
        check:'Обе проекции сечения согласованы одним и тем же положением относительно x₁₂.'
      },sectionDrawEntities(i,sec,sectionSymbol,null));
    };

    pair.forEach((c,index)=>{
      const name=index===0?'P':'Q';
      const planeName=index===0?'α':'β';
      const kind=levelType==='horizontal'?'горизонтальную':'фронтальную';
      const degenerateProj=levelType==='horizontal'?'₂':'₁';
      const primary=levelType==='horizontal'?'p2':'p1';
      const xs=[
        bounds.minX-18,bounds.maxX+18,c.P[primary].x,
        ...(c.a?.[primary]||[]).map(p=>p.x),
        ...(c.b?.[primary]||[]).map(p=>p.x)
      ].filter(Number.isFinite);
      const guideA={x:Math.min(...xs)-4,y:c.level};
      const guideB={x:Math.max(...xs)+4,y:c.level};

      i=steps.length;
      push({
        title:'Выбери вспомогательную плоскость '+planeName,
        action:'Проведи '+planeName+degenerateProj+' параллельно x₁₂ на удобном уровне. Это свободный выбор вспомогательной '+kind+' плоскости – уровень не берётся из готовой точки.',
        why:'Для поиска линии пересечения двух плоскостей можно взять любую вспомогательную плоскость выбранного семейства. Сначала явно задаётся её уровень, и только после этого строятся точки пересечения.',
        measure:[planeName+degenerateProj+' ∥ x₁₂'],
        check:'На этом шаге ещё нет точки '+name+' – задан только уровень вспомогательной плоскости.'
      },[
        line(i,guideA,guideB,'aux-line'),
        textEntity(i,guideB,planeName+degenerateProj,'svg-note')
      ],{kind:'line',a:guideA,b:guideB});

      addSectionForPlane(c.a,scheme.planeA,planeASymbol,index===0?['1','2']:['5','6'],planeName);
      addSectionForPlane(c.b,scheme.planeB,planeBSymbol,index===0?['3','4']:['7','8'],planeName);

      i=steps.length;
      push({
        title:'Пересеки линии сечения '+planeName+' и получи '+name,
        action:'На невырожденной проекции найди пересечение двух уже построенных линий сечения. Обозначь его '+name+(levelType==='horizontal'?'₁':'₂')+' и по линии связи перенеси на '+planeName+degenerateProj+', получив '+name+degenerateProj+'.',
        why:'Обе линии лежат в одной вспомогательной плоскости '+planeName+', но каждая одновременно принадлежит одной из исходных плоскостей. Поэтому их общая точка '+name+' принадлежит обеим исходным плоскостям.',
        measure:[name+' ∈ '+planeASymbol,name+' ∈ '+planeBSymbol],
        check:name+'₁ и '+name+'₂ появляются только после построения обеих линий сечения и находятся на одной линии связи.'
      },[
        line(i,c.P.p2,c.P.p1,'construction-line'),
        point(i,c.P.p2,name+'₂','construction-dot'),
        point(i,c.P.p1,name+'₁','construction-dot')
      ]);
    });

    i=steps.length;
    push({
      title:'Соедини P и Q – получи линию пересечения r',
      action:'Соедини P₁ с Q₁ и P₂ с Q₂.',
      why:'Две общие точки P и Q однозначно задают линию пересечения двух плоскостей.',
      measure:['r₁ = P₁Q₁','r₂ = P₂Q₂'],
      check:'Обе проекции r проходят через соответствующие проекции P и Q.'
    },[
      line(i,P.p1,Q.p1,'answer-line'),textEntity(i,Q.p1,'r₁','svg-label'),
      line(i,P.p2,Q.p2,'answer-line'),textEntity(i,Q.p2,'r₂','svg-label')
    ],{kind:'line',a:P.p1,b:Q.p1});

    i=steps.length;
    push({
      title:'Через '+throughLabel+' проведи ℓ ∥ обеим плоскостям',
      action:'Через '+throughLabel+'₁ проведи ℓ₁ ∥ r₁, через '+throughLabel+'₂ – ℓ₂ ∥ r₂.',
      why:'Направление линии пересечения принадлежит обеим плоскостям. Поэтому прямая через заданную точку, параллельная r, параллельна обеим плоскостям.',
      measure:['ℓ₁ ∥ r₁','ℓ₂ ∥ r₂'],
      check:'ℓ проходит через '+throughLabel+' и имеет направление r на обеих проекциях.'
    },[
      line(i,k1a,k1b,'answer-line'),textEntity(i,k1b,'ℓ₁','svg-label'),
      line(i,k2a,k2b,'answer-line'),textEntity(i,k2b,'ℓ₂','svg-label')
    ],{kind:'line',a:k1a,b:k1b});

    i=steps.length;
    push({
      title:'Финальная проверка задания 6',
      action:'Проверь P,Q как общие точки, затем параллельность ℓ и r на обеих проекциях.',
      why:'Так проверяется и линия пересечения плоскостей, и требуемое направление прямой через '+throughLabel+'.',
      measure:['P,Q ∈ обеим плоскостям','ℓ ∥ r'],
      check:'Вспомогательные сечения остаются тонкими, r и ℓ выделены как результат.'
    },[]);

    const norm=normalizeSteps(steps,210,170);
    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps,diagramPending:false,graphicalConstruction:true};
  }

  function intersectionPlanes(p1,p2){
    const d=cross3(p1.n,p2.n);
    const den=dot3(d,d);
    if(den<EPS) return null;
    const v=sub3(mul3(p1.n,p2.d),mul3(p2.n,p1.d));
    const P=mul3(cross3(v,d),1/den);
    return {P:P,d:d};
  }

  function commonPointAtZ(p1,p2,z){
    const A1=p1.n.x,B1=p1.n.y,C1=-(p1.d+p1.n.z*z);
    const A2=p2.n.x,B2=p2.n.y,C2=-(p2.d+p2.n.z*z);
    const den=A1*B2-A2*B1;
    if(Math.abs(den)<EPS) return null;
    const x=(C1*B2-C2*B1)/den;
    const y=(A1*C2-A2*C1)/den;
    return {x:x,y:y,z:z};
  }

  function commonPointAtY(p1,p2,y){
    const A1=p1.n.x,B1=p1.n.z,C1=-(p1.d+p1.n.y*y);
    const A2=p2.n.x,B2=p2.n.z,C2=-(p2.d+p2.n.y*y);
    const den=A1*B2-A2*B1;
    if(Math.abs(den)<EPS) return null;
    const x=(C1*B2-C2*B1)/den;
    const z=(A1*C2-A2*C1)/den;
    return {x:x,y:y,z:z};
  }

  function planeLineAtPoint(plane,P,levelType){
    let d;
    if(levelType==='horizontal') d=cross3(plane.n,{x:0,y:0,z:1});
    else d=cross3(plane.n,{x:0,y:1,z:0});
    if(norm3(d)<EPS) return null;
    return line3Extent(P,d,82);
  }

  function solveTask6Scheme(scheme,stored){
    const graphical=solveTask6Graphical(scheme,stored);
    if(graphical) return graphical;
    let A,B;
    try { A=planeFromDef(scheme.planeA); B=planeFromDef(scheme.planeB); }
    catch(err){ return {error:err.message}; }
    const inter=intersectionPlanes(A,B);
    if(!inter) return {error:'Заданные плоскости параллельны или оцифровка выродилась.'};

    const u=normalize3(inter.d);
    let P=add3(inter.P,mul3(u,-55)), Q=add3(inter.P,mul3(u,55));
    let levelType='horizontal';
    if(Math.abs(P.z-Q.z)<8){
      levelType='frontal';
      if(Math.abs(P.y-Q.y)<8){
        P=add3(inter.P,mul3(u,-85)); Q=add3(inter.P,mul3(u,85));
      }
    }

    if(levelType==='horizontal'){
      const p0=commonPointAtZ(A,B,P.z),q0=commonPointAtZ(A,B,Q.z);
      if(p0) P=p0;
      if(q0) Q=q0;
    } else {
      const p0=commonPointAtY(A,B,P.y),q0=commonPointAtY(A,B,Q.y);
      if(p0) P=p0;
      if(q0) Q=q0;
    }

    const pp=project3(P),qq=project3(Q);
    const throughRec=scheme.pointK||scheme.pointThrough;
    if(!throughRec) return {error:'В схеме задания 6 не указана исходная точка, через которую нужно провести прямую.'};
    const throughLabel=scheme.pointLabel||'K';
    const throughNorm=normalizedPointRec(throughRec);
    const K3=schemePoint3(throughNorm);
    const K=project3(K3);
    const throughK=line3Extent(K3,inter.d,90);
    const kA=project3(throughK[0]),kB=project3(throughK[1]);

    const steps=[],push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));
    const planeASymbol=scheme.planeA?.name||'Σ';
    const planeBSymbol=scheme.planeB?.name||'Θ';
    let i=0;
    const sourceScheme=scheme;
    const sourceThrough=sourceScheme.pointK||sourceScheme.pointThrough||throughRec;
    const sourceThroughNorm=normalizedPointRec(sourceThrough);
    const sourceP2={x:+sourceThroughNorm.p2[0],y:+sourceThroughNorm.p2[1]};
    const sourceP1={x:+sourceThroughNorm.p1[0],y:+sourceThroughNorm.p1[1]};
    const starter=[
      ...starterPlaneDefEntities(sourceScheme.planeA,i,planeASymbol),
      ...starterPlaneDefEntities(sourceScheme.planeB,i,planeBSymbol),
      line(i,sourceP2,sourceP1,'source-guide-line'),
      point(i,sourceP2,throughLabel+'₂'),
      point(i,sourceP1,throughLabel+'₁')
    ];
    push({
      title:'Перенеси обе плоскости и точку '+throughLabel,
      action:'Сначала воспроизведи исходные проекции двух плоскостей и заданную точку '+throughLabel+' без изменения наклонов.',
      why:'Положение линий на варианте является исходными данными. Решение строится уже поверх них.',
      measure:['Плоскость '+planeASymbol+' – первый набор','Плоскость '+planeBSymbol+' – второй набор',throughLabel+'₁/'+throughLabel+'₂ – одна линия связи'],
      check:'Стартовый рисунок совпадает с печатным условием.'
    },starter);

    diagramReferenceAxisStep(push,steps,scheme);

    const linePA=planeLineAtPoint(A,P,levelType), linePB=planeLineAtPoint(B,P,levelType);
    const lineQA=planeLineAtPoint(A,Q,levelType), lineQB=planeLineAtPoint(B,Q,levelType);
    if(!linePA||!linePB||!lineQA||!lineQB) return {error:'Не удалось подобрать удобные вспомогательные плоскости.'};
    const pA0=project3(linePA[0]),pA1=project3(linePA[1]);
    const pB0=project3(linePB[0]),pB1=project3(linePB[1]);
    const qA0=project3(lineQA[0]),qA1=project3(lineQA[1]);
    const qB0=project3(lineQB[0]),qB1=project3(lineQB[1]);

    if(levelType==='horizontal'){
      i=steps.length;
      push({
        title:'Первое вспомогательное горизонтальное сечение',
        action:'Проведи вспомогательную горизонтальную плоскость уровня через будущую точку P. Она пересекает '+planeASymbol+' и '+planeBSymbol+' по двум горизонталям.',
        why:'Две горизонтали лежат в одной вспомогательной плоскости. Их пересечение P принадлежит одновременно '+planeASymbol+' и '+planeBSymbol+'.',
        measure:['На Π₂ обе горизонтали имеют один уровень z.','На Π₁ строятся их действительные направления.'],
        check:'P₁ – пересечение горизонталей обеих плоскостей.'
      },[
        line(i,pA0.p2,pA1.p2,'construction-line'),textEntity(i,pA1.p2,'h'+planeASymbol+'₂','svg-note'),
        line(i,pB0.p2,pB1.p2,'construction-line'),textEntity(i,pB1.p2,'h'+planeBSymbol+'₂','svg-note'),
        line(i,pA0.p1,pA1.p1,'aux-line'),textEntity(i,pA1.p1,'h'+planeASymbol+'₁','svg-label'),
        line(i,pB0.p1,pB1.p1,'aux-line'),textEntity(i,pB1.p1,'h'+planeBSymbol+'₁','svg-label'),
        line(i,pA0.p2,pA0.p1,'construction-line'),line(i,pA1.p2,pA1.p1,'construction-line'),
        line(i,pB0.p2,pB0.p1,'construction-line'),line(i,pB1.p2,pB1.p1,'construction-line'),
        point(i,pp.p1,'P₁','construction-dot'),
        point(i,pp.p2,'P₂','construction-dot'),
        line(i,pp.p1,pp.p2,'construction-line')
      ]);

      i=steps.length;
      push({
        title:'Второе вспомогательное горизонтальное сечение',
        action:'На другом уровне повтори построение и получи вторую общую точку Q.',
        why:'Две различные общие точки однозначно задают линию пересечения плоскостей.',
        measure:['Q ∈ '+planeASymbol,'Q ∈ '+planeBSymbol],
        check:'Q₁/Q₂ находятся на одной линии связи.'
      },[
        line(i,qA0.p2,qA1.p2,'construction-line'),textEntity(i,qA1.p2,'h'+planeASymbol+'₂','svg-note'),
        line(i,qB0.p2,qB1.p2,'construction-line'),textEntity(i,qB1.p2,'h'+planeBSymbol+'₂','svg-note'),
        line(i,qA0.p1,qA1.p1,'aux-line'),textEntity(i,qA1.p1,'h'+planeASymbol+'₁','svg-label'),
        line(i,qB0.p1,qB1.p1,'aux-line'),textEntity(i,qB1.p1,'h'+planeBSymbol+'₁','svg-label'),
        line(i,qA0.p2,qA0.p1,'construction-line'),line(i,qA1.p2,qA1.p1,'construction-line'),
        line(i,qB0.p2,qB0.p1,'construction-line'),line(i,qB1.p2,qB1.p1,'construction-line'),
        point(i,qq.p1,'Q₁','construction-dot'),
        point(i,qq.p2,'Q₂','construction-dot'),
        line(i,qq.p1,qq.p2,'construction-line')
      ]);
    } else {
      i=steps.length;
      push({
        title:'Первое вспомогательное фронтальное сечение',
        action:'Проведи вспомогательную фронтальную плоскость через P. Она пересекает обе заданные плоскости по фронталям.',
        why:'Пересечение двух полученных фронталей даёт общую точку P.',
        measure:['На Π₁ фронтали имеют одинаковый уровень y.'],
        check:'P принадлежит обеим плоскостям.'
      },[
        line(i,pA0.p1,pA1.p1,'construction-line'),textEntity(i,pA1.p1,'f'+planeASymbol+'₁','svg-note'),
        line(i,pB0.p1,pB1.p1,'construction-line'),textEntity(i,pB1.p1,'f'+planeBSymbol+'₁','svg-note'),
        line(i,pA0.p2,pA1.p2,'aux-line'),textEntity(i,pA1.p2,'f'+planeASymbol+'₂','svg-label'),
        line(i,pB0.p2,pB1.p2,'aux-line'),textEntity(i,pB1.p2,'f'+planeBSymbol+'₂','svg-label'),
        line(i,pA0.p1,pA0.p2,'construction-line'),line(i,pA1.p1,pA1.p2,'construction-line'),
        line(i,pB0.p1,pB0.p2,'construction-line'),line(i,pB1.p1,pB1.p2,'construction-line'),
        point(i,pp.p1,'P₁','construction-dot'),point(i,pp.p2,'P₂','construction-dot'),
        line(i,pp.p1,pp.p2,'construction-line')
      ]);
      i=steps.length;
      push({
        title:'Второе вспомогательное фронтальное сечение',
        action:'Повтори на другом уровне y и получи Q.',
        why:'P и Q задают искомую линию пересечения.',
        measure:['Q ∈ '+planeASymbol+' и '+planeBSymbol],
        check:'Q₁/Q₂ согласованы линией связи.'
      },[
        line(i,qA0.p1,qA1.p1,'construction-line'),textEntity(i,qA1.p1,'f'+planeASymbol+'₁','svg-note'),
        line(i,qB0.p1,qB1.p1,'construction-line'),textEntity(i,qB1.p1,'f'+planeBSymbol+'₁','svg-note'),
        line(i,qA0.p2,qA1.p2,'aux-line'),textEntity(i,qA1.p2,'f'+planeASymbol+'₂','svg-label'),
        line(i,qB0.p2,qB1.p2,'aux-line'),textEntity(i,qB1.p2,'f'+planeBSymbol+'₂','svg-label'),
        line(i,qA0.p1,qA0.p2,'construction-line'),line(i,qA1.p1,qA1.p2,'construction-line'),
        line(i,qB0.p1,qB0.p2,'construction-line'),line(i,qB1.p1,qB1.p2,'construction-line'),
        point(i,qq.p1,'Q₁','construction-dot'),point(i,qq.p2,'Q₂','construction-dot'),
        line(i,qq.p1,qq.p2,'construction-line')
      ]);
    }

    i=steps.length;
    push({
      title:'Соедини P и Q – это линия пересечения r',
      action:'Проведи r₁ через P₁,Q₁ и r₂ через P₂,Q₂.',
      why:'Линия, проходящая через две общие точки плоскостей, целиком принадлежит обеим плоскостям.',
      measure:['r = '+planeASymbol+' ∩ '+planeBSymbol],
      check:'P и Q лежат на обеих проекциях r.'
    },[
      line(i,pp.p1,qq.p1,'answer-line'),textEntity(i,qq.p1,'r₁','svg-label'),
      line(i,pp.p2,qq.p2,'answer-line'),textEntity(i,qq.p2,'r₂','svg-label')
    ],{kind:'line',a:pp.p1,b:qq.p1});

    i=steps.length;
    push({
      title:'Через '+throughLabel+' проведи ℓ ∥ обеим плоскостям',
      action:'Через '+throughLabel+'₁ проведи ℓ₁ ∥ r₁, а через '+throughLabel+'₂ – ℓ₂ ∥ r₂.',
      why:'Общее направление двух непараллельных плоскостей – направление их линии пересечения r. Поэтому прямая, параллельная r, параллельна одновременно '+planeASymbol+' и '+planeBSymbol+'.',
      measure:['ℓ₁ ∥ r₁','ℓ₂ ∥ r₂'],
      check:'Направления ℓ и r совпадают на обеих проекциях.'
    },[
      line(i,kA.p1,kB.p1,'answer-line'),textEntity(i,kB.p1,'ℓ₁','svg-label'),
      line(i,kA.p2,kB.p2,'answer-line'),textEntity(i,kB.p2,'ℓ₂','svg-label')
    ],{kind:'line',a:kA.p1,b:kB.p1});

    i=steps.length;
    push({
      title:'Финальная проверка задания 6',
      action:'Проверь две общие точки линии r и попарную параллельность проекций ℓ и r.',
      why:'Это одновременно подтверждает линию пересечения и требуемое направление прямой через '+throughLabel+'.',
      measure:['P,Q ∈ '+planeASymbol+' и '+planeBSymbol,'ℓ ∥ r'],
      check:'ℓ проходит через '+throughLabel+' и не обязана лежать ни в одной из плоскостей.'
    },[]);

    const norm=normalizeSteps(steps,210,170);
    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps:steps,diagramPending:false};
  }

  function solveDiagramTask(task,stored){
    const schemeRoot=window.SITEMATH_SCHEMES||{};
    const variantSchemes=schemeRoot[state.variant]||{};
    const scheme=state.variant==='custom' ? state.customSchemes[task] : variantSchemes['task'+task];
    if(task===4 && scheme) return solveTask4Scheme(scheme,stored);
    if(task===5 && scheme) return solveTask5Scheme(scheme,stored);
    if(task===6 && scheme) return solveTask6Scheme(scheme,stored);

    const steps=[];
    const title = task===4 ? 'Для этого варианта схема №4 ещё не оцифрована' : task===5 ? 'Положение исходных линий задаётся рисунком' : 'Обе плоскости задаются графически';
    steps.push({
      title:title,
      action:'У этой задачи нет таблицы координат: наклоны и взаимное положение линий на напечатанном листе являются частью условия.',
      why:'Подставлять произвольную схему математически неверно. Поэтому отсутствующий исходный рисунок помечается как недостающий, а не генерируется по догадке.',
      measure:['Формулировка: '+((stored&&stored.statement)||DATA.tasks[task].short)],
      check:'После оцифровки исходная геометрия должна совпадать с листом варианта.',
      entities:[
        textEntity(0,{x:18,y:35},'Задание '+task,'svg-big-note'),
        textEntity(0,{x:18,y:48},'Нужна точная исходная схема варианта','svg-note')
      ]
    });
    return {width:190,height:120,O:{x:95,y:60},steps:steps,diagramPending:true};
  }

  function drawGrid(width,height){
    const defs=E('defs');
    const minor=E('pattern',{id:'minorGrid',width:GRID,height:GRID,patternUnits:'userSpaceOnUse'});
    minor.append(E('path',{d:'M '+GRID+' 0 L 0 0 0 '+GRID,class:'grid-minor',fill:'none'}));
    defs.append(minor);
    const major=E('pattern',{id:'majorGrid',width:GRID*5,height:GRID*5,patternUnits:'userSpaceOnUse'});
    major.append(E('rect',{width:GRID*5,height:GRID*5,fill:'url(#minorGrid)'}));
    major.append(E('path',{d:'M '+GRID*5+' 0 L 0 0 0 '+GRID*5,class:'grid-major',fill:'none'}));
    defs.append(major);
    const marker=E('marker',{id:'axisArrow',viewBox:'0 0 10 10',refX:'8',refY:'5',markerWidth:'4',markerHeight:'4',orient:'auto-start-reverse'});
    marker.append(E('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#37332e'}));
    defs.append(marker);
    svg.append(defs);
    svg.append(E('rect',{x:0,y:0,width,height,fill:'url(#majorGrid)'}));
  }

  function drawDimension(e,active){
    const v=vec2(e.a,e.b), len=norm2(v);
    if(len<EPS) return;
    const u=unit2(v), n=perp2(u), off=3.2;
    const a=add2(add2(e.a,mul2(n,off)),e.offset||{x:0,y:0});
    const b=add2(add2(e.b,mul2(n,off)),e.offset||{x:0,y:0});
    const cls='dimension'+(active?' active-line':'');
    const g=E('g',{'data-active':active?'1':'0'});
    g.append(E('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:cls}));
    g.append(E('line',{x1:a.x-n.x*1.4,y1:a.y-n.y*1.4,x2:a.x+n.x*1.4,y2:a.y+n.y*1.4,class:'dimension'}));
    g.append(E('line',{x1:b.x-n.x*1.4,y1:b.y-n.y*1.4,x2:b.x+n.x*1.4,y2:b.y+n.y*1.4,class:'dimension'}));
    g.append(E('text',{x:(a.x+b.x)/2+n.x*2,y:(a.y+b.y)/2+n.y*2,class:'dimension-text','text-anchor':'middle'},e.label));
    svg.append(g);
  }

  function drawArc(e,active){
    const x0=e.c.x+Math.cos(e.a0)*e.r, y0=e.c.y+Math.sin(e.a0)*e.r;
    const x1=e.c.x+Math.cos(e.a1)*e.r, y1=e.c.y+Math.sin(e.a1)*e.r;
    const large=Math.abs(e.a1-e.a0)>Math.PI?1:0;
    svg.append(E('path',{d:'M '+x0+' '+y0+' A '+e.r+' '+e.r+' 0 '+large+' 1 '+x1+' '+y1,class:'dimension'+(active?' active-line':'')}));
    if(e.label) svg.append(E('text',{x:e.c.x+e.r+2,y:e.c.y-2,class:'dimension-text'},e.label));
  }

  function drawEntity(e,active){
    if(e.type==='line'){
      const n=E('line',{
        x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y,
        class:'draw-line '+e.cls+(active?' active-line':''),
        'data-active':active?'1':'0',
        'data-role':e.role||lineRole(e.cls)
      });
      if(e.arrow) n.setAttribute('marker-end','url(#axisArrow)');
      svg.append(n);
    } else if(e.type==='point'){
      const n=E('circle',{cx:e.p.x,cy:e.p.y,r:e.cls.includes('answer')?1.05:.88,class:e.cls+(active?' active-dot':''),'data-active':active?'1':'0','data-label':e.label||'','data-role':e.role||pointRole(e.cls)});
      svg.append(n);
      if(e.label) svg.append(E('text',{x:e.p.x+2.1,y:e.p.y-2.0,class:'svg-label','data-active':active?'1':'0'},e.label));
    } else if(e.type==='text'){
      svg.append(E('text',{x:e.p.x,y:e.p.y,class:e.cls,'data-active':active?'1':'0'},e.label));
    } else if(e.type==='dim'){
      drawDimension(e,active);
    } else if(e.type==='arc'){
      drawArc(e,active);
    }
  }

  function drawTool(tool){
    if(!tool || tool.kind!=='line') return;
    const v=vec2(tool.a,tool.b), len=norm2(v);
    if(len<EPS) return;
    const angle=Math.atan2(v.y,v.x)*180/Math.PI;
    const rulerLen=Math.max(18,Math.min(len,52));
    const g=E('g',{class:'tool-overlay',transform:'translate('+tool.a.x+' '+tool.a.y+') rotate('+angle+')'});
    g.append(E('rect',{x:0,y:2,width:rulerLen,height:5,rx:1,class:'ruler-body'}));
    for(let x=0;x<=rulerLen;x+=5) g.append(E('line',{x1:x,y1:2,x2:x,y2:x%10===0?5.6:4.3,class:'ruler-tick'}));
    const pencil=E('g',{transform:'translate(0 0) rotate(-8)'});
    pencil.append(E('rect',{x:-1,y:-2,width:9,height:2.3,rx:.4,class:'pencil-body'}));
    pencil.append(E('path',{d:'M 8 -2 L 11 -.85 L 8 .3 z',class:'pencil-tip'}));
    g.append(pencil);
    svg.append(g);
    const anim=pencil.animate(
      [{transform:'translate(0px,0px) rotate(-8deg)'},{transform:'translate('+Math.min(len,rulerLen)+'px,0px) rotate(-8deg)'}],
      {duration:900,easing:'ease-in-out',fill:'forwards'}
    );
    anim.onfinish=()=>g.animate([{opacity:1},{opacity:0}],{duration:280,fill:'forwards'});
  }

  function animateCurrent(){
    const nodes=[...svg.querySelectorAll('[data-active="1"].draw-line')];
    nodes.forEach((n,i)=>{
      const L=n.getTotalLength?n.getTotalLength():0;
      if(!L) return;
      n.style.strokeDasharray=String(L);
      n.style.strokeDashoffset=String(L);
      n.style.transition='none';
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        n.style.transition='stroke-dashoffset '+(620+i*130)+'ms cubic-bezier(.2,.7,.2,1)';
        n.style.strokeDashoffset='0';
      }));
    });
    [...svg.querySelectorAll('[data-active="1"]')].filter(n=>!n.classList.contains('draw-line')).forEach(n=>{
      n.animate([{opacity:0},{opacity:1}],{duration:380,easing:'ease-out'});
    });
    const s=state.steps[state.step];
    if(s && s.tool) drawTool(s.tool);
  }

  function paginateStepText(value,limit){
    const text=String(value||'').trim();
    if(!text) return [''];
    const max=limit||72;
    const sentences=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text];
    const pages=[];
    let current='';
    const pushWords=part=>{
      const words=part.trim().split(/\s+/);
      words.forEach(word=>{
        const next=current ? current+' '+word : word;
        if(next.length>max && current){
          pages.push(current.trim());
          current=word;
        } else current=next;
      });
    };
    sentences.forEach(raw=>{
      const sentence=raw.trim();
      const next=current ? current+' '+sentence : sentence;
      if(next.length<=max){
        current=next;
      }else{
        if(current){ pages.push(current.trim()); current=''; }
        if(sentence.length<=max) current=sentence;
        else pushWords(sentence);
      }
    });
    if(current) pages.push(current.trim());
    return pages.length?pages:[''];
  }

  function stepTextLimit(){
    const w=window.innerWidth||1024;
    if(w<=350) return 46;
    if(w<=390) return 52;
    if(w<=520) return 58;
    if(w<=760) return 64;
    return 82;
  }

  function stepInfoPages(st,mode){
    const limit=stepTextLimit();
    if(mode==='action'){
      const pages=paginateStepText(st.action,limit).map(text=>({text,items:[]}));
      (st.measure||[]).forEach(item=>{
        pages.push({text:'Отмерь и проверь:',items:[item]});
      });
      return pages.length?pages:[{text:'Выполни построение текущего шага.',items:[]}];
    }
    if(mode==='measure'){
      const m=st.measure||[];
      if(!m.length) return [{text:'На этом шаге ничего дополнительно отмерять не нужно.',items:[]}];
      return m.map(item=>({text:'Отмерь и проверь:',items:[item]}));
    }
    const value=mode==='why'?st.why:st.check;
    return paginateStepText(value,limit).map(text=>({text,items:[]}));
  }

  function renderStepInfoPage(st){
    const mode=state.stepInfoMode||'action';
    document.querySelectorAll('.step-info-tab').forEach(btn=>{
      const on=btn.dataset.stepMode===mode;
      btn.classList.toggle('is-active',on);
      btn.setAttribute('aria-selected',on?'true':'false');
    });
    const pages=stepInfoPages(st,mode);
    state.stepInfoPage=Math.max(0,Math.min(state.stepInfoPage||0,pages.length-1));
    const page=pages[state.stepInfoPage]||pages[0];
    $('stepInfoText').textContent=page.text||'';
    $('stepInfoMeasure').innerHTML=page.items&&page.items.length
      ? '<ul class="step-measure-list">'+page.items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'
      : '';
    const pager=$('stepInfoPager');
    pager.hidden=pages.length<=1;
    $('stepInfoPageLabel').textContent=(state.stepInfoPage+1)+' / '+pages.length;
    $('stepInfoPrevPage').disabled=state.stepInfoPage<=0;
    $('stepInfoNextPage').disabled=state.stepInfoPage>=pages.length-1;
  }

  function fitStepTitle(){
    const el=$('stepTitle');
    if(!el) return;
    el.style.fontSize='';
    el.style.lineHeight='';
    if((window.innerWidth||1024)>760) return;
    let size=16;
    const maxHeight=38;
    el.style.fontSize=size+'px';
    el.style.lineHeight='1.12';
    while(el.scrollHeight>maxHeight && size>11){
      size-=.5;
      el.style.fontSize=size+'px';
    }
  }

  function renderExplanation(){
    const st=state.steps[state.step];
    $('stepNumber').textContent=String(state.step+1);
    $('stepTotal').textContent=String(state.steps.length);
    $('stepBadge').textContent='Шаг '+(state.step+1);
    $('stepTitle').textContent=st.title;
    fitStepTitle();
    renderProblemBrief();
    $('stepAction').textContent=st.action;
    $('stepWhy').textContent=st.why;
    $('stepCheck').textContent=st.check;
    $('stepMeasure').innerHTML='<ul class="measure-list">'+(st.measure||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
    renderStepInfoPage(st);
    $('prevBtn').disabled=state.step===0;
    $('firstBtn').disabled=state.step===0;
    $('nextBtn').disabled=state.step===state.steps.length-1;
    $('lastBtn').disabled=state.step===state.steps.length-1;
    if($('mobilePrevBtn')) $('mobilePrevBtn').disabled=state.step===0;
    if($('mobileNextBtn')) $('mobileNextBtn').disabled=state.step===state.steps.length-1;
    syncPlayButtons();
  }

  function drawingZoom(){
    return state.screenZoom===null ? currentFitZoom() : state.screenZoom;
  }

  function visibleDrawingBounds(){
    const pts=[];
    for(let i=0;i<=state.step;i++){
      const st=state.steps[i];
      if(!st) continue;
      (st.entities||[]).forEach(e=>collectEntityPoints(e,pts));
      if(st.tool){
        if(st.tool.a) pts.push(st.tool.a);
        if(st.tool.b) pts.push(st.tool.b);
      }
    }
    const good=pts.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    if(!good.length || !state.geometry){
      return {minX:0,minY:0,maxX:state.geometry?.width||180,maxY:state.geometry?.height||145};
    }
    const margin=8;
    return {
      minX:Math.max(0,Math.min(...good.map(p=>p.x))-margin),
      minY:Math.max(0,Math.min(...good.map(p=>p.y))-margin),
      maxX:Math.min(state.geometry.width,Math.max(...good.map(p=>p.x))+margin),
      maxY:Math.min(state.geometry.height,Math.max(...good.map(p=>p.y))+margin)
    };
  }

  function visibleDrawingViewport(){
    const wrap=document.querySelector('.paper-wrap');
    if(!wrap) return {width:360,height:520};
    const wr=wrap.getBoundingClientRect();
    let visibleBottom=Math.min(wr.bottom,window.innerHeight||wr.bottom);
    const panel=$('stepSheet');
    if(panel && getComputedStyle(panel).position==='fixed'){
      const pr=panel.getBoundingClientRect();
      if(pr.top>wr.top) visibleBottom=Math.min(visibleBottom,pr.top-28);
    }
    return {
      width:Math.max(120,Math.min(wr.width,window.innerWidth||wr.width)),
      height:Math.max(120,visibleBottom-wr.top)
    };
  }

  function currentFitZoom(){
    const g=state.geometry;
    const wrap=document.querySelector('.paper-wrap');
    if(!g || !wrap) return 1;
    const cssMm=96/25.4;
    const cs=getComputedStyle(wrap);
    const px=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
    // Bottom padding is deliberate scroll reserve for the fixed step sheet,
    // not usable drawing space, so do not subtract it twice here.
    const py=(parseFloat(cs.paddingTop)||0)+8;
    const viewport=visibleDrawingViewport();
    const availableW=Math.max(120,viewport.width-px);
    const availableH=Math.max(120,viewport.height-py);
    const vb=visibleDrawingBounds();
    const visibleW=Math.max(20,vb.maxX-vb.minX);
    const visibleH=Math.max(20,vb.maxY-vb.minY);
    const fitW=availableW/(visibleW*cssMm);
    const fitH=availableH/(visibleH*cssMm);
    // Some legitimate descriptive-geometry constructions intersect far outside
    // the compact source drawing (especially nearly parallel planes/lines).
    // Fit must be allowed below 6%, otherwise the whole result can remain
    // off-screen even after pressing "Вписать".
    return Math.max(.005,Math.min(1,fitW,fitH));
  }

  function focusVisibleDrawing(){
    const wrap=document.querySelector('.paper-wrap');
    if(!wrap||!state.geometry) return;
    const z=drawingZoom(),cssMm=96/25.4;
    const vb=visibleDrawingBounds();
    const left=vb.minX*cssMm*z;
    const top=vb.minY*cssMm*z;
    const w=(vb.maxX-vb.minX)*cssMm*z;
    const h=(vb.maxY-vb.minY)*cssMm*z;
    const viewport=visibleDrawingViewport();
    wrap.scrollLeft=Math.max(0,left-(viewport.width-w)/2);
    wrap.scrollTop=Math.max(0,top-(viewport.height-h)/2);
  }

  function ensureDrawingClearOfStepSheet(){
    const wrap=document.querySelector('.paper-wrap');
    const panel=$('stepSheet');
    if(!wrap||!panel||getComputedStyle(panel).position!=='fixed') return;
    const nodes=[...svg.querySelectorAll('line.object-line,line.construction-line,line.answer-line,line.aux-line,circle.point-dot,circle.answer-dot,circle.construction-dot')];
    const boxes=nodes.map(n=>n.getBoundingClientRect()).filter(r=>r.width+r.height>0);
    if(!boxes.length) return;
    const bottom=Math.max(...boxes.map(r=>r.bottom));
    const safeBottom=panel.getBoundingClientRect().top-20;
    if(bottom>safeBottom){
      const maxScroll=Math.max(0,wrap.scrollHeight-wrap.clientHeight);
      wrap.scrollTop=Math.min(maxScroll,wrap.scrollTop+(bottom-safeBottom));
    }
  }

  function applyDrawingZoom(){
    const g=state.geometry;
    if(!g) return;
    const cssMm=96/25.4;
    const z=drawingZoom();
    svg.style.width=(g.width*cssMm*z)+'px';
    svg.style.height=(g.height*cssMm*z)+'px';
    $('zoomLabel').textContent=(z<.1?(z*100).toFixed(1):Math.round(z*100))+'%';
    if(state.screenZoom===null){
      requestAnimationFrame(()=>{
        focusVisibleDrawing();
        requestAnimationFrame(()=>{
          ensureDrawingClearOfStepSheet();
          requestAnimationFrame(ensureDrawingClearOfStepSheet);
        });
      });
    }
  }

  function setZoomAround(next,anchor){
    const wrap=document.querySelector('.paper-wrap');
    if(!wrap||!state.geometry) return;
    const prev=Math.max(.001,drawingZoom());
    const cs=getComputedStyle(wrap);
    const padX=parseFloat(cs.paddingLeft)||0;
    const padY=parseFloat(cs.paddingTop)||0;
    const ax=anchor&&Number.isFinite(anchor.x)?anchor.x:wrap.clientWidth/2;
    const ay=anchor&&Number.isFinite(anchor.y)?anchor.y:wrap.clientHeight/2;
    const contentX=(wrap.scrollLeft+ax-padX)/prev;
    const contentY=(wrap.scrollTop+ay-padY)/prev;
    state.screenZoom=Math.max(.005,Math.min(6,next));
    applyDrawingZoom();
    wrap.scrollLeft=Math.max(0,contentX*state.screenZoom-ax+padX);
    wrap.scrollTop=Math.max(0,contentY*state.screenZoom-ay+padY);
  }

  function setDrawingZoom(mode){
    if(mode==='fit'){
      state.screenZoom=null;
      applyDrawingZoom();
      requestAnimationFrame(()=>{
        focusVisibleDrawing();
        requestAnimationFrame(ensureDrawingClearOfStepSheet);
      });
      return;
    }
    if(mode==='100'){
      setZoomAround(1);
      return;
    }
    const current=drawingZoom();
    setZoomAround(current*(mode==='in'?1.2:1/1.2));
  }

  function setupCanvasGestures(){
    const wrap=document.querySelector('.paper-wrap');
    if(!wrap)return;
    const pointers=state.canvasPointers;
    let gesture=null;

    const pointOf=ev=>{
      const r=wrap.getBoundingClientRect();
      return {x:ev.clientX-r.left,y:ev.clientY-r.top};
    };
    const values=()=>[...pointers.values()];
    const distance=pts=>Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    const center=pts=>({x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2});

    wrap.addEventListener('pointerdown',ev=>{
      if(ev.pointerType!=='touch')return;
      wrap.setPointerCapture&&wrap.setPointerCapture(ev.pointerId);
      pointers.set(ev.pointerId,pointOf(ev));
      const pts=values();
      if(pts.length===1){
        gesture={type:'pan',start:pts[0],left:wrap.scrollLeft,top:wrap.scrollTop};
      }else if(pts.length===2){
        gesture={
          type:'pinch',
          distance:Math.max(10,distance(pts)),
          zoom:drawingZoom(),
          center:center(pts),
          left:wrap.scrollLeft,
          top:wrap.scrollTop
        };
      }
      ev.preventDefault();
    },{passive:false});

    wrap.addEventListener('pointermove',ev=>{
      if(ev.pointerType!=='touch'||!pointers.has(ev.pointerId))return;
      pointers.set(ev.pointerId,pointOf(ev));
      const pts=values();
      if(pts.length===1&&gesture&&gesture.type==='pan'){
        wrap.scrollLeft=gesture.left-(pts[0].x-gesture.start.x);
        wrap.scrollTop=gesture.top-(pts[0].y-gesture.start.y);
      }else if(pts.length===2){
        if(!gesture||gesture.type!=='pinch'){
          gesture={type:'pinch',distance:Math.max(10,distance(pts)),zoom:drawingZoom(),center:center(pts),left:wrap.scrollLeft,top:wrap.scrollTop};
        }
        const next=Math.max(.06,Math.min(6,gesture.zoom*distance(pts)/gesture.distance));
        const cs=getComputedStyle(wrap);
        const padX=parseFloat(cs.paddingLeft)||0,padY=parseFloat(cs.paddingTop)||0;
        const anchorContentX=(gesture.left+gesture.center.x-padX)/gesture.zoom;
        const anchorContentY=(gesture.top+gesture.center.y-padY)/gesture.zoom;
        state.screenZoom=next;
        applyDrawingZoom();
        const now=center(pts);
        wrap.scrollLeft=Math.max(0,anchorContentX*next-now.x+padX);
        wrap.scrollTop=Math.max(0,anchorContentY*next-now.y+padY);
      }
      ev.preventDefault();
    },{passive:false});

    const release=ev=>{
      if(ev.pointerType!=='touch')return;
      pointers.delete(ev.pointerId);
      const pts=values();
      if(pts.length===1){
        gesture={type:'pan',start:pts[0],left:wrap.scrollLeft,top:wrap.scrollTop};
      }else if(!pts.length){
        gesture=null;
      }
    };
    wrap.addEventListener('pointerup',release);
    wrap.addEventListener('pointercancel',release);
  }

  function renderDrawing(){
    const g=state.geometry;
    svg.replaceChildren();
    svg.setAttribute('viewBox','0 0 '+g.width+' '+g.height);
    svg.setAttribute('width',g.width+'mm');
    svg.setAttribute('height',g.height+'mm');
    drawGrid(g.width,g.height);
    state.steps.forEach((s,idx)=>{
      if(idx>state.step) return;
      (s.entities||[]).forEach(e=>drawEntity(e,idx===state.step));
    });
    renderExplanation();
    applyDrawingZoom();
    animateCurrent();
  }

  function syncPlayButtons(){
    const label=state.playing?'Ⅱ Стоп':'▶ Авто';
    if($('playBtn')) $('playBtn').textContent=label;
    if($('mobilePlayBtn')) $('mobilePlayBtn').textContent=label;
  }

  function stopAuto(){
    state.playing=false;
    if(state.timer) clearTimeout(state.timer);
    state.timer=null;
    syncPlayButtons();
  }

  function moveTo(n){
    stopAuto();
    state.step=Math.max(0,Math.min(state.steps.length-1,n));
    state.stepInfoMode='action';
    state.stepInfoPage=0;
    renderDrawing();
  }

  function toggleAuto(){
    if(state.playing){stopAuto();return;}
    state.playing=true;
    syncPlayButtons();
    const tick=()=>{
      if(!state.playing) return;
      if(state.step>=state.steps.length-1){stopAuto();return;}
      state.step++;
      state.stepInfoMode='action';
      state.stepInfoPage=0;
      renderDrawing();
      state.timer=setTimeout(tick,1900);
    };
    state.timer=setTimeout(tick,350);
  }

  function rebuild(resetStep){
    stopAuto();
    const validation=$('validation');
    let solved;
    if(state.task<=3){
      const coords=readCoords();
      const err=validateCoords(coords);
      if(err){
        validation.hidden=false;
        validation.textContent=err;
        return;
      }
      if(state.task===1) solved=solveTask1(coords);
      if(state.task===2) solved=solveTask2(coords);
      if(state.task===3) solved=solveTask3(coords);
    } else {
      solved=solveDiagramTask(state.task,getStoredTaskData());
    }
    if(solved.error){
      validation.hidden=false;
      validation.textContent=solved.error;
      return;
    }
    validation.hidden=true;
    state.geometry=solved;
    state.steps=solved.steps;
    if(resetStep!==false) state.step=0;
    state.step=Math.max(0,Math.min(state.step,state.steps.length-1));
    if(state.task<=3){
      $('scaleValue').textContent='1:1';
      $('gridValue').textContent='5 мм = 0,5 см';
      $('sheetSize').textContent=Math.round(solved.width)+' × '+Math.round(solved.height)+' мм';
    } else {
      $('scaleValue').textContent='по исходной схеме';
      $('gridValue').textContent='вспомогательная';
      $('sheetSize').textContent='авто';
    }
    $('diagramStatus').textContent=solved.diagramPending?'нужна исходная схема':'решаются автоматически';
    renderDrawing();
  }

  function resetCurrent(){
    renderInputs();
    $('kSlider').value='50';
    $('kOutput').textContent='50%';
    rebuild(true);
  }

  $('variantSelect').addEventListener('change',e=>{
    state.variant=e.target.value||null;
    syncChoicePickers();
    updateMobileSummary();
    if(state.variant&&state.task){ saveSelection(); resetCurrent(); }
  });
  $('taskSelect').addEventListener('change',e=>{
    state.task=e.target.value?Number(e.target.value):null;
    syncChoicePickers();
    updateMobileSummary();
    if(state.variant&&state.task){ saveSelection(); resetCurrent(); }
  });
  $('resetBtn').addEventListener('click',resetCurrent);
  $('buildBtn').addEventListener('click',()=>{ rebuild(true); closeMobileSetup(); setDrawingZoom('fit'); });
  $('printBtn').addEventListener('click',()=>window.print());
  $('prevBtn').addEventListener('click',()=>moveTo(state.step-1));
  $('nextBtn').addEventListener('click',()=>moveTo(state.step+1));
  $('firstBtn').addEventListener('click',()=>moveTo(0));
  $('lastBtn').addEventListener('click',()=>moveTo(state.steps.length-1));
  $('playBtn').addEventListener('click',toggleAuto);
  $('zoomOutBtn').addEventListener('click',()=>setDrawingZoom('out'));
  $('zoomFitBtn').addEventListener('click',()=>setDrawingZoom('fit'));
  $('zoom100Btn').addEventListener('click',()=>setDrawingZoom('100'));
  $('zoomInBtn').addEventListener('click',()=>setDrawingZoom('in'));
  $('mobileFitBtn').addEventListener('click',()=>setDrawingZoom('fit'));
  $('mobileSetupBtn').addEventListener('click',openMobileSetup);
  $('mobileSetupClose').addEventListener('click',closeMobileSetup);
  $('mobileBackdrop').addEventListener('click',closeMobileSetup);
  $('stepSheetToggle').addEventListener('click',toggleStepSheet);
  $('mobilePrevBtn').addEventListener('click',()=>moveTo(state.step-1));
  $('mobileNextBtn').addEventListener('click',()=>moveTo(state.step+1));
  $('mobilePlayBtn').addEventListener('click',toggleAuto);
  document.querySelectorAll('.step-info-tab').forEach(btn=>btn.addEventListener('click',()=>{
    state.stepInfoMode=btn.dataset.stepMode||'action';
    state.stepInfoPage=0;
    renderStepInfoPage(state.steps[state.step]);
  }));
  $('stepInfoPrevPage').addEventListener('click',()=>{
    state.stepInfoPage=Math.max(0,(state.stepInfoPage||0)-1);
    renderStepInfoPage(state.steps[state.step]);
  });
  $('stepInfoNextPage').addEventListener('click',()=>{
    state.stepInfoPage=(state.stepInfoPage||0)+1;
    renderStepInfoPage(state.steps[state.step]);
  });
  $('firstRunStart').addEventListener('click',finishFirstRun);
  window.addEventListener('resize',()=>{
    if(state.screenZoom===null) applyDrawingZoom();
    fitStepTitle();
    if(state.steps.length) renderStepInfoPage(state.steps[state.step]);
  });
  $('kSlider').addEventListener('input',()=>{
    $('kOutput').textContent=$('kSlider').value+'%';
    if(state.task===3) rebuild(false);
  });

  const remembered=loadSelection();
  if(remembered){
    state.variant=remembered.variant;
    state.task=remembered.task;
  }
  initSelectors();
  setupCanvasGestures();
  updateMobileSummary();
  if(remembered){
    renderInputs();
    rebuild(true);
    setDrawingZoom('fit');
  } else {
    syncChoicePickers();
    showFirstRunPicker();
  }
})();
