import type { Level, Point } from "./levels.ts";
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
};
export class FluidWorld {
  readonly dirt = new Uint8Array(COLS * ROWS);
  readonly stone = new Uint8Array(COLS * ROWS);
  particles: Particle[] = [];
  delivered = 0;
  collected = 0;
  elapsed = 0;
  private accumulator = 0;
  level: Level;
  constructor(level: Level) {
    this.level = level;
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const x = col * CELL,
          y = row * CELL,
          i = row * COLS + col;
        if (y >= 200 && y < 592) this.dirt[i] = 1;
        if (x < 16 || x >= 464 || (y >= 592 && !(x >= 352 && x < 432)))
          this.stone[i] = 1;
        if (y >= 112 && y < 200 && (x < 40 || x >= 176)) this.stone[i] = 1;
        for (const r of level.rocks)
          if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
            this.stone[i] = 1;
      }
    for (let row = 0; row < 13; row++)
      for (let col = 0; col < 16; col++) {
        const x = 48 + col * 7,
          y = 100 + row * 7;
        this.particles.push({ x, y, oldX: x, oldY: y, vx: 0, vy: 0 });
      }
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
    for (const p of this.particles) {
      p.oldX = p.x;
      p.oldY = p.y;
      p.vy = Math.min(p.vy + 820 * dt, 440);
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
      this.level.coins.forEach((coin, i) => {
        if (Math.hypot(p.x - coin.x, p.y - coin.y) < 20)
          this.collected |= 1 << i;
      });
      if (p.y > 608 && p.x > 352 && p.x < 432) this.delivered++;
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
