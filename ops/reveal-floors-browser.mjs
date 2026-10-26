import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createApp} from '../server/app.mjs';
import {EscapeWorld,CRYSTALS} from '../src/escape/world.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve(process.env.REVEAL_FLOORS_QA_DIR??'.local/reveal-floors-qa');await fs.mkdir(output,{recursive:true});
const server=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`,errors=[],key='nwaxz-escape-session-v1';
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
 const page=await browser.newPage({viewport:{width:960,height:720}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#extreme').waitFor();
 const enter=async world=>{
  await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key,save:world.snapshot()});
  await page.reload();await page.locator('#extreme').click();await page.locator('#escape-menu-solo').click();await page.locator('#escape-continue').click();
  await page.locator('#escape-panel[hidden]').waitFor({state:'attached',timeout:60000});
  await page.locator('#escape-view').waitFor();await page.waitForTimeout(120);
 };
 const freezeId=CRYSTALS.find(c=>c.kind==='freeze').id,revealId=CRYSTALS.find(c=>c.kind==='reveal').id;
 const cases=[];
 for(const direction of ['ground-view-of-basement-hunter','basement-view-of-ground-hunter']){
  const world=new EscapeWorld(42);
  const playerZ=direction==='ground-view-of-basement-hunter'?15.5:40.5;
  const hunterZ=direction==='ground-view-of-basement-hunter'?28.5:15.5;
  const playerY=playerZ<24?0:-4.8,hunterY=hunterZ<24?0:-4.8;
  const horizontal=(hunterZ-playerZ)*1.5;
  const pitch=Math.atan2(hunterY+1.22-(playerY+1.65),Math.abs(horizontal));
  Object.assign(world.data.player,{x:18.5,z:playerZ,angle:Math.sign(hunterZ-playerZ)*Math.PI/2,pitch,light:false,crouched:false});
  Object.assign(world.data.hunter,{x:18.5,z:hunterZ,angle:Math.PI,state:'patrol'});
  Object.assign(world.data.hunt,{freeze:10,freezeUsed:1,collected:[freezeId,revealId],reveal:0});
  await enter(world);
  const canvas=page.locator('#escape-view');
  const inactive=path.join(output,`${direction}-inactive.png`);await canvas.screenshot({path:inactive});
  await page.locator('#escape-reveal').click();await page.locator('#escape-reveal.active').waitFor();await page.waitForTimeout(100);
  const active=path.join(output,`${direction}-active.png`);await canvas.screenshot({path:active});
 const result=spawnSync(process.env.PYTHON_PATH??'python',['-c',`from PIL import Image
import json,sys
before,after=(Image.open(p).convert('RGB') for p in sys.argv[1:]);w,h=before.size
# The camera aims at the hunter, so compare a central region over the same paused actor.
box=(int(w*.42),int(h*.38),int(w*.58),int(h*.64));a=before.crop(box);b=after.crop(box)
changed=sum(1 for x,y in zip(a.getdata(),b.getdata()) if max(abs(i-j) for i,j in zip(x,y))>12)
bright=sum(1 for r,g,bl in b.getdata() if max(r,g,bl)>32)
print(json.dumps({'changedPixels':changed,'activeBrightPixels':bright}))`,inactive,active],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const pixels=JSON.parse(result.stdout);
  assert.ok(pixels.changedPixels>35&&pixels.activeBrightPixels>35,`${direction}: active cross-floor outline must change pixels around the hunter: ${JSON.stringify(pixels)}`);
  cases.push({direction,pitch,playerZ,hunterZ,...pixels});
  await page.locator('#escape-pause').click();await page.locator('#escape-exit').click();await page.locator('#extreme').waitFor();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases,errors,output}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
