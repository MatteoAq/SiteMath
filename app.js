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
    const AB3 = sub3(B,A);
    const K = cOnSegment ? {...C} : add3(A, mul3(AB3, t));
    const profileAB = Math.abs(AB3.x) < EPS;
    const D = profileAB ? add3(C, mul3(AB3, 0.5)) : null;

    const all = D ? [A,B,C,K,D] : [A,B,C,K];
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
      K1:p1(K), K2:p2(K), Kx:base(K),
      D1:D ? p1(D) : null, D2:D ? p2(D) : null, Dx:D ? base(D) : null
    };

    const vAB1 = {x:proj.B1.x-proj.A1.x, y:proj.B1.y-proj.A1.y};
    const vAB2 = {x:proj.B2.x-proj.A2.x, y:proj.B2.y-proj.A2.y};
    let lTarget = K;
    if (cOnSegment) {
      let d = {x:1,y:1,z:1};
      if (norm3(cross3(AB3,d)) <= EPS) d = {x:1,y:-1,z:1};
      lTarget = add3(C, mul3(d,30));
    }
    const lTarget1 = p1(lTarget);
    const lTarget2 = p2(lTarget);
    const vL1 = {x:lTarget1.x-proj.C1.x, y:lTarget1.y-proj.C1.y};
    const vL2 = {x:lTarget2.x-proj.C2.x, y:lTarget2.y-proj.C2.y};
    const ext = Math.max(width,height) * 0.65;

    function extendedLine(P, v) {
      const n = Math.hypot(v.x,v.y);
      if (n < EPS) return null;
      const ux = v.x/n, uy = v.y/n;
      return {p1:{x:P.x-ux*ext,y:P.y-uy*ext}, p2:{x:P.x+ux*ext,y:P.y+uy*ext}};
    }

    return {
      A,B,C,K,D,t,kUser,cOnSegment,profileAB,
      width,height,originX,axisY,proj,
      a1: extendedLine(proj.C1, vAB1),
      a2: extendedLine(proj.C2, vAB2),
      l1: extendedLine(proj.C1, vL1),
      l2: extendedLine(proj.C2, vL2),
      kBase: dist2(proj.A1,proj.B1) >= EPS ? 1 : 2,
      angleAB1: tiltAngle(proj.A1,proj.B1),
      angleAB2: tiltAngle(proj.A2,proj.B2),
      angleL1: tiltAngle(proj.C1,lTarget1),
      angleL2: tiltAngle(proj.C2,lTarget2)
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

    if (g.profileAB) {
      push({
        title:'Особый случай: AB – профильная прямая',
        action:'Так как xA = xB, одних условий a₁ ∥ A₁B₁ и a₂ ∥ A₂B₂ недостаточно. Построй вспомогательную точку D = C + 0,5·(B−A).',
        why:'У профильной прямой обе основные проекции могут быть вертикальными и не показывать отношение приращений y и z. Одна согласованная пара D₁/D₂ фиксирует пространственное направление точно.',
        measure:[
          'D = (' + fmt(g.D.x,1) + '; ' + fmt(g.D.y,1) + '; ' + fmt(g.D.z,1) + ')',
          'ΔCD = 0,5·ΔAB по каждой координате'
        ],
        check:'D₁ и D₂ лежат на одной линии связи; CD имеет тот же пространственный вектор направления, что и AB.'
      }, [
        tickEntity(steps.length,proj.Dx,'Dₓ'),
        lineEntity(steps.length,proj.Dx,proj.D1,'construction-line'),
        lineEntity(steps.length,proj.Dx,proj.D2,'construction-line'),
        pointEntity(steps.length,proj.D1,'D₁'),
        pointEntity(steps.length,proj.D2,'D₂')
      ], {kind:'line',a:proj.D1,b:proj.D2});
    }

    const a1Entities = g.a1
      ? [lineEntity(steps.length,g.a1.p1,g.a1.p2,'answer-line')]
      : [pointEntity(steps.length,proj.C1,'a₁ ≡ C₁','answer-dot')];

    push({
      title:'Через C₁ проведи a₁ ∥ A₁B₁',
      action:g.a1
        ? (g.profileAB ? 'Соедини C₁ с D₁ и продли линию – это a₁.' : 'Приложи линейку вдоль A₁B₁, не меняя её наклона перенеси к C₁ и проведи a₁.')
        : 'A₁B₁ выродилась в точку: AB перпендикулярна П₁. Тогда горизонтальная проекция любой параллельной ей прямой тоже вырождается в точку C₁.',
      why:g.profileAB
        ? 'Для профильной прямой используем согласованную точку D: вектор CD = 0,5·AB, поэтому a точно параллельна AB в пространстве.'
        : 'Если пространственные прямые параллельны, их одноимённые проекции параллельны. Для прямой непрофильного положения двух основных проекций достаточно.',
      measure:[g.angleAB1 === null ? 'На П₁ угол не измеряется – проекция AB является точкой.' : 'Сохрани наклон ' + fmt(g.angleAB1,1) + '° к горизонтали. Транспортир не нужен: проще перенести направление линейкой.'],
      check:g.a1 ? 'a₁ проходит через C₁ и не меняет направление относительно A₁B₁.' : 'a₁ совпадает с C₁ как точечная проекция.'
    }, a1Entities, g.a1 ? {kind:'line',a:g.a1.p1,b:g.a1.p2} : null);

    const a2Entities = g.a2
      ? [lineEntity(steps.length,g.a2.p1,g.a2.p2,'answer-line')]
      : [pointEntity(steps.length,proj.C2,'a₂ ≡ C₂','answer-dot')];

    push({
      title:'Через C₂ проведи a₂ ∥ A₂B₂',
      action:g.a2
        ? (g.profileAB ? 'Соедини C₂ с D₂ и продли линию – это a₂.' : 'То же самое сделай на фронтальной проекции: a₂ через C₂ параллельно A₂B₂.')
        : 'A₂B₂ выродилась в точку: AB перпендикулярна П₂. Тогда a₂ тоже является точкой C₂.',
      why:g.profileAB
        ? 'D₂ соответствует той же пространственной точке D, что и D₁. Поэтому две проекции задают одну конкретную профильную прямую a.'
        : 'Параллельность проверяется отдельно на одноимённых проекциях. Обе пары должны иметь одно направление.',
      measure:[g.angleAB2 === null ? 'На П₂ проекция AB является точкой.' : 'Сохрани наклон ' + fmt(g.angleAB2,1) + '° к горизонтали.'],
      check:g.a2 ? 'a₂ ∥ A₂B₂ и проходит через C₂.' : 'a₂ совпадает с C₂.'
    }, a2Entities, g.a2 ? {kind:'line',a:g.a2.p1,b:g.a2.p2} : null);

    if (g.cOnSegment) {
      push({
        title:'Точка пересечения K уже известна',
        action:'C уже лежит на отрезке AB, поэтому точка пересечения K совпадает с C. Для ℓ достаточно выбрать любое направление, не совпадающее с AB.',
        why:'Условие требует, чтобы ℓ проходила через C и пересекала AB. Если C принадлежит AB, пересечение уже обеспечено в самой точке C.',
        measure:['K = C','Сайт выбирает вспомогательное непараллельное AB направление только для однозначного показа ℓ.'],
        check:'K₁ совпадает с C₁, K₂ совпадает с C₂.'
      }, [pointEntity(steps.length,proj.K1,'K₁=C₁','answer-dot'), pointEntity(steps.length,proj.K2,'K₂=C₂','answer-dot')]);
    } else if (g.kBase === 1) {
      const frac = Math.round(g.t*100);
      push({
        title:'Выбери K₁ на отрезке A₁B₁',
        action:'Отложи на A₁B₁ точку K₁ на ' + frac + '% пути от A₁ к B₁. По умолчанию 50% – середина.',
        why:'Условие не задаёт конкретную точку пересечения. Любая K внутри AB даёт корректную прямую ℓ = CK. Мы выбираем внутреннюю точку, чтобы построение было однозначным и удобным.',
        measure:['Доля A₁K₁ / A₁B₁ = ' + frac + '%','A₁K₁ ≈ ' + fmt(dist2(proj.A1,proj.K1),1) + ' мм на проекции'],
        check:'K₁ лежит именно на отрезке A₁B₁, не на его продолжении.'
      }, [pointEntity(steps.length,proj.K1,'K₁','answer-dot'), dimEntity(steps.length,proj.A1,proj.K1,frac + '%')], {kind:'line',a:proj.A1,b:proj.K1});

      push({
        title:'Перенеси K₁ на фронтальную проекцию',
        action:'Через K₁ проведи линию связи перпендикулярно x₁₂. В месте её пересечения с A₂B₂ отметь K₂.',
        why:'K₁ и K₂ должны быть проекциями одной и той же пространственной точки K. Поэтому они обязаны лежать на одном перпендикуляре к оси x₁₂.',
        measure:['Линия K₁K₂ строго перпендикулярна x₁₂'],
        check:'K₂ одновременно лежит на A₂B₂ и на вертикали из K₁.'
      }, [lineEntity(steps.length,proj.K1,proj.K2,'construction-line'), pointEntity(steps.length,proj.K2,'K₂','answer-dot')], {kind:'line',a:proj.K1,b:proj.K2});
    } else {
      const frac = Math.round(g.t*100);
      push({
        title:'A₁B₁ выродилась в точку – выбери K₂',
        action:'На фронтальной проекции A₂B₂ отложи K₂ на ' + frac + '% пути от A₂ к B₂.',
        why:'Когда A₁ и B₁ совпадают, положение K невозможно определить на П₁. Поэтому ту же долю отрезка выбираем на невырожденной проекции П₂.',
        measure:['Доля A₂K₂ / A₂B₂ = ' + frac + '%','A₂K₂ ≈ ' + fmt(dist2(proj.A2,proj.K2),1) + ' мм на проекции'],
        check:'K₂ лежит на A₂B₂.'
      }, [pointEntity(steps.length,proj.K2,'K₂','answer-dot'), dimEntity(steps.length,proj.A2,proj.K2,frac + '%')], {kind:'line',a:proj.A2,b:proj.K2});

      push({
        title:'Перенеси K₂ на горизонтальную проекцию',
        action:'Проведи из K₂ линию связи перпендикулярно x₁₂. Она приходит в единственную точечную проекцию A₁ ≡ B₁ ≡ K₁.',
        why:'AB перпендикулярна П₁, поэтому все её точки имеют одну и ту же горизонтальную проекцию.',
        measure:['K₁ = A₁ = B₁'],
        check:'K₁ находится на той же линии связи, что и K₂.'
      }, [lineEntity(steps.length,proj.K2,proj.K1,'construction-line'), pointEntity(steps.length,proj.K1,'K₁','answer-dot')], {kind:'line',a:proj.K2,b:proj.K1});
    }

    const l1Entities = g.l1
      ? [lineEntity(steps.length,g.l1.p1,g.l1.p2,'answer-line')]
      : [pointEntity(steps.length,proj.C1,'ℓ₁ ≡ C₁ ≡ K₁','answer-dot')];
    push({
      title:'Проведи ℓ₁ через C₁ и K₁',
      action:g.cOnSegment
        ? 'Проведи через C₁ выбранное сайтом направление ℓ₁ и продли линию в обе стороны.'
        : (g.l1 ? 'Приложи линейку к C₁ и K₁, проведи через них прямую и продли её в обе стороны.' : 'C₁ и K₁ совпали: горизонтальная проекция ℓ вырождается в точку.'),
      why:g.cOnSegment
        ? 'Так как K = C уже лежит на AB, направление ℓ свободно. Важно лишь, чтобы ℓ не совпадала с AB.'
        : 'Угол ℓ₁ отдельно не задаётся: две точки C₁ и K₁ определяют её проекцию. Если эти проекции совпали, это корректная вырожденная проекция прямой.',
      measure:[angleText('Получившийся наклон ℓ₁',g.angleL1),'Отмерять угол транспортиром не требуется.'],
      check:g.l1 ? 'ℓ₁ проходит через C₁ и через K₁.' : 'Точечная ℓ₁ совпадает с C₁ и K₁.'
    }, l1Entities, g.l1 ? {kind:'line',a:g.l1.p1,b:g.l1.p2} : null);

    const l2Entities = g.l2
      ? [lineEntity(steps.length,g.l2.p1,g.l2.p2,'answer-line')]
      : [pointEntity(steps.length,proj.C2,'ℓ₂ ≡ C₂ ≡ K₂','answer-dot')];
    push({
      title:'Проведи ℓ₂ через C₂ и K₂',
      action:g.cOnSegment
        ? 'На П₂ проведи вторую одноимённую проекцию ℓ₂ через C₂ в согласованном направлении.'
        : (g.l2 ? 'Приложи линейку к C₂ и K₂, проведи через них прямую и продли её.' : 'C₂ и K₂ совпали: фронтальная проекция ℓ вырождается в точку.'),
      why:'Обе одноимённые проекции должны описывать одну пространственную прямую ℓ. Для обычного случая они проходят через согласованные проекции C и K.',
      measure:[angleText('Получившийся наклон ℓ₂',g.angleL2)],
      check:g.cOnSegment ? 'ℓ проходит через C, а C принадлежит AB – условие пересечения выполнено.' : 'Точки пересечения ℓ с AB имеют проекции K₁ и K₂ на одной линии связи.'
    }, l2Entities, g.l2 ? {kind:'line',a:g.l2.p1,b:g.l2.p2} : null);

    push({
      title:'Финальная проверка',
      action:'Проверь три независимых условия: проекции точек, параллельность a и пересечение ℓ с AB.',
      why:'Так проверяется не внешний вид, а геометрическая корректность эпюра.',
      measure:['A₁/A₂, B₁/B₂, C₁/C₂ – на вертикалях связи','a₁ ∥ A₁B₁ и a₂ ∥ A₂B₂','K₁ и K₂ – на одной линии связи'],
      check:'Если все три проверки выполняются, задание построено корректно.'
    });

    return steps;
  }

  function render() {
    const g = state.geometry;
    svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 ' + g.width + ' ' + g.height);
    svg.setAttribute('width', g.width + 'mm');
    svg.setAttribute('height', g.height + 'mm');
    svg.style.width = g.width + 'mm';

    drawGrid(g);
    const allEntities = state.steps.flatMap((s,idx) => (s.entities || []).map(e => ({...e, stepIndex:idx})));
    for (const entity of allEntities) {
      if (entity.stepIndex <= state.step) drawEntity(entity, entity.stepIndex === state.step);
    }

    drawPermanentLabels(g);
    animateCurrentStep();
    updateExplanation();
  }

  function drawGrid(g) {
    const defs = el('defs');
    const minor = el('pattern',{id:'minorGrid',width:GRID,height:GRID,patternUnits:'userSpaceOnUse'});
    minor.append(el('path',{d:'M ' + GRID + ' 0 L 0 0 0 ' + GRID,class:'grid-minor',fill:'none'}));
    defs.append(minor);
    const major = el('pattern',{id:'majorGrid',width:GRID*5,height:GRID*5,patternUnits:'userSpaceOnUse'});
    major.append(el('rect',{width:GRID*5,height:GRID*5,fill:'url(#minorGrid)'}));
    major.append(el('path',{d:'M ' + (GRID*5) + ' 0 L 0 0 0 ' + (GRID*5),class:'grid-major',fill:'none'}));
    defs.append(major);
    const marker = el('marker',{id:'axisArrow',viewBox:'0 0 10 10',refX:'8',refY:'5',markerWidth:'4',markerHeight:'4',orient:'auto-start-reverse'});
    marker.append(el('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#37332e'}));
    defs.append(marker);
    svg.append(defs);
    svg.append(el('rect',{x:0,y:0,width:g.width,height:g.height,fill:'url(#majorGrid)'}));
  }

  function drawPermanentLabels(g) {
    if (state.step >= 1) {
      svg.append(el('text',{x:9,y:g.axisY-2.5,class:'svg-label'},'+x'));
      svg.append(el('text',{x:g.width-13,y:g.axisY-2.5,class:'svg-label'},'−x'));
      svg.append(el('text',{x:g.width-20,y:g.axisY+5,class:'svg-note'},'x₁₂'));
      svg.append(el('text',{x:g.width-25,y:7,class:'svg-note'},'П₂'));
      svg.append(el('text',{x:g.width-25,y:g.height-5,class:'svg-note'},'П₁'));
    }
  }

  function drawEntity(e, active) {
    if (e.type === 'line') {
      const line = el('line',{x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y,class:'draw-line ' + e.cls + (active?' active-line':''), 'data-active':active?'1':'0'});
      if (e.arrow) line.setAttribute('marker-start','url(#axisArrow)');
      svg.append(line);
    } else if (e.type === 'point') {
      const r = e.cls.includes('answer') ? 1.05 : .9;
      svg.append(el('circle',{cx:e.p.x,cy:e.p.y,r:r,class:e.cls + (active?' active-dot':''),'data-active':active?'1':'0'}));
      if (e.label) svg.append(el('text',{x:e.p.x+2.2,y:e.p.y-2.2,class:'svg-label','data-active':active?'1':'0'},e.label));
    } else if (e.type === 'tick') {
      svg.append(el('line',{x1:e.p.x,y1:e.p.y-2.2,x2:e.p.x,y2:e.p.y+2.2,class:'tick' + (active?' active-line':''),'data-active':active?'1':'0'}));
      svg.append(el('text',{x:e.p.x+1.5,y:e.p.y+5,class:'svg-note','data-active':active?'1':'0'},e.label));
    } else if (e.type === 'dim') {
      drawDimension(e,active);
    }
  }

  function drawDimension(e,active) {
    const dx=e.b.x-e.a.x, dy=e.b.y-e.a.y, len=Math.hypot(dx,dy);
    if (len < EPS) return;
    const nx=-dy/len, ny=dx/len;
    const off = 3.2;
    const a={x:e.a.x+nx*off+(e.offset?.x||0),y:e.a.y+ny*off+(e.offset?.y||0)};
    const b={x:e.b.x+nx*off+(e.offset?.x||0),y:e.b.y+ny*off+(e.offset?.y||0)};
    const group=el('g',{'data-active':active?'1':'0'});
    group.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'dimension' + (active?' active-line':'')}));
    group.append(el('line',{x1:a.x-nx*1.5,y1:a.y-ny*1.5,x2:a.x+nx*1.5,y2:a.y+ny*1.5,class:'dimension'}));
    group.append(el('line',{x1:b.x-nx*1.5,y1:b.y-ny*1.5,x2:b.x+nx*1.5,y2:b.y+ny*1.5,class:'dimension'}));
    group.append(el('text',{x:(a.x+b.x)/2+nx*2,y:(a.y+b.y)/2+ny*2,class:'dimension-text','text-anchor':'middle'},e.label));
    svg.append(group);
  }

  function animateCurrentStep() {
    const step = state.steps[state.step];
    const activeLines = [...svg.querySelectorAll('[data-active="1"].draw-line')];
    activeLines.forEach((node, i) => {
      const length = node.getTotalLength ? node.getTotalLength() : 0;
      if (!length) return;
      node.style.strokeDasharray = String(length);
      node.style.strokeDashoffset = String(length);
      node.style.transition = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.style.transition = 'stroke-dashoffset ' + (700 + i*180) + 'ms cubic-bezier(.2,.7,.2,1)';
          node.style.strokeDashoffset = '0';
        });
      });
    });

    [...svg.querySelectorAll('[data-active="1"]')]
      .filter(n=>!n.classList.contains('draw-line'))
      .forEach(n => n.animate([{opacity:0},{opacity:1}],{duration:500,easing:'ease-out'}));

    if (step.tool) drawToolOverlay(step.tool);
  }

  function drawToolOverlay(tool) {
    if (!tool || tool.kind !== 'line') return;
    const a=tool.a,b=tool.b;
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if (len < EPS) return;
    const angle=Math.atan2(dy,dx)*180/Math.PI;
    const group=el('g',{class:'tool-overlay',transform:'translate(' + a.x + ' ' + a.y + ') rotate(' + angle + ')'});
    const rulerLen=Math.max(20,Math.min(len,55));
    group.append(el('rect',{x:0,y:2,width:rulerLen,height:5,rx:1,class:'ruler-body'}));
    for(let i=0;i<=rulerLen;i+=5) {
      group.append(el('line',{x1:i,y1:2,x2:i,y2:i%10===0?5.5:4.3,class:'ruler-tick'}));
    }
    const pencil=el('g',{transform:'translate(0 0) rotate(-8)'});
    pencil.append(el('rect',{x:-1,y:-2,width:9,height:2.3,rx:.4,class:'pencil-body'}));
    pencil.append(el('path',{d:'M 8 -2 L 11 -.85 L 8 .3 z',class:'pencil-tip'}));
    group.append(pencil);
    svg.append(group);

    const anim=pencil.animate([
      {transform:'translate(0px, 0px) rotate(-8deg)'},
      {transform:'translate(' + Math.min(len,rulerLen) + 'px, 0px) rotate(-8deg)'}
    ],{duration:950,easing:'ease-in-out',fill:'forwards'});
    anim.onfinish=()=>group.animate([{opacity:1},{opacity:0}],{duration:350,fill:'forwards'});
  }

  function updateExplanation() {
    const s=state.steps[state.step];
    $('stepNumber').textContent=String(state.step+1);
    $('stepTotal').textContent=String(state.steps.length);
    $('stepBadge').textContent='Шаг ' + (state.step+1);
    $('stepTitle').textContent=s.title;
    $('stepAction').textContent=s.action;
    $('stepWhy').textContent=s.why;
    $('stepCheck').textContent=s.check;
    $('stepMeasure').innerHTML='<ul class="measure-list">' + (s.measure||[]).map(m=>'<li>' + htmlEscape(m) + '</li>').join('') + '</ul>';
    $('prevBtn').disabled=state.step===0;
    $('nextBtn').disabled=state.step===state.steps.length-1;
  }

  function rebuild(resetStep=true) {
    stopAuto();
    $('kOutput').textContent=$('kSlider').value + '%';
    const g=makeGeometry();
    const validation=$('validation');
    if (g.error) {
      validation.hidden=false;
      validation.textContent=g.error;
      return;
    }
    validation.hidden=true;
    $('kSlider').disabled = g.cOnSegment;
    $('kOutput').textContent = g.cOnSegment ? 'K=C' : $('kSlider').value + '%';
    $('sheetSize').textContent = fmt(g.width,0) + ' × ' + fmt(g.height,0) + ' мм';
    state.geometry=g;
    state.steps=buildSteps(g);
    if (resetStep) state.step=0;
    state.step=Math.max(0,Math.min(state.step,state.steps.length-1));
    render();
  }

  function go(delta) {
    const next=Math.max(0,Math.min(state.steps.length-1,state.step+delta));
    if(next===state.step) return;
    state.step=next;
    render();
  }

  function stopAuto() {
    state.playing=false;
    if(state.timer) clearTimeout(state.timer);
    state.timer=null;
    if($('playBtn')) $('playBtn').textContent='▶ Авто';
  }

  function autoAdvance() {
    if(!state.playing) return;
    if(state.step>=state.steps.length-1){stopAuto();return;}
    go(1);
    state.timer=setTimeout(autoAdvance,2200);
  }

  function toggleAuto() {
    if(state.playing){stopAuto();return;}
    state.playing=true;
    $('playBtn').textContent='Ⅱ Стоп';
    state.timer=setTimeout(autoAdvance,500);
  }

  $('presetBtn').addEventListener('click',()=>{
    for(const [name,p] of Object.entries(preset)){
      $(name+'x').value=p.x;
      $(name+'y').value=p.y;
      $(name+'z').value=p.z;
    }
    $('kSlider').value='50';
    rebuild(true);
  });
  $('buildBtn').addEventListener('click',()=>rebuild(true));
  $('printBtn').addEventListener('click',()=>window.print());
  $('prevBtn').addEventListener('click',()=>{stopAuto();go(-1);});
  $('nextBtn').addEventListener('click',()=>{stopAuto();go(1);});
  $('playBtn').addEventListener('click',toggleAuto);
  $('kSlider').addEventListener('input',()=>{ $('kOutput').textContent=$('kSlider').value + '%'; rebuild(false); });
  inputs.forEach(inp=>inp.addEventListener('change',()=>rebuild(true)));

  rebuild(true);
})();
