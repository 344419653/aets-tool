import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, Headphones, AlertTriangle, Mic, BookOpen, Phone, MessageCircle, BookX, Star, History, PlayCircle } from 'lucide-react';
import type { ExamHistoryRecord, ExamProgressSnapshot } from '@/types/exam';
import { getInProgress, loadHistory } from '@/lib/persistence/history';

interface StartScreenProps {
  onStartFull: () => void;
  onStartPart1Only: () => void;
  onStartPart2Only: () => void;
  onStartPart3Only: () => void;
  onStartPart4Only: () => void;
  onStartPart5Only: () => void;
  /** 打开错题本 */
  onOpenNotebook: () => void;
  /** 打开收藏页 */
  onOpenFavorites: () => void;
  /** 继续上次未完成的考试（部分级快照续做） */
  onResumeExam: () => void;
}

export default function StartScreen({ onStartFull, onStartPart1Only, onStartPart2Only, onStartPart3Only, onStartPart4Only, onStartPart5Only, onOpenNotebook, onOpenFavorites, onResumeExam }: StartScreenProps) {
  // 中断续做快照与历史记录（纯 localStorage 读取，进入首页时加载一次）
  const [inProgress] = useState<ExamProgressSnapshot | null>(() => getInProgress());
  const [history] = useState<ExamHistoryRecord[]>(() => loadHistory());
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const shownHistory = historyExpanded ? history : history.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* 标题 */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Radio className="w-10 h-10 text-white" />
            <h1 className="text-4xl font-bold text-white tracking-tight">AETS 模拟考试</h1>
          </div>
          <p className="text-blue-100">管制员英语等级测试模拟考试</p>
        </div>

        {/* 继续上次考试（未完成的中断快照） */}
        {inProgress && (
          <button
            type="button"
            onClick={onResumeExam}
            className="w-full bg-emerald-500/95 hover:bg-emerald-500 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 transition-all hover:scale-[1.02]"
          >
            <PlayCircle className="w-6 h-6 shrink-0" />
            <div className="text-left">
              <p className="font-semibold text-sm">继续上次考试（已完成 {inProgress.completedParts}/4 部分）</p>
              <p className="text-emerald-100 text-xs">
                中断于 {new Date(inProgress.savedAt).toLocaleString()}，点击进入下一未完成部分
              </p>
            </div>
          </button>
        )}

        {/* 说明 */}
        <Card className="bg-white/95 border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-slate-800 text-lg">选择测试内容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2">
                <Headphones className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-slate-800 text-sm font-medium">第一部分</h3>
                  <p className="text-slate-500 text-xs">听力理解</p>
                </div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg flex items-start gap-2">
                <BookOpen className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-slate-800 text-sm font-medium">第二部分</h3>
                  <p className="text-slate-500 text-xs">故事复述</p>
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg flex items-start gap-2">
                <Mic className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-slate-800 text-sm font-medium">第三部分</h3>
                  <p className="text-slate-500 text-xs">听力简答</p>
                </div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg flex items-start gap-2">
                <Phone className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-slate-800 text-sm font-medium">第四部分</h3>
                  <p className="text-slate-500 text-xs">模拟通话</p>
                </div>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg flex items-start gap-2">
                <MessageCircle className="w-5 h-5 text-teal-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-slate-800 text-sm font-medium">第五部分</h3>
                  <p className="text-slate-500 text-xs">口语面试 OPI</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-amber-700 text-xs space-y-1">
                <p>第一部分：选择答案，限时作答</p>
                <p>第二部分：听故事后复述录音，可拖拽进度条控制时间</p>
                <p>第三部分：听材料后录音回答，支持回放重录</p>
                <p>第四部分：扮演管制员回应Pilot通话，自动录音22轮</p>
                <p>第五部分：OPI口语面试，考官语音提问，60秒回答</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 开始按钮 */}
        <div className="space-y-3">
          <Button
            onClick={onStartFull}
            size="lg"
            className="w-full bg-sky-500 hover:bg-sky-600 text-white py-6 text-lg font-semibold rounded-xl shadow-lg shadow-sky-500/25 transition-all hover:scale-105"
          >
            <Headphones className="w-5 h-5 mr-2" />
            完整考试（全部五部分）
          </Button>

          <Button
            onClick={onStartPart1Only}
            size="lg"
            variant="outline"
            className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
          >
            <Headphones className="w-5 h-5 mr-2" />
            仅测试第一部分：听力理解
          </Button>

          <Button
            onClick={onStartPart2Only}
            size="lg"
            variant="outline"
            className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
          >
            <BookOpen className="w-5 h-5 mr-2" />
            仅测试第二部分：故事复述
          </Button>

          <Button
            onClick={onStartPart3Only}
            size="lg"
            variant="outline"
            className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
          >
            <Mic className="w-5 h-5 mr-2" />
            仅测试第三部分：听力简答
          </Button>

          <Button
            onClick={onStartPart4Only}
            size="lg"
            variant="outline"
            className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
          >
            <Phone className="w-5 h-5 mr-2" />
            仅测试第四部分：模拟通话
          </Button>

          <Button
            onClick={onStartPart5Only}
            size="lg"
            variant="outline"
            className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            仅测试第五部分：口语面试
          </Button>

          {/* 错题本 / 收藏入口 */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onOpenNotebook}
              size="lg"
              variant="outline"
              className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
            >
              <BookX className="w-5 h-5 mr-2" />
              错题本
            </Button>
            <Button
              onClick={onOpenFavorites}
              size="lg"
              variant="outline"
              className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 py-6 text-lg font-semibold rounded-xl transition-all hover:scale-105"
            >
              <Star className="w-5 h-5 mr-2" />
              收藏
            </Button>
          </div>
        </div>

        {/* 历史记录 */}
        {history.length > 0 && (
          <Card className="bg-white/95 border-0 shadow-xl">
            <CardHeader className="py-4">
              <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                历史记录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {shownHistory.map((rec) => (
                <div key={rec.id} className="bg-slate-50 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-700 text-sm font-medium">{rec.mode}</span>
                    <span className="text-slate-400 text-xs">{new Date(rec.finishedAt).toLocaleString()}</span>
                  </div>
                  {rec.summaries.length > 0 && (
                    <p className="text-slate-500 text-xs mt-1">
                      {rec.summaries.map((s) => `${s.label} ${s.value}`).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
              {history.length > 5 && (
                <button
                  type="button"
                  onClick={() => setHistoryExpanded((v) => !v)}
                  className="w-full text-sky-600 hover:text-sky-700 text-xs font-medium py-1"
                >
                  {historyExpanded ? '收起' : `展开全部 ${history.length} 条`}
                </button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
