"""Light states, hero cameras, stills and equirectangular environment maps for the RTP exterior.
usage: Blender -b _build/rtp_exterior.blend --python render_exterior.py -- --mode preview|stills|env [--states morning,golden,night]
       [--cams court,road,orbit] [--samples 128] [--res 1920x1080] [--engine CYCLES|BLENDER_EEVEE]
Cycles runs MUST be wrapped in the shared render lock (tools/locked.sh)."""
import bpy, math, os, sys, json, time, argparse
import numpy as np
from mathutils import Vector, Matrix, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exlib as X

ap = argparse.ArgumentParser(); argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap.add_argument("--mode", default="preview"); ap.add_argument("--states", default="morning,golden,night"); ap.add_argument("--cams", default="court,road,orbit")
ap.add_argument("--samples", type=int, default=128); ap.add_argument("--res", default="1920x1080"); ap.add_argument("--engine", default="CYCLES")
ap.add_argument("--out", default=os.path.join(X.EXT, "stills")); ap.add_argument("--haze", type=float, default=1.0); ap.add_argument("--tag", default=""); ap.add_argument("--sun-lamp", dest="sun_lamp", type=int, default=1)
A = ap.parse_args(argv)
sc = bpy.context.scene; META = json.loads(sc["prep"]); STATES = META["states"]
os.makedirs(A.out, exist_ok=True)
RW, RH = [int(v) for v in A.res.split("x")]

def device():
    sc.render.engine = "CYCLES"
    try:
        pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = "METAL"; pr.get_devices()
        for d in pr.devices: d.use = True
        sc.cycles.device = "GPU"
    except Exception as e: print("GPU setup:", e)

