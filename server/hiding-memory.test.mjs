import test from 'node:test';
import assert from 'node:assert/strict';
import {EscapeWorld} from '../src/escape/world.ts';

function entry(angle) {
 const w=new EscapeWorld(42);w.data.elapsed=10;
 Object.assign(w.data.player,{x:5.5,z:3.5,angle:-Math.PI/2,light:false});
 Object.assign(w.data.hunter,{x:3.5,z:3.5,angle,state:'chase'});
 return w;
}
test('a pursuing hunter cannot witness wardrobe entry through the back of its head',()=>{
 const w=entry(Math.PI);assert.equal(w.seesPlayer(),false);w.interact();
 assert.equal(w.data.hidden,'bed-hide');assert.equal(w.snapshot().pursuit.seenHide,undefined);
 assert.match(w.message,/已躲进/);
});
test('visible wardrobe entry is remembered and the occupied cabinet remains safe when searched',()=>{
 const w=entry(0);assert.equal(w.seesPlayer(),true);w.interact();
 assert.equal(w.snapshot().pursuit.seenHide,'bed-hide');
 Object.assign(w.data.hunter,{x:5.5,z:3.3});w.advance(.1);
 assert.equal(w.data.phase,'playing');assert.equal(w.data.hidden,'bed-hide');
});
test('a sense reveal can guide the hunter to a wardrobe without capturing its occupant',()=>{
 const w=entry(Math.PI);w.interact();assert.equal(w.data.hidden,'bed-hide');
 w.seenHide='bed-hide';Object.assign(w.data.hunter,{x:5.5,z:3.3});w.advance(.1);
 assert.equal(w.data.phase,'playing');assert.equal(w.data.hidden,'bed-hide');
});
test('searching an old empty cabinet cannot capture the player hiding in another room',()=>{
 const w=entry(0);w.interact();w.interact();
 Object.assign(w.data.player,{x:21.5,z:5.5,angle:-Math.PI/2});
 assert.equal(w.seesPlayer(),false);w.interact();assert.equal(w.data.hidden,'office-hide');
 Object.assign(w.data.hunter,{x:5.5,z:3.3});w.advance(.1);
 assert.equal(w.data.phase,'playing');assert.equal(w.snapshot().pursuit.seenHide,undefined);
 assert.equal(w.data.hidden,'office-hide');
});
