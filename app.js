(() => {
  const M = window.MatrixCore;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const storage = {
    get(key){ try{return localStorage.getItem(key)}catch{return null} },
    set(key,value){ try{localStorage.setItem(key,value)}catch{} }
  };
  const state = {
    dims:{A:[2,2],B:[2,2],Det:[3,3],Rank:[3,3]},
    values:{
      A:[[2,3],[-1,4]],
      B:[[3,-5],[2,-1]],
      Det:[[3,-2,1],[-2,1,3],[2,0,-2]],
      Rank:[[-1,2,-3],[5,6,-2],[4,-3,1]],
      X:[['1','3','x'],['4','5','-1'],['2','-1','5']]
    },
    solvedCount: Number(storage.get('matrixSolvedCount')||0),
    practice:null,
    customPractice:null
  };

  function go(section){
    $$('.section').forEach(x=>x.classList.toggle('active',x.id===section));
    $$('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.section===section));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>go(b.dataset.section)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));

  $('#themeToggle').addEventListener('click',()=>{
    document.documentElement.classList.toggle('dark');
    storage.set('matrixTheme',document.documentElement.classList.contains('dark')?'dark':'light');
  });
  if(storage.get('matrixTheme')==='dark') document.documentElement.classList.add('dark');

  function createSizeControls(containerId,key,max=6){
    const box=$(containerId); box.innerHTML='';
    const row=document.createElement('select'), col=document.createElement('select');
    for(let i=1;i<=max;i++){ row.add(new Option(`${i} стр.`,i)); col.add(new Option(`${i} ст.`,i)); }
    row.value=state.dims[key][0]; col.value=state.dims[key][1];
    row.setAttribute('aria-label',`Строки ${key}`); col.setAttribute('aria-label',`Столбцы ${key}`);
    row.addEventListener('change',()=>resizeMatrix(key,+row.value,+col.value));
    col.addEventListener('change',()=>resizeMatrix(key,+row.value,+col.value));
    box.append(row,col);
  }

  function resizeMatrix(key,rows,cols){
    const old=state.values[key]||[]; const next=Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>old[i]?.[j] ?? 0));
    state.dims[key]=[rows,cols]; state.values[key]=next; renderEditor(key);
  }

  function renderEditor(key){
    const id = key==='A'?'#matrixA':key==='B'?'#matrixB':key==='Det'?'#matrixDet':'#matrixRank';
    const box=$(id), [rows,cols]=state.dims[key]; box.innerHTML=''; box.style.gridTemplateColumns=`repeat(${cols},64px)`;
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
      const input=document.createElement('input'); input.value=state.values[key][i][j]; input.inputMode='decimal'; input.dataset.row=i; input.dataset.col=j; input.setAttribute('aria-label',`${key} строка ${i+1} столбец ${j+1}`);
      input.addEventListener('input',()=>state.values[key][i][j]=input.value);
      box.append(input);
    }
  }

  function renderX(){
    const box=$('#matrixX'); box.innerHTML=''; box.style.gridTemplateColumns='repeat(3,64px)';
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){
      const input=document.createElement('input'); input.value=state.values.X[i][j]; input.dataset.row=i; input.dataset.col=j; input.setAttribute('aria-label',`X строка ${i+1} столбец ${j+1}`);
      input.addEventListener('input',()=>state.values.X[i][j]=input.value);
      box.append(input);
    }
  }

  function getNumeric(key){
    const vals=state.values[key]; return vals.map(r=>r.map(M.parseNumber));
  }
  function setMatrix(key,m){
    state.values[key]=m.map(r=>r.slice()); state.dims[key]=[m.length,m[0].length];
    const c=key==='A'?'#sizeA':key==='B'?'#sizeB':key==='Det'?'#sizeDet':'#sizeRank';
    createSizeControls(c,key); renderEditor(key);
  }

  function matrixHTML(m){
    if(!M.isMatrix(m)) return `<span class="result-scalar">${escapeHtml(M.fmt(m))}</span>`;
    const cells=m.flat().map(v=>`<span>${escapeHtml(M.fmt(v))}</span>`).join('');
    return `<div class="render-matrix" style="--cols:${m[0].length}">${cells}</div>`;
  }
  function stringMatrixHTML(m){
    const cells=m.flat().map(v=>`<span>${escapeHtml(String(v))}</span>`).join('');
    return `<div class="render-matrix" style="--cols:${m[0].length}">${cells}</div>`;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function showError(id,e){const el=$(id);el.textContent=e.message||String(e);el.classList.remove('hidden')}
  function clearError(id){$(id).classList.add('hidden')}

  createSizeControls('#sizeA','A'); createSizeControls('#sizeB','B'); createSizeControls('#sizeDet','Det'); createSizeControls('#sizeRank','Rank');
  renderEditor('A');renderEditor('B');renderEditor('Det');renderEditor('Rank');renderX();

  $$('.chip[data-expr]').forEach(b=>b.addEventListener('click',()=>$('#expressionInput').value=b.dataset.expr));
  $('#solveExpression').addEventListener('click',solveExpression);
  function solveExpression(){
    clearError('#expressionError');
    try{
      const A=getNumeric('A'),B=getNumeric('B');
      const expr=$('#expressionInput').value;
      const r=M.parseMatrixExpression(expr,{A,B});
      let steps=r.steps.map((s,i)=>`<div class="step"><div class="step-title">${i+1}. ${escapeHtml(s.title)}</div><div class="step-detail">${escapeHtml(s.detail||'')}</div>${s.details?.length?`<ul>${s.details.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:''}<div class="top-gap-small">${M.isMatrix(s.result)?matrixHTML(s.result):''}</div></div>`).join('');
      $('#expressionOutput').innerHTML=`<div class="result-card"><div class="result-label">Результат ${escapeHtml(expr)}</div><div class="result-main top-gap-small">${matrixHTML(r.value)}</div>${steps?`<div class="steps"><h3>Ход решения</h3>${steps}</div>`:''}</div>`;
      $('#expressionOutput').classList.remove('hidden');
      window.__lastExpressionResult=r.value;
    }catch(e){showError('#expressionError',e);$('#expressionOutput').classList.add('hidden')}
  }

  $('#solveDet').addEventListener('click',()=>{
    clearError('#detError');
    try{
      const a=getNumeric('Det'); const r=M.determinantSteps(a);
      $('#detOutput').innerHTML=`<div class="result-card"><div class="result-label">Определитель</div><div class="result-scalar">${escapeHtml(M.fmt(r.value))}</div><div class="formula-box top-gap-small">${escapeHtml(r.formula)}</div><div class="steps">${r.steps.map((s,i)=>`<div class="step"><b>${i+1}.</b> ${escapeHtml(s)}</div>`).join('')}${r.echelon?`<div class="step"><div class="step-title">Треугольный вид</div>${matrixHTML(r.echelon)}</div>`:''}</div></div>`;
      $('#detOutput').classList.remove('hidden');window.__lastDetResult=r.value;
    }catch(e){showError('#detError',e);$('#detOutput').classList.add('hidden')}
  });

  $('#loadTeacherEquation').addEventListener('click',loadTeacherEquation); $('#teacherEqButton').addEventListener('click',()=>{go('det');loadTeacherEquation()});
  $('#loadTeacherIneq').addEventListener('click',loadTeacherIneq); $('#teacherIneqButton').addEventListener('click',()=>{go('det');loadTeacherIneq()});
  function loadTeacherEquation(){state.values.X=[['1','3','x'],['4','5','-1'],['2','-1','5']];$('#relationSelect').value='=';renderX()}
  function loadTeacherIneq(){state.values.X=[['2','x+2','-1'],['1','1','-2'],['5','-3','x']];$('#relationSelect').value='>';renderX()}
  $('#solveVariableDet').addEventListener('click',()=>{
    clearError('#varDetError');
    try{
      const p=M.determinantPoly(state.values.X); const relation=$('#relationSelect').value; const sol=M.signIntervals(p,relation);
      const pText=M.polyToString(p);
      const factorHint=(p.length===3 && relation==='>' && M.approxEqual(p[2],-1) && M.approxEqual(p[1],-10) && M.approxEqual(p[0],-24))?' = −(x+4)(x+6)':'';
      let explanation='';
      if(relation==='=') explanation='Приравниваем получившийся многочлен к нулю.';
      else explanation='Находим нули многочлена и определяем знак на промежутках между ними.';
      $('#varDetOutput').innerHTML=`<div class="result-card top-gap-small"><div class="result-label">det(A)</div><div class="formula-box">${escapeHtml(pText+factorHint)} ${escapeHtml(relation)} 0</div><div class="step top-gap-small">${escapeHtml(explanation)}</div><div class="result-main top-gap-small"><b>Ответ:</b> <span class="result-scalar">${escapeHtml(sol.text)}</span></div></div>`;
      $('#varDetOutput').classList.remove('hidden');window.__lastVariableResult=sol.text;
    }catch(e){showError('#varDetError',e);$('#varDetOutput').classList.add('hidden')}
  });

  $('#teacherDet1Button')?.addEventListener('click',()=>{go('det');setMatrix('Det',[[3,-2,1],[-2,1,3],[2,0,-2]])});
  $('#teacherDet2Button')?.addEventListener('click',()=>{go('det');setMatrix('Det',[[1,2,0],[0,1,3],[5,0,-1]])});
  $('#loadTeacherRank').addEventListener('click',loadTeacherRank); $('#teacherRankButton').addEventListener('click',()=>{go('rank');loadTeacherRank()});
  function loadTeacherRank(){setMatrix('Rank',[[-1,2,-3],[5,6,-2],[4,-3,1]])}
  $('#solveRank').addEventListener('click',()=>{
    clearError('#rankError');
    try{
      const a=getNumeric('Rank'),r=M.rankWithSteps(a);
      const shown=r.steps.slice(0,14);
      $('#rankOutput').innerHTML=`<div class="result-card"><div class="result-main"><div><div class="result-label">Ранг</div><div class="result-scalar">${r.rank}</div></div><div><div class="result-label">Итоговый приведённый вид</div>${matrixHTML(r.rref)}</div></div><div class="rank-steps top-gap">${shown.map((s,i)=>`<div class="rank-step"><b>${i+1}. ${escapeHtml(s.text)}</b>${matrixHTML(s.matrix)}</div>`).join('')}${r.steps.length>shown.length?`<div class="muted">Промежуточных операций ещё ${r.steps.length-shown.length}; итоговая матрица показана выше.</div>`:''}</div></div>`;
      $('#rankOutput').classList.remove('hidden');window.__lastRankResult=r.rank;
    }catch(e){showError('#rankError',e);$('#rankOutput').classList.add('hidden')}
  });

  function preset(name){
    if(name==='expr1'||name==='identity'){
      setMatrix('A',[[2,3],[-1,4]]);setMatrix('B',[[3,-5],[2,-1]]);go('calc');
      if(name==='expr1'){$('#expressionInput').value='2A-3B+AB';solveExpression()}
      else{
        try{
          const A=getNumeric('A'),B=getNumeric('B');const l=M.parseMatrixExpression('A^2-B^2',{A,B}).value,r=M.parseMatrixExpression('(A-B)*(A+B)',{A,B}).value;const equal=M.approxEqual(l,r);
          $('#expressionOutput').innerHTML=`<div class="result-card"><h3>Левая часть A²−B²</h3>${matrixHTML(l)}<h3 class="top-gap-small">Правая часть (A−B)(A+B)</h3>${matrixHTML(r)}<div class="message ${equal?'success':'error'}">${equal?'На этих матрицах части совпали.':'Не совпадают. Причина: (A−B)(A+B)=A²+AB−BA−B², а AB≠BA.'}</div></div>`;$('#expressionOutput').classList.remove('hidden');
        }catch(e){showError('#expressionError',e)}
      }
    }
    if(name==='dims'){
      setMatrix('A',[[2,-1,4,-3],[-2,3,0,1],[4,-2,5,-1]]);setMatrix('B',[[10,5],[3,2],[-1,-3],[4,1]]);go('calc');$('#expressionInput').value='A*B';solveExpression();
    }
    if(name==='poly'){
      setMatrix('A',[[3,-1],[-2,2]]);setMatrix('B',[[0,0],[0,0]]);go('calc');$('#expressionInput').value='A^2+2A-4I';solveExpression();
    }
  }
  $$('.teacher-load').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.preset)));

  function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
  function randomMatrix(r,c,min=-4,max=5){return Array.from({length:r},()=>Array.from({length:c},()=>randInt(min,max)))}
  function makePractice(){
    const type=$('#practiceType').value; let p={type};
    if(type==='add'){p.A=randomMatrix(2,2);p.B=randomMatrix(2,2);p.answer=M.add(p.A,p.B);p.title='Найдите A+B';p.hint='Складывай элементы на одинаковых местах: cᵢⱼ=aᵢⱼ+bᵢⱼ.'}
    if(type==='mul'){p.A=randomMatrix(2,2,-3,4);p.B=randomMatrix(2,2,-3,4);p.answer=M.multiply(p.A,p.B);p.title='Найдите AB';p.hint='Каждый элемент результата – строка A × столбец B. Начни с c₁₁=a₁₁b₁₁+a₁₂b₂₁.'}
    if(type==='det2'){p.A=randomMatrix(2,2,-6,7);p.answer=M.determinant(p.A);p.title='Найдите det(A)';p.hint='Для 2×2: ad−bc.'}
    if(type==='det3'){p.A=randomMatrix(3,3,-3,4);p.answer=M.determinant(p.A);p.title='Найдите det(A)';p.hint='Для 3×3 используй Саррюса: три произведения со знаком + и три со знаком −.'}
    if(type==='rank'){p.A=randomMatrix(3,3,-4,5);p.answer=M.rank(p.A);p.title='Найдите rank(A)';p.hint='Приводи строки методом Гаусса. Ранг равен числу ведущих элементов.'}
    state.practice=p;renderPractice();
  }
  function renderPractice(){
    const p=state.practice;if(!p)return;
    let mats=`<div class="practice-matrices"><div><b>A</b><br>${matrixHTML(p.A)}</div>`;
    if(p.B)mats+=`<div><b>B</b><br>${matrixHTML(p.B)}</div>`;mats+='</div>';
    $('#practiceProblem').innerHTML=`<h2>${escapeHtml(p.title)}</h2>${mats}`;
    $('#practiceAnswer').innerHTML='';
    if(M.isMatrix(p.answer)){
      const box=document.createElement('div');box.className='answer-matrix';box.style.gridTemplateColumns=`repeat(${p.answer[0].length},64px)`;
      p.user=Array.from({length:p.answer.length},()=>Array(p.answer[0].length).fill(''));
      for(let i=0;i<p.answer.length;i++)for(let j=0;j<p.answer[0].length;j++){const inp=document.createElement('input');inp.setAttribute('aria-label',`Ответ строка ${i+1} столбец ${j+1}`);inp.addEventListener('input',()=>p.user[i][j]=inp.value);box.append(inp)}
      $('#practiceAnswer').append(box);
    }else{
      p.user='';const inp=document.createElement('input');inp.className='answer-scalar';inp.placeholder='Ваш ответ';inp.addEventListener('input',()=>p.user=inp.value);$('#practiceAnswer').append(inp);
    }
    $('#practiceFeedback').classList.add('hidden');$('#practiceHint').classList.add('hidden');$('#practiceSolution').classList.add('hidden');
  }
  $('#newPractice').addEventListener('click',makePractice);$('#practiceType').addEventListener('change',makePractice);
  $('#checkPractice').addEventListener('click',()=>{
    const p=state.practice;if(!p)return;let user,correct=false;
    try{user=M.isMatrix(p.answer)?p.user.map(r=>r.map(M.parseNumber)):M.parseNumber(p.user);correct=M.approxEqual(user,p.answer)}catch{}
    const f=$('#practiceFeedback');f.className=`message ${correct?'success':'error'}`;f.textContent=correct?'Верно.':'Пока не совпадает. Проверь вычисления или открой подсказку.';f.classList.remove('hidden');
    if(correct){state.solvedCount++;storage.set('matrixSolvedCount',state.solvedCount);updateScore()}
  });
  $('#showPracticeHint').addEventListener('click',()=>{const p=state.practice;if(!p)return;$('#practiceHint').textContent=p.hint;$('#practiceHint').classList.remove('hidden')});
  $('#showPracticeSolution').addEventListener('click',()=>{
    const p=state.practice;if(!p)return;let html='';
    if(p.type==='det2'||p.type==='det3'){const r=M.determinantSteps(p.A);html=`<div class="result-card top-gap-small"><b>Решение:</b><div class="formula-box top-gap-small">${escapeHtml(r.formula)}</div>${r.steps.map(s=>`<div class="step">${escapeHtml(s)}</div>`).join('')}<div class="result-main top-gap-small"><b>Ответ:</b>${matrixHTML(r.value)}</div></div>`}
    else if(p.type==='rank'){const r=M.rankWithSteps(p.A);html=`<div class="result-card top-gap-small"><b>После преобразований:</b>${matrixHTML(r.rref)}<div class="result-main top-gap-small">rank(A) = <b>${r.rank}</b></div></div>`}
    else {html=`<div class="result-card top-gap-small"><b>Ответ:</b><div class="top-gap-small">${matrixHTML(p.answer)}</div></div>`}
    $('#practiceSolution').innerHTML=html;$('#practiceSolution').classList.remove('hidden');
  });
  function updateScore(){$('#practiceScore').textContent=`${state.solvedCount} решено`} updateScore();makePractice();

  $('#startCustomPractice').addEventListener('click',()=>{
    const expr=$('#customPracticeExpr').value;const area=$('#customPracticeArea');
    try{
      const A=getNumeric('A'),B=getNumeric('B'),answer=M.parseMatrixExpression(expr,{A,B}).value;
      if(!M.isMatrix(answer))throw new Error('Для этого режима ожидается матричный ответ.');
      const cp={expr,answer,user:Array.from({length:answer.length},()=>Array(answer[0].length).fill(''))};state.customPractice=cp;
      area.innerHTML=`<div class="hint">Решите <b>${escapeHtml(expr)}</b>. Ответ сайта скрыт до проверки.</div>`;
      const box=document.createElement('div');box.className='answer-matrix';box.style.gridTemplateColumns=`repeat(${answer[0].length},64px)`;
      for(let i=0;i<answer.length;i++)for(let j=0;j<answer[0].length;j++){const inp=document.createElement('input');inp.addEventListener('input',()=>cp.user[i][j]=inp.value);box.append(inp)}
      const btn=document.createElement('button');btn.className='primary top-gap-small';btn.textContent='Проверить мой ответ';btn.addEventListener('click',()=>{
        let ok=false;try{ok=M.approxEqual(cp.user.map(r=>r.map(M.parseNumber)),cp.answer)}catch{}
        let msg=area.querySelector('.custom-msg');if(!msg){msg=document.createElement('div');msg.className='message custom-msg';area.append(msg)}msg.className=`message custom-msg ${ok?'success':'error'}`;msg.innerHTML=ok?'Верно.':`Не совпадает. <button type="button" class="ghost reveal-custom">Показать правильный ответ</button>`;
        msg.querySelector('.reveal-custom')?.addEventListener('click',()=>{msg.innerHTML=`Правильный ответ:<div class="top-gap-small">${matrixHTML(cp.answer)}</div>`})
      });
      area.append(box,btn);area.classList.remove('hidden');
    }catch(e){area.innerHTML=`<div class="message error">${escapeHtml(e.message)}</div>`;area.classList.remove('hidden')}
  });

  window.__appReady = true;
})();