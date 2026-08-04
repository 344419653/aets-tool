# AGENTS.md

## 项目概述

这是一个 **AETS（管制员英语测试）模拟考试 Web 应用**，前端为纯前端单页应用（SPA），无远端后端；另有一个**可选的本地讯飞 ISE 评测代理**（`server/ise-proxy.mjs`，`npm run server` 启动，默认端口 8787，密钥填在 `server/ise-config.local.json`，前端经 vite proxy `/api` 调用），仅用于 Part 2 的发音维度评测，不启动代理时应用照常可用（发音维度保持手动评分）。考生按五个部分依次完成考试，部分环节使用浏览器麦克风录音：

- **Part 1 听力理解**（Q1–Q15）：从 10 套题库（`src/data/part1_bank/`）按 slot 分层随机组卷（Q1–Q5 抽 5 组、Q6–Q8 抽 1 组、Q9–Q12 抽 1 组、Q13–Q15 抽 1 组）。组卷约束（`generatePart1Exam`）：整套 15 题无完全重复题目；Q1–Q5 的 5 组场景类别互不相同，Q6–Q8 / Q9–Q12 / Q13–Q15 三组之间场景类别也互不相同；场景类别由 `classifyScenario` 按对话关键词推断（offset / emergency / traffic / takeoff / landing / arrival / taxi / ground-service），多次重试仍不满足时才放宽场景约束。题号按**新卷序号 1–15** 动态生成：界面题号与答案 key 均用新卷序号（`Part1Screen.tsx` 的 `getExamQNo`），语音题号由 `assets/audio/part1_qnum/q1–15.mp3` 播报，题库问题音频自带的旧 "Question N" 前缀在播放时经静音检测自动跳过（`findPrefixEnd`，检测不到则回退完整播放）。每题带 `explanation` 中文解析字段（引用对话原文说明答案依据）；思考倒计时（5 秒）结束未作答自动跳题并计入"已答"，单独测试第一部分的结果页（`ResultScreen.tsx`）展示全部 15 题的题目原文、可折叠对话原文、选项对错高亮与该解析。
- **Part 2 故事复述**：听故事独白（两遍）后录音复述。题库 42 个故事（`src/data/questionsPart3Story.ts`），参考内容（英文原文 `transcript`、中文梗概 `outline`、5 个中英对照关键词 `keywords`）存放在 `src/data/part3StoryContent.ts`（Story 1–42 已全部录入；25–42 出自根目录《story+retelling上传版（25-42）.docx》，该文档个别标号写错：Story 5/6/8/9 实为 29/30/32/33）。提交录音后进入**评分报告页**：回放录音、关键词覆盖勾选自查（自动联动"关键词覆盖"维度评分）、按 AETS 评分维度（内容完整性/关键词覆盖/流利度/语法词汇/发音，各 1-5 分）自评或教员打分，全部评完后自动生成得分点/扣分点/改进建议，评分结果存于 `StoryTellingResult.assessment`。录音停止后两路异步并行：本地 Whisper 转写（自动预评内容/关键词/流利度等维度）；若故事有英文原文则同时经本地代理调**讯飞 ISE 语音评测**（topic 英文自由题，无脚本，`evaluateFreeSpeech`：试卷文本 = 复述指令 + 故事原文锚点），取 phoneScore 发音准确度按 `iseToFive`（0-100 分制每 20 分一档）自动预填"发音"维度，教员仍可手改；代理未启动/未配置密钥/无原文时显示温和提示、保持手动评分。内容完整性/关键词覆盖/语法词汇三维由 **DeepSeek LLM 两段式语义预评**（同 Part 3/Part 4：先 ASR 校正、再基于校正文本评分，只覆盖未手改维度，本地 `scoreStoryRetelling` 兜底，LLM 不可用时静默回退），转写卡片以 LLM 修正后文本为准，评估报告优先采用 LLM 生成的得分点/扣分点/改进建议；无英文原文的故事保持纯本地预评。URL 参数 `?story=N`（1-42）可强制指定故事，用于测试。
- **Part 3 听力简答**：听材料后用麦克风录音作答。全部题目答完后进入**评分报告页**（照搬故事复述模式）：逐题展示录音回放、语音转写（录音停止即按 questionId 启动，可重试；优先讯飞 IAT 云端听写、失败回退本地 Whisper）、题目原文与参考答案、关键词覆盖（随转写自动比对，LLM 评分到达后按语义命中更新、只读展示，"关键词覆盖"维度分随覆盖率自动给出）、5 维度 1-5 分评分与本题评估报告（得分点/扣分点/改进建议）。五个维度的预评来源：**内容完整性/关键词覆盖/语法词汇优先用 DeepSeek LLM 语义评分**（`src/lib/llmScore.ts` → `POST /api/llm/score` → `server/ise-proxy.mjs`，模型 `deepseek-chat`、关闭思考模式、temperature=0、JSON 输出；两段式：先 ASR 校正再基于校正文本评分，content/keywords 分由代理代码按覆盖列表确定性定档；只覆盖用户未手改的维度并生成针对性亮点/扣分点/建议替换报告模板文案；LLM 不可用回退本地 `scoreStoryRetelling` 词面匹配，参考文本传 `referenceAnswer`）；流利度始终由本地按语速/停顿估算；发音维度与转写并行接入**讯飞 ISE topic 英文自由题评测**（试卷文本 = 题目 + 该题 `referenceAnswer`，用 `phoneScore` 发音准确度经 `iseToFive` 预填（引擎的 `semanticAccuracy` 语义准确度为黑盒分、与 LLM 内容评分重复，已不展示），引擎判拒识（is_rejected）时提示分数仅供参考；教员仍可手改；topic 未授权（11200）/代理未启动/失败时温和提示、降级手动评分）。全部题目评完后确认提交，各题评分存于 `ShortAnswerResult.materials[].questions[].assessment`（`ShortAnswerAssessment`）。
- **Part 4 模拟通话**：扮演管制员，听飞行员通话与提示音后逐轮录音回应。每轮录音结束进入"本轮完成"界面：可回放本轮录音、进入下一轮，或**直接提交答案结束模拟通话**（跳过后续轮次）；最后一轮录完或提前结束后进入**评分报告页**（照搬听力简答模式，`Part4SimulationScreen.tsx` 的 `report` 阶段）：逐轮展示录音回放、语音转写（录音停止即按 roundIndex 启动，含 LLM 校正行）、所问的问题（Pilot 通话原文 `pilotScripts`）、背景提示音文字（prompt 指令 `context`）、参考答案（manifest prompt 段的 `reference_answer`，仅供参考）、重要信息（关键词）覆盖只读勾选（关键词数据在 `src/data/part4Keywords.ts`，由 `scripts/generate-part4-keywords.mjs` 用 DeepSeek 从 reference_answer 抽取 4–6 个关键信息点，经 `loadScenario` 合入 `SimulationRound.keywords`）、5 维度 1-5 分评分（与听力简答相同的维度与预评来源：DeepSeek LLM 按信息点命中语义预评内容/关键词/语法——即"无原稿"方式，不对照参考答案措辞；本地 `scoreStoryRetelling` 兜底并估算流利度；讯飞 ISE topic 评测预评发音——Part 4 的试卷文本 = 该轮背景提示指令 + 评测锚点（优先下一轮 pilot 回复原文，与指令同源、为主要依据；最后一轮回退 reference_answer），均只覆盖未手改维度）与本轮评估报告（得分点/扣分点/改进建议）。全部已录音轮评完后确认提交，评分存于 `SimulationResult.assessments`（按 roundIndex 索引的 `ShortAnswerAssessment`，满分 25）。
- **Part 5 OPI 口语面试**：分 warmup / levelcheck / picture / probe / winddown 五个阶段。题库为 16 套题（`src/data/opi/OPI_{n}.json`，每套 15 题，语音在 `assets/audio/part5_opi/`），组卷按**题组**抽取（`src/data/opi/index.ts` 的 `generateOPIExamSet`）：每套 15 题按原题库文档（`ICAO考试OPI完整版16套.doc`，提取文本见 `scripts/opi16_source.txt`）中 "Let's talk about... / The following questions are about..." 等连接句划分为 3~4 组，边界登记在 `GROUP_BOUNDARIES`（未登记的套题按 topic 连续段自动分组）；组卷时先随机抽一个开场组（各套第 1 组，自我介绍类），再跨套随机抽组、整组入选，恰好凑满 15 题。跨套抽题后题目用 `uid`（套号×100+题号）作为录音 key，避免不同套之间 id 冲突。组间过渡语（连接句）文本在 `src/data/opi/connectorTexts.ts`（应用与生成脚本共用），语音在 `assets/audio/part5_opi/connectors/OPI_{nn}_Q{qq}_intro.mp3`（edge TTS 生成，语音参数与题问一致，生成脚本 `scripts/generate-opi-connectors.mjs`），播放时挂在每组第一题上、在题问音频之前播放。回听界面可展开每题的英文原题与参考答案（JSON 的 `answer` 字段）。答题过程中（播放考官语音/录音阶段）可随时点"提前交卷"按钮（`handleEarlySubmit`，弹确认框、丢弃当前半截录音、0 题时拦截），仅对已完成的回答进入评分；回听后或提前交卷后进入**评分报告页**（照搬听力简答模式，`Part5OPIScreen.tsx` 的 `report` 阶段）：进入时对全部录音启动转写（每题转写完成即做本地预评，并启动该题的 DeepSeek LLM 语义评分与讯飞 ISE topic 发音评测），逐题展示录音回放、语音转写（含 LLM 校正，校正后文本优先显示，可重试）、题目卡（英文原题+中文）、参考答案卡、重要信息（关键词）覆盖只读勾选（关键词由 `extractKeywords` 从该题 `answer` 本地抽取：小写切词、去停用词、取长度≥4 的内容词按频率再按词长排序取前 5，同时用作 LLM 请求 keywords 与本地 `scoreStoryRetelling` 兜底）、5 维度 1-5 分评分（与听力简答相同的维度与预评来源：LLM 预评内容/关键词/语法、只覆盖未手改维度，本地算法兜底并估算流利度，ISE phoneScore 经 `iseToFive` 预评发音；LLM 入参 material 为 `OPI 话题：${topic}`，ISE 试卷文本 = 考官问题 + 参考答案）与本题评估报告（得分点/扣分点/改进建议，LLM 反馈优先、模板兜底，满分 25）。全部题目各维度评完后确认提交，评分存于 `OPIResult.assessments`（按 question uid 索引的 `ShortAnswerAssessment`）。

