"""Dump geometry for the exterior checks (run in Blender on the baked .blend; no Cycles).
usage: Blender -b _build/rtp_exterior_baked.blend --python checks_dump.py
Writes _build/checks/dump.npz + dump.json (materials per object, texture use, distances)."""
import bpy, os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exlib as X
out = os.path.join(X.BUILD, "checks"); os.makedirs(out, exist_ok=True)
dg = bpy.context.evaluated_depsgraph_get()
T = []; TO = []; names = []; base = []; baseo = []; slab_edges = {}
mats = {}
def has_image(m):
    return bool(m and m.use_nodes and any(n.type == "TEX_IMAGE" and n.image for n in m.node_tree.nodes))
objinfo = {}
for o in bpy.context.scene.objects:
    if o.type != "MESH" or o.get("prop") or o.name.startswith("PROTO"): continue
    me = o.data; mw = np.array(o.matrix_world)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
    me.calc_loop_triangles()
    tri = np.empty(len(me.loop_triangles) * 3, np.int32); me.loop_triangles.foreach_get("vertices", tri); tri = tri.reshape(-1, 3)
    if len(tri):
        oi = len(names); names.append(o.name); T.append(co[tri]); TO.append(np.full(len(tri), oi, np.int32))
    ms = [m.name if m else None for m in me.materials]
    used = set()
    mi = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get("material_index", mi)
    for i in set(mi.tolist()): used.add(ms[i] if i < len(ms) else None)
    c = co.mean(0) if len(co) else np.zeros(3)
    objinfo[o.name] = {"materials": sorted([u for u in used if u] ) , "empty_slot": None in used or len(ms) == 0, "textured": {u: has_image(bpy.data.materials.get(u)) for u in used if u},
                       "dist_m": float(np.hypot(c[0], c[1])), "ctx": o.get("ctx"), "floor": o.get("floor"), "part": o.get("part")}
    if o.get("ctx") in ("B", "C"):
        z = co[:, 2]; sel = z < 0.01; base.append(co[sel, :2]); baseo.append(np.full(int(sel.sum()), len(names) - 1, np.int32))
    if o.get("part") == "slab":
        # top-face boundary edges
        zt = co[:, 2].max(); edges = {}
        for p in me.polygons:
            if all(co[v, 2] > zt - 0.01 for v in p.vertices):
                vs = list(p.vertices)
                for a, b in zip(vs, vs[1:] + vs[:1]):
                    k = (min(a, b), max(a, b)); edges[k] = edges.get(k, 0) + 1
        bd = [k for k, n in edges.items() if n == 1]
        slab_edges[o.get("floor")] = [[co[a, :2].tolist(), co[b, :2].tolist()] for a, b in bd]
# props: prototypes once (instances share them) for the material check
for me in {o.data for o in bpy.context.scene.objects if o.get("prop")}:
    used = {m.name for m in me.materials if m}
    objinfo["proto:" + me.name] = {"materials": sorted(used), "empty_slot": len(me.materials) == 0, "textured": {u: has_image(bpy.data.materials.get(u)) for u in used}, "dist_m": 0, "ctx": "props"}
np.savez_compressed(os.path.join(out, "dump.npz"), tris=np.concatenate(T).astype(np.float64), tobj=np.concatenate(TO), base=np.concatenate(base) if base else np.zeros((0, 2)),
                    baseo=np.concatenate(baseo) if baseo else np.zeros(0, np.int32))
mat_kind = {m.name: {"kind": m.get("kind", ""), "image": has_image(m), "metallic": float(next((n.inputs["Metallic"].default_value for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), 0)) if m.use_nodes else 0}
            for m in bpy.data.materials}
json.dump({"names": names, "objects": objinfo, "slab_edges": slab_edges, "materials": mat_kind}, open(os.path.join(out, "dump.json"), "w"))
print("dumped", sum(len(t) for t in T), "triangles from", len(names), "objects")
