import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {terrainVariant,terrainMaterial,terrainMaterialCounts,visibleTerrainTiles,terrainDecorations,visibleTerrainDecorations,BattlefieldTerrainRenderer,TRENCH_ATLAS,trenchBedTile,trenchRampTile,trenchWallTile} from '../src/fw/terrain-art.mjs';

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

test('restoring a suspended canvas rebuilds the cached terrain and derived texture surfaces',async()=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch,oldImage=globalThis.Image;
 const calls={draws:0};
 const ctx=()=>({setTransform(){},clearRect(){},fillRect(){},translate(){},scale(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clip(){},drawImage(){calls.draws++}});
 try{
  globalThis.document={createElement:()=>({width:0,height:0,getContext:ctx})};
  globalThis.fetch=async()=>({ok:false,status:404});
  globalThis.Image=class {};
  const renderer=new BattlefieldTerrainRenderer();await renderer.ready;
  const b=board(30,24),screen=ctx(),cam={x:0,y:0,scale:.3};
  renderer.kind='new';renderer.sourceAtlas={naturalWidth:1440,naturalHeight:642};
  renderer.sourceDecorations={naturalWidth:1020,naturalHeight:810};
  renderer.atlas=renderer.sourceAtlas;renderer.surface={old:true};renderer.decorations={old:true};
  renderer.draw(screen,b,cam,390,844,1,false,1000);
  renderer.draw(screen,b,cam,390,844,1,false,1100);
  assert.equal(renderer.rebuilds,1,'unchanged viewport should hit cache');
  assert.equal(renderer.cacheHits,1);
  const before=renderer.version;
  renderer.restore();
  assert.equal(renderer.pages.length,0,'discard old GPU-backed viewport pages');
  assert.equal(renderer.cache,null);
  assert.ok(renderer.surface&&!renderer.surface.old,'recreate the derived terrain surface');
  assert.ok(renderer.decorations&&!renderer.decorations.old,'recreate decorations');
  assert.equal(renderer.version,before+1);
  renderer.draw(screen,b,cam,390,844,1,false,1200);
  assert.equal(renderer.rebuilds,2,'same camera must repaint rather than reuse a potentially blank page');
  assert.ok(calls.draws>0);
 }finally{globalThis.document=oldDocument;globalThis.fetch=oldFetch;globalThis.Image=oldImage;}
});

test('trench bottom uses soil art and visual index changes after height revision',()=>{
 const b=board(28,25),n=11*b.width+8;
 b.floorLevel=new Uint8Array(b.width*b.height).fill(1);
 const original=terrainMaterial(b,8,11);
 b.floorLevel[n]=0;b.floorLevelRevision=1;
 assert.equal(terrainMaterial(b,8,11),'soil');
 b.floorLevel[n]=1;b.floorLevelRevision++;
 assert.equal(terrainMaterial(b,8,11),original);
});

test('walls paint into the terrain cache and never redraw over a soldier every frame',()=>{
 const oldDoc=globalThis.document,oldFetch=globalThis.fetch,oldImage=globalThis.Image;
 const ctx=()=>({setTransform(){},clearRect(){},fillRect(){},translate(){},scale(){},save(){},restore(){},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clip(){},drawImage(){}});
 try{
  globalThis.document={createElement:()=>({width:0,height:0,getContext:ctx})};
  globalThis.fetch=async()=>({ok:false});globalThis.Image=class {};
  const r=new BattlefieldTerrainRenderer();r.kind='new';r.atlas={};r.surface={};r.version++;
  const b=board(30,24);b.floorLevel=new Uint8Array(b.width*b.height).fill(1);
  b.floorLevel[10*b.width+10]=0;b.floorLevelRevision=1;
  const drawn=[],original=r.drawOccluder;
  r.drawOccluder=function(t,b,f){drawn.push(f);return original.call(this,t,b,f);};
  const screen=ctx(),cam={x:0,y:0,scale:.3};
  r.draw(screen,b,cam,390,844,1,false,1000);
  assert.ok(drawn.some(f=>f.low===0),'earth bank is part of terrain');
  const n=drawn.length;
  r.draw(screen,b,cam,390,844,1,false,1050);
  assert.equal(drawn.length,n,'cached terrain reuses wall draw');
  b.floorLevel[10*b.width+10]=1;b.floorLevelRevision++;
  r.draw(screen,b,cam,390,844,1,false,1100);
  assert.equal(drawn.length,n,'filling trench erases bank');
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;globalThis.Image=oldImage;}
});

