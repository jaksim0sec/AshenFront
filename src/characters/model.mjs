import {ASPECTS} from './aspects.mjs';
import {UNIFORM_PARTS,ASSEMBLIES,BODY_STYLE} from './uniforms.mjs';
import {REFERENCE_PROFILE,PHYSIQUE_REVISION} from './reference.mjs';
/** Assembly proportions come from the current archive, with one global scale/translation. */
export const NATIONS=['arken','velian'];
export const RANKS=['private','corporal','sergeant','warrant','lieutenant','captain','major','colonel'];
export const LABELS={arken:'아르켄 제국',velian:'벨리안 연방',private:'병사',corporal:'상병',sergeant:'하사',warrant:'상사',lieutenant:'소위',captain:'대위',major:'소령',colonel:'대령'};
export const PARTS=['legLeft','legRight','armLeft','body','armRight','shoulderLeft','shoulderRight','sleeveLeft','sleeveRight','head','hat','rifle'];
// User-exported Arken private order, shared by every nation and rank.
export const DEFAULT_LAYERS=Object.freeze(["legRight","armLeft","legLeft","body","armRight","head","hat","shoulderLeft","shoulderRight","sleeveLeft","sleeveRight","rifle"]);
const LAYER_REVISION='arken-private-order-1';
const RIFLE_REVISION=1,RIFLE_ENLARGEMENT=1.2;
// A new artwork generation must not silently restore incompatible old browser geometry.
export const STORAGE_KEY='ashenfront.soldier-workshop.v3';
export const ASSETS=Object.keys(ASPECTS);
export const RANK_ASSEMBLIES={
 arken:['black_private','black_single_bar','black_double_bar','black_chevron','black_officer','black_officer','black_senior_officer','black_senior_officer'],
 velian:['blue_private','blue_bars','blue_chevron_down','blue_chevron_up','blue_officer','blue_officer','blue_senior_officer','blue_senior_officer']
};
function keepAspect(p){const ratio=ASPECTS[p.asset];if(Math.abs(p.w/p.h-ratio)>1e-10){const height=Math.min(p.h,p.w/ratio);p.h=height;p.w=height*ratio;}if(p.scaleX!==p.scaleY){const uniform=Math.sqrt(p.scaleX*p.scaleY);p.scaleX=uniform;p.scaleY=uniform;}return p;}
function slot(asset){const name=asset.split('/')[1];if(name.startsWith('torso'))return 'body';if(name.startsWith('epaulette'))return name.endsWith('left')?'shoulderLeft':'shoulderRight';if(name.startsWith('rank'))return name.endsWith('left')?'sleeveLeft':'sleeveRight';return {leg_left:'legLeft',leg_right:'legRight',arm_left:'armLeft',arm_right:'armRight',head:'head',helmet:'hat',officer_cap:'hat'}[name];}
export function createCatalog(){
 const profiles={};for(const nation of NATIONS)for(let i=0;i<RANKS.length;i++){
  const rank=RANKS[i],family=nation==='arken'?'black':'blue',nodes=ASSEMBLIES[RANK_ASSEMBLIES[nation][i]],parts={};
  // Inactive insignia remain editable without adding invented artwork or ranks.
  for(const asset of [family+'/epaulette_plain_left',family+'/epaulette_plain_right',family+(nation==='arken'?'/rank_single_bar_left':'/rank_bars_left'),family+(nation==='arken'?'/rank_single_bar_right':'/rank_bars_right')])parts[slot(asset)]={...UNIFORM_PARTS[asset],visible:false};
  for(const asset of nodes)parts[slot(asset)]={...UNIFORM_PARTS[asset]};
  parts.rifle={asset:'rifle-placeholder',x:0,y:-73,w:118,h:29.5,pivotX:.34,pivotY:.5,rotation:0,scaleX:1,scaleY:1,visible:true,gripX:55/160,gripY:23/40,supportX:105/160,supportY:19/40};
  const layers=[...DEFAULT_LAYERS];
  profiles[nation+':'+rank]={nation,rank,parts,layers};
 }
 profiles['arken:private']=structuredClone(REFERENCE_PROFILE);
 profiles['arken:private'].parts.rifle.w*=RIFLE_ENLARGEMENT;profiles['arken:private'].parts.rifle.h*=RIFLE_ENLARGEMENT;
 return unifyPhysique({format:'ashenfront-soldier-catalog',version:1,bodyStyle:BODY_STYLE,layerRevision:LAYER_REVISION,rifleRevision:RIFLE_REVISION,profiles},'arken:private');
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

/** Apply a calibrated change of frame, using the source texture's registration point.
 * Always start from asset calibration; never accumulate offsets from an old target draft.
 */
function transferPart(base,current,target){
 const factor=current.w*current.scaleX/(base.w*base.scaleX),angle=current.rotation-base.rotation,cos=Math.cos(angle),sin=Math.sin(angle);
 const px=(base.pivotX-current.pivotX)*current.w*current.scaleX,py=(base.pivotY-current.pivotY)*current.h*current.scaleY,c=Math.cos(current.rotation),s=Math.sin(current.rotation);
 const fitX=current.x+c*px-s*py,fitY=current.y+s*px+c*py,dx=(target.x-base.x)*factor,dy=(target.y-base.y)*factor;
 return {...target,x:fitX+cos*dx-sin*dy,y:fitY+sin*dx+cos*dy,w:target.w*factor,h:target.h*factor,rotation:target.rotation+angle};
}
/** Match identical assets exactly; fit different national artwork through its registered pivot. */
export function unifyPhysique(c,sourceId){
 validateCatalog(c);if(!Object.hasOwn(c.profiles,sourceId))throw Error('기준 병사가 없습니다.');
 const next=structuredClone(c),source=c.profiles[sourceId];
 for(const [id,p] of Object.entries(next.profiles)){if(id===sourceId)continue;
  for(const key of ['head','body','legLeft','legRight','armLeft','armRight','hat','rifle']){
   const src=source.parts[key],old=p.parts[key];
   p.parts[key]=src.asset===old.asset?{...src,visible:old.visible}:transferPart(UNIFORM_PARTS[src.asset],src,UNIFORM_PARTS[old.asset]);
   p.parts[key].visible=old.visible;keepAspect(p.parts[key]);
  }
  for(const [key,parent] of [['shoulderLeft','body'],['shoulderRight','body'],['sleeveLeft','armLeft'],['sleeveRight','armRight']]){
   const old=p.parts[key],anchor=p.parts[parent];p.parts[key]=transferPart(UNIFORM_PARTS[anchor.asset],anchor,UNIFORM_PARTS[old.asset]);p.parts[key].visible=old.visible;keepAspect(p.parts[key]);
  }
 }
 next.bodyStyle=BODY_STYLE;next.physiqueRevision=PHYSIQUE_REVISION;validateCatalog(next);return next;
}
/** Old raster generations cannot reuse their coordinates with these native crops. */
export function migratePhysique(c){
 validateCatalog(c);if(c.bodyStyle!==BODY_STYLE)throw Error('이전 파츠용 JSON입니다. 새 파츠 기준으로 다시 조정하세요.');
 // Upgrade the layer order once without discarding saved part positions or later edits.
 if(c.layerRevision!==LAYER_REVISION){for(const p of Object.values(c.profiles))p.layers=[...DEFAULT_LAYERS];c.layerRevision=LAYER_REVISION;}
 if(c.physiqueRevision!==PHYSIQUE_REVISION){c.profiles['arken:private']=structuredClone(REFERENCE_PROFILE);if(c.rifleRevision===RIFLE_REVISION){c.profiles['arken:private'].parts.rifle.w*=RIFLE_ENLARGEMENT;c.profiles['arken:private'].parts.rifle.h*=RIFLE_ENLARGEMENT;}c=unifyPhysique(c,'arken:private');}
 if(c.rifleRevision!==RIFLE_REVISION){for(const p of Object.values(c.profiles)){p.parts.rifle.w*=RIFLE_ENLARGEMENT;p.parts.rifle.h*=RIFLE_ENLARGEMENT;}c.rifleRevision=RIFLE_REVISION;}return c;
}
