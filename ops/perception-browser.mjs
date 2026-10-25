import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
import {EscapeWorld} from '../src/escape/world.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve(process.env.PERCEPTION_QA_DIR??'.local/perception-qa');await fs.mkdir(output,{recursive:true});
const server=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=process.env.PERCEPTION_QA_URL??`http://127.0.0.1:${server.address().port}`;
const errors=[],layouts=[],failures=[];let browser,page;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
 async function open(options){const context=await browser.newContext(options),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('#extreme').waitFor({timeout:300000});return {context,p}}
 async function enter(p,w){const save=EscapeWorld.restore(w.snapshot()).snapshot();await p.evaluate(s=>{localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(s));localStorage.setItem('nwaxz-escape-sound-v1','{"music":false,"sound":false}')},save);await p.locator('#extreme').click();await p.locator('#escape-menu-solo').click();await p.locator('#escape-continue').click();await p.locator('#escape-panel[hidden]').waitFor({state:'attached'});await p.waitForTimeout(150)}
 async function pause(p){if(await p.evaluate(()=>!!document.pointerLockElement))await p.keyboard.press('Escape');else await p.locator('#escape-pause').click();await p.locator('#escape-resume').waitFor();const s=JSON.parse(await p.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));EscapeWorld.restore(s);return s}
 async function exit(p){await p.locator('#escape-exit').click();await p.locator('#extreme').waitFor()}
 const seed=()=>new EscapeWorld(42);
 async function measure(p,width,height){
  await p.setViewportSize({width,height});await p.waitForTimeout(180);
  const items=await p.evaluate(()=>['.escape-hud','.escape-hunt','#escape-map','#escape-inventory','#escape-stick','.escape-actions','#escape-interact','.escape-meters','.escape-crystals','#escape-movement','.escape-crosshair'].map(id=>{const e=document.querySelector(id);if(!e)return {id,hidden:true};const r=e.getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height,hidden:e.hidden||getComputedStyle(e).visibility==='hidden',display:getComputedStyle(e).display}}));
  const shown=items.filter(r=>!r.hidden&&r.w&&r.h&&r.display!=='contents');
  for(const a of shown){if(a.x<-1||a.y<-1||a.x+a.w>width+1||a.y+a.h>height+1)failures.push(`${width}x${height} bounds ${JSON.stringify(a)}`);
   for(const b of shown)if(a.id<b.id&&a.id!=='.escape-crystals'&&b.id!=='.escape-crystals'&&a.x<b.x+b.w-1&&a.x+a.w>b.x+1&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1)failures.push(`${width}x${height} overlap ${a.id} ${b.id}`)
  }
  const fonts=await p.evaluate(()=>['#escape-exposure-value','#escape-freeze-count','#escape-freeze-time','#escape-noise-contribution','#escape-effort-value'].map(id=>({id,font:parseFloat(getComputedStyle(document.querySelector(id)).fontSize)})));
  layouts.push({width,height,items,fonts});await p.screenshot({path:path.join(output,`layout-${width}x${height}.png`)});
 }
 const desktop=await open({viewport:{width:1280,height:720}});page=desktop.p;
 const held=seed();held.data.player.x=4.5;held.data.player.angle=0;held.data.hunt.collected=['crystal-bed','crystal-hall-west'];held.useCrystal('freeze');Object.assign(held.data.hunt,{noise:50,glare:50,sight:50,alert:6});
 await enter(page,held);
 assert.equal(await page.locator('#escape-hud-toggle').getAttribute('aria-expanded'),'false');await page.screenshot({path:path.join(output,'compact-desktop.png')});
 await page.keyboard.press('Tab');assert.equal(await page.locator('#escape-hud-toggle').getAttribute('aria-expanded'),'true');assert.equal(await page.locator('#escape-panel').evaluate(e=>e.hidden),true);
 const risk=await page.locator('#escape-exposure').evaluate(e=>e.value);assert.equal(risk,87.5);
 for(const id of ['noise','glare','sight'])assert.equal(await page.locator(`#escape-${id}`).evaluate(e=>e.value),50);
 for(const [width,height] of [[1920,1080],[1280,720],[900,500]])await measure(page,width,height);
 await pause(page);await exit(page);
 // Short key presses and repeated keydown events must select a mode, not require holding a key.
 await enter(page,seed());assert.equal(await page.locator('#escape-crouch').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#escape-exposure').evaluate(e=>e.value),0);
 await page.keyboard.press('c');await page.waitForTimeout(120);assert.equal(await page.locator('#escape-crouch').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('Shift');await page.waitForTimeout(120);assert.equal(await page.locator('#escape-sprint').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#escape-crouch').getAttribute('aria-pressed'),'false');
 await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');const running=await pause(page);assert.equal(running.player.sprinting,true);assert.ok(running.player.stamina<100);await page.locator('#escape-resume').click();
 await page.keyboard.down('Shift');await page.keyboard.down('Shift');await page.keyboard.up('Shift');await page.waitForTimeout(120);assert.equal(await page.locator('#escape-sprint').getAttribute('aria-pressed'),'false');
 await pause(page);await page.locator('#escape-help').click();await page.locator('summary').click();assert.match(await page.locator('.escape-perception-help').innerText(),/99.5/);await page.locator('#escape-help-close').click();await exit(page);
 // With actual movement far from the pursuer, running is visibly inaudible and adds no sound score.
 const far=seed();far.data.elapsed=20;Object.assign(far.data.player,{x:1.5,z:9.5,angle:0,light:false});Object.assign(far.data.hunter,{x:21.5,z:3.5});await enter(page,far);
 await page.keyboard.press('Shift');await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');assert.equal(await page.locator('#escape-noise').evaluate(e=>e.value),0);const farSave=await pause(page);assert.equal(farSave.hunt.noise,0);await exit(page);
 // Sight builds over time and reaches the same chase decision shown by the HUD.
 const seen=seed();seen.data.elapsed=20;Object.assign(seen.data.player,{x:1.5,z:9.5,angle:Math.PI,light:false});Object.assign(seen.data.hunter,{x:5.5,z:9.5,angle:Math.PI});seen.target={x:1.5,z:9.5};await enter(page,seen);
 await page.waitForFunction(()=>document.querySelector('#escape-sight').value>0);assert.match(await page.locator('#escape-sight-info').innerText(),/被看到.*米/);
 await page.waitForFunction(()=>document.querySelector('#escape-hunt-state').textContent.includes('×1.5'),{},{timeout:5000});
 await page.waitForFunction(()=>document.querySelector('#escape-hunt-state').textContent==='追击',{},{timeout:5000});const chased=await pause(page);assert.equal(chased.hunter.state,'chase');assert.equal(chased.hunt.exposure,100);await exit(page);
 const mobile=await open({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=mobile.p;
 await enter(page,held);assert.equal(await page.locator('#escape-hud-toggle').getAttribute('aria-expanded'),'false');await page.screenshot({path:path.join(output,'compact-mobile.png')});await page.locator('#escape-hud-toggle').tap();assert.equal(await page.locator('#escape-hud-toggle').getAttribute('aria-expanded'),'true');for(const [width,height] of [[390,844],[320,568],[844,390]])await measure(page,width,height);
 await page.setViewportSize({width:390,height:844});await page.locator('#escape-sprint').tap();await page.waitForTimeout(150);assert.equal(await page.locator('#escape-sprint').getAttribute('aria-pressed'),'true');await page.locator('#escape-crouch').tap();await page.waitForTimeout(150);assert.equal(await page.locator('#escape-sprint').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#escape-crouch').getAttribute('aria-pressed'),'true');
 const saved=await pause(page);await exit(page);await mobile.context.setOffline(true);await page.reload();await page.locator('#extreme').waitFor();await page.locator('#extreme').tap();await page.locator('#escape-menu-solo').tap();await page.locator('#escape-continue').tap();await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});const offline=await pause(page);assert.equal(offline.player.crouched,saved.player.crouched);assert.deepEqual(offline.hunt.traces,saved.hunt.traces);
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'layout-report.json'),JSON.stringify({layouts,failures},null,2));assert.deepEqual(failures,[]);
 console.log(JSON.stringify({base,contributions:true,toggleKeys:true,touchToggle:true,farRunningQuiet:true,visualAlertAndChase:true,offline:true,layouts,errors,output}));
}catch(error){if(page)try{await page.screenshot({path:path.join(output,'failure.png')});await fs.writeFile(path.join(output,'failure.txt'),await page.locator('body').innerText())}catch{}await fs.writeFile(path.join(output,'layout-report.json'),JSON.stringify({layouts,failures},null,2));throw error}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
