"""Entries and exits, with the walking distance from every seat to its two nearest exits.

Walkable floor: the offer (plate minus `not_demised`, minus lift wells and shafts), less a 0.15 m band
round every wall, glass and column line. Furniture is not an obstacle (people walk the aisles; the
distances are slightly optimistic for seats deep in a desk cluster). Distances are shortest paths on a
0.2 m grid with 8-way moves (straight 0.2 m, diagonal 0.283 m), so they follow corridors and doors,
never through walls. The 0.3 m wall band is wider than a diagonal step, so a path can never hop a wall.

Exits: every staircase (STAIR-layer line work clustered into stair cores) that the offer can reach,
entered at its exit-door label (E.D. = exit door, F.D. = fire door) when there is one within 5 m.
FIRE EXIT doors and FIRE RESCUE BALCONY labels are listed too; balconies are fire-fighter access, not exits.
Entries: lift wells (LIFT-WELL labels clustered into lift banks), their lobby, the reception, and the
doors on the walking route from each lift bank to the reception (the first one is the front door).

Writes <work>/egress.json, <out>/<tenant>_egress.csv (one row per seat) and <out>/<tenant>_egress.png.
"""
import json, os, sys, re, math, heapq, collections, csv, gzip
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import shapely
from shapely.geometry import Polygon, Point, LineString, MultiPoint, box
from shapely.ops import unary_union
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from common import offer_clip, args, load_flat, Frame, outname, is_poly
from geom import clean_text

a = args(); C = a.cfg; F = Frame(C); EX = C['exits']
R = json.load(open(os.path.join(a.work, 'rooms.json'))); S = json.load(open(os.path.join(a.work, 'seats.json')))
d = load_flat(a)['rec']
G = 0.2
mk = lambda p, h=None: Polygon(p, h or []).buffer(0)
plate = mk(R['plate'])
nd = unary_union([mk(n['poly'], n.get('holes')) for n in R['not_demised']]) if R['not_demised'] else Polygon()
shafts = unary_union([mk(r['poly'], r.get('holes')) for r in R['rooms'] if re.search(r'LIFT-WELL|Shaft or duct|SERVICE DUCT', r['name'], re.I)])
offer = plate.difference(nd.buffer(0.05)).difference(shafts)
if C.get('egress_poly_m'):        # tenant json: the unit plus the common lobby its people walk through (not another tenant's floor)
    offer = plate.intersection(Polygon(C['egress_poly_m']).buffer(0)).difference(shafts)
elif offer_clip(C) is not None and not C.get('egress_whole_floor'): offer = offer.intersection(offer_clip(C))     # the plan's own unit (tenant json)
# egress_whole_floor: the unit's exits are outside it (a suite reached through the common lobby): walk the
# whole plate minus other tenants' units
lines = [LineString(l) for l in R['wall_lines'] + R['glass_lines'] if len(l) > 1]
lines += [mk(c).exterior for c in R['columns']]
band = unary_union([l.buffer(0.15, cap_style=2) for l in lines])
# door openings and the CAD's door-less openings (auto closures: toilet entries, lift doorways) are cut
# back through the wall band, so a 750 mm stair door stays a 750 mm gap
holes_ = [LineString([dd['opening'][:2], dd['opening'][2:]]).buffer(0.32, cap_style=2) for dd in R['doors']]
holes_ += [LineString([c['a'], c['b']]).buffer(0.32, cap_style=2) for c in R.get('closures', []) if c.get('source') == 'auto']
walk = offer.difference(band).union(unary_union(holes_).intersection(offer)).buffer(0)
x0, y0, x1, y1 = offer.bounds
nx, ny = int((x1 - x0) / G) + 2, int((y1 - y0) / G) + 2
xs = x0 + (np.arange(nx) + 0.5) * G; ys = y0 + (np.arange(ny) + 0.5) * G
XX, YY = np.meshgrid(xs, ys)
M = shapely.contains_xy(walk, XX, YY)                       # [ny, nx] walkable
print('grid', nx, 'x', ny, 'walkable cells', int(M.sum()))
cell = lambda x, y: (int((y - y0) / G), int((x - x0) / G))
def snap(x, y, r=3.0):
    i, j = cell(x, y); k = int(r / G)
    i0, i1, j0, j1 = max(0, i - k), min(ny, i + k + 1), max(0, j - k), min(nx, j + k + 1)
    if i0 >= i1 or j0 >= j1: return None          # off the grid (a negative end index would wrap round)
    sub = M[i0:i1, j0:j1]
    if not sub.any(): return None
    ii, jj = np.nonzero(sub); dd = (ii + i0 - i) ** 2 + (jj + j0 - j) ** 2; q = int(np.argmin(dd))
    return (int(ii[q] + i0), int(jj[q] + j0))
