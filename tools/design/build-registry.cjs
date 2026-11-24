#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{ROOT}=require('./config.cjs');
const args=process.argv.slice(2),get=(key,otherwise)=>{const n=args.indexOf(key);return n<0?otherwise:args[n+1];},project=get('--project','flipkart-andheri'),cad=path.resolve(get('--cad-root',path.join(ROOT,'media/flipkart-andheri/cad'))),target=path.resolve(get('--output',path.join(ROOT,'api/design/_scenes.json')));
if(!/^[a-z0-9][a-z0-9-]{0,39}$/.test(project))throw Error('Invalid registry project.');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function asset(url){if(!url)return null;const p=path.resolve(ROOT,'.'+url);if(!p.startsWith(ROOT+path.sep)||!fs.existsSync(p))throw Error('Registered asset missing: '+url);return {path:url,sha256:hash(p)};}
const manifest=JSON.parse(fs.readFileSync(path.join(cad,'manifest.json'),'utf8')),properties={};
for(const [id,property]of Object.entries(manifest.properties)){
 const plans=[];
 for(const variant of property.variants)for(const plan of variant.plans){const file=path.join(cad,plan.file),data=JSON.parse(fs.readFileSync(file,'utf8'));
  plans.push({id:plan.id,name:plan.name,variant:variant.id,source_sha256:data.source.sha256,data_asset:{path:'/'+path.relative(ROOT,file).split(path.sep).join('/'),sha256:hash(file)},native_asset:asset(plan.model),ceiling_asset:asset(plan.ceiling),rooms:[...(data.zones||[]),...(data.others||[])].map(z=>({id:z.id,name:z.name,group:z.group,source_handle:z.source_handle,seats:z.seats??null,seat_basis:z.seat_basis||null,area_sqft:z.outline_verified?z.area_sqft:null,area_basis:z.area_basis||null,outline_verified:!!z.outline_verified,polygon:z.d||null}))});
 }
 properties[id]={name:property.name,plans};
}
const prior=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{schema_version:1,projects:{}};prior.projects[project]={properties};const temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(prior));fs.renameSync(temp,target);console.log('Registered '+Object.keys(properties).length+' properties in '+project+'; API receives metadata and hashes, not Blender/model payloads.');
