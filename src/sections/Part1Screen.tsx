import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Ear, BookOpen, Volume2 } from 'lucide-react';
import type { Part1Result } from '@/types/exam';
import { generatePart1Exam } from '@/data/part1_bank';
import type { Part1Group } from '@/data/part1_bank';

// --- 动态题号音频（Question one ~ fifteen），按新卷序号播放 ---
// 题库问题音频开头带有原套卷的固定 "Question N" 前缀，与新卷序号无关，
// 因此题号统一改由这里的音频播报，原前缀在播放时跳过（见 findPrefixEnd）
const qnumModules = import.meta.glob<string>('@/assets/audio/part1_qnum/q*.mp3', {
  eager: true,
  import: 'default',
});
const questionNumAudio: Record<number, string> = {};
for (const [key, url] of Object.entries(qnumModules)) {
  const m = key.match(/q(\d+)\.mp3$/);
  if (m) questionNumAudio[Number(m[1])] = url;
}

/**
 * 检测问题音频开头 "Question N." 前缀的结束位置（秒）。
 * 题库音频由 TTS 生成，前缀之后必有明显停顿：在前 2.5 秒内找第一段
 * 持续 ≥150ms 的静音，切点取该静音开始处。找不到返回 0（从头播放）。
 */
function findPrefixEnd(buf: AudioBuffer): number {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const win = Math.max(1, Math.floor(sr * 0.005)); // 5ms 窗口
  const threshold = 0.01;
  const minSilenceSec = 0.15;
  const maxScan = Math.min(data.length, Math.floor(sr * 2.5));
  let seenSound = false;
  let silenceStart = -1;
  for (let i = 0; i < maxScan; i += win) {
    const end = Math.min(i + win, data.length);
    let peak = 0;
    for (let j = i; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > peak) peak = v;
    }
    if (peak > threshold) {
      seenSound = true;
      silenceStart = -1;
    } else if (seenSound) {
      if (silenceStart < 0) silenceStart = i;
      if ((i - silenceStart) / sr >= minSilenceSec) {
        return silenceStart / sr;
      }
    }
  }
  return 0;
}

interface Props {
  onComplete: (result: Part1Result) => void;
  singleMode?: boolean;
  directionsAudio?: HTMLAudioElement | null;
}

type Phase =
  | 'loading'
  | 'directions'
  | 'playingDialogue'
  | 'playingQuestion'
  | 'answering'
  | 'completed';

