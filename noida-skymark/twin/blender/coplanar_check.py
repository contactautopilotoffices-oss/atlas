"""Coplanar-surface check (the cause of ARCIL's carpet flicker): no two parallel faces closer than 2 mm that
overlap in plan.

    Blender -b OUT/<t>_geometry.blend --python coplanar_check.py -- --tenant <t> --out OUT [--min-area 0.004] [--gap 0.002]

Every face of every visible mesh object (world space, evaluated, instances included) with an area of at least
`--min-area` m2 is bucketed by its plane (normal to 0.5 degree, offset to 1 mm). Two faces whose planes are
parallel (either facing; the web materials are double-sided) and less than `--gap` apart are a hit when their
outlines, projected on that plane, overlap by more than 1 cm2 (faces that only touch along an edge are fine).
Faces of one object that lie in one plane and touch are fine (that is one surface); faces of one object that
overlap each other are reported too.

Writes <out>/<t>_coplanar.json: {ok, hits (first 200), n_hits, faces_checked, by_object_pair}.
"""
import bpy, json, math, os, sys, collections, argparse
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL

ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--min-area', type=float, default=0.0005); ap.add_argument('--gap', type=float, default=0.002)
A = ap.parse_args(TL.script_args())
dg = bpy.context.evaluated_depsgraph_get()
faces = []          # (obj_name, normal (unit, canonical sign), offset, triangle verts world)
for inst in dg.object_instances:
    ob = inst.object
    if ob.type != 'MESH' or ob.get('twin_layer') in ('CONTEXT',) or ob.name.startswith('tmp'): continue
    me = ob.data; M = inst.matrix_world.copy(); me.calc_loop_triangles()
    name = (inst.parent.name + '/' if inst.is_instance and inst.parent else '') + ob.name
    for t in me.loop_triangles:
        vs = [M @ me.vertices[i].co for i in t.vertices]
        n = (vs[1] - vs[0]).cross(vs[2] - vs[0]); ar = n.length / 2
        if ar < A.min_area: continue
        n = n.normalized()
        s = 1 if (n.z > 1e-6 or (abs(n.z) <= 1e-6 and (n.y > 1e-6 or (abs(n.y) <= 1e-6 and n.x > 0)))) else -1
        n = n * s; off = n.dot(vs[0])
        faces.append((name, (n.x, n.y, n.z), off, vs))
print('faces checked', len(faces), flush=True)
G = collections.defaultdict(list)          # normal direction (0.5 degree bins) -> faces
for i, (nm, n, off, vs) in enumerate(faces): G[(round(n[0] / 0.0087), round(n[1] / 0.0087), round(n[2] / 0.0087))].append(i)
def proj(vs, n):
    n = Vector(n); u = n.orthogonal().normalized(); v = n.cross(u)
    P = [(p.dot(u), p.dot(v)) for p in vs]
    if (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]) < 0: P = P[::-1]
    return P
def clip_area(P, Q):
    """Area of the intersection of two counter-clockwise convex polygons (Sutherland-Hodgman)."""
    out = P
    for k in range(len(Q)):
        a, b = Q[k], Q[(k + 1) % len(Q)]; inp = out; out = []
        if not inp: break
        side = lambda p: (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        for m in range(len(inp)):
            c, d = inp[m], inp[(m + 1) % len(inp)]; sc, sd = side(c), side(d)
            if sc >= 0: out.append(c)
            if (sc >= 0) != (sd >= 0):
                t = sc / (sc - sd); out.append((c[0] + t * (d[0] - c[0]), c[1] + t * (d[1] - c[1])))
    if len(out) < 3: return 0.0
    return abs(sum(out[i][0] * out[(i + 1) % len(out)][1] - out[(i + 1) % len(out)][0] * out[i][1] for i in range(len(out)))) / 2
hits = []; pairs = collections.Counter(); CELL = 2.0
for gk, idx in G.items():
    if len(idx) < 2: continue
    n0 = faces[idx[0]][1]; P = {i: proj(faces[i][3], n0) for i in idx}; grid = collections.defaultdict(list)
    for i in idx:
        xs = [q[0] for q in P[i]]; ys = [q[1] for q in P[i]]
        for cx in range(math.floor(min(xs) / CELL), math.floor(max(xs) / CELL) + 1):
            for cy in range(math.floor(min(ys) / CELL), math.floor(max(ys) / CELL) + 1): grid[(cx, cy)].append(i)
    seen = set()
    for cell, ids in grid.items():
        ids.sort(key=lambda i: faces[i][2])
        for a_ in range(len(ids)):
            i = ids[a_]; nm, n, off, vs = faces[i]
            for b_ in range(a_ + 1, len(ids)):
                j = ids[b_]; nm2, n2, off2, vs2 = faces[j]
                if off2 - off >= A.gap: break
                if (i, j) in seen: continue
                seen.add((i, j))
                if nm == nm2 and abs(off - off2) < 1e-5: continue            # one surface of one object
                ov = clip_area(P[i], P[j])
                if ov > 1e-4:
                    pairs[(nm.split('.')[0], nm2.split('.')[0])] += 1
                    if len(hits) < 200: hits.append({'a': nm, 'b': nm2, 'gap_mm': round(abs(off - off2) * 1000, 2), 'overlap_cm2': round(ov * 1e4, 1),
                                                     'at': [round(sum(p.x for p in vs) / 3, 2), round(sum(p.y for p in vs) / 3, 2), round(sum(p.z for p in vs) / 3, 3)]})
n_hits = sum(pairs.values())
rep = {'ok': n_hits == 0, 'n_hits': n_hits, 'faces_checked': len(faces), 'gap_m': A.gap, 'min_area_m2': A.min_area,
       'by_object_pair': [{'a': a_, 'b': b_, 'n': v} for (a_, b_), v in pairs.most_common(60)], 'hits': hits,
       'method': __doc__.split('\n\n')[1].replace('\n', ' ')}
json.dump(rep, open(os.path.join(A.out, f'{A.tenant}_coplanar.json'), 'w'), indent=1)
print('coplanar: ok' if rep['ok'] else f'coplanar: {n_hits} overlapping face pairs closer than {A.gap * 1000:.0f} mm', flush=True)
for p in rep['by_object_pair'][:15]: print('  ', p, flush=True)
