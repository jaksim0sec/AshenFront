import {cell,neighbors,canStep} from './world.mjs';
import {formationOffsets} from './formations.mjs';
export function allocateSlots(w,s,target){
 const m=w.map,live=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0),gx=target%m.width,gy=Math.floor(target/m.width),occupiedSlots=new Set();
 for(const other of w.squads)if(other!==s)for(const [id,i] of Object.entries(other.slots??{}))if(w.units[Number(id)-1]?.hp>0)occupiedSlots.add(i);
 if(!live.length)return {};
 const ux=live.reduce((a,u)=>a+u.x,0)/live.length,uy=live.reduce((a,u)=>a+u.y,0)/live.length;
 const horizontal=s.formationHorizontal??(Math.abs(gx-ux)>=Math.abs(gy-uy)),offsets=formationOffsets(s.formation??'line',live.length,horizontal);
 const reach=Math.max(4,...offsets.map(p=>Math.abs(p.x)+Math.abs(p.y))),candidates=[],seen=new Set([target]),q=[target];
 for(let p=0;p<q.length;p++){
  const i=q[p],actor=w.units[m.occupancy[i]-1],holder=actor&&w.squads[actor.squadId-1],reserved=w.units[m.reservation[i]-1];
  if(m.floorLevel[i]===m.floorLevel[target]&&!m.blocked[i]&&!occupiedSlots.has(i)&&(!reserved||reserved.squadId===s.id)&&(!actor||actor.squadId===s.id||(actor.team===s.team&&holder.order!=='hold'&&!holder.suppressed&&!holder.reached)))candidates.push(i);
  for(const j of neighbors(m,i))if(!seen.has(j)&&Math.abs(j%m.width-gx)+Math.abs(Math.floor(j/m.width)-gy)<=reach&&canStep(m,i,j)){seen.add(j);q.push(j);}
 }
 const ideal=new Set(offsets.filter(p=>gx+p.x>=0&&gx+p.x<m.width&&gy+p.y>=0&&gy+p.y<m.height).map(p=>cell(m,gx+p.x,gy+p.y)));
 const range=i=>Math.abs(i%m.width-gx)+Math.abs(Math.floor(i/m.width)-gy);
 candidates.sort((a,b)=>(ideal.has(a)?0:1)-(ideal.has(b)?0:1)||range(a)-range(b)||a-b);
 const seats=candidates.slice(0,live.length),slots={},remaining=[...live];
 // Keep soldiers already occupying chosen seats. This avoids assigning an idle
 // soldier's place to a distant ally and creating an unnecessary exchange.
 for(const i of seats){const u=remaining.find(u=>u.moveTo<0&&cell(m,u.x,u.y)===i);if(u){slots[u.id]=i;remaining.splice(remaining.indexOf(u),1);}}
 for(const i of seats)if(!Object.values(slots).includes(i)){
  remaining.sort((a,b)=>(Math.abs(a.x-i%m.width)+Math.abs(a.y-Math.floor(i/m.width)))-(Math.abs(b.x-i%m.width)+Math.abs(b.y-Math.floor(i/m.width)))||a.id-b.id);slots[remaining.shift().id]=i;
 }
 return slots;
}
export function unitField(w,s,u){
 const global=w.navigation.field(s.goal,s.radius);
 if(s.placement!=='formation'||s.slots[u.id]===undefined)return global;
 const i=cell(w.map,u.x,u.y),target=s.slots[u.id],limit=s.slotFieldLimit??8;
 if(u.preciseSlot===target)return w.navigation.field(target,0);
 if(Math.abs(u.x-target%w.map.width)+Math.abs(u.y-Math.floor(target/w.map.width))>limit&&global.distance[i]!==0)return global;
 const local=w.navigation.field(target,0,limit);
 if(local.distance[i]>=0)return local;
 // A broad formation or a winding wall can put a seat beyond the bounded
 // local field even after the soldier enters the global landing region.
 // Expand that seat through the ordinary budgeted field scheduler once.
 if(local.done&&global.distance[i]===0){u.preciseSlot=target;return w.navigation.field(target,0);}
 return global;
}
export function updateOrderStatus(w,s){
 const live=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0);s.livingCount=live.length;
 if(s.goal===null){s.status='arrived';s.arrivedCount=live.length;return;}
 const global=w.navigation.field(s.goal,s.radius),precise=s.placement==='formation';
 s.arrivedCount=live.filter(u=>u.moveTo<0&&(precise?cell(w.map,u.x,u.y)===s.slots[u.id]:global.distance[cell(w.map,u.x,u.y)]===0)).length;
 s.reached=s.arrivedCount===live.length;s.reason=null;
 if(s.reached)s.status='arrived';
 else if(precise&&Object.keys(s.slots).length<live.length){s.status='partial';s.reason='insufficient_room';}
 else if(s.suppressed){s.status='paused_suppressed';s.reason='suppressed';}
 else if(global.done&&live.some(u=>global.distance[cell(w.map,u.x,u.y)]<0)){s.status='unreachable';s.reason='no_route';}
 else if(live.some(u=>u.wait>=40)){
  s.status='blocked';s.reason='waiting_for_capacity';
  for(const u of live)for(const i of neighbors(w.map,cell(w.map,u.x,u.y))){const v=w.units[w.map.occupancy[i]-1];if(v?.team===s.team){const vs=w.squads[v.squadId-1];if(vs.order==='hold'||vs.suppressed)s.reason='blocked_by_ally';}}
 }else s.status=live.some(u=>u.moveTo>=0)?'moving':global.done?'partial':'planning';
 if(!['attack','flank'].includes(s.order))s.phase=s.reached?'arrived':s.suppressed?'paused_suppressed':'moving';
 if(s.status==='partial'&&!s.reason)s.reason=live.some(u=>u.yieldFor)?'yielding_to_ally':w.navigation.pending?'planning':'waiting_for_capacity';
 if(w.telemetry){w.orderEvents??=[];const signature=[s.orderId,s.status,s.arrivedCount,s.reason].join(':');if(signature!==s.lastOrderSignature){s.lastOrderSignature=signature;w.orderEvents.push({tick:w.tick,orderId:s.orderId,squadId:s.id,status:s.status,targetCell:s.goal,targetElevation:s.targetElevation,arrived:s.arrivedCount,living:live.length,reason:s.reason,fields:w.navigation.fields.size});if(w.orderEvents.length>512)w.orderEvents.shift();}}
}
