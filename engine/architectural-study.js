import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {SSAARenderPass} from 'three/addons/postprocessing/SSAARenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const $=s=>document.querySelector(s),canvas=$('#view'),status=$('#status');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=null;
const camera=new THREE.PerspectiveCamera(35,1,.1,20000),controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.08;controls.rotateSpeed=.45;controls.zoomSpeed=.75;controls.maxPolarAngle=Math.PI*.47;
const composer=new EffectComposer(renderer),antialias=new SSAARenderPass(scene,camera);composer.addPass(antialias);composer.addPass(new OutputPass());
const sun=new THREE.DirectionalLight(0xfff1df,1.35);sun.position.set(-70,120,90);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.normalBias=.04;scene.add(sun,sun.target,new THREE.HemisphereLight(0xe8f1ff,0xb4ad9f,.35));
const sky=new Sky();sky.scale.setScalar(10000);sky.material.uniforms.sunPosition.value.copy(sun.position);sky.material.uniforms.turbidity.value=3;sky.material.uniforms.rayleigh.value=1.5;
const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(sky,.04);scene.environment=env.texture;scene.environmentIntensity=.65;pmrem.dispose();
const lightReady=new RGBELoader().loadAsync('/andheri-project/fresh-723/sky.hdr').then(hdr=>{hdr.mapping=THREE.EquirectangularReflectionMapping;const generator=new THREE.PMREMGenerator(renderer),photographic=generator.fromEquirectangular(hdr);scene.environment=photographic.texture;scene.environmentRotation.y=0;document.body.dataset.lighting='photographic';invalidate();generator.dispose();hdr.dispose();env.dispose();return true;}).catch(()=>{document.body.dataset.lighting='procedural';return false;});
const architecture=new THREE.Group(),location=new THREE.Group();scene.add(architecture,location);location.visible=false;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0xeae9e3,roughness:1}));floor.receiveShadow=true;floor.position.y=-.025;architecture.add(floor);
let model=null,modelInfo=null,box=null,mode='building',mapReady=false,mapPending=null,mapBounds=null;
const busy=message=>{status.textContent=message;status.hidden=false;};
function fit(front=false){
 if(mode==='location'){camera.up.set(0,1,0);controls.enableRotate=false;controls.minPolarAngle=.0001;controls.maxPolarAngle=.001;const c=mapBounds?mapBounds.getCenter(new THREE.Vector3()):new THREE.Vector3(-200,0,0),s=mapBounds?mapBounds.getSize(new THREE.Vector3()):new THREE.Vector3(1200,0,1100);const distance=Math.min(s.x/camera.aspect,s.z)*.46/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));controls.target.copy(c);camera.position.copy(c).add(new THREE.Vector3(0,distance,.01));controls.minDistance=100;controls.maxDistance=distance;controls.update();return;}
 camera.up.set(0,1,0);controls.enableRotate=true;controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.60;if(!box)return;
 const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),aspect=camera.aspect;
 const distance=Math.max(size.y,size.x/aspect)*.58/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const proof=modelInfo?.camera||modelInfo?.frontCamera;const direction=proof?new THREE.Vector3(proof.position[0]-proof.target[0],proof.position[2]-proof.target[2],-(proof.position[1]-proof.target[1])):new THREE.Vector3(-.36,-.12,1);controls.target.copy(center);camera.position.copy(center).add(front?new THREE.Vector3(0,0,distance):direction.normalize().multiplyScalar(distance*1.12));camera.position.y=Math.max(1.7,camera.position.y);
 controls.minDistance=Math.max(8,size.y*.35);controls.maxDistance=size.y*8;controls.update();
}
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);composer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();if(model||mode==='location')fit();invalidate();}
new ResizeObserver(resize).observe(canvas.parentElement);
async function loadModel(){
 try{
  const response=await fetch('/andheri-project/fresh-723/723.glb',{method:'HEAD'});
  if(!response.ok){if(mode==='building')busy('The new architectural model is being prepared. Location is available.');return;}
  const [gltf,,metadata]=await Promise.all([new GLTFLoader().loadAsync('/andheri-project/fresh-723/723.glb',event=>{if(mode==='building'&&event.total)busy(`Loading architecture · ${Math.round(event.loaded/event.total*100)}%`);}),lightReady,fetch('/andheri-project/fresh-723/723.json').then(r=>r.ok?r.json():null).catch(()=>null)]);modelInfo=metadata;
  model=gltf.scene;const studio=[];model.traverse(o=>{if(o.userData.role==='studio_stage')studio.push(o);});studio.forEach(o=>o.removeFromParent());model.traverse(o=>{if(o.isMesh){const materials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=!materials.every(m=>m.transmission>0);o.receiveShadow=true;for(const m of materials){m.envMapIntensity=1;if(m.map)m.map.anisotropy=renderer.capabilities.getMaxAnisotropy();}}});
  // Studio lighting is separate from the property geometry and is never geographic evidence.
  if(modelInfo?.lighting?.areaLights?.length){
   RectAreaLightUniformsLib.init();
   const xyz=p=>new THREE.Vector3(p[0],p[2],-p[1]);
   for(const q of modelInfo.lighting.areaLights){const light=new THREE.RectAreaLight(0xffffff,q.suggestedThreeIntensity,q.width,q.height);light.position.copy(xyz(q.position));light.lookAt(xyz(q.target));architecture.add(light);}
  }
  architecture.add(model);box=new THREE.Box3().setFromObject(model);const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const s=sun.shadow.camera;Object.assign(s,{left:-size.y,right:size.y,top:size.y,bottom:-size.y,near:1,far:500});s.updateProjectionMatrix();sun.target.position.copy(c);
  if(mode==='building'){status.hidden=true;fit();}
 }catch{if(mode==='building')busy('The architectural model could not load. Please refresh to try again.');}
}
const ORIGIN=[72.8843436,19.1096039],D=Math.PI/180,R=6378137,COS=Math.cos(ORIGIN[1]*D);
const mx=lon=>R*lon*D,my=lat=>R*Math.log(Math.tan(Math.PI/4+lat*D/2));
const xy=(lon,lat)=>[(mx(lon)-mx(ORIGIN[0]))*COS,(my(ORIGIN[1])-my(lat))*COS];
async function loadMap(){
 if(mapReady)return;if(mapPending)return mapPending;
 mapPending=(async()=>{
  location.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.map?.dispose();o.material.dispose();}});location.clear();mapBounds=null;
  const key=window.GOOGLE_MAP_TILES_API_KEY;if(!key)throw new Error('Map configuration missing');
  const response=await fetch('https://tile.googleapis.com/v1/createSession?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapType:'satellite',language:'en-US',region:'IN',imageFormat:'jpeg',layerTypes:['layerRoadmap']})});
  if(!response.ok)throw new Error('Map connection failed');const session=await response.json();
  const z=18,n=2**z,tx=lon=>(lon+180)/360*n,ty=lat=>(1-Math.asinh(Math.tan(lat*D))/Math.PI)/2*n;
  const lon=x=>x/n*360-180,lat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))/D;
  const x0=Math.floor(tx(ORIGIN[0]))-6,x1=x0+9,y0=Math.floor(ty(ORIGIN[1]))-4,y1=y0+8;
  const params=new URLSearchParams({session:session.session,key,zoom:z,north:lat(y0),south:lat(y1+1),west:lon(x0),east:lon(x1+1)});
  const v=await fetch('https://tile.googleapis.com/tile/v1/viewport?'+params);if(!v.ok)throw new Error('Map attribution could not load');const metadata=await v.json();$('#map-copyright').textContent=metadata.copyright;
  const jobs=[];for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)jobs.push([x,y]);
  let completed=0,failed=0;const textures=new THREE.TextureLoader();
  async function worker(){while(jobs.length){const [x,y]=jobs.shift();try{
   const image=await textures.loadAsync(`https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(session.session)}&key=${encodeURIComponent(key)}`);image.colorSpace=THREE.SRGBColorSpace;image.anisotropy=renderer.capabilities.getMaxAnisotropy();
   const a=xy(lon(x),lat(y)),b=xy(lon(x+1),lat(y+1));const mesh=new THREE.Mesh(new THREE.PlaneGeometry(b[0]-a[0],b[1]-a[1]).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:image,toneMapped:false}));mesh.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2);location.add(mesh);
  }catch{failed++;}completed++;if(mode==='location')busy(`Opening the location · ${completed} / ${(x1-x0+1)*(y1-y0+1)}`);}}
  await Promise.all(Array.from({length:6},worker));if(failed)throw new Error('Some map tiles could not load');mapReady=true;mapBounds=new THREE.Box3().setFromObject(location);if(mode==='location')fit();
 })();try{await mapPending;}catch(e){mapPending=null;throw e;}
}
async function setMode(next){
 mode=next;document.body.dataset.mode=mode;invalidate();architecture.visible=mode==='building';location.visible=mode==='location';$('#map-attribution').hidden=mode!=='location';$('#front').hidden=mode==='location';
 for(const button of document.querySelectorAll('[data-view]')){const selected=button.dataset.view===mode;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
 $('#caption').textContent=mode==='building'?'Architectural study · Plan and photograph references':'Live location · Google Maps';fit();
 if(mode==='building'){status.hidden=!!model;if(!model)busy('The new architectural model is being prepared. Location is available.');return;}
 busy('Connecting to the live map…');try{await loadMap();if(mode==='location')status.hidden=true;}catch{if(mode==='location')busy('The live map could not load. Please refresh to try again.');}
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setMode(button.dataset.view));$('#location-action').onclick=()=>setMode('location');$('#fit').onclick=()=>fit();$('#front').onclick=()=>fit(true);
$('#details-toggle').onclick=()=>{const expanded=document.body.classList.toggle('expanded');$('#details-toggle').setAttribute('aria-expanded',String(expanded));$('#sheet-chevron').textContent=expanded?'−':'＋';};
addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('expanded')){$('#details-toggle').focus();document.body.classList.remove('expanded');$('#details-toggle').setAttribute('aria-expanded','false');$('#sheet-chevron').textContent='＋';}});
const markerPoint=new THREE.Vector3();$('#map-pin').onclick=()=>{controls.target.set(0,0,0);camera.position.set(0,Math.min(700,controls.maxDistance),.01);controls.update();};
// Repaint while controls settle or an asset/view changes; an idle building needs no GPU loop.
let frameRequested=false;
function invalidate(){if(!frameRequested){frameRequested=true;requestAnimationFrame(render);}}
controls.addEventListener('change',invalidate);
function render(){
 frameRequested=false;const moving=controls.update();if(mode==='building')camera.position.y=Math.max(1.7,camera.position.y);
 if(mode==='location'&&mapBounds){const halfH=Math.abs(camera.position.y)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),halfW=halfH*camera.aspect;const x=THREE.MathUtils.clamp(controls.target.x,mapBounds.min.x+halfW,mapBounds.max.x-halfW),z=THREE.MathUtils.clamp(controls.target.z,mapBounds.min.z+halfH,mapBounds.max.z-halfH);camera.position.x+=x-controls.target.x;camera.position.z+=z-controls.target.z;controls.target.x=x;controls.target.z=z;markerPoint.set(0,.1,0).project(camera);$('#map-pin').hidden=Math.abs(markerPoint.x)>1||Math.abs(markerPoint.y)>1;$('#map-pin').style.transform=`translate(${canvas.offsetLeft+(markerPoint.x*.5+.5)*canvas.clientWidth}px,${canvas.offsetTop+(-markerPoint.y*.5+.5)*canvas.clientHeight}px) translate(-50%,-100%)`;}else $('#map-pin').hidden=true;
 if(mode==='building'){antialias.sampleLevel=moving?0:3;composer.render();}else renderer.render(scene,camera);
}resize();loadModel();
