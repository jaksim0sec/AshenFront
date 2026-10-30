import test from 'node:test';
import assert from 'node:assert/strict';
import {minimapRegion,minimapWorldPoint,minimapScreenFootprint,MINIMAP_WIDTH_TILES,MINIMAP_HEIGHT_TILES,MINIMAP_SAMPLE_STEP} from '../src/fw/minimap-region.mjs';
import {project} from '../src/fw/model.mjs';

function cameraFor(center,screenWidth=390,screenHeight=844,scale=.4){
 const p=project(center.x,center.y);
 return {x:screenWidth/2-p.x*scale,y:screenHeight/2-p.y*scale,scale};
}
test('minimap observation stays fixed when battlefield grows',()=>{
 const center={x:128,y:96},screenWidth=390,screenHeight=844;
 for(const [width,height] of [[256,192],[512,384],[1024,768]]){
  const region=minimapRegion({width,height},cameraFor(center),screenWidth,screenHeight);
  assert.equal(region.width,MINIMAP_WIDTH_TILES);
  assert.equal(region.height,MINIMAP_HEIGHT_TILES);
  assert.equal(Math.ceil(region.width/MINIMAP_SAMPLE_STEP)*Math.ceil(region.height/MINIMAP_SAMPLE_STEP),4800);
 }
});
test('minimap stays inside the world and maps clicks correctly',()=>{
 const board={width:512,height:384},screenWidth=390,screenHeight=844;
 for(const at of [{x:0,y:0},{x:511,y:383},{x:256,y:192},{x:30,y:350}]){
  const region=minimapRegion(board,cameraFor(at),screenWidth,screenHeight);
  assert.ok(region.x0>=0&&region.y0>=0);
  assert.ok(region.x1<=board.width&&region.y1<=board.height);
  const middle=minimapWorldPoint(region,90,63,180,126);
  assert.equal(middle.x,region.x0+80);
  assert.equal(middle.y,region.y0+60);
  const polygon=minimapScreenFootprint(region,cameraFor(at),screenWidth,screenHeight,180,126);
  assert.equal(polygon.length,4);
  for(const p of polygon)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
 }
});
test('small maps use their actual extents',()=>{
 const region=minimapRegion({width:64,height:48},cameraFor({x:20,y:20}),390,844);
 assert.deepEqual(region,{x0:0,y0:0,width:64,height:48,x1:64,y1:48});
});
