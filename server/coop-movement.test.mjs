import test from 'node:test';
import assert from 'node:assert/strict';
import {EscapeWorld} from '../src/escape/world.ts';
import {CoopMovement} from '../src/escape/coop-movement.ts';
test('render-rate movement responds before any network snapshot and never mutates shared rules',()=>{
 const world=new EscapeWorld(42),before=world.snapshot(),prediction=new CoopMovement();prediction.accept(world,0,200,'self');
 const point=prediction.advance(world,1/60,{forward:1},16,'self');assert.ok(point.z<before.player.z);assert.deepEqual(world.snapshot(),before);
 for(let i=2;i<180;i++){const p=prediction.advance(world,1/60,{forward:1},i*16,'self');assert.equal(world.wall(p.x,p.z),0);}
 assert.deepEqual(world.snapshot(),before);
});
test('a hidden player cannot predict through a wardrobe and a new view discards stale movement',()=>{
 const world=new EscapeWorld(42),prediction=new CoopMovement();world.data.hidden='bed-hide';Object.assign(world.data.player,{x:5.5,z:2.58});prediction.accept(world,0,200,'a');
 assert.deepEqual(prediction.advance(world,.1,{forward:1},100,'a'),{x:5.5,z:2.58});world.data.hidden=undefined;Object.assign(world.data.player,{x:20.5,z:5.5});prediction.accept(world,500,200,'b');
 assert.deepEqual(prediction.advance(world,0,{},500,'b'),{x:20.5,z:5.5});
});
test('a delayed correction does not jump the camera or wait for another acknowledgement',()=>{
 const world=new EscapeWorld(42),prediction=new CoopMovement();prediction.accept(world,0,200,'a');let previous;
 for(let n=1;n<=12;n++)previous=prediction.advance(world,1/60,{forward:1},n*1000/60,'a');
 world.data.player.z-=.1;prediction.accept(world,200,200,'a');
 const corrected=prediction.advance(world,0,{},200,'a');assert.ok(Math.hypot(corrected.x-previous.x,corrected.z-previous.z)<1e-8);
 const next=prediction.advance(world,1/60,{forward:1},217,'a');assert.ok(next.z<corrected.z);
});
