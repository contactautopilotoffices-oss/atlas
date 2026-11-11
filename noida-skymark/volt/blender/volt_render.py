"""Volt, first floor, Skymark F-1: build the whole floor in Blender from the CAD
layout and render every room, as a still and as a 360 degree panorama.

Run it with Blender (4.2 or newer), no clicking needed:

    /Applications/Blender.app/Contents/MacOS/Blender -b -P volt_render.py -- --out renders

Everything is placed from volt-floor1.layout.json, which was read out of the
client's DWG: walls, glass, doors, columns, desks, tables, every chair, the
planters and the ceiling lights. Heights and finishes are not in a 2D drawing:
heights are standard fit-out sizes and finishes follow the design deck's mood
board. Cameras come from cameras.json (made from the same layout).

Options (after the --):
    --out DIR        where the pictures go (default: renders, next to this file)
    --what LIST      stills, panos, or both: "stills,panos" (default)
    --rooms LIST     only these rooms, by slug, comma separated (default: all)
    --quality Q      preview | normal | high   (default: normal)
    --samples N      override the sample count
    --device D       auto | gpu | cpu          (default: auto, the GPU if there is one)
    --sun-az DEG     where the sun is, as a compass bearing (default 100, a morning sun)
    --sun-el DEG     how high the sun is (default 26)
    --exposure EV    brighter or darker (default 0.6)
    --no-render      build and save the .blend only
Pictures that already exist are skipped, so a stopped run can be started again.
"""
import bpy, bmesh, json, math, os, random, sys, time, argparse
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default=os.path.join(HERE, "renders")); ap.add_argument("--what", default="stills,panos")
ap.add_argument("--rooms", default=""); ap.add_argument("--quality", default="normal", choices=["preview", "normal", "high"])
ap.add_argument("--samples", type=int, default=0); ap.add_argument("--device", default="auto")
ap.add_argument("--sun-az", type=float, default=100.0); ap.add_argument("--sun-el", type=float, default=26.0)
ap.add_argument("--exposure", type=float, default=0.6); ap.add_argument("--no-render", action="store_true")
A = ap.parse_args(argv)
OUT = os.path.abspath(A.out); os.makedirs(os.path.join(OUT, "stills"), exist_ok=True); os.makedirs(os.path.join(OUT, "panos"), exist_ok=True)
Q = {"preview": dict(samples=24, still=(1280, 720), pano=(2048, 1024)),
     "normal": dict(samples=128, still=(1920, 1080), pano=(4096, 2048)),
     "high": dict(samples=256, still=(2560, 1440), pano=(6000, 3000))}[A.quality]
if A.samples: Q["samples"] = A.samples
random.seed(7)
L = json.load(open(os.path.join(HERE, "volt-floor1.layout.json")))
CAMS = json.load(open(os.path.join(HERE, "cameras.json")))
H = L["heights"]["ceiling"]

bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene
COL = bpy.data.collections.new("Volt"); SC.collection.children.link(COL)

# ------------------------------------------------------------------ colours and materials
def lin(hexs):
    hexs = hexs.lstrip("#"); c = [int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
def setin(node, names, v):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = v; return True
    return False
MATS = {}
def pbr(name, color, rough=0.5, metal=0.0, trans=0.0, coat=0.0, sheen=0.0, alpha=1.0, emit=None, emit_strength=0.0, ior=1.45):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    col = lin(color) if isinstance(color, str) else color
    setin(b, ["Base Color"], (*col, 1)); setin(b, ["Roughness"], rough); setin(b, ["Metallic"], metal); setin(b, ["IOR"], ior)
    if trans: setin(b, ["Transmission Weight", "Transmission"], trans)
    if coat: setin(b, ["Coat Weight", "Clearcoat"], coat)
    if sheen: setin(b, ["Sheen Weight", "Sheen"], sheen)
    if alpha < 1: setin(b, ["Alpha"], alpha)
    if emit: setin(b, ["Emission Color", "Emission"], (*lin(emit), 1)); setin(b, ["Emission Strength"], emit_strength)
    MATS[name] = m; return m, nt, b
def N(nt, kind, loc=(0, 0), **props):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in props.items(): setattr(n, k, v)
    return n
def world_coords(nt, scale):
    g = N(nt, "ShaderNodeNewGeometry", (-900, 0)); mp = N(nt, "ShaderNodeMapping", (-720, 0)); mp.inputs["Scale"].default_value = scale
    nt.links.new(g.outputs["Position"], mp.inputs["Vector"]); return mp
def ramp(nt, stops, loc):
    r = N(nt, "ShaderNodeValToRGB", loc); e = r.color_ramp.elements
    while len(e) < len(stops): e.new(0.5)
    for el, (p, c) in zip(e, stops): el.position = p; el.color = (*lin(c), 1)
    return r
def bump(nt, b, height_socket, strength, distance=0.002):
    bp = N(nt, "ShaderNodeBump", (-200, -300)); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = distance
    nt.links.new(height_socket, bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])

