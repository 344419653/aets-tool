// 用 onnxruntime-web（WASM 后端）在 Node 中验证 whisper-small.en 量化模型能否加载并推理，
// 用于排查浏览器端转写失败问题。用法：node scripts/test-whisper-small.mjs [模型目录]
import * as ort from 'onnxruntime-web';
import path from 'node:path';

const modelDir = process.argv[2] || 'public/models/onnx-community/whisper-small.en';
import { pathToFileURL } from 'node:url';
ort.env.wasm.wasmPaths = pathToFileURL(path.join(process.cwd(), 'node_modules/onnxruntime-web/dist')).href + '/';
ort.env.wasm.numThreads = 1;

const run = async () => {
  let enc;
  try {
    enc = await ort.InferenceSession.create(path.join(modelDir, 'onnx/encoder_model_quantized.onnx'));
    console.log('encoder loaded, inputs:', enc.inputNames, 'outputs:', enc.outputNames);
  } catch (e) {
    console.error('ENCODER LOAD FAIL:', e && e.message ? e.message : e);
    return;
  }
  try {
    const mel = new Float32Array(80 * 3000);
    const out = await enc.run({ input_features: new ort.Tensor('float32', mel, [1, 80, 3000]) });
    const first = out[enc.outputNames[0]];
    console.log('encoder run OK, output dims:', first.dims);
  } catch (e) {
    console.error('ENCODER RUN FAIL:', e && e.message ? e.message : e);
    return;
  }
  let dec;
  try {
    dec = await ort.InferenceSession.create(path.join(modelDir, 'onnx/decoder_model_merged_quantized.onnx'));
    console.log('decoder loaded, inputs:', dec.inputNames.slice(0, 5), '...');
  } catch (e) {
    console.error('DECODER LOAD FAIL:', e && e.message ? e.message : e);
    return;
  }
  // 构造最小解码输入：4 个 token + encoder 输出 + 空 KV cache
  try {
    const nLayers = 12, nHeads = 12, headDim = 64, dModel = 768, encLen = 1500;
    const feeds = {
      input_ids: new ort.Tensor('int64', BigInt64Array.from([50258n, 50259n, 50359n, 50363n]), [1, 4]),
      encoder_hidden_states: new ort.Tensor('float32', new Float32Array(dModel * encLen), [1, encLen, dModel]),
      use_cache_branch: new ort.Tensor('bool', [true], [1]),
    };
    for (let i = 0; i < nLayers; i++) {
      for (const kv of ['key', 'value']) {
        feeds[`past_key_values.${i}.decoder.${kv}`] = new ort.Tensor('float32', new Float32Array(0), [1, nHeads, 0, headDim]);
        feeds[`past_key_values.${i}.encoder.${kv}`] = new ort.Tensor('float32', new Float32Array(1 * nHeads * encLen * headDim), [1, nHeads, encLen, headDim]);
      }
    }
    const out = await dec.run(feeds);
    console.log('decoder run OK, logits dims:', out.logits.dims);
  } catch (e) {
    console.error('DECODER RUN FAIL:', e && e.message ? e.message : e);
  }
};
run();
