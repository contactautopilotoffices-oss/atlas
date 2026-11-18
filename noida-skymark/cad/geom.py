"""Geometry extraction shared by the generic pipeline: walls, glass, doors (width + swing),
columns, plate outline, room polygons named from the CAD's own text, desks, chairs.

All functions take the flattened records (flat.json 'rec'), the instance list (inst.json),
the tenant config and a common.Frame. Output coordinates are plan metres (x east, y north
in the drawing), origin at the config's 'origin_in'.
"""
import math, re, collections
from shapely.geometry import LineString, Polygon, Point, box, MultiPolygon, GeometryCollection
from shapely.ops import unary_union, polygonize
from common import IN, is_poly

# ---------------------------------------------------------------- text
def clean_text(t):
    t = re.sub(r'\\[LlOoKk]', '', t or '')
    t = re.sub(r'\\[A-Za-z][^;\\]*;', '', t)
    t = t.replace('\\X', ' ').replace('\n', ' ')
    t = re.sub(r'(?<=\b\w) (?=\w\b)', '', t)          # "W I D E" -> "WIDE"
    return re.sub(r'\s+', ' ', t).strip()


def texts(d, F, layers=None):
    out = []
    for r in d:
        if r['t'] not in ('MText', 'TextEntity') or not r.get('txt'): continue
        if layers and r['L'] not in layers: continue
        if not F.inwin(r['p']): continue
        x, y = F.m(*r['p'])
        out.append({'t': clean_text(r['txt']), 'raw': r['txt'], 'x': x, 'y': y, 'L': r['L'], 'nested': bool(r['ch'])})
    return out


# ---------------------------------------------------------------- walls / glass / columns
def layer_lines(d, F, layers, nested_ok_layers=(), ins=None, door_layers=()):
    """Loose lines on the given layers inside the window, plus lines nested in blocks inserted on
    those layers (e.g. phone booth shells), skipping anything inside a nested door block."""
    ins = ins or {}
    out = []
    for r in d:
        if not is_poly(r) or r['L'] not in layers or r.get('fill'): continue
        if not any(F.inwin(q) for q in r['p']): continue
        if r['ch']:
            top = ins.get(r['ch'][0])
            if not top or top['L'] not in nested_ok_layers: continue
            if any(ins[i]['L'] in door_layers or ins[i]['name'].startswith('*U') for i in r['ch'][1:] if i in ins): continue
        pts = [F.m(*q) for q in r['p']]
        if is_cloud(pts): continue
        if len(pts) > 1: out.append(LineString(pts))
    return out


def is_cloud(pts):
    """Revision clouds (scalloped polylines) are drawn on whatever layer is current; they are not walls.
    A cloud has many vertices and keeps turning sharply (each scallop is an arc ending in a cusp)."""
    if len(pts) < 40: return False
    big = 0
    for a, b, c in zip(pts, pts[1:], pts[2:]):
        u = (b[0] - a[0], b[1] - a[1]); v = (c[0] - b[0], c[1] - b[1])
        nu, nv = math.hypot(*u), math.hypot(*v)
        if nu < 1e-6 or nv < 1e-6: continue
        if (u[0] * v[0] + u[1] * v[1]) / (nu * nv) < math.cos(math.radians(60)): big += 1
    return big >= 8


def extend_ends(l, e=0.25):
    """Stretch an open polyline 0.25 m past both ends so partitions that stop just short of the
    facade or another wall (common drafting habit) still close the room. Closed rings are left alone."""
    c = list(l.coords)
    if len(c) < 2 or c[0] == c[-1]: return l
    def ext(p, q):
        L_ = math.dist(p, q) or 1; return (p[0] + (p[0] - q[0]) / L_ * e, p[1] + (p[1] - q[1]) / L_ * e)
    return LineString([ext(c[0], c[1])] + c[1:-1] + [ext(c[-1], c[-2])])


def wall_solids(lines):
    w = unary_union([l.buffer(0.035, cap_style=3, join_style=2) for l in lines])
    w = w.buffer(0.06, join_style=2).buffer(-0.06, join_style=2).simplify(0.008)
    return [g for g in (w.geoms if hasattr(w, 'geoms') else [w]) if g.area > 0.01]


