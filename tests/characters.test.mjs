import test from 'node:test';import assert from 'node:assert/strict';
import {createCatalog,validateCatalog,editPart,exportCatalog,importCatalog,NATIONS,RANKS} from '../src/characters/model.mjs';
import {poseCharacter,transformPoint} from '../src/characters/animation.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unifyPhysique} from '../src/characters/model.mjs';
import {ASPECTS} from '../src/characters/aspects.mjs';
test('published physique matches the supplied reference without drifting helmets or altered artwork',()=>{
 const rig=JSON.parse(readFileSync(new URL('../assets/soldiers/rig.json',import.meta.url))),manifest=JSON.parse(readFileSync(new URL('../assets/soldiers/manifest.json',import.meta.url))),catalog=createCatalog(),reference=JSON.parse(readFileSync(new URL('../assets/soldiers/physique-reference.json',import.meta.url))).profile;
 reference.parts.rifle.w*=1.2;reference.parts.rifle.h*=1.2;assert.equal(Object.keys(manifest.assets).length,36);for(const key of Object.keys(reference.parts).filter(k=>!k.startsWith('sleeve')))assert.deepEqual(catalog.profiles['arken:private'].parts[key],reference.parts[key]);
 for(const [id,meta] of Object.entries(manifest.assets))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+meta.path,import.meta.url))).digest('hex'),rig.parts[id].png_sha256);
 for(const profile of Object.values(catalog.profiles)){
  assert.deepEqual(profile.layers,reference.layers);assert.deepEqual(profile.parts.head,reference.parts.head);
  for(const part of Object.values(profile.parts))assert(Math.abs(part.w/part.h-ASPECTS[part.asset])<1e-10);
  if(profile.parts.hat.asset===reference.parts.hat.asset)assert.deepEqual(profile.parts.hat,reference.parts.hat);
  if(profile.parts.hat.asset==='black/helmet'){assert.equal(profile.parts.hat.x,reference.parts.hat.x);assert.equal(profile.parts.hat.y,reference.parts.hat.y);}
 }
 editPart(catalog,'arken:private','hat',{x:2,y:-151,pivotX:.48,w:133,rotation:.08});
 const first=unifyPhysique(catalog,'arken:private'),second=unifyPhysique(first,'arken:private');assert.deepEqual(second,first,'repeated unification must be idempotent');
 for(const id of ['arken:corporal','arken:warrant'])assert.deepEqual(first.profiles[id].parts.hat,first.profiles['arken:private'].parts.hat);
 const legacy=structuredClone(catalog);delete legacy.physiqueRevision;legacy.profiles['arken:corporal'].parts.hat.y-=5;const migrated=importCatalog(legacy);assert.deepEqual(migrated.profiles['arken:corporal'].parts.hat,reference.parts.hat);
});
test('actual barrel ray reaches the projected target through recoil, reload, motion and both facings',async()=>{
 const {sampleAnimation}=await import('../src/characters/renderer.mjs');const c=createCatalog();
 for(const id of ['arken:private','velian:captain'])for(const target of [{x:-650,y:-700},{x:650,y:-90},{x:-400,y:150},{x:1,y:-950}])for(const time of [0,.025,.2,.4,.75,1.2]){
  const p=c.profiles[id],facing=target.x<0?-1:1,options={state:'shoot',time,target,facing,moving:true},pose=poseCharacter(p,sampleAnimation(options)),{muzzle:m,direction:d}=pose.rifle,dx=target.x-m.x,dy=target.y-m.y;
  assert(Math.abs(dx*d.y-dy*d.x)<1e-8,'target must be on the actual barrel line');assert(dx*d.x+dy*d.y>0,'target must be in front of the muzzle');
  for(const key of ['armLeft','armRight']){const a=pose.draws.find(d=>d.part===key);assert(Math.abs(Math.hypot(a.matrix[0],a.matrix[1])-p.parts[key].scaleX)<1e-10);}
  // The cached right-facing pose is reflected with its target, not just its image.
  const canonical=poseCharacter(p,sampleAnimation({...options,facing:1,target:{x:target.x*facing,y:target.y}}));assert(Math.hypot(canonical.rifle.muzzle.x*facing-m.x,canonical.rifle.muzzle.y-m.y)<1e-8);
 }
});
test('all nation/rank profiles assemble the calibrated replacement archive',()=>{const c=createCatalog();assert.equal(Object.keys(c.profiles).length,NATIONS.length*RANKS.length);assert(validateCatalog(c));for(const p of Object.values(c.profiles)){assert(p.parts.head.asset==='shared/head');assert(p.parts.hat.asset.startsWith(p.nation==='arken'?'black/':'blue/'));}});
test('whole original arms remain intact; firing palms meet the rifle grips',()=>{const p=createCatalog().profiles['arken:private'];for(const state of ['idle','walk','shoot'])for(const time of [0,.04,.18,.4,.8,1.3])for(const aim of [-.6,0,.6]){const pose=poseCharacter(p,{state,time,aim,facing:1});if(state==='shoot')for(const side of ['left','right']){const a=pose.hands[side],b=transformPoint(pose.rifle.matrix,...pose.rifle.grips[side]);assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-6);}assert(pose.draws.every(d=>d.matrix.every(Number.isFinite)));assert.deepEqual(pose.draws.map(d=>d.part),p.layers.filter(k=>p.parts[k].visible));for(const key of ['armLeft','armRight']){const d=pose.draws.find(d=>d.part===key),part=p.parts[key];assert(Math.abs(Math.hypot(d.matrix[0],d.matrix[1])-part.scaleX)<1e-10);assert(Math.abs(Math.hypot(d.matrix[2],d.matrix[3])-part.scaleY)<1e-10);}}});
test('nation/rank adjustments export and reload atomically, invalid or external assets are rejected',()=>{const c=createCatalog(),original=structuredClone(c);editPart(c,'velian:captain','hat',{x:4,rotation:.2,pivotX:.4});const json=exportCatalog(c);assert.deepEqual(importCatalog(JSON.parse(json)),c);assert.deepEqual(original.profiles['arken:captain'],c.profiles['arken:captain']);const bad=JSON.parse(json);bad.profiles['arken:private'].parts.hat.asset='https://evil.test/image.png';assert.throws(()=>importCatalog(bad));assert.throws(()=>editPart(c,'velian:captain','head',{w:-1}));assert.equal(c.profiles['velian:captain'].parts.head.w,original.profiles['velian:captain'].parts.head.w);});
test('firing has recoil, bolt/reload hand motion and muzzle timing; paused sampling is deterministic',()=>{const p=createCatalog().profiles['arken:private'];const a=poseCharacter(p,{state:'shoot',time:.025}),b=poseCharacter(p,{state:'shoot',time:.4});assert(a.flash>0);assert.equal(b.flash,0);assert.notDeepEqual(a.hands.right,b.hands.right);assert.deepEqual(a,poseCharacter(p,{state:'shoot',time:.025}));});
test('single-profile exports merge without replacing other nation adjustments',async()=>{const {exportProfile,importEdits}=await import('../src/characters/model.mjs');const c=createCatalog();editPart(c,'arken:major','hat',{x:11});const json=exportProfile(c,'arken:major'),base=createCatalog();editPart(base,'velian:private','body',{w:120});const merged=importEdits(json,base);assert.equal(merged.profiles['arken:major'].parts.hat.x,11);assert.equal(merged.profiles['velian:private'].parts.body.w,120);});
test('edited whole-arm proportions retain exact rifle grip attachment',()=>{const c=createCatalog(),p=c.profiles['velian:captain'];editPart(c,'velian:captain','armLeft',{scaleX:.8,scaleY:1.2,rotation:.15});const pose=poseCharacter(p,{state:'shoot',time:.3,aim:-.3});for(const side of ['left','right']){const hand=pose.hands[side],grip=transformPoint(pose.rifle.matrix,...pose.rifle.grips[side]);assert(Math.hypot(hand.x-grip.x,hand.y-grip.y)<1e-6);}});
test('actual arm image palm anchors coincide with rifle grips in every facing and firing phase',()=>{const c=createCatalog();for(const id of ['arken:private','velian:captain'])for(const facing of [-1,1])for(const time of [0,.025,.2,.4,.75,1.2]){const p=c.profiles[id],pose=poseCharacter(p,{state:'shoot',time,facing,aim:.25,moving:true});assert(pose.rifle.matrix[0]*facing>0,'rifle barrel faces the shot direction');for(const [side,key] of [['left','armLeft'],['right','armRight']]){const d=pose.draws.find(d=>d.key===key),part=p.parts[key],hand=transformPoint(d.matrix,part.gripX*part.w,part.gripY*part.h),grip=transformPoint(pose.rifle.matrix,...pose.rifle.grips[side]);assert(Math.hypot(hand.x-grip.x,hand.y-grip.y)<1e-6);}}});
test('editable rifle dimensions preserve actual SVG grip and muzzle positions',()=>{for(const [w,h] of [[80,20],[140,35],[200,50]]){const c=createCatalog(),p=c.profiles['arken:private'];editPart(c,'arken:private','rifle',{w,h});const pose=poseCharacter(p,{state:'shoot',time:.025,aim:.35});for(const [side,x,y] of [['right',55/160,23/40],['left',105/160,19/40]]){const drawn=transformPoint(pose.rifle.matrix,x*w,y*h),hand=pose.hands[side];assert(Math.hypot(drawn.x-hand.x,drawn.y-hand.y)<1e-6);}const muzzle=transformPoint(pose.rifle.matrix,155/160*w,13/40*h);assert.deepEqual(pose.rifle.muzzle,muzzle);}});
test('falling and large edited poses have complete cache bounds instead of a fixed avatar crop',async()=>{const {poseBounds}=await import('../src/characters/animation.mjs');const c=createCatalog();editPart(c,'arken:captain','hat',{x:300,w:240});for(const time of [0,.3,.65,1.1]){const pose=poseCharacter(c.profiles['arken:captain'],{state:'death',time}),b=poseBounds(pose);for(const d of pose.draws.filter(d=>!d.clip))for(const [x,y] of [[0,0],[d.w,d.h]]){const p=transformPoint(d.matrix,x,y);assert(p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom);}}});
test('part dragging in a rotated death pose uses the animated parent basis',async()=>{const {partPositionBasis}=await import('../src/characters/animation.mjs');const p=createCatalog().profiles['velian:captain'],options={state:'death',time:.6,facing:-1},basis=partPositionBasis(p,'hat',options),q=structuredClone(p);q.parts.hat.x+=8;q.parts.hat.y-=3;const a=poseCharacter(p,options).draws.find(d=>d.part==='hat'),b=poseCharacter(q,options).draws.find(d=>d.part==='hat');assert(Math.abs((b.matrix[4]-a.matrix[4])-(basis.a*8-basis.c*3))<1e-6);assert(Math.abs((b.matrix[5]-a.matrix[5])-(basis.b*8-basis.d*3))<1e-6);});
test('cached walking samples repeat at the actual gait duration',async()=>{const {sampleAnimation}=await import('../src/characters/renderer.mjs');const period=Math.PI*2/10;for(const t of [.05,.15,.27,.4])assert.equal(sampleAnimation({state:'walk',time:t}).time,sampleAnimation({state:'walk',time:t+period}).time);});

