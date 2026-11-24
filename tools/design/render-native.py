"""Dedicated Blender worker: import the exact registered web model; never alter mesh geometry."""
import bpy,sys,json,math,hashlib,struct,re
from pathlib import Path
from mathutils import Vector,Matrix
spec_path,out_path=sys.argv[sys.argv.index('--')+1:];spec=json.loads(Path(spec_path).read_text());out=Path(out_path);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def registered(a):
 p=(repo/a['path'].lstrip('/')).resolve()
 if not p.is_relative_to(repo) or digest(p)!=a['sha256']:raise ValueError('Registered scene hash changed')
 return p
if spec.get('data_asset'):registered(spec['data_asset'])
bpy.ops.wm.read_factory_settings(use_empty=True)
for a in [spec['native_asset'],spec.get('ceiling_asset')]:
 if a:bpy.ops.import_scene.gltf(filepath=str(registered(a)))
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
meshes=[o for o in scene.objects if o.type=='MESH']
def fingerprint():
 h=hashlib.sha256()
 for o in sorted([obj for obj in scene.objects if obj.type=='MESH'],key=lambda o:o.name):
  h.update(o.name.encode());h.update(struct.pack('<16d',*[v for row in o.matrix_world for v in row]))
  for v in o.data.vertices:h.update(struct.pack('<3d',*v.co))
  for p in o.data.polygons:h.update(struct.pack('<I',len(p.vertices)));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
 return h.hexdigest()
bpy.context.view_layer.update();before=fingerprint()
polygon=[(float(x),-float(y)) for x,y in re.findall(r'(?:M|L)\s*(-?[\d.]+)[ ,]+(-?[\d.]+)',spec['room']['polygon'])]
def inside(p):
 x,y=p
 for a,b in zip(polygon,polygon[1:]+polygon[:1]):
  dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy or 1)))
  if math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<.003:return True
 yes=False
 for a,b in zip(polygon,polygon[1:]+polygon[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:yes=not yes
 return yes
colors=spec['proposal']['colors'];rgb=[sum(int(c[i:i+2],16)/255 for c in colors)/len(colors) for i in (1,3,5)]
linear=lambda x:x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
changed=0
for o in meshes:
 if o.get('role')!='RoomFinish' and 'RoomFinish' not in o.name:continue
 slots={}
 for face in o.data.polygons:
  coords=[o.matrix_world@o.data.vertices[v].co for v in face.vertices]
  if not all(inside((v.x,v.y)) for v in coords):continue
  old=face.material_index
  if old not in slots:
   material=o.data.materials[old].copy() if old<len(o.data.materials) else bpy.data.materials.new('Proposed_room_finish')
   material.use_nodes=True;material.name='PROPOSED_PALETTE_'+spec['context']['room_id']
   material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*map(linear,rgb),1)
   o.data.materials.append(material);slots[old]=len(o.data.materials)-1
  face.material_index=slots[old];changed+=1
if not changed:raise ValueError('No existing finish faces lie fully inside this verified room; no geometry was invented.')
# Clipping is a render material effect, preserving every mesh and transform.
if spec['camera'].get('cutaway'):
 for m in list(bpy.data.materials):
  if not m.use_nodes:continue
  nodes=m.node_tree.nodes;links=m.node_tree.links;output=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None)
  if not output or not output.inputs['Surface'].links:continue
  original=output.inputs['Surface'].links[0].from_socket
  geo=nodes.new('ShaderNodeNewGeometry');sep=nodes.new('ShaderNodeSeparateXYZ');greater=nodes.new('ShaderNodeMath');greater.operation='GREATER_THAN';greater.inputs[1].default_value=1.45
  transparent=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader')
  links.new(geo.outputs['Position'],sep.inputs[0]);links.new(sep.outputs['Z'],greater.inputs[0]);links.new(greater.outputs[0],mix.inputs[0]);links.new(original,mix.inputs[1]);links.new(transparent.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface'])
convert=lambda p:Vector((p[0],-p[2],p[1]))
c=spec['camera'];eye=convert(c['position']);forward=(convert(c['target'])-eye).normalized();up=convert(c['up']).normalized();right=forward.cross(up).normalized();up=right.cross(forward).normalized()
cam=bpy.data.cameras.new('Atlas_saved_camera');obj=bpy.data.objects.new('Atlas_saved_camera',cam);scene.collection.objects.link(obj);obj.location=eye;obj.rotation_euler=Matrix((right,up,-forward)).transposed().to_euler();scene.camera=obj
cam.type='PERSP';cam.sensor_fit='VERTICAL';cam.sensor_height=24;cam.lens=24/(2*math.tan(math.radians(c['fov'])/2));cam.clip_start=c['near'];cam.clip_end=c['far']
width=min(1024,max(256,int(1440*c['aspect'])));height=max(256,round(width/c['aspect']));scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100;scene.render.pixel_aspect_x=c['aspect']/(width/height);scene.render.pixel_aspect_y=1
scene.world=bpy.data.worlds.new('Neutral_world_no_invented_surroundings');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.6,.65,.7,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
for name,offset,power,size in [('Soft_native_key',(0,0,3),350,3),('Soft_native_fill',(2,-2,2),120,2)]:
 light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size;o=bpy.data.objects.new(name,light);scene.collection.objects.link(o);o.location=eye+Vector(offset);o.rotation_euler=(convert(c['target'])-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'native.png');scene.view_settings.view_transform='AgX'
after=fingerprint()
if before!=after:raise ValueError('Geometry fingerprint changed; refusing native render')
bpy.ops.render.render(write_still=True)
metadata={'schema_version':1,'blender_version':bpy.app.version_string,'renderer_script_sha256':digest(Path(__file__)),'engine':'blender-native','scene_sha256':spec['native_asset']['sha256'],'source_sha256':spec['context']['source_sha256'],'context':spec['context'],'camera':c,'geometry_before':before,'geometry_after':after,'geometry_unchanged':before==after,'mesh_count':len(meshes),'changed_finish_faces':changed,'palette_hex':colors,'assumptions':spec['assumptions'],'unapplied_features':spec['proposal']['unapplied_features'],'review_status':'review_required','image_sha256':digest(out/'native.png'),'pixel_size':[width,height]}
(out/'metadata.json').write_text(json.dumps(metadata,indent=2));print('ATLAS_NATIVE_RENDER_COMPLETE')
