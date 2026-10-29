import {allocateSlots} from './orders.mjs';
import {requestSupport} from './support.mjs';
export function command(w,team,c) {
 if(w.winner)return {ok:false,reason:'Battle finished'};
 if(c.type==='support'){const result=requestSupport(w,team,c.target);if(result.ok)w.commandLog.push({tick:w.tick,team,...c});return result;}
 const s=w.squads[c.squadId-1];
 if(!s||s.team!==team)return {ok:false,reason:'Not your squad'};
 if(!s.unitIds.some(id=>w.units[id-1].hp>0))return {ok:false,reason:'Squad eliminated'};
 if(!['move','hold','rally','withdraw'].includes(c.type))return {ok:false,reason:'Unknown order'};
 if(c.type!=='hold'&&c.radius!==undefined&&(!Number.isInteger(c.radius)||c.radius<0||c.radius>4))return {ok:false,reason:'Invalid destination radius'};
 if(c.type!=='hold'&&(!Number.isInteger(c.target)||c.target<0||c.target>=w.map.size||w.map.blocked[c.target]))return {ok:false,reason:'Destination blocked or outside battlefield'};
 const placement=c.placement??((c.type==='rally'||c.radius!==undefined)?'area':'formation');
 if(s.order===c.type&&s.goal===(c.type==='hold'?null:c.target)&&s.placement===placement&&(c.type==='hold'||s.radius===(c.radius??3)))return {ok:true,orderId:s.orderId,repeated:true};
 w.orderSequence=(w.orderSequence??0)+1;s.orderId=w.orderSequence;s.placement=placement;s.slots={};s.targetElevation=c.type==='hold'?null:w.map.floorLevel[c.target];s.status='planning';s.arrivedCount=0;s.reason=null;
 if(c.type==='hold'){s.order='hold';s.goal=null;s.status='arrived';s.arrivedCount=s.unitIds.filter(id=>w.units[id-1].hp>0).length;s.movementBlockedReason=null;s.reached=false;}
 else {s.order=c.type;s.goal=c.target;s.radius=c.radius??3;if(placement==='formation')s.slots=allocateSlots(w,s,c.target);s.reached=false;s.movementBlockedReason=null;w.navigation.field(s.goal,s.radius);}
 for(const id of s.unitIds){w.units[id-1].detour=null;w.units[id-1].yieldFor=null;}
 w.navigation.prune(w.squads);
 s.lastOrderTick=w.tick;w.commandLog.push({tick:w.tick,team,...c});return {ok:true,orderId:s.orderId,status:s.status};
}
