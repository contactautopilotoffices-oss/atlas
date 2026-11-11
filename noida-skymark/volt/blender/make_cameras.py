"""Pick a camera for every room from the CAD layout: one for a still (standing
near a corner, looking across the room) and one for a 360 panorama (standing
in the clearest spot near the middle). Both stand only where a person could:
clear of walls, glass, columns, desks, tables and planters.

Usage: python3 make_cameras.py <volt-floor1.layout.json> <cameras.json>
"""
import json, math, sys
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity

L = json.load(open(sys.argv[1]))
EYE = 1.5
def rect(c, w, d, a):
    return affinity.translate(affinity.rotate(box(-w / 2, -d / 2, w / 2, d / 2), a, origin=(0, 0), use_radians=True), c[0], c[1])
hard = [Polygon(w['outer'], w['holes']) for w in L['walls']] + [Polygon(c) for c in L['columns']]
hard += [LineString([(g[0], g[1]), (g[2], g[3])]).buffer(0.06) for g in L['glass']]
soft = [rect(d['c'], d['w'], d['d'], d['a']) for d in L['desks']] + [rect(p['c'], p['w'], p['d'], p['a']) for p in L['planters']]
for t in L['tables']:
    soft.append(Point(t['circle'][:2]).buffer(t['circle'][2]) if 'circle' in t else Polygon(t['poly']))
soft += [Point(s['x'], s['y']).buffer(0.3) for s in L['seats']]
if L.get('atrium'): hard.append(Polygon(L['atrium']))
HARD = unary_union(hard); ALL = unary_union(hard + soft)
floor = unary_union([Polygon(f['outer'], f['holes']) for f in L['floor']])
# still cameras set by hand to match the design deck's own views (x, y, look x, look y)
OVERRIDE = {'Open workstations': (9.3, 14.75, 18.5, 21.2)}   # deck page 4: from the passage corner, along the bench rows
SKIP = {'Phone booths PH-05 to 07', 'Phone booths PH-01 to 04', 'UPS room', 'Server room', 'Wet pantry', 'Entry', 'Atrium-side lounge'}
out = []
for r in L['rooms']:
    if r['name'] in SKIP: continue
    x0, y0, x1, y1 = r['box']; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; diag = math.hypot(x1 - x0, y1 - y0)
    best_s = best_p = None
    xs = [x0 + 0.35 + i * 0.2 for i in range(int((x1 - x0 - 0.7) / 0.2) + 1)]; ys = [y0 + 0.35 + i * 0.2 for i in range(int((y1 - y0 - 0.7) / 0.2) + 1)]
    for x in xs:
        for y in ys:
            p = Point(x, y)
            if not floor.contains(p): continue
            c = ALL.distance(p)
            if c < 0.32: continue
            dc = math.hypot(x - cx, y - cy) / diag
            tx, ty = 2 * cx - x, 2 * cy - y; dl = math.hypot(tx - x, ty - y) or 1; ux, uy = (tx - x) / dl, (ty - y) / dl
            sight = LineString([(x, y), (x + ux * 1.6, y + uy * 1.6)])
            if not HARD.intersects(sight):
                # how far the view runs before it meets furniture: a desk right under the lens ruins a shot
                free = 0.0
                for k in range(1, 9):
                    if ALL.intersects(LineString([(x, y), (x + ux * 0.4 * k, y + uy * 0.4 * k)])): break
                    free = 0.4 * k
                s = min(c, 0.9) * 2.0 + dc * 3.0 + min(free, 2.4) * 1.6
                if best_s is None or s > best_s[0]: best_s = (s, x, y, cx + (tx - cx) * 0.35, cy + (ty - cy) * 0.35)
            sp = min(c, 1.4) * 2 - dc * 1.5
            if best_p is None or sp > best_p[0]: best_p = (sp, x, y)
    if r['name'] in OVERRIDE: best_s = (9, *OVERRIDE[r['name']])
    if best_s is None and best_p is None: continue
    if best_s is None: best_s = (0, best_p[1], best_p[2], cx, cy)
    slug = ''.join(ch if ch.isalnum() else '-' for ch in r['name'].lower()).strip('-')
    while '--' in slug: slug = slug.replace('--', '-')
    out.append({"room": r['name'], "slug": slug, "floor": r['floor'],
                "still": {"pos": [round(best_s[1], 2), round(best_s[2], 2), EYE], "look": [round(best_s[3], 2), round(best_s[4], 2), 1.05], "lens_mm": 20},
                "pano": {"pos": [round(best_p[1], 2), round(best_p[2], 2), EYE]}})
json.dump({"about": "Camera for each room, in the CAD layout's frame (metres, x east, y north, z up). Made by make_cameras.py.", "eye": EYE, "rooms": out}, open(sys.argv[2], 'w'), indent=1)
print(len(out), 'rooms:', ', '.join(o['slug'] for o in out))
