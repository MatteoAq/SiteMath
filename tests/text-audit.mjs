// Full editorial inventory of the actual UI text for 20 variants × 6 tasks.
// Read the generated strings from the same page runtime as the user, not only
// static source literals, so variable names, notation and step order are real.
import fs from 'node:fs';
import {JSDOM, VirtualConsole} from 'jsdom';

const html=fs.readFileSync('index.html','utf8')
  .replace(/<script[^>]*src="\.\/variants\.js"[^>]*><\/script>/,'')
  .replace(/<script[^>]*src="\.\/multi\.js"[^>]*><\/script>/,'');
const vc=new VirtualConsole();
const errors=[];
vc.on('jsdomError',error=>errors.push(String(error)));
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/',virtualConsole:vc});
const w=dom.window,d=w.document;
Object.defineProperty(w.SVGElement.prototype,'getTotalLength',{value(){return 100;}});
w.Element.prototype.animate=function(){return {onfinish:null,cancel(){},finish(){}}};
w.eval(fs.readFileSync('variants.js','utf8'));
w.eval(fs.readFileSync('multi.js','utf8'));
const $=id=>d.getElementById(id);
const snapshot=[],issues=[];
for(let vi=1;vi<=20;vi++){
  const variant=String(vi).padStart(2,'0');
  $('variantSelect').value=variant;
  $('variantSelect').dispatchEvent(new w.Event('change'));
  const tasks=[];
  for(let task=1;task<=6;task++){
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new w.Event('change'));
    $('firstBtn').click();
    const total=Number($('stepTotal').textContent);
    if(!(total>0&&total<100))throw Error('Invalid step count: '+variant+'/'+task+' '+total);
    const stages=[];
    for(let step=0;step<total;step++){
      const entry={
        number:step+1,
        title:$('stepTitle').textContent.trim(),
        action:$('stepAction').textContent.trim(),
        why:$('stepWhy').textContent.trim(),
        check:$('stepCheck').textContent.trim(),
        measure:[...$('stepMeasure').querySelectorAll('li')].map(x=>x.textContent.trim())
      };
      stages.push(entry);
      if(task===1&&/^Дострой профильную проекцию/u.test(entry.title)&&
         !/от вертикальной оси профильного вида через O/u.test(entry.check))
        issues.push({variant,task,step:step+1,type:'profile-zero-axis-reference-ambiguous',
          title:entry.title,check:entry.check});
      if(task===6&&/^Выбери вспомогательную плоскость /u.test(entry.title)&&
         !/^Вспомогательная (?:горизонтальная|фронтальная) плоскость /u.test(entry.why))
        issues.push({variant,task,step:step+1,type:'wrong-auxiliary-plane-declension',
          title:entry.title,why:entry.why});
      if(task===1&&/^Дострой профильную проекцию/u.test(entry.title)&&
         (!/вертикал/u.test(entry.action)||!/горизонтал/u.test(entry.action)))
        issues.push({variant,task,step:step+1,type:'profile-construction-not-reproducible',
          title:entry.title,action:entry.action});
      if(task===6&&/^На [αβ][₁₂] получи /u.test(entry.title)){
        const m=entry.measure||[];
        if(m.length<2 || m.slice(0,2).some(eq=>!entry.check.includes(eq)) ||
           /соответствующих исходных линиях/u.test(entry.check))
          issues.push({variant,task,step:step+1,type:'section-point-check-not-specific',
            title:entry.title,measure:m,check:entry.check});
      }
      if(task===6&&/^Выбери T₁ на /u.test(entry.title)){
        const s6=w.SITEMATH_SCHEMES[variant].task6;
        const p=[s6.planeA,s6.planeB].find(def=>def?.type==='line_point');
        const baseLine=p?.lineName||Object.keys(p?.lines||{})[0];
        if(!p||!baseLine||!entry.action.includes('примерно посередине')||
           !entry.check.includes('T₁ лежит на '+baseLine+'₁')||
           !entry.check.includes('половине горизонтального расстояния')||
           /ещё не построены/u.test(entry.check))
          issues.push({variant,task,step:step+1,type:'line-point-free-point-check-not-geometric',
            title:entry.title,action:entry.action,check:entry.check});
      }
      if(task===6&&step===0){
        const s6=w.SITEMATH_SCHEMES[variant].task6;
        if(s6.planeA?.type==='intersecting_lines'&&s6.planeB?.type==='line_point'){
          const lines=Object.keys(s6.planeA.lines||{});
          const h=s6.planeB.lineName||Object.keys(s6.planeB.lines||{})[0];
          const point=s6.planeB.pointName||Object.keys(s6.planeB.points||{})[0];
          const required=[
            lines[0]+'₁ и '+lines[1]+'₁',lines[0]+'₂ и '+lines[1]+'₂',
            h+'₁/'+h+'₂',point+'₁/'+point+'₂','вертикальной линии связи'
          ];
          if(required.some(x=>!entry.check.includes(x)))
            issues.push({variant,task,step:1,type:'line-point-source-plane-check-vague',
              required,check:entry.check});
        }
      }
      if(task===6&&step===0){
        const s6=w.SITEMATH_SCHEMES[variant].task6;
        if(s6.planeA?.type==='intersecting_lines'&&s6.planeB?.type==='horizontal_projecting'){
          const lines=Object.keys(s6.planeA.lines||{});
          const label=s6.pointLabel||'K';
          const required=[
            lines[0]+'₁ ∩ '+lines[1]+'₁',lines[0]+'₂ ∩ '+lines[1]+'₂',
            'общей вертикальной линии связи',s6.planeB.name||'Θ',
            'горизонтально-проецирующая','на П₁','на П₂',
            'Проекции '+label+'₁ и '+label+'₂'
          ];
          if(required.some(token=>!entry.check.includes(token)) ||
             /Сверь обозначения обеих исходных плоскостей/u.test(entry.check))
            issues.push({variant,task,step:1,type:'horizontal-projecting-source-check-vague',
              required,check:entry.check});
        }
      }
      if(task===6&&step===0){
        const s6=w.SITEMATH_SCHEMES[variant].task6;
        if(s6.planeA?.type==='frontal_projecting'&&s6.planeB?.type==='ABC'){
          const names=Object.keys(s6.planeB.points||{});
          const symbol=s6.planeA.name||'Σ';
          const label=s6.pointLabel||'K';
          const required=[
            'фронтально-проецирующая','на П₂','на П₁',
            symbol+'₂','отдельной исходной линии',
            ...names.map(name=>name+'₁/'+name+'₂'),
            label+'₁ и '+label+'₂','общей вертикальной линии связи'
          ];
          if(names.length!==3 || required.some(token=>!entry.check.includes(token)))
            issues.push({variant,task,step:1,type:'frontal-projecting-abc-source-check-vague',
              required,check:entry.check});
        }
      }
      if(task===6&&step===0){
        const s6=w.SITEMATH_SCHEMES[variant].task6;
        if(s6.planeA?.type==='parallel_lines'&&s6.planeB?.type==='parallel_lines'){
          const [a,b]=Object.keys(s6.planeA.lines||{});
          const [c,d]=Object.keys(s6.planeB.lines||{});
          const label=s6.pointLabel||'K';
          const required=[a+'₁ ∥ '+b+'₁',a+'₂ ∥ '+b+'₂',
            c+'₁ ∥ '+d+'₁',c+'₂ ∥ '+d+'₂',
            'две разные заданные прямые',label+'₁ и '+label+'₂','линией связи'];
          if(required.some(token=>!entry.check.includes(token))||
             !entry.action.includes('четыре заданные прямые')||
             !entry.why.includes('двумя пространственно параллельными прямыми'))
            issues.push({variant,task,step:1,type:'two-parallel-planes-source-check-vague',
              required,action:entry.action,why:entry.why,check:entry.check});
        }
      }
      if(task===6&&step===0){
        const s6=w.SITEMATH_SCHEMES[variant].task6;
        if(s6.planeA?.type==='parallel_lines'&&
           s6.planeB?.type==='intersecting_lines'&&!s6.adaptedSource){
          const [a,b]=Object.keys(s6.planeA.lines||{});
          const [c,d]=Object.keys(s6.planeB.lines||{});
          const label=s6.pointLabel||'K';
          const required=[a+'₁ ∥ '+b+'₁',a+'₂ ∥ '+b+'₂',
            c+'₁ и '+d+'₁',c+'₂ и '+d+'₂',
            'общей вертикальной линией связи',
            'проекции '+label+'₁ и '+label+'₂',
            'одной точке '+label];
          if(required.some(token=>!entry.check.includes(token)) ||
             /Сверь обозначения обеих исходных плоскостей/u.test(entry.check))
            issues.push({variant,task,step:1,type:'parallel-intersecting-source-check-vague',
              required,check:entry.check});
        }
      }
      if(task===6&&step===0){
        const s6=w.SITEMATH_SCHEMES[variant].task6;
        if(s6.planeA?.type==='intersecting_lines'&&s6.planeB?.type==='intersecting_lines'){
          const [a,b]=Object.keys(s6.planeA.lines||{});
          const [c,d]=Object.keys(s6.planeB.lines||{});
          const label=s6.pointLabel||'K';
          const required=[a+'₁ ∩ '+b+'₁',a+'₂ ∩ '+b+'₂',
            c+'₁ ∩ '+d+'₁',c+'₂ ∩ '+d+'₂',
            'У каждой плоскости пара проекций узла',
            'вертикальной линии связи',label+'₁ и '+label+'₂',
            'отдельным проектором'];
          if(required.some(x=>!entry.check.includes(x))||
             !entry.action.includes('Для каждого из двух узлов')||
             !entry.why.includes('Пересекающиеся пространственные прямые определяют плоскость'))
            issues.push({variant,task,step:1,type:'two-intersecting-planes-source-check-vague',
              required,action:entry.action,why:entry.why,check:entry.check});
        }
      }
      if(task===4&&step===0){
        const plane=w.SITEMATH_SCHEMES[variant].task4;
        const required=plane.planeType==='ABC'
          ?['A₁/A₂','B₁/B₂','C₁/C₂']
          :plane.planeType==='line_point'
            ?[plane.planePoint+'₁ и '+plane.planePoint+'₂',
              'не принадлежит прямой '+plane.planeLine,
              plane.planeLine+'₁',plane.planeLine+'₂']
            :plane.planeType==='parallel_lines'
              ?[plane.planeLines[0]+'₁ ∥ '+plane.planeLines[1]+'₁',
                 plane.planeLines[0]+'₂ ∥ '+plane.planeLines[1]+'₂']
              :[plane.planeLines[0]+'₁ ∩ '+plane.planeLines[1]+'₁',
                 plane.planeLines[0]+'₂ ∩ '+plane.planeLines[1]+'₂'];
        if(required.some(token=>!entry.check.includes(token)) ||
           /Все названные элементы есть на исходной схеме/u.test(entry.check))
          issues.push({variant,task,step:1,type:'generic-initial-plane-check',
            title:entry.title,check:entry.check,required});
      }
      if(task===4&&/^Выбери T₁ на фронтали f₁/u.test(entry.title)&&
         (!/T₁ лежит на f₁/u.test(entry.check) || /опорной линии/u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'frontale-point-check-not-specific',
          title:entry.title,check:entry.check});
      if(task===4&&/^Выбери T₁ на прямой /u.test(entry.title)){
        const source=entry.title.slice('Выбери T₁ на прямой '.length);
        if(!entry.check.includes('T₁ лежит на '+source))
          issues.push({variant,task,step:step+1,type:'named-line-point-check-not-specific',
            title:entry.title,check:entry.check});
      }
      if(task===4&&/^По линии связи получи N[₁₂]$/u.test(entry.title)){
        const subscript=entry.title.slice(-1);
        if(!entry.measure.some(m=>m.startsWith('N'+subscript+' ∈ ')) ||
           /парной проекции исходного объекта/u.test(entry.check))
          issues.push({variant,task,step:step+1,type:'supporting-N-line-not-specific',
            title:entry.title,check:entry.check,measure:entry.measure});
      }
      if(task===4&&/^Выбери (?:T[₁₂]|вспомогательную точку N[₁₂])/u.test(entry.title)&&
         !/середин/u.test(entry.action))
        issues.push({variant,task,step:step+1,type:'auxiliary-point-placement-not-described',
          title:entry.title,action:entry.action});
      if(task===6&&/^Выбери точку [TM]₁ на /u.test(entry.title) &&
         (!/лежит на /u.test(entry.check) || /не появляется до/u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'unhelpful-first-projection-check',
          title:entry.title,check:entry.check});
      if(task===6&&/^Построй сечение [αβ] с проецирующей плоскостью /u.test(entry.title)){
        const parts=entry.title.match(/^Построй сечение ([αβ]) с проецирующей плоскостью (\S+)/u);
        const aux=parts?.[1],name=parts?.[2];
        const scheme=w.SITEMATH_SCHEMES[variant].task6;
        const def=[scheme.planeA,scheme.planeB].find(p=>p.name===name);
        const pIndex=def?.type==='frontal_projecting'?'₂':'₁';
        const lIndex=def?.type==='frontal_projecting'?'₁':'₂';
        const sectionSymbol=(def?.type==='frontal_projecting'?'f':'h')+name;
        if(!def||!/(?:frontal|horizontal)_projecting/.test(def.type)||
           !entry.action.includes(sectionSymbol+pIndex+' совпадает с заданной '+name+pIndex)||
           !entry.action.includes(sectionSymbol+lIndex+' лежит на уровне '+aux+lIndex)||
           !entry.check.includes(sectionSymbol+pIndex+' совпадает с '+name+pIndex)||
           !entry.measure.includes(sectionSymbol+pIndex+' = '+name+pIndex)||
           !entry.measure.includes(sectionSymbol+lIndex+' = '+aux+lIndex))
          issues.push({variant,task,step:step+1,type:'projecting-section-projection-not-explained',
            title:entry.title,action:entry.action,check:entry.check});
      }
      if(task===6&&/^Выбери вспомогательную плоскость /u.test(entry.title)){
        const scheme=w.SITEMATH_SCHEMES[variant].task6;
        const hasProjecting=[scheme.planeA,scheme.planeB].some(p=>
          /(?:horizontal|frontal)_projecting$/.test(p?.type||''));
        const describesType=hasProjecting
          ?/проецирующей плоскости.*вырожденную проекцию/u.test(entry.action)
          :/пересекает опорные прямые/u.test(entry.action);
        if(!describesType || !/сечения обеих исходных плоскостей/u.test(entry.check))
          issues.push({variant,task,step:step+1,type:'unqualified-auxiliary-level',
            title:entry.title,action:entry.action,check:entry.check});
      }
      if(task===4&&/^Выбери вспомогательную точку N[₁₂]/u.test(entry.title) &&
         (!entry.measure.some(x=>/N[₁₂] ∈ /u.test(x)) ||
          /На опорной линии/u.test(entry.action)))
        issues.push({variant,task,step:step+1,type:'generic-n-point-instruction',
          title:entry.title,action:entry.action,measure:entry.measure});
      if(task===5&&/^По линии связи перенеси U₁ на /u.test(entry.title) &&
         (!/проекции одной пространственной точки U/u.test(entry.why) ||
          !/вертикальной линии связи из U₁/u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'paired-U-projections-misdescribed',
          title:entry.title,why:entry.why,check:entry.check});
      if(task===5&&/^Продли ℓ и раздели обе проекции точкой K/u.test(entry.title) &&
         (!/сравнением конкурирующих точек 3\/4 и 5\/6/u.test(entry.action) ||
          /видимость определим следующим шагом/u.test(entry.action)))
        issues.push({variant,task,step:step+1,type:'visibility-instruction-procedural-instead-of-geometric',
          title:entry.title,action:entry.action});
      if(task===5&&/^Перенеси 1[₁₂] и 2[₁₂] на /u.test(entry.title) &&
         (!/Точки 1 и 2 переносят по отдельности/u.test(entry.why) ||
          !/проекторе из 1/u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'paired-transfers-confused',
          title:entry.title,why:entry.why,check:entry.check});
      if(task===4&&/^Выбери точку 3₁ на уже построенной h₁/u.test(entry.title)&&
         (!/около 58% отрезка/u.test(entry.check) ||
          /точки 2₁ на этом шаге ещё нет/u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'non-geometric-point-3-check',
          title:entry.title,check:entry.check});
      if(task===4&&/^Через 3₁ проведи f₁ ∥ x₁₂ и получи 2₁$/u.test(entry.title)&&
         (!/f₁ проходит через 3₁ параллельно x₁₂/u.test(entry.check) ||
          !/точно на пересечении f₁ с /u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'non-geometric-point-2-check',
          title:entry.title,check:entry.check});
      if(task===4&&/^Выбери точку (?:1₂|3₁) на /u.test(entry.title)&&
         /^На исходной /u.test(entry.action)&&
         (!/(?:\d+% длины|на продолжении штриха|положени[еи] в схеме)/u.test(entry.check)||
          /Следующая точка будет определяться|Фронтальная проекция через выбранную точку/u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'first-point-location-not-checkable',
          title:entry.title,action:entry.action,check:entry.check});
      if(task===4&&/^Выбери точку (?:1₂|3₁) на /.test(entry.title)&&
         !/(?:\d+% длины|продолжении штриха|положение в схеме)/.test(entry.action))
        issues.push({variant,task,step:step+1,type:'free-point-placement-not-reproducible',
          title:entry.title,action:entry.action});
      for(const phrase of [entry.title,entry.action,entry.why,entry.check,...entry.measure]){
        for(const match of phrase.matchAll(/(\d+(?:[.,]\d+)?)\s+клеток\b/g)){
          const count=Number(match[1].replace(',','.'));
          const tail=count%10,hundred=count%100;
          if(Number.isInteger(count)&&!(hundred>=11&&hundred<=14)&&tail>=1&&tail<=4)
            issues.push({variant,task,step:step+1,type:'wrong-cell-declension',text:match[0]});
        }
      }
      for(const value of [entry.title,entry.action,entry.why,entry.check]){
        if(/за (?:левого|правого|верхнего|нижнего) концом/u.test(value))
          issues.push({variant,task,step:step+1,type:'wrong-extended-end-declension',
            text:value});
      }
      for(const field of ['title','action','why','check']){
        if(!entry[field])issues.push({variant,task,step:step+1,field,type:'empty'});
        if(/\b(?:проекция|линия|плоскость)\s+(?:этого|данного|полученного)\s+объекта\b/i.test(entry[field]))
          issues.push({variant,task,step:step+1,field,type:'ambiguous-reference',text:entry[field]});
        if(/на следующем шаге|проверь,? параллельны ли|проверь совпадающую координату|сайт показывает|пока показана только/i.test(entry[field]))
          issues.push({variant,task,step:step+1,field,type:'procedural-filler',text:entry[field]});
      }
      if(step<total-1)$('nextBtn').click();
    }
    tasks.push({task,stepCount:total,stages});
  }
  snapshot.push({variant,tasks});
}
// The two user-approved reconstructed drawings are not metric copies of
// the originals. Their first visible instructions must name and test the
// actual projected relationships, not send the student back to raw pixels.
for(const [variant,task,required] of [
  ['12',6,['a₁ ∥ b₁','a₂ ∥ b₂','h₂ ∥ x₁₂','f₁ ∥ x₁₂']],
  ['13',5,['a₁','b₁','a₂','b₂','ℓ₁','ℓ₂']]
]){
  const initial=snapshot.find(v=>v.variant===variant).tasks
    .find(t=>t.task===task).stages[0];
  for(const token of required)
    if(!(initial.action+' '+initial.check).includes(token))
      issues.push({variant,task,step:1,type:'adapted-source-relationship-missing',token});
  if(!/реконструкц/u.test(initial.action) ||
     /по исходному листу проверь/iu.test(initial.check))
    issues.push({variant,task,step:1,type:'adapted-source-misleading-original-reference'});
}
if(errors.length)issues.push({type:'browser-errors',errors});
const totalSteps=snapshot.reduce((a,v)=>a+v.tasks.reduce((b,t)=>b+t.stepCount,0),0);
fs.writeFileSync('text-audit.json',JSON.stringify({variants:20,tasks:120,totalSteps,snapshot,issues},null,2));
console.log('Captured actual UI guidance for 20 variants, 120 tasks, '+totalSteps+' steps. Issues: '+issues.length);
if(issues.length) {
  console.error('Text-audit errors: '+JSON.stringify(issues.slice(0,20)));
  process.exit(1);
}
