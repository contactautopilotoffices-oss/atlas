"""Lightmap bake and GLB export for the web viewer (three.js r169).

BAKE. Static surfaces with their own (unshared) mesh: floor finishes, walls, ceilings, rafts, columns, skirting, the
stair, and the soffit slab where a room has an open ceiling. Each gets a 2nd UV map "lightmap" (Smart UV Project,
packed per atlas: objects are grouped into atlases of --bake-res px at about --bake-texel m per pixel). Cycles bakes
the DIFFUSE pass, direct + indirect, colour OFF: what lands on each surface (sun, sky through the windows, every lamp
and LED, bounced) as the outgoing radiance of a white surface, B = E / pi. Denoised with the compositor's Denoise
node (OpenImageDenoise); if that fails, a light blur. Saved as 8-bit sRGB PNG of B * k (k so the 99.5th percentile
is 1.0). Instanced furniture (shared meshes) is not lightmapped: one mesh, many places, one UV set.

HOW THE VIEWER APPLIES IT (three.js r169):
  const tex = await new THREE.TextureLoader().loadAsync(url);   // the atlas PNG named in node.userData.lightmap
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.channel = 1;     // channel 1 = glTF TEXCOORD_1 = 'uv1'
  mesh.material.lightMap = tex; mesh.material.lightMapIntensity = node.userData.lightMapIntensity;   // = pi / k
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 2 ** exposure_ev;      // from the manifest
  r169 adds lightMap texel * intensity to the irradiance and multiplies by albedo / pi, so the pi / k intensity gives
  back exactly what Cycles saw. Lightmapped meshes need no scene lights; give the rest (instanced furniture) a dim
  environment (RoomEnvironment through PMREM, ~0.6) so they sit in the same light.

EXPORT. <tenant>.glb: linked meshes stay shared (instancing kept), geometry compressed with EXT_meshopt_compression by
meshopt_glb.mjs (load with GLTFLoader.setMeshoptDecoder(MeshoptDecoder)); <tenant>.raw.glb is the uncompressed one; textures
<= 2048 px, custom properties as node extras (userData). A separate node <tenant>_COLLISION (walls, glass,
balustrades, furniture footprints as 1 m high blocks) carries extras {"collision": 1}: hide it, raycast against it.
glTF is Y up: plan (x, y, z) becomes three.js (x, z, -y).
"""
import bpy, json, math, os, re, sys, time
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL
from twin_lib import Raster

STATIC = ("FLOOR", "WALL", "CEILING", "COLUMN", "SKIRTING", "STAIR", "SLAB")

def area(o):
    return sum(p.area for p in o.data.polygons) * max(o.matrix_world.to_scale()) ** 2

def pick_static(L, A, meta):
    sc = bpy.context.scene; open_ceiling = any(c.get("type") in ("open", "baffle") for c in meta.get("ceilings", {}).values())
    objs = [o for o in sc.objects if o.type == "MESH" and o.get("twin_layer") in STATIC and o.get("static") and o.data.users == 1]
    objs = [o for o in objs if not (o.get("twin_layer") == "SLAB" and "above" in o.name and not open_ceiling) and not (o.get("twin_layer") == "SLAB" and "above" not in o.name)]
    if getattr(A, "rooms", ""):
        ras = Raster(L); boxes = [r["box"] for r in ras.rooms if r.get("box") and re.search(A.rooms, r["name"], re.I)]
        def touches(o):
            if o.get("room"): return any(re.search(A.rooms, o["room"], re.I) for _ in [0])
            ws = [o.matrix_world @ Vector(c) for c in o.bound_box]; x0, x1 = min(v.x for v in ws), max(v.x for v in ws); y0, y1 = min(v.y for v in ws), max(v.y for v in ws)
            return any(x0 < b[2] and x1 > b[0] and y0 < b[3] and y1 > b[1] for b in boxes)
        objs = [o for o in objs if touches(o)]
    return objs

