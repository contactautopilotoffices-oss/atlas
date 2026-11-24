"""Step 5a. Data for trace.html: the drawing's own linework inside Offices 603 & 604 (every entity with its
handle and layer, linked to the wall / door / column built from it) plus the element records.

    python -I trace_data.py <work_dir> <assemblies.json> <out trace_data.json>
"""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import load_json, cfg, inbox, centroid, pts_of

WORK, ASM, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
C = cfg(); A = load_json(ASM)
flat = load_json(os.path.join(WORK, 'flat.json.gz'))
OFF = C['offer_clip_m']
SKIP = {'WS-FURN', 'FURNITURE m', 'FIXT', 'WS-SANR-FIXT', 'SAN-FIX', 'WS CHAIR', 'Chairs', 'CH', 'FURN', 'FURN-TOA', 'Defpoints', 'OUTER DIM', 'OUTER DIM2'}

owner = collections.defaultdict(list)
for w in A['walls']:
    for h in w['cad']['face_handles']:
        if h: owner[h].append(w['id'])
for c in A['columns']:
    for h in c['poly']['handles']:
        if h: owner[h].append(c['id'])
door_by_insert = {o['cad']['insert_handle']: o['id'] for o in A['openings']}

lines = []
for r in flat['rec']:
    if r['t'] in ('INSERT', 'DIMENSION') or r['L'] in SKIP:
        continue
    if r['ch'] and r['top'] and r['th'] not in door_by_insert and r['L'] in ('0',):
        continue                                    # layer-0 children of furniture blocks
    p = pts_of(r)
    if not p:
        continue
    c = centroid(p)
    if not inbox(c[0], c[1], OFF):
        continue
    el = owner.get(r['h']) or ([door_by_insert[r['th']]] if r['ch'] and r['th'] in door_by_insert else [])
    if r['t'] in ('TEXT', 'MTEXT'):
        lines.append({'h': r['h'], 'L': r['L'], 'txt': r['txt'][:60], 'at': [round(v, 3) for v in r['p']], 'hgt': r.get('hgt', 0.2)})
        continue
    rings = r['rings'] if r['t'] == 'HATCH' else [p]
    for ring in rings:
        flatp = [round(v, 3) for q in ring for v in q]
        if len(flatp) >= 4:
            lines.append({'h': r['h'], 'L': r['L'], 't': r['t'], 'p': flatp, 'el': el[:3], 'blk': r['top'] if r['ch'] else None})


def slim(o):
    o = json.loads(json.dumps(o))
    return o


elements = {}
for w in A['walls']:
    elements[w['id']] = slim(w) | {'cls': 'wall'}
for o in A['openings']:
    elements[o['id']] = slim(o) | {'cls': 'opening'}
for c in A['columns']:
    elements[c['id']] = slim(c) | {'cls': 'column'}
data = {'drawing': A['drawing'], 'offer_clip_m': OFF, 'levels': A['levels'], 'lines': lines, 'elements': elements,
        'counts': {'lines': len(lines), 'linked': sum(1 for l in lines if l.get('el')), 'elements': len(elements)}}
json.dump(data, open(OUT, 'w'), separators=(',', ':'))
print('trace data:', data['counts'], round(os.path.getsize(OUT) / 1e6, 2), 'MB')
