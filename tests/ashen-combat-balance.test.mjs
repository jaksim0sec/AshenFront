import test from 'node:test';
import assert from 'node:assert/strict';
import {createAshenMatch,autoDeployPlayer,RIFLE_STATS,RIFLE_MOVEMENT,preferredRangeForSoldier} from '../src/fw/ashen-setup.mjs';
import {inAttackRange} from '../src/fw/combat.mjs';

test('rifle tuning reduces movement speed and caps individual firing range at seven cells',()=>{
 assert.equal(RIFLE_STATS.maxHealth,32);
 assert.equal(RIFLE_MOVEMENT.stepTime,.70);
 assert.equal(RIFLE_STATS.range,7);
 assert.equal(RIFLE_STATS.damage,18);
});

test('individual maximum firing ranges are 5, 6 or 7, deterministic across both armies',()=>{
 const seed=1977;
 const {board,match}=createAshenMatch({seed,count:40});
 assert(autoDeployPlayer(match).complete);
 assert(match.start());
 assert.equal(board.units.length,80);
 const totals=new Map([[5,0],[6,0],[7,0]]);
 for(const u of board.units){
  assert.equal(u.health.max,32);
  assert.equal(u.health.current,32);
  assert.equal(u.movement.stepTime,.70);
  const distance=u.combat.range;
  assert(totals.has(distance),'unsupported maximum firing range: '+distance);
  assert.equal(distance,preferredRangeForSoldier(seed,u.id));
  assert.equal(u.combat.preferredRange,3);
  const target={visualX:u.visualX+distance,visualY:u.visualY};
  assert(inAttackRange(u,target),'target exactly at personal maximum must be in range');
  target.visualX+=.01;
  assert(!inAttackRange(u,target),'target beyond personal maximum must be out of range');
  totals.set(distance,totals.get(distance)+1);
 }
 for(const count of totals.values())assert(count>=8,'distance profiles must be mixed across formations');
 const repeat=createAshenMatch({seed,count:40});
 assert(autoDeployPlayer(repeat.match).complete);
 assert(repeat.match.start());
 assert.deepEqual(repeat.board.units.map(u=>u.combat.range),board.units.map(u=>u.combat.range));
});

test('350 per side use the same individual stats without changing the 700-unit cap',()=>{
 const {board,match}=createAshenMatch({seed:42,count:350});
 assert(autoDeployPlayer(match).complete);
 assert(match.start());
 assert.equal(board.units.length,700);
 assert(board.units.every(u=>u.health.max===32 && u.movement.stepTime===.70));
 assert(board.units.every(u=>[5,6,7].includes(u.combat.range) && u.combat.preferredRange===3));
});
