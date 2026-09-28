(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MatrixCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EPS = 1e-10;

  function roundNumber(n) {
    if (!Number.isFinite(n)) return n;
    if (Math.abs(n) < EPS) return 0;
    const r = Math.round(n * 1e10) / 1e10;
    return Object.is(r, -0) ? 0 : r;
  }

  function cleanMatrix(m) {
    return m.map(row => row.map(roundNumber));
  }

  function isMatrix(v) {
    return Array.isArray(v) && Array.isArray(v[0]);
  }

  function cloneMatrix(m) {
    return m.map(r => r.slice());
  }

  function shape(m) {
    if (!isMatrix(m) || !m.length || !m[0].length) throw new Error('Матрица должна содержать хотя бы один элемент.');
    const cols = m[0].length;
    if (!m.every(r => Array.isArray(r) && r.length === cols)) throw new Error('У матрицы строки разной длины.');
    return [m.length, cols];
  }

  function assertNumericMatrix(m, name = 'Матрица') {
    shape(m);
    for (const row of m) for (const v of row) {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${name} содержит некорректное число.`);
    }
  }

  function identity(n) {
    if (!Number.isInteger(n) || n < 1) throw new Error('Размер единичной матрицы должен быть положительным целым числом.');
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  }

  function zero(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  function sameShape(a, b) {
    const [ar, ac] = shape(a), [br, bc] = shape(b);
    return ar === br && ac === bc;
  }

  function add(a, b) {
    assertNumericMatrix(a, 'Первая матрица'); assertNumericMatrix(b, 'Вторая матрица');
    if (!sameShape(a, b)) throw new Error('Складывать можно только матрицы одинакового размера.');
    return cleanMatrix(a.map((r, i) => r.map((v, j) => v + b[i][j])));
  }

  function sub(a, b) {
    assertNumericMatrix(a, 'Первая матрица'); assertNumericMatrix(b, 'Вторая матрица');
    if (!sameShape(a, b)) throw new Error('Вычитать можно только матрицы одинакового размера.');
    return cleanMatrix(a.map((r, i) => r.map((v, j) => v - b[i][j])));
  }

  function scale(a, k) {
    assertNumericMatrix(a);
    if (typeof k !== 'number' || !Number.isFinite(k)) throw new Error('Коэффициент должен быть числом.');
    return cleanMatrix(a.map(r => r.map(v => v * k)));
  }

  function transpose(a) {
    assertNumericMatrix(a);
    const [r, c] = shape(a);
    return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => a[i][j]));
  }

  function multiply(a, b) {
    assertNumericMatrix(a, 'Первая матрица'); assertNumericMatrix(b, 'Вторая матрица');
    const [ar, ac] = shape(a), [br, bc] = shape(b);
    if (ac !== br) throw new Error(`Произведение невозможно: у первой матрицы ${ac} столбц., у второй ${br} строк. Эти числа должны совпадать.`);
    const out = zero(ar, bc);
    for (let i = 0; i < ar; i++) {
      for (let j = 0; j < bc; j++) {
        let sum = 0;
        for (let k = 0; k < ac; k++) sum += a[i][k] * b[k][j];
        out[i][j] = roundNumber(sum);
      }
    }
    return out;
  }

  function power(a, n) {
    assertNumericMatrix(a);
    const [r, c] = shape(a);
    if (r !== c) throw new Error('Возводить в степень можно только квадратную матрицу.');
    if (!Number.isInteger(n) || n < 0) throw new Error('В этой версии степень матрицы должна быть целым числом ≥ 0.');
    let result = identity(r);
    let base = cloneMatrix(a);
    let exp = n;
    while (exp > 0) {
      if (exp % 2 === 1) result = multiply(result, base);
      exp = Math.floor(exp / 2);
      if (exp) base = multiply(base, base);
    }
    return result;
  }

  function determinant(a) {
    assertNumericMatrix(a);
    const [n, c] = shape(a);
    if (n !== c) throw new Error('Определитель существует только у квадратной матрицы.');
    if (n === 1) return roundNumber(a[0][0]);
    if (n === 2) return roundNumber(a[0][0] * a[1][1] - a[0][1] * a[1][0]);
    const m = cloneMatrix(a);
    let det = 1;
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
      if (Math.abs(m[pivot][col]) < EPS) return 0;
      if (pivot !== col) {
        [m[pivot], m[col]] = [m[col], m[pivot]];
        det *= -1;
      }
      const p = m[col][col];
      det *= p;
      for (let row = col + 1; row < n; row++) {
        const factor = m[row][col] / p;
        for (let j = col + 1; j < n; j++) m[row][j] -= factor * m[col][j];
      }
    }
    return roundNumber(det);
  }

  function determinantSteps(a) {
    assertNumericMatrix(a);
    const [n, c] = shape(a);
    if (n !== c) throw new Error('Определитель существует только у квадратной матрицы.');
    if (n === 1) return { value: roundNumber(a[0][0]), formula: `det(A) = ${fmt(a[0][0])}`, steps: [] };
    if (n === 2) {
      const [[a11,a12],[a21,a22]] = a;
      const p1 = a11*a22, p2 = a12*a21;
      const value = roundNumber(p1-p2);
      return {
        value,
        formula: 'det(A) = a₁₁a₂₂ − a₁₂a₂₁',
        steps: [
          `${fmt(a11)}·${fmt(a22)} − ${fmt(a12)}·${fmt(a21)}`,
          `${fmt(p1)} − ${fmt(p2)} = ${fmt(value)}`
        ]
      };
    }
    if (n === 3) {
      const [r1,r2,r3] = a;
      const [a11,a12,a13] = r1, [a21,a22,a23] = r2, [a31,a32,a33] = r3;
      const pos = [a11*a22*a33, a12*a23*a31, a13*a21*a32];
      const neg = [a13*a22*a31, a12*a21*a33, a11*a23*a32];
      const value = roundNumber(pos.reduce((s,v)=>s+v,0)-neg.reduce((s,v)=>s+v,0));
      return {
        value,
        formula: 'Правило Саррюса: a₁₁a₂₂a₃₃ + a₁₂a₂₃a₃₁ + a₁₃a₂₁a₃₂ − a₁₃a₂₂a₃₁ − a₁₂a₂₁a₃₃ − a₁₁a₂₃a₃₂',
        steps: [
          `Плюс: ${fmtProduct([a11,a22,a33])} + ${fmtProduct([a12,a23,a31])} + ${fmtProduct([a13,a21,a32])} = ${fmt(pos.reduce((s,v)=>s+v,0))}`,
          `Минус: ${fmtProduct([a13,a22,a31])} + ${fmtProduct([a12,a21,a33])} + ${fmtProduct([a11,a23,a32])} = ${fmt(neg.reduce((s,v)=>s+v,0))}`,
          `det(A) = ${fmt(pos.reduce((s,v)=>s+v,0))} − ${fmt(neg.reduce((s,v)=>s+v,0))} = ${fmt(value)}`
        ]
      };
    }
    const m = cloneMatrix(a);
    const steps = ['Для порядка выше 3 используем приведение к верхнетреугольному виду.'];
    let sign = 1;
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
      if (Math.abs(m[pivot][col]) < EPS) {
        steps.push(`В столбце ${col+1} нет ненулевого ведущего элемента ⇒ det = 0.`);
        return { value: 0, formula: 'После элементарных преобразований.', steps };
      }
      if (pivot !== col) {
        [m[pivot],m[col]]=[m[col],m[pivot]]; sign *= -1;
        steps.push(`R${col+1} ↔ R${pivot+1}; знак определителя меняется.`);
      }
      for (let row = col + 1; row < n; row++) {
        const f = m[row][col]/m[col][col];
        if (Math.abs(f) > EPS) {
          for (let j = col; j < n; j++) m[row][j] -= f*m[col][j];
          steps.push(`R${row+1} ← R${row+1} − (${fmt(f)})R${col+1}`);
        }
      }
    }
    const diag = m.map((r,i)=>r[i]);
    const value = roundNumber(sign*diag.reduce((p,v)=>p*v,1));
    steps.push(`det = ${sign < 0 ? '−' : ''}${diag.map(fmt).join('·')} = ${fmt(value)}`);
    return { value, formula: 'После приведения к треугольному виду det равен произведению диагональных элементов с учётом перестановок строк.', steps, echelon: cleanMatrix(m) };
  }

  function rankWithSteps(a) {
    assertNumericMatrix(a);
    const m = cloneMatrix(a).map(r => r.map(Number));
    const [rows, cols] = shape(m);
    const steps = [];
    let row = 0;
    const pivots = [];
    for (let col = 0; col < cols && row < rows; col++) {
      let pivot = row;
      for (let r = row + 1; r < rows; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
      if (Math.abs(m[pivot][col]) < EPS) continue;
      if (pivot !== row) {
        [m[pivot],m[row]]=[m[row],m[pivot]];
        steps.push({ text: `R${row+1} ↔ R${pivot+1}`, matrix: cleanMatrix(cloneMatrix(m)) });
      }
      const p = m[row][col];
      if (Math.abs(p - 1) > EPS) {
        for (let j = col; j < cols; j++) m[row][j] /= p;
        steps.push({ text: `R${row+1} ← R${row+1} / ${fmt(p)}`, matrix: cleanMatrix(cloneMatrix(m)) });
      }
      for (let r = 0; r < rows; r++) {
        if (r === row) continue;
        const f = m[r][col];
        if (Math.abs(f) < EPS) continue;
        for (let j = col; j < cols; j++) m[r][j] -= f*m[row][j];
        steps.push({ text: `R${r+1} ← R${r+1} − (${fmt(f)})R${row+1}`, matrix: cleanMatrix(cloneMatrix(m)) });
      }
      pivots.push([row,col]);
      row++;
    }
    return { rank: pivots.length, rref: cleanMatrix(m), pivots, steps };
  }

  function rank(a) { return rankWithSteps(a).rank; }

  function approxEqual(a,b,eps=1e-8) {
    if (isMatrix(a) !== isMatrix(b)) return false;
    if (!isMatrix(a)) return Math.abs(a-b) <= eps;
    if (!sameShape(a,b)) return false;
    for (let i=0;i<a.length;i++) for (let j=0;j<a[0].length;j++) if (Math.abs(a[i][j]-b[i][j])>eps) return false;
    return true;
  }

  function fmt(n) {
    n = roundNumber(Number(n));
    if (Number.isInteger(n)) return String(n);
    return String(n).replace('.', ',');
  }

  function fmtProduct(nums) {
    return nums.map(v => v < 0 ? `(${fmt(v)})` : fmt(v)).join('·');
  }

  function parseNumber(raw) {
    if (typeof raw === 'number') return raw;
    let s = String(raw ?? '').trim();
    if (!s) throw new Error('Пустая ячейка.');
    s = s.replace(/,/g,'.').replace(/π/g,'pi').replace(/√\s*([0-9.]+)/g,'sqrt($1)').replace(/\^/g,'**');
    const words = s.match(/[A-Za-z_]+/g) || [];
    const allowed = new Set(['sqrt','sin','cos','tan','abs','pi','e']);
    if (words.some(w => !allowed.has(w.toLowerCase()))) throw new Error(`Неизвестное обозначение в числе: ${raw}`);
    if (!/^[0-9+\-*/().\sA-Za-z_*]+$/.test(s)) throw new Error(`Недопустимые символы в числе: ${raw}`);
    s = s.replace(/\bpi\b/gi,'Math.PI').replace(/\be\b/g,'Math.E')
         .replace(/\bsqrt\b/gi,'Math.sqrt').replace(/\bsin\b/gi,'Math.sin')
         .replace(/\bcos\b/gi,'Math.cos').replace(/\btan\b/gi,'Math.tan').replace(/\babs\b/gi,'Math.abs');
    let v;
    try { v = Function(`"use strict"; return (${s});`)(); } catch { throw new Error(`Не удалось прочитать число: ${raw}`); }
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Некорректное число: ${raw}`);
    return roundNumber(v);
  }

  // --- Matrix expression parser: A, B, I, T(...), + - * ^ and numbers ---
  function tokenizeExpression(src) {
    const s = String(src || '').replace(/·/g,'*').replace(/²/g,'^2').replace(/³/g,'^3').replace(/ᵀ/g,'^T');
    const tokens = [];
    let i=0;
    while (i<s.length) {
      const ch=s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.,]/.test(ch)) {
        let j=i+1;
        while (j<s.length && /[0-9.,]/.test(s[j])) j++;
        const raw=s.slice(i,j).replace(',','.');
        if (!/^\d*\.?\d+$/.test(raw)) throw new Error(`Некорректное число «${s.slice(i,j)}».`);
        tokens.push({type:'num',value:Number(raw)}); i=j; continue;
      }
      if (/[A-Za-zА-Яа-я]/.test(ch)) {
        // Matrix notation is intentionally single-letter: AB means A·B.
        tokens.push({type:'id',value:ch.toUpperCase()}); i++; continue;
      }
      if ('+-*^()'.includes(ch)) { tokens.push({type:ch,value:ch}); i++; continue; }
      throw new Error(`Неизвестный символ «${ch}» в выражении.`);
    }
    return tokens;
  }

  function parseMatrixExpression(src, env) {
    const tokens = tokenizeExpression(src);
    let pos=0;
    function peek(type) { return tokens[pos] && tokens[pos].type===type; }
    function eat(type) { if (!peek(type)) throw new Error(`Ожидалось «${type}».`); return tokens[pos++]; }
    function primary() {
      if (peek('num')) return {kind:'num',value:eat('num').value};
      if (peek('id')) {
        const id=eat('id').value;
        if (id==='T') {
          eat('('); const x=expr(); eat(')'); return {kind:'transpose',arg:x};
        }
        if (!['A','B','I'].includes(id)) throw new Error(`Допустимы только A, B, I и T(...). Неизвестно: ${id}.`);
        return {kind:'var',name:id};
      }
      if (peek('(')) { eat('('); const x=expr(); eat(')'); return x; }
      throw new Error('Ожидалось число, A, B, I, T(...) или скобки.');
    }
    function unary() {
      if (peek('-')) { eat('-'); return {kind:'neg',arg:unary()}; }
      return primary();
    }
    function powExpr() {
      let node=unary();
      while (peek('^')) {
        eat('^');
        if (peek('id') && tokens[pos].value === 'T') { eat('id'); node={kind:'transpose',arg:node}; continue; }
        const rhs=unary(); node={kind:'pow',left:node,right:rhs};
      }
      return node;
    }
    function startsFactor() {
      return peek('num') || peek('id') || peek('(');
    }
    function term() {
      let node=powExpr();
      while (peek('*') || startsFactor()) {
        if (peek('*')) eat('*');
        node={kind:'mul',left:node,right:powExpr()};
      }
      return node;
    }
    function expr() {
      let node=term();
      while (peek('+')||peek('-')) {
        const op=tokens[pos++].type; node={kind:op==='+'?'add':'sub',left:node,right:term()};
      }
      return node;
    }
    if (!tokens.length) throw new Error('Введите выражение, например 2*A-3*B+A*B.');
    const ast=expr();
    if (pos!==tokens.length) throw new Error('Не удалось разобрать выражение до конца.');

    const steps=[];
    function evalNode(node) {
      if (node.kind==='num') return node.value;
      if (node.kind==='var') {
        if (node.name==='I') {
          const base = env.A || env.B;
          if (!base) throw new Error('Для I нужна матрица A или B, чтобы определить размер.');
          const [r,c]=shape(base); if (r!==c) throw new Error('I можно использовать здесь только если A (или B) квадратная.');
          return identity(r);
        }
        if (!env[node.name]) throw new Error(`Матрица ${node.name} не задана.`);
        return cloneMatrix(env[node.name]);
      }
      if (node.kind==='neg') {
        const v=evalNode(node.arg); return isMatrix(v)?scale(v,-1):-v;
      }
      if (node.kind==='transpose') {
        const v=evalNode(node.arg); if (!isMatrix(v)) throw new Error('T(...) применяется к матрице.');
        const out=transpose(v); steps.push({title:'Транспонирование',detail:'Строки становятся столбцами.',result:out}); return out;
      }
      if (node.kind==='pow') {
        const l=evalNode(node.left), r=evalNode(node.right);
        if (isMatrix(r)) throw new Error('Показатель степени должен быть числом.');
        if (isMatrix(l)) {
          const out=power(l,r); steps.push({title:`Степень матрицы ^${fmt(r)}`,detail:r===2?'Умножаем матрицу саму на себя.':'Используем повторное умножение.',result:out}); return out;
        }
        return Math.pow(l,r);
      }
      const l=evalNode(node.left), r=evalNode(node.right);
      if (node.kind==='add'||node.kind==='sub') {
        if (isMatrix(l)&&isMatrix(r)) {
          const out=node.kind==='add'?add(l,r):sub(l,r);
          steps.push({title:node.kind==='add'?'Сложение матриц':'Вычитание матриц',detail:'Действуем поэлементно: элемент с теми же индексами складывается/вычитается.',result:out}); return out;
        }
        if (!isMatrix(l)&&!isMatrix(r)) return node.kind==='add'?l+r:l-r;
        throw new Error('Нельзя складывать или вычитать матрицу и обычное число. Для c·I используйте I.');
      }
      if (node.kind==='mul') {
        if (!isMatrix(l)&&!isMatrix(r)) return l*r;
        if (isMatrix(l)&&!isMatrix(r)) {
          const out=scale(l,r); steps.push({title:`Умножение матрицы на ${fmt(r)}`,detail:'Каждый элемент умножаем на коэффициент.',result:out}); return out;
        }
        if (!isMatrix(l)&&isMatrix(r)) {
          const out=scale(r,l); steps.push({title:`Умножение матрицы на ${fmt(l)}`,detail:'Каждый элемент умножаем на коэффициент.',result:out}); return out;
        }
        const [lr,lc]=shape(l),[rr,rc]=shape(r);
        const out=multiply(l,r);
        const details=[];
        if (lr<=3 && rc<=3 && lc<=4) {
          for (let i=0;i<lr;i++) for (let j=0;j<rc;j++) {
            const terms=[]; let sum=0;
            for (let k=0;k<lc;k++) { terms.push(`${fmt(l[i][k])}·${fmt(r[k][j])}`); sum+=l[i][k]*r[k][j]; }
            details.push(`c${i+1}${j+1} = ${terms.join(' + ')} = ${fmt(sum)}`);
          }
        }
        steps.push({title:`Умножение ${lr}×${lc} на ${rr}×${rc}`,detail:'Строка первой матрицы умножается на столбец второй.',details,result:out}); return out;
      }
      throw new Error('Неизвестная операция.');
    }
    const value=evalNode(ast);
    return {value,steps,ast};
  }

  // --- Polynomials in x, coefficients low -> high ---
  function polyTrim(p) {
    const q=p.map(roundNumber);
    while(q.length>1 && Math.abs(q[q.length-1])<EPS) q.pop();
    return q;
  }
  function polyAdd(a,b) { const n=Math.max(a.length,b.length),r=Array(n).fill(0); for(let i=0;i<n;i++) r[i]=(a[i]||0)+(b[i]||0); return polyTrim(r); }
  function polySub(a,b) { return polyAdd(a,b.map(v=>-v)); }
  function polyMul(a,b) { const r=Array(a.length+b.length-1).fill(0); for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)r[i+j]+=a[i]*b[j]; return polyTrim(r); }
  function parseAffine(raw) {
    let s=String(raw??'').trim().replace(/\s+/g,'').replace(/,/g,'.').replace(/−/g,'-');
    if (!s) throw new Error('Пустая ячейка в матрице с x.');
    if (!s.includes('x')&&!s.includes('X')) return [parseNumber(s)];
    s=s.toLowerCase();
    if (!/^[+\-0-9.x*]+$/.test(s)) throw new Error(`В режиме x поддерживаются только выражения вида x, -x, 2x, 3*x+2. Ошибка: ${raw}`);
    s=s.replace(/\*/g,'');
    // Normalize terms by turning subtraction into +-
    if (s[0]!=='-'&&s[0]!=='+') s='+'+s;
    const terms=s.match(/[+-][^+-]+/g)||[];
    let c=0,k=0;
    for(const t of terms){
      const sign=t[0]==='-'?-1:1, body=t.slice(1);
      if(body.includes('x')){
        if(body.replace('x','').includes('x')) throw new Error('В одной ячейке допускается только линейное выражение по x.');
        const coef=body.replace('x','');
        k += sign*(coef===''?1:Number(coef));
        if(!Number.isFinite(k)) throw new Error(`Не удалось прочитать коэффициент при x: ${raw}`);
      } else {
        const v=Number(body); if(!Number.isFinite(v)) throw new Error(`Не удалось прочитать число: ${raw}`); c+=sign*v;
      }
    }
    return polyTrim([c,k]);
  }
  function determinantPoly(matrixStrings) {
    const n=matrixStrings.length;
    if(!n||!matrixStrings.every(r=>r.length===n)) throw new Error('Для det матрица должна быть квадратной.');
    const m=matrixStrings.map(r=>r.map(parseAffine));
    function rec(mat){
      const size=mat.length;
      if(size===1)return mat[0][0];
      let out=[0];
      for(let j=0;j<size;j++){
        const minor=mat.slice(1).map(r=>r.filter((_,c)=>c!==j));
        let term=polyMul(mat[0][j],rec(minor));
        if(j%2)term=term.map(v=>-v);
        out=polyAdd(out,term);
      }
      return polyTrim(out);
    }
    return rec(m);
  }
  function polyToString(p) {
    p=polyTrim(p);
    if(p.every(v=>Math.abs(v)<EPS)) return '0';
    const terms=[];
    for(let i=p.length-1;i>=0;i--){
      const c=roundNumber(p[i]); if(Math.abs(c)<EPS)continue;
      const abs=Math.abs(c); let body='';
      if(i===0)body=fmt(abs);
      else if(i===1)body=(Math.abs(abs-1)<EPS?'':fmt(abs))+'x';
      else body=(Math.abs(abs-1)<EPS?'':fmt(abs))+`x^${i}`;
      if(!terms.length)terms.push((c<0?'-':'')+body); else terms.push((c<0?' − ':' + ')+body);
    }
    return terms.join('');
  }
  function solvePolynomialEquation(p) {
    p=polyTrim(p); const deg=p.length-1;
    if(deg===0) return Math.abs(p[0])<EPS ? {type:'all',roots:[]} : {type:'none',roots:[]};
    if(deg===1) return {type:'roots',roots:[roundNumber(-p[0]/p[1])]};
    if(deg===2){
      const [c,b,a]=p; const D=roundNumber(b*b-4*a*c);
      if(D<-EPS)return {type:'roots',roots:[],discriminant:D};
      if(Math.abs(D)<=EPS)return {type:'roots',roots:[roundNumber(-b/(2*a))],discriminant:0};
      const s=Math.sqrt(D); return {type:'roots',roots:[roundNumber((-b-s)/(2*a)),roundNumber((-b+s)/(2*a))].sort((x,y)=>x-y),discriminant:D};
    }
    return {type:'unsupported',roots:[],degree:deg};
  }
  function signIntervals(p, relation) {
    const eq=solvePolynomialEquation(p);
    if(eq.type==='unsupported') return {type:'unsupported',text:`Получился многочлен степени ${eq.degree}; автоматическое решение не включено.`};
    if(eq.type==='all') {
      const trueFor = relation==='>='||relation==='<='||relation==='=';
      return {type:'interval',text:trueFor?'x ∈ ℝ':'∅'};
    }
    if(eq.type==='none') {
      const val=p[0];
      const ok = relation==='>'?val>0:relation==='<'?val<0:relation==='>='?val>=0:relation==='<='?val<=0:false;
      return {type:'interval',text:ok?'x ∈ ℝ':'∅'};
    }
    const roots=eq.roots;
    if(relation==='=') return {type:'interval',text:roots.length?roots.map(r=>`x = ${fmt(r)}`).join('; '):'∅',roots};
    const points=[-Infinity,...roots,Infinity];
    const intervals=[];
    function evalP(x){return p.reduceRight((acc,c)=>acc*x+c,0);}
    for(let i=0;i<points.length-1;i++){
      const l=points[i],r=points[i+1]; let test;
      if(!Number.isFinite(l))test=r-1; else if(!Number.isFinite(r))test=l+1; else test=(l+r)/2;
      const v=evalP(test);
      const ok=relation==='>'?v>EPS:relation==='<'?v<-EPS:relation==='>='?v>=-EPS:v<=EPS;
      if(ok) intervals.push({l,r,closedL:false,closedR:false});
    }
    if(relation==='>='||relation==='<='){
      for(const rt of roots) intervals.push({point:rt});
    }
    // Format union; for non-strict merge point endpoints conceptually
    if(relation==='>='||relation==='<='){
      const goodIntervals=[];
      for(let i=0;i<points.length-1;i++){
        const l=points[i],r=points[i+1]; let test=!Number.isFinite(l)?r-1:!Number.isFinite(r)?l+1:(l+r)/2;
        const v=evalP(test); const ok=relation==='>='?v>=-EPS:v<=EPS;
        if(ok) goodIntervals.push({l,r,closedL:Number.isFinite(l),closedR:Number.isFinite(r)});
      }
      for(const rt of roots){
        if(!goodIntervals.some(it=>(it.l===rt||it.r===rt))) goodIntervals.push({point:rt});
      }
      return {type:'interval',text:formatIntervals(goodIntervals),roots};
    }
    return {type:'interval',text:formatIntervals(intervals),roots};
  }
  function formatIntervals(intervals){
    if(!intervals.length)return '∅';
    const parts=intervals.map(it=>{
      if('point'in it)return `{${fmt(it.point)}}`;
      const l=it.l===-Infinity?'−∞':fmt(it.l), r=it.r===Infinity?'+∞':fmt(it.r);
      return `${it.closedL?'[':'('}${l}; ${r}${it.closedR?']':')'}`;
    });
    return parts.join(' ∪ ');
  }

  return {
    EPS, roundNumber, cleanMatrix, isMatrix, cloneMatrix, shape, identity, zero,
    add, sub, scale, transpose, multiply, power, determinant, determinantSteps,
    rank, rankWithSteps, approxEqual, fmt, parseNumber, parseMatrixExpression,
    parseAffine, determinantPoly, polyToString, solvePolynomialEquation, signIntervals
  };
});
