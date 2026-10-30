import {Board} from './model.mjs';
import {FlagMatch} from './flag-match.mjs';

const SOLDIERS_PER_SQUAD=10;
export const ASHEN_ARMY_SIZE=40;
export const ASHEN_ARMY_LIMIT=350;
export const ASHEN_ARMY_CHOICES=Object.freeze([40,100,200,350]);
export const RIFLE_STATS=Object.freeze({
 maxHealth:85,damage:18,attackPeriod:1.35,range:9,
 rangeShape:'king',preferredRange:6,lineOfSight:true,searchInterval:.3
});
export const RIFLE_MOVEMENT=Object.freeze({stepTime:.42,waitBeforeDetour:.24,yieldAfter:.65});

// Each soldier receives a stable 5/6/7-cell comfort distance at spawn.
// The 9-cell maximum range and existing navigation/combat rules are unchanged.
export function preferredRangeForSoldier(seed,unitId){
 const hash=Math.imul((unitId|0)^(seed|0),0x9e3779b1)>>>0;
 return 5+hash%3;
}

export function infantryBlueprint(){
 const members=[{characterId:'ashen-rifleman',role:'banner',offset:{x:-2,y:0}}];
 for(let i=0;i<SOLDIERS_PER_SQUAD-1;i++)members.push({
  characterId:'ashen-rifleman',role:'scout',
  offset:{x:-Math.floor(i/5),y:i%5-2}
 });
 return {format:'doragami-unit-group',version:1,kind:'squad',
  squadSize:SOLDIERS_PER_SQUAD,name:'소총보병 분대',squadType:'infantry',members};
}

export function createAshenMatch({seed=1977,count=ASHEN_ARMY_SIZE}={}){
 const normalized=Math.max(SOLDIERS_PER_SQUAD,Math.min(ASHEN_ARMY_LIMIT,Math.floor((Number(count)||ASHEN_ARMY_SIZE)/SOLDIERS_PER_SQUAD)*SOLDIERS_PER_SQUAD));
 const board=new Board();
 const match=new FlagMatch(board,{
  seed,count:normalized,blueprints:[infantryBlueprint()],aiImplementation:'legacy',
  makeCharacter:()=>null,
  optionsFor:(_character,_member,i)=>({stats:{...RIFLE_STATS,preferredRange:preferredRangeForSoldier(seed,board.nextId+i)},movement:{...RIFLE_MOVEMENT},
   battle:null,unitType:'ashen-rifleman',capabilities:[]})
 });
 return {board,match};
}

/** Use the original FlagMatch.deploy, not a second spawn path. */
export function autoDeployPlayer(match){
 let placed=0;
 while(match.reserve.A>0){
  const before=match.reserve.A;
  let result=null;
  const center=Math.floor(match.board.height/2),front=Math.floor(match.board.width*.14);
  for(let radius=0;radius<=50&&!result;radius+=3){
   for(const sign of radius===0?[0]:[-1,1]){
    const y=center+radius*sign;
    for(let x=front;x<Math.floor(match.board.width*.40)&&!result;x+=3){
     if(y<4||y>=match.board.height-4)continue;
     result=match.deploy('A','infantry',{x,y});
    }
   }
  }
  if(!result||match.reserve.A>=before)break;
  placed+=before-match.reserve.A;
 }
 return {placed,remaining:match.reserve.A,complete:match.reserve.A===0};
}