test('real trench sprite atlas is exactly 5x2 image cells at 144x107',()=>{
 const svg=readFileSync(new URL('../assets/world/terrain/trench-atlas.svg',import.meta.url),'utf8');
 assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="720" height="214" viewBox="0 0 720 214"/);
 assert.deepEqual(TRENCH_ATLAS,{width:720,height:214,columns:5,rows:2,tileWidth:144,tileHeight:107});
 const transforms=[...svg.matchAll(/<g transform="translate\((\d+) (\d+)\)">/g)]
  .map(m=>[Number(m[1]),Number(m[2])]);
 assert.equal(transforms.length,10,'all ten finished graphics have distinct atlas cells');
 assert.deepEqual([...new Set(transforms.map(p=>p.join(',')))].sort(),[...Array(10)].map((_,i)=>[(i%5)*144,Math.floor(i/5)*107].join(',')).sort());
 for(const [x,y] of transforms)assert(x>=0&&x<=576&&y>=0&&y<=107);
 for(let i=0;i<8;i++)assert(trenchBedTile(i,11,1977)>=0&&trenchBedTile(i,11,1977)<4);
 for(const edge of ['east','south']){
  const tile=trenchWallTile({kind:'wall',edge,x:3,y:8,level:1,low:0},1977);
  assert(edge==='east'?[4,8].includes(tile):[5,9].includes(tile));
 }
 assert.equal(trenchWallTile({kind:'wall',edge:'east',level:2,low:1}),null,'hill cliffs keep their existing visuals');
});
test('trench image renders mud floor, reciprocal ramp and exposed bank into cached map',()=>{
 const oldDoc=globalThis.document,oldFetch=globalThis.fetch,oldImage=globalThis.Image;
 const calls=[],textures=[],transforms=[],atlas={width:720,height:214},soil={width:1440,height:642};
 const ctx=()=>({setTransform(){},clearRect(){},fillRect(){},translate(){},scale(){},save(){},restore(){},
  transform(...args){transforms.push(args);},createLinearGradient(){return {addColorStop(){}};},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clip(){},drawImage(...args){
   if(args[0]===atlas)calls.push(args);
   if(args[0]===soil&&args.length===9)textures.push(args);
  }});
 try{
  globalThis.document={createElement:()=>({width:0,height:0,getContext:ctx})};
  globalThis.fetch=async()=>({ok:false});
  globalThis.Image=class {};
  const r=new BattlefieldTerrainRenderer();
  r.kind='new';r.atlas=soil;r.surface={};r.trenchAtlas=atlas;r.version++;
  const b=board(30,24),i=10*b.width+10;
  b.floorLevel=new Uint8Array(b.width*b.height).fill(1);b.floorLevel[i]=0;
  b.heightRamps=new Uint8Array(b.width*b.height);b.heightRamps[i]=4;b.floorLevelRevision=1;
  assert.equal(trenchRampTile(b,10,10),6);
  const screen=ctx(),camera={x:0,y:0,scale:.3};
  r.draw(screen,b,camera,390,844,1,false,1000);
  assert(calls.some(a=>a[1]%144===0&&a[2]===0),'mud must render as a sprite from the first row');
  assert(calls.some(a=>a[1]===144&&a[2]===107),'reciprocal W ramp must use tile 6');
  assert(transforms.some(m=>m.length===6&&m[3]>0&&m[3]<=1.05),'bank dirt texture must be projected along cut face');
  assert(textures.some(a=>a[3]===52&&a[4]===23&&a[2]===107+33),'wall texture must come from opaque soil interior, not dark tile rim');
  assert(calls.every(a=>a.length===9&&a[3]===144&&a[4]===107&&a[7]===144&&a[8]===107));
  const drawn=calls.length,projected=transforms.length;
  r.draw(screen,b,camera,390,844,1,false,1050);
  assert.equal(calls.length,drawn,'background atlas sprites are cached');
  assert.equal(transforms.length,projected,'bank projection must be cached rather than repeated every frame');
  b.floorLevel[i]=1;b.floorLevelRevision++;
  r.draw(screen,b,camera,390,844,1,false,1100);
  assert.equal(calls.length,drawn,'filled trench clears sprites from the viewport');
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;globalThis.Image=oldImage;}
});

