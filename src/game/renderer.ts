import { CELL, COLS, FluidWorld, HEIGHT, ROWS, WIDTH } from "./fluid";
import type { Level, Point } from "./levels";

type Callbacks = {
  progress: (water: number, coins: number) => void;
  complete: (coins: number) => void;
  tap: () => void;
};
export class BathGame {
  world: FluidWorld;
  paused = false;
  won = false;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain = document.createElement("canvas");
  private terrainDirty = true;
  private raf = 0;
  private lastTime = 0;
  private clock = 0;
  private pointer?: Point;
  private cursor?: Point;
  private sprite = new Image();
  private spriteReady = false;
  private tapAt = -20;
  private lastDeliveryAt = -20;
  private lastDelivered = 0;
  private keyboardCursor = { x: 108, y: 200 };
  private controller = new AbortController();
  private callbacks: Callbacks;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  constructor(canvas: HTMLCanvasElement, level: Level, callbacks: Callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.world = new FluidWorld(level);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.ctx.scale(ratio, ratio);
    this.terrain.width = WIDTH;
    this.terrain.height = HEIGHT;
    this.sprite.onload = () => {
      this.spriteReady = true;
    };
    this.sprite.src = "/assets/character/milk-frog-atlas.webp";
    const signal = this.controller.signal;
    const point = (event: PointerEvent): Point => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - r.left) / r.width) * WIDTH,
        y: ((event.clientY - r.top) / r.height) * HEIGHT,
      };
    };
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || this.paused) return;
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(event.pointerId);
        this.pointer = point(event);
        this.cursor = this.pointer;
        if (this.pointer.y > 620) {
          this.tap();
          return;
        }
        this.dig(this.pointer, this.pointer);
      },
      { signal },
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        this.cursor = point(event);
        if (this.pointer) {
          this.dig(this.pointer, this.cursor);
          this.pointer = this.cursor;
        }
      },
      { signal },
    );
    const release = () => {
      this.pointer = undefined;
    };
    canvas.addEventListener("pointerup", release, { signal });
    canvas.addEventListener("pointercancel", release, { signal });
    canvas.addEventListener(
      "pointerleave",
      () => {
        if (!this.pointer) this.cursor = undefined;
      },
      { signal },
    );
    canvas.addEventListener(
      "keydown",
      (event) => {
        const directions: { [key: string]: Point } = {
          ArrowUp: { x: 0, y: -12 },
          ArrowDown: { x: 0, y: 12 },
          ArrowLeft: { x: -12, y: 0 },
          ArrowRight: { x: 12, y: 0 },
        };
        if (directions[event.key]) {
          event.preventDefault();
          const old = { ...this.keyboardCursor },
            d = directions[event.key];
          this.keyboardCursor = {
            x: Math.max(20, Math.min(460, old.x + d.x)),
            y: Math.max(200, Math.min(590, old.y + d.y)),
          };
          this.cursor = this.keyboardCursor;
          if (event.shiftKey) this.dig(old, this.cursor);
        } else if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          this.cursor = this.keyboardCursor;
          this.dig(this.cursor, this.cursor);
        }
      },
      { signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        this.lastTime = 0;
        this.pointer = undefined;
      },
      { signal },
    );
    this.raf = requestAnimationFrame(this.frame);
  }
  private dig(a: Point, b: Point) {
    if (!this.paused && !this.won && this.world.digLine(a, b))
      this.terrainDirty = true;
  }
  tap() {
    this.tapAt = this.clock;
    this.callbacks.tap();
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.controller.abort();
    this.sprite.onload = null;
  }
  private frame = (time: number) => {
    const seconds = this.lastTime
      ? Math.min((time - this.lastTime) / 1000, 0.05)
      : 0;
    this.lastTime = time;
    if (!document.hidden && !this.paused) {
      this.clock += seconds;
      if (!this.won) this.world.advance(seconds);
      if (this.world.delivered !== this.lastDelivered) {
        this.lastDeliveryAt = this.clock;
        this.lastDelivered = this.world.delivered;
      }
      this.callbacks.progress(this.world.delivered, this.world.collected);
      if (!this.won && this.world.delivered >= 100) {
        this.won = true;
        this.callbacks.complete(this.world.collected);
      }
    }
    if (!document.hidden) this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };
  private paintTerrain() {
    const ctx = this.terrain.getContext("2d")!;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        if (this.world.stone[i]) {
          ctx.fillStyle = (row + col) % 11 === 0 ? "#85969c" : "#758891";
          ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
        } else if (this.world.dirt[i]) {
          ctx.fillStyle =
            (row * 17 + col * 23) % 19 === 0 ? "#d4a573" : "#dfb585";
          ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
          if ((row * 7 + col) % 7 === 0) {
            ctx.fillStyle = "#c99c6c";
            ctx.fillRect(col * CELL + 2, row * CELL + 3, 2, 1);
          }
        }
      }
    this.terrainDirty = false;
  }
  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
  ) {
    this.ctx.fillStyle = fill;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.ctx.fill();
  }
  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#eef3e9";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const sky = ctx.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, "#e8f4ef");
    sky.addColorStop(1, "#d5e8df");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, 200);
    ctx.fillStyle = "#aecbbc";
    ctx.beginPath();
    ctx.ellipse(368, 119, 155, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d1e3d2";
    ctx.beginPath();
    ctx.ellipse(365, 117, 150, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#597866";
    ctx.font = "600 15px sans-serif";
    ctx.fillText("清水池", 47, 67);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#83998b";
    ctx.fillText("↓  从这里开始挖", 46, 91);
    if (this.terrainDirty) this.paintTerrain();
    ctx.drawImage(this.terrain, 0, 0);
    ctx.fillStyle = "#38b8e2";
    ctx.beginPath();
    for (const p of this.world.particles) {
      ctx.moveTo(p.x + 4.5, p.y);
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = "#9ee5f3";
    for (let i = 0; i < this.world.particles.length; i += 12) {
      const p = this.world.particles[i];
      ctx.beginPath();
      ctx.arc(p.x - 0.8, p.y - 1.2, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < this.world.level.coins.length; i++) {
      const coin = this.world.level.coins[i],
        collected = Boolean(this.world.collected & (1 << i));
      ctx.globalAlpha = collected ? 0.25 : 1;
      ctx.fillStyle = "#ffe5a1";
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d1a447";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#c7973e";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✦", coin.x, coin.y + 5);
      ctx.textAlign = "start";
      ctx.globalAlpha = 1;
    }
    this.drawBathroom();
    if (
      this.cursor &&
      this.cursor.y >= 195 &&
      this.cursor.y < 595 &&
      !this.won
    ) {
      ctx.strokeStyle = "#ffffff9e";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(this.cursor.x, this.cursor.y, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.paused) {
      ctx.fillStyle = "#244b548c";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "white";
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("休息一下", WIDTH / 2, 360);
      ctx.textAlign = "start";
    }
  }
  private drawBathroom() {
    const ctx = this.ctx;
    ctx.fillStyle = "#f4eee0";
    ctx.fillRect(0, 622, WIDTH, 178);
    ctx.strokeStyle = "#e4dccc";
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 622);
      ctx.lineTo(x, 800);
      ctx.stroke();
    }
    for (let y = 622; y < HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
    this.roundRect(352, 594, 80, 18, 5, "#516b76");
    ctx.strokeStyle = "#91a6aa";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(392, 611);
    ctx.lineTo(392, 629);
    ctx.lineTo(451, 629);
    ctx.lineTo(451, 677);
    ctx.lineTo(438, 677);
    ctx.stroke();
    ctx.strokeStyle = "#c4d4d4";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(392, 615);
    ctx.lineTo(392, 629);
    ctx.lineTo(447, 629);
    ctx.lineTo(447, 674);
    ctx.stroke();
    ctx.fillStyle = "#7096a6";
    ctx.beginPath();
    ctx.arc(452, 651, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cee0e3";
    ctx.fillRect(448, 643, 8, 3);
    ctx.fillStyle = "#8f9684";
    ctx.font = "12px sans-serif";
    ctx.fillText(this.won ? "终于可以洗澡啦！" : "奶蛙在等水…", 25, 658);
    ctx.fillStyle = "#abb3a3";
    ctx.font = "10px sans-serif";
    ctx.fillText("点点奶蛙，敲敲水龙头", 25, 678);
    if (this.spriteReady) {
      const cycle = this.clock % 13,
        tapElapsed = this.clock - this.tapAt;
      let frame = this.won
        ? 6
        : cycle > 8 && cycle < 10
          ? 5
          : cycle > 5 && cycle < 7
            ? 2
            : this.clock % 4.6 > 4.42
              ? 1
              : 0;
      if (
        !this.won &&
        !this.reducedMotion &&
        ((cycle > 10 && cycle < 12.1) || (tapElapsed >= 0 && tapElapsed < 2.1))
      ) {
        const t = tapElapsed < 2.1 ? tapElapsed : cycle - 10;
        frame = t < 0.35 ? 2 : t < 0.75 ? 3 : t < 1.65 ? 4 : 0;
      }
      if (this.won && !this.reducedMotion && this.clock % 3 < 0.7) frame = 7;
      const bounce = this.reducedMotion
        ? 0
        : this.won
          ? Math.sin(this.clock * 5) * 2
          : Math.sin(this.clock * 2.2) * 1.5;
      const breathe = this.reducedMotion
        ? 1
        : 1 + Math.sin(this.clock * 2.2) * 0.009;
      const frameWidth = this.sprite.width / 4,
        frameHeight = this.sprite.height / 2;
      const height = 182 * breathe;
      ctx.drawImage(
        this.sprite,
        (frame % 4) * frameWidth,
        Math.floor(frame / 4) * frameHeight,
        frameWidth,
        frameHeight,
        286,
        793 - height + bounce,
        174,
        height,
      );
    } else {
      ctx.fillStyle = "#809487";
      ctx.font = "12px sans-serif";
      ctx.fillText("奶蛙正在赶来…", 320, 709);
    }
    if (this.won || this.clock - this.lastDeliveryAt < 1) {
      ctx.strokeStyle = "#48b9df";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(438, 681);
      ctx.lineTo(438, 751);
      ctx.stroke();
      ctx.fillStyle = "#a3ddee";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(
          438 + Math.sin(this.clock * 3 + i) * 4,
          685 + ((this.clock * 60 + i * 13) % 65),
          2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    this.roundRect(283, 752, 185, 37, 13, "#c7dce0");
    this.roundRect(288, 748, 175, 17, 9, "#f8fafa");
    this.roundRect(296, 750, 159, 10, 6, "#daedf1");
    if (this.world.delivered)
      this.roundRect(
        298,
        751,
        Math.max(10, 154 * Math.min(1, this.world.delivered / 100)),
        7,
        5,
        "#78cde6",
      );
    this.roundRect(302, 787, 12, 8, 3, "#90a9b2");
    this.roundRect(439, 787, 12, 8, 3, "#90a9b2");
    ctx.lineCap = "butt";
  }
}
