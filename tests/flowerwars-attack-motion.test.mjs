import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/fw/model.mjs';
import {poseCharacter} from '../src/characters/animation.mjs';
import {createCatalog} from '../src/characters/model.mjs';

const armed=()=>new Board(24,16);
function setup(){
 const board=armed();
 const attacker=board.spawn(5,8,null,{team:'A',stats:{maxHealth:500,damage:2,range:7,rangeShape:'king',attackPeriod:.7,lineOfSight:true},autoCombat:true});
 const target=board.spawn(9,8,null,{team:'B',stats:{maxHealth:1000,damage:1,range:1,attackPeriod:99},autoCombat:false});
 return {board,attacker,target};
}
test('focus persists through repeated rifle shots instead of cancelling after each impact',()=>{
 const {board,attacker,target}=setup();
 assert(board.attack(attacker.id,target.id));
 for(let i=0;i<90;i++)board.update(.05);
 assert(board.combatStats.attacks>=4,'attack order must fire more than once');
 assert(board.combatStats.hits>=4,'repeated fire must produce actual impacts');
 assert.equal(attacker.command?.type,'attack');
 assert.equal(attacker.command?.target,target.id);
});
test('incoming rifle hits do not indefinitely stun or cancel an active attack',()=>{
 const {board,attacker,target}=setup();
 assert(board.attack(attacker.id,target.id));
 const hp=attacker.health.current;
 for(let i=0;i<140;i++){board.update(.05);board.damage(attacker.id,1,1,target.id);}
 assert.equal(attacker.health.current,hp-140);
 assert(attacker.health.current>0);
 assert(board.combatStats.attacks>=5,'repeated incoming hits must not suppress all rifle fire');
 assert(target.health.current<target.health.max);
 assert.notEqual(attacker.state,'hit','nonlethal damage is handled as a pose reaction, not a locomotion lock');
});
test('rifle hands retain their joint transforms at animation state boundaries',()=>{
 const catalog=createCatalog(),profile=catalog.profiles['arken:private'];
 const idle=poseCharacter(profile,{state:'idle',time:0,aim:0,shootBlend:0});
 const enter=poseCharacter(profile,{state:'shoot',time:0,aim:0,shootBlend:0});
 const raised=poseCharacter(profile,{state:'shoot',time:0,aim:0,shootBlend:1});
 const exit=poseCharacter(profile,{state:'idle',time:0,aim:0,shootBlend:1});
 const get=(pose,key)=>pose.draws.find(d=>d.part===key).matrix;
 for(const key of ['armLeft','armRight','sleeveLeft','sleeveRight','rifle'].filter(key=>profile.parts[key].visible)){
  const dist=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
  assert(dist(get(idle,key),get(enter,key))<1e-6, key+' snapped on first firing frame');
  assert(dist(get(raised,key),get(exit,key))<1e-6,key+' snapped back on firing exit');
 }
 for(const side of ['armLeft','armRight']){
  let last=null;
  for(let i=0;i<=12;i++){
   const pose=poseCharacter(profile,{state:'shoot',time:0,aim:0,shootBlend:i/12});
   const matrix=get(pose,side),angle=Math.atan2(matrix[1],matrix[0]);
   if(last!==null)assert(Math.abs(Math.atan2(Math.sin(angle-last),Math.cos(angle-last)))<.4,side+' arm angular jump');
   last=angle;
  }
 }
});
