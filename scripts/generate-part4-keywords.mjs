// 为 Part 4 模拟通话每轮生成"重要信息（关键词）"数据，输出 src/data/part4Keywords.ts。
// 分轮逻辑复刻 src/data/questionsPart4Simulation.ts 的 buildRoundsFromManifest
// （连续 pilot 段累积、遇 prompt 段成轮、无 pilot 的轮丢弃），保证 roundIndex 与运行时一致。
// 关键词由 DeepSeek（deepseek-v4-flash，JSON 输出）从 reference_answer 抽取 4–6 个英文
// 关键信息点；密钥读 server/ise-config.local.json 的 DEEPSEEK_API_KEY，
// 无密钥时回退本地启发式（呼号 + 数字/大写词提取）。
//
// 运行：node scripts/generate-part4-keywords.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const SIMS = ['sim1', 'sim2', 'sim3', 'sim4', 'sim5'];
const OUT_FILE = path.join(rootDir, 'src', 'data', 'part4Keywords.ts');

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
let deepseekKey = '';
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(rootDir, 'server', 'ise-config.local.json'), 'utf8'));
  deepseekKey = String(cfg.DEEPSEEK_API_KEY ?? '').trim();
} catch { /* 无配置文件则用启发式 */ }
console.log(deepseekKey ? '使用 DeepSeek 生成关键词' : '⚠ 未找到 DEEPSEEK_API_KEY，回退本地启发式提取');

/** 复刻 buildRoundsFromManifest 的分轮逻辑（只保留文本字段） */
function buildRounds(manifest) {
  const rounds = [];
  let pilotScripts = [];
  for (const seg of manifest) {
    if (seg.type === 'pilot') {
      pilotScripts.push(seg.text);
    } else if (seg.type === 'prompt') {
      if (pilotScripts.length === 0) continue; // 无 pilot 的轮丢弃
      rounds.push({
        roundIndex: rounds.length + 1,
        pilotScript: pilotScripts.join(' '),
        context: seg.text,
        referenceAnswer: seg.reference_answer || '',
      });
      pilotScripts = [];
    }
  }
  return rounds;
}

/** 本地启发式：呼号 + 数字/大写词 + 关键词汇 */
function heuristicKeywords(round) {
  const text = round.referenceAnswer;
  const kws = new Set();
  // 呼号（如 CCA101、CES7721、HDA305）
  for (const m of text.matchAll(/\b[A-Z]{3}\d{2,4}\b/g)) kws.add(m[0]);
  // 数字信息（高度/航向/频率/跑道等）
  for (const m of text.matchAll(/\b\d[\d.,]*\b/g)) kws.add(m[0]);
  // 大写缩写词（跑道/航路点/单位，如 ZF、ILS、QNH、36R）
  for (const m of text.matchAll(/\b[A-Z]{2,}\d*[A-Z]?\b/g)) {
    if (!/^[A-Z]{3}\d/.test(m[0])) kws.add(m[0]);
  }
  // 关键指令动词短语（常见管制用语）
  for (const m of text.matchAll(/\b(radar contact|maintain|descend|climb|hold|report|contact|cleared|reduce speed|taxi|vacate|squawk|established)\b[^,.;]*/gi)) {
    kws.add(m[0].trim());
  }
  return [...kws].slice(0, 8);
}

/** DeepSeek 抽取 4–6 个英文关键信息点 */
async function llmKeywords(round) {
  const resp = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      thinking: { type: 'disabled' },
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content:
          '你是 AETS（管制员英语测试）模拟通话部分的出题专家。给你一轮通话中管制员应回答的' +
          '参考答案（reference answer）和背景指令，请抽取考生回答中必须覆盖的 4–6 个英文' +
          '关键信息点（关键词/短语），用于"关键词覆盖"评分。要求：' +
          '优先呼号、数值（高度/航向/速度/频率/跑道号）、关键指令动作；' +
          '每个信息点用简短英文短语（1-4 个词），保持参考答案中的原始写法（如呼号 CCA101、频率 118.9）；' +
          '不要抽取礼貌性套话。只输出 JSON：{"keywords":["...","..."]}。' },
        { role: 'user', content:
          `飞行员通话：${round.pilotScript}\n背景指令：${round.context}\n` +
          `参考答案：${round.referenceAnswer}` },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok) throw new Error(`DeepSeek HTTP ${resp.status}`);
  const data = await resp.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  const kws = Array.isArray(parsed.keywords) ? parsed.keywords.filter((k) => typeof k === 'string' && k.trim()) : [];
  if (kws.length === 0) throw new Error('DeepSeek 未返回关键词');
  return kws.map((k) => k.trim());
}

const result = {}; // sim -> { roundIndex -> keywords[] }
let llmCount = 0, heuristicCount = 0;
for (const sim of SIMS) {
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'part4_audio', sim, 'manifest.json'), 'utf8'));
  const rounds = buildRounds(manifest);
  result[sim] = {};
  for (const round of rounds) {
    let kws = null;
    if (deepseekKey) {
      try {
        kws = await llmKeywords(round);
        llmCount++;
      } catch (err) {
        console.warn(`  ${sim} 第${round.roundIndex}轮 LLM 失败（${err.message}），用启发式`);
      }
    }
    if (!kws) { kws = heuristicKeywords(round); heuristicCount++; }
    result[sim][round.roundIndex] = kws;
    console.log(`${sim} 第${String(round.roundIndex).padStart(2, '0')}轮 [${kws.length}个] ${kws.join(' | ')}`);
  }
}

const ts = `// 本文件由 scripts/generate-part4-keywords.mjs 生成，请勿手改。
// Part 4 模拟通话每轮的"重要信息（关键词）"，用于评分报告页的关键词覆盖检查。
// 键：场景 id（sim1–sim5）→ 轮次 roundIndex（1 起，与 SimulationRound.roundIndex 一致）。
export const PART4_KEYWORDS: Record<string, Record<number, string[]>> = ${JSON.stringify(result, null, 2)};
`;
fs.writeFileSync(OUT_FILE, ts);
console.log(`\n已写入 src/data/part4Keywords.ts（LLM ${llmCount} 轮，启发式 ${heuristicCount} 轮）`);
