import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from '../server/app.mjs';
import { EscapeWorld, ROOMS, SIZE } from '../src/escape/world.ts';
import { SAVE_GENERATION, SAVE_GENERATION_KEY } from '../src/save-generation.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const server = createApp({ distDir }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const output = path.resolve('.local/hud-layout-v024');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'] });
const pageErrors = [];
const SESSION = 'nwaxz-escape-session-v1';

function basementFixture() {
  const world = new EscapeWorld(214);
  Object.assign(world.data.player, { x: 12.5, z: 40.5, angle: -Math.PI / 2, pitch: 0, light: false, battery: 100, crouched: false, sprinting: false, winded: false });
  Object.assign(world.data.hunter, { x: 21.5, z: 31.5, angle: 0, state: 'patrol' });
  world.data.elapsed = 12;
  return world.snapshot();
}

async function newGame({ mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }, deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile, hasTouch: mobile, serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__hudMapLabels = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.canvas?.id === 'escape-floorplan') window.__hudMapLabels.push(String(text));
      return fillText.call(this, text, ...args);
    };
  });
  await page.goto(base);
  await page.locator('#extreme').waitFor({ state: 'visible', timeout: 60000 });
  await page.evaluate(({ key, value, generationKey, generation }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(generationKey, generation);
    localStorage.setItem('nwaxz-escape-hud-v1', 'compact');
    localStorage.setItem('nwaxz-escape-sound-v1', JSON.stringify({ music: false, sound: false }));
  }, { key: SESSION, value: basementFixture(), generationKey: SAVE_GENERATION_KEY, generation: SAVE_GENERATION });
  await page.locator('#extreme').click();
  await page.locator('#escape-menu-solo').click();
  try { await page.locator('#escape-continue').waitFor({ state: 'visible', timeout: 15000 }); }
  catch (error) {
    console.error('Solo resume menu diagnostic', await page.evaluate(key => ({
      saved: localStorage.getItem(key)?.slice(0, 120),
      panel: document.querySelector('#escape-panel')?.innerText,
      panelClass: document.querySelector('#escape-panel')?.className,
      lobby: document.querySelector('.lv-main')?.innerText?.slice(0, 180),
    }), SESSION));
    throw error;
  }
  await page.locator('#escape-continue').click();
  await page.locator('#escape-panel').waitFor({ state: 'hidden', timeout: 90000 });
  await page.locator('.escape-hunt').waitFor({ state: 'visible', timeout: 90000 });
  await page.locator('.escape-ability-status').waitFor({ state: 'visible', timeout: 15000 });
  return { context, page };
}

async function inspectHud(page, width, height, coarse) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  const view = await page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!element) return undefined;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || box.width < 1 || box.height < 1) return undefined;
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const hidden = selector => {
      const element = document.querySelector(selector);
      if (!element) return true;
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return style.display === 'none' || style.visibility === 'hidden' || box.width < 1 || box.height < 1;
    };
    return {
      hunt: rect('.escape-hunt'), ability: rect('.escape-ability-hud'), map: rect('#escape-map'),
      mapCanvas: rect('#escape-minimap'), compactSources: hidden('.escape-secondary-meters'),
      mapWidth: document.querySelector('#escape-minimap')?.width,
      hudOverlap: (() => {
        const boxes = ['.escape-hunt','.escape-ability-hud','#escape-map'].map(selector => {
          const el=document.querySelector(selector),r=el?.getBoundingClientRect();
          const style=el&&getComputedStyle(el);
          return !el||!r||style.display==='none'||style.visibility==='hidden'||r.width<1||r.height<1?undefined:{selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        }).filter(Boolean);
        return boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2).map(b=>`${a.selector}/${b.selector}`));
      })(),
      crystalButtons: [...document.querySelectorAll('.escape-crystals button')].map(button => ({
        id: button.id, name: button.querySelector('span')?.textContent?.trim(), count: button.querySelector('b')?.textContent?.trim(),
        durationHidden: (() => { const n = button.querySelector('small'); return !n || getComputedStyle(n).display === 'none' || getComputedStyle(n).visibility === 'hidden'; })(),
        box: (() => { const r = button.getBoundingClientRect(); return { width: r.width, height: r.height }; })(),
      })),
      actionButtons: [...document.querySelectorAll('.escape-actions>button')].map(button => { const r = button.getBoundingClientRect(); return { id: button.id, width: r.width, height: r.height }; }),
      huntNumbers: [...document.querySelectorAll('.escape-source b,.escape-source em')].map(el => ({ id: el.id, display: getComputedStyle(el).display, text: el.textContent })),
      sourceNames: [...document.querySelectorAll('.escape-source strong')].map(el => el.textContent.trim()),
      sourceBars: [...document.querySelectorAll('.escape-source meter')].length,
    };
  });
  assert.ok(view.hunt, `${width}x${height} keeps the exposure card visible`);
  assert.ok(view.ability && view.ability.left < width / 3 && view.ability.width <= 220, `${width}x${height} keeps the compact enemy skill card at the left`);
  assert.ok(view.map && view.map.width >= 138, `${width}x${height} enlarges the default minimap`);
  assert.deepEqual(view.hudOverlap, [], `${width}x${height} separates the minimap, exposure and enemy skill card`);
  assert.equal(view.compactSources, true, `${width}x${height} starts with source details compact`);
  assert.deepEqual(view.crystalButtons.map(button => button.name), ['冻结', '显形', '净化'], `${width}x${height} shows two-character crystal names`);
  assert.ok(view.crystalButtons.every(button => button.count !== '' && button.durationHidden), `${width}x${height} keeps crystal counts and hides duration copy`);
  if (coarse) {
    assert.ok([...view.crystalButtons.map(button => button.box), ...view.actionButtons].every(button => button.width >= 44 && button.height >= 44), `${width}x${height} keeps touch targets at least 44px`);
  }
  await page.screenshot({ path: path.join(output, `${width}x${height}.png`) });
  return view;
}

