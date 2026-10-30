import {Observer} from './observer.mjs';
import {CommandGateway} from './commands.mjs';
import {createOperation,trackProgress,adopt} from './operations.mjs';
import {choose,DOCTRINES} from './planner.mjs';
import {distance} from './observer.mjs';
import {flankWaypoints} from '../tactical-orders.mjs';

export class TacticalController {
 constructor(world,team){
  this.world=world;this.team=team;this.observer=new Observer(world,team);this.operations=new Map();this.nextRefresh=0;this.cursor=0;
  this.doctrine=DOCTRINES[(world.initialSeed??1)%DOCTRINES.length];
  this.metrics={observations:0,decisions:0,orders:0,replacements:0,deduplicated:0,deferred:0,invalid:0,replans:0,stalls:0,support:0};
  this.gateway=new CommandGateway(world,this.observer,this.metrics);
 }
 refresh(){
  const w=this.world,snapshot=this.snapshot=this.observer.observe();this.metrics.observations++;
  const states=[...snapshot.states.values()].sort((a,b)=>a.id-b.id);
  for(const id of this.operations.keys())if(!snapshot.states.has(id))this.operations.delete(id);
  let guard=[...this.operations.values()].find(o=>o.role==='guard');
  // A last surviving squad must still be able to win the battle. Retaining
  // two permanent home guards after both field forces die creates a deadlock.
  if(guard&&states.length===1){guard.role='front';guard=null;}
  if(!guard&&states.length>1){const candidate=states.find(s=>!s.squad.suppressed)??states[0];guard=this.operations.get(candidate.id)??createOperation(candidate.id,'guard');guard.role='guard';this.operations.set(candidate.id,guard);}
  let opening=0;
  for(const state of states){
   let op=this.operations.get(state.id);if(!op){op=createOperation(state.id,this.doctrine.opening[opening++%this.doctrine.opening.length]);this.operations.set(state.id,op);}
   // Readable UI metadata stays outside authoritative serialization. The
   // controller, graph caches and operations themselves live in a WeakMap.
   Object.defineProperties(state.squad,{botRole:{value:op.role,writable:true,configurable:true},botIntent:{value:op.intent,writable:true,configurable:true}});
   state.squad.role=op.role==='guard'?'guard':'advance';
  }
  // Keep a standing HQ guard and recall the nearest additional force only
  // when enemies are actually visible near home.
  this.defenders=new Set();if(snapshot.threats.length){
   let power=guard?(snapshot.states.get(guard.id)?.power??0):0;
   const needed=Math.max(snapshot.threats.reduce((n,e)=>n+e.hp/100,0)*1.35,power+1);
   const reserve=states.filter(s=>s.id!==guard?.id).sort((a,b)=>this.observer.travel(a.cell,snapshot.home.center)-this.observer.travel(b.cell,snapshot.home.center)||a.id-b.id);
   for(const state of reserve){this.defenders.add(state.id);power+=state.power;if(power>=needed)break;}
  }
  const claimed=new Map();
  for(const state of states){
   const op=this.operations.get(state.id);trackProgress(op,state,this.observer,w.tick);
   const choice=choose(this.observer,snapshot,state,op,{defend:this.defenders.has(state.id),doctrine:this.doctrine,claimed});
   if(choice){adopt(op,choice,state,this.observer,w.tick,this.metrics);claimed.set(choice.target,(claimed.get(choice.target)??0)+1);}
   state.squad.botIntent=op.intent;
  }
  this.gateway.support(snapshot);this.nextRefresh=w.tick+20;
 }
 run(){
  const w=this.world;if(!this.snapshot||w.tick>=this.nextRefresh)this.refresh();
  const ids=[...this.snapshot.states.keys()];if(!ids.length)return;
  // Two squad decisions per team per simulation tick; round robin keeps every
  // squad eligible regardless of ID or army size. Emergency defenders go first.
  const selected=[];
  for(const id of this.defenders)if(this.operations.get(id)?.intent==='DEFEND'&&this.snapshot.states.get(id)?.squad.goal!==this.snapshot.home.center&&w.tick-(this.gateway.last.get(id)??-Infinity)>=20&&!w.queue.some(c=>c.squadId===id)){selected.push(id);if(selected.length===2)break;}
  for(let n=0;n<ids.length&&selected.length<2;n++){const id=ids[this.cursor++%ids.length];if(!selected.includes(id))selected.push(id);}
  for(const id of selected){
   const state=this.snapshot.states.get(id),op=this.operations.get(id);if(!op?.intent)continue;this.metrics.decisions++;
   // Revalidate the source cell as units move between shared observations.
   const live=state.units.filter(u=>u.hp>0);if(!live.length)continue;
   state.cell=live[0].y*w.map.width+live[0].x;
   const urgent=op.intent==='DEFEND'&&this.defenders.has(id)||op.intent==='REGROUP';
   const immediate=!['REGROUP','DEFEND'].includes(op.intent)&&!state.squad.suppressed?this.snapshot.enemies.filter(e=>distance(w.map,e.cell,state.cell)<=9).sort((a,b)=>distance(w.map,a.cell,state.cell)-distance(w.map,b.cell,state.cell)||a.id-b.id)[0]:null;
   if(immediate){this.gateway.issue(state,'attack',immediate.cell,{urgent,targetUnitId:immediate.id});continue;}
   const target=op.intent==='DEFEND'?op.target:op.route[op.waypoint]??op.target;
   if(!urgent&&state.squad.order==='flank'&&state.squad.phase==='flanking'&&w.tick-state.squad.lastOrderTick<320)continue;
   let type=op.intent==='REGROUP'?'withdraw':'move';
   if(op.role==='mobile'&&op.intent==='FLANK'&&distance(w.map,state.cell,target)>=12){
    const visible=this.snapshot.enemies.map(e=>({x:e.cell%w.map.width,y:Math.floor(e.cell/w.map.width)}));
    const waypoints=flankWaypoints(w,state.squad,target,visible);
    if(waypoints?.every(i=>Number.isFinite(this.observer.travel(state.cell,i))))type='flank';
   }
   this.gateway.issue(state,type,target,{urgent,radius:op.role==='guard'?3:4});
  }
 }
}
