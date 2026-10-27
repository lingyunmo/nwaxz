import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ART_IDS,ARTS,HEROES,BOSSES,POSITIONS,relation,weakTo} from '../src/versus/catalog.ts';
import {initialDraft,readDraft,reduceDraft,complete,nickname} from '../src/versus/state.ts';

test('four original arts form a directed cycle with neutral opposing pairs',()=>{
  for(const a of ART_IDS){assert.equal(relation(a,a),'neutral');assert.equal(relation(a,ARTS[a].beats),'strong');assert.equal(relation(a,weakTo(a)),'weak');assert.equal(ART_IDS.filter(b=>relation(a,b)==='neutral'&&a!==b).length,1);}
  assert.deepEqual(POSITIONS,['上渠','下渠','巡河']);assert.equal(new Set(HEROES.map(h=>h.art)).size,4);
});
test('three unique seats are required to lock a team; locking does not mutate input',()=>{
  let s=initialDraft();assert.equal(complete(s.teams.clear),false);assert.equal(reduceDraft(s,{type:'lock',team:'clear'}).locked.clear,false);
  for(const [slot,hero] of ['alan','zhenzhen','dingdang'].entries()){s=reduceDraft(s,{type:'seat',team:'clear',slot});s=reduceDraft(s,{type:'pick',hero});}
  assert.equal(complete(s.teams.clear),true);const locked=reduceDraft(s,{type:'lock',team:'clear'});assert.equal(s.locked.clear,false);assert.equal(locked.locked.clear,true);
  assert.deepEqual(reduceDraft(locked,{type:'pick',hero:'paoying'}).teams.clear,locked.teams.clear);
  assert.equal(reduceDraft(locked,{type:'edit',team:'clear'}).locked.clear,false);
});
test('choosing an already seated hero swaps seats, including an empty destination',()=>{
  let s=reduceDraft(initialDraft(),{type:'example'});s=reduceDraft(s,{type:'seat',team:'clear',slot:1});s=reduceDraft(s,{type:'pick',hero:'alan'});
  assert.deepEqual(s.teams.clear,['zhenzhen','alan','dingdang']);
  s=initialDraft();s=reduceDraft(s,{type:'pick',hero:'alan'});s=reduceDraft(s,{type:'seat',team:'clear',slot:2});s=reduceDraft(s,{type:'pick',hero:'alan'});assert.deepEqual(s.teams.clear,[null,null,'alan']);
});
test('two factions edit and lock independently and may mirror heroes',()=>{
  let s=reduceDraft(initialDraft(),{type:'example'});assert.ok(s.teams.clear.includes('alan')&&s.teams.warm.includes('alan'));
  s=reduceDraft(s,{type:'lock',team:'clear'});s=reduceDraft(s,{type:'seat',team:'warm',slot:0});s=reduceDraft(s,{type:'pick',hero:'zhenzhen'});
  assert.deepEqual(s.teams.clear,['alan','zhenzhen','dingdang']);assert.deepEqual(s.teams.warm,['zhenzhen','alan','dingdang']);assert.equal(s.locked.clear,true);assert.equal(s.locked.warm,false);
});
test('preview persistence roundtrips only validated fields',()=>{
  const s=reduceDraft(initialDraft(),{type:'example'});s.locked.clear=true;s.nickname='小奶娃';const parsed=readDraft(JSON.stringify({...s,token:'untrusted',extra:{}}));assert.deepEqual(parsed,s);assert.equal('token' in parsed,false);
});
test('malformed local drafts reset the preview without migrating or trusting arbitrary IDs',()=>{
  const cases=[null,'garbage','{}',JSON.stringify({...initialDraft(),version:0}),JSON.stringify({...initialDraft(),activeSlot:8}),JSON.stringify({...initialDraft(),teams:{clear:['alan','alan',null],warm:[null,null,null]}}),JSON.stringify({...initialDraft(),locked:{clear:true,warm:false}}),JSON.stringify({...initialDraft(),featured:'<img onerror=alert(1)>'})];
  for(const raw of cases)assert.deepEqual(readDraft(raw),initialDraft());
});
test('nickname removes markup/control characters and counts Unicode codepoints',()=>{
  assert.equal(nickname(' <奶娃>\n '),'奶娃');assert.equal(nickname(''), '新来的奶娃');assert.equal([...nickname('蛙'.repeat(20))].length,12);assert.equal([...nickname('🐸'.repeat(20))].length,12);
});
test('invalid seat and hero events cannot corrupt valid draft',()=>{
  const s=initialDraft();for(const e of [{type:'pick',hero:'bad'},{type:'seat',team:'bad',slot:0},{type:'seat',team:'clear',slot:-1},{type:'lock',team:'bad'},{type:'edit',team:'bad'}])assert.deepEqual(reduceDraft(s,e),s);
});
test('all eight client paintings retain native PNG dimensions and hashes',()=>{
  const m=JSON.parse(fs.readFileSync(new URL('../public/assets/versus/manifest.json',import.meta.url),'utf8'));assert.equal(m.assets.length,8);assert.equal(m.nativeBytes,true);
  for(const a of m.assets){const b=fs.readFileSync(new URL('../public'+a.url,import.meta.url));assert.equal(b.readUInt32BE(16),a.width);assert.equal(b.readUInt32BE(20),a.height);assert.ok(a.width>=1024&&a.height>=887);assert.equal(b.length,a.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);}
  for(const h of HEROES){assert.ok(m.assets.some(a=>a.url===h.image&&a.pngColorType===6));assert.deepEqual(h.skills.map(s=>s.key),['P','Q','E','R']);}
  for(const b of BOSSES)assert.ok(m.assets.some(a=>a.url===b.image));
});