考试流程由 `src/App.tsx` 中的 `ExamPhase` 状态机驱动（`part1-listening → part2-retelling → part3-shortanswer → part4-simulation`），各阶段结果暂存在 React state 中，最终仅打印到 console（`submitAllResults` 内有 `TODO`，尚未接 API 上传）。录音通过 `navigator.mediaDevices.getUserMedia` + `MediaRecorder` 实现（见 `src/sections/Part2ShortAnswerScreen.tsx`、`Part3StoryScreen.tsx`、`Part4SimulationScreen.tsx`、`Part5OPIScreen.tsx`），因此**必须通过 HTTPS 或 localhost 访问**才能录音。

除考试流程外还有四个**本地练习辅助功能**（全部走 localStorage 持久化，录音 Blob 不持久化、只存文本/评分元数据；从首页 `StartScreen` 进入，`App.tsx` 用 `view` 态切换，不引入 react-router 路由）：

- **错题本**（`src/sections/NotebookScreen.tsx`，`src/lib/persistence/notebook.ts`，key `aets.notebook.v1`）：仅收录 Part 1 答错题。`Part1Answer` 带 `bankQNo`（题库组内题号，跨次稳定；`qNo` 是新卷序号不能作 key）与 `scenario`/`dialogueAudio`；每次 Part 1 提交后 `syncPart1Result` 自动同步——答错写入/更新（条目 key `p1:{groupId}:{bankQNo}`，同 key 覆盖、错误次数累加），答对自动移出。列表可按场景类别筛选，展开详情复用 `src/components/Part1ReviewCard.tsx`（选项对错高亮、可折叠对话原文、解析、对话音频倍速回放），支持移除与收藏。
- **收藏**（`src/sections/FavoritesScreen.tsx`，`src/lib/persistence/favorites.ts`，key `aets.favorites.v1`）：各部分粒度独立收藏，条目 key 约定 `p1:{groupId}:{bankQNo}` / `p2:{storyId}` / `p3:{questionId}` / `p4:{simulationId}:{roundIndex}` / `p5:{uid}`。入口为 `src/components/FavoriteButton.tsx` 星标（Part 1 结果页逐题、Part 2–5 各评分报告页每条目，`createdAt` 在点击时生成——lint 的 react-hooks/purity 禁止渲染期调 `Date.now()`）；收藏页按部分分 tab，Part 1 复用 Part1ReviewCard，Part 2–5 展示题目/参考文本+评分摘要并注明"录音不跨会话保存"。
- **答题进度**（`src/lib/persistence/history.ts`，key `aets.history.v1`，同 key 两个槽）：①历史记录——完整考试结束（`submitAllResults`）、单项第一部分提交、OPI 完成时各写一条 `ExamHistoryRecord`（时间、模式、各部分得分摘要，上限 50 条），首页"历史记录"区块展示最近 5 条可展开；②中断续做——**部分级快照** `ExamProgressSnapshot`（每部分 `onComplete` 后写入"已完成 N 部分+各部分结果快照"，录音 Blob 写入前剔除；流程结束或开始新考试时清除），首页检测到快照显示"继续上次考试"按钮，点击恢复结果 state 并跳到下一未完成部分；部分内逐轮恢复不做。
- **回放倍速**（`src/lib/playbackRate.ts` + `src/components/PlaybackRateButton.tsx` + `src/components/RateAudio.tsx`，key `aets.playbackRate.v1`）：全局倍速档位 [0.5,0.75,1,1.25,1.5,2]（沿用 MaterialPlayer 档位去掉 10x），变更经 `aets:playback-rate-changed` 自定义事件广播、已挂载的 RateAudio 同步更新。**仅练习/回听场景**（错题本/收藏/结果页 Part1 对话回放、Part 2–5 报告页录音回放）挂载；正式考试流程音频保持 1x 不加控件。