def mat_carpet():
    m, nt, b = pbr("carpet", "#45423f", rough=0.95, sheen=0.3)
    # tile-to-tile tone
    mpt = world_coords(nt, (2.0, 2.0, 1.0)); br = N(nt, "ShaderNodeTexBrick", (-560, 320)); br.offset = 0.5
    br.inputs["Scale"].default_value = 1.0; br.inputs["Mortar Size"].default_value = 0.004; br.inputs["Brick Width"].default_value = 1.0; br.inputs["Row Height"].default_value = 1.0; br.inputs["Bias"].default_value = -0.2
    br.inputs["Color1"].default_value = (0.0, 0.0, 0.0, 1); br.inputs["Color2"].default_value = (1.0, 1.0, 1.0, 1); br.inputs["Mortar"].default_value = (0.0, 0.0, 0.0, 1)
    nt.links.new(mpt.outputs["Vector"], br.inputs["Vector"])
    # streaks along the tile
    mp = world_coords(nt, (2.5, 70.0, 30.0)); n1 = N(nt, "ShaderNodeTexNoise", (-560, 80)); n1.inputs["Scale"].default_value = 6.0; n1.inputs["Detail"].default_value = 7.0
    nt.links.new(mp.outputs["Vector"], n1.inputs["Vector"])
    mp2 = world_coords(nt, (0.5, 0.5, 0.5)); n2 = N(nt, "ShaderNodeTexNoise", (-560, -160)); n2.inputs["Scale"].default_value = 1.0
    nt.links.new(mp2.outputs["Vector"], n2.inputs["Vector"])
    a1 = N(nt, "ShaderNodeMath", (-380, 120), operation="MULTIPLY_ADD"); a1.inputs[1].default_value = 0.7; nt.links.new(n1.outputs["Fac"], a1.inputs[0]); nt.links.new(n2.outputs["Fac"], a1.inputs[2])
    sep = N(nt, "ShaderNodeSeparateColor", (-380, 320)) if hasattr(bpy.types, "ShaderNodeSeparateColor") else N(nt, "ShaderNodeSeparateRGB", (-380, 320))
    nt.links.new(br.outputs["Color"], sep.inputs[0])
    a2 = N(nt, "ShaderNodeMath", (-240, 200), operation="MULTIPLY_ADD"); a2.inputs[1].default_value = 0.22; nt.links.new(sep.outputs[0], a2.inputs[0]); nt.links.new(a1.outputs[0], a2.inputs[2])
    r = ramp(nt, [(0.42, "#262423"), (0.62, "#3d3a37"), (0.8, "#58544f"), (0.95, "#807a72")], (-80, 100))
    nt.links.new(a2.outputs[0], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    mp3 = world_coords(nt, (700, 700, 700)); n3 = N(nt, "ShaderNodeTexNoise", (-560, -400)); n3.inputs["Scale"].default_value = 1.0
    nt.links.new(mp3.outputs["Vector"], n3.inputs["Vector"]); bump(nt, b, n3.outputs["Fac"], 0.6, 0.003)
def mat_wood(name, light, mid, dark, rough=0.42, coat=0.15, scale=(1.2, 14.0, 14.0)):
    m, nt, b = pbr(name, mid, rough=rough, coat=coat)
    mp = world_coords(nt, scale); w = N(nt, "ShaderNodeTexNoise", (-520, 0)); w.inputs["Scale"].default_value = 3.0; w.inputs["Detail"].default_value = 8.0; w.inputs["Roughness"].default_value = 0.65
    nt.links.new(mp.outputs["Vector"], w.inputs["Vector"])
    r = ramp(nt, [(0.3, dark), (0.5, mid), (0.72, light)], (-200, 0)); nt.links.new(w.outputs["Fac"], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    bump(nt, b, w.outputs["Fac"], 0.08, 0.001)
def mat_fabric(name, color, rough=0.9):
    m, nt, b = pbr(name, color, rough=rough, sheen=0.5)
    mp = world_coords(nt, (900, 900, 900)); n = N(nt, "ShaderNodeTexNoise", (-520, 0)); n.inputs["Scale"].default_value = 1.0
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"]); bump(nt, b, n.outputs["Fac"], 0.5, 0.002)
def mat_paint(name, color, rough=0.85):
    m, nt, b = pbr(name, color, rough=rough)
    mp = world_coords(nt, (250, 250, 250)); n = N(nt, "ShaderNodeTexNoise", (-520, 0)); n.inputs["Scale"].default_value = 1.0
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"]); bump(nt, b, n.outputs["Fac"], 0.12, 0.001)
def mat_ceiling():
    pbr("gypsum", "#e9e6e0", rough=0.95)
    m, nt, b = pbr("ceiling", "#eceae5", rough=0.95)
    mp = world_coords(nt, (1 / 0.6, 1 / 0.6, 1)); br = N(nt, "ShaderNodeTexBrick", (-520, 0))
    br.offset = 0.0; br.inputs["Scale"].default_value = 1.0; br.inputs["Mortar Size"].default_value = 0.012; br.inputs["Brick Width"].default_value = 1.0; br.inputs["Row Height"].default_value = 1.0
    br.inputs["Color1"].default_value = (*lin("#eceae5"), 1); br.inputs["Color2"].default_value = (*lin("#e6e3dd"), 1); br.inputs["Mortar"].default_value = (*lin("#bdb9b2"), 1)
    nt.links.new(mp.outputs["Vector"], br.inputs["Vector"]); nt.links.new(br.outputs["Color"], b.inputs["Base Color"]); bump(nt, b, br.outputs["Fac"], -0.4, 0.004)
def mat_glass(name, tint="#eef5f4"):
    m, nt, b = pbr(name, tint, rough=0.0, trans=1.0)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"); lp = N(nt, "ShaderNodeLightPath", (0, 300)); tr = N(nt, "ShaderNodeBsdfTransparent", (0, 150)); mx = N(nt, "ShaderNodeMixShader", (250, 200))
    tr.inputs["Color"].default_value = (0.92, 0.96, 0.95, 1)
    nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs["Fac"]); nt.links.new(b.outputs["BSDF"], mx.inputs[1]); nt.links.new(tr.outputs["BSDF"], mx.inputs[2]); nt.links.new(mx.outputs["Shader"], out.inputs["Surface"])
def mat_leaf():
    m, nt, b = pbr("leaf", "#2f6a2c", rough=0.38, coat=0.25)
    mp = world_coords(nt, (9, 9, 9)); n = N(nt, "ShaderNodeTexNoise", (-520, 0)); n.inputs["Scale"].default_value = 1.0
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    r = ramp(nt, [(0.3, "#234f22"), (0.55, "#33702f"), (0.8, "#4d8c3a")], (-300, 0)); nt.links.new(n.outputs["Fac"], r.inputs["Fac"]); nt.links.new(r.outputs["Color"], b.inputs["Base Color"])

mat_carpet()
mat_wood("oak", "#e6d2b3", "#d8bf9b", "#c7a983")
mat_wood("oak_floor", "#e2ccab", "#d2b790", "#bd9e78", rough=0.35, coat=0.3, scale=(0.9, 9.0, 9.0))
mat_paint("paint", "#efece7"); mat_paint("charcoal", "#3a3a3b", 0.7); mat_paint("accent", "#dd8d36", 0.8)
mat_ceiling()
mat_fabric("screen_orange", "#dd8d36"); mat_fabric("screen_white", "#f1efea"); mat_fabric("sofa_grey", "#a69687"); mat_fabric("sofa_teal", "#286e7a")
mat_fabric("sofa_orange", "#d98733"); mat_fabric("blind", "#d8cfc0", 0.95); mat_fabric("acoustic", "#3d6a8b")
pbr("white_metal", "#f1f0ed", rough=0.4, metal=0.2); pbr("black_metal", "#1c1c1d", rough=0.38, metal=0.85); pbr("alu", "#c9cbce", rough=0.3, metal=1.0)
pbr("screen_glass", "#050506", rough=0.08, coat=1.0); pbr("plastic_black", "#18181a", rough=0.5); pbr("plastic_orange", "#dd8d36", rough=0.45)
pbr("planter_white", "#f3f2ef", rough=0.5); pbr("planter_top", "#333334", rough=0.7); pbr("soil", "#2a2018", rough=1.0)
pbr("stone", "#d7d2c9", rough=0.25); pbr("tile", "#eeece8", rough=0.2); pbr("vinyl", "#b7b3ac", rough=0.55)
pbr("frost", "#f6f6f4", rough=0.6, alpha=0.86); pbr("pot", "#3a3a3a", rough=0.6)
pbr("led", "#ffffff", emit="#fff3e2", emit_strength=12.0); pbr("led_spot", "#ffffff", emit="#ffe9cf", emit_strength=420.0); pbr("led_line", "#ffffff", emit="#fff1dd", emit_strength=150.0)
mat_glass("glass"); mat_leaf()
for m in MATS.values():
    if hasattr(m, "blend_method") and m.name == "frost":
        try: m.blend_method = "BLEND"
        except Exception: pass

# ------------------------------------------------------------------ geometry helpers
def add(name, verts, faces, mat, smooth=False):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COL.objects.link(o); me.materials.append(MATS[mat])
    if smooth:
        for p in me.polygons: p.use_smooth = True
    return o
def prism(name, outer, holes, z0, z1, mat):
    loops = [outer] + list(holes or []); pts = [p for l in loops for p in l]; n = len(pts)
    tris = tessellate_polygon([[Vector((x, y, 0)) for x, y in l] for l in loops])
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    faces = [tuple(t) for t in tris] + [tuple(i + n for i in t) for t in tris]; k = 0
    for l in loops:
        m = len(l)
        for i in range(m): a, b = k + i, k + (i + 1) % m; faces.append((a, b, b + n, a + n))
        k += m
    return add(name, verts, faces, mat)
_MESH = {}
def box_mesh(w, d, h, bevel=0.0, mat="paint"):
    key = ("box", round(w, 4), round(d, 4), round(h, 4), round(bevel, 4), mat)
    if key in _MESH: return _MESH[key]
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * w, v.co.y * d, (v.co.z + 0.5) * h))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, w / 2.2, d / 2.2, h / 2.2), segments=2, profile=0.5, affect="EDGES")
    me = bpy.data.meshes.new("box"); bm.to_mesh(me); bm.free(); me.materials.append(MATS[mat])
    for p in me.polygons: p.use_smooth = bevel > 0
    _MESH[key] = me; return me
