"""Entourage: cars, people and street furniture, from assets or built-in proxies.

`populate(spec, diorama)` puts:
  cars       along the traffic lanes a diorama JSON gives (x, y polylines with a width), one every
             18 to 40 m, in the lane's direction, a random pick of the car assets; parked cars along
             the hero's frontage from the spec
  people     at the entrance, along footpaths and at the metro, standing and walking assets; the
             builders' simple people (proto_person) are kept when no asset is there
  furniture  lamp posts at the diorama's lamp positions, benches and bollards along the frontage,
             bins at the entrance; rooftop clutter (tanks, AC units) on the city is city.py's job
Everything is instanced from a hidden asset collection, so a hundred cars cost one.
"""
import math, os
from .common import *
from . import assets, materials, vegetation

def proxy_car(col, L_=4.4, body=(0.85, 0.86, 0.88)):
    mb = materials.pbr("av_proxy_car", "tex.metal", body, 0.25, 0.6, dirt=0.1, streaks=False, bevel=0.02, coat=0.6)
    mg = materials.curtain_glass("av_proxy_car_glass", (0.08, 0.1, 0.12), 0.4, jitter=0.0); mt = materials.pbr("av_proxy_tyre", None, (0.03, 0.03, 0.03), 0.9, dirt=0.0, streaks=False, bevel=0.01)
    out = []
    W_ = 1.8
    out.append(box("av_car_body", (-L_ / 2, -W_ / 2, 0.3), (L_ / 2, W_ / 2, 0.85), mb, col)); out.append(box("av_car_cabin", (-L_ * 0.22, -W_ / 2 + 0.08, 0.85), (L_ * 0.25, W_ / 2 - 0.08, 1.42), mg, col))
    out.append(box("av_car_roof", (-L_ * 0.2, -W_ / 2 + 0.1, 1.4), (L_ * 0.22, W_ / 2 - 0.1, 1.45), mb, col))
    for x in (-L_ * 0.32, L_ * 0.32):
        for y in (-W_ / 2, W_ / 2):
            bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=18, radius1=0.33, radius2=0.33, depth=0.22, matrix=Matrix.Translation((x, y, 0.33)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
            out.append(mesh_object("av_car_wheel", bm, mt, col))
    for o in out:
        add_bevel(o, 0.03, 3)
    return out

def proxy_person(col, h=1.72, shirt=(0.8, 0.8, 0.78)):
    ms = materials.pbr("av_proxy_shirt", None, shirt, 0.8, dirt=0.0, streaks=False, bevel=0.01); mt = materials.pbr("av_proxy_trousers", None, (0.1, 0.11, 0.14), 0.85, dirt=0.0, streaks=False, bevel=0.01)
    mk = materials.pbr("av_proxy_skin", None, (0.5, 0.3, 0.2), 0.55, dirt=0.0, streaks=False, bevel=0.01); mh = materials.pbr("av_proxy_hair", None, (0.03, 0.025, 0.02), 0.6, dirt=0.0, streaks=False, bevel=0.0)
    s = h / 1.72; out = []
    out.append(box("av_p_legs", (-0.16 * s, -0.1 * s, 0), (0.16 * s, 0.1 * s, 0.8 * s), mt, col)); out.append(box("av_p_torso", (-0.2 * s, -0.11 * s, 0.8 * s), (0.2 * s, 0.11 * s, 1.42 * s), ms, col))
    out.append(box("av_p_arm_l", (-0.28 * s, -0.06 * s, 0.82 * s), (-0.2 * s, 0.06 * s, 1.38 * s), ms, col)); out.append(box("av_p_arm_r", (0.2 * s, -0.06 * s, 0.82 * s), (0.28 * s, 0.06 * s, 1.38 * s), ms, col))
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.11 * s, matrix=Matrix.Translation((0, 0, 1.58 * s))); out.append(mesh_object("av_p_head", bm, mk, col))
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.115 * s, matrix=Matrix.Translation((0, 0.01 * s, 1.61 * s)) @ Matrix.Diagonal((1, 1, 0.7, 1))); out.append(mesh_object("av_p_hair", bm, mh, col))
    for o in out: add_bevel(o, 0.02, 3)
    return out

def proxy_lamp(col):
    mm = materials.pbr("av_proxy_lamp", "tex.metal", (0.3, 0.32, 0.34), 0.45, 0.8, dirt=0.2, streaks=False, bevel=0.01); mh = materials.emissive("lamp_head", (1.0, 0.85, 0.6), 0.0)
    out = []
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.1, radius2=0.06, depth=7.0, matrix=Matrix.Translation((0, 0, 3.5))); out.append(mesh_object("av_lamp_post", bm, mm, col))
    out.append(box("av_lamp_arm", (0, 0, 6.9), (1.6, 0.06, 7.0), mm, col)); out.append(box("av_lamp_head_", (1.2, -0.12, 6.85), (1.75, 0.12, 7.05), mh, col))
    return out

