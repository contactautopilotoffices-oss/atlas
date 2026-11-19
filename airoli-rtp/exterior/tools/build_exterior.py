"""Build the Reliable Tech Park exterior scene in Blender from _build/prep/prep.json (no lock needed: no Cycles here).
usage: Blender -b --factory-startup --python build_exterior.py
Writes _build/rtp_exterior.blend. Collections: rtp_L00..rtp_L09, rtp_ROOF (each also a parent empty of the same name),
ctx_classB, ctx_classC, ctx_ground, ctx_roads, ctx_props_<kind>, terrain."""
import bpy, bmesh, math, os, sys, json, random, time
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exlib as X
from exlib import MB, pbr, glass, coll, lin, tile_of

T0 = time.time()
P = json.load(open(os.path.join(X.BUILD, "prep", "prep.json")))
TER = np.load(os.path.join(X.BUILD, "prep", "terrain.npz"))
RNG = random.Random(4242)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.unit_settings.system = "METRIC"
NOTES = []

# ================================================================ materials
M = {}
def m_floor_set(tag):
    sfx = f"_{tag}" if tag else ""
    M["slab" + sfx] = pbr("rtp_slab" + sfx, "#ffffff", tex="concrete", rough=0.85, web={"lightmap": True})
    M["acp" + sfx] = pbr("rtp_acp" + sfx, "#ffffff", tex="acp", rough=0.3, metal=0.75, web={"lightmap": True})
    M["glass" + sfx] = glass("facade_glass" + sfx, tint="#6d9a98", reflect=0.34)
m_floor_set(""); m_floor_set("L04"); m_floor_set("L06")
M["mullion"] = pbr("rtp_mullion", "#3c4146", rough=0.35, metal=0.85)
M["spine"] = pbr("rtp_spine", "#ffffff", tex="render_grey", rough=0.45, metal=0.35, web={"lightmap": True})
M["white"] = pbr("rtp_render_white", "#e9e7e2", tex="concrete", rough=0.7, web={"lightmap": True})
M["plinth"] = pbr("rtp_plinth", "#7b746b", tex="concrete", rough=0.8, web={"lightmap": True})
M["roof"] = pbr("rtp_roof", "#ffffff", tex="terrace_roof", rough=0.9, web={"lightmap": True})
M["dome"] = pbr("rtp_dome", "#f3f2ee", rough=0.35, coat=0.3, web={"lightmap": True})
M["steel"] = pbr("rtp_steel", "#a7abaf", rough=0.3, metal=1.0)
M["rail_glass"] = glass("rail_glass", tint="#8fb3b0", reflect=0.12, transmit_tint="#d5e6e4")
M["sign_red"] = pbr("sign_red", "#c8102e", rough=0.4, emit_color="#ff1a2e", emit_strength=0.4); M["sign_red"]["emit_night"] = 14.0
M["sign_white"] = pbr("sign_white", "#f4f4f4", rough=0.4, emit_color="#ffffff", emit_strength=0.3); M["sign_white"]["emit_night"] = 9.0
M["machine"] = pbr("rtp_plant_grey", "#8d9195", rough=0.6, metal=0.4)
INT = {}
lit_night = {0: 1.0, 1: 1.0, 2: 0.85, 3: 1.0, 4: 1.0, 5: 0.7, 6: 1.0, 7: 0.9, 8: 0.6, 9: 0.8}
for n in range(10):
    m = pbr(f"rtp_interior_L{n:02d}", "#ffffff", tex="rtp_interior_base", rough=0.9, emit_tex="rtp_interior_emit", emit_strength=0.25)
    m["emit_night"] = round(3.2 * lit_night[n], 2); m["floor"] = n; INT[n] = m
# context
CM = {}
for k, tex, rough, metal in (("asphalt", "asphalt", 0.9, 0), ("paving", "paving", 0.85, 0), ("court_paving", "court_paving", 0.8, 0), ("kerb", "kerb", 0.75, 0),
                             ("ballast", "ballast", 0.95, 0), ("water", "water", 0.05, 0)):
    CM[k] = pbr("ctx_" + k, "#ffffff", tex=tex, rough=rough, metal=metal)
CM["marking"] = pbr("road_marking", "#e8e6df", rough=0.6, web={"polygonOffset": -2})
CM["median"] = pbr("ctx_median_grass", "#ffffff", tex="lawn", rough=0.9)
GMAT = {"ground_lawn": "lawn", "ground_mud": "mud", "water": "water", "ground_gravel": "gravel", "ground_compound": "compound", "ground_dirt": "dirt",
        "ground_industrial": "industrial_yard", "ground_paved": "paving", "ground_construction": "construction", "ground_forest": "forest_floor",
        "ground_crop": "crop", "ground_scrub": "scrub", "ground_base": "dry_grass", "ground_court_paving": "court_paving"}
for g, tex in GMAT.items():
    if "ctx_" + g not in bpy.data.materials:
        CM[g] = pbr("ctx_" + g, "#ffffff", tex=tex, rough=0.05 if g == "water" else 0.92, web={"ground_ao": True})
CM["house_a"] = pbr("ctx_house_wall_a", "#ffffff", tex="house_wall_a", vcol=True, rough=0.85, emit_tex="house_wall_a_emit", emit_strength=0.0)
CM["house_b"] = pbr("ctx_house_wall_b", "#ffffff", tex="house_wall_b", vcol=True, rough=0.85, emit_tex="house_wall_b_emit", emit_strength=0.0)
CM["block"] = pbr("ctx_block_wall", "#ffffff", tex="block_wall", vcol=True, rough=0.85, emit_tex="block_wall_emit", emit_strength=0.0)
CM["cladding"] = pbr("ctx_cladding", "#ffffff", tex="cladding", vcol=True, rough=0.45, metal=0.5)
CM["tin"] = pbr("ctx_tin_roof", "#ffffff", tex="tin_roof", vcol=True, rough=0.5, metal=0.55)
CM["terracotta"] = pbr("ctx_terracotta_roof", "#ffffff", tex="terracotta_roof", vcol=True, rough=0.8)
CM["terrace"] = pbr("ctx_terrace_roof", "#ffffff", tex="terrace_roof", vcol=True, rough=0.92)
for k in ("house_a", "house_b", "block"): CM[k]["emit_night"] = 1.6
CM["b_glass"] = pbr("ctxB_glass_curtain", "#ffffff", tex="office_glass", rough=0.12, metal=0.55, emit_tex="office_glass_emit", web={"lightmap": True})
CM["b_glass2"] = pbr("ctxB_glass_curtain_b", "#ffffff", tex="office_glass_b", rough=0.12, metal=0.55, emit_tex="office_glass_b_emit", web={"lightmap": True})
CM["b_punched"] = pbr("ctxB_punched", "#ffffff", tex="office_punched", rough=0.7, emit_tex="office_punched_emit", web={"lightmap": True})
CM["b_industrial"] = pbr("ctxB_industrial", "#d9dde0", tex="cladding", rough=0.45, metal=0.5, web={"lightmap": True})
CM["b_louvre"] = pbr("ctxB_parking_louvre", "#ffffff", tex="louvre", rough=0.5, metal=0.6, web={"lightmap": True})
CM["b_roof"] = pbr("ctxB_roof", "#ffffff", tex="terrace_roof", rough=0.9, web={"lightmap": True})
CM["b_parapet"] = pbr("ctxB_parapet", "#c9c6bf", tex="concrete", rough=0.8, web={"lightmap": True})
for k in ("b_glass", "b_glass2", "b_punched"): CM[k]["emit_night"] = 0.65
CM["terrain"] = pbr("terrain", "#ffffff", tex="dry_grass", vcol=True, rough=0.95)

