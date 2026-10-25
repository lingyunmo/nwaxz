import type { CrystalKind, Prop, Vec } from "./world.ts";

export const BASEMENT_START = 28;
export const MAP_HEIGHT = 54;

/** Carved cells added below the existing 25x25 ground floor. */
export const BASEMENT_RECTANGLES: readonly Readonly<{ x: number; z: number; w: number; h: number }>[] = [
  { x: 3, z: 23, w: 3, h: 6 }, // connects the old changing room to the stairs and landing
  { x: 2, z: 28, w: 7, h: 7 }, // entrance landing
  { x: 8, z: 31, w: 9, h: 3 }, // upper cross passage
  { x: 17, z: 28, w: 6, h: 7 }, // pump room
  { x: 7, z: 34, w: 4, h: 4 }, // west upper link
  { x: 14, z: 34, w: 4, h: 4 }, // east upper link
  { x: 10, z: 34, w: 5, h: 14 }, // central patrol gallery
  { x: 2, z: 37, w: 8, h: 7 }, // storage room
  { x: 15, z: 37, w: 8, h: 7 }, // inspection gallery
  { x: 2, z: 43, w: 21, h: 3 }, // upper loop cross passage
  { x: 8, z: 45, w: 3, h: 5 }, // west lower link
  { x: 14, z: 45, w: 3, h: 5 }, // east lower link
  { x: 2, z: 47, w: 7, h: 5 }, // cold room
  { x: 8, z: 48, w: 9, h: 3 }, // lower loop passage
  { x: 16, z: 47, w: 7, h: 5 }, // sump pool
];

export const BASEMENT_ROOMS = [
  { name: "地下入口", x: 2, z: 28, w: 7, h: 7 },
  { name: "泵房", x: 17, z: 28, w: 6, h: 7 },
  { name: "储藏间", x: 2, z: 37, w: 8, h: 7 },
  { name: "巡检廊", x: 15, z: 37, w: 8, h: 7 },
  { name: "冷藏室", x: 2, z: 47, w: 7, h: 5 },
  { name: "集水池", x: 16, z: 47, w: 7, h: 5 },
  { name: "中央巡廊", x: 10, z: 34, w: 5, h: 14 },
];

export const BASEMENT_PROPS: Prop[] = [
  { id: "basement-wardrobe-entrance", x: 7.5, z: 32.5, kind: "wardrobe", name: "入口旧衣柜" },
  { id: "basement-wardrobe-storage", x: 3.5, z: 39.5, kind: "wardrobe", name: "储藏间衣柜" },
  { id: "basement-wardrobe-inspection", x: 21.5, z: 39.5, kind: "wardrobe", name: "巡检廊衣柜" },
  { id: "basement-storage-drawer", x: 3.5, z: 41.5, kind: "drawer", name: "储藏抽屉" },
  { id: "basement-cold-drawer", x: 3.5, z: 49.5, kind: "drawer", name: "冷藏室抽屉" },
  { id: "basement-pump-note", x: 20.5, z: 30.5, kind: "note", name: "泵房值守记录", text: "备用继电器在储藏间。先恢复泵房供电，再去集水池开闸。这里记录的笑声从未停止，连停电时也是。" },
  { id: "basement-relay", x: 19.5, z: 32.5, kind: "power", name: "泵房继电器" },
  { id: "basement-sluice", x: 20.5, z: 49.5, kind: "valve", name: "最终污水闸" },
  { id: "basement-sluice-note", x: 18.5, z: 49.5, kind: "note", name: "污水闸操作牌", text: "合上泵房继电器，再转动污水闸手轮，巡检廊尽头的排水门才会开启。" },
  { id: "stairs-warning-note", x: 2.5, z: 22.5, kind: "note", name: "楼梯口警示", text: "别空着手下去。\n扫光掠过时，我试着停住脚步：十回里有八回躲了过去。跑起来却恰好相反。\n它有时会突然出现在另一个拐角。捏碎蓝色晶体，连它的影子也会停住。" },
  { id: "basement-secret-note", x: 5.5, z: 48.5, kind: "note", name: "封存试验记录", text: "这些罐子不是用来存牛奶的。\n每一个空罐都留下了同一种笑声。断电以后，录音也没有停止。\n紫色杂讯出现时，表盘会自己跳动。不要跟着读数走。那是它想让你看见的数字。\n相信脚步声。别相信仪表。" },
];

export const BASEMENT_CRYSTALS: readonly (Vec & { id: string; kind: CrystalKind })[] = [
  { id: "basement-crystal-freeze", x: 6.5, z: 40.5, kind: "freeze" },
  { id: "basement-crystal-reveal", x: 18.5, z: 41.5, kind: "reveal" },
];

export const BASEMENT_PATROL_SPAWN: Vec = { x: 12.5, z: 40.5 };

export function floorAt(point: Vec): 0 | -1 {
  return point.z >= 24 ? -1 : 0;
}

export function floorYAt(point: Vec): number {
  if (point.z <= 24) return 0;
  if (point.z >= BASEMENT_START) return -4.8;
  return -(point.z - 24) * 1.2;
}

export function stairsAt(point: Vec): boolean {
  return point.x >= 3 && point.x < 6 && point.z >= 23 && point.z < 30;
}
