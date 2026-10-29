import test from 'node:test';import assert from 'node:assert/strict';import {createMatch,tick,checksum} from '../src/sim/engine.mjs';import {spawnSquad,assertInvariants} from '../src/sim/state.mjs';import {createTerrain,cell} from '../src/sim/world.mjs';import {updateObjectives} from '../src/sim/objectives.mjs';import {command} from '../src/sim/commands.mjs';
function empty(){return createMatch({scenario:'war',map:createTerrain(64,48),squadsPerTeam:0,botTeams:[],combat:false});}
test('INF-03 undefended enemy HQ is seized from authoritative occupancy',()=>{const w=empty();const p=w.commandPosts.find(p=>p.team==='B');spawnSquad(w,'A',p.center%64,Math.floor(p.center/64),1);spawnSquad(w,'B',55,5,1);updateObjectives(w);assert.equal(w.winner,'A');});
test('INF-03 defenders contest HQ, neutral sectors and elapsed time cannot win',()=>{const w=empty();const p=w.commandPosts.find(p=>p.team==='B');spawnSquad(w,'A',p.center%64,Math.floor(p.center/64),1);spawnSquad(w,'B',p.center%64+1,Math.floor(p.center/64),1);w.tick=999999;updateObjectives(w);assert.equal(w.winner,null);assert(p.contested);assert.equal(w.limitTicks,null);});
test('INF-03 elimination and simultaneous HQ captures resolve deterministically',()=>{const w=empty();spawnSquad(w,'A',5,5,1);updateObjectives(w);assert.equal(w.winner,'A');const v=empty();for(const p of v.commandPosts)spawnSquad(v,p.team==='A'?'B':'A',p.center%64,Math.floor(p.center/64),1);updateObjectives(v);assert.equal(v.winner,'draw');});
test('INF-03 bot keeps a home guard while others advance, legal complete seeded matches',()=>{
 for(const seed of [1,7,42]){const w=createMatch({scenario:'war',seed,botTeams:['A','B']});for(let n=0;n<120&&!w.winner;n++)tick(w);assert(w.squads.some(s=>s.role==='guard'));assert(w.squads.some(s=>s.role==='advance'));for(let n=0;n<16000&&!w.winner;n++){tick(w);if(n%200===0)assertInvariants(w);}
 assert(w.winner,`seed ${seed} did not finish`);assertInvariants(w);console.log('WAR_MATCH',JSON.stringify({seed,winner:w.winner,ticks:w.tick,checksum:checksum(w)}));
 }
});
test('INF-03 visible HQ threat actually redirects an available squad on its staggered decision tick',async()=>{
 const {runBots}=await import('../src/sim/bot.mjs');const w=createMatch({scenario:'war',botTeams:['A']});const enemy=w.units.find(u=>u.team==='B');w.map.occupancy[cell(w.map,enemy.x,enemy.y)]=0;enemy.x=10;enemy.y=25;w.map.occupancy[cell(w.map,10,25)]=enemy.id;w.spatialRevision++;w.tick=102;runBots(w);assert(w.queue.some(c=>c.squadId===2&&c.target===w.commandPosts[0].center));
});
test('INF-02 strategic centers occupy real trench and high ground, HQ spawns stay clear',()=>{
 const w=createMatch({scenario:'war'});assert.equal(w.map.floorLevel[w.objectives[0].center],2);assert.equal(w.map.floorLevel[w.objectives[1].center],0);assert.equal(w.map.floorLevel[w.objectives[2].center],2);for(const p of w.commandPosts){assert(!w.map.blocked[p.center]);assert.equal(w.map.occupancy[p.center],0);}
});
