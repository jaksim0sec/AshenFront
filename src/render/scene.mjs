import {unitFoot,project,toScreen,HALF_W as W,HALF_H as H} from './projection.mjs';import {TerrainRenderer,visibleBounds,tileFaces,polygon} from './terrain.mjs';import {SpatialIndex} from '../sim/spatial.mjs';
const colors={A:'#9bc6dd',B:'#d1b079'};
export class Scene {
 constructor(canvas){this.canvas=canvas;this.terrain=new TerrainRenderer();this.rendered=0;this.low=false;this.width=1;this.height=1;}
 resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(this.low?1:2,devicePixelRatio||1);this.width=r.width;this.height=r.height;if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}this.dpr=dpr;}
 draw(w,c,selected,visible,alpha=0) {
  this.resize();const ctx=this.canvas.getContext('2d'),m=w.map;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle='#252e25';ctx.fillRect(0,0,this.width,this.height);
  this.terrain.draw(ctx,m,c,this.width,this.height);ctx.save();ctx.translate(c.x,c.y);ctx.scale(c.zoom,c.zoom);
  for(const o of w.objectives){const x=o.center%m.width,y=Math.floor(o.center/m.width),r=o.radius+.5,points=[[x-r,y],[x,y-r],[x+r,y],[x,y+r]].map(([x,y])=>{const p=project(x,y,1);return[p.x,p.y];});polygon(ctx,points,o.contested?'#d3aa422a':o.owner==='A'?'#88c5df24':o.owner==='B'?'#d0aa7724':'#f2e7a216');ctx.strokeStyle=o.owner?colors[o.owner]:'#e0d294';ctx.lineWidth=3;ctx.stroke();}
  const selection=w.squads[selected-1];
  if(selection?.goal!==null&&selection?.goal!==undefined){
   const g=selection.goal,p=project(g%m.width,Math.floor(g/m.width),m.floorLevel[g]);
   ctx.strokeStyle='#D1D4D5';ctx.lineWidth=2/c.zoom;ctx.setLineDash([5/c.zoom,4/c.zoom]);
   polygon(ctx,[[p.x,p.y-H],[p.x+W,p.y],[p.x,p.y+H],[p.x-W,p.y]],null,'#D1D4D5');
   for(const i of Object.values(selection.slots??{})){const q=project(i%m.width,Math.floor(i/m.width),m.floorLevel[i]);ctx.strokeRect(q.x-9,q.y-5,18,10);}
   const live=selection.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0);if(live.length){const a=unitFoot(m,live[0],alpha);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(p.x,p.y);ctx.stroke();}
   ctx.setLineDash([]);ctx.fillStyle='#D1D4D5';ctx.font='18px system-ui';ctx.fillText(`H${m.floorLevel[g]} · #${selection.orderId}`,p.x,p.y-H-8);
  }
  const b=visibleBounds(m,c,this.width,this.height,60),index=new SpatialIndex(w.units),units=index.query((b.x0+b.x1)/2,(b.y0+b.y1)/2,Math.max(b.x1-b.x0,b.y1-b.y0)/2+8),sprites=[];
  for(const u of units){if(u.team==='B'&&!visible.has(u.id))continue;const h=m.floorLevel[u.y*m.width+u.x],p=unitFoot(m,u,alpha),screen=toScreen(p,c);if(screen.x<-30||screen.x>this.width+30||screen.y<-40||screen.y>this.height+45)continue;sprites.push({u,p,h});}
  sprites.sort((a,b)=>a.p.y-b.p.y||a.u.id-b.u.id);this.rendered=sprites.length;
  for(const {u,p,h} of sprites){const s=w.squads[u.squadId-1],chosen=u.squadId===selected;ctx.save();ctx.translate(p.x,p.y);
   ctx.fillStyle='#171e1a66';ctx.beginPath();ctx.ellipse(0,1,14,7,0,0,Math.PI*2);ctx.fill();
   if(chosen){ctx.strokeStyle='#f6dfa3';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,19,10,0,0,Math.PI*2);ctx.stroke();}
   ctx.fillStyle=colors[u.team];ctx.strokeStyle='#1c2a25';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-9,-26,18,25,5);ctx.fill();ctx.stroke();ctx.fillStyle=u.team==='A'?'#c2dae0':'#d5c59e';ctx.beginPath();ctx.arc(0,-31,8,0,Math.PI*2);ctx.fill();ctx.stroke();
   if(c.zoom>=.5&&!this.low){ctx.fillStyle='#202b22';ctx.fillRect(-12,-46,24,3);ctx.fillStyle='#b8cc8c';ctx.fillRect(-12,-46,24*u.hp/100,3);}
   // A compact front soil lip makes the recessed firing pose readable even
   // when the abstract 22px height is smaller than the 42px tile half-depth.
   // The foot anchor stays at the true H0 surface; this is view-only occlusion.
   if(h===0&&(u.moveTo<0||m.floorLevel[u.moveTo]===0))polygon(ctx,[[-20,-2],[0,-8],[20,-2],[20,8],[0,2],[-20,8]],'#514333');
   if(s.suppressed){ctx.fillStyle='#efbc6c';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText('!',0,-52);}ctx.restore();
  }
  // Front-facing earth walls obscure the lower silhouette of recessed troops.
  for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++)for(const face of tileFaces(m,y*m.width+x))polygon(ctx,face,'#514333','#302d25');
  if(!this.low)for(const e of w.events){if(w.tick-e.tick>5)continue;if(e.kind==='shot'){const a=project(e.x,e.y,m.floorLevel[e.y*m.width+e.x]),b=project(e.tx,e.ty,m.floorLevel[e.ty*m.width+e.tx]);ctx.strokeStyle=e.hit?'#f1d49a9c':'#eee3b92b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y-25);ctx.lineTo(b.x,b.y-20);ctx.stroke();}if(e.kind==='impact'){const p=project(e.x,e.y,1);ctx.strokeStyle='#e4ba78';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p.x,p.y,3*W,3*H,0,0,Math.PI*2);ctx.stroke();}}
  ctx.restore();
  for(const o of w.objectives){const p=toScreen(project(o.center%m.width,Math.floor(o.center/m.width),1),c);ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#eee8cc';ctx.fillText('◎ '+(w.objectives.length===1?'중앙':['북부','중앙','남부'][o.id-1]),p.x,p.y-20);}
 }
}
export class Overview {
 constructor(canvas){this.canvas=canvas;this.background=null;this.map=null;this.lastKnown=new Map();}
 draw(w,c,width,height,visible){const ctx=this.canvas.getContext('2d'),m=w.map,cw=this.canvas.width,ch=this.canvas.height,sx=cw/m.width,sy=ch/m.height;
  if(this.map!==m){this.map=m;this.lastKnown.clear();this.background=document.createElement('canvas');this.background.width=cw;this.background.height=ch;const t=this.background.getContext('2d');for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const i=y*m.width+x;t.fillStyle=m.blocked[i]?'#28352a':['#3b5144','#777751','#b4a97b'][m.floorLevel[i]];t.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));}}
  ctx.drawImage(this.background,0,0);for(const u of visible.values())this.lastKnown.set(u.id,{x:u.x,y:u.y,tick:w.tick});
  for(const [id,p] of this.lastKnown){if(w.tick-p.tick>300){this.lastKnown.delete(id);continue;}ctx.globalAlpha=w.tick-p.tick<10?1:.35;ctx.fillStyle=colors.B;ctx.fillRect(p.x*sx-1,p.y*sy-1,3,3);}ctx.globalAlpha=1;
  for(const s of w.squads)if(s.team==='A'){const living=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0);if(!living.length)continue;const x=living.reduce((a,u)=>a+u.x,0)/living.length,y=living.reduce((a,u)=>a+u.y,0)/living.length;ctx.fillStyle=colors.A;ctx.fillRect(x*sx-2,y*sy-2,5,5);}
  for(const o of w.objectives){ctx.strokeStyle=o.owner?colors[o.owner]:'#f7e7ab';ctx.lineWidth=2;ctx.strokeRect((o.center%m.width)*sx-4,Math.floor(o.center/m.width)*sy-4,8,8);}
  const b=visibleBounds(m,c,width,height,0);ctx.strokeStyle='#ffffff99';ctx.lineWidth=1;ctx.strokeRect(b.x0*sx,b.y0*sy,(b.x1-b.x0)*sx,(b.y1-b.y0)*sy);
 }
}
