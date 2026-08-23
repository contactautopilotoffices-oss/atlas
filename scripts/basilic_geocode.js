/* Basilic Fly geocode pass — Overpass API, Whitefield/ITPL cluster.
   Pattern follows get_coords.js / get_poly.js. Raw JSON saved to recon/osm/. */
const https = require('https');
const fs = require('fs');

const BBOX = '(12.93,77.68,13.03,77.80)';

const queries = {
  metro_stations: `[out:json];
(
  node["railway"~"station|halt"]${BBOX};
  node["station"="subway"]${BBOX};
  way["railway"="station"]${BBOX};
);
out center tags;`,
  buildings: `[out:json];
(
  way["building"]["name"~"Primeco|Union City|Sumadhura|Capitol|Brigade|Utopia|International Tech|ITPL|Total Environment|Y Living|YLiving",i]${BBOX};
  node["name"~"Primeco|Union City|Sumadhura|Brigade Utopia|Total Environment|Y Living|YLiving",i]${BBOX};
  relation["name"~"Primeco|Union City|Sumadhura|Brigade Utopia|Total Environment|International Tech",i]${BBOX};
);
out center tags;`,
  purple_line: `[out:json];
(
  way["railway"="subway"]${BBOX};
  relation["route"="subway"](12.90,77.55,13.05,77.85);
);
out center tags;`
};

function run(name, query) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'overpass-api.de', path: '/api/interpreter', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AtlasDigitalTwin' }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        fs.writeFileSync(`recon/osm/basilic-${name}.json`, data);
        try {
          const p = JSON.parse(data);
          console.log(`== ${name}: ${p.elements.length} elements`);
          p.elements.forEach(el => {
            const lat = el.lat || (el.center && el.center.lat);
            const lon = el.lon || (el.center && el.center.lon);
            const t = el.tags || {};
            console.log(`${el.type}/${el.id}  ${t.name || '(unnamed)'}  ${lat},${lon}  [${t.railway||''}${t.building?' bldg':''}${t.line?' line='+t.line:''}]`);
          });
        } catch(e){ console.log(name, 'PARSE FAIL', data.slice(0,300)); }
        resolve();
      });
    });
    req.on('error', e => { console.log(name, 'ERR', e.message); resolve(); });
    req.write(query); req.end();
  });
}

(async () => {
  for (const [k,q] of Object.entries(queries)) { await run(k,q); await new Promise(r=>setTimeout(r,2000)); }
})();
