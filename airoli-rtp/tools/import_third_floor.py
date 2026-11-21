"""Build the third-floor web plan from the isolated, provenance-preserving DXF flatten.

Run the existing procedural-cad/scripts/flatten.py first, with origin [0, 0].
Usage: python -I import_third_floor.py flat.json.gz source.dwg output.json report.json acad-ts.json
The supplied file is data only. No drawing code, external references or macros run.
"""
import gzip
import hashlib
import json
import math
import re
import sys
from pathlib import Path

from shapely.geometry import LineString, Point, box
from shapely.ops import polygonize, unary_union

flat, dwg, output, report, acad_file = map(Path, sys.argv[1:6])
data = json.load(gzip.open(flat, 'rt'))
assert data['header']['insunits'] == 4 and data['header']['unit_factor_m'] == .001
view_records = data['rec']
native = json.loads(acad_file.read_text())
assert native['header']['insunits'] == 4
types = {'INS':'INSERT','MText':'MTEXT','TextEntity':'TEXT','AttributeEntity':'ATTRIB',
         'Line':'LINE','Arc':'ARC','Circle':'CIRCLE','LwPolyline':'LWPOLYLINE','Ellipse':'ELLIPSE','Spline':'SPLINE'}
records = []
for source in native['rec']:
    r = dict(source)
    r['t'] = types.get(r['t'], r['t'])
    r['h'] = (r.get('h') or '').upper()
    if r.get('p'):
        r['p'] = [[x*.001,y*.001] for x,y in r['p']] if isinstance(r['p'][0],list) else [v*.001 for v in r['p']]
    if r.get('rings'):
        r['rings'] = [[[x*.001,y*.001] for x,y in ring] for ring in r['rings']]
    r['hgt'] = (r.get('hgt') or 0)*.001
    r['text_width'] = (r.get('text_width') or 0)*.001
    records.append(r)
inserts = {r['id']: r for r in records if r['t'] == 'INSERT'}
view_inserts = {r['id']:r for r in view_records if r['t']=='INSERT'}
# Fit-out window in the drawing's own metre frame. It excludes the separate old
# reference drawing and the unfitted east/south shell; it is not an invented slab.
window = box(6023, 6096, 6063, 6170)
origin = (6020, 6095)

def layer(r, lookup=inserts):
    if r['L'] != '0':
        return r['L']
    return next((lookup[k]['L'] for k in reversed(r.get('ch', []))
                 if lookup[k]['L'] != '0'), '0')

def xy(p):
    return [round(p[0] - origin[0], 3), round(p[1] - origin[1], 3)]

def svg_coords(points, closed=False):
    points = [xy(p) for p in points]
    if not points:
        return ''
    return 'M' + 'L'.join(f'{x:g} {-y:g}' for x, y in points) + ('Z' if closed else '')

def path_of(poly):
    return svg_coords(poly.exterior.coords, True) + ''.join(svg_coords(r.coords, True) for r in poly.interiors)

WALL = {'walls', 'WS-WALL-PRTN', 'WS-WALL', 'Column', 'Structural Column',
        'STAIR', 'ELE', 'RAILING', 'M.S.STEEL', 'RCC  FINS', 'STRUCTURAL ASSEMBLY',
        'A.C.P.CLADDING', 'A.C.P. CLADDING'}
GLASS = {'WS-GLAZ-GLAS', 'STRUCTURAL GLAZING', 'WINDOW'}
DOORS = {'WS-DOOR-GLAZ', 'WS-DOOR', 'DOOR'}
HATCH = {'wall hatch', 'column-hatch', 'HATCH', 'HATCH-WALL'}
cad = {k: [] for k in ['walls', 'glass', 'doors', 'furn', 'hatch']}
edges, included = [], []
enclosure_layers = WALL | GLASS | DOORS

def line_parts(g):
    if g.is_empty:
        return []
    if g.geom_type in ('LineString', 'LinearRing'):
        return [g]
    return [p for part in getattr(g, 'geoms', []) for p in line_parts(part)]

