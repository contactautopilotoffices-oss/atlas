"""CAD layout -> twin layout for the Blender builder (Reliable Tech Park and any plan that needs it).

The CAD pipeline's layout is in the plan frame (metres from the plan window's corner, CAD axes). The twin
needs more than the CAD read did, and in the building's shared frame:

1. The offer only: the plate is cut to the plan's unit (tenant json `egress_poly_m`, else `offer_poly_m`
   / `offer_clip_m`, minus `not_demised`), so the model holds the offered space, its lobby and its cores.
2. Desks and tables from the CAD geometry: desks drawn as loose polylines (rooms.json `desk_shapes`:
   rectangles become `desks`, the 120-degree V desks become `desk_polys` with their exact outline), tables
   from table blocks (their own geometry, nested chairs left out) and from loose closed polylines on the
   `twin.table_layers` (narrow training tables, cabin desks). Chairs are turned to face their desk or table.
3. Heights from the tenant json `twin.heights` (ceiling, soffit, floor to floor, finished floor level).
4. The frame: every coordinate goes through the 2x3 matrix from CAD metres to `rtp_local` (x east, y north,
   metres from the Maps pin; airoli-rtp/review/frames.json), angles turn with it, boxes are re-boxed. The
   model is then north up and near the origin, so `site_fit.rot_deg = 0`. The CAD plan frame stays in the
   CAD outputs (the G0 proofs); the matrix is written into the layout's `frame`.

usage: python -I twin_layout.py --tenant rtp6-a --floor 6 --out airoli-rtp/rtp6-a --frames .../frames.json
Writes <out>/<tenant>-floor<n>.twin.layout.json and <out>/<tenant>_twin_layout_report.json.
"""
import json, os, sys, math, collections, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon, Point, LineString, box, MultiPolygon
from shapely.ops import unary_union
from common import args, load_flat, Frame, outname, offer_clip, is_poly

a = args([(('--frames',), {'required': True}), (('--frame-key',), {'default': None})])
C = a.cfg; F = Frame(C); TW = C.get('twin', {})
L = json.load(open(outname(a, f"-floor{a.floor}.layout.json")))
R = json.load(open(os.path.join(a.work, 'rooms.json'))); I = json.load(open(os.path.join(a.work, 'inst.json')))
d = load_flat(a)['rec']
rep = collections.OrderedDict()
mk = lambda p, h=None: Polygon(p, h or []).buffer(0)

# ------------------------------------------------------------------ 1. the offer
plate = mk(L['plate'])
if C.get('egress_poly_m'): region = Polygon(C['egress_poly_m']).buffer(0)
else:
    region = offer_clip(C) or plate.buffer(1)
    nd = unary_union([mk(n['poly'], n.get('holes')) for n in R['not_demised']]) if R['not_demised'] else Polygon()
    region = region.difference(nd.buffer(0.02))
