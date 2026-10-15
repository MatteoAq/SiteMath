// Paper-to-code verification of TASK 4 only, ordered as requested:
// 12/4 first, then task 4 for the 19 other university sheets.
// Independent statement transcription; other exercises are intentionally excluded.
// Successful checks do NOT certify the five other tasks of a variant.
import fs from 'node:fs';

const expect=(ok,message)=>{if(!ok)throw new Error('Task4 paper audit: '+message)};
const W={};
new Function('window',fs.readFileSync('variants.js','utf8'))(W);
let src=fs.readFileSync('multi.js','utf8');
const cutoff=src.indexOf("  $('variantSelect').addEventListener");
expect(cutoff>0,'browser initialization boundary has moved');
src=src.slice(0,cutoff)+'window.__paper4={solveTask4Scheme};})();';
new Function('window','document',src)(W,{getElementById(){return {value:'45'}}});

// Manually checked against all 20 original University sheets in
// source-photos/scans/variant-XX.jpg, assignment number 4.
// [planeType,planeSymbol,operation,through,target,answer,relation,stages].
const paper={
  '01':['intersecting_lines','Σ','line_parallel_plane','B','','A','behind_line',16],
  '02':['ABC','Σ','line_intersects_named','D','BC','E','below_line',18],
  '03':['parallel_lines','Σ','line_intersects_named','A','a','B','below_plane',18],
  '04':['ABC','Σ','line_intersects_horizontal','D','','E','above_line',18],
  '05':['parallel_lines','Σ','line_intersects_named','A','a','B','below_plane',18],
  '06':['parallel_lines','Δ','line_parallel_plane','D','','A','front_of_line',16],
  '07':['parallel_lines','Σ','line_parallel_plane','D','a','A','above_named',16],
  '08':['line_point','Σ','line_parallel_plane','B','','C','above_line',14],
  '09':['line_point','Δ','line_parallel_horizontal','B','','E','below_line',14],
  '10':['ABC','Σ','line_intersects_frontale','D','','E','below_line',18],
  '11':['ABC','Σ','line_parallel_plane','D','','E','above_line',16],
  '12':['intersecting_lines','Σ','line_intersects_named','D','a','A','behind_line',18],
  '13':['parallel_lines','Σ','line_parallel_horizontal','D','','A','above_plane',16],
  '14':['line_point','Σ','line_intersects_named','D','a','B','below_plane',16],
  '15':['line_point','Σ','line_parallel_plane','B','','C','above_line',14],
  '16':['ABC','Δ','line_intersects_horizontal','D','','E','behind_line',18],
  '17':['parallel_lines','Σ','line_intersects_frontale','A','','B','above_line',18],
  '18':['parallel_lines','Σ','line_intersects_frontale','B','','A','behind_line',18],
  '19':['intersecting_lines','Σ','line_parallel_plane','B','','A','front_of_plane',16],
  '20':['ABC','Σ','line_parallel_plane','D','','E','below_line',18]
};
const ids=['12',...Object.keys(paper).sort().filter(id=>id!=='12')];
expect(ids.length===20&&Object.keys(W.SITEMATH_SCHEMES).length===20,
  'twenty source sheets must be present');
const close=(a,b,tolerance=1e-6)=>Math.abs(a-b)<tolerance;
const item=(geometry,label,type)=>geometry.steps.flatMap(st=>st.entities||[])
  .find(e=>e.type===type&&e.label===label);
const pointAt=(g,label)=>g.steps.findIndex(st=>
  (st.entities||[]).some(e=>e.type==='point'&&e.label===label));
const lineAt=(g,label)=>g.steps.find(st=>
  (st.entities||[]).some(e=>e.type==='text'&&e.label===label))
  ?.entities.find(e=>e.type==='line'&&e.cls==='answer-line');
