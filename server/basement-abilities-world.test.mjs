import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceAbilities, createAbilities } from '../src/escape/abilities.ts';
import { DOORS, EscapeWorld, HEIGHT, PROPS, SIZE } from '../src/escape/world.ts';
import { floorAt, stairsAt } from '../src/escape/basement-map.ts';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function basementWorld(at = { x: 12.5, z: 40.5 }, seed = 1) {
  const world = new EscapeWorld(seed);
  Object.assign(world.data.player, at);
  return world;
}

function advanceWorld(world, seconds, step = 0.15) {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(step, remaining);
    world.advance(dt);
    remaining -= dt;
  }
}

function validWarning(kind = 'sense') {
  const abilities = createAbilities();
  Object.assign(abilities, {
    enabled: true,
    stage: 'warning',
    selected: kind,
    rest: 0,
    attempt: 1,
    warning: 3,
    notice: { kind: `${kind}-warning`, remaining: 3, duration: 3 },
  });
  return abilities;
}

function validCooldown(kind = 'teleport') {
  const abilities = createAbilities();
  Object.assign(abilities, {
    enabled: true, stage: 'cooldown', selected: kind, rest: 0,
    cooldowns: { sense: 20, teleport: 30 },
  });
  return abilities;
}

function validResultNotice() {
  const abilities = createAbilities();
  Object.assign(abilities, {
    enabled: true, stage: 'rest', rest: 21.5,
    notice: { kind: 'evaded', remaining: 1.2, duration: 2.4 },
  });
  return abilities;
}

function rawForFirstRandom(predicate) {
  for (let seed = 0; seed < 100_000; seed++) {
    let x = (seed + 0x9e3779b9) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    x ^= x >>> 15;
    const value = (x >>> 0) / 0x100000000;
    if (predicate(value)) return { seed, value };
  }
  assert.fail('could not find deterministic RNG seed');
}

function legalLanding(world, at, origin) {
  return floorAt(at) === -1
    && !stairsAt(at)
    && at.x >= 1.5 && at.x <= SIZE - 1.5
    && at.z >= 28.5 && at.z <= HEIGHT - 1.5
    && world.wall(at.x, at.z, true) === 0
    && world.furniture(at.x, at.z, 0.7) === false
    && !DOORS.some(door => Math.floor(at.x) === door.x && Math.floor(at.z) === door.z)
    && distance(at, origin) >= 3 && distance(at, origin) <= 12;
}

function assertCandidatesAreSafe(world) {
  const origin = { ...world.data.player };
  const candidates = world.teleportCandidates();
  for (const candidate of candidates) {
    assert.ok(legalLanding(world, candidate, origin), `illegal landing ${JSON.stringify(candidate)} from ${JSON.stringify(origin)}`);
    assert.ok(Number.isFinite(candidate.weight) && candidate.weight > 0 && candidate.weight <= 1);
  }
  const candidateKeys = new Set(candidates.map(({ x, z }) => `${x},${z}`));
  for (let z = 27; z <= 53; z++) for (let x = 0; x < SIZE; x++) {
    const at = { x: x + 0.5, z: z + 0.5 };
    if (distance(at, origin) < 3 || distance(at, origin) > 12) continue;
    if (!legalLanding(world, at, origin)) assert.equal(candidateKeys.has(`${at.x},${at.z}`), false,
      `blocked cell entered pool: ${JSON.stringify(at)}`);
  }
  return candidates;
}

test('teleport candidate pools omit walls, furniture, doors, map edges, stairs, and too-close/far cells', () => {
  for (const origin of [
    { x: 12.5, z: 40.5 },
    { x: 3.5, z: 39.5 },
    { x: 2.5, z: 48.5 },
    { x: 4.5, z: 31.5 },
  ]) {
    const world = basementWorld(origin);
    assert.ok(assertCandidatesAreSafe(world).length > 0, `no valid candidates from ${JSON.stringify(origin)}`);
  }
  const stairs = basementWorld({ x: 4.5, z: 28.5 });
  assert.deepEqual(stairs.teleportCandidates(), [], 'the stair landing itself cannot start a cast');
});

test('a player starting inside a basement wardrobe can still reach the legal loop', () => {
  const closet = PROPS.find(prop => prop.id === 'basement-wardrobe-storage');
  assert.ok(closet);
  const world = basementWorld({ x: closet.x, z: closet.z });
  assert.equal(world.furniture(world.data.player.x, world.data.player.z, 0.7), true);
  const candidates = assertCandidatesAreSafe(world);
  assert.ok(candidates.length > 0, 'the breadth-first candidate search escapes the blocked closet cell');
});

test('sense exposes 100 points, starts chase, and remembers the cabinet occupied at cast time', () => {
  const closet = PROPS.find(prop => prop.id === 'basement-wardrobe-storage');
  const world = basementWorld({ x: closet.x, z: closet.z + 0.08 });
  world.data.hidden = closet.id;
  world.data.hunt.sight = 0;
  assert.equal(world.executeAbility('sense'), true);
  assert.equal(world.data.hunt.sight, 100);
  assert.equal(world.data.hunt.traces.sight.x, closet.x);
  assert.equal(world.data.hunt.traces.sight.z, closet.z + 0.08);
  assert.equal(world.data.hunt.focus, 'sight');
  assert.equal(world.data.hunter.state, 'chase');
  assert.equal(world.perception.total, 100);
  assert.equal(world.seenHide, closet.id);
});

