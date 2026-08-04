// Part 2 故事复述的自动评分规则引擎（全部本地计算，无任何网络/AI 依赖）。
// 输入考生的语音识别转写文本、录音时长、故事参考内容与识别置信度，
// 输出五个维度各 1-5 分（无法估算的维度返回 null，界面保留手动评分）及中文依据说明。

import type { StoryKeyword } from '@/types/exam';

export type StoryDimKey = 'content' | 'keywords' | 'fluency' | 'grammar' | 'pronunciation';

export interface AutoScoreInput {
  /** 考生复述的语音识别转写文本（英文） */
  transcript: string;
  /** 录音时长（秒）；未知传 null */
  durationSec: number | null;
  /** 故事关键词（中英对照） */
  keywords: StoryKeyword[];
  /** 故事英文原文；未录入传 null */
  storyTranscript: string | null;
  /** 各 final 识别结果的 confidence 均值（0-1）；无数据传 null */
  confidence: number | null;
}

export interface AutoScoreResult {
  /** 各维度自动得分（1-5）；null 表示该维无法自动估算 */
  scores: Partial<Record<StoryDimKey, number>>;
  /** 各维度一句中文依据说明 */
  reasons: Partial<Record<StoryDimKey, string>>;
  /** 关键词覆盖布尔数组（与 keywords 顺序一致） */
  keywordCovered: boolean[];
}

/** 英文停用词（用于提取故事原文的内容词） */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'from', 'by', 'as', 'is', 'was', 'were', 'are', 'be', 'been', 'being',
  'it', 'its', 'he', 'she', 'they', 'them', 'his', 'her', 'their', 'this', 'that',
  'these', 'those', 'there', 'here', 'i', 'we', 'you', 'my', 'our', 'your', 'me',
  'us', 'him', 'not', 'no', 'do', 'does', 'did', 'have', 'has', 'had', 'will',
  'would', 'could', 'should', 'can', 'may', 'might', 'then', 'than', 'when',
  'while', 'after', 'before', 'if', 'because', 'about', 'into', 'out', 'up',
  'down', 'over', 'very', 'just', 'also', 'who', 'whom', 'which', 'what', 'how',
  'all', 'some', 'any', 'one', 'two', 'said', 'say',
]);

/** 小写归一化并切词（只保留字母与数字） */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** 判断单个关键词是否被转写文本覆盖 */
function keywordCovered(keywordEnglish: string, words: string[], joined: string): boolean {
  const kw = keywordEnglish.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').trim();
  if (!kw) return false;
  // 先整体子串匹配
  if (joined.includes(kw)) return true;
  // 多词关键词：各词都出现且相对顺序一致（松散匹配）
  const kwWords = kw.split(/\s+/).filter(Boolean);
  if (kwWords.length <= 1) return false;
  let pos = 0;
  for (const kwWord of kwWords) {
    let found = false;
    while (pos < words.length) {
      if (words[pos] === kwWord) { found = true; pos += 1; break; }
      pos += 1;
    }
    if (!found) return false;
  }
  return true;
}

/**
 * 故事复述自动评分主函数。
 * 转写文本为空时各维度均返回 null（调用方应走纯手动评分）。
 */
export function scoreStoryRetelling(input: AutoScoreInput): AutoScoreResult {
  const { durationSec, keywords, storyTranscript, confidence } = input;
  const words = tokenize(input.transcript);
  const joined = ` ${words.join(' ')} `;
  const totalWords = words.length;

  const scores: AutoScoreResult['scores'] = {};
  const reasons: AutoScoreResult['reasons'] = {};

  if (totalWords === 0) {
    return { scores, reasons, keywordCovered: keywords.map(() => false) };
  }

  // --- keywords 关键词覆盖 ---
  const covered = keywords.map((kw) => keywordCovered(kw.english, words, joined));
  if (keywords.length > 0) {
    const coveredCount = covered.filter(Boolean).length;
    scores.keywords = Math.max(1, Math.round((coveredCount / keywords.length) * 5));
    reasons.keywords = `自动匹配到 ${coveredCount}/${keywords.length} 个关键词`;
  }

  // --- fluency 流利度（词数/分钟） ---
  if (durationSec && durationSec > 0) {
    const wpm = Math.round(totalWords / (durationSec / 60));
    // 用户反馈偏严格：在语速定档基础上整体上调 1 分（封顶 5）作为预评分
    const base = wpm >= 110 ? 5 : wpm >= 90 ? 4 : wpm >= 70 ? 3 : wpm >= 50 ? 2 : 1;
    scores.fluency = Math.min(5, base + 1);
    const pace = wpm >= 110 ? '语速正常偏快' : wpm >= 90 ? '语速自然' : wpm >= 70 ? '语速尚可' : '偏慢';
    reasons.fluency = `语速约 ${wpm} 词/分钟，${pace}`;
  } else {
    // 录音时长未知，保守给 3 并注明
    scores.fluency = 3;
    reasons.fluency = '录音时长未知，语速无法计算，暂按 3 分保守预评';
  }

  // --- content 内容完整性（覆盖故事原文内容词的比例） ---
  if (storyTranscript) {
    const contentWords = new Set(
      tokenize(storyTranscript).filter((w) => !STOP_WORDS.has(w) && w.length > 2)
    );
    if (contentWords.size > 0) {
      const spoken = new Set(words);
      let hit = 0;
      contentWords.forEach((w) => { if (spoken.has(w)) hit += 1; });
      const ratio = hit / contentWords.size;
      scores.content = ratio >= 0.75 ? 5 : ratio >= 0.6 ? 4 : ratio >= 0.45 ? 3 : ratio >= 0.3 ? 2 : 1;
      reasons.content = `覆盖原文内容词约 ${Math.round(ratio * 100)}%（${hit}/${contentWords.size}）`;
    }
  }
  // storyTranscript 缺失：不自动评分（界面保留手动评分）

  // --- grammar 语法与词汇（词汇多样性启发，仅供参考） ---
  const uniqueWords = new Set(words).size;
  const ttr = uniqueWords / totalWords;
  if (totalWords < 30) {
    scores.grammar = 2;
    reasons.grammar = `仅识别到 ${totalWords} 词，语料太少，暂评 2 分`;
  } else if (ttr >= 0.5 && totalWords >= 60) {
    scores.grammar = 4;
    reasons.grammar = `词汇多样性 ${ttr.toFixed(2)}，用词较丰富（基于词汇多样性估算，请人工复核）`;
  } else if (ttr < 0.3) {
    scores.grammar = 2;
    reasons.grammar = `词汇多样性仅 ${ttr.toFixed(2)}，重复较多（基于词汇多样性估算，请人工复核）`;
  } else {
    scores.grammar = 3;
    reasons.grammar = `词汇多样性 ${ttr.toFixed(2)}，中等水平（基于词汇多样性估算，请人工复核）`;
  }

  // --- pronunciation 发音（以识别置信度为代理，仅供参考） ---
  if (confidence !== null && confidence > 0) {
    scores.pronunciation =
      confidence >= 0.9 ? 5 : confidence >= 0.8 ? 4 : confidence >= 0.65 ? 3 : confidence >= 0.5 ? 2 : 1;
    reasons.pronunciation = `识别置信度均值 ${(confidence * 100).toFixed(0)}%（基于识别置信度估算，仅供参考）`;
  }
  // 无 confidence 数据：不自动评分

  return { scores, reasons, keywordCovered: covered };
}
