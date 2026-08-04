// 全局倍速循环按钮：点击在 PLAYBACK_RATES 档位间循环，样式参考 MaterialPlayer 的倍速 UI。
// 仅用于练习/回听场景（错题本、收藏、结果页、报告页回放），正式考试流程不挂载。
import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { PLAYBACK_RATE_EVENT, cyclePlaybackRate, getPlaybackRate } from '@/lib/playbackRate';

export default function PlaybackRateButton({ className = '' }: { className?: string }) {
  const [rate, setRate] = useState(getPlaybackRate);

  // 其它挂载点改倍速时同步显示
  useEffect(() => {
    const onChanged = (e: Event) => setRate((e as CustomEvent<number>).detail ?? getPlaybackRate());
    window.addEventListener(PLAYBACK_RATE_EVENT, onChanged);
    return () => window.removeEventListener(PLAYBACK_RATE_EVENT, onChanged);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setRate(cyclePlaybackRate(rate))}
      title="切换回放倍速"
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 ${className}`}
    >
      <Gauge className="w-3.5 h-3.5" />
      {rate}x
    </button>
  );
}