def cyl_mesh(r, h, mat, seg=32, r2=None):
    key = ("cyl", round(r, 4), round(h, 4), mat, seg, r2)
    if key in _MESH: return _MESH[key]
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts: v.co.z += h / 2
    me = bpy.data.meshes.new("cyl"); bm.to_mesh(me); bm.free(); me.materials.append(MATS[mat])
    for p in me.polygons: p.use_smooth = len(p.vertices) == 4
    _MESH[key] = me; return me
def put(mesh, M, name="p"):
    o = bpy.data.objects.new(name, mesh); COL.objects.link(o); o.matrix_world = M; return o
def T(x, y, z=0.0): return Matrix.Translation((x, y, z))
def RZ(a): return Matrix.Rotation(a, 4, "Z")
def box(x, y, z, w, d, h, a=0.0, mat="paint", bevel=0.0, name="box"):
    return put(box_mesh(w, d, h, bevel, mat), T(x, y, z) @ RZ(a), name)
def seg_frame(x0, y0, x1, y1):
    return math.hypot(x1 - x0, y1 - y0), math.atan2(y1 - y0, x1 - x0), (x0 + x1) / 2, (y0 + y1) / 2

# ------------------------------------------------------------------ shell: floor, walls, columns, ceiling
for f in L["floor"]:
    prism("floor", f["outer"], f["holes"], -0.3, 0.0, "carpet")
    prism("ceiling", f["outer"], f["holes"], H, H + 0.06, "gypsum")
