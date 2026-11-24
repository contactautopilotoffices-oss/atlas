"""Named cameras per room, chosen by ray casts (no renders), for stills and the web viewer.

Candidates
  * entry: standing 0.6 / 0.9 / 1.2 m inside each door of the room (and 0.3 m either side of its centre line); in open
    halls (> 40 m2) also the clearest circulation spot near each corner of the hall.
  * small rooms (< 8 m2: phone booths, small meeting rooms): from just outside the door, looking in through the open
    door / the glass, hFOV up to 80 deg.
  * feature: 3-5 m from the room's subject; reverse: the far end of the room looking back to the door;
    detail (optional): 1.2-2.4 m from the furniture, 45 deg lens.
Aim: the room's subject = the feature wall's (or logo's) middle; else the farthest point visible across the room's
longest diagonal; else the furniture centroid. Yaw swept +-30 deg round it, pitch 5-10 deg down (made with lens
shift: the camera stays level, verticals stay vertical), hFOV 72-78 deg. Eye 1.55 m.

Score (a 24 x 14 ray grid through the frame):
  reject: one planar wall face within 2 m takes > 35 % of the frame; ceiling > 30 %; void (sky / nothing) > 2 %;
          a column within 1.5 m in the middle of the frame; one piece of furniture > 30 %; the lens inside an object.
  prefer: larger mean depth, more distinct pieces of furniture in view.
A room where nothing passes keeps its best view, flagged "fallback" in the report: no room ends with zero views.
Hand overrides in cameras_override/<tenant>.json win over the automatic ones (format in that folder's README).

Writes <out>/<tenant>_cameras.json (web viewer shape, glTF frame), <out>/<tenant>_cameras_plan.json (plan frame, all
checks), <out>/<tenant>_cameras_report.json and one contact sheet per room in <out>/review/.
"""
import bpy, json, math, os, re, sys, time
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL
from twin_lib import Raster, room_kind
import placement_check as PC

HERE = os.path.dirname(os.path.abspath(__file__))
EYE = 1.55
CEIL = {"CEILING", "SLAB", "SERVICES", "LIGHT", "HVAC"}
FURN = {"DESK", "SEAT", "TABLE", "PLANTER", "PLANT", "FIXTURE", "RUG", "FEATURE", "LOGO"}
SKIP = r"core|service|plant_room|shaft|duct|lift|stair|void|janitor|electrical|ups|server|occupied|unlabelled|circulation"


class Caster:
    def __init__(self):
        self.sc = bpy.context.scene; self.dg = bpy.context.evaluated_depsgraph_get()
    def ray(self, o, d, dist=80.0):
        hit, loc, nrm, idx, ob, _ = self.sc.ray_cast(self.dg, Vector(o), Vector(d), distance=dist)
        return hit, loc, nrm, ob
    def inside(self, p):
        for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            h, loc, n, ob = self.ray(p, d, 30)
            if h and n.dot(Vector(d)) > 0.2 and ob.get("twin_layer") not in ("GLASS", "BLIND"): return True
        return False
    def frame(self, pos, yaw, pitch, hfov, nx=24, ny=14, inroom=None):
        f = 0.5 / math.tan(math.radians(hfov) / 2); sh = math.tan(math.radians(pitch)) * f
        fwd = Vector((math.cos(yaw), math.sin(yaw), 0)); right = Vector((math.sin(yaw), -math.cos(yaw), 0)); up = Vector((0, 0, 1)); asp = 9 / 16
        out = []
        for j in range(ny):
            for i in range(nx):
                u = (i + 0.5) / nx - 0.5; v = ((j + 0.5) / ny - 0.5) * asp - sh
                dvec = (right * u + up * v + fwd * f).normalized(); h, loc, n, ob = self.ray(pos, dvec)
                if h:
                    plane = f"{ob.name}|{round(n.x, 1)},{round(n.y, 1)},{round(n.z, 1)}|{round(n.dot(loc) / 0.1)}"
                    q = loc - dvec * 0.15; ir = inroom(q.x, q.y) if inroom else True
                    out.append((True, (loc - Vector(pos)).length, ob.name, ob.get("twin_layer"), plane, abs(u) < 0.3 and abs(v + sh) < 0.25, ir))
                else: out.append((False, None, None, None, None, False, False))
        return out