# ================================================================ RTP
R = P["rtp"]
def ext(rings): return rings[0]
def is_ccw(r):
    a = 0.0
    for i in range(len(r)):
        x0, y0 = r[i]; x1, y1 = r[(i + 1) % len(r)]; a += x0 * y1 - x1 * y0
    return a > 0
root = coll("RTP")
FLOOR_OBJS = {}
def parent_empty(name, colx):
    e = bpy.data.objects.new(name, None); colx.objects.link(e); e["rtp_floor"] = name; return e

def build_floor(f):
    n = f["level"]; nm = f["name"]; ffl = f["ffl"]
    c = coll(nm, root); par = parent_empty(nm, c)
    tag = f"L{n:02d}" if n in (4, 6) else ""
    sfx = f"_{tag}" if tag else ""
    mslab, macp, mgl = M["slab" + sfx], M["acp" + sfx], M["glass" + sfx]
    objs = []
    top_floor = (n == 10)
    gz0 = ffl                                                # glass bottom: on the slab (the band hides the lower 0.4 m outside)
    gz1 = ffl + 3.35                                         # glass top: the soffit of the slab above
    vz0, vz1 = ffl + 0.40, ffl + 3.15                        # vision zone between the ACP bands
    # slab (top + soffit)
    V2, F = f["slab_tri"]; mb = MB()
    zbot = ffl - 0.25 if n > 0 else 0.0
    mb.tris(V2, F, ffl, mslab if not top_floor else M["roof"], tile_of("concrete") if not top_floor else tile_of("terrace_roof"))
    if n > 0: mb.tris(V2, F, zbot, mslab, tile_of("concrete"), flip=True)      # L00 has no soffit (it would sit on the ground)
    o = mb.flush(f"{nm}_slab", c); objs.append(o); o["part"] = "slab"
    # ACP band at the slab edge (outer face 50 mm proud), caps
    mb = MB(); ring = ext(f["band"])
    t = tile_of("acp")
    if n == 0:
        mb.quad_strip(ring, 0.0, ffl, M["plinth"], tile_of("concrete"), offset=0.05)
    else:
        zb0, zb1 = ffl - 0.45, (ffl + 0.40 if not top_floor else ffl + 1.20)
        mb.quad_strip(ring, zb0, zb1, macp, (t[0], 1.0), offset=0.05)
        # caps: horizontal strips between the inner line (-0.12) and the outer face (+0.05)
        outer = X.offset_ring([tuple(p) for p in ring] + [tuple(ring[0])], 0.05); inner = X.offset_ring([tuple(p) for p in ring] + [tuple(ring[0])], -0.12)
        for i in range(len(outer) - 1):
            for z, up in ((zb1, True), (zb0, False)):
                q = [(*inner[i], z), (*outer[i], z), (*outer[i + 1], z), (*inner[i + 1], z)]
                if not up: q = q[::-1]
                mb.face(q, [(p[0] / t[0], p[1]) for p in q], macp)
        if top_floor:      # parapet inner face
            mb.quad_strip(ring, ffl, zb1, macp, (t[0], 1.0), offset=-0.12, outward=False)
    if f.get("band_own") and f["band_own"] != f["band"] and not top_floor:
        mb.quad_strip(ext(f["band_own"]), ffl, ffl + 0.40, macp, (t[0], 1.0), offset=0.02)
    o = mb.flush(f"{nm}_acp", c); objs.append(o); o["part"] = "acp"
    if top_floor: return c, par, objs
    # glass ribbons (and solid spandrel panels where the CAD has RCC fins)
    mbg = MB(); mbs = MB()
    for run in f["runs"]:
        if len(run["pts"]) < 2: continue
        if run["tag"] == "solid": mbs.quad_strip(run["pts"], gz0, gz1, macp, (t[0], 1.0), closed=False, offset=0.03)
        else: mbg.quad_strip(run["pts"], gz0, gz1, mgl, (3.0, 3.0), closed=False)
    o = mbg.flush(f"{nm}_glass", c); objs.append(o); o["part"] = "glass"
    if mbs.F: o = mbs.flush(f"{nm}_solid", c); objs.append(o); o["part"] = "acp"
    # mullions
    mb = MB()
    for x, y, a in f["mullions"]:
        cx, cy = x + 0.076 * math.sin(a), y - 0.076 * math.cos(a)            # fully outside the glass plane
        mb.box((cx, cy, 0), (0.06, 0.14, gz1 - gz0 - 0.004), a, M["mullion"], z0=gz0 + 0.002, bottom=False, top=False)
    o = mb.flush(f"{nm}_mullions", c, merge=0); objs.append(o); o["part"] = "mullions"
    # spine piers, RCC fins and ribs, round columns
    mb = MB()
    for x, y, a in f.get("spine", []):
        cx, cy = x + 0.22 * math.sin(a), y - 0.22 * math.cos(a)
        zp0 = (ffl - 0.45) if n else ffl
        mb.box((cx, cy, 0), (0.16, 0.36, ffl + 3.15 - zp0), a, M["spine"], tile_of("render_grey"), z0=zp0, bottom=(n == 0), top=False)
    for rings in R["fins"] + R["ribs"]:
        r_ = ext(rings)
        mb.quad_strip(r_, (ffl - 0.45) if n else 0.0, ffl + 3.15, M["spine"], tile_of("render_grey"), outward=True)     # stacks onto the next floor's ffl - 0.45
    for x, y, r in R["round_cols"]:
        mb.cyl(x, y, ffl if n else 0.0, gz1, r, M["white"], seg=14, tile=tile_of("concrete"), caps=False)
    o = mb.flush(f"{nm}_fins", c); objs.append(o); o["part"] = "fins"
    # interior backdrop (emissive office floor seen through the glass)
    mb = MB(); ir = ext(f["interior"]); off = RNG.uniform(0, 40)
    mb.quad_strip(ir, vz0, vz1, INT[n], (40.0, 2.75), u0=off)
    mb.UV = [(u, (v * 2.75 - vz0) / (vz1 - vz0)) for u, v in mb.UV]       # v 0..1 over the vision zone
    o = mb.flush(f"{nm}_interior", c); objs.append(o); o["part"] = "interior"
    # terrace balustrade
    if f.get("rail"):
        mb = MB()
        for pl in f["rail"]:
            mb.quad_strip(pl, ffl, ffl + 1.1, M["rail_glass"], (2, 2), closed=False, offset=-0.15)
            pts = X.offset_ring([tuple(p) for p in pl], -0.15, closed=False)
            for i in range(len(pts) - 1):
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]; L = math.hypot(x1 - x0, y1 - y0)
                if L < 0.05: continue
                mb.box(((x0 + x1) / 2, (y0 + y1) / 2, 0), (L, 0.06, 0.06), math.atan2(y1 - y0, x1 - x0), M["steel"], z0=ffl + 1.1)
        o = mb.flush(f"{nm}_railing", c); objs.append(o); o["part"] = "railing"
    return c, par, objs

for f in R["floors"]:
    c, par, objs = build_floor(f)
    for o in objs:
        o.parent = par; o["floor"] = f["name"]; o["level"] = f["level"]; o["static"] = 1
    FLOOR_OBJS[f["name"]] = objs
    par["ffl"] = f["ffl"]; par["level"] = f["level"]

