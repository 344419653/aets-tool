// 生成 Part 4 候选语音试听样本（为修复 tts_text 三类发音错误做准备）。
// 原音频基频实测：pilot 段 ≈110Hz（男声）、prompt 段 ≈235Hz（女声），
// 故候选分两组；每组用 sim1 seg001(pilot)/seg002(prompt) 的原始 tts_text 各合成一句，
// 用户对照 part4_audio/sim1/seg001_pilot.m4a、seg002_prompt.m4a 试听选最接近的音色。
// 运行：node scripts/sample-part4-voices.mjs [语音名...]（缺省用内置候选列表）
import { WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', '.tmp-transcribe', 'part4_voice_samples');

// 与原分段完全相同的文本（part4_audio/sim1/manifest.json seg1/seg2 的 tts_text）
const PILOT_TEXT = 'WUHAN CONTROL, Air China one zero one, from BEIJING to GUANGZHOU, nine thousand two hundred meters on standard, NOW passing Oblik zero niner zero zero, estimating Zulu Foxtrot zero niner one five.';
const PROMPT_TEXT = 'Inform Air China one zero one that you have seen the aircraft on the radar, and instruct to continue present level, and call you when over Zulu Foxtrot.';

const MALE_VOICES = ['en-US-GuyNeural', 'en-US-ChristopherNeural', 'en-US-EricNeural', 'en-US-DavisNeural', 'en-US-BrianNeural'];
const FEMALE_VOICES = ['en-US-AriaNeural', 'en-US-JennyNeural', 'en-US-MichelleNeural', 'en-US-AnaNeural'];

// ---------- edge TTS（Sec-MS-GEC 方案，与 generate-p2-questions-fix.mjs 相同） ----------
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

/** 带一次重试的 TTS（edge 偶发连接挂起/无响应） */
async function tts(text, opts) {
  try {
    return await ttsOnce(text, opts);
  } catch (err) {
    console.warn(`[tts] ${opts.voice} 首次合成失败（${err.message}），重试一次…`);
    return ttsOnce(text, opts);
  }
}

const custom = process.argv.slice(2);
const jobs = custom.length
  ? custom.map((v) => FEMALE_VOICES.includes(v) ? [v, PROMPT_TEXT, 'prompt'] : [v, PILOT_TEXT, 'pilot'])
  : [...MALE_VOICES.map((v) => [v, PILOT_TEXT, 'pilot']), ...FEMALE_VOICES.map((v) => [v, PROMPT_TEXT, 'prompt'])];

fs.mkdirSync(outDir, { recursive: true });
for (const [voice, text, role] of jobs) {
  const suffix = role ?? 'sample';
  const file = path.join(outDir, `${voice.replace('en-US-', '')}_${suffix}.mp3`);
  const buf = await tts(text, { voice });
  if (buf.length === 0) throw new Error(`${voice} 合成结果为空`);
  fs.writeFileSync(file, buf);
  console.log(`Generated ${path.basename(file)} (${(buf.length / 1024).toFixed(1)} KB)`);
}
console.log('\n对照试听：原始音频 part4_audio/sim1/seg001_pilot.m4a（男声）、seg002_prompt.m4a（女声）');
