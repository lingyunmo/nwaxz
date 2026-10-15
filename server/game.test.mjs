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
      world.digLine(level.solution[i - 1], level.solution[i]);
    for (const route of level.extraSolutions ?? [])
      for (let i = 1; i < route.length; i++) world.digLine(route[i - 1], route[i]);
    if (level.plants?.length) {
      level.valves?.forEach((valve, index) => { if (valve.kind === "sewage") world.toggleValve(index); });
      for (let i = 0; i < 2400 && world.plantRemaining.some(n => n > 0); i++) world.advance(1 / 60);
      assert.ok(world.plantRemaining.every(n => n === 0), "plants must absorb the isolated sewage before opening clean water");
    }
    level.fans?.forEach((_fan, i) => { if (!world.fanOn[i]) world.toggleFan(i); });
    level.valves?.forEach((valve, i) => { if (valve.kind !== "sewage") world.toggleValve(i); });
    for (let i = 0; i < 2400 && world.delivered < 100; i++) {
      world.advance(1 / 60);
      // A player may squeeze a partially filled sponge repeatedly.
      if (i % 60 === 59) level.sponges?.forEach((_sponge, index) => world.squeezeSponge(index));
    }
    assert.ok(world.delivered >= 100, `only ${world.delivered} delivered`);
    assert.equal(world.collected, 7);
    assert.equal(world.dirtyDelivered, 0);
    assert.equal(world.particles.length + world.delivered + world.dirtyDelivered + world.storedWater + world.plantAbsorbed, world.emitted);
  });

test("wind acts only inside its zone and conserves water", () => {
  const level = levels.find(level => level.id === "fan-crossing"),
    world = new FluidWorld(level),
    off = new FluidWorld(level);
  world.dig(280, 290, 30); off.dig(280, 290, 30);
  world.particles = [{ x: 280, y: 290, oldX: 280, oldY: 290, vx: 0, vy: 0 }];
  off.particles = structuredClone(world.particles);
  assert.equal(world.toggleFan(0), true);
  assert.equal(world.toggleFan(99), false);
  world.advance(1 / 60); off.advance(1 / 60);
  assert.ok(world.particles[0].vx > off.particles[0].vx);
  assert.equal(world.particles.length, 1);
  world.particles[0].x = 440; world.particles[0].y = 220;
  world.dig(440, 220, 40);
  world.particles[0].vx = 0;
  world.advance(1 / 60);
  assert.equal(world.particles[0].vx, 0);
});

test("the raised platform requires wind to lift water out of its lower pocket", () => {
  const level = levels.find(level => level.id === "fan-crossing"), world = new FluidWorld(level);
  for (let i = 1; i < level.solution.length; i++) world.digLine(level.solution[i - 1], level.solution[i]);
  for (let i = 0; i < 2400; i++) world.advance(1 / 60);
  assert.ok(world.delivered < 100);
  world.toggleFan(0);
  for (let i = 0; i < 2400 && world.delivered < 100; i++) world.advance(1 / 60);
  assert.ok(world.delivered >= 100);
});

test("a closed valve emits nothing, can pause, and has a finite water budget", () => {
  const world = new FluidWorld(levels.find(level => level.id === "valve-timing"));
  world.advance(0.1);
  assert.equal(world.emitted, 0);
  assert.equal(world.toggleValve(0), true);
  for (let i = 0; i < 60; i++) world.advance(1 / 60);
  const emitted = world.emitted;
  assert.ok(emitted > 0 && emitted < 208);
  world.toggleValve(0);
  for (let i = 0; i < 60; i++) world.advance(1 / 60);
  assert.equal(world.emitted, emitted);
  world.toggleValve(0);
  for (let i = 0; i < 600; i++) world.advance(1 / 60);
  assert.equal(world.emitted, 208);
  assert.equal(world.valveRemaining[0], 0);
  assert.equal(world.valveOn[0], false);
  assert.equal(world.toggleValve(0), false);
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
