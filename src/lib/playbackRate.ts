// 全局回放倍速（仅练习/回听场景使用：错题本、收藏、结果页与各报告页回放；
// 正式考试流程音频不加此控件，保持 1x）
// 档位沿用 MaterialPlayer 的 [0.5, 0.75, 1, 1.25, 1.5, 2]（去掉 10x）。

const STORAGE_KEY = 'aets.playbackRate.v1';

/** 可选倍速档位 */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** 倍速变更时派发的自定义事件名（已存在的 audio 元素监听此事件同步更新） */
export const PLAYBACK_RATE_EVENT = 'aets:playback-rate-changed';

/** 读取当前全局倍速（默认 1x，存储损坏时回退 1x） */
export function getPlaybackRate(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 1;
    const rate = Number(JSON.parse(raw));
    return (PLAYBACK_RATES as readonly number[]).includes(rate) ? rate : 1;
  } catch {
    return 1;
  }
}

/** 保存全局倍速并广播变更事件 */
export function setPlaybackRate(rate: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rate));
  } catch {
    // 存储失败时静默忽略
  }
  window.dispatchEvent(new CustomEvent(PLAYBACK_RATE_EVENT, { detail: rate }));
}

/** 把当前全局倍速应用到 audio 元素 */
export function applyPlaybackRate(audio: HTMLAudioElement): void {
  audio.playbackRate = getPlaybackRate();
}

/** 循环切换到下一档倍速，返回新倍速 */
export function cyclePlaybackRate(current: number): number {
  const idx = (PLAYBACK_RATES as readonly number[]).indexOf(current);
  const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
  setPlaybackRate(next);
  return next;
}
