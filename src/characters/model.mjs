import {ASPECTS} from './aspects.mjs';
/** Independently measured visual assembly; the supplied rig.json is intentionally unused. */
export const NATIONS=['arken','velian'];
export const RANKS=['private','corporal','sergeant','warrant','lieutenant','captain','major','colonel'];
export const LABELS={arken:'아르켄 제국',velian:'벨리안 연방',private:'병사',corporal:'상병',sergeant:'하사',warrant:'상사',lieutenant:'소위',captain:'대위',major:'소령',colonel:'대령'};
export const PARTS=['legLeft','legRight','armLeft','body','armRight','shoulderLeft','shoulderRight','sleeveLeft','sleeveRight','head','hat','rifle'];
export const STORAGE_KEY='ashenfront.soldier-workshop.v1';
export const ASSETS=['shared/head','shared/leg_left','shared/leg_right','rifle-placeholder',...['arken','belnian'].flatMap(n=>['arm_left','arm_right','torso_enlisted','torso_officer','helmet','cap_plain','cap_cord',...[1,2,3,4].flatMap(i=>[`board_${i}_left`,`board_${i}_right`,`sleeve_${i}`])].map(k=>n+'/'+k))];
function keepAspect(p){const ratio=ASPECTS[p.asset],height=Math.min(p.h,p.w/ratio);p.h=height;p.w=height*ratio;const uniform=Math.sqrt(p.scaleX*p.scaleY);p.scaleX=uniform;p.scaleY=uniform;return p;}
function part(asset,x,y,w,h,extra={}){return keepAspect({asset,x,y,w,h,pivotX:.5,pivotY:.5,rotation:0,scaleX:1,scaleY:1,visible:true,...extra});}
export function createCatalog(){
 const profiles={};for(const nation of NATIONS)for(let i=0;i<RANKS.length;i++){
  const rank=RANKS[i],family=nation==='arken'?'arken':'belnian',officer=i>=4,board=Math.max(1,i-3),sleeve=Math.min(4,i===2?3:i),hat=officer?(i>=5?'cap_cord':'cap_plain'):i===3?'cap_plain':'helmet';
  profiles[nation+':'+rank]={nation,rank,parts:{
   legLeft:part('shared/leg_left',-17,-37.4,35,44,{pivotY:.15}),legRight:part('shared/leg_right',17,-37.4,35,44,{pivotY:.15}),
   armLeft:part(family+'/arm_left',-31,-94,58,64,{pivotX:.74,pivotY:.15,gripX:nation==='arken'?.2479:.2256,gripY:nation==='arken'?.8341:.8154}),body:part(family+(officer?'/torso_officer':'/torso_enlisted'),0,-72,100,100),armRight:part(family+'/arm_right',31,-94,58,64,{pivotX:.26,pivotY:.15,gripX:nation==='arken'?.746:.7664,gripY:nation==='arken'?.8285:.8155}),
   shoulderLeft:part(family+`/board_${board}_left`,-32,-109,12,19,{rotation:-1.0,visible:officer}),shoulderRight:part(family+`/board_${board}_right`,32,-109,12,19,{rotation:1.0,visible:officer}),
   sleeveLeft:part(family+`/sleeve_${Math.max(1,sleeve)}`,-51,-65,15,6+sleeve*1.5,{visible:!officer&&i>0}),sleeveRight:part(family+`/sleeve_${Math.max(1,sleeve)}`,51,-65,15,6+sleeve*1.5,{visible:!officer&&i>0}),
   head:part('shared/head',0,-153,90,90),hat:part(family+'/'+hat,-2,-185,hat==='helmet'?115:120,80),
   rifle:part('rifle-placeholder',0,-69,118,29.5,{pivotX:.34,pivotY:.5,gripX:55/160,gripY:23/40,supportX:105/160,supportY:19/40})
  },layers:[...PARTS]};
 }
 return {format:'ashenfront-soldier-catalog',version:1,bodyStyle:'reference-sheet-v3-aspect',profiles};
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
export function editPart(c,profile,key,patch){if(!PARTS.includes(key)||!Object.hasOwn(c.profiles,profile))throw Error('없는 파츠입니다.');const p={...c.profiles[profile].parts[key],...patch};validPart(p);
 if(patch.w!==undefined&&patch.h===undefined)p.h=p.w/ASPECTS[p.asset];else if(patch.h!==undefined&&patch.w===undefined)p.w=p.h*ASPECTS[p.asset];
 if(patch.scaleX!==undefined)p.scaleY=p.scaleX;else if(patch.scaleY!==undefined)p.scaleX=p.scaleY;keepAspect(p);validPart(p);c.profiles[profile].parts[key]=p;return p;}

export function exportCatalog(c){validateCatalog(c);return JSON.stringify(c,null,2);}
export function importCatalog(input){const c=typeof input==='string'?JSON.parse(input):input;validateCatalog(c);const next=migratePhysique(structuredClone(c));for(const p of Object.values(next.profiles))for(const part of Object.values(p.parts))keepAspect(part);validateCatalog(next);return next;}
export function profileId(team,rank='private'){return (team==='B'?'velian':'arken')+':'+(RANKS.includes(rank)?rank:'private');}
export function exportProfile(c,id){validateCatalog(c);if(!Object.hasOwn(c.profiles,id))throw Error('없는 프로필입니다.');return JSON.stringify({format:'ashenfront-soldier-profile',version:1,profileId:id,profile:c.profiles[id]},null,2);}
export function importEdits(data,base=createCatalog()){
 if(typeof data==='string')data=JSON.parse(data);
 if(data?.format==='ashenfront-soldier-profile'){if(data.version!==1||!Object.hasOwn(base.profiles,data.profileId))throw Error('프로필 형식이 잘못되었습니다.');const c=structuredClone(base);c.profiles[data.profileId]=data.profile;return importCatalog(c);}
 return importCatalog(data);
}

/** Copy physique only; keep every nation's artwork and each rank's insignia. */
export function unifyPhysique(c,sourceId){
 validateCatalog(c);if(!Object.hasOwn(c.profiles,sourceId))throw Error('기준 병사가 없습니다.');
 const next=structuredClone(c),source=c.profiles[sourceId],keys=['x','y','w','h','rotation','scaleX','scaleY'];
 for(const [id,p] of Object.entries(next.profiles)){if(id===sourceId)continue;
  const old=structuredClone(p.parts);
  for(const key of ['head','body','legLeft','legRight','armLeft','armRight']){for(const field of keys)p.parts[key][field]=source.parts[key][field];p.parts[key].w=p.parts[key].h*ASPECTS[p.parts[key].asset];p.parts[key].scaleY=p.parts[key].scaleX;}
  for(const [key,parent] of [['hat','head'],['shoulderLeft','body'],['shoulderRight','body'],['sleeveLeft','armLeft'],['sleeveRight','armRight'],['rifle','body']]){
   const a=old[parent],b=p.parts[parent],sx=b.w*b.scaleX/(a.w*a.scaleX),sy=b.h*b.scaleY/(a.h*a.scaleY),part=p.parts[key];
   part.x=b.x+(old[key].x-a.x)*sx;part.y=b.y+(old[key].y-a.y)*sy;part.w=old[key].w*Math.min(sx,sy);part.h=old[key].h*Math.min(sx,sy);keepAspect(part);
  }
 }
 next.bodyStyle='reference-sheet-v3-aspect';validateCatalog(next);return next;
}
/** Preserve relative user adjustments when upgrading the earlier tall automatic draft. */
export function migratePhysique(c){
 validateCatalog(c);if(c.bodyStyle==='reference-sheet-v3-aspect')return c;
 const next=structuredClone(c),defaults=createCatalog();
 for(const [id,p] of Object.entries(next.profiles))for(const [key,part] of Object.entries(p.parts)){
  const helmet=part.asset.endsWith('/helmet'),old={legLeft:[-22,-59,43,69],legRight:[22,-59,45,69],armLeft:[-45,-145,58,77],armRight:[45,-145,58,77],body:[0,-111,114,114],head:[0,-193,87,86],hat:[-3,-224,helmet?117:121,helmet?77:80],shoulderLeft:[-37,-151,11,24],shoulderRight:[37,-151,11,24],sleeveLeft:[-62,-123,19,part.h],sleeveRight:[62,-123,19,part.h],rifle:[-8,-124,140,35]}[key],d=defaults.profiles[id].parts[key],sx=d.w/old[2],sy=d.h/old[3];
  const recent=c.bodyStyle==='reference-sheet-v2',v2={legLeft:[-19,-36.5,35,43],legRight:[19,-36.5,35,43],armLeft:[-32,-94,44,69],armRight:[32,-94,44,69],body:[0,-69,108,84],head:[0,-144,90,74],hat:[-2,-178,helmet?115:120,helmet?76:78],shoulderLeft:[-34,-103,10,19],shoulderRight:[34,-103,10,19],sleeveLeft:[-49,-65,15,part.h],sleeveRight:[49,-65,15,part.h],rifle:[0,-69,118,29.5]}[key],baseline=recent?v2:old;part.x=d.x+(part.x-baseline[0])*d.w/baseline[2];part.y=d.y+(part.y-baseline[1])*d.h/baseline[3];part.w*=d.w/baseline[2];part.h*=d.h/baseline[3];keepAspect(part);
 }
 next.bodyStyle='reference-sheet-v3-aspect';validateCatalog(next);return next;
}
