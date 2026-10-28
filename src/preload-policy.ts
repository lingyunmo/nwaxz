export type PreloadScope = "startup" | "all";
export type ResourceEntry = { url: string; revision?: string | null; bytes: number; startup?: boolean };
export function entriesForScope<T extends ResourceEntry>(entries: readonly T[], scope: PreloadScope): T[] {
  return scope === "startup" ? entries.filter(entry => entry.startup === true) : [...entries];
}
