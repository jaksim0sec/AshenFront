import {unitField,updateOrderStatus} from './orders.mjs';
import {cell,neighbors,canStep} from './world.mjs';
export class Navigation {
 constructor(map){this.map=map;this.fields=new Map();this.cursor=0;}
 field(goal,radius=3,limit=Infinity) {
  if(this.revision!==(this.map.topologyRevision??0)){this.fields.clear();this.revision=this.map.topologyRevision??0;}
  const key=goal+':'+radius+(limit===Infinity?'':':'+limit);if(this.fields.size>=96&&!this.fields.has(key)){const victim=[...this.fields].find(([,f])=>Number.isFinite(f.limit));if(victim)this.fields.delete(victim[0]);}if(this.fields.has(key))return this.fields.get(key);
  const m=this.map,distance=new Int32Array(m.size);distance.fill(-1);const queue=new Int32Array(m.size);let tail=0;
  const gx=goal%m.width,gy=Math.floor(goal/m.width);
  // Only seed the anchor's connected local region, never the far side of a wall.
  const seeds=[],seen=new Set();if(!m.blocked[goal]){seeds.push(goal);seen.add(goal);}
  for(let p=0;p<seeds.length;p++){const i=seeds[p];distance[i]=0;queue[tail++]=i;
   for(const j of neighbors(m,i))if(!seen.has(j)&&m.floorLevel[j]===m.floorLevel[goal]&&Math.abs(j%m.width-gx)+Math.abs(Math.floor(j/m.width)-gy)<=radius&&canStep(m,i,j)){seen.add(j);seeds.push(j);}
  }
  const f={goal,radius,limit,distance,queue,head:0,tail,done:!tail};this.fields.set(key,f);return f;
 }
 get pending(){return [...this.fields.values()].filter(f=>!f.done).length;}
 update(budget=2048) {
  let used=0;const active=[...this.fields.values()].filter(f=>!f.done),m=this.map;
  while(used<budget&&active.length) {
   const n=this.cursor++%active.length,f=active[n],i=f.queue[f.head++];used++;
   for(const j of neighbors(m,i))if(f.distance[i]<f.limit&&f.distance[j]===-1&&canStep(m,i,j)){f.distance[j]=f.distance[i]+1;f.queue[f.tail++]=j;}
   if(f.head===f.tail){f.done=true;active.splice(n,1);}
  }
  return used;
 }
 prune(squads) {
  const live=new Set(squads.filter(s=>s.goal!==null).map(s=>s.goal+':'+s.radius));
  for(const s of squads)if(s.placement==='formation'&&s.goal!==null)for(const i of Object.values(s.slots??{})){live.add(i+':0:'+(s.slotFieldLimit??8));live.add(i+':0');}
  for(const key of this.fields.keys())if(!live.has(key))this.fields.delete(key);
 }
}
function yielding(w,u){
 if(!u.yieldFor)return false;const v=w.units[u.yieldFor-1],s=v&&w.squads[v.squadId-1];
 const waiting=v?.hp>0&&s.orderId===u.yieldGeneration&&s.goal!==null&&cell(w.map,v.x,v.y)!==s.slots?.[v.id];
 if(!waiting){u.yieldFor=null;return false;}
 const seen=new Set([u.id]);let next=v;while(next?.yieldFor){if(seen.has(next.id)){const release=Math.min(...seen);if(u.id===release){u.yieldFor=null;return false;}break;}seen.add(next.id);next=w.units[next.yieldFor-1];}return true;
}
function cooperativeCell(w,u,i){
 const id=w.map.occupancy[i];if(!id)return true;
 const v=w.units[id-1],s=w.squads[v.squadId-1];if(v.team!==u.team||s.order==='hold'||s.suppressed||s.goal===null)return false;
 return s.placement==='formation'?s.slots[v.id]!==i:w.navigation.field(s.goal,s.radius).distance[i]!==0;
}
// Bounded dynamic detour; shares the same expansion allowance as distance fields.
function detour(w,u,f,budget) {
 const m=w.map,start=cell(m,u.x,u.y),queue=[start],first=new Map([[start,-1]]),depth=new Map([[start,0]]),parent=new Map();let used=0,best=-1,bestScore=Infinity;
 for(let head=0;head<queue.length&&used<budget;head++) {
  const i=queue[head];used++;const d=depth.get(i);
  if(i!==start&&f.distance[i]>=0&&f.distance[i]<f.distance[start]){const score=f.radius===0?f.distance[i]*100+d:f.distance[i]+d;if(score<bestScore){best=i;bestScore=score;}}
  if(d===6)continue;
  for(const j of neighbors(m,i))if(!first.has(j)&&canStep(m,i,j)&&cooperativeCell(w,u,j)&&!m.reservation[j]){parent.set(j,i);first.set(j,i===start?j:first.get(i));depth.set(j,d+1);queue.push(j);}
 }
 w.metrics.navExpansions+=used;const path=[];while(best>=0&&best!==start){path.unshift(best);best=parent.get(best);}return path;
}
export function stepMovement(w) {
 const m=w.map,finished=[];
 for(const u of w.units)if(u.hp>0&&u.moveTo>=0){u.moveProgress++;if(u.moveProgress>=8)finished.push(u);}
 for(const u of finished)m.occupancy[cell(m,u.x,u.y)]=0;
 for(const u of finished){const dest=u.moveTo;m.occupancy[dest]=u.id;m.reservation[dest]=0;u.x=dest%m.width;u.y=Math.floor(dest/m.width);u.moveTo=-1;u.moveProgress=0;w.metrics.moves++;}
 if(finished.length)w.spatialRevision=(w.spatialRevision??0)+1;
 w.metrics.navExpansions=w.navigation.update();
 for(const u of w.units)yielding(w,u);
 // Preserve the confirmed footprint; exchange assignments only to resolve
 // an idle member occupying another member's slot after sustained congestion.
 for(const s of w.squads)if(s.placement==='formation'&&!s.suppressed&&s.goal!==null){
  const owners=new Map(Object.entries(s.slots).map(([id,i])=>[i,Number(id)]));
  for(const id of s.unitIds){const u=w.units[id-1],i=cell(m,u.x,u.y),otherId=owners.get(i);if(!otherId||otherId===id||u.hp<=0||u.moveTo>=0)continue;
   const v=w.units[otherId-1];if(v.hp<=0||v.moveTo>=0||Math.max(u.wait,v.wait)<24)continue;
   const old=s.slots[id];s.slots[id]=i;s.slots[otherId]=old;owners.set(i,id);owners.set(old,otherId);u.detour=null;v.detour=null;
  }
 }
 const proposals=new Map(),claimed=new Set(),groups=new Map();
 for(const s of w.squads)if(s.goal!==null&&s.order!=='hold'&&!s.suppressed&&s.placement!=='formation'){
  const key=s.team+':'+s.goal+':'+s.radius;
  if(!groups.has(key))groups.set(key,{s,units:[]});
  groups.get(key).units.push(...s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0));
 }
 // Route a vacancy through a full landing region, then admit a waiting soldier.
 // This is capacity management, not formation shuffling; settled groups stay still.
 for(const {s,units} of groups.values()){
  const f=w.navigation.field(s.goal,s.radius),waiting=units.filter(u=>u.moveTo<0&&u.wait>=40&&f.distance[cell(m,u.x,u.y)]===1);
  if(!waiting.length||w.metrics.navExpansions>=2048)continue;
  const gx=s.goal%m.width,gy=Math.floor(s.goal/m.width),parent=new Map(),q=[],depth=new Map();
  for(let y=Math.max(0,gy-s.radius);y<=Math.min(m.height-1,gy+s.radius);y++)for(let x=Math.max(0,gx-s.radius);x<=Math.min(m.width-1,gx+s.radius);x++){
   const i=cell(m,x,y);if(f.distance[i]===0&&!m.occupancy[i]&&!m.reservation[i]){q.push(i);parent.set(i,-1);depth.set(i,0);}
  }
  for(let head=0;head<q.length&&w.metrics.navExpansions<2048;head++){
   const i=q[head];w.metrics.navExpansions++;
   for(const j of neighbors(m,i))if(f.distance[j]===0&&!parent.has(j)&&!m.reservation[j]&&canStep(m,i,j)){
    const occupant=m.occupancy[j]?w.units[m.occupancy[j]-1]:null,os=occupant?w.squads[occupant.squadId-1]:null;
    if(occupant&&(occupant.team!==s.team||occupant.moveTo>=0||os.order==='hold'||os.suppressed||os.placement==='formation'||os.goal!==s.goal||os.radius!==s.radius))continue;
    parent.set(j,i);depth.set(j,depth.get(i)+1);q.push(j);
   }
  }
  waiting.sort((a,b)=>b.wait-a.wait||a.id-b.id);let picked=false;
  for(const u of waiting){const entries=neighbors(m,cell(m,u.x,u.y)).filter(j=>canStep(m,cell(m,u.x,u.y),j)&&parent.has(j)&&!claimed.has(j));entries.sort((a,b)=>depth.get(a)-depth.get(b)||a-b);
   for(const entry of entries){const chain=[];let j=entry;while(m.occupancy[j]){const id=m.occupancy[j],dest=parent.get(j);if(dest===undefined||dest<0||proposals.has(id)||claimed.has(dest)){chain.length=0;break;}chain.push([id,dest]);j=dest;}
    if(m.occupancy[entry]&&!chain.length)continue;
    chain.push([u.id,entry]);for(const [id,dest] of chain){proposals.set(id,dest);claimed.add(dest);}picked=true;break;
   }if(picked)break;
  }
 }
 // Rotate priority every tick so IDs cannot monopolize a doorway.
 const order=w.units.slice(),offset=w.tick%Math.max(1,order.length);order.push(...order.splice(0,offset));
 for(const u of order) {
  if(u.hp<=0||u.moveTo>=0||proposals.has(u.id)||yielding(w,u))continue;
  const s=w.squads[u.squadId-1];if(s.order==='hold'||s.goal===null||s.suppressed)continue;
  const f=unitField(w,s,u),i=cell(m,u.x,u.y),dist=f.distance[i];
  if(s.placement==='formation'&&s.slots[u.id]===undefined)continue;
  if(dist===0){u.wait=0;continue;}if(dist<0){s.movementBlockedReason=f.done?'no_route':null;continue;}
  const choices=neighbors(m,i).filter(j=>canStep(m,i,j)&&f.distance[j]>=0&&f.distance[j]<dist&&!m.reservation[j]&&!claimed.has(j)&&(!m.occupancy[j]||w.units[m.occupancy[j]-1].team===u.team));
  choices.sort((a,b)=>(f.distance[a]+(m.occupancy[a]?2:0))-(f.distance[b]+(m.occupancy[b]?2:0))||((u.id%2===0? a:-a)-(u.id%2===0?b:-b)));
  let dest=choices[0]??-1;
  if(u.detour?.length){const next=u.detour[0];if(canStep(m,i,next)&&cooperativeCell(w,u,next)){if(m.reservation[next]||claimed.has(next)){u.wait++;continue;}dest=next;}else u.detour=null;}
  if(!u.detour?.length && u.wait>=40 && (u.wait+u.id)%8===0 && w.metrics.navExpansions<2048) {
   const alt=detour(w,u,f,Math.min(256,2048-w.metrics.navExpansions));if(alt.length){u.detour=alt;if(claimed.has(alt[0])){u.wait++;continue;}dest=alt[0];}
  }
  if(dest>=0){proposals.set(u.id,dest);claimed.add(dest);}u.wait++;
 }
 // A waiting formation member may relay a vacancy through uncommitted allies.
 // Yielded actors retain their orders and resume once the leader clears its slot.
 for(const u of order){
  const s=w.squads[u.squadId-1];if(u.hp<=0||u.moveTo>=0||u.wait<24||yielding(w,u)||s.placement!=='formation'||s.goal===null||s.suppressed)continue;
  const f=unitField(w,s,u),origin=cell(m,u.x,u.y);
  const entries=neighbors(m,origin).filter(j=>canStep(m,origin,j)&&f.distance[j]>=0&&f.distance[j]<f.distance[origin]);let relayed=false;
  for(const entry of entries){const q=[entry],parent=new Map([[entry,-1]]),depth=new Map([[entry,0]]);let free=-1;
   for(let h=0;h<q.length&&w.metrics.navExpansions<2048;h++){
    const i=q[h];w.metrics.navExpansions++;if(m.reservation[i])continue;
    const v=w.units[m.occupancy[i]-1];if(!v){free=i;break;}const vs=w.squads[v.squadId-1];
    if(v.id===u.id||v.team!==u.team||v.moveTo>=0||vs.order==='hold'||vs.suppressed||vs.reached)continue;
    if(depth.get(i)>=4)continue;
    for(const j of neighbors(m,i))if(j!==origin&&!parent.has(j)&&canStep(m,i,j)){parent.set(j,i);depth.set(j,depth.get(i)+1);q.push(j);}
   }
   if(free<0)continue;const path=[free];while(parent.get(path[0])!==-1)path.unshift(parent.get(path[0]));
   const chain=[];for(let k=0;k<path.length-1;k++)chain.push([m.occupancy[path[k]],path[k+1]]);chain.push([u.id,entry]);
   const ids=new Set(chain.map(([id])=>id));if(chain.some(([,dest])=>claimed.has(dest)&&![...proposals].some(([id,j])=>j===dest&&ids.has(id))))continue;
   for(const [id] of chain){if(proposals.has(id))claimed.delete(proposals.get(id));proposals.delete(id);}
   for(const [id,dest] of chain){proposals.set(id,dest);claimed.add(dest);if(id!==u.id){w.units[id-1].yieldFor=u.id;w.units[id-1].yieldGeneration=s.orderId;w.units[id-1].detour=null;}}relayed=true;break;
  }if(relayed)break;
 }
 const status=new Map();
 function accepts(id,stack=[]) {
  if(status.has(id))return status.get(id);
  if(stack.includes(id)){for(const n of stack.slice(stack.indexOf(id)))status.set(n,true);return true;}
  const dest=proposals.get(id);if(dest===undefined)return false;
  const occ=m.occupancy[dest];let ok=!occ;
  if(occ){const other=w.units[occ-1];ok=other.team===w.units[id-1].team&&other.moveTo<0&&accepts(occ,[...stack,id]);}
  status.set(id,ok);return ok;
 }
 for(const [id,dest] of proposals)if(accepts(id)){const u=w.units[id-1];u.moveTo=dest;u.moveProgress=0;u.wait=0;if(u.detour?.[0]===dest)u.detour.shift();m.reservation[dest]=id;}
 for(const s of w.squads) {
  const living=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0);
  if(!living.length){s.status='cancelled';s.livingCount=0;s.arrivedCount=0;s.reached=false;continue;}if(s.goal===null)continue;
  const f=w.navigation.field(s.goal,s.radius),arrived=living.filter(u=>f.distance[cell(m,u.x,u.y)]===0).length;
  updateOrderStatus(w,s);
  s.movementBlockedReason=s.suppressed?'suppressed':living.every(u=>f.distance[cell(m,u.x,u.y)]<0)&&f.done?'no_route':living.some(u=>u.wait>=8)?'congestion':null;
  if(living.some(u=>u.moveTo>=0))w.metrics.movingTicks[s.team]++;
  if(s.movementBlockedReason)w.metrics.blocked[s.movementBlockedReason]=(w.metrics.blocked[s.movementBlockedReason]??0)+1;
 }
 if(w.tick%100===0)w.navigation.prune(w.squads);
}
