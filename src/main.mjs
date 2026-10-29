import {createMap} from './sim/world.mjs';
import {createMatch,tick,FixedClock,checksum} from './sim/engine.mjs';import {command} from './sim/commands.mjs';import {visibleEnemies} from './sim/combat.mjs';import {unitFoot,project,toScreen,pickTile} from './render/projection.mjs';import {Scene,Overview} from './render/scene.mjs';import {bindCamera} from './ui/controls.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),debug=params.get('debug')==='1';
const seed=Number(params.get('seed'))||1977;
let w=createMatch({seed,scenario:'war'}),selected=1,mode=null,paused=false,clock=new FixedClock(),visible=new Map(),lastVisibility=-1,lastUI=0,previous=performance.now(),lastFrame=previous,activeSector=0;
const camera={x:0,y:0,zoom:innerWidth<600?.36:.5},scene=new Scene($('battlefield')),overview=new Overview($('overview')),timings=[],frames=[],renderTimes=[],longTasks=[];
if(debug && typeof PerformanceObserver!=='undefined')try{new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({start:e.startTime,duration:e.duration});if(longTasks.length>300)longTasks.splice(0,longTasks.length-300);}).observe({type:'longtask',buffered:true});}catch{}
w.telemetry=debug;
function message(text){$('status').textContent=text;}
function focus(x,y){scene.resize();const p=project(x,y,w.map.floorLevel[Math.round(y)*w.map.width+Math.round(x)]??1);camera.x=scene.width/2-p.x*camera.zoom;camera.y=scene.height/2-p.y*camera.zoom;}
function focusSquad(){if(w.objectives.length>1)$('objective').textContent=w.objectives.map((v,n)=>`${n===activeSector?'▸':''}${['북부','중앙','남부'][n]} ${v.contested?'경합':v.owner??'—'}`).join(' · ');
 const s=w.squads[selected-1],live=s.unitIds.map(id=>w.units[id-1]).filter(u=>u.hp>0);if(live.length)focus(live.reduce((a,u)=>a+u.x,0)/live.length,live.reduce((a,u)=>a+u.y,0)/live.length);}
