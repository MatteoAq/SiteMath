// Independent legibility audit; reports, rather than changes, arbitrary helper choices.
import fs from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';

const vc=new VirtualConsole();
vc.on('jsdomError',e=>{throw e;});
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{
  runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'
});
const {window}=dom;
window.Element.prototype.animate=function(){return {onfinish:null,cancel(){},finish(){}}};
window.SVGElement.prototype.getTotalLength=function(){return 100};
window.eval(fs.readFileSync('variants.js','utf8'));
window.eval(fs.readFileSync('multi.js','utf8'));
const $=id=>window.document.getElementById(id),svg=$('drawing');
const audit=[];
function positions(nodes){
  const out=[];
  for(const el of nodes){
    if(el.tagName.toLowerCase()==='line'){
      for(const [x,y] of [['x1','y1'],['x2','y2']]){
        const p={x:Number(el.getAttribute(x)),y:Number(el.getAttribute(y))};
        if(Number.isFinite(p.x)&&Number.isFinite(p.y))out.push(p);
      }
    } else if(el.tagName.toLowerCase()==='circle'){
      const p={x:Number(el.getAttribute('cx')),y:Number(el.getAttribute('cy'))};
      if(Number.isFinite(p.x)&&Number.isFinite(p.y))out.push(p);
    }
  }
  return out;
}
function box(points){
  if(!points.length)return null;
  const x=points.map(p=>p.x),y=points.map(p=>p.y);
  return {minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y),
    width:Math.max(...x)-Math.min(...x),height:Math.max(...y)-Math.min(...y)};
}
for(let variant=1;variant<=20;variant++){
  const id=String(variant).padStart(2,'0');
  $('variantSelect').value=id;
  $('variantSelect').dispatchEvent(new window.Event('change'));
  for(let task=1;task<=6;task++){
    $('taskSelect').value=String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    $('firstBtn').click();
    const source=box(positions(svg.querySelectorAll('line.object-line, line.source-guide-line, circle.point-dot')));
    const sourceCount=svg.querySelectorAll('line.object-line').length;
    $('lastBtn').click();
    const drawn=svg.querySelectorAll('line.draw-line:not(.axis)');
    const final=box(positions(drawn));
    const scale=Number(svg.getAttribute('data-layout-scale')||1);
    const lengths=[...drawn].filter(el=>el.classList.contains('answer-line')||el.classList.contains('aux-line')||el.classList.contains('construction-line'))
      .map(el=>({type:el.getAttribute('class'),len:Math.hypot(
        Number(el.getAttribute('x2'))-Number(el.getAttribute('x1')),
        Number(el.getAttribute('y2'))-Number(el.getAttribute('y1')))*scale,
        x1:Number(el.getAttribute('x1')),y1:Number(el.getAttribute('y1')),
        x2:Number(el.getAttribute('x2')),y2:Number(el.getAttribute('y2'))}))
      .filter(x=>x.len>0);
    const shortest=lengths.length?Math.min(...lengths.map(x=>x.len)):null;
    const marks=[...svg.querySelectorAll('line[data-right-angle-mark="1"]')]
      .map(el=>Math.hypot(
        Number(el.getAttribute('x2'))-Number(el.getAttribute('x1')),
        Number(el.getAttribute('y2'))-Number(el.getAttribute('y1')))*scale);
    if(marks.some(mm=>!Number.isFinite(mm)||mm<=0))
      throw new Error('Right-angle glyph collapsed: '+id+'/'+task);
    const markMin=marks.length?Math.min(...marks):null;
    const sourceShare=source&&final?Math.max(0,Math.min(1,
      Math.min(source.width/Math.max(final.width,1),source.height/Math.max(final.height,1)))):null;
    const shortLines=lengths.filter(x=>x.len<3).map(x=>({
      type:x.type,mm:+x.len.toFixed(2),
      start:[+x.x1.toFixed(2),+x.y1.toFixed(2)],
      end:[+x.x2.toFixed(2),+x.y2.toFixed(2)]
    }));
    const shortCount=shortLines.length;
    const status=task>=4 && (sourceShare!==null&&sourceShare<.14 || scale<.15 || shortCount>=4)?'review':'ok';
    audit.push({variant:id,task,status,scale:+scale.toFixed(4),
      sourceLines:sourceCount,sourceShare:sourceShare===null?null:+sourceShare.toFixed(3),
      shortest:shortest===null?null:+shortest.toFixed(2),shortCount,
      angleMarkMin:markMin===null?null:+markMin.toFixed(2),
      angleMarkCount:marks.length,
      shortLines:shortLines.slice(0,8),
      finalWidth:final?+((final.width)*scale).toFixed(1):null,
      finalHeight:final?+((final.height)*scale).toFixed(1):null});
  }
}
// The original task-3 A/B/C points are fixed; only the free K position
// may be optimized for visible CK on both Monge projections.
const recommended={};
for(const id of ['02','06','16','18','19']){
  $('variantSelect').value=id;
  $('variantSelect').dispatchEvent(new window.Event('change'));
  $('taskSelect').value='3';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  const percent=Number($('kSlider').value);
  if(percent===50||percent<20||percent>80)
    throw new Error('Task 3 free K is not optimized for informative projections in variant '+id+': '+percent);
  recommended[id]=percent;
}
$('variantSelect').value='12';
$('variantSelect').dispatchEvent(new window.Event('change'));
$('taskSelect').value='3';
$('taskSelect').dispatchEvent(new window.Event('change'));
if(Number($('kSlider').value)!==50)
  throw new Error('Priority variant 12 default free K changed without an improvement requirement');
