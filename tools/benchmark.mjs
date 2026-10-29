import {performance} from 'node:perf_hooks';import {writeFile,mkdir} from 'node:fs/promises';import os from 'node:os';
import {createMap} from '../src/sim/world.mjs';import {createMatch,tick,checksum} from '../src/sim/engine.mjs';import {assertInvariants} from '../src/sim/state.mjs';import {command} from '../src/sim/commands.mjs';
const quantile=(a,q)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*q)];
const results=[];
for(const [width,height,squads,seconds] of [[64,48,4,600],[128,96,9,600],[256,192,18,1200]]) {
 for(const mode of ['combat-match','living-movement-soak']) {
  const w=createMatch({seed:42,map:createMap(width,height),squadsPerTeam:squads,sectors:width===64?1:3,botTeams:['A','B'],combat:mode==='combat-match'}),samples=[],memory=[];let stalls=0;
  // Soak keeps all actors alive, repeatedly routing them for the entire requested duration.
  if(mode==='living-movement-soak'){w.botTeams=[];w.objectives=[];w.limitTicks=seconds*20+1;}
  const before=process.memoryUsage(),start=performance.now();
  for(let i=0;i<seconds*20;i++) {
   if(mode==='living-movement-soak'&&i%800===0){const phase=Math.floor(i/800)%2;for(const s of w.squads){const unit=w.units[s.unitIds[0]-1],targetX=phase?Math.floor(width*.2):Math.floor(width*.8),y=Math.min(height-3,Math.max(3,unit.y));command(w,s.team,{type:'move',squadId:s.id,target:y*width+targetX});}}
   const t=performance.now();tick(w);samples.push(performance.now()-t);
   if(i%100===0){assertInvariants(w);if(mode==='living-movement-soak')stalls=Math.max(stalls,...w.units.filter(u=>u.hp>0).map(u=>u.wait));}
   if(i%1200===0)memory.push({seconds:i/20,heap:process.memoryUsage().heapUsed,arrayBuffers:process.memoryUsage().arrayBuffers});
   if(w.winner)break;
  }
  assertInvariants(w);const after=process.memoryUsage();results.push({width,height,actors:squads*20,seed:42,mode,requestedSeconds:seconds,simulatedSeconds:w.tick/20,elapsedMs:performance.now()-start,p95ms:quantile(samples,.95),p99ms:quantile(samples,.99),maxMs:Math.max(...samples),winner:w.winner,checksum:checksum(w),metrics:w.metrics,maxObservedWaitTicks:stalls,remaining:w.units.filter(u=>u.hp>0).length,navFields:w.navigation.fields.size,heapDelta:after.heapUsed-before.heapUsed,arrayBufferDelta:after.arrayBuffers-before.arrayBuffers,memory});
 }
}
const report={recordedAt:new Date().toISOString(),runtime:process.version,platform:os.platform(),os:os.release(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,note:'Cloud CPU simulations, not physical Android or render performance. Match mode stops at outcome; soak mode runs full duration with all units alive.',results};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/benchmark.json',JSON.stringify(report,null,2));
for(const r of results)console.log(JSON.stringify({...r,memory:undefined}));
