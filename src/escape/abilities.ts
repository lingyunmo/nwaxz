export type AbilityKind = 'sense' | 'teleport';
export type AbilityStage = 'rest' | 'cooldown' | 'attempt' | 'warning';
export type AbilityNoticeKind = 'sense-warning' | 'teleport-warning' | 'exposed' | 'evaded' | 'teleported' | 'teleport-failed';
export type AbilityNotice = { kind: AbilityNoticeKind; remaining: number; duration: number };

export type AbilityState = {
  enabled: boolean;
  stage: AbilityStage;
  selected?: AbilityKind;
  rest: number;
  attempt: number;
  warning: number;
  cooldowns: { sense: number; teleport: number };
  notice?: AbilityNotice;
  moving: boolean;
  scanChance: number;
  tick: number;
  motionMemory: number;
};

export type AbilityEnvironment = {
  active: boolean;
  suspended: boolean;
  moving: boolean;
  random: () => number;
  execute: (kind: AbilityKind) => boolean;
};

const ROUND_REST = 30;
const ATTEMPT_WINDOW = 30;
const WARNING_DURATION = 3;
const RESULT_DURATION = 2.4;
const MOTION_MEMORY = 0.4;
const SENSE_COOLDOWN = 35;
const TELEPORT_COOLDOWN = 45;
const EPSILON = 1e-10;
const STAGES = new Set<AbilityStage>(['rest', 'cooldown', 'attempt', 'warning']);
const KINDS = new Set<AbilityKind>(['sense', 'teleport']);
const NOTICE_KINDS = new Set<AbilityNoticeKind>(['sense-warning', 'teleport-warning', 'exposed', 'evaded', 'teleported', 'teleport-failed']);
const STATE_KEYS = new Set(['enabled', 'stage', 'selected', 'rest', 'attempt', 'warning', 'cooldowns', 'notice', 'moving', 'scanChance', 'tick', 'motionMemory']);

export function createAbilities(): AbilityState {
  return {
    enabled: false,
    stage: 'rest',
    rest: ROUND_REST,
    attempt: 0,
    warning: 0,
    cooldowns: { sense: 0, teleport: 0 },
    moving: false,
    scanChance: 0.2,
    tick: 0,
    motionMemory: 0,
  };
}

/**
 * Advance a serializable ability state by model time. Returns a new state and never reads a system clock.
 * RNG use occurs only when selecting a skill, on whole-second attempt rolls, and at sense resolution.
 */
