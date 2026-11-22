"""The rest of Andheri out to the horizon (diorama.py --far-field RADIUS_M).

The district slab is about 1.1 km across. Beyond its edge the camera used to see the HDRI photo's ground (a bridge, a
car park). This adds every Overture footprint outside the slab, within RADIUS of the slab's centre, as a simple
extrusion at its surveyed or satellite height. The walls use one procedural window-grid material (lit windows at
dusk through the hero's 'night' value), on a ground plane that runs to the radius. Aerial haze hides the low detail.
It is deliberately cheap: one mesh, no textures, about 10 faces per building.
"""
import math
import bpy, bmesh
from shapely.geometry import Polygon, Point

def _mat(name, base, rough, window=False):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Roughness"].default_value = rough
    if window:
        # a 3 m x 3.2 m window grid on object coordinates, with per-window variation; walls tinted by a per-building value
        tc = nt.nodes.new("ShaderNodeTexCoord"); br = nt.nodes.new("ShaderNodeTexBrick")
        br.inputs["Scale"].default_value = 1.0; br.offset = 0.0; br.squash = 1.0
        br.inputs["Mortar Size"].default_value = 0.55; br.inputs["Brick Width"].default_value = 3.0; br.inputs["Row Height"].default_value = 3.2
        br.inputs["Color1"].default_value = tuple(c * 0.42 for c in base) + (1,); br.inputs["Color2"].default_value = tuple(c * 0.5 for c in base) + (1,)
        br.inputs["Mortar"].default_value = (*base, 1)
        sep = nt.nodes.new("ShaderNodeSeparateXYZ"); cmb = nt.nodes.new("ShaderNodeCombineXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs[0])
        # walls are vertical: use (x+y) along the wall and z up
        add = nt.nodes.new("ShaderNodeMath"); add.operation = "ADD"
        nt.links.new(sep.outputs[0], add.inputs[0]); nt.links.new(sep.outputs[1], add.inputs[1])
        nt.links.new(add.outputs[0], cmb.inputs[0]); nt.links.new(sep.outputs[2], cmb.inputs[1])
        nt.links.new(cmb.outputs[0], br.inputs["Vector"])
        at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_type = "GEOMETRY"; at.attribute_name = "tint"
        mul = nt.nodes.new("ShaderNodeMixRGB"); mul.blend_type = "MULTIPLY"; mul.inputs[0].default_value = 1
        nt.links.new(br.outputs["Color"], mul.inputs[1]); nt.links.new(at.outputs["Color"], mul.inputs[2])
        nt.links.new(mul.outputs[0], b.inputs["Base Color"])
        # lit windows at dusk: brick fac (1 inside a window) x random-per-cell x the scene's 'night' value on the far-field object
        nz = nt.nodes.new("ShaderNodeTexWhiteNoise"); nt.links.new(br.outputs["Fac"], nz.inputs[0])
        sn = nt.nodes.new("ShaderNodeTexCoord")
        snap = nt.nodes.new("ShaderNodeVectorMath"); snap.operation = "SNAP"; snap.inputs[1].default_value = (3.0, 3.0, 3.2)
        nt.links.new(cmb.outputs[0], snap.inputs[0]); nt.links.new(snap.outputs[0], nz.inputs["Vector"])
        gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.82
        nt.links.new(nz.outputs["Value"], gt.inputs[0])
        win = nt.nodes.new("ShaderNodeMath"); win.operation = "LESS_THAN"; win.inputs[1].default_value = 0.5
        nt.links.new(br.outputs["Fac"], win.inputs[0])
        a1 = nt.nodes.new("ShaderNodeMath"); a1.operation = "MULTIPLY"; nt.links.new(gt.outputs[0], a1.inputs[0]); nt.links.new(win.outputs[0], a1.inputs[1])
        ob = nt.nodes.new("ShaderNodeAttribute"); ob.attribute_type = "OBJECT"; ob.attribute_name = "night"
        a2 = nt.nodes.new("ShaderNodeMath"); a2.operation = "MULTIPLY"; nt.links.new(a1.outputs[0], a2.inputs[0]); nt.links.new(ob.outputs["Fac"], a2.inputs[1])
        a3 = nt.nodes.new("ShaderNodeMath"); a3.operation = "MULTIPLY"; a3.inputs[1].default_value = 0.45; nt.links.new(a2.outputs[0], a3.inputs[0])
        try: b.inputs["Emission Color"].default_value = (1.0, 0.78, 0.5, 1)
        except Exception: pass
        nt.links.new(a3.outputs[0], b.inputs["Emission Strength"])
    return m

def build(S, ctx):
    OX, OY, SLAB, R = ctx["OX"], ctx["OY"], ctx["SLAB"], ctx["radius"]
    c = SLAB.centroid; inner = SLAB.buffer(-2)
    bm = bmesh.new(); tint = bm.loops.layers.color.new("tint")
    walls, roofs = 0, 0
    n = 0
    for b in S["buildings"]:
        p = Polygon(b["p"])
        if not p.is_valid or p.area < 25: continue
        cc = p.centroid
        if inner.contains(cc) or cc.distance(c) > R: continue
        h = max(3.0, float(b.get("h", 9)))
        ring = [(x - OX, y - OY) for x, y in p.simplify(0.8).exterior.coords][:-1]
        if len(ring) < 3: continue
        r_ = (hash((round(cc.x), round(cc.y))) % 1000) / 1000.0
        col = [(0.78, 0.74, 0.66), (0.72, 0.7, 0.66), (0.8, 0.72, 0.62), (0.66, 0.66, 0.64), (0.75, 0.68, 0.6)][int(r_ * 5)]
        vb = [bm.verts.new((x, y, 0.0)) for x, y in ring]; vt = [bm.verts.new((x, y, h)) for x, y in ring]
        for i in range(len(ring)):
            j = (i + 1) % len(ring)
            try:
                f = bm.faces.new((vb[i], vb[j], vt[j], vt[i])); f.material_index = 0
                for l in f.loops: l[tint] = (*col, 1)
                walls += 1
            except ValueError: pass
        try:
            f = bm.faces.new(vt); f.material_index = 1; roofs += 1
            for l in f.loops: l[tint] = (0.6, 0.58, 0.55, 1)
        except ValueError: pass
        n += 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("farfield"); bm.to_mesh(me); bm.free()
    me.materials.append(_mat("FF_wall", (0.78, 0.74, 0.68), 0.85, window=True)); me.materials.append(_mat("FF_roof", (0.5, 0.49, 0.47), 0.9))
    ob = bpy.data.objects.new("farfield", me); bpy.context.scene.collection.objects.link(ob); ob["night"] = 0.0
    # ground to the radius, just under the slab's surface so the slab's cut edge is hidden
    gm = bpy.data.meshes.new("farground"); bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, radius=R + 400, segments=96)
    bm.to_mesh(gm); bm.free()
    gm.materials.append(_mat("FF_ground", (0.33, 0.32, 0.29), 0.95))
    go = bpy.data.objects.new("farground", gm); bpy.context.scene.collection.objects.link(go)
    go.location = (c.x - OX, c.y - OY, -0.12)
    print("far field:", n, "buildings,", walls, "walls, radius", R, "m")
