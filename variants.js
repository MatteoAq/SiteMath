window.SITEMATH_DATA = {
  provenance: {
    title: "Инженерная и компьютерная графика. ДВИК, Владивосток, 2007",
    assignmentUrl: "https://mehanika-sopromat.ru/grafika/vladivostok_2007_grafika.html",
    examplesUrl: "https://mehanika-sopromat.ru/grafika/vladivostok_2007_grafika_examples.html",
    note: "Современные листы используют тот же блок из шести задач, но номера 10–17 относятся к расширенному банку вариантов. Для них нельзя надёжно вычислять данные по номеру – вариант хранится как отдельная запись."
  },
  tasks: {
    1: {
      title: "Точки в системе 3 плоскостей",
      short: "Комплексный чертёж и наглядное изображение точек",
      kind: "coordinates"
    },
    2: {
      title: "Натуральная величина отрезка AB",
      short: "Проекции AB, натуральная величина двумя способами и углы наклона",
      kind: "coordinates"
    },
    3: {
      title: "Пересекающая ℓ и параллельная a",
      short: "Через C провести ℓ, пересекающую AB, и a ∥ AB",
      kind: "coordinates"
    },
    4: {
      title: "Главные линии плоскости",
      short: "Горизонталь, фронталь, линия наибольшего ската и дополнительное построение",
      kind: "diagram"
    },
    5: {
      title: "Пересечение прямой и плоскости",
      short: "Точка пересечения и видимость",
      kind: "diagram"
    },
    6: {
      title: "Пересечение двух плоскостей",
      short: "Линия пересечения и прямая через K, параллельная обеим плоскостям",
      kind: "diagram"
    }
  },
  variants: {
    "04": {
      label: "Вариант 04",
      task1: {
        A:[20,50,0], B:[40,50,55], C:[20,0,60], D:[60,-30,25], E:[40,50,-30]
      },
      task2: { A:[20,50,0], B:[40,30,55] },
      task3: { A:[40,50,30], B:[20,50,0], C:[60,-30,25] },
      task4: {
        statement:"В пл. Σ(ABC) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ, пересекающую h. Построить т. E над прямой ℓ.",
        plane:"ABC", operation:"line_intersects_horizontal", pointRelation:"above_line"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∥b) и определить видимость прямой ℓ относительно пл. Σ.",
        plane:"a∥b"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(ABC) и пл. Θ(h∩f). Через т. M провести прямую ℓ ∥ обеим плоскостям.",
        planes:["ABC","h∩f"], throughPoint:"M"
      }
    },
    "05": {
      label: "Вариант 05",
      task1: {
        A:[40,30,-13], B:[25,-37,60], C:[30,65,40], D:[50,0,0], E:[30,50,0]
      },
      task2: { A:[70,20,-60], B:[40,20,45] },
      task3: { A:[40,30,-15], B:[25,30,-60], C:[0,65,40] },
      task4: {
        statement:"В пл. Σ(a∥b) построить горизонталь, фронталь и линию наибольшего ската. Через т. A провести прямую ℓ, пересекающую прямую a. Построить т. B под пл. Σ.",
        plane:"a∥b", operation:"line_intersects_a", pointRelation:"below_plane"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∩f) и определить видимость прямой относительно пл. Σ.",
        plane:"a∩f"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(ABC) и пл. Θ(a∩b). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["ABC","a∩b"]
      }
    },
    "07": {
      label: "Вариант 07",
      task1: {
        A:[50,40,0], B:[45,-20,-35], C:[30,-50,20], D:[70,-30,10], E:[25,55,-45]
      },
      task2: { A:[70,-30,10], B:[25,50,45] },
      task3: { A:[50,40,0], B:[10,-20,-35], C:[30,-50,20] },
      task4: {
        statement:"В пл. Σ(a∥b) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ ∥ пл. Σ. Построить т. A над прямой a.",
        plane:"a∥b", operation:"line_parallel_plane", pointRelation:"above_a"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∩b) и определить видимость прямой относительно пл. Σ.",
        plane:"a∩b"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(ABC) и пл. Ω(a∥b). Через т. K провести прямую, параллельную обеим плоскостям.",
        planes:["ABC","a∥b"]
      }
    },
  "08": {
      label: "Вариант 08",
      task1: {
        A:[30,60,30], B:[70,-25,-60], C:[40,-50,15], D:[40,0,50], E:[30,10,0]
      },
      task2: { A:[10,40,55], B:[70,55,-25] },
      task3: { A:[30,30,60], B:[70,-25,-60], C:[40,50,50] },
      task4: {
        statement:"В пл. Σ(A;a) построить горизонталь, фронталь и линию наибольшего ската. Через т. B провести прямую, параллельную пл. Σ. Построить т. C над прямой.",
        plane:"A;a", operation:"line_parallel_plane", pointRelation:"above_line"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(ABC) и определить видимость прямой относительно пл. Σ.",
        plane:"ABC"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(a∥b) и пл. Δ(Δ₁). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["a∥b","horizontal_projecting"]
      }
    },
    "10": {
      label: "Вариант 10",
      task1: {
        A:[50,60,0], B:[10,0,70], C:[60,50,40], D:[60,50,-20], E:[50,-40,-30]
      },
      task2: { A:[10,-10,30], B:[60,-50,-50] },
      task3: { A:[50,60,0], B:[10,0,70], C:[60,50,40] },
      task4: {
        statement:"В пл. Σ(ABC) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ, пересекающую фронталь. Построить т. E под прямой ℓ.",
        plane:"ABC", operation:"line_intersects_frontale", pointRelation:"below_line"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∩f) и определить видимость прямой относительно плоскости.",
        plane:"a∩f"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(a∥b) и пл. Θ(h∩f). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["a∥b","h∩f"]
      }
    },
    "11": {
      label: "Вариант 11",
      task1: {
        A:[30,60,30], B:[40,50,0], C:[20,0,-60], D:[45,-30,-20], E:[30,50,-15]
      },
      task2: { A:[15,45,20], B:[70,-50,50] },
      task3: { A:[30,60,30], B:[0,50,0], C:[40,-60,0] },
      task4: {
        statement:"В пл. Σ(ABC) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ ∥ пл. Σ. Построить т. E над прямой ℓ.",
        plane:"ABC", operation:"line_parallel_plane", pointRelation:"above_line"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(ABC) и определить видимость прямой относительно плоскости.",
        plane:"ABC"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(a∥b) и пл. Γ(Γ₂). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["a∥b","projecting"]
      }
    },
    "12": {
      label: "Вариант 12",
      task1: {
        A:[25,-10,40], B:[30,50,25], C:[40,30,-60], D:[50,0,50], E:[60,20,15]
      },
      task2: { A:[50,-15,50], B:[20,20,30] },
      task3: { A:[0,10,50], B:[30,25,30], C:[50,25,60] },
      task4: {
        statement:"В пл. Σ(a∩b) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ, пересекающую прямую a. Построить т. A за прямой ℓ.",
        plane:"a∩b", operation:"line_intersects_a", pointRelation:"behind_line"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(ABC) и определить видимость прямой относительно плоскости.",
        plane:"ABC"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(a∥b) и пл. Θ(h∩f). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["a∥b","h∩f"]
      }
    },
    "14": {
      label: "Вариант 14",
      task1: {
        A:[50,50,0], B:[45,15,-30], C:[60,50,20], D:[70,-40,-30], E:[30,0,20]
      },
      task2: { A:[20,0,25], B:[60,50,15] },
      task3: { A:[50,50,0], B:[5,15,30], C:[60,0,20] },
      task4: {
        statement:"В пл. Σ(A;a) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ, пересекающую прямую a. Построить т. B под плоскостью Σ(A;a).",
        plane:"A;a", operation:"line_intersects_a", pointRelation:"below_plane"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∥b) и определить видимость прямой относительно плоскости.",
        plane:"a∥b"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(a∩b) и пл. Ω(Ω₁). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["a∩b","projecting"]
      }
    },
    "15": {
      label: "Вариант 15",
      task1: {
        A:[40,40,0], B:[45,-30,50], C:[55,30,-60], D:[40,20,50], E:[30,0,20]
      },
      task2: { A:[20,60,20], B:[60,50,40] },
      task3: { A:[10,40,0], B:[45,-30,50], C:[55,30,60] },
      task4: {
        statement:"В пл. Σ(a;A) построить горизонталь, фронталь и линию наибольшего ската. Через т. B провести прямую ℓ ∥ пл. Σ. Построить т. C над прямой ℓ.",
        plane:"a;A", operation:"line_parallel_plane", pointRelation:"above_line"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∥b) и определить видимость прямой относительно плоскости.",
        plane:"a∥b"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(Σ₂) и пл. Θ(ABC). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["projecting","ABC"]
      }
    },
    "17": {
      label: "Вариант 17",
      task1: {
        A:[30,-50,30], B:[40,-40,0], C:[40,-30,-45], D:[25,0,50], E:[50,35,-20]
      },
      task2: { A:[15,30,60], B:[65,0,20] },
      task3: { A:[0,50,30], B:[40,-40,0], C:[60,30,-40] },
      task4: {
        statement:"В пл. Σ(m∥n) построить горизонталь, фронталь и линию наибольшего ската. Через т. A провести прямую ℓ, пересекающую фронталь. Построить т. B над прямой ℓ.",
        plane:"m∥n", operation:"line_intersects_frontale", pointRelation:"above_line"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∩b) и определить видимость прямой относительно плоскости.",
        plane:"a∩b"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(a∥b) и пл. Θ(c∩h). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["a∥b","c∩h"]
      }
    },
    "18": {
      label: "Вариант 18",
      task1: {
        A:[30,60,30], B:[40,50,0], C:[20,-60,0], D:[45,-30,-20], E:[30,50,-15]
      },
      task2: { A:[15,45,20], B:[70,-50,50] },
      task3: { A:[0,60,30], B:[40,50,0], C:[20,-60,10] },
      task4: {
        statement:"В пл. Σ(a∥b) построить горизонталь, фронталь и линию наибольшего ската. Через т. B провести прямую ℓ, пересекающую фронталь. Построить т. A за прямой ℓ.",
        plane:"a∥b", operation:"line_intersects_frontale", pointRelation:"behind_line"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(ABC) и определить видимость прямой относительно плоскости.",
        plane:"ABC"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(a∩b) и пл. Θ(c∩d). Через т. K провести прямую ∥ обеим плоскостям.",
        planes:["a∩b","c∩d"]
      }
    }
  }
};

