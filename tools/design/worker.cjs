#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
const {ROOT,load}=require('./config.cjs');load(path.join(ROOT,'.env.design.local'));if(process.argv.includes('--supabase')){load();load(path.join(ROOT,'.env.design.local'));}else{process.env.SUPABASE_URL='';process.env.SUPABASE_SERVICE_ROLE_KEY='';process.env.CMS_DEV_STORE=process.env.CMS_DEV_STORE||path.join(ROOT,'.atlas-design/store.json');}
const jobs=require('../../api/design/_jobs'),store=require('../../api/cms/_store');
const worker=crypto.randomUUID(),blender=process.env.ATLAS_BLENDER_BIN||'/Applications/Blender.app/Contents/MacOS/Blender';
fs.mkdirSync(jobs.workspace(),{recursive:true,mode:0o700});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let stopped=false;process.on('SIGTERM',()=>stopped=true);process.on('SIGINT',()=>stopped=true);
function execute(args,log){return new Promise((resolve,reject)=>{const file=fs.openSync(log,'w',0o600),child=spawn(blender,args,{stdio:['ignore',file,file]});child.on('error',e=>{fs.closeSync(file);reject(e)});const timer=setTimeout(()=>{child.kill('SIGTERM');},240000);child.on('exit',code=>{clearTimeout(timer);fs.closeSync(file);code===0?resolve():reject(Error('Native Blender process failed ('+code+'). Inspect the private worker log.'));});});}
async function upload(bytes,object,type){const r=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1/object/atlas-design-private/'+object,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':type,'x-upsert':'true'},body:bytes});if(!r.ok)throw Error('Private result upload failed ('+r.status+').');return object;}
async function nativeResult(job,out){
 const input=path.join(out,'specification.json');
  await execute(['--background','--factory-startup','--threads',process.env.ATLAS_RENDER_THREADS||'4','--python',path.join(ROOT,'tools/design/render-native.py'),'--',input,out],path.join(out,'worker.log'));
  const metadata=JSON.parse(fs.readFileSync(path.join(out,'metadata.json'),'utf8')),image=fs.readFileSync(path.join(out,'native.png'));
  if(!metadata.geometry_unchanged||metadata.geometry_before!==metadata.geometry_after||metadata.source_sha256!==job.specification.context.source_sha256||metadata.scene_sha256!==job.specification.native_asset.sha256||metadata.image_sha256!==crypto.createHash('sha256').update(image).digest('hex'))throw Error('Native geometry/provenance checks failed.');
  const result={kind:'native-cad-concept',checks:metadata,local_image:path.join(out,'native.png'),local_metadata:path.join(out,'metadata.json')};
  if(store.MODE==='supabase'){result.storage_path=await upload(image,job.project+'/renders/'+job.id+'/native.png','image/png');await upload(Buffer.from(JSON.stringify(metadata)),job.project+'/renders/'+job.id+'/metadata.json','application/json');delete result.local_image;delete result.local_metadata;}
  return result;
}
async function run(job){
 const out=path.join(jobs.workspace(),'renders',job.id);fs.mkdirSync(out,{recursive:true,mode:0o700});const input=path.join(out,'specification.json');fs.writeFileSync(input,JSON.stringify(job.specification),{mode:0o600});
 const renew=setInterval(()=>jobs.update(job.id,{status:'running',lease_owner:worker},{lease_expires_at:new Date(Date.now()+300000).toISOString()}).catch(()=>{}),20000);
 try{
  if(job.specification.engine==='meeting-visualization'){
   const latest=await jobs.one({id:job.id});let native=latest.provider_state?.native_result;
   if(!native){native=await nativeResult(job,out);if(!await jobs.update(job.id,{status:'running',lease_owner:worker},{provider_state:{...(latest.provider_state||{}),native_result:native}}))throw Error('Worker lease changed while retaining the native input.');}
   const nativeInput={sha256:native.checks.image_sha256,storage_path:native.storage_path,local_object:native.local_image,mime:'image/png'};
   const current=await jobs.one({id:job.id});const combined={...current,specification:{...job.specification,native_input:nativeInput,native_parent_id:job.id}};
   const result=await require('./enhance.cjs').run(combined,worker,out,upload);result.native=native;
   await require('../../api/design/_credits').settle(job.id,worker,result);console.log('Meeting visualization retained; one application demo credit charged: '+job.id);return;
  }
  if(job.specification.engine==='higgsfield-image-edit'){const result=await require('./enhance.cjs').run(job,worker,out,upload);await jobs.update(job.id,{status:'running',lease_owner:worker},{status:'review_required',result,error:null,completed_at:new Date().toISOString(),lease_owner:null,lease_expires_at:null});console.log('Higgsfield visualization retained for comparison: '+job.id);return;}
  const result=await nativeResult(job,out);
  await jobs.update(job.id,{status:'running',lease_owner:worker},{status:'review_required',result,error:null,completed_at:new Date().toISOString(),lease_owner:null,lease_expires_at:null});
  console.log('Native result ready for review: '+job.id);
 }catch(e){
  if(job.specification.engine==='meeting-visualization'){
   const current=await jobs.one({id:job.id});
   if(e.providerTerminal||!current.provider_state?.submission){try{await require('../../api/design/_credits').settle(job.id,worker,null,String(e.message));}catch{await jobs.update(job.id,{status:'running',lease_owner:worker},{status:'reconciling',error:'Credit settlement requires reconciliation; no new charge submitted.',lease_owner:null,lease_expires_at:null});}}
   else await jobs.update(job.id,{status:'running',lease_owner:worker},{status:'reconciling',error:'Provider request or output retention needs reconciliation. Your application credit remains reserved; resume this same job without a new submission.',lease_owner:null,lease_expires_at:null});
  }else await jobs.update(job.id,{status:'running',lease_owner:worker},{status:'failed',error:String(e.message).slice(0,500),completed_at:new Date().toISOString(),lease_owner:null,lease_expires_at:null});
  console.error('Generation needs attention: '+job.id+' · '+e.message);
 }
 finally{clearInterval(renew);await jobs.release(job);}
}
(async()=>{
 if(!fs.existsSync(blender))throw Error('Set ATLAS_BLENDER_BIN to an installed Blender executable.');
 await execute(['--background','--factory-startup','--python-expr',"import bpy; print('ATLAS_WORKER_RUNTIME_READY')"],path.join(jobs.workspace(),'runtime-check.log'));
 await jobs.heartbeat(worker);const beat=setInterval(()=>jobs.heartbeat(worker).catch(()=>{}),5000);
 console.log('Atlas native worker ready ('+store.MODE+').');
 try{while(!stopped){const job=await jobs.claim(worker);if(job)await run(job);else if(process.argv.includes('--once'))break;else await sleep(1500);}}finally{clearInterval(beat);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
