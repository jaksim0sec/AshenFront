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
const lerp=(a,b,t)=>a+(b-a)*t;
function mixRigid(a,b,t){
 if(t<=0)return a;if(t>=1)return b;
 const angleA=Math.atan2(a[1],a[0]),angleB=Math.atan2(b[1],b[0]);
 const angle=angleA+Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA))*t;
 const sx=lerp(Math.hypot(a[0],a[1]),Math.hypot(b[0],b[1]),t);
 const sy=lerp(Math.hypot(a[2],a[3]),Math.hypot(b[2],b[3]),t);
 const handedness=Math.sign(a[0]*a[3]-a[1]*a[2])||1;
 return [sx*Math.cos(angle),sx*Math.sin(angle),-handedness*sy*Math.sin(angle),handedness*sy*Math.cos(angle),lerp(a[4],b[4],t),lerp(a[5],b[5],t)];
}
function smooth(x){x=clamp(x);return x*x*(3-2*x);}
/** Pure, intermittent left/right glance. Different soldiers look at different times. */
export function lookAround(time,id=0){
 const cycle=((time+((Math.imul(id|0,1103515245)>>>0)%780)/100)%8.6+8.6)%8.6;
 if(cycle<1.1)return 0;
 if(cycle<1.85)return -smooth((cycle-1.1)/.75);
 if(cycle<3)return -1;
 if(cycle<3.75)return -1+smooth((cycle-3)/.75);
 if(cycle<4.3)return 0;
 if(cycle<5.05)return smooth((cycle-4.3)/.75);
 if(cycle<6.1)return 1;
 if(cycle<6.95)return 1-smooth((cycle-6.1)/.85);
 return 0;
}
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
export function poseCharacter(profile,{state='idle',time=0,gaitTime,aim=0,target=null,facing=1,phase=0,moving=false,walkBlend=(state==='walk'||moving)?1:0,shootBlend=state==='shoot'?1:0,crouchBlend=0,climbBlend=0,riseProgress=null,lookBlend=0,hitReaction=0,fireAt=0}={}){
 shootBlend=clamp(shootBlend);
 walkBlend=clamp(walkBlend);
 crouchBlend=clamp(crouchBlend);
 const climb=clamp(climbBlend,-1,1);
 const rising=state==='walk'&&riseProgress!==null&&Number.isFinite(riseProgress);
 const r=rising?clamp(riseProgress):0,climbStrength=rising?0:Math.abs(climb);
 const riseBrace=rising?triangle(r,0,.22,.54):0;
 const riseHaul=rising?triangle(r,.17,.54,.93):0;
 const leadStep=rising?triangle(r,.02,.3,.64):0;
 const followStep=rising?triangle(r,.34,.69,1):0;
 const look=(state==='idle'||state==='guard')&&!moving?clamp(lookBlend,-1,1):0;
 const guarding=state==='guard';
 const parts=profile.parts,t=state==='shoot'?Math.max(0,time-fireAt):time,walk=walkBlend>.001,wave=Math.sin((gaitTime??time)*10+phase)*walkBlend,breath=state==='death'?0:Math.sin(time*(guarding?3.1:2.6)+phase),weight=guarding?Math.sin(time*.9+phase)*.7:0,bob=-Math.abs(wave)*3+(1-walkBlend)*(breath*(guarding?.65:1.1)+weight);
 const recoil=state==='shoot'?triangle(t,0,.025,.16):0,bolt=state==='shoot'?triangle(t,.13,.3,.68):0,settle=state==='shoot'?triangle(t,.68,.85,1.2):0;
 const dying=state==='death',impactKick=dying?triangle(time,0,.065,.24):0,buckle=dying?triangle(time,.12,.36,.82):0,slump=dying?smooth((time-.18)/.55):0;
 const hit=(state==='hit'?(1-smooth(time/.4)):clamp(hitReaction)) * Math.sin(time*30)*5,death=state==='death'?clamp((time-.14)/.62):0;
 // facing +1 means screen-right; native portraits face screen-left.
 // A single connected silhouette loses balance, falls, hits the ground and settles.
 const impact=Math.max(0,time-.76),fallAngle=state==='death'?impactKick*.08+smooth(death)*1.48-(impact>0?Math.sin(impact*19)*Math.exp(-impact*12)*.045:0):0;
 let root=multiply(scale(facing<0?1:-1,1),multiply(translate(hit+impactKick*10+smooth(death)*24,0),rotate(fallAngle)));
 const upperAngle=dying?impactKick*.12+buckle*.18:wave*.015+(1-walkBlend)*(guarding?Math.sin(time*1.4+phase)*.009:recoil*.025);
 // Native sprites use one-piece boots and arms. Crouch around the hips rather
 // than shearing the PNGs; the legs swivel at their authored hip pivots.
 const hipX=(parts.legLeft.x+parts.legRight.x)*.5;
 const hipY=(parts.legLeft.y+parts.legRight.y)*.5;
 const hipLean=multiply(translate(0,6*crouchBlend),
  multiply(translate(hipX,hipY),multiply(rotate(-.18*crouchBlend),translate(-hipX,-hipY))));
 const upper=dying?multiply(translate(parts.body.x,parts.body.y),multiply(rotate(upperAngle),translate(-parts.body.x,-parts.body.y)))
  :multiply(hipLean,multiply(translate(recoil*5,bob+recoil*1.2-climbStrength*7+riseBrace*5-riseHaul*11),
   rotate(upperAngle+climb*.045-riseBrace*.09+riseHaul*.045)));
 // One rigid head+hat group hints at a sideways survey without 3D yaw assets.
 const head=multiply(upper,multiply(translate(look*8,-Math.abs(look)*2),
  multiply(translate(parts.head.x,parts.head.y),
   multiply(rotate(breath*.009+recoil*.035+crouchBlend*.09+(guarding?Math.sin(time*.8+phase)*.012:0)+(dying?-impactKick*.2+buckle*.13:0)+look*.115),
    translate(-parts.head.x,-parts.head.y)))));
 const gun=parts.rifle,restCarry=dying?aim+(1.1-aim)*slump:-.9+wave*.025,readyAim=aim+(guarding?Math.sin(time*1.9+phase)*.013:0),carry=lerp(restCarry,readyAim,shootBlend),desiredAngle=gun.rotation+carry-recoil*.045+settle*.025;
 let gunAngle=-lerp(desiredAngle,clamp(desiredAngle,-Math.PI/2,Math.PI/2),shootBlend)-upperAngle;
 // In the native left-facing portrait, the left arm supports the fore-end;
 // the right arm operates the trigger and bolt near the stock.
 const grips={left:[(gun.supportX??105/160)*gun.w,(gun.supportY??19/40)*gun.h],right:[(gun.gripX??55/160)*gun.w-bolt*9/160*gun.w,(gun.gripY??23/40)*gun.h-bolt*17/40*gun.h]};
 // Keep the edited firing position fixed: no circle-branch flips or aim-dependent gun jumps.
 const position={x:gun.x+recoil*4+(dying?slump*8:0),y:gun.y+(dying?slump*16:0)+lerp(8+2*walkBlend,0,shootBlend)};
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
  const rest=multiply(upper,matrix(p,p.x,p.y,p.rotation+(side==='left'?-1:1)*wave*.10));
  const gripped=multiply(upper,rigidArm(p,localHands[side]));
  let arm=shootBlend>=1?gripped:shootBlend<=0?rest:mixRigid(rest,gripped,shootBlend);
  if(dying){const from=rigidArm(p,localHands[side]),start=transformPoint(from,p.pivotX*p.w,p.pivotY*p.h),release=smooth(time/.2),a=Math.atan2(from[1],from[0]),flail=side==='left'?impactKick*.65+buckle*.9+slump*.35:-impactKick*.45-buckle*.65-slump*.25,desired=p.rotation+flail,delta=Math.atan2(Math.sin(desired-a),Math.cos(desired-a));arm=multiply(upper,matrix(p,start.x+(p.x-start.x)*release,start.y+(p.y-start.y)*release,a+delta*release));}
  attachments[side]={shoulder:transformPoint(arm,p.pivotX*p.w,p.pivotY*p.h),hand:transformPoint(arm,...palm(p)),matrix:arm};
 }
 for(const key of profile.layers){const p=parts[key];
  if(key==='rifle'){add(key,gunMatrix);continue;}
  if(key==='armLeft'||key==='armRight'){add(key,attachments[key==='armLeft'?'left':'right'].matrix);continue;}
  if(key.startsWith('sleeve')){const left=key==='sleeveLeft',arm=parts[left?'armLeft':'armRight'],base=attachments[left?'left':'right'].matrix;
   // Keep the archive's canvas placement at rest; inherit only the animated arm delta.
   const local=multiply(inverse(matrix(arm)),matrix(p));add(key,multiply(base,local));continue;}
  if(key.startsWith('leg')){
   const stride=dying?(key==='legLeft'?-.35:.45)*smooth((time-.12)/.35):(key==='legLeft'?1:-1)*wave*.28;
   // A wider, slightly flexed stance, preserving each boot's unscaled artwork.
   const brace=(key==='legLeft'?1:-1)*crouchBlend*.21;
   // Lift and brace actual limb sprites on slopes. No new images or scaling.
   // Ascent: plant the lead boot, haul the torso, then lift the trailing boot.
   // Descents retain the old lightweight slope pose.
   const lift=rising?(key==='legLeft'?-47*leadStep:-33*followStep):
    climb>=0?(key==='legLeft'?-42:-16)*climb:(key==='legRight'?42:16)*climb;
   const slopeAngle=rising?(key==='legLeft'?-.23*leadStep:.17*followStep):climb*(key==='legLeft'?-.22:.16);
   add(key,matrix(p,p.x,p.y+Math.max(0,-wave*(key==='legLeft'?1:-1))*5+lift,
    p.rotation+stride+brace+slopeAngle));
   continue;
  }
  if(key==='head'||key==='hat'){add(key,multiply(head,matrix(p)));continue;}
  add(key,multiply(upper,matrix(p)));
 }
 // Draw exactly the configured layer order in every animation state.
 if(state==='death'){const shift=translate(0,deathGroundOffset(draws,time));for(const d of draws)d.matrix=multiply(shift,d.matrix);root=multiply(shift,root);settleBodyParts(draws,parts);}
 const worldGun=state==='death'?(draws.find(d=>d.part==='rifle')?.matrix??multiply(root,gunMatrix)):multiply(root,gunMatrix),axis=Math.hypot(worldGun[0],worldGun[1]),rifle={w:gun.w,h:gun.h,matrix:worldGun,grips,muzzle:transformPoint(worldGun,gun.w*155/160,gun.h*13/40),direction:{x:worldGun[0]/axis,y:worldGun[1]/axis}};
 return {draws,rifle,hands:Object.fromEntries(Object.entries(attachments).map(([k,p])=>[k,transformPoint(root,p.hand.x,p.hand.y)])),attachments,root,flash:state==='shoot'&&time>=fireAt&&t<.065?1-t/.065:0,casing:state==='shoot'&&t>.15&&t<.55?(t-.15)/.4:null,alpha:state==='death'?clamp((DEATH_DURATION-time)/.35):1};
}
/** Actual opaque body pixels, not padded rectangles or a protruding rifle, touch the ground. */
export function bodyContactBottom(draws){
 let bottom=-Infinity;
 for(const d of draws){if(!['legLeft','legRight','body','armLeft','armRight','head','hat'].includes(d.part))continue;
  for(const[u,v]of CONTACT_HULLS[d.asset]??[[0,0],[1,0],[0,1],[1,1]])bottom=Math.max(bottom,transformPoint(d.matrix,u*d.w,v*d.h).y);
 }return bottom;
}
function deathGroundOffset(draws,time){
 const lowest=bodyContactBottom(draws),torso=bodyContactBottom(draws.filter(d=>d.part==='body')),weight=smooth((time-.24)/.42);
 // The torso must come to rest on the terrain, not be propped up by a straight arm or leg.
 return Number.isFinite(lowest)?-(lowest+(Number.isFinite(torso)?torso-lowest:0)*weight):0;
}
function settleBodyParts(draws,parts){
 for(const [key,members]of [['legLeft',['legLeft']],['legRight',['legRight']],['armLeft',['armLeft','sleeveLeft']],['armRight',['armRight','sleeveRight']],['head',['head','hat']]]){
  const base=draws.find(d=>d.part===key);if(!base)continue;const part=parts[key],pivot=transformPoint(base.matrix,base.w*part.pivotX,base.h*part.pivotY),group=draws.filter(d=>members.includes(d.part)),points=[];
  for(const d of group)for(const[u,v]of CONTACT_HULLS[d.asset]??[]){const p=transformPoint(d.matrix,u*d.w,v*d.h);points.push({x:p.x-pivot.x,y:p.y-pivot.y});}
  const fits=angle=>{const s=Math.sin(angle),c=Math.cos(angle);return points.every(p=>pivot.y+s*p.x+c*p.y<=1e-7);};if(fits(0))continue;
  const norm=a=>Math.atan2(Math.sin(a),Math.cos(a)),angles=[];
  // Nearest feasible rigid rotation about the existing anatomical anchor.
  for(const p of points){const r=Math.hypot(p.x,p.y),k=-pivot.y/r;if(!r||Math.abs(k)>1)continue;const phi=Math.atan2(p.y,p.x),a=Math.asin(k);for(const v of [a-phi,Math.PI-a-phi])for(const eps of [-1e-8,0,1e-8])angles.push(norm(v+eps));}
  angles.sort((a,b)=>Math.abs(a)-Math.abs(b));const angle=angles.find(fits);if(angle===undefined)continue;
  const turn=multiply(translate(pivot.x,pivot.y),multiply(rotate(angle),translate(-pivot.x,-pivot.y)));for(const d of group)d.matrix=multiply(turn,d.matrix);
 }
}
export function contactShadow(pose){
 let left=Infinity,right=-Infinity;
 for(const d of pose.draws){if(!['legLeft','legRight','body','armLeft','armRight','head','hat'].includes(d.part))continue;
  for(const[u,v]of CONTACT_HULLS[d.asset]??[]){const p=transformPoint(d.matrix,u*d.w,v*d.h);if(p.y>=-24){left=Math.min(left,p.x);right=Math.max(right,p.x);}}
 }
 return Number.isFinite(left)?{x:(left+right)/2,radius:Math.max(40,(right-left)/2)}:{x:0,radius:40};
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
