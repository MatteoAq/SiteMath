(() => {
  'use strict';

  const DATA = window.SITEMATH_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const GRID = 5;
  const EPS = 1e-8;
  const $ = id => document.getElementById(id);
  const svg = $('drawing');

  const state = {
    variant: '10',
    task: 1,
    step: 0,
    steps: [],
    geometry: null,
    playing: false,
    timer: null
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

  function allVariantKeys(){
    return Object.keys(DATA.variants);
  }

  function initSelectors(){
    const vs=$('variantSelect');
    vs.innerHTML='';
    allVariantKeys().forEach(k=>{
      const o=document.createElement('option');
      o.value=k;
      o.textContent=DATA.variants[k].label;
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
      : (v && v.verifiedNumber===false ? 'Номер на присланном фото обрезан, поэтому лист специально не привязан к выдуманному номеру.' : 'Данные взяты с присланного листа ' + DATA.variants[state.variant].label + '.');

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
      holder.innerHTML =
        '<div class="diagram-info">' +
        '<p><b>Тип данных:</b> графическая схема на листе, а не координаты.</p>' +
        '<p>Для задач 4–6 нельзя восстановить точный ответ только по номеру варианта: положение исходных линий на листе является частью условия. Известные присланные схемы сейчас оцифровываются в векторный вид.</p>' +
        '</div>';
      $('solverMode').textContent='схема';
      $('taskStatement').textContent = info.statement || DATA.tasks[task].short;
    }
    holder.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>rebuild(true)));
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
    const b=bounds(raw,18);
    const dx=-b.minX, dy=-b.minY;
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
        zFoot:shiftPoint({x:0,y:-p.z},dx,dy)
      };
    });

    const complexWidth=b.width;
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
    const height=Math.max(b.height,bb.maxY+10,145);

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
      textEntity(0,{x:10,y:O.y-3},'+x'),
      textEntity(0,{x:complexWidth-16,y:O.y-3},'+y'),
      textEntity(0,{x:O.x+3,y:11},'+z'),
      textEntity(0,{x:O.x+3,y:height-9},'−z / развёртка')
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
        line(i,q.p2,q.p3,'construction-line'),
        line(i,q.yFoot,q.p3,'construction-line'),
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

    const raw=[
      {x:-A.x,y:A.y},{x:-A.x,y:-A.z},
      {x:-B.x,y:B.y},{x:-B.x,y:-B.z},{x:0,y:0}
    ];
    const b0=bounds(raw,24), sx=-b0.minX, sy=-b0.minY;
    const O={x:sx,y:sy};
    const A1=shiftPoint({x:-A.x,y:A.y},sx,sy);
    const A2=shiftPoint({x:-A.x,y:-A.z},sx,sy);
    const B1=shiftPoint({x:-B.x,y:B.y},sx,sy);
    const B2=shiftPoint({x:-B.x,y:-B.z},sx,sy);
    const Ax=shiftPoint({x:-A.x,y:0},sx,sy);
    const Bx=shiftPoint({x:-B.x,y:0},sx,sy);

    const A0=choosePerpPoint(A1,B1,Math.abs(dz3),1);
    const B0=choosePerpPoint(B2,A2,Math.abs(dy3),-1);
    const pts=[O,A1,A2,B1,B2,Ax,Bx,A0,B0];
    const bb=bounds(pts,18);
    const shx=bb.minX<0?-bb.minX:0, shy=bb.minY<0?-bb.minY:0;
    const S=p=>shiftPoint(p,shx,shy);
    const q={O:S(O),A1:S(A1),A2:S(A2),B1:S(B1),B2:S(B2),Ax:S(Ax),Bx:S(Bx),A0:S(A0),B0:S(B0)};
    const width=Math.max(170,bb.width), height=Math.max(150,bb.height);
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
    },[line(i,{x:8,y:q.O.y},{x:width-8,y:q.O.y},'axis'),point(i,q.O,'O')],{kind:'line',a:{x:8,y:q.O.y},b:{x:width-8,y:q.O.y}});

    i=steps.length;
    push({
      title:'Построй проекции точки A',
      action:'По xA = '+A.x+' мм поставь линию связи. От неё отложи yA = '+A.y+' мм и zA = '+A.z+' мм.',
      why:'A₁=(xA,yA), A₂=(xA,zA).',
      measure:['xA = '+A.x+' мм','yA = '+A.y+' мм','zA = '+A.z+' мм'],
      check:'A₁ и A₂ лежат на одной линии связи.'
    },[line(i,q.A1,q.A2,'construction-line'),point(i,q.A1,'A₁'),point(i,q.A2,'A₂')],{kind:'line',a:q.A1,b:q.A2});

    i=steps.length;
    push({
      title:'Построй проекции точки B',
      action:'Аналогично построй B₁ и B₂ по координатам B.',
      why:'B₁=(xB,yB), B₂=(xB,zB).',
      measure:['xB = '+B.x+' мм','yB = '+B.y+' мм','zB = '+B.z+' мм'],
      check:'B₁ и B₂ лежат на одной линии связи.'
    },[line(i,q.B1,q.B2,'construction-line'),point(i,q.B1,'B₁'),point(i,q.B2,'B₂')],{kind:'line',a:q.B1,b:q.B2});

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
    const raw=[
      {x:-A.x,y:A.y},{x:-A.x,y:-A.z},
      {x:-B.x,y:B.y},{x:-B.x,y:-B.z},
      {x:-C.x,y:C.y},{x:-C.x,y:-C.z},
      {x:-K.x,y:K.y},{x:-K.x,y:-K.z},{x:0,y:0}
    ];
    const b0=bounds(raw,25), sx=-b0.minX, sy=-b0.minY;
    const O={x:sx,y:sy};
    const P1=p=>shiftPoint({x:-p.x,y:p.y},sx,sy);
    const P2=p=>shiftPoint({x:-p.x,y:-p.z},sx,sy);
    const AX=p=>shiftPoint({x:-p.x,y:0},sx,sy);
    const q={
      A1:P1(A),A2:P2(A),B1:P1(B),B2:P2(B),C1:P1(C),C2:P2(C),
      K1:P1(K),K2:P2(K),Ax:AX(A),Bx:AX(B),Cx:AX(C)
    };
    const ext=Math.max(b0.width,b0.height)*.7;
    const a1=extendLine(q.C1,add2(q.C1,vec2(q.A1,q.B1)),ext);
    const a2=extendLine(q.C2,add2(q.C2,vec2(q.A2,q.B2)),ext);
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
    const width=Math.max(180,b0.width),height=Math.max(150,b0.height);
    const steps=[],push=(m,e,t)=>steps.push(Object.assign({},m,{entities:e||[],tool:t||null}));

    let i=0;
    push({
      title:'Проведи ось x₁₂',
      action:'Проведи горизонтальную ось x₁₂. Положительное x на таком эпюре откладываем влево от O.',
      why:'На одной вертикальной линии связи будут находиться горизонтальная и фронтальная проекции каждой точки.',
      measure:['1 клетка = 5 мм'],
      check:'Ось x₁₂ горизонтальна.'
    },[line(i,{x:8,y:O.y},{x:width-8,y:O.y},'axis'),point(i,O,'O')],{kind:'line',a:{x:8,y:O.y},b:{x:width-8,y:O.y}});

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
        line(j,p1,p2,'construction-line'),
        point(j,p1,name+'₁'),
        point(j,p2,name+'₂'),
        dim(j,O,px,Math.abs(p.x)+' мм',{x:0,y:-3})
      ],{kind:'line',a:p1,b:p2});
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

  function solveDiagramTask(task,stored){
    const steps=[];
    const title = task===4 ? 'Схема варианта нужна как исходные данные' : task===5 ? 'Положение исходных линий задаётся рисунком' : 'Обе плоскости задаются графически';
    steps.push({
      title,
      action:'У этой задачи нет таблицы координат: наклоны и взаимное положение линий на напечатанном листе являются частью условия.',
      why:'Поэтому подставлять произвольную схему было бы математически неверно. Для присланных вариантов исходные рисунки будут оцифрованы как векторные данные, а не угаданы.',
      measure:['Формулировка: '+((stored&&stored.statement)||DATA.tasks[task].short)],
      check:'Сайт не должен менять исходные наклоны линий варианта.',
      entities:[
        textEntity(0,{x:18,y:35},'Задание '+task,'svg-big-note'),
        textEntity(0,{x:18,y:48},'Исходная схема будет восстановлена с листа варианта','svg-note')
      ]
    });
    return {width:190,height:120,O:{x:95,y:60},steps,diagramPending:true};
  }
