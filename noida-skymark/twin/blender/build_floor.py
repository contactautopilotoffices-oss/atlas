"""Tenant-generic, headless floor builder for the F1 Skymark twin.

    Blender -b --python build_floor.py -- --tenant volt --layout L.json --style styles/volt.json --out DIR --stage geometry

Stages (each saves a .blend that the next one opens, so they can run on different nights):
  geometry  shell, glass, doors, ceilings, fixtures, furniture from the CAD layout + finishes from style.json;
            snaps everything to the floor and runs placement_check.py        -> <tenant>_geometry.blend, <tenant>_placement.json
  light     sun + physical sky through the real facade windows (portals), lamps in every fixture, AgX, exposure measured
            on a grey card (logged, card removed), preview renders checked for blown / black pixels -> <tenant>_light.blend
  cameras   make_cameras.py: 3-4 named cameras per room, ray-cast checked; <tenant>_cameras.json + contact sheets
  stills    1920x1080 Cycles renders from the named cameras, denoised, + multilayer EXR with cryptomatte -> part masks
  bake      Cycles lightmaps (diffuse light, no colour) on a 2nd UV set for static surfaces, denoised
  export    GLB (instancing kept, textures <= 2K), lightmap PNGs + JSON, collision node. Refuses unless placement is clean
            (or --allow-placement-issues).
  all       geometry,light,cameras,bake,export (stills are the long one; ask for them explicitly)
--stage takes a comma list too. Every stage prints its time and appends it to <out>/<tenant>_timings.json.
"""
import bpy, json, math, os, sys, time, argparse, re, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from mathutils import Vector, Matrix
import twin_lib as TL
from twin_lib import Raster, Materials, Registry, MB, norm_layout, load_style, deep_merge, room_kind, Timer, setup_cycles, colour_management, light_col, lin, pip

ap = argparse.ArgumentParser()
ap.add_argument("--tenant", required=True); ap.add_argument("--layout", required=True); ap.add_argument("--style", required=True)
ap.add_argument("--out", required=True); ap.add_argument("--stage", default="geometry")
ap.add_argument("--option", action="append", default=[], help="style option, e.g. --option ceiling=black_open")
ap.add_argument("--device", default="gpu"); ap.add_argument("--tex-res", type=int, default=1024)
ap.add_argument("--preview-samples", type=int, default=32); ap.add_argument("--contact-samples", type=int, default=16)
ap.add_argument("--stills-samples", type=int, default=128); ap.add_argument("--stills-res", default="1920x1080")
ap.add_argument("--stills-max", type=int, default=0, help="at most this many stills (0 = every camera)")
ap.add_argument("--stills-kinds", default="entry,feature,reverse,detail"); ap.add_argument("--rooms", default="", help="regex: only rooms whose name matches (cameras, stills, bake)")
ap.add_argument("--bake-res", type=int, default=2048); ap.add_argument("--bake-samples", type=int, default=256); ap.add_argument("--bake-texel", type=float, default=0.025)
ap.add_argument("--allow-placement-issues", action="store_true"); ap.add_argument("--no-nudge", action="store_true")
ap.add_argument("--exposure-ev", type=float, default=None, help="light stage: use this exposure (and this daylight scale, see --daylight-scale) instead of measuring; for option renders that must match the main set")
ap.add_argument("--daylight-scale", type=float, default=None); ap.add_argument("--window-stops", type=float, default=3.0)
ap.add_argument("--cameras-from", default="", help="stills: make cameras from this <tenant>_cameras_plan.json when the scene has none")
ap.add_argument("--camera-names", default="", help="stills: regex on camera names")
A = ap.parse_args(TL.script_args())
OUT = os.path.abspath(A.out); os.makedirs(OUT, exist_ok=True)
TEN = A.tenant
STYLE = load_style(A.style)
for opt in A.option:
    g, ch = opt.split("=", 1); STYLE = deep_merge(STYLE, STYLE.get("options", {}).get(g, {}).get(ch, {})); STYLE.setdefault("_chosen", {})[g] = ch
