import test from 'node:test';
import assert from 'node:assert/strict';
import {Board,project} from '../src/fw/model.mjs';
import {firingOrientation} from '../src/fw/shot-geometry.mjs';
import {drawBattleEffects} from '../src/fw/visuals.mjs';
import {poseCharacter,transformPoint} from '../src/characters/animation.mjs';
import {createCatalog} from '../src/characters/model.mjs';
import {SoldierRenderer,SOLDIER_SCALE} from '../src/characters/renderer.mjs';

test('left/right target decides whole soldier orientation, not only rifle rotation',()=>{
 const board=new Board(30,20);
 const soldier=board.spawn(15,10,null,{team:'A',stats:{range:12,rangeShape:'king'}});
 const left=board.spawn(10,10,null,{team:'B'});
 const right=board.spawn(21,10,null,{team:'B'});
 soldier.state='attack';soldier.strike={target:left.id,impactTime:.35};
 assert.equal(firingOrientation(board,soldier).facing,-1);
 soldier.strike.target=right.id;
 assert.equal(firingOrientation(board,soldier).facing,1);
 soldier.strike.target=left.id;
 left.visualX=20;left.visualY=10;
 assert.equal(firingOrientation(board,soldier).facing,1,'moving target must update orientation');
 left.visualX=10;
 assert.equal(firingOrientation(board,soldier).facing,-1);
});

test('the rifle muzzle is mirrored to the firing side of the actual authored head',()=>{
 const catalog=createCatalog();
 for(const nation of ['arken','velian'])for(const rank of ['private','sergeant','captain']){
  const profile=catalog.profiles[nation+':'+rank];
  const options={state:'shoot',time:.45,fireAt:.4,shootBlend:1,aim:0,facing:1};
  const pose=poseCharacter(profile,options);
  const hat=pose.draws.find(d=>d.part==='head'),center=transformPoint(hat.matrix,hat.w*.5,hat.h*.5);
  const right=pose.rifle.muzzle.x*SOLDIER_SCALE;
  assert(right>0,nation+':'+rank+' rifle must point in the screen-right direction');
  assert(right-center.x*SOLDIER_SCALE>8,nation+':'+rank+' muzzle must extend beyond the face');
  const left=-right;
  assert(left<0,'cached sprite must mirror its muzzle along with the uniform');
 }
});

test('shot tracer uses the rendered muzzle location, never a guessed face-height origin',()=>{
 const soldier={state:'attack',strike:{target:2,healing:false,impactTime:.3},impacted:true,
  elapsed:.32,visualX:8,visualY:7,_shotMuzzle:{x:-26,y:-23,valid:true},_shotMuzzleStamp:9};
 const target={visualX:3,visualY:7};
 const board={units:[soldier],unit(id){return id===2?target:null;},effects:[]};
 const moves=[];
 const ctx={save(){},restore(){},beginPath(){},stroke(){},fill(){},closePath(){},moveTo(x,y){moves.push({x,y});},
  lineTo(){},createLinearGradient(){return {addColorStop(){}}},set globalAlpha(x){},set strokeStyle(x){},
  set lineWidth(x){},set fillStyle(x){}};
 drawBattleEffects(ctx,board,9);
 const base=project(soldier.visualX,soldier.visualY);
 assert(moves.length>=2,'tracer and flash shape must be drawn');
 assert(Math.abs(moves[0].x-base.x+26)<.00001);
 assert(Math.abs(moves[0].y-base.y+23)<.00001);
 moves.length=0;drawBattleEffects(ctx,board,10);
 assert.equal(moves.length,0,'offscreen stale muzzle from another frame must never produce a tracer');
});

test('one cached sprite reuses its exact rendered muzzle and mirrors the cached geometry',()=>{
 const old=globalThis.document;
 const context={
  globalAlpha:1,save(){},restore(){},scale(){},translate(){},drawImage(){},
  transform(){},beginPath(){},rect(){},clip(){},fillRect(){},moveTo(){},lineTo(){},fill(){},rotate(){},roundRect(){},stroke(){},
 };
 globalThis.document={createElement(){return {width:0,height:0,getContext(){return context;}}}};
 try {
  const renderer=Object.create(SoldierRenderer.prototype);
  Object.assign(renderer,{loaded:true,revision:1,catalog:createCatalog(),images:new Map(),metadata:{},cache:new Map(),cacheBytes:0,hits:0,misses:0});
  const right={},left={},params={state:'shoot',time:.45,fireAt:.4,aim:0,shootBlend:1,pixelDensity:.2};
  assert(renderer.draw(context,'A','private',{...params,facing:1,muzzleOut:right}));
  assert(renderer.draw(context,'A','private',{...params,facing:-1,muzzleOut:left}));
  assert(right.valid&&left.valid);
  assert(Math.abs(right.x+left.x)<.00001);
  assert(Math.abs(right.y-left.y)<.00001);
  assert.equal(renderer.misses,1,'both directions share the cached sprite');
  assert.equal(renderer.hits,1);
 }finally{globalThis.document=old;}
});
