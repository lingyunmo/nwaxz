import { Color3, Color4, Matrix, Vector3 } from "@babylonjs/core/Maths/math.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Scene } from "@babylonjs/core/scene.js";
import { PeerActorsRenderer } from "../src/escape/peers.ts";
import type { CoopPlayer } from "../src/escape/coop-protocol.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: false, powerPreference: "low-power" });
engine.setSize(canvas.width, canvas.height);
const scene = new Scene(engine);
scene.useRightHandedSystem=true;
scene.clearColor = new Color4(.012, .014, .016, 1);
scene.ambientColor = new Color3(.18, .2, .18);
new HemisphericLight("peer-test-light", new Vector3(0, 1, 0), scene).intensity = .8;
const camera = new FreeCamera("peer-test-camera", new Vector3(0, 1.55, -4), scene);
camera.minZ = .05; camera.maxZ = 50; camera.fov = .9;
camera.setTarget(new Vector3(0, 1.2, 6));
scene.activeCamera = camera;
const wall = MeshBuilder.CreateBox("occlusion-wall", { width: 8, height: 4, depth: .2 }, scene);
wall.position.set(0, 2, 3);
const wallMaterial = new StandardMaterial("occlusion-wall-material", scene);
wallMaterial.disableLighting = true;
wallMaterial.diffuseColor = Color3.FromHexString("#352b24");
wallMaterial.emissiveColor = Color3.FromHexString("#352b24");
wall.material = wallMaterial;
const peersRenderer = new PeerActorsRenderer(scene, camera);
const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
if (!gl) throw new Error("WebGL context unavailable");

const players: CoopPlayer[] = [
  { id: "slot-1", slot: 1, name: "one", avatar: 0, lives: 2, status: "connected", position: { x: -1.35, z: 4, angle: 0, moving: false } },
  { id: "slot-2", slot: 2, name: "two", avatar: 1, lives: 2, status: "connected", position: { x: 0, z: 4, angle: 0, moving: false } },
  { id: "slot-3", slot: 3, name: "three", avatar: 2, lives: 2, status: "connected", position: { x: 1.35, z: 4, angle: 0, moving: false } },
];