window.SITEMATH_SCHEMES = {
  "04": {
    task4: {
      planeType:"ABC",
      points:{
        A:{p2:[86,166],p1:[86,224]},
        B:{p2:[218,128],p1:[218,326]},
        C:{p2:[321,248],p1:[321,294]},
        D:{p2:[391,144],p1:[391,278]}
      },
      operation:{type:"line_intersects_horizontal",through:"D",resultPoint:"E",relation:"above_line"}
    }
  },
  "05": {
    task4: {
      planeType:"parallel_lines",
      planeLines:["a","b"],
      lines:{
        a:{p2:[[155,212],[319,287]],p1:[[137,332],[318,323]]},
        b:{p2:[[159,241],[303,307]],p1:[[142,358],[322,341]]}
      },
      points:{ A:{p2:[90,206],p1:[92,302]} },
      operation:{type:"line_intersects_named",through:"A",target:"a",resultPoint:"B",relation:"below_plane"}
    }
  },
  "07": {
    // 14.10.2026: source geometry from university six-task album, page 07.
    task4:{
      planeType:"parallel_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[812,1109],[1073,955]],p1:[[797,1261],[1115,1164]]},
        b:{p2:[[930,1135],[1215,953]],p1:[[922,1298],[1186,1220]]}
      },
      points:{D:{p2:[1314,1023],p1:[1314,1301]}},
      operation:{type:"line_parallel_plane",through:"D",resultPoint:"A",relation:"above_named",target:"a"}
    }
  },
  "08": {
    task4: {
      planeType:"line_point",
      planeLine:"a",
      planePoint:"A",
      lines:{
        a:{p2:[[87,123],[251,213]],p1:[[79,209],[255,268]]}
      },
      points:{
        A:{p2:[148,95],p1:[148,202]},
        B:{p2:[253,127],p1:[253,283]}
      },
      operation:{type:"line_parallel_plane",through:"B",resultPoint:"C",relation:"above_line"}
    }
  },
  "10": {
    task4: {
      planeType:"ABC",
      points:{
        A:{p2:[184,463],p1:[184,548]},
        B:{p2:[277,375],p1:[277,610]},
        C:{p2:[354,448],p1:[354,483]},
        D:{p2:[448,385],p1:[448,571]}
      },
      operation:{type:"line_intersects_frontale",through:"D",resultPoint:"E",relation:"below_line"}
    }
  },
  "11": {
    task4: {
      planeType:"ABC",
      points:{
        A:{p2:[131,203],p1:[131,293]},
        B:{p2:[210,168],p1:[210,329]},
        C:{p2:[237,239],p1:[237,248]},
        D:{p2:[281,203],p1:[281,307]}
      },
      operation:{type:"line_parallel_plane",through:"D",resultPoint:"E",relation:"above_line"}
    }
  },
  "12": {
    task4: {
      planeType:"intersecting_lines",
      planeLines:["a","b"],
      lines:{
        a:{p2:[[150,462],[340,362]],p1:[[120,532],[345,581]]},
        b:{p2:[[140,358],[320,470]],p1:[[108,478],[325,613]]}
      },
      points:{
        D:{p2:[445,383],p1:[445,546]}
      },
      sourceVerified:false,
      operation:{type:"line_intersects_named",through:"D",target:"a",resultPoint:"A",relation:"behind_line"}
    }
  },
  "14": {
    task4: {
      planeType:"line_point",
      planeLine:"a",
      planePoint:"A",
      lines:{
        a:{p2:[[52,548],[231,458]],p1:[[51,600],[252,665]]}
      },
      points:{
        A:{p2:[189,538],p1:[189,596]},
        D:{p2:[373,484],p1:[373,669]}
      },
      operation:{type:"line_intersects_named",through:"D",target:"a",resultPoint:"B",relation:"below_plane"}
    }
  },
  "15": {
    task4: {
      planeType:"line_point",
      planeLine:"a",
      planePoint:"A",
      lines:{
        a:{p2:[[174,485],[387,443]],p1:[[177,536],[389,620]]}
      },
      points:{
        A:{p2:[247,386],p1:[247,645]},
        B:{p2:[483,444],p1:[483,580]}
      },
      operation:{type:"line_parallel_plane",through:"B",resultPoint:"C",relation:"above_line"}
    }
  },
  "17": {
    task4: {
      planeType:"parallel_lines",
      planeLines:["m","n"],
      lines:{
        m:{p2:[[108,432],[287,365]],p1:[[126,481],[303,628]]},
        n:{p2:[[157,460],[334,395]],p1:[[80,527],[260,675]]}
      },
      points:{
        A:{p2:[400,388],p1:[400,584]}
      },
      operation:{type:"line_intersects_frontale",through:"A",resultPoint:"B",relation:"above_line"}
    }
  },
  "18": {
    task4: {
      planeType:"parallel_lines",
      planeLines:["a","b"],
      lines:{
        a:{p2:[[164,159],[343,270]],p1:[[110,286],[277,372]]},
        b:{p2:[[145,192],[322,305]],p1:[[112,248],[299,339]]}
      },
      points:{
        B:{p2:[371,217],p1:[371,343]}
      },
      operation:{type:"line_intersects_frontale",through:"B",resultPoint:"A",relation:"behind_line"}
    }
  }
};

Object.assign(window.SITEMATH_SCHEMES["04"], {
  task5:{
    planeType:"parallel_lines",planeLines:["a","b"],
    lines:{
      a:{p2:[[86,73],[319,174]],p1:[[84,241],[291,357]]},
      b:{p2:[[73,116],[296,211]],p1:[[72,282],[280,389]]},
      l:{p2:[[88,187],[315,58]],p1:[[78,322],[277,404]]}
    },givenLine:"l"
  },
  task6:{
    planeA:{type:"ABC",points:{
      A:{p2:[155,138],p1:[155,258]},
      B:{p2:[263,72],p1:[263,334]},
      C:{p2:[365,230],p1:[365,404]}
    }},
    planeB:{type:"intersecting_lines",lines:{
      h:{p2:[[108,217],[378,225]],p1:[[116,368],[363,301]]},
      f:{p2:[[167,112],[355,221]],p1:[[145,302],[365,305]]}
    }},
    pointK:{p2:[112,79],p1:[112,330]},
    pointLabel:"M"
  }
});

Object.assign(window.SITEMATH_SCHEMES["05"], {
  task5:{
    planeType:"intersecting_lines",planeLines:["a","f"],
    lines:{
      a:{p2:[[126,211],[279,128]],p1:[[121,322],[265,237]]},
      f:{p2:[[104,111],[278,219]],p1:[[116,284],[305,282]]},
      l:{p2:[[88,223],[309,153]],p1:[[88,347],[287,226]]}
    },givenLine:"l"
  },
  task6:{
    planeA:{type:"ABC",points:{
      A:{p2:[94,169],p1:[94,294]},
      B:{p2:[188,116],p1:[188,252]},
      C:{p2:[250,184],p1:[250,306]}
    }},
    planeB:{type:"intersecting_lines",lines:{
      a:{p2:[[284,181],[397,115]],p1:[[286,327],[401,263]]},
      b:{p2:[[287,113],[398,177]],p1:[[285,260],[402,326]]}
    }},
    pointK:{p2:[143,104],p1:[143,350]}
  }
});

Object.assign(window.SITEMATH_SCHEMES["07"], {
  task5:{
    planeType:"intersecting_lines",planeLines:["a","b"],
    lines:{
      a:{p2:[[217,1801],[505,1680]],p1:[[282,1838],[503,1975]]},
      b:{p2:[[225,1659],[490,1748]],p1:[[235,1965],[531,1870]]},
      l:{p2:[[184,1703],[465,1798]],p1:[[223,1892],[472,1977]]}
    },givenLine:"l"
  },
  task6:{
    planeA:{type:"ABC",points:{
      A:{p2:[855,1719],p1:[862,1934]},
      B:{p2:[934,1650],p1:[945,1823]},
      C:{p2:[1096,1800],p1:[1095,1876]}
    }},
    planeB:{type:"parallel_lines",lines:{
      a:{p2:[[1114,1689],[1430,1761]],p1:[[1127,1869],[1392,2060]]},
      b:{p2:[[1120,1753],[1418,1822]],p1:[[1104,1917],[1383,2125]]}
    }},
    pointK:{p2:[1283,1650],p1:[1285,1892]}
  }
});

Object.assign(window.SITEMATH_SCHEMES["08"], {
  task5:{
    planeType:"ABC",
    points:{
      A:{p2:[80,115],p1:[82,296]},
      B:{p2:[140,72],p1:[140,194]},
      C:{p2:[254,149],p1:[255,252]}
    },
    lines:{l:{p2:[[43,166],[282,116]],p1:[[45,252],[286,307]]}},
    givenLine:"l"
  },
  task6:{
    planeA:{type:"parallel_lines",lines:{
      a:{p2:[[28,117],[160,70]],p1:[[39,269],[162,181]]},
      b:{p2:[[42,156],[185,103]],p1:[[92,302],[211,214]]}
    }},
    planeB:{type:"horizontal_projecting",projection:"p1",line:[[54,219],[233,309]],name:"Δ"},
    pointK:{p2:[232,102],p1:[239,282]}
  }
});

Object.assign(window.SITEMATH_SCHEMES["10"], {
  task5:{
    planeType:"intersecting_lines",planeLines:["a","f"],
    lines:{
      a:{p2:[[280,470],[560,360]],p1:[[232,690],[536,608]]},
      f:{p2:[[270,400],[543,480]],p1:[[260,618],[523,618]]},
      l:{p2:[[310,345],[525,470]],p1:[[300,530],[527,684]]}
    },givenLine:"l"
  },
  task6:{
    planeA:{type:"parallel_lines",lines:{
      a:{p2:[[198,345],[500,500]],p1:[[100,510],[316,585]]},
      b:{p2:[[145,372],[443,542]],p1:[[100,565],[318,640]]}
    }},
    planeB:{type:"intersecting_lines",lines:{
      h:{p2:[[394,411],[622,410]],p1:[[412,516],[627,642]]},
      f:{p2:[[392,468],[601,350]],p1:[[401,573],[631,570]]}
    }},
    pointK:{p2:[370,350],p1:[384,629]}
  }
});