function focusObjective(){const o=w.objectives[activeSector];focus(o.center%w.map.width,Math.floor(o.center/w.map.width));}
function setMode(next){mode=next;for(const id of ['move','support'])$(id).classList.toggle('active',mode===id);message(mode==='move'?'이동 목적지를 터치하세요 · 드래그와 핀치는 명령을 내리지 않습니다':mode==='support'?'반경 3칸 지원 · 아군도 피해 · 아군 시야 내 지역을 터치하세요':'분대 선택 → 이동 → 목적지 터치 · 드래그로 전장 이동');}
function issue(c){const result=command(w,'A',c);window.lastResolvedOrder={...c,elevation:w.map.floorLevel[c.target],orderId:result.orderId};message(result.ok?'명령 전달됨':result.reason);return result;}
function select(id,center=false){if(w.squads[id-1]?.team!=='A')return;selected=id;setMode(null);if(center)focusSquad();refreshHUD();}
const input=bindCamera($('battlefield'),camera,{changed(){},tap(x,y){const i=pickTile(w.map,x,y,camera);if(i<0){message('전장 밖입니다');return;}
 if(mode==='move'){const r=issue({type:'move',squadId:selected,target:i});if(r.ok){setMode(null);message('이동 명령 전달됨');}return;}
 if(mode==='support'){const r=issue({type:'support',target:i});if(r.ok){setMode(null);message('지역 지원 적용됨 · 아군도 피해를 받습니다');}refreshHUD();return;}
 let best=null,dist=30;
 for(const u of w.units)if(u.hp>0&&u.team==='A'){const p=toScreen(unitFoot(w.map,u,Math.min(1,clock.backlog/50)),camera),d=Math.hypot(p.x-x,p.y-y-18*camera.zoom);if(d<dist){best=u;dist=d;}}
 if(best)select(best.squadId);else if(debug)message(`셀 ${i%w.map.width},${Math.floor(i/w.map.width)} · H${w.map.floorLevel[i]} · 엄폐 ${w.map.coverMask[i]} · 경사 ${w.map.transitionMask[i]}`);
}});
function buildTabs(){const tabs=$('squad-tabs');tabs.replaceChildren();for(const s of w.squads)if(s.team==='A'){const b=document.createElement('button');b.id='squad-'+s.id;b.onclick=()=>select(s.id,true);tabs.append(b);}}
$('move').onclick=()=>setMode(mode==='move'?null:'move');$('cancel').onclick=()=>setMode(null);
$('hold').onclick=()=>{setMode(null);issue({type:'hold',squadId:selected});refreshHUD();};
$('rally').onclick=()=>{setMode(null);const o=w.objectives[activeSector];issue({type:'rally',squadId:selected,target:o.center,radius:4});refreshHUD();};
$('support').onclick=()=>setMode(mode==='support'?null:'support');
$('zoom-in').onclick=()=>input.zoom(camera.zoom*1.2);$('zoom-out').onclick=()=>input.zoom(camera.zoom/1.2);$('focus-objective').onclick=()=>{if(w.objectives.length>1)activeSector=(activeSector+1)%w.objectives.length;focusObjective();refreshHUD();};$('focus-squad').onclick=focusSquad;
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';message(paused?'일시정지 · 명령은 다음 시뮬레이션 틱부터 적용됩니다':'전투 진행 중');};
function restart(){w=createMatch({seed,scenario:'war'});selected=1;activeSector=0;mode=null;paused=false;clock=new FixedClock();visible.clear();lastVisibility=-1;$('result').hidden=true;$('pause').textContent='Ⅱ';buildTabs();focusSquad();setMode(null);refreshHUD();}
$('restart').onclick=restart;$('play-again').onclick=restart;$('low-mode').onchange=e=>{scene.low=e.target.checked;message(scene.low?'절전: DPR 1 · 시각 효과 생략 · 게임 규칙 동일':'표준 렌더링');};
$('overview').addEventListener('pointerdown',e=>{const r=e.currentTarget.getBoundingClientRect();focus(Math.min(w.map.width-1,Math.max(0,(e.clientX-r.left)/r.width*w.map.width)),Math.min(w.map.height-1,Math.max(0,(e.clientY-r.top)/r.height*w.map.height)));});
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();if(k==='m')$('move').click();if(k==='h')$('hold').click();if(k==='r')$('rally').click();if(k==='escape')setMode(null);if(k===' '){e.preventDefault();$('pause').click();}if(k==='+'||k==='=')$('zoom-in').click();if(k==='-')$('zoom-out').click();if(/[1-9]/.test(k)&&k.length===1)select(Number(k),true);const directions={arrowleft:[50,0],arrowright:[-50,0],arrowup:[0,50],arrowdown:[0,-50]};if(directions[k]){e.preventDefault();camera.x+=directions[k][0];camera.y+=directions[k][1];}});
addEventListener('resize',()=>{scene.resize();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused){paused=true;$('pause').textContent='▶';message('화면이 숨겨져 전투를 일시정지했습니다');}previous=performance.now();});
const quantile=(a,q)=>a.length?[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*q)]:0;
function refreshHUD(){
 const living=team=>w.units.filter(u=>u.team===team&&u.hp>0).length;const elapsed=Math.floor(w.tick/20);$('clock').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');$('forces').textContent=`A ${living('A')} : ${living('B')} B`;
 const resource=w.support.A;$('support').disabled=resource.uses===0||w.tick<resource.nextTick;$('support').innerHTML=`지원 <small>${resource.uses}회${w.tick<resource.nextTick?' · '+Math.ceil((resource.nextTick-w.tick)/20)+'초':''}</small>`;
 $('objective').textContent=w.scenario==='war'?'적 지휘소 점령 · 전멸 시 승리': '전략 거점';
 const s=w.squads[selected-1],live=s.unitIds.filter(id=>w.units[id-1].hp>0).length;$('squad-name').textContent=`${selected} 분대 · ${live}/10`;
 const names={hold:'대기',move:'이동',rally:'집결',withdraw:'철수'},reasons={suppressed:'제압 중 · 회복 대기',congestion:'혼잡 · 우회 중',no_route:'경로 없음'};$('squad-info').textContent=`#${s.orderId??0} ${s.status??names[s.order]} ${s.arrivedCount??0}/${live}${s.reason?' · '+s.reason:''}`;$('suppression-label').textContent=`제압 ${Math.round(s.suppression)}`;$('suppression-bar').style.width=s.suppression+'%';
 for(const v of w.squads)if(v.team==='A'){const b=$('squad-'+v.id),n=v.unitIds.filter(id=>w.units[id-1].hp>0).length;b.textContent=`${v.id}분대 ${n}`;b.disabled=!n;b.classList.toggle('active',v.id===selected);}
 if(w.winner){$('result').hidden=false;$('result').querySelector('h1').textContent=w.winner==='A'?'전선 확보':w.winner==='B'?'전선 상실':'무승부';$('result').querySelector('p').textContent=`전투 종료 · ${$('clock').textContent}\n잔존 병력 A ${living('A')} / B ${living('B')} · 지휘소 점령 / 전투 가능 병력 소멸`;}
 if(debug){$('debug').hidden=false;$('debug').textContent=`${(1000/(frames.reduce((a,b)=>a+b,0)/Math.max(1,frames.length))).toFixed(0)} FPS · tick ${w.tick}\nsim p95 ${quantile(timings,.95).toFixed(2)}ms\nnav ${w.metrics.navExpansions}/2048 · queue ${w.navigation.pending}\nrender ${scene.rendered}/${living('A')+living('B')} · cache ${scene.terrain.rebuilds}\nbacklog ${clock.backlog.toFixed(0)}ms · zoom ${camera.zoom.toFixed(2)}`;}
}
function updateVisibility(){if(w.tick===lastVisibility)return;if(w.tick%5===0||lastVisibility<0){visible=new Map(visibleEnemies(w,'A').map(u=>[u.id,u]));lastVisibility=w.tick;}}
function draw(){updateVisibility();scene.draw(w,camera,selected,visible,Math.min(1,clock.backlog/50));overview.draw(w,camera,scene.width,scene.height,visible);}
function frame(now){const elapsed=now-previous;previous=now;frames.push(now-lastFrame);lastFrame=now;if(frames.length>180)frames.shift();
 if(!paused&&!w.winner)clock.advance(elapsed,()=>{const start=performance.now();tick(w);timings.push(performance.now()-start);if(timings.length>600)timings.shift();});
 const drawStart=performance.now();draw();renderTimes.push(performance.now()-drawStart);if(renderTimes.length>600)renderTimes.shift();if(now-lastUI>100){refreshHUD();lastUI=now;}requestAnimationFrame(frame);
}
buildTabs();focusSquad();refreshHUD();requestAnimationFrame(frame);
if(debug)window.__ashen={get state(){return w;},camera,scene,get clock(){return clock;},get visible(){return visible;},screenCell(x,y){return toScreen(project(x,y,w.map.floorLevel[y*w.map.width+x]),camera);},step(n){for(let i=0;i<n&&!w.winner;i++)tick(w);updateVisibility();draw();refreshHUD();return checksum(w);},finishMatch(){w.botTeams=['A','B'];while(!w.winner)tick(w);draw();refreshHUD();return checksum(w);},focus,resetStats(){timings.length=0;renderTimes.length=0;frames.length=0;longTasks.length=0;},loadFixture(size){if(![64,128,256].includes(size))throw Error('Unknown fixture');w=createMatch({seed,scenario:'war',map:createMap(size,size*3/4),squadsPerTeam:size===64?4:size===128?9:18,sectors:size===64?1:3,botTeams:['A','B']});selected=1;activeSector=0;clock=new FixedClock();visible.clear();lastVisibility=-1;paused=false;$('result').hidden=true;buildTabs();focusObjective();refreshHUD();return w.units.length;},stats(){return{renderP95:quantile(renderTimes,.95),renderP99:quantile(renderTimes,.99),longTasks,simP95:quantile(timings,.95),simP99:quantile(timings,.99),frameP95:quantile(frames,.95),rendered:scene.rendered,cacheBuilds:scene.terrain.rebuilds};}};
