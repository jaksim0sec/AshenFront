import {cell,canStep,neighbors} from './world.mjs';
import {formationOffsets,validFormation} from './formations.mjs';

const preparations=new WeakMap(),worldPreparations=new WeakMap();
const failure=reason=>({ok:false,placed:0,reason});

// Preparation belongs to the runtime: callers must not tick the world until
// beginBattle succeeds. Reserve actors stay in their original ID/index slots.
export function createDeployment(w){
 if(worldPreparations.has(w))return worldPreparations.get(w);
 if(w.tick!==0||w.winner)throw Error('Deployment requires a fresh match');
 const records=w.squads.filter(s=>s.team==='A').map(s=>({squad:s,units:s.unitIds.map(id=>w.units[id-1]),formation:'line'}));
 const total=records.reduce((n,r)=>n+r.units.length,0);
 if(total>40||records.some(r=>r.units.some(u=>!u||u.hp<=0)))throw Error('Deployment requires at most 40 living player actors');
 const p={phase:'preparation',team:'A',total,remaining:total,deployed:0,reserveSquadIds:records.map(r=>r.squad.id),deployedSquadIds:[]};
 for(const r of records){
  r.positions=r.units.map(u=>cell(w.map,u.x,u.y));r.health=r.units.map(u=>u.hp);
  for(const u of r.units){
   const i=cell(w.map,u.x,u.y);if(w.map.occupancy[i]===u.id)w.map.occupancy[i]=0;
   for(let n=0;n<w.map.size;n++)if(w.map.reservation[n]===u.id)w.map.reservation[n]=0;
   u.hp=0;u.deployed=false;u.moveTo=-1;u.moveProgress=0;u.wait=0;
  }
  r.squad.deployed=false;
 }
 w.spatialRevision=(w.spatialRevision??0)+1;
 preparations.set(p,{world:w,records});worldPreparations.set(w,p);return p;
}

function context(w,p){const state=preparations.get(p);return state?.world===w&&p.phase==='preparation'?state:null;}
function point(m,target){
 if(Number.isInteger(target)&&target>=0&&target<m.size)return {x:target%m.width,y:Math.floor(target/m.width)};
 if(target&&Number.isInteger(target.x)&&Number.isInteger(target.y)&&target.x>=0&&target.y>=0&&target.x<m.width&&target.y<m.height)return {x:target.x,y:target.y};
 return null;
}
function validate(w,anchor,positions,taken){
 const m=w.map;
 if(!anchor||anchor.x>=m.width/2)return 'outside_territory';
 const cells=[];
 for(const p of [anchor,...positions]){
  if(p.x<0||p.y<0||p.x>=m.width||p.y>=m.height)return 'outside_map';
  if(p.x>=m.width/2)return 'outside_territory';
  const i=cell(m,p.x,p.y);
  if(m.blocked[i])return 'blocked';
  if(m.occupancy[i]||taken.has(i))return 'occupied';
  if(m.reservation[i])return 'reserved';
  cells.push(i);
 }
 const seats=cells.slice(1);if(new Set(seats).size!==seats.length)return 'overlap';
 const wanted=new Set(seats),seen=new Set([cells[0]]),queue=[cells[0]];wanted.delete(cells[0]);
 for(let at=0;at<queue.length&&wanted.size;at++)for(const i of neighbors(m,queue[at])){
  if(seen.has(i)||i%m.width>=m.width/2||!canStep(m,queue[at],i)||m.occupancy[i]||m.reservation[i]||taken.has(i))continue;
  seen.add(i);queue.push(i);wanted.delete(i);
 }
 return wanted.size?'disconnected':null;
}
function plan(w,record,target,formation,taken=new Set()){
 if(!validFormation(formation))return failure('invalid_formation');
 const anchor=point(w.map,target);if(!anchor)return failure('outside_map');
 const positions=formationOffsets(formation,record.units.length).map(p=>({x:anchor.x+p.x,y:anchor.y+p.y}));
 const reason=validate(w,anchor,positions,taken);
 return reason?failure(reason):{ok:true,record,positions,formation};
}
function commit(w,p,plans){
 let placed=0;
 for(const planned of plans){
  const {record,positions,formation}=planned;
  record.units.forEach((u,n)=>{
   u.x=positions[n].x;u.y=positions[n].y;u.hp=record.health[n];u.deployed=true;
   w.map.occupancy[cell(w.map,u.x,u.y)]=u.id;
  });
  record.squad.deployed=true;record.squad.formation=formation;
  p.reserveSquadIds.splice(p.reserveSquadIds.indexOf(record.squad.id),1);p.deployedSquadIds.push(record.squad.id);placed+=record.units.length;
 }
 p.remaining-=placed;p.deployed+=placed;
 if(placed)w.spatialRevision=(w.spatialRevision??0)+1;
 return placed;
}

// Exact seats preserve the chosen formation. A failed placement changes nothing.
export function deployNext(w,p,target,formation='line'){
 const state=context(w,p);if(!state)return failure('not_preparation');
 const record=state.records.find(r=>p.reserveSquadIds.includes(r.squad.id));if(!record)return failure('no_reserves');
 const planned=plan(w,record,target,formation);if(!planned.ok)return planned;
 return {ok:true,squadId:record.squad.id,placed:commit(w,p,[planned])};
}

// Plan all remaining squads before committing any. Prefer their authored spawn
// cells, then find another legal footprint if a manual placement occupies them.
export function autoDeploy(w,p){
 const state=context(w,p);if(!state)return failure('not_preparation');
 const plans=[],taken=new Set(),m=w.map;
 for(const record of state.records.filter(r=>p.reserveSquadIds.includes(r.squad.id))){
  const positions=record.positions.map(i=>({x:i%m.width,y:Math.floor(i/m.width)}));
  let planned=validate(w,positions[0],positions,taken)?null:{ok:true,record,positions,formation:record.formation};
  for(let y=1;!planned&&y<m.height;y++)for(let x=0;!planned&&x<m.width/2;x++){
   const candidate=plan(w,record,{x,y},'line',taken);if(candidate.ok)planned=candidate;
  }
  if(!planned)return failure('no_deployment_space');
  plans.push(planned);for(const pos of planned.positions)taken.add(cell(m,pos.x,pos.y));
 }
 return {ok:true,placed:commit(w,p,plans)};
}

// Starting battle automatically deploys the remaining reserves. Failure leaves
// the preparation and every actor unchanged, so the runtime must stay paused.
export function beginBattle(w,p){
 const result=autoDeploy(w,p);if(!result.ok)return result;
 p.phase='battle';return {...result,phase:'battle'};
}
