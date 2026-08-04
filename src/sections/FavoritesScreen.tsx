// 收藏页：按部分分 tab 展示收藏条目。
// Part 1 收藏复用错题详情卡（含对话音频倍速回放）；
// Part 2-5 收藏展示题目/参考文本与评分摘要——录音不跨会话保存，仅保留文本元数据。
import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import Part1ReviewCard from '@/components/Part1ReviewCard';
import type { FavoriteEntry } from '@/types/exam';
import { loadFavorites, removeFavorite } from '@/lib/persistence/favorites';

interface Props {
  onBack: () => void;
}

const PART_LABELS: Record<number, string> = {
  1: '听力理解',
  2: '故事复述',
  3: '听力简答',
  4: '模拟通话',
  5: '口语面试',
};

export default function FavoritesScreen({ onBack }: Props) {
  const [entries, setEntries] = useState<FavoriteEntry[]>(() =>
    Object.values(loadFavorites()).sort((a, b) => b.createdAt - a.createdAt)
  );
  const [openKey, setOpenKey] = useState<string | null>(null);

  const byPart = useMemo(() => {
    const map: Record<number, FavoriteEntry[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const e of entries) map[e.part]?.push(e);
    return map;
  }, [entries]);

  const handleRemove = (key: string) => {
    removeFavorite(key);
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-lg mx-auto space-y-6 pt-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="text-slate-300 hover:text-white hover:bg-slate-700/50">
            <ArrowLeft className="w-4 h-4 mr-1" />返回首页
          </Button>
          <h1 className="text-xl font-bold text-white">收藏</h1>
          <span className="text-slate-400 text-sm">{entries.length} 条</span>
        </div>

        {entries.length === 0 ? (
          <Empty className="border border-slate-700 bg-slate-800/50">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Star /></EmptyMedia>
              <EmptyTitle className="text-slate-200">暂无收藏</EmptyTitle>
              <EmptyDescription className="text-slate-400">
                在结果页或评分报告页点击星标即可收藏题目。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Tabs defaultValue="1" className="pb-8">
            <TabsList className="bg-slate-800/60 w-full">
              {[1, 2, 3, 4, 5].map((p) => (
                <TabsTrigger key={p} value={String(p)} className="flex-1 text-xs data-[state=active]:bg-slate-700">
                  P{p}（{byPart[p].length}）
                </TabsTrigger>
              ))}
            </TabsList>
            {[1, 2, 3, 4, 5].map((p) => (
              <TabsContent key={p} value={String(p)} className="space-y-4 mt-4">
                {byPart[p].length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">该部分暂无收藏</p>
                ) : (
                  byPart[p].map((e) => {
                    const open = openKey === e.key;
                    return (
                      <Card key={e.key} className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="py-3">
                          <button
                            type="button"
                            onClick={() => setOpenKey(open ? null : e.key)}
                            className="w-full flex items-center justify-between gap-2 text-left"
                          >
                            <CardTitle className="text-slate-200 text-sm font-medium line-clamp-2">{e.title}</CardTitle>
                            <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            <Badge variant="secondary" className="bg-slate-700/60 text-slate-300 text-xs">
                              第{p}部分 · {PART_LABELS[p]}
                            </Badge>
                            {e.score != null && (
                              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 text-xs">
                                得分 {e.score}/25
                              </Badge>
                            )}
                            <span className="text-slate-500 text-xs">
                              {new Date(e.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </CardHeader>
                        {open && (
                          <CardContent className="space-y-3 pt-0">
                            {e.part === 1 && e.part1 ? (
                              <Part1ReviewCard
                                questionText={e.part1.questionText}
                                options={e.part1.options}
                                correctAnswer={e.part1.correctAnswer}
                                userAnswer={e.part1.userAnswer}
                                dialogue={e.part1.dialogue}
                                explanation={e.part1.explanation}
                                dialogueAudio={e.part1.dialogueAudio}
                              />
                            ) : (
                              <>
                                {e.text && (
                                  <div className="bg-slate-700/20 rounded-lg p-3 text-sm">
                                    <p className="text-slate-400 mb-1">题目/提示：</p>
                                    <p className="text-slate-300 whitespace-pre-wrap">{e.text}</p>
                                  </div>
                                )}
                                {e.detail && (
                                  <div className="bg-slate-700/20 rounded-lg p-3 text-sm">
                                    <p className="text-slate-400 mb-1">参考答案/原文：</p>
                                    <p className="text-slate-300 whitespace-pre-wrap">{e.detail}</p>
                                  </div>
                                )}
                                <p className="text-slate-500 text-xs">录音不跨会话保存，此处仅保留文本与评分记录。</p>
                              </>
                            )}
                            <div>
                              <button
                                type="button"
                                onClick={() => handleRemove(e.key)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 hover:bg-red-500/20 hover:text-red-300 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />取消收藏
                              </button>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
