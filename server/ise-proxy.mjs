// 讯飞 ISE 语音评测（流式版）本地代理。
// 前端不持有密钥：浏览器把参考文本 + 16kHz PCM16 音频 POST 到本服务，
// 本服务做 HMAC-SHA256 鉴权后经 wss://ise-api.xfyun.cn/v2/open-ise 评测
// （支持两种题型：read_chapter 英文篇章 / topic 英文自由题，由请求体 category 指定，默认 read_chapter），
// 把 XML 结果解析为 JSON 分数返回。
// 协议细节以官方文档为准：https://www.xfyun.cn/doc/Ise/IseAPI.html
//
// 用法：node server/ise-proxy.mjs（或 npm run server），密钥填在 server/ise-config.local.json。
// 零依赖：使用 Node >= 22 内置的全局 WebSocket 客户端。

import http from 'node:http';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ISE_PROXY_PORT) || 8787;
const ISE_HOST = 'ise-api.xfyun.cn';
const ISE_PATH = '/v2/open-ise';
const IAT_HOST = 'iat-api.xfyun.cn';
const IAT_PATH = '/v2/iat';
// 单帧音频字节数与发送间隔：官方建议 PCM 每 40ms 发 1280B
const FRAME_BYTES = 1280;
const FRAME_INTERVAL_MS = 40;
// 单次评测整体超时（含建连、传音频、等结果）
const EVAL_TIMEOUT_MS = 120000;

/** 读取密钥配置；文件不存在或字段为空视为未配置 */
function loadConfig() {
  const file = path.join(__dirname, 'ise-config.local.json');
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cfg = {
      appId: String(raw.APP_ID ?? '').trim(),
      apiKey: String(raw.API_KEY ?? '').trim(),
      apiSecret: String(raw.API_SECRET ?? '').trim(),
      deepseekKey: String(raw.DEEPSEEK_API_KEY ?? '').trim(),
    };
    cfg.configured = !!(cfg.appId && cfg.apiKey && cfg.apiSecret);
    cfg.llmConfigured = !!cfg.deepseekKey;
    return cfg;
  } catch {
    return { appId: '', apiKey: '', apiSecret: '', deepseekKey: '', configured: false, llmConfigured: false };
  }
}

const config = loadConfig();

/** 按官方鉴权规则生成带 authorization/date/host 参数的 wss URL（ISE 与 IAT 通用） */
function buildAuthUrl(host = ISE_HOST, path = ISE_PATH) {
  const date = new Date().toUTCString(); // RFC1123 GMT
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto
    .createHmac('sha256', config.apiSecret)
    .update(signatureOrigin)
    .digest('base64');
  const authOrigin =
    `api_key="${config.apiKey}", algorithm="hmac-sha256", ` +
    `headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authOrigin, 'utf8').toString('base64');
  return (
    `wss://${host}${path}?authorization=${encodeURIComponent(authorization)}` +
    `&date=${encodeURIComponent(date)}&host=${host}`
  );
}

/** 从评测结果 XML 中提取分数：真正的分数在 rec_paper 内层的题型节点上，
 *  外层同名节点只是引擎版本信息，所以遍历所有候选节点，取第一个带 total_score 的。
 *  topic（英文自由题）的分数同样在 rec_paper 节点上，额外有 phone_score（发音准确度）
 *  与 accuracy_score（语义准确度）。 */
function parseScores(xml) {
  const nodes = xml.match(/<(read_chapter|rec_paper|topic)\b[^>]*>/gi) ?? [];
  const attr = (node, name) => {
    const m = node.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
    return m ? Number(m[1]) : undefined;
  };
  const node = nodes.find((n) => attr(n, 'total_score') !== undefined);
  if (!node) return null;
  const scores = {
    total: attr(node, 'total_score'),
    accuracy: attr(node, 'accuracy_score'),
    fluency: attr(node, 'fluency_score'),
    integrity: attr(node, 'integrity_score'),
    standard: attr(node, 'standard_score'),
    // topic 题型专有：发音准确度 / 语义准确度
    phoneScore: attr(node, 'phone_score'),
    semanticAccuracy: attr(node, 'accuracy_score'),
    isRejected: /is_rejected\s*=\s*"true"/i.test(node) || undefined,
    exceptInfo: attr(node, 'except_info'),
  };
  return scores;
}

