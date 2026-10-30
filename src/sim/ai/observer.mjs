import {visibleEnemies} from '../combat.mjs';
import {canStep,neighbors,cell} from '../world.mjs';

export const distance=(m,a,b)=>Math.abs(a%m.width-b%m.width)+Math.abs(Math.floor(a/m.width)-Math.floor(b/m.width));

// FlowerWars-MINI's multi-source terrain graph, adapted to AshenFront's
// authoritative elevation, ramp and edge rules. Occupancy never changes topology.
export class Observer {
 constructor(world,team){this.world=world;this.team=team;this.revision=-1;this.routes=new Map();}
 topology(){
  const w=this.world,m=w.map,revision=m.topologyRevision??0;if(this.revision===revision)return;
  this.revision=revision;this.routes.clear();this.nodes=[];
  const add=(i,kind)=>{if(i<0||i>=m.size||m.blocked[i]||this.nodes.some(n=>n.cell===i))return;this.nodes.push({index:this.nodes.length,cell:i,kind,edges:new Map()});};
  for(const p of w.commandPosts??[])add(p.center,'hq');
  for(const p of w.objectives)add(p.center,'objective');
  for(let y=5;y<m.height;y+=12)for(let x=5;x<m.width;x+=12){
   const desired=cell(m,x,y);let best=-1,score=Infinity;
   for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    if(x+dx<0||x+dx>=m.width||y+dy<0||y+dy>=m.height)continue;
    const i=cell(m,x+dx,y+dy);if(m.blocked[i])continue;
    const exits=neighbors(m,i).filter(j=>canStep(m,i,j)).length;
    const value=distance(m,i,desired)+(4-exits)*2-(m.coverMask[i]?1:0);
    if(value<score){score=value;best=i;}
   }if(best>=0)add(best,'staging');
  }
  // Ramps are explicit entry landmarks rather than straight-line shortcuts.
  for(let i=0;i<m.size;i++)if(m.transitionMask[i]&&!m.blocked[i]&&!this.nodes.some(n=>m.floorLevel[n.cell]===m.floorLevel[i]&&distance(m,n.cell,i)<6))add(i,'entry');
  const owner=this.owner=new Int32Array(m.size).fill(-1),depth=this.depth=new Int32Array(m.size),q=new Int32Array(m.size);let head=0,tail=0;
  const seed=n=>{owner[n.cell]=n.index;q[tail++]=n.cell;};for(const n of this.nodes)seed(n);
  const flood=()=>{while(head<tail){const i=q[head++],a=owner[i];for(const j of neighbors(m,i))if(canStep(m,i,j)){
   const b=owner[j];if(b<0){owner[j]=a;depth[j]=depth[i]+1;q[tail++]=j;}
   else if(a!==b){const cost=depth[i]+depth[j]+1;if(cost<(this.nodes[a].edges.get(b)??Infinity)){this.nodes[a].edges.set(b,cost);this.nodes[b].edges.set(a,cost);}}
  }}};flood();
  // Isolated islands need their own landmark, never an invented crossing.
  for(let i=0;i<m.size;i++)if(!m.blocked[i]&&owner[i]<0){add(i,'island');seed(this.nodes.at(-1));flood();}
 }
 nodeAt(i){this.topology();return this.nodes[this.owner[i]]??null;}
 paths(from){
  if(this.routes.has(from.index))return this.routes.get(from.index);
  const costs=new Float64Array(this.nodes.length).fill(Infinity),previous=new Int32Array(costs.length).fill(-1),used=new Uint8Array(costs.length);costs[from.index]=0;
  for(let n=0;n<costs.length;n++){
   let best=-1;for(let i=0;i<costs.length;i++)if(!used[i]&&(best<0||costs[i]<costs[best]))best=i;
   if(best<0||!Number.isFinite(costs[best]))break;used[best]=1;
   for(const [next,cost] of this.nodes[best].edges)if(costs[best]+cost<costs[next]){costs[next]=costs[best]+cost;previous[next]=best;}
  }
  const result={costs,previous};this.routes.set(from.index,result);return result;
 }
 travel(a,b){
  const from=this.nodeAt(a),to=this.nodeAt(b);if(!from||!to)return Infinity;
  if(from===to)return distance(this.world.map,a,b);
  // Graph edges are reciprocal. Reuse either endpoint's tree so evaluating
  // many landmarks against one HQ never builds all-pairs shortest paths.
  const cost=this.routes.has(to.index)?this.routes.get(to.index).costs[from.index]:this.paths(from).costs[to.index];
  return this.depth[a]+cost+this.depth[b];
 }
 route(a,b){
  const from=this.nodeAt(a),to=this.nodeAt(b);if(!from||!to)return [];
  const {costs,previous}=this.paths(from);if(!Number.isFinite(costs[to.index]))return [];
  const out=[b];for(let i=to.index;i!==from.index;i=previous[i]){if(i<0)return [];if(this.nodes[i].cell!==b)out.push(this.nodes[i].cell);}
  // Each waypoint is in the same passable component. Navigation still owns
  // every step and its existing expansion budget; the planner never moves units.
  return out.reverse();
 }
 observe(){
  this.topology();const w=this.world,m=w.map,states=new Map();
  for(const squad of w.squads)if(squad.team===this.team){
   const units=squad.unitIds.map(id=>w.units[id-1]).filter(u=>u?.hp>0);if(!units.length)continue;
   const x=units.reduce((n,u)=>n+u.x,0)/units.length,y=units.reduce((n,u)=>n+u.y,0)/units.length;
   const leader=units.reduce((a,b)=>(Math.abs(a.x-x)+Math.abs(a.y-y)<=Math.abs(b.x-x)+Math.abs(b.y-y)?a:b));
   states.set(squad.id,{id:squad.id,squad,units,count:units.length,cell:cell(m,leader.x,leader.y),health:units.reduce((n,u)=>n+u.hp,0)/(100*units.length),power:units.reduce((n,u)=>n+u.hp/100,0)});
  }
  // This is the only enemy information admitted to strategic planning.
  const enemies=visibleEnemies(w,this.team).filter(u=>u.hp>0).map(u=>({id:u.id,cell:cell(m,u.x,u.y),hp:u.hp}));
  this.visibleIds=new Set(enemies.map(e=>e.id));
  const home=w.commandPosts.find(p=>p.team===this.team),enemy=w.commandPosts.find(p=>p.team!==this.team);
  for(const p of [home,enemy]){const node=this.nodeAt(p.center);if(node)this.paths(node);}
  const threats=enemies.filter(u=>distance(m,u.cell,home.center)<13);
  return {states,enemies,home,enemy,threats,time:w.tick};
 }
}
