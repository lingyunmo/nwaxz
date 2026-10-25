import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
import {EscapeWorld} from '../src/escape/world.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve(process.env.DIRECTIONS_QA_DIR??'.local/directions-qa');await fs.mkdir(output,{recursive:true});
const server=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=process.env.DIRECTIONS_QA_URL??`http://127.0.0.1:${server.address().port}`;
const errors=[],views=[];let browser,page;
const assets=['haunted-frog-directions-idle-v1.webp','haunted-frog-directions-walk-v1.webp'];
function fixture(angle=0,freeze=false){
 const w=new EscapeWorld(42);w.data.elapsed=10;Object.assign(w.data.hunter,{x:11.8,z:4.3,angle:0,state:'patrol'});w.target={x:11.8,z:4.3};
 Object.assign(w.data.player,{x:11.8+Math.cos(angle)*2.2,z:4.3+Math.sin(angle)*2.2,angle:Math.atan2(-Math.sin(angle),-Math.cos(angle)),pitch:-.15,light:true});
 if(freeze){w.data.hunt.collected=['crystal-bed'];w.useCrystal('freeze')}
 return w;
}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
 async function open(options){const context=await browser.newContext(options),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('#extreme').waitFor({timeout:300000});return{context,p}}
 async function enter(p,w){const save=EscapeWorld.restore(w.snapshot()).snapshot();await p.evaluate(s=>{localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(s));localStorage.setItem('nwaxz-escape-sound-v1','{"music":false,"sound":false}')},save);await p.locator('#extreme').click();await p.locator('#escape-menu-solo').click();await p.locator('#escape-continue').click();await p.locator('#escape-panel[hidden]').waitFor({state:'attached'});await p.waitForTimeout(120)}
 async function pause(p){if(await p.evaluate(()=>!!document.pointerLockElement))await p.keyboard.press('Escape');else await p.locator('#escape-pause').click();await p.locator('#escape-resume').waitFor();const s=JSON.parse(await p.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));EscapeWorld.restore(s);return s}
 async function photo(p,name){
  // Pause via the real game, then remove only its visual overlay for inspection.
  // No enemy suppression or render hooks are added to production code.
  await p.locator('#escape-panel').evaluate(e=>e.hidden=true);
  try{await p.locator('#escape-view').screenshot({path:path.join(output,name+'.png')})}finally{await p.locator('#escape-panel').evaluate(e=>e.hidden=false)}
 }
 async function exit(p){await p.locator('#escape-exit').click();await p.locator('#extreme').waitFor()}
 const desktop=await open({viewport:{width:1100,height:760}});page=desktop.p;
 const decoded=await page.evaluate(async names=>{const result=[];for(const name of names){const image=new Image();image.src='/assets/character/'+name;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let transparent=0,opaque=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;if(data[i]>128)opaque++}result.push({name,width:canvas.width,height:canvas.height,transparent,opaque,cached:!!await caches.match(image.src,{ignoreSearch:true})})}return result},assets);
 assert.deepEqual(decoded.map(x=>[x.width,x.height]),[[1536,768],[1536,1536]]);assert.ok(decoded.every(x=>x.transparent>10000&&x.opaque>10000&&x.cached));
 // Short target-at-rest fixtures inspect normal full-color artwork, not the frozen tint.
 for(let direction=0;direction<8;direction++){
  await enter(page,fixture(direction*Math.PI/4));const save=await pause(page);
  await fs.writeFile(path.join(output,`view-${direction}-state.json`),JSON.stringify(save,null,2));
  await photo(page,`view-${direction}`);
  assert.ok(Math.abs(save.hunter.angle)<.001,JSON.stringify(save.hunter));assert.ok(Math.hypot(save.hunter.x-11.8,save.hunter.z-4.3)<.01,JSON.stringify({hunter:save.hunter,elapsed:save.elapsed,hunt:save.hunt}));
  assert.equal(save.phase,'playing');views.push({direction,angle:save.hunter.angle,sight:save.hunt.sight});
  await exit(page);
 }
 assert.ok(views[0].sight>0&&views[1].sight>0&&views[7].sight>0);assert.ok([2,3,4,5,6].every(i=>views[i].sight===0));
 // Real key movement walks around the SAME frozen hunter from its face to its back.
 await enter(page,fixture(0,true));await page.keyboard.press('Shift');
 for(const [key,ms] of [['a',670],['w',1340],['d',670],['ArrowRight',1570]]){
  await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);
 }
 const circled=await pause(page);assert.ok(circled.hunt.freeze>0);assert.equal(circled.hunter.angle,0);
 assert.ok(circled.player.x<circled.hunter.x-1.6&&Math.abs(circled.player.z-4.3)<.4,JSON.stringify(circled.player));assert.equal(circled.hunt.sight,0);
 await photo(page,'frozen-walked-to-back');await exit(page);
 // The two visible strides come from actual hunter locomotion in the game.
 const walking=fixture(0);walking.data.elapsed=0;walking.data.player.x=14.2;walking.target={x:13.5,z:4.5};await enter(page,walking);
 const first=await pause(page);await photo(page,'walk-a');await page.locator('#escape-resume').click();await page.waitForTimeout(260);const second=await pause(page);await photo(page,'walk-b');
 assert.ok(second.hunter.x>first.hunter.x);await exit(page);
 const mobile=await open({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=mobile.p;
 const back=fixture(Math.PI,true);Object.assign(back.data.hunter,{x:12.5,z:9.5});Object.assign(back.data.player,{x:8.5,z:9.5,angle:0});back.target={x:12.5,z:9.5};await enter(page,back);const saved=await pause(page);await photo(page,'mobile-back');await exit(page);
 await mobile.context.setOffline(true);await page.reload();await page.locator('#extreme').waitFor();await page.locator('#extreme').tap();await page.locator('#escape-menu-solo').tap();await page.locator('#escape-continue').tap();await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});await page.waitForTimeout(150);const offline=await pause(page);await photo(page,'offline-back');
 assert.equal(offline.hunter.angle,saved.hunter.angle);assert.ok(offline.hunt.freeze>0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({base,decoded,views,sameFrozenHunterCircling:true,circled:{player:circled.player,freeze:circled.hunt.freeze},realWalking:true,mobile:true,offline:true,errors,output}));
}catch(error){if(page)try{await page.screenshot({path:path.join(output,'failure.png')});await fs.writeFile(path.join(output,'failure.txt'),await page.locator('body').innerText())}catch{}throw error}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
