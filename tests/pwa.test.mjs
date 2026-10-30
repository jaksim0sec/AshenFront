import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script,createContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
import {releaseAssets,pwaRelease} from '../tools/pwa-assets.mjs';
import {iconPng} from '../tools/pwa-icon.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
test('offline files cover game engines, artwork and workshop',async()=>{
 const {assets,version}=await pwaRelease(root);
 assert.match(version,/^[0-9a-f]{20}$/);
 for(const path of ['/index.html','/soldier-workshop.html','/src/boot.mjs','/src/fw-entry.mjs','/src/main.mjs','/src/characters/workshop.mjs','/assets/soldiers/manifest.json','/assets/world/terrain/ashenfront-atlas.webp.b64','/assets/world/terrain/atlas.webp.b64','/assets/factions/arken/flag.webp','/icons/32.png','/icons/180.png','/icons/192.png','/icons/512.png','/icons/192-maskable.png','/icons/512-maskable.png']){
  assert.ok(assets.includes(path),'missing offline resource: '+path);
 }
 assert.equal(assets.length,new Set(assets).size);
 assert.deepEqual(assets,await releaseAssets(root));
 assert.ok(assets.every(p=>!p.startsWith('/tests/')&&!p.startsWith('/docs/')));
});
test('file contents determine release hash without manual version bumps',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ashen-pwa-'));
 try{
  for(const folder of ['src','assets','tools','assets/branding'])await mkdir(join(dir,folder));
  await writeFile(join(dir,'assets/branding/app-icon.br'),'dummy icon source');
  for(const f of ['index.html','soldier-workshop.html','style.css','manifest.webmanifest','sw.js'])await writeFile(join(dir,f),'x');
  for(const f of ['serve.mjs','pwa-assets.mjs','pwa-icon.mjs'])await writeFile(join(dir,'tools',f),'x');
  await writeFile(join(dir,'src/boot.mjs'),'v1');
  const before=await pwaRelease(dir);
  await writeFile(join(dir,'src/boot.mjs'),'v2');
  assert.notEqual(before.version,(await pwaRelease(dir)).version);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('install icons have correct PNG header and dimensions',()=>{
 for(const size of [32,180,192,512]){
  const png=iconPng(size);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),size);
  assert.equal(png.readUInt32BE(20),size);
 }
});
test('install manifest and maskable icons match PWA specification',async()=>{
 const manifest=JSON.parse(await readFile(join(root,'manifest.webmanifest'),'utf8'));
 assert.deepEqual(manifest.icons.map(icon=>[icon.sizes,icon.purpose]),[
  ['192x192','any'],['512x512','any'],['192x192','maskable'],['512x512','maskable']
 ]);
 for(const size of [192,512]){
  const masked=iconPng(size,{maskable:true});
  assert.equal(masked.readUInt32BE(16),size);
  assert.notDeepEqual(masked,iconPng(size),'maskable artwork needs safe-area padding');
 }
});
test('failed install preserves prior offline release and does not activate',async()=>{
 const source=(await readFile(join(root,'sw.js'),'utf8'))
  .replace('/*RELEASE*/',"const VERSION='new';const ASSETS=['/index.html','/src/boot.mjs'];");
 const listeners=new Map(),saved=new Map([['ashenfront-release-old',new Map([['/index.html',{ok:true}]])]]);
 let skips=0,claimed=0;
 const cacheApi={
  async open(key){
   if(!saved.has(key))saved.set(key,new Map());
   const store=saved.get(key);
   return {put:async(k,v)=>store.set(k,v),match:async k=>store.get(k)};
  },
  async keys(){return [...saved.keys()];},
  async delete(key){return saved.delete(key);}
 };
 const context=createContext({
  self:{location:{origin:'https://game.example'},addEventListener:(name,handler)=>listeners.set(name,handler),skipWaiting:()=>skips++,clients:{claim:async()=>claimed++}},
  caches:cacheApi,
  fetch:async()=>({ok:false}),
  URL,Set,Map,Promise,Array
 });
 new Script(source).runInContext(context);
 let installPromise;listeners.get('install')({waitUntil:p=>installPromise=p});
 await assert.rejects(installPromise,/Incomplete offline release/);
 assert.ok(saved.has('ashenfront-release-old'));
 assert.ok(!saved.has('ashenfront-release-new'));
 assert.equal(skips,0);assert.equal(claimed,0);
 listeners.get('message')({data:{type:'NOT_UPDATE'}});
 assert.equal(skips,0);
 listeners.get('message')({data:{type:'ACTIVATE_UPDATE'}});
 assert.equal(skips,1);
});
test('fully downloaded release serves offline entry and removes old cache on activation',async()=>{
 const source=(await readFile(join(root,'sw.js'),'utf8'))
  .replace('/*RELEASE*/',"const VERSION='new';const ASSETS=['/index.html','/src/boot.mjs'];");
 const listeners=new Map(),saved=new Map([['ashenfront-release-old',new Map()]]);
 let claims=0,network=0;
 const caches={
  async open(key){
   if(!saved.has(key))saved.set(key,new Map());
   const store=saved.get(key);
   return {put:async(k,v)=>store.set(k,v),match:async k=>store.get(k)};
  },
  async keys(){return [...saved.keys()];},
  async delete(key){return saved.delete(key);}
 };
 new Script(source).runInContext(createContext({
  self:{location:{origin:'https://game.example'},addEventListener:(name,fn)=>listeners.set(name,fn),skipWaiting:()=>{},clients:{claim:async()=>claims++}},
  caches,fetch:async url=>{network++;return {ok:true,url}},URL,Set,Map,Promise,Array
 }));
 let install;listeners.get('install')({waitUntil:p=>install=p});await install;
 assert.equal(saved.get('ashenfront-release-new').size,2);
 assert.ok(saved.has('ashenfront-release-old'),'old version remains until activation');
 let activation;listeners.get('activate')({waitUntil:p=>activation=p});await activation;
 assert.ok(!saved.has('ashenfront-release-old'));assert.equal(claims,1);
 let fetched;
 listeners.get('fetch')({request:{method:'GET',url:'https://game.example/?seed=42'},respondWith:p=>fetched=p});
 const response=await fetched;assert.equal(response.url,'/index.html');assert.equal(network,2);
});

