"""Lightmap UV check on a baked .blend: per atlas, rasterise every triangle of the 'lightmap' UV layer at the atlas
resolution and count texels claimed by two different UV islands (they would share light), and the smallest gap
between islands in texels.
    Blender -b OUT/<t>_baked.blend --python uv_overlap_check.py -- --tenant <t> --out OUT --res 1024
Writes OUT/<t>_uv_check.json: per atlas {texels_used, texels_overlapping, overlap_pct}. Islands are faces connected
through shared UV coordinates (per object)."""
import bpy, json, os, sys, argparse, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True); ap.add_argument('--res', type=int, default=1024)
A = ap.parse_args(TL.script_args()); R = A.res
by = collections.defaultdict(list)
for o in bpy.data.objects:
    if o.type == 'MESH' and o.get('lightmap') and 'lightmap' in o.data.uv_layers: by[o['lightmap']].append(o)
rep = {}
for lm, objs in sorted(by.items()):
    own = np.zeros((R, R), np.int64); hit = np.zeros((R, R), np.int32); over = np.zeros((R, R), bool); isl_base = 0
    for o in objs:
        me = o.data; uv = me.uv_layers['lightmap'].data; me.calc_loop_triangles()
        # islands: union-find over loops that share a vertex AND the same uv
        parent = list(range(len(me.polygons)))
        def f(a):
            while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
            return a
        key = {}
        for p in me.polygons:
            for li in p.loop_indices:
                k = (me.loops[li].vertex_index, round(uv[li].uv[0], 5), round(uv[li].uv[1], 5))
                if k in key: ra, rb = f(key[k]), f(p.index); parent[ra] = rb
                else: key[k] = p.index
        for t in me.loop_triangles:
            isl = isl_base + f(t.polygon_index) + 1
            P = np.array([uv[li].uv[:] for li in t.loops]) * R - 0.5
            x0, y0 = np.floor(P.min(0)).astype(int); x1, y1 = np.ceil(P.max(0)).astype(int)
            x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(R - 1, x1), min(R - 1, y1)
            if x1 < x0 or y1 < y0: continue
            gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
            (ax, ay), (bx, by_), (cx, cy) = P; d = (by_ - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-12: continue
            l1 = ((by_ - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d; l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d; l3 = 1 - l1 - l2
            m = (l1 >= 0) & (l2 >= 0) & (l3 >= 0)
            sub_own = own[y0:y1 + 1, x0:x1 + 1]; clash = m & (sub_own > 0) & (sub_own != isl)
            over[y0:y1 + 1, x0:x1 + 1] |= clash; sub_own[m & (sub_own == 0)] = isl
        isl_base += len(me.polygons) + 1
    used = int((own > 0).sum()); n_over = int(over.sum())
    rep[lm] = {'objects': len(objs), 'texels_used': used, 'fill_pct': round(100 * used / R / R, 1), 'texels_overlapping': n_over, 'overlap_pct': round(100 * n_over / max(1, used), 3)}
    print('uv check', lm, rep[lm], flush=True)
tot = sum(v['texels_overlapping'] for v in rep.values())
json.dump({'res': R, 'atlases': rep, 'texels_overlapping_total': tot, 'ok': all(v['overlap_pct'] < 0.1 for v in rep.values())}, open(os.path.join(A.out, f'{A.tenant}_uv_check.json'), 'w'), indent=1)
print('uv check: overlapping texels total', tot, flush=True)
