import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { EscapeWorld } from '../src/escape/world.ts';
import { SAVE_GENERATION, SAVE_GENERATION_KEY } from '../src/save-generation.ts';

// Launches its own isolated headless Chromium contexts. It never attaches to the user's browser.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = path.resolve(process.env.NOTES_QA_DIR ?? '.local/notes-qa-v1');
await fs.mkdir(output, { recursive: true });
const server = createApp({ distDir: fileURLToPath(new URL('../dist/', import.meta.url)) }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = process.env.NOTES_QA_URL ?? `http://127.0.0.1:${server.address().port}`;
const SESSION = 'nwaxz-escape-session-v1';
const errors = [], startupAttempts = [];
let browser, context, page, mobileContext, mobilePage;

function worldFixture({ player, notes = [], abilities, interference, freeze = 0, seed = 522 } = {}) {
  const world = new EscapeWorld(seed);
  Object.assign(world.data.player, player ?? { x: 2.5, z: 21.3, angle: Math.PI / 2, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false });
  Object.assign(world.data.hunter, { x: 20.5, z: 40.5, angle: Math.PI, state: 'patrol' });
  world.data.elapsed = 18;
  world.target = { x: 22.5, z: 50.5 };
  world.data.notes = [...notes];
  world.data.hunt.collected.push('crystal-bed');
  world.data.hunt.freeze = freeze;
  world.data.hunt.freezeUsed = freeze > 0 ? 1 : 0;
  if (abilities) world.data.abilities = structuredClone(abilities);
  if (interference) world.data.interference = structuredClone(interference);
  return EscapeWorld.restore(world.snapshot()).snapshot();
}

const corrupt = () => ({ stage: 'corrupt', clear: 0, attempt: 0, tick: 0, remaining: 20, clock: 10, seed: 910 });

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
  await p.locator('#escape-interact').waitFor({ state: 'visible', timeout: 8_000 });
}

async function openWithE(p) {
  await p.keyboard.press('e');
  await p.locator('.escape-note-dialog:not([hidden])').waitFor({ state: 'visible', timeout: 5_000 });
}

async function noteText(p) {
  return p.evaluate(() => ({
    title: document.querySelector('.escape-note-title')?.textContent?.trim(),
    body: document.querySelector('.escape-note-content')?.textContent?.trim(),
    open: !!document.querySelector('.escape-note-dialog') && !document.querySelector('.escape-note-dialog').hidden,
    hudHidden: getComputedStyle(document.querySelector('.escape-hunt')).visibility === 'hidden',
    abilityHidden: getComputedStyle(document.querySelector('.escape-ability-hud')).visibility === 'hidden',
    outsideText: ['.escape-hunt', '.escape-ability-hud', '.escape-ability-banner', '#escape-notice', '#escape-goal']
      .map(selector => document.querySelector(selector)?.textContent ?? '').join(' '),
  }));
}

async function noteRects(p) {
  return p.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return { viewport: { width: innerWidth, height: innerHeight }, dialog: rect('.escape-note-dialog'), paper: rect('.escape-note-paper'), title: rect('.escape-note-title'), close: rect('.escape-note-close'), body: rect('.escape-note-content'), overflowY: getComputedStyle(document.querySelector('.escape-note-content')).overflowY };
  });
}

