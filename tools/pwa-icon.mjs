import {deflateSync} from 'node:zlib';
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
export function iconPng(size){
 if(![192,512].includes(size))throw Error('Invalid icon size');
 const stride=size*4+1,bitmap=Buffer.alloc(stride*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,d=Math.abs(u)*.85+Math.abs(v)*1.15;
  let rgb=[29,33,36];
  if(d<.53)rgb=[184,189,189];
  if(d<.45)rgb=[113,125,130];
  if(d<.38)rgb=[51,62,66];
  if(d<.35&&Math.abs(v+u*.4)<.052)rgb=[231,221,196];
  const i=y*stride+x*4+1;bitmap[i]=rgb[0];bitmap[i+1]=rgb[1];bitmap[i+2]=rgb[2];bitmap[i+3]=255;
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(size);hdr.writeUInt32BE(size,4);hdr[8]=8;hdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',deflateSync(bitmap,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
