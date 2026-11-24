'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),provider=require('../../api/design/_provider'),jobs=require('../../api/design/_jobs'),store=require('../../api/cms/_store');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function bytes(asset){
 let value;
 if(store.MODE==='dev'){
  const file=fs.realpathSync(asset.local_object),root=fs.realpathSync(jobs.workspace());if(!file.startsWith(root+path.sep))throw Error('Private enhancement input is outside the workspace.');value=fs.readFileSync(file);
 }else{
  const object=asset.storage_path.split('/').map(encodeURIComponent).join('/'),r=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1/object/authenticated/atlas-design-private/'+object,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Private enhancement input is unavailable.');value=Buffer.from(await r.arrayBuffer());
 }
 if(crypto.createHash('sha256').update(value).digest('hex')!==asset.sha256)throw Error('Enhancement input hash changed.');return value;
}
async function run(job,worker,out,upload){
 const spec=job.specification;if(!spec.paid_authorization?.explicit_single_request)throw Error('This visualization has no explicit single-request payment authorization.');
 let state=job.provider_state?.request_id?job.provider_state:null;
 if(!state){
  const assets=[spec.native_input,...spec.reference_assets],urls=job.provider_state?.submission?.image_urls?.slice()||[];
  if(!urls.length)for(const asset of assets)urls.push(await provider.upload(await bytes(asset),asset.mime));
  const prompt='@image_1 is the authoritative CAD-based native room composition. Produce one proposed office visualization, maintaining this room type, shell, openings and camera composition. Do not invent exterior buildings, surroundings, changed room dimensions or unrelated rooms. Images @image_2 onward are inspiration only: borrow only the selected features listed for each. These instructions are intent, not verified geometry. '+spec.reference_assets.map((r,i)=>'@image_'+(i+2)+': '+r.features.join(', ')).join('. ')+' Client comments: '+spec.proposal.comments+'. Do not add text, logos, watermarks or people.';
  const intent={...(job.provider_state||{}),submission:{idempotency_key:job.id,image_urls:urls,prompt_sha256:crypto.createHash('sha256').update(prompt).digest('hex'),prepared_at:job.provider_state?.submission?.prepared_at||new Date().toISOString()}};
  if(job.provider_state?.submission&&Date.now()-Date.parse(intent.submission.prepared_at)>23*3600000)throw Error('Submission needs operator reconciliation before the provider idempotency window expires.');
  if(!await jobs.update(job.id,{status:'running',lease_owner:worker},{provider_state:intent}))throw Error('Worker lease changed before provider submission.');
  state=await provider.submitSuggestion({nativeImageURL:urls[0],referenceImageURLs:urls.slice(1),prompt,idempotencyKey:job.id});
  state={...intent,...state};if(!await jobs.update(job.id,{status:'running',lease_owner:worker},{provider_state:state}))throw Error('Provider request needs reconciliation after a worker lease change.');
 }
 let response,delay=2000;const started=Date.now();
 while(Date.now()-started<240000){response=await provider.status(state);if(['completed','failed','nsfw','canceled'].includes(response.status))break;await sleep(delay);delay=Math.min(10000,delay*1.5);}
 if(response?.status!=='completed'){if(response&&['failed','nsfw','canceled'].includes(response.status)){const e=Error('Higgsfield visualization ended: '+response.status);e.providerTerminal=true;throw e;}throw Error('Higgsfield remains in progress. The saved request can be resumed without submitting a new generation.');}
 const url=provider.safeURL(response.images?.[0]?.url),r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Higgsfield output could not be retained.');
 const image=Buffer.from(await r.arrayBuffer()),type=r.headers.get('content-type')?.split(';')[0];if(!['image/png','image/jpeg'].includes(type)||image.length>30*1024*1024)throw Error('Higgsfield returned an unsupported output.');
 const ext=type==='image/png'?'png':'jpg',target=path.join(out,'visualization.'+ext);fs.writeFileSync(target,image,{mode:0o600});
 const checks={geometry_verified:false,geometry_unchanged:false,authority:'AI visualization only; native scene and image remain authoritative.',native_parent_id:spec.native_parent_id,source_sha256:spec.context.source_sha256,reference_hashes:spec.reference_assets.map(a=>a.sha256),provider:'higgsfield',model:provider.MODEL,request_id:state.request_id,image_sha256:crypto.createHash('sha256').update(image).digest('hex'),assumptions:spec.assumptions};
 fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(checks,null,2),{mode:0o600});const result={kind:'ai-visualization',mime:type,checks,local_image:target,local_metadata:path.join(out,'metadata.json')};
 if(store.MODE==='supabase'){result.storage_path=await upload(image,job.project+'/renders/'+job.id+'/visualization.'+ext,type);await upload(Buffer.from(JSON.stringify(checks)),job.project+'/renders/'+job.id+'/metadata.json','application/json');delete result.local_image;delete result.local_metadata;}
 return result;
}
module.exports={run};
