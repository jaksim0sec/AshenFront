import {cell,neighbors,canStep} from './world.mjs';
export class Navigation {
 constructor(map){this.map=map;this.fields=new Map();this.cursor=0;}
 field(goal,radius=3) {
  const key=goal+':'+radius;if(this.fields.has(key))return this.fields.get(key);
  const m=this.map,distance=new Int32Array(m.size);distance.fill(-1);const queue=new Int32Array(m.size);let tail=0;
  const gx=goal%m.width,gy=Math.floor(goal/m.width);
  for(let y=Math.max(0,gy-radius);y<=Math.min(m.height-1,gy+radius);y++)for(let x=Math.max(0,gx-radius);x<=Math.min(m.width-1,gx+radius);x++) {
   const i=cell(m,x,y);if(Math.abs(x-gx)+Math.abs(y-gy)<=radius&&!m.blocked[i]&&m.floorLevel[i]===m.floorLevel[goal]){distance[i]=0;queue[tail++]=i;}
  }
  const f={goal,radius,distance,queue,head:0,tail,done:!tail};this.fields.set(key,f);return f;
 }
 get pending(){return [...this.fields.values()].filter(f=>!f.done).length;}
 update(budget=2048) {
  let used=0;const active=[...this.fields.values()].filter(f=>!f.done),m=this.map;
  while(used<budget&&active.length) {
   const n=this.cursor++%active.length,f=active[n],i=f.queue[f.head++];used++;
   for(const j of neighbors(m,i))if(f.distance[j]===-1&&canStep(m,i,j)){f.distance[j]=f.distance[i]+1;f.queue[f.tail++]=j;}
   if(f.head===f.tail){f.done=true;active.splice(n,1);}
  }
  return used;
 }
 prune(squads) {
  const live=new Set(squads.filter(s=>s.goal!==null).map(s=>s.goal+':'+s.radius));
  for(const key of this.fields.keys())if(!live.has(key))this.fields.delete(key);
 }
}
// Bounded dynamic detour; shares the same expansion allowance as distance fields.
function detour(w,u,f,budget) {
 const m=w.map,start=cell(m,u.x,u.y),queue=[start],first=new Map([[start,-1]]),depth=new Map([[start,0]]),parent=new Map();let used=0,best=-1,bestScore=Infinity;
 for(let head=0;head<queue.length&&used<budget;head++) {
  const i=queue[head];used++;const d=depth.get(i);
  if(i!==start&&f.distance[i]>=0&&f.distance[i]<f.distance[start]){const score=f.distance[i]+d;if(score<bestScore){best=i;bestScore=score;}}
  if(d===6)continue;
  for(const j of neighbors(m,i))if(!first.has(j)&&canStep(m,i,j)&&!m.occupancy[j]&&!m.reservation[j]){parent.set(j,i);first.set(j,i===start?j:first.get(i));depth.set(j,d+1);queue.push(j);}
 }
 w.metrics.navExpansions+=used;const path=[];while(best>=0&&best!==start){path.unshift(best);best=parent.get(best);}return path;
}
export function stepMovement(w) {
 const m=w.map,finished=[];
 for(const u of w.units)if(u.hp>0&&u.moveTo>=0){u.moveProgress++;if(u.moveProgress>=8)finished.push(u);}
 for(const u of finished)m.occupancy[cell(m,u.x,u.y)]=0;
 for(const u of finished){const dest=u.moveTo;m.occupancy[dest]=u.id;m.reservation[dest]=0;u.x=dest%m.width;u.y=Math.floor(dest/m.width);u.moveTo=-1;u.moveProgress=0;w.metrics.moves++;}
 w.metrics.navExpansions=w.navigation.update();
 const proposals=new Map(),claimed=new Set(),groups=new Map();
 for(const s of w.squads)if(s.goal!==null&&s.order!=='hold'&&!s.suppressed){
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
    if(occupant&&(occupant.team!==s.team||occupant.moveTo>=0||os.order==='hold'||os.suppressed||os.goal!==s.goal||os.radius!==s.radius))continue;
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
  if(u.hp<=0||u.moveTo>=0||proposals.has(u.id))continue;
  const s=w.squads[u.squadId-1];if(s.order==='hold'||s.goal===null||s.suppressed)continue;
  const f=w.navigation.field(s.goal,s.radius),i=cell(m,u.x,u.y),dist=f.distance[i];
  if(dist===0){u.wait=0;continue;}if(dist<0){s.movementBlockedReason=f.done?'no_route':null;continue;}
  const choices=neighbors(m,i).filter(j=>canStep(m,i,j)&&f.distance[j]>=0&&f.distance[j]<dist&&!m.reservation[j]&&!claimed.has(j)&&(!m.occupancy[j]||w.units[m.occupancy[j]-1].team===u.team));
  choices.sort((a,b)=>(f.distance[a]+(m.occupancy[a]?2:0))-(f.distance[b]+(m.occupancy[b]?2:0))||((u.id%2===0? a:-a)-(u.id%2===0?b:-b)));
  let dest=choices[0]??-1;
  if(u.detour?.length){const next=u.detour[0];if(canStep(m,i,next)&&!m.occupancy[next]&&!m.reservation[next]&&!claimed.has(next))dest=next;else u.detour=null;}
  if(u.wait>=40 && (u.wait+u.id)%8===0 && w.metrics.navExpansions<2048) {
   const alt=detour(w,u,f,Math.min(256,2048-w.metrics.navExpansions));if(alt.length&&!claimed.has(alt[0])){u.detour=alt;dest=alt[0];}
  }
  if(dest>=0){proposals.set(u.id,dest);claimed.add(dest);}u.wait++;
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
  if(!living.length||s.goal===null)continue;
  const f=w.navigation.field(s.goal,s.radius),arrived=living.filter(u=>f.distance[cell(m,u.x,u.y)]===0).length;
  s.reached=arrived>=Math.ceil(living.length*.8);
  s.movementBlockedReason=s.suppressed?'suppressed':living.every(u=>f.distance[cell(m,u.x,u.y)]<0)&&f.done?'no_route':living.some(u=>u.wait>=8)?'congestion':null;
  if(living.some(u=>u.moveTo>=0))w.metrics.movingTicks[s.team]++;
  if(s.movementBlockedReason)w.metrics.blocked[s.movementBlockedReason]=(w.metrics.blocked[s.movementBlockedReason]??0)+1;
 }
 if(w.tick%100===0)w.navigation.prune(w.squads);
}