function insideViewport(rect, viewport) {
  return rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.top >= -1
    && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1;
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

  // First encounter: use the real E interaction on the stair warning note.
  const stairSave = worldFixture({
    player: { x: 2.5, z: 21.3, angle: Math.PI / 2, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false },
  });
  await enter(page, stairSave);
  await openWithE(page);
  const stairNote = await noteText(page);
  assert.equal(stairNote.title, '楼梯口警示');
  assert.ok(stairNote.body && stairNote.body.length > 20);
  assert.match(stairNote.body, /别空着手下去/);
  assert.equal(stairNote.hudHidden, true);
  assert.equal(stairNote.abilityHidden, true);
  assert.doesNotMatch(stairNote.outsideText, /20\s*%|80\s*%|命中率|发动率|概率|下轮|冷却\s*\d/);
  assert.doesNotMatch(stairNote.outsideText, /\d+(?:\.\d+)?\s*(?:秒|s)\b/i);
  await page.screenshot({ path: path.join(output, 'stair-note-live.png') });
  const stairSnapshot = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION));
  assert.ok(stairSnapshot.notes.includes('stairs-warning-note'));
  const elapsedWhileReading = stairSnapshot.elapsed;
  const modelWhileReading = { abilities: stairSnapshot.abilities, interference: stairSnapshot.interference };
  await page.waitForTimeout(650);
  const stillReading = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION));
  assert.equal(stillReading.elapsed, elapsedWhileReading, 'reading a note pauses world time');
  assert.deepEqual(stillReading.abilities, modelWhileReading.abilities, 'ability timer is saved and frozen while reading');
  assert.deepEqual(stillReading.interference, modelWhileReading.interference, 'interference timer is saved and frozen while reading');
  await page.keyboard.press('e');
  await page.locator('.escape-note-dialog[hidden]').waitFor({ state: 'attached' });
  await page.locator('#escape-panel').waitFor({ state: 'hidden' });

  // Esc menu paper journal only lists found notes; rereading returns to the list.
  await page.keyboard.press('Escape');
  await page.locator('#escape-resume').waitFor({ state: 'visible' });
  assert.match(await page.locator('#escape-goal').innerText(), /楼梯口警示/);
  assert.doesNotMatch(await page.locator('#escape-goal').innerText(), /下水道|钥匙|下一步|前往/);
  await page.locator('#escape-journal').click();
  const foundNotes = await page.locator('[data-note-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-note-id')));
  assert.deepEqual(foundNotes, ['stairs-warning-note']);
  await page.locator('[data-note-id="stairs-warning-note"]').click();
  await page.locator('.escape-note-dialog:not([hidden])').waitFor({ state: 'visible' });
  await page.keyboard.press(' ');
  await page.locator('.escape-note-dialog[hidden]').waitFor({ state: 'attached' });
  await page.locator('#escape-journal-back').waitFor({ state: 'visible' });
  assert.deepEqual(await page.locator('[data-note-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-note-id'))), ['stairs-warning-note']);
  await page.locator('#escape-journal-back').click();
  await page.locator('#escape-resume').waitFor({ state: 'visible' });

  // M always opens the pure map from a feature menu, and M closes that map into gameplay.
  await page.keyboard.press('m');
  await page.locator('#escape-floorplan').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#escape-resume').count(), 0);
  for (const selector of ['#escape-map-ground', '#escape-map-basement', '#escape-map-close']) assert.equal(await page.locator(selector).count(), 1);
  for (const selector of ['#escape-journal', '#escape-backup', '#escape-restart', '#escape-music']) assert.equal(await page.locator(selector).count(), 0);
  await page.keyboard.press('m');
  await page.locator('#escape-panel').waitFor({ state: 'hidden' });
  const savedStairNote = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION));
  await page.keyboard.press('Escape');
  await page.locator('#escape-exit').click();
  await page.locator('#extreme').waitFor({ state: 'visible' });

  // In B1, reading another note freezes active cooldown and interference model timers.
  const pumpSave = worldFixture({
    player: { x: 20.5, z: 29.3, angle: Math.PI / 2, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false },
    notes: ['stairs-warning-note'],
    abilities: {
      enabled: true, stage: 'rest', rest: 24, attempt: 0, warning: 0,
      cooldowns: { sense: 20, teleport: 30 }, moving: false, scanChance: 0.2, tick: 0, motionMemory: 0,
    },
    interference: corrupt(),
  });
  await enter(page, pumpSave);
  await openWithE(page);
  const pumpNote = await noteText(page);
  assert.equal(pumpNote.title, '泵房值守记录');
  assert.match(pumpNote.body, /备用继电器/);
  const pumpPaused = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION));
  assert.ok(pumpPaused.notes.includes('basement-pump-note'));
  assert.ok(pumpPaused.abilities.rest > 20 && pumpPaused.interference.remaining > 19);
  await page.waitForTimeout(650);
  assert.deepEqual(JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION)), pumpPaused,
    'active B1 skill and corruption timers stay unchanged while the paper is open');
  await page.keyboard.press('Escape');
  await page.locator('.escape-note-dialog[hidden]').waitFor({ state: 'attached' });
  await page.locator('#escape-panel').waitFor({ state: 'hidden' });
  await page.waitForTimeout(180);
  await page.keyboard.press('Escape');
  await page.locator('#escape-journal').waitFor({ state: 'visible' });
  await page.locator('#escape-journal').click();
  const b1Notes = await page.locator('[data-note-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-note-id')));
  assert.deepEqual(b1Notes, ['stairs-warning-note', 'basement-pump-note']);
  await page.locator('[data-note-id="stairs-warning-note"]').click();
  await page.locator('.escape-note-dialog:not([hidden])').waitFor({ state: 'visible' });
  await page.locator('.escape-note-close').click();
  await page.locator('#escape-journal-back').waitFor({ state: 'visible' }, { timeout: 5_000 });
  await page.locator('#escape-journal-back').click();
  await page.locator('#escape-resume').waitFor({ state: 'visible' });
  const offlineSave = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION));
  await page.locator('#escape-exit').click();
  await page.locator('#extreme').waitFor({ state: 'visible' });

  // Phone layout: touch interaction opens a real long note, with visible close control and scrollable body.
  mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  mobilePage = await mobileContext.newPage();
  mobilePage.on('pageerror', error => errors.push(error.message));
  await mobilePage.goto(base);
  await ready(mobilePage);
  assert.equal(await mobilePage.evaluate(() => matchMedia('(pointer:coarse)').matches), true);
  const longNoteSave = worldFixture({
    player: { x: 5.5, z: 47.3, angle: Math.PI / 2, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false },
  });
  await enter(mobilePage, longNoteSave);
  const mobileNotes = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await mobilePage.setViewportSize(viewport);
    await mobilePage.locator('#escape-interact').tap();
    await mobilePage.locator('.escape-note-dialog:not([hidden])').waitFor({ state: 'visible' });
    const note = await noteText(mobilePage);
    assert.equal(note.title, '封存试验记录');
    assert.ok(note.body.length > 50);
    assert.equal(note.hudHidden, true);
    assert.equal(note.abilityHidden, true);
    assert.doesNotMatch(note.outsideText, /20\s*%|80\s*%|命中率|发动率|概率|下轮|冷却\s*\d/);
    assert.doesNotMatch(note.outsideText, /\d+(?:\.\d+)?\s*(?:秒|s)\b/i);
    const rects = await noteRects(mobilePage);
    for (const key of ['paper', 'title', 'close', 'body']) {
      assert.ok(insideViewport(rects[key], rects.viewport), `${viewport.width}x${viewport.height} note ${key}: ${JSON.stringify(rects)}`);
    }
    assert.equal(rects.overflowY, 'auto', 'note text area exposes native scrolling');
    await mobilePage.screenshot({ path: path.join(output, `mobile-note-${viewport.width}x${viewport.height}.png`) });
    const scrollProbe = await mobilePage.locator('.escape-note-content').evaluate(el => {
      const original = el.textContent ?? '';
      if (el.scrollHeight <= el.clientHeight) el.textContent = Array(8).fill(original).join('\n\n');
      el.scrollTop = el.scrollHeight;
      const canScroll = el.scrollTop > 0;
      el.textContent = original;
      el.scrollTop = 0;
      return { canScroll, overflowY: getComputedStyle(el).overflowY };
    });
    assert.equal(scrollProbe.overflowY, 'auto');
    assert.equal(scrollProbe.canScroll, true, 'long paper contents can be scrolled on touch layouts');
    mobileNotes.push({ viewport, rects, scrollProbe });
    if (viewport.width === 390) await mobilePage.keyboard.press('e');
    else if (viewport.width === 320) await mobilePage.keyboard.press(' ');
    else await mobilePage.locator('.escape-note-close').tap();
    await mobilePage.locator('.escape-note-dialog[hidden]').waitFor({ state: 'attached' });
  }
  await mobilePage.keyboard.press('Escape');
  await mobilePage.locator('#escape-journal').tap();
  await mobilePage.locator('[data-note-id="basement-secret-note"]').waitFor({ state: 'visible' });
  await mobilePage.locator('[data-note-id="basement-secret-note"]').tap();
  await mobilePage.locator('.escape-note-dialog:not([hidden])').waitFor({ state: 'visible' });
  assert.equal((await noteText(mobilePage)).title, '封存试验记录');
  await mobilePage.locator('.escape-note-close').tap();
  await mobilePage.locator('#escape-journal-back').waitFor({ state: 'visible' });
  await mobilePage.locator('#escape-journal-back').tap();
  await mobilePage.locator('#escape-resume').waitFor({ state: 'visible' });
  await mobilePage.locator('#escape-exit').tap();
  await mobilePage.locator('#extreme').waitFor({ state: 'visible' });

  // Offline continuation reopens the stair warning note using cached paper texture.
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  await page.locator('#extreme').click();await page.locator('#escape-menu-solo').click();
  await page.locator('#escape-continue').waitFor({ state: 'visible' });
  await page.locator('#escape-continue').click();
  await page.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
  await openWithE(page);
  const offlineNote = await noteText(page);
  assert.equal(offlineNote.title, '泵房值守记录');
  assert.match(offlineNote.body, /备用继电器/);
  const paperAsset = await page.evaluate(async () => {
    const url = '/assets/ui/escape-map-atlas-v1.webp';
    const image = new Image(); image.src = url; await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, cached: !!await caches.match(url, { ignoreSearch: true }) };
  });
  assert.ok(paperAsset.width > 0 && paperAsset.height > 0 && paperAsset.cached, JSON.stringify(paperAsset));
  await page.screenshot({ path: path.join(output, 'offline-note-open.png') });
  assert.deepEqual(errors, []);

  console.log(JSON.stringify({
    base, output, startupAttempts, stairNote, pumpNote, elapsedWhileReading,
    b1PausedTimers: { abilities: pumpPaused.abilities, interference: pumpPaused.interference },
    savedStairNote: savedStairNote.notes, offlineSave: offlineSave.notes, mobileNotes, paperAsset, errors,
  }, null, 2));
} catch (error) {
  if (page) {
    try {
      await page.screenshot({ path: path.join(output, 'failure.png') });
      await fs.writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText());
    } catch { /* Preserve the original browser assertion. */ }
  }
  if (mobilePage) {
    try {
      await mobilePage.screenshot({ path: path.join(output, 'mobile-failure.png') });
      await fs.writeFile(path.join(output, 'mobile-failure.txt'), await mobilePage.locator('body').innerText());
    } catch { /* Preserve the original browser assertion. */ }
  }
  throw error;
} finally {
  await context?.setOffline(false).catch(() => {});
  await mobileContext?.setOffline(false).catch(() => {});
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