export function advanceAbilities(state: AbilityState, dt: number, env: AbilityEnvironment): AbilityState {
  if (!isAbilityState(state)) throw new TypeError('Invalid ability state');
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Ability dt must be a finite non-negative number');

  const next: AbilityState = {
    ...state,
    cooldowns: { ...state.cooldowns },
    ...(state.notice ? { notice: { ...state.notice } } : {}),
  };
  if (env.suspended) return next;

  if (!env.active) {
    if (next.enabled && next.stage === 'warning') resetRound(next);
    return next;
  }

  next.enabled = true;
  next.moving = env.moving;
  if (dt === 0 && env.moving) {
    next.motionMemory = MOTION_MEMORY;
    next.scanChance = 0.8;
  }

  let remaining = dt;
  while (true) {
    if (next.stage === 'rest') {
      if (remaining <= EPSILON) break;
      const elapsed = Math.min(remaining, next.rest);
      consume(next, elapsed, env.moving);
      next.rest = cleanTimer(next.rest - elapsed);
      remaining = cleanTimer(remaining - elapsed);
      if (next.rest > EPSILON) break;
      next.rest = 0;
      next.selected = env.random() < 0.5 ? 'sense' : 'teleport';
      next.attempt = 0;
      next.tick = 0;
      next.stage = next.cooldowns[next.selected] > EPSILON ? 'cooldown' : 'attempt';
      continue;
    }

    if (next.stage === 'cooldown') {
      if (remaining <= EPSILON) break;
      const selected = next.selected!;
      const untilReady = next.cooldowns[selected];
      const elapsed = Math.min(remaining, untilReady);
      consume(next, elapsed, env.moving);
      remaining = cleanTimer(remaining - elapsed);
      if (next.cooldowns[selected] > EPSILON) break;
      next.cooldowns[selected] = 0;
      next.stage = 'attempt';
      next.attempt = 0;
      next.tick = 0;
      continue;
    }

    if (next.stage === 'attempt') {
      if (remaining <= EPSILON) break;
      const untilRoll = 1 - next.tick;
      const elapsed = Math.min(remaining, untilRoll);
      consume(next, elapsed, env.moving);
      next.tick = cleanTimer(next.tick + elapsed);
      remaining = cleanTimer(remaining - elapsed);
      if (next.tick < 1 - EPSILON) break;

      next.tick = 0;
      next.attempt = Math.min(ATTEMPT_WINDOW, next.attempt + 1);
      const fires = next.attempt === ATTEMPT_WINDOW || env.random() < next.attempt / ATTEMPT_WINDOW;
      if (fires) beginWarning(next);
      continue;
    }

    // Warning time, its visible notice, and all cooldowns share the same model clock.
    if (remaining <= EPSILON) break;
    const elapsed = Math.min(remaining, next.warning);
    consume(next, elapsed, env.moving);
    next.warning = cleanTimer(next.warning - elapsed);
    if (next.notice && (next.notice.kind === 'sense-warning' || next.notice.kind === 'teleport-warning')) {
      next.notice.remaining = next.warning;
    }
    remaining = cleanTimer(remaining - elapsed);
    if (next.warning > EPSILON) break;
    next.warning = 0;
    resolveWarning(next, env);
  }

  return next;
}

export function isAbilityState(raw: unknown): raw is AbilityState {
  if (!record(raw) || Object.keys(raw).some(key => !STATE_KEYS.has(key))) return false;
  if (typeof raw.enabled !== 'boolean' || typeof raw.moving !== 'boolean' || !STAGES.has(raw.stage as AbilityStage)) return false;
  if (raw.selected !== undefined && !KINDS.has(raw.selected as AbilityKind)) return false;
  if (!finiteIn(raw.rest, 0, ROUND_REST) || !integerIn(raw.attempt, 0, ATTEMPT_WINDOW)
    || !finiteIn(raw.warning, 0, WARNING_DURATION) || !finiteIn(raw.tick, 0, 1)
    || !finiteIn(raw.motionMemory, 0, MOTION_MEMORY)
    || raw.scanChance !== (raw.motionMemory > EPSILON ? 0.8 : 0.2)
    || (raw.moving && raw.motionMemory <= EPSILON)) return false;
  if (!record(raw.cooldowns) || Object.keys(raw.cooldowns).length !== 2
    || Object.keys(raw.cooldowns).some(key => key !== 'sense' && key !== 'teleport')
    || !finiteIn(raw.cooldowns.sense, 0, SENSE_COOLDOWN) || !finiteIn(raw.cooldowns.teleport, 0, TELEPORT_COOLDOWN)) return false;
  if (raw.notice !== undefined && !validNotice(raw.notice)) return false;

  if (!raw.enabled) {
    return raw.stage === 'rest' && raw.rest === ROUND_REST && raw.attempt === 0 && raw.warning === 0
      && raw.tick === 0 && raw.motionMemory === 0 && !raw.moving && raw.scanChance === 0.2
      && raw.cooldowns.sense === 0 && raw.cooldowns.teleport === 0 && raw.selected === undefined && raw.notice === undefined;
  }
  if (raw.stage === 'rest') {
    return raw.rest > 0 && raw.selected === undefined && raw.attempt === 0 && raw.warning === 0 && raw.tick === 0
      && (!raw.notice || isResultNotice(raw.notice));
  }
  if (!raw.selected || raw.rest !== 0) return false;
  if (raw.stage === 'cooldown') {
    return raw.cooldowns[raw.selected] > 0 && raw.attempt === 0 && raw.warning === 0 && raw.tick === 0 && raw.notice === undefined;
  }
  if (raw.stage === 'attempt') {
    return raw.cooldowns[raw.selected] === 0 && raw.attempt < ATTEMPT_WINDOW && raw.warning === 0 && raw.tick < 1 && raw.notice === undefined;
  }
  if (raw.attempt < 1 || raw.warning <= 0 || raw.tick !== 0 || !raw.notice) return false;
  return raw.cooldowns[raw.selected] === 0
    && raw.notice.kind === (raw.selected === 'sense' ? 'sense-warning' : 'teleport-warning')
    && raw.notice.duration === WARNING_DURATION && raw.notice.remaining === raw.warning;
}

