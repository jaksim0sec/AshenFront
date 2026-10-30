import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pwaRelease} from './pwa-assets.mjs';
import {iconPng} from './pwa-icon.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||8000);
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const release=await pwaRelease(root);
const source=await readFile(resolve(root,'sw.js'),'utf8'),marker='/*RELEASE*/';
if(source.split(marker).length!==2)throw Error('PWA version marker missing');
const sw=source.replace(marker,'const VERSION='+JSON.stringify(release.version)+';const ASSETS='+JSON.stringify(release.assets)+';');
const icons=new Map(['/icons/192.png','/icons/512.png'].map((path,i)=>[path,iconPng(i?512:192)]));

http.createServer(async(req,res)=>{
 const send=(status,data,type,cache='no-cache')=>{
  res.writeHead(status,{'Content-Type':type,'Cache-Control':cache});
  res.end(req.method==='HEAD'?undefined:data);
 };
 try{
  const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
  if(!['GET','HEAD'].includes(req.method))return send(405,'Method not allowed','text/plain');
  if(pathname==='/sw.js')return send(200,sw,'text/javascript; charset=utf-8','no-store');
  if(url.searchParams.has('__pwa')&&url.searchParams.get('__pwa')!==release.version)
   return send(409,'Release mismatch','text/plain','no-store');
  if(icons.has(pathname))return send(200,icons.get(pathname),'image/png');
  if(pathname.split('/').some(p=>p.startsWith('.')))return send(403,'Forbidden','text/plain');
  const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(root))return send(403,'Forbidden','text/plain');
  return send(200,await readFile(path),types[extname(path)]||'application/octet-stream');
 }catch{return send(404,'Not found','text/plain');}
}).listen(port,'0.0.0.0',()=>console.log('AshenFront on '+port+' PWA '+release.version));
