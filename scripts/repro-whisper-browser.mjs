// 无头 Edge + 原始 CDP 复现浏览器端 Whisper 转写。
// 前提：vite preview 在 4173 端口伺服 dist。
// 用法：node scripts/repro-whisper-browser.mjs [workerAssetPath]
//   workerAssetPath 默认取 dist/assets/ 下最新的 whisperWorker-*.js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP_URL = 'http://localhost:4173/';
const CDP_PORT = 9222;

const assets = fs.readdirSync('dist/assets').filter((f) => f.startsWith('whisperWorker-') && f.endsWith('.js'));
assets.sort((a, b) => fs.statSync(path.join('dist/assets', b)).mtimeMs - fs.statSync(path.join('dist/assets', a)).mtimeMs);
const workerPath = process.argv[2] || `/assets/${assets[0]}`;
const audioSec = Number(process.argv[3]) || 5;
console.log('worker asset:', workerPath);

const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  '--no-first-run', '--user-data-dir=' + path.join(process.cwd(), '.tmp-transcribe/edge-profile'),
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { edge.kill(); } catch {} });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 等 CDP 就绪
let targets = null;
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  try {
    targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json();
    if (targets.length) break;
  } catch { /* not ready */ }
}
if (!targets?.length) { console.error('CDP 未就绪'); process.exit(1); }

const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    console.log(`[console.${msg.params.type}]`, text.slice(0, 500));
  } else if (msg.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', JSON.stringify(msg.params.exceptionDetails).slice(0, 800));
  }
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: APP_URL });
await sleep(3000);

const testExpr = `(() => {
  return new Promise((resolve) => {
    const w = new Worker('${workerPath}', { type: 'module' });
    const timer = setTimeout(() => resolve('TIMEOUT 240s'), 240000);
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') return; // 加载进度，忽略
      clearTimeout(timer);
      resolve(JSON.stringify(m).slice(0, 1000));
    };
    w.onerror = (e) => { clearTimeout(timer); resolve('WORKER ERROR: ' + e.message); };
    const sr = 16000;
    const audio = new Float32Array(sr * ${audioSec});
    for (let i = 0; i < audio.length; i++) audio[i] = 0.3 * Math.sin(2 * Math.PI * 440 * i / sr);
    w.postMessage({ type: 'transcribe', id: 1, audio });
  });
})()`;

const res = await send('Runtime.evaluate', {
  expression: testExpr,
  awaitPromise: true,
  timeout: 250000,
});
console.log('RESULT:', res.result?.value ?? JSON.stringify(res).slice(0, 500));
edge.kill();
process.exit(0);
