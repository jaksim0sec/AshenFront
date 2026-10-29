import {tileFaces,project,unproject,HALF_W as W,HALF_H as H,LEVEL_PX} from './projection.mjs';
export function polygon(ctx,points,fill,stroke) {
 ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
 if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
export function visibleBounds(m,c,width,height,pad=200) {
 const ps=[[-pad,-pad],[width+pad,-pad],[-pad,height+pad],[width+pad,height+pad]].map(([x,y])=>unproject((x-c.x)/c.zoom,(y-c.y)/c.zoom));
 return {x0:Math.max(0,Math.floor(Math.min(...ps.map(p=>p.x)))-3),x1:Math.min(m.width-1,Math.ceil(Math.max(...ps.map(p=>p.x)))+3),y0:Math.max(0,Math.floor(Math.min(...ps.map(p=>p.y)))-3),y1:Math.min(m.height-1,Math.ceil(Math.max(...ps.map(p=>p.y)))+3)};
}
export {tileFaces} from './projection.mjs';
export class TerrainRenderer {
 constructor(){this.canvas=document.createElement('canvas');this.key='';this.rebuilds=0;}
 draw(ctx,m,c,width,height,debug=false) {
  const key=[c.x,c.y,c.zoom,width,height,m.revision,debug].join(':');
  if(this.key!==key) {
   this.key=key; this.rebuilds++;const canvas=this.canvas;canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);
   const t=canvas.getContext('2d'); t.setTransform(c.zoom,0,0,c.zoom,c.x,c.y);
   const b=visibleBounds(m,c,width,height);
   for(let d=b.x0+b.y0;d<=b.x1+b.y1;d++) for(let y=b.y0;y<=b.y1;y++) {
    const x=d-y;if(x<b.x0||x>b.x1) continue;const i=y*m.width+x,p=project(x,y,m.floorLevel[i]);
    for(const f of tileFaces(m,i)) polygon(t,f,'#514333','#302d25');
    const variation=(x*7+y*13)%4,colors=['#716e4c','#333d33','#99926a','#6e6654','#434940'];
    polygon(t,[[p.x,p.y-H],[p.x+W,p.y],[p.x,p.y+H],[p.x-W,p.y]],colors[m.terrainKind[i]],'#ffffff09');
    if(m.terrainKind[i]===0 && variation===0) {t.fillStyle='#ffffff09';t.fillRect(p.x-18,p.y-2,26,2);}
    if(m.transitionMask[i]) {t.strokeStyle='#c6b980';t.lineWidth=3;t.beginPath();t.moveTo(p.x-15,p.y-8);t.lineTo(p.x+15,p.y+8);t.moveTo(p.x-15,p.y);t.lineTo(p.x+15,p.y+16);t.stroke();}
    if(m.coverMask[i] && (debug||m.floorLevel[i]===0)) {t.strokeStyle=m.coverCondition[i]<50?'#806b45':'#b9a678';t.lineWidth=3;t.beginPath();if(m.coverMask[i]&2){t.moveTo(p.x,p.y-H);t.lineTo(p.x+W,p.y);}if(m.coverMask[i]&8){t.moveTo(p.x-W,p.y);t.lineTo(p.x,p.y+H);}if(m.coverMask[i]&1){t.moveTo(p.x-W,p.y);t.lineTo(p.x,p.y-H);}if(m.coverMask[i]&4){t.moveTo(p.x,p.y+H);t.lineTo(p.x+W,p.y);}t.stroke();}
   }
  }
  ctx.drawImage(this.canvas,0,0);
 }
}
