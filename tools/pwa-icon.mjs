import {readFileSync} from 'node:fs';
import {brotliDecompressSync,deflateSync} from 'node:zlib';

// 160px palette master of the approved two-army emblem.
// Reuse this one image for the favicon, installation icon and maskable icons.
const master=brotliDecompressSync(readFileSync(new URL('../assets/branding/app-icon.br',import.meta.url)));
if(master.toString('ascii',0,4)!=='AFIC')throw Error('Invalid AshenFront icon master');
const width=master.readUInt16BE(4),colors=master.readUInt16BE(6);
const palette=master.subarray(8,8+colors*3),pixels=master.subarray(8+colors*3);
if(width!==160||colors!==48||pixels.length!==width*width)throw Error('Unexpected AshenFront icon master dimensions');

function crc(buffer){
 let n=0xffffffff;
 for(const b of buffer){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}
 return (n^0xffffffff)>>>0;
}
function chunk(type,data){
 const label=Buffer.from(type),length=Buffer.alloc(4),tail=Buffer.alloc(4);
 length.writeUInt32BE(data.length);tail.writeUInt32BE(crc(Buffer.concat([label,data])));
 return Buffer.concat([length,label,data,tail]);
}
function sample(x,y,channel){
 const px=Math.max(0,Math.min(width-1,x)),py=Math.max(0,Math.min(width-1,y));
 const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(width-1,x0+1),y1=Math.min(width-1,y0+1);
 const sx=px-x0,sy=py-y0;
 const rgb=(u,v)=>palette[pixels[v*width+u]*3+channel];
 return Math.round((rgb(x0,y0)*(1-sx)+rgb(x1,y0)*sx)*(1-sy)+(rgb(x0,y1)*(1-sx)+rgb(x1,y1)*sx)*sy);
}
export function iconPng(size,{maskable=false}={}){
 if(![32,180,192,512].includes(size))throw Error('Invalid icon size');
 const inset=maskable?Math.round(size*.14):0,inner=size-2*inset;
 const stride=size*4+1,bitmap=Buffer.alloc(stride*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*stride+x*4+1;
  const outside=x<inset||y<inset||x>=size-inset||y>=size-inset;
  const u=(x-inset+.5)*width/inner-.5,v=(y-inset+.5)*width/inner-.5;
  for(let channel=0;channel<3;channel++)bitmap[i+channel]=outside?[14,20,33][channel]:sample(u,v,channel);
  bitmap[i+3]=255;
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(size);hdr.writeUInt32BE(size,4);hdr[8]=8;hdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',deflateSync(bitmap,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
export const ICON_SIZES=Object.freeze({
 '/icons/32.png':32,
 '/icons/180.png':180,
 '/icons/192.png':192,
 '/icons/512.png':512,
 '/icons/192-maskable.png':192,
 '/icons/512-maskable.png':512
});
export function iconForPath(path){
 const size=ICON_SIZES[path];
 return size?iconPng(size,{maskable:path.endsWith('-maskable.png')}):null;
}
