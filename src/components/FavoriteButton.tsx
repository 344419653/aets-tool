// 收藏星标按钮：点击写入/取消收藏（localStorage），再次点击取消。
import { useState } from 'react';
import { Star } from 'lucide-react';
import type { FavoriteEntry } from '@/types/exam';
import { isFavorite, toggleFavorite } from '@/lib/persistence/favorites';

interface Props {
  /** 收藏条目（key 必须稳定，见 types/exam.ts 的 key 约定；createdAt 在点击时生成） */
  entry: Omit<FavoriteEntry, 'createdAt'>;
  className?: string;
}

export default function FavoriteButton({ entry, className = '' }: Props) {
  const [faved, setFaved] = useState(() => isFavorite(entry.key));

  return (
    <button
      type="button"
      onClick={() => setFaved(toggleFavorite({ ...entry, createdAt: Date.now() }))}
      title={faved ? '取消收藏' : '收藏'}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
        faved
          ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      } ${className}`}
    >
      <Star className={`w-3.5 h-3.5 ${faved ? 'fill-amber-500 text-amber-500' : ''}`} />
      {faved ? '已收藏' : '收藏'}
    </button>
  );
}