def _along(path, step, offset, start=6.0):
    """Points along a polyline [(x,y),...] every `step` m, offset to the right by `offset`: (x, y, heading)."""
    out = []; acc = 0.0; nxt = start
    for (ax, ay), (bx, by) in zip(path, path[1:]):
        seg = math.hypot(bx - ax, by - ay)
        if seg < 1e-6: continue
        ux, uy = (bx - ax) / seg, (by - ay) / seg
        while nxt <= acc + seg:
            t = (nxt - acc) / seg; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            out.append((x + uy * offset, y - ux * offset, math.atan2(uy, ux))); nxt += step
        acc += seg
    return out

def _place_instances(name, items, col, scale=1.0):
    """Collection instances at (x, y, yaw) with yaw honoured (geometry nodes random yaw would be wrong for cars).
    `col` may be a set of variants (nested collections): each instance picks one."""
    if not items or col is None: return 0
    holder = collection("av_entourage"); picks = list(col.children) or [col]; rr = rng(len(items) * 3 + len(name))
    for i, (x, y, yaw) in enumerate(items):
        e = bpy.data.objects.new(f"{name}_{i}", None); e.instance_type = "COLLECTION"; e.instance_collection = rr.choice(picks)
        e.location = (x, y, 0); e.rotation_euler = (0, 0, yaw); e.scale = (scale, scale, scale); holder.objects.link(e)
    return len(items)

def populate(spec, diorama=None):
    rr = rng(41); n_cars = n_people = n_lamps = 0
    cars_all = vegetation.variants("av_cars_set", [vegetation.asset_collection(slot, fb) for slot, fb in (
        ("car.saloon_a", lambda c: proxy_car(c, 4.4, (0.85, 0.86, 0.88))), ("car.saloon_b", lambda c: proxy_car(c, 4.5, (0.12, 0.13, 0.15))), ("car.suv", lambda c: proxy_car(c, 4.7, (0.45, 0.47, 0.5))))])
    # cars along the diorama's lanes, both directions, gaps 18 to 40 m
    if diorama and diorama.get("traffic"):
        items = []
        for ln in diorama["traffic"]:
            w = ln.get("w", 7.0); path = ln["p"]
            for side in (-1, 1):
                pts = _along(path, rr.uniform(18, 40), side * w * 0.25, rr.uniform(0, 20))
                for x, y, hd in pts:
                    if rr.random() < 0.75: items.append((x, y, hd + (math.pi if side < 0 else 0)))
        n_cars += _place_instances("av_car", items, cars_all)
    for p in spec.get("entourage", {}).get("parked", []):   # [x, y, yaw_deg]
        n_cars += _place_instances("av_parked", [(p[0], p[1], math.radians(p[2]))], cars_all)
    # people
    ppl_all = vegetation.variants("av_people_set", [vegetation.asset_collection(slot, fb) for slot, fb in (
        ("person.standing_a", lambda c: proxy_person(c, 1.74, (0.85, 0.85, 0.83))), ("person.standing_b", lambda c: proxy_person(c, 1.66, (0.25, 0.35, 0.6))), ("person.walking_a", lambda c: proxy_person(c, 1.78, (0.45, 0.12, 0.18))))])
    items = []
    for p in spec.get("entourage", {}).get("people", []): items.append((p[0], p[1], math.radians(p[2] if len(p) > 2 else rr.uniform(0, 360))))
    if diorama:
        if diorama.get("walk0"):
            x, y = diorama["walk0"]
            for k in range(5): items.append((x + rr.uniform(-6, 6), y + rr.uniform(-6, 6), rr.uniform(0, 2 * math.pi)))
        for ln in (diorama.get("traffic") or [])[:8]:
            for x, y, hd in _along(ln["p"], rr.uniform(12, 30), (ln.get("w", 7) * 0.5 + 1.6) * rr.choice((-1, 1)), rr.uniform(0, 15)):
                if rr.random() < 0.6: items.append((x, y, hd + rr.choice((0, math.pi)) + rr.uniform(-0.3, 0.3)))
    n_people += _place_instances("av_person", items, ppl_all)
    # lamp posts
    lamp_col = vegetation.variants("av_lamps_set", [vegetation.asset_collection("prop.lamp_post", proxy_lamp)])
    lamps = [(l[0], l[1], rr.uniform(0, 2 * math.pi)) for l in (diorama.get("lamps") or [])] if diorama else []
    for l in spec.get("entourage", {}).get("lamps", []): lamps.append((l[0], l[1], math.radians(l[2] if len(l) > 2 else 0)))
    n_lamps += _place_instances("av_lamp", lamps, lamp_col)
    # benches and bins near the entrance
    bench = vegetation.variants("av_bench_set", [vegetation.asset_collection("prop.bench")]); binc = vegetation.variants("av_bin_set", [vegetation.asset_collection("prop.bin")])
    for b in spec.get("entourage", {}).get("benches", []): _place_instances("av_bench", [(b[0], b[1], math.radians(b[2] if len(b) > 2 else 0))], bench)
    for b in spec.get("entourage", {}).get("bins", []): _place_instances("av_bin", [(b[0], b[1], 0)], binc)
    log(f"entourage: {n_cars} cars, {n_people} people, {n_lamps} lamp posts")
    vegetation.finish_assets()
