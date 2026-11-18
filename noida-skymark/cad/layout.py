"""Write <out>/<tenant>-floor<n>.layout.json in the schema of volt/volt-floor1.layout.json
(every key Volt's builder reads is present with the same shape), plus optional keys
documented in cad/README.md. One record per CAD block instance; nothing merged.

Run after inst.py, rooms.py and proof.py. Then fit_to_twin.py adds site_fit / podium / shell_outline.
"""
import json, os, sys, math, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import LineString, Polygon, Point, box, MultiPolygon
from shapely.ops import unary_union, polygonize
from common import args, load_flat, Frame, IN, is_poly, outname
import geom

a = args(); C = a.cfg; F = Frame(C); LY = C['layers']
d = load_flat(a)['rec']
I = {o['id']: o for o in json.load(open(os.path.join(a.work, 'inst.json')))}
R = json.load(open(os.path.join(a.work, 'rooms.json'))); S = json.load(open(os.path.join(a.work, 'seats.json')))
ins_all = {r['id']: r for r in d if r['t'] == 'INS'}
by_inst = collections.defaultdict(list)
for r in d:
    if is_poly(r):
        for i in r['ch']: by_inst[i].append(r)
H = dict(C['heights'])
P = lambda pts: Polygon(pts)
def ring(p): return [[round(x, 3), round(y, 3)] for x, y in list(p.exterior.coords)[:-1]]
def poly_json(p): return {"outer": ring(p), "holes": [[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in p.interiors]}
def parts(g): return [x for x in (g.geoms if hasattr(g, 'geoms') else [g]) if x.geom_type == 'Polygon' and not x.is_empty]

# ---------------- walls (Volt method), glass, columns
wl = [LineString(l) for l in R['wall_lines']]
walls = geom.wall_solids(wl)
glass = geom.glass_segments(d, F, set(LY['glass_lines']))
cols = [P(c) for c in R['columns']]
plate = P(R['plate']); atrium = P(R['atrium']) if R['atrium'] else None

# ---------------- rooms, demise (the tenant's floor)
rooms_raw = R['rooms']
seat_rooms = collections.Counter(s['room'] for s in S)
desk_pts = [F.m(o['cx'], o['cy']) for o in I.values() if o['name'] in C['desks']]
excluded = [Polygon(n_['poly'], n_.get('holes', [])) for n_ in R.get('not_demised', [])]
unfitted = []
floor = plate
if atrium is not None: floor = floor.difference(atrium.buffer(-0.02))
if excluded: floor = floor.difference(unary_union([e.buffer(0.15, join_style=2) for e in excluded]))
floor = max(parts(floor.buffer(0)), key=lambda g: g.area) if parts(floor.buffer(0)) else plate

# ---------------- ceilings (reflected ceiling plan, when the drawing has one)
off = C.get('rcp_offset_in', [0, 0])
def rcp_in(p): return F.inwin((p[0] + off[0], p[1] + off[1]))
def rcp_m(p): return F.m(p[0] + off[0], p[1] + off[1])
grid, gyp = [], []
for r in d:
    if r['L'] == 'APO-MODULAR-GRID CEILING' and is_poly(r) and len(r['p']) >= 4 and rcp_in(r['p'][0]):
        g = P([rcp_m(q) for q in r['p']]).buffer(0)
        if 0.2 < g.area < 0.6: grid.append(g)
    if r['L'] == 'APO- Gypsum celing':
        if r['t'] == 'HATCH':
            for rg in r.get('rings', []):
                if rcp_in(rg[0]):
                    g = P([rcp_m(q) for q in rg]).buffer(0)
                    if g.area > 0.5: gyp.append(g)
        elif is_poly(r) and r.get('closed') and rcp_in(r['p'][0]):
            g = P([rcp_m(q) for q in r['p']]).buffer(0)
            if g.area > 0.5: gyp.append(g)
GRID = unary_union([g.buffer(0.02) for g in grid]) if grid else None
GYP = unary_union(gyp) if gyp else None
has_rcp = bool(grid or gyp)
def ceiling_of(pg):
    if not has_rcp: return {"type": "not in CAD", "source": "no reflected ceiling plan for this area"}
    a_ = pg.area or 1
    fg = GRID.intersection(pg).area / a_ if GRID is not None else 0
    fy = GYP.intersection(pg).area / a_ if GYP is not None else 0
    t = 'grid 600x600 tile' if fg > 0.5 else 'gypsum' if fy > 0.5 else 'mixed grid + gypsum' if fg + fy > 0.5 else 'open / not drawn'
    return {"type": t, "grid_frac": round(fg, 2), "gypsum_frac": round(fy, 2), "source": "RCP layers APO-MODULAR-GRID CEILING / APO- Gypsum celing"}

FIN = [('wood', r'CAFE|CABIN|AUTOPILOT'), ('tile', r'PANTRY|TOILET|WASHROOM'), ('stone', r'RECEPTION|ENTRY|LIFT|STAIR'), ('vinyl', r'UPS|SERVER|ELECTRICAL')]
rooms = []
for r in rooms_raw:
    pg = P(r['poly']); x0, y0, x1, y1 = pg.bounds
    fin = next((f for f, rx in FIN if re.search(rx, r['name'], re.I)), 'carpet')
    rooms.append({"name": r['name'], "box": [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)], "floor": fin,
                  "kind": r['kind'], "poly": r['poly'], "holes": r.get('holes', []), "area_m2": r['area_m2'], "enclosed": r['enclosed'],
                  "ceiling": ceiling_of(pg), "seats": seat_rooms.get(r['name'], 0), "how": r.get('how'), "cad_text": r.get('cad_text')})

