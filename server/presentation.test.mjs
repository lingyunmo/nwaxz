import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AudioManager } from "../src/audio.ts";
import { defaultSettings } from "../src/settings.ts";
import { victoryPose } from "../src/game/character.ts";

const settle = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
function harness(t, settings = {}) {
  const original = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch };
  const document = new EventTarget();
  document.hidden = false;
  let nextId = 1;
  const timeouts = new Map();
  const download = { requests: [], reject: false, wait: undefined };
  globalThis.fetch = async url => {
    download.requests.push(url);
    if (download.wait) await download.wait;
    if (download.reject) throw new Error("unavailable");
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
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
    sources = [];
    gains = [];
    resumes = 0;
    decodes = 0;
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
    async decodeAudioData() { this.decodes++; return { duration: 41.739138 }; }
    createBufferSource() {
      assert.equal(this.state, "running");
      const node = { stopped: false, connected: undefined, offset: undefined,
        connect(destination) { this.connected = destination; },
        start(_when, offset) { this.offset = offset; },
        stop() { this.stopped = true; }, disconnect() { this.connected = undefined; } };
      this.sources.push(node); return node;
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
    clearTimeout(id) { timeouts.delete(id); } };
  const manager = new AudioManager({ ...defaultSettings(), vibration: false, ...settings });
  t.after(() => { manager.dispose(); Object.assign(globalThis, original); });
  return { manager, Context, document, timeouts, download };
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
  const { manager, Context, download } = harness(t, { music: true });
  manager.setPlaying(true);
  await manager.unlock(); await settle();
  const context = Context.instances[0];
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].loop, true);
  assert.equal(context.sources[0].buffer.duration, 41.739138);
  assert.equal(context.sources[0].connected, context.gains[0]);
  assert.equal(context.gains[0].connected, context.destination);
  assert.equal(Math.max(...context.gains[0].gain.values), .65);
  context.currentTime = context.sources[0].buffer.duration + 7;
  manager.setPlaying(false);
  assert.equal(context.sources[0].stopped, true);
  manager.effect("tap");
  manager.setPlaying(false);
  assert.equal(context.gains[1].connected, context.destination);
  manager.setPlaying(true);
  assert.equal(context.sources.length, 2);
  assert.ok(Math.abs(context.sources[1].offset - 7) < 1e-9, "resume the paused position after wrapping a full loop");
  assert.equal(context.decodes, 1);
  assert.deepEqual(download.requests, ["/assets/audio/bubble-day-soft-v1.mp3"]);
  manager.setSettings({ ...defaultSettings(), music: false, sound: false });
  assert.equal(context.sources[1].stopped, true);
  assert.ok(context.gains.every(gain => gain.connected === undefined));
});
test("music preview works outside play, expires and cancels on dialog exit", async t => {
  const { manager, Context, timeouts } = harness(t);
  assert.equal(await manager.preview("music"), true);
  const context = Context.instances[0];
  assert.equal(context.sources.length, 1);
  const expire = [...timeouts.values()][0]; timeouts.clear(); expire();
  assert.equal(context.sources[0].stopped, true);
  assert.equal(await manager.preview("music"), true);
  manager.stopPreview();
  assert.equal(timeouts.size, 0);
  assert.equal(context.sources[1].stopped, true);
  assert.ok(context.gains.every(gain => gain.connected === undefined));
});
test("leaving while resume is pending cannot start a late preview", async t => {
  const { manager, Context, download } = harness(t);
  const pending = manager.preview("music");
  manager.stopPreview();
  assert.equal(await pending, false);
  assert.equal(download.requests.length, 0);
  assert.equal(Context.instances[0].sources.length, 0);
  assert.equal(Context.instances[0].oscillators.length, 0);
});
test("background and page suspension stop output and restore enabled music", async t => {
  const { manager, Context, document } = harness(t, { music: true });
  manager.setPlaying(true); await manager.unlock(); await settle(); manager.effect("coin");
  const context = Context.instances[0];
  document.hidden = true; document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(context.sources[0].stopped, true);
  assert.ok(context.gains.every(gain => gain.connected === undefined));
  context.state = "interrupted";
  document.hidden = false; document.dispatchEvent(new Event("visibilitychange"));
  await settle(); assert.equal(context.sources.length, 2);
  manager.suspend(); assert.equal(context.sources.at(-1).stopped, true);
  manager.resume(); await settle(); assert.equal(context.sources.at(-1).stopped, false);
  manager.dispose(); assert.ok(context.sources.every(source => source.stopped));
  document.dispatchEvent(new Event("visibilitychange")); await settle();
  assert.equal(Context.instances[0].state, "closed");
});
test("a delayed recording cannot start after pause, preview exit or disposal", async t => {
  const { manager, Context, download } = harness(t, { music: true });
  let finish;
  download.wait = new Promise(resolve => { finish = resolve; });
  manager.setPlaying(true); await manager.unlock();
  manager.setPlaying(false);
  const preview = manager.preview("music"); await settle();
  manager.stopPreview();
  finish();
  assert.equal(await preview, false);
  await settle();
  assert.equal(Context.instances[0].sources.length, 0);
  assert.equal(download.requests.length, 1, "share an in-flight recording download");
  manager.setPlaying(true);
  assert.equal(Context.instances[0].sources.length, 1);
  manager.dispose(); await settle();
  assert.ok(Context.instances[0].sources.every(source => source.stopped));
});
test("an unavailable recording reports preview failure and can retry without changing settings", async t => {
  const { manager, Context, download } = harness(t, { music: false, sound: false });
  download.reject = true;
  assert.equal(await manager.preview("music"), false);
  assert.equal(Context.instances[0].sources.length, 0);
  download.reject = false;
  assert.equal(await manager.preview("music"), true);
  assert.equal(download.requests.length, 2);
  manager.stopPreview();
  manager.setPlaying(true);
  assert.equal(Context.instances[0].sources.length, 1, "preview must not enable the saved music preference");
  assert.equal(Context.instances[0].sources[0].stopped, true);
});
test("disposing while the recording downloads never decodes or schedules late audio", async t => {
  const { manager, Context, download } = harness(t, { music: true });
  let finish;
  download.wait = new Promise(resolve => { finish = resolve; });
  manager.setPlaying(true); await manager.unlock();
  manager.dispose();
  finish(); await settle();
  assert.equal(Context.instances[0].decodes, 0);
  assert.equal(Context.instances[0].sources.length, 0);
  assert.equal(Context.instances[0].state, "closed");
});

