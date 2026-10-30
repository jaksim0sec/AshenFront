/** Shared pointer gesture gate: camera gestures can never leak tactical commands. */
export function bindCamera(canvas,camera,{tap,changed,longPress,doubleTap}) {
 const pointers=new Map();let gesture=false,dragged=false,pinch=null,longTimer=null,longConsumed=false,lastTap=null;
 const pos=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
 const stopLong=()=>{clearTimeout(longTimer);longTimer=null;};
 const pinchState=()=>{const[a,b]=[...pointers.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)};};
 function zoom(value,x=canvas.clientWidth/2,y=canvas.clientHeight/2){const z=Math.max(.3,Math.min(1.6,value)),ratio=z/camera.zoom;camera.x=x-(x-camera.x)*ratio;camera.y=y-(y-camera.y)*ratio;camera.zoom=z;changed();}
 canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pos(e);zoom(camera.zoom*Math.exp(-e.deltaY*.001),p.x,p.y);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);const p=pos(e);pointers.set(e.pointerId,{...p,sx:p.x,sy:p.y});stopLong();if(pointers.size===1){gesture=false;dragged=false;longConsumed=false;if(longPress)longTimer=setTimeout(()=>{if(pointers.size===1&&!dragged&&!gesture){longConsumed=true;lastTap=null;longPress(p.x,p.y);}},450);}if(pointers.size>=2){gesture=true;pinch=pinchState();lastTap=null;}});
 canvas.addEventListener('pointermove',e=>{
  const old=pointers.get(e.pointerId);if(!old)return;const p=pos(e),dx=p.x-old.x,dy=p.y-old.y;Object.assign(old,p);
  if(pointers.size>=2){stopLong();const next=pinchState();if(pinch&&pinch.d>0){const z=Math.max(.3,Math.min(1.6,camera.zoom*next.d/pinch.d)),ratio=z/camera.zoom;camera.x=next.x-(pinch.x-camera.x)*ratio;camera.y=next.y-(pinch.y-camera.y)*ratio;camera.zoom=z;changed();}pinch=next;}
  else if(!gesture&&!longConsumed&&(dragged||Math.hypot(p.x-old.sx,p.y-old.sy)>6)){stopLong();dragged=true;lastTap=null;camera.x+=dx;camera.y+=dy;changed();}
 });
 function release(e,cancelled=false){stopLong();const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(!cancelled&&!gesture&&!dragged&&!longConsumed&&Math.hypot(p.x-p.sx,p.y-p.sy)<6){const now=performance.now(),double=lastTap&&now-lastTap.time<300&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<24;if(double&&doubleTap?.(p.x,p.y)){lastTap=null;}else{tap(p.x,p.y,{shiftKey:e.shiftKey});lastTap={...p,time:now};}}if(!pointers.size){gesture=false;pinch=null;}else if(pointers.size<2)pinch=null;}
 canvas.addEventListener('pointerup',e=>release(e));canvas.addEventListener('pointercancel',e=>release(e,true));
 return {zoom};
}
