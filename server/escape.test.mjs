import { test } from "node:test";
import assert from "node:assert/strict";
import { EscapeWorld, PROPS, DOORS, MAP, SIZE, roomAt, CRYSTALS } from "../src/escape/world.ts";

const frames = (w, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) w.advance(1 / 60, input); };
test("exploration respects closed doors, persists current tiles and rejects incomplete old saves", () => {
  const w = new EscapeWorld(42), tile = (x, z) => z * SIZE + x;
  const original = [...w.data.explored];
  assert.ok(original.includes(tile(3, 5)));
  assert.ok(!original.includes(tile(12, 2)), "another room is not revealed through walls");
  Object.assign(w.data.player, { x: 11.5, z: 8.5, angle: -Math.PI / 2 });
  w.revealMap(); assert.ok(!w.data.explored.includes(tile(11, 5)), "locked door blocks map sight");
  w.data.inventory.push("brass"); w.interact(); w.revealMap();
  assert.ok(w.data.explored.includes(tile(11, 5)), "opening a door reveals sightlines without moving cells");
  for (const id of original) assert.ok(w.data.explored.includes(id));
  const saved = w.snapshot(); assert.deepEqual(EscapeWorld.restore(saved).snapshot(), saved);
  const legacy = structuredClone(saved); delete legacy.explored;
  assert.throws(() => EscapeWorld.restore(legacy));
  for (const explored of [[-1], [SIZE * 54], [2, 2], [1.5], "all"]) assert.throws(() => EscapeWorld.restore({ ...saved, explored }));
});
function face(w, point) { w.data.player.angle = Math.atan2(point.z - w.data.player.z, point.x - w.data.player.x); }
function placeFor(w, id) {
  const obj = PROPS.find(p => p.id === id) ?? DOORS.find(d => d.id === id);
  const point = "kind" in obj ? obj : { x: obj.x + .5, z: obj.z + .5 };
  Object.assign(w.data.player, { x: point.x, z: point.z + 1 }); face(w, point); return point;
}

test("escape walls and doors really block motion and vision", () => {
  const w = new EscapeWorld(42);
  assert.equal(w.wall(11.5, 7.5), 2);
  assert.equal(w.lineOfSight({ x: 11.5, z: 8.5 }, { x: 11.5, z: 6.5 }), false);
  Object.assign(w.data.player, { x: 11.5, z: 8.5, angle: -Math.PI / 2 });
  assert.equal(w.nearest().id, "study"); w.interact();
  assert.equal(w.data.opened.includes("study"), false); assert.match(w.message, /黄铜/);
  w.data.inventory.push("brass"); w.interact(); assert.ok(w.data.opened.includes("study"));
  assert.ok(w.lineOfSight({ x: 11.5, z: 8.5 }, { x: 11.5, z: 6.5 }));
  Object.assign(w.data.player, { x: 19.5, z: 10.5, angle: Math.PI / 2 }); w.data.inventory.push("cellar");
  w.interact(); assert.match(w.message, /供电/); assert.equal(w.wall(19.5, 11.5), 2);
  w.data.power = true; w.interact(); assert.equal(w.wall(19.5, 11.5), 0);
  assert.equal(roomAt({ x: 4.5, z: 18.25 }), "洗衣间");
  assert.equal(roomAt({ x: 4.5, z: 18.75 }), "旧更衣室");
  assert.equal(roomAt({ x: 11.5, z: 18.75 }), "锅炉房");
  assert.equal(w.wall(4.5, 18.5), 2, "new room doors collide while closed");
  Object.assign(w.data.player, { x: 1.3, z: 3.5, angle: Math.PI }); frames(w, .5, { forward: 1 });
  assert.ok(w.data.player.x >= 1.18, "solid walls cannot be crossed");
});

test("search takes time, cancels on movement, and pickup cannot be duplicated", () => {
  const w = new EscapeWorld(42); placeFor(w, "bed-drawer"); w.interact();
  assert.ok(w.pending); assert.deepEqual(w.data.inventory, []); frames(w, .5);
  assert.deepEqual(w.data.inventory, []);
  w.data.player.z += 2; frames(w, .1); assert.equal(w.pending, undefined);
  placeFor(w, "bed-drawer"); w.interact(); frames(w, 1.2);
  assert.deepEqual(w.data.inventory, ["brass"]); w.interact(); frames(w, 2);
  assert.deepEqual(w.data.inventory, ["brass"]);
});