/** 尝试按 gzip 解压；不是 gzip 则按原文返回（rstcd=utf8 时服务端可能直接返回明文 XML） */
function decodeResultPayload(b64) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return zlib.gunzipSync(buf).toString('utf8');
  }
  return buf.toString('utf8');
}

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const LLM_TIMEOUT_MS = 60000;

/** 调 DeepSeek chat/completions 并解析 JSON 输出（temperature=0 保证稳定） */
async function callDeepseekJson(systemPrompt, userPrompt, timeoutMs = 30000) {
  const resp = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.deepseekKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat', // v4-flash 对长规则提示词遵从度不足，用正式版
      thinking: { type: 'disabled' },
      temperature: 0, // 评分/校正任务不需要创造性，0 温度保证同输入结果一致
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`DeepSeek API 响应异常（HTTP ${resp.status}）`);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('DeepSeek 返回的不是合法 JSON: ' + String(content).slice(0, 200));
  }
}

/**
 * 第一段：ASR 校正。只负责把转写文本还原成考生实际所说的文本，不做任何评分。
 * 独立成一次调用，避免评分阶段看到原始转写里的 ASR 杂音而被带偏
 * （实测单段调用时模型反复把已校正的误识当成考生错误扣分）。
 */
async function correctTranscriptWithLlm(p) {
  const systemPrompt =
    '你是陆空通话的语音识别（ASR）校正器。给你题目、参考答案和一段考生回答的 ASR 转写文本，' +
    '你的唯一任务是输出考生实际所说的校正文本，不评分、不评论。校正规则：' +
    '1) 近音误识：ASR 常听错单词收尾音（stall→storm、life→live）。若转写与题目/参考答案的差异' +
    '仅为个别发音相近的词（相差一两个音素），按参考答案中的词校正；发音差异明显的词不得硬往参考答案上靠。' +
    '2) 明显乱码结合语境还原（如主语 "Htc" 实为 ATC）。' +
    '3) 航班呼号：题目/参考答案中的呼号为三字码+航班号（如 CSN4580、AFR668），口述用航空公司呼名' +
    '（CSN=China Southern、CCA=Air China、CES=China Eastern、AFR=Air France、CSH=Shanghai Airlines），' +
    'ASR 常整体听错（"China Southern 4580"→"China 74580"）。凡"公司名/国名+数字串"形态的词组，' +
    '一律按题目/参考答案中的呼号校正为三字码形式（CSN4580）。' +
    '4) ICAO 拼读词（alpha、whiskey、hotel 等）是字母口述：题目/参考答案含字母代码（WHA、KG、TM 等）时，' +
    '连续拼读词组校正为代码本身（"whiskey hotel offer/alpha"→WHA，"kilo golf"→KG）；' +
    '拼读尾词被听成普通词（offer、over、alfa）时优先按拼读校正。' +
    '5) 除上述规则外保持原文，不润色、不补全考生没说出的内容。' +
    '只输出 JSON：{"corrected":"校正后的完整英文文本（无需校正时原样返回转写）"}。';
  const userPrompt =
    `题目：${p.question}\n参考答案：${p.referenceAnswer}\n` +
    (p.material ? `听力材料原文：${p.material}\n` : '') +
    `ASR 转写：${p.transcript || '（空）'}`;
  const r = await callDeepseekJson(systemPrompt, userPrompt);
  return String(r.corrected ?? '').trim();
}

