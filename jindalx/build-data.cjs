const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const source = JSON.parse(fs.readFileSync(path.join(root, 'source-options.json')));
const ids = ['magnus-towers', 'a104', 'a14-18-19', 'd1'];
// moved 24 Nov 2026 from the sheet's indicative pins to the buildings seen in imagery (docs/JINDALX_VERIFICATION.md): Magnus Greens C-2 by Google geocode, A104 best candidate, A-14 front plot, D-1 probable building
const positions = [[28.601495,77.388284],[28.584006,77.321683],[28.585363,77.328785],[28.581692,77.316915]];
const prices = [2008000,2150000,1850000,2450000];
const tags = ['Largest floor plate','Three-month timeline','Lowest monthly outflow','Closest stated metro'];
const sourceHref = '/jindalx/source-options.json';
const walks = JSON.parse(fs.readFileSync(path.join(root, 'world-routes.json'))).routes;
// the world media's version: a hash of every file the explorer loads (models, textures, sky, stills). It goes on every
// media URL, so a rebuild is fetched fresh although the media are cached (vercel.json). Rerun this script after a rebuild.
const worldVer = (() => {
  const h = require('node:crypto').createHash('sha1'), dir = path.join(root, '..', 'media', 'jindalx-noida', 'world');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { h.update(path.relative(dir, p)); h.update(fs.readFileSync(p)); } });
  walk(dir); return h.digest('hex').slice(0, 10);
})();
// the 3D explorer (/jindalx-noida/world): one diorama per option, built by scripts/world from two regions
const origins = {'magnus-towers':[77.3847901,28.604823],'a104':[77.3231094,28.5839319],'a14-18-19':[77.3231094,28.5839319],'d1':[77.3231094,28.5839319]};
// the data layer of the explorer (engine/world-data.js): what the 2D atlas knows, said beside the 3D. Rows name the workbook's own
// columns; every figure is read from the atlas at runtime. Words only a person can supply (the tour sentences) live here.
const worldData = {
  currency:'₹', locale:'en-IN', minArea:100, fixes:{Decemeber:'December'}, pros:'Pros', cons:'Cons',
  rows:[
    {id:'rank',label:'Rank',field:'n'},
    {id:'reason',label:'Reason',field:'reason'},
    {id:'outflow',label:'Monthly outflow',field:'monthlyOutflow',parse:'money',fmt:'money',suffix:'a month + GST',best:'min',lead:'the lowest monthly outflow',noteFact:'Commercial basis'},
    {id:'plate',label:'Floor plate',fact:'BUA each floor, sqft',parse:'max',fmt:'area',unit:'sq ft',best:'max',lead:'the largest floor plate'},
    {id:'efficiency',label:'Efficiency',fact:'Efficiency',parse:'first',fmt:'percent',best:'max',lead:'the best efficiency'},
    {id:'carpet',label:'Carpet a floor',hint:'Built-up area × efficiency',calc:'scale',of:'plate',by:'efficiency',unit:'sq ft'},
    {id:'floor',label:'Offered floor',fact:'Offered floor'},
    {id:'lifts',label:'Lifts',fact:'Lifts each floor',parse:'first',suffix:'a floor',best:'max',lead:'the most lifts a floor'},
    {id:'parking',label:'Parking',fact:'Parking'},
    {id:'cafeteria',label:'Cafeteria',fact:'Common Cafeteria'},
    {id:'timeline',label:'Timeline to move in',fact:'Timelines',parse:'months',best:'min',lead:'the earliest move-in'},
    {id:'structure',label:'Structure',fact:'Building structure'},
    {id:'grade',label:'Grade',fact:'Grade'},
    {id:'connectivity',label:'Local transport',fact:'Connectivity with local transport'},
    {id:'walk',label:'Walk to a metro',calc:'walk',best:'min',lead:'the shortest walk to a metro'},
    {id:'metroSheet',label:'Metro, per the sheet',fact:'Nearest Metro station'},
    {id:'office',label:"From today's office",calc:'roadKm',best:'min',lead:"the closest to today's office",sheetFact:'Distance from Jindal X existing office'}
  ],
  offer:[
    {title:'',ids:['outflow']},
    {title:'The space',ids:['plate','efficiency','carpet','floor','lifts']},
    {title:'The building',ids:['structure','grade','parking','cafeteria','timeline']},
    {title:'Getting there',ids:['connectivity','walk','metroSheet','office']}
  ],
  compare:['rank','reason','outflow','plate','efficiency','carpet','floor','lifts','parking','cafeteria','timeline','connectivity','walk','office'],
  tour:[
    {view:'stay',panel:'offer',basis:'workbook',title:'The offer',text:'{outflow}, tentative, as the broker quotes it. {plate} a floor at {efficiency} efficiency. Offered floor: {floor|not stated}. {timeline:l} to move in.'},
    {view:'approach',panel:'tradeoffs',basis:'workbook',title:'The trade-offs',text:'In the sheet\'s own words, in its favour: {pros|nothing listed}. Against it: {cons|the sheet lists nothing}. Best of the four on: {leads|no headline measure}.'},
    {view:'overview',panel:'compare',basis:'mixed',title:'How it compares',text:'Lowest monthly outflow: {best:outflow}. Largest floor plate: {best:plate}. Shortest walk to a metro, measured: {best:walk}. Earliest move-in: {best:timeline}. Distances from today\'s office are our estimate from indicative pins.'},
    {view:'overview',panel:'distances',basis:'assumed',title:'How the four sit around today\'s office',text:'Straight lines between the pins, not routed roads. Nearest to today\'s office: {office:near}. Farthest: {office:far}. {clusters}. {lone}. Closest pair: {pair:closest}. Farthest pair: {pair:farthest}.'}
  ]
};
// the guided tour (engine/world-story.js): generated from the workbook and the measured walks, plus jindalx/story-notes.json
const notes = JSON.parse(fs.readFileSync(path.join(root, 'story-notes.json')));
const kmOrM = (m) => m < 1000 ? `${Math.round(m / 10) * 10} metres` : `${(m / 1000).toFixed(1)} kilometres`;
function storyFor(r, id) {
  const R = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v).trim()])), g = (k) => R[k] || '', n = notes[id], w = (walks[id] || []).find((x) => x.kind === 'metro');
  const steps = [
    { view: 'overview', basis: n.overview.basis, title: n.overview.title, text: n.overview.text },
    { view: 'facade', basis: n.facade.basis, title: 'The facade', text: n.facade.text },
    { view: 'approach', basis: n.approach.basis, title: 'The way in', text: n.approach.text + (g('Cons') ? ` Watch for this: ${g('Cons').replace(/\.$/, '')}.` : '') },
  ];
  if (w) steps.push({ view: 'metro', basis: 'measured', title: `Walk to ${w.name.replace(/^Noida /, '')} metro`,
    text: `${kmOrM(w.m)}, about ${w.min} minutes on foot, measured along the streets from the pin. The sheet says ${g('Nearest Metro station')}. The line on the ground is the route.` });
  steps.push({ view: 'floor', basis: 'workbook', title: `On offer: ${g('Offered floor')} floor`,
    text: `${g('Lifts each floor')} lifts a floor, parking at ${g('Parking')}, ${g('Timelines').toLowerCase()} to move in. Cafeteria: ${g('Common Cafeteria').toLowerCase()}.` });
  steps.push({ view: 'overview', basis: n.position.basis, title: 'What is still open', text: n.position.text });
  return steps;
}
const options = source.options.map((r,i) => ({
  id:ids[i],n:i+1,name:r.Location,lat:positions[i][0],lng:positions[i][1],
  address:r['Address/Sector'],locality:r['Address/Sector'],precision:'approx',
  geoSrc:i===0?'https://www.openstreetmap.org/way/71834192':`https://www.google.com/maps/search/${encodeURIComponent(r['Address/Sector'])}/`,
  geoNote:i===0?'Magnus Greens, plot C-2, Sector 67, as Google geocodes it. The sheet\'s own pin was only a road junction. The Google Maps Magnus Tower record is a different Sector 73 property. Confirm the plot with the landlord.':i===1?'Best candidate seen in imagery; no public page names A-104. Confirm with the landlord.':'Building seen in imagery at this address; plot lines and entrance await landlord confirmation.',
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
    world:{href:'/jindalx-noida/world',data:'/media/jindalx-noida/world/',ver:worldVer,sky:'sky.hdr',poster:'hero.jpg',mapHref:'/engine/?atlas=jindalx-noida',
      origin:origins['a104'],origins,ky:110950,specSourced:true,
      // the premium look (VISUAL_REALISM_AUDIT.md): open ground textured, AgX tone mapping, the time-of-day studio
      groundTex:'ground_noida',tone:'agx',lighting:true,lightingEV:-0.35,lightingHour:15.75,
      factKeys:{'Micro-market':'Address/Sector','Floor / Unit':'Offered floor','Possession':'Timelines'},
      ui:'andheri',client:'JindalX',brand:{kicker:'Autopilot · JindalX',title:'Noida, in 3D'},
      credit:'Buildings stand where imagery shows them and are modelled from Street View, at the workbook's floors; plots, entrances and exact finishes are unconfirmed. Context: Overture Maps, heights estimated. Walks: Overture streets.',
      story:Object.fromEntries(source.options.map((r,i)=>[ids[i],storyFor(r,ids[i])])),
      dataLayer:worldData,
      thumbs:Object.fromEntries(ids.map(id=>[id,`r/${id}-hero.jpg`])),renders:Object.fromEntries(ids.map(id=>[id,`r/${id}-street.jpg`]))},
    nextSteps:['Confirm the exact plot pins for all four options before routing site visits.','Reconcile the workbook’s approximately 7 km from the existing office against the verified Sector 125 office pin; no road distance has been verified.','Confirm chargeable area, service scope, deposits, escalation, lock-in and GST.','Validate the December 2026 handover and the separate three-month timelines for Magnus Towers and A104.','Inspect approach roads, shift-change transport, parking and cafeteria proposals.']},
  existing:{id:'jindalx-existing',name:'JindalX · current office',label:'Current office',locality:'Prius Heights, Plot 10/11, 3rd floor, Sector 125, Noida',lat:28.5452606,lng:77.3302287,precision:'building',geoSrc:'https://www.google.com/maps/place/JindalX/data=!4m2!3m1!1s0x0:0xe8b15a782573ec59',geoNote:'Resolved directly from the Maps link supplied in the brief, 20 November 2026.',note:'The supplied workbook states approximately 7 km to every option. Those distances require verification.'},
  options,
  copy:{connect:{note:'Walking distances are measured on Overture Maps streets from each building's position as seen in imagery, so they differ from the workbook's figures (Magnus ~2 km, A104 ~800 m, A14 ~2 km, D1 ~500 m). Both are shown until the landlords confirm the entrances.'},overview:{eyebrow:'Prepared for JindalX · Noida',title:'Four options. A clearer next move.',intro:'Compare the supplied options against JindalX’s existing Sector 125 office. All four option pins are indicative; exact plots are pending.',ranking:'Workbook order'},sort:{rank:'Workbook order'},ranking:{ungrouped:'The four options'},insights:{first:'First in workbook'},option:{rank:false},conclusion:{title:'Validate the shortlist on site'}},
  facts:{source:[{k:'Commercial basis',v:'Tentative monthly outflow + GST, as supplied. No rent, CAM or service breakup was provided.',src:sourceHref},{k:'Distance reconciliation',v:'Workbook states approximately 7 km for every option. Atlas distances are estimates from indicative pins, not verified road distances.',src:sourceHref},{k:'Building availability',v:'Sector 9 and Sector 3 notes mention whole-building availability, but offered floors remain 2nd + 3rd and 2nd respectively.',src:sourceHref}]}
};
fs.writeFileSync(path.join(root,'../engine/atlases/jindalx-noida.js'),'/* Generated by jindalx/build-data.cjs from the supplied workbook. */\nwindow.ATLAS = '+JSON.stringify(bundle,null,2)+';\n');
const report = require('../scripts/lib/validate-bundle').validate(bundle);
console.log(JSON.stringify({ok:report.ok,errors:report.errors,warnings:report.warnings}));
if(!report.ok) process.exitCode=1;