# ---------------------------------------------------------------- world + sun per state
def world(state):
    s = STATES[state]; el, az = s["elevation_deg"], s["azimuth_deg"]
    w = bpy.data.worlds.get("W") or bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True; nt = w.node_tree; N = nt.nodes; L = nt.links
    for n in list(N): N.remove(n)
    out = N.new("ShaderNodeOutputWorld")
    if state in ("night",):
        tc = N.new("ShaderNodeTexCoord"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(tc.outputs["Generated"], sep.inputs[0])
        # gradient on the view direction z: dark navy zenith, warm sodium city glow at the horizon
        geo = N.new("ShaderNodeNewGeometry"); sep2 = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Incoming"], sep2.inputs[0])
        neg = N.new("ShaderNodeMath"); neg.operation = "MULTIPLY"; neg.inputs[1].default_value = -1.0; L.new(sep2.outputs["Z"], neg.inputs[0])
        ramp = N.new("ShaderNodeValToRGB"); L.new(neg.outputs[0], ramp.inputs[0])
        cr = ramp.color_ramp; cr.elements[0].position = 0.0; cr.elements[0].color = (0.055, 0.032, 0.020, 1); cr.elements[1].position = 0.35; cr.elements[1].color = (0.006, 0.009, 0.022, 1)
        e = cr.elements.new(0.08); e.color = (0.030, 0.022, 0.030, 1)
        bg = N.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = 1.0; L.new(ramp.outputs["Color"], bg.inputs["Color"])
        L.new(bg.outputs[0], out.inputs["Surface"])
        sun_strength = 0.0
    else:
        sky = N.new("ShaderNodeTexSky"); sky.sky_type = "MULTIPLE_SCATTERING"
        sky.sun_elevation = math.radians(max(el, -2.0)); sky.sun_rotation = math.radians(az)    # measured: Blender sun_rotation = azimuth clockwise from north
        try:
            sky.sun_disc = True; sky.altitude = 15.0; sky.air_density = 1.0; sky.aerosol_density = 2.6 if state != "golden" else 3.2; sky.ozone_density = 1.0
        except Exception as ex: print("sky param:", ex)
        bg = N.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = 1.0; L.new(sky.outputs["Color"], bg.inputs["Color"])
        L.new(bg.outputs[0], out.inputs["Surface"])
    # aerial perspective: homogeneous haze in the world volume
    dens = {"morning": 0.00020, "midday": 0.00016, "golden": 0.00045, "blue_hour": 0.00035, "night": 0.00030}[state] * A.haze
    haze_box(state, dens)
    # remove any previous lights of the rig
    for o in [o for o in bpy.data.objects if o.get("rig")]: bpy.data.objects.remove(o)
    X.emission_scale(state)
    if state == "night": night_lights()
    elif A.sun_lamp: calib_sun(state, sky)
    return w

def haze_box(state, dens):
    """Aerial perspective: a homogeneous scattering volume in a 7 x 7 km box, 160 m tall (a world volume would swallow the sky in Cycles)."""
    o = bpy.data.objects.get("HAZE")
    if o is None:
        me = bpy.data.meshes.new("HAZE"); R_ = 3500.0; z0, z1 = -60.0, 160.0     # low lid: sky rays cross little haze (no denoiser blotches), horizontal views still get full aerial perspective
        v = [(x, y, z) for z in (z0, z1) for y in (-R_, R_) for x in (-R_, R_)]
        f = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        me.from_pydata(v, [], f); o = bpy.data.objects.new("HAZE", me); sc.collection.objects.link(o)
        m = bpy.data.materials.new("haze"); m.use_nodes = True; nt = m.node_tree
        for n in list(nt.nodes): nt.nodes.remove(n)
        out = nt.nodes.new("ShaderNodeOutputMaterial"); vs = nt.nodes.new("ShaderNodeVolumeScatter"); vs.name = "VS"; nt.links.new(vs.outputs[0], out.inputs["Volume"])
        me.materials.append(m)
        try: o.visible_shadow = True
        except Exception: pass
    vs = o.data.materials[0].node_tree.nodes["VS"]; vs.inputs["Density"].default_value = dens; vs.inputs["Anisotropy"].default_value = 0.6
    vs.inputs["Color"].default_value = {"golden": (1.0, 0.86, 0.70, 1), "night": (0.8, 0.66, 0.58, 1)}.get(state, (0.93, 0.95, 1.0, 1))

SUNCAL = {}
def calib_sun(state, sky):
    """Measure the sky texture's own sun (disc + aureole) on a 1024 px sky-only equirect, then switch the disc off and
    put the same irradiance and colour into a SUN lamp: identical light, but importance-sampled (clean haze, clean shadows)."""
    import OpenImageIO as oiio
    if state not in SUNCAL:
        keep = (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples, sc.render.image_settings.file_format, sc.render.use_compositing)
        hid = [o for o in sc.objects if not o.hide_render and o.type in ("MESH", "LIGHT")]
        for o in hid: o.hide_render = True
        cd = bpy.data.cameras.get("CALCAM") or bpy.data.cameras.new("CALCAM"); cd.type = "PANO"
        try: cd.panorama_type = "EQUIRECTANGULAR"
        except Exception: cd.cycles.panorama_type = "EQUIRECTANGULAR"
        co = bpy.data.objects.get("CALCAM") or bpy.data.objects.new("CALCAM", cd)
        if co.name not in sc.collection.objects: sc.collection.objects.link(co)
        co.location = (0, 0, 12); co.rotation_euler = (math.radians(90), 0, 0); sc.camera = co
        sc.render.resolution_x, sc.render.resolution_y = 2048, 1024; sc.cycles.samples = 4; sc.render.image_settings.file_format = "OPEN_EXR"
        fn = os.path.join(X.BUILD, f"_sky_{state}.exr"); sc.render.filepath = fn; bpy.ops.render.render(write_still=True)
        i = oiio.ImageInput.open(fn); a = np.asarray(i.read_image(format=oiio.FLOAT))[..., :3]; i.close()
        H, W = a.shape[:2]; lat = (0.5 - (np.arange(H) + 0.5) / H) * math.pi; dw = (2 * math.pi / W) * (math.pi / H) * np.cos(lat)[:, None]
        l = a.mean(2); thr = max(50.0, float(np.percentile(l, 99.9)) * 0.5); m = l > thr
        E = (a * dw[..., None] * m[..., None]).sum((0, 1))
        for o in hid: o.hide_render = False
        (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples, sc.render.image_settings.file_format, sc.render.use_compositing) = keep
        lum = float(0.2126 * E[0] + 0.7152 * E[1] + 0.0722 * E[2]); SUNCAL[state] = (lum, [float(c) / max(lum, 1e-6) for c in E], int(m.sum()))
        print("sun calibration", state, SUNCAL[state], flush=True)
    lum, colr, npx = SUNCAL[state]
    sky.sun_disc = False
    s = STATES[state]; d = Vector(s["dir_to_sun_rtp_local"])
    ld = bpy.data.lights.new("sun", "SUN"); ld.energy = lum; ld.color = tuple(min(1.0, c / max(colr)) for c in colr); ld.energy = lum * max(colr); ld.angle = math.radians(0.55)
    o = bpy.data.objects.new("sun", ld); sc.collection.objects.link(o); o["rig"] = 1; o.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()

def night_lights():
    """Pink / violet facade uplights at the RTP base, warm spill from street lamps, sign glow."""
    col = X.coll("rig_lights")
    R_ = json.load(open(os.path.join(X.BUILD, "prep", "prep.json")))["rtp"]
    ring = R_["slab_outline"][0]; pts = [tuple(p) for p in ring] + [tuple(ring[0])]
    acc = 0.0; k = 0
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]; L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0)
        s = 0.0
        while acc + (L - s) >= 9.0:
            s += 9.0 - acc; acc = 0.0
            x, y = x0 + (x1 - x0) * s / L, y0 + (y1 - y0) * s / L; nx, ny = math.sin(a), -math.cos(a)
            ld = bpy.data.lights.new(f"up{k}", "SPOT"); ld.energy = 30000; ld.spot_size = math.radians(30); ld.spot_blend = 0.6; ld.shadow_soft_size = 0.1
            ld.color = (1.0, 0.12, 0.62) if k % 2 == 0 else (0.50, 0.16, 1.0)
            o = bpy.data.objects.new(f"uplight{k}", ld); o.location = (x + nx * 1.6, y + ny * 1.6, 0.3)
            o.rotation_euler = Euler((math.radians(-14) * 0, 0, 0)); d = Vector((-nx * 0.06, -ny * 0.06, 1.0)).normalized()
            o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); col.objects.link(o); o["rig"] = 1; k += 1
        acc += L - s
    # street lamps: a spot under each lamp head (sodium on main roads, LED on campus)
    for o in [o for o in bpy.data.objects if o.get("prop") in ("lamp", "lamp_double")]:
        for side in ((1,) if o["prop"] == "lamp" else (1, -1)):
            ld = bpy.data.lights.new("sl", "SPOT"); ld.energy = 900; ld.spot_size = math.radians(115); ld.spot_blend = 0.8; ld.color = (1.0, 0.72, 0.42); ld.shadow_soft_size = 0.25
            lo = bpy.data.objects.new("streetlight", ld)
            lo.location = o.matrix_world @ Vector((side * 1.55, 0, 8.75)); lo.rotation_euler = (0, 0, 0); col.objects.link(lo); lo["rig"] = 1
    # sign wash and dome wash
    for d in R_["drums"]:
        ld = bpy.data.lights.new("dome", "POINT"); ld.energy = 6000 if d.get("dome") else 2500; ld.color = (0.85, 0.45, 1.0) if d.get("dome") else (1.0, 0.2, 0.3)
        lo = bpy.data.objects.new("drumwash", ld); lo.location = (d["c"][0], d["c"][1], d["z0"] - 0.0 + 0.5); col.objects.link(lo); lo["rig"] = 1
    # moon fill (cool, very weak)
    ld = bpy.data.lights.new("moon", "SUN"); ld.energy = 0.025; ld.color = (0.6, 0.7, 1.0); ld.angle = math.radians(0.5)
    lo = bpy.data.objects.new("moon", ld); lo.rotation_euler = Euler((math.radians(50), 0, math.radians(120))); col.objects.link(lo); lo["rig"] = 1

