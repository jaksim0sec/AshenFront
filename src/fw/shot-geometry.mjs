import {project} from './model.mjs';
// Once fired, use the committed tile even if the original actor leaves or dies.
export function firingOrientation(board,unit){
 const target=unit.strike?.target!=null?board.unit(unit.strike.target):null;
 const strike=unit.strike,aim=Number.isInteger(strike?.aimX)&&Number.isInteger(strike?.aimY);
 const v=aim?project(strike.aimX-unit.visualX,strike.aimY-unit.visualY):target?project(target.visualX-unit.visualX,target.visualY-unit.visualY):unit.attackVector;
 if(!v)return {facing:unit.facing<0?-1:1,aim:0};
 return {facing:Math.abs(v.x)>.001?(v.x<0?-1:1):(unit.facing<0?-1:1),
  aim:Math.max(-.95,Math.min(.95,Math.atan2(v.y,Math.max(.001,Math.abs(v.x)))))};
}
