import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const ids=['723-avenue','corporate-avenue','privilon'];
const base='media/flipkart-andheri';
function glb(url){
 const bytes=fs.readFileSync(path.join(root,url));
 assert.equal(bytes.toString('ascii',0,4),'glTF',url);
 assert.equal(bytes.readUInt32LE(4),2,url);assert.equal(bytes.readUInt32LE(8),bytes.length,url);
 assert.equal(bytes.readUInt32LE(16),0x4e4f534a,url);
 const data=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 for(const a of data.accessors||[])for(const v of [...a.min||[],...a.max||[]])assert(Number.isFinite(v),url);
 return {data,bytes:bytes.length};
}
// Calculate scene bounds after accessor normalization and node transforms. This
// catches a ceiling exported around object origin instead of above its floor.
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b){return Array.from({length:16},(_,i)=>{const row=i%4,col=Math.floor(i/4);return [0,1,2,3].reduce((s,k)=>s+a[k*4+row]*b[col*4+k],0);});}
function transform(n){
 if(n.matrix)return n.matrix;
 const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,
  2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,
  2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];
}
function bounds(g){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 function walk(i,parent){
  const n=g.nodes[i],m=multiply(parent,transform(n));
  if(n.mesh!=null)for(const p of g.meshes[n.mesh].primitives){
   const a=g.accessors[p.attributes.POSITION];assert(a.min&&a.max,'Position bounds required');
   const denominator=a.normalized?({5120:127,5121:255,5122:32767,5123:65535}[a.componentType]||1):1;
   for(let corner=0;corner<8;corner++){
    const v=[0,1,2].map(j=>(corner&(1<<j)?a.max[j]:a.min[j])/denominator);
    for(let j=0;j<3;j++){const value=m[j]*v[0]+m[j+4]*v[1]+m[j+8]*v[2]+m[j+12];min[j]=Math.min(min[j],value);max[j]=Math.max(max[j],value);}
   }
  }
  for(const child of n.children||[])walk(child,m);
 }
 for(const i of g.scenes[g.scene||0].nodes||[])walk(i,identity);
 assert([...min,...max].every(Number.isFinite));return {min,max};
}
const manifest=read(`${base}/cad/manifest.json`);
assert.deepEqual(Object.keys(manifest.properties).sort(),['723-avenue','corporate-avenue','privilon']);
const expected={'723-avenue':[[168,82],[168,116],[168,132]],'corporate-avenue':[[152,114],[152,129],[150,223]],privilon:[[260],[280],[301]]};
let plans=0,cadPlans=0;
for(const [id,property] of Object.entries(manifest.properties)){
 assert.equal(property.variants.length,3);
 property.variants.forEach((variant,vi)=>{
  assert.deepEqual(variant.plans.map(p=>p.workstations),expected[id][vi]);
  assert.equal(variant.plans.reduce((s,p)=>s+p.workstations,0),variant.workstations);
  for(const p of variant.plans){
   const cad=read(`${base}/cad/${p.file}`),semantic=read(`${base}/cad/${p.semantic}`),audit=p.model?read(`${base}/interiors/${p.id}-audit.json`):null;
   assert.equal(cad.source.sha256,variant.source_sha256);assert.equal(semantic.source.sha256,variant.source_sha256);
   assert.equal(cad.source.metres_per_drawing_unit,id==='corporate-avenue'?.0254:.001);
   assert.equal(cad.totals.work_seats,p.workstations);assert.equal(cad.desk_audit.count,p.workstations);
   assert.equal(semantic.desks.length,p.workstations);assert.equal(new Set(semantic.desks.map(d=>d.source_insert_id)).size,p.workstations);
   cadPlans++;
   if(!p.model){assert.equal(id,'723-avenue');assert([13,14].includes(p.floor_level));assert.equal(semantic.source.floor_level,p.floor_level);assert.equal(cad.desk_footprints.length,p.workstations);assert(cad.minimal_details);continue;}
   assert.equal(audit.workstations,p.workstations);assert.equal(audit.task_chairs,semantic.task_chairs.length);
   assert(audit.alignment_audit.max_desktop_xy_error_m<.001);assert.equal(semantic.height_m,null);
   assert(cad.minimal_details);assert(semantic.desks.every(d=>d.desktop_polygon_m?.length>=4));
   const interior=glb(p.model.slice(1)),ceiling=glb(p.ceiling.slice(1));
   assert(interior.bytes<50e6);assert(interior.data.meshes.length<=60);
   assert.equal(audit.reductions?.bevel_omission,false);
   for(const name of ['EXT_meshopt_compression','KHR_draco_mesh_compression','KHR_mesh_quantization'])assert(!interior.data.extensionsUsed?.includes(name),`${p.id}: unwanted geometry reduction`);
   for(const mesh of interior.data.meshes)for(const prim of mesh.primitives)assert.equal(interior.data.accessors[prim.attributes.POSITION].componentType,5126);
   const box=bounds(interior.data),roof=bounds(ceiling.data),[x0,y0,x1,y1]=semantic.bounds_m;
   for(const [axis,lo,hi] of [[0,x0,x1],[2,-y1,-y0]]){
    assert(Math.abs(box.min[axis]-lo)<.01&&Math.abs(box.max[axis]-hi)<.01,`${p.id}: floor bounds`);
    assert(Math.abs(roof.min[axis]-lo)<.01&&Math.abs(roof.max[axis]-hi)<.01,`${p.id}: ceiling XY alignment`);
   }
   assert(Math.abs((roof.min[1]+roof.max[1])/2-audit.deck_clear_height_m)<.1,`${p.id}: ceiling elevation`);
   assert(interior.data.materials.some(m=>m.extensions?.KHR_materials_transmission),'Glass transmission missing');
   plans++;
  }
 });
}
assert.equal(plans,9);assert.equal(cadPlans,15);
for(const id of ids){
 const context=glb(`${base}/concept/${id}/context.glb`),meta=read(`${base}/concept/${id}/metadata.json`);
 assert.equal(meta.radius_m,600);assert.equal(meta.source_extract.source_file,'western-zone-261120.osm.pbf');
 assert.equal(meta.source_extract.source_sha256,'f739b9c8a20f709c76e59033584e25b743bb93dc178824b5c6cd40cb5a0211c4');
 assert.equal(meta.source_extract.source_header.timestamp,'2026-11-20T21:21:21Z');
 assert.equal(meta.source_extract.processing_errors.length,0);assert(context.bytes<15e6);
 const b=bounds(context.data);for(const axis of [0,2])assert(b.min[axis]>=-600.05&&b.max[axis]<=600.05,'Uncropped map geometry');
 const exterior=glb(`${base}/exteriors/${id}.glb`);assert(exterior.data.nodes.some(n=>n.name===`opt_${id}`));
 assert(exterior.data.materials.some(m=>m.name?.startsWith('ANDHERI_')));
 const study=read(`${base}/exteriors/${id}.json`).modelReview?.photoReconstruction;
 if(study){
  assert(/reconstruction/i.test(study.classification),'Photo study must identify reconstructed context');
  assert.equal(study.bakedProps.trees,true,'Baked vegetation must not be instanced again by the viewer');
  assert.equal(study.aerial.uv_channel,2);
  assert(study.aerial.bbox_wgs84.length===4&&study.aerial.bbox_wgs84.every(Number.isFinite));
  for(const name of ['EXT_meshopt_compression','KHR_draco_mesh_compression','KHR_mesh_quantization'])assert(!exterior.data.extensionsUsed?.includes(name),`${id}: reconstructed geometry was reduced`);
  let aerialPrimitives=0;
  for(const mesh of exterior.data.meshes)for(const prim of mesh.primitives){
   assert.equal(exterior.data.accessors[prim.attributes.POSITION].componentType,5126,`${id}: native positions required`);
   const material=exterior.data.materials[prim.material];
   if(/^ANDHERI_CTX_AERIAL_(?:DETAIL_)?(GROUND|ROOF)$/.test(material?.name||'')){
    aerialPrimitives++;const uv=exterior.data.accessors[prim.attributes.TEXCOORD_2];
    assert(uv&&uv.componentType===5126&&uv.count===exterior.data.accessors[prim.attributes.POSITION].count,`${id}: aerial UV2 missing or reduced`);
   }
  }
  assert(aerialPrimitives>=1,`${id}: aerial ground UVs required`);
  assert(!(exterior.data.images||[]).some(i=>/satellite|google|earth|mapbox/i.test((i.name||'')+' '+(i.uri||''))),`${id}: provider imagery must stream separately`);
 }
}
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'engine/atlases/flipkart-andheri.js'),'utf8'),sandbox);
const world=sandbox.window.ATLAS.meta.world;
assert.deepEqual(Object.keys(world.thumbs).sort(),[...ids].sort());assert.deepEqual(Object.keys(world.models).sort(),[...ids].sort());
assert.equal(world.contexts.reviewOnly,true,'Raw map massing must stay in internal review');assert.equal(world.cad['723-avenue'],undefined);assert.equal(world.mapHref,'/flipkart-andheri-east');
console.log(`PASS: 9 DWG options / ${cadPlans} CAD drawings / ${plans} CAD-aligned interiors and ceilings / 3 PBF contexts / 3 exterior studies.`);
