import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceAbilities, createAbilities, isAbilityState } from '../src/escape/abilities.ts';

function environment(options = {}) {
  return {
    active: options.active ?? true,
    suspended: options.suspended ?? false,
    moving: options.moving ?? false,
    random: options.random ?? (() => 0.99),
    execute: options.execute ?? (() => true),
  };
}

function sequence(values, fallback = 0.99) {
  let index = 0;
  const random = () => values[index++] ?? fallback;
  random.count = () => index;
  return random;
}

function warningState(kind = 'sense') {
  let state = createAbilities();
  const selection = kind === 'sense' ? 0 : 0.75;
  state = advanceAbilities(state, 30, environment({ random: sequence([selection]) }));
  assert.equal(state.stage, 'attempt');
  state = advanceAbilities(state, 1, environment({ random: sequence([0]) }));
  assert.equal(state.stage, 'warning');
  assert.equal(state.selected, kind);
  return state;
}

function seeded(seed) {
  let value = seed >>> 0;
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
  random.save = () => value;
  random.load = saved => { value = saved >>> 0; };
  return random;
}

test('default state is valid and strict validation rejects unknown or malformed fields', () => {
  const state = createAbilities();
  assert.deepEqual(state, {
    enabled: false, stage: 'rest', rest: 30, attempt: 0, warning: 0,
    cooldowns: { sense: 0, teleport: 0 }, moving: false, scanChance: 0.2, tick: 0, motionMemory: 0,
  });
  assert.equal(isAbilityState(state), true);
  assert.equal(isAbilityState({ ...state, extra: true }), false);
  assert.equal(isAbilityState({ ...state, rest: Number.NaN }), false);
  assert.equal(isAbilityState({ ...state, attempt: 1.5 }), false);
  assert.equal(isAbilityState({ ...state, cooldowns: { ...state.cooldowns, teleport: -1 } }), false);
  assert.equal(isAbilityState({ ...state, notice: { kind: 'sense-warning', remaining: 3, duration: 3 } }), false);
});

test('attempt rolls once per whole second and the thirtieth second always starts a warning', () => {
  const draws = sequence([0, ...Array(29).fill(0.999)]);
  let state = advanceAbilities(createAbilities(), 30, environment({ random: draws }));
  assert.equal(state.stage, 'attempt');
  state = advanceAbilities(state, 29, environment({ random: draws }));
  assert.equal(state.stage, 'attempt');
  assert.equal(state.attempt, 29);
  assert.equal(draws.count(), 30, 'one selection draw and 29 independent attempts');
  state = advanceAbilities(state, 1, environment({ random: draws }));
  assert.equal(state.stage, 'warning');
  assert.equal(state.attempt, 30);
  assert.equal(state.warning, 3);
  assert.deepEqual(state.notice, { kind: 'sense-warning', remaining: 3, duration: 3 });
  assert.equal(draws.count(), 30, 'the guaranteed thirtieth attempt needs no random draw');
  assert.equal(isAbilityState(state), true);
});

test('warning lasts exactly three model seconds and sense executes only on a hit', () => {
  let calls = 0;
  let state = warningState();
  state = advanceAbilities(state, 1.25, environment({ random: sequence([]), execute: () => { calls++; return true; } }));
  assert.equal(state.stage, 'warning');
  assert.equal(state.warning, 1.75);
  assert.equal(state.notice.remaining, state.warning);
  assert.equal(calls, 0);
  state = advanceAbilities(state, 1.75, environment({ random: sequence([0.1]), execute: () => { calls++; return true; } }));
  assert.equal(state.stage, 'rest');
  assert.equal(state.notice.kind, 'exposed');
  assert.equal(state.notice.remaining, 2.4);
  assert.equal(state.cooldowns.sense, 35);
  assert.equal(calls, 1);

  let missed = warningState();
  calls = 0;
  missed = advanceAbilities(missed, 3, environment({ random: sequence([0.99]), execute: () => { calls++; return true; } }));
  assert.equal(missed.notice.kind, 'evaded');
  assert.equal(calls, 0);
});

test('a selected skill waits for its cooldown instead of choosing the other skill', () => {
  let state = warningState('sense');
  state = advanceAbilities(state, 3, environment({ random: sequence([0]), execute: () => true }));
  assert.equal(state.notice.kind, 'exposed');
  const selectSense = sequence([0]);
  state = advanceAbilities(state, 30, environment({ random: selectSense }));
  assert.equal(state.stage, 'cooldown');
  assert.equal(state.selected, 'sense');
  assert.equal(state.cooldowns.sense, 5);
  assert.equal(state.cooldowns.teleport, 0);
  assert.equal(state.rest, 0);
  state = advanceAbilities(state, 4.9, environment({ random: sequence([]) }));
  assert.equal(state.stage, 'cooldown');
  assert.ok(Math.abs(state.cooldowns.sense - 0.1) < 1e-9);
  state = advanceAbilities(state, 0.1, environment({ random: sequence([]) }));
  assert.equal(state.stage, 'attempt');
  assert.equal(state.selected, 'sense');
  assert.equal(state.cooldowns.sense, 0);
  assert.equal(isAbilityState(state), true);
});

