import {createAshenMatch,autoDeployPlayer,ASHEN_ARMY_CHOICES} from './fw/ashen-setup.mjs';
import {project,unproject} from './fw/model.mjs';
import {terrainOccluders,projectElevatedFoot,compareProjectedUnits,terrainTransitionPose,terrainRiseProgress,clipSoldierAgainstTerrain} from './fw/terrain-occlusion.mjs';
import {orderSquads,configureSquad,updateSquadOrders,squadSummary,SQUAD_ACTIONS} from './fw/squad-orders.mjs';
import {squadsFor,platoonSquadIds} from './fw/unit-groups.mjs';
import {SoldierRenderer} from './characters/renderer.mjs';
import {lookAround} from './characters/animation.mjs';
import {drawSquadPortrait} from './characters/portrait.mjs';
import {firingOrientation} from './fw/shot-geometry.mjs';
import {FLAG_IMAGES,drawHeadquarters,drawBattleEffects} from './fw/visuals.mjs';
import {drawSquadTeamFlags} from './fw/match-overlay.mjs';
import {drawCommandOverlay} from './fw/command-overlay.mjs';
import {BattlefieldTerrainRenderer} from './fw/terrain-art.mjs';
import {minimapRegion,minimapWorldPoint,minimapCameraMarker,MINIMAP_SAMPLE_STEP} from './fw/minimap-region.mjs';
import {icon} from './fw/ui-icons.mjs';
import {applyPalette} from './render/palette.mjs';
applyPalette(document.documentElement);
const $=id=>document.getElementById(id),canvas=$('battlefield'),ctx=canvas.getContext('2d'),mini=$('overview'),mctx=mini.getContext('2d');
const terrainArt=new BattlefieldTerrainRenderer();
const soldiers=new SoldierRenderer();soldiers.ready.catch(e=>alert('군복 이미지 오류: '+e.message));
const params=new URLSearchParams(location.search);
const seed=Number(params.get('seed'))||1977;
const terrainTest=params.get('terrainTest')==='1';
let armySize=ASHEN_ARMY_CHOICES.includes(Number(params.get('army')))?Number(params.get('army')):40;
let {board,match}=createAshenMatch({seed,count:armySize}),selected=new Set(),mode=null,hover=null,deployFormation='line',playMode='deploy',paused=false,low=false,additive=false;
let last=0,lastPaint=0,lastUI=0,lastRoster=0,lastOrders=0,lastMini=0,drawDpr=1,lastResumeAt=-Infinity;
let lastRosterRevision=-1,lastRosterAlive=-1;
const renderSamples=[];let renderedFrames=0,visibleTroops=0,visibleHeightFaces=0;
let miniGround=null,miniArea=null,miniQueries=0;
const camera={x:0,y:0,scale:.40},pointers=new Map(),colors={A:'#a7c6dd',B:'#d39283'};
const living=s=>s.memberIds.map(id=>board.unit(id)).filter(u=>u?.health.current>0);
const squads=()=>[...squadsFor(board).values()].filter(s=>s.team==='A'&&living(s).length);
const selectedIds=()=>[...selected].filter(id=>{const squad=squadsFor(board).get(id);return squad&&living(squad).length>0;});
let noticeTimer=null;
function notice(s){
 const toast=$('battle-notice');
 toast.textContent=s;$('status').textContent=s;
 toast.classList.add('is-visible');
 clearTimeout(noticeTimer);
 noticeTimer=setTimeout(()=>toast.classList.remove('is-visible'),2300);
}
function setHudExpanded(open){
 const expanded=!!open&&matchMedia('(max-width:700px)').matches;
 const hud=$('match-hud');
 hud.classList.toggle('is-open',expanded);
 document.body.classList.toggle('hud-open',expanded);
 $('hud-toggle').setAttribute('aria-expanded',String(expanded));
 $('hud-toggle').setAttribute('aria-label',expanded?'전투 현황 접기':'전투 현황 펼치기');
}
function resize(){const r=canvas.getBoundingClientRect();drawDpr=Math.min(low?1:2,devicePixelRatio||1);canvas.width=Math.round(r.width*drawDpr);canvas.height=Math.round(r.height*drawDpr);}
function restoreAfterBackground(force=false){
 if(document.hidden)return;
 const now=performance.now();
 if(!force&&now-lastResumeAt<250)return;
 lastResumeAt=now;
 terrainArt.restore();miniGround=null;miniArea=null;
 // Resizing resets the main canvas backing store, which may also have been lost.
 resize();lastPaint=0;lastMini=0;
 requestAnimationFrame(()=>{
  if(document.hidden)return;
  paint();lastPaint=performance.now();
  if(document.body.classList.contains('map-open')){paintMini();lastMini=performance.now();}
 });
}
function focus(x,y){const p=project(x,y);camera.x=canvas.clientWidth/2-p.x*camera.scale;camera.y=canvas.clientHeight/2-p.y*camera.scale;}
function fit(){camera.scale=innerWidth<650?.40:.48;focus(board.width*.34,board.height*.5);}
function zoom(ratio,x=canvas.clientWidth/2,y=canvas.clientHeight/2){const scale=Math.min(2.4,Math.max(.27,camera.scale*ratio)),r=scale/camera.scale;camera.x=x-(x-camera.x)*r;camera.y=y-(y-camera.y)*r;camera.scale=scale;}
function switchMode(m){
 playMode=m;document.body.dataset.playMode=m;
 $('deployment-toggle').textContent=m==='deploy'?'지휘 모드':'배치 모드';
 $('resume-deployment').hidden=!(match.phase==='preparation'&&m==='control');
}
// Shared show/dismiss lifecycle; each type of control remains a separate panel.
function setPanelOpen(panel,open){
 const state=String(!!open);
 if(panel.dataset.open===state)return;
 // Never animate an initially hidden surface out: that flashes unused menus.
 if(!open&&panel.hidden){panel.dataset.open='false';return;}
 panel._panelAnimation?.cancel();
 panel._panelAnimation=null;
 panel.dataset.open=state;
 panel.hidden=false;
 panel.inert=!open;
 panel.style.pointerEvents=open?'':'none';
 let animation=null;
 const finish=()=>{
  if(panel.dataset.open==='false'){
   panel.hidden=true;panel.inert=false;panel.style.pointerEvents='';
  }
  panel._panelAnimation=null;
  animation?.cancel(); // Release completed fill-mode animations instead of stacking them.
 };
 if(typeof panel.animate!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches){
  finish();
 }else{
  animation=panel.animate(open?
   [{opacity:0,scale:.96},{opacity:1,scale:1}]:
   [{opacity:1,scale:1},{opacity:0,scale:.97}],{
   duration:open?175:130,easing:open?'cubic-bezier(.2,.8,.25,1)':'ease-in',fill:'both'
  });
  panel._panelAnimation=animation;
  animation.onfinish=finish;
 }
 if(panel.id==='game-tools')$('tools-toggle').setAttribute('aria-expanded',state);
}
function closeTacticalPanels(){
 setPanelOpen($('squad-panel'),false);
 setPanelOpen($('formation-panel'),false);
 $('orders-toggle').setAttribute('aria-expanded','false');
 $('formation-toggle').setAttribute('aria-expanded','false');
}
function setMapOpen(open){
 document.body.classList.toggle('map-open',open);
 $('mobile-map-toggle').setAttribute('aria-expanded',String(open));
 $('mobile-map-toggle').textContent=open?'국지 지도 닫기':'국지 지도 열기';
 $('toggle-map').setAttribute('aria-expanded',String(open));
 if(open){closeTacticalPanels();setPanelOpen($('game-tools'),false);setHudExpanded(false);paintMini();}
}
function showTacticalPanel(name){
 const panel=$(name),opening=panel.dataset.open!=='true';
 closeTacticalPanels();
 if(!opening)return;
 setHudExpanded(false);
 setPanelOpen($('game-tools'),false);
 setMapOpen(false);
 setPanelOpen(panel,true);
 $(name==='squad-panel'?'orders-toggle':'formation-toggle').setAttribute('aria-expanded','true');
}

