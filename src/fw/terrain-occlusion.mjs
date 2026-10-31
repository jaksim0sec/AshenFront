// Pure view-only depth composition for terrain height and soldiers.
// floorLevel: 0=recessed, 1=ground, 2=raised; never changes movement/occupancy.
export const LEVEL_PX=22;
const HALF_W=72,HALF_H=42,BUCKET=16;
const EMPTY=Object.freeze([]),indexes=new WeakMap();
const key=(bx,by)=>bx+','+by;
const source=(b)=>b.floorLevel?.length===b.width*b.height?b.floorLevel:null;
export function terrainLevel(board,x,y){
 const levels=source(board);
 if(!levels||x<0||y<0||x>=board.width||y>=board.height)return 1;
 return levels[y*board.width+x]??1;
}
export function projectElevatedFoot(board,u){
 const x=u.visualX,y=u.visualY;
 let elevation=terrainLevel(board,u.x,u.y);
 const p=u.step;
 if(p&&p.duration>0){
  const t=Math.max(0,Math.min(1,p.elapsed/p.duration));
  if(p.via){
   const mid=terrainLevel(board,p.via.x,p.via.y);
   const finish=terrainLevel(board,p.x,p.y);
   elevation=t<.5?elevation+(mid-elevation)*t*2:mid+(finish-mid)*(t-.5)*2;
  }else elevation+=(terrainLevel(board,p.x,p.y)-elevation)*t;
 }
 return {x:(x-y)*HALF_W,y:(x+y)*HALF_H-(elevation-1)*LEVEL_PX};
}
function build(board,levels){
 const byBucket=new Map(),w=board.width,h=board.height;
 const push=(x,y,kind,edge,high,low,depth,screenX,order)=>{
  const item={x,y,kind,edge,level:high,low,depth,screenX,order};
  const k=key(Math.floor(x/BUCKET),Math.floor(y/BUCKET));
  let bucket=byBucket.get(k);
  if(!bucket)byBucket.set(k,bucket=[]);
  bucket.push(item);
 };
 const at=(x,y)=>x>=0&&y>=0&&x<w&&y<h?levels[y*w+x]:1;
 let order=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const height=at(x,y);
  if(height===at(x-1,y)&&height===at(x,y-1)&&height===at(x+1,y)&&height===at(x,y+1))continue;
  if(height>at(x-1,y)||height>at(x,y-1))
   push(x,y,'cap',null,height,0,x+y-.25-(height-1)*LEVEL_PX/HALF_H,x-y,order++);
  if(height>at(x+1,y))push(x,y,'wall','east',height,at(x+1,y),x+y+1-(at(x+1,y)-1)*LEVEL_PX/HALF_H+.02,x-y+.5,order++);
  if(height>at(x,y+1))push(x,y,'wall','south',height,at(x,y+1),x+y+1-(at(x,y+1)-1)*LEVEL_PX/HALF_H+.02,x-y-.5,order++);
 }
 return {levels,revision:board.floorLevelRevision??0,width:w,height:h,buckets:byBucket,query:null,visible:EMPTY,builds:1,candidates:0};
}
export function terrainOccluders(board,bounds){
 const levels=source(board);
 if(!levels)return EMPTY;
 let cache=indexes.get(board);
 if(!cache||cache.levels!==levels||cache.revision!==(board.floorLevelRevision??0)||cache.width!==board.width||cache.height!==board.height){
  const builds=cache?.builds||0;cache=build(board,levels);cache.builds+=builds;indexes.set(board,cache);
 }
 const x0=Math.max(0,Math.floor(bounds.x0)),x1=Math.min(board.width-1,Math.ceil(bounds.x1));
 const y0=Math.max(0,Math.floor(bounds.y0)),y1=Math.min(board.height-1,Math.ceil(bounds.y1));
 const q=key(x0,y0)+':'+key(x1,y1);
 if(q===cache.query)return cache.visible;
 const found=[];let candidates=0;
 for(let by=Math.floor(y0/BUCKET);by<=Math.floor(y1/BUCKET);by++)
  for(let bx=Math.floor(x0/BUCKET);bx<=Math.floor(x1/BUCKET);bx++){
   const list=cache.buckets.get(key(bx,by));if(!list)continue;
   candidates+=list.length;
   for(const item of list)if(item.x>=x0&&item.x<=x1&&item.y>=y0&&item.y<=y1)found.push(item);
  }
 found.sort((a,b)=>a.depth-b.depth||a.screenX-b.screenX||a.order-b.order);
 cache.query=q;cache.candidates=candidates;cache.visible=found.length?found:EMPTY;
 return cache.visible;
}
export function terrainOcclusionStats(board){
 const cache=indexes.get(board);
 return {builds:cache?.builds??0,candidates:cache?.candidates??0};
}
// Both streams are independently sorted; no combined sort or per-soldier terrain search.
export function mergeDepthLayers(units,faces,drawUnit,drawFace){
 let j=0;
 for(const unit of units){
  const depth=unit._renderFoot?unit._renderFoot.y/HALF_H:unit.visualX+unit.visualY;
  const lateral=unit._renderFoot?unit._renderFoot.x/HALF_W:unit.visualX-unit.visualY;
  while(j<faces.length&&(faces[j].depth<depth||faces[j].depth===depth&&faces[j].screenX<=lateral))
   drawFace(faces[j++]);
  drawUnit(unit);
 }
 while(j<faces.length)drawFace(faces[j++]);
}
