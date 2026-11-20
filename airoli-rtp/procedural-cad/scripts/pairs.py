"""Step 1. Find every wall-like line pair in the drawing and collect the evidence around it.

Reads the flattened drawing and writes <work>/pieces.json:
  pieces   : one record per strip of wall between two parallel lines (straight) or two concentric arcs (curved):
             axis (centre line), thickness (= line spacing), the two face entities (handles, layers, top block),
             wall-hatch lines and hatch fills inside the strip, texts within reach, column overlap.
  unpaired : wall-layer lines longer than 0.3 m that have no parallel partner (no thickness can be measured).
  columns  : closed outlines on the column layers (deduplicated), with their solid hatch.
  doors    : every door block instance with its leaf width, hinge and swing (from the swing arc).
Nothing is typed here; typing is done by infer.py from rules.json.

    python -I pairs.py <flat.json.gz> <work_dir>
"""
import math, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # our own code folder only (-I drops it)
import numpy as np
from shapely.geometry import Polygon, Point, LineString, box as sbox
from shapely.strtree import STRtree
from shapely.ops import unary_union
from lib import load_json, save_json, cfg, rules, inbox, centroid, pts_of, seg_len

FLAT, WORK = sys.argv[1], sys.argv[2]
C = cfg(); R = rules()
d = load_json(FLAT)
WIN = C['plan_window_m']; OFFER = C['offer_clip_m']
P = R['pairing']
WALL_LAYERS = set(P['wall_layers'])
recs = d['rec']
byid = {r['id']: r for r in recs if r['t'] == 'INSERT'}


def top_insert(r):
    if not r['ch']:
        return None
    t = byid[r['ch'][0]]
    return {'name': t['name'], 'handle': t['h'], 'layer': t['L']}


# ---------------------------------------------------------------- straight segments and arcs
segs = []          # (layer, a, b, handle, top)
arcs = []          # (layer, cx, cy, r, a0, a1, handle, top)
for r in recs:
    L = r['L']
    if r['t'] == 'INSERT' or L not in WALL_LAYERS:
        continue
    pts = pts_of(r)
    if not pts:
        continue
    cx, cy = centroid(pts)
    if not inbox(cx, cy, WIN):
        continue
    top = top_insert(r)
    if r['t'] == 'ARC' and r.get('arc'):
        ax, ay, rad, a0, a1 = r['arc']
        if rad > 0.3:
            arcs.append((L, ax, ay, rad, a0, a1, r['h'], top, pts))
            continue
    if r['t'] in ('LINE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE', 'ELLIPSE', 'ARC'):   # curves as their chords
        for a, b in zip(pts[:-1], pts[1:]):
            if seg_len(a, b) >= P['min_segment_m']:
                segs.append((L, a, b, r['h'], top))

TH = {L: tuple(v) for L, v in P['thickness_range_m'].items()}
arc_pieces = []
# concentric arcs
arc_used = set()
for i, a in enumerate(arcs):
    best = None
    for j, b in enumerate(arcs):
        if j == i or b[0] != a[0]:
            continue
        lo_t, hi_t = TH.get(a[0], TH['_default'])
        if math.hypot(a[1] - b[1], a[2] - b[2]) > P['arc_centre_tol_m']:
            continue
        dr = abs(a[3] - b[3])
        if not (lo_t <= dr <= hi_t):
            continue
        if best is None or dr < best[1]:
            best = (j, dr)
    if best is None:
        continue
    j, dr = best
    key = (min(i, j), max(i, j))
    if key in arc_used:
        continue
    arc_used.add(key)
    b = arcs[j]
    rm = (a[3] + b[3]) / 2
    # angular overlap (degrees, ezdxf counter-clockwise)
    def span(x):
        s, e = x[4] % 360, x[5] % 360
        if e <= s: e += 360
        return s, e
    s1, e1 = span(a); s2, e2 = span(b)
    best_ov = None
    for k in (-360, 0, 360):
        lo, hi = max(s1, s2 + k), min(e1, e2 + k)
        if hi > lo and (best_ov is None or hi - lo > best_ov[1] - best_ov[0]):
            best_ov = (lo, hi)
    if best_ov is None:
        continue
    lo, hi = best_ov
    nseg = max(2, int(math.ceil(math.radians(hi - lo) * rm / P['arc_facet_m'])))
    cx, cy = (a[1] + b[1]) / 2, (a[2] + b[2]) / 2
    axis = [[round(cx + rm * math.cos(math.radians(lo + (hi - lo) * k / nseg)), 4), round(cy + rm * math.sin(math.radians(lo + (hi - lo) * k / nseg)), 4)] for k in range(nseg + 1)]
    arc_pieces.append({'kind': 'arc', 'layer': a[0], 'axis': axis, 'thickness_m': round(dr, 4), 'length_m': round(math.radians(hi - lo) * rm, 4),
                   'arc': {'centre': [round(cx, 4), round(cy, 4)], 'r_m': round(rm, 4), 'a0_deg': round(lo, 3), 'a1_deg': round(hi, 3)},
                   'faces': [{'handle': a[6], 'layer': a[0], 'top': a[7]}, {'handle': b[6], 'layer': b[0], 'top': b[7]}]})