cut = plate.intersection(region)
cut = max(cut.geoms, key=lambda g: g.area) if isinstance(cut, MultiPolygon) else cut
cut = cut.simplify(0.01)
inside = lambda x, y, pad=0.3: cut.buffer(pad).contains(Point(x, y))
ring = lambda g: [[round(x, 3), round(y, 3)] for x, y in list(g.exterior.coords)[:-1]]
L['shell']['outline'] = ring(cut); L['plate'] = ring(cut)
L['floor'] = [{'outer': ring(cut), 'holes': []}]
def clip_polys(items):
    out = []
    for w in items:
        g = mk(w['outer'], w.get('holes')).intersection(cut.buffer(0.05))
        for p in getattr(g, 'geoms', [g]):
            if p.geom_type == 'Polygon' and p.area > 0.004:
                out.append({'outer': ring(p), 'holes': [[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in p.interiors]})
    return out
L['walls'] = clip_polys(L['walls']); L['skirting'] = clip_polys(L.get('skirting', []))
L['glass'] = [g for g in L['glass'] if inside((g[0] + g[2]) / 2, (g[1] + g[3]) / 2, 0.6)]
L['columns'] = [c for c in L['columns'] if inside(*mk(c).centroid.coords[0], 0.2)]
rooms = []
for r in L['rooms']:
    g = mk(r['poly'], r.get('holes')).intersection(cut)
    if g.is_empty or g.area < 0.3: continue
    g = max(g.geoms, key=lambda q: q.area) if hasattr(g, 'geoms') else g
    if g.geom_type != 'Polygon': continue
    r = dict(r, poly=ring(g), holes=[[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in g.interiors]); r['box'] = list(g.bounds)
    rooms.append(r)
L['rooms'] = rooms
for k in ('doors', 'fixtures'): L[k] = [o for o in L[k] if inside(*o['c'])]
for k in ('seats', 'plants', 'labels'): L[k] = [o for o in L[k] if inside(o['x'], o['y'])]
L['desks'] = [o for o in L['desks'] if inside(*o['c'])]
L['lifts'] = [p for p in L.get('lifts', []) if inside(*p)]
L['stairs_all'] = [s for s in L.get('stairs_all', []) if inside((s['bbox'][0] + s['bbox'][2]) / 2, (s['bbox'][1] + s['bbox'][3]) / 2, 1.0)]
L['extra_rooms'] = [e for e in L.get('extra_rooms', []) if inside((e['box'][0] + e['box'][2]) / 2, (e['box'][1] + e['box'][3]) / 2)]
if isinstance(L.get('circulation'), dict):
    pol = []
    for c in L['circulation']['polygons']:
        g = mk(c['poly'], c.get('holes')).intersection(cut)
        if not g.is_empty and g.area > 1.0:
            g = max(g.geoms, key=lambda q: q.area) if hasattr(g, 'geoms') else g
            if g.geom_type == 'Polygon': pol.append(dict(c, poly=ring(g), holes=[]))
    L['circulation']['polygons'] = pol
    L['circulation']['passages'] = [p for p in L['circulation'].get('passages', []) if inside(p['x'], p['y'])]
for k in ('not_demised', 'closures', 'demise', 'zones'): L.pop(k, None)
sh = L['shell']; sh['columns'] = L['columns']
sh['core'] = [c for c in sh.get('core', []) if inside(*mk(c['poly']).centroid.coords[0])]
sh['stairs'] = L['stairs_all']
if isinstance(sh.get('lifts'), dict):
    sh['lifts']['labels'] = [p for p in sh['lifts'].get('labels', []) if inside(*p)]
    sh['lifts']['shafts'] = [s for s in sh['lifts'].get('shafts', []) if inside(*mk(s['poly']).centroid.coords[0])] if sh['lifts'].get('shafts') and isinstance(sh['lifts']['shafts'][0], dict) and 'poly' in sh['lifts']['shafts'][0] else sh['lifts'].get('shafts', [])
rep['offer'] = {'area_m2': round(cut.area, 1), 'how': 'egress_poly_m' if C.get('egress_poly_m') else ('offer outline' if offer_clip(C) is not None else 'plate minus not demised'),
                'rooms': len(rooms), 'walls': len(L['walls']), 'glass': len(L['glass']), 'doors': len(L['doors']), 'seats': len(L['seats'])}

# ------------------------------------------------------------------ 2. desks and tables from the CAD geometry
def mrr(g):
    r = g.minimum_rotated_rectangle; c = list(r.exterior.coords)[:4]
    e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1]); e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1]); l1, l2 = math.hypot(*e1), math.hypot(*e2)
    ang = math.atan2(e1[1], e1[0]) if l1 >= l2 else math.atan2(e2[1], e2[0])
    return [round(r.centroid.x, 3), round(r.centroid.y, 3)], round(max(l1, l2), 3), round(min(l1, l2), 3), round(ang, 4)
have = [Point(o['c']) for o in L['desks']]
dp = []; nrect = 0
for ds in R.get('desk_shapes', []):
    g = mk(ds['poly'])
    if not inside(g.centroid.x, g.centroid.y, 0) or any(g.contains(p) for p in have): continue
    rect_like = g.area / g.minimum_rotated_rectangle.area > 0.95
    if rect_like:
        c, w_, d_, an = mrr(g); L['desks'].append({'c': c, 'w': w_, 'd': d_, 'a': an, 'kind': f"{ds['name']} (drawn)", 'workstation': True, 'h': L['heights']['desk'], 'block': 'deskshape'}); nrect += 1
    else:
        dp.append({'poly': ring(g.simplify(0.003)), 'kind': f"{ds['name']} (drawn)", 'h': L['heights']['desk'], 'block': 'deskpoly'})
L['desk_polys'] = dp
# table blocks: the block's own geometry, nested chair instances left out
TB = set(C.get('tables', {})) | set(TW.get('table_blocks', []))
CH = set(C.get('chairs', {}))
ins = {o['id']: o for o in I}
chair_ids = {o['id'] for o in I if o['name'] in CH}
tb_ids = {o['id']: o for o in I if o['name'] in TB}
pts = collections.defaultdict(list)
if tb_ids:
    for r in d:
        if not is_poly(r) or not r['ch']: continue
        hit = [i for i in r['ch'] if i in tb_ids]
        if not hit or any(i in chair_ids for i in r['ch'][r['ch'].index(hit[0]) + 1:]): continue
        pts[hit[0]] += [F.m(*q) for q in r['p']]