def score(hits, small=False, furn_in_room=0):
    n = len(hits); miss = sum(1 for h in hits if not h[0]) / n
    inr = sum(1 for h in hits if h[0] and h[6]) / n            # how much of the frame is this room
    ds = [h[1] for h in hits if h[0]]; mean = float(np.mean(ds)) if ds else 0.0
    planes = {}
    for h in hits:
        if h[0] and h[3] in ("WALL", "COLUMN", "SKIRTING", "GLASS", "DOOR", "BLIND") and h[1] < 2.0: planes[h[4]] = planes.get(h[4], 0) + 1
    wall_near = max(planes.values()) / n if planes else 0.0
    allp = {}
    for h in hits:
        if h[0] and h[3] not in CEIL and h[3] != "FLOOR": allp[h[4]] = allp.get(h[4], 0) + 1
    one_surface = max(allp.values()) / n if allp else 0.0
    ceil = sum(1 for h in hits if h[0] and h[3] in CEIL) / n
    col_front = any(h[0] and h[3] == "COLUMN" and h[1] < 1.5 and h[5] for h in hits)
    furn = {}
    for h in hits:
        if h[0] and h[3] in FURN: furn[h[2]] = furn.get(h[2], 0) + 1
    block = max(furn.items(), key=lambda kv: kv[1]) if furn else ("", 0)
    m = {"mean_depth_m": round(mean, 2), "void": round(miss, 3), "wall_within_2m": round(wall_near, 3), "ceiling": round(ceil, 3),
         "one_surface": round(one_surface, 3), "column_in_front": col_front, "furniture_seen": len(furn), "largest_furniture": round(block[1] / n, 3), "in_room": round(inr, 3)}
    fails = []
    if miss > 0.02: fails.append("void")
    if wall_near > (0.5 if small else 0.35): fails.append(f"wall within 2 m {wall_near:.0%}")
    if ceil > 0.30: fails.append(f"ceiling {ceil:.0%}")
    if col_front: fails.append("column within 1.5 m in front")
    if block[1] / n > 0.30: fails.append(f"{block[0]} fills {block[1] / n:.0%}")
    if inr < (0.3 if small else 0.6): fails.append(f"only {inr:.0%} of the frame is this room")
    if one_surface > 0.45: fails.append(f"one surface fills {one_surface:.0%}")
    if furn_in_room >= 3 and len(furn) < 2: fails.append("almost no furniture in view")
    sc = mean / 5 + 0.04 * min(len(furn), 25) - wall_near - 0.5 * ceil - 10 * miss + 1.0 * inr
    return m, fails, sc


