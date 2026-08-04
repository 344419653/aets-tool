export interface Question {
  id: number;
  dialogue: string;
  question: string;
  audio: string;
  options: Option[];
  correctAnswer: string;
  explanation: string;
}

export interface Option {
  label: string;
  text: string;
}

export type ExamStatus = 'idle' | 'playing' | 'answering' | 'submitted';

export interface ExamResult {
  totalQuestions: number;
  correctCount: number;
  score: number;
  answers: {
    questionId: number;
    selectedOption: string | null;
    correctOption: string;
    isCorrect: boolean;
  }[];
}

// ===== Part 2: 听力简答 (Listening Short Answer) =====

export interface ShortAnswerMaterial {
  id: number;
  type: 'exchange' | 'passage';
  title: string;
  content?: string;
  /** 话题分类（如 emergency, weather, routine 等） */
  category?: string;
  /** 难度等级（easy / medium / hard） */
  difficulty?: string;
  /** 完整对话文字稿 */
  script?: string;
  audio: string;
  questions: ShortAnswerQuestion[];
}

export interface ShortAnswerQuestion {
  id: number;
  text: string;
  referenceAnswer: string;
  /** 评分关键词 */
  keywords?: string[];
  audio: string; // 问题朗读音频
  audioRecording?: Blob | null;
}



export interface ShortAnswerRecording {
  questionId: number;
  blob: Blob;
  duration: number; // 录音时长（毫秒）
}

/** 听力简答单题评分报告（自评或教员打分，照搬故事复述的维度结构） */
export interface ShortAnswerAssessment {
  /** 考生回答的语音识别转写文本（本地 Whisper，仅供参考） */
  transcript: string;
  /** 各关键词是否覆盖（与题目 keywords 顺序一致） */
  keywordCovered: boolean[];
  /** 各维度得分（1-5）：内容完整性/关键词覆盖/流利度/语法词汇/发音 */
  dimensions: Record<'content' | 'keywords' | 'fluency' | 'grammar' | 'pronunciation', number>;
  /** 总分（满分 25） */
  totalScore: number;
}

export interface ShortAnswerResult {
  materials: {
    materialId: number;
    questions: {
      questionId: number;
      hasRecording: boolean;
      recordingDuration?: number;
      /** 该题的自评/教员评分报告（可选） */
      assessment?: ShortAnswerAssessment;
    }[];
  }[];
  /** 所有录音文件，可用于上传评分 */
  recordings: ShortAnswerRecording[];
}

// ===== Part 3: 故事复述 (Story Telling / Retelling) =====

export interface StoryKeyword {
  chinese: string;
  english: string;
}

export interface StoryMaterial {
  id: number;
  title: string;
  outline: string; // 中文故事梗概
  keywords: StoryKeyword[]; // 5个关键词（中英对照）
  storyAudio: string; // 故事独白音频（播放两遍）
  /** 故事英文原文（复述的参考答案，结果页展示） */
  transcript?: string;
}

export interface StoryTellingResult {
  storyId: number;
  hasRecording: boolean;
  recordingDuration?: number;
  /** 复述录音 Blob */
  recordingBlob?: Blob;
  /** 考生复述的语音识别转写文本（浏览器支持实时转写时才有，仅供参考） */
  transcript?: string;
  /** 自评/教员评分报告（可选） */
  assessment?: StoryAssessment;
}

/** 故事复述评分报告（自评或教员打分） */
export interface StoryAssessment {
  /** 各关键词是否覆盖（与材料 keywords 顺序一致） */
  keywordCovered: boolean[];
  /** 各维度得分（1-5）：内容完整性/关键词覆盖/流利度/语法词汇/发音 */
  dimensions: Record<'content' | 'keywords' | 'fluency' | 'grammar' | 'pronunciation', number>;
  /** 总分（满分 25） */
  totalScore: number;
}

// ===== Part 4: 模拟通话 (Simulation) =====

