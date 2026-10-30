import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerrain,cell,connect} from '../src/sim/world.mjs';
import {createGame,spawnSquad,assertInvariants} from '../src/sim/state.mjs';
import {command} from '../src/sim/commands.mjs';
import {stepMovement} from '../src/sim/navigation.mjs';
import {resolveFire,damage} from '../src/sim/combat.mjs';
const setup=()=>createGame({map:createTerrain(48,32),squadsPerTeam:0,botTeams:[],combat:false});
async function advance(w,n){const {updateTacticalOrders}=await import('../src/sim/tactical-orders.mjs');for(let i=0;i<n;i++){updateTacticalOrders(w);stepMovement(w);assertInvariants(w);assert(w.metrics.navExpansions<=2048);w.tick++;}}
test('four formations produce distinct connected footprints and arrive with exact slots',async()=>{
 const footprints=[];
 for(const formation of ['line','column','square','spread']){
  const w=setup(),s=spawnSquad(w,'A',3,10),goal=cell(w.map,30,16);
  assert(command(w,'A',{type:'move',squadId:s.id,target:goal,formation}).ok);assert.equal(s.formation,formation);
  assert.equal(new Set(Object.values(s.slots)).size,10);footprints.push(Object.values(s.slots).sort((a,b)=>a-b).join(','));
  await advance(w,1200);assert.equal(s.status,'arrived',formation);assert.equal(s.arrivedCount,10);
 }
 assert.equal(new Set(footprints).size,4);
});
test('formation switch cancels pursuit at living centroid and preserves committed steps',async()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10);command(w,'A',{type:'move',squadId:1,target:cell(w.map,35,16)});stepMovement(w);
 const u=w.units.find(u=>u.moveTo>=0),pending=u.moveTo,generation=s.orderId;
 const x=Math.round(w.units.reduce((n,u)=>n+u.x,0)/10),y=Math.round(w.units.reduce((n,u)=>n+u.y,0)/10);
 assert(command(w,'A',{type:'formation',squadId:1,formation:'square'}).ok);assert.equal(s.goal,cell(w.map,x,y));assert(s.orderId>generation);assert.equal(u.moveTo,pending);
 await advance(w,1000);assert.equal(s.arrivedCount,10);
 const before=s.orderId;assert(!command(w,'A',{type:'formation',squadId:1,formation:'invalid'}).ok);assert.equal(s.orderId,before);
});
test('slots respect target elevation, separating edges, reserved cells and other squads claims',()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10),holder=spawnSquad(w,'A',28,14,1),goal=cell(w.map,30,16);
 w.map.floorLevel[cell(w.map,31,16)]=2;connect(w.map,goal,cell(w.map,31,16));
 w.map.reservation[cell(w.map,29,16)]=holder.unitIds[0];
 command(w,'A',{type:'move',squadId:1,target:goal,formation:'spread'});
 for(const i of Object.values(s.slots)){assert.equal(w.map.floorLevel[i],1);assert.notEqual(i,cell(w.map,29,16));assert.notEqual(i,cell(w.map,28,14));}
});
test('attack accepts visible enemies, follows moving target without new generation, and finishes on death',async()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,2),e=spawnSquad(w,'B',25,10,1);spawnSquad(w,'A',20,10,1);
 assert(command(w,'A',{type:'attack',squadId:s.id,targetUnitId:e.unitIds[0]}).ok);const generation=s.orderId,oldGoal=s.goal;
 command(w,'B',{type:'move',squadId:e.id,target:cell(w.map,27,12)});await advance(w,16);assert.equal(s.orderId,generation);assert.notEqual(s.goal,oldGoal);
 damage(w,w.units[e.unitIds[0]-1],100);await advance(w,1);assert.equal(s.phase,'complete');assert.equal(s.goal,null);
});
test('attack validates visibility and friendly targets atomically',()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,1),enemy=spawnSquad(w,'B',35,10,1);command(w,'A',{type:'move',squadId:s.id,target:cell(w.map,10,10)});const before=JSON.stringify(s);
 for(const targetUnitId of [s.unitIds[0],enemy.unitIds[0],999])assert(!command(w,'A',{type:'attack',squadId:s.id,targetUnitId}).ok);
 assert.equal(JSON.stringify(s),before);
});
test('flank traverses lateral waypoints then moves to a ground target',async()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,2),target=cell(w.map,30,15);
 assert(command(w,'A',{type:'flank',squadId:s.id,target}).ok);assert.equal(s.phase,'flanking');assert.notEqual(s.goal,target);const generation=s.orderId;
 await advance(w,1800);assert.equal(s.order,'move');assert.equal(s.goal,target);assert.equal(s.orderId,generation);assert.equal(s.arrivedCount,2);
});
test('flank enemy followup is canceled by hold and a fresh ground flank never inherits it',async()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,2),e=spawnSquad(w,'B',9,10,1);
 assert(command(w,'A',{type:'flank',squadId:s.id,targetUnitId:e.unitIds[0]}).ok);command(w,'A',{type:'hold',squadId:s.id});await advance(w,30);assert.equal(s.goal,null);assert.equal(s.targetUnitId,null);
 assert(command(w,'A',{type:'flank',squadId:s.id,target:cell(w.map,20,20)}).ok);await advance(w,1800);assert.equal(s.order,'move');assert.equal(s.targetUnitId,null);
});
test('suppression retains staged flank intent and resumes after recovery',async()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,2);assert(command(w,'A',{type:'flank',squadId:1,target:cell(w.map,25,16)}).ok);s.suppressed=true;const goal=s.goal,waypoints=[...s.waypoints];
 await advance(w,30);assert.equal(s.goal,goal);assert.deepEqual(s.waypoints,waypoints);assert.equal(w.metrics.moves,0);
 s.suppressed=false;await advance(w,1600);assert.equal(s.arrivedCount,2);
});
test('focused fire prioritizes designated visible enemy over nearer enemy',()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,1),near=spawnSquad(w,'B',5,10,1),focus=spawnSquad(w,'B',8,10,1);
 assert(command(w,'A',{type:'attack',squadId:s.id,targetSquadId:focus.id}).ok);w.combat=true;w.units[0].nextFireTick=0;resolveFire(w);
 const shot=w.events.find(e=>e.kind==='shot'&&e.unitId===s.unitIds[0]);assert.equal(shot.tx,w.units[focus.unitIds[0]-1].x);assert.equal(w.squads[near.id-1].suppression,0);
});
test('enemy flank becomes an attack under the same command generation',async()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,2),enemy=spawnSquad(w,'B',25,10,1);spawnSquad(w,'A',20,10,1);
 assert(command(w,'A',{type:'flank',squadId:1,targetUnitId:enemy.unitIds[0]}).ok);const generation=s.orderId;
 await advance(w,1600);assert.equal(s.order,'attack');assert.equal(s.orderId,generation);assert.equal(s.targetUnitId,enemy.unitIds[0]);assert.equal(s.phase,'attacking');assert.deepEqual(s.waypoints,[]);
});
test('lost visibility retains last known destination without tracking hidden movement',async()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,1),enemy=spawnSquad(w,'B',25,10,1);spawnSquad(w,'A',20,10,1);
 assert(command(w,'A',{type:'attack',squadId:1,targetSquadId:enemy.id}).ok);const goal=s.goal,u=w.units[enemy.unitIds[0]-1];
 w.map.occupancy[cell(w.map,u.x,u.y)]=0;u.x=45;w.map.occupancy[cell(w.map,u.x,u.y)]=u.id;w.spatialRevision++;
 await advance(w,1);assert.equal(s.goal,goal);assert.equal(s.phase,'searching');await advance(w,1000);assert.equal(s.phase,'target-lost');assert.equal(s.goal,null);
});
test('formation slots cannot cross an unconnected edge boundary near the anchor',()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10),goal=cell(w.map,30,16);
 for(let y=0;y<w.map.height;y++){w.map.edgeMask[cell(w.map,30,y)]|=2;w.map.edgeMask[cell(w.map,31,y)]|=8;}
 assert(command(w,'A',{type:'move',squadId:1,target:goal,formation:'spread'}).ok);
 assert.equal(Object.keys(s.slots).length,10);assert(Object.values(s.slots).every(i=>i%w.map.width<=30));
});
test('a fresh attack can reacquire the same target after a previous search ended',async()=>{
 const w=setup(),s=spawnSquad(w,'A',3,10,1),enemy=spawnSquad(w,'B',8,10,1),u=w.units[enemy.unitIds[0]-1];
 command(w,'A',{type:'attack',squadId:1,targetUnitId:u.id});const generation=s.orderId;
 w.map.occupancy[cell(w.map,u.x,u.y)]=0;u.x=45;w.map.occupancy[cell(w.map,u.x,u.y)]=u.id;w.spatialRevision++;
 await advance(w,1000);assert.equal(s.phase,'target-lost');
 w.map.occupancy[cell(w.map,u.x,u.y)]=0;u.x=8;w.map.occupancy[cell(w.map,u.x,u.y)]=u.id;w.spatialRevision++;
 assert(command(w,'A',{type:'attack',squadId:1,targetUnitId:u.id}).ok);assert(s.orderId>generation);assert.equal(s.phase,'attacking');
});
test('a lone survivor reforms at its own centroid in every formation',()=>{
 for(const formation of ['line','column','square','spread']){const w=setup(),s=spawnSquad(w,'A',3,10,1),here=cell(w.map,3,10);assert(command(w,'A',{type:'formation',squadId:1,formation}).ok);assert.equal(s.slots[s.unitIds[0]],here,formation);}
});
