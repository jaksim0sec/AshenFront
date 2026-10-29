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
 const hits=[],faceHits=[];
 for(const i of candidates) {
  for(const face of tileFaces(m,i))if(insidePolygon(px,py,face))faceHits.push({i,depth:(i%m.width+Math.floor(i/m.width))*HALF_H});
  const p=project(i%m.width,Math.floor(i/m.width),m.floorLevel[i]);
  if(Math.abs(px-p.x)/HALF_W+Math.abs(py-p.y)/HALF_H<=1.000001) hits.push({i,depth:(i%m.width+Math.floor(i/m.width))*HALF_H});
 }
 if(faceHits.length){faceHits.sort((a,b)=>b.depth-a.depth||b.i-a.i);return faceHits[0].i;}
 hits.sort((a,b)=>b.depth-a.depth||b.i-a.i); return hits[0]?.i??-1;
}
// The view and pointer hit areas share this non-authoritative interpolation.
export function unitFoot(m,u,alpha=0) {
 let x=u.x,y=u.y,h=m.floorLevel[y*m.width+x];
 if(u.moveTo>=0){const f=Math.min(1,(u.moveProgress+alpha)/8),tx=u.moveTo%m.width,ty=Math.floor(u.moveTo/m.width);x+=(tx-x)*f;y+=(ty-y)*f;h+=(m.floorLevel[u.moveTo]-h)*f;}
 return project(x,y,h);
}

export function tileFaces(m,i) {
 const x=i%m.width,y=Math.floor(i/m.width),h=m.floorLevel[i],p=project(x,y,h),faces=[];
 for(const [j,pts] of [[x+1<m.width?i+1:-1,[[p.x,p.y+HALF_H],[p.x+HALF_W,p.y]]],[y+1<m.height?i+m.width:-1,[[p.x-HALF_W,p.y],[p.x,p.y+HALF_H]]]]) {
  const low=j<0?0:m.floorLevel[j]; if(h>low) {const drop=(h-low)*LEVEL_PX;faces.push([...pts,[pts[1][0],pts[1][1]+drop],[pts[0][0],pts[0][1]+drop]]);}
 }
 return faces;
}

function insidePolygon(x,y,points){let sign=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],cross=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(Math.abs(cross)<1e-7)continue;const s=Math.sign(cross);if(sign&&s!==sign)return false;sign=s;}return true;}
