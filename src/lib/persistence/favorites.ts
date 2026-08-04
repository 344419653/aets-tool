// 收藏持久化（Part 1 题目 / Part 2 故事 / Part 3 问题 / Part 4 轮次 / Part 5 OPI 问题）
// 录音 Blob 不持久化，收藏只存文本与评分元数据。
import type { FavoriteEntry } from '@/types/exam';

const STORAGE_KEY = 'aets.favorites.v1';

/** 读取全部收藏（JSON 损坏时回退空数据） */
export function loadFavorites(): Record<string, FavoriteEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as { version?: number; entries?: Record<string, FavoriteEntry> };
    return data.entries ?? {};
  } catch {
    return {};
  }
}

function saveFavorites(entries: Record<string, FavoriteEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
  } catch {
    // 存储失败时静默忽略
  }
}

/** 是否已收藏 */
export function isFavorite(key: string): boolean {
  return key in loadFavorites();
}

/** 切换收藏状态，返回切换后是否已收藏 */
export function toggleFavorite(entry: FavoriteEntry): boolean {
  const entries = loadFavorites();
  if (entry.key in entries) {
    delete entries[entry.key];
    saveFavorites(entries);
    return false;
  }
  entries[entry.key] = entry;
  saveFavorites(entries);
  return true;
}

/** 移除收藏 */
export function removeFavorite(key: string): void {
  const entries = loadFavorites();
  if (key in entries) {
    delete entries[key];
    saveFavorites(entries);
  }
}