FIN = {"wood": "oak_floor", "stone": "stone", "tile": "tile", "vinyl": "vinyl"}
for r in L["rooms"]:
    if r["floor"] in FIN:
        x0, y0, x1, y1 = r["box"]; add("finish_" + r["name"], [(x0, y0, 0.003), (x1, y0, 0.003), (x1, y1, 0.003), (x0, y1, 0.003)], [(0, 1, 2, 3)], FIN[r["floor"]])
for r in L["rooms"]:      # tile grid where the drawing shows 2x2 panels
    x0, y0, x1, y1 = r["box"]
    if sum(1 for l in L["lights"] if l["kind"] == "panel600" and x0 <= l["c"][0] <= x1 and y0 <= l["c"][1] <= y1) >= 2:
        add("grid_" + r["name"], [(x0, y0, H - 0.002), (x1, y0, H - 0.002), (x1, y1, H - 0.002), (x0, y1, H - 0.002)], [(0, 3, 2, 1)], "ceiling")
for i, w in enumerate(L["walls"]): prism(f"wall{i}", w["outer"], w["holes"], 0.0, H, "paint")
for i, w in enumerate(L.get("skirting", [])): prism(f"skirting{i}", w["outer"], w["holes"], 0.0, 0.09, "charcoal")
for i, c in enumerate(L["columns"]): prism(f"column{i}", c, [], 0.0, H, "charcoal")
if L.get("atrium"):
    a = L["atrium"]; xs = [p[0] for p in a]; ys = [p[1] for p in a]; ax0, ax1, ay0, ay1 = min(xs), max(xs), min(ys), max(ys)
    add("atrium_floor", [(ax0, ay0, -4.1), (ax1, ay0, -4.1), (ax1, ay1, -4.1), (ax0, ay1, -4.1)], [(0, 1, 2, 3)], "stone")
    for (x0, y0, x1, y1) in [(ax0, ay0, ax1, ay0), (ax1, ay0, ax1, ay1), (ax1, ay1, ax0, ay1), (ax0, ay1, ax0, ay0)]:
        ln, an, cx, cy = seg_frame(x0, y0, x1, y1)
        box(cx, cy, 0.0, ln, 0.012, 1.05, an, "glass"); box(cx, cy, 1.05, ln, 0.05, 0.04, an, "black_metal", 0.004)
        box(cx, cy, -4.1, ln, 0.2, 4.1, an, "paint")

# ------------------------------------------------------------------ glass partitions, facade windows, doors
for (x0, y0, x1, y1, layer) in L["glass"]:
    ln, an, cx, cy = seg_frame(x0, y0, x1, y1)
    if ln < 0.2: continue
    facade = layer == "AR-WINDOW"
    box(cx, cy, 0.04, ln, 0.012, H - 0.08, an, "glass", name="glass")
    box(cx, cy, 0.0, ln, 0.05, 0.04, an, "black_metal"); box(cx, cy, H - 0.04, ln, 0.05, 0.04, an, "black_metal")
    n = max(1, round(ln / 1.2)); ca, sa = math.cos(an), math.sin(an)
    for i in range(n + 1):
        u = -ln / 2 + ln * i / n; box(cx + ca * u, cy + sa * u, 0.0, 0.04, 0.05, H, an, "black_metal", 0.003)
    if facade:   # roller blinds, part way down, on the room side
        for i in range(n):
            u = -ln / 2 + ln * (i + 0.5) / n; drop = random.choice((0.45, 0.6, 0.6, 0.8))
            for s_ in (-1, 1): box(cx + ca * u - sa * 0.05 * s_, cy + sa * u + ca * 0.05 * s_, H - drop, ln / n - 0.06, 0.004, drop, an, "blind")
    else:
        for k in range(4): box(cx, cy, 0.95 + k * 0.145, ln - 0.05, 0.018, 0.1, an, "frost", name="frost")
