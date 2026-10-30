import {distance} from './observer.mjs';

// FlowerWars doctrines become role/cadence data; AshenFront retains its squads,
// weapons and characters. Every capability here uses ordinary AshenFront orders.
export const DOCTRINES=[
 {id:'envelopment',opening:['front','breach','mobile','support'],flank:12,commit:160},
 {id:'breakthrough',opening:['breach','front','mobile','support'],flank:8,commit:120},
 {id:'counterstroke',opening:['front','mobile','breach','support'],flank:14,commit:200}
];

export function choose(observer,snapshot,state,op,{defend=false,doctrine,claimed=new Map()}={}){
 const w=observer.world,m=w.map,home=snapshot.home.center,enemy=snapshot.enemy.center,tick=w.tick;
 const reachable=i=>Number.isFinite(observer.travel(state.cell,i));
 if(defend||op.role==='guard')return {intent:'DEFEND',target:home};
 // Suppression recovers with time, not invented healing. A damaged squad gets
 // one respite, then returns to the battle instead of retreating forever.
 if(state.squad.suppressed||state.health<.4&&!op.recoverySpent){
  op.recoverySpent=true;op.recoveryUntil=tick+120;
  const safe=observer.nodes.filter(n=>reachable(n.cell)&&observer.travel(n.cell,home)<observer.travel(state.cell,home)&&distance(m,n.cell,state.cell)<=16);
  safe.sort((a,b)=>distance(m,state.cell,a.cell)-distance(m,state.cell,b.cell)-(m.coverMask[a.cell]?3:0)+(m.coverMask[b.cell]?3:0)||a.cell-b.cell);
  return {intent:'REGROUP',target:safe[0]?.cell??home};
 }
 if(op.intent==='REGROUP'&&tick<op.recoveryUntil)return {intent:op.intent,target:op.target};
 const completed=op.arrived&&!['CAPTURE','DEFEND','REGROUP'].includes(op.intent);
 if(op.intent&&!op.stalled&&!completed&&op.intent!=='REGROUP'&&op.intent!=='DEFEND'&&tick-op.changedAt<doctrine.commit&&op.revision===observer.revision)return {intent:op.intent,target:op.target};
 const total=observer.travel(home,enemy),remaining=observer.travel(state.cell,enemy),homeY=Math.floor(home/m.width);
 const lane=op.role==='mobile'?homeY+(state.id%2?-doctrine.flank:doctrine.flank):homeY;
 const choices=[];
 const add=(intent,target,base)=>{const travel=observer.travel(state.cell,target);if(!Number.isFinite(travel))return;
  const pressure=snapshot.enemies.filter(e=>distance(m,e.cell,target)<10).reduce((n,e)=>n+e.hp/100,0);
  const cover=m.coverMask[target]?2:0,elevation=m.floorLevel[target]===2?1:0;
  const progress=total-observer.travel(target,enemy);
  let score=base+progress*.6-travel*.35+cover+elevation-Math.max(0,pressure-state.power)*3-(claimed.get(target)??0)*8;
  if(op.stalled&&target===op.target)score-=35;
  if(op.target===target&&op.intent===intent&&!completed)score+=5;
  choices.push({intent,target,score});
 };
 // A staged approach stops short of a wide-front rush, then commits to HQ.
 add('CAPTURE',enemy,remaining<22||tick>1600?35:0);
 for(const n of observer.nodes){
  if(n.kind==='hq'||!reachable(n.cell))continue;
  const next=observer.travel(n.cell,enemy),step=remaining-next;
  if(step<5||step>26||next<8)continue;
  const flankCost=Math.abs(Math.floor(n.cell/m.width)-lane)*(op.role==='mobile'?.7:.3);
  const roleValue=op.role==='breach'?4:op.role==='support'?coverValue(m,n.cell):1;
  add(op.role==='mobile'?'FLANK':op.role==='breach'?'BREAKTHROUGH':op.role==='support'?'SUPPORT':'ADVANCE',n.cell,12+roleValue-flankCost);
 }
 if(op.stalled){
  // Replace a congestion-bound staging operation with a different reachable
  // landmark before continuing. The gateway rate limit bounds replacements.
  for(const n of observer.nodes)if(n.cell!==op.target&&distance(m,n.cell,state.cell)>4&&distance(m,n.cell,state.cell)<16&&observer.travel(n.cell,enemy)<remaining+8)add('REPOSITION',n.cell,10);
 }
 choices.sort((a,b)=>b.score-a.score||a.target-b.target);return choices[0]??null;
}
function coverValue(m,i){return m.coverMask[i]?4:0;}
