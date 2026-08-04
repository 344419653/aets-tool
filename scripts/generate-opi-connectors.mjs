// 生成 Part 5 OPI 组间过渡语（连接句）音频
// 文本来源：src/data/opi/connectorTexts.ts（与应用侧共用）
// 输出到 src/assets/audio/part5_opi/connectors/OPI_{nn}_Q{qq}_intro.mp3
// 运行：node scripts/generate-opi-connectors.mjs
//
// 说明：node_modules 里的 edge-tts@1.0.1 缺少微软现在强制要求的 Sec-MS-GEC
// 动态令牌（握手返回 403）。这里按 rany2/edge-tts 的修复实现了该令牌
// （https://github.com/rany2/edge-tts/issues/290），协议本身复用其 ws 包。
// 语音参数与题问音频保持一致（见 OPI_audio_manifest.json：en-US-GuyNeural, rate -15%）。
import { WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONNECTOR_TEXTS } from '../src/data/opi/connectorTexts.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'src', 'assets', 'audio', 'part5_opi', 'connectors');

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

function tts(text, { voice = 'en-US-GuyNeural', rate = '-15%', pitch = '+0Hz', volume = '+0%' } = {}) {
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

const pad2 = (n) => n.toString().padStart(2, '0');

fs.mkdirSync(outDir, { recursive: true });
let count = 0;
for (const [setNum, groups] of Object.entries(CONNECTOR_TEXTS)) {
  for (const [firstQid, text] of Object.entries(groups)) {
    const file = path.join(outDir, `OPI_${pad2(Number(setNum))}_Q${pad2(Number(firstQid))}_intro.mp3`);
    const buf = await tts(text);
    if (buf.length === 0) throw new Error(`${file} 合成结果为空`);
    fs.writeFileSync(file, buf);
    count++;
    console.log(`Generated ${path.basename(file)} (${(buf.length / 1024).toFixed(1)} KB)  "${text}"`);
  }
}
console.log(`共生成 ${count} 条过渡语音频`);
