import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { levels } from '../src/game/levels.ts';
import { modeIndices } from '../src/game/modes.ts';
// Optional integration QA, isolated from user tabs and data.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = path.resolve(process.env.HOME_QA_DIR ?? '.local/home-qa');
await fs.mkdir(output, { recursive: true });
const server = createApp({distDir:fileURLToPath(new URL('../dist/', import.meta.url))}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`, errors=[];
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1','--disable-background-networking']});
  const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'allow'});
  const page=await context.newPage();
  const settleUI=()=>page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base); await page.locator('.game-hub').waitFor();
  const layouts=[];
  for(const [name,width,height] of [['desktop',1280,800],['phone',390,844],['small',320,568],['landscape',844,390]]) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>[...document.querySelectorAll('.mode-art')].every(i=>i.complete&&i.naturalWidth));
    const layout=await page.evaluate(()=>{
      const cards=[...document.querySelectorAll('.mode-poster')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
      return {cards,overflow:document.documentElement.scrollWidth>innerWidth,globalContinue:!!document.querySelector('#continue'),text:document.querySelector('.game-hub').innerText};
    });
    assert.equal(layout.cards.length,3); assert.equal(layout.globalContinue,false); assert.equal(layout.overflow,false);
    for(const r of layout.cards) {assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1);assert.ok(r.h>=120&&r.w>=150);}
    assert.ok(Math.max(...layout.cards.map(r=>r.h))-Math.min(...layout.cards.map(r=>r.h))<1);
    for(const text of ['普通模式','恐怖模式','极限恐怖'])assert.ok(layout.text.includes(text));
    await settleUI(); await page.screenshot({path:path.join(output,`${name}.png`)}); layouts.push({name,...layout});
  }
  await page.setViewportSize({width:1280,height:800});
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(()=>document.activeElement.id),'settings');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(()=>document.activeElement.id),'normal');
  await page.keyboard.press('Enter'); await page.locator('#mode-continue').waitFor(); await page.locator('#home').click();
  await page.locator('#settings').click();
  await page.setViewportSize({width:390,height:844}); await page.screenshot({path:path.join(output,'phone-settings.png')});
  await page.setViewportSize({width:1280,height:800});
  assert.equal(await page.locator('#export').isVisible(),false,'backup tools are optional, not a long default settings page');
  await page.locator('.save-settings summary').click();
  const fixture={version:1,levels:{}};
  for(const i of [...modeIndices('normal').slice(0,3),modeIndices('horror')[0]])fixture.levels[levels[i].id]={completed:true,collected:7};
  fixture.levels[levels[0].id].bestScore=3474;fixture.levels[levels[0].id].bestTimeMs=2662;
  await page.locator('#import-file').setInputFiles({name:'legacy-v1.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await page.waitForFunction(()=>document.querySelector('.modal-feedback')?.textContent==='存档已导入。');
  const exportProgress=async()=>{const pending=page.waitForEvent('download');await page.locator('#export').click();return JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));};
  const before=await exportProgress(), preferences=await page.evaluate(()=>localStorage.getItem('nwaxz-settings'));
  assert.equal(typeof preferences,'string');
  await page.locator('#help').click(); assert.equal(await page.locator('.help-modes section').count(),3);
  await page.locator('#help-ok').click(); await page.locator('#dialog-close').click();
  for(const mode of ['normal','horror']) {
    const index=modeIndices(mode)[mode==='normal'?3:1];
    await page.locator('#'+mode).click();
    assert.ok((await page.locator('#mode-continue').innerText()).includes(levels[index].title));
    await settleUI(); await page.screenshot({path:path.join(output,`${mode}-chapter.png`)});
    await page.locator('#mode-continue').click();
    assert.equal(await page.locator('#gesture-hint').textContent(),levels[index].hint);
    await page.keyboard.press('Escape'); await page.locator('#quit').click(); await page.locator('#home').click();
  }
  await page.locator('#extreme').click();
  await page.locator('#escape-new').waitFor();
  assert.equal(await page.locator('#escape-new').isVisible(),true);
  assert.equal(await page.locator('#escape-panel').textContent().then(t=>t.includes('原18关')||t.includes('3D')),false);
  await page.locator('#escape-intro-help').click(); assert.ok(await page.locator('.escape-bindings').isVisible());
  await page.locator('#escape-help-close').click(); await page.locator('#escape-intro-saves').click();
  assert.equal(await page.locator('#escape-save-export').isDisabled(),true);
  await page.locator('#escape-saves-back').click(); await page.locator('#escape-intro-exit').click();
  await page.locator('#settings').click(); await page.locator('.save-settings summary').click();
  assert.deepEqual(await exportProgress(),before,'menu navigation and unfinished runs preserve all previous scores');
  assert.equal(await page.evaluate(()=>localStorage.getItem('nwaxz-settings')),preferences);
  await page.locator('#dialog-close').click();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready}); await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.ok(await page.evaluate(async()=>!!await caches.match('/assets/scenes/haunted-cover-v1.webp',{ignoreSearch:true})));
  await context.setOffline(true); await page.reload(); await page.locator('.game-hub').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.mode-art')].every(i=>i.complete&&i.naturalWidth));
  for(const mode of ['normal','horror']) {await page.locator('#'+mode).click();await page.locator('#mode-continue').waitFor();await page.locator('#home').click();}
  await page.locator('#extreme').click(); await page.locator('#escape-new').waitFor(); await page.locator('#escape-intro-exit').click();
  await page.screenshot({path:path.join(output,'offline.png')});
  const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const touch=await phone.newPage(); await touch.goto(base); await touch.locator('#horror').tap(); await touch.locator('#mode-continue').waitFor(); await touch.locator('#home').tap();
  await touch.locator('#extreme').tap(); await touch.locator('#escape-new').waitFor(); await touch.locator('#escape-intro-exit').tap();
  await touch.screenshot({path:path.join(output,'touch.png')}); await phone.close();
  assert.deepEqual(errors,[]); console.log(JSON.stringify({layouts,importExport:true,modeCheckpoints:true,offline:true,touch:true,errors}));
  await context.close();
}catch(e){console.error(e);console.error(errors);process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));}
