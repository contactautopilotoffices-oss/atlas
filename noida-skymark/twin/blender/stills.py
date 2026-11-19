"""Stills from the named cameras: Cycles, denoised, 1920x1080 by default, plus true per-part masks.

For each camera: <out>/stills/<camera>.png (AgX, the grey-card exposure) and <camera>.exr (multilayer, scene-linear,
with Cryptomatte object + material layers and the object / material index passes). From the Cryptomatte material
layers, one anti-aliased mask per configurator part (style "parts": part -> material names, wildcards allowed) is
written as <out>/stills/<camera>_mask_<part>.png. A material option is then a real per-part render: re-render with the
part's material changed, or composite with the mask.
"""
import bpy, json, math, os, re, sys, time, fnmatch, struct
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL

def crypto_masks(exr, parts, prefix):
    """Anti-aliased part masks from the Cryptomatte material layers (each rank pair = id, coverage). Blender 5 writes
    every pass as its own EXR part (sub-image) with lower-case rgba channels; the manifest (name -> hash) is in the header."""
    import OpenImageIO as oiio
    inp = oiio.ImageInput.open(exr); spec = inp.spec(); man = None
    for a in spec.extra_attribs:
        if a.name.startswith("cryptomatte/") and a.name.endswith("/name") and "CryptoMaterial" in str(a.value):
            man = json.loads(spec.getattribute(a.name.replace("/name", "/manifest")))
    layers = []; n = 0
    while inp.seek_subimage(n, 0):
        names = list(inp.spec().channelnames)
        if any("CryptoMaterial" in c for c in names): layers.append(np.asarray(inp.read_image(n, 0, 0, len(names), oiio.FLOAT)).reshape(inp.spec().height, inp.spec().width, len(names)))
        n += 1
    inp.close()
    if man is None or not layers: return {}
    def f32(h): return struct.unpack("<f", struct.pack("<I", int(h, 16)))[0]
    out = {}
    for part, pats in parts.items():
        ids = np.array([f32(h) for nm, h in man.items() if any(fnmatch.fnmatch(nm, p) for p in pats)], np.float32)
        if not len(ids): continue
        m = np.zeros(layers[0].shape[:2], np.float32)
        for px in layers:
            m += np.isin(px[..., 0], ids) * px[..., 1] + np.isin(px[..., 2], ids) * px[..., 3]
        p = f"{prefix}_mask_{part}.png"; TL.write_png(p, np.repeat(np.clip(m, 0, 1)[..., None], 3, 2)); out[part] = {"file": os.path.basename(p), "coverage": round(float(m.mean()), 4)}
    return out

