"""Bake the daylight lightmap set and export the three web GLBs + exterior_viewer.json.

usage: Blender -b _build/rtp_exterior.blend --python bake_export_ext.py -- --stage bake   (wrap in tools/locked.sh: Cycles)
       Blender -b _build/rtp_exterior_baked.blend --python bake_export_ext.py -- --stage export

BAKE (Cycles, trees hidden so alpha cards do not print square blobs):
  atlas A  RTP facade parts (ACP bands, fins, spine, lobby, roof plant, dome)     2048 px
  atlas B  RTP floor slabs (top + soffit, per floor)                              2048 px
  atlas C  Class B neighbours                                                     2048 px
  ground   one planar 4096 px AO texture over the 1.12 km context disc (UV 'lightmap' = (x + R, y + R) / 2R)
  Per atlas: AO (8 m), world NORMAL, and SHADOW for three sun directions (morning, golden, midday; sun disc 2 deg, so the
  shadow edge is soft). Written as 8-bit sRGB JPEG/PNG:
    <atlas>_ao.jpg     ambient occlusion, linear 0..1 encoded sRGB       -> three: aoMap (channel 1) or lightMap
    <atlas>_sun.png    R = morning, G = golden, B = midday sun visibility -> modulate the directional light per state
    <atlas>_day.jpg    composed daylight lightmap  B = 0.35 * AO + shadow_midday * max(0, N.L)  scaled by k (99.5th pct = 1),
                       lightMapIntensity = pi / k: the existing Skymark viewer path (lightmapped_meshes.nodes) works unchanged.
  Class C and the terrain carry vertex AO in COLOR_0 (analytic ground-contact AO multiplied into the paint tint).

EXPORT: rtp_building.glb (rtp_L00..rtp_L09, rtp_ROOF parent nodes), rtp_context.glb (EXT_mesh_gpu_instancing for repeated
props), rtp_terrain.glb; EXT_meshopt_compression via meshopt_glb.mjs. three.js frame = (x, z, -y) of rtp_local.
"""
import bpy, bmesh, math, os, sys, json, time, argparse, subprocess, shutil, struct
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exlib as X

ap = argparse.ArgumentParser(); argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap.add_argument("--stage", default="bake"); ap.add_argument("--samples", type=int, default=96); ap.add_argument("--res", type=int, default=2048)
ap.add_argument("--ground-res", type=int, default=4096)
A = ap.parse_args(argv)
sc = bpy.context.scene; META = json.loads(sc["prep"])
LMD = os.path.join(X.BUILD, "lightmaps"); os.makedirs(LMD, exist_ok=True)
WEB = "/Users/lohit/Downloads/Atlas/airoli-rtp/twin/web/models/exterior"
P = json.load(open(os.path.join(X.BUILD, "prep", "prep.json"))); DISC_R = P["disc_r"]
SUNS = {k: Vector(P["states"][k]["dir_to_sun_rtp_local"]) for k in ("morning", "golden", "midday")}

def lm_targets():
    a, b, c, g = [], [], [], []
    for o in sc.objects:
        if o.type != "MESH" or not len(o.data.polygons): continue
        part = o.get("part")
        if o.get("floor"):
            if part == "slab": b.append(o)
            elif part in ("acp", "fins", "lobby", "roof_plant", "dome"): a.append(o)
        elif o.get("ctx") == "B": c.append(o)
        elif o.get("ground_ao") or o.name in ("ctx_median", "ctx_rail_bed"): g.append(o)
    return {"rtp_facade": a, "rtp_slabs": b, "ctx_classB": c}, g

def unwrap(objs, margin=0.003):
    for o in sc.objects: o.select_set(False)
    for o in objs:
        if o.data.users > 1: o.data = o.data.copy()
        uv = o.data.uv_layers.get("lightmap") or o.data.uv_layers.new(name="lightmap"); o.data.uv_layers.active = uv; o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    try: bpy.ops.uv.pack_islands(margin=margin * 1.5, rotate=True)
    except Exception as e: print("pack:", e)
    bpy.ops.object.mode_set(mode="OBJECT")

def planar(objs):
    for o in objs:
        me = o.data; uv = me.uv_layers.get("lightmap") or me.uv_layers.new(name="lightmap")
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        li = np.empty(len(me.loops), np.int32); me.loops.foreach_get("vertex_index", li)
        mw = np.array(o.matrix_world); w = co @ mw[:3, :3].T + mw[:3, 3]
        u = (w[li, 0] + DISC_R) / (2 * DISC_R); v = (w[li, 1] + DISC_R) / (2 * DISC_R)
        uv.data.foreach_set("uv", np.c_[u, v].astype(np.float32).ravel())

def read_img(img):
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32); img.pixels.foreach_get(a); return a.reshape(img.size[1], img.size[0], 4)

