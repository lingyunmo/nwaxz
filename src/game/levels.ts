export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Fan = { position: Point; zone: Rect; force: Point; on: boolean };
export type Valve = { position: Point; nozzle: Point; drops: number; rate: number; kind?: WaterKind; spread?: number };
export type WaterKind = "clean" | "sewage";
export type WaterPool = { x: number; y: number; columns: number; rows: number; kind: WaterKind };
export type Plant = { position: Point; rect: Rect; tolerance: number };
export type Sponge = { position: Point; rect: Rect; release: Point; capacity: number };
export type Level = {
  id: string;
  title: string;
  hint: string;
  rocks: Rect[];
  coins: Point[];
  solution: Point[];
  chapter?: number;
  mode?: "horror";
  scene?: "bath" | "workshop" | "hauntedBath" | "hauntedCorridor" | "hauntedMachine" | "hauntedLaundry";
  pumpkins?: Point[];
  initialWater?: number;
  fans?: Fan[];
  valves?: Valve[];
  extraPools?: WaterPool[];
  plants?: Plant[];
  sponges?: Sponge[];
  extraSolutions?: Point[][];
};
const normalLevels: Level[] = [
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
  {
    id: "garden-gate",
    title: "水草的小秘密",
    chapter: 3,
    hint: "先让紫水被水草吸收。水草枯萎后，再开左边的清水阀门。",
    initialWater: 0,
    plants: [{ position: { x: 108, y: 400 }, rect: { x: 80, y: 336, w: 56, h: 64 }, tolerance: 12 }],
    valves: [
      { position: { x: 70, y: 150 }, nozzle: { x: 106, y: 178 }, drops: 208, rate: 48 },
      { position: { x: 96, y: 340 }, nozzle: { x: 132, y: 368 }, drops: 12, rate: 12, kind: "sewage", spread: 0 },
    ],
    rocks: [{ x: 16, y: 352, w: 64, h: 32 }, { x: 136, y: 384, w: 328, h: 24 }],
    coins: [{ x: 110, y: 280 }, { x: 174, y: 450 }, { x: 335, y: 550 }],
    solution: [{ x: 104, y: 198 }, { x: 108, y: 310 }, { x: 108, y: 426 }, { x: 260, y: 500 }, { x: 392, y: 592 }],
  },
  {
    id: "sponge-transfer",
    title: "海绵搬水工",
    chapter: 3,
    hint: "先挖路，再轻点海绵挤水。没接满，就再挤一次。",
    sponges: [{ position: { x: 180, y: 400 }, rect: { x: 148, y: 368, w: 64, h: 64 }, release: { x: 180, y: 446 }, capacity: 160 }],
    rocks: [{ x: 16, y: 384, w: 128, h: 32 }, { x: 216, y: 384, w: 248, h: 32 }],
    coins: [{ x: 145, y: 290 }, { x: 235, y: 490 }, { x: 335, y: 550 }],
    solution: [{ x: 104, y: 198 }, { x: 180, y: 340 }, { x: 180, y: 448 }, { x: 335, y: 550 }, { x: 392, y: 592 }],
  },
  {
    id: "valve-wind-relay",
    title: "风车开水啦",
    chapter: 4,
    scene: "workshop",
    hint: "先挖路、开风扇，再开清水阀。水不够时，检查高台右侧的水道。",
    initialWater: 0,
    valves: [{ position: { x: 70, y: 150 }, nozzle: { x: 106, y: 178 }, drops: 208, rate: 36 }],
    fans: [{ position: { x: 48, y: 380 }, zone: { x: 64, y: 256, w: 312, h: 160 }, force: { x: 1800, y: -1000 }, on: false }],
    rocks: [
      { x: 16, y: 416, w: 184, h: 32 }, { x: 200, y: 328, w: 168, h: 120 },
      { x: 264, y: 496, w: 200, h: 24 },
    ],
    coins: [{ x: 135, y: 372 }, { x: 285, y: 300 }, { x: 235, y: 524 }],
    solution: [{ x: 104, y: 198 }, { x: 104, y: 374 }, { x: 170, y: 374 }, { x: 174, y: 300 }, { x: 395, y: 300 }, { x: 397, y: 460 }, { x: 235, y: 480 }, { x: 235, y: 540 }, { x: 392, y: 592 }],
  },
  {
    id: "sponge-relay",
    title: "海绵接力赛",
    chapter: 4,
    scene: "workshop",
    hint: "先挖路、开水阀，再依次挤上面和下面的海绵。还有水就可以继续挤。",
    initialWater: 0,
    valves: [{ position: { x: 70, y: 150 }, nozzle: { x: 106, y: 178 }, drops: 208, rate: 40 }],
    sponges: [
      { position: { x: 160, y: 340 }, rect: { x: 128, y: 308, w: 64, h: 64 }, release: { x: 160, y: 386 }, capacity: 128 },
      { position: { x: 300, y: 480 }, rect: { x: 268, y: 448, w: 64, h: 64 }, release: { x: 300, y: 526 }, capacity: 128 },
    ],
    rocks: [
      { x: 16, y: 328, w: 108, h: 32 }, { x: 196, y: 328, w: 268, h: 32 },
      { x: 16, y: 472, w: 248, h: 32 }, { x: 336, y: 472, w: 128, h: 32 },
    ],
    coins: [{ x: 130, y: 270 }, { x: 225, y: 420 }, { x: 350, y: 565 }],
    solution: [{ x: 104, y: 198 }, { x: 160, y: 290 }, { x: 160, y: 402 }, { x: 300, y: 430 }, { x: 300, y: 536 }, { x: 392, y: 592 }],
  },
  {
    id: "wind-sponge-relay",
    title: "乘风的海绵水",
    chapter: 4,
    scene: "workshop",
    hint: "先挖水道，开阀让海绵吸水。挤出水后，用风扇送过高台。",
    initialWater: 0,
    valves: [{ position: { x: 70, y: 150 }, nozzle: { x: 106, y: 178 }, drops: 208, rate: 40 }],
    sponges: [{ position: { x: 108, y: 280 }, rect: { x: 76, y: 248, w: 64, h: 64 }, release: { x: 108, y: 326 }, capacity: 128 }],
    fans: [{ position: { x: 48, y: 380 }, zone: { x: 64, y: 256, w: 312, h: 160 }, force: { x: 1800, y: -1000 }, on: false }],
    rocks: [
      { x: 16, y: 272, w: 56, h: 24 }, { x: 144, y: 272, w: 320, h: 24 },
      { x: 16, y: 416, w: 184, h: 32 }, { x: 200, y: 328, w: 168, h: 120 },
    ],
    coins: [{ x: 108, y: 228 }, { x: 285, y: 300 }, { x: 397, y: 530 }],
    solution: [{ x: 104, y: 198 }, { x: 108, y: 374 }, { x: 170, y: 374 }, { x: 174, y: 300 }, { x: 395, y: 300 }, { x: 397, y: 450 }, { x: 392, y: 592 }],
  },
  {
    id: "garden-wind-relay",
    title: "草门后的风车",
    chapter: 4,
    scene: "workshop",
    hint: "紫水喂给水草，等它枯萎。再开清水阀和风扇，把水送过高台。",
    initialWater: 0,
    plants: [{ position: { x: 108, y: 312 }, rect: { x: 76, y: 248, w: 64, h: 64 }, tolerance: 12 }],
    valves: [
      { position: { x: 70, y: 150 }, nozzle: { x: 106, y: 178 }, drops: 208, rate: 40 },
      { position: { x: 44, y: 220 }, nozzle: { x: 80, y: 248 }, drops: 12, rate: 12, kind: "sewage", spread: 0 },
    ],
    fans: [{ position: { x: 48, y: 380 }, zone: { x: 64, y: 256, w: 312, h: 160 }, force: { x: 1800, y: -1000 }, on: false }],
    rocks: [
      { x: 16, y: 272, w: 56, h: 24 }, { x: 144, y: 272, w: 320, h: 24 },
      { x: 16, y: 416, w: 184, h: 32 }, { x: 200, y: 328, w: 168, h: 120 },
    ],
    coins: [{ x: 135, y: 372 }, { x: 285, y: 300 }, { x: 397, y: 530 }],
    solution: [{ x: 104, y: 198 }, { x: 108, y: 374 }, { x: 170, y: 374 }, { x: 174, y: 300 }, { x: 395, y: 300 }, { x: 397, y: 450 }, { x: 392, y: 592 }],
  },
];

