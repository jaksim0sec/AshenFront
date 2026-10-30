import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createAshenMatch,autoDeployPlayer,ASHEN_ARMY_LIMIT,ASHEN_ARMY_CHOICES} from '../src/fw/ashen-setup.mjs';
import {squadsFor} from '../src/fw/unit-groups.mjs';
import {updateSquadOrders} from '../src/fw/squad-orders.mjs';

test('army choices retain baseline and permit up to 350 soldiers per faction',()=>{
 assert.equal(ASHEN_ARMY_LIMIT,350);
 assert.deepEqual(ASHEN_ARMY_CHOICES,[40,100,200,350]);
 assert.equal(createAshenMatch({count:500}).match.limit,350);
 assert.equal(createAshenMatch({count:40}).match.limit,40);
});

test('350 vs 350 infantry uses actual full squads and both-side deployment', {timeout:120000},()=>{
 const start=performance.now();
 const {board,match}=createAshenMatch({seed:1977,count:350});
 const player=autoDeployPlayer(match);
 assert(player.complete,'player deployment stopped at '+match.counts.A+', reserve '+match.reserve.A);
 assert.equal(match.counts.A,350);
 assert.equal(match.squadIds.A.length,35);
 assert.equal(match.start(),true);
 assert.equal(match.reserve.B,0,'bot reserve not deployed: '+match.reserve.B);
 assert.equal(match.counts.B,350);
 assert.equal(match.squadIds.B.length,35);
 assert.equal(board.units.length,700);
 assert.equal(board.teamAlive.A,350);
 assert.equal(board.teamAlive.B,350);
 for(const squad of squadsFor(board).values())assert.equal(squad.memberIds.length,10);
 const deploymentMs=Math.round(performance.now()-start);
 const enemyStart=new Map(board.units.filter(u=>u.team==='B').map(u=>[u.id,[u.x,u.y]]));
 const turn=performance.now();
 for(let i=0;i<120;i++){board.update(.05);match.update(.05);updateSquadOrders(board);}
 const simulationMs=Math.round(performance.now()-turn);
 assert(match.decisions>0,'bot must command a large army');
 console.log('350v350 engine metrics',JSON.stringify({
  deploymentMs,simulationMs,simulatedSeconds:6,
  initialUnits:700,remainingUnits:board.units.length,decisions:match.decisions,
  movedEnemy:board.units.filter(u=>u.team==='B').filter(u=>{
   const p=enemyStart.get(u.id);return p&&(p[0]!==u.x||p[1]!==u.y);
  }).length
 }));
});
