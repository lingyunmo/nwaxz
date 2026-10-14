export type LevelRecord = {
  completed: boolean;
  collected: number;
  bestScore?: number;
  bestTimeMs?: number;
};
export type Record = LevelRecord;
export type Progress = { version: 1; levels: { [id: string]: Record } };
const ids = ["first-bath", "detour", "last-drop"];
const recordKeys = ["completed", "collected", "bestScore", "bestTimeMs"];
const hasOwn = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);
export const emptyProgress = (): Progress => ({ version: 1, levels: {} });
export function parseProgress(value: unknown): Progress {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("存档格式不正确");
  const raw = value as { version?: unknown; levels?: unknown };
  if (
    raw.version !== 1 ||
    !raw.levels ||
    typeof raw.levels !== "object" ||
    Array.isArray(raw.levels) ||
    Object.keys(raw).some((key) => !["version", "levels"].includes(key))
  )
    throw new Error("存档版本不支持");
  const result = emptyProgress();
  for (const [id, record] of Object.entries(raw.levels)) {
    if (
      !ids.includes(id) ||
      !record ||
      typeof record !== "object" ||
      Array.isArray(record)
    )
      throw new Error("存档关卡不正确");
    const r = record as Partial<LevelRecord>;
    if (
      typeof r.completed !== "boolean" ||
      typeof r.collected !== "number" ||
      !Number.isInteger(r.collected) ||
      r.collected < 0 ||
      r.collected > 7 ||
      Object.keys(r).some((key) => !recordKeys.includes(key)) ||
      (hasOwn(r, "bestScore") &&
        (!r.completed ||
          typeof r.bestScore !== "number" ||
          !Number.isInteger(r.bestScore) ||
          (r.bestScore as number) < 0 ||
          (r.bestScore as number) > 3500)) ||
      (hasOwn(r, "bestTimeMs") &&
        (!r.completed ||
          typeof r.bestTimeMs !== "number" ||
          !Number.isInteger(r.bestTimeMs) ||
          (r.bestTimeMs as number) < 0 ||
          (r.bestTimeMs as number) > 3_600_000))
    )
      throw new Error("存档记录不正确");
    result.levels[id] = {
      completed: r.completed,
      collected: r.collected,
      ...(hasOwn(r, "bestScore") ? { bestScore: r.bestScore } : {}),
      ...(hasOwn(r, "bestTimeMs") ? { bestTimeMs: r.bestTimeMs } : {}),
    };
  }
  return result;
}
export function mergeProgress(left: Progress, right: Progress) {
  const a = parseProgress(left),
    b = parseProgress(right),
    result = emptyProgress();
  for (const id of ids) {
    const x = a.levels[id],
      y = b.levels[id];
    if (x || y)
      result.levels[id] = {
        completed: Boolean(x?.completed || y?.completed),
        collected: (x?.collected ?? 0) | (y?.collected ?? 0),
        ...bestOf("bestScore", x?.bestScore, y?.bestScore, Math.max),
        ...bestOf("bestTimeMs", x?.bestTimeMs, y?.bestTimeMs, Math.min),
      };
  }
  return result;
}
function bestOf<K extends "bestScore" | "bestTimeMs">(
  key: K,
  left: number | undefined,
  right: number | undefined,
  choose: (a: number, b: number) => number,
): Partial<Pick<LevelRecord, K>> {
  if (left === undefined && right === undefined) return {};
  if (left === undefined) return { [key]: right } as Pick<LevelRecord, K>;
  if (right === undefined) return { [key]: left } as Pick<LevelRecord, K>;
  return { [key]: choose(left, right) } as Pick<LevelRecord, K>;
}
export const starCount = (mask: number) =>
  (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
export function scoreRun(collected: number, elapsedMs: number): number {
  if (!Number.isInteger(collected) || collected < 0 || collected > 7)
    throw new Error("泡泡币记录不正确");
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 3_600_000)
    throw new Error("通关时间不正确");
  return (
    1000 +
    starCount(collected) * 500 +
    Math.max(0, 1000 - Math.floor(elapsedMs / 100))
  );
}
export function formatTime(elapsedMs: number): string {
  if (!Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 3_600_000)
    throw new Error("通关时间不正确");
  const seconds = Math.floor(elapsedMs / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("nwaxz", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        connection = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => reject(new Error("请关闭其他游戏标签页再试"));
  }));
}
export async function loadProgress(): Promise<Progress> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("state", "readonly"),
      read = tx.objectStore("state").get("progress");
    tx.oncomplete = () => {
      try {
        resolve(
          read.result === undefined
            ? emptyProgress()
            : parseProgress(read.result),
        );
      } catch (error) {
        reject(error);
      }
    };
    tx.onabort = () => reject(tx.error);
  });
}
export async function saveProgress(value: Progress): Promise<Progress> {
  const incoming = parseProgress(value),
    database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("state", "readwrite"),
      state = tx.objectStore("state"),
      read = state.get("progress");
    let merged = incoming;
    read.onsuccess = () => {
      try {
        merged = mergeProgress(read.result ?? emptyProgress(), incoming);
        state.put(merged, "progress");
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(merged);
    tx.onabort = () =>
      reject(tx.error ?? new Error("本地存档无法写入，请导出备份"));
  });
}
