"""Draw the CAD itself as a blueprint image for the live locator in the walkthrough.

Every line of the furniture-layout copy of the plan (walls, glass, doors,
furniture, text) is drawn from flat.json, white on blue, in the same plan
frame as the layout (metres, x east, y north). The image's bounds are written
next to it so the viewer can turn a position into a pixel.

Usage (in the folder holding flat.json): python3 blueprint.py <layout.json> <out.png> <out.json>
"""
import json, sys
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
lay, out_png, out_json = sys.argv[1:4]
L = json.load(open(lay)); d = json.load(open('flat.json'))['rec']
IN = 0.0254; OX, OY = 2996150.0, -3366400.0
m = lambda q: ((q[0] - OX) * IN, (q[1] - OY) * IN)
b = L['bounds']; PAD = 1.6
x0, y0, x1, y1 = b[0] - PAD, b[1] - PAD, b[2] + PAD, b[3] + PAD
inb = lambda p: x0 < p[0] < x1 and y0 < p[1] < y1
WALL = {'AR WALL', 'AR-WALL', 'WS-WALL-PRTN', 'WS-WALL', 'L-WALL', 'column', 'RCC COLUMN', 'COL', 'I- Partition- Jaali Stall'}
ZONES = [tuple(z) for z in L.get('zones', [])]   # room outlines that are not walls: drawn thin
GLASS = {'WS-GLAZ-GLAS', 'STR. GLAZING', 'AR-WINDOW', 'WS-DOOR-GLAZ'}
SKIP = {'WS-TREE', 'APO- PLANTERS', 'FORMAT-A1', 'PDF4_Geometry', 'WS-ANNO-DIMS', 'Dim-INT', 'LEADER', 'DIM'}
walls, glass, furn = [], [], []
for r in d:
    if r['t'] == 'INS' or 'p' not in r or not r['p'] or not isinstance(r['p'][0], list) or len(r['p']) < 2: continue
    if r['L'] in SKIP or r.get('fill'): continue
    P = [m(q) for q in r['p']]
    if not any(inb(p) for p in P): continue
    if r['L'] == 'L-WALL':
        xs = [q[0] for q in P]; ys = [q[1] for q in P]
        if any(abs(min(xs) - z[0]) < 0.05 and abs(max(xs) - z[2]) < 0.05 and abs(min(ys) - z[1]) < 0.05 and abs(max(ys) - z[3]) < 0.05 for z in ZONES): furn.append(P); continue
    (walls if r['L'] in WALL else glass if r['L'] in GLASS else furn).append(P)
W_PX = 2400; H_PX = round(W_PX * (y1 - y0) / (x1 - x0))
fig = plt.figure(figsize=(W_PX / 200, H_PX / 200), dpi=200); ax = fig.add_axes([0, 0, 1, 1])
BG = '#123b7a'; ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
import numpy as np
for g in np.arange(np.floor(x0), x1, 1): ax.axvline(g, color='#ffffff', lw=.25 if g % 5 else .5, alpha=.10 if g % 5 else .2)
for g in np.arange(np.floor(y0), y1, 1): ax.axhline(g, color='#ffffff', lw=.25 if g % 5 else .5, alpha=.10 if g % 5 else .2)
ax.add_collection(LineCollection(furn, lw=.45, color='#cfe2ff', alpha=.8))
ax.add_collection(LineCollection(glass, lw=.9, color='#7fd6ff'))
ax.add_collection(LineCollection(walls, lw=1.25, color='#ffffff'))
for r in d:
    if r['t'] in ('MText', 'TextEntity') and r.get('txt'):
        p = m(r['p'])
        if inb(p) and len(r['txt']) < 60: ax.text(p[0], p[1], r['txt'].replace('\\L', ''), fontsize=3.6, color='#ffffff', alpha=.92, va='top', family='DejaVu Sans', linespacing=1.05)
ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect('equal'); ax.axis('off')
fig.savefig(out_png, dpi=200, facecolor=BG)
json.dump({"bounds": [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)], "px": [W_PX, H_PX],
           "about": "Blueprint drawn from the DWG's own lines (furniture layout copy). Plan metres, x east, y north; pixel = ((x - x0) / (x1 - x0) * W, (y1 - y) / (y1 - y0) * H)."}, open(out_json, 'w'))
print(W_PX, H_PX, len(walls), len(glass), len(furn))
