import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
import {EscapeWorld} from '../src/escape/world.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve(process.env.MOUSE_QA_DIR??'.local/mouse-look-qa');await fs.mkdir(output,{recursive:true});
const server=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=process.env.MOUSE_QA_URL??`http://127.0.0.1:${server.address().port}`,errors=[];
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
  const context=await browser.newContext({viewport:{width:900,height:650}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  const prepare=async p=>{
    await p.goto(base);await p.locator('#extreme').waitFor({timeout:90000});
    const w=new EscapeWorld(42);Object.assign(w.data.hunter,{x:20.5,z:20.5});
    await p.evaluate(s=>{localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(s));localStorage.setItem('nwaxz-escape-sound-v1','{"music":false,"sound":false}');},w.snapshot());
    await p.locator('#extreme').click();await p.locator('#escape-menu-solo').click();await p.locator('#escape-continue').click();await p.locator('#escape-panel[hidden]').waitFor({state:'attached'});
    return w.snapshot();
  };
  const lock=async p=>{
    if(!await p.evaluate(()=>!!document.pointerLockElement))await p.locator('#escape-view').click({position:{x:450,y:325}});
    await p.waitForFunction(()=>document.pointerLockElement===document.querySelector('#escape-view'),{},{timeout:5000});
  };
  const seed=await prepare(page);await lock(page);
  await page.evaluate(()=>{window.__mouse=[];document.addEventListener('mousemove',e=>{if(document.pointerLockElement)window.__mouse.push({x:e.movementX,y:e.movementY,buttons:e.buttons});});});
  await page.mouse.move(580,245,{steps:8});await page.waitForTimeout(150);
  await page.keyboard.press('Escape');await page.locator('#escape-resume').waitFor();
  const moved=JSON.parse(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));
  const motion=await page.evaluate(()=>window.__mouse);
  assert.ok(motion.some(e=>e.buttons===0&&(e.x||e.y)),'real relative mouse motion arrives with no button held');
  assert.ok(Math.abs(moved.player.angle-seed.player.angle)>.1&&Math.abs(moved.player.pitch)>.1,'unheld mouse turns horizontally and vertically');
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
  await page.waitForTimeout(450);assert.ok(await page.locator('#escape-resume').isVisible(),'Escape does not immediately resume');
  assert.equal(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')),JSON.stringify(moved));
  await page.screenshot({path:path.join(output,'escape-release.png')});
  await page.locator('#escape-resume').click();await lock(page);
  await page.keyboard.down('w');await page.waitForTimeout(100);
  await page.evaluate(()=>document.exitPointerLock());await page.locator('#escape-resume').waitFor();
  const lost=JSON.parse(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));
  await page.waitForTimeout(300);await page.locator('#escape-resume').click();await lock(page);await page.waitForTimeout(250);await page.keyboard.press('Escape');
  const resumed=JSON.parse(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));
  assert.equal(resumed.player.x,lost.player.x);assert.equal(resumed.player.z,lost.player.z);await page.keyboard.up('w');
  await page.locator('#escape-exit').click();assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
  await context.close();
  const fallback=[];
  for(const mode of ['rejected','missing']){
    const c=await browser.newContext({viewport:{width:900,height:650}});
    await c.addInitScript(kind=>{HTMLCanvasElement.prototype.requestPointerLock=kind==='missing'?undefined:function(){return Promise.reject(new DOMException('denied','NotAllowedError'));};},mode);
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));const initial=await prepare(p);
    await p.locator('#escape-view').click({position:{x:450,y:325}});await p.mouse.move(460,320);await p.mouse.move(570,245,{steps:5});await p.keyboard.press('Escape');
    const saved=JSON.parse(await p.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));
    assert.ok(Math.abs(saved.player.angle-initial.player.angle)>.1&&saved.player.pitch>.1,`${mode}: fallback still turns without dragging`);
    assert.equal(await p.evaluate(()=>document.pointerLockElement),null);fallback.push(mode);await c.close();
  }
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.addInitScript(()=>{window.__lockRequests=0;const native=HTMLCanvasElement.prototype.requestPointerLock;HTMLCanvasElement.prototype.requestPointerLock=function(...args){window.__lockRequests++;return native.apply(this,args);};});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));const initial=await prepare(phone);
  const cdp=await mobile.newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:280,y:340,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:330,y:300,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.locator('#escape-pause').tap();
  const touch=JSON.parse(await phone.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));
  assert.ok(Math.abs(touch.player.angle-initial.player.angle)>.1&&touch.player.pitch>.1);
  assert.equal(await phone.evaluate(()=>window.__lockRequests),0,'touch does not request desktop mouse lock');
  assert.equal(await phone.locator('#escape-mouse-hint').isVisible(),false);await mobile.close();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({base,relativeMouseWithoutButtons:true,angle:moved.player.angle,pitch:moved.player.pitch,escapeRelease:true,lossPauses:true,clearsMovement:true,reacquire:true,menuAndExitRelease:true,fallback,touchPreserved:true,errors,output}));
} catch(error) {console.error(error);throw error;}
finally {await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