test('Vercel static build produces installable worker and icon resources',async()=>{
 const build=spawnSync(process.execPath,['tools/build-pwa.mjs'],{cwd:root,encoding:'utf8',timeout:30000});
 assert.equal(build.status,0,build.stderr||build.stdout);
 const dist=join(root,'dist');
 try{
  const worker=await readFile(join(dist,'sw.js'),'utf8');
  assert.ok(!worker.includes('/*RELEASE*/'));
  assert.match(worker,/const VERSION="[0-9a-f]{20}";/);
  assert.match(worker,/const ASSETS=\[/);
  new Script(worker);
  assert.ok((await readFile(join(dist,'index.html'),'utf8')).includes('manifest.webmanifest'));
  assert.equal((await readFile(join(dist,'icons/192.png'))).readUInt32BE(16),192);
  assert.equal((await readFile(join(dist,'icons/512.png'))).readUInt32BE(16),512);
  assert.equal((await readFile(join(dist,'icons/192-maskable.png'))).readUInt32BE(16),192);
  assert.equal((await readFile(join(dist,'icons/512-maskable.png'))).readUInt32BE(16),512);
  assert.equal((await readFile(join(dist,'icons/180.png'))).readUInt32BE(16),180);
  assert.equal((await readFile(join(dist,'icons/32.png'))).readUInt32BE(16),32);
  assert.ok((await readFile(join(dist,'assets/world/terrain/ashenfront-atlas.webp.b64'))).length>1000);
 }finally{await rm(dist,{recursive:true,force:true});}
});