# ---------------- desks and tables (Volt method)
DESKB = C['desks']
desks, desk_of_block = [], {}
for o in I.values():
    if o['name'] not in DESKB: continue
    best = None
    for r in by_inst[o['id']]:
        if r['ch'][r['ch'].index(o['id']) + 1:]: continue
        if len(r['p']) >= 4:
            pg = P([F.m(*q) for q in r['p']])
            if pg.is_valid and pg.area > 0.15 and (best is None or pg.area > best.area): best = pg
    if best is None:
        pts = [F.m(*q) for r in by_inst[o['id']] for q in r['p'] if not r['ch'][r['ch'].index(o['id']) + 1:]]
        if len(pts) >= 3: best = Polygon(pts).convex_hull
    if best is None or best.area == 0: continue
    rr = geom.rect_of(best); rr.update({"kind": DESKB[o['name']], "h": H['desk'], "block": o['name'], "instance": o['id']})
    desks.append(rr); desk_of_block[o['id']] = rr
def room_at(x, y):
    rm = geom.room_of([{'poly': P(r['poly']), **r} for r in rooms_raw], x, y)
    return rm['name'] if rm else None
ROOMP = [(P(r['poly']), r) for r in rooms_raw]
def room_at(x, y):
    p = Point(x, y)
    for pg, r in ROOMP:
        if pg.contains(p): return r
    return None
TL = [LineString([F.m(*q) for q in r['p']]) for r in d
      if is_poly(r) and not r['ch'] and r['L'] in ('WS-FURN', 'CP-INT-FURNITURE', 'CP-INT-CHAIRS', 'APO- FURN') and F.inwin(r['p'][0]) and len(r['p']) > 1]
tables = []
for f in polygonize(unary_union(TL)) if TL else []:
    if not (0.12 < f.area < 14): continue
    if any(f.contains(Point(dd['c'])) for dd in desks): continue
    rm = room_at(f.centroid.x, f.centroid.y)
    if not rm or (atrium is not None and atrium.contains(f.centroid)): continue
    h = H['high_desk'] if (rm['kind'] == 'work' and f.area < 3 and f.minimum_rotated_rectangle.area > 1.4 * f.area) else (
        H['coffee'] if rm['kind'] in ('lounge', 'reception') else H['desk'])
    tables.append({"poly": [[round(x, 3), round(y, 3)] for x, y in list(f.simplify(0.01).exterior.coords)[:-1]], "h": h, "room": rm['name'],
                   "round": 4 * math.pi * f.area / f.length ** 2 > 0.85})
def tcentre(t):
    pg = P(t['poly']); return [pg.centroid.x, pg.centroid.y]
targets = [dd['c'] for dd in desks] + [tcentre(t) for t in tables]

