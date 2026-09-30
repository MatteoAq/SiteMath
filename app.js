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
