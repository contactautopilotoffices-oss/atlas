"""The city round the hero, with real facade depth where the camera can see it.

`build(spec, scene_json)` reads the scene a `scripts/world/prep.py` run writes (footprints with
heights, roads, land use, water) and builds the district in three rings round the hero:

  near  (< 120 m)   every building modelled: a plinth, floor slabs that read on the facade,
                    windows cut as recessed boxes with sills and dark glass, a parapet, and roof
                    clutter (a staircase bulkhead, a black water tank, AC units, a few solar panels);
                    bevelled edges; one of five facade finishes per building (cream plaster, sand,
                    light terracotta, warm grey, ochre), with the odd glass block
  mid   (< 400 m)   extruded with the window grid as a texture and slab lines modelled, roof plant
  far               plain extrusions in the warm palette, flat-shaded

Ground: asphalt roads, sand pavers, grass, soil, water, each a real surface the materials module
finishes. Replaces the builders' own context objects (context, rooftops, city_*, buildings*).

Give it the Overture-derived scene.json and the hero's position; `spec.city.hero_xy` is where the
hero stands in that scene's frame, and `spec.city.frame` how to move the city into the hero
scene's frame (a translation and a rotation), when the two were built in different frames.
"""
import math, os, random
from .common import *
from . import materials, vegetation

PALETTE = [(0.74, 0.62, 0.46), (0.64, 0.5, 0.36), (0.6, 0.42, 0.3), (0.58, 0.54, 0.48), (0.7, 0.55, 0.32)]
GLASS_SHARE = 0.12

def _poly_bm(ring, z0, z1, bm=None):
    bm = bm or bmesh.new(); n = len(ring)
    vb = [bm.verts.new((x, y, z0)) for x, y in ring]; vt = [bm.verts.new((x, y, z1)) for x, y in ring]
    try:
        bm.faces.new(vt); bm.faces.new(vb[::-1])
        for i in range(n): bm.faces.new((vb[i], vb[(i + 1) % n], vt[(i + 1) % n], vt[i]))
    except ValueError: pass
    return bm

def _ccw(ring):
    a = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1])); return ring if a > 0 else ring[::-1]

