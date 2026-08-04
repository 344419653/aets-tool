// Whisper 语音识别 Web Worker（transformers.js v3，WASM 本地推理）。
// 独立线程中加载并运行模型，避免阻塞 UI。
//
// 模型选择：onnx-community/whisper-small.en（英文专用，q8 量化约 242MB）。
// 历史：曾因实机浏览器 WASM 内存分配失败（Can't create a session / Aborted()）
// 把默认从 small 降级为 base；后来管线已加 dispose 释放逻辑（见 resetPipeline），
// 重建/降级不再累积 WASM 内存，且 base 对航空通话（呼号、指令）识别质量太差
// （"AFR668 report KG" 识成 "There from 668 killer golf"），故恢复 small 为默认、
// base 作为加载/推理失败时的兜底（base 文件同样保留在 public/models/ 下）。
//
// 模型文件不打走网络：已随应用放在 public/models/onnx-community/ 下
// （构建时复制进 dist，dev 由 vite 直接伺服），离线/受限网络也能用。
// 如需重新下载，用 scripts 或手动从 https://hf-mirror.com/onnx-community/whisper-small.en
// 下载同名文件（config/tokenizer 等 json + onnx/encoder_model_quantized.onnx +
// onnx/decoder_model_merged_quantized.onnx）覆盖即可。

import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

// 只从应用自带的本地路径加载模型，不访问 HuggingFace（用户网络不可达）。
// 注意：浏览器环境下 transformers.js 默认 allowLocalModels=false，必须显式开启。
env.allowLocalModels = true;
env.allowRemoteModels = false;
// 以站点根路径为基准（dev 与构建产物均在 /models/ 下提供；不能用相对路径，
// worker 脚本在 dev 下位于 /src/lib/、构建后位于 /assets/，相对解析会指错目录）
env.localModelPath = self.location.origin + '/models/';
const MODEL_ID = 'onnx-community/whisper-small.en';
// small 加载/推理失败时的回退模型（文件同样随应用自带）
const FALLBACK_MODEL_ID = 'onnx-community/whisper-base.en';

interface TranscribeRequest {
  type: 'transcribe';
  id: number;
  audio: Float32Array;
}

interface PreloadRequest {
  type: 'preload';
  id: number;
}

type WorkerRequest = TranscribeRequest | PreloadRequest;

let asrPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let asrModelId: string | null = null;

/** 加载（并缓存）指定模型的 ASR 管线；失败时清空缓存允许重试 */
function loadPipeline(modelId: string): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!asrPromise || asrModelId !== modelId) {
    // 切换/重建前先释放旧实例（见 resetPipeline）
    resetPipeline();
    asrModelId = modelId;
    asrPromise = createPipeline(modelId);
    asrPromise.catch(() => { asrPromise = null; });
  }
  return asrPromise;
}

/** 丢弃缓存的管线并释放 WASM 内存。
 *  不 dispose 的话，重试/降级每次新建管线都会在 WASM 堆上累积几百MB
 *  （small q8 ~250MB + base q8 ~145MB），最终 Can't create a session / OOM。 */
function resetPipeline(): void {
  const prev = asrPromise;
  asrPromise = null;
  prev?.then((asr) => asr.dispose?.()).catch(() => { /* 加载失败的实例无需释放 */ });
}

/**
 * 带重试与降级的转写：
 * 1) 首选 whisper-small.en，失败（如长页面内存紧张导致 WASM Aborted）后重建管线重试一次；
 * 2) 仍失败则降级 whisper-base.en 再试（同样重建重试一次）。
 * 实测 base 在干净浏览器环境中可正常推理，失败多为长寿命页面内存压力所致，
 * 重建管线（重新分配 WASM 内存）通常即可恢复。
 */
async function transcribeWithRetry(audio: Float32Array): Promise<string> {
  const run = async (asr: AutomaticSpeechRecognitionPipeline) => {
    // 注意：whisper-*.en 为纯英文模型，不允许传 language/task 参数（多语言模型才需要）。
    const output = await asr(audio);
    return Array.isArray(output)
      ? output.map((o) => o.text).join(' ').trim()
      : (output.text ?? '').trim();
  };
  let lastErr: unknown;
  for (const modelId of [MODEL_ID, FALLBACK_MODEL_ID]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const asr = await loadPipeline(modelId);
        return await run(asr);
      } catch (err) {
        lastErr = err;
        console.error(`[whisper] ${modelId} 转写失败（第 ${attempt + 1} 次）:`, err);
        resetPipeline();
      }
    }
    self.postMessage({ type: 'progress', status: 'fallback', file: FALLBACK_MODEL_ID, progress: null });
  }
  throw lastErr;
}

function createPipeline(modelId: string): Promise<AutomaticSpeechRecognitionPipeline> {
  return pipeline('automatic-speech-recognition', modelId, {
    dtype: 'q8',
    // 上报模型分片下载/加载进度（progress 为 0-100）
    progress_callback: (p: { status: string; file?: string; progress?: number }) => {
      self.postMessage({
        type: 'progress',
        status: p.status,
        file: p.file,
        progress: typeof p.progress === 'number' ? Math.round(p.progress) : null,
      });
    },
  }) as unknown as Promise<AutomaticSpeechRecognitionPipeline>;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'preload') {
      await loadPipeline(MODEL_ID);
      self.postMessage({ type: 'ready', id: msg.id });
      return;
    }
    // audio 为 16000Hz 单声道 Float32Array（主线程已完成解码与重采样）。
    const text = await transcribeWithRetry(msg.audio);
    self.postMessage({ type: 'result', id: msg.id, text });
  } catch (err) {
    console.error('[whisper] 转写失败:', err);
    // WASM 运行时的 C++ 异常会以纯数字（异常指针）抛出，没有可读 message，
    // 给用户补充可操作提示（刷新页面释放内存后重试）。
    const message = err instanceof Error
      ? err.message
      : `${String(err)}（浏览器 WASM 运行时异常，请刷新页面后重试）`;
    self.postMessage({ type: 'error', id: msg.id, message });
  }
};
