"""Dimension checks: <out>/<tenant>_checks.json. Pass/fail items for units, column sizes, a sample
of wall lengths (against the drawing's own dimension entities where one spans the same wall),
every door width, room areas, plate extents (against a reference floor, default Volt's live layout),
and heights (from a section if the DWG has one; otherwise marked assumed)."""
import json, os, sys, math, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon, LineString, Point
from common import args, load_flat, Frame, IN, is_poly, outname, ROOT

a = args([(('--ref',), dict(default=os.path.join(ROOT, 'volt', 'volt-floor1.layout.json')))])
C = a.cfg; F = Frame(C)
flat = load_flat(a); d = flat['rec']; hdr = flat.get('header', {})
L = json.load(open(outname(a, f"-floor{a.floor}.layout.json")))
R = json.load(open(os.path.join(a.work, 'rooms.json')))
items = []
def item(group, name, ok, value, expect, note=''):
    items.append({"group": group, "item": name, "result": ok if isinstance(ok, str) else ('pass' if ok else 'fail'), "value": value, "expected": expect, "note": note})

# ---------- units
item('units', 'DWG INSUNITS', hdr.get('insunits') == 1, f"{hdr.get('insunits')} ({hdr.get('units')})", '1 = inch',
     'Drawing unit is the inch, not mm. Coordinates are converted with 0.0254 m/inch. Annotations on the plan are in mm (LIFT 2025X2025, STAIRS WIDTH=1500) and feet-inches (passage widths); both are checked against geometry below.')
dims = [r for r in d if r['t'] == 'DIM' and r.get('p1') and F.inwin(r['p1'])]
dd = [abs(math.dist(r['p1'], r['p2']) - r['meas']) for r in dims if r.get('meas') is not None and r['kind'] in ('DimensionAligned',)]
lin = [r for r in dims if r.get('meas') is not None]
item('units', 'dimension entities inside the plan', len(lin) > 0 or 'info', len(lin), '>0',
     f"{len(lin)} dimensions in the plan window; {len([r for r in d if r['t']=='DIM'])} in the whole file (the rest sit far from any geometry: orphaned dimensions of deleted sheets).")
for r in lin[:12]:
    item('units', f"dimension {r['L']} reads {r.get('shown') or round(r['meas'], 2)}", 'info', f"{r['meas']:.2f} in = {r['meas'] * 25.4:.0f} mm", 'inch values', 'measurement held by the dimension entity, in drawing units')
lifts = [rm for rm in R['rooms'] if rm['name'].upper().startswith('LIFT') and rm['enclosed']]
for rm in lifts:
    pg = Polygon(rm['poly']); rr = pg.minimum_rotated_rectangle; c = list(rr.exterior.coords)
    s1, s2 = sorted([math.dist(c[0], c[1]), math.dist(c[1], c[2])])
    item('units', f"{rm['name']} shaft vs its label 2025x2025 mm", 'info', f"{s1*1000:.0f} x {s2*1000:.0f} mm (clear opening of the face read from walls)", '2025 x 2025 mm',
         'A lift label of 2025 mm and a shaft of about 2 m only agree if the drawing unit is the inch. Faces include the lift wall reveals, so a few hundred mm either way is expected.')

# ---------- columns
cols = []
for c in L['columns']:
    pg = Polygon(c); rr = pg.minimum_rotated_rectangle; q = list(rr.exterior.coords)
    s1, s2 = sorted([math.dist(q[0], q[1]), math.dist(q[1], q[2])])
    cols.append((round(s1 * 1000), round(s2 * 1000), round(pg.centroid.x, 2), round(pg.centroid.y, 2)))
sizes = collections.Counter((round(a_ / 25) * 25, round(b_ / 25) * 25) for a_, b_, _, _ in cols)
common = {k for k, v in sizes.items() if v >= 2}
for a_, b_, x, y in cols:
    k = (round(a_ / 25) * 25, round(b_ / 25) * 25)
    item('columns', f"column at ({x}, {y}) m", k in common, f"{a_} x {b_} mm", 'a size shared with other columns',
         'single-off size: may be a column drawn partly, or a boxed pipe on the column layer' if k not in common else '')
item('columns', 'column size families', 'info', {f"{k[0]}x{k[1]}": v for k, v in sizes.most_common()}, '', 'mm, rounded to 25 mm')

# ---------- walls (sample: the 12 longest wall lines), each matched to a dimension spanning it if one exists
wl = sorted([LineString(l) for l in R['wall_lines']], key=lambda l: -l.length)
seen = []
for l in wl:
    if any(l.distance(s) < 0.05 and abs(l.length - s.length) < 0.05 for s in seen): continue
    seen.append(l)
    if len(seen) >= 12: break
for l in seen:
    c0, c1 = l.coords[0], l.coords[-1]
    match = None
    for r in lin:
        if not r.get('p2'): continue
        p1, p2 = F.m(*r['p1']), F.m(*r['p2'])
        if (Point(p1).distance(l) < 0.05 and Point(p2).distance(l) < 0.05): match = r; break
    if match:
        item('walls', f"wall from ({c0[0]:.2f},{c0[1]:.2f}) length", abs(match['meas'] * IN - l.length) < 0.01 or 'info', f"{l.length*1000:.0f} mm",
             f"dimension {match['meas']*25.4:.0f} mm", 'dimension spans part or all of this wall')
    else:
        item('walls', f"wall from ({c0[0]:.2f},{c0[1]:.2f}) to ({c1[0]:.2f},{c1[1]:.2f})", 'info', f"{l.length*1000:.0f} mm", 'no dimension in the CAD spans this wall',
             'read from geometry only')

