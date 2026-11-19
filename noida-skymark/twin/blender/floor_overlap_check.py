"""Floor finishes: every point of the floor must have exactly one finish. Rasterises the upward faces of every floor
finish mesh (FLOOR layer, static) on a 5 cm grid and reports the area covered by two or more finishes.
    Blender -b OUT/<t>_geometry.blend --python floor_overlap_check.py -- --tenant <t> --out OUT [--cell 0.05] [--max-m2 0.01]
Writes OUT/<t>_floor_overlap.json {ok, overlap_m2, pairs}."""
import bpy, json, os, sys, argparse, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True); ap.add_argument('--cell', type=float, default=0.05); ap.add_argument('--max-m2', type=float, default=0.01)
A = ap.parse_args(TL.script_args()); c = A.cell
objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('twin_layer') == 'FLOOR' and o.get('static')]
tri = []
for k, o in enumerate(objs):
    me = o.data; me.calc_loop_triangles(); M = o.matrix_world
    for t in me.loop_triangles:
        v = [M @ me.vertices[i].co for i in t.vertices]
        if ((v[1] - v[0]).cross(v[2] - v[0])).z > 1e-9: tri.append((k, [(p.x, p.y) for p in v]))
xs = [p[0] for _, v in tri for p in v]; ys = [p[1] for _, v in tri for p in v]
x0, y0 = min(xs), min(ys); nx, ny = int((max(xs) - x0) / c) + 2, int((max(ys) - y0) / c) + 2
own = np.full((ny, nx), -1, np.int32); over = np.zeros((ny, nx), bool); pairs = collections.Counter()
for k, v in tri:
    P = (np.array(v) - (x0, y0)) / c - 0.5
    i0, j0 = np.floor(P.min(0)).astype(int); i1, j1 = np.ceil(P.max(0)).astype(int)
    i0, j0 = max(0, i0), max(0, j0); i1, j1 = min(nx - 1, i1), min(ny - 1, j1)
    if i1 < i0 or j1 < j0: continue
    gy, gx = np.mgrid[j0:j1 + 1, i0:i1 + 1]
    (ax, ay), (bx, by), (cx, cy) = P; d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(d) < 1e-12: continue
    l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d; l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
    m = (l1 > 1e-6) & (l2 > 1e-6) & (1 - l1 - l2 > 1e-6)
    sub = own[j0:j1 + 1, i0:i1 + 1]; clash = m & (sub >= 0) & (sub != k)
    if clash.any():
        for kk in np.unique(sub[clash]): pairs[tuple(sorted((objs[k].name, objs[kk].name)))] += int((clash & (sub == kk)).sum())
    over[j0:j1 + 1, i0:i1 + 1] |= clash; sub[m & (sub < 0)] = k
area = float(over.sum()) * c * c
rep = {'ok': area <= A.max_m2, 'overlap_m2': round(area, 4), 'cell_m': c, 'finishes': len(objs),
       'pairs': [{'a': a, 'b': b, 'm2': round(n * c * c, 3)} for (a, b), n in pairs.most_common(20)]}
json.dump(rep, open(os.path.join(A.out, f'{A.tenant}_floor_overlap.json'), 'w'), indent=1)
print('floor finishes:', 'ok' if rep['ok'] else 'OVERLAP', rep['overlap_m2'], 'm2', rep['pairs'][:3], flush=True)
