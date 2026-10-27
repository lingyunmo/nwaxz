import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
import {DRAFT_KEY} from '../src/versus/state.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve(process.env.VERSUS_QA_DIR??'.local/versus-client-qa');await fs.mkdir(output,{recursive:true});
const app=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}),nativeTransfers=[];
// Reproduce an unreliable whole-image path while leaving byte ranges available.
const server=http.createServer((req,res)=>{if(/^\/assets\/versus\/.+\.png(?:\?|$)/.test(req.url)){if(!req.headers.range){res.writeHead(503);res.end('whole-image transfer unavailable in test fixture');return;}nativeTransfers.push({url:req.url,range:req.headers.range});}app(req,res)}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`,errors=[],consoleErrors=[],posts=[];let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1','--disable-background-networking']});
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'allow'});
  await context.addInitScript(()=>{window.__fullscreenCalls=0;Element.prototype.requestFullscreen=function(){window.__fullscreenCalls++;return Promise.resolve()}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  await page.goto(base);await page.locator('#pvp').click();await page.locator('.versus-client').waitFor();
  const settle=async()=>{await page.waitForFunction(()=>[...document.querySelectorAll('.versus-client img')].every(i=>i.complete&&i.naturalWidth));await page.waitForTimeout(550)};
  const snap=async(name)=>{await settle();await page.screenshot({path:path.join(output,name+'.png')})};
  const nav=async(tab)=>{await page.locator(`.vc-nav [data-tab="${tab}"]`).click();await page.locator(`[data-versus-tab="${tab}"]`).waitFor()};
  await snap('desktop-lobby');
  await nav('heroes');for(const id of ['alan','zhenzhen','dingdang','paoying']){await page.locator(`[data-focus="${id}"]`).click();for(const key of ['P','Q','E','R']){await page.locator(`[data-skill="${key}"]`).click();assert.equal(await page.locator(`[data-skill="${key}"]`).getAttribute('aria-pressed'),'true')}}
  await page.locator('[data-filter="gate"]').click();assert.equal(await page.locator('.vc-roster-list .vc-portrait').count(),1);assert.equal(await page.locator('.vc-hero-detail h2').innerText(),'砧砧');await snap('desktop-hero');
  await page.locator('[data-filter="all"]').click();await nav('draft');assert.equal(await page.locator('[data-action="lock"]').isDisabled(),true);
  for(const team of ['clear','warm']){await page.locator(`.vc-team-switch [data-team="${team}"]`).click();for(const [seat,hero] of ['alan','zhenzhen','dingdang'].entries()){await page.locator(`[data-seat="${seat}"]`).click();await page.locator(`[data-pick="${hero}"]`).click()}await page.locator('[data-action="lock"]').click();assert.equal(await page.locator('[data-action="edit"]').isVisible(),true)}
  assert.equal(await page.locator('.vc-draft-heading h1').innerText(),'两岸，已就位。');await snap('desktop-draft-locked');
  await page.locator('[data-action="edit"]').click();await page.locator('[data-seat="0"]').click();await page.locator('[data-pick="zhenzhen"]').click();
  let draft=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),DRAFT_KEY);assert.deepEqual(draft.teams.warm,['zhenzhen','alan','dingdang']);assert.equal(draft.locked.clear,true);
  await page.locator('[data-action="profile"]').click();await page.locator('#vc-nickname').fill('<试阵奶娃>');await page.locator('.vc-dialog [type="submit"]').click();assert.ok((await page.locator('.vc-profile').innerText()).includes('试阵奶娃'));
  const storage=await page.evaluate(()=>({...localStorage}));await page.reload();await page.locator('#pvp').click();draft=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),DRAFT_KEY);assert.equal(draft.nickname,'试阵奶娃');assert.deepEqual(draft.teams.warm,['zhenzhen','alan','dingdang']);
  await nav('codex');await snap('desktop-map');
  const markers=await page.locator('.vc-map-boss').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,clickable:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}));assert.ok(markers.every(x=>x.clickable));assert.equal(new Set(markers.map(x=>x.x+','+x.y)).size,3);
  await page.locator('[data-map-boss="dakou"]').click();assert.equal(await page.locator('.vc-boss-feature h2').innerText(),'大口');for(const id of ['dakou','shigong','daoying']){await page.locator(`[data-boss="${id}"]`).click();await settle()}await snap('desktop-boss');
  await page.locator('[data-book="arts"]').click();for(const id of ['tide','gate','echo','foam']){await page.locator(`[data-art="${id}"]`).click();assert.equal(await page.locator(`[data-art="${id}"]`).getAttribute('aria-pressed'),'true')}await snap('desktop-arts');
  await page.locator('[data-art="tide"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-art="tide"]').evaluate(e=>e===document.activeElement),true);
  const layouts=[];
  for(const [name,width,height] of [['desktop',1280,800],['fullhd',1920,1080],['ultrawide',2560,1080],['tablet',768,1024],['phone',390,844],['small',320,568],['landscape',844,390]]){
    await page.setViewportSize({width,height});
    for(const tab of ['lobby','heroes','draft','codex']){await nav(tab);if(tab==='codex')await page.locator('[data-book="map"]').click();await snap(`${name}-${tab}`);const layout=await page.evaluate(()=>{const r=document.querySelector('.versus-client').getBoundingClientRect(),body=document.querySelector('.vc-body');return{width:r.width,height:r.height,outerOverflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1,innerOverflow:body.scrollWidth>body.clientWidth+1}});assert.deepEqual(layout,{width,height,outerOverflow:false,innerOverflow:false},`${name} ${tab}`);layouts.push({name,tab,...layout});}
  }
  await page.setViewportSize({width:390,height:844});await page.locator('[data-action="profile"]').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.vc-dialog').evaluate(e=>e.open),false);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const cached=await page.evaluate(async()=>{const m=await(await fetch('/assets/versus/manifest.json')).json();return(await Promise.all(m.assets.map(x=>caches.match(x.url,{ignoreSearch:true})))).every(Boolean)});assert.equal(cached,true);
  await context.setOffline(true);await page.reload();await page.locator('#pvp').click();for(const tab of ['heroes','draft','codex','lobby']){await nav(tab);await settle()}await snap('offline-lobby');
  const after=await page.evaluate(()=>({...localStorage}));for(const [key,value]of Object.entries(storage)){if(key!==DRAFT_KEY)assert.equal(after[key],value,'other mode data unchanged: '+key)}
  await page.locator('[data-action="exit"]').click();await page.locator('.game-hub').waitFor();await page.locator('#bath').click();await page.locator('#normal').click();await page.locator('#mode-continue').waitFor();await page.locator('#home').click();await page.locator('#hub-back').click();
  assert.equal(await page.evaluate(()=>window.__fullscreenCalls),0);assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);await context.close();
  const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const touch=await phone.newPage();touch.on('pageerror',e=>errors.push(e.message));await touch.goto(base);await touch.locator('#pvp').tap();await touch.locator('.vc-nav [data-tab="draft"]').tap();await touch.locator('[data-action="example"]').tap();await touch.locator('[data-action="lock"]').tap();assert.ok(await touch.locator('[data-action="edit"]').isVisible());await touch.screenshot({path:path.join(output,'touch-draft.png')});await phone.close();
  assert.deepEqual(errors,[]);assert.equal(new Set(nativeTransfers.map(x=>x.url)).size,8);const proof={layouts,heroes:4,skills:16,dualTeamDraft:true,swap:true,lock:true,nickname:true,persistence:true,offline:true,touch:true,nativeImagesRangeOnly:true,nativeRangeRequests:nativeTransfers.length,fullscreenRequests:0,posts,errors,consoleErrors};await fs.writeFile(path.join(output,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){console.error(e);console.error(errors);process.exitCode=1}finally{await browser?.close();await new Promise(r=>server.close(r))}