def run(tenant, L, S, out, A):
    sc = bpy.context.scene; vl = sc.view_layers[0]; t0 = time.time()
    TL.setup_cycles(sc, A.stills_samples, A.device, denoise=True); TL.colour_management(sc, sc.get("twin_exposure_ev", 0.0))
    w, h = (int(v) for v in A.stills_res.split("x")); sc.render.resolution_x, sc.render.resolution_y = w, h; sc.render.resolution_percentage = 100
    vl.use_pass_cryptomatte_material = True; vl.use_pass_cryptomatte_object = True; vl.pass_cryptomatte_depth = 4
    vl.use_pass_object_index = True; vl.use_pass_material_index = True
    kinds = set(A.stills_kinds.split(","))
    if getattr(A, "cameras_from", "") and not any(o.get("twin_layer") == "CAMERA" for o in sc.objects):
        from mathutils import Vector
        for c in json.load(open(A.cameras_from))["cameras"]:     # the main set's cameras, so an option render matches exactly
            cam = bpy.data.objects.new(c["name"], bpy.data.cameras.new(c["name"])); sc.collection.objects.link(cam)
            cam["twin_layer"] = "CAMERA"; cam["room"] = c["room"]; cam["kind"] = c["kind"]
            p_, t_ = Vector(c["position"]), Vector(c["target"]); TL.set_cam(cam, tuple(p_), math.atan2(t_.y - p_.y, t_.x - p_.x), c["pitch_deg"], c["hfov_deg"])
            cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 8.0; cam.data.dof.focus_distance = max(1.5, min(6.0, (t_ - p_).length))
    cams = [o for o in sc.objects if o.get("twin_layer") == "CAMERA" and o.get("kind") in kinds and (not A.rooms or re.search(A.rooms, o.get("room", ""), re.I))
            and (not getattr(A, "camera_names", "") or re.search(A.camera_names, o.name))]
    cams.sort(key=lambda o: o.name)
    if A.stills_max: cams = cams[:A.stills_max]
    d = os.path.join(out, "stills"); os.makedirs(d, exist_ok=True); done = []
    prev = os.path.join(d, "stills.json")
    if os.path.exists(prev):
        try: done = [x for x in json.load(open(prev))["stills"] if os.path.exists(os.path.join(d, x["png"]))]
        except Exception: done = []
    if getattr(A, "stills_context", ""):
        # opt-in: the exterior worker's real Airoli (ground, roads, buildings, trees) seen through the windows, for stills only.
        # The plain context blocks are hidden; the exterior is in rtp_local with z from the ground, so it drops by this floor's FFL.
        st_ = L.get("storeys", {}); ffl = st_.get("ffl_m", 0.0) or 0.0
        pat = getattr(A, "stills_context_collections", "") or r"^ctx_|^terrain$"
        with bpy.data.libraries.load(A.stills_context, link=True) as (src, dst):
            dst.collections = [c for c in src.collections if re.search(pat, c)]
        nlink = 0
        for c in dst.collections:
            if c is None or any(p_.name in ("ctx_props",) for p_ in []): continue
            e = bpy.data.objects.new("ctx_" + c.name, None); e.instance_type = "COLLECTION"; e.instance_collection = c
            e.location = (0, 0, -ffl); sc.collection.objects.link(e); nlink += 1
        for o in sc.objects:
            if o.get("twin_layer") == "CONTEXT": o.hide_render = True
        print(f"stills: linked {nlink} exterior collections from {os.path.basename(A.stills_context)} at z -{ffl} m; plain context hidden", flush=True)
    base_ev = sc.get("twin_exposure_ev", 0.0)
    def meter(cam):
        """Exposure for this view: a 192x108 pre-render, median of the frame without the windows (anything above 4x the
        median), set so that median reads A.stills_meter_target, within +-A.stills_meter_range EV of the floor's grey card."""
        import OpenImageIO as oiio
        keep = (sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples, sc.cycles.use_denoising)
        sc.render.resolution_x, sc.render.resolution_y = 192, 108; sc.cycles.samples = 24; sc.cycles.use_denoising = True
        TL.colour_management(sc, 0.0); sc.camera = cam; bpy.ops.render.render()
        ims = sc.render.image_settings; fmt = (ims.file_format, ims.color_depth)
        ims.file_format = "OPEN_EXR"; ims.color_depth = "32"; tmp = os.path.join(d, "_meter.exr"); bpy.data.images["Render Result"].save_render(tmp)
        ims.file_format, ims.color_depth = fmt
        sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples, sc.cycles.use_denoising = keep
        i_ = oiio.ImageInput.open(tmp); a = np.asarray(i_.read_image(format=oiio.FLOAT))[..., :3]; i_.close(); os.remove(tmp)
        lum = (a * [0.2126, 0.7152, 0.0722]).sum(-1).ravel(); med = float(np.median(lum)); lum = lum[lum < med * 4]
        med = max(float(np.median(lum)), 1e-6); ev = math.log2(A.stills_meter_target / med)
        # the 0 EV render here is scene-linear before the view transform's exposure; colour_management(ev) applies 2**ev
        return max(base_ev - A.stills_meter_range, min(base_ev + A.stills_meter_range, ev)), med
    for i, cam in enumerate(cams):
        png = os.path.join(d, cam.name + ".png")
        if os.path.exists(png): print("skip (exists):", png); continue
        done = [x for x in done if x["camera"] != cam.name]
        tc = time.time(); ev_used = base_ev
        if getattr(A, "stills_meter", False):
            ev_used, med = meter(cam); print(f"  {cam.name}: metered EV {ev_used:+.2f} (floor grey card {base_ev:+.2f}, frame median {med:.4f})", flush=True)
        TL.colour_management(sc, ev_used); sc.camera = cam; bpy.ops.render.render()
        rr = bpy.data.images["Render Result"]
        ims = sc.render.image_settings
        try: ims.media_type = "IMAGE"
        except Exception: pass
        ims.file_format = "PNG"; ims.color_depth = "8"; rr.save_render(png)
        exr = os.path.join(d, cam.name + ".exr")
        try: ims.media_type = "MULTI_LAYER_IMAGE"; ims.file_format = "OPEN_EXR"          # Blender 5.x
        except Exception: ims.file_format = "OPEN_EXR_MULTILAYER"                       # Blender 4.x
        ims.color_depth = "32"; rr.save_render(exr)
        try: ims.media_type = "IMAGE"
        except Exception: pass
        masks = {}
        try: masks = crypto_masks(exr, S.get("parts", {}), os.path.join(d, cam.name))
        except Exception as e: print("masks failed:", e)
        st = TL.exposure_stats(TL.read_png(png)); dt = round(time.time() - tc, 1)
        done.append({"camera": cam.name, "room": cam.get("room"), "kind": cam.get("kind"), "png": os.path.basename(png), "exposure_ev": round(ev_used, 3), "exr": os.path.basename(exr), "masks": masks, "stats": st, "seconds": dt})
        print(f"[{i + 1}/{len(cams)}] {cam.name}: {dt} s, masks {list(masks)}, {st}", flush=True)
        rv = os.path.join(out, "review"); os.makedirs(rv, exist_ok=True)
        import shutil; shutil.copy(png, os.path.join(rv, "still_" + os.path.basename(png)))
        json.dump({"samples": A.stills_samples, "res": [w, h], "exposure_ev": sc.get("twin_exposure_ev"), "stills": done}, open(os.path.join(d, "stills.json"), "w"), indent=1)
    print(f"stills: {len(done)} in {time.time() - t0:.0f} s", flush=True)
