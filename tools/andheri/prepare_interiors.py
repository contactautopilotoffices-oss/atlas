"""Prepare exact CAD XY polygons for Blender (no source drawing changes)."""
import argparse,json,math,re
from pathlib import Path
from shapely.geometry import Polygon,LineString,Point,box
from shapely.ops import unary_union,triangulate,nearest_points
from shapely.geometry.polygon import orient
import shapely
P=argparse.ArgumentParser();P.add_argument('--input',required=True);P.add_argument('--output',required=True);P.add_argument('--extras',required=True,help='Directory containing <plan-id>-furniture.json');a=P.parse_args()
OUT=Path(a.output);OUT.mkdir(parents=True,exist_ok=True)
def polys(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for x in getattr(g,'geoms',[]) for p in polys(x)]
def valid(p):
 if not p.is_valid:p=shapely.make_valid(p)
 return p

def geom(p):
 p=orient(p,1)
 try:ts=shapely.constrained_delaunay_triangles(p)
 except AttributeError:ts=triangulate(p)
 triangles=[t for t in (ts.geoms if hasattr(ts,'geoms') else ts) if p.covers(t)]
 area=sum(t.area for t in triangles)
 assert abs(area-p.area)<max(1e-6,p.area*1e-5),(area,p.area)
 vv=[];ii={};ff=[]
 for t in triangles:
  face=[]
  for q in list(t.exterior.coords)[:3]:
   q=tuple(q)
   if q not in ii:ii[q]=len(vv);vv.append(q)
   face.append(ii[q])
  ff.append(face)
 return {'outer':list(p.exterior.coords)[:-1],'holes':[list(x.coords)[:-1]for x in p.interiors],
         'cap_vertices':vv,'cap_triangles':ff,'area_m2':p.area,'bounds_m':list(p.bounds)}

def ids_for(p,source):
 ids=set()
 for r,q in source:
  if p.intersects(q) and p.intersection(q).area>1e-8:
   ids.add(str(r.get('handle') or r.get('source_handle') or 'wall-edge-face'))
 return sorted(ids)