test('national officer caps, blue helmets and sleeve insignia follow user fitting references',async()=>{
 const {FITTING_REFERENCES:refs}=await import('../src/characters/fittings.mjs');const c=createCatalog();
 for(const catalog of [c,unifyPhysique(c,'arken:private')])for(const p of Object.values(catalog.profiles)){
  const hatRef=Object.values(refs).find(r=>r.parts.hat.asset===p.parts.hat.asset);
  if(hatRef)for(const key of ['x','y','w','h','pivotX','pivotY','rotation'])assert(Math.abs(p.parts.hat[key]-hatRef.parts.hat[key])<1e-10,p.nation+':'+p.rank+' '+key);
  if(p.nation==='arken')for(const side of ['sleeveLeft','sleeveRight']){const actual=p.parts[side],expected=refs['arken:corporal'].parts[side];for(const k of ['x','y','rotation'])assert(Math.abs(actual[k]-expected[k])<1e-10);}
 }
 assert.deepEqual(unifyPhysique(unifyPhysique(c,'arken:private'),'arken:private'),unifyPhysique(c,'arken:private'));
});

test('death is a connected falling body, with no detached limbs or drifting equipment',()=>{
 const p=createCatalog().profiles['arken:private'];for(const facing of [-1,1]){
  const anchors=time=>{const pose=poseCharacter(p,{state:'death',time,facing});return new Map(pose.draws.map(d=>[d.part,transformPoint(d.matrix,d.w*p.parts[d.part].pivotX,d.h*p.parts[d.part].pivotY)]));};
  const initial=anchors(0),origin=initial.get('body');for(const t of [.2,.5,.8,1.2]){const next=anchors(t),body=next.get('body');for(const [key,a]of initial)assert(Math.abs(Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(next.get(key).x-body.x,next.get(key).y-body.y))<1e-8,key+' detached');}
 }
});
