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
import { floorYAt } from "./basement-map.ts";

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
  ambient.groundColor = new Color3(.18, .13, .09); ambient.intensity = .055;
  const torch = new SpotLight("hand-flashlight", camera.position.clone(), new Vector3(1, 0, 0), TORCH_CONE, 4, scene);
  torch.diffuse = new Color3(1, .89, .65); torch.intensity = 5; torch.range = TORCH_RANGE;
  const eyeFill = new PointLight("near-dark-adaptation", camera.position.clone(), scene);
  eyeFill.diffuse = new Color3(.31, .39, .41); eyeFill.intensity = .025; eyeFill.range = 3.2;
  const wallMat = colorMaterial(scene, "painted-tile", "#c3c1a7"); wallMat.diffuseTexture = textures.wall ?? null;
  const floorMat = colorMaterial(scene, "painted-floor", "#b5b5a3"); floorMat.diffuseTexture = textures.floor ?? null;
  const ceilingMat = colorMaterial(scene, "painted-ceiling", "#8b9691"); ceilingMat.diffuseTexture = textures.ceiling ?? null;
  const basementWallMat = colorMaterial(scene, "basement-tile", "#c3c1a7");
  const basementFloorMat = colorMaterial(scene, "basement-floor", "#b5b5a3");
  const basementCeilingMat = colorMaterial(scene, "basement-ceiling", "#8b9691");
  const basementSecretMat = colorMaterial(scene, "basement-secret", "#ffffff");
  // Room surfaces are authored from inside. Explicit two-sided rasterisation
  // keeps them visible with RH cameras on WebGL1 and WebGL2 alike.
  for (const mat of [wallMat, floorMat, ceilingMat, basementWallMat, basementFloorMat, basementCeilingMat, basementSecretMat]) mat.backFaceCulling = false;
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
  const basementFloors: number[][][] = [], basementCeilings: number[][][] = [], basementWalls: number[][][] = [];
  // All callers pass map-space Z; floorYAt returns world-space meters.
  const floorY = (z: number) => floorYAt({ x: 0, z });
  for (let z = 0; z < MAP.length; z++) for (let x = 0; x < MAP[z].length; x++) {
    if (MAP[z][x]) continue;
    const floorQuads = z >= 28 ? basementFloors : floors;
    const ceilingQuads = z >= 28 ? basementCeilings : ceilings;
    const wallQuads = z >= 28 ? basementWalls : walls;
    const x0 = x * CELL, x1 = x0 + CELL, z0 = z * CELL, z1 = z0 + CELL, h = WALL_HEIGHT;
    const y0 = floorY(z), y1 = floorY(z + 1);
    floorQuads.push([[x0, y1, z1], [x1, y1, z1], [x1, y0, z0], [x0, y0, z0]]);
    ceilingQuads.push([[x0, y0 + h, z0], [x1, y0 + h, z0], [x1, y1 + h, z1], [x0, y1 + h, z1]]);
    if (MAP[z - 1]?.[x]) wallQuads.push([[x0, y0, z0], [x1, y0, z0], [x1, y0 + h, z0], [x0, y0 + h, z0]]);
    if (MAP[z + 1]?.[x]) {
      if (x === 20 && z === 22) {
        const left = x0 + .2, right = x1 - .2, base = y1, top = base + 1.1, end = z1 + 3;
        // A real opening and recessed crawlway behind the exit grille.
        wallQuads.push([[x1, y1, z1], [right, y1, z1], [right, y1 + h, z1], [x1, y1 + h, z1]],
          [[left, y1, z1], [x0, y1, z1], [x0, y1 + h, z1], [left, y1 + h, z1]],
          [[right, top, z1], [left, top, z1], [left, y1 + h, z1], [right, y1 + h, z1]],
          [[left, base, end], [left, y1, z1], [left, top, z1], [left, top, end]],
          [[right, y1, z1], [right, base, end], [right, top, end], [right, top, z1]]);
        floorQuads.push([[left, base, end], [right, base, end], [right, y1, z1], [left, y1, z1]]);
        ceilingQuads.push([[left, top, z1], [right, top, z1], [right, top, end], [left, top, end]]);
      } else wallQuads.push([[x1, y1, z1], [x0, y1, z1], [x0, y1 + h, z1], [x1, y1 + h, z1]]);
    }
    if (MAP[z]?.[x - 1]) wallQuads.push([[x0, y1, z1], [x0, y0, z0], [x0, y0 + h, z0], [x0, y1 + h, z1]]);
    if (MAP[z]?.[x + 1]) wallQuads.push([[x1, y0, z0], [x1, y1, z1], [x1, y1 + h, z1], [x1, y0 + h, z0]]);
  }
  surfaces("fixed-floor-uv", floors, floorMat);
  surfaces("fixed-ceiling-uv", ceilings, ceilingMat);
  surfaces("solid-tile-walls", walls, wallMat);
  surfaces("basement-floor-surfaces", basementFloors, basementFloorMat);
  surfaces("basement-ceiling-surfaces", basementCeilings, basementCeilingMat);
  surfaces("basement-wall-surfaces", basementWalls, basementWallMat);
  function box(name: string, w: number, h: number, depth: number, x: number, y: number, z: number, mat: StandardMaterial, parent?: TransformNode) {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth }, scene);
    m.position.set(x, y, z); m.material = mat; m.parent = parent ?? null; m.receiveShadows = true;
    meshes.push(m); return m;
  }
  // Four map units of slope descend through sixteen broad, low stone treads.
  for (let step = 0; step < 16; step++) {
    const z0 = 24 * CELL + step * .375, z1 = z0 + .375;
    const top = floorY(z1 / CELL);
    const tread = box(`basement-stair:${step + 1}`, 4.5, .32, .39, 4.5 * CELL, top - .16, (z0 + z1) / 2, floorMat);
    tread.receiveShadows = true;
  }
  const mural = MeshBuilder.CreatePlane("basement-secret-mural-pump", { width: 3.6, height: 2.4 }, scene);
  mural.position.set(20 * CELL, floorY(28) + 1.65, 28 * CELL + .025); mural.rotation.y = Math.PI;
  mural.material = basementSecretMat; mural.isPickable = false; meshes.push(mural);
  const coldMural = MeshBuilder.CreatePlane("basement-secret-mural-cold", { width: 1.45, height: .95 }, scene);
  coldMural.position.set(5.5 * CELL, floorY(47) + 1.1, 47 * CELL + .025); coldMural.rotation.y = Math.PI;
  coldMural.material = basementSecretMat; coldMural.isPickable = false; meshes.push(coldMural);
  for (const side of [3 * CELL - .1, 6 * CELL + .1]) {
    const rail = box("stair-rail", .09, .92, 6, side, -2.05, 26 * CELL, iron);
    rail.rotation.x = Math.atan2(-4.8, 6);
  }
  const doors = new Map<string, TransformNode>();
  for (const door of DOORS) {
    const x = (door.x + .5) * CELL, z = (door.z + .5) * CELL;
    const base = floorY(door.z + .5);
    const hinge = new TransformNode(`door-hinge:${door.id}`, scene);
    hinge.position.set(x - .66, base, z); doors.set(door.id, hinge);
    box(`door-panel:${door.id}`, 1.32, 2.7, .09, .66, 1.35, 0, wood, hinge);
    box(`door-handle:${door.id}`, .055, .16, .15, 1.19, 1.16, .075, iron, hinge);
    box(`door-lock:${door.id}`, .12, .23, .025, 1.18, 1.14, .06, iron, hinge);
    box(`lintel:${door.id}`, CELL, .65, CELL, x, base + 3.025, z, wallMat);
    for (const side of [-1, 1]) box(`door-jamb:${door.id}:${side}`, .07, 2.7, .18, x + side * .70, base + 1.35, z, iron);
  }
  // Modest real fixtures add parallax; the surfaces use the painted atlas.
  for (const x of [4.5, 11.5, 19.5]) {
    const base = floorY(9.5) + WALL_HEIGHT;
    box("corridor-fluorescent-housing", 1.1, .11, .22, x * CELL, base - .13, 9.5 * CELL, iron);
    box("corridor-fluorescent-glass", .95, .03, .13, x * CELL, base - .2, 9.5 * CELL, lampMat);
  }
  HAZARDS.forEach((hazard, index) => {
    for (let shard = 0; shard < 5; shard += 1) {
      const ground = floorY(hazard.z);
      const piece = box(`broken-glass:${index}:${shard}`, .24 - shard % 2 * .07, .018, .07, (hazard.x + (shard - 2) * .11) * CELL, ground + .018, (hazard.z + (shard % 2 ? .12 : -.12)) * CELL, glass);
      piece.rotation.y = (shard * .67 + index * .4) % Math.PI;
      glassMeshes.push(piece);
    }
  });
  const corridorLamp = new PointLight("failing-corridor-lamp", new Vector3(11.5 * CELL, floorY(9.5) + 2.8, 9.5 * CELL), scene);
  corridorLamp.diffuse = new Color3(.44, .64, .49); corridorLamp.range = 8; corridorLamp.intensity = .15;
  const sewerGlow = new PointLight("sewer-opening-light", new Vector3(20.5 * CELL, floorY(22.8) + .55, 22.8 * CELL), scene);
  sewerGlow.diffuse = new Color3(.15, .42, .34); sewerGlow.intensity = .15; sewerGlow.range = 4;
  const basementMaintenance = new PointLight("basement-maintenance-light", new Vector3(4.5 * CELL, floorY(40.5) + 2.1, 40.5 * CELL), scene);
  basementMaintenance.diffuse = new Color3(.65, .08, .035); basementMaintenance.intensity = .07; basementMaintenance.range = 3;
  const sumpGlow = new PointLight("basement-sump-glow", new Vector3(20.5 * CELL, floorY(49.5) + .18, 49.5 * CELL), scene);
  sumpGlow.diffuse = new Color3(.08, .28, .24); sumpGlow.intensity = .055; sumpGlow.range = 2.2;
  return { scene, camera, torch, ambient, eyeFill, corridorLamp, sewerGlow, basementMaintenance, sumpGlow, doors, meshes, glassMeshes, iron };
}
export type EscapeScene = ReturnType<typeof createEscapeScene>;

export function aimCamera(view: EscapeScene, world: EscapeWorld, eyeHeight: number) {
  const p = world.data.player, pitch = p.pitch ?? 0;
  view.camera.position.set(p.x * CELL, floorYAt(p) + eyeHeight, p.z * CELL);
  const direction = new Vector3(Math.cos(p.angle) * Math.cos(pitch), Math.sin(pitch), Math.sin(p.angle) * Math.cos(pitch));
  view.camera.setTarget(view.camera.position.add(direction));
  // SpotLight setters invalidate the projected beam's view matrix. Mutating
  // either Vector3 in place leaves the cookie stuck at the initial world pose.
  view.torch.position = view.camera.position.clone();
  view.torch.direction = direction;
  view.torch.intensity = p.light && !world.data.hidden && p.battery > 0 ? 5 : 0;
  view.eyeFill.position.copyFrom(view.camera.position);
}
