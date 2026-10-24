import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Texture} from '@babylonjs/core/Materials/Textures/texture.js';
import {EscapeWorld,CRYSTALS} from '../src/escape/world.ts';
import {createEscapeScene} from '../src/escape/scene.ts';
import {PaintedFrog} from '../src/escape/frog.ts';
const frames=(w,t)=>{for(let n=0;n<Math.ceil(t*60);n++)w.advance(1/60);};
const freeze=w=>{w.interact();assert.ok(w.crystalCharges('freeze'));w.useCrystal('freeze');};

test('unseen hiding places do not feed their coordinates into dynamic patrol',()=>{
  const a=new EscapeWorld(81),b=new EscapeWorld(81);
  Object.assign(a.data.player,{x:5.5,z:2.58,light:false});a.data.hidden='bed-hide';
  Object.assign(b.data.player,{x:2.5,z:16.58,light:false});b.data.hidden='laundry-hide';
  frames(a,25);frames(b,25);
  assert.deepEqual(a.data.hunter,b.data.hunter);
  assert.deepEqual(a.snapshot().pursuit,b.snapshot().pursuit);
  assert.equal(a.data.hunt.rng,b.data.hunt.rng);
});

test('flashlight detection uses the rendered metre range and respects a closed door',()=>{
  const engine=new NullEngine(),view=createEscapeScene(engine);
  try{
    for(const [gap,expected] of [[14.5,true],[14.7,false],[20,false]]){
      const w=new EscapeWorld(1);freeze(w);
      Object.assign(w.data.player,{x:1.5,z:9.5,angle:0,pitch:0,light:true});
      Object.assign(w.data.hunter,{x:1.5+gap,z:9.5});
      assert.equal(w.illuminatesHunter(),expected,`${gap} grid units vs ${view.torch.range} metres`);
    }
    const w=new EscapeWorld(1);freeze(w);
    Object.assign(w.data.player,{x:4.5,z:6.5,angle:Math.PI/2,light:true});Object.assign(w.data.hunter,{x:4.5,z:8.5});
    w.data.opened=w.data.opened.filter(id=>id!=='bedroom');assert.equal(w.illuminatesHunter(),false);
    w.data.opened.push('bedroom');assert.equal(w.illuminatesHunter(),true);
    for(const patch of [{pitch:1.2},{light:false},{battery:0}]){
      const old={...w.data.player};Object.assign(w.data.player,patch);assert.equal(w.illuminatesHunter(),false);Object.assign(w.data.player,old);
    }
    Object.assign(w.data.player,{x:4.5,z:2.5,angle:0,light:true});Object.assign(w.data.hunter,{x:6.5,z:2.5});
    assert.equal(w.illuminatesHunter(),false,'the solid bedroom wardrobe must intercept the beam');
  }finally{view.scene.dispose();engine.dispose();}
});

test('freeze prevents a touching hunter from capturing for ten seconds and then releases it',()=>{
  const w=new EscapeWorld(91);freeze(w);w.data.elapsed=25;w.data.player.light=false;
  Object.assign(w.data.hunter,{x:w.data.player.x+.3,z:w.data.player.z,angle:Math.PI,state:'chase'});
  const held={...w.data.hunter};frames(w,9.9);
  assert.deepEqual(w.data.hunter,held);assert.equal(w.data.phase,'playing');
  frames(w,.2);assert.equal(w.data.hunt.freeze,0);assert.equal(w.data.phase,'caught');
  assert.equal(w.data.hunt.freezeUsed,1);assert.equal(w.crystalCharges('freeze'),0);
});

test('frozen original-art geometry holds its pose, while capture restores the full laugh',()=>{
  const engine=new NullEngine(),view=createEscapeScene(engine);
  const actor=new PaintedFrog(view.scene,{original:new Texture(null,view.scene),actions:new Texture(null,view.scene)});
  try{
    const w=new EscapeWorld(42);actor.animate(w,.1,true);freeze(w);actor.animate(w,.1,true);
    const poses=actor.meshes.map(m=>({vertices:m.getVerticesData('position').slice(),y:m.position.y})),pose={...actor.pose};
    for(let n=0;n<10;n++){w.advance(.1);actor.animate(w,.1,true);}
    assert.deepEqual(actor.pose,pose);
    actor.meshes.forEach((m,i)=>{assert.deepEqual(m.getVerticesData('position'),poses[i].vertices);assert.equal(m.position.y,poses[i].y);assert.equal(m.material.forceDepthWrite,true);assert.notEqual(m.material.depthFunction,Engine.ALWAYS);});
    const overlays=view.scene.meshes.filter(m=>m.name.startsWith('hunter-reveal-overlay'));
    assert.equal(overlays.length,2);assert.ok(overlays.every(m=>m.visibility===0&&m.material.forceDepthWrite===false));
    w.data.hunt.collected.push(CRYSTALS.find(c=>c.kind==='reveal').id);w.useCrystal('reveal');actor.animate(w,.1,false);
    assert.ok(overlays.some(m=>m.visibility>0));
    w.capture();actor.animate(w,.1,false);
    assert.equal(actor.pose.motion,'laugh');assert.equal(actor.pose.sheet,'original');assert.equal(actor.pose.frame,1);
    assert.ok(overlays.every(m=>m.visibility===0));
    for(const m of actor.meshes)assert.deepEqual(m.material.emissiveColor.asArray(),[1,1,1]);
  }finally{actor.dispose();view.scene.dispose();engine.dispose();}
});
