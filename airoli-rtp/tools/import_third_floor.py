"""Build the third-floor web plan from the isolated, provenance-preserving DXF flatten.

Run the existing procedural-cad/scripts/flatten.py first, with origin [0, 0].
Usage: python -I import_third_floor.py flat.json.gz source.dwg output.json report.json
The supplied file is data only. No drawing code, external references or macros run.
"""
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

from shapely.geometry import LineString, Point, box
from shapely.ops import polygonize, unary_union

flat, dwg, output, report = map(Path, sys.argv[1:5])
data = json.load(gzip.open(flat, 'rt'))
assert data['header']['insunits'] == 4 and data['header']['unit_factor_m'] == .001
records = data['rec']
inserts = {r['id']: r for r in records if r['t'] == 'INSERT'}
# Fit-out window in the drawing's own metre frame. It excludes the separate old
# reference drawing and the unfitted east/south shell; it is not an invented slab.
window = box(6023, 6096, 6063, 6170)
origin = (6020, 6095)

def layer(r):
    if r['L'] != '0':
        return r['L']
    return next((inserts[k]['L'] for k in reversed(r.get('ch', []))
                 if inserts[k]['L'] != '0'), '0')

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
        'STAIR', 'ELE', 'RAILING', 'M.S.STEEL', 'RCC  FINS', 'STRUCTURAL ASSEMBLY'}
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

for r in records:
    effective = layer(r)
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
            if effective in enclosure_layers:
                edges.append(part)

# A measured room is accepted only when the CAD's own wall/glass/door edges
# enclose exactly one label. No gap-closing or hand-drawn room boundaries.
faces = [p for p in polygonize(unary_union(edges)) if 1 < p.area < 1800]
labels = [r for r in records if r.get('txt') and r['L'] == 'WS-ANNO-LABL'
          and window.covers(Point(r['p'])) and 'RTP 3RD' not in r['txt']]
assert len(labels) == 39, f'Unexpected drawing/fit-out window: {len(labels)} labels'
primary = [r for r in labels if not any(w in r['txt'] for w in ['WASHROOM', 'SERVER', 'IT ROOM', 'LOCKERS', 'PASSAGE'])]

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
    candidates = [p for p in faces if p.covers(Point(r['p']))]
    poly = min(candidates, key=lambda p: p.area) if candidates else None
    if poly is not None and sum(poly.covers(Point(t['p'])) for t in labels) != 1:
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
                    dims_m=[round(x1-x0, 3), round(y1-y0, 3)], area_basis='CAD enclosure (includes door swings)')
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
          'totals': {'work_seats': None, 'all_seats': None},
          'card_summary': f'CAD fit-out · {len(zones)} labelled spaces',
          'source_note': 'Seats shown are the drawing’s marked figures. Areas follow closed CAD enclosures unless a user-confirmed figure is identified in the details; location markers identify spaces without a verified enclosure. No client brief is supplied for this floor.',
          'source': {'sha256': hashlib.sha256(dwg.read_bytes()).hexdigest(),
                     'drawing_units': 'millimetres', 'metres_per_drawing_unit': .001,
                     'origin_m': origin, 'fitout_window_m': list(window.bounds),
                     'orientation': 'Drawing axes retained; not independently georeferenced',
                     'scope': 'West-arm fit-out shown in the supplied third-floor drawing. Separate reference plans and unfitted shell outside this window are excluded.',
                     'audit_errors': data['header']['audit_errors'], 'audit_fixes': data['header']['audit_fixes']}}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
audit = {'source': result['source'], 'dwg': dwg.name, 'labels': len(labels), 'spaces': len(zones),
         'supporting_spaces': len(others), 'closed_enclosures': sum(z['outline_verified'] for z in zones + others),
         'marked_work_seats': sum(z['seats'] or 0 for z in zones if not re.match(r'^\d+ SEATER', z['cad_label'])), 'whole_floor_seat_total': None,
         'included_entities': included, 'zones': [{k: z[k] for k in ['id', 'cad_label', 'source_handle', 'seats', 'outline_verified', 'area_m2']} for z in zones + others]}
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps({k: v for k, v in audit.items() if k not in ['included_entities', 'zones', 'source']}, indent=2))
