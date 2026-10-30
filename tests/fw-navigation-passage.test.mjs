import test from 'node:test';
import assert from 'node:assert/strict';
import {Board,soldierRenderDepth} from '../src/fw/model.mjs';

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
 assert.equal(b.reservations.size,2);assert.equal(new Set(b.passage.values()).size,1);
 b.navigation.schedule=()=>{};b.advance(1);
 assert.notEqual(key(b,a.x,a.y),key(b,c.x,c.y));
});
test('no more than one temporary passage through a tile',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4),a=soldier(b,2,4),c=soldier(b,3,5);
 b.batchCommands(()=>{b.move(a.id,6,4,{direct:true});b.move(c.id,3,1,{direct:true});});
 assert.equal(new Set(b.passage.values()).size,1);
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

test('denied local movement never accumulates unused route entries',()=>{
 const b=new Board(16,12),a=soldier(b,2,4),c=soldier(b,3,5);
 b.batchCommands(()=>{b.move(a.id,3,4,{direct:true});b.move(c.id,3,4,{direct:true});});
 const denied=[a,c].filter(u=>!u.step);
 assert.equal(denied.length,1);
 assert.equal(denied[0].route.length,0);
});

test('passer shifts beyond the half-tile boundary while its neighbor stays protected',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4),passer=soldier(b,2,4);
 assert.equal(b.move(passer.id,6,4,{direct:true}),true);
 const side=passer.step.buffer;
 assert.equal(b.passage.get(key(b,side.x,side.y)),passer.id);
 assert.equal(b.spawn(side.x,side.y,null,{team:'A'}),null,'adjacent clearance must not accept a new soldier');
 b.navigation.schedule=()=>{};b.advance(passer.step.duration/2);
 assert.ok(Math.hypot(passer.visualX-owner.visualX,passer.visualY-owner.visualY)>=.64,'passing body must clear the owner by more than half a cell');
 assert.ok(soldierRenderDepth(passer)>soldierRenderDepth(owner),'passer must remain visually in front');
 b.advance(passer.step.duration/2);
 assert.equal(b.passage.size,0,'temporary buffer must be released');
});
test('choose the open side, never move through a neighboring soldier',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4),neighbor=soldier(b,3,5),passer=soldier(b,2,4);
 assert.equal(b.move(passer.id,6,4,{direct:true}),true);
 assert.deepEqual(passer.step.buffer,{x:3,y:3},'occupied side must be avoided');
 b.navigation.schedule=()=>{};b.advance(passer.step.duration/2);
 assert.ok(passer.visualY<3.4,'the open side lane must be used');
 assert.equal(b.cells.get(key(b,3,5)),neighbor.id);
 assert.equal(b.cells.get(key(b,3,4)),owner.id);
});
test('do not overlap when both lateral clearance cells are occupied',()=>{
 const b=new Board(16,12);soldier(b,3,4);soldier(b,3,3);soldier(b,3,5);
 const passer=soldier(b,2,4);
 b.move(passer.id,6,4,{direct:true});
 assert.equal(b.passage.size,0,'no full-width lane is available');
});
test('a killed passenger releases both the via and the lateral clearance buffer',()=>{
 const b=new Board(16,12);soldier(b,3,4);const passer=soldier(b,2,4);
 b.move(passer.id,6,4,{direct:true});
 assert.equal(b.passage.size,2);
 b.damage(passer.id,200);
 assert.equal(b.passage.size,0);
});
test('a passer has no forced depth privilege while crossing an upper lane',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4);soldier(b,3,5);
 const passer=soldier(b,2,4);
 b.move(passer.id,6,4,{direct:true});
 assert.deepEqual(passer.step.buffer,{x:3,y:3});
 b.navigation.schedule=()=>{};
 for(let i=0;i<7;i++){
  b.advance(.1);
  const footDepth=passer.visualX+passer.visualY;
  assert.equal(soldierRenderDepth(passer),footDepth,'render depth must equal projected feet');
  const residentDepth=soldierRenderDepth(owner);
  if(footDepth<residentDepth)assert.ok(soldierRenderDepth(passer)<residentDepth,'upper passer rendered in front');
  if(footDepth>residentDepth)assert.ok(soldierRenderDepth(passer)>residentDepth,'lower passer rendered behind');
 }
});
test('a passer on the lower lane naturally renders in front, without any special priority',()=>{
 const b=new Board(16,12),owner=soldier(b,3,4),passer=soldier(b,2,4);
 b.move(passer.id,6,4,{direct:true});
 assert.deepEqual(passer.step.buffer,{x:3,y:5});
 b.navigation.schedule=()=>{};
 b.advance(passer.step.duration/2);
 assert.ok(passer.visualX+passer.visualY>owner.visualX+owner.visualY,'passer did not reach lower lane');
 assert.ok(soldierRenderDepth(passer)>soldierRenderDepth(owner),'lower passer must draw later');
});
