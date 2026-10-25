import { combinePerception, type Sense } from './perception.ts';

export type InterferenceStage = 'clear' | 'attempt' | 'corrupt';
export type InterferenceState = {
  stage: InterferenceStage;
  clear: number;
  attempt: number;
  tick: number;
  remaining: number;
  clock: number;
  seed: number;
};

export type InterferenceEnvironment = {
  active: boolean;
  suspended: boolean;
  random: () => number;
};

export type PerceptionDisplay = ReturnType<typeof combinePerception>;

const CLEAR_DURATION = 10;
const ATTEMPT_DURATION = 30;
const CORRUPTION_DURATION = 30;
const EPSILON = 1e-10;
const MAX_SEED = 0xffffffff;
const STAGES = new Set<InterferenceStage>(['clear', 'attempt', 'corrupt']);
const STATE_KEYS = new Set(['stage', 'clear', 'attempt', 'tick', 'remaining', 'clock', 'seed']);

export function createInterference(): InterferenceState {
  return {
    stage: 'clear',
    clear: CLEAR_DURATION,
    attempt: 0,
    tick: 0,
    remaining: 0,
    clock: 0,
    seed: 0,
  };
}

/** Advance the independent B1 interference timer using simulation time only. */
export function advanceInterference(
  state: InterferenceState,
  dt: number,
  env: InterferenceEnvironment,
): InterferenceState {
  if (!isInterferenceState(state)) throw new TypeError('Invalid interference state');
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Interference dt must be a finite non-negative number');

  const next: InterferenceState = { ...state };
  if (!env.active) return createInterference();

  // A live curse is tied to world time; freeze only suspends its future cast cycle.
  if (env.suspended && next.stage !== 'corrupt') return next;

  let remainingTime = dt;
  while (remainingTime > EPSILON) {
    if (next.stage === 'clear') {
      const elapsed = Math.min(remainingTime, next.clear);
      next.clear = clean(next.clear - elapsed);
      remainingTime = clean(remainingTime - elapsed);
      if (next.clear > EPSILON) break;
      next.clear = 0;
      next.stage = 'attempt';
      next.attempt = 0;
      next.tick = 0;
      continue;
    }

    if (next.stage === 'attempt') {
      const untilRoll = 1 - next.tick;
      const elapsed = Math.min(remainingTime, untilRoll);
      next.tick = clean(next.tick + elapsed);
      remainingTime = clean(remainingTime - elapsed);
      if (next.tick < 1 - EPSILON) break;

      next.tick = 0;
      next.attempt = Math.min(ATTEMPT_DURATION, next.attempt + 1);
      const fires = next.attempt === ATTEMPT_DURATION || roll(env.random) < next.attempt / ATTEMPT_DURATION;
      if (!fires) continue;

      next.stage = 'corrupt';
      next.attempt = 0;
      next.remaining = CORRUPTION_DURATION;
      next.clock = 0;
      next.seed = seedFromRoll(roll(env.random));
      continue;
    }

    const elapsed = Math.min(remainingTime, next.remaining);
    next.remaining = clean(next.remaining - elapsed);
    next.clock = clean(next.clock + elapsed);
    remainingTime = clean(remainingTime - elapsed);
    if (next.remaining > EPSILON) break;

    next.stage = 'clear';
    next.clear = CLEAR_DURATION;
    next.attempt = 0;
    next.tick = 0;
    next.remaining = 0;
    next.clock = 0;
    next.seed = 0;
  }

  return next;
}

export function isInterferenceState(raw: unknown): raw is InterferenceState {
  if (!record(raw) || Object.keys(raw).length !== STATE_KEYS.size
    || Object.keys(raw).some(key => !STATE_KEYS.has(key))
    || !STAGES.has(raw.stage as InterferenceStage)
    || !finiteIn(raw.clear, 0, CLEAR_DURATION)
    || !integerIn(raw.attempt, 0, ATTEMPT_DURATION - 1)
    || !finiteIn(raw.tick, 0, 1)
    || !finiteIn(raw.remaining, 0, CORRUPTION_DURATION)
    || !finiteIn(raw.clock, 0, CORRUPTION_DURATION)
    || !integerIn(raw.seed, 0, MAX_SEED)) return false;

  if (raw.stage === 'clear') {
    return raw.clear > 0 && raw.attempt === 0 && raw.tick === 0 && raw.remaining === 0 && raw.clock === 0 && raw.seed === 0;
  }
  if (raw.stage === 'attempt') {
    return raw.clear === 0 && raw.attempt <= ATTEMPT_DURATION - 1 && raw.tick < 1
      && raw.remaining === 0 && raw.clock === 0 && raw.seed === 0;
  }
  return raw.clear === 0 && raw.attempt === 0 && raw.tick === 0 && raw.remaining > 0
    && Math.abs(raw.remaining + raw.clock - CORRUPTION_DURATION) <= 1e-8;
}

/**
 * Produce a deterministic false perception view while cursed. Three sensor scores share one
 * synthetic clock and use the normal noisy-OR/attribution math; the saved world perception is never changed.
 */
export function displayPerception(
  realPerception: PerceptionDisplay,
  state: InterferenceState,
): PerceptionDisplay {
  if (state.stage !== 'corrupt') return realPerception;
  const step = Math.floor(state.clock * 3);
  const slot = step % 12;
  const scores = {} as Record<Sense, number>;
  for (const [index, sense] of (['noise', 'glare', 'sight'] as const).entries()) {
    const sample = sample01(state.seed, step, index);
    scores[sense] = slot < 3 ? 80 + sample * 20
      : slot >= 6 && slot < 9 ? sample * 10
        : sample * 100;
  }
  return combinePerception(scores);
}

function roll(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value)) throw new RangeError('Interference RNG must return a finite number');
  return Math.min(1 - Number.EPSILON, Math.max(0, value));
}

function seedFromRoll(value: number): number {
  return Math.floor(value * 0x100000000) >>> 0;
}

function sample01(seed: number, step: number, lane: number): number {
  let value = (seed ^ Math.imul(step + 1, 0x9e3779b1) ^ Math.imul(lane + 1, 0x85ebca6b)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

function clean(value: number): number {
  return value <= EPSILON ? 0 : value;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteIn(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function integerIn(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}