async function inspectDetailsAndPause(page, width, height) {
  await page.keyboard.press('Tab');
  await page.locator('.escape-hunt.details-open').waitFor({ state: 'visible', timeout: 5000 });
  const sources = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.escape-source strong')].map(el => el.textContent.trim()),
    bars: [...document.querySelectorAll('.escape-source meter')].length,
    numbersVisible: [...document.querySelectorAll('.escape-source b,.escape-source em')].some(el => {
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }),
    totalVisible: (() => { const n = document.querySelector('#escape-exposure-value'); const r = n.getBoundingClientRect(); return getComputedStyle(n).display !== 'none' && r.width > 0; })(),
  }));
  assert.equal(sources.bars, 3, `${width}x${height} shows three source bars`);
  assert.deepEqual(sources.labels, ['声音', '灯光', '视觉']);
  assert.equal(sources.numbersVisible, false, 'source contribution/value numbers remain hidden');
  assert.equal(sources.totalVisible, true, 'the total exposure value remains visible');
  await page.screenshot({ path: path.join(output, `${width}x${height}-details.png`) });
  const overlap = await page.evaluate(() => {
    const rect = selector => { const element = document.querySelector(selector), r = element?.getBoundingClientRect(); return r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    const boxes = [['.escape-ability-hud',rect('.escape-ability-hud')],['#escape-map',rect('#escape-map')],['.escape-hunt',rect('.escape-hunt')]].filter(([,box])=>box);
    return boxes.flatMap(([name,a],i)=>boxes.slice(i+1).filter(([,b])=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2).map(([other])=>`${name}/${other}`));
  });
  assert.deepEqual(overlap, [], `${width}x${height} separates the minimap, exposure card and enemy skill card when details are open`);

  await page.locator('#escape-map').click({ force: true });
  await page.locator('.escape-map-panel').waitFor({ state: 'visible', timeout: 5000 });
  const map = await page.locator('#escape-floorplan').boundingBox();
  assert.ok(map && map.width >= 200, `${width}x${height} opens a large exploration map`);
  await page.screenshot({ path: path.join(output, `${width}x${height}-map.png`) });
  await page.waitForFunction(() => window.__hudMapLabels.some(label => /[\u4e00-\u9fff]/u.test(label)), undefined, { timeout: 5000 });
  const labels = await page.evaluate(() => window.__hudMapLabels);
  assert.ok(labels.some(label => /[\u4e00-\u9fff]/u.test(label)), 'explored named rooms are labeled in Chinese');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), SESSION);
  const explored = new Set(saved?.explored ?? []);
  const unexploredRooms = ROOMS.filter(room => {
    if (room.z + room.h <= 24) return false;
    const playerX = Math.floor(saved?.player?.x ?? -1), playerZ = Math.floor(saved?.player?.z ?? -1);
    for (let z = room.z; z < room.z + room.h; z++) for (let x = room.x; x < room.x + room.w; x++) {
      if (explored.has(z * SIZE + x) || x === playerX && z === playerZ) return false;
    }
    return true;
  }).map(room => room.name);
  assert.ok(!labels.some(label => unexploredRooms.includes(label)), `unexplored room labels are not revealed: ${labels.join(', ')}; unexplored=${unexploredRooms.join(', ')}; player=${JSON.stringify(saved?.player)}; explored=${saved?.explored?.length}`);
  await page.locator('#escape-map-close').click();
  await page.locator('.escape-hunt').waitFor({ state: 'visible', timeout: 5000 });

  await page.keyboard.press('Escape');
  await page.locator('.escape-pause-panel').waitFor({ state: 'visible', timeout: 5000 });
  const pause = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector('.escape-pause-menu h2')).fontSize,
    buttons: [...document.querySelectorAll('.escape-pause-menu button,.escape-pause-panel .escape-setting-row button')].map(button => {
      const r = button.getBoundingClientRect(); return { fontSize: getComputedStyle(button).fontSize, height: r.height };
    }),
  }));
  assert.ok(Number.parseFloat(pause.title) >= 24, `${width}x${height} pause title is readable`);
  assert.ok(pause.buttons.length && pause.buttons.every(button => Number.parseFloat(button.fontSize) >= 14 && button.height >= 40), `${width}x${height} pause actions are readable and usable`);
  await page.screenshot({ path: path.join(output, `${width}x${height}-pause.png`) });
  await page.locator('#escape-resume').click();
  await page.keyboard.press('Tab');
}

