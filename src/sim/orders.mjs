import {cell,neighbors,canStep} from './world.mjs';
export function allocateSlots(w,s,target){
 const m=w.map,live=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0),gx=target%m.width,gy=Math.floor(target/m.width),occupiedSlots=new Set();
 for(const other of w.squads)if(other!==s)for(const [id,i] of Object.entries(other.slots??{}))if(w.units[Number(id)-1]?.hp>0)occupiedSlots.add(i);
 const candidates=[],seen=new Set([target]),q=[target];
 for(let p=0;p<q.length;p++){const i=q[p],x=i%m.width,y=Math.floor(i/m.width),actor=w.units[m.occupancy[i]-1],holder=actor&&w.squads[actor.squadId-1];
  if(m.floorLevel[i]===m.floorLevel[target]&&!m.blocked[i]&&!occupiedSlots.has(i)&&(!actor||actor.squadId===s.id||(actor.team===s.team&&holder.order!=='hold'&&!holder.suppressed)))candidates.push(i);
  for(const j of neighbors(m,i))if(!seen.has(j)&&Math.abs(j%m.width-gx)+Math.abs(Math.floor(j/m.width)-gy)<=4&&canStep(m,i,j)){seen.add(j);q.push(j);}
 }
 const ux=live.reduce((a,u)=>a+u.x,0)/live.length,uy=live.reduce((a,u)=>a+u.y,0)/live.length,horizontal=Math.abs(gx-ux)>=Math.abs(gy-uy),ideal=new Set();
 for(let rank=0;rank<2;rank++)for(let n=-2;n<=2;n++){const x=gx+(horizontal?rank:n),y=gy+(horizontal?n:rank);if(x>=0&&x<m.width&&y>=0&&y<m.height)ideal.add(cell(m,x,y));}
 const range=i=>Math.abs(i%m.width-gx)+Math.abs(Math.floor(i/m.width)-gy);
 candidates.sort((a,b)=>(ideal.has(a)?0:1)-(ideal.has(b)?0:1)||range(a)-range(b)||a-b);
 const slots={},remaining=[...live];for(const i of candidates.slice(0,live.length)){remaining.sort((a,b)=>(Math.abs(a.x-i%m.width)+Math.abs(a.y-Math.floor(i/m.width)))-(Math.abs(b.x-i%m.width)+Math.abs(b.y-Math.floor(i/m.width)))||a.id-b.id);slots[remaining.shift().id]=i;}
 return slots;
}
export function unitField(w,s,u){
 const global=w.navigation.field(s.goal,s.radius);
 if(s.placement!=='formation'||s.slots[u.id]===undefined)return global;
 const i=cell(w.map,u.x,u.y),target=s.slots[u.id];if(Math.abs(u.x-target%w.map.width)+Math.abs(u.y-Math.floor(target/w.map.width))>8)return global;
 const local=w.navigation.field(target,0,8);
 return local.distance[i]>=0?local:global;
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
 if(w.telemetry){w.orderEvents??=[];const signature=[s.orderId,s.status,s.arrivedCount,s.reason].join(':');if(signature!==s.lastOrderSignature){s.lastOrderSignature=signature;w.orderEvents.push({tick:w.tick,orderId:s.orderId,squadId:s.id,status:s.status,targetCell:s.goal,targetElevation:s.targetElevation,arrived:s.arrivedCount,living:live.length,reason:s.reason,fields:w.navigation.fields.size});if(w.orderEvents.length>512)w.orderEvents.shift();}}
}