## 技术栈

- **Node.js 20**、**Vite 7**、**React 19**、**TypeScript ~5.9**
- **Tailwind CSS v3.4** + shadcn 主题（CSS 变量配色，`darkMode: ["class"]`）
- **shadcn/ui 组件**（50+ 个，全部在 `src/components/ui/`，基于 Radix UI），用法：`import { Button } from '@/components/ui/button'`
- `react-router` v7（`BrowserRouter` 包裹，但实际只有单页状态机，无路由页面）
- 图标用 `lucide-react`；工具函数 `cn()` 在 `src/lib/utils.ts`
- Vite 插件 `kimi-plugin-inspect-react`（开发辅助）

## 构建与常用命令

```bash
npm run dev            # 启动开发服务器（端口 3000，/api 由 vite proxy 转发到 localhost:8787）
npm run server         # 启动讯飞 ISE 评测本地代理（端口 8787；密钥在 server/ise-config.local.json，
                       # 参考 server/ise-config.example.json，该 local 文件已加入 .gitignore）
npm run check-assets   # 检查 src/assets/audio/ 下音频完整性及源码引用
npm run build          # = check-assets && tsc -b && vite build（资源检查不过则构建失败）
npm run lint           # ESLint（eslint.config.js，flat config）
npm run preview        # 预览构建产物
```

