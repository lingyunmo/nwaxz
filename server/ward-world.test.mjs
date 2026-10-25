import assert from 'node:assert/strict';
import test from 'node:test';
import { createInterference, advanceInterference } from '../src/escape/interference.ts';
import { CRYSTALS, EscapeWorld } from '../src/escape/world.ts';

function advanceWorld(world, seconds, step = 0.15) {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(step, remaining);
    world.advance(dt);
    remaining -= dt;
  }
}

function collectCrystal(world, id) {
  const crystal = CRYSTALS.find(item => item.id === id);
  assert.ok(crystal, `missing crystal ${id}`);
  Object.assign(world.data.player, { x: crystal.x, z: crystal.z + 1 });
  world.data.player.angle = Math.atan2(crystal.z - world.data.player.z, crystal.x - world.data.player.x);
  assert.equal(world.nearest()?.id, id, 'crystal is a normal nearby interaction target');
  world.interact();
  assert.ok(world.data.hunt.collected.includes(id), 'interact collects the crystal');
}

function wardWorld(id = 'crystal-ward-infirmary') {
  const world = new EscapeWorld(41);
  collectCrystal(world, id);
  assert.equal(world.crystalCharges('ward'), 1);
  return world;
}

function corruptB1() {
  const random = () => 0;
  return advanceInterference(createInterference(-1), 11, { active: true, random });
}

function nearGuaranteedRoll() {
  const state = createInterference(-1);
  return { ...state, stage: 'attempt', clear: 0, attempt: 29, tick: 0.99 };
}

test('ward crystals are collectible through nearest/interact and spend one finite charge', () => {
  const world = wardWorld();
  assert.equal(world.crystalCharges('ward'), 1);
  world.useCrystal('ward');
  assert.equal(world.crystalCharges('ward'), 0);
  assert.equal(world.data.hunt.ward, 60);
  assert.equal(world.data.hunt.wardUsed, 1);
  assert.match(world.message, /净化|干扰/);
  world.useCrystal('ward');
  assert.equal(world.data.hunt.wardUsed, 1, 'an unavailable charge is not consumed');
});

test('the world uses the ground profile, preserves clear-cycle proportion across floors, and keeps a ground cast at ten seconds', () => {
  const world = new EscapeWorld(41);
  assert.equal(world.data.interference.profile, 0);
  assert.equal(world.data.interference.clear, 30);
  advanceWorld(world, 0.15);
  assert.equal(world.data.interference.profile, 0);
  assert.ok(Math.abs(world.data.interference.clear - 29.85) < 1e-8);

  const groundClear = world.data.interference.clear;
  Object.assign(world.data.player, { x: 12.5, z: 40.5 });
  advanceWorld(world, 0.15);
  assert.equal(world.data.interference.profile, undefined, 'B1 returns to its legacy profile marker');
  assert.ok(Math.abs(world.data.interference.clear / 10 - (groundClear / 30 - 0.15 / 10)) < 1e-8,
    'the clear cycle keeps its fractional progress when changing floors');

  const groundCast = advanceInterference(createInterference(0), 31, { active: true, floor: 0, random: () => 0 });
  assert.equal(groundCast.stage, 'corrupt');
  assert.equal(groundCast.profile, 0);
  assert.equal(groundCast.remaining, 10);
  world.data.interference = groundCast;
  advanceWorld(world, 0.15);
  assert.equal(world.data.interference.stage, 'corrupt');
  assert.equal(world.data.interference.profile, 0);
  assert.ok(Math.abs(world.data.interference.remaining - 9.85) < 1e-8,
    'going downstairs does not lengthen or clear an already-applied ground cast');
});

test('each ward crystal location is a real one-time world pickup', () => {
  for (const id of ['crystal-ward-infirmary', 'crystal-ward-changing', 'basement-crystal-ward']) {
    const world = new EscapeWorld(41);
    collectCrystal(world, id);
    assert.equal(world.crystalCharges('ward'), 1, `${id} grants a ward charge`);
    assert.equal(world.nearest()?.id === id, false, `${id} cannot be collected twice`);
  }
});

test('using ward immediately clears existing interference and does not stack or refresh', () => {
  const world = wardWorld();
  collectCrystal(world, 'crystal-ward-changing');
  assert.equal(world.crystalCharges('ward'), 2);
  world.data.interference = corruptB1();
  assert.equal(world.data.interference.stage, 'corrupt');
  world.useCrystal('ward');
  assert.equal(world.crystalCharges('ward'), 1);
  assert.equal(world.data.interference.stage, 'clear');
  assert.equal(world.data.hunt.ward, 60);
  advanceWorld(world, 5);
  assert.ok(Math.abs(world.data.hunt.ward - 55) < 1e-8);
  world.useCrystal('ward');
  assert.ok(Math.abs(world.data.hunt.ward - 55) < 1e-8, 'an active ward cannot refresh itself');
  assert.equal(world.data.hunt.wardUsed, 1);
  assert.equal(world.crystalCharges('ward'), 1, 'an active ward leaves later charges available');
});

