import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const modelPath = new URL("../public/assets/models/escape-props-v1.glb", import.meta.url);
const expectedRoots = ["wardrobe", "drawer", "fusebox", "valve", "grate", "pipe"];

function readGlb(path) {
  const bytes = fs.readFileSync(path);
  assert.ok(bytes.length >= 20, "GLB must contain a header and JSON chunk");
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", "GLB magic header");
  assert.equal(bytes.readUInt32LE(4), 2, "GLB version");
  assert.equal(bytes.readUInt32LE(8), bytes.length, "GLB declared file length");

  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.toString("ascii", 16, 20), "JSON", "first GLB chunk is JSON");
  assert.ok(20 + jsonLength <= bytes.length, "JSON chunk fits in the GLB");
  const document = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  let binary = Buffer.alloc(0);
  let offset = 20 + jsonLength;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.toString("ascii", offset + 4, offset + 8);
    assert.ok(offset + 8 + chunkLength <= bytes.length, `${chunkType} chunk fits in GLB`);
    if (chunkType === "BIN\0") binary = bytes.subarray(offset + 8, offset + 8 + chunkLength);
    offset += 8 + chunkLength;
  }
  return { bytes, document, binary };
}

function collectExternalUris(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) collectExternalUris(item, result);
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "uri" && typeof child === "string" && !child.startsWith("data:")) {
      result.push(child);
    }
    collectExternalUris(child, result);
  }
  return result;
}

test("escape prop GLB has the required hierarchy, geometry, and self-contained budget", () => {
  const { bytes, document } = readGlb(modelPath);
  assert.ok(bytes.length < 4 * 1024 * 1024, "escape props GLB must stay below 4 MiB");

  const scene = document.scenes?.[document.scene ?? 0];
  assert.ok(scene, "GLB has a default scene");
  const nodes = document.nodes ?? [];
  const roots = scene.nodes.map((index) => nodes[index]?.name);
  assert.deepEqual([...roots].sort(), [...expectedRoots].sort(), "six named scene roots");

  const nodesByName = new Map(nodes.map((node) => [node.name, node]));
  for (const name of ["wardrobe_door_left", "wardrobe_door_right", "valve_wheel"]) {
    assert.ok(nodesByName.has(name), `${name} node exists`);
    assert.ok(nodesByName.get(name).children?.length, `${name} has child geometry`);
  }
  const wardrobeRoot = nodesByName.get("wardrobe");
  const leftDoor = nodesByName.get("wardrobe_door_left");
  const rightDoor = nodesByName.get("wardrobe_door_right");
  assert.ok(Math.abs(Math.abs(leftDoor.translation?.[0] ?? 0) - 0.594) < 0.001,
    "left door pivot is at the wardrobe hinge edge");
  assert.ok(Math.abs(Math.abs(rightDoor.translation?.[0] ?? 0) - 0.594) < 0.001,
    "right door pivot is at the wardrobe hinge edge");
  const panelEdge = (door, panelName, side) => {
    const panelNode = nodes.find((node) => node.name === panelName);
    assert.ok(panelNode?.mesh !== undefined, `${panelName} panel mesh exists`);
    const accessorIndex = document.meshes[panelNode.mesh].primitives[0].attributes.POSITION;
    const accessor = document.accessors[accessorIndex];
    const rootX = wardrobeRoot.translation?.[0] ?? 0;
    const doorX = door.translation?.[0] ?? 0;
    const panelX = panelNode.translation?.[0] ?? 0;
    return rootX + doorX + panelX + accessor[side][0];
  };
  const leftInnerEdge = panelEdge(leftDoor, "wardrobe_door_panel_left", "max");
  const rightInnerEdge = panelEdge(rightDoor, "wardrobe_door_panel_right", "min");
  assert.ok(Math.abs((rightInnerEdge - leftInnerEdge) - 0.012) < 0.001,
    "closed wardrobe doors leave a 12 mm center gap");
  assert.ok(
    (document.materials ?? []).some((material) => material.name === "fuse_on_green"),
    "fuse status lamp material is present",
  );
  assert.ok((document.images ?? []).some((image) => image.mimeType === "image/png"),
    "the extracted wood image is embedded as PNG");
  assert.ok((document.materials ?? []).some((material) =>
    material.name === "wood_dark_old" && material.pbrMetallicRoughness?.baseColorTexture),
  "wood material uses the embedded atlas crop");

  const positionAccessors = (document.meshes ?? [])
    .flatMap((mesh) => mesh.primitives ?? [])
    .map((primitive) => primitive.attributes?.POSITION)
    .filter((index) => Number.isInteger(index));
  assert.ok(positionAccessors.length > 0, "meshes expose POSITION accessors");
  assert.ok((document.meshes ?? []).some((mesh) =>
    (mesh.primitives ?? []).some((primitive) => Number.isInteger(primitive.attributes?.TEXCOORD_0))),
  "wood geometry carries UV coordinates");
  for (const index of positionAccessors) {
    const accessor = document.accessors?.[index];
    assert.ok(accessor, `POSITION accessor ${index} exists`);
    assert.equal(accessor.type, "VEC3", `POSITION accessor ${index} has three axes`);
    assert.equal(accessor.min?.length, 3, `POSITION accessor ${index} has 3-axis minimum`);
    assert.equal(accessor.max?.length, 3, `POSITION accessor ${index} has 3-axis maximum`);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Number.isFinite(accessor.min[axis]), `POSITION accessor ${index} minimum is finite`);
      assert.ok(Number.isFinite(accessor.max[axis]), `POSITION accessor ${index} maximum is finite`);
      assert.ok(accessor.max[axis] > accessor.min[axis], `POSITION accessor ${index} spans axis ${axis}`);
    }
  }

  assert.deepEqual(collectExternalUris(document), [], "GLB has no external URI dependencies");
});