Object.assign(window.SITEMATH_SCHEMES["11"], {
  task5:{
    planeType:"ABC",
    points:{
      A:{p2:[219,188],p1:[219,238]},
      B:{p2:[329,124],p1:[329,199]},
      C:{p2:[367,162],p1:[367,266]}
    },
    lines:{l:{p2:[[264,128],[358,180]],p1:[[238,260],[354,218]]}},
    givenLine:"l"
  },
  task6:{
    planeA:{type:"parallel_lines",lines:{
      a:{p2:[[58,151],[174,120]],p1:[[55,188],[202,242]]},
      b:{p2:[[102,174],[222,130]],p1:[[52,202],[187,270]]}
    }},
    planeB:{type:"frontal_projecting",projection:"p2",line:[[58,149],[242,149]],name:"Γ"},
    pointK:{p2:[289,116],p1:[295,266]}
  }
});

Object.assign(window.SITEMATH_SCHEMES["12"], {
  task5:{
    planeType:"ABC",
    points:{
      A:{p2:[267,360],p1:[267,641]},
      B:{p2:[475,307],p1:[475,532]},
      C:{p2:[527,405],p1:[527,645]}
    },
    lines:{
      l:{p2:[[215,420],[556,340]],p1:[[220,530],[540,682]]}
    },
    givenLine:"l",
    sourceVerified:false
  },
  task6:{
    planeA:{type:"parallel_lines",lines:{
      a:{p2:[[20,405],[305,323]],p1:[[85,510],[335,575]]},
      b:{p2:[[30,458],[350,377]],p1:[[70,560],[303,625]]}
    }},
    planeB:{type:"intersecting_lines",lines:{
      h:{p2:[[367,409],[548,411]],p1:[[385,505],[568,618]]},
      f:{p2:[[390,455],[565,323]],p1:[[365,545],[570,545]]}
    }},
    pointK:{p2:[195,326],p1:[195,641]},
    sourceVerified:false
  }
});

Object.assign(window.SITEMATH_SCHEMES["14"], {
  task5:{
    planeType:"parallel_lines",planeLines:["a","b"],
    lines:{
      a:{p2:[[301,385],[579,534]],p1:[[241,511],[386,676]]},
      b:{p2:[[274,425],[548,571]],p1:[[278,500],[418,644]]},
      l:{p2:[[205,480],[463,395]],p1:[[221,651],[397,530]]}
    },givenLine:"l"
  },
  task6:{
    planeA:{type:"intersecting_lines",lines:{
      a:{p2:[[4,443],[218,398]],p1:[[8,581],[213,681]]},
      b:{p2:[[2,472],[245,540]],p1:[[48,594],[245,690]]}
    }},
    planeB:{type:"horizontal_projecting",projection:"p1",line:[[48,650],[250,564]],name:"Ω"},
    pointK:{p2:[369,433],p1:[381,659]}
  }
});

Object.assign(window.SITEMATH_SCHEMES["15"], {
  task5:{
    planeType:"parallel_lines",planeLines:["a","b"],
    lines:{
      a:{p2:[[350,325],[585,445]],p1:[[273,548],[552,597]]},
      b:{p2:[[320,367],[557,490]],p1:[[290,491],[560,543]]},
      l:{p2:[[267,456],[583,353]],p1:[[250,635],[550,585]]}
    },givenLine:"l"
  },
  task6:{
    planeA:{type:"frontal_projecting",projection:"p2",line:[[137,380],[371,270]],name:"Σ"},
    planeB:{type:"ABC",points:{
      A:{p2:[250,399],p1:[250,462]},
      B:{p2:[440,300],p1:[451,625]},
      C:{p2:[538,380],p1:[539,548]}
    }},
    pointK:{p2:[211,287],p1:[217,530]}
  }
});

Object.assign(window.SITEMATH_SCHEMES["17"], {
  task5:{
    planeType:"intersecting_lines",planeLines:["a","b"],
    lines:{
      a:{p2:[[150,390],[480,480]],p1:[[175,650],[371,480]]},
      b:{p2:[[80,505],[386,390]],p1:[[80,550],[448,650]]},
      l:{p2:[[133,538],[439,432]],p1:[[225,678],[500,490]]}
    },givenLine:"l"
  },
  task6:{
    planeA:{type:"parallel_lines",lines:{
      a:{p2:[[54,481],[250,350]],p1:[[56,551],[329,567]]},
      b:{p2:[[108,523],[333,365]],p1:[[61,615],[327,624]]}
    }},
    planeB:{type:"intersecting_lines",lines:{
      c:{p2:[[402,351],[582,524]],p1:[[399,691],[582,582]]},
      h:{p2:[[349,461],[580,475]],p1:[[351,650],[583,600]]}
    }},
    pointK:{p2:[170,359],p1:[170,666]}
  }
});

Object.assign(window.SITEMATH_SCHEMES["18"], {
  task5:{
    planeType:"ABC",
    points:{
      A:{p2:[49,282],p1:[48,424]},
      B:{p2:[197,214],p1:[184,373]},
      C:{p2:[299,341],p1:[299,494]}
    },
    lines:{l:{p2:[[49,283],[299,283]],p1:[[75,374],[292,494]]}},
    givenLine:"l"
  },
  task6:{
    planeA:{type:"intersecting_lines",lines:{
      a:{p2:[[117,219],[310,341]],p1:[[73,392],[276,443]]},
      b:{p2:[[80,322],[268,232]],p1:[[73,442],[272,399]]}
    }},
    planeB:{type:"intersecting_lines",lines:{
      c:{p2:[[302,237],[461,300]],p1:[[300,365],[461,449]]},
      d:{p2:[[302,286],[461,255]],p1:[[286,418],[462,397]]}
    }},
    pointK:{p2:[47,263],p1:[48,480]}
  }
});


Object.assign(window.SITEMATH_DATA.variants, {
  "13": {
    label:"Вариант 13",
    task1:{
      A:[60,-50,-30], B:[40,-10,50], C:[30,50,40], D:[40,-50,0], E:[45,0,15]
    },
    task2:{A:[0,50,40],B:[40,10,50]},
    task3:{A:[60,-50,30],B:[40,-10,50],C:[10,50,40]},
    task4:{
      statement:"В пл. Σ(a∥b) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ ∥ горизонтали. Построить т. A над плоскостью Σ.",
      plane:"a∥b",operation:"line_parallel_horizontal",pointRelation:"above_plane"
    },
    task5:{
      statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∩b) и определить видимость прямой относительно пл. Σ.",
      plane:"a∩b"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(a∩b) и пл. Θ(A;h). Через т. K провести прямую ∥ обеим плоскостям.",
      planes:["a∩b","A;h"]
    }
  },
  "19": {
    label:"Вариант 19",
    task1:{
      A:[40,25,30], B:[20,45,-10], C:[30,-50,20], D:[50,-20,50], E:[60,10,0]
    },
    task2:{A:[80,30,50],B:[20,-40,-10]},
    task3:{A:[40,25,30],B:[5,45,-10],C:[30,-50,20]},
    task4:{
      statement:"В пл. Σ(a∩b) построить горизонталь, фронталь и линию наибольшего ската. Через т. B провести прямую ℓ ∥ пл. Σ. Построить т. A перед пл. Σ.",
      plane:"a∩b",operation:"line_parallel_plane",pointRelation:"front_of_plane"
    },
    task5:{
      statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∥b) и определить видимость прямой относительно плоскости.",
      plane:"a∥b"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(a∩b) и пл. Ω(ABC). Через т. K провести прямую ℓ ∥ обеим плоскостям.",
      planes:["a∩b","ABC"]
    }
  }
});

Object.assign(window.SITEMATH_SCHEMES, {
  "13": {
    // 14.10.2026: exact line directions retraced from the university
    // six-task album, scanned page "В. 13" (private source).
    task4:{
      planeType:"parallel_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[796,1091],[1073,956]],p1:[[872,1148],[1169,1243]]},
        b:{p2:[[901,1116],[1208,969]],p1:[[773,1180],[1022,1262]]}
      },
      points:{D:{p2:[1288,989],p1:[1281,1203]}},
      operation:{type:"line_parallel_horizontal",through:"D",resultPoint:"A",relation:"above_plane"}
    },
    task5:{
      planeType:"intersecting_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[295,1600],[581,1724]],p1:[[275,1947],[519,1797]]},
        b:{p2:[[250,1776],[534,1566]],p1:[[281,1807],[599,1921]]},
        l:{p2:[[184,1770],[610,1644]],p1:[[209,1910],[605,1910]]}
      },
      givenLine:"l"
    },
    task6:{
      planeA:{type:"intersecting_lines",lines:{
        a:{p2:[[826,1675],[1065,1677]],p1:[[826,1814],[1065,1814]]},
        b:{p2:[[826,1750],[1040,1594]],p1:[[828,1764],[1047,1864]]}
      }},
      planeB:{type:"line_point",lineName:"h",pointName:"A",lines:{
        h:{p2:[[1095,1639],[1327,1643]],p1:[[1116,1828],[1307,1727]]}
      },points:{A:{p2:[1217,1557],p1:[1219,1711]}}},
      pointK:{p2:[1095,1593],p1:[1096,1930]}
    }
  },
  "19": {
    task4:{
      planeType:"intersecting_lines",
      planeLines:["a","b"],
      lines:{
        a:{p2:[[500,610],[690,545]],p1:[[500,720],[705,755]]},
        b:{p2:[[515,545],[690,625]],p1:[[515,700],[705,790]]}
      },
      points:{B:{p2:[775,565],p1:[775,755]}},
      operation:{type:"line_parallel_plane",through:"B",resultPoint:"A",relation:"front_of_plane"}
    },
    task5:{
      planeType:"parallel_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[280,935],[485,875]],p1:[[285,1070],[505,1125]]},
        b:{p2:[[290,975],[495,915]],p1:[[285,1110],[490,1160]]},
        l:{p2:[[320,895],[510,990]],p1:[[315,1030],[515,1090]]}
      },
      givenLine:"l"
    },
    task6:{
      planeA:{type:"intersecting_lines",lines:{
        a:{p2:[[500,960],[690,915]],p1:[[495,1125],[700,1045]]},
        b:{p2:[[505,925],[690,980]],p1:[[500,1090],[700,1075]]}
      }},
      planeB:{type:"ABC",points:{
        A:{p2:[735,905],p1:[735,1120]},
        B:{p2:[800,980],p1:[800,1055]},
        C:{p2:[885,985],p1:[885,1150]}
      }},
      pointK:{p2:[650,930],p1:[650,1140]}
    }
  }
});


