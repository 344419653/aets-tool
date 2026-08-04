// 错题本：仅收录 Part 1 听力选择题答错题（App 在每次 Part 1 提交后自动同步：
// 答错写入/更新、答对自动移出）。列表 + 展开详情（复习卡 + 对话音频倍速回放），
// 支持按场景类别筛选、移除、收藏。
import { useMemo, useState } from 'react';
import { ArrowLeft, BookX, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import Part1ReviewCard from '@/components/Part1ReviewCard';
import FavoriteButton from '@/components/FavoriteButton';
import type { NotebookEntry } from '@/types/exam';
import { loadNotebook, removeNotebookEntry } from '@/lib/persistence/notebook';

interface Props {
  onBack: () => void;
}

export default function NotebookScreen({ onBack }: Props) {
  const [entries, setEntries] = useState<NotebookEntry[]>(() =>
    Object.values(loadNotebook()).sort((a, b) => b.lastWrongAt - a.lastWrongAt)
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [scenarioFilter, setScenarioFilter] = useState<string>('all');

  const scenarios = useMemo(
    () => Array.from(new Set(entries.map((e) => e.scenario).filter((s): s is string => !!s))),
    [entries]
  );
  const filtered = scenarioFilter === 'all' ? entries : entries.filter((e) => e.scenario === scenarioFilter);

  const handleRemove = (key: string) => {
    removeNotebookEntry(key);
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-lg mx-auto space-y-6 pt-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="text-slate-300 hover:text-white hover:bg-slate-700/50">
            <ArrowLeft className="w-4 h-4 mr-1" />返回首页
          </Button>
          <h1 className="text-xl font-bold text-white">错题本</h1>
          <span className="text-slate-400 text-sm">{entries.length} 题</span>
        </div>

        {entries.length === 0 ? (
          <Empty className="border border-slate-700 bg-slate-800/50">
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookX /></EmptyMedia>
              <EmptyTitle className="text-slate-200">暂无错题</EmptyTitle>
              <EmptyDescription className="text-slate-400">
                第一部分答错的题会自动收录到这里，答对后自动移出。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* 场景类别筛选 */}
            {scenarios.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {['all', ...scenarios].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScenarioFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      scenarioFilter === s
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {s === 'all' ? '全部' : s}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-4 pb-8">
              {filtered.map((e) => {
                const open = openKey === e.key;
                return (
                  <Card key={e.key} className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="py-3">
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? null : e.key)}
                        className="w-full flex items-center justify-between gap-2 text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-slate-200 text-sm font-medium line-clamp-1">
                            {e.questionText}
                          </CardTitle>
                        </div>
                        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <Badge variant="secondary" className="bg-slate-700/60 text-slate-300 text-xs">{e.groupId}</Badge>
                        {e.scenario && (
                          <Badge variant="secondary" className="bg-sky-500/20 text-sky-300 text-xs">{e.scenario}</Badge>
                        )}
                        <Badge variant="secondary" className="bg-red-500/20 text-red-300 text-xs">错 {e.wrongCount} 次</Badge>
                        <span className="text-slate-500 text-xs">
                          最近：{new Date(e.lastWrongAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardHeader>
                    {open && (
                      <CardContent className="space-y-4 pt-0">
                        <Part1ReviewCard
                          questionText={e.questionText}
                          options={e.options}
                          correctAnswer={e.correctAnswer}
                          userAnswer={e.userAnswer}
                          dialogue={e.dialogue}
                          explanation={e.explanation}
                          dialogueAudio={e.dialogueAudio}
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <FavoriteButton
                            entry={{
                              key: e.key,
                              part: 1,
                              title: e.questionText,
                              part1: {
                                groupId: e.groupId,
                                bankQNo: e.bankQNo,
                                questionText: e.questionText,
                                options: e.options,
                                correctAnswer: e.correctAnswer,
                                userAnswer: e.userAnswer,
                                dialogue: e.dialogue,
                                explanation: e.explanation,
                                dialogueAudio: e.dialogueAudio,
                              },
                            }}
                            className="bg-slate-700/60 text-slate-300 hover:bg-slate-700"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemove(e.key)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 hover:bg-red-500/20 hover:text-red-300 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />移出错题本
                          </button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
