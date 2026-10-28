import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createApp} from '../server/app.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const graph=JSON.parse(await fs.readFile('dist/.vite/manifest.json','utf8'));
const entry='/'+graph['src/escape/game.ts'].file,renderer='/'+graph['src/escape/renderer.ts'].file;
const output=path.resolve('.local/escape-entry-qa');await fs.mkdir(output,{recursive:true});
const app=createApp({distDir:path.resolve('dist')}),held=new Set(),requests=[];let hold=true,reject=false;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost').pathname;requests.push(url);
 if(url===entry&&reject){res.writeHead(503);res.end('entry failure fixture');return;}
 if(url===entry&&hold){const release=()=>{if(!res.destroyed)app(req,res)};held.add(release);res.on('close',()=>held.delete(release));return;}
 app(req,res);
}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`,errors=[];let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const layouts=[];
 for(const [name,options]of [['desktop',{viewport:{width:1280,height:800}}],['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]]){
  hold=true;const context=await browser.newContext(options);await context.addInitScript(()=>{
   window.__entryNodes=[];window.__shells=0;window.__webgl=0;
   const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if(/webgl/.test(kind))window.__webgl++;return get.call(this,kind,...args)};
   new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(!(node instanceof Element))continue;const bad=[...(node.matches('.menu-stage,.escape-card')?[node]:[]),...node.querySelectorAll('.menu-stage,.escape-card')];window.__entryNodes.push(...bad.map(n=>n.className));if(node.matches('.escape-shell'))window.__shells++;}}).observe(document,{childList:true,subtree:true});
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('#extreme').click();await p.locator('.escape-entry-screen').waitFor();
  const bounds=await p.locator('.escape-entry-screen').boundingBox();assert.equal(bounds.x,0);assert.equal(bounds.y,0);assert.equal(bounds.width,options.viewport.width);assert.equal(bounds.height,options.viewport.height);
  assert.ok(await p.locator('.escape-entry-screen').evaluate(e=>getComputedStyle(e).backgroundImage.includes('escape-cover-v1.webp')));
  await p.screenshot({path:path.join(output,name+'-pending.png')});
  await p.locator('#escape-load-return').click();await p.locator('#bath').waitFor();await p.locator('#extreme').click();
  hold=false;for(const release of held)release();held.clear();await p.locator('.escape-lobby').waitFor();
  assert.deepEqual(await p.evaluate(()=>window.__entryNodes),[],'no old narrow container or empty legacy card is ever mounted');
  assert.equal(await p.evaluate(()=>window.__shells),1,'stale entry request cannot construct a second escape game');
  assert.equal(await p.evaluate(()=>window.__webgl),0);assert.equal(requests.includes(renderer),false,'not even the renderer module downloads in the lobby');
  assert.equal(await p.locator('#escape-panel').evaluate(e=>getComputedStyle(e).backdropFilter),'none');
  await p.screenshot({path:path.join(output,name+'-lobby.png')});
  await p.locator('#escape-menu-solo').click();await p.locator('#escape-solo-back').click();await p.locator('#escape-menu-help').click();await p.locator('#escape-help-close').click();
  assert.deepEqual(await p.evaluate(()=>window.__entryNodes),[]);
  await p.locator('#escape-intro-exit').click();await p.locator('#extreme').click();await p.locator('.escape-lobby').waitFor();
  assert.equal(await p.evaluate(()=>window.__shells),2);assert.equal(requests.includes(renderer),false);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1),false);
  layouts.push({name,fullViewport:true,noLegacyCard:true,noRendererRequest:true,noWebGL:true,cancelAndReentry:true});await context.close();
 }
 hold=false;reject=true;
 const failed=await browser.newContext(),p=await failed.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.evaluate(()=>localStorage.setItem('entry-qa-marker','preserved'));await p.locator('#extreme').click();await p.getByRole('main',{name:'逃生大厅载入失败'}).waitFor();
 assert.equal(await p.locator('.menu-stage,.escape-card').count(),0);reject=false;await p.locator('#escape-load-retry').click();await p.locator('#bath').waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('entry-qa-marker')),'preserved');await p.locator('#extreme').click();await p.locator('.escape-lobby').waitFor();await failed.close();
 assert.deepEqual(errors,[]);const proof={layouts,lobbyEntryJSBytes:(await fs.stat('dist'+entry)).size,rendererDeferred:true,errorUsesSameFullscreen:true,refreshRetryRecovers:true,errors};await fs.writeFile(path.join(output,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();for(const release of held)release();server.closeAllConnections();await new Promise(r=>server.close(r));}
