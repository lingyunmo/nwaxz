import { levels, type BathMode } from "./levels.ts";
import type { Progress } from "../progress.ts";

export type GameMode = BathMode;
export const bathModes: GameMode[] = ["normal", "horror", "halloween", "infernal"];
export const isDarkBath = (mode: GameMode) => mode !== "normal";
export const bathNames: Record<GameMode,string> = {normal:"泡泡浴场",horror:"午夜浴场",halloween:"万圣浴场",infernal:"地狱浴场"};
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
