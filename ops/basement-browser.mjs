import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createApp } from '../server/app.mjs';
import { EscapeWorld } from '../src/escape/world.ts';
import { SAVE_GENERATION, SAVE_GENERATION_KEY } from '../src/save-generation.ts';
import { floorAt } from '../src/escape/basement-map.ts';

// This launches its own headless Chromium process and isolated browser context. It never uses the user's browser.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = path.resolve(process.env.BASEMENT_QA_DIR ?? '.local/basement-qa');
await fs.mkdir(output, { recursive: true });
const server = createApp({ distDir: fileURLToPath(new URL('../dist/', import.meta.url)) }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = process.env.BASEMENT_QA_URL ?? `http://127.0.0.1:${server.address().port}`;
const errors = [], startupAttempts = [];
const SESSION = 'nwaxz-escape-session-v1';
let browser, context, page;

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function worldFixture({
  player = { x: 12.5, z: 40.5, angle: -Math.PI / 2, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false },
  hunter = { x: 21.5, z: 31.5, angle: 0, state: 'search' },
  elapsed = 12,
  abilities,
  seed = 42,
} = {}) {
  const world = new EscapeWorld(seed);
  Object.assign(world.data.player, player);
  Object.assign(world.data.hunter, hunter);
  world.data.elapsed = elapsed;
  world.target = { x: 22.5, z: 50.5 };
  if (abilities) world.data.abilities = structuredClone(abilities);
  return EscapeWorld.restore(world.snapshot()).snapshot();
}

function warningState(kind = 'sense', { remaining = 3, attempt = 30, cooldown = 0 } = {}) {
  return {
    enabled: true,
    stage: 'warning',
    selected: kind,
    rest: 0,
    attempt,
    warning: remaining,
    cooldowns: { sense: 0, teleport: cooldown },
    notice: { kind: `${kind}-warning`, remaining, duration: 3 },
    moving: false,
    scanChance: 0.2,
    tick: 0,
    motionMemory: 0,
  };
}

function senseOutcomeSeed(hit) {
  for (let seed = 0; seed < 100_000; seed++) {
    let x = (seed + 0x9e3779b9) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    x ^= x >>> 15;
    const sample = (x >>> 0) / 0x100000000;
    if (hit ? sample < 0.2 : sample >= 0.2) return seed;
  }
  assert.fail('no deterministic sense seed found');
}

async function ready(p) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    try {
      const result = await p.waitForFunction(
        () => document.querySelector('#extreme') ? 'ready' : document.querySelector('#retry-load') ? 'retry' : false,
        {}, { timeout: 300_000 },
      );
      const status = await result.jsonValue();
      startupAttempts.push({ attempt, status, ms: Date.now() - started });
      if (status === 'ready') {
        await p.waitForFunction(({ key, value }) => localStorage.getItem(key) === value,
          { key: SAVE_GENERATION_KEY, value: SAVE_GENERATION }, { timeout: 30_000 });
        return;
      }
      if (attempt === 1) throw new Error('Homepage startup retry failed: ' + await p.locator('body').innerText());
      await p.locator('#retry-load').click();
    } catch (error) {
      if (attempt === 1) throw error;
      const retry = p.locator('#retry-load');
      if (await retry.count()) await retry.click();
      else throw error;
    }
  }
}

async function enter(p, snapshot) {
  const validated = EscapeWorld.restore(snapshot).snapshot();
  await p.evaluate(({ key, save }) => {
    localStorage.setItem(key, JSON.stringify(save));
    localStorage.setItem('nwaxz-escape-sound-v1', JSON.stringify({ music: false, sound: false }));
  }, { key: SESSION, save: validated });
  await p.locator('#extreme').click();
  await p.locator('#escape-continue').waitFor({ state: 'visible', timeout: 30_000 });
  await p.locator('#escape-continue').click();
  await p.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
  await p.locator('#escape-view').waitFor({ state: 'visible' });
  await p.locator('.escape-ability-status').waitFor({ state: 'attached' });
}

async function pause(p) {
  if (await p.evaluate(() => !!document.pointerLockElement)) await p.keyboard.press('Escape');
  else await p.locator('#escape-pause').click();
  await p.locator('#escape-resume').waitFor({ state: 'visible' });
  const snapshot = JSON.parse(await p.evaluate(key => localStorage.getItem(key), SESSION));
  EscapeWorld.restore(snapshot);
  return snapshot;
}

