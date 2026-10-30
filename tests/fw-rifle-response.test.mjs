import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/fw/model.mjs';
import {shotHitChance} from '../src/fw/combat.mjs';
import {poseCharacter,transformPoint} from '../src/characters/animation.mjs';
import {createCatalog} from '../src/characters/model.mjs';
import {RIFLE_STATS} from '../src/fw/ashen-setup.mjs';

const shoot=(board,x,y,team,auto=true,range=7)=>board.spawn(x,y,null,{
 team,autoCombat:auto,stats:{...RIFLE_STATS,range}
});
test('two connecting rifle rounds are lethal; maximum range has worse accuracy than preferred range',()=>{
 assert.equal(RIFLE_STATS.maxHealth,32);
 assert.equal(RIFLE_STATS.damage*2>=RIFLE_STATS.maxHealth,true);
 const stats={preferredRange:3};
 assert.equal(shotHitChance(stats,3),.96);
 assert(shotHitChance(stats,7)<shotHitChance(stats,5));
 assert(shotHitChance(stats,1)<shotHitChance(stats,3));
});
test('shot dispersion is fixed at trigger pull and reproducible for the same seed',()=>{
 const sequence=()=>{
  const b=new Board(30,16,{seed:91}),a=shoot(b,3,6,'A',false),enemy=shoot(b,10,6,'B',false);
  const hits=[];
  for(let i=0;i<20;i++){assert(b.beginAttack(a,enemy.id));hits.push(a.strike.hit);b.update(1.4);}
  return hits;
 };
 const a=sequence();
 assert.deepEqual(a,sequence());
 assert(a.includes(true)&&a.includes(false),'long shots must sometimes miss');
});
test('a no-order soldier hit from outside its own range pursues the attacker',()=>{
 const b=new Board(32,14,{seed:3});
 const defender=shoot(b,4,7,'A',true,5),enemy=shoot(b,11,7,'B',false,7);
 assert(b.damage(defender.id,2,1,enemy.id));
 assert.equal(defender.facing,1);
 b.update(.15);
 assert.equal(defender.command?.type,'attack');
 assert.equal(defender.command?.target,enemy.id);
 assert(defender.step||defender.state==='attack','retaliation must trigger a real action');
});
test('a soldier under explicit move continues advancing after a shot',()=>{
 const b=new Board(32,14,{seed:3}),a=shoot(b,4,7,'A',true,7),enemy=shoot(b,8,7,'B',false,7);
 assert(b.move(a.id,22,7));
 b.update(1.6);
 assert(a.x>4||a.step,'marching rifleman must advance instead of endlessly repeating fire');
 assert.equal(a.command?.type,'move');
 assert.equal(enemy.health.current<=enemy.health.max,true);
});
test('weak guard keeps both shoulder pivots on the resting silhouette',()=>{
 const p=createCatalog().profiles['arken:private'];
 const at=(pose,key)=>{const part=p.parts[key],matrix=pose.draws.find(d=>d.part===key).matrix;
  return transformPoint(matrix,part.pivotX*part.w,part.pivotY*part.h);};
 const rest=poseCharacter(p,{state:'idle',time:.15,shootBlend:0,crouchBlend:.10});
 const guard=poseCharacter(p,{state:'guard',time:.15,shootBlend:0,crouchBlend:.10});
 for(const arm of ['armLeft','armRight']){
  const a=at(rest,arm),b=at(guard,arm);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<2,'guard cannot pull '+arm+' out of its socket');
 }
});