console.log('TASK3_INFORMATIVE_K',JSON.stringify(recommended));
// Task 1 has a separate axonometric view. Most variants now fit at 1:1,
// while the unusually large pyramid of variant 18 still needs 1:2.
// Its onscreen instruction must convert coordinates to A4 cell distances.
$('variantSelect').value='18';
$('variantSelect').dispatchEvent(new window.Event('change'));
$('taskSelect').value='1';
$('taskSelect').dispatchEvent(new window.Event('change'));
$('nextBtn').click();
const note=$('stepInfoText').textContent;
const measures=$('stepInfoMeasure').textContent;
if(!note.includes('Масштаб A4 1:2')||!measures.includes('на A4'))
  throw new Error('Reduced coordinate instructions lack physical paper distances');
fs.writeFileSync('informativeness-report.json',JSON.stringify(audit,null,2));
const critical=audit.filter(x=>x.status==='review').sort((a,b)=>
  (a.sourceShare??1)-(b.sourceShare??1)||a.scale-b.scale);
if(audit.length!==120 || new Set(audit.map(x=>x.variant)).size!==20)
  throw new Error('Incomplete 20 × 6 all-variant informativity audit');
const graphical=audit.filter(x=>x.task>=4);
const compact=xs=>xs.map(x=>({variant:x.variant,task:x.task,
  sourceShare:x.sourceShare,scale:x.scale,shortest:x.shortest,
  shortCount:x.shortCount,angleMarkMin:x.angleMarkMin,
  final:[x.finalWidth,x.finalHeight]}));
const worstSource=graphical.filter(x=>x.sourceShare!==null)
  .sort((a,b)=>a.sourceShare-b.sourceShare).slice(0,12);
const worstShort=graphical.filter(x=>x.shortest!==null)
  .sort((a,b)=>a.shortest-b.shortest).slice(0,12);
const worstScale=graphical.slice().sort((a,b)=>a.scale-b.scale).slice(0,12);
const byTask=Object.fromEntries([1,2,3,4,5,6].map(task=>{
  const rows=audit.filter(x=>x.task===task);
  return [task,{count:rows.length,
    smallestScale:Math.min(...rows.map(x=>x.scale)),
    shortestLine:Math.min(...rows.map(x=>x.shortest??Infinity)),
    highestShortCount:Math.max(...rows.map(x=>x.shortCount)),
    minSourceShare:Math.min(...rows.map(x=>x.sourceShare??1))}];
}));
console.log('INFORMATIVENESS_AUDIT',JSON.stringify({
  tasks:audit.length,review:critical.length,
  reviewByTask:Object.fromEntries([1,2,3,4,5,6].map(t=>[t,critical.filter(x=>x.task===t).length])),
  byTask,worstSource:compact(worstSource),
  worstShort:compact(worstShort),worstScale:compact(worstScale),
  reviewCases:critical
}));
