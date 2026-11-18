"""Turn the flattened DWG (flat.json, inst.json, volt_seats.csv) into one
layout file in metres for the 3D floor plate and the Blender renders.

Plan frame: x east, y north, metres, origin at the south-west corner of the
furniture-layout copy of the plan (drawing point 2996150, -3366400 inches).
Everything here comes from the drawing. Heights are not in a 2D plan, so they
are standard fit-out heights, listed in HEIGHTS and marked as assumed.

Usage (in the folder holding flat.json, inst.json and volt_seats.csv):
    python3 layout.py <out.json>
"""
import csv, json, math, sys, collections
from shapely.geometry import LineString, Polygon, Point, box, MultiPolygon
from shapely.ops import unary_union, polygonize

IN = 0.0254
OX, OY = 2996150.0, -3366400.0
RCP_DX, RCP_DY = 108.8966, -2522.2322      # ceiling-plan copy -> furniture copy
X0, X1, Y0, Y1 = 2996150, 2997640, -3366400, -3365250
HEIGHTS = {"ceiling": 2.85, "wall": 2.85, "desk": 0.75, "high_desk": 1.05, "coffee": 0.42,
           "screen": 0.40, "planter": 1.05, "source": "assumed: standard fit-out heights, not in the 2D drawing"}

def m(x, y): return (round((x - OX) * IN, 3), round((y - OY) * IN, 3))
def inb(p): return X0 < p[0] < X1 and Y0 < p[1] < Y1
def px(pxx, pyy): return (2996000 + (pxx - 18) * 1.0746, -3365200 - (pyy - 16) * 1.0757)

d = json.load(open('flat.json'))['rec']
I = {o['id']: o for o in json.load(open('inst.json'))}
prims = [r for r in d if r['t'] != 'INS' and 'p' in r and r['p'] and isinstance(r['p'][0], list)]
by_inst = collections.defaultdict(list)
for r in prims:
    for i in r['ch']: by_inst[i].append(r)
ins_all = {r['id']: r for r in d if r['t'] == 'INS'}

# ---------------- walls
WALL = {'AR WALL', 'AR-WALL', 'WS-WALL-PRTN', 'WS-WALL', 'L-WALL', 'I- Partition- Jaali Stall'}
lines = []
# L-WALL holds one outline per room. For enclosed rooms the outline is the partition. Two outlines are not walls:
# the open workstation zone (the design deck's renders, pages 4 to 7, show it open to the passages, with planters
# along its edge) and a 7.0 x 6.9 m outline that cuts across the UPS room, collab area 01 and the entry. They are
# kept as "zones" and not built as walls.
OPEN_ZONES = [(17.6, 7.11), (7.03, 6.91)]
zones = []
for r in prims:
    if r['ch'] or r['L'] not in WALL or not any(inb(q) for q in r['p']): continue
    pts = [m(*q) for q in r['p']]
    if r['L'] == 'L-WALL':
        xs = [q[0] for q in pts]; ys = [q[1] for q in pts]; sz = (max(xs) - min(xs), max(ys) - min(ys))
        if any(abs(sz[0] - a) < 0.12 and abs(sz[1] - b) < 0.12 for a, b in OPEN_ZONES):
            zones.append([round(min(xs), 3), round(min(ys), 3), round(max(xs), 3), round(max(ys), 3)]); continue
    if len(pts) > 1: lines.append(LineString(pts))
booths = [o['id'] for o in I.values() if o['name'] == 'A$Cbfba1e20']
for b in booths:   # phone booth shells are drawn inside a block
    for r in by_inst[b]:
        inner = r['ch'][r['ch'].index(b) + 1:]
        if any(ins_all[i]['name'].startswith('*U') for i in inner): continue
        pts = [m(*q) for q in r['p']]
        if len(pts) > 1: lines.append(LineString(pts))
w = unary_union([l.buffer(0.035, cap_style=3, join_style=2) for l in lines])
w = w.buffer(0.06, join_style=2).buffer(-0.06, join_style=2).simplify(0.008)
walls = [g for g in (w.geoms if isinstance(w, MultiPolygon) else [w]) if g.area > 0.01]