# ---------------- seats (Volt format: one object per chair instance; a sofa is one object with its place ids)
seats = []
for s in S:
    o = I[s['handle']]; c = (s['x_m'], s['y_m'])
    par = ins_all[o['id']]['ch'][-1] if ins_all[o['id']]['ch'] else None
    if par in desk_of_block: face = desk_of_block[par]['c']
    else:
        best = min(targets, key=lambda t: math.dist(t, c)) if targets else None
        if best is not None and math.dist(best, c) < 2.2: face = best
        else:
            rm = next((r for r in rooms_raw if r['name'] == s['room']), None)
            face = list(P(rm['poly']).centroid.coords[0]) if rm else [c[0], c[1] + 1]
    seats.append({"id": s['seat_id'], "group": s['grp'], "kind": s['kind'], "room": s['room'], "x": c[0], "y": c[1],
                  "face": round(math.atan2(face[1] - c[1], face[0] - c[0]), 4), "len": round(max(o['w'], o['h']) * IN, 3),
                  "dep": round(min(o['w'], o['h']) * IN, 3), "block": s['block'], "instance": s['handle'],
                  "desk_pair": s['desk_pair'] or None})
sofas = collections.OrderedDict()
for s in seats:
    if 'sofa' in s['kind']: sofas.setdefault(s['instance'], dict(s, ids=[]))['ids'].append(s['id'])
seat_objs = [s for s in seats if 'sofa' not in s['kind']] + list(sofas.values())

# ---------------- plants, planters, fixtures
plants, planters = [], []
for o in I.values():
    c = F.m(o['cx'], o['cy'])
    if o['name'] in C['blocks']['plants']: plants.append({"x": c[0], "y": c[1], "r": round(max(o['w'], o['h']) * IN / 2, 3), "in_box": o['parent'] in C['blocks']['planter_boxes']})
    if o['name'] in C['blocks']['planter_boxes']:
        w_, h_ = o['w'] * IN, o['h'] * IN
        planters.append({"c": list(c), "w": round(max(w_, h_), 3), "d": round(min(w_, h_), 3), "a": 0.0 if w_ >= h_ else math.pi / 2})
fixtures = []
for o in I.values():
    k = C['blocks']['wc_mep'].get(o['name'])
    if k: fixtures.append({"kind": k, "c": list(F.m(o['cx'], o['cy'])), "a": round(o['rot'] or 0, 4), "w": round(min(o['w'], o['h']) * IN, 3), "d": round(max(o['w'], o['h']) * IN, 3), "instance": o['id']})

# ---------------- lights (from the drawing's ceiling plan; none are invented here)
lights = []
LB = C['blocks']['lights']
for r in d:
    if r['t'] == 'INS' and r['depth'] == 0 and r['name'] in LB:
        pts = [q for g in by_inst[r['id']] for q in g['p']]
        if not pts: continue
        xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
        ctr = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)          # centre of the drawn fixture (insert points can be off it)
        if not rcp_in(ctr): continue
        k = LB[r['name']]
        rec = {"c": list(rcp_m(ctr)), "kind": k, "block": r['name'], "instance": r['id']}
        if k == 'linear':
            w_, h_ = max(xs) - min(xs), max(ys) - min(ys)
            rec['len'] = round(max(w_, h_) * IN, 3); rec['a'] = 0.0 if w_ >= h_ else round(math.pi / 2, 4)
        lights.append(rec)
for r in d:   # loose 2'x2' panels (Volt draws them as polylines) and loose downlight circles
    if r['L'] == "CD-2' x 2' led light" and not r['ch'] and is_poly(r) and len(r['p']) >= 4 and rcp_in(r['p'][0]):
        pg = Polygon(r['p']).convex_hull
        if 300 < pg.area < 900:
            c = rcp_m((pg.centroid.x, pg.centroid.y))
            if not any(math.dist(c, l['c']) < 0.3 for l in lights): lights.append({"c": list(c), "kind": "panel600", "block": None})
    if r['L'] == 'AE-LITE-CLNG' and not r['ch'] and r.get('c') and rcp_in(r['c'][:2]):
        c = rcp_m(r['c'][:2])
        if not any(math.dist(c, l['c']) < 0.2 for l in lights): lights.append({"c": list(c), "kind": "downlight", "block": None})
if C.get('rcp_offset_in') == None or not off[0]:
    lights = [l for l in lights if floor.buffer(0.2).contains(Point(l['c'])) or plate.contains(Point(l['c']))]