test("hearing accumulates for sprinting inside range, and walls block sight", () => {
  const w = new EscapeWorld(42); w.data.elapsed = 19;
  Object.assign(w.data.player, { x: 9.5, z: 9.5, angle: Math.PI, crouched: true, light: false });
  Object.assign(w.data.hunter, { x: 13.5, z: 9.5, angle: 0 });
  frames(w, .8, { forward: 1 }); assert.equal(w.data.hunter.state, "patrol");
  w.data.player.crouched = false; frames(w, .5, { forward: 1, sprint: true });
  assert.ok(w.data.hunt.noise > 0); assert.equal(w.hearing.action, "sprint");
  Object.assign(w.data.player, { x: 10.5, z: 5.5, light: true });
  Object.assign(w.data.hunter, { x: 12.5, z: 9.5, angle: -Math.PI / 2, state: "patrol" });
  assert.equal(w.seesPlayer(), false);
});

test("patrol recomputes its route at each stop and actually enters multiple rooms", () => {
  const w = new EscapeWorld(42), visited = new Set();
  placeFor(w, "bed-hide"); w.interact();
  for (let i = 0; i < 120 * 60; i++) {
    w.advance(1 / 60);
    const h = w.data.hunter;
    const room = roomAt(h);
    if (!["回声长廊", "门口"].includes(room)) visited.add(room);
  }
  assert.ok(visited.size >= 3, `dynamic patrol should visit several rooms: ${[...visited]}`);
});

test("hiding unseen is safe, hiding in plain sight is remembered across save/resume", () => {
  const w = new EscapeWorld(42); w.data.elapsed = 30;
  placeFor(w, "bed-hide"); Object.assign(w.data.hunter, { x: 12.5, z: 9.5, angle: 0 });
  const cabinet = PROPS.find(p => p.id === "bed-hide");
  w.interact(); assert.equal(w.data.hidden, "bed-hide"); assert.equal(w.seesPlayer(), false);
  assert.equal(w.data.player.x, cabinet.x); assert.equal(w.data.player.z, cabinet.z + .08,
    "hiding places the player inside the wardrobe footprint");
  const hiddenRestore = EscapeWorld.restore(w.snapshot());
  assert.equal(hiddenRestore.data.hidden, "bed-hide");
  assert.equal(hiddenRestore.data.player.x, cabinet.x); assert.equal(hiddenRestore.data.player.z, cabinet.z + .08,
    "restoring a hidden save keeps the player inside the wardrobe");
  frames(w, 5); assert.equal(w.data.phase, "playing");
  w.interact(); assert.equal(w.data.hidden, undefined);
  assert.equal(w.data.player.x, cabinet.x); assert.equal(w.data.player.z, cabinet.z + 1,
    "leaving the wardrobe returns the player one meter in front of its opening");
  placeFor(w, "bed-hide");
  Object.assign(w.data.hunter, { x: 5.5, z: 5.5, angle: -Math.PI / 2 });
  w.interact(); assert.equal(w.data.hidden, "bed-hide");
  const resumed = EscapeWorld.restore(w.snapshot());
  frames(resumed, 6); assert.equal(resumed.data.phase, "caught");
});

test("look pitch is required in current saves, clamped, and independent of yaw", () => {
  const original = new EscapeWorld(42).snapshot();
  delete original.player.pitch;
  assert.throws(() => EscapeWorld.restore(original), "old saves are not silently migrated");

  for (const pitch of [1.3001, -1.3001, NaN]) {
    const invalid = new EscapeWorld(42).snapshot();
    invalid.player.pitch = pitch;
    assert.throws(() => EscapeWorld.restore(invalid), "invalid pitch is rejected");
  }

  const w = new EscapeWorld(42), yaw = 2.1;
  w.data.player.angle = yaw;
  frames(w, 2, { look: 1 });
  assert.equal(w.data.player.pitch, 1.3, "looking up clamps at the upper pitch limit");
  assert.ok(Math.abs(w.data.player.angle - yaw) < 1e-12, "looking up leaves yaw unchanged");
  frames(w, 2, { look: -1 });
  assert.equal(w.data.player.pitch, -1.3, "looking down clamps at the lower pitch limit");
  assert.ok(Math.abs(w.data.player.angle - yaw) < 1e-12, "looking down leaves yaw unchanged");
});

