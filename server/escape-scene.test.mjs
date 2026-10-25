import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { frogPose } from "../src/escape/frog.ts";
import "@babylonjs/core/Culling/ray.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/2.0/glTFLoader.js";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength.js";
import { createEscapeScene, aimCamera, CELL } from "../src/escape/scene.ts";
import { installEscapeModels } from "../src/escape/models.ts";
import { EscapeWorld, PROPS } from "../src/escape/world.ts";

test("flashlight projection stays centered after moving, turning and looking up/down", () => {
  const engine = new NullEngine(), view = createEscapeScene(engine), world = new EscapeWorld();
  try {
    const cookie = new Texture(null, view.scene);
    cookie.isReady = () => true;
    view.torch.projectionTexture = cookie;
    const effect = { setMatrix() {}, setTexture() {} };
    let previous;
    for (const [x, z, angle, pitch, height] of [[3.5,5.5,-Math.PI/2,0,1.65], [12.5,9.5,0,.65,1.65], [20.5,20.5,Math.PI,-.7,1.02]]) {
      Object.assign(world.data.player, { x, z, angle, pitch });
      aimCamera(view, world, height);
      view.camera.getViewMatrix(true);
      view.torch.transferTexturesToEffect(effect, "0");
      const matrix = view.torch.projectionTextureMatrix;
      const hit = view.camera.position.add(view.camera.getForwardRay().direction.scale(4));
      const projected = Vector3.TransformCoordinates(hit, matrix);
      // Allow the camera's Euler/float rounding, while rejecting world-fixed projection.
      assert.ok(Math.abs(projected.x - .5) < .003 && Math.abs(projected.y - .5) < .003,
        `beam must follow camera at ${x},${z}, yaw ${angle}, pitch ${pitch}: ${projected}`);
      if (previous) assert.notDeepEqual([...matrix.m], previous, "moving the beam must update its cookie transform");
      previous = [...matrix.m];
      assert.equal(view.torch.intensity, 5);
    }
    world.data.player.light = false; aimCamera(view, world, 1.65); assert.equal(view.torch.intensity, 0);
    world.data.player.light = true; world.data.player.battery = 0; aimCamera(view, world, 1.65); assert.equal(view.torch.intensity, 0);
    world.data.player.battery = 100; world.data.hidden = "bed-hide"; aimCamera(view, world, 1.65); assert.equal(view.torch.intensity, 0);
  } finally { view.scene.dispose(); engine.dispose(); }
});

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
    assert.equal(view.doors.size, 8);
    for (const hinge of view.doors.values()) assert.ok(hinge.getChildMeshes().length >= 3);
    assert.equal(walls.billboardMode, 0);
    assert.equal(view.camera.position.y, 1.65);
    assert.equal(view.camera.position.x, w.data.player.x * CELL);
  } finally { view.scene.dispose(); engine.dispose(); }
});

