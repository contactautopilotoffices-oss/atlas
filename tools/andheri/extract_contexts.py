"""Extract the three agreed property contexts from the USER'S local Geofabrik PBF.
No network, no node-only polygon clipping. Native libosmium's two-pass area
assembler resolves whole multipolygons using a disk-backed sparse location index.
Use: python extract_contexts.py --source /path/to/western-zone.osm.pbf --output /path/to/contexts
"""
import argparse,collections,datetime,hashlib,json,math,pathlib,time
import osmium
from shapely.geometry import LineString,Polygon,box
parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True,type=pathlib.Path)
parser.add_argument('--output',required=True,type=pathlib.Path)
parser.add_argument('--radius',type=float,default=600)
args=parser.parse_args()
SOURCE=args.source
ROOT=args.output;ROOT.mkdir(parents=True,exist_ok=True)
KEYS=['building','building:part','highway','railway','natural','waterway','landuse','leisure']
SITES=[('723-avenue',19.109713,72.884422),('corporate-avenue',19.110625,72.859637),('privilon',19.108207,72.879563)]
RADIUS=args.radius
contexts={}
for name,lat,lon in SITES:
 a=math.radians(lat);m_lat=111132.92-559.82*math.cos(2*a)+1.175*math.cos(4*a);m_lon=111412.84*math.cos(a)-93.5*math.cos(3*a)
 dy,dx=RADIUS/m_lat,RADIUS/m_lon;b=(lon-dx,lat-dy,lon+dx,lat+dy)
 contexts[name]={'lat':lat,'lon':lon,'bbox':b,'shape':box(*b),'elements':{},'counts':collections.Counter()}
# The common filter removes most distant ways before more expensive exact tests.
union_bbox=(min(c['bbox'][0]for c in contexts.values()),min(c['bbox'][1]for c in contexts.values()),max(c['bbox'][2]for c in contexts.values()),max(c['bbox'][3]for c in contexts.values()))
def bbox_intersects(b,t):return not(b[2]<t[0]or b[0]>t[2]or b[3]<t[1]or b[1]>t[3])
def tags_of(o):return {t.k:t.v for t in o.tags}
def relevant(t):
 return ('building'in t or 'building:part'in t or
 ('highway'in t and t['highway']not in ['proposed','construction']and t.get('area')!='yes')or
 t.get('railway')in ['rail','light_rail','subway','tram','narrow_gauge']or
 t.get('natural')=='water'or t.get('waterway')=='riverbank'or
 t.get('leisure')in ['park','garden','pitch']or t.get('landuse')in ['grass','forest','meadow','recreation_ground'])
