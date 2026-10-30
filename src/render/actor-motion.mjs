import {project} from './projection.mjs';
import {SOLDIER_SCALE} from '../characters/renderer.mjs';
/** Resolve locomotion/facing once. Old shots cannot override walking or restart after a move. */
export class ActorMotion {
 constructor(){this.actors=new Map();}
 clear(){this.actors.clear();}
 sample(w,u,{foot,shot,alpha=0,hurtAge=Infinity,deathAge}={}){
  let v=this.actors.get(u.id);if(!v){v={facing:u.team==='A'?1:-1,lastMoveTick:-Infinity};this.actors.set(u.id,v);}
  const moving=u.moveTo>=0&&deathAge===undefined,age=shot?(w.tick-shot.tick+alpha)/20:Infinity;
  const target=shot?project(shot.tx,shot.ty,w.map.floorLevel[shot.ty*w.map.width+shot.tx]):null;
  const vector=target?{x:target.x-foot.x,y:target.y-36-foot.y}:null;
  if(moving){const next=project(u.moveTo%w.map.width,Math.floor(u.moveTo/w.map.width),w.map.floorLevel[u.moveTo]),start=project(u.x,u.y,w.map.floorLevel[u.y*w.map.width+u.x]);if(Math.abs(next.x-start.x)>.001)v.facing=next.x<start.x?-1:1;v.lastMoveTick=w.tick;}
  const shooting=!moving&&shot&&shot.tick>=v.lastMoveTick&&age<1.5;
  if(deathAge===undefined&&shooting&&Math.abs(vector.x)>.001)v.facing=vector.x<0?-1:1;
  const state=deathAge!==undefined?'death':moving?'walk':shooting&&age<.08?'shoot':hurtAge<.25?'hit':shooting?'shoot':'idle';
  return {state,moving,facing:v.facing,time:deathAge??(state==='hit'?hurtAge:state==='shoot'?age:(w.tick+alpha)/20),gaitTime:(w.tick+alpha)/20,aim:vector?Math.atan2(vector.y,Math.max(.01,Math.abs(vector.x))):0,target:state==='shoot'?{x:vector.x/SOLDIER_SCALE,y:vector.y/SOLDIER_SCALE}:null,phase:u.id%3};
 }
}
