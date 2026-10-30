import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {terrainVariant,terrainMaterial,terrainMaterialCounts,visibleTerrainTiles,terrainDecorations,visibleTerrainDecorations,BattlefieldTerrainRenderer} from '../src/fw/terrain-art.mjs';

function board(width=80,height=70){
 return {width,height,seed:1977,terrainRevision:1,obstacleRevision:1,
  terrain:Array.from({length:height},()=>Array.from({length:width},()=> 'grass')),
  obstacles:new Map(),battlefield:{clearing:{x:width/2,y:height/2,rx:width*.30,ry:height*.30},
   paths:[{kind:'main',points:[{x:10,y:20},{x:width-10,y:20}]}],
   protectedCells:new Uint8Array(width*height)}};
}
test('atlas variant positions are 5x2, six rows cover every material',()=>{
 const values=[];
 for(let y=0;y<2;y++)for(let x=0;x<5;x++)values.push(terrainVariant(x,y));
 assert.deepEqual(values,[0,1,2,3,4,5,6,7,8,9]);assert.equal(terrainVariant(5,2),0);
 const encoded=readFileSync(fileURLToPath(new URL('../assets/world/terrain/ashenfront-atlas.webp.b64',import.meta.url)),'utf8');
 const data=Buffer.from(encoded.trim(),'base64');
 assert.equal(data.toString('ascii',0,4),'RIFF');
 assert.equal(data.toString('ascii',8,12),'WEBP');
 assert.equal(data.toString('ascii',12,16),'VP8L');
 const size=data.readUInt32LE(21);
 assert.equal((size&16383)+1,1440);
 assert.equal(((size>>>14)&16383)+1,642);
});
test('all six visual materials are assigned without changing tactical cells',()=>{
 const b=board();
 b.terrain[5][6]='forest';b.terrain[5][7]='forest';b.terrain[6][7]='road';
 b.obstacles.set(5*b.width+6,{blocked:true,visual:'rock'});
 b.obstacles.set(5*b.width+7,{blocked:true});
 b.terrain[9][9]='soil';
 const before=JSON.stringify(b.terrain),obstacles=JSON.stringify([...b.obstacles]);
 assert.equal(terrainMaterial(b,6,5),'rock');assert.equal(terrainMaterial(b,7,5),'marsh');
 assert.equal(terrainMaterial(b,7,6),'road');assert.equal(terrainMaterial(b,-1,0),'void');
 const counts=terrainMaterialCounts(b);
 for(const material of ['grass','soil','road','marsh','rock','scorched'])assert.ok(counts[material]>0,material);
 assert.equal(JSON.stringify(b.terrain),before);
 assert.equal(JSON.stringify([...b.obstacles]),obstacles);
});
test('all visible tile centers are enumerated exactly once across min/max zoom',()=>{
 const b=board(30,24),width=900,height=630;
 for(const scale of [.07,.1,.11,.12,.18,.3,.5,1.2])for(const [x,y] of [[0,0],[150,-80],[-360,-470]]){
  const tiles=visibleTerrainTiles(b,{x,y,scale},width,height);
  const chosen=new Set(tiles.map(p=>p.x+','+p.y));assert.equal(chosen.size,tiles.length);
  for(let ty=0;ty<b.height;ty++)for(let tx=0;tx<b.width;tx++){
   const px=x+(tx-ty)*72*scale,py=y+(tx+ty)*42*scale;
   if(px>=0&&px<=width&&py>=0&&py<=height)
    assert.ok(chosen.has(tx+','+ty),'missing tile '+tx+','+ty+' at '+scale);
  }
 }
});
test('decorations are visual-only, deterministic, and reused',()=>{
 const b=board(),before=JSON.stringify(b.terrain);
 const first=terrainDecorations(b);
 assert.equal(first,terrainDecorations(b));
 assert.ok(first.every(p=>p.x>=0&&p.x<b.width&&p.y>=0&&p.y<b.height));
 assert.ok(first.every(p=>p.index>=0&&p.index<9));
 assert.equal(JSON.stringify(b.terrain),before);
});
test('zoom 0.07 retains sprites; camera pan reuses painted viewport cache',()=>{
 const priorDocument=globalThis.document,priorFetch=globalThis.fetch,priorImage=globalThis.Image;
 const draws={count:0};
 const ctx=()=>({setTransform(){},clearRect(){},fillRect(){},translate(){},scale(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clip(){},drawImage(){draws.count++}});
 try{
  globalThis.document={createElement:()=>({width:0,height:0,getContext:ctx})};
  globalThis.fetch=async()=>({ok:false,status:404});
  globalThis.Image=class {};
  const renderer=new BattlefieldTerrainRenderer();
  renderer.kind='new';renderer.atlas={};renderer.surface={};renderer.version++;
  const boardInstance=board(30,24),screen=ctx(),camera={x:0,y:0,scale:.07};
  renderer.draw(screen,boardInstance,camera,900,630,1,false);
  const drawn=draws.count;
  assert.ok(drawn>10,'image sprites should be drawn at minimum zoom');
  assert.equal(renderer.rebuilds,1);
  renderer.draw(screen,boardInstance,{...camera,x:60,y:50},900,630,1,false);
  assert.equal(renderer.rebuilds,1);
  renderer.draw(screen,boardInstance,{...camera,x:200},900,630,1,false);
  assert.equal(renderer.rebuilds,2);
 }finally{globalThis.document=priorDocument;globalThis.fetch=priorFetch;globalThis.Image=priorImage;}
});

test('terrain viewport LRU reuses return pans, settles zoom, and expires stale pages',()=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch,oldImage=globalThis.Image;
 const ctx=()=>({setTransform(){},clearRect(){},fillRect(){},translate(){},scale(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clip(){},drawImage(){}});
 try{
  globalThis.document={createElement:()=>({width:0,height:0,getContext:ctx})};
  globalThis.fetch=async()=>({ok:false});globalThis.Image=class{};
  const renderer=new BattlefieldTerrainRenderer(),b=board(80,70),screen=ctx(),cam={x:0,y:0,scale:.3};
  renderer.kind='new';renderer.atlas={};renderer.surface={};renderer.version++;
  renderer.draw(screen,b,cam,390,844,1,false,1000);
  renderer.draw(screen,b,{...cam,x:450},390,844,1,false,1100);
  assert.equal(renderer.rebuilds,2);
  renderer.draw(screen,b,cam,390,844,1,false,1200);
  assert.equal(renderer.rebuilds,2);assert.ok(renderer.cacheHits>=1);
  renderer.draw(screen,b,{...cam,scale:.32},390,844,1,false,1300);
  assert.equal(renderer.rebuilds,2);assert.ok(renderer.zoomReuses>=1);
  renderer.draw(screen,b,{...cam,scale:.32},390,844,1,false,1500);
  assert.equal(renderer.rebuilds,3);
  b.terrainRevision++;renderer.draw(screen,b,cam,390,844,1,false,1600);
  assert.equal(renderer.rebuilds,4);
  renderer.draw(screen,b,cam,390,844,1,false,23000);
  assert.equal(renderer.rebuilds,5);assert.ok(renderer.evictions>=1);
 }finally{globalThis.document=oldDocument;globalThis.fetch=oldFetch;globalThis.Image=oldImage;}
});

test('visible terrain work depends on viewport size, not total battlefield area',()=>{
 const small=board(176,128),large=board(512,384);
 // Same camera position in world-space, far from boundaries in either board.
 const point={x:90,y:60},scale=.35,width=390,height=844;
 const camera={x:width/2-(point.x-point.y)*72*scale,y:height/2-(point.x+point.y)*42*scale,scale};
 const before=visibleTerrainTiles(small,camera,width,height);
 const after=visibleTerrainTiles(large,camera,width,height);
 assert.equal(after.length,before.length,'invisible map expansion must not add tile draws');
 assert.ok(after.length>100&&after.length<large.width*large.height/8);
});
test('spatial decoration retrieval matches viewport-filtered full list',()=>{
 const b=board(256,192),items=terrainDecorations(b);
 for(const box of [[0,50,0,50],[50,125,25,105],[160,255,90,191],[-12,30,-10,35],[100,80,50,70]]){
  const [x0,x1,y0,y1]=box;
  const expected=items.filter(p=>p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1);
  assert.deepEqual(visibleTerrainDecorations(b,...box),expected,'decor viewport mismatch: '+box);
 }
 // A new terrain revision replaces the memoized prop list and bucket index.
 b.terrain[18][18]='forest';b.terrainRevision++;
 assert.deepEqual(visibleTerrainDecorations(b,0,100,0,100),terrainDecorations(b).filter(p=>p.x<=100&&p.y<=100));
});
