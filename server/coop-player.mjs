import packageInfo from "../package.json" with { type: "json" };
import { EscapeWorld, PROPS } from "../src/escape/world.ts";
import { floorAt } from "../src/escape/basement-map.ts";
import { CoopService } from "./coop-service.mjs";
import { playEscapeRoute } from "./escape-player.mjs";

export const COOP_ROUTE_SEEDS = [202, 101, 303];
const STEP = 1 / 30, PULSE_MS = 50;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const neutral = { forward: 0, strafe: 0, turn: 0, look: 0, sprint: false };

/** Only resets procedural randomness before the official start; every spawn remains the service-assigned slot position. */
export function seedCoopLobby(service, code, seed) {
  if (!COOP_ROUTE_SEEDS.includes(seed)) throw new Error(`unapproved deterministic route seed ${seed}`);
  const room = service.rooms.get(code);
  if (!room || room.phase !== "lobby") throw new Error("route seed can only be set in an existing lobby");
  room.world = new EscapeWorld(seed);
  for (const player of room.players.values()) {
    player.actorWorld = EscapeWorld.restore(room.world.snapshot());
    player.actorWorld.data.player = { ...player.actorWorld.data.player, ...player.position };
    player.actor = { ...player.actorWorld.data.player };
  }
  room.nextPulse = service.now();
  return room;
}

export function createCoopRouteScenario({ count = 2, seed = 202, now = 2_000_000 } = {}) {
  if (count !== 2 && count !== 3) throw new RangeError("co-op route scenarios require two or three players");
  let time = now;
  const service = new CoopService({ now: () => time, autoTick: false, maxRooms: 1 });
  const first = service.create({ version: packageInfo.version, name: "路线甲", avatar: 0 });
  const sessions = [first];
  for (let slot = 1; slot < count; slot++) sessions.push(service.join({ version: packageInfo.version, code: first.code, name: `路线${slot + 1}`, avatar: slot }));
  const room = seedCoopLobby(service, first.code, seed);
  for (const session of sessions) service.setReady(room.code, session.token, true);
  service.start(room.code, { id: first.playerId, token: first.token });
  const clock = {
    get now() { return time; },
    advance(ms = PULSE_MS) { if (!Number.isFinite(ms) || ms <= 0 || ms % PULSE_MS !== 0) throw new RangeError("manual clock advances in 50 ms service pulses"); time += ms; service.pulse(); },
  };
  const controllers = sessions.map(session => new CoopRoutePlayer({ service, room, session, clock }));
  return { service, room, sessions, controllers, clock, seed, close: () => service.close() };
}

/** Adapts the single-player path policy to authenticated service input and server snapshots. */
export class CoopRoutePlayer {
  constructor({ service, room, session, clock }) {
    this.service = service; this.room = room; this.session = session; this.clock = clock;
    this.member = service.findPlayer(room, session.token);
    if (!this.member) throw new Error("route controller requires a real room member token");
    this.seq = 0; this.lastActionAt = -Infinity; this.timeCarry = 0; this.pendingMove = { ...neutral }; this.respawns = [];
    this.projection = undefined; this.sync();
  }

  sync() {
    const snapshot = this.service.snapshot(this.room, this.member);
    const context = { playerId: snapshot.viewPlayerId, targetId: snapshot.targetPlayerId };
    this.projection = EscapeWorld.restore(snapshot.world, context); this.projection.pending = snapshot.search ? { ...snapshot.search } : undefined;
    this.status = this.member.status;
    if (this.room.phase === "won" || this.status === "escaped") this.projection.data.phase = "won";
    else if (this.room.phase === "lost" || this.status === "eliminated" || this.status === "left") this.projection.data.phase = "lost";
    else if (this.status === "caught") this.projection.data.phase = "caught";
    else this.projection.data.phase = "playing";
    this.projection.data.captures = (this.room.initialPlayerCount === 3 ? 1 : 2) - this.member.lives;
    return snapshot;
  }

