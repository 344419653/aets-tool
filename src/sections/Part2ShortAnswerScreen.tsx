import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ShortAnswerResult, ShortAnswerRecording, ShortAnswerAssessment } from '@/types/exam';
import { getRandomExchange } from '@/data/questionsPart2ShortAnswer';
import { scoreStoryRetelling, type StoryDimKey } from '@/lib/storyAutoScore';
import { scoreShortAnswerWithLLM, clampLlmScore, type LlmScoreResult } from '@/lib/llmScore';
import { transcribeAudio } from '@/lib/whisperTranscribe';
import { evaluateFreeSpeech, iseToFive } from '@/lib/iseEvaluate';
import FavoriteButton from '@/components/FavoriteButton';
import RateAudio from '@/components/RateAudio';
import PlaybackRateButton from '@/components/PlaybackRateButton';

interface Props {
  onComplete: (result: ShortAnswerResult) => void;
}

type Phase = 'intro' | 'material' | 'ready' | 'recording' | 'review' | 'report' | 'submitted';

/** 评分维度（AETS 听力简答评分标准，每项 1-5 分，与故事复述同一套维度） */
const DIMENSIONS = [
  { key: 'content', label: '内容完整性', desc: '回应是否覆盖参考答案要点，紧扣问题作答' },
  { key: 'keywords', label: '关键词覆盖', desc: '重要信息点是否答到（随下方勾选自动给分，可手动调整）' },
  { key: 'fluency', label: '流利度与连贯性', desc: '语速自然、长时间停顿少、表达连贯' },
  { key: 'grammar', label: '语法与词汇', desc: '句型结构正确、时态一致、用词恰当' },
  { key: 'pronunciation', label: '发音', desc: '清晰易懂，单词重音、数字与呼号读法正确' },
] as const;

type DimKey = (typeof DIMENSIONS)[number]['key'];

/** 各维度偏弱时的改进建议（content/keywords 针对听力简答改写，其余复用故事部分文案） */
const DIM_SUGGESTIONS: Record<DimKey, string> = {
  content: '回应未覆盖参考答案要点，注意听清问题的疑问词并紧扣对话材料作答。',
  keywords: '遗漏重要信息点，听材料时重点捕捉呼号、数字、原因等关键要素。',
  fluency: '多做影子跟读（shadowing）练习，减少长时间停顿、重复和自我纠正，保持语流连续。',
  grammar: '叙述已发生的事件统一用过去时，注意主谓一致和基本句型，避免逐字中译英。',
  pronunciation: '对照原文音频逐句模仿，注意单词重音、句子语调，以及高度、速度、呼号等数字的规范读法。',
};

