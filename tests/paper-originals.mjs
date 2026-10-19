// Independently transcribed paper originals, rechecked against original DOCX 19 Oct 2026.
// Check 60 numeric assignments (199 spatial vertices/points), 60 graphical assignment
// definitions, and SHA-256 bytes of all 20 current album scans.
// CI success proves source data shape/recording, not the geometry of solved steps.
import fs from 'node:fs';
import crypto from 'node:crypto';
const originalCoordinates={
  "01": [
    "25,40,0;40,60,-20;20,-25,60;0,40,35;40,0,10",
    "60,-15,50;20,40,30",
    "70,50,0;40,60,-20;20,-25,60"
  ],
  "02": [
    "35,30,0;30,40,20;50,-30,-60;60,0,45;0,45,35",
    "20,-40,10;35,-30,40",
    "5,30,0;45,-30,40;25,20,15"
  ],
  "07": [
    "50,40,0;45,-20,-35;30,-50,20;70,-30,10;25,55,-45",
    "70,-30,10;25,50,45",
    "50,40,0;10,-20,-35;30,-50,20"
  ],
  "13": [
    "60,-50,-30;40,-10,50;30,50,40;40,-50,0;45,0,15",
    "0,50,40;40,10,50",
    "60,-50,30;40,-10,50;10,50,40"
  ],
  "16": [
    "10,20,-45;25,20,0;20,-25,-33;55,-30,30;25,20,10",
    "15,-40,-50;55,-30,30",
    "15,-40,-50;55,-30,30;20,-25,-35"
  ],
  "20": [
    "70,30,-45;35,-40,20;40,-20,-40;30,20,0;50,0,45",
    "80,30,50;20,-40,-10",
    "70,30,45;35,-40,20;0,-20,-40"
  ],
  "10": [
    "50,60,0;10,0,70;60,50,40;60,50,-20;50,-40,-30",
    "10,-10,30;60,-50,-50",
    "50,60,0;10,0,70;60,50,40"
  ],
  "11": [
    "30,60,30;40,50,0;20,0,-60;45,-30,-20;30,50,-15",
    "15,45,20;70,-50,50",
    "30,60,30;0,50,0;40,-60,0"
  ],
  "12": [
    "25,-10,40;30,50,25;40,30,-60;50,0,50;60,20,15",
    "50,-15,50;20,20,30",
    "0,10,50;30,25,30;50,25,60"
  ],
  "14": [
    "50,50,0;45,15,-30;60,50,20;70,-40,-30;30,0,20",
    "20,0,25;60,50,15",
    "50,50,0;5,15,30;60,0,20"
  ],
  "15": [
    "40,40,0;45,-30,50;55,30,-60;40,20,50;30,0,20",
    "20,60,20;60,50,40",
    "10,40,0;45,-30,50;55,30,60"
  ],
  "17": [
    "30,-50,-30;40,-40,0;40,-30,-45;25,0,50;50,35,-20",
    "15,30,60;65,0,20",
    "0,50,30;40,-40,0;60,30,-40"
  ],
  "18": [
    "45,50,75;80,70,5;10,70,5;45,5,5",
    "15,45,20;70,-50,50",
    "0,60,30;40,50,0;20,-60,10"
  ],
  "19": [
    "40,25,30;20,45,-10;30,-50,20;50,-20,50;60,10,0",
    "80,30,50;20,-40,-10",
    "40,25,30;5,45,-10;30,-50,20"
  ],
  "03": [
    "40,30,-15;25,-30,60;30,65,40;50,0,0;30,50,0",
    "70,20,-60;10,20,45",
    "40,30,-15;25,30,-60;0,65,40"
  ],
  "04": [
    "20,50,0;40,50,55;20,0,60;60,-30,25;40,50,-30",
    "20,50,0;40,30,55",
    "40,50,30;20,50,0;60,-30,25"
  ],
  "05": [
    "40,30,-13;25,-37,60;30,65,40;50,0,0;30,50,0",
    "70,20,-60;40,20,45",
    "40,30,-15;25,30,-60;0,65,40"
  ],
  "06": [
    "10,20,45;25,20,0;20,-25,-35;45,0,55;40,30,-15",
    "15,-40,-50;55,-30,30",
    "10,20,-45;45,20,0;20,-25,-10"
  ],
  "08": [
    "30,60,30;70,-25,-60;40,-50,75;40,0,50;30,10,0",
    "10,40,55;70,55,-25",
    "30,30,60;70,-25,-60;40,50,50"
  ],
  "09": [
    "25,40,0;40,60,-20;20,-25,60;57,40,0;40,0,10",
    "20,15,25;73,40,60",
    "25,40,0;40,60,-20;10,-25,60"
  ]
};
const originalRoles={
  "01": ["intersecting_lines","parallel_lines","intersecting_lines","frontal_projecting","line_parallel_plane","B","A"],
  "02": ["ABC","line_point","ABC","parallel_lines","line_intersects_named","D","E"],
  "07": ["parallel_lines","intersecting_lines","ABC","parallel_lines","line_parallel_plane","D","A"],
  "13": ["parallel_lines","intersecting_lines","intersecting_lines","line_point","line_parallel_horizontal","D","A"],
  "16": ["ABC","ABC","parallel_lines","parallel_lines","line_intersects_horizontal","D","E"],
  "20": ["ABC","intersecting_lines","ABC","ABC","line_parallel_plane","D","E"],
  "10": [
    "ABC",
    "intersecting_lines",
    "parallel_lines",
    "intersecting_lines",
    "line_intersects_frontale",
    "D",
    "E"
  ],
  "11": [
    "ABC",
    "ABC",
    "parallel_lines",
    "frontal_projecting",
    "line_parallel_plane",
    "D",
    "E"
  ],
  "12": [
    "intersecting_lines",
    "ABC",
    "parallel_lines",
    "intersecting_lines",
    "line_intersects_named",
    "D",
    "A"
  ],
  "14": [
    "line_point",
    "parallel_lines",
    "intersecting_lines",
    "horizontal_projecting",
    "line_intersects_named",
    "D",
    "B"
  ],
  "15": [
    "line_point",
    "parallel_lines",
    "frontal_projecting",
    "ABC",
    "line_parallel_plane",
    "B",
    "C"
  ],
  "17": [
    "parallel_lines",
    "intersecting_lines",
    "parallel_lines",
    "intersecting_lines",
    "line_intersects_frontale",
    "A",
    "B"
  ],
  "18": [
    "parallel_lines",
    "ABC",
    "intersecting_lines",
    "intersecting_lines",
    "line_intersects_frontale",
    "B",
    "A"
  ],
  "19": [
    "intersecting_lines",
    "parallel_lines",
    "intersecting_lines",
    "ABC",
    "line_parallel_plane",
    "B",
    "A"
  ],
  "03": [
    "parallel_lines",
    "intersecting_lines",
    "ABC",
    "intersecting_lines",
    "line_intersects_named",
    "A",
    "B"
  ],
  "04": [
    "ABC",
    "parallel_lines",
    "ABC",
    "intersecting_lines",
    "line_intersects_horizontal",
    "D",
    "E"
  ],
  "05": [
    "parallel_lines",
    "intersecting_lines",
    "ABC",
    "intersecting_lines",
    "line_intersects_named",
    "A",
    "B"
  ],
  "06": [
    "parallel_lines",
    "intersecting_lines",
    "intersecting_lines",
    "ABC",
    "line_parallel_plane",
    "D",
    "A"
  ],
  "08": [
    "line_point",
    "ABC",
    "parallel_lines",
    "horizontal_projecting",
    "line_parallel_plane",
    "B",
    "C"
  ],
  "09": [
    "line_point",
    "parallel_lines",
    "intersecting_lines",
    "parallel_lines",
    "line_parallel_horizontal",
    "B",
    "E"
  ]
};
const originalScans={
  '01':'8adb0ef639d4217b431c4cc74ec1e75c4e52341ce396d68dc014b6d71cc096d0',
  '02':'ee527a65d18d4d47e85d49f7df6297d5b56a6b663db4f937ebf4ebd10bf38ae1',
  '03':'cb1f0d6e558f8fb2c1b861f19cd69b3379502a88dd621491cbe93cd8b342e9a7',
  '04':'10c50d74f57fed1dbacd63a3e13f70f61129247c54cac78d0cf88711b79ff7c7',
  '05':'869e6a20c391e96373c26a2cd2a420b3f898aa9bba18968e51f5e146a35a48b0',
  '06':'fef8bc3f74bb2dd7d36715466e980a0e53b4147496cf288e647f8ce958f5953a',
  '07':'71c69d683086d4bb19d990863afd220400ee0f64a9c5c78770a1cea90fb1c7cb',
  '08':'ec26b1d1685aff464b2faf3c9b7bf03f0453f153ec2e7431c701e17c26b31931',
  '09':'1fcbcad1e5576bda4dea3b5321753ee63e268b3007a628786b1259e732a8482b',
  '10':'7ec666c716f1e33e62c077c588f97542a9ffed658dfb71a5ba876221ed0de896',
  '11':'15157f32db0e3bd1536a7b28593807f1f49b5aed997bbc82755c21c0ebb1d700',
  '12':'0c895bd6fa7ff8cb5c7290edd41301e0f636b96b9d97fa261386d520c842a554',
  '13':'e513dce07665a85f9880321881fc35058bf629df3ef208e627c1415a1eeaf665',
  '14':'3d8b03d95920f766a454044d4a8fea4e55d63b4c684e99e8dac237486aa6747f',
  '15':'859c93b4b162a242255175cbc43e40ee1c8ad6643f724cc6ace127f708af4876',
  '16':'9209f8d3465a34a578e07e626c8cddff52580f2da7f937b9f95b108afaf7bb8a',
  '17':'1580c399adcbe4a709adf5f2b356909976d604d0b3aa1e0ac8e4181cc672ae5a',
  '18':'0acec3519e5c55eac6885f19ae50389939d628c8da5a4d10a68ec724607994b6',
  '19':'60a427287e12f785ef2a519e418af9c5c49aba90d02fd0d4513439991b9757a8',
  '20':'ba5ea4f8e8b013934f81ff312002910a52068361bfbb9042e8aaf691a5443b7a'
};
const win={};
new Function('window',fs.readFileSync('variants.js','utf8'))(win);
const error=[];
let checkedCoord=0, checkedStructures=0, checkedPhotos=0;
// All 20 individual assignment sheets have canonical JPEG scans in GitHub.
// The complete 26-sheet university source DOCX remains private on Drive.
for(const [variant,tasks] of Object.entries(originalCoordinates)){
  const data=win.SITEMATH_DATA.variants[variant];
  const schemas=win.SITEMATH_SCHEMES[variant];
  if(!data||!schemas){error.push(variant+': variant missing');continue;}
  tasks.forEach((printed,taskIndex)=>{
    const key='task'+(taskIndex+1);
    const labels=taskIndex===0?(variant==='18'?'SABC':'ABCDE'):taskIndex===1?'AB':'ABC';
    const entries=printed.split(';');
    entries.forEach((coordinates,index)=>{
      const expected=coordinates.split(',').map(Number);
      const actual=data[key]?.[labels[index]];
      if(JSON.stringify(actual)!==JSON.stringify(expected))
        error.push(variant+'/'+key+'/'+labels[index]+': source '+expected+', code '+actual);
      checkedCoord++;
    });
  });
  const [t4,t5,t6a,t6b,operation,through,result]=originalRoles[variant];
  const actual=[
    schemas.task4.planeType,schemas.task5.planeType,
    schemas.task6.planeA.type,schemas.task6.planeB.type,
    schemas.task4.operation?.type,schemas.task4.operation?.through,
    schemas.task4.operation?.resultPoint
  ];
  [t4,t5,t6a,t6b,operation,through,result].forEach((expected,i)=>{
    if(actual[i]!==expected)error.push(variant+'/role-'+i+': photo '+expected+', code '+actual[i]);
  });
  checkedStructures+=3;
  for(const task of [4,5,6]){
    const scheme=schemas['task'+task];
    if(!scheme?.sourceGeometry)error.push(variant+'/'+task+': original tracing missing');
    if(scheme?.sourceVerified!==(task===4 || ((variant==='12'&&task===5)||(variant==='13'&&task===6)) || ['01','02','03','04','05','06','07','08','09','10','11','14','15','16','17','18','19','20'].includes(variant)))error.push(variant+'/'+task+': source review status differs from individually audited variants');
    if(scheme?.sourceAvailable!==true)error.push(variant+'/'+task+': source scan unavailable');
    if(scheme?.sourceId!=='source-photos/scans/variant-'+variant+'.jpg')
      error.push(variant+'/'+task+': incorrect scan source path '+scheme?.sourceId);
  }
}
for(const [variant,sha] of Object.entries(originalScans)){
  const path='source-photos/scans/variant-'+variant+'.jpg';
  if(!fs.existsSync(path)){error.push('original scan missing: '+path);continue;}
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  if(actual!==sha)error.push('original scan SHA256 mismatch: '+path);
  checkedPhotos++;
}
// Independent visual audit of the *actual given line directions* on each
// scanned original. + means falls as X increases on screen, - means
// rises, 0 means horizontal. Entries are Π₂ / Π₁; the four entries are:
// task 4, task 5, task 6 first plane, task 6 second plane.
const photoLineDirections={
  "10": [
    {},
    {
      "a": "-/+",
      "f": "+/0",
      "l": "+/-"
    },
    {
      "a": "+/+",
      "b": "+/+"
    },
    {
      "h": "0/+",
      "f": "-/0"
    }
  ],
  "11": [
    {},
    {
      "l": "+/-"
    },
    {
      "a": "-/+",
      "b": "-/+"
    },
    {
      "projector2": "0"
    }
  ],
  "12": [
    {
      "a": "-/+",
      "b": "+/+"
    },
    {
      "l": "-/+"
    },
    {
      "a": "-/+",
      "b": "-/+"
    },
    {
      "h": "0/+",
      "f": "-/0"
    }
  ],
  "14": [
    {
      "a": "-/+"
    },
    {
      "a": "+/+",
      "b": "+/+",
      "l": "-/-"
    },
    {
      "a": "-/-",
      "b": "+/+"
    },
    {
      "projector1": "-"
    }
  ],
  "15": [
    {
      "a": "-/+"
    },
    {
      "a": "+/+",
      "b": "+/+",
      "l": "-/-"
    },
    {
      "projector2": "-"
    },
    {}
  ],
  "17": [
    {
      "m": "-/+",
      "n": "-/+"
    },
    {
      "a": "+/-",
      "b": "-/+",
      "l": "-/-"
    },
    {
      "a": "-/0",
      "b": "-/0"
    },
    {
      "c": "+/-",
      "h": "0/-"
    }
  ],
  "18": [
    {
      "a": "+/+",
      "b": "+/+"
    },
    {
      "l": "0/+"
    },
    {
      "a": "+/+",
      "b": "-/-"
    },
    {
      "c": "+/+",
      "d": "-/-"
    }
  ],
  "19": [
    {
      "a": "-/+",
      "b": "+/+"
    },
    {
      "a": "-/+",
      "b": "-/+",
      "l": "+/+"
    },
    {
      "a": "-/-",
      "b": "+/-"
    },
    {}
  ],
  "03": [
    {
      "a": "+/0",
      "b": "+/0"
    },
    {
      "a": "+/-",
      "f": "-/0",
      "l": "-/+"
    },
    {},
    {
      "a": "-/+",
      "b": "+/-"
    }
  ],
  "04": [
    {},
    {
      "a": "+/+",
      "b": "+/+",
      "l": "-/+"
    },
    {},
    {
      "h": "0/-",
      "f": "+/0"
    }
  ],
  "05": [
    {
      "a": "+/0",
      "b": "+/-"
    },
    {
      "a": "+/-",
      "f": "-/0",
      "l": "-/+"
    },
    {},
    {
      "a": "-/-",
      "b": "+/+"
    }
  ],
  "06": [
    {
      "m": "-/+",
      "n": "-/+"
    },
    {
      "a": "-/-",
      "b": "+/+",
      "l": "+/+"
    },
    {
      "a": "0/0",
      "b": "-/-"
    },
    {}
  ],
  "08": [
    {
      "a": "+/+"
    },
    {
      "l": "-/+"
    },
    {
      "a": "-/-",
      "b": "-/-"
    },
    {
      "projector1": "+"
    }
  ],
  "09": [
    {
      "b": "-/+"
    },
    {
      "a": "+/+",
      "b": "+/+",
      "l": "0/+"
    },
    {
      "a": "+/+",
      "b": "-/-"
    },
    {
      "h": "0/-",
      "h′": "0/-"
    }
  ]
};
const direction=seg=>{
  const [p,q]=seg;
  const dx=q[0]-p[0],dy=q[1]-p[1];
  if(Math.abs(dx)<1e-9)return 'vertical';
  const slope=dy/dx;
  return Math.abs(slope)<0.09?'0':slope>0?'+':'-';
};
for(const [variant,examples] of Object.entries(photoLineDirections)){
  const group=win.SITEMATH_SCHEMES[variant];
  const definitions=[
    group.task4.sourceGeometry||group.task4,
    group.task5.sourceGeometry||group.task5,
    group.task6.sourceGeometry?.planeA||group.task6.planeA,
    group.task6.sourceGeometry?.planeB||group.task6.planeB
  ];
  examples.forEach((expected,section)=>{
    const source=definitions[section];
    for(const [lineName,required] of Object.entries(expected)){
      const actual=lineName.startsWith('projector')
        ? direction(source.line)
        : source.lines?.[lineName] ?
          direction(source.lines[lineName].p2)+'/'+direction(source.lines[lineName].p1)
          : 'missing';
      if(required!==actual)
        error.push(variant+'/'+[4,5,'6A','6B'][section]+' '+lineName+': paper '+required+', digital '+actual);
    }
  });
}
// Regression for a previously missed geometric invariant: a given
// source point on two Monge views must have one vertical projector.
// Do not validate archival raster tracing or movable line labels here.
let pairedInputPoints=0;
function checkInputProjectors(node,path){
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node.p1)&&Array.isArray(node.p2)&&
     typeof node.p1[0]==='number'&&typeof node.p2[0]==='number'){
    pairedInputPoints++;
    if(Math.abs(node.p1[0]-node.p2[0])>1e-5)
      error.push(path+': working given point lacks vertical projector');
  }
  for(const [key,value] of Object.entries(node))
    if(key!=='sourceGeometry'&&key!=='sourceEntities'&&key!=='lineLabels')
      checkInputProjectors(value,path+'.'+key);
}
for(const [variant,tasks]of Object.entries(win.SITEMATH_SCHEMES))
  for(const [task,obj]of Object.entries(tasks))
    checkInputProjectors(obj,variant+'/'+task);
if(pairedInputPoints!==134)
  error.push('Working given point inventory changed: expected 134, got '+pairedInputPoints);

if(error.length){console.error(error.join('\n'));process.exitCode=1;}
else console.log('Paper source audit OK: '+Object.keys(originalCoordinates).length+
  ' variants, '+(Object.keys(originalCoordinates).length*3)+' coordinate tasks / '+checkedCoord+' point records, '+
  checkedStructures+' graphical assignment roles, '+checkedPhotos+' university album JPEG scans.');
