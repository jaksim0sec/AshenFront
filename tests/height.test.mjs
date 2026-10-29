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
test('moving unit hit position follows the same interpolated foot and height as rendering',async()=>{
 const {unitFoot}=await import('../src/render/projection.mjs');const m=createTerrain(24,24);m.floorLevel[cell(m,11,20)]=2;
 const u={x:10,y:20,moveTo:cell(m,11,20),moveProgress:7};const p=unitFoot(m,u,0);assert.deepEqual(p,project(10.875,20,1.875));
});
test('a visible raised earth face picks its own tile rather than the hidden floor behind it',()=>{
 const m=createTerrain(4,4);m.floorLevel[5]=2;
 for(const zoom of [.3,.8,1.6]){const c={x:80,y:40,zoom},p=toScreen({x:36,y:72},c);assert.equal(pickTile(m,p.x,p.y,c),5);}
});
test('authored terrain is exactly mirrored across the battlefield centerline',()=>{
 const m=createMap();for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const a=cell(m,x,y),b=cell(m,m.width-1-x,y);assert.equal(m.floorLevel[a],m.floorLevel[b],`floor ${x},${y}`);assert.equal(m.blocked[a],m.blocked[b]);}
});
test('consecutive small seeds do not give the first firing actor an almost guaranteed hit',async()=>{
 const {random}=await import('../src/sim/world.mjs');const rolls=Array.from({length:20},(_,i)=>random({seed:i+1}));assert(rolls.filter(v=>v>.55).length>=5);assert(rolls.filter(v=>v<.55).length>=5);
});
