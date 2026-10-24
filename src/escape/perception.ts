export type Sense = "noise" | "glare" | "sight";
export const SENSES: readonly Sense[] = ["noise", "glare", "sight"];
export const ALERT_THRESHOLD = 45;
export const ALERT_MULTIPLIER = 1.5;
export const EXPOSURE_CEILING = 99.5;
export const HEARING = {
  walk: { range: 7.5, rate: 16 }, crouch: { range: 3, rate: 7 },
  sprint: { range: 15, rate: 36 }, breath: { range: 18, rate: 30 },
} as const;

/** Noisy-OR combines independent clues without linear addition.
 * Shapley values split the overlapping risk fairly, averaging all six orders.
 * At the displayed 100 boundary, contributions scale to the same authoritative total.
 */
export function combinePerception(scores: Record<Sense, number>, locked = false) {
  const values = SENSES.map(key => Math.max(0, Math.min(100, scores[key])) / 100);
  const raw = Math.round(100 * (1 - values.reduce((product, value) => product * (1 - value), 1)) * 1e12) / 1e12;
  const total = locked || raw >= EXPOSURE_CEILING - 1e-8 ? 100 : raw;
  const contributions = Object.fromEntries(SENSES.map((key, index) => {
    const [a, b] = values.filter((_, i) => i !== index);
    const marginal = 100 * values[index] * (1 - (a + b) / 2 + a * b / 3);
    const share = raw > 0 ? marginal / raw * 100 : 0;
    return [key, { score: values[index] * 100, points: share * total / 100, share }];
  })) as Record<Sense, { score: number; points: number; share: number }>;
  return { total, raw, contributions };
}
