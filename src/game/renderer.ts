import { CELL, COLS, FluidWorld, HEIGHT, ROWS, WIDTH } from "./fluid";
import type { Level, Point } from "./levels";
import type { Artwork } from "../artwork";
import type { Settings } from "../settings";
import { FrogAnimator } from "./character";
import { HorrorScene, hauntState } from "./horror";
import { BathDeadline } from "./deadline.ts";

export type RunResult = { collected: number; elapsedMs: number };
type Preferences = {
  art: Artwork;
  reducedMotion: boolean;
  quality: Settings["quality"];
};

type Callbacks = {
  progress: (water: number, coins: number) => void;
  complete: (result: RunResult) => void;
  failed: (reason: "pollution" | "timeout") => void;
  deadline?: (remainingMs: number, limitMs: number) => void;
  caught?: () => void;
  tap: () => void;
  dig: () => void;
  devices: (interacted?: boolean) => void;
  haunt: () => void;
};
export class BathGame {
  world: FluidWorld;
  private pauseState = false;
  get paused() {
    return this.pauseState;
  }
  set paused(value: boolean) {
    if (value === this.pauseState || this.destroyed) return;
    this.pauseState = value;
    this.pointer = undefined;
    if (value) {
      cancelAnimationFrame(this.raf);
      this.draw();
    } else {
      this.lastTime = 0;
      this.raf = requestAnimationFrame(this.frame);
    }
  }
  won = false;
  lost = false;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain = document.createElement("canvas");
  private rockMask = document.createElement("canvas");
  private terrainDirty = true;
  private raf = 0;
  private lastTime = 0;
  private clock = 0;
  private pointer?: Point;
  private cursor?: Point;
  private artwork: Artwork;
  private stageArt: HTMLImageElement;
  private animator = new FrogAnimator();
  private horror?: HorrorScene;
  private deadline?: BathDeadline;
  private failureReported = false;
  get catching() { return this.deadline?.phase === "catching"; }
  private laughCycle = -1;
  private startedAt?: number;
  private destroyed = false;
  private tapAt = -20;
  private lastDeliveryAt = -20;
  private lastDelivered = 0;
  private keyboardCursor = { x: 108, y: 200 };
  private controller = new AbortController();
  private callbacks: Callbacks;
  private reducedMotion: boolean;
  constructor(
    canvas: HTMLCanvasElement,
    level: Level,
    callbacks: Callbacks,
    preferences: Preferences,
  ) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.artwork = preferences.art;
    this.stageArt = level.scene && level.scene !== "bath" ? preferences.art[level.scene] : preferences.art.stage;
    if (level.mode) this.horror = new HorrorScene();
    if (level.timeLimitMs !== undefined) this.deadline = new BathDeadline(level.timeLimitMs);
    this.reducedMotion = preferences.reducedMotion;
    this.world = new FluidWorld(level);
    const ratio = Math.min(
      devicePixelRatio || 1,
      preferences.quality === "high" ? 2 : 1.5,
    );
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.ctx.scale(ratio, ratio);
    this.terrain.width = WIDTH;
    this.terrain.height = HEIGHT;
    this.rockMask.width = WIDTH;
    this.rockMask.height = HEIGHT;
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
        if (event.button !== 0 || this.paused || this.won || this.lost) return;
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(event.pointerId);
        this.pointer = point(event);
        this.cursor = this.pointer;
        if (this.activateDevice(this.pointer)) {
          this.pointer = undefined;
          return;
        }
        if (this.pointer.y > 620) {
          this.tap();
          this.pointer = undefined;
          return;
        }
        this.dig(this.pointer, this.pointer);
      },
      { signal },
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        if (this.paused || this.won || this.lost) return;
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
        if (this.paused || this.won || this.lost) return;
        if (["f", "v", "b", "e"].includes(event.key.toLowerCase())) {
          event.preventDefault();
          const key = event.key.toLowerCase(),
            device = key === "f" ? this.world.level.fans?.[0] : key === "e" ? this.world.level.sponges?.find((_sponge, index) => this.world.spongeContents[index].length > 0) : this.world.level.valves?.find(valve => key === "b" ? valve.kind === "sewage" : valve.kind !== "sewage");
          if (!event.repeat && device) this.activateDevice(device.position);
          return;
        }
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
    if (!this.paused && !this.won && !this.lost && this.world.digLine(a, b)) {
      this.terrainDirty = true;
      this.startedAt ??= this.clock;
      this.callbacks.dig();
    }
  }
  setPreferences(preferences: Pick<Settings, "reducedMotion" | "quality">) {
    this.reducedMotion = preferences.reducedMotion;
    const ratio = Math.min(
      devicePixelRatio || 1,
      preferences.quality === "high" ? 2 : 1.5,
    );
    this.canvas.width = WIDTH * ratio;
    this.canvas.height = HEIGHT * ratio;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (this.paused) this.draw();
  }
  tap() {
    this.tapAt = this.clock;
    this.callbacks.tap();
  }
  activateDevice(point: Point) {
    if (this.paused || this.won || this.lost) return false;
    const fan = this.world.level.fans?.findIndex(device => Math.hypot(device.position.x - point.x, device.position.y - point.y) <= 32) ?? -1;
    const valve = this.world.level.valves?.findIndex(device => Math.hypot(device.position.x - point.x, device.position.y - point.y) <= 32) ?? -1;
    const sponge = this.world.level.sponges?.findIndex(device => Math.hypot(device.position.x - point.x, device.position.y - point.y) <= 32) ?? -1;
    const changed = fan >= 0 ? this.world.toggleFan(fan) : valve >= 0 ? this.world.toggleValve(valve) : sponge >= 0 ? this.world.squeezeSponge(sponge) : false;
    if (changed) {
      this.startedAt ??= this.clock;
      this.callbacks.tap();
      this.callbacks.devices(true);
    }
    return changed;
  }
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.controller.abort();
  }
  private frame = (time: number) => {
    if (this.destroyed) return;
    const elapsed = this.lastTime
      ? Math.max(0, (time - this.lastTime) / 1000)
      : 0;
    const seconds = Math.min(elapsed, 0.05);
    this.lastTime = time;
    if (!document.hidden && !this.paused) {
      // Score/animation use active wall time; only physics has a capped step.
      // A slow render must not award an unfair time bonus.
      this.clock += elapsed;
      if (this.deadline) {
        const before = this.deadline.phase;
        this.deadline.advance(elapsed * 1000);
        this.callbacks.deadline?.(this.deadline.remainingMs, this.deadline.limitMs);
        if (before === "running" && this.deadline.phase === "catching") {
          this.lost = true; this.pointer = undefined; this.callbacks.caught?.();
        }
        if (this.deadline.phase === "caught" && !this.failureReported) {
          this.failureReported = true; this.callbacks.failed("timeout");
        }
      }
      if (this.horror && !this.won && !this.lost && hauntState(this.clock).laughing && Math.floor(this.clock / 12) !== this.laughCycle) {
        this.laughCycle = Math.floor(this.clock / 12);
        this.callbacks.haunt();
      }
      if (!this.won && !this.lost) this.world.advance(seconds);
      if (this.world.delivered !== this.lastDelivered) {
        this.lastDeliveryAt = this.clock;
        this.lastDelivered = this.world.delivered;
      }
      this.callbacks.progress(this.world.delivered, this.world.collected);
      this.callbacks.devices();
      if (!this.won && !this.lost && this.world.dirtyDelivered > 0) {
        this.deadline?.finish();
        this.lost = true;
        this.callbacks.failed("pollution");
      }
      if (!this.won && !this.lost && this.world.delivered >= 100) {
        this.deadline?.finish();
        this.won = true;
        this.callbacks.complete({
          collected: this.world.collected,
          elapsedMs: Math.min(
            3_600_000,
            Math.round((this.clock - (this.startedAt ?? this.clock)) * 1000),
          ),
        });
      }
    }
    if (!document.hidden) this.draw();
    if (!this.paused) this.raf = requestAnimationFrame(this.frame);
  };
  private paintTerrain() {
    const ctx = this.terrain.getContext("2d")!;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // The grid is a collision/edit mask. Soil itself comes from the painted art.
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        if (this.world.dirt[i] && !this.world.stone[i]) {
          ctx.fillStyle = "white";
          ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
        }
      }
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(this.stageArt, 0, 0, WIDTH, HEIGHT);
    ctx.globalCompositeOperation = "source-over";
    const rocks = this.rockMask.getContext("2d")!;
    rocks.clearRect(0, 0, WIDTH, HEIGHT);
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        if (!this.world.stone[row * COLS + col]) continue;
        rocks.fillStyle = "white";
        rocks.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    rocks.globalCompositeOperation = "source-in";
    rocks.filter = "saturate(.3) brightness(.58)";
    const rx = this.stageArt.naturalWidth / WIDTH, ry = this.stageArt.naturalHeight / HEIGHT;
    const seasonal = Boolean(this.world.level.timeLimitMs);
    rocks.drawImage(this.stageArt, 0, (seasonal ? 240 : 0)*ry, WIDTH*rx, (seasonal ? 200 : 178)*ry, 0, 0, WIDTH, 624);
    rocks.filter = "none";
    rocks.globalCompositeOperation = "source-over";
    ctx.drawImage(this.rockMask, 0, 0);
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
    ctx.drawImage(this.stageArt, 0, 0, WIDTH, HEIGHT);
    // An excavated tunnel reveals the painted tiled wall under the soil layer.
    const rx = this.stageArt.naturalWidth / WIDTH, ry = this.stageArt.naturalHeight / HEIGHT;
    ctx.drawImage(this.stageArt, 0, (this.world.level.timeLimitMs ? 624 : 0)*ry, WIDTH*rx, 100*ry, 0, 200, WIDTH, 422);
    ctx.fillStyle = this.world.level.mode === "infernal" ? "#240a08b3" : this.world.level.mode === "halloween" ? "#200d30b3" : this.world.level.scene === "workshop" ? "#44301cb3" : "#073c42b3";
    ctx.fillRect(0, 200, WIDTH, 422);
    if (this.terrainDirty) this.paintTerrain();
    ctx.drawImage(this.terrain, 0, 0);
    for (const kind of ["clean", "sewage"]) {
      ctx.fillStyle = kind === "clean" ? "#38b8e2" : "#a268bd";
      ctx.beginPath();
      for (const p of this.world.particles) {
        if ((p.kind ?? "clean") !== kind) continue;
        ctx.moveTo(p.x + 4.5, p.y);
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    for (let i = 0; i < this.world.particles.length; i += 12) {
      const p = this.world.particles[i];
      ctx.fillStyle = p.kind === "sewage" ? "#dec0e8" : "#9ee5f3";
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
    this.drawDevices();
    this.drawBathroom();
    this.horror?.drawLighting(ctx, this.artwork, this.clock, this.world.level.pumpkins ?? [], this.reducedMotion, this.won, this.cursor);
    if (this.deadline && ["catching", "caught"].includes(this.deadline.phase)) this.drawCapture();
    if (
      this.cursor &&
      this.cursor.y >= 195 &&
      this.cursor.y < 595 &&
      !this.won
      && !this.lost
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
  private drawDevices() {
    const ctx = this.ctx, sheet = this.artwork.props;
    this.world.level.sponges?.forEach((sponge, index) => {
      const stored = this.world.spongeContents[index].length,
        queued = this.world.spongeQueued[index].length, scale = .17;
      ctx.save(); ctx.translate(sponge.position.x, sponge.position.y);
      if (queued && !this.reducedMotion) ctx.scale(1.03, 1 - Math.abs(Math.sin(this.clock * 12)) * .08);
      ctx.drawImage(this.artwork.garden, stored + queued ? 512 : 0, 512, 512, 512, -256 * scale, -256 * scale, 512 * scale, 512 * scale);
      ctx.restore();
      ctx.fillStyle = "#fff9e8"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${stored} / ${sponge.capacity}`, sponge.position.x, sponge.position.y + 53);
      ctx.textAlign = "start";
    });
    this.world.level.fans?.forEach((fan, index) => {
      const { x, y } = fan.position, scale = .2;
      ctx.save();
      ctx.translate(x, y);
      ctx.drawImage(sheet, 0, 0, 512, 512, -256 * scale, -190 * scale, 512 * scale, 512 * scale);
      ctx.save();
      if (this.world.fanOn[index] && !this.reducedMotion) ctx.rotate(this.clock * 13);
      ctx.drawImage(sheet, 512, 0, 512, 512, -256 * scale, -190 * scale, 512 * scale, 512 * scale);
      ctx.restore();
      if (this.world.fanOn[index]) {
        ctx.rotate(Math.atan2(fan.force.y, fan.force.x));
        ctx.strokeStyle = "#d2ffffa8";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const offset = this.reducedMotion ? 30 + i * 16 : 25 + ((this.clock * 55 + i * 28) % 75);
          ctx.beginPath(); ctx.moveTo(offset, -12 + i * 12); ctx.lineTo(offset + 18, -12 + i * 12); ctx.stroke();
        }
      }
      ctx.restore();
    });
    this.world.level.valves?.forEach((valve, index) => {
      const on = this.world.valveOn[index], scale = .2;
      ctx.drawImage(sheet, on ? 512 : 0, 512, 512, 512, valve.nozzle.x - 435 * scale, valve.nozzle.y - 370 * scale, 512 * scale, 512 * scale);
    });
    this.world.level.plants?.forEach((plant, index) => {
      const alive = this.world.plantRemaining[index] > 0, scale = .18;
      ctx.save(); ctx.translate(plant.position.x, plant.position.y);
      if (!this.reducedMotion && alive) ctx.rotate(Math.sin(this.clock * 1.8 + index) * .025);
      ctx.globalAlpha = alive ? 1 : .65;
      ctx.drawImage(this.artwork.garden, alive ? 0 : 512, 0, 512, 512, -256 * scale, -436 * scale, 512 * scale, 512 * scale);
      ctx.restore();
      ctx.fillStyle = "#fff9e8"; ctx.font = "bold 11px sans-serif";
      ctx.fillText(alive ? String(this.world.plantRemaining[index]) : "枯萎", plant.rect.x + plant.rect.w + 5, plant.rect.y + 20);
    });
    // Plant art can overlap a nozzle. Keep source type and budget readable.
    this.world.level.valves?.forEach((valve, index) => {
      const dirty = valve.kind === "sewage",
        label = `${dirty ? "污水" : "清水"} ${this.world.valveRemaining[index]}`;
      ctx.save();
      ctx.font = "bold 11px sans-serif";
      const width = ctx.measureText(label).width + 12;
      this.roundRect(valve.position.x - width / 2, valve.position.y + 29, width, 18, 6, dirty ? "#48305aeb" : "#294a47eb");
      ctx.fillStyle = dirty ? "#f5d8ff" : "#fff9e8";
      ctx.textAlign = "center";
      ctx.fillText(label, valve.position.x, valve.position.y + 42);
      ctx.restore();
    });
  }
  private drawBathroom() {
    const ctx = this.ctx;
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
    const capturing = this.deadline && ["catching", "caught"].includes(this.deadline.phase);
    if (capturing) { /* The approaching pose is drawn once, above the whole bath. */ }
    else if (this.world.level.mode === "infernal" && !this.won) {
      const image = this.artwork.infernalFrog, frame = this.deadline && this.deadline.remainingMs < 7000 ? 1 : hauntState(this.clock).laughing ? 2 : 0;
      const bob = this.reducedMotion ? 0 : Math.sin(this.clock * 4) * 2;
      const height = 240, width = height*(image.width/3)/image.height;
      this.drawInfernalPose(frame,371-width/2,786-height+bob,width,height);
    }
    else if (this.horror) this.horror.drawFrog(ctx, this.artwork, this.clock, this.reducedMotion, this.won);
    else this.animator.draw(ctx, this.artwork, this.clock, {
      won: this.won,
      lost: this.lost,
      tapAt: this.tapAt,
      deliveryAt: this.lastDeliveryAt,
      reducedMotion: this.reducedMotion,
    });
    // The painted front rim covers the frog's feet; only live water is drawn.
    ctx.drawImage(this.artwork.tub, 273.6, 662, 204.8, 204.8);
    if (this.won || this.clock - this.lastDeliveryAt < 1) {
      ctx.strokeStyle = "#48b9df";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(438, 681);
      ctx.lineTo(438, 759);
      ctx.stroke();
      ctx.fillStyle = "#a3ddee";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(
          438 + Math.sin(this.clock * 3 + i) * 4,
          685 + ((this.clock * 60 + i * 13) % 73),
          2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    if (this.world.delivered) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(376, 759, 79, 4.5, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = .35 + .45 * Math.min(1, this.world.delivered / 100);
      ctx.fillStyle = "#58c3df";
      ctx.fill();
      ctx.strokeStyle = "#d3f5f4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const ripple = this.reducedMotion ? 0 : Math.sin(this.clock * 2) * 1.2;
      ctx.ellipse(418, 759 + ripple, 18, 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.lineCap = "butt";
  }
  private drawCapture() {
    const ctx = this.ctx, progress = this.deadline!.captureProgress;
    ctx.save();
    ctx.fillStyle = `rgba(6,0,4,${.35 + progress*.5})`; ctx.fillRect(0,0,WIDTH,HEIGHT);
    const image = this.artwork.infernalFrog, cell = image.width/3;
    const height = this.reducedMotion ? 650 : 330 + 350*Math.sin(progress*Math.PI/2), width = height*cell/image.height;
    this.drawInfernalPose(1,(WIDTH-width)/2,HEIGHT-height-10,width,height);
    ctx.restore();
  }
  private drawInfernalPose(frame: number, x: number, y: number, width: number, height: number) {
    const ctx = this.ctx, image = this.artwork.infernalFrog, cell = image.width/3;
    ctx.save();
    if(frame>0) {
      // Adjacent poses have a few toe pixels across the atlas cell boundary.
      // Clip only that empty lower-left gutter; native character pixels stay at source resolution.
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+width,y);ctx.lineTo(x+width,y+height);ctx.lineTo(x+width*.06,y+height);ctx.lineTo(x+width*.06,y+height*.65);ctx.lineTo(x,y+height*.65);ctx.closePath();ctx.clip();
    }
    ctx.drawImage(image,frame*cell,0,cell,image.height,x,y,width,height);
    ctx.restore();
  }
}
