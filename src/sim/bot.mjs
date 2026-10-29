// Intents depend only on public objective data and own squads. No hidden enemy reads.
export function runBots(w) {
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