tables = []
for i, P in pts.items():
    if len(P) < 3: continue
    g = Polygon(P).convex_hull if len(P) > 2 else None
    if g is None or g.area < 0.1 or not inside(g.centroid.x, g.centroid.y): continue
    if any(g.buffer(0.05).contains(Point(t_['c'])) for t_ in L['desks']): continue
    nm = tb_ids[i]['name']; round_ = 4 * math.pi * g.area / g.length ** 2 > 0.85
    rr = next((x for x in L['rooms'] if mk(x['poly']).contains(g.centroid)), None)
    t = {'room': rr['name'] if rr else '', 'block': nm, 'h': L['heights']['desk']}
    if round_: t['circle'] = [round(g.centroid.x, 3), round(g.centroid.y, 3), round(math.sqrt(g.area / math.pi), 3)]
    else: t['poly'] = ring(g.minimum_rotated_rectangle)
    tables.append(t)
# loose closed polylines on the table layers (narrow training tables, cabin desks)
TLY = set(TW.get('table_layers', []))
for r in d:
    if r['t'] != 'LwPolyline' or r['ch'] or r['L'] not in TLY or len(r['p']) < 4 or not F.inwin(r['p'][0]): continue
    g = Polygon([F.m(*q) for q in r['p']]).buffer(0)
    if not (0.3 < g.area < 4.0) or not inside(g.centroid.x, g.centroid.y): continue
    rr = next((x for x in L['rooms'] if mk(x['poly']).contains(g.centroid)), None)
    tables.append({'poly': ring(g.minimum_rotated_rectangle), 'h': L['heights']['desk'], 'room': rr['name'] if rr else '', 'block': f"{r['L']} outline"})
L['tables'] = [t for t in L['tables'] if inside(*(mk(t['poly']).centroid.coords[0] if 'poly' in t else t['circle'][:2]))] + tables
rep['furniture'] = {'desks_from_blocks': len(have), 'desks_from_drawn_rectangles': nrect, 'desk_polys_120deg': len(dp), 'tables': len(L['tables']), 'tables_added': len(tables)}
# chairs face their desk (work seats) or the nearest table
deskc = [(Point(o['c']), mk([[o['c'][0] + math.cos(o['a']) * u - math.sin(o['a']) * v, o['c'][1] + math.sin(o['a']) * u + math.cos(o['a']) * v] for u, v in ((-o['w'] / 2, -o['d'] / 2), (o['w'] / 2, -o['d'] / 2), (o['w'] / 2, o['d'] / 2), (-o['w'] / 2, o['d'] / 2))])) for o in L['desks']]
deskc += [(mk(q['poly']).centroid, mk(q['poly'])) for q in dp]
tabc = [(mk(t['poly']).centroid if 'poly' in t else Point(t['circle'][:2]), mk(t['poly']) if 'poly' in t else Point(t['circle'][:2]).buffer(t['circle'][2])) for t in L['tables']]
turned = 0
for s in L['seats']:
    p = Point(s['x'], s['y']); pool = deskc if s['group'] == 'W' else tabc
    if not pool: continue
    c, g = min(pool, key=lambda t: t[1].distance(p))
    if g.distance(p) < (0.9 if s['group'] == 'W' else 0.8):
        q = g.exterior.interpolate(g.exterior.project(p)) if g.geom_type == 'Polygon' else c
        f = math.atan2(q.y - s['y'], q.x - s['x']) if p.distance(q) > 0.05 else math.atan2(c.y - s['y'], c.x - s['x'])
        s['face'] = round(f, 4); turned += 1
rep['furniture']['chairs_turned_to_desk_or_table'] = turned

# ------------------------------------------------------------------ 3. heights
H = TW.get('heights', {})
for k in ('ceiling', 'wall'):
    if H.get('ceiling') is not None: L['heights'][k] = H['ceiling']
