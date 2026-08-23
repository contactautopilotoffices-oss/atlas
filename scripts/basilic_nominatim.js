/* Nominatim pass for the 6 deck properties (1 req/sec, proper UA). */
const https = require('https');
const fs = require('fs');
const searches = [
  ['itpl', 'International Tech Park, Whitefield, Bengaluru'],
  ['brigade', 'Brigade Utopia, Varthur, Bengaluru'],
  ['primeco', 'Primeco Union City, Whitefield, Bengaluru'],
  ['sumadhura', 'Sumadhura Capitol, Whitefield, Bengaluru'],
  ['totalenv', 'Total Environment, Mahadevapura, Bengaluru'],
  ['yliving', 'Y Living, Whitefield, Bengaluru'],
];
function get(url){ return new Promise(res=>{ https.get(url,{headers:{'User-Agent':'AtlasDigitalTwin/1.0 (property demo geocoding)'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',e=>res('ERR '+e.message)); }); }
(async()=>{
  for(const [k,q] of searches){
    const url = 'https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=0&limit=5&q='+encodeURIComponent(q);
    const d = await get(url);
    fs.writeFileSync(`recon/osm/basilic-nominatim-${k}.json`, d);
    console.log('== '+k+' ('+url+')');
    try{ JSON.parse(d).forEach(r=>console.log(' ', r.osm_type+'/'+r.osm_id, r.type, '|', r.display_name, '|', r.lat+','+r.lon)); }catch(e){ console.log(' PARSE FAIL', d.slice(0,200)); }
    await new Promise(r=>setTimeout(r,1100));
  }
})();
