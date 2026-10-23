import test from 'node:test';
import assert from 'node:assert/strict';
import {writeSaveBatch,SaveWriteError} from '../src/escape/save.ts';
function store(initial, reject=()=>false) {
  const values=new Map(Object.entries(initial)); let writes=0;
  return {values,getItem:k=>values.get(k)??null,removeItem:k=>values.delete(k),setItem(k,v){writes++;if(reject(k,v,writes))throw new Error('quota');values.set(k,v)}};
}
test('save import replaces the requested keys while preserving unrelated data',()=>{
  const storage=store({session:'old',record:'best',settings:'unchanged'});
  writeSaveBatch(storage,[['record','new-best'],['session','new-session']]);
  assert.deepEqual(Object.fromEntries(storage.values),{session:'new-session',record:'new-best',settings:'unchanged'});
});
test('a rejected session write restores the previously written best record',()=>{
  const storage=store({session:'old',record:'best'},k=>k==='session');
  assert.throws(()=>writeSaveBatch(storage,[['record','new-best'],['session','new-session']]),e=>e instanceof SaveWriteError&&e.restored);
  assert.deepEqual(Object.fromEntries(storage.values),{session:'old',record:'best'});
  const missing=store({session:'old'},k=>k==='session');
  assert.throws(()=>writeSaveBatch(missing,[['record','new-best'],['session','new-session']]));
  assert.equal(missing.values.has('record'),false,'rollback removes a newly introduced key');
});
test('denied reads never start writing an import',()=>{
  let writes=0;
  const storage={getItem(){throw new Error('denied')},setItem(){writes++},removeItem(){writes++}};
  assert.throws(()=>writeSaveBatch(storage,[['session','new']]),e=>e instanceof SaveWriteError&&e.restored);
  assert.equal(writes,0);
});
test('rollback failure is reported instead of promising that old data is intact',()=>{
  const storage=store({session:'old',record:'best'},(_k,_v,n)=>n>1);
  assert.throws(()=>writeSaveBatch(storage,[['record','new-best'],['session','new-session']]),e=>e instanceof SaveWriteError&&!e.restored);
  assert.equal(storage.values.get('record'),'new-best');
  assert.equal(storage.values.get('session'),'old');
});
