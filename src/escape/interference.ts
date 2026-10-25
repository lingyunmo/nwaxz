import { combinePerception, type Sense } from './perception.ts';

export type InterferenceStage = 'clear' | 'attempt' | 'corrupt';
export type InterferenceState = {
  /** Profile that owns the current clear/attempt cycle, or the cast profile during corruption. */
  profile?: 0 | -1;
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
  floor?: 0 | -1;
  immune?: boolean;
  random: () => number;
};

export type PerceptionDisplay = ReturnType<typeof combinePerception>;

const ATTEMPT_DURATION = 30;
const B1_CLEAR_DURATION = 10;
const FLOOR_CLEAR_DURATION = 30;
const B1_CORRUPTION_DURATION = 30;
const FLOOR_CORRUPTION_DURATION = 10;
const EPSILON = 1e-10;
const MAX_SEED = 0xffffffff;
const STAGES = new Set<InterferenceStage>(['clear', 'attempt', 'corrupt']);
const STATE_KEYS = new Set(['profile', 'stage', 'clear', 'attempt', 'tick', 'remaining', 'clock', 'seed']);

export function createInterference(floor: 0 | -1 = -1): InterferenceState {
  return {
    ...(floor === 0 ? { profile: 0 as const } : {}),
    stage: 'clear',
    clear: clearDuration(floor),
    attempt: 0,
    tick: 0,
    remaining: 0,
    clock: 0,
    seed: 0,
  };
}

/** Advance interference timers using simulation time only. */
export function advanceInterference(
  state: InterferenceState,
  dt: number,
  env: InterferenceEnvironment,
): InterferenceState {
  if (!isInterferenceState(state)) throw new TypeError('Invalid interference state');
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Interference dt must be a finite non-negative number');

  const next: InterferenceState = { ...state };
  const floor = env.floor ?? -1;
  if (!env.active) return createInterference(floor);

  // A ward clears an existing curse immediately, even while the caster is frozen.
  if (env.immune && next.stage === 'corrupt') Object.assign(next, createInterference(floor));

  // A clear interval keeps its fractional progress when moving between floors. Attempts keep
  // their accumulated rolls and partial second; a live curse keeps its original cast profile.
  const currentProfile = next.profile ?? -1;
  if (next.stage !== 'corrupt' && currentProfile !== floor) {
    if (next.stage === 'clear') {
      next.clear = clean(next.clear / clearDuration(currentProfile) * clearDuration(floor));
    }
    setProfile(next, floor);
  }

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

      // A blocked cast is spent, not banked for after the ward expires.
      if (env.immune) {
        Object.assign(next, createInterference(floor));
        continue;
      }

      next.stage = 'corrupt';
      next.attempt = 0;
      next.remaining = corruptionDuration(floor);
      next.clock = 0;
      next.seed = seedFromRoll(roll(env.random));
      setProfile(next, floor);
      continue;
    }

    const elapsed = Math.min(remainingTime, next.remaining);
    next.remaining = clean(next.remaining - elapsed);
    next.clock = clean(next.clock + elapsed);
    remainingTime = clean(remainingTime - elapsed);
    if (next.remaining > EPSILON) break;

    next.stage = 'clear';
    next.clear = clearDuration(floor);
    next.attempt = 0;
    next.tick = 0;
    next.remaining = 0;
    next.clock = 0;
    next.seed = 0;
    setProfile(next, floor);
  }

  return next;
}

export function isInterferenceState(raw: unknown): raw is InterferenceState {
  if (!record(raw) || Object.keys(raw).some(key => !STATE_KEYS.has(key))
    || Object.keys(raw).length !== STATE_KEYS.size - (Object.hasOwn(raw, 'profile') ? 0 : 1)
    || (Object.hasOwn(raw, 'profile') && raw.profile !== 0 && raw.profile !== -1)
    || !STAGES.has(raw.stage as InterferenceStage)
    || !finiteIn(raw.clear, 0, FLOOR_CLEAR_DURATION)
    || !integerIn(raw.attempt, 0, ATTEMPT_DURATION - 1)
    || !finiteIn(raw.tick, 0, 1)
    || !finiteIn(raw.remaining, 0, B1_CORRUPTION_DURATION)
    || !finiteIn(raw.clock, 0, B1_CORRUPTION_DURATION)
    || !integerIn(raw.seed, 0, MAX_SEED)) return false;

  if (raw.stage === 'clear') {
    return raw.clear > 0 && raw.clear <= clearDuration(profileOf(raw)) && raw.attempt === 0 && raw.tick === 0 && raw.remaining === 0 && raw.clock === 0 && raw.seed === 0;
  }
  if (raw.stage === 'attempt') {
    return raw.clear === 0 && raw.attempt <= ATTEMPT_DURATION - 1 && raw.tick < 1
      && raw.remaining === 0 && raw.clock === 0 && raw.seed === 0;
  }
  return raw.clear === 0 && raw.attempt === 0 && raw.tick === 0 && raw.remaining > 0
    && Math.abs(raw.remaining + raw.clock - corruptionDuration(profileOf(raw))) <= 1e-8;
}

function profileOf(state: Pick<InterferenceState, 'profile'>): 0 | -1 { return state.profile ?? -1; }
function clearDuration(floor: 0 | -1): number { return floor === 0 ? FLOOR_CLEAR_DURATION : B1_CLEAR_DURATION; }
function corruptionDuration(floor: 0 | -1): number { return floor === 0 ? FLOOR_CORRUPTION_DURATION : B1_CORRUPTION_DURATION; }
function setProfile(state: InterferenceState, floor: 0 | -1): void {
  if (floor === -1) delete state.profile;
  else state.profile = floor;
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
