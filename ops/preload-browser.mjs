import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve('.local/preload-qa');await fs.mkdir(output,{recursive:true});
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(dist,'preload-manifest.json'),'utf8'));
const app=createApp({distDir:dist}),requests=[];
let slowVideoFinished=false,slow=true,missingModel=false;
const server=http.createServer(async(req,res)=>{
  requests.push(req.url);
  if(missingModel&&req.url==='/assets/models/escape-props-v1.glb'){res.writeHead(503);res.end();return;}
  if(slow&&req.url==='/assets/video/escape-opening-v1.mp4'){
    const data=await fs.readFile(path.join(dist,req.url));
    res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':data.length});
    for(let at=0;at<data.length;at+=65536){res.write(data.subarray(at,at+65536));await new Promise(r=>setTimeout(r,80));}
    res.end();slowVideoFinished=true;return;
  }
  app(req,res);
}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
const errors=[];
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;window.__glContexts=new Set();
    HTMLCanvasElement.prototype.getContext=function(type,...args){const result=get.call(this,type,...args);if(result&&type.startsWith('webgl'))window.__glContexts.add(result);return result;};
    window.__progress=[];new MutationObserver(()=>{const p=document.querySelector('#boot-progress');if(p?.hasAttribute('value'))window.__progress.push(p.value);}).observe(document,{subtree:true,attributes:true,attributeFilter:['value']});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base);
  await page.waitForFunction(()=>{const p=document.querySelector('#boot-progress');return p?.value>10&&p?.value<100;});
  assert.equal(slowVideoFinished,false);assert.equal(await page.locator('#normal').count(),0,'menu must wait for whole video');
  await page.screenshot({path:path.join(output,'downloading-phone.png')});
  await page.locator('#normal').waitFor({timeout:60000});console.log('menu ready');
  assert.equal(slowVideoFinished,true);slow=false;
  console.log('full cold startup complete');const progress=await page.evaluate(()=>window.__progress);
  assert.ok(new Set(progress).size>3,'real download must move the meter');
  assert.ok(progress.every(Number.isFinite));
  const cache=await page.evaluate(async entries=>Promise.all(entries.map(async entry=>{const r=await caches.match('/'+entry.url,{ignoreSearch:true});return !!r;})),manifest);
  assert.ok(cache.every(Boolean),'every current resource cached before menu');
  assert.equal(await page.evaluate(()=>window.__glContexts.size),1,'3D context created before menu');
  await page.evaluate(()=>{window.__preparedCanvas=[...window.__glContexts][0].canvas;});
  console.log('enter first');await page.locator('#extreme').tap();await page.locator('#escape-new').tap();await page.locator('#cinematic-skip').tap();
  await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  assert.ok(await page.evaluate(()=>window.__preparedCanvas===document.querySelector('#escape-view')));
  await page.locator('#escape-pause').tap();await page.locator('#escape-exit').tap();
  await page.locator('#extreme').tap();const start=Date.now();await page.locator('#escape-continue').tap();await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  console.log('reentry done');const reentryMs=Date.now()-start;
  assert.equal(await page.evaluate(()=>window.__glContexts.size),1,'same renderer reused after exiting');
  assert.ok(await page.evaluate(()=>window.__preparedCanvas===document.querySelector('#escape-view')));
  await page.locator('#escape-pause').tap();await page.locator('#escape-exit').tap();
  // Repair an evicted video on next boot, retaining all unaffected cached files.
  console.log('repair start');const before=requests.length;
  await page.evaluate(async()=>{for(const name of await caches.keys()){const c=await caches.open(name);for(const r of await c.keys())if(new URL(r.url).pathname==='/assets/video/escape-caught-3-v1.mp4')await c.delete(r);}});
  await page.reload();await page.locator('#normal').waitFor({timeout:60000});
  console.log('repair done');const repaired=requests.slice(before).filter(u=>/\.(?:webp|mp3|mp4|glb)(?:\?|$)/.test(u));
  assert.deepEqual(repaired,['/assets/video/escape-caught-3-v1.mp4'],'only missing resource redownloaded');
  // Entire startup, CG and real 3D work with the network disconnected.
  console.log('offline start');const failures=[];page.on('requestfailed',r=>failures.push(r.url()));await context.setOffline(true);await page.reload();await page.locator('#normal').waitFor({timeout:60000});
  await page.locator('#extreme').tap();await page.locator('#escape-new').tap();await page.locator('#escape-confirm-restart').tap();
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.25);await page.locator('#cinematic-skip').tap();await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  await page.screenshot({path:path.join(output,'offline-3d-phone.png')});
  assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
  await context.close();
  // A failed download offers retry; partial cache and local data survive retry.
  missingModel=true;
  const failedContext=await browser.newContext(),failed=await failedContext.newPage();
  await failed.goto(base);await failed.evaluate(()=>localStorage.setItem('nwaxz-qa-keep','saved'));
  await failed.locator('#retry-load').waitFor({timeout:45000});
  assert.ok((await failed.locator('#boot-error').innerText()).length>0);
  await failed.screenshot({path:path.join(output,'retry.png')});
  missingModel=false;await failed.locator('#retry-load').click();await failed.locator('#normal').waitFor({timeout:60000});
  assert.equal(await failed.evaluate(()=>localStorage.getItem('nwaxz-qa-keep')),'saved');
  await failedContext.close();
  // No WebGL must not strand the two Canvas modes on the loading screen.
  const noGL=await browser.newContext();
  await noGL.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl|experimental-webgl/.test(type)?null:get.call(this,type,...args);};});
  const flat=await noGL.newPage();await flat.goto(base);await flat.locator('#enter-now').waitFor({timeout:60000});
  await flat.locator('#enter-now').click();await flat.locator('#normal').click();await flat.locator('[data-level="0"]').click();await flat.locator('#pause').waitFor();
  await noGL.close();
  console.log(JSON.stringify({resources:manifest.length,totalBytes:manifest.reduce((n,e)=>n+e.bytes,0),progressValues:[...new Set(progress)],same3DCanvas:true,reentryMs,missingOnlyRepair:true,offlineVideoAnd3D:true,failedDownloadRetry:true,localDataPreserved:true,noWebGLFallback:true,errors,output}));
}catch(error){console.error(error);throw error;}finally{console.log('closing');await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
