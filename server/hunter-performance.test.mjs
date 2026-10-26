import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EscapeWorld} from '../src/escape/world.ts';
import {directionalFrogPose,PaintedFrog} from '../src/escape/frog.ts';
import {FROG_EXTRA_ART} from '../src/escape/extra-art.ts';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Texture} from '@babylonjs/core/Materials/Textures/texture.js';
import {createEscapeScene} from '../src/escape/scene.ts';
import {CoopService} from './coop-service.mjs';
import {createInterference} from '../src/escape/interference.ts';
import {isAbilityState,createAbilities} from '../src/escape/abilities.ts';
import packageInfo from '../package.json' with {type:'json'};

function world(){const w=new EscapeWorld(42);w.data.elapsed=10;Object.assign(w.data.player,{x:20.5,z:20.5,light:false});Object.assign(w.data.hunter,{x:3.5,z:9.5,angle:0,state:'patrol'});return w;}
function advance(w,seconds){for(let left=seconds;left>1e-8;left-=.05)w.advance(Math.min(.05,left));}

test('five native transparent PNGs have 40 measured frames and unchanged file hashes',async()=>{
 for(const art of Object.values(FROG_EXTRA_ART)){
  const bytes=await fs.readFile(new URL('../public'+art.url,import.meta.url));
  assert.equal(bytes.readUInt32BE(16),1774);assert.equal(bytes.readUInt32BE(20),887);assert.equal(bytes[25],6,'RGBA');
  assert.equal(bytes.length,art.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),art.sha256);
  assert.equal(art.frames.length,8);for(const r of art.frames){assert.ok(r.width>150&&r.height>300);assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=art.width&&r.y+r.height<=art.height);assert.ok(r.ground>=0&&r.ground<=3);}
 }
});

test('laugh, listening, grab and both creeping steps select authored art in every direction',()=>{
 const w=world();
 for(let direction=0;direction<8;direction++){
  w.data.hunter.performance={kind:'laugh',reason:'skill',until:12.4};let p=directionalFrogPose(w,0,false,direction);assert.equal(p.sheet,'directionLaugh');assert.equal(p.frame,direction);
  delete w.data.hunter.performance;w.data.hunter.state='search';p=directionalFrogPose(w,0,false,direction);assert.equal(p.sheet,'directionSearch');assert.equal(p.frame,direction);
  w.data.hunter.state='chase';w.data.player.x=w.data.hunter.x+.8;w.data.player.z=w.data.hunter.z;p=directionalFrogPose(w,0,true,direction);assert.equal(p.sheet,'directionAttack');assert.equal(p.frame,direction);
  w.data.player.x=20.5;w.data.player.z=20.5;w.data.hunter.performance={kind:'stalk',reason:'hunt',until:12.8};
  assert.equal(directionalFrogPose(w,0,true,direction).sheet,'directionStalk');assert.equal(directionalFrogPose(w,.4,true,direction).sheet,'directionStalkB');
 }
 w.capture();assert.deepEqual(directionalFrogPose(w,0,false,4),{sheet:'original',frame:1,motion:'laugh'},'canonical captured belly laugh always wins');
});

test('casting laughs stop actual movement, expire on simulation time and survive save/restore',()=>{
 const w=world(),before={...w.data.hunter};w.performHunterLaugh('skill');advance(w,.4);
 assert.equal(w.data.hunter.x,before.x);assert.equal(w.data.hunter.z,before.z);assert.equal(w.drainEvents().filter(e=>e.type==='laugh').length,1);
 assert.deepEqual(EscapeWorld.restore(w.snapshot()).data.hunter.performance,w.data.hunter.performance);
 advance(w,2.6);assert.ok(Math.hypot(w.data.hunter.x-before.x,w.data.hunter.z-before.z)>.1);assert.equal(w.data.hunter.performance,undefined);
});

test('real single and co-op ability warning transitions trigger the shared casting laugh',()=>{
 for(const cooperative of[false,true]){
  const w=world();Object.assign(w.data.player,{x:3.5,z:35.5});
  w.data.abilities={...createAbilities(),enabled:true,stage:'attempt',rest:0,selected:'sense',attempt:29,tick:.99};
  if(cooperative)w.advanceEnemyAuthoritative(.05,[{id:'target',player:{...w.data.player},living:true,moving:false,exposure:0}]);else advance(w,.05);
  assert.equal(w.data.abilities.stage,'warning');assert.equal(w.data.hunter.performance.reason,'skill');assert.equal(w.drainEvents().filter(e=>e.type==='laugh').length,1);
 }
});

test('freeze holds a performance, but proximity capture and real sightings remain active outside freeze',()=>{
 const w=world();w.performHunterLaugh('skill');w.data.hunt.freeze=1;const remaining=w.data.hunter.performance.until-w.data.elapsed;advance(w,.4);
 assert.ok(Math.abs(w.data.hunter.performance.until-w.data.elapsed-remaining)<1e-7);
 w.data.hunt.freeze=0;Object.assign(w.data.player,{x:w.data.hunter.x+.1,z:w.data.hunter.z});advance(w,.05);assert.equal(w.data.phase,'caught','laugh is not immunity');
});

