import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { EscapeWorld } from '../src/escape/world.ts';
import { SAVE_GENERATION, SAVE_GENERATION_KEY } from '../src/save-generation.ts';

// This launches independent headless Chromium contexts; it never uses a user's browser.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = path.resolve(process.env.CARD_QA_DIR ?? '.local/ability-card-qa');
await fs.mkdir(output, { recursive: true });
const server = createApp({ distDir: fileURLToPath(new URL('../dist/', import.meta.url)) }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = process.env.CARD_QA_URL ?? `http://127.0.0.1:${server.address().port}`;
const SESSION = 'nwaxz-escape-session-v1';
const errors = [], startupAttempts = [], measurements = [];
const viewportFilter = process.env.CARD_QA_VIEWPORTS?.split(',').map(value => value.trim()).filter(Boolean);
let browser, context, page;

function fixture() {
  const world = new EscapeWorld(214);
  Object.assign(world.data.player, { x: 12.5, z: 40.5, angle: -Math.PI / 2, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false });
  Object.assign(world.data.hunter, { x: 20.5, z: 31.5, angle: 0, state: 'search' });
  world.data.elapsed = 12;
  world.target = { x: 22.5, z: 50.5 };
  Object.assign(world.data.hunt, { freeze: 10, freezeUsed: 1, collected: ['crystal-bed'] });
  return EscapeWorld.restore(world.snapshot()).snapshot();
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

async function enter(p, snapshot = fixture()) {
  const save = EscapeWorld.restore(snapshot).snapshot();
  await p.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('nwaxz-escape-sound-v1', JSON.stringify({ music: false, sound: false }));
    localStorage.setItem('nwaxz-escape-hud-v1', 'compact');
  }, { key: SESSION, value: save });
  await p.locator('#extreme').click();await p.locator('#escape-menu-solo').click();
  await p.locator('#escape-continue').waitFor({ state: 'visible', timeout: 30_000 });
  await p.locator('#escape-continue').click();
  await p.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
  await p.locator('#escape-view').waitFor({ state: 'visible' });
  await p.locator('.escape-ability-status').waitFor({ state: 'visible' });
  await p.waitForFunction(() => document.querySelector('#escape-freeze-time')?.textContent?.match(/[\d.]+/)?.[0] !== '0');
}

function noOverlap(a, b) {
  return !a || !b || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
}