test("hunter routes around drawers and wardrobes and can investigate furniture sounds", () => {
  const furniture = PROPS.filter(p => p.kind === "drawer" || p.kind === "wardrobe");
  const blocked = (point, radius = .23) => furniture.some(prop => {
    const half = prop.kind === "wardrobe" ? [.4, .29] : [.34, .25];
    return Math.abs(prop.x - point.x) < half[0] + radius
      && Math.abs(prop.z - point.z) < half[1] + radius;
  });

  for (const id of ["bed-drawer", "bed-hide"]) {
    const w = new EscapeWorld(42), obstacle = PROPS.find(p => p.id === id);
    Object.assign(w.data.hunter, { x: 3.5, z: 5.5 });
    const route = w.route(w.data.hunter, obstacle, true);
    assert.ok(route.length, `hunter can route to an interaction point at ${id}`);
    assert.ok(route.every(point => !blocked(point)), `hunter route stays clear of ${id} and other furniture`);
    assert.ok(Math.hypot(route.at(-1).x - obstacle.x, route.at(-1).z - obstacle.z) < 1.7,
      `hunter route ends within reach of ${id}`);
  }

  const w = new EscapeWorld(42), wardrobe = PROPS.find(p => p.id === "bed-hide");
  w.data.elapsed = 20;
  Object.assign(w.data.player, { x: 20.5, z: 20.5, light: false });
  Object.assign(w.data.hunter, { x: 3.5, z: 5.5, state: "patrol" });
  w.noise(wardrobe, 10);
  assert.equal(w.data.hunter.state, "investigate");
  const target = { ...w.target };
  assert.ok(!blocked(target), "furniture noise resolves to a reachable point outside the wardrobe");
  assert.ok(target.z > wardrobe.z && target.z - wardrobe.z < 1.7,
    "wardrobe sound is investigated from in front of its opening");
  assert.ok(w.route(w.data.hunter, target, true).length, "furniture sound has a traversable route");
  const startDistance = Math.hypot(w.data.hunter.x - target.x, w.data.hunter.z - target.z);
  for (let i = 0; i < 180; i++) {
    w.advance(1 / 60);
    assert.ok(!blocked(w.data.hunter), "hunter collision stays clear of furniture along the route");
  }
  const endDistance = Math.hypot(w.data.hunter.x - target.x, w.data.hunter.z - target.z);
  assert.ok(endDistance < .5 && endDistance < startDistance,
    "hunter reaches the sound point in front of the cabinet without getting stuck");
  assert.ok(!blocked(w.data.hunter), "hunter collision keeps it out of furniture while investigating");
});

test("capture preserves objective items, resets position, and ends on the third capture", () => {
  const oldPatrol = new EscapeWorld(42).snapshot(); oldPatrol.pursuit.patrolIndex = 3;
  const w = EscapeWorld.restore(oldPatrol); w.data.inventory = ["brass", "cellar"]; w.data.power = true;
  w.capture(); assert.equal(w.data.phase, "caught"); w.nextNight();
  assert.equal(w.data.phase, "playing"); assert.deepEqual(w.data.inventory, ["brass", "cellar"]); assert.ok(w.data.power);
  assert.equal(w.snapshot().pursuit.patrolIndex, 0);
  w.capture(); w.nextNight(); w.capture(); assert.equal(w.data.phase, "lost");
  const before = w.snapshot(); w.nextNight(); frames(w, 5, { forward: 1 }); assert.deepEqual(w.snapshot(), before);
});

test("stamina, battery and distractions are finite resources", () => {
  const w = new EscapeWorld(42); Object.assign(w.data.player, { x: 3.5, z: 5.5, angle: -Math.PI / 2 });
  frames(w, 4, { forward: 1, sprint: true }); assert.ok(w.data.player.stamina < 30);
  frames(w, 4); assert.ok(w.data.player.stamina > 50);
  w.data.player.battery = .01; frames(w, 1); assert.equal(w.data.player.battery, 0); assert.equal(w.data.player.light, false);
  w.throwStone(); w.throwStone(); w.throwStone(); assert.equal(w.data.stones, 0);
});

test("escape snapshots round-trip and reject invalid worlds without touching bath saves", () => {
  const w = new EscapeWorld(42); assert.deepEqual(EscapeWorld.restore(w.snapshot()).snapshot(), w.snapshot());
  for (const edit of [d => d.player.x = NaN, d => d.player.z = 0, d => d.inventory.push("root"), d => d.opened.push("cellar"), d => d.hidden = "bed-drawer", d => d.pursuit.seenHide = "missing", d => d.player.stamina = -1, d => d.captures = 4, d => d.phase = "won", d => d.power = true, d => d.debug = true]) {
    const data = w.snapshot(); edit(data); assert.throws(() => EscapeWorld.restore(data));
  }
});

test("the exit requires drained water and real cutters, not just reaching the south wall", () => {
  const w = new EscapeWorld(42); placeFor(w, "exit"); w.data.player.z = 21.65; face(w, PROPS.find(p => p.id === "exit"));
  w.interact(); assert.equal(w.data.phase, "playing"); assert.match(w.message, /排水/);
  w.data.drained = true; w.interact(); assert.match(w.message, /断线钳/);
  w.data.inventory.push("cutters"); w.interact(); assert.equal(w.data.phase, "playing"); assert.match(w.message, /负一楼/);
  w.data.basement.sluice = true; w.interact(); assert.equal(w.data.phase, "won");
});

