export type Vec = { x: number; z: number };
export type Item = "brass" | "cellar" | "fuse" | "cutters" | "handwheel";
export type EscapeInput = { forward?: number; strafe?: number; turn?: number; look?: number; sprint?: boolean };
export type Prop = Vec & { id: string; kind: "wardrobe" | "drawer" | "power" | "valve" | "exit" | "note"; name: string; loot?: Item; text?: string; battery?: boolean };
export type CrystalKind = "freeze" | "reveal";
export const CRYSTALS: readonly (Vec & { id: string; kind: CrystalKind })[] = [
  { id: "crystal-bed", x: 3.5, z: 4.5, kind: "freeze" },
  { id: "crystal-hall-west", x: 8.5, z: 9.5, kind: "reveal" },
  { id: "crystal-hall-east", x: 14.5, z: 9.5, kind: "freeze" },
  { id: "crystal-laundry", x: 4.5, z: 14.5, kind: "reveal" },
];
export const TORCH_CONE = .94;
export const TORCH_RANGE = 22;
export const SIZE = 25;
const grid = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(1));
const carve = (x: number, z: number, w: number, h: number) => {
  for (let j = z; j < z + h; j++) for (let i = x; i < x + w; i++) grid[j][i] = 0;
};
carve(1, 1, 6, 6); carve(9, 1, 6, 6); carve(17, 1, 6, 6);
carve(1, 8, 22, 3);
carve(1, 12, 6, 6); carve(9, 12, 6, 6); carve(17, 12, 6, 11);
carve(1, 19, 6, 5); carve(9, 19, 6, 5);
for (const [x, z] of [[4, 7], [11, 7], [19, 7], [4, 11], [11, 11], [19, 11], [4, 18], [11, 18]]) grid[z][x] = 0;
export const MAP = grid;
export const DOORS = [
  { id: "bedroom", x: 4, z: 7, name: "寝室门" },
  { id: "study", x: 11, z: 7, name: "档案室", key: "brass" as Item },
  { id: "infirmary", x: 19, z: 7, name: "值班室门" },
  { id: "laundry", x: 4, z: 11, name: "洗衣间门" },
  { id: "workshop", x: 11, z: 11, name: "配电室门" },
  { id: "cellar", x: 19, z: 11, name: "地下检修门", key: "cellar" as Item },
  { id: "changing", x: 4, z: 18, name: "旧更衣室" },
  { id: "boiler", x: 11, z: 18, name: "锅炉房" },
];
export const PROPS: Prop[] = [
  { id: "bed-drawer", x: 2.5, z: 2.5, kind: "drawer", name: "床头抽屉", loot: "brass" },
  { id: "bed-hide", x: 5.5, z: 2.5, kind: "wardrobe", name: "寝室衣柜" },
  { id: "bed-note", x: 5.5, z: 5.5, kind: "note", name: "床边纸条", text: "它听得见奔跑声。背后响起笑声时，先转弯，再躲进柜子。档案室钥匙在床头抽屉。" },
  { id: "study-drawer", x: 12.5, z: 2.5, kind: "drawer", name: "档案抽屉", loot: "cellar" },
  { id: "study-note", x: 10.5, z: 4.5, kind: "note", name: "维修记录", text: "检修门既要钥匙，也要电。保险丝被藏在洗衣间；配电箱在走廊南侧正中。地下室的断线钳能剪开下水道铁网。" },
  { id: "office-hide", x: 21.5, z: 4.5, kind: "wardrobe", name: "值班室衣柜" },
  { id: "office-drawer", x: 18.5, z: 3.5, kind: "drawer", name: "值班室抽屉", battery: true },
  { id: "laundry-drawer", x: 2.5, z: 13.5, kind: "drawer", name: "洗衣间抽屉", loot: "fuse" },
  { id: "laundry-hide", x: 2.5, z: 16.5, kind: "wardrobe", name: "洗衣间衣柜" },
  { id: "power", x: 13.5, z: 15.5, kind: "power", name: "配电箱" },
  { id: "workshop-hide", x: 13.5, z: 13.5, kind: "wardrobe", name: "配电室衣柜" },
  { id: "cellar-drawer", x: 20.5, z: 16.5, kind: "drawer", name: "维修工具柜", loot: "cutters" },
  { id: "cellar-hide", x: 21.5, z: 19.5, kind: "wardrobe", name: "地下室衣柜" },
  { id: "drain", x: 18.5, z: 20.5, kind: "valve", name: "排水阀" },
  { id: "exit-note", x: 18.5, z: 17.5, kind: "note", name: "最后一张纸条", text: "先转开排水阀，再剪开南墙的铁网。下水道就在后面。" },
  { id: "changing-drawer", x: 2.5, z: 20.5, kind: "drawer", name: "旧更衣柜", loot: "handwheel" },
  { id: "changing-hide", x: 5.5, z: 22.5, kind: "wardrobe", name: "更衣室柜子" },
  { id: "boiler-note", x: 9.5, z: 22.5, kind: "note", name: "维修纸条", text: "锅炉泄压顺序：先关冷水，再开回流，最后排气。手轮缺失时，阀杆会空转。" },
  { id: "boiler-hide", x: 13.5, z: 22.5, kind: "wardrobe", name: "锅炉检修柜" },
  { id: "valve-cold", x: 9.5, z: 20.5, kind: "valve", name: "冷水阀" },
  { id: "valve-return", x: 11.5, z: 20.5, kind: "valve", name: "回流阀" },
  { id: "valve-vent", x: 13.5, z: 20.5, kind: "valve", name: "排气阀" },
  { id: "exit", x: 20.5, z: 22.65, kind: "exit", name: "下水道铁网" },
];
export const ITEM_NAMES: Record<Item, string> = { brass: "黄铜钥匙", cellar: "检修门钥匙", fuse: "保险丝", cutters: "断线钳", handwheel: "生锈手轮" };
export const ROOMS = [
  { name: "寝室", x: 1, z: 1, w: 6, h: 6 }, { name: "档案室", x: 9, z: 1, w: 6, h: 6 },
  { name: "值班室", x: 17, z: 1, w: 6, h: 6 }, { name: "回声长廊", x: 1, z: 8, w: 22, h: 3 },
  { name: "洗衣间", x: 1, z: 12, w: 6, h: 6 }, { name: "配电室", x: 9, z: 12, w: 6, h: 6 },
  { name: "地下检修室", x: 17, z: 12, w: 6, h: 11 },
  { name: "旧更衣室", x: 1, z: 19, w: 6, h: 5 }, { name: "锅炉房", x: 9, z: 19, w: 6, h: 5 },
];
const normalRoomAt = (point: Vec) => ROOMS.find(r => point.x >= r.x && point.x < r.x + r.w && point.z >= r.z && point.z < r.z + r.h)?.name;
export function roomAt(point: Vec) {
  const door = DOORS.find(d => point.x >= d.x && point.x < d.x + 1 && point.z >= d.z && point.z < d.z + 1);
  if (door) {
    const before = normalRoomAt({ x: point.x, z: door.z - .01 });
    const after = normalRoomAt({ x: point.x, z: door.z + 1.01 });
    return point.z < door.z + .5 ? before ?? "门口" : after ?? "门口";
  }
  return normalRoomAt(point) ?? "门口";
}
export const HAZARDS: Vec[] = [{ x: 7.5, z: 9.5 }, { x: 16.5, z: 9.5 }];
export const VALVE_ORDER = ["valve-cold", "valve-return", "valve-vent"] as const;
const EXPANSION_DOORS = new Set(["changing", "boiler"]);
const EXPANSION_PROPS = new Set(["changing-drawer", "changing-hide", "boiler-note", "boiler-hide", ...VALVE_ORDER]);
const inExpansionRoom = (point: unknown): point is Vec => {
  if (!point || typeof point !== "object" || Array.isArray(point)) return false;
  const { x, z } = point as Partial<Vec>;
  return typeof x === "number" && Number.isFinite(x) && typeof z === "number" && Number.isFinite(z)
    && z >= 19 && z < 24 && (x >= 1 && x < 7 || x >= 9 && x < 15);
};
type HunterState = "patrol" | "investigate" | "chase" | "search";
export type Phase = "playing" | "caught" | "lost" | "won";
export type EscapeSnapshot = {
  version: 1; player: Vec & { angle: number; pitch?: number; stamina: number; battery: number; light: boolean; crouched: boolean };
  hunter: Vec & { angle: number; state: HunterState }; elapsed: number; captures: number;
  phase: Phase; inventory: Item[]; searched: string[]; opened: string[]; unlocked: string[];
  notes: string[]; hidden?: string; power: boolean; drained: boolean; stones: number;
  explored?: number[];
  expansion?: { enabled: true; valves: string[] };
  pursuit?: { target: Vec; seenHide?: string; unseen: number; wait: number; patrolIndex: number };
  hunt?: { version: 1; effort: number; panting: boolean; breathIn: number; glare: number; lightArmed: boolean; freeze: number; reveal: number; collected: string[]; freezeUsed: number; revealUsed: number; rng: number; recent: number[] };
};
export type EscapeEvent = { type: "message" | "step" | "door" | "item" | "laugh" | "caught" | "won" | "noise" | "breath"; text?: string };
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const initialOpen = ["bedroom", "infirmary", "laundry", "workshop"];
const patrol: Vec[] = [{ x: 12.5, z: 9.5 }, { x: 20.5, z: 9.5 }, { x: 19.5, z: 3.5 }, { x: 12.5, z: 9.5 }, { x: 4.5, z: 9.5 }, { x: 4.5, z: 14.5 }, { x: 4.5, z: 21.5 }, { x: 11.5, z: 21.5 }];
export class EscapeWorld {
  data: EscapeSnapshot = {
    version: 1, player: { x: 3.5, z: 5.5, angle: -Math.PI / 2, pitch: 0, stamina: 100, battery: 100, light: true, crouched: false },
    hunter: { x: 12.5, z: 9.5, angle: 0, state: "patrol" }, elapsed: 0, captures: 0, phase: "playing",
    inventory: [], searched: [], opened: [...initialOpen], unlocked: [...initialOpen], notes: [], power: false, drained: false, stones: 2, expansion: { enabled: true, valves: [] },
    hunt: { version: 1, effort: 0, panting: false, breathIn: 0, glare: 0, lightArmed: true, freeze: 0, reveal: 0, collected: [], freezeUsed: 0, revealUsed: 0, rng: (Math.random() * 0xffffffff) >>> 0, recent: [] },
  };
  events: EscapeEvent[] = [];
  target: Vec = { ...patrol[0] };
  private path: Vec[] = [];
  private pathTimer = 0;
  private patrolIndex = 0;
  private wait = 0;
  private unseen = 0;
  private footstep = 0;
  private glassArmed = HAZARDS.map(() => true);
  private hunterStep = 0;
  private laughAt = 0;
  private seenHide?: string;
  private mapPosition = "";
  constructor(seed?: number) {
    const hunt = this.data.hunt!;
    if (seed !== undefined) hunt.rng = seed >>> 0 || 1;
    this.target = this.choosePatrolTarget();
    this.revealMap();
  }
  /** Persist only tiles actually seen, including the wall that ends a sightline. */
  revealMap() {
    const p = this.data.player, cx = Math.floor(p.x), cz = Math.floor(p.z);
    const key = `${cx},${cz}:${this.data.opened.join(",")}`;
    if (key === this.mapPosition) return;
    this.mapPosition = key;
    const explored = new Set(this.data.explored ?? []);
    for (let z = Math.max(0, cz - 4); z <= Math.min(SIZE - 1, cz + 4); z++) for (let x = Math.max(0, cx - 4); x <= Math.min(SIZE - 1, cx + 4); x++) {
      if (Math.hypot(x - cx, z - cz) <= 4.5 && this.lineOfSight(p, { x: x + .5, z: z + .5 }, true)) explored.add(z * SIZE + x);
    }
    this.data.explored = [...explored].sort((a, b) => a - b);
  }
  pending?: { id: string; remaining: number };
  message = "床头抽屉里，也许有钥匙。";
  get room() { return roomAt(this.data.player); }
  get objective(): string {
    const d = this.data;
    if (!d.inventory.includes("brass")) return "搜索寝室床头抽屉，找到黄铜钥匙";
    if (!d.inventory.includes("cellar")) return "用黄铜钥匙打开档案室，搜索检修门钥匙";
    if (!d.inventory.includes("fuse")) return "去洗衣间找到保险丝";
    if (!d.power) return "将保险丝装入配电室的配电箱";
    if (!d.unlocked.includes("cellar")) return "用钥匙打开走廊东侧的地下检修门";
    if (!d.inventory.includes("cutters")) return "搜索地下检修室工具柜，找到断线钳";
    if (d.expansion?.enabled) {
      if (!d.inventory.includes("handwheel")) return "去旧更衣室找生锈手轮";
      if (d.expansion.valves.length < VALVE_ORDER.length) return "读维修纸条，按顺序转动锅炉房阀门";
    }
    if (!d.drained) return "转开地下室深处的排水阀";
    return "剪开最南侧的下水道铁网，逃出去";
  }
  say(text: string) { this.message = text; this.events.push({ type: "message", text }); }
  drainEvents() { return this.events.splice(0); }
  wall(x: number, z: number, hunter = false): number {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (MAP[cz]?.[cx] !== 0) return 1;
    const door = DOORS.find(d => d.x === cx && d.z === cz);
    if (door && EXPANSION_DOORS.has(door.id) && !this.data.expansion?.enabled) return 2;
    if (door && !this.data.opened.includes(door.id) && !(hunter && this.data.unlocked.includes(door.id))) return 2;
    return 0;
  }
  lineOfSight(a: Vec, b: Vec, allowTargetCell = false) {
    const steps = Math.ceil(dist(a, b) / .09);
    for (let i = 1; i < steps; i++) {
      const x = a.x + (b.x - a.x) * i / steps, z = a.z + (b.z - a.z) * i / steps;
      if (allowTargetCell && Math.floor(x) === Math.floor(b.x) && Math.floor(z) === Math.floor(b.z)) continue;
      if (this.wall(x, z)) return false;
    }
    return true;
  }
  seesPlayer() {
    const d = this.data, p = d.player, h = d.hunter;
    if (d.hidden || d.elapsed < 4) return false;
    const range = h.state === "chase" ? 13 : p.light ? 9 : p.crouched ? 3.8 : 6;
    return dist(p, h) < range && (h.state === "chase" || Math.abs(angleDelta(Math.atan2(p.z - h.z, p.x - h.x), h.angle)) < 1.05) && this.lineOfSight(h, p);
  }
  private illuminatesHunter() {
    const { player: p, hunter: h, hidden } = this.data;
    if (!p.light || p.battery <= 0 || hidden) return false;
    const eye = p.crouched ? 1.02 : 1.65, torso = 1.1;
    const dx = (h.x - p.x) * 1.5, dz = (h.z - p.z) * 1.5, dy = torso - eye;
    const distance = Math.hypot(dx, dz, dy);
    if (distance > TORCH_RANGE) return false;
    const pitch = p.pitch ?? 0;
    const fx = Math.cos(p.angle) * Math.cos(pitch), fz = Math.sin(p.angle) * Math.cos(pitch), fy = Math.sin(pitch);
    const dot = (dx * fx + dz * fz + dy * fy) / Math.max(.001, distance);
    if (dot < Math.cos(TORCH_CONE / 2)) return false;
    if (!this.lineOfSight(p, h)) return false;
    // Wardrobes stand above the entire eye-to-torso ray; low drawers can be lit over.
    return !PROPS.some(cabinet => {
      if (cabinet.kind !== "wardrobe") return false;
      let enter = 0, leave = 1;
      for (const [axis, half] of [["x", .4], ["z", .29]] as const) {
        const delta = h[axis] - p[axis], low = cabinet[axis] - half, high = cabinet[axis] + half;
        if (Math.abs(delta) < .00001) { if (p[axis] < low || p[axis] > high) return false; }
        else {
          const a = (low - p[axis]) / delta, b = (high - p[axis]) / delta;
          enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
          if (enter > leave) return false;
        }
      }
      return leave > 0 && enter < 1;
    });
  }
  private updateHunt(dt: number, walked: number, running: boolean) {
    const hunt = this.data.hunt!, d = this.data;
    if (walked > .0001) hunt.effort = Math.min(100, hunt.effort + (running ? 14 : d.player.crouched ? 3 : 6) * dt);
    else hunt.effort = Math.max(0, hunt.effort - 20 * dt);
    if (!hunt.panting && hunt.effort >= 100) { hunt.panting = true; hunt.breathIn = 0; }
    if (hunt.panting && hunt.effort < 35) { hunt.panting = false; hunt.breathIn = 0; }
    if (hunt.panting) {
      hunt.breathIn -= dt;
      if (hunt.breathIn <= 0) { hunt.breathIn = 2.5; this.events.push({ type: "breath" }); this.noise(d.player, 12); }
    }
    hunt.freeze = Math.max(0, hunt.freeze - dt);
    hunt.reveal = Math.max(0, hunt.reveal - dt);
    if (this.illuminatesHunter()) {
      hunt.glare = Math.min(100, hunt.glare + 20 * dt);
      if (hunt.glare >= 99.999 && hunt.lightArmed) {
        hunt.glare = 100;
        hunt.lightArmed = false;
        this.noise({ x: d.player.x, z: d.player.z }, 24);
        this.target = { x: d.player.x, z: d.player.z };
        if (d.hunter.state !== "chase") d.hunter.state = "investigate";
        this.say("它注意到灯光了！");
      }
    } else hunt.glare = Math.max(0, hunt.glare - 25 * dt);
    if (!hunt.lightArmed && hunt.glare < 60) hunt.lightArmed = true;
  }
  /** Model footprints in map units, shared by player and pursuer collision. */
  private furniture(x: number, z: number, radius = 0) {
    return PROPS.some(o => {
      const half = o.kind === "wardrobe" ? [.4, .29] : o.kind === "drawer" ? [.34, .25] : o.kind === "power" ? [.2, .13] : undefined;
      return half && Math.abs(o.x - x) < half[0] + radius && Math.abs(o.z - z) < half[1] + radius;
    });
  }
  private reachableTarget(point: Vec): Vec {
    if (!this.furniture(point.x, point.z, .23)) return { ...point };
    return [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([x, z]) => ({ x: Math.floor(point.x) + .5 + x, z: Math.floor(point.z) + .5 + z }))
      .filter(p => !this.wall(p.x, p.z, true) && !this.furniture(p.x, p.z, .23))
      .sort((a, b) => dist(a, this.data.hunter) - dist(b, this.data.hunter))[0] ?? { ...point };
  }
  private random() {
    const hunt = this.data.hunt!;
    let x = (hunt.rng + 0x9e3779b9) >>> 0;
    hunt.rng = x || 1;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    x ^= x >>> 15;
    return (x >>> 0) / 0x100000000;
  }
  private choosePatrolTarget(): Vec {
    const h = this.data.hunter, hunt = this.data.hunt!;
    const candidates: Vec[] = [], startX = Math.floor(h.x), startZ = Math.floor(h.z);
    const queue = [startZ * SIZE + startX], reachable = new Set(queue);
    for (let at = 0; at < queue.length; at++) {
      const key = queue[at], x = key % SIZE, z = Math.floor(key / SIZE);
      for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const xx = x + dx, zz = z + dz, next = zz * SIZE + xx;
        if (xx < 0 || xx >= SIZE || zz < 0 || zz >= SIZE || reachable.has(next)
          || this.wall(xx + .5, zz + .5, true) || this.furniture(xx + .5, zz + .5, .23)) continue;
        reachable.add(next); queue.push(next);
      }
    }
    for (let z = 1; z < SIZE - 1; z++) for (let x = 1; x < SIZE - 1; x++) {
      const point = { x: x + .5, z: z + .5 }, index = z * SIZE + x;
      if (!reachable.has(index) || dist(point, h) < 3) continue;
      if (hunt.recent.includes(index)) continue;
      candidates.push(point);
    }
    const pool = candidates.length ? candidates : [...reachable].map(index => ({ x: index % SIZE + .5, z: Math.floor(index / SIZE) + .5 }));
    const point = pool[Math.floor(this.random() * pool.length)];
    const index = Math.floor(point.z) * SIZE + Math.floor(point.x);
    hunt.recent = [...hunt.recent, index].slice(-6);
    return point;
  }
  route(a: Vec, b: Vec, hunter = false): Vec[] {
    if (hunter) b = this.reachableTarget(b);
    const start = Math.floor(a.z) * SIZE + Math.floor(a.x), end = Math.floor(b.z) * SIZE + Math.floor(b.x);
    const queue = [start], came = new Map<number, number>([[start, -1]]);
    for (let i = 0; i < queue.length && !came.has(end); i++) {
      const at = queue[i], x = at % SIZE, z = Math.floor(at / SIZE);
      for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const xx = x + dx, zz = z + dz, key = zz * SIZE + xx;
        if (xx < 0 || xx >= SIZE || zz < 0 || zz >= SIZE || came.has(key) || this.wall(xx + .5, zz + .5, hunter)
          || this.furniture(xx + .5, zz + .5, hunter ? .23 : .18)) continue;
        came.set(key, at); queue.push(key);
      }
    }
    if (!came.has(end)) return [];
    const result: Vec[] = [];
    for (let at = end; at !== start; at = came.get(at)!) result.unshift({ x: at % SIZE + .5, z: Math.floor(at / SIZE) + .5 });
    return result;
  }
  private move(body: Vec, dx: number, dz: number, hunter = false) {
    const radius = hunter ? .23 : .18;
    const blocked = (x: number, z: number) => [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]].some(([ox, oz]) => this.wall(x + ox, z + oz, hunter))
      || this.furniture(x, z, radius);
    if (!blocked(body.x + dx, body.z)) body.x += dx;
    if (!blocked(body.x, body.z + dz)) body.z += dz;
  }
  advance(seconds: number, input: EscapeInput = {}) {
    if (this.data.phase !== "playing") return;
    let left = Math.min(.15, Math.max(0, seconds));
    while (left > .0001) { const dt = Math.min(left, 1 / 60); this.tick(dt, input); left -= dt; if (this.data.phase !== "playing") break; }
    this.revealMap();
  }
  private tick(dt: number, input: EscapeInput) {
    const d = this.data, p = d.player;
    d.elapsed += dt;
    p.angle = angleDelta(p.angle + (input.turn ?? 0) * dt * 2, 0);
    p.pitch = Math.max(-1.3, Math.min(1.3, (p.pitch ?? 0) + (input.look ?? 0) * dt * 1.5));
    const forward = Math.max(-1, Math.min(1, input.forward ?? 0)), side = Math.max(-1, Math.min(1, input.strafe ?? 0));
    const moving = !d.hidden && Math.hypot(forward, side) > .05;
    const running = Boolean(moving && input.sprint && !p.crouched && p.stamina > 2);
    const speed = running ? 3 : p.crouched ? .95 : 1.7;
    p.stamina = Math.max(0, Math.min(100, p.stamina + (running ? -18 : 13) * dt));
    if (p.light && !d.hidden) {
      p.battery = Math.max(0, p.battery - dt * .13);
      if (!p.battery) { p.light = false; this.say("手电没电了。值班室有备用电池。"); }
    }
    let walked = 0;
    if (moving) {
      const norm = Math.max(1, Math.hypot(forward, side)), old = { x: p.x, z: p.z };
      this.move(p, (Math.cos(p.angle) * forward - Math.sin(p.angle) * side) * speed * dt / norm, (Math.sin(p.angle) * forward + Math.cos(p.angle) * side) * speed * dt / norm);
      walked = dist(old, p); this.footstep += walked;
      if (this.footstep > (p.crouched ? 1.1 : .85)) {
        this.footstep = 0; this.events.push({ type: "step" });
        if (!p.crouched) this.noise(p, running ? 7 : 2.4);
      }
      if (d.expansion?.enabled) HAZARDS.forEach((hazard, index) => {
        const distance = dist(p, hazard);
        if (distance > .85) this.glassArmed[index] = true;
        else if (distance < .34 && this.glassArmed[index]) {
          this.glassArmed[index] = false;
          if (!p.crouched) { this.events.push({ type: "noise" }); this.noise(hazard, 11); this.say("脚下的碎玻璃响了！它听见了动静。"); }
        }
      });
    }
    this.updateHunt(dt, walked, running);
    if (this.pending) {
      const object = PROPS.find(o => o.id === this.pending!.id)!;
      if (dist(p, object) > 1.9 || d.hidden) { this.pending = undefined; this.say("搜索中断，靠近后再试。"); }
      else if ((this.pending.remaining -= dt) <= 0) { this.pending = undefined; this.search(object); }
    }
    this.updateHunter(dt);
  }
  private updateHunter(dt: number) {
    const d = this.data, h = d.hunter;
    if (d.hunt!.freeze > 0) return;
    if (this.seesPlayer()) {
      if (h.state !== "chase") { this.events.push({ type: "laugh" }); this.say("它看见你了！转弯甩开视线，再找柜子！"); }
      h.state = "chase"; this.target = { x: d.player.x, z: d.player.z }; this.unseen = 0; this.wait = 0;
    } else if (h.state === "chase") {
      this.unseen += dt;
      if (this.unseen > 3.5) { h.state = "search"; this.wait = 4; }
    }
    if (d.hidden && this.seenHide) {
      const cabinet = PROPS.find(p => p.id === this.seenHide)!;
      this.target = { x: cabinet.x, z: cabinet.z + .65 }; h.state = "search";
      if (dist(h, cabinet) < 1.2) { this.capture(); return; }
    } else if (!d.hidden && dist(h, d.player) < .55 && this.lineOfSight(h, d.player)) { this.capture(); return; }
    const destination = this.reachableTarget(this.target);
    if (dist(h, destination) < .35) {
      if (h.state === "patrol") {
        this.wait += dt;
        if (this.wait < 1.8) return;
        this.wait = 0; this.target = this.choosePatrolTarget(); this.pathTimer = 0;
      } else {
        this.wait -= dt;
        if (this.wait > 0) { h.angle += dt * .55; return; }
        h.state = "patrol"; this.seenHide = undefined; this.target = this.choosePatrolTarget(); this.pathTimer = 0;
      }
    }
    this.pathTimer -= dt;
    if (this.pathTimer <= 0) { this.path = this.route(h, this.target, true); this.pathTimer = .3; }
    let next = this.path[0];
    if (!next) {
      if (Math.floor(h.x) === Math.floor(this.target.x) && Math.floor(h.z) === Math.floor(this.target.z)) next = this.target;
      else { h.state = "patrol"; this.target = this.choosePatrolTarget(); this.pathTimer = 0; return; }
    }
    const distance = dist(h, next);
    if (distance < .08) { this.path.shift(); return; }
    const speed = h.state === "chase" ? 1.95 : h.state === "patrol" ? .9 : 1.25;
    const desired = Math.atan2(next.z - h.z, next.x - h.x);
    h.angle = angleDelta(h.angle + Math.max(-dt * 4, Math.min(dt * 4, angleDelta(desired, h.angle))), 0);
    const door = DOORS.find(o => o.x === Math.floor(next.x) && o.z === Math.floor(next.z));
    if (door && !d.opened.includes(door.id) && d.unlocked.includes(door.id) && dist(h, { x: door.x + .5, z: door.z + .5 }) < 1) { d.opened.push(door.id); this.events.push({ type: "door" }); }
    const step = Math.min(distance, speed * dt);
    this.move(h, Math.cos(desired) * step, Math.sin(desired) * step, true);
    this.hunterStep += step;
    if (this.hunterStep > .8) {
      this.hunterStep = 0;
      if (dist(h, d.player) < 7) this.events.push({ type: "step" });
    }
    if (d.elapsed - this.laughAt > 20) { this.laughAt = d.elapsed; this.events.push({ type: "laugh" }); }
  }
  noise(at: Vec, range: number) {
    const h = this.data.hunter;
    if (h.state === "chase" || dist(h, at) > range) return;
    h.state = "investigate"; this.target = this.reachableTarget(at); this.wait = 4; this.pathTimer = 0;
  }
  crystalCharges(kind: CrystalKind) {
    const hunt = this.data.hunt!;
    const count = CRYSTALS.filter(c => c.kind === kind && hunt.collected.includes(c.id)).length;
    return Math.max(0, count - (kind === "freeze" ? hunt.freezeUsed : hunt.revealUsed));
  }
  useCrystal(kind: CrystalKind): void {
    const hunt = this.data.hunt!;
    if (this.data.phase !== "playing" || this.crystalCharges(kind) <= 0) { this.say("没有可用的水晶。"); return; }
    const active = kind === "freeze" ? hunt.freeze : hunt.reveal;
    if (active > 0) { this.say("这种水晶的效果仍在持续。"); return; }
    if (kind === "freeze") { hunt.freeze = 10; hunt.freezeUsed++; this.say("奶蛙被定住了！"); }
    else { hunt.reveal = 10; hunt.revealUsed++; this.say("透视水晶显出了奶蛙的位置！"); }
    this.events.push({ type: "item" });
  }
  throwStone() {
    if (this.data.hidden || this.data.phase !== "playing") return;
    if (!this.data.stones) { this.say("没有石子了。"); return; }
    this.data.stones--;
    const p = this.data.player, at = { x: p.x, z: p.z };
    for (let t = .4; t < 6; t += .2) { const next = { x: p.x + Math.cos(p.angle) * t, z: p.z + Math.sin(p.angle) * t }; if (this.wall(next.x, next.z)) break; Object.assign(at, next); }
    this.noise(at, 16); this.events.push({ type: "noise" }); this.say("石子落地。");
  }
  nearest(): { id: string; label: string; position: Vec } | undefined {
    if (this.data.hidden) return { id: "leave-hide", label: "悄悄离开衣柜", position: this.data.player };
    const p = this.data.player;
    const objects = [
      ...PROPS.filter(o => this.data.expansion?.enabled || !EXPANSION_PROPS.has(o.id)).map(o => ({ id: o.id, position: o, label: o.kind === "drawer" ? this.data.searched.includes(o.id) ? `已搜过：${o.name}` : `搜索${o.name}` : o.kind === "wardrobe" ? `躲进${o.name}` : o.kind === "note" ? `阅读${o.name}` : o.name })),
      ...DOORS.filter(o => this.data.expansion?.enabled || !EXPANSION_DOORS.has(o.id)).map(o => ({ id: o.id, position: { x: o.x + .5, z: o.z + .5 }, label: `${this.data.opened.includes(o.id) ? "关闭" : "打开"}${o.name}` })),
      ...CRYSTALS.filter(c => !this.data.hunt!.collected.includes(c.id)).map(c => ({ id: c.id, position: c, label: `拾取${c.kind === "freeze" ? "定身" : "透视"}水晶` })),
    ];
    return objects.filter(o => dist(p, o.position) < 1.7 && Math.abs(p.pitch ?? 0) < 1.05 && Math.abs(angleDelta(Math.atan2(o.position.z - p.z, o.position.x - p.x), p.angle)) < .8 && this.lineOfSight(p, o.position, DOORS.some(d => d.id === o.id)))
      .sort((a, b) => dist(p, a.position) - dist(p, b.position))[0];
  }
  interact() {
    if (this.data.phase !== "playing" || this.pending) return;
    const target = this.nearest();
    if (!target) { this.say("靠近目标，并看向它。"); return; }
    const d = this.data;
    const crystal = CRYSTALS.find(c => c.id === target.id);
    if (crystal) {
      d.hunt!.collected.push(crystal.id); this.events.push({ type: "item" }); this.say(`拾取了${crystal.kind === "freeze" ? "定身" : "透视"}水晶。`); return;
    }
    if (target.id === "leave-hide") {
      const cabinet = PROPS.find(p => p.id === d.hidden)!;
      Object.assign(d.player, { x: cabinet.x, z: cabinet.z + 1, angle: Math.PI / 2, pitch: 0, crouched: true });
      d.hidden = undefined; this.say("你悄悄离开了柜子。"); return;
    }
    const door = DOORS.find(o => o.id === target.id);
    if (door) {
      if (!d.unlocked.includes(door.id)) {
        if (door.key && !d.inventory.includes(door.key)) { this.say(`门锁着，需要${ITEM_NAMES[door.key]}。`); return; }
        if (door.id === "cellar" && !d.power) { this.say("检修门电锁没有供电，先修好配电箱。"); return; }
        d.unlocked.push(door.id);
      }
      if (d.opened.includes(door.id)) {
        const occupied = [d.player, d.hunter].some(p => Math.abs(p.x - door.x - .5) < .7 && Math.abs(p.z - door.z - .5) < .7);
        if (occupied) { this.say("先离开门框，再关门。"); return; }
        d.opened = d.opened.filter(id => id !== door.id);
      } else d.opened.push(door.id);
      this.events.push({ type: "door" }); this.noise(target.position, 4); return;
    }
    const object = PROPS.find(o => o.id === target.id)!;
    if (object.kind === "drawer") {
      if (d.searched.includes(object.id)) { this.say("这里已经搜过了。"); return; }
      this.pending = { id: object.id, remaining: 1.15 }; this.noise(object, 3); return;
    }
    if (object.kind === "wardrobe") {
      if (this.seesPlayer() || d.hunter.state === "chase" && this.lineOfSight(d.hunter, d.player)) this.seenHide = object.id;
      d.hidden = object.id;
      Object.assign(d.player, { x: object.x, z: object.z + .08, angle: Math.PI / 2, pitch: 0 });
      this.say(this.seenHide ? "它看见你了！" : "已躲进衣柜。"); return;
    }
    if (object.kind === "note") { if (!d.notes.includes(object.id)) d.notes.push(object.id); this.say(object.text!); return; }
    if (object.kind === "power") {
      if (!d.inventory.includes("fuse")) { this.say("保险丝缺失。去洗衣间找找。"); return; }
      if (d.power) { this.say("电源已经恢复。"); return; }
      d.power = true; this.noise(object, 16); this.events.push({ type: "door" }); this.say("电源恢复。小心，动静太大了。"); return;
    }
    if (object.kind === "valve") {
      if (object.id !== "drain" && d.expansion?.enabled) {
        if (!d.power) { this.say("锅炉管路没有供电。先修好配电箱。"); return; }
        if (!d.inventory.includes("handwheel")) { this.say("阀杆上缺了手轮，去旧更衣室找找。"); return; }
        const valves = d.expansion.valves, expected = VALVE_ORDER[valves.length];
        if (valves.includes(object.id)) { this.say(`${object.name}已经转到位。`); return; }
        if (object.id !== expected) {
          d.expansion.valves = [];
          this.noise(object, 14); this.events.push({ type: "noise" });
          this.say("阀门顺序错了，管道猛地震响。顺序已重置！"); return;
        }
        valves.push(object.id); this.noise(object, 7); this.events.push({ type: "door" });
        this.say(valves.length === VALVE_ORDER.length ? "最后一股蒸汽散尽，锅炉已泄压。" : `${object.name}转到位。继续按纸条操作。`); return;
      }
      if (!d.power) { this.say("排水泵没电。"); return; }
      if (d.drained) { this.say("水位已经降下去了。"); return; }
      if (d.expansion?.enabled && (!d.inventory.includes("handwheel") || d.expansion.valves.length !== VALVE_ORDER.length)) { this.say("锅炉尚未泄压，排水阀也缺少手轮。"); return; }
      d.drained = true; this.noise(object, 16); this.events.push({ type: "noise" }); this.say("水位下降，铁网露出来了。"); return;
    }
    if (!d.drained) { this.say("下水道还在涌水，先转开排水阀。"); return; }
    if (!d.inventory.includes("cutters")) { this.say("铁网封着出口，需要断线钳。"); return; }
    d.phase = "won"; this.events.push({ type: "won" });
  }
  private search(object: Prop) {
    const d = this.data; d.searched.push(object.id);
    if (object.loot) {
      if (!d.inventory.includes(object.loot)) d.inventory.push(object.loot);
      this.events.push({ type: "item" }); this.say(`找到${ITEM_NAMES[object.loot]}。`);
    } else if (object.battery) {
      d.player.battery = 100; d.stones = Math.min(3, d.stones + 1); this.events.push({ type: "item" }); this.say("找到电池和石子。");
    }
  }
  toggleLight() { if (this.data.player.battery > 0) this.data.player.light = !this.data.player.light; else this.say("手电已经没电了。"); }
  capture() {
    if (this.data.phase !== "playing") return;
    this.data.captures++; this.data.phase = this.data.captures >= 3 ? "lost" : "caught";
    this.clearHuntAlerts();
    this.pending = undefined; this.events.push({ type: "caught" });
  }
  nextNight() {
    if (this.data.phase !== "caught") return;
    const d = this.data; Object.assign(d.player, { x: 3.5, z: 5.5, angle: -Math.PI / 2, pitch: 0, stamina: 100, battery: Math.max(35, d.player.battery) });
    Object.assign(d.hunter, { x: 12.5, z: 9.5, angle: 0, state: "patrol" });
    d.hidden = undefined; d.phase = "playing"; this.seenHide = undefined; this.unseen = 0; this.path = []; this.pathTimer = 0;
    this.patrolIndex = 0; this.target = this.choosePatrolTarget(); this.wait = 0; this.data.hunt!.rng = (this.random() * 0xffffffff) >>> 0 || 1; this.clearHuntAlerts(); this.say("物品还在，继续寻找出口。");
  }
  private clearHuntAlerts() {
    const hunt = this.data.hunt!;
    Object.assign(hunt, { effort: 0, panting: false, breathIn: 0, glare: 0, lightArmed: true, freeze: 0, reveal: 0 });
  }
  snapshot(): EscapeSnapshot {
    return JSON.parse(JSON.stringify({ ...this.data, pursuit: { target: this.target, seenHide: this.seenHide, unseen: this.unseen, wait: this.wait, patrolIndex: this.patrolIndex } }));
  }
  static restore(raw: unknown): EscapeWorld {
    if (!raw || typeof raw !== "object") throw new Error("逃生存档格式不正确");
    const d = raw as EscapeSnapshot;
    const number = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
    const ids = (a: unknown, allowed: string[]) => Array.isArray(a) && new Set(a).size === a.length && a.every(id => typeof id === "string" && allowed.includes(id));
    if (Object.keys(d).some(k => !["version", "player", "hunter", "elapsed", "captures", "phase", "inventory", "searched", "opened", "unlocked", "notes", "hidden", "power", "drained", "stones", "pursuit", "explored", "expansion", "hunt"].includes(k))
      || d.explored !== undefined && (!Array.isArray(d.explored) || d.explored.length > SIZE * SIZE || new Set(d.explored).size !== d.explored.length || !d.explored.every(v => Number.isInteger(v) && v >= 0 && v < SIZE * SIZE))
      || d.version !== 1 || !d.player || !d.hunter || !number(d.elapsed, 0, 86400) || !Number.isInteger(d.captures) || !number(d.captures, 0, 3)
      || d.pursuit !== undefined && (!d.pursuit || typeof d.pursuit !== "object" || Array.isArray(d.pursuit)
        || !d.pursuit.target || typeof d.pursuit.target !== "object" || Array.isArray(d.pursuit.target))
      || !["playing", "caught", "lost", "won"].includes(d.phase) || !["patrol", "investigate", "chase", "search"].includes(d.hunter.state)
      || !ids(d.inventory, Object.keys(ITEM_NAMES)) || !ids(d.searched, PROPS.filter(o => o.kind === "drawer").map(o => o.id))
      || !ids(d.opened, DOORS.map(o => o.id)) || !ids(d.unlocked, DOORS.map(o => o.id)) || !d.opened.every(id => d.unlocked.includes(id))
      || !ids(d.notes, PROPS.filter(o => o.kind === "note").map(o => o.id)) || !Number.isInteger(d.stones) || !number(d.stones, 0, 3)
      || d.expansion !== undefined && (!d.expansion || typeof d.expansion !== "object" || Array.isArray(d.expansion)
        || Object.keys(d.expansion).some(k => !["enabled", "valves"].includes(k)) || d.expansion.enabled !== true
        || !ids(d.expansion.valves, [...VALVE_ORDER]) || d.expansion.valves.some((id, index) => id !== VALVE_ORDER[index]))
      || d.hunt !== undefined && (!d.hunt || typeof d.hunt !== "object" || Array.isArray(d.hunt)
        || Object.keys(d.hunt).some(k => !["version", "effort", "panting", "breathIn", "glare", "lightArmed", "freeze", "reveal", "collected", "freezeUsed", "revealUsed", "rng", "recent"].includes(k))
        || d.hunt.version !== 1 || !number(d.hunt.effort, 0, 100) || typeof d.hunt.panting !== "boolean" || !number(d.hunt.breathIn, 0, 2.5)
        || !number(d.hunt.glare, 0, 100) || typeof d.hunt.lightArmed !== "boolean" || !number(d.hunt.freeze, 0, 10) || !number(d.hunt.reveal, 0, 10)
        || !ids(d.hunt.collected, CRYSTALS.map(c => c.id)) || !Number.isInteger(d.hunt.freezeUsed) || !number(d.hunt.freezeUsed, 0, CRYSTALS.filter(c => c.kind === "freeze").length)
        || !Number.isInteger(d.hunt.revealUsed) || !number(d.hunt.revealUsed, 0, CRYSTALS.filter(c => c.kind === "reveal").length)
        || d.hunt.freezeUsed > CRYSTALS.filter(c => c.kind === "freeze" && d.hunt!.collected.includes(c.id)).length
        || d.hunt.revealUsed > CRYSTALS.filter(c => c.kind === "reveal" && d.hunt!.collected.includes(c.id)).length
        || !Number.isInteger(d.hunt.rng) || d.hunt.rng < 0 || d.hunt.rng > 0xffffffff
        || !Array.isArray(d.hunt.recent) || d.hunt.recent.length > 6 || !d.hunt.recent.every(v => Number.isInteger(v) && v >= 0 && v < SIZE * SIZE)
        || d.hunt.panting && d.hunt.effort < 35 || !d.hunt.panting && (d.hunt.effort >= 100 || d.hunt.breathIn !== 0)
        || d.hunt.lightArmed && d.hunt.glare >= 100 || !d.hunt.lightArmed && d.hunt.glare < 60
        || d.hunt.freeze > 0 && d.hunt.freezeUsed === 0 || d.hunt.reveal > 0 && d.hunt.revealUsed === 0)
      || typeof d.power !== "boolean" || typeof d.drained !== "boolean" || typeof d.player.light !== "boolean" || typeof d.player.crouched !== "boolean"
      || !number(d.player.stamina, 0, 100) || !number(d.player.battery, 0, 100) || !number(d.player.angle, -Math.PI, Math.PI) || !number(d.hunter.angle, -Math.PI, Math.PI)
      || d.player.pitch !== undefined && !number(d.player.pitch, -1.3, 1.3)
      || d.hidden !== undefined && !PROPS.some(o => o.id === d.hidden && o.kind === "wardrobe")) throw new Error("逃生存档格式不正确");
    if ((d.phase === "lost") !== (d.captures === 3) || d.phase === "caught" && d.captures === 0
      || d.power && !d.inventory.includes("fuse") || d.drained && !d.power
      || d.phase === "won" && (!d.drained || !d.inventory.includes("cutters"))
      || d.expansion === undefined && (d.inventory.includes("handwheel") || d.searched.some(id => EXPANSION_PROPS.has(id)) || d.notes.includes("boiler-note")
        || d.opened.some(id => EXPANSION_DOORS.has(id)) || d.unlocked.some(id => EXPANSION_DOORS.has(id))
        || inExpansionRoom(d.player) || inExpansionRoom(d.hunter)
        || d.pursuit && inExpansionRoom(d.pursuit.target)
        || d.pursuit?.seenHide && EXPANSION_PROPS.has(d.pursuit.seenHide)
        || d.explored?.some(index => inExpansionRoom({ x: index % SIZE + .5, z: Math.floor(index / SIZE) + .5 })))
      || d.expansion !== undefined && (d.inventory.includes("handwheel") !== d.searched.includes("changing-drawer")
        || d.expansion.valves.length > 0 && (!d.inventory.includes("handwheel") || !d.power)
        || d.drained && d.expansion.valves.length !== VALVE_ORDER.length)
      || DOORS.some(door => door.key && d.unlocked.includes(door.id) && !d.inventory.includes(door.key))
      || PROPS.some(o => o.loot && d.searched.includes(o.id) && !d.inventory.includes(o.loot))) throw new Error("逃生存档目标状态不正确");
    const world = new EscapeWorld(); world.data = JSON.parse(JSON.stringify(d));
    if (!world.data.hunt) world.data.hunt = { version: 1, effort: 0, panting: false, breathIn: 0, glare: 0, lightArmed: true, freeze: 0, reveal: 0, collected: [], freezeUsed: 0, revealUsed: 0, rng: (Math.random() * 0xffffffff) >>> 0 || 1, recent: [] };
    for (const p of [d.player, d.hunter]) if (!number(p.x, .2, SIZE - .2) || !number(p.z, .2, SIZE - .2) || world.wall(p.x, p.z)) throw new Error("逃生存档位置不正确");
    if (d.hidden && dist(d.player, PROPS.find(o => o.id === d.hidden)!) > 1.9) throw new Error("逃生存档藏匿位置不正确");
    world.data.player.pitch ??= 0;
    if (d.hidden) {
      const cabinet = PROPS.find(o => o.id === d.hidden)!;
      Object.assign(world.data.player, { x: cabinet.x, z: cabinet.z + .08, angle: Math.PI / 2, pitch: 0 });
    }
    if (d.pursuit) {
      const m = d.pursuit;
      if (!m.target || !number(m.target.x, .2, SIZE - .2) || !number(m.target.z, .2, SIZE - .2) || !number(m.unseen, 0, 86400) || !number(m.wait, -10, 86400)
        || !Number.isInteger(m.patrolIndex) || !number(m.patrolIndex, 0, (d.expansion?.enabled ? patrol.length : 6) - 1) || m.seenHide !== undefined && !PROPS.some(o => o.id === m.seenHide && o.kind === "wardrobe")) throw new Error("逃生存档格式不正确");
      world.target = { ...m.target }; world.seenHide = m.seenHide; world.unseen = m.unseen; world.wait = m.wait; world.patrolIndex = m.patrolIndex;
    }
    world.mapPosition = "";
    if (!d.explored) world.revealMap();
    return world;
  }
}
