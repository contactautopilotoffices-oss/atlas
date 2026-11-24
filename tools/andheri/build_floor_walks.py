"""Build a visitor camera grid in CAD metres. Door swing arcs describe open space.
Inputs are the registered, independent DWG exports in the shortlist manifest.
"""
import json
import math
from collections import defaultdict, deque
from pathlib import Path
import numpy as np
import shapely
from shapely.geometry import Polygon, LineString, MultiPoint, box
from shapely.ops import unary_union

BASE = Path(__file__).resolve().parents[2] / 'media/flipkart-andheri/cad'
GRID = .20
def entrance(variant, index):
    if variant.startswith('corporate'):
        handles = {'corporate-266':['371DB','37AFC'], 'corporate-281':['3800C','3839B'], 'corporate-373':['3626A','364E8']}
        return [8.4966, [8.88075,8.8939][index]], [1,0], handles[variant][index], 'Lift-lobby entrance'
    if variant.startswith('privilon'):
        return [18.60675,12.9923], [0,-1], {'privilon-260':'5F4–5F7','privilon-280':'5F1–5F4','privilon-301':'5EF–5F2'}[variant], 'West lift-lobby entrance'
    x = 15.330 if variant=='723-284' else 15.329
    return [[18.545,10.703],[x,12.933]][index], [0,-1], (['C02A','C43A'] if variant=='723-300' else ['9E2F','C67B'])[index], 'Lift-lobby entrance'

