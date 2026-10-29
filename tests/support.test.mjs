import test from 'node:test';import assert from 'node:assert/strict';import {createMatch,tick,FixedClock,checksum} from '../src/sim/engine.mjs';import {createTerrain,createMap,cell} from '../src/sim/world.mjs';import {spawnSquad,assertInvariants} from '../src/sim/state.mjs';import {command} from '../src/sim/commands.mjs';

test('support validates visibility, use count, cooldown and processes a radius event once',()=>{
 const w=createMatch({map:createTerrain(40,30),squadsPerTeam:0,botTeams:[]});spawnSquad(w,'A',8,12,1);spawnSquad(w,'B',13,12,2);const target=cell(w.map,13,12),hp=w.units[1].hp;
 w.map.coverCondition[target]=100;w.map.coverMask[target]=8;w.map.terrainKind[target]=1;const heights=w.map.floorLevel.slice(),ramps=w.map.transitionMask.slice();
 assert(!command(w,'A',{type:'support',target:cell(w.map,39,29)}).ok);assert.equal(w.support.A.uses,2);
 assert(command(w,'A',{type:'support',target}).ok);assert.equal(w.support.A.uses,1);assert.equal(w.units[1].hp,hp-15);assert.equal(w.squads[1].suppression,15);assert.equal(w.map.coverCondition[target],90);
 assert(!command(w,'A',{type:'support',target}).ok);assert.equal(w.units[1].hp,hp-15);
 w.combat=false;tick(w);assert.equal(w.units[1].hp,hp-15);assert.deepEqual(w.map.floorLevel,heights);assert.deepEqual(w.map.transitionMask,ramps);
 w.tick=1200;assert(command(w,'A',{type:'support',target}).ok);w.tick=2400;assert(!command(w,'A',{type:'support',target}).ok);assertInvariants(w);
});
test('one parameterized objective engine handles three-sector victory and 20-minute cap',()=>{
 const w=createMatch({map:createMap(128,96),squadsPerTeam:9,sectors:3,botTeams:[]});assert.equal(w.units.length,180);assert.equal(w.objectives.length,3);assert.equal(w.limitTicks,24000);assertInvariants(w);
 const v=createMatch({map:createTerrain(128,96),squadsPerTeam:0,sectors:3,botTeams:[],combat:false});for(const o of v.objectives.slice(0,2))spawnSquad(v,'A',o.center%128,Math.floor(o.center/128),1);
 for(let i=0;i<1499;i++)tick(v);assert.equal(v.winner,null);tick(v);assert.equal(v.winner,'A');
 const big=createMatch({map:createMap(256,192),squadsPerTeam:18,sectors:3,botTeams:[]});assert.equal(big.units.length,360);assertInvariants(big);
});
test('render rates 15/30/60 FPS produce identical ordered-command replay and no skipped ticks',()=>{
 const run=fps=>{const w=createMatch({seed:123,botTeams:['B']}),clock=new FixedClock();for(let i=0;i<fps*45;i++)clock.advance(1000/fps,()=>{tick(w,w.tick===0?[{team:'A',type:'rally',squadId:1,target:w.objectives[0].center,radius:4}]:[]);});assert.equal(w.tick,900);return checksum(w);};
 assert.equal(run(15),run(30));assert.equal(run(30),run(60));const c=new FixedClock();let n=0;c.advance(1000,()=>n++);assert.equal(n,3);assert(c.backlog>=850);while(c.backlog>=50)c.advance(0,()=>n++);assert.equal(n,20);
});
test('replay checksum covers mutable cover, pending commands and multi-sector hold state',()=>{
 const w=createMatch(),before=checksum(w);w.map.coverCondition[0]--;assert.notEqual(checksum(w),before);
 const a=checksum(w);w.queue.push({team:'A',type:'hold',squadId:1});assert.notEqual(checksum(w),a);
 const b=checksum(w);w.teamHold.A++;assert.notEqual(checksum(w),b);
});
