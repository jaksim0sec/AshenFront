import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,tick,checksum} from '../src/sim/engine.mjs';
import {runBots,botController} from '../src/sim/bot.mjs';
import {createTerrain,cell,connect} from '../src/sim/world.mjs';
import {spawnSquad,assertInvariants} from '../src/sim/state.mjs';
import {damage} from '../src/sim/combat.mjs';
import {command} from '../src/sim/commands.mjs';

test('war AI assigns stable specialist roles and replaces a lost HQ guard',()=>{
 const w=createMatch({scenario:'war',squadsPerTeam:5,botTeams:['A'],combat:false});
 for(let n=0;n<80;n++)tick(w);
 const allies=w.squads.filter(s=>s.team==='A');
 assert.deepEqual(new Set(allies.map(s=>s.botRole)),new Set(['guard','front','breach','mobile','support']));
 const roles=allies.map(s=>s.botRole);for(let n=0;n<80;n++)tick(w);
 assert.deepEqual(allies.map(s=>s.botRole),roles);
 for(const id of allies[0].unitIds)damage(w,w.units[id-1],100);
 for(let n=0;n<40;n++)tick(w);
 assert.equal(allies.filter(s=>s.botRole==='guard'&&s.unitIds.some(id=>w.units[id-1].hp>0)).length,1);
});

test('hidden enemy position and health do not change bot orders',()=>{
 const a=createMatch({scenario:'war',botTeams:['A'],combat:false});
 const b=createMatch({scenario:'war',botTeams:['A'],combat:false});
 for(const u of b.units.filter(u=>u.team==='B')){b.map.occupancy[cell(b.map,u.x,u.y)]=0;u.x-=5;u.hp=20;b.map.occupancy[cell(b.map,u.x,u.y)]=u.id;}b.spatialRevision++;
 for(let n=0;n<120;n++){tick(a);tick(b);assert.deepEqual(a.commandLog,b.commandLog);}
});

test('war bots progress through real ramp topology and capture an undefended HQ',()=>{
 const map=createTerrain(64,48);for(let y=0;y<48;y++)for(let x=31;x<64;x++)map.floorLevel[cell(map,x,y)]=0;
 connect(map,cell(map,30,8),cell(map,31,8));
 const w=createMatch({map,scenario:'war',squadsPerTeam:0,botTeams:['A'],combat:false});
 spawnSquad(w,'A',6,22,3);spawnSquad(w,'A',7,15,3);spawnSquad(w,'B',57,42,1);
 for(let n=0;n<5000&&!w.winner;n++){tick(w);if(n%100===0)assertInvariants(w);assert(w.metrics.navExpansions<=2048);}
 assert.equal(w.winner,'A');assertInvariants(w);
});

test('suppressed bots issue a bounded recovery order and resume the offensive',()=>{
 const w=createMatch({scenario:'war',botTeams:['A'],combat:false});
 for(let n=0;n<100;n++)tick(w);
 const s=w.squads[2];s.suppression=90;s.suppressed=true;s.lastThreatTick=w.tick;
 for(let n=0;n<100;n++)tick(w);
 assert(w.commandLog.some(c=>c.squadId===s.id&&c.type==='withdraw'));
 assert(w.commandLog.filter(c=>c.squadId===s.id&&c.type==='withdraw').length<=2);
 for(let n=0;n<250;n++)tick(w);
 assert(!s.suppressed);assert.equal(s.order,'move');
});

test('war AI is deterministic, queues bounded work and does not repeat stationary guard commands',()=>{
 const a=createMatch({scenario:'war',botTeams:['A','B'],combat:false});
 const b=createMatch({scenario:'war',botTeams:['A','B'],combat:false});
 for(let n=0;n<500;n++){tick(a);tick(b);assert(a.queue.filter(c=>c.type!=='support').length<=4);}
 assert.equal(checksum(a),checksum(b));
 assert(a.commandLog.filter(c=>c.squadId===1).length<=2);
});

test('bots explicitly attack visible immediate enemies through the command queue',()=>{
 const w=createMatch({scenario:'war',map:createTerrain(64,48),squadsPerTeam:0,botTeams:['A'],combat:false});
 spawnSquad(w,'A',6,23,1);const fighter=spawnSquad(w,'A',22,12,2);const enemy=spawnSquad(w,'B',28,12,2);
 runBots(w);
 assert(w.queue.some(c=>c.type==='attack'&&c.squadId===fighter.id&&enemy.unitIds.includes(c.targetUnitId)));
 const pending=w.queue.length;runBots(w);assert.equal(w.queue.length,pending);
});

test('terrain observer excludes disconnected islands and rebuilds after a passage opens',()=>{
 const map=createTerrain(64,48),w=createMatch({scenario:'war',map,squadsPerTeam:0,botTeams:['A'],combat:false});
 for(let y=0;y<48;y++)map.blocked[cell(map,30,y)]=1;
 spawnSquad(w,'A',6,22,1);spawnSquad(w,'B',57,22,1);
 const observer=botController(w,'A').observer,start=cell(map,6,22),end=cell(map,57,22);
 assert.equal(observer.travel(start,end),Infinity);assert.deepEqual(observer.route(start,end),[]);
 map.blocked[cell(map,30,6)]=0;map.topologyRevision++;
 assert(Number.isFinite(observer.travel(start,end)));
 assert(observer.route(start,end).every(i=>!map.blocked[i]));
});

test('shared observation remains the only source of enemy data between refreshes',()=>{
 const w=createMatch({scenario:'war',botTeams:['A'],combat:false});runBots(w);
 const controller=botController(w,'A');assert.equal(controller.snapshot.enemies.length,0);
 // Any fresh hidden-position/health read now fails, including accidental reads
 // introduced inside command selection or a flanking helper.
 for(const u of w.units.filter(u=>u.team==='B'))for(const key of ['x','y','hp'])Object.defineProperty(u,key,{get(){throw Error(`Hidden enemy ${key} read after observation`);}});
 for(let n=1;n<20;n++){w.tick=n;runBots(w);}
 assert.equal(controller.metrics.observations,1);
});

test('stalled approaches replace their movement command without per-tick retries',()=>{
 const w=createMatch({scenario:'war',botTeams:['A'],combat:false});
 // Advance the commander while the battlefield is frozen, as when a route is
 // congested. Commands still pass through the real authoritative validator.
 for(let n=0;n<800;n++){w.tick=n;for(const c of w.queue.splice(0))command(w,c.team,c);runBots(w);}
 const orders=w.commandLog.filter(c=>c.squadId===2);
 assert(new Set(orders.map(c=>c.target)).size>1);
 assert(orders.length<=8);
});

test('mobile operations use staged flank commands when lateral terrain is connected',()=>{
 const w=createMatch({scenario:'war',botTeams:['A'],combat:false});
 for(let n=0;n<800&&!w.winner;n++)tick(w);
 const flanks=w.commandLog.filter(c=>c.type==='flank');assert(flanks.length>0);
 assert(flanks.every(c=>w.squads[c.squadId-1].botRole==='mobile'));
 assertInvariants(w);
});