export default function Part1Screen({
  onComplete,
  singleMode = false,
  directionsAudio,
}: Props) {
  // --- 试卷数据 ---
  const [, setExamGroups] = useState<Part1Group[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');

  // --- 使用 ref 存储可变状态（避免闭包问题） ---
  const groupIdxRef = useRef(0);
  const questionIdxRef = useRef(0);
  const answersRef = useRef<Map<number, { userAnswer: string; correctAnswer: string; groupId: string }>>(new Map());
  const examGroupsRef = useRef<Part1Group[]>([]);
  // 超时自动跳转标志：防止倒计时结束的瞬间用户又点击选项导致重复跳题
  const advancingRef = useRef(false);
  // 已处理题目（新卷序号）集合：作答或超时未答都算"已答"，用于右上角计数
  const processedRef = useRef<Set<number>>(new Set());

  // --- UI 状态 ---
  const [currentQNo, setCurrentQNo] = useState(0);
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [currentDialogue, setCurrentDialogue] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [thinkCountdown, setThinkCountdown] = useState(5);
  const [directionsPlayed, setDirectionsPlayed] = useState(false);

  // --- 音频 ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, setIsAudioPlaying] = useState(false);
  const thinkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Web Audio（问题播报：动态题号 + 跳过旧题号前缀的问题正文） ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wsSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const wsGenRef = useRef(0); // 每次停止自增，使进行中的回调失效
  const decodeCacheRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());

  // 计算新卷序号（1-15）：前面各组的题数累计 + 组内位置
  const getExamQNo = useCallback((gIdx: number, qIdx: number) => {
    const groups = examGroupsRef.current;
    let n = 0;
    for (let i = 0; i < gIdx; i++) n += groups[i]?.questions.length ?? 0;
    return n + qIdx + 1;
  }, []);

  // 创建/唤醒 AudioContext（须在用户手势后调用，自动播放策略）
  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  // 解码音频（带缓存：题号音频会反复用到）
  const decodeAudio = useCallback((url: string): Promise<AudioBuffer> => {
    let p = decodeCacheRef.current.get(url);
    if (!p) {
      const ctx = ensureAudioCtx();
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((buf) => ctx.decodeAudioData(buf));
      decodeCacheRef.current.set(url, p);
    }
    return p;
  }, [ensureAudioCtx]);

  // 停止所有 Web Audio 播放
  const stopWebAudio = useCallback(() => {
    wsGenRef.current++;
    for (const s of wsSourcesRef.current) {
      s.onended = null;
      try { s.stop(); } catch { /* 已停止或未开始 */ }
    }
    wsSourcesRef.current = [];
  }, []);

  // 播放一个 AudioBuffer（从 offset 秒起）；gen 用于丢弃已过期的结束回调
  const startBufferSource = useCallback((
    buf: AudioBuffer,
    offset: number,
    gen: number,
    onDone: () => void,
  ) => {
    const ctx = ensureAudioCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    wsSourcesRef.current.push(src);
    src.onended = () => {
      wsSourcesRef.current = wsSourcesRef.current.filter((x) => x !== src);
      if (gen !== wsGenRef.current) return;
      onDone();
    };
    src.start(0, offset);
  }, [ensureAudioCtx]);

  // 加载试卷
  useEffect(() => {
    const groups = generatePart1Exam();
    examGroupsRef.current = groups;
    setExamGroups(groups);
    setPhase('directions');
    console.log('[Part1] 试卷加载完成，共', groups.length, '组');
  }, []);

  // 考试说明音频：监听 App 在 user gesture 内启动的说明音频，播完才启用开始按钮
  useEffect(() => {
    if (phase !== 'directions' || !directionsAudio) return;

    const handleEnded = () => setDirectionsPlayed(true);
    const handleError = () => setDirectionsPlayed(true);

    directionsAudio.addEventListener('ended', handleEnded);
    directionsAudio.addEventListener('error', handleError);

    return () => {
      directionsAudio.removeEventListener('ended', handleEnded);
      directionsAudio.removeEventListener('error', handleError);
    };
  }, [phase, directionsAudio]);

  // 无说明音频（如直接以单题模式调试进入）时视为已播完；音频在 user gesture
  // 内启动、本组件毫秒级后挂载，不存在挂载前已播完的情况
  const directionsReady = !directionsAudio || directionsPlayed;

  // 清理计时器
  const clearThinkTimer = useCallback(() => {
    if (thinkTimerRef.current) {
      clearInterval(thinkTimerRef.current);
      thinkTimerRef.current = null;
    }
  }, []);

  // 停止音频
  const stopAudio = useCallback(() => {
    stopWebAudio();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsAudioPlaying(false);
  }, [stopWebAudio]);

  // 播放音频
  const playAudio = useCallback((src: string, onEnded: () => void) => {
    stopAudio();
    if (!src) {
      console.warn('[Part1] 音频路径为空');
      onEnded();
      return;
    }
    const audio = new Audio(src);
    audioRef.current = audio;
    setIsAudioPlaying(true);

    const handleEnd = () => {
      // 结束后立即移除监听：stopAudio 清空 src 会在旧元素上再触发一次 error，
      // 不移除的话旧回调会把阶段误切回 answering，导致界面显示上一题
      audio.removeEventListener('ended', handleEnd);
      audio.removeEventListener('error', handleError);
      // 该音频已被新音频替换时，忽略其回调
      if (audioRef.current !== audio) return;
      setIsAudioPlaying(false);
      onEnded();
    };
    const handleError = () => {
      console.warn('[Part1] 音频播放失败:', src);
      handleEnd();
    };
    audio.addEventListener('ended', handleEnd);
    audio.addEventListener('error', handleError);
    audio.play().catch((err) => {
      console.warn('[Part1] 音频播放错误:', err);
      handleEnd();
    });
  }, [stopAudio]);

  // 播放问题：先播动态题号（新卷序号），再播跳过旧 "Question N" 前缀的问题正文。
  // 任何一步失败都回退为 <audio> 完整播放原始音频，保证考试不中断。
  const playQuestionAudio = useCallback((seqNo: number, questionUrl: string, onEnded: () => void) => {
    const prefixUrl = questionNumAudio[seqNo];
    if (!prefixUrl || !questionUrl) {
      playAudio(questionUrl, onEnded);
      return;
    }
    const gen = wsGenRef.current;
    (async () => {
      const ctx = ensureAudioCtx();
      await ctx.resume();
      if (ctx.state !== 'running') throw new Error(`AudioContext 状态异常: ${ctx.state}`);
      const [prefixBuf, questionBuf] = await Promise.all([
        decodeAudio(prefixUrl),
        decodeAudio(questionUrl),
      ]);
      if (gen !== wsGenRef.current) return; // 已被跳过/替换
      const offset = findPrefixEnd(questionBuf);
      if (offset <= 0) {
        console.warn('[Part1] 未检测到旧题号前缀，完整播放:', questionUrl);
      }
      startBufferSource(prefixBuf, 0, gen, () => {
        startBufferSource(questionBuf, offset, gen, onEnded);
      });
    })().catch((err) => {
      console.warn('[Part1] WebAudio 播放失败，回退为原始播放:', err);
      if (gen !== wsGenRef.current) return;
      playAudio(questionUrl, onEnded);
    });
  }, [playAudio, ensureAudioCtx, decodeAudio, startBufferSource]);

  // 更新当前UI显示
  const updateDisplay = useCallback(() => {
    const groups = examGroupsRef.current;
    const gIdx = groupIdxRef.current;
    const qIdx = questionIdxRef.current;
    const group = groups[gIdx];
    if (!group) return;
    const question = group.questions[qIdx];
    if (!question) return;

    // 显示新卷序号（1-15），而非题库内的原始题号
    setCurrentQNo(getExamQNo(gIdx, qIdx));
    setCurrentQuestionText(question.question);
    setCurrentOptions(question.options);
    setCurrentDialogue(group.dialogue);
    setSelectedOption(null);
    advancingRef.current = false;
  }, [getExamQNo]);

  // 播放问题
  const playQuestion = useCallback(() => {
    const groups = examGroupsRef.current;
    const gIdx = groupIdxRef.current;
    const qIdx = questionIdxRef.current;
    const group = groups[gIdx];
    if (!group) return;
    const question = group.questions[qIdx];
    if (!question) return;

    setPhase('playingQuestion');
    const seqNo = getExamQNo(gIdx, qIdx);
    console.log('[Part1] 播放问题 新卷Q', seqNo, '（题库Q', question.qNo, '）');

    playQuestionAudio(seqNo, question.questionAudio, () => {
      // 问题播完，进入答题
      setPhase('answering');
      setThinkCountdown(5);
    });
  }, [playQuestionAudio, getExamQNo]);

  // 播放对话
  const playDialogue = useCallback(() => {
    const groups = examGroupsRef.current;
    const gIdx = groupIdxRef.current;
    const group = groups[gIdx];
    if (!group) {
      setPhase('completed');
      return;
    }

    setPhase('playingDialogue');
    // 立即刷新为新一组的题号/内容（含清除选项选中态），
    // 避免对话播放期间界面停留在上一题
    updateDisplay();
    console.log('[Part1] 播放对话:', group.groupId);

    playAudio(group.dialogueAudio, () => {
      // 对话播完，播第一个问题
      questionIdxRef.current = 0;
      updateDisplay();
      playQuestion();
    });
  }, [playAudio, updateDisplay, playQuestion]);

  // 进入下一题/下一组
  const advanceToNext = useCallback(() => {
    const groups = examGroupsRef.current;
    const gIdx = groupIdxRef.current;
    const qIdx = questionIdxRef.current;
    const group = groups[gIdx];
    if (!group) return;

    // 检查当前group是否还有下一个问题
    if (qIdx < group.questions.length - 1) {
      // 同一group的下一个问题
      questionIdxRef.current = qIdx + 1;
      updateDisplay();
      playQuestion();
    } else {
      // 当前group的所有问题已答完，进入下一组
      if (gIdx < groups.length - 1) {
        groupIdxRef.current = gIdx + 1;
        questionIdxRef.current = 0;
        playDialogue();
      } else {
        // 所有题已完成
        setPhase('completed');
      }
    }
  }, [playDialogue, playQuestion, updateDisplay]);

  // 思考倒计时
  useEffect(() => {
    if (phase === 'answering' && thinkCountdown > 0) {
      clearThinkTimer();
      thinkTimerRef.current = setInterval(() => {
        setThinkCountdown((prev) => {
          if (prev <= 1) {
            clearThinkTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearThinkTimer();
  }, [phase, thinkCountdown, clearThinkTimer]);

  // 倒计时结束：无论是否作答都自动结束本题，进入下一题
  useEffect(() => {
    if (phase !== 'answering' || thinkCountdown !== 0) return;
    const groups = examGroupsRef.current;
    const gIdx = groupIdxRef.current;
    const qIdx = questionIdxRef.current;
    if (!groups[gIdx]?.questions[qIdx]) return;
    const seqNo = getExamQNo(gIdx, qIdx);
    // 已作答（答题后等待跳转的 500ms 内倒计时刚好走完）时不重复跳转
    if (answersRef.current.has(seqNo)) return;
    console.log('[Part1] 思考时间结束，未作答，自动进入下一题 新卷Q', seqNo);
    // 未作答也计入"已答"计数
    processedRef.current.add(seqNo);
    setAnsweredCount(processedRef.current.size);
    advancingRef.current = true;
    advanceToNext();
  }, [phase, thinkCountdown, advanceToNext, getExamQNo]);

  // 用户选择答案
  const handleSelectAnswer = useCallback((option: string) => {
    // 超时已触发自动跳转，忽略迟到/重复的点击
    if (advancingRef.current) return;
    const groups = examGroupsRef.current;
    const gIdx = groupIdxRef.current;
    const qIdx = questionIdxRef.current;
    const group = groups[gIdx];
    if (!group) return;
    const question = group.questions[qIdx];
    if (!question) return;

    setSelectedOption(option);

    // 记录答案（使用ref确保同步更新）
    // key 用新卷序号：q1_5 抽取的各组原始题号都在 1-5 之间，
    // 用原始题号会互相覆盖导致答案丢失
    const seqNo = getExamQNo(gIdx, qIdx);
    // 同一题在 500ms 跳转延迟内重复点击只计一次
    if (processedRef.current.has(seqNo)) return;
    const letter = option.charAt(0);
    answersRef.current.set(seqNo, {
      userAnswer: letter,
      correctAnswer: question.answer,
      groupId: group.groupId,
    });
    processedRef.current.add(seqNo);

    // 同步更新UI计数
    setAnsweredCount(processedRef.current.size);
    console.log('[Part1] 记录答案 新卷Q', seqNo, '=', letter, '已答', processedRef.current.size, '题');

    // 延迟后进入下一题
    setTimeout(() => {
      advanceToNext();
    }, 500);
  }, [advanceToNext, getExamQNo]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopAudio();
      clearThinkTimer();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, [stopAudio, clearThinkTimer]);

  // 计算总进度
  const totalQuestions = examGroupsRef.current.reduce((sum, g) => sum + g.questions.length, 0);
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // 完成提交
  const handleSubmit = useCallback(() => {
    // 按组卷顺序遍历全部 15 题（含超时未作答的题），附带题目原文供结果页解析展示
    const answerArray: Part1Result['answers'] = [];
    examGroupsRef.current.forEach((g, gIdx) => {
      g.questions.forEach((q, qIdx) => {
        const seqNo = getExamQNo(gIdx, qIdx);
        const rec = answersRef.current.get(seqNo);
        answerArray.push({
          qNo: seqNo,
          bankQNo: q.qNo,
          userAnswer: rec?.userAnswer ?? null,
          correctAnswer: q.answer,
          isCorrect: rec ? rec.userAnswer === q.answer : false,
          groupId: g.groupId,
          scenario: g.scenario,
          dialogueAudio: g.dialogueAudio,
          questionText: q.question,
          options: q.options,
          dialogue: g.dialogue,
          explanation: q.explanation,
        });
      });
    });

    const correctCount = answerArray.filter((a) => a.isCorrect).length;

    onComplete({
      answers: answerArray,
      correctCount,
      totalQuestions: 15,
      score: Math.round((correctCount / 15) * 100),
    });
  }, [onComplete, getExamQNo]);

  // ============ 渲染 ============

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-400 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600">正在加载题库...</p>
        </div>
      </div>
    );
  }

  // --- 考试说明界面 ---
  if (phase === 'directions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Ear className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">第一部分：听力理解</h1>
                <p className="text-slate-500">Listening Comprehension (15 questions)</p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 mb-6">
              <h3 className="font-semibold text-blue-800 mb-3">考试说明</h3>
              <p className="text-blue-700 text-sm leading-relaxed mb-3">
                In this part, you are going to hear a dialogue or exchange, after the exchange, there will be a question.
                After each question, you have 5 seconds to think and choose the correct answer.
                You will hear each question only once.
              </p>
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <BookOpen className="w-4 h-4" />
                <span>每道题播放后，你有5秒时间选择答案</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              {!directionsReady && (
                <div className="flex items-center gap-2 text-blue-600 text-sm animate-pulse">
                  <Volume2 className="w-4 h-4" />
                  <span>正在播放考试说明，请稍候...</span>
                </div>
              )}
              <button
                onClick={() => {
                  // 在用户手势内创建 AudioContext，避免后续 Web Audio 被自动播放策略挂起
                  ensureAudioCtx().resume().catch(() => {});
                  groupIdxRef.current = 0;
                  questionIdxRef.current = 0;
                  answersRef.current = new Map();
                  processedRef.current = new Set();
                  setAnsweredCount(0);
                  updateDisplay();
                  playDialogue();
                }}
                disabled={!directionsReady}
                className={`px-8 py-3 rounded-xl font-semibold shadow-lg transition-all ${
                  directionsReady
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-xl hover:scale-105 active:scale-95'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                {directionsReady ? '开始听力考试' : '请听完考试说明'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 完成界面 ---
  if (phase === 'completed') {
    const correctCount = Array.from(answersRef.current.values()).filter(
      (a) => a.userAnswer === a.correctAnswer
    ).length;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="p-4 bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Ear className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">听力理解完成</h2>
          <p className="text-slate-500 mb-4">
            答对 {correctCount} / 15 题（已答 {answeredCount} 题）
          </p>
          <div className="w-full bg-slate-100 rounded-full h-3 mb-6">
            <div
              className="bg-gradient-to-r from-blue-400 to-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(correctCount / 15) * 100}%` }}
            />
          </div>
          <button
            onClick={handleSubmit}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            {singleMode ? '提交并查看结果' : '提交并进入下一部分'}
          </button>
        </div>
      </div>
    );
  }

  // --- 播放和答题界面 ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-500">
              问题 {currentQNo}/15
            </span>
            <span className="text-sm text-slate-500">
              已答 {answeredCount}/{totalQuestions}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* 状态显示 */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {phase === 'playingDialogue' && (
              <>
                <div className="animate-pulse p-3 bg-blue-100 rounded-full">
                  <Ear className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-blue-600 font-medium">正在播放对话...</span>
              </>
            )}
            {phase === 'playingQuestion' && (
              <>
                <div className="animate-pulse p-3 bg-blue-100 rounded-full">
                  <Mic className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-blue-600 font-medium">正在播放问题...</span>
              </>
            )}
            {phase === 'answering' && (
              <>
                <div className="p-3 bg-green-100 rounded-full">
                  <BookOpen className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-green-600 font-medium">
                  {thinkCountdown > 0 ? `思考时间: ${thinkCountdown}秒` : '请选择答案'}
                </span>
              </>
            )}
          </div>

          {/* 对话文字（仅答题阶段显示） */}
          {phase === 'answering' && currentDialogue && (
            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-sm text-slate-700 leading-relaxed font-mono whitespace-pre-wrap border border-slate-200">
              {currentDialogue}
            </div>
          )}

          {/* 问题 */}
          {currentQuestionText && (phase === 'answering' || phase === 'playingQuestion') && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {currentQNo}. {currentQuestionText}
              </h3>

              {/* 选项 */}
              {phase === 'answering' && (
                <div className="space-y-3">
                  {currentOptions.map((option) => {
                    const letter = option.charAt(0);
                    const isSelected = selectedOption === option;
                    return (
                      <button
                        key={letter}
                        onClick={() => handleSelectAnswer(option)}
                        disabled={selectedOption !== null}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 跳过按钮 */}
          <div className="flex justify-center mt-6">
            <button
              onClick={() => {
                stopAudio();
                if (phase === 'playingDialogue') {
                  questionIdxRef.current = 0;
                  updateDisplay();
                  playQuestion();
                } else if (phase === 'playingQuestion') {
                  setPhase('answering');
                  setThinkCountdown(5);
                }
              }}
              className="px-4 py-2 text-slate-400 hover:text-slate-600 text-sm transition-colors"
            >
              跳过音频
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