def glass_segments(d, F, layers):
    glass, seen = [], set()
    for r in d:
        if not is_poly(r) or r['ch'] or r['L'] not in layers or not any(F.inwin(q) for q in r['p']): continue
        P = [F.m(*q) for q in r['p']]
        for a, b in zip(P, P[1:]):
            if math.dist(a, b) < 0.15: continue
            k = tuple(sorted([(round(a[0], 1), round(a[1], 1)), (round(b[0], 1), round(b[1], 1))]))
            if k in seen: continue
            seen.add(k); glass.append([*a, *b, r['L']])
    return glass


def columns(d, F, layers):
    cols = []
    for r in d:
        if is_poly(r) and r['L'] in layers and not r['ch'] and F.inwin(r['p'][0]) and len(r['p']) >= 4:
            P = Polygon([F.m(*q) for q in r['p']]).convex_hull
            if 0.04 < P.area < 1.5 and not any(P.centroid.distance(c) < 0.15 for c in cols): cols.append(P)
    return cols


def rect_of(p):
    r = p.minimum_rotated_rectangle; c = list(r.exterior.coords)[:4]
    e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1]); e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
    l1, l2 = math.hypot(*e1), math.hypot(*e2)
    ang = math.atan2(e1[1], e1[0]) if l1 >= l2 else math.atan2(e2[1], e2[0])
    return {"c": [round(r.centroid.x, 3), round(r.centroid.y, 3)], "w": round(max(l1, l2), 3), "d": round(min(l1, l2), 3), "a": round(ang, 4)}


def plate_outline(d, F, layers):
    pl = [LineString([F.m(*q) for q in r['p']]) for r in d if is_poly(r) and not r['ch'] and r['L'] in layers and len(r['p']) > 1
          and all(F.inwin(q) for q in r['p'])]
    uu = unary_union([l.buffer(0.6) for l in pl])
    big = max(uu.geoms, key=lambda g: g.area) if hasattr(uu, 'geoms') else uu
    return Polygon(big.exterior).buffer(-0.6, join_style=2).simplify(0.05)


def atrium(d, F, layer='RAILING'):
    rl = [LineString([F.m(*q) for q in r['p']]) for r in d if is_poly(r) and r['L'] == layer and not r['ch'] and F.inwin(r['p'][0]) and len(r['p']) > 1]
    # the atrium is drawn as a box with an X across it: find the longest pair of straight railing lines that cross
    straight = sorted([l for l in rl if len(l.coords) == 2], key=lambda l: -l.length)[:8]
    for i, l1 in enumerate(straight):
        for l2 in straight[i + 1:]:
            if l1.crosses(l2):
                a = box(*unary_union([l1, l2]).bounds)
                if a.area > 20: return a
    return None


# ---------------------------------------------------------------- desks drawn as loose geometry
def desk_shapes(d, F, specs):
    """Desks drawn as loose closed polylines (no block), e.g. Reliable Tech Park's 6th floor: the 4'x2'
    straight desks and the 120-degree desks of the Y clusters. Each spec: {layers, verts, area_m2: [lo, hi],
    name, from_lines?}. With from_lines the loose LINE work on those layers is also polygonised, because
    the drafter drew half of the clusters with separate lines. A shape found both ways is counted once.
    Returns [(Polygon in plan metres, name, source)]."""
    out = []
    for sp in specs or []:
        lay = set(sp['layers']); lo, hi = sp['area_m2']; got = []
        def ok(P, n):
            return P.is_valid and lo <= P.area <= hi and (sp.get('verts') is None or n == sp['verts'] - 1)
        for r in d:
            if r['t'] != 'LwPolyline' or r['ch'] or r['L'] not in lay or not F.inwin(r['p'][0]) or len(r['p']) < 4: continue
            P = Polygon([F.m(*q) for q in r['p']])
            if ok(P, len(r['p']) - 1): got.append((P, sp['name'], 'closed polyline'))
        if sp.get('from_lines'):
            # the line work is not noded (ends overshoot or stop short by a few mm), so close it by thickening every
            # line and polyline 6 mm and taking the holes left between them, grown back by the same 6 mm
            segs = [LineString([F.m(*q) for q in r['p']]) for r in d if r['t'] in ('Line', 'LwPolyline') and not r['ch'] and r['L'] in lay and F.inwin(r['p'][0]) and len(r['p']) > 1]
            U = unary_union([g.buffer(0.006) for g in segs])
            for h in (Polygon(h_) for g in getattr(U, 'geoms', [U]) for h_ in g.interiors):
                P = h.buffer(0.006, join_style=2).simplify(0.01)
                if ok(P, len(P.exterior.coords) - 1) and not any(g.centroid.distance(P.centroid) < 0.05 for g, _, _ in got):
                    got.append((P, sp['name'], 'closed by loose lines'))
        out += got
    return out