/**
 * 调用 DeepSeek 按 AETS 评分维度给听力简答的回答打分（两段式）：
 * A) correctTranscriptWithLlm 先把 ASR 转写校正为考生实际表达；
 * B) 评分调用只见到校正后文本（不知道原始转写长什么样），输出覆盖判断、语法评分与反馈；
 * content/keywords 两个维度的分数由本函数按锚点从 covered/missed/secondaryMissed 列表
 * 确定性计算（不让 LLM 直接给分——实测它对"缺 1 个次要要点不扣分"这类锚点屡次违约）。
 * @param {{question: string, referenceAnswer: string, keywords: string[],
 *          transcript: string, material?: string}} p
 * @returns {Promise<object>} 结构化评分 JSON（与前端 LlmScoreResult 对应）
 */
async function scoreWithLlm(p) {
  const keywords = (p.keywords ?? []).map(String);
  const rawTranscript = String(p.transcript ?? '').trim();
  let corrected = '';
  try {
    corrected = await correctTranscriptWithLlm(p);
  } catch {
    corrected = ''; // 校正失败不阻塞评分：退回原始转写
  }
  const answerText = corrected || rawTranscript;

  // --- 第二段：评分（输入只有校正后文本，提示词不含任何 ASR 话题） ---
  const systemPrompt =
    '你是 AETS（管制员英语测试）听力简答部分的资深考官。考生听完陆空通话后口头作答，' +
    '你拿到的"考生回答"文本已经是最终定稿，直接视为考生真实表达，逐项完成以下判断：' +
    '1) 覆盖判断：对照关键信息点列表，逐条判定考生是否答到（同义表达视为答到），' +
    '输出 covered（答到的）与 missed（没答到的），两者合起来必须恰好等于关键点全集。' +
    '航班号特殊规则：读出完整航班号且与题目一致=答到；读错=没答到；' +
    '未读航班号但用 this flight、the aircraft、we 等笼统指代代替=也算答到（在 keywordsReason 注明）。' +
    '2) 次要要点：参考答案中有信息价值但不在关键点列表里的细节（含管制单位自报，如 WUHAN CONTROL 自呼）' +
    '为次要要点；客套语（good day、thank you 等）不算要点。列出考生遗漏的次要要点 secondaryMissed。' +
    '3) 语法词汇评分（1-5）：几乎无错误、用语规范=5；个别小错不妨碍理解=4；多处错误但意思可辨=3；' +
    '错误严重影响理解=2；支离破碎=1。注意以下为标准陆空通话用语，不算错误，不得列入 issues：' +
    '"report reaching + 航路点/位置"（等同 report over）、"maintain + 高度数值"（等同 maintain present level）、' +
    '高度/航向/速度等数值的具体化表达。符合这些用语且无其他错误的回答评 5 分。' +
    '4) 反馈：strengths/weaknesses/suggestions 各 1-3 条，基于考生回答文本撰写，要具体、针对本题；' +
    '回答中已说到的内容不得写成"未明确/建议补充"，没说到的才可作为不足。' +
    '只输出 JSON：{"covered":["..."],"missed":["..."],"secondaryMissed":["..."],"keywordsReason":"中文一句话",' +
    '"grammar":{"score":N,"issues":["中文描述"],"reason":"中文一句话"},' +
    '"strengths":["..."],"weaknesses":["..."],"suggestions":["..."]}。';
  const userPrompt =
    `题目：${p.question}\n参考答案（要点示例）：${p.referenceAnswer}\n` +
    `关键信息点：${keywords.join('；') || '（无）'}\n` +
    (p.material ? `听力材料原文：${p.material}\n` : '') +
    `考生回答：${answerText || '（空）'}`;
  const r = await callDeepseekJson(systemPrompt, userPrompt);

  // --- 代码确定性归一与定分 ---
  // covered/missed 以关键点列表为准归一（防止 LLM 漏列/多列/改名导致两边对不上）
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const coveredLlm = new Set((Array.isArray(r.covered) ? r.covered : []).map(norm));
  const covered = keywords.filter((k) => coveredLlm.has(norm(k)));
  const missed = keywords.filter((k) => !coveredLlm.has(norm(k)));
  const secondaryMissed = Array.isArray(r.secondaryMissed) ? r.secondaryMissed.map(String) : [];

  // keywords 分：按覆盖率定档（全覆盖=5，≥75%=4，≥50%=3，≥25%=2，<25%=1；
  // 关键点不足 4 个时缺 1 个降一档）
  let keywordsScore;
  if (keywords.length === 0) {
    keywordsScore = null; // 无关键点数据，该维度留给调用方
  } else if (keywords.length < 4) {
    keywordsScore = Math.max(1, 5 - missed.length);
  } else {
    const ratio = covered.length / keywords.length;
    keywordsScore = ratio >= 1 ? 5 : ratio >= 0.75 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;
  }

  // content 分：缺 1 个核心=3、缺 2 个=2、全缺=1；核心全齐时缺 0-1 个次要=5、缺 2 个=4、缺 ≥3 个=3
  let contentScore;
  let contentReason;
  if (keywords.length > 0 && covered.length === 0) {
    contentScore = 1;
    contentReason = '未答到任何关键信息点。';
  } else if (missed.length === 1) {
    contentScore = 3;
    contentReason = `遗漏核心要点：${missed[0]}。`;
  } else if (missed.length >= 2) {
    contentScore = 2;
    contentReason = `遗漏 ${missed.length} 个核心要点：${missed.join('、')}。`;
  } else if (secondaryMissed.length <= 1) {
    contentScore = 5;
    contentReason = secondaryMissed.length === 0
      ? '核心与次要要点全覆盖，紧扣题目。'
      : `核心要点全覆盖；次要要点仅遗漏 1 个（${secondaryMissed[0]}），不扣分。`;
  } else if (secondaryMissed.length === 2) {
    contentScore = 4;
    contentReason = `核心要点全覆盖；遗漏 2 个次要要点：${secondaryMissed.join('、')}。`;
  } else {
    contentScore = 3;
    contentReason = `核心要点全覆盖；遗漏 ${secondaryMissed.length} 个次要要点：${secondaryMissed.join('、')}。`;
  }

  const clamp = (n) => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) && v >= 1 && v <= 5 ? v : null;
  };
  return {
    content: { score: contentScore, reason: contentReason },
    keywords: {
      score: keywordsScore,
      covered,
      missed,
      reason: String(r.keywordsReason ?? ''),
    },
    grammar: {
      score: clamp(r.grammar?.score) ?? 3,
      issues: Array.isArray(r.grammar?.issues) ? r.grammar.issues.map(String) : [],
      reason: String(r.grammar?.reason ?? ''),
    },
    strengths: Array.isArray(r.strengths) ? r.strengths.map(String) : [],
    weaknesses: Array.isArray(r.weaknesses) ? r.weaknesses.map(String) : [],
    suggestions: Array.isArray(r.suggestions) ? r.suggestions.map(String) : [],
    correctedTranscript: corrected && corrected !== rawTranscript ? corrected : '',
  };
}

