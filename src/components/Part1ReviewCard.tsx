// Part 1 逐题复习卡：选项对错高亮、可折叠对话原文、解析、对话音频回放（带倍速）。
// UI 模式复用 ResultScreen 的 Part 1 逐题解析样式，供错题本 / 收藏页共用。
import { CheckCircle, XCircle } from 'lucide-react';
import RateAudio from '@/components/RateAudio';
import PlaybackRateButton from '@/components/PlaybackRateButton';

export interface Part1ReviewCardProps {
  questionText: string;
  /** 选项列表（如 "A. Stop before RWY05L."） */
  options: string[];
  correctAnswer: string;
  /** 用户的错误选择；未作答为 null；纯收藏展示可不传 */
  userAnswer?: string | null;
  dialogue: string;
  explanation?: string;
  /** 对话音频路径（有则显示回放控件，支持倍速） */
  dialogueAudio?: string;
}

export default function Part1ReviewCard({
  questionText,
  options,
  correctAnswer,
  userAnswer,
  dialogue,
  explanation,
  dialogueAudio,
}: Part1ReviewCardProps) {
  const parsed = options.map((o) => ({ label: o.charAt(0), text: o.replace(/^[A-D]\.\s*/, '') }));

  return (
    <div className="space-y-3">
      {/* 题目原文 */}
      <p className="text-slate-200 text-sm font-medium">{questionText}</p>

      {/* 对话原文（可折叠） */}
      <details>
        <summary className="text-slate-400 text-xs cursor-pointer hover:text-slate-300 select-none">
          查看对话原文
        </summary>
        <pre className="mt-2 bg-slate-900/60 rounded-lg p-3 text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
          {dialogue}
        </pre>
      </details>

      {/* 对话音频回放（带倍速） */}
      {dialogueAudio && (
        <div className="flex items-center gap-2">
          <RateAudio src={dialogueAudio} className="flex-1 h-9" />
          <PlaybackRateButton className="bg-slate-700/60 text-slate-300 hover:bg-slate-700" />
        </div>
      )}

      {/* 全部选项：正确答案高亮，用户的错误选择标红 */}
      <div className="space-y-1.5">
        {parsed.map((opt) => {
          const isCorrectOpt = opt.label === correctAnswer;
          const isUserOpt = userAnswer != null && opt.label === userAnswer;
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
      {userAnswer !== undefined && (
        <p className="text-xs text-slate-400">
          你的答案：<span className="text-red-400">{userAnswer ?? '未作答'}</span>
          <span className="mx-2">·</span>
          正确答案：<span className="text-emerald-400">{correctAnswer}</span>
        </p>
      )}

      {explanation && (
        <div className="bg-slate-700/20 rounded-lg p-3 text-sm">
          <p className="text-slate-400 mb-1">解析：</p>
          <p className="text-slate-300">{explanation}</p>
        </div>
      )}
    </div>
  );
}
