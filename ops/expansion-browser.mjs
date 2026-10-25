import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
import {EscapeWorld,PROPS,DOORS,VALVE_ORDER} from '../src/escape/world.ts';
// Independent headless profile. Targeted interaction fixtures are not a full-run proof.
// The continuous escape test in server/escape.test.mjs keeps the real hunter active.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const output=path.resolve(process.env.EXPANSION_QA_DIR??'.local/expansion-qa');
await fs.mkdir(output,{recursive:true});
const server=createApp({distDir:fileURLToPath(new URL('../dist/',import.meta.url))}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const base=process.env.EXPANSION_QA_URL??`http://127.0.0.1:${server.address().port}`,errors=[];
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#extreme').waitFor({timeout:300000});
  const seed=(wheel=false)=>{
    const w=new EscapeWorld(42);w.data.inventory=['brass','cellar','fuse','cutters',...(wheel?['handwheel']:[])];
    w.data.searched=PROPS.filter(p=>p.loot&&w.data.inventory.includes(p.loot)).map(p=>p.id);
    w.data.power=true;w.data.opened=DOORS.map(d=>d.id);w.data.unlocked=[...w.data.opened];
    Object.assign(w.data.hunter,{x:20.5,z:3.5,angle:0});return w;
  };
  const face=(w,id)=>{const p=PROPS.find(p=>p.id===id);Object.assign(w.data.player,{x:p.x,z:p.z+1,angle:-Math.PI/2,pitch:0});};
  const enter=async w=>{
    const snapshot=w.snapshot();EscapeWorld.restore(snapshot);
    await page.evaluate(s=>{localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(s));localStorage.setItem('nwaxz-escape-sound-v1','{"music":false,"sound":false}');},snapshot);
    await page.locator('#extreme').tap();await page.locator('#escape-menu-solo').tap();await page.locator('#escape-continue').tap();
    await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  };
  const pause=async()=>{
    await page.locator('#escape-pause').tap();await page.locator('#escape-resume').waitFor();
    const s=JSON.parse(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')));EscapeWorld.restore(s);return s;
  };
  const exit=async()=>{await page.locator('#escape-exit').tap();await page.locator('#extreme').waitFor();};
  const interact=async id=>{
    const prop=PROPS.find(p=>p.id===id)??DOORS.find(d=>d.id===id);
    await page.waitForFunction(name=>document.querySelector('#escape-interact:not([hidden]) span')?.textContent?.includes(name),prop.name);
    await page.locator('#escape-interact').tap();await page.waitForTimeout(150);
  };
  const layouts=[];
  const checkLayout=async(width,height)=>{
    await page.setViewportSize({width,height});await page.waitForTimeout(150);
    const rects=await page.evaluate(()=>['#escape-inventory','#escape-stick','.escape-actions','#escape-interact','.escape-meters','#escape-notice','#escape-map','#escape-room-toast'].map(id=>{
      const e=document.querySelector(id),r=e.getBoundingClientRect();return{id,x:r.x,y:r.y,width:r.width,height:r.height,hidden:e.hidden};
    }));
    const shown=rects.filter(r=>!r.hidden&&r.width&&r.height);
    for(const a of shown){
      assert.ok(a.x>=-1&&a.y>=-1&&a.x+a.width<=width+1&&a.y+a.height<=height+1,`${width}x${height} outside: ${JSON.stringify(a)}`);
      for(const b of shown)if(a.id<b.id)assert.ok(!(a.x<b.x+b.width-1&&a.x+a.width>b.x+1&&a.y<b.y+b.height-1&&a.y+a.height>b.y+1),`${width}x${height} overlap: ${JSON.stringify([a,b])}`);
    }
    layouts.push({width,height,rects});await page.screenshot({path:path.join(output,`hud-${width}x${height}.png`)});
  };
  // Cross both actual doorway thresholds using game movement, rather than changing the room label.
  const rooms=[];
  for(const [id,room] of [['changing','旧更衣室'],['boiler','锅炉房']]){
    const w=seed(),door=DOORS.find(d=>d.id===id);w.data.opened=w.data.opened.filter(d=>d!==id);
    Object.assign(w.data.player,{x:door.x+.5,z:door.z-1,angle:Math.PI/2,pitch:0});
    await enter(w);await interact(id);await page.keyboard.down('w');
    await page.waitForFunction(name=>document.querySelector('#escape-map-room')?.textContent===name,room,{timeout:7000});
    await page.keyboard.up('w');assert.equal(await page.locator('#escape-room-toast').innerText(),room);
    await page.screenshot({path:path.join(output,`${id}-doorway.png`)});
    const saved=await pause();assert.ok(saved.player.z>=door.z+.5);rooms.push(room);await exit();
  }
  const drawer=seed();face(drawer,'changing-drawer');await enter(drawer);await interact('changing-drawer');
  await page.waitForFunction(()=>document.querySelector('#escape-inventory [title="生锈手轮"]'),{},{timeout:5000});
  assert.equal(await page.locator('#escape-inventory .escape-slot').count(),5);
  const wheelSave=await pause();assert.ok(wheelSave.inventory.includes('handwheel'));assert.ok(wheelSave.searched.includes('changing-drawer'));await exit();
  const paper=seed(true);face(paper,'boiler-note');await enter(paper);await interact('boiler-note');
  assert.match(await page.locator('#escape-notice').innerText(),/先关冷水.*再开回流.*最后排气/);
  assert.ok((await pause()).notes.includes('boiler-note'));await exit();
  const wrong=seed(true);wrong.data.expansion.valves=[VALVE_ORDER[0]];wrong.data.elapsed=25;
  Object.assign(wrong.data.hunter,{x:5.5,z:16.5,angle:0});face(wrong,VALVE_ORDER[2]);
  await enter(wrong);await interact(VALVE_ORDER[2]);assert.match(await page.locator('#escape-notice').innerText(),/顺序错了/);
  const wrongSave=await pause();assert.deepEqual(wrongSave.expansion.valves,[]);assert.equal(wrongSave.hunter.state,'investigate');
  const stable=await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1'));await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>localStorage.getItem('nwaxz-escape-session-v1')),stable);await exit();
  let solved=seed(true).snapshot();
  for(let i=0;i<VALVE_ORDER.length;i++){
    const w=EscapeWorld.restore(solved);face(w,VALVE_ORDER[i]);await enter(w);await interact(VALVE_ORDER[i]);
    if(i===2){
      assert.match(await page.locator('#escape-notice').innerText(),/已泄压/);
      for(const [width,height] of [[390,844],[320,568],[844,390]])await checkLayout(width,height);
      await page.setViewportSize({width:390,height:844});
    }
    solved=await pause();assert.deepEqual(solved.expansion.valves,VALVE_ORDER.slice(0,i+1));
    const first=await page.locator('#escape-view').screenshot();await page.waitForTimeout(150);
    assert.ok(first.equals(await page.locator('#escape-view').screenshot()),'paused puzzle scene must freeze');await exit();
  }
  for(const crouched of [false,true]){
    const w=seed();w.data.elapsed=25;Object.assign(w.data.player,{x:6.9,z:9.5,angle:0,light:false,crouched});
    Object.assign(w.data.hunter,{x:13.5,z:14.5,angle:0});await enter(w);
    await page.keyboard.down('w');await page.waitForTimeout(crouched?950:600);await page.keyboard.up('w');
    const text=await page.locator('#escape-notice').innerText();
    if(crouched)assert.doesNotMatch(text,/碎玻璃/);else assert.match(text,/碎玻璃/);
    const s=await pause();assert.ok(s.player.x>7.2);assert.equal(s.hunter.state,crouched?'patrol':'investigate');await exit();
  }
  const legacy=seed();delete legacy.data.expansion;
  for(const field of ['opened','unlocked'])legacy.data[field]=legacy.data[field].filter(id=>!['changing','boiler'].includes(id));
  face(legacy,'drain');await enter(legacy);assert.equal(await page.locator('#escape-inventory .escape-slot').count(),4);
  await interact('drain');const legacySave=await pause();assert.equal(legacySave.drained,true);assert.equal(legacySave.expansion,undefined);await exit();
  const desktop=await browser.newContext({viewport:{width:900,height:500}}),pc=await desktop.newPage();
  pc.on('pageerror',e=>errors.push(e.message));await pc.goto(base);await pc.locator('#extreme').waitFor({timeout:300000});
  await pc.evaluate(s=>{localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(s));localStorage.setItem('nwaxz-escape-sound-v1','{"music":false,"sound":false}');},solved);
  await pc.locator('#extreme').click();await pc.locator('#escape-menu-solo').click();await pc.locator('#escape-continue').click();await pc.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  const desktopInventory=await pc.locator('#escape-inventory').boundingBox();
  assert.ok(desktopInventory.height<=48&&desktopInventory.y>400&&desktopInventory.y+desktopInventory.height<=500,'short desktop window keeps inventory at the bottom');
  await pc.keyboard.press('Escape');assert.equal(await pc.locator('#escape-inventory').isVisible(),false);await desktop.close();
  // Verify that a fully solved expanded session remains usable after an offline cold reload.
  await page.evaluate(s=>localStorage.setItem('nwaxz-escape-session-v1',JSON.stringify(s)),solved);
  await context.setOffline(true);await page.reload();await page.locator('#extreme').waitFor();
  await page.locator('#extreme').tap();await page.locator('#escape-menu-solo').tap();await page.locator('#escape-continue').tap();await page.locator('#escape-panel[hidden]').waitFor({state:'attached'});
  const offline=await pause();assert.deepEqual(offline.expansion.valves,VALVE_ORDER);assert.ok(offline.inventory.includes('handwheel'));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({base,rooms,handwheel:true,note:true,wrongOrderInvestigated:true,correctOrder:true,glassWalkAndCrouch:true,legacyDrain:true,layouts,desktopInventory,offlineSolvedSession:true,errors,output}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