# lobby (levels 0-1 at the inner corner), canopy
cx, cy = R["inner_corner"]; c0 = bpy.data.collections["rtp_L00"]; par0 = bpy.data.objects["rtp_L00"]
lob = [(cx - 9.0, cy), (cx, cy - 9.0)]
mb = MB()
mb.quad_strip([lob[0], lob[1]], 0.6, 7.28, M["glass"], (3, 3), closed=False, outward=True)
d = (lob[1][0] - lob[0][0], lob[1][1] - lob[0][1]); Ld = math.hypot(*d); a = math.atan2(d[1], d[0])
for i in range(1, int(Ld / R["module"])):
    s = i * Ld / int(Ld / R["module"]); x, y = lob[0][0] + d[0] * s / Ld, lob[0][1] + d[1] * s / Ld
    mb.box((x - 0.05 * math.sin(a + math.pi), y + 0.05 * math.cos(a + math.pi), 0), (0.07, 0.16, 6.75), a, M["mullion"], z0=0.6)
tri_ = [(cx - 9.0, cy), (cx, cy - 9.0), (cx, cy)]
mb.tris(tri_, [[0, 1, 2]], 0.585, M["slab"], tile_of("concrete"))
mb.tris(tri_, [[0, 1, 2]], 7.95, M["roof"], tile_of("terrace_roof")); mb.tris(tri_, [[0, 1, 2]], 7.28, M["slab"], tile_of("concrete"), flip=True)
mb.quad_strip([lob[0], lob[1]], 7.28, 7.95, M["acp"], (tile_of("acp")[0], 1), closed=False, offset=0.05, outward=True)
can = [(cx - 14.0, cy), (cx, cy - 14.0), (cx, cy - 9.0), (cx - 9.0, cy)]
mb.tris(can, [[0, 1, 2], [0, 2, 3]], 5.1, M["acp"], tile_of("acp")); mb.tris(can, [[0, 1, 2], [0, 2, 3]], 4.8, M["white"], tile_of("concrete"), flip=True)
mb.quad_strip([can[0], can[1]], 4.8, 5.1, M["acp"], (tile_of("acp")[0], 1), closed=False, outward=True)
for t_ in (0.25, 0.75):
    x, y = can[0][0] + (can[1][0] - can[0][0]) * t_ + 0.6, can[0][1] + (can[1][1] - can[0][1]) * t_ + 0.6
    mb.cyl(x, y, 0.6, 4.8, 0.22, M["steel"], seg=12)
o = mb.flush("rtp_L00_lobby", c0); o.parent = par0; o["floor"] = "rtp_L00"; o["static"] = 1; o["part"] = "lobby"; FLOOR_OBJS["rtp_L00"].append(o)

# roof: plant rooms, chillers, drums, dome, sign
cR = bpy.data.collections["rtp_ROOF"]; parR = bpy.data.objects["rtp_ROOF"]; rz = R["roof_z"]
mb = MB()
for (x, y, w, dd, h, a) in ((22.0, 40.0, 7.0, 5.5, 3.4, 0.0), (-13.0, 95.0, 7.5, 5.0, 3.4, 0.0), (38.0, 100.0, 6.0, 5.0, 3.4, 0.0), (20.0, 88.0, 5.5, 5.0, 3.2, 0.785)):
    mb.box((x, y, 0), (w, dd, h), a, M["white"], tile_of("concrete"), z0=rz, bottom=False)
