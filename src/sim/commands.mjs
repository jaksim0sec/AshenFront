import {requestSupport} from './support.mjs';
import {validFormation} from './formations.mjs';
import {squadCenter,nearestOpenCell,selectedEnemies,flankWaypoints,setDestination,updateAttackOrder} from './tactical-orders.mjs';
import {cell} from './world.mjs';

export function command(w,team,c) {
 if(w.winner)return {ok:false,reason:'Battle finished'};
 if(c.type==='support'){const result=requestSupport(w,team,c.target);if(result.ok)w.commandLog.push({tick:w.tick,team,...c});return result;}
 const s=w.squads[c.squadId-1];
 if(!s||s.team!==team)return {ok:false,reason:'Not your squad'};
 if(!s.unitIds.some(id=>w.units[id-1].hp>0))return {ok:false,reason:'Squad eliminated'};
 if(!['move','hold','rally','withdraw','formation','attack','flank'].includes(c.type))return {ok:false,reason:'Unknown order'};
 if((c.formation!==undefined&&!validFormation(c.formation))||(c.type==='formation'&&!validFormation(c.formation)))return {ok:false,reason:'Invalid formation'};
 if(c.type!=='hold'&&c.radius!==undefined&&(!Number.isInteger(c.radius)||c.radius<0||c.radius>4))return {ok:false,reason:'Invalid destination radius'};
 if(c.placement!==undefined&&!['area','formation'].includes(c.placement))return {ok:false,reason:'Invalid placement'};
 const hasEnemy=c.targetUnitId!=null||c.targetSquadId!=null,targets=c.type==='attack'||(c.type==='flank'&&hasEnemy)?selectedEnemies(w,s,c):[];
 if((c.type==='attack'||(c.type==='flank'&&hasEnemy))&&((c.targetUnitId!=null&&c.targetSquadId!=null)||!targets.length))return {ok:false,reason:'Target is not a visible enemy'};
 let target=c.target;
 if(c.type==='formation')target=nearestOpenCell(w,squadCenter(w,s));
 if(c.type==='attack'||(c.type==='flank'&&hasEnemy)){const enemy=targets[0];target=cell(w.map,enemy.x,enemy.y);}
 if(c.type!=='hold'&&(!Number.isInteger(target)||target<0||target>=w.map.size||w.map.blocked[target]))return {ok:false,reason:'Destination blocked or outside battlefield'};
 const placement=c.type==='formation'?'formation':c.placement??((c.type==='rally'||c.radius!==undefined)?'area':'formation'),formation=c.formation??s.formation??'line';
 const signature=JSON.stringify([c.type,c.type==='hold'||c.type==='formation'?null:c.type==='attack'||hasEnemy?null:target,c.type==='hold'?null:c.radius??3,placement,formation,c.type==='attack'||c.type==='flank'?c.targetUnitId??null:null,c.type==='attack'||c.type==='flank'?c.targetSquadId??null:null]);
 if(s.commandSignature===signature&&s.phase!=='target-lost')return {ok:true,orderId:s.orderId,repeated:true};
 const waypoints=c.type==='flank'?flankWaypoints(w,s,target):[];
 if(c.type==='flank'&&!waypoints)return {ok:false,reason:'No room for a flanking route'};
 // Validation is complete. Replace all tactical intent atomically, retaining
 // only steps already reserved by Navigation.
 w.orderSequence=(w.orderSequence??0)+1;s.orderId=w.orderSequence;s.commandSignature=signature;s.placement=placement;s.formation=formation;
 const center=squadCenter(w,s);if(c.type!=='hold')s.formationHorizontal=Math.abs(target%w.map.width-center.x)>=Math.abs(Math.floor(target/w.map.width)-center.y);
 s.targetUnitId=(c.type==='attack'||c.type==='flank')?c.targetUnitId??null:null;s.targetSquadId=(c.type==='attack'||c.type==='flank')?c.targetSquadId??null:null;
 s.waypoints=waypoints;s.flankTarget=c.type==='flank'?target:null;s.lastTargetCell=null;s.lastKnownTarget=null;s.attackInRange=false;s.order=c.type;s.radius=c.radius??3;
 s.phase=c.type==='flank'?'flanking':c.type==='hold'?'holding':'moving';
 setDestination(w,s,c.type==='hold'?null:c.type==='flank'?waypoints[0]:target,{force:true});
 if(c.type==='hold'){s.status='arrived';s.arrivedCount=s.unitIds.filter(id=>w.units[id-1].hp>0).length;}
 if(c.type==='attack')updateAttackOrder(w,s);
 s.lastOrderTick=w.tick;w.commandLog.push({tick:w.tick,team,...c});return {ok:true,orderId:s.orderId,status:s.status};
}
