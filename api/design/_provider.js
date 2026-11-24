'use strict';
// Higgsfield's documented multi-reference Image Edit endpoint. Never geometry authority.
const {error}=require('./_service');
const BASE='https://api.higgsfield.ai',MODEL='/kling-image/v4.0/edit';
const credential=()=>String(process.env.HIGGSFIELD_API_KEY||process.env.HF_KEY||process.env.HF_CREDENTIALS||'').trim().replace(/^Key\s+/i,'')||((process.env.HIGGSFIELD_API_KEY_ID||process.env.HF_API_KEY_ID)&&(process.env.HIGGSFIELD_API_KEY_SECRET||process.env.HF_API_KEY_SECRET)?(process.env.HIGGSFIELD_API_KEY_ID||process.env.HF_API_KEY_ID)+':'+(process.env.HIGGSFIELD_API_KEY_SECRET||process.env.HF_API_KEY_SECRET):'');
const ready=()=>!!credential();
function permitted(){if(process.env.ATLAS_DESIGN_ALLOW_PAID_ENHANCEMENT!=='1')throw error('Paid Higgsfield visualization is disabled. Native rendering remains available.',403);if(!ready())throw error('Configure HIGGSFIELD_API_KEY server-side.',503);}
function safeURL(value,apiOnly=false){let u;try{u=new URL(value);}catch{throw error('Invalid provider media URL.',502);}const host=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||host==='localhost'||host==='[::1]'||/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||(apiOnly&&u.origin!==BASE))throw error('Provider URL was rejected.',502);return u.href;}
function headers(){return {Authorization:'Key '+credential(),'Content-Type':'application/json'};}
async function upload(bytes,type,{fetchFn=fetch}={}){
 permitted();if(!['image/png','image/jpeg'].includes(type)||bytes.length>30*1024*1024)throw error('Higgsfield input must be JPG/PNG under 30 MB.');
 const r=await fetchFn(BASE+'/files/generate-upload-url',{method:'POST',headers:headers(),body:JSON.stringify({content_type:type}),signal:AbortSignal.timeout(30000)}),j=await r.json();if(!r.ok||!j.upload_url||!j.public_url)throw error('Higgsfield reference upload could not be prepared.',502);
 const put=await fetchFn(safeURL(j.upload_url),{method:'PUT',headers:j.upload_headers||{'Content-Type':type},body:bytes,credentials:'omit',signal:AbortSignal.timeout(60000)});if(!put.ok)throw error('Higgsfield reference upload failed.',502);
 return safeURL(j.public_url);
}
async function submitSuggestion({nativeImageURL,referenceImageURLs=[],prompt,idempotencyKey},{fetchFn=fetch}={}){
 permitted();const inputs=[nativeImageURL,...referenceImageURLs];if(inputs.length>10||!inputs.length)throw error('Select at most nine inspirations with the native render.');inputs.forEach(u=>safeURL(u));
 const r=await fetchFn(BASE+MODEL,{method:'POST',headers:{...headers(),'Idempotency-Key':idempotencyKey||require('crypto').randomUUID()},body:JSON.stringify({image_urls:inputs,prompt:String(prompt).slice(0,50000),resolution:'2k',aspect_ratio:'auto'}),signal:AbortSignal.timeout(30000)});
 const j=await r.json();if(!r.ok||!j.request_id||!j.status_url){const e=error('Higgsfield did not accept the visualization request.',502);e.providerTerminal=r.status>=400&&r.status<500&&![408,409,429].includes(r.status);throw e;}
 return {request_id:j.request_id,status_url:safeURL(j.status_url,true),cancel_url:j.cancel_url?safeURL(j.cancel_url,true):null,status:'suggestion_only',geometry_verified:false,model:MODEL,authority:'Native geometry only; AI output requires comparison and cannot replace native proof.'};
}
async function status(providerState,{fetchFn=fetch}={}){
 if(!ready())throw error('Higgsfield credential is unavailable.',503);
 const url=safeURL(providerState.status_url,true),r=await fetchFn(url,{headers:headers(),signal:AbortSignal.timeout(30000)});if(!r.ok)throw error('Higgsfield status is unavailable.',r.status===401?401:502);const j=await r.json();return {status:j.status,images:j.status==='completed'?(j.images||[]):[],geometry_verified:false};
}
async function cancel(providerState,{fetchFn=fetch}={}){
 if(!ready()||!providerState.cancel_url)throw error('Higgsfield cancellation is unavailable.',409);
 const r=await fetchFn(safeURL(providerState.cancel_url,true),{method:'POST',headers:headers(),signal:AbortSignal.timeout(30000)});if(!r.ok)throw error('The visualization has started or could not be cancelled.',409);return {status:'canceled'};
}
module.exports={submitSuggestion,status,upload,cancel,ready,safeURL,MODEL};
