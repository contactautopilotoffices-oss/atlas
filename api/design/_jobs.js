'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),store=require('../cms/_store');
const {error}=require('./_service');
const workspace=()=>path.resolve(process.env.ATLAS_DESIGN_WORKSPACE||path.join(__dirname,'../../.atlas-design'));
const jobsDir=()=>{const p=path.join(workspace(),'jobs');fs.mkdirSync(p,{recursive:true,mode:0o700});return p;};
const valid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
const file=id=>{if(!valid(id))throw error('Invalid job identifier.');return path.join(jobsDir(),id+'.json');};
function atomic(target,value){const temp=target+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600});fs.renameSync(temp,target);}
async function list(eq={}){
 if(store.MODE==='supabase')return store.select('atlas_design_jobs',{eq,order:'created_at.desc',limit:500});
 return fs.readdirSync(jobsDir()).filter(n=>/^[0-9a-f-]+\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(jobsDir(),n),'utf8'))).filter(r=>Object.entries(eq).every(([k,v])=>r[k]===v)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
}
async function one(eq){return (await list(eq))[0]||null;}
async function insert(job){
 const previous=await one({project:job.project,owner_id:job.owner_id,request_key:job.request_key});if(previous)return previous;
 if(store.MODE==='supabase'){
  try{return (await store.insert('atlas_design_jobs',job))[0];}catch(e){if(/duplicate|unique/.test(e.message))return one({project:job.project,owner_id:job.owner_id,request_key:job.request_key});throw e;}
 }
 fs.writeFileSync(file(job.id),JSON.stringify(job),{flag:'wx',mode:0o600});return job;
}
async function update(id,eq,patch){
 if(store.MODE==='supabase')return (await store.update('atlas_design_jobs',{eq:{id,...eq}},patch))[0]||null;
 const target=file(id);if(!fs.existsSync(target))return null;const job=JSON.parse(fs.readFileSync(target,'utf8'));if(!Object.entries(eq).every(([k,v])=>job[k]===v))return null;
 const next={...job,...patch};atomic(target,next);return next;
}
async function claim(worker){
 if(store.MODE==='supabase'){
  const r=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/claim_atlas_design_job',{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({worker_id:worker,lease_seconds:300})});
  if(!r.ok)throw error('Render claim RPC is unavailable; apply migration 020.',503);return (await r.json())[0]||null;
 }
 const rows=(await list()).filter(j=>j.status==='queued'||(j.status==='running'&&Date.parse(j.lease_expires_at||0)<Date.now())).reverse();
 for(const job of rows){
  const lock=file(job.id)+'.lock';try{fs.mkdirSync(lock);}catch{try{if(Date.now()-fs.statSync(lock).mtimeMs>300000){fs.rmdirSync(lock);}}catch{}continue;}
  const latest=JSON.parse(fs.readFileSync(file(job.id),'utf8'));
  if(!['queued','running'].includes(latest.status)){fs.rmdirSync(lock);continue;}
  if((latest.attempts||0)>=3){await update(job.id,{}, {status:'failed',error:'Worker retry limit reached.'});fs.rmdirSync(lock);continue;}
  return update(job.id,{}, {status:'running',lease_owner:worker,lease_expires_at:new Date(Date.now()+300000).toISOString(),attempts:(latest.attempts||0)+1,started_at:new Date().toISOString()});
 }return null;
}
async function release(job){if(store.MODE==='dev')try{fs.rmdirSync(file(job.id)+'.lock');}catch{}}
async function heartbeat(worker){
 const row={id:worker,last_seen_at:new Date().toISOString(),capabilities:['native-blender-cad-concept']};
 if(store.MODE==='supabase')await store.upsert('atlas_design_workers',row,'id');else atomic(path.join(jobsDir(),'worker-'+worker+'.heartbeat'),row);
}
async function ready(){
 if(store.MODE==='supabase'){try{return (await store.select('atlas_design_workers',{gte:{last_seen_at:new Date(Date.now()-30000).toISOString()},limit:1})).length>0;}catch{return false;}}
 return fs.readdirSync(jobsDir()).filter(n=>n.endsWith('.heartbeat')).some(n=>{try{return Date.now()-Date.parse(JSON.parse(fs.readFileSync(path.join(jobsDir(),n),'utf8')).last_seen_at)<30000;}catch{return false;}});
}
function publicJob(job){if(!job)throw error('This job changed. Refresh before reviewing.',409);const copy=structuredClone(job);delete copy.owner_id;delete copy.lease_owner;delete copy.lease_expires_at;if(copy.result?.native){delete copy.result.native.local_image;delete copy.result.native.storage_path;delete copy.result.native.local_metadata;}if(copy.result){delete copy.result.local_image;delete copy.result.storage_path;delete copy.result.local_metadata;}delete copy.specification?.native_asset;delete copy.specification?.native_input;delete copy.specification?.reference_assets;if(copy.provider_state)copy.provider_state={request_id:copy.provider_state.request_id,model:copy.provider_state.model};return copy;}
module.exports={workspace,atomic,list,one,insert,update,claim,release,heartbeat,ready,publicJob,valid};
