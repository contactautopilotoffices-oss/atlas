'use strict';
const store=require('../cms/_store'),{error}=require('./_service');
async function rpc(name,body,{fetchFn=fetch}={}){
 if(store.MODE!=='supabase')throw error('The one-credit demo needs the configured private cloud database. No paid request was submitted.',503);
 const r=await fetchFn(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 if(!r.ok){const j=await r.json().catch(()=>({}));if(/No available|already in use/.test(j.message||''))throw error('Your demo credit is already reserved or used.',409);throw error('The private generation ledger is unavailable or this room has no demo allowance. Apply the design schema and grant the scoped demo credit.',503);}return r.status===204?null:r.json();
}
async function balance(project,owner,context){
 if(store.MODE!=='supabase')return {available:0,reserved:0,used:0,granted:0,ready:false,reason:'Cloud generation ledger is not active.'};
 try{const grants=await store.select('atlas_design_credit_grants',{eq:{project,owner_id:owner},limit:100});const grant=grants.find(g=>JSON.stringify(g.context)===JSON.stringify(context)||Object.keys(context).every(k=>g.context[k]===context[k]));if(!grant)return {available:0,reserved:0,used:0,granted:0,ready:true,reason:'No demo allowance granted for this room.'};const reservations=await store.select('atlas_design_credit_reservations',{eq:{grant_id:grant.grant_id},limit:100}),active=reservations.filter(r=>r.status==='reserved').length,used=reservations.filter(r=>r.status==='charged').length;return {grant_id:grant.grant_id,available:Math.max(0,1-active-used),reserved:active,used,granted:1,ready:true,label:'One application demo credit; provider billing is separate.'};}catch{return {available:0,reserved:0,used:0,granted:0,ready:false,reason:'Cloud generation ledger needs setup.'};}
}
async function reserve(job,grant,options){return (await rpc('reserve_atlas_design_generation',{p_job:job,p_grant_id:grant},options))[0];}
async function settle(id,worker,result,failure=null,options){return (await rpc('settle_atlas_design_generation',{p_job_id:id,p_worker:worker,p_result:result,p_failure:failure},options))[0];}
module.exports={rpc,balance,reserve,settle};
