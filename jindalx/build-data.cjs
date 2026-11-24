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
// the metro distances exactly as the client gave them (24 Nov 2026): shown on the atlas as given, on the station the client names
const stated = {'magnus-towers':['Noida Sector 59',2000],'a104':['Noida Sector 16',800],'a14-18-19':['Noida Sector 16',1900],'d1':['Noida Sector 16',500]};
for (const [id,[st,m]] of Object.entries(stated)) { const r = walks[id].find((x)=>x.name===st); if (r) { r.m = m; r.min = Math.round(m/80); walks[id] = [r]; } }
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
  // the sheet as it was given: each row is the client's own column, shown as written (no derived figures)
  tabs:['offer','compare','satellite'],
  plans:{'magnus-towers':{href:'/jindalx/plans.html?id=magnus-towers',label:'Fifth floor plan'},'a14-18-19':{href:'/jindalx/plans.html?id=a14-18-19',label:'Second floor plan'},'d1':{href:'/jindalx/plans.html?id=d1',label:'Second floor plan'}}, fixes:{Decemeber:'December'}, currency:'₹', locale:'en-IN',
  rows:[
    {id:'metro',label:'Nearest metro station',fact:'Nearest Metro station'},
    {id:'office',label:'Distance from JindalX existing office',fact:'Distance from Jindal X existing office'},
    {id:'structure',label:'Building structure',fact:'Building structure'},
    {id:'plate',label:'BUA each floor, sq ft',fact:'BUA each floor, sqft'},
    {id:'eff',label:'Efficiency',fact:'Efficiency'},
    {id:'floor',label:'Offered floor',fact:'Offered floor'},
    {id:'parking',label:'Parking',fact:'Parking'},
    {id:'cafe',label:'Common cafeteria',fact:'Common Cafeteria'},
    {id:'conn',label:'Connectivity with local transport',fact:'Connectivity with local transport'},
    {id:'lifts',label:'Lifts each floor',fact:'Lifts each floor'},
    {id:'time',label:'Timelines',fact:'Timelines'},
    {id:'pros',label:'Pros',fact:'Pros'},
    {id:'outflow',label:'Tentative monthly outflow for JindalX',fact:'Tentative Monthly outflow for JindalX'}
  ],
  offer:[{title:'',ids:['metro','office','structure','plate','eff','floor','parking','cafe','conn','lifts','time','pros','outflow']}],
  compare:['metro','office','structure','plate','eff','floor','parking','cafe','conn','lifts','time','pros','outflow']
};
const options = source.options.map((r,i) => ({
  id:ids[i],n:i+1,name:r.Location,lat:positions[i][0],lng:positions[i][1],
  address:r['Address/Sector'].replace('Magnus towers','Magnus Towers'),locality:r['Address/Sector'].replace('Magnus towers','Magnus Towers'),precision:'approx',
  geoSrc:i===0?'https://www.openstreetmap.org/way/71834192':`https://www.google.com/maps/search/${encodeURIComponent(r['Address/Sector'])}/`,
  monthlyOutflow:prices[i],floorPlate:r['BUA each floor, sqft'].replace(/\s+/g,' '),floorOffered:r['Offered floor'],
  timeline:r.Timelines.trim(),metro:r['Nearest Metro station'],reason:tags[i],
  facts:Object.entries(r).filter(([k])=>k.trim()!=='Cons').map(([k,v])=>({k:k.trim(),v:v.trim()||'Not specified in source',src:sourceHref})),
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
      ui:'andheri',client:'JindalX',freePan:true,loader:{slides:ids.map((id,i)=>({src:`r/${id}-load.jpg`,name:['Magnus Towers','A104','A14/18/19','D1'][i],tag:'0'+(i+1)+' · '+['Sector 67','Sector 4','Sector 9','Sector 3'][i]})),stages:['Laying out the environment','Raising the buildings','Growing the trees','Finishing the textures','Setting the light']},home:'/jindalx/',brand:{kicker:'Autopilot · JindalX',title:'Noida, in 3D'},
      credit:'Indicative 3D model. Map data © OpenStreetMap contributors, Overture Maps Foundation.',
      dataLayer:worldData,
      thumbs:Object.fromEntries(ids.map(id=>[id,`r/${id}-hero.jpg`])),renders:Object.fromEntries(ids.map(id=>[id,`r/${id}-street.jpg`]))},
    nextSteps:['Visit each building: the way in, the lanes, parking and shift-change transport.','Confirm chargeable area, service scope, deposits, escalation, lock-in and GST.','Confirm the December 2026 handover and the three-month timelines for Magnus Towers and A104.','Agree the cafeteria proposal and parking allocation with each landlord.']},
  existing:{id:'jindalx-existing',name:'JindalX · current office',label:'Current office',locality:'Prius Heights, Plot 10/11, 3rd floor, Sector 125, Noida',lat:28.5452606,lng:77.3302287,precision:'building',geoSrc:'https://www.google.com/maps/place/JindalX/data=!4m2!3m1!1s0x0:0xe8b15a782573ec59',geoNote:'Resolved directly from the Maps link supplied in the brief, 20 November 2026.'},
  options,
  copy:{connect:{note:'Metro distances as supplied.'},distance:{note:'The matrix is in straight lines. Road distances and times from today\'s office are approximate.'},overview:{eyebrow:'Prepared for JindalX · Noida',title:'Four options. A clearer next move.',intro:'Compare the four options against JindalX’s existing Sector 125 office.',ranking:'Shortlist order'},sort:{rank:'Shortlist order'},ranking:{ungrouped:'The four options'},insights:{first:'First listed'},option:{rank:false},conclusion:{title:'Validate the shortlist on site'}},
  facts:{source:[{k:'Commercial basis',v:'Tentative monthly outflow, plus GST. Rent, CAM and service charges are not yet broken out.'},{k:'Distances',v:'Road distances from today\'s office are estimates.'}]}
};
fs.writeFileSync(path.join(root,'../engine/atlases/jindalx-noida.js'),'/* Generated by jindalx/build-data.cjs from the supplied options sheet. */\nwindow.ATLAS = '+JSON.stringify(bundle,null,2)+';\n');
const report = require('../scripts/lib/validate-bundle').validate(bundle);
console.log(JSON.stringify({ok:report.ok,errors:report.errors,warnings:report.warnings}));
if(!report.ok) process.exitCode=1;
