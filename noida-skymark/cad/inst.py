"""One record per CAD block instance (never merged): name, layer, depth, parent block,
centre and size from the exploded geometry, rotation, insert point. Same logic as
volt/cad/inst.py; the window comes from the tenant config ('plan_window_in').

Writes <work>/inst.json."""
import json, collections, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # python3 -I drops the script dir
from common import args, load_flat, Frame

a = args(); F = Frame(a.cfg)
d = load_flat(a)['rec']
ins = {r['id']: r for r in d if r['t'] == 'INS'}
bb = collections.defaultdict(lambda: [1e18, 1e18, -1e18, -1e18])
for r in d:
    if r['t'] not in ('INS', 'DIM', 'HATCH') and 'p' in r and r['p'] and isinstance(r['p'][0], list):
        for i in r['ch']:
            b = bb[i]
            for x, y in r['p']: b[0] = min(b[0], x); b[1] = min(b[1], y); b[2] = max(b[2], x); b[3] = max(b[3], y)
win = a.cfg.get('inst_window_in', a.cfg['plan_window_in'])
out = []
for i, r in ins.items():
    if i not in bb: continue
    b = bb[i]; c = ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
    if not (win[0] < c[0] < win[2] and win[1] < c[1] < win[3]): continue
    par = ins[r['ch'][-1]]['name'] if r['ch'] else None
    out.append(dict(id=i, name=r['name'], L=r['L'], depth=r['depth'], parent=par, top=r['top'], cx=c[0], cy=c[1],
                    w=b[2] - b[0], h=b[3] - b[1], rot=r['rot'], ip=r['p'], chain=r['ch']))
json.dump(out, open(os.path.join(a.work, 'inst.json'), 'w'))
print(len(out), 'instances')