else:
    lights = [l for l in lights if floor.buffer(0.2).contains(Point(l['c']))]

# ---------------- labels, lifts, stairs, circulation
labels = [{"t": l['raw'].replace('\\P', '\n'), "x": l['x'], "y": l['y'], "clean": l['t']} for l in R['labels']]
lifts = [[l['x'], l['y']] for l in R['labels'] if l['t'].upper().startswith('LIFT')]
st = [LineString([F.m(*q) for q in r['p']]) for r in d if is_poly(r) and r['L'] == 'STAIR' and not r['ch'] and F.inwin(r['p'][0]) and len(r['p']) > 1]
stairs_all = []
if st:
    cl = unary_union([l.buffer(0.6) for l in st])
    for g in parts(cl):
        inside = [l for l in st if g.contains(l)]
        if not inside: continue
        b = unary_union(inside).bounds
        note = next((l for l in R['labels'] if re.search(r'STAIR', l['t']) and box(*b).buffer(4).contains(Point(l['x'], l['y']))), None)
        m_ = re.search(r'RISER-?\s*(\d+)\s*/\s*(\d+)', note['t']) if note else None
        rec = {"bbox": [round(v, 3) for v in b], "tread_lines": len(inside), "note": note['t'] if note else None}
        if m_: rec.update({"rise_total_mm": int(m_.group(1)), "risers": int(m_.group(2)), "riser": round(int(m_.group(1)) / int(m_.group(2)) / 1000, 3)})
        stairs_all.append(rec)
fc = floor.centroid
stairs = min(stairs_all, key=lambda s: Point((s['bbox'][0] + s['bbox'][2]) / 2, (s['bbox'][1] + s['bbox'][3]) / 2).distance(fc)) if stairs_all else None
if stairs: stairs = dict(stairs, steps=[], about="Stair nearest the tenant's floor, bbox from the CAD STAIR layer; riser from the plan note. Treads are listed in stairs_all only as a count.")
passages = []
for l in R['labels']:
    if re.search(C['labels']['circulation'], l['t'], re.I):
        m_ = re.search(r"(\d+)\s*'\s*(\d+)?\s*\"?", l['t'])
        wdt = round((int(m_.group(1)) * 12 + int(m_.group(2) or 0)) * IN, 3) if m_ else None
        passages.append({"label": l['t'], "x": l['x'], "y": l['y'], "width_m": wdt})

# ---------------- per room: lights, doors on its boundary, feature wall
LSIZE = {'panel600': {'w': 0.6, 'd': 0.6}, 'downlight': {'dia': 0.17}}
def side_of(pg, q):
    c = pg.centroid; dx, dy = q[0] - c.x, q[1] - c.y
    return ('east' if dx > 0 else 'west') if abs(dx) > abs(dy) else ('north' if dy > 0 else 'south')
