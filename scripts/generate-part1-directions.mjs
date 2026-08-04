// 生成 Part 1 考试说明朗读音频：public/part1_directions.mp3
// 运行：node scripts/generate-part1-directions.mjs
//
// 说明：node_modules 里的 edge-tts@1.0.1 缺少微软现在强制要求的 Sec-MS-GEC
// 动态令牌（握手返回 403），generate-part1-directions.ts 已不可用。
// 本脚本按 generate-part1-qnum.mjs 的做法实现了该令牌。
//
// 该服务端点的限制（实测）：仅支持 mp3 输出（riff/wav 报 Unsupported），
// 不支持 <break> 标签与 mstts:express-as 风格（均报 SSML is invalid），
// 因此句间停顿依靠标点，自然度通过 Jenny 语音 + 语速 -5% 优化。
import { WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(__dirname, '..', 'public', 'part1_directions.mp3');

// 与界面（Part1Screen.tsx 考试说明）和题库 JSON 的 directions 字段保持一致
const text =
  'In this part, you are going to hear a dialogue or exchange, after the exchange, there will be a question. After each question, you have 5 seconds to think and choose the correct answer. You will hear each question only once.';

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

function tts(text, { voice = 'en-US-JennyNeural', rate = '-5%', pitch = '+0Hz', volume = '+0%' } = {}) {
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
    ws.on('close', (code, reason) => {
      reject(new Error(`WebSocket closed: ${code} ${reason.toString()}`));
    });

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

const buf = await tts(text);
if (buf.length === 0) throw new Error('合成结果为空');
fs.writeFileSync(outFile, buf);
console.log(`Generated ${outFile} (${(buf.length / 1024).toFixed(1)} KB)`);
