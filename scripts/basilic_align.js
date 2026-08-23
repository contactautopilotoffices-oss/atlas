/* Chain OSM 'Reach 1A' subway ways into one ordered Purple Line polyline. */
const fs = require('fs');
const ways = JSON.parse(fs.readFileSync('recon/osm/basilic-purple-geom.json','utf8'))
  .elements.filter(e=>e.geometry && e.geometry.length>1)
  .map(w=>w.geometry.map(p=>[+p.lon.toFixed(6),+p.lat.toFixed(6)]));
const hav=(a,b)=>{const R=6371000,t=Math.PI/180,dLa=(b[1]-a[1])*t,dLo=(b[0]-a[0])*t;
  const s=Math.sin(dLa/2)**2+Math.cos(a[1]*t)*Math.cos(b[1]*t)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));};
// greedy chain
let chain = ways.shift();
while (ways.length){
  const end = chain[chain.length-1];
  let bi=-1,bd=1e18,bf=false;
  ways.forEach((w,i)=>{
    [[w[0],false],[w[w.length-1],true]].forEach(([p,flip])=>{
      const d=hav(end,p); if(d<bd){bd=d;bi=i;bf=flip;}
    });
  });
  let w = ways.splice(bi,1)[0];
  if(bf) w=[...w].reverse();
  if(bd>400) console.log('WARN chain gap', Math.round(bd),'m');
  chain = chain.concat(w.slice(1));
}
// simplify: keep points >= 40m apart + endpoints
const out=[chain[0]];
for(let i=1;i<chain.length-1;i++){ if(hav(out[out.length-1],chain[i])>=40) out.push(chain[i]); }
out.push(chain[chain.length-1]);
console.log('chained pts:',chain.length,'-> simplified:',out.length);
console.log('west end',out[0],'east end',out[out.length-1]);
console.log(JSON.stringify(out));
fs.writeFileSync('recon/osm/basilic-purple-path.json', JSON.stringify(out));
