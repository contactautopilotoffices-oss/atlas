"""Editable CAD-derived Andheri concept interiors; original XY geometry retained.
Blender -b --factory-startup --python build_interiors.py -- --input prepared --output outputs [--id ID] [--render]
All vertical details/finishes beyond source deck heights are review assumptions.
"""
import argparse,collections,json,math,os,sys,time
from pathlib import Path
import bpy
from mathutils import Vector,Matrix
P=argparse.ArgumentParser();P.add_argument('--input',required=True);P.add_argument('--output',required=True);P.add_argument('--id');P.add_argument('--render',action='store_true');P.add_argument('--render-only',action='store_true');P.add_argument('--cutaway-only',action='store_true');a=P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=Path(a.output);OUT.mkdir(parents=True,exist_ok=True)
J=lambda x:json.dumps(x,separators=(',',':'))

def material(name,color,rough=.6,metal=0,alpha=1,transmission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*color,alpha);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 p.inputs['Alpha'].default_value=alpha
 if 'Transmission Weight'in p.inputs:p.inputs['Transmission Weight'].default_value=transmission
 if 'IOR'in p.inputs:p.inputs['IOR'].default_value=1.45
 m.diffuse_color=(*color,alpha)
 if alpha<1 and hasattr(m,'surface_render_method'):m.surface_render_method='DITHERED'
 m['design_status']='Illustrative proposed finish, not a specification'
 return m

def scene_setup(s):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for c in list(bpy.data.collections):bpy.data.collections.remove(c)
 sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=1
 sc.name=s['id'];root=bpy.data.collections.new('ANDHERI_'+s['id']);sc.collection.children.link(root);C={}
 for k in ['Structure','Partitions','Glazing','GlassFrames','Doors','Furniture','Room_finishes','Ceiling_REVIEW','CAD_source_REVIEW','Cameras_Lights','WEB_EXPORT']:
  c=bpy.data.collections.new(k);root.children.link(c);C[k]=c
 C['CAD_source_REVIEW'].hide_render=True;C['CAD_source_REVIEW'].hide_viewport=True
 C['Ceiling_REVIEW'].hide_render=True;C['Ceiling_REVIEW'].hide_viewport=True
 M={
 'wall':material('Paint_Warm_White',(.83,.82,.77),.73),
 'column':material('Structure_Off_White',(.65,.66,.63),.76),
 'oak':material('Proposed_Light_Oak',(.55,.37,.21),.43),
 'desktop':material('Proposed_White_Desk',(.86,.87,.84),.40),
 'metal':material('Graphite_Metal',(.07,.085,.09),.36,.65),
 'chair':material('Black_Woven_Task_Chair',(.035,.045,.05),.86),
 'screen':material('Display_Glass',(.035,.095,.12),.27,.15),
 'sage':material('Sage_Acoustic_Screen',(.21,.35,.27),.87),
 'glass':material('Clear_Blue_Glass',(.58,.77,.81),.12,.05,.23,.35),
 'floor':material('Neutral_Floor',(.60,.59,.55),.84),
 'carpet':material('Proposed_Carpet',(.31,.34,.33),.92),
 'roomfloor':material('Proposed_Oak_Room_Floor',(.58,.45,.30),.66),
 'ceiling':material('Proposed_T_Grid_Ceiling',(.89,.89,.85),.81),
 'light':material('Linear_Light_Diffuser',(.94,.94,.90),.35),
 'trace':material('CAD_Source_Trace',(.11,.15,.17),.8),
 'plant':material('Foliage_Green',(.055,.17,.075),.78),
 'pot':material('Matte_Planter',(.38,.34,.28),.83),
 }
 return sc,C,M

def mesh_obj(name,verts,faces,collection,mat=None,role=None,ids=(),bevel=0):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);collection.objects.link(o)
 if mat:me.materials.append(mat)
 if role:o['role']=role
 if ids:o['cad_ids']=J(list(ids))
 if bevel:
  mod=o.modifiers.new('Presentation_edge_softening','BEVEL');mod.width=bevel;mod.segments=2
  mod.affect='EDGES'
 return o