async function inspect(p, { label, desktop, requireControls = true }) {
  const result = await p.evaluate(() => {
    const box = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
        visibility: s.visibility, display: s.display,
        visible: !!el.getClientRects().length && r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' };
    };
    const status = document.querySelector('.escape-ability-status');
    const readout = status?.querySelector('.escape-ability-readout');
    const items = [...(readout?.querySelectorAll('.escape-ability-item') ?? [])];
    const obstacles = [
      ['exposure', '.escape-hunt'], ['map', '#escape-map'], ['crosshair', '.escape-crosshair'],
      ['items', '#escape-inventory'], ['meters', '.escape-meters'], ['actions', '.escape-actions'],
      ['freeze', '#escape-freeze'], ['reveal', '#escape-reveal'], ['ward', '#escape-ward'],
      ['joystick', '#escape-stick'], ['toggle', '#escape-hud-toggle'], ['room', '#escape-room'],
    ];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pointerCoarse: matchMedia('(pointer:coarse)').matches,
      shellClasses: [...(document.querySelector('.escape-shell')?.classList ?? [])],
      panelHidden: document.querySelector('#escape-panel')?.hidden,
      detailsOpen: document.querySelector('#escape-hud-toggle')?.getAttribute('aria-expanded') === 'true',
      status: box(status), avatar: box(status?.querySelector('.escape-ability-avatar')),
      readout: box(readout), items: items.map(box), bars: items.map(el => box(el.querySelector('.escape-ability-charge'))),
      obstacles: Object.fromEntries(obstacles.map(([name, selector]) => [name, box(document.querySelector(selector))])),
      actionButtons: [...document.querySelectorAll('.escape-actions button')].map(el => ({ id: el.id, ...box(el) })),
      group: box(document.querySelector('.escape-actions')),
      freezeCharge: document.querySelector('#escape-freeze-time')?.textContent?.trim(),
    };
  });
  assert.ok(result.status?.visible, JSON.stringify({ label, result }));
  assert.equal(result.items.length, 2, JSON.stringify({ label, result }));
  assert.equal(result.bars.length, 2, JSON.stringify({ label, result }));
  assert.ok(result.items.every(item => item?.visible), JSON.stringify({ label, result }));
  assert.ok(result.bars.every(bar => bar?.visible && bar.width > bar.height), JSON.stringify({ label, result }));
  assert.ok(result.items[0].top + 2 < result.items[1].top, `skill bars must be separate vertical rows: ${JSON.stringify({ label, result })}`);
  if (desktop) assert.ok(result.avatar?.visible && result.avatar.left < result.readout.left, JSON.stringify({ label, result }));
  else if (result.avatar?.visible) assert.ok(result.avatar.left < result.readout.left, JSON.stringify({ label, result }));
  assert.ok(result.status.left >= 0 && result.status.top >= 0 && result.status.right <= result.viewport.width && result.status.bottom <= result.viewport.height,
    JSON.stringify({ label, result }));
  if (desktop) {
    const leftBounds = result.viewport.width <= 800 ? [6, 20] : [14, 42];
    assert.ok(result.status.left >= leftBounds[0] && result.status.left <= leftBounds[1], JSON.stringify({ label, leftBounds, result }));
    const expectedTop = Math.max(118, Math.min(190, result.viewport.height * 0.16));
    assert.ok(Math.abs(result.status.top - expectedTop) < 12, JSON.stringify({ label, expectedTop, result }));
    assert.ok(result.status.width >= 164 && result.status.width <= 300, JSON.stringify({ label, result }));
    assert.ok(result.status.width / result.status.height < 2.3, JSON.stringify({ label, result }));
  }
  for (const [name, obstacle] of Object.entries(result.obstacles)) {
    if (!requireControls && name !== 'room') continue;
    if (!obstacle?.visible) continue;
    assert.ok(noOverlap(result.status, obstacle), `${label}: status overlaps ${name}: ${JSON.stringify({ status: result.status, obstacle })}`);
    for (const rect of [...result.items, ...result.bars]) {
      assert.ok(noOverlap(rect, obstacle), `${label}: skill row overlaps ${name}: ${JSON.stringify({ rect, obstacle })}`);
    }
  }
  if (requireControls) {
    assert.ok(result.group?.visible && result.actionButtons.length >= 6, JSON.stringify({ label, result }));
    for (const [index, button] of result.actionButtons.entries()) {
      assert.ok(button.visible, `${label}: action button not visible: ${JSON.stringify(button)}`);
      assert.ok(button.left >= 0 && button.top >= 0 && button.right <= result.viewport.width && button.bottom <= result.viewport.height,
        `${label}: action button out of bounds: ${JSON.stringify(button)}`);
      assert.ok(noOverlap(result.status, button), `${label}: status overlaps action button: ${JSON.stringify({ status: result.status, button })}`);
      for (const [name, obstacle] of Object.entries(result.obstacles)) {
        if (name === 'actions' || !obstacle?.visible || ['freeze', 'reveal', 'ward'].includes(name)
          || name === 'meters' && !result.pointerCoarse) continue;
        assert.ok(noOverlap(button, obstacle), `${label}: ${button.id} overlaps ${name}: ${JSON.stringify({ button, obstacle })}`);
      }
      for (const prior of result.actionButtons.slice(0, index)) {
        assert.ok(noOverlap(prior, button), `${label}: action buttons overlap: ${JSON.stringify({ prior, button })}`);
      }
    }
    for (const name of ['freeze', 'reveal', 'ward']) {
      const button = result.obstacles[name];
      if (name === 'ward' && !button) continue; // The ward control is added by the in-progress game change.
      assert.ok(button?.visible, `${label}: ${name} control should be visible: ${JSON.stringify(result)}`);
    }
  }
  measurements.push({ label, result });
  return result;
}

async function toggleSequence(p, label, desktop) {
  const toggle = p.locator('#escape-hud-toggle');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false', `${label} should start compact`);
  await inspect(p, { label: `${label}-compact`, desktop });
  await p.screenshot({ path: path.join(output, `${label}-compact.png`) });

  await p.keyboard.press('Tab');
  await p.waitForFunction(() => document.querySelector('#escape-hud-toggle')?.getAttribute('aria-expanded') === 'true');
  await inspect(p, { label: `${label}-tab-expanded`, desktop });
  await p.screenshot({ path: path.join(output, `${label}-expanded.png`) });
  await p.keyboard.press('Tab');
  await p.waitForFunction(() => document.querySelector('#escape-hud-toggle')?.getAttribute('aria-expanded') === 'false');

  await toggle.click();
  await p.waitForFunction(() => document.querySelector('#escape-hud-toggle')?.getAttribute('aria-expanded') === 'true');
  await inspect(p, { label: `${label}-click-expanded`, desktop });
  await toggle.click();
  await p.waitForFunction(() => document.querySelector('#escape-hud-toggle')?.getAttribute('aria-expanded') === 'false');
  await inspect(p, { label: `${label}-click-collapsed`, desktop });
}

