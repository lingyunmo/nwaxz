import { test } from "node:test";
import assert from "node:assert/strict";
import { levels } from "../src/game/levels.ts";
import {
  emptyProgress,
  formatTime,
  ProgressFormatError,
  createSaveBackup,
  mergeProgress,
  parseSaveBackup,
  parseProgress,
  scoreRun,
} from "../src/progress.ts";
import { prepareSaveGeneration, SAVE_GENERATION, SAVE_GENERATION_KEY } from "../src/save-generation.ts";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values,
  };
}

function memoryIndexedDB({ stores = { state: [] }, blockedDelete = false } = {}) {
  const removed = { value: false };
  const database = {
    objectStoreNames: { contains: name => name in stores, [Symbol.iterator]: function* () { yield* Object.keys(stores); } },
    close() {},
    transaction(names) {
      const tx = { objectStore(name) { return { getAllKeys() { const request = {}; queueMicrotask(() => { request.result = stores[name]; request.onsuccess?.(); }); return request; } }; } };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };
  return {
    removed,
    factory: {
      open() {
        const request = { result: database };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
      deleteDatabase() {
        const request = {};
        queueMicrotask(() => {
          if (blockedDelete) request.onblocked?.();
          else { removed.value = true; request.onsuccess?.(); }
        });
        return request;
      },
    },
  };
}

test("save backups carry the current generation and reject older generations", () => {
  const progress = { version: 1, levels: { detour: { completed: true, collected: 7 } } };
  assert.deepEqual(createSaveBackup(progress), { generation: SAVE_GENERATION, progress });
  assert.deepEqual(parseSaveBackup(createSaveBackup(progress)), progress);
  assert.throws(() => parseSaveBackup(progress), { message: "这份存档属于旧版本，请重新开始。" });
  assert.throws(() => parseSaveBackup({ generation: "older", progress }), { message: "这份存档属于旧版本，请重新开始。" });
});

test("only progress schema failures are marked for automatic local reset", () => {
  assert.throws(() => parseProgress({ version: 9, levels: {} }), ProgressFormatError);
  assert.throws(() => parseProgress(null), ProgressFormatError);
  assert.equal(new Error("IndexedDB permission denied") instanceof ProgressFormatError, false);
  assert.throws(() => parseSaveBackup({ generation: "old", progress: emptyProgress() }),
    error => !(error instanceof ProgressFormatError));
});

test("matching save generation preserves progress and local settings", async () => {
  const storage = memoryStorage({ [SAVE_GENERATION_KEY]: SAVE_GENERATION, "nwaxz-settings": "kept", other: "site" });
  const idb = memoryIndexedDB({ stores: { state: ["progress"] } });
  await prepareSaveGeneration({ storage, indexedDB: idb.factory });
  assert.equal(storage.getItem("nwaxz-settings"), "kept");
  assert.equal(storage.getItem("other"), "site");
  assert.equal(idb.removed.value, false);
});

test("generation mismatch clears only nwaxz owned storage and records the new marker", async () => {
  const storage = memoryStorage({ "nwaxz-settings": "old", "nwaxz-escape-session-v1": "old", unrelated: "keep" });
  const idb = memoryIndexedDB({ stores: { state: ["progress"] } });
  await prepareSaveGeneration({ storage, indexedDB: idb.factory });
  assert.equal(storage.getItem("nwaxz-settings"), null);
  assert.equal(storage.getItem("nwaxz-escape-session-v1"), null);
  assert.equal(storage.getItem("unrelated"), "keep");
  assert.equal(storage.getItem(SAVE_GENERATION_KEY), SAVE_GENERATION);
  assert.equal(idb.removed.value, true);
});

test("blocked old database deletion fails without writing a generation marker", async () => {
  const storage = memoryStorage({ "nwaxz-settings": "old" });
  const idb = memoryIndexedDB({ stores: { state: ["progress"] }, blockedDelete: true });
  await assert.rejects(prepareSaveGeneration({ storage, indexedDB: idb.factory, timeoutMs: 20 }), /关闭其他游戏标签页/);
  assert.equal(storage.getItem(SAVE_GENERATION_KEY), null);
  assert.equal(storage.getItem("nwaxz-settings"), "old");
});

test("version 1 saves without score fields round-trip unchanged", () => {
  const old = {
    version: 1,
    levels: {
      "first-bath": { completed: true, collected: 7 },
      detour: { completed: false, collected: 3 },
    },
  };
  assert.deepEqual(parseProgress(old), old);
  assert.deepEqual(parseProgress(JSON.parse(JSON.stringify(old))), old);
});

test("score merge is symmetric, idempotent, and never regresses", () => {
  const a = {
    version: 1,
    levels: {
      "first-bath": {
        completed: true,
        collected: 3,
        bestScore: 3500,
        bestTimeMs: 300_000,
      },
    },
  };
  const b = {
    version: 1,
    levels: {
      "first-bath": {
        completed: true,
        collected: 6,
        bestScore: 3000,
        bestTimeMs: 120_000,
      },
      detour: { completed: true, collected: 7, bestTimeMs: 0 },
    },
  };
  const merged = mergeProgress(a, b);
  assert.deepEqual(merged, mergeProgress(b, a));
  assert.deepEqual(mergeProgress(merged, merged), merged);
  assert.deepEqual(mergeProgress(merged, emptyProgress()), merged);
  assert.deepEqual(merged.levels["first-bath"], {
    completed: true,
    collected: 7,
    bestScore: 3500,
    bestTimeMs: 120_000,
  });
  assert.equal(merged.levels.detour.bestTimeMs, 0);
  assert.equal("bestScore" in merged.levels.detour, false);
});

test("best score and fastest time merge independently and absent values stay absent", () => {
  const withScore = {
    version: 1,
    levels: {
      detour: { completed: true, collected: 1, bestScore: 2100 },
    },
  };
  const withTime = {
    version: 1,
    levels: {
      detour: { completed: true, collected: 2, bestTimeMs: 75_000 },
    },
  };
  assert.deepEqual(mergeProgress(withScore, withTime).levels.detour, {
    completed: true,
    collected: 3,
    bestScore: 2100,
    bestTimeMs: 75_000,
  });
  assert.deepEqual(
    mergeProgress(emptyProgress(), emptyProgress()),
    emptyProgress(),
  );
});

test("progress parser rejects bad score/time, unknown fields, and poisoned IDs", () => {
  const invalidRecords = [
    { completed: true, collected: 0, bestScore: -1 },
    { completed: true, collected: 0, bestScore: 3501 },
    { completed: true, collected: 0, bestScore: 1.5 },
    { completed: true, collected: 0, bestTimeMs: -1 },
    { completed: true, collected: 0, bestTimeMs: 3_600_001 },
    { completed: true, collected: 0, bestTimeMs: 1.1 },
    { completed: false, collected: 0, bestScore: 1000 },
    { completed: false, collected: 0, bestTimeMs: 0 },
    { completed: true, collected: 0, debug: true },
  ];
  for (const record of invalidRecords)
    assert.throws(() =>
      parseProgress({ version: 1, levels: { detour: record } }),
    );
  assert.throws(() =>
    parseProgress(
      JSON.parse(
        '{"version":1,"levels":{"__proto__":{"completed":true,"collected":7}}}',
      ),
    ),
  );
  assert.throws(() =>
    parseProgress({
      version: 1,
      levels: {
        detour: { completed: true, collected: 0 },
        extra: { completed: true, collected: 0 },
      },
    }),
  );
  for (const id of ["__proto__", "prototype", "constructor"])
    assert.throws(() =>
      parseProgress({
        version: 1,
        levels: { [id]: { completed: true, collected: 7 } },
      }),
    );
});

test("every defined level ID round-trips and survives progress merging", () => {
  const previous = {
    version: 1,
    levels: Object.fromEntries(
      levels.map(({ id }) => [id, { completed: false, collected: 1 }]),
    ),
  };
  const newRuns = {
    version: 1,
    levels: Object.fromEntries(
      levels.map(({ id }, index) => [
        id,
        {
          completed: true,
          collected: 2,
          bestScore: 1500 + index,
          bestTimeMs: 10_000 + index,
        },
      ]),
    ),
  };
  assert.deepEqual(parseProgress(previous), previous);
  assert.deepEqual(parseProgress(newRuns), newRuns);

  const merged = mergeProgress(previous, newRuns);
  assert.deepEqual(Object.keys(merged.levels).sort(), levels.map(({ id }) => id).sort());
  for (const [index, { id }] of levels.entries())
    assert.deepEqual(merged.levels[id], {
      completed: true,
      collected: 3,
      bestScore: 1500 + index,
      bestTimeMs: 10_000 + index,
    });
  assert.deepEqual(mergeProgress(merged, previous), merged);
});

test("score formula handles score and time boundaries", () => {
  assert.equal(scoreRun(0, 0), 2000);
  assert.equal(scoreRun(7, 0), 3500);
  assert.equal(scoreRun(7, 100_000), 2500);
  assert.equal(scoreRun(0, 3_600_000), 1000);
  assert.equal(scoreRun(7, 3_600_000), 2500);
  for (const mask of [-1, 8, 1.5, NaN]) assert.throws(() => scoreRun(mask, 0));
  for (const time of [-1, 3_600_001, 0.5, NaN, Infinity])
    assert.throws(() => scoreRun(0, time));
});

test("time formatting uses minutes beyond 59 and floors seconds", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(999), "00:00");
  assert.equal(formatTime(59_999), "00:59");
  assert.equal(formatTime(60_000), "01:00");
  assert.equal(formatTime(3_599_999), "59:59");
  assert.equal(formatTime(3_600_000), "60:00");
  for (const time of [-1, 3_600_001, 0.5, NaN])
    assert.throws(() => formatTime(time));
});
