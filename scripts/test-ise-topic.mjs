// 测试讯飞 ISE topic 评测对指定试卷文本是否报 48195/8195（文本解析错误）。
// 用 2 秒静音 PCM 发送，文本解析失败会立刻 8195；解析成功则能走完评测流程
// （静音可能被判 is_rejected 或低分，属正常）。
// 用法：
//   node scripts/test-ise-topic.mjs "题目文本" "参考答案"
//   node scripts/test-ise-topic.mjs --sim2   测 sim2 第1轮（用户报错的案例）
const args = process.argv.slice(2);
let question, reference;
if (args[0] === '--sim2') {
  question = 'Inform CSN4580 that you have seen the A/C on the radar, and instruct to continue present level, and call you when over WHA.';
  reference = 'CSN4580, WUHAN CONTROL, radar contact, maintain level, report WHA.';
} else {
  [question, reference] = args;
}
if (!question || !reference) {
  console.error('用法: node scripts/test-ise-topic.mjs "题目" "参考答案" | --sim2');
  process.exit(1);
}

// 2 秒 16kHz PCM16 静音
const pcm = Buffer.alloc(16000 * 2 * 2);
const resp = await fetch('http://localhost:8787/api/ise/evaluate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ category: 'topic', question, text: reference, audio: pcm.toString('base64') }),
  signal: AbortSignal.timeout(130000),
});
const data = await resp.json();
console.log('question :', question);
console.log('reference:', reference);
console.log('结果     :', JSON.stringify(data, null, 2));
