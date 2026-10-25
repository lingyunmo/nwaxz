import assert from "node:assert/strict";
import test from "node:test";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { CELL, aimCamera, createEscapeScene } from "../src/escape/scene.ts";
import { MAP, EscapeWorld } from "../src/escape/world.ts";
import { floorYAt } from "../src/escape/basement-map.ts";

test("rendered basement surfaces, stair treads and camera use world-space floor heights", () => {
  const engine = new NullEngine();
  const view = createEscapeScene(engine);
  try {
    const floor = view.scene.getMeshByName("fixed-floor-uv");
    assert.ok(floor, "floor surface exists");
    const positions = floor.getVerticesData(VertexBuffer.PositionKind);
    assert.ok(positions);
    const hasHeight = (y, zMin, zMax) => {
      for (let i = 0; i < positions.length; i += 3) {
        if (Math.abs(positions[i + 1] - y) < 1e-5 && positions[i + 2] >= zMin && positions[i + 2] <= zMax) return true;
      }
      return false;
    };
    assert.ok(hasHeight(0, 0, 24 * CELL), "ground-floor vertices stay at zero");
    assert.ok(hasHeight(-4.8, 28 * CELL, 52 * CELL), "basement floor vertices sit at -4.8m");
    assert.equal(MAP.length, 54);
    assert.ok(view.scene.getMeshByName("basement-floor-surfaces"), "basement floor uses its own material batch");
    assert.ok(view.scene.getMeshByName("basement-wall-surfaces"), "basement walls use their own material batch");
    assert.equal(view.scene.getMeshByName("basement-floor-surfaces").material.name, "basement-floor");
    assert.equal(view.scene.getMaterialByName("basement-tile").name, "basement-tile");
    assert.equal(view.scene.getMaterialByName("basement-ceiling").name, "basement-ceiling");
    assert.equal(view.scene.getMaterialByName("basement-secret").emissiveColor.r, 0, "mural is not self-lit");
    const mural = view.scene.getMeshByName("basement-secret-mural-pump");
    assert.equal(mural.material.name, "basement-secret");
    assert.ok(Math.abs(mural.position.z - (28 * CELL + .025)) < 1e-5);

    const treads = Array.from({ length: 16 }, (_, i) => view.scene.getMeshByName(`basement-stair:${i + 1}`));
    assert.ok(treads.every(Boolean), "all sixteen stone steps exist");
    const tops = treads.map(mesh => mesh.position.y + .16);
    for (let i = 1; i < tops.length; i++) assert.ok(tops[i] < tops[i - 1], `step ${i + 1} is lower than step ${i}`);
    assert.ok(Math.abs(tops[0] + .3) < 1e-5);
    assert.ok(Math.abs(tops.at(-1) + 4.8) < 1e-5);

    aimCamera(view, { data: { player: { x: 4.5, z: 28, angle: 0, pitch: 0 } } }, 1.65);
    assert.ok(Math.abs(view.camera.position.y + 3.15) < 1e-5, "camera eye follows the basement floor");
  } finally {
    view.scene.dispose();
    engine.dispose();
  }
});

test('flashlight perception uses the same stair elevation and pitch as the rendered beam',()=>{
 const w=new EscapeWorld(42);w.data.elapsed=10;
 Object.assign(w.data.player,{x:4.5,z:24.2,angle:Math.PI/2,pitch:0,light:true});
 Object.assign(w.data.hunter,{x:4.5,z:27.8,angle:-Math.PI/2});
 assert.equal(w.lightPerception.illuminated,false,'a level beam must not light a hunter far down the stairway');
 const dy=floorYAt(w.data.hunter)+1.1-floorYAt(w.data.player)-1.65;
 w.data.player.pitch=Math.atan2(dy,(27.8-24.2)*CELL);
 assert.equal(w.lightPerception.illuminated,true,'aiming down the stairs really illuminates the body');
});
