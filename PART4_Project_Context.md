# Part 4 模拟通话 · Project Context

> 本文档沉淀 Part 4（模拟通话）从设计、实现到多轮迭代完善的完整上下文：技术决策、经验教训、已知坑与待办。
> 目的是把这部分验证过的经验移植到 Part 1/2/3/5 的完善工作中。
> 最后更新：2026-08（界面精简 + 两段式 LLM 评分改造完成后）。

---

## 1. 模块定位

考生扮演管制员：听 Pilot 通话 → 听背景提示音（prompt 指令）→ 录音回应 → 逐轮推进；
可随时提前提交，最后进入**评分报告页**（`report` 阶段），逐轮展示回放、转写、参考资料、
5 维度评分与评估报告。评分结果存于 `SimulationResult.assessments`
（按 roundIndex 索引的 `ShortAnswerAssessment`，满分 25）。

## 2. 技术栈

- React 19 + TypeScript（strict）+ Vite 7 + Tailwind v3 + shadcn/ui，lucide-react 图标
- 录音：`getUserMedia` + `MediaRecorder`（Blob 只存内存，不落盘）
- 语音转写：讯飞 IAT（经本地代理）优先，本地 Whisper（transformers.js v3 + Web Worker + WASM）兜底
- 发音评测：讯飞 ISE **topic 英文自由题**（经本地代理，wss + HMAC-SHA256 鉴权）
- 语义评分：DeepSeek chat/completions（经本地代理，两段式，temperature=0）
- 代理：`server/ise-proxy.mjs`（零依赖 node:http，Node ≥22 内置 WebSocket）

## 3. 相关目录与文件

```
src/sections/Part4SimulationScreen.tsx   主界面（选套→通话→逐轮录音→评分报告状态机）
src/data/questionsPart4Simulation.ts     manifest 分轮逻辑（buildRoundsFromManifest）、loadScenario
src/data/part4Keywords.ts                每轮关键词（离线生成，静态）
src/types/exam.ts                        SimulationRound / SimulationResult / ShortAnswerAssessment
src/lib/llmScore.ts                      DeepSeek 评分前端封装（/api/llm/score，70s 超时）
src/lib/iseEvaluate.ts                   ISE topic 评测前端封装（含空响应防护）
src/lib/whisperTranscribe.ts             转写主线程封装（IAT 优先 + 全局串行队列 + Worker 重建重试）
src/lib/whisperWorker.ts                 Whisper worker（默认 small.en，失败降级 base.en，dispose 防 OOM）
src/lib/storyAutoScore.ts                本地预评（词面匹配 + 语速流利度，已整体上调 1 分）
server/ise-proxy.mjs                     本地代理：ISE 评测 / IAT 听写 / DeepSeek 两段式评分
src/assets/audio/part4_lib/sim1–5/       正式音频 + manifest.json（参与构建）
part4_audio/sim1–5/                      内容制作素材（不参与构建）
scripts/generate-part4-keywords.mjs      用 DeepSeek 从 reference_answer 抽 4–6 个关键信息点
scripts/fix-part4-tts.mjs                TTS 发音修正（已跑 7 批：ICAO 数字、WU HAN、arrival 后缀等）
scripts/sample-part4-voices.mjs          TTS 音色试听（pilot=Christopher、prompt=Aria，-5%）
```

## 4. 数据流（报告页一条录音的完整链路）

```
录音停止
 ├─ 转写（transcribeAudio）
 │    ├─ 讯飞 IAT（/api/iat/transcribe）── 失败回退 ─→ 本地 whisper-small.en → base.en
 │    └─ 完成后：本地预评（scoreStoryRetelling，即时打底）
 ├─ LLM 两段式评分（/api/llm/score，与转写完成事件衔接）
 │    ├─ A) ASR 校正：呼号/ICAO 拼读/近音还原 → correctedTranscript
 │    └─ B) 评分：只见校正后文本，输出 covered/missed/secondaryMissed、grammar 分、亮点/扣分点/建议
 │         → content/keywords 分数由代理代码按锚点从覆盖列表【确定性计算】
 │         → 到达后覆盖用户未手改的维度 + 更新关键词勾选 + 替换评估报告文案
 └─ ISE topic 评测（/api/ise/evaluate，与转写并行）
      试卷文本 = [topic] 1. 背景提示指令  1.1. 评测锚点（下一轮 pilot 回复原文；末轮回退 reference_answer）
      → phoneScore 经 iseToFive 预填"发音"维度（semanticAccuracy 黑盒分不展示；is_rejected 不展示）
```

