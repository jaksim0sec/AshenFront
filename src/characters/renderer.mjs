import {createCatalog,importCatalog,STORAGE_KEY,profileId,migratePhysique} from './model.mjs';
import {poseBounds,poseCharacter,transformPoint,DEATH_DURATION,contactShadow} from './animation.mjs';
const ROOT=new URL('../../',import.meta.url);
export const SOLDIER_SCALE=.285;
/** Distant soldiers normally skip walk cycles. Never skip an actual ascent. */
export function distantPoseState(state,{rising=false,shot=false,hitNow=false}={}){
 return rising?'walk':shot?'shoot':state==='guard'?'guard':hitNow?'hit':'idle';
}
export function sampleAnimation(options={},low=false){
 const state=options.state??'idle',fps=low?6:state==='shoot'?30:state==='walk'?30:state==='guard'?30:24,time=Math.max(0,(options.time??0)+(state==='walk'?(options.phase??0)/10:(state==='idle'||state==='guard')?(options.phase??0)/2.6:0)),duration=state==='shoot'?1.5:state==='walk'?Math.PI*2/10:Math.PI*2/2.6,count=Math.max(2,Math.round(duration*fps)),index=Math.floor(((time%duration)/duration)*count);
 const sample=state==='hit'||state==='death'?Math.min(Math.floor(time*fps)/fps,state==='death'?DEATH_DURATION:1.4):index/count*duration;
 const gaitPeriod=Math.PI*2/10,gaitCount=Math.max(2,Math.round(gaitPeriod*fps)),gaitTime=options.gaitTime===undefined||!(options.moving||state==='walk'||(options.walkBlend??0)>0.001)?undefined:Math.floor((((Math.max(0,options.gaitTime)+(options.phase??0)/10)%gaitPeriod)/gaitPeriod)*gaitCount)/gaitCount*gaitPeriod;
 return {...options,state,time:sample,gaitTime,
  lookBlend:low?0:Math.round(Math.max(-1,Math.min(1,options.lookBlend??0))*6)/6,
  riseProgress:options.riseProgress==null?null:Math.round(Math.max(0,Math.min(1,options.riseProgress))*(low?6:12))/(low?6:12),
  aim:state==='shoot'?(options.aim??0):Math.round((options.aim??0)*8)/8,shootBlend:Math.round(Math.max(0,Math.min(1,options.shootBlend??(state==='shoot'?1:state==='guard'?.6:0)))*30)/30,hitReaction:Math.round(Math.max(0,Math.min(1,options.hitReaction??0))*4)/4,crouchBlend:Math.round(Math.max(0,Math.min(1,options.crouchBlend??0))*12)/12,climbBlend:Math.round(Math.max(-1,Math.min(1,options.climbBlend??0))*6)/6,walkBlend:Math.round(Math.max(0,Math.min(1,options.walkBlend??(state==='walk'?1:0)))*16)/16,phase:0};
}
export class SoldierRenderer {
 constructor(){this.catalog=createCatalog();this.images=new Map();this.metadata={};this.cache=new Map();this.cacheBytes=0;this.hits=0;this.misses=0;this.loaded=false;this.error=null;this.revision=0;this.margin=140;
  this.ready=this.load();this.onStorage=e=>{if(e.key===STORAGE_KEY){try{this.setCatalog(e.newValue?migratePhysique(importCatalog(e.newValue)):structuredClone(this.defaultCatalog??createCatalog()));}catch{}}};addEventListener('storage',this.onStorage);
 }
 async load(){try{
  const response=await fetch(new URL('assets/soldiers/manifest.json',ROOT));if(!response.ok)throw Error('Soldier manifest: '+response.status);const manifest=await response.json();this.metadata=manifest.assets;
  this.metadata['rifle-placeholder']={path:'assets/soldiers/rifle-placeholder.svg',crop:[0,0,160,40]};
  await Promise.all(Object.entries(this.metadata).map(async([id,meta])=>{const im=new Image();im.src=new URL(meta.path,ROOT).href;await im.decode();this.images.set(id,im);}));
  const defaults=await fetch(new URL('assets/soldiers/catalog.json',ROOT));if(defaults.ok)this.setCatalog(importCatalog(await defaults.json()));
  try{this.defaultCatalog=structuredClone(this.catalog);const saved=localStorage.getItem(STORAGE_KEY);if(saved)this.setCatalog(migratePhysique(importCatalog(saved)));}catch{}
  this.loaded=true;return this;
 }catch(e){this.error=e.message;throw e;}}
 setCatalog(c){this.catalog=importCatalog(c);this.revision++;this.cache.clear();this.cacheBytes=0;this.margin=Math.max(100,...Object.values(this.catalog.profiles).flatMap(p=>Object.values(p.parts).filter(p=>p.visible).map(p=>Math.hypot(Math.abs(p.x)+2*p.w*p.scaleX,Math.abs(p.y)+2*p.h*p.scaleY)*.285)));}
 drawPose(ctx,profile,options={}, {selectedPart=null,guides=false,computedPose=null}={}){
  const pose=computedPose??poseCharacter(profile,options);ctx.save();ctx.globalAlpha*=pose.alpha;
  for(const d of pose.draws){const im=this.images.get(d.asset),meta=this.metadata[d.asset];if(!im||!meta)continue;
   const [sx,sy,ex,ey]=meta.crop,m=d.matrix;ctx.save();ctx.transform(...m);
   if(d.clip?.capsule){const [ax,ay,bx,by,r]=d.clip.capsule;ctx.save();ctx.translate(ax,ay);ctx.rotate(Math.atan2(by-ay,bx-ax));ctx.beginPath();ctx.roundRect(-r,-r,Math.hypot(bx-ax,by-ay)+r*2,r*2,r);ctx.restore();ctx.clip();}
   else if(d.clip){const[x,y,w,h]=d.clip;ctx.beginPath();ctx.rect(x*d.w,y*d.h,w*d.w,h*d.h);ctx.clip();}
   ctx.drawImage(im,sx,sy,ex-sx,ey-sy,0,0,d.w,d.h);
   if(selectedPart===d.part){ctx.strokeStyle='#75d2e8';ctx.lineWidth=1.5;ctx.strokeRect(0,0,d.w,d.h);}ctx.restore();
  }
  if(pose.flash>0){const m=pose.rifle.matrix;ctx.save();ctx.transform(...m);ctx.scale(profile.parts.rifle.w/160,profile.parts.rifle.h/40);ctx.globalAlpha*=pose.flash;ctx.fillStyle='#f8e7ad';ctx.beginPath();ctx.moveTo(154,13);ctx.lineTo(169,7);ctx.lineTo(164,12);ctx.lineTo(177,14);ctx.lineTo(165,17);ctx.lineTo(169,22);ctx.lineTo(154,15);ctx.fill();ctx.restore();}
  if(pose.casing!==null){const p=pose.casing,anchor=transformPoint(pose.rifle.matrix,profile.parts.rifle.w*65/160,profile.parts.rifle.h*10/40);ctx.save();ctx.translate(anchor.x-p*30,anchor.y-Math.sin(p*Math.PI)*30+p*p*12);ctx.rotate(p*14);ctx.fillStyle='#b7a677';ctx.fillRect(-3,-1,6,2);ctx.restore();}
  if(guides){ctx.strokeStyle='#e8a56f';ctx.lineWidth=1;for(const hand of Object.values(pose.hands)){ctx.beginPath();ctx.moveTo(hand.x-3,hand.y);ctx.lineTo(hand.x+3,hand.y);ctx.moveTo(hand.x,hand.y-3);ctx.lineTo(hand.x,hand.y+3);ctx.stroke();}}
  ctx.restore();return pose;
 }
 draw(ctx,team,rank,options={},low=false){
  if(!this.loaded)return false;const id=profileId(team,rank),profile=this.catalog.profiles[id],sampled=sampleAnimation(options,low),{state,time:sample,aim,phase}=sampled;
  // Cached sprites face right. Reflect a world-relative target into that same frame.
  if(sampled.target)sampled.target={x:sampled.target.x*(options.facing<0?-1:1),y:sampled.target.y};
  // Cache at the effective screen size; world sprites are only 0.285x before camera zoom.
  // Keeping a 0.57x offscreen bitmap at mobile zoom wastes ~9x raster area.
  const density=Number.isFinite(options.pixelDensity)?Math.max(.16,Math.min(.57,options.pixelDensity)):.57;
  const resolutionBucket=Math.round(density*100)/100;
  const key=[this.revision,id,state,sample,aim,phase,!!options.moving,low,resolutionBucket,sampled.fireAt??0,sampled.shootBlend,sampled.hitReaction,sampled.walkBlend,sampled.crouchBlend,sampled.climbBlend,sampled.riseProgress??'',sampled.lookBlend,sampled.gaitTime??'',sampled.target?.x??'',sampled.target?.y??''].join(':');let canvas=this.cache.get(key);
  if(canvas){this.hits++;this.cache.delete(key);this.cache.set(key,canvas);}
  if(!canvas){this.misses++;
   const poseOptions={...sampled,facing:1},articulated=poseCharacter(profile,poseOptions),bounds=poseBounds(articulated),resolution=Math.min(resolutionBucket,384/Math.max(bounds.width,bounds.height));
   const bitmap=document.createElement('canvas');bitmap.width=Math.min(384,Math.max(1,Math.ceil(bounds.width*resolution)));bitmap.height=Math.min(384,Math.max(1,Math.ceil(bounds.height*resolution)));const c=bitmap.getContext('2d');c.scale(resolution,resolution);c.translate(-bounds.left,-bounds.top);this.drawPose(c,profile,poseOptions,{computedPose:articulated});
   const muzzle={x:articulated.rifle.muzzle.x*SOLDIER_SCALE,y:articulated.rifle.muzzle.y*SOLDIER_SCALE};
   const bytes=bitmap.width*bitmap.height*4;canvas={bitmap,bounds,bytes,resolution,muzzle};
   while(this.cache.size&&(this.cache.size>=256||this.cacheBytes+bytes>16*1024*1024)){const oldest=this.cache.keys().next().value;this.cacheBytes-=this.cache.get(oldest).bytes;this.cache.delete(oldest);}
   this.cache.set(key,canvas);this.cacheBytes+=bytes;
  }
  const {bounds}=canvas;
  if(options.muzzleOut){options.muzzleOut.x=(options.facing<0?-1:1)*canvas.muzzle.x;options.muzzleOut.y=canvas.muzzle.y;options.muzzleOut.valid=true;}
  ctx.save();if(options.facing<0)ctx.scale(-1,1);ctx.drawImage(canvas.bitmap,bounds.left*SOLDIER_SCALE,bounds.top*SOLDIER_SCALE,canvas.bitmap.width/canvas.resolution*SOLDIER_SCALE,canvas.bitmap.height/canvas.resolution*SOLDIER_SCALE);ctx.restore();return true;

 }
 shadow(team,rank,options,low=false){const s=contactShadow(poseCharacter(this.catalog.profiles[profileId(team,rank)],sampleAnimation(options,low)));return{x:s.x*SOLDIER_SCALE,radius:s.radius*SOLDIER_SCALE};}
 muzzle(team,rank,options,low=false){const p=poseCharacter(this.catalog.profiles[profileId(team,rank)],sampleAnimation(options,low)).rifle.muzzle;return {x:p.x*SOLDIER_SCALE,y:p.y*SOLDIER_SCALE};}
 get stats(){return {loaded:this.loaded,images:this.images.size,cachedFrames:this.cache.size,hits:this.hits,misses:this.misses,cacheBytes:this.cacheBytes,error:this.error};}
 dispose(){removeEventListener('storage',this.onStorage);this.cache.clear();this.cacheBytes=0;}
}