def build(variant,index,plan):
    source=json.loads((BASE/plan['semantic']).read_text())
    arch=[];furniture=[]
    # Two quarter-circle swings meeting at a double-door center are an opening
    # annotation even on 723 sheets that place the insertion on a partition layer.
    arc_groups=defaultdict(list)
    for a in source['architecture']:
        pts=a['points_m']
        if a['kind']=='walls' and a.get('insert_handle') and not a['closed'] and len(pts)>8 and .6<math.dist(pts[0],pts[-1])<2:
            arc_groups[a['insert_handle']].append(a)
    swing_keys=set();double_centers=[]
    for group in arc_groups.values():
        for i,a in enumerate(group):
            for b in group[i+1:]:
                ap=a['points_m'];bp=b['points_m']
                for ac,af in [(ap[0],ap[-1]),(ap[-1],ap[0])]:
                    for bc,bf in [(bp[0],bp[-1]),(bp[-1],bp[0])]:
                        if math.dist(ac,bc)>.008 or not 1.1<math.dist(af,bf)<2.5:continue
                        mid=[(af[k]+bf[k])/2 for k in range(2)]
                        v=[mid[k]-ac[k] for k in range(2)];r=math.hypot(*v)
                        if not .54<r<1.3:continue
                        double_centers.append((ac,[v[0]/r,v[1]/r]))
                        swing_keys.update((x['insert_handle'],x['handle']) for x in (a,b))

    for a in source['architecture']:
        pts=a['points_m']
        if (a.get('insert_handle'),a['handle']) in swing_keys:continue
        if len(pts)<2 or a['kind'] not in ('walls','glass','columns'): continue
        shape=LineString(pts)
        if a.get('closed') and len(pts)>=4:
            face=Polygon(pts)
            if face.is_valid and (a['kind']=='columns' or face.area < 1.8): shape=face
        arch.append(shape)
    for a in source.get('architecture_polygons',[]):
        pts=a['points_m']
        if len(pts)>=4:
            face=Polygon(pts)
            if face.is_valid and face.area<7: arch.append(face)
    for d in source['desks']: furniture.append(Polygon(d['desktop_polygon_m']))
    for f in source.get('standalone_furniture_polygons',[]):
        face=Polygon(f['points_m'])
        if face.is_valid and face.area<16: furniture.append(face)
    for f in source.get('other_furniture',[])+source.get('task_chairs',[]):
        if f.get('bounds_m'): furniture.append(box(*f['bounds_m']))
    start,direction,handle,title=entrance(variant,index)
    # Some outline layers cross separately drawn door blocks. Identify the two
    # jambs from the common insertion and the arc endpoint before making a portal.
    doors=defaultdict(list)
    for a in source['architecture']:
        if a['kind']=='doors' and a.get('insert_handle'): doors[a['insert_handle']].append(a)
    def portal(center,normal,half_width):
        dx,dy=normal;x,y=center
        return Polygon([(x+dx*a-dy*b,y+dy*a+dx*b) for a,b in
                        [(-.37,-half_width),(.37,-half_width),(.37,half_width),(-.37,half_width)]])
    passages=[portal(start,direction,.32)]+[portal(p,d,.45) for p,d in double_centers]
    for members in doors.values():
        jambs={tuple(a['points_m'][0]) for a in members if a['closed'] and len(a['points_m'])>=5
               and .035<LineString(a['points_m']).length<.9}
        for a in members:
            pts=a['points_m']
            if a['closed'] or len(pts)<5:continue
            for end in [pts[0],pts[-1]]:
                if not any(math.dist(j,end)<.012 for j in jambs):continue
                for hinge in jambs:
                    span=math.dist(hinge,end)
                    if not .55<span<1.6:continue
                    if max(abs(math.dist(hinge,p)-span) for p in pts)>.012:continue
                    center=[(hinge[i]+end[i])/2 for i in range(2)]
                    normal=[(end[1]-hinge[1])/span,(hinge[0]-end[0])/span]
                    passages.append(portal(center,normal,span/2-.16))
    obstructions=unary_union(arch).buffer(.17).difference(unary_union(passages))
    obstructions=obstructions.union(unary_union(furniture).buffer(.17))
    # Close openings for the outer envelope only. The collision layer keeps doors passable.
    shell=unary_union(arch).buffer(1.15)
    parts=list(shell.geoms) if shell.geom_type=='MultiPolygon' else [shell]
    envelope=unary_union([Polygon(p.exterior).buffer(-1.15) for p in parts])
    # Open-plan suites sometimes have no closed slab in the DWG. Follow the
    # envelope of the drawn objects as a presentation limit in these spaces.
    vertices=[pt for a in source['architecture'] for pt in a['points_m']]
    vertices.extend(pt for d in source['desks'] for pt in d['desktop_polygon_m'])
    envelope=envelope.union(shapely.concave_hull(MultiPoint(vertices),ratio=.22))
    left,bottom,right,top=source['bounds_m'];nx=math.ceil((right-left)/GRID);ny=math.ceil((top-bottom)/GRID)
    xx,yy=np.meshgrid(left+np.arange(nx)*GRID,bottom+np.arange(ny)*GRID)
    mask=shapely.contains_xy(envelope.difference(obstructions),xx,yy)
    yy0,xx0=np.where(mask);i=np.argmin((xx[yy0,xx0]-start[0])**2+(yy[yy0,xx0]-start[1])**2)
    seed=int(xx0[i]),int(yy0[i])
    assert math.dist((xx[seed[1],seed[0]],yy[seed[1],seed[0]]),start)<.4,(plan['id'],seed)
    seen=np.zeros_like(mask); todo=deque([seed]);seen[seed[1],seed[0]]=True
    while todo:
        x,y=todo.popleft()
        for a,b in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            if 0<=a<nx and 0<=b<ny and mask[b,a] and not seen[b,a]:
                seen[b,a]=True;todo.append((a,b))
    assert seen.sum()>100,(plan['id'],seen.sum())
    rows=[''.join('1' if v else '0' for v in row) for row in seen]
    return dict(plan=plan['id'],source_sha256=source['source']['sha256'],start=start,heading=direction,door=handle,title=title,swing_segments=sorted([list(pair) for pair in swing_keys]),cell=GRID,origin=[left,bottom],rows=rows)

if __name__=='__main__':
    out=BASE/'walks';out.mkdir(exist_ok=True)
    for prop in json.loads((BASE/'manifest.json').read_text())['properties'].values():
        for variant in prop['variants']:
            for i,plan in enumerate(variant['plans']):
                nav=build(variant['id'],i,plan)
                (out/(plan['id']+'.json')).write_text(json.dumps(nav,separators=(',',':'))+'\n')
                print(plan['id'],sum(r.count('1') for r in nav['rows']))
