#!/usr/bin/env node
'use strict';
// Explicit operator-run private import. Never runs in an application build.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{load,ROOT}=require('./config.cjs');load();load(path.join(ROOT,'.env.design.local'));const store=require('../../api/cms/_store');
(async()=>{
 if(!process.argv.includes('--apply'))throw Error('Usage: node tools/design/publish.cjs <classified-index.json> --apply. Imports originals privately, preserving pending review states.');
 const index=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));if(store.MODE!=='supabase')throw Error('Configure server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
 const base=process.env.SUPABASE_URL.replace(/\/$/,''),headers={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY};
 const table=await fetch(base+'/rest/v1/atlas_design_references?select=id&limit=0',{headers});if(!table.ok)throw Error('Apply the prepared Supabase schema before importing any originals.');
 const bucket=await fetch(base+'/storage/v1/bucket/atlas-design-private',{headers});const config=await bucket.json();if(!bucket.ok||config.public!==false)throw Error('The atlas-design-private bucket must exist and be private before import.');
 let done=0;
 for(const input of index.references){
  const row=structuredClone(input),record=row.record;if(!['pending','reviewed','rejected'].includes(row.review_status)||!row.allowed_projects?.length||!record.source_id||!record.image_sha256)throw Error('Reference lacks provenance or explicit project scope.');
  const bytes=fs.readFileSync(record.local_object);if(crypto.createHash('sha256').update(bytes).digest('hex')!==record.image_sha256)throw Error('Source image changed; rerun ingestion and review.');
  const ext=path.extname(record.local_object).toLowerCase();record.storage_path='references/'+record.image_sha256+ext;const type=ext==='.png'?'image/png':['.jpg','.jpeg'].includes(ext)?'image/jpeg':ext==='.webp'?'image/webp':'application/octet-stream';
  const r=await fetch(base+'/storage/v1/object/atlas-design-private/'+record.storage_path,{method:'POST',headers:{...headers,'Content-Type':type,'x-upsert':'false'},body:bytes});
  if(!r.ok){const problem=await r.json().catch(()=>({}));if(r.status!==409&&problem.statusCode!=='409'&&problem.error!=='Duplicate'&&!/already exists|duplicate/i.test(problem.message||''))throw Error('Private original upload failed (HTTP '+r.status+'). Resume this command after resolving storage limits.');}
  delete record.local_object;await store.upsert('atlas_design_references',row,'id');done++;
 }
 console.log('Imported '+done+' source-linked records/original images into private Supabase storage. Pending and human-review states were retained. No shared-library promotion occurred.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
