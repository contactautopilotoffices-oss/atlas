/* Flatten Volt's DWG to plain geometry: every model-space entity, blocks
   exploded (recursively) into world coordinates, arcs and circles turned into
   polylines. Each record keeps its layer, its type, the top-level block it came
   from and that block's handle, so a seat can be traced back to the drawing. */
import fs from 'fs';
const {DwgReader}=await import(process.env.S+'/lwtest/node_modules/@node-projects/acad-ts/dist/index.js');
const [,, IN, OUT] = process.argv;
const b=fs.readFileSync(IN);
const doc=DwgReader.readFromStream(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),()=>{});
const brs=[...doc.blockRecords]; const byH=new Map(brs.map(r=>[BigInt(r.handle),r]));
function effName(blk){ let n=blk?.name||''; if(!n.startsWith('*U')) return n;
  for(const [app,x] of (blk._extendedData?.entries?.()??[])) if(app?.name==='AcDbBlockRepBTag'){const recs=x.records??x._records; const h=recs?.[1]?.value; const r=byH.get(BigInt(h)); if(r) return r.name;}
  return n; }
const out=[]; const ARC=24;
const arcPts=(c,r,a0,a1)=>{ if(a1<a0) a1+=Math.PI*2; const n=Math.max(4,Math.ceil((a1-a0)/(Math.PI*2)*ARC*2)); const p=[]; for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n; p.push([c.x+r*Math.cos(a), c.y+r*Math.sin(a)]);} return p; };
const bulgePts=(p0,p1,bul)=>{ if(!bul) return [[p0.x,p0.y]]; const th=4*Math.atan(bul); const dx=p1.x-p0.x, dy=p1.y-p0.y, c=Math.hypot(dx,dy); if(c<1e-9) return [[p0.x,p0.y]];
  const r=c/(2*Math.sin(th/2)); const mx=(p0.x+p1.x)/2, my=(p0.y+p1.y)/2; const h=r*Math.cos(th/2); const nx=-dy/c, ny=dx/c; const cx=mx+nx*h, cy=my+ny*h;
  let a0=Math.atan2(p0.y-cy,p0.x-cx), a1=Math.atan2(p1.y-cy,p1.x-cx); const pts=[]; const n=Math.max(3,Math.ceil(Math.abs(th)/(Math.PI*2)*ARC*2));
  if(th>0){ if(a1<a0) a1+=Math.PI*2; } else { if(a1>a0) a1-=Math.PI*2; }
  for(let i=0;i<n;i++){const a=a0+(a1-a0)*i/n; pts.push([cx+Math.abs(r)*Math.cos(a), cy+Math.abs(r)*Math.sin(a)]);} return pts; };
const textOf=(e)=>String(e.value??e.text??'').replace(/\\P/g,'\n').replace(/\\[A-Za-z][^;\\]*;/g,'').replace(/[{}]/g,'').replace(/\\~/g,' ').trim();
let IID=0;
function emit(e, top, depth, chain=[]){
  const t=e.constructor.name, L=e.layer?.name||'0'; const base={L, t, top:top?.n||null, th:top?.h||null, ch:chain};
  try{
  if(t==='Insert'){ const name=effName(e.block); const tp=top||{n:name,h:e.handle.toString(16)};
    const id=++IID; out.push({...base, id, t:'INS', top:tp.n, th:tp.h, name, depth, p:[e.insertPoint.x,e.insertPoint.y], rot:e.rotation, sx:e.xScale, sy:e.yScale});
    if(depth<6) for(const s of e.explode()) emit(s, tp, depth+1, [...chain,id]); return; }
  if(t==='Line') return out.push({...base, p:[[e.startPoint.x,e.startPoint.y],[e.endPoint.x,e.endPoint.y]]});
  if(t==='Arc') return out.push({...base, p:arcPts(e.center,e.radius,e.startAngle,e.endAngle)});
  if(t==='Circle') { const p=arcPts(e.center,e.radius,0,Math.PI*2); return out.push({...base, p, c:[e.center.x,e.center.y,e.radius]}); }
  if(t==='LwPolyline'){ const v=e.vertices; const p=[]; const n=v.length; const closed=e.isClosed;
    for(let i=0;i<n;i++){ const a=v[i].location, bb=(i+1<n)?v[i+1].location:(closed?v[0].location:null); if(bb) p.push(...bulgePts(a,bb,v[i].bulge)); else p.push([a.x,a.y]); }
    if(closed&&p.length) p.push(p[0]); return out.push({...base, p, closed}); }
  if(t==='Polyline2D'||t==='Polyline3D'){ const p=[...e.vertices].map(v=>[v.location.x,v.location.y]); return out.push({...base,p}); }
  if(t==='Ellipse'){ const c=e.center, mj=e.majorAxisEndPoint||e.endPoint, ra=e.radiusRatio; const R=Math.hypot(mj.x,mj.y), ang=Math.atan2(mj.y,mj.x); const p=[]; let a0=e.startParameter??0, a1=e.endParameter??Math.PI*2; if(a1<=a0) a1+=Math.PI*2; for(let i=0;i<=32;i++){const a=a0+(a1-a0)*i/32; const x=R*Math.cos(a), y=R*ra*Math.sin(a); p.push([c.x+x*Math.cos(ang)-y*Math.sin(ang), c.y+x*Math.sin(ang)+y*Math.cos(ang)]);} return out.push({...base,p}); }
  if(t==='MText'||t==='TextEntity'||t==='AttributeEntity'){ const ip=e.insertPoint||e.alignmentPoint; return out.push({...base, txt:textOf(e), p:[ip.x,ip.y], hgt:e.height}); }
  if(t==='Spline'){ const cp=(e.fitPoints?.length?e.fitPoints:e.controlPoints)||[]; return out.push({...base, p:[...cp].map(q=>[q.x,q.y])}); }
  if(t==='Solid'||t==='Face3D'){ const q=[e.firstCorner,e.secondCorner,e.thirdCorner,e.fourthCorner].filter(Boolean); if(q.length) out.push({...base,p:q.map(v=>[v.x,v.y]),fill:true}); return; }
  }catch(err){ out.push({...base, err:String(err).slice(0,80)}); }
}
for(const e of doc.modelSpace.entities) emit(e,null,0);
fs.writeFileSync(OUT, JSON.stringify({units:'inch', n:out.length, rec:out}));
const c={}; for(const r of out) c[r.t]=(c[r.t]||0)+1; console.log(out.length, JSON.stringify(c));
