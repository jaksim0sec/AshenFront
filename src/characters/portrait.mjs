import {poseCharacter,transformPoint} from './animation.mjs';

/** High-resolution bust framing independent of the 2.5D battlefield sprite scale. */
const SOURCE_SIZE=240;
const portraitCache=new WeakMap();
function box(draws){
 const corners=[];
 for(const d of draws)for(const [x,y] of [[0,0],[d.w,0],[d.w,d.h],[0,d.h]])corners.push(transformPoint(d.matrix,x,y));
 return {left:Math.min(...corners.map(v=>v.x)),right:Math.max(...corners.map(v=>v.x)),
  top:Math.min(...corners.map(v=>v.y)),bottom:Math.max(...corners.map(v=>v.y))};
}
export function portraitPlacement(profile){
 const pose=poseCharacter(profile,{state:'idle',time:0,facing:1,shootBlend:0});
 const head=box(pose.draws.filter(d=>d.part==='head'||d.part==='hat'));
 const torso=box(pose.draws.filter(d=>d.part==='body'));
 // Make the cap nearly reach the top and the jacket fade at the bottom.
 const span=Math.max(1,torso.bottom-head.top),scale=Math.max(.8,Math.min(1.35,225/span));
 return {scale,x:112-(head.left+head.right)/2*scale,y:9-head.top*scale,
  head,torso,sourceSize:SOURCE_SIZE};
}
export function drawSquadPortrait(canvas,renderer,team,rank){
 if(!renderer.loaded)return false;
 let cached=portraitCache.get(renderer);
 if(!cached||cached.revision!==renderer.revision){
  cached={revision:renderer.revision,sources:new Map()};
  portraitCache.set(renderer,cached);
 }
 const id=team+':'+rank;
 let image=cached.sources.get(id);
 if(!image){
  const profile=renderer.catalog.profiles[id];
  if(!profile)return false;
  image=document.createElement('canvas');image.width=SOURCE_SIZE;image.height=SOURCE_SIZE;
  const p=portraitPlacement(profile),ctx=image.getContext('2d');
  ctx.translate(p.x,p.y);ctx.scale(p.scale,p.scale);
  renderer.drawPose(ctx,profile,{state:'idle',time:0,facing:1,shootBlend:0});
  cached.sources.set(id,image);
 }
 if(canvas.width!==SOURCE_SIZE||canvas.height!==SOURCE_SIZE){canvas.width=SOURCE_SIZE;canvas.height=SOURCE_SIZE;}
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,SOURCE_SIZE,SOURCE_SIZE);ctx.drawImage(image,0,0);
 return true;
}