关键词来源：出题时由 `generate-part4-keywords.mjs` 用 DeepSeek 从 reference_answer 抽取，静态合入
`SimulationRound.keywords`；考试中 LLM 只判覆盖、不重新抽点。

## 5. 已完成的主要工作（按阶段）

1. **基础通话流程**：manifest 分轮（pilot 段合并 + prompt 段结束一轮）、逐轮录音、提前提交。
2. **TTS 内容制作与 7 批发音修正**（fix-part4-tts.mjs）：呼号读法、m/s、WH→WU HAN→"Woo Han"、
   ICAO 数字（tree/fife/fower/niner/tauzend）、距离逐位读、航线后缀 A→arrival；faster-whisper 复核。
3. **转写链路**：IAT 优先 + 本地兜底；全局串行队列（防 WASM 并发 Aborted）；
   Aborted 后终止重建 Worker；默认模型从 base 换回 small（base 对航空通话识别太差，
   "AFR668 report KG"→"killer golf"；small 的 OOM 问题已由 dispose 修复解决）。
4. **ISE topic 接入**：试卷文本清洗（呼号插空格、括号/斜杠→空格，否则 8195/48195）；
   **评测锚点从 reference_answer 改为下一轮 pilot 回复**（与背景指令同源，更权威）。
5. **DeepSeek 语义评分 → 两段式重构**（关键转折，见第 6 节）。
6. **界面精简**（2026-08）：转写只显示校正后文本；卡片默认折叠 + 箭头展开；
   删除"自动预评依据"行、"已自动预评"提示、乱读/拒识提示、semanticAccuracy 附注。
7. **流利度**：语速定档后整体 +1（封顶 5），Part 2/3/4 共用该函数同步生效。

## 6. 关键技术决策与教训（移植时最重要的一节）

### 6.1 不要让 LLM 直接打可以程序化计算的分
提示词写"缺 1 个次要要点不扣分"这类锚点，deepseek-v4-flash 和 deepseek-chat **都屡次违约**。
教训：LLM 只做它擅长的判断（覆盖与否、语法、反馈文案），**分数由代码按锚点从判断结果确定性计算**。
covered/missed 也由代码按关键点列表归一，保证恰好划分全集。

### 6.2 校正与评分必须分两次调用
单段调用时，模型一面给出正确的校正文本，一面又把原始转写里的 ASR 杂音
（"way to contact"、"900"）当考生错误写进 grammar 和扣分点，提示词强调多轮无效。
**评分调用只给校正后文本，提示词完全不提 ASR**，该类错误彻底消失。代价是多一次调用（几秒延迟）。

### 6.3 temperature=0 + 结构化输出
评分/校正类任务 temperature=0，response_format=json_object；实测同输入三次结果完全一致。
模型选 deepseek-chat（flash 遵从度不足）。

### 6.4 领域知识必须显式写进提示词
LLM 不知道 CSN=China Southern、WHA=Whiskey Hotel Alpha、"report reaching"="report over"、
"maintain 9800m"="maintain present level"。不写出来就会误判（呼号不敢还原、惯用语被当语法错误）。
航空规则清单：呼号对照表、ICAO 拼读还原、惯用语等同表、客套语忽略、航班号达标宽容规则
（笼统指代 this aircraft 算达标；读对否以校正后为准）。

### 6.5 前端对本地代理的空响应防护
代理不可达时 vite proxy 返回 **500 空 body**，`res.json()` 抛 "Unexpected end of JSON input"——
极具误导性。所有 `/api` 调用先 `res.text()` 判空再解析，报"代理未连接"的明确中文提示。
（IAT/LLM 有静默兜底会掩盖代理宕机，ISE 没有，所以故障总在 ISE 上"显形"。）