async function inspectCoopRosterFixture(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => {
    document.querySelector('.escape-shell')?.classList.add('coop-active');
    const team = document.querySelector('#escape-coop-team');
    team.hidden = false;
    team.innerHTML = [0,1,2].map(slot => `<div class="escape-coop-teammate ${slot === 0 ? 'self following' : ''}"><span class="escape-avatar-art" data-avatar="${slot}" aria-hidden="true"></span><span class="escape-coop-player-name">${slot + 1} · 队友${slot + 1}</span><small class="escape-coop-status" data-state="connected">已连接 · 1命</small></div>`).join('');
  });
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => {
    const box = element => {
      const r = element.getBoundingClientRect(), s = getComputedStyle(element);
      return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,visible:s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0 };
    };
    const selectors = ['.escape-hunt','.escape-ability-hud','#escape-map','#escape-inventory','.escape-meters','.escape-stick','.escape-actions','#escape-interact','.escape-crosshair','.escape-crystals'];
    const team = box(document.querySelector('#escape-coop-team'));
    const other = selectors.map(selector => [selector,document.querySelector(selector)]).filter(([,element]) => element).map(([selector,element]) => [selector,box(element)]).filter(([,rect])=>rect.visible);
    const collisions = other.filter(([,rect]) => Math.min(team.right,rect.right)-Math.max(team.left,rect.left)>2&&Math.min(team.bottom,rect.bottom)-Math.max(team.top,rect.top)>2).map(([selector])=>selector);
    return { team, cards:document.querySelectorAll('#escape-coop-team .escape-coop-teammate').length, collisions };
  });
  assert.equal(result.cards, 3, `${width}x${height} roster fixture has three player cards`);
  assert.ok(result.team.visible && result.team.left >= 0 && result.team.top >= 0 && result.team.right <= width && result.team.bottom <= height, `${width}x${height} roster fixture fits viewport: ${JSON.stringify(result)}`);
  assert.deepEqual(result.collisions, [], `${width}x${height} roster fixture avoids HUD overlap`);
  await page.screenshot({ path:path.join(output,`${width}x${height}-coop-fixture.png`) });
}

try {
  const desktop = await newGame();
  for (const [width, height] of [[1280, 800], [900, 500]]) {
    await inspectHud(desktop.page, width, height, false);
    if (width === 1280) await inspectDetailsAndPause(desktop.page, width, height);
  }
  await desktop.context.close();

  const phone = await newGame({ mobile: true });
  for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
    await inspectHud(phone.page, width, height, true);
    if (width === 390) await inspectDetailsAndPause(phone.page, width, height);
  }
  await inspectCoopRosterFixture(phone.page, 390, 844);
  await inspectCoopRosterFixture(phone.page, 844, 390);
  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join('; ')}`);
  console.log('HUD layout browser acceptance passed: 1280x800, 900x500, 390x844, 320x568, 844x390; plus 3-card co-op roster display fixtures at 390x844 and 844x390; source labels, crystal controls, ability card, map labels, pause controls');
  await phone.context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
