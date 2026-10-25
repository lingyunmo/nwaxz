/** Bump this only when the game intentionally starts a new incompatible save era. */
export const SAVE_GENERATION = "2026-10-b1-v2";
export const SAVE_GENERATION_KEY = "nwaxz-save-generation";

const DATABASE_NAME = "nwaxz";
const DATABASE_TIMEOUT_MS = 8_000;

type StorageLike = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
export type SaveGenerationEnvironment = { storage: StorageLike; indexedDB: IDBFactory; timeoutMs?: number };

function localStorageHasGameData(storage: StorageLike) {
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith("nwaxz-") && key !== SAVE_GENERATION_KEY) return true;
  }
  return false;
}

function databaseHasGameData(factory: IDBFactory): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state"))
        request.result.createObjectStore("state");
    };
    request.onerror = () => reject(request.error ?? new Error("本地存档无法检查"));
    request.onblocked = () => reject(new Error("请关闭其他游戏标签页再试"));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      const stores = Array.from(database.objectStoreNames);
      if (stores.length === 0) {
        database.close();
        resolve(false);
        return;
      }
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(stores, "readonly");
      } catch (error) {
        database.close();
        reject(error);
        return;
      }
      let found = false;
      for (const name of stores) {
        const read = transaction.objectStore(name).getAllKeys();
        read.onsuccess = () => { if (read.result.length > 0) found = true; };
      }
      transaction.oncomplete = () => {
        database.close();
        resolve(found);
      };
      transaction.onabort = transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("本地存档无法检查"));
      };
    };
  });
}

function deleteGameDatabase(factory: IDBFactory, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error("删除旧存档超时，请关闭其他游戏标签页后重试")), timeoutMs);
    let request: IDBOpenDBRequest;
    try {
      request = factory.deleteDatabase(DATABASE_NAME);
    } catch (error) {
      finish(error instanceof Error ? error : new Error("旧存档无法删除"));
      return;
    }
    request.onsuccess = () => finish();
    request.onerror = () => finish(request.error ?? new Error("旧存档无法删除"));
    request.onblocked = () => finish(new Error("请关闭其他游戏标签页再试"));
  });
}

/** Must complete before any settings, progress, or escape saves are read. */
export async function prepareSaveGeneration(environment?: SaveGenerationEnvironment): Promise<void> {
  const storage = environment?.storage ?? localStorage;
  const factory = environment?.indexedDB ?? indexedDB;
  const current = storage.getItem(SAVE_GENERATION_KEY);
  if (current === SAVE_GENERATION) return;

  const hasDatabaseData = await databaseHasGameData(factory);
  const hasOwnedLocalData = localStorageHasGameData(storage);
  if (current !== null || hasDatabaseData || hasOwnedLocalData) {
    await deleteGameDatabase(factory, environment?.timeoutMs ?? DATABASE_TIMEOUT_MS);
    const ownedKeys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith("nwaxz-")) ownedKeys.push(key);
    }
    for (const key of ownedKeys) storage.removeItem(key);
  }
  // Mark only after every required cleanup step succeeded. A failed cleanup
  // must block game startup so it cannot silently read a prior generation.
  storage.setItem(SAVE_GENERATION_KEY, SAVE_GENERATION);
}
