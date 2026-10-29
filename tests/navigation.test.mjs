import test from 'node:test';import assert from 'node:assert/strict';
import {createTerrain,createMap,cell,canStep} from '../src/sim/world.mjs';
import {createGame,spawnSquad,assertInvariants} from '../src/sim/state.mjs';
import {command} from '../src/sim/commands.mjs';
import {stepMovement} from '../src/sim/navigation.mjs';
function advance(w,n){for(let i=0;i<n;i++){stepMovement(w);assertInvariants(w);assert(w.metrics.navExpansions<=2048);w.tick++;}}

test('ten soldiers cross authored ramps and reach the retained region',()=>{
 const w=createGame({squadsPerTeam:0});const s=spawnSquad(w,'A',16,21);const goal=cell(w.map,25,24);
 assert(command(w,'A',{type:'move',squadId:s.id,target:goal}).ok);advance(w,600);
 assert(s.unitIds.every(id=>w.navigation.field(s.goal,s.radius).distance[cell(w.map,w.units[id-1].x,w.units[id-1].y)]===0));
});
test('atomic override and HOLD finish already reserved steps',()=>{
 const w=createGame({squadsPerTeam:0,map:createTerrain(24,16)}),s=spawnSquad(w,'A',2,3);
 command(w,'A',{type:'move',squadId:s.id,target:200});advance(w,2);const u=w.units.find(u=>u.moveTo>=0),dest=u.moveTo;
 assert(u); assert(!command(w,'B',{type:'hold',squadId:s.id}).ok);
 const prior=s.goal;assert(!command(w,'A',{type:'move',squadId:s.id,target:-1}).ok);assert.equal(s.goal,prior);
 command(w,'A',{type:'hold',squadId:s.id});assert.equal(u.moveTo,dest);advance(w,12);assert.equal(cell(w.map,u.x,u.y),dest);assert.equal(u.moveTo,-1);
});
test('friendly squads pass opposite directions through two-wide passage without starvation',()=>{
 const m=createTerrain(36,20);for(let y=0;y<20;y++)for(let x=14;x<22;x++)if(y!==9&&y!==10)m.blocked[cell(m,x,y)]=1;
 const w=createGame({map:m,squadsPerTeam:0}),a=spawnSquad(w,'A',4,7),b=spawnSquad(w,'A',28,7);
 command(w,'A',{type:'move',squadId:a.id,target:cell(m,29,9)});command(w,'A',{type:'move',squadId:b.id,target:cell(m,5,9)});
 advance(w,1600);for(const s of [a,b])assert(s.reached,`squad ${s.id}: ${s.movementBlockedReason}`);
});
test('opponents never double reserve and static no-route is finite',()=>{
 const m=createTerrain(30,16),w=createGame({map:m,squadsPerTeam:0});const a=spawnSquad(w,'A',2,3),b=spawnSquad(w,'B',22,3);
 command(w,'A',{type:'move',squadId:a.id,target:cell(m,15,6)});command(w,'B',{type:'move',squadId:b.id,target:cell(m,15,6)});advance(w,300);
 const isolated=createTerrain(24,16);for(let y=0;y<16;y++)isolated.blocked[cell(isolated,12,y)]=1;
 const v=createGame({map:isolated,squadsPerTeam:0}),s=spawnSquad(v,'A',2,3);command(v,'A',{type:'move',squadId:s.id,target:cell(isolated,20,6)});advance(v,100);
 assert.equal(s.movementBlockedReason,'no_route');assert.equal(v.navigation.pending,0);
});