function choose(id,more=false){if(!more)selected.clear();if(id){if(more&&selected.has(id))selected.delete(id);else selected.add(id);}document.body.dataset.selected=String(selected.size>0);if(!selected.size)closeTacticalPanels();if(selected.size&&playMode==='deploy')switchMode('control');roster();hud();}
let feedbackTimer=null;
function showCommandFeedback(target,action){
 const p=target?.unitId?board.unit(target.unitId):target;
 if(!p||p.x==null||p.y==null)return;
 const pt=project(p.x,p.y),r=canvas.getBoundingClientRect(),mark=$('command-feedback');
 mark.style.left=Math.round(r.left+camera.x+pt.x*camera.scale)+'px';
 mark.style.top=Math.round(r.top+camera.y+pt.y*camera.scale)+'px';
 mark.textContent=action==='focus'?'◎':'✓';mark.hidden=false;mark.classList.remove('confirmed');
 void mark.offsetWidth;mark.classList.add('confirmed');
 clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{mark.hidden=true;},650);
}
function command(action,target=null){
 const ids=selectedIds();if(!ids.length){notice('분대를 선택하세요');return false;}
 const result=orderSquads(board,ids,action,target),count=result?.accepted?.length||0;
 if(count){showCommandFeedback(target,action);notice(count+'개 분대 명령 전달');}
 else notice('이동·공격 불가 · 목표를 확인하세요');
 roster();hud();return count>0;
}
function setCommand(m){if(m)closeTacticalPanels();mode=m;document.body.dataset.commandMode=m||'none';hover=null;for(const name of ['move','attack','flank'])$(name).classList.toggle('active',name===m);notice(m==='attack'?'공격할 적을 터치하세요':m==='flank'?'우회 위치를 터치하세요':m==='move'?'이동 위치를 터치하세요':'분대를 선택해 명령하세요');}
function deploy(p){const s=match.deploy('A','infantry',p);if(!s){notice('배치 불가 · 진영의 빈 공간을 선택하세요');return;}if(deployFormation!=='line')configureSquad(board,s.id,{formation:deployFormation});notice('제'+match.squadIds.A.length+'분대 배치 · 예비 '+match.reserve.A+'명');if(!match.reserve.A)switchMode('control');roster();hud();}
function autoDeploy(){const r=autoDeployPlayer(match);notice(r.complete?'배치 완료':'배치할 공간이 부족합니다');if(r.complete)switchMode('control');roster();hud();return r.complete;}
function start(){if(match.phase!=='preparation')return;closeTacticalPanels();setHudExpanded(false);if(!autoDeploy())return;match.start();if(match.phase!=='battle'){notice('전투 시작 실패');return;}switchMode('control');document.body.dataset.phase='battle';if(!selected.size&&squads().length)selected.add(squads()[0].id);notice('전투 시작 · 개나리워즈 원본 지휘 체계 가동');roster();hud();}
function startHeightTest(){
 if(!terrainTest)return false;
 const feature=board.battlefield?.heightDemo?.find(f=>f.team==='A'&&f.kind==='trench');
 if(!feature)return false;
 // Use the real squad deployment/commands. No duplicate test-only movement.
 let squad=null;
 for(const dx of [3,6,9,12]){
  squad=match.deploy('A','infantry',{x:feature.entrance.fromX-dx,y:feature.entrance.y});
  if(squad)break;
 }
 if(!squad)return false;
 autoDeployPlayer(match);
 match.start();
 if(match.phase!=='battle')return false;
 choose(squad.id);switchMode('control');
 document.body.dataset.phase='battle';
 focus(feature.x+4,feature.y-3);
 notice('참호·고지 테스트 · 분대 이동 지점을 터치하세요');
 return true;
}
function restart(){closeTacticalPanels();setPanelOpen($('game-tools'),false);setHudExpanded(false);({board,match}=createAshenMatch({seed,count:armySize}));selected.clear();mode=null;hover=null;paused=false;last=0;lastOrders=0;lastRoster=0;rosterEpoch=null;$('result').hidden=true;$('pause').textContent='Ⅱ';switchMode('deploy');fit();setMapOpen(true);if(!startHeightTest())notice('아군 진영에 병력을 배치하세요');roster();hud();}
function locate(px,py){const r=unproject((px-camera.x)/camera.scale,(py-camera.y)/camera.scale),x=Math.round(r.x),y=Math.round(r.y);return board.inside(x,y)?{x,y}:null;}
function hit(px,py){let closest=null,d=25;for(const u of board.units){if(u.health.current<=0)continue;const p=projectElevatedFoot(board,u),dist=Math.hypot(px-camera.x-p.x*camera.scale,py-camera.y-p.y*camera.scale+25*camera.scale);if(dist<d){d=dist;closest=u;}}return closest;}
function tap(px,py,shift=false){const p=locate(px,py);if(!p)return;if(playMode==='deploy'&&match.phase==='preparation'){deploy(p);return;}const u=hit(px,py);
 if(u?.team==='A'&&!mode){choose(u.squadId,shift||additive);return;}
 if(mode==='attack'){if(u?.team==='B'&&command('focus',{unitId:u.id}))setCommand(null);else notice('적군을 선택하세요');return;}
 if(mode==='flank'){if(command('flank',p))setCommand(null);return;}
 if(mode==='move'){if(command('advance',p))setCommand(null);return;}
 if(u?.team==='B')command('focus',{unitId:u.id});else command('advance',p);
}
function bounds(){
 const w=canvas.clientWidth,h=canvas.clientHeight;
 const corners=[[0,0],[w,0],[0,h],[w,h]].map(([px,py])=>unproject((px-camera.x)/camera.scale,(py-camera.y)/camera.scale));
 return {x0:Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x))-4)),
 x1:Math.min(board.width-1,Math.ceil(Math.max(...corners.map(p=>p.x))+4)),
 y0:Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y))-4)),
 y1:Math.min(board.height-1,Math.ceil(Math.max(...corners.map(p=>p.y))+4))};
}
function paint(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.setTransform(drawDpr,0,0,drawDpr,0,0);ctx.fillStyle='#272e31';ctx.fillRect(0,0,w,h);terrainArt.draw(ctx,board,camera,w,h,drawDpr,low);ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);
 drawHeadquarters(ctx,match.flags,board.time);
 if(playMode==='deploy'&&match.phase==='preparation'){const b=bounds();ctx.fillStyle='#adc1d026';for(let y=b.y0;y<=b.y1;y+=3)for(let x=b.x0;x<Math.min(b.x1,board.width/2);x+=3){if(board.navigation.blocked(y*board.width+x))continue;const p=project(x,y);ctx.fillRect(p.x-5,p.y-3,10,6);}}
 if(match.phase==='battle')drawCommandOverlay(ctx,board,{
  selectedSquadIds:selectedIds(),
  mode:mode?'squad-target':null,
  squadOrder:mode==='attack'?'focus':mode==='flank'?'flank':mode==='move'?'advance':null,
  commandSquadIds:selectedIds(),
  hover
 },camera.scale);
 // Culling BEFORE sorting avoids sorting hundreds of unseen 2.5D sprites.
 const troops=[],squadIndex=squadsFor(board);
 for(const u of board.units){
  if(u.hasMoved&&!u._movementRecorded&&u.squadId){const s=squadIndex.get(u.squadId);if(s){s.hasMoved=true;u._movementRecorded=true;}}
  if(u.health.current<=0&&u.state!=='death')continue;
  const p=projectElevatedFoot(board,u),sx=camera.x+p.x*camera.scale,sy=camera.y+p.y*camera.scale;
  if(sx< -100||sx>w+100||sy< -100||sy>h+100)continue;
  u._renderFoot=p;
  troops.push(u);
 }
 troops.sort(compareProjectedUnits);
 visibleTroops=troops.length;
 const faces=terrainOccluders(board,bounds());visibleHeightFaces=faces.length;
 const distant=low||camera.scale<.12||(board.units.length>280&&camera.scale<.45);
 const shotStamp=renderedFrames+1;
 for(const u of troops){const p=u._renderFoot;
  ctx.save();ctx.translate(p.x,p.y);
  // Local per-soldier occlusion, including same-tile depth and moving feet.
  clipSoldierAgainstTerrain(ctx,board,u);
  if(selected.has(u.squadId)&&u.health.current>0){ctx.strokeStyle=colors.A;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,23,12,0,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#10161999';ctx.beginPath();ctx.ellipse(0,0,17,7,0,0,Math.PI*2);ctx.fill();
  const s=squadIndex.get(u.squadId),rank=s?.leaderId===u.id?(match.squadIds[u.team][0]===u.squadId?'captain':'sergeant'):'private';
  const shot=u.state==='attack',orientation=shot?firingOrientation(board,u):null;
  const facing=orientation?.facing??u.facing,rawAim=shot?orientation.aim:0;
  const view=u._visualStance??(u._visualStance={blend:0,walk:u.state==='walk'?1:0,crouch:0,aim:rawAim,time:board.time});
  const delta=Math.max(0,board.time-view.time);view.time=board.time;
  const hitNow=(u.hitPulseUntil??-1)>board.time;
  const fighting=shot||u.state==='hit'||hitNow||(u.alertUntil??-1)>board.time;
  // Keep the lightly guarded pose anatomically at rest. Partial rifle-grip
  // interpolation pulls authored shoulder sprites off their body sockets.
  const guarding=match.phase!=='preparation'&&(!!s?.hasMoved||!!u.hasEngaged||fighting||view.crouch>.24);
  const state=u.state==='death'?'death':u.state==='walk'?'walk':shot?'shoot':hitNow?'hit':guarding?'guard':'idle';
  const targetBlend=shot?1:0;
  const smooth=Math.min(1,delta*9);
  view.blend+=(targetBlend-view.blend)*smooth;
  view.walk+=((state==='walk'?1:0)-view.walk)*smooth;
  // Only actual fighting raises the stance; no intervals or elapsed-time checks.
  const braceTarget=fighting?1:state==='guard'?.10:0;
  view.crouch+=(braceTarget-view.crouch)*Math.min(1,delta*(fighting?10:2.4));
  const difference=Math.atan2(Math.sin(rawAim-view.aim),Math.cos(rawAim-view.aim));
  view.aim+=difference*Math.min(1,delta*8);
  const hitReaction=Math.max(0,Math.min(1,((u.hitPulseUntil??-1)-board.time)/.16));
  const pose=distant&&state!=='death'
   ?{state:shot?'shoot':state==='guard'?'guard':hitNow?'hit':'idle',time:shot?Math.min(u.elapsed,.04):0,gaitTime:0,moving:false,facing,phase:0,aim:Math.round(rawAim*4)/4,fireAt:shot?u.strike?.impactTime??0:0,shootBlend:shot?1:0,walkBlend:0,crouchBlend:fighting?1:state==='guard'?.10:0,hitReaction:hitNow?1:0}
   :{state,time:state==='shoot'||state==='death'?u.elapsed:state==='hit'?board.time-u.lastHitAt:board.time,gaitTime:board.time,moving:!!u.step,facing:u.facing,phase:(u.id%4)*.6,facing,aim:view.aim,fireAt:shot?u.strike?.impactTime??0:0,shootBlend:view.blend,walkBlend:view.walk,crouchBlend:view.crouch,hitReaction};
  const climbBlend=state==='walk'?terrainTransitionPose(board,u):0;
  const riseProgress=state==='walk'?terrainRiseProgress(board,u):null;
  const lookBlend=!distant&&(state==='guard'||state==='idle'&&u.hasMoved)
   ?lookAround(board.time,u.id):0;
  const muzzle=shot?(u._shotMuzzle??(u._shotMuzzle={})):null;
  if(muzzle)muzzle.valid=false;
  if(!soldiers.draw(ctx,u.team,rank,{...pose,muzzleOut:muzzle,pixelDensity:camera.scale*drawDpr*.285*1.8,climbBlend,riseProgress,lookBlend},distant)){
   ctx.fillStyle=colors[u.team];ctx.fillRect(-8,-37,16,30);
  }
  if(shot)u._shotMuzzleStamp=muzzle.valid?shotStamp:-1;
  ctx.restore();
 }
 drawSquadTeamFlags(ctx,board,camera.scale,camera,w,h,[...selected]);
 drawBattleEffects(ctx,board,shotStamp);ctx.restore();
}
function paintMini(){
 const area=minimapRegion(board,camera,canvas.clientWidth,canvas.clientHeight);
 miniArea=area;
 const key=board.terrainRevision+':'+board.obstacleRevision;
 if(!miniGround||miniGround.board!==board||miniGround.key!==key||
    miniGround.area.x0!==area.x0||miniGround.area.y0!==area.y0||
    miniGround.area.width!==area.width||miniGround.area.height!==area.height){
  const bitmap=document.createElement('canvas');bitmap.width=mini.width;bitmap.height=mini.height;
  const background=bitmap.getContext('2d'),sx=mini.width/area.width,sy=mini.height/area.height;
  background.fillStyle='#30383b';background.fillRect(0,0,mini.width,mini.height);
  for(let y=area.y0;y<area.y1;y+=MINIMAP_SAMPLE_STEP)
   for(let x=area.x0;x<area.x1;x+=MINIMAP_SAMPLE_STEP){
    miniQueries++;
    const t=board.terrain[y][x];if(t==='void')continue;
    background.fillStyle=t==='forest'?'#43616b':t==='soil'?'#666762':'#777e7a';
    background.fillRect((x-area.x0)*sx,(y-area.y0)*sy,
     Math.ceil(sx*MINIMAP_SAMPLE_STEP),Math.ceil(sy*MINIMAP_SAMPLE_STEP));
   }
  miniGround={board,key,area,bitmap};
 }
 mctx.drawImage(miniGround.bitmap,0,0);
 const sx=mini.width/area.width,sy=mini.height/area.height;
 const cx=area.x0+area.width/2,cy=area.y0+area.height/2;
 // Covers the square viewport corners using the same existing spatial index.
 const radius=Math.hypot(area.width,area.height)/2;
 for(const id of board.spatial.candidates(cx,cy,radius)){
  const u=board.unit(id);
  if(!u||u.health.current<=0||u.x<area.x0||u.x>=area.x1||u.y<area.y0||u.y>=area.y1)continue;
  mctx.fillStyle=colors[u.team];mctx.fillRect((u.x-area.x0)*sx-1,(u.y-area.y0)*sy-1,3,3);
 }
 // North-up marker instead of a visually tilted isometric viewport diamond.
 const center=minimapCameraMarker(area,camera,canvas.clientWidth,canvas.clientHeight,mini.width,mini.height);
 if(center.x>=0&&center.x<=mini.width&&center.y>=0&&center.y<=mini.height){
  mctx.save();mctx.strokeStyle='#f5e5bd';mctx.lineWidth=1.8;
  mctx.beginPath();mctx.arc(center.x,center.y,5,0,Math.PI*2);mctx.stroke();
  mctx.beginPath();
  mctx.moveTo(center.x-8,center.y);mctx.lineTo(center.x-5,center.y);
  mctx.moveTo(center.x+5,center.y);mctx.lineTo(center.x+8,center.y);
  mctx.moveTo(center.x,center.y-8);mctx.lineTo(center.x,center.y-5);
  mctx.moveTo(center.x,center.y+5);mctx.lineTo(center.x,center.y+8);
  mctx.stroke();mctx.restore();
 }
}
// Persistent cards from the original FlowerWars roster approach: create once, update fields.
const rosterCards=new Map();
let rosterEpoch=null;
const PHASES={forming:'진형 형성 중',moving:'이동 중',flanking:'우회 중',attacking:'공격 중',holding:'사수',stopped:'정지',arrived:'도착',complete:'완료','target-lost':'대상 소실',blocked:'경로 대기',reforming:'재집결 중'};
const ACTION_NAMES=Object.fromEntries(Object.entries(SQUAD_ACTIONS).map(([k,v])=>[k,v.label]));
const phaseName=s=>PHASES[s?.order?.phase]||ACTION_NAMES[s?.order?.type]||'대기';
function roster(){
 document.body.dataset.selected=String(selected.size>0);
 const host=$('squad-tabs'),all=[...squadsFor(board).values()].filter(s=>s.team==='A');
 for(const squad of all)if(!living(squad).length)selected.delete(squad.id);
 document.body.dataset.selected=String(selected.size>0);
 if(rosterEpoch!==board.byId){
  host.replaceChildren();rosterCards.clear();rosterEpoch=board.byId;
 }
 for(let i=0;i<all.length;i+=2){
  const platoonId=Math.floor(i/2),key='platoon-'+platoonId;
  let section=host.querySelector('[data-platoon-id="'+key+'"]');
  if(!section){
   section=document.createElement('section');section.dataset.platoonId=key;section.className='squad-platoon';
   const head=document.createElement('div');head.className='platoon-controls';
   const pick=document.createElement('button');pick.className='platoon-title';
   pick.innerHTML=icon('platoon')+'<span>A · '+(platoonId+1)+'소대</span>';
   pick.setAttribute('aria-label','제'+(platoonId+1)+'소대 전체 선택');
   pick.onclick=()=>{selected=new Set(platoonSquadIds(board,platoonId));roster();hud();};
   const fold=document.createElement('button');fold.className='platoon-fold';fold.innerHTML=icon('disclosure');
   fold.setAttribute('aria-label',(platoonId+1)+'소대 접기');fold.setAttribute('aria-expanded','true');
   const row=document.createElement('div');row.className='platoon-squads';row.id='platoon-squads-'+platoonId;fold.setAttribute('aria-controls',row.id);
   fold.onclick=()=>{const collapsed=row.hidden=!row.hidden;fold.setAttribute('aria-expanded',String(!collapsed));fold.setAttribute('aria-label',(platoonId+1)+'소대 '+(collapsed?'펼치기':'접기'));};
   head.append(pick,fold);section.append(head,row);host.append(section);
  }
  const row=section.querySelector('.platoon-squads');
  const platoonMembers=platoonSquadIds(board,platoonId);
  section.querySelector('.platoon-title').setAttribute('aria-pressed',String(platoonMembers.length>0&&platoonMembers.every(id=>selected.has(id))));
  for(const s of all.slice(i,i+2)){
   let node=rosterCards.get(s.id);
   if(!node){
    const button=document.createElement('button');button.className='squad-card';button.dataset.squadId=s.id;
    const portrait=document.createElement('span');portrait.className='squad-portrait';
    const canvas=document.createElement('canvas');canvas.width=240;canvas.height=240;canvas.className='commander-photo';
    const badge=document.createElement('span');badge.className='commander-badge';badge.innerHTML=icon('focus');badge.title='소총보병';
    portrait.append(canvas,badge);
    const body=document.createElement('span');body.className='squad-card-body';
    const title=document.createElement('strong');title.className='squad-card-title';title.textContent=(s.matchIndex+1)+'분대';
    const kind=document.createElement('span');kind.className='squad-kind';kind.textContent='소총보병';
    const status=document.createElement('small');status.className='squad-card-status';
    body.append(title,kind,status);
    const activity=document.createElement('span');activity.className='squad-activity';
    button.append(portrait,body,activity);
    button.onclick=e=>choose(s.id,e.shiftKey||e.ctrlKey||e.metaKey||additive);
    button.ondblclick=()=>{choose(s.id);$('selection-locate').click();};
    button.setAttribute('aria-label',(s.matchIndex+1)+'분대 선택');
    row.append(button);
    node={button,canvas,status,activity,portraitRank:null,activityType:null};rosterCards.set(s.id,node);
   }
   const alive=squadSummary(board,s.id);
   const n=alive?.alive??living(s).length;
   const phase=phaseName(s);
   const statusText=n+'/'+s.memberIds.length+' · '+(n===0?'전멸':s.order?.after?'우회 → 공격':phase);
   if(node.status.textContent!==statusText)node.status.textContent=statusText;
   const type=s.order?.type||'wait';
   if(node.activityType!==type){node.activity.innerHTML=icon(type);node.activityType=type;}
   const target=s.order?.target;
   const dest=target?.x!=null?' → '+(target.x+1)+','+(target.y+1):target?.unitId?' → 적 병사':'';
   node.activity.title=(ACTION_NAMES[type]||'대기')+' · '+phase+dest;
   node.button.classList.toggle('is-eliminated',n===0);
   node.button.disabled=n===0;
   const active=selected.has(s.id);node.button.classList.toggle('active',active);
   node.button.classList.toggle('is-selected',active);node.button.setAttribute('aria-pressed',String(active));
   node.button.classList.toggle('leader-down',alive?!alive.commanderAlive:false);
   const rank=s.leaderId&&board.unit(s.leaderId)?.health.current>0?(s.matchIndex===0?'captain':'sergeant'):'private';
   if(soldiers.loaded&&node.portraitRank!==rank+':'+soldiers.revision){
    if(drawSquadPortrait(node.canvas,soldiers,'arken',rank))node.portraitRank=rank+':'+soldiers.revision;
   }
  }
 }
}
function hud(){
 // The battlefield loses color only after the actual elimination of the player's army.
 // Flag capture or the initial empty deployment screen must not trigger this effect.
 const a=Math.min(match.counts.A,board.teamAlive.A),b=Math.min(match.counts.B,board.teamAlive.B);
 document.body.dataset.annihilated=String(match.phase!=='preparation'&&a===0);
 document.body.dataset.phase=match.phase==='finished'?'battle':match.phase;$('match-phase').textContent=match.phase==='preparation'?'병력 배치':match.phase==='battle'?'전투 중':'전투 종료';
 const time=match.phase==='preparation'?match.remaining:match.elapsed,clock=String(Math.floor(time/60)).padStart(2,'0')+':'+String(Math.floor(time%60)).padStart(2,'0');
 $('preparation-clock').textContent=clock;$('clock').textContent=clock;$('forces').textContent='아르켄 '+a+' : '+b+' 벨리안';$('army-a').textContent=a;$('army-b').textContent=b;
 $('hud-compact-phase').textContent=$('match-phase').textContent;
 $('hud-compact-time').textContent=clock;
 $('hud-compact-force').textContent=match.phase==='preparation'?'예비 '+match.reserve.A+'명':a+' : '+b;
 $('deployment-reserve').textContent='예비 '+match.reserve.A+'명 · 배치 '+match.counts.A+'명';
 $('army-size').disabled=match.phase!=='preparation';
 $('start-battle').hidden=match.phase!=='preparation';$('match-charge').hidden=match.phase!=='battle';$('auto-deploy').hidden=match.phase!=='preparation'||match.reserve.A===0;$('deployment-toggle').hidden=match.phase!=='preparation';
 const ids=selectedIds(),s=squadsFor(board).get(ids[0]);$('squad-name').textContent=ids.length>1?ids.length+'개 분대 선택':s?'제'+(s.matchIndex+1)+'분대 · '+living(s).length+'명':'분대 지휘';
 $('squad-info').textContent=s?phaseName(s):'';$('objective').textContent='적 지휘소 점령 또는 적군 전멸';
 const formationLabels={line:'횡대',column:'종대',dense:'밀집',spread:'산개',square:'방진'};
 const formationsSelected=ids.map(id=>squadsFor(board).get(id)?.formation||'line');
 const formation=formationsSelected.length&&formationsSelected.every(x=>x===formationsSelected[0])?formationsSelected[0]:null;
 $('formation-current').textContent=formation?(formationLabels[formation]||'기본 진형'):'혼합 진형';
 for(const button of $('formation-controls').children){
  const active=!!formation&&button.dataset.formation===formation;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 }
 if(match.phase==='finished'&&$('result').hidden){roster();$('result').hidden=false;$('result').querySelector('h1').textContent=match.winner==='draw'?'무승부':match.winner==='A'?'아르켄 승리':'벨리안 승리';$('result').querySelector('p').textContent=match.finishReason==='annihilation'?'병력 전멸':'지휘소 함락';}
}
function bind(){
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)restoreAfterBackground();});
 addEventListener('pageshow',event=>{if(event.persisted)restoreAfterBackground();});
 canvas.addEventListener('contextlost',event=>{event.preventDefault();terrainArt.invalidate();});
 canvas.addEventListener('contextrestored',()=>restoreAfterBackground(true));
 const hud=$('match-hud'),tools=$('game-tools');
 const squadPanel=$('squad-panel'),formationPanel=$('formation-panel');
 const dismissedWorldPointers=new Set();
 $('hud-toggle').onclick=()=>{
  const opening=!hud.classList.contains('is-open');
  closeTacticalPanels();setPanelOpen(tools,false);setHudExpanded(opening);
 };
 // Outside-tap dismissals never create a hidden world command or troop deployment.
 document.addEventListener('pointerdown',event=>{
  const target=event.target,hitCanvas=target===canvas;
  let dismissed=false;
  if(hud.classList.contains('is-open')&&!hud.contains(target)){setHudExpanded(false);dismissed=true;}
  if(tools.dataset.open==='true'&&!tools.contains(target)&&!$('tools-toggle').contains(target)){setPanelOpen(tools,false);dismissed=true;}
  if(squadPanel.dataset.open==='true'&&!squadPanel.contains(target)&&!$('orders-toggle').contains(target)){closeTacticalPanels();dismissed=true;}
  if(formationPanel.dataset.open==='true'&&!formationPanel.contains(target)&&!$('formation-toggle').contains(target)){closeTacticalPanels();dismissed=true;}
  if(dismissed&&hitCanvas)dismissedWorldPointers.add(event.pointerId);
 },true);
 if(matchMedia('(hover:hover) and (pointer:fine)').matches){
  hud.addEventListener('mouseenter',()=>{if(matchMedia('(max-width:700px)').matches)setHudExpanded(true);});
  hud.addEventListener('mouseleave',()=>setHudExpanded(false));
 }
 const sizeSelect=$('army-size');sizeSelect.value=String(armySize);
 sizeSelect.onchange=()=>{const next=Number(sizeSelect.value);if(!ASHEN_ARMY_CHOICES.includes(next))return;
  if(match.phase!=='preparation'){sizeSelect.value=String(armySize);notice('전투 종료 후 새 전투에서 병력 수를 변경하세요');return;}
  const reset=match.counts.A>0||match.counts.B>0;
  armySize=next;restart();sizeSelect.value=String(next);notice('진영당 '+next+'명 · 소총보병 '+(next/10)+'개 분대'+(reset?' · 기존 배치 초기화':''));};
 $('start-battle').onclick=start;$('auto-deploy').onclick=autoDeploy;
 $('deployment-toggle').onclick=()=>switchMode(playMode==='deploy'?'control':'deploy');
 $('resume-deployment').onclick=()=>{switchMode('deploy');setHudExpanded(false);};
 for(const b of $('deployment-types').querySelectorAll('[data-deploy-type]'))b.onclick=()=>{deployFormation=b.dataset.deployType;switchMode('deploy');for(const v of $('deployment-types').querySelectorAll('button'))v.setAttribute('aria-pressed',String(v===b));};
 for(const name of ['move','attack','flank'])$(name).onclick=()=>setCommand(mode===name?null:name);
 $('hold').onclick=()=>command('hold');$('rally').onclick=()=>command('rally');
 $('withdraw').onclick=()=>command('retreat',{x:match.flags.A.x,y:match.flags.A.y});
 $('command-all').onclick=()=>{selected=new Set(squads().map(s=>s.id));command('advance',{x:match.flags.B.x,y:match.flags.B.y});roster();};
 $('match-charge').onclick=()=>$('command-all').click();
 for(const [id,name] of [['move','advance'],['attack','focus'],['flank','flank'],['hold','hold'],['rally','rally']])$(id).innerHTML=icon(name)+'<span>'+$(id).textContent+'</span>';
 $('orders-toggle').innerHTML=icon('platoon')+'<span>부대</span>';
 $('formation-toggle').innerHTML=icon('line')+'<span>진형</span>';
 $('multi-select').innerHTML=icon('plus')+'<span>복수</span>';
 $('selection-platoon').innerHTML=icon('platoon')+'<span>소대 선택</span>';
 $('selection-locate').innerHTML=icon('eye')+'<span>보기</span>';
 const formations={line:'횡대',column:'종대',dense:'밀집',spread:'산개',square:'방진'};
 for(const [name,label]of Object.entries(formations)){
  const b=document.createElement('button');b.type='button';b.dataset.formation=name;
  b.innerHTML=icon(name)+'<span>'+label+'</span>';b.setAttribute('aria-pressed','false');
  b.onclick=()=>{
   for(const id of selectedIds())configureSquad(board,id,{formation:name});
   closeTacticalPanels();hud();roster();
  };
  $('formation-controls').append(b);
 }
 $('formation-toggle').onclick=()=>showTacticalPanel('formation-panel');
 $('orders-toggle').onclick=()=>showTacticalPanel('squad-panel');
 $('squad-panel-close').onclick=closeTacticalPanels;
 $('formation-close').onclick=closeTacticalPanels;
 $('cancel').onclick=()=>setCommand(null);
 $('multi-select').onclick=()=>{additive=!additive;$('multi-select').setAttribute('aria-pressed',String(additive));};
 $('clear-selection').onclick=()=>choose(null);$('select-all').onclick=()=>{selected=new Set(squads().map(s=>s.id));roster();hud();};
 $('select-squad').onclick=()=>document.body.classList.toggle('roster-open');
 $('close-roster').onclick=()=>document.body.classList.remove('roster-open');
 $('selection-platoon').onclick=()=>{const first=squads().find(s=>selected.has(s.id));if(first){selected=new Set(platoonSquadIds(board,Math.floor(first.matchIndex/2)));roster();hud();}};
 $('selection-locate').onclick=()=>{const members=selectedIds().flatMap(id=>living(squadsFor(board).get(id)));if(members.length)focus(members.reduce((s,u)=>s+u.x,0)/members.length,members.reduce((s,u)=>s+u.y,0)/members.length);};
 $('zoom-in').onclick=()=>zoom(1.13);
 $('zoom-out').onclick=()=>zoom(.89);
 $('fit-view').onclick=fit;
 $('home-view').onclick=()=>focus(match.flags.A.x,match.flags.A.y);$('enemy-view').onclick=()=>focus(match.flags.B.x,match.flags.B.y);
 $('toggle-map').onclick=()=>setMapOpen(!document.body.classList.contains('map-open'));
 $('mobile-map-toggle').onclick=()=>setMapOpen(!document.body.classList.contains('map-open'));
 $('overview-close').onclick=()=>setMapOpen(false);
 $('tools-toggle').onclick=()=>{
  const opening=tools.dataset.open!=='true';
  closeTacticalPanels();setHudExpanded(false);setMapOpen(false);
  setPanelOpen(tools,opening);
 };
 $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';};
 $('restart').onclick=restart;$('play-again').onclick=restart;
 $('low-mode').onchange=e=>{low=e.target.checked;resize();};
 $('support').disabled=true;$('support').title='초기 이식판: 포격은 후속 작업';
 canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(e.deltaY<0?1.13:.89,e.clientX-r.left,e.clientY-r.top);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,multi:pointers.size>0});if(pointers.size>1)for(const p of pointers.values())p.multi=true;});
 canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p){const rect=canvas.getBoundingClientRect();hover=locate(e.clientX-rect.left,e.clientY-rect.top);return;}hover=null;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(pointers.size===1){camera.x+=dx;camera.y+=dy;}else if(pointers.size===2){const other=[...pointers].find(([id])=>id!==e.pointerId)?.[1];if(other){const a=Math.hypot(p.x-other.x,p.y-other.y),b=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(a>10&&b>10){const r=canvas.getBoundingClientRect();zoom(b/a,(e.clientX+other.x)/2-r.left,(e.clientY+other.y)/2-r.top);}}}p.x=e.clientX;p.y=e.clientY;});
 const end=e=>{
  const p=pointers.get(e.pointerId),dismissed=dismissedWorldPointers.delete(e.pointerId);
  pointers.delete(e.pointerId);
  if(!p||dismissed||e.type!=='pointerup')return;
  if(!p.multi&&Math.hypot(e.clientX-p.ox,e.clientY-p.oy)<7){
   const r=canvas.getBoundingClientRect();
   tap(e.clientX-r.left,e.clientY-r.top,e.shiftKey);
  }
 };
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('pointerleave',()=>{hover=null;});
 mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;if(dx*dx+dy*dy>(Math.min(r.width,r.height)/2)**2)return;const area=miniArea||minimapRegion(board,camera,canvas.clientWidth,canvas.clientHeight);const target=minimapWorldPoint(area,e.clientX-r.left,e.clientY-r.top,r.width,r.height);focus(Math.max(0,Math.min(board.width-1,target.x)),Math.max(0,Math.min(board.height-1,target.y)));paintMini();});
 addEventListener('resize',()=>{resize();if(!matchMedia('(max-width:700px)').matches)setHudExpanded(false);});document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;const key=e.key.toLowerCase();if(key==='m')setCommand('move');if(key==='a')setCommand('attack');if(key==='h')$('hold').click();if(key==='escape'){setCommand(null);setHudExpanded(false);setPanelOpen(tools,false);setMapOpen(false);closeTacticalPanels();}if(key===' '){e.preventDefault();$('pause').click();}});
}
function frame(t){const dt=last?Math.min((t-last)/1000,.1):0;last=t;
 if(!paused&&dt){board.update(Math.min(dt,.05));match.update(dt);if(t-lastOrders>=50){updateSquadOrders(board);lastOrders=t;}}
 if(t-lastPaint>=33){const begin=performance.now();paint();const ms=performance.now()-begin;if(renderSamples.length>=90)renderSamples.shift();renderSamples.push(ms);renderedFrames++;lastPaint=t;}if(t-lastUI>=250){hud();lastUI=t;}if(t-lastRoster>=800||match.statusRevision!==lastRosterRevision||board.teamAlive.A!==lastRosterAlive){roster();lastRoster=t;lastRosterRevision=match.statusRevision;lastRosterAlive=board.teamAlive.A;}if(t-lastMini>=500){if(document.body.classList.contains('map-open'))paintMini();lastMini=t;}
 requestAnimationFrame(frame);
}
bind();resize();fit();switchMode('deploy');if(!startHeightTest())notice('아군 진영에 병력을 배치하세요');hud();roster();setMapOpen(true);requestAnimationFrame(frame);
window.__ashenFlower={get board(){return board;},get camera(){return {...camera};},get match(){return match;},get flagsLoaded(){return Object.values(FLAG_IMAGES).every(i=>i.complete&&i.naturalWidth>0);},get armySize(){return armySize;},get renderStats(){const samples=[...renderSamples].sort((a,b)=>a-b);const sum=samples.reduce((n,v)=>n+v,0);return {frames:renderedFrames,visibleTroops,heightFaces:visibleHeightFaces,avgMs:sum/(samples.length||1),p95Ms:samples[Math.floor((samples.length-1)*.95)]||0,terrainRebuilds:terrainArt.rebuilds,terrainCacheHits:terrainArt.cacheHits,terrainZoomReuses:terrainArt.zoomReuses,terrainEvictions:terrainArt.evictions,terrainPages:terrainArt.pages.length,terrainCacheBytes:terrainArt.cacheBytes,terrainVisibleTiles:terrainArt.cache?.tiles??0,miniQueries,miniArea,spriteCache:soldiers.stats};},autoDeploy,start,order:(ids,act,target)=>orderSquads(board,ids,act,target)};
