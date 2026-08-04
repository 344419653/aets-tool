// 在真实应用页面内复现 Whisper 转写（React 应用完全加载后，连续转写 2 段 10s 音频），
// 抓取 worker 全部 console 输出，定位 OOM/Aborted 发生在哪个模型、哪一次尝试。
// 前提：vite preview 在 4173 端口伺服 dist。
// 用法：node scripts/repro-whisper-inapp.mjs [audioSec]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP_URL = 'http://localhost:4173/';
const CDP_PORT = 9223;

const assets = fs.readdirSync('dist/assets').filter((f) => f.startsWith('whisperWorker-') && f.endsWith('.js'));
assets.sort((a, b) => fs.statSync(path.join('dist/assets', b)).mtimeMs - fs.statSync(path.join('dist/assets', a)).mtimeMs);
const workerPath = `/assets/${assets[0]}`;
const audioSec = Number(process.argv[2]) || 10;
console.log('worker asset:', workerPath, 'audioSec:', audioSec);

const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  '--no-first-run', '--user-data-dir=' + path.join(process.cwd(), '.tmp-transcribe/edge-profile-inapp'),
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { edge.kill(); } catch {} });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    console.log(`[console.${msg.params.type}]`, text.slice(0, 600));
  } else if (msg.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', JSON.stringify(msg.params.exceptionDetails).slice(0, 800));
  }
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: APP_URL });
await sleep(8000); // 等 React 应用完整加载（题库等）

// 页面内存基线
const mem0 = await send('Runtime.evaluate', {
  expression: `performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576)+'MB / '+Math.round(performance.memory.jsHeapSizeLimit/1048576)+'MB' : 'n/a'`,
});
console.log('页面内存基线:', mem0.result?.value);

const testExpr = `(async () => {
  const sr = 16000;
  const mkAudio = () => {
    const a = new Float32Array(sr * ${audioSec});
    for (let i = 0; i < a.length; i++) a[i] = 0.3 * Math.sin(2 * Math.PI * 440 * i / sr);
    return a;
  };
  const runOnce = (id) => new Promise((resolve) => {
    const w = new Worker('${workerPath}', { type: 'module' });
    const timer = setTimeout(() => resolve('TIMEOUT 240s'), 240000);
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') return;
      clearTimeout(timer);
      w.terminate();
      resolve(JSON.stringify(m).slice(0, 500));
    };
    w.onerror = (e) => { clearTimeout(timer); resolve('WORKER ERROR: ' + e.message); };
    w.postMessage({ type: 'transcribe', id, audio: mkAudio() });
  });
  const r1 = await runOnce(1);
  const r2 = await runOnce(2);
  return 'R1: ' + r1 + '\\nR2: ' + r2;
})()`;

const res = await send('Runtime.evaluate', {
  expression: testExpr,
  awaitPromise: true,
  timeout: 500000,
});
console.log('RESULT:', res.result?.value ?? JSON.stringify(res).slice(0, 800));
edge.kill();
process.exit(0);
