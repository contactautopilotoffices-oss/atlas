"""Plan PNG for visual review: rooms coloured by kind with their CAD names, every seat as a dot
(colour = group), walls, glass and doors from the drawing, furniture as thin lines.
Writes <out>/<tenant>_seat_plan.png."""
import json, os, sys, collections, textwrap
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.patches import Polygon as MP
from common import args, load_flat, Frame, is_poly, outname

a = args(); C = a.cfg; F = Frame(C)
d = load_flat(a)['rec']
R = json.load(open(os.path.join(a.work, 'rooms.json'))); S = json.load(open(os.path.join(a.work, 'seats.json')))
summ = json.load(open(outname(a, '_summary.json'))) if os.path.exists(outname(a, '_summary.json')) else None
KC = {'work': '#f6d9c9', 'meeting': '#cfdcf7', 'training': '#dcd0f2', 'cafe': '#cdebd8', 'lounge': '#f7e7c4', 'reception': '#ecdff0',
      'wc': '#d5ecef', 'core': '#dcdcdc', 'service': '#e6e1d6', 'operator': '#e9e9e9', 'occupied': '#f1f1f1', 'circulation': '#fafafa', 'other': '#f7f7f4'}
GC = {'W': '#d6452b', 'M': '#2b62d6', 'T': '#7a3fc4', 'C': '#1f9a55', 'L': '#d68a1f', 'O': '#8a8a8a'}
GN = {'W': 'work (desk + chair)', 'M': 'meeting', 'T': 'training', 'C': 'cafe / pantry', 'L': 'lounge, collab, visitor', 'O': 'operator (not the tenant)'}
pl = R['plate']; xs = [p[0] for p in pl]; ys = [p[1] for p in pl]
x0, x1, y0, y1 = min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1
WALL = set(C['layers']['walls']) | set(C['layers']['column_lines']); GL = set(C['layers']['glass'])
SKIP = set(C['layers']['annotation']) | set(C['layers']['ceiling']) | set(C['layers']['lighting']) | set(C['layers']['planters'])
walls, glass, furn = [], [], []
for r in d:
    if not is_poly(r) or len(r['p']) < 2 or r.get('fill') or r['L'] in SKIP: continue
    if not any(F.inwin(q) for q in r['p']): continue
    P = [F.m(*q) for q in r['p']]
    (walls if r['L'] in WALL else glass if r['L'] in GL else furn).append(P)
W = 24; H = W * (y1 - y0) / (x1 - x0)
fig = plt.figure(figsize=(W + 8, max(H, 9)), dpi=110)
ax = fig.add_axes([0.01, 0.02, W / (W + 8) - 0.01, 0.96]); tx = fig.add_axes([W / (W + 8) + 0.005, 0.02, 8 / (W + 8) - 0.01, 0.96]); tx.axis('off')
for rm in R['rooms']:
    ax.add_patch(MP(rm['poly'], closed=True, fc=KC.get(rm['kind'], '#f7f7f4'), ec='#555', lw=.7, ls=':' if not rm['enclosed'] else '-', zorder=0))
for c_ in R.get('circulation', []):
    ax.add_patch(MP(c_['poly'], closed=True, fc='#fbfbf7', ec='#c8c3b8', lw=.4, zorder=0))
    for cl in c_.get('centreline', []): ax.plot([p[0] for p in cl], [p[1] for p in cl], color='#9bb8d3', lw=.8, ls='--', zorder=1)
for n_ in R.get('not_demised', []):
    ax.add_patch(MP(n_['poly'], closed=True, fc='#ececec', ec='#999', hatch='///', lw=.4, zorder=0))
    xs_ = [p[0] for p in n_['poly']]; ys_ = [p[1] for p in n_['poly']]
    ax.text(sum(xs_) / len(xs_), sum(ys_) / len(ys_), 'NOT DEMISED\n' + n_['why'][:60], fontsize=6, ha='center', color='#666', zorder=5)
for c_ in R.get('closures', []):
    ax.plot([c_['a'][0], c_['b'][0]], [c_['a'][1], c_['b'][1]], color='#e000a0', lw=1.6, zorder=3)
ax.add_collection(LineCollection(furn, lw=.3, color='#bdb8b0', zorder=1))
ax.add_collection(LineCollection(glass, lw=.9, color='#3aa0d8', zorder=2))
ax.add_collection(LineCollection(walls, lw=1.2, color='#222', zorder=2))
for dd in R['doors']:
    o = dd.get('opening');
    if o: ax.plot([o[0], o[2]], [o[1], o[3]], color='#c0392b', lw=1.0, zorder=3)
for s in S:
    ax.plot(s['x_m'], s['y_m'], 'o', ms=6.5, color=GC[s['grp']], mec='white', mew=.5, zorder=4, alpha=.95)
for rm in R['rooms']:
    if rm['name'].startswith('Unlabelled') or rm['area_m2'] < 2: continue
    import statistics
    px = [p[0] for p in rm['poly']]; py = [p[1] for p in rm['poly']]
    lx, ly = rm['label_xy'] if rm['label_xy'] else (sum(px) / len(px), sum(py) / len(py))
    nseat = sum(1 for s in S if s['room'] == rm['name'])
    ax.text(lx, ly, "\n".join(textwrap.wrap(rm['name'], 22)) + (f"\n{nseat} seats" if nseat else '') + f"\n{rm['area_m2']:.0f} m²",
            fontsize=5.5, ha='center', va='center', color='#222', weight='bold', zorder=5,
            bbox=dict(fc='white', ec='none', alpha=.6, pad=.6))
ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect('equal'); ax.axis('off')
cnt = collections.Counter(s['grp'] for s in S)
L = [(f"{C['name'].upper()}  |  FLOOR {a.floor}  |  SKYMARK F-1, NOIDA", 15, 'bold', '#111'),
     ("Seats and rooms read from the drawing itself", 10, 'normal', '#444'), (C.get('dwg_name', ''), 8, 'normal', '#666'), ("", 6, 'normal', 'k'),
     (f"{cnt['W']} work seats", 26, 'bold', GC['W']), (f"{len(S)} seats of every kind", 13, 'bold', '#111'), ("", 6, 'normal', 'k')]
for g in 'WMTCLO':
    if cnt[g]: L.append((f"{cnt[g]:>4}  {GN[g]}", 11, 'bold', GC[g]))
L.append(("", 6, 'normal', 'k'))
byroom = collections.Counter(s['room'] for s in S if s['grp'] == 'W')
L.append(("Work seats by room", 10, 'bold', '#111'))
for k, v in byroom.most_common(): L.append((f"  {v:>4}  {k[:40]}", 8.5, 'normal', '#222'))
L += [("", 6, 'normal', 'k'), ("Room fill = room kind; solid outline = closed room, dotted = zone in an", 7.5, 'normal', '#555'),
      ("open area (desk cluster or furniture group); white + dashed blue line =", 7.5, 'normal', '#555'),
      ("circulation and its centreline; hatched = not demised (other tenant);", 7.5, 'normal', '#555'),
      ("red ticks = door leaves (closed); magenta = hand closures (tenant json).", 7.5, 'normal', '#555'),
      ("One dot per chair block (sofas: one dot per place, stacked).", 7.5, 'normal', '#555')]
y = 0.99
for t, s_, wt, c in L: tx.text(0, y, t, fontsize=s_, weight=wt, color=c, va='top', family='DejaVu Sans Mono' if t.startswith('  ') else 'DejaVu Sans'); y -= s_ / 520 + 0.006
p = outname(a, '_seat_plan.png'); plt.savefig(p, facecolor='white'); print(p)
