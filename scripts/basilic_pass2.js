const https = require('https'); const fs = require('fs');
function overpass(q){ return new Promise(res=>{ const r=https.request({hostname:'overpass-api.de',path:'/api/interpreter',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'AtlasDigitalTwin'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(d));}); r.on('error',e=>res('ERR '+e.message)); r.write(q); r.end(); }); }
function get(url){ return new Promise(res=>{ https.get(url,{headers:{'User-Agent':'AtlasDigitalTwin/1.0 (property demo geocoding)'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',e=>res('ERR '+e.message)); }); }
const B='(12.93,77.68,13.03,77.80)';
(async()=>{
  // 1. ITPL + name variants in Overpass
  let d = await overpass(`[out:json];(way["name"~"International Tech|ITPL|Explorer|Discover|Creator|Innovator",i]${B};relation["name"~"International Tech Park",i]${B};node["name"~"International Tech Park|ITPL",i]${B};);out center tags;`);
  fs.writeFileSync('recon/osm/basilic-itpl.json', d);
  JSON.parse(d).elements.forEach(el=>{const t=el.tags||{};console.log('ITPL?',el.type+'/'+el.id,t.name,el.center?el.center.lat+','+el.center.lon:el.lat+','+el.lon);});
  await new Promise(r=>setTimeout(r,2000));
  // 2. Brigade Elysium footprint geometry
  d = await overpass(`[out:json];way(1274696767);out geom;`);
  fs.writeFileSync('recon/osm/basilic-brigade-geom.json', d);
  const g = JSON.parse(d).elements[0];
  console.log('ELYSIUM geom pts:', g && g.geometry ? g.geometry.length : 'none');
  await new Promise(r=>setTimeout(r,2000));
  // 3. wider name hunt for remaining 4
  d = await overpass(`[out:json];(way["name"~"Primeco|Union City|Capitol|Workcation|Y.?Living",i](12.90,77.60,13.05,77.85);node["name"~"Primeco|Union City|Capitol|Workcation|Y.?Living",i](12.90,77.60,13.05,77.85););out center tags;`);
  fs.writeFileSync('recon/osm/basilic-names2.json', d);
  JSON.parse(d).elements.forEach(el=>{const t=el.tags||{};console.log('NAME?',el.type+'/'+el.id,t.name,el.center?el.center.lat+','+el.center.lon:el.lat+','+el.lon);});
  await new Promise(r=>setTimeout(r,2000));
  // 4. locality nodes (Whitefield, Mahadevapura, Varthur)
  d = await overpass(`[out:json];node["place"~"suburb|neighbourhood|town"]["name"~"^(Whitefield|Mahadevapura|Varthur|Hoodi)$"](12.85,77.60,13.10,77.85);out tags;`);
  fs.writeFileSync('recon/osm/basilic-localities.json', d);
  JSON.parse(d).elements.forEach(el=>console.log('LOC',el.type+'/'+el.id,el.tags.name,el.lat+','+el.lon,el.tags.place));
  await new Promise(r=>setTimeout(r,2000));
  // 5. Nominatim variants
  for(const [k,q] of [['itpl2','ITPL, Whitefield, Bangalore'],['totalenv2','Total Environment Building, Whitefield, Bangalore'],['sumadhura2','Sumadhura Capitol Towers, Bangalore']]){
    const url='https://nominatim.openstreetmap.org/search?format=json&limit=5&q='+encodeURIComponent(q);
    const n=await get(url); fs.writeFileSync(`recon/osm/basilic-nominatim-${k}.json`,n);
    try{JSON.parse(n).forEach(r=>console.log('NOM',k,r.osm_type+'/'+r.osm_id,r.display_name.slice(0,90),r.lat+','+r.lon));}catch(e){console.log('NOM',k,'none');}
    await new Promise(r=>setTimeout(r,1100));
  }
})();
