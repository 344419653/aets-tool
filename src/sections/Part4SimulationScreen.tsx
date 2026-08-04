import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SimulationResult, SimulationRecording, SimulationMaterial, ShortAnswerAssessment } from '@/types/exam';
import { loadScenario, getScenarioList, type SimulationScenario } from '@/data/questionsPart4Simulation';
import { scoreStoryRetelling, type StoryDimKey } from '@/lib/storyAutoScore';
import { scoreShortAnswerWithLLM, clampLlmScore, type LlmScoreResult } from '@/lib/llmScore';
import { transcribeAudio } from '@/lib/whisperTranscribe';
import { evaluateFreeSpeech, iseToFive } from '@/lib/iseEvaluate';
import FavoriteButton from '@/components/FavoriteButton';
import RateAudio from '@/components/RateAudio';
import PlaybackRateButton from '@/components/PlaybackRateButton';

interface Props {
  onComplete: (result: SimulationResult) => void;
}

type Phase =
  | 'select'     // 选择场景
  | 'outline'    // 引导界面
  | 'pilot'      // 播放Pilot通话
  | 'prompt'     // 播放提示音
  | 'recording'  // 录音10秒
  | 'roundDone'  // 本轮录音结束，可进入下一轮或直接提交结束
  | 'report'     // 评分报告页（逐轮展示，评完后确认提交）
  | 'submitted'; // 已完成

/** 评分维度（AETS 模拟通话评分标准，每项 1-5 分，与听力简答同一套维度） */
const DIMENSIONS = [
  { key: 'content', label: '内容完整性', desc: '回应是否覆盖参考答案要点，紧扣 Pilot 通话与背景指令' },
  { key: 'keywords', label: '关键词覆盖', desc: '重要信息点是否答到（随下方勾选自动给分，可手动调整）' },
  { key: 'fluency', label: '流利度与连贯性', desc: '语速自然、长时间停顿少、表达连贯' },
  { key: 'grammar', label: '语法与词汇', desc: '句型结构正确、时态一致、用词恰当' },
  { key: 'pronunciation', label: '发音', desc: '清晰易懂，单词重音、数字与呼号读法正确' },
] as const;

type DimKey = (typeof DIMENSIONS)[number]['key'];

/** 各维度偏弱时的改进建议（content/keywords 针对模拟通话改写，其余复用听力简答文案） */
const DIM_SUGGESTIONS: Record<DimKey, string> = {
  content: '回应未覆盖参考答案要点，注意听清 Pilot 通话内容与背景提示指令，按指令逐条回应。',
  keywords: '遗漏重要信息点，通话时重点捕捉呼号、高度、速度、跑道号等关键要素并在回应中复诵。',
  fluency: '多做影子跟读（shadowing）练习，减少长时间停顿、重复和自我纠正，保持语流连续。',
  grammar: '指令性回应使用标准通话句式，注意主谓一致和基本句型，避免逐字中译英。',
  pronunciation: '对照原文音频逐句模仿，注意单词重音、句子语调，以及高度、速度、呼号等数字的规范读法。',
};

