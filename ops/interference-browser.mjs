import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { EscapeWorld } from '../src/escape/world.ts';
import { SAVE_GENERATION, SAVE_GENERATION_KEY } from '../src/save-generation.ts';

// Launches isolated headless Chromium. This script never attaches to a user's browser.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = path.resolve(process.env.INTERFERENCE_QA_DIR ?? '.local/interference-qa');
await fs.mkdir(output, { recursive: true });
const server = createApp({ distDir: fileURLToPath(new URL('../dist/', import.meta.url)) }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = process.env.INTERFERENCE_QA_URL ?? `http://127.0.0.1:${server.address().port}`;
const SESSION = 'nwaxz-escape-session-v1';
const errors = [], startupAttempts = [];
let browser, context, page;

function fixture({ interference, freeze = 0, noise = 42, seed = 812 } = {}) {
  const world = new EscapeWorld(seed);
  Object.assign(world.data.player, { x: 12.5, z: 40.5, angle: 0, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false });
  Object.assign(world.data.hunter, { x: 20.5, z: 40.5, angle: Math.PI, state: 'patrol' });
  world.data.elapsed = 20;
  world.target = { x: 22.5, z: 50.5 };
  Object.assign(world.data.hunt, { noise, glare: 0, sight: 0, freeze, freezeUsed: freeze > 0 ? 1 : 0, collected: ['crystal-bed'] });
  if (interference) world.data.interference = structuredClone(interference);
  return EscapeWorld.restore(world.snapshot()).snapshot();
}

const corrupt = (remaining = 30, clock = 0) => ({ stage: 'corrupt', clear: 0, attempt: 0, tick: 0, remaining, clock, seed: 123 });

async function ready(p) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
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
  }
}

async function enter(p, snapshot) {
  const save = EscapeWorld.restore(snapshot).snapshot();
  await p.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('nwaxz-escape-sound-v1', JSON.stringify({ music: false, sound: false }));
  }, { key: SESSION, value: save });
  await p.locator('#extreme').click();await p.locator('#escape-menu-solo').click();
  await p.locator('#escape-continue').waitFor({ state: 'visible', timeout: 30_000 });
  await p.locator('#escape-continue').click();
  await p.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
  await p.locator('#escape-view').waitFor({ state: 'visible' });
}

async function pause(p) {
  if (await p.evaluate(() => !!document.pointerLockElement)) await p.keyboard.press('Escape');
  else await p.locator('#escape-pause').click();
  await p.locator('#escape-resume').waitFor({ state: 'visible' });
  const save = JSON.parse(await p.evaluate(key => localStorage.getItem(key), SESSION));
  EscapeWorld.restore(save);
  return save;
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
  await p.screenshot({ path: path.join(output, `${name}.png`) });
}

async function uiValues(p) {
  return p.evaluate(() => ({
    label: document.querySelector('#escape-exposure-label')?.textContent?.trim(),
    total: document.querySelector('#escape-exposure-value')?.textContent?.trim(),
    noise: document.querySelector('#escape-noise-value')?.textContent?.trim(),
    glare: document.querySelector('#escape-glare-value')?.textContent?.trim(),
    sight: document.querySelector('#escape-sight-value')?.textContent?.trim(),
    info: ['noise', 'glare', 'sight'].map(name => document.querySelector(`#escape-${name}-info`)?.textContent?.trim()),
    interfered: document.querySelector('.escape-hunt')?.classList.contains('interfered'),
    state: document.querySelector('#escape-hunt-state')?.textContent?.trim(),
  }));
}

function noOverlap(a, b) {
  return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
}

