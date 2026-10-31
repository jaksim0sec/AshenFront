import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/fw/model.mjs';
import {createBattlefield,installHeightDemo,canTraverseHeight} from '../src/fw/battlefield-terrain.mjs';
import {terrainOccluders,projectElevatedFoot,mergeDepthLayers} from '../src/fw/terrain-occlusion.mjs';

const i=(b,x,y)=>y*b.width+x;
const unit=(b,x,y)=>b.spawn(x,y,null,{team:'A',movement:{stepTime:.2},stats:{maxHealth:100},autoCombat:false});
test('actual generated battlefield installs visible A/B trench and hill demo with deterministic level metadata',()=>{
 const b=new Board(512,384,{seed:1977});createBattlefield(b);
 assert.equal(b.floorLevel.length,b.width*b.height);
 assert.equal(b.heightRamps.length,b.width*b.height);
 assert.ok(b.battlefield.heightDemo?.length>=4);
 const kinds=new Set(b.battlefield.heightDemo.map(z=>z.kind));
 assert.deepEqual([...kinds].sort(),['hill','trench']);
 const a=b.battlefield.heightDemo.filter(z=>z.team==='A');
 const mirror=b.battlefield.heightDemo.filter(z=>z.team==='B');
 assert.equal(a.length,mirror.length);
 for(const d of a){
  const opposite=mirror.find(z=>z.kind===d.kind);
  assert.ok(opposite);assert.equal(d.y,opposite.y);
  assert.equal(opposite.x,b.width-1-d.x);
  assert.equal(b.floorLevel[i(b,d.x,d.y)],d.kind==='trench'?0:2);
  assert.equal(b.navigation.blocked(i(b,d.x,d.y)),false);
 }
 const faces=terrainOccluders(b,{x0:160,x1:191,y0:176,y1:211});
 assert.ok(faces.length>0&&faces.every(f=>f.kind==='wall'));
});
test('height walls cannot be traversed, authorized ramp transitions work both directions',()=>{
 const b=new Board(22,20);b.floorLevel=new Uint8Array(b.width*b.height).fill(1);
 b.heightRamps=new Uint8Array(b.width*b.height);
 b.floorLevel[i(b,10,10)]=0;b.floorLevelRevision=1;b.obstacleRevision++;
 b.navigation.invalidate();
 const from=i(b,9,10),to=i(b,10,10);
 assert.equal(canTraverseHeight(b,from,to),false);
 assert.ok(!b.navigation.neighbors(from).includes(to));
 assert.ok(!b.navigation.neighbors(to).includes(from));
 b.heightRamps[from]|=1;b.heightRamps[to]|=4;b.obstacleRevision++;b.navigation.invalidate();
 assert.equal(canTraverseHeight(b,from,to),true);
 assert.ok(b.navigation.neighbors(from).includes(to));
 assert.ok(b.navigation.neighbors(to).includes(from));
 assert.equal(canTraverseHeight(b,to,i(b,11,10)),false);
});
test('ramp route is navigable; direct one-level cliff stays blocked',()=>{
 const b=new Board(24,20);b.floorLevel=new Uint8Array(b.width*b.height).fill(1);
 b.heightRamps=new Uint8Array(b.width*b.height);
 for(let y=6;y<=10;y++)for(let x=8;x<=12;x++)b.floorLevel[i(b,x,y)]=0;
 b.floorLevelRevision=1;
 // west entrance at (8,8): outside (7,8) -> trench (8,8).
 b.heightRamps[i(b,7,8)]|=1;b.heightRamps[i(b,8,8)]|=4;
 b.obstacleRevision++;b.navigation.invalidate();
 const u=unit(b,7,7);
 assert.equal(b.navigation.neighbors(i(b,7,7)).includes(i(b,8,7)),false);
 assert.equal(b.move(u.id,9,8,{direct:true,engage:false}),true);
 for(let tick=0;tick<200&&!(!u.step&&!u.command);tick++)b.update(.05);
 assert.deepEqual([u.x,u.y],[9,8]);
 assert.equal(u.health.current,100);
});
test('alley passage must not cut across a cliff or claim an elevated side buffer',()=>{
 const b=new Board(20,20);b.floorLevel=new Uint8Array(b.width*b.height).fill(1);
 b.heightRamps=new Uint8Array(b.width*b.height);b.floorLevel[i(b,3,4)]=0;
 b.floorLevelRevision=1;b.obstacleRevision++;b.navigation.invalidate();
 const owner=unit(b,3,4),runner=unit(b,2,4);
 b.move(runner.id,6,4,{direct:true});
 assert.equal(b.passage.size,0);
 assert.equal(b.cells.get(i(b,3,4)),owner.id);
});
test('moving into and out of both levels interpolates feet and uses mixed static wall/actor ordering',()=>{
 const b=new Board(24,20);b.floorLevel=new Uint8Array(b.width*b.height).fill(1);
 b.floorLevel[i(b,4,4)]=0;b.floorLevel[i(b,6,4)]=2;b.floorLevelRevision=1;
 const u=unit(b,4,4);assert.ok(u);
 assert.equal(projectElevatedFoot(b,u).y,(4+4)*42+22);
 const f=terrainOccluders(b,{x0:0,x1:12,y0:0,y1:12});
 assert.ok(f.length>0&&f.every(x=>x.kind==='wall'));
 const sequence=[];mergeDepthLayers([u],[...f],()=>sequence.push('unit'),()=>sequence.push('face'));
 assert.ok(sequence.indexOf('unit')>=0&&sequence.lastIndexOf('face')>=0);
});
test('flat world retains no additional occlusion work or height restrictions',()=>{
 const b=new Board(28,22),first=unit(b,3,5);
 assert.equal(b.floorLevel?.length??0,0);
 assert.equal(terrainOccluders(b,{x0:0,x1:20,y0:0,y1:20}).length,0);
 assert.ok(b.move(first.id,8,5,{direct:true}));
});