tv = [o for o in I.values() if o['name'] in C['blocks'].get('wall_displays', [])]
for rm in rooms:
    pg = Polygon(rm['poly'], rm.get('holes') or []).buffer(0)
    li = []
    for l in lights:
        if pg.contains(Point(l['c'])):
            rec = {"c": l['c'], "kind": l['kind']}
            if l['kind'] == 'linear': rec.update({"len": l.get('len'), "a": l.get('a')})
            else: rec.update(LSIZE.get(l['kind'], {}))
            li.append(rec)
    rm['lights'] = li
    dl = []
    for dr in R['doors']:
        o = dr['opening']; seg = LineString([(o[0], o[1]), (o[2], o[3])])
        if pg.exterior.distance(seg.interpolate(0.5, normalized=True)) < 0.3 or pg.buffer(0.15).intersects(seg) and not pg.buffer(-0.15).contains(seg):
            if pg.buffer(0.35).contains(seg.interpolate(0.5, normalized=True)):
                tip = dr.get('open_leaf_tip')
                into = (pg.contains(Point(tip)) and 'into the room' or 'out of the room') if tip else 'unknown'
                hinge_side = None
                if dr.get('hinge') and tip:
                    # standing in the opening, facing into the room: is the hinge on the left or right?
                    mx, my = (o[0] + o[2]) / 2, (o[1] + o[3]) / 2; cx_, cy_ = pg.centroid.x, pg.centroid.y
                    ux, uy = o[2] - o[0], o[3] - o[1]; nx_, ny_ = -uy, ux
                    if (cx_ - mx) * nx_ + (cy_ - my) * ny_ < 0: nx_, ny_ = -nx_, -ny_
                    hx, hy = dr['hinge'][0] - mx, dr['hinge'][1] - my
                    hinge_side = 'left' if nx_ * hy - ny_ * hx > 0 else 'right'
                dl.append({"instance": dr['instance'], "c": dr['c'], "width_m": dr['w'], "hinge": dr.get('hinge'), "hinge_side": hinge_side,
                           "swing": dr.get('swing'), "opens": into, "glass": dr['glass'], "fire": dr['fire'], "opening": o})
    rm['doors'] = dl
    fw = None
    for o in (tv if rm['kind'] in ('meeting', 'training') or re.search(r'CABIN', rm['name'], re.I) else []):
        q = F.m(o['cx'], o['cy'])
        if pg.buffer(0.35).contains(Point(q)):
            fw = {"wall": side_of(pg, q), "at": list(q), "w": round(max(o['w'], o['h']) * IN, 3), "block": o['name'], "instance": o['id'],
                  "what": "probable wall-mounted screen: unnamed block " + o['name'] + f", {max(o['w'], o['h']) * IN:.2f} x {min(o['w'], o['h']) * IN:.2f} m, drawn against a meeting-room wall"}
            break
    rm['feature_wall'] = fw
    rm['ceiling']['height_m'] = None; rm['ceiling']['height_note'] = 'not in the CAD (no section, no ceiling level); see heights.ceiling (assumed)'

# ---------------- shell: plate, facade openings, columns, core
win = []
ext = plate.exterior
for g in glass:
    if g[4] not in ('AR-WINDOW', 'STR. GLAZING'): continue
    seg = LineString([(g[0], g[1]), (g[2], g[3])])
    if seg.length < 0.3 or ext.distance(seg) > 1.2: continue
    win.append(seg)
groups = []
for seg in sorted(win, key=lambda s_: -s_.length):
    a_ = math.atan2(seg.coords[1][1] - seg.coords[0][1], seg.coords[1][0] - seg.coords[0][0]) % math.pi
    for g_ in groups:
        if abs(((g_['a'] - a_ + math.pi / 2) % math.pi) - math.pi / 2) < 0.05 and g_['geom'].buffer(0.45, cap_style=2).intersection(seg).length > 0.5 * seg.length:
            g_['segs'].append(seg); g_['geom'] = unary_union([g_['geom'], seg]); break
    else:
        groups.append({'a': a_, 'segs': [seg], 'geom': seg})
windows = []
for g_ in groups:
    ca, sa = math.cos(g_['a']), math.sin(g_['a'])
    ts = [p_[0] * ca + p_[1] * sa for s_ in g_['segs'] for p_ in s_.coords]
    ns = [-p_[0] * sa + p_[1] * ca for s_ in g_['segs'] for p_ in s_.coords]
    t0, t1, nm = min(ts), max(ts), sum(ns) / len(ns)
    c_ = ((t0 + t1) / 2 * ca - nm * sa, (t0 + t1) / 2 * sa + nm * ca)
    windows.append({"c": [round(c_[0], 3), round(c_[1], 3)], "width_m": round(t1 - t0, 3), "a": round(g_['a'], 4), "lines": len(g_['segs']),
                    "a_xy": [round(t0 * ca - nm * sa, 3), round(t0 * sa + nm * ca, 3)], "b_xy": [round(t1 * ca - nm * sa, 3), round(t1 * sa + nm * ca, 3)]})
windows.sort(key=lambda w_: (round(w_['c'][1] / 3), w_['c'][0]))
core = [{"name": r['name'], "kind": r['kind'], "poly": r['poly'], "area_m2": r['area_m2']} for r in rooms_raw if r['kind'] in ('core', 'wc')]
lift_rooms = [{"name": r['name'], "poly": r['poly']} for r in rooms_raw if r['name'].upper().startswith('LIFT')]
shell = {"outline": ring(plate), "source": "CAD plate: outer architectural lines (walls, windows, sills, columns) of this drawing. For a floor above the twin's annex the CAD outline wins over the photo twin's massing; it is exported as drawn, not fitted into the twin body.",
         "windows": windows, "window_note": "Facade openings from AR-WINDOW / STR. GLAZING lines within 1.2 m of the plate edge, parallel lines merged into one opening (position = centre, width along the facade). Sill and head heights are not in the CAD (plan only); see the assumptions file.",
         "sill_height_m": None, "head_height_m": None,
         "columns": [ring(c) for c in cols], "core": core, "stairs": stairs_all, "lifts": {"labels": lifts, "shafts": lift_rooms},
         "atrium": ring(atrium) if atrium is not None else None}

