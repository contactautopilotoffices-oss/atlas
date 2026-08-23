/* Ordered Purple Line path from OSM route relation 1798771 member ways. */
const https=require('https'), fs=require('fs');
function overpass(q){ return new Promise(res=>{ const r=https.request({hostname:'overpass-api.de',path:'/api/interpreter',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'AtlasDigitalTwin'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(d));}); r.write(q); r.end(); }); }
const hav=(a,b)=>{const R=6371000,t=Math.PI/180,dLa=(b[1]-a[1])*t,dLo=(b[0]-a[0])*t;
  const s=Math.sin(dLa/2)**2+Math.cos(a[1]*t)*Math.cos(b[1]*t)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));};
(async()=>{
  const d = await overpass(`[out:json];relation(1798771);way(r);out geom;`);
  fs.writeFileSync('recon/osm/basilic-purple-rel.json', d);
  let ways = JSON.parse(d).elements.filter(e=>e.type==='way'&&e.geometry&&e.geometry.length>1)
    .map(w=>w.geometry.map(p=>[+p.lon.toFixed(6),+p.lat.toFixed(6)]));
  console.log('member ways:', ways.length);
  let chain = ways.shift();
  let guard = 0;
  while (ways.length && guard++ < 500){
    const end = chain[chain.length-1];
    let bi=-1,bd=1e18,bf=false;
    ways.forEach((w,i)=>{ [[w[0],false],[w[w.length-1],true]].forEach(([p,flip])=>{ const dd=hav(end,p); if(dd<bd){bd=dd;bi=i;bf=flip;} }); });
    if (bd > 500) { console.log('gap>',Math.round(bd),'m — stopping chain at', chain.length, 'pts'); break; }
    let w = ways.splice(bi,1)[0]; if(bf) w=[...w].reverse();
    chain = chain.concat(w.slice(1));
  }
  const out=[chain[0]];
  for(let i=1;i<chain.length-1;i++){ if(hav(out[out.length-1],chain[i])>=40) out.push(chain[i]); }
  out.push(chain[chain.length-1]);
  console.log('pts:',chain.length,'-> simplified:',out.length,'ends:',out[0],out[out.length-1]);
  fs.writeFileSync('recon/osm/basilic-purple-path-full.json', JSON.stringify(out));
})();
