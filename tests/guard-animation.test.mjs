import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog} from '../src/characters/model.mjs';
import {poseCharacter,lookAround} from '../src/characters/animation.mjs';
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

test('trench ascent plants lead boot, hauls torso, catches trailing boot and returns to walk',()=>{
 const opts={state:'walk',time:.2,gaitTime:.2,walkBlend:1,climbBlend:0};
 const normal=poseCharacter(profile,opts);
 const rise=t=>poseCharacter(profile,{...opts,riseProgress:t});
 const part=(p,key)=>p.draws.find(d=>d.part===key).matrix;
 for(const key of ['body','head','hat','legLeft','legRight','armLeft','armRight']){
  assert.deepEqual(part(rise(0),key),part(normal,key),'entry boundary: '+key);
  assert.deepEqual(part(rise(1),key),part(normal,key),'exit boundary: '+key);
  const base=part(normal,key),active=part(rise(.47),key);
  const det=m=>m[0]*m[3]-m[1]*m[2];
  assert(Math.abs(det(base)-det(active))<1e-8,'original part is never stretched: '+key);
 }
 assert(Math.abs(part(rise(.3),'legLeft')[5]-part(normal,'legLeft')[5])>20,'front boot plants');
 assert(Math.abs(part(rise(.69),'legRight')[5]-part(normal,'legRight')[5])>15,'back boot catches');
 assert(Math.abs(part(rise(.54),'body')[5]-part(normal,'body')[5])>5,'torso pulls upward');
 let previous=rise(0);
 for(let i=1;i<=24;i++){
  const next=rise(i/24);
  for(const key of ['body','head','hat','legLeft','legRight']){
   const a=part(previous,key),b=part(next,key);
   assert(Math.hypot(a[4]-b[4],a[5]-b[5])<21,'no pose teleport '+key+' '+i);
  }
  previous=next;
 }
 const frames=Array.from({length:100},(_,i)=>sampleAnimation({...opts,riseProgress:i/99}).riseProgress);
 assert(new Set(frames).size<=13,'cache rise progress to 13 frames');
 assert(new Set(Array.from({length:100},(_,i)=>sampleAnimation({...opts,riseProgress:i/99},true).riseProgress)).size<=7,'low detail rise frames');
});
test('look-around rotates attached head and helmet, not gun, and does not affect combat',()=>{
 const opts={state:'guard',time:.2,shootBlend:0,walkBlend:0};
 const normal=poseCharacter(profile,opts),left=poseCharacter(profile,{...opts,lookBlend:-1}),right=poseCharacter(profile,{...opts,lookBlend:1});
 const part=(p,key)=>p.draws.find(d=>d.part===key).matrix;
 assert.notDeepEqual(part(left,'head'),part(right,'head'));
 assert.notDeepEqual(part(left,'hat'),part(right,'hat'));
 const heading=m=>Math.atan2(m[1],m[0]);
 const helmetOffset=p=>heading(part(p,'hat'))-heading(part(p,'head'));
 assert(Math.abs(helmetOffset(left)-helmetOffset(right))<1e-8,'hat retains head relative angle');
 for(const p of [left,right])assert.deepEqual(part(p,'rifle'),part(normal,'rifle'),'rifle is not affected');
 for(const state of ['shoot','death','walk'])assert.deepEqual(
  poseCharacter(profile,{...opts,state,lookBlend:1}),
  poseCharacter(profile,{...opts,state,lookBlend:0}),
  state+' may not look around'
 );
 assert.equal(lookAround(0,0),0);
 assert.equal(lookAround(8.6,0),0);
 const scan=Array.from({length:75},(_,i)=>lookAround(i/10,3));
 assert.ok(scan.some(v=>v<-.8)&&scan.some(v=>v>.8),'both directions should be visible');
 assert.equal(sampleAnimation({...opts,lookBlend:1},true).lookBlend,0,'low detail disables glance');
 assert.ok(new Set(Array.from({length:100},(_,i)=>sampleAnimation({...opts,lookBlend:-1+i/50}).lookBlend)).size<=13,'cache glance buckets');
});