Object.assign(window.SITEMATH_DATA.variants, {
  "03": {
    label:"Вариант 3",
    task1:{
      A:[40,30,-15], B:[25,-30,60], C:[30,65,40], D:[50,0,0], E:[30,50,0]
    },
    task2:{A:[70,20,-60],B:[10,20,45]},
    task3:{A:[40,30,-15],B:[25,30,-60],C:[0,65,40]},
    task4:{
      statement:"В плоскости Σ(a∥b) построить горизонталь, фронталь и линию наибольшего ската. Через т. A провести прямую ℓ, пересекающую прямую a. Построить т. B под пл. Σ.",
      plane:"a∥b",operation:"line_intersects_a",pointRelation:"below_plane"
    },
    task5:{
      statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∩f) и определить видимость прямой относительно пл. Σ.",
      plane:"a∩f"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(ABC) и пл. Θ(a∩b). Через т. K провести прямую ∥ обеим плоскостям.",
      planes:["ABC","a∩b"]
    }
  },
  "06": {
    label:"Вариант 6",
    task1:{
      A:[10,20,45], B:[25,20,0], C:[20,-25,-35], D:[45,0,55], E:[40,30,15]
    },
    task2:{A:[15,-40,-50],B:[55,-30,30]},
    task3:{A:[10,20,-45],B:[45,20,0],C:[20,-25,-10]},
    task4:{
      statement:"В пл. Δ(m∥n) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ ∥ Δ. Взять т. A перед прямой ℓ.",
      plane:"m∥n",operation:"line_parallel_plane",pointRelation:"front_of_line"
    },
    task5:{
      statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∩b) и определить видимость прямой относительно пл. Σ(a∩b).",
      plane:"a∩b"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(a∩b) и пл. Β(ABC). Через т. K провести прямую ∥ обеим плоскостям.",
      planes:["a∩b","ABC"]
    }
  },
  "09": {
    label:"Вариант 9",
    task1:{
      A:[25,40,0], B:[40,60,-20], C:[20,-25,60], D:[57,40,0], E:[40,0,10]
    },
    task2:{A:[20,15,25],B:[73,40,60]},
    task3:{A:[25,40,0],B:[40,60,-20],C:[10,-25,60]},
    task4:{
      statement:"В пл. Δ(A;b) построить горизонталь, фронталь и линию наибольшего ската. Через т. B провести прямую ℓ ∥ горизонтали. Построить т. E под прямой ℓ.",
      plane:"A;b",operation:"line_parallel_horizontal",pointRelation:"below_line"
    },
    task5:{
      statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∥b) и определить видимость прямой ℓ относительно пл. Σ.",
      plane:"a∥b"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(a∩b) и пл. Θ(h∥h′). Через т. K провести прямую ∥ обеим плоскостям.",
      planes:["a∩b","h∥h′"]
    }
  }
});

Object.assign(window.SITEMATH_SCHEMES, {
  "03": {
    task4:{
      planeType:"parallel_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[170,115],[355,170]],p1:[[168,255],[360,242]]},
        b:{p2:[[178,150],[350,205]],p1:[[172,287],[360,273]]}
      },
      points:{A:{p2:[92,104],p1:[92,270]}},
      sourceVerified:false,
      operation:{type:"line_intersects_named",through:"A",target:"a",resultPoint:"B",relation:"below_plane"}
    },
    task5:{
      planeType:"intersecting_lines",planeLines:["a","f"],
      lines:{
        f:{p2:[[170,95],[335,185]],p1:[[155,300],[345,303]]},
        a:{p2:[[185,190],[335,105]],p1:[[165,355],[330,250]]},
        l:{p2:[[160,205],[350,150]],p1:[[150,320],[350,390]]}
      },
      givenLine:"l",sourceVerified:false
    },
    task6:{
      planeA:{type:"ABC",points:{
        A:{p2:[115,140],p1:[115,315]},
        B:{p2:[240,82],p1:[240,255]},
        C:{p2:[335,155],p1:[335,355]}
      }},
      planeB:{type:"intersecting_lines",lines:{
        a:{p2:[[390,105],[540,185]],p1:[[392,335],[540,255]]},
        b:{p2:[[410,195],[535,112]],p1:[[395,280],[540,350]]}
      }},
      pointK:{p2:[190,92],p1:[190,380]},
      sourceVerified:false
    }
  },
  "06": {
    task4:{
      planeType:"parallel_lines",planeLines:["m","n"],
      lines:{
        m:{p2:[[110,130],[330,82]],p1:[[100,250],[330,365]]},
        n:{p2:[[105,165],[330,116]],p1:[[105,215],[330,328]]}
      },
      points:{D:{p2:[420,120],p1:[420,350]}},
      sourceVerified:false,
      operation:{type:"line_parallel_plane",through:"D",resultPoint:"A",relation:"front_of_line"}
    },
    task5:{
      planeType:"intersecting_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[165,180],[350,70]],p1:[[155,330],[350,245]]},
        b:{p2:[[135,120],[300,220]],p1:[[145,260],[320,345]]},
        l:{p2:[[140,205],[365,150]],p1:[[145,290],[350,390]]}
      },
      givenLine:"l",sourceVerified:false
    },
    task6:{
      planeA:{type:"intersecting_lines",lines:{
        a:{p2:[[105,155],[285,160]],p1:[[105,305],[285,300]]},
        b:{p2:[[110,235],[275,105]],p1:[[110,350],[285,255]]}
      }},
      planeB:{type:"ABC",points:{
        A:{p2:[355,130],p1:[355,235]},
        B:{p2:[465,75],p1:[465,375]},
        C:{p2:[575,180],p1:[575,315]}
      }},
      pointK:{p2:[175,90],p1:[175,375]},
      sourceVerified:false
    }
  },
  "09": {
    task4:{
      planeType:"line_point",planeLine:"b",planePoint:"A",
      lines:{
        b:{p2:[[160,160],[325,62]],p1:[[160,230],[325,360]]}
      },
      points:{
        A:{p2:[95,102],p1:[95,315]},
        B:{p2:[410,118],p1:[410,282]}
      },
      sourceVerified:false,
      operation:{type:"line_parallel_horizontal",through:"B",resultPoint:"E",relation:"below_line"}
    },
    task5:{
      planeType:"parallel_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[125,105],[340,205]],p1:[[125,300],[345,365]]},
        b:{p2:[[105,150],[320,245]],p1:[[105,260],[330,325]]},
        l:{p2:[[110,215],[355,205]],p1:[[105,338],[355,388]]}
      },
      givenLine:"l",sourceVerified:false
    },
    task6:{
      planeA:{type:"intersecting_lines",lines:{
        a:{p2:[[105,95],[275,210]],p1:[[105,290],[285,345]]},
        b:{p2:[[115,205],[280,82]],p1:[[115,330],[285,275]]}
      }},
      planeB:{type:"parallel_lines",lines:{
        h:{p2:[[350,145],[565,145]],p1:[[350,300],[565,250]]},
        "h′":{p2:[[350,185],[565,185]],p1:[[350,345],[565,295]]}
      }},
      pointK:{p2:[430,85],p1:[430,385]},
      sourceVerified:false
    }
  }
});


/* Scanned university original: six-task album, page "В. 01" (14.10.2026).
   Raw source strokes are traced independently from any solver cleanup.
   Do not mark sourceVerified before full per-step visual verification. */
Object.assign(window.SITEMATH_DATA.variants, {
  "01": {
    label:"Вариант 01",
    task1:{ A:[25,40,0],B:[40,60,-20],C:[20,-25,60],D:[0,40,35],E:[40,0,10] },
    task2:{ A:[60,-15,50],B:[20,40,30] },
    task3:{ A:[70,50,0],B:[40,60,-20],C:[20,-25,60] },
    task4:{
      statement:"В пл. Σ(a∩b) построить горизонталь, фронталь и линию наибольшего ската. Через точку B провести прямую ℓ, параллельную пл. Σ. Построить точку A за прямой ℓ.",
      plane:"a∩b",operation:"line_parallel_plane",pointRelation:"behind_line"
    },
    task5:{
      statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∥b) и определить видимость прямой относительно пл. Σ.",
      plane:"a∥b"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(a∩b) и пл. Δ(Δ₂). Через точку K провести прямую, параллельную обеим плоскостям.",
      planes:["a∩b","projecting"]
    }
  }
});
Object.assign(window.SITEMATH_SCHEMES, {
  "01": {
    task4:{
      planeType:"intersecting_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[572,772],[716,696]],p1:[[573,801],[721,896]]},
        b:{p2:[[578,706],[727,763]],p1:[[562,855],[733,838]]}
      },
      points:{B:{p2:[813,715],p1:[814,851]}},
      junctions:[{p2:[647,733],p1:[648,847]}],
      operation:{type:"line_parallel_plane",through:"B",resultPoint:"A",relation:"behind_line"},
      sourceVerified:false
    },
    task5:{
      planeType:"parallel_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[184,1129],[364,1227]],p1:[[119,1293],[348,1330]]},
        b:{p2:[[111,1176],[327,1297]],p1:[[112,1332],[337,1366]]},
        l:{p2:[[151,1155],[333,1261]],p1:[[136,1381],[302,1297]]}
      },
      givenLine:"l",sourceVerified:false
    },
    task6:{
      planeA:{
        type:"intersecting_lines",lines:{
          a:{p2:[[583,1126],[796,1203]],p1:[[586,1233],[788,1370]]},
          b:{p2:[[606,1207],[827,1127]],p1:[[612,1336],[830,1304]]}
        },
        junctions:[{p2:[713,1173],p1:[714,1322]}]
      },
      planeB:{type:"frontal_projecting",projection:"p2",line:[[658,1211],[859,1182]],name:"Δ"},
      pointK:{p2:[871,1197],p1:[877,1374]},sourceVerified:false
    }
  }
});

