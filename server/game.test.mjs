import { test } from "node:test";
import assert from "node:assert/strict";
import { FluidWorld, COLS, CELL } from "../src/game/fluid.ts";
import { levels } from "../src/game/levels.ts";
import {
  emptyProgress,
  mergeProgress,
  parseProgress,
} from "../src/progress.ts";
for (const level of levels)
  test(`${level.id}: a continuous legal route delivers 100 drops and collects all coins`, () => {
    const world = new FluidWorld(level);
    for (let i = 1; i < level.solution.length; i++)
      world.digLine(level.solution[i - 1], level.solution[i], 29);
    for (let i = 0; i < 2400 && world.delivered < 100; i++)
      world.advance(1 / 60);
    assert.ok(world.delivered >= 100, `only ${world.delivered} delivered`);
    assert.equal(world.collected, 7);
    assert.equal(world.particles.length + world.delivered, 208);
  });
test("an unopened tank conserves water, and long suspended frames stay finite", () => {
  const world = new FluidWorld(levels[0]);
  for (let i = 0; i < 180; i++) world.advance(1 / 60);
  world.advance(100);
  assert.equal(world.delivered, 0);
  assert.equal(world.particles.length, 208);
  for (const p of world.particles)
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});
test("rocks are immutable while the visual dirt grid changes", () => {
  const world = new FluidWorld(levels[1]),
    i = Math.floor(350 / CELL) * COLS + Math.floor(200 / CELL);
  world.dig(200, 350, 50);
  assert.equal(world.stone[i], 1);
  assert.equal(world.dirt[i], 1);
  assert.equal(world.dig(200, 260), true);
});
test("save merge converges across devices and rejects poisoned records", () => {
  const a = {
    version: 1,
    levels: { "first-bath": { completed: true, collected: 1 } },
  };
  const b = {
    version: 1,
    levels: { "first-bath": { completed: false, collected: 2 } },
  };
  assert.deepEqual(mergeProgress(a, b), mergeProgress(b, a));
  assert.deepEqual(mergeProgress(a, a), a);
  assert.deepEqual(mergeProgress(a, emptyProgress()), a);
  assert.throws(() =>
    parseProgress(
      JSON.parse(
        '{"version":1,"levels":{"__proto__":{"completed":true,"collected":7}}}',
      ),
    ),
  );
});
