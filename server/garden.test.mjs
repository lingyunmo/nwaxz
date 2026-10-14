import { test } from "node:test";
import assert from "node:assert/strict";
import { FluidWorld } from "../src/game/fluid.ts";
import { levels } from "../src/game/levels.ts";

const byId = (id) => {
  const level = levels.find((candidate) => candidate.id === id);
  assert.ok(level, `missing level ${id}`);
  return level;
};

const seed = (world, particles) => {
  world.particles = particles.map(({ x, y, kind }) => ({
    x, y, oldX: x, oldY: y, vx: 0, vy: 0, ...(kind ? { kind } : {}),
  }));
  world.emitted = particles.length;
};

const assertConserved = (world) => {
  assert.equal(
    world.particles.length + world.delivered + world.dirtyDelivered +
      world.plantAbsorbed + world.storedWater,
    world.emitted,
  );
};

test("plants block clean water and absorb sewage only up to their tolerance", () => {
  const level = structuredClone(byId("garden-gate"));
  level.initialWater = 0;
  level.valves = [];
  level.coins = [];
  level.plants[0].tolerance = 3;

  const cleanWorld = new FluidWorld(level);
  cleanWorld.dig(108, 350, 60);
  seed(cleanWorld, [{ x: 108, y: 350 }]);
  cleanWorld.advance(1 / 60);
  assert.equal(cleanWorld.plantRemaining[0], 3);
  assert.equal(cleanWorld.plantAbsorbed, 0);
  assert.equal(cleanWorld.particles.length, 1, "clean drop should be deflected, not absorbed");

  const sewageWorld = new FluidWorld(level);
  sewageWorld.dig(108, 350, 60);
  seed(sewageWorld, Array.from({ length: 5 }, (_, i) => ({
    x: 90 + i * 8, y: 350, kind: "sewage",
  })));
  sewageWorld.advance(1 / 60);
  assert.equal(sewageWorld.plantAbsorbed, 3);
  assert.equal(sewageWorld.plantRemaining[0], 0);
  assert.equal(sewageWorld.particles.length, 2, "excess sewage should pass after the plant wilts");
  assertConserved(sewageWorld);
});

test("sponge has finite capacity and squeezing an empty sponge creates no water", () => {
  const level = structuredClone(byId("sponge-transfer"));
  level.initialWater = 0;
  level.coins = [];
  level.sponges[0].capacity = 2;
  const world = new FluidWorld(level);

  assert.equal(world.squeezeSponge(0), false);
  assert.equal(world.emitted, 0);
  assert.equal(world.storedWater, 0);

  world.dig(180, 400, 60);
  seed(world, [
    { x: 165, y: 400 },
    { x: 180, y: 400 },
    { x: 195, y: 400, kind: "sewage" },
  ]);
  world.advance(1 / 60);
  assert.equal(world.spongeContents[0].length, 2);
  assert.equal(world.particles.length, 1, "the full sponge should deflect the third drop");
  assert.equal(world.storedWater, 2);
  assertConserved(world);
});

test("squeezed water keeps its kind and is not immediately recaptured", () => {
  const level = structuredClone(byId("sponge-transfer"));
  level.initialWater = 0;
  level.coins = [];
  level.sponges[0].capacity = 2;
  // Put the outlet inside the sponge to exercise its release guard directly.
  level.sponges[0].release = { x: 180, y: 400 };
  const world = new FluidWorld(level);
  world.dig(180, 400, 60);
  seed(world, [
    { x: 160, y: 400 },
    { x: 200, y: 400, kind: "sewage" },
  ]);
  world.advance(1 / 60);
  assert.equal(world.spongeContents[0].length, 2);
  assert.equal(world.squeezeSponge(0), true);
  assert.equal(world.spongeContents[0].length, 0);
  assert.equal(world.spongeQueued[0].length, 2);
  assert.equal(world.storedWater, 2, "queued water remains part of the conserved total");
  assertConserved(world);

  world.advance(1 / 60);
  const released = world.particles.filter((particle) => particle.releasedBy === 0);
  assert.equal(released.length, 1);
  assert.equal(released[0].kind, "sewage");
  assert.equal(world.spongeContents[0].length, 0, "release guard prevents immediate reabsorption");
  assert.equal(world.spongeQueued[0].length, 1);
  assertConserved(world);
});

test("sponge route needs squeezing, then delivers all water and collects every coin", () => {
  const level = byId("sponge-transfer");
  const prepare = () => {
    const world = new FluidWorld(level);
    for (let i = 1; i < level.solution.length; i++)
      world.digLine(level.solution[i - 1], level.solution[i]);
    return world;
  };

  const unsqueezed = prepare();
  for (let i = 0; i < 2400; i++) unsqueezed.advance(1 / 60);
  assert.ok(unsqueezed.delivered < 100, "stored water cannot reach the tub on its own");
  assertConserved(unsqueezed);

  const squeezed = prepare();
  for (let i = 0; i < 2400 && squeezed.delivered < 100; i++) {
    squeezed.advance(1 / 60);
    if (squeezed.spongeContents[0].length === level.sponges[0].capacity)
      assert.equal(squeezed.squeezeSponge(0), true);
  }
  assert.ok(squeezed.delivered >= 100);
  assert.equal(squeezed.collected, 7);
  assert.equal(squeezed.dirtyDelivered, 0);
  assertConserved(squeezed);
});
