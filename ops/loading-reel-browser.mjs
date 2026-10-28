import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createApp} from '../server/app.mjs';
import {parsePlaylist} from '../public/boot-gallery.js';

// Isolated browser and in-memory server, never touches the user's existing tabs.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output=path.resolve('.local/loading-reel-qa');await fs.mkdir(output,{recursive:true});
const original=await fs.readFile('dist/index.html','utf8');
const fixture=original.replace(/<script[^>]*src="\/assets\/index-[^"]+\.js"[^>]*><\/script>/g,'');
assert.notEqual(fixture,original,'only withhold the heavy game bundle for the loading fixture');
const playlist=JSON.parse(await fs.readFile('public/assets/loading/playlist.json','utf8'));
assert.equal(parsePlaylist(playlist).length,5);
assert.equal(parsePlaylist({items:[{type:'video',src:'https://example.com/a.mp4'},{type:'image',src:'/assets/../a.png'},{type:'video',src:'/assets/a.png'}]}).length,0);
const app=createApp({distDir:path.resolve('dist')});
const server=http.createServer((req,res)=>{
  if(req.url==='/reel-fixture'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'");res.end(fixture);
  }else app(req,res);
}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`,errors=[];
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  // Vite moves the heavy module to the head: async reel must work even while it is still downloading.
  const delayed=await browser.newContext({serviceWorkers:'block'}),slow=await delayed.newPage();
  let releaseMain;const mainGate=new Promise(resolve=>releaseMain=resolve);
  await slow.route('**/assets/index-*.js',async route=>{await mainGate;await route.abort().catch(()=>{});});
  await slow.goto(base,{waitUntil:'commit'});
  await slow.waitForFunction(()=>document.querySelector('.boot-stage')?.dataset.paused==='false');
  await slow.locator('#boot-next').click();await slow.waitForFunction(()=>document.querySelector('#boot-slide').textContent==='02 / 05');
  await delayed.close();releaseMain();
  const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(base+'/reel-fixture');
  await page.waitForFunction(()=>document.querySelector('#boot-slide').textContent==='01 / 05');
  await page.clock.runFor(8100);await page.waitForFunction(()=>document.querySelector('#boot-slide').textContent==='02 / 05');
  await page.locator('#boot-pause').click();await page.clock.runFor(20000);
  assert.equal(await page.locator('#boot-slide').textContent(),'02 / 05','manual pause');
  await page.locator('#boot-next').click();await page.waitForFunction(()=>document.querySelector('#boot-slide').textContent==='03 / 05');
  await page.locator('#boot-prev').click();await page.waitForFunction(()=>document.querySelector('#boot-slide').textContent==='02 / 05');
  await page.locator('#boot-pause').click();
  for(const expected of ['03 / 05','04 / 05','05 / 05','01 / 05']){
    await page.clock.runFor(8100);await page.waitForFunction(e=>document.querySelector('#boot-slide').textContent===e,expected);
  }
  for(const [name,width,height]of [['desktop',1280,800],['phone',390,844],['small',320,568],['landscape',844,390]]){
    await page.setViewportSize({width,height});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1),false);
    for(const selector of ['.boot-logo','.boot-loading','.boot-reel','.boot-controls']){
      const r=await page.locator(selector).boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,selector);
    }
    await page.screenshot({path:path.join(output,name+'.png')});
  }
  await page.evaluate(()=>{document.querySelector('#boot-progress').value=37;document.querySelector('#boot-detail').textContent='37% · 下载中';});
  await page.locator('#boot-next').click();await page.clock.runFor(1000);
  assert.equal(await page.locator('#boot-progress').evaluate(p=>p.value),37);
  // Hidden tab freezes the reel and returns with its remaining display time.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const before=await page.locator('#boot-slide').textContent();await page.clock.runFor(16000);assert.equal(await page.locator('#boot-slide').textContent(),before);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.runFor(8100);await page.waitForFunction(v=>document.querySelector('#boot-slide').textContent!==v,before);
  // Rejected autoplay skips the video without requesting a nonexistent placeholder.
  const a=playlist.items[0],b=playlist.items[1];
  await page.route('**/assets/loading/playlist.json',route=>route.fulfill({json:{items:[a,{type:'video',src:'/assets/video/escape-opening-v1.mp4',title:'CG',seconds:15},b]}}));
  await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Denied','NotAllowedError'));};});
  await page.reload();await page.locator('#boot-next').click();
  await page.waitForFunction(()=>document.querySelector('#boot-slide').textContent==='03 / 03');
  assert.equal(await page.locator('.boot-frame.is-current').getAttribute('src'),b.src);
  // Pending play/load cannot hold the reel forever; the old image remains until fallback is ready.
  await page.reload();
  await page.evaluate(()=>{HTMLMediaElement.prototype.play=function(){return new Promise(()=>{});};});
  await page.locator('#boot-next').click();
  assert.equal(await page.locator('.boot-frame.is-current').getAttribute('src'),a.src);
  await page.clock.runFor(6100);await page.waitForFunction(()=>document.querySelector('#boot-slide').textContent==='03 / 03');
  await context.close();
  // Real decoder/media events: existing CG is only a test fixture, not a release playlist entry.
  const mediaContext=await browser.newContext({serviceWorkers:'block'}),media=await mediaContext.newPage();
  media.on('pageerror',e=>errors.push(e.message));
  await media.route('**/assets/loading/playlist.json',route=>route.fulfill({json:{items:[a,{type:'video',src:'/assets/video/escape-opening-v1.mp4',title:'CG',seconds:15},b]}}));
  await media.goto(base+'/reel-fixture');await media.locator('#boot-next').click();
  await media.waitForFunction(()=>!!document.querySelector('video.is-current'));
  assert.deepEqual(await media.locator('video.is-current').evaluate(v=>({muted:v.muted,inline:v.playsInline,playing:!v.paused})),{muted:true,inline:true,playing:true});
  await media.locator('#boot-pause').click();assert.equal(await media.locator('video.is-current').evaluate(v=>v.paused),true);
  await media.locator('#boot-pause').click();
  await media.locator('video.is-current').evaluate(v=>v.currentTime=Math.max(0,v.duration-.2));
  await media.waitForFunction(()=>document.querySelector('#boot-slide').textContent==='03 / 03');
  // Disposal prevents loading page timers from surviving entry into the game.
  await media.evaluate(()=>document.querySelector('#app').replaceChildren());await media.waitForTimeout(100);
  assert.equal(await media.locator('video').count(),0);
  await mediaContext.close();
  // Reduced motion, touch controls and offline cached loading assets on the real app.
  const real=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'allow'}),game=await real.newPage();
  game.on('pageerror',e=>errors.push(e.message));await game.goto(base);await game.locator('#bath').waitFor({timeout:60000});
  await game.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await game.evaluate(async()=>!!await caches.match('/boot-gallery.js',{ignoreSearch:true})&&!!await caches.match('/assets/loading/playlist.json',{ignoreSearch:true})),true);
  await real.setOffline(true);await game.reload();await game.locator('#bath').waitFor();
  await game.locator('#bath').tap();await game.locator('#halloween').waitFor();
  assert.equal(errors.length,0,errors.join('\n'));
  await fs.writeFile(path.join(output,'proof.json'),JSON.stringify({independentOfHeavyModule:true,loop:true,pause:true,manualNavigation:true,hiddenFreeze:true,realProgressUnaffected:true,layouts:4,autoplayRejectedFallback:true,videoLoadTimeoutFallback:true,realVideoPlayback:true,videoEndedAdvances:true,offline:true,touch:true,errors},null,2));
  console.log('Loading reel: loop, pause, four layouts, autoplay rejection, actual MP4 playback/end, real startup, touch and offline passed.');
  await real.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
