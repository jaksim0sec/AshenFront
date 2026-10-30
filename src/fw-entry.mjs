import {createAshenMatch,autoDeployPlayer,ASHEN_ARMY_CHOICES} from './fw/ashen-setup.mjs';
import {project,unproject} from './fw/model.mjs';
import {orderSquads,configureSquad,updateSquadOrders,squadSummary,SQUAD_ACTIONS} from './fw/squad-orders.mjs';
import {squadsFor} from './fw/unit-groups.mjs';
import {SoldierRenderer} from './characters/renderer.mjs';
import {drawSquadPortrait} from './characters/portrait.mjs';
import {firingOrientation} from './fw/shot-geometry.mjs';
import {FLAG_IMAGES,drawHeadquarters,drawBattleEffects} from './fw/visuals.mjs';
import {drawSquadTeamFlags} from './fw/match-overlay.mjs';
import {drawCommandOverlay} from './fw/command-overlay.mjs';
import {BattlefieldTerrainRenderer} from './fw/terrain-art.mjs';
import {icon} from './fw/ui-icons.mjs';
import {applyPalette} from './render/palette.mjs';
applyPalette(document.documentElement);
const $=id=>document.getElementById(id),canvas=$('battlefield'),ctx=canvas.getContext('2d'),mini=$('overview'),mctx=mini.getContext('2d');
const terrainArt=new BattlefieldTerrainRenderer();
const soldiers=new SoldierRenderer();soldiers.ready.catch(e=>alert('군복 이미지 오류: '+e.message));
const params=new URLSearchParams(location.search);
const seed=Number(params.get('seed'))||1977;
let armySize=ASHEN_ARMY_CHOICES.includes(Number(params.get('army')))?Number(params.get('army')):40;
let {board,match}=createAshenMatch({seed,count:armySize}),selected=new Set(),mode=null,hover=null,deployFormation='line',playMode='deploy',paused=false,low=false,additive=false;
let last=0,lastPaint=0,lastUI=0,lastRoster=0,lastOrders=0,lastMini=0,drawDpr=1;
const renderSamples=[];let renderedFrames=0,visibleTroops=0;
let miniGround=null;
const camera={x:0,y:0,scale:.30},pointers=new Map(),colors={A:'#a7c6dd',B:'#d39283'};
const living=s=>s.memberIds.map(id=>board.unit(id)).filter(u=>u?.health.current>0);
const squads=()=>[...squadsFor(board).values()].filter(s=>s.team==='A'&&living(s).length);
const selectedIds=()=>[...selected].filter(id=>squadsFor(board).has(id));
function notice(s){$('battle-notice').textContent=s;$('status').textContent=s;}
function resize(){const r=canvas.getBoundingClientRect();drawDpr=Math.min(low?1:2,devicePixelRatio||1);canvas.width=Math.round(r.width*drawDpr);canvas.height=Math.round(r.height*drawDpr);}
function focus(x,y){const p=project(x,y);camera.x=canvas.clientWidth/2-p.x*camera.scale;camera.y=canvas.clientHeight/2-p.y*camera.scale;}
function fit(){camera.scale=innerWidth<650?.30:.42;focus(board.width*.34,board.height*.5);}
function zoom(ratio,x=canvas.clientWidth/2,y=canvas.clientHeight/2){const scale=Math.min(2.4,Math.max(.22,camera.scale*ratio)),r=scale/camera.scale;camera.x=x-(x-camera.x)*r;camera.y=y-(y-camera.y)*r;camera.scale=scale;}
function switchMode(m){playMode=m;document.body.dataset.playMode=m;$('deployment-toggle').textContent=m==='deploy'?'지휘 모드':'배치 모드';}
function choose(id,more=false){if(!more)selected.clear();if(id){if(more&&selected.has(id))selected.delete(id);else selected.add(id);}document.body.dataset.selected=String(selected.size>0);if(selected.size&&playMode==='deploy')switchMode('control');roster();hud();}
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
function setCommand(m){mode=m;hover=null;for(const name of ['move','attack','flank'])$(name).classList.toggle('active',name===m);notice(m==='attack'?'공격할 적을 터치하세요':m==='flank'?'우회 위치를 터치하세요':m==='move'?'이동 위치를 터치하세요':'분대를 선택해 명령하세요');}
function deploy(p){const s=match.deploy('A','infantry',p);if(!s){notice('배치 불가 · 진영의 빈 공간을 선택하세요');return;}if(deployFormation!=='line')configureSquad(board,s.id,{formation:deployFormation});notice('제'+match.squadIds.A.length+'분대 배치 · 예비 '+match.reserve.A+'명');if(!match.reserve.A)switchMode('control');roster();hud();}
function autoDeploy(){const r=autoDeployPlayer(match);notice(r.complete?'배치 완료':'배치할 공간이 부족합니다');if(r.complete)switchMode('control');roster();hud();return r.complete;}
function start(){if(match.phase!=='preparation')return;if(!autoDeploy())return;match.start();if(match.phase!=='battle'){notice('전투 시작 실패');return;}switchMode('control');document.body.dataset.phase='battle';if(!selected.size&&squads().length)selected.add(squads()[0].id);notice('전투 시작 · 개나리워즈 원본 지휘 체계 가동');roster();hud();}
function restart(){({board,match}=createAshenMatch({seed,count:armySize}));selected.clear();mode=null;hover=null;paused=false;last=0;lastOrders=0;lastRoster=0;rosterEpoch=null;$('result').hidden=true;$('pause').textContent='Ⅱ';switchMode('deploy');fit();notice('아군 진영에 병력을 배치하세요');roster();hud();}
function locate(px,py){const r=unproject((px-camera.x)/camera.scale,(py-camera.y)/camera.scale),x=Math.round(r.x),y=Math.round(r.y);return board.inside(x,y)?{x,y}:null;}
function hit(px,py){let closest=null,d=25;for(const u of board.units){if(u.health.current<=0)continue;const p=project(u.visualX,u.visualY),dist=Math.hypot(px-camera.x-p.x*camera.scale,py-camera.y-p.y*camera.scale+25*camera.scale);if(dist<d){d=dist;closest=u;}}return closest;}
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
 const troops=[];
 for(const u of board.units){
  if(u.health.current<=0&&u.state!=='death')continue;
  const p=project(u.visualX,u.visualY),sx=camera.x+p.x*camera.scale,sy=camera.y+p.y*camera.scale;
  if(sx< -100||sx>w+100||sy< -100||sy>h+100)continue;
  troops.push(u);
 }
 troops.sort((a,b)=>a.visualX+a.visualY-b.visualX-b.visualY||a.id-b.id);
 visibleTroops=troops.length;
 const distant=low||camera.scale<.12||(board.units.length>280&&camera.scale<.45);
 const squadIndex=squadsFor(board),shotStamp=renderedFrames+1;
 for(const u of troops){const p=project(u.visualX,u.visualY);
  ctx.save();ctx.translate(p.x,p.y);
  if(selected.has(u.squadId)&&u.health.current>0){ctx.strokeStyle=colors.A;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,23,12,0,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#10161999';ctx.beginPath();ctx.ellipse(0,0,17,7,0,0,Math.PI*2);ctx.fill();
  const s=squadIndex.get(u.squadId),rank=s?.leaderId===u.id?(match.squadIds[u.team][0]===u.squadId?'captain':'sergeant'):'private';
  const state=u.state==='walk'?'walk':u.state==='attack'?'shoot':u.state==='hit'?'hit':u.state==='death'?'death':match.phase==='battle'?'guard':'idle';
  const shot=state==='shoot',orientation=shot?firingOrientation(board,u):null;
  const facing=orientation?.facing??u.facing,rawAim=shot?orientation.aim:0;
  // Smooth view-only stance changes; simulation and authoritative attack timing stay untouched.
  const view=u._visualStance??(u._visualStance={blend:0,walk:state==='walk'?1:0,crouch:0,aim:rawAim,time:board.time});
  const delta=Math.max(0,Math.min(.1,board.time-view.time));view.time=board.time;
  const targetBlend=shot?1:state==='guard'?.63:0;
  view.blend+=(targetBlend-view.blend)*(1-Math.exp(-delta/.11));
  view.walk+=((state==='walk'?1:0)-view.walk)*(1-Math.exp(-delta/.12));
  // All idle troops brace once battle begins, without waiting for their first hit or shot.
  const braceTarget=state==='guard'?1:0;
  view.crouch+=(braceTarget-view.crouch)*(1-Math.exp(-delta/.24));
  const difference=Math.atan2(Math.sin(rawAim-view.aim),Math.cos(rawAim-view.aim));
  view.aim+=difference*Math.min(1,delta/.13);
  const hitReaction=Math.max(0,Math.min(1,((u.hitPulseUntil??-1)-board.time)/.16));
  const pose=distant&&state!=='death'
   ?{state:shot?'shoot':state==='guard'?'guard':'idle',time:shot?Math.min(u.elapsed,.04):0,gaitTime:0,moving:false,facing,phase:0,aim:Math.round(rawAim*4)/4,fireAt:shot?u.strike?.impactTime??0:0,shootBlend:shot?1:state==='guard'?.63:0,walkBlend:0,crouchBlend:state==='guard'?1:0}
   :{state,time:state==='shoot'||state==='death'?u.elapsed:board.time,gaitTime:board.time,moving:!!u.step,facing:u.facing,phase:(u.id%4)*.6,facing,aim:view.aim,fireAt:shot?u.strike?.impactTime??0:0,shootBlend:view.blend,walkBlend:view.walk,crouchBlend:view.crouch,hitReaction};
  const muzzle=shot?(u._shotMuzzle??(u._shotMuzzle={})):null;
  if(muzzle)muzzle.valid=false;
  if(!soldiers.draw(ctx,u.team,rank,{...pose,muzzleOut:muzzle,pixelDensity:camera.scale*drawDpr*.285*1.8},distant)){
   ctx.fillStyle=colors[u.team];ctx.fillRect(-8,-37,16,30);
  }
  if(shot)u._shotMuzzleStamp=muzzle.valid?shotStamp:-1;
  ctx.restore();
 }
 drawSquadTeamFlags(ctx,board,camera.scale,camera,w,h,[...selected]);
 drawBattleEffects(ctx,board,shotStamp);ctx.restore();
}
function paintMini(){
 const key=board.terrainRevision+':'+board.obstacleRevision;
 if(!miniGround||miniGround.board!==board||miniGround.key!==key){
  const bitmap=document.createElement('canvas');bitmap.width=mini.width;bitmap.height=mini.height;
  const background=bitmap.getContext('2d'),sx=mini.width/board.width,sy=mini.height/board.height;
  background.fillStyle='#30383b';background.fillRect(0,0,mini.width,mini.height);
  // Sampling work stays bounded as map dimensions grow.
  const step=Math.max(2,Math.ceil(board.width/180),Math.ceil(board.height/126));
  for(let y=0;y<board.height;y+=step)for(let x=0;x<board.width;x+=step){
   const t=board.terrain[y][x];if(t==='void')continue;
   background.fillStyle=t==='forest'?'#43616b':t==='soil'?'#666762':'#777e7a';
   background.fillRect(x*sx,y*sy,Math.ceil(sx*step),Math.ceil(sy*step));
  }
  miniGround={board,key,bitmap};
 }
 mctx.drawImage(miniGround.bitmap,0,0);
 const sx=mini.width/board.width,sy=mini.height/board.height;
 for(const u of board.units)if(u.health.current>0){mctx.fillStyle=colors[u.team];mctx.fillRect(u.x*sx-1,u.y*sy-1,3,3);}
}
// Persistent cards from the original FlowerWars roster approach: create once, update fields.
const rosterCards=new Map();
let rosterEpoch=null;
const PHASES={forming:'진형 형성 중',moving:'이동 중',flanking:'우회 중',attacking:'공격 중',holding:'사수',stopped:'정지',arrived:'도착',complete:'완료','target-lost':'대상 소실',blocked:'경로 대기',reforming:'재집결 중'};
const ACTION_NAMES=Object.fromEntries(Object.entries(SQUAD_ACTIONS).map(([k,v])=>[k,v.label]));
const phaseName=s=>PHASES[s?.order?.phase]||ACTION_NAMES[s?.order?.type]||'대기';
function roster(){
 document.body.dataset.selected=String(selected.size>0);
 const host=$('squad-tabs'),all=squads();
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
   pick.onclick=()=>{selected=new Set(all.slice(platoonId*2,platoonId*2+2).map(s=>s.id));roster();hud();};
   const fold=document.createElement('button');fold.className='platoon-fold';fold.innerHTML=icon('chevron');
   fold.setAttribute('aria-label',(platoonId+1)+'소대 접기');fold.setAttribute('aria-expanded','true');
   const row=document.createElement('div');row.className='platoon-squads';
   fold.onclick=()=>{const collapsed=row.hidden=!row.hidden;fold.setAttribute('aria-expanded',String(!collapsed));};
   head.append(pick,fold);section.append(head,row);host.append(section);
  }
  const row=section.querySelector('.platoon-squads');
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
   const statusText=n+'/'+s.memberIds.length+' · '+(s.order?.after?'우회 → 공격':phase);
   if(node.status.textContent!==statusText)node.status.textContent=statusText;
   const type=s.order?.type||'wait';
   if(node.activityType!==type){node.activity.innerHTML=icon(type);node.activityType=type;}
   const target=s.order?.target;
   const dest=target?.x!=null?' → '+(target.x+1)+','+(target.y+1):target?.unitId?' → 적 병사':'';
   node.activity.title=(ACTION_NAMES[type]||'대기')+' · '+phase+dest;
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
 document.body.dataset.annihilated=String(match.phase!=='preparation'&&match.counts.A===0);
 document.body.dataset.phase=match.phase==='finished'?'battle':match.phase;$('match-phase').textContent=match.phase==='preparation'?'병력 배치':match.phase==='battle'?'전투 중':'전투 종료';
 const time=match.phase==='preparation'?match.remaining:match.elapsed,clock=String(Math.floor(time/60)).padStart(2,'0')+':'+String(Math.floor(time%60)).padStart(2,'0');
 $('preparation-clock').textContent=clock;$('clock').textContent=clock;$('forces').textContent='아르켄 '+match.counts.A+' : '+match.counts.B+' 벨리안';$('army-a').textContent=match.counts.A;$('army-b').textContent=match.counts.B;
 $('deployment-reserve').textContent='예비 '+match.reserve.A+'명 · 배치 '+match.counts.A+'명';
 $('army-size').disabled=match.phase!=='preparation';
 $('start-battle').hidden=match.phase!=='preparation';$('match-charge').hidden=match.phase!=='battle';$('auto-deploy').hidden=match.phase!=='preparation'||match.reserve.A===0;$('deployment-toggle').hidden=match.phase!=='preparation';
 const ids=selectedIds(),s=squadsFor(board).get(ids[0]);$('squad-name').textContent=ids.length>1?ids.length+'개 분대 선택':s?'제'+(s.matchIndex+1)+'분대 · '+living(s).length+'명':'분대 지휘';
 $('squad-info').textContent=s?phaseName(s):'';$('objective').textContent='적 지휘소 점령 또는 적군 전멸';
 if(match.phase==='finished'&&$('result').hidden){$('result').hidden=false;$('result').querySelector('h1').textContent=match.winner==='A'?'아르켄 승리':'벨리안 승리';$('result').querySelector('p').textContent='전투 종료';}
}
function bind(){
 const sizeSelect=$('army-size');sizeSelect.value=String(armySize);
 sizeSelect.onchange=()=>{const next=Number(sizeSelect.value);if(!ASHEN_ARMY_CHOICES.includes(next))return;
  if(match.phase!=='preparation'){sizeSelect.value=String(armySize);notice('전투 종료 후 새 전투에서 병력 수를 변경하세요');return;}
  const reset=match.counts.A>0||match.counts.B>0;
  armySize=next;restart();sizeSelect.value=String(next);notice('진영당 '+next+'명 · 소총보병 '+(next/10)+'개 분대'+(reset?' · 기존 배치 초기화':''));};
 $('start-battle').onclick=start;$('auto-deploy').onclick=autoDeploy;$('deployment-toggle').onclick=()=>switchMode(playMode==='deploy'?'control':'deploy');
 for(const b of $('deployment-types').querySelectorAll('[data-deploy-type]'))b.onclick=()=>{deployFormation=b.dataset.deployType;switchMode('deploy');for(const v of $('deployment-types').querySelectorAll('button'))v.setAttribute('aria-pressed',String(v===b));};
 for(const name of ['move','attack','flank'])$(name).onclick=()=>setCommand(mode===name?null:name);
 $('hold').onclick=()=>command('hold');$('rally').onclick=()=>command('rally');
 $('withdraw').onclick=()=>command('retreat',{x:match.flags.A.x,y:match.flags.A.y});
 $('command-all').onclick=()=>{selected=new Set(squads().map(s=>s.id));command('advance',{x:match.flags.B.x,y:match.flags.B.y});roster();};
 $('match-charge').onclick=()=>$('command-all').click();
 for(const [id,name] of [['move','advance'],['attack','focus'],['flank','flank'],['hold','hold'],['rally','rally']])$(id).innerHTML=icon(name)+'<span>'+$(id).textContent+'</span>';
 const formations={line:'횡대',column:'종대',dense:'밀집',spread:'산개',square:'방진'};
 for(const [name,label]of Object.entries(formations)){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{for(const id of selectedIds())configureSquad(board,id,{formation:name});$('formation-panel').hidden=true;};$('formation-controls').append(b);}
 $('formation-toggle').onclick=()=>{const panel=$('formation-panel');panel.hidden=!panel.hidden;$('formation-toggle').setAttribute('aria-expanded',String(!panel.hidden));};
 $('cancel').onclick=()=>setCommand(null);$('orders-toggle').onclick=()=>{const dock=$('command-dock'),expanded=dock.classList.toggle('is-expanded');$('orders-toggle').setAttribute('aria-expanded',String(expanded));};
 $('multi-select').onclick=()=>{additive=!additive;$('multi-select').setAttribute('aria-pressed',String(additive));};
 $('clear-selection').onclick=()=>choose(null);$('select-all').onclick=()=>{selected=new Set(squads().map(s=>s.id));roster();hud();};
 $('select-squad').onclick=()=>document.body.classList.toggle('roster-open');
 $('close-roster').onclick=()=>document.body.classList.remove('roster-open');
 $('selection-platoon').onclick=()=>{const ss=squads(),n=ss.findIndex(s=>selected.has(s.id));if(n>=0){selected=new Set(ss.slice(Math.floor(n/2)*2,Math.floor(n/2)*2+2).map(s=>s.id));roster();}};
 $('selection-locate').onclick=()=>{const members=selectedIds().flatMap(id=>living(squadsFor(board).get(id)));if(members.length)focus(members.reduce((s,u)=>s+u.x,0)/members.length,members.reduce((s,u)=>s+u.y,0)/members.length);};
 $('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);$('fit-view').onclick=fit;
 $('focus-objective').onclick=()=>focus(match.flags.B.x,match.flags.B.y);$('focus-squad').onclick=()=>$('selection-locate').click();
 $('home-view').onclick=()=>focus(match.flags.A.x,match.flags.A.y);$('enemy-view').onclick=()=>focus(match.flags.B.x,match.flags.B.y);
 $('toggle-map').onclick=()=>{if(document.body.classList.toggle('map-open'))paintMini();};
 $('tools-toggle').onclick=()=>{$('game-tools').hidden=!$('game-tools').hidden;};
 $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';};
 $('restart').onclick=restart;$('play-again').onclick=restart;
 $('low-mode').onchange=e=>{low=e.target.checked;resize();};
 $('support').disabled=true;$('support').title='초기 이식판: 포격은 후속 작업';
 canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(e.deltaY<0?1.13:.89,e.clientX-r.left,e.clientY-r.top);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,multi:pointers.size>0});if(pointers.size>1)for(const p of pointers.values())p.multi=true;});
 canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p){const rect=canvas.getBoundingClientRect();hover=locate(e.clientX-rect.left,e.clientY-rect.top);return;}hover=null;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(pointers.size===1){camera.x+=dx;camera.y+=dy;}else if(pointers.size===2){const other=[...pointers].find(([id])=>id!==e.pointerId)?.[1];if(other){const a=Math.hypot(p.x-other.x,p.y-other.y),b=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(a>10&&b>10){const r=canvas.getBoundingClientRect();zoom(b/a,(e.clientX+other.x)/2-r.left,(e.clientY+other.y)/2-r.top);}}}p.x=e.clientX;p.y=e.clientY;});
 const end=e=>{const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(e.type==='pointerup'&&!p.multi&&Math.hypot(e.clientX-p.ox,e.clientY-p.oy)<7){const r=canvas.getBoundingClientRect();tap(e.clientX-r.left,e.clientY-r.top,e.shiftKey);}};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('pointerleave',()=>{hover=null;});
 mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect();focus((e.clientX-r.left)/r.width*board.width,(e.clientY-r.top)/r.height*board.height);});
 addEventListener('resize',resize);document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;const key=e.key.toLowerCase();if(key==='m')setCommand('move');if(key==='a')setCommand('attack');if(key==='h')$('hold').click();if(key==='escape')setCommand(null);if(key===' '){e.preventDefault();$('pause').click();}});
}
function frame(t){const dt=last?Math.min((t-last)/1000,.1):0;last=t;
 if(!paused&&dt){board.update(Math.min(dt,.05));match.update(dt);if(t-lastOrders>=50){updateSquadOrders(board);lastOrders=t;}}
 if(t-lastPaint>=33){const begin=performance.now();paint();const ms=performance.now()-begin;if(renderSamples.length>=90)renderSamples.shift();renderSamples.push(ms);renderedFrames++;lastPaint=t;}if(t-lastUI>=250){hud();lastUI=t;}if(t-lastRoster>=800){roster();lastRoster=t;}if(t-lastMini>=500){if(document.body.classList.contains('map-open'))paintMini();lastMini=t;}
 requestAnimationFrame(frame);
}
bind();resize();fit();switchMode('deploy');hud();roster();requestAnimationFrame(frame);
window.__ashenFlower={get board(){return board;},get match(){return match;},get flagsLoaded(){return Object.values(FLAG_IMAGES).every(i=>i.complete&&i.naturalWidth>0);},get armySize(){return armySize;},get renderStats(){const samples=[...renderSamples].sort((a,b)=>a-b);const sum=samples.reduce((n,v)=>n+v,0);return {frames:renderedFrames,visibleTroops,avgMs:sum/(samples.length||1),p95Ms:samples[Math.floor((samples.length-1)*.95)]||0,terrainRebuilds:terrainArt.rebuilds,terrainCacheHits:terrainArt.cacheHits,terrainZoomReuses:terrainArt.zoomReuses,terrainEvictions:terrainArt.evictions,terrainPages:terrainArt.pages.length,terrainCacheBytes:terrainArt.cacheBytes,terrainVisibleTiles:terrainArt.cache?.tiles??0,spriteCache:soldiers.stats};},autoDeploy,start,order:(ids,act,target)=>orderSquads(board,ids,act,target)};
