import type { Artwork } from "../artwork";
import type { Point } from "./levels";

// All motion comes from the game's active clock: pausing freezes the entire scene.
export function hauntState(time: number, reducedMotion = false, won = false) {
  const phase = time % 12, running = !won && !reducedMotion && phase >= 3 && phase < 10;
  const travel = (phase - 3) / 7 * Math.PI * 6;
  return {
    running,
    laughing: won || phase < 3,
    x: running ? 221 + Math.cos(travel) * 150 : 371,
    facingLeft: Math.sin(travel) > 0,
    stride: (Math.sin(time * 15) + 1) / 2,
    beam: reducedMotion ? .55 : phase < 4 ? Math.sin(phase / 4 * Math.PI) : 0,
    angle: reducedMotion ? 1.6 : 1.6 + Math.sin(time * .6) * .62,
  };
}

export class HorrorScene {
  private darkness = document.createElement("canvas");
  constructor() { this.darkness.width = 480; this.darkness.height = 800; }
  drawFrog(ctx: CanvasRenderingContext2D, art: Artwork, time: number, reduced: boolean, won: boolean) {
    const state = hauntState(time, reduced, won), size = state.running ? 172 : 200;
    ctx.save();
    ctx.translate(state.x, 786 + (reduced ? 0 : Math.sin(time * (state.laughing ? 14 : 8)) * (state.laughing ? 2.6 : 1.8)));
    if (state.running && !state.facingLeft) ctx.scale(-1, 1);
    if (state.laughing && !reduced) ctx.rotate(Math.sin(time * 10) * .018);
    if (state.running) {
      ctx.globalAlpha = 1;
      ctx.drawImage(art.hauntedFrog, 0, 512, 512, 512, -size / 2, -size, size, size);
      ctx.globalAlpha = state.stride;
      ctx.drawImage(art.hauntedFrog, 512, 512, 512, 512, -size / 2, -size, size, size);
    } else ctx.drawImage(art.hauntedFrog, state.laughing ? 512 : 0, 0, 512, 512, -size / 2, -size, size, size);
    ctx.restore();
  }
  drawLighting(ctx: CanvasRenderingContext2D, art: Artwork, time: number, pumpkins: Point[], reduced: boolean, won: boolean, cursor?: Point) {
    const state = hauntState(time, reduced, won), mask = this.darkness.getContext("2d")!;
    for (const lamp of pumpkins) ctx.drawImage(art.pumpkin, lamp.x - 24, lamp.y - 26, 48, 48);
    mask.clearRect(0, 0, 480, 800);
    mask.globalCompositeOperation = "source-over";
    mask.fillStyle = won ? "rgba(2,5,14,.35)" : "rgba(2,5,14,.64)";
    mask.fillRect(0, 0, 480, 800);
    mask.globalCompositeOperation = "destination-out";
    const light = (x: number, y: number, radius: number, strength: number) => {
      const glow = mask.createRadialGradient(x, y, 3, x, y, radius);
      glow.addColorStop(0, `rgba(0,0,0,${strength})`); glow.addColorStop(1, "transparent");
      mask.fillStyle = glow; mask.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };
    for (const lamp of pumpkins) light(lamp.x, lamp.y, 100, .86);
    // A small hand light follows touch / keyboard; periodic wide beams reveal more.
    light(cursor?.x ?? 104, cursor?.y ?? 205, 112, .66);
    light(392, 604, 62, .6);
    light(state.x, 710, won ? 230 : 110, won ? 1 : .65);
    if (state.beam > 0) {
      mask.save(); mask.translate(240, 76); mask.rotate(state.angle);
      const beam = mask.createRadialGradient(0, 0, 5, 0, 0, 760);
      beam.addColorStop(0, `rgba(0,0,0,${state.beam * .32})`); beam.addColorStop(.65, `rgba(0,0,0,${state.beam * .28})`); beam.addColorStop(1, "transparent");
      mask.fillStyle = beam;
      // Layer soft cone edges instead of switching whole regions on/off.
      for (let i = 0; i < 6; i++) {
        const halfAngle = .42 - i * .035;
        mask.beginPath(); mask.moveTo(0, 0); mask.arc(0, 0, 760, -halfAngle, halfAngle); mask.closePath(); mask.fill();
      }
      mask.restore();
    }
    mask.globalCompositeOperation = "source-over";
    ctx.drawImage(this.darkness, 0, 0);
    for (const lamp of pumpkins) {
      const glow = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, 55);
      glow.addColorStop(0, "rgba(255,137,28,.2)"); glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow; ctx.fillRect(lamp.x - 55, lamp.y - 55, 110, 110);
    }
  }
}