**没有测试框架**（无 Vitest/Jest/Playwright），验证方式为 `npm run lint`、`npm run build`（含 `tsc -b` 类型检查）和手动在浏览器中走考试流程。

## 目录结构

```
src/
  main.tsx               入口（StrictMode + BrowserRouter）
  App.tsx                根组件，考试阶段状态机（ExamPhase）
  App.css / index.css    样式（index.css 为全局 Tailwind + shadcn 变量）
  types/exam.ts          全部考试相关类型定义（Question、ShortAnswer*、Story*、Simulation*、OPI*、Part1*）
  sections/              各考试部分的全屏组件（Part1Screen、Part2ShortAnswerScreen、
                         Part3StoryScreen、Part4SimulationScreen、Part5OPIScreen、
                         StartScreen、ResultScreen 等）
  components/
    MaterialPlayer.tsx   听力材料播放器
    ui/                  shadcn/ui 组件（一般不要手改）
  data/                  题库数据（TS/JSON），按部分分文件；part1_bank/ 为 10 套 Part1 题
  hooks/use-mobile.ts    移动端断点 hook
  lib/utils.ts           cn() 等工具
  lib/whisperTranscribe.ts  语音转写主线程封装：优先讯飞 IAT 听写（经代理 /api/iat/transcribe），
                         失败回退本地 Whisper（默认 whisper-small.en，public/models/ 自带模型文件；
                         base 曾为避免实机 WASM 内存压力当过默认，但对航空通话识别太差，
                         管线加 dispose 释放后已恢复 small 为默认、base 降为兜底）；
                         全局串行队列（transcribeQueue）保证单任务在跑——本地 Whisper 的
                         WASM 推理并发会 Aborted() 崩溃，Part 4 报告页多轮同时转写依赖此队列；
                         Whisper 报 Aborted 时终止并重建 Worker 再重试一次（WASM 中止后
                         原 Worker 运行时不可恢复，worker 内的管线重建无效）；
                         lib/whisperWorker.ts 为 Whisper worker 实现（默认 small，失败自动重试并降级 base；
                         重试/降级前 dispose 旧管线释放 WASM 内存，否则多次重建累积 OOM
                         报 Can't create a session）；
                         lib/iseEvaluate.ts 讯飞 ISE 发音评测前端封装
                         lib/persistence/  localStorage 持久化层：notebook.ts 错题本 /
                         favorites.ts 收藏 / history.ts 历史记录+中断续做快照（均带 version 槽位，
                         JSON 损坏回退空数据）；lib/playbackRate.ts 全局回放倍速（仅练习/回听）
  assets/audio/          打包进构建的音频（mp3/m4a，约 190MB，按 part1_lib、part2shortanswer、
                         part3_lib、part4/simulation、part5 等子目录组织）
                         part1_qnum/q1–q15.mp3 为 Part1 动态题号音频（"Question one~fifteen"）
                         index.ts 显式 re-export 部分音频；大题库用 import.meta.glob 动态导入
                         audio.d.ts 声明 '*.mp3' 模块
scripts/check-assets.js  构建前音频完整性检查（空文件 / 引用缺失则阻止构建）
server/                本地讯飞代理（可选）：ise-proxy.mjs 为零依赖 node:http 脚本
                       （Node ≥22 用内置 WebSocket 客户端），按官方文档做 HMAC-SHA256 鉴权，
                       提供两组接口：
                       1) POST /api/ise/evaluate → wss://ise-api.xfyun.cn/v2/open-ise 评测，
                       支持两种题型：
                       read_chapter 英文篇章（默认，目前前端无调用方）与 topic 英文自由题
                       （Part 2 故事复述、Part 3 听力简答与 Part 4 模拟通话，请求体带 category:'topic' + question，
                       试卷文本为 '[topic]\n1. 题目\n1.1. 答案锚点'（Part 2 锚点=故事英文原文；
                       Part 3 锚点=参考答案；
                       Part 4 锚点=下一轮 pilot 回复原文，末轮回退参考答案），额外返回
                       phoneScore 发音准确度 / semanticAccuracy 语义准确度），
                       正则提取 XML 分数；topic 试卷文本发送前会清洗（字母+数字呼号如
                       AFR213 插入空格、圆括号/斜杠去空格化——Part 4 的 A/C、A/P、
                       m/s 等斜杠同样 8195），否则引擎报 48195/8195；
                       2) POST /api/iat/transcribe → wss://iat-api.xfyun.cn/v2/iat
                       流式听写（language=en_us，请求体仅需 audio: 16kHz PCM16 base64，
                       返回 {ok,text}），供前端转写优先使用（本地 Whisper 为兜底）；
                       3) POST /api/llm/score → DeepSeek chat/completions（deepseek-chat，
                       关闭思考模式，temperature=0，response_format=json_object），两段式：
                       A) ASR 校正（呼号/拼读/近音还原 → correctedTranscript，
                       前端转写卡片以校正后文本为准显示）；
                       B) 评分调用只见校正后文本（不接触原始转写，避免 ASR 杂音被当考生错误），
                       输出 covered/missed/secondaryMissed 判断、grammar 分与亮点/扣分点/建议；
                       content/keywords 两维分数由代理代码按锚点从覆盖列表确定性计算
                       （不让 LLM 直接给分——实测其对分档锚点屡次违约），
                       covered/missed 也按关键点列表归一保证恰好划分全集；
                       密钥为配置文件的 DEEPSEEK_API_KEY（可选，不配则前端回退本地预评）；
                       ise-config.local.json 为密钥配置（.gitignore 防误传）scripts/generate-part1-qnum.mjs  生成 Part1 动态题号音频（node 直接运行）；
                         内置带 Sec-MS-GEC 令牌的 edge TTS 实现（node_modules 里的
                         edge-tts@1.0.1 缺该令牌会被服务端 403 拒绝，generate-part1-directions.ts
                         同理已不可用，需重新生成时参照 qnum 脚本的做法）
scripts/generate-part1-directions.mjs  生成 Part1 考试说明朗读音频 public/part1_directions.mp3
                         （Jenny 语音、语速 -5%；复用 qnum 脚本的 Sec-MS-GEC 实现。
                         该 TTS 端点仅支持 mp3 输出，不支持 <break> 标签与
                         mstts:express-as 风格）
scripts/generate-p2-008-questions.mjs、generate-p2-questions-fix.mjs  重生成 Part 2
                         残缺的问题音频（原文件只有报号/说一半被截断/结尾尾音不全，
                         已用 faster-whisper 批量核对确认）：edge TTS 合成 mp3 后需用
                         .tmp-transcribe/venv 里的 PyAV 转码为 AAC 48kHz 立体声 m4a
                         （尾部补 0.5s 静音）覆盖正式文件；支持前缀参数只生成部分题目
scripts/generate-part4-keywords.mjs  生成 Part 4 每轮的"重要信息（关键词）"数据文件
                         src/data/part4Keywords.ts（分轮逻辑复刻 buildRoundsFromManifest，
                         用 DeepSeek 从 reference_answer 抽取 4–6 个英文关键信息点，
                         密钥读 server/ise-config.local.json，无密钥回退本地启发式；
                         内容变更时才需重跑，不属于构建流程）
scripts/test-whisper-small.mjs  用 onnxruntime-web（WASM 后端）在 Node 中验证 Whisper 量化模型
                         能否加载并推理，排查浏览器端转写失败（node 直接运行，可传模型目录）
scripts/repro-whisper-browser.mjs  无头 Edge + 原始 CDP 在真实浏览器中复现/验证 Whisper 转写
                         （需 vite preview 伺服 dist；可传 worker 路径与音频秒数）
scripts/test-iat.mjs        验证讯飞 IAT 流式听写是否开通并可用（用本地密钥转写一段测试 PCM）
scripts/sample-part4-voices.mjs  生成 Part 4 候选 TTS 语音试听样本（edge TTS，Sec-MS-GEC 方案）；
                         原 Part4 音频音色经基频实测为 pilot 男声≈110Hz / prompt 女声≈235Hz，
                         用户试听选定 pilot=en-US-ChristopherNeural、prompt=en-US-AriaNeural（语速 -5%）
scripts/fix-part4-tts.mjs   修复 Part 4 manifest tts_text 的发音错误并重生成受影响分段
                         （第一批："India'll"→"I will"、sim1 "Dragon"→"Dragon Air"、
                         "X-ray-ray Sierra"→"X-ray Romeo Sierra"；
                         第二批："meters/sec"/"m/s"→"meters per second"、
                         "WH APP/App/app"→"WU HAN Approach"、"WH TWR"→"WU HAN Tower"、
                         单独 "WH"→"WU HAN"（WHA 保持 Whiskey Hotel Alpha）；
                         第三批（对照《AETS陆空通话发音规则汇编.pdf》，限 sim2）：
                         距离逐位读（twenty/twelve/nine kilometers→two zero/one two/niner
                         kilometers）、进离场航线后缀 A 读作 arrival（KG-11A/DA-01A 的
                         "Alpha"→"arrival"）；
                         第四批（数字 ICAO 发音，规则汇编第 4 章，全部 sim）：
                         three→tree、five→fife、four→fower、nine→niner、
                         thousand→tauzend（拼写经用户两轮试听选定；seven 与 decimal
                         保持原拼写，默认发音已合规/用户认定最准）；
                         第五批（第三批规则推广到 sim3–sim5）：距离逐位读
                         （fifteen/eleven/ten kilometers→one fife/one one/one zero
                         kilometers）、进离场航线后缀 A 读作 arrival（XRS-11A/KG-11A
                         的 "Alpha"→"arrival"）；
                         第六批（用户网页试听提出，全部 sim）：连写 "WUHAN"→"WU HAN"
                         分读两词（WHA 航路点已是 Whiskey Hotel Alpha，不受影响）；
                         第七批：大写 WU 被 TTS 读成字母 W-U，"WU HAN"→"Woo Han"
                         发音拼写（whisper 复核由 "W. U. Hahn" 变为 "Wuhan" 确认生效）；
                         --dry-run 只列清单；
                         manifest 写回 part4_audio/ 与 src/assets/audio/part4_lib/ 两处），
                         配 .tmp-transcribe/convert_part4_fix.py 转码覆盖 m4a 并 faster-whisper 复核
public/                  静态资源（part1_directions.mp3 为 Part1 考试说明朗读音频，
                         silence_0.5s.mp3、concat_list.txt 为 ffmpeg 拼接清单）
part4_audio/             Part 4 模拟通话的【内容制作素材】（sim1–sim5，含 manifest.json 台词表
                         和分段 m4a），不参与构建，仅供出题/合成参考
AETS_Part4_*.md、*.zip   Part 4 出题文档与音频包（内容制作素材，不参与构建）
```

