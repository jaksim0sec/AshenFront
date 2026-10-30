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
