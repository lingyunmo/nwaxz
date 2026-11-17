import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Vector3 } from '@babylonjs/core/Maths/math.js';
import { EscapeWorld, SIZE } from '../src/escape/world.ts';
import { floorAt, floorYAt } from '../src/escape/basement-map.ts';
import { createInterference, advanceInterference, displayPerception } from '../src/escape/interference.ts';
import { upstairsAt } from '../src/escape/upstairs-map.ts';
import { createEscapeScene, aimCamera, CELL } from '../src/escape/scene.ts';
import { mapWindow, visibleTiles } from '../src/escape/minimap.ts';

const frames = (world, seconds, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) world.advance(1 / 60, input);
};
function walkTo(world, target) {
  for (let i = 0; i < 3000 && Math.hypot(world.data.player.x - target.x, world.data.player.z - target.z) > .07; i++) {
    const next = world.route(world.data.player, target).find(p => Math.hypot(p.x - world.data.player.x, p.z - world.data.player.z) > .07) ?? target;
    const distance = Math.hypot(next.x - world.data.player.x, next.z - world.data.player.z);
    world.data.player.angle = Math.atan2(next.z - world.data.player.z, next.x - world.data.player.x);
    world.advance(1 / 60, { forward: Math.min(1, distance / (1.7 / 60)) });
  }
  assert.ok(Math.hypot(world.data.player.x - target.x, world.data.player.z - target.z) < .1, 'ordinary collision-aware movement reaches the destination');
}

test('the infirmary stairs physically connect both floors and the window remains a solid boundary', () => {
  const world = new EscapeWorld(42);
  Object.assign(world.data.player, { x: 22.5, z: 5.5, light: false });
  Object.assign(world.data.hunter, { x: 12.5, z: 40.5 });
  assert.ok(world.route(world.data.player, { x: 35.5, z: 5.5 }).length);
  walkTo(world, { x: 35.5, z: 5.5 });
  assert.equal(floorAt(world.data.player), 1);
  assert.equal(floorYAt(world.data.player), 4.8);
  assert.match(world.room, /二楼.*晴窗/);
  assert.equal(floorYAt({ x: 24, z: 4.5 }), 0);
  assert.equal(floorYAt({ x: 26, z: 4.5 }), 2.4);
  assert.equal(floorYAt({ x: 28, z: 4.5 }), 4.8);
  Object.assign(world.data.player, { x: 36.5, z: 3.6, angle: 0 });
  frames(world, 1, { forward: 1 });
  assert.ok(world.data.player.x < 36.83, 'the player cannot walk out through a window');
  walkTo(world, { x: 22.5, z: 5.5 });
  assert.equal(floorAt(world.data.player), 0);
  assert.equal(floorYAt(world.data.player), 0);
});

test('the safe floor clears chase exposure and an existing curse, including while the hunter is frozen', () => {
  const world = new EscapeWorld(42);
  Object.assign(world.data.player, { x: 24.2, z: 4.5, angle: 0 });
  Object.assign(world.data.hunter, { x: 22.5, z: 4.5, state: 'chase' });
  Object.assign(world.data.hunt, { noise: 80, sight: 100, glare: 80, exposure: 100, alert: 6, freeze: 8, freezeUsed: 1, collected: ['crystal-bed'] });
  world.data.interference = { profile: 0, stage: 'corrupt', clear: 0, attempt: 0, tick: 0, remaining: 10, clock: 0, seed: 42 };
  assert.equal(world.perception.total, 0, 'the HUD is immediately safe at the boundary');
  frames(world, .1);
  assert.equal(world.isPlayerChased, false);
  assert.equal(world.hearing.rate, 0);
  assert.equal(world.vision.rate, 0);
  assert.equal(world.lightPerception.rate, 0);
  assert.deepEqual([world.data.hunt.noise, world.data.hunt.sight, world.data.hunt.glare, world.data.hunt.alert], [0, 0, 0, 0]);
  assert.equal(world.data.interference.stage, 'clear');
  assert.equal(displayPerception(world.perception, world.data.interference).total, 0);
  world.capture(); assert.equal(world.data.phase, 'playing');
  const restored = EscapeWorld.restore(world.snapshot());
  assert.equal(restored.inSafeRoom, true);
  assert.equal(restored.perception.total, 0);
});

test('running, torchlight, stones and long waits upstairs cannot lure the hunter or corrupt exposure', () => {
  const world = new EscapeWorld(202);
  Object.assign(world.data.player, { x: 34.5, z: 5.5, angle: 0 });
  Object.assign(world.data.hunter, { x: 22.5, z: 5.5, angle: 0, state: 'chase' });
  world.target = { x: 35.5, z: 5.5 };
  assert.ok(world.route(world.data.hunter, world.data.player, true).every(point => !upstairsAt(point)), 'a chase route can approach the entrance but cannot enter the safe floor');
  for (let i = 0; i < 1200; i++) {
    world.advance(.1, i < 10 ? { forward: 1, sprint: true } : {});
    assert.equal(upstairsAt(world.data.hunter), false);
    assert.equal(world.perception.total, 0);
    assert.equal(world.data.interference.stage, 'clear');
  }
  const before = { ...world.target };
  world.throwStone(); world.noise(world.data.player, 1000, 100);
  assert.deepEqual(world.target, before);
  assert.equal(world.data.captures, 0);
  assert.equal(world.data.abilities.enabled, false);
  Object.assign(world.data.player, { x: 22.5, z: 5.5, angle: Math.PI });
  Object.assign(world.data.hunter, { x: 20.5, z: 5.5, angle: 0, state: 'patrol' });
  assert.equal(world.seesPlayer(), true);
  frames(world, 1 / 60);
  assert.ok(world.data.hunt.sight > 0, 'normal perception resumes downstairs');
});

