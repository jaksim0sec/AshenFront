// AshenFront terrain visuals. All tactical/movement data remains immutable.
const HX=72,HY=42,TW=144,TH=107,PAD=160;
const NAMES=['void','grass','soil','road','marsh','rock','scorched'];
const COLORS={void:'#272e31',grass:'#777b70',soil:'#756b60',road:'#a2967f',marsh:'#566a67',rock:'#686861',scorched:'#423d36'};
const NEW_ROWS={grass:0,soil:1,road:2,marsh:3,rock:4,scorched:5};
const OLD_ROWS={grass:0,soil:1,road:1,marsh:2,rock:1,scorched:1};
const visualMaps=new WeakMap(),cachedDecor=new WeakMap();
const project=(x,y)=>({x:(x-y)*HX,y:(x+y)*HY});
const unproject=(x,y)=>({x:(x/HX+y/HY)/2,y:(y/HY-x/HX)/2});
export const terrainVariant=(x,y)=>((x%5+5)%5)+5*((y%2+2)%2);
function hash(x,y,seed=0){
 let n=(Math.imul(x+1987,0x9e3779b1)^Math.imul(y+1776,0x85ebca77)^(seed>>>0))>>>0;
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
 return (n^(n>>>16))>>>0;
}
function visualRevision(board){
 return [board.width,board.height,board.seed,board.terrainRevision,board.obstacleRevision,board.terrain,board.obstacles,board.battlefield];
}
function sameRevision(a,b){return a?.length===b.length&&a.every((v,i)=>v===b[i]);}
function rasterizeRoads(board,index){
 const w=board.width,h=board.height,paths=board.battlefield?.paths||[];
 for(const path of paths){
  if(!['main','flank','entry','counter'].includes(path.kind)||!path.points?.length)continue;
  const radius=path.kind==='main'?2.3:path.kind==='flank'?1.5:1.15;
  for(let j=1;j<path.points.length;j++){
   const a=path.points[j-1],b=path.points[j],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy||1;
   const x0=Math.max(0,Math.floor(Math.min(a.x,b.x)-radius-1)),x1=Math.min(w-1,Math.ceil(Math.max(a.x,b.x)+radius+1));
   const y0=Math.max(0,Math.floor(Math.min(a.y,b.y)-radius-1)),y1=Math.min(h-1,Math.ceil(Math.max(a.y,b.y)+radius+1));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const n=y*w+x;if(index[n]!==1&&index[n]!==2&&index[n]!==6)continue;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len));
    const ex=x-a.x-t*dx,ey=y-a.y-t*dy;
    if(ex*ex+ey*ey<=radius*radius)index[n]=3;
   }
  }
 }
}
function buildVisualMap(board){
 const rev=visualRevision(board),old=visualMaps.get(board);
 if(old&&sameRevision(old.rev,rev))return old.index;
 const w=board.width,h=board.height,out=new Uint8Array(w*h),seed=board.seed||0;
 const clearing=board.battlefield?.clearing;
 const centerX=clearing?.x??w*.5,centerY=clearing?.y??h*.5;
 const radiusX=clearing?.rx??w*.22,radiusY=clearing?.ry??h*.31;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const n=y*w+x,terrain=board.terrain[y]?.[x]||'void';
  const base=terrain==='void'?0:terrain==='forest'?(board.obstacles?.get(n)?.visual==='rock'?5:4):terrain==='soil'?2:terrain==='road'?3:1;
  if(base!==1){out[n]=base;continue;}
  const nx=(x-centerX)/radiusX,ny=(y-centerY)/radiusY,inside=nx*nx+ny*ny<1.2;
  // Seeded clusters, not one random mark per tile. Visual-only battlefield damage.
  out[n]=inside&&hash(Math.floor(x/6),Math.floor(y/6),seed)%100<38&&hash(x,y,seed)%100<77?6:1;
 }
 rasterizeRoads(board,out);
 visualMaps.set(board,{rev,index:out});return out;
}
export function terrainMaterial(board,x,y){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=board.width||y>=board.height)return 'void';
 return NAMES[buildVisualMap(board)[y*board.width+x]];
}
export function terrainMaterialCounts(board){
 const index=buildVisualMap(board),counts=Object.fromEntries(NAMES.map(k=>[k,0]));
 for(const i of index)counts[NAMES[i]]++;return counts;
}
export function visibleTerrainTiles(board,camera,width,height){
 const l=-camera.x/camera.scale-HX,r=(width-camera.x)/camera.scale+HX,t=-camera.y/camera.scale-TH,b=(height-camera.y)/camera.scale+HY;
 const corners=[[l,t],[r,t],[l,b],[r,b]].map(([x,y])=>unproject(x,y)),out=[];
 const lo=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y)))-2),hi=Math.min(board.height-1,Math.ceil(Math.max(...corners.map(p=>p.y)))+2);
 const index=buildVisualMap(board);
 for(let y=lo;y<=hi;y++){
  const minX=Math.max(0,Math.ceil(Math.max(l/HX+y,t/HY-y))-2),maxX=Math.min(board.width-1,Math.floor(Math.min(r/HX+y,b/HY-y))+2);
  for(let x=minX;x<=maxX;x++)if(index[y*board.width+x]!==0)out.push({x,y});
 }
 return out.sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.y-b.y);
}
function diamond(ctx,x,y,color){
 ctx.beginPath();ctx.moveTo(x,y-HY);ctx.lineTo(x+HX,y);ctx.lineTo(x,y+HY);ctx.lineTo(x-HX,y);ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function clearOfRoutes(board,x,y){
 const a=board.battlefield?.protectedCells,w=board.width;
 if(!a)return true;
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  const xx=x+dx,yy=y+dy;
  if(xx>=0&&yy>=0&&xx<w&&yy<board.height&&a[yy*w+xx])return false;
 }
 return true;
}
export function terrainDecorations(board){
 const map=buildVisualMap(board),old=cachedDecor.get(board);
 if(old?.map===map)return old.items;
 const items=[],seed=board.seed||0;
 for(let y=3;y<board.height-3;y+=4)for(let x=3;x<board.width-3;x+=4){
  const h=hash(x,y,seed),material=NAMES[map[y*board.width+x]];
  if(material==='marsh'&&h%100<34)items.push({x,y,index:h%2?4:7,width:130});
  else if(material==='rock'&&h%100<30)items.push({x,y,index:h%2?5:6,width:145});
  else if((material==='grass'||material==='soil')&&clearOfRoutes(board,x,y)&&h%100<14)
   items.push({x,y,index:[0,3,8,1][h%4],width:85+h%43});
 }
 items.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
 cachedDecor.set(board,{map,items});return items;
}
function toneOld(image,decor=false){
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d');
 if(decor){ctx.filter='saturate(.46) sepia(.08) brightness(.82) contrast(1.07)';ctx.drawImage(image,0,0);}
 else for(let row=0;row<9;row++){
  ctx.filter=['saturate(.42) sepia(.14) brightness(.77) contrast(1.05)','saturate(.40) sepia(.11) brightness(.78) contrast(1.06)','saturate(.48) brightness(.72) contrast(1.06)'][row%3];
  ctx.drawImage(image,0,row*TH,image.naturalWidth,TH,0,row*TH,image.naturalWidth,TH);
 }
 ctx.filter='none';return canvas;
}
// Original 144x107 sprites contain sidewalls. Mask surface once on load,
// otherwise every interior tile has a raised edge and the map becomes a waffle.
function surfaceOnly(image){
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const c=canvas.getContext('2d');
 for(let row=0;row<6;row++)for(let col=0;col<10;col++){
  const x=col*TW,y=row*TH;
  c.save();c.beginPath();c.moveTo(x+72,y+3);c.lineTo(x+144,y+44);
  c.lineTo(x+72,y+86);c.lineTo(x,y+44);c.closePath();c.clip();
  c.fillStyle=COLORS[['grass','soil','road','marsh','rock','scorched'][row]];
  c.fillRect(x,y,TW,TH);
  // Sample the interior, excluding black sprite outlines and sidewall pixels.
  // The slightly oversized UV covers diamond edges without a per-tile clip at draw time.
  c.drawImage(image,x+5,y+6,TW-10,75,x-3,y-2,TW+6,92);c.restore();
 }
 return canvas;
}
async function imageFromBase64(path){
 const response=await fetch(new URL(path,import.meta.url));
 if(!response.ok)throw Error('Terrain asset unavailable: '+path);
 const data=(await response.text()).replace(/\s/g,'');
 if(!data.startsWith('UklG'))throw Error('Invalid WebP terrain asset: '+path);
 const img=new Image();img.src='data:image/webp;base64,'+data;await img.decode();return img;
}
function seams(ctx,board,tiles){
 for(const water of [false,true]){
  ctx.beginPath();
  for(const {x,y} of tiles){const material=terrainMaterial(board,x,y),p=project(x,y);
   for(const [dx,dy,sign] of [[1,0,1],[0,1,-1]]){
    const other=terrainMaterial(board,x+dx,y+dy);
    if(other==='void'||other===material||((material==='marsh'||other==='marsh')!==water))continue;
    ctx.moveTo(p.x+sign*HX,p.y);ctx.lineTo(p.x,p.y+HY);
   }
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle=water?'#424c48b0':'#a2947e65';ctx.lineWidth=water?3:1.4;ctx.stroke();
 }
}
export class BattlefieldTerrainRenderer{
 constructor(){
  this.atlas=null;this.surface=null;this.kind='pending';this.decorations=null;this.version=0;this.cache=null;this.rebuilds=0;this.failures=[];
  const next=imageFromBase64('../../assets/world/terrain/ashenfront-atlas.webp.b64').then(img=>{
   if(img.naturalWidth!==1440||img.naturalHeight!==642)throw Error('Expected a 1440x642 AshenFront atlas');
   this.surface=surfaceOnly(img);this.atlas=img;this.kind='new';this.version++;
  }).catch(async e=>{
   this.failures.push(e.message);console.warn('New terrain unavailable, using original atlas:',e.message);
   try{const img=await imageFromBase64('../../assets/world/terrain/atlas.webp.b64');
    this.atlas=toneOld(img);this.kind='legacy';this.version++;
   }catch(fallbackError){this.failures.push(fallbackError.message);}
  });
  const decor=imageFromBase64('../../assets/world/terrain/decorations.webp.b64').then(img=>{
   this.decorations=toneOld(img,true);this.version++;
  }).catch(e=>{this.failures.push(e.message);});
  this.ready=Promise.allSettled([next,decor]);
 }
 draw(ctx,board,camera,width,height,drawDpr=1,low=false){
  const density=Math.min(drawDpr,low||camera.scale<.12?1:1.5),old=this.cache;
  const key=[board,board.terrainRevision,board.obstacleRevision,board.battlefield,this.version,camera.scale,width,height,density,low];
  const rebuild=!old||!sameRevision(old.key,key)||Math.abs(camera.x-old.camera.x)>PAD||Math.abs(camera.y-old.camera.y)>PAD;
  if(rebuild){
   const canvas=old?.canvas||document.createElement('canvas'),cw=Math.ceil((width+PAD*2)*density),ch=Math.ceil((height+PAD*2)*density);
   if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;
   const t=canvas.getContext('2d');t.setTransform(density,0,0,density,0,0);
   t.clearRect(0,0,width+PAD*2,height+PAD*2);t.fillStyle=COLORS.void;t.fillRect(0,0,width+PAD*2,height+PAD*2);
   const shifted={...camera,x:camera.x+PAD,y:camera.y+PAD};
   t.translate(shifted.x,shifted.y);t.scale(camera.scale,camera.scale);
   const tiles=visibleTerrainTiles(board,shifted,width+PAD*2,height+PAD*2),newArt=this.kind==='new';
   const materialIndex=buildVisualMap(board);
   for(const {x,y} of tiles){
    const material=NAMES[materialIndex[y*board.width+x]],p=project(x,y);
    if(!this.atlas){diamond(t,p.x,p.y,COLORS[material]);continue;}
    const col=terrainVariant(x,y),row=(newArt?NEW_ROWS:OLD_ROWS)[material],sx=col*TW,sy=row*TH;
    if(newArt){
     // Each source tile has a pre-baked opaque diamond; avoid a path per visible tile.
     const east=terrainMaterial(board,x+1,y)==='void',south=terrainMaterial(board,x,y+1)==='void';
     if(east||south)t.drawImage(this.atlas,sx,sy,TW,TH,p.x-HX,p.y-44,TW,TH);
     t.drawImage(this.surface,sx,sy,TW,TH,p.x-HX,p.y-44,TW,TH);
    }else{
     t.drawImage(this.atlas,sx,sy,TW,TH,p.x-HX,p.y-HY,TW,TH);
     if(terrainMaterial(board,x+1,y)==='void')t.drawImage(this.atlas,sx,(3+row)*TH,TW,TH,p.x-HX,p.y-HY,TW,TH);
     if(terrainMaterial(board,x,y+1)==='void')t.drawImage(this.atlas,sx,(6+row)*TH,TW,TH,p.x-HX,p.y-HY,TW,TH);
    }
   }
   if(tiles.length&&camera.scale>=.16)seams(t,board,tiles);
   if(tiles.length&&this.decorations&&!low&&camera.scale>=.2){
    const x0=Math.max(0,Math.min(...tiles.map(p=>p.x))-4),x1=Math.max(...tiles.map(p=>p.x))+4;
    const y0=Math.max(0,Math.min(...tiles.map(p=>p.y))-4),y1=Math.max(...tiles.map(p=>p.y))+4;
    for(const item of terrainDecorations(board)){
     if(item.x<x0||item.x>x1||item.y<y0||item.y>y1)continue;
     const p=project(item.x,item.y),h=item.width*270/340;
     t.drawImage(this.decorations,item.index%3*340,Math.floor(item.index/3)*270,340,270,p.x-item.width/2,p.y-h,item.width,h);
    }
   }
   this.cache={canvas,key,camera:{...camera},tiles:tiles.length};this.rebuilds++;
  }
  const base=this.cache;
  ctx.drawImage(base.canvas,camera.x-base.camera.x-PAD,camera.y-base.camera.y-PAD,base.canvas.width/density,base.canvas.height/density);
 }
}