for d in L["doors"]:
    m = "glass" if d.get("glass") else ("charcoal" if d.get("fire") else "oak")
    box(d["c"][0], d["c"][1], 0.0, d["w"], max(0.04, d["d"]) if m != "glass" else 0.012, 2.1, d["a"], m, 0.003, "door")
    ca, sa = math.cos(d["a"]), math.sin(d["a"])
    for s_ in (-1, 1): box(d["c"][0] + ca * (d["w"] / 2 - 0.09) - sa * 0.035 * s_, d["c"][1] + sa * (d["w"] / 2 - 0.09) + ca * 0.035 * s_, 0.95, 0.025, 0.03, 0.3, d["a"], "alu", 0.008, "handle")

# ------------------------------------------------------------------ ceiling lights (positions from the drawing's ceiling plan)
panel = box_mesh(0.6, 0.6, 0.004, 0, "led"); spot = cyl_mesh(0.055, 0.004, "led_spot", 20)
for l in L["lights"]:
    put(panel if l["kind"] == "panel600" else spot, T(l["c"][0], l["c"][1], H - 0.006), "light")

# ------------------------------------------------------------------ furniture
def in_box(b, x, y, pad=0.0): return b[0] - pad <= x <= b[2] + pad and b[1] - pad <= y <= b[3] + pad
task_seats = [s for s in L["seats"] if s["kind"] == "task chair"]
mon = box_mesh(0.56, 0.012, 0.33, 0.006, "screen_glass"); mon_back = box_mesh(0.565, 0.014, 0.415, 0.008, "alu"); stand = box_mesh(0.11, 0.02, 0.14, 0.006, "alu"); base = box_mesh(0.2, 0.17, 0.008, 0.003, "alu")
tray = box_mesh(0.9, 0.12, 0.06, 0.004, "white_metal")
kb = box_mesh(0.42, 0.13, 0.014, 0.004, "plastic_black"); mouse = box_mesh(0.06, 0.1, 0.02, 0.008, "plastic_black")
rows = {}
for i, d in enumerate(L["desks"]):
    cx, cy = d["c"]; a, w, dp, h = d["a"], d["w"], d["d"], d["h"]; M0 = T(cx, cy, 0) @ RZ(a)
    put(box_mesh(w, dp, 0.025, 0.003, "oak"), M0 @ T(0, 0, h - 0.025), "desk_top")
    for e in (-1, 1):
        for sy in (-1, 1): put(box_mesh(0.045, 0.045, h - 0.025, 0.006, "white_metal"), M0 @ T(e * (w / 2 - 0.04), sy * (dp * 0.42 - 0.02), 0), "desk_leg")
        put(box_mesh(0.045, dp * 0.84, 0.045, 0.006, "white_metal"), M0 @ T(e * (w / 2 - 0.04), 0, 0.0), "desk_foot")
        put(box_mesh(0.045, dp * 0.84, 0.045, 0.006, "white_metal"), M0 @ T(e * (w / 2 - 0.04), 0, h - 0.07), "desk_rail")
    put(box_mesh(w - 0.1, 0.04, 0.04, 0.003, "white_metal"), M0 @ T(0, 0, h - 0.07), "desk_beam")
    if "workstation" not in d["kind"]: continue
    nx, ny = -math.sin(a), math.cos(a); best = None; bd = 1.3
    for s in task_seats:
        dd = math.hypot(s["x"] - cx, s["y"] - cy)
        if dd < bd: bd, best = dd, s
    if not best: continue
    sd = 1.0 if (best["x"] - cx) * nx + (best["y"] - cy) * ny >= 0 else -1.0     # which long side the chair is on
    put(box_mesh(w - 0.06, 0.024, 0.38, 0.006, "screen_orange" if i % 2 == 0 else "screen_white"), M0 @ T(0, -sd * (dp / 2 - 0.012), h), "desk_screen")
    Mm = M0 @ T(random.uniform(-0.06, 0.06), -sd * (dp / 2 - 0.19), h) @ RZ(0 if sd > 0 else math.pi) @ RZ(random.uniform(-0.08, 0.08))
    put(base, Mm, "mon_base"); put(stand, Mm @ T(0, -0.03, 0.008), "mon_stand"); put(mon, Mm @ T(0, 0.004, 0.195), "monitor"); put(mon_back, Mm @ T(0, -0.008, 0.115), "mon_back")
    put(tray, M0 @ T(0, -sd * (dp / 2 - 0.1), h - 0.14), "cable_tray")
    put(kb, Mm @ T(0, 0.27, 0.0) @ RZ(random.uniform(-0.06, 0.06)), "keyboard"); put(mouse, Mm @ T(0.3, 0.27, 0.0) @ RZ(random.uniform(-0.3, 0.3)), "mouse")
    room = next((r["name"] for r in L["rooms"] if in_box(r["box"], cx, cy)), ""); rows.setdefault(room, []).append(d)

# linear pendant lights over the desk rows (a design choice shown in the deck; not drawn in the CAD)
for room, ds in rows.items():
    if len(ds) < 8: continue
    along_y = sum(1 for d in ds if abs(math.sin(d["a"])) > 0.7) > len(ds) / 2
    key = (lambda d: d["c"][0]) if along_y else (lambda d: d["c"][1]); other = (lambda d: d["c"][1]) if along_y else (lambda d: d["c"][0])
    groups = []
    for d in sorted(ds, key=key):
        if groups and key(d) - key(groups[-1][-1]) < 0.9: groups[-1].append(d)
        else: groups.append([d])
    for g in groups:
        if len(g) < 3: continue
        k = sum(key(d) for d in g) / len(g); lo = min(other(d) for d in g) - 0.3; hi = max(other(d) for d in g) + 0.3; ln = hi - lo; mid = (lo + hi) / 2
        x, y, an = (k, mid, math.pi / 2) if along_y else (mid, k, 0.0)
        box(x, y, 2.32, ln, 0.06, 0.07, an, "black_metal", 0.004, "pendant"); box(x, y, 2.316, ln - 0.04, 0.04, 0.004, an, "led_line", 0, "pendant_led")
        ca, sa = math.cos(an), math.sin(an)
        for u in (-ln / 2 + 0.3, ln / 2 - 0.3): put(cyl_mesh(0.003, H - 2.39, "black_metal", 6), T(x + ca * u, y + sa * u, 2.39), "wire")

