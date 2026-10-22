import type { AssetContainer } from "@babylonjs/core/assetContainer.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math.js";
import { CELL, colorMaterial } from "./scene.ts";
import { PROPS, type EscapeWorld } from "./world.ts";

export function installEscapeModels(scene: Scene, props: AssetContainer, frog: AssetContainer) {
  const propRoots = new Map<string, TransformNode>();
  const cabinets = new Map<string, { left: TransformNode; right: TransformNode }>();
  let wheel: TransformNode | undefined;
  const sources = [...props.transformNodes, ...props.meshes];
  for (const object of PROPS) {
    if (object.kind === "note") continue;
    const name = object.kind === "power" ? "fusebox" : object.kind === "exit" ? "grate" : object.kind;
    const source = sources.find(n => n.name === name);
    if (!source) throw new Error(`Missing solid prop ${name}`);
    const clone = source.clone(`prop:${object.id}`, null, false) as TransformNode;
    clone.position.set(object.x * CELL, object.kind === "power" ? .75 : object.kind === "valve" ? .35 : 0, object.z * CELL);
    if (object.kind === "exit") {
      clone.rotation.y = Math.PI; clone.position.z = 23 * CELL - .04;
      // The source prop also supports a closed decorative grate. Here its
      // backing is disabled so the real sewer crawlway remains visible.
      for (const mesh of clone.getChildMeshes()) if (mesh.material?.name === "wood_interior") mesh.setEnabled(false);
    }
    propRoots.set(object.id, clone);
    for (const mesh of clone.getChildMeshes()) { mesh.receiveShadows = true; mesh.isPickable = false; }
    const descendants = clone.getDescendants() as TransformNode[];
    if (object.kind === "wardrobe") {
      const left = descendants.find(n => n.name.includes("wardrobe_door_left"))!, right = descendants.find(n => n.name.includes("wardrobe_door_right"))!;
      if (!left || !right) throw new Error("Missing cabinet hinges");
      left.rotationQuaternion = right.rotationQuaternion = null;
      cabinets.set(object.id, { left, right });
    }
    if (object.kind === "valve") { wheel = descendants.find(n => n.name.includes("valve_wheel")); if (wheel) wheel.rotationQuaternion = null; }
  }
  const pipe = sources.find(n => n.name === "pipe")!;
  for (const [i, x, z] of [[0, 1.1, 5.5], [1, 9.1, 5.5], [2, 17.1, 15.5], [3, 22.8, 20.5]]) {
    const clone = pipe.clone(`pipe:${i}`, null, false) as TransformNode;
    clone.position.set(x * CELL, 0, z * CELL);
  }
  const paper = colorMaterial(scene, "old-readable-paper", "#bdb38b");
  const ink = colorMaterial(scene, "paper-ink", "#39392f");
  for (const note of PROPS.filter(p => p.kind === "note")) {
    const root = new TransformNode(`note:${note.id}`, scene);
    root.position.set(note.x * CELL, .08, note.z * CELL);
    const page = MeshBuilder.CreateBox("paper-sheet", { width: .22, height: .006, depth: .31 }, scene);
    page.parent = root; page.material = paper;
    for (let i = 0; i < 6; i++) {
      const line = MeshBuilder.CreateBox("ink-line", { width: .13 - (i % 2) * .03, height: .001, depth: .007 }, scene);
      line.parent = root; line.position.set(0, .004, -.1 + i * .033); line.material = ink;
    }
    propRoots.set(note.id, root);
  }
  const actor = frog.instantiateModelsToScene(n => `hunter:${n}`, false, { doNotInstantiate: true });
  const actorRoot = new TransformNode("solid-hunter", scene);
  for (const root of actor.rootNodes) root.parent = actorRoot;
  const actorMeshes = actorRoot.getChildMeshes();
  for (const mesh of actorMeshes) { mesh.isPickable = false; mesh.receiveShadows = true; }
  const clips = new Map(actor.animationGroups.map(group => {
    const name = group.name.replace(/^hunter:/, "");
    group.stop(); group.enableBlending = true; group.blendingSpeed = .12;
    return [name, group];
  }));
  for (const name of ["idle", "walk", "run", "laugh"]) if (!clips.has(name)) throw new Error(`Missing ${name} animation`);
  let animation = "", captured = false, stillFor = 0;
  const previous = new Vector3(-100, 0, -100);
  const environment = scene.meshes.filter(m => !actorMeshes.includes(m));
  const oldVisibility = new Map<AbstractMesh, boolean>();
  return {
    actorRoot, actorMeshes, cabinets, propRoots, clips,
    animate(world: EscapeWorld, dt: number) {
      const d = world.data, caught = d.phase === "caught" || d.phase === "lost", h = d.hunter;
      if (caught !== captured) {
        captured = caught;
        for (const mesh of environment) {
          if (caught) { oldVisibility.set(mesh, mesh.isVisible); mesh.isVisible = false; }
          else mesh.isVisible = oldVisibility.get(mesh) ?? mesh.isVisible;
        }
      }
      actorRoot.position.set(h.x * CELL, 0, h.z * CELL);
      actorRoot.rotation.y = Math.PI / 2 - h.angle;
      stillFor = Vector3.DistanceSquared(actorRoot.position, previous) > .000001 ? 0 : stillFor + dt;
      // A path waypoint may cost one simulation frame. Keep the walking cycle
      // through those brief gaps instead of restarting idle/walk at each tile.
      const clip = caught ? "laugh" : h.state === "chase" ? "run" : stillFor < .22 ? "walk" : "idle";
      if (clip !== animation) {
        for (const c of clips.values()) c.stop();
        clips.get(clip)!.start(true, 1); animation = clip;
      }
      previous.copyFrom(actorRoot.position);
      for (const [id, doors] of cabinets) {
        // Actual ajar doors, not a slit overlay pasted over the camera.
        const ajar = d.hidden === id ? .115 : .015, blend = 1 - Math.exp(-dt * 9);
        doors.left.rotation.y += (-ajar - doors.left.rotation.y) * blend;
        doors.right.rotation.y += (ajar - doors.right.rotation.y) * blend;
      }
      if (wheel && d.drained) wheel.rotation.z += dt * 1.7;
      for (const [id, root] of propRoots) if (id.endsWith("note")) root.setEnabled(!d.notes.includes(id));
      const powerMat = props.materials.find(m => m.name === "fuse_on_green");
      if (powerMat && "emissiveColor" in powerMat) (powerMat.emissiveColor as Color3).set(0, d.power ? .6 : .015, 0);
    },
    dispose() { actor.dispose(); actorRoot.dispose(); },
  };
}
