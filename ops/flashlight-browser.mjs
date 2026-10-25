import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createApp} from '../server/app.mjs';
import {EscapeWorld} from '../src/escape/world.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve(process.env.FLASHLIGHT_QA_DIR??'.local/flashlight-qa');await fs.mkdir(output,{recursive:true});
const server=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=process.env.FLASHLIGHT_QA_URL??`http://127.0.0.1:${server.address().port}`,errors=[];
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
  const context=await browser.newContext({viewport:{width:900,height:650}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base);await page.locator('#extreme').waitFor();
  const seed=async(p)=>{
    const world=new EscapeWorld();Object.assign(world.data.player,p);
    Object.assign(world.data.hunter,p.z<12?{x:20.5,z:20.5}:{x:3.5,z:2.5});
    await page.evaluate(s=>{localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(s));localStorage.setItem('nwaxz-escape-sound-v1',JSON.stringify({music:false,sound:false}));},world.snapshot());
    await page.locator('#extreme').click();await page.locator('#escape-menu-solo').click();await page.locator('#escape-continue').click();
    await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  };
  const frames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const shot=async(name)=>{
    await page.keyboard.press('Escape');await page.locator('#escape-resume').waitFor();
    await page.locator('#escape-panel').evaluate(e=>{e.style.visibility='hidden';});
    await page.locator('#escape-view').screenshot({path:path.join(output,name+'.png')});
    await page.locator('#escape-panel').evaluate(e=>{e.style.visibility='';});
  };
  const poses=[
    ['bedroom',{x:3.5,z:5.5,angle:-Math.PI/2,pitch:0}],
    ['corridor-floor',{x:11.5,z:9.5,angle:0,pitch:-.45}],
    ['office',{x:20.5,z:5.5,angle:0,pitch:0}],
    ['laundry',{x:4.5,z:14.5,angle:Math.PI,pitch:0}],
    ['cellar-floor',{x:20.5,z:20.5,angle:0,pitch:-.4}],
    ['look-up',{x:3.5,z:5.5,angle:Math.PI,pitch:.6}],
  ];
  for(const [name,pose] of poses){
    await seed(pose);await frames();await shot(name+'-on');
    await page.locator('#escape-resume').click();await page.keyboard.press('f');await frames();await shot(name+'-off');
    await page.locator('#escape-exit').click();
  }
  const measure=spawnSync(process.env.PYTHON_PATH??'python',['-c',`import json,sys
from pathlib import Path
from PIL import Image,ImageStat
root=Path(sys.argv[1]);result=[]
for name in json.loads(sys.argv[2]):
 a=Image.open(root/(name+'-on.png')).convert('L');b=Image.open(root/(name+'-off.png')).convert('L')
 w,h=a.size;box=(int(w*.32),int(h*.32),int(w*.68),int(h*.68))
 on=ImageStat.Stat(a.crop(box)).mean[0];off=ImageStat.Stat(b.crop(box)).mean[0]
 result.append({'name':name,'on':on,'off':off,'gain':on-off})
print(json.dumps(result))`,output,JSON.stringify(poses.map(([name])=>name))],{encoding:'utf8'});
  assert.equal(measure.status,0,measure.stderr);const lighting=JSON.parse(measure.stdout);
  console.log(JSON.stringify({lighting}));
  for(const result of lighting)assert.ok(result.gain>5,`${result.name} should visibly brighten the center of view: ${JSON.stringify(result)}`);
  // Follow a real doorway crossing and freeze the subtitle timer in pause.
  await page.setViewportSize({width:390,height:844});
  await seed({x:4.5,z:6.8,angle:Math.PI/2,pitch:0});
  await page.locator('#escape-room-toast').waitFor();
  assert.equal(await page.locator('#escape-room-toast').innerText(),'寝室');
  await page.keyboard.press('Escape');
  const paused=await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1'));
  assert.equal(await page.locator('#escape-map-current').innerText(),'当前位置：寝室');
  await page.waitForTimeout(2100);
  assert.equal(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')),paused);
  await page.locator('#escape-resume').click();await page.locator('#escape-room-toast').waitFor();
  await page.locator('#escape-room-toast').waitFor({state:'hidden',timeout:4000});
  await page.keyboard.down('w');
  await page.waitForFunction(()=>document.querySelector('#escape-map-room')?.textContent==='回声长廊');
  await page.keyboard.up('w');await page.locator('#escape-room-toast').waitFor();
  assert.equal(await page.locator('#escape-room-toast').innerText(),'回声长廊');
  assert.match(await page.locator('#escape-map').getAttribute('aria-label'),/回声长廊/);
  const layout=await page.locator('#escape-room-toast').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,pointer:getComputedStyle(e).pointerEvents};});
  assert.ok(Math.abs(layout.x-195)<1&&Math.abs(layout.y-422)<1);assert.equal(layout.pointer,'none');
  await page.screenshot({path:path.join(output,'corridor-cue-phone.png')});
  await page.locator('#escape-room-toast').waitFor({state:'hidden',timeout:4000});
  await page.waitForTimeout(300);assert.equal(await page.locator('#escape-room-toast').isVisible(),false,'same room does not replay');
  await page.keyboard.down('s');await page.waitForFunction(()=>document.querySelector('#escape-map-room')?.textContent==='寝室');await page.keyboard.up('s');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#escape-room-toast').waitFor();
  assert.equal(await page.locator('#escape-room-toast').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:path.join(output,'bedroom-cue-landscape.png')});
  await page.keyboard.press('Escape');await page.locator('#escape-exit').click();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({lighting,roomCaption:true,centeredPhone:true,mapLocation:true,pausedCaptionTimer:true,noRepeatedSameRoomCue:true,doorwayCrossing:true,reducedMotion:true,errors,output}));
  await context.close();
} finally {await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
