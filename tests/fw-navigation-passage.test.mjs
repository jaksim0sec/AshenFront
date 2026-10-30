import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/fw/model.mjs';

const soldier=(b,x,y,team='A')=>b.spawn(x,y,null,{team,movement:{stepTime:.4},stats:{maxHealth:100},autoCombat:false});
const key=(b,x,y)=>y*b.width+x;
test('friendly passage reserves an exit without overwriting the occupant',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4),runner=soldier(b,2,4);
 assert.equal(b.move(runner.id,6,4,{direct:true}),true);
 assert.deepEqual(runner.step?.via,{x:3,y:4});
 assert.equal(b.cells.get(key(b,3,4)),owner.id);
 assert.equal(b.passage.get(key(b,3,4)),runner.id);
 assert.equal(b.reservations.get(key(b,4,4)),runner.id);
 b.navigation.schedule=()=>{};b.advance(1);
 assert.equal(runner.x,4);
 assert.equal(b.cells.get(key(b,3,4)),owner.id);
 assert.equal(b.cells.get(key(b,4,4)),runner.id);
 assert.equal(b.passage.size,0);assert.equal(b.reservations.size,0);
});
test('simultaneous arrivals receive one occupation and one bounded transit',()=>{
 const b=new Board(16,12),a=soldier(b,2,4),c=soldier(b,3,5);
 b.batchCommands(()=>{b.move(a.id,6,4,{direct:true});b.move(c.id,3,1,{direct:true});});
 assert.equal([a,c].filter(u=>u.step).length,2);
 assert.equal([a,c].filter(u=>u.step?.via).length,1);
 assert.equal(b.reservations.size,2);assert.equal(b.passage.size,1);
 b.navigation.schedule=()=>{};b.advance(1);
 assert.notEqual(key(b,a.x,a.y),key(b,c.x,c.y));
});
test('no more than one temporary passage through a tile',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4),a=soldier(b,2,4),c=soldier(b,3,5);
 b.batchCommands(()=>{b.move(a.id,6,4,{direct:true});b.move(c.id,3,1,{direct:true});});
 assert.equal(b.passage.size,1);
 assert.equal(b.cells.get(key(b,3,4)),owner.id);
 assert.equal([a,c].filter(u=>u.step?.via).length,1);
});
test('enemy blockers and occupied exits cannot be crossed',()=>{
 for(const hostile of [true,false]){
  const b=new Board(16,12),holder=soldier(b,3,4,hostile?'B':'A'),runner=soldier(b,2,4);
  if(!hostile)soldier(b,4,4);
  b.move(runner.id,6,4,{direct:true});
  assert.equal(b.passage.size,0);assert.equal(b.cells.get(key(b,3,4)),holder.id);
 }
});
test('committed transit survives command interruption and cleans up on arrival',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4),runner=soldier(b,2,4);
 b.move(runner.id,6,4,{direct:true});b.interrupt(runner);
 assert.deepEqual(runner.step?.via,{x:3,y:4});
 b.navigation.schedule=()=>{};b.advance(1);
 assert.equal(runner.x,4);assert.equal(b.passage.size,0);
 assert.equal(b.cells.get(key(b,3,4)),owner.id);
});
test('passenger death releases reservations without deleting allied occupancy',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4),runner=soldier(b,2,4);
 b.move(runner.id,6,4,{direct:true});b.damage(runner.id,200);
 assert.equal(b.passage.size,0);assert.equal(b.reservations.size,0);
 assert.equal(b.cells.get(key(b,3,4)),owner.id);
});
test('initial forward movement is independent of full-path A-star completion',()=>{
 const b=new Board(16,12),runner=soldier(b,2,4);
 b.obstacles.set(key(b,11,11),{blocked:true});
 const count=b.navigation.stats.staticBuilds;
 b.move(runner.id,9,4,{direct:true,engage:false});
 assert.equal(runner.step?.x,3);
 assert.equal(b.navigation.stats.staticBuilds,count);
 assert.equal(runner.command.engage,false);
});
