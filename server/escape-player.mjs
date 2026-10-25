// A deterministic reference player using normal movement, look, crouch/sprint, interactions,
// wardrobe hiding and collected crystals. The hunter AI and basement abilities stay active.
import { CRYSTALS, DOORS, EscapeWorld, MAP, PROPS, ROOMS } from '../src/escape/world.ts';
import { floorAt } from '../src/escape/basement-map.ts';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const face = (world, point) => {
  const p = world.data.player;
  p.angle = Math.atan2(point.z - p.z, point.x - p.x);
};

export function playEscapeRoute(world, expanded = true, trace = false) {
  if (!expanded || !world.data.expansion?.enabled) throw new Error('the current escape route requires the full v2 expansion');
  const seed = world.data.hunt.rng, step = 1 / 30, log = [], zTrail = [world.data.player.z];
  world.toggleLight();
  if (!world.data.player.crouched) world.toggleCrouch();
  let visitedBasement = false, returnedToGround = false, basementAbilityTicks = 0, currentObjective = '';
  const abilityNotices = new Set(), hunterStates = new Set([world.data.hunter.state]);
  let lastCaptures = 0;

  const advance = (input = {}) => {
    world.advance(step, input);
    const z = world.data.player.z;
    zTrail.push(z);
    if (z >= 28) visitedBasement = true;
    if (visitedBasement && z < 24) returnedToGround = true;
    hunterStates.add(world.data.hunter.state);
    if (floorAt(world.data.player) === -1 && world.data.abilities.enabled) basementAbilityTicks++;
    if (world.data.abilities.notice) abilityNotices.add(world.data.abilities.notice.kind);
    if (trace && world.data.captures !== lastCaptures) {
      console.log({ event: 'capture', player: { x: +world.data.player.x.toFixed(2), z: +z.toFixed(2) },
        hunter: { x: +world.data.hunter.x.toFixed(2), z: +world.data.hunter.z.toFixed(2) },
        captures: world.data.captures, hidden: world.data.hidden, hunterState: world.data.hunter.state,
        seenHide: world.seenHide, objective: currentObjective, freezeCharges: world.crystalCharges('freeze') });
      lastCaptures = world.data.captures;
    }
  };

  const defend = () => {
    const d = world.data, hunterDistance = distance(d.player, d.hunter);
    if ((d.hunt.ward ?? 0) <= 0 && world.crystalCharges('ward') > 0 && d.interference.stage === 'corrupt') world.useCrystal('ward');
    if (hunterDistance < 2.5
      && d.hunt.freeze <= 0 && world.crystalCharges('freeze') > 0) world.useCrystal('freeze');
    return d.hunter.state === 'chase' || d.hunt.freeze > 0 || hunterDistance < 4;
  };

  const pickup = () => {
    for (const crystal of CRYSTALS) {
      if (world.data.hunt.collected.includes(crystal.id) || distance(world.data.player, crystal) >= 1.65) continue;
      face(world, crystal);
      if (world.nearest()?.id === crystal.id) world.interact();
    }
  };

  const rest = () => {
    const d = world.data;
    if (d.hunt.effort < 50 || distance(d.player, d.hunter) < 5 || d.hunt.freeze > 0) return;
    for (let n = 0; n < 150 && d.hunt.effort > 34 && d.phase === 'playing'; n++) {
      advance();
      if (distance(d.player, d.hunter) < 5) break;
    }
  };

  const clearOfHunter = (path, threshold = 4) => path.slice(0, 6)
    .every(point => distance(point, world.data.hunter) >= threshold);
  const clearWholeRoute = (path, threshold = 4) => clearOfHunter(path, threshold);

  const refuge = target => {
    const p = world.data.player, h = world.data.hunter, floor = floorAt(p);
    const candidates = [];
    for (let z = Math.max(1, Math.floor(p.z) - 9); z <= Math.min(MAP.length - 2, Math.floor(p.z) + 9); z++) {
      for (let x = Math.max(1, Math.floor(p.x) - 9); x <= Math.min(MAP[0].length - 2, Math.floor(p.x) + 9); x++) {
        const at = { x: x + .5, z: z + .5 }, fromPlayer = distance(p, at), fromHunter = distance(h, at);
        if (fromPlayer < .8 || fromHunter < 7 || floorAt(at) !== floor || world.wall(at.x, at.z)
          || world.furniture(at.x, at.z, .2)) continue;
        candidates.push({ at, fromPlayer });
      }
    }
    for (const room of ROOMS) {
      if (floorAt({ x: room.x + room.w / 2, z: room.z + room.h / 2 }) !== floor) continue;
      for (const at of [{ x: room.x + .6, z: room.z + .6 }, { x: room.x + room.w - .6, z: room.z + .6 },
        { x: room.x + .6, z: room.z + room.h - .6 }, { x: room.x + room.w - .6, z: room.z + room.h - .6 }]) {
        if (!world.wall(at.x, at.z) && !world.furniture(at.x, at.z, .2) && distance(h, at) >= 7 && distance(p, at) >= .8)
          candidates.push({ at, fromPlayer: distance(p, at) });
      }
    }
    return candidates.map(candidate => {
      const path = world.route(p, candidate.at), onward = target ? world.route(candidate.at, target) : [];
      return { ...candidate, path, onward };
    }).filter(candidate => candidate.path.length > 0 && candidate.path.length < 14
      && (!target || candidate.onward.length > 0 && clearWholeRoute(candidate.onward)) && clearOfHunter(candidate.path))
      .sort((a, b) => a.path.length + a.onward.length - b.path.length - b.onward.length)[0]?.at;
  };

  const waitForPatrol = (maxTicks = 2400) => {
    for (let n = 0; n < maxTicks && world.data.phase === 'playing'; n++) {
      defend();
      if (world.data.hunt.freeze > 0) return true; // Spend the respite moving, not waiting beside the hunter.
      advance();
      if (world.data.hunter.state === 'patrol' && distance(world.data.player, world.data.hunter) > 7) return true;
    }
    return world.data.phase === 'playing' && distance(world.data.player, world.data.hunter) > 7;
  };

  const waitForClearRoute = (target, maxTicks = 1800) => {
    for (let n = 0; n < maxTicks && world.data.phase === 'playing'; n++) {
      const path = world.route(world.data.player, target);
      if (world.data.hunter.state === 'patrol' && clearOfHunter(path) && distance(world.data.player, world.data.hunter) > 5) return true;
      defend();
      if (world.data.hunt.freeze > 0) return true;
      advance();
    }
    return clearWholeRoute(world.route(world.data.player, target));
  };

  function travel(target, allowRefuge = true) {
    for (let n = 0; n < 18_000 && distance(world.data.player, target) > .09; n++) {
      if (world.data.phase !== 'playing') return false;
      const fleeing = defend();
      pickup(); rest();
      if (world.data.abilities.stage === 'warning' && world.data.abilities.selected === 'sense' && world.data.hunt.freeze <= 0) {
        advance(); // Standing still lowers the chance of the warned sense ability landing.
        continue;
      }
      const path = world.route(world.data.player, target);
      if (allowRefuge && !fleeing && world.data.hunt.freeze <= 0 && path.length && !clearOfHunter(path)) {
        const safe = refuge(target) ?? refuge();
        if (safe) {
          if (!travel(safe, false)) return false;
          waitForClearRoute(target);
          continue;
        }
        if (distance(world.data.player, world.data.hunter) <= 5) hide();
        waitForClearRoute(target);
        continue;
      }
      const next = path.find(point => distance(world.data.player, point) > .09) ?? target;
      face(world, next);
      const sprint = fleeing && world.data.player.stamina > 12 && !world.data.player.winded;
      // Walk in clear corridors; crouching for the whole route gives the patrol
      // time to repeatedly close every doorway. Sprint remains a finite escape.
      const crouch = !sprint && distance(world.data.player, world.data.hunter) < 6;
      if (world.data.player.crouched !== crouch) world.toggleCrouch();
      const speed = sprint ? 3 : crouch ? .95 : 1.7;
      advance({ forward: Math.min(1, distance(world.data.player, next) / (speed * step)), sprint });
    }
    return distance(world.data.player, target) <= .1;
  }

  const approach = point => {
    const options = [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([x, z]) => ({ x: point.x + x, z: point.z + z }))
      .filter(at => !world.wall(at.x, at.z) && !world.furniture(at.x, at.z, .18));
    const paths = options.map(target => ({ target, path: world.route(world.data.player, target) }))
      .filter(option => option.path.length || distance(world.data.player, option.target) < 1)
      .sort((a, b) => a.path.length - b.path.length);
    if (!paths.length) throw new Error(`no path ${JSON.stringify(point)}`);
    const ok = travel(paths[0].target);
    face(world, point);
    return ok;
  };

  const hide = () => {
    if (world.data.phase !== 'playing' || world.data.hidden) return;
    const p = world.data.player, hunter = world.data.hunter;
    const choices = PROPS.filter(prop => prop.kind === 'wardrobe' && floorAt(prop) === floorAt(p))
      .flatMap(prop => [[-.9, .8], [.9, .8], [0, 1]].map(([dx, dz]) => ({ prop, target: { x: prop.x + dx, z: prop.z + dz } })))
      .map(option => ({ ...option, path: world.route(p, option.target), exposed: world.lineOfSight(hunter, option.prop) }))
      .filter(option => option.path.length > 0 && option.path.length < 6 && clearOfHunter(option.path))
      .sort((a, b) => Number(a.exposed) - Number(b.exposed) || a.path.length - b.path.length);
    for (const option of choices) {
      if (!travel(option.target) || world.data.phase !== 'playing') return;
      face(world, option.prop);
      if (world.nearest()?.id !== option.prop.id || world.seesPlayer()) continue;
      world.interact();
      if (!world.data.hidden) continue;
      if (trace) console.log({ event: 'hide', id: option.prop.id, hunter: world.data.hunter.state });
      for (let n = 0; n < 600 && world.data.phase === 'playing'; n++) {
        defend(); advance();
        if (n > 180 && world.data.hunter.state === 'patrol' && distance(world.data.player, world.data.hunter) > 4) break;
      }
      if (world.data.phase === 'playing' && world.data.hidden) world.interact();
      return;
    }
  };

  const complete = (id, object, crystal, door) => {
    const d = world.data;
    if (crystal) return d.hunt.collected.includes(id);
    if (door) return d.opened.includes(id) || d.unlocked.includes(id);
    if (!object) return false;
    if (object.kind === 'drawer') return d.searched.includes(id);
    if (object.kind === 'note') return d.notes.includes(id);
    if (id === 'power') return d.power;
    if (id === 'drain') return d.drained;
    if (id.startsWith('valve-')) return d.expansion.valves.includes(id);
    if (id === 'basement-relay') return d.basement.power;
    if (id === 'basement-sluice') return d.basement.sluice;
    if (id === 'exit') return d.phase === 'won';
    return false;
  };

  const order = [
    'bed-drawer', 'study', 'study-drawer', 'crystal-hall-east', 'laundry-drawer', 'power', 'cellar', 'cellar-drawer',
    'changing', 'changing-drawer', 'boiler', 'boiler-note', 'valve-cold', 'valve-return', 'valve-vent',
    'drain', 'basement-crystal-freeze', 'basement-storage-drawer', 'basement-secret-note',
    'basement-relay', 'basement-sluice', 'exit',
  ];
  for (const id of order) {
    currentObjective = id;
    let done = false;
    for (let tries = 0; tries < 8 && !done; tries++) {
      if (world.data.phase === 'caught') world.nextNight();
      if (world.data.phase !== 'playing') break;
      const object = PROPS.find(prop => prop.id === id), crystal = CRYSTALS.find(item => item.id === id), door = DOORS.find(item => item.id === id);
      if (complete(id, object, crystal, door)) { done = true; break; }
      const point = object ?? crystal ?? { x: door.x + .5, z: door.z + .5 };
      if (distance(world.data.player, world.data.hunter) < 5 || world.data.hunter.state === 'chase') {
        const safe = refuge(point);
        if (safe) { travel(safe, false); waitForPatrol(); }
      }
      if (!approach(point)) continue;
      if (complete(id, object, crystal, door)) { done = true; break; }
      if (world.nearest()?.id !== id) { pickup(); face(world, point); }
      if (world.nearest()?.id !== id) throw new Error(`bad target ${id}: ${world.nearest()?.id}`);
      if (distance(world.data.player, world.data.hunter) < 5 || world.data.hunter.state === 'chase') {
        const safe = refuge(point);
        if (safe) { travel(safe, false); waitForPatrol(); if (!approach(point)) continue; face(world, point); }
      }
      world.interact();
      for (let n = 0; n < 180 && world.data.phase === 'playing' && !complete(id, object, crystal, door); n++) {
        if (world.pending && distance(world.data.player, world.data.hunter) < 2.5) {
          const p = world.data.player, h = world.data.hunter, away = { x: p.x + (p.x - h.x) * 3, z: p.z + (p.z - h.z) * 3 };
          if (!world.wall(away.x, away.z)) travel(away, false);
        }
        defend();
        advance();
      }
      done = complete(id, object, crystal, door);
      if (world.data.phase === 'playing' && distance(world.data.player, world.data.hunter) < 5) hide();
    }
    EscapeWorld.restore(world.snapshot());
    const entry = {
      id, t: +world.data.elapsed.toFixed(1), phase: world.data.phase, captures: world.data.captures,
      effort: +world.data.hunt.effort.toFixed(0), freeze: world.crystalCharges('freeze'),
      z: +world.data.player.z.toFixed(2), basement: visitedBasement, returned: returnedToGround,
    };
    log.push(entry);
    if (trace) console.log(entry);
    if (!done) break;
  }
  return {
    seed, expanded, phase: world.data.phase, time: world.data.elapsed, captures: world.data.captures,
    log, routeProof: { visitedBasement, returnedToGround, zTrail, basementAbilityTicks,
      abilityNotices: [...abilityNotices], hunterStates: [...hunterStates] }, world,
  };
}