  get data() { return this.projection.data; }
  get pending() { return this.projection.pending; }
  get seenHide() { return this.projection.seenHide; }
  get routeProof() { return { status: this.member.status, lives: this.member.lives, floor: floorAt(this.data.player), position: { x: this.data.player.x, z: this.data.player.z }, hidden: this.data.hidden }; }
  get live() { return this.member.status === "connected" || this.member.status === "caught"; }
  get inventory() { return [...this.room.world.data.inventory]; }

  route(...args) { return this.projection.route(...args); }
  nearest(...args) { return this.projection.nearest(...args); }
  wall(...args) { return this.projection.wall(...args); }
  furniture(...args) { return this.projection.furniture(...args); }
  lineOfSight(...args) { return this.projection.lineOfSight(...args); }
  seesPlayer(...args) { return this.projection.seesPlayer(...args); }
  crystalCharges(...args) { return this.projection.crystalCharges(...args); }
  snapshot() { return this.service.snapshot(this.room, this.member).world; }

  sendInput({ move = neutral, aim = true, action, targetId } = {}) {
    const body = { seq: ++this.seq, move: { ...neutral, ...move, sprint: !!this.member.actorWorld.data.player.sprinting } };
    if (aim) body.aim = { angle: this.data.player.angle, pitch: this.data.player.pitch ?? 0 };
    if (action) body.action = action;
    if (targetId) body.targetId = targetId;
    return this.service.input(this.room.code, this.session.token, body);
  }

  stepPulse(move = neutral) {
    this.sendInput({ move });
    this.clock.advance(PULSE_MS);
    this.sync();
  }

  advance(seconds = STEP, input = {}) {
    if (this.data.hidden && (Math.abs(input.forward ?? 0) > .001 || Math.abs(input.strafe ?? 0) > .001)) this.interact();
    if (this.member.status !== "connected") { this.sync(); return; }
    const wantsSprint = !!input.sprint;
    if (this.data.player.sprinting !== wantsSprint) this.sendAction("sprint");
    this.pendingMove = { ...neutral, ...input, sprint: wantsSprint };
    this.timeCarry += Math.max(0, Math.min(.15, seconds));
    while (this.timeCarry + 1e-9 >= PULSE_MS / 1000 && this.member.status === "connected") {
      this.stepPulse(this.pendingMove);
      this.timeCarry -= PULSE_MS / 1000;
    }
  }

  setAction(action, targetId) {
    if (this.member.status !== "connected") return false;
    const aim = { angle: this.data.player.angle, pitch: this.data.player.pitch ?? 0 };
    while (this.clock.now - this.lastActionAt < 100) { this.clock.advance(PULSE_MS); this.sync(); if (this.member.status !== "connected") return false; }
    Object.assign(this.data.player, aim);
    this.sendInput({ move: neutral, action, targetId }); this.lastActionAt = this.clock.now;
    this.sync();
    return true;
  }

  sendAction(action, targetId) { return this.setAction(action, targetId); }
  toggleLight() { this.sendAction("light"); }
  toggleCrouch() { this.sendAction("crouch"); }
  toggleSprint() { this.sendAction("sprint"); }
  useCrystal(kind) { return this.sendAction(kind); }

  interact() {
    if (this.member.status !== "connected") return false;
    // aim is applied on a real service pulse before the authenticated interaction is evaluated.
    this.sendInput({ move: neutral, aim: true });
    this.clock.advance(PULSE_MS); this.timeCarry = 0; this.sync();
    const target = this.nearest();
    if (!target) return false;
    return this.setAction("interact", target.id);
  }

  nextNight() {
    if (this.member.status !== "caught" || this.member.lives <= 0) return false;
    const before = this.sharedState();
    const lives = this.member.lives;
    this.service.respawn(this.room.code, this.session.token);
    this.sync();
    const after = this.sharedState();
    const proof = { playerId: this.member.id, livesBefore: lives, livesAfter: this.member.lives, before, after };
    this.respawns.push(proof);
    if (this.member.lives !== lives || JSON.stringify(before) !== JSON.stringify(after)) throw new Error("respawn changed lives or shared objectives");
    return true;
  }

