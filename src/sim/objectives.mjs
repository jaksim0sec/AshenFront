import {cell} from './world.mjs';import {emit} from './state.mjs';
export function initializeObjectives(w,count=1) {
 const m=w.map,ys=count===1?[Math.floor(m.height/2)]:[Math.floor(m.height*.23),Math.floor(m.height*.5),Math.floor(m.height*.77)];
 w.objectives=ys.map((y,n)=>({id:n+1,center:cell(m,Math.floor(m.width/2),y),radius:4,owner:null,contested:false,progressTicks:0,presence:{A:0,B:0}}));
 if(count>1){w.limitTicks=24000;w.holdTicks=1500;w.requiredSectors=2;}
}
export function updateObjectives(w) {
 if(w.scenario==='war'){if(!w.winner)updateWar(w);return;}
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
 if(w.tick+1>=w.limitTicks&&!w.winner){const ownership=team=>w.objectives.filter(o=>o.owner===team&&!o.contested).length,delta=w.objectives.length===1?(ownership('A')-ownership('B')||w.scores.A-w.scores.B):w.scores.A-w.scores.B;w.winner=delta>0?'A':delta<0?'B':'draw';}
}

export function initializeWar(w){
 const m=w.map;w.scenario='war';w.limitTicks=null;w.holdTicks=null;
 w.commandPosts=['A','B'].map(team=>({id:'HQ-'+team,name:team==='A'?'Arken HQ':'Velian HQ',team,center:cell(m,team==='A'?6:m.width-7,Math.floor(m.height/2)),radius:4,contested:false,capturedBy:null}));
 const ys=[Math.floor(m.height*.25),Math.floor(m.height*.5),Math.floor(m.height*.75)];
 w.objectives=ys.map((y,n)=>({id:n+1,name:['North ridge','Central trench','South ridge'][n],center:cell(m,Math.floor(m.width/2),y),radius:4,owner:null,contested:false,progressTicks:0,presence:{A:0,B:0}}));
}
function presence(w,point){const p={A:0,B:0},x=point.center%w.map.width,y=Math.floor(point.center/w.map.width);for(const u of w.units)if(u.hp>0&&Math.abs(u.x-x)+Math.abs(u.y-y)<=point.radius)p[u.team]++;return p;}
export function updateWar(w){
 const wins={A:false,B:false};
 for(const post of w.commandPosts){const p=presence(w,post),enemy=post.team==='A'?'B':'A';post.contested=p.A>0&&p.B>0;if(p[enemy]>0&&!p[post.team]){post.capturedBy=enemy;wins[enemy]=true;}}
 for(const team of ['A','B'])if(!w.units.some(u=>u.hp>0&&u.team===team))wins[team==='A'?'B':'A']=true;
 if(wins.A||wins.B){w.winner=wins.A&&wins.B?'draw':wins.A?'A':'B';return;}
 if(w.tick%5===0)for(const sector of w.objectives){const p=presence(w,sector);sector.presence=p;sector.contested=p.A>0&&p.B>0;if(!sector.contested&&(p.A||p.B)){const owner=p.A?'A':'B';if(sector.owner!==owner){sector.owner=owner;w.metrics.captures[owner]++;}w.scores[owner]+=5;}}
}
