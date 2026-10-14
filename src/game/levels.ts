export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Fan = { position: Point; zone: Rect; force: Point; on: boolean };
export type Valve = { position: Point; nozzle: Point; drops: number; rate: number };
export type WaterKind = "clean" | "sewage";
export type WaterPool = { x: number; y: number; columns: number; rows: number; kind: WaterKind };
export type Level = {
  id: string;
  title: string;
  hint: string;
  rocks: Rect[];
  coins: Point[];
  solution: Point[];
  chapter?: number;
  initialWater?: number;
  fans?: Fan[];
  valves?: Valve[];
  extraPools?: WaterPool[];
};
export const levels: Level[] = [
  {
    id: "first-bath",
    title: "第一缸水",
    hint: "划开泥土，把清水送进右下方的管道。",
    rocks: [],
    coins: [
      { x: 155, y: 270 },
      { x: 245, y: 385 },
      { x: 350, y: 520 },
    ],
    solution: [
      { x: 104, y: 198 },
      { x: 165, y: 280 },
      { x: 245, y: 390 },
      { x: 340, y: 480 },
      { x: 392, y: 592 },
    ],
  },
  {
    id: "detour",
    title: "绕个小弯",
    hint: "石板挖不动。绕到它右边，让水继续往下流。",
    rocks: [{ x: 120, y: 340, w: 240, h: 32 }],
    coins: [
      { x: 155, y: 250 },
      { x: 408, y: 397 },
      { x: 395, y: 535 },
    ],
    solution: [
      { x: 104, y: 198 },
      { x: 200, y: 285 },
      { x: 405, y: 325 },
      { x: 410, y: 408 },
      { x: 392, y: 592 },
    ],
  },
  {
    id: "last-drop",
    title: "曲曲折折",
    hint: "先绕过右侧，再折回左侧。给最后一缸水留好路。",
    rocks: [
      { x: 0, y: 310, w: 320, h: 32 },
      { x: 184, y: 460, w: 296, h: 32 },
    ],
    coins: [
      { x: 362, y: 284 },
      { x: 135, y: 433 },
      { x: 280, y: 565 },
    ],
    solution: [
      { x: 104, y: 198 },
      { x: 175, y: 235 },
      { x: 365, y: 290 },
      { x: 368, y: 365 },
      { x: 134, y: 437 },
      { x: 132, y: 525 },
      { x: 392, y: 592 },
    ],
  },
  {
    id: "fan-crossing",
    title: "借一阵风",
    chapter: 2,
    hint: "水会停在低处。挖好绕过高台的水道，轻点风扇把水向右上方吹。",
    rocks: [{ x: 16, y: 416, w: 184, h: 32 }, { x: 200, y: 328, w: 168, h: 120 }],
    fans: [{ position: { x: 48, y: 380 }, zone: { x: 64, y: 256, w: 312, h: 160 }, force: { x: 1800, y: -1000 }, on: false }],
    coins: [{ x: 135, y: 372 }, { x: 285, y: 300 }, { x: 397, y: 530 }],
    solution: [{ x: 104, y: 198 }, { x: 104, y: 374 }, { x: 170, y: 374 }, { x: 174, y: 300 }, { x: 395, y: 300 }, { x: 397, y: 450 }, { x: 392, y: 592 }],
  },
  {
    id: "valve-timing",
    title: "先挖路，再开水",
    chapter: 2,
    hint: "阀门里的水有限。先绕过石板挖好路，再轻点黄色手柄的阀门喷水。",
    initialWater: 0,
    valves: [{ position: { x: 70, y: 150 }, nozzle: { x: 106, y: 178 }, drops: 208, rate: 48 }],
    rocks: [{ x: 160, y: 352, w: 304, h: 32 }],
    coins: [{ x: 112, y: 285 }, { x: 118, y: 438 }, { x: 320, y: 550 }],
    solution: [{ x: 104, y: 198 }, { x: 112, y: 315 }, { x: 118, y: 442 }, { x: 320, y: 550 }, { x: 392, y: 592 }],
  },
  {
    id: "clean-water-only",
    title: "清水保卫战",
    chapter: 3,
    hint: "紫色是污水。保留它下方的泥土，只给左边的清水挖路。",
    extraPools: [{ x: 312, y: 136, columns: 8, rows: 8, kind: "sewage" }],
    rocks: [],
    coins: [{ x: 140, y: 280 }, { x: 220, y: 410 }, { x: 335, y: 540 }],
    solution: [{ x: 104, y: 198 }, { x: 140, y: 280 }, { x: 220, y: 410 }, { x: 335, y: 540 }, { x: 392, y: 592 }],
  },
];
