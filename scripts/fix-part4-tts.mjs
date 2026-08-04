// 修复 Part 4 模拟通话 tts_text 的三类发音错误并重生成受影响分段：
//   1) "India'll" → "I will"（I'll 的错误音译，读成了 ill）
//   2) sim1 "Dragon" → "Dragon Air"（HDA305 港龙呼号）
//   3) "X-ray-ray Sierra" → "X-ray Romeo Sierra"（航路点 XRS 的 R 按 ICAO 音标读 Romeo）
//   4) meters/sec、m/s → "meters per second"
//   5) "WH APP/App/app" → "WU HAN Approach"，"WH TWR" → "WU HAN Tower"
//   6) 单独 "WH" → "WU HAN"（WHA 航路点已是 Whiskey Hotel Alpha，不受影响）
//   7) sim2 距离逐位读：twenty/twelve/nine kilometers → two zero/one two/niner kilometers
//   8) sim2 进离场航线后缀 A 读作 arrival：KG-11A/DA-01A 的 "Alpha" → "arrival"
//   9) sim3–5 距离逐位读：fifteen/eleven/ten kilometers → one fife/one one/one zero kilometers
//  10) sim3–5 进离场航线后缀 A 读作 arrival：XRS-11A/KG-11A 的 "Alpha" → "arrival"
//  11) 连写 "WUHAN" → "WU HAN"（WH 须分读两词；WHA 航路点已是 Whiskey Hotel Alpha，不受影响）
//  12) "WU HAN" → "Woo Han"（大写 WU 被 TTS 读成字母 W-U，改用发音拼写）
// manifest 修正写回 part4_audio/ 与 src/assets/audio/part4_lib/ 两处；
// 音频用 edge TTS 合成 mp3 到 .tmp-transcribe/part4_fix/，再用 .tmp-transcribe/venv 的
// PyAV 转码为 AAC 48kHz 立体声 m4a（尾部补 0.5s 静音）覆盖两处正式文件。
// 音色（用户试听选定）：pilot=en-US-ChristopherNeural，prompt=en-US-AriaNeural，语速 -5%。
//
// 运行：
//   node scripts/fix-part4-tts.mjs --dry-run   只打印受影响分段清单
//   node scripts/fix-part4-tts.mjs             修正 manifest + 合成全部受影响分段 mp3
//   python .tmp-transcribe/convert_part4_fix.py  转码覆盖 m4a 并转写复核（另附脚本）
import { WebSocket } from 'ws';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, '.tmp-transcribe', 'part4_fix');
const SIMS = ['sim1', 'sim2', 'sim3', 'sim4', 'sim5'];
const MANIFEST_DIRS = [path.join(rootDir, 'part4_audio'), path.join(rootDir, 'src', 'assets', 'audio', 'part4_lib')];
const VOICE_BY_TYPE = { pilot: 'en-US-ChristopherNeural', prompt: 'en-US-AriaNeural' };

