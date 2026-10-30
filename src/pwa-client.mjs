// Install current release for offline use; never force a running match to reload.
if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
 const controlledAtLoad=!!navigator.serviceWorker.controller;
 let accept=false,panel=null;
 function offer(reg,activated=false){
  if(!navigator.serviceWorker.controller&&!activated)return;
  if(panel)panel.remove();
  panel=document.createElement('aside');panel.setAttribute('role','status');
  Object.assign(panel.style,{position:'fixed',zIndex:'1000',bottom:'12px',right:'12px',maxWidth:'min(360px, calc(100vw - 24px))',display:'flex',gap:'10px',alignItems:'center',padding:'12px',background:'#22292dee',color:'#ecf0f1',border:'1px solid #7d888d',borderRadius:'10px',font:'12px/1.5 system-ui,sans-serif'});
  const message=document.createElement('span');
  message.textContent=activated?'새 버전이 적용됐습니다. 다시 시작하면 최신 게임을 사용할 수 있습니다.':'새 버전이 준비됐습니다. 현재 전투를 마친 뒤 적용할 수 있습니다.';
  const button=document.createElement('button');button.type='button';button.textContent='업데이트 적용';
  Object.assign(button.style,{border:'0',borderRadius:'7px',padding:'9px',color:'#192126',background:'#d7dada',font:'bold 12px system-ui',cursor:'pointer'});
  button.onclick=()=>{
   accept=true;
   if(activated||!reg.waiting){location.reload();return;}
   button.disabled=true;reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  };
  panel.append(message,button);document.body.append(panel);
 }
 navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>{
  const notify=()=>{if(reg.waiting&&navigator.serviceWorker.controller&&!accept)offer(reg);};
  reg.addEventListener('updatefound',()=>{
   const w=reg.installing;if(w)w.addEventListener('statechange',notify);
  });
  notify();
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   if(accept){location.reload();return;}
   if(controlledAtLoad)offer(reg,true);
  });
  const update=()=>{if(navigator.onLine)reg.update().catch(()=>{});};
  window.addEventListener('online',update);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  setInterval(()=>{if(!document.hidden)update();},5*60*1000);
 }).catch(error=>console.warn('PWA unavailable:',error));
}
