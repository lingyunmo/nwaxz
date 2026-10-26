import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { levels } from '../src/game/levels.ts';
import { EscapeWorld } from '../src/escape/world.ts';
import { SAVE_GENERATION, SAVE_GENERATION_KEY } from '../src/save-generation.ts';

// Uses a fresh headless Chromium context and a local dist server; it never opens a user browser/profile.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
assert.ok(process.env.CHROMIUM_PATH, 'CHROMIUM_PATH must identify the independent Chromium executable');
const server = createApp({ distDir: fileURLToPath(new URL('../dist/', import.meta.url)) }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const guest=await(await fetch(base+'/api/social/guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'保留身份',avatar:0})})).json();
const guestValue=JSON.stringify({version:1,...guest});
let browser;

const readProgress = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('nwaxz');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('state')) { db.close(); resolve(undefined); return; }
    const tx = db.transaction('state', 'readonly'), read = tx.objectStore('state').get('progress');
    read.onsuccess = () => resolve(read.result ?? { version: 1, levels: {} });
    read.onerror = () => reject(read.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error); };
  };
}));
let page;

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--renderer-process-limit=1', '--disable-background-networking'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' });
  page = await context.newPage();
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} ${JSON.stringify(message.location())}`); });

  // Write previous-release data through an actual same-origin page before the app loads.
  await page.goto(`${base}/api/health`);
  await page.evaluate(({ progress, marker, guestValue }) => new Promise((resolve, reject) => {
    localStorage.setItem(marker, '2025-08-legacy');
    localStorage.setItem('nwaxz-settings', JSON.stringify({ music: true, sound: false, vibration: false, reducedMotion: true, quality: 'high' }));
    localStorage.setItem('nwaxz-escape-session-v1', JSON.stringify({ version: 1, player: { x: 3.5, z: 5.5 }, phase: 'playing' }));
    localStorage.setItem('nwaxz-escape-record-v1', JSON.stringify({ escapes: 3, bestTimeMs: 1 }));
    localStorage.setItem('independent-app-data', 'leave-this-alone');
    localStorage.setItem('nwaxz-social-identity-v1',guestValue);
    const request = indexedDB.open('nwaxz', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(progress, 'progress');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), {
    marker: SAVE_GENERATION_KEY,
    guestValue,
    progress: { version: 1, levels: { [levels[0].id]: { completed: true, collected: 7 } } },
  });

  await page.goto(base);
  await page.locator('.game-hub').waitFor({ timeout: 60000 });
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_GENERATION_KEY), SAVE_GENERATION);
  assert.equal(await page.evaluate(() => localStorage.getItem('nwaxz-settings')), JSON.stringify({ music: false, sound: true, vibration: true, reducedMotion: false, quality: 'balanced' }));
  assert.equal(await page.evaluate(() => localStorage.getItem('nwaxz-escape-session-v1')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('nwaxz-escape-record-v1')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('independent-app-data')), 'leave-this-alone');
  assert.equal(await page.evaluate(()=>localStorage.getItem('nwaxz-social-identity-v1')),guestValue,'game save reset preserves server guest identity');
  assert.deepEqual(await readProgress(), { version: 1, levels: {} }, 'old ordinary progress is reset');

  const normalRecord = { completed: true, collected: 5, bestScore: 2400, bestTimeMs: 90_000 };
  const seededCurrent = { version: 1, levels: { [levels[0].id]: normalRecord } };
  await page.evaluate(progress => new Promise((resolve, reject) => {
    const request = indexedDB.open('nwaxz');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(progress, 'progress');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), seededCurrent);
  await page.reload(); await page.locator('.game-hub').waitFor({ timeout: 60000 });
  assert.deepEqual(await readProgress(), seededCurrent, 'matching generation preserves current progress on reload');

  const beforeSchemaResetSettings = await page.evaluate(() => localStorage.getItem('nwaxz-settings'));
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('nwaxz');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({ version: 999, levels: {} }, 'progress');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.reload(); await page.locator('.game-hub').waitFor({ timeout: 60000 });
  assert.deepEqual(await readProgress(), { version: 1, levels: {} }, 'same-generation incompatible progress resets');
  assert.equal(await page.evaluate(() => localStorage.getItem('nwaxz-settings')), beforeSchemaResetSettings, 'schema reset preserves settings');
  assert.equal(await page.evaluate(() => localStorage.getItem('independent-app-data')), 'leave-this-alone');

  // The currently stored escape session key is game-owned; v1 snapshots do not offer Resume.
  await page.evaluate(() => localStorage.setItem('nwaxz-escape-session-v1', JSON.stringify({ version: 1, player: { x: 3.5, z: 5.5 }, phase: 'playing' })));
  await page.locator('#extreme').click();await page.locator('#escape-menu-solo').click();
  await page.locator('#escape-new').waitFor({ timeout: 30000 });
  assert.equal(await page.locator('#escape-continue').count(), 0, 'old v1 escape snapshot cannot continue');
  assert.equal(await page.evaluate(() => localStorage.getItem('nwaxz-escape-session-v1')), null, 'old escape snapshot is removed');
  await page.locator('#escape-solo-back').click(); await page.locator('#escape-intro-exit').click();

  // A current v2 escape snapshot remains resumable and survives pause/resume/save cycles.
  const currentEscape = new EscapeWorld(42).snapshot();
  await page.evaluate(save => localStorage.setItem('nwaxz-escape-session-v1', JSON.stringify(save)), currentEscape);
  await page.reload(); await page.locator('.game-hub').waitFor({ timeout: 60000 });
  await page.locator('#extreme').click();await page.locator('#escape-menu-solo').click();
  await page.locator('#escape-continue').waitFor({ timeout: 30000 });
  await page.locator('#escape-continue').click();
  await page.locator('#escape-panel[hidden]').waitFor({ state: 'attached', timeout: 60000 });
  await page.keyboard.press('Escape');
  await page.locator('#escape-resume').waitFor();
  const pausedEscape = await page.evaluate(() => JSON.parse(localStorage.getItem('nwaxz-escape-session-v1')));
  assert.equal(pausedEscape.version, 2);
  assert.deepEqual(EscapeWorld.restore(pausedEscape).snapshot(), pausedEscape, 'v2 session survives continue and pause with a valid current snapshot');
  for (const key of ['x', 'z', 'angle', 'pitch'])
    assert.equal(pausedEscape.player[key], currentEscape.player[key], `the resumed player ${key} is retained`);
  await page.locator('#escape-resume').click();
  await page.keyboard.press('Escape'); await page.locator('#escape-exit').click();

  // Exercise the actual ordinary save management dialog and hidden file input.
  await page.evaluate(progress => new Promise((resolve, reject) => {
    const request = indexedDB.open('nwaxz');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(progress, 'progress');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), seededCurrent);
  await page.locator('#settings').click();
  await page.locator('.save-settings summary').click();
  const settingsBeforeBackup = await page.evaluate(() => localStorage.getItem('nwaxz-settings'));
  const currentBeforeImport = await readProgress();
  const oldBackup = { version: 1, levels: { [levels[1].id]: { completed: true, collected: 7 } } };
  const [oldChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#import').click()]);
  await oldChooser.setFiles({ name: 'old-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldBackup)) });
  await page.waitForFunction(() => document.querySelector('.modal-feedback')?.textContent?.includes('这份存档属于旧版本，请重新开始。'));
  assert.deepEqual(await readProgress(), currentBeforeImport, 'old backup rejection leaves current progress intact');

  const validBackup = {
    generation: SAVE_GENERATION,
    progress: { version: 1, levels: { [levels[1].id]: { completed: true, collected: 3, bestTimeMs: 120_000 } } },
  };
  const [validChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#import').click()]);
  await validChooser.setFiles({ name: 'current-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(validBackup)) });
  await page.waitForFunction(() => document.querySelector('.modal-feedback')?.textContent === '存档已导入。');
  const merged = await readProgress();
  assert.deepEqual(merged.levels[levels[0].id], normalRecord);
  assert.deepEqual(merged.levels[levels[1].id], validBackup.progress.levels[levels[1].id]);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#export').click();
  const exported = JSON.parse(await (await downloadEvent).createReadStream().then(async stream => {
    let value = ''; for await (const chunk of stream) value += chunk; return value;
  }));
  assert.equal(exported.generation, SAVE_GENERATION);
  assert.deepEqual(exported.progress, merged, 'export uses the active generation and current merged progress');
  assert.equal(await page.evaluate(() => localStorage.getItem('nwaxz-settings')), settingsBeforeBackup);

  assert.deepEqual(errors, [], `browser errors: ${errors.join('\n')}`);
  console.log(JSON.stringify({
    generation: SAVE_GENERATION,
    checks: [
      'old generation cleanup and unrelated localStorage preservation',
      'matching progress preservation',
      'same-generation schema reset',
      'old escape rejection and v2 escape resume',
      'old backup rejection and current backup import/export',
    ],
  }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
