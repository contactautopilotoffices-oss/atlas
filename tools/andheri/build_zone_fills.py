"""Build display overlays from CAD linework; these are not measured room areas."""
import json
from collections import defaultdict
from pathlib import Path
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polygonize, unary_union

base = Path(__file__).resolve().parents[2] / 'media/flipkart-andheri/cad'
def svg(face):
    return 'M'+'L'.join(f'{x:.3f},{-y:.3f}' for x,y in face.exterior.coords)+'Z'

def build(path):
    plan=json.loads(path.read_text())
    semantics=json.loads(path.with_name(path.stem+'-semantic.json').read_text())
    segments=[]
    axes=defaultdict(list)
    for item in semantics['architecture']:
        if item['kind'] not in ('walls','glass','columns'): continue
        pts=item['points_m']
        for a,b in zip(pts,pts[1:]):
            if a==b: continue
            segments.append(LineString([a,b]))
            for axis in (0,1):
                if abs(a[axis]-b[axis])<.002:
                    axes[axis,round(a[axis],2)].append(sorted([a[1-axis],b[1-axis]]))
    for (axis,k),spans in axes.items():
        end=None
        for lo,hi in sorted(spans):
            if end is not None and 0<lo-end<=1.55:
                segments.append(LineString([(k,end),(k,lo)] if axis==0 else [(end,k),(lo,k)]))
            end=max(end or hi,hi)
    faces=sorted((p for p in polygonize(unary_union(segments)) if p.area>.55),key=lambda p:p.area)
    zones=plan['zones']+plan['others']
    for z in zones:
        if z.get('d') or not z.get('label'):continue
        pt=Point(z['label'])
        if z.get('kind')=='wc':
            # A label anchor can sit inside the wall thickness at a doorway.
            adjacent=[p for p in faces if 3<p.area<90 and p.minimum_clearance>=0 and p.buffer(-.45).area>1 and p.distance(pt)<.32]
            adjacent=[p for p in adjacent if not any(o is not z and o.get('label') and p.contains(Point(o['label'])) for o in zones)]
            if adjacent:
                z['display_outline']=svg(min(adjacent,key=lambda p:(p.distance(pt),-p.area)));continue
        for face in faces:
            if face.area>180 or not face.contains(pt):continue
            if any(o is not z and o.get('label') and o.get('kind')!=z.get('kind') and face.contains(Point(o['label'])) for o in zones):continue
            if any(o is not z and o.get('label') and o.get('group') and face.contains(Point(o['label'])) for o in zones):continue
            z['display_outline']=svg(face);break
    for z in zones:
        if z.get('d') or z.get('display_outline') or not z.get('label') or z.get('group')=='Workstations':continue
        x,y=z['label']
        edges=[]
        for axis,center,cross in [(0,x,y),(1,y,x)]:
            reach=1.05 if z.get('group')=='Meeting room' else .18
            coords=[k for (direction,k),spans in axes.items() if direction==axis and any(a-reach<=cross<=b+reach and b-a>.25 for a,b in spans)]
            edges.extend([max((k for k in coords if k<center-.08),default=center-100),min((k for k in coords if k>center+.08),default=center+100)])
        l,r,b,t=edges
        if max(r-l,t-b)>12 or min(r-l,t-b)<.55:continue
        face=box(l,b,r,t)
        if any(o is not z and o.get('label') and o.get('name')!=z.get('name') and o.get('kind')!= 'wc' and face.contains(Point(o['label'])) for o in zones):continue
        z['display_outline']=svg(face)
    work=[z for z in plan['zones'] if z['group']=='Workstations' and not z.get('d')]
    if work:
        banks=defaultdict(list)
        for desk in semantics['desks']:
            pos=Point(desk['desktop_center_m'])
            z=min(work,key=lambda r:pos.distance(Point(r['label'])))
            banks[z['id']].append(Polygon(desk['desktop_polygon_m']))
        for z in work:
            footprint=unary_union([d.buffer(.35,join_style=2) for d in banks[z['id']]]).buffer(-.27,join_style=2)
            if not footprint.is_empty:z['display_outline']=''.join(svg(p) for p in getattr(footprint,'geoms',[footprint]))
    path.write_text(json.dumps(plan,separators=(',',':'),ensure_ascii=False)+'\n')
    if path.stem=='corporate-281-plan2':print([(z['name'],bool(z.get('d') or z.get('display_outline'))) for z in zones])
for path in sorted(base.glob('*-plan[12].json')):build(path)