## 代码约定

- **注释和文档主要使用中文**，UI 文案中英混合（考试指令用英文原文，界面提示用中文）。新代码沿用这一惯例。
- 路径别名 `@/` 指向 `src/`（`vite.config.ts` 与 `tsconfig.json` 均已配置），导入一律用 `@/...`。
- 组件为函数组件 + hooks；状态提升集中在 `App.tsx`，各 section 通过 `onComplete(result)` 回调上报。
- 音频资源两种引入方式：
  1. 少量固定文件：在 `src/assets/audio/index.ts` 中显式 export，再从 `@/assets/audio` 导入；
  2. 题库批量文件：`import.meta.glob('@/assets/audio/<dir>/**/*.m4a', { eager: true, import: 'default' })`，键为 `/src/assets/audio/...` 绝对形式（见 `src/data/part1_bank/index.ts`、`src/data/questionsPart4Simulation.ts`）。
- **新增/替换音频后必须跑 `npm run check-assets`**（或 `npm run build`），脚本会校验 `q1`–`q15`、`dialoguePart2/3/4` 等固定引用对应的文件存在且非空。
- `tsconfig.app.json` 开启 strict；`tsc -b` 是构建的一部分，类型错误会阻止构建。
- `src/sections/` 中 `ExamScreen.tsx`、`Part2Screen.tsx`、`Part3Screen.tsx`、`Part4Screen.tsx` 是旧版（三部分制）遗留界面，当前 `App.tsx` 未引用；对应的 `src/data/questions*.ts` 部分文件同理。改动前先确认调用方。

## 安全注意事项

- 录音数据（`Blob`）只保存在内存 state 中，不落盘、不上传；接后端时注意隐私合规。
- 仓库含大量二进制音频与 zip，勿将大文件误提交到无关目录；`part4_audio/` 与根目录 zip 是内容素材而非运行依赖。
- 项目无密钥/后端配置；不要在前端代码中引入任何凭证。讯飞密钥只放 `server/ise-config.local.json`（已 gitignore），前端只经 `/api` 调本地代理。
