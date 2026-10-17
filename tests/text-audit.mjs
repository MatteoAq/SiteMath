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
      if(task===4&&/^Выбери (?:T[₁₂]|вспомогательную точку N[₁₂])/u.test(entry.title)&&
         !/середин/u.test(entry.action))
        issues.push({variant,task,step:step+1,type:'auxiliary-point-placement-not-described',
          title:entry.title,action:entry.action});
      if(task===6&&/^Выбери точку [TM]₁ на /u.test(entry.title) &&
         (!/лежит на /u.test(entry.check) || /не появляется до/u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'unhelpful-first-projection-check',
          title:entry.title,check:entry.check});
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
      if(task===5&&/^Перенеси 1[₁₂] и 2[₁₂] на /u.test(entry.title) &&
         (!/Точки 1 и 2 переносят по отдельности/u.test(entry.why) ||
          !/проекторе из 1/u.test(entry.check)))
        issues.push({variant,task,step:step+1,type:'paired-transfers-confused',
          title:entry.title,why:entry.why,check:entry.check});
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
