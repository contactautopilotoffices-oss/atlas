/* Generic DWG flattener (from noida-skymark/volt/cad/flatten.mjs, same record format).
   Every model-space entity, blocks exploded (recursively) into world coordinates, arcs
   and circles turned into polylines. Each record keeps its layer, its type, the
   top-level block it came from and that block's handle.

   Added over Volt's version (new record types only, the old ones are unchanged):
     t:'DIM'   linear/aligned dimensions: measurement (drawing units), text override, p1/p2/text point
     t:'HATCH' hatch boundaries with pattern name (ceiling/floor finishes are often hatches)
     t:'PSTXT' paper-space text (title blocks, sheet names, scale, notes)
   and a header block: INSUNITS, version, extents.

   Usage: ACAD_TS=<folder holding node_modules/@node-projects/acad-ts> node read_acad_ts.mjs <in.dwg> <out.json> */
import fs from 'fs';
const base = process.env.ACAD_TS;
if (!base) throw new Error('Set ACAD_TS to the installed @node-projects/acad-ts workspace.');
const {DwgReader} = await import(base + '/node_modules/@node-projects/acad-ts/dist/index.js');
const [,, IN, OUT] = process.argv;
const b = fs.readFileSync(IN);
const doc = DwgReader.readFromStream(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {});
const brs = [...doc.blockRecords]; const byH = new Map(brs.map(r => [BigInt(r.handle), r]));
function effName(blk){ let n = blk?.name || ''; if (!n.startsWith('*U')) return n;
  for (const [app, x] of (blk._extendedData?.entries?.() ?? [])) if (app?.name === 'AcDbBlockRepBTag') { const recs = x.records ?? x._records; const h = recs?.[1]?.value; const r = byH.get(BigInt(h)); if (r) return r.name; }
  return n; }
