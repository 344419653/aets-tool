// Part 1 听力理解题库 - 10套模拟题合并
// 组卷规则：
//   Q1-Q5:  从50组 slot=q1_5  中随机抽5组（每组1题，独立对话），5组场景类别互不相同
//   Q6-Q8:  从10组 slot=q6_8  中随机抽1组（1对话+3题）
//   Q9-Q12: 从10组 slot=q9_12 中随机抽1组（1对话+4题）
//   Q13-Q15:从10组 slot=q13_15中随机抽1组（1对话+3题）
//   约束：整套15题不允许出现完全重复的题目；Q6-Q8 / Q9-Q12 / Q13-Q15 三组之间场景类别也互不相同。

import type { Part1Group, Part1Slot } from './types';

// --- 动态导入所有音频文件 ---
const audioModules = import.meta.glob<string>('@/assets/audio/part1_lib/**/*.m4a', {
  eager: true,
  import: 'default',
});

/** 将JSON中的音频路径转换为实际URL */
function resolveAudio(jsonPath: string): string {
  // JSON格式: "audio/sim1/sim1_g1_dialogue.m4a"
  // 映射到:    "/src/assets/audio/part1_lib/test1/sim1_g1_dialogue.m4a"
  const parts = jsonPath.replace('audio/', '').split('/'); // ['sim1', 'sim1_g1_dialogue.m4a']
  if (parts.length !== 2) {
    console.warn('[Part1] 无法解析音频路径:', jsonPath);
    return '';
  }
  const simName = parts[0]; // sim1
  const fileName = parts[1]; // sim1_g1_dialogue.m4a
  const testNum = simName.replace('sim', ''); // 1

  // 尝试两种可能的路径格式
  const possibleKeys = [
    `/src/assets/audio/part1_lib/test${testNum}/${fileName}`,
    `/src/assets/audio/part1_lib/test${testNum}/${fileName.replace('.m4a', '.mp3')}`,
  ];

  for (const key of possibleKeys) {
    if (audioModules[key]) {
      return audioModules[key];
    }
  }

  // 回退：模糊匹配
  const globKey = Object.keys(audioModules).find(k =>
    k.includes(`/test${testNum}/`) && k.includes(fileName)
  );
  if (globKey) {
    return audioModules[globKey];
  }

  console.warn('[Part1] 音频未找到:', jsonPath, 'test' + testNum, fileName);
  return '';
}

// --- 加载10个JSON文件 ---
const jsonModules = import.meta.glob<{ sets: Array<{ set_id: string; title: string; directions: string; think_time_sec: number; groups: RawGroup[] }> }>('@/data/part1_bank/sim*.json', {
  eager: true,
  import: 'default',
});

interface RawDialogueLine {
  speaker: string;
  text: string;
}

interface RawQuestion {
  q_no: number;
  question: string;
  options: Record<string, string>;
  answer: string;
  audio_question: string;
  explanation?: string;
}

interface RawGroup {
  group_id: string;
  dialogue: RawDialogueLine[];
  questions: RawQuestion[];
  audio_dialogue: string;
  slot: string;
}

// --- 解析所有group并按slot分类 ---

/**
 * 根据对话内容推断场景类别，用于组卷时避免同卷出现同类场景。
 * 注意判断顺序：q9_12 的对话前半段是偏置绕飞、后半段才出现 MAYDAY，
 * 因此 offset 必须先于 emergency 判断，保证该 slot 类别稳定。
 */
function classifyScenario(dialogue: string): string {
  const t = dialogue.toLowerCase();
  if (t.includes('offset')) return 'offset';
  if (t.includes('panpan') || t.includes('mayday')) return 'emergency';
  if (
    t.includes('tcas') ||
    t.includes('traffic indication') ||
    /traffic (at|on) /.test(t) ||
    t.includes("o'clock")
  ) return 'traffic';
  if (t.includes('cleared for takeoff') || t.includes('line up')) return 'takeoff';
  if (
    t.includes('established ils') ||
    t.includes('cleared to land') ||
    t.includes('continue approach') ||
    t.includes('final') ||
    t.includes('vacating')
  ) return 'landing';
  if (t.includes('arrival') || t.includes('descend') || t.includes('descent') || t.includes('qnh')) return 'arrival';
  if (t.includes('taxi') || t.includes('holding point') || t.includes('hold short')) return 'taxi';
  return 'ground-service';
}

const groupsBySlot: Record<Part1Slot, Part1Group[]> = {
  q1_5: [],
  q6_8: [],
  q9_12: [],
  q13_15: [],
};

let totalGroups = 0;

