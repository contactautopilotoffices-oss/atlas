"""Where does each tenant's demise sit on the Skymark plate? Registers every tenant's plan onto the
Volt first-floor frame (the frame the live twin uses) from shared building geometry, then compares
demised areas.

Registration: column centroids (the structural grid is the same on every floor). Every
tenant-column / Volt-column pair proposes a shift; the shift that brings the most columns within
0.6 m wins; then a least-squares rigid fit (rotation + shift) on the matched pairs. Lift labels,
stair cores and the plate outline are reported after the fit as independent checks.

Usage: python3 -I plate_fit.py --ref <volt layout> --tenant arcil=<layout>,<config> --tenant paytm=... --out <dir>
Writes <out>/plate_fit.json, <out>/plate_fit.md, <out>/plate_fit.png.
"""
import argparse, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon, Point, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
from common import load_cfg, IN
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MP

ap = argparse.ArgumentParser()
ap.add_argument('--ref', required=True); ap.add_argument('--ref-config', required=True)
ap.add_argument('--tenant', action='append', required=True, help='name=layout.json,config.json,floor')
ap.add_argument('--extra-ref', default=None, help='generic-pipeline Volt layout (for lifts/stairs/demise in the same format)')
ap.add_argument('--out', required=True)
a = ap.parse_args()

def cent(c): p = Polygon(c).centroid; return (p.x, p.y)
REF = json.load(open(a.ref)); RC = load_cfg(a.ref_config)
RX = json.load(open(a.extra_ref)) if a.extra_ref else REF
vcols = [cent(c) for c in RX['columns']]   # the generic Volt run reads columns over the whole plate (same frame as the live file)

def fit(cols, tol=0.6):
    best = (0, 0, 0)
    for p in cols:
        for q in vcols:
            dx, dy = q[0] - p[0], q[1] - p[1]
            sc = sum(1 for r in cols if min(math.dist(s, (r[0] + dx, r[1] + dy)) for s in vcols) < tol)
            if sc > best[0]: best = (sc, dx, dy)
    _, dx, dy = best; th = 0.0
    for _ in range(5):
        tr = lambda p: (math.cos(th) * p[0] - math.sin(th) * p[1] + dx, math.sin(th) * p[0] + math.cos(th) * p[1] + dy)
        pairs = []
        for p in cols:
            q = min(vcols, key=lambda s: math.dist(s, tr(p)))
            if math.dist(q, tr(p)) < tol: pairs.append((p, q))
        n = len(pairs); pcx = sum(p[0] for p, _ in pairs) / n; pcy = sum(p[1] for p, _ in pairs) / n
        qcx = sum(q[0] for _, q in pairs) / n; qcy = sum(q[1] for _, q in pairs) / n
        sxx = sum((p[0] - pcx) * (q[0] - qcx) + (p[1] - pcy) * (q[1] - qcy) for p, q in pairs)
        sxy = sum((p[0] - pcx) * (q[1] - qcy) - (p[1] - pcy) * (q[0] - qcx) for p, q in pairs)
        th = math.atan2(sxy, sxx)
        dx = qcx - (math.cos(th) * pcx - math.sin(th) * pcy); dy = qcy - (math.sin(th) * pcx + math.cos(th) * pcy)
    tr = lambda p: (math.cos(th) * p[0] - math.sin(th) * p[1] + dx, math.sin(th) * p[0] + math.cos(th) * p[1] + dy)
    res = [math.dist(q, tr(p)) for p, q in pairs]
    # east-west scale check (onsite re-survey vs design drawing)
    sx = None
    if len(pairs) > 4:
        xs = [(tr(p)[0], q[0]) for p, q in pairs]; mx = sum(x for x, _ in xs) / len(xs); mq = sum(q for _, q in xs) / len(xs)
        sx = sum((x - mx) * (q - mq) for x, q in xs) / sum((x - mx) ** 2 for x, _ in xs)
    return {"rot_deg": round(math.degrees(th), 3), "dx": round(dx, 3), "dy": round(dy, 3), "matched": len(pairs), "of": len(cols), "ref_cols": len(vcols),
            "resid_mean_m": round(sum(res) / len(res), 3), "resid_max_m": round(max(res), 3), "x_scale_vs_ref": round(sx, 4) if sx else None}, tr

def P(T, ring, holes=()): return Polygon([T(p) for p in ring], [[T(p) for p in h] for h in holes])
results = {}; geo = {}
geo['volt'] = {"plate": Polygon(REF['plate']), "demise": Polygon(REF['floor'][0]['outer'], REF['floor'][0].get('holes', [])), "cols": vcols,
               "lifts": [tuple(x) for x in RX.get('lifts', [])], "stairs": [s['bbox'] for s in RX.get('stairs_all', [])] or ([REF['stairs']['bbox']] if REF.get('stairs') else []),
               "floor": RC.get('floor', 1), "occupied": []}
for t in a.tenant:
    name, rest = t.split('='); lp, cp, fl = rest.split(',')
    L = json.load(open(lp)); cfg = load_cfg(cp)
    cols = [cent(c) for c in L['columns']]
    f, T = fit(cols)
    occ = [P(T, n_['poly'], n_.get('holes', [])) for n_ in L.get('not_demised', []) if 'OCCUPIED' in n_['why']] or [P(T, r['poly']) for r in L['rooms'] if r['kind'] == 'occupied']
    g = {"plate": P(T, L['plate']), "demise": P(T, L['demise']['outer'], L['demise'].get('holes', [])), "cols": [T(c) for c in cols],
         "lifts": [T(p) for p in L['lifts']], "stairs": [], "floor": int(fl), "occupied": occ, "fit": f}
    for s in L.get('stairs_all', []):
        b = s['bbox']; pg = P(T, [(b[0], b[1]), (b[2], b[1]), (b[2], b[3]), (b[0], b[3])]); g['stairs'].append(list(pg.bounds))
    geo[name] = g; results[name] = {"floor": int(fl), "fit_to_volt_frame": f, "plan_origin_in": cfg['origin_in']}

