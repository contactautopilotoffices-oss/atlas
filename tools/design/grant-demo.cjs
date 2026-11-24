#!/usr/bin/env node
'use strict';
const {load,ROOT}=require('./config.cjs');const path=require('path');load();load(path.join(ROOT,'.env.design.local'));
const registry=require('../../api/design/_scenes.json').projects['flipkart-andheri'];const plan=registry.properties.privilon.plans.find(p=>p.id==='privilon-260-plan1'),room=plan.rooms.find(r=>r.id==='cad-161');
const context={property:'privilon',plan:plan.id,room_id:room.id,source_sha256:plan.source_sha256,room_type:room.group};
(async()=>{if(!process.argv.includes('--apply'))throw Error('Use --apply to grant the user-authorized one-credit meeting demo to the loopback local-review principal.');await require('../../api/design/_credits').rpc('grant_atlas_design_demo_credit',{p_grant_id:'andheri-meeting-demo-2026-11-24',p_project:'flipkart-andheri',p_owner:'local-review',p_context:context});console.log('Persisted one application demo credit for Privilon 260 / '+room.name+'. Re-running this command cannot add another credit. Provider billing remains separate.');})().catch(e=>{console.error(e.message);process.exitCode=1});
