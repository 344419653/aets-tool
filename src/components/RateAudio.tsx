// 带全局倍速的 <audio controls> 封装：挂载时应用当前倍速，
// 倍速变更事件到达时同步更新。仅用于练习/回听场景。
import { useEffect, useRef } from 'react';
import { PLAYBACK_RATE_EVENT, applyPlaybackRate } from '@/lib/playbackRate';

interface Props {
  src: string;
  className?: string;
}

export default function RateAudio({ src, className = '' }: Props) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    applyPlaybackRate(audio);
    const onChanged = () => applyPlaybackRate(audio);
    window.addEventListener(PLAYBACK_RATE_EVENT, onChanged);
    return () => window.removeEventListener(PLAYBACK_RATE_EVENT, onChanged);
  }, [src]);

  return <audio ref={ref} controls src={src} className={className} />;
}
