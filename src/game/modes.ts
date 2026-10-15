import { levels } from "./levels.ts";
import type { Progress } from "../progress.ts";

export type GameMode = "normal" | "horror";
export const modeOf = (index: number): GameMode => levels[index].mode ?? "normal";
export const modeIndices = (mode: GameMode) => levels.flatMap((_, i) => modeOf(i) === mode ? [i] : []);
export function canEnter(index: number, progress: Progress): boolean {
  if (!Number.isInteger(index) || !levels[index]) return false;
  const indices = modeIndices(modeOf(index)), position = indices.indexOf(index);
  return position === 0 || Boolean(progress.levels[levels[indices[position - 1]].id]?.completed);
}
export function nextLevel(index: number): number | undefined {
  const indices = modeIndices(modeOf(index));
  return indices[indices.indexOf(index) + 1];
}