paired_arcs = {k for key in arc_used for k in key}
for i, a in enumerate(arcs):            # arcs with no concentric partner: use their chords like straight lines
    if i not in paired_arcs:
        for p0, p1 in zip(a[8][:-1], a[8][1:]):
            if seg_len(p0, p1) >= P['min_segment_m']:
                segs.append((a[0], p0, p1, a[6], a[7]))

A = np.array([[s[1][0], s[1][1], s[2][0], s[2][1]] for s in segs])
dv = A[:, 2:] - A[:, :2]; Ls = np.hypot(dv[:, 0], dv[:, 1]); U = dv / Ls[:, None]
ANG = np.mod(np.arctan2(U[:, 1], U[:, 0]), np.pi)
MID = (A[:, :2] + A[:, 2:]) / 2
layer_idx = np.array([s[0] for s in segs])
TH = {L: tuple(v) for L, v in P['thickness_range_m'].items()}
ANG_TOL = math.radians(P['parallel_tol_deg'])

pieces = []; seen = set(); partnered = np.zeros(len(segs), bool)
for i in range(len(segs)):
    if Ls[i] < P['min_pair_overlap_m']:
        continue
    Li = segs[i][0]; lo_t, hi_t = TH.get(Li, TH['_default'])
    da = np.abs(ANG - ANG[i]); da = np.minimum(da, np.pi - da)
    cand = np.where((da < ANG_TOL) & (layer_idx == Li))[0]
    n = np.array([-U[i, 1], U[i, 0]])
    best = {+1: None, -1: None}
    for j in cand:
        if j == i:
            continue
        off = (MID[j] - A[i, :2]) @ n
        if not (lo_t <= abs(off) <= hi_t):
            continue
        t0 = (A[j, :2] - A[i, :2]) @ U[i]; t1 = (A[j, 2:] - A[i, :2]) @ U[i]
        lo, hi = max(0.0, min(t0, t1)), min(Ls[i], max(t0, t1))
        if hi - lo < P['min_pair_overlap_m']:
            continue
        side = 1 if off > 0 else -1
        if best[side] is None or abs(off) < abs(best[side][1]) - 1e-6:
            best[side] = (j, off, lo, hi)
    for side, b in best.items():
        if b is None:
            continue
        j, off, lo, hi = b
        key = (min(i, j), max(i, j))
        if key in seen:
            continue
        seen.add(key); partnered[i] = partnered[j] = True
        p0 = A[i, :2] + U[i] * lo + n * off / 2; p1 = A[i, :2] + U[i] * hi + n * off / 2
        pieces.append({'kind': 'straight', 'layer': Li, 'axis': [[round(p0[0], 4), round(p0[1], 4)], [round(p1[0], 4), round(p1[1], 4)]],
                       'thickness_m': round(abs(off), 4), 'length_m': round(hi - lo, 4),
                       'faces': [{'handle': segs[i][3], 'layer': Li, 'top': segs[i][4]}, {'handle': segs[j][3], 'layer': segs[j][0], 'top': segs[j][4]}]})

