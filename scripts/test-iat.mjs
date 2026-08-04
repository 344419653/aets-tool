// 验证讯飞 IAT（流式语音听写）是否已开通：用 server/ise-config.local.json 的密钥
// 连接 wss://iat-api.xfyun.cn/v2/iat，发送 .tmp-transcribe/test_16k.pcm 并打印识别结果。
// 用法：node scripts/test-iat.mjs [pcm文件]
import crypto from 'node:crypto';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync('server/ise-config.local.json', 'utf8'));
const pcm = fs.readFileSync(process.argv[2] || '.tmp-transcribe/test_16k.pcm');

const HOST = 'iat-api.xfyun.cn';
const PATH = '/v2/iat';
const date = new Date().toUTCString();
const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`;
const signature = crypto.createHmac('sha256', cfg.API_SECRET).update(signatureOrigin).digest('base64');
const authOrigin = `api_key="${cfg.API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
const url = `wss://${HOST}${PATH}?authorization=${encodeURIComponent(Buffer.from(authOrigin).toString('base64'))}&date=${encodeURIComponent(date)}&host=${HOST}`;

const ws = new WebSocket(url);
let text = '';
const timer = setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 60000);

ws.onopen = () => {
  ws.send(JSON.stringify({
    common: { app_id: cfg.APP_ID },
    business: { language: 'en_us', domain: 'iat', accent: 'mandarin', vad_eos: 3000, ptt: 1 },
    data: { status: 0, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' },
  }));
  let offset = 0, first = true;
  const sendNext = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (offset >= pcm.length) {
      ws.send(JSON.stringify({ data: { status: 2, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' } }));
      return;
    }
    const chunk = pcm.subarray(offset, offset + 1280);
    offset += 1280;
    ws.send(JSON.stringify({
      data: { status: first ? 0 : 1, format: 'audio/L16;rate=16000', encoding: 'raw', audio: chunk.toString('base64') },
    }));
    first = false;
    setTimeout(sendNext, 40);
  };
  sendNext();
};

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.code !== 0) {
    console.error(`IAT 报错 code=${msg.code}: ${msg.message}`);
    clearTimeout(timer);
    process.exit(1);
  }
  const r = msg.data?.result;
  if (r?.ws) {
    for (const wsItem of r.ws) for (const cw of wsItem.cw) text += cw.w;
  }
  if (msg.data?.status === 2) {
    console.log('识别结果:', text);
    clearTimeout(timer);
    process.exit(0);
  }
};
ws.onerror = (e) => { console.error('WS 连接失败', e.message ?? ''); clearTimeout(timer); process.exit(1); };
