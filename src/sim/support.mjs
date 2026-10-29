import {cell,xy} from './world.mjs';import {lineOfSight,damage} from './combat.mjs';import {emit} from './state.mjs';
export function requestSupport(w,team,target) {
 const resource=w.support[team],m=w.map;
 if(!resource)return {ok:false,reason:'Invalid team'};
 if(!Number.isInteger(target)||target<0||target>=m.size||m.blocked[target])return {ok:false,reason:'지원할 수 없는 지역'};
 if(resource.uses<=0)return {ok:false,reason:'지원 횟수 소진'};
 if(w.tick<resource.nextTick)return {ok:false,reason:`지원 재사용까지 ${Math.ceil((resource.nextTick-w.tick)/20)}초`};
 const p=xy(m,target),owned=w.objectives.some(o=>o.owner===team&&!o.contested&&Math.abs(p.x-o.center%m.width)+Math.abs(p.y-Math.floor(o.center/m.width))<=o.radius);
 const seen=owned||w.units.some(u=>u.hp>0&&u.team===team&&lineOfSight(m,u,p));
 if(!seen)return {ok:false,reason:'아군 시야 또는 통제 지역이 필요합니다'};
 resource.uses--;resource.nextTick=w.tick+1200;const squads=new Set();
 for(const u of w.units)if(u.hp>0&&(u.x-p.x)**2+(u.y-p.y)**2<=9){squads.add(u.squadId);damage(w,u,15);}
 for(const id of squads){const s=w.squads[id-1];s.suppression=Math.min(100,s.suppression+15);s.lastThreatTick=w.tick;}
 for(let y=Math.max(0,p.y-3);y<=Math.min(m.height-1,p.y+3);y++)for(let x=Math.max(0,p.x-3);x<=Math.min(m.width-1,p.x+3);x++)if((x-p.x)**2+(y-p.y)**2<=9){const i=cell(m,x,y);m.coverCondition[i]=Math.max(0,m.coverCondition[i]-10);m.dirty.add(i);}
 m.revision++;emit(w,{kind:'impact',x:p.x,y:p.y,team});return {ok:true};
}
