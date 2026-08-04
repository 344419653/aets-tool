// 错题本持久化（仅收录 Part 1 听力选择题答错题）
// 条目 key：`p1:{groupId}:{bankQNo}`，同 key 覆盖更新（保留最新一次作答）；
// 答对的题自动移出错题本。
import type { NotebookEntry, Part1Answer } from '@/types/exam';

const STORAGE_KEY = 'aets.notebook.v1';

/** Part 1 错题条目 key */
export function notebookKey(groupId: string, bankQNo: number): string {
  return `p1:${groupId}:${bankQNo}`;
}

/** 读取全部错题（JSON 损坏时回退空数据） */
export function loadNotebook(): Record<string, NotebookEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as { version?: number; entries?: Record<string, NotebookEntry> };
    return data.entries ?? {};
  } catch {
    return {};
  }
}

function saveNotebook(entries: Record<string, NotebookEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
  } catch {
    // 存储失败（容量/隐私模式）时静默忽略，不影响考试流程
  }
}

/** 答错：写入/更新错题条目（错误次数累加） */
export function upsertWrongAnswer(a: Part1Answer): void {
  const entries = loadNotebook();
  const key = notebookKey(a.groupId, a.bankQNo);
  const prev = entries[key];
  entries[key] = {
    key,
    groupId: a.groupId,
    bankQNo: a.bankQNo,
    scenario: a.scenario,
    questionText: a.questionText,
    options: a.options,
    correctAnswer: a.correctAnswer,
    userAnswer: a.userAnswer,
    dialogue: a.dialogue,
    explanation: a.explanation,
    dialogueAudio: a.dialogueAudio,
    wrongCount: (prev?.wrongCount ?? 0) + 1,
    lastWrongAt: Date.now(),
  };
  saveNotebook(entries);
}

/** 移除错题条目 */
export function removeNotebookEntry(key: string): void {
  const entries = loadNotebook();
  if (key in entries) {
    delete entries[key];
    saveNotebook(entries);
  }
}

/** 一次 Part 1 提交后同步错题本：答错写入（同 key 覆盖），答对自动移出 */
export function syncPart1Result(answers: Part1Answer[]): void {
  const entries = loadNotebook();
  let changed = false;
  for (const a of answers) {
    const key = notebookKey(a.groupId, a.bankQNo);
    if (a.isCorrect) {
      if (key in entries) {
        delete entries[key];
        changed = true;
      }
    } else {
      const prev = entries[key];
      entries[key] = {
        key,
        groupId: a.groupId,
        bankQNo: a.bankQNo,
        scenario: a.scenario,
        questionText: a.questionText,
        options: a.options,
        correctAnswer: a.correctAnswer,
        userAnswer: a.userAnswer,
        dialogue: a.dialogue,
        explanation: a.explanation,
        dialogueAudio: a.dialogueAudio,
        wrongCount: (prev?.wrongCount ?? 0) + 1,
        lastWrongAt: Date.now(),
      };
      changed = true;
    }
  }
  if (changed) saveNotebook(entries);
}