# tables
for t in L["tables"]:
    h = t["h"]
    if "circle" in t:
        x, y, r = t["circle"]; put(cyl_mesh(r, 0.035, "oak"), T(x, y, h - 0.035), "table_top")
        put(cyl_mesh(0.035, h - 0.035, "black_metal", 16), T(x, y, 0), "table_leg"); put(cyl_mesh(r * 0.55, 0.015, "black_metal"), T(x, y, 0), "table_base")
        continue
    prism("table_top", t["poly"], [], h - 0.04, h, "oak")
    xs = [p[0] for p in t["poly"]]; ys = [p[1] for p in t["poly"]]; w = max(xs) - min(xs); d = max(ys) - min(ys); cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2
    if max(w, d) > 1.6:
        box(cx, cy, 0.0, w * 0.72 if w > d else min(w, 0.9) * 0.45, d * 0.72 if d >= w else min(d, 0.9) * 0.45, h - 0.04, 0, "charcoal", 0.006, "table_base")
    else:
        put(cyl_mesh(0.04, h - 0.04, "black_metal", 16), T(cx, cy, 0), "table_leg"); put(cyl_mesh(min(w, d) * 0.3, 0.015, "black_metal"), T(cx, cy, 0), "table_base")

# real chair models
def load_model(path, height, seat_band):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    ch = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM"); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o != ch and o.name in bpy.data.objects: bpy.data.objects.remove(o)
    co = [v.co.copy() for v in ch.data.vertices]
    lo = Vector((min(v.x for v in co), min(v.y for v in co), min(v.z for v in co))); hi = Vector((max(v.x for v in co), max(v.y for v in co), max(v.z for v in co)))
    k = height / (hi.z - lo.z); c = (lo + hi) / 2
    ch.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation((-c.x, -c.y, -lo.z)))
    top = [v.co for v in ch.data.vertices if v.co.z > 0.86 * height]; seat = [v.co for v in ch.data.vertices if seat_band[0] * height < v.co.z < seat_band[1] * height]
    bk = sum(top, Vector()) / len(top); st = sum(seat, Vector()) / len(seat)
    ch.data.transform(Matrix.Rotation(-math.atan2(st.y - bk.y, st.x - bk.x), 4, "Z"))      # now it faces +x
    for p in ch.data.polygons: p.use_smooth = True
    for c_ in list(ch.users_collection): c_.objects.unlink(ch)
    me = ch.data; bpy.data.objects.remove(ch); return me
CHAIR = load_model(os.path.join(HERE, "models", "chair.glb"), 1.02, (0.40, 0.52))
LOUNGE = load_model(os.path.join(HERE, "models", "lounge.glb"), 0.82, (0.30, 0.50))
cafe_seat = box_mesh(0.44, 0.44, 0.05, 0.02, "plastic_orange"); cafe_back = box_mesh(0.05, 0.42, 0.36, 0.02, "plastic_orange"); cafe_leg = cyl_mesh(0.014, 0.45, "oak", 10)
stool_seat = cyl_mesh(0.19, 0.05, "plastic_orange"); stool_leg = cyl_mesh(0.013, 0.66, "black_metal", 8)
def sofa(x, y, a, length, depth, places, mat):
    M0 = T(x, y, 0) @ RZ(a)
    put(box_mesh(depth, length, 0.24, 0.06, mat), M0 @ T(0, 0, 0.16), "sofa_seat"); put(box_mesh(0.2, length, 0.44, 0.07, mat), M0 @ T(-depth / 2 + 0.1, 0, 0.3), "sofa_back")
    for s_ in (-1, 1): put(box_mesh(depth, 0.18, 0.3, 0.06, mat), M0 @ T(0, s_ * (length / 2 - 0.09), 0.3), "sofa_arm")
    cw = (length - 0.4) / places
    for i in range(places): put(box_mesh(depth - 0.26, cw - 0.02, 0.13, 0.05, mat), M0 @ T(0.08, -length / 2 + 0.2 + (i + 0.5) * cw, 0.38), "sofa_cushion")
    for sx in (-1, 1):
        for sy in (-1, 1): put(cyl_mesh(0.02, 0.16, "black_metal", 8), M0 @ T(sx * (depth / 2 - 0.08), sy * (length / 2 - 0.1), 0), "sofa_leg")