def prism(name,g,z0,z1,collection,mat,role,ids=(),bevel=0):
 vv=[tuple(p)for p in g['cap_vertices']];ii={p:i for i,p in enumerate(vv)};n=len(vv)
 verts=[(x,y,z0)for x,y in vv]+[(x,y,z1)for x,y in vv]
 faces=[]
 for t in g['cap_triangles']:
  x0,y0=vv[t[0]];x1,y1=vv[t[1]];x2,y2=vv[t[2]]
  tri=tuple(t)if(x1-x0)*(y2-y0)-(y1-y0)*(x2-x0)>0 else tuple(reversed(t))
  faces.extend([tuple(reversed(tri)),tuple(i+n for i in tri)])
 for ring in [g['outer']]+g['holes']:
  for j,p in enumerate(ring):
   q=ring[(j+1)%len(ring)];ia=ii[tuple(p)];ib=ii[tuple(q)];faces.append((ia,ib,ib+n,ia+n))
 return mesh_obj(name,verts,faces,collection,mat,role,ids,bevel)

BOXES={}
def box(name,loc,size,collection,mat,role,ids=(),yaw=0,bevel=0):
 key=tuple(size)
 if key not in BOXES:
  x,y,z=(v/2 for v in size);me=bpy.data.meshes.new('BoxTemplate')
  me.from_pydata([(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);me.update();BOXES[key]=me
 me=BOXES[key].copy();me.materials.append(mat);o=bpy.data.objects.new(name,me);collection.objects.link(o);o.location=loc;o.rotation_euler[2]=yaw;o['role']=role
 if ids:o['cad_ids']=J(list(ids))
 if bevel:
  mod=o.modifiers.new('Presentation_edge_softening','BEVEL');mod.width=bevel;mod.segments=2
 return o

def local_pt(cx,cy,x,y,yaw,z):return(cx+x*math.cos(yaw)-y*math.sin(yaw),cy+x*math.sin(yaw)+y*math.cos(yaw),z)

def camera(name,loc,target,collection,lens=40,ortho=None):
 d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.lens=lens;d.clip_end=2000
 if ortho:d.type='ORTHO';d.ortho_scale=ortho
 return o

def light(name,loc,target,power,size,collection,color=(1,.94,.84)):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o


def build(s,out):
 started=time.monotonic();sc,C,M=scene_setup(s);H=s['ceiling_height_m'];w,h=s['bounds_m'][2:];x0,y0=0,0;cx,cy=w/2,h/2
 stat={'id':s['id'],'site':s['site'],'source':s['source'],'deck_clear_height_m':H,'height_source':s['ceiling_height_source'],'assumptions':s['vertical_assumptions'],'cad_xy_tolerance_m':.001,'workstations':len(s['desks']),'task_chairs':len(s.get('task_chairs',[])),'roles':{},'source_items':[]}
 floor=box('ASSUMED_Presentation_Floor_Support',(cx,cy,-.08),(w,h,.16),C['Structure'],M['floor'],'FloorSupport');floor['assumption']='Rectangular display support, NOT surveyed slab geometry'
 # Preserved wall/column footprints; source handles remain on editable objects.
 for i,g in enumerate(s['prepared']):
  role=g['role'];target='Structure'if role=='Columns'else role if role in C else'Partitions'
  if role=='Source_hidden_review':target='CAD_source_REVIEW'
  mat=M['column']if role=='Columns'else M['glass']if role=='Glazing'else M['metal']if role=='GlassFrames'else M['oak']if role=='Doors'else M['wall']
  if g.get('glass_door'):mat=M['glass']
  o=prism(f'{role}_{i:04}',g,0,g['height_m'],C[target],mat,role,g['cad_ids'],.003 if role not in['Glazing','GlassFrames'] else 0)
  o['source_geometry']=g['source'];o['cad_xy_verified']=True;o['height_status']='Assumed vertical extrusion; designer review required';o['height_m']=g['height_m']
  stat['source_items'].append({'object':o.name,'role':role,'cad_ids':g['cad_ids'],'source':g['source'],'bounds_m':g['bounds_m']})
  # Glazing head/sill members stay within each original pane footprint.
  if role=='Glazing'and g['area_m2']>.015:
   for z in [.025,H-.025]:prism(f'FrameCap_{i}_{z:g}',g,z-.018,z+.018,C['GlassFrames'],M['metal'],'GlassFrames',g['cad_ids'])
 # Finishes are optional overlays of verified CAD room enclosures, not replacement geometry.
 for room in s['rooms']:
  if room.get('floor_geometry'):
   mat=M['roomfloor']if room.get('group')in['Cafeteria','Reception','Breakout']else M['carpet']
   o=prism('Finish_'+room['id'],room['floor_geometry'],.002,.009,C['Room_finishes'],mat,'RoomFinish',[room['source_handle']]);o['assumption']='Presentation finish only; CAD enclosure preserved'
  e=bpy.data.objects.new('RoomAnchor_'+room['id'],None);C['CAD_source_REVIEW'].objects.link(e);e.location=(*room['label'],1.1);e['cad_id']=room['source_handle'];e['room_name']=room['name'];e['room_data']=J(room)
 # Build source workstation desktops and exact task-chair centres.
 chair_by_parent={q['parent_workstation_id']:q for q in s.get('task_chairs',[])if q.get('parent_workstation_id')is not None}
 table_by_parent={d['source_insert_id']:d for d in s['desks']}
 for i,d in enumerate(s['desks']):
  ids=[d['source_handle'],d['desktop_source_handle']];g=d['geometry'];tx,ty=d['desktop_center_m'];q=chair_by_parent.get(d['source_insert_id']);vx,vy=(tx-q['center_m'][0],ty-q['center_m'][1])if q else(0,1);yaw=math.atan2(-vx,vy)
  top=prism(f'Desk_{i:04}_{d["source_handle"]}',g,.71,.74,C['Furniture'],M['desktop'],'Desktops',ids,.005);top['cad_xy_verified']=True;top['source_insert_id']=d['source_insert_id'];top['source_block']=d['block_name']
  # Leg and privacy-screen designs are illustrative assets; desktop stays exact.
  for j,p in enumerate(g['outer'][:4]):
   px=tx+(p[0]-tx)*.80;py=ty+(p[1]-ty)*.72
   box(f'DeskLeg_{i}_{j}',(px,py,.355),(.026,.026,.71),C['Furniture'],M['metal'],'DeskLegs',ids,bevel=.003)
  # Screen faces the exact source chair, set back into the desktop.
  mx,my,mz=local_pt(tx,ty,0,.10,yaw,.96)
  box(f'Monitor_{i}',(mx,my,mz),(.38,.035,.235),C['Furniture'],M['metal'],'Screens',ids,yaw,.009)
  box(f'MonitorPanel_{i}',local_pt(tx,ty,0,.080,yaw,.96),(.348,.004,.204),C['Furniture'],M['screen'],'ScreenGlass',ids,yaw)
  box(f'MonitorStem_{i}',local_pt(tx,ty,0,.10,yaw,.795),(.035,.035,.11),C['Furniture'],M['metal'],'Screens',ids,yaw)
  box(f'MonitorFoot_{i}',local_pt(tx,ty,0,.10,yaw,.749),(.16,.12,.018),C['Furniture'],M['metal'],'Screens',ids,yaw,.005)
  if s['site']=='corporate-avenue':
   box(f'SageScreen_{i}',local_pt(tx,ty,0,.235,yaw,.895),(.87,.023,.31),C['Furniture'],M['sage'],'PrivacyScreens',ids,yaw,.006)
 # Chair meshes share one module's geometry; placement follows CAD rather than a generated grid.
 chair_v=[];chair_f=[];chair_m=[]
 def cb(loc,sz,mi):
  x,y,z=loc;dx,dy,dz=(v/2 for v in sz);off=len(chair_v);chair_v.extend([(x-dx,y-dy,z-dz),(x+dx,y-dy,z-dz),(x+dx,y+dy,z-dz),(x-dx,y+dy,z-dz),(x-dx,y-dy,z+dz),(x+dx,y-dy,z+dz),(x+dx,y+dy,z+dz),(x-dx,y+dy,z+dz)])
  chair_f.extend([tuple(k+off for k in f)for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]]);chair_m.extend([mi]*6)
 cb((0,0,.46),(.43,.43,.075),0);cb((0,-.21,.755),(.43,.055,.50),0);cb((0,0,.25),(.055,.055,.37),1)
 for side in [-1,1]:cb((side*.24,0,.63),(.035,.33,.045),1);cb((side*.225,-.08,.545),(.022,.025,.16),1)
 cb((0,0,.075),(.53,.06,.055),1);cb((0,0,.075),(.06,.53,.055),1)
 for x,y in [(-.24,0),(.24,0),(0,-.24),(0,.24)]:cb((x,y,.0275),(.07,.07,.055),1)
 cm=bpy.data.meshes.new('TaskChair_Illustrative_Module');cm.from_pydata(chair_v,[],chair_f);cm.materials.append(M['chair']);cm.materials.append(M['metal']);cm.update()
 for p,mi in zip(cm.polygons,chair_m):p.material_index=mi
 for i,q in enumerate(s.get('task_chairs',[])):
  o=bpy.data.objects.new(f'Chair_{i:04}_{q["source_insert_id"]}',cm);C['Furniture'].objects.link(o);o.location=(*q['center_m'],0)
  d=table_by_parent.get(q.get('parent_workstation_id'))
  if d:
   vx=d['desktop_center_m'][0]-q['center_m'][0];vy=d['desktop_center_m'][1]-q['center_m'][1];o.rotation_euler[2]=math.atan2(-vx,vy)
  else:o.rotation_euler[2]=math.radians(q['rotation_deg']+180)
  o['role']='TaskChairs';o['cad_ids']=J([q['source_handle']]);o['source_insert_id']=q['source_insert_id'];o['parent_workstation_id']=q.get('parent_workstation_id')or-1;o['placement_source']='Exact CAD task chair centre';o['design_status']='Illustrative generic chair, not a specified product'
 # Other furnishings are positioned from identified original CAD blocks/outlines.
 extra=s.get('extra_furniture',{'chairs':[],'surfaces':[],'plants':[],'screens':[]})
 stat['additional_CAD_furniture']={k:len(extra.get(k,[]))for k in ['chairs','surfaces','plants','screens']}
 stat['additional_furniture_note']='CAD positions/desktop outlines retained; generic asset designs, heights and finishes are review assumptions. Not added to workstation totals.'
 for i,q in enumerate(extra.get('surfaces',[])):
  if not q.get('geometry'):continue
  ids=q.get('source_handles')or[q.get('source_handle')];g=q['geometry'];z=.46 if q['shape']=='round'else .74
  ob=prism(f'CAD_Extra_Table_{i}',g,z-.035,z,C['Furniture'],M['oak'],'AdditionalTables',ids,.004);ob['assumption']='Original CAD furniture surface, illustrative tabletop/counter height';ob['geometry_source']=q.get('source_layer',q.get('source_block','CAD'))
  tx,ty=q['center_m'];b=g['bounds_m'];ww=b[2]-b[0];dd=b[3]-b[1]
  for j,(x,y)in enumerate([(b[0]+ww*.15,b[1]+dd*.15),(b[2]-ww*.15,b[1]+dd*.15),(b[2]-ww*.15,b[3]-dd*.15),(b[0]+ww*.15,b[3]-dd*.15)]):
   box(f'Extra_Table_Leg_{i}_{j}',(x,y,(z-.035)/2),(.035,.035,z-.035),C['Furniture'],M['metal'],'AdditionalTableLegs',ids)
 # A lighter visitor/dining chair module, without adding any new chair locations.
 chair_v=[];chair_f=[];chair_m=[]
 cb((0,0,.46),(.43,.43,.07),0);cb((0,-.215,.715),(.43,.045,.44),0)
 for x,y in [(-.17,-.17),(.17,-.17),(-.17,.17),(.17,.17)]:cb((x,y,.215),(.026,.026,.43),1)
 vm=bpy.data.meshes.new('VisitorChair_Illustrative_Module');vm.from_pydata(chair_v,[],chair_f);vm.materials.append(M['chair']);vm.materials.append(M['metal']);vm.update()
 for pp,mi in zip(vm.polygons,chair_m):pp.material_index=mi
 for i,q in enumerate(extra.get('chairs',[])):
  ob=bpy.data.objects.new(f'CAD_Visitor_Chair_{i}_{q["source_insert_id"]}',vm);C['Furniture'].objects.link(ob);ob.location=(*q['center_m'],0);ob.rotation_euler[2]=q.get('presentation_yaw',math.radians(q['rotation_deg']+180))
  ob['role']='VisitorChairs';ob['cad_ids']=J([q['source_handle']]);ob['source_insert_id']=q['source_insert_id'];ob['source_block']=q['source_block'];ob['geometry_source']='CAD block descendant footprint centre';ob['design_status']='Illustrative generic chair, not a specified product'
 for i,q in enumerate(extra.get('screens',[])):
  b=q['bounds_m'];w0=b[2]-b[0];h0=b[3]-b[1];ob=box(f'CAD_Wall_Display_{i}',(*q['center_m'],1.65),(max(w0,.035),max(h0,.035),.631),C['Furniture'],M['screen'],'MountedDisplays',[q['source_handle']],bevel=.006);ob['assumption']='Source TV footprint; mounting elevation assumed'
 for i,q in enumerate(extra.get('plants',[])):
  cx0,cy0=q['center_m'];ids=[q['source_handle']];rad=min(q['bounds_m'][2]-q['bounds_m'][0],q['bounds_m'][3]-q['bounds_m'][1])*.36
  n=12;vv=[(cx0+rad*math.cos(j*math.tau/n),cy0+rad*math.sin(j*math.tau/n),z)for z in [.015,.40]for j in range(n)];ff=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n)for j in range(n)]
  mesh_obj(f'CAD_Planter_{i}',vv,ff,C['Furniture'],M['pot'],'Planters',ids)
  vv=[];ff=[]
  for k in range(9):
   angle=k*2.39996;rr=rad*(.75+(k%3)*.17);top=.88+(k%4)*.10;ux,uy=math.cos(angle),math.sin(angle);sx,sy=-uy*rad*.22,ux*rad*.22;off=len(vv)
   vv.extend([(cx0,cy0,.39),(cx0+ux*rr*.55+sx,cy0+uy*rr*.55+sy,top-.13),(cx0+ux*rr,cy0+uy*rr,top),(cx0+ux*rr*.55-sx,cy0+uy*rr*.55-sy,top-.13)]);ff.extend([(off,off+1,off+2),(off,off+2,off+3)])
  mesh_obj(f'CAD_Plant_{i}',vv,ff,C['Furniture'],M['plant'],'Plants',ids)
 # Independent ceiling collection is deliberately removable for designer review.
 box('ASSUMED_Removable_Ceiling',(cx,cy,H+.025),(w,h,.05),C['Ceiling_REVIEW'],M['ceiling'],'Ceiling')
 for x in range(1,int(w/.6)):
  box(f'CeilingGridX_{x}',(x*.6,cy,H-.006),(.018,h,.012),C['Ceiling_REVIEW'],M['wall'],'CeilingGrid')
 for y in range(1,int(h/.6)):
  box(f'CeilingGridY_{y}',(cx,y*.6,H-.006),(w,.018,.012),C['Ceiling_REVIEW'],M['wall'],'CeilingGrid')
 # CAD linework is retained as a hidden source layer for edit/review alignment.
 for kind in ['walls','glass','doors']:
  cv=bpy.data.curves.new('CAD_'+kind,'CURVE');cv.dimensions='3D';cv.bevel_depth=.0015;cv.bevel_resolution=0
  for r in s['architecture']:
   if r['kind']!=kind:continue
   pp=r['points_m'];sp=cv.splines.new('POLY');sp.points.add(len(pp)-1)
   for q,p in zip(sp.points,pp):q.co=(*p,.012,1)
  o=bpy.data.objects.new('CAD_Source_'+kind,cv);C['CAD_source_REVIEW'].objects.link(o);o['source']='Unchanged source planar linework';o.data.materials.append(M['trace'])
 # Matched lighting/camera setup, independent of option density.
 world=bpy.data.worlds.new('Neutral_Daylight_World');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.70,.77,.82,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6;sc.world=world
 sun=bpy.data.objects.new('Daylight_Sun',bpy.data.lights.new('Daylight_Sun','SUN'));C['Cameras_Lights'].objects.link(sun);sun.data.energy=2.2;sun.data.angle=math.radians(18);sun.rotation_euler=(math.radians(24),math.radians(-30),math.radians(-35))
 light('Large_Soft_Daylight',(cx-w*.3,cy-h*.3,24),(cx,cy,0),3500,max(w,h)*.8,C['Cameras_Lights'])
 light('Soft_Fill',(cx+w*.3,cy+h*.2,18),(cx,cy,0),2000,max(w,h)*.65,C['Cameras_Lights'],(.83,.90,1))
 cam=camera('CAM_Matched_Axon',(cx-w*.63,cy-h*.82,max(w,h)*.87),(cx,cy,.6),C['Cameras_Lights'],ortho=max(w,h)*1.18);sc.camera=cam
 sc.render.engine='CYCLES';sc.cycles.samples=20;sc.cycles.use_denoising=True;sc.render.resolution_x=1600;sc.render.resolution_y=1100;sc.render.resolution_percentage=100
 sc.render.image_settings.file_format='PNG';sc.render.film_transparent=False
 try:sc.view_settings.view_transform='AgX'
 except:pass
 sc['source_drawing']=s['source']['file'];sc['source_sha256']=s['source']['sha256'];sc['source_origin_m']=J(s['source']['origin_m']);sc['source_scope']='Proposed fit-out, not as-built';sc['assumptions']=J(s['vertical_assumptions']);sc['CAD_XY_unchanged']=True
 expected_desks={d['source_insert_id']:d['geometry']['bounds_m']for d in s['desks']};bounds_errors=[]
 for o in sc.objects:
  if o.type=='MESH'and o.get('role')=='Desktops':
   pts=[o.matrix_world@v.co for v in o.data.vertices];actual=[min(p.x for p in pts),min(p.y for p in pts),max(p.x for p in pts),max(p.y for p in pts)];expected=expected_desks[o['source_insert_id']];bounds_errors.append(max(abs(x-y)for x,y in zip(actual,expected)))
 for o in sc.objects:
  if o.type=='MESH'and o.get('cad_xy_verified'):
   assert all(math.isfinite(v)for p in o.data.vertices for v in p.co),o.name
 stat['alignment_audit']={'cad_xy_verified_objects':sum(bool(o.get('cad_xy_verified'))for o in sc.objects),'desktop_count':len(s['desks']),'source_floor_origin_m':s['source']['origin_m'],'max_desktop_xy_error_m':max(bounds_errors,default=0.0),'wall_footprint_tolerance_m':.001,'holes_preserved':sum(len(g['holes'])for g in s['prepared'])}
 stat['editable_objects']=sum(o.type=='MESH'for o in sc.objects)
 for o in sc.objects:
  if o.type=='MESH':stat['roles'][o.get('role','Other')]=stat['roles'].get(o.get('role','Other'),0)+1
 out.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(out/'interior.blend'))
 # Export compact, material-merged web assets; original editable objects remain in .blend.
 export_web(sc,C,M,out,stat)
 stat['build_seconds']=round(time.monotonic()-started,2)
 (out/'audit.json').write_text(json.dumps(stat,indent=2))
 if a.render and s['id']in['corporate-266-plan1','privilon-260-plan1']:
  render_proofs(s,sc,C,out,stat)
 print('INTERIOR_DONE',s['id'],stat['editable_objects'],stat.get('web_bytes'),round(time.monotonic()-started,1),flush=True)
 return stat