for g, spec in STYLE.get("options", {}).items():      # an option group not chosen on the command line takes its default
    if g not in STYLE.get("_chosen", {}) and spec.get("_default"):
        STYLE = deep_merge(STYLE, spec.get(spec["_default"], {})); STYLE.setdefault("_chosen", {})[g] = spec["_default"]
LAYOUT = norm_layout(json.load(open(A.layout)))
TIMER = Timer(OUT, TEN)
def blend(stage): return os.path.join(OUT, f"{TEN}_{stage}.blend")


class Ctx:
    def __init__(self):
        self.tenant, self.L, self.S, self.out = TEN, LAYOUT, STYLE, OUT
        st = self.L["storeys"]; hs = STYLE.get("heights", {})
        self.H = hs.get("ceiling", self.L["heights"]["ceiling"])
        self.Hs = hs.get("soffit", st.get("floor_to_floor", 4.1) - hs.get("slab", 0.3))
        self.ras = Raster(self.L); self.meta = {"log": {}}; self._proto = {}
        self.capsule_rooms, self.extra_pendants = [], []; self.feature_wall_of = {}; self.used_walls = {}
    def log(self, k, v): self.meta["log"][k] = v
    def proto(self, key, fn):
        if key not in self._proto:
            m = fn()
            try: m["proto_key"] = repr(key)
            except Exception: pass
            self._proto[key] = m
        return self._proto[key]
    def ceiling_z(self, room):
        """What a pendant hangs from: the ceiling board, or the painted soffit (3 mm below the slab) for open / baffle ceilings."""
        c = self.shell.ceiling_of.get(room)
        if c and c["type"] in ("open", "baffle"): return self.Hs - 0.003
        return c["height"] if c else self.H
    def aisle_mask(self):
        """Floor cells further than `clear` m from any desk, table or seat (from the layout): the aisles."""
        clear = self.S.get("aisle", {}).get("clear", 0.9); ras = self.ras; occ = np.zeros(ras.label.shape, bool)
        def stamp(poly):
            xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
            j0, j1 = max(0, int((min(xs) - clear - ras.x0) / ras.res)), min(ras.nx, int((max(xs) + clear - ras.x0) / ras.res) + 1)
            i0, i1 = max(0, int((min(ys) - clear - ras.y0) / ras.res)), min(ras.ny, int((max(ys) + clear - ras.y0) / ras.res) + 1)
            if j1 > j0 and i1 > i0:
                X, Y = ras.X[i0:i1, j0:j1], ras.Y[i0:i1, j0:j1]; m = pip(X, Y, poly)
                d = np.full(X.shape, 9.0)
                for k in range(len(poly)):        # distance to the polygon edge
                    (ax, ay), (bx, by) = poly[k], poly[(k + 1) % len(poly)]; dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy + 1e-12
                    t = np.clip(((X - ax) * dx + (Y - ay) * dy) / l2, 0, 1); d = np.minimum(d, np.hypot(ax + t * dx - X, ay + t * dy - Y))
                occ[i0:i1, j0:j1] |= m | (d < clear)
        for d in self.L["desks"]:
            ca, sa = math.cos(d["a"]), math.sin(d["a"]); w, h = d["w"] / 2, d["d"] / 2; cx, cy = d["c"]
            stamp([(cx + ca * u - sa * v, cy + sa * u + ca * v) for u, v in ((-w, -h), (w, -h), (w, h), (-w, h))])
        for t in self.L["tables"]:
            if "poly" in t: stamp(t["poly"])
            else: x, y, r = t["circle"]; stamp([(x + r * math.cos(k * 0.785), y + r * math.sin(k * 0.785)) for k in range(8)])
        for s in self.L["seats"]: stamp([(s["x"] + 0.3 * math.cos(k * 0.785), s["y"] + 0.3 * math.sin(k * 0.785)) for k in range(8)])
        m = ~occ & ras.floor
        # keep only real aisles: an opening with a 1 m square (no slivers between chairs), then pieces over 6 m2
        k = int(round(self.S.get("aisle", {}).get("open_m", 1.0) / ras.res / 2))
        def shift_and(a, k):
            e = a.copy()
            for _ in range(k):
                f = e.copy(); f[1:, :] &= e[:-1, :]; f[:-1, :] &= e[1:, :]; f[:, 1:] &= e[:, :-1]; f[:, :-1] &= e[:, 1:]; f[0, :] = f[-1, :] = f[:, 0] = f[:, -1] = False; e = f
            return e
        def shift_or(a, k):
            e = a.copy()
            for _ in range(k):
                f = e.copy(); f[1:, :] |= e[:-1, :]; f[:-1, :] |= e[1:, :]; f[:, 1:] |= e[:, :-1]; f[:, :-1] |= e[:, 1:]; e = f
            return e
        m = shift_or(shift_and(m, k), k) & m
        lab = np.zeros(m.shape, np.int32); keep = np.zeros(m.shape, bool); nid = 0
        from collections import deque
        for (i0, j0) in np.argwhere(m):
            if lab[i0, j0]: continue
            nid += 1; q = deque([(i0, j0)]); lab[i0, j0] = nid; cells = []
            while q:
                i, j = q.popleft(); cells.append((i, j))
                for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                    if 0 <= a < m.shape[0] and 0 <= b < m.shape[1] and m[a, b] and not lab[a, b]: lab[a, b] = nid; q.append((a, b))
            if len(cells) * ras.res ** 2 >= self.S.get("aisle", {}).get("min_area_m2", 6.0):
                ii, jj = zip(*cells); keep[list(ii), list(jj)] = True
        return keep


