/** Independently measured visual assembly; the supplied rig.json is intentionally unused. */
export const NATIONS=['arken','velian'];
export const RANKS=['private','corporal','sergeant','warrant','lieutenant','captain','major','colonel'];
export const LABELS={arken:'아르켄 제국',velian:'벨리안 연방',private:'병사',corporal:'상병',sergeant:'하사',warrant:'상사',lieutenant:'소위',captain:'대위',major:'소령',colonel:'대령'};
export const PARTS=['legLeft','legRight','armLeft','body','armRight','shoulderLeft','shoulderRight','sleeveLeft','sleeveRight','head','hat','rifle'];
export const STORAGE_KEY='ashenfront.soldier-workshop.v1';
export const ASSETS=['shared/head','shared/leg_left','shared/leg_right','rifle-placeholder',...['arken','belnian'].flatMap(n=>['arm_left','arm_right','torso_enlisted','torso_officer','helmet','cap_plain','cap_cord',...[1,2,3,4].flatMap(i=>[`board_${i}_left`,`board_${i}_right`,`sleeve_${i}`])].map(k=>n+'/'+k))];
function part(asset,x,y,w,h,extra={}){return {asset,x,y,w,h,pivotX:.5,pivotY:.5,rotation:0,scaleX:1,scaleY:1,visible:true,...extra};}
export function createCatalog(){
 const profiles={};for(const nation of NATIONS)for(let i=0;i<RANKS.length;i++){
  const rank=RANKS[i],family=nation==='arken'?'arken':'belnian',officer=i>=4,board=Math.max(1,i-3),sleeve=Math.min(4,i===2?3:i),hat=officer?(i>=5?'cap_cord':'cap_plain'):i===3?'cap_plain':'helmet';
  profiles[nation+':'+rank]={nation,rank,parts:{
   legLeft:part('shared/leg_left',-22,-59,43,69,{pivotY:.15}),legRight:part('shared/leg_right',22,-59,45,69,{pivotY:.15}),
   armLeft:part(family+'/arm_left',-45,-145,58,77,{pivotX:.74,pivotY:.15,gripX:nation==='arken'?.2479:.2256,gripY:nation==='arken'?.8341:.8154}),body:part(family+(officer?'/torso_officer':'/torso_enlisted'),0,-111,114,114),armRight:part(family+'/arm_right',45,-145,58,77,{pivotX:.26,pivotY:.15,gripX:nation==='arken'?.746:.7664,gripY:nation==='arken'?.8285:.8155}),
   shoulderLeft:part(family+`/board_${board}_left`,-37,-151,11,24,{rotation:-1.0,visible:officer}),shoulderRight:part(family+`/board_${board}_right`,37,-151,11,24,{rotation:1.0,visible:officer}),
   sleeveLeft:part(family+`/sleeve_${Math.max(1,sleeve)}`,-62,-123,19,8+sleeve*2,{visible:!officer&&i>0}),sleeveRight:part(family+`/sleeve_${Math.max(1,sleeve)}`,62,-123,19,8+sleeve*2,{visible:!officer&&i>0}),
   head:part('shared/head',0,-193,87,86),hat:part(family+'/'+hat,-3,hat==='helmet'?-224:-224,hat==='helmet'?117:121,hat==='helmet'?77:80),
   rifle:part('rifle-placeholder',-8,-124,140,35,{pivotX:.34,pivotY:.5,gripX:55/160,gripY:23/40,supportX:105/160,supportY:19/40})
  },layers:[...PARTS]};
 }
 return {format:'ashenfront-soldier-catalog',version:1,profiles};
}
function validPart(p){
 if(!p||!ASSETS.includes(p.asset)||typeof p.visible!=='boolean')throw Error('등록되지 않은 파츠입니다.');
 for(const k of ['x','y','w','h','pivotX','pivotY','rotation','scaleX','scaleY'])if(!Number.isFinite(p[k]))throw Error(k+': 유한한 숫자가 필요합니다.');
 for(const key of ['gripX','gripY','supportX','supportY'])if(p[key]!==undefined&&(!Number.isFinite(p[key])||p[key]< -1||p[key]>2))throw Error('손잡이 좌표가 잘못되었습니다.');
 if(p.w<1||p.h<1||p.w>1000||p.h>1000||p.scaleX<.1||p.scaleY<.1||p.scaleX>5||p.scaleY>5||Math.abs(p.x)>1000||Math.abs(p.y)>1000||Math.abs(p.rotation)>Math.PI*4||p.pivotX< -1||p.pivotX>2||p.pivotY< -1||p.pivotY>2)throw Error('파츠 조정 범위를 벗어났습니다.');
}
export function validateCatalog(c){
 if(c?.format!=='ashenfront-soldier-catalog'||c.version!==1||!c.profiles||Array.isArray(c.profiles))throw Error('지원하지 않는 캐릭터 JSON입니다.');
 const keys=NATIONS.flatMap(n=>RANKS.map(r=>n+':'+r));if(Object.keys(c.profiles).length!==keys.length)throw Error('국가·계급 구성이 다릅니다.');
 for(const key of keys){const p=c.profiles[key];if(!p||key!==p.nation+':'+p.rank||Object.keys(p.parts??{}).length!==PARTS.length)throw Error('프로필 구성이 다릅니다.');for(const k of PARTS)validPart(p.parts[k]);if(!Array.isArray(p.layers)||p.layers.length!==PARTS.length||new Set(p.layers).size!==PARTS.length||p.layers.some(k=>!PARTS.includes(k)))throw Error('레이어 순서가 잘못되었습니다.');}return true;
}
export function editPart(c,profile,key,patch){if(!PARTS.includes(key)||!Object.hasOwn(c.profiles,profile))throw Error('없는 파츠입니다.');const p={...c.profiles[profile].parts[key],...patch};validPart(p);c.profiles[profile].parts[key]=p;return p;}
export function exportCatalog(c){validateCatalog(c);return JSON.stringify(c,null,2);}
export function importCatalog(input){const c=typeof input==='string'?JSON.parse(input):input;validateCatalog(c);return structuredClone(c);}
export function profileId(team,rank='private'){return (team==='B'?'velian':'arken')+':'+(RANKS.includes(rank)?rank:'private');}
export function exportProfile(c,id){validateCatalog(c);if(!Object.hasOwn(c.profiles,id))throw Error('없는 프로필입니다.');return JSON.stringify({format:'ashenfront-soldier-profile',version:1,profileId:id,profile:c.profiles[id]},null,2);}
export function importEdits(data,base=createCatalog()){
 if(typeof data==='string')data=JSON.parse(data);
 if(data?.format==='ashenfront-soldier-profile'){if(data.version!==1||!Object.hasOwn(base.profiles,data.profileId))throw Error('프로필 형식이 잘못되었습니다.');const c=structuredClone(base);c.profiles[data.profileId]=data.profile;return importCatalog(c);}
 return importCatalog(data);
}
