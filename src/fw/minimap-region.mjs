import {unproject} from './model.mjs';

// Fixed local observation window, independent of full battlefield dimensions.
// Square north-up observation; 3,600 terrain samples at step 2 (previously 4,800).
export const MINIMAP_WIDTH_TILES=120;
export const MINIMAP_HEIGHT_TILES=120;
export const MINIMAP_SAMPLE_STEP=2;
const CAMERA_GRANULARITY=8;

export function minimapRegion(board,camera,screenWidth,screenHeight){
 const width=Math.min(board.width,MINIMAP_WIDTH_TILES);
 const height=Math.min(board.height,MINIMAP_HEIGHT_TILES);
 const center=unproject((screenWidth/2-camera.x)/camera.scale,(screenHeight/2-camera.y)/camera.scale);
 const clamp=(v,max)=>Math.max(0,Math.min(max,v));
 const x0=clamp(Math.round((center.x-width/2)/CAMERA_GRANULARITY)*CAMERA_GRANULARITY,board.width-width);
 const y0=clamp(Math.round((center.y-height/2)/CAMERA_GRANULARITY)*CAMERA_GRANULARITY,board.height-height);
 return {x0,y0,width,height,x1:x0+width,y1:y0+height};
}

export function minimapWorldPoint(region,px,py,canvasWidth,canvasHeight){
 return {x:Math.round(region.x0+px/canvasWidth*region.width),
  y:Math.round(region.y0+py/canvasHeight*region.height)};
}

// Convert only the camera center to north-up radar coordinates.
// The old isometric viewport polygon required four inverse projections.
export function minimapCameraMarker(region,camera,screenWidth,screenHeight,mapWidth,mapHeight){
 const center=unproject((screenWidth/2-camera.x)/camera.scale,(screenHeight/2-camera.y)/camera.scale);
 return {x:(center.x-region.x0)*mapWidth/region.width,y:(center.y-region.y0)*mapHeight/region.height};
}

export function minimapScreenFootprint(region,camera,screenWidth,screenHeight,mapWidth,mapHeight){
 const corners=[[0,0],[screenWidth,0],[screenWidth,screenHeight],[0,screenHeight]];
 return corners.map(([x,y])=>{
  const p=unproject((x-camera.x)/camera.scale,(y-camera.y)/camera.scale);
  return {x:(p.x-region.x0)*mapWidth/region.width,y:(p.y-region.y0)*mapHeight/region.height};
 });
}