for s in L["seats"]:
    k = s["kind"]; a = s["face"] + random.uniform(-0.09, 0.09); x, y = s["x"], s["y"]
    if k in ("task chair", "meeting chair", "staff chair", "director chair"):
        pull = random.choice((0.0, 0.0, 0.04, 0.09)); put(CHAIR, T(x - math.cos(a) * pull, y - math.sin(a) * pull, 0) @ RZ(a), "chair")
    elif k in ("lounge armchair", "visitor chair"): put(LOUNGE, T(x, y, 0) @ RZ(a), "lounge")
    elif k == "cafe chair":
        M0 = T(x, y, 0) @ RZ(a); put(cafe_seat, M0 @ T(0, 0, 0.43), "cafe_seat"); put(cafe_back, M0 @ T(-0.2, 0, 0.5), "cafe_back")
        for sx in (-1, 1):
            for sy in (-1, 1): put(cafe_leg, M0 @ T(sx * 0.18, sy * 0.18, 0), "cafe_leg")
    elif k == "cafe stool":
        M0 = T(x, y, 0); put(stool_seat, M0 @ T(0, 0, 0.64), "stool")
        for i in range(4): put(stool_leg, M0 @ T(math.cos(i * math.pi / 2 + 0.78) * 0.14, math.sin(i * math.pi / 2 + 0.78) * 0.14, 0), "stool_leg")
    elif k in ("lounge tub chair", "lounge chair"):
        M0 = T(x, y, 0) @ RZ(a); put(cyl_mesh(0.33, 0.42, "sofa_teal", 40, 0.3), M0, "tub"); put(box_mesh(0.14, 0.6, 0.3, 0.06, "sofa_teal"), M0 @ T(-0.26, 0, 0.4), "tub_back")
    elif "sofa" in k:
        n = len(s.get("ids", [1])); sofa(x, y, a, max(1.3, s["len"]), min(0.95, max(0.75, s["dep"])), n, "sofa_grey" if n > 2 else "sofa_teal")

# planters and plants (upright blades, like a snake plant; nothing fussy that would look fake)
def blades(x, y, z, n, spread, hgt):
    """A clump of slender leaves on thin stems: each leaf is narrow, pointed and paper-thin, with a light fold along
    the midrib, and arches outwards. Many thin leaves read as a real plant; a few wide ones read as plastic."""
    verts, faces = [], []
    for i in range(n):
        ang = random.uniform(0, 6.283); r0 = random.uniform(0, spread); bx, by = x + math.cos(ang) * r0, y + math.sin(ang) * r0
        ln = hgt * random.uniform(0.65, 1.3); wmax = random.uniform(0.016, 0.03); arch = random.uniform(0.25, 1.1); k = len(verts); S = 10
        stem = random.uniform(0.25, 0.45)                    # the first part is a bare stem
        dx, dy = math.cos(ang), math.sin(ang); px, py = -dy, dx; twist = random.uniform(-0.5, 0.5)
        for j in range(S + 1):
            t = j / S
            lt = max(0.0, (t - stem) / (1 - stem))            # 0..1 along the leaf blade
            ww = 0.0025 + (wmax * math.sin(math.pi * min(1.0, 0.04 + lt * 0.96)) ** 0.7 if t > stem else 0.0)
            out = ln * (0.1 * t + arch * 0.6 * t * t); up = ln * (t - 0.5 * arch * t ** 2.8)
            cx_, cy_, cz_ = bx + dx * out, by + dy * out, z + up
            ca_, sa_ = math.cos(twist * lt), math.sin(twist * lt); qx, qy = px * ca_, py * ca_
            verts += [(cx_ - qx * ww, cy_ - qy * ww, cz_ + ww * (0.25 + sa_)), (cx_, cy_, cz_), (cx_ + qx * ww, cy_ + qy * ww, cz_ + ww * (0.25 - sa_))]
        for j in range(S):
            a_ = k + 3 * j; faces += [(a_, a_ + 1, a_ + 4, a_ + 3), (a_ + 1, a_ + 2, a_ + 5, a_ + 4)]
    add("plant", verts, faces, "leaf", smooth=True)
PH = L["heights"]["planter"]
for p in L["planters"]:
    x, y = p["c"]; a, w, d = p["a"], p["w"], p["d"]
    box(x, y, 0.04, w, d, PH - 0.04, a, "planter_white", 0.006, "planter"); box(x, y, 0.06, w * 0.5, d + 0.01, PH - 0.12, a, "oak", 0.003, "planter_panel")
    box(x, y, PH, w + 0.02, d + 0.02, 0.07, a, "planter_top", 0.006, "planter_tray"); box(x, y, PH + 0.05, w - 0.04, d - 0.04, 0.025, a, "soil")
    ca, sa = math.cos(a), math.sin(a)
    for u in (-w * 0.38, -w * 0.23, -w * 0.08, w * 0.08, w * 0.23, w * 0.38): blades(x + ca * u, y + sa * u, PH + 0.06, 30, min(d, 0.3) * 0.42, 0.46)
for p in L["plants"]:
    if p.get("in_box"): continue
    put(cyl_mesh(0.17, 0.44, "pot", 28, 0.13), T(p["x"], p["y"], 0), "pot"); put(cyl_mesh(0.15, 0.02, "soil", 28), T(p["x"], p["y"], 0.42), "soil")
    blades(p["x"], p["y"], 0.42, 46, 0.07, 0.62)

