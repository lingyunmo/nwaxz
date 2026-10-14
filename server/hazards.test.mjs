import { test } from "node:test";
import assert from "node:assert/strict";
import { FluidWorld } from "../src/game/fluid.ts";
import { levels } from "../src/game/levels.ts";

const cleanLevel = levels.find((level) => level.id === "clean-water-only");
assert.ok(cleanLevel, "clean-water-only level is defined");

function particle(x, y, kind) {
  return { x, y, oldX: x, oldY: y, vx: 0, vy: 0, ...(kind ? { kind } : {}) };
}

function sandbox(overrides = {}) {
  return {
    ...cleanLevel,
    initialWater: 0,
    extraPools: [],
    rocks: [],
    coins: [],
    solution: [],
    ...overrides,
  };
}

function assertConserved(world) {
  assert.equal(
    world.particles.length + world.delivered + world.dirtyDelivered,
    world.emitted,
  );
}

test("neighbor contact contaminates clean water while separated drops stay clean", () => {
  const touching = new FluidWorld(sandbox());
  touching.particles = [particle(230, 300), particle(236, 300, "sewage")];
  touching.emitted = touching.particles.length;
  touching.dig(233, 300, 28);
  touching.advance(1 / 60);
  assert.deepEqual(touching.particles.map((drop) => drop.kind), ["sewage", "sewage"]);

  const separated = new FluidWorld(sandbox());
  separated.particles = [particle(220, 300), particle(260, 300, "sewage")];
  separated.emitted = separated.particles.length;
  separated.digLine({ x: 220, y: 300 }, { x: 260, y: 300 }, 30);
  for (let frame = 0; frame < 8; frame++) separated.advance(1 / 60);
  assert.equal(separated.particles[0].kind, undefined);
  assert.equal(separated.particles[1].kind, "sewage");
});

test("sewage passing through a coin does not collect it", () => {
  const world = new FluidWorld(sandbox({ coins: [{ x: 240, y: 300 }] }));
  world.particles = [particle(240, 300, "sewage")];
  world.emitted = 1;
  world.dig(240, 300, 24);
  for (let frame = 0; frame < 4; frame++) world.advance(1 / 60);
  assert.equal(world.collected, 0);
  assertConserved(world);
});

test("sewage at the outlet increments dirtyDelivered, not clean delivered", () => {
  const world = new FluidWorld(sandbox());
  world.particles = [particle(378, 607), particle(402, 607, "sewage")];
  world.emitted = 2;
  world.advance(0.1);
  assert.ok(world.delivered > 0);
  assert.ok(world.dirtyDelivered > 0);
  assertConserved(world);
});

test("the intended clean-water route wins with all coins and no dirty delivery", () => {
  const world = new FluidWorld(cleanLevel);
  for (let i = 1; i < cleanLevel.solution.length; i++)
    world.digLine(cleanLevel.solution[i - 1], cleanLevel.solution[i], 25);
  for (let frame = 0; frame < 2400 && world.delivered < 100; frame++)
    world.advance(1 / 60);

  assert.ok(world.delivered >= 100, `only ${world.delivered} clean drops delivered`);
  assert.equal(world.collected, 7);
  assert.equal(world.dirtyDelivered, 0);
  assertConserved(world);
});

test("opening a route below the sewage pool contaminates the outlet", () => {
  const world = new FluidWorld(cleanLevel);
  const wrongRoute = [
    { x: 335, y: 190 },
    { x: 340, y: 250 },
    { x: 365, y: 335 },
    { x: 380, y: 450 },
    { x: 392, y: 592 },
  ];
  for (let i = 1; i < wrongRoute.length; i++)
    world.digLine(wrongRoute[i - 1], wrongRoute[i], 25);
  for (let frame = 0; frame < 2400 && world.dirtyDelivered === 0; frame++)
    world.advance(1 / 60);

  assert.ok(world.dirtyDelivered > 0);
  assertConserved(world);
});