def write_png(path, rgb, quality=None):
    """rgb: HxWx3 in 0..1 (already display-encoded). Saved with Blender's own image writer (bottom-up rows as Blender stores them)."""
    h, w = rgb.shape[:2]; im = bpy.data.images.new("_w", w, h, alpha=False)
    im.pixels.foreach_set(np.dstack([rgb, np.ones((h, w))]).astype(np.float32).ravel())
    im.filepath_raw = path; im.file_format = "JPEG" if path.endswith(".jpg") else "PNG"
    if path.endswith(".jpg"): sc.render.image_settings.quality = quality or 88
    im.save(); bpy.data.images.remove(im)

def srgb(x): x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

def dilate(a, mask, it=12):
    """Push valid texels outward into empty ones (bake margin for mip-mapping)."""
    a = a.copy(); m = mask.copy()
    for _ in range(it):
        acc = np.zeros_like(a); cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(np.roll(a, dy, 0), dx, 1); sm = np.roll(np.roll(m, dy, 0), dx, 1)
            acc += sh * sm[..., None]; cnt += sm
        new = (~m) & (cnt > 0); a[new] = acc[new] / cnt[new][:, None]; m = m | new
    return a

def bake_pass(objs, img, kind, samples):
    mats = {m for o in objs for m in o.data.materials if m}; nodes = []
    for m in mats:
        n = m.node_tree.nodes.new("ShaderNodeTexImage"); n.image = img; n.name = "lm_bake"; m.node_tree.nodes.active = n; nodes.append((m, n))
    for o in sc.objects: o.select_set(False)
    for o in objs:
        o.select_set(True); o.data.uv_layers.active = o.data.uv_layers["lightmap"]
    bpy.context.view_layer.objects.active = objs[0]
    sc.cycles.samples = samples
    if kind == "NORMAL":
        sc.render.bake.normal_space = "OBJECT"; bpy.ops.object.bake(type="NORMAL", margin=8, use_clear=True)
    else:
        bpy.ops.object.bake(type=kind, margin=8, use_clear=True)
    for m, n in nodes: m.node_tree.nodes.remove(n)
    for o in objs: o.data.uv_layers.active = o.data.uv_layers["UVMap"]
    return read_img(img)

def sun_rig(direction, angle_deg=2.0):
    for o in [o for o in sc.objects if o.get("bake_sun")]: bpy.data.objects.remove(o)
    ld = bpy.data.lights.new("bake_sun", "SUN"); ld.energy = 1.0; ld.angle = math.radians(angle_deg)
    o = bpy.data.objects.new("bake_sun", ld); sc.collection.objects.link(o); o["bake_sun"] = 1
    o.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler(); return o