def split_big(objs, cap, tile=8.0):
    """Bake only: an object bigger than one atlas (a CAD wall polyline round the whole floor) is cut into 8 m tiles by
    face centre, so each tile is its own UV island set at full density. The parts keep every property of the original."""
    import bmesh
    out = []
    for o in objs:
        if area(o) <= cap * 0.8: out.append(o); continue
        me = o.data; cells = {}
        for p in me.polygons:
            c = o.matrix_world @ p.center; cells.setdefault((int(c.x // tile), int(c.y // tile)), []).append(p.index)
        for k_, (key, idx) in enumerate(sorted(cells.items())):
            bm = bmesh.new(); bm.from_mesh(me); keep = set(idx)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context="FACES")
            nm = bpy.data.meshes.new(f"{me.name}_part{k_}"); bm.to_mesh(nm); bm.free()
            for m in me.materials: nm.materials.append(m)
            po = bpy.data.objects.new(f"{o.name}_part{k_}", nm); po.matrix_world = o.matrix_world
            for c_ in o.users_collection: c_.objects.link(po)
            for kk, vv in o.items(): po[kk] = vv
            po["split_from"] = o.name; out.append(po)
        bpy.data.objects.remove(o)
    return out

def atlases(objs, res, texel):
    cap = (res * texel) ** 2 * 0.5; groups = []
    for o in sorted(objs, key=lambda o: -area(o)):
        a = area(o)
        for g in groups:
            if g["area"] + a <= cap: g["objs"].append(o); g["area"] += a; break
        else: groups.append({"objs": [o], "area": a})
    return groups

def unwrap(group):
    vl = bpy.context.view_layer
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in group:
        uv = o.data.uv_layers.get("lightmap") or o.data.uv_layers.new(name="lightmap")
        o.data.uv_layers.active = uv; o.select_set(True)
    vl.objects.active = group[0]
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    pad = getattr(bpy.context.scene, "get", lambda k, d=None: d)("twin_lm_pad_px", 0)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    try:
        if pad: bpy.ops.uv.pack_islands(margin_method="FRACTION", margin=pad / bpy.context.scene["twin_lm_res"], rotate=True)     # opt-in: a fixed pixel gap between islands
        else: bpy.ops.uv.pack_islands(margin=0.006, rotate=True)
    except Exception as e: print("pack_islands:", e)
    bpy.ops.object.mode_set(mode="OBJECT")
    def bounds():
        lo, hi = 1e9, -1e9
        for o in group:
            uv = np.empty(len(o.data.loops) * 2, np.float32); o.data.uv_layers["lightmap"].data.foreach_get("uv", uv)
            if len(uv): lo = min(lo, float(uv.min())); hi = max(hi, float(uv.max()))
        return lo, hi
    lo, hi = bounds()
    if pad and (hi > 1.0005 or lo < -0.0005):       # the fixed-pixel margin overflows the atlas with many small islands, and that layout
        # bakes black (Blender 5.2): re-pack with scaled margins instead
        print(f"  unwrap: islands overflow the atlas ({lo:.3f}..{hi:.3f}), re-packing with scaled margins", flush=True)
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.select_all(action="SELECT")
        try: bpy.ops.uv.pack_islands(margin_method="SCALED", margin=max(0.006, pad / bpy.context.scene["twin_lm_res"]), rotate=True)
        except Exception as e: print("pack_islands:", e)
        bpy.ops.object.mode_set(mode="OBJECT"); lo, hi = bounds()
    if hi > 1.0005 or lo < -0.0005:                   # scale the whole layout into the atlas (the pixel gap shrinks by the same factor)
        k = 1.0 / max(hi - min(lo, 0.0), 1e-6)
        for o in group:
            uv = np.empty(len(o.data.loops) * 2, np.float32); L_ = o.data.uv_layers["lightmap"].data; L_.foreach_get("uv", uv)
            L_.foreach_set("uv", (uv - min(lo, 0.0)) * k)
        lo, hi = bounds(); print(f"  unwrap: layout scaled into the atlas ({lo:.3f}..{hi:.3f})", flush=True)
    if hi > 1.001 or lo < -0.001: raise RuntimeError(f"lightmap UVs outside the atlas: {lo}..{hi}")
    nov = None          # UV overlaps are counted after the bake by uv_overlap_check.py (texel raster per atlas)
    if bpy.context.object and bpy.context.object.mode != "OBJECT": bpy.ops.object.mode_set(mode="OBJECT")
    return nov

def denoise(img_path, out_path, res, albedo=None, normal=None):
    """OpenImageDenoise through the compositor, on its own empty scene (5.x node-group compositor)."""
    main = bpy.context.window.scene if bpy.context.window else bpy.context.scene
    sc = bpy.data.scenes.new("lm_denoise"); sc.render.engine = "CYCLES"; sc.cycles.samples = 1; sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.resolution_percentage = 100; sc.view_settings.view_transform = "Standard"; sc.render.use_compositing = True
    ng = bpy.data.node_groups.new("lm_denoise", "CompositorNodeTree"); sc.compositing_node_group = ng
    try: ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    except Exception: pass
    im = ng.nodes.new("CompositorNodeImage"); im.image = bpy.data.images.load(img_path, check_existing=False)
    dn = ng.nodes.new("CompositorNodeDenoise")
    for k, v in (("prefilter", "ACCURATE"), ("use_hdr", True)):
        try: setattr(dn, k, v)
        except Exception: pass
    try: dn.inputs["HDR"].default_value = True
    except Exception: pass
    go = ng.nodes.new("NodeGroupOutput"); ng.links.new(im.outputs["Image"], dn.inputs["Image"]); ng.links.new(dn.outputs["Image"], go.inputs[0])
    for path, sock in ((albedo, "Albedo"), (normal, "Normal")):        # OIDN guides: surface colour and normal
        if path and sock in dn.inputs:
            gi = ng.nodes.new("CompositorNodeImage"); gi.image = bpy.data.images.load(path, check_existing=False); ng.links.new(gi.outputs["Image"], dn.inputs[sock])
    sc.render.image_settings.file_format = "OPEN_EXR"; sc.render.image_settings.color_depth = "32"
    sc.render.filepath = out_path
    bpy.ops.render.render(write_still=True, scene=sc.name)
    bpy.data.scenes.remove(sc); bpy.data.node_groups.remove(ng)
    return os.path.exists(out_path)

class nullcontext:
    def __enter__(self): return self
    def __exit__(self, *a): return False

def TL_write_exr(p, a):
    import OpenImageIO as oiio
    h, w, c = a.shape; spec = oiio.ImageSpec(w, h, c, oiio.FLOAT); o = oiio.ImageOutput.create(p); o.open(p, spec); o.write_image(np.ascontiguousarray(a, np.float32)); o.close()

def read_exr(p):
    import OpenImageIO as oiio
    i = oiio.ImageInput.open(p); a = np.asarray(i.read_image(format=oiio.FLOAT)); i.close(); return a

def bake(tenant, L, S, out, A):
    t0 = time.time(); sc = bpy.context.scene; meta = json.loads(sc.get("twin_meta", "{}"))
    TL.setup_cycles(sc, A.bake_samples, A.device, denoise=False)
    objs = pick_static(L, A, meta); cap = (A.bake_res * A.bake_texel) ** 2 * 0.5
    tf = {"COLUMN": 0.6}         # texel factor per layer: each factor gets its own atlases (columns denser by default)
    if getattr(A, "bake_texel_by", ""):     # opt-in, e.g. WALL:0.6,SKIRTING:0.6,COLUMN:0.4 (denser walls and columns: no smears at edges)
        tf.update({k: float(v) for k, v in (kv.split(":") for kv in A.bake_texel_by.split(","))})
    fac = lambda o: tf.get(o.get("twin_layer"), 1.0)
    if not getattr(A, "bake_texel_by", ""): objs = split_big(objs, cap)
    else:          # factors read BEFORE splitting: split_big removes the big originals (their parts keep the layer)
        byf = {}
        for o in objs: byf.setdefault(fac(o), []).append(o)
        objs = [p for f in sorted(byf) for p in split_big(byf[f], (A.bake_res * A.bake_texel * f) ** 2 * 0.5)]
    groups = []
    for f in sorted({fac(o) for o in objs}, reverse=True): groups += atlases([o for o in objs if fac(o) == f], A.bake_res, A.bake_texel * f)
    for g in groups: g["texel"] = A.bake_texel * fac(g["objs"][0])
    if getattr(A, "bake_pad_px", 0): sc["twin_lm_pad_px"] = A.bake_pad_px; sc["twin_lm_res"] = A.bake_res
    d = os.path.join(out, "export", "lightmaps"); os.makedirs(d, exist_ok=True)
    print(f"bake: {len(objs)} static objects in {len(groups)} atlas(es) of {A.bake_res}px, {A.bake_samples} samples", flush=True)
    sc.render.bake.use_pass_direct = True; sc.render.bake.use_pass_indirect = True; sc.render.bake.use_pass_color = False
    sc.render.bake.margin = 16; sc.render.bake.use_clear = True; sc.render.bake.target = "IMAGE_TEXTURES"
    info = {}
    for gi, g in enumerate(groups):
        tg = time.time(); g["uv_overlap_faces"] = unwrap(g["objs"])
        name = f"{tenant}_lm{gi}"; img = bpy.data.images.new(name, A.bake_res, A.bake_res, alpha=False, float_buffer=True)
        mats = {m for o in g["objs"] for m in o.data.materials if m}
        nodes = []
        for m in mats:
            n = m.node_tree.nodes.new("ShaderNodeTexImage"); n.image = img; n.name = "lm_bake"; m.node_tree.nodes.active = n; nodes.append((m, n))
        for o in sc.objects: o.select_set(False)
        for o in g["objs"]: o.select_set(True)
        bpy.context.view_layer.objects.active = g["objs"][0]
        sb = {k: int(v) for k, v in (kv.split(":") for kv in getattr(A, "bake_samples_by", "").split(",") if ":" in kv)}
        g["samples"] = max([sb.get(o.get("twin_layer"), A.bake_samples) for o in g["objs"]] + [A.bake_samples]); sc.cycles.samples = g["samples"]
        for attempt in range(3):           # a GPU short of memory can return an all-black bake without an error: check and retry
            bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=16, use_clear=True)
            px = np.empty(len(img.pixels), np.float32); img.pixels.foreach_get(px)
            if float(px.reshape(-1, 4)[:, :3].max()) > 0: break
            print(f"  atlas {name}: bake came back all black (attempt {attempt + 1}), retrying", flush=True); import gc; gc.collect(); time.sleep(5)
        else:
            raise RuntimeError(f"atlas {name}: bake is all black after 3 attempts (GPU memory?). Stop other Blender jobs and re-run.")
        sc.cycles.samples = A.bake_samples
        raw = os.path.join(d, f"_{name}.exr"); img.filepath_raw = raw; img.file_format = "OPEN_EXR"; img.save()
        # guides for the denoiser: albedo (diffuse colour) and world normal, 1-4 samples each
        keep_s = sc.cycles.samples; sc.cycles.samples = 4
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=16, use_clear=True)
        alb = os.path.join(d, f"_{name}_alb.exr"); img.filepath_raw = alb; img.save()
        sc.render.bake.normal_space = "OBJECT"
        bpy.ops.object.bake(type="NORMAL", margin=16, use_clear=True)
        nrm = os.path.join(d, f"_{name}_nrm.exr"); img.filepath_raw = nrm; img.save()
        sc.cycles.samples = keep_s
        try:
            na = read_exr(nrm); na[..., :3] = na[..., :3] * 2 - 1; TL_write_exr(nrm, na)          # colour 0..1 -> normal -1..1
        except Exception as e: print("normal guide conversion:", e)
        for m, n in nodes: m.node_tree.nodes.remove(n)
        bpy.data.images.remove(img)
        den = os.path.join(d, f"_{name}_dn.exr"); ok = False
        try: ok = denoise(raw, den, A.bake_res, alb, nrm)
        except Exception as e: print("compositor denoise failed, blurring instead:", e, flush=True)
        a = read_exr(den if ok else raw)[..., :3]
        if not ok:
            k = np.array([1, 4, 6, 4, 1], np.float32) / 16
            for ax in (0, 1): a = sum(np.roll(a, s - 2, axis=ax) * k[s] for s in range(5))
        clip = getattr(A, "lm_clip_pct", 99.5) or 99.5          # opt-in lower percentile: a few hot texels (sun patches) no longer push the rest into the bottom codes
        p995 = float(np.percentile(a[a.sum(2) > 0], clip)) if (a.sum(2) > 0).any() else 1.0; kk = 1.0 / max(p995, 1e-6)
        if getattr(A, "lm_keep_float", False): TL_write_exr(os.path.join(d, f"_{name}_float.exr"), a)     # keep the denoised float atlas: re-normalise later without a re-bake
        png = os.path.join(d, f"{name}.png")
        # the PNG is sRGB-encoded (so 8 bits hold the darks); the viewer marks it SRGBColorSpace and three decodes it
        enc = np.clip(a * kk, 0, 1); enc = np.where(enc <= 0.0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - 0.055)
        TL.write_png(png, enc)      # same row order as Blender's own image files
        q = np.round(enc * 255).astype(np.uint8); used = q[(a.sum(2) > 0)]; g_ = used[:, 1] if used.ndim == 2 else used
        levels = int(len(np.unique(g_[g_ > 0]))); med = float(np.median(g_)) if len(g_) else 0.0
        g["lm_levels"] = levels; g["lm_median_code"] = round(med, 1); g["lm_clip_pct"] = clip
        for f_ in (raw, den, alb, nrm):
            if os.path.exists(f_): os.remove(f_)
        for o in g["objs"]:
            o["lightmap"] = os.path.basename(png); o["lightMapIntensity"] = round(math.pi / kk, 5); o["lightmap_uv"] = 1
            o.data.uv_layers.active = o.data.uv_layers["UVMap"]
            try: o.data.uv_layers["UVMap"].active_render = True
            except Exception: pass
        info[name] = {"objects": [o.name for o in g["objs"]], "area_m2": round(g["area"], 1), "scale_k": round(kk, 4), "lightMapIntensity": round(math.pi / kk, 5),
                      "denoised": "OIDN (compositor, albedo + normal guides)" if ok else "blur fallback", "texel_m": round(g["texel"], 4),
                      "seconds": round(time.time() - tg, 1), "levels_8bit": g.get("lm_levels"), "median_code": g.get("lm_median_code"), "clip_pct": g.get("lm_clip_pct"), "samples": g.get("samples"), **({"uv_overlap_faces": g["uv_overlap_faces"]} if g.get("uv_overlap_faces") is not None else {})}
        print(f"  atlas {name}: {len(g['objs'])} objects, {g['area']:.0f} m2, denoise {'OIDN' if ok else 'blur'}, {time.time() - tg:.0f} s", flush=True)
    json.dump({"atlases": info, "res": A.bake_res, "samples": A.bake_samples, "texel_m": A.bake_texel, "seconds": round(time.time() - t0, 1)},
              open(os.path.join(d, f"{tenant}_lightmaps.json"), "w"), indent=1)