/* University album source, page "В. 16", 14.10.2026.
   Do not conflate C.z=-33 in task 1 with C.z=-35 in task 3. */
Object.assign(window.SITEMATH_DATA.variants, {
  "16": {
    label:"Вариант 16",
    task1:{ A:[10,20,-45], B:[25,20,0], C:[20,-25,-33], D:[55,-30,30], E:[25,20,10] },
    task2:{ A:[15,-40,-50], B:[55,-30,30] },
    task3:{ A:[15,-40,-50], B:[55,-30,30], C:[20,-25,-35] },
    task4:{
      statement:"В пл. Δ(ABC) построить горизонталь, фронталь и линию наибольшего ската. Через точку D провести прямую ℓ, пересекающую горизонталь. Построить точку E за прямой ℓ.",
      plane:"ABC", operation:"line_intersects_horizontal",pointRelation:"behind_line"
    },
    task5:{
      statement:"Построить точку пересечения прямой ℓ с пл. Σ(ABC) и определить видимость прямой относительно пл. Σ.",
      plane:"ABC"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(a∥b) и пл. Θ(c∥d). Через точку K провести прямую, параллельную обеим плоскостям.",
      planes:["a∥b","c∥d"]
    }
  }
});
Object.assign(window.SITEMATH_SCHEMES, {
  "16": {
    task4:{
      planeType:"ABC",
      points:{
        A:{p2:[632,681],p1:[633,778]},
        B:{p2:[706,624],p1:[707,825]},
        C:{p2:[778,715],p1:[777,740]},
        D:{p2:[856,643],p1:[856,820]}
      },
      operation:{type:"line_intersects_horizontal",through:"D",resultPoint:"E",relation:"behind_line"},
      sourceVerified:false
    },
    task5:{
      planeType:"ABC",
      points:{
        A:{p2:[255,1082],p1:[257,1260]},
        B:{p2:[322,1046],p1:[321,1146]},
        C:{p2:[433,1128],p1:[433,1189]}
      },
      lines:{l:{p2:[[209,1146],[435,1047]],p1:[[228,1184],[457,1260]]}},
      givenLine:"l",sourceVerified:false
    },
    task6:{
      planeA:{type:"parallel_lines",lines:{
        a:{p2:[[793,1138],[966,1040]],p1:[[792,1235],[965,1256]]},
        b:{p2:[[801,1182],[969,1087]],p1:[[801,1207],[972,1281]]}
      }},
      planeB:{type:"parallel_lines",lines:{
        c:{p2:[[590,1058],[760,1143]],p1:[[586,1306],[752,1247]]},
        d:{p2:[[566,1118],[731,1197]],p1:[[574,1278],[742,1217]]}
      }},
      pointK:{p2:[663,1037],p1:[661,1313]},sourceVerified:false
    }
  }
});

/* University album source, page "В. 02", 14.10.2026.
   Task 4: BC is a triangle EDGE, not an extra printed named line.
   The solver-only reference BC is installed AFTER raw source preservation. */
Object.assign(window.SITEMATH_DATA.variants, {
  "02": {
    label:"Вариант 02",
    task1:{ A:[35,30,0],B:[30,40,20],C:[50,-30,-60],D:[60,0,45],E:[0,45,35] },
    task2:{ A:[20,-40,10],B:[35,-30,40] },
    task3:{ A:[5,30,0],B:[45,-30,40],C:[25,20,15] },
    task4:{
      statement:"В пл. Σ(ABC) построить горизонталь, фронталь и линию наибольшего ската. Через точку D провести прямую ℓ, пересекающую BC. Построить точку E под прямой ℓ.",
      plane:"ABC",operation:"line_intersects_BC",pointRelation:"below_line"
    },
    task5:{
      statement:"Построить точку пересечения прямой ℓ с пл. Σ(A;a) и определить видимость прямой относительно пл. Σ.",
      plane:"A;a"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(ABC) и пл. Θ(a∥b). Через точку K провести прямую, параллельную обеим плоскостям.",
      planes:["ABC","a∥b"]
    }
  }
});
Object.assign(window.SITEMATH_SCHEMES, {
  "02": {
    task4:{
      planeType:"ABC",points:{
        A:{p2:[700,735],p1:[700,816]},
        B:{p2:[774,649],p1:[775,793]},
        C:{p2:[844,724],p1:[848,894]},
        D:{p2:[951,686],p1:[953,822]}
      },
      operation:{type:"line_intersects_named",target:"BC",through:"D",resultPoint:"E",relation:"below_line"},
      sourceVerified:false
    },
    task5:{
      planeType:"line_point",planeLine:"a",planePoint:"A",
      points:{A:{p2:[235,1198],p1:[237,1379]}},
      lines:{
        a:{p2:[[139,1223],[336,1115]],p1:[[145,1301],[305,1253]]},
        l:{p2:[[185,1132],[328,1203]],p1:[[160,1322],[342,1290]]}
      },givenLine:"l",sourceVerified:false
    },
    task6:{
      planeA:{type:"ABC",points:{
        A:{p2:[617,1165],p1:[619,1277]},
        B:{p2:[691,1123],p1:[690,1363]},
        C:{p2:[770,1240],p1:[773,1310]}
      }},
      planeB:{type:"parallel_lines",lines:{
        a:{p2:[[779,1152],[931,1182]],p1:[[782,1296],[932,1267]]},
        b:{p2:[[775,1197],[926,1226]],p1:[[784,1340],[919,1315]]}
      }},
      pointK:{p2:[869,1120],p1:[867,1365]},sourceVerified:false
    }
  }
});

/* University album original "В. 20", 14.10.2026.
   Different signs of A.z in tasks 1 and 3 are genuine paper data.
   Task 5 given line is f; task 6 uses the ORIGINAL vertex names D,E,F. */
Object.assign(window.SITEMATH_DATA.variants, {
  "20": {
    label:"Вариант 20",
    task1:{ A:[70,30,-45],B:[35,-40,20],C:[40,-20,-40],D:[30,20,0],E:[50,0,45] },
    task2:{ A:[80,30,50],B:[20,-40,-10] },
    task3:{ A:[70,30,45],B:[35,-40,20],C:[0,-20,-40] },
    task4:{
      statement:"В пл. Σ(ABC) построить горизонталь, фронталь и линию наибольшего ската. Через точку D провести прямую ℓ, параллельную пл. Σ. Построить точку E под прямой ℓ.",
      plane:"ABC",operation:"line_parallel_plane",pointRelation:"below_line"
    },
    task5:{
      statement:"Построить точку пересечения прямой f с пл. Σ(a∩b) и определить видимость прямой относительно пл. Σ.",
      plane:"a∩b"
    },
    task6:{
      statement:"Построить линию пересечения пл. Σ(ABC) и пл. Θ(DEF). Через точку K провести прямую, параллельную обеим плоскостям.",
      planes:["ABC","DEF"]
    }
  }
});
Object.assign(window.SITEMATH_SCHEMES, {
  "20": {
    task4:{
      planeType:"ABC",points:{
        A:{p2:[540,638],p1:[540,854]},
        B:{p2:[691,699],p1:[691,785]},
        C:{p2:[754,673],p1:[754,833]},
        D:{p2:[911,693],p1:[910,852]}
      },
      // The horizontal reference across the projectors is PRINTED on page 20.
      sourceGuides:[[[540,748],[940,748]]],
      operation:{type:"line_parallel_plane",through:"D",resultPoint:"E",relation:"below_line"},
      sourceVerified:false
    },
    task5:{
      planeType:"intersecting_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[95,1191],[293,1104]],p1:[[83,1241],[330,1345]]},
        b:{p2:[[134,1124],[326,1231]],p1:[[114,1333],[238,1219]]},
        f:{p2:[[166,1220],[367,1129]],p1:[[92,1313],[384,1332]]}
      },
      junctions:[{p2:[180,1149],p1:[175,1278]}],
      givenLine:"f",sourceVerified:false
    },
    task6:{
      planeA:{type:"ABC",points:{
        A:{p2:[717,1210],p1:[715,1334]},
        B:{p2:[773,1094],p1:[774,1217]},
        C:{p2:[876,1154],p1:[877,1310]}
      }},
      // Three given vertices are D, E, F, not renamed A/B/C.
      planeB:{type:"ABC",name:"Θ",points:{
        D:{p2:[669,1190],p1:[670,1244]},
        E:{p2:[802,1157],p1:[801,1337]},
        F:{p2:[868,1133],p1:[862,1251]}
      }},
      pointK:{p2:[701,1128],p1:[698,1308]},sourceVerified:false
    }
  }
});

/* Variant 12 re-traced from the original photographed sheet.
   Keep exact source topology: named points, projectors and line junctions. */
Object.assign(window.SITEMATH_SCHEMES["12"], {
  task4:{
    planeType:"intersecting_lines",
    planeLines:["a","b"],
    lines:{
      a:{p2:[[162.309,371.433],[351.309,257.433]],p1:[[112.635,441.639],[341.635,492.639]]},
      b:{p2:[[124.138,272.459],[319.138,377.459]],p1:[[101.865,386.997],[321.865,524.997]]}
    },
    lineLabels:{
      a:{p2:[353,253],p1:[104,438]},
      b:{p2:[323,376],p1:[95,382]}
    },
    points:{D:{p2:[446,296],p1:[446,501]}},
    junctions:[{p2:[231,330],p1:[231,468]}],
    sourceVerified:true,
    sourceAvailable:true,
    sourceId:"IMG_20260917_131638",
    operation:{type:"line_intersects_named",through:"D",target:"a",resultPoint:"A",relation:"behind_line"}
  },
  task5:{
    planeType:"ABC",
    points:{
      A:{p2:[269,181],p1:[264,458]},
      B:{p2:[472,128],p1:[470,353]},
      C:{p2:[529,231],p1:[523,463]}
    },
    lines:{
      l:{p2:[[217,235],[557,161]],p1:[[226,354],[537,507]]}
    },
    lineLabels:{l:{p2:[208,236],p1:[216,354]}},
    givenLine:"l",
    sourceVerified:true,
    sourceAvailable:true,
    sourceId:"IMG_20260917_131638"
  },
  task6:{
    planeA:{type:"parallel_lines",lines:{
      a:{p2:[[22,227],[305,143]],p1:[[71,325],[337,404]]},
      b:{p2:[[63,277],[352,193]],p1:[[20,377],[306,449]]}
    },lineLabels:{
      a:{p2:[14,228],p1:[63,323]},
      b:{p2:[55,278],p1:[12,376]}
    }},
    planeB:{type:"intersecting_lines",lines:{
      h:{p2:[[367.008,231.167],[571.008,233.167]],p1:[[388.269,326.565],[569.269,438.565]]},
      f:{p2:[[391.796,274.908],[572.796,145.908]],p1:[[364.999,365.151],[569.999,367.151]]}
    },lineLabels:{
      h:{p2:[575,233],p1:[572,440]},
      f:{p2:[576,145],p1:[573,367]}
    },junctions:[{p2:[452,232],p1:[452,366]}]},
    pointK:{p2:[196,116],p1:[199,465]},
    sourceVerified:true,
    sourceAvailable:true,
    sourceId:"IMG_20260917_131638"
  }
});

