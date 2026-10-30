import {project} from './model.mjs';
// The authoritative target is checked again while the rifle is firing.
export function firingOrientation(board,unit){
 const target=unit.strike?.target!=null?board.unit(unit.strike.target):null;
 const v=target?project(target.visualX-unit.visualX,target.visualY-unit.visualY):unit.attackVector;
 if(!v)return {facing:unit.facing<0?-1:1,aim:0};
 return {facing:Math.abs(v.x)>.001?(v.x<0?-1:1):(unit.facing<0?-1:1),
  aim:Math.max(-.95,Math.min(.95,Math.atan2(v.y,Math.max(.001,Math.abs(v.x)))))};
}
