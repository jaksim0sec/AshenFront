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
  // Surface diamonds are already in the cached terrain. Do not repaint over actors.
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
export function compareProjectedUnits(a,b){
 const ay=a._renderFoot?.y??(a.visualX+a.visualY)*HALF_H;
 const by=b._renderFoot?.y??(b.visualX+b.visualY)*HALF_H;
 // Ground X+Y determines camera depth; projected foot Y includes elevation.
 return (a.visualX+a.visualY)-(b.visualX+b.visualY)
  ||ay-by
  ||(a._renderFoot?.x??(a.visualX-a.visualY)*HALF_W)-(b._renderFoot?.x??(b.visualX-b.visualY)*HALF_W)
  ||a.id-b.id;
}
export function terrainTransitionPose(board,u){
 const step=u.step;
 if(!step||!(step.duration>0))return 0;
 const origin=terrainLevel(board,u.x,u.y),destination=terrainLevel(board,step.x,step.y);
 if(origin===destination)return 0;
 const t=Math.max(0,Math.min(1,step.elapsed/step.duration));
 return Math.sign(destination-origin)*Math.sin(Math.PI*t);
}

const MASK_RANGE=4,MASK_HALF_WIDTH=260,MASK_UP=320,MASK_DOWN=160;
function surfaceDiamond(x,y,h){
 const px=(x-y)*HALF_W,py=(x+y)*HALF_H-(h-1)*LEVEL_PX;
 return [{x:px,y:py-HALF_H,d:x+y-1},{x:px+HALF_W,y:py,d:x+y},
  {x:px,y:py+HALF_H,d:x+y+1},{x:px-HALF_W,y:py,d:x+y}];
}
function surfaceInFront(vertices,depth){
 const out=[];
 for(let k=0;k<vertices.length;k++){
  const a=vertices[k],b=vertices[(k+1)%vertices.length];
  const inside=a.d>depth,next=b.d>depth;
  if(inside)out.push({x:a.x,y:a.y});
  if(inside!==next){
   const t=(depth-a.d)/(b.d-a.d);
   out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  }
 }
 return out;
}
function overlapsSprite(poly,foot){
 if(poly.length<3)return false;
 let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
 for(const p of poly){l=Math.min(l,p.x);r=Math.max(r,p.x);t=Math.min(t,p.y);b=Math.max(b,p.y);}
 return l<foot.x+MASK_HALF_WIDTH&&r>foot.x-MASK_HALF_WIDTH&&t<foot.y+MASK_DOWN&&b>foot.y-MASK_UP;
}
/** Return ONLY the physically foreground fragments relevant to this one actor.
 * Camera depth is continuous world X+Y. Screen Y is not a depth coordinate.
 * Slicing a face at the actor's position handles competition within one tile.
 */
export function terrainCoverPolygons(board,u){
 if(!source(board))return EMPTY;
 const x=u.visualX,y=u.visualY,depth=x+y+1e-4;
 const foot=u._renderFoot??projectElevatedFoot(board,u);
 const altitude=1+((x+y)*HALF_H-foot.y)/LEVEL_PX;
 const out=[];
 const add=poly=>{if(overlapsSprite(poly,foot))out.push(poly);};
 for(let ty=Math.max(0,Math.floor(y)-MASK_RANGE);ty<=Math.min(board.height-1,Math.ceil(y)+MASK_RANGE);ty++)
 for(let tx=Math.max(0,Math.floor(x)-MASK_RANGE);tx<=Math.min(board.width-1,Math.ceil(x)+MASK_RANGE);tx++){
  const h=terrainLevel(board,tx,ty),base=tx+ty;
  // Upper ground in front of a trench occupant can occlude their feet.
  // Ground at or below the soldier's supporting height never obscures them.
  if(h>altitude+.01&&base+1>depth)
   add(surfaceInFront(surfaceDiamond(tx,ty,h),depth));
  if(base+1<=depth)continue;
  for(const [dx,dy,edge] of [[1,0,'east'],[0,1,'south']]){
   const low=terrainLevel(board,tx+dx,ty+dy);
   if(h<=low)continue;
   const px=(tx-ty)*HALF_W,py=(tx+ty)*HALF_H-(h-1)*LEVEL_PX;
   const ax=edge==='east'?px+HALF_W:px-HALF_W,bx=px;
   const ay=py,by=py+HALF_H,drop=(h-low)*LEVEL_PX;
   const split=Math.max(0,Math.min(1,depth-base));
   if(split>=1)continue;
   const mx=ax+(bx-ax)*split,my=ay+(by-ay)*split;
   add([{x:mx,y:my},{x:bx,y:by},{x:bx,y:by+drop},{x:mx,y:my+drop}]);
  }
 }
 return out.length?out:EMPTY;
}
/** Subtract foreground coverage from this sprite alone, so one wall cannot
 * accidentally paint across a different soldier.
 * Call inside save/translate at the projected actor foot.
 */
export function clipSoldierAgainstTerrain(ctx,board,u){
 const pieces=terrainCoverPolygons(board,u);
 if(!pieces.length)return 0;
 const foot=u._renderFoot??projectElevatedFoot(board,u);
 for(const poly of pieces){
  ctx.beginPath();ctx.rect(-MASK_HALF_WIDTH,-MASK_UP,2*MASK_HALF_WIDTH,MASK_UP+MASK_DOWN);
  for(let i=0;i<poly.length;i++){
   const px=poly[i].x-foot.x,py=poly[i].y-foot.y;
   if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.clip('evenodd');
 }
 return pieces.length;
}

// Legacy merge exported for existing callers; the active scene uses local masks.
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
