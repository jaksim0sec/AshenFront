import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog} from '../src/characters/model.mjs';
import {poseCharacter} from '../src/characters/animation.mjs';
import {sampleAnimation} from '../src/characters/renderer.mjs';

const profile=createCatalog().profiles['arken:private'];
const pose=(state,time,shootBlend)=>poseCharacter(profile,{state,time,shootBlend,aim:0,phase:0,facing:1});
const matrix=(p,key)=>p.draws.find(d=>d.part===key)?.matrix;
const distance=(a,b)=>Math.hypot(a[4]-b[4],a[5]-b[5]);
const angle=(m)=>Math.atan2(m[1],m[0]);
const angleDiff=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

test('combat guard waits with rifle ready but retains a separate attention pose',()=>{
 const attention=pose('idle',0,0),ready=pose('guard',0,.63);
 assert(distance(matrix(attention,'rifle'),matrix(ready,'rifle'))>1.5,'ready stance should move gun');
 assert(distance(matrix(ready,'armRight'),matrix(attention,'armRight'))>2,'supporting arm should prepare');
 const moving=pose('guard',.73,.63);
 assert(distance(matrix(ready,'body'),matrix(moving,'body'))>.02,'guard should breathe and shift weight');
});

test('guard-to-fire does not snap hand or rifle on transition boundary',()=>{
 const ready=pose('guard',0,.63),fire=pose('shoot',0,.63);
 for(const name of ['armLeft','armRight','rifle','head','body']){
  assert(distance(matrix(ready,name),matrix(fire,name))<.15,name+' teleported during guard->fire');
  assert(angleDiff(angle(matrix(ready,name)),angle(matrix(fire,name)))<.015,name+' snapped rotation during guard->fire');
 }
 const lower=pose('guard',0,.63),lowered=pose('idle',0,.63);
 assert(distance(matrix(lower,'rifle'),matrix(lowered,'rifle'))<1,'transition can smoothly lower weapon');
});

test('nearby soldier frames use at least 24-30fps like original archer, distant LOD remains cheap',()=>{
 const samples=[];
 for(let i=0;i<30;i++)samples.push(sampleAnimation({state:'guard',time:i/30,phase:0}).time);
 assert(new Set(samples).size>=27,'guard frames must not snap to 18fps');
 const shots=[];
 for(let i=0;i<30;i++)shots.push(sampleAnimation({state:'shoot',time:i/30,shootBlend:1}).time);
 assert(new Set(shots).size>=28,'rifle fire must update at roughly 30fps');
 const low=[];
 for(let i=0;i<30;i++)low.push(sampleAnimation({state:'guard',time:i/30,phase:0},true).time);
 assert(new Set(low).size<=8,'large distant armies should retain low-cost LOD');
});

test('walk-to-guard gradually settles leg, body and arm movement without a pose pop',()=>{
 const time=.31;
 const transforms=(state,blend)=>poseCharacter(profile,{state,time,walkBlend:blend,shootBlend:.3,aim:0,phase:0});
 const walk=transforms('walk',1),almost=transforms('guard',.99),settled=transforms('guard',0);
 for(const name of ['legLeft','legRight','body','armLeft','armRight']){
  const a=matrix(walk,name),b=matrix(almost,name);
  assert(distance(a,b)<1.5,name+' teleported when walk ended');
  assert(angleDiff(angle(a),angle(b))<.055,name+' abruptly changed rotation');
 }
 assert(distance(matrix(walk,'legLeft'),matrix(settled,'legLeft'))>.05,'stride should ease down, not freeze');
});


