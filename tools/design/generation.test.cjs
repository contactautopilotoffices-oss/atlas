'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
process.env.SUPABASE_URL='';process.env.SUPABASE_SERVICE_ROLE_KEY='';process.env.CMS_DEV_STORE=path.join(os.tmpdir(),'atlas-generation-unused-test.json');
const S=require('../../api/design/_service'),G=require('../../api/design/_generation'),scene=require('../../api/design/_scene'),jobs=require('../../api/design/_jobs'),credits=require('../../api/design/_credits');
const refs=require('./reviewed-index.json').references,reference=refs.find(r=>r.room_type==='Meeting room'&&r.record.interpretations.palette.accent.includes('blue'));
const context={property:'privilon',plan:'privilon-260-plan1',room_id:'cad-161',room_type:'Meeting room',source_sha256:require('../../media/flipkart-andheri/cad/privilon-260-plan1.json').source.sha256};
(async()=>{
 const c=G.configuration(reference);assert.ok(c.groups.find(g=>g.id==='palette').choices.includes('blue'));assert.ok(!JSON.stringify(c).includes('cost'));
 const features=['blue',c.groups.find(g=>g.id==='lighting').choices[0]],state=S.validateState({context,tier:'Premium',stage:'shortlisted',finalized:true,selections:[{reference_id:reference.id,preference:'like',features,reason:'Client finalized the source details.'}]},refs,null);
 assert.equal(state.finalized,true);assert.equal(state.approval_kind,null);assert.throws(()=>S.validateState({...state,selections:[{...state.selections[0],features:['blue']}]},refs,null),/two or three/);assert.throws(()=>S.validateState({...state,selections:[{...state.selections[0],features:['invented material']}]},refs,null),/present/);
 const event={id:'fixture-event',owner_id:'fixture-owner',state};const spec=G.build('flipkart-andheri',event,refs);assert.equal(spec.engine,'meeting-visualization');assert.equal(spec.demo_credit_units,1);assert.equal(spec.provider_resolution,'2k');assert.ok(spec.proposal.unapplied_features.includes(features[1]));assert.deepEqual(spec.camera.up,[0,1,0]);assert.equal(spec.room.seats,4);assert.equal(spec.room.area_sqft,77);assert.ok(spec.configuration_version&&spec.reference_library_version);
 const approved=S.validateState({...state,stage:'client-approved'},refs,null);assert.equal(approved.approval_kind,'client-reference-inspiration');assert.equal(approved.stage,'client-approved');
 const publicJob=jobs.publicJob({id:'fixture',owner_id:'private-owner',specification:{native_asset:{path:'private'},reference_assets:[{storage_path:'private'}]},result:{kind:'ai-visualization',storage_path:'private',native:{storage_path:'private-native',local_image:'private-local'}}});assert.ok(!JSON.stringify(publicJob).includes('private'));
 assert.deepEqual(await credits.balance('flipkart-andheri','owner',context),{available:0,reserved:0,used:0,granted:0,ready:false,reason:'Cloud generation ledger is not active.'});let paid=0;await assert.rejects(()=>credits.reserve({id:'x'},'grant',{fetchFn:async()=>{paid++;}}),/cloud/);assert.equal(paid,0);
 assert.throws(()=>G.cameraFor('flipkart-andheri',{...context,room_type:'Phone booth'}),/authoritative/);
 console.log('Meeting generation: source-only configurations, two/three-detail finalization, inspiration approval separation, authoritative room/camera/versioning, private-output omission and fail-closed cloud-credit guard passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