function consume(state: AbilityState, elapsed: number, moving: boolean): void {
  if (elapsed <= 0) return;
  state.cooldowns.sense = cleanTimer(state.cooldowns.sense - elapsed);
  state.cooldowns.teleport = cleanTimer(state.cooldowns.teleport - elapsed);
  if (state.notice) {
    state.notice.remaining = cleanTimer(state.notice.remaining - elapsed);
    if (state.notice.remaining <= EPSILON) delete state.notice;
  }
  state.motionMemory = moving ? MOTION_MEMORY : cleanTimer(Math.max(0, state.motionMemory - elapsed));
  state.scanChance = state.motionMemory > EPSILON ? 0.8 : 0.2;
}

function beginWarning(state: AbilityState): void {
  state.stage = 'warning';
  state.warning = WARNING_DURATION;
  state.tick = 0;
  state.notice = {
    kind: state.selected === 'sense' ? 'sense-warning' : 'teleport-warning',
    remaining: WARNING_DURATION,
    duration: WARNING_DURATION,
  };
}

function resolveWarning(state: AbilityState, env: AbilityEnvironment): void {
  const selected = state.selected!;
  let kind: AbilityNoticeKind;
  if (selected === 'sense') {
    const hit = env.random() < state.scanChance;
    if (hit) env.execute('sense');
    kind = hit ? 'exposed' : 'evaded';
    state.cooldowns.sense = SENSE_COOLDOWN;
  } else {
    kind = env.execute('teleport') ? 'teleported' : 'teleport-failed';
    state.cooldowns.teleport = TELEPORT_COOLDOWN;
  }
  state.stage = 'rest';
  state.rest = ROUND_REST;
  state.attempt = 0;
  state.warning = 0;
  state.selected = undefined;
  state.tick = 0;
  state.notice = { kind, remaining: RESULT_DURATION, duration: RESULT_DURATION };
}

function resetRound(state: AbilityState): void {
  state.stage = 'rest';
  state.rest = ROUND_REST;
  state.attempt = 0;
  state.warning = 0;
  state.selected = undefined;
  state.tick = 0;
  if (state.notice?.kind === 'sense-warning' || state.notice?.kind === 'teleport-warning') delete state.notice;
}

function validNotice(raw: unknown): raw is AbilityNotice {
  if (!record(raw) || Object.keys(raw).length !== 3
    || Object.keys(raw).some(key => key !== 'kind' && key !== 'remaining' && key !== 'duration')
    || !NOTICE_KINDS.has(raw.kind as AbilityNoticeKind) || !Number.isFinite(raw.duration) || !Number.isFinite(raw.remaining)) return false;
  const isWarning = raw.kind === 'sense-warning' || raw.kind === 'teleport-warning';
  const duration = isWarning ? WARNING_DURATION : RESULT_DURATION;
  return raw.duration === duration && raw.remaining > 0 && raw.remaining <= duration;
}

function isResultNotice(notice: AbilityNotice): boolean {
  return notice.kind !== 'sense-warning' && notice.kind !== 'teleport-warning';
}

function record(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function integerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function cleanTimer(value: number): number {
  return value <= EPSILON ? 0 : value;
}
