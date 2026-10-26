import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { EscapeWorld } from '../src/escape/world.ts';
import { SAVE_GENERATION, SAVE_GENERATION_KEY } from '../src/save-generation.ts';
import { CoopService } from '../server/coop-service.mjs';
import { attachCoopSockets } from '../server/coop-socket.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = path.resolve(process.env.OUTER_MENU_QA_DIR ?? '.local/outer-menu-qa');
await fs.mkdir(output, { recursive: true });
const coopService = new CoopService();
const app = createApp({ distDir: fileURLToPath(new URL('../dist/', import.meta.url)), coopService });
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const closeSockets = attachCoopSockets(server, coopService);
const base = `http://127.0.0.1:${server.address().port}`;
const session = JSON.stringify(new EscapeWorld().snapshot());
const record = JSON.stringify({ version: 2, escapes: 1, bestTimeMs: 12000, fewestCaptures: 0, mostNotes: 1 });
const errors = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, serviceWorkers: 'allow' });
  await context.addInitScript(({ savedSession, savedRecord, saveGenerationKey, saveGeneration }) => {
    localStorage.setItem('nwaxz-escape-session-v1', savedSession);
    localStorage.setItem('nwaxz-escape-record-v1', savedRecord);
    localStorage.setItem('nwaxz-escape-sound-v1', JSON.stringify({ music: false, sound: false }));
    localStorage.setItem(saveGenerationKey, saveGeneration);
  }, { savedSession: session, savedRecord: record, saveGenerationKey: SAVE_GENERATION_KEY, saveGeneration: SAVE_GENERATION });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  const layouts = [];
  for (const [name, width, height] of [['desktop', 1280, 800], ['phone', 390, 844], ['small', 320, 568], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    if (!await page.locator('.escape-lobby').count()) { await page.locator('#extreme').click(); await page.locator('.lv-home-stage').waitFor(); }
    await page.locator('#escape-menu-solo').click();
    await page.locator('#escape-continue').waitFor();
    await page.locator('#escape-new').click();
    await page.locator('[data-lobby-screen="restart"] #escape-confirm-restart').waitFor();
    await page.locator('#escape-cancel-restart').click();
    await page.locator('#escape-continue').waitFor();
    await page.locator('#escape-menu-help').click();
    const controlsLayout = await page.evaluate(inspectLobbyMain);
    assert.equal(controlsLayout.documentOverflow, false, `${name} controls document overflow`);
    assert.equal(controlsLayout.mainOverflow, false, `${name} controls main-content overflow`);
    assert.ok(controlsLayout.buttons.length > 0, `${name} controls page has visible main buttons`);
    await page.screenshot({ path: path.join(output, `${name}-controls.png`) });
    for (const button of controlsLayout.buttons) {
      assert.ok(button.x >= controlsLayout.mainLeft - 1 && button.right <= controlsLayout.mainRight + 1, `${name} controls button ${button.id} stays inside main content`);
      assert.ok(button.height >= 42, `${name} controls button ${button.id} remains touchable`);
    }
    await page.locator('#escape-help-settings').click();
    await page.locator('#escape-menu-music').check();
    const settingsLayout = await page.evaluate(inspectLobbyMain);
    assert.equal(settingsLayout.documentOverflow, false, `${name} settings document overflow`);
    assert.equal(settingsLayout.mainOverflow, false, `${name} settings main-content overflow`);
    assert.ok(settingsLayout.buttons.some(button => button.id === 'escape-settings-back'));
    await page.screenshot({ path: path.join(output, `${name}-settings.png`) });
    await page.locator('[data-screen="settings"]').click();
    await page.locator('#escape-settings-back').click();
    assert.equal(await page.locator('.escape-bindings').isVisible(), true, 'settings returns to controls');
    await page.locator('#escape-help-close').click();
    assert.equal(await page.locator('#escape-continue').isVisible(), true, 'controls returns to the solo menu');
    await page.locator('#escape-intro-saves').click();
    assert.equal(await page.locator('#escape-save-export').isDisabled(), false);
    await page.screenshot({ path: path.join(output, `${name}-saves.png`) });
    await page.locator('#escape-saves-back').click();
    assert.equal(await page.locator('.escape-lobby').getAttribute('data-lobby-screen'), 'solo');
    const layout = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth > innerWidth,
      mainOverflow: document.querySelector('.lv-main').scrollWidth > document.querySelector('.lv-main').clientWidth + 1,
      buttons: [...document.querySelectorAll('.lv-main button')].filter(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden').map(button => {
        const rect = button.getBoundingClientRect();
        return { id: button.id, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      }),
      session: localStorage.getItem('nwaxz-escape-session-v1'),
      record: localStorage.getItem('nwaxz-escape-record-v1'),
      sound: JSON.parse(localStorage.getItem('nwaxz-escape-sound-v1')),
    }));
    assert.equal(layout.documentOverflow, false, `${name} document horizontal overflow`);
    assert.equal(layout.mainOverflow, false, `${name} main-content horizontal overflow`);
    assert.ok(layout.buttons.length > 0, `${name} has visible primary content controls`);
    assert.equal(layout.session, session, 'menu navigation preserves the solo save');
    assert.equal(layout.record, record, 'menu navigation preserves the solo record');
    assert.deepEqual(layout.sound, { music: true, sound: false });
    for (const button of layout.buttons) {
      assert.ok(button.x >= -1 && button.right <= width + 1, `${name} main button ${button.id} stays within the viewport`);
      assert.ok(button.height >= 42, `${name} button ${button.id} remains touchable`);
    }
    await page.screenshot({ path: path.join(output, `${name}-solo.png`) });
    layouts.push({ name, buttons: layout.buttons.length });
    await page.locator('#escape-solo-back').click();
    await page.locator('#escape-intro-exit').click();
  }

  if (!await page.locator('.escape-lobby').count()) { await page.locator('#extreme').click(); await page.locator('.lv-home-stage').waitFor(); }
  await page.locator('#escape-menu-coop').click();
  await page.locator('[data-open-create]').click();
  await page.locator('input[name="name"]').fill('窗口往返');
  await page.locator('button[type="submit"]').click();
  await page.locator('.lv-room-banner').waitFor();
  const roomCode = (await page.locator('.lv-room-banner').innerText()).match(/[A-Z0-9]{6}/)?.[0];
  assert.ok(roomCode, 'created a waiting room');
  await waitFor(() => coopService.rooms.get(roomCode)?.peers.size === 1, 15000, 'room WebSocket connected');
  const liveRoom = coopService.rooms.get(roomCode);
  assert.equal(liveRoom.players.size, 1);
  await page.locator('[data-screen="settings"]').click();
  await page.locator('#escape-menu-sound').check();
  await page.locator('[data-screen="settings"]').click();
  await page.locator('#escape-settings-back').click();
  assert.ok((await page.locator('.lv-room-banner').innerText()).includes(roomCode), 'settings returns to the same room');
  assert.equal(coopService.rooms.get(roomCode), liveRoom, 'settings keeps the same server room instance');
  assert.equal(liveRoom.peers.size, 1, 'settings does not disconnect the room WebSocket');
  await page.locator('#escape-menu-help').click();
  await page.locator('#escape-help-settings').click();
  await page.locator('#escape-settings-back').click();
  await page.locator('#escape-help-close').click();
  assert.ok((await page.locator('.lv-room-banner').innerText()).includes(roomCode), 'operations/settings return without leaving the room');
  assert.equal(coopService.rooms.get(roomCode), liveRoom, 'operations/settings do not create a replacement room');
  await page.locator('[data-action="leave"]').click();
  await page.waitForFunction(() => !document.querySelector('.lv-room-banner'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ layouts, roomReturn: true, roomWebSocket: true, errors }));
  await context.close();
} catch (error) {
  console.error(error);
  console.error(errors);
  process.exitCode = 1;
} finally {
  await browser?.close();
  closeSockets();
  coopService.shutdown();
  app.locals.social?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

function inspectLobbyMain() {
  const main = document.querySelector('.lv-main');
  const rect = main.getBoundingClientRect();
  return {
    documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    mainOverflow: main.scrollWidth > main.clientWidth + 1,
    mainLeft: rect.left,
    mainRight: rect.right,
    buttons: [...main.querySelectorAll('button')].filter(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden').map(button => {
      const buttonRect = button.getBoundingClientRect();
      return { id: button.id, x: buttonRect.x, right: buttonRect.right, height: buttonRect.height };
    }),
  };
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${label}`);
}
