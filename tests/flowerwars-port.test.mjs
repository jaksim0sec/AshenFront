import test from 'node:test';
import assert from 'node:assert/strict';
import {createAshenMatch,autoDeployPlayer} from '../src/fw/ashen-setup.mjs';
import {orderSquads,updateSquadOrders} from '../src/fw/squad-orders.mjs';
import {squadsFor} from '../src/fw/unit-groups.mjs';

test('FlowerWars original match handles two-army deployment and starts battle',()=>{
 const {board,match}=createAshenMatch({seed:1977});
 assert.equal(board.units.length,0);
 assert.equal(match.phase,'preparation');
 const player=autoDeployPlayer(match);
 assert(player.complete,'40 infantry must deploy through original FlagMatch.deploy');
 assert.equal(match.counts.A,40);
 assert.equal(match.reserve.A,0);
 assert.equal(match.start(),true);
 assert.equal(match.phase,'battle');
 assert.equal(match.counts.B,40);
 assert.equal(match.reserve.B,0);
 assert.equal([...squadsFor(board).values()].filter(s=>s.team==='A').length,4);
 assert.equal([...squadsFor(board).values()].filter(s=>s.team==='B').length,4);
});
test('Original squad orders cause physical movement and bot responds',()=>{
 const {board,match}=createAshenMatch({seed:1977});
 assert(autoDeployPlayer(match).complete);
 match.start();
 const soldiers=board.units.filter(u=>u.team==='A'&&u.health.current>0),initial=soldiers.map(u=>[u.x,u.y]);
 const enemy=board.units.filter(u=>u.team==='B'&&u.health.current>0),enemyStart=enemy.map(u=>[u.x,u.y]);
 const id=match.squadIds.A[0];
 const result=orderSquads(board,[id],'advance',{x:Math.floor(board.width*.4),y:Math.floor(board.height*.5)});
 assert.equal(result.accepted.length,1);
 for(let i=0;i<800;i++){board.update(.05);match.update(.05);updateSquadOrders(board);}
 assert(soldiers.some((u,i)=>u.x!==initial[i][0]||u.y!==initial[i][1]),'soldiers must move physically');
 assert([...squadsFor(board).values()].some(s=>s.team==='B'&&s.order),'bot must give source squad orders');
 assert(enemy.some((u,i)=>u.x!==enemyStart[i][0]||u.y!==enemyStart[i][1]),'enemy soldiers must physically move rather than just shoot in place');
});
