// Tiny, deterministic subcell separation. No all-pairs scan and no
// physics solver: only the eight adjacent logical cells, with a hard cap
// below half a tile so no render position escapes its reserved footprint.
export const MAX_SEPARATION_OFFSET=.18;
const RADIUS=1.25;
const clamp=v=>Math.max(-MAX_SEPARATION_OFFSET,Math.min(MAX_SEPARATION_OFFSET,v));
export function separationOffset(board,unit){
  if(!unit||unit.health?.current<=0)return {x:0,y:0};
  const {x,y}=unit;
  let sx=0,sy=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;
    if(!board.inside(nx,ny))continue;
    const key=ny*board.width+nx;
    for(let source=0;source<2;source++){
      const id=source===0?board.cells.get(key):board.reservations.get(key);
      if(id==null||id===unit.id)continue;
      const other=board.unit(id);
      // A moving unit appears at source and reservation. If its source
      // lies inside this 3x3 window it has already been counted once.
      if(source===1&&other&&Math.abs(other.x-x)<=1&&Math.abs(other.y-y)<=1)continue;
      if(!other||other.health.current<=0)continue;
      // For a cell reservation, anticipate its destination.
      const ox=other.step?.x??other.x,oy=other.step?.y??other.y;
      const rx=x-ox,ry=y-oy,d2=rx*rx+ry*ry;
      if(d2<1e-8||d2>=RADIUS*RADIUS)continue;
      const distance=Math.sqrt(d2),magnitude=(RADIUS-distance)/RADIUS*.55;
      sx+=rx/distance*magnitude;sy+=ry/distance*magnitude;
    }
  }
  return {x:clamp(sx),y:clamp(sy)};
}