test('real match demo entrances support travel onto both samples',()=>{
 const b=new Board(512,384);createBattlefield(b);
 for(const sample of b.battlefield.heightDemo.filter(f=>f.team==='A')){
  const {entrance}=sample,runner=unit(b,entrance.fromX,entrance.y);
  assert.ok(runner,'entrance start must be free');
  assert.equal(canTraverseHeight(b,i(b,entrance.fromX,entrance.y),i(b,entrance.x,entrance.y)),true);
  assert.equal(b.move(runner.id,entrance.x,entrance.y,{direct:true,engage:false}),true);
  b.navigation.schedule=()=>{};
  b.advance(1);
  assert.deepEqual([runner.x,runner.y],[entrance.x,entrance.y],sample.kind+' ramp arrival');
  assert.equal(projectElevatedFoot(b,runner).y,(runner.x+runner.y)*42+(sample.kind==='trench'?22:-22));
 }
});

test('both ends of each demo feature have navigable reciprocal ramps',()=>{
 const b=new Board(512,384);createBattlefield(b);
 for(const feature of b.battlefield.heightDemo){
  const {exit}=feature;
  assert.ok(exit,feature.kind+' missing exit');
  assert.equal(canTraverseHeight(b,i(b,exit.x,exit.y),i(b,exit.toX,exit.y)),true);
  assert.equal(canTraverseHeight(b,i(b,exit.toX,exit.y),i(b,exit.x,exit.y)),true);
 }
});
test('units can leave trenches and hills through the opposite ramp',()=>{
 const b=new Board(512,384);createBattlefield(b);
 for(const feature of b.battlefield.heightDemo.filter(x=>x.team==='A')){
  const {exit}=feature,runner=unit(b,exit.x,exit.y);
  assert.ok(runner);
  assert.equal(b.move(runner.id,exit.toX,exit.y,{direct:true,engage:false}),true);
  b.navigation.schedule=()=>{};
  b.advance(1);
  assert.deepEqual([runner.x,runner.y],[exit.toX,exit.y],feature.kind+' exit transition');
 }
});
