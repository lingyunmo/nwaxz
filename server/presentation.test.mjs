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
  const listeners = new Map(), add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
  document.addEventListener = (name, fn, options) => { listeners.set(name, fn); add(name, fn, options); };
  document.removeEventListener = (name, fn, options) => { if (listeners.get(name) === fn) listeners.delete(name); remove(name, fn, options); };
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
  return { manager, Context, document, timeouts, download, listeners };
}

function phoneNavigator(t, extra = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const nav = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 1, ...extra };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: nav });
  t.after(() => { if (original) Object.defineProperty(globalThis, "navigator", original); else delete globalThis.navigator; });
  return nav;
}
function legacyPlayer() {
  return class {
    static instances = [];
    static reject = false;
    paused = true; loop = false; plays = 0; loads = 0;
    constructor(src) { this.src = src; this.constructor.instances.push(this); }
    setAttribute() {}
    removeAttribute(name) { if (name === "src") this.src = ""; }
    play() {
      this.plays++;
      if (this.constructor.reject) return Promise.reject(new Error("gesture required"));
      this.paused = false; return Promise.resolve();
    }
    pause() { this.paused = true; }
    load() { this.loads++; }
  };
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

test("iPhone requests media playback, recovers a stale session, and releases on hide", async t => {
  const { manager, document } = harness(t), assignments = [];
  let category = "auto";
  const session = { get type() { return category; }, set type(value) { assignments.push(value); category = value; } };
  phoneNavigator(t, { audioSession: session });
  assert.equal(await manager.preview("sound"), true);
  assert.equal(category, "playback", "running WebAudio must use the media session instead of ambient/ringer");
  assignments.length = 0;
  assert.equal(await manager.recover(), true);
  assert.ok(assignments.includes("auto")); assert.equal(assignments.at(-1), "playback");
  document.hidden = true; document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(category, "auto");
  document.hidden = false; document.dispatchEvent(new Event("visibilitychange"));
  await settle(); assert.equal(category, "playback");
  manager.dispose(); assert.equal(category, "auto");
});

test("a hung pointerdown resume does not swallow the next trusted touchend or click", async t => {
  const { manager, Context, listeners, timeouts } = harness(t);
  const original = Context.prototype.resume;
  Context.prototype.resume = function() {
    if (!this.resumes) { this.resumes++; return new Promise(() => {}); }
    return original.call(this);
  };
  const first = manager.unlock(), context = Context.instances[0];
  listeners.get("touchend")({ isTrusted: true });
  assert.equal(context.resumes, 2, "retry resume synchronously inside touchend");
  await settle(); assert.equal(context.state, "running");
  assert.ok(listeners.has("pointerup") && listeners.has("click"));
  for (const callback of timeouts.values()) callback();
  assert.equal(await first, false, "a blocked attempt has a bounded failure instead of hanging the UI");
  assert.equal(await manager.preview("sound"), true);
  manager.dispose();
  for (const event of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) assert.equal(listeners.has(event), false);
});

test("closed and prefixed WebKit audio contexts can be unlocked again", async t => {
  const { manager, Context } = harness(t);
  globalThis.window.webkitAudioContext = Context;
  delete globalThis.window.AudioContext;
  assert.equal(await manager.preview("sound"), true);
  Context.instances[0].state = "closed";
  assert.equal(await manager.recover(), true);
  assert.equal(Context.instances.length, 2);
  assert.equal(Context.instances[1].state, "running");
});

test("older iOS reuses one silent media bridge and stops it on pause, mute, hide and disposal", async t => {
  const { manager, document } = harness(t, { music: true });
  phoneNavigator(t);
  const Player = legacyPlayer(); globalThis.window.Audio = Player;
  manager.setPlaying(true); await manager.unlock(); await settle();
  const media = Player.instances[0];
  assert.equal(media.src, "/assets/audio/ios-session-v1.mp3");
  assert.equal(media.loop, true); assert.equal(media.paused, false);
  await manager.unlock(); assert.equal(Player.instances.length, 1);
  manager.setPlaying(false); assert.equal(media.paused, true);
  manager.setPlaying(true); await manager.unlock(); assert.equal(media.paused, false);
  manager.setSettings({ ...defaultSettings(), music: false, sound: false }); assert.equal(media.paused, true);
  assert.equal(await manager.preview("sound"), true, "explicit preview remains available with both saved switches off");
  document.hidden = true; document.dispatchEvent(new Event("visibilitychange")); assert.equal(media.paused, true);
  manager.dispose(); assert.equal(media.src, ""); assert.equal(media.loads, 1);
});

test("restricted iOS AudioSession falls back without an unhandled media rejection", async t => {
  const { manager } = harness(t);
  phoneNavigator(t, { audioSession: { set type(_) { throw new Error("unsupported"); } } });
  const Player = legacyPlayer(); globalThis.window.Audio = Player; Player.reject = true;
  assert.equal(await manager.preview("sound"), true);
  await settle(); assert.equal(Player.instances[0].paused, true);
  Player.reject = false;
  assert.equal(await manager.recover(), true);
  assert.equal(Player.instances.length, 1); assert.equal(Player.instances[0].paused, false);
});

test("desktop browsers do not start an unnecessary silent media loop", async t => {
  const { manager } = harness(t);
  phoneNavigator(t, { userAgent: "Mozilla/5.0 Windows Chrome", platform: "Win32", maxTouchPoints: 0 });
  const Player = legacyPlayer(); globalThis.window.Audio = Player;
  assert.equal(await manager.preview("sound"), true);
  assert.equal(Player.instances.length, 0);
});

test("a failed iOS music preview releases the silent bridge instead of looping in a menu", async t => {
  const { manager, download } = harness(t);
  phoneNavigator(t); const Player = legacyPlayer(); globalThis.window.Audio = Player;
  download.reject = true;
  assert.equal(await manager.preview("music"), false);
  assert.equal(Player.instances[0].paused, true);
});

test("music resumed by an asynchronous dialog close reactivates iOS media playback", async t => {
  const { manager, Context } = harness(t, { music: true }), session = { type: "auto" };
  phoneNavigator(t, { audioSession: session });
  manager.setPlaying(true); await manager.unlock(); await settle();
  assert.equal(session.type, "playback");
  manager.setPlaying(false); assert.equal(session.type, "auto");
  // No fresh pointer/touch event here: the queued dialog close resumes play.
  manager.setPlaying(true);
  assert.equal(session.type, "playback");
  assert.equal(Context.instances[0].sources.length, 2);
});

test("a delayed horror preview keeps the iOS bridge until the laugh has loaded", async t => {
  const { manager, download } = harness(t);
  phoneNavigator(t); const Player = legacyPlayer(); globalThis.window.Audio = Player;
  manager.setMode("horror");
  let finish; download.wait = new Promise(resolve => { finish = resolve; });
  const pending = manager.preview("sound"); await settle();
  assert.equal(Player.instances[0].paused, false, "do not release the media session in an early async finally");
  finish(); assert.equal(await pending, true);
  assert.equal(Player.instances[0].paused, false);
  manager.stopPreview(); assert.equal(Player.instances[0].paused, true);
});