def run(tenant, L, S, out, A):
    t0 = time.time(); sc = bpy.context.scene; meta = json.loads(sc.get("twin_meta", "{}")); ras = Raster(L); C = Caster()
    for o in [o for o in sc.objects if o.get("twin_layer") == "CAMERA"]: bpy.data.objects.remove(o)
    objs = [o for o in sc.objects if o.type == "MESH" and o.get("twin_layer")]
    Rall = PC.obstacle_raster(L, ras, 0.05, True, objs); Rst = PC.obstacle_raster(L, ras, 0.05, False)
    furn = Rall["O"] & ~Rst["O"]; Df = PC.dist_map(furn, 0.05, 2.0); Ds = PC.dist_map(Rst["O"], 0.05, 1.5); Da = PC.dist_map(Rall["O"], 0.05, 2.0)
    res, x0, y0 = 0.05, Rall["x0"], Rall["y0"]
    def D(D_, x, y):
        i, j = int((y - y0) / res), int((x - x0) / res)
        return float(D_[i, j]) if 0 <= i < D_.shape[0] and 0 <= j < D_.shape[1] else 0.0
    skip = S.get("camera_skip", SKIP); only = getattr(A, "rooms", "") or ""
    doors = [d for d in meta.get("doors", []) if d.get("opening")]
    ov_path = os.path.join(HERE, "cameras_override", f"{tenant}.json"); overrides = json.load(open(ov_path)).get("cameras", []) if os.path.exists(ov_path) else []
    col = bpy.data.collections.get(f"{tenant}_CAMERAS") or bpy.data.collections.new(f"{tenant}_CAMERAS")
    if col.name not in sc.collection.children: sc.collection.children.link(col)
    plan, report = [], {}
    for k, r in enumerate(ras.rooms):
        if not r.get("box") or (only and not re.search(only, r["name"], re.I)): continue
        if re.search(skip, r["name"], re.I) or re.search(skip, str(r.get("kind", "")), re.I) or re.search(skip, room_kind(S, r["name"], r.get("kind")), re.I):
            continue
        cells = ras.label == k; area = float(cells.sum() * ras.res ** 2)
        if area < 1.5: continue
        bx = r["box"]; diag = math.hypot(bx[2] - bx[0], bx[3] - bx[1]); small = area < 8.0
        inroom = lambda x, y: ras.room_at(x, y) is r
        # ---- the subject
        fw = [o for o in objs if o.get("twin_layer") in ("FEATURE", "LOGO") and o.get("room") == r["name"]]
        fur = [o for o in objs if o.get("twin_layer") in ("DESK", "TABLE", "SEAT", "PLANTER") and inroom(o.location.x, o.location.y)]
        subj, sk = None, None
        if fw:
            o = max(fw, key=lambda o: o.dimensions.x * o.dimensions.z); bbw = [o.matrix_world @ Vector(c) for c in o.bound_box]
            subj = sum(bbw, Vector()) / 8; subj.z = max(1.2, min(1.7, subj.z)); sk = "feature wall"
        centroid = Vector((float(np.mean([o.location.x for o in fur])), float(np.mean([o.location.y for o in fur])), 0.9)) if fur else None
        def aim_for(p):
            if subj is not None: return subj, sk
            # farthest visible point across the longest diagonal: towards the room corner farthest from p
            corners = [(bx[0], bx[1]), (bx[2], bx[1]), (bx[2], bx[3]), (bx[0], bx[3])]
            fx, fy = max(corners, key=lambda c: math.hypot(c[0] - p.x, c[1] - p.y))
            d = Vector((fx - p.x, fy - p.y, 1.2 - p.z)); hit = C.ray(p, d.normalized(), d.length + 2)
            if hit[0] and (hit[1] - p).length > 2.0: return hit[1], "far point across the diagonal"
            if centroid is not None: return centroid, "furniture centroid"
            return Vector(((bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2, 1.2)), "room centre"
        rdoors = []
        for d in doors:
            ox, oy, oa, w = d["opening"]; nx_, ny_ = -math.sin(oa), math.cos(oa)
            for s in (-1, 1):
                if inroom(ox + nx_ * 0.6 * s, oy + ny_ * 0.6 * s): rdoors.append((Vector((ox, oy, 0)), Vector((nx_ * s, ny_ * s, 0)), Vector((math.cos(oa), math.sin(oa), 0))))
        need = [0.8]          # 0.8 m clear of furniture; relaxed to 0.6 only if no view passes at 0.8
        free = lambda x, y, need_f=None: D(Ds, x, y) >= 0.3 and D(Df, x, y) >= (need[0] if need_f is None else need_f)
        def pts_entry():
            ps = []
            for dp, dn, dt in rdoors:
                for din in (0.6, 0.9, 1.2):
                    for lat in (-0.3, 0.0, 0.3):
                        q = dp + dn * din + dt * lat
                        if inroom(q.x, q.y) and free(q.x, q.y): ps.append((Vector((q.x, q.y, EYE)), "door"))
            if area > 40:
                ij = np.argwhere(cells)
                for cx_, cy_ in ((bx[0], bx[1]), (bx[2], bx[1]), (bx[2], bx[3]), (bx[0], bx[3])):
                    best = None
                    for (i, j) in ij[::7]:
                        x, y = ras.x0 + (j + .5) * ras.res, ras.y0 + (i + .5) * ras.res
                        if math.hypot(x - cx_, y - cy_) > 4.0: continue
                        dd = D(Da, x, y)
                        if dd >= 0.6 and (best is None or dd > best[0]): best = (dd, x, y)
                    if best: ps.append((Vector((best[1], best[2], EYE)), "circulation corner"))
            return ps
        def pts_outside():
            ps = []
            for dp, dn, dt in rdoors:
                for dout in (0.6, 0.9, 1.2, 1.5):
                    q = dp - dn * dout
                    if not inroom(q.x, q.y) and D(Ds, q.x, q.y) >= 0.25: ps.append((Vector((q.x, q.y, EYE)), "outside the door"))
            return ps
        chosen = {}
        def clash(p, yaw):
            return any((p - c["p"]).length < 1.0 and abs(math.remainder(yaw - c["yaw"], 2 * math.pi)) < math.radians(50) for c in chosen.values())
        def search(kind, cands, aim, sweep=(-30, -20, -10, 0, 10, 20, 30), hfovs=(72, 75, 78), pitches=(5, 7.5, 10), smallroom=False, need_through=None):
            coarse = []
            for p, why in cands:
                if C.inside(p): continue
                tgt, tk = aim(p); y0_ = math.atan2(tgt.y - p.y, tgt.x - p.x)
                for dyaw in sweep:
                    yaw = y0_ + math.radians(dyaw)
                    if clash(p, yaw): continue
                    hits = C.frame(p, yaw, 7.5, 75, 16, 9, inroom); m, fails, s_ = score(hits, smallroom, len(fur))
                    if kind in ("entry", "feature") and subj is not None:      # the subject must be in sight
                        dv = tgt - p; hs = C.ray(p, dv.normalized(), dv.length + 1)
                        if hs[0] and (hs[1] - p).length < dv.length - 0.5 and hs[3].get("twin_layer") not in ("FEATURE", "LOGO"): fails = fails + ["subject hidden"]; s_ -= 2
                    if need_through is not None:
                        c_ = C.ray(p, Vector((math.cos(yaw), math.sin(yaw), -0.12)).normalized())
                        if not c_[0] or (c_[1] - p).length < need_through(p) + 0.4: continue      # must see into the room
                    coarse.append((s_ - 3 * len(fails), p, yaw, why, tk, "subject hidden" in fails))
            coarse.sort(key=lambda t: -t[0]); best = None
            for _, p, yaw, why, tk, hid in coarse[:6]:
                for hf in hfovs:
                    for pt in pitches:
                        hits = C.frame(p, yaw, pt, hf, 24, 14, inroom); m, fails, s_ = score(hits, smallroom, len(fur))
                        if kind == "detail": fails = [f for f in fails if not f.startswith("wall within") and "fills" not in f and "this room" not in f]
                        if hid: fails = fails + ["subject hidden"]
                        cand = {"kind": kind, "p": p, "yaw": yaw, "pitch": pt, "hfov": hf, "m": m, "fails": fails, "s": s_, "from": why, "aim": tk}
                        if best is None or (not fails, s_) > (not best["fails"], best["s"]): best = cand
            return best
        # entry (or, for small rooms, from outside the door)
        e = None
        if not small: e = search("entry", pts_entry(), aim_for)
        if small or e is None:
            dist_door = lambda p: min(((p - dp).length for dp, _, _ in rdoors), default=0.0)
            e2 = search("entry", pts_outside(), lambda p: (centroid or Vector(((bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2, 1.0)), "room, through the door"),
                        hfovs=(75, 78, 80), smallroom=True, need_through=dist_door)
            if e2 and (e is None or (not e2["fails"] and e["fails"])): e = e2
        if e is None or e["fails"]:     # no door known, or nothing good from the doors: anywhere in the room, aimed across it
            ij = np.argwhere(cells)[::25]
            any_p = [(Vector((ras.x0 + (j + .5) * ras.res, ras.y0 + (i + .5) * ras.res, EYE)), "anywhere") for i, j in ij if free(ras.x0 + (j + .5) * ras.res, ras.y0 + (i + .5) * ras.res, 0.3)][:40]
            e3 = search("entry", any_p, aim_for)
            if e3 and (e is None or (not e3["fails"] and e["fails"]) or (bool(e3["fails"]) == bool(e["fails"]) and e3["s"] > e["s"])): e = e3
        if e: chosen["entry"] = e
        if not small and area > 12:
          for need[0] in (0.8, 0.6):
            if (subj is not None or centroid is not None) and "feature" not in chosen:
                tgt = subj if subj is not None else centroid
                fc = []
                for (i, j) in np.argwhere(cells)[::9]:
                    x, y = ras.x0 + (j + .5) * ras.res, ras.y0 + (i + .5) * ras.res
                    if 3.0 <= math.hypot(x - tgt.x, y - tgt.y) <= 5.0 and free(x, y): fc.append((Vector((x, y, EYE)), "3-5 m from the subject"))
                f_ = search("feature", fc[:: max(1, len(fc) // 25)], lambda p: (tgt, sk or "furniture centroid"), sweep=(-10, 0, 10))
                if f_ and not f_["fails"]: chosen["feature"] = f_
            if rdoors and "reverse" not in chosen:
                dp = rdoors[0][0]; rc = []
                for (i, j) in np.argwhere(cells)[::9]:
                    x, y = ras.x0 + (j + .5) * ras.res, ras.y0 + (i + .5) * ras.res
                    if free(x, y): rc.append((math.hypot(x - dp.x, y - dp.y), x, y))
                rc.sort(reverse=True)
                rv = search("reverse", [(Vector((x, y, EYE)), "far end") for _, x, y in rc[:12]], lambda p: (Vector((dp.x, dp.y, 1.2)), "the door"), sweep=(-20, -10, 0, 10, 20))
                if rv and not rv["fails"]: chosen["reverse"] = rv
            if centroid is not None and "detail" not in chosen and need[0] == 0.8:
                dc = []
                for (i, j) in np.argwhere(cells)[::9]:
                    x, y = ras.x0 + (j + .5) * ras.res, ras.y0 + (i + .5) * ras.res
                    if 1.2 <= math.hypot(x - centroid.x, y - centroid.y) <= 2.4 and D(Ds, x, y) >= 0.3 and D(Df, x, y) >= 0.35: dc.append((Vector((x, y, EYE)), "close to the furniture"))
                dt_ = search("detail", dc[:: max(1, len(dc) // 20)], lambda p: (centroid, "furniture"), sweep=(-10, 0, 10), hfovs=(45,), pitches=(12,))
                if dt_ and not dt_["fails"] and dt_["m"]["furniture_seen"] >= 2 and dt_["m"]["in_room"] >= 0.7: chosen["detail"] = dt_
          need[0] = 0.8
        for k_, c_ in chosen.items(): c_.setdefault("clearance_m", round(D(Df, c_["p"].x, c_["p"].y), 2))
        # hand overrides win
        for ov in overrides:
            if ov.get("room") != r["name"]: continue
            p = Vector(ov["position"]); tg = Vector(ov["target"])
            if ov.get("frame", "plan") == "glb": p = Vector((p.x, -p.z, p.y)); tg = Vector((tg.x, -tg.z, tg.y))
            yaw = math.atan2(tg.y - p.y, tg.x - p.x); pitch = math.degrees(math.atan2(p.z - tg.z, math.hypot(tg.x - p.x, tg.y - p.y)))
            hits = C.frame(p, yaw, pitch, ov.get("hfov_deg", 75), 24, 14, inroom); m, fails, s_ = score(hits)
            chosen[ov.get("kind", "entry")] = {"kind": ov.get("kind", "entry"), "p": p, "yaw": yaw, "pitch": pitch, "hfov": ov.get("hfov_deg", 75), "m": m, "fails": fails, "s": s_, "from": "override", "aim": "override", "label": ov.get("label")}
        rep = {"area_m2": round(float(area), 1), "small": small, "subject": sk or ("furniture centroid" if centroid is not None else "far point / centre"), "views": {}}
        for kind in ("entry", "feature", "reverse", "detail"):
            c = chosen.get(kind)
            if not c: continue
            name = f"{tenant}_CAM_{r['slug']}_{kind}"; p, yaw, pitch, hf = c["p"], c["yaw"], c["pitch"], c["hfov"]
            cam = bpy.data.objects.new(name, bpy.data.cameras.new(name)); col.objects.link(cam); cam["twin_layer"] = "CAMERA"; cam["room"] = r["name"]; cam["kind"] = kind
            TL.set_cam(cam, tuple(p), yaw, pitch, hf); cam.data.clip_start = 0.05; cam.data.clip_end = 300
            centre = C.ray(p, Vector((math.cos(yaw) * math.cos(math.radians(pitch)), math.sin(yaw) * math.cos(math.radians(pitch)), -math.sin(math.radians(pitch)))))
            dist = max(1.0, min(10.0, (centre[1] - p).length if centre[0] else 5.0))
            cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 8.0; cam.data.dof.aperture_blades = 7; cam.data.dof.focus_distance = max(1.5, min(6.0, dist))
            fwd = Vector((math.cos(yaw) * math.cos(math.radians(pitch)), math.sin(yaw) * math.cos(math.radians(pitch)), -math.sin(math.radians(pitch))))
            tgt = p + fwd * dist; vf = math.degrees(2 * math.atan(math.tan(math.radians(hf) / 2) * 9 / 16))
            label = c.get("label") or f"{r['name'].title()}: {kind}"
            plan.append({"name": name, "room": r["name"], "room_slug": r["slug"], "kind": kind, "label": label, "position": [round(v, 3) for v in p], "target": [round(v, 3) for v in tgt],
                         "hfov_deg": hf, "vfov_deg": round(vf, 2), "lens_mm": round(cam.data.lens, 2), "shift_y": round(cam.data.shift_y, 4), "pitch_deg": pitch,
                         "checks": c["m"], "failed": c["fails"], "fallback": bool(c["fails"]), "from": c["from"], "aim": c["aim"]})
            rep["views"][kind] = {"failed": c["fails"], "from": c["from"], "aim": c["aim"], "furniture_clearance_m": c.get("clearance_m"), **c["m"]}
        if not rep["views"]: rep["error"] = "NO VIEW"
        report[r["name"]] = rep
    # ---- outputs
    G = lambda v: [v[0], v[2], -v[1]]          # plan (x east, y north, z up) -> glTF / three.js (x, y up, z = -north)
    web = {"frame": "glTF / three.js world of <tenant>.glb: x = plan east, y = up (0 = finished floor), z = -plan north; metres. "
                    "position = the lens, target = a point on the view axis; hfov_deg = horizontal field of view for a 16:9 frame "
                    "(three.js PerspectiveCamera.fov is vertical: vfov = 2 atan(tan(hfov/2) * h / w)). The stills use the same "
                    "camera made level with lens shift; using lookAt(target) gives the same view with a 5-10 deg tilt.",
           "tenant": tenant, "rooms": {}}
    for c in plan:
        web["rooms"].setdefault(c["room"], []).append({"kind": c["kind"], "position": G(c["position"]), "target": G(c["target"]), "hfov_deg": c["hfov_deg"],
                                                       "room": c["room"], "label": c["label"], "name": c["name"], "still": f"stills/{c['name']}.png"})
    bad = contact(tenant, out, plan, A)
    if bad:      # a view that renders (nearly) black is dropped after the fact, and listed in the report
        for c in [c for c in plan if c["name"] in bad]:
            report[c["room"]]["views"].pop(c["kind"], None); report[c["room"]].setdefault("dropped_after_render", {})[c["kind"]] = bad[c["name"]]
            bpy.data.objects.remove(bpy.data.objects[c["name"]])
        plan = [c for c in plan if c["name"] not in bad]
        web["rooms"] = {}
        for c in plan:
            web["rooms"].setdefault(c["room"], []).append({"kind": c["kind"], "position": G(c["position"]), "target": G(c["target"]), "hfov_deg": c["hfov_deg"],
                                                           "room": c["room"], "label": c["label"], "name": c["name"], "still": f"stills/{c['name']}.png"})
    json.dump(web, open(os.path.join(out, f"{tenant}_cameras.json"), "w"), indent=1)
    json.dump({"frame": "plan: x east, y north, z up from the finished floor; metres", "tenant": tenant, "cameras": plan}, open(os.path.join(out, f"{tenant}_cameras_plan.json"), "w"), indent=1)
    json.dump(report, open(os.path.join(out, f"{tenant}_cameras_report.json"), "w"), indent=1)
    nf = sum(1 for c in plan if c["fallback"]); nz = [k for k, v in report.items() if not v["views"]]
    print(f"cameras: {len(plan)} views in {len(report)} rooms; {nf} fallback views (best available, a gate failed); {len(bad)} dropped as black; rooms with NO view: {nz}; {time.time() - t0:.1f} s", flush=True)

def contact(tenant, out, cams, A):
    sc = bpy.context.scene; d = os.path.join(out, "review"); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        if f.startswith(("contact_", "overview_")): os.remove(os.path.join(d, f))
    sc.render.resolution_x, sc.render.resolution_y = 480, 270; sc.render.image_settings.file_format = "PNG"; sc.cycles.samples = getattr(A, "contact_samples", 16)
    by = {}
    for c in cams: by.setdefault(c["room_slug"], []).append(c)
    stats = {}; t0 = time.time(); bad = {}
    for slug, cs in by.items():
        tiles = []
        for c in cs:
            sc.camera = bpy.data.objects[c["name"]]; p = os.path.join(d, f"_{c['name']}.png"); sc.render.filepath = p
            bpy.ops.render.render(write_still=True); img = TL.read_png(p); os.remove(p); st_ = TL.exposure_stats(img); stats[c["name"]] = st_
            if st_["black"] > 0.6 or st_["mean"] < 0.04: bad[c["name"]] = f"renders black ({st_})"; continue
            tiles.append(img)
            if c["fallback"]: img[:6, :, :] = (0.9, 0.1, 0.1); img[-6:, :, :] = (0.9, 0.1, 0.1)     # red bars: a fallback view
        if not tiles: continue
        while len(tiles) % 2: tiles.append(np.full_like(tiles[0], 0.15))
        rows = [np.concatenate([tiles[i], np.full((270, 6, 3), 1.0, np.float32), tiles[i + 1]], 1) for i in range(0, len(tiles), 2)]
        sheet = np.concatenate([np.concatenate([r_, np.full((6, r_.shape[1], 3), 1.0, np.float32)], 0) for r_ in rows], 0)
        TL.write_png(os.path.join(d, f"contact_{slug}.png"), sheet)
    json.dump(stats, open(os.path.join(d, "contact_stats.json"), "w"), indent=1)
    print(f"contact sheets: {len(by)} rooms, {len(cams)} views in {time.time() - t0:.0f} s -> {d} (each sheet: entry, feature, reverse, detail in that order; red bars = fallback view)", flush=True)
    return bad

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument("--tenant"); ap.add_argument("--layout"); ap.add_argument("--style"); ap.add_argument("--out"); ap.add_argument("--rooms", default=""); ap.add_argument("--contact-samples", type=int, default=16)
    A = ap.parse_args(TL.script_args())
    run(A.tenant, TL.norm_layout(json.load(open(A.layout))), TL.load_style(A.style), A.out, A)