/** 模拟通话中的一轮对话 */
export interface SimulationRound {
  /** 轮次序号（从1开始） */
  roundIndex: number;
  /** Pilot通话音频路径列表（可能有多段，需按顺序播放） */
  pilotAudios: string[];
  /** 背景音/回答间隔音频路径 */
  backgroundAudio: string;
  /** Pilot通话文字稿列表（与 pilotAudios 对应） */
  pilotScripts: string[];
  /** 参考答案（Controller应回应的内容） */
  referenceAnswer: string;
  /** 本轮情境描述 */
  context: string;
  /** 重要信息（关键词），用于评分报告页的关键词覆盖检查（来自 src/data/part4Keywords.ts） */
  keywords: string[];
}

/** 模拟通话材料 */
export interface SimulationMaterial {
  id: number;
  title: string;
  /** 考试说明音频 */
  introAudio: string;
  /** 结束语音频 */
  outroAudio: string;
  /** 各轮对话 */
  rounds: SimulationRound[];
}

/** 模拟通话录音结果 */
export interface SimulationRecording {
  roundIndex: number;
  blob: Blob;
  duration: number;
}

export interface SimulationResult {
  simulationId: number;
  recordings: SimulationRecording[];
  /** 总轮数 */
  totalRounds: number;
  /** 完成轮数 */
  completedRounds: number;
  /** 各轮评分结果（按 roundIndex 索引，结构与听力简答一致，总分 25；评分报告页确认提交后写入） */
  assessments?: Record<number, ShortAnswerAssessment>;
}

// ===== Part 5: OPI (Oral Proficiency Interview) =====

/** OPI 考试阶段 */
export type OPIPhase =
  | 'warmup'      // 热身：自我介绍
  | 'levelcheck'  // 程度检验
  | 'picture'     // 看图说话
  | 'probe'       // 能力侦测
  | 'winddown';   // 结束

/** OPI 单个问题 */
export interface OPIQuestion {
  id: number;
  phase: OPIPhase;
  /** 考官问题（英文） */
  question: string;
  /** 问题中文翻译 */
  questionCn?: string;
  /** 参考答案提示 */
  referenceHint?: string;
  /** 准备时间（秒），0表示不限制 */
  prepareTime: number;
  /** 回答时间（秒），0表示不限制 */
  answerTime: number;
  /** 考官语音音频路径 */
  audio?: string;
  /** 图片URL（看图说话用） */
  imageUrl?: string;
}

/** OPI 套题模式：单道题（跨套抽题组组卷） */
export interface OPISetQuestion {
  id: number;
  /** 全局唯一标识（setNumber * 100 + id），跨套抽题时避免不同套之间 id 冲突 */
  uid: number;
  /** 来源套题编号 */
  setNumber: number;
  /** 考官问题（英文） */
  question: string;
  /** 问题中文翻译 */
  questionCn: string;
  /** 所属话题块（如 自我介绍 / 复飞） */
  topic: string;
  /** 题型（如 观点类 / 处置类） */
  type: string;
  /** 参考答案（回听界面展示，供考生自评或教员对照评分） */
  answer: string;
  /** 考官问题音频 URL */
  audio?: string;
  /** 组间过渡语文本（仅每组第一题有；开场组无） */
  introText?: string;
  /** 组间过渡语音频 URL（仅每组第一题有），播放题问音频前先播它 */
  introAudio?: string;
}

/** 一套 OPI 考题 */
export interface OPIExamSet {
  /** 套题编号（与 OPI_{n}.json / part5_opi/OPI_{nn}/ 对应）；跨套抽题组卷时为 0 */
  setNumber: number;
  /** 本套话题块 */
  topicBlocks: string[];
  questions: OPISetQuestion[];
  /** 抽题来源：每个题组一个元素，记录该题组来自哪一套 */
  sourceSets: number[];
}

/** OPI 录音结果 */
export interface OPIRecording {
  questionId: number;
  blob: Blob;
  duration: number;
}

/** OPI 考试结果 */
export interface OPIResult {
  recordings: OPIRecording[];
  totalQuestions: number;
  completedQuestions: number;
  /** 各题评分结果（按 question uid 索引，结构与听力简答一致，总分 25；评分报告页确认提交后写入） */
  assessments?: Record<number, ShortAnswerAssessment>;
}