const horrorLevels: Level[] = [
  {
    id: "haunted-bath", mode: "horror", scene: "hauntedBath",
    title: "废弃浴室", hint: "循着南瓜灯的微光，绕过石板右端，把水送进管道。",
    rocks: [{ x: 120, y: 340, w: 240, h: 32 }],
    coins: [{ x: 155, y: 250 }, { x: 408, y: 397 }, { x: 395, y: 535 }],
    pumpkins: [{ x: 54, y: 282 }, { x: 422, y: 456 }, { x: 68, y: 711 }],
    solution: [{ x: 104, y: 198 }, { x: 200, y: 285 }, { x: 405, y: 325 }, { x: 410, y: 408 }, { x: 392, y: 592 }],
  },
  {
    id: "pumpkin-corridor", mode: "horror", scene: "hauntedCorridor",
    title: "南瓜灯廊", hint: "光束会暂时照亮地图。先绕向右侧，再从第二道石板左侧折回。",
    rocks: [{ x: 0, y: 310, w: 320, h: 32 }, { x: 184, y: 460, w: 296, h: 32 }],
    coins: [{ x: 362, y: 284 }, { x: 135, y: 433 }, { x: 280, y: 565 }],
    pumpkins: [{ x: 432, y: 248 }, { x: 66, y: 402 }, { x: 211, y: 560 }, { x: 62, y: 714 }],
    solution: [{ x: 104, y: 198 }, { x: 175, y: 235 }, { x: 365, y: 290 }, { x: 368, y: 365 }, { x: 134, y: 437 }, { x: 132, y: 525 }, { x: 392, y: 592 }],
  },
  {
    id: "dark-machine", mode: "horror", scene: "hauntedMachine",
    title: "暗水机房", hint: "先挖出水路，再开清水阀与风扇，让水越过机房高台。",
    initialWater: 0,
    valves: [{ position: { x: 70, y: 150 }, nozzle: { x: 104, y: 178 }, drops: 208, rate: 48 }],
    fans: [{ position: { x: 48, y: 380 }, zone: { x: 64, y: 256, w: 312, h: 160 }, force: { x: 1800, y: -1000 }, on: false }],
    rocks: [{ x: 16, y: 416, w: 184, h: 32 }, { x: 200, y: 328, w: 168, h: 120 }],
    coins: [{ x: 135, y: 372 }, { x: 285, y: 300 }, { x: 397, y: 530 }],
    pumpkins: [{ x: 80, y: 480 }, { x: 315, y: 248 }, { x: 430, y: 463 }, { x: 66, y: 711 }],
    solution: [{ x: 104, y: 198 }, { x: 104, y: 374 }, { x: 170, y: 374 }, { x: 174, y: 300 }, { x: 395, y: 300 }, { x: 397, y: 450 }, { x: 392, y: 592 }],
  },
  {
    id: "rotten-root", mode: "horror", chapter: 2, scene: "hauntedLaundry",
    title: "腐根封门", hint: "先挖路，开紫水阀喂饱腐根，等它枯萎再开清水阀。别把紫水引进浴缸。",
    initialWater: 0,
    plants: [{ position: { x: 160, y: 368 }, rect: { x: 128, y: 304, w: 64, h: 64 }, tolerance: 12 }],
    valves: [
      { position: { x: 70, y: 150 }, nozzle: { x: 104, y: 178 }, drops: 208, rate: 40 },
      { position: { x: 96, y: 276 }, nozzle: { x: 132, y: 304 }, drops: 12, rate: 12, kind: "sewage", spread: 0 },
    ],
    rocks: [{ x: 16, y: 328, w: 108, h: 32 }, { x: 196, y: 328, w: 268, h: 32 }, { x: 16, y: 480, w: 248, h: 24 }],
    coins: [{ x: 135, y: 250 }, { x: 230, y: 425 }, { x: 350, y: 554 }],
    pumpkins: [{ x: 54, y: 390 }, { x: 318, y: 440 }, { x: 426, y: 562 }, { x: 66, y: 711 }],
    solution: [{ x: 104, y: 198 }, { x: 160, y: 282 }, { x: 160, y: 386 }, { x: 290, y: 438 }, { x: 302, y: 510 }, { x: 392, y: 592 }],
  },
  {
    id: "haunted-laundry", mode: "horror", chapter: 2, scene: "hauntedLaundry",
    title: "怨水洗衣间", hint: "挖出右上到左下的折返水路，再开清水阀。先挤右上的海绵，再挤左下的海绵。",
    initialWater: 0,
    valves: [{ position: { x: 70, y: 150 }, nozzle: { x: 104, y: 178 }, drops: 208, rate: 40 }],
    sponges: [
      { position: { x: 296, y: 320 }, rect: { x: 264, y: 288, w: 64, h: 64 }, release: { x: 296, y: 366 }, capacity: 128 },
      { position: { x: 144, y: 488 }, rect: { x: 112, y: 456, w: 64, h: 64 }, release: { x: 144, y: 534 }, capacity: 128 },
    ],
    rocks: [{ x: 16, y: 312, w: 244, h: 32 }, { x: 332, y: 312, w: 132, h: 32 }, { x: 16, y: 480, w: 92, h: 32 }, { x: 180, y: 480, w: 284, h: 32 }],
    coins: [{ x: 200, y: 238 }, { x: 230, y: 400 }, { x: 285, y: 565 }],
    pumpkins: [{ x: 354, y: 270 }, { x: 86, y: 416 }, { x: 238, y: 552 }, { x: 66, y: 711 }],
    solution: [{ x: 104, y: 198 }, { x: 296, y: 268 }, { x: 296, y: 376 }, { x: 144, y: 426 }, { x: 144, y: 540 }, { x: 392, y: 592 }],
  },
  {
    id: "midnight-draft", mode: "horror", chapter: 2, scene: "hauntedLaundry",
    title: "午夜回风", hint: "右上的紫水池不要挖。开清水阀给海绵蓄水，挤出水并开风扇，越过高台后从石板左侧折回。",
    initialWater: 0,
    valves: [{ position: { x: 70, y: 150 }, nozzle: { x: 104, y: 178 }, drops: 208, rate: 40 }],
    extraPools: [{ x: 360, y: 136, columns: 8, rows: 8, kind: "sewage" }],
    sponges: [{ position: { x: 108, y: 280 }, rect: { x: 76, y: 248, w: 64, h: 64 }, release: { x: 108, y: 326 }, capacity: 128 }],
    fans: [{ position: { x: 48, y: 380 }, zone: { x: 64, y: 256, w: 312, h: 160 }, force: { x: 1800, y: -1000 }, on: false }],
    rocks: [{ x: 16, y: 272, w: 56, h: 24 }, { x: 144, y: 272, w: 320, h: 24 }, { x: 16, y: 416, w: 184, h: 32 }, { x: 200, y: 328, w: 168, h: 120 }, { x: 264, y: 496, w: 200, h: 24 }],
    coins: [{ x: 108, y: 228 }, { x: 285, y: 300 }, { x: 235, y: 524 }],
    pumpkins: [{ x: 430, y: 220 }, { x: 165, y: 345 }, { x: 406, y: 455 }, { x: 66, y: 711 }],
    solution: [{ x: 104, y: 198 }, { x: 108, y: 374 }, { x: 170, y: 374 }, { x: 174, y: 300 }, { x: 395, y: 300 }, { x: 397, y: 460 }, { x: 235, y: 480 }, { x: 235, y: 540 }, { x: 392, y: 592 }],
  },
];
export const levels: Level[] = [...normalLevels, ...horrorLevels];
