import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/fw/model.mjs';
import {separationOffset,MAX_SEPARATION_OFFSET} from '../src/fw/separation-steering.mjs';

test('separation is bounded, deterministic and unbiased toward A or B',()=>{
 const board=new Board(12,12);
 const a=board.spawn(4,5,null,{team:'A'}),b=board.spawn(5,5,null,{team:'B'});
 const left=separationOffset(board,a),right=separationOffset(board,b);
 assert(left.x<0&&right.x>0);
 assert(Math.abs(left.x)<=MAX_SEPARATION_OFFSET&&Math.abs(right.x)<=MAX_SEPARATION_OFFSET);
 assert(Math.abs(left.x+right.x)<1e-9);
 assert.equal(left.y,0);assert.equal(right.y,0);
 assert.equal(separationOffset(board,a).x,left.x);
 assert.equal(a.team,'A');assert.equal(b.team,'B');
});
test('empty, dead and remote neighbors do not cause displacements',()=>{
 const board=new Board(12,12),a=board.spawn(4,4,null,{team:'A'});
 assert.deepEqual(separationOffset(board,a),{x:0,y:0});
 board.spawn(10,10,null,{team:'B'});
 assert.deepEqual(separationOffset(board,a),{x:0,y:0});
 const enemy=board.spawn(5,4,null,{team:'B'});
 board.damage(enemy.id,500);
 assert.deepEqual(separationOffset(board,a),{x:0,y:0});
});
test('Ashen visual spacing does not modify logical cell occupancy or move a stopped actor through an obstacle',()=>{
 const board=new Board(12,12,{spacing:true}),a=board.spawn(4,5,null,{team:'A'}),b=board.spawn(5,5,null,{team:'A'});
 board.setObstacle(3,5,{kind:'wall',blocked:true});
 for(let i=0;i<12;i++)board.update(.05);
 assert(a.visualX<a.x&&b.visualX>b.x);
 assert(Math.abs(a.visualX-a.x)<=MAX_SEPARATION_OFFSET+1e-9);
 assert.equal(board.at(4,5),a);assert.equal(board.at(5,5),b);
 assert.equal(board.navigation.blocked(5*12+3),true);
});
test('disabled spacing preserves exact legacy positions',()=>{
 const board=new Board(12,12),a=board.spawn(4,5,null,{team:'A'});
 board.spawn(5,5,null,{team:'B'});
 for(let i=0;i<10;i++)board.update(.05);
 assert.equal(a.visualX,4);assert.equal(a.visualY,5);
});
test('moving unit preserves precise occupancy and bounded visual offsets',()=>{
 const board=new Board(15,10,{spacing:true});
 const a=board.spawn(2,4,null,{team:'A'});
 board.spawn(2,5,null,{team:'A'});
 assert(board.move(a.id,8,4));
 for(let i=0;i<300&&a.x!==8;i++){
  board.update(.05);
  assert(Number.isFinite(a.visualX)&&Number.isFinite(a.visualY));
  if(a.step)assert(Math.abs(a.visualY-a.y)<=.5+MAX_SEPARATION_OFFSET+1e-6);
 }
 assert.equal(a.x,8);
 assert.equal(a.y,4);
});

test('a moving blocker clears before a follower spends detour search work',()=>{
 const board=new Board(12,12),front=board.spawn(5,5,null,{team:'A'}),rear=board.spawn(4,5,null,{team:'A'});
 assert(board.move(front.id,8,5));
 assert(board.move(rear.id,7,5));
 // The lead soldier leaves its current cell in under half a second.
 // The follower must not plan an expensive bypass around that transient block.
 for(let i=0;i<3;i++)board.update(.12);
 assert.equal(board.navigation.stats.detours,0,'moving leader caused needless detour');
 for(let i=0;i<120&&rear.x!==7;i++)board.update(.05);
 assert.equal(rear.x,7,'follower must eventually make progress');
 assert.equal(board.occupied(7,5),true);
});
