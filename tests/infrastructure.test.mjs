import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,spawnSquad,assertInvariants} from '../src/sim/state.mjs';import {createTerrain,cell} from '../src/sim/world.mjs';import {command} from '../src/sim/commands.mjs';import {stepMovement} from '../src/sim/navigation.mjs';
function run(w,n){for(let i=0;i<n;i++){stepMovement(w);assertInvariants(w);assert(w.metrics.navExpansions<=2048);w.tick++;}}
test('INF-01 precise slots, all-member completion and stable repeated order',()=>{
 const w=createGame({map:createTerrain(40,30),squadsPerTeam:0}),s=spawnSquad(w,'A',3,10);
 const result=command(w,'A',{type:'move',squadId:s.id,target:cell(w.map,25,15)});assert(result.ok);assert.equal(s.placement,'formation');assert.equal(new Set(Object.values(s.slots)).size,10);
 const id=s.orderId;command(w,'A',{type:'move',squadId:s.id,target:s.goal});assert.equal(s.orderId,id);run(w,900);
 assert.equal(s.status,'arrived');assert.equal(s.arrivedCount,10);for(const u of w.units)assert.equal(cell(w.map,u.x,u.y),s.slots[u.id]);
});
test('INF-01 retarget keeps step but invalidates old slots; HOLD and suppression do not displace',()=>{
 const w=createGame({map:createTerrain(40,30),squadsPerTeam:0}),s=spawnSquad(w,'A',3,10);
 command(w,'A',{type:'move',squadId:1,target:500});run(w,4);const u=w.units.find(u=>u.moveTo>=0),pending=u.moveTo,id=s.orderId;
 command(w,'A',{type:'move',squadId:1,target:700});assert(s.orderId>id);assert.equal(u.moveTo,pending);run(w,1000);assert.equal(s.status,'arrived');assert.equal(s.goal,700);
 command(w,'A',{type:'hold',squadId:1});run(w,10);const cells=w.units.map(u=>cell(w.map,u.x,u.y));run(w,100);assert.deepEqual(w.units.map(u=>cell(w.map,u.x,u.y)),cells);
});
test('INF-01 edge formations have bounded slots and truthful insufficient room',()=>{
 const m=createTerrain(20,20),w=createGame({map:m,squadsPerTeam:0}),s=spawnSquad(w,'A',3,8);for(let y=0;y<5;y++)for(let x=0;x<5;x++)m.blocked[cell(m,x,y)]=1;m.blocked[0]=0;
 command(w,'A',{type:'move',squadId:1,target:0});run(w,100);assert(['partial','unreachable','blocked'].includes(s.status));assert(!s.reached);assert(s.reason);
});
test('INF-01 twenty seeds: latest command arrives with all ten distinct slots',()=>{
 for(let seed=1;seed<=20;seed++){const w=createGame({seed,map:createTerrain(40,30),squadsPerTeam:0});const s=spawnSquad(w,'A',3,10);for(const target of [420,600,820]){command(w,'A',{type:'move',squadId:1,target});run(w,15);}run(w,1000);assert.equal(s.goal,820);assert.equal(s.arrivedCount,10,`seed ${seed}: ${s.reason}`);}
});
test('INF-01 four distinct anchors, no false 80-percent success',()=>{
 const w=createGame({map:createTerrain(60,40),squadsPerTeam:0});for(let n=0;n<4;n++){const s=spawnSquad(w,'A',3,3+n*8);command(w,'A',{type:'move',squadId:s.id,target:cell(w.map,45,5+n*8)});}run(w,1800);for(const s of w.squads){assert.equal(s.arrivedCount,10);assert.equal(s.status,'arrived');}assert(w.navigation.fields.size<=96);
});
test('INF-01 holders and suppressed allies never yield; traffic routes around them',()=>{
 const w=createGame({map:createTerrain(40,30),squadsPerTeam:0}),s=spawnSquad(w,'A',3,10),holder=spawnSquad(w,'A',15,9),suppressed=spawnSquad(w,'A',18,9);suppressed.suppressed=true;
 const positions=w.units.slice(10).map(u=>[u.x,u.y]);command(w,'A',{type:'move',squadId:s.id,target:cell(w.map,30,14)});run(w,1400);assert.deepEqual(w.units.slice(10).map(u=>[u.x,u.y]),positions);assert.equal(s.arrivedCount,10);
});
test('INF-02 visual revision does not flush navigation; topology revision does',()=>{
 const w=createGame({map:createTerrain(20,20),squadsPerTeam:0}),f=w.navigation.field(250,3);w.map.revision++;assert.equal(w.navigation.field(250,3),f);w.map.topologyRevision=1;assert.notEqual(w.navigation.field(250,3),f);
});
test('INF-01 exact squads traverse H1-H0-H1 and H1-H2-H1 at authored exits',()=>{
 const w=createGame({squadsPerTeam:0}),s=spawnSquad(w,'A',6,20);for(const [x,y] of [[17,24],[25,24],[30,7],[32,24]]){command(w,'A',{type:'move',squadId:1,target:cell(w.map,x,y)});run(w,1800);assert.equal(s.status,'arrived',`${x},${y}: ${s.reason} ${s.arrivedCount}/10`);}
});
test('INF-01 four allied squads cross a shared four-wide choke with distinct anchors',()=>{
 const m=createTerrain(60,40);for(let y=0;y<40;y++)for(let x=25;x<35;x++)if(y<18||y>21)m.blocked[cell(m,x,y)]=1;
 const w=createGame({map:m,squadsPerTeam:0});for(const [x,y,gx,gy] of [[4,12,50,14],[4,24,50,26],[50,12,5,14],[50,24,5,26]]){const s=spawnSquad(w,'A',x,y);command(w,'A',{type:'move',squadId:s.id,target:cell(m,gx,gy)});}run(w,2400);for(const s of w.squads)assert.equal(s.arrivedCount,10,`squad ${s.id}: ${s.reason}`);
});
test('INF-01 retarget during real fire retains latest generation and collision invariants',async()=>{
 const {tick,createMatch}=await import('../src/sim/engine.mjs');
 for(let seed=1;seed<=20;seed++){const w=createMatch({seed,botTeams:['B']});let last;
  for(let n=0;n<900&&!w.winner;n++){if([0,160,300].includes(n)){last=cell(w.map,n===300?22:28,24);command(w,'A',{type:'move',squadId:1,target:last});}tick(w);assert.equal(w.squads[0].goal,last);if(n%50===0)assertInvariants(w);}
 }
});
test('INF-01 destination region cannot seed across a separating wall and report idle partial forever',()=>{
 const m=createTerrain(40,30);for(let y=0;y<25;y++)m.blocked[cell(m,20,y)]=1;const w=createGame({map:m,squadsPerTeam:0}),s=spawnSquad(w,'A',3,12);command(w,'A',{type:'move',squadId:1,target:cell(m,22,15)});run(w,3000);assert.equal(s.arrivedCount,10,`${s.status}: ${s.reason}`);
});
test('INF-01 later rally never displaces a settled precise formation',()=>{
 const w=createGame({map:createTerrain(40,30),squadsPerTeam:0}),s=spawnSquad(w,'A',3,10),target=cell(w.map,25,15);command(w,'A',{type:'move',squadId:1,target});run(w,900);const positions=w.units.map(u=>[u.x,u.y]);spawnSquad(w,'A',3,20);command(w,'A',{type:'rally',squadId:2,target,radius:3});run(w,1000);assert.deepEqual(w.units.slice(0,10).map(u=>[u.x,u.y]),positions);assert.equal(s.arrivedCount,10);
});
test('INF-01 changing area radius creates a new order generation',()=>{
 const w=createGame(),s=w.squads[0];command(w,'A',{type:'rally',squadId:1,target:1500,radius:4});const id=s.orderId;command(w,'A',{type:'rally',squadId:1,target:1500,radius:2});assert(s.orderId>id);assert.equal(s.radius,2);
});
