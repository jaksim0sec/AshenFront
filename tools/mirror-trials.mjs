import {createMatch,tick,checksum} from '../src/sim/engine.mjs';import {createMap} from '../src/sim/world.mjs';import {writeFile,mkdir} from 'node:fs/promises';
const rows=[];
for(let seed=1;seed<=20;seed++)for(const mirrored of [false,true]){
 const w=createMatch({seed,botTeams:['A','B']}),m=w.map;
 if(mirrored){const copy=createMap();for(const key of ['floorLevel','terrainKind','blocked','transitionMask','edgeMask','coverMask','coverCondition'])for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const a=y*m.width+x,b=y*m.width+m.width-1-x;let v=copy[key][a];if(['transitionMask','edgeMask','coverMask'].includes(key))v=(v&5)|((v&2)<<2)|((v&8)>>2);m[key][b]=v;}m.occupancy.fill(0);for(const u of w.units){u.x=m.width-1-u.x;m.occupancy[u.y*m.width+u.x]=u.id;}for(const o of w.objectives)o.center=Math.floor(o.center/m.width)*m.width+m.width-1-o.center%m.width;}
 while(!w.winner)tick(w);rows.push({seed,mirrored,winner:w.winner,leftSideWinner:w.winner==='draw'?'draw':mirrored?(w.winner==='A'?'B':'A'):w.winner,ticks:w.tick,checksum:checksum(w)});
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/mirror-trials.json',JSON.stringify(rows,null,2));
for(const mirror of [false,true])console.log(JSON.stringify({mirrored:mirror,wins:Object.fromEntries(['A','B','draw'].map(t=>[t,rows.filter(r=>r.mirrored===mirror&&r.winner===t).length]))}));