NB = [(-1, 0, G), (1, 0, G), (0, -1, G), (0, 1, G), (-1, -1, G * 1.4142), (-1, 1, G * 1.4142), (1, -1, G * 1.4142), (1, 1, G * 1.4142)]
def dijkstra(src, parent=False):
    srcs = src if isinstance(src, list) else [src]
    D = np.full((ny, nx), np.inf); P = {} if parent else None; h = []
    for c in srcs: D[c] = 0.0; h.append((0.0, c))
    Mm = M
    while h:
        dd, (i, j) = heapq.heappop(h)
        if dd > D[i, j]: continue
        for di, dj, w in NB:
            a_, b_ = i + di, j + dj
            if 0 <= a_ < ny and 0 <= b_ < nx and Mm[a_, b_]:
                nd_ = dd + w
                if nd_ < D[a_, b_]:
                    D[a_, b_] = nd_; heapq.heappush(h, (nd_, (a_, b_)))
                    if parent: P[(a_, b_)] = (i, j)
    return D, P

# ------------------------------------------------------------- stairs and exit labels
win = lambda p: F.inwin(p)
st = [LineString([F.m(*q) for q in r['p']]) for r in d if is_poly(r) and not r['ch'] and r['L'] == EX['stair_layer'] and win(r['p'][0]) and len(r['p']) > 1]
blob = unary_union([l.buffer(0.8) for l in st])
stairs = [g.buffer(-0.8) if not g.buffer(-0.8).is_empty else g for g in getattr(blob, 'geoms', [blob]) if g.area > 8]
stairs = [s_ for s_ in stairs if s_.area > 4]
txt = [dict(t=clean_text(r['txt']), x=F.m(*r['p'])[0], y=F.m(*r['p'])[1]) for r in d if r['t'] in ('MText', 'TextEntity') and r.get('txt') and win(r['p'])]
rx = re.compile(EX['labels'], re.I)
xl = [t for t in txt if rx.search(t['t'])]
exits = []
for k, s_ in enumerate(sorted(stairs, key=lambda g: (-g.centroid.y, g.centroid.x))):
    near = [t for t in xl if re.match(r'^[EF]\.?D', t['t']) and s_.distance(Point(t['x'], t['y'])) < 5.0]
    risers = sum(1 for l in st if s_.contains(l.centroid))
    in_offer = offer.buffer(0.5).intersects(s_)
    sd = [dd for dd in R['doors'] if s_.buffer(2.0).contains(Point(dd['c']))]      # the stair's own doors
    pts = [tuple(dd['c']) for dd in sd] or [(t['x'], t['y']) for t in near] or [(s_.centroid.x, s_.centroid.y)]
    cells_ = []
    for p_ in pts:
        i, j = cell(*p_); kk = 3
        cells_ += [(a_, b_) for a_ in range(max(0, i - kk), min(ny, i + kk + 1)) for b_ in range(max(0, j - kk), min(nx, j + kk + 1)) if M[a_, b_]]
    if not cells_: cells_ = [c for c in (snap(*p) for p in pts) if c]
    exits.append({'id': f'S{k + 1}', 'kind': 'staircase', 'doors': [{'at': [round(dd['c'][0], 1), round(dd['c'][1], 1)], 'block': dd['block'], 'width_m': dd['width_m']} for dd in sd], 'c': [round(s_.centroid.x, 2), round(s_.centroid.y, 2)], 'bbox': [round(v, 2) for v in s_.bounds],
                  'door_labels': [f"{t['t']} ({t['x']:.1f}, {t['y']:.1f})" for t in near], 'lines': risers,
                  'reachable': bool(cells_), 'touches_offer': bool(in_offer), '_cells': cells_})
fire_exit = [t for t in xl if re.search('FIRE EXIT', t['t'], re.I) and not nd.contains(Point(t['x'], t['y']))]
balc = [t for t in xl if re.search('BALCONY', t['t'], re.I) and not nd.contains(Point(t['x'], t['y']))]
reach = [e for e in exits if e['reachable']]
print('stairs', len(exits), 'reachable', len(reach), [e['id'] for e in reach])

