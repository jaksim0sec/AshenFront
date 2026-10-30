import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const ENTRY=['index.html','soldier-workshop.html','style.css','manifest.webmanifest'];
const EXT=/\.(mjs|js|css|html|json|png|svg|webp|b64)$/i;
export async function releaseAssets(root){
 const paths=ENTRY.map(p=>'/'+p);
 async function visit(folder){
  for(const entry of await readdir(resolve(root,folder),{withFileTypes:true})){
   const path=join(folder,entry.name).replaceAll('\\','/');
   if(entry.isDirectory())await visit(path);
   else if(entry.isFile()&&EXT.test(entry.name))paths.push('/'+path);
  }
 }
 await visit('src');await visit('assets');
 paths.push('/icons/192.png','/icons/512.png');
 return [...new Set(paths)].sort();
}
export async function pwaRelease(root){
 const assets=await releaseAssets(root),hash=createHash('sha256');
 for(const item of assets){
  if(item.startsWith('/icons/'))continue;
  hash.update(item);hash.update(await readFile(resolve(root,item.slice(1))));
 }
 for(const item of ['sw.js','tools/serve.mjs','tools/pwa-assets.mjs','tools/pwa-icon.mjs']){
  hash.update(item);hash.update(await readFile(resolve(root,item)));
 }
 return {version:hash.digest('hex').slice(0,20),assets};
}
