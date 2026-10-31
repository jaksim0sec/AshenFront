import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainOccluders,mergeDepthLayers,projectElevatedFoot,terrainLevel,terrainOcclusionStats} from '../src/fw/terrain-occlusion.mjs';
const board=(w=8,h=8)=>({width:w,height:h,floorLevel:new Uint8Array(w*h).fill(1),floorLevelRevision:0,terrainRevision:0});
const bounds={x0:0,x1:7,y0:0,y1:7};
const actor=(x,y,id=1)=>({visualX:x,visualY:y,x,y,id});
test('flat maps remain a zero-occluder fast path',()=>{
 const flat={width:512,height:384};
 assert.equal(terrainOccluders(flat,bounds).length,0);
 assert.equal(terrainOcclusionStats(flat).builds,0);
 const b=board();assert.equal(terrainOccluders(b,bounds).length,0);
});
test('front exposed wall covers the lower neighbor feet after the actor draw',()=>{
 const b=board();b.floorLevel[2*b.width+2]=2;b.floorLevelRevision++;
 const f=terrainOccluders(b,bounds);
 const wall=f.find(i=>i.kind==='wall'&&i.x===2&&i.y===2&&i.edge==='east');
 assert.ok(wall,'east face missing');
 assert.equal(wall.level,2);assert.equal(wall.low,1);
 const log=[];
 mergeDepthLayers([actor(2,2),actor(3,2,2)],[wall],u=>log.push('unit:'+u.id),i=>log.push(i.kind));
 assert.deepEqual(log,['unit:1','unit:2','wall']);
});
test('foreground ground cap hides the lower trench occupant while retaining same-tile actor',()=>{
 const b=board();b.floorLevel[2*b.width+2]=0;b.floorLevelRevision++;
 const fronts=terrainOccluders(b,bounds);
 const cap=fronts.find(i=>i.kind==='cap'&&i.x===3&&i.y===2);
 assert.ok(cap,'front high ground surface not emitted');
 const log=[];
 mergeDepthLayers([actor(2,2,1),actor(3,2,2)],[cap],u=>log.push('unit:'+u.id),()=>log.push('cap'));
 assert.deepEqual(log,['unit:1','cap','unit:2']);
});
test('scene-layer ordering is deterministic when two faces share depth',()=>{
 const b=board();b.floorLevel[2*b.width+2]=2;b.floorLevelRevision++;
 const list=terrainOccluders(b,bounds);
 assert.ok(list.length>=2);
 assert.deepEqual(list,list.slice().sort((a,b)=>a.depth-b.depth||a.screenX-b.screenX||a.order-b.order));
 const once=terrainOccluders(b,bounds);
 assert.equal(list,once);
 assert.equal(terrainOcclusionStats(b).builds,1);
});
test('viewport queries reuse cached sorted faces and invalidate when floor revision changes',()=>{
 const b=board(48,48);b.floorLevel[22*b.width+21]=2;b.floorLevelRevision++;
 const box={x0:12,x1:30,y0:12,y1:32};
 const a=terrainOccluders(b,box),same=terrainOccluders(b,box);
 assert.equal(a,same);assert.ok(a.length);
 assert.equal(terrainOccluders(b,{x0:0,x1:8,y0:0,y1:8}).length,0);
 const stats=terrainOcclusionStats(b);assert.equal(stats.builds,1);
 b.floorLevel[22*b.width+21]=1;b.floorLevelRevision++;
 assert.equal(terrainOccluders(b,box).length,0);assert.equal(terrainOcclusionStats(b).builds,2);
});
test('elevation interpolation follows ordinary and two-leg passage rather than jumping at arrival',()=>{
 const b=board();b.floorLevel[3*b.width+2]=0;b.floorLevel[4*b.width+2]=2;
 const u={x:2,y:2,visualX:2,visualY:2,step:null};
 assert.equal(terrainLevel(b,2,2),1);assert.equal(terrainLevel(b,2,3),0);
 assert.equal(projectElevatedFoot(b,u).y,168);
 u.step={x:2,y:3,elapsed:.5,duration:1};u.visualY=2.5;
 assert.equal(projectElevatedFoot(b,u).y,189+11);
 u.step={x:2,y:4,via:{x:2,y:3},elapsed:.5,duration:1};u.visualY=3;
 assert.equal(projectElevatedFoot(b,u).y,210+22);
 u.step.elapsed=.75;u.visualY=3.5;
 assert.equal(projectElevatedFoot(b,u).y,231);
});
test('occluder lookup does not grow with overall map size for a fixed visible region',()=>{
 const small=board(64,64),large=board(512,384);
 for(const b of [small,large]){
  for(let y=24;y<35;y++)b.floorLevel[y*b.width+31]=2;
  b.floorLevelRevision++;
 }
 const region={x0:26,x1:36,y0:22,y1:38};
 const a=terrainOccluders(small,region),b=terrainOccluders(large,region);
 assert.equal(a.length,b.length);assert.ok(a.length>0);
 assert.equal(terrainOcclusionStats(small).candidates,terrainOcclusionStats(large).candidates);
});

test('elevated renderer paints front earth faces separately from the cached background',async()=>{
 const {BattlefieldTerrainRenderer}=await import('../src/fw/terrain-art.mjs');
 const b=board();b.floorLevel[2*b.width+2]=2;b.floorLevelRevision++;
 const wall=terrainOccluders(b,bounds).find(v=>v.kind==='wall');
 const calls=[],ctx={beginPath(){calls.push('begin')},moveTo(){},lineTo(){},closePath(){},fill(){calls.push('fill')},drawImage(){calls.push('image')}};
 BattlefieldTerrainRenderer.prototype.drawOccluder.call({kind:'new',surface:{}},ctx,{...b,terrain:Array.from({length:b.height},()=>Array(b.width).fill('grass')),seed:1,obstacles:new Map(),battlefield:{clearing:{x:4,y:4,rx:5,ry:5}}},wall);
 assert.deepEqual(calls,['begin','fill']);
});

test('height-adjusted actor foot controls terrain and unit order without rerender math',()=>{
 const b=board();b.floorLevel[2*b.width+2]=2;b.floorLevelRevision++;
 const hi=actor(2,2,1),lo=actor(3,2,2);
 hi._renderFoot=projectElevatedFoot(b,hi);lo._renderFoot=projectElevatedFoot(b,lo);
 assert.ok(hi._renderFoot.y<lo._renderFoot.y);
 const faces=terrainOccluders(b,bounds),wall=faces.find(f=>f.kind==='wall'&&f.x===2&&f.y===2&&f.edge==='east');
 const log=[];
 mergeDepthLayers([hi,lo],[wall],u=>log.push(u.id),()=>log.push('wall'));
 assert.deepEqual(log,[1,2,'wall']);
});