# distance field per reachable stair (multi-source over its door cells)
DF = {}
for e in reach:
    DF[e['id']], _ = dijkstra(sorted(set(e['_cells'])))
seat_rows = []
for s in S:
    c = snap(s['x_m'], s['y_m'], 2.0)
    ds = sorted(((float(DF[k][c]) if c else math.inf, k) for k in DF), key=lambda t: t[0])
    ds = [t for t in ds if math.isfinite(t[0])]
    seat_rows.append({'seat_id': s.get('seat_id', s['n']), 'group': s['grp'], 'room': s['room'], 'x_m': s['x_m'], 'y_m': s['y_m'],
                      'exit_1': ds[0][1] if ds else None, 'dist_1_m': round(ds[0][0], 1) if ds else None,
                      'exit_2': ds[1][1] if len(ds) > 1 else None, 'dist_2_m': round(ds[1][0], 1) if len(ds) > 1 else None})
used = {r[k] for r in seat_rows for k in ('exit_1', 'exit_2') if r[k]}
for e in exits: e['reachable'] = e['id'] in used
d1 = [r['dist_1_m'] for r in seat_rows if r['dist_1_m'] is not None]; d2 = [r['dist_2_m'] for r in seat_rows if r['dist_2_m'] is not None]
lim = EX.get('nbc_travel_m', 45.0); lim0 = EX.get('nbc_travel_unsprinklered_m', 30.0)
far = max(seat_rows, key=lambda r: r['dist_1_m'] or 0) if d1 else None
one = collections.Counter(r['room'] for r in seat_rows if r['dist_1_m'] is not None and r['dist_2_m'] is None)
stats = {'seats': len(seat_rows), 'seats_with_one_exit_only_by_room': dict(one), 'exits_used': sorted(used), 'seats_with_two_exits': sum(1 for r in seat_rows if r['dist_2_m'] is not None),
         'seats_with_no_exit': sum(1 for r in seat_rows if r['dist_1_m'] is None),
         'nearest_exit_m': {'max': max(d1) if d1 else None, 'median': float(np.median(d1)) if d1 else None},
         'second_exit_m': {'max': max(d2) if d2 else None, 'median': float(np.median(d2)) if d2 else None},
         f'seats_over_{lim:.0f}_m_to_nearest': sum(1 for v in d1 if v > lim), f'seats_over_{lim0:.0f}_m_to_nearest': sum(1 for v in d1 if v > lim0),
         'farthest_seat': far, 'limit_m': lim, 'limit_unsprinklered_m': lim0, 'limit_note': EX.get('nbc_note', '')}

# ------------------------------------------------------------- entries: lift banks, lobby, reception, front door
lw = [t for t in txt if re.search(r'LIFT-?WELL', t['t'], re.I) and not nd.contains(Point(t['x'], t['y']))]
banks = []
for t in lw:
    b = next((b for b in banks if any(math.dist((t['x'], t['y']), q) < 8 for q in b)), None)
    (b.append((t['x'], t['y'])) if b else banks.append([(t['x'], t['y'])]))
lobbies = [t for t in txt if re.fullmatch(r'(MAIN )?LOBBY|LIFT LOBBY|SERVICE LOBBY', t['t'], re.I) and not nd.contains(Point(t['x'], t['y']))]
rec = [r for r in R['rooms'] if r['kind'] == 'reception']
entries = {'lift_banks': [], 'reception': None}
if rec:
    rr = max(rec, key=lambda r: r['area_m2']); rp = rr['label_xy'] or list(mk(rr['poly']).centroid.coords)[0]
    entries['reception'] = {'name': rr['name'], 'at': [round(rp[0], 1), round(rp[1], 1)], 'area_m2': rr['area_m2']}
    src = snap(*rp); Drec, Prec = dijkstra(src, parent=True) if src else (None, None)
