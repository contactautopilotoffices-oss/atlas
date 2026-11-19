"""Rooms and seats, read from the drawing.

Rooms: the free space enclosed by wall, glass and column lines, with every door opening closed
by its leaf's closed position (from the door arc). Each enclosed region is named by the CAD
label text inside it; an open region holding several labels is shared out by nearest label.
Seats: one record per chair block instance (never merged), placed in the room polygon that
contains it, paired with a desk when the chair sits in a desk block or within 1.0 m of one.

Writes <work>/rooms.json (room polygons, doors, walls lines etc. for later steps) and <work>/seats.json.
"""
import json, os, sys, math, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Point, Polygon, LineString, mapping
from common import args, load_flat, Frame, IN, is_poly
import geom

a = args(); C = a.cfg; F = Frame(C)
d = load_flat(a)['rec']
I = json.load(open(os.path.join(a.work, 'inst.json')))
ins_all = {r['id']: r for r in d if r['t'] == 'INS'}
by_inst = collections.defaultdict(list)
for r in d:
    if is_poly(r):
        for i in r['ch']: by_inst[i].append(r)
LY = C['layers']

# ---- barriers
wl = geom.layer_lines(d, F, set(LY['wall_lines']), nested_ok_layers=set(LY['wall_blocks_on']), ins=ins_all, door_layers=set(LY['doors']))
# L-WALL outlines the CAD uses for open zones (not walls): sizes from config
zones = []
if C.get('open_zone_sizes_m'):
    keep = []
    for l in wl:
        x0, y0, x1, y1 = l.bounds
        if any(abs((x1 - x0) - p) < 0.12 and abs((y1 - y0) - q) < 0.12 for p, q in C['open_zone_sizes_m']):
            zones.append([round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)]); continue
        keep.append(l)
    wl = keep
gl = geom.layer_lines(d, F, set(LY['glass_lines']))
xl = geom.layer_lines(d, F, set(LY.get('room_barriers_extra', [])))   # railings bound rooms but are not walls
cols = geom.columns(d, F, set(LY['column_lines']))
doors = geom.doors(d, F, I, C, by_inst, ins_all)
# every door instance inside the plan window (inst.json may be narrower for Volt)
plate = geom.plate_outline(d, F, set(LY['plate']))
atr = geom.atrium(d, F)
barriers = [geom.extend_ends(l) for l in wl + gl] + xl + [LineString(list(c.exterior.coords)) for c in cols] + [LineString(list(plate.exterior.coords))]
if atr is not None: barriers.append(LineString(list(atr.exterior.coords)))
# hand closures from the tenant config: wall gaps the CAD leaves open (each listed with its reason)
auto_cl = geom.auto_closures(wl)
closures = [geom.extend_ends(LineString([tuple(c['a']), tuple(c['b'])]), 0.15) for c in C.get('closures', []) + auto_cl]
barriers += closures
faces = geom.free_space(barriers, doors, plate.bounds)
faces = [f.intersection(plate) for f in faces]
faces = [f if f.geom_type == 'Polygon' else max(getattr(f, 'geoms', []), key=lambda g: g.area) for f in faces if not f.is_empty]
faces = [f for f in faces if f.area > 0.8 and (atr is None or atr.intersection(f).area < 0.5 * f.area)]
labels = geom.texts(d, F, set(LY['labels']))
for fx in C.get('label_fixes', []):          # renames / moves of CAD labels, listed in the tenant config
    l = min(labels, key=lambda l: math.dist((l['x'], l['y']), fx['at']))
    if math.dist((l['x'], l['y']), fx['at']) > 1.5: continue
    l['cad_text'] = l['t']; l['t'] = fx.get('to', l['t'])
    if fx.get('move_to'): l['x'], l['y'] = fx['move_to']
    if fx.get('drop'): labels.remove(l)
for ad in C.get('label_adds', []): labels.append({'t': ad['t'], 'raw': ad['t'], 'x': ad['at'][0], 'y': ad['at'][1], 'L': 'tenant config', 'nested': False, 'cad_text': None, 'why': ad.get('why')})
import roomplan
DK0 = C['desks']
desks_m = []
for o in I:
    if o['name'] in DK0:
        x0, y0 = F.m(o['cx'] - o['w'] / 2, o['cy'] - o['h'] / 2); x1, y1 = F.m(o['cx'] + o['w'] / 2, o['cy'] + o['h'] / 2)
        desks_m.append((Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]), DK0[o['name']]))
