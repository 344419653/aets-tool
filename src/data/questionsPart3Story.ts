import type { StoryMaterial } from '@/types/exam';
import { storyContent } from '@/data/part3StoryContent';
import {
  story01, story02, story03, story04, story05, story06,
  story07, story08, story09, story10, story11, story12,
  story13, story14, story15, story16, story17, story18,
  story19, story20, story21, story22, story23, story24,
  story25, story26, story27, story28, story29, story30,
  story31, story32, story33, story34, story35, story36,
  story37, story38, story39, story40, story41, story42,
} from '@/assets/audio/part3_lib';

/** 24个故事材料 */
const materialsPart3Raw: StoryMaterial[] = [
  { id: 1, title: 'Story 01', outline: '', keywords: [], storyAudio: story01 },
  { id: 2, title: 'Story 02', outline: '', keywords: [], storyAudio: story02 },
  { id: 3, title: 'Story 03', outline: '', keywords: [], storyAudio: story03 },
  { id: 4, title: 'Story 04', outline: '', keywords: [], storyAudio: story04 },
  { id: 5, title: 'Story 05', outline: '', keywords: [], storyAudio: story05 },
  { id: 6, title: 'Story 06', outline: '', keywords: [], storyAudio: story06 },
  { id: 7, title: 'Story 07', outline: '', keywords: [], storyAudio: story07 },
  { id: 8, title: 'Story 08', outline: '', keywords: [], storyAudio: story08 },
  { id: 9, title: 'Story 09', outline: '', keywords: [], storyAudio: story09 },
  { id: 10, title: 'Story 10', outline: '', keywords: [], storyAudio: story10 },
  { id: 11, title: 'Story 11', outline: '', keywords: [], storyAudio: story11 },
  { id: 12, title: 'Story 12', outline: '', keywords: [], storyAudio: story12 },
  { id: 13, title: 'Story 13', outline: '', keywords: [], storyAudio: story13 },
  { id: 14, title: 'Story 14', outline: '', keywords: [], storyAudio: story14 },
  { id: 15, title: 'Story 15', outline: '', keywords: [], storyAudio: story15 },
  { id: 16, title: 'Story 16', outline: '', keywords: [], storyAudio: story16 },
  { id: 17, title: 'Story 17', outline: '', keywords: [], storyAudio: story17 },
  { id: 18, title: 'Story 18', outline: '', keywords: [], storyAudio: story18 },
  { id: 19, title: 'Story 19', outline: '', keywords: [], storyAudio: story19 },
  { id: 20, title: 'Story 20', outline: '', keywords: [], storyAudio: story20 },
  { id: 21, title: 'Story 21', outline: '', keywords: [], storyAudio: story21 },
  { id: 22, title: 'Story 22', outline: '', keywords: [], storyAudio: story22 },
  { id: 23, title: 'Story 23', outline: '', keywords: [], storyAudio: story23 },
  { id: 24, title: 'Story 24', outline: '', keywords: [], storyAudio: story24 },
  // story_new: 新题 1-18
  { id: 25, title: 'Story 25', outline: '', keywords: [], storyAudio: story25 },
  { id: 26, title: 'Story 26', outline: '', keywords: [], storyAudio: story26 },
  { id: 27, title: 'Story 27', outline: '', keywords: [], storyAudio: story27 },
  { id: 28, title: 'Story 28', outline: '', keywords: [], storyAudio: story28 },
  { id: 29, title: 'Story 29', outline: '', keywords: [], storyAudio: story29 },
  { id: 30, title: 'Story 30', outline: '', keywords: [], storyAudio: story30 },
  { id: 31, title: 'Story 31', outline: '', keywords: [], storyAudio: story31 },
  { id: 32, title: 'Story 32', outline: '', keywords: [], storyAudio: story32 },
  { id: 33, title: 'Story 33', outline: '', keywords: [], storyAudio: story33 },
  { id: 34, title: 'Story 34', outline: '', keywords: [], storyAudio: story34 },
  { id: 35, title: 'Story 35', outline: '', keywords: [], storyAudio: story35 },
  { id: 36, title: 'Story 36', outline: '', keywords: [], storyAudio: story36 },
  { id: 37, title: 'Story 37', outline: '', keywords: [], storyAudio: story37 },
  { id: 38, title: 'Story 38', outline: '', keywords: [], storyAudio: story38 },
  { id: 39, title: 'Story 39', outline: '', keywords: [], storyAudio: story39 },
  { id: 40, title: 'Story 40', outline: '', keywords: [], storyAudio: story40 },
  { id: 41, title: 'Story 41', outline: '', keywords: [], storyAudio: story41 },
  { id: 42, title: 'Story 42', outline: '', keywords: [], storyAudio: story42 },
];

/** 合并参考内容（原文/中文梗概/关键词，来自 part3StoryContent.ts；暂无内容的保持空值） */
export const materialsPart3: StoryMaterial[] = materialsPart3Raw.map((m) => ({
  ...m,
  ...(storyContent[m.id] ?? {}),
}));

/** 总故事数 */
export const totalStoriesPart3 = materialsPart3.length;

/** 随机抽取一个故事（URL 参数 ?story=N 可指定 id 1-42，用于测试） */
export const getRandomStory = (): StoryMaterial => {
  const forced = typeof window !== 'undefined'
    ? Number(new URLSearchParams(window.location.search).get('story'))
    : NaN;
  if (Number.isInteger(forced) && forced >= 1 && forced <= materialsPart3.length) {
    const selected = materialsPart3[forced - 1];
    console.log('[Part3] URL 参数指定故事:', selected.title);
    return selected;
  }
  const randomIdx = Math.floor(Math.random() * materialsPart3.length);
  const selected = materialsPart3[randomIdx];
  console.log('[Part3] 题库总数:', materialsPart3.length, '随机抽取:', randomIdx + 1, '=>', selected.title);
  return selected;
};