/**
 * 调用讯飞 IAT（流式语音听写）转写一段 16kHz PCM16 单声道音频。
 * 英文识别（language=en_us），返回拼接后的识别文本。
 * 不使用 wpgs 动态修正：每段结果按 sn 顺序直接拼接即为最终文本，逻辑最简。
 * @param {Buffer} pcm PCM16 原始字节
 * @returns {Promise<string>}
 */
function transcribeWithIat(pcm) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { ws?.close(); } catch { /* ignore */ }
      reject(new Error('讯飞听写超时'));
    }, EVAL_TIMEOUT_MS);

    let ws = null;
    try {
      ws = new WebSocket(buildAuthUrl(IAT_HOST, IAT_PATH));
    } catch (err) {
      clearTimeout(timer);
      reject(err);
      return;
    }

    let settled = false;
    let text = '';
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error(msg));
    };
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(text.trim());
    };

    ws.onerror = () => fail('连接讯飞 IAT 失败（请检查密钥、服务开通情况与网络）');
    ws.onclose = (ev) => {
      if (!settled) fail(`讯飞 IAT 连接提前关闭（code=${ev.code}）`);
    };

    ws.onopen = () => {
      // 音频上传：每 40ms 一帧 1280B，status=0 首帧（带 business 参数）/ 1 中间帧 / 2 末帧
      let offset = 0;
      let first = true;
      const sendNext = () => {
        if (settled || ws.readyState !== WebSocket.OPEN) return;
        if (offset >= pcm.length) {
          ws.send(JSON.stringify({
            data: { status: 2, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' },
          }));
          return;
        }
        const chunk = pcm.subarray(offset, offset + FRAME_BYTES);
        offset += FRAME_BYTES;
        ws.send(JSON.stringify({
          ...(first ? {
            common: { app_id: config.appId },
            business: { language: 'en_us', domain: 'iat', accent: 'mandarin', vad_eos: 3000, ptt: 1 },
          } : {}),
          data: {
            status: first ? 0 : 1,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: chunk.toString('base64'),
          },
        }));
        first = false;
        setTimeout(sendNext, FRAME_INTERVAL_MS);
      };
      sendNext();
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      } catch {
        return; // 忽略无法解析的帧
      }
      if (msg.code !== 0) {
        fail(`讯飞听写报错 ${msg.code}: ${msg.message ?? ''}`);
        return;
      }
      const r = msg.data?.result;
      if (r?.ws) {
        for (const wsItem of r.ws) for (const cw of wsItem.cw) text += cw.w;
      }
      if (msg.data?.status === 2) done();
    };
  });
}

