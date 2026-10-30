import {performance} from 'node:perf_hooks';
import {createMatch,tick} from '../src/sim/engine.mjs';
import {createMap} from '../src/sim/world.mjs';
import {assertInvariants} from '../src/sim/state.mjs';
import {botController} from '../src/sim/bot.mjs';
const results=[];
for(const [size,squads]of[[64,4],[128,9],[256,18]]){
 const w=createMatch({seed:1977,scenario:'war',map:createMap(size,size*3/4),squadsPerTeam:squads,botTeams:['A','B']}),samples=[];
 for(let n=0;n<100;n++){const start=performance.now();tick(w);samples.push(performance.now()-start);if(w.metrics.navExpansions>2048)throw Error('Navigation budget exceeded');}
 assertInvariants(w);const sorted=[...samples].sort((a,b)=>a-b);results.push({map:[size,size*3/4],actors:w.units.length,ticks:100,averageMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:sorted[94],maxMs:sorted.at(-1),navPeak:w.metrics.navPeak,aiOrders:botController(w,'B').metrics.orders,defaultRelease:size===64});
}
console.log(JSON.stringify({node:process.version,kind:'Node simulation only, no browser or device FPS measurement',results},null,2));
