// 生成"数字 ICAO 发音"候选拼写试听样本（为按《AETS陆空通话发音规则汇编》第 4 章
// 改造 tts_text 做准备）。规则要求：3→TREE、5→FIFE、9→NIN-er、4→FOW-er、
// 7→SEV-en、1000→TOU-SAND、小数点→DAY-SEE-MAL。
// 每个数字给出"普通拼写对照"与若干候选拼写，用 pilot（Christopher）与
// prompt（Aria）两个音色各合成一遍，用户试听选定可用的拼写后再批量改造。
// 运行：node scripts/sample-digit-pron.mjs
// 输出：.tmp-transcribe/digit_samples/{voice}_{key}.mp3
import { WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', '.tmp-transcribe', 'digit_samples');

const VOICES = ['en-US-ChristopherNeural', 'en-US-AriaNeural'];

// [key, 合成文本]；同组第一个为普通拼写对照（control）
// 第二轮：1000/dec 的首轮拼写候选（tousand/touzand/tou-sand、day-see-mal/desemal）
// 用户试听全部否决，换 /aʊ/="ow/aw" 系拼法并增加 SSML phoneme（IPA 直注）方案。
const CASES = [
  ['1000_towsend', 'niner towsend eight hundred meters'],
  ['1000_tawsund', 'niner tawsund eight hundred meters'],
  ['1000_towsund', 'niner towsund eight hundred meters'],
  ['1000_tauzend', 'niner tauzend eight hundred meters'],
  ['dec_dessy-mahl', 'contact tower on one two four dessy-mahl tree fife'],
  ['dec_deh-si-mahl', 'contact tower on one two four deh-si-mahl tree fife'],
  ['dec_desi-mol', 'contact tower on one two four desi-mol tree fife'],
  ['dec_dessi-moll', 'contact tower on one two four dessi-moll tree fife'],
];

// ---------- edge TTS（Sec-MS-GEC 方案，与 sample-part4-voices.mjs 相同） ----------
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600;
const CHROMIUM_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR = CHROMIUM_VERSION.split('.')[0];
const WS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
  + `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const uuid = () => randomUUID().replaceAll('-', '');

function generateSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH;
  ticks -= ticks % 300;
  const strToHash = `${ticks * 1e7}${TRUSTED_CLIENT_TOKEN}`;
  return createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function ttsOnce(text, { voice, rate = '-5%', pitch = '+0Hz', volume = '+0%' }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error(`${voice} 合成超时`));
    }, 30000);
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
          clearTimeout(timer);
          resolve(Buffer.concat(audioData));
          ws.close();
        }
        return;
      }
      const separator = 'Path:audio\r\n';
      audioData.push(rawData.subarray(rawData.indexOf(separator) + separator.length));
    });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });

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
// ----------------------------------------------------------------------------------------

async function tts(text, opts) {
  try {
    return await ttsOnce(text, opts);
  } catch (err) {
    console.warn(`[tts] ${opts.voice} 首次合成失败（${err.message}），重试一次…`);
    return ttsOnce(text, opts);
  }
}

fs.mkdirSync(outDir, { recursive: true });
for (const voice of VOICES) {
  const vname = voice.replace('en-US-', '').replace('Neural', '');
  for (const [key, text] of CASES) {
    const file = path.join(outDir, `${vname}_${key}.mp3`);
    const buf = await tts(text, { voice });
    if (buf.length === 0) throw new Error(`${voice} ${key} 合成结果为空`);
    fs.writeFileSync(file, buf);
    console.log(`Generated ${path.basename(file)} (${(buf.length / 1024).toFixed(1)} KB)  "${text}"`);
  }
}
console.log('\n试听目录：.tmp-transcribe/digit_samples/');
