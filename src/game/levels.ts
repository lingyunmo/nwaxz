export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Level = {
  id: string;
  title: string;
  hint: string;
  rocks: Rect[];
  coins: Point[];
  solution: Point[];
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
];
