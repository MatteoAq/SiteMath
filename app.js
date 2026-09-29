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

  const notesEl=$('#studyNotes');
  if(notesEl){
    notesEl.value=storage.get('matrixStudyNotes')||'';
    let notesTimer=null;
    notesEl.addEventListener('input',()=>{
      clearTimeout(notesTimer);
      const status=$('#notesStatus');
      if(status)status.textContent='Сохраняю…';
      notesTimer=setTimeout(()=>{
        storage.set('matrixStudyNotes',notesEl.value);
        if(status)status.textContent='Сохранено';
      },250);
    });
  }
  $('#toggleStudyNotes')?.addEventListener('click',()=>{
    const card=$('#studyNotesCard');
    card?.classList.toggle('notes-collapsed');
    const collapsed=card?.classList.contains('notes-collapsed');
    $('#toggleStudyNotes').textContent=collapsed?'Развернуть':'Свернуть';
    storage.set('matrixNotesCollapsed',collapsed?'1':'0');
  });
  if(storage.get('matrixNotesCollapsed')==='1'){
    $('#studyNotesCard')?.classList.add('notes-collapsed');
    if($('#toggleStudyNotes'))$('#toggleStudyNotes').textContent='Развернуть';
  }

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
    return `<div class="matrix-scroll"><div class="render-matrix" style="--cols:${m[0].length}">${cells}</div></div>`;
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

  // Главная учебная задача с листа: пользователь решает сам по шагам.
  const teacherTask = {
    A:[[2,3],[-1,4]],
    B:[[3,-5],[2,-1]],
    answers:{
      '2A':[[4,6],[-2,8]],
      '3B':[[9,-15],[6,-3]],
      'AB':[[12,-13],[5,1]],
      'D':[[-5,21],[-8,11]],
      'C':[[7,8],[-3,12]],
      'A2':[[1,18],[-6,13]],
      'B2':[[-1,-10],[4,-9]],
      'K':[[0,8],[-2,4]],
      'T3AB':[[1,-7],[-7,-3],[25,0]],
      'FA2':[[11,-5],[-10,6]],
      'F2A':[[6,-2],[-4,4]],
      'F4I':[[4,0],[0,4]],
      'F':[[13,-7],[-14,6]]
    },
    user:{}
  };

  function renderStaticMatrices(){
    $$('.matrix-static').forEach(el=>{
      const raw=(el.dataset.matrix||'').split(';').map(r=>r.split(',').map(Number));
      el.innerHTML=matrixHTML(raw);
    });
  }

  function createWorkAnswer(containerId,key){
    const answer=teacherTask.answers[key];
    const box=$(containerId); if(!box)return;
    box.innerHTML='';
    const grid=document.createElement('div');
    grid.className='answer-matrix work-grid';
    grid.style.gridTemplateColumns=`repeat(${answer[0].length},minmax(54px,64px))`;
    teacherTask.user[key]=Array.from({length:answer.length},()=>Array(answer[0].length).fill(''));
    for(let i=0;i<answer.length;i++)for(let j=0;j<answer[0].length;j++){
      const inp=document.createElement('input');
      inp.inputMode='decimal';
      inp.placeholder='?';
      inp.setAttribute('aria-label',`${key}: строка ${i+1}, столбец ${j+1}`);
      inp.addEventListener('input',()=>{
        teacherTask.user[key][i][j]=inp.value;
        inp.classList.remove('cell-ok','cell-bad');
        const feedback=$(`#feedback${key}`);
        feedback?.classList.add('hidden');
      });
      grid.append(inp);
    }
    box.append(grid);
  }

  function initTeacherWorkspace(){
    renderStaticMatrices();
    createWorkAnswer('#work2A','2A');
    createWorkAnswer('#work3B','3B');
    createWorkAnswer('#workAB','AB');
    createWorkAnswer('#workD','D');
    createWorkAnswer('#workC','C');
    createWorkAnswer('#workA2','A2');
    createWorkAnswer('#workB2','B2');
    createWorkAnswer('#workK','K');
    createWorkAnswer('#workT3AB','T3AB');
    createWorkAnswer('#workFA2','FA2');
    createWorkAnswer('#workF2A','F2A');
    createWorkAnswer('#workF4I','F4I');
    createWorkAnswer('#workF','F');
  }

  function checkTeacherStep(key){
    const card=$(`[data-work-step="${key}"]`);
    const inputs=card?Array.from(card.querySelectorAll('.work-grid input')):[];
    const target=teacherTask.answers[key];
    let allFilled=true, allCorrect=true, pos=0;
    for(let i=0;i<target.length;i++)for(let j=0;j<target[0].length;j++){
      const inp=inputs[pos++]; const raw=teacherTask.user[key][i][j];
      let ok=false;
      if(String(raw).trim()===''){allFilled=false;}
      else { try{ ok=M.approxEqual(M.parseNumber(raw),target[i][j]); }catch{} }
      inp?.classList.toggle('cell-ok',ok);
      inp?.classList.toggle('cell-bad',String(raw).trim()!==''&&!ok);
      if(!ok)allCorrect=false;
    }
    const feedback=$(`#feedback${key}`);
    feedback.className=`message ${allCorrect?'success':'error'}`;
    feedback.textContent=allCorrect
      ? (key==='C'?'Верно. Первое задание готово – ниже уже есть задание 2.'
        :key==='K'?'Верно. Задание 2 готово. Дальше можно идти к другим примерам с листа.'
        :'Верно. Этот шаг готов.')
      : (!allFilled?'Заполни все клетки, затем проверь ещё раз.':'Есть ошибка. Красным отмечены клетки, которые нужно пересчитать.');
    feedback.classList.remove('hidden');
    card?.classList.toggle('step-complete',allCorrect);
    if(key==='C' && allCorrect){
      $('#teacherTask2')?.classList.remove('hidden');
      if($('#toggleTask2'))$('#toggleTask2').textContent='Скрыть задание 2';
    }
    return allCorrect;
  }

  $$('.check-work').forEach(btn=>btn.addEventListener('click',()=>checkTeacherStep(btn.dataset.step)));
  $$('.hint-work').forEach(btn=>btn.addEventListener('click',()=>{
    const h=$(`#hint${btn.dataset.step}`); h?.classList.toggle('hidden');
  }));
  $('#resetTeacherTask')?.addEventListener('click',()=>{
    initTeacherWorkspace();
    $$('.work-step').forEach(c=>c.classList.remove('step-complete'));
    ['2A','3B','AB','D','C','A2','B2','K'].forEach(k=>{const f=$(`#feedback${k}`);f?.classList.add('hidden')});
  });
  $('#toggleTask2')?.addEventListener('click',()=>{
    const area=$('#teacherTask2'); if(!area)return;
    area.classList.toggle('hidden');
    $('#toggleTask2').textContent=area.classList.contains('hidden')?'Открыть задание 2':'Скрыть задание 2';
  });

  $('#toggleTeacherAB')?.addEventListener('click',()=>{
    const area=$('#teacherABWorkspace'); if(!area)return;
    area.classList.toggle('hidden');
    $('#toggleTeacherAB').textContent=area.classList.contains('hidden')?'Решать самому':'Скрыть рабочее поле';
  });
  $('#checkBAExists')?.addEventListener('click',()=>{
    const v=$('#baExistsGuess')?.value;
    const f=$('#baExistsFeedback'); if(!f)return;
    const ok=v==='no';
    f.className=`message ${ok?'success':'error'}`;
    f.textContent=ok?'Верно. BA не существует: B имеет 2 столбца, а A имеет 3 строки – внутренние размеры 2 и 3 не совпадают.':(v?'Нет. Сначала сравни столбцы B и строки A.':'Сначала выбери ответ.');
    f.classList.remove('hidden');
  });
  $('#toggleFunctionTask')?.addEventListener('click',()=>{
    const area=$('#functionTaskWorkspace'); if(!area)return;
    area.classList.toggle('hidden');
    $('#toggleFunctionTask').textContent=area.classList.contains('hidden')?'Решать пошагово':'Скрыть рабочее поле';
  });
  $('#showTeacherTaskSolution')?.addEventListener('click',()=>{
    const out=$('#teacherTaskSolution');
    out.innerHTML=`<div class="solution-steps">
      <div><b>1. 2A</b>${matrixHTML(teacherTask.answers['2A'])}</div>
      <div><b>2. 3B</b>${matrixHTML(teacherTask.answers['3B'])}</div>
      <div><b>3. AB</b>${matrixHTML(teacherTask.answers['AB'])}<p class="muted">Например: c₁₁ = 2·3 + 3·2 = 12; c₁₂ = 2·(−5) + 3·(−1) = −13.</p></div>
      <div><b>4. D = 2A − 3B</b>${matrixHTML(teacherTask.answers['D'])}</div>
      <div><b>5. C = D + AB</b>${matrixHTML(teacherTask.answers['C'])}</div>
    </div>`;
    out.classList.toggle('hidden');
    $('#showTeacherTaskSolution').textContent=out.classList.contains('hidden')?'Показать полное решение':'Скрыть полное решение';
  });

  function loadTeacherSheet(){
    const img=$('#teacherSheetImage');
    const loading=$('#sheetLoading');
    if(!img)return;
    img.src='teacher-sheet-hq.jpg?v=20260929f';
    img.addEventListener('load',()=>{loading?.classList.add('hidden');img.classList.remove('hidden')},{once:true});
    img.addEventListener('error',()=>{if(loading){loading.textContent='Не удалось загрузить фото листа. Обнови страницу.';loading.classList.remove('hidden');loading.classList.add('error')}},{once:true});
  }
  loadTeacherSheet();

  let sheetScale=1;
  function applySheetScale(){
    const img=$('#teacherSheetImage'); if(!img)return;
    img.style.width=`${Math.round(sheetScale*100)}%`;
    $('#sheetZoomReset').textContent=`${Math.round(sheetScale*100)}%`;
  }
  $('#sheetZoomIn')?.addEventListener('click',()=>{sheetScale=Math.min(3,sheetScale+.25);applySheetScale()});
  $('#sheetZoomOut')?.addEventListener('click',()=>{sheetScale=Math.max(.5,sheetScale-.25);applySheetScale()});
  $('#sheetZoomReset')?.addEventListener('click',()=>{sheetScale=1;applySheetScale()});

  initTeacherWorkspace();

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

  $('#checkDetGuess')?.addEventListener('click',()=>{
    clearError('#detError');
    const feedback=$('#detGuessFeedback');
    try{
      const actual=M.determinant(getNumeric('Det'));
      const guess=M.parseNumber($('#detGuess').value);
      const ok=M.approxEqual(guess,actual);
      feedback.className=`message ${ok?'success':'error'}`;
      feedback.textContent=ok?'Верно. Определитель найден правильно.':'Не совпадает. Проверь правило и арифметику – готовое решение пока не раскрывается.';
      feedback.classList.remove('hidden');
    }catch(e){showError('#detError',e)}
  });
  $('#showDetHint')?.addEventListener('click',()=>$('#detManualHint')?.classList.toggle('hidden'));

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
  function clearVariablePractice(){if($('#varPolyGuess'))$('#varPolyGuess').value='';if($('#varAnswerGuess'))$('#varAnswerGuess').value='';$('#varPolyFeedback')?.classList.add('hidden');$('#varAnswerFeedback')?.classList.add('hidden');$('#varDetOutput')?.classList.add('hidden')}
  function loadTeacherEquation(){state.values.X=[['1','3','x'],['4','5','-1'],['2','-1','5']];$('#relationSelect').value='=';renderX();clearVariablePractice()}
  function loadTeacherIneq(){state.values.X=[['2','x+2','-1'],['1','1','-2'],['5','-3','x']];$('#relationSelect').value='>';renderX();clearVariablePractice()}
  function normalizeMathText(v){
    return String(v??'').toLowerCase().replace(/[−–—]/g,'-').replace(/\s+/g,'').replace(/\*/g,'').replace(/,/g,'.');
  }
  function normalizePolyGuess(v){
    return normalizeMathText(v).replace(/x²/g,'x^2');
  }
  $('#showVarDetHint')?.addEventListener('click',()=>$('#varManualHint')?.classList.toggle('hidden'));
  $('#checkVarPolyGuess')?.addEventListener('click',()=>{
    const f=$('#varPolyFeedback');
    try{
      const p=M.determinantPoly(state.values.X);
      const expected=normalizePolyGuess(M.polyToString(p));
      const guess=normalizePolyGuess($('#varPolyGuess').value);
      const ok=guess===expected || guess===`(${expected})`;
      f.className=`message ${ok?'success':'error'}`;
      f.textContent=ok?'Верно. det(A) получен правильно.':'Пока не совпадает. Проверь раскрытие определителя; конечный ответ сайт не показывает.';
      f.classList.remove('hidden');
    }catch(e){showError('#varDetError',e)}
  });
  $('#checkVarAnswerGuess')?.addEventListener('click',()=>{
    const f=$('#varAnswerFeedback');
    try{
      const p=M.determinantPoly(state.values.X), relation=$('#relationSelect').value, sol=M.signIntervals(p,relation);
      const raw=$('#varAnswerGuess').value;
      let ok=false;
      if(relation==='=' && sol.roots?.length===1){
        const cleaned=normalizeMathText(raw).replace(/^x=/,'');
        try{ok=M.approxEqual(M.parseNumber(cleaned),sol.roots[0])}catch{}
      }else{
        const expected=normalizeMathText(sol.text).replace(/^x∈/,'');
        const cleaned=normalizeMathText(raw).replace(/^x∈/,'');
        ok=cleaned===expected;
        if(!ok && sol.roots?.length===2 && !expected.includes('∪')){
          const m=cleaned.match(/^(-?\d+(?:\.\d+)?)<x<(-?\d+(?:\.\d+)?)$/);
          if(m){
            const a=Number(m[1]),b=Number(m[2]);
            ok=M.approxEqual(a,sol.roots[0])&&M.approxEqual(b,sol.roots[1])&&relation==='>';
          }
        }
      }
      f.className=`message ${ok?'success':'error'}`;
      f.textContent=ok?'Верно. Конечный ответ правильный.':'Не совпадает. Проверь корни, знаки и выбранные промежутки.';
      f.classList.remove('hidden');
    }catch(e){showError('#varDetError',e)}
  });

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
  // Ранг через ступенчатый вид – в той же логике, что обычно записывают в тетради.
  const rankStairState={
    matrix:null,pivotRow:0,pivotCol:0,rank:0,targetRow:null,swapRow:null,
    mode:null,k:null,expectedRow:null,complete:false,stepNo:1
  };

  function ordinalRow(n){return `${n+1}-я строка`}
  function isIntegerLike(x){return Math.abs(x-Math.round(x))<1e-9}

  function rankMatrixHTML(m,pivotRow=-1,pivotCol=-1,targetRow=-1){
    const cells=[];
    for(let i=0;i<m.length;i++)for(let j=0;j<m[0].length;j++){
      let cls='';
      if(i===pivotRow&&j===pivotCol)cls='pivot-cell';
      else if(i===targetRow&&j===pivotCol)cls='target-cell';
      else if(j===pivotCol&&i>pivotRow)cls='pivot-column-cell';
      cells.push(`<span class="${cls}">${escapeHtml(M.fmt(m[i][j]))}</span>`);
    }
    return `<div class="matrix-scroll"><div class="render-matrix rank-render-matrix" style="--cols:${m[0].length}">${cells.join('')}</div></div>`;
  }

  function chooseConvenientPivot(matrix,startRow,col){
    const candidates=[];
    for(let r=startRow;r<matrix.length;r++)if(Math.abs(matrix[r][col])>M.EPS)candidates.push(r);
    if(!candidates.length)return -1;
    if(Math.abs(matrix[startRow][col])>M.EPS)return startRow;
    const unit=candidates.find(r=>Math.abs(Math.abs(matrix[r][col])-1)<M.EPS);
    return unit??candidates[0];
  }

  function findNextRankSituation(){
    const st=rankStairState,m=st.matrix;
    const rows=m.length,cols=m[0].length;
    st.targetRow=null;st.swapRow=null;st.mode=null;st.k=null;st.expectedRow=null;

    while(st.pivotRow<rows&&st.pivotCol<cols){
      const pivotCandidate=chooseConvenientPivot(m,st.pivotRow,st.pivotCol);
      if(pivotCandidate<0){st.pivotCol++;continue}
      if(pivotCandidate!==st.pivotRow){
        st.swapRow=pivotCandidate;
        renderRankSituation();
        return;
      }

      const target=[];
      for(let r=st.pivotRow+1;r<rows;r++)if(Math.abs(m[r][st.pivotCol])>M.EPS)target.push(r);
      if(target.length){
        st.targetRow=target[0];
        const p=m[st.pivotRow][st.pivotCol],t=m[st.targetRow][st.pivotCol];
        const k=-t/p;
        if(isIntegerLike(k)){
          st.mode='add';
          st.k=M.roundNumber(k);
          st.expectedRow=m[st.targetRow].map((v,j)=>M.roundNumber(v+st.k*m[st.pivotRow][j]));
        }else{
          // Без дробей: p·нижняя строка − t·опорная строка.
          st.mode='cross';
          st.expectedRow=m[st.targetRow].map((v,j)=>M.roundNumber(p*v-t*m[st.pivotRow][j]));
        }
        renderRankSituation();
        return;
      }

      // Под текущим опорным элементом всё уже занулено – ступень готова.
      st.rank++;
      st.pivotRow++;
      st.pivotCol++;
      st.stepNo++;
    }

    st.complete=true;
    renderRankSituation();
  }

  function createRankRowInputs(){
    const st=rankStairState,box=$('#rankRowAnswer');if(!box)return;
    box.innerHTML='';box.className='rank-arithmetic-lines';
    rankStairState.userRow=Array(st.matrix[0].length).fill('');
    const p=st.matrix[st.pivotRow][st.pivotCol];
    const t=st.matrix[st.targetRow][st.pivotCol];
    for(let j=0;j<st.matrix[0].length;j++){
      const row=document.createElement('div');row.className='notebook-line';
      const expr=document.createElement('div');expr.className='notebook-expression';
      const lower=st.matrix[st.targetRow][j],upper=st.matrix[st.pivotRow][j];
      if(st.mode==='add'){
        expr.textContent=`${M.fmt(lower)} + (${M.fmt(st.k)}) · ${M.fmt(upper)}`;
      }else{
        expr.textContent=`${M.fmt(p)} · ${M.fmt(lower)} − ${M.fmt(t)} · ${M.fmt(upper)}`;
      }
      const eq=document.createElement('span');eq.className='notebook-equals';eq.textContent='=';
      const inp=document.createElement('input');inp.className='notebook-input';
      inp.inputMode='decimal';inp.placeholder='?';
      inp.setAttribute('aria-label',`Новая ${ordinalRow(st.targetRow)}, элемент ${j+1}`);
      inp.addEventListener('input',()=>{rankStairState.userRow[j]=inp.value;inp.classList.remove('cell-ok','cell-bad')});
      row.append(expr,eq,inp);box.append(row);
    }
  }

  function renderRankSituation(){
    const st=rankStairState,m=st.matrix;if(!m)return;
    $('#rankStepBadge').textContent=String(Math.min(st.stepNo,Math.min(m.length,m[0].length)));
    $('#rankMultiplierFeedback')?.classList.add('hidden');
    $('#rankRowFeedback')?.classList.add('hidden');
    $('#rankStepHint')?.classList.add('hidden');
    $('#rankMultiplierArea')?.classList.add('hidden');
    $('#rankRowArea')?.classList.add('hidden');
    $('#rankSwapArea')?.classList.add('hidden');

    if(st.complete){
      $('#rankStageTitle').textContent='Лесенка готова';
      $('#rankPivotBadge').textContent='ступенчатый вид';
      $('#rankStairMatrix').innerHTML=rankMatrixHTML(m);
      $('#rankInstruction').innerHTML='<p><b>Готово.</b> Под каждым опорным элементом стоят нули. Теперь просто посчитай количество ненулевых строк.</p>';
      $('#rankConclusionPrompt').innerHTML='Матрица приведена к ступенчатому виду. <b>Посчитай ненулевые строки</b> и впиши rank(A).';
      return;
    }

    if(st.swapRow!==null){
      $('#rankStageTitle').textContent=`Ступень ${st.stepNo}: нужен ненулевой элемент`;
      $('#rankPivotBadge').textContent=`столбец ${st.pivotCol+1}`;
      $('#rankStairMatrix').innerHTML=rankMatrixHTML(m,-1,st.pivotCol,st.swapRow);
      $('#rankInstruction').innerHTML=`<p>На месте следующей ступени сейчас 0. Ниже в этом столбце есть ненулевое число, поэтому строки можно поменять местами.</p>`;
      const area=$('#rankSwapArea');
      area.innerHTML=`<button class="primary" id="applyRankSwap">Поменять местами ${ordinalRow(st.pivotRow)} и ${ordinalRow(st.swapRow)}</button>`;
      area.classList.remove('hidden');
      $('#applyRankSwap').addEventListener('click',()=>{
        [st.matrix[st.pivotRow],st.matrix[st.swapRow]]=[st.matrix[st.swapRow],st.matrix[st.pivotRow]];
        st.swapRow=null;findNextRankSituation();
      });
      return;
    }

    const p=m[st.pivotRow][st.pivotCol],t=m[st.targetRow][st.pivotCol];
    $('#rankStageTitle').textContent=`Ступень ${st.stepNo}: зануляем столбец ${st.pivotCol+1}`;
    $('#rankPivotBadge').textContent=`опорный: ${M.fmt(p)}`;
    $('#rankStairMatrix').innerHTML=rankMatrixHTML(m,st.pivotRow,st.pivotCol,st.targetRow);

    if(st.mode==='add'){
      $('#rankInstruction').innerHTML=`<p>Опорный элемент – <b>${M.fmt(p)}</b>. Сейчас под ним стоит <b>${M.fmt(t)}</b> в ${ordinalRow(st.targetRow)}.</p><p>Нужно сделать: <b>новая ${ordinalRow(st.targetRow)} = старая ${ordinalRow(st.targetRow)} + k · ${ordinalRow(st.pivotRow)}</b>, чтобы число ${M.fmt(t)} превратилось в 0.</p>`;
      $('#rankMultiplierLabel').innerHTML=`Какой множитель k нужен?<input id="rankMultiplierGuess" class="answer-scalar" inputmode="decimal" placeholder="?">`;
      $('#rankMultiplierArea').classList.remove('hidden');
      $('#checkRankMultiplier').onclick=()=>{
        const feedback=$('#rankMultiplierFeedback');
        try{
          const guess=M.parseNumber($('#rankMultiplierGuess').value);
          const ok=M.approxEqual(guess,st.k);
          feedback.className=`message ${ok?'success':'error'}`;
          feedback.textContent=ok
            ? `Верно: ${M.fmt(t)} + (${M.fmt(st.k)})·${M.fmt(p)} = 0. Теперь посчитай всю новую строку.`
            : 'Не подходит. Подставь k только в элемент этого столбца и добейся нуля.';
          feedback.classList.remove('hidden');
          if(ok){
            createRankRowInputs();
            $('#rankRowPrompt').textContent=`Посчитай каждый элемент новой ${ordinalRow(st.targetRow)}`;
            $('#rankRowArea').classList.remove('hidden');
            $('#rankStepHint').textContent=`Для каждого столбца: элемент новой строки = элемент старой ${ordinalRow(st.targetRow)} + (${M.fmt(st.k)}) · соответствующий элемент ${ordinalRow(st.pivotRow)}.`;
          }
        }catch(e){feedback.className='message error';feedback.textContent=e.message||String(e);feedback.classList.remove('hidden')}
      };
    }else{
      $('#rankInstruction').innerHTML=`<p>Опорный элемент – <b>${M.fmt(p)}</b>, а под ним стоит <b>${M.fmt(t)}</b>.</p><p>Если делать через обычный множитель, получится дробь. Чтобы считать как в тетради без дробей:</p><div class="formula-box">новая ${ordinalRow(st.targetRow)} = ${M.fmt(p)} · старая ${ordinalRow(st.targetRow)} − ${M.fmt(t)} · ${ordinalRow(st.pivotRow)}</div><p>В нужном столбце автоматически получится ${M.fmt(p)}·${M.fmt(t)} − ${M.fmt(t)}·${M.fmt(p)} = 0.</p>`;
      createRankRowInputs();
      $('#rankRowPrompt').textContent=`Посчитай каждый элемент новой ${ordinalRow(st.targetRow)}`;
      $('#rankRowArea').classList.remove('hidden');
      $('#rankStepHint').textContent=`Считай каждый столбец отдельно по той же формуле: ${M.fmt(p)} · (элемент нижней строки) − ${M.fmt(t)} · (элемент опорной строки).`;
    }
  }

  function checkRankRow(){
    const st=rankStairState,box=$('#rankRowAnswer');
    const inputs=Array.from(box.querySelectorAll('input'));
    let allFilled=true,allCorrect=true;
    for(let j=0;j<st.expectedRow.length;j++){
      let ok=false;const raw=st.userRow[j];
      if(String(raw).trim()==='')allFilled=false;
      else{try{ok=M.approxEqual(M.parseNumber(raw),st.expectedRow[j])}catch{}}
      inputs[j]?.classList.toggle('cell-ok',ok);
      inputs[j]?.classList.toggle('cell-bad',String(raw).trim()!==''&&!ok);
      if(!ok)allCorrect=false;
    }
    const feedback=$('#rankRowFeedback');
    feedback.className=`message ${allCorrect?'success':'error'}`;
    feedback.textContent=allCorrect
      ? 'Верно. Нужный элемент занулён, строка пересчитана правильно.'
      : (!allFilled?'Заполни всю новую строку.':'Есть ошибка в отмеченных элементах строки.');
    feedback.classList.remove('hidden');
    if(allCorrect){
      st.matrix[st.targetRow]=st.expectedRow.slice();
      setTimeout(findNextRankSituation,250);
    }
  }

  $('#checkRankRow')?.addEventListener('click',checkRankRow);
  $('#rankStepHintButton')?.addEventListener('click',()=>$('#rankStepHint')?.classList.toggle('hidden'));

  function resetRankStairTrainer(){
    clearError('#rankError');
    try{
      const m=getNumeric('Rank').map(r=>r.slice());
      Object.assign(rankStairState,{matrix:m,pivotRow:0,pivotCol:0,rank:0,targetRow:null,swapRow:null,mode:null,k:null,expectedRow:null,complete:false,stepNo:1});
      $('#rankGuess').value='';
      $('#rankGuessFeedback').classList.add('hidden');
      findNextRankSituation();
    }catch(e){showError('#rankError',e)}
  }

  function loadTeacherRank(){
    setMatrix('Rank',[[-1,2,-3],[5,6,-2],[4,-3,1]]);
    resetRankStairTrainer();
  }

  $('#loadTeacherRank').addEventListener('click',loadTeacherRank);
  $('#teacherRankButton').addEventListener('click',()=>{go('rank');loadTeacherRank()});
  $('#rankStartStairs')?.addEventListener('click',resetRankStairTrainer);

  $('#checkRankGuess')?.addEventListener('click',()=>{
    const feedback=$('#rankGuessFeedback');
    try{
      if(!rankStairState.complete){
        feedback.className='message error';
        feedback.textContent='Сначала дострой лесенку: под каждым опорным элементом должны быть нули.';
        feedback.classList.remove('hidden');return;
      }
      const guess=M.parseNumber($('#rankGuess').value);
      const ok=M.approxEqual(guess,rankStairState.rank);
      feedback.className=`message ${ok?'success':'error'}`;
      feedback.textContent=ok
        ? `Верно. В ступенчатой матрице ${rankStairState.rank} ненулевых строк, поэтому rank(A)=${rankStairState.rank}.`
        : 'Нет. Посчитай именно ненулевые строки готовой лесенки.';
      feedback.classList.remove('hidden');
    }catch(e){showError('#rankError',e)}
  });

  function humanEchelon(matrix){
    const m=matrix.map(r=>r.slice()),steps=[];
    let pr=0,rank=0;
    for(let pc=0;pc<m[0].length&&pr<m.length;pc++){
      let pivot=chooseConvenientPivot(m,pr,pc);
      if(pivot<0)continue;
      if(pivot!==pr){[m[pivot],m[pr]]=[m[pr],m[pivot]];steps.push(`Поменяли местами ${ordinalRow(pr)} и ${ordinalRow(pivot)}.`)}
      for(let tr=pr+1;tr<m.length;tr++){
        if(Math.abs(m[tr][pc])<M.EPS)continue;
        const p=m[pr][pc],t=m[tr][pc],k=-t/p;
        if(isIntegerLike(k)){
          m[tr]=m[tr].map((v,j)=>M.roundNumber(v+k*m[pr][j]));
          steps.push(`${ordinalRow(tr)} + (${M.fmt(k)})·${ordinalRow(pr)}.`);
        }else{
          m[tr]=m[tr].map((v,j)=>M.roundNumber(p*v-t*m[pr][j]));
          steps.push(`${M.fmt(p)}·${ordinalRow(tr)} − ${M.fmt(t)}·${ordinalRow(pr)}.`);
        }
      }
      rank++;pr++;
    }
    return {matrix:m,rank,steps};
  }

  resetRankStairTrainer();

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
      go('teacher');$('#functionTaskWorkspace')?.classList.remove('hidden');
      if($('#toggleFunctionTask'))$('#toggleFunctionTask').textContent='Скрыть рабочее поле';
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
    if(type==='rank'){p.A=randomMatrix(3,3,-4,5);p.answer=M.rank(p.A);p.title='Найдите rank(A)';p.hint='Строй лесенку: выбери опорный элемент, занули всё под ним, затем переходи ниже и правее. В конце посчитай ненулевые строки.'}
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
    else if(p.type==='rank'){
      const r=humanEchelon(p.A);
      html=`<div class="result-card top-gap-small"><b>Ступенчатый вид:</b>${matrixHTML(r.matrix)}<div class="steps">${r.steps.map((x,i)=>`<div class="step">${i+1}. ${escapeHtml(x)}</div>`).join('')}</div><div class="result-main top-gap-small">Ненулевых строк: <b>${r.rank}</b> → rank(A)=<b>${r.rank}</b></div></div>`;
    }
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