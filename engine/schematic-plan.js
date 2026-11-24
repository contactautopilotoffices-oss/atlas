import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// CAD-only options use their own drawing in eye-level mode. Heights are illustrative.
export function schematicPlan(source,nav){
  const group=new THREE.Group(),sets=new Map();
  const palette={walls:0xd8dce0,glass:0x98becb,desks:0xe4ca9e,leaf:0xac9780};
  function add(kind,geometry){
    if(!sets.has(kind))sets.set(kind,[]);
    sets.get(kind).push(geometry);
  }
  function bar(a,b,height,thickness,kind){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.02)return;
    const geometry=new THREE.BoxGeometry(length,height,thickness);
    geometry.rotateY(Math.atan2(b[1]-a[1],b[0]-a[0]));
    geometry.translate((a[0]+b[0])/2,height/2,-(a[1]+b[1])/2);add(kind,geometry);
  }
  const swings=new Set(nav.swing_segments.map(pair=>pair.join("/")));
  for(const part of source.architecture){
    if(swings.has([part.insert_handle,part.handle].join("/")))continue;
    if(!['walls','glass'].includes(part.kind))continue;
    const pts=part.points_m;
    for(let i=1;i<pts.length;i++)bar(pts[i-1],pts[i],2.7,.035,part.kind);
  }
  for(const desk of source.desks){
    const p=desk.desktop_polygon_m;
    if(p.length<4)continue;
    const a=p[0],b=p[1],c=p[2];
    const g=new THREE.BoxGeometry(Math.hypot(b[0]-a[0],b[1]-a[1]),.07,Math.hypot(c[0]-b[0],c[1]-b[1]));
    g.rotateY(Math.atan2(b[1]-a[1],b[0]-a[0]));
    g.translate(desk.desktop_center_m[0],.71,-desk.desktop_center_m[1]);add('desks',g);
  }
  for(const [kind,parts] of sets){
    const mat=new THREE.MeshStandardMaterial({color:palette[kind],transparent:kind==='glass',opacity:kind==='glass'?.36:1});
    const mesh=new THREE.Mesh(mergeGeometries(parts),mat);mesh.name=kind;group.add(mesh);parts.forEach(g=>g.dispose());
  }
  const [x,y,r,t]=source.bounds_m,floor=new THREE.Mesh(new THREE.BoxGeometry(r-x,.04,t-y),new THREE.MeshStandardMaterial({color:0xd6d4d0}));
  floor.position.set((x+r)/2,-.025,-(y+t)/2);group.add(floor);return group;
}
