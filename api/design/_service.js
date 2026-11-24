'use strict';
const crypto=require('crypto');
const store=require('../cms/_store');
const TIERS=['Premium Economy','Premium'];
const STAGES=['explored','shortlisted','client-approved','designer-validated'];
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const text=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
function scopeReferences(records,{project,roomType,tier,query=''}) {
 if(!roomType||!TIERS.includes(tier))throw error('Choose a room type and a supplied offering tier.');
 // Permission, room and offering filters always precede similarity ranking.
 const words=text(query).toLowerCase().split(/\s+/).filter(Boolean);
 return records.filter(r=>r.review_status==='reviewed'&&r.room_type===roomType&&r.offering_tier===tier&&
   (r.allowed_projects||[]).includes(project)).map(r=>({r,score:words.reduce((n,w)=>n+(JSON.stringify(r.record.interpretations||{}).toLowerCase().includes(w)?1:0),0)}))
   .sort((a,b)=>b.score-a.score||a.r.id.localeCompare(b.r.id)).map(x=>x.r);
}
function validateState(input,refs,previous,editor=false){
 const s=input||{};
 if(!s.context||!text(s.context.plan)||!text(s.context.room_id)||!text(s.context.source_sha256))throw error('Select a source-linked room first.');
 if(!TIERS.includes(s.tier)&&!(s.tier==null&&s.stage==='explored'&&Array.isArray(s.selections)&&s.selections.length===0))throw error('Offering tier is not supplied.');
 if(!STAGES.includes(s.stage))throw error('Unknown decision stage.');
 if(s.stage==='designer-validated'&&!editor)throw error('Designer validation requires an editor.',403);
 const context={property:text(s.context.property,100),plan:text(s.context.plan,100),room_id:text(s.context.room_id,100),source_sha256:text(s.context.source_sha256,64),room_type:text(s.context.room_type,100)};
 if(previous&&JSON.stringify(previous.context)!==JSON.stringify(context))throw error('Start a new session for a different room or drawing.');
 const selections=(s.selections||[]);
 if(!Array.isArray(selections)||selections.length>20)throw error('Select up to 20 references.');
 const cleaned=selections.map(p=>{
  const reference=refs.find(r=>r.id===p.reference_id);
  if(!reference)throw error('A reference is outside the permitted room or tier.',403);
  const features=Array.isArray(p.features)?p.features.map(f=>text(f,160)).filter(Boolean).slice(0,20):[];
  const available=Object.values(reference.record.interpretations||{}).flatMap(value=>Array.isArray(value)?value:Object.values(value||{}).flat());
  if(features.some(f=>!available.includes(f)))throw error('Select features present in this reviewed reference.');
  if(!['like','dislike','neutral'].includes(p.preference))throw error('Unknown preference.');
  return {reference_id:p.reference_id,features,preference:p.preference,comment:text(p.comment),reason:text(p.reason)};
 });
 if(s.stage!=='explored'&&!cleaned.some(p=>p.preference==='like'&&p.features.length&&p.reason))throw error('Record a liked reference, borrowed feature and decision reason first.');
 if(s.finalized===true){if(cleaned.length!==1||cleaned[0].preference!=='like'||cleaned[0].features.length<2||cleaned[0].features.length>3)throw error('Finalize one source image with two or three supported details.');}
 const c=s.camera;
 if(c&&(!Array.isArray(c.position)||!Array.isArray(c.target)||[...c.position,...c.target,c.fov].some(n=>typeof n!=='number'||!Number.isFinite(n))||c.position.length!==3||c.target.length!==3||c.fov<10||c.fov>100))throw error('Camera is invalid.');
 if(c&&c.aspect!=null&&(!Number.isFinite(c.aspect)||c.aspect<.2||c.aspect>5))throw error('Camera aspect is invalid.');
 if(c?.up&&(!Array.isArray(c.up)||c.up.length!==3||c.up.some(n=>!Number.isFinite(n))))throw error('Camera up vector is invalid.');
 if(c&&((c.near!=null&&(!Number.isFinite(c.near)||c.near<.001))||(c.far!=null&&(!Number.isFinite(c.far)||c.far>10000||c.far<=(c.near||.05)))))throw error('Camera clipping is invalid.');
 if(c?.up&&Math.hypot(...c.up)<.1)throw error('Camera up vector is invalid.');
 if(c&&Math.hypot(...c.position.map((v,i)=>v-c.target[i]))<.001)throw error('Camera target is invalid.');
 return {finalized:s.finalized===true,approval_kind:s.stage==='client-approved'?'client-reference-inspiration':null,option_number:s.option_number===2?2:1,context,tier:s.tier||null,stage:s.stage,selections:cleaned,comments:text(s.comments,6000),camera:c?{position:c.position,target:c.target,fov:c.fov,aspect:c.aspect||null,up:c.up||null,near:c.near||.05,far:c.far||1000,cutaway:!!c.cutaway,ceiling:!!c.ceiling}:null,parent_result_id:text(s.parent_result_id,100)||null};
}
function handoff(events){
 const latest=events[events.length-1];
 return {schema_version:1,session_id:latest.session_id,project:latest.project,revision:latest.revision,decision:latest.state,history:events.map(e=>({id:e.id,revision:e.revision,parent_event_id:e.parent_event_id,created_at:e.created_at,state:e.state})),
  designer_checks:['Verify source drawing and room enclosure','Confirm dimensions, openings and vertical assumptions','Validate tier deliverability and material specification','Compare any AI enhancement against native measured render; reject inconsistent output'],
  status:latest.state.stage,shared_library_promotion:'Requires separate reviewed permission; client sessions are never automatically promoted.'};
}
module.exports={TIERS,STAGES,error,text,scopeReferences,validateState,handoff,uuid:()=>crypto.randomUUID(),store};
