import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Material } from "@babylonjs/core/Materials/material.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { DitheredTileFadeMaterialPlugin } from "@babylonjs/core/Materials/ditheredTileFadeMaterialPlugin.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { EscapeWorld } from "./world.ts";
import { frogViewDirection } from "./facing.ts";
import { DIRECTIONAL_ART } from "./directional-art.ts";

export type FrogPose = { sheet: "original" | "actions" | "directionIdle" | "directionWalk"; frame: number; mirror?: boolean; direction?: number; motion: "idle" | "walk" | "run" | "search" | "peek" | "lunge" | "laugh" };
export type FrogTextures = Record<FrogPose["sheet"], Texture>;
/** Original standing and belly-laugh frames are never replaced by inferred art. */
export function frogPose(world: EscapeWorld, clock: number, moving: boolean): FrogPose {
  const d = world.data, h = d.hunter, distance = Math.hypot(h.x - d.player.x, h.z - d.player.z);
  if (d.phase === "caught" || d.phase === "lost") return { sheet: "original", frame: 1, motion: "laugh" };
  if (h.state === "chase" && distance < 1.25) return { sheet: "actions", frame: 5, motion: "lunge" };
  if (d.hidden && h.state === "search" && distance < 3) return { sheet: "actions", frame: 4, motion: "peek" };
  if (h.state === "chase") {
    const step = Math.floor(clock * 5) % 2;
    return { sheet: "actions", frame: 6 + step, mirror: step === 1, motion: "run" };
  }
  if (h.state === "search" || h.state === "investigate" && !moving) return { sheet: "actions", frame: [1, 3, 2, 3][Math.floor(clock / 1.25) % 4], motion: "search" };
  if (moving) return { sheet: "original", frame: 2 + Math.floor(clock * 3.4) % 2, motion: "walk" };
  return clock % 4.7 > 4.54 ? { sheet: "actions", frame: 0, motion: "idle" } : { sheet: "original", frame: 0, motion: "idle" };
}

export function directionalFrogPose(world: EscapeWorld, clock: number, moving: boolean, direction: number, held?: FrogPose["motion"]): FrogPose {
  const old = frogPose(world, clock, moving);
  if (old.motion === "laugh") return old;
  const motion = held ?? old.motion;
  const locomotion = held ? motion === "walk" || motion === "run" : moving || motion === "run";
  if (direction === 0) {
    if (motion === "lunge") return { sheet: "actions", frame: 5, motion, direction };
    if (motion === "peek") return { sheet: "actions", frame: 4, motion, direction };
    // The canonical standing face and blink stay pixel-for-pixel in the front view.
    if (!locomotion) return clock % 4.7 > 4.54 ? { sheet: "actions", frame: 0, motion, direction } : { sheet: "original", frame: 0, motion, direction };
  }
  if (locomotion) {
    const running = motion === "run" || motion === "lunge";
    return { sheet: "directionWalk", frame: direction + Math.floor(clock * (running ? 6 : 4)) % 2 * 8, motion: running ? "run" : "walk", direction };
  }
  return { sheet: "directionIdle", frame: direction, motion: motion === "search" || motion === "peek" ? motion : "idle", direction };
}

