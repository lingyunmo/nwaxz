import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EscapeWorld,PROPS,VALVE_ORDER,roomAt} from '../src/escape/world.ts';

const frames=(w,seconds,input={})=>{for(let n=0;n<Math.ceil(seconds*60);n++)w.advance(1/60,input);};
const face=(w,id)=>{
  const p=PROPS.find(p=>p.id===id);
  Object.assign(w.data.player,{x:p.x,z:p.z+1,angle:-Math.PI/2,pitch:0});
};
const powered=()=>{
  const w=new EscapeWorld();w.data.inventory=['fuse','handwheel'];
  w.data.searched=['laundry-drawer','changing-drawer'];w.data.power=true;return w;
};

test('legacy pursuit cannot reference new patrol stops or unavailable hiding places',()=>{
  const legacy=new EscapeWorld().snapshot();delete legacy.expansion;
  for(const change of [p=>p.patrolIndex=6,p=>p.seenHide='boiler-hide']){
    const s=structuredClone(legacy);change(s.pursuit);
    assert.throws(()=>EscapeWorld.restore(s),/逃生存档/);
  }
});

test('new room doors do not shelter the player from a hunter investigating a real sound',()=>{
  for(const [door,room,x] of [['changing','旧更衣室',4.5],['boiler','锅炉房',11.5]]){
    const w=new EscapeWorld();w.data.elapsed=25;w.data.unlocked.push(door);
    w.data.hidden='bed-hide';Object.assign(w.data.player,{x:5.5,z:2.58,light:false});
    Object.assign(w.data.hunter,{x,z:9.5,state:'patrol'});
    w.noise({x,z:21.5},20);assert.equal(w.data.hunter.state,'investigate');
    let entered=false;
    for(let n=0;n<1800&&!entered;n++){
      w.advance(1/60);entered=roomAt(w.data.hunter)===room;
      assert.equal(w.data.phase,'playing');
    }
    assert.ok(entered,`hunter must physically cross the ${door} threshold`);
    assert.ok(w.data.opened.includes(door),'hunter opens the unlocked closed door');
    EscapeWorld.restore(w.snapshot());
  }
});

test('draining cannot bypass handwheel, supply or an incomplete pressure sequence',()=>{
  const w=powered();face(w,'drain');w.interact();assert.equal(w.data.drained,false);
  w.data.expansion.valves=[VALVE_ORDER[0],VALVE_ORDER[1]];w.interact();assert.equal(w.data.drained,false);
  w.data.expansion.valves=[...VALVE_ORDER];w.data.inventory=w.data.inventory.filter(i=>i!=='handwheel');
  w.interact();assert.equal(w.data.drained,false);
  w.data.inventory.push('handwheel');w.data.power=false;w.interact();assert.equal(w.data.drained,false);
  w.data.power=true;w.interact();assert.equal(w.data.drained,true);
  EscapeWorld.restore(w.snapshot());
});

test('pressure controls without electricity produce neither progress nor a false success',()=>{
  const w=powered();w.data.power=false;face(w,VALVE_ORDER[0]);w.interact();
  assert.deepEqual(w.data.expansion.valves,[]);assert.match(w.message,/供电/);
  assert.equal(w.drainEvents().filter(e=>e.type==='noise').length,0);
});

test('capture and a new night preserve a partially solved pressure puzzle and its real items',()=>{
  const w=powered();face(w,VALVE_ORDER[0]);w.interact();w.capture();w.nextNight();
  assert.equal(w.data.phase,'playing');assert.equal(w.data.captures,1);
  assert.deepEqual(w.data.expansion.valves,[VALVE_ORDER[0]]);
  assert.ok(w.data.inventory.includes('handwheel'));
  assert.deepEqual(EscapeWorld.restore(w.snapshot()).snapshot(),w.snapshot());
});

test('glass does not repeatedly ring while standing on it and rearms only after leaving',()=>{
  const w=new EscapeWorld();w.data.elapsed=25;
  Object.assign(w.data.player,{x:6.9,z:9.5,angle:0,light:false});
  Object.assign(w.data.hunter,{x:20.5,z:3.5});
  frames(w,.3,{forward:1});assert.equal(w.drainEvents().filter(e=>e.type==='noise').length,1);
  frames(w,.3);assert.equal(w.drainEvents().filter(e=>e.type==='noise').length,0);
  frames(w,.55,{forward:-1});assert.equal(w.drainEvents().filter(e=>e.type==='noise').length,0);
  frames(w,.55,{forward:1});assert.equal(w.drainEvents().filter(e=>e.type==='noise').length,1);
  const quiet=new EscapeWorld();quiet.data.elapsed=25;
  Object.assign(quiet.data.player,{x:6.9,z:9.5,angle:0,crouched:true,light:false});
  Object.assign(quiet.data.hunter,{x:13.5,z:14.5,angle:0});
  frames(quiet,.95,{forward:1});assert.ok(quiet.data.player.x>7.5);
  assert.equal(quiet.drainEvents().filter(e=>e.type==='noise').length,0);
  assert.equal(quiet.data.hunter.state,'patrol');
});