test('noise investigation listens briefly then continues toward its real clue',()=>{
 const w=world();w.noise({x:6.5,z:9.5},20);assert.equal(w.data.hunter.state,'investigate');const x=w.data.hunter.x;advance(w,.1);
 assert.equal(w.data.hunter.performance.kind,'listen');assert.equal(w.data.hunter.x,x);advance(w,1.2);assert.ok(w.data.hunter.x>x);
});

test('creeping chase is slower than sprint chase and keeps correct movement heading',()=>{
 const slow=world(),fast=world();for(const w of[slow,fast]){Object.assign(w.data.hunter,{x:3.5,z:9.5,angle:0,state:'chase'});Object.assign(w.data.player,{x:7.5,z:9.5});w.stalkAt=1000;}
 slow.data.hunter.performance={kind:'stalk',reason:'hunt',until:12.8};advance(slow,.15);advance(fast,.15);
 assert.ok(slow.data.hunter.x>3.5&&slow.data.hunter.x<fast.data.hunter.x);assert.ok(Math.abs(slow.data.hunter.angle)<1e-6);
});

test('patrol laughter does not consume the perception/skill RNG and is interrupted by chase',()=>{
 const w=world();w.data.elapsed=21;w.performanceRandom=()=>.1;const rng=w.data.hunt.rng;w.updateHunter(.01);assert.equal(w.data.hunter.performance.reason,'patrol');assert.equal(w.data.hunt.rng,rng);
 w.data.hunter.state='chase';w.stalkAt=1000;w.updateHunter(.01);assert.equal(w.data.hunter.performance,undefined);
});

test('new directional performances use measured UVs/feet and stay held when frozen',()=>{
 const engine=new NullEngine(),view=createEscapeScene(engine),textures=Object.fromEntries(['original','actions','directionIdle','directionWalk',...Object.keys(FROG_EXTRA_ART)].map(k=>[k,new Texture(null,view.scene)])),actor=new PaintedFrog(view.scene,textures),w=world();
 try{
  w.data.hunter.performance={kind:'laugh',reason:'interference',until:12.4};
  for(let i=0;i<8;i++){w.data.player.x=w.data.hunter.x+Math.cos(i*Math.PI/4)*3;w.data.player.z=w.data.hunter.z+Math.sin(i*Math.PI/4)*3;actor.animate(w,.11,false);assert.equal(actor.pose.sheet,'directionLaugh');assert.equal(actor.pose.frame,i);const mesh=actor.meshes.find(m=>m.visibility>.99),r=FROG_EXTRA_ART.directionLaugh.frames[i];assert.ok(Math.abs(mesh.material.diffuseTexture.uScale-r.width/1774)<1e-9);assert.ok(Math.abs(mesh.position.y+2.45*r.ground/r.height)<1e-8);}
  w.data.hunt.freeze=5;actor.animate(w,.1,false);const geometry=actor.meshes.map(m=>m.getVerticesData('position').slice());actor.animate(w,.1,false);actor.meshes.forEach((m,i)=>assert.deepEqual(m.getVerticesData('position'),geometry[i]));
 }finally{actor.dispose();view.scene.dispose();engine.dispose();}
});

test('bad performance timers/variants are rejected without rejecting current snapshots',()=>{
 const w=world();for(const p of[{kind:'laugh',reason:'skill',until:Infinity},{kind:'laugh',reason:'skill',until:50},{kind:'stalk',reason:'skill',until:12},{kind:'listen',reason:'clue',until:12,extra:true}]){const save=w.snapshot();save.hunter.performance=p;assert.throws(()=>EscapeWorld.restore(save));}assert.doesNotThrow(()=>EscapeWorld.restore(w.snapshot()));
});

test('co-op interference starts one shared laugh; every room viewer sees the same performance',()=>{
 const service=new CoopService({autoTick:false});try{
  const a=service.create({version:packageInfo.version,name:'甲',avatar:0}),b=service.join({version:packageInfo.version,name:'乙',avatar:1,code:a.code});
  for(const s of[a,b])service.setReady(a.code,s.token,true);service.start(a.code,{id:a.playerId,token:a.token});const room=service.rooms.get(a.code),p=room.players.get(a.playerId);
  p.actorWorld.data.interference={...createInterference(0),stage:'attempt',clear:0,attempt:29,tick:.99};
  p.actorWorld.advanceActorAuthoritative(.1,{}, {playerId:p.id});service.collectActorEvents(room,p);
  assert.equal(room.world.data.hunter.performance.reason,'interference');assert.equal(room.world.drainEvents().filter(e=>e.type==='laugh').length,1);
  assert.deepEqual(service.snapshot(room,p).world.hunter.performance,service.snapshot(room,room.players.get(b.playerId)).world.hunter.performance);
 }finally{service.close();}
});

test('switching the co-op scan target resets all coupled motion fields consistently',()=>{
 const w=world();const candidate=(id,moving)=>({id,player:{...w.data.player,x:3.5,z:35.5},living:true,moving,exposure:0});
 w.advanceEnemyAuthoritative(.05,[candidate('a',true)]);assert.equal(w.data.abilities.scanChance,.8);
 w.advanceEnemyAuthoritative(.05,[candidate('b',false)]);assert.equal(w.data.abilities.scanChance,.2);assert.equal(w.data.abilities.moving,false);assert.equal(isAbilityState(w.data.abilities),true);
});