Object.values(jsonModules).forEach((data) => {
  data.sets.forEach((set) => {
    set.groups.forEach((rawGroup: RawGroup) => {
      const slot = rawGroup.slot as Part1Slot;
      if (!groupsBySlot[slot]) {
        console.warn('[Part1] 未知slot:', rawGroup.slot, rawGroup.group_id);
        return;
      }

      const group: Part1Group = {
        groupId: rawGroup.group_id,
        setId: set.set_id,
        title: set.title,
        slot,
        scenario: classifyScenario(rawGroup.dialogue.map((d) => d.text).join(' ')),
        dialogue: rawGroup.dialogue.map((d) => `${d.speaker}: ${d.text}`).join('\n'),
        dialogueAudio: resolveAudio(rawGroup.audio_dialogue),
        questions: rawGroup.questions.map((q) => ({
          qNo: q.q_no,
          question: q.question,
          options: [
            `A. ${q.options.A}`,
            `B. ${q.options.B}`,
            `C. ${q.options.C}`,
            `D. ${q.options.D}`,
          ],
          answer: q.answer,
          questionAudio: resolveAudio(q.audio_question),
          explanation: q.explanation,
        })),
      };

      groupsBySlot[slot].push(group);
      totalGroups++;
    });
  });
});

console.log('[Part1] 题库加载完成:', {
  总组数: totalGroups,
  q1_5: groupsBySlot.q1_5.length,
  q6_8: groupsBySlot.q6_8.length,
  q9_12: groupsBySlot.q9_12.length,
  q13_15: groupsBySlot.q13_15.length,
});

// --- 组卷函数 ---

/** 从数组中随机选取n个不重复的元素 */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** 题目文本归一化，用于判断"完全重复" */
function normText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 抽取最大重试次数：贪心抽取在当前题库下一次即可满足约束，重试仅为题库变化后的保险 */
const MAX_PICK_ATTEMPTS = 200;

/**
 * 从 pool 中随机抽 n 组，要求：
 *  1. 每组场景类别不与 usedScenarios 中已有的重复；
 *  2. 每组的问题文本不与已选题目完全重复（hasDupText）。
 * 抽取成功后会通过 markTexts 登记题目文本。
 * 若重试 MAX_PICK_ATTEMPTS 次仍无法满足场景约束，则放宽场景约束（仍保证无完全重复题目）。
 */
function pickWithConstraints(
  pool: Part1Group[],
  n: number,
  usedScenarios: Set<string>,
  hasDupText: (g: Part1Group) => boolean,
  markTexts: (g: Part1Group) => void,
): Part1Group[] {
  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const scenarios = new Set(usedScenarios);
    const picked: Part1Group[] = [];
    for (const g of shuffled) {
      if (picked.length >= n) break;
      if (scenarios.has(g.scenario) || hasDupText(g)) continue;
      scenarios.add(g.scenario);
      picked.push(g);
    }
    if (picked.length === n) {
      picked.forEach(markTexts);
      return picked;
    }
  }

  // 兜底：放宽场景约束，仅保证无完全重复题目
  console.warn('[Part1] 场景去重多次重试仍未满足，放宽场景约束组卷');
  const picked = pickRandom(pool.filter((g) => !hasDupText(g)), n);
  picked.forEach(markTexts);
  return picked;
}

/** 按规则生成一套试卷（15题）：同卷无完全重复题目，Q1-Q5 及三个大题组内部/之间场景类别互不重复 */
export function generatePart1Exam(): Part1Group[] {
  // 已选题目的文本集合（跨整套试卷），用于排除完全重复的题目
  const usedTexts = new Set<string>();
  const questionTexts = (g: Part1Group) => g.questions.map((q) => normText(q.question));
  const hasDupText = (g: Part1Group) => questionTexts(g).some((t) => usedTexts.has(t));
  const markTexts = (g: Part1Group) => questionTexts(g).forEach((t) => usedTexts.add(t));

  // Q1-Q5: 从q1_5 slot中随机抽5组，5组场景类别互不相同
  const q1_5 = pickWithConstraints(groupsBySlot.q1_5, 5, new Set(), hasDupText, markTexts);

  // Q6-Q8、Q9-Q12、Q13-Q15: 各随机抽1组，三组之间场景类别互不相同
  const bigScenarios = new Set<string>();
  const bigGroups: Part1Group[] = [];
  for (const slot of ['q6_8', 'q9_12', 'q13_15'] as Part1Slot[]) {
    const picked = pickWithConstraints(groupsBySlot[slot], 1, bigScenarios, hasDupText, markTexts);
    picked.forEach((g) => bigScenarios.add(g.scenario));
    bigGroups.push(...picked);
  }

  // 合并为完整的试卷（保持题号顺序）
  const exam = [...q1_5, ...bigGroups];

  console.log('[Part1] 组卷完成:', exam.map((g) => `${g.groupId}[${g.scenario}](Q${g.questions.map((q) => q.qNo).join(',')})`).join(' | '));

  return exam;
}

/** 获取题库统计信息 */
export function getPart1BankStats() {
  return {
    totalGroups,
    q1_5: groupsBySlot.q1_5.length,
    q6_8: groupsBySlot.q6_8.length,
    q9_12: groupsBySlot.q9_12.length,
    q13_15: groupsBySlot.q13_15.length,
  };
}

export type { Part1Group, Part1Slot } from './types';