def collision(tenant, out):
    from twin_lib import MB, Materials
    import placement_check as PC
    sc = bpy.context.scene; V, F = [], []
    def add_box(poly, z0, z1):
        k = len(V); n = len(poly)
        V.extend([(x, y, z0) for x, y in poly] + [(x, y, z1) for x, y in poly])
        F.append(tuple(k + i for i in range(n))[::-1]); F.append(tuple(k + n + i for i in range(n)))
        for i in range(n): F.append((k + i, k + (i + 1) % n, k + n + (i + 1) % n, k + n + i))
    for o in sc.objects:
        L_ = o.get("twin_layer")
        if o.type != "MESH": continue
        if L_ in ("WALL", "COLUMN") or (L_ in ("GLASS", "RAILING")):
            mw = o.matrix_world; k = len(V); V.extend([tuple(mw @ v.co) for v in o.data.vertices]); F.extend([tuple(k + i for i in p.vertices) for p in o.data.polygons])
        elif L_ in PC.FURN and not o.get("wall_mounted"):
            add_box(PC.footprint(o), 0.0, 1.0)
    me = bpy.data.meshes.new(f"{tenant}_COLLISION"); me.from_pydata(V, [], F); me.validate()
    o = bpy.data.objects.new(f"{tenant}_COLLISION", me); sc.collection.objects.link(o); o["collision"] = 1; o.hide_render = True
    return o

