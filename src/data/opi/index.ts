// Part 5 OPI 套题题库：多套题（每套15题），考试时按【题组】跨套抽题组卷
// 数据来源：本目录下 OPI_{n}.json（题目文本），
// 考官语音在 src/assets/audio/part5_opi/OPI_{nn}/OPI_{nn}_Q{qq}.mp3。
// 新增一套题需放入 OPI_{n}.json 及对应音频目录，并在下方 GROUP_BOUNDARIES 中
// 登记其连接句分组边界（未登记时按 topic 连续段自动分组）。

import type { OPIExamSet, OPISetQuestion } from '@/types/exam';
import { CONNECTOR_TEXTS } from './connectorTexts';

/** OPI_{n}.json 原始格式 */
interface RawOPIQuestion {
  id: number;
  question_en: string;
  question_cn: string;
  type: string;
  answer: string;
  topic: string;
  note: string;
}

interface RawOPISet {
  opi_number: number;
  total_questions: number;
  topic_blocks: string[];
  questions: RawOPIQuestion[];
}

// --- 动态导入所有套题 JSON 与考官语音 ---
const setModules = import.meta.glob<RawOPISet>('@/data/opi/OPI_*.json', {
  eager: true,
  import: 'default',
});

const audioModules = import.meta.glob<string>('@/assets/audio/part5_opi/**/*.mp3', {
  eager: true,
  import: 'default',
});

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** 解析某套某题的考官语音 URL */
function resolveAudio(opiNumber: number, questionId: number): string {
  const dir = `OPI_${pad2(opiNumber)}`;
  const fileName = `${dir}_Q${pad2(questionId)}.mp3`;
  const key = `/src/assets/audio/part5_opi/${dir}/${fileName}`;
  const url = audioModules[key];
  if (!url) {
    console.warn('[Part5] 找不到考官语音:', key);
    return '';
  }
  return url;
}

/** 全部可用套题（按套题编号排序；排除 OPI_audio_manifest.json 等非套题文件） */
export const opiSets: OPIExamSet[] = Object.entries(setModules)
  .filter(([key]) => /OPI_\d+\.json$/.test(key))
  .map(([, raw]): OPIExamSet => {
    const questions: OPISetQuestion[] = raw.questions.map((q) => ({
      id: q.id,
      uid: raw.opi_number * 100 + q.id,
      setNumber: raw.opi_number,
      question: q.question_en,
      questionCn: q.question_cn,
      topic: q.topic,
      type: q.type,
      answer: q.answer,
      audio: resolveAudio(raw.opi_number, q.id),
    }));
    return {
      setNumber: raw.opi_number,
      topicBlocks: raw.topic_blocks,
      questions,
      sourceSets: [raw.opi_number],
    };
  })
  .sort((a, b) => a.setNumber - b.setNumber);

// --- 题组划分 ---
// 规则：按原题库文档（ICAO考试OPI完整版16套.doc，提取文本见 scripts/opi16_source.txt）
// 中组与组之间的连接句（"Let's talk about ..." / "The following questions are about ..."
// / "Now let's ..."）划分；同一组内的题目只能同时被抽中或同时不被抽中。
// 表中数字为每组最后一题的题号（首组从 Q1 开始，末组恒为15，省略）。
const GROUP_BOUNDARIES: Record<number, number[]> = {
  1: [3, 9], // 自我介绍 | 复飞 | 空中危险接近
  2: [3, 9], // 自我介绍 | 不正常情况 | 流量控制
  3: [3, 9], // 英语通讯 | 跑道入侵 | 放油
  4: [3, 9], // 自我介绍 | 炸弹威胁 | 机上失火
  5: [3, 9], // 教育背景 | 危险接近 | 劫机
  6: [3, 9], // 日常工作 | 管制设备 | 航班延误
  7: [3, 10], // 教育背景 | 恶劣天气(7题) | 燃油
  8: [3, 9], // 工作感受 | 边缘天气 | 最低安全高度
  9: [3, 8], // 职业选择 | 鸟击(5题) | VIP飞行(7题)
  10: [3, 9], // 工作职责 | 机腹着陆 | 紧急疏散
  11: [3, 9], // 空域与班次 | 放行许可 | 延误
  12: [3, 7, 12], // 工作与压力 | 跑道入侵(4题) | 模拟机训练(5题) | 飞行冲突
  13: [3, 7, 11], // 自我介绍 | 地面相撞(4题) | 无线电通讯(4题) | 通讯误解
  14: [3, 8, 12], // 职业选择 | 机上失火(5题) | 通讯英语(4题) | 通讯误解
  15: [3, 9, 12], // 职业选择与培训 | 管制员与飞行员关系(6题) | 复飞(3题) | 紧急下降
  16: [3, 8, 12], // 英语学习 | 速度调整(5题) | 起落架故障(4题) | 间隔
};

