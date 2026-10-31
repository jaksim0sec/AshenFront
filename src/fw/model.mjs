import {SpatialIndex} from './spatial-index.mjs';
import {terrainStepMultiplier} from './battlefield-terrain.mjs';
import {healingOptions} from './healing.mjs';
import {mix,movementOptions} from './decision.mjs';
import {combatOptions,inAttackRange,tryAutoAttack,hasLineOfSight,shotHitChance,BASE_ATTACK_DURATION} from './combat.mjs';
import {Navigation,NAV_INTERVAL} from './navigation.mjs';
import {createHealth,advanceHealth,DEATH_DURATION} from './characters/vitality.mjs';
export const HALF_W = 72;
export const HALF_H = 42;
export const BOARD_COLUMNS = 10;
export const BOARD_ROWS = 16;
export const STEP_TIME = 0.34;
export const IMPACT_TIME = 0.3;
const OWN_FLAG_RADIUS=10;
function nearOwnFlag(board,unit,position=unit){
  const flag=board.match?.flags?.[unit.team];
  return !!flag&&flag.health.current>0&&Math.max(Math.abs(position.x-flag.x),Math.abs(position.y-flag.y))<=OWN_FLAG_RADIUS;
}


const SCHOLAR_AURA_RADIUS=4;
function nearAlliedScholar(board,unit){
  if(!unit.team)return false;
  for(const id of board.spatial.candidates(unit.x,unit.y,SCHOLAR_AURA_RADIUS)){
    const scholar=board.unit(id);
    if(scholar?.team===unit.team&&scholar.health.current>0&&scholar.unitType==='scholar'&&
      Math.max(Math.abs(scholar.x-unit.x),Math.abs(scholar.y-unit.y))<=SCHOLAR_AURA_RADIUS)return true;
  }
  return false;
}

export function project(x, y) {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H };
}

// Isometric sprite order follows the projected foot, including during allied passage.
// Never force a passing soldier in front of a physically lower-depth resident.
export function soldierRenderDepth(u){
 return u.visualX+u.visualY;
}
// On the same ground-depth row use screen X rather than spawn order.
// This matters when wide death poses overlap across neighboring diamonds.
export function soldierRenderCompare(a,b){
 return soldierRenderDepth(a)-soldierRenderDepth(b)
  ||(a.visualX-a.visualY)-(b.visualX-b.visualY)
  ||a.id-b.id;
}

export function unproject(x, y) {
  return { x: (x / HALF_W + y / HALF_H) / 2, y: (y / HALF_H - x / HALF_W) / 2 };
}

export function tileAt(px, py, width, height) {
  const p = unproject(px, py);
  const x = Math.floor(p.x + 0.5), y = Math.floor(p.y + 0.5);
  return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
}

export function zoomCamera(camera, anchor, factor, minScale=.1) {
  const scale = Math.min(2.4, Math.max(minScale, camera.scale * factor));
  const ratio = scale / camera.scale;
  return { x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio, scale };
}

export function fitBoardCamera(width, height, columns = BOARD_COLUMNS, rows = BOARD_ROWS) {
  const left = -rows * HALF_W, right = columns * HALF_W;
  // Leave space above back-row units and below the outer stone sidewalls.
  const top = -126, bottom = (columns + rows - 1) * HALF_H + 22;
  const scale = Math.max(.1, Math.min((width - 32) / (right - left), (height - 32) / (bottom - top), 1.1));
  return { x: width / 2 - (left + right) / 2 * scale,
    y: height / 2 - (top + bottom) / 2 * scale, scale };
}

