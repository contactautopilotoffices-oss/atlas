/* Start at the easternmost way (Whitefield end) and chain westward. */
const fs=require('fs');
const ways0 = JSON.parse(fs.readFileSync('recon/osm/basilic-purple-rel.json','utf8'))
  .elements.filter(e=>e.type==='way'&&e.geometry&&e.geometry.length>1)
  .map(w=>w.geometry.map(p=>[+p.lon.toFixed(6),+p.lat.toFixed(6)]));
const hav=(a,b)=>{const R=6371000,t=Math.PI/180,dLa=(b[1]-a[1])*t,dLo=(b[0]-a[0])*t;
  const s=Math.sin(dLa/2)**2+Math.cos(a[1]*t)*Math.cos(b[1]*t)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));};
let ways=[...ways0];
// easternmost way
let si=0, sx=-1e9;
ways.forEach((w,i)=>w.forEach(p=>{ if(p[0]>sx){sx=p[0];si=i;} }));
let chain=ways.splice(si,1)[0];
if (chain[0][0] > chain[chain.length-1][0]) chain=[...chain].reverse(); // east end first
let guard=0;
while (ways.length && guard++<500){
  const end=chain[chain.length-1];
  let bi=-1,bd=1e18,bf=false;
  ways.forEach((w,i)=>{ [[w[0],false],[w[w.length-1],true]].forEach(([p,flip])=>{ const dd=hav(end,p); if(dd<bd){bd=dd;bi=i;bf=flip;} }); });
  if (bd>300){ console.log('chain break after',chain.length,'pts, gap',Math.round(bd),'m'); break; }
  let w=ways.splice(bi,1)[0]; if(bf) w=[...w].reverse();
  chain=chain.concat(w.slice(1));
}
// keep only the Whitefield stretch: east of Garudacharpalya (lng >= 77.700)
const stretch = chain.filter(p=>p[0]>=77.700);
const out=[stretch[0]];
for(let i=1;i<stretch.length-1;i++){ if(hav(out[out.length-1],stretch[i])>=40) out.push(stretch[i]); }
out.push(stretch[stretch.length-1]);
console.log('stretch pts:',stretch.length,'-> simplified:',out.length);
console.log('ends:',out[0],out[out.length-1]);
fs.writeFileSync('recon/osm/basilic-purple-path-whitefield.json', JSON.stringify(out));