FURN_LAYERS = {"DESK", "SEAT", "TABLE", "PLANTER", "PLANT", "FIXTURE", "RUG"}
ARCH_ORDER = ("FLOOR", "WALL", "SKIRTING", "COLUMN", "CEILING", "SLAB", "STAIR")
LIGHT_RIG = {"CAMERA"}

def _join(objs, name, layer, extra=None):
    """Join objects into one (web export only; the .blend keeps one object per block)."""
    sc = bpy.context.scene
    for o in sc.objects: o.select_set(False)
    keep = objs[0]
    for o in objs:
        if o.data.users > 1: o.data = o.data.copy()          # joining needs single-user data
        o.select_set(True)
    bpy.context.view_layer.objects.active = keep
    if len(objs) > 1: bpy.ops.object.join()
    keep.name = name; keep["twin_layer"] = layer
    for k in [k for k in keep.keys() if k not in ("twin_layer",)]:
        if k not in (extra or {}): del keep[k]
    for k, v in (extra or {}).items(): keep[k] = v
    return keep

def _decimate(me, target):
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    if tris <= target: return me
    sc = bpy.context.scene; tmp = bpy.data.objects.new("_dec", me); sc.collection.objects.link(tmp)
    md = tmp.modifiers.new("d", "DECIMATE"); md.ratio = max(0.02, target / tris)
    new = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(tmp)
    if me.get("proto_key"): new["proto_key"] = me["proto_key"]
    return new

