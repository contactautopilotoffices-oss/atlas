"""Daylight: the share of work desks within 6 m of a window, by true facade direction.

Window = the facade glazing lines ('facade_glass' layers, e.g. STRUCTURAL GLAZING, WINDOW) that lie
on the plate edge (within 1.5 m of the outline), inside the offer. For each work seat (group W): the
distance to the nearest such glass, and the true bearing of the facade it looks to (the outward normal
of that bit of plate edge, turned by the true-north rotation in the tenant json). Bearings are binned
into 8 directions. Also reported: the glazed length per facade direction.

Writes <work>/daylight.json and <out>/<tenant>_daylight.csv.
"""
import json, os, sys, math, csv, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union, nearest_points
from common import offer_clip, args, load_flat, Frame, outname, is_poly

a = args(); C = a.cfg; F = Frame(C)
R = json.load(open(os.path.join(a.work, 'rooms.json'))); S = json.load(open(os.path.join(a.work, 'seats.json')))
d = load_flat(a)['rec']
mk = lambda p, h=None: Polygon(p, h or []).buffer(0)
plate = mk(R['plate']); edge = plate.exterior
nd = unary_union([mk(n['poly'], n.get('holes')) for n in R['not_demised']]) if R['not_demised'] else Polygon()
clip = offer_clip(C) if offer_clip(C) is not None else plate.envelope.buffer(5)
LAY = set(C['layers'].get('facade_glass', ['STRUCTURAL GLAZING', 'WINDOW']))
rot = C.get('true_north', {}).get('plan_north_bearing_deg', 0.0)      # true bearing of the plan's +y
segs = []
for r in d:
    if not is_poly(r) or r['ch'] or r['L'] not in LAY or not F.inwin(r['p'][0]): continue
    P = [F.m(*q) for q in r['p']]
    for p, q in zip(P, P[1:]):
        if math.dist(p, q) < 0.05: continue
        s_ = LineString([p, q])
        if s_.distance(edge) < 1.5 and clip.intersects(s_) and not nd.buffer(0.5).contains(s_): segs.append(s_)
glass = unary_union(segs)
DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
def bearing_out(q):
    """True bearing of the outward normal of the plate edge at point q (on or near the edge)."""
    t = edge.project(q); a_, b_ = edge.interpolate(max(0, t - 0.5)), edge.interpolate(min(edge.length, t + 0.5))
    tx, ty = b_.x - a_.x, b_.y - a_.y; L = math.hypot(tx, ty) or 1
    nx, ny = ty / L, -tx / L
    m = Point(q.x + nx * 0.3, q.y + ny * 0.3)
    if plate.contains(m): nx, ny = -nx, -ny
    cad = math.degrees(math.atan2(nx, ny)) % 360           # clockwise from the plan's +y
    return (cad + rot) % 360
sec = lambda b: DIRS[int(((b + 22.5) % 360) // 45)]
rows = []
for s in S:
    if s['grp'] != 'W': continue
    p = Point(s['x_m'], s['y_m'])
    if glass.is_empty: rows.append(dict(seat=s.get('seat_id'), d=None, b=None, f=None)); continue
    q = nearest_points(glass, p)[0]; dist = p.distance(q); b = bearing_out(q)
    rows.append({'seat_id': s.get('seat_id'), 'room': s['room'], 'x_m': s['x_m'], 'y_m': s['y_m'], 'dist_to_window_m': round(dist, 2),
                 'facade_bearing_deg': round(b), 'facade': sec(b)})
near = [r for r in rows if r.get('dist_to_window_m') is not None and r['dist_to_window_m'] <= 6.0]
by = collections.Counter(r['facade'] for r in near); allby = collections.Counter(r['facade'] for r in rows if r.get('facade'))
glen = collections.Counter()           # glazed facade length: the plate edge (in the offer) with glass within 1.5 m, sampled every 0.5 m
gb = glass.buffer(1.5) if not glass.is_empty else Polygon()
for k in range(int(edge.length / 0.5)):
    q = edge.interpolate(k * 0.5)
    if gb.contains(q) and clip.contains(q) and not nd.buffer(0.5).contains(q): glen[sec(bearing_out(q))] += 0.5
res = {'work_seats': len(rows), 'within_6_m': len(near), 'share_within_6_m': round(len(near) / len(rows), 3) if rows else None,
       'within_6_m_by_facade': dict(by), 'nearest_facade_all_work_seats': dict(allby),
       'median_dist_m': sorted(r['dist_to_window_m'] for r in rows)[len(rows) // 2] if rows else None,
       'max_dist_m': max((r['dist_to_window_m'] for r in rows), default=None),
       'glazed_length_m_by_facade': {k: round(v, 1) for k, v in glen.items()},
       'true_north': C.get('true_north'),
       'method': 'distance from each work seat to the nearest facade glass line on the plate edge; facade direction = outward normal of the plate edge there, turned to true bearings by the north fit'}
json.dump(res, open(os.path.join(a.work, 'daylight.json'), 'w'), indent=1)
with open(outname(a, '_daylight.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['seat_id', 'room', 'x_m', 'y_m', 'dist_to_window_m', 'facade_bearing_deg', 'facade']); w.writeheader(); [w.writerow(r) for r in rows]
print(json.dumps({k: v for k, v in res.items() if k != 'method'}, indent=1))