def ring(p): return [list(c) for c in list(p.exterior.coords)[:-1]]
def poly_json(p): return {"outer": ring(p), "holes": [[list(c) for c in list(h.coords)[:-1]] for h in p.interiors]}

# ---------------- glass (loose lines on glazing layers)
GL = {'WS-GLAZ-GLAS', 'STR. GLAZING', 'AR-WINDOW'}
glass, seen = [], set()
for r in prims:
    if r['ch'] or r['L'] not in GL or not any(inb(q) for q in r['p']): continue
    P = [m(*q) for q in r['p']]
    for a, b in zip(P, P[1:]):
        L = math.dist(a, b)
        if L < 0.15: continue
        k = tuple(sorted([(round(a[0], 1), round(a[1], 1)), (round(b[0], 1), round(b[1], 1))]))
        if k in seen: continue
        seen.add(k); glass.append([*a, *b, r['L']])

# ---------------- columns
cols = []
for r in prims:
    if r['L'] in ('column', 'RCC COLUMN', 'COL') and not r['ch'] and inb(r['p'][0]) and len(r['p']) >= 4:
        P = Polygon([m(*q) for q in r['p']]).convex_hull
        if 0.04 < P.area < 1.5 and not any(P.centroid.distance(c) < 0.15 for c in cols): cols.append(P)

# ---------------- floor and atrium
FL = [(176, 108), (1490, 108), (1490, 795), (1525, 795), (1525, 960), (1250, 960), (1250, 1085), (700, 1085), (700, 780), (176, 780)]
floor = Polygon([m(*px(*q)) for q in FL])
rl = [LineString([m(*q) for q in r['p']]) for r in prims if r['L'] == 'RAILING' and not r['ch'] and inb(r['p'][0]) and len(r['p']) > 1]
# the atrium is drawn as a box with an X across it: the two longest railing lines are its diagonals
diag = sorted(rl, key=lambda l: -l.length)[:2]
atrium = box(*unary_union(diag).bounds) if len(diag) == 2 else None
if atrium is not None and atrium.area > 20: floor = floor.difference(atrium.buffer(-0.02))
else: atrium = None

# ---------------- rooms (boxes traced on the plan, same as rooms.py) and floor finish
PX = {'Cafeteria': (176, 115, 336, 292), 'Phone booths PH-05 to 07': (336, 115, 487, 160), 'Collab area 02': (336, 160, 487, 255),
      '18 seater conference room': (487, 115, 808, 242), 'Staff room': (808, 115, 940, 217), 'Finance room': (940, 115, 1123, 217),
      '06 seater meeting room': (1123, 115, 1255, 217), 'Lounge area (north)': (1255, 115, 1388, 262), 'Director cabin 01': (1388, 115, 1490, 262),
      '04 seater meeting room 03': (1085, 262, 1210, 364), 'Lounge area (south)': (1210, 262, 1342, 364), 'Director cabin 02': (1342, 262, 1490, 364),
      'Control room / command centre': (176, 292, 357, 600), 'Open workstations': (357, 292, 1003, 553),
      'Sales office': (176, 600, 578, 780), 'Calling room': (578, 600, 683, 780), 'Collab area 01': (820, 600, 978, 795),
      '04 seater meeting room 01': (978, 600, 1085, 700), 'Phone booths PH-01 to 04': (885, 740, 1090, 790),
      'Atrium-side lounge': (1210, 364, 1490, 402), 'Reception': (1075, 795, 1305, 960), 'Autopilot cabin': (1305, 795, 1410, 945),
      '06 seater meeting room (east)': (1410, 795, 1525, 945), 'UPS room': (683, 600, 820, 690), 'Server room': (683, 690, 820, 780),
      'Wet pantry': (870, 850, 1000, 935), 'Entry': (700, 780, 1075, 850)}