pieces += arc_pieces
# ---------------------------------------------------------------- merge exact collinear duplicates (same layer)
def piece_poly(pc):
    return LineString(pc['axis']).buffer(pc['thickness_m'] / 2, cap_style=2, join_style=2)


MINLEN = P.get('min_length_m_by_layer', {})
pieces = [pc for pc in pieces if pc['length_m'] >= MINLEN.get(pc['layer'], 0)]
merged = []
groups = collections.defaultdict(list)
for pc in pieces:
    if pc['kind'] != 'straight':
        merged.append(pc); continue
    (x0, y0), (x1, y1) = pc['axis']
    a = math.atan2(y1 - y0, x1 - x0) % math.pi
    n = (-math.sin(a), math.cos(a))
    off = x0 * n[0] + y0 * n[1]
    groups[(pc['layer'], round(a / math.radians(0.5)), round(off / 0.01), round(pc['thickness_m'] / 0.005))].append((pc, a))
for key, items in groups.items():
    a = items[0][1]; u = (math.cos(a), math.sin(a))
    iv = []
    for pc, _ in items:
        t = sorted([p[0] * u[0] + p[1] * u[1] for p in pc['axis']])
        iv.append((t[0], t[1], pc))
    iv.sort(key=lambda x: x[0])
    cur = None
    for t0, t1, pc in iv:
        if cur and t0 <= cur['t1'] + 0.005:
            if t1 > cur['t1']:
                cur['t1'] = t1
            cur['faces'] += [f for f in pc['faces'] if f['handle'] not in {g['handle'] for g in cur['faces']}]
        else:
            if cur: merged.append(cur['pc'] | {'_t': (cur['t0'], cur['t1'], a), 'faces': cur['faces']})
            cur = {'t0': t0, 't1': t1, 'pc': pc, 'faces': list(pc['faces'])}
    if cur: merged.append(cur['pc'] | {'_t': (cur['t0'], cur['t1'], a), 'faces': cur['faces']})
for pc in merged:
    if '_t' in pc:
        t0, t1, a = pc.pop('_t')          # a: the group's direction (mod 180 deg), the one t0/t1 were measured on
        (x0, y0), (x1, y1) = pc['axis']
        u = (math.cos(a), math.sin(a))
        s0 = x0 * u[0] + y0 * u[1]
        p0 = (x0 + (t0 - s0) * u[0], y0 + (t0 - s0) * u[1]); p1 = (x0 + (t1 - s0) * u[0], y0 + (t1 - s0) * u[1])
        pc['axis'] = [[round(p0[0], 4), round(p0[1], 4)], [round(p1[0], 4), round(p1[1], 4)]]
        pc['length_m'] = round(t1 - t0, 4)
pieces = merged

# ---------------------------------------------------------------- columns (closed outlines + solid column hatch)
col_polys = []
for r in recs:
    if r['L'] not in R['columns']['layers'] or r['t'] == 'INSERT':
        continue
    rings = r['rings'] if r['t'] == 'HATCH' else ([r['p']] if r['t'] in ('LWPOLYLINE', 'POLYLINE', 'CIRCLE') and r.get('p') and (r.get('closed') or r['t'] == 'CIRCLE') else [])
    for ring in rings:
        if len(ring) < 4:
            continue
        try:
            pg = Polygon(ring).buffer(0)
        except Exception:
            continue
        if pg.is_empty or not inbox(pg.centroid.x, pg.centroid.y, WIN):
            continue
        if not (R['columns']['min_area_m2'] <= pg.area <= R['columns']['max_area_m2']):
            continue
        col_polys.append((pg, r))