def _near_building(ring, h, mats, rr, col):
    """A building with modelled depth: slabs, recessed windows, parapet, roof clutter."""
    ring = _ccw(ring); FH = 3.3 if h < 20 else 3.6; floors = max(1, int(h / FH)); objs = []
    wall, glass, dark, slab = mats
    bm = _poly_bm(ring, -0.3, h); objs.append(mesh_object("city_bldg", bm, wall, col))
    # floor slab lines projecting 120 mm, and a parapet coping
    for f in range(1, floors + 1):
        z = f * FH; bm = bmesh.new()
        for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
            d = math.hypot(bx - ax, by - ay)
            if d < 1.5: continue
            nx, ny = (by - ay) / d, -(bx - ax) / d
            v = [bm.verts.new(p) for p in ((ax, ay, z - 0.25), (bx, by, z - 0.25), (bx + nx * .12, by + ny * .12, z - 0.25), (ax + nx * .12, ay + ny * .12, z - 0.25),
                                            (ax, ay, z), (bx, by, z), (bx + nx * .12, by + ny * .12, z), (ax + nx * .12, ay + ny * .12, z))]
            for f_ in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
                try: bm.faces.new([v[i] for i in f_])
                except ValueError: pass
        objs.append(mesh_object("city_slab", bm, slab, col))
    # windows: recessed 150 mm boxes, 1.6 m wide, 1.5 m high, sill at 0.9 m, every 2.6 m along each face
    bmw = bmesh.new(); bmg = bmesh.new()
    for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
        d = math.hypot(bx - ax, by - ay)
        if d < 3.0: continue
        ux, uy = (bx - ax) / d, (by - ay) / d; nx, ny = uy, -ux
        s = 1.0
        while s + 1.6 < d - 0.6:
            for f in range(floors):
                z0 = f * FH + 0.9; z1 = z0 + 1.5
                for (b_, dep0, dep1) in ((bmw, -0.15, 0.0), (bmg, -0.14, -0.13)):
                    p = lambda t, dep, z: (ax + ux * t + nx * dep, ay + uy * t + ny * dep, z)
                    v = [b_.verts.new(p(t, dep, z)) for (t, dep, z) in ((s, dep0, z0), (s + 1.6, dep0, z0), (s + 1.6, dep0, z1), (s, dep0, z1), (s, dep1, z0), (s + 1.6, dep1, z0), (s + 1.6, dep1, z1), (s, dep1, z1))]
                    for f_ in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
                        try: b_.faces.new([v[i] for i in f_])
                        except ValueError: pass
            s += 2.6
    objs.append(mesh_object("city_reveal", bmw, dark, col)); objs.append(mesh_object("city_win", bmg, glass, col))
    # parapet and roof clutter
    cx = sum(x for x, _ in ring) / len(ring); cy = sum(y for _, y in ring) / len(ring)
    objs.append(mesh_object("city_parapet", _poly_bm(ring, h, h + 0.9), wall, col))
    objs.append(box("city_bulkhead", (cx - 2.2 + rr.uniform(-2, 2), cy - 1.6, h), (cx + 2.2, cy + 1.6, h + 2.8), wall, col))
    tank = vegetation.asset_collection("prop.water_tank", None); ac = vegetation.asset_collection("prop.ac_unit", None)
    if tank:
        e = bpy.data.objects.new("city_tank", None); e.instance_type = "COLLECTION"; e.instance_collection = tank; e.location = (cx + rr.uniform(-3, 3), cy + rr.uniform(-3, 3), h); col.objects.link(e)
    else:
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.7, radius2=0.6, depth=1.3, matrix=Matrix.Translation((cx + rr.uniform(-3, 3), cy + rr.uniform(-3, 3), h + 0.65)))
        objs.append(mesh_object("city_tank", bm, dark, col))
    for k in range(rr.randint(0, 3)):
        x, y = cx + rr.uniform(-4, 4), cy + rr.uniform(-4, 4)
        objs.append(box("city_ac", (x, y, h), (x + 0.8, y + 0.4, h + 0.6), slab, col))
    for o in objs: add_bevel(o, 0.015, 2)
    return objs

def _mid_building(ring, h, wall, col):
    o = mesh_object("city_mid", _poly_bm(_ccw(ring), -0.3, h), wall, col); add_bevel(o, 0.02, 1); return o