for i in range(6):
    mb.box((30.0 + (i % 2) * 4.0, 62.0 + (i // 2) * 3.2, 0), (3.2, 2.2, 1.9), 0.0, M["machine"], z0=rz, bottom=False)
for i in range(3):
    mb.cyl(28.0 + i * 3.4, 76.0, rz, rz + 2.6, 1.5, M["machine"], seg=16, bottom=False)
for d_ in R["drums"]:
    x, y = d_["c"]; r = d_["r"]; z0 = d_["z0"]
    mb.cyl(x, y, z0, z0 + 1.4, r, M["acp"], seg=48, tile=(tile_of("acp")[0], 1.0), caps=False)
    mb.cyl(x, y, z0 + 1.4, z0 + 4.4, r - 0.08, M["glass"], seg=48, tile=(3, 3), caps=False)
    mb.cyl(x, y, z0 + 4.4, z0 + d_["h"], r, M["acp"], seg=48, tile=(tile_of("acp")[0], 1.0), caps=True)
    for k in range(24):     # mullions on the drum glass band
        a = 2 * math.pi * k / 24
        mb.box((x + (r - 0.02) * math.cos(a), y + (r - 0.02) * math.sin(a), 0), (0.08, 0.12, 3.0), a + math.pi / 2, M["mullion"], z0=z0 + 1.4)
o = mb.flush("rtp_ROOF_plant", cR); o.parent = parR; o["floor"] = "rtp_ROOF"; o["static"] = 1; o["part"] = "roof_plant"; FLOOR_OBJS["rtp_ROOF"].append(o)
for d_ in R["drums"]:
    if not d_.get("dome"): continue
    x, y = d_["c"]; r = d_["r"]; z0 = d_["z0"] + d_["h"]
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=r)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS")
    for v in bm.verts: v.co.z *= 0.6
    me = bpy.data.meshes.new("rtp_ROOF_dome"); bm.to_mesh(me); bm.free(); me.materials.append(M["dome"])
    for p in me.polygons: p.use_smooth = True
    uv = me.uv_layers.new(name="UVMap")
    for lp in me.loops:
        co = me.vertices[lp.vertex_index].co; uv.data[lp.index].uv = (co.x / 4 + 0.5, co.y / 4 + 0.5)
    od = bpy.data.objects.new("rtp_ROOF_dome", me); od.location = (x, y, z0); cR.objects.link(od); od.parent = parR
    od["floor"] = "rtp_ROOF"; od["static"] = 1; od["part"] = "dome"; FLOOR_OBJS["rtp_ROOF"].append(od)
    # a small lantern on the dome
    mb = MB(); mb.cyl(x, y, z0 + r * 0.6 - 0.2, z0 + r * 0.6 + 1.2, 0.6, M["steel"], seg=16); ol = mb.flush("rtp_ROOF_lantern", cR); ol.parent = parR; ol["floor"] = "rtp_ROOF"; ol["static"] = 1; FLOOR_OBJS["rtp_ROOF"].append(ol)

def sign():
    S = R["sign"]; d_ = next(d for d in R["drums"] if d["name"] == S["drum"]); x0, y0 = d_["c"]; Rr = d_["r"] + 0.25
    fnt = bpy.data.fonts.load("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
    def text_mesh(txt, size, mat):
        cu = bpy.data.curves.new("t_" + txt, "FONT"); cu.body = txt; cu.font = fnt; cu.size = size; cu.extrude = 0.08; cu.align_x = "LEFT"; cu.resolution_u = 3
        ob = bpy.data.objects.new("t_" + txt, cu); sc.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
        me.materials.clear(); me.materials.append(mat); return me
    th = math.radians(S["facing_deg_from_east"]); zc = d_["z0"] + 1.9
    me = text_mesh(S["text"], S["letter_h"] / 0.72, M["sign_red"])
    xs = [v.co.x for v in me.vertices]; W = max(xs) - min(xs); xmin = min(xs)
    lg = text_mesh("R", S["letter_h"] * 1.35 / 0.72, M["sign_white"]); lxs = [v.co.x for v in lg.vertices]; LW = max(lxs) - min(lxs)
    total = LW + 0.9 + W
    def wrap(m_, xoff):
        for v in m_.vertices:
            s = v.co.x - xoff - total / 2; a = th + s / Rr; rr = Rr + v.co.z
            v.co = Vector((x0 + rr * math.cos(a), y0 + rr * math.sin(a), zc + v.co.y))
        m_.update()
    wrap(me, xmin - LW - 0.9); wrap(lg, min(lxs))
    for nm_, m_ in (("rtp_ROOF_sign_RELIABLE", me), ("rtp_ROOF_sign_logo", lg)):
        uv = m_.uv_layers.get("UVMap") or (m_.uv_layers[0] if len(m_.uv_layers) else m_.uv_layers.new(name="UVMap")); uv.name = "UVMap"
        o = bpy.data.objects.new(nm_, m_); cR.objects.link(o); o.parent = parR; o["floor"] = "rtp_ROOF"; o["static"] = 1; o["part"] = "sign"; FLOOR_OBJS["rtp_ROOF"].append(o)
    # backing plate ring segment behind the letters (dark), so the letters read by day
    mb = MB(); seg = 40; a0 = th - (total / 2 + 0.8) / Rr; a1 = th + (total / 2 + 0.8) / Rr
    ring = [(x0 + (Rr - 0.06) * math.cos(a0 + (a1 - a0) * i / seg), y0 + (Rr - 0.06) * math.sin(a0 + (a1 - a0) * i / seg)) for i in range(seg + 1)]
    mb.quad_strip(ring, zc - 0.5, zc + S["letter_h"] * 1.35 + 0.4, M["mullion"], (2, 2), closed=False)
    o = mb.flush("rtp_ROOF_sign_back", cR); o.parent = parR; o["floor"] = "rtp_ROOF"; o["static"] = 1; o["part"] = "sign"; FLOOR_OBJS["rtp_ROOF"].append(o)
sign()
print(f"RTP built ({time.time() - T0:.0f} s)", flush=True)

# ================================================================ context: ground, roads
cG = coll("ctx_ground"); cRd = coll("ctx_roads")
by_mat = {}
for gp in P["ground"]: by_mat.setdefault(gp["mat"], []).append(gp["tri"])
ZG = {}
for i, gp in enumerate(P["ground"]): ZG.setdefault(gp["mat"], 0.003 * (len(P["ground"]) - i))       # each land-use layer its own plane, 3 mm apart
for g, lst in by_mat.items():
    mb = MB(); t0_ = tile_of(GMAT.get(g, "dry_grass")); k_ = 1.0 if g in ("ground_court_paving", "ground_paved") else 2.6
    t = (t0_[0] * k_, t0_[1] * k_)              # natural ground: noise tiles stretched to 20-35 m so the repeat does not read
    for V2, F in lst: mb.tris(V2, F, ZG[g], CM.get(g, CM["ground_base"]) if g in CM else CM["ground_base"], t)
    o = mb.flush(f"ctx_ground_{g}", cG, merge=0); o["ctx"] = "ground"; o["ground_ao"] = 1
RD = P["roads"]
ZR = 0.07                     # carriageway 7 cm above the ground layers (kerb faces cover the step)
mb = MB(); mb.tris(*RD["road"], ZR, CM["asphalt"], tile_of("asphalt")); o = mb.flush("ctx_road_asphalt", cRd, merge=0); o["ctx"] = "road"; o["ground_ao"] = 1
mb = MB(); mb.tris(*RD["footpath"], 0.15, CM["paving"], tile_of("paving")); o = mb.flush("ctx_footpath", cRd, merge=0); o["ctx"] = "road"; o["ground_ao"] = 1
mb = MB(); mb.tris(*RD["median"], 0.2, CM["median"], tile_of("lawn")); o = mb.flush("ctx_median", cRd, merge=0); o["ctx"] = "road"
mb = MB(); mb.tris(*RD["rail_bed"], ZR, CM["ballast"], tile_of("ballast")); o = mb.flush("ctx_rail_bed", cRd, merge=0); o["ctx"] = "road"
# kerbs: vertical faces along every footpath / median boundary (outward faces on outer rings, inward on holes)
mb = MB()
for rings in RD["kerb_rings"]:
    for i, r_ in enumerate(rings):
        h = 0.15
        mb.quad_strip(r_, 0.0, h, CM["kerb"], (1.0, 0.3), outward=True)
o = mb.flush("ctx_kerbs", cRd, merge=0); o["ctx"] = "road"
mb = MB(); mb.tris(*RD["marks_tri"], ZR + 0.012, CM["marking"], (1, 1))
o = mb.flush("ctx_markings", cRd, merge=0); o["ctx"] = "road"
mb = MB()
for pl in RD["rail_lines"]:
    for side in (-2.4, 2.4):
        for g_ in (-0.84, 0.84):
            a_ = X.offset_ring([tuple(p) for p in pl], side + g_ - 0.035, closed=False); b_ = X.offset_ring([tuple(p) for p in pl], side + g_ + 0.035, closed=False)
            mb.quad_strip(b_, ZR, ZR + 0.16, M["steel"], (1, 1), closed=False); mb.quad_strip(a_, ZR, ZR + 0.16, M["steel"], (1, 1), closed=False, outward=False)
o = mb.flush("ctx_rails", cRd, merge=0); o["ctx"] = "road"
print(f"ground + roads ({time.time() - T0:.0f} s)", flush=True)

# ================================================================ context: buildings
cB = coll("ctx_classB"); cC = coll("ctx_classC")
PAL = ["#f2ede4", "#e9e2cf", "#d9e3e6", "#f0d9c8", "#e6e0b8", "#cfd8c4", "#efc9b9", "#d8d2e6", "#f5f2ec", "#c9d3dc", "#e8d8b0", "#bcd0d8"]
def tint(hexs, k=1.0, a=1.0):
    c = lin(hexs); return (min(1, c[0] * k), min(1, c[1] * k), min(1, c[2] * k), a)
def walls_ao(mb, ring, z0, h, m, tile, tc, ztop=None):
    zm = min(z0 + 2.6, z0 + h * 0.5)
    c0 = (tc[0] * 0.58, tc[1] * 0.58, tc[2] * 0.58, 1); cm = (tc[0] * 0.9, tc[1] * 0.9, tc[2] * 0.9, 1)
    mb.quad_strip(ring, z0, zm, m, tile, col0=c0, col1=cm, outward=True)
    zt = None if ztop is None else ztop
    mb.quad_strip(ring, zm, z0 + h if ztop is None else 0, m, tile, col0=cm, col1=tc, outward=True, ztop=zt)

TANK_POS = []; STAIR = []
classC_mb = {}      # per 250 m tile -> MB
def cmb(x, y):
    k = (int(math.floor(x / 250.0)), int(math.floor(y / 250.0)))
    if k not in classC_mb: classC_mb[k] = MB()
    return classC_mb[k], k
for b in P["buildings"]:
    rings = b["ring"]; ex_ = rings[0]; h = b["h"]; rr = random.Random(b["seed"])
    xs = [p[0] for p in ex_]; ys = [p[1] for p in ex_]; cxb, cyb = sum(xs) / len(xs), sum(ys) / len(ys)
    if b["cls"] == "B":
        mb = MB(); fac = b["facade"]
        wm = {"glass": CM["b_glass"] if rr.random() < 0.6 else CM["b_glass2"], "punched": CM["b_punched"], "industrial": CM["b_industrial"]}[fac]
        tile = tile_of({"glass": "office_glass", "punched": "office_punched", "industrial": "cladding"}[fac])
        z0 = 0.0
        if b.get("podium"):
            ph = b["podium"] * 3.0
            for r_ in rings: mb.quad_strip(r_, 0.0, ph, CM["b_louvre"], tile_of("louvre"), outward=True)
            mb.tris(*b["tri"], ph, CM["b_roof"], tile_of("terrace_roof"))
            # tower above the podium on the footprint (setback approximated by the same ring at 1 m inset is skipped for robustness)
            z0 = ph
        for r_ in rings: mb.quad_strip(r_, z0, h, wm, tile, outward=True)
        for r_ in rings: mb.quad_strip(r_, h, h + 1.1, CM["b_parapet"], tile_of("concrete"), outward=True)
        mb.tris(*b["tri"], h, CM["b_roof"], tile_of("terrace_roof"))
        if b.get("parapet_in"):
            for r_ in b["parapet_in"]: mb.quad_strip(r_, h, h + 1.1, CM["b_parapet"], tile_of("concrete"), outward=False)
        # rooftop units
        for i in range(max(1, int(b["area"] / 900))):
            px_, py_ = cxb + rr.uniform(-6, 6), cyb + rr.uniform(-6, 6)
            mb.box((px_, py_, 0), (rr.uniform(3, 6), rr.uniform(2.5, 4), rr.uniform(1.8, 3.2)), b["axis"], CM["b_parapet"], tile_of("concrete"), z0=h, bottom=False)
        o = mb.flush(f"ctxB_{b['label'][:24].replace(' ', '_')}_{b['id'][:6]}", cB); o["ctx"] = "B"; o["label"] = b["label"]; o["static"] = 1; o["h"] = h
        o["h_src"] = b["h_src"]
        for t_ in b.get("tanks", []): TANK_POS.append((t_[0], t_[1], h, t_[2]))
        continue
    mb, key = cmb(cxb, cyb)
    tc = tint(rr.choice(PAL), rr.uniform(0.85, 1.05))
    typ = b["type"]; roof = b["roof"]
    if typ == "shed":
        wall_m, wall_t = CM["cladding"], tile_of("cladding"); tc = tint(rr.choice(["#d9dde0", "#c4ccd3", "#e6e6e2", "#a9b7c4", "#d0c9b8"]))
    elif typ == "block": wall_m, wall_t = CM["block"], tile_of("block_wall")
    else: wall_m, wall_t = (CM["house_a"] if rr.random() < 0.5 else CM["house_b"]), tile_of("house_wall_a")
    # roof geometry
    if roof in ("tin", "terracotta", "shed_gable", "shed_mono") and not (roof in ("terracotta", "shed_gable") and b["rect"]):
        # mono-pitch: z = h + slope * dot(p - c, dir)
        ang = b["axis"] + (math.pi / 2 if rr.random() < 0.5 else 0) + (math.pi if rr.random() < 0.5 else 0)
        dx, dy = math.cos(ang), math.sin(ang); slope = 0.10 if roof in ("tin", "shed_mono", "shed_gable") else 0.22
        dmin = min((p[0] - cxb) * dx + (p[1] - cyb) * dy for p in ex_)
        zf = lambda x, y: h + slope * (((x - cxb) * dx + (y - cyb) * dy) - dmin)
        for r_ in rings: walls_ao(mb, r_, 0.0, h, wall_m, wall_t, tc, ztop=[zf(*p) for p in r_])
        rm = CM["tin"] if roof in ("tin", "shed_mono", "shed_gable") else CM["terracotta"]
        rt = tile_of("tin_roof") if rm is CM["tin"] else tile_of("terracotta_roof")
        rc = tint("#ffffff", rr.uniform(0.85, 1.1))
        mb.tris(*b["tri"], 0, rm, rt, col=rc, zf=zf)
    elif roof in ("terracotta", "shed_gable"):
        q = b["mrr"]; e01 = math.dist(q[0], q[1]); e12 = math.dist(q[1], q[2])
        if e01 < e12: q = q[1:] + q[:1]
        a_, b_, c_, d_ = q; wdt = min(e01, e12); rise = wdt * (0.32 if roof == "terracotta" else 0.15)
        ra = ((a_[0] + d_[0]) / 2, (a_[1] + d_[1]) / 2); rb = ((b_[0] + c_[0]) / 2, (b_[1] + c_[1]) / 2)
        ring = [a_, b_, c_, d_]
        if not is_ccw(ring): ring = ring[::-1]; a_, b_, c_, d_ = ring; ra, rb = ((a_[0] + b_[0]) / 2, (a_[1] + b_[1]) / 2), ((c_[0] + d_[0]) / 2, (c_[1] + d_[1]) / 2)
        walls_ao(mb, ring, 0.0, h, wall_m, wall_t, tc)
        rm = CM["terracotta"] if roof == "terracotta" else CM["tin"]; rt = tile_of("terracotta_roof") if roof == "terracotta" else tile_of("tin_roof")
        rc = tint("#ffffff", rr.uniform(0.85, 1.1))
        # recompute ridge on the actual long axis of the ccw ring
        A, Bp, C, D = [tuple(p) for p in ring]
        if math.dist(A, Bp) >= math.dist(Bp, C): r1, r2 = ((A[0] + D[0]) / 2, (A[1] + D[1]) / 2), ((Bp[0] + C[0]) / 2, (Bp[1] + C[1]) / 2); quads = ((A, Bp, r2, r1), (C, D, r1, r2)); gab = ((D, A, r1), (Bp, C, r2))
        else: r1, r2 = ((A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2), ((C[0] + D[0]) / 2, (C[1] + D[1]) / 2); quads = ((Bp, C, r2, r1), (D, A, r1, r2)); gab = ((A, Bp, r1), (C, D, r2))
        ov = 0.0
        for qd in quads:
            pts = [(p[0], p[1], h + (rise if p in (r1, r2) else 0)) for p in qd]
            mb.face(pts, [(p[0] / rt[0], (p[1] + p[2]) / rt[1]) for p in pts], rm, [rc] * 4)
        for tg in gab:
            pts = [(p[0], p[1], h + (rise if p in (r1, r2) else 0)) for p in tg]
            mb.face(pts, [(math.hypot(p[0], p[1]) / wall_t[0], p[2] / wall_t[1]) for p in pts], wall_m, [tc] * 3)
    else:
        for r_ in rings: walls_ao(mb, r_, 0.0, h + 0.9, wall_m, wall_t, tc)        # walls run up as the parapet
        mb.tris(*b["tri"], h, CM["terrace"], tile_of("terrace_roof"), col=tint("#ffffff", rr.uniform(0.8, 1.05)))
        if b.get("stairhead"):
            sx, sy, sa = b["stairhead"]; mb.box((sx, sy, 0), (2.6, 3.0, 2.6), sa, wall_m, wall_t, col=tc, z0=h, bottom=False)
        for t_ in b.get("tanks", []): TANK_POS.append((t_[0], t_[1], h, t_[2]))
for key, mb in classC_mb.items():
    o = mb.flush(f"ctxC_tile_{key[0]}_{key[1]}", cC, merge=0); o["ctx"] = "C"
print(f"buildings ({time.time() - T0:.0f} s), tanks {len(TANK_POS)}", flush=True)

# ================================================================ props (prototype meshes + linked duplicates)
cP = coll("ctx_props")
PM = {}
PM["trunk"] = pbr("prop_trunk", "#6b5a48", tex="concrete", rough=0.9)
PM["palm_trunk"] = pbr("prop_palm_trunk", "#8a7b66", tex="concrete", rough=0.9)
PM["frond"] = pbr("prop_palm_frond", "#ffffff", tex="palm_frond", alpha_tex=True, rough=0.6, web={"alphaMode": "MASK"})
PM["leaf"] = pbr("prop_leaf", "#ffffff", tex="leaf_card", alpha_tex=True, rough=0.65, web={"alphaMode": "MASK"})
PM["tank_black"] = pbr("prop_tank_black", "#1d1e1f", rough=0.5)
PM["tank_white"] = pbr("prop_tank_white", "#d9d6cf", rough=0.6)
PM["metal"] = pbr("prop_metal_grey", "#6f7378", rough=0.4, metal=0.9)
PM["lamp_head"] = pbr("prop_lamp_led", "#d9d9d9", rough=0.3, emit_color="#ffe2b8", emit_strength=0.0); PM["lamp_head"]["emit_night"] = 30.0
PM["tyre"] = pbr("prop_tyre", "#151515", rough=0.8)
PM["car_glass"] = pbr("prop_car_glass", "#0f1418", rough=0.08, metal=0.3)
PM["bus_body"] = pbr("prop_bus_body", "#e9eef0", rough=0.35, coat=0.5)
PM["bus_band"] = pbr("prop_bus_band", "#1f5aa6", rough=0.35, coat=0.5)
PM["lattice"] = pbr("prop_lattice_steel", "#9a9fa4", rough=0.45, metal=0.9)
PM["insulator"] = pbr("prop_insulator", "#7d5a43", rough=0.3)
PM["transformer"] = pbr("prop_transformer", "#6e7c69", rough=0.5, metal=0.4)
PM["conductor"] = pbr("prop_conductor", "#3a3d40", rough=0.4, metal=1.0)
PM["wall"] = pbr("prop_compound_wall", "#ffffff", tex="concrete", rough=0.85)
CAR_COLS = ["#f3f3f1", "#f3f3f1", "#e8e8e6", "#b9bdc1", "#9aa0a6", "#4a4f55", "#a32a2a", "#22324d"]
for i, c in enumerate(CAR_COLS): PM[f"car{i}"] = pbr(f"prop_car_paint_{i}", c, rough=0.25, metal=0.5, coat=0.8)

def proto(name, mb):
    o = mb.flush("PROTO_" + name, cP, merge=0.0); me = o.data; me.name = "proto_" + name; bpy.data.objects.remove(o); return me

def make_palm(h, seed):
    r = random.Random(seed); mb = MB(); bend = r.uniform(0.4, 1.2); ang = r.uniform(0, 6.28); seg = 8
    pts = [(bend * (t / seg) ** 2 * math.cos(ang), bend * (t / seg) ** 2 * math.sin(ang), h * t / seg) for t in range(seg + 1)]
    for i in range(seg):
        (x0, y0, z0), (x1, y1, z1) = pts[i], pts[i + 1]; r0 = 0.24 - 0.08 * i / seg; r1 = 0.24 - 0.08 * (i + 1) / seg
        for k in range(8):
            a0, a1 = 2 * math.pi * k / 8, 2 * math.pi * (k + 1) / 8
            q = [(x0 + r0 * math.cos(a0), y0 + r0 * math.sin(a0), z0), (x0 + r0 * math.cos(a1), y0 + r0 * math.sin(a1), z0),
                 (x1 + r1 * math.cos(a1), y1 + r1 * math.sin(a1), z1), (x1 + r1 * math.cos(a0), y1 + r1 * math.sin(a0), z1)]
            mb.face(q, [(k / 8, z0 / 0.6), ((k + 1) / 8, z0 / 0.6), ((k + 1) / 8, z1 / 0.6), (k / 8, z1 / 0.6)], PM["palm_trunk"])
    tx, ty, tz = pts[-1]
    for k in range(13):
        a = 2 * math.pi * k / 13 + r.uniform(-0.2, 0.2); L = r.uniform(3.4, 4.4); droop = r.uniform(0.25, 0.6) + (0.3 if k % 3 == 0 else 0)
        n = 6; w = 0.75
        prev = None
        for i in range(n + 1):
            t = i / n; d = L * t; z = tz + 0.4 + d * 0.5 - droop * (d ** 2) / L * 1.6
            cxp, cyp = tx + d * math.cos(a), ty + d * math.sin(a); nx, ny = -math.sin(a) * w / 2, math.cos(a) * w / 2
            cur = ((cxp - nx, cyp - ny, z + 0.05), (cxp + nx, cyp + ny, z + 0.05), t)
            if prev:
                q = [prev[0], cur[0], cur[1], prev[1]]; mb.face(q, [(prev[2], 0), (cur[2], 0), (cur[2], 1), (prev[2], 1)], PM["frond"])
            prev = cur
    for k in range(4):
        a = k * math.pi / 2; mb.cyl(tx + 0.25 * math.cos(a), ty + 0.25 * math.sin(a), tz - 0.15, tz + 0.15, 0.13, PM["tank_black"] if False else PM["trunk"], seg=6)
    return proto(f"palm_{seed}", mb)

def make_tree(h, crown_r, seed, small=False):
    r = random.Random(seed); mb = MB()
    th = h * (0.42 if not small else 0.35)
    mb.cyl(0, 0, 0, th + 0.5, 0.22 if not small else 0.12, PM["trunk"], seg=8, r1=0.14 if not small else 0.08, caps=False, tile=(1, 1))
    ncard = 34 if not small else 16
    cz = th + (h - th) * 0.55
    for k in range(ncard):
        u = r.uniform(-1, 1); a = r.uniform(0, 6.28); rr_ = crown_r * (0.35 + 0.65 * r.random() ** 0.5)
        px_, py_ = rr_ * math.cos(a) * math.sqrt(1 - u * u), rr_ * math.sin(a) * math.sqrt(1 - u * u); pz = cz + u * (h - th) * 0.45
        s = r.uniform(1.8, 2.8) if not small else r.uniform(1.2, 1.8)
        ya = r.uniform(0, 6.28); tilt = r.uniform(-0.6, 0.6)
        ux, uy = math.cos(ya), math.sin(ya); vz = math.cos(tilt); vx, vy = -math.sin(ya) * math.sin(tilt), math.cos(ya) * math.sin(tilt)
        q = [(px_ + (-ux - vx) * s / 2, py_ + (-uy - vy) * s / 2, pz - vz * s / 2), (px_ + (ux - vx) * s / 2, py_ + (uy - vy) * s / 2, pz - vz * s / 2),
             (px_ + (ux + vx) * s / 2, py_ + (uy + vy) * s / 2, pz + vz * s / 2), (px_ + (-ux + vx) * s / 2, py_ + (-uy + vy) * s / 2, pz + vz * s / 2)]
        mb.face(q, [(0, 0), (1, 0), (1, 1), (0, 1)], PM["leaf"])
    return proto(f"tree_{seed}", mb)

def make_car(i):
    """Low-poly car: side-profile prism (bonnet, windscreen, roof, boot), a narrower dark greenhouse, four wheels. ~120 tris."""
    p = PM[f"car{i}"]; me = bpy.data.meshes.new(f"proto_car{i}"); bm = bmesh.new()
    sedan = i % 3 != 0
    body = [(-2.15, 0.28), (2.15, 0.28), (2.2, 0.62), (2.05, 0.78), (1.05, 0.86), (-1.6, 0.88), (-2.12, 0.80), (-2.2, 0.55)] if sedan else \
           [(-1.9, 0.28), (1.9, 0.28), (1.95, 0.62), (1.8, 0.80), (0.95, 0.86), (-1.85, 0.90), (-1.95, 0.60)]
    cab = [(-1.35 if sedan else -1.75, 0.86), (0.95, 0.86), (0.35, 1.42), (-1.0 if sedan else -1.65, 1.45)]
    def prism(prof, w, mi):
        vs0 = [bm.verts.new((x, -w / 2, z)) for x, z in prof]; vs1 = [bm.verts.new((x, w / 2, z)) for x, z in prof]
        f0 = bm.faces.new(vs0[::-1]); f1 = bm.faces.new(vs1); fs = [f0, f1]
        for k in range(len(prof)):
            a_, b_ = k, (k + 1) % len(prof); fs.append(bm.faces.new((vs0[a_], vs0[b_], vs1[b_], vs1[a_])))
        for f in fs: f.material_index = mi
    prism(body, 1.76, 0); prism(cab, 1.56, 1)
    cv = [bm.verts.new((x, y, 1.47)) for x, y in ((-0.95 if sedan else -1.6, -0.72), (0.3, -0.72), (0.3, 0.72), (-0.95 if sedan else -1.6, 0.72))]
    f = bm.faces.new(cv); f.material_index = 0                                   # painted roof panel over the glass
    for sx in ((-1.35, 1.35) if sedan else (-1.2, 1.2)):
        for sy in (-0.8, 0.8):
            res = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.31, radius2=0.31, depth=0.2, matrix=Matrix.Translation((sx, sy, 0.31)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
            for f in {f for v in res["verts"] for f in v.link_faces}: f.material_index = 2
    bm.to_mesh(me); bm.free()
    for m in (p, PM["car_glass"], PM["tyre"]): me.materials.append(m)
    uv = me.uv_layers.new(name="UVMap"); return me

def make_bus(i):
    mb = MB()
    mb.box((0, 0, 0), (11.5, 2.55, 1.2), 0, PM["bus_body"], z0=0.35)
    mb.box((0, 0, 0), (11.4, 2.5, 1.0), 0, PM["car_glass"], z0=1.55)
    mb.box((0, 0, 0), (11.5, 2.55, 0.55), 0, PM["bus_body"] if i else PM["bus_band"], z0=2.55)
    mb.box((0, 0, 0), (11.52, 2.57, 0.25), 0, PM["bus_band"], z0=1.1)
    me = proto(f"bus{i}", mb)
    bm = bmesh.new(); bm.from_mesh(me); mi = len(me.materials); me.materials.append(PM["tyre"])
    for sx in (-3.8, 3.6):
        for sy in (-1.15, 1.15):
            res = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.5, radius2=0.5, depth=0.3, matrix=Matrix.Translation((sx, sy, 0.5)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
            for f in {f for v in res["verts"] for f in v.link_faces}: f.material_index = mi
    bm.to_mesh(me); bm.free(); return me

def make_lamp(double=False):
    mb = MB(); mb.cyl(0, 0, 0, 9.0, 0.09, PM["metal"], seg=8, r1=0.06)
    for s in ((1,) if not double else (1, -1)):
        mb.box((s * 0.8, 0, 0), (1.6, 0.08, 0.08), 0, PM["metal"], z0=8.9)
        mb.box((s * 1.55, 0, 0), (0.65, 0.28, 0.12), 0, PM["lamp_head"], z0=8.82)
    return proto("lamp2" if double else "lamp", mb)

def make_tank(white):
    mb = MB()
    if white:
        for sx in (-0.5, 0.5):
            for sy in (-0.5, 0.5): mb.box((sx, sy, 0), (0.08, 0.08, 0.6), 0, PM["metal"], z0=0)
        mb.cyl(0, 0, 0.6, 1.8, 0.62, PM["tank_white"], seg=14)
    else:
        mb.cyl(0, 0, 0, 1.15, 0.6, PM["tank_black"], seg=14, r1=0.55); mb.cyl(0, 0, 1.15, 1.3, 0.3, PM["tank_black"], seg=10)
    return proto("tank_white" if white else "tank_black", mb)

def make_pylon():
    mb = MB(); H = 36.0; base = 4.2; top = 1.2
    def leg(t): return base * (1 - t) + top * t
    lv = [0, 6, 12, 18, 24, 30, 36]
    for sx in (-1, 1):
        for sy in (-1, 1):
            for i in range(len(lv) - 1):
                z0, z1 = lv[i], lv[i + 1]; a0, a1 = leg(z0 / H), leg(z1 / H)
                x0, y0, x1, y1 = sx * a0, sy * a0, sx * a1, sy * a1
                L = math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2 + (z1 - z0) ** 2)
                # approximate the slanted leg with a vertical box at the mid point (small slant)
                mb.box(((x0 + x1) / 2, (y0 + y1) / 2, 0), (0.18, 0.18, z1 - z0), 0, PM["lattice"], z0=z0)
    for z in lv[1:]:
        a = leg(z / H)
        for (dx, dy, rot) in ((0, a, 0), (0, -a, 0), (a, 0, math.pi / 2), (-a, 0, math.pi / 2)):
            mb.box((dx, dy, 0), (2 * a, 0.1, 0.1), rot, PM["lattice"], z0=z)
    for i in range(len(lv) - 1):       # diagonal bracing (as thin rotated boxes in each face)
        z0, z1 = lv[i], lv[i + 1]; a = (leg(z0 / H) + leg(z1 / H)) / 2; dz = z1 - z0; L = math.hypot(2 * a, dz); tilt = math.atan2(dz, 2 * a)
        for (dx, dy, rot) in ((0, a, 0), (0, -a, 0), (a, 0, math.pi / 2), (-a, 0, math.pi / 2)):
            for sgn in (1, -1):
                o_ = MB(); o_.box((0, 0, 0), (L, 0.07, 0.07), 0, PM["lattice"])
                for k_ in range(len(o_.V)):
                    x, y, z = o_.V[k_]; xr = x * math.cos(sgn * tilt) - z * math.sin(sgn * tilt); zr = x * math.sin(sgn * tilt) + z * math.cos(sgn * tilt)
                    xx, yy = xr * math.cos(rot) - y * math.sin(rot), xr * math.sin(rot) + y * math.cos(rot)
                    o_.V[k_] = (xx + dx, yy + dy, zr + (z0 + z1) / 2)
                for f_, mi in zip(o_.F, o_.MI): mb.face([o_.V[j] for j in f_], [o_.UV[j] for j in f_], PM["lattice"])
    for z, w in ((24.0, 9.0), (29.0, 7.0), (34.0, 5.0)):
        mb.box((0, 0, 0), (w * 2, 0.35, 0.5), 0, PM["lattice"], z0=z)
        for s in (-1, 1):
            mb.cyl(s * w * 0.95, 0, z - 2.4, z, 0.12, PM["insulator"], seg=8)
    mb.box((0, 0, 0), (0.25, 0.25, 4.0), 0, PM["lattice"], z0=36.0)
    return proto("pylon", mb)

def make_mast():
    mb = MB(); mb.box((0, 0, 0), (0.3, 0.3, 7.5), 0, PM["metal"], z0=0); mb.box((-2.2, 0, 0), (4.6, 0.12, 0.12), 0, PM["metal"], z0=6.8)
    return proto("rail_mast", mb)

PROTOS = {"palm": [make_palm(h, 10 + i) for i, h in enumerate((7.5, 9.0, 10.5))],
          "tree": [make_tree(h, cr, 20 + i) for i, (h, cr) in enumerate(((11, 4.6), (9, 3.8), (13, 5.4), (10, 4.2)))],
          "tree_small": [make_tree(h, cr, 40 + i, small=True) for i, (h, cr) in enumerate(((5.5, 2.2), (6.5, 2.6), (4.8, 2.0), (6.0, 2.4)))],
          "shrub": [make_tree(1.6, 0.9, 60 + i, small=True) for i in range(3)],
          "car": [make_car(i) for i in range(8)], "bus": [make_bus(i) for i in range(3)], "lamp": [make_lamp()], "lamp_double": [make_lamp(True)],
          "pylon": [make_pylon()], "rail_mast": [make_mast()]}
TANKP = [make_tank(False), make_tank(True)]
counts = {}
for kind, lst in P["props"].items():
    if kind not in PROTOS or not lst: continue
    ck = coll(f"ctx_props_{kind}", cP)
    for i, (x, y, rot, s, v) in enumerate(lst):
        me = PROTOS[kind][v % len(PROTOS[kind])]
        o = bpy.data.objects.new(f"{kind}_{i}", me); o.location = (x, y, 0.06 if kind in ("car", "bus") else 0.0)
        o.rotation_euler = (0, 0, rot); o.scale = (s, s, s); ck.objects.link(o); o["prop"] = kind
    counts[kind] = len(lst)
ck = coll("ctx_props_tanks", cP)
for i, (x, y, z, w) in enumerate(TANK_POS):
    o = bpy.data.objects.new(f"tank_{i}", TANKP[w]); o.location = (x, y, z); o.rotation_euler = (0, 0, RNG.uniform(0, 6.28)); ck.objects.link(o); o["prop"] = "tank"
counts["tank"] = len(TANK_POS)
# power lines between pylons (6 conductors per line, catenary sag 4 %)
mb = MB(); pyl = P["props"]["pylon"]
for line in P["pylon_lines"]:
    for i in range(len(line) - 1):
        (x0, y0), (x1, y1) = line[i], line[i + 1]; L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0); nx, ny = -math.sin(a), math.cos(a)
        for z, w in ((24.0 - 2.4, 9.0 * 0.95), (29.0 - 2.4, 7.0 * 0.95), (34.0 - 2.4, 5.0 * 0.95)):
            for s in (-1, 1):
                seg = 16; prev = None
                for k in range(seg + 1):
                    t = k / seg; x = x0 + (x1 - x0) * t + nx * s * w; y = y0 + (y1 - y0) * t + ny * s * w; zz = z - 4 * 0.04 * L * t * (1 - t)
                    if prev:
                        q = [(prev[0], prev[1], prev[2] - 0.03), (x, y, zz - 0.03), (x, y, zz + 0.03), (prev[0], prev[1], prev[2] + 0.03)]
                        mb.face(q, [(0, 0), (1, 0), (1, 1), (0, 1)], PM["conductor"])
                    prev = (x, y, zz)
o = mb.flush("ctx_power_lines", cP, merge=0); o["ctx"] = "props"
# substation: compound wall, gantries, transformers, breakers
if P.get("substation"):
    sr = P["substation"][0]; mb = MB()
    mb.quad_strip(sr, 0.0, 2.4, PM["wall"], tile_of("concrete"), outward=is_ccw(sr)); mb.quad_strip(sr, 0.0, 2.4, PM["wall"], tile_of("concrete"), outward=not is_ccw(sr), offset=-0.2)
    xs = [p[0] for p in sr]; ys = [p[1] for p in sr]; x0, x1, y0, y1 = min(xs) + 8, max(xs) - 8, min(ys) + 8, max(ys) - 8
    for gx in np.arange(x0, x1, 16.0):
        for e in (y0, y1):
            mb.box((gx, e, 0), (0.6, 0.6, 13.2), 0, PM["lattice"], z0=0, top=False)
        mb.box((gx, (y0 + y1) / 2, 0), (0.6, y1 - y0, 0.8), 0, PM["lattice"], z0=13.2)
        for gy in np.arange(y0 + 6, y1 - 4, 7.0):
            mb.box((gx + 5, gy, 0), (0.4, 0.4, 2.5), 0, PM["metal"], z0=0, bottom=False); mb.cyl(gx + 5, gy, 2.5, 5.0, 0.18, PM["insulator"], seg=8, bottom=False)
            mb.box((gx + 10, gy, 0), (2.0, 1.2, 2.2), 0, PM["metal"], z0=0, bottom=False)
    for i in range(3):
        tx_ = x0 + 6 + i * 14; ty_ = y0 + 4
        mb.box((tx_, ty_, 0), (6, 4, 4.2), 0, PM["transformer"], z0=0, bottom=False)
        for k in range(5): mb.box((tx_ - 2.5 + k * 1.25, ty_ + 2.4, 0), (0.2, 0.8, 3.4), 0, PM["transformer"], z0=0.3, bottom=False)
        for k in range(3): mb.cyl(tx_ - 1.5 + k * 1.5, ty_, 4.2, 6.2, 0.2, PM["insulator"], seg=8, bottom=False)
    o = mb.flush("ctx_substation", cP, merge=0); o["ctx"] = "props"; o["label"] = "220 kV Kalwa substation (assumed position)"
print(f"props {counts} ({time.time() - T0:.0f} s)", flush=True)

# ================================================================ terrain (3.2 km, hole under the 560 m disc)
cT = coll("terrain")
ax = TER["x"]; Z = TER["z"]; AO = TER["ao"]; Nn = len(ax)
V = []; Fc = []; cols = []; uvs = []
idx = -np.ones((Nn, Nn), int)
for i in range(Nn):
    for j in range(Nn):
        idx[i, j] = len(V); V.append((float(ax[j]), float(ax[i]), float(Z[i, j])))
for i in range(Nn - 1):
    for j in range(Nn - 1):
        cs = [(i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)]
        if all(math.hypot(ax[b_], ax[a_]) < 520 for a_, b_ in cs): continue
        Fc.append([idx[a_, b_] for a_, b_ in cs])
me = bpy.data.meshes.new("terrain"); me.from_pydata(V, [], Fc); me.update()
uvl = me.uv_layers.new(name="UVMap"); ca = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
for p in me.polygons:
    for li in p.loop_indices:
        vi = me.loops[li].vertex_index; x, y, z = V[vi]; i, j = divmod(vi, Nn)
        uvl.data[li].uv = (x / 60.0, y / 60.0)
        g = min(1.0, max(0.0, (z - 8) / 60.0)); ao = float(AO[i, j])
        base = np.array([0.42, 0.47, 0.31]) * (1 - g) + np.array([0.24, 0.33, 0.19]) * g
        ca.data[li].color = (*(base * ao * 1.25).clip(0, 1), 1.0)
me.materials.append(CM["terrain"]); o = bpy.data.objects.new("terrain", me); cT.objects.link(o); o["ctx"] = "terrain"
print(f"terrain {len(Fc)} quads ({time.time() - T0:.0f} s)", flush=True)

# metadata
sc["prep"] = json.dumps({"states": P["states"], "date": P["date"], "rtp": {k: R[k] for k in ("roof_z", "nlev", "ftf", "ffl0", "inner_corner", "drums", "module")},
                         "floors": [{"name": f["name"], "level": f["level"], "ffl": f["ffl"]} for f in R["floors"]]})
out = os.path.join(X.BUILD, "rtp_exterior.blend")
bpy.ops.wm.save_as_mainfile(filepath=out, compress=False)
stats = {"objects": len(bpy.data.objects), "meshes": len(bpy.data.meshes), "materials": len(bpy.data.materials), "props": counts, "seconds": round(time.time() - T0, 1)}
json.dump(stats, open(os.path.join(X.BUILD, "build_stats.json"), "w"), indent=1)
print("saved", out, stats, flush=True)