cols = []
for pg, r in sorted(col_polys, key=lambda x: -x[0].area):
    hit = None
    for c in cols:
        if c['_pg'].intersection(pg).area > 0.6 * min(c['_pg'].area, pg.area):
            hit = c; break
    if hit:
        hit['evidence'].append({'handle': r['h'], 'layer': r['L'], 'type': r['t'], 'pattern': r.get('pat'), 'solid': r.get('solid')})
        continue
    cols.append({'_pg': pg, 'evidence': [{'handle': r['h'], 'layer': r['L'], 'type': r['t'], 'pattern': r.get('pat'), 'solid': r.get('solid')}]})
for k, c in enumerate(cols):
    pg = c.pop('_pg')
    c['id'] = f'C{k + 1:03d}'
    c['poly'] = [[round(x, 4), round(y, 4)] for x, y in list(pg.exterior.coords)[:-1]]
    c['area_m2'] = round(pg.area, 4); c['_pg'] = pg
    mr = pg.minimum_rotated_rectangle
    xs, ys = mr.exterior.coords.xy
    e = sorted([seg_len((xs[i], ys[i]), (xs[i + 1], ys[i + 1])) for i in range(2)])
    c['size_m'] = [round(e[0], 3), round(e[1], 3)]
    c['round'] = bool(abs(pg.area - math.pi * (e[0] / 2) ** 2) < 0.08 * pg.area)

col_tree = STRtree([c['_pg'] for c in cols])

