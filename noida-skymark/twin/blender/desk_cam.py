"""Hero camera for a cabin: from the far side of the desk, looking over it at the feature wall behind it.
    Blender -b OUT/<t>_light.blend --python desk_cam.py -- --tenant <t> --room "CABIN \\(2\\)" --layout L.json --merge OUT/<t>_hero_cameras_plan.json
The desk is the biggest TABLE/DESK in the room outline and the feature wall the nearest FEATURE object to it. The camera
backs off from the desk along (desk - feature wall) until 0.3 m short of the first thing behind it, at 1.45 m eye
height, aimed at a point between the desk top and the feature wall (hfov 80, so the desk and the wall both show)."""
import bpy, json, math, os, sys, re, argparse
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--room', required=True); ap.add_argument('--layout', required=True)
ap.add_argument('--merge', required=True); ap.add_argument('--hfov', type=float, default=80)
A = ap.parse_args(TL.script_args()); sc = bpy.context.scene; dg = bpy.context.evaluated_depsgraph_get(); L = json.load(open(A.layout))
r = next(r for r in L['rooms'] if re.search(A.room, r['name'])); P = r['poly']
def inpoly(x, y):
    c = False
    for i in range(len(P)):
        (x1, y1), (x2, y2) = P[i], P[(i + 1) % len(P)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def centre(o):
    bb = [o.matrix_world @ Vector(b) for b in o.bound_box]; return sum(bb, Vector()) / 8, bb
desks = []; feats = []
for o in sc.objects:
    if o.type != 'MESH' or o.get('twin_layer') not in ('TABLE', 'DESK', 'FEATURE'): continue
    c, bb = centre(o)
    if not inpoly(c.x, c.y): continue
    a = (max(b.x for b in bb) - min(b.x for b in bb)) * (max(b.y for b in bb) - min(b.y for b in bb))
    (feats if o.get('twin_layer') == 'FEATURE' else desks).append((a, c, o.name))
desk = max(desks)[1]; feat = min(feats, key=lambda f: (f[1] - desk).length)[1] if feats else None
d = (desk - feat) if feat else Vector((1, 0, 0)); d.z = 0; d.normalize()
o = Vector((desk.x, desk.y, 1.45)); hit = sc.ray_cast(dg, o + d * 0.6, d, distance=6)
back = ((hit[1] - o).length - 0.3) if hit[0] else 3.0
pos = o + d * back; tgt = Vector((desk.x, desk.y, 0.75)) * 0.5 + Vector(((feat or desk).x, (feat or desk).y, 1.3)) * 0.5
slug = re.sub(r'[^a-z0-9]+', '-', r['name'].lower()).strip('-')
cam = {'name': f'{A.tenant}_CAM_{slug}_desk', 'room': r['name'], 'room_slug': slug, 'kind': 'hero', 'label': f"{r['name'].title()}: desk and feature wall",
       'position': [round(v, 3) for v in pos], 'target': [round(v, 3) for v in tgt], 'hfov_deg': A.hfov, 'shift_y': -0.12, 'pitch_deg': 0, 'from': 'behind the visitor chairs', 'aim': 'desk and feature wall'}
H = json.load(open(A.merge)); H['cameras'] = [c for c in H['cameras'] if c['name'] != cam['name']] + [cam]; json.dump(H, open(A.merge, 'w'), indent=1)
print('desk_cam:', r['name'], 'desk', [round(v, 2) for v in desk], 'feature', feat and [round(v, 2) for v in feat], 'back', round(back, 2), cam['position'], flush=True)