def roompoly(d):
 rings=[]
 for r in re.findall(r'M([^M]+)',d or ''):
  q=list(map(float,re.findall(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',r)))
  if len(q)>=6:rings.append([(q[i],-q[i+1])for i in range(0,len(q),2)])
 return valid(Polygon(rings[0],rings[1:]))if rings else None
for f in sorted(Path(a.input).glob('*-semantic.json')):
 s=json.loads(f.read_text());site='corporate-avenue'if s['id'].startswith('corporate')else'privilon';H=3.3528 if site=='corporate-avenue'else 3.56616
 result={**s,'site':site,'ceiling_height_m':H,'ceiling_height_source':'Property inventory deck: 11 ft'if site=='corporate-avenue'else'Property inventory deck: 11.7 ft','vertical_assumptions':{'partition_top':'Assumed to ceiling, because source DWG has no verified elevations','door_head_m':2.10,'desktop_top_m':.74,'desk_thickness_m':.03,'chair_design':'Generic presentation furniture with exact source placement/footprints','ceiling':'Review-only removable assumed T-grid panel; actual ceiling design not supplied','finishes':'Illustrative white/oak/sage palette, not specifications','floor_support':'Assumed rectangular presentation support, not a verified slab boundary'},'prepared':[]}
 groups={};source=[];doorhandles={str(r.get('handle'))for r in s['architecture']if r['kind']=='doors'}
 for i,r in enumerate(s.get('architecture_polygons',[])):
  p=valid(Polygon(r['points_m'],r.get('holes_m',[])))
  role='Columns'if r['kind']=='columns'else'Partitions'
  if r.get('cad_layer_visible')is False:role='Source_hidden_review'
  for q in polys(p):
   if q.area<1e-5:continue
   # Small CAD door-jamb cross-sections stop at assumed door head, not ceiling.
   h=2.1 if str(r.get('handle'))in doorhandles and q.area<.04 else H
   groups.setdefault((role,h),[]).append((r,q));source.append((r,q))
 for (role,h),rs in groups.items():
  union=unary_union([q for r,q in rs])
  for i,p in enumerate(polys(union)):
   if p.area<1e-5:continue
   result['prepared'].append({'role':role,'height_m':h,'cad_ids':ids_for(p,rs),'source':'Union/deduplication of original CAD wall/column regions',**geom(p)})
 # Trace polygonized wall regions back to their original contributing CAD edges.
 for g in result['prepared']:
  if 'wall-edge-face' not in g['cad_ids']:continue
  boundary=Polygon(g['outer'],g['holes']).boundary.buffer(.002)
  traced=set()
  for r in s['architecture']:
   if r['kind']=='walls'and 'STAIR'not in r['layer'].upper()and r.get('handle')and len(r['points_m'])>1 and LineString(r['points_m']).intersects(boundary):traced.add(str(r['handle']))
  g['cad_ids']=sorted(traced)or g['cad_ids']
 # Keep glass profiles/panes and open-door leaf geometry separate from solid walls.
 for kind,role in [('glass','Glazing'),('doors','Doors')]:
  rr=[]
  for r in s['architecture']:
   if r['kind']!=kind or not r['closed']or len(r['points_m'])<4:continue
   for p in polys(valid(Polygon(r['points_m']))):
    if p.area<.0001:continue
    b=p.minimum_rotated_rectangle;pts=list(b.exterior.coords);lengths=sorted(math.dist(pts[i],pts[i+1])for i in range(4));short,long=lengths[0],lengths[-1]
    # Door swing arcs are never converted to solid leaves. Only slim closed CAD leaf profiles.
    if kind=='doors'and not(.42<long<1.8 and .002<short<.085):continue
    if kind=='glass'and not(.001<short<.26 and long<15):continue
    rr.append((r,p))
  # Duplicate the identical outline only once; preserve all contributing IDs.
  seen={}
  for r,p in rr:
   key=shapely.normalize(p).wkb
   if key not in seen:seen[key]=(r,p,[])
   seen[key][2].append(str(r.get('handle')or''))
  for r,p,ids in seen.values():
   role0=role
   if kind=='glass'and max(p.bounds[2]-p.bounds[0],p.bounds[3]-p.bounds[1])<.25:role0='GlassFrames'
   result['prepared'].append({'role':role0,'height_m':H if kind=='glass' else 2.1,'cad_ids':sorted(set(ids)),
      'source_layer':r['layer'],'source':'Closed original CAD '+kind+' footprint','glass_door':kind=='doors'and'GLAZ'in r['layer'].upper(),**geom(p)})
 # Desktop faces are taken from their direct child CAD polylines, not desk+chair bounding boxes.
 for d in result['desks']:
  assert d.get('desktop_polygon_m'),(s['id'],d['source_handle'])
  d['geometry']=geom(Polygon(d['desktop_polygon_m']))
 for r in result['rooms']:
  if r.get('outline_verified')and r.get('d'):
   p=roompoly(r['d'])
   if p and p.geom_type=='Polygon'and p.area>.8:r['floor_geometry']=geom(p)
 extrasfile=Path(a.extras)/(s['id']+'-furniture.json')
 if extrasfile.exists():
  extra=json.loads(extrasfile.read_text())
  for item in extra['surfaces']:
   if item['shape']=='round':
    b=item['bounds_m'];cx=(b[0]+b[2])/2;cy=(b[1]+b[3])/2;rx=(b[2]-b[0])/2;ry=(b[3]-b[1])/2
    poly=Polygon([(cx+rx*math.cos(i*math.tau/40),cy+ry*math.sin(i*math.tau/40))for i in range(40)])
   else:poly=Polygon(item['polygon_m'],item.get('holes_m',[]))
   if poly.is_valid:item['geometry']=geom(poly)
  for c in extra['chairs']:
   q=Point(c['center_m']);near=[]
   for item in extra['surfaces']:
    if not item.get('geometry'):continue
    poly=Polygon(item['geometry']['outer'],item['geometry']['holes'])
    distance=poly.distance(q)
    if .02<distance<2.5:near.append((distance,poly))
   if near:
    target=nearest_points(q,min(near,key=lambda x:x[0])[1])[1];dx=target.x-q.x;dy=target.y-q.y;c['presentation_yaw']=math.atan2(-dx,dy)
   else:c['presentation_yaw']=math.radians(c['rotation_deg'])+{'rter':0,'A$C95ba7abc':math.pi,'A$C445ca927':-math.pi/2,'A$C1e46f5fe':0}.get(c['source_block'],0)
  result['extra_furniture']=extra
 result['geometry_audit']={'desk_count':len(s['desks']),'task_chair_count':len(s.get('task_chairs',[])),
   'wall_column_union_area_m2':sum(x['area_m2']for x in result['prepared']if x['role']in['Partitions','Columns']),
   'cad_trace_count':len(s['architecture']),'objects_prepared':len(result['prepared']),
   'xy_tolerance_m':.001,'note':'XY footprints retained from CAD. Heights, ceilings, generic furniture and finishes require designer review.'}
 (OUT/(s['id']+'-3d.json')).write_text(json.dumps(result,separators=(',',':')))
 print(s['id'],result['geometry_audit'],flush=True)
