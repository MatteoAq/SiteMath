(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const GRID = 5;
  const EPS = 1e-7;
  const $ = (id) => document.getElementById(id);
  const svg = $('drawing');
  const inputs = ['Ax','Ay','Az','Bx','By','Bz','Cx','Cy','Cz'].map($);

  const state = {
    step: 0,
    playing: false,
    timer: null,
    geometry: null,
    steps: []
  };

  const preset = {
    A: {x: 0, y: 10, z: 50},
    B: {x: 30, y: 25, z: 30},
    C: {x: 50, y: 25, z: 60}
  };

  function el(name, attrs = {}, text = '') {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) node.setAttribute(k, String(v));
    }
    if (text) node.textContent = text;
    return node;
  }

  function htmlEscape(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function readPoint(prefix) {
    return {
      x: Number($(prefix + 'x').value),
      y: Number($(prefix + 'y').value),
      z: Number($(prefix + 'z').value)
    };
  }

  function finitePoint(p) {
    return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  }

  function sub3(a,b) { return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z}; }
  function add3(a,b) { return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z}; }
  function mul3(a,t) { return {x:a.x*t, y:a.y*t, z:a.z*t}; }
  function norm3(v) { return Math.hypot(v.x,v.y,v.z); }
  function cross3(a,b) {
    return {
      x:a.y*b.z-a.z*b.y,
      y:a.z*b.x-a.x*b.z,
      z:a.x*b.y-a.y*b.x
    };
  }
  function dist2(a,b) { return Math.hypot(a.x-b.x, a.y-b.y); }

  function collinear3D(C, A, B) {
    const AB = sub3(B,A), AC = sub3(C,A);
    return norm3(cross3(AB,AC)) <= 1e-5 * Math.max(1,norm3(AB),norm3(AC));
  }

  function onSegment3D(C, A, B) {
    const AB = sub3(B,A), AC = sub3(C,A);
    if (!collinear3D(C,A,B)) return false;
    const dot = AC.x*AB.x + AC.y*AB.y + AC.z*AB.z;
    const len2 = AB.x*AB.x + AB.y*AB.y + AB.z*AB.z;
    return dot >= -EPS && dot <= len2 + EPS;
  }

  function fmt(n, digits = 1) {
    const v = Math.abs(n) < 1e-9 ? 0 : n;
    return Number.isInteger(v) ? String(v) : v.toFixed(digits).replace('.', ',');
  }

  function directionText(value, positiveWord, negativeWord) {
    if (value > 0) return positiveWord;
    if (value < 0) return negativeWord;
    return 'не отмеряй – координата равна 0';
  }

  function validate(A,B,C) {
    if (![A,B,C].every(finitePoint)) return 'Все девять координат должны быть числами.';
    if (norm3(sub3(B,A)) < EPS) return 'A и B совпадают. Прямая AB не определяется одной точкой.';
    if ([A,B,C].some(p => Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z)) > 500)) {
      return 'Координаты больше 500 мм сделают учебный лист непрактичным. Уменьши диапазон значений.';
    }
    if (collinear3D(C,A,B) && !onSegment3D(C,A,B)) {
      return 'C лежит на прямой AB, но вне отрезка AB. Тогда отдельная прямая через C не может пересечь именно отрезок AB. Измени исходные данные.';
    }
    return '';
  }

  function tiltAngle(a,b) {
    const dx = Math.abs(b.x-a.x), dy = Math.abs(b.y-a.y);
    if (dx < EPS && dy < EPS) return null;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  function makeGeometry() {
    const A = readPoint('A'), B = readPoint('B'), C = readPoint('C');
    const error = validate(A,B,C);
    if (error) return { error };

    const kUser = Number($('kSlider').value) / 100;
    const cOnSegment = onSegment3D(C,A,B);
    const t = cOnSegment ? null : kUser;
    const K = cOnSegment ? {...C} : add3(A, mul3(sub3(B,A), t));

    const all = [A,B,C,K];
    const xs = all.map(p=>p.x), ys = all.map(p=>p.y), zs = all.map(p=>p.z);
    const maxX = Math.max(0, ...xs), minX = Math.min(0, ...xs);
    const maxY = Math.max(0, ...ys), minY = Math.min(0, ...ys);
    const maxZ = Math.max(0, ...zs), minZ = Math.min(0, ...zs);

    const leftExtent = maxX;
    const rightExtent = -minX;
    const aboveExtent = Math.max(maxZ, -minY);
    const belowExtent = Math.max(maxY, -minZ);
    const marginX = 22;
    const marginY = 22;
    const width = Math.max(180, leftExtent + rightExtent + marginX * 2);
    const height = Math.max(150, aboveExtent + belowExtent + marginY * 2);
    const originX = marginX + leftExtent + Math.max(0, (width - (leftExtent + rightExtent + marginX*2)) / 2);
    const axisY = marginY + aboveExtent + Math.max(0, (height - (aboveExtent + belowExtent + marginY*2)) / 2);

    const p1 = (p) => ({x: originX - p.x, y: axisY + p.y});
    const p2 = (p) => ({x: originX - p.x, y: axisY - p.z});
    const base = (p) => ({x: originX - p.x, y: axisY});

    const proj = {
      A1:p1(A), A2:p2(A), Ax:base(A),
      B1:p1(B), B2:p2(B), Bx:base(B),
      C1:p1(C), C2:p2(C), Cx:base(C),
      K1:p1(K), K2:p2(K), Kx:base(K)
    };

    const vAB1 = {x:proj.B1.x-proj.A1.x, y:proj.B1.y-proj.A1.y};
    const vAB2 = {x:proj.B2.x-proj.A2.x, y:proj.B2.y-proj.A2.y};
    const ext = Math.max(width,height) * 0.65;

    function extendedLine(P, v) {
      const n = Math.hypot(v.x,v.y);
      if (n < EPS) return null;
      const ux = v.x/n, uy = v.y/n;
      return {p1:{x:P.x-ux*ext,y:P.y-uy*ext}, p2:{x:P.x+ux*ext,y:P.y+uy*ext}};
    }

    return {
      A,B,C,K,t,kUser,cOnSegment,
      width,height,originX,axisY,proj,
      a1: extendedLine(proj.C1, vAB1),
      a2: extendedLine(proj.C2, vAB2),
      angleAB1: tiltAngle(proj.A1,proj.B1),
      angleAB2: tiltAngle(proj.A2,proj.B2),
      angleL1: tiltAngle(proj.C1,proj.K1),
      angleL2: tiltAngle(proj.C2,proj.K2)
    };
  }

  function lineEntity(step, a,b, cls='construction-line', opts={}) {
    return {type:'line',step,a,b,cls,...opts};
  }
  function pointEntity(step, p,label, cls='point-dot', opts={}) {
    return {type:'point',step,p,label,cls,...opts};
  }
  function dimEntity(step,a,b,label,offset={x:0,y:0}) {
    return {type:'dim',step,a,b,label,offset};
  }
  function tickEntity(step,p,label) { return {type:'tick',step,p,label}; }

  function angleText(label,angle) {
    if (angle === null) return label + ': проекция вырождена в точку.';
    return label + ': ≈ ' + fmt(angle,1) + '° к горизонтали.';
  }

  function addPointProjectionSteps(name,p,px,p1,p2,steps,g) {
    let idx = steps.length;
    steps.push({
      title:'Отложи x точки ' + name,
      action:'От O по оси x₁₂ отмерь ' + Math.abs(p.x) + ' мм ' + directionText(p.x,'влево','вправо') + ' и поставь ' + name + 'ₓ.',
      why:'Координата x определяет положение общей линии связи обеих проекций точки ' + name + '. На эпюре положительное x направлено влево.',
      measure:[p.x === 0 ? name + 'ₓ совпадает с O.' : 'O' + name + 'ₓ = ' + Math.abs(p.x) + ' мм = ' + fmt(Math.abs(p.x)/GRID,1) + ' клеток'],
      check:name + 'ₓ лежит на x₁₂.',
      entities:[tickEntity(idx,px,name + 'ₓ'), dimEntity(idx,{x:g.originX,y:g.axisY},px,Math.abs(p.x) + ' мм',{x:0,y:-4})],
      tool:{kind:'line',a:{x:g.originX,y:g.axisY},b:px}
    });

    idx = steps.length;
    steps.push({
      title:'Построй ' + name + '₁ на П₁',
      action:'Из ' + name + 'ₓ отмерь |y| = ' + Math.abs(p.y) + ' мм ' + directionText(p.y,'вниз','вверх') + ' и поставь ' + name + '₁.',
      why:'Горизонтальная проекция несёт координаты (x, y). После разворота П₁ положительная y откладывается вниз от x₁₂.',
      measure:[p.y === 0 ? name + '₁ лежит на оси x₁₂.' : Math.abs(p.y) + ' мм = ' + fmt(Math.abs(p.y)/GRID,1) + ' клеток'],
      check:'Расстояние от ' + name + '₁ до x₁₂ равно |y|.',
      entities:[lineEntity(idx,px,p1,'construction-line'), pointEntity(idx,p1,name + '₁'), dimEntity(idx,px,p1,Math.abs(p.y) + ' мм',{x:4,y:0})],
      tool:{kind:'line',a:px,b:p1}
    });

    idx = steps.length;
    steps.push({
      title:'Построй ' + name + '₂ на П₂',
      action:'Из ' + name + 'ₓ отмерь |z| = ' + Math.abs(p.z) + ' мм ' + directionText(p.z,'вверх','вниз') + ' и поставь ' + name + '₂.',
      why:'Фронтальная проекция несёт координаты (x, z). При положительном z она располагается выше оси x₁₂.',
      measure:[p.z === 0 ? name + '₂ лежит на x₁₂.' : Math.abs(p.z) + ' мм = ' + fmt(Math.abs(p.z)/GRID,1) + ' клеток'],
      check:name + '₁ и ' + name + '₂ находятся на одной линии связи, перпендикулярной x₁₂.',
      entities:[lineEntity(idx,px,p2,'construction-line'), pointEntity(idx,p2,name + '₂'), dimEntity(idx,px,p2,Math.abs(p.z) + ' мм',{x:-4,y:0})],
      tool:{kind:'line',a:px,b:p2}
    });
  }

  function buildSteps(g) {
    const {A,B,C,proj} = g;
    const steps = [];
    const push = (meta, entities=[], tool=null) => steps.push({...meta, entities, tool});

    push({
      title:'Подготовь лист и сетку',
      action:'Считай координаты миллиметрами. Одна клетка фона равна 5 мм, то есть 0,5 см. Масштаб – 1:1.',
      why:'В учебных заданиях такого типа координаты откладываются в миллиметрах. Сетка нужна только как удобная линейка, а не как другая система координат.',
      measure:['Клетка: 5 мм × 5 мм','Масштаб: 1:1'],
      check:'Любое значение 10 мм должно занимать ровно две клетки.'
    });

    push({
      title:'Проведи ось x₁₂',
      action:'Проведи горизонтальную ось x₁₂ через рабочее поле и отметь начало координат O.',
      why:'После совмещения П₁ и П₂ их общая ось x становится границей: фронтальные проекции при положительном z идут выше неё, горизонтальные при положительном y – ниже.',
      measure:['Ось горизонтальна','Положительное направление x на эпюре – влево от O'],
      check:'Слева от O будет +x, справа – −x.'
    }, [lineEntity(1,{x:8,y:g.axisY},{x:g.width-8,y:g.axisY},'axis',{arrow:true}), pointEntity(1,{x:g.originX,y:g.axisY},'O','point-dot')], {kind:'line',a:{x:8,y:g.axisY},b:{x:g.width-8,y:g.axisY}});

    addPointProjectionSteps('A',A,proj.Ax,proj.A1,proj.A2,steps,g);
    addPointProjectionSteps('B',B,proj.Bx,proj.B1,proj.B2,steps,g);
    addPointProjectionSteps('C',C,proj.Cx,proj.C1,proj.C2,steps,g);

    push({
      title:'Построй горизонтальную проекцию AB',
      action:'Соедини A₁ и B₁ прямой линией.',
      why:'Ортогональное проецирование переводит отрезок AB в отрезок между проекциями его концов. На П₁ это A₁B₁.',
      measure:[angleText('Наклон A₁B₁ к горизонтали',g.angleAB1)],
      check:'Линия обязана проходить точно через A₁ и B₁.'
    }, [lineEntity(steps.length,proj.A1,proj.B1,'object-line')], {kind:'line',a:proj.A1,b:proj.B1});

    push({
      title:'Построй фронтальную проекцию AB',
      action:'Соедини A₂ и B₂.',
      why:'Это та же пространственная прямая AB, но на фронтальной плоскости П₂.',
      measure:[angleText('Наклон A₂B₂ к горизонтали',g.angleAB2)],
      check:'A₁/A₂ и B₁/B₂ должны оставаться на своих общих вертикальных линиях связи.'
    }, [lineEntity(steps.length,proj.A2,proj.B2,'object-line')], {kind:'line',a:proj.A2,b:proj.B2});

    const a1Entities = g.a1
      ? [lineEntity(steps.length,g.a1.p1,g.a1.p2,'answer-line')]
      : [pointEntity(steps.length,proj.C1,'a₁ ≡ C₁','answer-dot')];

    push({
      title:'Через C₁ проведи a₁ ∥ A₁B₁',
      action:g.a1
        ? 'Приложи линейку вдоль A₁B₁, не меняя её наклона перенеси к C₁ и проведи a₁.'
        : 'A₁B₁ выродилась в точку: AB перпендикулярна П₁. Тогда горизонтальная проекция любой параллельной ей прямой тоже вырождается в точку C₁.',
      why:'Если пространственные прямые параллельны, их одноимённые проекции параллельны. Поэтому для a ∥ AB сохраняем направление A₁B₁ и A₂B₂.',
      measure:[g.angleAB1 === null ? 'На П₁ угол не измеряется – проекция AB является точкой.' : 'Сохрани наклон ' + fmt(g.angleAB1,1) + '° к горизонтали. Транспортир не нужен: проще перенести направление линейкой.'],
      check:g.a1 ? 'a₁ проходит через C₁ и не меняет направление относительно A₁B₁.' : 'a₁ совпадает с C₁ как точечная проекция.'
    }, a1Entities, g.a1 ? {kind:'line',a:g.a1.p1,b:g.a1.p2} : null);

    const a2Entities = g.a2
      ? [lineEntity(steps.length,g.a2.p1,g.a2.p2,'answer-line')]
      : [pointEntity(steps.length,proj.C2,'a₂ ≡ C₂','answer-dot')];

    push({
      title:'Через C₂ проведи a₂ ∥ A₂B₂',
      action:g.a2
        ? 'То же самое сделай на фронтальной проекции: a₂ через C₂ параллельно A₂B₂.'
        : 'A₂B₂ выродилась в точку: AB перпендикулярна П₂. Тогда a₂ тоже является точкой C₂.',