WEB = {}          # the style's "web" block, set by export(): opt-in web-only choices (chair decimation, material overrides)

def _decimate(me, ratio):
    """Web furniture from the real model: collapse decimation to `ratio` of the triangles (shape kept, UVs kept)."""
    sc = bpy.context.scene; tmp = bpy.data.objects.new("_dec", me); sc.collection.objects.link(tmp)
    md = tmp.modifiers.new("d", "DECIMATE"); md.decimate_type = "COLLAPSE"; md.ratio = ratio; md.use_collapse_triangulate = True
    new = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(tmp)
    if me.get("proto_key"): new["proto_key"] = me["proto_key"]
    return new

def _simplify(me):
    """Web furniture: planar dissolve only (merges the bevel strips into flat faces, never moves a vertex, so no spikes)."""
    sc = bpy.context.scene; tmp = bpy.data.objects.new("_dis", me); sc.collection.objects.link(tmp)
    md = tmp.modifiers.new("d", "DECIMATE"); md.decimate_type = "DISSOLVE"; md.angle_limit = math.radians(25); md.use_dissolve_boundaries = False
    new = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(tmp)
    for k in ("proto_key",):
        if me.get(k): new[k] = me[k]
    return new

def _mat(name, color, rough=0.6, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*TL.lin(color), 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m

def _web_chair(lounge=False):
    """A clean low-poly office chair (seat, back, arms, gas lift, 5-star base, castors) facing +x, 1.02 m tall; or an
    upholstered lounge chair. About 1.2-1.8k triangles. Built for the web export only."""
    import bmesh
    fab = _mat("web_chair_fabric", "#1b1c1e", 0.85) if not lounge else _mat("web_lounge_fabric", "#8a8580", 0.9)
    frame = _mat("web_chair_frame", "#c9cbce", 0.25, 1.0) if not lounge else _mat("web_lounge_leg", "#1c1c1d", 0.4, 1.0)
    bm = bmesh.new(); mats = [fab, frame]
    def box(cx, cy, cz, sx, sy, sz, mi, bev=0.0, seg=2):
        r = bmesh.ops.create_cube(bm, size=1.0); vs = r["verts"]
        for v in vs: v.co = Vector((cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz))
        for f in {f for v in vs for f in v.link_faces}: f.material_index = mi        # bevel faces inherit it
        if bev: bmesh.ops.bevel(bm, geom=list({e for v in vs for e in v.link_edges}), offset=bev, segments=seg, affect="EDGES")
    def cyl(cx, cy, z0, z1, r, mi, seg=10, rot=None):
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=z1 - z0)
        for v in res["verts"]:
            co = v.co.copy(); co.z += (z0 + z1) / 2
            if rot is not None: co = rot @ Vector((co.x, co.y, co.z - (z0 + z1) / 2)) + Vector((0, 0, (z0 + z1) / 2))
            v.co = co + Vector((cx, cy, 0))
        for f in {f for v in res["verts"] for f in v.link_faces}: f.material_index = mi
    if not lounge:
        box(0.02, 0, 0.47, 0.48, 0.50, 0.08, 0, 0.025)                    # seat cushion
        box(-0.24, 0, 0.78, 0.07, 0.46, 0.50, 0, 0.025)                   # back
        for e in (-1, 1):
            box(0.0, e * 0.25, 0.66, 0.30, 0.05, 0.04, 1, 0.012)           # arm pad
            box(-0.02, e * 0.25, 0.57, 0.04, 0.03, 0.18, 1)                # arm post
        cyl(0, 0, 0.12, 0.43, 0.028, 1, 10)                               # gas lift
        for k in range(5):
            a = k * 2 * math.pi / 5; ca, sa = math.cos(a), math.sin(a)
            box(ca * 0.16, sa * 0.16, 0.09, 0.32, 0.035, 0.03, 1)
            for v in list(bm.verts)[-8:]:
                rel = v.co - Vector((ca * 0.16, sa * 0.16, 0.09)); v.co = Vector((ca * 0.16 + rel.x * ca - rel.y * sa, sa * 0.16 + rel.x * sa + rel.y * ca, 0.09 + rel.z))
            cyl(ca * 0.31, sa * 0.31, 0.0, 0.05, 0.025, 1, 8)              # castor
    else:
        box(0.03, 0, 0.30, 0.66, 0.70, 0.18, 0, 0.05, 3)                  # seat
        box(-0.28, 0, 0.55, 0.16, 0.74, 0.50, 0, 0.05, 3)                 # back
        for e in (-1, 1): box(0.03, e * 0.34, 0.45, 0.62, 0.12, 0.30, 0, 0.04, 3)
        for sx in (-1, 1):
            for sy in (-1, 1): cyl(sx * 0.27, sy * 0.30, 0.0, 0.21, 0.018, 1, 8)
    me = bpy.data.meshes.new("web_lounge" if lounge else "web_chair"); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    for p in me.polygons: p.use_smooth = False
    return me