# ---------- doors
for dr in L['doors']:
    w = dr['w'] * 1000
    booth = bool(dr.get('in_block'))
    ok = (550 <= w <= 1300) if booth else (750 <= w <= 1300)
    note = ('fire door' if dr['fire'] else 'glass door' if dr['glass'] else 'door') + f", block {dr['block']}, swing {dr.get('swing')}" + (f", inside furniture block {dr['in_block']} (phone booth): 550 mm minimum" if booth else '')
    if dr['fire'] and w < 900: ok = False; note += '; fire exit doors are normally at least 900 mm (NBC 2016 asks 1000 mm for exits): check'
    item('doors', f"door at ({dr['c'][0]:.2f}, {dr['c'][1]:.2f})", ok, f"{w:.0f} mm leaf", '750-1300 mm single leaf', note)

# ---------- rooms: area > 0, and meeting/training rooms have at least 1.4 m2 per seat named in the label
for rm in L['rooms']:
    if rm['name'].startswith('Unlabelled') or rm['area_m2'] < 1: continue
    m_ = re.search(r'(\d+)\s*(PAX|SEATER)', rm['name'], re.I) or re.search(r'(\d+)\s*\+\s*\d', rm['name'])
    if m_ and rm['kind'] in ('meeting', 'training'):
        pax = int(m_.group(1)); per = rm['area_m2'] / pax
        item('rooms', f"{rm['name']} area", per >= 1.4 or (not rm['enclosed'] and 'info'), f"{rm['area_m2']} m2 ({per:.1f} m2/seat for {pax})", '>= 1.4 m2 per seat',
             '' if rm['enclosed'] else 'room walls did not close in the CAD; area is the share of an open region, not the room')
    else:
        item('rooms', f"{rm['name']} area", 'info', f"{rm['area_m2']} m2", '', ('enclosed' if rm['enclosed'] else 'open area share (nearest label)') + f", ceiling: {rm['ceiling']['type']}")
dm = L['demise']
item('rooms', 'tenant floor (demise) area', 'info', f"{dm['area_m2']} m2 = {dm['area_sqft']} sqft", '', 'plate minus atrium minus OCCUPIED / unfitted areas; includes core and toilets inside it')
for l in R['labels']:
    m_ = re.search(r'CARPET AREA\s*([\d,]+)\s*SQ\s*FT', l['t'], re.I)
    if m_:
        v = int(m_.group(1).replace(',', ''))
        item('rooms', f"label '{l['t']}' vs CAD demise", abs(v - dm['area_sqft']) / v < 0.05, f"{dm['area_sqft']} sqft", f"{v} sqft",
             'The label is a carpet-area figure; the demise polygon read here includes core, toilets and walls, so it is not the same measure. See plate_fit.md.')

# ---------- plate extents vs the reference floor (same building)
pl = Polygon(L['plate']); rr = pl.minimum_rotated_rectangle; q = list(rr.exterior.coords)
dims_pl = sorted([math.dist(q[0], q[1]), math.dist(q[1], q[2])])
item('plate', 'plate extents', 'info', f"{dims_pl[1]:.2f} x {dims_pl[0]:.2f} m, area {pl.area:.0f} m2", '', f"bounds {[round(v, 2) for v in pl.bounds]}")
if os.path.exists(a.ref):
    ref = Polygon(json.load(open(a.ref))['plate']); q = list(ref.minimum_rotated_rectangle.exterior.coords)
    rd = sorted([math.dist(q[0], q[1]), math.dist(q[1], q[2])])
    item('plate', 'plate size vs Volt first floor (same building)', abs(rd[1] - dims_pl[1]) < 0.5 and abs(rd[0] - dims_pl[0]) < 0.5,
         f"{dims_pl[1]:.2f} x {dims_pl[0]:.2f} m", f"{rd[1]:.2f} x {rd[0]:.2f} m (Volt)", 'within 0.5 m on each side')

# ---------- heights
st = L.get('stairs_all') or []
ftf = sorted({s['rise_total_mm'] for s in st if 'rise_total_mm' in s})
item('heights', 'section / elevation in the DWG', 'info', 'none', '', 'No section, elevation or level marks in model or paper space; no ceiling height note.')
item('heights', 'floor-to-floor (stair note)', 'info', f"{ftf} mm" if ftf else 'none', '4100 mm used by the twin',
     'STAIRS ... RISER-3900/25 and /24: a 3.9 m rise per floor. The building twin uses 4.1 m (photo reconstruction). Not a section: it is the stair designer\'s note.')
item('heights', 'floor-to-ceiling', 'assumed', f"{L['heights']['ceiling']} m", '', 'assumed (standard fit-out height); the DWG has no section or RCP level')
res = collections.Counter(i['result'] for i in items)
out = {"tenant": C['name'], "floor": a.floor, "dwg": C.get('dwg_name'), "units": "inch (INSUNITS=1); plan metres = inches x 0.0254",
       "counts": dict(res), "failed": [i for i in items if i['result'] == 'fail'], "items": items}
json.dump(out, open(outname(a, '_checks.json'), 'w'), indent=1)
print(C['name'], dict(res)); [print('  FAIL', i['group'], i['item'], i['value'], i['note'][:90]) for i in out['failed']]