/* Preserve the traced paper drawing before any mathematical regularization.
   The source frame must stay faithful to the photographed sheet. Solvers may
   use cleaned geometry internally, but the user's copied givens must not move
   just because a trace is slightly skewed by photo perspective. */
(function preserveTracedSourceGeometry(){
  const clone=value=>JSON.parse(JSON.stringify(value));
  Object.values(window.SITEMATH_SCHEMES||{}).forEach(group=>{
    [4,5,6].forEach(task=>{
      const scheme=group&&group['task'+task];
      if(!scheme||scheme.sourceGeometry)return;
      scheme.sourceGeometry=clone(scheme);
    });
  });
})();

/* Variant 02 / task 4: BC already appears as the printed edge of ABC.
   The extra solver reference is deliberately absent from sourceGeometry, so
   the first frame neither duplicates BC nor invents an extra line label. */
(function referenceExistingTriangleEdge02(){
  const scheme=window.SITEMATH_SCHEMES?.["02"]?.task4;
  if(!scheme) return;
  const B=scheme.points.B,C=scheme.points.C;
  scheme.lines={BC:{p1:[B.p1.slice(),C.p1.slice()],p2:[B.p2.slice(),C.p2.slice()]}};
})();

/* Mathematical cleanup of photographed traces.
   If a plane is explicitly defined by parallel lines, both displayed
   projections of those lines must be parallel. Old hand digitization can
   differ by several degrees even though the printed condition is a∥b.
   Preserve each segment midpoint/length and only regularize its direction. */
(function normalizeDeclaredParallelLines(){
  const normalizeProjection=(A,B,proj)=>{
    const sa=A?.[proj],sb=B?.[proj];
    if(!sa||!sb||sa.length<2||sb.length<2)return;
    const vec=seg=>{
      const dx=+seg[1][0]-+seg[0][0],dy=+seg[1][1]-+seg[0][1];
      const len=Math.hypot(dx,dy);
      return len>1e-9?{x:dx/len,y:dy/len,len}:null;
    };
    const ua=vec(sa),ub0=vec(sb);
    if(!ua||!ub0)return;
    let ub=ub0;
    if(ua.x*ub.x+ua.y*ub.y<0) ub={x:-ub.x,y:-ub.y,len:ub.len};
    let ax=ua.x+ub.x,ay=ua.y+ub.y;
    const al=Math.hypot(ax,ay);
    if(al<1e-9)return;
    ax/=al;ay/=al;
    const rebuild=(seg,len)=>{
      const mx=(+seg[0][0]+ +seg[1][0])/2;
      const my=(+seg[0][1]+ +seg[1][1])/2;
      const hx=ax*len/2,hy=ay*len/2;
      seg[0]=[mx-hx,my-hy];
      seg[1]=[mx+hx,my+hy];
    };
    rebuild(sa,ua.len);
    rebuild(sb,ub0.len);
  };
  const normalizeDef=def=>{
    if(!def)return;
    const type=def.planeType||def.type;
    if(type!=='parallel_lines'||!def.lines)return;
    const names=def.planeLines||Object.keys(def.lines).slice(0,2);
    const A=def.lines[names[0]],B=def.lines[names[1]];
    if(!A||!B)return;
    normalizeProjection(A,B,'p1');
    normalizeProjection(A,B,'p2');
  };
  Object.values(window.SITEMATH_SCHEMES||{}).forEach(group=>{
    [4,5,6].forEach(task=>{
      const scheme=group&&group['task'+task];
      if(!scheme)return;
      if(task===6){
        normalizeDef(scheme.planeA);
        normalizeDef(scheme.planeB);
      }else{
        normalizeDef(scheme);
      }
    });
  });
})();

/* Mathematical cleanup of declared intersecting-line planes.
   For true intersecting spatial lines, the intersections of their first and
   second projections must lie on one projector (the same x). Photo perspective
   and rough tracing can break that condition, sometimes pushing one computed
   intersection thousands of units away. We keep every source segment's slope
   and x-span, and only apply the smallest vertical translations needed to make
   both projected intersections share one x. */
(function normalizeDeclaredIntersectingLines(){
  const hit=(A,B)=>{
    if(!A||!B||A.length<2||B.length<2)return null;
    const [a,b]=A,[c,d]=B;
    const den=(a[0]-b[0])*(c[1]-d[1])-(a[1]-b[1])*(c[0]-d[0]);
    if(Math.abs(den)<1e-9)return null;
    return {
      x:((a[0]*b[1]-a[1]*b[0])*(c[0]-d[0])-(a[0]-b[0])*(c[0]*d[1]-c[1]*d[0]))/den,
      y:((a[0]*b[1]-a[1]*b[0])*(c[1]-d[1])-(a[1]-b[1])*(c[0]*d[1]-c[1]*d[0]))/den
    };
  };
  const lineY=(seg,x)=>{
    const dx=+seg[1][0]-+seg[0][0];
    if(Math.abs(dx)<1e-9)return (+seg[0][1]+ +seg[1][1])/2;
    return +seg[0][1]+(+seg[1][1]-+seg[0][1])*(x-+seg[0][0])/dx;
  };
  const reasonable=(x,A,B)=>{
    const xs=[...A,...B].map(p=>+p[0]).filter(Number.isFinite);
    if(!xs.length||!Number.isFinite(x))return false;
    const lo=Math.min(...xs),hi=Math.max(...xs),span=Math.max(20,hi-lo);
    return x>=lo-span*.65 && x<=hi+span*.65;
  };
  const shiftPairToX=(A,B,x,targetY)=>{
    if(!Number.isFinite(x))return;
    const ya=lineY(A,x),yb=lineY(B,x);
    if(!Number.isFinite(ya)||!Number.isFinite(yb))return;
    const y=Number.isFinite(targetY)?targetY:(ya+yb)/2;
    const da=y-ya,db=y-yb;
    for(const p of A)p[1]=+p[1]+da;
    for(const p of B)p[1]=+p[1]+db;
  };
  const normalizeDef=def=>{
    if(!def)return;
    const type=def.planeType||def.type;
    if(type!=='intersecting_lines'||!def.lines)return;
    const names=def.planeLines||Object.keys(def.lines).slice(0,2);
    const A=def.lines[names[0]],B=def.lines[names[1]];
    if(!A||!B)return;
    const h1=hit(A.p1,B.p1),h2=hit(A.p2,B.p2);
    const explicit=def.junctions&&def.junctions.length?def.junctions[0]:null;
    let x;
    if(explicit?.p1&&explicit?.p2){
      x=(+explicit.p1[0]+ +explicit.p2[0])/2;
    }else{
      const r1=h1&&reasonable(h1.x,A.p1,B.p1);
      const r2=h2&&reasonable(h2.x,A.p2,B.p2);
      if(r1&&r2)x=(h1.x+h2.x)/2;
      else if(r1)x=h1.x;
      else if(r2)x=h2.x;
      else{
        const xs=[...A.p1,...B.p1,...A.p2,...B.p2].map(p=>+p[0]).filter(Number.isFinite).sort((a,b)=>a-b);
        if(!xs.length)return;
        x=xs[Math.floor(xs.length/2)];
      }
    }
    shiftPairToX(A.p1,B.p1,x,explicit?.p1?+explicit.p1[1]:null);
    shiftPairToX(A.p2,B.p2,x,explicit?.p2?+explicit.p2[1]:null);
    if(explicit?.p1&&explicit?.p2){
      explicit.p1[0]=x;
      explicit.p2[0]=x;
    }
  };
  Object.values(window.SITEMATH_SCHEMES||{}).forEach(group=>{
    [4,5,6].forEach(task=>{
      const scheme=group&&group['task'+task];
      if(!scheme)return;
      if(task===6){
        normalizeDef(scheme.planeA);
        normalizeDef(scheme.planeB);
      }else{
        normalizeDef(scheme);
      }
    });
  });
})();

/* Preserve the actual plane symbols from each paper variant. These symbols
   are used by the construction labels too; a second plane is not always Θ. */
(function assignTask4PlaneNames(){
  const names={
    "03":"Σ","04":"Σ","05":"Σ","06":"Δ","07":"Σ","08":"Σ",
    "09":"Δ","10":"Σ","11":"Σ","12":"Σ","13":"Σ","14":"Σ",
    "15":"Σ","17":"Σ","18":"Σ","19":"Σ"
  };
  Object.entries(names).forEach(([variant,name])=>{
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task4;
    if(!scheme)return;
    scheme.name=name;
    if(scheme.sourceGeometry) scheme.sourceGeometry.name=name;
  });
})();

