import fs from 'node:fs';
import {JSDOM, VirtualConsole} from 'jsdom';

const html = fs.readFileSync('index.html','utf8')
  .replace(/<script[^>]*src="\.\/variants\.js"[^>]*><\/script>/,'')
  .replace(/<script[^>]*src="\.\/multi\.js"[^>]*><\/script>/,'');
const vc = new VirtualConsole();
vc.on('jsdomError', e => { throw e; });
const dom = new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const {window} = dom;

Object.defineProperty(window.SVGElement.prototype,'getTotalLength',{value(){ return 100; }});
const fakeAnimate = function(){ return {onfinish:null,cancel(){},finish(){}}; };
window.Element.prototype.animate = fakeAnimate;
window.print = () => {};

window.eval(fs.readFileSync('variants.js','utf8'));
window.eval(fs.readFileSync('multi.js','utf8'));

const $ = id => window.document.getElementById(id);
const variants = [...$('variantSelect').options].map(o=>o.value).filter(v=>v!=='custom');
const failures = [];

for (const variant of variants) {
  $('variantSelect').value = variant;
  $('variantSelect').dispatchEvent(new window.Event('change'));
  for (let task=1; task<=6; task++) {
    try {
      $('taskSelect').value = String(task);
      $('taskSelect').dispatchEvent(new window.Event('change'));
      const total = Number($('stepTotal').textContent);
      const title = $('stepTitle').textContent.trim();
      if (!Number.isFinite(total) || total < 1 || !title) {
        failures.push(variant+'/'+task+': empty solver state');
      }
      if (!$('validation').hidden) {
        failures.push(variant+'/'+task+': '+$('validation').textContent);
      }
      console.log('OK', variant, task, 'steps='+total, title);
    } catch (e) {
      failures.push(variant+'/'+task+': '+e.stack);
    }
  }
}


// Custom-data UI smoke test, including the profile-line special case in task 3.
try {
  $('variantSelect').value = 'custom';
  $('variantSelect').dispatchEvent(new window.Event('change'));

  for (let task=1; task<=6; task++) {
    $('taskSelect').value = String(task);
    $('taskSelect').dispatchEvent(new window.Event('change'));
    if (task <= 3) {
      const inputs = [...window.document.querySelectorAll('.coord-input')];
      if (!inputs.length) failures.push('custom/'+task+': coordinate editor missing');
    } else {
      if (!$('schemeImage') || !$('startMarking') || !$('calibrationCanvas')) {
        failures.push('custom/'+task+': photo calibration editor missing');
      }
    }
  }

  $('taskSelect').value = '3';
  $('taskSelect').dispatchEvent(new window.Event('change'));
  const setCoord = (point,axis,value) => {
    const el = window.document.querySelector('.coord-input[data-point="'+point+'"][data-axis="'+axis+'"]');
    el.value = String(value);
  };
  setCoord('A','x',20); setCoord('A','y',10); setCoord('A','z',0);
  setCoord('B','x',20); setCoord('B','y',50); setCoord('B','z',60);
  setCoord('C','x',55); setCoord('C','y',20); setCoord('C','z',30);
  $('buildBtn').click();
  if (!$('validation').hidden) failures.push('custom/3 profile case: '+$('validation').textContent);
  if (!$('stepTitle').textContent.includes('Проведи') && Number($('stepTotal').textContent) < 8) {
    failures.push('custom/3 profile case: solver did not build expected steps');
  }
  console.log('OK custom editors and task 3 profile-line case');
} catch (e) {
  failures.push('custom smoke: '+e.stack);
}

if (failures.length) {
  console.error('\nFAILURES\n'+failures.join('\n'));
  process.exit(1);
}
console.log('\nAll photographed variant/task combinations rendered without runtime exceptions.');
