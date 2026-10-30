import {mkdir,rm,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pwaRelease} from './pwa-assets.mjs';
import {iconForPath} from './pwa-icon.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'dist');
const release=await pwaRelease(root);
await rm(output,{force:true,recursive:true});
await mkdir(output,{recursive:true});
for(const url of release.assets){
 const target=resolve(output,url.slice(1));
 await mkdir(dirname(target),{recursive:true});
 const icon=iconForPath(url);
 if(icon)await writeFile(target,icon);
 else await copyFile(resolve(root,url.slice(1)),target);
}
const template=await readFile(resolve(root,'sw.js'),'utf8');
if(template.split('/*RELEASE*/').length!==2)throw Error('PWA template marker missing');
const worker=template.replace('/*RELEASE*/','const VERSION='+JSON.stringify(release.version)+';const ASSETS='+JSON.stringify(release.assets)+';');
await writeFile(resolve(output,'sw.js'),worker);
console.log('PWA static build: '+release.version+' ('+release.assets.length+' files)');
