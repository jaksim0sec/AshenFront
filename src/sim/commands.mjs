export function command(w,team,c) {
 if(w.winner)return {ok:false,reason:'Battle finished'};
 const s=w.squads[c.squadId-1];
 if(!s||s.team!==team)return {ok:false,reason:'Not your squad'};
 if(!s.unitIds.some(id=>w.units[id-1].hp>0))return {ok:false,reason:'Squad eliminated'};
 if(!['move','hold','rally'].includes(c.type))return {ok:false,reason:'Unknown order'};
 if(c.type!=='hold'&&(!Number.isInteger(c.target)||c.target<0||c.target>=w.map.size||w.map.blocked[c.target]))return {ok:false,reason:'Destination blocked or outside battlefield'};
 if(c.type==='hold'){s.order='hold';s.goal=null;s.movementBlockedReason=null;s.reached=false;}
 else {s.order=c.type;s.goal=c.target;s.radius=c.radius??3;s.reached=false;s.movementBlockedReason=null;w.navigation.field(s.goal,s.radius);}
 for(const id of s.unitIds)w.units[id-1].detour=null;
 s.lastOrderTick=w.tick;w.commandLog.push({tick:w.tick,team,...c});return {ok:true};
}
