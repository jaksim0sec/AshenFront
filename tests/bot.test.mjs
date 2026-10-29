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