for r in view_records:
    effective = layer(r, view_inserts)
    group = ('walls' if effective in WALL else 'glass' if effective in GLASS else
             'doors' if effective in DOORS else 'furn' if effective in {'WS-FURN', 'FURN'} else
             'hatch' if effective in HATCH else None)
    if group is None:
        continue
    paths = ([r['p']] if r.get('p') and isinstance(r['p'][0], list) else r.get('rings', []))
    for points in paths:
        if len(points) < 2:
            continue
        segment = LineString(points).intersection(window)
        for part in line_parts(segment):
            cad[group].append(svg_coords(part.coords))
            included.append({'handle': r.get('h'), 'insert': r.get('th'), 'layer': effective, 'group': group})

# Native acad-ts geometry supplies the area analysis. Noding at the same 1 mm
# precision as the web linework repairs numeric microgaps without inventing walls.
for r in records:
    if layer(r) not in enclosure_layers:
        continue
    paths = ([r['p']] if r.get('p') and isinstance(r['p'][0],list) else r.get('rings',[]))
    for points in paths:
        if len(points)>1:
            edge = LineString([(round(x,3),round(y,3)) for x,y in points]).intersection(window)
            edges.extend(line_parts(edge))

# A measured room is accepted only when the CAD's own wall/glass/door edges
# enclose exactly one label. No gap-closing or hand-drawn room boundaries.
faces = [p for p in polygonize(unary_union(edges)) if 1 < p.area < 1800]
labels = [r for r in records if r.get('txt') and r['L'] == 'WS-ANNO-LABL'
          and window.covers(Point(r['p'])) and 'RTP 3RD' not in r['txt']]
assert len(labels) == 39, f'Unexpected drawing/fit-out window: {len(labels)} labels'
primary = [r for r in labels if not any(w in r['txt'] for w in ['WASHROOM', 'SERVER', 'IT ROOM', 'LOCKERS', 'PASSAGE'])]

