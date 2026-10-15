import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AudioManager } from "../src/audio.ts";
import { defaultSettings } from "../src/settings.ts";
import { victoryPose } from "../src/game/character.ts";

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness(t, settings = {}) {
  const original = { document: globalThis.document, window: globalThis.window };
  const document = new EventTarget();
  document.hidden = false;
  let nextId = 1;
  const timeouts = new Map(), intervals = new Map();
  const param = () => ({
    values: [],
    setValueAtTime(value) { this.values.push(value); },
    exponentialRampToValueAtTime(value) { this.values.push(value); },
    linearRampToValueAtTime(value) { this.values.push(value); },
    setTargetAtTime(value) { this.values.push(value); },
  });
  class Context {
    static instances = [];
    static rejectResume = false;
    state = "suspended";
    currentTime = 0;
    destination = {};
    oscillators = [];
    gains = [];
    resumes = 0;
    constructor() { Context.instances.push(this); }
    async resume() {
      this.resumes++;
      if (Context.rejectResume) throw new Error("gesture required");
      await Promise.resolve();
      this.state = "running";
    }
    async suspend() { this.state = "suspended"; }
    async close() { this.state = "closed"; }
    createOscillator() {
      assert.equal(this.state, "running", "never schedule a silent suspended voice");
      const node = { frequency: param(), stopped: false, connected: undefined,
        connect(destination) { this.connected = destination; },
        start() {}, stop() { this.stopped = true; }, disconnect() { this.connected = undefined; } };
      this.oscillators.push(node); return node;
    }
    createGain() {
      const node = { gain: param(), connected: undefined,
        connect(destination) { this.connected = destination; },
        disconnect() { this.connected = undefined; } };
      this.gains.push(node); return node;
    }
  }
  globalThis.document = document;
  globalThis.window = { AudioContext: Context,
    setTimeout(callback) { const id = nextId++; timeouts.set(id, callback); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(callback) { const id = nextId++; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); } };
  const manager = new AudioManager({ ...defaultSettings(), vibration: false, ...settings });
  t.after(() => { manager.dispose(); Object.assign(globalThis, original); });
  return { manager, Context, document, timeouts, intervals };
}

test("victory begins with the preserved belly laugh, including reduced motion", () => {
  const atlas = JSON.parse(fs.readFileSync(new URL("../public/assets/character/atlas.json", import.meta.url)));
  assert.equal(atlas.frames.find(frame => frame.index === 6).name, "laugh");
  for (const time of [0, .2, 1, 3.5, 6, 7, 60]) assert.equal(victoryPose(time), 6);
  assert.equal(victoryPose(4), 7);
  assert.equal(victoryPose(5), 11);
  for (const time of [0, 4, 5, 7, 99]) assert.equal(victoryPose(time, true), 6);
});
test("first sound resumes before scheduling and reaches the output", async t => {
  const { manager, Context } = harness(t);
  manager.effect("tap");
  const context = Context.instances[0];
  assert.equal(context.oscillators.length, 0);
  await settle();
  assert.equal(context.state, "running");
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].connected, context.gains[0]);
  assert.equal(context.gains[0].connected, context.destination);
  assert.equal(Math.max(...context.gains[0].gain.values), .12);
});
test("blocked audio reports failure and a later user preview can retry", async t => {
  const { manager, Context } = harness(t, { sound: false, music: false });
  Context.rejectResume = true;
  assert.equal(await manager.preview("sound"), false);
  assert.equal(Context.instances[0].oscillators.length, 0);
  Context.rejectResume = false;
  assert.equal(await manager.preview("sound"), true);
  const context = Context.instances[0];
  assert.equal(context.oscillators.length, 1);
  manager.stopPreview();
  assert.equal(context.gains[0].connected, undefined);
  manager.effect("coin");
  await settle();
  assert.equal(context.oscillators.length, 1, "preview must not silently enable the saved sound preference");
});
test("music follows play, pause and mute without cutting a menu tap", async t => {
  const { manager, Context, intervals } = harness(t, { music: true });
  manager.setPlaying(true);
  await manager.unlock();
  const context = Context.instances[0];
  assert.equal(intervals.size, 1);
  assert.equal(Math.max(...context.gains[0].gain.values), .05);
  manager.setPlaying(false);
  assert.equal(intervals.size, 0);
  manager.effect("tap");
  manager.setPlaying(false);
  assert.equal(context.gains[1].connected, context.destination);
  manager.setPlaying(true);
  assert.equal(intervals.size, 1);
  manager.setSettings({ ...defaultSettings(), music: false, sound: false });
  assert.equal(intervals.size, 0);
  assert.ok(context.gains.every(gain => gain.connected === undefined));
});
test("music preview works outside play, expires and cancels on dialog exit", async t => {
  const { manager, Context, intervals, timeouts } = harness(t);
  assert.equal(await manager.preview("music"), true);
  assert.equal(intervals.size, 1);
  const expire = [...timeouts.values()][0]; timeouts.clear(); expire();
  assert.equal(intervals.size, 0);
  assert.equal(await manager.preview("music"), true);
  manager.stopPreview();
  assert.equal(timeouts.size, 0);
  assert.equal(intervals.size, 0);
  assert.ok(Context.instances[0].gains.every(gain => gain.connected === undefined));
});
test("leaving while resume is pending cannot start a late preview", async t => {
  const { manager, Context, intervals } = harness(t);
  const pending = manager.preview("music");
  manager.stopPreview();
  assert.equal(await pending, false);
  assert.equal(intervals.size, 0);
  assert.equal(Context.instances[0].oscillators.length, 0);
});
test("background and page suspension stop output and restore enabled music", async t => {
  const { manager, Context, document, intervals } = harness(t, { music: true });
  manager.setPlaying(true); await manager.unlock(); manager.effect("coin");
  document.hidden = true; document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(intervals.size, 0);
  assert.ok(Context.instances[0].gains.every(gain => gain.connected === undefined));
  Context.instances[0].state = "interrupted";
  document.hidden = false; document.dispatchEvent(new Event("visibilitychange"));
  await settle(); assert.equal(intervals.size, 1);
  manager.suspend(); assert.equal(intervals.size, 0);
  manager.resume(); await settle(); assert.equal(intervals.size, 1);
  manager.dispose(); assert.equal(intervals.size, 0);
  document.dispatchEvent(new Event("visibilitychange")); await settle();
  assert.equal(Context.instances[0].state, "closed");
});
