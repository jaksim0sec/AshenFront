export const HALF_W=72,HALF_H=42,LEVEL_PX=22;
export function project(x,y,h=1) {return {x:(x-y)*HALF_W,y:(x+y)*HALF_H-h*LEVEL_PX};}
export function unproject(px,py,h=1) {const s=(py+h*LEVEL_PX)/HALF_H,d=px/HALF_W;return {x:(s+d)/2,y:(s-d)/2};}
export const toScreen=(p,c)=>({x:p.x*c.zoom+c.x,y:p.y*c.zoom+c.y});
export function pickTile(m,sx,sy,c) {
 const px=(sx-c.x)/c.zoom,py=(sy-c.y)/c.zoom,candidates=new Set();
 for(let h=0;h<=2;h++) {
  const p=unproject(px,py,h);
  for(let y=Math.floor(p.y)-1;y<=Math.ceil(p.y)+1;y++) for(let x=Math.floor(p.x)-1;x<=Math.ceil(p.x)+1;x++)
   if(x>=0&&y>=0&&x<m.width&&y<m.height) candidates.add(y*m.width+x);
 }
 const hits=[];
 for(const i of candidates) {const p=project(i%m.width,Math.floor(i/m.width),m.floorLevel[i]);
  if(Math.abs(px-p.x)/HALF_W+Math.abs(py-p.y)/HALF_H<=1.000001) hits.push({i,depth:(i%m.width+Math.floor(i/m.width))*HALF_H});
 }
 hits.sort((a,b)=>b.depth-a.depth||b.i-a.i); return hits[0]?.i??-1;
}
