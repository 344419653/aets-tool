// 本文件由 scripts/generate-part4-keywords.mjs 生成，请勿手改。
// Part 4 模拟通话每轮的"重要信息（关键词）"，用于评分报告页的关键词覆盖检查。
// 键：场景 id（sim1–sim5）→ 轮次 roundIndex（1 起，与 SimulationRound.roundIndex 一致）。
export const PART4_KEYWORDS: Record<string, Record<number, string[]>> = {
  "sim1": {
    "1": [
      "CCA101",
      "radar contact",
      "maintain level",
      "report ZF"
    ],
    "2": [
      "HDA305",
      "radar contact",
      "descend to 6300m",
      "report KG"
    ],
    "3": [
      "HDA305",
      "delay KG time",
      "5min"
    ],
    "4": [
      "HDA305",
      "hold at KG"
    ],
    "5": [
      "HDA305",
      "descend to 5100m",
      "hold at KG",
      "report KG"
    ],
    "6": [
      "CCA101",
      "descend to 4800m",
      "report ZF"
    ],
    "7": [
      "CCA101",
      "confirm fuel leak",
      "endurance"
    ],
    "8": [
      "CCA101",
      "roger",
      "confirm POB",
      "assistance on landing"
    ],
    "9": [
      "CCA101",
      "roger",
      "fire trucks",
      "ready"
    ],
    "10": [
      "HDA305",
      "maintain 5100m",
      "hold at KG",
      "as published",
      "expect further instruction at 12"
    ],
    "11": [
      "CCA101",
      "contact WUHAN APPROACH",
      "118.9"
    ],
    "12": [
      "CCA101",
      "radar contact",
      "Info K"
    ],
    "13": [
      "CCA101",
      "radar vector",
      "ILS approach",
      "RWY36R",
      "heading 180",
      "1800m",
      "QNH 1011"
    ],
    "14": [
      "CES5325",
      "maintain 4800m",
      "report passing XS"
    ],
    "15": [
      "HDA305",
      "leave holding procedure",
      "contact WUHAN APPROACH",
      "118.9"
    ],
    "16": [
      "HDA305",
      "radar contact",
      "KG-11A",
      "ILS approach",
      "RWY36R",
      "descend to 2400m",
      "QNH 1011"
    ],
    "17": [
      "HDA305",
      "reduce speed",
      "250kts",
      "NO.2",
      "app"
    ],
    "18": [
      "CES5325",
      "contact",
      "WUHAN APPROACH",
      "118.9"
    ],
    "19": [
      "CES5325",
      "radar contact",
      "XS-11A",
      "ILS approach",
      "RWY36R",
      "2700m",
      "QNH 1011"
    ],
    "20": [
      "CCA101",
      "reduce speed to 180kts",
      "descend to 900m",
      "NO.1"
    ],
    "21": [
      "CCA101",
      "turn right",
      "heading 270",
      "for base"
    ],
    "22": [
      "CCA101",
      "turn right",
      "heading 330",
      "cleared",
      "ILS approach",
      "RWY36R",
      "report established"
    ],
    "23": [
      "CCA101",
      "13km from touchdown",
      "radar service terminated",
      "contact WH tower",
      "124.35"
    ],
    "24": [
      "CCA101",
      "roger MAYDAY",
      "report passing outer marker",
      "fire trucks are ready"
    ],
    "25": [
      "CCA101",
      "surface wind 350 degrees 4m/s gusting to 9m/s",
      "cleared to land",
      "confirm you need a tug"
    ]
  },
  "sim2": {
    "1": [
      "CSN4580",
      "radar contact",
      "maintain level",
      "report WHA"
    ],
    "2": [
      "AFR668",
      "radar contact",
      "descend to 5700m",
      "report KG"
    ],
    "3": [
      "AFR668",
      "delay KG time",
      "10min"
    ],
    "4": [
      "AFR668",
      "expect hold",
      "KG"
    ],
    "5": [
      "AFR668",
      "descend to 4500m",
      "hold at KG",
      "report KG"
    ],
    "6": [
      "CSN4580",
      "roger MAYDAY",
      "descend to 5100m",
      "report WHA"
    ],
    "7": [
      "CSN4580",
      "confirm",
      "fire",
      "completely extinguished",
      "injuries",
      "damage"
    ],
    "8": [
      "CSN4580",
      "roger",
      "confirm POB",
      "assistance",
      "on landing"
    ],
    "9": [
      "CSN4580",
      "roger",
      "fire trucks",
      "ready"
    ],
    "10": [
      "AFR668",
      "maintain 4500m",
      "hold at KG",
      "as published",
      "expect further instruction at 25"
    ],
    "11": [
      "CSN4580",
      "contact WUHAN APPROACH",
      "118.9"
    ],
    "12": [
      "CSN4580",
      "radar contact",
      "Info M"
    ],
    "13": [
      "CSN4580",
      "radar vector",
      "ILS approach",
      "RWY36R",
      "heading 200",
      "2100m",
      "QNH 1009"
    ],
    "14": [
      "CCA2290",
      "maintain 5100m",
      "report passing DA"
    ],
    "15": [
      "AFR668",
      "leave holding procedure",
      "contact WUHAN APPROACH",
      "118.9"
    ],
    "16": [
      "AFR668",
      "radar contact",
      "follow KG-11A",
      "ILS approach",
      "descend to 2700m",
      "QNH 1009"
    ],
    "17": [
      "AFR668",
      "reduce speed",
      "240kts",
      "NO.2",
      "app"
    ],
    "18": [
      "CCA2290",
      "contact WUHAN APPROACH",
      "118.9"
    ],
    "19": [
      "CCA2290",
      "radar contact",
      "follow DA-01A",
      "ILS approach RWY36R",
      "descend to 3000m",
      "QNH 1009"
    ],
    "20": [
      "CSN4580",
      "reduce speed to 170kts",
      "descend to 1200m",
      "NO.1"
    ],
    "21": [
      "CSN4580",
      "turn right",
      "heading 250",
      "for base"
    ],
    "22": [
      "CSN4580",
      "turn right heading 320",
      "cleared for ILS approach RWY36R",
      "report established localizer"
    ],
    "23": [
      "CSN4580",
      "12km from touchdown",
      "radar service terminated",
      "contact WH tower",
      "124.35"
    ],
    "24": [
      "CSN4580",
      "roger MAYDAY",
      "report passing outer marker",
      "fire trucks are ready"
    ],
    "25": [
      "CSN4580",
      "surface wind 020 degrees 6m/s gusting to 13m/s",
      "cleared to land",
      "confirm you need a tug after landing"
    ],
    "26": [
      "CSN4580",
      "after vacating the runway",
      "contact WUHAN APRON",
      "119.25"
    ]
  },
  "sim3": {
    "1": [
      "CES7721",
      "radar contact",
      "maintain level",
      "report DA"
    ],
    "2": [
      "CHH3302",
      "radar contact",
      "descend to 5100m",
      "report XS"
    ],
    "3": [
      "CHH3302",
      "delay XS time",
      "5min"
    ],
    "4": [
      "CHH3302",
      "expect hold",
      "XS"
    ],
    "5": [
      "CHH3302",
      "descend to 3900m",
      "hold at XS",
      "report XS"
    ],
    "6": [
      "CES7721",
      "roger PANPAN",
      "descend to 4800m",
      "report DA"
    ],
    "7": [
      "CES7721",
      "confirm",
      "passenger's condition",
      "doctor on board"
    ],
    "8": [
      "CES7721",
      "roger",
      "confirm POB",
      "assistance",
      "on landing"
    ],
    "9": [
      "CES7721",
      "roger",
      "ambulance",
      "doctor",
      "ready"
    ],
    "10": [
      "CHH3302",
      "maintain 3900m",
      "hold at XS",
      "as published",
      "expect further instruction at 30"
    ],
    "11": [
      "CES7721",
      "contact",
      "WUHAN APPROACH",
      "118.9"
    ],
    "12": [
      "CES7721",
      "radar contact",
      "Info T"
    ],
    "13": [
      "CES7721",
      "radar vector",
      "ILS approach",
      "RWY36R",
      "fly heading 160",
      "descend to 1800m",
      "QNH 1013"
    ],
    "14": [
      "JAL781",
      "maintain 4200m",
      "report passing KG"
    ],
    "15": [
      "CHH3302",
      "leave holding procedure",
      "contact WUHAN APPROACH",
      "118.9"
    ],
    "16": [
      "radar contact",
      "follow XS-11A",
      "ILS approach",
      "RWY36R",
      "descend to 2400m",
      "QNH 1013"
    ],
    "17": [
      "CHH3302",
      "reduce speed",
      "230kts",
      "NO.2",
      "app"
    ],
    "18": [
      "JAL781",
      "contact WUHAN APPROACH",
      "118.9"
    ],
    "19": [
      "JAL781",
      "radar contact",
      "KG-11A",
      "ILS approach",
      "RWY36R",
      "2700m",
      "QNH 1013"
    ],
    "20": [
      "CES7721",
      "reduce speed to 170kts",
      "descend to 900m",
      "NO.1"
    ],
    "21": [
      "CES7721",
      "turn right",
      "heading 240",
      "for base"
    ],
    "22": [
      "CES7721",
      "turn right heading 310",
      "cleared for ILS approach",
      "RWY36R",
      "report established localizer"
    ],
    "23": [
      "CES7721",
      "11km from touchdown",
      "radar service terminated",
      "contact WH tower",
      "124.35"
    ],
    "24": [
      "CES7721",
      "roger PANPAN",
      "report passing outer marker",
      "ambulance is ready"
    ],
    "25": [
      "CES7721",
      "surface wind 340 degrees",
      "5m/s",
      "gusting to 11m/s",
      "cleared to land",
      "vacate the runway"
    ],
    "26": [
      "CES7721",
      "ambulance",
      "at the stand",
      "after vacating",
      "contact WUHAN APRON",
      "119.25"
    ]
  },
  "sim4": {
    "1": [
      "CSN6688",
      "start-up approved"
    ],
    "2": [
      "CSN6688",
      "pushback approved",
      "face south"
    ],
    "3": [
      "CSN6688",
      "taxi via K and T2",
      "holding point of RWY36R",
      "contact WUHAN TOWER",
      "124.35"
    ],
    "4": [
      "CSN6688",
      "cleared for takeoff",
      "RWY36R",
      "surface wind 030 degrees 8m/s gusting to 16m/s",
      "after airborne contact Departure 118.9"
    ],
    "5": [
      "CSN6688",
      "roger",
      "continue runway heading",
      "turn left after 900m",
      "maintain 1500m"
    ],
    "6": [
      "CSN6688",
      "confirm",
      "engine condition",
      "visible damage",
      "aircraft"
    ],
    "7": [
      "CSN6688",
      "roger",
      "confirm POB",
      "assistance",
      "on landing"
    ],
    "8": [
      "CSN6688",
      "fire trucks will be ready",
      "NO.1",
      "ILS approach",
      "RWY36R"
    ],
    "9": [
      "CCA2291",
      "standby for start-up",
      "expect delay of 15 minutes",
      "emergency traffic returning"
    ],
    "10": [
      "radar contact",
      "KG-11A",
      "ILS approach",
      "RWY36R",
      "descend to 2700m",
      "QNH 1013",
      "NO.2"
    ],
    "11": [
      "CSN6688",
      "turn left",
      "heading 270",
      "descend to 1200m",
      "reduce speed to 170kts"
    ],
    "12": [
      "CSN6688",
      "turn left heading 320",
      "cleared for ILS approach",
      "RWY36R",
      "report established localizer"
    ],
    "13": [
      "CSN6688",
      "10km from touchdown",
      "radar service terminated",
      "contact WH tower",
      "124.35"
    ],
    "14": [
      "CSN6688",
      "roger MAYDAY",
      "report passing outer marker",
      "fire trucks are ready"
    ],
    "15": [
      "CSN6688",
      "surface wind 020 degrees 9m/s gusting to 17m/s",
      "cleared to land",
      "confirm vacate runway"
    ],
    "16": [
      "CSN6688",
      "fire trucks will follow",
      "after vacating the runway",
      "contact WUHAN APRON",
      "119.25"
    ],
    "17": [
      "CSN6688",
      "taxi to stand 214",
      "via B7",
      "fire trucks are following"
    ],
    "18": [
      "CCA2291",
      "start-up approved",
      "request pushback when ready"
    ],
    "19": [
      "AFR720",
      "reduce speed",
      "180kts",
      "NO.2",
      "departure traffic ahead"
    ]
  },
  "sim5": {
    "1": [
      "CCA7715",
      "start-up approved"
    ],
    "2": [
      "CCA7715",
      "pushback approved",
      "face north"
    ],
    "3": [
      "CCA7715",
      "taxi via A and A5",
      "holding point of RWY36R",
      "contact WUHAN TOWER",
      "124.35"
    ],
    "4": [
      "CCA7715",
      "cleared for takeoff",
      "RWY36R",
      "surface wind 340 degrees 6m/s gusting to 12m/s",
      "after airborne contact Departure 118.9"
    ],
    "5": [
      "CCA7715",
      "roger PANPAN",
      "continue runway heading",
      "turn right after 1000m",
      "maintain 1800m"
    ],
    "6": [
      "CCA7715",
      "confirm",
      "fire warning",
      "still on",
      "smoke",
      "cabin"
    ],
    "7": [
      "CCA7715",
      "roger",
      "confirm POB",
      "dangerous goods",
      "assistance on landing"
    ],
    "8": [
      "CCA7715",
      "fire trucks will be ready",
      "NO.1",
      "ILS approach",
      "RWY36R"
    ],
    "9": [
      "CHH3309",
      "standby for start-up",
      "expect delay of 20 minutes",
      "urgency traffic returning"
    ],
    "10": [
      "radar contact",
      "follow XS-11A",
      "ILS approach RWY36R",
      "descend to 2400m",
      "QNH 1011",
      "NO.2"
    ],
    "11": [
      "CCA7715",
      "turn right",
      "heading 090",
      "descend to 1500m",
      "reduce speed to 180kts"
    ],
    "12": [
      "CCA7715",
      "turn right heading 300",
      "cleared for ILS approach RWY36R",
      "report established localizer"
    ],
    "13": [
      "CCA7715",
      "9km from touchdown",
      "radar service terminated",
      "contact WH tower",
      "124.35"
    ],
    "14": [
      "CCA7715",
      "roger PANPAN",
      "report passing outer marker",
      "fire trucks are ready"
    ],
    "15": [
      "CCA7715",
      "surface wind 350 degrees 5m/s gusting to 11m/s",
      "cleared to land",
      "confirm your intention after landing"
    ],
    "16": [
      "CCA7715",
      "fire crew will meet you on the runway",
      "after the check",
      "contact WUHAN APRON",
      "119.25"
    ],
    "17": [
      "CHH3309",
      "runway occupied",
      "fire check",
      "expect further delay",
      "15 minutes"
    ],
    "18": [
      "JAL782",
      "reduce speed to 170kts",
      "NO.2",
      "expect delay",
      "runway occupied"
    ]
  }
};
