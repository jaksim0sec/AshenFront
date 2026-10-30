// All decisions pass through the normal queue and authoritative command rules.
export class CommandGateway {
 constructor(world,observer,metrics){this.world=world;this.observer=observer;this.metrics=metrics;this.last=new Map();}
 issue(state,type,target,{urgent=false,radius=3,targetUnitId=null}={}){
  const w=this.world,s=state.squad;if(!s.unitIds.some(id=>w.units[id-1]?.hp>0))return false;
  if(type!=='hold'&&(!Number.isInteger(target)||target<0||target>=w.map.size||w.map.blocked[target]||!Number.isFinite(this.observer.travel(state.cell,target)))){this.metrics.invalid++;return false;}
  if(type==='attack'&&!this.observer.visibleIds?.has(targetUnitId)){this.metrics.invalid++;return false;}
  const same=c=>c.type===type&&(type==='hold'||(type==='attack'?c.targetUnitId===targetUnitId:c.target===target&&(c.radius??3)===radius));
  if(w.queue.some(c=>c.team===s.team&&c.squadId===s.id&&same(c))||!['complete','target-lost'].includes(s.phase)&&same({type:s.order,target:s.order==='flank'?s.flankTarget:s.goal,radius:s.radius,targetUnitId:s.targetUnitId??null})){this.metrics.deduplicated++;return false;}
  const last=this.last.get(s.id)??-Infinity;
  if(w.tick-last<(urgent?20:60)||!urgent&&w.tick-s.lastOrderTick<60){this.metrics.deferred++;return false;}
  if(w.queue.some(c=>c.team===s.team&&c.squadId===s.id)){this.metrics.deferred++;return false;}
  w.queue.push({team:s.team,type,squadId:s.id,...(type==='hold'?{}:type==='attack'?{targetUnitId,radius}:{target,radius})});
  this.last.set(s.id,w.tick);this.metrics.orders++;if(s.goal!==null)this.metrics.replacements++;return true;
 }
 support(snapshot){
  const w=this.world,team=this.observer.team,resource=w.support?.[team];if(!resource||resource.uses<=0||w.tick<resource.nextTick||w.queue.some(c=>c.team===team&&c.type==='support'))return;
  let best=null,bestCount=2;for(const e of snapshot.enemies){
   const near=i=>(i%w.map.width-e.cell%w.map.width)**2+(Math.floor(i/w.map.width)-Math.floor(e.cell/w.map.width))**2<=9;
   const count=snapshot.enemies.filter(v=>near(v.cell)).length;
   if(count<=bestCount||[...snapshot.states.values()].some(s=>s.units.some(u=>near(u.y*w.map.width+u.x))))continue;
   best=e;bestCount=count;
  }if(best){w.queue.push({team,type:'support',target:best.cell});this.metrics.support++;}
 }
}
