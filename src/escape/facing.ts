export const FROG_DIRECTIONS = ["front", "front-left", "left", "back-left", "back", "back-right", "right", "front-right"] as const;
const SECTOR = Math.PI / 4, HYSTERESIS = 5 * Math.PI / 180;
const delta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
/** Names describe the image: viewed from +Z, a hunter facing +X points screen-left. */
export function frogViewDirection(hunter: { x: number; z: number; angle: number }, viewer: { x: number; z: number }, previous?: number) {
  const relative = delta(Math.atan2(viewer.z - hunter.z, viewer.x - hunter.x), hunter.angle);
  if (previous !== undefined && Number.isInteger(previous) && previous >= 0 && previous < 8
    && Math.abs(delta(relative, previous * SECTOR)) <= SECTOR / 2 + HYSTERESIS + 1e-10) return previous;
  return (Math.round(relative / SECTOR) % 8 + 8) % 8;
}