test('new trench asset is transparent soil treatment, not opaque slabs, ladders or picket fences',()=>{
 const svg=readFileSync(new URL('../assets/world/terrain/trench-atlas.svg',import.meta.url),'utf8');
 assert.match(svg,/id="diamond"/);
 assert.match(svg,/fill="url\(#bed\)"/);
 assert.match(svg,/fill="url\(#earth\)"/);
 assert.match(svg,/feTurbulence/);
 assert.doesNotMatch(svg,/(wooden fence|palisade|ladder|railroad sleeper|fence post)/i);
 assert.ok((svg.match(/clip-path="url\(#diamond\)"/g)||[]).length>=6,'floor and ramp overlays stay inside diamond');
});

test('excavated floor receives directional inward shadow only beside higher banks',()=>{
 const oldDoc=globalThis.document,oldFetch=globalThis.fetch,oldImage=globalThis.Image;
 let shades=0;
 const ctx=()=>({setTransform(){},clearRect(){},fillRect(){},translate(){},scale(){},
  save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
  fill(){},stroke(){},clip(){},drawImage(){},
  createLinearGradient(){shades++;return {addColorStop(){}};}});
 try{
  globalThis.document={createElement:()=>({width:0,height:0,getContext:ctx})};
  globalThis.fetch=async()=>({ok:false});globalThis.Image=class {};
  const r=new BattlefieldTerrainRenderer();r.atlas={};r.surface={};
  r.trenchAtlas={width:720,height:214};r.kind='new';r.version++;
  // Suppress bank painting: inspect actual floor inset shadow cost and geometry.
  r.drawOccluder=()=>{};
  const b=board(20,20),ix=(x,y)=>y*b.width+x;
  b.floorLevel=new Uint8Array(b.width*b.height).fill(1);
  b.floorLevel[ix(10,10)]=0;b.floorLevelRevision=1;
  b.heightRamps=new Uint8Array(b.width*b.height);
  const screen=ctx(),camera={x:0,y:0,scale:.3};
  r.draw(screen,b,camera,390,844,1,false,1000);
  assert.equal(shades,4,'all four high banks cast directional shadows into the cut');
  const first=shades;
  r.draw(screen,b,camera,390,844,1,false,1050);
  assert.equal(shades,first,'no per-frame shadow recalculation on a cache hit');
  b.heightRamps[ix(10,10)]=4;b.floorLevelRevision++;
  r.draw(screen,b,camera,390,844,1,false,1100);
  assert.equal(shades-first,3,'open west ramp is not blocked by a dark wall shadow');
 }finally{globalThis.document=oldDoc;globalThis.fetch=oldFetch;globalThis.Image=oldImage;}
});

test('trench cut geometry uses photographic soil, light broken lip and no black 2D slab',()=>{
 const r=Object.create(BattlefieldTerrainRenderer.prototype);
 r.atlas={};r.trenchAtlas={};r.kind='new';
 const strokes=[],textures=[],gradients=[],ops=[];
 const ctx={save(){ops.push('save');},restore(){ops.push('restore');},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},fill(){},
  stroke(){strokes.push([this.strokeStyle,this.lineWidth]);},
  transform(...args){ops.push('project');},
  createLinearGradient(){const stops=[];gradients.push(stops);return {addColorStop(...args){stops.push(args);}};},
  drawImage(...args){textures.push(args);}};
 r.drawOccluder(ctx,{seed:45},{kind:'wall',x:10,y:11,edge:'east',level:1,low:0});
 assert.equal(textures.length,1,'one photographic soil crop per cut face');
 assert.equal(textures[0][3],52);
 assert.equal(textures[0][4],23);
 assert.equal(ops.filter(o=>o==='project').length,1);
 assert.equal(ops.filter(o=>o==='save').length,ops.filter(o=>o==='restore').length);
 assert.ok(strokes.some(([color,width])=>color==='#b09b7f9a'&&width<=1.3),'rim must be fine and irregular');
 assert.ok(gradients.every(stops=>stops.at(-1)?.[1]!=='rgba(24,20,17,.69)'),'no old heavy black wall band');
 textures.length=0;
 r.drawOccluder(ctx,{seed:45},{kind:'wall',x:10,y:11,edge:'east',level:2,low:1});
 assert.equal(textures.length,0,'existing high-ground art remains unchanged');
});
