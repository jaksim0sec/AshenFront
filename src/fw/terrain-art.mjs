// Terrain renderer: visual-only. Never mutates movement, obstacles or tactical RNG.
const HX=72,HY=42,TW=144,TH=107,PAD=144;
const COLORS={grass:'#777b70',soil:'#756b60',road:'#a2967f',pond:'#566a67',rock:'#686861',void:'#272e31'};
const FILTERS=['saturate(.42) sepia(.14) brightness(.77) contrast(1.05)','saturate(.40) sepia(.11) brightness(.78) contrast(1.06)','saturate(.48) brightness(.72) contrast(1.06)'];
const cachedDecor=new WeakMap();
const project=(x,y)=>({x:(x-y)*HX,y:(x+y)*HY});
const unproject=(x,y)=>({x:(x/HX+y/HY)/2,y:(y/HY-x/HX)/2});
export const terrainVariant=(x,y)=>((x%5+5)%5)+5*((y%2+2)%2);
export function terrainMaterial(board,x,y){
 const type=board.terrain[y]?.[x]??'void';
 if(type==='void')return 'void';
 if(type==='forest')return board.obstacles?.get(y*board.width+x)?.visual==='rock'?'rock':'pond';
 return type==='road'?'road':type==='soil'?'soil':'grass';
}
export function visibleTerrainTiles(board,camera,width,height){
 const l=-camera.x/camera.scale-HX,r=(width-camera.x)/camera.scale+HX,t=-camera.y/camera.scale-TH,b=(height-camera.y)/camera.scale+HY;
 const corners=[[l,t],[r,t],[l,b],[r,b]].map(([x,y])=>unproject(x,y));
 const lo=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y)))-1),hi=Math.min(board.height-1,Math.ceil(Math.max(...corners.map(p=>p.y)))+1),out=[];
 for(let y=lo;y<=hi;y++){
  const minX=Math.max(0,Math.ceil(Math.max(l/HX+y,t/HY-y))-1),maxX=Math.min(board.width-1,Math.floor(Math.min(r/HX+y,b/HY-y))+1);
  for(let x=minX;x<=maxX;x++)if(terrainMaterial(board,x,y)!=='void')out.push({x,y});
 }
 return out.sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.y-b.y);
}
function diamond(ctx,x,y,color){
 ctx.beginPath();ctx.moveTo(x,y-HY);ctx.lineTo(x+HX,y);ctx.lineTo(x,y+HY);ctx.lineTo(x-HX,y);ctx.closePath();
 ctx.fillStyle=color;ctx.fill();
}
function hash(x,y,seed=0){
 let n=(Math.imul(x+1987,0x9e3779b1)^Math.imul(y+1776,0x85ebca77)^(seed>>>0))>>>0;
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;
}
function clearOfRoutes(board,x,y){
 const a=board.battlefield?.protectedCells,w=board.width;
 if(!a)return true;
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&y+dy>=0&&x+dx<w&&y+dy<board.height&&a[(y+dy)*w+x+dx])return false;
 return true;
}
export function terrainDecorations(board){
 const rev=[board.terrainRevision,board.obstacleRevision,board.seed].join(':'),old=cachedDecor.get(board);
 if(old?.rev===rev)return old.items;
 const items=[],seed=board.seed||0;
 for(let y=3;y<board.height-3;y+=4)for(let x=3;x<board.width-3;x+=4){
  const h=hash(x,y,seed),material=terrainMaterial(board,x,y);
  if(material==='pond'&&h%100<34)items.push({x,y,index:h%2?4:7,width:130});
  else if(material==='rock'&&h%100<30)items.push({x,y,index:h%2?5:6,width:145});
  else if((material==='grass'||material==='soil')&&clearOfRoutes(board,x,y)&&h%100<14)
   items.push({x,y,index:[0,3,8,5][h%4],width:85+h%43});
 }
 items.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
 cachedDecor.set(board,{rev,items});return items;
}
function tone(image,decor=false){
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d');
 if(decor){ctx.filter='saturate(.46) sepia(.08) brightness(.82) contrast(1.07)';ctx.drawImage(image,0,0);}
 else for(let row=0;row<9;row++){ctx.filter=FILTERS[row%3];ctx.drawImage(image,0,row*TH,image.naturalWidth,TH,0,row*TH,image.naturalWidth,TH);}
 ctx.filter='none';return canvas;
}
async function imageFromBase64(path){
 const response=await fetch(new URL(path,import.meta.url));
 if(!response.ok)throw Error('Terrain asset unavailable: '+path);
 const data=(await response.text()).trim();
 if(!data.startsWith('UklG'))throw Error('Invalid terrain image: '+path);
 const img=new Image();img.src='data:image/webp;base64,'+data;await img.decode();return img;
}
function edges(ctx,board,tiles){
 for(const water of [false,true]){
  ctx.beginPath();
  for(const {x,y} of tiles){const material=terrainMaterial(board,x,y),p=project(x,y);
   for(const [dx,dy,sign] of [[1,0,1],[0,1,-1]]){
    const other=terrainMaterial(board,x+dx,y+dy);
    if(other==='void'||other===material||((material==='pond'||other==='pond')!==water))continue;
    ctx.moveTo(p.x+sign*HX,p.y);ctx.lineTo(p.x,p.y+HY);
   }
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle=water?'#424c48b0':'#a2947e65';ctx.lineWidth=water?4:2.5;ctx.stroke();
  ctx.strokeStyle=water?'#b1aaa082':'#d2c6ae50';ctx.lineWidth=1;ctx.stroke();
 }
}
function wear(ctx,board,tiles){
 const xs=tiles.map(v=>v.x),ys=tiles.map(v=>v.y),seed=board.seed||0;
 const a=Math.max(5,Math.min(...xs)-6),b=Math.min(board.width-6,Math.max(...xs)+6);
 const c=Math.max(5,Math.min(...ys)-6),d=Math.min(board.height-6,Math.max(...ys)+6);
 for(let y=Math.ceil(c/12)*12;y<=d;y+=12)for(let x=Math.ceil(a/12)*12;x<=b;x+=12){
  if(hash(x,y,seed)%5>2||terrainMaterial(board,x,y)!=='grass')continue;
  if([[-4,0],[4,0],[0,-4],[0,4]].some(([dx,dy])=>terrainMaterial(board,x+dx,y+dy)!=='grass'))continue;
  const p=project(x,y),r=350+hash(y,x,seed)%220,g=ctx.createRadialGradient(p.x,p.y,12,p.x,p.y,r);
  g.addColorStop(0,'#524a3b25');g.addColorStop(1,'#524a3b00');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.57,0,0,Math.PI*2);ctx.fill();
 }
}
export class BattlefieldTerrainRenderer {
 constructor(){
  this.atlas=null;this.decorations=null;this.version=0;this.cache=null;this.rebuilds=0;this.failures=[];
  for(const [name,path] of [['atlas','../../assets/world/terrain/atlas.webp.b64'],['decorations','../../assets/world/terrain/decorations.webp.b64']])
   imageFromBase64(path).then(img=>{this[name]=tone(img,name==='decorations');this.version++;})
    .catch(err=>{this.failures.push(err.message);console.warn(err.message);});
 }
 draw(ctx,board,camera,width,height,drawDpr=1,low=false){
  const density=Math.min(low?1:1.5,drawDpr),old=this.cache;
  const key=[board,board.terrainRevision,board.obstacleRevision,this.version,camera.scale,width,height,density,low];
  if(!old||key.some((v,i)=>v!==old.key[i])||Math.abs(camera.x-old.camera.x)>PAD||Math.abs(camera.y-old.camera.y)>PAD){
   const canvas=old?.canvas||document.createElement('canvas');
   canvas.width=Math.ceil((width+PAD*2)*density);canvas.height=Math.ceil((height+PAD*2)*density);
   const t=canvas.getContext('2d');t.setTransform(density,0,0,density,0,0);
   t.fillStyle=COLORS.void;t.fillRect(0,0,width+PAD*2,height+PAD*2);
   const shifted={...camera,x:camera.x+PAD,y:camera.y+PAD};
   t.translate(shifted.x,shifted.y);t.scale(camera.scale,camera.scale);
   const tiles=visibleTerrainTiles(board,shifted,width+PAD*2,height+PAD*2),textured=!!this.atlas&&camera.scale>=.12;
   for(const {x,y} of tiles){
    const material=terrainMaterial(board,x,y),p=project(x,y);
    if(textured){
     const row=material==='grass'?0:material==='pond'?2:1,sx=terrainVariant(x,y)*TW;
     t.drawImage(this.atlas,sx,row*TH,TW,TH,p.x-HX,p.y-HY,TW,TH);
     if(material==='road')diamond(t,p.x,p.y,'#c3ad8d2c');
     if(material==='rock')diamond(t,p.x,p.y,'#65676552');
     if(terrainMaterial(board,x+1,y)==='void')t.drawImage(this.atlas,sx,(3+row)*TH,TW,TH,p.x-HX,p.y-HY,TW,TH);
     if(terrainMaterial(board,x,y+1)==='void')t.drawImage(this.atlas,sx,(6+row)*TH,TW,TH,p.x-HX,p.y-HY,TW,TH);
    }else diamond(t,p.x,p.y,COLORS[material]);
   }
   if(tiles.length){
    edges(t,board,tiles);
    if(camera.scale>=.23&&!low)wear(t,board,tiles);
    if(this.decorations&&camera.scale>=.17&&!low){
     const xs=tiles.map(v=>v.x),ys=tiles.map(v=>v.y),x0=Math.min(...xs)-4,x1=Math.max(...xs)+4,y0=Math.min(...ys)-4,y1=Math.max(...ys)+4;
     for(const item of terrainDecorations(board)){
      if(item.x<x0||item.x>x1||item.y<y0||item.y>y1)continue;
      const p=project(item.x,item.y),h=item.width*270/340;
      t.drawImage(this.decorations,item.index%3*340,Math.floor(item.index/3)*270,340,270,p.x-item.width/2,p.y-h,item.width,h);
     }
    }
   }
   this.cache={canvas,key,camera:{...camera}};this.rebuilds++;
  }
  const base=this.cache;
  ctx.drawImage(base.canvas,camera.x-base.camera.x-PAD,camera.y-base.camera.y-PAD,base.canvas.width/density,base.canvas.height/density);
 }
}