seats_xy = [(*F.m(o['cx'], o['cy']), C['chairs'][o['name']][1]) for o in I if o['name'] in C['chairs']]
FURN = set(LY['workstations_furniture'])
furn_xy = [F.m(o['cx'], o['cy']) for o in I if o['depth'] == 0 and o['L'] in FURN and o['name'] not in DK0 and o['name'] not in C['chairs']
           and 0.3 < max(o['w'], o['h']) * IN < 3.5]
rooms, not_demised, circulation, unplaced = roomplan.build(faces, labels, C, desks_m, seats_xy, furn_xy)
geom.name_rooms.unplaced = unplaced

# ---- seats
CH = C['chairs']; DK = C['desks']
desk_inst = [o for o in I if o['name'] in DK]
seats, n = [], 0
for o in sorted(I, key=lambda o: (-o['cy'], o['cx'])):
    if o['name'] not in CH: continue
    kind, role = CH[o['name']][:2]; places = CH[o['name']][2] if len(CH[o['name']]) > 2 else 1
    x, y = F.m(o['cx'], o['cy'])
    rm = geom.room_of(rooms, x, y) or geom.room_of(circulation, x, y)
    at_desk = DK.get(o['parent'], '') if o['parent'] else ''
    pair = ''
    if at_desk: pair = 'nested in desk block ' + o['parent']
    else:
        near = [(math.dist((x, y), F.m(q['cx'], q['cy'])), q) for q in desk_inst if q['id'] not in o['chain']]
        near = [t for t in near if t[0] < 1.0]
        if near:
            dist, q = min(near, key=lambda t: t[0]); pair = f"{DK[q['name']]} {dist:.2f} m away"
    for s in range(places):
        n += 1
        seats.append(dict(n=n, room=rm['name'] if rm else 'UNASSIGNED', room_kind=rm['kind'] if rm else '', kind=kind, role=role,
                          at_desk=at_desk, desk_pair=pair, block=o['name'], parent_block=o['parent'] or '',
                          x_in=round(o['cx'], 1), y_in=round(o['cy'], 1), x_m=x, y_m=y, handle=o['id'], place=s + 1, places=places))
opr = re.compile(C.get('operator_rooms', '^$'), re.I)
for s in seats:
    if opr.search(s['room']): g = 'O'
    elif s['role'] == 'work': g = 'W'
    elif s['role'] == 'meeting': g = 'M'
    elif s['role'] == 'training': g = 'T'
    elif s['role'] == 'cafe': g = 'C'          # by chair type only, so the room outlines can never move a seat between groups
    else: g = 'L'
    s['grp'] = g

poly = lambda p: [[round(x, 3), round(y, 3)] for x, y in list(p.exterior.coords)[:-1]]
json.dump({'rooms': [{'name': r['name'], 'kind': r['kind'], 'enclosed': r['enclosed'], 'poly': poly(r['poly']), 'holes': [[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in r['poly'].interiors],
                      'area_m2': round(r['poly'].area, 2), 'how': r.get('how', ''), 'cad_text': (r['labels'][0].get('cad_text') if r['labels'] else None), 'label_xy': [r['labels'][0]['x'], r['labels'][0]['y']] if r['labels'] else None} for r in rooms],
           'not_demised': [{'poly': poly(n_['poly']), 'holes': [[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in n_['poly'].interiors], 'area_m2': round(n_['poly'].area, 1), 'why': n_['why']} for n_ in not_demised],
           'circulation': [{'name': c_['name'], 'poly': poly(c_['poly']), 'holes': [[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in c_['poly'].interiors], 'area_m2': round(c_['poly'].area, 1), 'centreline': c_['centreline']} for c_ in circulation],
           'closures': [dict(c, source='tenant config') for c in C.get('closures', [])] + [dict(c, source='auto') for c in auto_cl],
           'doors': doors, 'plate': poly(plate), 'atrium': poly(atr) if atr is not None else None,
           'columns': [poly(c) for c in cols], 'unplaced_labels': geom.name_rooms.unplaced, 'zones': zones, 'labels': labels,
           'wall_lines': [[list(c) for c in l.coords] for l in wl], 'glass_lines': [[list(c) for c in l.coords] for l in gl]},
          open(os.path.join(a.work, 'rooms.json'), 'w'))
json.dump(seats, open(os.path.join(a.work, 'seats.json'), 'w'))
c = collections.Counter(r['kind'] for r in rooms)
print(len(rooms), 'rooms', dict(c), len(circulation), 'circulation', len(not_demised), 'not demised', len(unplaced), 'unplaced', '|', len(doors), 'doors |', len(seats), 'seats', dict(collections.Counter(s['grp'] for s in seats)))
print('unassigned seats:', sum(s['room'] == 'UNASSIGNED' for s in seats))
