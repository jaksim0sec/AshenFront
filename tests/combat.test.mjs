import test from 'node:test';import assert from 'node:assert/strict';
import {createTerrain,cell} from '../src/sim/world.mjs';import {createGame,spawnSquad,assertInvariants} from '../src/sim/state.mjs';
import {lineOfSight,coverMultiplier,resolveFire,damage} from '../src/sim/combat.mjs';import {recoverSuppression} from '../src/sim/squads.mjs';import {stepMovement} from '../src/sim/navigation.mjs';import {command} from '../src/sim/commands.mjs';
function duel(){const w=createGame({map:createTerrain(24,16),squadsPerTeam:0,seed:42});spawnSquad(w,'A',3,6,1);spawnSquad(w,'B',8,6,1);return w;}
test('LOS is symmetric, ridges and diagonal opaque corners block, H0 can fire over H1',()=>{
 const w=duel(),[a,b]=w.units,m=w.map;assert(lineOfSight(m,a,b));m.floorLevel[cell(m,5,6)]=2;assert(!lineOfSight(m,a,b));assert(!lineOfSight(m,b,a));m.floorLevel[cell(m,5,6)]=1;m.floorLevel[cell(m,a.x,a.y)]=0;assert(lineOfSight(m,a,b));
 m.blocked[cell(m,4,3)]=1;assert(!lineOfSight(m,{x:3,y:3},{x:5,y:5}));
 for(let x=1;x<10;x++)for(let y=1;y<10;y++)assert.equal(lineOfSight(m,{x,y},{x:6,y:5}),lineOfSight(m,{x:6,y:5},{x,y}));
});
test('directional cover and worn cover use target-to-attacker direction, X ties',()=>{
 const w=duel(),[a,b]=w.units,i=cell(w.map,b.x,b.y);w.map.terrainKind[i]=1;w.map.coverMask[i]=8;
 assert.equal(coverMultiplier(w.map,a,b),.5);assert.equal(coverMultiplier(w.map,{x:10,y:6},b),1);w.map.coverCondition[i]=25;assert.equal(coverMultiplier(w.map,a,b),.75);
 w.map.terrainKind[i]=2;w.map.coverCondition[i]=100;assert.equal(coverMultiplier(w.map,a,b),.75);
});
test('seeded shots, cooldown, HP and final outcome are reproducible',()=>{
 const run=()=>{const w=duel();for(let i=0;i<1000;i++){resolveFire(w);recoverSuppression(w);w.tick++;assertInvariants(w);}return {units:w.units,seed:w.seed,shots:w.metrics.shots};};
 const a=run();assert.deepEqual(a,run());assert(a.shots>0&&a.shots<=68);assert(a.units.some(u=>u.hp===0));
});
test('death during a reserved step releases both cells exactly once',()=>{
 const w=duel(),u=w.units[0];command(w,'A',{type:'move',squadId:1,target:cell(w.map,15,8)});stepMovement(w);assert(u.moveTo>=0);const dest=u.moveTo;
 damage(w,u,100);damage(w,u,100);assert.equal(w.map.reservation[dest],0);assert.equal(w.map.occupancy[cell(w.map,u.x,u.y)],0);assertInvariants(w);
});
test('suppression pauses retained intent, recovers hysteretically and permits HOLD',()=>{
 const w=duel(),s=w.squads[0];command(w,'A',{type:'move',squadId:1,target:cell(w.map,18,7)});s.suppression=70;s.lastThreatTick=w.tick;recoverSuppression(w);assert(s.suppressed);
 for(let i=0;i<35;i++){stepMovement(w);w.tick++;recoverSuppression(w);}assert.equal(w.metrics.moves,0);assert.equal(s.movementBlockedReason,'suppressed');
 for(let i=0;i<160;i++){stepMovement(w);w.tick++;recoverSuppression(w);}assert(!s.suppressed);assert(w.metrics.moves>0);assert.equal(s.order,'move');assert(command(w,'A',{type:'hold',squadId:1}).ok);
});
test('mirrored armies use matching staggered initial cooldowns rather than a team-wide offset',()=>{
 const w=createGame(),a=w.units.filter(u=>u.team==='A'),b=w.units.filter(u=>u.team==='B');for(let i=0;i<a.length;i++)assert.equal(a[i].nextFireTick,b[i].nextFireTick);
});
