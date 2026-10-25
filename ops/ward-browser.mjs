import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { advanceInterference, createInterference } from '../src/escape/interference.ts';
import { CRYSTALS, EscapeWorld } from '../src/escape/world.ts';
import { SAVE_GENERATION, SAVE_GENERATION_KEY } from '../src/save-generation.ts';

// Independent headless Chromium only; never connects to an existing browser profile.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = path.resolve(process.env.WARD_QA_DIR ?? '.local/ward-qa');
await fs.mkdir(output, { recursive: true });
const base = process.env.WARD_QA_URL;
const server = base ? undefined : createApp({ distDir: fileURLToPath(new URL('../dist/', import.meta.url)) }).listen(0, '127.0.0.1');
if (server) await new Promise(resolve => server.once('listening', resolve));
const url = base ?? `http://127.0.0.1:${server.address().port}`;
const SESSION = 'nwaxz-escape-session-v1';
const errors = [];
let browser, context, page, currentPage;

function collect(world, id) {
  const crystal = CRYSTALS.find(item => item.id === id);
  assert.ok(crystal, `missing ${id}`);
  Object.assign(world.data.player, { x: crystal.x, z: crystal.z + 1 });
  world.data.player.angle = Math.atan2(crystal.z - world.data.player.z, crystal.x - world.data.player.x);
  assert.equal(world.nearest()?.id, id);
  world.interact();
  assert.ok(world.data.hunt.collected.includes(id));
}

function fixture({ corrupted = false, groundCorrupted = false, almostExpired = false } = {}) {
  const world = new EscapeWorld(14);
  for (const id of ['crystal-ward-infirmary', 'crystal-ward-changing', 'basement-crystal-ward']) collect(world, id);
  Object.assign(world.data.player, { x: 12.5, z: 40.5, angle: 0, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false });
  Object.assign(world.data.hunter, { x: 20.5, z: 40.5, angle: Math.PI, state: 'patrol' });
  world.data.elapsed = 20;
  if (corrupted) world.data.interference = advanceInterference(createInterference(-1), 11, { active: true, random: () => 0 });
  if (groundCorrupted) {
    Object.assign(world.data.player, { x: 3.5, z: 5.5 });
    world.data.interference = advanceInterference(createInterference(0), 31, { active: true, floor: 0, random: () => 0 });
  }
  if (almostExpired) {
    world.useCrystal('ward');
    world.data.hunt.ward = 2;
  }
  return EscapeWorld.restore(world.snapshot()).snapshot();
}

async function ready(p) {
  await p.waitForFunction(() => document.querySelector('#extreme') || document.querySelector('#retry-load'), {}, { timeout: 300_000 });
  if (await p.locator('#retry-load').count()) throw new Error('Homepage startup retry required');
  await p.waitForFunction(({ key, value }) => localStorage.getItem(key) === value,
    { key: SAVE_GENERATION_KEY, value: SAVE_GENERATION }, { timeout: 30_000 });
}

async function enter(p, snapshot) {
  await p.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('nwaxz-escape-sound-v1', JSON.stringify({ music: false, sound: false }));
  }, { key: SESSION, value: snapshot });
  await p.locator('#extreme').click();
  await p.locator('#escape-continue').waitFor({ state: 'visible', timeout: 30_000 });
  await p.locator('#escape-continue').click();
  await p.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
}

async function pause(p) {
  await p.keyboard.press('Escape');
  await p.locator('#escape-resume').waitFor({ state: 'visible' });
  return JSON.parse(await p.evaluate(key => localStorage.getItem(key), SESSION));
}

