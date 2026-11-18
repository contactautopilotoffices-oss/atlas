"""Coplanar-surface check (the cause of ARCIL's carpet flicker): no two parallel faces closer than 2 mm that
overlap in plan.

    Blender -b OUT/<t>_geometry.blend --python coplanar_check.py -- --tenant <t> --out OUT [--min-area 0.004] [--gap 0.002]

Every face of every mesh object (chairs and plants skipped: separate catalogue models, never coplanar with the build; --skip-layers) (world space, evaluated, instances included) with an area of at least
`--min-area` m2 is bucketed by its plane (normal to 0.5 degree, offset to 1 mm). Two faces whose planes are
parallel (either facing; the web materials are double-sided) and less than `--gap` apart are a hit when their
outlines, projected on that plane, overlap by more than 1 cm2 (faces that only touch along an edge are fine).
Faces of one object that lie in one plane and touch are fine (that is one surface); faces of one object that
overlap each other are reported too. Only SAME-FACING pairs fail (both seen from one side: that is z-fighting, the
ARCIL flicker); opposite-facing coincident faces are two parts touching (a desk foot on the floor, a panel flush
with the ceiling), hidden inside the contact, and are listed as information.

Writes <out>/<t>_coplanar.json: {ok, hits (first 200), n_hits, faces_checked, by_object_pair}.
"""
import bpy, json, math, os, sys, collections, argparse
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL

ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--min-area', type=float, default=0.0005); ap.add_argument('--skip-layers', default='SEAT,PLANT,CONTEXT'); ap.add_argument('--floor-z', type=float, default=0.0); ap.add_argument('--ceiling-z', type=float, default=None); ap.add_argument('--gap', type=float, default=0.002)
A = ap.parse_args(TL.script_args())
dg = bpy.context.evaluated_depsgraph_get()
faces = []          # (obj_name, normal (unit, canonical sign), offset, triangle verts world)
hidden = [0]
for inst in dg.object_instances:
    ob = inst.object
    if ob.type != 'MESH' or ob.get('twin_layer') in A.skip_layers.split(',') or ob.name.startswith('tmp'): continue
    me = ob.data; M = inst.matrix_world.copy(); me.calc_loop_triangles()
    name = (inst.parent.name + '/' if inst.is_instance and inst.parent else '') + ob.name
    for t in me.loop_triangles:
        vs = [M @ me.vertices[i].co for i in t.vertices]
        n = (vs[1] - vs[0]).cross(vs[2] - vs[0]); ar = n.length / 2
        if ar < A.min_area: continue
        n = n.normalized()
        s = 1 if (n.z > 1e-6 or (abs(n.z) <= 1e-6 and (n.y > 1e-6 or (abs(n.y) <= 1e-6 and n.x > 0)))) else -1
        zc = sum(p.z for p in vs) / 3; up = n.z
        if abs(up) > 0.999 and ((up < 0 and zc <= A.floor_z + 0.001) or (A.ceiling_z is not None and up > 0 and zc >= A.ceiling_z - 0.001)):
            hidden[0] += 1; continue           # a face resting on the floor (facing down) or above the ceiling plane (facing up): never seen
        n = n * s; off = n.dot(vs[0])
        faces.append((name, (n.x, n.y, n.z), off, vs, s))
