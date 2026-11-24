"""Accuracy spot checks of the built model against the drawing's own numbers:
  1. every DIMENSION in the drawing: do its two definition points sit on faces of the model's walls, and does the
     model reproduce the dimensioned distance?
  2. every passage-width label ("5'6\" PASSAGE WIDE", "6' PASSAGE WIDE", "1200 MM WIDE PASSAGE"): the clear width
     between the model's walls at the label, against the label;
  3. door widths against the size in the door block's name (D-750 = 750 mm).
    python -I spotcheck.py <work_dir> <assemblies.json> <out_dir>
"""
import json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import LineString, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
from lib import load_json, save_json, cfg, inbox

WORK, ASM, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
C = cfg(); A = load_json(ASM); flat = load_json(os.path.join(WORK, 'flat.json.gz'))
OFF = C['offer_clip_m']
fps = []
for w in A['walls']:
    g = LineString(w['axis']['value']).buffer(w['thickness_m']['value'] / 2, cap_style=2, join_style=2)
    fps.append((g, w))
tree = STRtree([g for g, _ in fps])
solid = [(g, w) for g, w in fps if w['type']['value'] not in ('railing',)]
stree = STRtree([g for g, _ in solid])


def on_face(p, tol=0.006):
    pt = Point(p); best = None
    for i in tree.query(pt.buffer(tol)):
        g, w = fps[i]
        d = g.exterior.distance(pt)
        if d <= tol and (best is None or d < best[0]):
            best = (d, w['id'], w['type']['value'])
    return best


dims = []
for r in flat['rec']:
    if r['t'] != 'DIMENSION' or not r.get('p1'):
        continue
    p1, p2 = r['p1'], r['p2']
    a = on_face(p1); b = on_face(p2)
    d_draw = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    dims.append({'handle': r['h'], 'layer': r['L'], 'dimension_m': r['meas'], 'points_m': [p1, p2],
                 'p1_on_model_face': a and {'wall': a[1], 'type': a[2], 'off_mm': round(a[0] * 1000, 1)},
                 'p2_on_model_face': b and {'wall': b[1], 'type': b[2], 'off_mm': round(b[0] * 1000, 1)},
                 'both_on_model': bool(a and b)})


def clear_width(x, y, ang):
    """distance between the nearest solid wall faces either side of (x, y) along direction ang"""
    res = []
    for s in (1, -1):
        ray = LineString([(x, y), (x + s * 8 * math.cos(ang), y + s * 8 * math.sin(ang))])
        hit = None
        for i in stree.query(ray):
            g, w = solid[i]
            inter = ray.intersection(g)
            if inter.is_empty:
                continue
            d = Point(x, y).distance(inter)
            if hit is None or d < hit[0]:
                hit = (d, w['id'], w['type']['value'])
        res.append(hit)
    if not all(res):
        return None
    return {'width_m': round(res[0][0] + res[1][0], 3), 'walls': [res[0][1], res[1][1]], 'types': [res[0][2], res[1][2]]}


passages = []
for r in flat['rec']:
    if r['t'] not in ('TEXT', 'MTEXT') or not inbox(r['p'][0], r['p'][1], OFF):
        continue
    t = r['txt'].upper().replace('\n', ' ')
    if 'PASSAGE' not in t:
        continue
    m = re.search(r"(\d+)\s*'\s*(?:(\d+)\s*\")?", t); mm = re.search(r'(\d{3,4})\s*MM', t)
    want = (int(m.group(1)) * 12 + int(m.group(2) or 0)) * 0.0254 if m else (int(mm.group(1)) / 1000 if mm else None)
    if want is None:
        continue
    x, y = r['p']
    # the label sits in the passage, written along it: measure across it (perpendicular to the text), also try both axes
    cands = [c for c in (clear_width(x, y, math.radians(r.get('rot', 0) + 90)), clear_width(x, y + 0.1, math.pi / 2), clear_width(x, y, 0)) if c]
    best = min(cands, key=lambda c: abs(c['width_m'] - want)) if cands else None
    passages.append({'handle': r['h'], 'label': r['txt'].replace('\n', ' '), 'at': [round(x, 2), round(y, 2)], 'label_m': round(want, 3),
                     'model_clear_m': best and best['width_m'], 'between': best and best['walls'], 'wall_types': best and best['types'],
                     'diff_mm': best and round((best['width_m'] - want) * 1000)})

doors = []
for o in A['openings']:
    m = re.search(r'(\d{3,4})', o['cad']['block'])
    if m and o['cad']['block'].upper().startswith('D-'):
        g = lambda k: o[k]['value'] if o.get(k) else None
        doors.append({'id': o['id'], 'block': o['cad']['block'], 'insert_scale': o['cad']['scale'], 'name_m': int(m.group(1)) / 1000,
                      'opening_m': g('opening_width_m'), 'opening_source': o['opening_width_m']['source'], 'frame_outside_m': g('frame_outside_width_m'),
                      'clear_m': g('clear_width_m'), 'leaf_m': g('leaf_width_m'),
                      'opening_minus_name_mm': round((g('opening_width_m') - int(m.group(1)) / 1000) * 1000)})
res = {'dimensions': dims, 'dimensions_both_points_on_model': sum(d['both_on_model'] for d in dims), 'dimensions_total': len(dims),
       'passages': passages, 'door_names': doors}
save_json(res, os.path.join(OUT, 'spotcheck.json'))
print('dims', res['dimensions_both_points_on_model'], '/', len(dims), 'on model faces')
for p in passages:
    print('passage', p['label'], p['label_m'], '-> model', p['model_clear_m'], p['diff_mm'], 'mm', p['wall_types'])
for d in doors[:40]:
    pass
print('D- doors', len(doors), [(d['id'], d['name_m'], d['opening_m'], d['opening_source'], d['leaf_m']) for d in doors])
