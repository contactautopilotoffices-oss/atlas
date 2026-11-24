"""Figures for the PDF report, drawn from the outputs (nothing new is computed):
  views/input_layers.png        the drawing as read, by its own layers (603/604 clip)
  views/linework_by_type.png    the same drawing lines, coloured by the type the rules gave the element built from them
  views/trace_example.png       one door and its host walls: the drawing lines they came from, highlighted
    python -I report_figs.py <work_dir> <out_dir> <views_dir> <door_id>
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.patches import Patch
from lib import load_json, cfg, pts_of, centroid, inbox

WORK, OUT, VIEWS, DOOR = sys.argv[1:5]
C = cfg(); OFF = C['offer_clip_m']
T = load_json(os.path.join(OUT, 'trace_data.json'))
E = T['elements']
TYPE_COL = {'glass_partition': '#1fa2d6', 'full_height_glass': '#0b6e99', 'pop_gypsum': '#e8b04a', 'mixed': '#d9480f', 'brick_block': '#a0522d',
            'rcc': '#555555', 'curtain_wall': '#3b5bdb', 'acp': '#9c36b5', 'window_glazing': '#66d9e8', 'panel_partial_height': '#8f6fbf',
            'railing': '#222222', 'unknown': '#ff2d95', 'door': '#d6336c', 'column': '#777777'}


def tof(eid):
    e = E.get(eid)
    if not e:
        return None
    return e['type']['value'] if e['cls'] == 'wall' else ('door' if e['cls'] == 'opening' else 'column')


def segs(l):
    p = l['p']
    return [(p[i], p[i + 1]) for i in range(0, len(p), 2)]


# ---- 1. input by layer
flat = load_json(os.path.join(WORK, 'flat.json.gz'))
LCOL = {'walls': '#000000', 'wall hatch': '#c8c8c8', 'WS-WALL': '#d62728', 'WS-WALL-PRTN': '#ff7f0e', 'WS-WALL-PHRT': '#8c564b', 'WS-GLAZ-GLAS': '#17becf',
        'STRUCTURAL GLAZING': '#1f77b4', 'WINDOW': '#9467bd', 'A.C.P.CLADDING': '#e377c2', 'A.C.P. CLADDING': '#e377c2', 'Column': '#2ca02c',
        'Structural Column': '#2ca02c', 'I-FURN': '#bcbd22', 'RAILING': '#aa00aa', 'DOOR': '#0000ff', 'DR-GLASS': '#00aaff', 'WS-DOOR': '#0000ff',
        'WS-DOOR-GLAZ': '#00aaff', 'RCC  FINS': '#555500', 'duct': '#aa5500', 'STAIR': '#999999', 'WS-FURN': '#e6e6e6'}
by = {}
for r in flat['rec']:
    L = r['L']
    if r['t'] in ('INSERT', 'TEXT', 'MTEXT', 'DIMENSION', 'HATCH'):
        continue
    key = L if L in LCOL else ('DOOR' if (r['ch'] and r['top'] in ('DOOR_SNGL', 'A$C9e4b0bea', 'D-750', 'Glass Door', 'A$C03859404')) else None)
    if key is None:
        continue
    p = pts_of(r)
    if len(p) < 2 or not isinstance(p[0], list):
        continue
    c = centroid(p)
    if not inbox(c[0], c[1], OFF):
        continue
    by.setdefault(key, []).append(p)
W = 22; H = W * (OFF[3] - OFF[1]) / (OFF[2] - OFF[0]) + 1.0
fig, ax = plt.subplots(figsize=(W, H), dpi=110)
for L in ['WS-FURN'] + [k for k in by if k != 'WS-FURN']:
    if L in by:
        ax.add_collection(LineCollection(by[L], colors=LCOL[L], linewidths=0.25 if L in ('WS-FURN', 'wall hatch') else 0.7))
ax.legend(handles=[Patch(color=LCOL[k], label=k) for k in by if k not in ('WS-FURN',)] + [Patch(color='#e6e6e6', label='WS-FURN (furniture)')],
          loc='upper center', bbox_to_anchor=(0.5, -0.01), ncol=8, fontsize=9, frameon=False)
ax.set_xlim(OFF[0], OFF[2]); ax.set_ylim(OFF[1], OFF[3]); ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
plt.savefig(os.path.join(VIEWS, 'input_layers.png'), bbox_inches='tight'); plt.close(fig)

# ---- 2. drawing lines coloured by inferred type
fig, ax = plt.subplots(figsize=(W, H), dpi=110)
grey, coll = [], {}
for l in T['lines']:
    if 'p' not in l:
        continue
    t = tof(l['el'][0]) if l.get('el') else None
    (coll.setdefault(t, []) if t else grey).append(segs(l))
ax.add_collection(LineCollection(grey, colors='#d0d0d0', linewidths=0.35))
for t, ss in coll.items():
    ax.add_collection(LineCollection(ss, colors=TYPE_COL[t], linewidths=0.9))
ax.legend(handles=[Patch(color=TYPE_COL[t], label=t.replace('_', ' ')) for t in TYPE_COL if t in coll] + [Patch(color='#d0d0d0', label='not part of any element')],
          loc='upper center', bbox_to_anchor=(0.5, -0.01), ncol=8, fontsize=9, frameon=False)
ax.set_xlim(OFF[0], OFF[2]); ax.set_ylim(OFF[1], OFF[3]); ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
plt.savefig(os.path.join(VIEWS, 'linework_by_type.png'), bbox_inches='tight'); plt.close(fig)

# ---- 3. one traced door
d = E[DOOR]
ids = {DOOR} | ({d['host']['value']} if d['host']['value'] else set()) | set(d['cad'].get('flanking_walls', []))
(x0, y0), (x1, y1) = d['line']['value']; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; R = 3.2
fig, ax = plt.subplots(figsize=(9, 6.6), dpi=140)
hi, near = [], []
for l in T['lines']:
    if 'p' not in l:
        continue
    pp = segs(l)
    if not any(abs(px - cx) < R * 1.5 and abs(py - cy) < R for px, py in pp):
        continue
    (hi if l.get('el') and set(l['el']) & ids else near).append((pp, l))
ax.add_collection(LineCollection([p for p, _ in near], colors='#c8c8c8', linewidths=0.6))
for pp, l in hi:
    t = tof(l['el'][0])
    ax.add_collection(LineCollection([pp], colors=TYPE_COL.get(t, 'red'), linewidths=2.2))
labs = {}
for pp, l in hi:
    if l['el'][0] in labs:
        continue
    labs[l['el'][0]] = l['h']
    mx = sum(p[0] for p in pp) / len(pp); my = sum(p[1] for p in pp) / len(pp)
    ax.annotate(f"{l['el'][0]}  (drawing handle {l['h']}, layer {l['L']})", (mx, my), xytext=(mx, my + 0.9 if l['el'][0] != DOOR else my - 1.1),
                fontsize=8, arrowprops=dict(arrowstyle='-', color='#555'), ha='center')
ax.plot([x0, x1], [y0, y1], color='#d6336c', lw=4, alpha=0.5)
ax.set_xlim(cx - R * 1.5, cx + R * 1.5); ax.set_ylim(cy - R, cy + R); ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
ax.set_title(f'{DOOR} and its host walls: the drawing lines they were built from (coloured), everything else grey', fontsize=9)
plt.savefig(os.path.join(VIEWS, 'trace_example.png'), bbox_inches='tight'); plt.close(fig)
print('figures written')
