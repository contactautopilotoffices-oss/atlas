const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const source = JSON.parse(fs.readFileSync(path.join(root, 'source-options.json')));
const ids = ['magnus-towers', 'a104', 'a14-18-19', 'd1'];
const positions = [[28.604823,77.3847901],[28.5839319,77.3231094],[28.5866294,77.3277564],[28.5820683,77.3183079]];
const prices = [2008000,2150000,1850000,2450000];
const tags = ['Largest floor plate','Three-month timeline','Lowest monthly outflow','Closest stated metro'];
const sourceHref = '/jindalx/source-options.json';
const walks = JSON.parse(fs.readFileSync(path.join(root, 'world-routes.json'))).routes;
// the 3D explorer (/jindalx-noida/world): one diorama per option, built by scripts/world from two regions
const origins = {'magnus-towers':[77.3847901,28.604823],'a104':[77.3231094,28.5839319],'a14-18-19':[77.3231094,28.5839319],'d1':[77.3231094,28.5839319]};
const options = source.options.map((r,i) => ({
  id:ids[i],n:i+1,name:r.Location,lat:positions[i][0],lng:positions[i][1],
  address:r['Address/Sector'],locality:r['Address/Sector'],precision:'approx',
  geoSrc:i===0?'https://www.openstreetmap.org/way/71834192':`https://www.google.com/maps/search/${encodeURIComponent(r['Address/Sector'])}/`,
  geoNote:i===0?'Sector 67 centre only. The Google Maps Magnus Tower record is a different Sector 73 property. Confirm the landlord pin.':'Indicative area position from address search; exact plot and entrance await landlord confirmation.',
  monthlyOutflow:prices[i],floorPlate:r['BUA each floor, sqft'].replace(/\s+/g,' '),floorOffered:r['Offered floor'],
  timeline:r.Timelines.trim(),metro:r['Nearest Metro station'],reason:tags[i],
  facts:Object.entries(r).map(([k,v])=>({k:k.trim(),v:v.trim()||'Not specified in source',src:sourceHref})),
  routes:walks[ids[i]]||[],
  flag:{v:'Indicative map pin; confirm exact building entrance. Commercial figures are tentative and exclude GST.',src:sourceHref}
}));
const bundle = {
  slug:'jindalx-noida',path:'/engine/?atlas=jindalx-noida',
  meta:{title:'JindalX · Noida',sub:'Four workspace options · November 2026',asOf:'2026-11-20',center:[77.347,28.58],zoom:11.8,
    sheet:'JindalX options.xlsx · Sheet1 · columns B–E. Broker estimates, not independently confirmed.',
    columns:{monthlyOutflow:{label:'Tentative monthly outflow',unit:'INR + GST / month',type:'number',sortable:true,higherIsBetter:false},floorPlate:{label:'Built-up area per floor',type:'text'},floorOffered:{label:'Offered floor',type:'text'},timeline:{label:'Timeline',type:'text'},metro:{label:'Metro distance stated in workbook',type:'text'}},
    world:{href:'/jindalx-noida/world',data:'/media/jindalx-noida/world/',sky:'sky.hdr',poster:'hero.jpg',mapHref:'/engine/?atlas=jindalx-noida',
      origin:origins['a104'],origins,ky:110950,specSourced:true,
      // the premium look (VISUAL_REALISM_AUDIT.md): open ground textured, AgX tone mapping, the time-of-day studio
      groundTex:'ground_noida',tone:'agx',lighting:true,lightingEV:-0.35,
      factKeys:{'Micro-market':'Address/Sector','Floor / Unit':'Offered floor','Possession':'Timelines'},
      brand:{kicker:'Autopilot · JindalX',title:'Noida, in 3D'},
      credit:'Options: workbook floor plates and storeys at indicative pins, not surveyed. Context: Overture Maps, heights estimated. Walks: Overture streets from the pins.',
      thumbs:Object.fromEntries(ids.map(id=>[id,`r/${id}-hero.jpg`])),renders:Object.fromEntries(ids.map(id=>[id,`r/${id}-street.jpg`]))},
    nextSteps:['Confirm the exact plot pins for all four options before routing site visits.','Reconcile the workbook’s approximately 7 km from the existing office against the verified Sector 125 office pin; no road distance has been verified.','Confirm chargeable area, service scope, deposits, escalation, lock-in and GST.','Validate the December 2026 handover and the separate three-month timelines for Magnus Towers and A104.','Inspect approach roads, shift-change transport, parking and cafeteria proposals.']},
  existing:{id:'jindalx-existing',name:'JindalX · current office',label:'Current office',locality:'Prius Heights, Plot 10/11, 3rd floor, Sector 125, Noida',lat:28.5452606,lng:77.3302287,precision:'building',geoSrc:'https://www.google.com/maps/place/JindalX/data=!4m2!3m1!1s0x0:0xe8b15a782573ec59',geoNote:'Resolved directly from the Maps link supplied in the brief, 20 November 2026.',note:'The supplied workbook states approximately 7 km to every option. Those distances require verification.'},
  options,
  copy:{connect:{note:'Walking distances are measured on Overture Maps streets from the indicative pins, so they differ from the workbook figures (A104 ~800 m, D1 ~500 m to Sector 16). Both are shown until the landlords confirm the entrances.'},overview:{eyebrow:'Prepared for JindalX · Noida',title:'Four options. A clearer next move.',intro:'Compare the supplied options against JindalX’s existing Sector 125 office. All four option pins are indicative; exact plots are pending.',ranking:'Workbook order'},sort:{rank:'Workbook order'},ranking:{ungrouped:'The four options'},insights:{first:'First in workbook'},option:{rank:false},conclusion:{title:'Validate the shortlist on site'}},
  facts:{source:[{k:'Commercial basis',v:'Tentative monthly outflow + GST, as supplied. No rent, CAM or service breakup was provided.',src:sourceHref},{k:'Distance reconciliation',v:'Workbook states approximately 7 km for every option. Atlas distances are estimates from indicative pins, not verified road distances.',src:sourceHref},{k:'Building availability',v:'Sector 9 and Sector 3 notes mention whole-building availability, but offered floors remain 2nd + 3rd and 2nd respectively.',src:sourceHref}]}
};
fs.writeFileSync(path.join(root,'../engine/atlases/jindalx-noida.js'),'/* Generated by jindalx/build-data.cjs from the supplied workbook. */\nwindow.ATLAS = '+JSON.stringify(bundle,null,2)+';\n');
const report = require('../scripts/lib/validate-bundle').validate(bundle);
console.log(JSON.stringify({ok:report.ok,errors:report.errors,warnings:report.warnings}));
if(!report.ok) process.exitCode=1;
