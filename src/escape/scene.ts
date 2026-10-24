import { Scene } from "@babylonjs/core/scene.js";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { SpotLight } from "@babylonjs/core/Lights/spotLight.js";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture.js";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { DOORS, HAZARDS, MAP, SIZE, TORCH_CONE, TORCH_RANGE, type EscapeWorld } from "./world.ts";

export const CELL = 1.5, WALL_HEIGHT = 3.35;
export type PaintedTextures = { wall?: BaseTexture; floor?: BaseTexture; ceiling?: BaseTexture; wood?: BaseTexture };
export function colorMaterial(scene: Scene, name: string, color: string, glow = false) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(color);
  m.specularColor.set(.08, .08, .07);
  if (glow) m.emissiveColor = m.diffuseColor.scale(.65);
  return m;
}

/** The map is world geometry. No view-dependent UV offsets or billboards. */
export function createEscapeScene(engine: AbstractEngine, textures: PaintedTextures = {}) {
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(.006, .009, .01, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = .021;
  scene.fogColor = new Color3(.018, .025, .027);
  scene.ambientColor = new Color3(.06, .07, .07);
  const camera = new FreeCamera("eyes", new Vector3(3.5 * CELL, 1.65, 5.5 * CELL), scene);
  camera.inputs.clear(); // Game owns touch, focus, pause and save-aware controls.
  camera.minZ = .025; camera.maxZ = 65; camera.fov = 1.20;
  scene.activeCamera = camera;
  const ambient = new HemisphericLight("dim-bath-ambient", new Vector3(0, 1, 0), scene);
  ambient.diffuse = new Color3(.49, .59, .57);
  ambient.groundColor = new Color3(.18, .13, .09); ambient.intensity = .26;
  const torch = new SpotLight("hand-flashlight", camera.position.clone(), new Vector3(1, 0, 0), TORCH_CONE, 4, scene);
  torch.diffuse = new Color3(1, .89, .65); torch.intensity = 5; torch.range = TORCH_RANGE;
  const eyeFill = new PointLight("near-dark-adaptation", camera.position.clone(), scene);
  eyeFill.diffuse = new Color3(.31, .39, .41); eyeFill.intensity = .13; eyeFill.range = 3.2;
  const wallMat = colorMaterial(scene, "painted-tile", "#c3c1a7"); wallMat.diffuseTexture = textures.wall ?? null;
  const floorMat = colorMaterial(scene, "painted-floor", "#b5b5a3"); floorMat.diffuseTexture = textures.floor ?? null;
  const ceilingMat = colorMaterial(scene, "painted-ceiling", "#8b9691"); ceilingMat.diffuseTexture = textures.ceiling ?? null;
  // Room surfaces are authored from inside. Explicit two-sided rasterisation
  // keeps them visible with RH cameras on WebGL1 and WebGL2 alike.
  for (const mat of [wallMat, floorMat, ceilingMat]) mat.backFaceCulling = false;
  const wood = colorMaterial(scene, "painted-door", "#8c8170"); wood.diffuseTexture = textures.wood ?? null;
  const iron = colorMaterial(scene, "rusty-trim", "#3f3930");
  const glass = colorMaterial(scene, "corridor-glass-shards", "#8fa3a0", true);
  const lampMat = colorMaterial(scene, "old-lamp-glass", "#a8ba9b", true);
  const meshes: Mesh[] = [];
  const glassMeshes: Mesh[] = [];
  function surfaces(name: string, quads: number[][][], material: StandardMaterial) {
    const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
    for (const quad of quads) {
      const first = positions.length / 3;
      positions.push(...quad.flat());
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
      const a = Vector3.FromArray(quad[0]), b = Vector3.FromArray(quad[1]), c = Vector3.FromArray(quad[2]);
      const w = Vector3.Distance(a, b) / CELL, h = Vector3.Distance(b, c) / CELL;
      uvs.push(0, h, w, h, w, 0, 0, 0);
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals, { useRightHandedSystem: true });
    const data = new VertexData(); Object.assign(data, { positions, indices, normals, uvs });
    const mesh = new Mesh(name, scene); data.applyToMesh(mesh); mesh.material = material; mesh.receiveShadows = true;
    meshes.push(mesh); return mesh;
  }
  const floors: number[][][] = [], ceilings: number[][][] = [], walls: number[][][] = [];
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    if (MAP[z][x]) continue;
    const x0 = x * CELL, x1 = x0 + CELL, z0 = z * CELL, z1 = z0 + CELL, h = WALL_HEIGHT;
    floors.push([[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]]);
    ceilings.push([[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]]);
    if (MAP[z - 1]?.[x]) walls.push([[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]]);
    if (MAP[z + 1]?.[x]) {
      if (x === 20 && z === 22) {
        const left = x0 + .2, right = x1 - .2, top = 1.1, end = z1 + 3;
        // A real opening and recessed crawlway behind the exit grille.
        walls.push([[x1, 0, z1], [right, 0, z1], [right, h, z1], [x1, h, z1]],
          [[left, 0, z1], [x0, 0, z1], [x0, h, z1], [left, h, z1]],
          [[right, top, z1], [left, top, z1], [left, h, z1], [right, h, z1]],
          [[left, 0, end], [left, 0, z1], [left, top, z1], [left, top, end]],
          [[right, 0, z1], [right, 0, end], [right, top, end], [right, top, z1]]);
        floors.push([[left, 0, end], [right, 0, end], [right, 0, z1], [left, 0, z1]]);
        ceilings.push([[left, top, z1], [right, top, z1], [right, top, end], [left, top, end]]);
      } else walls.push([[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]]);
    }
    if (MAP[z]?.[x - 1]) walls.push([[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]]);
    if (MAP[z]?.[x + 1]) walls.push([[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]]);
  }
  surfaces("fixed-floor-uv", floors, floorMat);
  surfaces("fixed-ceiling-uv", ceilings, ceilingMat);
  surfaces("solid-tile-walls", walls, wallMat);
  function box(name: string, w: number, h: number, depth: number, x: number, y: number, z: number, mat: StandardMaterial, parent?: TransformNode) {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth }, scene);
    m.position.set(x, y, z); m.material = mat; m.parent = parent ?? null; m.receiveShadows = true;
    meshes.push(m); return m;
  }
  const doors = new Map<string, TransformNode>();
  for (const door of DOORS) {
    const x = (door.x + .5) * CELL, z = (door.z + .5) * CELL;
    const hinge = new TransformNode(`door-hinge:${door.id}`, scene);
    hinge.position.set(x - .66, 0, z); doors.set(door.id, hinge);
    box(`door-panel:${door.id}`, 1.32, 2.7, .09, .66, 1.35, 0, wood, hinge);
    box(`door-handle:${door.id}`, .055, .16, .15, 1.19, 1.16, .075, iron, hinge);
    box(`door-lock:${door.id}`, .12, .23, .025, 1.18, 1.14, .06, iron, hinge);
    box(`lintel:${door.id}`, CELL, .65, CELL, x, 3.025, z, wallMat);
    for (const side of [-1, 1]) box(`door-jamb:${door.id}:${side}`, .07, 2.7, .18, x + side * .70, 1.35, z, iron);
  }
  // Modest real fixtures add parallax; the surfaces use the painted atlas.
  for (const x of [4.5, 11.5, 19.5]) {
    box("corridor-fluorescent-housing", 1.1, .11, .22, x * CELL, 3.22, 9.5 * CELL, iron);
    box("corridor-fluorescent-glass", .95, .03, .13, x * CELL, 3.15, 9.5 * CELL, lampMat);
  }
  HAZARDS.forEach((hazard, index) => {
    for (let shard = 0; shard < 5; shard += 1) {
      const piece = box(`broken-glass:${index}:${shard}`, .24 - shard % 2 * .07, .018, .07, (hazard.x + (shard - 2) * .11) * CELL, .018, (hazard.z + (shard % 2 ? .12 : -.12)) * CELL, glass);
      piece.rotation.y = (shard * .67 + index * .4) % Math.PI;
      glassMeshes.push(piece);
    }
  });
  const corridorLamp = new PointLight("failing-corridor-lamp", new Vector3(11.5 * CELL, 2.8, 9.5 * CELL), scene);
  corridorLamp.diffuse = new Color3(.44, .64, .49); corridorLamp.range = 8; corridorLamp.intensity = .35;
  const sewerGlow = new PointLight("sewer-opening-light", new Vector3(20.5 * CELL, .55, 22.8 * CELL), scene);
  sewerGlow.diffuse = new Color3(.15, .42, .34); sewerGlow.intensity = .24; sewerGlow.range = 4;
  return { scene, camera, torch, ambient, eyeFill, corridorLamp, sewerGlow, doors, meshes, glassMeshes, iron };
}
export type EscapeScene = ReturnType<typeof createEscapeScene>;

export function aimCamera(view: EscapeScene, world: EscapeWorld, eyeHeight: number) {
  const p = world.data.player, pitch = p.pitch ?? 0;
  view.camera.position.set(p.x * CELL, eyeHeight, p.z * CELL);
  const direction = new Vector3(Math.cos(p.angle) * Math.cos(pitch), Math.sin(pitch), Math.sin(p.angle) * Math.cos(pitch));
  view.camera.setTarget(view.camera.position.add(direction));
  // SpotLight setters invalidate the projected beam's view matrix. Mutating
  // either Vector3 in place leaves the cookie stuck at the initial world pose.
  view.torch.position = view.camera.position.clone();
  view.torch.direction = direction;
  view.torch.intensity = p.light && !world.data.hidden && p.battery > 0 ? 5 : 0;
  view.eyeFill.position.copyFrom(view.camera.position);
}
