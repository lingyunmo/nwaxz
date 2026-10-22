import { test } from "node:test";
import assert from "node:assert/strict";
import { EscapeWorld, PROPS, DOORS, MAP } from "../src/escape/world.ts";

const frames = (w, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) w.advance(1 / 60, input); };
function face(w, point) { w.data.player.angle = Math.atan2(point.z - w.data.player.z, point.x - w.data.player.x); }
function placeFor(w, id) {
  const obj = PROPS.find(p => p.id === id) ?? DOORS.find(d => d.id === id);
  const point = "kind" in obj ? obj : { x: obj.x + .5, z: obj.z + .5 };
  Object.assign(w.data.player, { x: point.x, z: point.z + 1 }); face(w, point); return point;
}

test("escape walls and both keyed doors really block motion and vision", () => {
  const w = new EscapeWorld();
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
  Object.assign(w.data.player, { x: 1.3, z: 3.5, angle: Math.PI }); frames(w, .5, { forward: 1 });
  assert.ok(w.data.player.x >= 1.18, "solid walls cannot be crossed");
});

test("search takes time, cancels on movement, and pickup cannot be duplicated", () => {
  const w = new EscapeWorld(); placeFor(w, "bed-drawer"); w.interact();
  assert.ok(w.pending); assert.deepEqual(w.data.inventory, []); frames(w, .5);
  assert.deepEqual(w.data.inventory, []);
  w.data.player.z += 2; frames(w, .1); assert.equal(w.pending, undefined);
  placeFor(w, "bed-drawer"); w.interact(); frames(w, 1.2);
  assert.deepEqual(w.data.inventory, ["brass"]); w.interact(); frames(w, 2);
  assert.deepEqual(w.data.inventory, ["brass"]);
});

test("hunter hears sprinting but not crouching, and walls block sight", () => {
  const w = new EscapeWorld(); w.data.elapsed = 19;
  Object.assign(w.data.player, { x: 9.5, z: 9.5, angle: Math.PI, crouched: true, light: false });
  Object.assign(w.data.hunter, { x: 12.5, z: 9.5, angle: 0 });
  frames(w, .8, { forward: 1 }); assert.equal(w.data.hunter.state, "patrol");
  w.data.player.crouched = false; frames(w, .5, { forward: 1, sprint: true });
  assert.ok(["investigate", "chase"].includes(w.data.hunter.state));
  Object.assign(w.data.player, { x: 10.5, z: 5.5, light: true });
  Object.assign(w.data.hunter, { x: 12.5, z: 9.5, angle: -Math.PI / 2, state: "patrol" });
  assert.equal(w.seesPlayer(), false);
});

test("patrol recomputes its route at each stop and actually enters multiple rooms", () => {
  const w = new EscapeWorld(), visited = new Set();
  placeFor(w, "bed-hide"); w.interact();
  for (let i = 0; i < 120 * 60; i++) {
    w.advance(1 / 60);
    const h = w.data.hunter;
    if (h.x > 17 && h.z < 7) visited.add("infirmary");
    if (h.x < 7 && h.z > 12) visited.add("laundry");
  }
  assert.ok(visited.has("infirmary")); assert.ok(visited.has("laundry"));
});