/** 报告页每题的评分/转写状态（按 questionId 存） */
interface ReportQState {
  /** 转写出的英文文本（完成后才有值） */
  transcript: string;
  /** 转写流程状态：idle 未开始 / loading 模型下载加载中 / transcribing 转写中 / done 完成 / error 失败 */
  stage: 'idle' | 'loading' | 'transcribing' | 'done' | 'error';
  /** 模型下载进度百分比（0-100，未知为 null） */
  modelProgress: number | null;
  /** 转写失败信息（用于报告页提示与重试） */
  error: string | null;
  /** 关键词覆盖（与该题 keywords 顺序一致，由转写文本自动比对，界面只读展示） */
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
  /** LLM 按 ASR 近音容错规则校正后的转写文本（与原转写不同才有值，仅供评分参考） */
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

export default function Part2ShortAnswerScreen({ onComplete }: Props) {
  // 随机抽取一个exchange作为考题（每次只考一个exchange的3道题）
  const [selectedExchange] = useState(() => getRandomExchange());
  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  // 播放器状态
  const [matCurrentTime, setMatCurrentTime] = useState(0);
  const [matDuration, setMatDuration] = useState(0);
  const [matPaused, setMatPaused] = useState(false);
  const [questionAudioPlaying, setQuestionAudioPlaying] = useState(false);
  // 问题音频自动播放失败（自动播放被拒/解码错误/续播失败），显示手动重听按钮
  const [questionAudioFailed, setQuestionAudioFailed] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  // 记录已播放过的问题音频，防止重复播放
  const playedQuestionRef = useRef<Set<string>>(new Set());
  // 累积所有题目的录音数据（Blob + 时长）
  const recordingsRef = useRef<ShortAnswerRecording[]>([]);
  // 管理 Blob URL，防止内存泄漏
  const blobUrlRef = useRef<string | null>(null);
  // 录音开始时间，用于计算录音时长
  const recordingStartTimeRef = useRef<number>(0);
  // 本次录音对应的题目 id（recorder.onstop 闭包里 qIdx 可能已过期，用 ref 锁定）
  const recordingQuestionIdRef = useRef<number | null>(null);

  // --- 评分报告状态（报告页按题逐步展示，数据按 questionId 存） ---
  const [reportStates, setReportStates] = useState<Record<number, ReportQState>>({});
  // 报告页当前展示的题目下标
  const [reportIndex, setReportIndex] = useState(0);
  // 报告页各信息卡片的展开状态（key 为 "题目id:卡片名"，默认全部折叠，点箭头展开）
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const toggleCard = (key: string) => setExpandedCards((s) => ({ ...s, [key]: !s[key] }));
  // 各题转写任务递增 id：重新录音/卸载时使旧的异步结果失效，防止串题覆盖
  const transcribeRunRef = useRef<Record<number, number>>({});
  // 各题 ISE 评测任务递增 id（与 transcribeRunRef 同理）
  const iseRunRef = useRef<Record<number, number>>({});
  // 报告页各题录音回放的 Blob（按 questionId 存，提交时从 recordingsRef 复制，供报告页渲染与重试）
  const [reportBlobs, setReportBlobs] = useState<Record<number, Blob>>({});
  // 报告页各题录音回放的 Blob URL（按 questionId 存，提交时统一创建）
  const [reportBlobUrls, setReportBlobUrls] = useState<Record<number, string>>({});
  // 已创建的 Blob URL 镜像（仅用于卸载/清理时统一释放，render 不访问）
  const reportBlobUrlsRef = useRef<Record<number, string>>({});

  const mat = selectedExchange;
  const q = mat.questions[qIdx];
  const totalQ = mat.questions.length;
  // 当前题 ref（录音回调闭包内 qIdx 可能已过期，统一经 ref 取最新题）
  const qRef = useRef(q);
  // 题目列表 ref（转写完成回调内做自动预评时查题目关键词/参考答案）
  const questionsRef = useRef(mat.questions);
  // render 期不直接写 ref，每次渲染后在 effect 里同步最新值
  useEffect(() => {
    qRef.current = q;
    questionsRef.current = mat.questions;
  });

  // 清理
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    // 释放 Blob URL，防止内存泄漏
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    // 卸载时使进行中的转写/ISE 评测结果失效（worker 仍在跑，但结果会被丢弃）
    transcribeRunRef.current = {};
    iseRunRef.current = {};
    // 释放报告页回放 Blob URL
    Object.values(reportBlobUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    reportBlobUrlsRef.current = {};
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // 播放当前问题的朗读音频（带未播完自动续播保护）
  // 部分浏览器/解码环境会在音频中段误触发 ended 或意外暂停，导致题目只读了几个词就进入作答。
  // 这里记录最后播放位置，若 ended 提前触发则自动回seek续播（最多3次）；
  // 播放被自动播放策略拒绝或解码彻底失败时，置 questionAudioFailed，界面给出手动重听按钮。
  const playQuestionAudio = useCallback(() => {
    if (!q?.audio) return;

    // 停止之前的音频
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    const audio = new Audio(q.audio);
    audioRef.current = audio;
    setQuestionAudioPlaying(true);
    setQuestionAudioFailed(false);

    let done = false;
    let resumeLeft = 3;
    let lastTime = 0;
    audio.addEventListener('timeupdate', () => { lastTime = audio.currentTime; });

    const finish = (failed: boolean) => {
      if (done) return;
      done = true;
      setQuestionAudioPlaying(false);
      setQuestionAudioFailed(failed);
      if (audioRef.current === audio) audioRef.current = null;
    };

    const handleEnded = () => {
      // ended 提前触发（实际未播完）：回seek到最后播放位置续播
      if (isFinite(audio.duration) && audio.currentTime < audio.duration - 0.35 && resumeLeft > 0) {
        resumeLeft--;
        try { audio.currentTime = lastTime; } catch { /* ignore */ }
        audio.play().catch(() => finish(true));
        return;
      }
      finish(false);
    };
    const handleError = () => finish(true);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.play().catch(() => finish(true)); // 自动播放被拒等情况

    return () => {
      done = true;
      audio.pause();
      audio.src = '';
    };
  }, [q]);

  // 自动播放问题朗读音频（每个问题只播放一次）
  // 注意：questionAudioPlaying 不在依赖数组中，避免 setState(true) 触发重新执行导致事件监听器被移除
  useEffect(() => {
    if (phase !== 'ready' || !q?.audio) return;
    const questionKey = `exchange-${qIdx}`;
    // 已播放过则跳过（playedQuestionRef 在 submitAndNext 切换材料时会被 clear）
    if (playedQuestionRef.current.has(questionKey)) return;

    playedQuestionRef.current.add(questionKey);
    return playQuestionAudio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIdx, playQuestionAudio]);

  // 播放材料音频（带进度条控制）
  const playMaterial = useCallback(() => {
    setPhase('material');
    setIsPlaying(true);
    setMatCurrentTime(0);
    setMatDuration(0);
    setMatPaused(false);

    const audio = new Audio(mat.audio);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setMatDuration(audio.duration);
    });

    let lastTime = 0;
    let resumeLeft = 3;
    audio.addEventListener('timeupdate', () => {
      lastTime = audio.currentTime;
      setMatCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      // ended 提前触发（实际未播完）：回seek到最后播放位置续播
      if (isFinite(audio.duration) && audio.currentTime < audio.duration - 0.5 && resumeLeft > 0) {
        resumeLeft--;
        try { audio.currentTime = lastTime; } catch { /* ignore */ }
        audio.play().catch(() => {
          setIsPlaying(false);
          setPhase('ready');
        });
        return;
      }
      setIsPlaying(false);
      setMatPaused(true);
      setPhase('ready');
    });

    audio.addEventListener('error', () => {
      setIsPlaying(false);
      setPhase('ready');
    });

    audio.play().catch(() => {
      setIsPlaying(false);
      setPhase('ready');
    });
  }, [mat]);