export class PaintedFrog {
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  private overlays: { mesh: Mesh; material: StandardMaterial }[] = [];
  pose: FrogPose = { sheet: "original", frame: 0, motion: "idle" };
  private layers: { mesh: Mesh; material: StandardMaterial; textures: FrogTextures; pose: FrogPose; ground: number; dither?: DitheredTileFadeMaterialPlugin }[] = [];
  private base: number[] = [];
  private clock = 0;
  private active = 0;
  private fade = 1;
  private reduced: boolean;
  private direction?: number;
  private viewingFade = false;
  private bob = 0;
  private world?: EscapeWorld;
  constructor(scene: Scene, textures: FrogTextures, reduced = false) {
    this.reduced = reduced;
    this.root = new TransformNode("painted-hunter-world-position", scene);
    const vertices = new VertexData(), positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
    const columns = 10, rows = 12;
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      positions.push((x / columns - .5) * 2.55, y / rows * 2.55, 0);
      normals.push(0, 0, 1); uvs.push(x / columns, y / rows);
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const a = y * (columns + 1) + x, b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    this.base = positions; vertices.positions = positions; vertices.normals = normals; vertices.uvs = uvs; vertices.indices = indices;
    for (let i = 0; i < 2; i++) {
      const mesh = new Mesh(`original-art-frog-layer-${i}`, scene);
      vertices.applyToMesh(mesh, true); mesh.parent = this.root;
      // Only yaw faces the camera. Looking up/down never tips the character.
      mesh.billboardMode = Mesh.BILLBOARDMODE_Y; mesh.isPickable = false;
      const material = new StandardMaterial(`original-art-frog-${i}`, scene);
      material.disableLighting = true; material.backFaceCulling = false; material.specularColor = Color3.Black();
      material.diffuseColor = Color3.Black(); material.emissiveColor = Color3.White();
      material.useAlphaFromDiffuseTexture = true; material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
      material.alphaCutOff = .12; material.forceDepthWrite = true; material.fogEnabled = false;
      const cloned = Object.fromEntries(Object.entries(textures).map(([name, source]) => {
        const texture = source.clone()!; texture.hasAlpha = true;
        texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
        return [name, texture];
      })) as FrogTextures;
      mesh.material = material; mesh.visibility = i === 0 ? 1 : 0;
      this.layers.push({ mesh, material, textures: cloned, pose: this.pose, ground: 0 }); this.meshes.push(mesh);
      this.frame(i, this.pose);
      const overlay = mesh.clone(`hunter-reveal-overlay-${i}`, this.root, false)!;
      const overlayMaterial = material.clone(`hunter-reveal-material-${i}`)!;
      overlayMaterial.depthFunction = Engine.ALWAYS; overlayMaterial.disableDepthWrite = true; overlayMaterial.forceDepthWrite = false; overlayMaterial.alpha = .56;
      overlay.material = overlayMaterial; overlay.renderingGroupId = 1; overlay.visibility = 0;
      this.overlays.push({ mesh: overlay, material: overlayMaterial });
      // Attach after cloning the deliberate reveal ghost. Complementary screen
      // pixels keep the real body opaque while its old and new poses transition.
      this.layers[i].dither = new DitheredTileFadeMaterialPlugin(material);
    }
  }
  private frame(layer: number, pose: FrogPose) {
    const l = this.layers[layer], texture = l.textures[pose.sheet];
    if (pose.sheet === "directionIdle" || pose.sheet === "directionWalk") {
      const atlas = DIRECTIONAL_ART[pose.sheet], rect = atlas.frames[pose.frame];
      texture.uScale = rect.width / atlas.width; texture.vScale = rect.height / atlas.height;
      texture.uOffset = rect.x / atlas.width; texture.vOffset = 1 - (rect.y + rect.height) / atlas.height;
      // Tight, padded alpha bounds keep feet and eye level stable across paintings.
      const height = 2.45 / 2.55;
      l.mesh.scaling.set(height * rect.width / rect.height, height, 1);
      l.ground = -2.45 * rect.ground / rect.height;
    } else {
      const columns = pose.sheet === "original" ? 2 : 4;
      texture.uScale = 1 / columns - .004; texture.vScale = .496;
      texture.uOffset = pose.frame % columns / columns + .002;
      texture.vOffset = 1 - (Math.floor(pose.frame / columns) + 1) / 2 + .002;
      l.mesh.scaling.set(1, 1, 1);
      l.ground = 0;
    }
    // Alternate the leading leg, rather than repeating two knee-up poses.
    if (pose.mirror) { texture.uOffset += texture.uScale; texture.uScale *= -1; }
    l.material.diffuseTexture = texture; l.pose = pose;
  }
  animate(world: EscapeWorld, dt: number, moving: boolean) {
    const d = world.data, frozen = d.phase === "playing" && (d.hunt?.freeze ?? 0) > 0;
    const freshWorld = this.world !== world;
    if (freshWorld) {
      this.world = world; this.direction = undefined; this.clock = d.elapsed; this.bob = 0; this.viewingFade = false;
      for (const layer of this.layers) layer.mesh.updateVerticesData(VertexBuffer.PositionKind, this.base.slice(), false, false);
    }
    if (!frozen) this.clock += Math.min(.1, Math.max(0, dt));
    const caught = d.phase === "caught" || d.phase === "lost";
    const direction = caught ? 0 : frogViewDirection(d.hunter, d.player, this.direction);
    const changedView = direction !== this.direction;
    this.direction = caught ? undefined : direction;
    const next = directionalFrogPose(world, this.clock, moving, direction, frozen && !freshWorld ? this.pose.motion : undefined);
    if (freshWorld) {
      this.active = 0; this.frame(0, next); this.frame(1, next); this.fade = 1;
    } else if (next.sheet !== this.pose.sheet || next.frame !== this.pose.frame) {
      this.active = 1 - this.active; this.frame(this.active, next); this.fade = 0;
      this.viewingFade = frozen && changedView;
    }
    this.pose = next;
    if (frozen && !this.viewingFade) this.fade = 1;
    if (!frozen || this.viewingFade) this.fade = Math.min(1, this.fade + Math.max(0, dt) / .1);
    const updateVisibility = !frozen || this.viewingFade || changedView || frozen && this.fade === 1;
    if (this.fade === 1) this.viewingFade = false;
    if (!frozen) {
      const gait = this.pose.motion === "run" ? 10 : this.pose.motion === "walk" ? 6.8 : 0;
      this.bob = gait && !this.reduced ? .018 * (1 - Math.cos(this.clock * gait * 2)) : 0;
    }
    const distance = Math.hypot(d.hunter.x - d.player.x, d.hunter.z - d.player.z);
    const brightness = this.pose.motion === "laugh" ? 1 : d.hidden ? .24 : d.player.light ? Math.max(.28, 1 - distance * .055) : .25;
    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i];
      if (updateVisibility) {
        l.mesh.visibility = i === this.active ? this.fade > 0 ? 1 : 0 : this.fade < 1 ? 1 : 0;
        l.dither!.setFadeBounds(l.mesh, i === this.active ? 0 : this.fade, i === this.active ? this.fade : 1);
      }
      l.mesh.position.y = l.ground + this.bob;
      if (!frozen) {
        const laugh = this.pose.motion === "laugh";
        const amplitude = this.reduced ? .003 : laugh ? .018 : .008;
        const pulse = Math.sin(this.clock * (laugh ? 13 : 2.1));
        const data = this.base.slice();
        for (let v = 0; v < data.length; v += 3) {
          const y = this.base[v + 1] / 2.55, belly = Math.sin(y * Math.PI);
          data[v] += this.base[v] * belly * pulse * amplitude;
          data[v + 1] += belly * pulse * amplitude * (laugh ? 1.8 : .6);
        }
        l.mesh.updateVerticesData(VertexBuffer.PositionKind, data, false, false);
      }
      const frozenTint = frozen && this.pose.motion !== "laugh";
      l.material.emissiveColor.set(brightness * (frozenTint ? .48 : 1), brightness * (frozenTint ? .86 : 1), brightness);
      const overlay = this.overlays[i];
      overlay.mesh.position.y = l.mesh.position.y;
      overlay.mesh.scaling.copyFrom(l.mesh.scaling);
      overlay.material.diffuseTexture = l.material.diffuseTexture;
      overlay.mesh.visibility = (world.data.hunt?.reveal ?? 0) > 0 && world.data.phase === "playing" && i === this.active ? .56 : 0;
      overlay.material.emissiveColor.set(.82, .36, 1);
      overlay.material.alpha = .56;
    }
  }
  setReducedMotion(reduced: boolean) { this.reduced = reduced; }
  dispose() {
    for (const overlay of this.overlays) { overlay.mesh.dispose(); overlay.material.dispose(); }
    for (const l of this.layers) { l.mesh.dispose(); l.material.dispose(); for (const texture of Object.values(l.textures)) texture.dispose(); }
    this.root.dispose();
  }
}