# ================================================================== stage: geometry
def stage_geometry():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.unit_settings.system = "METRIC"
    c = Ctx(); c.reg = Registry(TEN); lt = STYLE.get("light", {})
    c.mats = Materials(STYLE, os.path.join(OUT, "tex"), lt.get("wb_k", 4150), A.tex_res)
    from geometry import Shell
    from furniture import Furnisher
    sh = Shell(c); c.shell = sh; fu = Furnisher(c); c.furn = fu
    t = time.time()
    def step(name, fn):
        t0 = time.time(); fn(); print(f"  {name}: {time.time() - t0:.1f} s", flush=True)
    step("slab and floor finishes", sh.slab_and_floors)
    step("glass runs", sh.glass_runs); step("walls", sh.walls); step("cad closures", sh.closures); step("enclosure", sh.enclosure); step("atrium", sh.atrium)
    step("glazing", sh.glazing); step("doors", sh.doors); step("ceilings", sh.ceilings)
    step("desks", fu.desks); step("tables", fu.tables); step("seats", fu.seats); step("plants", fu.plants)
    step("fixtures and stair", fu.fixtures); step("ceiling fixtures", fu.light_fixtures); step("bank lights", fu.bank_lights)
    bpy.context.view_layer.update()
    step("feature walls", fu.feature_walls); step("logo", fu.logo)
    step("context (ground, neighbours)", sh.context)
    bpy.context.view_layer.update(); step("snap", fu.snap)
    c.meta.update({"tenant": TEN, "H": c.H, "Hs": c.Hs, "portals": sh.portals, "ceilings": sh.ceiling_of, "lights": sh.lights,
                   "doors": [{"name": d.get("_leaf"), "opening": d.get("_opening")} for d in LAYOUT["doors"]],
                   "missing_materials": sorted(c.mats.missing), "style_options": STYLE.get("_chosen", {}),
                   "counts": {k: len(v.objects) for k, v in c.reg.cols.items()}})
    sc["twin_meta"] = json.dumps(c.meta)
    if c.mats.missing: print("WARNING: style has no definition for materials:", sorted(c.mats.missing), flush=True)
    print("objects per layer:", c.meta["counts"], flush=True)
    import placement_check
    rep = TIMER.run("placement_check", placement_check.run, TEN, LAYOUT, STYLE, OUT, not A.no_nudge, c.ras)
    sc["twin_placement_ok"] = bool(rep["ok"])
    bpy.ops.wm.save_as_mainfile(filepath=blend("geometry"))
    print("saved", blend("geometry"), flush=True)


# ================================================================== stage: light
def open_stage(*names):
    for n in names:
        if os.path.exists(blend(n)): bpy.ops.wm.open_mainfile(filepath=blend(n)); return n
    raise SystemExit(f"none of {names} built yet in {OUT}; run the earlier stage first")

