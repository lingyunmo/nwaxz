import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createApp} from '../server/app.mjs';
import {levels} from '../src/game/levels.ts';
import {levelArtworkKeys,artworkPaths} from '../src/artwork.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve('.local/fast-startup-qa');await fs.mkdir(output,{recursive:true});
const manifest=JSON.parse(await fs.readFile('dist/preload-manifest.json','utf8'));
const app=createApp({distDir:path.resolve('dist')}),held=new Set(),requests=[];
let holdHeavy=true,holdSurfaces=false,failVideoOnce=true;
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;requests.push(pathname);
  if(pathname==='/legacy-worker'){
    res.setHeader('Content-Type','text/javascript');res.setHeader('Service-Worker-Allowed','/');res.end("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));");return;
  }
  if(pathname==='/legacy-run'||pathname==='/legacy-boot'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><body><input id="existing-run" value="in-progress"><script src="${pathname}.js"></script></body></html>`);return;
  }
  if(pathname==='/legacy-run.js'){
    res.setHeader('Content-Type','text/javascript');res.end("navigator.serviceWorker.register('/legacy-worker',{scope:'/'});");return;
  }
  if(pathname==='/legacy-boot.js'){
    res.setHeader('Content-Type','text/javascript');res.end("navigator.serviceWorker.register('/game-worker',{scope:'/'}).then(reg=>{setInterval(()=>{const w=reg.installing||reg.waiting||reg.active;if(w){const c=new MessageChannel();w.postMessage({type:'PREPARE_GAME'},[c.port2]);c.port1.close();}},100);});");return;
  }
  if(holdSurfaces&&pathname.startsWith('/assets/materials/')||holdHeavy&&(/\.(?:png|mp4|glb)$/.test(pathname)||/^\/assets\/game-.*\.js$/.test(pathname))){
    const release=()=>{if(!res.destroyed)app(req,res)};held.add(release);res.on('close',()=>held.delete(release));return;
  }
  if(!holdHeavy&&failVideoOnce&&pathname==='/assets/video/escape-caught-3-v1.mp4'){
    failVideoOnce=false;res.writeHead(503);res.end('retry fixture');return;
  }
  app(req,res);
}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`,errors=[];let browser,debug;
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.resolve();window.__webglContexts=0;const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if(/webgl/.test(kind))window.__webglContexts++;return original.call(this,kind,...args)}});
  const p=await context.newPage();debug=p;p.on('pageerror',e=>errors.push(e.message));
  const start=Date.now();await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('#bath').waitFor({timeout:10000});const homeMs=Date.now()-start;
  await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await p.evaluate(()=>window.__webglContexts),0);
  assert.ok(!requests.some(url=>/\/assets\/(?:video|materials|versus\/)/.test(url)),'unselected movies, maps and actors are not downloaded');
  const status=scope=>p.evaluate(async scope=>{const worker=(await navigator.serviceWorker.getRegistration('/')).active;return new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>{c.port1.close();resolve(e.data)};worker.postMessage({type:'PREPARE_GAME',scope},[c.port2]);})},scope);
  const shell=await status('startup');assert.equal(shell.done,shell.total);assert.ok(shell.totalBytes<512*1024);
  const allBefore=await status('all');assert.ok(allBefore.done<allBefore.total);
  await p.screenshot({path:path.join(output,'home-heavy-network-blocked.png')});
  await p.clock.install();await p.locator('#bath').click();await p.locator('#normal').click();await p.locator('#mode-continue').click();await p.locator('#game').waitFor();
  assert.equal(await p.evaluate(()=>window.__webglContexts),0);
  const box=await p.locator('#game').boundingBox(),at=q=>({x:box.x+q.x/480*box.width,y:box.y+q.y/800*box.height}),route=levels[0].solution;
  let q=at(route[0]);await p.mouse.move(q.x,q.y);await p.mouse.down();
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/14);for(let j=1;j<=n;j++){q=at({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n});await p.mouse.move(q.x,q.y);await p.clock.runFor(16)}}
  await p.mouse.up();await p.clock.runFor(16000);await p.locator('.celebration-card').waitFor();
  await p.screenshot({path:path.join(output,'normal-win-with-other-modes-blocked.png')});
  await p.locator('#show-score').click();await p.locator('#level-menu').click();await p.locator('#home').click();await p.locator('#hub-back').click();await p.clock.resume();
  await p.waitForFunction(async urls=>(await Promise.all(urls.map(url=>caches.match(url,{ignoreSearch:true})))).every(Boolean),levelArtworkKeys(levels[0]).map(key=>artworkPaths[key]));
  await context.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});await p.locator('#bath').click();await p.locator('#normal').click();await p.locator('#mode-continue').click();await p.locator('#game').waitFor();
  await p.locator('#pause').click();await p.locator('#quit').click();await p.locator('#home').click();await p.locator('#infernal').click();await p.locator('#mode-continue').click();
  await p.getByText('浴场还没准备好，请检查网络后重试。',{exact:true}).waitFor();
  await p.locator('#prepare-back').click();await p.locator('#home').click();await p.locator('#hub-back').click();
  await context.setOffline(false);holdHeavy=false;for(const release of held)release();held.clear();
  await p.locator('#settings').click();await p.locator('#prepare-offline').click();
  await p.getByRole('button',{name:'继续准备离线包',exact:true}).waitFor({timeout:60000});
  await p.getByRole('button',{name:'继续准备离线包',exact:true}).click();
  await p.getByRole('button',{name:'完整离线包已就绪',exact:true}).waitFor({timeout:60000});
  const allAfter=await status('all');assert.equal(allAfter.done,allAfter.total);assert.equal(allAfter.total,manifest.length);
  await p.screenshot({path:path.join(output,'complete-offline-pack.png')});
  await p.locator('#dialog-close').click();await context.setOffline(true);await p.reload();await p.locator('#bath').click();await p.locator('#infernal').click();await p.locator('#mode-continue').click();await p.locator('#bath-clock').waitFor();
  await p.locator('#pause').click();await p.locator('#quit').click();await p.locator('#home').click();await p.locator('#hub-back').click();
  await p.locator('#extreme').click();await p.locator('#escape-menu-solo').click();await p.locator('#escape-new').click();
  await p.locator('#cinematic-skip').click();await p.waitForFunction(()=>document.querySelector('#escape-panel')?.hidden,{},{timeout:60000});
  assert.ok(await p.evaluate(()=>window.__webglContexts)>0);await p.screenshot({path:path.join(output,'offline-3d-first-entry.png')});
  await context.close();
  holdSurfaces=true;
  const cancelling=await browser.newContext(),cold=await cancelling.newPage();debug=cold;
  cold.on('pageerror',e=>errors.push(e.message));await cold.goto(base,{waitUntil:'domcontentloaded'});await cold.locator('#extreme').click();await cold.locator('#escape-menu-solo').click();await cold.locator('#escape-new').click();await cold.locator('#cinematic-skip').click();
  await cold.locator('#escape-prepare-back').click();await cold.locator('#escape-menu-solo').waitFor();
  holdSurfaces=false;for(const release of held)release();held.clear();
  await cold.locator('body > div[aria-hidden="true"] > canvas').waitFor({state:'attached',timeout:60000});
  assert.equal(await cold.locator('#escape-menu-solo').isVisible(),true,'late 3D preparation must not override cancellation');await cancelling.close();
  // A legacy loading screen can upgrade without waiting for its old whole-game
  // download. The separate already-playing tab must never be navigated.
  const legacy=await browser.newContext(),run=await legacy.newPage();await run.goto(base+'/legacy-run');await run.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const boot=await legacy.newPage();debug=boot;let navigations=0;boot.on('framenavigated',f=>{if(f===boot.mainFrame())navigations++});
  await boot.goto(base+'/legacy-boot',{waitUntil:'domcontentloaded'});await boot.locator('#bath').waitFor({timeout:15000});
  assert.equal(await run.locator('#existing-run').inputValue(),'in-progress');assert.equal(run.url(),base+'/legacy-run');assert.equal(navigations,2,'exactly one upgrade navigation');await legacy.close();
  assert.deepEqual(errors,[]);const proof={homeMs,startupBytes:shell.totalBytes,totalBytes:allBefore.totalBytes,heavyRequestsHeld:true,noEarlyWebGL:true,noUnselectedVideoOrMapDownload:true,normalWin:true,playedLevelOffline:true,missingModeRecoverable:true,fullOfflineRetry:true,fullPackEntries:allAfter.total,offlineInfernal:true,offline3DFirstEntry:true,cancelled3DStaysInMenu:true,legacyLoaderUpgrade:true,otherGameTabNotNavigated:true,errors};
  await fs.writeFile(path.join(output,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){console.error(error);console.error(errors);if(debug){console.error(await debug.locator('body').innerText());console.error(await debug.evaluate(async()=>({keys:await Promise.all((await caches.keys()).map(async name=>[name,(await(await caches.open(name)).keys()).map(r=>r.url)]))})));await debug.screenshot({path:path.join(output,'failure.png')});}process.exitCode=1;}finally{await browser?.close();for(const release of held)release();server.closeAllConnections();await new Promise(r=>server.close(r));}
