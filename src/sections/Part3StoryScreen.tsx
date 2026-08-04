import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { StoryTellingResult, StoryAssessment } from '@/types/exam';
import { getRandomStory } from '@/data/questionsPart3Story';
import { scoreStoryRetelling, type StoryDimKey } from '@/lib/storyAutoScore';
import { transcribeAudio } from '@/lib/whisperTranscribe';
import { evaluateFreeSpeech, iseToFive, type IseScores } from '@/lib/iseEvaluate';
import { scoreShortAnswerWithLLM, clampLlmScore, type LlmScoreResult } from '@/lib/llmScore';
import FavoriteButton from '@/components/FavoriteButton';
import RateAudio from '@/components/RateAudio';
import PlaybackRateButton from '@/components/PlaybackRateButton';

interface Props {
  onComplete: (result: StoryTellingResult) => void;
}

type Phase =
  | 'outline'
  | 'playing1'
  | 'interval'
  | 'playing2'
  | 'retelling'
  | 'recording'
  | 'review'
  | 'report'
  | 'submitted';

const INTERVAL_MS = 10000;
const RETELL_TIME = 300;

/** 评分维度（AETS 故事复述评分标准，每项 1-5 分） */
const DIMENSIONS = [
  { key: 'content', label: '内容完整性', desc: '情节要点（起因、经过、结果）是否齐全，有无遗漏或编造' },
  { key: 'keywords', label: '关键词覆盖', desc: '5 个关键词是否用上（随下方勾选自动给分，可手动调整）' },
  { key: 'fluency', label: '流利度与连贯性', desc: '语速自然、长时间停顿少、叙述连贯有条理' },
  { key: 'grammar', label: '语法与词汇', desc: '句型结构正确、时态一致、用词恰当' },
  { key: 'pronunciation', label: '发音', desc: '清晰易懂，单词重音、数字与呼号读法正确' },
] as const;

type DimKey = (typeof DIMENSIONS)[number]['key'];

/** 各维度偏弱时的改进建议 */
const DIM_SUGGESTIONS: Record<DimKey, string> = {
  content: '边听边记笔记，按"起因—经过—结果"梳理情节骨架，复述时先搭框架再补细节（时间、地点、人物、数字）。',
  keywords: '关键词是故事复述的核心得分点，听到关键术语立刻记录，复述时刻意用上原词。',
  fluency: '多做影子跟读（shadowing）练习，减少长时间停顿、重复和自我纠正，保持语流连续。',
  grammar: '叙述已发生的事件统一用过去时，注意主谓一致和基本句型，避免逐字中译英。',
  pronunciation: '对照原文音频逐句模仿，注意单词重音、句子语调，以及高度、速度、呼号等数字的规范读法。',
};

/** 故事复述的"题目"文本：讯飞 topic 评测与 LLM 语义评分共用（复述指令） */
const RETELL_INSTRUCTION = 'Please retell the story you heard in your own words.';

