/** Part1 题目slot类型 */
export type Part1Slot = 'q1_5' | 'q6_8' | 'q9_12' | 'q13_15';

/** Part1 单道题 */
export interface Part1Question {
  qNo: number;        // 题号 1-15
  question: string;   // 问题文字
  options: string[];  // 4个选项 ["A. xxx", "B. xxx", ...]
  answer: string;     // 正确答案 "A"|"B"|"C"|"D"
  questionAudio: string; // 问题音频URL
  explanation?: string;  // 答案解析（中文，结果页展示）
}

/** Part1 一个group（一段对话+若干问题） */
export interface Part1Group {
  groupId: string;       // e.g. "sim1_g1"
  setId: string;         // e.g. "sim1"
  title: string;         // e.g. "AETS test simulation 1"
  slot: Part1Slot;       // 所属slot
  scenario: string;      // 场景类别（由对话内容推断，用于组卷去重）
  dialogue: string;      // 对话全文（P: ...\nC: ...）
  dialogueAudio: string; // 对话音频URL
  questions: Part1Question[]; // 该group下的所有问题
}

/** Part1 答题结果 */
export interface Part1Answer {
  qNo: number;
  userAnswer: string;    // 用户选择的选项
  correctAnswer: string; // 正确答案
  isCorrect: boolean;
}

/** Part1 考试结果 */
export interface Part1Result {
  answers: Part1Answer[];
  correctCount: number;
  totalQuestions: number;
  score: number; // 百分比
}