def export_web(sc,C,M,out,stat):
 original=[o for o in sc.objects if o.type=='MESH'and o.users_collection and o.users_collection[0]not in[C['CAD_source_REVIEW'],C['WEB_EXPORT']]]
 original=[o for o in original if o.users_collection[0]!=C['Ceiling_REVIEW']]
 bevel_state=[]
 for o in original:
  for mod in o.modifiers:
   if mod.type=='BEVEL':bevel_state.append((mod,mod.show_viewport))
 bpy.context.view_layer.update()
 deps=bpy.context.evaluated_depsgraph_get();grouped={};audit=[]
 for o in original:
  eo=o.evaluated_get(deps);me=eo.to_mesh();role=o.get('role','Other')
  by=collections.defaultdict(list)
  for p in me.polygons:by[p.material_index].append(p)
  for mi,pp in by.items():
   mat=me.materials[mi]if mi<len(me.materials)else M['wall'];key=(role,mat.name);g=grouped.setdefault(key,{'v':[],'f':[],'ids':set(),'mat':mat});remap={};start=len(g['v'])
   for p in pp:
    face=[]
    for vi in p.vertices:
     if vi not in remap:remap[vi]=len(g['v']);g['v'].append(tuple(o.matrix_world@me.vertices[vi].co))
     face.append(remap[vi])
    g['f'].append(tuple(face))
   ids=json.loads(o.get('cad_ids','[]'));g['ids'].update(ids)
   audit.append({'source_object':o.name,'role':role,'material':mat.name,'cad_ids':ids,'merged_vertex_start':start,'merged_vertex_count':len(g['v'])-start})
  eo.to_mesh_clear()
 for mod,state in bevel_state:mod.show_viewport=state
 bpy.context.view_layer.update()
 stat['web_optimization']='All existing Blender bevels retained; role/material merging only. Native Float32 without lossy compression.'
 bpy.ops.object.select_all(action='DESELECT');made=[]
 for i,((role,name),g)in enumerate(grouped.items()):
  ob=mesh_obj('WEB_'+role+'_'+str(i),g['v'],g['f'],C['WEB_EXPORT'],g['mat'],role,sorted(g['ids']));ob['source_audit']='audit.json';ob.select_set(True);made.append(ob)
 bpy.ops.export_scene.gltf(filepath=str(out/'interior-new.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_cameras=False,export_lights=False,export_extras=True)
 (out/'interior-new.glb').replace(out/'interior.glb')
 stat['web_draw_meshes']=len(made);stat['web_bytes']=(out/'interior.glb').stat().st_size;stat['web_source_parts']=audit
 for o in made:bpy.data.objects.remove(o,do_unlink=True)
 # Separate removable ceiling asset; two simple PBR meshes, loaded only on demand.
 cg={}
 for o in C['Ceiling_REVIEW'].objects:
  if o.type!='MESH':continue
  mat=o.data.materials[0];key=mat.name;g=cg.setdefault(key,{'v':[],'f':[],'mat':mat});off=len(g['v'])
  assert o.parent is None,'Ceiling object unexpectedly parented'
  # Hidden review objects do not have evaluated matrix_world; bake the source transforms explicitly.
  transform=Matrix.LocRotScale(o.location,o.rotation_euler.to_quaternion(),o.scale)
  g['v'].extend(tuple(transform@v.co)for v in o.data.vertices);g['f'].extend(tuple(vi+off for vi in p.vertices)for p in o.data.polygons)
 bpy.ops.object.select_all(action='DESELECT');made=[]
 for i,g in enumerate(cg.values()):
  ob=mesh_obj('WEB_Removable_Ceiling_'+str(i),g['v'],g['f'],C['WEB_EXPORT'],g['mat'],'Ceiling');ob['design_status']='Assumed T-grid; designer review required';ob.select_set(True);made.append(ob)
 bpy.ops.export_scene.gltf(filepath=str(out/'ceiling-new.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_cameras=False,export_lights=False,export_extras=True)
 (out/'ceiling-new.glb').replace(out/'ceiling.glb');stat['ceiling_web_bytes']=(out/'ceiling.glb').stat().st_size
 for o in made:bpy.data.objects.remove(o,do_unlink=True)


def render_proofs(s,sc,C,out,stat):
 # Render cutaway only; master .blend is already saved with full-height geometry.
 sc.render.engine='CYCLES';sc.cycles.samples=12;sc.cycles.use_denoising=True
 sc.render.resolution_x=1600;sc.render.resolution_y=1100
 sc.render.resolution_percentage=100
 scaled=[]
 for collection in ['Partitions','Glazing','GlassFrames','Doors','Structure']:
  for o in C[collection].objects:
   if o.type=='MESH'and o.get('role')!='FloorSupport':scaled.append((o,o.scale.z));o.scale.z=.42
 bpy.context.view_layer.update();cam=sc.camera
 b=s['bounds_m'];H=s['ceiling_height_m'];points=[cam.matrix_world.inverted()@Vector((x,y,z))for x in [b[0],b[2]]for y in [b[1],b[3]]for z in [0,H*.42]]
 width=max(p.x for p in points)-min(p.x for p in points);height=max(p.y for p in points)-min(p.y for p in points)
 cam.data.ortho_scale=max(width,height*(1600/1100))*1.08
 sc.render.filepath=str(out/'daylight-cutaway.png');bpy.ops.render.render(write_still=True)
 stat['cutaway_note']='Render-only wall/glazing height cutaway; editable master retains full deck height.'
 for o,z in scaled:o.scale.z=z
 room=max((r for r in s['rooms']if r.get('floor_geometry')and r.get('group')in['Training & conference','Meeting room']),key=lambda r:r['floor_geometry']['area_m2'],default=None)
 if room and not a.cutaway_only:
  b=room['floor_geometry']['bounds_m'];cx=(b[0]+b[2])/2;cy=(b[1]+b[3])/2
  sc.camera=camera('CAM_Selected_Room_Proof',(b[0]+.48,b[1]+.48,1.62),(cx,cy+.35,1.1),C['Cameras_Lights'],lens=16)
  C['Ceiling_REVIEW'].hide_render=False
  light('Room_Proof_Ceiling_Light',(cx,cy,H-.14),(cx,cy,0),220,max(b[2]-b[0],b[3]-b[1])*.7,C['Cameras_Lights'],(1,.96,.90))
  sc.render.resolution_x=1400;sc.render.resolution_y=1000;sc.render.filepath=str(out/'room-detail.png');bpy.ops.render.render(write_still=True)
  stat['room_proof']={'room':room['name'],'source_handle':room['source_handle'],'note':'Source-positioned furniture, illustrative finishes/vertical dimensions/ceiling, proposed fit-out.'}
  C['Ceiling_REVIEW'].hide_render=True
 (out/'audit.json').write_text(json.dumps(stat,indent=2))

all_stats=[]
for f in sorted(Path(a.input).glob('*-3d.json')):
 s=json.loads(f.read_text())
 if a.id and s['id']not in a.id.split(','):continue
 if a.render_only:
  out=OUT/s['id'];bpy.ops.wm.open_mainfile(filepath=str(out/'interior.blend'));sc=bpy.context.scene;C={k:bpy.data.collections[k]for k in ['Structure','Partitions','Glazing','GlassFrames','Doors','Furniture','Room_finishes','Ceiling_REVIEW','CAD_source_REVIEW','Cameras_Lights','WEB_EXPORT']};stat=json.loads((out/'audit.json').read_text());render_proofs(s,sc,C,out,stat);all_stats.append(stat)
 else:all_stats.append(build(s,OUT/s['id']))
if not a.render_only and not a.id:(OUT/'manifest.json').write_text(json.dumps({'models':[{'id':x['id'],'workstations':x['workstations'],'editable_objects':x['editable_objects'],'web_bytes':x['web_bytes'],'web_draw_meshes':x['web_draw_meshes']}for x in all_stats]},indent=2))
