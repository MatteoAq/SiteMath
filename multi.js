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
    stepInfoMode: 'action'
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

  function line(step,a,b,cls,extra){
    return Object.assign({type:'line',step,a,b,cls:cls||'construction-line'},extra||{});
  }
  function point(step,p,label,cls){
    return {type:'point',step,p,label,cls:cls||'point-dot'};
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

  function coordinateLabelsForTask(task){
    if(task===1) return ['A','B','C','D','E'];
    if(task===2) return ['A','B'];
    if(task===3) return ['A','B','C'];
    return [];
  }

  function renderInputs(){
    const task=state.task;
    const holder=$('dynamicInputs');
    const v=currentVariant();
    const stored=getStoredTaskData();
    $('taskName').textContent = task + '. ' + DATA.tasks[task].title;
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
        holder.innerHTML =
          '<div class="diagram-info">' +
          '<p><b>Тип данных:</b> графическая схема на листе, а не координаты.</p>' +
          (knownScheme
            ? '<p><b>Статус:</b> исходный рисунок этого присланного варианта оцифрован. Сайт сохраняет его реальные наклоны и строит решение поверх него.</p>'
            : '<p><b>Статус:</b> точного исходного рисунка пока нет. Сайт не подставляет выдуманную геометрию.</p>') +
          '</div>';
        $('solverMode').textContent=knownScheme?'точная схема':'нет схемы';
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
        '<option value="ABC">тремя точками</option>'+
        '<option value="frontal_projecting">фронтально-проецирующая – задана одной линией на Π₂</option>'+
        '<option value="horizontal_projecting">горизонтально-проецирующая – задана одной линией на Π₁</option>';
      planeControls=
        '<label>Как задана плоскость Σ?<select id="customPlaneAType">'+opts+'</select></label>'+
        '<label>Как задана плоскость Θ?<select id="customPlaneBType">'+opts+'</select></label>';
    }

    let opControls='';
    if(task===4){
      opControls=
        '<label>Что написано после построения h, f и линии ската?'+
        '<select id="customOperation">'+
        '<option value="line_parallel_plane">через точку провести ℓ ∥ Σ</option>'+
        '<option value="line_intersects_frontale">через точку провести ℓ, пересекающую фронталь</option>'+
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
        '<option value="below_plane">под Σ</option>'+
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
      meta.typeA=typeA; meta.typeB=typeB;
      appendPlaneClickItems(sequence,typeA,{lines:['a','b'],points:['A','B','C'],projecting:'Σ'});
      appendPlaneClickItems(sequence,typeB,{lines:['c','d'],points:['D','E','F'],projecting:'Θ'});
      sequence.push(...pointClickItems('K'));
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
    fitPhoto();
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
        relation:m.relation,target:m.operation==='line_intersects_named'?'a':undefined
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
      if(type==='parallel_lines'||type==='intersecting_lines'){
        const ls={};lineNames.forEach(n=>ls[n]=lines[n]);
        return {type:type,lines:ls};
      }
      const pr=projecting[projectName];
      return {type:type,projection:pr.proj,line:pr.line,name:projectName};
    }
    return {
      planeA:planeDef(spec.meta.typeA,['a','b'],['A','B','C'],'Σ'),
      planeB:planeDef(spec.meta.typeB,['c','d'],['D','E','F'],'Θ'),
      pointK:points.K
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
      line(0,{x:8,y:O.y},{x:complexWidth-8,y:O.y},'axis',{arrow:true}),
      line(0,{x:O.x,y:8},{x:O.x,y:height-8},'axis'),
      point(0,O,'O'),
      textEntity(0,{x:10,y:O.y-3},'x'),
      textEntity(0,{x:complexWidth-18,y:O.y-3},'y₃'),
      textEntity(0,{x:O.x+3,y:11},'z'),
      textEntity(0,{x:O.x+3,y:height-9},'y₁'),
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
        line(i,q.p1,q.yFoot,'construction-line'),
        line(i,q.yFoot,q.y3Foot,'construction-line'),
        line(i,q.y3Foot,q.p3,'construction-line'),
        line(i,q.p2,q.p3,'construction-line'),
        point(i,q.yFoot,name+'ᵧ₁','construction-dot'),
        point(i,q.y3Foot,name+'ᵧ₃','construction-dot'),
        point(i,q.p3,name+'₃','answer-dot')
      ],{kind:'line',a:q.p2,b:q.p3});
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
    },[
      line(i,{x:8,y:q.O.y},{x:width-8,y:q.O.y},'axis'),
      line(i,{x:q.O.x,y:12},{x:q.O.x,y:height-10},'construction-line'),
      point(i,q.O,'O'),
      textEntity(i,{x:10,y:q.O.y-3},'x₁₂','svg-label'),
      textEntity(i,{x:q.O.x+3,y:12},'+z','svg-note'),
      textEntity(i,{x:q.O.x+3,y:height-10},'+y','svg-note'),
      textEntity(i,{x:width-24,y:15},'Π₂','svg-note'),
      textEntity(i,{x:width-24,y:height-10},'Π₁','svg-note')
    ],{kind:'line',a:{x:8,y:q.O.y},b:{x:width-8,y:q.O.y}});

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
      title:'Зафиксируй углы наклона',
      action:'Угол между натуральной величиной и A₁B₁ – наклон к Π₁; угол между натуральной величиной и A₂B₂ – наклон к Π₂.',
      why:'Проекция на соответствующую плоскость является прилежащим катетом прямоугольного треугольника.',
      measure:['α(AB,Π₁) = '+fmt(alpha)+'°','β(AB,Π₂) = '+fmt(beta)+'°','AB = '+fmt(L)+' мм'],
      check:'Чем меньше соответствующая разность координат, тем меньше угол.'
    },[]);

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
    },[
      line(i,{x:8,y:O.y},{x:width-8,y:O.y},'axis'),
      line(i,{x:O.x,y:12},{x:O.x,y:height-10},'construction-line'),
      point(i,O,'O'),
      textEntity(i,{x:10,y:O.y-3},'x₁₂','svg-label'),
      textEntity(i,{x:O.x+3,y:12},'+z','svg-note'),
      textEntity(i,{x:O.x+3,y:height-10},'+y','svg-note'),
      textEntity(i,{x:width-24,y:15},'Π₂','svg-note'),
      textEntity(i,{x:width-24,y:height-10},'Π₁','svg-note')
    ],{kind:'line',a:{x:8,y:O.y},b:{x:width-8,y:O.y}});

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

  function planeFromScheme(scheme){
    let P,Q,R;
    if(scheme.planeType==='ABC'){
      P=schemePoint3(scheme.points.A);
      Q=schemePoint3(scheme.points.B);
      R=schemePoint3(scheme.points.C);
    } else if(scheme.planeType==='line_point'){
      const L=schemeLine3(scheme.lines[scheme.planeLine]);
      P=L[0]; Q=L[1]; R=schemePoint3(scheme.points[scheme.planePoint]);
    } else if(scheme.planeType==='parallel_lines' || scheme.planeType==='intersecting_lines'){
      const names=scheme.planeLines;
      const L1=schemeLine3(scheme.lines[names[0]]);
      const L2=schemeLine3(scheme.lines[names[1]]);
      P=L1[0]; Q=L1[1]; R=L2[0];
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
    const b=bounds(pts,24);
    const dx=-b.minX,dy=-b.minY;
    steps.forEach(st=>{
      (st.entities||[]).forEach(e=>shiftEntity(e,dx,dy));
      if(st.tool){
        if(st.tool.a) st.tool.a=shiftPoint(st.tool.a,dx,dy);
        if(st.tool.b) st.tool.b=shiftPoint(st.tool.b,dx,dy);
      }
    });
    return {
      width:Math.max(minimumWidth||180,b.width),
      height:Math.max(minimumHeight||145,b.height),
      shift:{x:dx,y:dy}
    };
  }

  function appendIntersectingLineProjector(out,lines,names,step){
    if(!lines || !names || names.length<2) return;
    const A=lines[names[0]],B=lines[names[1]];
    if(!A||!B) return;
    const p2=lineIntersection2(toSeg(A.p2)[0],toSeg(A.p2)[1],toSeg(B.p2)[0],toSeg(B.p2)[1]);
    const p1=lineIntersection2(toSeg(A.p1)[0],toSeg(A.p1)[1],toSeg(B.p1)[0],toSeg(B.p1)[1]);
    if(!p1||!p2) return;
    const x=(p1.x+p2.x)/2;
    const q1={x:x,y:p1.y}, q2={x:x,y:p2.y};
    out.push(line(step,q2,q1,'construction-line'));
    out.push(point(step,q2,'','construction-dot'));
    out.push(point(step,q1,'','construction-dot'));
  }

  function starterEntitiesFromScheme(scheme,step){
    const out=[];
    Object.entries(scheme.lines||{}).forEach(([name,L])=>{
      out.push(line(step,{x:L.p2[0][0],y:L.p2[0][1]},{x:L.p2[1][0],y:L.p2[1][1]},'object-line'));
      out.push(textEntity(step,{x:L.p2[1][0]+4,y:L.p2[1][1]-2},name+'₂','svg-label'));
      out.push(line(step,{x:L.p1[0][0],y:L.p1[0][1]},{x:L.p1[1][0],y:L.p1[1][1]},'object-line'));
      out.push(textEntity(step,{x:L.p1[1][0]+4,y:L.p1[1][1]-2},name+'₁','svg-label'));
    });
    Object.entries(scheme.points||{}).forEach(([name,P])=>{
      const x=(P.p1[0]+P.p2[0])/2;
      const p2={x:x,y:P.p2[1]},p1={x:x,y:P.p1[1]};
      out.push(line(step,p2,p1,'construction-line'));
      out.push(point(step,p2,name+'₂'));
      out.push(point(step,p1,name+'₁'));
    });
    if(scheme.planeType==='ABC'){
      appendABCPlaneEntities(out,scheme,step);
    }
    if(scheme.planeType==='intersecting_lines'){
      appendIntersectingLineProjector(out,scheme.lines,scheme.planeLines,step);
    }
    return out;
  }

  function solveTask4Scheme(scheme,stored){
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
    let dh=cross3(plane.n,{x:0,y:0,z:1});
    if(norm3(dh)<EPS) dh={x:1,y:0,z:0};
    let df=cross3(plane.n,{x:0,y:1,z:0});
    if(norm3(df)<EPS) df={x:1,y:0,z:0};
    let ds=cross3(plane.n,dh);
    if(norm3(ds)<EPS) ds=cross3(plane.n,df);

    const h3=line3Extent(base,dh,105), f3=line3Extent(base,df,105), s3=line3Extent(base,ds,90);
    const h0=project3(h3[0]),h1=project3(h3[1]);
    const f0=project3(f3[0]),f1=project3(f3[1]);
    const s0=project3(s3[0]),s1=project3(s3[1]);

    i=steps.length;
    push({
      title:'Построй горизонталь h – сначала h₂',
      action:'Через выбранную точку плоскости проведи фронтальную проекцию h₂ параллельно горизонтальному направлению листа.',
      why:'У горизонтали z постоянно. Поэтому её фронтальная проекция h₂ параллельна оси x₁₂. Вторая точка горизонтали определяется принадлежностью плоскости.',
      measure:['h₂ – горизонтальная линия','z = const'],
      check:'Обе выбранные точки h принадлежат плоскости Σ.'
    },[
      line(i,h0.p2,h1.p2,'answer-line'),
      textEntity(i,h1.p2,'h₂','svg-label')
    ],{kind:'line',a:h0.p2,b:h1.p2});

    i=steps.length;
    push({
      title:'Дострой горизонтальную проекцию h₁',
      action:'Перенеси две точки h₂ линиями связи на соответствующие линии плоскости и соедини полученные точки – это h₁.',
      why:'Обе проекции должны описывать одну и ту же горизонталь, лежащую в Σ.',
      measure:['Проекторы между h₂ и h₁ проходят по одной координате x.'],
      check:'h₁ лежит в проекции плоскости, а h₂ остаётся горизонтальной.'
    },[
      line(i,h0.p1,h1.p1,'answer-line'),
      textEntity(i,h1.p1,'h₁','svg-label'),
      line(i,h0.p2,h0.p1,'construction-line'),
      line(i,h1.p2,h1.p1,'construction-line')
    ],{kind:'line',a:h0.p1,b:h1.p1});

    i=steps.length;
    push({
      title:'Построй фронталь f – сначала f₁',
      action:'Через точку плоскости проведи горизонтальную проекцию f₁ параллельно x₁₂, затем найди вторую точку по принадлежности плоскости.',
      why:'У фронтали y постоянно. Поэтому на Π₁ её проекция f₁ параллельна x₁₂.',
      measure:['f₁ – горизонтальная линия','y = const'],
      check:'f₁ действительно проходит через две точки, принадлежащие Σ.'
    },[
      line(i,f0.p1,f1.p1,'answer-line'),
      textEntity(i,f1.p1,'f₁','svg-label')
    ],{kind:'line',a:f0.p1,b:f1.p1});

    i=steps.length;
    push({
      title:'Дострой фронтальную проекцию f₂',
      action:'Перенеси точки f₁ линиями связи на Π₂ и соедини их.',
      why:'f₂ вместе с f₁ задаёт пространственную фронталь плоскости.',
      measure:['Одноимённые точки f₁/f₂ имеют общий x.'],
      check:'f₂ принадлежит плоскости Σ.'
    },[
      line(i,f0.p2,f1.p2,'answer-line'),
      textEntity(i,f1.p2,'f₂','svg-label'),
      line(i,f0.p1,f0.p2,'construction-line'),
      line(i,f1.p1,f1.p2,'construction-line')
    ],{kind:'line',a:f0.p2,b:f1.p2});

    i=steps.length;
    push({
      title:'Построй линию наибольшего ската s₁',
      action:'На Π₁ через точку плоскости проведи s₁ перпендикулярно горизонтали h₁.',
      why:'Линия наибольшего ската плоскости к Π₁ перпендикулярна её горизонталям. Это ключевое графическое свойство, поэтому угол строится как 90°, а не измеряется транспортиром.',
      measure:['s₁ ⟂ h₁','Угол = 90°'],
      check:'Пересечение s₁ и h₁ образует прямой угол.'
    },[
      line(i,s0.p1,s1.p1,'answer-line'),
      textEntity(i,s1.p1,'s₁','svg-label')
    ],{kind:'line',a:s0.p1,b:s1.p1});

    i=steps.length;
    push({
      title:'Дострой s₂ по линиям связи',
      action:'Возьми две точки s₁, найди их вторые проекции по принадлежности плоскости и соедини – получишь s₂.',
      why:'Перпендикулярность нужна только на горизонтальной проекции; фронтальная проекция определяется уже пространственным положением линии в Σ.',
      measure:['s₂ не обязана быть перпендикулярна h₂.'],
      check:'s₁/s₂ задают одну линию, целиком лежащую в Σ.'
    },[
      line(i,s0.p2,s1.p2,'answer-line'),
      textEntity(i,s1.p2,'s₂','svg-label'),
      line(i,s0.p1,s0.p2,'construction-line'),
      line(i,s1.p1,s1.p2,'construction-line')
    ],{kind:'line',a:s0.p2,b:s1.p2});

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
        title:'Через '+op.through+' проведи ℓ ∥ Σ',
        action:'Через заданную точку проведи ℓ параллельно построенной горизонтали h плоскости.',
        why:'Если прямая параллельна любой прямой, лежащей в плоскости, и сама не лежит в этой плоскости, выбранное направление принадлежит плоскости. Поэтому ℓ ∥ h даёт ℓ ∥ Σ.',
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
        title:'Выбери точку T на фронтали f',
        action:'На уже построенной фронтали отметь удобную точку T и построй обе её проекции.',
        why:'Чтобы прямая через заданную точку пересекала фронталь, достаточно провести её через любую точку T этой фронтали.',
        measure:['T₁ ∈ f₁','T₂ ∈ f₂'],
        check:'T₁ и T₂ лежат на одной линии связи.'
      },[point(i,T.p1,'T₁','answer-dot'),point(i,T.p2,'T₂','answer-dot'),line(i,T.p1,T.p2,'construction-line')]);

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
        title:'Выбери точку T на горизонтали h',
        action:'На уже построенной горизонтали h отметь удобную точку T и согласуй T₁/T₂ линией связи.',
        why:'Чтобы прямая через заданную точку пересекала горизонталь, достаточно провести её через любую точку T этой горизонтали.',
        measure:['T₁ ∈ h₁','T₂ ∈ h₂'],
        check:'T₁ и T₂ – проекции одной точки T горизонтали.'
      },[
        point(i,T.p1,'T₁','answer-dot'),point(i,T.p2,'T₂','answer-dot'),
        line(i,T.p1,T.p2,'construction-line')
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
        title:'Выбери T на прямой '+op.target,
        action:'Отметь удобную точку T на заданной прямой '+op.target+' и согласуй T₁/T₂ линией связи.',
        why:'Будущая ℓ должна пересечь '+op.target+', поэтому T сразу выбирается общей точкой двух прямых.',
        measure:['T ∈ '+op.target],
        check:'T₁ лежит на '+op.target+'₁, T₂ – на '+op.target+'₂.'
      },[point(i,T.p1,'T₁','answer-dot'),point(i,T.p2,'T₂','answer-dot'),line(i,T.p1,T.p2,'construction-line')]);
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
      } else if(op.relation==='above_plane'){
        const x=through3?through3.x:base.x+45;
        const y=through3?through3.y:base.y+35;
        const zp=planeZAt(plane,x,y);
        if(zp!==null){
          ref3={x:x,y:y,z:zp};
          R3={x:x,y:y,z:zp+52};
        }
      } else if(op.relation==='front_of_plane'){
        const x=through3?through3.x:base.x+45;
        const z=through3?through3.z:base.z+25;
        const yp=planeYAt(plane,x,z);
        if(yp!==null){
          ref3={x:x,y:yp,z:z};
          R3={x:x,y:yp+52,z:z};
        }
      } else if(op.relation==='below_plane'){
        const x=through3?through3.x:base.x+45;
        const y=through3?through3.y:base.y+35;
        const zp=planeZAt(plane,x,y);
        if(zp!==null){
          ref3={x:x,y:y,z:zp};
          R3={x:x,y:y,z:zp-52};
        }
      }

      if(R3){
        const R=project3(R3),Ref=ref3?project3(ref3):null;
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
        } else if(op.relation==='above_plane'){
          relationText='над плоскостью Σ';
          why='Сначала находим точку плоскости с теми же x и y, затем увеличиваем только z. Так новая точка оказывается строго над Σ.';
        } else if(op.relation==='front_of_plane'){
          relationText='перед плоскостью Σ';
          why='Сначала находим точку плоскости с теми же x и z, затем увеличиваем y. Так новая точка располагается перед Σ по направлению удаления от фронтальной плоскости проекций.';
        } else {
          relationText='под плоскостью Σ';
          why='Сначала вертикалью находим точку плоскости с теми же x,y, затем уменьшаем z. Это даёт точку строго под Σ.';
        }
        push({
          title:'Построй '+op.resultPoint+' '+relationText,
          action:'Выбери удобное смещение в требуемом направлении. Условие не задаёт расстояние, поэтому его выбирают только для читаемости чертежа; экранный отступ сайта не является размером, который нужно переносить на бумагу.',
          why:why,
          measure:['Величина смещения не задана условием – выбирается для читаемости чертежа.'],
          check:'Проверь совпадающую координату по соответствующей линии связи.'
        },[
          Ref?point(i,Ref.p1,'R₁','construction-dot'):null,
          Ref?point(i,Ref.p2,'R₂','construction-dot'):null,
          line(i,R.p1,R.p2,'construction-line'),
          point(i,R.p1,op.resultPoint+'₁','answer-dot'),
          point(i,R.p2,op.resultPoint+'₂','answer-dot')
        ].filter(Boolean),{kind:'line',a:R.p1,b:R.p2});
      }
    }

    i=steps.length;
    push({
      title:'Финальная проверка задания 4',
      action:'Проверь принадлежность h, f, s плоскости и отдельное дополнительное условие выбранного варианта.',
      why:'Проверка выполняется по геометрическим инвариантам, а не по внешнему сходству с образцом.',
      measure:['h₂ ∥ x₁₂','f₁ ∥ x₁₂','s₁ ⟂ h₁'],
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
    const names=scheme.planeLines || Object.keys(scheme.lines||{}).filter(n=>n!==scheme.givenLine).slice(0,2);
    return names.slice(0,2).map(name=>({name:name,rec:scheme.lines[name]}));
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

  function solveTask5Scheme(scheme,stored){
    let plane;
    try { plane=planeFromScheme(scheme); }
    catch(err){ return {error:err.message}; }
    const lrec=scheme.lines[scheme.givenLine||'l'];
    if(!lrec) return {error:'В оцифрованной схеме не найдена прямая ℓ.'};
    const refs=planeReferenceLines(scheme);
    if(refs.length<2) return {error:'Для плоскости не хватает двух опорных линий.'};

    const l1=toSeg(lrec.p1), l2=toSeg(lrec.p2);
    const r11=toSeg(refs[0].rec.p1), r12=toSeg(refs[1].rec.p1);
    const I1=lineIntersection2(l1[0],l1[1],r11[0],r11[1]);
    const I2=lineIntersection2(l1[0],l1[1],r12[0],r12[1]);
    if(!I1 || !I2) return {error:'В выбранной вспомогательной проекции одна из опорных линий параллельна ℓ. Нужен альтернативный секущий алгоритм.'};

    const I1p2={x:I1.x,y:lineY(refs[0].rec.p2,I1.x)};
    const I2p2={x:I2.x,y:lineY(refs[1].rec.p2,I2.x)};
    const K2=lineIntersection2(l2[0],l2[1],I1p2,I2p2);
    if(!K2) return {error:'После оцифровки ℓ₂ оказалась параллельна линии сечения. Проверь исходную схему.'};
    const K1={x:K2.x,y:lineY(lrec.p1,K2.x)};

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

    i=steps.length;
    push({
      title:'Заключи ℓ во вспомогательную проецирующую плоскость Ω',
      action:'Возьми горизонтально-проецирующую плоскость Ω так, чтобы её вырожденная проекция Ω₁ совпала с ℓ₁.',
      why:'Это стандартный алгоритм пересечения прямой и плоскости: вспомогательная плоскость содержит ℓ, поэтому её пересечение с Σ обязательно пересечёт ℓ в искомой K.',
      measure:['Ω₁ ≡ ℓ₁'],
      check:'Прямая ℓ полностью принадлежит Ω.'
    },[
      line(i,l1[0],l1[1],'aux-line'),
      textEntity(i,lerp2(l1[0],l1[1],.18),'Ω₁≡ℓ₁','svg-label')
    ],{kind:'line',a:l1[0],b:l1[1]});

    i=steps.length;
    push({
      title:'Найди 1₁ и 2₁ – точки сечения Ω с плоскостью Σ',
      action:'Продли Ω₁=ℓ₁ до пересечения с двумя опорными линиями плоскости: '+refs[0].name+'₁ и '+refs[1].name+'₁.',
      why:'Каждая такая точка одновременно принадлежит Ω и Σ. Двух общих точек достаточно, чтобы задать линию m = Ω ∩ Σ.',
      measure:['1₁ = Ω₁ ∩ '+refs[0].name+'₁','2₁ = Ω₁ ∩ '+refs[1].name+'₁'],
      check:'Обе точки лежат на ℓ₁/Ω₁.'
    },[
      point(i,I1,'1₁','answer-dot'),
      point(i,I2,'2₁','answer-dot')
    ]);

    i=steps.length;
    push({
      title:'Перенеси 1₁ и 2₁ на Π₂',
      action:'Из 1₁ и 2₁ проведи линии связи. На соответствующих вторых проекциях '+refs[0].name+'₂ и '+refs[1].name+'₂ получи 1₂ и 2₂.',
      why:'Точка на пространственной опорной линии должна одновременно принадлежать обеим её одноимённым проекциям.',
      measure:['1₁↔1₂ – одна линия связи','2₁↔2₂ – одна линия связи'],
      check:'1₂ лежит на '+refs[0].name+'₂, 2₂ – на '+refs[1].name+'₂.'
    },[
      line(i,I1,I1p2,'construction-line'),point(i,I1p2,'1₂','answer-dot'),
      line(i,I2,I2p2,'construction-line'),point(i,I2p2,'2₂','answer-dot')
    ],{kind:'line',a:I1,b:I1p2});

    i=steps.length;
    push({
      title:'Построй m₂ = 1₂2₂ и найди K₂',
      action:'Соедини 1₂ и 2₂. В точке пересечения m₂ с ℓ₂ поставь K₂.',
      why:'m – линия пересечения вспомогательной Ω и заданной Σ. Поскольку ℓ лежит в Ω, пересечение ℓ с m и есть ℓ ∩ Σ.',
      measure:['m₂ = 1₂2₂','K₂ = m₂ ∩ ℓ₂'],
      check:'K₂ одновременно лежит на m₂ и ℓ₂.'
    },[
      line(i,I1p2,I2p2,'answer-line'),textEntity(i,lerp2(I1p2,I2p2,.7),'m₂','svg-label'),
      point(i,K2,'K₂','answer-dot')
    ],{kind:'line',a:I1p2,b:I2p2});

    i=steps.length;
    push({
      title:'Перенеси K₂ в K₁',
      action:'Из K₂ опусти линию связи до ℓ₁. Полученная точка – K₁.',
      why:'K₁ и K₂ – две проекции одной пространственной точки пересечения K.',
      measure:['K₁K₂ – линия связи'],
      check:'K₁ лежит на ℓ₁.'
    },[
      line(i,K2,K1,'construction-line'),point(i,K1,'K₁','answer-dot')
    ],{kind:'line',a:K2,b:K1});

    const vis1=segmentVisibility(lrec,plane,'p1',K1);
    const vis2=segmentVisibility(lrec,plane,'p2',K2);
    i=steps.length;
    const p1a=l1[0],p1b=l1[1],p2a=l2[0],p2b=l2[1];
    push({
      title:'Определи видимость ℓ методом конкурирующих точек',
      action:'По обе стороны K сравни глубину точки ℓ и точки плоскости с той же проекцией. Ближний к наблюдателю объект остаётся сплошным, дальний участок ℓ проводится штриховой линией.',
      why:'На Π₁ сравниваются высоты z, на Π₂ – удаления y от фронтальной плоскости. Точка K разделяет участки, где знак этой разности меняется.',
      measure:['Π₁: сравнить z линии и плоскости','Π₂: сравнить y линии и плоскости'],
      check:'В K видимость может смениться, но сама K остаётся общей точкой.'
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
        out.push(line(step,{x:q.p2[0],y:q.p2[1]},{x:q.p1[0],y:q.p1[1]},'construction-line'));
        out.push(point(step,{x:q.p2[0],y:q.p2[1]},pre+name+'₂'));
        out.push(point(step,{x:q.p1[0],y:q.p1[1]},pre+name+'₁'));
      });
      appendABCPlaneEntities(out,pseudo,step);
    } else if(def.type==='line_point'){
      Object.entries(def.lines||{}).forEach(([name,L])=>{
        out.push(line(step,{x:L.p2[0][0],y:L.p2[0][1]},{x:L.p2[1][0],y:L.p2[1][1]},'object-line'));
        out.push(textEntity(step,{x:L.p2[1][0]+3,y:L.p2[1][1]-2},name+'₂','svg-label'));
        out.push(line(step,{x:L.p1[0][0],y:L.p1[0][1]},{x:L.p1[1][0],y:L.p1[1][1]},'object-line'));
        out.push(textEntity(step,{x:L.p1[1][0]+3,y:L.p1[1][1]-2},name+'₁','svg-label'));
      });
      Object.entries(def.points||{}).forEach(([name,P])=>{
        const q=normalizedPointRec(P);
        out.push(line(step,{x:q.p2[0],y:q.p2[1]},{x:q.p1[0],y:q.p1[1]},'construction-line'));
        out.push(point(step,{x:q.p2[0],y:q.p2[1]},name+'₂'));
        out.push(point(step,{x:q.p1[0],y:q.p1[1]},name+'₁'));
      });
    } else if(def.lines){
      Object.entries(def.lines).forEach(([name,L])=>{
        out.push(line(step,{x:L.p2[0][0],y:L.p2[0][1]},{x:L.p2[1][0],y:L.p2[1][1]},'object-line'));
        out.push(textEntity(step,{x:L.p2[1][0]+3,y:L.p2[1][1]-2},name+'₂','svg-label'));
        out.push(line(step,{x:L.p1[0][0],y:L.p1[0][1]},{x:L.p1[1][0],y:L.p1[1][1]},'object-line'));
        out.push(textEntity(step,{x:L.p1[1][0]+3,y:L.p1[1][1]-2},name+'₁','svg-label'));
      });
      if(def.type==='intersecting_lines'){
        appendIntersectingLineProjector(out,def.lines,Object.keys(def.lines).slice(0,2),step);
      }
    } else if(def.line){
      const seg=toSeg(def.line);
      const idx=def.type==='frontal_projecting'?'₂':'₁';
      out.push(line(step,seg[0],seg[1],'object-line'));
      out.push(textEntity(step,{x:seg[1].x+4,y:seg[1].y-2},(def.name||pre||'Π')+idx,'svg-label'));
    }
    return out;
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
    const K3=schemePoint3(throughRec);
    const K=project3(K3);
    const throughK=line3Extent(K3,inter.d,90);
    const kA=project3(throughK[0]),kB=project3(throughK[1]);

    const steps=[],push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));
    let i=0;
    const starter=[
      ...starterPlaneDefEntities(scheme.planeA,i,'Σ'),
      ...starterPlaneDefEntities(scheme.planeB,i,'Θ'),
      line(i,{x:throughRec.p2[0],y:throughRec.p2[1]},{x:throughRec.p1[0],y:throughRec.p1[1]},'construction-line'),
      point(i,{x:throughRec.p2[0],y:throughRec.p2[1]},throughLabel+'₂'),
      point(i,{x:throughRec.p1[0],y:throughRec.p1[1]},throughLabel+'₁')
    ];
    push({
      title:'Перенеси обе плоскости и точку '+throughLabel,
      action:'Сначала воспроизведи исходные проекции двух плоскостей и заданную точку '+throughLabel+' без изменения наклонов.',
      why:'Положение линий на варианте является исходными данными. Решение строится уже поверх них.',
      measure:['Плоскость Σ – первый набор','Плоскость Θ – второй набор',throughLabel+'₁/'+throughLabel+'₂ – одна линия связи'],
      check:'Стартовый рисунок совпадает с печатным условием.'
    },starter);

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
        action:'Проведи вспомогательную горизонтальную плоскость уровня через будущую точку P. Она пересекает Σ и Θ по двум горизонталям.',
        why:'Две горизонтали лежат в одной вспомогательной плоскости. Их пересечение P принадлежит одновременно Σ и Θ.',
        measure:['На Π₂ обе горизонтали имеют один уровень z.','На Π₁ строятся их действительные направления.'],
        check:'P₁ – пересечение горизонталей обеих плоскостей.'
      },[
        line(i,pA0.p1,pA1.p1,'aux-line'),textEntity(i,pA1.p1,'hΣ₁','svg-label'),
        line(i,pB0.p1,pB1.p1,'aux-line'),textEntity(i,pB1.p1,'hΘ₁','svg-label'),
        point(i,pp.p1,'P₁','answer-dot'),
        point(i,pp.p2,'P₂','answer-dot'),
        line(i,pp.p1,pp.p2,'construction-line')
      ]);

      i=steps.length;
      push({
        title:'Второе вспомогательное горизонтальное сечение',
        action:'На другом уровне повтори построение и получи вторую общую точку Q.',
        why:'Две различные общие точки однозначно задают линию пересечения плоскостей.',
        measure:['Q ∈ Σ','Q ∈ Θ'],
        check:'Q₁/Q₂ находятся на одной линии связи.'
      },[
        line(i,qA0.p1,qA1.p1,'aux-line'),textEntity(i,qA1.p1,'hΣ₁','svg-label'),
        line(i,qB0.p1,qB1.p1,'aux-line'),textEntity(i,qB1.p1,'hΘ₁','svg-label'),
        point(i,qq.p1,'Q₁','answer-dot'),
        point(i,qq.p2,'Q₂','answer-dot'),
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
        line(i,pA0.p2,pA1.p2,'aux-line'),
        line(i,pB0.p2,pB1.p2,'aux-line'),
        point(i,pp.p1,'P₁','answer-dot'),point(i,pp.p2,'P₂','answer-dot'),
        line(i,pp.p1,pp.p2,'construction-line')
      ]);
      i=steps.length;
      push({
        title:'Второе вспомогательное фронтальное сечение',
        action:'Повтори на другом уровне y и получи Q.',
        why:'P и Q задают искомую линию пересечения.',
        measure:['Q ∈ Σ и Θ'],
        check:'Q₁/Q₂ согласованы линией связи.'
      },[
        line(i,qA0.p2,qA1.p2,'aux-line'),
        line(i,qB0.p2,qB1.p2,'aux-line'),
        point(i,qq.p1,'Q₁','answer-dot'),point(i,qq.p2,'Q₂','answer-dot'),
        line(i,qq.p1,qq.p2,'construction-line')
      ]);
    }

    i=steps.length;
    push({
      title:'Соедини P и Q – это линия пересечения r',
      action:'Проведи r₁ через P₁,Q₁ и r₂ через P₂,Q₂.',
      why:'Линия, проходящая через две общие точки плоскостей, целиком принадлежит обеим плоскостям.',
      measure:['r = Σ ∩ Θ'],
      check:'P и Q лежат на обеих проекциях r.'
    },[
      line(i,pp.p1,qq.p1,'answer-line'),textEntity(i,qq.p1,'r₁','svg-label'),
      line(i,pp.p2,qq.p2,'answer-line'),textEntity(i,qq.p2,'r₂','svg-label')
    ],{kind:'line',a:pp.p1,b:qq.p1});

    i=steps.length;
    push({
      title:'Через '+throughLabel+' проведи прямую k ∥ обеим плоскостям',
      action:'Через '+throughLabel+'₁ проведи k₁ ∥ r₁, а через '+throughLabel+'₂ – k₂ ∥ r₂.',
      why:'Общее направление двух непараллельных плоскостей – направление их линии пересечения r. Поэтому прямая, параллельная r, параллельна одновременно Σ и Θ.',
      measure:['k₁ ∥ r₁','k₂ ∥ r₂'],
      check:'Направления k и r совпадают на обеих проекциях.'
    },[
      line(i,kA.p1,kB.p1,'answer-line'),textEntity(i,kB.p1,'k₁','svg-label'),
      line(i,kA.p2,kB.p2,'answer-line'),textEntity(i,kB.p2,'k₂','svg-label')
    ],{kind:'line',a:kA.p1,b:kB.p1});

    i=steps.length;
    push({
      title:'Финальная проверка задания 6',
      action:'Проверь две общие точки линии r и попарную параллельность проекций k и r.',
      why:'Это одновременно подтверждает линию пересечения и требуемое направление прямой через '+throughLabel+'.',
      measure:['P,Q ∈ Σ и Θ','k ∥ r'],
      check:'k проходит через '+throughLabel+' и не обязана лежать ни в одной из плоскостей.'
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
        'data-active':active?'1':'0'
      });
      if(e.arrow) n.setAttribute('marker-end','url(#axisArrow)');
      svg.append(n);
    } else if(e.type==='point'){
      const n=E('circle',{cx:e.p.x,cy:e.p.y,r:e.cls.includes('answer')?1.05:.88,class:e.cls+(active?' active-dot':''),'data-active':active?'1':'0','data-label':e.label||''});
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

  function renderStepInfoPage(s){
    const mode=state.stepInfoMode||'action';
    document.querySelectorAll('.step-info-tab').forEach(btn=>{
      const on=btn.dataset.stepMode===mode;
      btn.classList.toggle('is-active',on);
      btn.setAttribute('aria-selected',on?'true':'false');
    });
    const text=$('stepInfoText'),measure=$('stepInfoMeasure');
    measure.innerHTML='';
    if(mode==='action'){
      text.textContent=s.action||'';
    } else if(mode==='measure'){
      text.textContent=(s.measure&&s.measure.length)?'Отмерь и проверь эти величины:':'На этом шаге ничего дополнительно отмерять не нужно.';
      measure.innerHTML=(s.measure&&s.measure.length)
        ? '<ul class="step-measure-list">'+s.measure.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'
        : '';
    } else if(mode==='why'){
      text.textContent=s.why||'';
    } else {
      text.textContent=s.check||'';
    }
  }

  function renderExplanation(){
    const st=state.steps[state.step];
    $('stepNumber').textContent=String(state.step+1);
    $('stepTotal').textContent=String(state.steps.length);
    $('stepBadge').textContent='Шаг '+(state.step+1);
    $('stepTitle').textContent=st.title;
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

  function currentFitZoom(){
    const g=state.geometry;
    const wrap=document.querySelector('.paper-wrap');
    if(!g || !wrap) return 1;
    const cssMm=96/25.4;
    const cs=getComputedStyle(wrap);
    const px=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
    const py=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
    const availableW=Math.max(120,(wrap.clientWidth||window.innerWidth||360)-px);
    const availableH=Math.max(160,(wrap.clientHeight||window.innerHeight||640)-py);
    const fitW=availableW/(g.width*cssMm);
    const fitH=availableH/(g.height*cssMm);
    return Math.max(.06,Math.min(1,fitW,fitH));
  }

  function applyDrawingZoom(){
    const g=state.geometry;
    if(!g) return;
    const cssMm=96/25.4;
    const z=drawingZoom();
    svg.style.width=(g.width*cssMm*z)+'px';
    svg.style.height=(g.height*cssMm*z)+'px';
    $('zoomLabel').textContent=Math.round(z*100)+'%';
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
    state.screenZoom=Math.max(.06,Math.min(6,next));
    applyDrawingZoom();
    wrap.scrollLeft=Math.max(0,contentX*state.screenZoom-ax+padX);
    wrap.scrollTop=Math.max(0,contentY*state.screenZoom-ay+padY);
  }

  function setDrawingZoom(mode){
    const wrap=document.querySelector('.paper-wrap');
    if(mode==='fit'){
      state.screenZoom=null;
      applyDrawingZoom();
      if(wrap){ wrap.scrollLeft=0; wrap.scrollTop=0; }
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
    renderStepInfoPage(state.steps[state.step]);
  }));
  $('firstRunStart').addEventListener('click',finishFirstRun);
  window.addEventListener('resize',()=>{ if(state.screenZoom===null) applyDrawingZoom(); });
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