def meta(): return json.loads(bpy.context.scene.get("twin_meta", "{}"))

def stage_light():
    open_stage("geometry"); sc = bpy.context.scene; M = meta(); lt = STYLE.get("light", {}); wb = lt.get("wb_k", 4150)
    for o in [o for o in sc.objects if o.get("twin_light_rig")]: bpy.data.objects.remove(o)
    rig = bpy.data.collections.get(f"{TEN}_LIGHTRIG") or bpy.data.collections.new(f"{TEN}_LIGHTRIG")
    if rig.name not in sc.collection.children: sc.collection.children.link(rig)
    def link(o): rig.objects.link(o); o["twin_light_rig"] = 1; return o
    # sun direction: compass bearing -> plan via the layout's site fit (plan north is not true north)
    sf = LAYOUT.get("site_fit") or {}; rho = math.radians(sf.get("rot_deg", 0.0))
    def bearing_to_plan(b):
        e, n = math.sin(math.radians(b)), math.cos(math.radians(b)); c_, s_ = math.cos(-rho), math.sin(-rho); return (c_ * e - s_ * n, s_ * e + c_ * n)
    sd = bearing_to_plan(lt.get("sun_az", 100)); el = math.radians(lt.get("sun_el", 26))
    W = bpy.data.worlds.get("World") or bpy.data.worlds.new("World"); sc.world = W; W.use_nodes = True; wn = W.node_tree; wn.nodes.clear()
    bg = wn.nodes.new("ShaderNodeBackground"); out = wn.nodes.new("ShaderNodeOutputWorld"); wn.links.new(bg.outputs[0], out.inputs[0])
    sky = wn.nodes.new("ShaderNodeTexSky"); sky.sky_type = "MULTIPLE_SCATTERING"
    for attr, val in (("sun_disc", False), ("sun_elevation", el), ("sun_rotation", math.atan2(sd[0], sd[1])), ("altitude", 200.0), ("aerosol_density", 2.0)):
        try: setattr(sky, attr, val)
        except Exception: pass
    wbk = TL.kelvin(wb); wbm = [1 + (wbk[1] / c - 1) * 0.6 for c in wbk]
    tint = wn.nodes.new("ShaderNodeVectorMath"); tint.operation = "MULTIPLY"; tint.inputs[1].default_value = wbm
    wn.links.new(sky.outputs[0], tint.inputs[0]); wn.links.new(tint.outputs[0], bg.inputs["Color"]); bg.inputs["Strength"].default_value = lt.get("sky", 0.35)
    sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = lt.get("sun", 22.0); sun.angle = math.radians(1.2); sun.color = light_col(5200, wb, 0.6)
    so = link(bpy.data.objects.new("Sun", sun)); to_sun = Vector((sd[0] * math.cos(el), sd[1] * math.cos(el), math.sin(el))); so.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()
    np_ = 0
    if lt.get("portals", True):
        for (cx, cy, ca, sa, ix, iy, ln, z0, z1) in M.get("portals", []):
            if (ca * iy - sa * ix) < 0: ca, sa = -ca, -sa
            pl = bpy.data.lights.new("Portal", "AREA"); pl.shape = "RECTANGLE"; pl.size = ln; pl.size_y = z1 - z0; pl.cycles.is_portal = True
            po = link(bpy.data.objects.new("Portal", pl)); np_ += 1
            po.matrix_world = Matrix(((ca, 0, -ix, cx - ix * 0.1), (sa, 0, -iy, cy - iy * 0.1), (0, 1, 0, (z0 + z1) / 2), (0, 0, 0, 1)))
    nl = 0; lamp_k = lt.get("lamp_k", 4000)
    for o in list(sc.objects):
        if o.get("twin_layer") == "LIGHT" and o.get("lamp") == "spot":
            ld = bpy.data.lights.new("Lamp", "SPOT"); ld.energy = lt.get("downlight_w", 22); ld.spot_size = math.radians(lt.get("spot_deg", 110)); ld.spot_blend = 0.6
            ld.shadow_soft_size = 0.04; ld.color = light_col(lamp_k, wb, 0.9)
            lo = link(bpy.data.objects.new(o.name + "_lamp", ld)); lo.parent = o; lo.matrix_parent_inverse = Matrix(); lo.location = (0, 0, o.get("lamp_z", -0.01) - 0.004); nl += 1
    dev = setup_cycles(sc, A.preview_samples, A.device); colour_management(sc, lt.get("exposure", 0.6))
    print(f"light rig: sun, sky, {np_} window portals, {nl} lamps; device {dev}", flush=True)
    if A.exposure_ev is not None:
        f = A.daylight_scale if A.daylight_scale is not None else 1.0
        sun.energy *= f; bg.inputs["Strength"].default_value *= f; ev = A.exposure_ev
        sc["twin_window"] = json.dumps({"daylight_scale": f, "given": True})
    else:
        ev = grey_card(sc, M, lt); card = json.loads(sc["twin_grey"])["median_card_linear"] if sc.get("twin_grey") else None
        # windows: at most --window-stops (3) above the interior grey card, else daylight is scaled down (like a tinted
        # low-E glass) and the card measured again
        win = window_luminance(sc, M); rec = {"window_linear": win, "card_linear": card, "daylight_scale": 1.0}
        if win and card:
            rec["stops_over_card"] = round(math.log2(win / card), 2)
            if win > card * 2 ** A.window_stops:
                f = (card * 2 ** A.window_stops) / win
                for _ in range(2):
                    sun.energy *= f; bg.inputs["Strength"].default_value *= f; rec["daylight_scale"] = round(rec["daylight_scale"] * f, 4)
                    ev = grey_card(sc, M, lt); card = json.loads(sc["twin_grey"])["median_card_linear"]; win = window_luminance(sc, M)
                    rec.update({"window_linear": win, "card_linear": card, "stops_over_card": round(math.log2(win / card), 2)})
                    if win <= card * 2 ** A.window_stops * 1.05: break
                    f = (card * 2 ** A.window_stops) / win
        rec["sun_w"] = round(sun.energy, 3); rec["sky_strength"] = round(bg.inputs["Strength"].default_value, 4)
        sc["twin_window"] = json.dumps(rec); print("windows vs grey card:", rec, flush=True)
        json.dump(rec, open(os.path.join(OUT, f"{TEN}_windows.json"), "w"), indent=1)
    sc["twin_exposure_ev"] = ev; colour_management(sc, ev)
    sc["twin_meta"] = json.dumps(dict(M, exposure=sc.get("twin_grey", {}) and json.loads(sc["twin_grey"])))
    previews(sc, M)
    bpy.ops.wm.save_as_mainfile(filepath=blend("light")); print("saved", blend("light"), flush=True)

