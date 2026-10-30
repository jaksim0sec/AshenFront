import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainVariant,terrainMaterial,visibleTerrainTiles,terrainDecorations} from '../src/fw/terrain-art.mjs';

function board(width=30,height=24){
 return {width,height,seed:1977,terrainRevision:1,obstacleRevision:1,
  terrain:Array.from({length:height},()=>Array.from({length:width},()=> 'grass')),
  obstacles:new Map(),battlefield:{protectedCells:new Uint8Array(width*height)}};
}
test('isometric atlas uses the original deterministic 5x2 phase',()=>{
 const values=[];
 for(let y=0;y<2;y++)for(let x=0;x<5;x++)values.push(terrainVariant(x,y));
 assert.deepEqual(values,[0,1,2,3,4,5,6,7,8,9]);
 assert.equal(terrainVariant(5,2),0);
});
test('visual material mapping never changes blocked or path metadata',()=>{
 const b=board();b.terrain[5][6]='forest';b.terrain[5][7]='forest';b.terrain[6][7]='road';
 b.obstacles.set(5*b.width+6,{blocked:true,visual:'rock'});
 b.obstacles.set(5*b.width+7,{blocked:true});
 const before=JSON.stringify([...b.obstacles]);
 assert.equal(terrainMaterial(b,6,5),'rock');
 assert.equal(terrainMaterial(b,7,5),'pond');
 assert.equal(terrainMaterial(b,7,6),'road');
 assert.equal(terrainMaterial(b,-1,0),'void');
 assert.equal(JSON.stringify([...b.obstacles]),before);
});
test('all tile centers within camera viewport are enumerated once',()=>{
 const b=board();
 for(const scale of [.12,.2,.5,1.2])for(const [x,y] of [[0,0],[150,-80],[-360,-470]]){
  const camera={x,y,scale},width=900,height=630;
  const tiles=visibleTerrainTiles(b,camera,width,height);
  const chosen=new Set(tiles.map(p=>p.x+','+p.y));
  assert.equal(chosen.size,tiles.length);
  for(let ty=0;ty<b.height;ty++)for(let tx=0;tx<b.width;tx++){
   const px=x+(tx-ty)*72*scale,py=y+(tx+ty)*42*scale;
   if(px>=0&&px<=width&&py>=0&&py<=height)
    assert.ok(chosen.has(tx+','+ty),'missing tile '+tx+','+ty+' at '+scale);
  }
 }
});
test('static visual decorations are deterministic and respect reserved paths',()=>{
 const b=board(80,70),first=terrainDecorations(b),second=terrainDecorations(b);
 assert.equal(first,second);
 assert.ok(first.every(p=>p.x>=0&&p.x<b.width&&p.y>=0&&p.y<b.height));
 assert.ok(first.every(p=>p.index>=0&&p.index<9));
 assert.equal(b.terrainRevision,1);
});