FINISH = {'Cafeteria': 'wood', 'Wet pantry': 'tile', 'Reception': 'stone', 'Entry': 'stone', 'UPS room': 'vinyl', 'Server room': 'vinyl',
          'Director cabin 01': 'wood', 'Director cabin 02': 'wood', 'Autopilot cabin': 'wood'}
rooms = []
for k, (a, b, c, e) in PX.items():
    p0, p1 = m(*px(a, e)), m(*px(c, b))
    rooms.append({"name": k, "box": [p0[0], p0[1], p1[0], p1[1]], "floor": FINISH.get(k, 'carpet')})

# ---------------- desks and tables
DESKB = {'A$C779abbf3': "4'x2' workstation", "WS-3'X2'": "3'x2' workstation", 'A$C62789d74': "3'x2' workstation",
         'A$Cb4d34924': 'director desk', '5555 FT TABLE': 'staff table', 'A$C20bf05e1': 'table'}
def rect_of(p):
    r = p.minimum_rotated_rectangle; c = list(r.exterior.coords)[:4]
    e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1]); e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
    l1, l2 = math.hypot(*e1), math.hypot(*e2)
    ang = math.atan2(e1[1], e1[0]) if l1 >= l2 else math.atan2(e2[1], e2[0])
    return {"c": [round(r.centroid.x, 3), round(r.centroid.y, 3)], "w": round(max(l1, l2), 3), "d": round(min(l1, l2), 3), "a": round(ang, 4)}
desks = []; desk_of_block = {}
for o in I.values():
    if o['name'] not in DESKB: continue
    best = None
    for r in by_inst[o['id']]:
        inner = r['ch'][r['ch'].index(o['id']) + 1:]
        if inner: continue                      # skip the nested chair
        if len(r['p']) >= 4:
            P = Polygon([m(*q) for q in r['p']])
            if P.is_valid and P.area > 0.15 and (best is None or P.area > best.area): best = P
    if best is None:
        pts = [m(*q) for r in by_inst[o['id']] for q in r['p']
               if not r['ch'][r['ch'].index(o['id']) + 1:]]
        if len(pts) >= 3: best = Polygon(pts).convex_hull
    if best is None: continue
    rr = rect_of(best); rr["kind"] = DESKB[o['name']]; rr["h"] = HEIGHTS['desk']; rr["block"] = o['name']
    desks.append(rr); desk_of_block[o['id']] = rr

def room_at(x, y):
    for r in rooms:
        a, b, c, e = r['box']
        if a <= x <= c and b <= y <= e: return r['name']
    return None
TL = [LineString([m(*q) for q in r['p']]) for r in prims
      if not r['ch'] and r['L'] in ('WS-FURN', 'CP-INT-FURNITURE', 'CP-INT-CHAIRS') and inb(r['p'][0]) and len(r['p']) > 1]
tables = []
for f in polygonize(unary_union(TL)):
    if not (0.12 < f.area < 14): continue
    if any(f.contains(Point(dd['c'])) for dd in desks): continue
    rn = room_at(f.centroid.x, f.centroid.y) or ''
    if not rn or (atrium is not None and atrium.contains(f.centroid)): continue
    h = HEIGHTS['high_desk'] if (rn == 'Open workstations' and f.area < 3 and f.minimum_rotated_rectangle.area > 1.4 * f.area) else (
        HEIGHTS['coffee'] if any(s in rn for s in ('Lounge', 'Collab', 'Atrium')) else HEIGHTS['desk'])
    circ = 4 * math.pi * f.area / f.length ** 2
    t = {"poly": [[round(x, 3), round(y, 3)] for x, y in list(f.simplify(0.01).exterior.coords)[:-1]], "h": h, "room": rn, "round": circ > 0.85}
    tables.append(t)
