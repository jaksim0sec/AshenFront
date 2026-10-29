export function bindCamera(canvas,camera,{tap,changed}) {
 const pointers=new Map();let gesture=false,dragged=false,pinch=null;
 const pos=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
 function zoom(value,x=canvas.clientWidth/2,y=canvas.clientHeight/2){const z=Math.max(.3,Math.min(1.6,value)),ratio=z/camera.zoom;camera.x=x-(x-camera.x)*ratio;camera.y=y-(y-camera.y)*ratio;camera.zoom=z;changed();}
 canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pos(e);zoom(camera.zoom*Math.exp(-e.deltaY*.001),p.x,p.y);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);const p=pos(e);pointers.set(e.pointerId,{...p,sx:p.x,sy:p.y});if(pointers.size===1){gesture=false;dragged=false;}if(pointers.size>=2){gesture=true;pinch=null;}});
 canvas.addEventListener('pointermove',e=>{
  const old=pointers.get(e.pointerId);if(!old)return;const p=pos(e),dx=p.x-old.x,dy=p.y-old.y;Object.assign(old,p);
  if(pointers.size>=2){const [a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch&&pinch.d>0){const z=Math.max(.3,Math.min(1.6,camera.zoom*d/pinch.d)),ratio=z/camera.zoom;camera.x=mid.x-(pinch.x-camera.x)*ratio;camera.y=mid.y-(pinch.y-camera.y)*ratio;camera.zoom=z;changed();}pinch={...mid,d};}
  else if(!gesture&&(dragged||Math.hypot(p.x-old.sx,p.y-old.sy)>6)){dragged=true;camera.x+=dx;camera.y+=dy;changed();}
 });
 function release(e,cancelled=false){const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(!cancelled&&!gesture&&!dragged&&Math.hypot(p.x-p.sx,p.y-p.sy)<6)tap(p.x,p.y);if(!pointers.size){gesture=false;pinch=null;}}
 canvas.addEventListener('pointerup',e=>release(e));canvas.addEventListener('pointercancel',e=>release(e,true));
 return {zoom};
}