/** 报告页每轮的评分/转写状态（按 roundIndex 存） */
interface ReportQState {
  /** 转写出的英文文本（完成后才有值） */
  transcript: string;
  /** 转写流程状态：idle 未开始 / loading 模型下载加载中 / transcribing 转写中 / done 完成 / error 失败 */
  stage: 'idle' | 'loading' | 'transcribing' | 'done' | 'error';
  /** 模型下载进度百分比（0-100，未知为 null） */
  modelProgress: number | null;
  /** 转写失败信息（用于报告页提示与重试） */
  error: string | null;
  /** 关键词覆盖（与该轮 keywords 顺序一致，由转写文本自动比对，界面只读展示） */
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

/** 生成某轮的初始报告状态 */
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

export default function Part4SimulationScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [material, setMaterial] = useState<SimulationMaterial | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [pilotSegIndex, setPilotSegIndex] = useState(0);
  const [recordings, setRecordings] = useState<SimulationRecording[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(10);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // recordings 的 ref 镜像（recorder.onstop 闭包里 state 可能尚未更新，统一经 ref 取最新录音列表）
  const recordingsRef = useRef<SimulationRecording[]>([]);
  // 最后一轮录音停止后待进入报告页的标记（onstop 异步触发，等录音落库后再进 report）
  const pendingReportRef = useRef(false);

  // --- 评分报告状态（报告页按轮逐步展示，数据按 roundIndex 存） ---
  const [reportStates, setReportStates] = useState<Record<number, ReportQState>>({});
  // 报告页当前展示的轮次下标（在已录音轮次列表中的位置）
  const [reportIndex, setReportIndex] = useState(0);
  // 报告页各信息卡片的展开状态（key 为 "轮次:卡片名"，默认全部折叠，点箭头展开）
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const toggleCard = (key: string) => setExpandedCards((s) => ({ ...s, [key]: !s[key] }));
  // 各轮转写任务递增 id：重新进入报告页/卸载时使旧的异步结果失效，防止串轮覆盖
  const transcribeRunRef = useRef<Record<number, number>>({});
  // 各轮 ISE 评测任务递增 id（与 transcribeRunRef 同理）
  const iseRunRef = useRef<Record<number, number>>({});
  // 报告页各轮录音回放的 Blob（按 roundIndex 存，进入报告页时从 recordings 复制）
  const [reportBlobs, setReportBlobs] = useState<Record<number, Blob>>({});
  // 报告页各轮录音回放的 Blob URL（按 roundIndex 存，进入报告页时统一创建）
  const [reportBlobUrls, setReportBlobUrls] = useState<Record<number, string>>({});
  // 已创建的 Blob URL 镜像（仅用于卸载/清理时统一释放，render 不访问）
  const reportBlobUrlsRef = useRef<Record<number, string>>({});

  const currentRound = material?.rounds?.[roundIndex];
  const totalRounds = material?.rounds?.length || 0;
  // 当前材料 ref（转写/LLM 回调闭包内 material 可能已过期，统一经 ref 取最新材料）
  const materialRef = useRef(material);
  useEffect(() => {
    materialRef.current = material;
  });

  // ===== 选择场景 =====
  const handleSelectScenario = useCallback(async (scenario: SimulationScenario) => {
    const mat = await loadScenario(scenario);
    setMaterial(mat);
    setPhase('outline');
  }, []);

  // ===== 清理 =====
  const cleanup = useCallback(() => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    // 卸载时使进行中的转写/ISE 评测结果失效（worker 仍在跑，但结果会被丢弃）
    transcribeRunRef.current = {};
    iseRunRef.current = {};
    // 释放报告页回放 Blob URL
    Object.values(reportBlobUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    reportBlobUrlsRef.current = {};
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // ===== 播放音频 =====
  const playAudio = useCallback((src: string, onEnded: () => void) => {
    if (!src) {
      onEnded();
      return;
    }
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.addEventListener('ended', () => {
      onEnded();
    }, { once: true });
    audio.addEventListener('error', () => {
      console.error('Audio error:', src);
      onEnded();
    }, { once: true });
    audio.play().catch(() => {
      onEnded();
    });
  }, []);

  // 启动某轮的后台转写（进入报告页时触发；失败可在报告页重试）
  const startTranscription = useCallback((roundIdx: number, blob: Blob) => {
    const runId = (transcribeRunRef.current[roundIdx] ?? 0) + 1;
    transcribeRunRef.current[roundIdx] = runId;
    setReportStates((s) => ({
      ...s,
      [roundIdx]: { ...(s[roundIdx] ?? initReportQState(0)), stage: 'loading', error: null, modelProgress: null },
    }));
    transcribeAudio(blob, (stage, percent) => {
      if (transcribeRunRef.current[roundIdx] !== runId) return; // 过期任务，忽略进度
      setReportStates((s) => {
        const cur = s[roundIdx];
        if (!cur) return s;
        return {
          ...s,
          [roundIdx]: stage === 'loading'
            ? { ...cur, stage: 'loading', modelProgress: percent }
            : { ...cur, stage: 'transcribing' },
        };
      });
    }).then((text) => {
      if (transcribeRunRef.current[roundIdx] !== runId) return; // 过期任务，丢弃结果
      // 转写完成即自动预评一次（同一文本不重复预评，避免覆盖人工已改的分数）
      const round = materialRef.current?.rounds?.[roundIdx - 1];
      setReportStates((s) => {
        const cur = s[roundIdx];
        if (!cur) return s;
        const nextState: ReportQState = { ...cur, transcript: text, stage: 'done', llmFeedback: null, correctedTranscript: null };
        if (round && text && cur.lastAutoScored !== text) {
          // 本地预评（词面匹配），作为 LLM 评分的兜底；fluency 维度始终由本地声学估算给出
          const auto = scoreStoryRetelling({
            transcript: text,
            durationSec: cur.durationSec,
            keywords: (round.keywords ?? []).map((k) => ({ english: k, chinese: '' })),
            // 模拟通话的参考文本即参考答案，语义与故事原文一致
            storyTranscript: round.referenceAnswer || null,
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
        return { ...s, [roundIdx]: nextState };
      });
      // LLM 语义评分：同义改写同等给分，覆盖 content/keywords/grammar 三维并生成针对性反馈。
      // 仅覆盖用户尚未手动改过的维度（当前值仍等于本地预评值或空缺）；失败静默回退本地预评。
      if (round && text) {
        // "所问的问题" = Pilot 通话原文 + 背景提示指令
        const questionText = `${round.pilotScripts.join(' ')}\n背景指令：${round.context}`;
        void scoreShortAnswerWithLLM({
          question: questionText,
          referenceAnswer: round.referenceAnswer ?? '',
          keywords: round.keywords ?? [],
          transcript: text,
        }).then((r: LlmScoreResult) => {
          if (transcribeRunRef.current[roundIdx] !== runId) return;
          setReportStates((s) => {
            const cur = s[roundIdx];
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
            const kwList = round.keywords ?? [];
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
              [roundIdx]: {
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
      if (transcribeRunRef.current[roundIdx] !== runId) return;
      setReportStates((s) => {
        const cur = s[roundIdx];
        if (!cur) return s;
        return { ...s, [roundIdx]: { ...cur, stage: 'error', error: err instanceof Error ? err.message : String(err) } };
      });
    });
  }, []);

  // 启动某轮的讯飞 ISE 发音评测（topic 英文自由题，与转写并行、互不阻塞；
  // 试卷文本 = 该轮背景提示指令 + 评测锚点（优先下一轮 pilot 回复原文，与指令同源；
  // 最后一轮回退参考答案）。代理未启动/评测失败时置 error，报告页温和提示、发音维度保持手动评分）
  const startIseEvaluation = useCallback((roundIdx: number, blob: Blob, questionText: string, refText: string) => {
    const runId = (iseRunRef.current[roundIdx] ?? 0) + 1;
    iseRunRef.current[roundIdx] = runId;
    setReportStates((s) => {
      const cur = s[roundIdx];
      if (!cur) return s;
      return { ...s, [roundIdx]: { ...cur, iseStage: 'evaluating', iseError: null, iseRejected: false } };
    });
    evaluateFreeSpeech(blob, questionText, refText).then((scores) => {
      if (iseRunRef.current[roundIdx] !== runId) return; // 过期任务，丢弃结果
      // 发音维度优先取 topic 专有的发音准确度（phoneScore），缺失则回退总分
      const phone = scores.phoneScore ?? scores.total;
      const five = iseToFive(phone);
      setReportStates((s) => {
        const cur = s[roundIdx];
        if (!cur) return s;
        return {
          ...s,
          [roundIdx]: {
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
      if (iseRunRef.current[roundIdx] !== runId) return;
      setReportStates((s) => {
        const cur = s[roundIdx];
        if (!cur) return s;
        return { ...s, [roundIdx]: { ...cur, iseStage: 'error', iseError: err instanceof Error ? err.message : String(err) } };
      });
    });
  }, []);

  // ===== 进入评分报告页（只评已录音的轮次，按 roundIndex 排序） =====
  // 统一创建各轮回放 Blob 与 ObjectURL，初始化各轮报告状态并按轮启动转写与发音评测
  const enterReport = useCallback(() => {
    const recs = [...recordingsRef.current].sort((a, b) => a.roundIndex - b.roundIndex);
    const blobs: Record<number, Blob> = {};
    const urls: Record<number, string> = {};
    recs.forEach((r) => {
      blobs[r.roundIndex] = r.blob;
      urls[r.roundIndex] = URL.createObjectURL(r.blob);
    });
    reportBlobUrlsRef.current = urls;
    setReportBlobs(blobs);
    setReportBlobUrls(urls);
    recs.forEach((r) => {
      const round = materialRef.current?.rounds?.[r.roundIndex - 1];
      // 初始化该轮报告状态并写入实际录音时长（秒），供流利度评分使用
      setReportStates((s) => ({
        ...s,
        [r.roundIndex]: {
          ...(s[r.roundIndex] ?? initReportQState(round?.keywords?.length ?? 0)),
          durationSec: r.duration / 1000,
        },
      }));
      startTranscription(r.roundIndex, r.blob);
      // 有评测锚点的轮并行启动讯飞 ISE topic 自由题评测（无锚点则跳过，发音维度手动评）。
      // 锚点优先用下一轮 pilot 回复原文（与背景指令同源一致，为主要依据）；
      // 最后一轮/缺失时回退该轮参考答案（rounds 下标从 0 起，rounds[roundIndex] 即下一轮）。
      const nextPilot = (materialRef.current?.rounds?.[r.roundIndex]?.pilotScripts ?? []).join(' ').trim();
      const iseAnchor = nextPilot || round?.referenceAnswer || '';
      if (iseAnchor) startIseEvaluation(r.roundIndex, r.blob, round?.context ?? '', iseAnchor);
    });
    setReportIndex(0);
    setPhase('report');
  }, [startTranscription, startIseEvaluation]);

  // ===== 开始录音 =====
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
        const rec: SimulationRecording = {
          roundIndex: roundIndex + 1,
          blob,
          duration: Date.now() - recordingStartTimeRef.current,
        };
        recordingsRef.current = [...recordingsRef.current, rec];
        setRecordings(recordingsRef.current);
        stream.getTracks().forEach((t) => t.stop());
        // 最后一轮录音已落库：进入评分报告页（onstop 异步触发，不能由定时器直接进 report）
        if (pendingReportRef.current) {
          pendingReportRef.current = false;
          enterReport();
        }
      };
      recorder.start();
      recordingStartTimeRef.current = Date.now();
    } catch (err) {
      console.error('Recording failed:', err);
    }
  }, [roundIndex, enterReport]);

  // ===== 停止录音 =====
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ===== 阶段驱动逻辑 =====
  useEffect(() => {
    if (!material) return;

    if (phase === 'pilot' && currentRound) {
      // 依次播放本轮所有 Pilot 语音段
      playAudio(currentRound.pilotAudios[pilotSegIndex], () => {
        if (pilotSegIndex + 1 < currentRound.pilotAudios.length) {
          // 还有下一段 Pilot 语音，继续播放
          setPilotSegIndex((prev) => prev + 1);
        } else {
          // 全部播完 → 播放提示音
          setPhase('prompt');
        }
      });
    }
    else if (phase === 'prompt' && currentRound) {
      // 播放提示音
      playAudio(currentRound.backgroundAudio, () => {
        // 提示音结束 → 开始录音10秒
        setPhase('recording');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundIndex, pilotSegIndex, material]);

  // ===== 10秒录音倒计时 =====
  useEffect(() => {
    if (phase !== 'recording' || !currentRound) return;

    startRecording();
    setRecordingSeconds(10);

    countdownIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    recordingTimerRef.current = setTimeout(() => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (roundIndex + 1 < totalRounds) {
        // 非最后一轮 → 进入"本轮完成"界面，由考生选择进入下一轮或直接提交结束
        stopRecording();
        setPhase('roundDone');
      } else {
        // 最后一轮 → 录音落库后直接进入评分报告页（onstop 里检查 pendingReportRef）
        pendingReportRef.current = true;
        stopRecording();
      }
    }, 10000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [phase, currentRound, totalRounds, roundIndex, startRecording, stopRecording]);

  // ===== 进入下一轮 =====
  const handleNextRound = useCallback(() => {
    setRoundIndex((prev) => prev + 1);
    setPilotSegIndex(0);
    setPhase('pilot');
  }, []);

  // ===== 直接提交答案，结束模拟通话（跳过后续轮次，进入评分报告页） =====
  const handleFinishEarly = useCallback(() => {
    enterReport();
  }, [enterReport]);

  // 报告页确认提交：汇总每轮评分进 SimulationResult.assessments 后 onComplete
  const handleConfirmReport = useCallback(() => {
    const assessments: Record<number, ShortAnswerAssessment> = {};
    for (const rec of recordingsRef.current) {
      const cur = reportStates[rec.roundIndex];
      if (!cur) continue;
      const dimensions = Object.fromEntries(
        DIMENSIONS.map((d) => [d.key, cur.dimScores[d.key] ?? 0])
      ) as ShortAnswerAssessment['dimensions'];
      const totalScore = Object.values(dimensions).reduce((sum, v) => sum + v, 0);
      assessments[rec.roundIndex] = {
        transcript: cur.transcript,
        keywordCovered: cur.keywordChecks,
        dimensions,
        totalScore,
      };
    }
    setPhase('submitted');
    onComplete({
      simulationId: material?.id || 1,
      recordings: recordingsRef.current,
      totalRounds,
      completedRounds: recordingsRef.current.length,
      assessments,
    });
  }, [reportStates, onComplete, material, totalRounds]);

  // 报告页手动给某轮某维度打分
  const setDimScore = useCallback((roundIdx: number, dim: DimKey, score: number, kwCount: number) => {
    setReportStates((s) => {
      const cur = s[roundIdx] ?? initReportQState(kwCount);
      return { ...s, [roundIdx]: { ...cur, dimScores: { ...cur.dimScores, [dim]: score } } };
    });
  }, []);

  // ===== 重新开始 =====
  const handleRestart = useCallback(() => {
    cleanup();
    setPhase('select');
    setMaterial(null);
    setRoundIndex(0);
    setPilotSegIndex(0);
    setRecordings([]);
    recordingsRef.current = [];
    setRecordingSeconds(10);
    // 重置评分报告状态
    setReportStates({});
    setReportBlobs({});
    setReportBlobUrls({});
    setReportIndex(0);
    pendingReportRef.current = false;
  }, [cleanup]);

  // ==================== 渲染 ====================

  // ===== 1. 场景选择 =====
  if (phase === 'select') {
    const scenarios = getScenarioList();
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-8">
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">第四部分：模拟通话</h1>
            <p className="text-slate-500 mt-2">选择一套场景开始练习</p>
          </div>
          <div className="grid grid-cols-1 gap-3 mb-6">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectScenario(s.id as SimulationScenario)}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg text-left px-6"
              >
                <div className="font-bold">{s.name}</div>
                <div className="text-sm opacity-80">{s.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== 2. 引导界面 =====
  if (phase === 'outline') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-8">
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">第四部分：模拟通话</h1>
            <p className="text-slate-500 mt-2">{material?.title || 'Simulation'}</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 mb-6 text-left">
            <h3 className="font-semibold text-orange-800 mb-3">考试说明</h3>
            <ul className="text-orange-700 text-sm space-y-2">
              <li>• 你将扮演管制员（Controller），与飞行员（Pilot）进行无线电通话</li>
              <li>• 每轮通话分为三段：Pilot通话 → 提示音 → 10 秒录音回应</li>
              <li>• 提示音读完后自动开始录音，并倒计时 10 秒，倒计时结束后自动进入下一轮</li>
              <li>• 共 {totalRounds} 轮对话，完成后进入评分报告页</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <button onClick={handleRestart}
              className="flex-1 py-4 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-all">
              返回选择
            </button>
            {totalRounds > 0 ? (
              <button onClick={() => setPhase('pilot')}
                className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg">
                开始模拟通话
              </button>
            ) : (
              <button disabled
                className="flex-1 py-4 bg-slate-300 text-slate-500 rounded-xl font-semibold cursor-not-allowed">
                开始模拟通话
              </button>
            )}
          </div>
          {totalRounds === 0 && (
            <p className="text-red-500 text-sm mt-3">该场景没有加载到轮次，请返回重新选择。</p>
          )}
        </div>
      </div>
    );
  }

  // ===== 3. 播放Pilot通话 =====
  if (phase === 'pilot' && currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-4">
            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
              第 {roundIndex + 1} / {totalRounds} 轮
            </span>
          </div>
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Pilot 通话中</h2>
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <p className="text-slate-700 text-sm italic">"{currentRound.pilotScripts[pilotSegIndex]}"</p>
          </div>
          {currentRound.pilotAudios.length > 1 && (
            <p className="text-slate-500 text-sm mb-2">
              正在播放第 {pilotSegIndex + 1} / {currentRound.pilotAudios.length} 段 Pilot 语音
            </p>
          )}
          <p className="text-slate-400 text-sm">通话结束后将播放提示音，请准备好回应</p>
        </div>
      </div>
    );
  }

  // ===== 4. 播放提示音 =====
  if (phase === 'prompt' && currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-4">
            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
              第 {roundIndex + 1} / {totalRounds} 轮
            </span>
          </div>
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <svg className="w-10 h-10 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">正在播放提示音</h2>
          <p className="text-slate-500 mb-4">请根据提示音准备回应</p>
          <p className="text-slate-400 text-sm">提示音结束后自动开始 10 秒录音</p>
        </div>
      </div>
    );
  }

  // ===== 5. 录音中（10秒倒计时） =====
  if (phase === 'recording' && currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-4">
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
              第 {roundIndex + 1} / {totalRounds} 轮
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">请回应</h2>
          <p className="text-slate-500 mb-6">作为管制员回应 Pilot 的通话</p>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
              <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
                <div className="w-5 h-5 rounded-sm bg-white" />
              </div>
            </div>
          </div>
          <p className="text-red-500 font-medium mb-2">● 正在录音...</p>
          <p className="text-red-600 text-3xl font-bold mb-6">{recordingSeconds} 秒</p>
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <p className="text-blue-800 text-sm font-medium mb-1">Pilot said:</p>
            <p className="text-blue-700 text-sm italic">"{currentRound.pilotScripts.join(' ')}"</p>
          </div>
          <p className="text-slate-400 text-sm">录音结束后自动进入下一轮</p>
        </div>
      </div>
    );
  }

  // ===== 5b. 本轮录音结束（可进入下一轮或直接提交结束） =====
  if (phase === 'roundDone' && currentRound) {
    const justRecorded = recordings.find((r) => r.roundIndex === roundIndex + 1);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-4">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
              第 {roundIndex + 1} / {totalRounds} 轮录音已完成
            </span>
          </div>
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">本轮回应已录制</h2>
          {justRecorded && (
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-700 font-medium">第 {justRecorded.roundIndex} 轮回放</span>
                <span className="text-slate-400 text-sm">{(justRecorded.duration / 1000).toFixed(1)}s</span>
              </div>
              <audio controls src={URL.createObjectURL(justRecorded.blob)} className="w-full" />
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleFinishEarly} disabled={!justRecorded}
              className="flex-1 py-4 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              直接提交答案，结束模拟通话
            </button>
            <button onClick={handleNextRound} disabled={!justRecorded}
              className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              进入下一轮
            </button>
          </div>
          <p className="text-slate-400 text-sm mt-3">
            {justRecorded ? `结束后将进入评分报告页，已录 ${recordings.length} 轮` : '录音保存中…'}
          </p>
        </div>
      </div>
    );
  }

  // ===== 6. 评分报告页（逐轮展示，全部已录音轮各维度评完后可确认提交） =====
  if (phase === 'report') {
    // 只评已录音的轮次，按 roundIndex 排序
    const reportRounds = [...recordings].sort((a, b) => a.roundIndex - b.roundIndex);
    const totalReport = reportRounds.length;
    const rec = reportRounds[reportIndex];
    const round = rec ? material?.rounds?.[rec.roundIndex - 1] : undefined;
    const kwList = round?.keywords ?? [];
    const cur: ReportQState = (rec && reportStates[rec.roundIndex]) || initReportQState(kwList.length);
    // 该轮录音回放的 Blob 与 Blob URL（进入报告页时已统一创建）
    const recBlob = rec ? reportBlobs[rec.roundIndex] : undefined;
    const recUrl = rec ? (reportBlobUrls[rec.roundIndex] ?? null) : null;

    const totalScore = DIMENSIONS.reduce((sum, d) => sum + (cur.dimScores[d.key] ?? 0), 0);
    const allRated = DIMENSIONS.every((d) => (cur.dimScores[d.key] ?? 0) > 0);
    // 全部已录音轮都评完后"确认提交"才可用
    const allRoundsRated = reportRounds.every((r) => {
      const st = reportStates[r.roundIndex];
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
    // 卡片展开状态的 key 前缀（按轮次区分）
    const cardPrefix = `${rec?.roundIndex ?? reportIndex + 1}:`;
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
            <h2 className="text-2xl font-bold text-slate-800">模拟通话 · 评分报告</h2>
            <p className="text-slate-500 mt-1">{material?.title || 'Simulation'}（自评或教员打分）</p>
            <span className="inline-block mt-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
              第 {rec?.roundIndex ?? reportIndex + 1} 轮（{reportIndex + 1} / {totalReport}）
            </span>
            {/* 收藏本轮（文本与评分元数据，录音不持久化） */}
            {rec && (
              <div className="mt-2">
                <FavoriteButton
                  entry={{
                    key: `p4:${material?.id ?? 0}:${rec.roundIndex}`,
                    part: 4,
                    title: `${material?.title || 'Simulation'} 第 ${rec.roundIndex} 轮`,
                    text: round?.context,
                    detail: round?.referenceAnswer,
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
              本轮未检测到录音，以下维度请结合考场情况手动评分。
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
                    {recBlob && rec && (
                      <button
                        onClick={() => startTranscription(rec.roundIndex, recBlob)}
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

          {/* Pilot 通话原文、背景提示与参考答案 */}
          {round && (
            <div className="mb-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                {cardHeader('pilot', 'Pilot 通话原文', 'text-blue-800')}
                {cardOpen('pilot') && (
                  <ul className="text-blue-700 text-sm leading-relaxed space-y-1 mt-2">
                    {round.pilotScripts.map((line, i) => (
                      <li key={i} className="italic">"{line}"</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                {cardHeader('context', '背景提示', 'text-orange-800')}
                {cardOpen('context') && (
                  <p className="text-orange-700 text-sm leading-relaxed mt-2">{round.context}</p>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                {cardHeader('reference', '参考答案（仅供参考）', 'text-slate-700')}
                {cardOpen('reference') && (
                  <p className="text-slate-600 text-sm leading-relaxed mt-2">{round.referenceAnswer}</p>
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
                        onClick={() => rec && setDimScore(rec.roundIndex, dim.key, score, kwList.length)}
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

          {/* 评估报告（本轮全部维度评完后显示） */}
          {allRated && (
            <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-blue-900">本轮评估报告</h3>
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

          {/* 轮次切换 + 最终提交 */}
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
              上一轮
            </button>
            {reportIndex < totalReport - 1 ? (
              <button
                onClick={() => setReportIndex((i) => Math.min(totalReport - 1, i + 1))}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
              >
                下一轮
              </button>
            ) : (
              <button
                onClick={handleConfirmReport}
                disabled={!allRoundsRated}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all shadow-lg ${
                  allRoundsRated
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {allRoundsRated ? '确认提交并进入下一部分' : '请先完成全部轮次各 5 个维度的评分'}
              </button>
            )}
          </div>
          {reportIndex === totalReport - 1 && !allRoundsRated && (
            <p className="text-center text-slate-400 text-xs mt-3">
              还有轮次未评完分，可用"上一轮"返回检查。
            </p>
          )}
        </div>
      </div>
    );
  }

  // ===== 8. 已完成 =====
  if (phase === 'submitted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">第四部分完成</h2>
          <p className="text-slate-500">您的模拟通话录音已提交</p>
          <button onClick={handleRestart}
            className="mt-6 w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg">
            返回选择场景
          </button>
        </div>
      </div>
    );
  }

  // 数据异常兜底：没有可用轮次时避免白屏
  if ((phase === 'pilot' || phase === 'prompt' || phase === 'recording') && !currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">场景加载异常</h2>
          <p className="text-slate-600 mb-6">当前场景没有可用轮次，请重新选择。</p>
          <button onClick={handleRestart}
            className="w-full py-4 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-all">
            返回选择
          </button>
        </div>
      </div>
    );
  }

  return null;
}