for o in I.values():   # round tables held in blocks (cafeteria) and loose circles
    if o['name'] in ('A$Ce427abf2', 'A$C94a717aa', 'A$C753d1f16'):
        cs = [r for r in by_inst[o['id']] if r.get('c') and not r['ch'][r['ch'].index(o['id']) + 1:]]
        for r in sorted(cs, key=lambda r: -r['c'][2])[:1 if o['name'] != 'A$C753d1f16' else 0]:
            c = m(r['c'][0], r['c'][1]); R = r['c'][2] * IN
            tables.append({"circle": [c[0], c[1], round(R, 3)], "h": HEIGHTS['desk'] if o['name'] == 'A$Ce427abf2' else HEIGHTS['coffee'],
                           "room": room_at(*c) or '', "round": True})

def tcentre(t):
    if 'circle' in t: return t['circle'][:2]
    P = Polygon(t['poly']); return [P.centroid.x, P.centroid.y]
targets = [dd['c'] for dd in desks] + [tcentre(t) for t in tables]

# ---------------- seats
seats = []
for r in csv.DictReader(open('volt_seats.csv')):
    o = I[int(r['instance'])]; c = m(float(r['x_in']), float(r['y_in']))
    face = None
    par = ins_all[o['id']]['ch'][-1] if ins_all[o['id']]['ch'] else None
    if par in desk_of_block: face = desk_of_block[par]['c']
    else:
        best = min(targets, key=lambda t: math.dist(t, c))
        if math.dist(best, c) < 2.2: face = best
        else:
            rb = next((x['box'] for x in rooms if x['name'] == r['room']), None)
            face = [(rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2] if rb else [c[0], c[1] + 1]
    a = math.atan2(face[1] - c[1], face[0] - c[0])
    seats.append({"id": r['seat_id'], "group": r['seat_id'][0], "kind": r['kind'], "room": r['room'], "x": c[0], "y": c[1],
                  "face": round(a, 4), "len": round(max(o['w'], o['h']) * IN, 3), "dep": round(min(o['w'], o['h']) * IN, 3), "block": r['block']})
# sofas appear once per place in the CSV; keep one record per sofa with its place count
sofas = collections.OrderedDict()
for s in seats:
    if 'sofa' in s['kind']:
        k = (s['x'], s['y']); sofas.setdefault(k, dict(s, ids=[]))['ids'].append(s['id'])
seat_objs = [s for s in seats if 'sofa' not in s['kind']] + list(sofas.values())

# ---------------- plants and planters
PLANT = {'A$C4730a6c7', 'A$Cfc5399e0', 'A$C64875517', 'A$Cf5303b1e'}
plants, planters = [], []
for o in I.values():
    c = m(o['cx'], o['cy'])
    if o['name'] in PLANT: plants.append({"x": c[0], "y": c[1], "r": round(max(o['w'], o['h']) * IN / 2, 3), "in_box": o['parent'] == 'A$Ca79927ab'})
    if o['name'] == 'A$Ca79927ab':
        w_, h_ = o['w'] * IN, o['h'] * IN
        planters.append({"c": list(c), "w": round(max(w_, h_), 3), "d": round(min(w_, h_), 3), "a": 0.0 if w_ >= h_ else math.pi / 2})

# ---------------- doors (centre, size) and ceiling lights from the ceiling-plan copy
# doors: the leaf is the long thin rectangle inside each door block, drawn open as in the plan
doors = []
for o in I.values():
    if o['name'] not in ('DOOR_SNGL', '*U59', '*U45', 'Door', 'DW'): continue
    best = None
    for r in by_inst[o['id']]:
        if len(r['p']) < 4: continue
        P = Polygon([m(*q) for q in r['p']])
        if not P.is_valid or P.area <= 0: continue
        rr = rect_of(P)
        if 0.55 < rr['w'] < 1.4 and rr['d'] < 0.12 and (best is None or rr['w'] > best['w']): best = rr
    if best is None:   # some blocks draw the leaf as loose lines: take the longest straight line
        segs = [(math.dist(m(*a), m(*b)), m(*a), m(*b)) for r in by_inst[o['id']] if r['t'] == 'Line' for a, b in [r['p'][:2]]]
        segs = [x for x in segs if 0.55 < x[0] < 1.4]
        if segs:
            L_, a_, b_ = max(segs)
            best = {"c": [round((a_[0] + b_[0]) / 2, 3), round((a_[1] + b_[1]) / 2, 3)], "w": round(L_, 3), "d": 0.04, "a": round(math.atan2(b_[1] - a_[1], b_[0] - a_[0]), 4)}
    if best is None: continue
    lay = ins_all[o['id']]['L']
    best.update({"glass": lay in ('WS-GLAZ-GLAS', 'WS-DOOR-GLAZ'), "fire": lay == 'WS-DOOR-FIRE', "block": o['name']})
    doors.append(best)

# the whole first-floor plate (Volt plus the part marked OCCUPIED), from the outer architectural lines
LAY = {'AR WALL', 'AR-WALL', 'AR-WINDOW', 'AR-WINCILL', 'STR. GLAZING', 'column', 'RCC COLUMN', 'L-WALL', 'WS-WALL'}
PB = (2995050, 2997700, -3366480, -3365200)
pl = [LineString([m(*q) for q in r['p']]) for r in prims if not r['ch'] and r['L'] in LAY and len(r['p']) > 1
      and all(PB[0] < q[0] < PB[1] and PB[2] < q[1] < PB[3] for q in r['p'])]
uu = unary_union([l.buffer(0.6) for l in pl])
big = max(uu.geoms, key=lambda g: g.area) if hasattr(uu, 'geoms') else uu
plate = Polygon(big.exterior).buffer(-0.6, join_style=2).simplify(0.05)
lifts = [list(m(*r['p'])) for r in d if r['t'] in ('MText', 'TextEntity') and r.get('txt', '').startswith('LIFT') and inb(r['p'])]
lights = []
for r in prims:
    if r['L'] == "CD-2' x 2' led light" and len(r['p']) >= 4:
        P = Polygon(r['p']).convex_hull
        if 300 < P.area < 900:
            c = m(P.centroid.x + RCP_DX, P.centroid.y + RCP_DY)
            if not any(math.dist(c, l['c']) < 0.3 for l in lights): lights.append({"c": list(c), "kind": "panel600"})
for r in d:
    if r['t'] == 'INS' and r['depth'] == 0 and r['name'] == 'BLCK_LITE_EW WALL':
        c = m(r['p'][0] + RCP_DX, r['p'][1] + RCP_DY)
        if floor.buffer(0.2).contains(Point(c)): lights.append({"c": list(c), "kind": "downlight"})

labels = [{"t": r['txt'], "x": m(*r['p'])[0], "y": m(*r['p'])[1]} for r in d
          if r['t'] in ('MText', 'TextEntity') and r.get('txt') and inb(r['p'])]

bb = floor.bounds
out = {"about": "Volt, first floor, Skymark F-1, Noida. Read from 20260915_SKY_MARK_NOIDA_1ST_VOLT_ENERGY_R16.dwg (furniture layout copy) by noida-skymark/volt/cad. Metres; x east, y north (plan up).",
       "heights": HEIGHTS, "bounds": [round(v, 3) for v in bb],
       "floor": [poly_json(g) for g in (floor.geoms if isinstance(floor, MultiPolygon) else [floor])],
       "atrium": ring(atrium) if atrium is not None else None,
       "walls": [poly_json(g) for g in walls], "glass": glass, "columns": [ring(c) for c in cols],
       "rooms": rooms, "desks": desks, "tables": tables, "seats": seat_objs, "planters": planters, "plants": plants,
       "doors": doors, "lights": lights, "labels": labels, "zones": zones,
       "skirting": [poly_json(g) for w_ in walls for g in ([w_.buffer(0.009, join_style=2)] if w_.buffer(0.009, join_style=2).geom_type == "Polygon" else list(w_.buffer(0.009, join_style=2).geoms))],
       "plate": ring(plate), "lifts": lifts, "storeys": {"count": "G+4", "floor_to_floor": 4.1, "volt_level": 1, "source": "G+4 and 4.1 m floor to floor from the Skymark reconstruction (facade_parameters.json); the plan is labelled FIRST FLOOR"}}
json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else 'layout.json', 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items() if isinstance(v, list)})
