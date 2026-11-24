#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{ROOT,load}=require('./config.cjs');
load();load(path.join(ROOT,'.env.design.local'));
const root=path.join(ROOT,'.atlas-design');fs.mkdirSync(root,{recursive:true,mode:0o700});
const target=path.join(root,'supabase-setup.sql');fs.writeFileSync(target,['019_design_library.sql','020_design_render_queue.sql','021_design_credits.sql'].map(n=>fs.readFileSync(path.join(ROOT,'supabase/migrations',n),'utf8')).join('\n'),{mode:0o600});
(async()=>{
 console.log('Prepared migration bundle: '+target);if(process.argv.includes('--prepare-only'))return;
 const base=process.env.SUPABASE_URL?.replace(/\/$/,''),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key){console.log('Supabase server connection is not configured. Local MVP remains available.');return;}
 const headers={apikey:key,Authorization:'Bearer '+key};let ready=true;
 for(const table of ['atlas_links','atlas_design_references','atlas_design_events','atlas_design_jobs','atlas_design_workers']){
  try{const r=await fetch(base+'/rest/v1/'+table+'?select=*&limit=0',{headers,signal:AbortSignal.timeout(10000)});console.log(table+': '+(r.ok?'available':'not ready (HTTP '+r.status+')'));if(!r.ok)ready=false;}catch{console.log(table+': connection unavailable');ready=false;}
 }
 console.log(ready?'Database tables are reachable. Private bucket/RPC readiness is verified when running the worker and publishing reviewed references.':'Required cloud action: run the prepared SQL in this Supabase project’s SQL Editor. This script makes no remote changes.');
})().catch(()=>{console.error('Configuration check failed. No remote changes were made.');process.exitCode=1;});
