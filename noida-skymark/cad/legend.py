"""The sheet's legend table (paper space), read line by line and compared with the CAD.

The RTP 6th-floor sheet carries a LEGEND table (DESCRIPTION / REQ / PROV) in paper space. flatten.mjs
keeps paper-space text with its sheet name, so the table is rebuilt from text positions: each row is a
description with the number under REQ and the number under PROV nearest to it in height.

Each line is then checked against the CAD by a rule from the tenant json ('legend_map'):
  {"item": regex on the legend description, "how": "labels", "rx": regex on room labels}
  {"item": ..., "how": "work_seats"}                      W seats from the seat proof
  {"item": ..., "how": "rooms_by_seats", "kind": "meeting", "seats": [lo, hi]}   rooms of a kind by seat count
A plan without its own legend can borrow another plan's ('legend_from': tenant name, with its flat.json).

Writes <work>/legend.json and <out>/<tenant>_legend.csv.
"""
import json, os, sys, re, csv, math, collections, gzip
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import args, load_flat, outname, load_cfg, HERE
from geom import clean_text

a = args(); C = a.cfg
LG = C.get('legend')
if not LG:
    print('no legend configured'); sys.exit(0)
src = LG.get('flat') and os.path.abspath(os.path.join(a.out, LG['flat']))
flat = json.load(gzip.open(src)) if src and src.endswith('.gz') else (json.load(open(src)) if src else load_flat(a))
P = [p for p in flat.get('paper') or [] if p['sheet'] == LG['sheet'] and p['L'] in LG.get('layers', [p['L']])]
txt = lambda p: clean_text(p['txt']).strip()
head = {t: next((p for p in P if txt(p).upper() == t), None) for t in ('DESCRIPTION', 'REQ', 'PROV')}
if not all(head.values()):
    print('legend header not found on', LG['sheet']); sys.exit(1)
num = re.compile(r'^\d{1,4}$')
cells = [p for p in P if p['p'][1] < head['DESCRIPTION']['p'][1] - 0.05]
desc = [p for p in cells if not num.match(txt(p)) and abs(p['p'][0] - head['DESCRIPTION']['p'][0]) < 0.6]
nums = [p for p in cells if num.match(txt(p))]
rows = []
for dsc in sorted(desc, key=lambda p: -p['p'][1]):
    r = {'item': txt(dsc), 'y': round(dsc['p'][1], 3)}
    for col in ('REQ', 'PROV'):
        cx = head[col]['p'][0]
        cand = [n for n in nums if abs(n['p'][0] - cx) < 0.35]
        n = min(cand, key=lambda n: abs(n['p'][1] - dsc['p'][1]), default=None)
        r[col.lower()] = int(txt(n)) if n is not None and abs(n['p'][1] - dsc['p'][1]) < 0.25 else None
    rows.append(r)
# every number used once? (a row whose numbers sit between two descriptions would be paired twice)
used = collections.Counter((r['req'], r['prov'], r['y']) for r in rows)
sheet_text = {k: [txt(p) for p in flat.get('paper') if p['sheet'] == LG['sheet'] and re.search(k, txt(p), re.I)] for k in ('OPTION', 'DATE', 'PROPOSED', 'CLIENT', 'SCALE')}

# ------------------------------------------------------------- CAD evidence per line
R = json.load(open(os.path.join(a.work, 'rooms.json'))); S = json.load(open(os.path.join(a.work, 'seats.json')))
nd = [n for n in R['not_demised']]
from shapely.geometry import Polygon, Point
ndp = [Polygon(n['poly']).buffer(0) for n in nd]
labels = [l for l in R['labels'] if not any(g.contains(Point(l['x'], l['y'])) for g in ndp)]
def uniq(ls, m=1.0):
    u = []
    for l in ls:
        if not any(v['t'] == l['t'] and math.dist((v['x'], v['y']), (l['x'], l['y'])) < m for v in u): u.append(l)
    return u
seats_in = collections.Counter(s['room'] for s in S)
out = []
for r in rows:
    rule = next((m for m in C.get('legend_map', []) if re.search(m['item'], r['item'], re.I)), None)
    cad, how = None, 'no rule'
    if rule and rule['how'] == 'labels':
        L = uniq([l for l in labels if re.search(rule['rx'], l['t'], re.I)], rule.get('merge_m', 1.0))
        cad = len(L); how = 'CAD labels: ' + (', '.join(f"{l['t']} ({l['x']:.0f}, {l['y']:.0f})" for l in L) or 'none')
    elif rule and rule['how'] == 'work_seats':
        cad = sum(1 for s in S if s['grp'] == 'W')
        k = collections.Counter(s['at_desk'] or s['desk_pair'].split(' 0.')[0].split(' 1.')[0] for s in S if s['grp'] == 'W')
        how = 'work seats (chair at a desk): ' + ', '.join(f"{v} {k_}" for k_, v in k.most_common())
    elif rule and rule['how'] == 'rooms_by_seats':
        lo, hi = rule['seats']
        rm = [x for x in R['rooms'] if x['kind'] == rule['kind'] and lo <= seats_in.get(x['name'], 0) <= hi]
        cad = len(rm); how = f"{rule['kind']} rooms with {lo}-{hi} chairs: " + (', '.join(f"{x['name']} ({seats_in[x['name']]})" for x in rm) or 'none')
    if rule and rule.get('note'): how += '. ' + rule['note']
    out.append(dict(r, cad=cad, matches_provided=(cad == r['prov']) if cad is not None else None, meets_required=(cad >= r['req']) if (cad is not None and r['req'] is not None) else None, cad_evidence=how))
res = {'sheet': LG['sheet'], 'source': LG.get('about', ''), 'rows': out, 'sheet_text': sheet_text,
       'borrowed': bool(src), 'note': LG.get('note', '')}
json.dump(res, open(os.path.join(a.work, 'legend.json'), 'w'), indent=1)
with open(outname(a, '_legend.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['legend line', 'required', 'provided (sheet)', 'in the CAD', 'CAD = provided', 'CAD evidence'])
    for r in out: w.writerow([r['item'], r['req'], r['prov'], r['cad'], r['matches_provided'], r['cad_evidence']])
for r in out: print(f"{r['item'][:30]:30} req {r['req']!s:>4} prov {r['prov']!s:>4} cad {r['cad']!s:>4}  {r['cad_evidence'][:110]}")
