import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/fw/model.mjs';
import {firingOrientation} from '../src/fw/shot-geometry.mjs';
import {registerPlacedGroup,squadsFor} from '../src/fw/unit-groups.mjs';
import {orderSquads,updateSquadOrders} from '../src/fw/squad-orders.mjs';

const rifle=(board,x,y,team,auto=true)=>board.spawn(x,y,null,{
  team,autoCombat:auto,stats:{range:5,rangeShape:'king',preferredRange:5,attackPeriod:.8,maxHealth:200,damage:20}
});

test('a committed round misses a target that leaves the aimed tile',()=>{
 const b=new Board(30,16),a=rifle(b,5,6,'A',false),t=rifle(b,8,6,'B',false);
 assert(b.beginAttack(a,t.id));
 assert.deepEqual([a.strike.aimX,a.strike.aimY],[8,6]);
 assert.equal(b.beginStep(t,{x:9,y:6}),undefined);
 b.update(.41);
 assert(a.impacted,'the shot is completed rather than cancelled');
 assert.equal(t.health.current,t.health.max,'target leaving tile must not be followed');
 assert.equal(b.combatStats.hits,0);
 assert.equal(b.combatStats.attacks,1);
 assert.equal(firingOrientation(b,a).facing,1);
});

test('a round still finishes if its target dies before impact',()=>{
 const b=new Board(30,16),a=rifle(b,5,6,'A',false),t=rifle(b,8,6,'B',false);
 assert(b.beginAttack(a,t.id));
 b.damage(t.id,t.health.current);
 b.update(.41);
 assert(a.impacted);
 assert.equal(b.combatStats.hits,0);
 assert.deepEqual([a.strike.aimX,a.strike.aimY],[8,6]);
});

test('a nearby enemy is fought before preferred-range separation can retreat',()=>{
 const b=new Board(30,16),a=rifle(b,6,6,'A'),t=rifle(b,7,6,'B',false);
 b.update(.15);
 assert.equal(a.state,'attack');
 assert.equal(a.step,null);
 assert.equal(a.strike.target,t.id);
});

test('explicit focus pursues its chosen enemy despite a closer auto-fire candidate',()=>{
 const b=new Board(42,16),a=rifle(b,4,6,'A'),near=rifle(b,5,7,'B',false),far=rifle(b,25,6,'B',false);
 assert(b.attack(a.id,far.id));
 assert.equal(a.command?.target,far.id);
 assert(a.step,'focus must actually reserve a forward movement step');
 assert.equal(a.strike,null,'nearby enemy cannot hijack an explicit attack');
 assert.equal(near.health.current,near.health.max);
});

test('squad attack command initiates pursuit rather than staying at its starting positions',()=>{
 const b=new Board(48,24);
 const members=[rifle(b,4,9,'A'),rifle(b,4,10,'A'),rifle(b,4,11,'A')];
 const e=rifle(b,33,10,'B',false);
 registerPlacedGroup(b,members.map(u=>u.id),{team:'A'});
 const squad=[...squadsFor(b).values()][0];
 assert(squad);
 const result=orderSquads(b,[squad.id],'focus',{unitId:e.id});
 assert.deepEqual(result.accepted,[squad.id]);
 for(let i=0;i<12;i++){b.update(.05);updateSquadOrders(b);}
 assert(members.some(u=>u.x>4||u.step?.x>4),'at least one rifleman should pursue the commanded enemy');
});