/** OPI 题组：按连接句划分出的一组题目，抽题时的最小单位 */
export interface OPIGroup {
  setNumber: number;
  topic: string;
  questions: OPISetQuestion[];
}

/** 把一套题切成若干组（优先按连接句边界表，未登记时按 topic 连续段） */
function splitIntoGroups(set: OPIExamSet): OPIGroup[] {
  const boundaries = GROUP_BOUNDARIES[set.setNumber];
  if (boundaries) {
    const groups: OPIGroup[] = [];
    let start = 0;
    for (const end of [...boundaries, set.questions.length]) {
      const questions = set.questions.slice(start, end);
      if (questions.length > 0) {
        groups.push({ setNumber: set.setNumber, topic: questions[0].topic, questions });
      }
      start = end;
    }
    return groups;
  }
  const groups: OPIGroup[] = [];
  for (const q of set.questions) {
    const last = groups[groups.length - 1];
    if (last && last.topic === q.topic) {
      last.questions.push(q);
    } else {
      groups.push({ setNumber: set.setNumber, topic: q.topic, questions: [q] });
    }
  }
  return groups;
}

/** 按套分组后的全部题组 */
const groupsBySet: OPIGroup[][] = opiSets.map(splitIntoGroups);

// --- 组间过渡语（连接句）音频：挂到每组第一题上（开场组无过渡语） ---
for (const groups of groupsBySet) {
  for (let i = 1; i < groups.length; i++) {
    const first = groups[i].questions[0];
    const text = CONNECTOR_TEXTS[first.setNumber]?.[first.id];
    if (!text) continue;
    const key = `/src/assets/audio/part5_opi/connectors/OPI_${pad2(first.setNumber)}_Q${pad2(first.id)}_intro.mp3`;
    const url = audioModules[key];
    if (!url) {
      console.warn('[Part5] 找不到过渡语语音:', key);
      continue;
    }
    first.introText = text;
    first.introAudio = url;
  }
}

/** 全部题组（跨所有套题） */
export const opiGroups: OPIGroup[] = groupsBySet.flat();

/** 开场组（每套的第1组，自我介绍/warmup 类） */
const warmupGroups = groupsBySet.map((g) => g[0]).filter((g): g is OPIGroup => !!g);

/** 非开场组（开场组抽完后，从中继续抽组凑满15题） */
const followupGroups = opiGroups.filter((g) => !warmupGroups.includes(g));

const OPI_TOTAL_QUESTIONS = 15;

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * 随机组卷：先抽一个开场组（自我介绍/warmup 类），
 * 再从其余题组中跨套随机抽组，整组入选，累计恰好凑满15题。
 */
export const generateOPIExamSet = (): OPIExamSet => {
  const warmup = warmupGroups[Math.floor(Math.random() * warmupGroups.length)];
  const target = OPI_TOTAL_QUESTIONS - warmup.questions.length;

  // 多次随机尝试，直到抽中的题组题数之和恰好等于 target
  let selected: OPIGroup[] | null = null;
  let best: OPIGroup[] = [];
  let bestSum = -1;
  for (let attempt = 0; attempt < 500 && !selected; attempt++) {
    const chosen: OPIGroup[] = [];
    let sum = 0;
    for (const g of shuffle(followupGroups)) {
      if (sum + g.questions.length <= target) {
        chosen.push(g);
        sum += g.questions.length;
        if (sum === target) break;
      }
    }
    if (sum > bestSum) {
      best = chosen;
      bestSum = sum;
    }
    if (sum === target) selected = chosen;
  }
  if (!selected) {
    console.warn(`[Part5] 多次尝试未能凑满${OPI_TOTAL_QUESTIONS}题，按最接近的组合组卷（${bestSum + warmup.questions.length}题）`);
  }

  const groups = [warmup, ...(selected ?? best)];
  const questions = groups.flatMap((g) => g.questions);
  return {
    setNumber: 0,
    topicBlocks: [...new Set(questions.map((q) => q.topic))],
    questions,
    sourceSets: groups.map((g) => g.setNumber),
  };
};
