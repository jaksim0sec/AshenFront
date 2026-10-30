import {allocateSlots} from './orders.mjs';
import {cell} from './world.mjs';
import {visibleEnemies,lineOfSight} from './combat.mjs';

export const livingMembers=(w,s)=>s.unitIds.map(id=>w.units[id-1]).filter(u=>u?.hp>0);
export function squadCenter(w,s){
 const units=livingMembers(w,s);
 return {x:Math.round(units.reduce((n,u)=>n+u.x,0)/units.length),y:Math.round(units.reduce((n,u)=>n+u.y,0)/units.length)};
}
export function nearestOpenCell(w,p,radius=4){
 const m=w.map,candidates=[];
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const x=p.x+dx,y=p.y+dy;if(x<0||x>=m.width||y<0||y>=m.height||Math.abs(dx)+Math.abs(dy)>radius)continue;
  const i=cell(m,x,y);if(!m.blocked[i])candidates.push({i,d:Math.abs(dx)+Math.abs(dy)});
 }
 candidates.sort((a,b)=>a.d-b.d||a.i-b.i);return candidates[0]?.i??null;
}
export function selectedEnemies(w,s,selector,visible=visibleEnemies(w,s.team)){
 return visible.filter(u=>u.hp>0&&u.team!==s.team&&(selector.targetUnitId!=null?u.id===selector.targetUnitId:u.squadId===selector.targetSquadId));
}
export function resetTravel(w,s){
 for(const u of livingMembers(w,s)){u.detour=null;u.yieldFor=null;u.wait=0;u.preciseSlot=null;}
}
export function setDestination(w,s,target,{force=false}={}){
 if(!force&&s.goal===target)return;
 s.goal=target;s.slots={};s.reached=false;s.arrivedCount=0;s.movementBlockedReason=null;s.reason=null;s.status='planning';
 s.targetElevation=target===null?null:w.map.floorLevel[target];
 resetTravel(w,s);
 if(target!==null){if(s.placement==='formation')s.slots=allocateSlots(w,s,target);s.slotFieldLimit=Math.max(8,...Object.values(s.slots).map(i=>Math.abs(i%w.map.width-target%w.map.width)+Math.abs(Math.floor(i/w.map.width)-Math.floor(target/w.map.width))+s.radius));w.navigation.field(target,s.radius);}
 w.navigation.prune(w.squads);
}
export function flankWaypoints(w,s,target,visible=visibleEnemies(w,s.team)){
 const m=w.map,start=squadCenter(w,s),end={x:target%m.width,y:Math.floor(target/m.width)},horizontal=Math.abs(end.x-start.x)>=Math.abs(end.y-start.y),candidates=[];
 for(const sign of [-1,1]){
  const shift=p=>({x:Math.max(0,Math.min(m.width-1,p.x+(horizontal?0:sign*6))),y:Math.max(0,Math.min(m.height-1,p.y+(horizontal?sign*6:0)))});
  const first=nearestOpenCell(w,shift(start),2),second=nearestOpenCell(w,shift(end),2);if(first===null||second===null)continue;
  const lateral=Math.abs(first%m.width-start.x)+Math.abs(Math.floor(first/m.width)-start.y);if(lateral<3)continue;
  const threats=visible.filter(u=>[first,second].some(i=>Math.abs(u.x-i%m.width)+Math.abs(u.y-Math.floor(i/m.width))<6)).length;
  candidates.push({points:[...new Set([first,second])],threats,sign});
 }
 candidates.sort((a,b)=>a.threats-b.threats||a.sign-b.sign);return candidates[0]?.points??null;
}
function finish(w,s,phase){
 s.phase=phase;setDestination(w,s,null);s.status=phase==='complete'?'arrived':'target_lost';s.reason=phase==='complete'?null:'target_lost';s.arrivedCount=livingMembers(w,s).length;
}
export function updateAttackOrder(w,s,visible=visibleEnemies(w,s.team)){
 const center=squadCenter(w,s),enemies=selectedEnemies(w,s,s,visible);
 // A squad target may change its closest visible member without changing the
 // explicit command generation. Hidden units never supply fresh coordinates.
 enemies.sort((a,b)=>(a.x-center.x)**2+(a.y-center.y)**2-((b.x-center.x)**2+(b.y-center.y)**2)||a.id-b.id);
 const target=enemies[0];
 const alive=s.targetUnitId!=null?w.units[s.targetUnitId-1]?.hp>0:w.squads[s.targetSquadId-1]?.unitIds.some(id=>w.units[id-1].hp>0);
 if(!alive){finish(w,s,'complete');return;}
 if(!target){s.phase='searching';if(s.reached||s.goal===null)finish(w,s,'target-lost');return;}
 const targetCell=cell(w.map,target.x,target.y),distance=Math.hypot(target.x-center.x,target.y-center.y),inRange=distance<=6&&lineOfSight(w.map,center,target);
 if(s.lastTargetCell===targetCell&&s.attackInRange===inRange&&s.goal!==null){s.phase=inRange?'attacking':'pursuing';return;}
 const desired=inRange?center:{x:Math.round(target.x-(target.x-center.x)/distance*5),y:Math.round(target.y-(target.y-center.y)/distance*5)};
 const goal=nearestOpenCell(w,desired);if(goal===null)return;
 s.lastTargetCell=targetCell;s.attackInRange=inRange;s.lastKnownTarget=targetCell;s.phase=inRange?'attacking':'pursuing';setDestination(w,s,goal);
}
// Called once before movement. Distance fields and all traffic/path searches
// still run under Navigation's existing shared 2048-expansion tick allowance.
export function updateTacticalOrders(w){
 if(w.winner)return;const visibleByTeam=new Map();
 for(const s of w.squads){
  if(!['attack','flank'].includes(s.order)||!livingMembers(w,s).length||['complete','target-lost'].includes(s.phase))continue;
  if(s.suppressed)continue;
  let visible=visibleByTeam.get(s.team);if(!visible){visible=visibleEnemies(w,s.team);visibleByTeam.set(s.team,visible);}
  if(s.order==='attack'){updateAttackOrder(w,s,visible);continue;}
  if(!s.reached)continue;
  s.waypoints.shift();
  if(s.waypoints.length){setDestination(w,s,s.waypoints[0],{force:true});continue;}
  if(s.targetUnitId!=null||s.targetSquadId!=null){s.order='attack';s.phase='pursuing';s.lastTargetCell=null;updateAttackOrder(w,s,visible);}
  else{s.order='move';s.phase='moving';setDestination(w,s,s.flankTarget,{force:true});}
 }
}