# ---------------------------------------------------------------- doors
def doors(d, F, I, cfg, by_inst, ins_all):
    """One record per door block instance: leaf rectangle (Volt format: c, w, d, a) plus
    width_m (leaf length), hinge point, swing radius and sweep from the door arc, and the
    opening chord (the line that closes the wall opening, used to split rooms)."""
    names = set(cfg['blocks'].get('doors', []))
    out = []
    for o in I:
        if o['name'] not in names: continue
        best = None
        for r in by_inst[o['id']]:
            if r['t'] in ('Arc',) or len(r['p']) < 4: continue
            P = Polygon([F.m(*q) for q in r['p']])
            if not P.is_valid or P.area <= 0: continue
            rr = rect_of(P)
            if 0.55 < rr['w'] < 1.4 and rr['d'] < 0.12 and (best is None or rr['w'] > best['w']): best = rr
        if best is None:
            segs = [(math.dist(F.m(*a), F.m(*b)), F.m(*a), F.m(*b)) for r in by_inst[o['id']] if r['t'] == 'Line' for a, b in [r['p'][:2]]]
            segs = [x for x in segs if 0.55 < x[0] < 1.4]
            if segs:
                L_, a_, b_ = max(segs)
                best = {"c": [round((a_[0] + b_[0]) / 2, 3), round((a_[1] + b_[1]) / 2, 3)], "w": round(L_, 3), "d": 0.04, "a": round(math.atan2(b_[1] - a_[1], b_[0] - a_[0]), 4)}
        if best is None: continue
        lay = ins_all[o['id']]['L']
        rec = dict(best); rec.update({"glass": lay in ('WS-GLAZ-GLAS', 'WS-DOOR-GLAZ'), "fire": lay == 'WS-DOOR-FIRE', "block": o['name']})
        rec['width_m'] = rec['w']; rec['layer'] = lay; rec['instance'] = o['id']; rec['in_block'] = o['parent']
        # Swing: the leaf is drawn open; the swing arc (an Arc entity or a bulged polyline) is centred on the
        # hinge with radius = leaf length. Score both leaf ends by how many block points lie on such a circle.
        ca, sa = math.cos(rec['a']), math.sin(rec['a']); w = rec['w']
        ends = [(rec['c'][0] - ca * w / 2, rec['c'][1] - sa * w / 2), (rec['c'][0] + ca * w / 2, rec['c'][1] + sa * w / 2)]
        pts = [F.m(*q) for r in by_inst[o['id']] for q in r['p']]
        leaf = LineString(ends)
        off = [q for q in pts if leaf.distance(Point(q)) > 0.05]
        arcs = [r for r in by_inst[o['id']] if r['t'] == 'Arc' and r.get('arc')] if cfg.get('door_from_arc_entity') else []
        arcs = [r for r in arcs if 0.45 < math.dist(F.m(*r['p'][0]), F.m(r['arc'][0], r['arc'][1])) < 1.5]
        if arcs:
            # the threshold line: a straight line in the block, about one leaf long, square to the open leaf and
            # starting at one leaf end (the hinge). Lines survive mirrored inserts; arcs in mirrored blocks
            # come out of the reader on the wrong side of the hinge, so the line wins when there is one.
            ux, uy = math.cos(rec['a']), math.sin(rec['a']); thr = None
            for r in by_inst[o['id']]:
                if r['t'] != 'Line': continue
                a_, b_ = F.m(*r['p'][0]), F.m(*r['p'][1]); L_ = math.dist(a_, b_)
                if not (0.55 < L_ < 1.45) or abs(((b_[0] - a_[0]) * ux + (b_[1] - a_[1]) * uy) / L_) > 0.2: continue
                for E in ends:
                    for P_, Q_ in ((a_, b_), (b_, a_)):
                        if math.dist(P_, E) < 0.15 and (thr is None or L_ > thr[2]): thr = (E, Q_, L_)
            if thr:
                arcs = [dict(arcs[0], arc=[0, 0], _thr=thr)]
        if arcs and arcs[0].get('_thr'):
            E, Q_, _ = arcs[0]['_thr']
            rec['hinge'] = [round(E[0], 3), round(E[1], 3)]; rec['swing_r_m'] = round(math.dist(E, Q_), 3); rec['swing_deg'] = 90.0
            rec['opening'] = [round(E[0], 3), round(E[1], 3), round(Q_[0], 3), round(Q_[1], 3)]
            T = max(ends, key=lambda X: math.dist(X, E)); vx, vy = T[0] - E[0], T[1] - E[1]; v1 = (Q_[0] - E[0], Q_[1] - E[1])
            rec['swing'] = 'ccw' if v1[0] * vy - v1[1] * vx > 0 else 'cw'
            rec['open_leaf_tip'] = [round(T[0], 3), round(T[1], 3)]; rec['how'] = 'threshold line'
            out.append(rec); continue
        if arcs:
            # opt-in (RTP): read the swing straight from the arc entity. Its centre is the hinge; of its two
            # ends, the one away from the open leaf is the closed leaf tip. A double door has two arcs, and
            # its opening runs hinge to hinge.
            hs = []
            for r in arcs[:2]:
                H = F.m(r['arc'][0], r['arc'][1]); e0, e1 = F.m(*r['p'][0]), F.m(*r['p'][-1])
                leaf = LineString(ends)
                A = e0 if leaf.distance(Point(e0)) > leaf.distance(Point(e1)) else e1
                hs.append((H, A))
            H, A = hs[0]
            rec['hinge'] = [round(H[0], 3), round(H[1], 3)]; rec['swing_r_m'] = round(math.dist(H, A), 3); rec['swing_deg'] = 90.0
            o2 = hs[1][0] if len(hs) == 2 and math.dist(hs[0][0], hs[1][0]) > 0.6 else A
            rec['opening'] = [round(H[0], 3), round(H[1], 3), round(o2[0], 3), round(o2[1], 3)]
            T = max(ends, key=lambda E: math.dist(E, H)); vx, vy = T[0] - H[0], T[1] - H[1]; v1 = (A[0] - H[0], A[1] - H[1])
            rec['swing'] = 'ccw' if v1[0] * vy - v1[1] * vx > 0 else 'cw'
            rec['open_leaf_tip'] = [round(T[0], 3), round(T[1], 3)]; rec['how'] = 'arc entity' + (' (double door)' if len(hs) == 2 else '')
            out.append(rec); continue
        tol = cfg.get('door_arc_tol_m', 0.03)       # RTP's glass doors: swing arc drawn 35 mm short of the leaf
        score = [sum(1 for q in off if abs(math.dist(E, q) - w) < tol) for E in ends]
        if max(score) >= 3:
            H, T = (ends[0], ends[1]) if score[0] >= score[1] else (ends[1], ends[0])
            on_arc = [q for q in off if abs(math.dist(H, q) - w) < tol]
            mx = sum(q[0] for q in on_arc) / len(on_arc); my = sum(q[1] for q in on_arc) / len(on_arc)
            vx, vy = T[0] - H[0], T[1] - H[1]
            cands = [(H[0] - vy, H[1] + vx), (H[0] + vy, H[1] - vx)]          # leaf turned +-90 deg about the hinge
            A = min(cands, key=lambda p: math.dist(p, (mx, my)))               # the arc bulges towards the closed end
            rec['hinge'] = [round(H[0], 3), round(H[1], 3)]; rec['swing_r_m'] = round(w, 3); rec['swing_deg'] = 90.0
            rec['opening'] = [round(H[0], 3), round(H[1], 3), round(A[0], 3), round(A[1], 3)]
            v1 = (A[0] - H[0], A[1] - H[1])
            rec['swing'] = 'ccw' if v1[0] * vy - v1[1] * vx > 0 else 'cw'    # closed -> open, seen from above
            rec['open_leaf_tip'] = [round(T[0], 3), round(T[1], 3)]
        else:
            ca, sa = math.cos(rec['a']), math.sin(rec['a'])
            rec['opening'] = [round(rec['c'][0] - ca * rec['w'] / 2, 3), round(rec['c'][1] - sa * rec['w'] / 2, 3),
                              round(rec['c'][0] + ca * rec['w'] / 2, 3), round(rec['c'][1] + sa * rec['w'] / 2, 3)]
            rec['swing'] = 'unknown (no arc in block)'
        out.append(rec)
    return out