async function newPage(viewport, mobile = false) {
  context = await browser.newContext({
    viewport, reducedMotion: 'reduce',
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}),
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(`${viewport.width}x${viewport.height}: ${error.message}`));
  await page.goto(base);
  await ready(page);
  await enter(page);
}

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--renderer-process-limit=1'],
  });

  for (const viewport of [
    { width: 1920, height: 1080 }, { width: 1767, height: 1200 }, { width: 1280, height: 720 },
    { width: 1100, height: 760 }, { width: 900, height: 500 }, { width: 640, height: 480 },
  ]) {
    if (viewportFilter && !viewportFilter.includes(`${viewport.width}x${viewport.height}`)) continue;
    await newPage(viewport);
    await toggleSequence(page, `desktop-${viewport.width}x${viewport.height}`, true);
    await context.close(); context = undefined; page = undefined;
  }

  for (const viewport of [
    { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 },
  ]) {
    if (viewportFilter && !viewportFilter.includes(`${viewport.width}x${viewport.height}`)) continue;
    await newPage(viewport, true);
    const mobile = await page.evaluate(() => ({ coarse: matchMedia('(pointer:coarse)').matches, touch: navigator.maxTouchPoints > 0 }));
    assert.deepEqual(mobile, { coarse: true, touch: true }, JSON.stringify({ viewport, mobile }));
    const toggle = page.locator('#escape-hud-toggle');
    const card = page.locator('.escape-ability-status');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await inspect(page, { label: `mobile-${viewport.width}x${viewport.height}-compact`, desktop: false });
    await page.screenshot({ path: path.join(output, `mobile-${viewport.width}x${viewport.height}-compact.png`) });
    await toggle.tap();
    await page.waitForFunction(() => document.querySelector('#escape-hud-toggle')?.getAttribute('aria-expanded') === 'true');
    await inspect(page, { label: `mobile-${viewport.width}x${viewport.height}-expanded`, desktop: false });
    await page.screenshot({ path: path.join(output, `mobile-${viewport.width}x${viewport.height}-expanded.png`) });
    await toggle.tap();
    await page.waitForFunction(() => document.querySelector('#escape-hud-toggle')?.getAttribute('aria-expanded') === 'false');
    assert.ok(await card.isVisible());
    await context.close(); context = undefined; page = undefined;
  }

  if (process.env.CARD_QA_SKIP_OFFLINE !== '1') {
    // Verify the HUD still renders from the service worker's cache after an offline reload.
    await newPage({ width: 1280, height: 720 });
    await page.locator('#escape-pause').click();
    await page.locator('#escape-resume').waitFor({ state: 'visible' });
    const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SESSION));
    EscapeWorld.restore(saved);
    await context.setOffline(true);
    await page.reload();
    await ready(page);
    await page.locator('#extreme').click();await page.locator('#escape-menu-solo').click();
    await page.locator('#escape-continue').waitFor({ state: 'visible' });
    await page.locator('#escape-continue').click();
    await page.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 300_000 });
    await page.waitForFunction(() => {
      const shell = document.querySelector('.escape-shell');
      return shell && !shell.classList.contains('menu-active') && !shell.classList.contains('intro-active')
        && document.querySelector('#escape-panel')?.hidden;
    });
    await page.waitForTimeout(150);
    await page.locator('.escape-ability-status').waitFor({ state: 'visible' });
    await page.waitForFunction(() => [
      '.escape-hunt', '#escape-map', '.escape-crosshair', '#escape-inventory', '.escape-meters', '.escape-actions',
      '#escape-freeze', '#escape-reveal', '#escape-ward', '#escape-hud-toggle', '#escape-room',
    ].every(selector => {
      const el = document.querySelector(selector);
      return el && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
    }));
    await inspect(page, { label: 'offline-reload-compact', desktop: true });
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.querySelector('#escape-hud-toggle')?.getAttribute('aria-expanded') === 'true');
    await inspect(page, { label: 'offline-reload-expanded', desktop: true });
    await page.screenshot({ path: path.join(output, 'offline-reload-expanded.png') });
    await context.setOffline(false);
  }
  assert.deepEqual(errors, []);

  console.log(JSON.stringify({ base, output, startupAttempts, measurements, errors }, null, 2));
} catch (error) {
  if (page) {
    try {
      await page.screenshot({ path: path.join(output, 'failure.png') });
      await fs.writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText());
      await fs.writeFile(path.join(output, 'failure-measurements.json'), JSON.stringify(measurements, null, 2));
    } catch { /* Preserve the original browser assertion. */ }
  }
  throw error;
} finally {
  await context?.setOffline(false).catch(() => {});
  await context?.close().catch(() => {});
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
