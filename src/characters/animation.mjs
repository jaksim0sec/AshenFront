/** Pure, view-only animation; no simulation imports, randomness or wall-clock reads. */
export const IDENTITY=[1,0,0,1,0,0];
export function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function transformPoint(m,x,y){return{x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};}
export const translate=(x,y)=>[1,0,0,1,x,y];
export const rotate=a=>[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];
const scale=(x,y)=>[x,0,0,y,0,0];
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
function smooth(x){x=clamp(x);return x*x*(3-2*x);}
function triangle(t,a,b,c){return t<a||t>c?0:t<b?smooth((t-a)/(b-a)):1-smooth((t-b)/(c-b));}
function matrix(p,x=p.x,y=p.y,angle=p.rotation){return multiply(translate(x,y),multiply(rotate(angle),multiply(scale(p.scaleX,p.scaleY),translate(-p.w*p.pivotX,-p.h*p.pivotY))));}
function fitWholeArm(p,uvA,uvB,a,b){
 const ax=uvA[0]*p.w,ay=uvA[1]*p.h,bx=uvB[0]*p.w,by=uvB[1]*p.h,fit=Math.hypot(b.x-a.x,b.y-a.y)/Math.max(.001,Math.hypot((bx-ax)*p.scaleX,(by-ay)*p.scaleY)),angle=Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2((by-ay)*p.scaleY,(bx-ax)*p.scaleX);
 return multiply(translate(a.x,a.y),multiply(rotate(angle),multiply(scale(fit*p.scaleX,fit*p.scaleY),translate(-ax,-ay))));
}
export function poseCharacter(profile,{state='idle',time=0,aim=0,facing=1,phase=0,moving=false}={}){
 const parts=profile.parts,t=state==='shoot'?((time%1.5)+1.5)%1.5:time,walk=state==='walk'||moving,wave=walk?Math.sin(time*10+phase):0,breath=Math.sin(time*2.6+phase),bob=walk?-Math.abs(wave)*3:breath*1.1;
 const recoil=state==='shoot'?triangle(t,0,.025,.16):0,bolt=state==='shoot'?triangle(t,.13,.3,.68):0,settle=state==='shoot'?triangle(t,.68,.85,1.2):0;
 const hit=state==='hit'?(1-smooth(time/.4))*Math.sin(time*30)*5:0,death=state==='death'?smooth((time-.1)/.65):0;
 const root=multiply(scale(facing<0?-1:1,1),multiply(translate(hit+death*20,death*6),rotate(death*1.35)));
 const upper=multiply(translate(-recoil*5,bob+recoil*1.2),rotate(walk?wave*.015:recoil*-.025));
 const head=multiply(upper,multiply(translate(0,parts.head.y+parts.head.h*.45),multiply(rotate(breath*.009+recoil*.035),translate(0,-parts.head.y-parts.head.h*.45))));
 const gun=parts.rifle,carry=state==='shoot'?clamp(aim,-.85,.85):-.9+(walk?wave*.025:0),gunAngle=gun.rotation+carry-recoil*.045+settle*.025;
 const gunMatrix=multiply(upper,matrix(gun,gun.x-recoil*4,gun.y+(state==='shoot'?0:walk?10:state==='idle'?8:0),gunAngle));
 // Trigger hand lifts, draws the bolt, returns to the grip; support hand stays fixed.
 const grips={left:[(gun.gripX??55/160)*gun.w-bolt*9/160*gun.w,(gun.gripY??23/40)*gun.h-bolt*17/40*gun.h],right:[(gun.supportX??105/160)*gun.w,(gun.supportY??19/40)*gun.h]},hands={left:transformPoint(gunMatrix,...grips.left),right:transformPoint(gunMatrix,...grips.right)},draws=[],attachments={};
 const add=(key,m,clip=null,suffix='')=>{const p=parts[key];if(p.visible)draws.push({key:key+suffix,part:key,asset:p.asset,matrix:multiply(root,m),w:p.w,h:p.h,clip});};
 const firing=state==='shoot';
 for(const side of ['left','right']){const key=side==='left'?'armLeft':'armRight',p=parts[key],shoulder=transformPoint(upper,p.x,p.y),grip=[p.gripX??(side==='left'?.25:.75),p.gripY??.83];
  const rest=multiply(upper,matrix(p,p.x,p.y,p.rotation+(walk?(side==='left'?-1:1)*wave*.10:0)));
  const arm=firing?fitWholeArm(p,[p.pivotX,p.pivotY],grip,shoulder,hands[side]):rest;
  attachments[side]={shoulder,hand:transformPoint(arm,grip[0]*p.w,grip[1]*p.h),matrix:arm};
 }
 for(const key of profile.layers){const p=parts[key];
  if(key==='rifle'){add(key,gunMatrix);continue;}
  if(key==='armLeft'||key==='armRight'){add(key,attachments[key==='armLeft'?'left':'right'].matrix);continue;}
  if(key.startsWith('sleeve')){const left=key==='sleeveLeft',arm=parts[left?'armLeft':'armRight'],base=attachments[left?'left':'right'].matrix;
   const sx=arm.w*.5+(p.x-(left?-49:49)),sy=arm.h*.52+(p.y+65);add(key,multiply(base,matrix(p,sx,sy,p.rotation)));continue;}
  if(key.startsWith('leg')){const stride=(key==='legLeft'?1:-1)*wave*.28;add(key,matrix(p,p.x,p.y+(walk?Math.max(0,-wave*(key==='legLeft'?1:-1))*5:0),p.rotation+stride));continue;}
  if(key==='head'||key==='hat'){add(key,multiply(head,matrix(p)));continue;}
  add(key,multiply(upper,matrix(p)));
 }
 // Each arm remains one complete original PNG. Layer the whole arm, never sliced limbs.
 if(firing){const i=draws.findIndex(d=>d.part==='armLeft');if(i>=0){const [arm]=draws.splice(i,1),weapon=draws.findIndex(d=>d.part==='rifle');draws.splice(weapon<0?draws.length:weapon,0,arm);}}
 else {const i=draws.findIndex(d=>d.part==='rifle');if(i>=0){const [weapon]=draws.splice(i,1),body=draws.findIndex(d=>d.part==='body');draws.splice(Math.max(0,body),0,weapon);}}
 const rifle={w:gun.w,h:gun.h,matrix:multiply(root,gunMatrix),grips,muzzle:transformPoint(multiply(root,gunMatrix),gun.w*155/160,gun.h*13/40)};
 return {draws,rifle,hands:Object.fromEntries(Object.entries(attachments).map(([k,p])=>[k,transformPoint(root,p.hand.x,p.hand.y)])),attachments,root,flash:state==='shoot'&&t<.065?1-t/.065:0,casing:state==='shoot'&&t>.15&&t<.55?(t-.15)/.4:null,alpha:state==='death'?1-smooth((time-.8)/.5):1};
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
 const basis={a:x.x-start.x,b:x.y-start.y,c:y.x-start.x,d:y.y-start.y};return Math.abs(basis.a*basis.d-basis.b*basis.c)>1e-8?basis:{a:options.facing<0?-1:1,b:0,c:0,d:1};
}