async function interferenceBounds(p) {
  return p.evaluate(() => {
    const box = selector => {
      const e = document.querySelector(selector);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const style = getComputedStyle(e);
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
        visible: !!e.getClientRects().length && r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' };
    };
    return {
      pointerCoarse: matchMedia('(pointer:coarse)').matches,
      hunt: box('.escape-hunt'), ability: box('.escape-ability-status'), mapButton: box('#escape-map'),
      actions: box('.escape-actions'), light: box('#escape-light'), crouch: box('#escape-crouch'), stone: box('#escape-stone'),
      sprint: box('#escape-sprint'), freeze: box('#escape-freeze'), reveal: box('#escape-reveal'), interact: box('#escape-interact'),
      crosshair: box('.escape-crosshair'), stick: box('#escape-stick'), meters: box('.escape-meters'), pause: box('#escape-pause'),
      inventory: box('#escape-inventory'), exposure: box('#escape-exposure-value'), state: box('#escape-hunt-state'),
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

  // The uncorrupted HUD shows the real model value. Freeze stabilizes the three underlying scores.
  const realFixture = fixture({ freeze: 9, noise: 42 });
  const realModel = EscapeWorld.restore(realFixture).perception;
  await enter(page, realFixture);
  await page.waitForTimeout(120);
  const realHud = await uiValues(page);
  assert.equal(realHud.label, '暴露值');
  assert.equal(Number(realHud.total), Math.round(realModel.total));
  await photo(page, 'real-perception');
  await pause(page);
  await exit(page);

  // Pollution must change only the displayed readings. A live freeze keeps the real model and pursuer stable.
  const corruptedFixture = fixture({ interference: corrupt(), noise: 42 });
  const realBefore = EscapeWorld.restore(corruptedFixture).perception;
  await enter(page, corruptedFixture);
  await page.waitForFunction(() => document.querySelector('#escape-exposure-label')?.textContent?.trim() === '被干扰');
  const first = await uiValues(page);
  assert.equal(first.label, '被干扰');
  assert.equal(first.state, '被干扰');
  assert.equal(first.interfered, true);
  assert.ok(first.info.every(text => text.includes('读数不可信')), JSON.stringify(first));
  assert.equal(Number(first.total), 100, 'seed 123 begins on the deliberately high false-readout band');
  assert.doesNotMatch(first.state, /\d|秒|s/i, 'the pollution marker does not expose duration');
  assert.equal(await page.locator('#escape-interference').count(), 0, 'pollution duration has no player-facing progress bar');
  assert.equal(await page.locator('#escape-interference-meter').count(), 0, 'no hidden timer debug meter remains in the HUD');
  await photo(page, 'interference-live');

  const changes = [];
  let previous = `${first.total}/${first.noise}/${first.glare}/${first.sight}`;
  for (let sample = 0; sample < 5; sample++) {
    await page.waitForTimeout(360);
    const value = await uiValues(page);
    const joined = `${value.total}/${value.noise}/${value.glare}/${value.sight}`;
    if (joined !== previous) changes.push(joined);
    previous = joined;
  }
  assert.ok(changes.length >= 2, `false readings should change around three times per second: ${JSON.stringify(changes)}`);
  // Freeze the hunter; the applied corruption still decays, while the real perception and positions hold.
  await page.keyboard.press('1');
  await page.waitForFunction(() => Number(document.querySelector('#escape-freeze-time')?.textContent?.match(/[\d.]+/)?.[0]) > 0);
  const beforeFreezeWait = await pause(page);
  const actualBefore = EscapeWorld.restore(beforeFreezeWait).perception;
  const freezeRemaining = beforeFreezeWait.interference.remaining;
  await page.waitForTimeout(450);
  const stillPaused = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION));
  assert.equal(stillPaused.interference.remaining, freezeRemaining, 'pause menu freezes all model timers');
  assert.equal(stillPaused.hunt.noise, beforeFreezeWait.hunt.noise, 'pause also preserves real model scores');
  await resume(page);
  await page.waitForTimeout(700);
  const afterFreeze = await pause(page);
  const actualAfter = EscapeWorld.restore(afterFreeze).perception;
  assert.equal(afterFreeze.hunter.x, beforeFreezeWait.hunter.x);
  assert.equal(afterFreeze.hunter.z, beforeFreezeWait.hunter.z);
  assert.ok(Math.abs(actualBefore.total - EscapeWorld.restore(beforeFreezeWait).perception.total) < 1e-9);
  assert.ok(Math.abs(actualAfter.total - EscapeWorld.restore(afterFreeze).perception.total) < 1e-9);
  assert.notEqual(Number(first.total), Math.round(realBefore.total), 'displayed total is independent of real perception');
  assert.ok(afterFreeze.interference.remaining < freezeRemaining - 0.45,
    JSON.stringify({ freezeRemaining, remaining: afterFreeze.interference.remaining }));
  const fakeWhileFrozen = await uiValues(page);
  assert.equal(fakeWhileFrozen.label, '被干扰');
  assert.equal(fakeWhileFrozen.state, '被干扰');
  await photo(page, 'interference-frozen-hunter');
  await exit(page);

  // Nearly-expired valid save verifies normal readings return without waiting 30 wall-clock seconds.
  const expiringFixture = fixture({ interference: corrupt(0.25, 29.75), noise: 42 });
  await enter(page, expiringFixture);
  await page.waitForFunction(() => document.querySelector('#escape-exposure-label')?.textContent?.trim() === '暴露值', {}, { timeout: 3_000 });
  await page.waitForFunction(() => document.querySelector('#escape-notice')?.textContent?.includes('感官恢复了'), {}, { timeout: 3_000 });
  const restoredHud = await uiValues(page);
  assert.equal(restoredHud.interfered, false);
  const restoredSave = await pause(page);
  assert.notEqual(Number(restoredHud.total), 100, 'normal reading resumes after the false high reading');
  assert.ok(!restoredHud.info.some(text => text.includes('读数不可信')));
  assert.equal(restoredSave.interference.stage, 'clear');
  await photo(page, 'interference-expired');
  await exit(page);

  // Map and pause controls are separate: M opens/toggles a floor map, Esc opens the feature pause menu.
  await enter(page, fixture({ interference: corrupt(), freeze: 8 }));
  await page.keyboard.press('m');
  await page.locator('#escape-map-ground').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#escape-resume').count(), 0);
  for (const id of ['#escape-floorplan', '#escape-map-ground', '#escape-map-basement', '#escape-map-close']) assert.equal(await page.locator(id).count(), 1);
  for (const id of ['#escape-backup', '#escape-restart', '#escape-music']) assert.equal(await page.locator(id).count(), 0);
  await page.locator('#escape-floorplan').screenshot({ path: path.join(output, 'map-basement-current.png') });
  const currentArrow = await page.locator('#escape-floorplan').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 245 && data[i + 1] > 225 && data[i + 2] > 160 && data[i + 3] > 0) count++;
    return count;
  });
  assert.ok(currentArrow > 0, `current floor should draw the player arrow: ${currentArrow}`);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'escape-map-basement', 'Tab remains usable in map');
  await page.locator('#escape-map-ground').click();
  await page.locator('#escape-floorplan').screenshot({ path: path.join(output, 'map-ground-other-floor.png') });
  const otherArrow = await page.locator('#escape-floorplan').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 245 && data[i + 1] > 225 && data[i + 2] > 160 && data[i + 3] > 0) count++;
    return count;
  });
  assert.equal(otherArrow, 0, 'viewing the other floor must not leak the player arrow');
  const mapSave = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION));
  await page.waitForTimeout(450);
  assert.deepEqual(JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION)), mapSave, 'map pauses world time');
  await page.keyboard.press('m');
  await page.locator('#escape-panel').waitFor({ state: 'hidden' });
  await page.keyboard.press('m');
  await page.locator('#escape-map-ground').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('#escape-panel').waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  await page.locator('#escape-resume').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#escape-floorplan').count(), 0);
  for (const id of ['#escape-resume', '#escape-backup', '#escape-restart', '#escape-exit']) assert.equal(await page.locator(id).count(), 1);
  assert.equal(await page.locator('#escape-floorplan').count(), 0, 'Esc menu is not a map');
  await page.locator('#escape-resume').click();
  await page.locator('#escape-panel').waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  await page.locator('#escape-resume').waitFor({ state: 'visible' });
  await photo(page, 'escape-feature-menu');
  await exit(page);

  // A live freeze suspends the uncast 10-second clear interval.
  await enter(page, fixture({ freeze: 8 }));
  await page.waitForTimeout(600);
  const uncastFrozen = await pause(page);
  assert.equal(uncastFrozen.interference.stage, 'clear');
  assert.ok(uncastFrozen.interference.clear > 9.5, JSON.stringify(uncastFrozen.interference));
  await exit(page);

  // Pollution labels and false values fit alongside the cooldown card at every supported compact viewport.
  const mobileLayouts = [];
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on('pageerror', error => errors.push(error.message));
  await mobilePage.goto(base);
  await ready(mobilePage);
  const coarsePointer = await mobilePage.evaluate(() => matchMedia('(pointer:coarse)').matches);
  assert.equal(coarsePointer, true, 'mobile layout must be measured with an actual coarse pointer context');
  const mobileFixture = fixture({ interference: corrupt(), freeze: 8, noise: 42 });
  mobileFixture.abilities = {
    enabled: true, stage: 'rest', rest: 19, attempt: 0, warning: 0,
    cooldowns: { sense: 23, teleport: 37 }, moving: false, scanChance: 0.2, tick: 0, motionMemory: 0,
  };
  await enter(mobilePage, mobileFixture);
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await mobilePage.setViewportSize(viewport);
    await mobilePage.waitForFunction(({width,height}) => innerWidth === width && innerHeight === height
      && matchMedia('(orientation:landscape)').matches === (width > height), viewport);
    await mobilePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bounds = await interferenceBounds(mobilePage);
    assert.equal(bounds.pointerCoarse, true, `coarse media query at ${viewport.width}x${viewport.height}`);
    assert.equal((await uiValues(mobilePage)).label, '被干扰');
    assert.equal(bounds.ability.visible, true, 'cooldown card must be visible during pollution layout checks');
    for (const key of ['exposure', 'state']) {
      const r = bounds[key];
      assert.ok(r && r.left >= -1 && r.top >= -1 && r.right <= viewport.width + 1 && r.bottom <= viewport.height + 1,
        JSON.stringify({ viewport, key, r }));
    }
    const controls = ['ability', 'mapButton', 'actions', 'light', 'crouch', 'stone', 'sprint', 'freeze', 'reveal', 'interact', 'crosshair', 'stick', 'meters'];
    for (const hudName of ['hunt', 'ability']) {
      for (const key of controls) {
        if (key === hudName) continue;
        if (bounds[hudName]?.visible && bounds[key]?.visible) {
          assert.ok(noOverlap(bounds[hudName], bounds[key]), `${viewport.width}x${viewport.height} ${hudName} overlaps ${key}: ${JSON.stringify(bounds)}`);
        }
      }
    }
    mobileLayouts.push({ viewport, bounds });
    await photo(mobilePage, `interference-${viewport.width}x${viewport.height}`);
  }
  // Touch map controls render each floor and keep the close action reachable at every phone size.
  const mobileMaps = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await mobilePage.setViewportSize(viewport);
    await mobilePage.locator('#escape-map').tap();
    await mobilePage.locator('#escape-floorplan').waitFor({ state: 'visible' });
    await mobilePage.locator('#escape-map-ground').tap();
    assert.equal(await mobilePage.locator('#escape-map-ground').getAttribute('aria-pressed'), 'true');
    await mobilePage.locator('#escape-map-basement').tap();
    assert.equal(await mobilePage.locator('#escape-map-basement').getAttribute('aria-pressed'), 'true');
    const mobileMap = await mobilePage.evaluate(() => {
      const size = { width: innerWidth, height: innerHeight };
      const selectors = ['#escape-map-ground', '#escape-map-basement', '#escape-floorplan', '#escape-map-close'];
      const boxes = Object.fromEntries(selectors.map(selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return [selector, { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }];
      }));
      return { size, boxes, pauseHasCanvas: !!document.querySelector('#escape-panel #escape-floorplan') };
    });
    assert.equal(mobileMap.pauseHasCanvas, true);
    for (const [selector, r] of Object.entries(mobileMap.boxes)) {
      assert.ok(r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= mobileMap.size.width + 1 && r.bottom <= mobileMap.size.height + 1,
        `mobile map ${selector} must fit onscreen: ${JSON.stringify(mobileMap)}`);
    }
    mobileMaps.push(mobileMap);
    await photo(mobilePage, `mobile-map-${viewport.width}x${viewport.height}`);
    await mobilePage.locator('#escape-map-close').tap();
    await mobilePage.locator('#escape-panel').waitFor({ state: 'hidden' });
  }
  await mobilePage.locator('#escape-pause').tap();
  await mobilePage.locator('#escape-resume').waitFor({ state: 'visible' });
  assert.equal(await mobilePage.locator('#escape-floorplan').count(), 0, 'mobile feature pause menu must not show the map canvas');
  await photo(mobilePage, 'mobile-feature-menu');
  await mobilePage.locator('#escape-exit').tap();
  await mobilePage.locator('#extreme').waitFor({ state: 'visible' });
  await mobileContext.close();

  // A fresh app load in offline mode still continues the save and decodes the cached B1 atlas.
  const offline = fixture({ interference: corrupt(), freeze: 8, noise: 42 });
  await enter(page, offline);
  await pause(page);
  const assetPath = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)
    .find(url => /\/assets\/(?:[^/]+\/)*[^/]*basement[^/]*\.(webp|png|jpe?g)$/i.test(url)) ?? null);
  assert.ok(assetPath, 'the B1 atlas was loaded by the real game');
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  await page.locator('#extreme').click();await page.locator('#escape-menu-solo').click();
  await page.locator('#escape-continue').waitFor({ state: 'visible' });
  await page.locator('#escape-continue').click();
  await page.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
  const decoded = await page.evaluate(async url => {
    const image = new Image(); image.src = url; await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, cached: !!await caches.match(url, { ignoreSearch: true }) };
  }, assetPath);
  assert.ok(decoded.width > 0 && decoded.height > 0 && decoded.cached, JSON.stringify(decoded));
  const offlineSave = await pause(page);
  assert.equal(offlineSave.interference.stage, 'corrupt');
  await photo(page, 'offline-interference-continued');
  assert.deepEqual(errors, []);

  console.log(JSON.stringify({
    base, output, startupAttempts, real: { exposure: realModel.total, hud: realHud },
    interference: { initial: first, changedReadings: changes, remainingAfterFreeze: afterFreeze.interference.remaining, realAfter: actualAfter.total },
    restoredHud, map: { currentArrow, otherArrow, mobileMaps }, mobile: { coarsePointer, layouts: mobileLayouts }, offline: { assetPath, decoded }, errors,
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
