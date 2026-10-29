import {createMap,cell,canStep} from './world.mjs';
import {Navigation} from './navigation.mjs';
export function createGame({seed=1977,map=createMap(),squadsPerTeam=4,botTeams=['B'],combat=true}={}) {
 const w={map,tick:0,seed:seed||1,initialSeed:seed||1,units:[],squads:[],objectives:[],winner:null,botTeams,combat,navigation:new Navigation(map),queue:[],commandLog:[],events:[],eventId:0,scores:{A:0,B:0},limitTicks:9600,holdTicks:900,requiredSectors:1,teamHold:{A:0,B:0},support:{A:{uses:2,nextTick:0},B:{uses:2,nextTick:0}},metrics:{navExpansions:0,moves:0,shots:0,queries:0,losChecks:0,movingTicks:{A:0,B:0},blocked:{},captures:{A:0,B:0}}};
 for(const team of ['A','B']) for(let n=0;n<squadsPerTeam;n++) {
  const sectors=map.height===48?[24]:[Math.floor(map.height*.23),Math.floor(map.height*.5),Math.floor(map.height*.77)];
  const cy=sectors[n%sectors.length];
  spawnSquad(w,team,team==='A'?5+Math.floor(n/2)*3:map.width-7-Math.floor(n/2)*3,map.height===48?cy-8+(n%2)*10:cy-9+Math.floor(n/sectors.length)*6);
 }
 return w;
}
export function spawnSquad(w,team,x,y,count=10) {
 const s={id:w.squads.length+1,team,unitIds:[],order:'hold',goal:null,radius:3,suppression:0,suppressed:false,lastThreatTick:-100,lastOrderTick:-100,movementBlockedReason:null,reached:false};
 for(let n=0;n<count;n++) {
  const ux=x+n%2,uy=y+Math.floor(n/2),i=cell(w.map,ux,uy);
  if(ux<0||uy<0||ux>=w.map.width||uy>=w.map.height||w.map.blocked[i]||w.map.occupancy[i])throw Error('Invalid spawn');
  const u={id:w.units.length+1,team,squadId:s.id,x:ux,y:uy,hp:100,nextFireTick:(w.units.length+1)%30,moveTo:-1,moveProgress:0,wait:0};
  w.units.push(u);s.unitIds.push(u.id);w.map.occupancy[i]=u.id;
 }
 w.squads.push(s);return s;
}
export function assertInvariants(w) {
 const occupied=new Set(),reserved=new Set();
 for(const u of w.units) {
  const i=cell(w.map,u.x,u.y);
  if(u.hp<=0){if(w.map.occupancy[i]===u.id||w.map.reservation.includes(u.id))throw Error('Ghost actor');continue;}
  if(occupied.has(i)||w.map.occupancy[i]!==u.id||w.map.blocked[i])throw Error('Occupancy mismatch');occupied.add(i);
  if(u.moveTo>=0){if(reserved.has(u.moveTo)||w.map.reservation[u.moveTo]!==u.id||!canStep(w.map,i,u.moveTo))throw Error('Reservation mismatch');reserved.add(u.moveTo);}
 }
 for(let i=0;i<w.map.size;i++) {
  if(w.map.occupancy[i]&&!occupied.has(i))throw Error('Orphan occupancy');
  if(w.map.reservation[i]&&!reserved.has(i))throw Error('Orphan reservation');
 }
 for(const s of w.squads)for(const id of s.unitIds)if(w.units[id-1]?.squadId!==s.id)throw Error('Squad reference');
 return true;
}
export function emit(w,event) {w.events.push({...event,eventId:++w.eventId,tick:w.tick});if(w.events.length>160)w.events.shift();}
