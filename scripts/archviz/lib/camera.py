"""Cameras: the shot list from archviz-facade-detail, and the moves from the reference videos.

Stills (`shot(spec, name)`), all with verticals corrected (lens shift, not tilt) and the hero's
bounding box as the target:
  street        eye level, 1.7 m, 24 mm, across the road from the front, shift up: the buyer's first look
  corner        eye level, 28 mm, from the corner, the long face raking away
  three_quarter 35 mm from 14 m up and 70 m out, the developer's brochure angle
  aerial        50 mm from 130 m up, the whole block and its street
  drone         28 mm from 60 m, looking down at 50 degrees, the entrance in the lower third
  detail        85 mm, f/2.8, a sign or the podium: depth of field does the selling
  interior      35 mm, 1.5 m up, inside a lit floor looking out through the glass
Moves (`animate(spec, name, frames)`):
  orbit         a slow 1/4 turn round the hero at three_quarter height
  flydown       from aerial to the street in one move, slowing into the entrance (facade-to-interior)
  dolly         a lateral slide along the front at eye level
Each shot can be overridden in the spec under "shots" (position, target, lens, shift, f_stop).
"""
import math
from .common import *

def _hero_bbox(spec):
    pre = tuple(spec.get("hero", {}).get("prefixes", ["shell_", "roof", "opt_", "int_", "sign", "tower", "podium"]))
    objs = [o for o in bpy.data.objects if o.type in ("MESH", "FONT", "CURVE") and o.name.startswith(pre) and not o.hide_render]
    bb = world_bbox(objs) if objs else None
    if not bb:
        objs = [o for o in bpy.data.objects if o.type == "MESH" and not o.name.startswith(("city_", "av_"))]; bb = world_bbox(objs)
    return bb or (Vector((-20, -15, 0)), Vector((20, 15, 20)))

def _front_dir(spec):
    """Unit vector from the hero toward the street it fronts (the spec's `front_deg`, degrees from +X, or -Y)."""
    a = math.radians(spec.get("hero", {}).get("front_deg", -90.0)); return Vector((math.cos(a), math.sin(a), 0))

def shot(spec, name="three_quarter", res=(3840, 2160)):
    lo, hi = _hero_bbox(spec); c = (lo + hi) / 2; H = hi.z - lo.z; hx, hy = (hi.x - lo.x) / 2, (hi.y - lo.y) / 2
    f = _front_dir(spec); r = Vector((-f.y, f.x, 0))   # out to the street, and right along the front
    DF = abs(f.x) * hx + abs(f.y) * hy   # the hero's half-depth toward the street
    DR = abs(r.x) * hx + abs(r.y) * hy   # its half-length along the front
    road = float(spec.get("hero", {}).get("road_offset", 22.0))   # footpath to far footpath, roughly
    z1 = spec.get("hero", {}).get("floor1_z", 5.0)
    S = {
        "street":        dict(pos=c + f * (DF + road) + r * (DR * 0.15), tgt=Vector((c.x, c.y, 1.7)), lens=24, shift=0.3, z=1.7, fstop=8),
        "corner":        dict(pos=c + f * (DF + road * 0.9) + r * (DR + 14), tgt=Vector((c.x, c.y, 1.7)), lens=28, shift=0.25, z=1.7, fstop=8),
        "three_quarter": dict(pos=c + f * (DF + road + 30) + r * (DR + 38) + Vector((0, 0, 14)), tgt=c + Vector((0, 0, H * 0.35)), lens=35, shift=0.0, fstop=8),
        "aerial":        dict(pos=c + f * (DF + 90) + r * (DR * 0.4) + Vector((0, 0, 130)), tgt=c + Vector((0, 0, H * 0.3)), lens=50, shift=0.0, fstop=8),
        "drone":         dict(pos=c + f * (DF + 44) + r * (DR * 0.7 + 12) + Vector((0, 0, 60)), tgt=c + f * (DF * 0.6) + Vector((0, 0, 4)), lens=28, shift=0.0, fstop=8),
        "detail":        dict(pos=c + f * (DF + 9) + r * (DR * 0.35) + Vector((0, 0, 1.6)), tgt=c + f * DF + Vector((0, 0, 4.5)), lens=85, shift=0.0, z=1.6, fstop=2.8),
        "interior":      dict(pos=c - f * (DF * 0.2) + Vector((0, 0, z1 + 1.5)), tgt=c + f * (DF + 40) + Vector((0, 0, z1 + 1.2)), lens=35, shift=0.0, fstop=4),
    }
    p = S.get(name, S["three_quarter"]); o = spec.get("shots", {}).get(name, {})
    pos = Vector(o["pos"]) if "pos" in o else p["pos"]; tgt = Vector(o["tgt"]) if "tgt" in o else p["tgt"]
    if "z" in p and "pos" not in o: pos.z = p["z"]
    lens = o.get("lens", p["lens"]); shift = o.get("shift", p["shift"]); fstop = o.get("f_stop", p["fstop"])
    cd = bpy.data.cameras.new("av_cam_" + name); cd.lens = lens; cd.sensor_width = 36; cd.sensor_fit = "HORIZONTAL" if res[0] >= res[1] else "VERTICAL"; cd.clip_end = 6000
    cam = bpy.data.objects.new("av_cam_" + name, cd); bpy.context.scene.collection.objects.link(cam); bpy.context.scene.camera = cam
    cam.location = pos; d = tgt - pos
    if shift:   # two-point perspective: level camera, lens shift to frame the height
        cam.rotation_euler = (math.radians(90), 0, math.atan2(d.y, d.x) - math.radians(90)); cd.shift_y = shift
    else: cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cd.dof.use_dof = fstop < 6; cd.dof.focus_distance = d.length; cd.dof.aperture_fstop = fstop
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = res
    log(f"shot {name}: {lens} mm from ({pos.x:.0f}, {pos.y:.0f}, {pos.z:.0f}) at f/{fstop}")
    return cam