test('combat-experienced wait braces at the hips without distorting the supplied parts',()=>{
 const profiles=createCatalog().profiles;
 for(const name of ['arken:private','arken:captain','velian:private','velian:captain']){
  const p=profiles[name],params={state:'guard',time:.7,facing:1,shootBlend:.63,walkBlend:0};
  const stand=poseCharacter(p,{...params,crouchBlend:0});
  const crouch=poseCharacter(p,{...params,crouchBlend:1});
  const center=(pose,key)=>{
   const d=pose.draws.find(x=>x.part===key);
   return {x:d.matrix[0]*d.w*.5+d.matrix[2]*d.h*.5+d.matrix[4],
           y:d.matrix[1]*d.w*.5+d.matrix[3]*d.h*.5+d.matrix[5]};
  };
  const hatA=center(stand,'hat'),hatB=center(crouch,'hat');
  assert(hatB.x>hatA.x+4,name+': guard must lean forward in screen-right facing');
  assert(hatB.y>hatA.y+1&&hatB.y<hatA.y+25,name+': lower posture without collapsing head');
  const foot=(pose,key)=>{
   const d=pose.draws.find(x=>x.part===key),part=p.parts[key];
   const x=part.w*.5,y=part.h*.9;
   return {x:d.matrix[0]*x+d.matrix[2]*y+d.matrix[4],y:d.matrix[1]*x+d.matrix[3]*y+d.matrix[5]};
  };
  const width=pose=>Math.abs(foot(pose,'legLeft').x-foot(pose,'legRight').x);
  assert(width(crouch)>width(stand)+4,name+': legs should widen through native hip pivots');
  for(const part of ['head','hat','body','legLeft','legRight','armLeft','armRight','rifle']){
   const get=pose=>pose.draws.find(d=>d.part===part).matrix;
   const determinant=m=>m[0]*m[3]-m[1]*m[2];
   assert(Math.abs(Math.abs(determinant(get(stand)))-Math.abs(determinant(get(crouch))))<1e-8,name+': must not warp '+part);
  }
  let previous=stand;
  for(let i=1;i<=16;i++){
   const next=poseCharacter(p,{...params,crouchBlend:i/16});
   for(const part of ['head','hat','body','legLeft','legRight','armLeft','armRight','rifle']){
    const a=previous.draws.find(d=>d.part===part).matrix,b=next.draws.find(d=>d.part===part).matrix;
    assert(angleDiff(angle(a),angle(b))<.12,name+': snapped rotation '+part);
    assert(distance(a,b)<5,name+': teleported '+part);
   }
   previous=next;
  }
 }
});

test('a soldier remembers combat after a shot or incoming damage',async()=>{
 const {Board}=await import('../src/fw/model.mjs');
 const board=new Board(24,16);
 const a=board.spawn(6,6,null,{team:'A',stats:{range:8,rangeShape:'king',lineOfSight:false}});
 const b=board.spawn(9,6,null,{team:'B',stats:{range:8,rangeShape:'king',lineOfSight:false}});
 assert(!a.hasEngaged&&!b.hasEngaged,'fresh troops must not start crouched');
 assert(board.beginAttack(a,b.id));
 assert.equal(a.hasEngaged,true,'firing records experience');
 assert(!b.hasEngaged);
 assert(board.damage(b.id,1,1,a.id));
 assert.equal(b.hasEngaged,true,'a wounded troop remembers engagement');
});

test('the first movement step marks a soldier as formerly mobile, not a timer',async()=>{
 const {Board}=await import('../src/fw/model.mjs');
 const board=new Board(24,16);
 const soldier=board.spawn(6,6,null,{team:'A'});
 assert.equal(soldier.hasMoved,undefined);
 board.beginStep(soldier,{x:7,y:6});
 assert.equal(soldier.hasMoved,true);
});

test('ramp walking produces a visibly distinct step but keeps native limb proportions and sprite cache bounds',()=>{
 const standing=poseCharacter(profile,{state:'walk',time:.25,gaitTime:.25,walkBlend:1,climbBlend:0});
 const climbing=poseCharacter(profile,{state:'walk',time:.25,gaitTime:.25,walkBlend:1,climbBlend:1});
 const leg=name=>climbing.draws.find(d=>d.part===name).matrix;
 const normal=name=>standing.draws.find(d=>d.part===name).matrix;
 assert.ok(Math.abs(leg('legLeft')[5]-normal('legLeft')[5])>10,'lead boot must lift during climb');
 assert.ok(Math.abs(leg('legRight')[5]-normal('legRight')[5])>4,'rear boot must brace during climb');
 for(const name of ['head','hat','body','legLeft','legRight','armLeft','armRight']){
  const orig=normal(name),m=leg(name);
  assert.ok(Math.abs((m[0]*m[3]-m[1]*m[2])-(orig[0]*orig[3]-orig[1]*orig[2]))<1e-8,name+' must not stretch');
 }
 const sampled=Array.from({length:101},(_,i)=>sampleAnimation({state:'walk',time:.25,climbBlend:i/100}).climbBlend);
 assert.ok(new Set(sampled).size<=13,'animation atlas must not create a new pose for every ramp progress tick');
});
