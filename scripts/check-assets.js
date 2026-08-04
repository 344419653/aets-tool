#!/usr/bin/env node
/**
 * 构建前资源完整性检查
 * 自动从源码中提取引用的音频文件，确保 src/assets/audio/ 中对应文件存在且非空
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 新增：在 CI/CD 环境（如 Vercel）跳过音频检查
if (process.env.CI || process.env.VERCEL) {
  console.log('🔧 CI/CD 环境 detected，跳过音频资源检查\n');
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const audioDir = path.join(projectRoot, 'src', 'assets', 'audio');

console.log('🔍 检查构建必需资源...\n');

// 递归扫描 src/assets/audio/ 目录
const allAudioFiles = [];
function scanDir(dir, relativePath = '') {
  if (!fs.existsSync(dir)) {
    console.error(`❌ 音频目录不存在: ${dir}`);
    process.exit(1);
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(relativePath, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      scanDir(fullPath, relPath);
    } else if (entry.name.endsWith('.mp3')) {
      allAudioFiles.push(relPath);
    }
  }
}
scanDir(audioDir);

if (allAudioFiles.length === 0) {
  console.error('❌ 未找到任何音频文件');
  process.exit(1);
}

console.log(`✅ 发现 ${allAudioFiles.length} 个音频文件：`);
for (const f of allAudioFiles.sort()) {
  const stats = fs.statSync(path.join(audioDir, f));
  console.log(`   - src/assets/audio/${f} (${(stats.size / 1024).toFixed(1)} KB)`);
}
console.log('');

// 检查是否有空文件
const emptyFiles = allAudioFiles.filter(f => {
  return fs.statSync(path.join(audioDir, f)).size === 0;
});

if (emptyFiles.length > 0) {
  console.error(`❌ ${emptyFiles.length} 个音频文件大小为0（损坏）：`);
  for (const f of emptyFiles) {
    console.error(`   - src/assets/audio/${f}`);
  }
  console.error('\n❌ 资源检查失败，构建已阻断！\n');
  process.exit(1);
}

// 从源码中提取音频引用，验证是否有引用了不存在的文件
const srcDir = path.join(projectRoot, 'src');
const referencedFiles = new Set();

function scanSrc(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanSrc(fullPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      // 匹配形如 dialoguePart2, q1, q8 等从 '@/assets/audio' 导入的引用
      const importMatches = content.matchAll(/from\s+['"]@\/assets\/audio['"]/g);
      if ([...importMatches].length > 0) {
        // 文件从 assets/audio 导入了音频
        const allMatches = [...content.matchAll(/\b(dialoguePart[234]|q1?[0-9])\b/g)];
        for (const m of allMatches) {
          referencedFiles.add(m[1]);
        }
      }
    }
  }
}
scanSrc(srcDir);

// 检查引用的音频是否有对应的文件
const expectedFiles = {
  dialoguePart2: 'part2/dialogue.mp3',
  dialoguePart3: 'part3/dialogue.mp3',
  dialoguePart4: 'part4/dialogue.mp3',
  q1: 'part1/q1.mp3',
  q2: 'part1/q2.mp3',
  q3: 'part1/q3.mp3',
  q4: 'part1/q4.mp3',
  q5: 'part1/q5.mp3',
  q6: 'part2/q6.mp3',
  q7: 'part2/q7.mp3',
  q8: 'part2/q8.mp3',
  q9: 'part3/q9.mp3',
  q10: 'part3/q10.mp3',
  q11: 'part3/q11.mp3',
  q12: 'part3/q12.mp3',
  q13: 'part4/q13.mp3',
  q14: 'part4/q14.mp3',
  q15: 'part4/q15.mp3',
};

const missingRefs = [];
for (const [ref, expectedPath] of Object.entries(expectedFiles)) {
  if (referencedFiles.has(ref) && !allAudioFiles.includes(expectedPath)) {
    missingRefs.push({ ref, expectedPath });
  }
}

if (missingRefs.length > 0) {
  console.error(`❌ 代码引用了 ${missingRefs.length} 个不存在的音频文件：`);
  for (const { ref, expectedPath } of missingRefs) {
    console.error(`   - ${ref} → src/assets/audio/${expectedPath} (不存在)`);
  }
  console.error('\n❌ 资源检查失败，构建已阻断！\n');
  process.exit(1);
}

console.log(`✅ 所有 ${allAudioFiles.length} 个音频文件正常，引用验证通过。\n`);
process.exit(0);