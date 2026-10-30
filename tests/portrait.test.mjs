import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalog} from '../src/characters/model.mjs';
import {portraitPlacement} from '../src/characters/portrait.mjs';

test('military rank portraits fill the bust frame without clipping the hat',()=>{
 const profiles=createCatalog().profiles;
 for(const nation of ['arken','velian'])
 for(const rank of ['private','sergeant','captain','major']){
  const p=portraitPlacement(profiles[nation+':'+rank]),top=p.y+p.head.top*p.scale;
  const bottom=p.y+p.torso.bottom*p.scale;
  const left=p.x+p.head.left*p.scale,right=p.x+p.head.right*p.scale;
  assert(top>=8.9&&top<=9.1,nation+':'+rank+' cap should align to the upper inset');
  assert(bottom<=244&&bottom>=135,nation+':'+rank+' upper torso must remain in frame');
  assert(left>=-15&&right<=240,nation+':'+rank+' head should not crop on both sides');
  assert(p.scale>.8&&p.scale<=1.35,'invalid portrait scale');
 }
});
