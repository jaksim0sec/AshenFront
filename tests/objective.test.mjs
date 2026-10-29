import test from 'node:test';import assert from 'node:assert/strict';import {createTerrain,cell} from '../src/sim/world.mjs';import {createGame,spawnSquad} from '../src/sim/state.mjs';import {initializeObjectives,updateObjectives} from '../src/sim/objectives.mjs';import {createMatch,tick,checksum} from '../src/sim/engine.mjs';
function fixture(){const w=createGame({map:createTerrain(32,24),squadsPerTeam:0});initializeObjectives(w);return w;}
function score(w,n){for(let i=0;i<n;i++){updateObjectives(w);w.tick++;}}
test('45 seconds of objective presence wins, not a touch',()=>{const w=fixture();spawnSquad(w,'A',16,12,1);score(w,895);assert.equal(w.winner,null);score(w,5);assert.equal(w.winner,'A');});
test('contested and empty freeze, changing contender resets; radius is Manhattan',()=>{
 const w=fixture();spawnSquad(w,'A',16,12,1);score(w,100);assert.equal(w.objectives[0].progressTicks,100);
 const s=spawnSquad(w,'B',17,12,1);score(w,100);assert(w.objectives[0].contested);assert.equal(w.objectives[0].progressTicks,100);
 w.units[0].hp=0;score(w,5);assert.equal(w.objectives[0].owner,'B');assert.equal(w.objectives[0].progressTicks,5);
 w.units[1].x=21;score(w,10);assert.equal(w.objectives[0].progressTicks,5);assert.equal(s.team,'B');
});
test('eight-minute fallback permits draw and compares control score',()=>{const w=fixture();w.tick=9599;updateObjectives(w);assert.equal(w.winner,'draw');const v=fixture();v.tick=9599;v.scores.A=5;updateObjectives(v);assert.equal(v.winner,'A');});
test('engine reproducibility includes ordered commands and complete match',()=>{
 function run(){const w=createMatch({seed:991,botTeams:['A','B']});while(!w.winner)tick(w);return checksum(w);}
 assert.equal(run(),run());
});
test('three-sector timeout uses accumulated score instead of current ownership',()=>{
 const w=createMatch({map:createTerrain(128,96),squadsPerTeam:0,sectors:3});w.objectives[0].owner='A';w.objectives[1].owner='A';w.objectives[2].owner='B';w.scores.B=1000;w.tick=23999;updateObjectives(w);assert.equal(w.winner,'B');
});
