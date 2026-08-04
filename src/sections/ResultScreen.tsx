import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExamResult, Part1Answer, Question } from '@/types/exam';
import { Trophy, CheckCircle, XCircle, RotateCcw, Target } from 'lucide-react';
import FavoriteButton from '@/components/FavoriteButton';
import RateAudio from '@/components/RateAudio';
import PlaybackRateButton from '@/components/PlaybackRateButton';

interface ResultScreenProps {
  result: ExamResult;
  questions?: Question[];
  /** Part 1 原始作答明细（含 groupId/bankQNo），用于逐题收藏与音频回放 */
  part1Answers?: Part1Answer[];
  onRestart: () => void;
}

export default function ResultScreen({ result, questions = [], part1Answers = [], onRestart }: ResultScreenProps) {
  const isPass = result.score >= 60;
  const hasQuestions = questions.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-lg mx-auto space-y-6 pt-8">
        {/* 总成绩 */}
        <div className="text-center space-y-4">
          {isPass ? (
            <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
          ) : (
            <Target className="w-16 h-16 text-slate-400 mx-auto" />
          )}
          <h1 className="text-3xl font-bold text-white">考试完成</h1>
          <div className={`inline-block px-4 py-2 rounded-full text-lg font-bold ${
            isPass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {result.correctCount}/{result.totalQuestions} 正确 ({result.score}分)
          </div>
        </div>

        {/* 逐题解析 */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">答案解析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.answers.map((answer, idx) => {
              const q = hasQuestions ? questions.find((qq) => qq.id === answer.questionId) : undefined;
              const pa = part1Answers.find((a) => a.qNo === answer.questionId);
              const correct = answer.isCorrect;
              const userText = hasQuestions ? q?.options.find((o) => o.label === answer.selectedOption)?.text : undefined;
              const correctText = hasQuestions ? q?.options.find((o) => o.label === answer.correctOption)?.text : undefined;

              return (
                <div key={answer.questionId} className={`border rounded-lg p-4 ${correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sky-400 font-semibold text-sm">第 {idx + 1} 题</span>
                    {correct ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> 正确
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 text-xs bg-red-500/20 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" /> {answer.selectedOption ? '错误' : '未作答'}
                      </span>
                    )}
                    {/* 逐题收藏（错题已自动进入错题本） */}
                    {pa && (
                      <span className="ml-auto">
                        <FavoriteButton
                          entry={{
                            key: `p1:${pa.groupId}:${pa.bankQNo}`,
                            part: 1,
                            title: pa.questionText,
                            part1: {
                              groupId: pa.groupId,
                              bankQNo: pa.bankQNo,
                              questionText: pa.questionText,
                              options: pa.options,
                              correctAnswer: pa.correctAnswer,
                              userAnswer: pa.userAnswer,
                              dialogue: pa.dialogue,
                              explanation: pa.explanation,
                              dialogueAudio: pa.dialogueAudio,
                            },
                          }}
                          className="bg-slate-700/60 text-slate-300 hover:bg-slate-700"
                        />
                      </span>
                    )}
                  </div>

                  {/* 对话音频回放（练习/回听场景，支持倍速） */}
                  {pa?.dialogueAudio && (
                    <div className="flex items-center gap-2 mb-3">
                      <RateAudio src={pa.dialogueAudio} className="flex-1 h-9" />
                      <PlaybackRateButton className="bg-slate-700/60 text-slate-300 hover:bg-slate-700" />
                    </div>
                  )}

                  {q ? (
                    <>
                      {/* 题目原文 */}
                      <p className="text-slate-200 text-sm font-medium mb-3">{q.question}</p>

                      {/* 对话原文（可折叠） */}
                      <details className="mb-3">
                        <summary className="text-slate-400 text-xs cursor-pointer hover:text-slate-300 select-none">
                          查看对话原文
                        </summary>
                        <pre className="mt-2 bg-slate-900/60 rounded-lg p-3 text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                          {q.dialogue}
                        </pre>
                      </details>

                      {/* 全部选项：正确答案高亮，用户的错误选择标红 */}
                      <div className="space-y-1.5 mb-3">
                        {q.options.map((opt) => {
                          const isCorrectOpt = opt.label === answer.correctOption;
                          const isUserOpt = opt.label === answer.selectedOption;
                          return (
                            <div
                              key={opt.label}
                              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm border ${
                                isCorrectOpt
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                  : isUserOpt
                                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                                    : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              <span className="shrink-0 font-semibold">{opt.label}.</span>
                              <span className="flex-1">{opt.text}</span>
                              {isCorrectOpt && <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                              {!isCorrectOpt && isUserOpt && <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                            </div>
                          );
                        })}
                      </div>

                      {/* 作答情况小结 */}
                      <p className="text-xs text-slate-400 mb-2">
                        你的答案：<span className={correct ? 'text-emerald-400' : 'text-red-400'}>
                          {answer.selectedOption ?? '未作答'}
                        </span>
                        <span className="mx-2">·</span>
                        正确答案：<span className="text-emerald-400">{answer.correctOption}</span>
                      </p>

                      {q.explanation && (
                        <div className="bg-slate-700/20 rounded-lg p-3 text-sm">
                          <p className="text-slate-400 mb-1">解析：</p>
                          <p className="text-slate-300">{q.explanation}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-slate-700/30 rounded-lg p-3 text-sm mb-2">
                        <p className="text-slate-400 mb-1">你的答案：</p>
                        <p className={correct ? 'text-emerald-400' : 'text-red-400'}>
                          {answer.selectedOption ? (userText ? `${answer.selectedOption}. ${userText}` : answer.selectedOption) : '未作答'}
                        </p>
                      </div>

                      {!correct && (
                        <div className="bg-emerald-500/10 rounded-lg p-3 text-sm mb-2">
                          <p className="text-emerald-400 mb-1">正确答案：</p>
                          <p className="text-emerald-300">{correctText ? `${answer.correctOption}. ${correctText}` : answer.correctOption}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 重新开始 */}
        <div className="flex justify-center pb-8">
          <Button onClick={onRestart} size="lg"
            className="bg-sky-500 hover:bg-sky-600 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-sky-500/25 transition-all hover:scale-105">
            <RotateCcw className="w-5 h-5 mr-2" />再练一次
          </Button>
        </div>
      </div>
    </div>
  );
}
