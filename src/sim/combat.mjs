import {cell,random} from './world.mjs';import {spatialIndex} from './spatial.mjs';import {emit} from './state.mjs';
// Symmetric supercover rasterization: at corner crossings both adjacent cells count.
export function sightCells(a,b) {
 let x=a.x,y=a.y,ix=0,iy=0;const nx=Math.abs(b.x-x),ny=Math.abs(b.y-y),sx=Math.sign(b.x-x),sy=Math.sign(b.y-y),out=[];
 while(ix<nx||iy<ny){const d=(1+2*ix)*ny-(1+2*iy)*nx;
  if(d===0){out.push({x:x+sx,y},{x,y:y+sy});x+=sx;y+=sy;ix++;iy++;}
  else if(d<0){x+=sx;ix++;}else{y+=sy;iy++;}out.push({x,y});
 }return out;
}
export function lineOfSight(m,a,b) {
 const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;if(d2>81)return false;if(!d2)return true;
 const eye=h=>h===0?1.55:h+.7,az=eye(m.floorLevel[cell(m,a.x,a.y)]),bz=eye(m.floorLevel[cell(m,b.x,b.y)]);
 for(const p of sightCells(a,b)) {
  if((p.x===a.x&&p.y===a.y)||(p.x===b.x&&p.y===b.y))continue;
  const i=cell(m,p.x,p.y),t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d2));
  if(m.blocked[i]||m.floorLevel[i]+.2>az+(bz-az)*t+1e-9)return false;
 }return true;
}
export function coverMultiplier(m,attacker,target) {
 const i=cell(m,target.x,target.y),dx=attacker.x-target.x,dy=attacker.y-target.y,bit=Math.abs(dx)>=Math.abs(dy)?dx>=0?2:8:dy>=0?4:1;
 if(!(m.coverMask[i]&bit)||!m.coverCondition[i])return 1;
 const base=m.terrainKind[i]===1?.5:m.terrainKind[i]===2?.75:1;
 return 1-(1-base)*Math.min(1,m.coverCondition[i]/50);
}
export function damage(w,u,amount) {
 if(u.hp<=0)return;u.hp=Math.max(0,u.hp-amount);if(u.hp>0)return;
 const i=cell(w.map,u.x,u.y);if(w.map.occupancy[i]===u.id)w.map.occupancy[i]=0;
 if(u.moveTo>=0&&w.map.reservation[u.moveTo]===u.id)w.map.reservation[u.moveTo]=0;
 w.spatialRevision=(w.spatialRevision??0)+1;u.moveTo=-1;u.moveProgress=0;u.detour=null;emit(w,{kind:'elimination',unitId:u.id,x:u.x,y:u.y,team:u.team});
}
export function resolveFire(w) {
 if(!w.combat)return;const index=spatialIndex(w),shots=[];
 for(const u of w.units) {
  if(u.hp<=0||u.moveTo>=0||w.tick<u.nextFireTick)continue;
  w.metrics.queries++;const candidates=index.query(u.x,u.y,9).filter(v=>v.team!==u.team&&v.hp>0).map(v=>({v,d:(v.x-u.x)**2+(v.y-u.y)**2})).filter(o=>o.d<=81);
  const ownSquad=w.squads[u.squadId-1],focused=v=>ownSquad.order==='attack'&&(ownSquad.targetUnitId!=null?v.id===ownSquad.targetUnitId:v.squadId===ownSquad.targetSquadId);
  candidates.sort((a,b)=>Number(focused(b.v))-Number(focused(a.v))||a.d-b.d||a.v.id-b.v.id);let choice;
  for(const c of candidates){w.metrics.losChecks++;if(lineOfSight(w.map,u,c.v)){choice=c;break;}}
  // Recheck an empty field cheaply; full firing cooldown starts on an actual shot.
  u.nextFireTick=w.tick+(choice?30:10);if(!choice)continue;
  const target=choice.v,s=w.squads[target.squadId-1];s.suppression=Math.min(100,s.suppression+2);s.lastThreatTick=w.tick;
  const chance=Math.max(.22,Math.min(.55,.55-.035*Math.max(0,Math.sqrt(choice.d)-3))),hit=random(w)<chance;
  shots.push({target,amount:hit?20*coverMultiplier(w.map,u,target):0});w.metrics.shots++;
  u.fireUntilTick=w.tick+3;emit(w,{kind:'shot',unitId:u.id,x:u.x,y:u.y,tx:target.x,ty:target.y,team:u.team,hit});
 }
 // All eligible shooters evaluate from the same pre-damage state.
 for(const shot of shots)if(shot.amount)damage(w,shot.target,shot.amount);
}
export function visibleEnemies(w,team) {
 const index=spatialIndex(w),seen=new Map();
 for(const u of w.units)if(u.hp>0&&u.team===team)for(const v of index.query(u.x,u.y,9))if(v.team!==team&&!seen.has(v.id)&&lineOfSight(w.map,u,v))seen.set(v.id,v);
 return [...seen.values()];
}
