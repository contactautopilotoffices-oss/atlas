'use strict';
const fs=require('fs');const path=require('path');const {error}=require('./_service');
const REGISTRY=path.join(__dirname,'_scenes.json');
function registeredPlan(project,context){
 const data=JSON.parse(fs.readFileSync(REGISTRY,'utf8')).projects[project];
 if(!data)throw error('This project needs a registered measured-scene adapter.',422);
 const plan=data.properties[context.property]?.plans.find(p=>p.id===context.plan);
 if(!plan)throw error('Room plan is not registered for this property.',422);return plan;
}
function authoritativeRoom(project,context){
 const plan=registeredPlan(project,context),room=plan.rooms.find(z=>z.id===context.room_id);
 if(!room||plan.source_sha256!==context.source_sha256||room.group!==context.room_type)throw error('Room does not match the authoritative drawing.',422);
 return {source_sha256:plan.source_sha256,source_handle:room.source_handle,seats:room.seats,area_sqft:room.area_sqft,area_basis:room.area_basis,outline_verified:room.outline_verified,geometry_ready:false,geometry_blockers:[...(!room.outline_verified?['Verified enclosure required']:[]),'Vertical geometry and deliverability require designer review; native concept rendering preserves the registered scene.'],vertical_assumptions:'Must be reviewed before design approval.'};
}
module.exports={authoritativeRoom};

const crypto=require('crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function renderSpecification(project,event,refs){
 const state=event.state,context=state.context,room=authoritativeRoom(project,context);
 if(!room.outline_verified)throw error('A verified CAD room enclosure is required for native rendering.',422);
 if(!state.camera?.aspect||!state.camera?.up)throw error('Save a current viewer camera before rendering.',422);
 const plan=registeredPlan(project,context);if(!plan.native_asset)throw error('This plan has no registered native model yet.',422);const zone=plan.rooms.find(z=>z.id===context.room_id);
 const selected=state.selections.filter(s=>s.preference==='like'&&s.features.length);
 if(!selected.length)throw error('Choose at least one liked reference and specific feature before rendering.',422);
 const borrowed=selected.map(s=>{const r=refs.find(r=>r.id===s.reference_id);if(!r)throw error('Reference permission changed; review the saved option.',403);return {...s,source_id:r.record.source_id,image_sha256:r.record.image_sha256,source_member:r.record.source_member,source_path:r.record.source_path,interpretations:r.record.interpretations};});
 const palette={'blue':'#2456b5','light grey':'#d3d4d1','warm beige':'#b9aa90','charcoal':'#363c42','dark brown':'#4c3d30','gold':'#b89a48','light green':'#a3b998','white':'#e9e7e0'};
 Object.assign(palette,{grey:'#a7a9ab',gray:'#a7a9ab',cream:'#e9dfce',beige:'#c4b49a',purple:'#7e63a4',brown:'#7c5c42',green:'#6f8d66',mint:'#a3c8b4',mustard:'#c6a14a',navy:'#253e67',teal:'#327f80',yellow:'#d9b94f',black:'#20242a','off-white':'#e9e5dc'});
 const swatch=f=>{if(/^#[0-9a-f]{6}$/i.test(f))return f;const key=f.toLowerCase();return palette[key]||Object.entries(palette).find(([name])=>new RegExp('(?:^|[ /-])'+name+'(?:$|[ /-])').test(key))?.[1]||null;};
 const colorFeatures=[...new Set(borrowed.flatMap(s=>{const explicit=Object.values(s.interpretations.palette||{}).flat();return s.features.filter(f=>explicit.includes(f)||palette[f.toLowerCase()]);}))];
 const colors=[...new Set(colorFeatures.map(swatch).filter(Boolean))];
 if(!colors.length)throw error('For this MVP, select a palette feature to apply to the existing room finish. Other features are retained in the designer brief.',422);
 return {schema_version:1,engine:'blender-native',project,event_id:event.id,session_id:event.session_id,context,room:{...room,polygon:zone.polygon},native_asset:plan.native_asset,data_asset:plan.data_asset,ceiling_asset:state.camera.ceiling?plan.ceiling_asset:null,camera:state.camera,
  proposal:{operation:'existing-room-finish-palette',colors,palette_mapping:colorFeatures.map(label=>({label,hex:swatch(label),basis:'proposed display swatch; not an exact colour measurement'})),borrowed,unapplied_features:borrowed.flatMap(s=>s.features).filter(f=>!colorFeatures.includes(f)||!swatch(f)),dislikes:state.selections.filter(s=>s.preference==='dislike'),comments:state.comments},
  assumptions:['CAD-derived XY and existing scene geometry retained; elevations, ceilings, furniture heights and finishes remain proposed assumptions.','No costs, material grades, exterior surroundings or new room geometry are inferred.','Borrowed palette is applied only to existing room-finish faces fully contained by the verified enclosure. Other features remain designer suggestions.'],parent_result_id:state.parent_result_id||null};
}
module.exports.renderSpecification=renderSpecification;
module.exports.sha=sha;
module.exports.verifyRegisteredSpecification=function(spec){
 const room=authoritativeRoom(spec.project,spec.context);
 const plan=registeredPlan(spec.project,spec.context);
 if(!room.outline_verified||plan.native_asset?.sha256!==spec.native_asset.sha256||(spec.data_asset&&plan.data_asset.sha256!==spec.data_asset.sha256))throw error('The registered drawing or native scene changed. Render a fresh revision before accepting.',409);
 if(spec.ceiling_asset&&plan.ceiling_asset?.sha256!==spec.ceiling_asset.sha256)throw error('The ceiling scene changed. Render a fresh revision.',409);
 return true;
};
module.exports.referenceRoomType=function(project,context){
 authoritativeRoom(project,context);const room=registeredPlan(project,context).rooms.find(r=>r.id===context.room_id);
 if(room.group==='Washrooms')return 'Washroom';
 if(room.group==='Support'&&/lockers?/i.test(room.name))return 'Locker room';
 return room.group;
};

module.exports.describeRoom=function(project,context){authoritativeRoom(project,context);const plan=registeredPlan(project,context),r=plan.rooms.find(r=>r.id===context.room_id);return {id:r.id,name:r.name,group:r.group,seats:r.seats,area_sqft:r.outline_verified?r.area_sqft:null,plan_name:plan.name||plan.id};};