/**
 * 调用讯飞 ISE 评测一段 16kHz PCM16 单声道音频。
 * @param {Buffer} pcm PCM16 原始字节
 * @param {string} refText 参考原文（read_chapter：英文篇章；topic：参考答案）
 * @param {{category?: string, question?: string}} [opts]
 *        category 默认 read_chapter（英文篇章）；传 'topic' 为英文自由题，
 *        此时 question 为题目文本，试卷文本按官方 topic 格式拼装。
 * @returns {Promise<{scores: object, xml: string}>}
 */
function evaluateWithIse(pcm, refText, opts = {}) {
  const category = opts.category === 'topic' ? 'topic' : 'read_chapter';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { ws?.close(); } catch { /* ignore */ }
      reject(new Error('讯飞评测超时'));
    }, EVAL_TIMEOUT_MS);

    let ws = null;
    try {
      ws = new WebSocket(buildAuthUrl());
    } catch (err) {
      clearTimeout(timer);
      reject(err);
      return;
    }

    let settled = false;
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error(msg));
    };
    const done = (scores, xml) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve({ scores, xml });
    };

    ws.onerror = () => fail('连接讯飞 ISE 失败（请检查密钥与网络）');
    ws.onclose = (ev) => {
      if (!settled) fail(`讯飞连接提前关闭（code=${ev.code}）`);
    };

    ws.onopen = () => {
      // 首帧：参数上传阶段（cmd=ssb, data.status=0）。
      // 英文篇章题型的试卷文本必须带 [content] 节点标记与 utf8 BOM；
      // 英文自由题（topic）按官方格式：'﻿[topic]\n1. 题目\n1.1. 参考答案'。
      // 注意：text 直接传明文（官方 demo 如此），不要 base64，否则引擎把 base64 串当试卷文本导致 48195。
      // 讯飞 topic 引擎的试卷文本解析器不接受三类内容，均报 48195
      // seeRec.SRecWrite error::ISEInputAppend error, ret=8195：
      // 1) 字母与数字直接相连的呼号类词（如 AFR213、CCA101）——在字母与数字间插入空格规避；
      // 2) 圆括号（如 "(suspected bird ingestion)"）——替换为空格规避；
      // 3) 斜杠（Part 4 的 A/C、A/P、m/s、meters/sec 等，实测全部 8195）——替换为空格规避。
      // 清洗只影响 topic 试卷文本，语义不变，评测不受影响。
      const sanitizeTopicText = (s) => s
        .replace(/[()\/]/g, ' ')
        .replace(/([A-Za-z])(?=\d)/g, '$1 ')
        .replace(/ {2,}/g, ' ')
        .trim();
      const examText = category === 'topic'
        ? '﻿[topic]\n1. ' + sanitizeTopicText(opts.question ?? '') + '\n1.1. ' + sanitizeTopicText(refText) // 开头 ﻿ 为 BOM
        : '﻿[content]\n' + refText; // 开头 ﻿ 为 BOM：官方要求试卷文本带 utf8 BOM，且英文篇章题型须含 [content] 节点
      ws.send(JSON.stringify({
        common: { app_id: config.appId },
        business: {
          sub: 'ise',
          ent: 'en_vip',
          category,
          cmd: 'ssb',
          text: examText,
          tte: 'utf-8',
          ttp_skip: true,
          aue: 'raw',
          auf: 'audio/L16;rate=16000',
          rstcd: 'utf8',
          rst: 'entirety',
          ise_unite: '1',
          extra_ability: 'multi_dimension',
        },
        data: { status: 0 },
      }));

      // 音频上传阶段：每 40ms 一帧 1280B，aus=1 首帧 / 2 中间帧 / 4 末帧
      let offset = 0;
      let first = true;
      const sendNext = () => {
        if (settled || ws.readyState !== WebSocket.OPEN) return;
        if (offset >= pcm.length) {
          // 末帧：空音频 + status=2, aus=4
          ws.send(JSON.stringify({
            common: { app_id: config.appId },
            business: { cmd: 'auw', aus: 4, aue: 'raw' },
            data: { status: 2, data: '' },
          }));
          return;
        }
        const chunk = pcm.subarray(offset, offset + FRAME_BYTES);
        offset += FRAME_BYTES;
        const isLast = offset >= pcm.length;
        ws.send(JSON.stringify({
          common: { app_id: config.appId },
          business: { cmd: 'auw', aus: first ? 1 : 2, aue: 'raw' },
          data: { status: 1, data: chunk.toString('base64') },
        }));
        first = false;
        setTimeout(sendNext, isLast ? 0 : FRAME_INTERVAL_MS);
      };
      sendNext();
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      } catch {
        return; // 忽略无法解析的帧
      }
      if (msg.code !== 0) {
        fail(`讯飞评测报错 ${msg.code}: ${msg.message ?? ''}`);
        return;
      }
      const d = msg.data;
      if (!d || d.status !== 2 || !d.data) return; // 中间帧，继续等
      try {
        const xml = decodeResultPayload(d.data);
        const scores = parseScores(xml);
        if (!scores) {
          fail('评测结果中未找到分数字段，原始XML: ' + xml.slice(0, 500));
          return;
        }
        done(scores, xml);
      } catch (err) {
        fail(`解析评测结果失败: ${err instanceof Error ? err.message : err}`);
      }
    };
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      // 5 分钟 16k PCM16 约 19MB，base64 后约 26MB；留余量限 64MB
      if (size > 64 * 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 任何未捕获异常都不要让进程静默退出：打印日志并保持服务可用，
// 否则前端只会看到 vite proxy 的 500 空响应（"Unexpected end of JSON input"），无法定位。
process.on('uncaughtException', (err) => {
  console.error('[ise-proxy] 未捕获异常:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[ise-proxy] 未处理的 Promise 拒绝:', err);
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === 'GET' && req.url === '/api/ise/health') {
    sendJson(res, 200, { ok: true, configured: config.configured, llmConfigured: config.llmConfigured });
    return;
  }
  const isIse = req.url?.startsWith('/api/ise/evaluate');
  const isIat = req.url?.startsWith('/api/iat/transcribe');
  const isLlm = req.url?.startsWith('/api/llm/score');
  if (req.method !== 'POST' || (!isIse && !isIat && !isLlm)) {
    sendJson(res, 404, { ok: false, error: 'Not Found' });
    return;
  }

  if (isLlm) {
    // LLM 评分：只需要文本字段与 DeepSeek key，不要求讯飞密钥
    if (!config.llmConfigured) {
      sendJson(res, 200, {
        ok: false,
        error: '未配置 DeepSeek 密钥：请在 server/ise-config.local.json 中填入 DEEPSEEK_API_KEY 后重启本服务',
      });
      return;
    }
    let llmBody;
    try {
      llmBody = JSON.parse((await readBody(req)).toString('utf8'));
    } catch {
      sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' });
      return;
    }
    try {
      const result = await scoreWithLlm({
        question: String(llmBody?.question ?? ''),
        referenceAnswer: String(llmBody?.referenceAnswer ?? ''),
        keywords: Array.isArray(llmBody?.keywords) ? llmBody.keywords.map(String) : [],
        transcript: String(llmBody?.transcript ?? ''),
        material: llmBody?.material ? String(llmBody.material) : undefined,
      });
      sendJson(res, 200, { ok: true, result });
    } catch (err) {
      sendJson(res, 200, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (!config.configured) {
    sendJson(res, 200, {
      ok: false,
      error: '未配置讯飞密钥：请在 server/ise-config.local.json 中填入 APP_ID / API_KEY / API_SECRET 后重启本服务',
    });
    return;
  }

  let body;
  try {
    body = JSON.parse((await readBody(req)).toString('utf8'));
  } catch {
    sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' });
    return;
  }
  const audioB64 = String(body?.audio ?? '');
  if (isIat) {
    // IAT 听写：只需 audio（16kHz PCM16 base64），返回识别文本
    const pcm = Buffer.from(audioB64, 'base64');
    if (pcm.length === 0) {
      sendJson(res, 400, { ok: false, error: '缺少 audio 字段或音频数据为空' });
      return;
    }
    try {
      const iatText = await transcribeWithIat(pcm);
      sendJson(res, 200, { ok: true, text: iatText });
    } catch (err) {
      sendJson(res, 200, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  const text = String(body?.text ?? '').trim();
  // 可选：topic 英文自由题（默认 read_chapter，故事复述链路不受影响）
  const category = body?.category === 'topic' ? 'topic' : undefined;
  const question = String(body?.question ?? '').trim();
  if (!text || !audioB64) {
    sendJson(res, 400, { ok: false, error: '缺少 text 或 audio 字段' });
    return;
  }
  if (category === 'topic' && !question) {
    sendJson(res, 400, { ok: false, error: 'topic 题型缺少 question 字段' });
    return;
  }
  const pcm = Buffer.from(audioB64, 'base64');
  if (pcm.length === 0) {
    sendJson(res, 400, { ok: false, error: '音频数据为空' });
    return;
  }

  try {
    const { scores, xml } = await evaluateWithIse(pcm, text, { category, question });
    console.log(`[ise-proxy] ISE 评测完成（${category ?? 'read_chapter'}，${(pcm.length / 32000).toFixed(1)}s 音频）`);
    sendJson(res, 200, { ok: true, scores, xml });
  } catch (err) {
    console.error('[ise-proxy] ISE 评测失败:', err instanceof Error ? err.message : err);
    sendJson(res, 200, {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

server.listen(PORT, () => {
  console.log(`[ise-proxy] 讯飞 ISE 评测代理已启动: http://localhost:${PORT}`);
  console.log(`[ise-proxy] 密钥配置: ${config.configured ? '已加载' : '未配置（server/ise-config.local.json）'}`);
});