test("switching modes uses separate recordings, stops haunted voices and restores piano", async t => {
  const { manager, Context, download } = harness(t, { music: true });
  manager.setPlaying(true); await manager.unlock(); await settle();
  const context = Context.instances[0], piano = context.sources[0];
  context.currentTime = 8;
  manager.setMode("horror"); await settle();
  assert.ok(piano.stopped);
  const ambient = context.sources.at(-1);
  assert.equal(ambient.offset, 0); assert.equal(ambient.loopEnd, 32);
  manager.haunt(); await settle();
  const laugh = context.sources.at(-1);
  assert.notEqual(laugh, ambient); assert.ok(!laugh.loop);
  manager.setPlaying(false);
  assert.ok(laugh.stopped); assert.ok(ambient.stopped);
  manager.setMode("normal"); manager.setPlaying(true); await settle();
  assert.equal(context.sources.at(-1).buffer, piano.buffer);
  assert.equal(download.requests.filter(url => url.includes("bubble-day")).length, 1);
  assert.ok(download.requests.includes("/assets/audio/haunted-bath-v1.mp3"));
  assert.ok(download.requests.includes("/assets/audio/haunted-laugh-v1.mp3"));
});

test("delayed haunted laughter cannot escape pause, mute or a mode change", async t => {
  const { manager, Context, download } = harness(t, { music: false });
  manager.setMode("horror"); await manager.unlock();
  let finish;
  download.wait = new Promise(resolve => { finish = resolve; });
  manager.haunt(); await settle();
  manager.setPlaying(false); finish(); await settle();
  assert.equal(Context.instances[0].sources.length, 0);
  manager.haunt(); await settle(); assert.equal(Context.instances[0].sources.length, 1);
  manager.setSettings({ ...defaultSettings(), sound: false });
  assert.ok(Context.instances[0].sources[0].stopped);
  manager.haunt(); await settle(); assert.equal(Context.instances[0].sources.length, 1);
  manager.setMode("normal");
  assert.equal(await manager.preview("sound"), true);
  assert.equal(Context.instances[0].sources.length, 1, "normal preview uses normal synthesized effect");
});