def biggest_rooms(n=3, regex=None):
    ras = Raster(LAYOUT); cnt = [(int((ras.label == k).sum()), r) for k, r in enumerate(ras.rooms) if r["name"] != "Circulation" and r.get("box")]
    cnt.sort(key=lambda t: -t[0]); rooms = [r for _, r in cnt]
    if regex: rooms = [r for r in rooms if re.search(regex, r["name"], re.I)]
    return rooms[:n], ras

def grey_card(sc, M, lt):
    """Measure the light on a 18 % grey card (horizontal, at desk height) in the largest rooms; set the exposure so the
    card reads as middle grey (scene-linear 0.18 after exposure). Logs the value, then removes the card."""
    import OpenImageIO as oiio
    dg = bpy.context.evaluated_depsgraph_get()
    rooms, ras = biggest_rooms(5)
    mats = Materials(STYLE, os.path.join(OUT, "tex")); card_m = mats.get("grey_card")
    sun_o = next((o for o in sc.objects if o.type == "LIGHT" and o.data.type == "SUN"), None)
    to_sun = (sun_o.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized() if sun_o else None
    def sunlit(p):
        """Is this spot in a sun patch? (glass lets the ray through; anything else stops it)"""
        if to_sun is None: return False
        o = Vector(p)
        for _ in range(8):
            h = sc.ray_cast(dg, o, to_sun, distance=200)
            if not h[0]: return True
            if h[4].get("twin_layer") != "GLASS": return False
            o = h[1] + to_sun * 0.01
        return False
    cam = bpy.data.objects.new("GreyCam", bpy.data.cameras.new("GreyCam")); sc.collection.objects.link(cam); cam.data.type = "ORTHO"; cam.data.ortho_scale = 0.25
    keep = (sc.render.resolution_x, sc.render.resolution_y, sc.camera, sc.render.image_settings.file_format, sc.cycles.samples, sc.cycles.use_denoising)
    sc.render.resolution_x = sc.render.resolution_y = 48; sc.camera = cam; sc.cycles.samples = 128; sc.cycles.use_denoising = False
    sc.render.image_settings.file_format = "OPEN_EXR"; vals = []
    for r in rooms:
        # a free spot near the room centre at 0.8 m: nothing above it but the ceiling
        cells = np.argwhere(ras.label == ras.rooms.index(r)); cy, cx = cells.mean(0); best = None
        for (i, j) in cells[np.random.default_rng(1).choice(len(cells), min(400, len(cells)), replace=False)]:
            x, y = ras.x0 + (j + .5) * ras.res, ras.y0 + (i + .5) * ras.res
            hit = sc.ray_cast(dg, Vector((x, y, 0.81)), Vector((0, 0, 1)), distance=5)
            down = sc.ray_cast(dg, Vector((x, y, 0.79)), Vector((0, 0, -1)), distance=2)
            if hit[0] and hit[4].get("twin_layer") in ("CEILING", "SLAB") and down[4] is not None and down[4].get("twin_layer") == "FLOOR" and not sunlit((x, y, 0.81)):
                d = (x - (ras.x0 + (cx + .5) * ras.res)) ** 2 + (y - (ras.y0 + (cy + .5) * ras.res)) ** 2
                if best is None or d < best[0]: best = (d, x, y)
        if not best: continue
        _, x, y = best
        me = bpy.data.meshes.new("card"); me.from_pydata([(-0.1, -0.1, 0), (0.1, -0.1, 0), (0.1, 0.1, 0), (-0.1, 0.1, 0)], [], [(0, 1, 2, 3)]); me.materials.append(card_m)
        card = bpy.data.objects.new("GreyCard", me); sc.collection.objects.link(card); card.location = (x, y, 0.8)
        cam.location = (x, y, 0.8 + 0.35); cam.rotation_euler = (0, 0, 0)       # looking straight down (the card shades the camera's own spot: no, the camera is not an object)
        p = os.path.join(OUT, "_greycard.exr"); sc.render.filepath = p; bpy.ops.render.render(write_still=True)
        inp = oiio.ImageInput.open(p); px = np.asarray(inp.read_image(format=oiio.FLOAT)); inp.close()
        c = px[16:32, 16:32, :3].reshape(-1, 3).mean(0); Y = float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])
        vals.append({"room": r["name"], "at": [round(x, 2), round(y, 2), 0.8], "card_linear": round(Y, 4)})
        bpy.data.objects.remove(card); bpy.data.meshes.remove(me); os.remove(p)
    bpy.data.objects.remove(cam)
    sc.render.resolution_x, sc.render.resolution_y, sc.camera, sc.render.image_settings.file_format, sc.cycles.samples, sc.cycles.use_denoising = keep
    if not vals: print("grey card: no free spot found, keeping style exposure"); return lt.get("exposure", 0.6)
    med = float(np.median([v["card_linear"] for v in vals])); ev = round(max(-4.0, min(6.0, math.log2(0.18 / max(med, 1e-6)))), 2)
    rep = {"cards": vals, "median_card_linear": round(med, 4), "exposure_ev": ev, "rule": "EV = log2(0.18 / median card value): the card reads as middle grey under AgX. Cards stand at 0.8 m in the 5 biggest rooms, under the ceiling, out of direct sun.",
           "style_exposure_was": lt.get("exposure")}
    sc["twin_grey"] = json.dumps(rep); json.dump(rep, open(os.path.join(OUT, f"{TEN}_greycard.json"), "w"), indent=1)
    print(f"grey card: {vals} -> median {med:.4f} -> exposure {ev:+.2f} EV (card removed)", flush=True)
    return ev

