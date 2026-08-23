#!/usr/bin/env node
/* Real property -> metro distances via the MAPBOX DIRECTIONS API.

   History worth keeping: this originally used the public OSRM demo server, which hosts
   ONLY the car profile and silently returns car durations for /foot/ and /walking/ —
   verified byte-identical across all three. That produced "walk" times at 40+ km/h and
   road distances 2–10x the real pedestrian route (a car must detour around divided
   carriageways). Mapbox Directions has a genuine walking profile and the app already
   uses it for the in-scene route card, so it is the correct source here too. */
const fs = require("fs"), path = require("path"), https = require("https");

const OUT   = path.join(__dirname, "..", "data", "connectivity.json");
const TOKEN = fs.readFileSync(path.join(__dirname,"..","config.js"),"utf8")
                .match(/MAPBOX_TOKEN\s*=\s*"([^"]+)"/)[1];
const KIA = { name: "Kempegowda International Airport", lat: 13.1986, lng: 77.7066 };

const STATIONS = JSON.parse(fs.readFileSync(path.join(__dirname,"..","data","stations.json"),"utf8"));
const PROPS    = JSON.parse(fs.readFileSync(path.join(__dirname,"..","data","props.json"),"utf8"));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = (url) => new Promise((res, rej) => {
  https.get(url, r => { let d=""; r.on("data",c=>d+=c); r.on("end",()=>{ try{res(JSON.parse(d))}catch(e){rej(e)} }); }).on("error", rej);
});

function haversine(a, b) {
  const R=6371000, t=x=>x*Math.PI/180;
  const dp=t(b.lat-a.lat), dl=t(b.lng-a.lng);
  const h=Math.sin(dp/2)**2 + Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dl/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

async function route(profile, from, to) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/`
            + `${from.lng},${from.lat};${to.lng},${to.lat}`
            + `?geometries=geojson&overview=full&access_token=${TOKEN}`;
  const j = await get(url);
  const r = (j.routes || [])[0];
  if (!r) return null;
  return { meters: Math.round(r.distance), minutes: Math.max(1, Math.round(r.duration/60)),
           kmh: +(r.distance / r.duration * 3.6).toFixed(1), geometry: r.geometry };
}

(async () => {
  const out = {};
  for (const p of PROPS) {
    if (p.lat == null || p.lng == null) { console.log(`${p.id.padEnd(10)} SKIP — no coordinates`); continue; }

    // nearest station by straight line, then route to that one
    const ranked = STATIONS.map(s => ({ s, d: haversine(p, s) })).sort((a,b)=>a.d-b.d);
    const near = ranked[0].s;

    const walk  = await route("walking", p, near);  await sleep(220);
    const drive = await route("driving", p, near);  await sleep(220);
    const kia   = await route("driving", p, KIA);   await sleep(220);

    out[p.id] = {
      nearest_station: { id: near.id, name: near.name, lat: near.lat, lng: near.lng,
                         straight_m: Math.round(ranked[0].d) },
      walk:  walk  ? { m: walk.meters, min: walk.minutes, kmh: walk.kmh,
                       geometry: walk.geometry, practical: walk.meters <= 2000,
                       method: "mapbox-directions/walking" } : null,
      drive: drive ? { m: drive.meters, min: drive.minutes, method: "mapbox-directions/driving" } : null,
      kia:   kia   ? { km: +(kia.meters/1000).toFixed(1), min: kia.minutes } : null,
      method: "mapbox-directions",
      source_url: "https://api.mapbox.com/directions/v5/mapbox/{profile}/...",
      computed_at: new Date().toISOString(),
    };
    const w=out[p.id].walk, d=out[p.id].drive, k=out[p.id].kia;
    const flag = w && !w.practical ? "  [not walkable]" : "";
    console.log(`${p.id.padEnd(10)} ${near.name.slice(0,24).padEnd(25)} walk ${w?`${String(w.m).padStart(4)}m/${String(w.min).padStart(2)}min @${w.kmh}km/h`:'—'}  drive ${d?`${d.min}min`:'—'}  KIA ${k?`${k.km}km/${k.min}min`:'—'}${flag}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log("\n-> data/connectivity.json  (Mapbox Directions, real walking profile)");
})();
