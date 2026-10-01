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
    "photo-unknown": {
      label: "Фото без видимого номера",
      verifiedNumber:false,
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
  "photo-unknown": {
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

Object.assign(window.SITEMATH_SCHEMES["photo-unknown"], {
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
