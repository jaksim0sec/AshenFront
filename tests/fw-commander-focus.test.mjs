import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/fw/model.mjs';
import {registerPlacedGroup,squadsFor} from '../src/fw/unit-groups.mjs';
import {orderSquads} from '../src/fw/squad-orders.mjs';

test('banner rifleman with no cover assignment obeys an explicit focus order',()=>{
 const b=new Board(48,20);
 const soldiers=[b.spawn(4,9,null,{team:'A',stats:{range:5,rangeShape:'king'},autoCombat:true}),
                 b.spawn(4,10,null,{team:'A',stats:{range:5,rangeShape:'king'},autoCombat:true}),
                 b.spawn(4,11,null,{team:'A',stats:{range:5,rangeShape:'king'},autoCombat:true})];
 soldiers[0].formationRole='banner';
 registerPlacedGroup(b,soldiers.map(u=>u.id),{team:'A'});
 const enemy=b.spawn(28,9,null,{team:'B',stats:{range:5,rangeShape:'king'},autoCombat:false});
 const squad=[...squadsFor(b).values()][0];
 assert.deepEqual(orderSquads(b,[squad.id],'focus',{unitId:enemy.id}).accepted,[squad.id]);
 assert.equal(soldiers[0].command?.type,'attack');
 assert.equal(soldiers[0].command?.target,enemy.id);
 assert(soldiers[0].step,'rifle commander should actually move toward the focus target');
});
