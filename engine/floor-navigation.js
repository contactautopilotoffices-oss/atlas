// A single drawing's connected floor grid, in its native CAD XY coordinates.
export function floorNavigation(map) {
  const {rows, cell, origin} = map, width = rows[0].length;
  const key = (x,y) => y*width+x;
  const indices = ([x,y]) => [Math.round((x-origin[0])/cell),Math.round((y-origin[1])/cell)];
  const point = i => [origin[0]+(i%width)*cell,origin[1]+Math.floor(i/width)*cell];
  const allowed = (x,y) => rows[y]?.[x] === '1';
  const cells = [];
  rows.forEach((row,y) => {for(let x=0;x<row.length;x++) if(allowed(x,y)) cells.push(key(x,y));});
  function nearest(p) {
    const [x,y]=indices(p);
    if(allowed(x,y))return key(x,y);
    let best=cells[0], dist=Infinity;
    for(const i of cells){const q=point(i), d=(q[0]-p[0])**2+(q[1]-p[1])**2;if(d<dist){dist=d;best=i;}}
    return best;
  }
  function clear(a,b){
    const length=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/(cell*.33)));
    let prev=indices(a);
    for(let i=1;i<=length;i++){
      const k=i/length,c=indices([a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k]);
      if(!allowed(...c)||!allowed(c[0],prev[1])||!allowed(prev[0],c[1]))return false;
      prev=c;
    }
    return true;
  }
  function route(from,to) {
    const start=nearest(from),end=nearest(to),parent=new Int32Array(width*rows.length).fill(-1),queue=[start];parent[start]=start;
    for(let n=0;n<queue.length&&parent[end]===-1;n++){
      const i=queue[n],x=i%width,y=Math.floor(i/width);
      for(const [a,b] of [[x+1,y],[x,y+1],[x-1,y],[x,y-1]]){
        const j=key(a,b);if(allowed(a,b)&&parent[j]===-1){parent[j]=i;queue.push(j);}
      }
    }
    if(parent[end]===-1)return [];
    const path=[point(end)];for(let i=end;i!==start;){i=parent[i];path.push(point(i));}path.reverse();
    const cleaned=[clear(from,path[0])?from:path[0]];
    for(let i=0;i<path.length-1;){let j=i+1;while(j+1<path.length&&clear(cleaned.at(-1),path[j+1]))j++;cleaned.push(path[j]);i=j;}
    return cleaned;
  }
  return {map,route,clear,nearestPoint:p=>point(nearest(p))};
}

export function prepareTrip(points) {
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const length=lengths.at(-1);
  return {length,lengths,at(distance){
    if(points.length===1||distance>=length)return points.at(-1);
    const i=Math.max(1,lengths.findIndex(s=>s>=distance)),a=points[i-1],b=points[i];
    const k=Math.max(0,(distance-lengths[i-1])/(lengths[i]-lengths[i-1]||1));
    return [a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k];
  }};
}