def window_luminance(sc, M, n=6):
    """Median scene-linear luminance seen through facade windows (camera just inside the glass, looking out)."""
    import OpenImageIO as oiio
    ps = M.get("portals", [])
    if not ps: return None
    pick = [ps[int(i * len(ps) / min(n, len(ps)))] for i in range(min(n, len(ps)))]
    cam = bpy.data.objects.new("WinCam", bpy.data.cameras.new("WinCam")); sc.collection.objects.link(cam)
    keep = (sc.render.resolution_x, sc.render.resolution_y, sc.camera, sc.render.image_settings.file_format, sc.cycles.samples, sc.cycles.use_denoising)
    sc.render.resolution_x, sc.render.resolution_y = 64, 36; sc.camera = cam; sc.cycles.samples = 64; sc.cycles.use_denoising = False; sc.render.image_settings.file_format = "OPEN_EXR"
    vals = []
    for (cx, cy, ca, sa, ix, iy, ln, z0, z1) in pick:
        TL.set_cam(cam, (cx + ix * 0.35, cy + iy * 0.35, (z0 + z1) / 2), math.atan2(-iy, -ix), 0.0, 40.0)
        p = os.path.join(OUT, "_win.exr"); sc.render.filepath = p; bpy.ops.render.render(write_still=True)
        i = oiio.ImageInput.open(p); px = np.asarray(i.read_image(format=oiio.FLOAT)); i.close(); os.remove(p)
        c = px[9:27, 16:48, :3].reshape(-1, 3).mean(0); vals.append(float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]))
    bpy.data.objects.remove(cam)
    sc.render.resolution_x, sc.render.resolution_y, sc.camera, sc.render.image_settings.file_format, sc.cycles.samples, sc.cycles.use_denoising = keep
    return round(float(np.median(vals)), 4)