function noOverlap(a, b) {
  return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
}

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--renderer-process-limit=1'],
  });
  context = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce' });
  page = await context.newPage();
  currentPage = page;
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await ready(page);

  await enter(page, fixture({ corrupted: true }));
  await page.waitForFunction(() => document.querySelector('#escape-exposure-label')?.textContent?.trim() === '被干扰');
  await page.keyboard.press('3');
  await page.waitForFunction(() => document.querySelector('#escape-exposure-label')?.textContent?.trim() === '暴露值');
  await page.waitForFunction(() => document.querySelector('#escape-ward').disabled
    && document.querySelector('#escape-ward-progress').value > 59);
  const cleansed = await pause(page);
  assert.equal(cleansed.interference.stage, 'clear');
  assert.ok(cleansed.hunt.ward > 59, `ward did not start at 60: ${cleansed.hunt.ward}`);
  assert.equal(cleansed.hunt.wardUsed, 1);
  assert.equal(cleansed.hunt.collected.filter(id => id.startsWith('crystal-ward-') || id === 'basement-crystal-ward').length, 3);
  assert.equal(await page.locator('#escape-ward').isDisabled(), true);
  assert.ok(Number(await page.locator('#escape-ward-progress').getAttribute('max')) === 60);
  assert.ok(await page.locator('#escape-ward-progress').evaluate(el => el.value) > 59);
  const desktopProgress = await page.evaluate(() => {
    const ward = document.querySelector('#escape-ward').getBoundingClientRect();
    const progress = document.querySelector('#escape-ward-progress').getBoundingClientRect();
    return { ward: { left: ward.left, right: ward.right }, progress: { left: progress.left, right: progress.right, width: progress.width, height: progress.height } };
  });
  assert.ok(desktopProgress.progress.width > 0 && desktopProgress.progress.height > 0
    && desktopProgress.progress.left >= desktopProgress.ward.left && desktopProgress.progress.right <= desktopProgress.ward.right,
  `desktop ward progress must fit its button: ${JSON.stringify(desktopProgress)}`);
  assert.doesNotMatch(await page.locator('#escape-ward').innerText(), /秒|\bs\b/i, 'ward shows its own bar without seconds');
  await page.screenshot({ path: path.join(output, 'ward-active-desktop.png') });
  await page.locator('#escape-resume').click();
  await page.locator('#escape-panel').waitFor({ state: 'hidden' });
  const paused = await pause(page);
  const progressAtPause = await page.locator('#escape-ward-progress').evaluate(el => el.value);
  await page.waitForTimeout(400);
  const progressStillPaused = await page.locator('#escape-ward-progress').evaluate(el => el.value);
  assert.equal(progressStillPaused, progressAtPause, 'the real pause menu freezes the ward timer');
  assert.ok(paused.hunt.ward > 59);
  await page.locator('#escape-exit').click();
  await page.locator('#extreme').waitFor({ state: 'visible' });

  await enter(page, fixture({ groundCorrupted: true }));
  await page.waitForFunction(() => document.querySelector('#escape-exposure-label')?.textContent?.trim() === '被干扰');
  await page.keyboard.press('3');
  await page.waitForFunction(() => document.querySelector('#escape-exposure-label')?.textContent?.trim() === '暴露值');
  const groundClean = await pause(page);
  assert.equal(groundClean.interference.profile, 0, 'the ground floor can be corrupted and warded too');
  assert.equal(groundClean.hunt.wardUsed, 1);
  await page.locator('#escape-exit').click();
  await page.locator('#extreme').waitFor({ state: 'visible' });

  // A valid 2-second save is a clock-edge fixture; the second crystal is used by the real button.
  await enter(page, fixture({ almostExpired: true }));
  await page.waitForFunction(() => !document.querySelector('#escape-ward').disabled);
  await page.locator('#escape-ward').click();
  await page.waitForFunction(() => document.querySelector('#escape-ward').disabled);
  const clicked = await pause(page);
  assert.equal(clicked.hunt.wardUsed, 2, 'the button spends the next available ward charge');
  assert.ok(clicked.hunt.ward > 59);
  await page.screenshot({ path: path.join(output, 'ward-click-desktop.png') });
  await page.locator('#escape-exit').click();
  await page.locator('#extreme').waitFor({ state: 'visible' });

  // Coarse-pointer sizes verify the seven actions stay in a three-column cluster.
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage();
  currentPage = mobile;
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(url);
  await ready(mobile);
  await enter(mobile, fixture());
  const layouts = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await mobile.setViewportSize(viewport);
    const info = await mobile.evaluate(() => {
      const bounds = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        coarse: matchMedia('(pointer:coarse)').matches,
        actions: bounds('.escape-actions'),
        buttons: ['#escape-light', '#escape-crouch', '#escape-stone', '#escape-sprint', '#escape-freeze', '#escape-reveal', '#escape-ward'].map(bounds),
        ward: bounds('#escape-ward'),
        progress: bounds('#escape-ward-progress'),
        progressCss: (() => { const el = document.querySelector('#escape-ward-progress'); const s = getComputedStyle(el); return { width: s.width, display: s.display, position: s.position, left: s.left, right: s.right, parent: el.parentElement?.id, parentWidth: el.parentElement?.getBoundingClientRect().width }; })(),
      };
    });
    assert.equal(info.coarse, true);
    for (const [index, box] of info.buttons.entries()) {
      assert.ok(box.width > 0 && box.height > 0 && box.left >= -1 && box.top >= -1 && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1,
        `${viewport.width}x${viewport.height} action ${index} is on screen: ${JSON.stringify(info)}`);
      for (const other of info.buttons.slice(index + 1)) assert.ok(noOverlap(box, other), `${viewport.width}x${viewport.height} action buttons overlap`);
    }
    assert.ok(info.progress.width > 0 && info.progress.height > 0, `ward has its own visible progress bar: ${JSON.stringify({ progress: info.progress, css: info.progressCss })}`);
    assert.ok(info.progress.left >= info.ward.left && info.progress.right <= info.ward.right,
      `ward progress remains inside its button: ${JSON.stringify({ ward: info.ward, progress: info.progress, css: info.progressCss })}`);
    layouts.push({ viewport, info });
    await mobile.screenshot({ path: path.join(output, `ward-mobile-${viewport.width}x${viewport.height}.png`) });
  }
  await mobile.locator('#escape-ward').tap();
  await mobile.waitForFunction(() => document.querySelector('#escape-ward').disabled);
  assert.ok(await mobile.locator('#escape-ward-progress').evaluate(el => el.value) > 59, 'touch activation renders active protection progress');
  await mobile.screenshot({ path: path.join(output, 'ward-mobile-active.png') });
  const touchSave = await pause(mobile);
  assert.equal(touchSave.hunt.wardUsed, 1, 'touch activation uses the ward');
  await mobile.locator('#escape-exit').tap();
  await mobileContext.close();
  currentPage = page;

  // The offline continuation starts with a live shield and can still render and pause it.
  await enter(page, fixture({ almostExpired: true }));
  await pause(page);
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  await page.locator('#extreme').click();
  await page.locator('#escape-continue').waitFor({ state: 'visible' });
  await page.locator('#escape-continue').click();
  await page.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
  await page.screenshot({ path: path.join(output, 'ward-offline.png') });
  assert.ok(await page.locator('#escape-ward-progress').isVisible());
  assert.equal((await pause(page)).hunt.wardUsed, 1);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ base: url, output, layouts, offline: true, errors }, null, 2));
} catch (error) {
  if (currentPage) {
    try { await currentPage.screenshot({ path: path.join(output, 'failure.png') }); } catch { /* Preserve the original failure. */ }
  }
  throw error;
} finally {
  await context?.close();
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
