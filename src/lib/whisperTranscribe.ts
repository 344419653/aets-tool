// 语音转写的主线程封装：优先走讯飞 IAT 听写（经本地代理 /api/iat/transcribe，识别
// 质量远好于浏览器端小模型）；代理未启动或 IAT 失败时自动回退本地 Whisper
// （transformers.js v3 + Web Worker，默认 whisper-small.en，失败降级 whisper-base.en）。
// 输入录音 Blob → 解码 → 重采样到 16kHz 单声道 → IAT 或 worker 推理 → 返回转写文本。

/** 转写进度回调：stage 区分"模型加载中"与"转写中"，percent 为模型下载百分比（可空） */
export type TranscribeProgress = (stage: 'loading' | 'transcribing', percent: number | null) => void;

interface PendingTask {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingTask>();
// 当前任务的进度回调（同一时间只跑一个转写任务，简单起见用单回调）
let progressCallback: TranscribeProgress | null = null;
// 转写任务串行队列（见 transcribeAudio 注释）
let transcribeQueue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./whisperWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        type: string; id?: number; text?: string; message?: string;
        status?: string; progress?: number | null;
      };
      if (msg.type === 'progress') {
        // 模型下载/加载进度
        progressCallback?.('loading', msg.progress ?? null);
        return;
      }
      if (msg.type === 'result' && msg.id !== undefined) {
        pending.get(msg.id)?.resolve(msg.text ?? '');
        pending.delete(msg.id);
        return;
      }
      if (msg.type === 'error' && msg.id !== undefined) {
        pending.get(msg.id)?.reject(new Error(msg.message ?? '转写失败'));
        pending.delete(msg.id);
      }
    };
    worker.onerror = () => {
      // worker 级错误：拒绝所有待处理任务
      pending.forEach((t) => t.reject(new Error('语音识别 Worker 运行失败')));
      pending.clear();
    };
  }
  return worker;
}

/** 将 AudioBuffer 混合为单声道并线性重采样到 16000Hz（Whisper 输入要求） */
function resampleTo16k(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const srcRate = buffer.sampleRate;
  const srcLen = buffer.length;
  // 多声道混合为单声道
  const mono = new Float32Array(srcLen);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < srcLen; i++) mono[i] += data[i] / channels;
  }
  if (srcRate === 16000) return mono;
  // 简单线性插值重采样
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

/** 解码录音 Blob 为 16kHz 单声道 Float32Array */
async function decodeBlob(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return resampleTo16k(audioBuffer);
  } finally {
    ctx.close();
  }
}

/**
 * 讯飞 IAT 听写：把 16kHz Float32 音频转为 PCM16 base64 后经本地代理转写。
 * 代理未启动 / 未配置密钥 / 评测失败时抛错，由调用方回退本地 Whisper。
 */
async function transcribeViaIat(audio: Float32Array): Promise<string> {
  // Float32 [-1,1] → PCM16 小端
  const pcm = new Int16Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    const s = Math.max(-1, Math.min(1, audio[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  // 大数组分块转 base64，避免栈溢出
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const resp = await fetch('/api/iat/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: btoa(binary) }),
    signal: AbortSignal.timeout(130000), // 略大于代理侧 120s 超时
  });
  if (!resp.ok) throw new Error(`讯飞听写代理响应异常（HTTP ${resp.status}）`);
  const data = (await resp.json()) as { ok?: boolean; text?: string; error?: string };
  if (!data.ok) throw new Error(data.error ?? '讯飞听写失败');
  return (data.text ?? '').trim();
}

/** 终止并丢弃当前 Worker（WASM Aborted 后整个 Worker 的运行时已不可用，必须重建） */
function killWorker(): void {
  try { worker?.terminate(); } catch { /* ignore */ }
  worker = null;
  progressCallback = null;
  pending.forEach((t) => t.reject(new Error('语音识别 Worker 已重置')));
  pending.clear();
}

/** 本地 Whisper 转写（原实现，作为 IAT 不可用时的兜底） */
function transcribeViaWhisper(audio: Float32Array, onProgress?: TranscribeProgress): Promise<string> {
  const w = getWorker();
  progressCallback = onProgress ?? null;
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, {
      resolve: (text) => { if (progressCallback === onProgress) progressCallback = null; resolve(text); },
      reject: (err) => { if (progressCallback === onProgress) progressCallback = null; reject(err); },
    });
    // 拷贝一份再 transfer，避免调用方复用同一 buffer 的边界问题
    const payload = audio.slice();
    w.postMessage({ type: 'transcribe', id, audio: payload }, [payload.buffer]);
  });
}

/**
 * 将录音 Blob 转写为英文文本。
 * 优先讯飞 IAT（需本地代理在线）；失败自动回退本地 Whisper（首次需加载约 250MB 模型）。
 * 全局串行排队：同一时间只跑一个转写任务（本地 Whisper 的 WASM 推理不支持并发，
 * 并发会 Aborted() 崩溃；Part 4 报告页会同时启动多轮转写，依赖此队列）。
 */
export async function transcribeAudio(blob: Blob, onProgress?: TranscribeProgress): Promise<string> {
  const run = transcribeQueue.then(() => transcribeAudioOnce(blob, onProgress));
  // 队列链吞掉错误，避免一个失败任务影响后续排队任务
  transcribeQueue = run.catch(() => {});
  return run;
}

async function transcribeAudioOnce(blob: Blob, onProgress?: TranscribeProgress): Promise<string> {
  const audio = await decodeBlob(blob);
  onProgress?.('transcribing', null);
  try {
    return await transcribeViaIat(audio);
  } catch (err) {
    console.warn('[transcribe] 讯飞 IAT 不可用，回退本地 Whisper:', err);
  }
  try {
    return await transcribeViaWhisper(audio, onProgress);
  } catch (err) {
    // WASM Aborted 后 Worker 内运行时已死（worker 内的管线重建重试无效），
    // 终止 Worker 并换新实例重试一次；仍失败才把错误抛给调用方
    if (/abort/i.test(err instanceof Error ? err.message : String(err))) {
      console.warn('[transcribe] Whisper WASM 异常中止，重建 Worker 重试一次:', err);
      killWorker();
      return transcribeViaWhisper(audio, onProgress);
    }
    throw err;
  }
}
