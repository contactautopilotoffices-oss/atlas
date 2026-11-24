// Geometry identity, not CAD handles: handles are reassigned between source DWGs.
export function compareDesks(base,target,tolerance=.001){
 const remaining=new Set(base.map((_,i)=>i)),unchanged=[],added=[];
 const same=(a,b)=>Math.hypot(a.center[0]-b.center[0],a.center[1]-b.center[1])<=tolerance&&a.polygon.every(p=>b.polygon.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<=tolerance));
 for(const desk of target){const i=[...remaining].find(i=>same(desk,base[i]));if(i==null)added.push(desk);else{remaining.delete(i);unchanged.push(desk);}}
 return {unchanged,added,removed:[...remaining].map(i=>base[i]),net:target.length-base.length};
}
export function changeClusters(desks,distance=2.3){
 const left=new Set(desks.map((_,i)=>i)),groups=[];
 while(left.size){const first=left.values().next().value;left.delete(first);const group=[first];for(let k=0;k<group.length;k++)for(const i of [...left])if(Math.hypot(desks[i].center[0]-desks[group[k]].center[0],desks[i].center[1]-desks[group[k]].center[1])<=distance){left.delete(i);group.push(i);}groups.push(group.map(i=>desks[i]));}
 return groups.sort((a,b)=>b.length-a.length);
}
export function deskBounds(desks){const p=desks.flatMap(d=>d.polygon);return [Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))];}

// Pair small drafting offsets separately from genuinely added and removed positions.
export function layoutDifference(base,target,tolerance,property){
  const diff=compareDesks(base,target,tolerance);
  diff.adjusted=[];
  if(property!=='corporate-avenue')return diff;
  const remaining=new Set(diff.removed),added=[];
  for(const b of diff.added){
    const candidates=[...remaining].filter(a=>{
      const dx=b.center[0]-a.center[0],dy=b.center[1]-a.center[1];
      return Math.hypot(dx,dy)<=.12 && a.polygon.every(p=>b.polygon.some(q=>Math.hypot(p[0]+dx-q[0],p[1]+dy-q[1])<.002));
    });
    if(candidates.length===1){remaining.delete(candidates[0]);diff.adjusted.push(b);}
    else added.push(b);
  }
  diff.removed=[...remaining];diff.added=added;
  return diff;
}