def _fit_to(proxy, ref):
    """Scale a proxy (x, y, z separately) to the bounding box of the mesh it stands in for."""
    def bb(m):
        co = [v.co for v in m.vertices]; return [min(c[i] for c in co) for i in range(3)], [max(c[i] for c in co) for i in range(3)]
    (a0, a1), (b0, b1) = bb(proxy), bb(ref)
    me = proxy.copy(); k = [(b1[i] - b0[i]) / max(1e-6, a1[i] - a0[i]) for i in range(3)]
    me.transform(Matrix.Translation(((b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2, b0[2])) @ Matrix.Diagonal((*k, 1)) @ Matrix.Translation((-(a0[0] + a1[0]) / 2, -(a0[1] + a1[1]) / 2, -a0[2])))
    return me

def _web_materials(objs):
    """Make every exported material plain glTF PBR: base colour (+texture) and roughness. No sheen (three.js would
    paint fabrics white with the default white sheen colour), no clearcoat, leaves a solid green, glass simple."""
    seen = set()
    for o in objs:
        for m in o.data.materials:
            if not m or m.name in seen or not m.use_nodes: continue
            seen.add(m.name); nt = m.node_tree; b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b is None: continue
            for nm in ("Sheen Weight", "Coat Weight", "Subsurface Weight"):
                if nm in b.inputs: b.inputs[nm].default_value = 0.0
            out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
            k = m.get("twin_kind", "")
            ov = WEB.get("materials", {}).get(m.name.split(".")[0])
            if ov:          # opt-in: a web-only plain finish (a texture that reads well in Cycles can stretch on the web's box UVs)
                for l in list(b.inputs["Base Color"].links): nt.links.remove(l)
                b.inputs["Base Color"].default_value = (*TL.lin(ov["color"]), 1)
                for l in list(b.inputs["Roughness"].links): nt.links.remove(l)
                b.inputs["Roughness"].default_value = ov.get("rough", 0.5)
                if "metal" in ov: b.inputs["Metallic"].default_value = ov["metal"]
            if k == "leaf":
                for l in list(b.inputs["Base Color"].links): nt.links.remove(l)
                b.inputs["Base Color"].default_value = (*TL.lin("#3d6e2e"), 1); b.inputs["Roughness"].default_value = 0.5
            if out is not None and (not out.inputs["Surface"].is_linked or out.inputs["Surface"].links[0].from_node != b):
                for l in list(out.inputs["Surface"].links): nt.links.remove(l)
                nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
            for n in nt.nodes:
                if n.type == "TEX_IMAGE" and n.image and max(n.image.size) > 1024 and o.get("twin_layer") == "FURNITURE":
                    kk = 1024 / max(n.image.size); n.image.scale(int(n.image.size[0] * kk), int(n.image.size[1] * kk))

def _box_mesh(me):
    co = [v.co for v in me.vertices]; lo = [min(c[i] for c in co) for i in range(3)]; hi = [max(c[i] for c in co) for i in range(3)]
    v = [(x, y, z) for z in (lo[2], hi[2]) for y in (lo[1], hi[1]) for x in (lo[0], hi[0])]
    f = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
    b = bpy.data.meshes.new(me.name + "_box"); b.from_pydata(v, [], f); b.update()
    if me.materials: b.materials.append(me.materials[0])
    return b

def prep_web(tenant, lod=False):
    """Turn the scene (in memory only, never saved) into what the web viewer wants: static architecture merged per
    lightmap atlas and layer group, other static layers merged per layer, furniture kept one node per block (the Node
    post-step turns repeated meshes into EXT_mesh_gpu_instancing), heavy furniture meshes decimated."""
    sc = bpy.context.scene; stats = {}
    objs = [o for o in sc.objects if o.type == "MESH" and o.get("twin_layer") and o.get("twin_layer") not in LIGHT_RIG]
    for o in [o for o in sc.objects if o.type in ("LIGHT", "CAMERA") or (o.type == "MESH" and not o.get("twin_layer") and not o.get("collision"))]:
        bpy.data.objects.remove(o)
    # furniture: desk clutter variants collapse to one mesh, heavy meshes decimated, LOD = boxes
    canon = {}
    for o in objs:
        if o.get("twin_layer") not in FURN_LAYERS: continue
        k = o.data.get("proto_key", "")
        if k.startswith("('desk'"): kk = k.rsplit(",", 1)[0]; canon.setdefault(kk, o.data); o.data = canon[kk]
    done = {}; proxies = {}
    for o in objs:
        if o.get("twin_layer") not in FURN_LAYERS: continue
        me = o.data
        if me.name not in done:
            k = me.get("proto_key", "")
            if lod: done[me.name] = _box_mesh(me)
            elif (k.startswith("('fit', 'chair'") or k == "'chair_model'") and WEB.get("chair_ratio"): done[me.name] = _decimate(me, WEB["chair_ratio"])     # opt-in: the real chair, lighter
            elif k.startswith("('fit', 'chair'") or k == "'chair_model'": done[me.name] = _fit_to(proxies.setdefault("chair", _web_chair()), me)
            elif k.startswith("('fit', 'lounge'") or k == "'lounge_model'": done[me.name] = _fit_to(proxies.setdefault("lounge", _web_chair(True)), me)
            else: done[me.name] = _simplify(me)
        o.data = done[me.name]; o["twin_kind"] = o["twin_layer"]; o["twin_layer"] = "FURNITURE"
    lights_done = {}
    for o in objs:            # ceiling fixtures: one node each (instanced later), light geometry
        if o.get("twin_layer") in ("LIGHT", "HVAC") and o.name in bpy.data.objects:
            if o.data.name not in lights_done: lights_done[o.data.name] = _simplify(o.data)
            o.data = lights_done[o.data.name]
    if lod:
        for o in [o for o in objs if o.get("twin_layer") in ("LIGHT", "HVAC", "SERVICES", "BLIND")]: bpy.data.objects.remove(o)
        objs = [o for o in sc.objects if o.type == "MESH" and o.get("twin_layer")]
    # static architecture: merge per (lightmap atlas, layer group); unlit statics per layer
    groups = {}
    for o in objs:
        L_ = o.get("twin_layer")
        if L_ in ARCH_ORDER: groups.setdefault((o.get("lightmap", ""), "ARCH" if L_ != "FLOOR" else "FLOOR", L_ if not o.get("lightmap") else "lm"), []).append(o)
        elif L_ in ("GLASS", "BLIND", "RAILING", "DOOR", "SERVICES", "FEATURE", "LOGO", "CONTEXT"): groups.setdefault(("", L_, L_), []).append(o)
    n = 0
    for (lmf, grp, sub), os_ in groups.items():
        layer = os_[0].get("twin_layer") if sub != "lm" else ("FLOOR" if grp == "FLOOR" else "WALL")
        extra = {"lightmap": os_[0]["lightmap"], "lightMapIntensity": os_[0]["lightMapIntensity"], "lightmap_uv": 1} if lmf else {}
        if lmf and grp != "FLOOR": extra["contains"] = ",".join(sorted({o.get("twin_layer") for o in os_}))
        _join(os_, f"{tenant}_{layer}_{(lmf or sub).replace('.png', '')}_{n}", layer, extra); n += 1
    stats["merged_groups"] = n
    _web_materials([o for o in bpy.context.scene.objects if o.type == "MESH"])
    return stats

def export(tenant, L, S, out, A):
    import subprocess, shutil
    sc = bpy.context.scene; t0 = time.time(); src = bpy.data.filepath
    global WEB; WEB = S.get("web", {}) if isinstance(S, dict) else {}
    pj = os.path.join(out, f"{tenant}_placement.json")
    rep = json.load(open(pj)) if os.path.exists(pj) else {"ok": False, "summary": "no placement report"}
    if not rep.get("ok") and not A.allow_placement_issues:
        raise SystemExit(f"EXPORT REFUSED: placement check is not clean ({rep.get('summary')}). Fix the layout / style, or pass --allow-placement-issues for a test export.")
    if not rep.get("ok"): print("WARNING: exporting with placement issues (test only):", rep.get("summary"), flush=True)
    d = os.path.join(out, "export"); os.makedirs(d, exist_ok=True)
    ev = sc.get("twin_exposure_ev", 0.0); res = {}
    for lod in (False, True):
        if lod: bpy.ops.wm.open_mainfile(filepath=src); sc = bpy.context.scene
        col = collision(tenant, out) if not lod else None
        for im in bpy.data.images:
            if im.size[0] > 2048 or im.size[1] > 2048:
                k = 2048 / max(im.size); im.scale(int(im.size[0] * k), int(im.size[1] * k))
        stats = prep_web(tenant, lod)
        if col is not None: col["twin_layer"] = "COLLISION"
        for o in sc.objects: o.select_set(o.type == "MESH" and bool(o.get("twin_layer")))
        base = f"{tenant}_lod" if lod else tenant
        raw = os.path.join(d, f"{base}.raw.glb"); glb = os.path.join(d, f"{base}.glb")
        bpy.ops.export_scene.gltf(filepath=raw, export_format="GLB", use_selection=True, export_extras=True, export_cameras=False, export_lights=False,
                                  export_apply=True, export_texcoords=True, export_normals=True, export_yup=True,
                                  export_image_format="JPEG" if not lod else "NONE", export_jpeg_quality=85)
        mo = {"applied": False}
        try:
            r_ = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "meshopt_glb.mjs"), raw, glb, "--instance"], capture_output=True, text=True, timeout=900)
            if r_.returncode == 0: mo = dict(json.loads(r_.stdout.strip().splitlines()[-1]), applied=True)
            else: print("meshopt failed:", r_.stderr[-600:]); shutil.copy(raw, glb)
        except Exception as e: print("meshopt not run:", e); shutil.copy(raw, glb)
        res[base] = {"mb": round(os.path.getsize(glb) / 1e6, 2), "meshopt": mo, **stats}
        if not lod:
            lm = {o.name: {"lightmap": "lightmaps/" + o["lightmap"], "lightMapIntensity": o["lightMapIntensity"], "uv": 1} for o in sc.objects if o.get("lightmap")}
            colname = col.name
    man = {"tenant": tenant, "glb": f"{tenant}.glb", "lod_glb": f"{tenant}_lod.glb", "files": res,
           "frame": "the tenant's CAD plan frame, metres, glTF Y up: three (x, y, z) = plan (x east, height, -north). Not recentred, not rotated: apply the plate fit in the viewer.",
           "decoder": "GLTFLoader.setMeshoptDecoder(MeshoptDecoder); repeated furniture comes as EXT_mesh_gpu_instancing (InstancedMesh); extras.instance_names lists the CAD blocks in instance order",
           "camera": {"near": 0.1, "far": 2000, "note": "near >= 0.1 m keeps depth precision for the floor-level layers (finishes 3-4 mm apart)"},
           "renderer": {"toneMapping": "AgXToneMapping", "toneMappingExposure": round(2 ** ev, 4), "exposure_ev": ev, "outputColorSpace": "srgb", "useLegacyLights": False},
           "lightmapped_meshes": {"how": "texture = load(lightmap); texture.colorSpace = SRGBColorSpace; texture.flipY = false; texture.channel = 1; material.lightMap = texture; "
                                         "material.lightMapIntensity = lightMapIntensity (below, per node); material.envMapIntensity = 0; no direct lights on these meshes "
                                         "(the lightmap already holds sun, sky, lamps and bounce). If it looks blown, check lightMap.colorSpace is sRGB and that the "
                                         "environment / lights are not also lighting these meshes.",
                                  "nodes": lm},
           "other_meshes": {"environment": "RoomEnvironment through PMREMGenerator, scene.environmentIntensity = 0.6, no punctual lights; emissive materials as exported"},
           "glass": {"facade_glass": "replace with the viewer's tuned transparent glass", "partition_glass": "clear partition", "partition_glass_frost": "frosted band"},
           "cameras": f"{tenant}_cameras.json", "collision_node": colname, "placement_ok": bool(rep.get("ok"))}
    if L.get("frame"):          # a layout already in a shared site frame (RTP: rtp_local): say so, and give the plan's site fit
        fr = L["frame"]; st = L.get("storeys", {})
        man["frame"] = (f"{fr.get('name', 'site')} frame, metres, glTF Y up: three (x, y, z) = (x east, height above this floor's finished floor level, -north). "
                        f"Already north up and placed: no turn, no shift. Put the model at y = {st.get('ffl_m')} m (finished floor level above ground).")
        man["site_fit"] = L.get("site_fit"); man["cad_m_to_site"] = fr.get("cad_m_to_rtp_local"); man["frame_about"] = fr
        man["ffl_m"] = st.get("ffl_m"); man["floor_to_floor_m"] = st.get("floor_to_floor"); man["level"] = st.get("level")
        man["placement"] = {k: rep.get("summary", {}).get(k) for k in ("overlaps", "floating_or_sunk", "narrow_routes")}
    json.dump(man, open(os.path.join(d, f"{tenant}_viewer.json"), "w"), indent=1)
    print(f"export: {res} ({time.time() - t0:.0f} s)", flush=True)
    publish(tenant, out, d)

