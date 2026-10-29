export const DIRECTIONS = [{dx:0,dy:-1,bit:1,opposite:4},{dx:1,dy:0,bit:2,opposite:8},{dx:0,dy:1,bit:4,opposite:1},{dx:-1,dy:0,bit:8,opposite:2}];
export const cell=(m,x,y)=>y*m.width+x;
export const xy=(m,i)=>({x:i%m.width,y:Math.floor(i/m.width)});
export function createTerrain(width,height) {
 const size=width*height, m={width,height,size,revision:0,dirty:new Set()};
 for(const key of ['floorLevel','terrainKind','blocked','transitionMask','edgeMask','coverMask','coverCondition']) m[key]=new Uint8Array(size);
 m.floorLevel.fill(1); m.coverCondition.fill(100);
 m.occupancy=new Int32Array(size); m.reservation=new Int32Array(size); return m;
}
export function neighbors(m,i) {
 const x=i%m.width,y=Math.floor(i/m.width),out=[];
 for(const d of DIRECTIONS) if(x+d.dx>=0&&x+d.dx<m.width&&y+d.dy>=0&&y+d.dy<m.height) out.push(i+d.dx+d.dy*m.width);
 return out;
}
function direction(m,a,b) {
 const dx=b%m.width-a%m.width,dy=Math.floor(b/m.width)-Math.floor(a/m.width);
 return DIRECTIONS.find(d=>d.dx===dx&&d.dy===dy);
}
export function connect(m,a,b) {
 const d=direction(m,a,b); if(!d) throw Error('Ramp must join adjacent cells');
 m.transitionMask[a]|=d.bit; m.transitionMask[b]|=d.opposite;
}
export function canStep(m,a,b) {
 if(a<0||b<0||a>=m.size||b>=m.size||m.blocked[a]||m.blocked[b]) return false;
 const d=direction(m,a,b); if(!d || (m.edgeMask[a]&d.bit) || (m.edgeMask[b]&d.opposite)) return false;
 const delta=Math.abs(m.floorLevel[a]-m.floorLevel[b]);
 return delta===0 || (delta===1 && !!(m.transitionMask[a]&d.bit) && !!(m.transitionMask[b]&d.opposite));
}
export function createMap(width=64,height=48) {
 const m=createTerrain(width,height);
 // Repeat a reviewed symmetric sector fixture; larger boards add space, not new mechanics.
 const ys=height===48?[24]:[Math.floor(height*.23),Math.floor(height*.5),Math.floor(height*.77)];
 for(const cy of ys) {
  const lx=Math.floor(width*.265625),rx=width-1-lx;
  for(const cx of [lx,rx]) {
   for(let y=cy-14;y<=cy+13;y++) for(let x=cx-1;x<=cx;x++) { const i=cell(m,x,y); m.floorLevel[i]=0;m.terrainKind[i]=1;m.coverMask[i]=2|8; }
   for(const y0 of [cy-9,cy+7]) for(let y=y0;y<y0+2;y++) for(let x=cx-5;x<=cx+4;x++) {
    const i=cell(m,x,y);m.floorLevel[i]=0;m.terrainKind[i]=1;m.coverMask[i]=1|4;
   }
   for(let i=0;i<m.size;i++) if(m.floorLevel[i]===0) for(const j of neighbors(m,i)) {
    const p=xy(m,i);
    if(m.floorLevel[j]===1 && ([cy-6,cy-5,cy+4,cy+5].includes(p.y)||p.y===cy-14||p.y===cy+13)) connect(m,i,j);
   }
  }
  for(const ry of [cy-17,cy+14]) {
   for(let y=ry;y<ry+4;y++) for(let x=width/2-5;x<width/2+5;x++) {const i=cell(m,x,y);m.floorLevel[i]=2;m.terrainKind[i]=2;m.coverMask[i]=1|4;}
   for(const x of [width/2-4,width/2+3]) {connect(m,cell(m,x,ry),cell(m,x,ry-1));connect(m,cell(m,x,ry+3),cell(m,x,ry+4));}
  }
  for(const x of [width/2-5,width/2+4]) for(const dy of [-5,3]) for(let y=cy+dy;y<cy+dy+2;y++) {
   const i=cell(m,x,y);m.blocked[i]=1;m.terrainKind[i]=4;
  }
 }
 return m;
}
export function random(state) { let x=state.seed|0; x^=x<<13;x^=x>>>17;x^=x<<5; state.seed=x>>>0;return state.seed/4294967296; }
