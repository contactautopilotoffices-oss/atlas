"""Place Volt's CAD floor inside the existing Skymark twin.

The CAD's first-floor outline (layout "plate") is fitted to the building's
real footprint (Overture Maps 22e4bdbe..., the one the twin stands on) by
rotation and shift, scoring the overlap (IoU). Two orientations score almost
the same because the outline is close to a rectangle. We pick the one that
puts the lift core at the street front (bearing 146 deg), where the twin's
entrance is. The other would put the lifts in the back corner.

The result is written into the layout as "site_fit". The viewer uses it to
put the twin GLB (local frame, origin at the footprint centre, front facing
-Y, turned by phi onto the map) into the CAD's frame.

Usage: python3 fit_twin.py <layout.json> <context_overture.json> <facade_parameters.json>
"""
import json, math, sys
from shapely.geometry import Polygon, Point
from shapely import affinity

lay_p, ctx_p, par_p = sys.argv[1:4]
L = json.load(open(lay_p)); C = json.load(open(ctx_p)); P = json.load(open(par_p))
fp = Polygon([b for b in C['buildings'] if b['id'].startswith(P['map']['replaces_footprint_id'][:8])][0]['ring'])
pl = Polygon(L['plate'])

def place(rot, dx, dy):
    r = affinity.rotate(pl, rot, origin=pl.centroid)
    return affinity.translate(r, fp.centroid.x - pl.centroid.x + dx, fp.centroid.y - pl.centroid.y + dy)
def iou(g): return g.intersection(fp).area / g.union(fp).area

cands = []
for base in range(0, 360, 1):
    cands.append((iou(place(base, 0, 0)), base))
cands.sort(reverse=True)
results = []
for _, base in cands[:2] + [(0, (cands[0][1] + 180) % 360)]:
    best = (0, base, 0, 0)
    for da10 in range(-20, 21, 2):
        for dx in [x / 2 for x in range(-6, 7)]:
            for dy in [x / 2 for x in range(-6, 7)]:
                v = iou(place(base + da10 / 10, dx, dy))
                if v > best[0]: best = (v, base + da10 / 10, dx, dy)
    results.append(best)
# orientation whose lift core is nearest the street front edge (bearing 146: the SE end)
front_dir = (math.sin(math.radians(146)), math.cos(math.radians(146)))
def lift_score(r):
    _, rot, dx, dy = r
    lx = sum(p[0] for p in L['lifts']) / len(L['lifts']); ly = sum(p[1] for p in L['lifts']) / len(L['lifts'])
    p = affinity.translate(affinity.rotate(Point(lx, ly), rot, origin=pl.centroid), fp.centroid.x - pl.centroid.x + dx, fp.centroid.y - pl.centroid.y + dy)
    return (p.x - fp.centroid.x) * front_dir[0] + (p.y - fp.centroid.y) * front_dir[1]
uniq = {}
for r in results: uniq.setdefault(round(r[1]) % 360, r)
opts = sorted(uniq.values(), key=lift_score, reverse=True)
chosen = opts[0]
v, rot, dx, dy = chosen
L['site_fit'] = {
    "about": "CAD plan (x east, y north in the drawing, metres) to the map's local ENU metres round the atlas pin: ENU = R(rot) * (p - plate_centroid) + footprint_centroid + [dx, dy]. Twin GLB local (Blender x, y) to ENU: ENU = R(phi) * b + C.",
    "rot_deg": round(rot, 2), "dx": dx, "dy": dy, "iou": round(v, 3),
    "plate_centroid": [round(pl.centroid.x, 3), round(pl.centroid.y, 3)],
    "footprint_centroid": [round(fp.centroid.x, 3), round(fp.centroid.y, 3)],
    "twin_C": P['map']['region_xy'], "twin_phi_deg": P['map']['phi_deg'], "twin_floor_to_floor": P['massing']['floor_to_floor'],
    "alternatives": [{"rot_deg": round(r[1], 2), "iou": round(r[0], 3), "lift_toward_front_m": round(lift_score(r), 1)} for r in opts],
    "why": "The footprint is close to a rectangle, so a 180 deg turn scores almost the same. The chosen one puts the CAD's lift core toward the street front (bearing 146), where the twin's entrance is. The drawing's own north arrow does not agree with the footprint by about 100 deg, so it is treated as project north.",
}
json.dump(L, open(lay_p, 'w'), separators=(',', ':'))
print(json.dumps(L['site_fit'], indent=1))
