import {project} from './projection.mjs';
import {polygon} from './terrain.mjs';
import {formationOffsets} from '../sim/formations.mjs';
import {palette as P} from './palette.mjs';
export function drawDeploymentOverlay(scene,w,c,cell,formation){
 const ctx=scene.canvas.getContext('2d'),m=w.map,point=(x,y)=>{const p=project(x,y,1);return[p.x,p.y];};ctx.save();ctx.setTransform(scene.dpr,0,0,scene.dpr,0,0);ctx.translate(c.x,c.y);ctx.scale(c.zoom,c.zoom);ctx.lineWidth=1/c.zoom;ctx.setLineDash([7/c.zoom,5/c.zoom]);ctx.globalAlpha=.3;polygon(ctx,[point(-.5,-.5),point(m.width/2-.5,-.5),point(m.width/2-.5,m.height-.5),point(-.5,m.height-.5)],null,P.teamA);ctx.setLineDash([]);
 if(cell!==null&&cell>=0&&cell<m.size){const x=cell%m.width,y=Math.floor(cell/m.width);for(const d of formationOffsets(formation,10)){const xx=x+d.x,yy=y+d.y;if(xx<0||yy<0||xx>=m.width||yy>=m.height)continue;const i=yy*m.width+xx,p=project(xx,yy,m.floorLevel[i]),valid=xx<m.width/2&&!m.blocked[i]&&!m.occupancy[i]&&!m.reservation[i];ctx.globalAlpha=.45;polygon(ctx,[[p.x,p.y-32],[p.x+52,p.y],[p.x,p.y+32],[p.x-52,p.y]],valid?P.teamA:P.teamB,P.edge);}}
 ctx.restore();
}