export default function Part3StoryScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('outline');
  // 报告页各信息卡片的展开状态（默认全部折叠，点箭头展开）
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const toggleCard = (key: string) => setExpandedCards((s) => ({ ...s, [key]: !s[key] }));
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  // 倒计时，-1 表示未初始化（关键：避免初始值0被误判为倒计时归零）
  const [countdown, setCountdown] = useState(-1);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPaused, setAudioPaused] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 故事音频的 error 监听器引用，卸载清理时先移除再清空 src，避免误弹"音频播放失败"
  const audioErrorHandlerRef = useRef<(() => void) | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const intervalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // 随机抽取一个故事
  const [selectedStory] = useState(() => getRandomStory());
  const mat = selectedStory;

  // --- 评分报告状态 ---
  // 关键词覆盖勾选（与 mat.keywords 顺序一致）
  const [keywordChecks, setKeywordChecks] = useState<boolean[]>(() => mat.keywords.map(() => false));
  // 各维度得分（1-5，0/缺省表示未评分）
  const [dimScores, setDimScores] = useState<Partial<Record<DimKey, number>>>({});

  // --- 语音转写状态（本地 Whisper，录音结束后异步转写） ---
  // 转写出的英文文本（完成后才有值）
  const [transcript, setTranscript] = useState('');
  // 转写流程状态：idle 未开始 / loading 模型下载加载中 / transcribing 转写中 / done 完成 / error 失败
  const [transcribeStage, setTranscribeStage] = useState<'idle' | 'loading' | 'transcribing' | 'done' | 'error'>('idle');
  // 模型下载进度百分比（0-100，未知为 null）
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  // 转写失败信息（用于报告页提示与重试）
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  // 自动评分各维度的依据说明（转写完成后计算）
  // 自动评分各维度的依据说明（转写完成后计算，报告页在对应维度下方展示）
  const [autoReasons, setAutoReasons] = useState<Partial<Record<StoryDimKey, string>>>({});
  // LLM 按 ASR 近音容错规则校正后的转写文本（与原转写不同才有值，转写卡片以此为准）
  const [correctedTranscript, setCorrectedTranscript] = useState<string | null>(null);
  // LLM 生成的评估反馈（得分点/扣分点/改进建议），到达前报告页用模板兜底
  const [llmFeedback, setLlmFeedback] = useState<{ strengths: string[]; weaknesses: string[]; suggestions: string[] } | null>(null);
  const transcriptRef = useRef('');
  // 转写任务递增 id：重新复述/卸载时使旧的异步结果失效，防止覆盖新录音
  const transcribeRunRef = useRef(0);
  // 记录已自动预评过的转写文本，避免用户手动改分后被重复预评覆盖
  const lastAutoScoredRef = useRef('');
  // 本地预评给的各维度分数（供 LLM 到达时"只覆盖未手改维度"判断；用 ref 保证 .then 里读到最新值）
  const localAutoScoresRef = useRef<Partial<Record<DimKey, number>>>({});
  // 本次录音实际时长（秒）
  const recordingDurationSecRef = useRef<number | null>(null);

  // --- 讯飞 ISE 发音评测状态（与转写并行、互不阻塞；故事无原文时不启动） ---
  // idle 未开始 / evaluating 评测中 / done 完成 / error 失败（含未配置密钥、代理未启动）
  const [iseStage, setIseStage] = useState<'idle' | 'evaluating' | 'done' | 'error'>('idle');
  const [, setIseScores] = useState<IseScores | null>(null);
  const [iseError, setIseError] = useState<string | null>(null);
  // ISE 任务递增 id，防旧录音的评测结果覆盖新录音（与 transcribeRunRef 同理）
  const iseRunRef = useRef(0);

  const cleanup = useCallback(() => {
    // 卸载时使进行中的转写结果失效（worker 仍在跑，但结果会被丢弃）
    transcribeRunRef.current += 1;
    iseRunRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioRef.current) {
      // 先移除 error 监听再清空 src：置空 src 会触发 error 事件，
      // 不移除的话卸载时会误弹"音频播放失败"
      if (audioErrorHandlerRef.current) {
        audioRef.current.removeEventListener('error', audioErrorHandlerRef.current);
        audioErrorHandlerRef.current = null;
      }
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (intervalTimeoutRef.current) {
      clearTimeout(intervalTimeoutRef.current);
      intervalTimeoutRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // 播放故事录音（带进度条）
  const playStoryWithProgress = useCallback((onEnded: () => void) => {
    if (!mat.storyAudio) {
      alert('音频材料尚未上传');
      return;
    }
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioPaused(false);

    const audio = new Audio(mat.storyAudio);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
      setAudioCurrentTime(audio.currentTime);
    });
    audio.addEventListener('ended', onEnded, { once: true });
    const handleError = () => alert('音频播放失败');
    audioErrorHandlerRef.current = handleError;
    audio.addEventListener('error', handleError, { once: true });
    // AbortError 是暂停/切换导致的正常中断（如清理时 pause），不算播放失败
    audio.play().catch((err) => {
      if (err?.name === 'AbortError') return;
      alert('音频播放失败');
    });
  }, [mat]);

  const toggleAudioPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { audio.play(); setAudioPaused(false); }
    else { audio.pause(); setAudioPaused(true); }
  }, []);

  const seekAudio = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (!audio || !bar || !audioDuration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(audioDuration, ratio * audioDuration));
    audio.currentTime = newTime;
    setAudioCurrentTime(newTime);
  }, [audioDuration]);

  const fmtTime = (t: number) => {
    if (!t || isNaN(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 阶段驱动
  useEffect(() => {
    if (phase === 'playing1') {
      playStoryWithProgress(() => setPhase('interval'));
    }
    else if (phase === 'interval') {
      intervalTimeoutRef.current = setTimeout(() => setPhase('playing2'), INTERVAL_MS);
    }
    else if (phase === 'playing2') {
      playStoryWithProgress(() => setPhase('retelling'));
    }
    else if (phase === 'retelling') {
      // 启动5分钟倒计时
      setCountdown(RETELL_TIME);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 倒计时归零处理（只在真正倒计时到0时触发）
  useEffect(() => {
    // -1 是未初始化，不处理
    if (countdown !== 0) return;
    // 清除定时器
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    if (isRecordingRef.current) {
      // 正在录音中，不干预，让用户自己结束录音
    } else {
      // 没录音，进入 review
      setPhase('review');
    }
  }, [countdown]);

  // 启动后台转写（录音停止时触发；失败可在报告页重试）
  const startTranscription = useCallback((blob: Blob) => {
    const runId = ++transcribeRunRef.current;
    setTranscribeStage('loading');
    setTranscribeError(null);
    setModelProgress(null);
    transcribeAudio(blob, (stage, percent) => {
      if (transcribeRunRef.current !== runId) return; // 过期任务，忽略进度
      if (stage === 'loading') {
        setTranscribeStage('loading');
        setModelProgress(percent);
      } else {
        setTranscribeStage('transcribing');
      }
    }).then((text) => {
      if (transcribeRunRef.current !== runId) return; // 过期任务，丢弃结果
      transcriptRef.current = text;
      setTranscript(text);
      setTranscribeStage('done');
    }).catch((err: unknown) => {
      if (transcribeRunRef.current !== runId) return;
      setTranscribeStage('error');
      setTranscribeError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  // 启动讯飞 ISE 发音评测（topic 英文自由题，与转写并行、互不阻塞；故事无英文原文时不启动，保持手动评分。
  // 试卷文本 = 复述指令 + 评测锚点（故事英文原文），与听力简答/模拟通话同一题型）
  const startIseEvaluation = useCallback((blob: Blob, refText: string) => {
    const runId = ++iseRunRef.current;
    setIseStage('evaluating');
    setIseScores(null);
    setIseError(null);
    evaluateFreeSpeech(blob, RETELL_INSTRUCTION, refText).then((scores) => {
      if (iseRunRef.current !== runId) return; // 过期任务，丢弃结果
      setIseScores(scores);
      setIseStage('done');
      // 发音维度优先取 topic 专有的发音准确度（phoneScore），缺失则回退总分
      const phone = scores.phoneScore ?? scores.total;
      const five = iseToFive(phone);
      setAutoReasons((s) => ({
        ...s,
        pronunciation: `发音准确度 ${phone.toFixed(0)}/100 → 建议 ${five} 分`,
      }));
      // 自动预填发音维度（教员仍可手动改分）
      setDimScores((s) => ({ ...s, pronunciation: five }));
    }).catch((err: unknown) => {
      if (iseRunRef.current !== runId) return;
      setIseStage('error');
      setIseError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  // 开始录音（转写改为录音结束后由本地 Whisper 异步完成，此处仅重置状态）
  const handleStartRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      // 重置转写状态，并使上一段录音的转写任务失效
      transcribeRunRef.current += 1;
      transcriptRef.current = '';
      setTranscript('');
      setTranscribeStage('idle');
      setTranscribeError(null);
      setModelProgress(null);
      setCorrectedTranscript(null);
      setLlmFeedback(null);
      localAutoScoresRef.current = {};
      recordingDurationSecRef.current = null;
      // 重置 ISE 评测状态，并使上一段录音的评测任务失效
      iseRunRef.current += 1;
      setIseStage('idle');
      setIseScores(null);
      setIseError(null);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        isRecordingRef.current = false;
        // 记录实际录音时长（秒），供流利度评分使用
        if (recordingStartTimeRef.current) {
          recordingDurationSecRef.current = (Date.now() - recordingStartTimeRef.current) / 1000;
        }
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setPhase('review');
        // 录音一停即开始后台转写（review 阶段回放期间转写同步进行）
        startTranscription(blob);
        // 有英文原文的故事并行启动讯飞 ISE 发音评测（无原文则跳过，发音维度手动评）
        if (mat.transcript) startIseEvaluation(blob, mat.transcript);
      };
      recorder.start();
      isRecordingRef.current = true;
      recordingStartTimeRef.current = Date.now();
      setPhase('recording');
    } catch {
      alert('无法访问麦克风，请检查权限设置');
    }
  }, [startTranscription, startIseEvaluation, mat.transcript]);

  // 结束录音
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
  }, []);

  // 最终提交（报告页确认或无录音时直接提交）
  const doComplete = useCallback((assessment?: StoryAssessment) => {
    const duration = recordingStartTimeRef.current
      ? Date.now() - recordingStartTimeRef.current : 0;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setPhase('submitted');
    onComplete({
      storyId: mat.id,
      hasRecording: !!recordedBlob,
      recordingDuration: duration,
      recordingBlob: recordedBlob || undefined,
      transcript: transcript || undefined,
      assessment,
    });
  }, [recordedBlob, onComplete, mat.id, transcript]);

  // 提交：有录音则进入评分报告页，由报告页确认按钮最终提交
  const handleSubmit = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (recordedBlob) {
      setPhase('report');
    } else {
      doComplete();
    }
  }, [recordedBlob, doComplete]);

  // 转写完成后自动预评一次（在报告页且该文本尚未预评过时），预填各维度得分与关键词勾选。
  // 用户手动调整发生在预评之后，lastAutoScoredRef 保证同一文本不会被重复预评覆盖。
  useEffect(() => {
    if (phase !== 'report' || !transcript) return;
    if (lastAutoScoredRef.current === transcript) return;
    lastAutoScoredRef.current = transcript;
    const auto = scoreStoryRetelling({
      transcript,
      durationSec: recordingDurationSecRef.current,
      keywords: mat.keywords,
      storyTranscript: mat.transcript ?? null,
      // Whisper 不产出识别置信度，发音维度改由讯飞 ISE 评测并行预填（见 startIseEvaluation）
      confidence: null,
    });
    setAutoReasons(auto.reasons);
    // 只预填能自动估算的维度，空缺维度保持未评分等手动打分
    setDimScores((s) => ({ ...s, ...auto.scores }));
    localAutoScoresRef.current = auto.scores;
    if (auto.keywordCovered.length > 0) {
      setKeywordChecks(auto.keywordCovered);
    }
    // LLM 语义评分：同义改写同等给分，覆盖 content/keywords/grammar 三维并生成针对性反馈，
    // 同时返回 ASR 校正文本作为转写卡片的最终显示。仅覆盖用户尚未手动改过的维度
    // （当前值仍等于本地预评值或空缺）；失败静默回退本地预评。无英文原文的故事不调用。
    if (mat.transcript) {
      void scoreShortAnswerWithLLM({
        question: RETELL_INSTRUCTION,
        referenceAnswer: mat.transcript,
        keywords: mat.keywords.map((k) => k.english),
        transcript,
      }).then((r: LlmScoreResult) => {
        if (lastAutoScoredRef.current !== transcript) return; // 已重新录音/重新预评，丢弃过期结果
        // 用户未手改才用 LLM 分覆盖：当前分与本地预评分一致或维度仍空缺
        // （在 setState updater 内读取最新分数，避免闭包里的过期值覆盖教员手改）
        setDimScores((s) => {
          const pick = (dim: DimKey, llmScore: number | null): number | undefined => {
            if (llmScore === null) return undefined;
            const local = localAutoScoresRef.current[dim];
            const now = s[dim];
            return now === local || now === undefined ? llmScore : undefined;
          };
          const contentScore = pick('content', clampLlmScore(r.content?.score));
          const keywordsScore = pick('keywords', clampLlmScore(r.keywords?.score));
          const grammarScore = pick('grammar', clampLlmScore(r.grammar?.score));
          if (contentScore === undefined && keywordsScore === undefined && grammarScore === undefined) return s;
          return {
            ...s,
            ...(contentScore !== undefined ? { content: contentScore } : {}),
            ...(keywordsScore !== undefined ? { keywords: keywordsScore } : {}),
            ...(grammarScore !== undefined ? { grammar: grammarScore } : {}),
          };
        });
        // LLM 判定 covered 的关键点（大小写不敏感的包含匹配）映射回 keywordChecks，
        // 未命中的保持当前勾选（故事复述允许手动勾选自查，不强行清掉用户已勾）
        if (r.keywords?.covered || r.keywords?.missed) {
          const coveredLower = (r.keywords?.covered ?? []).map((k) => k.toLowerCase());
          const missedLower = (r.keywords?.missed ?? []).map((k) => k.toLowerCase());
          setKeywordChecks((checks) =>
            mat.keywords.map((k, i) => {
              const kl = k.english.toLowerCase();
              if (coveredLower.some((c) => kl.includes(c) || c.includes(kl))) return true;
              if (missedLower.some((m) => kl.includes(m) || m.includes(kl))) return false;
              return checks[i] ?? false;
            })
          );
        }
        const grammarIssues = (r.grammar?.issues ?? []).filter(Boolean);
        setAutoReasons((s) => ({
          ...s,
          ...(r.content?.reason ? { content: r.content.reason } : {}),
          ...(r.keywords?.reason ? { keywords: r.keywords.reason } : {}),
          ...(r.grammar?.reason || grammarIssues.length > 0
            ? { grammar: [r.grammar?.reason, ...grammarIssues].filter(Boolean).join('；') }
            : {}),
        }));
        setLlmFeedback({
          strengths: (r.strengths ?? []).filter(Boolean),
          weaknesses: (r.weaknesses ?? []).filter(Boolean),
          suggestions: (r.suggestions ?? []).filter(Boolean),
        });
        setCorrectedTranscript(
          r.correctedTranscript && r.correctedTranscript.trim() !== transcript.trim()
            ? r.correctedTranscript.trim()
            : null,
        );
      }).catch((err: unknown) => {
        console.warn('[llm-score] LLM 评分不可用，保持本地预评:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, transcript]);

  // 关键词勾选：联动"关键词覆盖"维度的自动评分（可再手动调整）
  const toggleKeyword = useCallback((i: number) => {
    const next = [...keywordChecks];
    next[i] = !next[i];
    setKeywordChecks(next);
    if (next.length > 0) {
      const covered = next.filter(Boolean).length;
      setDimScores((s) => ({ ...s, keywords: Math.max(1, Math.round((covered / next.length) * 5)) }));
    }
  }, [keywordChecks]);

  // 报告页确认提交
  const handleConfirmReport = useCallback(() => {
    const dimensions = Object.fromEntries(
      DIMENSIONS.map((d) => [d.key, dimScores[d.key] ?? 0])
    ) as StoryAssessment['dimensions'];
    const totalScore = Object.values(dimensions).reduce((sum, v) => sum + v, 0);
    doComplete({ keywordCovered: keywordChecks, dimensions, totalScore });
  }, [dimScores, keywordChecks, doComplete]);

  const pct = audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0;

  // ==================== 渲染 ====================

  if (phase === 'outline') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-8">
            <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">第二部分：故事复述</h1>
            <p className="text-slate-500 mt-2">Story Retelling</p>
            <p className="text-purple-400 text-sm mt-1 font-medium">{mat.title}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 mb-6 text-left">
            <h3 className="font-semibold text-purple-800 mb-3">考试说明</h3>
            <ul className="text-purple-700 text-sm space-y-2">
              <li>• 你将听到一段故事录音，共播放两遍（间隔10秒）</li>
              <li>• 播放时可点击进度条跳转位置</li>
              <li>• 听完后有5分钟时间思考和复述</li>
              <li>• 准备好后点击"开始录音"进行复述</li>
            </ul>
          </div>
          <button onClick={() => setPhase('playing1')}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg">
            开始听故事
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'playing1' || phase === 'playing2') {
    const isFirst = phase === 'playing1';
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
              {audioPaused ? (
                <svg className="w-10 h-10 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              ) : (
                <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-800">正在播放第{isFirst ? '一' : '二'}遍</h2>
            <p className="text-slate-500 mt-2">{isFirst ? '请认真听，抓住故事大意和主要情节' : '请补充细节信息'}</p>
            <p className="text-blue-400 text-sm mt-1 font-medium">{mat.title}</p>
          </div>
          <div className="flex justify-center mb-4">
            <button onClick={toggleAudioPause}
              className="w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-all shadow-lg">
              {audioPaused ? (
                <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              ) : (
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              )}
            </button>
          </div>
          <div className="mb-2">
            <div ref={progressBarRef} onClick={seekAudio}
              className="w-full h-3 bg-slate-200 rounded-full cursor-pointer relative overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-sm text-slate-500">
              <span>{fmtTime(audioCurrentTime)}</span>
              <span>{fmtTime(audioDuration)}</span>
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-2">点击进度条可跳转位置</p>
        </div>
      </div>
    );
  }

  if (phase === 'interval') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">间隔休息</h2>
            <p className="text-slate-500 mt-2">第二遍录音即将开始，请整理笔记</p>
          </div>
          <p className="text-amber-600 font-medium">10 秒后自动播放...</p>
        </div>
      </div>
    );
  }

  if (phase === 'retelling') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">故事复述</h2>
          <p className="text-slate-500 mb-1">请在5分钟内组织语言并点击"开始录音"进行复述</p>
          <p className="text-purple-400 text-sm mb-6 font-medium">{mat.title}</p>
          <div className="mb-8">
            <div className={`inline-flex items-center justify-center w-36 h-36 rounded-full border-4 font-bold text-5xl font-mono transition-all duration-300 ${
              countdown <= 30 ? 'border-red-500 bg-red-500/10 text-red-500 animate-pulse' :
              countdown <= 60 ? 'border-amber-500 bg-amber-500/10 text-amber-600' :
              'border-emerald-500 bg-emerald-500/10 text-emerald-600'
            }`}>
              {fmtTime(countdown)}
            </div>
          </div>
          <button onClick={handleStartRecording}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all shadow-lg mb-4">
            开始录音
          </button>
          <p className="text-slate-400 text-sm">准备好后点击上方按钮开始复述</p>
        </div>
      </div>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">正在录音</h2>
          <p className="text-slate-500 mb-1">请用自己的语言复述所听到的故事</p>
          <p className="text-red-400 text-sm mb-6 font-medium">{mat.title}</p>
          <div className="mb-6">
            <div className={`inline-flex items-center justify-center w-36 h-36 rounded-full border-4 font-bold text-5xl font-mono transition-all duration-300 ${
              countdown <= 30 ? 'border-red-500 bg-red-500/10 text-red-500 animate-pulse' :
              countdown <= 60 ? 'border-amber-500 bg-amber-500/10 text-amber-600' :
              'border-emerald-500 bg-emerald-500/10 text-emerald-600'
            }`}>
              {fmtTime(countdown)}
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
              <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
                <div className="w-5 h-5 rounded-sm bg-white" />
              </div>
            </div>
          </div>
          <p className="text-red-500 font-medium mb-6">● 正在录音...</p>
          <button onClick={handleStopRecording}
            className="w-full py-4 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-xl font-semibold hover:from-slate-600 hover:to-slate-700 transition-all shadow-lg">
            结束录音
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">{recordedBlob ? '复述完成' : '时间到'}</h2>
            <p className="text-slate-500">{recordedBlob ? '回放检查后可提交' : '未检测到录音，请确认是否提交'}</p>
          </div>
          {recordedBlob && (
            <div className="bg-slate-50 rounded-xl p-6 mb-6">
              {!blobUrlRef.current && (blobUrlRef.current = URL.createObjectURL(recordedBlob))}
              <audio controls src={blobUrlRef.current} className="w-full" />
            </div>
          )}
          <div className="flex gap-4">
            {recordedBlob && (
              <button onClick={() => {
                if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
                setRecordedBlob(null);
                // 清空转写与自动评分痕迹，并使进行中的转写任务失效
                transcribeRunRef.current += 1;
                lastAutoScoredRef.current = '';
                transcriptRef.current = '';
                setTranscript('');
                setTranscribeStage('idle');
                setTranscribeError(null);
                setModelProgress(null);
                setCorrectedTranscript(null);
                setLlmFeedback(null);
                localAutoScoresRef.current = {};
                // 清空 ISE 评测痕迹，并使进行中的评测任务失效
                iseRunRef.current += 1;
                setIseStage('idle');
                setIseScores(null);
                setIseError(null);
                setAutoReasons({});
                setDimScores({});
                setKeywordChecks(mat.keywords.map(() => false));
                isRecordingRef.current = false;
                if (countdown > 0) setPhase('retelling');
              }} className="flex-1 py-3 border-2 border-purple-500 text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition-all">
                重新复述
              </button>
            )}
            <button onClick={handleSubmit}
              className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg">
              提交完成
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 评分报告页 ---
  if (phase === 'report') {
    const hasContent = !!(mat.transcript || mat.outline || mat.keywords.length > 0);
    const totalScore = DIMENSIONS.reduce((sum, d) => sum + (dimScores[d.key] ?? 0), 0);
    const allRated = DIMENSIONS.every((d) => (dimScores[d.key] ?? 0) > 0);
    const strongDims = DIMENSIONS.filter((d) => (dimScores[d.key] ?? 0) >= 4);
    const weakDims = DIMENSIONS.filter((d) => {
      const s = dimScores[d.key] ?? 0;
      return s > 0 && s <= 2;
    });
    // 得分 ≤3 的维度给出改进建议
    const adviseDims = DIMENSIONS.filter((d) => {
      const s = dimScores[d.key] ?? 0;
      return s > 0 && s <= 3;
    });
    const coveredCount = keywordChecks.filter(Boolean).length;
    const uncoveredKw = mat.keywords.filter((_, i) => !keywordChecks[i]);
    const cardOpen = (name: string) => !!expandedCards[name];
    // 卡片标题行（右侧箭头控制展开/折叠）
    const cardHeader = (name: string, title: ReactNode, titleClass: string) => (
      <button type="button" onClick={() => toggleCard(name)} className="w-full flex items-center justify-between gap-2">
        <h3 className={`font-semibold text-sm ${titleClass}`}>{title}</h3>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${cardOpen(name) ? 'rotate-180' : ''} ${titleClass}`} />
      </button>
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full bg-white/95 rounded-2xl shadow-xl p-8 my-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">故事复述 · 评分报告</h2>
            <p className="text-slate-500 mt-1">{mat.title}（自评或教员打分）</p>
            {/* 收藏本故事（文本与评分元数据，录音不持久化） */}
            <div className="mt-2">
              <FavoriteButton
                entry={{
                  key: `p2:${mat.id}`,
                  part: 2,
                  title: mat.title,
                  text: mat.outline,
                  detail: mat.transcript,
                  score: allRated ? totalScore : undefined,
                }}
              />
            </div>
          </div>

          {/* 录音回放 */}
          {recordedBlob && (
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-600 text-sm font-medium">回放你的复述录音：</p>
                <PlaybackRateButton />
              </div>
              {!blobUrlRef.current && (blobUrlRef.current = URL.createObjectURL(recordedBlob))}
              <RateAudio src={blobUrlRef.current} className="w-full" />
            </div>
          )}

          {/* 转写文本（语音识别，仅供参考）：有 LLM 校正时只显示校正后内容 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            {cardHeader('transcript', '转写文本（语音识别，仅供参考）', 'text-slate-700')}
            {cardOpen('transcript') && (
              <div className="mt-2">
                {transcribeStage === 'loading' ? (
                  <p className="text-slate-500 text-sm">
                    首次使用正在加载语音识别模型（应用自带，无需联网），请稍候…
                    {modelProgress !== null && <span className="text-purple-500 ml-1">{modelProgress}%</span>}
                  </p>
                ) : transcribeStage === 'transcribing' ? (
                  <p className="text-slate-500 text-sm">正在将录音转写为文字…</p>
                ) : transcribeStage === 'error' ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-400 text-sm">
                      语音转写失败{transcribeError ? `（${transcribeError}）` : ''}，请根据回放手动评分。
                    </p>
                    {recordedBlob && (
                      <button
                        onClick={() => startTranscription(recordedBlob)}
                        className="shrink-0 px-3 py-1.5 text-sm border border-purple-400 text-purple-600 rounded-lg hover:bg-purple-50 transition-all"
                      >
                        重试
                      </button>
                    )}
                  </div>
                ) : (correctedTranscript || transcript) ? (
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{correctedTranscript || transcript}</p>
                ) : (
                  <p className="text-slate-400 text-sm">未识别到有效语音内容，请根据回放手动评分。</p>
                )}
              </div>
            )}
          </div>

          {/* 参考内容 */}
          {hasContent ? (
            <div className="mb-6 space-y-4">
              {mat.outline && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                  {cardHeader('outline', '故事梗概', 'text-purple-800')}
                  {cardOpen('outline') && (
                    <p className="text-purple-700 text-sm leading-relaxed mt-2">{mat.outline}</p>
                  )}
                </div>
              )}
              {mat.transcript && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  {cardHeader('storyText', '故事英文原文（参考答案）', 'text-slate-700')}
                  {cardOpen('storyText') && (
                    <p className="text-slate-600 text-sm leading-relaxed mt-2">{mat.transcript}</p>
                  )}
                </div>
              )}
              {mat.keywords.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4">
                  {cardHeader('keywords', `关键词覆盖自查（已覆盖 ${coveredCount}/${mat.keywords.length}）`, 'text-slate-700')}
                  {cardOpen('keywords') && (
                    <div className="mt-2">
                      <p className="text-slate-400 text-xs mb-3">边听回放边勾选：你的复述中是否用到了这些关键词？</p>
                      <div className="space-y-2">
                        {mat.keywords.map((kw, i) => (
                          <label key={i} className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={keywordChecks[i] ?? false}
                              onChange={() => toggleKeyword(i)}
                              className="w-4 h-4 accent-purple-600"
                            />
                            <span className={`text-sm ${keywordChecks[i] ? 'text-slate-800' : 'text-slate-500'}`}>
                              <span className="font-medium">{kw.english}</span>
                              <span className="text-slate-400 ml-2">{kw.chinese}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
              该故事的参考原文与关键词尚未录入，以下维度请直接根据回放打分。
            </div>
          )}

          {/* 评分表 */}
          <div className="border border-slate-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-slate-700 text-sm mb-1">评分标准（每项 1-5 分，5 为最好）</h3>
            {/* 讯飞 ISE 发音评测状态（失败/未配置时温和提示，发音维度保持手动评分） */}
            {iseStage === 'evaluating' && (
              <p className="text-sky-500 text-xs mb-2">讯飞发音评测进行中，完成后将自动预填"发音"维度…</p>
            )}
            {iseStage === 'error' && (
              <p className="text-slate-400 text-xs mb-2">
                讯飞发音评测不可用{iseError ? `（${iseError}）` : ''}，"发音"维度请手动评分。
              </p>
            )}
            <div className="space-y-4 mt-3">
              {DIMENSIONS.map((dim) => (
                <div key={dim.key} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-slate-800 text-sm font-medium">{dim.label}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{dim.desc}</p>
                    {autoReasons[dim.key] && (
                      <p className="text-sky-600 text-xs mt-1">{autoReasons[dim.key]}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        onClick={() => setDimScores((s) => ({ ...s, [dim.key]: score }))}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                          (dimScores[dim.key] ?? 0) === score
                            ? 'bg-purple-600 text-white shadow'
                            : 'bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-700'
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

          {/* 评估报告（全部维度评完后显示） */}
          {allRated && (
            <div className="border border-purple-200 bg-purple-50/50 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-purple-900">评估报告</h3>
                <span className="text-lg font-bold text-purple-700">
                  {totalScore} / 25 分（{Math.round((totalScore / 25) * 100)}%）
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-emerald-700 mb-1">得分点 / 亮点：</p>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside">
                    {llmFeedback && llmFeedback.strengths.length > 0 ? (
                      llmFeedback.strengths.map((t, i) => <li key={i}>{t}</li>)
                    ) : strongDims.length > 0 ? (
                      strongDims.map((d) => <li key={d.key}>{d.label}表现良好（{dimScores[d.key]} 分）</li>)
                    ) : (
                      <li>各维度暂无突出表现</li>
                    )}
                    {mat.keywords.length > 0 && coveredCount > 0 && (
                      <li>关键词覆盖 {coveredCount}/{mat.keywords.length}：
                        {mat.keywords.filter((_, i) => keywordChecks[i]).map((k) => k.english).join('、')}
                      </li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-red-600 mb-1">扣分点 / 不足：</p>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside">
                    {llmFeedback ? (
                      llmFeedback.weaknesses.length > 0 ? (
                        llmFeedback.weaknesses.map((t, i) => <li key={i}>{t}</li>)
                      ) : (
                        <li>无明显薄弱维度</li>
                      )
                    ) : weakDims.length > 0 ? (
                      weakDims.map((d) => <li key={d.key}>{d.label}偏弱（{dimScores[d.key]} 分）</li>)
                    ) : (
                      <li>无明显薄弱维度</li>
                    )}
                    {uncoveredKw.length > 0 && (
                      <li>遗漏关键词：
                        {uncoveredKw.map((k) => `${k.english}（${k.chinese}）`).join('、')}
                      </li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-sky-700 mb-1">改进建议：</p>
                  <ul className="text-slate-600 space-y-1 list-disc list-inside">
                    {llmFeedback && llmFeedback.suggestions.length > 0 ? (
                      llmFeedback.suggestions.map((t, i) => <li key={i}>{t}</li>)
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

          <button
            onClick={handleConfirmReport}
            disabled={!allRated}
            className={`w-full py-4 rounded-xl font-semibold transition-all shadow-lg ${
              allRated
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {allRated ? '确认提交并进入下一部分' : '请先完成全部 5 个维度的评分'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'submitted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">第二部分完成</h2>
          <p className="text-slate-500">您的故事复述已提交</p>
        </div>
      </div>
    );
  }

  return null;
}
