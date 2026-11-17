import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { EscapeWorld } from '../src/escape/world.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = path.resolve(process.env.UPSTAIRS_QA_DIR ?? '.local/upstairs-browser-qa');
await fs.mkdir(output, { recursive: true });
const app = createApp({ distDir: fileURLToPath(new URL('../dist/', import.meta.url)) });
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`, errors = [], cases = [];
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
    args: ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'] });
  for (const [width, height, mobile] of [[1280, 800, false], [390, 844, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.locator('#extreme').waitFor({ timeout: 90000 });
    const world = new EscapeWorld(42);
    Object.assign(world.data.player, { x: 36.7, z: 3.4, angle: 0, pitch: -.72, light: false });
    world.data.elapsed = 20;
    Object.assign(world.data.hunter, { x: 22.5, z: 5.5, state: 'chase' });
    Object.assign(world.data.hunt, { noise: 80, glare: 80, sight: 100, exposure: 100 });
    world.data.interference = { profile: 0, stage: 'corrupt', clear: 0, attempt: 0, tick: 0, remaining: 10, clock: 0, seed: 42 };
    await page.evaluate(save => localStorage.setItem('nwaxz-escape-session-v1', JSON.stringify(save)), world.snapshot());
    await page.reload();
    await page.locator('#extreme').click(); await page.locator('#escape-menu-solo').click(); await page.locator('#escape-continue').click();
    await page.locator('#escape-panel[hidden]').waitFor({ state: 'attached', timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#escape-exposure-value')?.textContent === '0');
    assert.match(await page.locator('#escape-room').textContent(), /二楼/);
    assert.equal(await page.locator('#escape-hunt-state').textContent(), '二楼安全区');
    assert.equal(await page.locator('.escape-hunt').evaluate(el => el.classList.contains('interfered')), false);
    assert.equal(await page.locator('.escape-hunt').evaluate(el => el.classList.contains('critical')), false);
    await page.screenshot({ path: path.join(output, `window-${width}.png`) });
    if (!mobile) {
      await page.keyboard.down('w'); await page.waitForTimeout(350); await page.keyboard.up('w');
      assert.equal(await page.locator('#escape-exposure-value').textContent(), '0');
      await page.keyboard.press('m');
    } else await page.locator('#escape-map').tap();
    await page.locator('#escape-map-upstairs[aria-pressed="true"]').waitFor();
    for (const floor of ['ground', 'basement', 'upstairs']) await page.locator(`#escape-map-${floor}`).click();
    assert.match(await page.locator('#escape-map-current').textContent(), /二楼/);
    await page.screenshot({ path: path.join(output, `map-${width}.png`) });
    const tabs = await page.locator('.escape-floor-tabs').boundingBox();
    assert.ok(tabs.x >= 0 && tabs.x + tabs.width <= width + 1, 'all three floor tabs fit the viewport');
    await page.locator('#escape-map-close').click();
    if (mobile) await page.locator('#escape-pause').tap();
    else { await page.waitForTimeout(300); await page.keyboard.press('Escape'); }
    await page.locator('#escape-resume').waitFor();
    const save = JSON.parse(await page.evaluate(() => localStorage.getItem('nwaxz-escape-session-v1')));
    assert.equal(save.mapWidth, 39); assert.ok(save.player.x <= 36.83);
    assert.equal(save.hunt.exposure, 0); assert.equal(save.interference.stage, 'clear');
    assert.equal(save.phase, 'playing'); assert.ok(save.hunter.x < 23);
    cases.push({ width, height, floor: 1, exposure: save.hunt.exposure, interference: save.interference.stage, tabsFit: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ cases, errors }, null, 2));
  console.log(JSON.stringify({ cases, errors, output }));
} finally {
  await browser?.close(); app.locals.coop.close(); app.locals.social.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
