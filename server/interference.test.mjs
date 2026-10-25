import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceInterference,
  createInterference,
  displayPerception,
  isInterferenceState,
} from '../src/escape/interference.ts';
import { combinePerception } from '../src/escape/perception.ts';

function environment(options = {}) {
  return {
    active: options.active ?? true,
    suspended: options.suspended ?? false,
    random: options.random ?? (() => 0.99),
  };
}

function sequence(values, fallback = 0.99) {
  let index = 0;
  const random = () => values[index++] ?? fallback;
  random.count = () => index;
  return random;
}

function attemptState(random = sequence([])) {
  return advanceInterference(createInterference(), 10, environment({ random }));
}

function corruptionState(seedRoll = 0.25) {
  const random = sequence([0, seedRoll]);
  const state = advanceInterference(createInterference(), 11, environment({ random }));
  assert.equal(state.stage, 'corrupt');
  return { state, random };
}

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''}: ${actual} !== ${expected}`);
}

test('initial state is strict and starts with ten clear seconds', () => {
  const state = createInterference();
  assert.deepEqual(state, { stage: 'clear', clear: 10, attempt: 0, tick: 0, remaining: 0, clock: 0, seed: 0 });
  assert.equal(isInterferenceState(state), true);
  for (const malformed of [
    { ...state, extra: true },
    { ...state, clear: Number.NaN },
    { ...state, stage: 'attempt', clear: 0, seed: undefined },
    (({ seed: _seed, ...missingSeed }) => ({ ...missingSeed, stage: 'corrupt', clear: 0, remaining: 30, clock: 0 }))(state),
    { ...state, stage: 'corrupt', clear: 0, remaining: 20, clock: 5, seed: 1 },
    { ...state, seed: 0x1_0000_0000 },
  ]) assert.equal(isInterferenceState(malformed), false, JSON.stringify(malformed));
});

test('the first ten active B1 seconds are clear; then the first attempt rolls after one second', () => {
  const random = sequence([0.01, 0.4]);
  let state = advanceInterference(createInterference(), 9.5, environment({ random }));
  assert.equal(state.stage, 'clear');
  closeTo(state.clear, 0.5, 'clear timer');
  assert.equal(random.count(), 0);
  state = advanceInterference(state, 0.5, environment({ random }));
  assert.deepEqual(state, { stage: 'attempt', clear: 0, attempt: 0, tick: 0, remaining: 0, clock: 0, seed: 0 });
  assert.equal(random.count(), 0);
  state = advanceInterference(state, 0.999, environment({ random }));
  assert.equal(state.stage, 'attempt');
  assert.equal(state.attempt, 0);
  closeTo(state.tick, 0.999, 'attempt partial second');
  assert.equal(random.count(), 0);
  state = advanceInterference(state, 0.001, environment({ random }));
  assert.equal(state.stage, 'corrupt', 'the n=1 roll fires at 1/30');
  assert.equal(state.seed, Math.floor(0.4 * 0x1_0000_0000) >>> 0);
  assert.equal(random.count(), 2, 'one first-attempt draw and one display seed draw');
  assert.equal(state.remaining, 30);
  assert.equal(isInterferenceState(state), true);
});

test('independent n/30 rolls reach the guaranteed thirtieth attempt', () => {
  const random = sequence([...Array(29).fill(0.99), 0.375]);
  let state = advanceInterference(createInterference(), 10, environment({ random }));
  state = advanceInterference(state, 29, environment({ random }));
  assert.equal(state.stage, 'attempt');
  assert.equal(state.attempt, 29);
  assert.equal(random.count(), 29);
  state = advanceInterference(state, 1, environment({ random }));
  assert.equal(state.stage, 'corrupt');
  assert.equal(state.remaining, 30);
  assert.equal(state.seed, Math.floor(0.375 * 0x1_0000_0000) >>> 0);
  assert.equal(random.count(), 30, 'the final attempt is guaranteed, then one seed is drawn');
});

test('corruption begins immediately, advances on model time, and returns to a fresh ten-second clear', () => {
  let { state } = corruptionState();
  state = advanceInterference(state, 12.75, environment());
  assert.equal(state.stage, 'corrupt');
  closeTo(state.remaining, 17.25, 'corruption remaining');
  closeTo(state.clock, 12.75, 'display clock');
  state = advanceInterference(state, 17.25, environment());
  assert.deepEqual(state, { stage: 'clear', clear: 10, attempt: 0, tick: 0, remaining: 0, clock: 0, seed: 0 });
});

test('freeze pauses clear and attempts but does not extend an active curse', () => {
  const frozenClear = advanceInterference(createInterference(), 20, environment({ suspended: true }));
  assert.deepEqual(frozenClear, createInterference());
  let attempt = attemptState();
  const frozenAttempt = advanceInterference(attempt, 25, environment({ suspended: true }));
  assert.deepEqual(frozenAttempt, attempt);

  let { state } = corruptionState();
  state = advanceInterference(state, 7, environment({ suspended: true }));
  assert.equal(state.stage, 'corrupt');
  closeTo(state.remaining, 23, 'curse time while caster is frozen');
  closeTo(state.clock, 7, 'display clock while caster is frozen');
});

test('leaving B1 clears an active curse and resets the initial interval', () => {
  const { state } = corruptionState();
  const outside = advanceInterference(state, 0.1, environment({ active: false }));
  assert.deepEqual(outside, createInterference());
  const suspendedOutside = advanceInterference(state, 0.1, environment({ active: false, suspended: true }));
  assert.deepEqual(suspendedOutside, createInterference());
});

test('saved seed and model clock reproduce the same false perception without consuming world RNG', () => {
  let { state, random } = corruptionState(0.1234);
  state = advanceInterference(state, 2.125, environment());
  const real = combinePerception({ noise: 12, glare: 38, sight: 4 });
  const before = structuredClone(real);
  const displayed = displayPerception(real, state);
  assert.notEqual(displayed, real);
  assert.deepEqual(real, before, 'rendering a false display leaves real perception untouched');
  assert.equal(random.count(), 2, 'display generation consumes no environment RNG');

  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(isInterferenceState(restored), true);
  assert.deepEqual(displayPerception(real, restored), displayed);
  const next = advanceInterference(state, 0.25, environment());
  const resumed = advanceInterference(restored, 0.25, environment());
  assert.deepEqual(displayPerception(real, resumed), displayPerception(real, next));
});

test('false display can contradict both real extremes while retaining normal contribution math', () => {
  const { state: atStart } = corruptionState(0.42);
  const real100 = combinePerception({ noise: 100, glare: 0, sight: 0 }, true);
  const fakeLow = displayPerception(real100, advanceInterference(atStart, 2, environment()));
  assert.equal(real100.total, 100);
  assert.ok(fakeLow.total < 40, `false low total should contradict real 100: ${fakeLow.total}`);

  const real0 = combinePerception({ noise: 0, glare: 0, sight: 0 });
  const fakeHigh = displayPerception(real0, atStart);
  assert.equal(real0.total, 0);
  assert.ok(fakeHigh.total > 99, `false high total should contradict real 0: ${fakeHigh.total}`);
  closeTo(
    fakeHigh.contributions.noise.points + fakeHigh.contributions.glare.points + fakeHigh.contributions.sight.points,
    fakeHigh.total,
    'false contribution attribution remains consistent',
  );
});

test('clear and attempt return the original real perception by identity', () => {
  const real = combinePerception({ noise: 80, glare: 5, sight: 0 });
  assert.equal(displayPerception(real, createInterference()), real);
  assert.equal(displayPerception(real, attemptState()), real);
});

test('the display changes in deterministic three-Hz steps and different dt pacing uses the same RNG count', () => {
  const { state } = corruptionState(0.7);
  const real = combinePerception({ noise: 0, glare: 0, sight: 0 });
  const first = displayPerception(real, state);
  const subframe = displayPerception(real, advanceInterference(state, 0.2, environment()));
  const nextStep = displayPerception(real, advanceInterference(state, 0.34, environment()));
  assert.deepEqual(subframe, first, 'the false display is stable inside one refresh interval');
  assert.notDeepEqual(nextStep, first, 'the false display updates at about three times per second');

  const run = steps => {
    const rng = sequence([...Array(29).fill(0.99), 0.55]);
    let current = createInterference(), elapsed = 0, index = 0;
    while (elapsed < 42 - 1e-9) {
      const dt = Math.min(steps[index++ % steps.length], 42 - elapsed);
      current = advanceInterference(current, dt, environment({ random: rng }));
      elapsed += dt;
    }
    return { state: current, draws: rng.count() };
  };
  const large = run([42]);
  const frames = run(Array(60).fill(1 / 60));
  assert.equal(large.state.stage, 'corrupt');
  assert.equal(frames.state.stage, 'corrupt');
  assert.equal(large.state.seed, frames.state.seed);
  assert.equal(large.draws, frames.draws);
  closeTo(large.state.remaining, frames.state.remaining, 'remaining after different frame rates');
  closeTo(large.state.clock, frames.state.clock, 'clock after different frame rates');
});