# ---------------------------------------------------------------- rooms
def free_space(barrier_lines, door_list, bounds, gap=0.06):
    """Regions enclosed by walls, glass, columns and closed door openings. Lines are thickened by
    `gap` so small drafting gaps close. Returns polygons in plan metres (grown back by `gap`)."""
    extra = []
    for dd in door_list:
        # the closed-leaf chord, stretched 0.3 m past both ends so it reaches the frame / jamb stub
        o = dd['opening']; L_ = math.dist(o[:2], o[2:]) or 1
        ux, uy = (o[2] - o[0]) / L_, (o[3] - o[1]) / L_; e = 0.3
        extra.append(LineString([(o[0] - ux * e, o[1] - uy * e), (o[2] + ux * e, o[3] + uy * e)]))
    W = unary_union([l.buffer(gap, cap_style=2, join_style=2) for l in barrier_lines + extra])
    x0, y0, x1, y1 = bounds
    frame = box(x0 - 2, y0 - 2, x1 + 2, y1 + 2)
    fs = frame.difference(W)
    parts = [g for g in (fs.geoms if hasattr(fs, 'geoms') else [fs]) if g.geom_type == 'Polygon']
    outside = box(x0 - 2, y0 - 2, x1 + 2, y1 + 2).exterior
    return [g.buffer(gap, join_style=2) for g in parts if not g.exterior.intersects(outside.buffer(0.5)) and g.area > 0.8]


