import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { OPIResult, OPIRecording, ShortAnswerAssessment, StoryKeyword } from '@/types/exam';
import { generateOPIExamSet, opiSets } from '@/data/opi';
import { scoreStoryRetelling, type StoryDimKey } from '@/lib/storyAutoScore';
import { scoreShortAnswerWithLLM, clampLlmScore, type LlmScoreResult } from '@/lib/llmScore';
import { transcribeAudio } from '@/lib/whisperTranscribe';
import { evaluateFreeSpeech, iseToFive } from '@/lib/iseEvaluate';
import FavoriteButton from '@/components/FavoriteButton';
import RateAudio from '@/components/RateAudio';
import PlaybackRateButton from '@/components/PlaybackRateButton';

interface Props {
  onComplete: (result: OPIResult) => void;
}

type ScreenPhase =
  | 'outline'
  | 'preparing'
  | 'recording'
  | 'review'
  | 'report'
  | 'submitted';

/** 评分维度（AETS 口语面试评分标准，每项 1-5 分，与 Part 2-4 同一套维度） */
const DIMENSIONS = [
  { key: 'content', label: '内容完整性', desc: '回答是否切题、要点充分，紧扣考官问题作答' },
  { key: 'keywords', label: '关键词覆盖', desc: '参考答案要点是否用上（随下方勾选自动给分，可手动调整）' },
  { key: 'fluency', label: '流利度与连贯性', desc: '语速自然、长时间停顿少、表达连贯' },
  { key: 'grammar', label: '语法与词汇', desc: '句型结构正确、时态一致、用词恰当' },
  { key: 'pronunciation', label: '发音', desc: '清晰易懂，单词重音与句子语调正确' },
] as const;

type DimKey = (typeof DIMENSIONS)[number]['key'];

/** 各维度偏弱时的改进建议（content/keywords 针对口语面试改写，其余复用听力简答文案） */
const DIM_SUGGESTIONS: Record<DimKey, string> = {
  content: '回答未充分覆盖问题要点，注意听清考官的疑问词，围绕问题给出具体、完整的回答。',
  keywords: '参考答案的要点遗漏较多，平时可围绕高频话题积累观点与表达，回答时尽量覆盖要点。',
  fluency: '多做影子跟读（shadowing）练习，减少长时间停顿、重复和自我纠正，保持语流连续。',
  grammar: '注意主谓一致、时态统一和基本句型，避免逐字中译英，多用简单句把意思说完整。',
  pronunciation: '对照标准音频逐句模仿，注意单词重音、句子语调，保持发音清晰易懂。',
};

/** 英文停用词（与 storyAutoScore.ts 同源，用于从参考答案中提取内容词） */
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

/**
 * 从 OPI 题参考答案中提取 4-6 个内容词作为"关键词"：
 * 小写切词 → 去停用词、只留长度 ≥4 的词 → 按出现频率再按词长排序取前 5
 * （不足 4 个时有多少算多少）。结果同时用于 LLM 评分、本地兜底预评与报告页覆盖勾选。
 */
function extractKeywords(answer: string): string[] {
  const words = answer
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([w]) => w);
}

/** 报告页每题的评分/转写状态（按 question uid 存，结构照搬 Part 3 听力简答） */
interface ReportQState {
  /** 转写出的英文文本（完成后才有值） */
  transcript: string;
  /** 转写流程状态：idle 未开始 / loading 模型下载加载中 / transcribing 转写中 / done 完成 / error 失败 */
  stage: 'idle' | 'loading' | 'transcribing' | 'done' | 'error';
  /** 模型下载进度百分比（0-100，未知为 null） */
  modelProgress: number | null;
  /** 转写失败信息（用于报告页提示与重试） */
  error: string | null;
  /** 关键词覆盖（与该题提取的关键词顺序一致，由转写文本自动比对，界面只读展示） */
  keywordChecks: boolean[];
  /** 各维度得分（1-5，0/缺省表示未评分） */
  dimScores: Partial<Record<DimKey, number>>;
  /** 自动评分各维度的依据说明（转写/ISE 评测完成后计算） */
  autoReasons: Partial<Record<StoryDimKey, string>>;
  /** 已自动预评过的转写文本，避免用户手动改分后被重复预评覆盖 */
  lastAutoScored: string;
  /** 本次录音实际时长（秒），供流利度评分使用 */
  durationSec: number | null;
  /** 讯飞 ISE 发音评测状态：idle 未开始 / evaluating 评测中 / done 完成 / error 失败（含代理未启动） */
  iseStage: 'idle' | 'evaluating' | 'done' | 'error';
  /** ISE 评测失败信息（用于报告页温和提示） */
  iseError: string | null;
  /** ISE 引擎判定疑似乱读/拒识（建议分仅供参考） */
  iseRejected: boolean;
  /** LLM 生成的针对性反馈（有值时替换评估报告的模板化亮点/扣分点/建议） */
  llmFeedback: { strengths: string[]; weaknesses: string[]; suggestions: string[] } | null;
  /** LLM 按 ASR 近音容错规则校正后的转写文本（与原转写不同才有值，报告页优先显示） */
  correctedTranscript: string | null;
  /** 本地算法（词面匹配）预评出的维度分，供 LLM 评分到达时判断"用户是否已手改" */
  localAutoScores: Partial<Record<DimKey, number>>;
}

