// 重新生成 Part 2 exchange08 的三条问题音频（原文件只有 "Question" 报号、没有问题内容）。
// 输出临时 mp3 到 .tmp-transcribe/p2_008_fix/，随后用 PyAV 转码为 m4a 覆盖正式文件。
// 运行：node scripts/generate-p2-008-questions.mjs
//
// edge TTS 实现复用 generate-part1-qnum.mjs 的 Sec-MS-GEC 方案。
import { WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', '.tmp-transcribe', 'p2_008_fix');

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600;
const CHROMIUM_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR = CHROMIUM_VERSION.split('.')[0];
const WS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
  + `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

const uuid = () => randomUUID().replaceAll('-', '');

/** Sec-MS-GEC：按5分钟取整的 Windows file time 与 token 拼接后取 SHA256 */
function generateSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH;
  ticks -= ticks % 300;
  const strToHash = `${ticks * 1e7}${TRUSTED_CLIENT_TOKEN}`;
  return createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function tts(text, { voice = 'en-US-AriaNeural', rate = '-5%', pitch = '+0Hz', volume = '+0%' } = {}) {
  return new Promise((resolve, reject) => {
    const url = `${WS_URL}&Sec-MS-GEC=${generateSecMsGec()}&Sec-MS-GEC-Version=1-${CHROMIUM_VERSION}&ConnectionId=${uuid()}`;
    const ws = new WebSocket(url, {
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Cookie': `muid=${createHash('sha256').update(uuid()).digest('hex').slice(0, 32).toUpperCase()};`,
      },
    });
    const audioData = [];
    ws.on('message', (rawData, isBinary) => {
      if (!isBinary) {
        if (rawData.toString('utf8').includes('turn.end')) {
          resolve(Buffer.concat(audioData));
          ws.close();
        }
        return;
      }
      const separator = 'Path:audio\r\n';
      audioData.push(rawData.subarray(rawData.indexOf(separator) + separator.length));
    });
    ws.on('error', reject);

    const speechConfig = JSON.stringify({ context: { synthesis: { audio: {
      metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    } } } });
    const configMessage = `X-Timestamp:${Date()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`;
    ws.on('open', () => ws.send(configMessage, { compress: true }, (configError) => {
      if (configError) reject(configError);
      const ssmlMessage = `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\n`
        + `X-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n`
        + `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>`
        + `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>`
        + `${text}</prosody></voice></speak>`;
      ws.send(ssmlMessage, { compress: true }, (ssmlError) => {
        if (ssmlError) reject(ssmlError);
      });
    }));
  });
}

// 题面与 questionsPart2ShortAnswer.ts 中 exchange08 的 text 一致，呼号改写为可朗读形式
const items = [
  ['p2_008_q1', 'Question one. What happened to Singapore 223 according to the passage?'],
  ['p2_008_q2', 'Question two. Why did the controller ask Singapore 223 to vacate runway quickly?'],
  ['p2_008_q3', "Question three. Why didn't the pilot take Bravo 5 to vacate the runway?"],
];

fs.mkdirSync(outDir, { recursive: true });
for (const [name, text] of items) {
  const file = path.join(outDir, `${name}.mp3`);
  const buf = await tts(text);
  if (buf.length === 0) throw new Error(`${name} 合成结果为空`);
  fs.writeFileSync(file, buf);
  console.log(`Generated ${file} (${(buf.length / 1024).toFixed(1)} KB)`);
}