test("the expansion requires the handwheel and the exact powered boiler sequence", () => {
  const w = new EscapeWorld(42);
  w.data.inventory.push("fuse"); w.data.power = true;
  for (const id of ["valve-cold", "valve-return", "valve-vent"]) {
    placeFor(w, id); w.interact(); assert.match(w.message, /手轮/);
  }
  w.data.inventory.push("handwheel"); w.data.searched.push("changing-drawer");
  placeFor(w, "valve-return"); w.interact();
  assert.deepEqual(w.data.expansion.valves, []); assert.match(w.message, /顺序错了/);
  placeFor(w, "valve-cold"); w.interact(); placeFor(w, "valve-return"); w.interact(); placeFor(w, "valve-vent"); w.interact();
  assert.deepEqual(w.data.expansion.valves, ["valve-cold", "valve-return", "valve-vent"]);
  placeFor(w, "valve-return"); w.interact();
  assert.deepEqual(w.data.expansion.valves, ["valve-cold", "valve-return", "valve-vent"], "completed valves cannot be reset by extra interactions");
  placeFor(w, "drain"); w.interact(); assert.equal(w.data.drained, true);
  const saved = w.snapshot(); assert.deepEqual(EscapeWorld.restore(saved).snapshot(), saved);
  for (const mutate of [d => d.expansion.valves = ["valve-return"], d => d.expansion.valves.push("valve-vent"), d => d.expansion.valves = ["valve-cold"], d => d.expansion.extra = true, d => d.inventory = d.inventory.filter(i => i !== "handwheel")]) {
    const invalid = structuredClone(saved); mutate(invalid); assert.throws(() => EscapeWorld.restore(invalid));
  }
});

test("only current snapshots are accepted, including the complete basement objective state", () => {
  const fresh=new EscapeWorld(42).snapshot();assert.equal(fresh.version,2);assert.deepEqual(EscapeWorld.restore(fresh).snapshot(),fresh);
  assert.throws(()=>EscapeWorld.restore({...fresh,version:1}));
  for(const key of ["expansion","hunt","abilities","basement"]){const invalid=structuredClone(fresh);delete invalid[key];assert.throws(()=>EscapeWorld.restore(invalid));}
  for(const item of ["hand-wheel","rusty-wheel","valve-cold"]){const invalid=structuredClone(fresh);invalid.inventory.push(item);assert.throws(()=>EscapeWorld.restore(invalid));}
});

test("malformed optional save extensions fail with the normal format error", () => {
  const base = new EscapeWorld(42).snapshot();
  const invalidExpansion = structuredClone(base); invalidExpansion.expansion = null;
  assert.throws(() => EscapeWorld.restore(invalidExpansion), /逃生存档格式不正确/);
  const legacy = structuredClone(base); delete legacy.expansion; legacy.pursuit.target = null;
  assert.throws(() => EscapeWorld.restore(legacy), /逃生存档格式不正确/);
});

test("glass hazards trigger once on walking, stay quiet when crouched and rearm after leaving", () => {
  const w = new EscapeWorld(42); w.data.elapsed = 20;
  Object.assign(w.data.player, { x: 6.9, z: 9.5, angle: 0, light: false });
  w.data.hunter.x = 12.5; w.data.hunter.z = 9.5;
  frames(w, .5, { forward: 1 });
  assert.match(w.message, /碎玻璃/); assert.ok(w.data.hunt.noise > 0, "heard glass adds distance-attenuated sound evidence");
  const events = w.drainEvents(); assert.equal(events.filter(e => e.type === "noise").length, 1);
  frames(w, .5, { forward: 1 }); assert.equal(w.drainEvents().filter(e => e.type === "noise").length, 0);
  const quiet = new EscapeWorld(42);
  Object.assign(quiet.data.player, { x: 6.9, z: 9.5, angle: 0, crouched: true, light: false });
  Object.assign(quiet.data.hunter, { x: 13.5, z: 14.5, state: "patrol" }); quiet.data.elapsed = 17;
  frames(quiet, .95, { forward: 1 }); assert.ok(quiet.data.player.x > 7.5);
  assert.equal(quiet.drainEvents().filter(e => e.type === "noise").length, 0); assert.equal(quiet.data.hunter.state, "patrol");
});

// Complete current v2 active-AI routes live in basement-play.test.mjs.