(function assignTask6PlaneNames(){
  const names={
    "03":["Σ","Θ"], "04":["Σ","Θ"], "05":["Σ","Θ"], "06":["Σ","Β"],
    "07":["Σ","Ω"], "08":["Σ","Δ"], "09":["Σ","Θ"], "10":["Σ","Θ"],
    "11":["Σ","Γ"], "12":["Σ","Θ"], "13":["Σ","Θ"], "14":["Σ","Ω"],
    "15":["Σ","Θ"], "17":["Σ","Θ"], "18":["Σ","Θ"], "19":["Σ","Ω"]
  };
  Object.entries(names).forEach(([variant,pair])=>{
    const scheme=window.SITEMATH_SCHEMES?.[variant]?.task6;
    if(!scheme)return;
    if(scheme.planeA) scheme.planeA.name=pair[0];
    if(scheme.planeB) scheme.planeB.name=pair[1];
    if(scheme.sourceGeometry?.planeA) scheme.sourceGeometry.planeA.name=pair[0];
    if(scheme.sourceGeometry?.planeB) scheme.sourceGeometry.planeB.name=pair[1];
  });
})();

/* Paper-sheet corrections from the full-resolution originals supplied on
   2026-10-13. These are corrections to the actual source geometry, not UI
   annotations. Keep the photographic trace and regularized working model in
   agreement while preserving the given point and line identities. */
(function correctPhotographedSchemes(){
  const v06=window.SITEMATH_SCHEMES["06"]?.task4;
  if(v06){
    // IMG 1000022471.jpg: n₂ is the upper frontal line, m₂ the lower.
    // The first projections were already correctly attributed:
    // n₁ upper, m₁ lower. The old model had ONLY p2 swapped.
    [v06,v06.sourceGeometry].filter(Boolean).forEach(s=>{
      if(s.lines?.m?.p2 && s.lines?.n?.p2){
        const frontalM=s.lines.m.p2;
        s.lines.m.p2=s.lines.n.p2;
        s.lines.n.p2=frontalM;
      }
    });
  }

  const v03t5=window.SITEMATH_SCHEMES["03"]?.task5;
  if(v03t5){
    // Paper 1000022472.jpg: a₂ falls to the right, f₂ rises to the
    // right, while their first projections were already correctly assigned.
    [v03t5,v03t5.sourceGeometry].filter(Boolean).forEach(s=>{
      if(s.lines?.a?.p2 && s.lines?.f?.p2){
        const oldA=s.lines.a.p2;
        s.lines.a.p2=s.lines.f.p2;
        s.lines.f.p2=oldA;
      }
    });
  }

  const v05t5=window.SITEMATH_SCHEMES["05"]?.task5;
  if(v05t5){
    // 1000022482.jpg: a₂ descends right, f₂ rises right. Previously their
    // second projections were assigned to the opposite spatial lines.
    // The given ℓ₁ also descends right; its old trace ascended instead.
    [v05t5,v05t5.sourceGeometry].filter(Boolean).forEach(model=>{
      if(model.lines?.a?.p2 && model.lines?.f?.p2){
        const oldA=model.lines.a.p2;
        model.lines.a.p2=model.lines.f.p2;
        model.lines.f.p2=oldA;
      }
      if(model.lines?.l?.p1)
        model.lines.l.p1=[[88,285],[287,350]];
    });
  }

  const v03t6=window.SITEMATH_SCHEMES["03"]?.task6;
  if(v03t6){
    // On 1000022481.jpg the right plane Θ is specified by a₂ rising
    // right and b₂ descending right. Its first projections were correct.
    [v03t6,v03t6.sourceGeometry].filter(Boolean).forEach(model=>{
      const lines=model.planeB?.lines;
      if(lines?.a?.p2 && lines?.b?.p2){
        const oldA=lines.a.p2;
        lines.a.p2=lines.b.p2;
        lines.b.p2=oldA;
      }
    });
  }

  const v06t5=window.SITEMATH_SCHEMES["06"]?.task5;
  if(v06t5){
    // The original 1000022471.jpg has steeply falling b₂ and a
    // descending-to-the-right ℓ₂. The archived generic geometry incorrectly
    // gave ℓ₂ a rising direction and made b₂ far too shallow.
    // Copy the manually re-traced six projected strokes as a single group;
    // preserve both the photographed and computational models.
    const actual={
      a:{p2:[[180,205],[390,86]],p1:[[210,307],[370,273]]},
      b:{p2:[[249,72],[346,230]],p1:[[214,248],[380,333]]},
      l:{p2:[[195,157],[398,220]],p1:[[135,292],[283,353]]}
    };
    [v06t5,v06t5.sourceGeometry].filter(Boolean).forEach(s=>{
      Object.entries(actual).forEach(([name,rec])=>{
        if(s.lines?.[name])
          s.lines[name]={
            p1:rec.p1.map(p=>p.slice()),
            p2:rec.p2.map(p=>p.slice())
          };
      });
      // Exact-Monge mathematical model: compensate the small x-disagreement
      // between photographed a₁∩b₁ and a₂∩b₂ without altering the first frame.
      if(s===v06t5 && s.lines?.b){
        s.lines.b.p1.forEach(p=>p[1]+=1.8028544);
      }
    });
  }

  // Both original sheets 03/5 and 06/5 have a thin projector from
  // the intersection of the source-defining lines on Π₂ to Π₁. They were
  // silently omitted in the earlier transcription.
  // f₁ of 03 is a frontal projection: enforce exact horizontality for the
  // solver while keeping the original photographed slight skew in the raw.
  if(v03t5?.lines?.f?.p1){
    const p=v03t5.lines.f.p1;
    const level=(p[0][1]+p[1][1])/2;
    p[0][1]=level;
    p[1][1]=level;
  }
  const projectedCross=(A,B)=>{
    const [p,q]=A,[r,t]=B;
    const det=(a,b)=>a[0]*b[1]-a[1]*b[0];
    const den=(p[0]-q[0])*(r[1]-t[1])-(p[1]-q[1])*(r[0]-t[0]);
    if(Math.abs(den)<1e-9)return null;
    return [
      (det(p,q)*(r[0]-t[0])-(p[0]-q[0])*det(r,t))/den,
      (det(p,q)*(r[1]-t[1])-(p[1]-q[1])*det(r,t))/den
    ];
  };
  // 1000022482.jpg, task 6: the intersection of a and b in Θ
  // is joined by a faint PRE-PRINTED projector. It belongs to the
  // original givens, not to the later solution. The photographed x
  // coordinates differ by ~1.2 source px; keep that raster discrepancy in
  // sourceGeometry while the solver's already reconciled copy stays exact.
  const v05t6=window.SITEMATH_SCHEMES["05"]?.task6;
  if(v05t6){
    for(const model of [v05t6,v05t6.sourceGeometry].filter(Boolean)){
      const A=model.planeB?.lines?.a,B=model.planeB?.lines?.b;
      if(!A||!B)continue;
      const p1=projectedCross(A.p1,B.p1),p2=projectedCross(A.p2,B.p2);
      if(p1&&p2)model.planeB.junctions=[{p1,p2}];
    }
  }

  // Additional pencil-thin projectors visibly printed beside the
  // intersecting plane-defining lines on these archived full sheets:
  // 04: 1000022483; 06: 1000022471; 09: 1000022475; 10: 1000022486;
  // 17: 1000022485; 18: 1000022474 (BOTH planes).
  // From the enlarged ORIGINAL photographs, these seven crossing
  // projectors are printed straight/vertical. Earlier digitization had
  // 4.8–13.9 units of artificial horizontal mismatch between their two
  // crossings. Correct ONLY the explicitly listed source strokes below:
  // split the minimum vertical shift across each pair of lines (at most
  // 5 source-coordinate units per endpoint). Keep endpoint X, slopes, all
  // unrelated given lines, photographed JPGs and solver data untouched.
  // Solver-only pencil construction marker, not part of the printed
  // sourceGeometry: 06/6 needs a near transversal g=TU inside Σ(a,b).
  // Solver-only: select the nearer given frontal endpoint for 04/6 g.
  window.SITEMATH_SCHEMES["04"].task6.planeB.shortBridgeEndpoint=true;
  window.SITEMATH_SCHEMES["06"].task6.planeA.auxBridge='a-b';

  const task6PrintedCrossingProjectors=[
    ["04","planeB","h","f"],
    ["06","planeA","a","b"],
    ["09","planeA","a","b"],
    ["10","planeB","h","f"],
    ["17","planeB","c","h"],
    ["18","planeA","a","b"],
    ["18","planeB","c","d"]
  ];
  for(const [variant,plane,a,b] of task6PrintedCrossingProjectors){
    const scheme=window.SITEMATH_SCHEMES[variant]?.task6;
    if(!scheme)continue;
    const original=scheme.sourceGeometry?.[plane];
    const lineA=original?.lines?.[a],lineB=original?.lines?.[b];
    if(lineA&&lineB){
      const first=projectedCross(lineA.p1,lineB.p1);
      const second=projectedCross(lineA.p2,lineB.p2);
      if(first&&second&&Math.abs(first[0]-second[0])>4){
        const x=(first[0]+second[0])/2;
        const yAt=(seg)=>seg[0][1]+(seg[1][1]-seg[0][1])*
          (x-seg[0][0])/(seg[1][0]-seg[0][0]);
        for(const proj of ['p1','p2']){
          const delta=(yAt(lineB[proj])-yAt(lineA[proj]))/2;
          if(!Number.isFinite(delta)||Math.abs(delta)>5.1)
            throw Error('Source photo rectification exceeds allowed tolerance: '+
              variant+'/'+plane+'/'+proj+'/'+delta);
          lineA[proj].forEach(p=>{p[1]+=delta;});
          lineB[proj].forEach(p=>{p[1]-=delta;});
        }
        const aligned1=projectedCross(lineA.p1,lineB.p1);
        const aligned2=projectedCross(lineA.p2,lineB.p2);
        if(!aligned1||!aligned2||Math.abs(aligned1[0]-aligned2[0])>1e-5)
          throw Error('Printed source crossing projector not vertical after correction: '+
            variant+'/'+plane);
      }
    }
    for(const model of [scheme,scheme.sourceGeometry].filter(Boolean)){
      const A=model[plane]?.lines?.[a],B=model[plane]?.lines?.[b];
      if(!A||!B)continue;
      const p1=projectedCross(A.p1,B.p1),p2=projectedCross(A.p2,B.p2);
      if(p1&&p2)model[plane].junctions=[{p1,p2}];
    }
  }

  [[v03t5,'a','f'],[v06t5,'a','b']].forEach(([scheme,a,b])=>{
    if(!scheme)return;
    [scheme,scheme.sourceGeometry].filter(Boolean).forEach(model=>{
      const A=model.lines?.[a],B=model.lines?.[b];
      if(!A||!B)return;
      const p1=projectedCross(A.p1,B.p1);
      const p2=projectedCross(A.p2,B.p2);
      if(p1&&p2)model.junctions=[{p1,p2}];
    });
  });

  // Photograph 1000022486.jpg and 1000022485.jpg were shot at
  // different camera scales. Digitized coordinates below are normalized
  // from their lower-left (task 5) crop, preserving ALL six given strokes
  // and the thin vertical projector between a∩f / a∩b.
  const retracedTask5={
    "10":{
      a:{p2:[[236,253],[494,144]],p1:[[250,308],[466,448]]},
      f:{p2:[[265,130],[479,256]],p1:[[215,385],[460,382]]},
      l:{p2:[[224,191],[437,264]],p1:[[219,454],[473,385]]}
    },
    "17":{
      a:{p2:[[127,187],[334,281]],p1:[[174,452],[376,285]]},
      b:{p2:[[56,301],[359,188]],p1:[[52,358],[374,447]]},
      l:{p2:[[110,335],[411,225]],p1:[[233,473],[450,291]]}
    }
  };
  Object.entries(retracedTask5).forEach(([variant,lines])=>{
    const model=window.SITEMATH_SCHEMES[variant]?.task5;
    if(!model)return;
    [model,model.sourceGeometry].filter(Boolean).forEach(s=>{
      for(const [name,L] of Object.entries(lines)){
        if(s.lines?.[name]){
          s.lines[name]={
            p1:L.p1.map(v=>v.slice()),
            p2:L.p2.map(v=>v.slice())
          };
        }
      }
    });
  });
  // A cropped photograph is a raster, not an exact Monge diagram.
  // Resolve only the residual 4–9 px crossing mismatch in the WORKING
  // geometry so the corresponding projections describe one spatial point.
  // Leave sourceGeometry exactly as manually traced from the photograph.
  for(const variant of ["10","17"]){
    const model=window.SITEMATH_SCHEMES[variant]?.task5;
    const defining=variant==="10"?["a","f"]:["a","b"];
    const A=model?.lines?.[defining[0]],B=model?.lines?.[defining[1]];
    if(!A||!B)continue;
    const crossing=projectedCross(A.p2,B.p2);
    if(!crossing)continue;
    const yAt=(segment,x)=>{
      const [p,q]=segment;
      return p[1]+(q[1]-p[1])*(x-p[0])/(q[0]-p[0]);
    };
    const delta=yAt(A.p1,crossing[0])-yAt(B.p1,crossing[0]);
    B.p1.forEach(p=>p[1]+=delta);
  }
  // These pre-printed projectors are part of the *given*, not an invented
  // construction step. Their endpoints are intersections of the two
  // defining lines, rather than floating auxiliary points.
  [[v05t5,'a','f'],
   [window.SITEMATH_SCHEMES["10"]?.task5,'a','f'],
   [window.SITEMATH_SCHEMES["17"]?.task5,'a','b']]
  .forEach(([task,a,b])=>{
    if(!task)return;
    [task,task.sourceGeometry].filter(Boolean).forEach(def=>{
      const A=def.lines?.[a],B=def.lines?.[b];
      if(!A||!B)return;
      const p1=projectedCross(A.p1,B.p1),p2=projectedCross(A.p2,B.p2);
      if(p1&&p2)def.junctions=[{p1,p2}];
    });
  });

  const v14t6=window.SITEMATH_SCHEMES["14"]?.task6;
  if(v14t6){
    // 1000022467.jpg: in Σ(a∩b) both a₂ and a₁ rise to the right,
    // while b₂/b₁ descend. The old a₁ erroneously descended and was
    // nearly parallel to b₁, destroying the source plane intersection.
    const original={
      a:{p2:[[63,373],[315,243]],p1:[[48,609],[235,438]]},
      b:{p2:[[57,311],[353,456]],p1:[[45,477],[326,663]]}
    };
    for(const model of [v14t6,v14t6.sourceGeometry].filter(Boolean)){
      if(model.planeA?.lines){
        for(const [name,rec] of Object.entries(original)){
          if(model.planeA.lines[name]){
            model.planeA.lines[name]={
              p2:rec.p2.map(p=>p.slice()),
              p1:rec.p1.map(p=>p.slice())
            };
          }
        }
      }
      if(model.planeB?.line)model.planeB.line=[[107,655],[288,489]];
      model.pointK={p2:[471,302],p1:[471,618]};
      // The hand photograph differs slightly in x across the common point.
      // Reconcile only the solver trace, not the untouched source frame.
      if(model===v14t6)model.planeA.lines.b.p1.forEach(p=>p[1]+=13.79887538);
      const A=model.planeA?.lines?.a,B=model.planeA?.lines?.b;
      if(A&&B){
        const p2=projectedCross(A.p2,B.p2);
        const p1=projectedCross(A.p1,B.p1);
        if(p1&&p2)model.planeA.junctions=[{p2,p1}];
      }
    }
  }

  // 03/6 and 19/6: the photographed Π₁ and Π₂ intersections visibly
  // lie on the SAME pre-printed projector. The earlier digital traces
  // incorrectly separated them by 29/36 source units. Recover both
  // defining planes from the actual photographed endpoints instead.
  const sectionRetraces=[
    ["03","planeB",{
      a:{p2:[[392,178],[546,96]],p1:[[392,335],[551,366]]},
      b:{p2:[[391,99],[546,202]],p1:[[403,402],[541,286]]}
    }],
    ["19","planeA",{
      a:{p2:[[524,944],[642,914]],p1:[[520,1086],[658,1019]]},
      b:{p2:[[543,922],[659,963]],p1:[[516,1067],[660,1045]]}
    }]
  ];
  for(const [variant,plane,lines] of sectionRetraces){
    const model=window.SITEMATH_SCHEMES[variant]?.task6;
    if(!model)continue;
    for(const s of [model,model.sourceGeometry].filter(Boolean)){
      const p=s[plane];
      if(!p?.lines)continue;
      for(const [name,L] of Object.entries(lines)){
        if(p.lines[name])p.lines[name]={
          p2:L.p2.map(q=>q.slice()),
          p1:L.p1.map(q=>q.slice())
        };
      }
      if(variant==="19")s.pointK={p2:[605,902],p1:[605,1110]};
    }
    // Only the mathematically computed copy is adjusted by the very small
    // horizontal projector error introduced by raster/photo perspective.
    const A=model[plane].lines.a,B=model[plane].lines.b;
    const p2=projectedCross(A.p2,B.p2);
    if(p2){
      const yAt=(L,x)=>L[0][1]+(L[1][1]-L[0][1])*(x-L[0][0])/(L[1][0]-L[0][0]);
      const dy=yAt(A.p1,p2[0])-yAt(B.p1,p2[0]);
      B.p1.forEach(p=>p[1]+=dy);
    }
    for(const s of [model,model.sourceGeometry].filter(Boolean)){
      const A=s[plane].lines.a,B=s[plane].lines.b;
      const p1=projectedCross(A.p1,B.p1);
      const p2=projectedCross(A.p2,B.p2);
      if(p1&&p2)s[plane].junctions=[{p1,p2}];
    }
  }

  const v19=window.SITEMATH_SCHEMES["19"]?.task4;
  if(v19){
    // IMG 1000022473.jpg: the intersection projector is GIVEN on the sheet,
    // explicitly named K₂ above and K₁ below.
    const junction={
      p2:[589.906,579.243],p1:[589.470,735.275],
      label2:"K₂",label1:"K₁"
    };
    v19.junctions=[junction];
    if(v19.sourceGeometry)
      v19.sourceGeometry.junctions=[{
        p2:junction.p2.slice(),p1:junction.p1.slice(),
        label2:junction.label2,label1:junction.label1
      }];
  }
})();

