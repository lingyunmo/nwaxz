import { DOORS, MAP, PROPS, ROOMS, SIZE, type EscapeWorld } from "./world.ts";
export type EscapeArt = { materials: HTMLImageElement; props: HTMLImageElement; frog: HTMLImageElement; details: HTMLImageElement };
export class EscapeRenderer {
  private ctx: CanvasRenderingContext2D;
  private textures: Uint8ClampedArray;
  private pixels?: ImageData;
  private depth: number[] = [];
  constructor(private canvas: HTMLCanvasElement, private art: EscapeArt, private reduced: boolean) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    const texture = document.createElement("canvas"); texture.width = texture.height = 512;
    const tc = texture.getContext("2d")!; tc.drawImage(art.materials, 0, 0, 512, 512);
    this.textures = tc.getImageData(0, 0, 512, 512).data;
  }
  resize(high = false) {
    const rect = this.canvas.getBoundingClientRect(), ratio = rect.height / Math.max(1, rect.width);
    const w = Math.round(Math.min(high ? 460 : 320, rect.width, (high ? 800 : 600) / ratio));
    this.canvas.width = Math.max(160, w); this.canvas.height = Math.max(120, Math.round(w * ratio));
    this.pixels = this.ctx.createImageData(this.canvas.width, this.canvas.height);
  }
  draw(world: EscapeWorld) {
    const d = world.data, p = d.player, ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    if (!this.pixels) this.resize();
    const pixels = this.pixels!, out = pixels.data, tex = this.textures;
    const focal = h * .68, horizon = h * .47, cos = Math.cos(p.angle), sin = Math.sin(p.angle);
    const light = (distance: number, side = 0) => Math.min(1, .10 + (d.power ? .04 : 0) + (p.light && !d.hidden ? .95 / (1 + distance * .28) * Math.max(.08, 1 - Math.abs(side) * .38) : 0));
    // Painted floor / ceiling are projected through the same camera as walls.
    for (let y = 0; y < h; y++) {
      const ground = y > horizon, delta = Math.abs(y - horizon) || .1, distance = Math.min(60, (ground ? .75 : .95) * focal / delta);
      const bright = light(distance) * (ground ? .82 : .52), tile = ground ? 2 : 3;
      let wx = p.x + cos * distance - sin * (-w / 2 / focal) * distance;
      let wz = p.z + sin * distance + cos * (-w / 2 / focal) * distance;
      const stepX = -sin * distance / focal, stepZ = cos * distance / focal;
      for (let x = 0; x < w; x++, wx += stepX, wz += stepZ) {
        const tx = ((wx * 256) & 255) + (tile % 2) * 256, tz = ((wz * 256) & 255) + Math.floor(tile / 2) * 256;
        const at = (tz * 512 + tx) * 4, dest = (y * w + x) * 4;
        const shade = bright * (1 - Math.min(.45, Math.abs(x / w - .5) * .65));
        out[dest] = tex[at] * shade; out[dest + 1] = tex[at + 1] * shade; out[dest + 2] = tex[at + 2] * shade; out[dest + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const cell = this.art.materials.width / 2;
    for (let x = 0; x < w; x++) {
      const camera = (x - w / 2) / focal, rx = cos - sin * camera, rz = sin + cos * camera;
      let mx = Math.floor(p.x), mz = Math.floor(p.z), side = 0, type = 1;
      const dx = Math.abs(1 / (rx || 1e-9)), dz = Math.abs(1 / (rz || 1e-9)), sx = rx < 0 ? -1 : 1, sz = rz < 0 ? -1 : 1;
      let tx = (rx < 0 ? p.x - mx : mx + 1 - p.x) * dx, tz = (rz < 0 ? p.z - mz : mz + 1 - p.z) * dz;
      for (let i = 0; i < 64; i++) {
        if (tx < tz) { tx += dx; mx += sx; side = 0; } else { tz += dz; mz += sz; side = 1; }
        type = world.wall(mx + .5, mz + .5);
        if (type) break;
      }
      const distance = Math.max(.05, side ? tz - dz : tx - dx); this.depth[x] = distance;
      let u = side ? p.x + distance * rx : p.z + distance * rz; u -= Math.floor(u);
      if ((!side && rx > 0) || (side && rz < 0)) u = 1 - u;
      const top = horizon - .95 * focal / distance, height = 1.7 * focal / distance;
      ctx.drawImage(this.art.materials, (type === 2 ? cell : 0) + Math.min(cell - 1, Math.floor(u * cell)), 0, 1, cell, x, top, 1, height);
      ctx.fillStyle = `rgba(0,0,0,${1 - light(distance, camera) * (side ? .78 : 1)})`; ctx.fillRect(x, top, 1, height + 1);
      // Small, readable room signs above closed doorways.
    }
    type Sprite = { x: number; z: number; height: number; frame: number; enemy?: boolean; detail?: boolean };
    const sprites: Sprite[] = PROPS.map(o => ({ x: o.x, z: o.z, height: o.kind === "wardrobe" ? 1.45 : o.kind === "drawer" ? .7 : o.kind === "note" ? .22 : .8, detail: ["valve", "exit", "note"].includes(o.kind), frame: o.kind === "wardrobe" ? d.hidden === o.id ? 1 : 0 : o.kind === "drawer" ? 2 : o.kind === "power" ? 3 : o.kind === "exit" ? 0 : o.kind === "valve" ? 1 : 2 }));
    sprites.push({ x: d.hunter.x, z: d.hunter.z, height: 1.5, frame: d.hunter.state === "chase" ? 2 + Math.floor(d.elapsed * 5) % 2 : 0, enemy: true });
    sprites.sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z));
    for (const sprite of sprites) {
      const dx = sprite.x - p.x, dz = sprite.z - p.z, depth = dx * cos + dz * sin;
      if (depth < .16) continue;
      const center = w / 2 + (-dx * sin + dz * cos) * focal / depth;
      const sh = sprite.height * focal / depth, sw = sh * (sprite.enemy ? .9 : .85);
      const bob = !this.reduced && sprite.enemy ? Math.sin(d.elapsed * (d.hunter.state === "chase" ? 12 : 5)) * sh * .012 : 0;
      const top = horizon + .75 * focal / depth - sh + bob, left = center - sw / 2;
      const img = sprite.enemy ? this.art.frog : sprite.detail ? this.art.details : this.art.props, columns = 2, rows = sprite.enemy || sprite.detail ? 2 : 3;
      const cw = img.width / columns, ch = img.height / rows, fx = sprite.frame % columns * cw, fy = Math.floor(sprite.frame / columns) * ch;
      ctx.globalAlpha = Math.min(1, light(depth) + (sprite.enemy ? .08 : .02));
      for (let x = Math.max(0, Math.floor(left)); x < Math.min(w, left + sw); x++) {
        if (depth > this.depth[x]) continue;
        const column = Math.min(cw - 1, Math.max(0, (x - left) / sw * cw));
        ctx.drawImage(img, fx + column, fy, 1, ch, x, top, 1, sh);
      }
      ctx.globalAlpha = 1;
    }
    // Soft vignette and slit vision are interaction effects over painted art.
    const vignette = ctx.createRadialGradient(w / 2, h / 2, w * .15, w / 2, h / 2, Math.max(w, h) * .67);
    vignette.addColorStop(0, "transparent"); vignette.addColorStop(1, "rgba(0,0,0,.8)"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
    if (d.hidden) {
      ctx.fillStyle = "rgba(9,5,3,.96)"; ctx.fillRect(0, 0, w * .42, h); ctx.fillRect(w * .58, 0, w, h);
      ctx.fillRect(0, 0, w, h * .17); ctx.fillRect(0, h * .83, w, h);
    }
  }
  drawMap(canvas: HTMLCanvasElement, world: EscapeWorld) {
    canvas.width = canvas.height = 500; const c = canvas.getContext("2d")!, scale = 20;
    c.fillStyle = "#151e20"; c.fillRect(0, 0, 500, 500);
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) if (!MAP[z][x]) { c.fillStyle = "#657273"; c.fillRect(x * scale + 1, z * scale + 1, 18, 18); }
    for (const door of DOORS) { c.fillStyle = world.data.opened.includes(door.id) ? "#9db98a" : "#c99b57"; c.fillRect(door.x * scale + 2, door.z * scale + 6, 16, 8); }
    c.textAlign = "center"; c.font = "bold 13px sans-serif";
    for (const room of ROOMS) { c.fillStyle = "#152024"; c.fillText(room.name, (room.x + room.w / 2) * scale, (room.z + room.h / 2) * scale); }
    c.fillStyle = "#b9dbb4"; c.fillRect(20 * scale, 23 * scale, 20, 13); c.font = "11px sans-serif"; c.fillText("下水道", 20.5 * scale, 24.5 * scale);
    const p = world.data.player; c.fillStyle = "#ffe29b"; c.beginPath(); c.arc(p.x * scale, p.z * scale, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#ffe29b"; c.beginPath(); c.moveTo(p.x * scale, p.z * scale); c.lineTo((p.x + Math.cos(p.angle) * .75) * scale, (p.z + Math.sin(p.angle) * .75) * scale); c.stroke();
  }
}