def classify(name, rules):
    for kind, rx in rules:
        if re.search(rx, name, re.I): return kind
    return 'other'


def name_rooms(faces, labels, cfg):
    """Each enclosed face takes the CAD label(s) inside it. A face with several room labels
    (an open area) is split between them by nearest label (Voronoi inside the face).
    Labels matching cfg 'label_ignore' never name a room; 'circulation' labels mark passages."""
    ign = re.compile(cfg['labels']['ignore'], re.I); circ = re.compile(cfg['labels']['circulation'], re.I)
    rules = cfg['room_kinds']
    rooms, n_un = [], 0
    unplaced = []
    # 1) labels per face, duplicates (same text within 1 m) counted once
    per = []
    for f in faces:
        L = [l for l in labels if f.contains(Point(l['x'], l['y'])) and not ign.search(l['t'])]
        uniq = []
        for l in L:
            if not any(u['t'] == l['t'] and math.dist((u['x'], u['y']), (l['x'], l['y'])) < 1.0 for u in uniq): uniq.append(l)
        per.append(uniq)
    # 2) drafters often put a room's name just outside it (in the passage below the door). A room label that
    #    sits in an open area shared with other labels moves into the nearest small enclosed face that has no
    #    label of its own, if that face is within 1.5 m.
    moved = 0
    for i, f in enumerate(faces):
        named = [l for l in per[i] if not circ.search(l['t'])]
        if len(named) < 2: continue
        for l in sorted(named, key=lambda l: l['t']):
            p = Point(l['x'], l['y'])
            cand = [(faces[j].distance(p), j) for j in range(len(faces)) if j != i and not [q for q in per[j] if not circ.search(q['t'])]
                    and 2.5 < faces[j].area < 120 and faces[j].distance(p) < 1.5]
            if cand:
                _, j = min(cand); per[i].remove(l); per[j].append(dict(l, moved_in=True)); moved += 1
    for i, f in enumerate(faces):
        L = per[i]
        uniq = [l for l in L if not circ.search(l['t'])]
        if not uniq:
            n_un += 1
            nm = 'Passage' if L else f'Unlabelled space {n_un}'
            rooms.append({'name': nm, 'poly': f, 'labels': [], 'kind': 'circulation' if (L or f.area > 25) else 'other', 'enclosed': True})
            continue
        if len(uniq) == 1:
            rooms.append({'name': uniq[0]['t'], 'poly': f, 'labels': [uniq[0]], 'kind': classify(uniq[0]['t'], rules), 'enclosed': True}); continue
        # split an open face by nearest label. Labels of rooms that are normally closed (meeting, training,
        # service, wc, core) do not take a share of an open area: their room's walls did not close, so the
        # label is kept as 'unplaced' instead of claiming desks around it.
        CLOSED = {'meeting', 'training', 'service', 'operator'}
        openl = [l for l in uniq if classify(l['t'], rules) not in CLOSED]
        if not openl or f.area < 60: openl = list(uniq)   # small faces (two toilets, a room + its lounge) share out as usual
        for l in uniq:
            if l not in openl: unplaced.append(l)
        uniq = openl
        if not uniq:
            n_un += 1; rooms.append({'name': f'Open area {n_un}', 'poly': f, 'labels': [], 'kind': 'circulation', 'enclosed': True}); continue
        if len(uniq) == 1:
            rooms.append({'name': uniq[0]['t'], 'poly': f, 'labels': [uniq[0]], 'kind': classify(uniq[0]['t'], rules), 'enclosed': True}); continue
        from shapely.ops import voronoi_diagram
        from shapely.geometry import MultiPoint
        pts = MultiPoint([(l['x'], l['y']) for l in uniq])
        vd = voronoi_diagram(pts, envelope=f.envelope.buffer(5))
        for cell in vd.geoms:
            l = next(l for l in uniq if cell.contains(Point(l['x'], l['y'])))
            part = cell.intersection(f)
            if part.is_empty: continue
            if part.geom_type != 'Polygon':
                part = max([g for g in getattr(part, 'geoms', []) if g.geom_type == 'Polygon'], key=lambda g: g.area, default=None)
                if part is None: continue
            rooms.append({'name': l['t'], 'poly': part, 'labels': [l], 'kind': classify(l['t'], rules), 'enclosed': False})
    # same name used by two different rooms: number them
    cnt = collections.Counter(r['name'] for r in rooms)
    seen = collections.Counter()
    for r in rooms:
        if cnt[r['name']] > 1 and not r['name'].startswith('Unlabelled'):
            seen[r['name']] += 1; r['name'] = f"{r['name']} ({seen[r['name']]})"
    name_rooms.unplaced = unplaced
    return rooms


