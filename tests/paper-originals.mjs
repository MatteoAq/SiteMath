// Independently transcribed photographic paper originals, 13 Oct 2026.
// Check 60 numeric assignments (200 spatial points), 60 graphical assignment
// definitions, and the exact SHA-256 bytes of every recovered source photo.
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
    "30,-50,30;40,-40,0;40,-30,-45;25,0,50;50,35,-20",
    "15,30,60;65,0,20",
    "0,50,30;40,-40,0;60,30,-40"
  ],
  "18": [
    "30,60,30;40,50,0;20,-60,0;45,-30,-20;30,50,-15",
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
    "10,20,45;25,20,0;20,-25,-35;45,0,55;40,30,15",
    "15,-40,-50;55,-30,30",
    "10,20,-45;45,20,0;20,-25,-10"
  ],
  "08": [
    "30,60,30;70,-25,-60;40,-50,15;40,0,50;30,10,0",
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
const originalPhotos=[
  [
    "03",
    "1000022472.jpg",
    "e866a71be9a153f81930a9bb495b298215b73748a8d482aacb78590a844fe206"
  ],
  [
    "03",
    "1000022481.jpg",
    "872591bcdabf72b31dd3113f8246d68c0250a8f68cda2301af534352b57e07cb"
  ],
  [
    "04",
    "1000022483.jpg",
    "175dbbc5c05ff1a0450d9d67139a0360112c0519bb71dbb8df8c65dd92bcaaa1"
  ],
  [
    "05",
    "1000022482.jpg",
    "029b47112f89c786d15a4ecfc5b80ceef5aaa9992ca5439f8b939f7504bc6ac0"
  ],
  [
    "06",
    "1000022471.jpg",
    "9c18e5c86c2ffd5e71e61b9ab56563d833a2c8143047a176bcd2cad20d9d9231"
  ],
  [
    "08",
    "1000022484.jpg",
    "bd04ef0e87cf97953428e1ad1fa1ab82e34117ff7d036fda76e8e29fb76716b5"
  ],
  [
    "09",
    "1000022475.jpg",
    "ed27e80300e8cb89db7468a27fc157e1c33b1ef194c36496060ff40f1a605d8a"
  ],
  [
    "10",
    "1000022486.jpg",
    "93578498dc84490ea54ab7132a372cd416b8593180f2d50e4285b3fcc54628cb"
  ],
  [
    "11",
    "1000022470.jpg",
    "5ad2c523ce8976b0fa74c49a0de0110947592c3f44601be0db9f6e540d8e1435"
  ],
  [
    "11",
    "1000022480.jpg",
    "e6cae87a5ab6653151c133dd2ad992c7ef2ec4148f378958f4935a75a56d333e"
  ],
  [
    "12",
    "1000022468.jpg",
    "2764a9de532b3e86f93195dd68df218022dc7dea81f54ce19889a1203cda98b2"
  ],
  [
    "14",
    "1000022467.jpg",
    "47efdf7f4e4ca99e8f5352a3824b816ffee2c301c1977a9e3916d866e4755132"
  ],
  [
    "14",
    "1000022478.jpg",
    "a1ccbdc0ff727136f0d4704aa62beaf28fa38cb2d40873e6f1fe8ed55d6705d5"
  ],
  [
    "15",
    "1000022469.jpg",
    "3161aea22d2a53aed822f301d0cbf2299a633d26672d6c83af9f6d3b75569777"
  ],
  [
    "15",
    "1000022479.jpg",
    "94638ad1e89205f0e35e4bb19be35dddc1b5dad2d9b97918778681bea2a890d7"
  ],
  [
    "17",
    "1000022485.jpg",
    "5adb9fe32237aed33d85622e2eb8075b23c9a183bd1d3e79bb133acc36088adc"
  ],
  [
    "18",
    "1000022474.jpg",
    "4c34316df44aea70fe7e2f06019b450db9244427240ed76402976b8d947d1fdd"
  ],
  [
    "19",
    "1000022473.jpg",
    "b1808a3e4a1020b8a3569acf00804a1d7d752df2a3b7b0ede7fd56289a2db326"
  ]
];
const win={};
new Function('window',fs.readFileSync('variants.js','utf8'))(win);
const error=[];
let checkedCoord=0, checkedStructures=0, checkedPhotos=0;
// Six originals are preserved in the connected PRIVATE Google Drive album.
// They must not be misrepresented as publicly archived source-photos JPEGs.
const privateAlbumVariants=new Set(['01','02','07','13','16','20']);
for(const [variant,tasks] of Object.entries(originalCoordinates)){
  const data=win.SITEMATH_DATA.variants[variant];
  const schemas=win.SITEMATH_SCHEMES[variant];
  if(!data||!schemas){error.push(variant+': variant missing');continue;}
  tasks.forEach((printed,taskIndex)=>{
    const key='task'+(taskIndex+1);
    const labels=taskIndex===0?'ABCDE':taskIndex===1?'AB':'ABC';
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
    if(privateAlbumVariants.has(variant)){
      // The visual source is sheet "В. XX" inside the private DOCX, not a
      // public GitHub JPEG. The photographed raw trace must still exist.
      if(!scheme?.sourceGeometry)error.push(variant+'/'+task+': raw album trace absent');
      if(scheme?.sourceVerified===true)error.push(variant+'/'+task+': unreviewed Drive trace marked verified');
    } else {
      if(!scheme?.sourceAvailable)error.push(variant+'/'+task+': saved original not connected');
      if(!scheme?.sourceId)error.push(variant+'/'+task+': source path missing');
    }
  }
}
for(const [variant,file,sha] of originalPhotos){
  const path='source-photos/variant-'+variant+'/'+file;
  if(!fs.existsSync(path)){error.push('original photo missing: '+path);continue;}
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  if(actual!==sha)error.push('original photo SHA256 mismatch: '+path);
  checkedPhotos++;
}
// Independent visual audit of the *actual given line directions* on each
// photographed original. + means falls as X increases on screen, - means
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
if(error.length){console.error(error.join('\n'));process.exitCode=1;}
else console.log('Paper source audit OK: '+Object.keys(originalCoordinates).length+
  ' variants, '+(Object.keys(originalCoordinates).length*3)+' coordinate tasks / '+checkedCoord+' point records, '+
  checkedStructures+' graphical assignment roles, '+checkedPhotos+' original JPEG files.');
