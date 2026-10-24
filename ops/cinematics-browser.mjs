import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
import {EscapeWorld} from '../src/escape/world.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve('.local/cinematics-qa'); await fs.mkdir(output,{recursive:true});
const server=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`, errors=[];
let browser;
const sessionKey='nwaxz-escape-session-v1';
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
  const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'allow'}), page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base); await page.locator('#extreme').click(); await page.locator('#escape-new').click();
  const video=page.locator('.escape-cinematic video');
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.35);
  assert.match(await video.getAttribute('src'),/opening/);
  assert.equal(await video.evaluate(v=>v.muted),false);
  await page.locator('#cinematic-play').click(); const at=await video.evaluate(v=>v.currentTime);
  const saved=await page.evaluate(k=>localStorage.getItem(k),sessionKey);
  await page.keyboard.press('w'); await page.waitForTimeout(250);
  assert.equal(await video.evaluate(v=>v.currentTime),at);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),sessionKey),saved,'paused CG must not advance save or simulation');
  await page.screenshot({path:path.join(output,'opening.png')});
  await page.locator('#cinematic-sound').click(); assert.equal(await video.evaluate(v=>v.muted),true);
  await page.locator('#cinematic-play').click(); // mute resumes a paused clip; pause it again
  await page.locator('#cinematic-play').click();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await video.evaluate(v=>v.paused),true);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await video.evaluate(v=>v.paused),true,'returning to foreground must wait for a deliberate play');
  await page.locator('#cinematic-play').click();
  await page.locator('.escape-cinematic').waitFor({state:'detached',timeout:20000}); // natural ending
  await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  await page.keyboard.press('Escape'); await page.locator('#escape-exit').click();
  await page.locator('#extreme').click(); await page.locator('#escape-continue').click();
  await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  assert.equal(await page.locator('.escape-cinematic').count(),0,'continue must not replay opening');
  await page.keyboard.press('Escape'); await page.locator('#escape-exit').click();
  const selected=[];
  for(let n=0;n<3;n++) {
    const world=new EscapeWorld();
    for(let prior=0;prior<n;prior++){world.capture();world.nextNight();}
    Object.assign(world.data.hunter,{x:3.6,z:5.5,state:'chase'});
    await page.evaluate(({key,snapshot,rng})=>{localStorage.setItem(key,JSON.stringify(snapshot));Math.random=()=>rng;},{key:sessionKey,snapshot:world.snapshot(),rng:(n+.1)/3});
    await page.locator('#extreme').click(); await page.locator('#escape-continue').click();
    await page.locator('.escape-cinematic video').waitFor({timeout:30000});
    const src=await page.locator('video').getAttribute('src'); selected.push(src);
    assert.ok(src.endsWith(`caught-${n+1}-v1.mp4`));
    const during=await page.evaluate(k=>localStorage.getItem(k),sessionKey);
    assert.equal(JSON.parse(during).captures,n+1);
    await page.keyboard.press('w'); await page.waitForTimeout(250);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),sessionKey),during);
    if(n===0) {
      await page.waitForFunction(()=>document.querySelector('video')?.currentTime>4.3);
      await page.screenshot({path:path.join(output,'caught-laugh.png')});
      await page.locator('.escape-cinematic').waitFor({state:'detached',timeout:15000});
    } else await page.locator('#cinematic-skip').click();
    await page.locator('.capture-active').waitFor();
    assert.match(await page.locator('#escape-next').innerText(),n===2?/重新开始/:/醒来/);
    const original=await page.locator('#escape-view').screenshot(); await page.waitForTimeout(850);
    const next=await page.locator('#escape-view').screenshot();
    if(original.equals(next)) {
      await fs.writeFile(path.join(output,`frozen-${n}.png`),next);
      console.error({capture:n+1,state:await page.evaluate(()=>({hidden:document.hidden,cg:!!document.querySelector('video'),capture:document.querySelector('.escape-shell').className}))});
    }
    assert.ok(!original.equals(next),'classic belly laugh still animates');
    await page.locator('#escape-result-exit').click();
  }
  // Recover from a blocked play() without hiding the CG behind an unresponsive screen.
  const blocked=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await blocked.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;let first=true;HTMLMediaElement.prototype.play=function(){if(first){first=false;return Promise.reject(new DOMException('blocked','NotAllowedError'));}return play.call(this);};});
  const phone=await blocked.newPage(); phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(base); await phone.locator('#extreme').tap(); await phone.locator('#escape-new').tap();
  await phone.getByText('点击播放',{exact:true}).waitFor();
  await phone.locator('#cinematic-play').tap(); await phone.waitForFunction(()=>document.querySelector('video')?.currentTime>.3);
  await phone.screenshot({path:path.join(output,'phone.png')});
  const fit=await phone.locator('video').evaluate(v=>getComputedStyle(v).objectFit); assert.equal(fit,'contain');
  await phone.locator('#cinematic-skip').tap(); await phone.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  await phone.locator('#escape-pause').tap(); await phone.locator('#escape-exit').tap();
  const missing=await browser.newContext({serviceWorkers:'block'}),fallback=await missing.newPage();
  fallback.on('pageerror',e=>errors.push(e.message));
  await fallback.route('**/assets/video/escape-opening-v1.mp4',r=>r.fulfill({status:404,body:''}));
  await fallback.goto(base);
  await fallback.locator('#enter-now').waitFor({timeout:40000});
  await fallback.locator('#enter-now').click();
  await fallback.locator('#extreme').click();await fallback.locator('#escape-new').click();
  await fallback.locator('#escape-panel[hidden]').waitFor({state:'attached',timeout:30000});
  assert.equal(await fallback.locator('.escape-cinematic').count(),0,'missing CG must fall back to playable scene');
  await missing.close();
  // Full cached MP4 must serve byte ranges while disconnected.
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const urls=['opening','caught-1','caught-2','caught-3'].map(x=>`/assets/video/escape-${x}-v1.mp4`);
  const cachedVideos=await page.evaluate(async urls=>Promise.all(urls.map(async url=>!!await caches.match(url,{ignoreSearch:true}))),urls);
  assert.ok(cachedVideos.every(Boolean),'all four complete cinematic videos must be present in the precache');
  await context.setOffline(true);
  for(const url of urls){
    const range=await page.evaluate(async u=>{const r=await fetch(u,{headers:{Range:'bytes=0-255'}});return{status:r.status,length:(await r.arrayBuffer()).byteLength,range:r.headers.get('content-range')};},url);
    assert.equal(range.status,206);assert.equal(range.length,256);assert.match(range.range,/^bytes 0-255\//);
  }
  await page.reload(); await page.locator('#extreme').click(); await page.locator('#escape-new').click();
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.3);
  await page.screenshot({path:path.join(output,'offline.png')}); await page.locator('#cinematic-skip').click();
  await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  await blocked.close(); await context.close();
  console.log(JSON.stringify({selected,openingNaturalEnd:true,captureNaturalEnd:true,skip:true,pausedSimulation:true,simulatedBackgroundPause:true,missingVideoFallback:true,blockedPlayRecovery:true,offlineRange:true,errors}));
  assert.deepEqual(errors,[]);
} finally {await browser?.close();await new Promise(r=>server.close(r));}