/* Durable, byte-identical photographed originals from 2026-10-13.
   Available in source-photos/ and backed up on Drive. Availability does not
   by itself imply that every line or teaching step has passed visual QA. */
(function registerRecoveredSources(){
  const recovered={
    "03":"1000022472.jpg", "04":"1000022483.jpg",
    "05":"1000022482.jpg", "06":"1000022471.jpg",
    "08":"1000022484.jpg", "09":"1000022475.jpg",
    "10":"1000022486.jpg", "11":"1000022470.jpg",
    "14":"1000022467.jpg", "15":"1000022469.jpg",
    "17":"1000022485.jpg", "18":"1000022474.jpg",
    "19":"1000022473.jpg"
  };
  Object.entries(recovered).forEach(([variant,name])=>{
    [4,5,6].forEach(task=>{
      const s=window.SITEMATH_SCHEMES?.[variant]?.['task'+task];
      if(!s)return;
      s.sourceId='source-photos/variant-'+variant+'/'+name;
      s.sourceAvailable=true;
      s.sourceVerified=false; // checked only after exact per-task comparison
    });
  });
  // IMG 1000022470.jpg, variant 11 task 6: the *paper* accidentally
  // captions the upper K point as K₁ and the lower as K₂. Preserve these
  // original labels in the first frame, then explicitly correct their
  // projection indices for the mathematical construction.
  const task11=window.SITEMATH_SCHEMES?.["11"]?.task6;
  if(task11) task11.paperReversedKLabels=true;
  // The newly supplied image for 12 is a second source, beside the earlier
  // archived IMG_20260917_131638. Preserve the original verified source ID.
})();

/* Verification state is stricter than "a trace exists".
   sourceId records provenance only. A scheme is verified only when the exact
   source image is currently available and has actually been rechecked. */
Object.entries(window.SITEMATH_SCHEMES||{}).forEach(([variant,group])=>{
  [4,5,6].forEach(task=>{
    const scheme=group&&group['task'+task];
    if(!scheme) return;
    const hasSourceId=typeof scheme.sourceId==='string' && scheme.sourceId.trim().length>0;
    const sourceAvailable=scheme.sourceAvailable===true;
    scheme.sourceVerified=hasSourceId && sourceAvailable && scheme.sourceVerified===true;
    scheme.sourceRecheckRequired=!scheme.sourceVerified;
  });
});
