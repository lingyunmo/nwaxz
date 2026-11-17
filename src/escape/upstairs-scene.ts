import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { CELL, colorMaterial } from "./scene.ts";
import { UPSTAIRS_FURNITURE, UPSTAIRS_HEIGHT } from "./upstairs-map.ts";

/** A small sunlit refuge with real window openings and a garden below them. */
export function createUpstairsScene(scene: Scene, surfaces: Mesh[]) {
  const start = scene.meshes.length;
  const cream = colorMaterial(scene, "upstairs-cream", "#ead6b0");
  const oak = colorMaterial(scene, "upstairs-honey-oak", "#ae7946");
  const trim = colorMaterial(scene, "upstairs-ivory-trim", "#fff0cd");
  const terracotta = colorMaterial(scene, "upstairs-terracotta", "#be795a");
  const sage = colorMaterial(scene, "upstairs-sage-fabric", "#95ad8c");
  const rose = colorMaterial(scene, "upstairs-rose-cushion", "#d99f91");
  const leaf = colorMaterial(scene, "upstairs-leaves", "#4f814e");
  const gold = colorMaterial(scene, "upstairs-brass", "#b08b4c");
  const lamp = colorMaterial(scene, "upstairs-lamp-shade", "#ffe3a5", true);
  const base = UPSTAIRS_HEIGHT;
  const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial, parent?: TransformNode) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z); mesh.material = mat; mesh.parent = parent ?? null; return mesh;
  };
  const ball = (name: string, size: number, x: number, y: number, z: number, mat: StandardMaterial, parent?: TransformNode) => {
    const mesh = MeshBuilder.CreateSphere(name, { diameter: size, segments: 8 }, scene);
    mesh.position.set(x, y, z); mesh.material = mat; mesh.parent = parent ?? null; return mesh;
  };
  const cylinder = (name: string, bottom: number, top: number, height: number, x: number, y: number, z: number, mat: StandardMaterial, parent?: TransformNode) => {
    const mesh = MeshBuilder.CreateCylinder(name, { diameterBottom: bottom, diameterTop: top, height, tessellation: 12 }, scene);
    mesh.position.set(x, y, z); mesh.material = mat; mesh.parent = parent ?? null; return mesh;
  };
  const cushion = (name: string, x: number, y: number, z: number, mat: StandardMaterial) => {
    const mesh = ball(name, .65, x, y, z, mat); mesh.scaling.set(1.1, 1, .42); mesh.rotation.z = .14; return mesh;
  };

  // Sixteen wooden treads rise continuously with the simulation's X-axis slope.
  for (let step = 0; step < 16; step++) {
    const x = 24 * CELL + (step + .5) * .375;
    box(`upstairs-stair:${step + 1}`, .385, .3, 3 * CELL, x, (step + 1) * .3 - .15, 4.5 * CELL, oak);
  }
  for (const z of [3.08, 5.92]) {
    const rail = box("upstairs-stair-handrail", 7.7, .1, .1, 26 * CELL, 3.35, z * CELL, oak);
    rail.rotation.z = Math.atan2(4.8, 6);
    for (let step = 0; step <= 8; step++) box("upstairs-stair-baluster", .07, 1, .07, (24 + step * .5) * CELL, step * .6 + .5, z * CELL, trim);
  }
  box("upstairs-entry-lintel", .18, .38, 4.5, 23 * CELL, 2.95, 4.5 * CELL, cream);
  if (typeof document !== "undefined") {
    const sign = MeshBuilder.CreatePlane("upstairs-entry-sign", { width: 2.5, height: .5 }, scene);
    sign.position.set(23 * CELL - .1, 2.95, 4.5 * CELL); sign.rotation.y = Math.PI / 2;
    const texture = new DynamicTexture("upstairs-sign-lettering", { width: 768, height: 160 }, scene, false);
    texture.drawText("二楼休息室  ↑", null, 110, "bold 68px 'Escape Serif', serif", "#604c31", "#f4e4bf", true);
    const mat = colorMaterial(scene, "upstairs-sign", "#ffffff"); mat.diffuseTexture = texture; mat.emissiveTexture = texture; mat.backFaceCulling = false; sign.material = mat;
  }

  // Warm timber floorboards, wall panelling, skirting and ceiling beams.
  for (let z = 1.25; z < 10; z += .5) {
    box("upstairs-floorboard-joint", 8 * CELL, .008, .012, 33 * CELL, base + .006, z * CELL, oak);
  }
  for (const x of [29.04, 36.96]) {
    box("upstairs-skirting", .07, .15, 9 * CELL, x * CELL, base + .075, 5.5 * CELL, trim);
    for (let z = 1.5; z < 10; z++) {
      if (x < 30 && z >= 3 && z < 6) continue;
      box("upstairs-wall-panelling", .065, .72, 1.42, x * CELL, base + .39, z * CELL, sage);
      box("upstairs-picture-rail", .09, .07, 1.48, x * CELL, base + .8, z * CELL, trim);
    }
  }
  for (const z of [1.04, 9.96]) {
    box("upstairs-wall-panelling", 8 * CELL, .75, .07, 33 * CELL, base + .4, z * CELL, sage);
    box("upstairs-skirting", 8 * CELL, .15, .1, 33 * CELL, base + .075, z * CELL, trim);
  }
  for (const z of [1.1, 5.5, 9.9]) box("upstairs-ceiling-beam", 12, .16, .18, 33 * CELL, base + 3.22, z * CELL, oak);

  // Two broad glazed windows. The collision wall stays intact below the sill.
  const glazing = colorMaterial(scene, "upstairs-window-glass", "#c8e3e7");
  glazing.alpha = .09; glazing.specularColor.set(.5, .55, .6); glazing.backFaceCulling = false;
  for (const middle of [3.5, 7.5]) {
    box("upstairs-window-glazing", .025, 2.05, 4.5, 37 * CELL, base + 1.875, middle * CELL, glazing);
    box("upstairs-window-sill", .48, .11, 4.75, 36.94 * CELL, base + .85, middle * CELL, trim);
    for (const z of [middle - 1.5, middle, middle + 1.5]) box("upstairs-window-mullion", .14, 2.18, .085, 36.98 * CELL, base + 1.88, z * CELL, trim);
    box("upstairs-window-crossbar", .14, .07, 4.5, 36.98 * CELL, base + 1.85, middle * CELL, trim);
    for (const side of [-1, 1]) {
      box("upstairs-curtain", .22, 2.7, .55, 36.7 * CELL, base + 1.85, (middle + side * 1.53) * CELL, rose);
      box("upstairs-curtain-tie", .24, .08, .57, 36.69 * CELL, base + 1.38, (middle + side * 1.53) * CELL, gold);
    }
    box("upstairs-curtain-rod", .14, .09, 5.45, 36.7 * CELL, base + 3.03, middle * CELL, gold);
  }
  const rug = colorMaterial(scene, "upstairs-rug", "#d4a58c");
  box("upstairs-woven-rug", 7.3, .025, 6.1, 32.4 * CELL, base + .025, 4.9 * CELL, rug);
  for (const side of [-1, 1]) box("upstairs-rug-border", 7, .006, .065, 32.4 * CELL, base + .042, 4.9 * CELL + side * 2.85, trim);
  for (let i = 0; i < 11; i++) for (const side of [-1, 1]) box("upstairs-rug-tassel", .025, .008, .18, 32.4 * CELL - 3.1 + i * .62, base + .035, 4.9 * CELL + side * 3.1, cream);

  for (const object of UPSTAIRS_FURNITURE) {
    const x = object.x * CELL, z = object.z * CELL, w = object.w * CELL, d = object.d * CELL;
    if (object.id === "sofa" || object.id === "armchair") {
      box(`upstairs-${object.id}-base`, w, .35, d, x, base + .3, z, oak);
      box(`upstairs-${object.id}-seat`, w - .15, .23, d - .12, x, base + .57, z, sage);
      box(`upstairs-${object.id}-back`, w, .9, .24, x, base + .85, z - d / 2 + .1, sage);
      for (const side of [-1, 1]) box("upstairs-sofa-arm", .22, .47, d, x + side * (w / 2 - .1), base + .7, z, sage);
      cushion("upstairs-soft-cushion", x - w * .22, base + .95, z - d * .18, rose);
      if (object.id === "sofa") cushion("upstairs-soft-cushion", x + w * .22, base + .95, z - d * .18, cream);
    } else if (object.id === "tea-table") {
      box("upstairs-tea-table", w, .12, d, x, base + .64, z, oak);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box("upstairs-table-leg", .09, .58, .09, x + sx * w * .38, base + .29, z + sz * d * .33, oak);
      cylinder("upstairs-teapot", .18, .13, .2, x - .3, base + .79, z, terracotta);
      ball("upstairs-teapot-lid", .14, x - .3, base + .9, z, terracotta).scaling.y = .3;
      for (const side of [-1, 1]) cylinder("upstairs-teacup", .075, .11, .09, x + .22, base + .75, z + side * .22, cream);
      box("upstairs-open-book", .36, .035, .26, x + .55, base + .72, z, trim).rotation.y = .2;
    } else if (object.id === "bookshelf") {
      box("upstairs-bookcase-back", .12, 2.35, d, x - w / 2, base + 1.18, z, oak);
      for (const side of [-1, 1]) box("upstairs-bookcase-side", w, 2.35, .09, x, base + 1.18, z + side * d / 2, oak);
      for (let shelf = 0; shelf < 5; shelf++) {
        const y = base + .12 + shelf * .53;
        box("upstairs-bookshelf", w, .07, d, x, y, z, oak);
        if (shelf === 4) continue;
        for (let book = 0; book < 12; book++) box("upstairs-book", .42, .24 + book % 3 * .065, .1, x, y + .21, z - d * .4 + book * .19, [rose, sage, cream, terracotta][book % 4]);
      }
    } else {
      box(`upstairs-${object.id}`, w, .55, d, x, base + .3, z, oak);
      box(`upstairs-${object.id}-top`, w + .06, .1, d + .06, x, base + .63, z, object.id === "window-bench" ? cream : oak);
      if (object.id === "window-bench") cushion("upstairs-window-cushion", x, base + .8, z + .65, rose).rotation.y = Math.PI / 2;
    }
  }
  function plant(x: number, z: number, y = base) {
    cylinder("upstairs-plant-pot", .28, .42, .4, x, y + .2, z, terracotta);
    cylinder("upstairs-plant-stem", .04, .03, .8, x, y + .68, z, leaf);
    for (let i = 0; i < 6; i++) {
      const angle = i * 2.4;
      const frond = ball("upstairs-plant-leaf", .5, x + Math.cos(angle) * .24, y + .55 + i * .1, z + Math.sin(angle) * .24, leaf);
      frond.scaling.set(1, .25, .55); frond.rotation.z = Math.sin(angle) * .4;
    }
  }
  plant(35.8 * CELL, 1.5 * CELL); plant(30 * CELL, 9.2 * CELL); plant(34.2 * CELL, 9.45 * CELL, base + .7);
  cylinder("upstairs-floor-lamp-base", .5, .5, .08, 29.8 * CELL, base + .04, 2 * CELL, gold);
  cylinder("upstairs-floor-lamp-stem", .06, .06, 1.8, 29.8 * CELL, base + .95, 2 * CELL, gold);
  cylinder("upstairs-floor-lamp-shade", .85, .45, .5, 29.8 * CELL, base + 1.85, 2 * CELL, lamp);

  // The lawn is a lower outdoor space, visible through the openings at second-floor height.
  const grass = colorMaterial(scene, "upstairs-garden-grass", "#7fbc70");
  const lightGrass = colorMaterial(scene, "upstairs-garden-meadow", "#9bc97e");
  const path = colorMaterial(scene, "upstairs-garden-path", "#d5c59e");
  const bark = colorMaterial(scene, "upstairs-garden-bark", "#886246");
  const canopy = colorMaterial(scene, "upstairs-garden-canopy", "#679a59");
  const sky = colorMaterial(scene, "upstairs-garden-sky", "#619fc2", true);
  sky.disableLighting = true; sky.emissiveColor = Color3.FromHexString("#619fc2"); sky.backFaceCulling = false;
  box("upstairs-garden-lawn", 35, .16, 52, 37 * CELL + 17, -.18, 5 * CELL, grass);
  box("upstairs-garden-sky-backdrop", .2, 45, 70, 37 * CELL + 34, 16, 5 * CELL, sky);
  for (const z of [-20, 35]) box("upstairs-garden-sky-side", 35, 45, .2, 37 * CELL + 17, 16, z, sky);
  const cloud = colorMaterial(scene, "upstairs-garden-cloud", "#f9edda");
  cloud.disableLighting = true; cloud.emissiveColor = Color3.FromHexString("#dbe4df");
  for (let i = 0; i < 5; i++) {
    const puff = ball("upstairs-garden-cloud", 3.4, 37 * CELL + 28, 11 + i % 2 * 2, -12 + i * 9, cloud);
    puff.scaling.set(.25, .4, 1.8);
  }
  for (let patch = 0; patch < 12; patch++) {
    const mound = ball("upstairs-garden-grass-patch", 4 + patch % 3, 38 * CELL + patch % 4 * 6, -.1, -9 + Math.floor(patch / 4) * 13, lightGrass);
    mound.scaling.set(1, .018, 1.5);
  }
  box("upstairs-garden-walking-path", 1.6, .03, 34, 41 * CELL, .01, 5 * CELL, path);
  box("upstairs-garden-cross-path", 17, .035, 1.5, 42 * CELL, .015, 5.5 * CELL, path);
  for (let i = 0; i < 7; i++) {
    const x = (46 + i % 2 * 4) * CELL, z = (-5 + i * 3.7) * CELL;
    cylinder("upstairs-garden-tree-trunk", .38, .25, 3.3, x, 1.6, z, bark);
    const crown = ball("upstairs-garden-tree-crown", 4.3, x, 4.1, z, canopy); crown.scaling.y = 1.15;
    ball("upstairs-garden-tree-crown-small", 3, x - 1.1, 3.6, z + .6, leaf);
  }
  for (let flower = 0; flower < 44; flower++) {
    const x = (38.5 + flower % 11 * .6) * CELL, z = (-.5 + Math.floor(flower / 11) * 3.5) * CELL;
    cylinder("upstairs-garden-flower-stem", .025, .02, .25, x, .12, z, leaf);
    ball("upstairs-garden-flower", .16, x, .28, z, flower % 2 ? rose : lamp);
  }
  for (let i = 0; i < 23; i++) box("upstairs-garden-fence-picket", .12, .85, .1, 38 * CELL + i * 1.25, .42, 14 * CELL, trim);
  for (const y of [.28, .65]) box("upstairs-garden-fence-rail", 28, .08, .09, 38 * CELL + 14, y, 14 * CELL, trim);
  box("upstairs-garden-bench-seat", 2.5, .15, .6, 43 * CELL, .55, 8 * CELL, oak);
  box("upstairs-garden-bench-back", 2.5, .65, .12, 43 * CELL, .92, 8 * CELL + .3, oak);
  for (const side of [-1, 1]) box("upstairs-garden-bench-leg", .12, .55, .45, 43 * CELL + side, .28, 8 * CELL, gold);

  const skin = colorMaterial(scene, "upstairs-neighbour-skin", "#edc8a3");
  const hair = colorMaterial(scene, "upstairs-neighbour-hair", "#584737");
  const eyes = colorMaterial(scene, "upstairs-neighbour-eyes", "#423c33");
  const blue = colorMaterial(scene, "upstairs-neighbour-blue", "#7ba5bc");
  const neighbours: { root: TransformNode; legs: Mesh[]; arms: Mesh[]; x: number; z: number; phase: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const root = new TransformNode(`upstairs-garden-npc:${i}`, scene);
    const x = (40 + i * 1.4) * CELL, z = (2.8 + i * 2.2) * CELL;
    root.position.set(x, 0, z); root.rotation.y = -Math.PI / 2;
    const shirt = [rose, blue, sage][i];
    cylinder("neighbour-body", .48, .38, .65, 0, .95, 0, shirt, root);
    ball("neighbour-head", .43, 0, 1.48, 0, skin, root);
    const cap = ball("neighbour-hair", .45, 0, 1.58, .035, hair, root); cap.scaling.y = .7;
    for (const side of [-1, 1]) ball("neighbour-eye", .043, side * .085, 1.48, -.2, eyes, root);
    const legs = [-1, 1].map(side => cylinder("neighbour-leg", .13, .16, .6, side * .13, .34, 0, hair, root));
    const arms = [-1, 1].map(side => cylinder("neighbour-arm", .12, .16, .54, side * .3, .94, 0, shirt, root));
    for (const side of [-1, 1]) ball("neighbour-hand", .14, side * .3, .65, 0, skin, root);
    if (i === 0) {
      cylinder("neighbour-straw-hat", .7, .7, .055, 0, 1.73, 0, cream, root);
      cylinder("neighbour-straw-hat-crown", .4, .3, .17, 0, 1.83, 0, cream, root);
      cylinder("neighbour-watering-can", .26, .26, .24, -.4, .61, -.04, sage, root);
    }
    neighbours.push({ root, legs, arms, x, z, phase: i * 2.1 });
  }
  const outdoorLight = new HemisphericLight("upstairs-daylight", new Vector3(-.3, 1, .2), scene);
  outdoorLight.diffuse = new Color3(1, .93, .79); outdoorLight.groundColor = new Color3(.45, .48, .32); outdoorLight.intensity = .9;
  const warm = new PointLight("upstairs-warm-lamp", new Vector3(30 * CELL, base + 2, 2.5 * CELL), scene);
  warm.diffuse = new Color3(1, .74, .4); warm.intensity = 1.6; warm.range = 13;
  const meshes = [...surfaces, ...scene.meshes.slice(start)];
  outdoorLight.includedOnlyMeshes = meshes; warm.includedOnlyMeshes = meshes;
  for (const mesh of meshes) { mesh.applyFog = false; mesh.isPickable = false; mesh.receiveShadows = true; }
  return {
    meshes,
    animate(time: number, reduced = false) {
      for (const npc of neighbours) {
        const phase = reduced ? npc.phase : time * .55 + npc.phase;
        npc.root.position.z = npc.z + Math.sin(phase * .3) * 1.2;
        npc.root.position.x = npc.x + Math.cos(phase * .3) * .35;
        npc.root.rotation.y = Math.sin(phase * .3) >= 0 ? -.35 : Math.PI - .35;
        npc.legs.forEach((leg, i) => { leg.rotation.x = reduced ? 0 : Math.sin(phase * 3 + i * Math.PI) * .18; });
        npc.arms.forEach((arm, i) => { arm.rotation.x = reduced ? 0 : Math.sin(phase * 3 + i * Math.PI) * -.12; });
      }
    },
  };
}
