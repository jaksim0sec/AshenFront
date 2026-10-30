import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/fw/model.mjs';
import {NAV_INTERVAL} from '../src/fw/navigation.mjs';

// This is a DIAGNOSTIC regression probe, not a requirement to preserve the gaps.
test('report navigation cadence and inter-tile pauses independently of frame rate',()=>{
 const board=new Board(32,20),unit=board.spawn(4,10);
 assert(unit,'soldier must spawn');
 assert(board.move(unit.id,23,10),'soldier must accept uninterrupted movement across flat tiles');
 const dt=1/60,arrivals=[],departures=[],idleFrames=[],delta=[];
 let wasMoving=false,firstMove=false;
 for(let n=0;n<720;n++){
  const before=unit.visualX;
  board.update(dt);
  const moving=!!unit.step;
  if(!wasMoving&&moving){departures.push(board.time);firstMove=true;}
  if(wasMoving&&!moving)arrivals.push(board.time);
  if(firstMove&&!moving&&unit.command)idleFrames.push(board.time);
  delta.push(Math.abs(unit.visualX-before));
  wasMoving=moving;
  if(unit.x===23&&unit.y===10&&!unit.step)break;
 }
 const pauses=arrivals.slice(0,-1).map((finished,i)=>departures[i+1]-finished).filter(Number.isFinite);
 const positive=pauses.filter(p=>p>.001);
 assert(departures.length>4,'route must walk through several cells');
 assert.equal(unit.x,23,'probe must reach destination');
 const stats={navIntervalMs:Math.round(NAV_INTERVAL*1000),starts:departures.length,
   transitPausesMs:positive.map(x=>Math.round(x*1000)),maxPauseMs:Math.max(0,...positive)*1000,
   avgPauseMs:positive.reduce((n,p)=>n+p,0)/Math.max(1,positive.length)*1000,
   zeroDisplacementFrames:delta.filter(x=>x<1e-7).length,renderThrottleMs:33};
 console.log('MOVE_CADENCE',JSON.stringify(stats));
});
