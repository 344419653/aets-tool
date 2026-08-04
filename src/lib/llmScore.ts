// DeepSeek LLM 评分的前端封装（经本地代理 /api/llm/score，密钥不落地前端）。
// 用于 Part 3 听力简答的内容完整性 / 关键词覆盖 / 语法词汇三个文本维度：
// LLM 按语义判分（同义改写同等给分），替代本地词面匹配的僵化预评；
// 代理未启动或调用失败时由调用方回退本地算法。

/** LLM 返回的结构化评分（字段均可能缺失，调用方需判空） */
export interface LlmScoreResult {
  content?: { score?: number; reason?: string };
  keywords?: { score?: number; covered?: string[]; missed?: string[]; reason?: string };
  grammar?: { score?: number; issues?: string[]; reason?: string };
  /** 按 ASR 近音容错规则校正后的转写文本（无校正时为空或不返回） */
  correctedTranscript?: string;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
}

export interface LlmScoreRequest {
  question: string;
  referenceAnswer: string;
  keywords: string[];
  transcript: string;
  /** 听力材料原文（可选，有助 LLM 判断回答是否扣题） */
  material?: string;
}

/** 调用本地代理让 LLM 给一道听力简答评分；失败抛错（代理离线 / 未配置密钥 / 超时等） */
export async function scoreShortAnswerWithLLM(req: LlmScoreRequest): Promise<LlmScoreResult> {
  const resp = await fetch('/api/llm/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(70000), // 略大于代理侧 60s
  });
  if (!resp.ok) throw new Error(`LLM 评分代理响应异常（HTTP ${resp.status}）`);
  const data = (await resp.json()) as { ok?: boolean; result?: LlmScoreResult; error?: string };
  if (!data.ok || !data.result) throw new Error(data.error ?? 'LLM 评分失败');
  return data.result;
}

/** 把 LLM 分数钳制到 1-5 整数；非法值返回 null */
export function clampLlmScore(n: unknown): number | null {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 1 && v <= 5 ? v : null;
}