const checkProjections=(g,a,b,description)=>{
  expect(a&&b&&close(a.x,b.x),description+': projections have different x');
};
let stages=0,crossings=0,parallels=0;
for(const id of ids){
  const [ptype,name,type,through,target,answer,relation,num]=paper[id];
  const data=W.SITEMATH_DATA.variants[id].task4;
  const scheme=W.SITEMATH_SCHEMES[id].task4, op=scheme.operation;
  const actual=[scheme.planeType,scheme.name||'Σ',op.type,op.through,
    op.target||'',op.resultPoint,op.relation];
  const desired=[ptype,name,type,through,target,answer,relation];
  expect(JSON.stringify(actual)===JSON.stringify(desired),
    id+'/4 original assignment role mismatch: '+JSON.stringify(actual));
  expect(data.statement&&data.statement.includes(through)&&
    data.statement.includes(answer),
    id+'/4 missing printed through/result point in UI');
  expect(scheme.sourceGeometry,
    id+'/4 source photo trace not stored separately from working geometry');
  const g=W.__paper4.solveTask4Scheme(scheme,{});
  expect(g&&!g.error&&g.steps.length===num,
    id+'/4 missing or unexpected construction stages');
  stages+=num;
  expect(g.steps[0].sourceEntities?.length>0,
    id+'/4 first screen must preserve original traced marks');
  expect(g.steps[0].sourceEntities.every(e=>e.cls!=='answer-line'),
    id+'/4 original screen must contain no solved answer strokes');
  const h1=lineAt(g,'h₁'),h2=lineAt(g,'h₂');
  const f1=lineAt(g,'f₁'),f2=lineAt(g,'f₂');
  const ls1=lineAt(g,'ЛС₁'),ls2=lineAt(g,'ЛС₂');
  expect([h1,h2,f1,f2,ls1,ls2].every(Boolean),
    id+'/4 one of h/f/LS projections missing from drawn steps');
  expect(close(h2.a.y,h2.b.y)&&close(f1.a.y,f1.b.y),
    id+'/4 h₂ or f₁ not parallel to x₁₂');
  const hd={x:h1.b.x-h1.a.x,y:h1.b.y-h1.a.y};
  const sd={x:ls1.b.x-ls1.a.x,y:ls1.b.y-ls1.a.y};
  const cosine=Math.abs(hd.x*sd.x+hd.y*sd.y)/
    (Math.hypot(hd.x,hd.y)*Math.hypot(sd.x,sd.y));
  expect(cosine<1e-6,id+'/4 actual ЛС₁ not perpendicular to drawn h₁');
  checkProjections(g,ls1.a,ls2.a,id+'/4 LS beginning');
  checkProjections(g,ls1.b,ls2.b,id+'/4 LS end');
  const n1=pointAt(g,'N₁'),n2=pointAt(g,'N₂');
  const p1=pointAt(g,answer+'₁'),p2=pointAt(g,answer+'₂');
  expect(n1>=0&&n2>=0&&p1>Math.max(n1,n2)&&p2===p1,
    id+'/4 answer must follow both projections of the reference N');
  const actual1=item(g,answer+'₁','point');
  const actual2=item(g,answer+'₂','point');
  checkProjections(g,actual1.p,actual2.p,id+'/4 output point');
  if(type.startsWith('line_intersects_')){
    crossings++;
    const t1=pointAt(g,'T₁'),t2=pointAt(g,'T₂');
    const last=Math.max(t1,t2);
    const join=g.steps.findIndex(st=>
      (st.title.startsWith('Соедини ')&&st.title.includes(' с T'))||
      (st.title.startsWith('Проведи ℓ через ')&&st.title.endsWith(' и T')));
    expect(t1>=0&&t2>=0&&Math.abs(t1-t2)===1&&join===last+1,
      id+'/4 T₁, T₂ must precede drawing both ℓ projections');
    const tStep=g.steps[join];
    expect(tStep.entities.filter(e=>e.type==='line'&&e.cls==='answer-line').length===2,
      id+'/4 ℓ must actually be drawn twice, not only described');
  }else{
    parallels++;
    expect(g.steps.some(st=>st.title.includes('ℓ ∥')),
      id+'/4 parallel ℓ absent from written construction');
  }
  if(ptype==='line_point'){
    expect(g.steps.some(st=>st.title.startsWith('Горизонталь h: проведи h₂ через ')),
      id+'/4 point+line case must use given point before h');
  }
  if(id==='12'){
    expect(scheme.planeLines.join(',')==='a,b'&&
      scheme.operation.target==='a',
      '12/4 source must be intersecting a/b and target given a');
    for(const [a,b] of [['1₂','2₂'],['3₁','4₁'],['S₁','5₁'],
       ['T₁','T₂'],['N₂','N₁'],['N₁','A₁']])
      expect(pointAt(g,a)<pointAt(g,b),
        '12/4 source-dependent construction order '+a+' -> '+b);
    const N1=item(g,'N₁','point'),N2=item(g,'N₂','point');
    expect(close(N1.p.x,actual1.p.x)&&close(N2.p.x,actual2.p.x)&&
      close(N2.p.y,actual2.p.y)&&actual1.p.y<N1.p.y,
      '12/4 final A must be truly BEHIND ℓ on Π₁, with unchanged Π₂');
  }
}
expect(stages>300&&crossings===10&&parallels===10,
  'unexpected count of task4 operations');
console.log('TASK4 PAPER-FIRST AUDIT: 12/4 + 19 others; '+
  ids.length+' authentic conditions, '+stages+
  ' construction stages, '+crossings+' intersections, '+
  parallels+' parallel operations checked. No certification of other tasks.');
