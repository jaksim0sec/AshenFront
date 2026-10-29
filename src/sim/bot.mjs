// Intents depend only on public objective data and own squads. No hidden enemy reads.
export function runBots(w) {
 if(!w.objectives.length)return;
 for(const s of w.squads) {
  if(!w.botTeams.includes(s.team)||w.tick%20!==s.id%20||s.suppressed||w.tick-s.lastOrderTick<60)continue;
  const n=w.squads.filter(v=>v.team===s.team).indexOf(s),o=w.objectives[n%w.objectives.length];
  if(!s.unitIds.some(id=>w.units[id-1].hp>0))continue;
  // Four nearby approach regions distribute incoming squads across the sector.
  const dx=n%2===0?-1:1,dy=Math.floor(n/2)%2===0?-1:1,goal=o.center+dx+dy*w.map.width;
  if(s.order!=='hold'&&s.goal===goal)continue;
  w.queue.push({team:s.team,type:'move',squadId:s.id,target:goal,radius:2});
 }
}