const render = (dt = 1 / 60) => {
  peersRenderer.draw(players, "self", dt);
  engine.beginFrame(); scene.render(); engine.endFrame();
};
const flush = () => new Promise(resolve => setTimeout(resolve, 20));
const actorFor = (id: string) => (peersRenderer as any).actors.get(id);
function project(point: Vector3) {
  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const p = Vector3.Project(point, Matrix.Identity(), scene.getTransformMatrix(), viewport);
  return { x: Math.round(p.x), y: Math.round(canvas.height - 1 - p.y) };
}
function pixel(x: number, y: number) {
  const data = new Uint8Array(4);
  gl!.readPixels(Math.max(0, Math.min(canvas.width - 1, x)), Math.max(0, Math.min(canvas.height - 1, y)), 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, data);
  return [...data].slice(0, 3);
}
function maxLuma(point: { x: number; y: number }, radius: number) {
  let max = 0;
  for (let y = point.y - radius; y <= point.y + radius; y += 1) for (let x = point.x - radius; x <= point.x + radius; x += 1) {
    const rgb = pixel(x, y); max = Math.max(max, rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722);
  }
  return max;
}
function bodyHash(actor: any) {
  const center = project(actor.root.position.add(actor.body.position));
  let hash = 2166136261;
  for (let y = center.y - 34; y <= center.y + 34; y += 1) for (let x = center.x - 25; x <= center.x + 25; x += 1) {
    for (const value of pixel(x, y)) { hash ^= value; hash = Math.imul(hash, 16777619); }
  }
  return (hash >>> 0).toString(16);
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function markerOrientation(actor: any) {
  actor.marker.scaling.setAll(4);
  render();
  actor.marker.computeWorldMatrix(true);
  const points = actor.marker.getBoundingInfo().boundingBox.vectorsWorld.map((v: Vector3) => project(v));
  const left = Math.min(...points.map((p: {x:number}) => p.x)), right = Math.max(...points.map((p: {x:number}) => p.x));
  const bottom = Math.min(...points.map((p: {y:number}) => p.y)), top = Math.max(...points.map((p: {y:number}) => p.y));
  const ctx = actor.markerMaterial.diffuseTexture.getContext() as CanvasRenderingContext2D;
  const reference = ctx.getImageData(0, 0, 128, 128).data;
  let aa = 0, uu = 0, ff = 0, au = 0, af = 0;
  const refInk = (u:number,v:number) => {const i=(Math.min(127,Math.max(0,Math.floor(v*128)))*128+Math.min(127,Math.max(0,Math.floor(u*128))))*4;return Math.max(0,Math.min(reference[i],reference[i+1],reference[i+2])-200);};
  for(let y=bottom;y<=top;y++)for(let x=left;x<=right;x++){
    const u=(x-left)/(right-left),v=(top-y)/(top-bottom),rgb=pixel(x,y);
    const a=Math.max(0,Math.min(...rgb)-150),up=refInk(u,v),flipped=refInk(u,1-v);
    aa+=a*a;uu+=up*up;ff+=flipped*flipped;au+=a*up;af+=a*flipped;
  }
  actor.marker.scaling.setAll(1);render();
  const upright=au/Math.sqrt(aa*uu),flipped=af/Math.sqrt(aa*ff);
  assert(Number.isFinite(upright)&&upright>flipped+.05,`slot 2 must match upright canvas text rather than upside-down text: ${upright} vs ${flipped}`);
  return {upright,flipped};
}

async function run() {
  render();
  for (let attempt = 0; attempt < 120 && players.some(player => !actorFor(player.id)?.atlas?.isReady()); attempt++) { await flush(); render(); }
  assert(players.every(player => actorFor(player.id)?.atlas?.isReady()), "survivor WebP atlases did not load");
  let compileFrames = 0;
  while (compileFrames < 120 && players.some(player => !actorFor(player.id).markerMaterial.isReady(actorFor(player.id).marker))) {
    render(); await flush(); compileFrames++;
  }
  assert(players.every(player => actorFor(player.id).markerMaterial.isReady(actorFor(player.id).marker)), "peer body or marker shaders did not compile in the live render loop");
  const wallPixel = project(new Vector3(0, .78, 3));
  const centerActor = actorFor("slot-2");
  const bodyPoint = project(centerActor.root.position.add(centerActor.body.position));
  const markerPoints = players.map(player => {
    const actor = actorFor(player.id);
    return project(actor.root.position.add(new Vector3(0, actor.marker.position.y, 0)));
  });

  wall.setEnabled(false); render();
  const visibleBodyPixel = pixel(bodyPoint.x, bodyPoint.y);
  wall.setEnabled(true); render();
  const blockedBodyPixel = pixel(bodyPoint.x, bodyPoint.y);
  const sampledWallPixel = pixel(wallPixel.x, wallPixel.y);
  const blockedDistance = blockedBodyPixel.reduce((sum, value, i) => sum + Math.abs(value - sampledWallPixel[i]), 0);
  assert(blockedDistance < 12, `body should be depth-occluded by wall; body=${blockedBodyPixel} wall=${sampledWallPixel}`);
  const backgroundPixel = pixel(10, 10);
  const visibleDistance = visibleBodyPixel.reduce((sum, value, i) => sum + Math.abs(value - backgroundPixel[i]), 0);
  assert(visibleDistance > 25, `body should render when no wall blocks it; body=${visibleBodyPixel} background=${backgroundPixel}`);
  const slotLumas = markerPoints.map(point => maxLuma(point, 13));
  assert(slotLumas.every(luma => luma > 150), `slot numbers 1/2/3 should render through the wall; lumas=${slotLumas}, points=${JSON.stringify(markerPoints)}`);
  const slotOrientation = markerOrientation(centerActor);
  assert(players.every(player => actorFor(player.id).markerMaterial.diffuseTexture.hasAlpha && actorFor(player.id).atlas.hasAlpha), "marker and survivor textures must retain transparent pixels");
  const originalTarget=camera.getTarget().clone();
  const originalCells=players.map(p=>[actorFor(p.id).atlas.uOffset,actorFor(p.id).atlas.vOffset]);
  camera.setTarget(camera.position.add(new Vector3(1,0,1)));render();
  assert(JSON.stringify(originalCells)===JSON.stringify(players.map(p=>[actorFor(p.id).atlas.uOffset,actorFor(p.id).atlas.vOffset])), 'turning the camera in place cannot change an actor body direction');
  camera.setTarget(originalTarget);render();

  const viewFrom = Math.atan2(camera.position.z-centerActor.root.position.z,camera.position.x-centerActor.root.position.x);
  const directionHashes: string[] = [];
  const atlasCells: Array<{ column: number; row: number }> = [];
  wall.setEnabled(false);
  for (let direction = 0; direction < 8; direction++) {
    const targetAngle = viewFrom - direction * Math.PI / 4;
    players[1].position!.angle = targetAngle;
    for (let frame = 0; frame < 16; frame++) render(.12);
    const actor = actorFor("slot-2");
    directionHashes.push(bodyHash(actor));
    atlasCells.push({ column: Math.round(actor.atlas.uOffset * 4), row: actor.atlas.vOffset > 0 ? 0 : 1 });
  }
  assert(new Set(directionHashes).size === 8, `eight orientations must paint distinct real atlas views; hashes=${directionHashes}`);
  assert(JSON.stringify(atlasCells) === JSON.stringify([{ column: 0, row: 0 }, { column: 1, row: 0 }, { column: 2, row: 0 }, { column: 3, row: 0 }, { column: 0, row: 1 }, { column: 1, row: 1 }, { column: 2, row: 1 }, { column: 3, row: 1 }]), `all eight atlas cells should be visited; got ${JSON.stringify(atlasCells)}`);

  const markersBefore = players.map(player => ({ name: actorFor(player.id).marker.name, material: actorFor(player.id).markerMaterial.name }));
  for (let frame = 0; frame < 10; frame++) render(.12);
  const markersAfter = players.map(player => ({ name: actorFor(player.id).marker.name, material: actorFor(player.id).markerMaterial.name }));
  assert(JSON.stringify(markersBefore) === JSON.stringify(markersAfter), "each player's slot marker must remain stable as the view turns");
  scene.ambientColor.set(0,0,0);for(const light of scene.lights)light.intensity=.055;wall.setEnabled(false);render();
  const darkBodyPixel=pixel(bodyPoint.x,bodyPoint.y);
  assert(darkBodyPixel.reduce((a,b)=>a+b,0)/3>25,`survivor texture must remain readable in the actual dim map lighting: ${darkBodyPixel}`);
  (window as any).__coopPeerFrame=canvas.toDataURL('image/png');
  const meshesBeforeClear = scene.meshes.filter(mesh => mesh.name.startsWith("coop-peer-")).length;
  peersRenderer.clear(); engine.beginFrame(); scene.render(); engine.endFrame();
  const meshesAfterClear = scene.meshes.filter(mesh => mesh.name.startsWith("coop-peer-")).length;
  assert(meshesBeforeClear === 6 && meshesAfterClear === 0, `clear must destroy every peer body and marker mesh (${meshesBeforeClear} -> ${meshesAfterClear})`);
  return { bodyVisibleWithoutWall: visibleBodyPixel, darkBodyPixel, bodyPixelBehindWall: blockedBodyPixel, wallPixel: sampledWallPixel, slotMarkerLumas: slotLumas, slotOrientation, directionHashes, atlasCells, shaderCompileFrames: compileFrames, meshesBeforeClear, meshesAfterClear };
}

(window as any).__coopPeerReport = run().catch((error: unknown) => ({ error: error instanceof Error ? error.stack ?? error.message : String(error) }));
