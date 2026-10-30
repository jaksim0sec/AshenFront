/*RELEASE*/
const PREFIX='ashenfront-release-',NAME=PREFIX+VERSION;
const KNOWN=new Set(ASSETS);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(NAME);
  let cursor=0;
  async function download(){
   while(cursor<ASSETS.length){
    const path=ASSETS[cursor++];
    // The server rejects files from a different deployment with 409.
    const response=await fetch(path+'?__pwa='+VERSION,{cache:'reload'});
    if(!response.ok||response.type==='opaque')throw Error('Offline asset missing: '+path);
    await cache.put(path,response);
   }
  }
  const outcomes=await Promise.allSettled(Array.from({length:8},download));
  if(outcomes.some(x=>x.status==='rejected')){
   await caches.delete(NAME);
   throw Error('Incomplete offline release');
  }
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const name of await caches.keys())
   if(name.startsWith(PREFIX)&&name!==NAME)await caches.delete(name);
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 const path=url.pathname==='/'?'/index.html':url.pathname;
 if(!KNOWN.has(path))return;
 event.respondWith((async()=>{
  const cache=await caches.open(NAME);
  return await cache.match(path)||fetch(event.request);
 })());
});
