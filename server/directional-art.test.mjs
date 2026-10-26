import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {Texture} from '@babylonjs/core/Materials/Textures/texture.js';
import {DitheredTileFadeMaterialPlugin} from '@babylonjs/core/Materials/ditheredTileFadeMaterialPlugin.js';
import {PaintedFrog,directionalFrogPose} from '../src/escape/frog.ts';
import {DIRECTIONAL_ART} from '../src/escape/directional-art.ts';
import {createEscapeScene} from '../src/escape/scene.ts';
import {EscapeWorld} from '../src/escape/world.ts';
const textures=scene=>Object.fromEntries(['original','actions','directionIdle','directionWalk'].map(k=>[k,new Texture(null,scene)]));
function place(w,angle){Object.assign(w.data.player,{x:11.5+Math.cos(angle)*2,z:4.5+Math.sin(angle)*2,angle:Math.atan2(-Math.sin(angle),-Math.cos(angle)),light:true,pitch:-.12})}
function setup(){const engine=new NullEngine(),view=createEscapeScene(engine),actor=new PaintedFrog(view.scene,textures(view.scene));const w=new EscapeWorld(42);w.data.elapsed=10;Object.assign(w.data.hunter,{x:11.5,z:4.5,angle:0,state:'patrol'});place(w,0);return {engine,view,actor,w}}
function clean(s){s.actor.dispose();s.view.scene.dispose();s.engine.dispose()}

