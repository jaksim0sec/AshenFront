import {distance} from './observer.mjs';
export function createOperation(id,role){return {id,role,intent:null,target:null,route:[],waypoint:0,changedAt:-Infinity,lastProgressAt:0,bestDistance:Infinity,replans:0,stalls:0,recoveryUntil:0};}
export function trackProgress(op,state,observer,tick){
 const target=op.route[op.waypoint]??op.target;if(target===null)return;
 const d=distance(observer.world.map,state.cell,target);
 if(d<4&&op.waypoint<op.route.length-1){op.waypoint++;op.bestDistance=Infinity;op.lastProgressAt=tick;}
 else if(d+1<op.bestDistance){op.bestDistance=d;op.lastProgressAt=tick;}
 op.arrived=(state.squad.reached||d<=3)&&op.waypoint>=op.route.length-1;
 op.stalled=!op.arrived&&tick-op.lastProgressAt>=240&&!state.squad.suppressed;
}
export function adopt(op,choice,state,observer,tick,metrics){
 if(op.intent===choice.intent&&op.target===choice.target&&!op.stalled&&op.revision===observer.revision)return;
 const stalled=op.stalled,blockedWaypoint=op.route[op.waypoint];
 if(stalled){op.stalls++;metrics.stalls++;}
 op.intent=choice.intent;op.target=choice.target;op.route=observer.route(state.cell,choice.target);op.waypoint=0;
 // Replacing only the distant goal can retain the exact congested first
 // landmark. Skip that staging anchor on a stalled replan; Navigation finds
 // the legal route to the next anchor with its normal shared tick budget.
 if(stalled&&op.route[0]===blockedWaypoint&&op.route.length>1)op.route.shift();
 while(op.waypoint<op.route.length-1&&distance(observer.world.map,state.cell,op.route[op.waypoint])<5)op.waypoint++;
 op.changedAt=tick;op.lastProgressAt=tick;op.bestDistance=Infinity;op.stalled=false;op.arrived=false;op.revision=observer.revision;op.replans++;metrics.replans++;
}
