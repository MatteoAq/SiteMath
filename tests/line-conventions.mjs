// Chromium audit of actual computed SVG line styles against the professor's
// "Тема 3 – Линии" (ГОСТ 2.303–68* as cited in that teaching document).
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const url=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try{
  await page.goto(url,{waitUntil:'networkidle'});
  const actual=await page.evaluate(()=>{
    const svg=document.querySelector('#drawing');
    if(!svg)throw Error('No drawing SVG');
    const NS='http://www.w3.org/2000/svg';
    const sample={};
    const names=['object-line','answer-line','hidden-line',
      'construction-line','source-guide-line','aux-line','dimension','axis'];
    for(const name of names){
      const line=document.createElementNS(NS,'line');
      line.setAttribute('class',name);
      line.setAttribute('x1','0');line.setAttribute('x2','25');
      svg.appendChild(line);
      const css=getComputedStyle(line);
      sample[name]={
        width:parseFloat(css.strokeWidth),
        dash:css.strokeDasharray,
        color:css.stroke
      };
      line.remove();
    }
    for(const name of ['hidden-line','construction-line','answer-line']){
      const line=document.createElementNS(NS,'line');
      line.setAttribute('class',name+' active-line');
      svg.appendChild(line);
      const css=getComputedStyle(line);
      sample[name+' active-line']={
        width:parseFloat(css.strokeWidth),
        dash:css.strokeDasharray,
        filter:css.filter
      };
      line.remove();
    }
    return {
      sample,
      legend:[...document.querySelectorAll('.legend span')].map(n=>n.textContent.trim()),
      auxiliaryBorder:getComputedStyle(document.querySelector('.swatch.auxiliary')).borderTopStyle,
      hiddenSample:getComputedStyle(document.querySelector('.swatch.hidden')).backgroundImage,
      note:document.querySelector('.legend-note')?.textContent||''
    };
  });
  const s=actual.sample,S=s['object-line'].width;
  assert(S>=.5&&S<=1.4,'Main solid line is outside the taught S range');
  assert(Math.abs(s['answer-line'].width-S)<.02,
    'Final visible segment must match main solid thickness');
  for(const cls of ['hidden-line','construction-line','source-guide-line','aux-line','dimension','axis']){
    const ratio=s[cls].width/S;
    assert(ratio>=1/3-1e-5&&ratio<=.5+1e-5,
      cls+' is not a thin line between S/3 and S/2: '+ratio);
  }
  const dashNums=s['hidden-line'].dash.match(/[0-9]+(?:\.[0-9]+)?/g)?.map(Number)||[];
  assert(dashNums.length>=2 && dashNums[0]>0 && dashNums[1]>0,
    'Hidden segments must be dashed');
  assert(dashNums[0]/s['hidden-line'].width>=8&&
    dashNums[0]/s['hidden-line'].width<=12,
    'Hidden dash length must be approximately ten stroke thicknesses');
  for(const cls of ['construction-line','source-guide-line','aux-line','dimension','axis','object-line','answer-line']){
    assert(['none',''].includes(s[cls].dash),
      cls+' unexpectedly uses dashed geometry');
  }
  for(const cls of ['hidden-line','construction-line','answer-line']){
    const state=s[cls+' active-line'];
    assert(Math.abs(state.width-s[cls].width)<.001,
      'Active-step highlighting altered drafting width for '+cls);
    assert(state.dash===s[cls].dash,
      'Active-step highlighting altered drafting pattern for '+cls);
  }
  assert(actual.legend.some(v=>v.includes('невидимое')&&v.includes('штриховая')),
    'The legend omits the drafting name of the hidden line');
  assert(actual.legend.some(v=>v.includes('линии связи')),
    'Projection-line terminology missing from legend');
  assert(actual.legend.some(v=>v.includes('вспомогательные линии')),
    'Auxiliary line terminology missing from legend');
  assert(!actual.legend.some(v=>v.includes('новые проекторы')),
    'Invented shorthand still visible in legend');
  assert(actual.auxiliaryBorder==='none',
    'Legend shows a dashed auxiliary line even though SVG line is solid');
  assert(actual.hiddenSample.includes('gradient'),
    'Legend does not display a dashed hidden-line sample');
  assert(actual.note.includes('ГОСТ') && actual.note.includes('Цвет'),
    'Educational stage-color distinction is not disclosed');
  console.log('Academic drafting line conventions and stage highlighting passed',JSON.stringify(actual.sample));
}finally{
  await page.close();await browser.close();
}