# heights evidence: the stair notes give the floor-to-floor rise; nothing in the CAD gives a ceiling height
ftf = sorted({s['rise_total_mm'] for s in stairs_all if 'rise_total_mm' in s})
H['source'] = "assumed: standard fit-out heights, not in the 2D drawing (no section, no ceiling level note)"
bb = floor.bounds
out = {
    "about": f"{C['name']}, floor {a.floor}, Skymark F-1, Noida. Read from {C.get('dwg_name')} by noida-skymark/cad (generic pipeline). Metres; x east, y north (plan up). Origin = drawing point {C['origin_in']} inches.",
    "heights": H, "bounds": [round(v, 3) for v in bb],
    "floor": [poly_json(g) for g in parts(floor)],
    "atrium": ring(atrium) if atrium is not None else None,
    "walls": [poly_json(g) for g in walls], "glass": glass, "columns": [ring(c) for c in cols],
    "rooms": rooms, "desks": desks, "tables": tables, "seats": seat_objs, "planters": planters, "plants": plants,
    "doors": R['doors'], "lights": lights, "labels": labels, "zones": R['zones'],
    "skirting": [poly_json(g) for w_ in walls for g in parts(w_.buffer(0.009, join_style=2))],
    "plate": ring(plate), "lifts": lifts,
    "storeys": {"count": "G+4", "floor_to_floor": 4.1, "volt_level": a.floor, "level": a.floor,
                "cad_floor_to_floor_m": (ftf[0] / 1000 if len(ftf) == 1 else [v / 1000 for v in ftf]) if ftf else None,
                "source": "G+4 and 4.1 m floor to floor from the Skymark reconstruction (facade_parameters.json). The CAD's stair notes give RISER-3900 (a 3.9 m rise per floor); kept as cad_floor_to_floor_m, not applied."},
    "stairs": stairs, "stairs_all": stairs_all,
    "extra_rooms": [{"name": r["name"], "box": r["box"]} for r in rooms if r["kind"] == "wc"],
    "fixtures": fixtures, "fixtures_about": "Plumbing fixtures from the CAD's MEP- Plumb- Fixtures blocks, one per block instance; rotation kept.",
    # ----- optional keys (documented in cad/README.md)
    "demise": {"outer": ring(floor), "holes": [[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in floor.interiors], "excluded": [n_['why'] for n_ in R.get('not_demised', [])],
               "area_m2": round(floor.area, 1), "area_sqft": round(floor.area * 10.7639)},
    "circulation": {"polygons": [{"name": c_['name'], "poly": c_['poly'], "holes": c_.get('holes', []), "area_m2": c_['area_m2'], "centreline": c_['centreline']} for c_ in R.get('circulation', [])],
                    "passages": passages},
    "not_demised": R.get('not_demised', []),
    "closures": R.get('closures', []),
    "shell": shell,
    "ceiling_plan": {"present": has_rcp, "grid_tiles": len(grid), "gypsum_regions": len(gyp),
                     "lights_by_kind": dict(collections.Counter(l['kind'] for l in lights)), "ac_grilles": 0,
                     "note": "AC grilles / diffusers: nothing drawn (ARCIL has empty layers named AC Grill and AC-RA-GRILLE)."},
    "unplaced_labels": [l['t'] for l in R.get('unplaced_labels', [])],
    "source": {"dwg": C.get('dwg_name'), "units": "inch (INSUNITS=1), converted with 0.0254", "tenant": C['name'], "floor": a.floor},
}
p = outname(a, f"-floor{a.floor}.layout.json")
json.dump(out, open(p, 'w'), separators=(',', ':'))
print(p, {k: len(v) for k, v in out.items() if isinstance(v, list)}, 'demise m2', out['demise']['area_m2'])