test('co-op authority ignores upstairs pursuit cues while still chasing a downstairs teammate', () => {
  const world = new EscapeWorld(42);
  const safe = { id: 'resting', player: { ...world.data.player, x: 24.1, z: 4.5 }, exposure: 100, currentExposure: 100, focus: 'sight', living: true };
  safe.currentCues = { sight: safe.player };
  Object.assign(world.data.hunter, { x: 23.7, z: 4.5, state: 'chase' });
  assert.deepEqual(world.advanceEnemyAuthoritative(.05, [safe]), [], 'even proximity to the stair boundary cannot capture a safe player');
  Object.assign(world.data.hunter, { x: 12.5, z: 9.5, state: 'patrol' });
  const ground = { ...safe, id: 'exploring', player: { ...safe.player, x: 11.5, z: 9.5 } };
  ground.currentCues = { sight: ground.player };
  world.advanceEnemyAuthoritative(.05, [safe, ground]);
  assert.deepEqual(world.data.player, ground.player, 'the selected pursuit subject is the downstairs teammate');
  assert.equal(upstairsAt(world.target), false);
});

test('old 25-column saves retain explored cells, patrol memory and inventory after map expansion', () => {
  const world = new EscapeWorld(42);
  world.data.explored.push(40 * SIZE + 12);
  world.data.inventory.push('brass'); world.data.searched.push('bed-drawer');
  const legacy = world.snapshot();
  delete legacy.mapWidth;
  legacy.explored = legacy.explored.map(index => Math.floor(index / SIZE) * 25 + index % SIZE);
  legacy.hunt.recent = legacy.hunt.recent.map(index => Math.floor(index / SIZE) * 25 + index % SIZE);
  const restored = EscapeWorld.restore(legacy);
  assert.deepEqual(restored.data.explored, world.data.explored);
  assert.deepEqual(restored.data.hunt.recent, world.data.hunt.recent);
  assert.deepEqual(restored.data.inventory, legacy.inventory);
  assert.equal(restored.data.mapWidth, SIZE);
  assert.deepEqual(EscapeWorld.restore(restored.snapshot()).snapshot(), restored.snapshot());
  const illegal = restored.snapshot(); Object.assign(illegal.hunter, { x: 34.5, z: 5.5 });
  assert.throws(() => EscapeWorld.restore(illegal), /位置/);
});

test('the upstairs map keeps exploration fog and does not leak rooms into either lower floor', () => {
  const world = new EscapeWorld(42);
  Object.assign(world.data.player, { x: 34.5, z: 5.5 }); world.revealMap();
  assert.deepEqual(mapWindow(world.data.player), { x: 22, z: 0, columns: 17, rows: 12 });
  const tiles = visibleTiles(world);
  assert.equal(tiles.find(tile => tile.x === 34 && tile.z === 5).reveal, 'explored');
  assert.equal(tiles.find(tile => tile.x === 22 && tile.z === 1).reveal, 'fog');
  assert.equal(visibleTiles(world, false, 0).find(tile => tile.x === 24 && tile.z === 4).terrain, 'outside');
  assert.equal(visibleTiles(world, false, -1).some(tile => tile.terrain === 'floor' && upstairsAt(tile)), false);
});

test('the second floor suppresses both new interference attempts and already active corruption', () => {
  const state = advanceInterference(createInterference(0), 100, { active: true, suspended: false, floor: 1, random: () => 0 });
  assert.deepEqual(state, createInterference(0));
});

test('upstairs geometry has open windows, lower lawn, warm furniture and animated outdoor neighbours', () => {
  const engine = new NullEngine(), view = createEscapeScene(engine);
  try {
    const walls = view.scene.getMeshByName('upstairs-wall-surfaces');
    const window = new Ray(new Vector3(36 * CELL, 4.8 + 1.5, 3.2 * CELL), new Vector3(1, 0, 0), 3);
    assert.equal(window.intersectsMesh(walls).hit, false, 'the window is a real opening in the wall');
    const belowSill = new Ray(new Vector3(36 * CELL, 4.8 + .4, 3.2 * CELL), new Vector3(1, 0, 0), 3);
    assert.equal(belowSill.intersectsMesh(walls).hit, true, 'wall geometry remains below the window');
    assert.ok(view.scene.getMeshByName('upstairs-sofa-seat'));
    assert.ok(view.scene.getMeshByName('upstairs-woven-rug'));
    assert.ok(view.scene.getMeshByName('upstairs-teapot'));
    assert.ok(view.scene.getMeshByName('upstairs-plant-pot'));
    assert.ok(view.scene.getMeshByName('upstairs-garden-lawn').position.y < 4.8);
    assert.equal(view.scene.getLightByName('upstairs-daylight').includedOnlyMeshes.includes(view.scene.getMeshByName('solid-tile-walls')), false);
    const npc = view.scene.getTransformNodeByName('upstairs-garden-npc:0');
    const before = npc.position.clone(); view.upstairs.animate(4);
    assert.notDeepEqual(npc.position, before);
    view.upstairs.animate(5, true); const reduced = npc.position.clone(); view.upstairs.animate(6, true);
    assert.deepEqual(npc.position, reduced, 'reduced-motion setting stops outdoor walking');
    const world = new EscapeWorld(42); Object.assign(world.data.player, { x: 34.5, z: 5.5 });
    aimCamera(view, world, 1.65); assert.ok(Math.abs(view.camera.position.y - 6.45) < 1e-5);
  } finally { view.scene.dispose(); engine.dispose(); }
});