def label_point(r):
    # MTEXT's insertion point may be its right/bottom corner, even outside a room.
    # Probe just inside the text using the DWG attachment, not a guessed room shape.
    a = r.get('attachment')
    if not a:
        return Point(r['p'])
    h = r['hgt']
    text_lines = r['txt'].splitlines() or ['']
    width = min(r['text_width'] or float('inf'), max(map(len,text_lines))*h*.6)
    dx = {0:width/2,1:0,2:-width/2}[(a-1)%3]
    dy = {0:-h*len(text_lines)*.5,1:0,2:h*len(text_lines)*.5}[(a-1)//3]
    angle = r.get('rotation') or 0
    x,y = r['p']
    return Point(x+dx*math.cos(angle)-dy*math.sin(angle),y+dx*math.sin(angle)+dy*math.cos(angle))

def category(text):
    for match, kind, group, color in [
        ('TRAINING', 'room', 'Training room', '#3b7dd8'),
        ('CONFERENCE', 'room', 'Conference room', '#8e6fd1'),
        ('MEETING', 'room', 'Meeting room', '#8e6fd1'),
        ('INTERVIEW', 'room', 'Interview cabin', '#2e9ba6'),
        ('CABIN', 'room', 'Cabin', '#587dbe'),
        ('HR ROOM', 'room', 'HR room', '#ae7b48'),
        ('RECEPTION', 'room', 'Reception & waiting', '#2fb4d6'),
        ('WASHROOM', 'wc', 'Washroom', '#4aa3c8'),
        ('SERVER', 'service', 'Server room', '#e07b39'),
        ('IT ROOM', 'service', 'IT & storage', '#e07b39'),
        ('LOCKERS', 'service', 'Lockers', '#e07b39'),
        ('PASSAGE', 'core', 'Passage', '#8c8680'),
        ('GROWTH', 'room', 'Growth seating', '#5aa64a'),
        ('CORPORATE', 'room', 'Corporate', '#ba7f3c'),
        ('NEW RAMP', 'room', 'New Ramp', '#2e9d94'),
    ]:
        if match in text:
            return kind, group, color
    return 'room', 'Other seating', '#89983b'

def make_item(r):
    text = ' '.join(r['txt'].split())
    kind, group, color = category(text)
    candidates = [p for p in faces if p.covers(label_point(r))]
    poly = min(candidates, key=lambda p: p.area) if candidates else None
    if poly is not None and sum(poly.covers(label_point(t)) for t in labels) != 1:
        poly = None
    seat = re.search(r'^(\d+) SEATER', text)
    marked = int(seat[1]) if seat else next((n for term, n in [
        ('OTHERS- 108', 108), ('NEW RAMP_283', 283), ('GROWTH SEAT- 88', 88), ('CORPORATE_36_SEAT', 36)
    ] if text == term), None)
    name = re.sub(r'^(\d+) SEATER\s+', '', text).replace('_', ' ')
    if marked is not None and not seat:
        name = re.sub(r'(?:[- ]+\d+| \d+ SEAT)$', '', name).strip()
    name = name.title().replace('Hr Room', 'HR room').replace('It Room', 'IT room')
    item = {'id': 'cad-' + r['h'].lower(), 'name': name, 'kind': kind, 'group': group,
            'color': color, 'label': xy(r['p']), 'seats': marked, 'seat_basis': 'Seats marked (CAD)',
            'cad_label': text, 'source_handle': r['h'], 'd': None, 'dims_m': None,
            'area_m2': None, 'area_sqft': None, 'outline_verified': poly is not None}
    if poly is not None:
        x0, y0, x1, y1 = poly.bounds
        item.update(d=path_of(poly), area_m2=round(poly.area, 2), area_sqft=round(poly.area * 10.7639104),
                    dims_m=[round(x1-x0, 3), round(y1-y0, 3)], area_basis='acad-ts CAD enclosure · 1 mm topology tolerance')
        # Keep labels inside the actual enclosure, rather than over a wall.
        item['label'] = xy(poly.representative_point().coords[0])
    else:
        item['note'] = 'Location marked from the CAD label. The drawing does not supply an unambiguous closed enclosure here; dimensions and area are not verified.'
    return item

zones, others = [], []
primary_handles = {r['h'] for r in primary}
for label in labels:
    item = make_item(label)
    (zones if label['h'] in primary_handles else others).append(item)

# Count physical chairs from identified CAD block definitions and transformed
# descendant geometry. Nested symbols count once; a human-only block is excluded.
chair_types = {'A$C136922d8','A$Ce16c1cc4','A$Cc5b0ed80','A$Cee30255b',
               'A$Cba813c9e','A$C9bee9767','A$Cd2419d53'}
chairs = [dict(r) for r in inserts.values() if r.get('name') in chair_types and window.covers(Point(r['p']))]
chair_ids = {r['id'] for r in chairs}
footprints = {cid:[] for cid in chair_ids}
for r in records:
    points = r['p'] if r.get('p') and isinstance(r['p'][0],list) else []
    points = points + [p for ring in r.get('rings',[]) for p in ring]
    for cid in r.get('ch',[]):
        if cid in footprints:
            footprints[cid].extend(points)
for chair in chairs:
    assert not chair_ids.intersection(chair.get('ch',[])), 'Nested chair duplicate'
    pts = footprints[chair['id']]
    assert pts, 'Missing chair geometry'
    chair['center'] = Point((min(p[0] for p in pts)+max(p[0] for p in pts))/2,
                            (min(p[1] for p in pts)+max(p[1] for p in pts))/2)
assert len(chairs)==773, f'Unexpected chair audit: {len(chairs)}'
items = zones+others
label_by_handle = {r['h']:r for r in labels}
assigned = []
for item in items:
    h = item['source_handle']
    poly_candidates = [p for p in faces if item['d'] and p.covers(label_point(label_by_handle[h]))]
    poly = min(poly_candidates,key=lambda p:p.area) if poly_candidates else None
    counted = [c for c in chairs if poly.covers(c['center'])] if poly is not None else []
    if h=='858D9A':
        counted = [c for c in chairs if c.get('top')=='A$C62789d74' and c['center'].y>6155]
    elif h=='8599A8':
        counted = [c for c in chairs if c.get('name')=='A$C9bee9767']
    item.update(seats=len(counted),seat_basis='Seats counted (CAD)',
                seats_applicable=item['kind'] not in ['wc','service','core'],
                cad_chair_ids=[c['id'] for c in counted])
    assigned.extend(item['cad_chair_ids'])
assert len(assigned)==len(set(assigned))==773, f'Chair allocation mismatch: {len(assigned)} / {len(set(assigned))}'

brief = json.loads((Path(__file__).parents[1]/'demo/data/rtp3_requirements.json').read_text())
by_handle = {z['source_handle']:z for z in items}
for p in brief['processes']:
    z = by_handle[p['cad_handle']]
    assert z['seats']==p['achieved'], f'CAD/brief discrepancy: {p["name"]}'
    z.update(kind='process',sheet_required=p['required'],sheet_achieved=p['achieved'],desk=p['desk_size'],
             brief_source=brief['source']['file'],desk_footprint_sqft=z['seats']*(7 if p['id']=='corporate' else 6))
    if p['id']=='extra-ws': z['name']='Extra WS (Growth seats)'
    elif p['id']=='other': z['name']='Other'
for z in zones:
    if z['group']=='Training room':z.update(brief_capacity='20 people',brief_capacity_count=20)
    elif z['group']=='Conference room':z.update(brief_capacity='12 people',brief_capacity_count=12)
    elif z['group']=='Meeting room':z['brief_capacity']='4–6 people (shared-floor schedule)'
    elif z['group']=='Reception & waiting':z.update(brief_capacity='50–60 people',brief_capacity_count=50)

# User confirmation takes precedence over the automatically enclosed CAD area.
# Keep the original measurement and geometry for traceability and regeneration.
server = next(item for item in others if item['source_handle'] == '853FAD')
server['cad_area_m2'] = server['area_m2']
server['cad_area_sqft'] = server['area_sqft']
server.update(area_sqft=122, area_m2=round(122 / 10.7639104, 2),
              area_basis='User-confirmed area · 20 Nov 2026',
              area_confirmation={'source': 'User', 'date': '2026-11-20', 'sqft': 122})

result = {'id': 'rtp3', 'level': 3, 'title': '3rd floor · fit-out', 'dwg': dwg.name,
          'bounds': [2.5, .5, 43.5, 75.5], 'plate': '', 'plate_sqft': None,
          'cad': {k: ''.join(v) for k, v in cad.items()}, 'zones': zones, 'others': others,
          'totals': {'work_seats': 515, 'all_seats': len(chairs)}, 'brief':brief,
          'card_summary': f'515 workstations · {len(zones)} spaces',
          'source_note': 'Seats are counted from CAD chairs. Required/achieved figures and room capacities come from the supplied client brief. Areas use acad-ts CAD enclosures or the confirmed figure shown in details; open boundaries are flagged for review.',
          'source': {'sha256': hashlib.sha256(dwg.read_bytes()).hexdigest(),
                     'drawing_units': 'millimetres', 'metres_per_drawing_unit': .001,
                     'area_reader':native['header'].get('reader','@node-projects/acad-ts'),
                     'area_method':'Original CAD edges polygonized at 1 mm precision; includes drawn door swings, not a certified carpet-area schedule.',
                     'origin_m': origin, 'fitout_window_m': list(window.bounds),
                     'orientation': 'Drawing axes retained; not independently georeferenced',
                     'scope': 'West-arm fit-out shown in the supplied third-floor drawing. Separate reference plans and unfitted shell outside this window are excluded.',
                     'audit_errors': data['header']['audit_errors'], 'audit_fixes': data['header']['audit_fixes']}}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
audit = {'source': result['source'], 'dwg': dwg.name, 'labels': len(labels), 'spaces': len(zones),
         'supporting_spaces': len(others), 'closed_enclosures': sum(z['outline_verified'] for z in zones + others),
         'drawn_work_seats': 515, 'whole_floor_chairs': len(chairs),
         'included_entities': included, 'zones': [{k: z[k] for k in ['id', 'cad_label', 'source_handle', 'seats', 'outline_verified', 'area_m2']} for z in zones + others]}
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps({k: v for k, v in audit.items() if k not in ['included_entities', 'zones', 'source']}, indent=2))