L['heights']['source'] = H.get('source', L['heights'].get('source'))
lvl = TW.get('level', a.floor); ffl = H.get('ffl_base_m', 0.6) + H.get('floor_to_floor', 3.6) * lvl
L['storeys'] = {'count': TW.get('storeys', 'not confirmed'), 'floor_to_floor': H.get('floor_to_floor', 3.6), 'level': lvl, 'ffl_m': round(ffl, 3),
                'source': f"assumed (user instruction, 19 Nov 2026): {H.get('floor_to_floor', 3.6)} m floor to floor; this floor's finished floor level {ffl:.2f} m above ground = {H.get('ffl_base_m', 0.6)} + {H.get('floor_to_floor', 3.6)} x {lvl}"}

# ------------------------------------------------------------------ 4. into rtp_local
FR = json.load(open(a.frames)); key = a.frame_key or a.tenant
Mx = FR['plans'][key]['cad_m_to_rtp_local']; ox, oy = C['origin_in'][0] * F.s, C['origin_in'][1] * F.s
th = math.atan2(Mx[1][0], Mx[0][0])
def tp(x, y):
    X, Y = x + ox, y + oy
    return [round(Mx[0][0] * X + Mx[0][1] * Y + Mx[0][2], 4), round(Mx[1][0] * X + Mx[1][1] * Y + Mx[1][2], 4)]
num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
def rebox(b):
    q = [tp(b[0], b[1]), tp(b[2], b[1]), tp(b[2], b[3]), tp(b[0], b[3])]
    return [min(p[0] for p in q), min(p[1] for p in q), max(p[0] for p in q), max(p[1] for p in q)]
def walk(o, k=None):
    if isinstance(o, dict):
        out = {}
        xy = 'x' in o and 'y' in o and num(o['x']) and num(o['y'])
        if xy: out['x'], out['y'] = tp(o['x'], o['y'])
        for kk, v in o.items():
            if xy and kk in ('x', 'y'): continue
            if kk in ('a', 'face', 'rot') and num(v): out[kk] = round(v + th, 4)
            elif kk in ('box', 'bounds', 'bbox') and isinstance(v, list) and len(v) == 4 and all(num(t) for t in v): out[kk] = rebox(v)
            elif kk == 'opening' and isinstance(v, list) and len(v) == 4 and all(num(t) for t in v): out[kk] = tp(v[0], v[1]) + tp(v[2], v[3])
            elif kk == 'circle' and isinstance(v, list) and len(v) == 3: out[kk] = tp(v[0], v[1]) + [v[2]]
            elif kk in ('about', 'source', 'frame', 'heights', 'storeys', 'ceiling_plan', 'fixtures_about'): out[kk] = v
            else: out[kk] = walk(v, kk)
        return out
    if isinstance(o, list):
        if len(o) == 2 and all(num(t) for t in o): return tp(*o)
        if k == 'glass' and o and isinstance(o[0], list) and len(o[0]) == 5: return [tp(g[0], g[1]) + tp(g[2], g[3]) + [g[4]] for g in o]
        return [walk(v, k) for v in o]
    return o
T = walk(L)
T['site_fit'] = {'rot_deg': 0.0, 'plate_centroid': [0.0, 0.0], 'footprint_centroid': [0.0, 0.0], 'dx': 0.0, 'dy': 0.0,
                 'frame': 'rtp_local', 'note': 'the layout is already in rtp_local (x east, y north, metres from the Maps pin): no turn, no shift'}
T['frame'] = {'name': 'rtp_local', 'about': FR['frame'], 'cad_m_to_rtp_local': Mx, 'plan_key': key, 'rotation_deg': round(math.degrees(th), 4),
              'columns_matched': FR['plans'][key].get('matched'), 'median_residual_m': FR['plans'][key].get('median_residual_m'),
              'cad_plan_origin_m': [ox, oy], 'how': 'rtp_local = M @ [x_plan + origin_x, y_plan + origin_y, 1], metres; the G0 proofs keep the CAD plan frame'}
T['about'] = (L.get('about', '') + f" | TWIN LAYOUT: cut to the offer and turned into rtp_local with {Mx} (CAD metres -> rtp_local), z = 0 at this floor's finished floor level ({ffl:.2f} m above ground).")
T['source'] = dict(L.get('source', {}), twin_layout='noida-skymark/cad/twin_layout.py')
json.dump(T, open(outname(a, f"-floor{a.floor}.twin.layout.json"), 'w'))
xs = [p[0] for p in T['plate']]; ys = [p[1] for p in T['plate']]
rep['frame'] = {'rotation_deg': round(math.degrees(th), 3), 'plate_bounds_rtp_local': [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)], 'ffl_m': ffl}
json.dump(rep, open(outname(a, '_twin_layout_report.json'), 'w'), indent=1)
print(json.dumps(rep, indent=1))
