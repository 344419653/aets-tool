// Part 5 OPI 组间过渡语（连接句）文本
// 来源：原题库文档 ICAO考试OPI完整版16套.doc（提取文本见 scripts/opi16_source.txt）
// 结构：套题号 -> { 该组第一题的题号 -> 过渡语文本 }
// 仅非开场组有过渡语；开场组（各套第1组）无。
// 应用侧（index.ts）与音频生成脚本（scripts/generate-opi-connectors.mjs）共用本文件。
export const CONNECTOR_TEXTS: Record<number, Record<number, string>> = {
  1: {
    4: "Let's talk about missed approach.",
    10: 'The following questions are about air miss.',
  },
  2: {
    4: "Let's talk about abnormal situations.",
    10: "Now, let's change to the topic related to flow control.",
  },
  3: {
    4: "Now, let's talk something about runway incursions.",
    10: 'The following questions are about fuel dumping.',
  },
  4: {
    4: "Now, let's talk something about bomb threats.",
    10: 'The following questions are about fire on board.',
  },
  5: {
    4: "Now, let's discuss air miss or near miss.",
    10: "Now let's talk something about hijacking.",
  },
  6: {
    4: "Now, let's talk something related to ATC equipment.",
    10: 'The following questions are about traffic delays.',
  },
  7: {
    4: "Now let's talk about bad weather.",
    11: 'The following questions are about fuel.',
  },
  8: {
    4: "Now let's talk about marginal weather.",
    10: 'The following questions are about minimum safe altitude.',
  },
  9: {
    4: "Now let's talk about bird activities.",
    9: 'The following questions are about VIP flights.',
  },
  10: {
    4: "Now let's talk about belly landings.",
    10: 'The following questions are about emergency evacuation.',
  },
  11: {
    4: "Now let's talk about ATC clearance.",
    10: 'The following questions are about delay.',
  },
  12: {
    4: "Now let's discuss runway incursion.",
    8: 'The following questions are about simulator training for controllers.',
    13: 'The following questions are about traffic conflicts.',
  },
  13: {
    4: "Now let's talk about ground collisions.",
    8: 'The following questions are about radio communication.',
    12: 'The following questions are about misunderstanding in communication.',
  },
  14: {
    4: "Now let's talk about fire on board.",
    9: 'The following questions are about language proficiency in radiotelephony communication.',
    13: 'The following questions are about misunderstanding in communication.',
  },
  15: {
    4: "Now let's talk about the relationship between controllers and pilots.",
    10: 'The following questions are about missed approach.',
    13: 'The following questions are about emergency descent.',
  },
  16: {
    4: "Now let's talk about speed adjustment.",
    9: 'The following questions are about landing gear problems.',
    13: 'The following questions are about separation.',
  },
};