test('a missed scheduled sense never invokes the player-targeting chase effect', () => {
  const world = basementWorld({ x: 12.5, z: 40.5 });
  world.data.player.light = false;
  world.data.hunt.sight = 0;
  world.data.hunter.state = 'patrol';
  world.data.abilities = validWarning('sense');
  world.data.hunt.rng = rawForFirstRandom(value => value > 0.2).seed;
  const targetBefore = { ...world.target };
  advanceWorld(world, 3);
  assert.equal(world.data.abilities.notice.kind, 'evaded');
  assert.equal(world.data.hunt.sight, 0);
  assert.equal(world.data.hunter.state, 'patrol');
  assert.deepEqual(world.target, targetBefore);
});

test('real world.advance starts warnings, persists their exact remainder, and resumes deterministically', () => {
  const world = basementWorld({ x: 12.5, z: 40.5 });
  world.data.hunt.rng = rawForFirstRandom(value => value < 1 / 30).seed;
  const abilities = createAbilities();
  Object.assign(abilities, { enabled: true, stage: 'attempt', selected: 'sense', rest: 0, attempt: 0, tick: 0.9 });
  world.data.abilities = abilities;

  world.advance(0.1);
  assert.equal(world.data.abilities.stage, 'warning');
  assert.equal(world.data.abilities.warning, 3);
  assert.equal(world.data.abilities.notice.kind, 'sense-warning');
  advanceWorld(world, 1.25);
  assert.ok(Math.abs(world.data.abilities.warning - 1.75) < 1e-9);
  assert.equal(world.data.abilities.notice.remaining, world.data.abilities.warning);

  const snapshot = world.snapshot();
  const restored = EscapeWorld.restore(snapshot);
  assert.equal(restored.data.abilities.warning, world.data.abilities.warning);
  assert.equal(restored.data.abilities.notice.remaining, world.data.abilities.notice.remaining);
  advanceWorld(world, 1.75);
  advanceWorld(restored, 1.75);
  assert.deepEqual(restored.snapshot(), world.snapshot());
});

test('floor departure cancels a warning and freeze pauses warning, cooldown, rest, and notice timers', () => {
  const leaving = basementWorld({ x: 12.5, z: 40.5 });
  leaving.data.abilities = validWarning('teleport');
  Object.assign(leaving.data.player, { x: 4.5, z: 23.5 });
  leaving.advance(0.5);
  assert.equal(leaving.data.abilities.enabled, true);
  assert.equal(leaving.data.abilities.stage, 'rest');
  assert.equal(leaving.data.abilities.rest, 30);
  assert.equal(leaving.data.abilities.selected, undefined);
  assert.equal(leaving.data.abilities.notice, undefined);

  for (const abilities of [validCooldown('teleport'), validResultNotice()]) {
    const outside = basementWorld({ x: 4.5, z: 23.5 });
    outside.data.abilities = abilities;
    const before = structuredClone(outside.data.abilities);
    advanceWorld(outside, 3);
    assert.deepEqual(outside.data.abilities, before, 'round, cooldown, and result notice pause outside B1');
  }

  for (const abilities of [validWarning('sense'), validCooldown('teleport'), validResultNotice()]) {
    const frozen = basementWorld({ x: 12.5, z: 40.5 });
    frozen.data.abilities = abilities;
    frozen.data.hunt.freeze = 2;
    frozen.data.hunt.freezeUsed = 1;
    frozen.data.hunt.collected.push('basement-crystal-freeze');
    const before = structuredClone(frozen.data.abilities);
    advanceWorld(frozen, 0.5);
    assert.deepEqual(frozen.data.abilities, before, 'freeze pauses every ability clock');
  }
});

test('weighted teleport landings vary by seed and are never a fixed or face-hugging distance', () => {
  const origin = { x: 12.5, z: 40.5 };
  const distances = new Set();
  for (let seed = 1; seed <= 160; seed++) {
    const world = basementWorld(origin, seed);
    world.data.hunt.rng = seed;
    assert.equal(world.executeAbility('teleport'), true);
    const landing = { x: world.data.hunter.x, z: world.data.hunter.z };
    assert.ok(legalLanding(world, landing, origin), `illegal teleport for seed ${seed}`);
    assert.ok(distance(landing, origin) >= 3, 'teleport must not place the hunter face-to-face');
    assert.equal(world.data.hunter.state, 'investigate');
    assert.deepEqual(world.target, landing, 'the cast investigates the landing and waits for ordinary sensing');
    distances.add(distance(landing, origin).toFixed(3));
  }
  assert.ok(distances.size >= 8, `weighted sampling varied across only ${distances.size} distances`);
});

test('restore rejects v1, missing v2 systems, forged ability timers, and inconsistent basement objectives', () => {
  const snapshot = new EscapeWorld(27).snapshot();
  for (const mutate of [
    raw => { raw.version = 1; },
    raw => { delete raw.basement; },
    raw => { delete raw.abilities; },
    raw => { delete raw.expansion; },
    raw => { delete raw.hunt; },
    raw => { raw.abilities.cooldowns.sense = 36; },
    raw => { raw.abilities.notice = { kind: 'sense-warning', remaining: 3, duration: 3 }; },
    raw => { raw.basement.power = true; },
    raw => { raw.basement.sluice = true; },
    raw => { raw.phase = 'won'; },
    raw => { raw.expansion.valves = ['valve-return']; },
  ]) {
    const invalid = structuredClone(snapshot);
    mutate(invalid);
    assert.throws(() => EscapeWorld.restore(invalid), /逃生存档/);
  }
  assert.deepEqual(EscapeWorld.restore(snapshot).snapshot(), snapshot);
});
