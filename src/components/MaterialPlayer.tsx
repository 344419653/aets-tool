import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  title: string;
  audioSrc: string;
  onEnded: () => void;
}

export default function MaterialPlayer({ title, audioSrc, onEnded }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const audio = new Audio(audioSrc);
    audioRef.current = audio;
    audio.playbackRate = playbackRate;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      onEnded();
    });

    audio.addEventListener('error', () => {
      setIsPlaying(false);
      onEnded();
    });

    // 自动播放
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      // 自动播放被阻止，等待用户点击
    });

    // 用requestAnimationFrame更新进度
    const updateProgress = () => {
      if (audio.currentTime) {
        setCurrentTime(audio.currentTime);
      }
      rafRef.current = requestAnimationFrame(updateProgress);
    };
    rafRef.current = requestAnimationFrame(updateProgress);

    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.src = '';
    };
  }, [audioSrc, onEnded]);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  // 进度条拖动
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, ratio * duration));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // 倍速切换
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2, 10];
  const changeSpeed = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  // 格式化时间
  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white/95 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">正在播放：{title}</h2>
          <p className="text-slate-500 mt-1">请认真听材料内容</p>
        </div>

        {/* 播放/暂停按钮 */}
        <div className="flex justify-center mb-6">
          <button
            onClick={togglePlay}
            className="w-20 h-20 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-all shadow-lg"
          >
            {isPlaying ? (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* 进度条 */}
        <div className="mb-4">
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="w-full h-3 bg-slate-200 rounded-full cursor-pointer relative overflow-hidden"
          >
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-slate-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 倍速控制 */}
        <div className="flex justify-center gap-2 flex-wrap">
          {speeds.map((rate) => (
            <button
              key={rate}
              onClick={() => changeSpeed(rate)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                playbackRate === rate
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
