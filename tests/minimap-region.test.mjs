import test from 'node:test';
import assert from 'node:assert/strict';
import {minimapRegion,minimapWorldPoint,minimapScreenFootprint,minimapCameraMarker,MINIMAP_WIDTH_TILES,MINIMAP_HEIGHT_TILES,MINIMAP_SAMPLE_STEP} from '../src/fw/minimap-region.mjs';
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
  assert.equal(region.width,region.height,'world pixels must be square');
  assert.equal(Math.ceil(region.width/MINIMAP_SAMPLE_STEP)*Math.ceil(region.height/MINIMAP_SAMPLE_STEP),3600);
 }
});
test('minimap stays inside the world and maps clicks correctly',()=>{
 const board={width:512,height:384},screenWidth=390,screenHeight=844;
 for(const at of [{x:0,y:0},{x:511,y:383},{x:256,y:192},{x:30,y:350}]){
  const region=minimapRegion(board,cameraFor(at),screenWidth,screenHeight);
  assert.ok(region.x0>=0&&region.y0>=0);
  assert.ok(region.x1<=board.width&&region.y1<=board.height);
  const middle=minimapWorldPoint(region,90,90,180,180);
  assert.equal(middle.x,region.x0+60);
  assert.equal(middle.y,region.y0+60);
  const polygon=minimapScreenFootprint(region,cameraFor(at),screenWidth,screenHeight,180,180);
  assert.equal(polygon.length,4);
  for(const p of polygon)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
 }
});
test('north-up camera reticle follows world center without rotating the terrain',()=>{
 const board={width:512,height:384},screenWidth=390,screenHeight=844;
 for(const at of [{x:128,y:96},{x:256,y:192},{x:10,y:20},{x:500,y:370}]){
  const camera=cameraFor(at),region=minimapRegion(board,camera,screenWidth,screenHeight);
  const point=minimapCameraMarker(region,camera,screenWidth,screenHeight,180,180);
  assert.ok(Math.abs(point.x-(at.x-region.x0)*180/region.width)<1e-7);
  assert.ok(Math.abs(point.y-(at.y-region.y0)*180/region.height)<1e-7);
  assert.deepEqual(minimapWorldPoint(region,point.x,point.y,180,180),at);
 }
});
test('small maps use their actual extents',()=>{
 const region=minimapRegion({width:64,height:48},cameraFor({x:20,y:20}),390,844);
 assert.deepEqual(region,{x0:0,y0:0,width:64,height:48,x1:64,y1:48});
});