print('faces checked', len(faces), flush=True)
G = collections.defaultdict(lambda: collections.defaultdict(list))     # normal (0.5 deg bins) -> (object, plane offset to 0.1 mm, facing) -> triangles
for i, (nm, n, off, vs, sg) in enumerate(faces): G[(round(n[0] / 0.0087), round(n[1] / 0.0087), round(n[2] / 0.0087))][(nm, round(off, 4), sg)].append(i)
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
hits = []; pairs = collections.Counter(); CELL = 0.5; layer_pairs = collections.Counter(); samples = collections.defaultdict(list); contacts = collections.Counter()
for gk, clusters in G.items():
    if len(clusters) < 2: continue
    n0 = faces[next(iter(clusters.values()))[0]][1]
    keys = sorted(clusters, key=lambda k: k[1]); P = {}; BB = {}
    for k in keys:
        xs = []; ys = []
        for i in clusters[k]:
            P[i] = proj(faces[i][3], n0); xs += [q[0] for q in P[i]]; ys += [q[1] for q in P[i]]
        BB[k] = (min(xs), min(ys), max(xs), max(ys))
    for a_ in range(len(keys)):
        ka = keys[a_]
        for b_ in range(a_ + 1, len(keys)):
            kb = keys[b_]
            if kb[1] - ka[1] >= A.gap - 1e-5: break      # exactly 2 mm (the T-grid's designed step) passes
            if ka[0] == kb[0] and abs(kb[1] - ka[1]) < 1e-5: continue
            same = ka[2] == kb[2]      # same facing: both faces seen from one side = z-fighting. Opposite facing = two parts touching (contact)
            ba, bb = BB[ka], BB[kb]
            if ba[2] <= bb[0] or bb[2] <= ba[0] or ba[3] <= bb[1] or bb[3] <= ba[1]: continue
            grid = collections.defaultdict(list)
            for j in clusters[kb]:
                xs = [q[0] for q in P[j]]; ys = [q[1] for q in P[j]]
                for cx in range(math.floor(min(xs) / CELL), math.floor(max(xs) / CELL) + 1):
                    for cy in range(math.floor(min(ys) / CELL), math.floor(max(ys) / CELL) + 1): grid[(cx, cy)].append(j)
            found = 0.0; where = None
            for i in clusters[ka]:
                xs = [q[0] for q in P[i]]; ys = [q[1] for q in P[i]]; done = set()
                for cx in range(math.floor(min(xs) / CELL), math.floor(max(xs) / CELL) + 1):
                    for cy in range(math.floor(min(ys) / CELL), math.floor(max(ys) / CELL) + 1):
                        for j in grid.get((cx, cy), ()):
                            if j in done: continue
                            done.add(j); ov = clip_area(P[i], P[j])
                            if ov > 1e-6:
                                found += ov
                                if where is None: where = faces[i][3]
                if found > 1e-3: break
            if found > 1e-4 and not same:
                contacts[('/'.join(sorted(x.split('_')[1] if x.count('_') >= 2 else x for x in (ka[0], kb[0]))))] += 1; continue
            if found > 1e-4:
                pairs[(ka[0].split('.')[0], kb[0].split('.')[0])] += 1
                lp = '/'.join(sorted(x.split('_')[1] if x.count('_') >= 2 else x for x in (ka[0], kb[0]))); layer_pairs[lp] += 1
                if len(samples[lp]) < 4: samples[lp].append({'a': ka[0], 'b': kb[0], 'gap_mm': round(abs(kb[1] - ka[1]) * 1000, 2), 'normal': [round(v, 2) for v in n0], 'at': [round(sum(p.x for p in where) / 3, 2), round(sum(p.y for p in where) / 3, 2), round(sum(p.z for p in where) / 3, 3)]})
                if len(hits) < 200: hits.append({'a': ka[0], 'b': kb[0], 'gap_mm': round(abs(kb[1] - ka[1]) * 1000, 2), 'overlap_cm2_at_least': round(found * 1e4, 1),
                                                 'at': [round(sum(p.x for p in where) / 3, 2), round(sum(p.y for p in where) / 3, 2), round(sum(p.z for p in where) / 3, 3)]})
n_hits = sum(pairs.values())
rep = {'ok': n_hits == 0, 'n_hits': n_hits, 'faces_checked': len(faces), 'gap_m': A.gap, 'min_area_m2': A.min_area,
       'hidden_faces_skipped': hidden[0], 'hidden_rule': 'faces facing down at the finished floor, and faces facing up at or above the ceiling plane, are never seen (they rest on the floor or sit above the ceiling) and are not checked',
       'by_layer_pair': dict(layer_pairs.most_common()), 'contacts_opposite_facing_info': dict(contacts.most_common()), 'samples_by_layer_pair': samples,
       'by_object_pair': [{'a': a_, 'b': b_, 'n': v} for (a_, b_), v in pairs.most_common(60)], 'hits': hits,
       'method': __doc__.split('\n\n')[1].replace('\n', ' ')}
json.dump(rep, open(os.path.join(A.out, f'{A.tenant}_coplanar.json'), 'w'), indent=1)
print('coplanar: ok' if rep['ok'] else f'coplanar: {n_hits} overlapping face pairs closer than {A.gap * 1000:.0f} mm', flush=True)
print('  by layer pair:', dict(layer_pairs.most_common()), flush=True)
for p in rep['by_object_pair'][:10]: print('  ', p, flush=True)