  // 暂停/继续材料播放
  const toggleMaterialPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setMatPaused(false);
    } else {
      audio.pause();
      setMatPaused(true);
    }
  }, []);

  // 进度条点击跳转
  const seekMaterial = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (!audio || !bar || !matDuration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(matDuration, ratio * matDuration));
    audio.currentTime = newTime;
    setMatCurrentTime(newTime);
  }, [matDuration]);

  // 格式化时间
  const fmtTime = (t: number) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 启动某题的后台转写（录音停止时触发；失败可在报告页重试）
  const startTranscription = useCallback((questionId: number, blob: Blob) => {
    const runId = (transcribeRunRef.current[questionId] ?? 0) + 1;
    transcribeRunRef.current[questionId] = runId;
    setReportStates((s) => ({
      ...s,
      [questionId]: { ...(s[questionId] ?? initReportQState(0)), stage: 'loading', error: null, modelProgress: null },
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
      const qq = questionsRef.current.find((x) => x.id === questionId);
      setReportStates((s) => {
        const cur = s[questionId];
        if (!cur) return s;
        const nextState: ReportQState = { ...cur, transcript: text, stage: 'done', llmFeedback: null, correctedTranscript: null };
        if (qq && text && cur.lastAutoScored !== text) {
          // 本地预评（词面匹配），作为 LLM 评分的兜底；fluency 维度始终由本地声学估算给出
          const auto = scoreStoryRetelling({
            transcript: text,
            durationSec: cur.durationSec,
            keywords: (qq.keywords ?? []).map((k) => ({ english: k, chinese: '' })),
            // 听力简答的参考文本即参考答案，语义与故事原文一致
            storyTranscript: qq.referenceAnswer || null,
            // Whisper 不产出识别置信度，发音维度保持手动评分
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
          question: qq.text,
          referenceAnswer: qq.referenceAnswer ?? '',
          keywords: qq.keywords ?? [],
          transcript: text,
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
            const kwList = qq.keywords ?? [];
            // LLM 判定 covered 的关键点（大小写不敏感的包含匹配）映射回 keywordChecks
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
    }).catch((err: unknown) => {
      if (transcribeRunRef.current[questionId] !== runId) return;
      setReportStates((s) => {
        const cur = s[questionId];
        if (!cur) return s;
        return { ...s, [questionId]: { ...cur, stage: 'error', error: err instanceof Error ? err.message : String(err) } };
      });
    });
  }, []);

  // 启动某题的讯飞 ISE 发音评测（topic 英文自由题，与转写并行、互不阻塞；
  // 试卷文本 = 该题题目 + 参考答案。代理未启动/评测失败时置 error，报告页温和提示、发音维度保持手动评分）
  const startIseEvaluation = useCallback((questionId: number, blob: Blob, questionText: string, refText: string) => {
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
              pronunciation:
                // 讯飞 topic 的 semanticAccuracy（语义准确度）为引擎黑盒分，对陆空通话短句判定
                // 不稳定且与 LLM 内容评分重复，经用户确认不再展示
                `发音准确度 ${phone.toFixed(0)}/100 → 建议 ${five} 分`,
            },
            // 仅在教员尚未手动打分时预填发音维度，不覆盖人工已给的分数
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
        setRecordedBlob(blob);
        setIsRecording(false);
        setPhase('review');
        // 记录实际录音时长（秒），供流利度评分使用，并立即启动后台转写
        const questionId = recordingQuestionIdRef.current;
        if (questionId !== null) {
          const durationSec = recordingStartTimeRef.current
            ? (Date.now() - recordingStartTimeRef.current) / 1000
            : null;
          setReportStates((s) => {
            const cur = s[questionId];
            if (!cur) return s;
            return { ...s, [questionId]: { ...cur, durationSec } };
          });
          startTranscription(questionId, blob);
          // 有参考答案的题并行启动讯飞 ISE topic 自由题评测（无参考答案则跳过，发音维度手动评）
          const qq = questionsRef.current.find((x) => x.id === questionId);
          if (qq?.referenceAnswer) startIseEvaluation(questionId, blob, qq.text, qq.referenceAnswer);
        }
      };
      recorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
      recordingStartTimeRef.current = Date.now();
      // 锁定本题 id 并重置该题的报告状态（重新录音时使旧转写/ISE 任务失效）
      const questionId = qRef.current?.id ?? null;
      recordingQuestionIdRef.current = questionId;
      if (questionId !== null) {
        transcribeRunRef.current[questionId] = (transcribeRunRef.current[questionId] ?? 0) + 1;
        iseRunRef.current[questionId] = (iseRunRef.current[questionId] ?? 0) + 1;
        setReportStates((s) => ({
          ...s,
          [questionId]: initReportQState(qRef.current?.keywords?.length ?? 0),
        }));
      }
      setPhase('recording');
    } catch {
      alert('无法访问麦克风，请检查权限设置');
    }
  }, [startTranscription, startIseEvaluation]);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
  }, [isRecording]);

  // 构建最终结果并提交（报告页确认后调用；assessments 按 questionId 汇总进对应题目）
  const buildAndSubmit = useCallback((assessments?: Record<number, ShortAnswerAssessment>) => {
    const materials = [{
      materialId: selectedExchange.id,
      questions: selectedExchange.questions.map((qq) => {
        const rec = recordingsRef.current.find((r) => r.questionId === qq.id);
        return {
          questionId: qq.id,
          hasRecording: !!rec,
          recordingDuration: rec ? rec.duration : undefined,
          assessment: assessments?.[qq.id],
        };
      }),
    }];

    onComplete({
      materials,
      recordings: recordingsRef.current,
    });
  }, [onComplete, selectedExchange]);

  // 提交并进入下一题
  const submitAndNext = useCallback(() => {
    // 保存当前题目的录音数据到 recordingsRef
    if (recordedBlob && q) {
      const duration = recordingStartTimeRef.current
        ? Date.now() - recordingStartTimeRef.current
        : 0;
      recordingsRef.current.push({
        questionId: q.id,
        blob: recordedBlob,
        duration,
      });
    }

    setRecordedBlob(null);
    setIsRecording(false);
    recordingStartTimeRef.current = 0;
    setQuestionAudioPlaying(false); // 重置问题音频播放状态

    const nextQ = qIdx + 1;
    if (nextQ < totalQ) {
      setQIdx(nextQ);
      setPhase('ready');
    } else {
      // 当前exchange的全部题目完成，进入评分报告页（由报告页确认后最终提交）
      // 在事件回调里统一创建各题回放 Blob 与 ObjectURL（render 期不访问 ref）
      const blobs: Record<number, Blob> = {};
      const urls: Record<number, string> = {};
      recordingsRef.current.forEach((r) => {
        blobs[r.questionId] = r.blob;
        urls[r.questionId] = URL.createObjectURL(r.blob);
      });
      reportBlobUrlsRef.current = urls;
      setReportBlobs(blobs);
      setReportBlobUrls(urls);
      setReportIndex(0);
      setPhase('report');
    }
  }, [qIdx, totalQ, q, recordedBlob]);

  // 报告页确认提交：汇总每题评分进 ShortAnswerResult 后 onComplete
  const handleConfirmReport = useCallback(() => {
    const assessments: Record<number, ShortAnswerAssessment> = {};
    for (const qq of mat.questions) {
      const cur = reportStates[qq.id];
      if (!cur) continue;
      const dimensions = Object.fromEntries(
        DIMENSIONS.map((d) => [d.key, cur.dimScores[d.key] ?? 0])
      ) as ShortAnswerAssessment['dimensions'];
      const totalScore = Object.values(dimensions).reduce((sum, v) => sum + v, 0);
      assessments[qq.id] = {
        transcript: cur.transcript,
        keywordCovered: cur.keywordChecks,
        dimensions,
        totalScore,
      };
    }
    setPhase('submitted');
    buildAndSubmit(assessments);
  }, [mat.questions, reportStates, buildAndSubmit]);

  // 报告页手动给某题某维度打分（无录音的题也能评分：状态缺失时按初始值创建）
  const setDimScore = useCallback((questionId: number, dim: DimKey, score: number, kwCount: number) => {
    setReportStates((s) => {
      const cur = s[questionId] ?? initReportQState(kwCount);
      return { ...s, [questionId]: { ...cur, dimScores: { ...cur.dimScores, [dim]: score } } };
    });
  }, []);

  // ===== 引导语 =====
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800">第三部分：听力简答</h1>
            <p className="text-slate-500 mt-2">Listening Short Answer</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-green-600 mb-3">
              {'听力简答：Exchange（对话）'}
            </h3>
            <ul className="text-green-600 space-y-2 text-sm">
              <li>• 点击按钮播放音频材料</li>
              <li>• 材料播放完后，显示问题</li>
              <li>• 点击"开始录音"口头回答问题</li>
              <li>• 说完后点击"停止录音"</li>
              <li>• 可回放检查，满意后提交进入下一题</li>
            </ul>
          </div>
          <button onClick={playMaterial} className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-lg">
            开始播放材料
          </button>
        </div>
      </div>
    );
  }

  // ===== 播放材料中（带进度条） =====
  if (phase === 'material') {
    const pct = matDuration ? (matCurrentTime / matDuration) * 100 : 0;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">正在播放：{mat.title}</h2>
          </div>

          {/* 播放/暂停按钮 */}
          <div className="flex justify-center mb-6">
            <button
              onClick={toggleMaterialPause}
              className="w-20 h-20 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-all shadow-lg"
            >
              {matPaused ? (
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              )}
            </button>
          </div>

          {/* 进度条 */}
          <div className="mb-2">
            <div
              ref={progressBarRef}
              onClick={seekMaterial}
              className="w-full h-3 bg-slate-200 rounded-full cursor-pointer relative overflow-hidden"
            >
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-slate-500">
              <span>{fmtTime(matCurrentTime)}</span>
              <span>{fmtTime(matDuration)}</span>
            </div>
          </div>

          <p className="text-center text-slate-400 text-sm mt-4">
            点击进度条可跳转
          </p>
        </div>
      </div>
    );
  }

  // ===== 显示问题 + 后台自动朗读问题音频 =====
  if (phase === 'ready') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              问题 {qIdx + 1} / {totalQ}
            </span>
          </div>
          <div className="bg-slate-50 rounded-xl p-6 mb-6">
            <p className="text-lg text-slate-800 font-medium">{q?.text}</p>
          </div>
          {/* 朗读中：按钮禁用（灰色） */}
          {questionAudioPlaying && (
            <button disabled className="w-full py-4 bg-slate-300 text-slate-500 rounded-xl font-semibold cursor-not-allowed">
              开始录音回答（请听完后点击）
            </button>
          )}

          {/* 朗读完：按钮启用（红色） */}
          {!questionAudioPlaying && (
            <button onClick={startRecording} className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all shadow-lg">
              开始录音回答
            </button>
          )}

          {/* 问题语音播放失败（自动播放被拒/中途异常）：提供手动重听 */}
          {!questionAudioPlaying && questionAudioFailed && (
            <button onClick={playQuestionAudio} className="w-full mt-3 py-3 border-2 border-blue-500 text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all">
              问题语音未完整播放，点击重听
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== 录音中 =====
  if (phase === 'recording') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-4">正在录音</h2>
          <div className="bg-slate-50 rounded-xl p-6 mb-6">
            <p className="text-lg text-slate-800 font-medium">{q?.text}</p>
          </div>
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                <div className="w-6 h-6 rounded-sm bg-white" />
              </div>
            </div>
          </div>
          <p className="text-red-500 font-medium mb-6">● 录音中...</p>
          <button onClick={stopRecording} className="w-full py-4 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-xl font-semibold hover:from-slate-600 hover:to-slate-700 transition-all shadow-lg">
            停止录音
          </button>
        </div>
      </div>
    );
  }

  // ===== 回放检查 =====
  if (phase === 'review' && recordedBlob) {
    // 使用 ref 管理 Blob URL，每次进入 review 时创建，离开或重新渲染时复用
    if (!blobUrlRef.current) {
      blobUrlRef.current = URL.createObjectURL(recordedBlob);
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">录音完成</h2>
            <p className="text-slate-500">回放检查后可提交</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-6 mb-6">
            <p className="text-slate-800 font-medium mb-4">{q?.text}</p>
            <audio controls src={blobUrlRef.current} className="w-full" />
          </div>
          <div className="flex gap-4">
            <button onClick={() => {
              // 释放旧 Blob URL
              if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
              }
              setRecordedBlob(null);
              setPhase('ready');
              startRecording();
            }} className="flex-1 py-3 border-2 border-blue-500 text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all">
              重新录音
            </button>
            <button onClick={submitAndNext} className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg">
              提交并继续
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 评分报告页（逐题展示，全部题目各维度评完后可确认提交） =====
  if (phase === 'report') {
    const rq = mat.questions[reportIndex];
    const kwList = rq?.keywords ?? [];
    const cur: ReportQState = (rq && reportStates[rq.id]) || initReportQState(kwList.length);
    const rec = rq ? reportBlobs[rq.id] : undefined;
    // 该题录音回放的 Blob URL（提交时已统一创建）
    const recUrl = rq ? (reportBlobUrls[rq.id] ?? null) : null;

    const totalScore = DIMENSIONS.reduce((sum, d) => sum + (cur.dimScores[d.key] ?? 0), 0);
    const allRated = DIMENSIONS.every((d) => (cur.dimScores[d.key] ?? 0) > 0);
    // 全部题目都评完后"确认提交"才可用
    const allQuestionsRated = mat.questions.every((qq) => {
      const st = reportStates[qq.id];
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
    const cardPrefix = `${rq?.id ?? reportIndex}:`;
    const cardOpen = (name: string) => !!expandedCards[cardPrefix + name];
    // 卡片标题行（右侧箭头控制展开/折叠）
    const cardHeader = (name: string, title: ReactNode, titleClass: string) => (
      <button type="button" onClick={() => toggleCard(cardPrefix + name)} className="w-full flex items-center justify-between gap-2">
        <h3 className={`font-semibold text-sm ${titleClass}`}>{title}</h3>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${cardOpen(name) ? 'rotate-180' : ''} ${titleClass}`} />
      </button>
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full bg-white/95 rounded-2xl shadow-xl p-8 my-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">听力简答 · 评分报告</h2>
            <p className="text-slate-500 mt-1">{mat.title}（自评或教员打分）</p>
            <span className="inline-block mt-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              问题 {reportIndex + 1} / {totalQ}
            </span>
            {/* 收藏本题（文本与评分元数据，录音不持久化） */}
            {rq && (
              <div className="mt-2">
                <FavoriteButton
                  entry={{
                    key: `p3:${rq.id}`,
                    part: 3,
                    title: rq.text,
                    text: rq.text,
                    detail: rq.referenceAnswer,
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
                <p className="text-slate-600 text-sm font-medium">回放你的回应录音：</p>
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
                    {cur.modelProgress !== null && <span className="text-blue-500 ml-1">{cur.modelProgress}%</span>}
                  </p>
                ) : cur.stage === 'transcribing' ? (
                  <p className="text-slate-500 text-sm">正在将录音转写为文字…</p>
                ) : cur.stage === 'error' ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-400 text-sm">
                      语音转写失败{cur.error ? `（${cur.error}）` : ''}，请根据回放手动评分。
                    </p>
                    {rec && rq && (
                      <button
                        onClick={() => startTranscription(rq.id, rec)}
                        className="shrink-0 px-3 py-1.5 text-sm border border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 transition-all"
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
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                {cardHeader('question', '题目', 'text-blue-800')}
                {cardOpen('question') && (
                  <p className="text-blue-700 text-sm leading-relaxed mt-2">{rq.text}</p>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                {cardHeader('reference', '参考答案（仅供参考）', 'text-slate-700')}
                {cardOpen('reference') && (
                  <p className="text-slate-600 text-sm leading-relaxed mt-2">{rq.referenceAnswer}</p>
                )}
              </div>
              {kwList.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4">
                  {cardHeader('keywords', `重要信息（关键词）覆盖（已覆盖 ${coveredCount}/${kwList.length}）`, 'text-slate-700')}
                  {cardOpen('keywords') && (
                    <div className="mt-2">
                      <p className="text-slate-400 text-xs mb-3">系统已根据你的回应（转写文本）自动比对以下重要信息点，"关键词覆盖"维度分随覆盖率自动给出。</p>
                      <div className="space-y-2">
                        {kwList.map((kw, i) => (
                          <label key={i} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={cur.keywordChecks[i] ?? false}
                              disabled
                              readOnly
                              className="w-4 h-4 accent-blue-600"
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
                        onClick={() => rq && setDimScore(rq.id, dim.key, score, kwList.length)}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                          (cur.dimScores[dim.key] ?? 0) === score
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-700'
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
            <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-blue-900">本题评估报告</h3>
                <span className="text-lg font-bold text-blue-700">
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
                  : 'border-2 border-blue-500 text-blue-600 hover:bg-blue-50'
              }`}
            >
              上一题
            </button>
            {reportIndex < totalQ - 1 ? (
              <button
                onClick={() => setReportIndex((i) => Math.min(totalQ - 1, i + 1))}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
              >
                下一题
              </button>
            ) : (
              <button
                onClick={handleConfirmReport}
                disabled={!allQuestionsRated}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all shadow-lg ${
                  allQuestionsRated
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {allQuestionsRated ? '确认提交并进入下一部分' : '请先完成全部题目各 5 个维度的评分'}
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
    );
  }

  // ===== 已提交 =====
  if (phase === 'submitted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">第三部分完成</h2>
          <p className="text-slate-500">您的回答已提交</p>
        </div>
      </div>
    );
  }

  return null;
}