def room_of(rooms, x, y):
    p = Point(x, y)
    for r in rooms:
        if r['poly'].contains(p): return r
    best = min(rooms, key=lambda r: r['poly'].distance(p)) if rooms else None
    return best if best is not None and best["poly"].distance(p) < 0.8 else None


def auto_closures(lines, lo=0.55, hi=1.15, ang=20):
    """Openings without a door block (toilet entries, lift doorways): two wall ends facing each other
    across a gap of lo..hi m, both pointing at each other within `ang` degrees. Returns closing segments
    (listed in rooms.json and the layout so each one is traceable)."""
    ends = []
    for l in lines:
        c = list(l.coords)
        if len(c) < 2 or c[0] == c[-1]: continue
        for p, q in ((c[0], c[1]), (c[-1], c[-2])):
            L_ = math.dist(p, q)
            if L_ < 0.05: continue
            ends.append((p, ((p[0] - q[0]) / L_, (p[1] - q[1]) / L_)))
    out, seen = [], set()
    ca = math.cos(math.radians(ang))
    for i, (p, u) in enumerate(ends):
        for j in range(i + 1, len(ends)):
            q, v = ends[j]
            dd = math.dist(p, q)
            if not (lo <= dd <= hi): continue
            w = ((q[0] - p[0]) / dd, (q[1] - p[1]) / dd)
            if u[0] * w[0] + u[1] * w[1] < ca or -(v[0] * w[0] + v[1] * w[1]) < ca: continue
            k = (round(p[0], 2), round(p[1], 2), round(q[0], 2), round(q[1], 2))
            if k in seen: continue
            seen.add(k); out.append({'a': [round(p[0], 3), round(p[1], 3)], 'b': [round(q[0], 3), round(q[1], 3)], 'gap_m': round(dd, 3),
                                     'why': 'auto: two wall ends facing each other across an opening with no door block'})
    return out