  sharedState() {
    const d = this.room.world.data;
    return JSON.parse(JSON.stringify({ inventory: d.inventory, searched: d.searched, opened: d.opened, unlocked: d.unlocked, notes: d.notes, power: d.power, drained: d.drained, stones: d.stones, basement: d.basement, expansion: d.expansion, abilities: d.abilities, hunt: { collected: d.hunt.collected, freezeUsed: d.hunt.freezeUsed, revealUsed: d.hunt.revealUsed, wardUsed: d.hunt.wardUsed }, hunter: d.hunter, elapsed: d.elapsed }));
  }

  hideAtSafeWardrobe(maxSteps = 5000) {
    if (this.data.hidden) return this.data.hidden;
    const candidates = PROPS.filter(prop => prop.kind === "wardrobe" && floorAt(prop) === floorAt(this.data.player))
      .flatMap(prop => [{ prop, target: { x: prop.x, z: prop.z + 1 } }, { prop, target: { x: prop.x - 1, z: prop.z + .5 } }])
      .map(option => ({ ...option, path: this.route(this.data.player, option.target), exposed: this.lineOfSight(this.data.hunter, option.prop) }))
      .filter(option => option.path.length > 0 && option.path.length < 9 && !option.exposed)
      .sort((a, b) => a.path.length - b.path.length);
    for (const option of candidates) {
      if (!this.walkTo(option.target, maxSteps)) continue;
      this.face(option.prop);
      if (this.nearest()?.id !== option.prop.id || this.seesPlayer()) continue;
      this.interact();
      if (this.data.hidden) return this.data.hidden;
    }
    return undefined;
  }

  walkTo(target, maxSteps = 5000) {
    for (let i = 0; i < maxSteps && this.live && distance(this.data.player, target) > .09; i++) {
      const path = this.route(this.data.player, target);
      const next = path.find(point => distance(this.data.player, point) > .09) ?? target;
      this.face(next);
      const speed = this.data.player.crouched ? .95 : 1.7;
      this.advance(STEP, { forward: Math.min(1, distance(this.data.player, next) / (speed * STEP)) });
    }
    return distance(this.data.player, target) <= .1;
  }

  face(point) { this.data.player.angle = Math.atan2(point.z - this.data.player.z, point.x - this.data.player.x); }
}

/** A reproducible cooperative walk-through; teammates physically hide and take over retained tasks. */
export function playCoopRoute({ count = 2, seed = 202 } = {}) {
  const scenario = createCoopRouteScenario({ count, seed });
  const runs = [], hiding = [];
  try {
    for (const player of scenario.controllers) { if (player.data.player.light) player.toggleLight(); if (!player.data.player.crouched) player.toggleCrouch(); }
    for (const player of scenario.controllers.slice(1)) hiding.push({ slot: player.member.slot, wardrobe: player.hideAtSafeWardrobe() });
    for (const player of scenario.controllers) {
      player.sync();
      if (player.member.status === "eliminated" || scenario.room.phase !== "playing") continue;
      if (player.data.hidden) {
        for (let n = 0; n < 1200 && distance(player.data.player, player.data.hunter) < 7; n++) { scenario.clock.advance(PULSE_MS); player.sync(); }
        player.interact();
      }
      if (!player.data.player.light) player.toggleLight(); // The shared path policy then switches it off by input.
      const result = playEscapeRoute(player, true);
      runs.push({ slot: player.member.slot, phase: result.phase, log: result.log, proof: { ...result.routeProof, zTrail: undefined }, respawns: player.respawns });
    }
    const perspective = [...scenario.room.players.values()].find(player => player.status === "escaped") ?? [...scenario.room.players.values()].at(-1);
    const packet = scenario.service.snapshot(scenario.room, perspective);
    return { viewPlayerId: packet.viewPlayerId, targetPlayerId: packet.targetPlayerId, seed, count, phase: scenario.room.phase, elapsed: scenario.room.world.data.elapsed,
      roster: scenario.service.view(scenario.room).players, hiding, runs, world: JSON.parse(JSON.stringify(packet.world)) };
  } finally { scenario.close(); }
}
