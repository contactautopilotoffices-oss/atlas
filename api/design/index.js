'use strict';
const fs=require('fs');
const path=require('path');
const auth=require('../cms/_auth');
const S=require('./_service');
const {store,error}=S;
const {authoritativeRoom,renderSpecification,referenceRoomType,sha}=require('./_scene');
const jobs=require('./_jobs');
async function principal(req,project){
 const admin=await auth.currentUser(req);
 if(admin&&auth.canLink(admin,project))return {id:'staff:'+admin.id,editor:auth.atLeast(admin,'editor')};
 const access=auth.accessOf(req);
 if(access?.slug===project&&access.aid){
  const credential=await store.one('atlas_access',{eq:{access_id:access.aid,link_slug:project,active:true}});
  if(credential)return {id:'client:'+access.aid,editor:false};
 }
 // Explicit loopback-only review mode; never enabled on Vercel.
 if(!process.env.VERCEL&&project==='flipkart-andheri'&&process.env.ATLAS_DESIGN_LOCAL_PREVIEW==='1'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress))return {id:'local-review',editor:true};
 throw error('Sign in to this project to save choices and access its reference library.',401);
}
async function references(){
 if(!process.env.VERCEL&&store.MODE==='dev'&&process.env.ATLAS_DESIGN_LOCAL_INDEX){
  return JSON.parse(fs.readFileSync(process.env.ATLAS_DESIGN_LOCAL_INDEX,'utf8')).references;
 }
 const result=await store.selectAll('atlas_design_references',{},10000);
 if(result.capped)throw error('Reference library requires paginated retrieval.',503);
 return result.rows;
}
function publicReference(r){
 const record=structuredClone(r.record);
 delete record.local_object;delete record.storage_path;delete record.allowed_projects;
 return {...record,id:r.id,room_type:r.room_type,offering_tier:r.offering_tier,review_status:r.review_status};
}
async function body(req){
 if(req.body&&typeof req.body==='object')return req.body;
 if(typeof req.body==='string')return JSON.parse(req.body);
 let value='';for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>100000)throw error('Request too large.',413);}return value?JSON.parse(value):{};
}
async function image(req,res,row){
 const record=row.record;
 if(!process.env.VERCEL&&store.MODE==='dev'&&record.local_object){
  const target=fs.realpathSync(record.local_object),root=fs.realpathSync(process.env.ATLAS_DESIGN_LOCAL_OBJECTS||'/tmp/atlas-reference-library/objects');
  if(!target.startsWith(root+path.sep))throw error('Invalid object.',403);
  const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'},type=types[path.extname(target).toLowerCase()];if(!type)throw error('This original format needs a reviewed raster preview.',415);res.setHeader('Content-Type',type);return res.end(fs.readFileSync(target));
 }
 if(!record.storage_path)throw error('Reference image is awaiting private storage upload.',503);
 const object=record.storage_path.split('/').map(encodeURIComponent).join('/');
 const r=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1/object/sign/atlas-design-private/'+object,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})});
 const j=await r.json();if(!r.ok||!j.signedURL)throw error('Private image is unavailable.',502);
 res.statusCode=302;res.setHeader('Location',process.env.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1'+j.signedURL);res.end();
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const url=new URL(req.url,'http://local'),q=url.searchParams,project=q.get('project');
  if(!/^[a-z0-9][a-z0-9-]{0,39}$/.test(project||''))throw error('Project is required.');
  const link=await store.one('atlas_links',{eq:{slug:project,status:'live'}});if(!link)throw error('Project is unavailable.',404);
  const user=await principal(req,project),requestedOwner=user.editor&&q.get('owner')?q.get('owner'):user.id;const route=q.get('r')||'references';
  if(!['GET','POST'].includes(req.method))throw error('Method not allowed.',405);
  if(req.method==='POST'&&req.headers['x-atlas-design']!=='1')throw error('Write header required.',403);
  let result;
  if(route==='local-preview'&&req.method==='GET'){if(user.id!=='local-review')throw error('Local preview is unavailable.',403);result={local_preview:true,project};}
  else if(route==='status'&&req.method==='GET'){const ready=await jobs.ready();result={storage:store.MODE,tiers:S.TIERS,editor:user.editor,provider:'higgsfield',native_renderer:'blender',higgsfield_model:require('./_provider').MODEL,higgsfield_enabled:ready&&require('./_provider').ready()&&process.env.ATLAS_DESIGN_ALLOW_PAID_ENHANCEMENT==='1',higgsfield_key_configured:require('./_provider').ready(),higgsfield_paid_authorized:process.env.ATLAS_DESIGN_ALLOW_PAID_ENHANCEMENT==='1',higgsfield_list_price_usd:.063,credential_configured:require('../cms/_images').ready(),render_worker_configured:ready,generation_enabled:ready,reason:ready?'Native CAD concept rendering available; designer review required.':'Start the dedicated native render worker.'};}
  else if(route==='choices'&&req.method==='GET'){
   const context={property:q.get('property'),plan:q.get('plan'),room_id:q.get('room_id'),source_sha256:q.get('source_sha256'),room_type:q.get('room_type')},room=authoritativeRoom(project,context),roomType=referenceRoomType(project,context),all=await references();
   const permitted=S.TIERS.flatMap(tier=>S.scopeReferences(all,{project,roomType,tier}));
   result={context,room,reference_room_type:roomType,tiers:S.TIERS,references:permitted.map(r=>({...publicReference(r),configuration:require('./_generation').configuration(r)})),scope:'All permitted source projects and supplied offerings; no cross-project client sessions included.'};
  }
  else if(route==='generation-status'&&req.method==='GET'){
   const context={property:q.get('property'),plan:q.get('plan'),room_id:q.get('room_id'),source_sha256:q.get('source_sha256'),room_type:q.get('room_type')};authoritativeRoom(project,context);let nativeReady=true,nativeReason='';try{require('./_generation').cameraFor(project,context);}catch(e){nativeReady=false;nativeReason=e.message;}
   const provider=require('./_provider'),credit=await require('./_credits').balance(project,user.id,context),worker=await jobs.ready();result={storage:store.MODE,credit,native_ready:nativeReady,worker_ready:worker,provider_ready:provider.ready()&&process.env.ATLAS_DESIGN_ALLOW_PAID_ENHANCEMENT==='1',configuration_version:require('./_generation').CONFIG_VERSION,provider_list_price_usd:.063,reason:!nativeReady?nativeReason:!credit.ready?credit.reason:!provider.ready()?'Higgsfield server credentials are not configured.':process.env.ATLAS_DESIGN_ALLOW_PAID_ENHANCEMENT!=='1'?'Paid generation is not enabled.':!worker?'The generation worker is offline.':credit.available<1?credit.reason||'Your demo credit is reserved or used.':''};
  }
  else if(route==='visualize'&&req.method==='POST'){
   const b=await body(req),event=await store.one('atlas_design_events',{eq:{project,owner_id:user.id,session_id:b.session_id},order:'revision.desc'});if(!event||event.id!==b.event_id)throw error('Submit the current room choice and configuration before generating.',409);
   const request_key=sha('meeting-demo-v1:'+event.id),existing=await jobs.one({project,owner_id:user.id,request_key});if(existing){result={job:jobs.publicJob(existing)};}else{
    if(store.MODE!=='supabase')throw error('Cloud persistence and the credit ledger must be active before paid generation.',503);
    if(process.env.ATLAS_DESIGN_LEGACY_ENHANCEMENT!=='1')throw error('Use the meeting-room Generate action with its scoped application credit.',410);
   const provider=require('./_provider');if(!provider.ready())throw error('Higgsfield server credentials are not configured. No paid request was submitted.',503);if(process.env.ATLAS_DESIGN_ALLOW_PAID_ENHANCEMENT!=='1')throw error('Paid generation is not enabled.',403);if(!await jobs.ready())throw error('The generation worker is offline.',503);if(b.authorize_one_demo_credit!==true)throw error('Confirm one application demo credit for this generation.',403);
    const refs=S.scopeReferences(await references(),{project,roomType:referenceRoomType(project,event.state.context),tier:event.state.tier}),spec=require('./_generation').build(project,event,refs),credit=await require('./_credits').balance(project,user.id,event.state.context);if(!credit.grant_id)throw error(credit.reason||'No demo allowance was granted for this room.',409);
    const selected=spec.proposal.borrowed[0],row=refs.find(r=>r.id===selected.reference_id),r=row.record,d=r.image_dimensions;if(!d||Math.min(d.width,d.height)<300||d.width/d.height<.4||d.width/d.height>2.5)throw error('Select a source image that meets the provider image-size limits.',422);const ext=path.extname(r.local_object||r.storage_path||r.source_member).toLowerCase();if(!['.jpg','.jpeg','.png'].includes(ext))throw error('Select a JPG or PNG reference.',422);
    spec.reference_assets=[{reference_id:row.id,source_id:r.source_id,sha256:r.image_sha256,features:selected.features,mime:ext==='.png'?'image/png':'image/jpeg',storage_path:r.storage_path}];if(!r.storage_path)throw error('This reference is not retained in private cloud storage yet.',503);
    const job={id:S.uuid(),project,owner_id:user.id,event_id:event.id,session_id:event.session_id,request_key,status:'queued',specification:spec,result:null,attempts:0,created_at:store.now()};result={job:jobs.publicJob(await require('./_credits').reserve(job,credit.grant_id))};
   }
  }
  else if(['references','image'].includes(route)&&req.method==='GET'){
   const all=await references();
   if(route==='image'&&q.get('review')==='1'&&user.editor){const row=all.find(r=>r.id===q.get('id')&&(r.allowed_projects||[]).includes(project));if(!row)throw error('Reference not found.',404);return await image(req,res,row);}
   const scoped=S.scopeReferences(all,{project,roomType:q.get('room_type'),tier:q.get('tier'),query:q.get('query')||''});
   if(route==='image'){const row=scoped.find(r=>r.id===q.get('id'));if(!row)throw error('Reference not found.',404);return await image(req,res,row);}
   result={references:scoped.map(publicReference),ranking:'scoped lexical overlap; no embedding similarity claimed'};
  }else if(['session','handoff'].includes(route)&&req.method==='GET'){
   const events=await store.select('atlas_design_events',{eq:{project,owner_id:requestedOwner,session_id:q.get('session')},order:'revision.asc',limit:500});
   if(!events.length)throw error('Session not found.',404);
   result=route==='handoff'?S.handoff(events):{events};
   if(route==='handoff'){const ids=new Set(events.flatMap(e=>e.state.selections.map(p=>p.reference_id)));const snapshots=events.flatMap(e=>e.state.reference_snapshots||[]),records=(await references()).filter(r=>ids.has(r.id)&&(r.allowed_projects||[]).includes(project)).map(publicReference);result.references=[...new Map([...records,...snapshots].map(r=>[r.id,r])).values()];result.jobs=(await jobs.list({project,session_id:q.get('session'),owner_id:requestedOwner})).map(jobs.publicJob);result.html=require('./_handoff').html(result);}
  }else if(route==='session'&&req.method==='POST'){
   const b=await body(req);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.session_id||''))throw error('Session identifier is required.');
   const last=await store.one('atlas_design_events',{eq:{project,owner_id:user.id,session_id:b.session_id},order:'revision.desc'});
   if((last?.revision||0)!==b.base_revision)throw error('This session changed. Reload before saving.',409);
   if(last?.state?.tier&&b.state?.tier!==last.state.tier&&b.authorize_tier_change!==true)throw error('Confirm the room offering change before saving a reference from another tier.',409);
   const refs=b.state?.tier?S.scopeReferences(await references(),{project,roomType:referenceRoomType(project,b.state.context),tier:b.state.tier}):[];
   const state=S.validateState(b.state,refs,last?.state,user.editor);
   state.measured_room=authoritativeRoom(project,state.context);
   state.reference_snapshots=state.selections.map(s=>publicReference(refs.find(r=>r.id===s.reference_id)));
   let parent=null;
   if(state.parent_result_id){parent=await jobs.one({id:state.parent_result_id,project,owner_id:user.id});if(!parent||!['review_required','accepted','rejected'].includes(parent.status)||parent.session_id!==b.session_id)throw error('Parent result is not available for this project session.',422);}
   if(state.stage==='designer-validated'){
    if(parent?.status!=='accepted'||parent.result?.kind!=='native-cad-concept')throw error('Designer validation requires an accepted native result for this option.',422);
    const covered=await store.one('atlas_design_events',{eq:{id:parent.event_id,project,owner_id:user.id}});
    if(!covered||!['context','tier','selections','comments','camera'].every(k=>JSON.stringify(covered.state[k])===JSON.stringify(state[k])))throw error('The design changed after its accepted render. Render and review the current revision.',422);
    state.designer_validation=parent.result.designer_review;
   }
   const event={id:S.uuid(),project,owner_id:user.id,session_id:b.session_id,revision:b.base_revision+1,parent_event_id:last?.id||null,state,created_at:store.now()};
   try{await store.insert('atlas_design_events',event);}catch(e){if(/duplicate|unique/.test(e.message))throw error('This session changed. Reload before saving.',409);throw e;}
   result={event};
   }else if(route==='summary'&&req.method==='GET'){
   const rows=await store.select('atlas_design_events',{eq:{project,owner_id:user.id},order:'created_at.desc',limit:2000}),seen=new Set(),choices=[];
   for(const e of rows){const c=e.state.context,key=[c.property,c.plan,c.room_id].join(':');if(e.state.option_number!==1||seen.has(key))continue;seen.add(key);if(q.get('property')&&q.get('property')!==c.property)continue;const selected=e.state.selections.filter(s=>s.preference==='like');if(!selected.length&&!e.state.comments)continue;const room=require('./_scene').describeRoom(project,c);choices.push({session_id:e.session_id,context:c,room,tier:e.state.tier,stage:e.state.stage,finalized:e.state.finalized,approval_kind:e.state.approval_kind,selections:e.state.selections,comments:e.state.comments,submitted_at:e.created_at,references:(e.state.reference_snapshots||[]).filter(r=>selected.some(s=>s.reference_id===r.id))});}
   for(const choice of choices){const candidates=await jobs.list({project,owner_id:user.id,session_id:choice.session_id});const event=rows.find(e=>e.session_id===choice.session_id);const current=candidates.find(j=>j.event_id===event.id&&j.result?.kind==='ai-visualization'&&['review_required','accepted'].includes(j.status));choice.visualization=current?jobs.publicJob(current):null;}result={choices};
  }else if(route==='sessions'&&req.method==='GET'){
   const rows=await store.select('atlas_design_events',{eq:{project,...(user.editor&&q.get('scope')==='project'?{}:{owner_id:user.id})},order:'created_at.desc',limit:2000});const seen=new Set();
   result={sessions:rows.filter(e=>{const key=e.owner_id+':'+e.session_id;if(seen.has(key))return false;seen.add(key);return (!q.get('plan')||e.state.context.plan===q.get('plan'))&&(!q.get('room_id')||e.state.context.room_id===q.get('room_id'));}).map(e=>({session_id:e.session_id,...(user.editor&&q.get('scope')==='project'?{owner_id:e.owner_id}:{}),revision:e.revision,created_at:e.created_at,stage:e.state.stage,context:e.state.context,option_number:e.state.option_number||null,tier:e.state.tier}))};
  }else if(route==='generate'&&req.method==='POST'){
   if(!await jobs.ready())throw error('Start the native render worker before submitting a render.',503);
   const b=await body(req),event=await store.one('atlas_design_events',{eq:{project,owner_id:user.id,session_id:b.session_id},order:'revision.desc'});
   if(!event||event.id!==b.event_id)throw error('Save the current option and render that exact revision.',409);
   const scoped=S.scopeReferences(await references(),{project,roomType:referenceRoomType(project,event.state.context),tier:event.state.tier}),specification=renderSpecification(project,event,scoped),request_key=sha(JSON.stringify(specification));
   const job=await jobs.insert({id:S.uuid(),project,owner_id:user.id,event_id:event.id,session_id:b.session_id,request_key,status:'queued',specification,result:null,attempts:0,created_at:store.now()});result={job:jobs.publicJob(job)};
  }else if(route==='enhance'&&req.method==='POST'){
   if(process.env.ATLAS_DESIGN_LEGACY_ENHANCEMENT!=='1')throw error('Use the meeting-room Generate action with its scoped application credit.',410);
   const provider=require('./_provider');if(!provider.ready())throw error('Configure HIGGSFIELD_API_KEY securely on the server. No paid request was submitted.',503);
   if(process.env.ATLAS_DESIGN_ALLOW_PAID_ENHANCEMENT!=='1')throw error('Paid Higgsfield requests are not enabled by the project operator.',403);
   if(!await jobs.ready())throw error('The visualization worker is offline.',503);
   const b=await body(req);if(b.authorize_single_paid_request!==true)throw error('Authorize one paid Higgsfield visualization explicitly.',403);
   const native=await jobs.one({id:b.native_job_id,project,owner_id:user.id});if(!native||native.result?.kind!=='native-cad-concept'||!['review_required','accepted'].includes(native.status)||!native.result.checks.geometry_unchanged)throw error('Choose a completed owned native render first.',422);
   require('./_scene').verifyRegisteredSpecification(native.specification);
   const sourceEvent=await store.one('atlas_design_events',{eq:{id:native.event_id,project,owner_id:user.id}}),refs=S.scopeReferences(await references(),{project,roomType:referenceRoomType(project,native.specification.context),tier:sourceEvent.state.tier});
   const selected=native.specification.proposal.borrowed;if(selected.length>9)throw error('Higgsfield supports at most nine inspirations with the native image.');
   const assets=selected.map(s=>{const row=refs.find(r=>r.id===s.reference_id);if(!row||row.record.image_sha256!==s.image_sha256)throw error('Reference permission or image version changed.',403);const r=row.record,d=r.image_dimensions;if(!d||Math.min(d.width,d.height)<300||d.width/d.height<.4||d.width/d.height>2.5)throw error('A selected reference does not meet the documented Higgsfield image limits.',422);const ext=path.extname(r.local_object||r.storage_path||r.source_member).toLowerCase();if(!['.jpg','.jpeg','.png'].includes(ext))throw error('Higgsfield inspirations must be JPG or PNG.',422);return {sha256:r.image_sha256,source_id:r.source_id,reference_id:r.id,features:s.features,mime:ext==='.png'?'image/png':'image/jpeg',local_object:r.local_object||null,storage_path:r.storage_path||null};});
   const nativeSize=native.result.checks.pixel_size;if(!nativeSize||Math.min(...nativeSize)<300||nativeSize[0]/nativeSize[1]<.4||nativeSize[0]/nativeSize[1]>2.5)throw error('The saved native camera aspect is outside Higgsfield input limits.',422);
   const specification={...native.specification,engine:'higgsfield-image-edit',native_parent_id:native.id,native_input:{sha256:native.result.checks.image_sha256,local_object:native.result.local_image||null,storage_path:native.result.storage_path||null,mime:'image/png'},reference_assets:assets,paid_authorization:{explicit_single_request:true,authorized_by:user.id,at:store.now(),maximum_images:1,listed_price_usd:.063,provider:'higgsfield'},assumptions:[...native.specification.assumptions,'AI image editing cannot verify dimensions, shell or camera. Retain native proof and reject visual inconsistencies.']};
   const request_key=sha('higgsfield:'+native.id);result={job:jobs.publicJob(await jobs.insert({id:S.uuid(),project,owner_id:user.id,event_id:native.event_id,session_id:native.session_id,request_key,status:'queued',specification,result:null,attempts:0,created_at:store.now()}))};
  }else if(route==='jobs'&&req.method==='GET')result={jobs:(await jobs.list({project,session_id:q.get('session'),owner_id:requestedOwner})).map(jobs.publicJob)};
  else if(route==='job-artifact'&&req.method==='GET'){
   const job=await jobs.one({id:q.get('id'),project,...(!user.editor?{owner_id:user.id}:{})});if(!job?.result)throw error('Result not found.',404);
   const native=q.get('kind')==='native';const artifact=native?job.result.native:job.result;if(!artifact)throw error('Native comparison is unavailable.',404);
   if(store.MODE==='dev'){const target=fs.realpathSync(artifact.local_image),root=fs.realpathSync(path.join(jobs.workspace(),'renders',job.id));if(!target.startsWith(root+path.sep))throw error('Invalid result object.',403);res.setHeader('Content-Type',job.result.mime||'image/png');return res.end(fs.readFileSync(target));}
   return await image(req,res,{record:{storage_path:artifact.storage_path}});
  }else if(route==='job-review'&&req.method==='POST'){
   if(!user.editor)throw error('Designer review requires an editor.',403);const b=await body(req),job=await jobs.one({id:b.id,project});
   if(!job||job.status!=='review_required')throw error('This result is not awaiting review.',409);
   if(!['accepted','rejected'].includes(b.decision)||!S.text(b.reason)||!S.text(b.reviewer_name,120))throw error('Record reviewer, decision and reason.');
   const ai=job.result?.kind==='ai-visualization';
   if(b.decision==='accepted'){
    require('./_scene').verifyRegisteredSpecification(job.specification);
    if(ai){if(!['native_comparison','room_type','no_visible_shell_change','offering'].every(k=>b.checks?.[k]===true))throw error('Compare against the native result before keeping an AI visualization as inspiration.');}
    else{const proof=job.result?.checks;if(!proof||!proof.geometry_unchanged||proof.geometry_before!==proof.geometry_after||proof.source_sha256!==job.specification.context.source_sha256||proof.scene_sha256!==job.specification.native_asset.sha256)throw error('Native result provenance checks failed.',409);if(!['shell','openings','camera','vertical_assumptions','deliverability'].every(k=>b.checks?.[k]===true))throw error('Complete the native geometry and design checklist before accepting.');}
   }
   const review={decision:b.decision,reason:S.text(b.reason),reviewer_name:S.text(b.reviewer_name,120),reviewed_by:user.id,at:store.now(),checks:b.checks||{},geometry_verified:ai?false:!!job.result?.checks?.geometry_unchanged,scope:ai?'AI inspiration only; never geometry validation':'Native CAD concept review with stated assumptions'};
   const resultData={...job.result,...(ai?{visualization_review:review}:{designer_review:review})};
   result={job:jobs.publicJob(await jobs.update(job.id,{status:'review_required'},{status:b.decision,result:resultData}))};
  }else if(route==='job-retry'&&req.method==='POST'){
   const b=await body(req),job=await jobs.one({id:b.id,project,owner_id:user.id});if(job?.specification.engine==='meeting-visualization'){if(job.status!=='reconciling')throw error('Only a reconciling paid job can be resumed with its existing reservation.',409);result={job:jobs.publicJob(await jobs.update(job.id,{status:'reconciling'},{status:'queued',error:null,attempts:0}))};}else{if(!job||job.status!=='failed')throw error('Only a failed owned job can be retried.',409);
   if(job.specification.engine==='higgsfield-image-edit'&&!job.provider_state?.request_id)throw error('No saved provider request ID is available. Check the Higgsfield dashboard before authorizing a new paid request.',409);
   result={job:jobs.publicJob(await jobs.update(job.id,{status:'failed'},{status:'queued',error:null,attempts:0}))};}
  }else if(route==='review-list'&&req.method==='GET'){
   if(!user.editor)throw error('Reference review requires an editor.',403);result={references:(await references()).filter(r=>(r.allowed_projects||[]).includes(project)).map(publicReference)};
  }else if(route==='reference-review'&&req.method==='POST'){
   if(!user.editor)throw error('Reference review requires an editor.',403);const b=await body(req),rows=await references(),row=rows.find(r=>r.id===b.id&&(r.allowed_projects||[]).includes(project));
   if(!row)throw error('Reference not found.',404);if(!['reviewed','rejected'].includes(b.decision)||!b.reviewer_confirmed||!S.text(b.reviewer_name,120)||!S.text(b.note))throw error('Explicit source/permission review, reviewer name and note are required.');
   if(!S.TIERS.includes(row.offering_tier))throw error('Tier is not supported by the source index.');
   const cleanList=v=>Array.isArray(v)?v.map(x=>S.text(x,160)).filter(Boolean).slice(0,20):[];
   const fields=['project','client','property','city','room_type'],facts=Object.fromEntries(fields.map(k=>[k,S.text(b.facts?.[k],160)||null]));
   if(b.decision==='reviewed'&&!facts.room_type)throw error('Confirm a room type before publication.');
   const interpretation=b.interpretations||{};row.record={...row.record,title:S.text(b.title,200)||row.record.title,facts,interpretations:{design_language:cleanList(interpretation.design_language),palette:{primary:cleanList(interpretation.palette?.primary),secondary:cleanList(interpretation.palette?.secondary),accent:cleanList(interpretation.palette?.accent)},materials_textures:cleanList(interpretation.materials_textures),furniture:cleanList(interpretation.furniture),lighting:cleanList(interpretation.lighting)},human_review:{reviewer_name:S.text(b.reviewer_name,120),reviewed_by:user.id,at:store.now(),note:S.text(b.note),permission_confirmed:true},geometry_authority:false};
   row.review_status=b.decision;row.room_type=facts.room_type||'Unknown';row.record.review_status=b.decision;
   if(store.MODE==='supabase')await store.upsert('atlas_design_references',row,'id');else{if(!process.env.ATLAS_DESIGN_LOCAL_INDEX)throw error('Local review index not configured.',503);jobs.atomic(process.env.ATLAS_DESIGN_LOCAL_INDEX,{schema_version:1,references:rows});}
   result={reference:publicReference(row)};
  }
  else throw error('Route not found.',404);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
 }catch(e){res.statusCode=e.status||500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.status?e.message:'Design service is unavailable. Check server configuration.'}));}
};