async function resume(p) {
  await p.locator('#escape-resume').click();
  await p.locator('#escape-panel').waitFor({ state: 'hidden' });
}

async function exit(p) {
  await p.locator('#escape-exit').click();
  await p.locator('#extreme').waitFor({ state: 'visible' });
}

async function photo(p, name) {
  // Hide only the visual menu while capturing the actual WebGL canvas.
  await p.locator('#escape-panel').evaluate(el => { el.hidden = true; });
  try {
    await p.locator('#escape-view').screenshot({ path: path.join(output, `${name}.png`) });
  } finally {
    await p.locator('#escape-panel').evaluate(el => { el.hidden = false; });
  }
}

async function savedSweep(p) {
  return p.locator('.escape-ability-banner').evaluate(el => getComputedStyle(el).getPropertyValue('--ability-sweep').trim());
}

async function fullPhoto(p, name) {
  await p.screenshot({ path: path.join(output, `${name}.png`) });
}

function noOverlap(a, b) {
  return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
}

function pythonImageCheck(onPath, offPath) {
  const script = `from PIL import Image, ImageOps
import json, sys
on = Image.open(sys.argv[1]).convert('RGB')
off = Image.open(sys.argv[2]).convert('RGB')
assert on.size == off.size, (on.size, off.size)
w, h = on.size
box = (int(w*.42), int(h*.38), int(w*.58), int(h*.62))
lit = ImageOps.grayscale(on.crop(box))
dark = ImageOps.grayscale(off.crop(box))
lp = list(lit.getdata()); dp = list(dark.getdata())
report = {'centerMeanOn': sum(lp)/len(lp), 'centerMeanOff': sum(dp)/len(dp), 'brighterFraction': sum(a > b + 8 for a,b in zip(lp,dp))/len(lp)}
print(json.dumps(report))`;
  const result = spawnSync(process.env.PYTHON_PATH ?? 'python', ['-c', script, onPath, offPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const measurements = JSON.parse(result.stdout);
  assert.ok(measurements.centerMeanOn > measurements.centerMeanOff + 2 || measurements.brighterFraction > 0.12,
    JSON.stringify(measurements));
  return measurements;
}

async function worldNotice(p, expectedText) {
  await p.waitForFunction(text => {
    const banner = document.querySelector('.escape-ability-banner');
    return banner && !banner.hidden && banner.textContent.includes(text);
  }, expectedText, { timeout: 8_000 });
}

async function scanHudBounds(p) {
  return p.evaluate(() => {
    const rect = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      status: rect('.escape-ability-status'), exposure: rect('.escape-hunt'), map: rect('.escape-map-button'),
      crosshair: rect('.escape-crosshair'), actions: rect('.escape-actions'),
      statusVisible: !!document.querySelector('.escape-ability-status')?.getClientRects().length,
    };
  });
}

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--renderer-process-limit=1'],
  });
  context = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await ready(page);

  // Ground reference: same view and seed, with only the flashlight toggled.
  const ground = light => worldFixture({
    player: { x: 10.5, z: 9.5, angle: 0, pitch: 0, light, battery: 100, crouched: false, sprinting: false, winded: false },
    hunter: { x: 20.5, z: 4.5, angle: Math.PI, state: 'patrol' },
    elapsed: 12, seed: 121,
  });
  const offPath = path.join(output, 'ground-light-off.png');
  await enter(page, ground(false));
  await page.waitForTimeout(450);
  await pause(page);
  await photo(page, 'ground-light-off');
  await exit(page);

  const onPath = path.join(output, 'ground-light-on.png');
  await enter(page, ground(true));
  await page.waitForTimeout(450);
  await pause(page);
  await photo(page, 'ground-light-on');
  await exit(page);
  const lightMeasurement = pythonImageCheck(onPath, offPath);

  // Enter the B1 warning state using a fully valid v2 save. Timers and the model-driven sweep must freeze on pause.
  const warningFixture = worldFixture({ abilities: warningState('sense', { cooldown: 27.5 }), seed: 312 });
  await enter(page, warningFixture);
  await worldNotice(page, '即将扫描移动单位');
  assert.match(await page.locator('.escape-ability-banner').innerText(), /即将扫描移动单位/);
  const warningMeter = await page.locator('.escape-ability-warning-meter').evaluate(el => ({ max: el.max, value: el.value, hidden: el.hidden }));
  assert.equal(warningMeter.max, 3);
  assert.equal(warningMeter.hidden, false);
  assert.ok(warningMeter.value >= 0 && warningMeter.value <= warningMeter.max, JSON.stringify(warningMeter));
  const avatar = await page.locator('.escape-ability-banner .escape-ability-avatar').evaluate(el => ({
    filter: getComputedStyle(el).filter,
    image: getComputedStyle(el).backgroundImage,
    rect: (() => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; })(),
  }));
  assert.match(avatar.filter, /grayscale\(1\)/);
  assert.match(avatar.image, /haunted-frog-v1\.webp/);
  assert.ok(avatar.rect.width >= 40 && avatar.rect.height >= 40, JSON.stringify(avatar));
  await fullPhoto(page, 'sense-warning-live');
  const sweepBeforePause = await savedSweep(page);
  const sweepStart = Number.parseFloat(sweepBeforePause);
  assert.ok(Number.isFinite(sweepStart), 'warning banner exposes numeric model progress in --ability-sweep');
  await page.waitForTimeout(250);
  const sweepAfterActive = await savedSweep(page);
  assert.ok(Number.parseFloat(sweepAfterActive) > sweepStart, 'the light band moves left-to-right with model time');
  await page.waitForFunction(start => {
    const banner = document.querySelector('.escape-ability-banner');
    const meter = banner?.querySelector('.escape-ability-warning-meter');
    return banner?.textContent.includes('即将扫描移动单位') && meter && meter.value >= start + 0.3;
  }, warningMeter.value, { timeout: 1_600 });
  const warningBeforePause = await pause(page);
  assert.equal(floorAt(warningBeforePause.player), -1);
  const frozenSweep = await savedSweep(page);
  await fs.writeFile(path.join(output, 'warning-before-pause.json'), JSON.stringify(warningBeforePause, null, 2));
  await page.waitForTimeout(700);
  assert.equal(await savedSweep(page), frozenSweep, 'the sweep stays still while paused');
  await resume(page);
  await page.waitForTimeout(170);
  const warningAfterPause = await pause(page);
  assert.ok(warningAfterPause.abilities.warning < warningBeforePause.abilities.warning);
  assert.ok(warningBeforePause.abilities.warning - warningAfterPause.abilities.warning < 0.45,
    JSON.stringify({ before: warningBeforePause.abilities.warning, after: warningAfterPause.abilities.warning }));
  assert.ok(Math.abs(warningBeforePause.abilities.cooldowns.teleport - warningAfterPause.abilities.cooldowns.teleport) < 0.45);
  assert.equal(warningAfterPause.abilities.notice.remaining, warningAfterPause.abilities.warning);
  await exit(page);

  // Freeze crystal suspends ability time in the active world.
  const frozenFixture = worldFixture({ abilities: warningState('sense', { cooldown: 21 }), seed: 707 });
  frozenFixture.hunt.freeze = 4;
  frozenFixture.hunt.freezeUsed = 1;
  frozenFixture.hunt.collected.push('basement-crystal-freeze');
  await enter(page, frozenFixture);
  await page.waitForTimeout(300);
  const beforeFreeze = await pause(page);
  await resume(page);
  await page.waitForTimeout(500);
  const afterFreeze = await pause(page);
  assert.equal(afterFreeze.abilities.warning, beforeFreeze.abilities.warning);
  assert.equal(afterFreeze.abilities.cooldowns.teleport, beforeFreeze.abilities.cooldowns.teleport);
  assert.equal(afterFreeze.abilities.notice.remaining, beforeFreeze.abilities.notice.remaining);
  await exit(page);

  // A result notice and both cooldowns also pause while the game's real pause menu is open.
  const resultFixture = worldFixture({ abilities: {
    enabled: true, stage: 'rest', rest: 28, attempt: 0, warning: 0,
    cooldowns: { sense: 34, teleport: 44 },
    notice: { kind: 'evaded', remaining: 2.2, duration: 2.4 },
    moving: false, scanChance: 0.2, tick: 0, motionMemory: 0,
  } });
  await enter(page, resultFixture);
  await page.waitForTimeout(150);
  const resultBefore = await pause(page);
  await page.waitForTimeout(650);
  await resume(page);
  await page.waitForTimeout(150);
  const resultAfter = await pause(page);
  assert.ok(resultBefore.abilities.notice.remaining - resultAfter.abilities.notice.remaining < 0.4);
  assert.ok(resultBefore.abilities.cooldowns.sense - resultAfter.abilities.cooldowns.sense < 0.4);
  assert.ok(resultBefore.abilities.cooldowns.teleport - resultAfter.abilities.cooldowns.teleport < 0.4);
  assert.ok(resultBefore.abilities.rest - resultAfter.abilities.rest < 0.4);
  await exit(page);

  // Resolve both possible sense outcomes from valid, full-length warning fixtures.
  async function senseFixture(hit) {
    const snapshot = worldFixture({ abilities: warningState('sense'), seed: 42 });
    snapshot.hunt.rng = senseOutcomeSeed(hit);
    await enter(page, snapshot);
    await worldNotice(page, '即将扫描移动单位');
    await worldNotice(page, hit ? '位置暴露' : '躲过感测');
    await fullPhoto(page, hit ? 'sense-exposed-100-live' : 'sense-evaded-live');
    const resolved = await pause(page);
    if (hit) {
      assert.ok(resolved.hunt.sight > 0, `sense should leave a sight trace: ${resolved.hunt.sight}`);
      assert.equal(resolved.hunter.state, 'chase');
      assert.equal(EscapeWorld.restore(resolved).perception.total, 100);
    } else {
      assert.notEqual(resolved.hunt.sight, 100);
      assert.notEqual(resolved.hunter.state, 'chase');
    }
    await photo(page, hit ? 'sense-exposed-100' : 'sense-evaded');
    await exit(page);
    return resolved;
  }
  const senseHit = await senseFixture(true);
  const senseMiss = await senseFixture(false);

  // A legal teleport result must be 3–12 cells from the player and land on a safe B1 tile.
  const teleportFixture = worldFixture({ abilities: warningState('teleport'), seed: 919 });
  await enter(page, teleportFixture);
  await worldNotice(page, '空间出现异动');
  await worldNotice(page, '奶蛙已瞬移');
  await fullPhoto(page, 'teleport-warning-result-live');
  const teleportResult = await pause(page);
  const landing = { x: teleportResult.hunter.x, z: teleportResult.hunter.z };
  const origin = teleportResult.player;
  const landedWorld = EscapeWorld.restore(teleportResult);
  assert.ok(floorAt(landing) === -1 && !landedWorld.wall(landing.x, landing.z, true));
  assert.ok(!landedWorld.furniture(landing.x, landing.z, 0.7));
  assert.ok(distance(landing, origin) >= 3 && distance(landing, origin) <= 12, JSON.stringify({ landing, origin }));
  assert.equal(teleportResult.hunter.state, 'investigate');
  await photo(page, 'teleport-warning-result');
  await exit(page);

  // Capture the secret pump mural head-on using the real scene and camera.
  await enter(page, worldFixture({
    player: { x: 20.5, z: 30.5, angle: -Math.PI / 2, pitch: 0, light: true, battery: 100, crouched: false, sprinting: false, winded: false },
    hunter: { x: 12.5, z: 40.5, angle: Math.PI, state: 'search' },
    seed: 884,
  }));
  await page.waitForTimeout(450);
  await pause(page);
  await photo(page, 'basement-secret-mural');
  await exit(page);

  // Walk the real sloped stair route in both directions with continuous keyboard input.
  const stairFixture = worldFixture({
    player: { x: 4.5, z: 22.1, angle: Math.PI / 2, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false },
    hunter: { x: 20.5, z: 4.5, angle: Math.PI, state: 'patrol' },
    seed: 911,
  });
  stairFixture.opened.push('changing');
  stairFixture.unlocked.push('changing');
  await enter(page, stairFixture);
  await page.keyboard.down('w'); await page.waitForTimeout(5_000); await page.keyboard.up('w');
  const down = await pause(page);
  assert.equal(floorAt(down.player), -1, JSON.stringify(down.player));
  assert.ok(down.player.z >= 28 && down.player.z <= 33, JSON.stringify(down.player));
  await resume(page);
  await page.keyboard.down('s'); await page.waitForTimeout(5_000); await page.keyboard.up('s');
  const up = await pause(page);
  assert.equal(floorAt(up.player), 0, JSON.stringify(up.player));
  assert.ok(up.player.z >= 20 && up.player.z <= 24, JSON.stringify(up.player));
  await exit(page);

  // Compact readouts must stay clear of exposure, map, crosshair and action controls at all requested sizes.
  await context.close();
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await ready(page);
  const mobileLayouts = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const chance = viewport.width === 320 ? 0.2 : viewport.width === 844 ? 0.8 : 0.2;
    const motionMemory = chance === 0.8 ? 0.4 : 0;
    const mobile = worldFixture({ abilities: {
      enabled: true, stage: 'rest', rest: 19, attempt: 0, warning: 0,
      cooldowns: { sense: 23, teleport: 37 },
      moving: false, scanChance: chance, tick: 0, motionMemory,
    } });
    await enter(page, mobile);
    await page.waitForTimeout(120);
    const layout = await scanHudBounds(page);
    assert.ok(layout.statusVisible, JSON.stringify({ viewport, layout }));
    for (const other of ['exposure', 'map', 'crosshair', 'actions']) {
      assert.ok(noOverlap(layout.status, layout[other]), JSON.stringify({ viewport, overlap: other, layout }));
    }
    const hudText = await page.locator('.escape-ability-readout').innerText();
    assert.doesNotMatch(hudText, /\d|%|下轮|命中率|发动率|秒/);
    const chargeBars = await page.locator('.escape-ability-charge').evaluateAll(els => els.map(el => ({ max: el.max, value: el.value })));
    assert.deepEqual(chargeBars.map(bar => bar.max), [35, 45]);
    assert.deepEqual(chargeBars.map(bar => Math.round(bar.value)), [12, 8]);
    mobileLayouts.push({ viewport, layout, hudText });
    await fullPhoto(page, `mobile-${viewport.width}x${viewport.height}`);
    await pause(page);
    await exit(page);
  }

  // Discover the loaded basement atlas from real network requests, then prove it decodes from the offline cache.
  const assetPath = await page.evaluate(() => {
    const urls = performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname);
    return urls.find(url => /\/assets\/(?:[^/]+\/)*[^/]*basement[^/]*\.(webp|png|jpe?g)$/i.test(url)) ?? null;
  });
  assert.ok(assetPath, 'the B1 texture atlas was requested by the real game');
  const offlineFixture = worldFixture({ player: { x: 12.5, z: 40.5, angle: 0, pitch: 0, light: true, battery: 100, crouched: false, sprinting: false, winded: false } });
  await enter(page, offlineFixture);
  await pause(page);
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  await page.locator('#extreme').click();
  await page.locator('#escape-continue').waitFor({ state: 'visible' });
  await page.locator('#escape-continue').click();
  await page.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
  const offlineDecode = await page.evaluate(async url => {
    const image = new Image(); image.src = url; await image.decode();
    const cached = await caches.match(url, { ignoreSearch: true });
    return { url, width: image.naturalWidth, height: image.naturalHeight, cached: !!cached };
  }, assetPath);
  assert.ok(offlineDecode.width > 0 && offlineDecode.height > 0 && offlineDecode.cached, JSON.stringify(offlineDecode));
  const offlineSave = await pause(page);
  assert.equal(floorAt(offlineSave.player), -1);
  await photo(page, 'offline-basement-continued');
  assert.deepEqual(errors, []);

  console.log(JSON.stringify({
    base, output, startupAttempts, lightMeasurement, avatar, warningBeforePause, warningAfterPause,
    senseHit: { exposure: senseHit.hunt.sight, hunter: senseHit.hunter.state },
    senseMiss: { sight: senseMiss.hunt.sight, hunter: senseMiss.hunter.state },
    teleport: { origin, landing, distance: distance(origin, landing) },
    stairRoute: { down: down.player, up: up.player }, mobileLayouts, offlineDecode, errors,
  }, null, 2));
} catch (error) {
  if (page) {
    try {
      await page.screenshot({ path: path.join(output, 'failure.png') });
      await fs.writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText());
    } catch { /* Preserve the original browser assertion. */ }
  }
  throw error;
} finally {
  await context?.setOffline(false).catch(() => {});
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
