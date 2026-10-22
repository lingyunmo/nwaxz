import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import "@babylonjs/core/Culling/ray.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/2.0/glTFLoader.js";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength.js";
import { createEscapeScene, aimCamera, CELL } from "../src/escape/scene.ts";
import { installEscapeModels } from "../src/escape/models.ts";
import { EscapeWorld } from "../src/escape/world.ts";

test("real 3D camera can look up/down while world UVs and geometry stay fixed", () => {
  const engine = new NullEngine(), view = createEscapeScene(engine), w = new EscapeWorld();
  try {
    const walls = view.scene.getMeshByName("solid-tile-walls");
    const positions = [...walls.getVerticesData("position")], uv = [...walls.getVerticesData("uv")];
    const floor = view.scene.getMeshByName("fixed-floor-uv");
    assert.ok(floor.getVerticesData("normal")[1] > .99, "floor normals point into the room");
    for (const pitch of [-1.3, 0, 1.3]) {
      w.data.player.pitch = pitch; aimCamera(view, w, 1.65); view.camera.getViewMatrix(true);
      const ray = view.camera.getForwardRay();
      assert.ok(Math.abs(ray.direction.y - Math.sin(pitch)) < .0001);
      assert.deepEqual(walls.getVerticesData("position"), positions);
      assert.deepEqual(walls.getVerticesData("uv"), uv);
    }
    assert.equal(view.doors.size, 6);
    for (const hinge of view.doors.values()) assert.ok(hinge.getChildMeshes().length >= 3);
    assert.equal(walls.billboardMode, 0);
    assert.equal(view.camera.position.y, 1.65);
    assert.equal(view.camera.position.x, w.data.player.x * CELL);
  } finally { view.scene.dispose(); engine.dispose(); }
});

test("GLBs load into Babylon, instantiate real cabinets, and play skinned belly laugh", async () => {
  const engine = new NullEngine(), view = createEscapeScene(engine), containers = [];
  let models;
  try {
    for (const name of ["escape-props-v1.glb", "extreme-milk-frog-v1.glb"]) {
      const bytes = await fs.readFile(new URL(`../public/assets/models/${name}`, import.meta.url));
      containers.push(await LoadAssetContainerAsync(bytes, view.scene, { pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true, animationStartMode: 0 } } }));
    }
    models = installEscapeModels(view.scene, ...containers);
    assert.equal(models.cabinets.size, 5);
    assert.ok(models.actorMeshes.some(m => m.skeleton?.bones.length === 18));
    for (const m of models.actorMeshes) assert.equal(m.billboardMode, 0);
    const w = new EscapeWorld(); models.animate(w, 1/60);
    assert.equal(models.clips.get("walk").isPlaying, true);
    models.animate(w, 1/60); assert.equal(models.clips.get("walk").isPlaying, true, "one waypoint frame must not restart the gait");
    models.animate(w, .25); assert.equal(models.clips.get("idle").isPlaying, true);
    w.data.hunter.state = "chase"; models.animate(w, 1/60);
    assert.equal(models.clips.get("run").isPlaying, true);
    w.capture(); const before = w.snapshot(); models.animate(w, 1/60);
    const laugh = models.clips.get("laugh");
    assert.equal(laugh.isPlaying, true); assert.equal(laugh.loopAnimation, true);
    const jaw = laugh.targetedAnimations.find(a => a.target.name.endsWith(":jaw"));
    assert.ok(jaw, "jaw is animated, not a frozen picture");
    laugh.goToFrame(12); view.scene.render();
    laugh.stop(); laugh.enableBlending = false; laugh.start(true); laugh.goToFrame(24); view.scene.render();
    for (const suffix of ["L", "R"]) {
      const hand = laugh.targetedAnimations.find(a => a.target.name.endsWith(`:hand.${suffix}`)).target;
      hand.computeWorldMatrix(true);
      const point = Vector3.TransformCoordinates(hand.getAbsolutePosition(), models.actorRoot.getWorldMatrix().clone().invert());
      assert.ok(Math.abs(point.x) < .35 && point.y > .7 && point.y < 1.3 && point.z > .3, `laugh hand ${suffix} cradles the belly: ${point}`);
    }
    assert.ok(models.actorMeshes.some(m => m.getTotalVertices() > 500));
    assert.deepEqual(w.snapshot(), before, "cosmetic capture animation does not advance gameplay or save state");
    assert.equal(view.scene.getMeshByName("solid-tile-walls").isVisible, false);
    w.nextNight(); models.animate(w, 1/60);
    assert.equal(view.scene.getMeshByName("solid-tile-walls").isVisible, true);
    assert.equal(models.clips.get("laugh").isPlaying, false);
    assert.ok(view.scene.meshes.filter(m => m.isEnabled()).length < 240, "bounded mobile scene mesh count");
  } finally { models?.dispose(); for (const c of containers) c.dispose(); view.scene.dispose(); engine.dispose(); }
  assert.equal(engine.scenes.length, 0, "scene resources released");
});