# ---------------------------------------------------------------- cameras
def look(cam, pos, tgt):
    cam.location = pos; d = Vector(tgt) - Vector(pos); cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

def visible_score(pos, tgt_pts):
    dg = bpy.context.evaluated_depsgraph_get(); hits = 0
    for t in tgt_pts:
        d = Vector(t) - Vector(pos); L = d.length
        ok, loc, nrm, idx, ob, mt = sc.ray_cast(dg, Vector(pos), d.normalized(), distance=L)
        if ok and ob is not None and (ob.get("floor") or ob.name.startswith("rtp_")) and (loc - Vector(t)).length < 25: hits += 1
        elif not ok: hits += 1
    return hits / max(1, len(tgt_pts))

def cameras():
    cams = {}
    def mk(name, pos, tgt, lens, shift_y=0.0):
        cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = 36; cd.clip_start = 0.3; cd.clip_end = 8000; cd.shift_y = shift_y
        o = bpy.data.objects.get(name) or bpy.data.objects.new(name, cd)
        if o.name not in sc.collection.objects: sc.collection.objects.link(o)
        look(o, pos, tgt); o["target"] = list(tgt); cams[name.replace("CAM_", "")] = o; return o
    cx, cy = META["rtp"]["inner_corner"]
    mk("CAM_court", (cx - 52.0, cy - 50.0, 1.65), (cx - 2.0, cy - 2.0, 15.0), 20.0, 0.12)
    # road view: pick the Thane-Belapur Road position with the clearest sightline to the facade (ray-cast gated)
    tg = [(x, y, z) for x in (16.0, 30.0, 46.0) for y in (0.0, 30.0, 60.0, 90.0) for z in (8.0, 20.0, 32.0)] + [(x, 100.0, z) for x in (-50.0, -25.0, 0.0) for z in (8.0, 20.0, 32.0)]
    best = None; dg = bpy.context.evaluated_depsgraph_get()
    for y in np.arange(-300, 420, 12.0):
        for x in np.arange(-300.0, -240.0, 3.0):
            ok, loc, nrm, idx, ob, mt = sc.ray_cast(dg, Vector((x, y, 30.0)), Vector((0, 0, -1)))
            if not ok or ob is None or ob.name != "ctx_road_asphalt": continue
            for z in (1.7, 4.2):
                pos = (float(x), float(y), z); s_ = visible_score(pos, tg) - (0.04 if z > 2 else 0.0)
                if best is None or s_ > best[0]: best = (s_, pos)
    print("road camera", best, flush=True)
    rp = best[1]; mk("CAM_road", rp, (10.0, 55.0, 18.0), 50.0, 0.08); cams["road"]["sightline"] = best[0]
    mk("CAM_orbit", (-235.0, -205.0, 150.0), (8.0, 52.0, 14.0), 40.0)
    mk("CAM_env", (cx - 30.0, cy - 45.0, 12.0), (cx - 30.0, cy - 44.0, 12.0), 30.0)
    return cams

