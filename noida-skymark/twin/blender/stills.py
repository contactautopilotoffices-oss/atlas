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
    for i, cam in enumerate(cams):
        png = os.path.join(d, cam.name + ".png")
        if os.path.exists(png): print("skip (exists):", png); continue
        done = [x for x in done if x["camera"] != cam.name]
        sc.camera = cam; tc = time.time(); bpy.ops.render.render()
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
        done.append({"camera": cam.name, "room": cam.get("room"), "kind": cam.get("kind"), "png": os.path.basename(png), "exr": os.path.basename(exr), "masks": masks, "stats": st, "seconds": dt})
        print(f"[{i + 1}/{len(cams)}] {cam.name}: {dt} s, masks {list(masks)}, {st}", flush=True)
        rv = os.path.join(out, "review"); os.makedirs(rv, exist_ok=True)
        import shutil; shutil.copy(png, os.path.join(rv, "still_" + os.path.basename(png)))
        json.dump({"samples": A.stills_samples, "res": [w, h], "exposure_ev": sc.get("twin_exposure_ev"), "stills": done}, open(os.path.join(d, "stills.json"), "w"), indent=1)
    print(f"stills: {len(done)} in {time.time() - t0:.0f} s", flush=True)