# ---------------------------------------------------------------- evidence: hatch lines, hatch fills, texts
H = R['hatch']
hatch_pts = [];
for r in recs:
    if r['L'] in H['hatch_line_layers'] and r['t'] == 'LINE':
        (a, b) = r['p']
        hatch_pts.append(Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
hp_tree = STRtree(hatch_pts) if hatch_pts else None
fills = []
for r in recs:
    if r['t'] != 'HATCH' or not r['rings']:
        continue
    for ring in r['rings']:
        try:
            pg = Polygon(ring).buffer(0)
        except Exception:
            continue
        if not pg.is_empty and inbox(pg.centroid.x, pg.centroid.y, WIN):
            fills.append((pg, r))
fill_tree = STRtree([f[0] for f in fills]) if fills else None
texts = [r for r in recs if r['t'] in ('TEXT', 'MTEXT') and inbox(r['p'][0], r['p'][1], WIN)]
txt_tree = STRtree([Point(*t['p']) for t in texts])

out_pieces = []
for k, pc in enumerate(pieces):
    pg = piece_poly(pc)
    if pg.is_empty:
        continue
    # inside a column outline: this is the column's own outline, not a wall
    inside_col = 0.0
    for ci in col_tree.query(pg):
        inside_col = max(inside_col, cols[ci]['_pg'].intersection(pg).area / pg.area)
    pc['in_column_frac'] = round(inside_col, 3)
    shrunk = pg.buffer(-0.004)
    nh = 0
    if hp_tree is not None and not shrunk.is_empty:
        nh = sum(1 for qi in hp_tree.query(shrunk) if shrunk.contains(hatch_pts[qi]))
    pc['hatch_lines'] = nh
    pc['hatch_lines_per_m'] = round(nh / max(pc['length_m'], 0.01), 2)
    fl = []
    if fill_tree is not None:
        for fi in fill_tree.query(pg):
            f, r = fills[fi]
            ov = f.intersection(pg).area / pg.area
            if ov > 0.05:
                fl.append({'handle': r['h'], 'layer': r['L'], 'pattern': r['pat'], 'solid': r['solid'], 'top': (top_insert(r) or {}).get('name'), 'cover': round(ov, 2)})
    pc['hatch_fills'] = fl
    near = []
    for ti in txt_tree.query(pg.buffer(R['text']['reach_m'])):
        t = texts[ti]
        near.append({'handle': t['h'], 'layer': t['L'], 'text': t['txt'][:60], 'dist_m': round(pg.distance(Point(*t['p'])), 2)})
    pc['texts'] = sorted(near, key=lambda x: x['dist_m'])[:3]
    cx, cy = pg.centroid.x, pg.centroid.y
    pc['in_offer'] = inbox(cx, cy, OFFER)
    pc['centre'] = [round(cx, 3), round(cy, 3)]
    out_pieces.append(pc)

# coincident pieces of different layers (e.g. a glass line drawn on top of a partition line)
polys = [piece_poly(pc) for pc in out_pieces]
tree = STRtree(polys)
for i, pc in enumerate(out_pieces):
    co = []
    for j in tree.query(polys[i].buffer(P['coincident_reach_m'])):
        if j == i or out_pieces[j]['layer'] == pc['layer']:
            continue
        inter = polys[i].buffer(P['coincident_reach_m']).intersection(polys[j])
        if inter.is_empty:
            continue
        # overlap length along this piece
        ov = inter.area / max(out_pieces[j]['thickness_m'], 0.005)
        if ov >= P['coincident_min_overlap_m']:
            co.append({'piece': int(j), 'layer': out_pieces[j]['layer'], 'thickness_m': out_pieces[j]['thickness_m'], 'overlap_m': round(min(ov, pc['length_m']), 2)})
    pc['coincident'] = co
for i, pc in enumerate(out_pieces):
    pc['pid'] = i

# unpaired wall-layer lines (no thickness measurable)
unpaired = []
for i in range(len(segs)):
    if not partnered[i] and Ls[i] >= 0.3:
        unpaired.append({'layer': segs[i][0], 'handle': segs[i][3], 'top': (segs[i][4] or {}).get('name'), 'length_m': round(float(Ls[i]), 3),
                         'a': [round(float(A[i, 0]), 3), round(float(A[i, 1]), 3)], 'b': [round(float(A[i, 2]), 3), round(float(A[i, 3]), 3)],
                         'in_offer': inbox(float(MID[i, 0]), float(MID[i, 1]), OFFER)})

# ---------------------------------------------------------------- door blocks
DB = R['door_blocks']
doors = []
kids = collections.defaultdict(list)
for r in recs:
    if r['ch'] and r['t'] != 'INSERT':
        kids[r['ch'][0]].append(r)
for r in recs:
    if r['t'] != 'INSERT' or r['depth'] != 0:
        continue
    key = f"{r['name']}@{r['L']}"
    rule = DB.get(key) or DB.get(r['name'])
    if not rule or not inbox(r['p'][0], r['p'][1], WIN):
        continue
    ch = kids[r['id']]
    swing = [c for c in ch if c['t'] == 'ARC' and c.get('arc')]
    allp = [q for c in ch for q in pts_of(c)]
    xs = [q[0] for q in allp]; ys = [q[1] for q in allp]
    rec = {'handle': r['h'], 'block': r['name'], 'layer': r['L'], 'insert': r['p'], 'rot_deg': r['rot'], 'scale': [r['sx'], r['sy']],
           'bbox': [round(min(xs), 4), round(min(ys), 4), round(max(xs), 4), round(max(ys), 4)] if xs else None, 'rule_key': key if key in DB else r['name'],
           'in_offer': inbox(r['p'][0], r['p'][1], OFFER), 'swings': []}
    for s in swing:
        cx, cy, rad, a0, a1 = s['arc']
        sweep = (a1 - a0) % 360
        rec['swings'].append({'handle': s['h'], 'hinge': [round(cx, 4), round(cy, 4)], 'r_m': round(rad, 4), 'a0': round(a0, 2), 'a1': round(a1, 2), 'sweep_deg': round(sweep, 1)})
    doors.append(rec)

for c in cols:
    c.pop('_pg', None)
    c['in_offer'] = inbox(*centroid(c['poly']), OFFER)
save_json({'pieces': out_pieces, 'unpaired': unpaired, 'columns': cols, 'doors': doors,
           'counts': {'segments': len(segs), 'arcs': len(arcs), 'pieces': len(out_pieces), 'unpaired_lines': len(unpaired), 'columns': len(cols), 'doors': len(doors)}},
          WORK + '/pieces.json')
print('segments', len(segs), 'arcs', len(arcs), 'pieces', len(out_pieces), 'unpaired', len(unpaired), 'columns', len(cols), 'doors', len(doors))
