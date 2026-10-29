import {cell} from './world.mjs';import {emit} from './state.mjs';
export function initializeObjectives(w,count=1) {
 const m=w.map,ys=count===1?[Math.floor(m.height/2)]:[Math.floor(m.height*.23),Math.floor(m.height*.5),Math.floor(m.height*.77)];
 w.objectives=ys.map((y,n)=>({id:n+1,center:cell(m,Math.floor(m.width/2),y),radius:4,owner:null,contested:false,progressTicks:0,presence:{A:0,B:0}}));
 if(count>1){w.limitTicks=24000;w.holdTicks=1500;w.requiredSectors=2;}
}
export function updateObjectives(w) {
 if(w.winner)return;
 if((w.tick+1)%5===0){
  const control={A:0,B:0};
  for(const o of w.objectives) {
   const x=o.center%w.map.width,y=Math.floor(o.center/w.map.width),p={A:0,B:0};
   for(const u of w.units)if(u.hp>0&&Math.abs(u.x-x)+Math.abs(u.y-y)<=o.radius)p[u.team]++;
   o.presence=p;o.contested=!!(p.A&&p.B);if(o.contested||(!p.A&&!p.B))continue;
   const team=p.A?'A':'B';if(o.owner!==team){o.owner=team;o.progressTicks=0;w.metrics.captures[team]++;emit(w,{kind:'capture',x,y,team});}
   o.progressTicks+=5;w.scores[team]+=5;control[team]++;
   if(w.objectives.length===1&&o.progressTicks>=w.holdTicks)w.winner=team;
  }
  if(w.objectives.length>1)for(const team of ['A','B']){w.teamHold[team]=control[team]>=w.requiredSectors?w.teamHold[team]+5:0;if(w.teamHold[team]>=w.holdTicks)w.winner=team;}
 }
 if(w.tick+1>=w.limitTicks&&!w.winner){const ownership=team=>w.objectives.filter(o=>o.owner===team&&!o.contested).length,delta=ownership('A')-ownership('B')||w.scores.A-w.scores.B;w.winner=delta>0?'A':delta<0?'B':'draw';}
}
