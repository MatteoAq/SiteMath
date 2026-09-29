(() => {
  const M=window.MatrixCore;
  const $=s=>document.querySelector(s);
  const fmt=M.fmt;
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function signed(v){return v<0?`(${fmt(v)})`:fmt(v)}
  function matrixHTML(m){
    const cells=m.flat().map(v=>`<span>${esc(fmt(v))}</span>`).join('');
    return `<div class="matrix-scroll"><div class="render-matrix" style="--cols:${m[0].length}">${cells}</div></div>`;
  }
  function readNumericMatrix(root){
    const el=$(root); if(!el)throw new Error('Матрица не найдена.');
    const inputs=[...el.querySelectorAll('input')];
    const cols=getComputedStyle(el).gridTemplateColumns.split(' ').length;
    if(!inputs.length||!cols)throw new Error('Матрица пустая.');
    const vals=inputs.map(x=>M.parseNumber(x.value));
    const rows=Math.ceil(vals.length/cols);
    return Array.from({length:rows},(_,i)=>vals.slice(i*cols,(i+1)*cols));
  }
  function readStringMatrix(root,rows=3,cols=3){
    const inputs=[...$(root).querySelectorAll('input')];
    return Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>inputs[i*cols+j]?.value??''));
  }

  function lineInput(line,index){
    const row=document.createElement('div');
    row.className='notebook-line';
    row.dataset.index=index;
    const expr=document.createElement('div');
    expr.className='notebook-expression';
    expr.innerHTML=line.html??esc(line.expr);
    const eq=document.createElement('span');eq.className='notebook-equals';eq.textContent='=';
    const inp=document.createElement('input');
    inp.className='notebook-input';inp.placeholder='?';
    inp.inputMode=line.kind==='text'?'text':'decimal';
    inp.setAttribute('aria-label',line.aria||`Ответ для ${line.expr||'шага'}`);
    row.append(expr,eq,inp);
    return {row,inp};
  }

  function verifyNumeric(raw,expected){
    try{return M.approxEqual(M.parseNumber(raw),expected)}catch{return false}
  }
  function normalizeSimple(s){
    return String(s??'').toLowerCase()
      .replace(/[−–—]/g,'-').replace(/,/g,'.').replace(/\s+/g,'')
      .replace(/α/g,'a').replace(/²/g,'^2').replace(/·/g,'*');
  }
  function verifyAccepted(raw,accepted){
    const v=normalizeSimple(raw);
    return accepted.some(x=>normalizeSimple(x)===v);
  }
  function compileExpr(raw,vars=['x']){
    let s=normalizeSimple(raw).replace(/\^/g,'**');
    for(const v of vars){
      s=s.replace(new RegExp('([0-9]|[)])'+v,'g'),`$1*${v}`);
      s=s.replace(new RegExp(v+'([0-9]|[(])','g'),`${v}*$1`);
    }
    s=s.replace(/\)(?=[a-z0-9(])/g,')*').replace(/([a-z0-9])\(/g,'$1*(');
    if(!/^[0-9a-z+\-*/().]*$/.test(s))throw new Error('Недопустимое выражение');
    return Function(...vars,`"use strict";return (${s});`);
  }
  function verifyBySamples(raw,expectedFn,vars=['x']){
    let fn;try{fn=compileExpr(raw,vars)}catch{return false}
    const samples=[
      [1,2,3],[2,-1,4],[-2,3,1],[3,5,-2],[0.5,2,-3]
    ];
    try{
      for(const vals of samples){
        const args=vars.map((_,i)=>vals[i]);
        const a=Number(fn(...args)),b=Number(expectedFn(...args));
        if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-7*Math.max(1,Math.abs(b)))return false;
      }
      return true;
    }catch{return false}
  }

  function makeStage({title,intro='',lines,resultMatrix=null,hint='',verifyLine=null}){
    const stage=document.createElement('article');
    stage.className='card notebook-stage';
    stage.innerHTML=`<div class="notebook-stage-head"><span class="notebook-check">○</span><div><h3>${esc(title)}</h3>${intro?`<p class="muted">${intro}</p>`:''}</div></div>`;
    const linesBox=document.createElement('div');linesBox.className='notebook-lines';
    const inputs=[];
    lines.forEach((line,i)=>{
      const {row,inp}=lineInput(line,i);linesBox.append(row);inputs.push(inp);
    });
    const actions=document.createElement('div');actions.className='quick-row top-gap-small';
    const check=document.createElement('button');check.className='primary';check.textContent='Проверить этот этап';
    actions.append(check);
    let hintBtn=null,hintBox=null;
    if(hint){
      hintBtn=document.createElement('button');hintBtn.className='ghost';hintBtn.textContent='Подсказка';actions.append(hintBtn);
      hintBox=document.createElement('div');hintBox.className='hint hidden';hintBox.innerHTML=hint;
      hintBtn.addEventListener('click',()=>hintBox.classList.toggle('hidden'));
    }
    const feedback=document.createElement('div');feedback.className='message hidden';
    const result=document.createElement('div');result.className='notebook-stage-result hidden';
    if(resultMatrix)result.innerHTML=`<div class="given-title">Получилось</div>${matrixHTML(resultMatrix)}`;
    stage.append(linesBox,actions);
    if(hintBox)stage.append(hintBox);
    stage.append(feedback,result);
    stage._inputs=inputs;stage._lines=lines;stage._feedback=feedback;stage._result=result;stage._check=check;
    stage._validate=()=>{
      let all=true,filled=true;
      lines.forEach((line,i)=>{
        const inp=inputs[i],raw=inp.value;
        if(!String(raw).trim())filled=false;
        const ok=verifyLine?verifyLine(raw,line,i):(line.verify?line.verify(raw):verifyNumeric(raw,line.expected));
        inp.classList.toggle('cell-ok',ok);
        inp.classList.toggle('cell-bad',String(raw).trim()!==''&&!ok);
        if(!ok)all=false;
      });
      feedback.className=`message ${all?'success':'error'}`;
      feedback.textContent=all?'Верно. Можно переходить к следующей строке решения.':(!filled?'Заполни все строки этого этапа.':'Есть ошибка – проверь отмеченные вычисления.');
      feedback.classList.remove('hidden');
      if(all){stage.classList.add('notebook-stage-complete');stage.querySelector('.notebook-check').textContent='✓';result.classList.remove('hidden')}
      return all;
    };
    check.addEventListener('click',()=>stage._validate());
    return stage;
  }

  function sequentialNotebook(container,stages){
    container.innerHTML='';
    const built=stages.map((cfg,i)=>{
      const st=makeStage(cfg); if(i>0)st.classList.add('notebook-locked');container.append(st);return st;
    });
    built.forEach((st,i)=>{
      const base=st._validate;
      st._validate=()=>{
        const ok=base();
        if(ok&&built[i+1])built[i+1].classList.remove('notebook-locked');
        return ok;
      };
    });
    return built;
  }

  function scalarStage(title,k,m,label){
    const lines=[],out=m.map(r=>r.map(v=>M.roundNumber(k*v)));
    for(let i=0;i<m.length;i++)for(let j=0;j<m[0].length;j++)
      lines.push({expr:`${label}₍${i+1}${j+1}₎: ${fmt(k)} · ${signed(m[i][j])}`,expected:out[i][j]});
    return {title,lines,resultMatrix:out};
  }
  function multiplyStage(title,A,B,label='c'){
    const out=M.multiply(A,B),lines=[];
    for(let i=0;i<A.length;i++)for(let j=0;j<B[0].length;j++){
      const terms=A[i].map((v,k)=>`${signed(v)}·${signed(B[k][j])}`);
      lines.push({expr:`${label}₍${i+1}${j+1}₎: ${terms.join(' + ')}`,expected:out[i][j]});
    }
    return {title,intro:'Каждый элемент – строка первой матрицы × столбец второй.',lines,resultMatrix:out,
      hint:'Не умножай элементы «по местам». Для каждого ответа бери целую строку слева и целый столбец справа.'};
  }
  function combineStage(title,A,B,op,label){
    const out=op==='+'?M.add(A,B):M.sub(A,B),lines=[];
    for(let i=0;i<A.length;i++)for(let j=0;j<A[0].length;j++)
      lines.push({expr:`${label}₍${i+1}${j+1}₎: ${signed(A[i][j])} ${op} ${signed(B[i][j])}`,expected:out[i][j]});
    return {title,lines,resultMatrix:out};
  }

  function buildTask1(){
    const box=$('#task1Notebook');if(!box)return;
    const A=[[2,3],[-1,4]],B=[[3,-5],[2,-1]];
    const A2=M.scale(A,2),B3=M.scale(B,3),AB=M.multiply(A,B),D=M.sub(A2,B3),C=M.add(D,AB);
    sequentialNotebook(box,[
      scalarStage('1. Умножаем A на 2',2,A,'(2A)'),
      scalarStage('2. Умножаем B на 3',3,B,'(3B)'),
      multiplyStage('3. Считаем AB по каждому элементу',A,B,'(AB)'),
      combineStage('4. Считаем D = 2A − 3B',A2,B3,'−','D'),
      combineStage('5. Считаем C = D + AB',D,AB,'+','C')
    ]);
  }

  function buildTask2(){
    const box=$('#task2Notebook');if(!box)return;
    const A=[[2,3],[-1,4]],B=[[3,-5],[2,-1]];
    const A2=M.multiply(A,A),B2=M.multiply(B,B);
    sequentialNotebook(box,[
      multiplyStage('1. A² = A·A',A,A,'(A²)'),
      multiplyStage('2. B² = B·B',B,B,'(B²)'),
      combineStage('3. K = A² + B²',A2,B2,'+','K')
    ]);
  }

  function buildTeacherAB(){
    const box=$('#teacherABNotebook');if(!box)return;
    const A=[[2,-1,4,-3],[-2,3,0,1],[4,-2,5,-1]],B=[[10,5],[3,2],[-1,-3],[4,1]];
    const first=multiplyStage('1. Вычисляем AB – все 6 элементов',A,B,'(AB)');
    const second={
      title:'2. Проверяем, существует ли BA',
      intro:'Размер B = 4×2, размер A = 3×4. Для BA сравни внутренние размеры: число столбцов B и число строк A.',
      lines:[{expr:'Столбцов B = 2, строк A = 3. Произведение BA',kind:'text',
        verify:raw=>verifyAccepted(raw,['не существует','невозможно','нет'])}],
      hint:'Для произведения X·Y должно выполняться: столбцов X = строк Y.'
    };
    sequentialNotebook(box,[first,second]);
  }

  function buildFunction(){
    const box=$('#functionNotebook');if(!box)return;
    const A=[[3,-1],[-2,2]],A2=M.multiply(A,A),twoA=M.scale(A,2),fourI=[[4,0],[0,4]],sum=M.add(A2,twoA),F=M.sub(sum,fourI);
    const finalLines=[];
    for(let i=0;i<2;i++)for(let j=0;j<2;j++)
      finalLines.push({expr:`f(A)₍${i+1}${j+1}₎: ${signed(A2[i][j])} + ${signed(twoA[i][j])} − ${signed(fourI[i][j])}`,expected:F[i][j]});
    sequentialNotebook(box,[
      multiplyStage('1. A² = A·A – четыре отдельных вычисления',A,A,'(A²)'),
      scalarStage('2. 2A',2,A,'(2A)'),
      {title:'3. 4I₂',intro:'I₂ имеет единицы на главной диагонали и нули вне её.',
       lines:[
         {expr:'4·1',expected:4},{expr:'4·0',expected:0},{expr:'4·0',expected:0},{expr:'4·1',expected:4}
       ],resultMatrix:fourI},
      {title:'4. Собираем f(A)=A²+2A−4I по каждому элементу',lines:finalLines,resultMatrix:F}
    ]);
  }

  function detProducts3(m){
    const a=m;
    const defs=[
      [[0,0],[1,1],[2,2]],[[0,1],[1,2],[2,0]],[[0,2],[1,0],[2,1]],
      [[0,2],[1,1],[2,0]],[[0,1],[1,0],[2,2]],[[0,0],[1,2],[2,1]]
    ];
    return defs.map(coords=>({
      coords,
      values:coords.map(([i,j])=>a[i][j]),
      value:coords.reduce((p,[i,j])=>p*a[i][j],1)
    }));
  }
  function buildNumericDet(){
    const box=$('#detNotebook');if(!box)return;
    let m;try{m=readNumericMatrix('#matrixDet')}catch(e){box.innerHTML=`<div class="message error">${esc(e.message)}</div>`;return}
    if(m.length!==m[0].length){box.innerHTML='<div class="message error">Определитель есть только у квадратной матрицы.</div>';return}
    if(m.length===2){
      const p1=m[0][0]*m[1][1],p2=m[0][1]*m[1][0],det=p1-p2;
      sequentialNotebook(box,[
        {title:'1. Главная диагональ',lines:[{expr:`${signed(m[0][0])}·${signed(m[1][1])}`,expected:p1}]},
        {title:'2. Побочная диагональ',lines:[{expr:`${signed(m[0][1])}·${signed(m[1][0])}`,expected:p2}]},
        {title:'3. Вычитаем второе произведение из первого',lines:[{expr:`${signed(p1)} − ${signed(p2)}`,expected:det}]}
      ]);return;
    }
    if(m.length===3){
      const p=detProducts3(m),plus=p.slice(0,3).map(x=>x.value),minus=p.slice(3).map(x=>x.value);
      const ps=plus.reduce((a,b)=>a+b,0),ms=minus.reduce((a,b)=>a+b,0),det=ps-ms;
      sequentialNotebook(box,[
        {title:'1. Три произведения со знаком «+»',intro:'Правило Саррюса – сначала считаем каждую диагональ отдельно.',
         lines:p.slice(0,3).map(x=>({expr:x.values.map(signed).join(' · '),expected:x.value}))},
        {title:'2. Три произведения со знаком «−»',
         lines:p.slice(3).map(x=>({expr:x.values.map(signed).join(' · '),expected:x.value}))},
        {title:'3. Отдельно складываем три «плюса» и три «минуса»',
         lines:[
           {expr:plus.map(signed).join(' + '),expected:ps},
           {expr:minus.map(signed).join(' + '),expected:ms}
         ]},
        {title:'4. Получаем определитель',lines:[{expr:`${signed(ps)} − ${signed(ms)}`,expected:det}]}
      ]);return;
    }
    box.innerHTML='<div class="message error">Для подготовки по вашему листку пошаговый режим сейчас рассчитан на 2×2 и 3×3. Для больших матриц используй отдельный черновик.</div>';
  }

  function detStagesFor(m){
    if(m.length!==m[0].length)throw new Error('Определитель есть только у квадратной матрицы.');
    if(m.length===2){
      const p1=m[0][0]*m[1][1],p2=m[0][1]*m[1][0],det=p1-p2;
      return [
        {title:'1. Главная диагональ',lines:[{expr:`${signed(m[0][0])}·${signed(m[1][1])}`,expected:p1}]},
        {title:'2. Побочная диагональ',lines:[{expr:`${signed(m[0][1])}·${signed(m[1][0])}`,expected:p2}]},
        {title:'3. Вычитаем второе произведение из первого',lines:[{expr:`${signed(p1)} − ${signed(p2)}`,expected:det}]}
      ];
    }
    if(m.length===3){
      const p=detProducts3(m),plus=p.slice(0,3).map(x=>x.value),minus=p.slice(3).map(x=>x.value);
      const ps=plus.reduce((a,b)=>a+b,0),ms=minus.reduce((a,b)=>a+b,0),det=ps-ms;
      return [
        {title:'1. Три произведения со знаком «+»',intro:'Правило Саррюса – сначала считаем каждую диагональ отдельно.',
         lines:p.slice(0,3).map(x=>({expr:x.values.map(signed).join(' · '),expected:x.value}))},
        {title:'2. Три произведения со знаком «−»',
         lines:p.slice(3).map(x=>({expr:x.values.map(signed).join(' · '),expected:x.value}))},
        {title:'3. Складываем три «плюса» и три «минуса» отдельно',
         lines:[{expr:plus.map(signed).join(' + '),expected:ps},{expr:minus.map(signed).join(' + '),expected:ms}]},
        {title:'4. Получаем det',lines:[{expr:`${signed(ps)} − ${signed(ms)}`,expected:det}]}
      ];
    }
    throw new Error('Пошаговый тренажёр определителя рассчитан на 2×2 и 3×3.');
  }

  function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
  function randomMatrix(rows,cols,min=-4,max=5){
    return Array.from({length:rows},()=>Array.from({length:cols},()=>randomInt(min,max)));
  }
  function renderGivenMatrices(box,A,B=null){
    if(!box)return;
    box.innerHTML=`<div class="teacher-given-grid"><div><b>A</b>${matrixHTML(A)}</div>${B?`<div><b>B</b>${matrixHTML(B)}</div>`:''}</div>`;
  }

  function buildRandomPractice(){
    const type=$('#notebookPracticeType')?.value||'add';
    const area=$('#notebookPracticeArea'),given=$('#notebookPracticeGiven');
    if(!area)return;
    try{
      if(type==='add'){
        const A=randomMatrix(2,2),B=randomMatrix(2,2);
        renderGivenMatrices(given,A,B);
        sequentialNotebook(area,[combineStage('Складываем по одинаковым позициям',A,B,'+','C')]);
      }else if(type==='mul'){
        const A=randomMatrix(2,2,-3,4),B=randomMatrix(2,2,-3,4);
        renderGivenMatrices(given,A,B);
        sequentialNotebook(area,[multiplyStage('Считаем AB – четыре отдельных скалярных произведения',A,B,'C')]);
      }else{
        const n=type==='det2'?2:3,m=randomMatrix(n,n,-4,5);
        renderGivenMatrices(given,m);
        sequentialNotebook(area,detStagesFor(m));
      }
    }catch(e){area.innerHTML=`<div class="message error">${esc(e.message)}</div>`}
  }

  function buildCustomNotebook(){
    const area=$('#customNotebookArea'),given=$('#customNotebookGiven');
    if(!area)return;
    try{
      const A=readNumericMatrix('#matrixA'),B=readNumericMatrix('#matrixB');
      renderGivenMatrices(given,A,B);
      const expr=$('#customNotebookExpr').value;
      let stages;
      if(expr==='A+B')stages=[combineStage('A+B – считаем каждый элемент',A,B,'+','C')];
      else if(expr==='A-B')stages=[combineStage('A−B – считаем каждый элемент',A,B,'−','C')];
      else if(expr==='A*B')stages=[multiplyStage('AB – строка A × столбец B для каждого элемента',A,B,'C')];
      else if(expr==='B*A')stages=[multiplyStage('BA – строка B × столбец A для каждого элемента',B,A,'C')];
      else if(expr==='A^2')stages=[multiplyStage('A² = A·A',A,A,'A²')];
      else if(expr==='B^2')stages=[multiplyStage('B² = B·B',B,B,'B²')];
      else throw new Error('Неизвестная операция.');
      sequentialNotebook(area,stages);
    }catch(e){
      given.innerHTML='';
      area.innerHTML=`<div class="message error">${esc(e.message)}</div>`;
    }
  }

  function polyMul(a,b){const r=Array(a.length+b.length-1).fill(0);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)r[i+j]+=a[i]*b[j];return r}
  function polyAdd(a,b){const n=Math.max(a.length,b.length),r=Array(n).fill(0);for(let i=0;i<n;i++)r[i]=(a[i]||0)+(b[i]||0);return r}
  function polySub(a,b){return polyAdd(a,b.map(v=>-v))}
  function polyEval(p,x){let v=0;for(let i=p.length-1;i>=0;i--)v=v*x+p[i];return v}
  function polyFromCells(cells){return cells.map(M.parseAffine).reduce((p,q)=>polyMul(p,q),[1])}
  function verifyPoly(raw,p){return verifyBySamples(raw,x=>polyEval(p,x),['x'])}
  function exprCell(v){const s=String(v).trim();return /[+\-]/.test(s.slice(1))?`(${s})`:s}

  function buildVariableDet(){
    const box=$('#varDetNotebook');if(!box)return;
    const m=readStringMatrix('#matrixX',3,3);
    const coords=[
      [[0,0],[1,1],[2,2]],[[0,1],[1,2],[2,0]],[[0,2],[1,0],[2,1]],
      [[0,2],[1,1],[2,0]],[[0,1],[1,0],[2,2]],[[0,0],[1,2],[2,1]]
    ];
    let products;
    try{products=coords.map(c=>({c,p:polyFromCells(c.map(([i,j])=>m[i][j]))}))}
    catch(e){box.innerHTML=`<div class="message error">${esc(e.message)}</div>`;return}
    const plus=products.slice(0,3).map(x=>x.p),minus=products.slice(3).map(x=>x.p);
    const ps=plus.reduce(polyAdd,[0]),ms=minus.reduce(polyAdd,[0]),det=polySub(ps,ms);
    const relation=$('#relationSelect').value;
    const stages=[
      {title:'1. Три произведения «плюс»',lines:products.slice(0,3).map(x=>({
        expr:x.c.map(([i,j])=>exprCell(m[i][j])).join(' · '),verify:raw=>verifyPoly(raw,x.p)
      }))},
      {title:'2. Три произведения «минус»',lines:products.slice(3).map(x=>({
        expr:x.c.map(([i,j])=>exprCell(m[i][j])).join(' · '),verify:raw=>verifyPoly(raw,x.p)
      }))},
      {title:'3. Складываем каждую тройку',lines:[
        {expr:'сумма «плюсов»',verify:raw=>verifyPoly(raw,ps)},
        {expr:'сумма «минусов»',verify:raw=>verifyPoly(raw,ms)}
      ]},
      {title:'4. Вычитаем: det(A) = сумма «плюсов» − сумма «минусов»',
       lines:[{expr:'det(A)',verify:raw=>verifyPoly(raw,det)}],
       hint:`На этом этапе у тебя должен получиться обычный многочлен от x.`}
    ];
    const sol=M.signIntervals(det,relation);
    if(relation==='='&&sol.roots?.length){
      stages.push({title:'5. Решаем получившееся уравнение',lines:sol.roots.map((r,i)=>({expr:`x${sol.roots.length>1?i+1:''}`,expected:r}))});
    }else if(sol.roots?.length===2){
      const roots=sol.roots.slice().sort((a,b)=>a-b);
      stages.push({title:'5. Находим нули многочлена',lines:[
        {expr:'меньший корень',expected:roots[0]},{expr:'больший корень',expected:roots[1]}
      ]});
      stages.push({title:'6. Выбираем промежуток по знаку',lines:[{
        expr:'ответ',kind:'text',verify:raw=>{
          const n=normalizeSimple(raw).replace(/^x∈/,'');
          const target=normalizeSimple(sol.text).replace(/^x∈/,'');
          if(n===target)return true;
          if(relation==='>'&&n===`${roots[0]}<x<${roots[1]}`)return true;
          if(relation==='<'&&target.includes('∪'))return n===target;
          return false;
        }
      }],hint:'После корней нарисуй числовую прямую в черновике сверху и расставь знаки на промежутках.'});
    }else{
      stages.push({title:'5. Записываем конечный ответ',lines:[{expr:'ответ',kind:'text',verify:raw=>normalizeSimple(raw)===normalizeSimple(sol.text)}]});
    }
    sequentialNotebook(box,stages);
  }

  function buildTrigDet(){
    const box=$('#trigDetNotebook');if(!box)return;
    box.classList.remove('hidden');
    sequentialNotebook(box,[
      {title:'1. Считаем два произведения из ad − bc',lines:[
        {expr:'sin α · sin α',kind:'text',verify:r=>verifyAccepted(r,['sin^2a','sin²α','sin^2α','sin²a'])},
        {expr:'cos α · (−cos α)',kind:'text',verify:r=>verifyAccepted(r,['-cos^2a','-cos²α','-cos^2α','-cos²a'])}
      ]},
      {title:'2. Вычитаем второе произведение',lines:[{
        expr:'sin²α − (−cos²α)',kind:'text',verify:r=>verifyAccepted(r,['sin²α+cos²α','sin^2a+cos^2a','sin^2α+cos^2α'])
      }]},
      {title:'3. Используем sin²α + cos²α = 1',lines:[{expr:'det',expected:1}]}
    ]);
  }

  function buildSymbolicDet(){
    const box=$('#symbolicDetNotebook');if(!box)return;
    box.classList.remove('hidden');
    const e1=(a,b,c)=>(a+1)*(a*b-a*c);
    const e2=(a,b,c)=>(b-c)*(a*a+a);
    const det=(a,b,c)=>e1(a,b,c)-e2(a,b,c);
    sequentialNotebook(box,[
      {title:'1. Первое произведение ad',lines:[{expr:'(a+1)(ab−ac)',kind:'text',verify:r=>verifyBySamples(r,e1,['a','b','c'])}]},
      {title:'2. Второе произведение bc',lines:[{expr:'(b−c)(a²+a)',kind:'text',verify:r=>verifyBySamples(r,e2,['a','b','c'])}]},
      {title:'3. Вычитаем',lines:[{expr:'первое произведение − второе',kind:'text',verify:r=>verifyBySamples(r,det,['a','b','c'])}],
       hint:'Оба произведения можно привести к одному и тому же виду a(a+1)(b−c). Тогда их разность сразу видна.'}
    ]);
  }

  buildTask1();
  buildRandomPractice();
  $('#newNotebookPractice')?.addEventListener('click',buildRandomPractice);
  $('#notebookPracticeType')?.addEventListener('change',buildRandomPractice);
  $('#startCustomNotebook')?.addEventListener('click',buildCustomNotebook);
  $('#openTask2Notebook')?.addEventListener('click',()=>{
    const box=$('#task2Notebook');box.classList.toggle('hidden');
    if(!box.dataset.ready){buildTask2();box.dataset.ready='1'}
    $('#openTask2Notebook').textContent=box.classList.contains('hidden')?'Открыть задание 2':'Скрыть задание 2';
  });
  $('#teacherOpenTask2')?.addEventListener('click',()=>{
    document.querySelector('[data-section="start"]')?.click();
    const box=$('#task2Notebook');box.classList.remove('hidden');
    if(!box.dataset.ready){buildTask2();box.dataset.ready='1'}
  });
  $('#openTeacherABNotebook')?.addEventListener('click',()=>{
    const box=$('#teacherABNotebook');box.classList.toggle('hidden');
    if(!box.dataset.ready){buildTeacherAB();box.dataset.ready='1'}
  });
  $('#openFunctionNotebook')?.addEventListener('click',()=>{
    const box=$('#functionNotebook');box.classList.toggle('hidden');
    if(!box.dataset.ready){buildFunction();box.dataset.ready='1'}
  });
  $('#buildDetNotebook')?.addEventListener('click',buildNumericDet);
  $('#buildVarDetNotebook')?.addEventListener('click',buildVariableDet);
  $('#openTrigDetNotebook')?.addEventListener('click',buildTrigDet);
  $('#openSymbolicDetNotebook')?.addEventListener('click',buildSymbolicDet);

  // После загрузки примеров преподавателя сразу открываем соответствующий ручной раздел.
  $('#teacherDet1Button')?.addEventListener('click',()=>setTimeout(()=>{$('#buildDetNotebook')?.click()},0));
  $('#teacherDet2Button')?.addEventListener('click',()=>setTimeout(()=>{$('#buildDetNotebook')?.click()},0));
  $('#teacherEqButton')?.addEventListener('click',()=>setTimeout(()=>{$('#buildVarDetNotebook')?.click()},0));
  $('#teacherIneqButton')?.addEventListener('click',()=>setTimeout(()=>{$('#buildVarDetNotebook')?.click()},0));

  window.Workbook={buildTask1,buildTask2,buildNumericDet,buildVariableDet};
})();