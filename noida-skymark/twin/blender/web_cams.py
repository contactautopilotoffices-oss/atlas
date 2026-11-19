"""Web viewer cameras: 1-2 level views per room, standing INSIDE the room (clear of walls, doors and furniture), each
looking across the room so the ceiling, walls and furniture all show (the viewer has no lens shift, so views are level).
The reception's first view is the logo wall from the hero plan. Writes OUT/<t>_cameras.json in the viewer's shape
({rooms: {name: [view]}}, glTF axes: [x, height, -y]).
    Blender -b OUT/<t>_geometry.blend --python web_cams.py -- --tenant <t> --out OUT --layout L.json [--hero OUT/<t>_hero_cameras_plan.json]
"""
import bpy, json, math, os, sys, re, argparse
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True); ap.add_argument('--layout', required=True)
ap.add_argument('--hero', default=''); ap.add_argument('--hfov', type=float, default=80); ap.add_argument('--eye', type=float, default=1.5)
ap.add_argument('--skip', default='SHAFT|DUCT|LIFT|TOIL|TOIELT|WASH|STORE|ELEC|UPS|SERVER|JANITOR|PANTRY STORE|STAIR|Shaft or duct')
A = ap.parse_args(TL.script_args()); sc = bpy.context.scene; dg = bpy.context.evaluated_depsgraph_get(); L = json.load(open(A.layout))
old = os.path.join(A.out, f'{A.tenant}_cameras.json'); prev = json.load(open(old)) if os.path.exists(old) else {}
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
FURN = ('TABLE', 'DESK', 'SEAT', 'FEATURE', 'LOGO', 'PLANT')
def views(r, clear=0.45, tol=0.35, near_min=1.0):
    P = r['poly']; xs = [p[0] for p in P]; ys = [p[1] for p in P]; area = abs(sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))) / 2
    st = max(0.25, math.sqrt(area) / 14); cands = []
    x = min(xs) + st / 2
    while x < max(xs):
        y = min(ys) + st / 2
        while y < max(ys):
            if inpoly(x, y, P) and edist(x, y, P) >= min(0.5, clear + 0.05):
                o = Vector((x, y, A.eye))
                near = [sc.ray_cast(dg, Vector((x, y, h)), Vector((math.cos(t), math.sin(t), 0)), distance=clear)[0] for h in ((1.0, A.eye) if clear < 0.45 else (0.5, 1.0, A.eye)) for t in [i * math.pi / 4 for i in range(8)]]
                if not any(near):           # nothing within 0.45 m: not in a door leaf, wall, plant or chair
                    for h_ in range(16):
                        yaw = 2 * math.pi * h_ / 16; ok = True; depth = []; furn = 0; ceil = 0
                        for k in range(9):
                            a = yaw + math.radians(A.hfov) * (k / 8 - 0.5)
                            hit, p, n, i, ob, M = sc.ray_cast(dg, o, Vector((math.cos(a), math.sin(a), 0)), distance=40)
                            if not hit: ok = False; break
                            dist = (p - o).length; depth.append(dist)
                            if dist < near_min or not (inpoly(p.x, p.y, P) or edist(p.x, p.y, P) < tol): ok = False; break
                            for pitch, cnt in ((-0.35, 'f'), (0.3, 'c')):
                                d = Vector((math.cos(a) * math.cos(pitch), math.sin(a) * math.cos(pitch), math.sin(pitch)))
                                h2 = sc.ray_cast(dg, o, d, distance=40)
                                if h2[0] and cnt == 'f' and h2[4].get('twin_layer') in FURN: furn += 1
                                if h2[0] and cnt == 'c' and h2[4].get('twin_layer') in ('CEILING', 'LIGHT', 'HVAC'): ceil += 1
                        if ok and depth:
                            s_ = sum(depth) / len(depth) + 0.5 * min(depth) + 0.3 * furn + 0.15 * ceil
                            cands.append((s_, (x, y), yaw, furn, ceil, sum(depth) / len(depth)))
            y += st
        x += st
    cands.sort(key=lambda c: -c[0]); out = []
    for c in cands:
        if all(abs(((c[2] - u[2] + math.pi) % (2 * math.pi)) - math.pi) > math.radians(100) or math.hypot(c[1][0] - u[1][0], c[1][1] - u[1][1]) > 2.5 for u in out): out.append(c)
        if len(out) == 2: break
    return out, len(cands)
rooms = {}; log = {}
hero = json.load(open(A.hero))['cameras'] if A.hero and os.path.exists(A.hero) else []
for r in L['rooms']:
    if re.search(A.skip, r['name'], re.I) or not r.get('poly'): continue
    if prev and r['name'] not in prev.get('rooms', {}): continue
    vs, n = views(r)
    if not vs: vs, n = views(r, clear=0.3, tol=0.8, near_min=0.8)          # a crowded room (a seating cluster): looser clearance, chairs below eye level
    lst = []
    for c in hero:
        if c.get('room') == r['name'] and c['name'].endswith('_logo'):
            p_, t_ = c['position'], c['target']; lst.append({'kind': 'entry', 'position': [p_[0], 1.5, -p_[1]], 'target': [t_[0], 1.6, -t_[1]], 'hfov_deg': 70, 'room': r['name'], 'label': f"{r['name'].title()}: logo wall", 'name': c['name']})
    for j, (s_, (x, y), yaw, furn, ceil, md) in enumerate(vs):
        t = (x + 6 * math.cos(yaw), y + 6 * math.sin(yaw)); kind = ('entry', 'feature', 'reverse')[min(2, len(lst))]
        lst.append({'kind': kind, 'position': [round(x, 3), A.eye, round(-y, 3)], 'target': [round(t[0], 3), A.eye, round(-t[1], 3)], 'hfov_deg': A.hfov, 'room': r['name'],
                    'label': f"{r['name'].title()}: {kind}", 'name': f"{A.tenant}_WEB_{re.sub(r'[^a-z0-9]+', '-', r['name'].lower()).strip('-')}_{kind}"})
    if lst: rooms[r['name']] = lst
    log[r['name']] = {'views': len(lst), 'candidates': n}
    print('web_cams:', r['name'], len(lst), 'views from', n, 'candidates', flush=True)
outj = dict(prev); outj['rooms'] = rooms; outj['about_views'] = 'web views: level, inside the room, clear of walls/doors/furniture by 0.45 m (web_cams.py)'
json.dump(outj, open(old, 'w'), indent=1); json.dump(log, open(os.path.join(A.out, f'{A.tenant}_web_cams_log.json'), 'w'), indent=1); print('wrote', old, flush=True)
