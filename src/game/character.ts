import type { Artwork } from "../artwork";

// The classic belly laugh leads every victory and remains the main loop.
export function victoryPose(elapsed: number, reducedMotion = false): number {
  if (reducedMotion) return 6;
  const phase = Math.max(0, elapsed) % 6;
  return phase < 3.6 ? 6 : phase < 4.5 ? 7 : phase < 5.4 ? 11 : 6;
}

// Each pose shares the same foot anchor. Blend poses while moving that anchor
// continuously, rather than switching full images abruptly.
export class FrogAnimator {
  private weights = Array<number>(12).fill(0);
  private lastTime = 0;
  private winAt = -1;
  private mixed = document.createElement("canvas");
  private mixedContext: CanvasRenderingContext2D;
  private mixedReady = false;
  constructor() {
    this.weights[0] = 1;
    this.mixed.width = this.mixed.height = 512;
    this.mixedContext = this.mixed.getContext("2d")!;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    art: Artwork,
    time: number,
    options: {
      won: boolean;
      lost: boolean;
      tapAt: number;
      deliveryAt: number;
      reducedMotion: boolean;
    },
  ) {
    const delta = this.lastTime
      ? Math.max(0, time - this.lastTime)
      : 0;
    this.lastTime = time;
    if (options.won && this.winAt < 0) this.winAt = time;
    const cycle = time % 22,
      tapping = time - options.tapAt;
    let pose = 0;
    if (options.won) {
      pose = victoryPose(time - this.winAt, options.reducedMotion);
    } else if (options.lost) pose = cycle % 4 < 2 ? 10 : 5;
    else if (time - options.deliveryAt < 0.8) pose = 10;
    else if (tapping < 2.3 || (cycle >= 14 && cycle < 16.3)) {
      const phase = tapping < 2.3 ? tapping : cycle - 14;
      pose = phase < 0.35 ? 2 : phase < 0.75 ? 3 : phase < 1.65 ? 4 : 2;
    } else if (cycle > 4 && cycle < 5.6) pose = 8;
    else if (cycle > 7.4 && cycle < 9) pose = 2;
    else if (cycle > 10.2 && cycle < 12) pose = 9;
    else if (cycle > 18 && cycle < 20) pose = 5;
    else if (time % 4.8 > 4.58) pose = 1;
    if (options.reducedMotion) pose = options.won ? 6 : options.lost ? 10 : 0;
    const blend = options.reducedMotion ? 1 : 1 - Math.exp(-delta / 0.065);
    const nextWeights = this.weights.map(
      (weight, index) => weight + ((index === pose ? 1 : 0) - weight) * blend,
    );
    const mixtureChanged =
      !this.mixedReady ||
      nextWeights.some(
        (weight, index) => Math.abs(weight - this.weights[index]) > 0.002,
      );
    this.weights = nextWeights;
    const laughing = options.won && pose === 6;
    const breath = options.reducedMotion ? 0 : Math.sin(time * (laughing ? 13 : 2)) * (laughing ? .022 : .013);
    const sway = options.reducedMotion ? 0 : Math.sin(time * 1.1) * 0.017;
    const jump =
      options.reducedMotion || !options.won || pose !== 7
        ? 0
        : Math.max(0, Math.sin((time - this.winAt) * 4)) * 5;
    const mixture = this.mixedContext;
    if (mixtureChanged) {
      mixture.clearRect(0, 0, 512, 512);
      // Add weighted premultiplied colors on transparent canvas. Source-over
      // would fade an opaque character to 75% opacity halfway between poses.
      mixture.globalCompositeOperation = "lighter";
      for (let index = 0; index < this.weights.length; index++) {
        if (this.weights[index] < 0.003) continue;
        const image = index < 8 ? art.frog : art.extra;
        const cell = index < 8 ? index : index - 8,
          columns = index < 8 ? 4 : 2;
        mixture.globalAlpha = this.weights[index];
        mixture.drawImage(
          image,
          (cell % columns) * 512,
          Math.floor(cell / columns) * 512,
          512,
          512,
          0,
          0,
          512,
          512,
        );
      }
      mixture.globalAlpha = 1;
      mixture.globalCompositeOperation = "source-over";
      this.mixedReady = true;
    }
    ctx.save();
    ctx.translate(
      371 + (options.reducedMotion ? 0 : Math.sin(time * 1.1) * 1.5),
      785 - jump,
    );
    ctx.rotate(sway);
    ctx.scale(1 - breath * 0.35, 1 + breath);
    ctx.drawImage(this.mixed, -98, (-476 / 512) * 196, 196, 196);
    ctx.restore();
  }
}
