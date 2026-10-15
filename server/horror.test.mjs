import { test } from "node:test";
import assert from "node:assert/strict";
import { levels } from "../src/game/levels.ts";
import { canEnter, modeIndices, nextLevel } from "../src/game/modes.ts";
import { hauntState } from "../src/game/horror.ts";
import { emptyProgress, parseProgress, mergeProgress } from "../src/progress.ts";
import { FluidWorld } from "../src/game/fluid.ts";

test("normal and horror have independent starts, unlocks and endings", () => {
  const normal = modeIndices("normal"), horror = modeIndices("horror"), progress = emptyProgress();
  assert.equal(normal.length, 12); assert.equal(horror.length, 3);
  assert.ok(canEnter(normal[0], progress)); assert.ok(canEnter(horror[0], progress));
  assert.equal(canEnter(horror[1], progress), false);
  assert.equal(canEnter(-1, progress), false);
  for (const index of normal) progress.levels[levels[index].id] = { completed: true, collected: 7 };
  assert.equal(canEnter(horror[1], progress), false, "clearing normal cannot unlock the second horror stage");
  progress.levels[levels[horror[0]].id] = { completed: true, collected: 3, bestScore: 2400, bestTimeMs: 13000 };
  assert.ok(canEnter(horror[1], progress)); assert.equal(canEnter(horror[2], progress), false);
  assert.equal(nextLevel(normal.at(-1)), undefined); assert.equal(nextLevel(horror.at(-1)), undefined);
  assert.equal(nextLevel(horror[0]), horror[1]);
  assert.deepEqual(parseProgress(JSON.parse(JSON.stringify(progress))), progress);
  assert.deepEqual(mergeProgress(progress, emptyProgress()), progress);
});

test("haunted movement is bounded and continuous, with slow intermittent illumination", () => {
  let min = 480, max = 0, dark = false, bright = false, last;
  for (let frame = 0; frame < 1440; frame++) {
    const state = hauntState(frame / 60);
    assert.ok(Number.isFinite(state.x) && state.x >= 65 && state.x <= 380);
    assert.ok(state.beam >= 0 && state.beam <= 1);
    if (state.running) { min = Math.min(min, state.x); max = Math.max(max, state.x); }
    if (last) {
      assert.ok(Math.abs(state.beam - last.beam) < .015, "no strobing light transitions");
      assert.ok(Math.abs(state.x - last.x) < 7, "running starts and stops without teleporting");
    }
    if (state.beam === 0) dark = true;
    if (state.beam > .9) bright = true;
    assert.deepEqual(hauntState(frame / 60), state, "a frozen game clock freezes visual state");
    last = state;
  }
  assert.ok(max - min > 290); assert.ok(dark && bright);
  for (const time of [0, 3, 7, 10, 60]) {
    const reduced = hauntState(time, true);
    assert.equal(reduced.running, false); assert.equal(reduced.x, 371);
    assert.equal(reduced.beam, .55); assert.equal(reduced.angle, 1.6);
    assert.ok(hauntState(time, true, true).laughing, "victory keeps the belly-laugh pose even with reduced motion");
  }
});

test("dark machine needs the valve and fan, and darkness never changes collision rules", () => {
  const level = levels.find(level => level.id === "dark-machine"), world = new FluidWorld(level);
  for (let i = 1; i < level.solution.length; i++) world.digLine(level.solution[i - 1], level.solution[i]);
  for (let i = 0; i < 120; i++) world.advance(1 / 60);
  assert.equal(world.emitted, 0);
  world.toggleValve(0);
  for (let i = 0; i < 1800; i++) world.advance(1 / 60);
  assert.ok(world.delivered < 100);
  world.toggleFan(0);
  for (let i = 0; i < 2400 && world.delivered < 100; i++) world.advance(1 / 60);
  assert.ok(world.delivered >= 100); assert.equal(world.collected, 7);
  assert.equal(world.dirtyDelivered, 0);
});