/** Deterministic command model with optional local test combat; no DOM or victory rules. */
export class Board {
  constructor(width = BOARD_COLUMNS, height = BOARD_ROWS, options={}) {
    this.seed=options.seed??1;this.navigationOrientation=1;
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    if(this.movementPolicy?.matchOwner)this.movementPolicy=this.movementPolicy.previousPolicy;
    this.match=null;this.battlefield=null;
    this.terrainRevision=(this.terrainRevision||0)+1;
    this.decisionEpoch=0;
    this.units = []; this.byId=new Map(); this.cells=new Map(); this.reservations=new Map();this.passage=new Map();this.teamAlive={A:0,B:0};
    this.flows={east:0,west:0,south:0,north:0};
    this.obstacles=new Map();this.obstacleRevision=0;this.navClock=0;this.navigation=new Navigation(this);
    this.spatial=new SpatialIndex(this.width,this.height);
    this.combatStats={checks:0,probes:0,attacks:0,hits:0};
    this.effects = []; this.nextId = 1; this.time = 0;
    this.terrain = Array.from({ length: this.height }, (_, y) =>
      Array.from({ length: this.width }, (_, x) => (x === 3 || x === 4 || y === 2 && x > 1 && x < 6) ? 'soil' : 'grass'));
  }
  resize(width,height){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<4||height<4||width>1024||height>1024||this.navigation.collecting)return false;
    const inside=p=>p.x>=0&&p.y>=0&&p.x<width&&p.y<height;
    if(this.units.some(u=>u.health.current>0&&(!inside(u)||u.step&&!inside(u.step)||u.command?.type==='move'&&!inside(u.command))))return false;
    const oldWidth=this.width,terrain=this.terrain,obstacles=this.obstacles;
    this.width=width;this.height=height;this.terrain=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>terrain[y]?.[x]||'grass'));
    this.obstacles=new Map();for(const[n,info]of obstacles){const p={x:n%oldWidth,y:Math.floor(n/oldWidth)};if(inside(p))this.obstacles.set(p.y*width+p.x,info);}
    this.cells=new Map();this.reservations=new Map();this.passage=new Map();this.spatial=new SpatialIndex(width,height);this.navigation=new Navigation(this);this.navClock=0;
    for(const u of this.units){u.guide=[];u.detourPotential=null;u.guideKey=null;u.route=[];if(u.health.current<=0)continue;this.cells.set(u.y*width+u.x,u.id);if(u.step)this.reservations.set(u.step.y*width+u.step.x,u.id);if(u.step?.via){this.passage.set(u.step.via.y*width+u.step.via.x,u.id);if(u.step.buffer)this.passage.set(u.step.buffer.y*width+u.step.buffer.x,u.id);}this.spatial.add(u);this.navigation.touch(u.x,u.y);}
    this.terrainRevision++;this.obstacleRevision++;return true;
  }
  setAutoCombat(enabled=true){
    const alive=this.units.filter(u=>u.health.current>0),counts={A:0,B:0};for(const u of alive)if(u.team in counts)counts[u.team]++;
    for(const u of alive){if(enabled&&!u.team){u.team=counts.A<=counts.B?'A':'B';counts[u.team]++;u.combat.shape='king';}u.combat.auto=!!enabled;if(!enabled&&u.waitReason==='combat')u.waitReason=null;u.combat.targetId=null;u.combat.nextSearchAt=0;}
    this.teamAlive={...counts};
    return alive.length;
  }
  setTerrain(x,y,type) {
    if(!this.inside(x,y)||this.terrain[y][x]==='void'||!['grass','soil','road','forest'].includes(type))return false;
    if(type==='forest'&&this.occupied(x,y))return false;
    const key=y*this.width+x;
    if(type==='forest')this.obstacles.set(key,{kind:'forest',blocked:true});
    else if(this.obstacles.get(key)?.kind==='forest')this.obstacles.delete(key);
    if(this.terrain[y][x]!==type&&(type==='forest'||this.terrain[y][x]==='forest')){this.obstacleRevision++;this.navigation.invalidate();}
    if(this.terrain[y][x]!==type){this.terrain[y][x]=type;this.terrainRevision++;}
    return true;
  }
  inside(x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height; }
  unit(id) { return this.byId.get(id); }
  at(x, y) { if(!this.inside(x,y))return undefined;const u=this.unit(this.cells.get(y*this.width+x));return u?.health.current>0?u:undefined; }
  get busy() { return this.units.some(u => u.state !== 'idle' && u.state !== 'death'); }
  occupied(x,y,except=null) {
    const index=y*this.width+x;
    const owner=this.cells.get(index),reserved=this.reservations.get(index),passing=this.passage.get(index);
    return owner!=null&&owner!==except||reserved!=null&&reserved!==except||passing!=null&&passing!==except;
  }
  setObstacle(x,y,info=null) {
    if(!this.inside(x,y)||info?.blocked!==false&&info&&this.occupied(x,y))return false;
    const index=y*this.width+x;
    if(info)this.obstacles.set(index,{...info});else this.obstacles.delete(index);
    this.obstacleRevision++;this.navigation.invalidate();return true;
  }
  cancelCommand(u) { if(u.courtesy)this.navigation.cancelCooperation(u);if(u.command?.flow)this.flows[u.command.flow]--;if(u.state==='walk'&&!u.step)u.state='idle';u.command=null;u.courtesyReturn=null;u.target=null;u.squadRoute=null;u.sharedLocal=null;u.guide=[];u.guideKey=null;u.staticSearch=null;u.recovery=null;u.recoveryFailure=null;u.yieldUntil=0;u.route=[];u.path=[];u.waitReason=null;u.retryAt=0;u.waitSince=null; }
  interrupt(u){
    this.cancelCommand(u);
    u.combat.retaliation=null;u.combat.formationLocked=false;
    if(u.state==='attack'){u.strike=null;u.impacted=false;u.elapsed=0;u.state=u.step?'walk':'idle';}
  }
  spawn(x, y, character = null, options={}) {
    if(this.match&&(!options.team||(this.teamAlive[options.team]??0)>=this.match.limit))return null;
    if (!this.inside(x, y) || this.navigation.blocked(y*this.width+x) || this.occupied(x, y)) return null;
    const battle=options.battle||Object.values(character?.equipment||{}).find(a=>a?.battle)?.battle;
    if(battle)options={...options,stats:{...options.stats,damage:(options.stats?.damage||25)*(battle.damageMultiplier||1),attackPeriod:battle.attackPeriod||options.stats?.attackPeriod},movement:{...options.movement,stepTime:(options.movement?.stepTime||.425)/(battle.speedMultiplier||1)}};
    const health=character?.health||createHealth();
    if(Number.isFinite(options.stats?.maxHealth)&&options.stats.maxHealth>0)health.current=health.max=options.stats.maxHealth;
    const u = { character, unitType:options.unitType??character?.characterId??null, health, priorityKey:mix(this.seed^Math.imul(this.nextId,0x9e3779b9)),movement:movementOptions(options.movement),capabilities:[...(options.capabilities||[])],team:options.team||null,combat:combatOptions(options),strike:null,
      damage:Number.isFinite(options.stats?.damage)&&options.stats.damage>0?options.stats.damage:25, id: this.nextId++, x, y, visualX: x, visualY: y,
      state: 'idle', elapsed: 0, facing: -1, path: [], target: null, command:null, step:null, route:[], waitReason:null, hits: 0, impacted: false };
    u.healing=healingOptions(options,character);
    if(battle)Object.assign(u.combat,{movingPoise:!!battle.movingPoise,charge:!!battle.charge,visionRange:battle.visionRange||0,activeDuration:battle.activeDuration,impactTime:battle.impactTime});
    if(battle?.charge){u.combat.chargeSteps=0;u.combat.chargeDistance=battle.chargeDistance??4;u.combat.chargeDamageMultiplier=battle.chargeDamageMultiplier??3;}
    this.units.push(u);this.byId.set(u.id,u);this.cells.set(y*this.width+x,u.id);this.spatial.add(u);
    if(u.team in this.teamAlive)this.teamAlive[u.team]++;
    return u;
  }

  batchCommands(callback){
    const nav=this.navigation,outer=nav.collecting;
    if(!outer)nav.startCollection();
    try{return callback();}finally{if(!outer)nav.commit();}
  }
  move(id,x,y,{replace=false,direct=false,plannedPath=null,squadRoute=null,engage=true}={}) {
    const u=this.unit(id);
    if(this.match?.phase==='finished'||this.match?.phase==='preparation'&&u&&!this.match.inTerritory(u.team,{x,y}))return false;
    if(!u||u.structure||u.health.current<=0||!replace&&(u.state!=='idle'||u.step)||!this.inside(x,y)||this.navigation.blocked(y*this.width+x)||u.x===x&&u.y===y&&!u.step)return false;
    if(plannedPath){
      let previous=u.y*this.width+u.x;
      if(!plannedPath.length||plannedPath.at(-1)!==y*this.width+x||!plannedPath.every(n=>{
       const px=n%this.width,py=Math.floor(n/this.width),adjacent=Math.abs(px-previous%this.width)+Math.abs(py-Math.floor(previous/this.width))===1;
       previous=n;return Number.isInteger(n)&&this.inside(px,py)&&adjacent&&!this.navigation.blocked(n)&&!this.occupied(px,py,u.id);
      }))return false;
    }
    const field=direct?null:this.navigation.field(x,y);
    if(field?.complete&&field.at(u.y*this.width+u.x)<0)return false;
    if(replace)this.interrupt(u);else this.cancelCommand(u);const flow=Math.abs(x-u.x)>=Math.abs(y-u.y)?(x>u.x?'east':'west'):(y>u.y?'south':'north');
    u.lastMoveGoal={x,y};u.command={type:'move',x,y,flow,direct,engage};u.squadRoute=squadRoute;this.flows[flow]++;
    if(plannedPath){u.guide=[...plannedPath];u.guideKey=`${x},${y},${this.obstacleRevision}`;}
    this.navigation.plan(u);return true;
  }
  attack(id,targetId,{replace=false}={}) {
    if(this.match&&this.match.phase!=='battle')return false;
    const u=this.unit(id),target=this.unit(targetId);
    if(!u||u.structure||!target||u===target||u.team&&u.team===target.team||u.health.current<=0||target.health.current<=0||!replace&&(u.state!=='idle'||u.step))return false;
    if(replace)this.interrupt(u);else this.cancelCommand(u);u.target=targetId;u.command={type:'attack',target:targetId};this.navigation.plan(u);return true;
  }
  beginStep(u,next) {
    u.hasMoved=true;
    u.state='walk';u.elapsed=0;u.step={...next,elapsed:0,duration:Math.max(u.movement.stepTime,u.marchStepTime||0)*terrainStepMultiplier(this,u,next)/(nearOwnFlag(this,u,next)?1.05:1)};u.path=[next];
    this.reservations.set(next.y*this.width+next.x,u.id);this.spatial.move(u);this.navigation.touch(u.x,u.y);this.navigation.touch(next.x,next.y);
    u.facing=project(next.x-u.x,next.y-u.y).x>=0?1:-1;
  }

  beginPass(u,via,exit,side){
    // Transit keeps the owner in place and reserves the adjacent buffer lane.
    const dx=via.x-u.x,dy=via.y-u.y;
    const buffer={x:via.x-dy*side,y:via.y+dx*side};
    const duration=2*Math.max(u.movement.stepTime,u.marchStepTime||0)*terrainStepMultiplier(this,u,exit);
    u.hasMoved=true;u.state='walk';u.elapsed=0;
    u.step={x:exit.x,y:exit.y,via:{x:via.x,y:via.y},buffer,laneSide:side,elapsed:0,duration};u.path=[via,exit];
    this.passage.set(via.y*this.width+via.x,u.id);
    this.passage.set(buffer.y*this.width+buffer.x,u.id);
    this.reservations.set(exit.y*this.width+exit.x,u.id);
    this.spatial.move(u);this.navigation.touch(u.x,u.y);this.navigation.touch(via.x,via.y);this.navigation.touch(buffer.x,buffer.y);this.navigation.touch(exit.x,exit.y);
    u.facing=project(via.x-u.x,via.y-u.y).x>=0?1:-1;
  }
  inAttackRange(u,target,physical=true){return inAttackRange(u,target,physical);}
  tryAutoAttack(u){return tryAutoAttack(this,u);}
  beginAttack(u,targetId=u.target,automatic=false) {
    if(this.match&&this.match.phase!=='battle')return false;
    const target=this.unit(targetId);
    if(u.structure||!target||target.health.current<=0||u.health.current<=0||u.step||!inAttackRange(u,target,false)||u.team&&u.team===target.team)return false;
    if(this.time+1e-9<u.combat.nextAttackAt)return false;
    u.target=targetId;u.facing=project(target.x-u.visualX,target.y-u.visualY).x>=0?1:-1;
    // Commit a world tile at trigger pull: neither aim nor the tracer homes
    // in on a moving target, and the shot survives target removal.
    u.attackVector=project(target.x-u.visualX,target.y-u.visualY);
    const flagBuff=nearOwnFlag(this,u),scholarBuff=nearAlliedScholar(this,u),period=u.combat.period/((flagBuff?1.2:1)*(scholarBuff?1.1:1));
    const distance=u.combat.shape==='king'
      ?Math.max(Math.abs(target.x-u.visualX),Math.abs(target.y-u.visualY))
      :Math.abs(target.x-u.visualX)+Math.abs(target.y-u.visualY);
    // Resolve dispersion once, at trigger pull, using deterministic shot keys
    // (not frame count or global Math.random). Damage still resolves at impact.
    const shotNumber=(u.combat.shotCount=(u.combat.shotCount||0)+1);
    const roll=mix(this.seed^mix(u.priorityKey??u.id)^Math.imul(shotNumber,0x9e3779b9))/0x100000000;
    u.strike={target:targetId,aimX:target.x,aimY:target.y,hit:roll<shotHitChance(u.combat,distance),automatic,duration:u.combat.activeDuration||period,impactTime:u.combat.impactTime??period*IMPACT_TIME/BASE_ATTACK_DURATION};
    if(u.combat.charge){u.strike.damageMultiplier=u.combat.chargeSteps>=u.combat.chargeDistance?u.combat.chargeDamageMultiplier:1;u.combat.chargeSteps=0;}
    if(flagBuff)u.strike.damageMultiplier=(u.strike.damageMultiplier??1)*1.1;
    u.combat.nextAttackAt=this.time+period;
    u.state='attack';u.hasEngaged=true;u.elapsed=0;u.impacted=false;u.waitReason=null;this.combatStats.attacks++;return true;
  }

  heal(id,amount) {
    const u=this.unit(id);if(!u||u.structure||u.health.current<=0||!Number.isFinite(amount)||amount<=0)return 0;
    const gain=Math.min(amount,u.health.max-u.health.current);u.health.current+=gain;return gain;
  }
  damage(id,amount,direction=1,attackerId=null) {
    const u=this.unit(id);if(!u||u.health.current<=0||!Number.isFinite(amount)||amount<=0)return false;
    if(u.structure==='flag')return this.match?.damageFlag(u.team,amount)||false;
    u.health.current=Math.max(0,u.health.current-amount);u.hits++;u.hasEngaged=true;
    // Poise protects locomotion, never health or a lethal hit.
    if(u.health.current>0&&u.combat.movingPoise&&u.step)return true;
    const attacker=this.unit(attackerId);
    const threatened=attacker?.health.current>0&&attacker.team&&u.team&&attacker.team!==u.team;
    if(threatened){
      // Even a held formation must visibly face the source of incoming fire.
      u.facing=project(attacker.visualX-u.visualX,attacker.visualY-u.visualY).x>=0?1:-1;
      u.alertUntil=this.time+.65;
    }
    if(u.health.current>0&&u.combat.auto&&u.command?.type!=='attack'&&!u.healing&&
        threatened&&Math.max(Math.abs(attacker.x-u.x),Math.abs(attacker.y-u.y))<=12){
      u.combat.retaliation={targetId:attacker.id,until:this.time+5,x:u.x,y:u.y,
        approach:Math.sign(attacker.x-u.x)||this.navigationOrientation};
      u.combat.targetId=attacker.id;u.combat.nextSearchAt=0;u.retryAt=0;
    }
    if(u.courtesy||u.remoteCourtesy)this.navigation.cancelCooperation(u);
    const committed=u.state==='attack'&&u.strike&&u.health.current>0;
    const resume=u.team&&u.command&&u.health.current>0;
    // Ordinary damage must not permanently stun a rifleman under overlapping fire.
    // The hit reaction is visual only. Death still interrupts everything.
    if(u.health.current>0){
      u.lastHitAt=this.time;
      u.hitPulseUntil=this.time+.30;
    }else if(!committed){
      if(!resume)this.cancelCommand(u);
      u.elapsed=0;u.state='death';u.strike=null;
    }else {
      // A lethal shot always wins over an unfinished firing animation.
      u.elapsed=0;u.state='death';u.strike=null;u.impacted=false;
    }
    u.deathDirection=direction;
    if(u.health.current<=0){if(u.team in this.teamAlive)this.teamAlive[u.team]=Math.max(0,this.teamAlive[u.team]-1);this.navigation.touch(u.x,u.y);if(u.step)this.navigation.touch(u.step.x,u.step.y);this.cells.delete(u.y*this.width+u.x);if(u.step)this.reservations.delete(u.step.y*this.width+u.step.x);if(u.step?.via)for(const cell of [u.step.via,u.step.buffer])if(cell&&this.passage.get(cell.y*this.width+cell.x)===u.id){this.passage.delete(cell.y*this.width+cell.x);this.navigation.touch(cell.x,cell.y);}u.step=null;this.spatial.remove(u);}
    return true;
  }
  update(dt) {
    if(this.match?.phase==='finished')return;
    if(!Number.isFinite(dt)||dt<=0)return;
    // Bound event integration, keeping impacts/arrivals consistent for large dt.
    while(dt>1e-9&&this.match?.phase!=='finished'){const slice=Math.min(dt,.05);this.advance(slice);dt-=slice;}
  }
  advance(dt) {
    this.time+=dt;
    for(const e of this.effects)e.age+=dt;
    this.effects=this.effects.filter(e=>e.age<.55);
    for(const u of this.units){u.elapsed+=dt;advanceHealth(u.health,dt);}
    // Commit all arrivals before reserving departures: order cannot cause swaps.
    for(const u of this.units)if(u.step) {
      const p=u.step;p.elapsed+=dt;
      if(p.elapsed+1e-9>=p.duration) {
        this.navigation.touch(u.x,u.y);this.navigation.touch(p.x,p.y);
        this.cells.delete(u.y*this.width+u.x);this.reservations.delete(p.y*this.width+p.x);
        if(p.via)for(const cell of [p.via,p.buffer])if(cell&&this.passage.get(cell.y*this.width+cell.x)===u.id){this.passage.delete(cell.y*this.width+cell.x);this.navigation.touch(cell.x,cell.y);}
        u.x=p.x;u.y=p.y;u.visualX=u.x;u.visualY=u.y;this.cells.set(u.y*this.width+u.x,u.id);
        u.step=null;u.path=[];this.spatial.move(u);
        if(u.combat.charge)u.combat.chargeSteps=Math.min(u.combat.chargeDistance,u.combat.chargeSteps+1);
        if(u.state==='walk'){u.state=u.command?'walk':'idle';u.elapsed=0;}
        this.movementPolicy?.onArrive?.({board:this,unit:u,at:{x:u.x,y:u.y}});
        if(u.command?.type==='move'&&u.x===u.command.x&&u.y===u.command.y){this.cancelCommand(u);if(u.state==='walk')u.state='idle';}
      } else {
        const t=p.elapsed/p.duration;
        if(p.via){
          const first=t<.5,phase=first?t*2:(t-.5)*2,from=first?u:p.via,to=first?p.via:p;
          // Smooth bell: 0 at endpoints, 0.65 tiles at the midpoint, without trig.
          // A body can sit beyond the via tile's half-width because its side
          // neighbor is explicitly reserved as a clearance buffer.
          const inv=1-t,sideways=.65*16*t*t*inv*inv*p.laneSide;
          const dx=p.via.x-u.x,dy=p.via.y-u.y;
          u.visualX=from.x+(to.x-from.x)*phase-dy*sideways;
          u.visualY=from.y+(to.y-from.y)*phase+dx*sideways;
        }else{u.visualX=u.x+(p.x-u.x)*t;u.visualY=u.y+(p.y-u.y)*t;}
      }
    }
    // Commit same-slice strikes before applying damage: neither actor order nor
    // a lethal first entry suppresses the opponent's already committed impact.
    const impacts=[];
    for(const u of this.units) {
      if(u.state==='attack'&&u.strike) {
        const strike=u.strike;
        if(!u.impacted&&u.elapsed+1e-9>=strike.impactTime) {
          u.impacted=true;const target=this.unit(strike.target);
          if(strike.healing){
            if(target?.health.current>0&&target.team===u.team&&Math.max(Math.abs(u.visualX-target.visualX),Math.abs(u.visualY-target.visualY))<=u.healing.range&&hasLineOfSight(this,u,target)){
              const gained=this.heal(target.id,u.healing.amount);
              if(gained)this.effects.push({x:target.visualX,y:target.visualY,age:0,healing:true,amount:gained});
            }
          }else {
            const x=strike.aimX??target?.x,y=strike.aimY??target?.y;
            const victim=Number.isInteger(x)&&Number.isInteger(y)?this.at(x,y):null;
            const tile={visualX:x,visualY:y};
            // The round reaches its original tile, not a target's new location.
            // Departed/dead enemies leave a miss; another enemy on the tile can
            // be struck, but allies never receive accidental friendly fire.
            const stationaryFlag=target?.structure==='flag'&&target.health.current>0&&target.x===x&&target.y===y?target:null;
            const struck=victim?.health.current>0?victim:stationaryFlag;
            if(strike.hit!==false&&struck?.health.current>0&&struck.team&&struck.team!==u.team&&
                (!victim||(Math.abs(victim.visualX-x)<.5&&Math.abs(victim.visualY-y)<.5))&&
                inAttackRange(u,tile)&&(!u.combat.lineOfSight||hasLineOfSight(this,u,tile))) {
              impacts.push({target:struck,attackerId:u.id,damage:u.damage*(strike.damageMultiplier??1),direction:project(x-u.visualX,y-u.visualY).x>=0?1:-1});
            }
          }
        }
        if(u.elapsed+1e-9>=strike.duration){
          u.strike=null;u.elapsed=0;
          if(strike.healing)u.waitReason=null;
          if(strike.automatic){
            u.target=null;u.state=u.command?'walk':'idle';
            if(u.command?.type==='move')u.combat.advanceAfterShotUntil=this.time+.55;
          }
          else {u.state='idle';if(u.command?.type!=='attack')this.cancelCommand(u);else u.waitReason='reload';}
        }
      } else if(u.state==='hit'&&u.elapsed>=(u.combat.retaliation ? .18 : .36)){u.state=u.command?'walk':'idle';u.elapsed=0;}
    }
    for(const {target,damage,direction,attackerId} of impacts)if(this.damage(target.id,damage,direction,attackerId)){
      this.effects.push({x:target.visualX,y:target.visualY,age:0});this.combatStats.hits++;
    }
    if(this.match?.phase==='battle'&&Object.values(this.match.flags).some(flag=>flag.health.current<=0)){
      this.match.refreshStatus();if(this.match.phase==='finished')return;
    }
    this.navClock+=dt;
    if(this.navClock+1e-9>=NAV_INTERVAL) {
      this.navClock%=NAV_INTERVAL;this.navigation.refill();this.navigation.schedule();
    }
    this.units=this.units.filter(u=>{
      if(u.state!=='death'||u.elapsed<DEATH_DURATION)return true;
      this.byId.delete(u.id);return false;
    });
  }
}
