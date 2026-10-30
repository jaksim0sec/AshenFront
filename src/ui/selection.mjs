/** Local player selection; never part of authoritative battle state. */
export class Selection {
 constructor(){this.ids=new Set();this.primary=0;this.additive=false;}
 choose(w,id,{additive=this.additive}={}){const s=w.squads[id-1];if(!s||s.team!=='A'||!s.unitIds.some(i=>w.units[i-1].hp>0))return false;if(!additive)this.ids.clear();if(additive&&this.ids.has(id)){this.ids.delete(id);this.primary=[...this.ids].at(-1)??0;}else{this.ids.add(id);this.primary=id;}return true;}
 set(w,ids){this.clear();for(const id of ids)this.choose(w,id,{additive:true});}
 clear(){this.ids.clear();this.primary=0;}
 prune(w){for(const id of this.ids)if(!w.squads[id-1]?.unitIds.some(i=>w.units[i-1].hp>0))this.ids.delete(id);if(!this.ids.has(this.primary))this.primary=[...this.ids].at(-1)??0;}
}
/** Distribute group anchors instead of ordering every squad onto one footprint. */
export function groupTargets(w,ids,target){
 if(ids.length===1)return new Map([[ids[0],target]]);
 const m=w.map,x=target%m.width,y=Math.floor(target/m.width),claimed=new Set(),out=new Map(),offsets=[[0,0]];
 for(let r=1;offsets.length<ids.length;r++)for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++)if(Math.max(Math.abs(xx),Math.abs(yy))===r)offsets.push([xx,yy]);
 for(let n=0;n<ids.length;n++){const gx=x+offsets[n][0]*7,gy=y+offsets[n][1]*7,candidates=[];
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const xx=Math.round(gx)+dx,yy=Math.round(gy)+dy,i=yy*m.width+xx;if(xx<0||yy<0||xx>=m.width||yy>=m.height||m.blocked[i]||claimed.has(i)||m.floorLevel[i]!==m.floorLevel[target])continue;candidates.push({i,d:dx*dx+dy*dy});}
  candidates.sort((a,b)=>a.d-b.d||a.i-b.i);if(candidates.length){out.set(ids[n],candidates[0].i);claimed.add(candidates[0].i);}
 }return out;
}
