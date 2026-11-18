"""Walkway widths: the CAD's own "1200 MM WIDE PASSAGE" labels measured, plus a scan for pinch points.

Obstacles are what a person cannot walk through: wall, glass and column lines and the desks and tables
(desk shapes drawn as loose polylines, desk and table blocks). Chairs are not obstacles (they move).
The width at a point is the shortest chord through it: for directions every 5 degrees, the distance to
the nearest obstacle one way plus the other way; the smallest sum is the clear width there.

Each passage label is measured at points along its text (the text sits in the passage it names), and
the median is compared with the label. The scan samples every circulation centreline every 1 m and
lists places under 1.2 m that are not door openings.

Writes <work>/walkways.json and <out>/<tenant>_walkways.csv.
"""
import json, os, sys, re, math, csv, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely.strtree import STRtree
from common import offer_clip, args, load_flat, Frame, outname
from geom import clean_text

a = args(); C = a.cfg; F = Frame(C)
R = json.load(open(os.path.join(a.work, 'rooms.json'))); I = json.load(open(os.path.join(a.work, 'inst.json')))
d = load_flat(a)['rec']
mk = lambda p, h=None: Polygon(p, h or []).buffer(0)
obs = [LineString(l) for l in R['wall_lines'] + R['glass_lines'] if len(l) > 1] + [mk(c) for c in R['columns']]
obs += [mk(x['poly']) for x in R.get('desk_shapes', [])]
for o in I:
    if o['name'] in C.get('desks', {}) or o['name'] in C.get('tables', {}):
        (x0, y0), (x1, y1) = F.m(o['cx'] - o['w'] / 2, o['cy'] - o['h'] / 2), F.m(o['cx'] + o['w'] / 2, o['cy'] + o['h'] / 2)
        obs.append(box(x0, y0, x1, y1))
plate = mk(R['plate']); obs.append(plate.exterior)
chairs = []
for o in I:
    if o['name'] in C.get('chairs', {}) and C['chairs'][o['name']][1] != 'lounge':
        (x0, y0), (x1, y1) = F.m(o['cx'] - o['w'] / 2, o['cy'] - o['h'] / 2), F.m(o['cx'] + o['w'] / 2, o['cy'] + o['h'] / 2)
        if (x1 - x0) < 1.0 and (y1 - y0) < 1.0: chairs.append(box(x0, y0, x1, y1))
OBS = {'desk': obs, 'chair': obs + chairs}
TT = {k: STRtree(v) for k, v in OBS.items()}
def width(p, reach=4.0, mode='desk'):
    best = None; obs_ = OBS[mode]
    near = [obs_[i] for i in TT[mode].query(p.buffer(reach))]
    if any(g.contains(p) for g in near if g.geom_type == 'Polygon'): return 0.0, None
    for k in range(36):
        t = math.radians(k * 5); dx, dy = math.cos(t), math.sin(t); s_ = []
        for sg in (1, -1):
            ray = LineString([(p.x, p.y), (p.x + sg * dx * reach, p.y + sg * dy * reach)])
            hits = [ray.intersection(g) for g in near if ray.intersects(g)]
            s_.append(min((p.distance(h) for h in hits if not h.is_empty), default=reach))
        w = s_[0] + s_[1]
        if best is None or w < best[0]: best = (w, k * 5)
    return best
rx = re.compile(C.get('passage_label', r'(\d{3,4})\s*MM\s*WIDE\s*PASSAGE'), re.I)
nd = unary_union([mk(n['poly'], n.get('holes')) for n in R['not_demised']]) if R['not_demised'] else Polygon()
clip = offer_clip(C) if offer_clip(C) is not None else box(-1e9, -1e9, 1e9, 1e9)
labs = []
for r in d:
    if r['t'] not in ('MText', 'TextEntity') or not r.get('txt') or not F.inwin(r['p']): continue
    t = clean_text(r['txt']); m = rx.search(t)
    if not m: continue
    x, y = F.m(*r['p']); h = (r.get('hgt') or 150) * F.s
    if nd.contains(Point(x, y)) or not clip.contains(Point(x, y)): continue
    L = len(t) * h * 0.85
    pts = [Point(x + f * L, y + h / 2) for f in (0.1, 0.3, 0.5, 0.7, 0.9)]
    ws = [width(p) for p in pts]; ok = [w for w, _ in ws if w and w > 0.3]
    wc = [width(p, mode='chair') for p in pts]; okc = [w for w, _ in wc if w and w > 0.3]
    med_d = statistics.median(ok) if ok else None
    med = statistics.median(okc) if okc else None
    lab = int(m.group(1)) / 1000
    labs.append({'label': t, 'at': [round(x, 1), round(y, 1)], 'label_m': lab, 'measured_m': round(med, 2) if med else None,
                 'desk_to_desk_m': round(med_d, 2) if med_d else None,
                 'samples_m': [round(w, 2) if w else None for w, _ in wc], 'diff_mm': round((med - lab) * 1000) if med else None,
                 'ok': (med is not None and abs(med - lab) <= max(0.1, 0.08 * lab)), 'at_least_label': (med is not None and med >= lab - 0.05)})
# pinch scan along circulation centrelines
doors = [LineString([dd['opening'][:2], dd['opening'][2:]]) for dd in R['doors']]
pinch = []; n_s = 0
for c in R['circulation']:
    if nd.buffer(0.1).contains(Point(c['poly'][0])) or not clip.contains(mk(c['poly']).centroid): continue
    for cl in c.get('centreline') or []:
        ln = LineString(cl)
        for k in range(int(ln.length) + 1):
            p = ln.interpolate(k); n_s += 1
            w = width(p, 3.0, 'chair')
            if w and 0.3 < w[0] < 1.2 and not any(dl.distance(p) < 0.8 for dl in doors):
                pinch.append({'at': [round(p.x, 1), round(p.y, 1)], 'width_m': round(w[0], 2), 'in': c['name']})
res = {'labels': labs, 'labels_checked': len(labs), 'labels_within_tolerance': sum(1 for l in labs if l['ok']),
       'labels_at_least_as_wide': sum(1 for l in labs if l['at_least_label']),
       'scan': {'points': n_s, 'under_1_2_m': pinch[:80], 'n_under_1_2_m': len(pinch)},
       'method': 'clear width = shortest chord through the point between walls, glass, columns, desks, tables and the work, meeting and training chairs as drawn at their desks (lounge seats ignored); desk_to_desk_m ignores the chairs; tolerance max(100 mm, 8 %)'}
json.dump(res, open(os.path.join(a.work, 'walkways.json'), 'w'), indent=1)
with open(outname(a, '_walkways.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['label', 'x_m', 'y_m', 'label_m', 'measured_m (chair to chair)', 'desk_to_desk_m', 'diff_mm', 'within_tolerance', 'samples_m'])
    for l in labs: w.writerow([l['label'], *l['at'], l['label_m'], l['measured_m'], l['desk_to_desk_m'], l['diff_mm'], l['ok'], ' '.join(str(s) for s in l['samples_m'])])
for l in labs: print(f"{l['label']:28} at {l['at']}  label {l['label_m']:.2f}  chairs {l['measured_m']}  desks {l['desk_to_desk_m']}  {l['samples_m']}")
print('pinch points under 1.2 m:', len(pinch), pinch[:10])