/** 生成某题的初始报告状态 */
const initReportQState = (kwCount: number): ReportQState => ({
  transcript: '',
  stage: 'idle',
  modelProgress: null,
  error: null,
  keywordChecks: Array.from({ length: kwCount }, () => false),
  dimScores: {},
  autoReasons: {},
  lastAutoScored: '',
  durationSec: null,
  iseStage: 'idle',
  iseError: null,
  iseRejected: false,
  llmFeedback: null,
  correctedTranscript: null,
  localAutoScores: {},
});

/** 淡入淡出动画组件 */
function FadeIn({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`animate-fadeIn ${className}`}>
      {children}
    </div>
  );
}

export default function Part5OPIScreen({ onComplete }: Props) {
  const [examSet] = useState(() => generateOPIExamSet());
  const examQuestions = examSet.questions;
  const [screenPhase, setScreenPhase] = useState<ScreenPhase>('outline');
  const [qIdx, setQIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [recordings, setRecordings] = useState<OPIRecording[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [examStartTime] = useState(Date.now);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  // 缓存Blob URL，防止内存泄漏
  const blobUrlMapRef = useRef<Map<number, string>>(new Map());

  // --- 评分报告状态（报告页按题逐步展示，数据按 question uid 存，照搬 Part 3 听力简答模式） ---
  const [reportStates, setReportStates] = useState<Record<number, ReportQState>>({});
  // 报告页当前展示的录音下标
  const [reportIndex, setReportIndex] = useState(0);
  // 报告页各信息卡片的展开状态（key 为 "题目uid:卡片名"，默认全部折叠，点箭头展开）
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const toggleCard = (key: string) => setExpandedCards((s) => ({ ...s, [key]: !s[key] }));
  // 各题转写/ISE 评测任务递增 id：进入报告页重跑或组件卸载时使旧的异步结果失效，防止串题覆盖
  const transcribeRunRef = useRef<Record<number, number>>({});
  const iseRunRef = useRef<Record<number, number>>({});

  const q = examQuestions[qIdx];
  const total = examQuestions.length;

  // 各题从参考答案中提取的关键词（按 uid 缓存，供 LLM/本地预评与报告页共用）
  const keywordsByUid = useMemo(() => {
    const map = new Map<number, string[]>();
    examQuestions.forEach((qq) => map.set(qq.uid, extractKeywords(qq.answer ?? '')));
    return map;
  }, [examQuestions]);

  const getTopicLabel = () => {
    if (!q) return '';
    return q.topic;
  };

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // 卸载时使进行中的转写/ISE 评测结果失效（任务仍在跑，但结果会被丢弃）
    transcribeRunRef.current = {};
    iseRunRef.current = {};
  }, []);

  useEffect(() => {
    return () => {
      // 组件卸载时释放所有Blob URL
      blobUrlMapRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlMapRef.current.clear();
      cleanup();
    };
  }, [cleanup]);

  // 启动倒计时
  const startCountdown = useCallback((seconds: number, onEnd: () => void) => {
    setCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          onEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // 播放考官语音
  const playExaminerAudio = useCallback((src: string, onEnded: () => void) => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onEnded, { once: true });
    audio.play().catch(onEnded);
  }, []);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordings((prev) => [
          ...prev,
          { questionId: q.uid, blob, duration: Date.now() - recordingStartTimeRef.current },
        ]);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recordingStartTimeRef.current = Date.now();
    } catch {
      alert('无法访问麦克风');
    }
  }, [q]);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // 进入下一题
  const nextQuestion = useCallback(() => {
    if (qIdx + 1 < total) {
      setQIdx((prev) => prev + 1);
      setScreenPhase('preparing');
    } else {
      setScreenPhase('review');
    }
  }, [qIdx, total]);

  // 跳过当前语音（依赖必须列全，否则会闭包捕获到第1题的 startRecording）
  const skipAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setScreenPhase('recording');
    startRecording();
    startCountdown(60, () => {
      stopRecording();
      nextQuestion();
    });
  }, [startRecording, startCountdown, stopRecording, nextQuestion]);

  // 重新开始整个考试
  const handleRestart = useCallback(() => {
    cleanup();
    // 释放Blob URL
    blobUrlMapRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlMapRef.current.clear();
    // 使进行中的转写/ISE 评测结果失效并清空报告状态
    transcribeRunRef.current = {};
    iseRunRef.current = {};
    setReportStates({});
    setReportIndex(0);
    setRecordings([]);
    setQIdx(0);
    setScreenPhase('outline');
  }, [cleanup]);

  // 启动某题的讯飞 ISE 发音评测（topic 英文自由题；代理未启动/评测失败时置 error，
  // 报告页温和提示、发音维度保持手动评分）
  const startIseEvaluation = useCallback((questionId: number, blob: Blob, questionText: string, refText: string) => {
    if (!refText) return; // 无参考答案的题跳过 ISE，发音维度手动评
    const runId = (iseRunRef.current[questionId] ?? 0) + 1;
    iseRunRef.current[questionId] = runId;
    setReportStates((s) => {
      const cur = s[questionId];
      if (!cur) return s;
      return { ...s, [questionId]: { ...cur, iseStage: 'evaluating', iseError: null, iseRejected: false } };
    });
    evaluateFreeSpeech(blob, questionText, refText).then((scores) => {
      if (iseRunRef.current[questionId] !== runId) return; // 过期任务，丢弃结果
      // 发音维度优先取 topic 专有的发音准确度（phoneScore），缺失则回退总分
      const phone = scores.phoneScore ?? scores.total;
      const five = iseToFive(phone);
      setReportStates((s) => {
        const cur = s[questionId];
        if (!cur) return s;
        return {
          ...s,
          [questionId]: {
            ...cur,
            iseStage: 'done',
            iseRejected: !!scores.isRejected,
            autoReasons: {
              ...cur.autoReasons,
              pronunciation: `发音准确度 ${phone.toFixed(0)}/100 → 建议 ${five} 分`,
            },
            // 仅在尚未手动打分时预填发音维度，不覆盖人工已给的分数
            dimScores: cur.dimScores.pronunciation
              ? cur.dimScores
              : { ...cur.dimScores, pronunciation: five },
          },
        };
      });
    }).catch((err: unknown) => {
      if (iseRunRef.current[questionId] !== runId) return;
      setReportStates((s) => {
        const cur = s[questionId];
        if (!cur) return s;
        return { ...s, [questionId]: { ...cur, iseStage: 'error', iseError: err instanceof Error ? err.message : String(err) } };
      });
    });
  }, []);

  // 启动某题的后台转写（进入报告页时对每题录音触发；失败可在报告页重试）。
  // 转写完成即做本地预评，并并行启动该题的 LLM 语义评分与讯飞 ISE 发音评测。
  const startTranscription = useCallback((questionId: number, blob: Blob) => {
    const qq = examQuestions.find((x) => x.uid === questionId);
    const kwList = keywordsByUid.get(questionId) ?? [];
    const runId = (transcribeRunRef.current[questionId] ?? 0) + 1;
    transcribeRunRef.current[questionId] = runId;
    setReportStates((s) => ({
      ...s,
      [questionId]: { ...(s[questionId] ?? initReportQState(kwList.length)), stage: 'loading', error: null, modelProgress: null },
    }));
    transcribeAudio(blob, (stage, percent) => {
      if (transcribeRunRef.current[questionId] !== runId) return; // 过期任务，忽略进度
      setReportStates((s) => {
        const cur = s[questionId];
        if (!cur) return s;
        return {
          ...s,
          [questionId]: stage === 'loading'
            ? { ...cur, stage: 'loading', modelProgress: percent }
            : { ...cur, stage: 'transcribing' },
        };
      });
    }).then((text) => {
      if (transcribeRunRef.current[questionId] !== runId) return; // 过期任务，丢弃结果
      // 转写完成即自动预评一次（同一文本不重复预评，避免覆盖人工已改的分数）
      setReportStates((s) => {
        const cur = s[questionId];
        if (!cur) return s;
        const nextState: ReportQState = { ...cur, transcript: text, stage: 'done', llmFeedback: null, correctedTranscript: null };
        if (text && cur.lastAutoScored !== text) {
          // 本地预评（词面匹配），作为 LLM 评分的兜底；fluency 维度始终由本地声学估算给出
          const auto = scoreStoryRetelling({
            transcript: text,
            durationSec: cur.durationSec,
            keywords: kwList.map((k): StoryKeyword => ({ english: k, chinese: '' })),
            // 口语面试的参考文本即参考答案
            storyTranscript: qq?.answer || null,
            // 无识别置信度数据，发音维度由讯飞 ISE 预评或手动评分
            confidence: null,
          });
          nextState.lastAutoScored = text;
          nextState.autoReasons = auto.reasons;
          // 只预填能自动估算的维度，空缺维度保持未评分等手动打分
          nextState.dimScores = { ...cur.dimScores, ...auto.scores };
          nextState.localAutoScores = auto.scores;
          nextState.keywordChecks = auto.keywordCovered.length > 0 ? auto.keywordCovered : cur.keywordChecks;
        }
        return { ...s, [questionId]: nextState };
      });
      // LLM 语义评分：同义改写同等给分，覆盖 content/keywords/grammar 三维并生成针对性反馈。
      // 仅覆盖用户尚未手动改过的维度（当前值仍等于本地预评值或空缺）；失败静默回退本地预评。
      if (qq && text) {
        void scoreShortAnswerWithLLM({
          question: qq.question,
          referenceAnswer: qq.answer ?? '',
          keywords: kwList,
          transcript: text,
          material: `OPI 话题：${qq.topic}`,
        }).then((r: LlmScoreResult) => {
          if (transcribeRunRef.current[questionId] !== runId) return;
          setReportStates((s) => {
            const cur = s[questionId];
            if (!cur) return s;
            // 用户未手改才用 LLM 分覆盖：当前分与本地预评分一致或维度仍空缺
            const pick = (dim: DimKey, llmScore: number | null): number | undefined => {
              if (llmScore === null) return undefined;
              const local = cur.localAutoScores[dim];
              const now = cur.dimScores[dim];
              return now === local || now === undefined ? llmScore : undefined;
            };
            const contentScore = pick('content', clampLlmScore(r.content?.score));
            const keywordsScore = pick('keywords', clampLlmScore(r.keywords?.score));
            const grammarScore = pick('grammar', clampLlmScore(r.grammar?.score));
            // LLM 判定 covered 的关键词（大小写不敏感的包含匹配）映射回 keywordChecks
            const coveredLower = (r.keywords?.covered ?? []).map((k) => k.toLowerCase());
            const missedLower = (r.keywords?.missed ?? []).map((k) => k.toLowerCase());
            const llmKwChecks = kwList.map((k, i) => {
              const kl = k.toLowerCase();
              if (coveredLower.some((c) => kl.includes(c) || c.includes(kl))) return true;
              if (missedLower.some((m) => kl.includes(m) || m.includes(kl))) return false;
              return cur.keywordChecks[i] ?? false;
            });
            const grammarIssues = (r.grammar?.issues ?? []).filter(Boolean);
            return {
              ...s,
              [questionId]: {
                ...cur,
                dimScores: {
                  ...cur.dimScores,
                  ...(contentScore !== undefined ? { content: contentScore } : {}),
                  ...(keywordsScore !== undefined ? { keywords: keywordsScore } : {}),
                  ...(grammarScore !== undefined ? { grammar: grammarScore } : {}),
                },
                autoReasons: {
                  ...cur.autoReasons,
                  ...(r.content?.reason ? { content: r.content.reason } : {}),
                  ...(r.keywords?.reason ? { keywords: r.keywords.reason } : {}),
                  ...(r.grammar?.reason || grammarIssues.length > 0
                    ? { grammar: [r.grammar?.reason, ...grammarIssues].filter(Boolean).join('；') }
                    : {}),
                },
                keywordChecks: kwList.length > 0 && (r.keywords?.covered || r.keywords?.missed)
                  ? llmKwChecks
                  : cur.keywordChecks,
                llmFeedback: {
                  strengths: (r.strengths ?? []).filter(Boolean),
                  weaknesses: (r.weaknesses ?? []).filter(Boolean),
                  suggestions: (r.suggestions ?? []).filter(Boolean),
                },
                correctedTranscript:
                  r.correctedTranscript && r.correctedTranscript.trim() !== text.trim()
                    ? r.correctedTranscript.trim()
                    : null,
              },
            };
          });
        }).catch((err: unknown) => {
          console.warn('[llm-score] LLM 评分不可用，保持本地预评:', err);
        });
      }
      // 讯飞 ISE 发音评测与转写串行衔接（转写完成即启动）：topic 英文自由题，
      // 试卷文本 = 考官问题 + 参考答案。失败温和降级，发音维度保持手动评分。
      if (qq && blob) startIseEvaluation(questionId, blob, qq.question, qq.answer ?? '');
    }).catch((err: unknown) => {
      if (transcribeRunRef.current[questionId] !== runId) return;
      setReportStates((s) => {
        const cur = s[questionId];
        if (!cur) return s;
        return { ...s, [questionId]: { ...cur, stage: 'error', error: err instanceof Error ? err.message : String(err) } };
      });
      // 转写失败也启动 ISE 发音评测（发音不依赖转写文本）
      if (qq) startIseEvaluation(questionId, blob, qq.question, qq.answer ?? '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examQuestions, keywordsByUid]);

  // 准备阶段：播放考官语音 → 语音结束后进入录音（启动60秒倒计时）
  useEffect(() => {
    if (screenPhase === 'preparing' && q) {
      const enterRecording = () => {
        setScreenPhase('recording');
        startRecording();
        startCountdown(60, () => {
          stopRecording();
          nextQuestion();
        });
      };

      const playQuestion = () => {
        if (q.audio) {
          playExaminerAudio(q.audio, enterRecording);
        } else {
          enterRecording();
        }
      };

      // 每组第一题先播组间过渡语（连接句），再播考官题问
      if (q.introAudio) {
        playExaminerAudio(q.introAudio, playQuestion);
      } else {
        playQuestion();
      }
    }
  }, [screenPhase, q, playExaminerAudio, startRecording, startCountdown, stopRecording, nextQuestion]);

  // 提交：进入评分报告页（不再直接 onComplete），并对全部录音启动转写
  // （每题转写完成即自动本地预评，并启动该题的 LLM 语义评分与讯飞 ISE 发音评测）
  const handleSubmit = useCallback(() => {
    cleanup();
    setReportIndex(0);
    setScreenPhase('report');
    recordings.forEach((rec) => {
      // 写入录音时长（秒，供流利度评分）后启动该题转写
      const durationSec = rec.duration > 0 ? rec.duration / 1000 : null;
      const kwCount = keywordsByUid.get(rec.questionId)?.length ?? 0;
      setReportStates((s) => ({
        ...s,
        [rec.questionId]: { ...(s[rec.questionId] ?? initReportQState(kwCount)), durationSec },
      }));
      startTranscription(rec.questionId, rec.blob);
    });
  }, [cleanup, recordings, keywordsByUid, startTranscription]);

  // 提前交卷：放弃当前正在进行（播放中/录音中）的题目，仅对已完成的回答进入评分报告
  const handleEarlySubmit = useCallback(() => {
    if (recordings.length === 0) {
      alert('还没有已完成的回答，无法提交评分');
      return;
    }
    if (!window.confirm(`将提前结束 OPI，仅对已完成的 ${recordings.length} 道题进行评分。确定提交吗？`)) return;
    // 丢弃当前正在录制的半截回答：先替换 onstop 回调再停止，避免其作为有效录音入库
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorder.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    handleSubmit();
  }, [recordings.length, handleSubmit]);

  // 报告页确认提交：汇总每题评分（按 question uid 索引）进 OPIResult 后 onComplete
  const handleConfirmReport = useCallback(() => {
    const assessments: Record<number, ShortAnswerAssessment> = {};
    for (const rec of recordings) {
      const cur = reportStates[rec.questionId];
      if (!cur) continue;
      const dimensions = Object.fromEntries(
        DIMENSIONS.map((d) => [d.key, cur.dimScores[d.key] ?? 0])
      ) as ShortAnswerAssessment['dimensions'];
      const totalScore = Object.values(dimensions).reduce((sum, v) => sum + v, 0);
      assessments[rec.questionId] = {
        transcript: cur.transcript,
        keywordCovered: cur.keywordChecks,
        dimensions,
        totalScore,
      };
    }
    setScreenPhase('submitted');
    onComplete({
      recordings,
      totalQuestions: total,
      completedQuestions: recordings.length,
      assessments,
    });
  }, [recordings, reportStates, total, onComplete]);

  // 报告页手动给某题某维度打分（状态缺失时按初始值创建）
  const setDimScore = useCallback((questionId: number, dim: DimKey, score: number, kwCount: number) => {
    setReportStates((s) => {
      const cur = s[questionId] ?? initReportQState(kwCount);
      return { ...s, [questionId]: { ...cur, dimScores: { ...cur.dimScores, [dim]: score } } };
    });
  }, []);

  // 获取Blob URL（带缓存，防内存泄漏）
  const getBlobUrl = useCallback((rec: OPIRecording): string => {
    const cached = blobUrlMapRef.current.get(rec.questionId);
    if (cached) return cached;
    const url = URL.createObjectURL(rec.blob);
    blobUrlMapRef.current.set(rec.questionId, url);
    return url;
  }, []);

  // 计算统计数据
  const stats = useMemo(() => {
    const totalDuration = recordings.reduce((sum, r) => sum + r.duration, 0);
    const examDuration = Date.now() - examStartTime;
    const topicStats: Record<string, { count: number; totalDuration: number }> = {};
    recordings.forEach((rec) => {
      const question = examQuestions.find((q) => q.uid === rec.questionId);
      if (question) {
        const topic = question.topic;
        if (!topicStats[topic]) topicStats[topic] = { count: 0, totalDuration: 0 };
        topicStats[topic].count++;
        topicStats[topic].totalDuration += rec.duration;
      }
    });
    return { totalDuration, examDuration, topicStats };
  }, [recordings, examStartTime, examQuestions]);

  // ==================== 渲染 ====================

  // 1. 引导界面
  if (screenPhase === 'outline') {
    return (
      <FadeIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">第五部分：口语能力面试</h1>
              <p className="text-slate-500 mt-2">OPI - Oral Proficiency Interview</p>
            </div>

            <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 mb-6 text-left">
              <h3 className="font-semibold text-teal-800 mb-3">考试说明</h3>
              <ul className="text-teal-700 text-sm space-y-2">
                <li>• 考官语音播放后，请进行回答</li>
                <li>• 回答完成后点击"结束回答"进入下一题</li>
                <li>• 共 {total} 道题，约15-20分钟</li>
                <li>• 本次试卷：从 {opiSets.length} 套题库中随机抽取 {examSet.sourceSets.length} 个题组（涉及第 {[...new Set(examSet.sourceSets)].sort((a, b) => a - b).join('、')} 套）</li>
              </ul>
            </div>

            <button
              onClick={() => setScreenPhase('preparing')}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg"
            >
              开始 OPI 考试
            </button>
          </div>
        </div>
      </FadeIn>
    );
  }

  // 2. 播放考官语音（含跳过按钮）
  if (screenPhase === 'preparing' && q) {
    return (
      <FadeIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
                {getTopicLabel()} · 第 {qIdx + 1} / {total} 题
              </span>
            </div>

            {/* 语音播放动画 */}
            <div className="mb-4">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 animate-pulse">
                <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              </div>
              <p className="text-blue-600 font-medium">正在播放考官语音...</p>
            </div>

            <h2 className="text-2xl font-bold text-slate-800 mb-2">请听考官问题</h2>
            <p className="text-slate-400 text-sm mb-6">语音播放结束后自动开始录音</p>

            {/* 跳过按钮 */}
            <button
              onClick={skipAudio}
              className="w-full py-3 border-2 border-slate-300 text-slate-500 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-400 transition-all"
            >
              跳过语音，直接开始回答
            </button>

            {/* 提前交卷：仅对已完成的回答评分 */}
            <button
              onClick={handleEarlySubmit}
              className="w-full mt-3 py-3 border-2 border-teal-300 text-teal-600 rounded-xl font-medium hover:bg-teal-50 hover:border-teal-400 transition-all"
            >
              提前交卷，对已答题目评分（已完成 {recordings.length} 题）
            </button>
          </div>
        </div>
      </FadeIn>
    );
  }

  // 3. 录音中（60秒倒计时，含重新开始按钮）
  if (screenPhase === 'recording' && q) {
    return (
      <FadeIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-4">
              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                {getTopicLabel()} · 第 {qIdx + 1} / {total} 题
              </span>
            </div>

            {/* 60秒倒计时 */}
            <div className="mb-4">
              <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full border-4 font-bold text-4xl font-mono transition-all ${
                countdown <= 10
                  ? 'border-red-500 bg-red-500/10 text-red-500 animate-pulse'
                  : 'border-amber-500 bg-amber-500/10 text-amber-600'
              }`}>
                {fmtTime(countdown)}
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-2">请回答</h2>
            <p className="text-slate-500 mb-4">{countdown <= 10 ? '时间即将结束' : '回答完成后可提前结束'}</p>

            {/* 录音动画 */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-sm bg-white" />
                </div>
              </div>
            </div>
            <p className="text-red-500 font-medium mb-6">● 正在录音...</p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  stopRecording();
                  nextQuestion();
                }}
                className="flex-1 py-4 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-xl font-semibold hover:from-slate-600 hover:to-slate-700 transition-all shadow-lg"
              >
                结束回答
              </button>
              <button
                onClick={handleRestart}
                className="px-4 py-4 border-2 border-red-300 text-red-500 rounded-xl font-medium hover:bg-red-50 hover:border-red-400 transition-all"
              >
                重新开始
              </button>
            </div>

            {/* 提前交卷：放弃当前题，仅对已完成的回答评分 */}
            <button
              onClick={handleEarlySubmit}
              className="w-full mt-3 py-3 border-2 border-teal-300 text-teal-600 rounded-xl font-medium hover:bg-teal-50 hover:border-teal-400 transition-all"
            >
              提前交卷，对已答题目评分（已完成 {recordings.length} 题）
            </button>
          </div>
        </div>
      </FadeIn>
    );
  }

  // 4. 回放确认（含详细统计 + Blob URL缓存）
  if (screenPhase === 'review') {
    return (
      <FadeIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">OPI 完成</h2>
              <p className="text-slate-500">共完成 {recordings.length} / {total} 题录音</p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-teal-50 rounded-xl p-3 text-center">
                <p className="text-teal-600 text-xs">总录音时长</p>
                <p className="text-teal-800 font-bold text-lg">{fmtTime(Math.floor(stats.totalDuration / 1000))}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-blue-600 text-xs">考试总用时</p>
                <p className="text-blue-800 font-bold text-lg">{fmtTime(Math.floor(stats.examDuration / 1000))}</p>
              </div>
            </div>

            {/* 各话题统计 */}
            {Object.entries(stats.topicStats).length > 0 && (
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-slate-600 text-sm font-medium mb-2">各话题情况</p>
                <div className="space-y-1">
                  {Object.entries(stats.topicStats).map(([topic, data]) => (
                    <div key={topic} className="flex justify-between text-sm">
                      <span className="text-slate-600">{topic}</span>
                      <span className="text-slate-500">{data.count}题 · {fmtTime(Math.floor(data.totalDuration / 1000))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 录音列表（可展开参考答案，供考生自评或教员对照评分） */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-600 text-sm font-medium">录音回听</p>
              <button
                onClick={() => setShowAnswers((v) => !v)}
                className="text-xs px-3 py-1 rounded-full border border-teal-300 text-teal-600 hover:bg-teal-50 transition-all"
              >
                {showAnswers ? '隐藏参考答案' : '显示参考答案'}
              </button>
            </div>
            <div className={`space-y-3 mb-6 overflow-y-auto ${showAnswers ? 'max-h-96' : 'max-h-60'}`}>
              {recordings.map((rec) => {
                const question = examQuestions.find((q) => q.uid === rec.questionId);
                const url = getBlobUrl(rec);
                return (
                  <div key={rec.questionId} className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-700 font-medium text-sm">
                        {question ? `${question.topic} · ${question.questionCn}` : `第 ${rec.questionId} 题`}
                      </span>
                      <span className="text-slate-400 text-xs">{(rec.duration / 1000).toFixed(1)}s</span>
                    </div>
                    <audio controls src={url} className="w-full" />
                    {showAnswers && question && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        <p className="text-slate-500 text-xs">
                          <span className="font-medium text-slate-600">Q: </span>{question.question}
                        </p>
                        <p className="text-slate-500 text-xs">
                          <span className="font-medium text-teal-700">参考答案: </span>{question.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                className="flex-1 py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg"
              >
                进入评分报告
              </button>
              <button
                onClick={handleRestart}
                className="px-4 py-4 border-2 border-slate-300 text-slate-500 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                重新开始
              </button>
            </div>
          </div>
        </div>
      </FadeIn>
    );
  }

  // 5. 评分报告页（逐题展示，全部题目各维度评完后可确认提交；照搬 Part 3 听力简答模式）
  if (screenPhase === 'report') {
    const rec = recordings[reportIndex];
    const rq = rec ? examQuestions.find((x) => x.uid === rec.questionId) : undefined;
    const kwList = rec ? (keywordsByUid.get(rec.questionId) ?? []) : [];
    const cur: ReportQState = (rec && reportStates[rec.questionId]) || initReportQState(kwList.length);
    // 该题录音回放的 Blob URL（沿用带缓存的 getBlobUrl，提交前已创建）
    const recUrl = rec ? getBlobUrl(rec) : null;

    const totalQ = recordings.length;
    const totalScore = DIMENSIONS.reduce((sum, d) => sum + (cur.dimScores[d.key] ?? 0), 0);
    const allRated = DIMENSIONS.every((d) => (cur.dimScores[d.key] ?? 0) > 0);
    // 全部题目都评完后"确认提交"才可用
    const allQuestionsRated = recordings.every((r) => {
      const st = reportStates[r.questionId];
      return st && DIMENSIONS.every((d) => (st.dimScores[d.key] ?? 0) > 0);
    });
    const strongDims = DIMENSIONS.filter((d) => (cur.dimScores[d.key] ?? 0) >= 4);
    const weakDims = DIMENSIONS.filter((d) => {
      const s = cur.dimScores[d.key] ?? 0;
      return s > 0 && s <= 2;
    });
    // 得分 ≤3 的维度给出改进建议
    const adviseDims = DIMENSIONS.filter((d) => {
      const s = cur.dimScores[d.key] ?? 0;
      return s > 0 && s <= 3;
    });
    const coveredCount = cur.keywordChecks.filter(Boolean).length;
    const uncoveredKw = kwList.filter((_, i) => !cur.keywordChecks[i]);
    // 卡片展开状态的 key 前缀（按题目区分）
    const cardPrefix = `${rec?.questionId ?? reportIndex}:`;
    const cardOpen = (name: string) => !!expandedCards[cardPrefix + name];
    // 卡片标题行（右侧箭头控制展开/折叠）
    const cardHeader = (name: string, title: ReactNode, titleClass: string) => (
      <button type="button" onClick={() => toggleCard(cardPrefix + name)} className="w-full flex items-center justify-between gap-2">
        <h3 className={`font-semibold text-sm ${titleClass}`}>{title}</h3>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${cardOpen(name) ? 'rotate-180' : ''} ${titleClass}`} />
      </button>
    );

    return (
      <FadeIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <div className="max-w-3xl w-full bg-white/95 rounded-2xl shadow-xl p-8 my-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">口语能力面试 · 评分报告</h2>
              <p className="text-slate-500 mt-1">OPI（自评或教员打分）</p>
              <span className="inline-block mt-2 bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
                问题 {reportIndex + 1} / {totalQ}
              </span>
              {/* 收藏本题（文本与评分元数据，录音不持久化） */}
              {rq && (
                <div className="mt-2">
                  <FavoriteButton
                    entry={{
                      key: `p5:${rq.uid}`,
                      part: 5,
                      title: rq.question,
                      text: rq.questionCn ? `${rq.question}\n${rq.questionCn}` : rq.question,
                      detail: rq.answer,
                      score: allRated ? totalScore : undefined,
                    }}
                  />
                </div>
              )}
            </div>

            {/* 录音回放 */}
            {recUrl ? (
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-600 text-sm font-medium">回放你的回答录音：</p>
                  <PlaybackRateButton />
                </div>
                <RateAudio src={recUrl} className="w-full" />
              </div>
            ) : (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
                本题未检测到录音，以下维度请结合考场情况手动评分。
              </div>
            )}

            {/* 转写文本（语音识别，仅供参考）：有 LLM 校正时只显示校正后内容 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              {cardHeader('transcript', '转写文本（语音识别，仅供参考）', 'text-slate-700')}
              {cardOpen('transcript') && (
                <div className="mt-2">
                  {cur.stage === 'loading' ? (
                    <p className="text-slate-500 text-sm">
                      首次使用正在加载语音识别模型（应用自带，无需联网），请稍候…
                      {cur.modelProgress !== null && <span className="text-teal-600 ml-1">{cur.modelProgress}%</span>}
                    </p>
                  ) : cur.stage === 'transcribing' ? (
                    <p className="text-slate-500 text-sm">正在将录音转写为文字…</p>
                  ) : cur.stage === 'error' ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-slate-400 text-sm">
                        语音转写失败{cur.error ? `（${cur.error}）` : ''}，请根据回放手动评分。
                      </p>
                      {rec && (
                        <button
                          onClick={() => startTranscription(rec.questionId, rec.blob)}
                          className="shrink-0 px-3 py-1.5 text-sm border border-teal-400 text-teal-600 rounded-lg hover:bg-teal-50 transition-all"
                        >
                          重试
                        </button>
                      )}
                    </div>
                  ) : (cur.correctedTranscript || cur.transcript) ? (
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {cur.correctedTranscript || cur.transcript}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-sm">未识别到有效语音内容，请根据回放手动评分。</p>
                  )}
                </div>
              )}
            </div>

            {/* 题目与参考答案 */}
            {rq && (
              <div className="mb-6 space-y-4">
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                  {cardHeader('question', `题目（${rq.topic}）`, 'text-teal-800')}
                  {cardOpen('question') && (
                    <div className="mt-2 space-y-1">
                      <p className="text-teal-700 text-sm leading-relaxed">{rq.question}</p>
                      {rq.questionCn && <p className="text-teal-600/70 text-xs leading-relaxed">{rq.questionCn}</p>}
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  {cardHeader('reference', '参考答案（仅供参考）', 'text-slate-700')}
                  {cardOpen('reference') && (
                    <p className="text-slate-600 text-sm leading-relaxed mt-2">{rq.answer}</p>
                  )}
                </div>
                {kwList.length > 0 && (
                  <div className="border border-slate-200 rounded-xl p-4">
                    {cardHeader('keywords', `重要信息（关键词）覆盖（已覆盖 ${coveredCount}/${kwList.length}）`, 'text-slate-700')}
                    {cardOpen('keywords') && (
                      <div className="mt-2">
                        <p className="text-slate-400 text-xs mb-3">系统已根据你的回答（转写文本）自动比对以下要点（提取自参考答案），"关键词覆盖"维度分随覆盖率自动给出。</p>
                        <div className="space-y-2">
                          {kwList.map((kw, i) => (
                            <label key={i} className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={cur.keywordChecks[i] ?? false}
                                disabled
                                readOnly
                                className="w-4 h-4 accent-teal-600"
                              />
                              <span className={`text-sm ${cur.keywordChecks[i] ? 'text-slate-800' : 'text-slate-500'}`}>
                                {kw}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 评分表 */}
            <div className="border border-slate-200 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-slate-700 text-sm mb-1">评分标准（每项 1-5 分，5 为最好）</h3>
              {/* 讯飞 ISE 发音评测状态（失败/未配置时温和提示，发音维度保持手动评分） */}
              {cur.iseStage === 'evaluating' && (
                <p className="text-sky-500 text-xs mb-2">讯飞发音评测进行中，完成后将自动预填"发音"维度…</p>
              )}
              {cur.iseStage === 'error' && (
                <p className="text-slate-400 text-xs mb-2">
                  讯飞发音评测不可用{cur.iseError ? `（${cur.iseError}）` : ''}，"发音"维度请根据录音回放手动评分。
                </p>
              )}
              {cur.iseStage === 'idle' && (
                <p className="text-slate-400 text-xs mb-2">"发音"维度请根据录音回放手动评分。</p>
              )}
              {cur.iseRejected && (
                <p className="text-amber-500 text-xs mb-2">评测引擎判定该录音疑似无效作答，预填的发音分仅供参考。</p>
              )}
              <div className="space-y-4 mt-3">
                {DIMENSIONS.map((dim) => (
                  <div key={dim.key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-slate-800 text-sm font-medium">{dim.label}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{dim.desc}</p>
                      {cur.autoReasons[dim.key] && (
                        <p className="text-sky-600 text-xs mt-1">{cur.autoReasons[dim.key]}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          onClick={() => rec && setDimScore(rec.questionId, dim.key, score, kwList.length)}
                          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                            (cur.dimScores[dim.key] ?? 0) === score
                              ? 'bg-teal-600 text-white shadow'
                              : 'bg-slate-100 text-slate-500 hover:bg-teal-100 hover:text-teal-700'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 评估报告（本题全部维度评完后显示） */}
            {allRated && (
              <div className="border border-teal-200 bg-teal-50/50 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-teal-900">本题评估报告</h3>
                  <span className="text-lg font-bold text-teal-700">
                    {totalScore} / 25 分（{Math.round((totalScore / 25) * 100)}%）
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-emerald-700 mb-1">得分点 / 亮点：</p>
                    <ul className="text-slate-600 space-y-1 list-disc list-inside">
                      {cur.llmFeedback && cur.llmFeedback.strengths.length > 0 ? (
                        cur.llmFeedback.strengths.map((t, i) => <li key={i}>{t}</li>)
                      ) : strongDims.length > 0 ? (
                        strongDims.map((d) => <li key={d.key}>{d.label}表现良好（{cur.dimScores[d.key]} 分）</li>)
                      ) : (
                        <li>各维度暂无突出表现</li>
                      )}
                      {kwList.length > 0 && coveredCount > 0 && (
                        <li>关键词覆盖 {coveredCount}/{kwList.length}：
                          {kwList.filter((_, i) => cur.keywordChecks[i]).join('、')}
                        </li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-red-600 mb-1">扣分点 / 不足：</p>
                    <ul className="text-slate-600 space-y-1 list-disc list-inside">
                      {cur.llmFeedback ? (
                        cur.llmFeedback.weaknesses.length > 0 ? (
                          cur.llmFeedback.weaknesses.map((t, i) => <li key={i}>{t}</li>)
                        ) : (
                          <li>无明显薄弱维度</li>
                        )
                      ) : weakDims.length > 0 ? (
                        weakDims.map((d) => <li key={d.key}>{d.label}偏弱（{cur.dimScores[d.key]} 分）</li>)
                      ) : (
                        <li>无明显薄弱维度</li>
                      )}
                      {uncoveredKw.length > 0 && (
                        <li>遗漏关键词：{uncoveredKw.join('、')}</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-sky-700 mb-1">改进建议：</p>
                    <ul className="text-slate-600 space-y-1 list-disc list-inside">
                      {cur.llmFeedback && cur.llmFeedback.suggestions.length > 0 ? (
                        cur.llmFeedback.suggestions.map((t, i) => <li key={i}>{t}</li>)
                      ) : adviseDims.length > 0 ? (
                        adviseDims.map((d) => <li key={d.key}>{DIM_SUGGESTIONS[d.key]}</li>)
                      ) : (
                        <li>各维度均表现良好，继续保持，可尝试更丰富的句式和连接词提升表达层次。</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 题目切换 + 最终提交 */}
            <div className="flex gap-4">
              <button
                onClick={() => setReportIndex((i) => Math.max(0, i - 1))}
                disabled={reportIndex === 0}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  reportIndex === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'border-2 border-teal-500 text-teal-600 hover:bg-teal-50'
                }`}
              >
                上一题
              </button>
              {reportIndex < totalQ - 1 ? (
                <button
                  onClick={() => setReportIndex((i) => Math.min(totalQ - 1, i + 1))}
                  className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg"
                >
                  下一题
                </button>
              ) : (
                <button
                  onClick={handleConfirmReport}
                  disabled={!allQuestionsRated}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all shadow-lg ${
                    allQuestionsRated
                      ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {allQuestionsRated ? '确认提交' : '请先完成全部题目各 5 个维度的评分'}
                </button>
              )}
            </div>
            {reportIndex === totalQ - 1 && !allQuestionsRated && (
              <p className="text-center text-slate-400 text-xs mt-3">
                还有题目未评完分，可用"上一题"返回检查。
              </p>
            )}
          </div>
        </div>
      </FadeIn>
    );
  }

  // 6. 已完成（含详细报告）
  if (screenPhase === 'submitted') {
    return (
      <FadeIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">第五部分完成</h2>
            <p className="text-slate-500 mb-6">您的 OPI 录音已提交</p>

            {/* 简要报告 */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-slate-600 text-sm mb-2">考试报告</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-slate-800 font-bold">{recordings.length}</p>
                  <p className="text-slate-400 text-xs">完成题数</p>
                </div>
                <div>
                  <p className="text-slate-800 font-bold">{fmtTime(Math.floor(stats.totalDuration / 1000))}</p>
                  <p className="text-slate-400 text-xs">录音时长</p>
                </div>
                <div>
                  <p className="text-slate-800 font-bold">{fmtTime(Math.floor(stats.examDuration / 1000))}</p>
                  <p className="text-slate-400 text-xs">总用时</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleRestart}
              className="w-full py-3 border-2 border-teal-500 text-teal-600 rounded-xl font-medium hover:bg-teal-50 transition-all"
            >
              重新开始考试
            </button>
          </div>
        </div>
      </FadeIn>
    );
  }

  return null;
}
