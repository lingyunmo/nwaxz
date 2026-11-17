import type { Vec } from "./world.ts";

export const MAP_WIDTH = 39;
export const UPSTAIRS_HEIGHT = 4.8;
export const UPSTAIRS_ENTRY: Vec = { x: 22.5, z: 4.5 };
export const UPSTAIRS_RECTANGLES = [
  { x: 23, z: 3, w: 6, h: 3 },
  { x: 29, z: 1, w: 8, h: 9 },
] as const;
export const UPSTAIRS_ROOMS = [{ name: "晴窗休息室", x: 29, z: 1, w: 8, h: 9 }];

/** The protected boundary starts at the first ascending tread. */
export function upstairsAt(point: Vec): boolean {
  return point.x >= 24 && point.x < 38 && point.z >= 0 && point.z < 11;
}
export function upstairsStairsAt(point: Vec): boolean {
  return point.x >= 23 && point.x < 29 && point.z >= 3 && point.z < 6;
}
export function upstairsYAt(point: Vec): number {
  return Math.max(0, Math.min(UPSTAIRS_HEIGHT, (point.x - 24) * 1.2));
}
export function upstairsWindowAt(x: number, z: number): boolean {
  return x === 36 && (z >= 2 && z <= 4 || z >= 6 && z <= 8);
}

/** Shared footprints keep the visual furniture and physical collision aligned. */
export const UPSTAIRS_FURNITURE = [
  { id: "sofa", x: 31, z: 3, w: 2.4, d: .85 },
  { id: "armchair", x: 30.4, z: 6.5, w: 1, d: 1 },
  { id: "tea-table", x: 32.5, z: 4.9, w: 1.45, d: .85 },
  { id: "bookshelf", x: 29.4, z: 8.5, w: .55, d: 1.8 },
  { id: "window-bench", x: 36.25, z: 7.4, w: .65, d: 2 },
  { id: "sideboard", x: 33.6, z: 9.45, w: 2.1, d: .55 },
] as const;