function readAccessor(document, binary, accessorIndex) {
  const accessor = document.accessors[accessorIndex];
  const view = document.bufferViews[accessor.bufferView];
  assert.ok(accessor && view, `accessor ${accessorIndex} has a buffer view`);
  const component = {
    5121: { bytes: 1, read: (data, at) => data.getUint8(at) },
    5123: { bytes: 2, read: (data, at) => data.getUint16(at, true) },
    5125: { bytes: 4, read: (data, at) => data.getUint32(at, true) },
    5126: { bytes: 4, read: (data, at) => data.getFloat32(at, true) },
  }[accessor.componentType];
  const componentCount = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  assert.ok(component, `accessor ${accessorIndex} has a supported component type`);
  assert.ok(componentCount, `accessor ${accessorIndex} has a supported type`);
  const elementSize = component.bytes * componentCount;
  const stride = view.byteStride ?? elementSize;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  return Array.from({ length: accessor.count }, (_, item) =>
    Array.from({ length: componentCount }, (_, lane) =>
      component.read(data, start + item * stride + lane * component.bytes)));
}

test("milk frog GLB has four animated clips and real 18-joint skin weights", () => {
  const { bytes, document, binary } = readGlb(
    new URL("../public/assets/models/extreme-milk-frog-v1.glb", import.meta.url),
  );
  assert.ok(bytes.length < 4 * 1024 * 1024, "character GLB must stay below 4 MiB");
  assert.ok(binary.length > 0, "character GLB contains binary geometry and animation data");
  assert.deepEqual(collectExternalUris(document), [], "character GLB has no external URI dependencies");

  const skins = document.skins ?? [];
  assert.ok(skins.length > 0, "character has a glTF skin");
  const skin = skins.find((candidate) => candidate.joints?.length > 0);
  assert.ok(skin, "character skin has joints");
  assert.equal(skin.joints.length, 18, "character skin has 18 joints");

  const skinnedPrimitives = (document.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
    .filter((primitive) => Number.isInteger(primitive.attributes?.JOINTS_0)
      && Number.isInteger(primitive.attributes?.WEIGHTS_0));
  assert.ok(skinnedPrimitives.length > 0, "meshes expose JOINTS_0 and WEIGHTS_0 attributes");
  for (const primitive of skinnedPrimitives) {
    const position = document.accessors[primitive.attributes.POSITION];
    const jointAccessor = document.accessors[primitive.attributes.JOINTS_0];
    const weightAccessor = document.accessors[primitive.attributes.WEIGHTS_0];
    assert.equal(jointAccessor.type, "VEC4", "JOINTS_0 has four joint lanes per vertex");
    assert.equal(weightAccessor.type, "VEC4", "WEIGHTS_0 has four weight lanes per vertex");
    assert.equal(jointAccessor.count, position.count, "JOINTS_0 covers every mesh vertex");
    assert.equal(weightAccessor.count, position.count, "WEIGHTS_0 covers every mesh vertex");
    const joints = readAccessor(document, binary, primitive.attributes.JOINTS_0);
    const weights = readAccessor(document, binary, primitive.attributes.WEIGHTS_0);
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      let totalWeight = 0;
      for (let lane = 0; lane < 4; lane += 1) {
        const weight = weights[vertex][lane];
        assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1.001,
          "skin weights contain finite normalized values");
        if (weight > 1e-5) assert.ok(joints[vertex][lane] < skin.joints.length,
          "nonzero skin weight points to a joint in the skin");
        totalWeight += weight;
      }
      assert.ok(Math.abs(totalWeight - 1) < 0.01, "per-vertex skin weights sum to one");
    }
  }

  const expectedDurations = { idle: 4, laugh: 29 / 12, run: 17 / 24, walk: 29 / 24 };
  const animations = document.animations ?? [];
  assert.deepEqual(animations.map((animation) => animation.name).sort(),
    Object.keys(expectedDurations).sort(), "idle, laugh, run, and walk animations exist");
  for (const animation of animations) {
    assert.ok(animation.channels?.length > 0, `${animation.name} has animation channels`);
    const samplers = animation.samplers ?? [];
    let duration = 0;
    for (const channel of animation.channels) {
      const sampler = samplers[channel.sampler];
      assert.ok(sampler, `${animation.name} channel references a sampler`);
      const input = document.accessors[sampler.input];
      const output = document.accessors[sampler.output];
      assert.equal(input.type, "SCALAR", `${animation.name} sampler input is time`);
      assert.ok(output.count >= input.count, `${animation.name} sampler has output keys`);
      assert.ok(document.nodes[channel.target.node], `${animation.name} targets an existing node`);
      assert.ok(["translation", "rotation", "scale", "weights"].includes(channel.target.path),
        `${animation.name} uses a valid channel path`);
      duration = Math.max(duration, input.max[0] - input.min[0]);
      const values = readAccessor(document, binary, sampler.output), first = values[0], last = values.at(-1);
      const error = Math.max(...first.map((v, i) => Math.abs(v - last[i])));
      const signError = Math.max(...first.map((v, i) => Math.abs(v + last[i])));
      assert.ok(error < 1e-5 || channel.target.path === "rotation" && signError < 1e-5, `${animation.name} ${document.nodes[channel.target.node].name} ${channel.target.path} loop closes: ${error}`);
    }
    assert.ok(Math.abs(duration - expectedDurations[animation.name]) < 1e-5,
      `${animation.name} duration is ${expectedDurations[animation.name]} seconds`);
  }
});
