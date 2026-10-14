import type { Level, Point, WaterKind } from "./levels.ts";
export const WIDTH = 480,
  HEIGHT = 800,
  CELL = 8,
  COLS = WIDTH / CELL,
  ROWS = 78;
const RADIUS = 3.4;
export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  oldX: number;
  oldY: number;
  kind?: WaterKind;
};
export class FluidWorld {
  readonly dirt = new Uint8Array(COLS * ROWS);
  readonly stone = new Uint8Array(COLS * ROWS);
  particles: Particle[] = [];
  delivered = 0;
  dirtyDelivered = 0;
  collected = 0;
  elapsed = 0;
  readonly fanOn: boolean[];
  readonly valveOn: boolean[];
  readonly valveRemaining: number[];
  private valveFractions: number[];
  emitted = 0;
  private accumulator = 0;
  level: Level;
  constructor(level: Level) {
    this.level = level;
    this.fanOn = (level.fans ?? []).map(fan => fan.on);
    this.valveOn = (level.valves ?? []).map(() => false);
    this.valveRemaining = (level.valves ?? []).map(valve => valve.drops);
    this.valveFractions = (level.valves ?? []).map(() => 0);
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const x = col * CELL,
          y = row * CELL,
          i = row * COLS + col;
        if (y >= 200 && y < 592) this.dirt[i] = 1;
        if (x < 16 || x >= 464 || (y >= 592 && !(x >= 352 && x < 432)))
          this.stone[i] = 1;
        const extraBasin = level.extraPools?.some(pool => x >= pool.x - 8 && x < pool.x + pool.columns * 7 + 8);
        if (y >= 112 && y < 200 && (x < 40 || x >= 176) && !extraBasin) this.stone[i] = 1;
        for (const r of level.rocks)
          if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
            this.stone[i] = 1;
      }
    for (let row = 0; row < 13; row++)
      for (let col = 0; col < 16; col++) {
        const x = 48 + col * 7,
          y = 100 + row * 7;
        if (this.particles.length < (level.initialWater ?? 208))
          this.particles.push({ x, y, oldX: x, oldY: y, vx: 0, vy: 0 });
      }
    for (const pool of level.extraPools ?? [])
      for (let row = 0; row < pool.rows; row++)
        for (let col = 0; col < pool.columns; col++) {
          const x = pool.x + col * 7, y = pool.y + row * 7;
          this.particles.push({ x, y, oldX: x, oldY: y, vx: 0, vy: 0, kind: pool.kind });
        }
    this.emitted = this.particles.length;
  }
  toggleFan(index: number) {
    if (!this.level.fans?.[index]) return false;
    this.fanOn[index] = !this.fanOn[index];
    return true;
  }
  toggleValve(index: number) {
    if (!this.level.valves?.[index] || !this.valveRemaining[index]) return false;
    this.valveOn[index] = !this.valveOn[index];
    return true;
  }
  dig(x: number, y: number, radius = 25) {
    let changed = false;
    for (
      let row = Math.max(0, Math.floor((y - radius) / CELL));
      row <= Math.min(ROWS - 1, Math.floor((y + radius) / CELL));
      row++
    ) {
      for (
        let col = Math.max(0, Math.floor((x - radius) / CELL));
        col <= Math.min(COLS - 1, Math.floor((x + radius) / CELL));
        col++
      ) {
        const i = row * COLS + col;
        if (
          this.dirt[i] &&
          !this.stone[i] &&
          Math.hypot(col * CELL + 4 - x, row * CELL + 4 - y) <= radius
        ) {
          this.dirt[i] = 0;
          changed = true;
        }
      }
    }
    return changed;
  }
  digLine(a: Point, b: Point, radius = 25) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
    let changed = false;
    for (let i = 0; i <= steps; i++)
      changed =
        this.dig(
          a.x + ((b.x - a.x) * i) / steps,
          a.y + ((b.y - a.y) * i) / steps,
          radius,
        ) || changed;
    return changed;
  }
  advance(seconds: number) {
    this.accumulator = Math.min(this.accumulator + Math.max(0, seconds), 0.1);
    while (this.accumulator >= 1 / 60) {
      this.step(1 / 120);
      this.step(1 / 120);
      this.accumulator -= 1 / 60;
      this.elapsed += 1 / 60;
    }
  }
  private step(dt: number) {
    this.level.valves?.forEach((valve, index) => {
      if (!this.valveOn[index]) return;
      this.valveFractions[index] += valve.rate * dt;
      while (this.valveFractions[index] >= 1 && this.valveRemaining[index] > 0) {
        const x = valve.nozzle.x + ((this.valveRemaining[index] % 3) - 1) * 7,
          y = valve.nozzle.y;
        this.particles.push({ x, y, oldX: x, oldY: y, vx: 0, vy: 80 });
        this.valveFractions[index]--;
        this.valveRemaining[index]--;
        this.emitted++;
      }
      if (!this.valveRemaining[index]) this.valveOn[index] = false;
    });
    for (const p of this.particles) {
      p.oldX = p.x;
      p.oldY = p.y;
      p.vy = Math.min(p.vy + 820 * dt, 440);
      this.level.fans?.forEach((fan, index) => {
        const z = fan.zone;
        if (this.fanOn[index] && p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h) {
          p.vx = Math.max(-220, Math.min(220, p.vx + fan.force.x * dt));
          p.vy = Math.max(-350, Math.min(440, p.vy + fan.force.y * dt));
        }
      });
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.collide(p);
    }
    // Spatial buckets keep the neighbour constraints near-linear at this scale.
    // This is a lightweight particle solver, not a full SPH or PBF simulation.
    for (let iteration = 0; iteration < 3; iteration++) {
      const cells = new Map<number, number[]>();
      this.particles.forEach((p, i) => {
        const key = Math.floor(p.y / 8) * 1000 + Math.floor(p.x / 8),
          bucket = cells.get(key);
        if (bucket) bucket.push(i);
        else cells.set(key, [i]);
      });
      this.particles.forEach((p, i) => {
        const cx = Math.floor(p.x / 8),
          cy = Math.floor(p.y / 8);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            for (const j of cells.get((cy + dy) * 1000 + cx + dx) ?? []) {
              if (j <= i) continue;
              const q = this.particles[j],
                vx = q.x - p.x,
                vy = q.y - p.y,
                distance = Math.hypot(vx, vy);
              if (distance < RADIUS * 2 + .8 && (p.kind === "sewage" || q.kind === "sewage"))
                p.kind = q.kind = "sewage";
              if (distance > 0.001 && distance < RADIUS * 2) {
                const correction = ((RADIUS * 2 - distance) * 0.5) / distance;
                p.x -= vx * correction;
                p.y -= vy * correction;
                q.x += vx * correction;
                q.y += vy * correction;
              }
            }
      });
      for (const p of this.particles) this.collide(p);
    }
    const remaining: Particle[] = [];
    for (const p of this.particles) {
      p.vx = Math.max(-220, Math.min(220, (p.x - p.oldX) / dt)) * 0.997;
      p.vy = Math.max(-350, Math.min(440, (p.y - p.oldY) / dt));
      if (p.kind !== "sewage") this.level.coins.forEach((coin, i) => {
        if (Math.hypot(p.x - coin.x, p.y - coin.y) < 20) this.collected |= 1 << i;
      });
      if (p.y > 608 && p.x > 352 && p.x < 432) {
        if (p.kind === "sewage") this.dirtyDelivered++;
        else this.delivered++;
      }
      else remaining.push(p);
    }
    this.particles = remaining;
  }
  private collide(p: Particle) {
    p.x = Math.max(16 + RADIUS, Math.min(464 - RADIUS, p.x));
    p.y = Math.max(RADIUS, Math.min(622, p.y));
    const cx = Math.floor(p.x / CELL),
      cy = Math.floor(p.y / CELL);
    for (let row = cy - 1; row <= cy + 1; row++)
      for (let col = cx - 1; col <= cx + 1; col++) {
        if (col < 0 || row < 0 || col >= COLS || row >= ROWS) continue;
        const i = row * COLS + col;
        if (!this.dirt[i] && !this.stone[i]) continue;
        const left = col * CELL,
          top = row * CELL;
        const nx = Math.max(left, Math.min(left + CELL, p.x)),
          ny = Math.max(top, Math.min(top + CELL, p.y));
        const dx = p.x - nx,
          dy = p.y - ny,
          distance = Math.hypot(dx, dy);
        if (distance >= RADIUS) continue;
        if (distance > 0.001) {
          p.x += (dx / distance) * (RADIUS - distance);
          p.y += (dy / distance) * (RADIUS - distance);
        } else {
          const sides = [
              p.x - left,
              left + CELL - p.x,
              p.y - top,
              top + CELL - p.y,
            ],
            side = sides.indexOf(Math.min(...sides));
          if (side === 0) p.x = left - RADIUS;
          else if (side === 1) p.x = left + CELL + RADIUS;
          else if (side === 2) p.y = top - RADIUS;
          else p.y = top + CELL + RADIUS;
        }
      }
  }
}
