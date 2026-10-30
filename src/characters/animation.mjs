import {CONTACT_HULLS} from './contact-hulls.mjs';
/** Pure, view-only animation; no simulation imports, randomness or wall-clock reads. */
export const DEATH_DURATION=1.7;
export const IDENTITY=[1,0,0,1,0,0];
export function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function transformPoint(m,x,y){return{x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};}
function inverse(m){const det=m[0]*m[3]-m[1]*m[2];return[m[3]/det,-m[1]/det,-m[2]/det,m[0]/det,(m[2]*m[5]-m[3]*m[4])/det,(m[1]*m[4]-m[0]*m[5])/det];}
export const translate=(x,y)=>[1,0,0,1,x,y];
export const rotate=a=>[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];
const scale=(x,y)=>[x,0,0,y,0,0];
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
function smooth(x){x=clamp(x);return x*x*(3-2*x);}
function triangle(t,a,b,c){return t<a||t>c?0:t<b?smooth((t-a)/(b-a)):1-smooth((t-b)/(c-b));}
function matrix(p,x=p.x,y=p.y,angle=p.rotation){return multiply(translate(x,y),multiply(rotate(angle),multiply(scale(p.scaleX,p.scaleY),translate(-p.w*p.pivotX,-p.h*p.pivotY))));}
function palm(p){return[(p.gripX??.5)*p.w,(p.gripY??.83)*p.h];}
function rigidArm(p,target){
 const[x,y]=palm(p),dx=(x-p.pivotX*p.w)*p.scaleX,dy=(y-p.pivotY*p.h)*p.scaleY,angle=Math.atan2(target.y-p.y,target.x-p.x)-Math.atan2(dy,dx);
 // Anchor the palm, rotate the complete PNG and retain its authored scale exactly.
 // Shoulder placement accommodates the reach; raster dimensions never change.
 return multiply(translate(target.x,target.y),multiply(rotate(angle),multiply(scale(p.scaleX,p.scaleY),translate(-x,-y))));
}
function weaponMatrix(p,x,y,angle){
 // The supplied character art faces left; the SVG rifle points right.
 return multiply(translate(x,y),multiply(rotate(angle),multiply(scale(-p.scaleX,p.scaleY),translate(-p.w*p.pivotX,-p.h*p.pivotY))));
}
export function poseCharacter(profile,{state='idle',time=0,aim=0,target=null,facing=1,phase=0,moving=false}={}){
 const parts=profile.parts,t=state==='shoot'?((time%1.5)+1.5)%1.5:time,walk=state==='walk'||(moving&&state!=='death'),wave=walk?Math.sin(time*10+phase):0,breath=state==='death'?0:Math.sin(time*2.6+phase),bob=walk?-Math.abs(wave)*3:breath*1.1;
 const recoil=state==='shoot'?triangle(t,0,.025,.16):0,bolt=state==='shoot'?triangle(t,.13,.3,.68):0,settle=state==='shoot'?triangle(t,.68,.85,1.2):0;
 const hit=state==='hit'?(1-smooth(time/.4))*Math.sin(time*30)*5:0,death=state==='death'?clamp((time-.14)/.62):0;
 // facing +1 means screen-right; native portraits face screen-left.
 // A single connected silhouette loses balance, falls, hits the ground and settles.
 const impact=Math.max(0,time-.76),fallAngle=state==='death'?-Math.sin(clamp(time/.24)*Math.PI)*.12+death*death*1.48-(impact>0?Math.sin(impact*19)*Math.exp(-impact*12)*.045:0):0;
 let root=multiply(scale(facing<0?1:-1,1),multiply(translate(hit+death*death*24,death*8),rotate(fallAngle)));
 const upperAngle=walk?wave*.015:recoil*.025,upper=multiply(translate(recoil*5,bob+recoil*1.2),rotate(upperAngle));
 const head=multiply(upper,multiply(translate(parts.head.x,parts.head.y),multiply(rotate(breath*.009+recoil*.035),translate(-parts.head.x,-parts.head.y))));
 const gun=parts.rifle,carry=state==='shoot'?aim:-.9+(walk?wave*.025:0),desiredAngle=gun.rotation+carry-recoil*.045+settle*.025;
 let gunAngle=-(state==='shoot'?clamp(desiredAngle,-Math.PI/2,Math.PI/2):desiredAngle)-upperAngle;
 // In the native left-facing portrait, the left arm supports the fore-end;
 // the right arm operates the trigger and bolt near the stock.
 const grips={left:[(gun.supportX??105/160)*gun.w,(gun.supportY??19/40)*gun.h],right:[(gun.gripX??55/160)*gun.w-bolt*9/160*gun.w,(gun.gripY??23/40)*gun.h-bolt*17/40*gun.h]};
 // Keep the edited firing position fixed: no circle-branch flips or aim-dependent gun jumps.
 const position={x:gun.x+recoil*4,y:gun.y+(state==='shoot'?0:walk?10:state==='idle'?8:0)};
 if(state==='shoot'&&target&&Number.isFinite(target.x)&&Number.isFinite(target.y)){
  const local=transformPoint(inverse(multiply(root,upper)),target.x,target.y),dx=local.x-position.x,dy=local.y-position.y,distance=Math.hypot(dx,dy);
  // Aim the actual barrel ray, including its offset from the editable rifle pivot.
  const bore=(13/40-gun.pivotY)*gun.h*gun.scaleY;
  if(distance>Math.abs(bore)+1e-6)gunAngle=Math.atan2(dy,dx)-Math.PI+Math.asin(bore/distance);
 }
 const gunLocal=weaponMatrix(gun,position.x,position.y,gunAngle),gunMatrix=multiply(upper,gunLocal);
 const localHands={left:transformPoint(gunLocal,...grips.left),right:transformPoint(gunLocal,...grips.right)},draws=[],attachments={};
 const add=(key,m,clip=null,suffix='')=>{const p=parts[key];if(p.visible)draws.push({key:key+suffix,part:key,asset:p.asset,matrix:multiply(root,m),w:p.w,h:p.h,clip});};
 const firing=state==='shoot';
 for(const side of ['left','right']){const key=side==='left'?'armLeft':'armRight',p=parts[key];
  const rest=multiply(upper,matrix(p,p.x,p.y,p.rotation+(walk?(side==='left'?-1:1)*wave*.10:0)));
  const arm=firing?multiply(upper,rigidArm(p,localHands[side])):rest;
  attachments[side]={shoulder:transformPoint(arm,p.pivotX*p.w,p.pivotY*p.h),hand:transformPoint(arm,...palm(p)),matrix:arm};
 }
 for(const key of profile.layers){const p=parts[key];
  if(key==='rifle'){add(key,gunMatrix);continue;}
  if(key==='armLeft'||key==='armRight'){add(key,attachments[key==='armLeft'?'left':'right'].matrix);continue;}
  if(key.startsWith('sleeve')){const left=key==='sleeveLeft',arm=parts[left?'armLeft':'armRight'],base=attachments[left?'left':'right'].matrix;
   // Keep the archive's canvas placement at rest; inherit only the animated arm delta.
   const local=multiply(inverse(matrix(arm)),matrix(p));add(key,multiply(base,local));continue;}
  if(key.startsWith('leg')){const stride=(key==='legLeft'?1:-1)*wave*.28;add(key,matrix(p,p.x,p.y+(walk?Math.max(0,-wave*(key==='legLeft'?1:-1))*5:0),p.rotation+stride));continue;}
  if(key==='head'||key==='hat'){add(key,multiply(head,matrix(p)));continue;}
  add(key,multiply(upper,matrix(p)));
 }
 // Draw exactly the configured layer order in every animation state.
 if(state==='death'){const shift=translate(0,deathGroundOffset(draws,parts));for(const d of draws)d.matrix=multiply(shift,d.matrix);root=multiply(shift,root);}
 const worldGun=state==='death'?(draws.find(d=>d.part==='rifle')?.matrix??multiply(root,gunMatrix)):multiply(root,gunMatrix),axis=Math.hypot(worldGun[0],worldGun[1]),rifle={w:gun.w,h:gun.h,matrix:worldGun,grips,muzzle:transformPoint(worldGun,gun.w*155/160,gun.h*13/40),direction:{x:worldGun[0]/axis,y:worldGun[1]/axis}};
 return {draws,rifle,hands:Object.fromEntries(Object.entries(attachments).map(([k,p])=>[k,transformPoint(root,p.hand.x,p.hand.y)])),attachments,root,flash:state==='shoot'&&t<.065?1-t/.065:0,casing:state==='shoot'&&t>.15&&t<.55?(t-.15)/.4:null,alpha:state==='death'?clamp((DEATH_DURATION-time)/.35):1};
}
/** Actual opaque body pixels, not padded rectangles or a protruding rifle, touch the ground. */
export function bodyContactBottom(draws){
 let bottom=-Infinity;
 for(const d of draws){if(!['legLeft','legRight','body','armLeft','armRight','head','hat'].includes(d.part))continue;
  for(const[u,v]of CONTACT_HULLS[d.asset]??[[0,0],[1,0],[0,1],[1,1]])bottom=Math.max(bottom,transformPoint(d.matrix,u*d.w,v*d.h).y);
 }return bottom;
}
function deathGroundOffset(draws,parts){
 const feet=['legLeft','legRight'].filter(k=>parts[k].visible).map(k=>({part:k,asset:parts[k].asset,w:parts[k].w,h:parts[k].h,matrix:matrix(parts[k])}));
 const plane=bodyContactBottom(feet),bottom=bodyContactBottom(draws);
 // Preserve the standing soles' plane throughout the fall, including initial loss of balance.
 return Number.isFinite(bottom)&&Number.isFinite(plane)?plane-bottom:0;
}
export function poseBounds(pose,padding=8){
 const points=[{x:0,y:0}];for(const d of pose.draws){let x0=0,y0=0,x1=d.w,y1=d.h;if(Array.isArray(d.clip)){const[x,y,w,h]=d.clip;x0=x*d.w;y0=y*d.h;x1=(x+w)*d.w;y1=(y+h)*d.h;}else if(d.clip?.capsule){const[ax,ay,bx,by,r]=d.clip.capsule;x0=Math.max(0,Math.min(ax,bx)-r);y0=Math.max(0,Math.min(ay,by)-r);x1=Math.min(d.w,Math.max(ax,bx)+r);y1=Math.min(d.h,Math.max(ay,by)+r);}for(const[x,y]of[[x0,y0],[x1,y0],[x1,y1],[x0,y1]])points.push(transformPoint(d.matrix,x,y));}
 if(pose.flash>0)for(const [x,y] of [[154,7],[180,7],[180,24],[154,24]])points.push(transformPoint(pose.rifle.matrix,x/160*pose.rifle.w,y/40*pose.rifle.h));
 if(pose.casing!==null){const p=pose.casing,anchor=transformPoint(pose.rifle.matrix,pose.rifle.w*65/160,pose.rifle.h*10/40);for(const x of [-5,5])for(const y of [-5,5])points.push({x:anchor.x-p*30+x,y:anchor.y-Math.sin(p*Math.PI)*30+p*p*12+y});}
 const left=Math.floor(Math.min(...points.map(p=>p.x))-padding),top=Math.floor(Math.min(...points.map(p=>p.y))-padding),right=Math.ceil(Math.max(...points.map(p=>p.x))+padding),bottom=Math.ceil(Math.max(...points.map(p=>p.y))+padding);
 return {left,top,right,bottom,width:right-left,height:bottom-top};
}
/** Derivative of an editable part's position through its animated parent, including mirrors. */
export function partPositionBasis(profile,key,options={}){
 const anchor=p=>{const pose=poseCharacter(p,options),d=pose.draws.find(d=>d.part===key);if(!d)return {x:0,y:0};const part=p.parts[key];return transformPoint(d.matrix,part.pivotX*part.w,part.pivotY*part.h);};
 const start=anchor(profile),px=structuredClone(profile),py=structuredClone(profile);px.parts[key].x++;py.parts[key].y++;const x=anchor(px),y=anchor(py);
 const basis={a:x.x-start.x,b:x.y-start.y,c:y.x-start.x,d:y.y-start.y};return Math.abs(basis.a*basis.d-basis.b*basis.c)>1e-8?basis:{a:options.facing<0?1:-1,b:0,c:0,d:1};
}
