import assert from "node:assert/strict";
import test from "node:test";
import {
  BASEMENT_CRYSTALS, BASEMENT_PATROL_SPAWN, BASEMENT_PROPS, BASEMENT_RECTANGLES,
  BASEMENT_ROOMS, BASEMENT_START, floorAt, floorYAt, MAP_HEIGHT, stairsAt,
} from "../src/escape/basement-map.ts";

const WIDTH = 25;
const index = (x, z) => z * WIDTH + x;
const carved = new Set();
for (const { x, z, w, h } of BASEMENT_RECTANGLES) {
  for (let row = z; row < z + h; row++) for (let column = x; column < x + w; column++) carved.add(index(column, row));
}
// The established changing room is the only ground-floor approach to the stairs.
for (let z = 19; z < 24; z++) for (let x = 1; x < 7; x++) carved.add(index(x, z));

const reachableFrom = (start) => {
  const first = index(Math.floor(start.x), Math.floor(start.z));
  const seen = new Set([first]), todo = [first];
  while (todo.length) {
    const at = todo.pop(), x = at % WIDTH, z = Math.floor(at / WIDTH);
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      const next = index(nx, nz);
      if (nx >= 0 && nx < WIDTH && nz >= 0 && nz < MAP_HEIGHT && carved.has(next) && !seen.has(next)) {
        seen.add(next); todo.push(next);
      }
    }
  }
  return seen;
};

test("basement rectangles stay inside the 25x54 map and preserve the north boundary", () => {
  assert.equal(BASEMENT_START, 28);
  assert.equal(MAP_HEIGHT, 54);
  assert.ok(BASEMENT_RECTANGLES.length > 0);
  for (const { x, z, w, h } of BASEMENT_RECTANGLES) {
    assert.ok(x >= 1 && x + w <= 24, `rectangle x-boundary ${JSON.stringify({ x, z, w, h })}`);
    assert.ok(z >= 23 && z + h <= 53, `rectangle z-boundary ${JSON.stringify({ x, z, w, h })}`);
  }
  for (let z = BASEMENT_START; z <= 53; z++) {
    assert.equal(carved.has(index(0, z)), false, "west wall remains closed");
    assert.equal(carved.has(index(24, z)), false, "east wall remains closed");
  }
  for (let x = 0; x < WIDTH; x++) assert.equal(carved.has(index(x, 53)), false, "south wall remains closed");
  assert.equal(carved.has(index(4, 23)), true, "old changing room connects into the stair throat");
  assert.equal(carved.has(index(4, 28)), true, "stair throat connects to the basement entrance");
});

test("all basement space and interaction positions connect to the ground-floor stairs", () => {
  const reachable = reachableFrom({ x: 4.5, z: 22.5 });
  for (const tile of carved) {
    const z = Math.floor(tile / WIDTH);
    if (z >= BASEMENT_START) assert.ok(reachable.has(tile), `unreachable basement tile ${tile % WIDTH},${z}`);
  }
  const interactionPoints = [...BASEMENT_PROPS, ...BASEMENT_CRYSTALS, BASEMENT_PATROL_SPAWN];
  for (const point of interactionPoints) {
    const x = Math.floor(point.x), z = Math.floor(point.z);
    assert.ok(carved.has(index(x, z)), `${point.id ?? "patrol spawn"} is in a carved tile`);
    assert.ok(reachable.has(index(x, z)), `${point.id ?? "patrol spawn"} is reachable`);
  }
  // The connected carved network contains several independent routes around the galleries.
  let edges = 0;
  for (const tile of carved) {
    const x = tile % WIDTH, z = Math.floor(tile / WIDTH);
    for (const [nx, nz] of [[x + 1, z], [x, z + 1]]) if (carved.has(index(nx, nz))) edges++;
  }
  assert.ok(edges - carved.size + 1 >= 2, "at least two independent loops are present");
});

test("stair hints and floor elevations follow the connecting run", () => {
  assert.equal(stairsAt({ x: 3.5, z: 23.5 }), true);
  assert.equal(stairsAt({ x: 5.5, z: 29.5 }), true);
  assert.equal(stairsAt({ x: 2.5, z: 25 }), false);
  assert.equal(stairsAt({ x: 4.5, z: 30 }), false);
  assert.equal(floorAt({ x: 4.5, z: 23.99 }), 0);
  assert.equal(floorAt({ x: 4.5, z: 24 }), -1);
  assert.equal(floorYAt({ x: 4.5, z: 24 }), 0);
  assert.equal(floorYAt({ x: 4.5, z: 26 }), -2.4);
  assert.equal(floorYAt({ x: 4.5, z: BASEMENT_START }), -4.8);
  assert.equal(floorYAt({ x: 4.5, z: 40 }), -4.8);
});

test("basement has named zones, unblocked stairs, hiding places and task props", () => {
  for (const name of ["储藏间", "泵房", "冷藏室", "巡检廊", "集水池"]) {
    assert.ok(BASEMENT_ROOMS.some(room => room.name === name), `missing named room ${name}`);
  }
  assert.ok(BASEMENT_PROPS.filter(prop => prop.kind === "wardrobe").length >= 3);
  assert.deepEqual(BASEMENT_PROPS.find(prop => prop.id === "basement-relay")?.kind, "power");
  assert.deepEqual(BASEMENT_PROPS.find(prop => prop.id === "basement-sluice")?.kind, "valve");
  assert.ok(BASEMENT_PROPS.every(prop => prop.loot === undefined), "the map adds no new inventory item type");
  assert.equal(BASEMENT_CRYSTALS.filter(crystal => crystal.kind === "freeze").length, 1);
  assert.equal(BASEMENT_CRYSTALS.filter(crystal => crystal.kind === "reveal").length, 1);
  assert.ok(Math.hypot(BASEMENT_PATROL_SPAWN.x - 4.5, BASEMENT_PATROL_SPAWN.z - 28.5) >= 6,
    "patrol spawn stays away from the stair entrance");
  for (const prop of BASEMENT_PROPS) assert.equal(stairsAt(prop), false, `${prop.id} does not block the stairs`);
});
