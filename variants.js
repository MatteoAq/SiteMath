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
      task3: { A:[50,40,0], B:[45,-20,-35], C:[30,-50,20] },
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
        statement:"Построить линию пересечения заданных плоскостей. Через т. K провести прямую ∥ обеим плоскостям.",
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
      task3: { A:[50,50,0], B:[45,15,30], C:[60,0,20] },
      task4: {
        statement:"В пл. Σ(A;a) построить горизонталь, фронталь и линию наибольшего ската. Через т. D провести прямую ℓ, пересекающую прямую a. Построить т. B под плоскостью Σ(A;a).",
        plane:"A;a", operation:"line_intersects_a", pointRelation:"below_plane"
      },
      task5: {
        statement:"Построить точку пересечения прямой ℓ с пл. Σ(a∥b) и определить видимость прямой относительно плоскости.",
        plane:"a∥b"
      },
      task6: {
        statement:"Построить линию пересечения пл. Σ(a∩b) и второй заданной плоскости. Через т. K провести прямую ∥ обеим плоскостям.",
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
        statement:"Построить линию пересечения заданной плоскости Σ и пл. Θ(ABC). Через т. K провести прямую ∥ обеим плоскостям.",
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
      provisionalNumber:true,
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
        C:{p2:[321,248],p1:[321,326]},
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
    task4: {
      planeType:"parallel_lines",
      planeLines:["a","b"],
      lines:{
        a:{p2:[[126,334],[333,214]],p1:[[119,508],[383,445]]},
        b:{p2:[[254,365],[471,218]],p1:[[247,548],[492,480]]}
      },
      points:{ D:{p2:[558,292],p1:[558,580]} },
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
      sourceVerified:true,
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
      a:{p2:[[202,180],[466,66]],p1:[[205,538],[469,441]]},
      b:{p2:[[206,75],[463,168]],p1:[[245,394],[487,520]]},
      l:{p2:[[126,124],[414,231]],p1:[[125,448],[427,558]]}
    },givenLine:"l"
  },
  task6:{
    planeA:{type:"ABC",points:{
      A:{p2:[179,228],p1:[180,485]},
      B:{p2:[273,121],p1:[274,350]},
      C:{p2:[421,265],p1:[420,407]}
    }},
    planeB:{type:"parallel_lines",lines:{
      a:{p2:[[502,150],[681,199]],p1:[[516,470],[699,592]]},
      b:{p2:[[511,207],[687,253]],p1:[[489,412],[674,529]]}
    }},
    pointK:{p2:[604,119],p1:[605,469]}
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
    sourceVerified:true
  },
  task6:{
    planeA:{type:"parallel_lines",lines:{
      a:{p2:[[20,405],[305,323]],p1:[[85,510],[335,575]]},
      b:{p2:[[30,458],[350,377]],p1:[[70,560],[303,625]]}
    }},
    planeB:{type:"intersecting_lines",lines:{
      h:{p2:[[367,409],[548,411]],p1:[[365,545],[570,545]]},
      f:{p2:[[390,455],[565,323]],p1:[[385,505],[568,618]]}
    }},
    pointK:{p2:[195,326],p1:[195,641]},
    sourceVerified:true
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
      A:[60,-50,-30], B:[40,-10,50], C:[30,50,40], D:[20,-50,0], E:[45,0,15]
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
    task4:{
      planeType:"parallel_lines",
      planeLines:["a","b"],
      lines:{
        a:{p2:[[540,742],[670,675]],p1:[[530,805],[680,765]]},
        b:{p2:[[575,768],[710,700]],p1:[[570,830],[718,788]]}
      },
      points:{D:{p2:[760,708],p1:[760,810]}},
      operation:{type:"line_parallel_horizontal",through:"D",resultPoint:"A",relation:"above_plane"}
    },
    task5:{
      planeType:"intersecting_lines",planeLines:["a","b"],
      lines:{
        a:{p2:[[300,1000],[465,1060]],p1:[[305,1128],[470,1085]]},
        b:{p2:[[330,1080],[480,990]],p1:[[315,1165],[465,1080]]},
        l:{p2:[[285,1060],[500,980]],p1:[[290,1110],[495,1145]]}
      },
      givenLine:"l"
    },
    task6:{
      planeA:{type:"intersecting_lines",lines:{
        a:{p2:[[560,1000],[700,1020]],p1:[[555,1110],[715,1165]]},
        b:{p2:[[565,1050],[690,960]],p1:[[570,1145],[705,1095]]}
      }},
      planeB:{type:"line_point",lineName:"h",pointName:"A",lines:{
        h:{p2:[[705,1005],[830,1005]],p1:[[700,1145],[830,1080]]}
      },points:{A:{p2:[750,940],p1:[750,1035]}}},
      pointK:{p2:[675,965],p1:[675,1175]}
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