test('canonical front and belly-laugh artwork bytes remain unchanged; new atlases stay small and fully framed',async()=>{
 for(const [name,expected] of [['haunted-frog-v1.webp','8b945a2a3054c3c6d889ef2838b0db572d2a779dafb1a43851b8e24157b046e2'],['haunted-frog-actions-v2.webp','48664f32c5f47cc20436493a21018785eb097136e9cd1c1aebadbaabeda48dc3']]){
  const bytes=await fs.readFile(new URL('../public/assets/character/'+name,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
 }
 for(const [key,name,rows] of [['directionIdle','haunted-frog-directions-idle-v1.webp',2],['directionWalk','haunted-frog-directions-walk-v1.webp',4]]){
  const bytes=await fs.readFile(new URL('../public/assets/character/'+name,import.meta.url));assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.ok(bytes.length<500000,'no huge transparent PNG in the runtime');
  const a=DIRECTIONAL_ART[key];assert.equal(a.frames.length,rows*4);
  for(const [i,f] of a.frames.entries()){
   assert.ok(f.width>100&&f.height>250);assert.ok(f.x>=i%4*a.width/4&&f.x+f.width<=(i%4+1)*a.width/4);
   assert.ok(f.y>=Math.floor(i/4)*a.height/rows&&f.y+f.height<=(Math.floor(i/4)+1)*a.height/rows);assert.ok(f.ground>=0&&f.ground<=4);
  }
 }
});

test('eight real viewing angles select correct art and stable feet, rather than always showing the face',()=>{
 const s=setup();try{
  for(let i=0;i<8;i++){
   place(s.w,i*Math.PI/4);s.actor.animate(s.w,.11,false);const p=s.actor.pose;
   assert.equal(p.direction,i);assert.equal(p.sheet,i===0?'original':'directionIdle');assert.equal(p.frame,i);
   const mesh=s.actor.meshes.find(m=>m.visibility>.99);assert.ok(mesh);assert.equal(mesh.billboardMode,Mesh.BILLBOARDMODE_Y);
   if(i){const rect=DIRECTIONAL_ART.directionIdle.frames[i];assert.ok(Math.abs(mesh.position.y+2.55*mesh.scaling.y*rect.ground/rect.height)<1e-8,'painted feet stay on the floor')}
  }
 }finally{clean(s)}
});

test('every walking direction alternates authored strides; running keeps the same body direction',()=>{
 const s=setup();try{
  for(let i=0;i<8;i++){
   const a=directionalFrogPose(s.w,0,true,i),b=directionalFrogPose(s.w,.26,true,i);
   assert.equal(a.sheet,'directionWalk');assert.equal(a.frame,i);assert.equal(b.frame,i+8);assert.equal(a.motion,'walk');assert.equal(b.direction,i);
  }
  s.w.data.hunter.state='chase';assert.equal(directionalFrogPose(s.w,.2,true,4).frame,12);assert.equal(directionalFrogPose(s.w,.2,true,4).motion,'run');
  s.w.data.hunter.state='search';assert.equal(directionalFrogPose(s.w,1.5,false,0).sheet,'original','front searching cannot fake a different head-facing direction');
 }finally{clean(s)}
});

test('turn transitions retain full opaque coverage instead of showing the wall through the body',()=>{
 const s=setup();try{
  s.actor.animate(s.w,.11,false);place(s.w,Math.PI/2);s.actor.animate(s.w,.03,false);
  const bounds=s.actor.meshes.map(mesh=>{
   assert.equal(mesh.visibility,1,'both transition layers remain opaque');assert.equal(mesh.material.forceDepthWrite,true);
   const result={lowerBound:0,upperBound:0};assert.ok(DitheredTileFadeMaterialPlugin.GetOrCreate(mesh.material).getFadeBoundsToRef(mesh,result));return result;
  });
  for(let pixel=0;pixel<64;pixel++){
   const threshold=(pixel+.5)/64;
   assert.equal(bounds.filter(b=>threshold>=b.lowerBound&&threshold<b.upperBound).length,1,'exactly one pose covers each overlap pixel');
  }
  s.actor.animate(s.w,.08,false);assert.equal(s.actor.meshes.filter(m=>m.visibility===1).length,1,'the old pose leaves after the transition');
 }finally{clean(s)}
});

test('freezing holds the body and gait, while circling the frozen hunter still reveals its true back',()=>{
 const s=setup();try{
  s.actor.animate(s.w,.1,true);s.w.data.hunt.collected=['crystal-bed'];s.w.useCrystal('freeze');s.actor.animate(s.w,.1,true);
  const step=Math.floor(s.actor.pose.frame/8),hunter={...s.w.data.hunter},geometry=s.actor.meshes.map(m=>m.getVerticesData('position').slice());
  for(const i of [1,2,3,4,5,6,7,0]){
   place(s.w,i*Math.PI/4);s.actor.animate(s.w,.11,false);assert.equal(s.actor.pose.direction,i);assert.equal(Math.floor(s.actor.pose.frame/8),step);
   assert.equal(s.actor.pose.motion,'walk');assert.deepEqual(s.w.data.hunter,hunter);
   s.actor.meshes.forEach((m,index)=>assert.deepEqual(m.getVerticesData('position'),geometry[index]));
   assert.ok(s.actor.meshes.some(m=>m.visibility>.99),'the view change must finish even while frozen');
  }
 }finally{clean(s)}
});

test('timed reveal uses the same directional UV and proportions without changing normal depth rules',()=>{
 const s=setup();try{
  place(s.w,Math.PI/2);s.w.data.hunt.collected=['crystal-hall-west'];s.w.useCrystal('reveal');s.actor.animate(s.w,.11,false);
  const normal=s.actor.meshes.find(m=>m.visibility>.99),overlay=s.view.scene.meshes.find(m=>m.name.startsWith('hunter-reveal-overlay')&&m.visibility>0);
  assert.ok(overlay);assert.equal(overlay.material.diffuseTexture,normal.material.diffuseTexture);assert.deepEqual(overlay.scaling.asArray(),normal.scaling.asArray());
  assert.equal(normal.material.forceDepthWrite,true);assert.equal(overlay.material.forceDepthWrite,false);
  s.w.data.hunt.reveal=0;s.actor.animate(s.w,.11,false);assert.equal(overlay.visibility,0);
 }finally{clean(s)}
});

test('timed reveal outline remains visible when hunter and viewer are on different floors',()=>{
 const s=setup();try{
  s.w.data.player.z=40.5;s.w.data.hunter.z=9.5;s.w.data.hunt.reveal=5;
  s.actor.animate(s.w,.11,false);
  const overlay=s.view.scene.meshes.find(m=>m.name.startsWith('hunter-reveal-overlay')&&m.visibility>0);
  assert.ok(overlay,'depth-bypassing reveal outline renders through the inter-floor slab');
 }finally{clean(s)}
});

test('capture always uses the original clear belly laugh, and a reused renderer cannot freeze that pose into a new save',()=>{
 const s=setup();try{
  place(s.w,Math.PI);s.actor.animate(s.w,.11,false);s.w.capture();s.actor.animate(s.w,.11,false);
  assert.deepEqual(s.actor.pose,{sheet:'original',frame:1,motion:'laugh'});
  const resumed=new EscapeWorld(43);resumed.data.elapsed=20;Object.assign(resumed.data.hunter,{x:11.5,z:4.5,angle:0});place(resumed,Math.PI);
  resumed.data.hunt.collected=['crystal-bed'];resumed.useCrystal('freeze');s.actor.animate(resumed,.11,false);
  assert.equal(s.actor.pose.sheet,'directionIdle');assert.equal(s.actor.pose.frame,4);assert.equal(s.actor.pose.motion,'idle');
  assert.ok(s.actor.meshes.some(m=>m.visibility>.99));
 }finally{clean(s)}
});
