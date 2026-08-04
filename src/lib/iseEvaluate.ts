// 讯飞 ISE 发音评测的前端封装。
// 录音 Blob → 解码 → 混单声道 → 重采样 16kHz → PCM16 → base64 → POST /api/ise/evaluate
// （开发环境经 vite proxy 转发到本地代理 server/ise-proxy.mjs，密钥不落前端）。
// 解码/重采样逻辑与 whisperTranscribe.ts 保持一致（两处各自独立实现，避免互相耦合）。

export interface IseScores {
  /** 总分（0-100，篇章题型 = 0.5×准确度 + 0.3×流利度 + 0.2×标准度，再乘完整度系数） */
  total: number;
  /** 准确度（0-100） */
  accuracy?: number;
  /** 流利度（0-100） */
  fluency?: number;
  /** 完整度（0-100） */
  integrity?: number;
  /** 标准度（0-100，可选） */
  standard?: number;
  /** 发音准确度（0-100，topic 英文自由题专有） */
  phoneScore?: number;
  /** 语义准确度（0-100，topic 英文自由题专有） */
  semanticAccuracy?: number;
  /** 引擎判定为"乱读/拒识"时分值不可信（read_chapter 与 topic 都可能返回，
   *  topic 实测对静音/无效作答同样报 is_rejected，如 except_info=28689） */
  isRejected?: boolean;
}

/** 将 AudioBuffer 混合为单声道并线性重采样到 16000Hz */
function resampleTo16k(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const srcRate = buffer.sampleRate;
  const srcLen = buffer.length;
  const mono = new Float32Array(srcLen);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < srcLen; i++) mono[i] += data[i] / channels;
  }
  if (srcRate === 16000) return mono;
  const dstLen = Math.round((srcLen * 16000) / srcRate);
  const dst = new Float32Array(dstLen);
  const ratio = srcRate / 16000;
  for (let i = 0; i < dstLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = mono[Math.min(idx, srcLen - 1)];
    const b = mono[Math.min(idx + 1, srcLen - 1)];
    dst[i] = a + (b - a) * frac;
  }
  return dst;
}

/** Float32（-1~1）转 PCM16 小端字节 */
function floatToPcm16(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * 将录音送往本地 ISE 代理做英文篇章发音评测。
 * @param blob 考生的复述录音（任意浏览器可解码格式）
 * @param refText 故事英文原文（作为评测试卷文本）
 * @throws 代理未启动、未配置密钥或讯飞评测失败时抛出带中文信息的 Error
 */
export async function evaluatePronunciation(blob: Blob, refText: string): Promise<IseScores> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  let pcm: Uint8Array;
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    pcm = floatToPcm16(resampleTo16k(audioBuffer));
  } finally {
    ctx.close();
  }

  let res: Response;
  try {
    res = await fetch('/api/ise/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: refText, audio: bytesToBase64(pcm) }),
    });
  } catch {
    throw new Error('无法连接本地评测代理（请先运行 npm run server）');
  }
  // 代理不可达时 vite proxy 会返回 500 空响应，res.json() 会抛 "Unexpected end of JSON input"，
  // 因此先读文本判空，把这种情况也归入"代理未连接"的明确提示。
  const rawBody = await res.text();
  if (!res.ok || !rawBody) {
    throw new Error(
      `无法连接本地评测代理（HTTP ${res.status}，请确认 npm run server 正在运行且未被崩溃退出）`,
    );
  }
  const body = JSON.parse(rawBody) as { ok: boolean; scores?: IseScores; error?: string };
  if (!body.ok || !body.scores) {
    throw new Error(body.error || '讯飞评测失败');
  }
  return body.scores;
}

/** 0-100 分制映射到 1-5 分（每 20 分一档，四舍五入，保底 1 分） */
export function iseToFive(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score / 20)));
}

/**
 * 将录音送往本地 ISE 代理做英文自由题（topic）评测，流程与 evaluatePronunciation 相同，
 * 试卷文本为"题目 + 参考答案"（category: 'topic'）。
 * @param blob 考生的回答录音（任意浏览器可解码格式）
 * @param question 题目文本（英文问题）
 * @param reference 参考答案（英文）
 * @throws 代理未启动、未配置密钥或讯飞评测失败时抛出带中文信息的 Error
 */
export async function evaluateFreeSpeech(blob: Blob, question: string, reference: string): Promise<IseScores> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  let pcm: Uint8Array;
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    pcm = floatToPcm16(resampleTo16k(audioBuffer));
  } finally {
    ctx.close();
  }

  let res: Response;
  try {
    res = await fetch('/api/ise/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'topic', question, text: reference, audio: bytesToBase64(pcm) }),
    });
  } catch {
    throw new Error('无法连接本地评测代理（请先运行 npm run server）');
  }
  // 同 evaluatePronunciation：先读文本判空，避免空响应报 "Unexpected end of JSON input"
  const rawBody = await res.text();
  if (!res.ok || !rawBody) {
    throw new Error(
      `无法连接本地评测代理（HTTP ${res.status}，请确认 npm run server 正在运行且未被崩溃退出）`,
    );
  }
  const body = JSON.parse(rawBody) as { ok: boolean; scores?: IseScores; error?: string };
  if (!body.ok || !body.scores) {
    throw new Error(body.error || '讯飞评测失败');
  }
  return body.scores;
}
