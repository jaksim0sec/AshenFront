import {project} from './model.mjs';

/** Render-only FlowerWars battle visuals, using the nation's actual approved assets. */
const ROOT=new URL('../../',import.meta.url);
export const FLAG_IMAGES=Object.fromEntries(['A','B'].map((team)=>{
 const image=typeof Image==='undefined'?{complete:false,naturalWidth:0}:new Image();
 if(typeof Image!=='undefined')image.src=new URL(team==='A'?'assets/factions/arken/flag.webp':'assets/factions/velian/flag.webp',ROOT).href;
 return [team,image];
}));
export function drawHeadquarters(ctx,flags,time){
 for(const flag of Object.values(flags)){
  const p=project(flag.x,flag.y),image=FLAG_IMAGES[flag.team],alive=flag.health.current>0;
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='#151a1ba8';ctx.beginPath();ctx.ellipse(0,3,48,18,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3b4140';ctx.beginPath();ctx.moveTo(-39,1);ctx.lineTo(0,-18);ctx.lineTo(39,1);ctx.lineTo(0,19);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#1e2425';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-12,1);ctx.lineTo(-12,-114);ctx.stroke();
  ctx.strokeStyle='#b9ad95';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(-13,-114);ctx.stroke();
  ctx.fillStyle='#d0c1a3';ctx.beginPath();ctx.arc(-13,-118,5,0,Math.PI*2);ctx.fill();
  if(alive&&image.complete&&image.naturalWidth){
   const height=62,width=Math.min(97,height*image.naturalWidth/image.naturalHeight);
   ctx.save();ctx.translate(-11,-111);ctx.rotate(Math.sin(time*1.5+(flag.team==='A'?0:1.7))*.018);
   ctx.drawImage(image,0,0,width,height);ctx.restore();
  }else if(alive){ctx.fillStyle=flag.team==='A'?'#94b6ce':'#bd8175';ctx.fillRect(-10,-111,76,49);}
  if(!alive){ctx.strokeStyle='#a99681';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-12,-14);ctx.lineTo(43,-23);ctx.stroke();}
  // Objective health is displayed at its flag, never above ordinary soldiers.
  const fraction=Math.max(0,flag.health.current/flag.health.max);
  ctx.fillStyle='#171d20dd';ctx.fillRect(-40,23,80,5);
  ctx.fillStyle=flag.team==='A'?'#9ebdd3':'#bd8c7e';ctx.fillRect(-40,23,80*fraction,5);
  ctx.restore();
 }
}

/** Short muzzle flash and tracer at the source impact frame; no white bubble particles. */
export function drawBattleEffects(ctx,board){
 for(const unit of board.units){
  if(unit.state!=='attack'||!unit.strike||!unit.impacted||unit.strike.healing)continue;
  const age=unit.elapsed-unit.strike.impactTime;
  if(age<0||age>.13)continue;
  const target=board.unit(unit.strike.target);
  if(!target)continue;
  const a=project(unit.visualX,unit.visualY),b=project(target.visualX,target.visualY),dx=b.x-a.x,dy=b.y-a.y;
  const len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  const start={x:a.x+ux*18,y:a.y-40+uy*18},end={x:b.x-ux*13,y:b.y-37-uy*13};
  const alpha=1-age/.13;
  ctx.save();ctx.globalAlpha=alpha;
  const gradient=ctx.createLinearGradient(start.x,start.y,end.x,end.y);
  gradient.addColorStop(0,'#f5e3ab');gradient.addColorStop(.12,'#edddae9e');gradient.addColorStop(1,'#e9d5b333');
  ctx.strokeStyle=gradient;ctx.lineWidth=2.1;
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
  ctx.fillStyle='#ffdfa4';ctx.beginPath();ctx.moveTo(start.x,start.y);
  ctx.lineTo(start.x-ux*10-uy*6,start.y-uy*10+ux*6);
  ctx.lineTo(start.x-ux*4+uy*3,start.y-uy*4-ux*3);ctx.closePath();ctx.fill();
  ctx.restore();
 }
 for(const hit of board.effects){
  if(hit.healing||hit.age>.4)continue;
  const p=project(hit.x,hit.y),alpha=1-hit.age/.4;
  // Ground dust and a few directional splinters. No circles, no explosive rings.
  ctx.save();ctx.globalAlpha=alpha*.75;ctx.strokeStyle='#a39d90';ctx.lineWidth=1.7;
  for(let i=0;i<3;i++){
   const dir=((Math.imul(Math.floor(hit.x*7+hit.y*11)+i,123457)>>>0)%9)-4;
   const x=p.x+dir*3+hit.age*dir*12,y=p.y-12-i*7-hit.age*30;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dir*.65,y-4-hit.age*5);ctx.stroke();
  }
  ctx.restore();
 }
}
