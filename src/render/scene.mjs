import {drawCommandOverlay} from './command-overlay.mjs';
import {DEATH_DURATION} from '../characters/animation.mjs';
import {SoldierRenderer,SOLDIER_SCALE} from '../characters/renderer.mjs';
import {palette as P} from './palette.mjs';
import {unitFoot,project,toScreen,HALF_W as W,HALF_H as H} from './projection.mjs';import {TerrainRenderer,visibleBounds,tileFaces,polygon} from './terrain.mjs';import {spatialIndex} from '../sim/spatial.mjs';
const colors={A:P.teamA,B:P.teamB};
export class Scene {
 constructor(canvas){this.canvas=canvas;this.terrain=new TerrainRenderer();this.rendered=0;this.low=false;this.soldiers=new SoldierRenderer();this.soldiers.ready.catch(()=>{});this.shots=new Map();this.hp=new Map();this.hitTicks=new Map();this.muzzles=new Map();this.lastSeen=new Map();this.deathFacings=new Map();this.deathFeet=new Map();this.width=1;this.height=1;}
 resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(this.low?1:2,devicePixelRatio||1);this.width=r.width;this.height=r.height;if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}this.dpr=dpr;}
 draw(w,c,selected,visible,alpha=0,selectedIds=new Set(selected?[selected]:[])) {
  if(this.world!==w){this.world=w;this.shots.clear();this.hp.clear();this.hitTicks.clear();this.muzzles.clear();this.lastSeen.clear();this.deathFacings.clear();this.deathFeet.clear();this.actorFrames=new Map();}
  for(const u of visible.values())this.lastSeen.set(u.id,w.tick);
  if(this.eventTick!==w.tick){this.eventTick=w.tick;for(const e of w.events)if(e.kind==='shot'&&e.unitId)this.shots.set(e.unitId,e);}
  this.resize();const ctx=this.canvas.getContext('2d'),m=w.map;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle=P.background;ctx.fillRect(0,0,this.width,this.height);
  this.terrain.draw(ctx,m,c,this.width,this.height);ctx.save();ctx.translate(c.x,c.y);ctx.scale(c.zoom,c.zoom);
  for(const o of w.objectives){const x=o.center%m.width,y=Math.floor(o.center/m.width),r=o.radius+.5,points=[[x-r,y],[x,y-r],[x+r,y],[x,y+r]].map(([x,y])=>{const p=project(x,y,1);return[p.x,p.y];});polygon(ctx,points,o.contested?'#D1D4D52A':'#D1D4D510');ctx.strokeStyle=o.owner?colors[o.owner]:P.edge;ctx.lineWidth=3;ctx.stroke();}
  for(const post of w.commandPosts??[]){const p=project(post.center%m.width,Math.floor(post.center/m.width),m.floorLevel[post.center]);ctx.strokeStyle=colors[post.team];ctx.lineWidth=4/c.zoom;ctx.strokeRect(p.x-26,p.y-35,52,35);ctx.fillStyle=colors[post.team];ctx.font='bold 22px system-ui';ctx.fillText(post.team+' HQ',p.x-30,p.y-45);}
  drawCommandOverlay(ctx,w,c,selectedIds,alpha);
  const margin=Math.max(40,this.soldiers.margin*c.zoom),b=visibleBounds(m,c,this.width,this.height,margin),index=spatialIndex(w),units=index.query((b.x0+b.x1)/2,(b.y0+b.y1)/2,Math.max(b.x1-b.x0,b.y1-b.y0)/2+8),sprites=[];
  for(const u of units){if(u.team==='B'&&!visible.has(u.id))continue;const h=m.floorLevel[u.y*m.width+u.x],p=unitFoot(m,u,alpha),screen=toScreen(p,c);if(screen.x< -margin||screen.x>this.width+margin||screen.y< -margin||screen.y>this.height+margin)continue;sprites.push({u,p,h});}
  for(const e of w.events.filter(e=>e.kind==='elimination'&&e.unitId&&w.tick-e.tick<DEATH_DURATION*20).slice(-32)){const u=w.units[e.unitId-1];if(u&&(u.team==='A'||w.tick-(this.lastSeen.get(u.id)??-1000)<40)){if(!this.deathFeet.has(u.id))this.deathFeet.set(u.id,project(e.x,e.y,m.floorLevel[e.y*m.width+e.x]));const p=this.deathFeet.get(u.id);sprites.push({u,p,h:m.floorLevel[e.y*m.width+e.x],deathAge:(w.tick-e.tick+alpha)/20});}}
  this.actorFrames=new Map();
  sprites.sort((a,b)=>a.p.y-b.p.y||a.u.id-b.u.id);this.rendered=sprites.length;
  for(const {u,p,h,deathAge} of sprites){const s=w.squads[u.squadId-1],chosen=selectedIds.has(u.squadId);ctx.save();ctx.translate(p.x,p.y);

   if(chosen&&deathAge===undefined){ctx.strokeStyle=P.selection;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,19,10,0,0,Math.PI*2);ctx.stroke();}
   const shot=this.shots.get(u.id),age=shot?(w.tick-shot.tick+alpha)/20:Infinity,target=shot?project(shot.tx,shot.ty,m.floorLevel[shot.ty*m.width+shot.tx]):null,aimVector=target?{x:target.x-p.x,y:target.y-36-p.y}:null;
   const movement=u.moveTo>=0?{x:(u.moveTo%m.width-u.x)-(Math.floor(u.moveTo/m.width)-u.y),y:0}:null;
   let facing=aimVector&&age<1.5?(aimVector.x<0?-1:1):movement?(movement.x<0?-1:1):u.team==='A'?1:-1;
   if(deathAge!==undefined){if(!this.deathFacings.has(u.id))this.deathFacings.set(u.id,facing);facing=this.deathFacings.get(u.id);}
   const rank=u.rank??(u.id===s.unitIds[0]?(w.squads.find(v=>v.team===u.team)?.id===s.id?'captain':'sergeant'):'private');
   const oldHP=this.hp.get(u.id);if(oldHP>u.hp)this.hitTicks.set(u.id,w.tick);this.hp.set(u.id,u.hp);const hurtAge=(w.tick-(this.hitTicks.get(u.id)??-1000)+alpha)/20;
   const state=deathAge!==undefined?'death':age<.08?'shoot':hurtAge<.25?'hit':age<1.5?'shoot':u.moveTo>=0?'walk':'idle';
   const animation={state,moving:u.moveTo>=0,time:deathAge??(state==='hit'?hurtAge:state==='shoot'?age:(w.tick+alpha)/20),facing,aim:aimVector?Math.atan2(aimVector.y,Math.max(.01,Math.abs(aimVector.x))):0,target:state==='shoot'?{x:aimVector.x/SOLDIER_SCALE,y:aimVector.y/SOLDIER_SCALE}:null,phase:u.id%3};
   this.actorFrames.set(u.id,{foot:p,rank,animation});
   ctx.save();let shadowX=0,shadowRadius=14;if(deathAge!==undefined){ctx.globalAlpha=Math.max(0,Math.min(1,(DEATH_DURATION-deathAge)/.35));if(this.soldiers.loaded){const contact=this.soldiers.shadow(u.team,rank,animation,this.low||c.zoom<.5);shadowX=contact.x;shadowRadius=contact.radius;}}ctx.fillStyle='#1D202266';ctx.beginPath();ctx.ellipse(shadowX,0,shadowRadius,deathAge===undefined?7:4,0,0,Math.PI*2);ctx.fill();ctx.restore();
   const animated=this.soldiers.draw(ctx,u.team,rank,animation,this.low||c.zoom<.5);
   if(!animated){ctx.fillStyle=colors[u.team];ctx.fillRect(-8,-32,16,30);}
   if(deathAge===undefined&&c.zoom>=.5&&!this.low){ctx.fillStyle=P.shadow;ctx.fillRect(-12,-84,24,3);ctx.fillStyle=P.edge;ctx.fillRect(-12,-84,24*u.hp/100,3);}
   // A compact front soil lip makes the recessed firing pose readable even
   // when the abstract 22px height is smaller than the 42px tile half-depth.
   // The foot anchor stays at the true H0 surface; this is view-only occlusion.
   if(h===0&&(u.moveTo<0||m.floorLevel[u.moveTo]===0))polygon(ctx,[[-20,-2],[0,-8],[20,-2],[20,8],[0,2],[-20,8]],P.soil);
   if(deathAge===undefined&&s.suppressed){ctx.fillStyle='#efbc6c';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText('!',0,-92);}ctx.restore();
  }
  // Front-facing earth walls obscure the lower silhouette of recessed troops.
  for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++)for(const face of tileFaces(m,y*m.width+x))polygon(ctx,face,P.soil,P.shadow);
  if(!this.low)for(const e of w.events.slice(-64)){
   const age=(w.tick-e.tick+alpha)/20;if(age>.35)continue;
   if(e.kind==='shot'){
    const origin=project(e.x,e.y,m.floorLevel[e.y*m.width+e.x]),target=project(e.tx,e.ty,m.floorLevel[e.ty*m.width+e.tx]);target.y-=36;
    let start=this.muzzles.get(e.eventId);
    if(!start){const u=w.units[e.unitId-1],s=u&&w.squads[u.squadId-1],frame=this.actorFrames.get(u?.id),rank=frame?.rank??u?.rank??(u?.id===s?.unitIds[0]?(w.squads.find(v=>v.team===u.team)?.id===s.id?'captain':'sergeant'):'private'),foot=frame?.foot??(u&&u.hp>0?unitFoot(m,u,alpha):origin),dx=target.x-foot.x,dy=target.y-foot.y;
     const options=frame?.animation??{state:'shoot',time:age,facing:dx<0?-1:1,aim:Math.atan2(dy,Math.max(.01,Math.abs(dx))),target:{x:dx/SOLDIER_SCALE,y:dy/SOLDIER_SCALE}};
     const offset=this.soldiers.loaded?this.soldiers.muzzle(e.team,rank,options,c.zoom<.5):{x:0,y:-35};start={x:foot.x+offset.x,y:foot.y+offset.y};this.muzzles.set(e.eventId,start);if(this.muzzles.size>160)this.muzzles.delete(this.muzzles.keys().next().value);
    }
    const flight=Math.min(1,age/.12),tail=Math.max(0,flight-.22);
    if(age<.13){ctx.strokeStyle=e.hit?'#ede7cc':'#c0c6c580';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(start.x+(target.x-start.x)*tail,start.y+(target.y-start.y)*tail);ctx.lineTo(start.x+(target.x-start.x)*flight,start.y+(target.y-start.y)*flight);ctx.stroke();}
    if(age>=.12&&e.hit){const t=(age-.12)/.23;ctx.globalAlpha=1-t;ctx.strokeStyle='#bbb8ab';ctx.lineWidth=1.5;for(let n=0;n<4;n++){const angle=e.eventId*2.4+n*1.7;ctx.beginPath();ctx.moveTo(target.x+Math.cos(angle)*t*7,target.y+Math.sin(angle)*t*7);ctx.lineTo(target.x+Math.cos(angle)*t*15,target.y+Math.sin(angle)*t*15+t*t*5);ctx.stroke();}ctx.globalAlpha=1;}
   }
   if(e.kind==='impact'){const p=project(e.x,e.y,1);ctx.strokeStyle=P.edge;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p.x,p.y,3*W,3*H,0,0,Math.PI*2);ctx.stroke();}
  }

  ctx.restore();
  for(const o of w.objectives){const p=toScreen(project(o.center%m.width,Math.floor(o.center/m.width),1),c);ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle=P.text;ctx.fillText('◎ '+(w.objectives.length===1?'중앙':['북부','중앙','남부'][o.id-1]),p.x,p.y-20);}
 }
}
export class Overview {
 constructor(canvas){this.canvas=canvas;this.background=null;this.map=null;this.lastKnown=new Map();}
 draw(w,c,width,height,visible){const ctx=this.canvas.getContext('2d'),m=w.map,cw=this.canvas.width,ch=this.canvas.height,sx=cw/m.width,sy=ch/m.height;
  if(this.map!==m){this.map=m;this.lastKnown.clear();this.background=document.createElement('canvas');this.background.width=cw;this.background.height=ch;const t=this.background.getContext('2d');for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const i=y*m.width+x;t.fillStyle=m.blocked[i]?P.shadow:[P.trench,P.field,P.ridge][m.floorLevel[i]];t.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));}}
  ctx.drawImage(this.background,0,0);for(const u of visible.values())this.lastKnown.set(u.id,{x:u.x,y:u.y,tick:w.tick});
  for(const [id,p] of this.lastKnown){if(w.tick-p.tick>300){this.lastKnown.delete(id);continue;}ctx.globalAlpha=w.tick-p.tick<10?1:.35;ctx.fillStyle=colors.B;ctx.fillRect(p.x*sx-1,p.y*sy-1,3,3);}ctx.globalAlpha=1;
  for(const s of w.squads)if(s.team==='A'){const living=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0);if(!living.length)continue;const x=living.reduce((a,u)=>a+u.x,0)/living.length,y=living.reduce((a,u)=>a+u.y,0)/living.length;ctx.fillStyle=colors.A;ctx.fillRect(x*sx-2,y*sy-2,5,5);}
  for(const o of w.objectives){ctx.strokeStyle=o.owner?colors[o.owner]:P.edge;ctx.lineWidth=2;ctx.strokeRect((o.center%m.width)*sx-4,Math.floor(o.center/m.width)*sy-4,8,8);}
  const b=visibleBounds(m,c,width,height,0);ctx.strokeStyle='#ffffff99';ctx.lineWidth=1;ctx.strokeRect(b.x0*sx,b.y0*sy,(b.x1-b.x0)*sx,(b.y1-b.y0)*sy);
 }
}
