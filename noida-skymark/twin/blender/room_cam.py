"""In-room hero camera for small rooms (meeting rooms, cabins): stands INSIDE the room, in a corner, looking across
the table to the far side, so the frame is the room (not a door leaf or the hall behind the glass).

    Blender -b OUT/<t>_light.blend --python room_cam.py -- --tenant <t> --out OUT --rooms "MEETING ROOM \\(1\\)|CABIN \\(1\\)" --layout L.json [--merge OUT/<t>_hero_cameras_plan.json]

Candidate positions on a 0.25 m grid inside the room outline (0.45 m off it) at 1.45 m eye height, 24 headings each.
A fan of rays across the 75 degree view at eye height and at 20 degrees down must stay in the room (every hit
inside the outline + 0.2 m, nearest hit at least 1.2 m away) and the score is the furniture (tables, desks, seats)
the lower fan sees plus the mean depth. Writes the winners into the hero plan (replacing a camera of the same room).
"""
import bpy, json, math, os, sys, re, argparse
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True); ap.add_argument('--rooms', required=True)
ap.add_argument('--layout', required=True); ap.add_argument('--merge', default=''); ap.add_argument('--hfov', type=float, default=75); ap.add_argument('--eye', type=float, default=1.45); ap.add_argument('--tol', type=float, default=0.2); ap.add_argument('--aim-layer', default=''); ap.add_argument('--min-near', type=float, default=1.2)
A = ap.parse_args(TL.script_args())
sc = bpy.context.scene; dg = bpy.context.evaluated_depsgraph_get(); L = json.load(open(A.layout))
def inpoly(x, y, P):
    c = False
    for i in range(len(P)):
        (x1, y1), (x2, y2) = P[i], P[(i + 1) % len(P)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def edist(x, y, P):
    d = 1e9
    for i in range(len(P)):
        (x1, y1), (x2, y2) = P[i], P[(i + 1) % len(P)]; dx, dy = x2 - x1, y2 - y1; l2 = dx * dx + dy * dy or 1e-9
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / l2)); d = min(d, math.hypot(x - x1 - t * dx, y - y1 - t * dy))
    return d
FURN = ('TABLE', 'DESK', 'SEAT', 'FEATURE', 'LOGO')
out = []
for r in L['rooms']:
    if not re.search(A.rooms, r['name']): continue
    P = r['poly']; xs = [p[0] for p in P]; ys = [p[1] for p in P]; best = None
    x = min(xs)
    while x <= max(xs):
        y = min(ys)
        while y <= max(ys):
            if inpoly(x, y, P) and edist(x, y, P) >= 0.45:
                o = Vector((x, y, A.eye))
                if not sc.ray_cast(dg, o + Vector((0, 0, 0.3)), Vector((0, 0, -1)), distance=0.25)[0]:      # not standing in furniture
                    for h in range(24):
                        yaw = 2 * math.pi * h / 24; ok = True; depth = []; furn = 0
                        for pitch in (0.0, -0.35):
                            for k in range(9):
                                a = yaw + math.radians(A.hfov) * (k / 8 - 0.5); d = Vector((math.cos(a) * math.cos(pitch), math.sin(a) * math.cos(pitch), math.sin(pitch)))
                                hit, p, n, i, ob, M = sc.ray_cast(dg, o, d, distance=30)
                                if not hit: ok = False; break
                                if pitch == 0.0:
                                    dist = (p - o).length; depth.append(dist)
                                    if dist < A.min_near or not (inpoly(p.x, p.y, P) or edist(p.x, p.y, P) < A.tol): ok = False; break
                                    if A.aim_layer and k == 4 and ob.get('twin_layer') != A.aim_layer: ok = False; break     # the centre of the frame must be the feature wall
                                elif ob.get('twin_layer') in FURN: furn += 1
                            if not ok: break
                        if ok:
                            sc_ = 0.25 * furn + sum(depth) / len(depth) + 0.5 * min(depth)
                            if best is None or sc_ > best[0]: best = (sc_, o.copy(), yaw, furn, sum(depth) / len(depth))
            y += 0.25
        x += 0.25
    slug = re.sub(r'[^a-z0-9]+', '-', r['name'].lower()).strip('-')
    if not best: print('room_cam: no inside view for', r['name'], flush=True); continue
    s_, o, yaw, furn, md = best; t = o + Vector((math.cos(yaw), math.sin(yaw), 0)) * 3 + Vector((0, 0, -0.35))
    out.append({'name': f'{A.tenant}_CAM_{slug}_inside', 'room': r['name'], 'room_slug': slug, 'kind': 'hero', 'label': f"{r['name'].title()}: inside",
                'position': [round(v, 3) for v in o], 'target': [round(v, 3) for v in t], 'hfov_deg': A.hfov, 'shift_y': -0.08, 'pitch_deg': 0,
                'checks': {'furniture_rays': furn, 'mean_depth_m': round(md, 2)}, 'from': 'inside, corner', 'aim': 'across the table'})
    print('room_cam:', r['name'], out[-1]['position'], round(math.degrees(yaw)), 'furniture', furn, 'depth', round(md, 2), flush=True)
dst = A.merge or os.path.join(A.out, f'{A.tenant}_room_cameras_plan.json')
plan = json.load(open(dst))['cameras'] if A.merge and os.path.exists(A.merge) else []
rooms = {c['room'] for c in out}; plan = [c for c in plan if c.get('room') not in rooms or c.get('kind') not in ('entry', 'hero')] + out
json.dump({'cameras': plan}, open(dst, 'w'), indent=1); print('wrote', dst, len(plan), flush=True)
