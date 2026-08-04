import { useState, useRef, useEffect, useCallback } from 'react';
import { questionsPart3, ANSWER_TIME_PART3, dialogueAudio } from '@/data/questionsPart3';
import type { ExamResult } from '@/types/exam';
import { Volume2, Headphones, Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Part3ScreenProps {
  onSubmit: (result: ExamResult) => void;
}

type Phase =
  | 'idle'
  | 'playing_dialogue_q9'
  | 'countdown_q9'
  | 'playing_q10'
  | 'countdown_q10'
  | 'playing_q11'
  | 'countdown_q11'
  | 'playing_q12'
  | 'countdown_q12'
  | 'submitting';

// 音频时长（秒）= 实际时长 + 0.1s 最小缓冲
const AUDIO_DURATIONS: Record<string, number> = {
  [dialogueAudio]: 91.1,       // intro 4.0s + dialogue_912 80.0s + 0.5s + q9 6.5s + 0.1s
  [questionsPart3[1].audio]: 7.1,    // q10 实际 7.0s + 0.1s
  [questionsPart3[2].audio]: 4.1,   // q11 实际 4.0s + 0.1s
  [questionsPart3[3].audio]: 6.1,   // q12 实际 6.0s + 0.1s
};

interface AudioHandlers {
  canplay: () => void;
  play: () => void;
  error: () => void;
}

export default function Part3Screen({ onSubmit }: Part3ScreenProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handlersRef = useRef<AudioHandlers | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadedRef = useRef<Record<string, HTMLAudioElement>>({});

  const [phase, setPhase] = useState<Phase>('idle');
  const [qIndex, setQIndex] = useState(0); // 0=第9题, 1=第14题, 2=第15题
  const [count, setCount] = useState(ANSWER_TIME_PART3);
  const [audioStatus, setAudioStatus] = useState<'loading' | 'ready' | 'playing' | 'done' | 'error'>('loading');
  const [selected, setSelected] = useState<string | null>(null);

  const allAnswersRef = useRef<Record<number, string | null>>({});
  const selectedRef = useRef<string | null>(null);
  const countInitRef = useRef(false);

  const currentQ = questionsPart3[qIndex];

  // ===== 预加载 =====
  const preloadAudio = useCallback((src: string) => {
    if (preloadedRef.current[src]) return;
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.load();
    preloadedRef.current[src] = audio;
  }, []);

  // ===== 清理 =====
  const cleanup = useCallback(() => {
    if (audioRef.current && handlersRef.current) {
      const a = audioRef.current;
      const h = handlersRef.current;
      a.removeEventListener('canplaythrough', h.canplay);
      a.removeEventListener('play', h.play);
      a.removeEventListener('error', h.error);
      handlersRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // ===== 播放音频 =====
  const startPlayback = useCallback((src: string, duration: number, onComplete: () => void) => {
    cleanup();
    setAudioStatus('loading');

    let audio = preloadedRef.current[src];
    let isPreloaded = false;
    if (audio) {
      isPreloaded = true;
      delete preloadedRef.current[src];
      audio.pause();
      audio.currentTime = 0;
    } else {
      audio = new Audio(src);
      audio.preload = 'auto';
    }
    audioRef.current = audio;

    // ended事件为主：音频自然结束才进入下一阶段
    const handleEnded = () => {
      clearTimeout(timerRef.current!);
      setAudioStatus('done');
      onComplete();
    };
    audio.addEventListener('ended', handleEnded, { once: true });

    // setTimeout作为fallback（额外2s缓冲，防止ended不触发）
    timerRef.current = setTimeout(() => {
      audio.removeEventListener('ended', handleEnded);
      setAudioStatus('done');
      onComplete();
    }, duration * 1000 + 2000);

    const handlers: AudioHandlers = {
      canplay: () => {
        setAudioStatus('ready');
        audio.play().catch(() => {});
      },
      play: () => {
        setAudioStatus('playing');
      },
      error: () => {
        console.error('[AETS] 音频错误:', src);
        setAudioStatus('error');
        audio.removeEventListener('ended', handleEnded);
        clearTimeout(timerRef.current!);
      },
    };
    handlersRef.current = handlers;

    audio.addEventListener('canplaythrough', handlers.canplay, { once: true });
    audio.addEventListener('play', handlers.play, { once: true });
    audio.addEventListener('error', handlers.error, { once: true });

    if (isPreloaded && audio.readyState >= 4) {
      setAudioStatus('ready');
      audio.play().catch(() => {});
    } else {
      audio.load();
    }
  }, [cleanup]);

  // ===== 阶段控制 =====
  useEffect(() => {
    if (phase !== 'idle') return;
    setPhase('playing_dialogue_q9');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing_dialogue_q9') return;
    startPlayback(dialogueAudio, AUDIO_DURATIONS[dialogueAudio], () => {
      setPhase('countdown_q9');
    });
    // 预加载 q10 和 q11
    preloadAudio(questionsPart3[1].audio);
    preloadAudio(questionsPart3[2].audio);
    return () => cleanup();
  }, [phase, startPlayback, cleanup, preloadAudio]);

  useEffect(() => {
    const playPhases: Phase[] = ['playing_q10', 'playing_q11', 'playing_q12'];
    if (!playPhases.includes(phase)) return;

    const idx =
      phase === 'playing_q10' ? 1 :
      phase === 'playing_q11' ? 2 : 3;
    const q = questionsPart3[idx];
    const duration = AUDIO_DURATIONS[q.audio];
    const countdownPhase: Phase =
      phase === 'playing_q10' ? 'countdown_q10' :
      phase === 'playing_q11' ? 'countdown_q11' : 'countdown_q12';

    startPlayback(q.audio, duration, () => {
      setPhase(countdownPhase);
    });

    return () => cleanup();
  }, [phase, startPlayback, cleanup]);

  // ===== 倒计时 =====
  useEffect(() => {
    const countdownPhases: Phase[] = ['countdown_q9', 'countdown_q10', 'countdown_q11', 'countdown_q12'];
    if (!countdownPhases.includes(phase)) return;

    setCount(ANSWER_TIME_PART3);
    countInitRef.current = true;
    setTimeout(() => { countInitRef.current = false; }, 0);

    countdownRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [phase]);

  // ===== 倒计时归零 =====
  useEffect(() => {
    const countdownPhases: Phase[] = ['countdown_q9', 'countdown_q10', 'countdown_q11', 'countdown_q12'];
    if (!countdownPhases.includes(phase)) return;
    if (count > 0) return;

    if (countInitRef.current) {
      countInitRef.current = false;
      return;
    }

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    allAnswersRef.current[currentQ.id] = selectedRef.current;

    if (phase === 'countdown_q9') {
      setQIndex(1);
      setSelected(null);
      selectedRef.current = null;
      setPhase('playing_q10');
    } else if (phase === 'countdown_q10') {
      setQIndex(2);
      setSelected(null);
      selectedRef.current = null;
      setPhase('playing_q11');
    } else if (phase === 'countdown_q11') {
      setQIndex(3);
      setSelected(null);
      selectedRef.current = null;
      setPhase('playing_q12');
    } else {
      setPhase('submitting');
    }
  }, [count, phase, currentQ.id]);

  // ===== 提交 =====
  useEffect(() => {
    if (phase !== 'submitting') return;
    cleanup();

    allAnswersRef.current[currentQ.id] = selectedRef.current;

    const resultAnswers = questionsPart3.map((qq) => {
      const sel = allAnswersRef.current[qq.id] || null;
      return {
        questionId: qq.id,
        selectedOption: sel,
        correctOption: qq.correctAnswer,
        isCorrect: sel === qq.correctAnswer,
      };
    });

    const correctCount = resultAnswers.filter((a) => a.isCorrect).length;

    onSubmit({
      totalQuestions: questionsPart3.length,
      correctCount,
      score: Math.round((correctCount / questionsPart3.length) * 100),
      answers: resultAnswers,
    });
  }, [phase, onSubmit, cleanup, currentQ.id]);

  // ===== 手动播放 =====
  const handleManualPlay = () => {
    audioRef.current?.play().catch(() => setAudioStatus('error'));
  };

  // ===== 选择选项 =====
  const handleSelect = (label: string) => {
    setSelected(label);
    selectedRef.current = label;
  };

  // ===== UI =====
  const isDialoguePhase = phase === 'playing_dialogue_q9';
  const isQuestionPhase = phase !== 'idle' && phase !== 'submitting';
  const isCountdownPhase = phase.startsWith('countdown_');

  const countdownDisplay = isCountdownPhase ? count : '--';

  const countdownStyle = () => {
    if (!isCountdownPhase) return 'border-slate-600 bg-slate-800/30 text-slate-500';
    if (count <= 3) return 'border-red-500 bg-red-500/10 text-red-400 animate-pulse';
    if (count <= 5) return 'border-amber-500 bg-amber-500/10 text-amber-400';
    return 'border-sky-500 bg-sky-500/10 text-sky-400';
  };

  const statusText = () => {
    if (isDialoguePhase) {
      switch (audioStatus) {
        case 'loading': return { icon: <Headphones className="w-4 h-4 animate-pulse" />, text: '加载共用对话...', sub: '请稍候' };
        case 'ready': return { icon: <AlertCircle className="w-4 h-4" />, text: '点击播放对话', sub: '浏览器阻止了自动播放' };
        case 'playing': return { icon: <Volume2 className="w-4 h-4 animate-pulse" />, text: '正在播放共用对话...', sub: '第9题选项已显示，可先浏览' };
        case 'done': return { icon: <Headphones className="w-4 h-4" />, text: '对话结束', sub: '开始作答第13题' };
        case 'error': return { icon: <AlertCircle className="w-4 h-4" />, text: '音频加载失败', sub: '' };
      }
    }
    if (phase === 'playing_q10' || phase === 'playing_q11') {
      switch (audioStatus) {
        case 'loading': return { icon: <Headphones className="w-4 h-4 animate-pulse" />, text: `加载第${currentQ.id}题...`, sub: '' };
        case 'ready': return { icon: <AlertCircle className="w-4 h-4" />, text: '点击播放问题', sub: '' };
        case 'playing': return { icon: <Volume2 className="w-4 h-4 animate-pulse" />, text: `正在播放第${currentQ.id}题...`, sub: '倒计时将在音频结束后开始' };
        case 'done': return { icon: <Headphones className="w-4 h-4" />, text: '问题结束', sub: '开始作答' };
        case 'error': return { icon: <AlertCircle className="w-4 h-4" />, text: '音频加载失败', sub: '' };
      }
    }
    if (isCountdownPhase) {
      return { icon: <Headphones className="w-4 h-4" />, text: `第${currentQ.id}题作答中`, sub: count <= 3 ? '时间紧迫！' : `${count} 秒后下一题` };
    }
    return { icon: <Headphones className="w-4 h-4" />, text: '', sub: '' };
  };

  const st = statusText();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      {phase !== 'submitting' && (
        <div className="max-w-lg w-full space-y-6">
          {isDialoguePhase && audioStatus === 'playing' && (
            <div className="text-center space-y-1">
              <span className="text-sky-400 text-sm font-medium">共用对话（第9-12题）</span>
              <span className="text-amber-400 text-sm ml-2">第9题选项已显示，可先浏览</span>
            </div>
          )}

          {isQuestionPhase && (
            <div className="text-center">
              <span className="text-slate-400 text-sm">第 {currentQ.id} / 15 题</span>
              {selected && <span className="text-emerald-400 text-sm ml-3">已选: {selected}</span>}
            </div>
          )}

          {isQuestionPhase && (
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${(currentQ.id / 15) * 100}%` }} />
            </div>
          )}

          <div className="text-center py-4 space-y-4">
            <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full border-4 font-bold text-6xl font-mono transition-all duration-300 ${countdownStyle()}`}>
              {countdownDisplay}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm">
              <span className={isCountdownPhase ? 'text-emerald-400' : audioStatus === 'playing' ? 'text-sky-400' : 'text-slate-500'}>
                {st.icon}
              </span>
              <span className={isCountdownPhase ? 'text-emerald-400' : audioStatus === 'playing' ? 'text-sky-400' : 'text-slate-500'}>
                {st.text}
              </span>
            </div>

            {audioStatus === 'ready' && (
              <Button onClick={handleManualPlay} size="lg"
                className="bg-sky-500 hover:bg-sky-600 text-white px-8 py-5 text-base font-semibold rounded-xl shadow-lg shadow-sky-500/25 transition-all hover:scale-105">
                <Play className="w-5 h-5 mr-2" />
                {isDialoguePhase ? '播放对话' : `播放第${currentQ.id}题`}
              </Button>
            )}

            {audioStatus === 'error' && (
              <Button onClick={() => window.location.reload()} variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/10">
                重新加载
              </Button>
            )}

            <p className="text-slate-600 text-xs">{st.sub}</p>
          </div>

          {isQuestionPhase && (
            <div className="space-y-3">
              {currentQ.options.map((opt) => {
                const sel = selected === opt.label;
                return (
                  <button key={opt.label} onClick={() => handleSelect(opt.label)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      sel ? 'border-sky-500 bg-sky-500/20 shadow-lg shadow-sky-500/10 scale-[1.02]' : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-700/50'
                    }`}>
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mr-3 transition-all ${sel ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {opt.label}
                    </span>
                    <span className={`text-base ${sel ? 'text-white font-medium' : 'text-slate-300'}`}>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {phase === 'submitting' && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white text-lg font-medium">正在提交...</p>
        </div>
      )}
    </div>
  );
}