def publish(tenant, out, d):
    """Copy the deliverables to noida-skymark/twin/web/models/<tenant>/ and add this tenant to models/index.json."""
    import shutil
    web = os.environ.get("TWIN_WEB_MODELS") or os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "models")); dst = os.path.join(web, tenant)
    os.makedirs(os.path.join(dst, "lightmaps"), exist_ok=True)
    for f in (f"{tenant}.glb", f"{tenant}_lod.glb", f"{tenant}_viewer.json"): shutil.copy(os.path.join(d, f), os.path.join(dst, f))
    for f in os.listdir(os.path.join(d, "lightmaps")):
        if f.endswith(".png"): shutil.copy(os.path.join(d, "lightmaps", f), os.path.join(dst, "lightmaps", f))
    cj = os.path.join(out, f"{tenant}_cameras.json")
    if os.path.exists(cj): shutil.copy(cj, os.path.join(dst, f"{tenant}_cameras.json"))
    idx = os.path.join(web, "index.json"); cur = {}
    try: cur = json.load(open(idx))
    except Exception: pass
    entry = {"viewer": f"{tenant}/{tenant}_viewer.json", "cameras": f"{tenant}/{tenant}_cameras.json"}
    if isinstance(cur.get("tenants"), dict): cur["tenants"][tenant] = entry          # the web worker's layout of the index
    else: cur[tenant] = entry
    json.dump(cur, open(idx, "w"), indent=1)
    print("published to", dst, flush=True)
