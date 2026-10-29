import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, createMap, canStep, connect, neighbors, cell } from '../src/sim/world.mjs';
import { project, pickTile, toScreen } from '../src/render/projection.mjs';

test('exactly three floor levels, one floor per cell, multiple reciprocal trench exits', () => {
 const m=createMap(); assert.equal(m.width,64); assert.equal(m.height,48);
 assert.deepEqual([...new Set(m.floorLevel)].sort(),[0,1,2]);
 for(const x of [17,46]) {
  const exits=[];
  for(let i=0;i<m.size;i++) if(m.floorLevel[i]===0 && Math.abs(i%m.width-x)<3)
   for(const j of neighbors(m,i)) if(m.floorLevel[j]===1 && canStep(m,i,j)) { assert(canStep(m,j,i)); exits.push(i); }
  assert(new Set(exits).size>=4);
 }
});
test('only explicit reciprocal ramps allow one-level changes, no diagonal or two-level jump',()=>{
 const m=createTerrain(4,4), a=5,b=6; m.floorLevel[a]=0;
 assert(!canStep(m,a,b)); connect(m,a,b); assert(canStep(m,a,b)); assert(canStep(m,b,a));
 m.transitionMask[b]=0; assert(!canStep(m,a,b)); connect(m,a,b); m.floorLevel[b]=2; assert(!canStep(m,a,b));
 assert(!canStep(m,5,10)); assert(!canStep(m,3,4)); m.floorLevel[a]=2; assert(canStep(m,a,b)); m.blocked[b]=1; assert(!canStep(m,a,b));
});
test('height-aware visible tile picking roundtrips at zoom and pan values',()=>{
 const m=createMap();
 for(const zoom of [.3,.8,1.6]) for(const i of [cell(m,17,24),cell(m,30,7),cell(m,32,24)]) {
  const camera={x:83,y:-42,zoom}; const p=project(i%m.width,Math.floor(i/m.width),m.floorLevel[i]);
  const s=toScreen(p,camera); assert.equal(pickTile(m,s.x,s.y,camera),i);
 }
});
test('each deployment has two separate routes around central ruins',()=>{
 const m=createMap();
 for(const side of [6,57]) for(const y of [18,29]) {
  const seen=new Set([cell(m,side,y)]), q=[...seen];
  for(let p=0;p<q.length;p++) for(const n of neighbors(m,q[p])) if(!seen.has(n)&&canStep(m,q[p],n)) {seen.add(n);q.push(n);}
  assert(seen.has(cell(m,32,24)));
 }
});
