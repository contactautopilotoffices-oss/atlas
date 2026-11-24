import {enableLocalDesignPreview} from './design-preview.js';
import {createDesignGallery} from './design-gallery.js';
import {createInteriorExplore} from './interior-explore.js';
import {schematicPlan} from './schematic-plan.js';
import {worldReturn,drawingHref} from './andheri-navigation.js';
import { applyAndheriTheme } from './andheri-ui.js';
applyAndheriTheme('interior');
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CAD_BASE, loadShortlist } from './andheri-data.js';
const $=s=>document.querySelector(s),q=new URLSearchParams(location.search),property=q.get('property');
const renderer=new THREE.WebGLRenderer({canvas:$('#view'),antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.localClippingEnabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xe8ecec);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.05,1000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=Math.PI/2-.01;controls.minDistance=2;controls.maxDistance=180;controls.zoomSpeed=.65;controls.panSpeed=.7;
const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.6;room.dispose();pmrem.dispose();
const hemi=new THREE.HemisphereLight(0xf4faff,0xc6bbaa,.75);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1dc,2.1);sun.position.set(20,35,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(0xdceaff,.55);fill.position.set(-15,14,-20);scene.add(fill);
const low=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{samples:low?0:4,type:THREE.HalfFloatType});
const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
const ao=new GTAOPass(scene,camera,innerWidth,innerHeight);ao.updateGtaoMaterial({radius:.75,distanceExponent:1.4,thickness:1,scale:1,samples:16});ao.blendIntensity=.45;
if(!low)composer.addPass(ao);composer.addPass(new OutputPass());
const clip=new THREE.Plane(new THREE.Vector3(0,-1,0),1.45),loader=new GLTFLoader();
let entry,current,plan,data,model,box,center,size,fly=null,token=0,evening=false;
let selectedDesignRoom=null;
const gallery=createDesignGallery({
 snapshot:()=>plan&&data?{camera:{position:camera.position.toArray(),target:camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3())).toArray(),fov:camera.fov,aspect:camera.aspect,up:new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).toArray(),near:camera.near,far:camera.far,cutaway:$('#cutaway').checked,ceiling:$('#ceiling').checked}}:null,
 view:(angle)=>{
  explore.stopWalk();
  if(angle==='overview'){overview();return;}
  if(!selectedDesignRoom?.outline_verified)return false;
  const z=selectedDesignRoom;
  const points=[...(z.d||'').matchAll(/(?:M|L)\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
  if(points.length<3)return false;
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
  const inside=([x,y])=>{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
  const middle=[(minX+maxX)/2,(minZ+maxZ)/2],focus=inside(middle)?middle:[z.label[0],-z.label[1]];
  const candidates=[[.16,.16],[.84,.84],[.16,.84],[.84,.16]].map(([x,y])=>[minX+(maxX-minX)*x,minZ+(maxZ-minZ)*y]).filter(inside);
  if(candidates.length<2)return false;
  const eye=candidates[angle==='reverse'?1:0],at=new THREE.Vector3(focus[0],1.05,focus[1]);
  controls.minDistance=.3;$('#cutaway').checked=false;applyView();camera.fov=80;camera.updateProjectionMatrix();
  for(const id of ['overview','overhead'])$('#'+id).setAttribute('aria-pressed','false');
  move(at,new THREE.Vector3(eye[0],1.6,eye[1]));
 }
});
const explore=createInteriorExplore({scene,camera,controls,move,cancelFly:()=>fly=null,openSpaces:setSpaces,property,canvas:renderer.domElement,onRoomSelected:z=>{selectedDesignRoom=z;gallery.select(z,{property,plan:plan.id,source_sha256:data.source.sha256,native_model:!!plan.model});}});
const catalogPromise=fetch(CAD_BASE+'comparisons/'+encodeURIComponent(property)+'.json').then(r=>r.ok?r.json():null).catch(()=>null);
let loadedVariant=null,loadedFloor=null;
async function getJSON(path){const r=await fetch(path);if(!r.ok)throw Error('Drawing data could not load.');return r.json();}
function fail(e){$('#load').hidden=false;$('#message').textContent=e.message||String(e);$('#error-return').hidden=false;$('#error-return').href=worldReturn(property);}
function disposeModel(){if(!model)return;scene.remove(model);model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});model=null;}
function move(at,to){fly={start:performance.now(),from:camera.position.clone(),at0:controls.target.clone(),to,at};}
function overview(overhead=false){if(!model)return;controls.minDistance=2;camera.fov=42;camera.updateProjectionMatrix();$('#overview').setAttribute('aria-pressed',String(!overhead));$('#overhead').setAttribute('aria-pressed',String(overhead));const radius=box.getBoundingSphere(new THREE.Sphere()).radius,v=camera.fov*Math.PI/180,h=2*Math.atan(Math.tan(v/2)*camera.aspect),dist=radius/Math.sin(Math.min(v,h)/2);controls.maxDistance=Math.max(180,dist*1.8);const direction=overhead?new THREE.Vector3(0,1,.0001):new THREE.Vector3(.65,.9,.72).normalize();move(center.clone(),center.clone().addScaledVector(direction,dist));}
function applyView(){if(!model)return;const cut=$('#cutaway').checked,ceiling=$('#ceiling').checked;renderer.clippingPlanes=cut?[clip]:[];model.traverse(o=>{if(!o.isMesh)return;const isCeiling=/ceiling/i.test(o.name)||/ceiling/i.test(o.userData.role||'');if(isCeiling)o.visible=ceiling;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.clippingPlanes=[];m.clipShadows=true;m.needsUpdate=true;}});}
async function openModel(){
 const request=++token;$('#ceiling').checked=false;$('#cutaway').checked=true;$('#load').hidden=false;$('#message').textContent='Loading the proposed fit-out…';
 plan=current.plans[Number($('#drawing').value)||0];
 const index=Number($('#drawing').value)||0;
 const previous=loadedVariant,carryView=previous&&previous!==current.id&&loadedFloor===index&&!explore.walking;
 const keepEye=carryView?camera.position.clone():null,keepAt=carryView?controls.target.clone():null;
 gallery.reset();selectedDesignRoom=null;explore.reset();fly=null;
 const [gltf,source,semantic,nav,catalog]=await Promise.all([
   plan.model?loader.loadAsync(plan.model):null,getJSON(CAD_BASE+plan.file),getJSON(CAD_BASE+plan.semantic),
   getJSON(CAD_BASE+'walks/'+plan.id+'.json'),catalogPromise
 ]);
 if(request!==token)return;
 if(nav.source_sha256!==source.source.sha256||semantic.source.sha256!==source.source.sha256)throw Error('Layout versions do not match.');
 data=source;disposeModel();model=gltf?.scene||schematicPlan(semantic,nav);scene.add(model);
 model.traverse(o=>{if(o.isMesh){o.castShadow=!/glass/i.test(o.name);o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(m.transmission)m.thickness=.03;}}});
 box=new THREE.Box3().setFromObject(model);center=box.getCenter(new THREE.Vector3());size=box.getSize(new THREE.Vector3());
 const half=Math.max(size.x,size.z)*.65;Object.assign(sun.shadow.camera,{left:-half,right:half,top:half,bottom:-half,near:.5,far:200});sun.shadow.camera.updateProjectionMatrix();sun.target.position.copy(center);sun.position.copy(center).add(new THREE.Vector3(20,35,18));
 document.title=`${entry.name} · ${current.seats} workstations · 3D · Autopilot`;
 $('#title').textContent=`${entry.name} · ${plan.name}`;$('#count').textContent=`${data.totals.work_seats} workstations`;
 $('#back').href=drawingHref('cad',property,current.id,$('#drawing').value,worldReturn(property));
 const url=new URL(location.href);url.searchParams.set('variant',current.id);url.searchParams.set('drawing',$('#drawing').value);history.replaceState(null,'',url);
 explore.load(data,semantic,nav,current,entry,catalog,index,previous!==current.id?previous:null);
 $('#note').lastChild.textContent=plan.model?'Finishes and vertical detailing are indicative.':'CAD schematic with illustrative wall heights.';
 applyView();if(keepEye){camera.position.copy(keepEye);controls.target.copy(keepAt);}else overview();
 loadedVariant=current.id;loadedFloor=index;$('#load').hidden=true;
 if(q.get('mode')==='walk'){$('#walk-layout').click();if(q.get('tour')==='1')$('#guided-walk').click();}
 window.__interior={property,variant:current.id,plan:plan.id,workstations:data.totals.work_seats,model,renderer,camera};
 if(q.get('room'))[...document.querySelectorAll('#space-list button')].find(b=>b.dataset.room===q.get('room'))?.click();
}
async function changeVariant(){current=entry.variants.find(v=>v.id===$('#variant').value)||entry.variants[0];$('#drawing').replaceChildren(...current.plans.map((p,i)=>new Option(p.name,String(i))));$('#drawing').hidden=current.plans.length<2;const n=q.get('drawing');if(n&&current.plans[Number(n)])$('#drawing').value=n;await openModel();}
function setSpaces(open){$('#spaces').toggleAttribute('data-collapsed',!open);$('#space-toggle').setAttribute('aria-expanded',String(open));}
$('#space-toggle').onclick=()=>setSpaces($('#space-toggle').getAttribute('aria-expanded')!=='true');
const mobileLayout=matchMedia('(max-width:900px)');setSpaces(!mobileLayout.matches);mobileLayout.addEventListener('change',()=>setSpaces(!mobileLayout.matches));
new ResizeObserver(()=>document.body.style.setProperty('--workspace-tools-top',Math.ceil($('header').getBoundingClientRect().bottom+10)+'px')).observe($('header'));
$('#overview').onclick=()=>{explore.stopWalk();overview();};$('#overhead').onclick=()=>{explore.stopWalk();overview(true);};
$('#cutaway').onchange=()=>{if(explore.walking&&$('#cutaway').checked){explore.stopWalk();overview(true);}if($('#cutaway').checked)$('#ceiling').checked=false;applyView();};$('#ceiling').onchange=async()=>{
 if($('#ceiling').checked) {
  $('#cutaway').checked=false;
  if(plan.ceiling && !model.userData.ceilingReady) {
   const request=token;$('#ceiling').disabled=true;
   try {const g=await loader.loadAsync(plan.ceiling);if(request!==token)return;g.scene.traverse(o=>{if(o.isMesh)o.userData.role='ceiling';});model.add(g.scene);model.userData.ceilingReady=true;}
   catch(e){console.warn(e);$('#ceiling').checked=false;}
   finally{$('#ceiling').disabled=false;}
  }
 }
 applyView();
};
$('#lighting').onclick=()=>{evening=!evening;sun.intensity=evening?.4:2.1;sun.color.set(evening?0xffbd87:0xfff1dc);hemi.intensity=evening?.5:.75;fill.intensity=evening?.35:.55;renderer.toneMappingExposure=evening?1.1:.95;$('#lighting').textContent=evening?'Daylight':'Evening';};
$('#save').onclick=()=>{const width=innerWidth,height=innerHeight,ratio=renderer.getPixelRatio();const scale=Math.min(4096/Math.max(width,height),3);renderer.setPixelRatio(1);renderer.setSize(Math.round(width*scale),Math.round(height*scale),false);composer.setPixelRatio(1);composer.setSize(Math.round(width*scale),Math.round(height*scale));composer.render();const a=document.createElement('a');a.download=plan.id+'-view.png';a.href=renderer.domElement.toDataURL('image/png');a.click();renderer.setPixelRatio(ratio);renderer.setSize(width,height);composer.setPixelRatio(ratio);composer.setSize(width,height);};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
controls.addEventListener('start',()=>fly=null);
function frame(t){if(fly){const k=Math.min((t-fly.start)/850,1),e=1-Math.pow(1-k,3);camera.position.lerpVectors(fly.from,fly.to,e);controls.target.lerpVectors(fly.at0,fly.at,e);if(k===1)fly=null;}if(explore.walking)explore.frame(t);else controls.update();if(!document.hidden)composer.render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
try{await enableLocalDesignPreview(q);entry=await loadShortlist(property);if(!entry)throw new Error('Opening the property explorer…');$('#variant').replaceChildren(...entry.variants.map(v=>new Option(`${v.seats} workstations`,v.id)));if(entry.variants.some(v=>v.id===q.get('variant')))$('#variant').value=q.get('variant');$('#variant').onchange=()=>{q.set('drawing',$('#drawing').value);changeVariant().catch(fail);};$('#drawing').onchange=()=>{q.delete('drawing');openModel().catch(fail);};await changeVariant();}catch(e){fail(e);}
