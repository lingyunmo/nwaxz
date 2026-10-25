import { test } from "node:test";
import assert from "node:assert/strict";
import { EscapeWorld } from "../src/escape/world.ts";

const step = (world, seconds, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) world.advance(1 / 60, input);
};

function hall(metres, { x = 3.5, z = 9.5, angle = 0 } = {}) {
  const world = new EscapeWorld(42);
  Object.assign(world.data.player, { x, z, angle, light: false });
  Object.assign(world.data.hunter, { x: x + metres / 1.5, z, angle: Math.PI, state: "patrol" });
  world.target = { x: 22.5, z: 9.5 };
  return world;
}

test("running is audible at 10 m, outside 24 m it adds no noise, and nearby crouching has a positive rate", () => {
  const runner = hall(10);
  runner.advance(1 / 60, { forward: 1, sprint: true });
  assert.equal(runner.hearing.action, "sprint");
  assert.equal(runner.hearing.audible, true);
  assert.ok(runner.hearing.rate > 0);

  const farRunner = hall(24.5);
  farRunner.advance(1 / 60, { forward: 1, sprint: true });
  assert.equal(farRunner.hearing.audible, false);
  assert.equal(farRunner.data.hunt.noise, 0);

  const croucher = hall(4);
  croucher.data.player.crouched = true;
  croucher.advance(1 / 60, { forward: 1 });
  assert.equal(croucher.hearing.action, "crouch");
  assert.ok(croucher.hearing.rate > 0);
});

test("a ten-metre run stays audible across a closed door with its range attenuated", () => {
  const world = new EscapeWorld(42);
  Object.assign(world.data.player, { x: 11.5, z: 3.5, angle: Math.PI / 2, light: false });
  Object.assign(world.data.hunter, { x: 11.5, z: 10.5, angle: Math.PI, state: "patrol" });
  world.advance(1 / 60, { forward: 1, sprint: true });
  assert.equal(world.hearing.occluded, true);
  assert.equal(world.hearing.audible, true);
  assert.ok(world.hearing.range < 24);
  assert.ok(world.hearing.rate > 0);
});

test("an audible footstep investigates probabilistically without exposing the player", () => {
  const heard = hall(10);
  heard.random = () => Math.min(0.75, heard.hearing.rate / 48) - 0.001;
  heard.advance(1 / 60, { forward: 1, sprint: true });
  assert.equal(heard.data.hunter.state, "investigate");
  assert.equal(heard.data.hunt.focus, "noise");
  assert.ok(Math.abs(heard.target.x - 3.5) < 0.1, "the frog investigates the last heard position");
  assert.notEqual(heard.data.hunter.state, "chase");

  const missed = hall(10);
  missed.random = () => Math.min(0.75, missed.hearing.rate / 48) + 0.001;
  missed.advance(1 / 60, { forward: 1, sprint: true });
  assert.equal(missed.data.hunter.state, "patrol");
});

test("glass noise identifies its source and the investigating frog moves toward it", () => {
  const world = new EscapeWorld(23);
  Object.assign(world.data.player, { x: 7.05, z: 9.5, angle: 0, light: false });
  Object.assign(world.data.hunter, { x: 7.5, z: 8.5, angle: 0, state: "patrol" });
  const source = { x: 7.5, z: 9.5 };
  const initialDistance = Math.hypot(world.data.hunter.x - source.x, world.data.hunter.z - source.z);
  for (let i = 0; i < 30 && !world.message.includes("碎玻璃"); i++)
    world.advance(1 / 60, { forward: 1 });
  assert.match(world.message, /碎玻璃/);
  assert.equal(world.data.hunter.state, "investigate");
  assert.equal(world.data.hunt.focus, "noise");
  assert.deepEqual(world.target, source);
  assert.ok(world.data.hunt.noise > 0 && world.data.hunt.noise < 45, "the sound is heard without directly triggering a chase");
  step(world, 1);
  const currentDistance = Math.hypot(world.data.hunter.x - source.x, world.data.hunter.z - source.z);
  assert.ok(currentDistance < initialDistance, "the hunter physically approaches the sound source");
});
