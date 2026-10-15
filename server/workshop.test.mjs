import { test } from "node:test";
import assert from "node:assert/strict";
import { FluidWorld } from "../src/game/fluid.ts";
import { levels } from "../src/game/levels.ts";

const levelById = (id) => {
  const level = levels.find((candidate) => candidate.id === id);
  assert.ok(level, `missing level ${id}`);
  return level;
};

const prepare = (level) => {
  const world = new FluidWorld(level);
  for (let i = 1; i < level.solution.length; i++)
    world.digLine(level.solution[i - 1], level.solution[i]);
  return world;
};

const assertConserved = (world) => {
  assert.equal(
    world.particles.length + world.delivered + world.dirtyDelivered +
      world.plantAbsorbed + world.storedWater,
    world.emitted,
  );
};

test("valve-wind-relay needs wind to clear the raised route", () => {
  const level = levelById("valve-wind-relay");
  const world = prepare(level);
  assert.equal(world.toggleValve(0), true);

  for (let i = 0; i < 3600; i++) world.advance(1 / 60);
  assert.ok(world.delivered < 100, `closed fan unexpectedly delivered ${world.delivered}`);
  assertConserved(world);

  assert.equal(world.toggleFan(0), true);
  for (let i = 0; i < 3600 && world.delivered < 100; i++) world.advance(1 / 60);
  assert.ok(world.delivered >= 100, `open fan delivered only ${world.delivered}`);
  assert.equal(world.collected, 7);
  assert.equal(world.dirtyDelivered, 0);
  assertConserved(world);
});

test("sponge-relay requires both sponges to be squeezed repeatedly", () => {
  const level = levelById("sponge-relay");

  const untouched = prepare(level);
  untouched.toggleValve(0);
  for (let i = 0; i < 3600; i++) untouched.advance(1 / 60);
  assert.ok(untouched.delivered < 100, "water should remain stored without squeezing");
  assert.equal(untouched.spongeContents[0].length, level.sponges[0].capacity);
  assertConserved(untouched);

  const topOnly = prepare(level);
  topOnly.toggleValve(0);
  for (let i = 0; i < 3600; i++) {
    topOnly.advance(1 / 60);
    if (i % 60 === 59) topOnly.squeezeSponge(0);
  }
  assert.ok(topOnly.delivered < 100, "releasing only the upper sponge should leave the lower one blocking the route");
  assert.equal(topOnly.spongeContents[1].length, level.sponges[1].capacity);
  assertConserved(topOnly);

  const relay = prepare(level);
  relay.toggleValve(0);
  for (let i = 0; i < 6000 && relay.delivered < 100; i++) {
    relay.advance(1 / 60);
    if (i % 60 === 59) {
      relay.squeezeSponge(0);
      relay.squeezeSponge(1);
    }
  }
  assert.ok(relay.delivered >= 100, `repeated relay squeezing delivered only ${relay.delivered}`);
  assert.equal(relay.collected, 7);
  assert.equal(relay.dirtyDelivered, 0);
  assertConserved(relay);
});

test("pausing and resuming the relay valve preserves its finite water budget", () => {
  const level = levelById("sponge-relay");
  const world = prepare(level);
  assert.equal(world.toggleValve(0), true);
  for (let i = 0; i < 120; i++) world.advance(1 / 60);
  const firstBatch = world.emitted;
  assert.ok(firstBatch > 0 && firstBatch < 208);
  assert.equal(world.toggleValve(0), true);
  for (let i = 0; i < 120; i++) world.advance(1 / 60);
  assert.equal(world.emitted, firstBatch, "closed valve must not emit during the pause");
  assertConserved(world);

  assert.equal(world.toggleValve(0), true);
  for (let i = 0; i < 6000 && world.delivered < 100; i++) {
    world.advance(1 / 60);
    if (i % 60 === 59) {
      world.squeezeSponge(0);
      world.squeezeSponge(1);
    }
  }
  assert.equal(world.emitted, 208);
  assert.equal(world.valveRemaining[0], 0);
  assert.ok(world.delivered >= 100, `resumed relay delivered only ${world.delivered}`);
  assert.equal(world.collected, 7);
  assertConserved(world);
});

test("wind-sponge-relay needs both squeezing and wind, even after the tank empties", () => {
  const world = prepare(levelById("wind-sponge-relay"));
  world.toggleValve(0);
  world.toggleFan(0);
  for (let i = 0; i < 1200; i++) world.advance(1 / 60);
  assert.equal(world.emitted, 208);
  assert.equal(world.spongeContents[0].length, 128);
  assert.equal(world.delivered, 0, "wind alone must not bypass the sponge gate");
  assertConserved(world);

  world.toggleFan(0);
  for (let i = 0; i < 2400; i++) {
    world.advance(1 / 60);
    if (i % 60 === 59) world.squeezeSponge(0);
  }
  assert.ok(world.delivered < 100, "squeezing alone must not cross the high platform");
  assertConserved(world);

  world.toggleFan(0);
  for (let i = 0; i < 3600 && world.delivered < 100; i++) {
    world.advance(1 / 60);
    if (i % 60 === 59) world.squeezeSponge(0);
  }
  assert.ok(world.delivered >= 100, `combined devices delivered only ${world.delivered}`);
  assert.equal(world.collected, 7);
  assert.equal(world.dirtyDelivered, 0);
  assertConserved(world);
});
