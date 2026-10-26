export type HunterPerformance = { kind: "laugh" | "listen" | "stalk"; reason: "skill" | "interference" | "patrol" | "clue" | "hunt"; until: number };
export function isHunterPerformance(value: unknown, elapsed: number): value is HunterPerformance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as HunterPerformance;
  return Object.keys(p).length === 3 && Object.keys(p).every(k => ["kind","reason","until"].includes(k))
    && ["laugh","listen","stalk"].includes(p.kind) && ["skill","interference","patrol","clue","hunt"].includes(p.reason)
    && (p.kind === "laugh" ? ["skill","interference","patrol"].includes(p.reason) : p.reason === (p.kind === "listen" ? "clue" : "hunt"))
    && Number.isFinite(p.until) && p.until >= 0 && p.until <= elapsed + 4.01;
}
