// 历史记录 + 中断续做快照持久化
// 同 key 两个槽：records（历史列表，新→旧，上限 50 条）与 inProgress（部分级续做快照）。
// 录音 Blob 不持久化：快照中的录音引用在写入前由调用方剔除。
import type { ExamHistoryRecord, ExamProgressSnapshot } from '@/types/exam';

const STORAGE_KEY = 'aets.history.v1';
const MAX_RECORDS = 50;

interface HistoryData {
  version: number;
  records: ExamHistoryRecord[];
  inProgress: ExamProgressSnapshot | null;
}

function load(): HistoryData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, records: [], inProgress: null };
    const data = JSON.parse(raw) as Partial<HistoryData>;
    return {
      version: 1,
      records: Array.isArray(data.records) ? data.records : [],
      inProgress: data.inProgress ?? null,
    };
  } catch {
    return { version: 1, records: [], inProgress: null };
  }
}

function save(data: HistoryData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存储失败时静默忽略
  }
}

/** 读取历史记录（新→旧） */
export function loadHistory(): ExamHistoryRecord[] {
  return load().records;
}

/** 追加一条历史记录 */
export function addHistoryRecord(record: Omit<ExamHistoryRecord, 'id' | 'finishedAt'>): void {
  const data = load();
  data.records.unshift({
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    finishedAt: Date.now(),
  });
  if (data.records.length > MAX_RECORDS) data.records.length = MAX_RECORDS;
  save(data);
}

/** 读取中断续做快照（无则 null） */
export function getInProgress(): ExamProgressSnapshot | null {
  return load().inProgress;
}

/** 写入/更新中断续做快照 */
export function setInProgress(snapshot: ExamProgressSnapshot): void {
  const data = load();
  data.inProgress = snapshot;
  save(data);
}

/** 清除中断续做快照（流程结束或重新开始时调用） */
export function clearInProgress(): void {
  const data = load();
  if (data.inProgress) {
    data.inProgress = null;
    save(data);
  }
}