test("hiding unseen is safe, hiding in plain sight is remembered across save/resume", () => {
  const w = new EscapeWorld(); w.data.elapsed = 30;
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

test("look pitch is backward-compatible, clamped, and independent of yaw", () => {
  const original = new EscapeWorld().snapshot();
  delete original.player.pitch;
  const restored = EscapeWorld.restore(original);
  assert.equal(restored.data.player.pitch, 0, "legacy v1 saves default missing pitch to level");

  for (const pitch of [1.3001, -1.3001, NaN]) {
    const invalid = new EscapeWorld().snapshot();
    invalid.player.pitch = pitch;
    assert.throws(() => EscapeWorld.restore(invalid), "invalid pitch is rejected");
  }

  const w = new EscapeWorld(), yaw = 2.1;
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
    const w = new EscapeWorld(), obstacle = PROPS.find(p => p.id === id);
    Object.assign(w.data.hunter, { x: 3.5, z: 5.5 });
    const route = w.route(w.data.hunter, obstacle, true);
    assert.ok(route.length, `hunter can route to an interaction point at ${id}`);
    assert.ok(route.every(point => !blocked(point)), `hunter route stays clear of ${id} and other furniture`);
    assert.ok(Math.hypot(route.at(-1).x - obstacle.x, route.at(-1).z - obstacle.z) < 1.7,
      `hunter route ends within reach of ${id}`);
  }

  const w = new EscapeWorld(), wardrobe = PROPS.find(p => p.id === "bed-hide");
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
  const oldPatrol = new EscapeWorld().snapshot(); oldPatrol.pursuit.patrolIndex = 3;
  const w = EscapeWorld.restore(oldPatrol); w.data.inventory = ["brass", "cellar"]; w.data.power = true;
  w.capture(); assert.equal(w.data.phase, "caught"); w.nextNight();
  assert.equal(w.data.phase, "playing"); assert.deepEqual(w.data.inventory, ["brass", "cellar"]); assert.ok(w.data.power);
  assert.equal(w.snapshot().pursuit.patrolIndex, 0);
  w.capture(); w.nextNight(); w.capture(); assert.equal(w.data.phase, "lost");
  const before = w.snapshot(); w.nextNight(); frames(w, 5, { forward: 1 }); assert.deepEqual(w.snapshot(), before);
});

test("stamina, battery and distractions are finite resources", () => {
  const w = new EscapeWorld(); Object.assign(w.data.player, { x: 3.5, z: 5.5, angle: -Math.PI / 2 });
  frames(w, 4, { forward: 1, sprint: true }); assert.ok(w.data.player.stamina < 30);
  frames(w, 4); assert.ok(w.data.player.stamina > 50);
  w.data.player.battery = .01; frames(w, 1); assert.equal(w.data.player.battery, 0); assert.equal(w.data.player.light, false);
  w.throwStone(); w.throwStone(); w.throwStone(); assert.equal(w.data.stones, 0);
});

test("escape snapshots round-trip and reject invalid worlds without touching bath saves", () => {
  const w = new EscapeWorld(); assert.deepEqual(EscapeWorld.restore(w.snapshot()).snapshot(), w.snapshot());
  for (const edit of [d => d.player.x = NaN, d => d.player.z = 0, d => d.inventory.push("root"), d => d.opened.push("cellar"), d => d.hidden = "bed-drawer", d => d.pursuit.seenHide = "missing", d => d.player.stamina = -1, d => d.captures = 4, d => d.phase = "won", d => d.power = true, d => d.debug = true]) {
    const data = w.snapshot(); edit(data); assert.throws(() => EscapeWorld.restore(data));
  }
});

test("the exit requires drained water and real cutters, not just reaching the south wall", () => {
  const w = new EscapeWorld(); placeFor(w, "exit"); w.data.player.z = 21.65; face(w, PROPS.find(p => p.id === "exit"));
  w.interact(); assert.equal(w.data.phase, "playing"); assert.match(w.message, /排水/);
  w.data.drained = true; w.interact(); assert.match(w.message, /断线钳/);
  w.data.inventory.push("cutters"); w.interact(); assert.equal(w.data.phase, "won");
});

// A continuous input route with active patrol/vision/hearing: no teleports,
// no injected inventory, no disabled enemy. This is the reference escape route.
test("a complete continuous route can escape with the hunter active", () => {
  const w = new EscapeWorld(); w.toggleLight();
  function approach(point) {
    const candidates = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dz]) => ({ x: point.x + dx, z: point.z + dz })).filter(p => !w.wall(p.x, p.z));
    const routes = candidates.map(target => ({ target, path: w.route(w.data.player, target) })).filter(r => r.path.length || Math.floor(w.data.player.x) === Math.floor(r.target.x) && Math.floor(w.data.player.z) === Math.floor(r.target.z)).sort((a, b) => a.path.length - b.path.length);
    assert.ok(routes.length, `no legal path to ${JSON.stringify(point)}`);
    const route = routes[0];
    for (const target of [...route.path, route.target]) {
      for (let i = 0; i < 500 && Math.hypot(w.data.player.x - target.x, w.data.player.z - target.z) > .08; i++) {
        if (w.data.phase !== "playing") return false;
        face(w, target); w.advance(1 / 60, { forward: 1, sprint: w.data.hunter.state === "chase" });
      }
    }
    face(w, point); return true;
  }
  const order = ["bed-drawer", "study", "study-drawer", "laundry-drawer", "power", "cellar", "cellar-drawer", "drain", "exit"];
  for (const id of order) {
    let done = false;
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      if (w.data.phase === "caught") w.nextNight();
      assert.notEqual(w.data.phase, "lost", `lost before ${id}`);
      const object = PROPS.find(o => o.id === id), door = DOORS.find(o => o.id === id), point = object ?? { x: door.x + .5, z: door.z + .5 };
      if (!approach(point)) continue;
      assert.equal(w.nearest()?.id, id, `wrong interaction near ${id}`);
      w.interact(); if (object?.kind === "drawer") frames(w, 1.2);
      done = w.data.phase === "playing" || w.data.phase === "won";
    }
    assert.ok(done, `did not finish ${id}`);
    if (id === "power") {
      const cabinet = PROPS.find(p => p.id === "workshop-hide");
      if (approach(cabinet)) {
        w.interact();
        if (w.data.hidden) {
          for (let i = 0; i < 3600; i++) {
            w.advance(1 / 60);
            if (w.data.hunter.state === "patrol" && Math.hypot(w.data.hunter.x - w.data.player.x, w.data.hunter.z - w.data.player.z) > 5) break;
          }
          w.interact();
        }
      }
    }
  }
  assert.equal(w.data.phase, "won"); assert.deepEqual(w.data.inventory.sort(), ["brass", "cellar", "cutters", "fuse"]);
  assert.ok(w.data.elapsed > 30); assert.ok(w.data.captures < 3);
  assert.ok(MAP[22][20] === 0);
});
