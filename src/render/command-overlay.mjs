import {unitFoot,project,HALF_W,HALF_H} from './projection.mjs';
import {polygon} from './terrain.mjs';
import {palette as P} from './palette.mjs';
const action={formation:'진형',attack:'공격',flank:'우회',move:'이동',hold:'사수',rally:'집결',withdraw:'철수'};
/** Actual queued waypoints/slots, adapted from FlowerWars command-overlay. No hidden target reads. */
export function drawCommandOverlay(ctx,w,camera,selectedIds,alpha){
 const m=w.map,point=i=>project(i%m.width,Math.floor(i/m.width),m.floorLevel[i]);
 for(const s of w.squads){if(!selectedIds.has(s.id)||s.goal===null||s.goal===undefined)continue;
  const live=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0);if(!live.length)continue;
  const cells=[s.goal,...(s.waypoints??[]),...(s.order==='flank'&&s.flankTarget!==null&&s.flankTarget!==undefined?[s.flankTarget]:[])].filter((i,n,a)=>i>=0&&i<m.size&&(n===0||i!==a[n-1]));
  ctx.save();ctx.strokeStyle=P.edge;ctx.lineWidth=1.5/camera.zoom;ctx.setLineDash([5/camera.zoom,4/camera.zoom]);ctx.beginPath();const start=unitFoot(m,live[0],alpha);ctx.moveTo(start.x,start.y);for(const i of cells){const p=point(i);ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.setLineDash([]);
  for(const i of cells){const p=point(i);ctx.beginPath();ctx.ellipse(p.x,p.y,10/camera.zoom,6/camera.zoom,0,0,2*Math.PI);ctx.stroke();}
  const p=point(s.goal);polygon(ctx,[[p.x,p.y-HALF_H],[p.x+HALF_W,p.y],[p.x,p.y+HALF_H],[p.x-HALF_W,p.y]],null,P.edge);
  ctx.globalAlpha=.65;for(const i of Object.values(s.slots??{})){const q=point(i);ctx.strokeRect(q.x-7,q.y-4,14,8);}ctx.globalAlpha=1;ctx.save();ctx.translate(p.x,p.y-HALF_H);ctx.scale(1/camera.zoom,1/camera.zoom);ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle=P.text;ctx.fillText(`${s.id}분대 ${action[s.order]??'이동'} · H${m.floorLevel[s.goal]}`,0,-8);ctx.restore();ctx.restore();
 }
}
