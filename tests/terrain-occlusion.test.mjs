import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainOccluders,mergeDepthLayers,projectElevatedFoot,terrainLevel,terrainOcclusionStats,compareProjectedUnits,terrainTransitionPose,terrainRiseProgress,terrainCoverPolygons,clipSoldierAgainstTerrain} from '../src/fw/terrain-occlusion.mjs';
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
test('terrain cannot repaint a whole foreground tile over the upper half of a soldier',()=>{
 const b=board();b.floorLevel[2*b.width+2]=0;b.floorLevelRevision++;
 const fronts=terrainOccluders(b,bounds);
 assert.ok(fronts.length,'trench must have front-facing physical wall faces');
 assert.ok(fronts.every(face=>face.kind==='wall'),'surface caps belong only to cached terrain, not the actor occlusion stream');
 assert.ok(fronts.every(face=>face.level>face.low),'front layer must contain only height-changing surfaces');
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
 const calls=[],ctx={beginPath(){calls.push('begin')},moveTo(){},lineTo(){},closePath(){},fill(){calls.push('fill')},stroke(){calls.push('stroke')},drawImage(){calls.push('image')}};
 BattlefieldTerrainRenderer.prototype.drawOccluder.call({kind:'new',surface:{}},ctx,{...b,terrain:Array.from({length:b.height},()=>Array(b.width).fill('grass')),seed:1,obstacles:new Map(),battlefield:{clearing:{x:4,y:4,rx:5,ry:5}}},wall);
 assert.ok(calls.filter(x=>x==='fill').length>=2,'two earth layers');
 assert.ok(calls.includes('stroke'),'rim visible');
 assert.ok(!calls.includes('image'),'do not overpaint soldier');
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

test('real projected feet, not spawn order or flattened tile center, determine moving soldier order',()=>{
 const b=board(),hi=actor(3,2,99),lo=actor(2,3,1);
 b.floorLevel[2*b.width+3]=2;b.floorLevel[3*b.width+2]=0;
 hi._renderFoot=projectElevatedFoot(b,hi);lo._renderFoot=projectElevatedFoot(b,lo);
 assert.ok(hi._renderFoot.y<lo._renderFoot.y,'high ground is visually behind the lower trench');
 assert.deepEqual([lo,hi].sort(compareProjectedUnits),[hi,lo]);
 const t=actor(2,3,33);t._renderFoot=projectElevatedFoot(b,t);
 t._renderFoot={...t._renderFoot,x:lo._renderFoot.x+144};
 assert.ok(compareProjectedUnits(lo,t)<0,'same-height neighbors use screen X for deterministic order');
});
test('climbing and descending pose signals are smooth and disabled on flat walking',()=>{
 const b=board(),u=actor(2,2);
 b.floorLevel[2*b.width+3]=2;
 u.step={x:3,y:2,duration:1,elapsed:0};
 assert.equal(terrainTransitionPose(b,u),0);
 u.step.elapsed=.25;assert.ok(terrainTransitionPose(b,u)>.6);
 u.step.elapsed=.5;assert.ok(terrainTransitionPose(b,u)>.99);
 u.step.elapsed=.75;assert.ok(terrainTransitionPose(b,u)>.6);
 u.step.elapsed=1;assert.ok(Math.abs(terrainTransitionPose(b,u))<1e-10);
 u.x=3;u.y=2;u.step={x:2,y:2,duration:1,elapsed:.5};
 assert.ok(terrainTransitionPose(b,u)<-.99);
 b.floorLevel[3*b.width+3]=2;
 u.step={x:3,y:3,duration:1,elapsed:.5};
 assert.equal(terrainTransitionPose(b,u),0);
});

test('same-tile face competes with soldier while a front-neighbor soldier stays visible',()=>{
 const b=board(16,16);b.floorLevel[5*b.width+5]=2;b.floorLevelRevision++;
 const rear=actor(5,5),front=actor(6,5);
 assert.ok(terrainCoverPolygons(b,rear).some(p=>p.length===4));
 assert.deepEqual(terrainCoverPolygons(b,front),[]);
});
test('trench soldier is locally masked by elevated front tile, not rear tiles',()=>{
 const b=board(18,18);b.floorLevel[7*b.width+7]=0;b.floorLevelRevision++;
 assert.ok(terrainCoverPolygons(b,actor(7,7)).length>0);
 assert.deepEqual(terrainCoverPolygons(b,actor(8,7)),[]);
});
test('wall occlusion boundary follows fractional motion rather than snapping at cell centers',()=>{
 const b=board(16,16);b.floorLevel[5*b.width+5]=2;b.floorLevelRevision++;
 const first=terrainCoverPolygons(b,actor(5,5));
 const moving={...actor(5,5),visualX:5.55};
 const mid=terrainCoverPolygons(b,moving);
 const face=poly=>poly.length===4&&poly.some(p=>p.y>430);
 const a=first.find(face),m=mid.find(face);
 assert.ok(a&&m);
 assert.notDeepEqual(a[0],m[0],'same wall is clipped to moving foot depth');
 assert.equal(terrainCoverPolygons(b,actor(6,5)).filter(face).length,0);
});
test('per-soldier exclusion clips use an even-odd hole for every overlapping face',()=>{
 const b=board(16,16);b.floorLevel[5*b.width+5]=2;b.floorLevelRevision++;
 const log=[],ctx={beginPath(){log.push('begin')},rect(){log.push('rect')},moveTo(){},lineTo(){},
  closePath(){},clip(rule){log.push(rule)}};
 const n=clipSoldierAgainstTerrain(ctx,b,actor(5,5));
 assert.ok(n>0);assert.equal(log.filter(v=>v==='evenodd').length,n);
 assert.equal(log.filter(v=>v==='rect').length,n);
 assert.equal(clipSoldierAgainstTerrain(ctx,{width:16,height:16},actor(5,5)),0);
});
test('occlusion complexity remains local on a much bigger battlefield',()=>{
 const big=board(512,384),small=board(64,64);
 for(const b of [big,small]){b.floorLevel[30*b.width+31]=0;b.floorLevelRevision++;}
 assert.equal(terrainCoverPolygons(big,actor(31,30)).length,terrainCoverPolygons(small,actor(31,30)).length);
});

test('only rising changes terrain-ascent pose and two-leg movement uses the right half',()=>{
 const b=board(),u=actor(2,2);
 b.floorLevel[2*b.width+3]=2;
 b.floorLevel[3*b.width+2]=0;
 assert.equal(terrainRiseProgress(b,u),null);
 u.step={x:3,y:2,elapsed:.25,duration:1};
 assert.equal(terrainRiseProgress(b,u),.25);
 u.step.elapsed=1;assert.equal(terrainRiseProgress(b,u),1);
 u.x=3;u.y=2;u.step={x:2,y:2,elapsed:.4,duration:1};
 assert.equal(terrainRiseProgress(b,u),null,'downhill walking has no climb animation');
 u.x=2;u.y=2;u.step={x:3,y:2,via:{x:2,y:3},elapsed:.25,duration:1};
 assert.equal(terrainRiseProgress(b,u),null,'first passage leg goes downward');
 u.step.elapsed=.75;
 assert.equal(terrainRiseProgress(b,u),.5,'second passage leg goes upward');
 u.step.duration=0;
 assert.equal(terrainRiseProgress(b,u),null,'invalid movement never animates');
});

test('bank toe occlusion follows the same shallow soil bevel as the wall renderer',()=>{
 const b=board(16,16);b.floorLevel[5*b.width+5]=2;b.floorLevelRevision++;
 const mask=terrainCoverPolygons(b,actor(5,5));
 const py=(5+5)*42-(2-1)*22;
 // East high bank: bottom of the painted cut leans 12px toward lower tile
 // and 4px down, not directly below the top edge like a vertical fence.
 assert.ok(mask.some(poly=>poly.length===4&&poly.some(p=>p.x===12&&p.y===py+42+22+4)),
  'depth mask must include the sloped earth toe');
});