def exposure_for(state):
    return {"morning": -0.2, "midday": -0.5, "golden": 0.6, "blue_hour": 1.8, "night": 1.2}[state]

def setup(state, samples, engine):
    if engine == "CYCLES":
        device(); sc.cycles.samples = samples; sc.cycles.use_denoising = True
        try: sc.cycles.denoiser = "OPENIMAGEDENOISE"; sc.cycles.denoising_use_gpu = True
        except Exception: pass
        sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.008
        sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 16; sc.cycles.volume_bounces = 0; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
        sc.cycles.blur_glossy = 1.0; sc.cycles.sample_clamp_indirect = 8.0
        try: sc.cycles.volume_step_rate = 4.0
        except Exception: pass
    else:
        sc.render.engine = engine
    sc.render.resolution_x, sc.render.resolution_y = RW, RH; sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "AgX"
    try: sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception: pass
    sc.view_settings.exposure = exposure_for(state)
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_depth = "8"
    world(state)

EV = {}
def auto_exposure(state, cam):
    """Grey-card style exposure: a 320 px, 16-sample probe from the court camera in linear EXR; EV puts the median scene
    luminance at 0.18 (day) or the 80th percentile at 0.12 (night). Cached per state."""
    if state in EV: return EV[state]
    import OpenImageIO as oiio
    keep = (sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples, sc.camera, sc.render.image_settings.file_format, sc.view_settings.view_transform, sc.view_settings.look, sc.view_settings.exposure)
    sc.render.resolution_x, sc.render.resolution_y = 320, 180; sc.cycles.samples = 16; sc.camera = cam
    sc.render.image_settings.file_format = "OPEN_EXR"; sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"; sc.view_settings.exposure = 0
    fn = os.path.join(X.BUILD, f"_probe_{state}.exr"); sc.render.filepath = fn; bpy.ops.render.render(write_still=True)
    i = oiio.ImageInput.open(fn); a = np.asarray(i.read_image(format=oiio.FLOAT)); i.close()
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    if state in ("night", "blue_hour"): ref = float(np.percentile(lum, 80)); ev = math.log2(0.12 / max(ref, 1e-6))
    else: ref = float(np.median(lum)); ev = math.log2(0.18 / max(ref, 1e-6)) + (0.35 if state == "golden" else 0.0)
    (sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples, sc.camera, sc.render.image_settings.file_format, sc.view_settings.view_transform, sc.view_settings.look, sc.view_settings.exposure) = keep
    EV[state] = round(ev, 2); print("auto exposure", state, "ref", ref, "EV", EV[state], flush=True); return EV[state]