# ------------------------------------------------------------------ light from outside: sky and a morning sun
sf = L["site_fit"]; rho = math.radians(sf["rot_deg"])
def bearing_to_plan(b):
    e, n = math.sin(math.radians(b)), math.cos(math.radians(b)); c, s = math.cos(-rho), math.sin(-rho); return (c * e - s * n, s * e + c * n)
W = bpy.data.worlds.new("World"); SC.world = W; W.use_nodes = True; wn = W.node_tree
bg = next(n for n in wn.nodes if n.type == "BACKGROUND"); bg.inputs["Color"].default_value = (*lin("#cfe0f2"), 1); bg.inputs["Strength"].default_value = 3.2
sd = bearing_to_plan(A.sun_az); el = math.radians(A.sun_el)
sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = 5.5; sun.angle = math.radians(1.2); sun.color = lin("#ffe6c4")
so = bpy.data.objects.new("Sun", sun); COL.objects.link(so)
to_sun = Vector((sd[0] * math.cos(el), sd[1] * math.cos(el), math.sin(el))); so.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()

# ------------------------------------------------------------------ render settings
SC.render.engine = "CYCLES"; C = SC.cycles
C.samples = Q["samples"]; C.use_denoising = True
for attr, val in (("denoiser", "OPENIMAGEDENOISE"), ("max_bounces", 8), ("diffuse_bounces", 4), ("glossy_bounces", 4), ("transmission_bounces", 8),
                  ("transparent_max_bounces", 12), ("sample_clamp_indirect", 8.0), ("caustics_reflective", False), ("caustics_refractive", False), ("use_light_tree", True)):
    try: setattr(C, attr, val)
    except Exception: pass
device = "CPU"
if A.device != "cpu":
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind; prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == kind]
                if devs:
                    for d in prefs.devices: d.use = d.type == kind
                    C.device = "GPU"; device = kind; break
            except Exception: continue
    except Exception: pass
for vt in ("AgX", "Filmic", "Standard"):
    try: SC.view_settings.view_transform = vt; break
    except Exception: continue
for look in ("AgX - Medium High Contrast", "Medium High Contrast", "None"):
    try: SC.view_settings.look = look; break
    except Exception: continue
SC.view_settings.exposure = A.exposure
SC.render.image_settings.file_format = "JPEG"; SC.render.image_settings.quality = 93; SC.render.resolution_percentage = 100

cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data); COL.objects.link(cam); SC.camera = cam
cam_data.clip_start = 0.05; cam_data.clip_end = 300; cam_data.sensor_width = 36
def aim(pos, look):
    cam.location = pos; cam.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
def set_pano(on):
    if on:
        cam_data.type = "PANO"
        try: cam_data.panorama_type = "EQUIRECTANGULAR"
        except Exception: cam_data.cycles.panorama_type = "EQUIRECTANGULAR"
    else: cam_data.type = "PERSP"

blend = os.path.join(OUT, "volt_floor.blend")
try: bpy.ops.wm.save_as_mainfile(filepath=blend)
except Exception as e: print("could not save the .blend:", e)
print(f"\nVolt floor built: {len(bpy.data.objects)} objects. Blender {bpy.app.version_string}, device {device}, {Q['samples']} samples. Saved {blend}\n", flush=True)

want = [w.strip() for w in A.what.split(",") if w.strip()]; only = [r.strip() for r in A.rooms.split(",") if r.strip()]
jobs = []
for r in CAMS["rooms"]:
    if only and r["slug"] not in only: continue
    if "stills" in want: jobs.append(("stills", r))
for r in CAMS["rooms"]:
    if only and r["slug"] not in only: continue
    if "panos" in want: jobs.append(("panos", r))
manifest = {"blender": bpy.app.version_string, "device": device, "samples": Q["samples"], "quality": A.quality, "sun": {"bearing": A.sun_az, "elevation": A.sun_el}, "renders": []}
t_all = time.time(); done = 0
if not A.no_render:
    for kind, r in jobs:
        path = os.path.join(OUT, kind, r["slug"] + ".jpg"); rec = {"kind": kind, "room": r["room"], "slug": r["slug"], "file": f"{kind}/{r['slug']}.jpg"}
        if kind == "stills":
            set_pano(False); cam_data.lens = r["still"]["lens_mm"]; aim(r["still"]["pos"], r["still"]["look"]); SC.render.resolution_x, SC.render.resolution_y = Q["still"]; rec.update(r["still"])
        else:
            set_pano(True); cam.location = r["pano"]["pos"]; cam.rotation_euler = (math.pi / 2, 0, 0); SC.render.resolution_x, SC.render.resolution_y = Q["pano"]
            rec.update(r["pano"]); rec["north_note"] = "The panorama's centre column looks along the plan's +Y axis"
        if os.path.exists(path):
            print(f"skip (already there): {rec['file']}", flush=True); manifest["renders"].append(rec); continue
        t0 = time.time(); SC.render.filepath = path; bpy.ops.render.render(write_still=True); done += 1
        rec["seconds"] = round(time.time() - t0, 1); manifest["renders"].append(rec)
        left = len(jobs) - len(manifest["renders"]); avg = (time.time() - t_all) / max(1, done)
        print(f"[{len(manifest['renders'])}/{len(jobs)}] {rec['file']}  {rec['seconds']} s   about {round(left * avg / 60)} min left", flush=True)
        json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
print(f"\nDone. {done} new pictures in {OUT}\nZip that folder and send it back.\n", flush=True)
