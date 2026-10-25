import assert from "node:assert/strict";
import test from "node:test";
import { FROG_DIRECTIONS, frogViewDirection } from "../src/escape/facing.ts";
import { EscapeWorld } from "../src/escape/world.ts";

const pointAt = (angle, distance = 4, origin = { x: 10, z: 10 }) => ({
  x: origin.x + Math.cos(angle) * distance,
  z: origin.z + Math.sin(angle) * distance,
});
const dir = angle => frogViewDirection({ x: 10, z: 10, angle: 0 }, pointAt(angle));

test("the eight fixed compass angles map to the specified frog views", () => {
  assert.deepEqual(FROG_DIRECTIONS, ["front", "front-left", "left", "back-left", "back", "back-right", "right", "front-right"]);
  for (const [angle, expected] of [
    [0, 0], [Math.PI / 4, 1], [Math.PI / 2, 2], [3 * Math.PI / 4, 3],
    [Math.PI, 4], [-3 * Math.PI / 4, 5], [-Math.PI / 2, 6], [-Math.PI / 4, 7],
  ]) assert.equal(dir(angle), expected, `world angle ${angle} selects ${FROG_DIRECTIONS[expected]}`);
});

test("translation and shared world rotation preserve the relative view", () => {
  const hunter = { x: 10, z: 10, angle: 0.31 }, viewer = pointAt(0.31 + Math.PI * 3 / 4, 6, hunter);
  const expected = frogViewDirection(hunter, viewer);
  const shift = { x: -17.25, z: 8.5 };
  const translated = frogViewDirection({ ...hunter, x: hunter.x + shift.x, z: hunter.z + shift.z },
    { x: viewer.x + shift.x, z: viewer.z + shift.z });
  assert.equal(translated, expected);

  const rotation = -1.17, c = Math.cos(rotation), s = Math.sin(rotation);
  const rotate = p => ({ x: p.x * c - p.z * s, z: p.x * s + p.z * c });
  const rh = rotate(hunter), rv = rotate(viewer);
  assert.equal(frogViewDirection({ ...rh, angle: hunter.angle + rotation }, rv), expected);
});

test("player look angle is not part of frog view selection", () => {
  const hunter = { x: 0, z: 0, angle: 0 }, viewer = { x: 4, z: 4 };
  for (const angle of [-Math.PI, -1, 0, 1, Math.PI]) {
    assert.equal(frogViewDirection(hunter, { ...viewer, angle }), 1);
  }
});

test("the ±π seam is continuous and selects the back view", () => {
  assert.equal(dir(Math.PI - 1e-8), 4);
  assert.equal(dir(-Math.PI + 1e-8), 4);
  assert.equal(frogViewDirection({ x: 10, z: 10, angle: Math.PI - 1e-8 }, pointAt(0)), 4);
  assert.equal(frogViewDirection({ x: 10, z: 10, angle: -Math.PI + 1e-8 }, pointAt(0)), 4);
});

test("27.5 degree hysteresis retains the old zone through jitter and switches beyond the edge", () => {
  const boundary = 27.5 * Math.PI / 180;
  const below = boundary - 1e-6, above = boundary + 1e-6;
  assert.equal(frogViewDirection({ x: 10, z: 10, angle: 0 }, pointAt(below), 0), 0);
  assert.equal(frogViewDirection({ x: 10, z: 10, angle: 0 }, pointAt(above), 0), 1);
  for (const degrees of [22, 27, 26, 24, 27.4, 20]) {
    assert.equal(frogViewDirection({ x: 10, z: 10, angle: 0 }, pointAt(degrees * Math.PI / 180), 0), 0);
  }
  assert.equal(frogViewDirection({ x: 10, z: 10, angle: 0 }, pointAt(40 * Math.PI / 180), 0), 1);
  assert.equal(frogViewDirection({ x: 10, z: 10, angle: 0 }, pointAt(35 * Math.PI / 180), 1), 1,
    "once switched, the new view remains stable within its own hysteresis band");
});

test("without a previous view, the nearest 45 degree zone wins", () => {
  assert.equal(dir(22.49 * Math.PI / 180), 0);
  assert.equal(dir(22.51 * Math.PI / 180), 1);
  assert.equal(dir(-22.51 * Math.PI / 180), 7);
});

test("patrol and chase use the same forward field of view in a clear corridor", () => {
  const makeWorld = (state, x, z) => {
    const world = new EscapeWorld(42);
    world.data.elapsed = 10;
    Object.assign(world.data.player, { x, z, angle: Math.PI, light: false, crouched: false });
    Object.assign(world.data.hunter, { x: 3.5, z: 9.5, angle: 0, state });
    world.data.hunt.freeze = 0;
    return world;
  };
  for (const state of ["patrol", "chase"]) {
    assert.equal(makeWorld(state, 7.5, 9.5).seesPlayer(), true, `${state}: player in front`);
    assert.equal(makeWorld(state, 7.25, 10.9).seesPlayer(), true, `${state}: player in the side of the forward field`);
    assert.equal(makeWorld(state, 1.5, 9.5).seesPlayer(), false, `${state}: player behind`);
    const turned = makeWorld(state, 1.5, 9.5);
    turned.data.hunter.angle = Math.PI;
    assert.equal(turned.seesPlayer(), true, `${state}: hunter sees the same player after turning around`);
  }
});
