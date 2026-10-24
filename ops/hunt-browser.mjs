import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createApp} from '../server/app.mjs';
import {EscapeWorld,CRYSTALS} from '../src/escape/world.ts';
// Targeted fixtures test perception, effects and controls. Full active-AI routes live in server tests.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve(process.env.HUNT_QA_DIR??'.local/hunt-qa');await fs.mkdir(output,{recursive:true});
const server=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=process.env.HUNT_QA_URL??`http://127.0.0.1:${server.address().port}`,errors=[],startups=[];
let browser,page;
const ready=async p=>{
 for(let attempt=0;attempt<2;attempt++){
  const started=Date.now(),ticker=setInterval(()=>void p.locator('body').innerText().then(body=>fs.appendFile(path.join(output,'startup.log'),JSON.stringify({body,attempt})+'\n')).catch(()=>{}),20000);
  try{
   const result=await p.waitForFunction(()=>document.querySelector('#extreme')?'ready':document.querySelector('#retry-load')?'retry':false,{},{timeout:300000});
   const status=await result.jsonValue();startups.push({attempt,status,ms:Date.now()-started});
   if(status==='ready')return;
   if(attempt===1)throw Error('Startup retry failed: '+await p.locator('body').innerText());
   await p.locator('#retry-load').click();
  }finally{clearInterval(ticker);}
 }
};
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  window.__breaths=[];window.__analysers=[];
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...rest){
   if(destination===this.context.destination){
    let record=window.__analysers.find(a=>a.context===this.context);
    if(!record){const analyser=this.context.createAnalyser();analyser.fftSize=1024;connect.call(analyser,destination);record={context:this.context,analyser};window.__analysers.push(record);}
    return connect.call(this,record.analyser,...rest);
   }return connect.call(this,destination,...rest);
  };
  const create=AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource=function(...args){
   const node=create.apply(this,args),start=node.start;
   node.start=function(...params){if(node.buffer&&Math.abs(node.buffer.duration-.42)<.01)window.__breaths.push({duration:node.buffer.duration,nonzero:node.buffer.getChannelData(0).some(v=>Math.abs(v)>.01)});return start.apply(this,params);};return node;
  };
 });
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await ready(page);
 const seed=()=>new EscapeWorld(42);
 const charge=(w,kind)=>w.data.hunt.collected.push(CRYSTALS.find(c=>c.kind===kind).id);
 const enter=async(w,sound=false)=>{
  const save=w.snapshot();EscapeWorld.restore(save);
  await page.evaluate(({save,sound})=>{localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(save));localStorage.setItem('nwaxz-escape-sound-v1',JSON.stringify({music:false,sound}));},{save,sound});
  await page.locator('#extreme').tap();await page.locator('#escape-continue').tap();await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
 };
 const pause=async()=>{await page.locator('#escape-pause').tap();const s=JSON.parse(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));EscapeWorld.restore(s);return s;};
 const exit=async()=>{await page.locator('#escape-exit').tap();await page.locator('#extreme').waitFor();};
 const rms=()=>page.evaluate(()=>window.__analysers.map(({context,analyser})=>{const a=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(a);return{state:context.state,rms:Math.sqrt(a.reduce((n,v)=>n+v*v,0)/a.length)};}));
 // Pickup is finite and uses the visible touch interaction.
 const pickup=seed();pickup.data.player.pitch=-.25;await enter(pickup);await page.locator('#escape-interact').tap();
 await page.waitForFunction(()=>document.querySelector('#escape-freeze-count')?.textContent==='1');
 const picked=await pause();assert.ok(picked.hunt.collected.includes('crystal-bed'));await exit();
 // A real key activates the effect; pausing must stop its simulation countdown.
 const held=EscapeWorld.restore(picked);Object.assign(held.data.player,{x:4.5,z:9.5,angle:0,pitch:0,light:false});
 Object.assign(held.data.hunter,{x:10.5,z:9.5,angle:Math.PI,state:'chase'});held.data.elapsed=25;
 await enter(held);await page.keyboard.press('1');await page.waitForFunction(()=>document.querySelector('#escape-freeze')?.classList.contains('active'));
 const frozen=await pause(),frozenText=await page.locator('#escape-freeze-time').innerText();
 await page.waitForTimeout(500);assert.equal(await page.locator('#escape-freeze-time').innerText(),frozenText);
 await page.locator('#escape-resume').tap();await page.waitForTimeout(7000);const late=await pause();
 assert.deepEqual(late.hunter,frozen.hunter);assert.ok(late.hunt.freeze>0&&late.hunt.freeze<frozen.hunt.freeze-5);await exit();
 await enter(EscapeWorld.restore(late));await page.waitForFunction(()=>!document.querySelector('#escape-freeze')?.classList.contains('active'),{},{timeout:6000});
 await page.waitForTimeout(250);const thawed=await pause();assert.equal(thawed.hunt.freeze,0);assert.ok(Math.hypot(thawed.hunter.x-late.hunter.x,thawed.hunter.z-late.hunter.z)>.05);await exit();
 // The pursuer is behind two walls in a locked room, so only the timed overlay can expose it.
 const through=seed();charge(through,'reveal');Object.assign(through.data.player,{x:3.5,z:5.5,angle:0,pitch:0,light:true});
 Object.assign(through.data.hunter,{x:12.5,z:5.5,state:'patrol'});through.data.elapsed=25;
 await enter(through);await page.waitForTimeout(150);await page.locator('#escape-view').screenshot({path:path.join(output,'occluded.png')});
 await page.locator('#escape-reveal').tap();await page.waitForTimeout(250);await page.locator('#escape-view').screenshot({path:path.join(output,'revealed.png')});
 await page.waitForFunction(()=>!document.querySelector('#escape-reveal')?.classList.contains('active'),{},{timeout:13000});
 await page.waitForTimeout(150);await page.locator('#escape-view').screenshot({path:path.join(output,'expired.png')});
 const revealSave=await pause();assert.equal(revealSave.hunt.reveal,0);assert.equal(revealSave.hunt.revealUsed,1);await exit();
 const diff=spawnSync(process.env.PYTHON_PATH??'python',['-c',`from PIL import Image,ImageChops,ImageStat
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);a=Image.open(p/'occluded.png').convert('RGB');b=Image.open(p/'revealed.png').convert('RGB');c=Image.open(p/'expired.png').convert('RGB')
w,h=a.size;box=(int(w*.25),int(h*.3),int(w*.75),int(h*.7))
d=ImageChops.difference(a,b).crop(box);e=ImageChops.difference(a,c).crop(box)
def silhouette(im):return sum(r>g+12 and r>b+8 and r>45 for r,g,b in im.crop(box).getdata())
print(json.dumps({'revealMean':sum(ImageStat.Stat(d).mean)/3,'expiredMean':sum(ImageStat.Stat(e).mean)/3,'changedPixels':sum(max(v)>12 for v in d.getdata()),'silhouetteBefore':silhouette(a),'silhouetteActive':silhouette(b),'silhouetteExpired':silhouette(c)}))`,output],{encoding:'utf8'});
 assert.equal(diff.status,0,diff.stderr);const visibility=JSON.parse(diff.stdout);assert.ok(visibility.changedPixels>100&&visibility.silhouetteActive>visibility.silhouetteBefore+100&&visibility.silhouetteActive>visibility.silhouetteExpired+100,JSON.stringify(visibility));
 // Both directions must point toward the hidden target while reveal is active.
 for(const [angle,left] of [[Math.PI/2,true],[-Math.PI/2,false]]){
  const w=seed();charge(w,'reveal');w.useCrystal('reveal');Object.assign(w.data.player,{x:3.5,z:5.5,angle,light:false});Object.assign(w.data.hunter,{x:12.5,z:5.5});
  await enter(w);const hint=page.locator('#escape-hunter-bearing');await hint.waitFor();assert.ok((await hint.innerText()).includes(left?'‹':'›'));await pause();await exit();
 }
 // Actual walking triggers an audible buffered breath; pause must silence its output.
 const tired=seed();tired.data.hunt.effort=99.6;tired.data.player.light=false;await enter(tired,true);
 const before=await page.evaluate(()=>window.__breaths.length);await page.keyboard.down('w');
 await page.waitForFunction(n=>window.__breaths.length>n,before,{timeout:5000});await page.waitForTimeout(60);
 const sound=await rms();assert.ok(sound.some(a=>a.state==='running'&&a.rms>1e-5),JSON.stringify(sound));
 await page.keyboard.up('w');await pause();await page.waitForTimeout(150);assert.ok((await rms()).every(a=>a.rms<1e-5));
 const breath=await page.evaluate(()=>window.__breaths.at(-1));assert.ok(breath.nonzero);await exit();
 const resting=seed();Object.assign(resting.data.hunt,{effort:90,panting:true,breathIn:1});await enter(resting);const mutedStart=await page.evaluate(()=>window.__breaths.length);
 await page.waitForFunction(()=>Number(document.querySelector('#escape-effort-value')?.textContent)<35,{},{timeout:5000});
 assert.equal(await page.locator('.escape-meters').evaluate(e=>e.classList.contains('panting')),false);assert.equal(await page.evaluate(()=>window.__breaths.length),mutedStart);await pause();await exit();
 // Track a live pursuer in the real cone; frozen perception is deliberately suspended.
 const lit=seed();Object.assign(lit.data.player,{x:1.5,z:9.5,angle:0,pitch:0});Object.assign(lit.data.hunter,{x:15.5,z:9.5,angle:0,state:'patrol'});lit.target={x:1.5,z:9.5};lit.data.elapsed=25;
 await enter(lit);await page.waitForFunction(()=>document.querySelector('#escape-glare').value>=100,{},{timeout:6500});
 const glare=await pause();assert.equal(glare.hunt.lightArmed,false);assert.equal(glare.hunter.state,'chase');
 await page.locator('#escape-resume').tap();await page.keyboard.press('f');await page.waitForTimeout(1800);const dimmed=await pause();assert.ok(dimmed.hunt.glare<65);assert.equal(dimmed.hunt.lightArmed,true);await exit();
 const layouts=[];
 const layout=seed();layout.data.hunt.collected=['crystal-hall-east','crystal-hall-west'];layout.data.player.pitch=-.2;await enter(layout);
 for(const [width,height] of [[390,844],[320,568],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(120);
  const rects=await page.evaluate(()=>['.escape-hud','.escape-hunt','#escape-map','#escape-inventory','#escape-stick','.escape-actions','#escape-interact','.escape-meters'].map(id=>{const e=document.querySelector(id),r=e.getBoundingClientRect();return{id,x:r.x,y:r.y,width:r.width,height:r.height,hidden:e.hidden};}));
  const shown=rects.filter(r=>!r.hidden&&r.width&&r.height);for(const a of shown){assert.ok(a.x>=-1&&a.y>=-1&&a.x+a.width<=width+1&&a.y+a.height<=height+1,`${width} bounds ${JSON.stringify(a)}`);for(const b of shown)if(a.id<b.id)assert.ok(!(a.x<b.x+b.width-1&&a.x+a.width>b.x+1&&a.y<b.y+b.height-1&&a.y+a.height>b.y+1),`${width} overlap ${JSON.stringify([a,b])}`);}
  layouts.push({width,height,rects});await page.screenshot({path:path.join(output,`layout-${width}x${height}.png`)});
 }
 await page.setViewportSize({width:390,height:844});const saved=await pause();
 const download=page.waitForEvent('download');await page.locator('#escape-backup').tap();const file=await download,backupPath=path.join(output,'hunt-backup.json');await file.saveAs(backupPath);await exit();
 await page.locator('#extreme').tap();await page.locator('#escape-intro-saves').tap();await page.locator('#escape-import').setInputFiles(backupPath);
 await page.locator('#escape-continue').waitFor();const imported=JSON.parse(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));assert.deepEqual(imported,saved);
 await page.locator('#escape-intro-exit').tap();
 let desktopLayout;
 if(!process.env.HUNT_QA_SKIP_DESKTOP){
  const pcContext=await browser.newContext({viewport:{width:900,height:500}}),pc=await pcContext.newPage();pc.on('pageerror',e=>errors.push(e.message));await pc.goto(base);await ready(pc);
  await pc.evaluate(save=>{localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(save));localStorage.setItem('nwaxz-escape-sound-v1','{"music":false,"sound":false}');},saved);
  await pc.locator('#extreme').click();await pc.locator('#escape-continue').click();await pc.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  desktopLayout=await pc.evaluate(()=>['.escape-hunt','.escape-crystals','#escape-inventory'].map(id=>{const r=document.querySelector(id).getBoundingClientRect();return{id,x:r.x,y:r.y,width:r.width,height:r.height};}));
  for(const r of desktopLayout)assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=900&&r.y+r.height<=500,JSON.stringify(r));
  await pc.screenshot({path:path.join(output,'desktop-900x500.png')});await pc.keyboard.press('Escape');await pcContext.close();await page.bringToFront();
 }
 await context.setOffline(true);await page.reload();await page.locator('#extreme').waitFor();await page.locator('#extreme').tap();await page.locator('#escape-continue').tap();await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
 await page.locator('#escape-reveal').tap();await page.locator('#escape-reveal.active').waitFor();await pause();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({base,startups,pickup:true,freezePauseAndThaw:true,visibility,bearings:true,breath,sound,rest:true,glare:true,layouts,desktopLayout,backup:true,offlineCrystal:true,errors,output}));
}catch(error){if(page)try{await page.screenshot({path:path.join(output,'failure.png')});await fs.writeFile(path.join(output,'failure.txt'),await page.locator('body').innerText());}catch{}throw error;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
