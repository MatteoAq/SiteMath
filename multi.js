(() => {
  'use strict';

  const DATA = window.SITEMATH_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const GRID = 5;
  // Original graphic conditions for all 20 variants are published in source-photos/scans.
  // The underlying drawing album and university teaching materials remain private.
  const EPS = 1e-8;
  const $ = id => document.getElementById(id);
  const svg = $('drawing');

  function applyTheme(theme){
    const dark=theme==='dark';
    if(document.documentElement?.dataset)
      document.documentElement.dataset.theme=dark?'dark':'light';
    const meta=$('siteThemeColor');
    if(typeof meta?.setAttribute==='function')
      meta.setAttribute('content',dark?'#17121f':'#f8f3fb');
    for(const id of ['catalogThemeToggle','desktopThemeToggle','mobileThemeToggle']){
      const button=$(id);
      if(typeof button?.setAttribute!=='function')continue;
      button.setAttribute('aria-pressed',dark?'true':'false');
      const tip=dark?'Включить светлую тему':'Включить тёмную тему';
      button.setAttribute('aria-label',tip);
      button.setAttribute('title',tip);
      const label=button.querySelector?.('.theme-copy');
      if(label)label.textContent='Тема';
    }
  }
  function toggleTheme(){
    const next=document.documentElement?.dataset?.theme==='dark'?'light':'dark';
    try{localStorage.setItem('sitemath-theme',next);}catch(_){}
    applyTheme(next);
  }
  for(const id of ['catalogThemeToggle','desktopThemeToggle','mobileThemeToggle']){
    const button=$(id);
    if(typeof button?.addEventListener==='function')
      button.addEventListener('click',toggleTheme);
  }
  applyTheme(document.documentElement?.dataset?.theme);

  const state = {
    variant: null,
    task: null,
    step: 0,
    steps: [],
    geometry: null,
    paperFrame: null,
    playing: false,
    timer: null,
    customSchemes: {},
    calibrator: null,
    screenZoom: null,
    focusMode: false,
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

  function cellCount(mm){
    const value=Math.abs(mm)/GRID;
    const whole=Math.round(value);
    const word=Number.isInteger(value)
      ? ((whole%100>=11&&whole%100<=14)||whole%10===0||whole%10>=5
          ? 'клеток' : whole%10===1?'клетка':'клетки')
      : 'клетки';
    return fmt(value)+' '+word;
  }

  function signedCoord(n){
    const v=Math.abs(n)<1e-9?0:n;
    return v<0?'−'+fmt(Math.abs(v)):fmt(v);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // Describe coordinates using directions on the drawing instead of
  // asking a student to measure a negative or zero distance.
  function coordinateYZ(name,p){
    const mark=(value,positive,negative,projection)=>{
      if(Math.abs(value)<EPS) return projection+' поставь непосредственно на оси x₁₂.';
      return projection+' отметь в '+fmt(Math.abs(value))+' мм '+(value>0?positive:negative)+' от оси x₁₂.';
    };
    return mark(p.y,'вниз','вверх',name+'₁')+' '+mark(p.z,'вверх','вниз',name+'₂');
  }
  function coordinatePlacement(name,p){
    const x=Math.abs(p.x)<EPS
      ? 'Координата x = 0: проведи линию связи через O.'
      : 'От O по оси x отложи '+fmt(Math.abs(p.x))+' мм '+(p.x>0?'влево':'вправо')+' и проведи через отметку вертикальную линию связи.';
    return x+' '+coordinateYZ(name,p);
  }
  function coordinateProfile(name,p){
    const y=Math.abs(p.y)<EPS
      ? 'При y = 0 нужная вертикаль совпадает с профильной осью через O. Диагональный перенос не нужен.'
      : 'От уже построенной отметки y на вертикальной оси через O проведи линию под 45° к x₁₂ до горизонтальной профильной оси. Это перенос координаты y по направлению постоянной прямой чертежа k, без повторного измерения. Полученная отметка находится в '+fmt(Math.abs(p.y))+' мм '+(p.y>0?'вправо':'влево')+' от O. Проведи через неё вертикаль.';
    const z=Math.abs(p.z)<EPS
      ? 'При z = 0 отметка находится на горизонтали через O.'
      : 'На этой вертикали отложи '+fmt(Math.abs(p.z))+' мм '+(p.z>0?'вверх':'вниз')+' от горизонтали через O.';
    return y+' '+z+' Проведи горизонтальную линию связи от '+name+'₂ и подпиши пересечение '+name+'₃.';
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

  // A university assignment is a complete album, not an individual task.
  const ASSIGNMENTS=Array.isArray(window.SITEMATH_ASSIGNMENTS)&&window.SITEMATH_ASSIGNMENTS.length
    ? window.SITEMATH_ASSIGNMENTS
    : [{id:'album-1',title:'Задание № 1',course:'I курс',courseOrder:1,
        subject:'Начертательная геометрия и инженерная графика',
        description:'Альбом из 6 задач.',variantCount:20,taskCount:6,
        status:'available',solver:'legacy-album-1'}];
  const ACTIVE_ASSIGNMENT=ASSIGNMENTS.find(a=>a.status==='available'&&a.solver==='legacy-album-1');
  const COURSES=[...new Map(ASSIGNMENTS.filter(a=>a.course)
    .map(a=>[a.course,{name:a.course,order:Number(a.courseOrder)||999}])).values()]
    .sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'ru'));
  let activeCourse=null;

  function renderCourseCatalog(){
    const root=$('courseCatalog');
    if(!root)return;
    root.replaceChildren();
    for(const course of COURSES){
      const available=ASSIGNMENTS.filter(a=>a.course===course.name&&a.status==='available'&&a.solver==='legacy-album-1');
      if(!available.length)continue;
      const card=document.createElement('button');
      card.type='button';
      card.className='course-card';
      card.dataset.course=course.name;
      card.setAttribute('aria-label','Открыть задания: '+course.name);
      card.innerHTML='<span class="course-card-number">'+esc(course.name)+'</span>'+
        '<strong>Задания '+esc(course.name.replace('курс','курса'))+'</strong>'+
        '<span>'+available.length+' '+(available.length===1?'задание':'заданий')+' доступно · Начертательная геометрия</span>'+
        '<b>Посмотреть задания <span aria-hidden="true">↗</span></b>';
      card.addEventListener('click',()=>openCourse(course.name));
      root.appendChild(card);
    }
  }

  function renderAssignmentCatalog(){
    const root=$('assignmentCatalog');
    if(!root)return;
    root.replaceChildren();
    const inCourse=ASSIGNMENTS.filter(a=>a.course===activeCourse);
    const available=inCourse.filter(a=>a.status==='available'&&a.solver==='legacy-album-1');
    $('catalogAvailableCount').textContent=String(available.length);
    $('catalogCurrentCourse').textContent=activeCourse||'';
    $('setupCourseLabel').textContent=activeCourse||'';
    for(const assignment of inCourse){
      const supported=assignment.status==='available'&&assignment.solver==='legacy-album-1';
      const card=document.createElement(supported?'button':'article');
      if(supported){card.type='button';card.dataset.assignment=assignment.id;}
      card.className='assignment-card '+(supported?'is-available':'is-upcoming');
      if(supported)card.setAttribute('aria-label','Выбрать '+assignment.title);
      const n=(/№\s*(\d+)/.exec(assignment.title)||[])[1]||'1';
      const icon='<svg class="assignment-sketch" viewBox="0 0 230 130" fill="none" aria-hidden="true">'+
        '<path d="M22 115L85 24L181 105L22 115M85 24L213 20M181 105L213 20" stroke="currentColor" stroke-width="1.8"/>'+
        '<path d="M22 115L22 62L85 24M181 105L181 43L213 20M22 62L181 43" stroke="currentColor" stroke-dasharray="5 5" opacity=".35"/>'+
        '<circle cx="22" cy="115" r="4"/><circle cx="85" cy="24" r="4"/><circle cx="181" cy="105" r="4"/>'+
        '</svg>';
      card.innerHTML='<div class="assignment-visual">'+icon+
        '<span class="assignment-number">'+esc(String(n).padStart(2,'0'))+'</span></div>'+
        '<div class="assignment-main">'+
          '<span class="assignment-status">'+(supported?'Доступно':'В подготовке')+'</span>'+
          '<h3>'+esc(assignment.title)+'</h3>'+
          '<p>'+esc(assignment.description||'Решение пока не опубликовано.')+'</p>'+
          '<div class="assignment-meta"><span>'+esc(assignment.subject||'Учебная работа')+'</span>'+
          (supported?'<span>'+assignment.variantCount+' вариантов · '+assignment.taskCount+' задач</span>':'')+
          '</div>'+
          '<div class="assignment-open">'+(supported?'Выбрать вариант и задачу ↗':'Пока недоступно')+'</div>'+
        '</div>';
      if(supported)card.addEventListener('click',()=>openAssignment(assignment));
      root.appendChild(card);
    }
    const future=document.createElement('div');
    future.className='assignment-future';
    future.innerHTML='<div class="future-symbol" aria-hidden="true">＋</div>'+
      '<b>Другие задания</b><p>Здесь появятся следующие задания этого курса.</p>';
    root.appendChild(future);
    if(ACTIVE_ASSIGNMENT)$('activeAssignmentTitle').textContent=ACTIVE_ASSIGNMENT.title;
  }

  function setCatalogView(view){
    const picker=$('firstRunPicker');
    if(!picker)return;
    const setup=view==='setup',catalog=view==='catalog',courses=view==='courses';
    picker.dataset.view=view;
    picker.setAttribute('aria-labelledby',courses?'catalogCoursesTitle':
      setup?'activeAssignmentTitle':'firstRunTitle');
    $('catalogCoursesView').hidden=!courses;
    $('catalogListView').hidden=!catalog;
    $('activeAssignment').hidden=!setup;
    $('catalogListBackBtn').hidden=courses;
    $('catalogListBackBtn').textContent=setup?'← К заданиям':'← К курсам';
    picker.scrollIntoView?.({block:'start'});
  }

  function openCourse(course){
    if(!COURSES.some(c=>c.name===course))return;
    activeCourse=course;
    renderAssignmentCatalog();
    setCatalogView('catalog');
    $('firstRunTitle').focus();
  }

  function openAssignment(assignment){
    if(!assignment||assignment.id!==ACTIVE_ASSIGNMENT?.id)return;
    setCatalogView('setup');
    $('activeAssignmentTitle').focus();
  }

  function returnToAssignmentList(){
    setCatalogView('catalog');
    $('assignmentCatalog').querySelector('button.assignment-card')?.focus();
  }

  function returnToCourses(){
    setCatalogView('courses');
    $('courseCatalog').querySelector('button.course-card')?.focus();
  }

  function handleCatalogBack(){
    if($('firstRunPicker').dataset.view==='setup')returnToAssignmentList();
    else returnToCourses();
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
    $('firstRunStart').firstChild.textContent=state.variant&&state.task
      ? 'Открыть пошаговое решение ' : 'Выбери вариант и задачу ';
  }

  function showFirstRunPicker(){
    stopAuto();
    closeMobileSetup();
    renderCourseCatalog();
    renderFirstRunPicker();
    $('firstRunPicker').hidden=false;
    document.body.classList.add('first-run-open');
    setCatalogView('courses');
  }

  function finishFirstRun(){
    if(!state.variant||!state.task) return;
    $('variantSelect').value=state.variant;
    $('taskSelect').value=String(state.task);
    saveSelection();
    $('firstRunPicker').hidden=true;
    document.body.classList.remove('first-run-open');
    // The catalogue may be several screens tall. Never inherit its scroll
    // position inside the drawing workspace on a phone or narrow laptop.
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    const paper=document.querySelector('.paper-wrap');
    if(paper){paper.scrollLeft=0;paper.scrollTop=0;}
    renderInputs();
    setDefaultKPosition();
    rebuild(true);
    setDrawingZoom(window.innerWidth<=760?'step':'fit');
    updateMobileSummary();
    requestAnimationFrame(()=>{
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
      if(paper)focusVisibleDrawing();
    });
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
    if(def.type==='ABC') return s+'('+Object.keys(def.points||{}).join('')+')';
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
    const details=$('problemDetails');
    if(details){
      const displayMode=(window.innerWidth||1024)<=760?'mobile':'desktop';
      if(details.dataset.displayMode!==displayMode){
        details.open=displayMode==='desktop';
        details.dataset.displayMode=displayMode;
      }
      details.hidden=false;
    }
    if(!state.task || state.task<=3){
      box.hidden=true;
      if(details)details.hidden=true;
      return;
    }
    const stored=getStoredTaskData()||{};
    const scheme=state.variant==='custom'
      ? state.customSchemes[state.task]
      : (window.SITEMATH_SCHEMES?.[state.variant]?.['task'+state.task]);
    if(!scheme){
      box.hidden=true;
      if(details)details.hidden=true;
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
      const givenName=scheme.givenLine==='f'?'f':'ℓ';
      given='пл. '+plane+'; прямая '+givenName;
      find='K = '+givenName+' ∩ '+plane+'; видимость '+givenName;
    } else {
      const a=notations[0]||planeDefNotation(scheme.planeA,'Σ');
      const b=notations[1]||planeDefNotation(scheme.planeB,'Θ');
      const through=scheme.pointLabel||'K';
      given='пл. '+a+'; пл. '+b+'; т. '+through;
      find='r = '+a+' ∩ '+b+'; через '+through+' провести ℓ ∥ обеим плоскостям';
    }
    const givenLabel=box.querySelector('.problem-brief-row span');
    // "Дано" must contain the paper condition only. Put source/precision
    // status in the dedicated warning and provenance sections instead.
    if(givenLabel) givenLabel.textContent='Дано ';
    $('problemGiven').textContent=given;
    $('problemFind').textContent=find;
    box.hidden=false;
  }

  function coordinateLabelsForTask(task){
    if(task===1 && DATA.variants[state.variant]?.task1Mode==='pyramid')
      return ['S','A','B','C'];
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

  function sourceCorrectionMax(scheme){
    // The archived trace records the photographed geometry before relations
    // were regularized for the mathematical solver. A large correction means
    // the displayed source still needs manual re-tracing from the sheet.
    if(!scheme?.sourceGeometry)return 0;
    let max=0;
    const compare=(raw,clean)=>{
      if(typeof raw==='number' && typeof clean==='number'){
        if(Number.isFinite(raw)&&Number.isFinite(clean)) max=Math.max(max,Math.abs(raw-clean));
      } else if(Array.isArray(raw)&&Array.isArray(clean)){
        raw.forEach((value,i)=>{if(i<clean.length)compare(value,clean[i]);});
      } else if(raw&&clean&&typeof raw==='object'&&typeof clean==='object'){
        Object.keys(raw).forEach(key=>{
          if(key!=='sourceGeometry' && Object.prototype.hasOwnProperty.call(clean,key)){
            compare(raw[key],clean[key]);
          }
        });
      }
    };
    compare(scheme.sourceGeometry,scheme);
    return max;
  }

  function sourceIntersectionProjectorGap(scheme){
    // Intersecting space lines must have coincident x coordinates for their
    // intersection in the two projections. Large disagreement in the raw
    // photograph trace makes automatic reconciliation unreliable.
    const source=scheme?.sourceGeometry||scheme;
    const defGap=def=>{
      if((def?.planeType||def?.type)!=='intersecting_lines')return 0;
      const names=def.planeLines||Object.keys(def.lines||{}).slice(0,2);
      const A=def.lines?.[names[0]],B=def.lines?.[names[1]];
      if(!A||!B)return 0;
      const xHit=(a,b)=>{
        const [p,q]=a,[r,t]=b;
        const den=(p[0]-q[0])*(r[1]-t[1])-(p[1]-q[1])*(r[0]-t[0]);
        if(Math.abs(den)<1e-9)return null;
        return ((p[0]*q[1]-p[1]*q[0])*(r[0]-t[0])-
          (p[0]-q[0])*(r[0]*t[1]-r[1]*t[0]))/den;
      };
      const x1=xHit(A.p1,B.p1),x2=xHit(A.p2,B.p2);
      if(x1===null||x2===null)return Infinity;
      return Number.isFinite(x1)&&Number.isFinite(x2)?Math.abs(x1-x2):Infinity;
    };
    return Math.max(defGap(source),defGap(source?.planeA),defGap(source?.planeB));
  }

  function renderInputs(){
    const task=state.task;
    const holder=$('dynamicInputs');
    const v=currentVariant();
    const stored=getStoredTaskData();
    $('taskName').textContent = task + '. ' +
      (task===1 && v?.task1Mode==='pyramid' ? 'Пирамида SABC' : DATA.tasks[task].title);
    const currentScheme = task>3 && state.variant!=='custom'
      ? window.SITEMATH_SCHEMES?.[state.variant]?.['task'+task] : null;
    const disputedSource = !!currentScheme && currentScheme.sourceVerified!==true;
    // These two tasks use deliberately reconstructed, recognisable teaching
    // geometry. The raw scan is still retained, but it is no longer used as
    // the geometry of the step-by-step construction.
    const adaptedSource=!!currentScheme?.adaptedSource;
    const rasterPrecisionLimit = !adaptedSource && ((state.variant==='12' && task===6) ||
      (state.variant==='13' && task===5));
    const recoveredSource = currentScheme?.sourceAvailable===true;
    const hasArchivedSheet = window.SITEMATH_SCHEMES?.[state.variant]?.task4?.sourceAvailable===true;
    const warning=$('diagramWarning');
    if(warning){
      warning.hidden=task<=3;
      if(task>3){
        const heading=warning.querySelector('b');
        const detail=warning.querySelector('span');
        if(heading) heading.textContent=adaptedSource
          ? 'Учебная реконструкция исходной схемы.'
          : rasterPrecisionLimit
          ? 'Метод проверен, но точное положение результата по скану неизвестно.'
          : disputedSource
          ? (recoveredSource ? 'Исходный лист восстановлен. Проверяется точность построения.' : 'Исходное условие НЕ проверено по бумажному оригиналу.')
          : 'Построение сверено с оригиналом.';
        if(detail) detail.textContent=adaptedSource
          ? 'Исходный рисунок аккуратно изменён для выполнимого построения: сохранены типы прямых, узлы пересечений, основные пропорции и узнаваемый силуэт. Это адаптированная схема, а не точная копия скана университета. Оригинальный лист доступен по ссылке ниже.'
          : rasterPrecisionLimit
          ? (task===5
            ? 'Исходное условие задано графически, без координат. Линии и метод построения сверены с оригинальным альбомом. Прямая ℓ почти параллельна плоскости Σ: небольшая погрешность наклона штриха может переместить точку пересечения на тысячи единиц и даже на другую сторону рисунка. Показанная точка получена из конкретной оцифровки и не является точным результатом исходного листа.'
            : 'Исходное условие задано графически, без координат. Линии и метод построения сверены с оригинальным альбомом. Плоскости почти параллельны, поэтому их общая прямая проходит далеко от исходного рисунка. Её точное положение чувствительно к погрешности чтения штрихов; экранные координаты не заданы в условии.')
          : disputedSource
          ? (recoveredSource
            ? 'Полный скан бумажного листа доступен по ссылке ниже. Исходные условия сверяются с ним; правильность вспомогательных построений и результатов ещё проверяется.'
            : 'Исходная геометрия и формулировка могут отличаться от бумажного листа. Не используй предварительную схему без сверки.')
          : 'Исходный рисунок, последовательность вспомогательных построений и геометрический результат проверены по оригиналу.';
      }
    }
    $('variantNote').textContent = state.variant==='custom'
      ? 'Ручной режим – исходную разметку пользователь задаёт самостоятельно.'
      : task<=3
        ? (hasArchivedSheet
          ? 'Исходный лист ' + variantDisplayLabel(state.variant) + ' доступен для сверки координат.'
          : 'Координаты сохранены из архивной записи ' + variantDisplayLabel(state.variant) + '; бумажный оригинал сейчас недоступен для повторной сверки.')
        : adaptedSource
          ? 'Учебная схема '+variantDisplayLabel(state.variant)+' реконструирована по оригинальному рисунку. Все построения относятся к реконструкции, а скан сохранён для сравнения.'
          : rasterPrecisionLimit
          ? 'Метод построения проверен; точный результат ограничен погрешностью исходного растрового листа '+variantDisplayLabel(state.variant)+'.'
          : disputedSource
          ? (recoveredSource
            ? 'Исходный лист '+variantDisplayLabel(state.variant)+' найден; правильность методики ещё проверяется.'
            : 'НЕ ПРОВЕРЕНО: условие и исходные данные ' + variantDisplayLabel(state.variant) + ' могут быть ошибочны.')
          : (v && v.provisionalNumber
            ? 'Этот лист временно помечен как вариант 18. Если найдётся другой подтверждённый вариант 18, номер будет исправлен.'
            : 'Исходные данные и построение сверены с доступным оригиналом ' + variantDisplayLabel(state.variant) + '.');

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
      holder.innerHTML=html+(hasArchivedSheet && state.variant!=='custom'
        ? '<p class="hint"><a href="./source-photos/scans/variant-'+esc(state.variant)+'.jpg" target="_blank" rel="noopener noreferrer">Открыть скан исходного листа варианта '+esc(state.variant)+'</a></p>'
        : '');
      $('solverMode').textContent='точный расчёт';
      $('intersectionChoice').hidden = task!==3;
      $('taskStatement').textContent = task===1
        ? (v?.task1Mode==='pyramid'
          ? v.task1Statement
          : 'По заданным координатам построить комплексный чертёж и наглядное изображение точек в системе трёх плоскостей проекций.')
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
                knownScheme.adaptedSource
                  ? 'учебная реконструкция оригинала. Сохраняет характерные элементы рисунка, но намеренно отличается наклонами прямых.'
                  : knownScheme.sourceVerified && knownScheme.sourceId
                  ? 'повторно сверено с доступным исходным листом.'
                  : rasterPrecisionLimit && knownScheme.sourceId && knownScheme.sourceAvailable
                    ? 'исходный лист и метод построения проверены; далёкое пересечение чувствительно к погрешности графического оригинала.'
                    : knownScheme.sourceId && knownScheme.sourceAvailable
                    ? 'исходный лист восстановлен. Точная геометрия и методика пошагового решения ещё проходят сверку.'
                    : knownScheme.sourceId
                      ? 'сохранена трассировка исходного рисунка, но сам лист сейчас недоступен для повторной визуальной сверки.'
                    : knownScheme.sourceVerified
                      ? 'перенесено с фото ранее; исходный файл сейчас недоступен для повторной точной сверки.'
                      : 'Исходный скан пока недоступен; условие и решение требуют проверки по оригиналу.'
              )+'</p>'+
              (knownScheme.sourceAvailable && knownScheme.sourceId
                ? '<p><b>Исходный лист:</b> <a href="./'+esc(knownScheme.sourceId)+'" target="_blank" rel="noopener noreferrer">Открыть скан варианта '+esc(state.variant)+'</a> для проверки исходных точек и линий.</p>'
                : '')+
              (state.variant==='06' && task===4
                ? '<p><b>Исправление по оригиналу:</b> верхняя фронтальная прямая – n₂, нижняя – m₂. Проекции m₁/n₁ сохранены. Исходные точки D и A совпадают с листом.</p>'
                : '')+
              (sourceCorrectionMax(knownScheme)>5&&!knownScheme.adaptedSource
                ? '<p><b>Требуется сверка:</b> исходная трассировка и математически выправленная схема отличаются до '+
                  fmt(sourceCorrectionMax(knownScheme),1)+
                  ' условных единиц. Точное совпадение чертежа с листком не подтверждено.</p>'
                : '')+
              (sourceIntersectionProjectorGap(knownScheme)>30&&!knownScheme.adaptedSource
                ? '<p><b>Требуется проверка пересечения:</b> в исходной трассировке проекции пересекающихся прямых не определяют одну общую линию связи. Автоматически выправленный чертёж необходимо сверить с листком.</p>'
                : '')+
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
    const pyramid=names.length===4 && ['S','A','B','C'].every(n=>names.includes(n));
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
    const axScale=.52;
    const ex={x:-.78*axScale,y:.44*axScale};
    const ey={x:.78*axScale,y:.44*axScale};
    const ez={x:0,y:-1*axScale};
    // The axonometric picture is an explanatory view, not a fixed source
    // coordinate. Move only this free view, leaving at least 12 mm between it
    // and the Monge fields. The old unconditional +110 mm reservation made
    // nearly all task-1 variants needlessly shrink from 1:1 to 1:2 on A4.
    const leftmostAx=Math.min(0,...names.map(n=>{
      const p=coords[n];
      return Math.min(ex.x*p.x,ex.x*p.x+ey.x*p.y,
        ex.x*p.x+ey.x*p.y+ez.x*p.z);
    }));
    const axGap=Math.max(32,12-leftmostAx);
    const axOrigin={x:complexWidth+axGap,y:Math.max(70,O.y)};
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
    // Keep the entire coordinate-construction path on the paper, not just
    // its final vertex. Unlike a radial O–P guide, the three projected
    // components are lines a student can reproduce using the axonometric axes.
    const axGuides={};
    const axPoints=[axOrigin];
    names.forEach(name=>{
      const p=coords[name];
      const X=add2(axOrigin,mul2(ex,p.x));
      const XY=add2(X,mul2(ey,p.y));
      axGuides[name]=[axOrigin,X,XY,ax[name].p];
      axPoints.push(X,XY,ax[name].p);
    });
    const allPts=raw.map(p=>shiftPoint(p,dx,dy)).concat(axPoints);
    const bb=bounds(allPts,18);
    const width=Math.max(complexWidth+28,bb.maxX+10);
    const height=ceilToGrid(Math.max(frame.height,bb.maxY+10,145));

    const steps=[];
    const push=(meta,entities,tool)=>steps.push(Object.assign({},meta,{entities:entities||[],tool:tool||null}));

    push({
      title:'Разметь три плоскости проекций',
      action:'Отметь начало O, проведи через него горизонтальную и вертикальную оси. В верхнем левом поле будет Π₂, в нижнем – Π₁, справа – профильная Π₃.',
      why:'Один и тот же объект показывают с трёх сторон: на Π₁ используются координаты x и y, на Π₂ – x и z, на Π₃ – y и z.',
      measure:['Сетка: 5 мм = 1 клетка','Оси строятся под 90°'],
      check:'Оси пересекаются в O под прямым углом. Π₂ находится над горизонтальной осью, Π₁ – под ней.',
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

    // This paper has a different assignment 1: construct the pyramid SABC,
    // not five unrelated points. Draw every base/lateral edge in all three
    // Monge views, then in the same axonometric model as the four vertices.
    const edges=pyramid
      ? [['A','B'],['B','C'],['C','A'],['S','A'],['S','B'],['S','C']]
      : [];
    const faces=pyramid
      ? [['A','B','C'],['S','A','B'],['S','B','C'],['S','C','A']]
      : [];
    function isVisiblePyramidEdge(a,b,observer){
      if(!pyramid)return true;
      const center={x:0,y:0,z:0};
      for(const p of Object.values(coords)){
        center.x+=p.x/4;center.y+=p.y/4;center.z+=p.z/4;
      }
      const xyz=(from,to)=>({
        x:to.x-from.x,y:to.y-from.y,z:to.z-from.z
      });
      const cross3=(u,v)=>({
        x:u.y*v.z-u.z*v.y,
        y:u.z*v.x-u.x*v.z,
        z:u.x*v.y-u.y*v.x
      });
      const dot3=(u,v)=>u.x*v.x+u.y*v.y+u.z*v.z;
      return faces.some(face=>{
        if(!face.includes(a)||!face.includes(b))return false;
        const A=coords[face[0]],B=coords[face[1]],C=coords[face[2]];
        const n=cross3(xyz(A,B),xyz(A,C));
        const mid={x:(A.x+B.x+C.x)/3,y:(A.y+B.y+C.y)/3,
          z:(A.z+B.z+C.z)/3};
        const outward=dot3(n,xyz(mid,center))>0?-1:1;
        return outward*dot3(n,observer)>1e-7;
      });
    }

    // The professor's Topic 7 specifies parentheses around hidden surface
    // points. This is a DISPLAY convention, not a change to point identity:
    // keep the canonical data-label and geometric coordinates untouched.
    const pyramidProjectedPoint=(step,P,name,suffix,cls)=>{
      const item=point(step,P,name+suffix,cls);
      const eye=suffix==='₁'?{x:0,y:0,z:1}
        :suffix==='₂'?{x:0,y:1,z:0}:{x:1,y:0,z:0};
      if(pyramid&&!isVisiblePyramidEdge(name,name,eye))
        item.visualLabel='('+item.label+')';
      return item;
    };

    // Do not print the same coordinate at an already labelled projection.
    // These are annotation-only choices: all point and projector geometry stays.
    const labelledXDimensions=new Set();
    const labelledYFeet=new Set(),labelledZFeet=new Set();
    const occupiedProfileFeet=new Set();
    names.forEach((name,nameIndex)=>{
      const p=coords[name], q=project[name];
      const xDimNeeded=Math.abs(p.x)>EPS&&!labelledXDimensions.has(p.x);
      labelledXDimensions.add(p.x);
      // A coordinate foot that lands on ANY prescribed projection is
      // already identified by that point's actual label. Keep the guide,
      // but omit its duplicate foot annotation (e.g. 01/1 D₁ or A₂).
      const coincidesWithProjection=foot=>names.some(other=>
        ['p1','p2','p3'].some(key=>dist2(foot,project[other][key])<1e-5));
      // The first y-axis coordinate is part of the student's construction.
      // Do not erase it because some as-yet-unbuilt point will eventually
      // share the same position. Suppress only later duplicate foot labels.
      const yFootNeeded=Math.abs(p.y)>EPS&&Math.abs(p.x)>EPS&&
        !labelledYFeet.has(p.y)&&
        (nameIndex===0||!coincidesWithProjection(q.yFoot));
      if(yFootNeeded)labelledYFeet.add(p.y);
      const zFootNeeded=Math.abs(p.z)>EPS&&Math.abs(p.x)>EPS&&
        Math.abs(p.y)>EPS&&!labelledZFeet.has(p.z)&&
        !coincidesWithProjection(q.zFoot);
      if(zFootNeeded)labelledZFeet.add(p.z);
      const profileFootNeeded=Math.abs(p.y)>EPS&&Math.abs(p.z)>EPS&&
        !occupiedProfileFeet.has(p.y)&&!coincidesWithProjection(q.y3Foot);
      occupiedProfileFeet.add(p.y);
      let i=steps.length;
      push({
        title:'Точка '+name+': задай линию связи по x',
        action:Math.abs(p.x)<EPS
          ? 'Для '+name+' координата x равна нулю: линия связи проходит через O, отступ по оси x не нужен.'
          : 'От O по оси x отложи '+fmt(Math.abs(p.x))+' мм '+(p.x>0?'влево':'вправо')+'. Через отметку проведи вертикальную линию связи.',
        why:'У '+name+'₁ и '+name+'₂ одинаковое положение по x, поэтому обе проекции нужно строить на одной вертикали.',
        measure:['|x| = '+Math.abs(p.x)+' мм = '+cellCount(Math.abs(p.x))],
        check:'Линия связи перпендикулярна оси x₁₂ и проходит через отметку '+fmt(Math.abs(p.x))+' мм от O.',
      },[
        ...(xDimNeeded?[dim(i,O,q.xFoot,Math.abs(p.x)+' мм',
          {x:0,y:-4-8*(nameIndex%3)})]:[]),
        line(i,{x:q.xFoot.x,y:Math.min(q.p1.y,q.p2.y)-5},{x:q.xFoot.x,y:Math.max(q.p1.y,q.p2.y)+5},'construction-line')
      ],{kind:'line',a:O,b:q.xFoot});

      i=steps.length;
      push({
        title:'Построй '+name+'₁ и '+name+'₂',
        action:coordinateYZ(name,p),
        why:'Положение '+name+'₁ задаёт координата y, а '+name+'₂ – высота z. Обе величины отсчитываются от одной оси x₁₂.'+(pyramid?' Если вершина на виде скрыта гранью пирамиды, её обозначение показано в скобках.':''),
        measure:[
          '|y| = '+Math.abs(p.y)+' мм = '+cellCount(Math.abs(p.y)),
          '|z| = '+Math.abs(p.z)+' мм = '+cellCount(Math.abs(p.z))
        ],
        check:'Линейкой измерь расстояния от x₁₂: до '+name+'₁ должно быть '+fmt(Math.abs(p.y))+' мм, до '+name+'₂ – '+fmt(Math.abs(p.z))+' мм.',
      },[
        line(i,q.yFoot,q.p1,'construction-line'),
        line(i,q.zFoot,q.p2,'construction-line'),
        ...(yFootNeeded?[point(i,q.yFoot,'y₁='+signedCoord(p.y),'construction-dot')]:[]),
        ...(zFootNeeded?[point(i,q.zFoot,'z='+signedCoord(p.z),'construction-dot')]:[]),
        pyramidProjectedPoint(i,q.p1,name,'₁'),
        pyramidProjectedPoint(i,q.p2,name,'₂'),
        dim(i,q.xFoot,q.p1,Math.abs(p.y)+' мм',{x:3,y:0}),
        dim(i,q.xFoot,q.p2,Math.abs(p.z)+' мм',{x:-3,y:0})
      ]);

      i=steps.length;
      push({
        title:'Дострой профильную проекцию '+name+'₃',
        action:coordinateProfile(name,p),
        why:'На профильной проекции нужны только y и z. Поэтому '+name+'₃ должна иметь ту же высоту, что '+name+'₂.'+(pyramid?' Невидимую вершину пирамиды отмечаем обозначением в скобках.':''),
        measure:[
          '|y| = '+Math.abs(p.y)+' мм по профильной оси',
          '|z| = '+Math.abs(p.z)+' мм по вертикали'
        ],
        check:'Горизонтальная линия от '+name+'₂ проходит через '+name+'₃. Расстояние от вертикальной оси профильного вида через O до '+name+'₃ по горизонтали – '+fmt(Math.abs(p.y))+' мм.',
      },[
        line(i,q.yFoot,q.y3Foot,'construction-line'),
        line(i,q.y3Foot,q.p3,'construction-line'),
        line(i,q.zFoot,q.p3,'construction-line'),
        ...(profileFootNeeded?[point(i,q.y3Foot,'y₃='+signedCoord(p.y),'construction-dot')]:[]),
        pyramidProjectedPoint(i,q.p3,name,'₃','answer-dot')
      ],{kind:'line',a:q.zFoot,b:q.p3});
    });

    if(pyramid){
      const views=[
        ['₁','p1',{x:0,y:0,z:1},'горизонтальной Π₁'],
        ['₂','p2',{x:0,y:1,z:0},'фронтальной Π₂'],
        ['₃','p3',{x:1,y:0,z:0},'профильной Π₃']
      ];
      views.forEach(([suffix,key,eye,plane])=>{
        const at=steps.length;
        const strokes=edges.map(([a,b])=>{
          const a2=project[a][key],b2=project[b][key];
          if(Math.hypot(a2.x-b2.x,a2.y-b2.y)<1e-7)return null;
          return {a,b,visible:isVisiblePyramidEdge(a,b,eye),
            p1:a2,p2:b2};
        }).filter(Boolean).sort((a,b)=>Number(a.visible)-Number(b.visible));
        push({
          title:'Соедини рёбра пирамиды на '+plane,
          action:'Соедини A'+suffix+'B'+suffix+', B'+suffix+'C'+suffix+
            ', C'+suffix+'A'+suffix+' и вершину S'+suffix+
            ' с A'+suffix+', B'+suffix+', C'+suffix+
            '. Невидимые рёбра обозначь штриховой линией.',
          why:'Рёбра SABC связывают четыре заданные пространственные точки; их одноимённые проекции образуют пирамиду.',
          measure:['Четыре вершины: S, A, B, C','Шесть пространственных рёбер'],
          check:'Каждое ребро соединяет проекции одной и той же пары вершин.'
        },strokes.map(e=>line(at,e.p1,e.p2,
          e.visible?'answer-line':'hidden-line')),
        strokes.length?{kind:'line',a:strokes[0].p1,b:strokes[0].p2}:null);
      });
    }

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
      const path=axGuides[name];
      for(let j=0;j<3;j++)
        if(dist2(path[j],path[j+1])>EPS)
          axEntities.push(line(i,path[j],path[j+1],'construction-line',
            {axonometricGuide:true}));
    });
    if(pyramid){
      const eye={x:1,y:1,z:1};
      const strokes=edges.map(([a,b])=>({a,b,
        visible:isVisiblePyramidEdge(a,b,eye)}))
        .sort((a,b)=>Number(a.visible)-Number(b.visible));
      strokes.forEach(({a,b,visible})=>axEntities.push(
        line(i,ax[a].p,ax[b].p,visible?'answer-line':'hidden-line')
      ));
    }
    names.forEach(name=>axEntities.push(point(i,ax[name].p,name,'answer-dot')));
    push({
      title:pyramid?'Построй наглядное изображение пирамиды SABC':'Построй наглядное изображение точек',
      action:pyramid
        ? 'На трёх аксонометрических осях построй вершины S, A, B, C по координатам: от O откладывай x, от полученной точки – y параллельно оси y, затем z параллельно оси z. После этого соедини A–B–C–A и S с A, B, C; невидимые рёбра покажи штриховыми.'
        : 'На отдельном поле проведи оси x, y, z. Для каждой точки последовательно отложи её координаты: от O по направлению x, затем от полученной точки параллельно y и после этого параллельно z. Нулевую координату пропускай. Положительные координаты откладывай по направлению оси, отрицательные – против него. Конец последнего отрезка обозначь именем точки.',
      why:pyramid
        ? 'По трём координатным составляющим можно построить каждую вершину пирамиды. Соединение этих вершин даёт её шесть пространственных рёбер.'
        : 'Три последовательных перемещения вдоль направлений x, y, z приводят к той же пространственной точке, координаты которой даны в условии.',
      measure:['Наглядный вид выполнен в условном аксонометрическом масштабе, а не в миллиметрах исходных осей.','Сохраняй направления и пропорции составляющих, показанные на рисунке. Короткие тонкие штрихи могут немного выходить за точки перегиба.'],
      check:pyramid
        ? 'У каждой вершины построены составляющие x, y, z; основание имеет рёбра AB, BC, CA, а боковые рёбра – SA, SB, SC. Скрытые части показаны штриховой линией.'
        : 'Каждый проведённый направляющий отрезок параллелен своей аксонометрической оси; при нулевой координате такого отрезка нет. Конечная отметка совпадает с подписью точки.'
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
      ...(Math.abs(p1.y-O.y)>EPS?[point(step,yFoot,name+'ᵧ','construction-dot')]:[]),
      ...(Math.abs(p2.y-O.y)>EPS?[point(step,zFoot,name+'𝓏','construction-dot')]:[])
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
      action:'Проведи горизонтальную ось x₁₂. Над ней размести фронтальные проекции (Π₂), под ней – горизонтальные (Π₁).',
      why:'Для натуральной длины AB понадобятся обе проекции отрезка и два прямоугольных треугольника.',
      measure:['1 клетка = 5 мм'],
      check:'Ось x₁₂ горизонтальна; положительное z откладывается вверх, положительное y – вниз. Отрицательные координаты откладывай в обратном направлении.',
    },twoPlaneAxisEntities(i,q.O,width,height),{kind:'line',a:{x:8,y:q.O.y},b:{x:width-8,y:q.O.y}});

    i=steps.length;
    push({
      title:'Построй проекции точки A',
      action:coordinatePlacement('A',A),
      why:'На одной вертикали получаются A₁ по координате y и A₂ по координате z.',
      measure:['xA = '+A.x+' мм','yA = '+A.y+' мм','zA = '+A.z+' мм'],
      check:'Проверь линейкой отступы от x₁₂: |y(A)| = '+fmt(Math.abs(A.y))+' мм, |z(A)| = '+fmt(Math.abs(A.z))+' мм. Оба положения относятся к одному x.',
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
      action:coordinatePlacement('B',B),
      why:'Для B используется тот же порядок, что и для A: сначала общая линия связи, затем оба расстояния от x₁₂.',
      measure:['xB = '+B.x+' мм','yB = '+B.y+' мм','zB = '+B.z+' мм'],
      check:'От x₁₂ до B₁ – '+fmt(Math.abs(B.y))+' мм, до B₂ – '+fmt(Math.abs(B.z))+' мм. Линия связи одна для обеих проекций.',
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
      check:'Убедись, что проведены именно A₁B₁ и A₂B₂. Длины проекций: '+fmt(L1)+' и '+fmt(L2)+' мм соответственно.',
    },[line(i,q.A1,q.B1,'object-line'),line(i,q.A2,q.B2,'object-line')]);

    i=steps.length;
    push({
      title:'Первый прямоугольный треугольник – на Π₁',
      action:Math.abs(dz3)<EPS
        ? 'Разность высот равна нулю, поэтому A₀ совпадает с A₁. Проекция A₁B₁ уже показывает натуральную длину AB.'
        : 'Из A₁ угольником проведи перпендикуляр к A₁B₁. Отложи на нём '+fmt(Math.abs(dz3))+' мм до A₀ и соедини A₀ с B₁.',
      why:'Катеты A₁B₁ и |zB−zA| взаимно перпендикулярны. Гипотенуза B₁A₀ равна натуральной величине AB.',
      measure:['|Δz| = '+fmt(Math.abs(dz3))+' мм = '+cellCount(Math.abs(dz3)),'НВ AB = '+fmt(L)+' мм','α = '+fmt(alpha)+'°'],
      check:Math.abs(dz3)<EPS
        ? 'Поскольку Δz = 0, натуральная длина равна A₁B₁ = '+fmt(L)+' мм.'
        : 'Прямой угол должен быть у A₁, гипотенуза B₁A₀ – '+fmt(L)+' мм.',
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
      action:Math.abs(dy3)<EPS
        ? 'Расстояния A и B от Π₂ одинаковы: B₀ совпадает с B₂. Отрезок A₂B₂ уже имеет натуральную длину AB.'
        : 'Из B₂ угольником проведи перпендикуляр к A₂B₂, отложи на нём '+fmt(Math.abs(dy3))+' мм до B₀ и соедини B₀ с A₂.',
      why:'Теперь второй катет – разность удалений точек от Π₂. Полученная гипотенуза снова равна AB, что даёт независимую проверку.',
      measure:['|Δy| = '+fmt(Math.abs(dy3))+' мм = '+cellCount(Math.abs(dy3)),'НВ AB = '+fmt(L)+' мм','β = '+fmt(beta)+'°'],
      check:Math.abs(dy3)<EPS
        ? 'При Δy = 0 длина A₂B₂ должна быть '+fmt(L)+' мм, как и у первой гипотенузы.'
        : 'Измерь A₂B₀ и B₁A₀. Оба отрезка должны иметь длину '+fmt(L)+' мм.',
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
      check:'Угол α измеряется между A₁B₁ и B₁A₀ при B₁, угол β – между A₂B₂ и A₂B₀ при A₂. Натуральная длина по обоим построениям: '+fmt(L)+' мм.',
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
      check:'Проверь направление угольником: x₁₂ горизонтальна, а последующие линии связи будут к ней перпендикулярны.',
    },twoPlaneAxisEntities(i,O,width,height),{kind:'line',a:{x:8,y:O.y},b:{x:width-8,y:O.y}});

    [['A',A,q.A1,q.A2,q.Ax],['B',B,q.B1,q.B2,q.Bx],['C',C,q.C1,q.C2,q.Cx]].forEach(row=>{
      const name=row[0],p=row[1],p1=row[2],p2=row[3],px=row[4];
      let j=steps.length;
      push({
        title:'Построй проекции точки '+name,
        action:coordinatePlacement(name,p),
        why:'Обе проекции точки '+name+' имеют общий x, но разные расстояния от оси: y для Π₁ и z для Π₂.',
        measure:['|x| '+Math.abs(p.x)+' мм','|y| '+Math.abs(p.y)+' мм','|z| '+Math.abs(p.z)+' мм'],
        check:'Обе проекции стоят на одном проекторе, перпендикулярном x₁₂. От оси до них отложены '+fmt(Math.abs(p.y))+' и '+fmt(Math.abs(p.z))+' мм.',
      },[
        dim(j,O,px,Math.abs(p.x)+' мм',{x:0,y:-3}),
        line(j,px,p1,'construction-line'),
        line(j,px,p2,'construction-line'),
        ...coordinateGuideEntities(j,O,name,p1,p2),
        ...(dist2(px,p1)>EPS&&dist2(px,p2)>EPS
          ?[point(j,px,name+'ₓ','construction-dot')]:[]),
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
      check:'На Π₁ соединены A₁ и B₁, на Π₂ – A₂ и B₂. Расстояния x для парных проекций не изменились.',
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
      action:a1?'Приложи угольник к A₁B₁, сдвинь его вдоль линейки до C₁ и проведи a₁.':'A₁B₁ выродилась в точку – у a₁ будет точечная проекция C₁.',
      why:'У параллельных пространственных прямых одноимённые проекции параллельны.',
      measure:[a1?'a₁ ∥ A₁B₁':'точечная проекция'],
      check:a1?'После переноса угольника направление a₁ совпадает с направлением A₁B₁, а сама a₁ проходит через C₁.':'Точечная проекция a₁ находится в C₁.'
    },ae,a1?{kind:'line',a:a1.a,b:a1.b}:null);

    i=steps.length;
    const ae2=[];
    if(a2) ae2.push(line(i,a2.a,a2.b,'answer-line'));
    else ae2.push(point(i,q.C2,'a₂≡C₂','answer-dot'));
    push({
      title:'Проведи a₂ через C₂ параллельно A₂B₂',
      action:a2?'На Π₂ сдвинь угольник от A₂B₂ до C₂ и проведи a₂ с тем же направлением.':'A₂B₂ выродилась в точку – a₂ совпадает с C₂.',
      why:'Обе проекции вместе задают пространственную прямую a, параллельную AB.',
      measure:[a2?'a₂ ∥ A₂B₂':'точечная проекция'],
      check:'Проверь угольником отдельно a₁ ∥ A₁B₁ и a₂ ∥ A₂B₂. Обе прямые a проходят через соответствующие проекции C.',
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
          action:'Измерь A₁B₁ и отложи от A₁ к B₁ '+fmt(dist2(q.A1,q.K1))+' мм – это '+frac+'% отрезка. Отметь K₁.',
          why:'Условие не фиксирует точку пересечения. Любая внутренняя точка K отрезка AB даёт корректное решение.',
          measure:['A₁K₁/A₁B₁ = '+frac+'%','A₁K₁ ≈ '+fmt(dist2(q.A1,q.K1))+' мм'],
          check:'Измерь A₁K₁: должно получиться '+fmt(dist2(q.A1,q.K1))+' мм; K₁ находится между A₁ и B₁.',
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
      check:'Общие точки пересечения на Π₁ и Π₂ лежат на одном проекторе K₁K₂; a₁ ∥ A₁B₁ и a₂ ∥ A₂B₂.',
    },le2,l2?{kind:'line',a:l2.a,b:l2.b}:null);

    // Auxiliary parallel/intersection lines may extend well beyond the
    // original A/B/C point envelope. Reframe the COMPLETE drawing before
    // selecting A4 orientation, otherwise those legitimate strokes can fall
    // outside the real page even when the initial points fit.
    const pageBounds=normalizeSteps(steps,width,height);
    return {width:pageBounds.width,height:pageBounds.height,
      O:shiftPoint(O,pageBounds.shift.x,pageBounds.shift.y),steps};
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
    if(!Array.isArray(seg)||seg.length!==2||!P)return [];
    // Source lines use [[x,y],[x,y]], while computed section lines use
    // [{x,y},{x,y}]. Both must produce valid pencil-extension endpoints.
    const s=seg.map(p=>Array.isArray(p)
      ? {x:Number(p[0]),y:Number(p[1])}
      : {x:Number(p?.x),y:Number(p?.y)});
    const a=s[0],b=s[1];
    if(![a.x,a.y,b.x,b.y,P.x,P.y].every(Number.isFinite))return [];
    const d=vec2(a,b),dd=d.x*d.x+d.y*d.y;
    if(dd<EPS)return [];
    const ap=vec2(a,P);
    const t=(ap.x*d.x+ap.y*d.y)/dd;
    // A point even slightly beyond the printed segment requires a real
    // construction continuation. A former 1% parametric tolerance silently
    // suppressed short but necessary strokes (05/5, K₁ beyond ℓ₁ by 0.78).
    if(t>=0&&t<=1)return [];
    const end=t<0?a:b;
    if(dist2(end,P)<.5)return [];
    // A continuation to an intersection is a real geometric segment.
    // Keep its original endpoints in the solver and mark its drawing-only
    // overrun separately so sub-2mm strokes remain pencil-legible on A4.
    return [line(step,end,P,cls||'construction-line',{sourceContinuation:true})];
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
    steps.forEach(st=>{
      (st.entities||[]).forEach(e=>collectEntityPoints(e,pts));
      (st.sourceEntities||[]).forEach(e=>collectEntityPoints(e,pts));
      if(st.tool){
        if(st.tool.a)pts.push(st.tool.a);
        if(st.tool.b)pts.push(st.tool.b);
      }
    });
    const good=pts.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    const minimumW=minimumWidth||180,minimumH=minimumHeight||145,margin=18;
    if(!good.length)return {width:minimumW,height:minimumH,shift:{x:0,y:0},scale:1};
    const minX=Math.min(...good.map(p=>p.x)),maxX=Math.max(...good.map(p=>p.x));
    const minY=Math.min(...good.map(p=>p.y)),maxY=Math.max(...good.map(p=>p.y));
    const dx=margin-minX,dy=margin-minY;
    steps.forEach(st=>{
      (st.entities||[]).forEach(e=>shiftEntity(e,dx,dy));
      (st.sourceEntities||[]).forEach(e=>shiftEntity(e,dx,dy));
      if(st.tool){
        if(st.tool.a)st.tool.a=shiftPoint(st.tool.a,dx,dy);
        if(st.tool.b)st.tool.b=shiftPoint(st.tool.b,dx,dy);
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

  function starterEntitiesFromScheme(scheme,step,exactSource){
    // Raw original is rendered only at step zero; the later solver trace is
    // geometrically regularized without mutating photographed coordinates.
    const src=scheme;
    const out=[];
    Object.entries(src.lines||{}).forEach(([name,L])=>{
      // The original given line is displayed in full until visibility is
      // constructed. At the final step it must be replaced by the visible and
      // hidden segments, rather than remain solid behind their dash gaps.
      const marker=src.givenLine===name?{sourceGivenLine:true}:null;
      out.push(line(step,{x:L.p2[0][0],y:L.p2[0][1]},{x:L.p2[1][0],y:L.p2[1][1]},'object-line',marker));
      out.push(textEntity(step,sourceLineLabelPoint(src,name,'p2',L),sourceLineDisplayName(name)+'₂','svg-label'));
      out.push(line(step,{x:L.p1[0][0],y:L.p1[0][1]},{x:L.p1[1][0],y:L.p1[1][1]},'object-line',marker));
      out.push(textEntity(step,sourceLineLabelPoint(src,name,'p1',L),sourceLineDisplayName(name)+'₁','svg-label'));
    });
    Object.entries(src.points||{}).forEach(([name,P])=>{
      const q=exactSource?P:normalizedPointRec(P);
      const p2={x:+q.p2[0],y:+q.p2[1]},p1={x:+q.p1[0],y:+q.p1[1]};
      out.push(line(step,p2,p1,'source-guide-line'));
      out.push(point(step,p2,name+'₂'));
      out.push(point(step,p1,name+'₁'));
    });
    if(src.planeType==='ABC' && !src.sourceABCVerticesOnly){
      appendABCPlaneEntities(out,src,step,exactSource);
    }
    (src.sourceGuides||[]).forEach(seg=>{
      if(!Array.isArray(seg)||seg.length!==2) return;
      out.push(line(step,{x:+seg[0][0],y:+seg[0][1]},{x:+seg[1][0],y:+seg[1][1]},'source-guide-line'));
    });
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

  function diagramReferenceAxisStep(push,steps,scheme,task){
    const whyByTask={
      4:'Оси показывают, где находятся горизонтальная и фронтальная проекции. Для дальнейшего построения горизонтали h₂ будет параллельна x₁₂, а фронталь f₁ – параллельна x₁₂. Проекции одной точки соединяются вертикальной линией связи.',
      5:'Для построения пересечения прямой с плоскостью точки переносят между проекциями по вертикальным линиям связи. При определении видимости на Π₁ сравнивают высоты z на Π₂, а для видимости на Π₂ – глубины y на Π₁.',
      6:'Оси нужны, чтобы провести вспомогательные секущие плоскости и перенести полученные общие точки P и Q между проекциями по вертикальным линиям связи. Затем через P и Q строят линию пересечения двух исходных плоскостей.'
    };
    const frame=diagramAxisFromScheme(scheme);
    if(!frame)return null;
    const i=steps.length;
    push({
      title:'Добавь оси к исходной схеме',
      action:'Исходные линии уже перенесены на предыдущем этапе. Теперь проведи x₁₂ горизонтально между видами и вертикальную ось слева от рисунка. Подпиши z выше x₁₂, y ниже неё, верхний вид Π₂ и нижний Π₁. Не сдвигай исходные линии и точки.',
      why:whyByTask[task]||whyByTask[4],
      measure:['x₁₂ – горизонтально','вертикальная ось – слева от схемы','z – вверх, y – вниз'],
      check:'x₁₂ горизонтальна, вертикальная ось слева от схемы перпендикулярна x₁₂. Верхние проекции остаются в Π₂, нижние – в Π₁. Парные исходные проекции не смещены.'
    },diagramReferenceAxisEntities(i,frame),{kind:'line',a:frame.a,b:frame.b});
    return frame;
  }

  function rightAngleMarkEntities(step,P,uRaw,vRaw,size){
    const u=unit2(uRaw),v=unit2(vRaw),s=size||6;
    if(norm2(u)<EPS||norm2(v)<EPS) return [];
    const a=add2(P,mul2(u,s));
    const b=add2(a,mul2(v,s));
    const c=add2(P,mul2(v,s));
    // Keep this paper-only right-angle glyph distinct from the mathematical
    // segments; only its rendered size may change after fitting the A4 sheet.
    const mark={u,v,size:s,
      available:Math.min(norm2(uRaw),norm2(vRaw))};
    return [
      Object.assign(line(step,a,b,'construction-line'),
        {rightAngleMark:{...mark,part:0}}),
      Object.assign(line(step,b,c,'construction-line'),
        {rightAngleMark:{...mark,part:1}})
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
      action:'От '+pointName+'₁ к 1₁ отложи примерно 58% длины уже построенной горизонтали h₁ и отметь 3₁. По ней проведём выбранную фронталь.',
      why:'Фронталей в плоскости бесконечно много. Поэтому сначала явно выбирают одну точку на уже известной линии плоскости, а не ставят сразу две новые точки.',
      measure:['3₁ ∈ h₁'],
      check:'3₁ находится на h₁ между '+pointName+'₁ и 1₁. От '+pointName+'₁ до 3₁ отложено около 58% отрезка '+pointName+'₁1₁.'
    },[
      point(i,three1,'3₁','construction-dot')
    ]);

    i=steps.length;
    push({
      title:'Через 3₁ проведи f₁ ∥ x₁₂ и получи 2₁',
      action:'Через 3₁ проведи f₁ параллельно x₁₂ до пересечения с '+lineName+'₁. Пересечение обозначь 2₁.',
      why:'У фронтали горизонтальная проекция параллельна x₁₂. Теперь 2₁ определяется пересечением с заданной прямой '+lineName+', а не выбирается произвольно.',
      measure:['f₁ ∥ x₁₂','3₁ ∈ h₁','2₁ = f₁ ∩ '+lineName+'₁'],
      check:'f₁ проходит через 3₁ параллельно x₁₂; точка 2₁ находится точно на пересечении f₁ с '+lineName+'₁.'
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
    const planeBasis=scheme.planeType==='ABC'
      ? 'три точки A, B, C'
      : scheme.planeType==='line_point'
        ? 'прямую '+(scheme.planeLine||'a')+' и точку '+(scheme.planePoint||'A')+' вне неё'
        : scheme.planeType==='parallel_lines'
          ? 'параллельные прямые '+(scheme.planeLines||[]).join(' и ')
          : 'пересекающиеся прямые '+(scheme.planeLines||[]).join(' и ');
    const sourceCheck=scheme.planeType==='ABC'
      ?'Точки A₁/A₂, B₁/B₂ и C₁/C₂ соединены попарными вертикальными линиями связи. Три пространственные точки A, B, C не коллинеарны.'
      :scheme.planeType==='line_point'
        ?'Проекции '+scheme.planePoint+'₁ и '+scheme.planePoint+'₂ находятся на одной вертикальной линии связи. Заданная точка '+scheme.planePoint+' не принадлежит прямой '+scheme.planeLine+', показанной проекциями '+scheme.planeLine+'₁ и '+scheme.planeLine+'₂.'
        :scheme.planeType==='parallel_lines'
          ?scheme.planeLines[0]+'₁ ∥ '+scheme.planeLines[1]+'₁ и '+scheme.planeLines[0]+'₂ ∥ '+scheme.planeLines[1]+'₂. Обе пары прямых соответствуют одной плоскости.'
          :scheme.planeLines[0]+'₁ ∩ '+scheme.planeLines[1]+'₁ и '+scheme.planeLines[0]+'₂ ∩ '+scheme.planeLines[1]+'₂. Точки пересечения проекций лежат на одном вертикальном проекторе.';
    // The given point used by the additional task-4 condition belongs to
    // the INITIAL drawing too, not only to the later construction step.
    const givenThrough=scheme.operation?.through;
    const throughIsGiven=typeof givenThrough==='string'&&
      Boolean(scheme.points?.[givenThrough]);
    const throughAction=throughIsGiven
      ? ' Отдельно отметь заданную точку '+givenThrough+
        ' по проекциям '+givenThrough+'₁ и '+givenThrough+
        '₂. Через неё далее построим искомую прямую.'
      : '';
    const throughCheck=throughIsGiven
      ? ' Проекции '+givenThrough+'₁ и '+givenThrough+
        '₂ лежат на одной вертикальной линии связи; исходную точку не перемещай.'
      : '';
    push({
      title:'Найди заданные элементы плоскости '+planeSymbol,
      action:'На исходном листе найди '+planeBasis+'.'+throughAction+
        ' Различи проекции с индексами ₁ и ₂ и заданные линии связи. Новые точки и вспомогательные прямые пока не строй.',
      why:'Это графическое условие: положение и наклон элементов плоскости определены исходными проекциями. Перенос по клеткам не заменяет исходную геометрию.',
      measure:['При переносе сохраняй направление и взаимное положение линий.','Не передвигай заданные точки к ближайшим узлам сетки.'],
      check:sourceCheck+throughCheck
    },starterEntitiesFromScheme(scheme,i));
    if(scheme.sourceGeometry)steps[0].sourceEntities=starterEntitiesFromScheme(scheme.sourceGeometry,0,true);

    const base=plane.P;

    const xAxis=diagramReferenceAxisStep(push,steps,scheme,4);

    // Some original sheets specify a plane by three INDIVIDUAL given point
    // projectors, with no edges pre-drawn. Connect those vertices as distinct
    // pencil steps, never draw extra edges in the paper's initial frame.
    if(scheme.planeType==='ABC' && scheme.sourceABCVerticesOnly){
      const names=['A','B','C'];
      const recs=Object.fromEntries(names.map(n=>[n,normalizedPointRec(scheme.points[n])]));
      const xy=p=>({x:+p[0],y:+p[1]});
      for(const [proj,index] of [['p1','₁'],['p2','₂']]){
        const st=steps.length;
        const links=[['A','B'],['B','C'],['C','A']].map(([a,b])=>
          line(st,xy(recs[a][proj]),xy(recs[b][proj]),'construction-line'));
        push({
          title:'Соедини A'+index+', B'+index+' и C'+index,
          action:'Соедини три уже заданные проекции вершин отрезками '+
            'A'+index+'B'+index+', B'+index+'C'+index+' и C'+index+'A'+index+'.',
          why:'На бумажном оригинале напечатаны только отдельные проекции точек. '+
            'Стороны треугольника не являются исходными штрихами, '+
            'их необходимо явно построить, прежде чем использовать плоскость ABC.',
          measure:['Проведи три прямых отрезка между уже заданными точками, без новых координат.'],
          check:'Концы каждого отрезка совпадают с данными точками; '+
            'новые точки и линии связи на этом шаге не создаются.'
        },links);
      }
    }

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
      const refs=planeReferenceLines(scheme,true);
      const hCut=sourceAnchoredLevelLine(refs,'p2');
      const fCut=sourceAnchoredLevelLine(refs,'p1');
      // Give a reproducible position for a FREE helper point. A percentage
      // along the original printed stroke survives A4 reduction and avoids
      // making the student guess what "convenient" meant in the screenshot.
      const sourcePointHint=(ref,proj,P)=>{
        const seg=ref?.rec?.[proj];
        if(!Array.isArray(seg)||seg.length!==2||!P)
          return 'ориентируясь на отмеченное положение в схеме';
        const a={x:+seg[0][0],y:+seg[0][1]};
        const b={x:+seg[1][0],y:+seg[1][1]};
        const steep=Math.abs(a.x-b.x)<Math.abs(a.y-b.y)*.5;
        const first=steep?(a.y<=b.y?a:b):(a.x<=b.x?a:b);
        const second=first===a?b:a;
        const dx=second.x-first.x,dy=second.y-first.y,den=dx*dx+dy*dy;
        if(!(den>EPS))return 'ориентируясь на отмеченное положение в схеме';
        const ratio=((P.x-first.x)*dx+(P.y-first.y)*dy)/den;
        const origin=steep?'верхнего':'левого';
        const opposite=steep?'нижнего':'правого';
        if(ratio>=0&&ratio<=1)
          return 'примерно на '+Math.round(ratio*100)+'% длины штриха от '+origin+' конца';
        const past=ratio<0?origin:opposite;
        const correctEnd={'левого':'левым','правого':'правым',
          'верхнего':'верхним','нижнего':'нижним'}[past];
        return 'на продолжении штриха за '+correctEnd+' концом';
      };

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
        action:'На исходной '+refs[0].name+'₂ отметь 1₂ '+sourcePointHint(refs[0],'p2',hCut?hPrimary[0]:null)+'. Эта точка задаёт уровень выбранной горизонтали; другую допустимую точку можно взять без изменения условия.',
        why:'Горизонталей в одной плоскости бесконечно много. Поэтому первая точка не вычисляется из условия – её разрешено выбрать, но только на линии, принадлежащей плоскости.',
        measure:['1₂ ∈ '+refs[0].name+'₂'],
        check:'1₂ лежит на '+refs[0].name+'₂. Сверь её положение с выбранным ориентиром: '+sourcePointHint(refs[0],'p2',hCut?hPrimary[0]:null)+'.'
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
        check:'2₂ находится одновременно на h₂ и '+refs[1].name+'₂. Угольником проверь, что h₂ параллельна x₁₂.'
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
        check:'1₁ лежит на '+refs[0].name+'₁ и проекторе из 1₂; 2₁ – на '+refs[1].name+'₁ и проекторе из 2₂. Соедини их без изменения отметок.'
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
        action:'На исходной '+refs[0].name+'₁ отметь 3₁ '+sourcePointHint(refs[0],'p1',fCut?fPrimary[0]:null)+'. По ней построим одну из возможных фронталей данной плоскости.',
        why:'Фронталей в плоскости тоже бесконечно много. Первую точку разрешено выбрать только на линии, принадлежащей плоскости.',
        measure:['3₁ ∈ '+refs[0].name+'₁'],
        check:'3₁ лежит на '+refs[0].name+'₁. Сверь её положение с выбранным ориентиром: '+sourcePointHint(refs[0],'p1',fCut?fPrimary[0]:null)+'.'
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
        check:'4₁ находится на пересечении f₁ и '+refs[1].name+'₁. Угольником проверь, что f₁ параллельна x₁₂.'
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
        check:'3₂ лежит на '+refs[0].name+'₂ и проекторе из 3₁; 4₂ – на '+refs[1].name+'₂ и проекторе из 4₁. Обе точки задают f₂.'
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
          action:'На h₁ отметь S₁ примерно посередине между уже построенными 1₁ и 2₁. Это свободная опорная точка для линии наибольшего ската.',
          why:'Линий наибольшего ската в плоскости можно провести несколько параллельных. Поэтому сначала явно задаётся точка, через которую строится конкретная ЛС.',
          measure:['S₁ ∈ h₁'],
          check:'S₁ находится на h₁ между 1₁ и 2₁. Отрезок 1₁S₁ составляет примерно половину 1₁2₁.'
        },[
          point(i,S1,'S₁','construction-dot')
        ]);

        i=steps.length;
        push({
          title:'Через S₁ проведи ЛС₁ ⟂ h₁ и получи 5₁',
          action:'Через S₁ проведи ЛС₁ перпендикулярно h₁ до пересечения с '+ref.name+'₁. Пересечение обозначь 5₁.',
          why:'Горизонтальная проекция линии наибольшего ската плоскости перпендикулярна горизонтали. Точка 5₁ определяется пересечением с существующей линией плоскости.',
          measure:['ЛС₁ ⟂ h₁','5₁ = ЛС₁ ∩ '+ref.name+'₁'],
          check:'Угольник должен показать прямой угол между ЛС₁ и h₁. Точка 5₁ находится на '+ref.name+'₁.'
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
        check:'Угольником проверь ℓ₁ ∥ h₁ и ℓ₂ ∥ h₂. Новая прямая проходит через заданную точку '+op.through+'.'
      },[
        line(i,a.p1,b.p1,'answer-line'),textEntity(i,b.p1,'ℓ₁','svg-label'),
        line(i,a.p2,b.p2,'answer-line'),textEntity(i,b.p2,'ℓ₂','svg-label')
      ],{kind:'line',a:a.p1,b:b.p1});
    } else if(op.type==='line_intersects_frontale' && through3){
      // T must actually lie on the *constructed* frontale f, not merely
      // on another parallel frontale through an arbitrary base point.
      target3=lerp3(f3[0],f3[1],.58);
      L3=[through3,target3];
      i=steps.length;
      const T=project3(target3),Q=project3(through3);
      push({
        title:'Выбери T₁ на фронтали f₁',
        action:'На построенной f₁ отметь T₁ примерно посередине штриха. Это свободно выбираемая точка: не ставь её на самом конце линии.',
        why:'Чтобы задать конкретную точку T фронтали, сначала достаточно выбрать одну её проекцию на существующей f₁. T₂ нельзя ставить независимо.',
        measure:['T₁ ∈ f₁'],
        check:'T₁ лежит на f₁ около середины уже построенного штриха и не совпадает с его концом.'
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
        action:'На построенной h₂ отметь T₂ примерно посередине штриха. Это свободно выбираемая точка: не ставь её на самом конце линии.',
        why:'Горизонталь уже построена, поэтому конкретную точку T сначала можно выбрать на её фронтальной проекции h₂. T₁ пока не задаётся.',
        measure:['T₂ ∈ h₂'],
        check:'T₂ лежит на выбранной горизонтали. Другую проекцию T нужно получить вертикальным проектором.'
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
        action:'На заданной '+op.target+'₁ отметь T₁ примерно посередине видимого штриха. Точку выбирай свободно, но не на самом конце.',
        why:'Будущая ℓ должна пересечь '+op.target+'. Сначала выбирается одна проекция общей точки T на существующей прямой, а вторая получается по линии связи.',
        measure:['T₁ ∈ '+op.target+'₁'],
        check:'T₁ лежит на '+op.target+'₁ около середины заданного штриха и не совпадает с его концом.'
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
          const depthRelation=op.relation==='behind_line'||op.relation==='front_of_line'||op.relation==='front_of_plane';
          const firstIdx=depthRelation?'₂':'₁';
          const secondIdx=depthRelation?'₁':'₂';
          const firstPos=depthRelation?Ref.p2:Ref.p1;
          const secondPos=depthRelation?Ref.p1:Ref.p2;
          const baseName=op.relation==='above_named'
            ?(op.target||'a')
            :['above_line','below_line','behind_line','front_of_line'].includes(op.relation)
              ?'ℓ':op.relation==='front_of_plane'?'f':'h';
          push({
            title:'Выбери вспомогательную точку N'+firstIdx+' '+refWhere,
            action:'На '+baseName+firstIdx+' отметь N'+firstIdx+' примерно посередине видимого штриха. Парную проекцию определит пересечение вертикального проектора с '+baseName+secondIdx+'.',
            why:'Точка N выбирается на уже построенной пространственной прямой '+baseName+'. Её вторая проекция не произвольна: обе проекции N имеют одну абсциссу.',
            measure:['N'+firstIdx+' ∈ '+baseName+firstIdx],
            check:'N'+firstIdx+' находится на '+baseName+firstIdx+'. Для N'+secondIdx+' понадобится та же вертикальная линия связи.'
          },[
            point(i,firstPos,'N'+firstIdx,'construction-dot')
          ]);

          i=steps.length;
          push({
            title:'По линии связи получи N'+secondIdx,
            action:'Из N'+firstIdx+' проведи вертикальную линию связи до '+baseName+secondIdx+'. Пересечение обозначь N'+secondIdx+'.',
            why:'N'+firstIdx+' и N'+secondIdx+' – проекции одной пространственной точки N. Поэтому вторую отметку находят на '+baseName+secondIdx+' по уже выбранной первой.',
            measure:['N₁↔N₂ – одна линия связи','N'+secondIdx+' ∈ '+baseName+secondIdx],
            check:'N'+secondIdx+' лежит одновременно на '+baseName+secondIdx+' и на вертикальном проекторе из N'+firstIdx+'.'
          },[
            line(i,firstPos,secondPos,'construction-line'),
            point(i,secondPos,'N'+secondIdx,'construction-dot')
          ],{kind:'line',a:firstPos,b:secondPos});
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
        } else if(op.relation==='above_plane'||op.relation==='below_plane'){
          relationAction=op.resultPoint+'₁ совмести с N₁ на Π₁ (сохрани x и y). '+
            'На той же линии связи размести '+op.resultPoint+'₂ '+
            (op.relation==='above_plane'?'выше':'ниже')+
            ' N₂ на Π₂ – изменяется только высота z.';
        } else if(op.relation==='front_of_plane'){
          relationAction=op.resultPoint+'₂ совмести с N₂ на Π₂ (сохрани x и z). '+
            'На том же проекторе размести '+op.resultPoint+
            '₁ перед N₁ на Π₁ – изменяется только глубина y.';
        }
        push({
          title:'Построй '+op.resultPoint+' '+relationText,
          action:relationAction,
          why:why,
          measure:['Величина смещения не задана условием – выбирается для читаемости чертежа.'],
          check:['behind_line','front_of_line','front_of_plane'].includes(op.relation)
            ? op.resultPoint+'₂ совпадает с N₂ на Π₂. На Π₁ обе точки остаются на одном проекторе, но их расстояния от оси x₁₂ различаются.'
            : op.resultPoint+'₁ совпадает с N₁ на Π₁. На Π₂ обе точки остаются на одном проекторе, но находятся на разной высоте.'
        },[
          line(i,R.p1,R.p2,'construction-line'),
          point(i,R.p1,op.resultPoint+'₁','answer-dot'),
          point(i,R.p2,op.resultPoint+'₂','answer-dot')
        ].filter(Boolean),{kind:'line',a:R.p1,b:R.p2});
      }
    }

    i=steps.length;
    push({
      title:'Сверь горизонталь, фронталь и линию ската',
      action:'Угольником проверь h₂ ∥ x₁₂, f₁ ∥ x₁₂ и ЛС₁ ⟂ h₁. Затем сверь результат с условием: '+task4OperationBrief(op)+'.',
      why:'Направления h, f и линии ската следуют из их определений. Проверить их можно угольником и по проведённым линиям связи, а не по внешнему сходству с образцом.',
      measure:['h₂ ∥ x₁₂','f₁ ∥ x₁₂','ЛС₁ ⟂ h₁'],
      check:'Парные проекции каждой построенной точки находятся на одной вертикальной линии связи. Исходные прямые плоскости не перемещены.'
    },[]);

    const norm=normalizeSteps(steps,200,155);
    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps:steps,diagramPending:false,paperScale:norm.scale};
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

  function planeReferenceLines(scheme,preferLegible=false){
    if(scheme.planeType==='ABC'){
      // Any two of AB, AC and BC define the same original plane.
      // For task 4 prefer edges with readable INTERIOR crossings in both
      // projections. This changes only freely chosen helper construction,
      // never the source A/B/C points or the plane.
      const sides=[
        {name:'AB',rec:abcLineRec(scheme,'A','B')},
        {name:'AC',rec:abcLineRec(scheme,'A','C')},
        {name:'BC',rec:abcLineRec(scheme,'B','C')}
      ];
      if(preferLegible){
        let best=null;
        for(let i=0;i<sides.length;i++)for(let j=i+1;j<sides.length;j++){
          const pair=[sides[i],sides[j]];
          const horizontal=chooseLevelCut(pair,'p2');
          const frontal=chooseLevelCut(pair,'p1');
          if(!horizontal||!frontal)continue;
          // Avoid a good horizontal at the price of an unreadable frontal.
          const quality=Math.min(horizontal.score,frontal.score)+
            .25*(horizontal.score+frontal.score);
          if(!best||quality>best.quality) best={pair,quality};
        }
        if(best)return best.pair;
      }
      return sides.slice(0,2);
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
    if(!refs||refs.length<2||!refs[0].rec||!refs[1].rec)return null;
    const segs=refs.slice(0,2).map(ref=>ref.rec[proj]);
    if(segs.some(s=>!s||s.length!==2))return null;
    const minY=Math.min(...segs.flat().map(p=>+p[1]));
    const maxY=Math.max(...segs.flat().map(p=>+p[1]));
    if(!(maxY-minY>EPS))return null;
    // First search the shared vertical interval of the PRINTED segments.
    // The old maximum-separation score favored extrapolations hundreds of
    // units beyond ABC, making the given figure tiny on a real A4 sheet.
    const sharedLo=Math.max(...segs.map(s=>Math.min(s[0][1],s[1][1])));
    const sharedHi=Math.min(...segs.map(s=>Math.max(s[0][1],s[1][1])));
    const interior=sharedHi-sharedLo>EPS;
    const levels=interior
      ? [.14,.25,.36,.50,.64,.75,.86].map(t=>sharedLo+(sharedHi-sharedLo)*t)
      : [.24,.34,.44,.54,.64,.74].map(t=>minY+(maxY-minY)*t);
    let best=null;
    for(const y of levels){
      const xs=segs.map(seg=>lineXAtY(seg,y));
      if(!xs.every(Number.isFinite))continue;
      const separation=Math.abs(xs[1]-xs[0]);
      if(separation<6)continue;
      let outside=0,closest=Infinity;
      for(let k=0;k<2;k++){
        const x=xs[k],seg=segs[k],lo=Math.min(...seg.map(p=>p[0])),
          hi=Math.max(...seg.map(p=>p[0]));
        if(x<lo)outside+=lo-x;
        if(x>hi)outside+=x-hi;
        closest=Math.min(closest,...seg.map(p=>Math.hypot(x-p[0],y-p[1])));
      }
      // 10–25 unit interior clearances are easier to draw and annotate.
      // Excessive line extensions are penalized rather than rewarded.
      const score=Math.min(separation,115)+Math.min(closest,25)*.9
        -outside*2.2-Math.max(0,12-closest)*3;
      if(!best||score>best.score)
        best={y,xs,score,separation,outside,endpointClearance:closest};
    }
    // If the original line segments do not share a useful level, still
    // construct the exact mathematical plane using their continuations.
    if(!best&&interior){
      for(const t of [.20,.35,.50,.65,.80]){
        const y=minY+(maxY-minY)*t;
        const xs=segs.map(seg=>lineXAtY(seg,y));
        if(!xs.every(Number.isFinite))continue;
        const separation=Math.abs(xs[1]-xs[0]);
        if(separation<6)continue;
        const outside=segs.reduce((sum,seg,k)=>{
          const lo=Math.min(...seg.map(p=>p[0])),hi=Math.max(...seg.map(p=>p[0]));
          return sum+Math.max(0,lo-xs[k],xs[k]-hi);
        },0);
        const score=Math.min(separation,115)-outside*2.2;
        if(!best||score>best.score)best={y,xs,score,separation,outside};
      }
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

  function appendABCPlaneEntities(out,scheme,step,exactSource){
    if(scheme.planeType!=='ABC') return;
    const labels=Object.keys(scheme.points||{}).slice(0,3);
    if(labels.length!==3)return;
    const get=p=>exactSource?p:normalizedPointRec(p);
    const A=get(scheme.points[labels[0]]),B=get(scheme.points[labels[1]]),C=get(scheme.points[labels[2]]);
    [[labels[0],labels[1],A,B],[labels[1],labels[2],B,C],[labels[2],labels[0],C,A]].forEach(row=>{
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

  // Visibility belongs to the whole spatial line, not just the short
  // stroke printed on the photographed assignment. When K is outside that
  // stroke, splitting A–K and K–B would draw two OVERLAPPING segments with
  // incompatible visibility. Extend both projections using the same x range,
  // keep K inside it, and draw exactly one segment on each side.
  function task5VisibilityExtents(rec,K){
    const xs=[...rec.p1,...rec.p2].map(p=>+p[0]);
    const lo=Math.min(...xs,K.x),hi=Math.max(...xs,K.x);
    if(!(hi-lo>EPS))return {p1:toSeg(rec.p1),p2:toSeg(rec.p2)};
    // Printed Π₁/Π₂ strokes can have different endpoints. Even if K lies
    // inside their union, it can be only 1–2 mm from one extremity, leaving
    // the opposite visibility segment practically invisible. Give K at
    // least one readable continuation on BOTH sides of both projections.
    const clearance=Math.max(20,(hi-lo)*.08);
    const xA=Math.min(lo,K.x-clearance);
    const xB=Math.max(hi,K.x+clearance);
    const result={};
    for(const proj of ['p1','p2']){
      result[proj]=[
        {x:xA,y:lineY(rec[proj],xA)},
        {x:xB,y:lineY(rec[proj],xB)}
      ];
    }
    return result;
  }

  function segmentVisibility(rec,plane,proj,K,displaySegment){
    const seg=displaySegment||toSeg(rec[proj]);
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
    // Extensions of the given line are necessary while locating K and the
    // visibility competitors, but must not paint continuous guide strokes
    // underneath the final hidden segments.
    const givenExtension=(step,segment,P)=>segmentExtensionEntities(step,segment,P)
      .map(e=>({...e,visibilityScaffold:true}));
    const givenRefs=planeReferenceLines(scheme);
    if(givenRefs.length<2) return {error:'Для плоскости не хватает двух опорных линий.'};
    let refs=givenRefs,bridge=null;
    const regularCuts=['p1','p2'].map(side=>task5AuxCandidate(givenRefs,lrec,side))
      .filter(Boolean).sort((a,b)=>a.score-b.score);
    // A very shallow crossing of Ω with a given spatial line can put a
    // pencil intersection thousands of millimetres away even when the
    // actual K sits on the original sheet (17/5). Construct a legitimate
    // additional line g=TU IN Σ, with T on a and U on b; then use a,g
    // instead of those nearly parallel auxiliary cuts. Show T/U/g first.
    if(scheme.planeType==='intersecting_lines'&&regularCuts.length&&
       regularCuts[0].score>20&&givenRefs.length===2){
      const A=givenRefs[0],B=givenRefs[1],fraction=.85;
      const along=rec=>{
        const seg=rec.p1;
        return seg[0][0]+(seg[1][0]-seg[0][0])*fraction;
      };
      const xT=along(A.rec),xU=along(B.rec);
      if(Math.abs(xU-xT)>6){
        const g={p1:[[xT,lineY(A.rec.p1,xT)],[xU,lineY(B.rec.p1,xU)]],
          p2:[[xT,lineY(A.rec.p2,xT)],[xU,lineY(B.rec.p2,xU)]]};
        const alternative=[A,{name:'g',rec:g,auxiliary:true}];
        const trial=['p1','p2'].map(side=>task5AuxCandidate(alternative,lrec,side))
          .filter(Boolean).sort((a,b)=>a.score-b.score);
        if(trial.length && trial[0].score<regularCuts[0].score*.25 &&
           trial[0].score<10){
          refs=alternative;
          bridge={A,B,g};
        }
      }
    }
    // When two source lines are parallel, their projections may run almost
    // parallel to ℓ on Π₂. A visibility coincidence with either source line
    // can then land thousands of units away although K is on the paper.
    // Before drawing visibility, try a real in-plane transversal g=TU:
    // T is chosen on the first source line, U on the second; both projectors
    // and both strokes of g are drawn by the existing 'bridge' steps.
    if(scheme.planeType==='parallel_lines'&&givenRefs.length===2&&regularCuts.length){
      const A=givenRefs[0],B=givenRefs[1],cut0=regularCuts[0];
      const k1=cut0.primary==='p1'?cut0.KPrimary:cut0.KOther;
      const k2=cut0.primary==='p2'?cut0.KPrimary:cut0.KOther;
      const w1=task5VisibilityWitness(givenRefs,lrec,'p1',k1);
      const w2=task5VisibilityWitness(givenRefs,lrec,'p2',k2);
      const sourceX=lrec.p1.flat().filter((v,i)=>i%2===0);
      const centerX=(Math.min(...sourceX)+Math.max(...sourceX))*.5;
      const spread=ws=>Math.max(...ws.filter(Boolean).map(w=>Math.abs(w.X.x-centerX)),0);
      const oldSpread=spread([w1,w2]);
      // This bridge is for the faraway Π₂ competitor. A faraway Π₁
      // competitor (19/5) already has a separate established and tested
      // witness-only g construction; do not replace that method.
      if(w1&&w2&&Math.abs(w2.X.x-centerX)>500&&
         Math.abs(w1.X.x-centerX)<500&&oldSpread>500){
        const xT=A.rec.p1[0][0]+(A.rec.p1[1][0]-A.rec.p1[0][0])*.35;
        const xU=B.rec.p1[0][0]+(B.rec.p1[1][0]-B.rec.p1[0][0])*.85;
        if(Math.abs(xT-xU)>12){
          const g={
            p1:[[xT,lineY(A.rec.p1,xT)],[xU,lineY(B.rec.p1,xU)]],
            p2:[[xT,lineY(A.rec.p2,xT)],[xU,lineY(B.rec.p2,xU)]]
          };
          const alternative=[A,{name:'g',rec:g,auxiliary:true}];
          const trial=['p1','p2'].map(side=>task5AuxCandidate(alternative,lrec,side))
            .filter(Boolean).sort((a,b)=>a.score-b.score);
          if(trial.length){
            const c=trial[0];
            const tK1=c.primary==='p1'?c.KPrimary:c.KOther;
            const tK2=c.primary==='p2'?c.KPrimary:c.KOther;
            const witnesses=[
              task5VisibilityWitness(alternative,lrec,'p1',tK1),
              task5VisibilityWitness(alternative,lrec,'p2',tK2)
            ];
            const newSpread=spread(witnesses);
            if(witnesses.every(Boolean)&&newSpread<oldSpread*.4 &&
               Math.abs(tK1.x-k1.x)<.05&&
               c.score<Math.max(20,cut0.score+20)){
              refs=alternative;
              bridge={A,B,g};
            }
          }
        }
      }
    }

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
    // Near-parallel line/plane directions amplify small source-photo
    // tracing errors. In 13/5, one pixel can shift K by thousands of
    // drawing units; don't present that remote extrapolation as precise.
    // This warning is informational and must not move source strokes or K.
    const sourceLine3=schemeLine3(lrec);
    const sourceDirection=sub3(sourceLine3[1],sourceLine3[0]);
    const incidenceCos=Math.abs(dot3(plane.n,sourceDirection))/
      (norm3(plane.n)*norm3(sourceDirection));
    const sourceXs=lrec.p1.map(p=>p[0]);
    const sourceRemote=Math.min(...sourceXs.map(x=>Math.abs(K1.x-x)));
    const scanSensitive=Boolean(scheme.sourceGeometry)&&
      incidenceCos<.01&&sourceRemote>500;

    const steps=[],push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));
    let i=0;
    const starter=starterEntitiesFromScheme(scheme,i);
    const sourcePlaneObjects=scheme.planeType==='ABC'
      ? 'точки A, B, C и стороны треугольника ABC'
      : scheme.planeType==='line_point'
        ? 'заданную прямую '+(scheme.planeLine||Object.keys(scheme.lines||{})[0]||'a')+
          ' и точку '+(scheme.planePoint||Object.keys(scheme.points||{})[0]||'A')
        : 'прямые '+givenRefs.map(ref=>ref.name).join(', ');
    push({
      title:'Сверь исходные проекции плоскости и ℓ',
      action:'По исходному листу перенеси '+sourcePlaneObjects+', а также прямую ℓ. Сохрани подписи, направления исходных прямых и уже напечатанные линии связи.',
      why:scheme.planeType==='ABC'
        ? 'Плоскость задана тремя точками A, B, C. Её сечение можно построить по сторонам треугольника.'
        : scheme.planeType==='parallel_lines'
          ? 'Две параллельные прямые задают плоскость. Для сечения будем использовать обе прямые как опорные.'
          : scheme.planeType==='intersecting_lines'
            ? 'Пересекающиеся прямые задают плоскость. Их точки пересечения с вспомогательной плоскостью определяют линию сечения.'
            : 'Прямая и точка вне неё задают плоскость. Сначала проведём вторую опорную прямую через заданную точку.',
      measure:['Сохраняй парные проекции с индексами 1 и 2.','Линии связи проводи между проекциями одной пространственной точки.'],
      check:'По исходному листу проверь символ плоскости, обозначение прямой и индексы её проекций. Заданные линии связи остаются на своих местах.'
    },starter);
    if(scheme.sourceGeometry && !scheme.adaptedSource)
      steps[0].sourceEntities=starterEntitiesFromScheme(scheme.sourceGeometry,0,true);
    if(!scheme.adaptedSource){
      const sourceName=scheme.givenLine||'l';
      const shownName=sourceName==='l'?'ℓ':sourceName;
      const otherLine='Отдельно нанеси '+shownName+'₁ и '+shownName+'₂ из условия, не соединяя их с плоскостью без построения.';
      const otherCheck='Заданная прямая '+shownName+' показана на двух видах как '+shownName+'₁ и '+shownName+'₂: это проекции одной пространственной прямой.';
      let planeAction='',planeCheck='';
      if(scheme.planeType==='ABC'){
        const names=Object.keys(scheme.points||{}).slice(0,3);
        if(names.length===3){
          planeAction='Отметь на П₁ и П₂ вершины '+names.join(', ')+' и построй обе проекции треугольника ABC.';
          planeCheck='Для плоскости проверь пары '+names.map(name=>name+'₁/'+name+'₂').join(', ')+': у каждой вершины две проекции на одной вертикальной линии связи.';
        }
      }else if(scheme.planeType==='parallel_lines'){
        const [a,b]=scheme.planeLines||[];
        if(a&&b){
          planeAction='Перенеси заданные параллельные прямые '+a+' и '+b+' на П₁ и П₂.';
          planeCheck='Плоскость задана параллельными прямыми: '+a+'₁ ∥ '+b+'₁ и '+a+'₂ ∥ '+b+'₂; на каждом виде это две разные линии.';
        }
      }else if(scheme.planeType==='intersecting_lines'){
        const [a,b]=scheme.planeLines||[];
        if(a&&b){
          planeAction='Перенеси на П₁ и П₂ заданные пересекающиеся прямые '+a+' и '+b+'; отметь их узел на каждом виде.';
          planeCheck='Узел '+a+'₁ ∩ '+b+'₁ на П₁ и узел '+a+'₂ ∩ '+b+'₂ на П₂ принадлежат одной пространственной точке, поэтому расположены на общей вертикальной линии связи.';
        }
      }else if(scheme.planeType==='line_point'){
        const a=scheme.planeLine||Object.keys(scheme.lines||{}).find(name=>name!==sourceName)||'a';
        const P=scheme.planePoint||Object.keys(scheme.points||{})[0]||'A';
        planeAction='Перенеси прямую '+a+'₁/'+a+'₂ и отдельно точку '+P+'₁/'+P+'₂: вместе они задают плоскость.';
        planeCheck='У прямой есть проекции '+a+'₁/'+a+'₂, у точки – '+P+'₁/'+P+'₂ на вертикальном проекторе. Точка '+P+' не принадлежит прямой '+a+' в пространстве.';
      }
      if(planeAction&&planeCheck){
        steps[0].title='Сверь исходные проекции плоскости и прямой '+shownName;
        steps[0].action=planeAction+' '+otherLine+' Вспомогательную плоскость пока не вводи.';
        steps[0].check=planeCheck+' '+otherCheck;
      }
    }
    if(scheme.adaptedSource){
      steps[0].action='Перенеси учебную реконструкцию с экрана: на каждом виде начерти пересекающиеся прямые a и b, отдельно – прямую ℓ. Отметь общий узел a∩b на двух проекциях и проведи через него линию связи. Сохрани индексы ₁ и ₂ у всех трёх прямых.';
      steps[0].why+=' Наклоны штрихов здесь намеренно отличаются от университетского скана. Последующие построения относятся к этой реконструкции.';
      steps[0].check='На Π₁ пересекаются a₁ и b₁, на Π₂ – a₂ и b₂. Обе точки пересечения имеют один x и соединены вертикальной линией связи. ℓ₁ и ℓ₂ показаны отдельно; сравнивай со схемой на экране, а не с архивным сканом.';
    }
    if(scanSensitive){
      steps[0].why+=' Здесь исходная прямая почти параллельна плоскости. По растровому листу можно проверить способ построения, но не точное положение далёкого пересечения.';
    }

    diagramReferenceAxisStep(push,steps,scheme,5);

    // A plane defined by A and a cannot use the computed auxiliary g=AT
    // until the student has actually selected T on a, transferred its paired
    // projection and DRAWN both projected g strokes. In particular, 02/5
    // previously introduced the visibility competitor on an invisible g₁.
    const linePointRef=givenRefs.find(ref=>
      ref.auxiliary && ref.anchor && ref.throughPoint);
    if(linePointRef){
      const sourceLine=givenRefs.find(ref=>!ref.auxiliary)?.name||scheme.planeLine||'a';
      const pointName=linePointRef.throughName||scheme.planePoint||'A';
      const T1={x:linePointRef.anchor.p1[0],y:linePointRef.anchor.p1[1]};
      const T2={x:linePointRef.anchor.p2[0],y:linePointRef.anchor.p2[1]};
      const A1={x:linePointRef.throughPoint.p1[0],y:linePointRef.throughPoint.p1[1]};
      const A2={x:linePointRef.throughPoint.p2[0],y:linePointRef.throughPoint.p2[1]};
      i=steps.length;
      push({
        title:'Выбери T₁ на '+sourceLine+'₁ плоскости Σ',
        action:'На заданной прямой '+sourceLine+'₁ выбери точку T₁. Вторую проекцию не ставь заранее.',
        why:'Точка T принадлежит исходной прямой '+sourceLine+' и, следовательно, плоскости Σ.',
        measure:['T₁ ∈ '+sourceLine+'₁'],
        check:'Выбранная T₁ лежит на исходной опорной прямой. Парную T₂ получай пересечением с проектором.'
      },[
        ...segmentExtensionEntities(i,scheme.lines[sourceLine]?.p1,T1),
        point(i,T1,'T₁','construction-dot')
      ]);
      i=steps.length;
      push({
        title:'По линии связи получи T₂ на '+sourceLine+'₂',
        action:'Из T₁ проведи проектор до '+sourceLine+'₂ и получи T₂.',
        why:'Проекции одной пространственной точки имеют общий x; T₂ принадлежит заданной '+sourceLine+'₂.',
        measure:['T₁T₂ – линия связи','T₂ ∈ '+sourceLine+'₂'],
        check:'T₂ находится одновременно на парной проекции опорной прямой и на проекторе из T₁.'
      },[
        ...segmentExtensionEntities(i,scheme.lines[sourceLine]?.p2,T2),
        line(i,T1,T2,'construction-line'),point(i,T2,'T₂','construction-dot')
      ]);
      i=steps.length;
      push({
        title:'Соедини '+pointName+' с T – построй g₁ и g₂ плоскости Σ',
        action:'Соедини '+pointName+'₁ с T₁ и '+pointName+'₂ с T₂. Получи g₁ и g₂ – вторую опорную прямую плоскости.',
        why:'Прямая через две уже заданные точки плоскости целиком ей принадлежит. Теперь g можно использовать для построения Ω∩Σ и конкурирующих точек.',
        measure:['g₁ = '+pointName+'₁T₁','g₂ = '+pointName+'₂T₂'],
        check:'Обе проекции g построены из ранее введённых точек. До этого шага g отсутствовала.'
      },[
        line(i,A1,T1,'aux-line'),textEntity(i,add2(lerp2(A1,T1,.55),{x:6,y:0}),'g₁','svg-label'),
        line(i,A2,T2,'aux-line'),textEntity(i,add2(lerp2(A2,T2,.55),{x:6,y:0}),'g₂','svg-label')
      ]);
    }

    if(bridge){
      const {A,B,g}=bridge;
      const T1={x:g.p1[0][0],y:g.p1[0][1]},T2={x:g.p2[0][0],y:g.p2[0][1]};
      const U1={x:g.p1[1][0],y:g.p1[1][1]},U2={x:g.p2[1][0],y:g.p2[1][1]};
      i=steps.length;
      push({
        title:'Выбери T₁ на '+A.name+'₁ плоскости Σ',
        action:'На заданной '+A.name+'₁ выбери T₁. Пока её фронтальную проекцию не ставь.',
        why:'Любая точка заданной прямой '+A.name+' принадлежит исходной плоскости Σ.',
        measure:['T₁ ∈ '+A.name+'₁'],
        check:'T₁ лежит на заданной линии; для построения пространственной T нужна парная проекция.'
      },[point(i,T1,'T₁','construction-dot')]);
      i=steps.length;
      push({
        title:'По линии связи перенеси T₁ на '+A.name+'₂ и получи T₂',
        action:'Из T₁ проведи проектор, при необходимости продли '+A.name+'₂ до встречи с ним и отметь T₂.',
        why:'Парная проекция T₂ не выбирается произвольно; она принадлежит исходной прямой и её продолжению.',
        measure:['T₁T₂ – линия связи','T₂ ∈ '+A.name+'₂ или её продолжению'],
        check:'Обе проекции T имеют один x, а исходная линия действительно доведена до T₂.'
      },[
        ...segmentExtensionEntities(i,A.rec.p2,T2),
        line(i,T1,T2,'construction-line'),point(i,T2,'T₂','construction-dot')
      ]);
      i=steps.length;
      push({
        title:'Выбери U₁ на '+B.name+'₁ плоскости Σ',
        action:'На '+B.name+'₁ отметь U₁ на исходном штрихе или его продолжении. Точка U должна отличаться от T, чтобы две точки задавали вспомогательную прямую g.',
        why:'Прямая '+B.name+' тоже лежит в Σ. Точки T и U позволяют построить дополнительную прямую g этой плоскости.',
        measure:['U₁ ∈ '+B.name+'₁'],
        check:'U₁ лежит на '+B.name+'₁ или её продолжении. Для U₂ потребуется вертикальный проектор и '+B.name+'₂.'
      },[point(i,U1,'U₁','construction-dot')]);
      i=steps.length;
      push({
        title:'По линии связи перенеси U₁ на '+B.name+'₂ и получи U₂',
        action:'Проведи линию связи из U₁, при необходимости продли '+B.name+'₂ до неё и обозначь U₂.',
        why:'U₁ и U₂ – проекции одной пространственной точки U на прямой '+B.name+'. Обе точки на чертеже имеют одну абсциссу.',
        measure:['U₁U₂ – линия связи','U₂ ∈ '+B.name+'₂ или её продолжению'],
        check:'U₂ лежит на '+B.name+'₂ и вертикальной линии связи из U₁. Эти две проекции соответствуют одной точке U.'
      },[
        ...segmentExtensionEntities(i,B.rec.p2,U2),
        line(i,U1,U2,'construction-line'),point(i,U2,'U₂','construction-dot')
      ]);
      i=steps.length;
      push({
        title:'Соедини T и U – построй g₁ и g₂ плоскости Σ',
        action:'Соедини T₁U₁ и T₂U₂. Это новая опорная прямая g=TU; исходную '+B.name+' не удаляй.',
        why:'Любая прямая через две точки исходной плоскости лежит в той же плоскости. Она позволяет избежать далёкого вспомогательного пересечения.',
        measure:['g₁=T₁U₁','g₂=T₂U₂'],
        check:'g получена именно из ранее построенных проекций T и U.'
      },[
        line(i,T1,U1,'aux-line'),textEntity(i,U1,'g₁','svg-label'),
        line(i,T2,U2,'aux-line'),textEntity(i,U2,'g₂','svg-label')
      ]);
    }

    i=steps.length;
    push({
      title:'Проведи через ℓ вспомогательную плоскость Ω',
      action:'Задай '+planeKind+' плоскость Ω через прямую ℓ. На выбранном виде её проекция Ω'+pIdx+' совпадает с ℓ'+pIdx+'.',
      why:'Из двух стандартных вариантов выбрана та проекция, где вспомогательное построение требует меньших продолжений исходных прямых. Плоскость Ω содержит ℓ, поэтому её пересечение с Σ обязательно проходит через искомую K.',
      measure:['Ω'+pIdx+' ≡ ℓ'+pIdx],
      check:'На выбранной проекции линия Ω'+pIdx+' совпадает с ℓ'+pIdx+'; отдельная новая точка пересечения здесь не нужна.'
    },[
      line(i,lPrimary[0],lPrimary[1],'aux-line',{sourceCoincidentAux:true}),
      textEntity(i,lerp2(lPrimary[0],lPrimary[1],.18),'Ω'+pIdx+'≡ℓ'+pIdx,'svg-label')
    ],{kind:'line',a:lPrimary[0],b:lPrimary[1]});

    i=steps.length;
    push({
      title:'Найди 1'+pIdx+' и 2'+pIdx+' – точки сечения Ω с плоскостью Σ',
      action:'Отметь пересечения Ω'+pIdx+'=ℓ'+pIdx+' с опорными линиями '+refs[0].name+pIdx+' и '+refs[1].name+pIdx+'. Если штрих заканчивается раньше точки пересечения, продли его тонкой линией.',
      why:'Обе точки лежат одновременно во вспомогательной плоскости Ω и исходной Σ. Если пересечение оказалось за концом напечатанной линии, продли её тонким штрихом.',
      measure:['1'+pIdx+' = Ω'+pIdx+' ∩ '+refs[0].name+pIdx,'2'+pIdx+' = Ω'+pIdx+' ∩ '+refs[1].name+pIdx],
      check:'Точки 1'+pIdx+' и 2'+pIdx+' должны лежать одновременно на Ω'+pIdx+'=ℓ'+pIdx+' и на соответствующей опорной прямой плоскости Σ.'
    },[
      ...givenExtension(i,lrec[primary],I1),
      ...givenExtension(i,lrec[primary],I2),
      ...segmentExtensionEntities(i,refs[0].rec[primary],I1),
      ...segmentExtensionEntities(i,refs[1].rec[primary],I2),
      point(i,I1,'1'+pIdx,'construction-dot'),
      point(i,I2,'2'+pIdx,'construction-dot')
    ]);

    i=steps.length;
    push({
      title:'Перенеси 1'+pIdx+' и 2'+pIdx+' на '+oPlane,
      action:'Из 1'+pIdx+' и 2'+pIdx+' проведи линии связи. На соответствующих проекциях '+refs[0].name+oIdx+' и '+refs[1].name+oIdx+' получи 1'+oIdx+' и 2'+oIdx+'.',
      why:'Точки 1 и 2 переносят по отдельности. У каждой точки парные проекции имеют общую абсциссу; на '+oPlane+' её находят по линии связи и парной проекции своей опорной прямой.',
      measure:['1'+pIdx+'↔1'+oIdx+' – одна линия связи','2'+pIdx+'↔2'+oIdx+' – одна линия связи'],
      check:'1'+oIdx+' лежит на '+refs[0].name+oIdx+' и проекторе из 1'+pIdx+'; 2'+oIdx+' – на '+refs[1].name+oIdx+' и проекторе из 2'+pIdx+'.'
    },[
      ...segmentExtensionEntities(i,refs[0].rec[other],J1),
      ...segmentExtensionEntities(i,refs[1].rec[other],J2),
      line(i,I1,J1,'construction-line'),point(i,J1,'1'+oIdx,'construction-dot'),
      line(i,I2,J2,'construction-line'),point(i,J2,'2'+oIdx,'construction-dot')
    ],{kind:'line',a:I1,b:J1});

    i=steps.length;
    push({
      title:'Построй m'+oIdx+' = 1'+oIdx+'2'+oIdx,
      action:'Соедини уже построенные 1'+oIdx+' и 2'+oIdx+' тонкой прямой m'+oIdx+'. Точку K пока не отмечай.',
      why:'Обе точки принадлежат Ω и Σ, поэтому m = Ω ∩ Σ. Только после появления этой прямой можно находить её пересечение с ℓ.',
      measure:['m'+oIdx+' = 1'+oIdx+'2'+oIdx],
      check:'Линия сечения m'+oIdx+' проведена через 1'+oIdx+' и 2'+oIdx+'. Её пересечение с исходной прямой определяет K.'
    },[
      line(i,J1,J2,'aux-line'),textEntity(i,lerp2(J1,J2,.7),'m'+oIdx,'svg-label')
    ],{kind:'line',a:J1,b:J2});

    i=steps.length;
    push({
      title:'Найди K'+oIdx+' = m'+oIdx+' ∩ ℓ'+oIdx,
      action:'Найди точку пересечения уже построенной m'+oIdx+' с ℓ'+oIdx+'. При необходимости продли обе прямые тонкими линиями и обозначь K'+oIdx+'.',
      why:'Точка K принадлежит одновременно ℓ и линии m = Ω ∩ Σ, значит она принадлежит и плоскости Σ.'+
        (scanSensitive?' Но ℓ почти параллельна Σ: положение удалённой точки K сильно зависит от точности исходного скана.':''),
      measure:['K'+oIdx+' = m'+oIdx+' ∩ ℓ'+oIdx],
      check:'K'+oIdx+' принадлежит одновременно построенной линии сечения и исходной прямой. При удалённом пересечении обе линии нужно продлить до него.'+
        (scanSensitive?' Это геометрическая экстраполяция, а не точное измерение по фотографии; проверь оригинальный чертёж.':'')
    },[
      ...segmentExtensionEntities(i,[[J1.x,J1.y],[J2.x,J2.y]],KOther),
      ...givenExtension(i,lrec[other],KOther),
      point(i,KOther,'K'+oIdx,'answer-dot')
    ]);

    i=steps.length;
    push({
      title:'Перенеси K'+oIdx+' в K'+pIdx,
      action:'Через K'+oIdx+' проведи линию связи. При необходимости продли '+sourceLineDisplayName(scheme.givenLine||'l')+pIdx+
        ' тонким штрихом до проектора. Их пересечение обозначь K'+pIdx+'.',
      why:'K₁ и K₂ – две проекции одной пространственной точки пересечения K. Если K лежит за напечатанным концом исходной прямой, её продолжение обязательно показать на чертеже.',
      measure:['K₁K₂ – линия связи',sourceLineDisplayName(scheme.givenLine||'l')+pIdx+' – продление при необходимости'],
      check:'K'+pIdx+' лежит на исходной или продолженной '+sourceLineDisplayName(scheme.givenLine||'l')+pIdx+'.'
    },[
      ...givenExtension(i,lrec[primary],KPrimary),
      line(i,KOther,KPrimary,'construction-line'),point(i,KPrimary,'K'+pIdx,'answer-dot')
    ],{kind:'line',a:KOther,b:KPrimary});

    const visibilityGeometry=task5VisibilityExtents(lrec,K1);
    const l1=visibilityGeometry.p1,l2=visibilityGeometry.p2;
    const vis1=segmentVisibility(lrec,plane,'p1',K1,l1);
    const vis2=segmentVisibility(lrec,plane,'p2',K2,l2);
    const competingRefs=bridge&&scheme.planeType==='parallel_lines'?refs:givenRefs;
    let witness1=task5VisibilityWitness(competingRefs,lrec,'p1',K1);
    const witness2=task5VisibilityWitness(competingRefs,lrec,'p2',K2);
    let witnessBridge=null;
    // A *visibility* competitor must be a genuine point of the plane.
    // In 19/5 the photographed source lines are almost parallel to ℓ₁;
    // their projected crossing lies >1200 units away, even though K and
    // the result are near the original sheet. Construct a transverse g=TU
    // using two real points of the given (parallel) source lines.
    if(scheme.planeType==='parallel_lines'&&witness1?.score>5 &&
       givenRefs.length===2){
      const A=givenRefs[0],B=givenRefs[1];
      const xAt=(rec,f)=>rec.p1[0][0]+(rec.p1[1][0]-rec.p1[0][0])*f;
      const xT=xAt(A.rec,.65),xU=xAt(B.rec,.35);
      if(Math.abs(xT-xU)>8){
        const g={
          p1:[[xT,lineY(A.rec.p1,xT)],[xU,lineY(B.rec.p1,xU)]],
          p2:[[xT,lineY(A.rec.p2,xT)],[xU,lineY(B.rec.p2,xU)]]
        };
        const smaller=task5VisibilityWitness([{name:'g',rec:g}],lrec,'p1',K1);
        if(smaller&&smaller.score<witness1.score*.3 && smaller.score<3){
          witness1=smaller;
          witnessBridge={A,B,g};
        }
      }
    }

    if(witnessBridge){
      const {A,B,g}=witnessBridge;
      const T1={x:g.p1[0][0],y:g.p1[0][1]},T2={x:g.p2[0][0],y:g.p2[0][1]};
      const U1={x:g.p1[1][0],y:g.p1[1][1]},U2={x:g.p2[1][0],y:g.p2[1][1]};
      i=steps.length;
      push({
        title:'Выбери T₁ на '+A.name+'₁ для сравнения видимости',
        action:'На исходной '+A.name+'₁ выбери точку T₁. Её T₂ пока не отмечай.',
        why:'Точка T принадлежит первой из заданных параллельных прямых плоскости Σ.',
        measure:['T₁ ∈ '+A.name+'₁'],
        check:'T₁ лежит на исходной прямой на Π₁. Её парная T₂ строится проектором до этой прямой на Π₂.'
      },[point(i,T1,'T₁','construction-dot')]);
      i=steps.length;
      push({
        title:'Перенеси T₁ на '+A.name+'₂ и получи T₂ для сравнения видимости',
        action:'Из T₁ подними линию связи до '+A.name+'₂, отметь T₂.',
        why:'Два вида одной точки должны лежать на общем проекторе.',
        measure:['T₁T₂ – линия связи'],
        check:'T₂ получена после проектора, а не выбрана независимо.'
      },[line(i,T1,T2,'construction-line'),point(i,T2,'T₂','construction-dot')]);
      i=steps.length;
      push({
        title:'Выбери U₁ на '+B.name+'₁ для сравнения видимости',
        action:'На второй заданной прямой '+B.name+'₁ выбери U₁.',
        why:'Точка U принадлежит второй опорной прямой исходной плоскости Σ.',
        measure:['U₁ ∈ '+B.name+'₁'],
        check:'Проверь, что U₁ отмечена на второй опорной прямой и из неё можно провести вертикальную линию связи.'
      },[point(i,U1,'U₁','construction-dot')]);
      i=steps.length;
      push({
        title:'Перенеси U₁ на '+B.name+'₂ и получи U₂ для сравнения видимости',
        action:'Линия связи из U₁ до '+B.name+'₂ определяет U₂.',
        why:'Обе проекции U принадлежат одной пространственной прямой '+B.name+'.',
        measure:['U₁U₂ – линия связи'],
        check:'U₂ лежит на проекторе из U₁.'
      },[line(i,U1,U2,'construction-line'),point(i,U2,'U₂','construction-dot')]);
      i=steps.length;
      push({
        title:'Проведи g=TU для конкурирующих точек на Π₁',
        action:'Проведи g₁=T₁U₁ и g₂=T₂U₂. Затем сравни её с ℓ₁.',
        why:'Через T и U проходит прямая в исходной плоскости. Теперь можно получить близкую пару конкурирующих точек без огромных продолжений.',
        measure:['g₁=T₁U₁','g₂=T₂U₂'],
        check:'g проходит через две уже найденные пространственные точки Σ.'
      },[
        line(i,T1,U1,'aux-line'),textEntity(i,U1,'g₁','svg-label'),
        line(i,T2,U2,'aux-line'),textEntity(i,U2,'g₂','svg-label')
      ]);
    }

    if(witness1){
      i=steps.length;
      push({
        title:'Видимость на Π₁: отметь совпадающие 3₁≡4₁',
        action:'На Π₁ найди пересечение ℓ₁ с '+witness1.ref.name+'₁. В одной проекции они совпадают: обозначь 3₁≡4₁. Парных точек 3₂/4₂ пока нет.',
        why:'Для определения видимости сверху нужны две разные пространственные точки, которые имеют одинаковую горизонтальную проекцию.',
        measure:['3₁≡4₁ = ℓ₁ ∩ '+witness1.ref.name+'₁'],
        check:'Совпадающие 3₁≡4₁ находятся на пересечении ℓ₁ с линией плоскости. Их высоты сравниваются на Π₂.'
      },[
        ...givenExtension(i,lrec.p1,witness1.X),
        ...segmentExtensionEntities(i,witness1.ref.rec.p1,witness1.X),
        point(i,witness1.X,'3₁≡4₁','construction-dot')
      ]);

      i=steps.length;
      const relation1=witness1.lineVisible
        ? '3₂ выше 4₂: прямая ℓ ближе к наблюдателю'
        : '4₂ выше 3₂: плоскость закрывает прямую ℓ';
      push({
        title:'Перенеси 3₁≡4₁ на Π₂ – получи 3₂ и 4₂',
        action:'Проведи из 3₁≡4₁ линию связи. Пересечение с ℓ₂ обозначь 3₂, а с '+witness1.ref.name+'₂ – 4₂. Сравни высоты этих точек.',
        why:'Видимость на Π₁ определяется высотами z. Здесь '+relation1+'. Только теперь известно, какой участок ℓ₁ видим.',
        measure:['3₂ ∈ ℓ₂','4₂ ∈ '+witness1.ref.name+'₂','3₁≡4₁'],
        check:'3₂ и 4₂ должны лежать на одном проекторе. Для видимости на Π₁ сравни высоты z: выше расположенная точка видна сверху.'
      },[
        ...givenExtension(i,lrec.p2,witness1.lineOther),
        ...segmentExtensionEntities(i,witness1.ref.rec.p2,witness1.planeOther),
        line(i,witness1.X,witness1.lineOther,'construction-line'),
        line(i,witness1.X,witness1.planeOther,'construction-line'),
        point(i,witness1.lineOther,'3₂','construction-dot'),
        point(i,witness1.planeOther,'4₂','construction-dot')
      ]);
    }

    if(witness2){
      i=steps.length;
      push({
        title:'Видимость на Π₂: отметь совпадающие 5₂≡6₂',
        action:'На Π₂ найди пересечение ℓ₂ с '+witness2.ref.name+'₂. Обозначь совпадающие проекции 5₂≡6₂. До переноса на Π₁ глубины неизвестны.',
        why:'Для определения видимости спереди нужны две разные пространственные точки с общей фронтальной проекцией.',
        measure:['5₂≡6₂ = ℓ₂ ∩ '+witness2.ref.name+'₂'],
        check:'5₂≡6₂ находится на пересечении ℓ₂ с линией плоскости. Их различие по глубине видно на Π₁.'
      },[
        ...givenExtension(i,lrec.p2,witness2.X),
        ...segmentExtensionEntities(i,witness2.ref.rec.p2,witness2.X),
        point(i,witness2.X,'5₂≡6₂','construction-dot')
      ]);

      i=steps.length;
      const relation2=witness2.lineVisible
        ? '5₁ ближе к наблюдателю, чем 6₁: ℓ видима'
        : '6₁ ближе к наблюдателю, чем 5₁: ℓ закрыта плоскостью';
      push({
        title:'Перенеси 5₂≡6₂ на Π₁ – получи 5₁ и 6₁',
        action:'Из 5₂≡6₂ проведи линию связи к ℓ₁ и '+witness2.ref.name+'₁. Отметь соответственно 5₁ и 6₁; сравни их удаление от Π₂.',
        why:'Фронтальная видимость определяется глубиной y. Здесь '+relation2+'. Вывод делается после построения обеих первых проекций.',
        measure:['5₁ ∈ ℓ₁','6₁ ∈ '+witness2.ref.name+'₁','5₂≡6₂'],
        check:'5₁ и 6₁ находятся на одном проекторе. На Π₂ видна точка с большим удалением в направлении положительного y.'
      },[
        ...givenExtension(i,lrec.p1,witness2.lineOther),
        ...segmentExtensionEntities(i,witness2.ref.rec.p1,witness2.planeOther),
        line(i,witness2.X,witness2.lineOther,'construction-line'),
        line(i,witness2.X,witness2.planeOther,'construction-line'),
        point(i,witness2.lineOther,'5₁','construction-dot'),
        point(i,witness2.planeOther,'6₁','construction-dot')
      ]);
    }

    // The split and the visibility are two physical pencil operations.
    // Do not bury the continuation and the division at K in the prose of
    // the completed drawing. Temporary guide strokes disappear as soon as
    // the solid/dashed answer replaces them, including behind dash gaps.
    const p1a=l1[0],p1b=l1[1],p2a=l2[0],p2b=l2[1];
    i=steps.length;
    push({
      title:'Продли ℓ и раздели обе проекции точкой K',
      action:'На Π₁ продолжи ℓ₁ через K₁, на Π₂ – ℓ₂ через K₂. Тонкими штрихами покажи участки по обе стороны K; если K лежит за концом заданной прямой, продли её до K. Сплошное или штриховое начертание каждого участка определи сравнением конкурирующих точек 3/4 и 5/6.',
      why:'Точка K делит каждую проекцию прямой на два участка. Продление необходимо, если K находится за пределом заданного отрезка; нельзя считать его уже нарисованным по одному описанию.',
      measure:['ℓ₁: два участка с общим концом K₁','ℓ₂: два участка с общим концом K₂'],
      check:'На обеих проекциях видны построенные продолжения и граница K без разрывов и наложений.'
    },[
      line(i,p1a,K1,'construction-line',{visibilityScaffold:true}),
      line(i,K1,p1b,'construction-line',{visibilityScaffold:true}),
      line(i,p2a,K2,'construction-line',{visibilityScaffold:true}),
      line(i,K2,p2b,'construction-line',{visibilityScaffold:true}),
      point(i,K1,'K₁','answer-dot'),point(i,K2,'K₂','answer-dot')
    ]);

    i=steps.length;
    push({
      title:'Нанеси видимость ℓ по конкурирующим точкам',
      action:'По парам 3/4 на Π₁ и 5/6 на Π₂ замени построенные части ℓ на сплошные и штриховые. Граница видимости – K. Оба участка и их начертание показаны на самом чертеже.',
      why:'Сплошным показан участок ℓ перед плоскостью; штриховым – закрытый ею. По разные стороны точки K видимость меняется.',
      measure:['Π₁: высота z по 3₂/4₂','Π₂: глубина y по 5₁/6₁'],
      check:'На Π₁ и Π₂ от K отходят по одному сплошному и штриховому участку. Вспомогательные сплошные линии под штрихами исчезли.'
    },[
      line(i,p1a,K1,vis1[0]?'answer-line':'hidden-line'),
      line(i,K1,p1b,vis1[1]?'answer-line':'hidden-line'),
      line(i,p2a,K2,vis2[0]?'answer-line':'hidden-line'),
      line(i,K2,p2b,vis2[1]?'answer-line':'hidden-line'),
      point(i,K1,'K₁','answer-dot'),point(i,K2,'K₂','answer-dot')
    ]);

    // The genuine paper of variant 20 calls the given straight line f,
    // not ℓ. Preserve that designation on every construction step and SVG
    // label instead of silently changing the student's original condition.
    if(scheme.givenLine && scheme.givenLine!=='l'){
      const display=scheme.givenLine;
      for(const st of steps){
        for(const key of ['title','action','why','check']){
          if(typeof st[key]==='string')st[key]=st[key].replace(/ℓ/g,display);
        }
        if(Array.isArray(st.measure))st.measure=st.measure.map(v=>typeof v==='string'?v.replace(/ℓ/g,display):v);
        for(const e of [...(st.entities||[]),...(st.sourceEntities||[])]){
          if(typeof e.label==='string')e.label=e.label.replace(/ℓ/g,display);
        }
      }
    }
    const norm=normalizeSteps(steps,200,165);
    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps:steps,diagramPending:false,paperScale:norm.scale};
  }

  function planeFromDef(def){
    if(def.type==='ABC'){
      const names=Object.keys(def.points||{}).slice(0,3);
      if(names.length!==3)throw new Error('Для треугольной плоскости нужны три исходные вершины.');
      const points={A:def.points[names[0]],B:def.points[names[1]],C:def.points[names[2]]};
      return planeFromScheme({planeType:'ABC',points});
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

  function starterPlaneDefEntities(def,step,prefix,exactSource){
    const out=[],pre=prefix||'';
    if(def.type==='ABC'){
      const pseudo={planeType:'ABC',points:def.points};
      Object.entries(def.points).forEach(([name,P])=>{
        const q=exactSource?P:normalizedPointRec(P);
        const p2={x:+q.p2[0],y:+q.p2[1]},p1={x:+q.p1[0],y:+q.p1[1]};
        out.push(line(step,p2,p1,'source-guide-line'));
        out.push(point(step,p2,name+'₂'));
        out.push(point(step,p1,name+'₁'));
      });
      appendABCPlaneEntities(out,pseudo,step,exactSource);
    } else if(def.type==='line_point'){
      Object.entries(def.lines||{}).forEach(([name,L])=>{
        out.push(line(step,{x:L.p2[0][0],y:L.p2[0][1]},{x:L.p2[1][0],y:L.p2[1][1]},'object-line'));
        out.push(textEntity(step,sourceLineLabelPoint(def,name,'p2',L),sourceLineDisplayName(name)+'₂','svg-label'));
        out.push(line(step,{x:L.p1[0][0],y:L.p1[0][1]},{x:L.p1[1][0],y:L.p1[1][1]},'object-line'));
        out.push(textEntity(step,sourceLineLabelPoint(def,name,'p1',L),sourceLineDisplayName(name)+'₁','svg-label'));
      });
      Object.entries(def.points||{}).forEach(([name,P])=>{
        const q=exactSource?P:normalizedPointRec(P);
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


  function rawTask6StarterEntities(scheme,step,label){
    const raw=scheme.sourceGeometry;
    if(!raw)return null;
    const through=raw.pointK||raw.pointThrough;
    if(!through?.p1||!through?.p2)return null;
    const p1={x:+through.p1[0],y:+through.p1[1]};
    const p2={x:+through.p2[0],y:+through.p2[1]};
    const paperReversed=scheme.paperReversedKLabels===true;
    return [
      ...starterPlaneDefEntities(raw.planeA,step,raw.planeA?.name||'Σ',true),
      ...starterPlaneDefEntities(raw.planeB,step,raw.planeB?.name||'Θ',true),
      line(step,p2,p1,'source-guide-line'),
      point(step,p2,label+(paperReversed?'₁':'₂')),
      point(step,p1,label+(paperReversed?'₂':'₁'))
    ];
  }

  function planeDefReferenceLines(def){
    if(!def) return [];
    if(def.type==='ABC'){
      const p=def.points||{};
      const labels=Object.keys(p).slice(0,3);
      if(labels.length!==3)return [];
      const pairs=[[labels[0],labels[1]],[labels[1],labels[2]],[labels[2],labels[0]]];
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
    if(def.lines){
      const refs=Object.entries(def.lines).map(([name,rec])=>({name,rec}));
      // For intersecting horizontal h and frontal f, a section through a
      // generic height/depth can be parallel to one given line. Introduce
      // the genuinely constructed diagonal g=TU; T lies on h, U on f.
      // Their existing projections are used without altering the paper
      // originals or inventing an unrelated spatial direction.
      if(def.type==='intersecting_lines'&&def.lines.h&&def.lines.f){
        const H=def.lines.h,F=def.lines.f;
        // The first f endpoint of 04/6 is a much closer legitimate
        // anchor; all other photographed h/f planes retain their choice.
        const xT=+H.p1[0][0],xU=+F.p1[def.shortBridgeEndpoint?0:1][0];
        if(Math.abs(xU-xT)>5){
          const at=(seg,x)=>lineY(seg,x);
          const g={
            p1:[[xT,at(H.p1,xT)],[xU,at(F.p1,xU)]],
            p2:[[xT,at(H.p2,xT)],[xU,at(F.p2,xU)]]
          };
          refs.push({name:'g',rec:g,generated:true,construction:'h-f-diagonal'});
        }
      }
      // The 06/6 Σ(a∩b) has a near-level source line; build a nearby
      // auxiliary plane-contained diagonal to avoid remote level cuts.
      if(def.auxBridge==='a-b'&&def.lines.a&&def.lines.b){
        const A=def.lines.a,B=def.lines.b;
        const xT=A.p1[0][0]+(A.p1[1][0]-A.p1[0][0])*.25;
        const xU=B.p1[0][0]+(B.p1[1][0]-B.p1[0][0])*.85;
        if(Math.abs(xT-xU)>8)
          refs.push({
            name:'g',
            rec:{
              p1:[[xT,lineY(A.p1,xT)],[xU,lineY(B.p1,xU)]],
              p2:[[xT,lineY(A.p2,xT)],[xU,lineY(B.p2,xU)]]
            },
            generated:true,construction:'a-b-diagonal'
          });
      }
      return refs;
    }
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
      // Levels crossing too close to a printed endpoint create tiny
      // 0.3–3 mm pencil extensions at A4 scale. Prefer a well-separated
      // crossing when it is geometrically equivalent.
      const endpointGap=(rec,t)=>{
        const seg=rec[primary];
        const size=Math.hypot(seg[1][0]-seg[0][0],seg[1][1]-seg[0][1]);
        return Math.min(Math.abs(t),Math.abs(1-t))*size;
      };
      const nearPenalty=[endpointGap(ra,ia.t),endpointGap(rb,ib.t)]
        .reduce((sum,d)=>sum+Math.max(0,15-d)*2,0);
      const score=ext*25+spreadPenalty*.25+nearPenalty;
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
    const choosePair=(levelType,wideRange=false)=>{
      const lo=levelType==='horizontal'?bounds.minY2:bounds.minY1;
      const hi=levelType==='horizontal'?bounds.maxY2:bounds.maxY1;
      const span=Math.max(30,hi-lo);
      const candidates=[];
      // The usual levels stay INSIDE the printed source. For a near-parallel
      // plane pair, all inside levels can send P/Q thousands of millimetres
      // away. Only the fallback below also examines perfectly legitimate
      // auxiliary planes beyond the original source elevation/depth range.
      const fractions=wideRange
        ? [-1.2,-1.05,-.9,-.8,-.7,-.6,-.5,-.4,-.3,-.2,-.1,
           0,.18,.26,.34,.42,.50,.58,.66,.74,.82,1,1.15,1.3,1.5,1.7]
        : [.18,.26,.34,.42,.50,.58,.66,.74,.82];
      for(const frac of fractions){
        const level=lo+span*frac;
        const c=task6SectionCandidate(scheme,levelType,level,bounds);
        if(c)candidates.push(c);
      }
      candidates.sort((a,b)=>a.score-b.score);
      if(!candidates.length)return null;
      if(wideRange){
        // A compact INDIVIDUAL cut is not enough: 05/6 originally selected
        // two good local scores whose P/Q span still exceeded 600 units.
        // Compare the entire two-cut drawing envelope, including the four
        // section projections, source geometry and P/Q. Keep levels distinct.
        let best=null;
        for(let a=0;a<candidates.length;a++)for(let b=a+1;b<candidates.length;b++){
          const A=candidates[a],B=candidates[b];
          if(Math.abs(A.level-B.level)<=span*.22||
             dist2(A.P.p1,B.P.p1)<=12||dist2(A.P.p2,B.P.p2)<=12)continue;
          const xs=[bounds.minX,bounds.maxX],ys1=[bounds.minY1,bounds.maxY1],ys2=[bounds.minY2,bounds.maxY2];
          const add=p=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))return p;return null;};
          for(const c of [A,B]){
            for(const p of [c.P.p1,...c.a.p1,...c.b.p1]){
              const v=add(p);if(v){xs.push(v.x);ys1.push(v.y);}
            }
            for(const p of [c.P.p2,...c.a.p2,...c.b.p2]){
              const v=add(p);if(v){xs.push(v.x);ys2.push(v.y);}
            }
          }
          const width=Math.max(...xs)-Math.min(...xs);
          const height=Math.max(...ys1)-Math.min(...ys1)+Math.max(...ys2)-Math.min(...ys2);
          const metric=width+height*.18+(A.score+B.score)*.12;
          if(!best||metric<best.metric)best={pair:[A,B],metric};
        }
        if(best)return {levelType,pair:best.pair.sort((a,b)=>a.level-b.level)};
      }
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

    // Both families are valid construction methods. A usable horizontal
    // section can nevertheless send P/Q and all pencil extensions thousands
    // of units away (notably 10/6 and 12/6), making the source drawing tiny.
    // Compare how far each family's real section endpoints extend; do NOT
    // translate the original paper geometry or invent nearby intersections.
    const primary=choosePair(preferredLevelType);
    const alternateType=preferredLevelType==='horizontal'?'frontal':'horizontal';
    const alternative=choosePair(alternateType);
    let picked=primary||alternative;
    if(primary&&alternative){
      const score=choice=>choice.pair.reduce((sum,sec)=>sum+sec.score,0);
      const firstScore=score(primary),secondScore=score(alternative);
      // Keep the traditional family when both are reasonable. Switch only
      // for a materially shorter legitimate pencil construction.
      if(firstScore>500 && secondScore<firstScore*.75)
        picked=alternative;
    }
    if(picked){
      const score=choice=>choice.pair.reduce((sum,sec)=>sum+sec.score,0);
      const horizontalDistance=choice=>Math.max(...choice.pair.map(sec=>
        outsideAmount(sec.P.p1.x,bounds.minX-150,bounds.maxX+150)));
      // 05/6: printed geometry x≈94..402, old α/β intersections fell near
      // x=−1600 and x=−2100, shrinking the fitted result to 3.8%.
      // Search more levels ONLY for a demonstrably remote result; preserve
      // every normal construction and its chosen source levels unchanged.
      if(horizontalDistance(picked)>500){
        const wider=[
          choosePair(preferredLevelType,true),
          choosePair(alternateType,true)
        ].filter(Boolean).sort((a,b)=>score(a)-score(b));
        const closer=wider[0];
        if(closer && score(closer)<score(picked)*.7 &&
           horizontalDistance(closer)<horizontalDistance(picked)*.65)
          picked=closer;
      }
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
      title:'Сверь обе исходные плоскости и точку '+throughLabel,
      action:'Перенеси из условия обе плоскости, исходные линии связи и точку '+throughLabel+'. Не меняй наклоны и обозначения.'+(scheme.paperReversedKLabels
        ? ' В оригинале перепутаны индексы: верхняя проекция названа K₁, нижняя – K₂. Для корректного решения переобозначь верхнюю как K₂, нижнюю как K₁. Координаты точек не перемещай.'
        : ' Тонкие вспомогательные линии пока не добавляй.'),
      why:'Наклоны и взаимное положение напечатанной схемы являются исходными данными. Вспомогательные сечения появятся только на следующих шагах.',
      measure:['Исходные толстые линии не заменяй вспомогательными.','Исходные тонкие проекторы сохраняй тонкими.'],
      check:'Сверь обозначения обеих исходных плоскостей и точки '+throughLabel+' с листом. Особое внимание – парным проекциям и линиям связи.'
    },[
      ...starterPlaneDefEntities(sourceScheme.planeA,i,planeASymbol),
      ...starterPlaneDefEntities(sourceScheme.planeB,i,planeBSymbol),
      line(i,sourceK2,sourceK1,'source-guide-line'),
      point(i,sourceK2,throughLabel+'₂'),
      point(i,sourceK1,throughLabel+'₁')
    ]);
    if(scheme.sourceGeometry && !scheme.adaptedSource)
      steps[0].sourceEntities=rawTask6StarterEntities(scheme,0,throughLabel);
    if(scheme.adaptedSource){
      steps[0].action='Перенеси учебную реконструкцию с экрана. Плоскость Σ задай параллельными a₁, b₁ и a₂, b₂; плоскость Θ – пересекающимися h и f. Отметь общий узел h∩f на двух видах и точки '+throughLabel+'₁, '+throughLabel+'₂ на одной линии связи.';
      steps[0].why='Здесь сохранены типы плоскостей и узлы исходного задания, но изменены некоторые наклоны штрихов. Построение относится к этой схеме, а не к метрически точной копии архивного листа.';
      steps[0].check='Угольником проверь: a₁ ∥ b₁, a₂ ∥ b₂, h₂ ∥ x₁₂ и f₁ ∥ x₁₂. Две проекции узла h∩f и две проекции '+throughLabel+' лежат на своих вертикальных линиях связи.';
    }
    if(scheme.planeA?.type==='intersecting_lines' &&
       scheme.planeB?.type==='line_point'){
      const aNames=Object.keys(scheme.planeA.lines||{});
      const hName=scheme.planeB.lineName||Object.keys(scheme.planeB.lines||{})[0]||'h';
      const aName=scheme.planeB.pointName||Object.keys(scheme.planeB.points||{})[0]||'A';
      if(aNames.length===2)
        steps[0].check='В '+planeASymbol+' пересекаются '+aNames[0]+'₁ и '+aNames[1]+'₁, а также '+aNames[0]+'₂ и '+aNames[1]+'₂; оба узла расположены на одной вертикальной линии связи. В '+planeBSymbol+' задана прямая '+hName+'₁/'+hName+'₂ и отдельная точка '+aName+'₁/'+aName+'₂, парные проекции которой соединены проектором. Проекции '+throughLabel+'₁ и '+throughLabel+'₂ тоже связаны одним проектором.';
    }
    if(scheme.planeA?.type==='intersecting_lines' &&
       scheme.planeB?.type==='horizontal_projecting'){
      const lineNames=Object.keys(scheme.planeA.lines||{});
      if(lineNames.length===2)
        steps[0].check='Проверь исходные элементы: '+lineNames[0]+'₁ ∩ '+lineNames[1]+'₁ и '+lineNames[0]+'₂ ∩ '+lineNames[1]+'₂ задают один узел плоскости '+planeASymbol+'; две проекции этого узла лежат на общей вертикальной линии связи. Плоскость '+planeBSymbol+' горизонтально-проецирующая: на П₁ она изображена одной заданной прямой, на П₂ отдельной исходной прямой для неё нет. Проекции '+throughLabel+'₁ и '+throughLabel+'₂ тоже находятся на одной вертикальной линии связи.';
    }
    if(scheme.planeA?.type==='frontal_projecting' &&
       scheme.planeB?.type==='ABC'){
      const names=Object.keys(scheme.planeB.points||{});
      if(names.length===3)
        steps[0].check='Плоскость '+planeASymbol+' фронтально-проецирующая: на П₂ она показана одной заданной прямой '+planeASymbol+'₂, а на П₁ отдельной исходной линии этой плоскости нет. В '+planeBSymbol+' проверь три пары вершин '+names.map(name=>name+'₁/'+name+'₂').join(', ')+' и линии связи между парными проекциями. '+throughLabel+'₁ и '+throughLabel+'₂ тоже относятся к одной пространственной точке и стоят на общей вертикальной линии связи.';
    }
    if(scheme.planeA?.type==='parallel_lines' &&
       scheme.planeB?.type==='parallel_lines'){
      const aNames=Object.keys(scheme.planeA.lines||{});
      const bNames=Object.keys(scheme.planeB.lines||{});
      if(aNames.length===2&&bNames.length===2){
        const [a,b]=aNames,[c,d]=bNames;
        steps[0].action='Перенеси с листа четыре заданные прямые: '+a+' и '+b+' плоскости '+planeASymbol+', '+c+' и '+d+' плоскости '+planeBSymbol+'. Покажи каждую на П₁ и П₂ и подпиши проекции с правильными индексами. Отметь заданные '+throughLabel+'₁ и '+throughLabel+'₂. На этом шаге вспомогательные прямые и сечения ещё не проводи.';
        steps[0].why='Каждая плоскость задана двумя пространственно параллельными прямыми. На исходном печатном рисунке их наклоны могут немного расходиться из-за качества штрихов; в геометрическом построении сохраняй параллельность соответствующих проекций.';
        steps[0].check='Для '+planeASymbol+' проверь '+a+'₁ ∥ '+b+'₁ и '+a+'₂ ∥ '+b+'₂. Для '+planeBSymbol+' проверь '+c+'₁ ∥ '+d+'₁ и '+c+'₂ ∥ '+d+'₂. Даже когда '+a+'₁ и '+b+'₁ проходят близко, это две разные заданные прямые. Проекции '+throughLabel+'₁ и '+throughLabel+'₂ относятся к одной точке '+throughLabel+' и соединены линией связи.';
      }
    }
    if(scheme.planeA?.type==='parallel_lines' &&
       scheme.planeB?.type==='intersecting_lines' && !scheme.adaptedSource){
      const namesA=Object.keys(scheme.planeA.lines||{});
      const namesB=Object.keys(scheme.planeB.lines||{});
      if(namesA.length===2&&namesB.length===2){
        const [a,b]=namesA,[c,d]=namesB;
        steps[0].check='В плоскости '+planeASymbol+' проверь '+a+'₁ ∥ '+b+'₁ и '+a+'₂ ∥ '+b+'₂. В плоскости '+planeBSymbol+' прямые '+c+'₁ и '+d+'₁ пересекаются в одном узле, а '+c+'₂ и '+d+'₂ – в его парной проекции; эти два узла соединены общей вертикальной линией связи. Заданные проекции '+throughLabel+'₁ и '+throughLabel+'₂ принадлежат одной точке '+throughLabel+' и тоже соединены линией связи.';
      }
    }
    if(scheme.planeA?.type==='intersecting_lines' &&
       scheme.planeB?.type==='intersecting_lines'){
      const linesA=Object.keys(scheme.planeA.lines||{});
      const linesB=Object.keys(scheme.planeB.lines||{});
      if(linesA.length===2&&linesB.length===2){
        const [a,b]=linesA,[c,d]=linesB;
        steps[0].action='Перенеси из исходного листа две пересекающиеся прямые '+a+', '+b+' плоскости '+planeASymbol+' и две пересекающиеся прямые '+c+', '+d+' плоскости '+planeBSymbol+'. Для каждого из двух узлов отметь первую и вторую проекции и сохрани линии связи. Нанеси заданные '+throughLabel+'₁ и '+throughLabel+'₂; вспомогательные сечения пока не проводи.';
        steps[0].why='Пересекающиеся пространственные прямые определяют плоскость. Поэтому пересечения на П₁ и П₂ должны соответствовать одному пространственному узлу для каждой плоскости; узлы разных плоскостей заранее не являются точками их линии пересечения.';
        steps[0].check='В '+planeASymbol+' проверь узел '+a+'₁ ∩ '+b+'₁ и его парный узел '+a+'₂ ∩ '+b+'₂. В '+planeBSymbol+' проверь узел '+c+'₁ ∩ '+d+'₁ и его парный узел '+c+'₂ ∩ '+d+'₂. У каждой плоскости пара проекций узла лежит на своей вертикальной линии связи. Проекции '+throughLabel+'₁ и '+throughLabel+'₂ принадлежат одной заданной точке '+throughLabel+' и связаны отдельным проектором.';
      }
    }
    if(scheme.planeA?.type==='intersecting_lines' &&
       scheme.planeB?.type==='ABC'){
      const names=Object.keys(scheme.planeA.lines||{});
      const vertices=Object.keys(scheme.planeB.points||{});
      if(names.length===2&&vertices.length===3){
        const [a,b]=names,[A,B,C]=vertices;
        steps[0].action='Из условия перенеси проекции пересекающихся прямых '+a+' и '+b+' плоскости '+planeASymbol+', отметь на обеих проекциях общий узел. Для плоскости '+planeBSymbol+' нанеси вершины '+vertices.join(', ')+' и соедини '+A+'₁'+B+'₁'+C+'₁, а также '+A+'₂'+B+'₂'+C+'₂. Отметь '+throughLabel+'₁ и '+throughLabel+'₂. Вспомогательных сечений пока не добавляй.';
        steps[0].why='Пересечение '+a+' и '+b+' задаёт исходный узел плоскости '+planeASymbol+'. Плоскость '+planeBSymbol+' определяют три пространственные точки '+vertices.join(', ')+'. Их проекции соответствуют тем же вершинам на двух видах.';
        steps[0].check='В '+planeASymbol+' проверь '+a+'₁ ∩ '+b+'₁ и '+a+'₂ ∩ '+b+'₂: парные узлы лежат на одной линии связи. В '+planeBSymbol+' сверяй вершины '+vertices.map(n=>n+'₁/'+n+'₂').join(', ')+'; обе проекции '+A+B+C+' образуют треугольники, а одноимённые точки соединяются проектором. Заданные '+throughLabel+'₁ и '+throughLabel+'₂ являются парой проекций одной точки '+throughLabel+'.';
      }
    }
    if(scheme.planeA?.type==='ABC' && scheme.planeB?.type==='ABC'){
      const aNames=Object.keys(scheme.planeA.points||{});
      const bNames=Object.keys(scheme.planeB.points||{});
      if(aNames.length===3&&bNames.length===3){
        steps[0].action='Перенеси из условия две разные плоскости: '+planeASymbol+' по вершинам '+aNames.join(', ')+' и '+planeBSymbol+' по вершинам '+bNames.join(', ')+'. Построй для каждой треугольник на П₁ и П₂, соедини одноимённые вершины вертикальными линиями связи. Отметь заданные '+throughLabel+'₁ и '+throughLabel+'₂. Вспомогательные сечения пока не проводи.';
        steps[0].why='Три неколлинеарные пространственные точки задают плоскость. Пары проекций каждой вершины обязаны находиться на одной вертикальной линии связи. Исходные два треугольника не следует смешивать с искомой линией пересечения плоскостей.';
        steps[0].check='В '+planeASymbol+' проверь пары '+aNames.map(n=>n+'₁/'+n+'₂').join(', ')+'. В '+planeBSymbol+' проверь пары '+bNames.map(n=>n+'₁/'+n+'₂').join(', ')+'. У каждой пары одноимённых точек совпадает положение по горизонтали (общий вертикальный проектор); на каждом виде вершины каждой плоскости образуют свой треугольник. Проекции '+throughLabel+'₁ и '+throughLabel+'₂ также имеют общий вертикальный проектор.';
      }
    }
    // The remaining photographed sheets also deserve a concrete input check.
    // Reuse the defined source objects, not generic advice to compare symbols.
    if(/^Сверь обозначения обеих исходных плоскостей/u.test(steps[0].check)){
      const givenPlane=(def,symbol)=>{
        const names=Object.keys(def.lines||{});
        if(def.type==='ABC'){
          const pts=Object.keys(def.points||{});
          if(pts.length!==3)return null;
          return {
            action:'Плоскость '+symbol+' задай вершинами '+pts.join(', ')+': отметь каждую на П₁ и П₂ и соедини вершины в двух проекциях.',
            why:'Три не лежащие на одной прямой пространственные вершины задают плоскость '+symbol+'.',
            check:'Для '+symbol+' проверь пары '+pts.map(n=>n+'₁/'+n+'₂').join(', ')+'; одноимённые вершины соединены вертикальными линиями связи.'
          };
        }
        if(def.type==='parallel_lines'&&names.length===2){
          const [a,b]=names;
          return {
            action:'Для '+symbol+' перенеси прямые '+a+' и '+b+' на оба вида, сохрани их направления и подписи.',
            why:'Две различные параллельные пространственные прямые задают плоскость '+symbol+'.',
            check:'Для '+symbol+' проверь '+a+'₁ ∥ '+b+'₁ и '+a+'₂ ∥ '+b+'₂; это две разные исходные прямые.'
          };
        }
        if(def.type==='intersecting_lines'&&names.length===2){
          const [a,b]=names;
          return {
            action:'Для '+symbol+' перенеси пересекающиеся прямые '+a+' и '+b+' в обе проекции и отметь их общий узел.',
            why:'Пересекающиеся пространственные прямые '+a+' и '+b+' определяют плоскость '+symbol+'.',
            check:'Для '+symbol+' найди '+a+'₁ ∩ '+b+'₁ и '+a+'₂ ∩ '+b+'₂; эти два изображения общего узла лежат на одном вертикальном проекторе.'
          };
        }
        if(def.type==='frontal_projecting')return {
          action:'Фронтально-проецирующую '+symbol+' нанеси по одной заданной прямой '+symbol+'₂ на П₂.',
          why:'Фронтально-проецирующая плоскость '+symbol+' изображается одной линией на П₂.',
          check:'Для '+symbol+' задана только линия '+symbol+'₂ на П₂. Самостоятельной исходной '+symbol+'₁ на П₁ нет.'
        };
        if(def.type==='horizontal_projecting')return {
          action:'Горизонтально-проецирующую '+symbol+' нанеси по одной заданной прямой '+symbol+'₁ на П₁.',
          why:'Горизонтально-проецирующая плоскость '+symbol+' изображается одной линией на П₁.',
          check:'Для '+symbol+' задана только линия '+symbol+'₁ на П₁. Самостоятельной исходной '+symbol+'₂ на П₂ нет.'
        };
        return null;
      };
      const a=givenPlane(scheme.planeA,planeASymbol);
      const b=givenPlane(scheme.planeB,planeBSymbol);
      if(a&&b){
        const labelCorrection=scheme.paperReversedKLabels
          ?' На оригинальном листе верхняя проекция K ошибочно подписана K₁, нижняя K₂. Переобозначь верхнюю как K₂, нижнюю как K₁, не перемещая точки.'
          :'';
        steps[0].title='Проверь исходные элементы '+planeASymbol+', '+planeBSymbol+' и точки '+throughLabel;
        steps[0].action=a.action+' '+b.action+' Отметь заданные '+throughLabel+'₁ и '+throughLabel+'₂ без дополнительных сечений.'+labelCorrection;
        steps[0].why=a.why+' '+b.why+' Вспомогательные сечения появятся на следующих этапах.';
        steps[0].check=a.check+' '+b.check+' Парные проекции '+throughLabel+'₁ и '+throughLabel+'₂ имеют общую вертикальную линию связи.'+labelCorrection;
      }
    }
    if(scheme.sourceId==='source-photos/scans/variant-12.jpg'&&!scheme.adaptedSource){
      steps[0].why+=' На этом листе плоскости пересекаются далеко за пределами исходной схемы. Свободно выбрать можно вспомогательные сечения, но не положение самой линии пересечения.';
    }

    diagramReferenceAxisStep(push,steps,scheme,6);

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
        action:'На заданной '+lineName+'₁ отметь T₁ примерно посередине её видимого штриха по горизонтали. Через эту точку будет построена вторая прямая плоскости, соединяющая T с '+pointName+'.',
        why:'Точка T выбирается на прямой '+lineName+', уже принадлежащей плоскости. Её положение на линии свободное; показанный ориентир в середине штриха позволяет повторить построение.',
        measure:['T₁ ∈ '+lineName+'₁','T₁ – около середины штриха по x'],
        check:'T₁ лежит на '+lineName+'₁, примерно на половине горизонтального расстояния между концами заданного штриха. T₁ не совпадает с '+pointName+'₁.'
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

    // Construct any supplementary g=TU in the original plane before its
    // use by α/β: both h/f and the near-horizontal a/b case need explicit
    // point selection, projector transfer and pairwise connection.
    [
      {def:scheme.planeA,label:planeASymbol},
      {def:scheme.planeB,label:planeBSymbol}
    ].forEach(item=>{
      const g=planeDefReferenceLines(item.def).find(ref=>
        ref.construction==='h-f-diagonal'||ref.construction==='a-b-diagonal');
      if(!g)return;
      const generatedStepsStart=steps.length;
      const lineA=g.construction==='h-f-diagonal'?'h':'a';
      const lineB=g.construction==='h-f-diagonal'?'f':'b';
      const T1={x:g.rec.p1[0][0],y:g.rec.p1[0][1]};
      const T2={x:g.rec.p2[0][0],y:g.rec.p2[0][1]};
      const U1={x:g.rec.p1[1][0],y:g.rec.p1[1][1]};
      const U2={x:g.rec.p2[1][0],y:g.rec.p2[1][1]};
      i=steps.length;
      push({
        title:'Выбери точку T₁ на '+lineA+'₁ плоскости '+item.label,
        action:'На '+lineA+'₁ отметь T₁ на заданном штрихе или его продолжении. Парную T₂ пока не выбирай: она будет найдена на втором виде по линии связи.',
        why:'Вся прямая '+lineA+' принадлежит плоскости '+item.label+'. Поэтому любая точка T на этой прямой тоже лежит в плоскости; её две проекции связаны одним x.',
        measure:['T₁ ∈ '+lineA+'₁'],
        check:'T₁ лежит на '+lineA+'₁ или её продолжении. Она не должна стоять в стороне от этой прямой.'
      },[
        point(i,T1,'T₁','construction-dot')
      ]);
      i=steps.length;
      push({
        title:'По линии связи получи T₂ на '+lineA+'₂',
        action:'Из T₁ проведи проектор; если '+lineA+'₂ короче, продли исходный штрих до T₂.',
        why:'T₁ и T₂ – проекции одной точки заданной прямой '+lineA+'.',
        measure:['T₁T₂ – линия связи','T₂ ∈ '+lineA+'₂ или её продолжению'],
        check:'T₂ лежит на линии связи из T₁ и на '+lineA+'₂. Обе отметки должны совпадать в одной точке.'
      },[
        ...segmentExtensionEntities(i,item.def.lines[lineA].p2,T2),
        line(i,T1,T2,'construction-line'),point(i,T2,'T₂','construction-dot')
      ]);
      i=steps.length;
      push({
        title:'Выбери точку U₁ на '+lineB+'₁ плоскости '+item.label,
        action:'На '+lineB+'₁ отметь U₁ на штрихе или его продолжении. Точка U должна отличаться от T, чтобы по двум точкам можно было провести вспомогательную прямую g. Положение U₂ определяется линией связи из U₁ и проекцией '+lineB+'₂, а не отдельным выбором.',
        why:'Прямая '+lineB+' тоже принадлежит плоскости '+item.label+'. Поэтому T и U можно использовать как две точки одной вспомогательной прямой g этой плоскости.',
        measure:['U₁ ∈ '+lineB+'₁'],
        check:'U₁ лежит на '+lineB+'₁ (или её продолжении). Точки T и U должны быть различными пространственными точками.'
      },[
        point(i,U1,'U₁','construction-dot')
      ]);
      i=steps.length;
      push({
        title:'По линии связи получи U₂ на '+lineB+'₂',
        action:'Из U₁ проведи проектор и при необходимости продли '+lineB+'₂ до пересечения U₂.',
        why:'Обе проекции U определяются одной точкой заданной прямой '+lineB+'.',
        measure:['U₁U₂ – линия связи','U₂ ∈ '+lineB+'₂ или её продолжению'],
        check:'U₂ получена пересечением реально нарисованных проектора и '+lineB+'₂.'
      },[
        ...segmentExtensionEntities(i,item.def.lines[lineB].p2,U2),
        line(i,U1,U2,'construction-line'),point(i,U2,'U₂','construction-dot')
      ]);
      i=steps.length;
      push({
        title:'Соедини T и U – построй вспомогательную прямую g в '+item.label,
        action:'Соедини T₁ с U₁ и T₂ с U₂. Обозначь полученные прямые g₁ и g₂.',
        why:'Обе пространственные точки T и U принадлежат '+item.label+'. Поэтому прямая g=TU тоже принадлежит этой плоскости и может служить второй опорной прямой для построения сечения.',
        measure:['g₁=T₁U₁','g₂=T₂U₂'],
        check:'На обоих видах g проходит через соответствующие проекции T и U.'
      },[
        line(i,T1,U1,'aux-line'),textEntity(i,U1,'g₁','svg-label'),
        line(i,T2,U2,'aux-line'),textEntity(i,U2,'g₂','svg-label')
      ]);

      // The line-point plane on the same 13/6 sheet already has its own
      // T₁/T₂. Reusing T for an unrelated point of g would assign two
      // different coordinates to one label. Name g's vertices M,N instead;
      // this changes annotation only, never source or solver coordinates.
      if(item.def===scheme.planeA && scheme.planeB?.type==='line_point'){
        const rename=text=>typeof text==='string'
          ? text.replaceAll('T','M').replaceAll('U','N') : text;
        for(const st of steps.slice(generatedStepsStart)){
          for(const k of ['title','action','why','check'])st[k]=rename(st[k]);
          st.measure=(st.measure||[]).map(rename);
          for(const e of st.entities||[])if(e.label)e.label=rename(e.label);
        }
      }
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
          check:'Проверь оба пересечения: '+pointNames[0]+pIdx+' = '+planeName+pIdx+' ∩ '+sec.refs[0].name+pIdx+'; '+pointNames[1]+pIdx+' = '+planeName+pIdx+' ∩ '+sec.refs[1].name+pIdx+'. Опорные прямые могут быть заданы в условии или построены на предыдущих этапах.'
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
          check:pointNames[0]+oIdx+' лежит на '+sec.refs[0].name+oIdx+', а '+pointNames[1]+oIdx+' – на '+sec.refs[1].name+oIdx+'. Каждая точка получена по линии связи со своей парной проекцией.'
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

      // In the supplied tasks a frontal-projecting plane is sectioned by a
      // frontal auxiliary plane, and a horizontal-projecting one by a
      // horizontal auxiliary plane. On one view the complete section follows
      // the plane's given degenerate projection; on the other it follows the
      // chosen auxiliary level. Say this explicitly instead of guessing an
      // undefined "intersection or coincident direction".
      const projectingIdx=def.type==='frontal_projecting'?'₂':'₁';
      const levelIdx=levelType==='horizontal'?'₂':'₁';
      const sameFamily=(def.type==='frontal_projecting'&&levelType==='frontal')||
        (def.type==='horizontal_projecting'&&levelType==='horizontal');
      const projectedView=projectingIdx==='₂'?'Π₂':'Π₁';
      const levelView=levelIdx==='₂'?'Π₂':'Π₁';
      const fromProjecting=sectionSymbol+projectingIdx;
      const fromLevel=sectionSymbol+levelIdx;
      i=steps.length;
      push({
        title:'Построй сечение '+planeName+' с проецирующей плоскостью '+planeSymbol,
        action:sameFamily
          ?'На '+projectedView+' проекция '+fromProjecting+' совпадает с заданной '+planeSymbol+projectingIdx+'. На '+levelView+' проекция '+fromLevel+' лежит на уровне '+planeName+levelIdx+'. Проведи оба штриха и согласуй одноимённые точки вертикальными линиями связи.'
          :'Проведи линию сечения вспомогательной плоскости '+planeName+' с '+planeSymbol+' через точку пересечения их проекций и перенеси парные точки линиями связи.',
        why:'Для проецирующей плоскости заданная вырожденная проекция определяет одну проекцию сечения, а выбранный уровень '+planeName+' определяет вторую. Две произвольные опорные точки здесь не нужны.',
        measure:sameFamily?[fromProjecting+' = '+planeSymbol+projectingIdx,fromLevel+' = '+planeName+levelIdx]
          :['Сечение принадлежит '+planeName,'Сечение принадлежит '+planeSymbol],
        check:sameFamily
          ?fromProjecting+' совпадает с '+planeSymbol+projectingIdx+', а '+fromLevel+' лежит на '+planeName+levelIdx+'. Парные точки имеют общую абсциссу.'
          :'Обе проекции сечения связаны вертикальными проекторами и принадлежат обеим заданным плоскостям.'
      },sectionDrawEntities(i,sec,sectionSymbol,null));
    };

    pair.forEach((c,index)=>{
      const name=index===0?'P':'Q';
      const planeName=index===0?'α':'β';
      const kind=levelType==='horizontal'?'горизонтальная':'фронтальная';
      const degenerateProj=levelType==='horizontal'?'₂':'₁';
      const primary=levelType==='horizontal'?'p2':'p1';
      const hasProjectingPlane=[scheme.planeA,scheme.planeB]
        .some(def=>/(?:horizontal|frontal)_projecting$/.test(def?.type||''));
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
        action:(hasProjectingPlane
          ?'Проведи '+planeName+degenerateProj+' параллельно x₁₂ на уровне, где можно построить сечения обеих плоскостей. Для плоскости, заданной прямыми, используй её опорные линии; для проецирующей плоскости – заданную вырожденную проекцию.'
          :'Проведи '+planeName+degenerateProj+' параллельно x₁₂ на уровне, где она пересекает опорные прямые обеих исходных плоскостей. При необходимости продли их тонкими линиями.')+(index===1?' Выбери уровень, отличный от α, чтобы получить вторую общую точку Q.':' Это первая вспомогательная плоскость: здесь будет найдена общая точка P.'),
        why:'Вспомогательная '+kind+' плоскость задаёт по одной линии сечения в каждой исходной плоскости. Пересечение этих двух линий даёт общую точку '+name+'. Два разных уровня нужны, чтобы получить две различные точки P и Q.',
        measure:[planeName+degenerateProj+' ∥ x₁₂'],
        check:planeName+degenerateProj+' параллельна x₁₂. Её уровень позволяет построить сечения обеих исходных плоскостей; '+(index===1?'β не совпадает с α.':'точку P пока не выбирают заранее.')
      },[
        line(i,guideA,guideB,'aux-line'),
        textEntity(i,guideB,planeName+degenerateProj,'svg-note')
      ],{kind:'line',a:guideA,b:guideB});

      addSectionForPlane(c.a,scheme.planeA,planeASymbol,index===0?['1','2']:['5','6'],planeName);
      addSectionForPlane(c.b,scheme.planeB,planeBSymbol,index===0?['3','4']:['7','8'],planeName);

      const nondIdx=levelType==='horizontal'?'₁':'₂';
      const nondProjection=levelType==='horizontal'?'p1':'p2';
      const nondPoint=levelType==='horizontal'?c.P.p1:c.P.p2;
      const degPoint=levelType==='horizontal'?c.P.p2:c.P.p1;
      i=steps.length;
      push({
        title:'Пересеки линии сечения '+planeName+' и получи '+name+nondIdx,
        action:'На невырожденной проекции при необходимости продли обе построенные линии сечения до их пересечения. Обозначь '+name+nondIdx+'. Не отмечай вторую проекцию до проведения линии связи.',
        why:'Обе линии принадлежат вспомогательной плоскости '+planeName+' и каждая своей исходной плоскости. Их общая точка принадлежит обеим исходным плоскостям.',
        measure:[name+nondIdx+' ∈ '+planeASymbol,name+nondIdx+' ∈ '+planeBSymbol],
        check:'Обе линии сечения пересекаются в '+name+nondIdx+'. Продли их до общей точки, не выбирая её на глаз.'
      },[
        ...segmentExtensionEntities(i,c.a?.[nondProjection],nondPoint),
        ...segmentExtensionEntities(i,c.b?.[nondProjection],nondPoint),
        point(i,nondPoint,name+nondIdx,'construction-dot')
      ]);

      i=steps.length;
      push({
        title:'Перенеси '+name+nondIdx+' на '+planeName+degenerateProj+' и получи '+name+degenerateProj,
        action:'Из '+name+nondIdx+' проведи проектор до уровня '+planeName+degenerateProj+'. Пересечение подпиши '+name+degenerateProj+'.',
        why:'Обе проекции обозначают одну пространственную общую точку. Вторую проекцию нельзя выбирать самостоятельно: она определяется линией связи и уровнем вспомогательной плоскости.',
        measure:[name+'₁'+name+'₂ – одна линия связи',name+degenerateProj+' ∈ '+planeName+degenerateProj],
        check:'Обе проекции '+name+' лежат на одной вертикальной линии связи; '+name+degenerateProj+' находится на уровне выбранной вспомогательной плоскости.'
      },[
        line(i,c.P.p2,c.P.p1,'construction-line'),
        point(i,degPoint,name+degenerateProj,'construction-dot')
      ]);

    });

    i=steps.length;
    push({
      title:'Соедини P и Q – получи линию пересечения r',
      action:'Соедини P₁ с Q₁ и P₂ с Q₂.',
      why:'Две общие точки P и Q однозначно задают линию пересечения двух плоскостей.',
      measure:['r₁ = P₁Q₁','r₂ = P₂Q₂'],
      check:'r₁ проходит через P₁ и Q₁, а r₂ – через P₂ и Q₂. Обе пары проекций P и Q выведены на одни линии связи.'
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
      check:'Угольником проверь: ℓ₁ ∥ r₁ и ℓ₂ ∥ r₂. Обе проекции ℓ проходят через '+throughLabel+'₁ и '+throughLabel+'₂ соответственно.'
    },[
      line(i,k1a,k1b,'answer-line'),textEntity(i,k1b,'ℓ₁','svg-label'),
      line(i,k2a,k2b,'answer-line'),textEntity(i,k2b,'ℓ₂','svg-label')
    ],{kind:'line',a:k1a,b:k1b});

    i=steps.length;
    push({
      title:'Проверь линию пересечения и прямую через '+throughLabel,
      action:'Линейкой сверь, что r₁ проходит через P₁ и Q₁, а r₂ – через P₂ и Q₂. Угольником проверь отдельно ℓ₁ ∥ r₁ и ℓ₂ ∥ r₂.',
      why:'P и Q принадлежат обеим исходным плоскостям. Их соединение задаёт линию пересечения r, а направление r позволяет провести через '+throughLabel+' прямую, параллельную обеим плоскостям.',
      measure:['P, Q ∈ '+planeASymbol+' ∩ '+planeBSymbol,'ℓ₁ ∥ r₁','ℓ₂ ∥ r₂'],
      check:'Проекции P₁/P₂ и Q₁/Q₂ соединены вертикальными линиями связи. Обе проекции ℓ проходят через соответствующие проекции '+throughLabel+'.'
    },[]);

    const norm=normalizeSteps(steps,210,170);
    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps,diagramPending:false,graphicalConstruction:true,paperScale:norm.scale};
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
      title:'Сверь обе исходные плоскости и точку '+throughLabel,
      action:'Сверь по исходному листу проекции обеих плоскостей и точку '+throughLabel+'. Перенеси их на тетрадный лист по совмещённой с чертежом сетке, сохраняя геометрические связи между проекциями.',
      why:'Положение линий на варианте является исходными данными. Решение строится уже поверх них.',
      measure:['Плоскость '+planeASymbol+' – первый набор','Плоскость '+planeBSymbol+' – второй набор',throughLabel+'₁/'+throughLabel+'₂ – одна линия связи'],
      check:'На обоих видах показаны заданные прямые плоскостей '+planeASymbol+' и '+planeBSymbol+'. Точки '+throughLabel+'₁ и '+throughLabel+'₂ стоят на одной линии связи.'
    },starter);
    if(scheme.sourceGeometry)steps[0].sourceEntities=rawTask6StarterEntities(scheme,0,throughLabel);

    diagramReferenceAxisStep(push,steps,scheme,6);

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
        check:'P₁ находится в пересечении построенных горизонталей на Π₁; P₂ должна лежать с ней на одной линии связи.'
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
        check:'Q₁ и Q₂ должны иметь одинаковую абсциссу и соединяться вертикальной линией связи.'
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
        check:'P₂ находится в пересечении двух построенных фронталей на Π₂; P₁ лежит с ней на одной линии связи.'
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
        check:'Q₁ и Q₂ должны иметь одинаковую абсциссу и соединяться вертикальной линией связи.'
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
      check:'Проекция r₁ проходит через P₁ и Q₁, а r₂ – через P₂ и Q₂.'
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
      title:'Проверь линию пересечения и прямую через '+throughLabel,
      action:'Линейкой сверь, что P₁ и Q₁ лежат на r₁, а P₂ и Q₂ – на r₂. Затем угольником проверь ℓ₁ ∥ r₁ и ℓ₂ ∥ r₂.',
      why:'Общие точки P и Q задают линию пересечения плоскостей. Через '+throughLabel+' проведена прямая того же направления.',
      measure:['P, Q ∈ '+planeASymbol+' ∩ '+planeBSymbol,'ℓ₁ ∥ r₁','ℓ₂ ∥ r₂'],
      check:'Проекции ℓ проходят через '+throughLabel+'₁ и '+throughLabel+'₂ соответственно; сама ℓ не обязана лежать ни в одной из заданных плоскостей.'
    },[]);

    const norm=normalizeSteps(steps,210,170);
    return {width:norm.width,height:norm.height,O:{x:0,y:0},steps:steps,diagramPending:false,paperScale:norm.scale};
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

  // A4 is a physical output page, not the unconstrained original coordinate
  // canvas. For coordinate tasks the factor is a standard reduction 1:N.
  // Graphical tasks have no source millimetres: scale is a layout factor only.
  // All solver geometry remains in its original coordinate system.
  function makePaperFrame(g){
    // Test BOTH legitimate A4 orientations. A near-square construction
    // formerly defaulted to portrait and was abruptly reduced from 1:1 to
    // 1:2 even though it fit comfortably on landscape A4.
    const reductions=[1,.5,.4,.25,.2,.1,.05,.025,.02,.01,.005,.0025,.001];
    const options=[{paperW:210,paperH:297,landscape:false},
      {paperW:297,paperH:210,landscape:true}].map(format=>{
      const allowable=Math.min(1,(format.paperW-24)/Math.max(g.width,1),
        (format.paperH-24)/Math.max(g.height,1));
      const scale=state.task<=3
        ? (reductions.find(v=>v<=allowable+1e-9)||allowable)
        : allowable;
      return {...format,scale,allowable};
    });
    options.sort((a,b)=>b.scale-a.scale||b.allowable-a.allowable||
      (g.width>g.height?Number(b.landscape)-Number(a.landscape):
        Number(a.landscape)-Number(b.landscape)));
    const {paperW,paperH,landscape,scale}=options[0];
    const viewW=paperW/scale,viewH=paperH/scale;
    const left=(g.width-viewW)/2,top=(g.height-viewH)/2;
    return {paperW,paperH,scale,viewW,viewH,left,top,landscape};
  }

  function drawGrid(width,height,anchor){
    const p=state.paperFrame;
    const phase=anchor||{x:0,y:0};
    const cell=GRID/(p?.scale||1),majorCell=cell*5;
    const ox=((phase.x%cell)+cell)%cell,oy=((phase.y%cell)+cell)%cell;
    svg.setAttribute('data-grid-phase-x',String(ox));
    svg.setAttribute('data-grid-phase-y',String(oy));
    svg.setAttribute('data-grid-cell-units',String(cell));
    svg.setAttribute('data-grid-cell-mm','5');
    const defs=E('defs');
    const minor=E('pattern',{id:'minorGrid',x:ox,y:oy,width:cell,height:cell,patternUnits:'userSpaceOnUse'});
    // Keep ink thickness constant in *physical* A4 mm. Without this the
    // grid virtually disappears when a large construction is reduced.
    minor.append(E('path',{d:'M '+cell+' 0 L 0 0 0 '+cell,class:'grid-minor',
      fill:'none',style:'stroke-width:'+(0.14/(p?.scale||1))}));
    defs.append(minor);
    const major=E('pattern',{id:'majorGrid',x:ox,y:oy,width:majorCell,height:majorCell,patternUnits:'userSpaceOnUse'});
    major.append(E('path',{d:'M '+majorCell+' 0 L 0 0 0 '+majorCell,class:'grid-major',
      fill:'none',style:'stroke-width:'+(0.24/(p?.scale||1))}));
    defs.append(major);
    const marker=E('marker',{id:'axisArrow',viewBox:'0 0 10 10',refX:'8',refY:'5',markerWidth:'4',markerHeight:'4',orient:'auto-start-reverse'});
    marker.append(E('path',{d:'M 0 0 L 10 5 L 0 10 z',class:'axis-arrow'}));
    defs.append(marker);
    svg.append(defs);
    const x=p?.left||0,y=p?.top||0,w=p?.viewW||width,h=p?.viewH||height;
    svg.append(E('rect',{x,y,width:w,height:h,fill:'url(#minorGrid)'}));
    svg.append(E('rect',{x,y,width:w,height:h,fill:'url(#majorGrid)'}));
    const inset=10/(p?.scale||1);
    svg.append(E('rect',{x:x+inset,y:y+inset,width:w-2*inset,height:h-2*inset,
      class:'paper-safe-area',style:'stroke-width:'+(0.22/(p?.scale||1))}));
    svg.append(E('rect',{x,y,width:w,height:h,class:'paper-outline',
      style:'stroke-width:'+(0.3/(p?.scale||1))}));
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
    const tx=(a.x+b.x)/2+n.x*2,ty=(a.y+b.y)/2+n.y*2;
    const label=E('text',{x:tx,y:ty,class:'dimension-text','text-anchor':'middle'},e.label);
    g.append(label);
    svg.append(g);
    // Reposition only the measurement text if it covers an existing
    // annotation. The actual measured endpoints and dimension strokes
    // must stay exactly where the construction placed them.
    const peers=[...svg.querySelectorAll('text')].filter(t=>t!==label);
    if(peers.length && typeof label.getBBox==='function' &&
       peers.every(peer=>typeof peer.getBBox==='function')){
      const ink=paperInkScale();
      const shifts=[
        [0,0],[n.x*4,n.y*4],[-n.x*4,-n.y*4],
        [n.x*8,n.y*8],[-n.x*8,-n.y*8],
        [u.x*6,u.y*6],[-u.x*6,-u.y*6],
        [n.x*4+u.x*6,n.y*4+u.y*6],
        [n.x*4-u.x*6,n.y*4-u.y*6]
      ];
      let best=Infinity,chosen=shifts[0];
      for(let i=0;i<shifts.length;i++){
        const [dx,dy]=shifts[i];
        label.setAttribute('x',tx+dx*ink);
        label.setAttribute('y',ty+dy*ink);
        const box=label.getBBox();
        let overlap=0;
        for(const peer of peers){
          const p=peer.getBBox();
          const w=Math.max(0,Math.min(box.x+box.width,p.x+p.width)-Math.max(box.x,p.x));
          const h=Math.max(0,Math.min(box.y+box.height,p.y+p.height)-Math.max(box.y,p.y));
          overlap+=w*h/Math.max(1,Math.min(box.width*box.height,p.width*p.height));
        }
        const score=overlap+i*.012;
        if(score<best){best=score;chosen=shifts[i];}
        if(overlap<.03)break;
      }
      label.setAttribute('x',tx+chosen[0]*ink);
      label.setAttribute('y',ty+chosen[1]*ink);
    }
  }

  function drawArc(e,active){
    const x0=e.c.x+Math.cos(e.a0)*e.r, y0=e.c.y+Math.sin(e.a0)*e.r;
    const x1=e.c.x+Math.cos(e.a1)*e.r, y1=e.c.y+Math.sin(e.a1)*e.r;
    const large=Math.abs(e.a1-e.a0)>Math.PI?1:0;
    svg.append(E('path',{d:'M '+x0+' '+y0+' A '+e.r+' '+e.r+' 0 '+large+' 1 '+x1+' '+y1,class:'dimension'+(active?' active-line':'')}));
    if(e.label) svg.append(E('text',{x:e.c.x+e.r+2,y:e.c.y-2,class:'dimension-text'},e.label));
  }

  // Identify labels of projected straight lines, rather than named points.
  // Point labels are emitted by point() and keep their own end-point offset.
  function isProjectedLineLabel(label){
    return /^(?:[a-wа-яёℓβΒ][a-zа-яёA-ZА-ЯΣΔΘΓΒ′']*|ЛС)[₁₂]$/u.test(label||'');
  }

  // Every labelled stroke is already a line entity in the CURRENT construction
  // step. Match the immediately preceding stroke, as source- and answer-line
  // builders emit line(), textEntity() in that order. The actual paper points
  // and answer geometry must not be changed just to improve label placement.
  function positionedLineLabel(entities,index){
    const text=entities[index];
    if(text?.type!=='text'||!isProjectedLineLabel(text.label))return null;
    for(let k=index-1;k>=0;k--){
      const stroke=entities[k];
      if(stroke.type!=='line'||stroke.cls==='axis'||
         stroke.cls==='source-guide-line'||stroke.arrow)continue;
      const vx=stroke.b.x-stroke.a.x,vy=stroke.b.y-stroke.a.y;
      const length=Math.hypot(vx,vy);
      if(!(length>1e-6))continue;
      // Place near the middle, above/alongside the stroke with a clear gap.
      // No overlap with its vertices and no confusion with point subscripts.
      const off=4.1*paperInkScale();
      return {
        x:(stroke.a.x+stroke.b.x)/2+(-vy/length)*off,
        y:(stroke.a.y+stroke.b.y)/2+(vx/length)*off,
        along:{x:vx/length,y:vy/length,length}
      };
    }
    return null;
  }

  // Preserve original coordinates; compensate only typographic and stroke
  // sizes when a large construction is reduced to a physical A4 sheet.
  function paperInkScale(){
    const paperReduction=state.paperFrame?.scale||1;
    return Math.min(3.5,Math.max(1,.9/paperReduction));
  }

  function drawEntity(e,active){
    if(e.type==='line'){
      let start=e.a,end=e.b;
      if(e.sourceContinuation||e.axonometricGuide){
        const scale=state.paperFrame?.scale||1;
        const v=vec2(start,end),length=norm2(v);
        // A light construction line may run slightly PAST its intersection.
        // Never move the intersection, the original printed segment, or
        // any other construction object. On the physical A4 sheet extend
        // only a near-invisible source-line continuation to 2.7 mm.
        // The same minimal overrun makes a very small axonometric
        // coordinate component readable without moving its exact bend.
        if(length>EPS && length*scale<2.1)
          end=add2(end,mul2(v,(2.7/scale-length)/length));
      }
      if(e.rightAngleMark){
        const mark=e.rightAngleMark,scale=state.paperFrame?.scale||1;
        // A right-angle mark should be about 4 mm on the physical page,
        // not an unreadable 1–2 mm after layout reduction. Its two strokes
        // remain mathematically perpendicular and attached to the same
        // original vertex. Limit its size to the actual supporting segments.
        const m=Math.max(mark.size,Math.min(4/scale,mark.available*.45));
        // Derive the vertex from the already normalized line coordinates.
        // Metadata captured before normalizeSteps must NEVER store absolute
        // geometry: such a stale anchor moved glyphs outside the A4 sheet.
        const P=mark.part===0
          ? add2(e.a,mul2(mark.u,-mark.size))
          : add2(e.b,mul2(mark.v,-mark.size));
        const A=add2(P,mul2(mark.u,m));
        const C=add2(P,mul2(mark.v,m));
        const B=add2(A,mul2(mark.v,m));
        if(mark.part===0){start=A;end=B;}
        else {start=B;end=C;}
      }
      const n=E('line',{
        x1:start.x,y1:start.y,x2:end.x,y2:end.y,
        class:'draw-line '+e.cls+(active?' active-line':''),
        'data-active':active?'1':'0',
        'data-role':e.role||lineRole(e.cls),
        'data-created-step':Number.isInteger(e.step)?e.step+1:null,
        'data-right-angle-mark':e.rightAngleMark?'1':null,
        'data-source-given-line':e.sourceGivenLine?'1':null,
        'data-source-continuation':e.sourceContinuation?'1':null,
        'data-axonometric-guide':e.axonometricGuide?'1':null,
        'data-source-coincident-aux':e.sourceCoincidentAux?'1':null
      });
      if(e.arrow) n.setAttribute('marker-end','url(#axisArrow)');
      svg.append(n);
    } else if(e.type==='point'){
      const ink=paperInkScale();
      const n=E('circle',{cx:e.p.x,cy:e.p.y,
        r:(e.cls.includes('answer')?1.05:.88)*ink,
        class:e.cls+(active?' active-dot':''),'data-active':active?'1':'0','data-label':e.label||'','data-role':e.role||pointRole(e.cls)});
      svg.append(n);
      if(e.label){
        // A later step may re-highlight exactly the same named point. Keep
        // the active dot but never print that name twice at the same spot.
        const alreadyDrawn=[...svg.querySelectorAll('circle[data-label]')]
          .some(prev=>prev!==n && prev.getAttribute('data-label')===e.label &&
            Math.abs(Number(prev.getAttribute('cx'))-e.p.x)<1e-5 &&
            Math.abs(Number(prev.getAttribute('cy'))-e.p.y)<1e-5);
        if(!alreadyDrawn){
          const label=E('text',{x:e.p.x+2.1*ink,y:e.p.y-2*ink,
            class:'svg-label','data-active':active?'1':'0'},e.visualLabel||e.label);
          svg.append(label);
          // Only move the ink of a point name, not its dot or its
          // projector. Reposition only when it covers another text label.
          if(typeof label.getBBox==='function'){
            const others=[...svg.querySelectorAll('text')].filter(t=>t!==label);
            const candidates=[
              [2.1,-2,'start'],[-2.1,-2,'end'],
              [2.1,5,'start'],[-2.1,5,'end'],
              [2.1,-7,'start'],[-2.1,-7,'end'],
              [6,-2,'start'],[-6,-2,'end']
            ];
            let best=Infinity,bestCandidate=candidates[0];
            for(const [i,candidate] of candidates.entries()){
              const [dx,dy,anchor]=candidate;
              label.setAttribute('x',e.p.x+dx*ink);
              label.setAttribute('y',e.p.y+dy*ink);
              label.setAttribute('text-anchor',anchor);
              const a=label.getBBox();
              let overlap=0;
              for(const t of others){
                const b=t.getBBox();
                const w=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
                const h=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
                overlap+=w*h/Math.max(1,Math.min(a.width*a.height,b.width*b.height));
              }
              const score=overlap+i*.012;
              if(score<best){best=score;bestCandidate=candidate;}
              if(overlap<.03)break;
            }
            label.setAttribute('x',e.p.x+bestCandidate[0]*ink);
            label.setAttribute('y',e.p.y+bestCandidate[1]*ink);
            label.setAttribute('text-anchor',bestCandidate[2]);
          }
        }
      }
    } else if(e.type==='text'){
      // Sections can be restated on later steps; the first visible
      // annotation already identifies the same segment.
      const duplicate=[...svg.querySelectorAll('text[data-label]')].some(el=>
        el.getAttribute('data-label')===e.label &&
        Math.abs(Number(el.getAttribute('x'))-e.p.x)<.1 &&
        Math.abs(Number(el.getAttribute('y'))-e.p.y)<.1);
      if(!duplicate){
        const label=E('text',{x:e.p.x,y:e.p.y,class:e.cls,
          'text-anchor':e.lineLabel?'middle':null,
          'data-line-label':e.lineLabel?'1':null,
          'data-label':e.label||'',
          'data-active':active?'1':'0'},e.label);
        svg.append(label);
        // If two projected line names meet near the crossing of their
        // source strokes, slide the newer label ALONG its own stroke,
        // not toward a point or a detached free-floating position.
        const along=e.lineLabel&&e.p.along;
        if(along&&typeof label.getBBox==='function'){
          // Include already rendered point names and dimensions as well
          // as other line labels: a line name must not cover B₁ (04/6)
          // even when it does not overlap another line name.
          const peers=[...svg.querySelectorAll('text')]
            .filter(t=>t!==label&&typeof t.getBBox==='function');
          if(peers.length){
            const original=label.getBBox();
            const clash=box=>peers.reduce((sum,t)=>{
              const p=t.getBBox();
              const w=Math.max(0,Math.min(box.x+box.width,p.x+p.width)-Math.max(box.x,p.x));
              const h=Math.max(0,Math.min(box.y+box.height,p.y+p.height)-Math.max(box.y,p.y));
              return sum+w*h/Math.max(1,Math.min(box.width*box.height,p.width*p.height));
            },0);
            if(clash(original)>.2){
              const slide=Math.min(9*paperInkScale(),along.length*.17);
              const shifts=[0,-slide,slide,-2*slide,2*slide];
              let bestScore=Infinity,bestT=0;
              for(let i=0;i<shifts.length;i++){
                const t=shifts[i];
                label.setAttribute('x',e.p.x+along.x*t);
                label.setAttribute('y',e.p.y+along.y*t);
                const overlap=clash(label.getBBox());
                const score=overlap+i*.012;
                if(score<bestScore){bestScore=score;bestT=t;}
                if(overlap<.03)break;
              }
              label.setAttribute('x',e.p.x+along.x*bestT);
              label.setAttribute('y',e.p.y+along.y*bestT);
            }
          }
        }
      }
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
    // Animate continuous strokes only. Overriding strokeDasharray on a
    // hidden-line destroys its 3/2 dashed visibility notation.
    const nodes=[...svg.querySelectorAll('[data-active="1"].draw-line:not(.hidden-line)')];
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
    [...svg.querySelectorAll('[data-active="1"]')].filter(n=>!n.classList.contains('draw-line')||n.classList.contains('hidden-line')).forEach(n=>{
      n.animate([{opacity:0},{opacity:1}],{duration:380,easing:'ease-out'});
    });
    const s=state.steps[state.step];
    if(s && s.tool) drawTool(s.tool);
  }

  // All of the current instruction belongs on one scrollable page.
  // Splitting sentences and measurements into unrelated mini-pages made the
  // drafting sequence hard to follow, especially on a narrow phone.
  function paginateStepText(value){
    return [String(value||'').trim()];
  }

  function stepTextLimit(){ return 10000; }

  function stepInfoPages(st,mode){
    if(mode==='action'){
      return [{text:st.action||'',items:st.measure||[]}];
    }
    if(mode==='measure'){
      return [{text:'Размеры и ориентиры для текущего построения',items:st.measure||[]}];
    }
    return [{text:mode==='why'?st.why||'':st.check||'',items:[]}];
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
    const paperScale=state.task<=3 ? (state.paperFrame?.scale||1) : 1;
    const reduced=paperScale<.999;
    const reductionLabel=reduced
      ? 'Масштаб A4 1:'+fmt(1/paperScale)+': расстояния из условия на листе откладывай в '+fmt(1/paperScale)+' раза меньше. '
      : '';
    $('stepInfoText').textContent=(reduced&&['action','check'].includes(mode)
      ? reductionLabel:'')+(page.text||'');
    // Keep the original numerical condition intact, but show exactly how
    // many physical 5 mm cells the reduced drawing uses. This prevents
    // students from copying ten source cells when the A4 plan has five.
    const paperItems=(page.items||[]).map(item=>{
      if(!reduced||/^Сетка[: ]/.test(item))return item;
      return item.replace(/(\d+(?:[.,]\d+)?)\s*мм\s*=\s*\d+(?:[.,]\d+)?\s*клет(?:ок|ка|ки)/g,
        (_,raw)=>{
          const mm=Number(raw.replace(',','.'));
          return fmt(mm)+' мм по условию; на A4 '+fmt(mm*paperScale)+' мм = '+cellCount(mm*paperScale);
        });
    });
    $('stepInfoMeasure').innerHTML=paperItems.length
      ? '<p class="step-measure-heading">Размеры и ориентиры</p><ul class="step-measure-list">'+paperItems.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'
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
    // Titles wrap at the intended readable size. The mobile guidance sheet
    // scrolls when a long statement needs more room; never shrink to 11px.
    el.style.fontSize='';
    el.style.lineHeight='';
  }

  let lastGuidanceStepKey='';

  function renderExplanation(){
    const st=state.steps[state.step];
    $('stepNumber').textContent=String(state.step+1);
    $('stepTotal').textContent=String(state.steps.length);
    $('stepBadge').textContent='Шаг '+(state.step+1);
    $('stepTitle').textContent=st.title;
    $('stageCurrentCount').textContent='Шаг '+(state.step+1);
    $('stageCurrentTitle').textContent=st.title;
    const remoteHint=$('remoteSourceHint');
    if(remoteHint){
      const sourceKey=state.variant+'/'+state.task;
      if(remoteHint.dataset.sourceKey!==sourceKey){
        const details=$('remoteSourceDetails');
        if(details)details.open=false;
        remoteHint.dataset.sourceKey=sourceKey;
      }
      const isRemote12=state.variant==='12'&&state.task===6;
      const isRemote13=state.variant==='13'&&state.task===5;
      remoteHint.hidden=!(isRemote12||isRemote13);
      if(isRemote12||isRemote13) remoteHint.querySelector('.remote-source-message').textContent=
        window.SITEMATH_SCHEMES?.[state.variant]?.['task'+state.task]?.adaptedSource
          ? 'Показана учебная реконструкция с сохранёнными узлами и общим силуэтом. Она отличается от архивного рисунка; решение относится к этой схеме.'
          : isRemote13
            ? 'Точка ℓ∩Σ далека от рисунка. Её положение по скану ненадёжно: небольшое изменение наклона может перенести точку на другую сторону.'
            : 'Линия Σ∩Θ далека от рисунка. По скану можно проверить способ построения, но не точное место пересечения почти параллельных плоскостей.';
    }
    fitStepTitle();
    renderProblemBrief();
    $('stepAction').textContent=st.action;
    $('stepWhy').textContent=st.why;
    $('stepCheck').textContent=st.check;
    $('stepMeasure').innerHTML='<ul class="measure-list">'+(st.measure||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
    renderStepInfoPage(st);
    // Preserve scrolling while reading one step, but never carry an old
    // scroll position into a different task, variant, or construction step.
    const guidanceKey=String(state.variant)+'/'+state.task+'/'+state.step;
    if(guidanceKey!==lastGuidanceStepKey){
      const sheet=$('stepSheet');
      if(sheet)sheet.scrollTop=0;
      lastGuidanceStepKey=guidanceKey;
    }
    $('prevBtn').disabled=state.step===0;
    $('firstBtn').disabled=state.step===0;
    $('nextBtn').disabled=state.step===state.steps.length-1;
    $('lastBtn').disabled=state.step===state.steps.length-1;
    if($('mobilePrevBtn')) $('mobilePrevBtn').disabled=state.step===0;
    if($('mobileNextBtn')) $('mobileNextBtn').disabled=state.step===state.steps.length-1;
    syncPlayButtons();
  }

  function drawingZoom(){
    return state.screenZoom===null ? (state.focusMode ? currentStepFocusZoom() : currentFitZoom()) : state.screenZoom;
  }

  function visibleDrawingBounds(){
    const pts=[];
    for(let i=0;i<=state.step;i++){
      const st=state.steps[i];
      if(!st) continue;
      const shown=(i===0 && state.step===0 && st.sourceEntities)
        ? st.sourceEntities : st.entities||[];
      shown.forEach(e=>collectEntityPoints(e,pts));
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

  // Focus only changes camera/scroll position. The normalized Monge
  // drawing, 5 mm grid, all source lines and printer geometry remain intact.
  // Isolate the fixed original geometry of the assignment without
  // changing the step or moving the calculated intersection.
  function focusOriginalSource(){
    const g=state.geometry,wrap=document.querySelector('.paper-wrap');
    const original=state.steps[0];
    if(!g||!wrap||!original)return;
    const entities=original.sourceEntities?.length
      ? original.sourceEntities : original.entities||[];
    const pts=[];
    for(const e of entities){
      if(e.type==='text'||e.cls==='axis')continue;
      collectEntityPoints(e,pts);
    }
    const finite=pts.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    if(!finite.length)return;
    const margin=15,mm=96/25.4,viewport=visibleDrawingViewport();
    const cs=getComputedStyle(wrap),px=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
    const py=(parseFloat(cs.paddingTop)||0)+8;
    const minX=Math.min(...finite.map(p=>p.x))-margin;
    const maxX=Math.max(...finite.map(p=>p.x))+margin;
    const minY=Math.min(...finite.map(p=>p.y))-margin;
    const maxY=Math.max(...finite.map(p=>p.y))+margin;
    const p=state.paperFrame;
    const zoom=Math.max(.005,Math.min(3,
      Math.max(120,viewport.width-px)/(Math.max(70,maxX-minX)*p.scale*mm),
      Math.max(120,viewport.height-py)/(Math.max(70,maxY-minY)*p.scale*mm)));
    state.focusMode=false;
    state.screenZoom=zoom;
    applyDrawingZoom();
    requestAnimationFrame(()=>{
      wrap.scrollLeft=Math.max(0,(((minX+maxX)/2-p.left)*p.scale)*mm*zoom-viewport.width/2);
      wrap.scrollTop=Math.max(0,(((minY+maxY)/2-p.top)*p.scale)*mm*zoom-viewport.height/2);
    });
  }

  function currentStepBounds(){
    const g=state.geometry;
    if(!g)return {minX:0,minY:0,maxX:180,maxY:145};
    for(let index=state.step;index>=0;index--){
      const step=state.steps[index];
      const shown=index===0 && state.step===0 && step?.sourceEntities
        ? step.sourceEntities : step?.entities||[];
      const points=[];
      for(const e of shown){
        // Axes and long technical labels are not the local operation.
        if(e.cls==='axis'||e.type==='text')continue;
        collectEntityPoints(e,points);
      }
      const good=points.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
      if(!good.length)continue;
      return {
        minX:Math.max(0,Math.min(...good.map(p=>p.x))-16),
        maxX:Math.min(g.width,Math.max(...good.map(p=>p.x))+16),
        minY:Math.max(0,Math.min(...good.map(p=>p.y))-16),
        maxY:Math.min(g.height,Math.max(...good.map(p=>p.y))+16)
      };
    }
    return visibleDrawingBounds();
  }

  // On exceptionally distant section constructions the entire active
  // stroke can span thousands of paper millimetres. "К шагу" must focus
  // the new local operation rather than shrink every label to 3%.
  // This is camera-only: geometry and print scale are untouched.
  function localOperationBounds(){
    const full=currentStepBounds(),g=state.geometry;
    if(!g || (full.maxX-full.minX<600 && full.maxY-full.minY<600))
      return full;
    const entities=state.steps[state.step]?.entities||[];
    const dots=entities.filter(e=>e.type==='point'&&e.cls!=='source-guide-dot'&&
      e.p&&Number.isFinite(e.p.x)&&Number.isFinite(e.p.y));
    let anchor=dots.length?dots[dots.length-1].p:null;
    if(!anchor){
      const first=state.steps[0];
      const originals=first?.sourceEntities||first?.entities||[];
      const pts=[];
      originals.forEach(e=>{if(e.type!=='text')collectEntityPoints(e,pts)});
      const valid=pts.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
      const reference=valid.length
        ? {x:valid.reduce((a,p)=>a+p.x,0)/valid.length,
           y:valid.reduce((a,p)=>a+p.y,0)/valid.length}
        : {x:(full.minX+full.maxX)/2,y:(full.minY+full.maxY)/2};
      const candidates=entities.filter(e=>e.type==='line'&&e.cls!=='axis'&&e.a&&e.b);
      if(candidates.length){
        const candidatePoints=candidates.map(e=>{
          const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y;
          const denom=dx*dx+dy*dy||1;
          const t=Math.max(0,Math.min(1,
            ((reference.x-e.a.x)*dx+(reference.y-e.a.y)*dy)/denom));
          return {x:e.a.x+t*dx,y:e.a.y+t*dy};
        });
        anchor=candidatePoints.reduce((a,b)=>
          Math.hypot(b.x-reference.x,b.y-reference.y) <
          Math.hypot(a.x-reference.x,a.y-reference.y)?b:a);
      }
    }
    if(!anchor)return full;
    return {minX:Math.max(0,anchor.x-100),maxX:Math.min(g.width,anchor.x+100),
            minY:Math.max(0,anchor.y-100),maxY:Math.min(g.height,anchor.y+100)};
  }

  function currentStepFocusZoom(){
    const g=state.geometry;
    const wrap=document.querySelector('.paper-wrap');
    if(!g||!wrap)return 1;
    const viewport=visibleDrawingViewport(),bounds=localOperationBounds();
    const cs=getComputedStyle(wrap),mm=96/25.4;
    const p=state.paperFrame||makePaperFrame(g);
    const width=Math.max(65*p.scale,(bounds.maxX-bounds.minX)*p.scale);
    const height=Math.max(65*p.scale,(bounds.maxY-bounds.minY)*p.scale);
    const availableW=Math.max(120,viewport.width-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0));
    const availableH=Math.max(120,viewport.height-(parseFloat(cs.paddingTop)||0)-8);
    return Math.max(.005,Math.min(3,availableW/(width*mm),availableH/(height*mm)));
  }

  function focusCurrentStep(){
    const wrap=document.querySelector('.paper-wrap');
    if(!wrap||!state.geometry)return;
    const b=localOperationBounds(),z=drawingZoom(),mm=96/25.4,p=state.paperFrame;
    const viewport=visibleDrawingViewport(),cs=getComputedStyle(wrap);
    const padX=parseFloat(cs.paddingLeft)||0,padY=parseFloat(cs.paddingTop)||0;
    wrap.scrollLeft=Math.max(0,((b.minX+b.maxX)*.5-p.left)*p.scale*mm*z-viewport.width*.5+padX);
    wrap.scrollTop=Math.max(0,((b.minY+b.maxY)*.5-p.top)*p.scale*mm*z-viewport.height*.5+padY);
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
    const p=state.paperFrame||makePaperFrame(g);
    const cs=getComputedStyle(wrap);
    const px=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
    const py=(parseFloat(cs.paddingTop)||0)+8;
    const viewport=visibleDrawingViewport();
    const availableW=Math.max(120,viewport.width-px);
    const availableH=Math.max(120,viewport.height-py);
    // Fit the complete real A4 page, never an arbitrarily huge schematic.
    return Math.max(.005,Math.min(1,availableW/(p.paperW*cssMm),
      availableH/(p.paperH*cssMm)));
  }

  function focusVisibleDrawing(){
    const wrap=document.querySelector('.paper-wrap');
    if(!wrap||!state.geometry) return;
    const z=drawingZoom(),cssMm=96/25.4,p=state.paperFrame;
    if(!p)return;
    const viewport=visibleDrawingViewport();
    // Keep the complete A4 sheet centered when it is too large for the
    // viewport; CSS layout centers smaller sheets via auto margins.
    wrap.scrollLeft=Math.max(0,(p.paperW*cssMm*z-viewport.width)/2);
    wrap.scrollTop=Math.max(0,(p.paperH*cssMm*z-viewport.height)/2);
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
    const p=state.paperFrame||makePaperFrame(g);
    svg.style.width=(p.paperW*cssMm*z)+'px';
    svg.style.height=(p.paperH*cssMm*z)+'px';
    $('zoomLabel').textContent=(z<.1?(z*100).toFixed(1):Math.round(z*100))+'%';
    if(state.screenZoom===null){
      requestAnimationFrame(()=>{
        if(state.focusMode){
          focusCurrentStep();
        }else{
          focusVisibleDrawing();
          requestAnimationFrame(()=>{
            ensureDrawingClearOfStepSheet();
            requestAnimationFrame(ensureDrawingClearOfStepSheet);
          });
        }
      });
    }
  }

  function setZoomAround(next,anchor){
    const wrap=document.querySelector('.paper-wrap');
    if(!wrap||!state.geometry) return;
    const prev=Math.max(.001,drawingZoom());
    // Keep the actual SVG coordinate beneath the pointer while zooming.
    // Measuring rectangles also handles a centered page that is initially
    // smaller than the scrollport (the old padding-only math could jump).
    const before=svg.getBoundingClientRect();
    const viewport=wrap.getBoundingClientRect();
    const ax=anchor&&Number.isFinite(anchor.x)?anchor.x:wrap.clientWidth/2;
    const ay=anchor&&Number.isFinite(anchor.y)?anchor.y:wrap.clientHeight/2;
    const clientX=viewport.left+ax,clientY=viewport.top+ay;
    const ratioX=Math.max(0,Math.min(1,(clientX-before.left)/Math.max(1,before.width)));
    const ratioY=Math.max(0,Math.min(1,(clientY-before.top)/Math.max(1,before.height)));
    state.focusMode=false;
    state.screenZoom=Math.max(.005,Math.min(6,next));
    applyDrawingZoom();
    const after=svg.getBoundingClientRect();
    wrap.scrollLeft+=after.left+after.width*ratioX-clientX;
    wrap.scrollTop+=after.top+after.height*ratioY-clientY;
  }

  function setDrawingZoom(mode){
    if(mode==='step'){
      state.focusMode=true;
      state.screenZoom=null;
      applyDrawingZoom();
      return;
    }
    if(mode==='fit'){
      state.focusMode=false;
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
    let mouseDrag=null;
    // Maps-style drag: left mouse button or middle mouse button moves the
    // drawing without changing scale or construction coordinates.
    wrap.addEventListener('pointerdown',ev=>{
      if(ev.pointerType==='touch'||(ev.button!==0&&ev.button!==1)||!state.geometry)return;
      // Once dragged, stop auto-fit refocusing the page during the gesture.
      const current=drawingZoom();
      state.screenZoom=current;
      state.focusMode=false;
      mouseDrag={id:ev.pointerId,x:ev.clientX,y:ev.clientY,
        left:wrap.scrollLeft,top:wrap.scrollTop};
      wrap.classList.add('is-panning');
      if(wrap.setPointerCapture)wrap.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    wrap.addEventListener('pointermove',ev=>{
      if(!mouseDrag||ev.pointerId!==mouseDrag.id)return;
      wrap.scrollLeft=mouseDrag.left-(ev.clientX-mouseDrag.x);
      wrap.scrollTop=mouseDrag.top-(ev.clientY-mouseDrag.y);
      ev.preventDefault();
    });
    const stopMouseDrag=ev=>{
      if(!mouseDrag||ev.pointerId!==mouseDrag.id)return;
      mouseDrag=null;
      wrap.classList.remove('is-panning');
      if(wrap.hasPointerCapture?.(ev.pointerId))wrap.releasePointerCapture(ev.pointerId);
    };
    wrap.addEventListener('pointerup',stopMouseDrag);
    wrap.addEventListener('pointercancel',stopMouseDrag);
    wrap.addEventListener('lostpointercapture',ev=>{
      if(mouseDrag?.id===ev.pointerId){mouseDrag=null;wrap.classList.remove('is-panning');}
    });

    const pointOf=ev=>{
      const r=wrap.getBoundingClientRect();
      return {x:ev.clientX-r.left,y:ev.clientY-r.top};
    };
    const values=()=>[...pointers.values()];
    const distance=pts=>Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    const center=pts=>({x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2});

    // Mouse-wheel zoom is scoped to the drawing surface. In particular,
    // Ctrl+wheel must NOT trigger the browser's page-level zoom here.
    // Everywhere else on the page the browser keeps its normal behavior.
    wrap.addEventListener('wheel',ev=>{
      if(!state.geometry || ev.deltaY===0)return;
      ev.preventDefault();
      const pixels=ev.deltaY*(ev.deltaMode===1?16:ev.deltaMode===2?wrap.clientHeight:1);
      const limited=Math.max(-240,Math.min(240,pixels));
      const factor=Math.exp(-limited*0.0018);
      setZoomAround(drawingZoom()*factor,pointOf(ev));
    },{passive:false});

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


  // Move the existing 5 mm grid, not the source drawing. Prefer an
  // original named point or a documented intersection over the arbitrary
  // end of a traced line. Choose the best anchor for all available givens,
  // so more of the original geometry lies on crossings of the paper grid.
  function drawingGridAnchor(){
    if(state.task<=3)return {x:0,y:0};

    // The visible x₁₂ and z/y reference axes are the useful notebook rulers.
    // Snap the EXISTING grid phase to their crossing, never to a random
    // source point. Both axes then coincide with continuous grid lines.
    // This keeps a stable phase even before the axes appear at step two.
    const axisStep=state.steps?.find(step=>{
      const a=(step.entities||[]).filter(e=>e.type==='line'&&e.cls==='axis');
      return a.length>=2;
    });
    const axes=(axisStep?.entities||[]).filter(e=>e.type==='line'&&e.cls==='axis');
    const vertical=axes.find(e=>Math.abs(e.a.x-e.b.x)<1e-6);
    const horizontal=axes.find(e=>Math.abs(e.a.y-e.b.y)<1e-6);
    if(vertical&&horizontal)return {x:vertical.a.x,y:horizontal.a.y};

    const first=state.steps?.[0];
    const entities=first?.sourceEntities||first?.entities||[];
    const candidates=[],points=[];
    const add=(p,weight,isPoint)=>{
      if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y))return;
      const item={p,weight};
      points.push(item);
      if(isPoint)candidates.push(item);
    };
    for(const e of entities){
      if(e.type==='point'){
        add(e.p,e.label?12:4,true);
      }else if(e.type==='line' && e.cls?.includes('object-line')){
        add(e.a,1,false);
        add(e.b,1,false);
      }
    }
    // In line-only schemes segment endpoints are the available placement
    // reference. On the next steps, keep exactly the same phase.
    if(!candidates.length)candidates.push(...points);
    if(!candidates.length)return {x:0,y:0};
    const periodic=v=>((v%GRID)+GRID)%GRID;
    const wrappedDistance=(value,phase)=>{
      const diff=Math.abs(periodic(value)-periodic(phase));
      return Math.min(diff,GRID-diff);
    };
    let best=candidates[0],bestScore=-Infinity;
    for(const anchor of candidates){
      let score=0;
      for(const item of points){
        const dx=wrappedDistance(item.p.x,anchor.p.x);
        const dy=wrappedDistance(item.p.y,anchor.p.y);
        const d2=dx*dx+dy*dy;
        score+=item.weight*Math.exp(-d2/(2*.85*.85));
      }
      if(score>bestScore+1e-9){bestScore=score;best=anchor;}
    }
    return {x:best.p.x,y:best.p.y};
  }

  function renderDrawing(){
    const g=state.geometry;
    const p=state.paperFrame||makePaperFrame(g);
    state.paperFrame=p;
    svg.replaceChildren();
    svg.setAttribute('viewBox',[p.left,p.top,p.viewW,p.viewH].join(' '));
    // The original reconstruction scale is unchanged; page reduction is separate.
    svg.setAttribute('data-paper-scale',String(g.paperScale||1));
    svg.setAttribute('data-layout-scale',String(p.scale));
    const ink=paperInkScale();
    svg.style.setProperty('--paper-ink-scale',String(ink));
    svg.setAttribute('data-ink-scale',String(ink));
    svg.setAttribute('data-paper-format','A4');
    svg.setAttribute('width',p.paperW+'mm');
    svg.setAttribute('height',p.paperH+'mm');
    drawGrid(g.width,g.height,drawingGridAnchor());
    const visibilityDone=state.task===5 && state.steps
      .slice(0,state.step+1).some(step=>step.title?.startsWith('Нанеси видимость '));
    state.steps.forEach((s,idx)=>{
      if(idx>state.step) return;
      const entities=idx===0 && state.step===0 && s.sourceEntities
        ? s.sourceEntities : s.entities||[];
      entities.forEach((e,index)=>{
        // Once visibility is shown, neither the original unbroken ℓ nor the
        // coincident Ω guide may fill the gaps of hidden strokes. Preserve
        // their labels and restore both lines when stepping backward.
        if(visibilityDone && (e.sourceGivenLine||e.sourceCoincidentAux||e.visibilityScaffold)) return;
        const placement=positionedLineLabel(entities,index);
        drawEntity(placement?{...e,p:placement,lineLabel:true}:e,idx===state.step);
      });
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


  // Show the commission notice once on every page load, not on internal
  // course/assignment navigation. A close action dismisses it for this load.
  let offerFocusReturn=null;
  function openOfferDetails(){
    const overlay=$('offerOverlay');
    if(!overlay||!overlay.hidden)return;
    offerFocusReturn=document.activeElement;
    const picker=$('firstRunPicker');
    if(picker&&!picker.hidden)picker.inert=true;
    overlay.hidden=false;
    document.body.classList.add('offer-modal-open');
    $('offerCloseBtn')?.focus();
  }
  function showWelcomeOffer(){
    openOfferDetails();
  }
  function closeOfferDetails(){
    const overlay=$('offerOverlay');
    if(!overlay||overlay.hidden)return;
    overlay.hidden=true;
    document.body.classList.remove('offer-modal-open');
    const picker=$('firstRunPicker');
    if(picker)picker.inert=false;
    // On the first visit the underlying view is the variant chooser; restore
    // keyboard focus there rather than to a hidden drawing control.
    const firstCourse=picker&&!picker.hidden
      ?picker.querySelector('#courseCatalog .course-card'):null;
    const prior=offerFocusReturn&&offerFocusReturn!==document.body&&
      offerFocusReturn.getClientRects().length?offerFocusReturn:null;
    const target=prior||firstCourse||
      ($('mobileSetupBtn')&&innerWidth<=760?$('mobileSetupBtn'):$('lastBtn'));
    target?.focus();
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
    state.paperFrame=makePaperFrame(solved);
    state.steps=solved.steps;
    if(resetStep!==false) state.step=0;
    state.step=Math.max(0,Math.min(state.step,state.steps.length-1));
    const p=state.paperFrame;
    const denominator=Number((1/p.scale).toFixed(2));
    if(state.task<=3){
      $('scaleValue').textContent='1:'+denominator+' (размеры задания пересчитываются)';
      $('gridValue').textContent='5 мм – одна клетка на A4';
    } else {
      $('scaleValue').textContent='схема уменьшена под A4, исходных мм нет';
      $('gridValue').textContent='5 мм – одна клетка на A4';
    }
    $('sheetSize').textContent='A4 '+p.paperW+' × '+p.paperH+' мм';
    const paperInfo=$('paperCopyInfo');
    if(paperInfo) paperInfo.textContent=state.task<=3
      ? 'A4 '+p.paperW+' × '+p.paperH+' мм · клетка 5 мм · масштаб 1:'+denominator+
        (denominator===1?' · размеры на рисунке совпадают с листом':
          ' · размеры из условия при переносе дели на '+denominator)
      : 'A4 '+p.paperW+' × '+p.paperH+
        ' мм · клетка 5 мм · пропорциональная схема, без исходного масштаба';
    $('diagramStatus').textContent=solved.diagramPending?'нужна исходная схема':'решаются автоматически';
    renderDrawing();
  }

  // For task 3 the intersection K is a free point on the GIVEN segment
  // AB. Choose a position that separates C and K in BOTH projections instead
  // of mechanically using the midpoint, which gives almost invisible ℓ₂
  // in some original variants. Never modify the coordinates of A, B or C.
  function informativeKPercent(variant){
    const data=DATA.variants?.[variant]?.task3;
    if(!data || !['A','B','C'].every(k=>Array.isArray(data[k]) &&
      data[k].length===3 && data[k].every(Number.isFinite))) return 50;
    const {A,B,C}=data;
    const norm=(x,y)=>Math.hypot(x,y);
    const sin=(u,v,w)=>{
      const abx=v[0]-u[0],aby=v[1]-u[1];
      const ckx=w[0]-u[0],cky=w[1]-u[1];
      const den=norm(abx,aby)*norm(ckx,cky);
      return den>1e-8?Math.abs(abx*cky-aby*ckx)/den:0;
    };
    const absin=Math.min(sin([A[0],A[1]],[B[0],B[1]],[C[0],C[1]]),
      sin([A[0],A[2]],[B[0],B[2]],[C[0],C[2]]));
    const score=p=>{
      const k=p/100,K=A.map((x,i)=>x+(B[i]-x)*k);
      const one=norm(K[0]-C[0],K[1]-C[1]);
      const two=norm(K[0]-C[0],K[2]-C[2]);
      return Math.min(one,two)*(.2+absin);
    };
    const midpoint=score(50);
    let best={percent:50,score:midpoint};
    for(let percent=20;percent<=80;percent++){
      const value=score(percent);
      if(value>best.score+1e-8)best={percent,score:value};
    }
    const basic=best.score>midpoint*1.5 && best.score-midpoint>=2
      ? best.percent:50;
    // The same source AB may cross the x12 axis in such a way that K1 and K2
    // almost coincide on the A4 sheet. The user must then draw an unreadable
    // one-millimetre projector despite a perfectly good CK. Rescue only
    // those free K choices while retaining at least 82% of CK legibility.
    const projectorSpan=percent=>{
      const k=percent/100;
      const y=A[1]+(B[1]-A[1])*k;
      const z=A[2]+(B[2]-A[2])*k;
      return Math.abs(y+z);
    };
    if(projectorSpan(basic)>=18)return basic;
    let rescue=null;
    for(let percent=20;percent<=80;percent++){
      if(projectorSpan(percent)<18 || score(percent)<score(basic)*.82)
        continue;
      const distance=Math.abs(percent-basic);
      if(!rescue||distance<rescue.distance||
         (distance===rescue.distance&&score(percent)>rescue.score))
        rescue={percent,distance,score:score(percent)};
    }
    return rescue?rescue.percent:basic;
  }

  function setDefaultKPosition(){
    const k=state.task===3?informativeKPercent(state.variant):50;
    $('kSlider').value=String(k);
    $('kOutput').textContent=k+'%';
    const hint=$('kSelectionHint');
    if(hint) hint.textContent=k===50
      ? 'Точка K находится внутри AB. Её положение можно изменить ползунком, не нарушая условие.'
      : 'Выбрано '+k+'% длины AB от A, чтобы линии CK и связь K₁K₂ были различимы на чертеже. Точку K можно переместить.';
  }

  function resetCurrent(){
    renderInputs();
    setDefaultKPosition();
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
  $('prevBtn').addEventListener('click',()=>moveTo(state.step-1));
  $('nextBtn').addEventListener('click',()=>moveTo(state.step+1));
  $('firstBtn').addEventListener('click',()=>moveTo(0));
  $('lastBtn').addEventListener('click',()=>moveTo(state.steps.length-1));
  $('playBtn').addEventListener('click',toggleAuto);
  $('zoomOutBtn').addEventListener('click',()=>setDrawingZoom('out'));
  $('zoomFitBtn').addEventListener('click',()=>setDrawingZoom('fit'));
  $('zoomFocusBtn').addEventListener('click',()=>setDrawingZoom('step'));
  $('zoom100Btn').addEventListener('click',()=>setDrawingZoom('100'));
  $('zoomInBtn').addEventListener('click',()=>setDrawingZoom('in'));
  $('mobileFitBtn').addEventListener('click',()=>setDrawingZoom('fit'));
  $('mobileFocusBtn').addEventListener('click',()=>setDrawingZoom('step'));
  $('zoomSourceBtn')?.addEventListener('click',focusOriginalSource);
  $('mobileSetupBtn').addEventListener('click',openMobileSetup);
  $('mobileSetupClose').addEventListener('click',closeMobileSetup);
  $('mobileBackdrop').addEventListener('click',closeMobileSetup);
  $('stepSheetToggle').addEventListener('click',toggleStepSheet);
  $('offerCloseBtn')?.addEventListener('click',closeOfferDetails);
  $('offerLaterBtn')?.addEventListener('click',closeOfferDetails);
  $('offerOverlay')?.addEventListener('click',event=>{
    if(event.target===$('offerOverlay'))closeOfferDetails();
  });
  document.addEventListener('keydown',event=>{
    const overlay=$('offerOverlay');
    if(!overlay||overlay.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeOfferDetails();return;}
    if(event.key!=='Tab')return;
    const focusable=[...overlay.querySelectorAll('button:not([disabled]),a[href]')];
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first.focus();
    }
  });
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
  $('catalogListBackBtn').addEventListener('click',handleCatalogBack);
  $('catalogBackBtn').addEventListener('click',showFirstRunPicker);
  $('mobileCatalogBackBtn').addEventListener('click',showFirstRunPicker);
  $('catalogCommissionBtn').addEventListener('click',openOfferDetails);
  window.addEventListener('resize',()=>{
    if(state.screenZoom===null) applyDrawingZoom();
    fitStepTitle();
    if(state.steps.length) renderStepInfoPage(state.steps[state.step]);
  });
  $('kSlider').addEventListener('input',()=>{
    $('kOutput').textContent=$('kSlider').value+'%';
    const hint=$('kSelectionHint');
    if(hint)hint.textContent='Точка K выбрана вручную. Она остаётся на AB; обе проекции перестраиваются автоматически.';
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
  // Always enter through the assignment library, even when a previous
  // variant was saved. Its selection is restored, so returning takes one
  // click and new albums remain discoverable on every visit.
  syncChoicePickers();
  showFirstRunPicker();
  showWelcomeOffer();
})();
