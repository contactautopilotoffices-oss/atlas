"""Plan view of the assembly model: every wall coloured by its inferred type, doors with their header kind.
    python -I plan_png.py <assemblies.json> <out.png> [x0,y0,x1,y1] [width_in]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MP, Patch
from shapely.geometry import LineString, Polygon
from lib import load_json, rules

A = load_json(sys.argv[1]); OUT = sys.argv[2]
R = rules()
TYPE_COL = {'glass_partition': '#1fa2d6', 'full_height_glass': '#0b6e99', 'pop_gypsum': '#e8b04a', 'mixed': '#d9480f', 'brick_block': '#a0522d',
            'rcc': '#555555', 'curtain_wall': '#3b5bdb', 'acp': '#9c36b5', 'window_glazing': '#66d9e8', 'panel_partial_height': '#8f6fbf',
            'railing': '#222222', 'unknown': '#ff2d95'}
HDR_COL = {'glass_transom': '#00c2ff', 'pop_bulkhead': '#f08c00', 'lintel_masonry': '#7f3b08', 'none_open_above': '#999999', 'full_height': '#2b8a3e'}
box = [float(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
wid = float(sys.argv[4]) if len(sys.argv) > 4 else 18
sl = A['slab']['poly']['value']
xs = [p[0] for p in sl]; ys = [p[1] for p in sl]
b = box or [min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1]
fig, ax = plt.subplots(figsize=(wid, wid * (b[3] - b[1]) / (b[2] - b[0]) + 1.2), dpi=120)
ax.add_patch(MP(sl, closed=True, fc='#f6f6f2', ec='#cccccc', lw=0.5))
for c in A['columns']:
    ax.add_patch(MP(c['poly']['value'], closed=True, fc='#777777', ec='#333333', lw=0.4))
for w in A['walls']:
    t = w['type']['value']
    pg = LineString(w['axis']['value']).buffer(max(w['thickness_m']['value'], 0.03) / 2, cap_style=2, join_style=2)
    if pg.is_empty: continue
    for g in getattr(pg, 'geoms', [pg]):
        ax.add_patch(MP(list(g.exterior.coords), closed=True, fc=TYPE_COL[t], ec=TYPE_COL[t], lw=0.3, alpha=0.95 if w['type']['source'] == 'cad' else 0.6))
for o in A['openings']:
    (x0, y0), (x1, y1) = o['line']['value']
    k = o['header']['value']['kind']
    ax.plot([x0, x1], [y0, y1], color=HDR_COL.get(k, 'red'), lw=2.4, solid_capstyle='butt')
    if not o['host']['value']:
        ax.plot([(x0 + x1) / 2], [(y0 + y1) / 2], 'x', color='red', ms=5, mew=1.2)
leg = [Patch(color=v, label=k.replace('_', ' ')) for k, v in TYPE_COL.items() if any(w['type']['value'] == k for w in A['walls'])]
leg += [Patch(color=v, label='door, header: ' + k.replace('_', ' ')) for k, v in HDR_COL.items() if any(o['header']['value']['kind'] == k for o in A['openings'])]
leg += [Patch(color='#777777', label='RCC column')]
ax.legend(handles=leg, loc='upper center', bbox_to_anchor=(0.5, -0.02), ncol=5, fontsize=8, frameon=False)
ax.set_xlim(b[0], b[2]); ax.set_ylim(b[1], b[3]); ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
ax.set_title('RTP 6th floor, Offices 603 & 604: every wall coloured by the type the rules inferred from the drawing (red x = door with no host wall found)', fontsize=10)
plt.savefig(OUT, bbox_inches='tight'); print('wrote', OUT)