doors = R['doors']
for b in banks:
    cx = sum(q[0] for q in b) / len(b); cy = sum(q[1] for q in b) / len(b)
    lob = min(lobbies, key=lambda t: math.dist((t['x'], t['y']), (cx, cy)), default=None)
    lob = lob if lob and math.dist((lob['x'], lob['y']), (cx, cy)) < 12 else None
    start = snap(lob['x'], lob['y']) if lob else snap(cx, cy, 4.0)
    ent = {'lifts': len(b), 'at': [round(cx, 1), round(cy, 1)], 'lobby_label': f"{lob['t']} ({lob['x']:.1f}, {lob['y']:.1f})" if lob else None,
           'reachable': start is not None}
    if rec and src and start and not math.isfinite(Drec[start]):     # the lift bank's own cell may sit in a pocket between shafts
        i, j = start; kk = int(1.5 / G)
        cand = [(math.hypot(a_ - i, b_ - j), (a_, b_)) for a_ in range(max(0, i - kk), min(ny, i + kk + 1)) for b_ in range(max(0, j - kk), min(nx, j + kk + 1)) if math.isfinite(Drec[a_, b_])]
        if cand: start = min(cand)[1]; ent['start_moved_m'] = round(min(cand)[0] * G, 1)
    if rec and src and start and math.isfinite(Drec[start]):
        path = [start]; c = start
        while c != src and c in Prec: c = Prec[c]; path.append(c)
        pl = LineString([(xs[j], ys[i]) for i, j in path]) if len(path) > 1 else None
        crossed = []
        if pl:
            for dd in doors:
                o = dd['opening']; seg = LineString([o[:2], o[2:]])
                if seg.distance(pl) < 0.25:
                    crossed.append((pl.project(seg.centroid), dd))
        crossed.sort(key=lambda t: t[0])
        ent['walk_to_reception_m'] = round(float(Drec[start]), 1)
        ent['doors_on_route'] = [{'at': [round(dd['c'][0], 1), round(dd['c'][1], 1)], 'block': dd['block'], 'width_m': dd['width_m']} for _, dd in crossed]
        ent['front_door'] = ent['doors_on_route'][0] if ent['doors_on_route'] else None
        ent['_path'] = [[round(xs[j], 2), round(ys[i], 2)] for i, j in path[::3]]
    entries['lift_banks'].append(ent)

res = {'grid_m': G, 'walkable_m2': round(float(M.sum()) * G * G, 1), 'exits': [{k: v for k, v in e.items() if not k.startswith('_')} for e in exits],
       'fire_exit_doors': [f"{t['t']} ({t['x']:.1f}, {t['y']:.1f})" for t in fire_exit],
       'fire_rescue_balconies': [f"({t['x']:.1f}, {t['y']:.1f})" for t in balc], 'stats': stats, 'entries': entries,
       'method': __doc__.split('\n\n')[1].replace('\n', ' ')}
json.dump(res, open(os.path.join(a.work, 'egress.json'), 'w'), indent=1)
with open(outname(a, '_egress.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(seat_rows[0].keys())); w.writeheader(); [w.writerow(r) for r in seat_rows]
# picture: distance to the nearest exit
Dmin = np.min(np.stack(list(DF.values())), axis=0) if DF else np.full((ny, nx), np.inf)
fig, ax = plt.subplots(figsize=(10, 10 * (y1 - y0) / max(x1 - x0, 1)), dpi=110)
Z = np.where(np.isfinite(Dmin), Dmin, np.nan)
im = ax.imshow(Z, origin='lower', extent=(x0, x0 + nx * G, y0, y0 + ny * G), cmap='RdYlGn_r', vmin=0, vmax=max(lim, np.nanmax(Z) if np.isfinite(np.nanmax(Z)) else lim))
for l in lines: ax.plot(*l.xy, color='k', lw=0.3)
for e in exits:
    ax.add_patch(plt.Polygon(list(Polygon.from_bounds(*e['bbox']).exterior.coords), fill=False, ec='b' if e['reachable'] else '#999', lw=1))
    ax.text(e['c'][0], e['c'][1], e['id'], color='b' if e['reachable'] else '#999', fontsize=7, ha='center', weight='bold')
for b in entries['lift_banks']:
    if b.get('_path'): ax.plot(*zip(*b['_path']), color='m', lw=1.2)
if far: ax.plot(far['x_m'], far['y_m'], 'k*', ms=10)
plt.colorbar(im, ax=ax, shrink=0.5, label='walk to nearest exit stair (m)')
ax.set_aspect('equal'); ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_title(f"{C['name']}: walking distance to the nearest exit")
fig.savefig(outname(a, '_egress.png'), bbox_inches='tight'); plt.close(fig)
print(json.dumps(stats, indent=1, default=str)[:1500]); print(json.dumps({k: v for k, v in entries.items()}, default=str)[:1500])
