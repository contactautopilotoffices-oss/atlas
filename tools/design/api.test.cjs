'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-design-test-'));
process.env.SUPABASE_URL='';process.env.SUPABASE_SERVICE_ROLE_KEY='';process.env.CMS_SESSION_SECRET='isolated-design-test-secret';
process.env.CMS_DEV_STORE=path.join(dir,'store.json');
process.env.ATLAS_DESIGN_WORKSPACE=dir;
process.env.ATLAS_DESIGN_LOCAL_INDEX=path.join(dir,'index.json');
delete process.env.ATLAS_DESIGN_LOCAL_PREVIEW;
const index=require('./reviewed-index.json');fs.writeFileSync(process.env.ATLAS_DESIGN_LOCAL_INDEX,JSON.stringify(index));
const handler=require('../../api/design/index'),auth=require('../../api/cms/_auth'),store=require('../../api/cms/_store');
async function call(route,{method='GET',cookie='',body,header=true}={}){
 let headers={},response='';const res={setHeader:(k,v)=>headers[k]=v,end:v=>response=v||'',statusCode:200};
 await handler({url:'/api/design?project=flipkart-andheri&'+route,method,body,headers:{cookie,...(header?{'x-atlas-design':'1'}:{})},socket:{remoteAddress:'127.0.0.1'}},res);
 return {status:res.statusCode,headers,body:response?JSON.parse(response):null};
}
function cookie(aid){let value;auth.setAccess({setHeader:(_,v)=>value=v},{slug:'flipkart-andheri',aid});return value.split(';')[0];}
(async()=>{
 await store.insert('atlas_access',{access_id:'DESIGN-TEST-A',link_slug:'flipkart-andheri',active:true});
 await store.insert('atlas_access',{access_id:'DESIGN-TEST-B',link_slug:'flipkart-andheri',active:true});
 const a=cookie('DESIGN-TEST-A'),b=cookie('DESIGN-TEST-B');
 assert.equal((await call('r=references&room_type=Meeting+room&tier=Premium')).status,401);
 const refs=await call('r=references&room_type=Meeting+room&tier=Premium',{cookie:a});assert.equal(refs.status,200);assert.equal(refs.body.references.length,6);assert.ok(refs.body.references.every(r=>!r.local_object&&!r.storage_path));
 assert.equal((await call('r=references&room_type=Reception&tier=Premium',{cookie:a})).body.references.length,0);
 const session_id=require('crypto').randomUUID(),context={property:'privilon',plan:'privilon-260-plan1',room_id:'cad-161',room_type:'Meeting room',source_sha256:require('../../media/flipkart-andheri/cad/privilon-260-plan1.json').source.sha256};
 const payload={session_id,base_revision:0,state:{context,tier:'Premium',stage:'explored',selections:[],comments:'test'}};
 assert.equal((await call('r=session',{cookie:a,method:'POST',body:payload,header:false})).status,403);
 const saved=await call('r=session',{cookie:a,method:'POST',body:payload});assert.equal(saved.status,200);assert.equal(saved.body.event.state.measured_room.area_sqft,77);
 assert.equal((await call('r=session',{cookie:a,method:'POST',body:payload})).status,409);
 assert.equal((await call('r=session&session='+session_id,{cookie:b})).status,404);
 assert.equal((await call('r=generate',{cookie:a,method:'POST',body:{}})).status,503);
 assert.equal((await call('r=handoff&session='+session_id,{cookie:a})).body.history.length,1);
 const choices=await call('r=choices&'+new URLSearchParams(context),{cookie:a});assert.equal(choices.status,200);assert.ok(choices.body.references.length>=6);
 const summaryState={...payload.state,option_number:1};
 assert.equal((await call('r=session',{cookie:a,method:'POST',body:{session_id,base_revision:1,state:summaryState}})).status,200);
 assert.equal((await call('r=summary',{cookie:a})).body.choices.length,1);
 assert.equal((await call('r=summary',{cookie:b})).body.choices.length,0);
 assert.equal((await call('r=session',{cookie:a,method:'POST',body:{session_id,base_revision:2,state:{...summaryState,tier:null}}})).status,409);
 assert.equal((await call('r=session',{cookie:a,method:'POST',body:{session_id,base_revision:2,authorize_tier_change:true,state:{...summaryState,tier:null}}})).status,200);
 await store.update('atlas_access',{eq:{access_id:'DESIGN-TEST-A'}},{active:false});
 assert.equal((await call('r=session&session='+session_id,{cookie:a})).status,401);
 console.log('Design API: authentication, project/room/tier scope, secret omission, CSRF, revision conflicts, client isolation, handoff, revocation and generation gate passed.');
})().finally(()=>fs.rmSync(dir,{recursive:true,force:true})).catch(e=>{console.error(e);process.exitCode=1;});