/** 对单段 tts_text 应用三类修正；返回修正后文本（无变化返回 null） */
function fixTtsText(sim, ttsText) {
  let t = ttsText;
  t = t.replaceAll("India'll", 'I will');
  t = t.replaceAll('X-ray-ray Sierra', 'X-ray Romeo Sierra');
  if (sim === 'sim1') t = t.replace(/\bDragon\b(?! Air)/g, 'Dragon Air');
  // 第二批（用户复核提出）：
  // 4) meters/sec、m/s → meters per second
  t = t.replace(/meters\/sec|m\/s/gi, 'meters per second');
  // 5) WH APP/App/app → WU HAN Approach；WH TWR → WU HAN Tower（先复合后单独 WH）
  t = t.replace(/\bWH\s+(?:APP|App|app)\b/g, 'WU HAN Approach');
  t = t.replace(/\bWH\s+TWR\b/g, 'WU HAN Tower');
  // 6) 单独 WH → WU HAN（WHA 航路点在 tts_text 中已是 Whiskey Hotel Alpha，不受 \bWH\b 影响）
  t = t.replace(/\bWH\b/g, 'WU HAN');
  // 第三批（用户对照《AETS 陆空通话发音规则汇编》确认，限定 sim2）：
  // 7) 距离逐位读（规则 §5.1 + 表 5-17：486 km → FOW-er AIT SIX KILOMETERS）
  // 8) 进离场航线后缀 A 读作 arrival（规则 §6.4 表 6-4：VYK-01A → ...ZE-RO WUN ARRIVAL）
  if (sim === 'sim2') {
    t = t.replace('twenty kilometers', 'two zero kilometers');
    t = t.replace('twelve kilometers', 'one two kilometers');
    t = t.replace('nine kilometers', 'niner kilometers');
    t = t.replace('Kilo Golf one one Alpha', 'Kilo Golf one one arrival');
    t = t.replace('Delta Alpha zero one Alpha', 'Delta Alpha zero one arrival');
  }
  // 第四批（数字 ICAO 发音，规则汇编第 4 章；拼写经用户两轮试听选定，适用全部 sim）：
  // 3→tree（/triː/ 不咬舌尖）、5→fife（尾音 /f/）、4→fower（FOW-er 双音节）、
  // 9→niner（NIN-er 双音节）、1000→tauzend（TOU-SAND /ˈtaʊsənd/ 不发 /θ/）；
  // 7 保持 seven（本身 /ˈsevən/ 双音节首重读，合规）、小数点保持 decimal（用户试听
  // 认定默认发音最准，规则第 10 章亦列为可接受变体）。
  // 以上词在 tts_text 中仅出现于数字语境，可安全按词替换。
  // 第六批（用户网页试听提出）：连写 "WUHAN" → "WU HAN"（两个词分读；
  // WHA 航路点在 tts_text 中已是 Whiskey Hotel Alpha，不受影响）
  t = t.replace(/\bWUHAN\b/g, 'WU HAN');
  // 第七批（用户试听确认大写 WU 被读成字母 W-U）："WU HAN" → "Woo Han"
  t = t.replaceAll('WU HAN', 'Woo Han');
  // 第五批（同第三批规则，推广到 sim3–sim5）：
  // 9) 距离逐位读（规则 §5.1 表 5-17）：fifteen/eleven/ten kilometers → one fife/one one/one zero kilometers
  //    （单个数字 eight/seven/niner 不变）
  // 10) 进离场航线后缀 A 读作 arrival（规则 §6.4 表 6-4）：XRS-11A / KG-11A 的 "Alpha" → "arrival"
  if (sim === 'sim3' || sim === 'sim4' || sim === 'sim5') {
    t = t.replace('fifteen kilometers', 'one fife kilometers');
    t = t.replace('eleven kilometers', 'one one kilometers');
    t = t.replace('ten kilometers', 'one zero kilometers');
    t = t.replaceAll('X-ray Romeo Sierra one one Alpha', 'X-ray Romeo Sierra one one arrival');
    t = t.replaceAll('Kilo Golf one one Alpha', 'Kilo Golf one one arrival');
  }
  t = t.replace(/\bthree\b/g, 'tree');
  t = t.replace(/\bfive\b/g, 'fife');
  t = t.replace(/\bfour\b/g, 'fower');
  t = t.replace(/\bnine\b/g, 'niner');
  t = t.replace(/\bthousand\b/g, 'tauzend');
  return t === ttsText ? null : t;
}

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

/** 带一次重试的 TTS（edge 偶发连接挂起/无响应） */
async function tts(text, opts) {
  try {
    return await ttsOnce(text, opts);
  } catch (err) {
    console.warn(`[tts] ${opts.voice} 首次合成失败（${err.message}），重试一次…`);
    return ttsOnce(text, opts);
  }
}
// ----------------------------------------------------------------------------------------

const dryRun = process.argv.includes('--dry-run');

// 收集受影响分段并修正 manifest（两个目录同步）
const affected = []; // {sim, seg, type, file, ttsText}
for (const sim of SIMS) {
  const manifestPath = path.join(MANIFEST_DIRS[0], sim, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let changed = false;
  for (const seg of manifest) {
    const fixed = fixTtsText(sim, seg.tts_text ?? '');
    if (fixed !== null) {
      affected.push({ sim, seg: seg.seg, type: seg.type, file: seg.file, ttsText: fixed });
      seg.tts_text = fixed;
      changed = true;
    }
  }
  if (changed && !dryRun) {
    for (const dir of MANIFEST_DIRS) {
      fs.writeFileSync(path.join(dir, sim, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
  }
}

console.log(`受影响分段共 ${affected.length} 段：`);
for (const a of affected) console.log(`  ${a.sim} seg${String(a.seg).padStart(3, '0')} [${a.type}] ${a.file} -> ${a.ttsText}`);
if (dryRun) process.exit(0);

fs.mkdirSync(outDir, { recursive: true });
for (const a of affected) {
  const name = `${a.sim}_${a.file.replace(/\.m4a$/, '')}`;
  const voice = VOICE_BY_TYPE[a.type] ?? VOICE_BY_TYPE.pilot;
  const buf = await tts(a.ttsText, { voice });
  if (buf.length === 0) throw new Error(`${name} 合成结果为空`);
  fs.writeFileSync(path.join(outDir, `${name}.mp3`), buf);
  console.log(`Generated ${name}.mp3 [${voice}] (${(buf.length / 1024).toFixed(1)} KB)`);
}
console.log('mp3 全部生成于 .tmp-transcribe/part4_fix/，接下来运行 python .tmp-transcribe/convert_part4_fix.py 转码覆盖 m4a');