test('teleport callback reports success or failure and either result starts its cooldown', () => {
  for (const [success, expected] of [[true, 'teleported'], [false, 'teleport-failed']]) {
    let calls = 0;
    const state = advanceAbilities(warningState('teleport'), 3, environment({
      random: sequence([]), execute: kind => { calls++; assert.equal(kind, 'teleport'); return success; },
    }));
    assert.equal(calls, 1);
    assert.equal(state.notice.kind, expected);
    assert.equal(state.notice.duration, 2.4);
    assert.equal(state.cooldowns.teleport, 45);
    assert.equal(state.cooldowns.sense, 0);
  }
});

test('sense chance is 20% while still and 80% if there was movement in the last 0.4 seconds', () => {
  const staticHit = advanceAbilities(warningState(), 3, environment({ random: sequence([0.199]), moving: false }));
  const staticEdgeMiss = advanceAbilities(warningState(), 3, environment({ random: sequence([0.2]), moving: false }));
  const movingHit = advanceAbilities(warningState(), 3, environment({ random: sequence([0.799]), moving: true }));
  const movingEdgeMiss = advanceAbilities(warningState(), 3, environment({ random: sequence([0.8]), moving: true }));
  assert.equal(staticHit.notice.kind, 'exposed');
  assert.equal(staticEdgeMiss.notice.kind, 'evaded');
  assert.equal(movingHit.notice.kind, 'exposed');
  assert.equal(movingEdgeMiss.notice.kind, 'evaded');

  let recentMove = advanceAbilities(warningState(), 2.7, environment({ moving: true, random: sequence([]) }));
  recentMove = advanceAbilities(recentMove, 0.3, environment({ moving: false, random: sequence([]) }));
  assert.equal(recentMove.scanChance, 0.8);
  let staleMove = advanceAbilities(warningState(), 2.59, environment({ moving: true, random: sequence([]) }));
  staleMove = advanceAbilities(staleMove, 0.41, environment({ moving: false, random: sequence([]) }));
  assert.equal(staleMove.scanChance, 0.2);
});

test('deterministic sample frequencies track the 20% and 80% chances', () => {
  let staticHits = 0;
  let movingHits = 0;
  for (let i = 0; i < 1000; i++) {
    const roll = (i + 0.5) / 1000;
    if (advanceAbilities(warningState(), 3, environment({ moving: false, random: sequence([roll]) })).notice.kind === 'exposed') staticHits++;
    if (advanceAbilities(warningState(), 3, environment({ moving: true, random: sequence([roll]) })).notice.kind === 'exposed') movingHits++;
  }
  assert.equal(staticHits, 200);
  assert.equal(movingHits, 800);
});

test('freeze pauses every timer; leaving the basement pauses rounds and cancels a live warning', () => {
  let warning = warningState();
  assert.deepEqual(advanceAbilities(warning, 10, environment({ suspended: true })), warning);
  const canceled = advanceAbilities(warning, 10, environment({ active: false }));
  assert.equal(canceled.stage, 'rest');
  assert.equal(canceled.rest, 30);
  assert.equal(canceled.selected, undefined);
  assert.equal(canceled.notice, undefined);

  let cooldown = advanceAbilities(warningState('teleport'), 3, environment({ execute: () => true }));
  cooldown = advanceAbilities(cooldown, 5, environment());
  const paused = advanceAbilities(cooldown, 300, environment({ active: false }));
  assert.deepEqual(paused, cooldown);
  assert.equal(paused.cooldowns.teleport, 40);
  assert.equal(paused.rest, 25);
});

test('saving the ability state and its caller-owned RNG resumes the same future', () => {
  const random = seeded(412);
  let state = advanceAbilities(createAbilities(), 37.4, environment({ random }));
  const savedState = JSON.parse(JSON.stringify(state));
  const savedRandom = random.save();
  const finish = () => {
    let current = state;
    for (let i = 0; i < 30; i++) current = advanceAbilities(current, 2, environment({ random }));
    return current;
  };
  const uninterrupted = finish();
  state = savedState;
  random.load(savedRandom);
  const restored = finish();
  assert.equal(isAbilityState(savedState), true);
  assert.deepEqual(restored, uninterrupted);
});

test('different frame time steps produce the same phase, callbacks, timers, and random stream', () => {
  const makeRun = steps => {
    let state = createAbilities();
    const random = sequence([0, 0, 0]);
    const calls = [];
    let elapsed = 0;
    let index = 0;
    while (elapsed < 34 - 1e-9) {
      const dt = Math.min(steps[index++ % steps.length], 34 - elapsed);
      state = advanceAbilities(state, dt, environment({ random, execute: kind => { calls.push(kind); return true; } }));
      elapsed += dt;
    }
    return { state, calls, rng: random.count() };
  };
  const large = makeRun([34]);
  const frames = makeRun(Array(60).fill(1 / 60));
  assert.deepEqual(frames, large);
  assert.deepEqual(large.calls, ['sense']);
});
