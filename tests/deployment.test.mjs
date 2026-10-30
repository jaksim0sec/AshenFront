import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, tick} from '../src/sim/engine.mjs';
import {assertInvariants} from '../src/sim/state.mjs';
import {cell,createTerrain,connect} from '../src/sim/world.mjs';

const api=await import('../src/sim/deployment.mjs').catch(()=>null);
function setup(flat=false){assert(api,'deployment API exists');const w=createMatch({scenario:'war',...(flat?{map:createTerrain(64,48)}:{}),botTeams:[],combat:false});return {w,p:api.createDeployment(w)};}
const snapshot=(w,p)=>JSON.stringify({units:w.units,squads:w.squads,occupancy:w.map.occupancy,reservation:w.map.reservation,revision:w.spatialRevision,p});

test('preparation reserves existing actors without ghosts or changing enemy actors',()=>{
 assert(api,'deployment API exists');const w=createMatch({scenario:'war'}),units=w.units.slice(),enemy=structuredClone(w.units.filter(u=>u.team==='B'));
 w.units[0].rank='captain';w.units[0].character={skin:'original'};
 const p=api.createDeployment(w);
 assert.equal(p.phase,'preparation');assert.equal(p.remaining,40);assert.equal(w.units.length,80);assert.equal(w.tick,0);assert.equal(w.winner,null);
 assert.equal(w.units.filter(u=>u.team==='A'&&u.hp>0).length,0);assert.equal(w.units.filter(u=>u.team==='B'&&u.hp>0).length,40);
 assert.deepEqual(w.units.filter(u=>u.team==='B'),enemy);assert(w.units.every((u,n)=>u===units[n]));assert.equal(w.units[0].rank,'captain');assert.deepEqual(w.units[0].character,{skin:'original'});assertInvariants(w);
});

test('each supported formation deploys ten original actors and keeps occupancy legal',()=>{
 for(const formation of ['line','column','square','spread']){
  const {w,p}=setup(true),ids=w.squads[0].unitIds.slice();const result=api.deployNext(w,p,{x:10,y:12},formation);
  assert.deepEqual({ok:result.ok,squadId:result.squadId,placed:result.placed},{ok:true,squadId:1,placed:10});assert.equal(p.remaining,30);assert.equal(p.deployed,10);
  assert.deepEqual(w.squads[0].unitIds,ids);assert(w.units.slice(0,10).every(u=>u.hp===100&&u.deployed&&u.x<32));assertInvariants(w);
 }
});

test('invalid territory, blocked footprint, overlap, reservation and map edge fail atomically',()=>{
 const {w,p}=setup(true);
 for(const target of [{x:32,y:12},{x:31,y:12},{x:5,y:0},{x:-1,y:8},NaN]){const before=snapshot(w,p);assert.equal(api.deployNext(w,p,target,'line').ok,false);assert.equal(snapshot(w,p),before);}
 w.map.blocked[cell(w.map,11,12)]=1;let before=snapshot(w,p);assert.equal(api.deployNext(w,p,{x:10,y:12},'line').ok,false);assert.equal(snapshot(w,p),before);w.map.blocked[cell(w.map,11,12)]=0;
 w.map.reservation[cell(w.map,11,12)]=41;before=snapshot(w,p);assert.equal(api.deployNext(w,p,{x:10,y:12},'line').ok,false);assert.equal(snapshot(w,p),before);w.map.reservation.fill(0);
 assert(api.deployNext(w,p,{x:10,y:12},'line').ok);before=snapshot(w,p);assert.equal(api.deployNext(w,p,{x:10,y:12},'line').ok,false);assert.equal(snapshot(w,p),before);assertInvariants(w);
});

test('deployment cannot cross disconnected elevations or sealed terrain edges',()=>{
 const {w,p}=setup(true),a=cell(w.map,10,12);w.map.floorLevel[a]=2;
 let before=snapshot(w,p);assert.equal(api.deployNext(w,p,a,'line').ok,false);assert.equal(snapshot(w,p),before);
 w.map.floorLevel[a]=1;w.map.edgeMask[a]=15;before=snapshot(w,p);assert.equal(api.deployNext(w,p,a,'line').ok,false);assert.equal(snapshot(w,p),before);
 w.map.edgeMask[a]=0;w.map.floorLevel[a]=0;connect(w.map,a,a+1);assert(api.deployNext(w,p,a,'line').ok);assertInvariants(w);
});

test('auto deployment fills reserves without moving manually placed squads or exceeding 40',()=>{
 const {w,p}=setup();assert(api.deployNext(w,p,{x:6,y:18},'line').ok);const manual=structuredClone(w.units.slice(0,10));
 const result=api.autoDeploy(w,p);assert.equal(result.ok,true);assert.equal(result.placed,30);assert.equal(p.remaining,0);assert.equal(w.units.filter(u=>u.hp>0).length,80);assert.deepEqual(w.units.slice(0,10),manual);assertInvariants(w);
 const before=snapshot(w,p);assert.equal(api.deployNext(w,p,{x:10,y:10},'line').ok,false);assert.equal(snapshot(w,p),before);assert.equal(api.autoDeploy(w,p).placed,0);
});

test('begin battle restores reserves before allowing authoritative simulation',()=>{
 const {w,p}=setup();const result=api.beginBattle(w,p);assert.equal(result.ok,true);assert.equal(p.phase,'battle');assert.equal(p.remaining,0);assert.equal(w.units.filter(u=>u.hp>0).length,80);assertInvariants(w);
 tick(w);assert.equal(w.tick,1);assert.equal(w.winner,null);const before=snapshot(w,p);assert.equal(api.deployNext(w,p,cell(w.map,10,10),'line').ok,false);assert.equal(snapshot(w,p),before);
});
