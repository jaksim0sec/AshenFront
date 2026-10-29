import test from 'node:test';import assert from 'node:assert/strict';import {createMatch,tick,checksum} from '../src/sim/engine.mjs';import {assertInvariants} from '../src/sim/state.mjs';
test('20 seeded bot matches move, compete, finish, and preserve invariants',()=>{
 const results=[];
 for(let seed=1;seed<=20;seed++){
  const w=createMatch({seed,botTeams:['A','B']});while(!w.winner){tick(w);if(w.tick%100===0)assertInvariants(w);}
  assert(w.metrics.movingTicks.A>0&&w.metrics.movingTicks.B>0);assert(w.metrics.shots>0);assert(w.tick<=9600);assert(w.scores.A+w.scores.B>0);
  results.push({seed,winner:w.winner,ticks:w.tick,moving:w.metrics.movingTicks,blocked:w.metrics.blocked,score:w.scores,checksum:checksum(w)});
 }
 assert(results.some(r=>r.ticks<9600),'all games timed out');console.log('BOT_TRIALS '+JSON.stringify(results));
});
test('swapping team labels swaps the seeded outcome without changing side behavior',()=>{
 for(let seed=1;seed<=20;seed++){
  const a=createMatch({seed,botTeams:['A','B']}),b=createMatch({seed,botTeams:['A','B']});
  for(const u of b.units)u.team=u.team==='A'?'B':'A';for(const s of b.squads)s.team=s.team==='A'?'B':'A';
  while(!a.winner)tick(a);while(!b.winner)tick(b);
  assert.equal(a.tick,b.tick);assert.equal(a.winner==='A'?'B':a.winner==='B'?'A':'draw',b.winner);assert.equal(a.scores.A,b.scores.B);
 }
});
test('bots fill the objective with 2 or 4 allied squads when opponents are gone',async()=>{
 const {damage}=await import('../src/sim/combat.mjs');
 for(const n of [2,4]){const w=createMatch({botTeams:['A'],combat:false,squadsPerTeam:n});for(const u of w.units)if(u.team==='B')damage(w,u,100);w.holdTicks=100000;w.limitTicks=100000;
  for(let i=0;i<3000;i++)tick(w);
  for(const s of w.squads.filter(s=>s.team==='A')){assert(s.reached,`squad ${s.id} did not arrive`);assert(s.unitIds.every(id=>{const u=w.units[id-1];return w.navigation.field(s.goal,s.radius).distance[u.y*w.map.width+u.x]===0;}));}
 }
});
