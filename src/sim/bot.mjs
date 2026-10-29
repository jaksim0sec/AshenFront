import {visibleEnemies} from './combat.mjs';
// Intents depend only on public objective data and own squads. No hidden enemy reads.
export function runBots(w) {
 if(w.scenario==='war'){runWarBots(w);return;}
 if(!w.objectives.length)return;
 for(const s of w.squads) {
  if(!w.botTeams.includes(s.team)||w.tick%20!==s.id%20||s.suppressed||w.tick-s.lastOrderTick<60)continue;
  const n=w.squads.filter(v=>v.team===s.team).indexOf(s),o=w.objectives[n%w.objectives.length];
  const living=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0);if(!living.length)continue;
  const x=o.center%w.map.width,y=Math.floor(o.center/w.map.width);
  s.approachSide??=living[0].x<x?-1:1;
  if(living.some(u=>Math.abs(u.x-x)+Math.abs(u.y-y)<=10))s.botStage='objective';
  // Separate approach waypoints, then one shared 41-cell landing region.
  // Four radius-2 final regions overlap and cannot hold 40 soldiers reliably.
  const final=s.botStage==='objective',goal=final?o.center:o.center+s.approachSide*8+(n%2?4:-4)*w.map.width,radius=final?4:2;
  if(s.order!=='hold'&&s.goal===goal&&s.radius===radius)continue;
  w.queue.push({team:s.team,type:'move',squadId:s.id,target:goal,radius});
 }
}

function runWarBots(w){
 for(const team of w.botTeams){const allies=w.squads.filter(s=>s.team===team&&s.unitIds.some(id=>w.units[id-1].hp>0)),home=w.commandPosts.find(p=>p.team===team),enemy=w.commandPosts.find(p=>p.team!==team);if(!home||!enemy)continue;
  if(!allies.some(s=>w.tick%20===s.id%20&&w.tick-s.lastOrderTick>=60&&!s.suppressed))continue;
  const visible=visibleEnemies(w,team);const hx=home.center%w.map.width,hy=Math.floor(home.center/w.map.width),threat=visible.some(u=>Math.abs(u.x-hx)+Math.abs(u.y-hy)<12);
  for(let n=0;n<allies.length;n++){const s=allies[n];if(w.tick%20!==s.id%20||w.tick-s.lastOrderTick<60||s.suppressed)continue;
   const guard=n===0&&allies.length>1;s.role=guard?'guard':'advance';let target;
   if(guard||(threat&&n===1&&allies.length>2))target=home.center;
   else {const live=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0),ex=enemy.center%w.map.width,ey=Math.floor(enemy.center/w.map.width);
    const flank=n%2?-6:6,waypoint=cellFor(w,Math.floor(w.map.width/2),ey+flank);
    if(live.some(u=>Math.abs(u.x-Math.floor(w.map.width/2))+Math.abs(u.y-ey-flank)<8))s.warStage='assault';
    target=s.warStage==='assault'?enemy.center:waypoint;
   }
   if(s.goal===target&&s.order!=='hold')continue;w.queue.push({team,type:'move',squadId:s.id,target,radius:3});
  }
 }
}
function cellFor(w,x,y){return Math.max(0,Math.min(w.map.height-1,y))*w.map.width+x;}
