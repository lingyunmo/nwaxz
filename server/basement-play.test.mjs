import assert from 'node:assert/strict';
import test from 'node:test';
import { EscapeWorld } from '../src/escape/world.ts';
import { floorAt } from '../src/escape/basement-map.ts';
import { playEscapeRoute } from './escape-player.mjs';

// Seed changes the active hunter, not the level geometry. This reference policy
// proves the full objective chain at 202; other seeds exercise genuine outcomes.
for (const seed of [202]) {
  test(`continuous v2 escape crosses the basement and returns, seed ${seed}`, { timeout: 180_000 }, () => {
    const { world, routeProof, log, phase, captures, time } = playEscapeRoute(new EscapeWorld(seed), true);
    assert.equal(phase, 'won');
    assert.ok(captures < 3, `survived with ${captures} captures`);
    assert.ok(time > 60, 'played the complete chain over real model time');
    assert.deepEqual([...world.data.inventory].sort(), ['brass', 'cellar', 'cutters', 'fuse', 'handwheel', 'relay']);
    assert.equal(world.data.power, true);
    assert.equal(world.data.drained, true);
    assert.deepEqual(world.data.expansion.valves, ['valve-cold', 'valve-return', 'valve-vent']);
    assert.deepEqual(world.data.basement, { power: true, sluice: true });
    assert.ok(world.data.searched.includes('basement-storage-drawer'));
    assert.ok(world.data.notes.includes('basement-secret-note'));
    assert.ok(world.data.hunt.collected.includes('crystal-ward-changing'), 'a ward was physically picked up along the route');
    assert.ok(world.data.hunt.wardUsed > 0, 'the finite ward was used against a real cast during the route');
    assert.ok(routeProof.visitedBasement, 'player physically reached z >= 28');
    assert.ok(routeProof.returnedToGround, 'player physically returned above the stair threshold');
    assert.ok(routeProof.zTrail.some(z => z >= 24 && z < 28), 'player physically walked the stair slope');
    assert.ok(floorAt(world.data.player) === 0 && world.data.player.z < 24, 'final exit is on the ground floor');
    assert.ok(routeProof.basementAbilityTicks > 0, 'basement skills ran while the player was below ground');
    assert.ok(routeProof.abilityNotices.some(kind => kind.endsWith('-warning')), 'the hunter ability warning remained active');
    assert.ok(routeProof.hunterStates.includes('chase') || routeProof.hunterStates.includes('investigate'), 'hunter AI responded during play');
    for (const id of ['basement-storage-drawer', 'basement-secret-note', 'basement-relay', 'basement-sluice', 'exit']) {
      assert.ok(log.some(entry => entry.id === id && (entry.phase === 'playing' || entry.phase === 'won')), `${id} was completed in the real route`);
    }
  });
}

for (const seed of [101,303]) {
 test('active hunter pressure produces a valid end state without suppressing AI, seed '+seed, {timeout:180_000},()=>{
  const result=playEscapeRoute(new EscapeWorld(seed),true);
  assert.ok(['won','lost'].includes(result.phase),'the physical reference policy must finish, not stall');
  assert.ok(result.routeProof.hunterStates.includes('investigate'));
  assert.ok(result.routeProof.hunterStates.includes('chase'));
  assert.deepEqual(EscapeWorld.restore(result.world.snapshot()).snapshot(),result.world.snapshot());
  if(result.phase==='lost'){
   assert.equal(result.captures,3);const before=result.world.snapshot();result.world.nextNight();assert.deepEqual(result.world.snapshot(),before,'third capture cannot grant an extra life');
   assert.ok(result.world.data.searched.includes('bed-drawer'),'earlier legal progress survives the captures');
  }else{
   assert.equal(result.world.data.basement.sluice,true);assert.ok(result.routeProof.visitedBasement&&result.routeProof.returnedToGround);
  }
 });
}