def previews(sc, M):
    """One wide view per large room, 960x540: looked at by a person, and checked for blown windows / black corners."""
    rooms, ras = biggest_rooms(3); cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam")); sc.collection.objects.link(cam); sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 960, 540; sc.render.image_settings.file_format = "PNG"; sc.cycles.samples = A.preview_samples
    d = os.path.join(OUT, "previews"); os.makedirs(d, exist_ok=True); stats = {}
    for r in rooms:
        x0, y0, x1, y1 = r["box"]; px, py = x0 + 0.7, y0 + 0.7; yaw = math.atan2(y1 - py, x1 - px)
        TL.set_cam(cam, (px, py, 1.55), yaw, 7, 75)
        p = os.path.join(d, f"light_{r['slug']}.png"); sc.render.filepath = p; t0 = time.time(); bpy.ops.render.render(write_still=True)
        s = TL.exposure_stats(TL.read_png(p)); s["seconds"] = round(time.time() - t0, 1); stats[r["name"]] = s
        print(f"preview {p}: {s}", flush=True)
    bpy.data.objects.remove(cam)
    json.dump(stats, open(os.path.join(d, "light_stats.json"), "w"), indent=1)


# ================================================================== stage: cameras / stills / bake / export (in their own modules)
def stage_cameras():
    open_stage("light"); import make_cameras
    make_cameras.run(TEN, LAYOUT, STYLE, OUT, A); bpy.ops.wm.save_as_mainfile(filepath=blend("cameras"))

def stage_stills():
    open_stage("cameras", "light"); import stills; stills.run(TEN, LAYOUT, STYLE, OUT, A)

def stage_bake():
    open_stage("cameras", "light"); import bake_export; bake_export.bake(TEN, LAYOUT, STYLE, OUT, A); bpy.ops.wm.save_as_mainfile(filepath=blend("baked"))

def stage_export():
    open_stage("baked", "cameras", "light"); import bake_export; bake_export.export(TEN, LAYOUT, STYLE, OUT, A)


STAGES = {"geometry": stage_geometry, "light": stage_light, "cameras": stage_cameras, "stills": stage_stills, "bake": stage_bake, "export": stage_export}
order = ["geometry", "light", "cameras", "bake", "export"] if A.stage == "all" else [s.strip() for s in A.stage.split(",")]
for s in order: TIMER.run(s, STAGES[s])
print("done:", order, "timings in", TIMER.path, flush=True)