def animate(spec, name="orbit", frames=240, res=(3840, 2160), fps=30):
    sc = bpy.context.scene; sc.frame_start, sc.frame_end = 1, frames; sc.render.fps = fps
    lo, hi = _hero_bbox(spec); c = (lo + hi) / 2; H = hi.z - lo.z; f = _front_dir(spec); r = Vector((-f.y, f.x, 0))
    hx, hy = (hi.x - lo.x) / 2, (hi.y - lo.y) / 2; DF = abs(f.x) * hx + abs(f.y) * hy; DR = abs(r.x) * hx + abs(r.y) * hy; L_ = 2 * max(DF, DR)
    cd = bpy.data.cameras.new("av_cam_" + name); cd.sensor_width = 36; cd.clip_end = 6000; cam = bpy.data.objects.new("av_cam_" + name, cd); sc.collection.objects.link(cam); sc.camera = cam
    tgt_o = bpy.data.objects.new("av_target", None); sc.collection.objects.link(tgt_o)
    con = cam.constraints.new("TRACK_TO"); con.target = tgt_o; con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"
    def key(fr, pos, tgt, lens):
        cam.location = pos; cam.keyframe_insert("location", frame=fr); tgt_o.location = tgt; tgt_o.keyframe_insert("location", frame=fr); cd.lens = lens; cd.keyframe_insert("lens", frame=fr)
    if name == "orbit":
        a0 = math.atan2(f.y, f.x) + math.radians(35); R = L_ * 0.75 + 60
        for i in range(0, frames + 1, max(1, frames // 8)):
            a = a0 - math.radians(90) * i / frames; key(i + 1, c + Vector((math.cos(a) * R, math.sin(a) * R, 16)), c + Vector((0, 0, H * 0.35)), 35)
    elif name == "flydown":
        key(1, c + f * (L_ * 0.9 + 70) + r * (L_ * 0.3) + Vector((0, 0, 130)), c + Vector((0, 0, H * 0.3)), 50)
        key(int(frames * 0.55), c + f * (L_ * 0.6 + 50) + r * (L_ * 0.4 + 20) + Vector((0, 0, 20)), c + Vector((0, 0, H * 0.35)), 35)
        key(frames, c + f * (L_ * 0.5 + 24) + r * (L_ * 0.05) + Vector((0, 0, 1.7)), c + f * (L_ * 0.5) + Vector((0, 0, 4)), 28)
    elif name == "dolly":
        key(1, c + f * (L_ * 0.5 + 26) - r * (L_ * 0.5) + Vector((0, 0, 1.7)), c + Vector((0, 0, H * 0.3)), 28)
        key(frames, c + f * (L_ * 0.5 + 26) + r * (L_ * 0.5) + Vector((0, 0, 1.7)), c + Vector((0, 0, H * 0.3)), 28)
    for fc in (cam.animation_data.action.fcurves if cam.animation_data and cam.animation_data.action else []):
        for kp in fc.keyframe_points: kp.interpolation = "BEZIER"; kp.easing = "EASE_IN_OUT"
    sc.render.resolution_x, sc.render.resolution_y = res
    log(f"move {name}: {frames} frames at {fps} fps"); return cam