def nearest_shift(A, B):
    return [round(min(math.dist(p, q) for q in B), 3) for p in A] if A and B else []
for n, g in geo.items():
    if n == 'volt': continue
    r = results[n]
    r['lift_label_offsets_m'] = nearest_shift(g['lifts'], geo['volt']['lifts'])
    r['stair_core_offsets_m'] = [round(min(math.dist(((s[0] + s[2]) / 2, (s[1] + s[3]) / 2), ((v[0] + v[2]) / 2, (v[1] + v[3]) / 2)) for v in geo['volt']['stairs']), 3) for s in g['stairs']] if geo['volt']['stairs'] else []
    pv, pt = geo['volt']['plate'], g['plate']
    r['plate_iou_with_volt'] = round(pv.intersection(pt).area / pv.union(pt).area, 3)
    r['plate_area_m2'] = round(pt.area, 1); r['plate_bounds_volt_frame'] = [round(v, 2) for v in pt.bounds]
    r['demise_area_m2'] = round(g['demise'].area, 1); r['demise_bounds_volt_frame'] = [round(v, 2) for v in g['demise'].bounds]
    ov = g['demise'].intersection(geo['volt']['demise']).area
    r['overlap_with_volt_demise_m2'] = round(ov, 1); r['overlap_share_of_tenant'] = round(ov / g['demise'].area, 3); r['overlap_share_of_volt'] = round(ov / geo['volt']['demise'].area, 3)
    if g['occupied']:
        oc = unary_union(g['occupied']); r['occupied_area_m2'] = round(oc.area, 1)
        r['occupied_bounds_volt_frame'] = [round(v, 2) for v in oc.bounds]
names = [n for n in geo if n != 'volt']
for i, n in enumerate(names):
    for m in names[i + 1:]:
        ov = geo[n]['demise'].intersection(geo[m]['demise']).area
        results[f"{n}_x_{m}"] = {"overlap_m2": round(ov, 1), "note": "different floors" if geo[n]['floor'] != geo[m]['floor'] else "same floor"}
results['volt'] = {"floor": geo['volt']['floor'], "demise_area_m2": round(geo['volt']['demise'].area, 1), "demise_bounds": [round(v, 2) for v in geo['volt']['demise'].bounds],
                   "plate_area_m2": round(geo['volt']['plate'].area, 1), "plate_bounds": [round(v, 2) for v in geo['volt']['plate'].bounds]}
os.makedirs(a.out, exist_ok=True)
json.dump(results, open(os.path.join(a.out, 'plate_fit.json'), 'w'), indent=1)

# ---------------- overlay figure
COL = {'volt': '#d6452b', 'paytm': '#2b62d6', 'arcil': '#1f9a55'}
MK = {'volt': 'o', 'paytm': 's', 'arcil': '^'}
fig, axs = plt.subplots(2, 1, figsize=(16, 17), dpi=110)
for ax, which in zip(axs, ('First floor: Volt (R16) and Paytm (R-17) on the same plate', 'All three plans in the Volt frame (ARCIL is the 2nd floor)')):
    show = ['volt', 'paytm'] if which.startswith('First') else ['volt', 'paytm', 'arcil']
    for n in show:
        g = geo[n]; c = COL.get(n, '#555')
        x, y = g['plate'].exterior.xy; ax.plot(x, y, color=c, lw=1.0, ls='--', alpha=.8)
        from matplotlib.path import Path as MPath; from matplotlib.patches import PathPatch
        for dm in ([g['demise']] if g['demise'].geom_type == 'Polygon' else list(g['demise'].geoms)):
            rings = [list(dm.exterior.coords)] + [list(h.coords) for h in dm.interiors]
            verts = [v for r_ in rings for v in r_]; codes = [c_ for r_ in rings for c_ in [MPath.MOVETO] + [MPath.LINETO] * (len(r_) - 2) + [MPath.CLOSEPOLY]]
            ax.add_patch(PathPatch(MPath(verts, codes), fc=c, alpha=.18, ec=c, lw=1.6, label=f"{n} demise (floor {g['floor']})"))
        for oc in g['occupied']:
            ax.add_patch(MP(list(oc.exterior.coords), closed=True, fc='none', ec=c, hatch='///', lw=.6, alpha=.6))
        ax.plot([p[0] for p in g['cols']], [p[1] for p in g['cols']], MK.get(n, 'x'), ms=6, mfc='none', mec=c, label=f"{n} columns")
        ax.plot([p[0] for p in g['lifts']], [p[1] for p in g['lifts']], '+', ms=12, mew=2, color=c)
    ov = geo['volt']['demise'].intersection(geo['paytm']['demise'])
    for gg in ([ov] if ov.geom_type == 'Polygon' else [x for x in getattr(ov, 'geoms', []) if x.geom_type == 'Polygon']):
        if gg.area > 1: ax.add_patch(MP(list(gg.exterior.coords), closed=True, fc='#7a3fc4', alpha=.45, ec='#7a3fc4', lw=1.5))
    ax.set_title(which + '  (purple = Volt and Paytm demises overlap; + = lift labels; hatched = "OCCUPIED")', fontsize=10)
    ax.set_aspect('equal'); ax.legend(fontsize=7, loc='lower left', ncol=3); ax.grid(alpha=.2)
plt.tight_layout(); plt.savefig(os.path.join(a.out, 'plate_fit.png'))
print(json.dumps(results, indent=1))
