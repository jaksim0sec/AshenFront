export class SpatialIndex {
 constructor(units,size=8){this.size=size;this.buckets=new Map();for(const u of units)if(u.hp>0){const key=Math.floor(u.x/size)+','+Math.floor(u.y/size);if(!this.buckets.has(key))this.buckets.set(key,[]);this.buckets.get(key).push(u);}}
 query(x,y,r){const out=[];for(let by=Math.floor((y-r)/this.size);by<=Math.floor((y+r)/this.size);by++)for(let bx=Math.floor((x-r)/this.size);bx<=Math.floor((x+r)/this.size);bx++){const bucket=this.buckets.get(bx+','+by);if(bucket)out.push(...bucket);}return out;}
}
// Transient view/query cache; never part of replay state.
const caches=new WeakMap();
export function spatialIndex(w){let entry=caches.get(w);if(!entry||entry.revision!==(w.spatialRevision??0)){entry={revision:w.spatialRevision??0,index:new SpatialIndex(w.units)};caches.set(w,entry);}return entry.index;}