test("solid cabinets coexist with upright original-art frog and the canonical belly laugh", async () => {
  const engine = new NullEngine(), view = createEscapeScene(engine);
  let props, models;
  try {
    const bytes = await fs.readFile(new URL("../public/assets/models/escape-props-v1.glb", import.meta.url));
    props = await LoadAssetContainerAsync(bytes, view.scene, { pluginExtension: ".glb", pluginOptions: { gltf: { skipMaterials: true, animationStartMode: 0 } } });
    models = installEscapeModels(view.scene, props, { original: new Texture(null, view.scene), actions: new Texture(null, view.scene), directionIdle: new Texture(null, view.scene), directionWalk: new Texture(null, view.scene) });
    assert.equal(models.cabinets.size, PROPS.filter(prop => prop.kind === "wardrobe").length);
    const w = new EscapeWorld(); models.animate(w, .3);
    const mainPower = view.scene.getMeshByName("power-state:power"), basementPower = view.scene.getMeshByName("power-state:basement-relay");
    const sluiceLamp = view.scene.getMeshByName("valve-state:basement-sluice");
    const sluiceWheel = models.propRoots.get("basement-sluice").getDescendants().find(n => n.name.includes("valve_wheel"));
    assert.ok(mainPower?.material && basementPower?.material && sluiceLamp?.material && sluiceWheel);
    w.data.power = true; models.animate(w, .1);
    assert.equal(mainPower.material.name, "valve-state-ready");
    assert.equal(basementPower.material.name, "power-state-off", "ground power cannot pretend the basement relay is repaired");
    assert.equal(sluiceLamp.material.name, "valve-state-basement-sluice");
    const beforeWheel = sluiceWheel.rotation.z;
    w.data.basement.power = w.data.basement.sluice = true; models.animate(w, .1);
    assert.equal(basementPower.material.name, "valve-state-ready"); assert.equal(sluiceLamp.material.name, "valve-state-ready");
    assert.ok(sluiceWheel.rotation.z > beforeWheel, "the actual sluice wheel responds to its own completed task");
    w.data.power = false; w.data.basement.power = w.data.basement.sluice = false; models.animate(w, .1);
    assert.equal(basementPower.material.name, "power-state-off"); assert.equal(sluiceLamp.material.name, "valve-state-basement-sluice");
    assert.equal(models.actorRoot.position.x, w.data.hunter.x * CELL);
    for (const mesh of models.actorMeshes) {
      assert.equal(mesh.billboardMode, Mesh.BILLBOARDMODE_Y, "camera pitch never tips the character");
      assert.ok(mesh.getTotalVertices() > 100, "deformable artwork supports continuous breathing/laughter");
    }
    w.data.hunter.state = "chase"; models.animate(w, 1/60);
    assert.equal(models.actor.pose.motion, "run");
    w.capture(); const before = w.snapshot(); models.animate(w, 1/60);
    assert.deepEqual(models.actor.pose, { sheet: "original", frame: 1, motion: "laugh" });
    const positions = [...models.actorMeshes[0].getVerticesData("position")];
    models.animate(w, .08);
    assert.notDeepEqual(models.actorMeshes[0].getVerticesData("position"), positions, "belly laugh keeps moving while game is frozen");
    assert.deepEqual(w.snapshot(), before, "cosmetic laughter never advances simulation or saves");
    assert.equal(view.scene.getMeshByName("solid-tile-walls").isVisible, false);
    w.nextNight(); models.animate(w, 1/60);
    assert.equal(view.scene.getMeshByName("solid-tile-walls").isVisible, true);
    assert.notEqual(models.actor.pose.motion, "laugh");
    const activeExpansionMeshes = view.scene.meshes.filter(m => m.isEnabled()).length;
    w.data.expansion.enabled = false; models.animate(w, 1/60);
    assert.ok(view.scene.meshes.filter(m => m.isEnabled()).length < activeExpansionMeshes,
      "disabling the expansion removes its props from the active scene");
  } finally { models?.dispose(); props?.dispose(); view.scene.dispose(); engine.dispose(); }
  assert.equal(engine.scenes.length, 0);
});

test("frog motion uses original standing/laugh plus distinct search, peek, chase and lunge poses", () => {
  const w = new EscapeWorld();
  assert.deepEqual(frogPose(w, 0, false), {sheet:"original",frame:0,motion:"idle"});
  assert.equal(frogPose(w, 4.6, false).frame, 0);
  assert.equal(frogPose(w, 4.6, false).sheet, "actions");
  w.data.hunter.state = "search";
  assert.equal(frogPose(w, 0, false).frame, 1);
  assert.equal(frogPose(w, 1.5, false).frame, 3);
  assert.equal(frogPose(w, 2.6, false).frame, 2);
  w.data.hidden = "bed-hide"; Object.assign(w.data.hunter, w.data.player);
  assert.equal(frogPose(w, 0, false).motion, "peek");
  w.data.hidden = undefined; w.data.hunter.state = "chase";
  assert.equal(frogPose(w, 0, true).motion, "lunge");
  w.data.hunter.x += 3;
  assert.equal(frogPose(w, 0, true).frame, 6);
  assert.equal(frogPose(w, .21, true).frame, 7);
  assert.equal(frogPose(w, .21, true).mirror, true, "alternate stride leads with the opposite leg");
  w.capture();
  assert.deepEqual(frogPose(w, 55, true), {sheet:"original",frame:1,motion:"laugh"});
});
