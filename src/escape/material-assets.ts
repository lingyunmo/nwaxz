/** User-supplied PNG originals. Never resize or re-encode these files. */
export const surfacePaths = {
  wall: "/assets/materials/escape/01-wall-tile-v1.png",
  floor: "/assets/materials/escape/02-floor-tile-v1.png",
  ceiling: "/assets/materials/escape/03-ceiling-plaster-v1.png",
  wood: "/assets/materials/escape/04-aged-wood-v1.png",
  basementWall: "/assets/materials/escape/05-basement-wall-v1.png",
  basementFloor: "/assets/materials/escape/06-basement-floor-v1.png",
  basementCeiling: "/assets/materials/escape/07-basement-ceiling-v1.png",
  rustedIron: "/assets/materials/escape/08-rusted-iron-v1.png",
  paintedMetal: "/assets/materials/escape/09-painted-metal-v1.png",
} as const;
export type SurfaceKind = keyof typeof surfacePaths;
export type SurfaceImages = Record<SurfaceKind, HTMLImageElement>;

export function nativeRenderSize(width: number, height: number, devicePixelRatio = 1) {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