test('ward prevents B1 interference for sixty world seconds, including the final second', () => {
  const world = wardWorld();
  world.data.player.x = 12.5;
  world.data.player.z = 40.5;
  world.data.interference = nearGuaranteedRoll();
  world.useCrystal('ward');
  advanceWorld(world, 59.99);
  assert.ok(Math.abs(world.data.hunt.ward - 0.01) < 1e-8);
  assert.notEqual(world.data.interference.stage, 'corrupt');
  world.advance(0.02);
  assert.equal(world.data.hunt.ward, 0);
  assert.notEqual(world.data.interference.stage, 'corrupt', 'the remaining frame does not cash in pollution time accumulated during immunity');
});

test('the final .01 second of ward blocks a guaranteed roll at tick .99 inside one frame', () => {
  const world = wardWorld();
  world.data.player.x = 12.5;
  world.data.player.z = 40.5;
  world.useCrystal('ward');
  world.data.hunt.ward = 0.01;
  world.data.interference = nearGuaranteedRoll();
  world.advance(0.02);
  assert.equal(world.data.hunt.ward, 0);
  assert.equal(world.data.interference.stage, 'clear', 'the 30th attempt is blocked, discarded, then a fresh clear cycle starts');
});

test('after ward expires interference can be applied; freeze does not extend ward time', () => {
  const world = wardWorld();
  world.data.player.x = 12.5;
  world.data.player.z = 40.5;
  world.data.interference = nearGuaranteedRoll();
  world.data.hunt.freeze = 10;
  world.useCrystal('ward');
  advanceWorld(world, 60);
  assert.equal(world.data.hunt.freeze, 0);
  assert.ok(world.data.hunt.ward < 1e-8, 'freeze pauses the hunter but not the world-time ward');
  world.data.interference = nearGuaranteedRoll();
  world.advance(0.02);
  assert.equal(world.data.interference.stage, 'corrupt', 'interference can return after expiry');
});

test('capture and next night clear temporary ward while retaining collected crystals and spent charges', () => {
  const world = wardWorld();
  world.useCrystal('ward');
  world.capture();
  assert.equal(world.data.hunt.ward, 0);
  world.nextNight();
  assert.equal(world.data.hunt.ward, 0);
  assert.equal(world.crystalCharges('ward'), 0);
  assert.ok(world.data.hunt.collected.includes('crystal-ward-infirmary'));
  assert.equal(world.data.hunt.wardUsed, 1);
});

test('ward fields round-trip; malformed counts and shields without a collected charge are rejected', () => {
  const world = wardWorld();
  world.useCrystal('ward');
  const saved = world.snapshot();
  assert.deepEqual(EscapeWorld.restore(saved).snapshot(), saved);

  const oldV2 = new EscapeWorld(42).snapshot();
  delete oldV2.hunt.ward;
  delete oldV2.hunt.wardUsed;
  const restoredOld = EscapeWorld.restore(oldV2);
  assert.equal(restoredOld.data.hunt.ward, 0);
  assert.equal(restoredOld.data.hunt.wardUsed, 0);

  for (const edit of [
    d => { d.hunt.ward = 60.01; },
    d => { d.hunt.ward = -0.01; },
    d => { d.hunt.wardUsed = 1.5; },
    d => { d.hunt.wardUsed = 2; d.hunt.ward = 0; },
    d => { d.hunt.ward = 1; d.hunt.wardUsed = 0; },
    d => { d.hunt.collected.push('crystal-ward-infirmary'); },
    d => { d.interference = { stage: 'corrupt', clear: 0, attempt: 0, tick: 0, remaining: 30, clock: 0, seed: 123 }; },
  ]) {
    const invalid = structuredClone(saved);
    edit(invalid);
    assert.throws(() => EscapeWorld.restore(invalid));
  }

  const v1 = structuredClone(oldV2);
  v1.version = 1;
  assert.throws(() => EscapeWorld.restore(v1), 'the older save generation remains rejected');

  const fakeWard = structuredClone(oldV2);
  fakeWard.hunt.ward = 30;
  fakeWard.hunt.wardUsed = 1;
  assert.throws(() => EscapeWorld.restore(fakeWard), 'a shield with no collected source is rejected');
});
