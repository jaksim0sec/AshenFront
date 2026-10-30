import test from 'node:test';
import assert from 'node:assert/strict';
import {createAshenMatch,autoDeployPlayer,RIFLE_STATS,RIFLE_MOVEMENT,preferredRangeForSoldier} from '../src/fw/ashen-setup.mjs';

test('rifle tuning preserves nine-cell max range with lower health and slower movement',()=>{
 assert.equal(RIFLE_STATS.maxHealth,85);
 assert.equal(RIFLE_MOVEMENT.stepTime,.42);
 assert.equal(RIFLE_STATS.range,9);
 assert.equal(RIFLE_STATS.damage,18);
});

test('personal firing comfort distances are 5, 6 or 7, fixed per unit across both armies',()=>{
 const seed=1977;
 const {board,match}=createAshenMatch({seed,count:40});
 assert(autoDeployPlayer(match).complete);
 assert(match.start());
 assert.equal(board.units.length,80);
 const totals=new Map([[5,0],[6,0],[7,0]]);
 for(const u of board.units){
  assert.equal(u.health.max,85);
  assert.equal(u.health.current,85);
  assert.equal(u.movement.stepTime,.42);
  assert.equal(u.combat.range,9);
  const distance=u.combat.preferredRange;
  assert(totals.has(distance),'unsupported personal distance: '+distance);
  assert.equal(distance,preferredRangeForSoldier(seed,u.id));
  totals.set(distance,totals.get(distance)+1);
 }
 for(const count of totals.values())assert(count>=8,'distance profiles must be mixed across formations');
 const repeat=createAshenMatch({seed,count:40});
 assert(autoDeployPlayer(repeat.match).complete);
 assert(repeat.match.start());
 assert.deepEqual(repeat.board.units.map(u=>u.combat.preferredRange),board.units.map(u=>u.combat.preferredRange));
});

test('350 per side use the same individual stats without changing the 700-unit cap',()=>{
 const {board,match}=createAshenMatch({seed:42,count:350});
 assert(autoDeployPlayer(match).complete);
 assert(match.start());
 assert.equal(board.units.length,700);
 assert(board.units.every(u=>u.health.max===85 && u.movement.stepTime===.42));
 assert(board.units.every(u=>u.combat.range===9 && [5,6,7].includes(u.combat.preferredRange)));
});