### 6.6 讯飞引擎侧
- topic 试卷文本必须清洗：字母+数字相连（AFR213）、圆括号、斜杠（A/C、m/s）都会触发 8195。
- read_chapter 与 topic **都有 is_rejected**（静音/无效作答必触发），文档不要写"topic 无乱读检测"。
- read_chapter 适合朗读不适合复述（复述措辞偏离原文易误判乱读）。
- topic 的 semanticAccuracy 是黑盒、对陆空短句不稳定，且与 LLM 内容评分重复——不展示。

### 6.7 浏览器 WASM / Whisper
- 并发推理会 Aborted() 崩溃 → 全局串行队列。
- Aborted 后原 Worker 不可恢复 → 终止重建 Worker 再重试。
- 多次重建管线必须 dispose 旧实例，否则 WASM 内存累积 OOM（Can't create a session）。
- 模型文件随应用自带（public/models/），不走网络。

### 6.8 Node 代理进程
- 加 uncaughtException/unhandledRejection 兜底日志，崩溃不静默退出（否则前端只看到 500 空响应）。
- 关键请求打成功/失败日志，排障先看代理终端。
- 排障顺序：代理终端日志 → `/api/ise/health`（configured/llmConfigured）→ 浏览器控制台。

## 7. 已知问题（接受现状或有缓解）

1. **流利度只靠语速**（词/分钟定档 +1），不含停顿/重复分析；67wpm≈3 分，用户或嫌严，
   备选方案：阈值下移（≥100/80/60/40）。Part 2/3/4 共用同一函数，改动影响面大。
2. **ISE 拒识仍偶发**：管制员短句语域特殊，topic 引擎可能误判 is_rejected；
   目前不展示该提示、分数仅供参考。若频繁出现，备选：调整试卷文本组织方式。
3. **两段式评分延迟**：两次串行 DeepSeek 调用， worst case 接近前端 70s 超时上限（单次 30s）。
4. **whisper-small 内存压力**：用户实机曾 OOM，dispose 后未再复现；如复发会自动降级 base。
5. **语义评分剩余主观性**：grammar 与反馈文案仍由 LLM 给出，锚点只能压缩不能消除摇摆——
   所以所有预评分都可被教员手改覆盖（LLM 只覆盖未手改维度）。
6. **结果未上传**：`App.tsx` 的 `submitAllResults` 只有 console.log + TODO。

## 8. 当前进行中的修正任务

- 无未完成的代码任务。最近一轮（界面精简 + 两段式评分）已 tsc/eslint 验证通过。
- 用户实机回归验证中：重启 `pnpm server` 后测 LLM 评分新链路、报告页新界面。

## 9. 待办事项（移植候选 & 产品 backlog）

- [ ] **Part 3 移植核对**：两段式评分、界面精简已随共用代码同步生效，需实机回归一遍。
- [ ] **Part 2 故事复述接入两段式 LLM 评分**（目前只有本地词面预评，无 LLM 校正/语义评分）；
      注意 read_chapter 乱读误判问题（可考虑换 topic 题型或忽略 is_rejected）。
- [ ] Part 1：解析/报告页可复用"卡片折叠 + 箭头"的精简样式。
- [ ] Part 5 OPI：如需自动评分，可直接复用 `/api/llm/score` 两段式链路（无 referenceAnswer 时需调整要点来源）。
- [ ] 流利度算法升级（停顿/重复感知），或按用户反馈下调语速档。
- [ ] `submitAllResults` 接后端上传（含隐私合规：录音不落盘不上传原则需同步设计）。
- [ ] manifest/reference_answer 变更后需重跑 `generate-part4-keywords.mjs` 同步关键词。

## 10. 运维速查

```bash
npm run dev        # 3000 端口，/api 代理到 8787
npm run server     # 8787 代理（必须单独终端！改 server/ise-proxy.mjs 后需重启）
curl http://localhost:8787/api/ise/health   # {"ok":true,"configured":true,"llmConfigured":true}
```

- 两个进程必须各占一个终端；向跑着 dev 的终端输入命令不会执行（真实踩过）。
- 关键词/提示词/模型改动都在代理进程内，**改后必须重启 `pnpm server`**；前端改动 vite 热更新即可。
- 构建前 `npm run check-assets` 会校验音频引用（`npm run build` 已包含）。