class Relations(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.members={}
 def relation(self,r):
  if relevant(tags_of(r))and r.tags.get('type')in ['multipolygon','boundary']:
   self.members[r.id]=[{'type':m.type,'ref':m.ref,'role':m.role}for m in r.members]
relations=Relations();start=time.monotonic();idx=ROOT/'locations.bin';idx.unlink(missing_ok=True)
reader=osmium.io.Reader(str(SOURCE));h=reader.header();header={k:h.get(k)for k in ['generator','timestamp','osmosis_replication_timestamp','osmosis_replication_sequence_number']};reader.close()
sha=hashlib.sha256()
with SOURCE.open('rb')as f:
 for chunk in iter(lambda:f.read(4*1024*1024),b''):sha.update(chunk)
source_sha=sha.hexdigest();print('SOURCE',SOURCE.name,source_sha,header,flush=True)
proc=(osmium.FileProcessor(str(SOURCE)).with_locations('sparse_file_array,'+str(idx))
 .with_areas(osmium.filter.KeyFilter(*KEYS),relations)
 .with_filter(osmium.filter.EntityFilter(osmium.osm.NODE|osmium.osm.WAY|osmium.osm.AREA))
 .with_filter(osmium.filter.KeyFilter(*KEYS)))
scanned=collections.Counter();errors=[];last=time.monotonic()
for o in proc:
 if time.monotonic()-last>20:
  print('PROGRESS',dict(scanned),'elapsed',round(time.monotonic()-start,1),flush=True);last=time.monotonic()
 try:
  if o.is_node():
   if o.tags.get('natural')!='tree':continue
   pt=(o.location.lon,o.location.lat)
   for c in contexts.values():
    b=c['bbox']
    if b[0]<=pt[0]<=b[2]and b[1]<=pt[1]<=b[3]:
     c['elements'][('node',o.id)]={'type':'node','id':o.id,'lon':pt[0],'lat':pt[1],'tags':tags_of(o)}
   scanned['nodes']+=1;continue
  if o.is_area():
   if o.from_way():continue # Original closed-way geometry already retained below.
   tags=tags_of(o)
   if not relevant(tags):continue
   scanned['relation_areas']+=1;members=[];polygons=[];allpts=[]
   for outer in o.outer_rings():
    pp=[(n.location.lon,n.location.lat)for n in outer]
    inners=[[(n.location.lon,n.location.lat)for n in hole]for hole in o.inner_rings(outer)]
    polygon=Polygon(pp,inners)
    if not polygon.is_valid:continue
    polygons.append(polygon);allpts+=pp
    members.append({'type':'way','role':'outer','geometry':[{'lon':x,'lat':y}for x,y in pp],'source_node_ids':[n.ref for n in outer]})
    for hole in o.inner_rings(outer):
     hp=[(n.location.lon,n.location.lat)for n in hole]
     members.append({'type':'way','role':'inner','geometry':[{'lon':x,'lat':y}for x,y in hp],'source_node_ids':[n.ref for n in hole]})
   if not allpts:continue
   b=(min(x for x,y in allpts),min(y for x,y in allpts),max(x for x,y in allpts),max(y for x,y in allpts))
   if not bbox_intersects(b,union_bbox):continue
   rid=o.orig_id();element={'type':'relation','id':rid,'tags':tags,'members':members,'source_members':relations.members.get(rid,[]),'geometry_note':'Complete rings assembled from source PBF member ways; no synthetic member IDs assigned.'}
   for c in contexts.values():
    if bbox_intersects(b,c['bbox'])and any(p.intersects(c['shape'])for p in polygons):c['elements'][('relation',rid)]=element
  elif o.is_way():
   tags=tags_of(o)
   if not relevant(tags):continue
   scanned['ways']+=1
   points=[(n.location.lon,n.location.lat)for n in o.nodes]
   if len(points)<2:continue
   b=(min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points))
   if not bbox_intersects(b,union_bbox):continue
   geometry=Polygon(points)if len(points)>3 and points[0]==points[-1]else LineString(points)
   if not geometry.is_valid:
    errors.append({'type':'way','id':o.id,'error':'Invalid source polygon omitted; not repaired by inventing geometry.'});continue
   element={'type':'way','id':o.id,'tags':tags,'nodes':[n.ref for n in o.nodes],'geometry':[{'lon':x,'lat':y}for x,y in points]}
   for c in contexts.values():
    if bbox_intersects(b,c['bbox'])and geometry.intersects(c['shape']):c['elements'][('way',o.id)]=element
 except (osmium.InvalidLocationError,ValueError)as e:errors.append({'id':o.id,'error':str(e)})
for name,c in contexts.items():
 out=ROOT/name;out.mkdir(exist_ok=True);elements=list(c['elements'].values());counts=collections.Counter()
 for e in elements:
  t=e.get('tags',{});counts[e['type']]+=1
  if 'building'in t or 'building:part'in t:counts['buildings']+=1
  if 'highway'in t:counts['roads']+=1
  if 'railway'in t:counts['railways']+=1
  if t.get('natural')=='water'or t.get('waterway')=='riverbank':counts['water']+=1
  if t.get('leisure')in ['park','garden','pitch']or t.get('landuse')in ['grass','forest','meadow','recreation_ground']:counts['green']+=1
 data={'version':0.6,'generator':'Geofabrik local PBF → native libosmium complete geometries','elements':elements}
 (out/'source-osm.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
 metadata={'source_file':SOURCE.name,'source_sha256':source_sha,'source_bytes':SOURCE.stat().st_size,'source_header':header,'site':name,'center_latlon':[c['lat'],c['lon']],'radius_m':RADIUS,'bbox_lonlat':c['bbox'],'bounds_method':'Exact Concept Studio OSM meters-per-degree formula at site latitude','geometry_method':'Native complete multipolygon assembly and full-way disk-cached node resolution; exact polygon/line intersection with requested bbox; geometry retained uncut for add-on clipping.','counts':dict(counts),'scan_counts':dict(scanned),'scan_seconds':round(time.monotonic()-start,2),'processing_errors':errors,'attribution':'© OpenStreetMap contributors; extract by Geofabrik','license':'ODbL1.0','processed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 (out/'source-osm-metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');print('DONE',name,json.dumps(dict(counts)),round(time.monotonic()-start,2),flush=True)
# The generated JSON/metadata suffice to replay the add-on import. The large
# temporary node-location index is not a deliverable.
del proc;idx.unlink(missing_ok=True)
