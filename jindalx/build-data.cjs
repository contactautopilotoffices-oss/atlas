const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const source = JSON.parse(fs.readFileSync(path.join(root, 'source-options.json')));
const ids = ['magnus-towers', 'a104', 'a14-18-19', 'd1'];
// moved 24 Nov 2026 from the sheet's indicative pins to the buildings seen in imagery (docs/JINDALX_VERIFICATION.md): Magnus Greens C-2 by Google geocode, A104 best candidate, A-14 front plot, D-1 probable building
const positions = [[28.601495,77.388284],[28.584006,77.321683],[28.585363,77.328785],[28.581692,77.316915]];
const prices = [2008000,2150000,1850000,2450000];
const tags = ['Largest floor plate','Three-month timeline','Lowest monthly outflow','Closest to a metro'];
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
// columns; every figure is read from the atlas at runtime.
const worldData = {
  currency:'₹', locale:'en-IN', minArea:100, fixes:{Decemeber:'December','Yes, Can be planned':'Yes, can be planned'}, pros:'Pros', cons:'Cons',
  lists:{
    'magnus-towers':{pros:['The only new building on the list, with handover in December 2026','Larger floor plates','Sufficient parking','Wider roads and excellent local transport connectivity','Not a dense area'],cons:[]},
    'a104':{pros:['New building, with handover in December 2026','Larger floor plates','Sufficient parking','Excellent local transport connectivity'],cons:['One approach road is narrow','The other approach road has a dump yard']},
    'a14-18-19':{pros:['The entire building is available','On the main road, well connected to the DND road','Upgrade of the whole building is under way'],cons:['Distance from the metro']},
    'd1':{pros:['The entire building is available','On the main road, well connected to the DND road','Upgrade of the whole building is under way','Wider approach roads'],cons:['Expensive']}
  },
  rows:[
    {id:'rank',label:'Rank',field:'n'},
    {id:'reason',label:'Reason',field:'reason'},
    {id:'outflow',label:'Monthly outflow',field:'monthlyOutflow',parse:'money',fmt:'money',suffix:'a month + GST',best:'min',lead:'the lowest monthly outflow',note:'Tentative, plus GST.'},
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
    {id:'office',label:"From today's office",calc:'roadKm',best:'min',lead:"the closest to today's office"}
  ],
  offer:[
    {title:'',ids:['outflow']},
    {title:'The space',ids:['plate','efficiency','carpet','floor','lifts']},
    {title:'The building',ids:['structure','grade','parking','cafeteria','timeline']},
    {title:'Getting there',ids:['connectivity','walk','office']}
  ],
  compare:['rank','reason','outflow','plate','efficiency','carpet','floor','lifts','parking','cafeteria','timeline','connectivity','walk','office']
};
const options = source.options.map((r,i) => ({
  id:ids[i],n:i+1,name:r.Location,lat:positions[i][0],lng:positions[i][1],
  address:r['Address/Sector'].replace('Magnus towers','Magnus Towers'),locality:r['Address/Sector'].replace('Magnus towers','Magnus Towers'),precision:'approx',
  geoSrc:i===0?'https://www.openstreetmap.org/way/71834192':`https://www.google.com/maps/search/${encodeURIComponent(r['Address/Sector'])}/`,
  monthlyOutflow:prices[i],floorPlate:r['BUA each floor, sqft'].replace(/\s+/g,' '),floorOffered:r['Offered floor'],
  timeline:r.Timelines.trim(),metro:r['Nearest Metro station'],reason:tags[i],
  facts:Object.entries(r).map(([k,v])=>({k:k.trim(),v:v.trim()||'Not specified in source',src:sourceHref})),
  routes:walks[ids[i]]||[]
}));
const bundle = {
  slug:'jindalx-noida',path:'/engine/?atlas=jindalx-noida',
  meta:{title:'JindalX · Noida',home:'/jindalx/',asOf:'2026-11-24',sub:'Four workspace options · November 2026',center:[77.347,28.58],zoom:11.8,
    columns:{monthlyOutflow:{label:'Tentative monthly outflow',unit:'INR + GST / month',type:'number',sortable:true,higherIsBetter:false},floorPlate:{label:'Built-up area per floor',type:'text'},floorOffered:{label:'Offered floor',type:'text'},timeline:{label:'Timeline',type:'text'},metro:{label:'Nearest metro, as listed',type:'text'}},
    world:{href:'/jindalx-noida/world',data:'/media/jindalx-noida/world/',ver:worldVer,sky:'sky.hdr',poster:'hero.jpg',mapHref:'/engine/?atlas=jindalx-noida',
      origin:origins['a104'],origins,ky:110950,specSourced:true,
      // the premium look (VISUAL_REALISM_AUDIT.md): open ground textured, AgX tone mapping, the time-of-day studio
      groundTex:'ground_noida',tone:'agx',lighting:true,lightingEV:-0.35,lightingHour:15.75,
      factKeys:{'Micro-market':'Address/Sector','Floor / Unit':'Offered floor','Possession':'Timelines'},
      ui:'andheri',client:'JindalX',home:'/jindalx/',brand:{kicker:'Autopilot · JindalX',title:'Noida, in 3D'},
      credit:'Indicative 3D model. Map data © OpenStreetMap contributors, Overture Maps Foundation.',
      dataLayer:worldData,
      thumbs:Object.fromEntries(ids.map(id=>[id,`r/${id}-hero.jpg`])),renders:Object.fromEntries(ids.map(id=>[id,`r/${id}-street.jpg`]))},
    nextSteps:['Visit each building: the way in, the lanes, parking and shift-change transport.','Confirm chargeable area, service scope, deposits, escalation, lock-in and GST.','Confirm the December 2026 handover and the three-month timelines for Magnus Towers and A104.','Agree the cafeteria proposal and parking allocation with each landlord.']},
  existing:{id:'jindalx-existing',name:'JindalX · current office',label:'Current office',locality:'Prius Heights, Plot 10/11, 3rd floor, Sector 125, Noida',lat:28.5452606,lng:77.3302287,precision:'building',geoSrc:'https://www.google.com/maps/place/JindalX/data=!4m2!3m1!1s0x0:0xe8b15a782573ec59',geoNote:'Resolved directly from the Maps link supplied in the brief, 20 November 2026.'},
  options,
  copy:{connect:{note:'Walking times follow the street network at an easy pace.'},distance:{note:'The matrix is in straight lines. Road distances and times from today\'s office are approximate.'},overview:{eyebrow:'Prepared for JindalX · Noida',title:'Four options. A clearer next move.',intro:'Compare the four options against JindalX’s existing Sector 125 office.',ranking:'Shortlist order'},sort:{rank:'Shortlist order'},ranking:{ungrouped:'The four options'},insights:{first:'First listed'},option:{rank:false},conclusion:{title:'Validate the shortlist on site'}},
  facts:{source:[{k:'Commercial basis',v:'Tentative monthly outflow, plus GST. Rent, CAM and service charges are not yet broken out.'},{k:'Distances',v:'Road distances from today\'s office are estimates.'}]}
};
fs.writeFileSync(path.join(root,'../engine/atlases/jindalx-noida.js'),'/* Generated by jindalx/build-data.cjs from the supplied options sheet. */\nwindow.ATLAS = '+JSON.stringify(bundle,null,2)+';\n');
const report = require('../scripts/lib/validate-bundle').validate(bundle);
console.log(JSON.stringify({ok:report.ok,errors:report.errors,warnings:report.warnings}));
if(!report.ok) process.exitCode=1;