const out = []; const ARC = 48;
// AutoCAD's arbitrary-axis basis maps planar OCS entities into block space.
function ocsPoint(p,n){
  if(!n || (n.x===0 && n.y===0 && n.z===1))return p;
  const len=Math.hypot(n.x,n.y,n.z),z=[n.x/len,n.y/len,n.z/len];
  let x=Math.abs(z[0])<1/64&&Math.abs(z[1])<1/64 ? [z[2],0,-z[0]] : [-z[1],z[0],0];
  const l=Math.hypot(...x);x=x.map(v=>v/l);
  const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
  return {x:x[0]*p.x+y[0]*p.y+z[0]*(p.z||0),y:x[1]*p.x+y[1]*p.y+z[1]*(p.z||0),z:x[2]*p.x+y[2]*p.y+z[2]*(p.z||0)};
}
const arcPts = (c, r, a0, a1) => { if (a1 < a0) a1 += Math.PI * 2; const n = Math.max(4, Math.ceil((a1 - a0) / (Math.PI * 2) * ARC * 2)); const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([c.x + r * Math.cos(a), c.y + r * Math.sin(a)]); } return p; };
const textOf = (e) => String(e.value ?? e.text ?? '').replace(/\\P/g, '\n').replace(/\\[A-Za-z][^;\\]*;/g, '').replace(/[{}]/g, '').replace(/\\~/g, ' ').trim();
let IID = 0;
function emit(e, top, depth, chain = [], transforms = []){
  const world = p => { let q = {x:p[0],y:p[1],z:p[2] || 0}; for (const tr of transforms) q=tr.applyTransform(q); return [q.x,q.y]; };
  const push = r => {
    if(['Arc','Circle','LwPolyline','Solid'].includes(e.constructor.name) && r.p) r.p=r.p.map(p=>{const q=ocsPoint({x:p[0],y:p[1],z:e.elevation||0},e.normal);return [q.x,q.y,q.z];});
    if(r.p) r.p = Array.isArray(r.p[0]) ? r.p.map(world) : world(r.p);
    if(r.rings) r.rings=r.rings.map(ring=>ring.map(world));
    for(const key of ['p1','p2','tp'])if(r[key])r[key]=world(r[key]);
    if(r.txt && transforms.length){const o=world([0,0]), x=world([Math.cos(r.rotation||0),Math.sin(r.rotation||0)]);r.rotation=Math.atan2(x[1]-o[1],x[0]-o[0]);}
    out.push(r);
  };
  const t = e.constructor.name, L = e.layer?.name || '0'; const base = {L, t, h: e.handle?.toString(16) || null, top: top?.n || null, th: top?.h || null, ch: chain};
  try {
  if (t === 'Insert') { const name = effName(e.block); const tp = top || {n: name, h: e.handle.toString(16)};
    const id = ++IID; push({...base, id, t: 'INS', top: tp.n, th: tp.h, name, depth, p: [e.insertPoint.x, e.insertPoint.y], rot: e.rotation, sx: e.xScale, sy: e.yScale});
    if (depth < 6 && e.block) {
      // Sample local curves before transforming points: entity.applyTransform loses
      // reflected arc angles when a nested block has a negative axis scale.
      for (const s of e.block.getSortedEntities()) if(s.constructor.name!=='AttributeDefinition') emit(s,tp,depth+1,[...chain,id],[{applyTransform:p=>ocsPoint(e.getTransform().applyTransform(p),e.normal)},...transforms]);
      for (const s of e.attributes) emit(s,tp,depth+1,[...chain,id],transforms);
    } return; }
  if (t === 'Line') return push({...base, p: [[e.startPoint.x, e.startPoint.y], [e.endPoint.x, e.endPoint.y]]});
  if (t === 'Arc') return push({...base, p: arcPts(e.center, e.radius, e.startAngle, e.endAngle), arc: [e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle]});
  if (t === 'Circle') { const p = arcPts(e.center, e.radius, 0, Math.PI * 2); return push({...base, p, c: [e.center.x, e.center.y, e.radius]}); }
  if (t === 'LwPolyline') { const p = e.getPoints(64).map(q => [q.x,q.y]); if(e.isClosed && p.length)p.push(p[0]); return push({...base,p,closed:e.isClosed}); }
  if (t === 'Polyline2D' || t === 'Polyline3D') { const p = [...e.vertices].map(v => [v.location.x, v.location.y]); return push({...base, p}); }
  if (t === 'Ellipse') { const c = e.center, mj = e.majorAxisEndPoint || e.endPoint, ra = e.radiusRatio; const R = Math.hypot(mj.x, mj.y), ang = Math.atan2(mj.y, mj.x); const p = []; let a0 = e.startParameter ?? 0, a1 = e.endParameter ?? Math.PI * 2; if (a1 <= a0) a1 += Math.PI * 2; for (let i = 0; i <= 32; i++) { const a = a0 + (a1 - a0) * i / 32; const x = R * Math.cos(a), y = R * ra * Math.sin(a) * ((e.normal?.z ?? 1)<0 ? -1 : 1); p.push([c.x + x * Math.cos(ang) - y * Math.sin(ang), c.y + x * Math.sin(ang) + y * Math.cos(ang)]); } return push({...base, p}); }
  if (t === 'MText' || t === 'TextEntity' || t === 'AttributeEntity') { const ip = e.insertPoint || e.alignmentPoint; return push({...base, txt: textOf(e), p: [ip.x, ip.y], hgt: e.height, attachment: e.attachmentPoint ?? null, text_width: e.rectangleWidth ?? null, rotation: e.rotation ?? 0}); }
  if (t === 'Spline') { const cp = (e.fitPoints?.length ? e.fitPoints : e.controlPoints) || []; return push({...base, p: [...cp].map(q => [q.x, q.y])}); }
  if (t === 'Solid' || t === 'Face3D') { const q = [e.firstCorner, e.secondCorner, e.thirdCorner, e.fourthCorner].filter(Boolean); if (q.length) push({...base, p: q.map(v => [v.x, v.y]), fill: true}); return; }
  if (t.startsWith('Dimension')) { const r = {...base, t: 'DIM', kind: t, meas: e.measurement ?? null, txt: e.text || '', tp: e.textMiddlePoint ? [e.textMiddlePoint.x, e.textMiddlePoint.y] : null};
    if (e.firstPoint && e.secondPoint) { r.p1 = [e.firstPoint.x, e.firstPoint.y]; r.p2 = [e.secondPoint.x, e.secondPoint.y]; }
    try { r.shown = e.getMeasurementText(); } catch (_) {}
    return push(r); }
  if (t === 'Hatch') { const rings = []; for (const pa of e.paths || []) { try { const pts = pa.getPoints(8).map(q => [q.x, q.y]); if (pts.length > 2) rings.push(pts); } catch (_) {} }
    return push({...base, t: 'HATCH', pat: e.pattern?.name || '', solid: !!e.isSolid, rings}); }
  } catch (err) { push({...base, err: String(err).slice(0, 80)}); }
}
for (const e of doc.modelSpace.entities) emit(e, null, 0);
// paper-space text: sheet titles, scales, notes
const ps = [];
for (const r of brs.filter(r => r.name.startsWith('*Paper'))) for (const e of r.entities) {
  const t = e.constructor.name;
  if (t === 'MText' || t === 'TextEntity') { const ip = e.insertPoint || e.alignmentPoint; ps.push({t: 'PSTXT', sheet: r.name, L: e.layer?.name || '0', txt: textOf(e), p: [ip.x, ip.y]}); }
}
const h = doc.header || {};
const UNITS = {0: 'unitless', 1: 'inch', 2: 'foot', 4: 'mm', 5: 'cm', 6: 'm'};
const header = {reader: '@node-projects/acad-ts 3.9.0', insunits: h.insUnits, units: UNITS[h.insUnits] ?? String(h.insUnits), measurement: h.measurementUnits, linear_format: h.linearUnitFormat,
  version: fs.readFileSync(IN).subarray(0, 6).toString(), extmin: h.modelSpaceExtMin, extmax: h.modelSpaceExtMax,
  layers: [...doc.layers].map(l => l.name)};
fs.writeFileSync(OUT, JSON.stringify({units: header.units, header, n: out.length, rec: out, paper: ps}));
const c = {}; for (const r of out) c[r.t] = (c[r.t] || 0) + 1; console.log(out.length, JSON.stringify(c), 'units', header.units, header.version);
