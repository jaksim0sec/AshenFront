import {planBattlefield,distanceToPath} from './battlefield-plan.mjs';
export const terrainNames={grass:'개활지',soil:'흙',road:'길 · 이동 속도 +20%',forest:'연못 · 진입 불가'};
const E=1,S=2,W=4,N=8;
/** O(1) edge admission, reciprocal ramps are the only legal height transitions. */
export function canTraverseHeight(board,from,to){
 const levels=board.floorLevel;
 if(!levels)return true;
 if(from<0||to<0||from>=levels.length||to>=levels.length)return false;
 const a=levels[from],b=levels[to];
 if(a===b)return true;
 if(Math.abs(a-b)!==1)return false;
 const delta=to-from;
 const bit=delta===1?E:delta===-1?W:delta===board.width?S:delta===-board.width?N:0;
 return !!bit&&!!(board.heightRamps?.[from]&bit);
}
/** Previews for real in-game visual, depth and ramp/pathfinding tests. */
export function installHeightDemo(board){
 const w=board.width,h=board.height;
 if(w<80||h<60)return [];
 const levels=new Uint8Array(w*h).fill(1),ramps=new Uint8Array(w*h),features=[];
 const center=Math.round(w*.34),mid=Math.floor(h/2),mirrorX=x=>w-1-x;
 const rects=[
  {kind:'trench',level:0,x0:center-14,x1:center+2,y0:mid-2,y1:mid+2,
   // Two cells across a connected zigzag; a narrower cut instead of a broad dark strip.
   bed:(x,y)=>{const cy=mid+(x<center-10?0:x<center-7?1:x<center-4?0:x<center-1?-1:0);return y===cy||y===cy+1;},
   entrance:{x:center-14,y:mid,fromX:center-15}},
  {kind:'hill',level:2,x0:center+4,x1:center+9,y0:mid-5,y1:mid,entrance:{x:center+4,y:mid-2,fromX:center+3}}
 ];
 for(const mirrored of [false,true])for(const rect of rects){
  const x0=mirrored?mirrorX(rect.x1):rect.x0,x1=mirrored?mirrorX(rect.x0):rect.x1;
  // Never create invisible or inaccessible geometry atop the river/coast.
  if(x0<2||x1>=w-2||rect.y0<2||rect.y1>=h-2)continue;
  let clear=true;
  for(let y=rect.y0-1;y<=rect.y1+1&&clear;y++)
   for(let x=x0-1;x<=x1+1;x++)if(board.navigation.blocked(y*w+x)){clear=false;break;}
  if(!clear)continue;
  for(let y=rect.y0;y<=rect.y1;y++)for(let x=x0;x<=x1;x++)
   if(!rect.bed||rect.bed(mirrored?mirrorX(x):x,y))levels[y*w+x]=rect.level;
  const insideX=mirrored?mirrorX(rect.entrance.x):rect.entrance.x;
  const outsideX=mirrored?mirrorX(rect.entrance.fromX):rect.entrance.fromX;
  const ry=rect.entrance.y,from=ry*w+outsideX,to=ry*w+insideX;
  // Keep one explicit approach per sample; no silently walkable cliff wall.
  const bit=to===from+1?E:W,other=bit===E?W:E;
  ramps[from]|=bit;ramps[to]|=other;
  // The second ramp makes the sample a traversable battlefield corridor.
  const farInsideX=mirrored?mirrorX(rect.x1):rect.x1,farOutsideX=mirrored?mirrorX(rect.x1+1):rect.x1+1;
  const farInside=ry*w+farInsideX,farOutside=ry*w+farOutsideX;
  const farBit=farOutside===farInside+1?E:W;
  ramps[farInside]|=farBit;ramps[farOutside]|=farBit===E?W:E;
  features.push({team:mirrored?'B':'A',kind:rect.kind,x:mirrored?mirrorX(Math.floor((rect.x0+rect.x1)/2)):Math.floor((rect.x0+rect.x1)/2),y:Math.floor((rect.y0+rect.y1)/2),
   x0,x1,y0:rect.y0,y1:rect.y1,entrance:{x:insideX,y:ry,fromX:outsideX},exit:{x:farInsideX,y:ry,toX:farOutsideX}});
 }
 board.floorLevel=levels;board.heightRamps=ramps;board.floorLevelRevision=(board.floorLevelRevision||0)+1;
 return features;
}
export function terrainAt(board,x,y){return board.terrain[Math.round(y)]?.[Math.round(x)]||'grass';}
export function terrainStepMultiplier(board,from,to){
 const speed=p=>terrainAt(board,p.x,p.y)==='road'?1.2:1;
 return 2/(speed(from)+speed(to));
}
// Expand the battle space without expanding the per-frame rendering footprint.
export const BATTLEFIELD_WIDTH=512;
export const BATTLEFIELD_HEIGHT=384;
// Strategic coordinates keep doctrine proportions while local combat distances
// and movement speed remain in actual tiles.
export const fieldX=(board,x)=>Math.round(x*(board.width-1)/99);
export const fieldY=(board,y)=>Math.round(y*(board.height-1)/99);
export const battlefieldLanes=board=>board.battlefield?.lanes||[20,50,80].map(y=>fieldY(board,y));
export function battlefieldLane(board,y){
 const lanes=battlefieldLanes(board);let best=0;
 for(let i=1;i<lanes.length;i++)if(Math.abs(y-lanes[i])<Math.abs(y-lanes[best]))best=i;
 return best;
}
function randomFor(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function interpolate(knots,x){
 for(let i=1;i<knots.length;i++)if(x<=knots[i][0]){const [a,u]=knots[i-1],[b,v]=knots[i];return u+(v-u)*smooth((x-a)/(b-a));}
 return knots.at(-1)[1];
}
/** Tactical graph -> corridor/room reservations -> defensive shores -> coast. */
export function createBattlefield(board){
 const random=randomFor(board.seed),w=board.width,h=board.height,sx=(w-1)/143,sy=(h-1)/111;
 const plan=planBattlefield(w,h,random),protectedCells=new Uint8Array(w*h);
 // Rasterize bounded feature boxes, not every feature against every map tile.
 for(const feature of [...plan.paths,...plan.rooms]){
  const points=feature.points||[feature],rx=feature.radius??feature.rx,ry=feature.radius??feature.ry;
  const minX=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-rx)),maxX=Math.min(w-1,Math.ceil(Math.max(...points.map(p=>p.x))+rx));
  const minY=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-ry)),maxY=Math.min(h-1,Math.ceil(Math.max(...points.map(p=>p.y))+ry));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   const d=feature.points?distanceToPath(x,y,points)-rx:(Math.hypot((x-feature.x)/rx,(y-feature.y)/ry)-1)*Math.min(rx,ry);
   if(d<=.71)protectedCells[y*w+x]=1;
  }
 }
 const coast=[[0,0],[5,12],[17,27],[34,36],[58,43],[78,43],[107,37],[127,28],[138,13],[143,0]];
 const shores=[-1,1].map(sign=>({sign,phase:random()*6.28,knots:coast.map(([x,y],i)=>[x,y+(i===0||i===coast.length-1?0:(random()-.5)*4)])}));
 const upper=[],lower=[];
 for(let x=0;x<w;x++){
  const u=x/sx;
  upper[x]=Math.ceil((55.5-interpolate(shores[0].knots,u)-Math.sin(u*.09+shores[0].phase))*sy);
  lower[x]=Math.floor((55.5+interpolate(shores[1].knots,u)+Math.sin(u*.09+shores[1].phase))*sy);
  // A minimum two-tile setback separates flank traffic from the irregular rim.
  for(let y=0;y<h;y++)if(protectedCells[y*w+x]){upper[x]=Math.min(upper[x],Math.max(0,y-3));lower[x]=Math.max(lower[x],Math.min(h-1,y+3));}
 }
 const water=new Uint8Array(w*h);
 for(const bank of plan.defenses){
  const r=bank.radius+1,minX=Math.max(0,Math.floor(Math.min(...bank.points.map(p=>p.x))-r)),maxX=Math.min(w-1,Math.ceil(Math.max(...bank.points.map(p=>p.x))+r));
  const minY=Math.max(0,Math.floor(Math.min(...bank.points.map(p=>p.y))-r)),maxY=Math.min(h-1,Math.ceil(Math.max(...bank.points.map(p=>p.y))+r));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   const ripple=Math.sin(x*.32+y*.19+bank.phase)*.45;
   if(!protectedCells[y*w+x]&&distanceToPath(x,y,bank.points)<bank.radius+ripple)water[y*w+x]=1;
  }
 }
 board.obstacles.clear();
 const soils=plan.rooms.filter(r=>r.kind==='staging'&&!r.id.startsWith('flank-')).map(r=>({...r,rx:r.rx*(.7+random()*.3),ry:r.ry*(.25+random()*.15)}));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const n=y*w+x,outside=y<upper[x]||y>lower[x]||x<1||x>w-2;
  const soil=!outside&&!water[n]&&soils.some(r=>((x-r.x)/r.rx)**2+((y-r.y)/r.ry)**2<1+Math.sin(x*.4+y*.3)*.12);
  const terrain=outside?'void':water[n]?'forest':soil?'soil':'grass';board.terrain[y][x]=terrain;
  if(outside||water[n])board.obstacles.set(n,{kind:outside?'void':'forest',blocked:true,...(!outside&&y<h/2?{visual:'rock'}:{})});
 }
 const outline=[];
 for(let x=1;x<w-1;x++)if(upper[x]<=lower[x])outline.push({x:x-.5,y:upper[x]-.5});
 for(let x=w-2;x>=1;x--)if(upper[x]<=lower[x])outline.push({x:x+.5,y:lower[x]+.5});
 const heightDemo=installHeightDemo(board);
 board.battlefield={seed:board.seed,...plan,visualVersion:'autumn-v1',clearing:plan.rooms.find(r=>r.kind==='battle'),outline,upper,lower,protectedCells,decorations:[],heightDemo};
 board.terrainRevision++;board.obstacleRevision++;board.navigation.invalidate();
}
