import {createGame} from './state.mjs';import {command} from './commands.mjs';import {stepMovement} from './navigation.mjs';import {resolveFire} from './combat.mjs';import {recoverSuppression} from './squads.mjs';import {initializeObjectives,updateObjectives} from './objectives.mjs';import {runBots} from './bot.mjs';
export function createMatch(options={}) {const w=createGame(options);initializeObjectives(w,options.sectors??1);return w;}
export function tick(w,commands=[]) {
 if(w.winner)return;
 const inputs=w.queue.splice(0);inputs.push(...commands);
 for(const c of inputs)command(w,c.team,c);
 stepMovement(w);w.metrics.navTotal=(w.metrics.navTotal??0)+w.metrics.navExpansions;w.metrics.navPeak=Math.max(w.metrics.navPeak??0,w.metrics.navExpansions);w.metrics.navQueuePeak=Math.max(w.metrics.navQueuePeak??0,w.navigation.pending);resolveFire(w);recoverSuppression(w);updateObjectives(w);if(!w.winner)runBots(w);w.tick++;
}
export function checksum(w) {
 const text=JSON.stringify({tick:w.tick,seed:w.seed,units:w.units,squads:w.squads,objectives:w.objectives,winner:w.winner,scores:w.scores,support:w.support,map:w.map,queue:w.queue,teamHold:w.teamHold,limitTicks:w.limitTicks,holdTicks:w.holdTicks,botTeams:w.botTeams,combat:w.combat});let h=2166136261;
 for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');
}
export class FixedClock {
 constructor(){this.backlog=0;this.steps=0;this.slowFrames=0;}
 advance(elapsed,step){this.backlog+=Math.max(0,elapsed);let count=0;while(this.backlog+1e-7>=50&&count<3){step();this.backlog-=50;count++;this.steps++;}if(this.backlog>=50)this.slowFrames++;return count;}
}
