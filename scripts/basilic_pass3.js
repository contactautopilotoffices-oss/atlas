const https = require('https'); const fs = require('fs');
function overpass(q){ return new Promise(res=>{ const r=https.request({hostname:'overpass-api.de',path:'/api/interpreter',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'AtlasDigitalTwin'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(d));}); r.on('error',e=>res('ERR '+e.message)); r.write(q); r.end(); }); }
(async()=>{
  // Footprints for the 3 verified ways + locality node coords
  let d = await overpass(`[out:json];(way(137772088);way(130510408);way(1004340436);node(377219489);node(574853138);node(833667967););out geom;`);
  fs.writeFileSync('recon/osm/basilic-footprints.json', d);
  JSON.parse(d).elements.forEach(el=>{
    if(el.type==='node'){ console.log('LOC',el.tags.name,el.lat+','+el.lon); }
    else { const g=el.geometry; const c=g.reduce((a,p)=>[a[0]+p.lon/g.length,a[1]+p.lat/g.length],[0,0]);
      console.log('FP',el.id,el.tags.name,'pts='+g.length,'centroid='+c[1].toFixed(6)+','+c[0].toFixed(6)); }
  });
  await new Promise(r=>setTimeout(r,2000));
  // Purple Line Whitefield stretch alignment: named Reach 1A ways only (yard sidings are unnamed)
  d = await overpass(`[out:json];way["railway"="subway"]["name"~"Reach 1A"](12.970,77.690,13.000,77.770);out geom;`);
  fs.writeFileSync('recon/osm/basilic-purple-geom.json', d);
  const ways = JSON.parse(d).elements.filter(e=>e.geometry);
  console.log('ALIGN ways:', ways.length, 'total pts:', ways.reduce((a,w)=>a+w.geometry.length,0));
})();
