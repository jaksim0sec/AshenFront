import {createDeployment,deployNext,autoDeploy,beginBattle} from '../sim/deployment.mjs';
const $=id=>document.getElementById(id);
const labels={line:'횡대',column:'종대',square:'방진',spread:'산개'};
/** Offline match lifecycle adapted from FlowerWars' FlagMatch/deployment UI. */
export class MatchFlow {
 constructor(world,{changed,started,control}){this.world=world;this.changed=changed;this.started=started;this.control=control;this.reset(world);
  $('start-battle').onclick=()=>this.start();$('auto-deploy').onclick=()=>{const result=autoDeploy(this.world,this.preparation);this.notice(result.ok?'남은 분대를 자동 배치했습니다':this.reason(result.reason));this.changed();if(!this.preparation.remaining)this.setMode('control');this.render();};
  $('deployment-toggle').onclick=()=>this.setMode(this.mode==='deploy'?'control':'deploy');
  for(const b of $('deployment-types').querySelectorAll('[data-deploy-type]'))b.onclick=()=>{this.formation=b.dataset.deployType;this.setMode('deploy');};
 }
 reset(world){this.world=world;this.preparation=createDeployment(world);this.mode='deploy';this.formation='line';this.remainingSeconds=300;this.render();}
 setMode(mode){this.mode=mode==='deploy'&&this.preparation.remaining>0?'deploy':'control';document.body.dataset.playMode=this.mode;if(this.mode==='control')this.control();this.render();}
 place(target){if(this.mode!=='deploy')return false;const r=deployNext(this.world,this.preparation,target,this.formation);this.notice(r.ok?`${r.placed}명 배치 · 예비 ${this.preparation.remaining}명`:this.reason(r.reason));if(r.ok){this.changed(r.squadId);if(!this.preparation.remaining)this.setMode('control');}this.render();return r.ok;}
 start(){if(this.preparation.phase!=='preparation')return;const r=beginBattle(this.world,this.preparation);if(!r.ok){this.notice(this.reason(r.reason));return;}this.mode='control';this.changed();this.started();this.notice('전투 시작 · 분대를 선택해 지휘하세요');this.render();}
 update(seconds,paused){const before=Math.ceil(this.remainingSeconds);if(this.preparation.phase==='preparation'&&!paused){this.remainingSeconds=Math.max(0,this.remainingSeconds-seconds);if(this.remainingSeconds===0)this.start();}if(before!==Math.ceil(this.remainingSeconds)||this.lastWinner!==this.world.winner)this.render();}
 bindBattleWorld(world){this.world=world;this.preparation={phase:'battle',total:world.units.filter(u=>u.team==='A').length,deployed:world.units.filter(u=>u.team==='A'&&u.hp>0).length,remaining:0};this.mode='control';this.render();}
 notice(text){$('battle-notice').textContent=text;}
 reason(reason){return ({outside_territory:'아군 진영 안에 배치하세요',blocked:'장애물에는 배치할 수 없습니다',occupied:'다른 병력과 겹칩니다',no_reserves:'예비 병력이 없습니다'})[reason]??'이곳에는 분대가 들어갈 공간이 없습니다. 아군 진영의 빈 땅을 선택하세요';}
 render(){this.lastWinner=this.world.winner;const prep=this.preparation;if(!prep)return;document.body.dataset.phase=prep.phase;document.body.dataset.playMode=this.mode;$('deployment-toggle').setAttribute('aria-pressed',String(this.mode==='control'));$('match-phase').textContent=this.world.winner?'전투 종료':prep.phase==='preparation'?'병력 배치 · 준비':'전투 중';$('preparation-clock').textContent=prep.phase==='preparation'?`${Math.floor(this.remainingSeconds/60)}:${String(Math.floor(this.remainingSeconds%60)).padStart(2,'0')}`:'';$('start-battle').hidden=prep.phase!=='preparation';$('deployment-reserve').textContent=`예비 ${prep.remaining}명 · 배치 ${prep.deployed}명`;$('deployment-toggle').textContent=this.mode==='deploy'?'지휘 모드':'배치 모드';$('auto-deploy').hidden=prep.phase!=='preparation'||!prep.remaining;$('deployment-toggle').hidden=prep.phase!=='preparation';$('match-charge').hidden=prep.phase!=='battle';for(const b of $('deployment-types').querySelectorAll('[data-deploy-type]')){b.classList.toggle('active',b.dataset.deployType===this.formation);b.setAttribute('aria-pressed',String(b.dataset.deployType===this.formation));b.disabled=!prep.remaining;}if(!$('battle-notice').textContent)this.notice(`${labels[this.formation]} 선택 → 아군 진영의 빈 땅을 터치해 배치하세요`);}
 get phase(){return this.preparation.phase;}
}
