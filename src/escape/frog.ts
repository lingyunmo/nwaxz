import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Material } from "@babylonjs/core/Materials/material.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { EscapeWorld } from "./world.ts";

export type FrogPose = { sheet: "original" | "actions"; frame: number; mirror?: boolean; motion: "idle" | "walk" | "run" | "search" | "peek" | "lunge" | "laugh" };
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

export class PaintedFrog {
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  pose: FrogPose = { sheet: "original", frame: 0, motion: "idle" };
  private layers: { mesh: Mesh; material: StandardMaterial; original: Texture; actions: Texture; pose: FrogPose }[] = [];
  private base: number[] = [];
  private clock = 0;
  private active = 0;
  private fade = 1;
  private reduced: boolean;
  constructor(scene: Scene, textures: { original: Texture; actions: Texture }, reduced = false) {
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
      const original = textures.original.clone()!, actions = textures.actions.clone()!;
      original.hasAlpha = actions.hasAlpha = true;
      original.wrapU = original.wrapV = actions.wrapU = actions.wrapV = Texture.CLAMP_ADDRESSMODE;
      mesh.material = material; mesh.visibility = i === 0 ? 1 : 0;
      this.layers.push({ mesh, material, original, actions, pose: this.pose }); this.meshes.push(mesh);
      this.frame(i, this.pose);
    }
  }
  private frame(layer: number, pose: FrogPose) {
    const l = this.layers[layer], texture = pose.sheet === "original" ? l.original : l.actions;
    const columns = pose.sheet === "original" ? 2 : 4;
    // Two-pixel inset avoids sampling the neighbouring atlas cell at distance.
    texture.uScale = 1 / columns - .004; texture.vScale = .496;
    texture.uOffset = pose.frame % columns / columns + .002;
    texture.vOffset = 1 - (Math.floor(pose.frame / columns) + 1) / 2 + .002;
    // Alternate the leading leg, rather than repeating two knee-up poses.
    if (pose.mirror) { texture.uOffset += texture.uScale; texture.uScale *= -1; }
    l.material.diffuseTexture = texture; l.pose = pose;
  }
  animate(world: EscapeWorld, dt: number, moving: boolean) {
    this.clock += Math.min(.1, Math.max(0, dt));
    const next = frogPose(world, this.clock, moving);
    if (next.sheet !== this.pose.sheet || next.frame !== this.pose.frame) {
      this.active = 1 - this.active; this.frame(this.active, next); this.fade = 0;
    }
    this.pose = next; this.fade = Math.min(1, this.fade + dt / .12);
    const d = world.data, distance = Math.hypot(d.hunter.x - d.player.x, d.hunter.z - d.player.z);
    const brightness = next.motion === "laugh" ? 1 : d.hidden ? .24 : d.player.light ? Math.max(.28, 1 - distance * .055) : .25;
    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i]; l.mesh.visibility = i === this.active ? this.fade : 1 - this.fade;
      l.material.emissiveColor.set(brightness, brightness, brightness);
      const laugh = next.motion === "laugh", gait = next.motion === "run" ? 10 : next.motion === "walk" ? 6.8 : 0;
      const amplitude = this.reduced ? .003 : laugh ? .018 : .008;
      const pulse = Math.sin(this.clock * (laugh ? 13 : 2.1));
      const data = this.base.slice();
      for (let v = 0; v < data.length; v += 3) {
        const y = this.base[v + 1] / 2.55, belly = Math.sin(y * Math.PI);
        data[v] += this.base[v] * belly * pulse * amplitude;
        data[v + 1] += belly * pulse * amplitude * (laugh ? 1.8 : .6);
      }
      l.mesh.position.y = gait && !this.reduced ? .035 * (1 - Math.cos(this.clock * gait * 2)) : 0;
      l.mesh.updateVerticesData(VertexBuffer.PositionKind, data, false, false);
    }
  }
  setReducedMotion(reduced: boolean) { this.reduced = reduced; }
  dispose() {
    for (const l of this.layers) { l.mesh.dispose(); l.material.dispose(); l.original.dispose(); l.actions.dispose(); }
    this.root.dispose();
  }
}