// ===== Part 1: 听力理解 (Listening Comprehension - New Bank) =====

export interface Part1Answer {
  qNo: number;
  /** 题库组内题号（q.q_no，跨次稳定，用作错题本/收藏的条目 key 一部分；
   *  qNo 是新卷序号、每次组卷重排，不能作持久化 key） */
  bankQNo: number;
  /** 用户选择的选项字母；超时未作答为 null */
  userAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  groupId: string;
  /** 场景类别（offset/emergency/traffic/...），用于错题本筛选展示 */
  scenario?: string;
  /** 对话音频路径（用于错题本/结果页回放，带倍速） */
  dialogueAudio?: string;
  /** 题目原文（用于结果页答案解析展示） */
  questionText: string;
  /** 选项列表（如 "A. Stop before RWY05L."） */
  options: string[];
  /** 该题所属对话原文（P=飞行员 C=管制员，按行排列） */
  dialogue: string;
  /** 答案解析（题库暂无此内容，预留） */
  explanation?: string;
}

export interface Part1Result {
  answers: Part1Answer[];
  correctCount: number;
  totalQuestions: number;
  score: number;
}

// ===== 本地持久化（错题本 / 收藏 / 历史与进度，均存 localStorage） =====

/** 错题本条目（仅收录 Part 1 答错题），key 为 `p1:{groupId}:{bankQNo}` */
export interface NotebookEntry {
  key: string;
  groupId: string;
  bankQNo: number;
  scenario?: string;
  questionText: string;
  /** 选项列表（如 "A. Stop before RWY05L."） */
  options: string[];
  correctAnswer: string;
  /** 最近一次的错误选择（未作答为 null） */
  userAnswer: string | null;
  dialogue: string;
  explanation?: string;
  dialogueAudio?: string;
  /** 累计错误次数 */
  wrongCount: number;
  /** 最近一次错误时间戳 */
  lastWrongAt: number;
}

/** 收藏条目，key 约定：p1:{groupId}:{bankQNo} / p2:{storyId} / p3:{questionId} / p4:{simulationId}:{roundIndex} / p5:{uid} */
export interface FavoriteEntry {
  key: string;
  /** 所属部分 1-5 */
  part: 1 | 2 | 3 | 4 | 5;
  /** 标题（列表展示） */
  title: string;
  /** 题目/提示文本 */
  text?: string;
  /** 参考答案/原文等详情文本 */
  detail?: string;
  /** 当时评分（满分 25，可选） */
  score?: number;
  /** Part 1 收藏的完整题目信息（用于详情卡展示与回放） */
  part1?: {
    groupId: string;
    bankQNo: number;
    questionText: string;
    options: string[];
    correctAnswer: string;
    userAnswer: string | null;
    dialogue: string;
    explanation?: string;
    dialogueAudio?: string;
  };
  createdAt: number;
}

/** 一条历史记录（一次完整或单项测试结束） */
export interface ExamHistoryRecord {
  id: string;
  /** 结束时间戳 */
  finishedAt: number;
  /** 模式描述，如 "完整考试" / "单项·第一部分" */
  mode: string;
  /** 各部分得分摘要 */
  summaries: { label: string; value: string }[];
}

/** 中断续做快照（部分级：已完成到第 N 部分，从下一部分继续；录音 Blob 不持久化） */
export interface ExamProgressSnapshot {
  /** 已完成部分数（1=Part1 完成 … 3=Part3 完成） */
  completedParts: number;
  /** 恢复后进入的阶段 */
  nextPhase: 'part2-retelling' | 'part3-shortanswer' | 'part4-simulation';
  savedAt: number;
  /** Part 1 结果（ExamResult 形式，纯文本可序列化） */
  results: Record<string, ExamResult>;
  /** Part 1 题目详情（供结果页解析展示） */
  part1Questions: Question[];
  /** Part 2 结果（去掉 recordingBlob） */
  storyTelling: Omit<StoryTellingResult, 'recordingBlob'> | null;
  /** Part 3 结果（recordings 置空——Blob 无法持久化） */
  shortAnswer: ShortAnswerResult | null;
}
