// Two explicit opt-in reconstructions must not alter university source schemes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const html=fs.readFileSync('index.html','utf8')
 .replace(/<script[^>]*src="\.\/variants\.js"[^>]*><\/script>/,'')
 .replace(/<script[^>]*src="\.\/multi\.js"[^>]*><\/script>/,'');
const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const {window}=dom;
Object.defineProperty(window.SVGElement.prototype,'getTotalLength',{value(){return 100;}});
window.Element.prototype.animate=function(){return {onfinish:null,cancel(){},finish(){}};};
window.eval(fs.readFileSync('variants.js','utf8'));
window.eval(fs.readFileSync('multi.js','utf8'));
const $=id=>window.document.getElementById(id);
const change=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new window.Event('change'));};
const special=[
 {variant:'12',task:6,steps:24},
 {variant:'13',task:5,steps:13}
];
for(const t of special){
 change('variantSelect',t.variant);
 change('taskSelect',t.task);
 const base=window.SITEMATH_SCHEMES[t.variant]['task'+t.task];
 assert(base.sourceGeometry,'original screenshot tracing missing for '+t.variant+'/'+t.task);
 assert(base.teachingScheme,'separate teaching geometry missing for '+t.variant+'/'+t.task);
 assert(!base.teachingScheme.sourceGeometry,'redrawn first stage must not show photographic geometry');
 const original=JSON.stringify(base.sourceGeometry);
 const panel=$('practiceGeometryControl'),btn=$('practiceGeometryToggle');
 assert.equal(panel.hidden,false,'practice control invisible '+t.variant+'/'+t.task);
 assert.equal(btn.getAttribute('aria-pressed'),'false');
 assert.equal($('validation').hidden,true,'original solver error '+t.variant+'/'+t.task);
 const originalSize=$('sheetSize').textContent;
 btn.click();
 assert.equal(btn.getAttribute('aria-pressed'),'true');
 assert.equal($('validation').hidden,true,'teaching solver error '+t.variant+'/'+t.task);
 assert.equal(Number($('stepTotal').textContent),t.steps);
 assert.match($('stepTitle').textContent,/учебную схему/);
 assert.match($('stepAction').textContent,/не исходный лист/);
 assert.match($('practiceGeometryMessage').textContent,/Не сдавай/);
 const teachingSize=$('sheetSize').textContent;
 assert.notEqual(teachingSize,originalSize,'redrawn drawing remains as large as remote original');
 assert.equal(JSON.stringify(base.sourceGeometry),original,'switch mutated source raster trace');
 assert.equal($('practiceGeometryOriginal').getAttribute('href'),'source-photos/scans/variant-'+t.variant+'.jpg');
 btn.click();
 assert.equal(btn.getAttribute('aria-pressed'),'false');
 assert.equal($('validation').hidden,true);
 assert.equal($('sheetSize').textContent,originalSize,'return to original did not restore drawing');
 assert.equal(JSON.stringify(base.sourceGeometry),original,'return mutated original trace');
 change('taskSelect',t.task===5?6:5);
 assert.equal(panel.hidden,true,'toggle visible for unrelated task');
 change('taskSelect',t.task);
 assert.equal(btn.getAttribute('aria-pressed'),'false','practice mode leaked to next task');
 console.log('Teaching reconstruction '+t.variant+'/'+t.task+': mode switch, original preservation, dimensions and source link OK');
}
dom.window.close();