def bake():
    t0 = time.time()
    sc.render.engine = "CYCLES"
    try:
        pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = "METAL"; pr.get_devices()
        for d in pr.devices: d.use = True
        sc.cycles.device = "GPU"
    except Exception as e: print("GPU:", e)
    sc.cycles.use_denoising = False; sc.render.bake.margin = 8
    w = bpy.data.worlds.new("bakeW"); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs["Color"].default_value = (0, 0, 0, 1); bg.inputs["Strength"].default_value = 0.0
    w.light_settings.distance = 8.0
    hidden = []
    for o in sc.objects:          # trees, palms, shrubs, cars (alpha cards / small movers) do not occlude in the bake
        if o.get("prop") in ("palm", "tree", "tree_small", "shrub", "car", "bus"): o.hide_render = True; hidden.append(o)
    groups, ground = lm_targets(); info = {}
    for gname, objs in groups.items():
        if not objs: continue
        tg = time.time(); unwrap(objs)
        res = A.res; img = bpy.data.images.new(gname + "_lm", res, res, alpha=False, float_buffer=True)
        ao = bake_pass(objs, img, "AO", max(32, A.samples // 2))[..., 0]
        nrm = bake_pass(objs, img, "NORMAL", 1)[..., :3] * 2 - 1
        sh = {}
        for st, d in SUNS.items():
            sun_rig(d); sh[st] = bake_pass(objs, img, "SHADOW", A.samples)[..., 0]
        for o in [o for o in sc.objects if o.get("bake_sun")]: bpy.data.objects.remove(o)
        bpy.data.images.remove(img)
        mask = np.linalg.norm(nrm, axis=2) > 0.5
        dmid = SUNS["midday"].normalized(); ndl = np.clip(nrm @ np.array(dmid), 0, 1)
        day = 0.35 * ao + sh["midday"] * ndl
        p = float(np.percentile(day[mask], 99.5)) if mask.any() else 1.0; k = 1.0 / max(p, 1e-4)
        def D(x): return dilate(x[..., None] if x.ndim == 2 else x, mask)
        write_png(os.path.join(LMD, f"{gname}_ao.jpg"), srgb(np.repeat(D(ao), 3, 2)))
        write_png(os.path.join(LMD, f"{gname}_sun.png"), srgb(np.concatenate([D(sh["morning"]), D(sh["golden"]), D(sh["midday"])], 2)))
        write_png(os.path.join(LMD, f"{gname}_day.jpg"), srgb(np.repeat(D(day * k), 3, 2)))
        lmi = round(math.pi / k, 5)
        for o in objs:
            o["lightmap"] = f"lightmaps/{gname}_day.jpg"; o["lightMapIntensity"] = lmi; o["aomap"] = f"lightmaps/{gname}_ao.jpg"; o["sunmap"] = f"lightmaps/{gname}_sun.png"; o["lightmap_uv"] = 1
        info[gname] = {"objects": len(objs), "res": res, "samples": A.samples, "k": round(k, 4), "lightMapIntensity": lmi, "coverage": round(float(mask.mean()), 3),
                       "seconds": round(time.time() - tg, 1)}
        print("atlas", gname, info[gname], flush=True)
    # ground AO (planar, one texture)
    tg = time.time(); planar(ground); res = A.ground_res
    img = bpy.data.images.new("ground_ao", res, res, alpha=False, float_buffer=True)
    for o in sc.objects:
        if o.get("ctx") == "terrain": o.hide_render = True; hidden.append(o)
    w.light_settings.distance = 10.0
    ao = bake_pass(ground, img, "AO", max(32, A.samples // 2))[..., 0]; bpy.data.images.remove(img)
    mask = ao > 0.0
    write_png(os.path.join(LMD, "ground_ao.jpg"), srgb(np.repeat(dilate(ao[..., None], mask, 4), 3, 2)), quality=85)
    for o in ground: o["aomap"] = "lightmaps/ground_ao.jpg"; o["lightmap_uv"] = 1
    info["ground_ao"] = {"objects": len(ground), "res": res, "texel_m": round(2 * DISC_R / res, 3), "seconds": round(time.time() - tg, 1)}
    print("ground", info["ground_ao"], flush=True)
    for o in hidden: o.hide_render = False
    info["total_seconds"] = round(time.time() - t0, 1)
    json.dump(info, open(os.path.join(LMD, "bake_info.json"), "w"), indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(X.BUILD, "rtp_exterior_baked.blend"), compress=False)

# ================================================================ export
def flatten_material(m):
    """Plain glTF PBR: base texture straight into Base Color (vertex tint comes as COLOR_0), emission strength 1 where it has an emissive map."""
    if not m.use_nodes: return
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = next((n for n in N if n.type == "BSDF_PRINCIPLED"), None)
    if b is None: return
    base = N.get("BASE")
    if base is not None:
        for l in list(b.inputs["Base Color"].links): L.remove(l)
        L.new(base.outputs["Color"], b.inputs["Base Color"])
    else:
        for l in list(b.inputs["Base Color"].links):
            fn = l.from_node
            if fn.type == "MIX":
                try: b.inputs["Base Color"].default_value = fn.inputs[6].default_value
                except Exception: pass
            L.remove(l)
    for nm in ("Coat Weight", "Sheen Weight", "Subsurface Weight"):
        if nm in b.inputs: b.inputs[nm].default_value = 0.0
    if N.get("EMIT_TEX") is not None or float(m.get("emit_night", 0)) > 0:
        b.inputs["Emission Strength"].default_value = 1.0
    out = next((n for n in N if n.type == "OUTPUT_MATERIAL"), None)
    if out is not None and m.get("kind") != "glass":
        for l in list(out.inputs["Surface"].links): L.remove(l)
        L.new(b.outputs["BSDF"], out.inputs["Surface"])

def glb_patch(path, rules):
    """Edit the GLB JSON chunk in place (materials alpha / glass parameters)."""
    d = open(path, "rb").read(); jl = struct.unpack("<I", d[12:16])[0]; js = json.loads(d[20:20 + jl]); rest = d[20 + jl:]
    rules(js)
    nj = json.dumps(js).encode(); nj += b" " * ((4 - len(nj) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(nj) + len(rest)) + struct.pack("<II", len(nj), 0x4E4F534A) + nj + rest
    open(path, "wb").write(out)

def mat_rules(js):
    for m in js.get("materials", []):
        n = m.get("name", "")
        if n.startswith("facade_glass") or n == "rail_glass":
            m["pbrMetallicRoughness"] = {"baseColorFactor": [0.36, 0.55, 0.54, 0.42] if n != "rail_glass" else [0.7, 0.82, 0.8, 0.25], "metallicFactor": 0.85, "roughnessFactor": 0.04}
            m["alphaMode"] = "BLEND"; m["doubleSided"] = True; m.pop("emissiveFactor", None); m.pop("extensions", None)
            m["extras"] = {**m.get("extras", {}), "viewer_glass": "replace with the viewer's env-mapped glass: IOR 1.52, tint #6d9a98, reflect 0.34 at normal incidence rising to 1 (Fresnel), env map = rtp_env_<state>.hdr"}
        if n in ("prop_palm_frond", "prop_leaf"):
            m["alphaMode"] = "MASK"; m["alphaCutoff"] = 0.5; m["doubleSided"] = True
        if n == "road_marking":
            m["extras"] = {**m.get("extras", {}), "polygonOffset": [-2, -2]}

def prune(keep):
    for o in list(bpy.context.scene.objects):
        if not keep(o): bpy.data.objects.remove(o)
    bpy.ops.outliner.orphans_purge(do_recursive=True) if bpy.context.area else None

def export_one(name, keep, instance=False):
    bpy.ops.wm.open_mainfile(filepath=SRC); s = bpy.context.scene
    prune(keep)
    for o in s.objects:
        if o.type == "MESH":
            me = o.data
            if not (o.get("ctx") in ("C", "terrain")) and me.color_attributes.get("Col") and me.users == 1: me.color_attributes.remove(me.color_attributes["Col"])
            for k in ("lightmap", "lightMapIntensity", "aomap", "sunmap", "lightmap_uv", "floor", "level", "part", "ctx", "label", "prop", "h", "h_src"):
                pass
    for m in bpy.data.materials: flatten_material(m)
    for o in s.objects: o.select_set(o.type in ("MESH", "EMPTY"))
    d = os.path.join(X.BUILD, "export"); os.makedirs(d, exist_ok=True); raw = os.path.join(d, name + ".raw.glb"); glb = os.path.join(d, name + ".glb")
    kw = dict(filepath=raw, export_format="GLB", use_selection=True, export_extras=True, export_cameras=False, export_lights=False, export_apply=True,
              export_texcoords=True, export_normals=True, export_yup=True, export_image_format="AUTO", export_vertex_color="ACTIVE")
    try: bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        kw.pop("export_vertex_color"); bpy.ops.export_scene.gltf(**kw)
    glb_patch(raw, mat_rules)
    r_ = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "meshopt_glb.mjs"), raw, glb] + (["--instance"] if instance else []),
                        capture_output=True, text=True, timeout=1800)
    mo = {"applied": False}
    if r_.returncode == 0: mo = dict(json.loads(r_.stdout.strip().splitlines()[-1]), applied=True)
    else: print("meshopt failed:", r_.stderr[-800:]); shutil.copy(raw, glb)
    print("exported", name, mo, flush=True)
    lm = {o.name: {"lightmap": o["lightmap"], "lightMapIntensity": o["lightMapIntensity"], "aomap": o.get("aomap"), "sunmap": o.get("sunmap"), "uv": 1}
          for o in s.objects if o.get("lightmap")}
    ao = {o.name: {"aomap": o["aomap"], "uv": 1} for o in s.objects if o.get("aomap") and not o.get("lightmap")}
    return {"file": name + ".glb", "mb": round(os.path.getsize(glb) / 1e6, 2), "meshopt": mo}, lm, ao

SRC = bpy.data.filepath
def export():
    t0 = time.time()
    is_rtp = lambda o: bool(o.get("floor")) or (o.type == "EMPTY" and o.get("rtp_floor"))
    is_ctx = lambda o: (o.type == "MESH" and (o.get("ctx") in ("B", "C", "ground", "road", "props") or o.get("prop"))) and o.get("ctx") != "terrain"
    is_ter = lambda o: o.get("ctx") == "terrain"
    files = {}; lms = {}; aos = {}
    for nm, keep, inst in (("rtp_building", is_rtp, False), ("rtp_context", is_ctx, True), ("rtp_terrain", is_ter, False)):
        f, lm, ao = export_one(nm, keep, inst); files[nm] = f; lms.update(lm); aos.update(ao)
    os.makedirs(os.path.join(WEB, "lightmaps"), exist_ok=True)
    for nm in files: shutil.copy(os.path.join(X.BUILD, "export", nm + ".glb"), os.path.join(WEB, nm + ".glb"))
    for f in os.listdir(LMD):
        if f.endswith((".jpg", ".png")): shutil.copy(os.path.join(LMD, f), os.path.join(WEB, "lightmaps", f))
    lm_mb = round(sum(os.path.getsize(os.path.join(LMD, f)) for f in os.listdir(LMD) if f.endswith((".jpg", ".png"))) / 1e6, 2)
    json.dump({"files": files, "lightmapped": lms, "ao_only": aos, "lightmaps_mb": lm_mb, "seconds": round(time.time() - t0, 1)},
              open(os.path.join(X.BUILD, "export", "export_info.json"), "w"), indent=1)
    print("export done", files, "lightmaps MB", lm_mb, flush=True)

if A.stage == "bake": bake()
elif A.stage == "export": export()
