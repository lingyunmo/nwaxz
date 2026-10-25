import test from 'node:test';
import assert from 'node:assert/strict';
import { playCoopRoute } from './coop-player.mjs';
import { EscapeWorld } from '../src/escape/world.ts';

test('two-person authority completes the full underground chain and a surviving teammate escapes', { timeout: 120_000 }, () => {
  const result = playCoopRoute({ count: 2, seed: 202 });
  assert.equal(result.phase, 'won');
  assert.ok(result.elapsed > 60 && result.elapsed < 900);
  assert.equal(result.hiding[0].wardrobe, 'bed-hide', 'the standby teammate physically hid by interaction');
  assert.ok(result.runs.some(run => run.proof.visitedBasement && run.proof.returnedToGround));
  assert.ok(result.runs.some(run => run.proof.abilityNotices.includes('teleport-warning')));
  assert.ok(result.runs.some(run => run.proof.hunterStates.includes('chase')));
  assert.ok(result.roster.some(player => player.status === 'eliminated' && player.lives === 0));
  assert.ok(result.roster.some(player => player.status === 'escaped' && player.lives <= 2));
  assert.ok(result.roster.every(player => player.lives >= 0 && player.lives <= 2));
  assert.deepEqual([...result.world.inventory].sort(), ['brass', 'cellar', 'cutters', 'fuse', 'handwheel', 'relay']);
  assert.deepEqual(result.world.basement, { power: true, sluice: true });
  assert.equal(result.world.drained, true);
  assert.deepEqual(EscapeWorld.restore(result.world, {playerId:result.viewPlayerId,targetId:result.targetPlayerId}).snapshot(), result.world);
  for (const run of result.runs) for (const respawn of run.respawns) {
    assert.equal(respawn.livesBefore, respawn.livesAfter, 'acknowledging respawn never grants another life');
    assert.deepEqual(respawn.before, respawn.after, 'respawning does not reset shared progress or the hunter');
  }
});

test('three-person authority retains one life each through a genuine terminal route', { timeout: 120_000 }, () => {
  const result = playCoopRoute({ count: 3, seed: 202 });
  assert.ok(['won', 'lost'].includes(result.phase));
  assert.ok(result.roster.every(player => player.lives >= 0 && player.lives <= 1));
  assert.ok(result.runs.every(run => run.respawns.length === 0));
  assert.ok(result.runs.some(run => run.proof.visitedBasement));
  if (result.phase === 'lost') assert.ok(result.roster.every(player => player.status === 'eliminated' && player.lives === 0));
  else assert.ok(result.roster.every(player => ['escaped', 'eliminated'].includes(player.status)));
  assert.deepEqual(EscapeWorld.restore(result.world, {playerId:result.viewPlayerId,targetId:result.targetPlayerId}).snapshot(), result.world);
});
