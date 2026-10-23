type SaveStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export class SaveWriteError extends Error {
  restored: boolean;
  constructor(restored: boolean) { super("Save write failed"); this.restored = restored; }
}
/** Keep multi-key imports recoverable if storage rejects a later write. */
export function writeSaveBatch(storage: SaveStorage, entries: [string, string][]) {
  const previous = new Map<string, string | null>(), written: string[] = [];
  try {
    for (const [key] of entries) previous.set(key, storage.getItem(key));
    for (const [key, value] of entries) { storage.setItem(key, value); written.push(key); }
  } catch {
    let restored = true;
    for (const key of written.reverse()) {
      try {
        const value = previous.get(key);
        if (value == null) storage.removeItem(key); else storage.setItem(key, value);
      } catch { restored = false; }
    }
    throw new SaveWriteError(restored);
  }
}