def score(path):
    import OpenImageIO as oiio
    i = oiio.ImageInput.open(path); a = np.asarray(i.read_image(format=oiio.FLOAT)); i.close()
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    return {"blown_frac": round(float((lum >= 0.98).mean()), 4), "crushed_frac": round(float((lum <= 0.03).mean()), 4), "median": round(float(np.median(lum)), 3)}

def stills():
    cams = cameras(); res = {}
    log = os.path.join(A.out, "stills_log.json"); prev = json.load(open(log)) if os.path.exists(log) else {}
    for st in A.states.split(","):
        setup(st, A.samples, A.engine)
        if A.engine == "CYCLES": sc.view_settings.exposure = auto_exposure(st, cams["court"])
        for cn in A.cams.split(","):
            sc.camera = cams[cn]; t0 = time.time()
            fn = os.path.join(A.out, f"rtp_{st}_{cn}{A.tag}.png"); sc.render.filepath = fn
            bpy.ops.render.render(write_still=True)
            sco = score(fn); sec = round(time.time() - t0, 1)
            res[f"{st}_{cn}"] = {"file": os.path.relpath(fn, X.EXT), "seconds": sec, "samples": A.samples, "engine": A.engine, "exposure_ev": sc.view_settings.exposure, **sco,
                                 "camera": {"position": list(cams[cn].location), "target": list(cams[cn]["target"]), "lens_mm": cams[cn].data.lens, "shift_y": cams[cn].data.shift_y}}
            print("still", st, cn, sec, "s", sco, flush=True)
            prev.update(res); json.dump(prev, open(log, "w"), indent=1)
    return res

def env():
    cams = cameras(); res = {}
    cam = cams["env"]; cam.data.type = "PANO"
    try: cam.data.panorama_type = "EQUIRECTANGULAR"
    except Exception: cam.data.cycles.panorama_type = "EQUIRECTANGULAR"
    cam.rotation_euler = (math.radians(90), 0, math.radians(-90))     # look +y... equirect centre faces north
    sc.camera = cam
    for st in A.states.split(","):
        setup(st, A.samples, "CYCLES"); sc.render.resolution_x, sc.render.resolution_y = RW, RH
        sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"; sc.view_settings.exposure = 0.0
        nm = "night" if st in ("night", "blue_hour") else "day"
        for o in [o for o in bpy.data.objects if o.name == "HAZE"]: o.hide_render = True        # env map: no haze box (the viewer adds fog)
        sc.render.image_settings.file_format = "HDR"; fn = os.path.join(A.out, f"rtp_env_{nm}.hdr"); sc.render.filepath = fn; t0 = time.time()
        bpy.ops.render.render(write_still=True)
        res[nm] = {"file": os.path.basename(fn), "state": st, "seconds": round(time.time() - t0, 1), "samples": A.samples, "size": [RW, RH], "position_rtp_local": list(cam.location),
                   "position_three": [round(cam.location.x, 2), round(cam.location.z, 2), round(-cam.location.y, 2)],
                   "mapping": "equirectangular, linear Radiance HDR; image centre = east (+x rtp_local = +x three), right of centre = south: three.js EquirectangularReflectionMapping without rotation"}
        print("env", st, res[nm], flush=True)
    json.dump(res, open(os.path.join(A.out, f"env_log{A.tag}.json"), "w"), indent=1)

if A.mode == "preview":
    cams = cameras()
    for st in A.states.split(","):
        setup(st, A.samples, A.engine)
        if A.engine == "BLENDER_WORKBENCH":
            sh = sc.display.shading; sh.light = "STUDIO"; sh.color_type = "TEXTURE"; sh.show_shadows = True; sh.show_cavity = True
            sc.display.shading.cavity_type = "WORLD"; sc.view_settings.view_transform = "Standard"; sc.view_settings.exposure = 0
            try: sc.display.light_direction = (0.4, -0.5, 0.75)
            except Exception: pass
        if A.engine == "BLENDER_EEVEE":
            try: sc.eevee.taa_render_samples = A.samples
            except Exception: pass
        for cn in A.cams.split(","):
            sc.camera = cams[cn]; sc.render.filepath = os.path.join(A.out, f"prev_{st}_{cn}.png"); bpy.ops.render.render(write_still=True); print("preview", st, cn, flush=True)
elif A.mode == "stills": stills()
elif A.mode == "env": env()
