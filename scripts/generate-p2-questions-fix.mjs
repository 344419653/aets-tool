// 重新生成 Part 2 残缺的问题音频（原文件只有 "Question N" 报号或说到一半被截断）。
// 涉及 exchange02_q1、exchange03_q2、exchange07_q1~q3、exchange11_q1~q3、exchange20_q1~q3。
// 输出临时 mp3 到 .tmp-transcribe/p2_fix/，随后用 PyAV 转码为 m4a 覆盖正式文件。
// 运行：node scripts/generate-p2-questions-fix.mjs
//
// edge TTS 实现复用 generate-part1-qnum.mjs 的 Sec-MS-GEC 方案。
import { WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', '.tmp-transcribe', 'p2_fix');

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

function tts(text, { voice = process.env.P2_VOICE || 'en-US-AriaNeural', rate = '-5%', pitch = '+0Hz', volume = '+0%' } = {}) {
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

// 题面与 questionsPart2ShortAnswer.ts 中对应 text 一致，呼号/航路点改写为可朗读形式
// （JAL→Japan Airlines、CCA→Air China、DA→Delta Alpha、AFR→Air France），报号沿用 "Question N" 前缀
// 规范：航班号数字部分必须逐位按航空读法拼读（0 zero,1 one,2 two,3 tree,4 four,5 five,
// 6 six,7 seven,8 eight,9 niner），禁止让 TTS 把数字当整数读——生成前逐条检查此项
const items = [
  ['p2_002_q1', 'Question one. Why did Japan Airlines tree tree six request radar vector?'],
  ['p2_003_q2', 'Question two. How should the arriving aircraft, Air China eight two one tree, make the approach initially?'],
  ['p2_007_q1', 'Question one. What happened to Air China two zero five according to the passage?'],
  ['p2_007_q2', 'Question two. Why did the controller ask Air China two zero five to hold over Delta Alpha?'],
  ['p2_007_q3', 'Question three. Why did the pilot ask to descend to a lower level?'],
  ['p2_011_q1', 'Question one. What urgency situation did TWA one tree six encounter?'],
  ['p2_011_q2', 'Question two. What did the controller do when TWA one tree six made the urgent call?'],
  ['p2_011_q3', 'Question three. What assistances did TWA one tree six ask for?'],
  ['p2_020_q1', 'Question one. Why did the controller issue the missed approach to Japan Airlines seven eight five?'],
  ['p2_020_q2', 'Question two. What information about windshear did the controller get from the pilots of Japan Airlines seven eight five?'],
  ['p2_020_q3', 'Question three. What warning did the pilot of Japan Airlines seven eight five obtain when they encountered windshear?'],
  ['p2_015_q1', 'Question one. Why is the aircraft cleared for immediate takeoff?'],
  ['p2_015_q2', 'Question two. What action did Air France tree one tree take during takeoff?'],
  ['p2_015_q3', 'Question three. How will Air France tree one tree leave the runway?'],
  ['p2_015_q4', 'Question four. What service does the crew request?'],
  // 第三批：语音顶到文件末尾、尾音被切（词级时间戳确认末词结束距文件尾 <50ms）
  ['p2_009_q1', 'Question one. What problem did Scandinavia niner niner seven have?'],
  ['p2_009_q3', 'Question three. Why did the controller ask Scandinavia niner niner seven to check their altimeter?'],
  ['p2_018_q2', 'Question two. Why is the aircraft instructed to hold short of Echo four?'],
  // 第四批（期望末词比对法查出）：005_q1 缺 "according to the passage"、005_q2 缺
  // "was cleared to approach"、014_q1 语音顶到文件末尾、019_q2 报号错且多出短语
  ['p2_005_q1', 'Question one. What happened to China Southern tree tree four tree according to the passage?'],
  ['p2_005_q2', 'Question two. What was the RVR value when China Southern tree tree four tree was cleared to approach?'],
  ['p2_014_q1', 'Question one. Where is Air France two one tree when it contacts the tower initially?'],
  ['p2_019_q2', 'Question two. What is the minimum safe altitude?'],
  // exchange16 第2题报号错念成 Question 3
  ['p2_016_q2', 'Question two. Why do the flight crew request radar vectors?'],
  // exchange08 第一批修复时呼号仍是数字读法，一并改为逐位拼读；Bravo 5 → Bravo five
  ['p2_008_q1', 'Question one. What happened to Singapore two two tree according to the passage?'],
  ['p2_008_q2', 'Question two. Why did the controller ask Singapore two two tree to vacate runway quickly?'],
  ['p2_008_q3', "Question three. Why didn't the pilot take Bravo five to vacate the runway?"],
];

// 可用前缀参数只生成一部分，如：node scripts/generate-p2-questions-fix.mjs p2_015
// 语音可用环境变量 P2_VOICE 覆盖（默认 en-US-AriaNeural 女声）
// 样本模式：node scripts/generate-p2-questions-fix.mjs --sample en-US-GuyNeural
//   在 .tmp-transcribe/p2_fix/ 下生成 sample_<语音名>.mp3，供试听挑选音色
if (process.argv[2] === '--sample') {
  const voice = process.argv[3];
  if (!voice) throw new Error('用法：--sample <语音名>');
  fs.mkdirSync(outDir, { recursive: true });
  const buf = await tts('Question two. What action did Air France tree one tree take during takeoff?', { voice });
  const file = path.join(outDir, `sample_${voice}.mp3`);
  fs.writeFileSync(file, buf);
  console.log(`Generated ${file} (${(buf.length / 1024).toFixed(1)} KB)`);
  process.exit(0);
}

const prefix = process.argv[2];
const selected = prefix ? items.filter(([name]) => name.startsWith(prefix)) : items;

fs.mkdirSync(outDir, { recursive: true });
for (const [name, text] of selected) {
  const file = path.join(outDir, `${name}.mp3`);
  const buf = await tts(text);
  if (buf.length === 0) throw new Error(`${name} 合成结果为空`);
  fs.writeFileSync(file, buf);
  console.log(`Generated ${name}.mp3 (${(buf.length / 1024).toFixed(1)} KB)`);
}
