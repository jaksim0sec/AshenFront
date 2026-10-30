// Discrete formations adapted from FlowerWars' forward/side offsets. AshenFront's
// terrain graph remains authoritative: these offsets only rank legal seats.
export const FORMATIONS=Object.freeze(['line','column','square','spread']);
export const validFormation=value=>FORMATIONS.includes(value);
export function formationOffsets(kind,count,horizontal=true){
 if(count===1)return [{x:0,y:0}];
 let offsets=[];
 if(kind==='square'){
  const radius=Math.max(1,Math.ceil((Math.sqrt(count+1)-1)/2)),ring=[];
  for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++)if(Math.max(Math.abs(x),Math.abs(y))===radius)ring.push({x,y});
  ring.sort((a,b)=>Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x));
  offsets=Array.from({length:Math.min(count,ring.length)},(_,n)=>ring[Math.floor(n*ring.length/Math.min(count,ring.length))]);
  for(let y=-radius+1;y<radius&&offsets.length<count;y++)for(let x=-radius+1;x<radius&&offsets.length<count;x++)offsets.push({x,y});
 }else{
  const width=kind==='column'?2:Math.min(5,Math.max(1,count)),gap=kind==='spread'?2:1;
  for(let n=0;n<count;n++)offsets.push({x:Math.floor(n/width)*gap,y:(n%width-Math.floor(Math.min(width,count-Math.floor(n/width)*width)/2))*gap});
 }
 return horizontal?offsets:offsets.map(p=>({x:p.y,y:p.x}));
}
