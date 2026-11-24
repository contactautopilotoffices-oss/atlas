#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn,execFileSync}=require('child_process'),{ROOT,load}=require('./config.cjs');
const root=path.join(ROOT,'.atlas-design');fs.mkdirSync(root,{recursive:true,mode:0o700});fs.chmodSync(root,0o700);
load();load(path.join(ROOT,'.env.design.local'));const supabase=!process.argv.includes('--local')&&(process.argv.includes('--supabase')||!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY));if(!supabase){process.env.SUPABASE_URL='';process.env.SUPABASE_SERVICE_ROLE_KEY='';}const python=process.env.ATLAS_DESIGN_PYTHON||'python3';
execFileSync(process.execPath,[path.join(__dirname,'build-registry.cjs')],{stdio:'inherit'});
const library=path.join(root,'library');execFileSync(python,[path.join(__dirname,'ingest.py'),'--assets',path.join(ROOT,'assets'),'--output',library],{stdio:'inherit'});execFileSync(python,[path.join(__dirname,'prepare-local.py'),'--workspace',library],{stdio:'inherit'});
execFileSync(python,[path.join(__dirname,'classify.py'),'--workspace',library],{stdio:'ignore'});
const manifest=JSON.parse(fs.readFileSync(path.join(library,'manifest.json'),'utf8')),seeds=JSON.parse(fs.readFileSync(path.join(library,'classified-index.json'),'utf8')),index=path.join(root,'index.json'),prior=fs.existsSync(index)?JSON.parse(fs.readFileSync(index,'utf8')).references:[],map=new Map([...seeds.references,...prior.filter(r=>r.record?.human_review)].map(r=>[r.id,r]));
const rows=manifest.images.map(image=>{const old=map.get(image.id);return old?{...old,record:{...old.record,local_object:image.local_object,image_dimensions:image.image_dimensions}}:{id:image.id,room_type:'Unknown',offering_tier:image.offering_tier,review_status:'pending',allowed_projects:['flipkart-andheri'],shared_library_approved:false,record:{...image,source_path:manifest.sources.find(s=>s.id===image.source_id).path}};});
const temporary=index+'.tmp';fs.writeFileSync(temporary,JSON.stringify({schema_version:1,references:rows}),{mode:0o600});fs.renameSync(temporary,index);
const secretFile=path.join(root,'session-secret');if(!fs.existsSync(secretFile))fs.writeFileSync(secretFile,crypto.randomBytes(48).toString('base64url'),{mode:0o600});
const env={...process.env,CMS_DEV_STORE:path.join(root,'store.json'),CMS_SESSION_SECRET:process.env.CMS_SESSION_SECRET||fs.readFileSync(secretFile,'utf8'),ATLAS_DESIGN_WORKSPACE:root,ATLAS_DESIGN_LOCAL_PREVIEW:(!supabase||process.argv.includes('--demo'))?'1':'0',ATLAS_DESIGN_LOCAL_INDEX:supabase?'':index,ATLAS_DESIGN_LOCAL_OBJECTS:path.join(library,'objects'),PORT:process.env.PORT||'8096'};
if(supabase&&(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY))throw Error('Configure server-only Supabase settings before using --supabase.');
if(supabase&&process.argv.includes('--demo'))execFileSync(process.execPath,[path.join(__dirname,'grant-demo.cjs'),'--apply'],{cwd:ROOT,env,stdio:'inherit'});
const children=[spawn(process.execPath,[path.join(ROOT,'scripts/atlas-dev.js')],{cwd:ROOT,env,stdio:'inherit'})];if(!process.argv.includes('--no-worker'))children.push(spawn(process.execPath,[path.join(__dirname,'worker.cjs'),...(supabase?['--supabase']:[])],{cwd:ROOT,env,stdio:'inherit'}));
for(const child of children)child.on('error',e=>console.error(e.message));
let closing=false;function stop(){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('Persistence mode: '+(supabase?'Supabase (no local fallback)':'explicit local development; paid generation disabled'));
console.log('MVP viewer: http://localhost:'+env.PORT+'/flipkart-andheri/world?mvp=1#privilon');console.log('Designer tools: http://localhost:'+env.PORT+'/engine/design-review.html');
