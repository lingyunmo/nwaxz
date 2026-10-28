import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {entriesForScope} from '../src/preload-policy.ts';
import {levelArtworkKeys,artworkPaths} from '../src/artwork.ts';
import {levels} from '../src/game/levels.ts';
import {isNativePainting} from '../src/native-preload.ts';

test('startup excludes unrelated resources while a complete-offline request retains them',()=>{
 const entries=[{url:'index.html',bytes:100,startup:true},{url:'assets/actor.png',bytes:3000000},{url:'assets/intro.mp4',bytes:4000000}];
 assert.deepEqual(entriesForScope(entries,'startup'),[entries[0]]);
 assert.deepEqual(entriesForScope(entries,'all'),entries);
 assert.equal(entries.length,3);
});
test('every bath prepares its actual scene and the original victory pose, without other bath scenes',()=>{
 for(const level of levels){const keys=levelArtworkKeys(level),scene=level.scene&&level.scene!=='bath'?level.scene:'stage';
  assert.ok(keys.includes(scene));assert.ok(keys.includes('tub'));
  for(const key of keys)assert.ok(fs.existsSync(new URL('../public'+artworkPaths[key],import.meta.url)));
  if(level.mode)assert.ok(keys.includes('hauntedFrog'),'canonical belly laugh remains required');else{assert.ok(keys.includes('frog'));assert.ok(keys.includes('extra'));assert.ok(!keys.includes('infernalFrog'))}
  assert.equal(keys.includes('infernalFrog'),level.mode==='infernal');
 }
 const first=levelArtworkKeys(levels[0]);assert.ok(first.reduce((sum,key)=>sum+fs.statSync(new URL('../public'+artworkPaths[key],import.meta.url)).size,0)<1024*1024,'first normal bath stays below 1MiB of original images');
});
test('range-verified originals include material and action PNGs, never arbitrary endpoints or videos',()=>{
 for(const url of ['/assets/materials/escape/01-wall-tile-v1.png','/assets/character/frog-creep-v1.png','/assets/scenes/versus-cover-v1.png'])assert.equal(isNativePainting(url),true);
 for(const url of ['/api/a.png','/assets/other.png','/assets/video/a.mp4'])assert.equal(isNativePainting(url),false);
});
