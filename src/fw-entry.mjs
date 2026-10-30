import {createAshenMatch,autoDeployPlayer} from './fw/ashen-setup.mjs';
import {project,unproject} from './fw/model.mjs';
import {orderSquads,configureSquad,updateSquadOrders} from './fw/squad-orders.mjs';
import {squadsFor} from './fw/unit-groups.mjs';
import {SoldierRenderer} from './characters/renderer.mjs';
import {FLAG_IMAGES,drawHeadquarters,drawBattleEffects} from './fw/visuals.mjs';
import {BattlefieldTerrainRenderer} from './fw/terrain-art.mjs';
import {icon} from './fw/ui-icons.mjs';
import {applyPalette} from './render/palette.mjs';
applyPalette(document.documentElement);
const $=id=>document.getElementById(id),canvas=$('battlefield'),ctx=canvas.getContext('2d'),mini=$('overview'),mctx=mini.getContext('2d');
const terrainArt=new BattlefieldTerrainRenderer();
const soldiers=new SoldierRenderer();soldiers.ready.catch(e=>alert('군복 이미지 오류: '+e.message));
const seed=Number(new URLSearchParams(location.search).get('seed'))||1977;
let {board,match}=createAshenMatch({seed}),selected=new Set(),mode=null,deployFormation='line',playMode='deploy',paused=false,low=false,additive=false;
let last=0,lastPaint=0,lastUI=0,lastRoster=0,lastOrders=0,lastMini=0,drawDpr=1;
const camera={x:0,y:0,scale:.27},pointers=new Map(),colors={A:'#a7c6dd',B:'#d39283'};
const living=s=>s.memberIds.map(id=>board.unit(id)).filter(u=>u?.health.current>0);
const squads=()=>[...squadsFor(board).values()].filter(s=>s.team==='A'&&living(s).length);
const selectedIds=()=>[...selected].filter(id=>squadsFor(board).has(id));
function notice(s){$('battle-notice').textContent=s;$('status').textContent=s;}
function resize(){const r=canvas.getBoundingClientRect();drawDpr=Math.min(low?1:2,devicePixelRatio||1);canvas.width=Math.round(r.width*drawDpr);canvas.height=Math.round(r.height*drawDpr);}
function focus(x,y){const p=project(x,y);camera.x=canvas.clientWidth/2-p.x*camera.scale;camera.y=canvas.clientHeight/2-p.y*camera.scale;}
function fit(){camera.scale=innerWidth<650?.18:.3;focus(board.width*.34,board.height*.5);}
function zoom(ratio,x=canvas.clientWidth/2,y=canvas.clientHeight/2){const scale=Math.min(1.5,Math.max(.07,camera.scale*ratio)),r=scale/camera.scale;camera.x=x-(x-camera.x)*r;camera.y=y-(y-camera.y)*r;camera.scale=scale;}
function switchMode(m){playMode=m;document.body.dataset.playMode=m;$('deployment-toggle').textContent=m==='deploy'?'지휘 모드':'배치 모드';}
function choose(id,more=false){if(!more)selected.clear();if(id){if(more&&selected.has(id))selected.delete(id);else selected.add(id);}document.body.dataset.selected=String(selected.size>0);if(selected.size&&playMode==='deploy')switchMode('control');roster();hud();}
function command(action,target=null){const ids=selectedIds();if(!ids.length){notice('분대를 선택하세요');return false;}const r=orderSquads(board,ids,action,target);const count=r?.accepted?.length||0;notice(count?count+'개 분대 명령 전달':'이동·공격 불가 · 목표를 확인하세요');hud();return count>0;}
function setCommand(m){mode=m;for(const name of ['move','attack','flank'])$(name).classList.toggle('active',name===m);notice(m==='attack'?'공격할 적을 터치하세요':m==='flank'?'우회 위치를 터치하세요':m==='move'?'이동 위치를 터치하세요':'분대를 선택해 명령하세요');}
function deploy(p){const s=match.deploy('A','infantry',p);if(!s){notice('배치 불가 · 진영의 빈 공간을 선택하세요');return;}if(deployFormation!=='line')configureSquad(board,s.id,{formation:deployFormation});notice('제'+match.squadIds.A.length+'분대 배치 · 예비 '+match.reserve.A+'명');if(!match.reserve.A)switchMode('control');roster();hud();}
function autoDeploy(){const r=autoDeployPlayer(match);notice(r.complete?'배치 완료':'배치할 공간이 부족합니다');if(r.complete)switchMode('control');roster();hud();return r.complete;}
function start(){if(match.phase!=='preparation')return;if(!autoDeploy())return;match.start();if(match.phase!=='battle'){notice('전투 시작 실패');return;}switchMode('control');document.body.dataset.phase='battle';if(!selected.size&&squads().length)selected.add(squads()[0].id);notice('전투 시작 · 개나리워즈 원본 지휘 체계 가동');roster();hud();}
function restart(){({board,match}=createAshenMatch({seed}));selected.clear();mode=null;paused=false;last=0;lastOrders=0;lastRoster=0;$('result').hidden=true;$('pause').textContent='Ⅱ';switchMode('deploy');fit();notice('아군 진영에 병력을 배치하세요');roster();hud();}
function locate(px,py){const r=unproject((px-camera.x)/camera.scale,(py-camera.y)/camera.scale),x=Math.round(r.x),y=Math.round(r.y);return board.inside(x,y)?{x,y}:null;}
function hit(px,py){let closest=null,d=25;for(const u of board.units){if(u.health.current<=0)continue;const p=project(u.visualX,u.visualY),dist=Math.hypot(px-camera.x-p.x*camera.scale,py-camera.y-p.y*camera.scale+25*camera.scale);if(dist<d){d=dist;closest=u;}}return closest;}
function tap(px,py,shift=false){const p=locate(px,py);if(!p)return;if(playMode==='deploy'&&match.phase==='preparation'){deploy(p);return;}const u=hit(px,py);
 if(u?.team==='A'&&!mode){choose(u.squadId,shift||additive);return;}
 if(mode==='attack'){if(u?.team==='B'&&command('focus',{unitId:u.id}))setCommand(null);else notice('적군을 선택하세요');return;}
 if(mode==='flank'){if(command('flank',p))setCommand(null);return;}
 if(mode==='move'){if(command('advance',p))setCommand(null);return;}
 if(u?.team==='B')command('focus',{unitId:u.id});else command('advance',p);
}
function paint(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.setTransform(drawDpr,0,0,drawDpr,0,0);ctx.fillStyle='#272e31';ctx.fillRect(0,0,w,h);terrainArt.draw(ctx,board,camera,w,h,drawDpr,low);ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);
 drawHeadquarters(ctx,match.flags,board.time);
 if(playMode==='deploy'&&match.phase==='preparation'){ctx.fillStyle='#adc1d026';for(let y=b.y0;y<=b.y1;y+=3)for(let x=b.x0;x<Math.min(b.x1,board.width/2);x+=3){if(board.navigation.blocked(y*board.width+x))continue;const p=project(x,y);ctx.fillRect(p.x-5,p.y-3,10,6);}}
 for(const id of selected){const s=squadsFor(board).get(id),g=s?.order?.target;if(g?.x===undefined)continue;const members=living(s);if(!members.length)continue;const a=project(members.reduce((v,u)=>v+u.visualX,0)/members.length,members.reduce((v,u)=>v+u.visualY,0)/members.length),p=project(g.x,g.y);ctx.strokeStyle='#d3e8f7aa';ctx.lineWidth=3;ctx.setLineDash([14,10]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);}
 const troops=board.units.filter(u=>u.health.current>0||u.state==='death').sort((a,b)=>a.visualX+a.visualY-b.visualX-b.visualY||a.id-b.id);
 for(const u of troops){const p=project(u.visualX,u.visualY),sx=camera.x+p.x*camera.scale,sy=camera.y+p.y*camera.scale;if(sx< -100||sx>w+100||sy< -100||sy>h+100)continue;
  ctx.save();ctx.translate(p.x,p.y);
  if(selected.has(u.squadId)&&u.health.current>0){ctx.strokeStyle=colors.A;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,23,12,0,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#10161999';ctx.beginPath();ctx.ellipse(0,0,17,7,0,0,Math.PI*2);ctx.fill();
  const s=squadsFor(board).get(u.squadId),rank=s?.leaderId===u.id?(match.squadIds[u.team][0]===u.squadId?'captain':'sergeant'):'private';
  const state=u.state==='walk'?'walk':u.state==='attack'?'shoot':u.state==='hit'?'hit':u.state==='death'?'death':'idle';
  const pose={state,time:state==='shoot'||state==='death'?u.elapsed:board.time,gaitTime:board.time,moving:!!u.step,facing:u.facing,phase:u.id*.3,aim:u.attackVector?Math.atan2(u.attackVector.y,Math.max(.1,Math.abs(u.attackVector.x))):0};
  if(!soldiers.draw(ctx,u.team,rank,pose,low||camera.scale<.23)){ctx.fillStyle=colors[u.team];ctx.fillRect(-8,-37,16,30);}
  ctx.restore();
 }
 drawBattleEffects(ctx,board);ctx.restore();
}
function paintMini(){const sx=mini.width/board.width,sy=mini.height/board.height;mctx.fillStyle='#30383b';mctx.fillRect(0,0,mini.width,mini.height);
 for(let y=0;y<board.height;y+=2)for(let x=0;x<board.width;x+=2){const t=board.terrain[y][x];if(t==='void')continue;mctx.fillStyle=t==='forest'?'#43616b':t==='soil'?'#666762':'#777e7a';mctx.fillRect(x*sx,y*sy,Math.ceil(sx*2),Math.ceil(sy*2));}
 for(const u of board.units)if(u.health.current>0){mctx.fillStyle=colors[u.team];mctx.fillRect(u.x*sx-1,u.y*sy-1,3,3);}
}
function roster(){document.body.dataset.selected=String(selected.size>0);const host=$('squad-tabs');host.replaceChildren();const all=squads();
 for(let i=0;i<all.length;i+=2){
  const section=document.createElement('section'),heading=document.createElement('button');
  heading.className='platoon-title';heading.textContent='제'+(Math.floor(i/2)+1)+'소대 · '+Math.min(2,all.length-i)+'분대';
  heading.onclick=()=>{selected=new Set(all.slice(i,i+2).map(s=>s.id));roster();hud();};section.append(heading);
  const row=document.createElement('div');row.className='platoon-squads';
  for(const s of all.slice(i,i+2)){
   const btn=document.createElement('button');btn.className='squad-card';btn.classList.toggle('active',selected.has(s.id));
   const portrait=document.createElement('canvas');portrait.className='squad-avatar';portrait.width=64;portrait.height=64;
   const body=document.createElement('span');body.className='squad-card-body';
   const title=document.createElement('strong');title.textContent='제'+(s.matchIndex+1)+'분대';
   const count=document.createElement('small');count.textContent=living(s).length+'/10 · '+({advance:'전진',focus:'공격',flank:'우회',rally:'집결',hold:'사수',retreat:'후퇴'}[s.order?.type]||'대기');
   body.append(title,count);btn.append(portrait,body);
   btn.onclick=e=>choose(s.id,e.shiftKey||additive);row.append(btn);
   if(soldiers.loaded){
    const pc=portrait.getContext('2d');
    pc.translate(32,59);pc.scale(.65,.65);
    soldiers.draw(pc,'A',s.matchIndex===0?'captain':'sergeant',{state:'idle',time:0,facing:1},false);
   }
  }
  section.append(row);host.append(section);
 }
}
function hud(){document.body.dataset.phase=match.phase==='finished'?'battle':match.phase;$('match-phase').textContent=match.phase==='preparation'?'병력 배치':match.phase==='battle'?'전투 중':'전투 종료';
 const time=match.phase==='preparation'?match.remaining:match.elapsed,clock=String(Math.floor(time/60)).padStart(2,'0')+':'+String(Math.floor(time%60)).padStart(2,'0');
 $('preparation-clock').textContent=clock;$('clock').textContent=clock;$('forces').textContent='아르켄 '+match.counts.A+' : '+match.counts.B+' 벨리안';$('army-a').textContent=match.counts.A;$('army-b').textContent=match.counts.B;
 $('deployment-reserve').textContent='예비 '+match.reserve.A+'명 · 배치 '+match.counts.A+'명';
 $('start-battle').hidden=match.phase!=='preparation';$('match-charge').hidden=match.phase!=='battle';$('auto-deploy').hidden=match.phase!=='preparation'||match.reserve.A===0;$('deployment-toggle').hidden=match.phase!=='preparation';
 const ids=selectedIds(),s=squadsFor(board).get(ids[0]);$('squad-name').textContent=ids.length>1?ids.length+'개 분대 선택':s?'제'+(s.matchIndex+1)+'분대 · '+living(s).length+'명':'분대 지휘';
 $('squad-info').textContent=s?.order?.type||'';$('objective').textContent='적 지휘소 점령 또는 적군 전멸';
 if(match.phase==='finished'&&$('result').hidden){$('result').hidden=false;$('result').querySelector('h1').textContent=match.winner==='A'?'아르켄 승리':'벨리안 승리';$('result').querySelector('p').textContent='전투 종료';}
}
function bind(){
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
 $('toggle-map').onclick=()=>document.body.classList.toggle('map-open');
 $('tools-toggle').onclick=()=>{$('game-tools').hidden=!$('game-tools').hidden;};
 $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';};
 $('restart').onclick=restart;$('play-again').onclick=restart;
 $('low-mode').onchange=e=>{low=e.target.checked;resize();};
 $('support').disabled=true;$('support').title='초기 이식판: 포격은 후속 작업';
 canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(e.deltaY<0?1.13:.89,e.clientX-r.left,e.clientY-r.top);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,multi:pointers.size>0});if(pointers.size>1)for(const p of pointers.values())p.multi=true;});
 canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(pointers.size===1){camera.x+=dx;camera.y+=dy;}else if(pointers.size===2){const other=[...pointers].find(([id])=>id!==e.pointerId)?.[1];if(other){const a=Math.hypot(p.x-other.x,p.y-other.y),b=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(a>10&&b>10){const r=canvas.getBoundingClientRect();zoom(b/a,(e.clientX+other.x)/2-r.left,(e.clientY+other.y)/2-r.top);}}}p.x=e.clientX;p.y=e.clientY;});
 const end=e=>{const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(e.type==='pointerup'&&!p.multi&&Math.hypot(e.clientX-p.ox,e.clientY-p.oy)<7){const r=canvas.getBoundingClientRect();tap(e.clientX-r.left,e.clientY-r.top,e.shiftKey);}};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect();focus((e.clientX-r.left)/r.width*board.width,(e.clientY-r.top)/r.height*board.height);});
 addEventListener('resize',resize);document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;const key=e.key.toLowerCase();if(key==='m')setCommand('move');if(key==='a')setCommand('attack');if(key==='h')$('hold').click();if(key==='escape')setCommand(null);if(key===' '){e.preventDefault();$('pause').click();}});
}
function frame(t){const dt=last?Math.min((t-last)/1000,.1):0;last=t;
 if(!paused&&dt){board.update(Math.min(dt,.05));match.update(dt);if(t-lastOrders>=50){updateSquadOrders(board);lastOrders=t;}}
 if(t-lastPaint>=33){paint();lastPaint=t;}if(t-lastUI>=250){hud();lastUI=t;}if(t-lastRoster>=800){roster();lastRoster=t;}if(t-lastMini>=500){paintMini();lastMini=t;}
 requestAnimationFrame(frame);
}
bind();resize();fit();switchMode('deploy');hud();roster();requestAnimationFrame(frame);
window.__ashenFlower={get board(){return board;},get match(){return match;},get flagsLoaded(){return Object.values(FLAG_IMAGES).every(i=>i.complete&&i.naturalWidth>0);},autoDeploy,start,order:(ids,act,target)=>orderSquads(board,ids,act,target)};
