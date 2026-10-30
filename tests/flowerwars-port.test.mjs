import test from 'node:test';
import assert from 'node:assert/strict';
import {createAshenMatch,autoDeployPlayer} from '../src/fw/ashen-setup.mjs';
import {BATTLEFIELD_WIDTH,BATTLEFIELD_HEIGHT} from '../src/fw/battlefield-terrain.mjs';
import {orderSquads,updateSquadOrders} from '../src/fw/squad-orders.mjs';
import {squadsFor} from '../src/fw/unit-groups.mjs';
import {drawCommandOverlay} from '../src/fw/command-overlay.mjs';

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

test('original FlowerWars command overlay renders squad route, target marker and move caption',()=>{
 const {board,match}=createAshenMatch({seed:1977});
 assert(autoDeployPlayer(match).complete);match.start();
 const id=match.squadIds.A[0],target={x:Math.floor(board.width*.4),y:Math.floor(board.height*.5)};
 const result=orderSquads(board,[id],'advance',target);
 assert.equal(result.accepted.length,1);
 const labels=[],calls={ellipses:0,lines:0};
 const ctx={
  globalAlpha:1,save(){},restore(){},beginPath(){},stroke(){},translate(){},scale(){},
  setLineDash(){},moveTo(){calls.lines++;},lineTo(){calls.lines++;},ellipse(){calls.ellipses++;},
  fillRect(){},strokeText(){},fillText(value){labels.push(value)}
 };
 drawCommandOverlay(ctx,board,{selectedSquadIds:[id]},.3);
 assert(labels.includes('이동'),'source overlay must draw readable action captions');
 assert(calls.lines>0&&calls.ellipses>0,'source overlay must draw path and target marker');
});

test('expanded AshenFront battlefield keeps the original match and valid headquarters',()=>{
 const {board,match}=createAshenMatch({seed:1977});
 assert.equal(BATTLEFIELD_WIDTH,512);assert.equal(BATTLEFIELD_HEIGHT,384);
 assert.equal(board.width,512);assert.equal(board.height,384);
 assert.ok(board.inside(match.flags.A.x,match.flags.A.y));
 assert.ok(board.inside(match.flags.B.x,match.flags.B.y));
 assert.ok(board.battlefield?.paths?.length>0);
 assert.ok(board.battlefield?.protectedCells?.length===512*384);
});

test('annihilation ends combat on the last real casualty with an exact survivor count',()=>{
 const {board,match}=createAshenMatch({seed:1977});
 autoDeployPlayer(match);assert.equal(match.start(),true);
 const army=board.units.filter(u=>u.team==='A');
 for(const soldier of army.slice(0,-1))board.damage(soldier.id,soldier.health.current);
 assert.equal(board.teamAlive.A,1);
 match.refreshStatus();
 assert.equal(match.counts.A,1);
 assert.equal(match.phase,'battle');
 const last=army.at(-1);
 board.damage(last.id,last.health.current);
 assert.equal(board.teamAlive.A,0);
 match.update(.05);
 assert.equal(match.counts.A,0);
 assert.equal(match.phase,'finished');
 assert.equal(match.winner,'B');
 assert.equal(match.finishReason,'annihilation');
 assert.ok(match.flags.A.health.current>0,'the HQ must remain standing');
});