def build(spec, scene_json, focus=(0.0, 0.0)):
    """`focus`: where the hero stands in the finished scene's frame; the rings of detail are measured from it."""
    S = load_json(scene_json); city = spec.get("city", {}); hx, hy = city.get("hero_xy", [0, 0]); fx_, fy_ = focus
    fr = city.get("frame", {}); dx, dy, rot = fr.get("dx", 0.0), fr.get("dy", 0.0), math.radians(fr.get("rot_deg", 0.0))
    ca, sa = math.cos(rot), math.sin(rot)
    def T(x, y): x, y = x - hx + dx, y - hy + dy; return (x * ca - y * sa, x * sa + y * ca)
    near_r, mid_r, far_r = city.get("near", 120), city.get("mid", 400), city.get("far", 900)
    # remove the builders' own context
    for o in list(bpy.data.objects):
        if o.name.split(".")[0] in ("context", "rooftops", "ground_far", "plaza", "buildings", "roads", "foot", "green", "water", "ground") or o.name.startswith(("city_", "bg_", "ground_far", "road_", "kerb_", "lane_", "footpath", "far_kerb", "plant_")):
            if not o.name.startswith("city_bldg"): bpy.data.objects.remove(o)
    col = collection("av_city"); rr = rng(7)
    wallmats = [materials.pbr(f"av_city_wall{i}", "tex.plaster", c, 0.85, dirt=0.45, bevel=0.012) for i, c in enumerate(PALETTE)]
    glass = materials.curtain_glass("av_city_glass", (0.15, 0.2, 0.26), 0.45, jitter=0.02); dark = materials.pbr("av_city_reveal", None, (0.12, 0.12, 0.12), 0.7, dirt=0.2, bevel=0.0)
    slab = materials.pbr("av_city_slab", "tex.concrete", (0.66, 0.65, 0.62), 0.8, dirt=0.3, bevel=0.01); gl_wall = materials.curtain_glass("av_city_glasswall", (0.2, 0.28, 0.36), 0.5)
    hero_skip = spec.get("city", {}).get("skip_opt", True)
    n_near = n_mid = n_far = 0
    for b in S["buildings"]:
        if hero_skip and b.get("opt"): continue
        ring = [T(x, y) for x, y in b["p"]]; cx = sum(x for x, _ in ring) / len(ring); cy = sum(y for _, y in ring) / len(ring); d = math.hypot(cx - fx_, cy - fy_)
        if d > far_r: continue
        j = int(b.get("r", rr.random()) * 1000) % len(PALETTE); h = float(b["h"])
        if d < near_r:
            if rr.random() < GLASS_SHARE and h > 15: _mid_building(ring, h, gl_wall, col)
            else: _near_building(ring, h, (wallmats[j], glass, dark, slab), rr, col)
            n_near += 1
        elif d < mid_r: _mid_building(ring, h, wallmats[j] if rr.random() > GLASS_SHARE else gl_wall, col); n_mid += 1
        else:
            o = mesh_object("city_far", _poly_bm(_ccw(ring), -0.3, h), wallmats[j], col); n_far += 1
    # ground: one big plane, then roads, pavements, green and water laid on it
    R = far_r + 200; gnd = box("city_ground", (fx_ - R, fy_ - R, -0.6), (fx_ + R, fy_ + R, -0.05), materials.pbr("av_city_ground", "tex.soil", (0.55, 0.47, 0.36), 0.95, dirt=0, streaks=False, bevel=0, bump=0.4), col)
    def lay(kind, z, mat):
        bm = bmesh.new(); n = 0
        for poly in S.get(kind, {}) if isinstance(S.get(kind), dict) else []: pass
        rings = S["roads"].get(kind, []) if kind in ("major", "minor", "foot") else S.get("land", {}).get(kind, []) if kind in ("green", "water") else S.get(kind, [])
        for poly in rings:
            outer = [T(x, y) for x, y in poly[0]]
            if len(outer) < 3 or max(math.hypot(x - fx_, y - fy_) for x, y in outer) > far_r + 150: continue
            try: bm.faces.new([bm.verts.new((x, y, z)) for x, y in outer]); n += 1
            except ValueError: pass
        if n: bmesh.ops.triangulate(bm, faces=bm.faces); mesh_object("city_" + kind, bm, mat, col)
        else: bm.free()
        return n
    lay("major", -0.02, materials.asphalt("av_city_asphalt", float(spec.get("wet", 0)))); lay("minor", -0.03, materials.asphalt("av_city_asphalt_minor", float(spec.get("wet", 0))))
    lay("foot", 0.06, materials.pbr("av_city_pavers", "tex.pavers", (0.58, 0.56, 0.52), 0.75, dirt=0.3, streaks=False, bevel=0, bump=0.6))
    lay("green", 0.02, materials.pbr("av_lawn", "tex.grass", (0.2, 0.33, 0.1), 0.9, dirt=0, streaks=False, bevel=0, bump=0.5))
    lay("water", -0.01, materials.pbr("av_city_water", None, (0.1, 0.17, 0.19), 0.05, dirt=0, streaks=False, bevel=0, bump=0.1))
    log(f"city: {n_near} near buildings with modelled facades, {n_mid} mid, {n_far} far; roads, pavements, green and water laid")
