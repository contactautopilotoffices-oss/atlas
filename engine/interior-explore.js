import * as THREE from 'three';
import {floorNavigation,prepareTrip} from './floor-navigation.js';
import {layoutDifference} from './seat-diff.js';

const $=selector=>document.querySelector(selector);
const point3=([x,y],z)=>new THREE.Vector3(x,z,-y);
function polygonFromPath(path){
  return [...(path||'').matchAll(/(?:M|L)\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)].map(m=>[Number(m[1]),-Number(m[2])]);
}
function paintRegions(group,polygons,color,height,opacity=.57){
  const vertices=[];
  for(const points of polygons){
    if(points.length<3)continue;
    const p=points.map(([x,y])=>new THREE.Vector2(x,y));
    for(const triangle of THREE.ShapeUtils.triangulateShape(p,[])){
      for(const i of triangle)vertices.push(p[i].x,height,-p[i].y);
    }
  }
  if(!vertices.length)return;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const material=new THREE.MeshBasicMaterial({color,opacity,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
  group.add(new THREE.Mesh(geometry,material));
}
function clear(group){
  group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  group.clear();
}

export function createInteriorExplore({scene,camera,controls,move,cancelFly,openSpaces,property,canvas,onRoomSelected=()=>{}}){
  const tint=new THREE.Group();scene.add(tint);
  let nav,source,plan,zones=[],deskZones,walk=false,position,yaw=0,pitch=0,lastTime=0,drag=null,journey=null,playing=false,nextStop=0,hold=0;
  let currentOption,options=[],comparison=null;
  const keys=new Set();
  let lastTrace=null;
  const pathData=points=>points.map(([x,y],i)=>(i?'L':'M')+x+' '+(-y)).join(' ');
  function trace(){
    $('#walk-here').setAttribute('cx',position[0]);$('#walk-here').setAttribute('cy',-position[1]);
    if(lastTrace&&Math.hypot(position[0]-lastTrace[0],position[1]-lastTrace[1])<.28)return;
    const trail=$('#walk-trail');trail.setAttribute('d',(trail.getAttribute('d')||'')+(lastTrace?'L':'M')+position[0]+' '+(-position[1]));lastTrace=position.slice();
  }
  function say(text){$('#zone-status').textContent=text;}
  function stopWalk(){
    if(!walk)return;
    $('#walk-map').setAttribute('hidden','');walk=false;playing=false;journey=null;keys.clear();drag=null;controls.enabled=true;camera.fov=42;camera.updateProjectionMatrix();
    $('#walk-commands').hidden=true;$('#walk-layout').setAttribute('aria-pressed','false');
    $('#cutaway').checked=true;$('#cutaway').dispatchEvent(new Event('change'));say('');
  }
  function setLook(){
    const v=point3(position,1.60);
    camera.position.copy(v);
    camera.lookAt(v.x+Math.cos(yaw)*Math.cos(pitch),v.y+Math.sin(pitch),v.z-Math.sin(yaw)*Math.cos(pitch));
  }
  function startWalk(){
    if(!nav)return;
    cancelFly();if(walk)stopWalk();
    walk=true;controls.enabled=false;playing=false;journey=null;nextStop=0;hold=0;
    position=nav.map.start.slice();yaw=Math.atan2(nav.map.heading[1],nav.map.heading[0]);pitch=0;
    const [x,y,X,Y]=plan.bounds;$('#walk-map').setAttribute('viewBox',[x-1,-Y-1,X-x+2,Y-y+2].join(' '));
    $('#walk-map').removeAttribute('hidden');$('#walk-walls').setAttribute('d',plan.cad.walls);$('#walk-ahead').setAttribute('d','');$('#walk-trail').setAttribute('d','');lastTrace=null;trace();
    camera.fov=67;camera.updateProjectionMatrix();setLook();clear(tint);$('#zone-map').setAttribute('aria-pressed','false');
    document.querySelectorAll('#space-list button').forEach(b=>b.setAttribute('aria-pressed','false'));$('#seat-changes').setAttribute('aria-pressed','false');$('#compare-summary').hidden=true;
    $('#cutaway').checked=false;$('#cutaway').dispatchEvent(new Event('change'));
    for(const id of ['overview','overhead'])$('#'+id).setAttribute('aria-pressed','false');
    $('#walk-commands').hidden=false;$('#walk-layout').setAttribute('aria-pressed','true');$('#guided-walk').textContent='Start room tour';
    say(nav.map.title+' · Drag to look. Use arrows or W A S D to move.');
  }
  function roomPolygons(z){
    if(deskZones.has(z.id))return deskZones.get(z.id);
    const outline=polygonFromPath(z.d);return outline.length>=3?[outline]:[];
  }
  function frameArea(polygons,anchor){
    camera.fov=42;camera.updateProjectionMatrix();controls.minDistance=2;
    const box=new THREE.Box3();
    for(const p of polygons.flat())box.expandByPoint(point3(p,.1));
    if(box.isEmpty()){box.setFromCenterAndSize(point3(anchor,.1),new THREE.Vector3(3,0,3));}
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const radius=Math.max(5,size.x/Math.min(1.65,camera.aspect),size.z);
    const distance=(radius+3)/(2*Math.tan(THREE.MathUtils.degToRad(42/2)))*1.34;
    move(center,center.clone().add(new THREE.Vector3(0,.998,.075).normalize().multiplyScalar(distance)));
    $('#overview').setAttribute('aria-pressed','false');$('#overhead').setAttribute('aria-pressed','true');
  }
  function showZones(){
    clear(tint);
    $('#zone-map').setAttribute('aria-pressed','true');
    $('#seat-changes').setAttribute('aria-pressed','false');
    $('#compare-summary').hidden=true;
    document.querySelectorAll('#space-list button').forEach(b=>b.setAttribute('aria-pressed','false'));
    for(const z of zones){
      const desks=deskZones.has(z.id);
      paintRegions(tint,roomPolygons(z),z.color||'#379a9b',desks?.755:.032,.48);
    }
    say('');
  }
  function selectZone(z){
    onRoomSelected(z);
    $('#zone-map').setAttribute('aria-pressed','false');
    clear(tint);$('#seat-changes').setAttribute('aria-pressed','false');
    const polygons=roomPolygons(z);
    const desks=deskZones.has(z.id);
    paintRegions(tint,polygons,z.color||'#379a9b',desks?.755:.032);
    if(!polygons.length){
      const ring=new THREE.Mesh(new THREE.RingGeometry(.33,.46,32),new THREE.MeshBasicMaterial({color:z.color||'#1984a0',side:THREE.DoubleSide}));
      ring.rotation.x=-Math.PI/2;ring.position.copy(point3(z.label,.04));tint.add(ring);
    }
    document.querySelectorAll('#space-list button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.room===z.id)));
    $('#compare-summary').hidden=true;
    if(!walk)frameArea(polygons,z.label);
    say(z.name+(desks?' · '+polygons.length+' drawn desks':z.area_sqft?' · '+z.area_sqft+' sq ft'+(z.note&&z.note.includes('partition crosses')?' · Drawn divider crosses the table.':''):polygons.length?'':' · CAD label position'));
    if(innerWidth<=900)openSpaces(false);
  }
  function reviewChanges(){
    if(!comparison)return;
    clear(tint);
    $('#zone-map').setAttribute('aria-pressed','false');
    const {diff,base}=comparison;
    paintRegions(tint,diff.added.map(d=>d.polygon),'#00ac85',.755,.92);
    paintRegions(tint,diff.removed.map(d=>d.polygon),'#e69126',.76,.72);
    paintRegions(tint,diff.adjusted.map(d=>d.polygon),'#8852ba',.756,.7);
    $('#seat-changes').setAttribute('aria-pressed','true');
    document.querySelectorAll('#space-list button').forEach(b=>b.setAttribute('aria-pressed','false'));
    say('Compared with '+base.seats+' seats · '+diff.added.length+' added · '+diff.removed.length+' removed'+(diff.adjusted.length?' · '+diff.adjusted.length+' repositioned':''));
    $('#compare-summary').hidden=false;
  }
  function visit(z){
    selectZone(z);
    const path=nav.route(position,z.label),target=path.at(-1);
    if(!target)return;
    $('#walk-ahead').setAttribute('d',pathData(path));
    journey={trip:prepareTrip(path),distance:0,look:z.label,guided:playing};
    if(Math.hypot(target[0]-z.label[0],target[1]-z.label[1])>2.5)say(z.name+' · View from the accessible aisle');
  }
  function toggleGuide(){
    if(playing){playing=false;$('#guided-walk').textContent='Continue tour';return;}
    const replay=$('#guided-walk').textContent==='Replay tour';
    playing=true;$('#guided-walk').textContent='Pause tour';
    if(replay)nextStop=0;
    if(nextStop===0){lastTrace=null;$('#walk-trail').setAttribute('d','');$('#walk-ahead').setAttribute('d','');position=nav.map.start.slice();yaw=Math.atan2(nav.map.heading[1],nav.map.heading[0]);pitch=0;hold=1;setLook();say(nav.map.title);}
  }
  function manual(){$('#walk-ahead').setAttribute('d','');playing=false;journey=null;$('#guided-walk').textContent='Continue tour';}
  function step(dt){
    if(!walk)return;
    const f=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
    const side=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    if(f||side){
      const scale=1.65*dt/Math.hypot(f,side);
      const dx=(f*Math.cos(yaw)+side*Math.sin(yaw))*scale,dy=(f*Math.sin(yaw)-side*Math.cos(yaw))*scale;
      for(const dest of [[position[0]+dx,position[1]+dy],[position[0]+dx,position[1]],[position[0],position[1]+dy]])if(nav.clear(position,dest)){position=dest;break;}
    }else if(journey&&(playing||!journey.guided)){
      const j=journey;j.distance+=1.8*dt;position=j.trip.at(j.distance);const next=j.distance+.45>=j.trip.length?j.look:j.trip.at(j.distance+.45);
      if(Math.hypot(next[0]-position[0],next[1]-position[1])>.07){
        const target=Math.atan2(next[1]-position[1],next[0]-position[0]);
        yaw+=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw))*Math.min(1,5*dt);
      }
      if(j.distance>=j.trip.length){journey=null;hold=2.8;}
    }else if(playing){
      hold-=dt;
      if(hold<=0){if(nextStop<zones.length)visit(zones[nextStop++]);else{playing=false;$('#guided-walk').textContent='Replay tour';say('Tour complete');}}
    }
    setLook();trace();
  }
  $('#zone-map').onclick=()=>{
    if($('#zone-map').getAttribute('aria-pressed')==='false')showZones();
    else{clear(tint);$('#zone-map').setAttribute('aria-pressed','false');}
  };
  $('#walk-layout').onclick=startWalk;$('#guided-walk').onclick=toggleGuide;
  $('#seat-changes').onclick=()=>{if($('#seat-changes').getAttribute('aria-pressed')==='true'){clear(tint);say('');$('#compare-summary').hidden=true;$('#seat-changes').setAttribute('aria-pressed','false');}else reviewChanges();};
  for(const b of document.querySelectorAll('[data-step]')){
    b.onpointerdown=e=>{e.preventDefault();manual();keys.add(b.dataset.step);b.setPointerCapture(e.pointerId);};
    b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.step);
  }
  // Click verified floor enclosures; dragging continues to orbit without selecting.
  let roomPointer=null;
  canvas.addEventListener('pointerdown',e=>{if(!walk)roomPointer=[e.clientX,e.clientY];});
  canvas.addEventListener('pointerup',e=>{
    if(walk||!roomPointer||!plan)return;
    const start=roomPointer;roomPointer=null;if(Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;
    const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(!hit)return;
    const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
    const zone=plan.zones.find(z=>z.outline_verified&&z.kind!=='passage'&&roomPolygons(z).some(poly=>inside([hit.x,-hit.z],poly)));
    if(zone)selectZone(zone);
  });
  canvas.addEventListener('pointerdown',e=>{if(walk){manual();drag=[e.clientX,e.clientY,e.pointerId];canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(walk&&drag&&drag[2]===e.pointerId){yaw-=(e.clientX-drag[0])*.004;pitch=Math.max(-1.1,Math.min(1.1,pitch-(e.clientY-drag[1])*.004));drag=[e.clientX,e.clientY,e.pointerId];}});
  canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
  addEventListener('keydown',e=>{if(!walk||e.target.closest('.atlas-gallery')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();if(k==='escape'){$('#overview').click();return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();manual();keys.add(k);}});
  addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  addEventListener('blur',()=>{keys.clear();drag=null;if(walk)manual();});
  return {stopWalk,get walking(){return walk;},frame(t){const dt=Math.min(.06,Math.max(0,(t-lastTime)/1000));lastTime=t;if(!document.hidden)step(dt);},
    reset(){stopWalk();clear(tint);nav=null;comparison=null;$('#seat-changes').hidden=true;$('#walk-layout').disabled=true;$('#zone-map').disabled=true;$('#compare-summary').hidden=true;say('');},
    load(data,semantic,map,variant,entry,catalog,index,previous){
      plan={...data,zones:[...data.zones,...(data.others||[])]};source=semantic;nav=floorNavigation(map);currentOption=variant;options=entry.variants;
      $('#walk-layout').disabled=false;$('#zone-map').disabled=false;deskZones=new Map();
      const groups=plan.zones.filter(z=>z.group==='Workstations');
      groups.forEach(z=>deskZones.set(z.id,[]));
      for(const d of source.desks){const c=d.desktop_center_m;let nearest=null,best=Infinity;for(const z of groups){const dist=Math.hypot(c[0]-z.label[0],c[1]-z.label[1]);if(dist<best){best=dist;nearest=z;}}if(nearest)deskZones.get(nearest.id).push(d.desktop_polygon_m);}
      zones=[];const remaining=[...plan.zones];let last=map.start;
      while(remaining.length){remaining.sort((a,b)=>Math.hypot(a.label[0]-last[0],a.label[1]-last[1])-Math.hypot(b.label[0]-last[0],b.label[1]-last[1]));const z=remaining.shift();zones.push(z);last=z.label;}
      $('#space-list').replaceChildren(...plan.zones.map(z=>{const b=document.createElement('button');b.textContent=z.name;b.dataset.room=z.id;b.style.setProperty('--zone-color',z.color||'#238a91');b.onclick=()=>{if(walk){manual();visit(z);}else selectZone(z);};return b;}));
      const v=catalog?.variants.find(v=>v.id===variant.id),other=catalog?.variants.find(v=>v.id===previous) || catalog?.variants[Math.max(0,options.indexOf(currentOption)-1)];
      comparison=v&&other&&v.id!==other.id?{diff:layoutDifference(other.plans[index].desks,v.plans[index].desks,catalog.matching_tolerance_m,property),base:other}:null;
      $('#seat-changes').hidden=!comparison;$('#seat-changes').setAttribute('aria-pressed','false');
      if(comparison)reviewChanges();else showZones();
    }
  };
}
