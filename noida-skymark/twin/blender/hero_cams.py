"""Hero still cameras for a built floor: the logo wall head on (and its reverse), plus chosen cameras from the
authored plan. Writes <out>/<t>_hero_cameras_plan.json (same shape as <t>_cameras_plan.json).
    Blender -b OUT/<t>_light.blend --python hero_cams.py -- --tenant <t> --out OUT --pick REGEX [--logo-dist 5.2]"""
import bpy, json, math, os, sys, re, argparse
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL
ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--pick', default=''); ap.add_argument('--logo-dist', type=float, default=5.2)
A = ap.parse_args(TL.script_args())
sc = bpy.context.scene; dg = bpy.context.evaluated_depsgraph_get(); plan = []
logos = [o for o in sc.objects if o.get('twin_layer') == 'LOGO']
for k, lo in enumerate(logos):
    M = lo.matrix_world; c = M.translation.copy(); n = (M.to_3x3() @ Vector((0, -1, 0))).normalized(); n.z = 0; n.normalize()
    # back off along the wall normal until 0.4 m short of whatever is behind the camera (stay in the room)
    d = A.logo_dist
    hit = sc.ray_cast(dg, Vector((c.x, c.y, 1.55)) + n * 0.3, n, distance=d + 1.0)
    if hit[0]: d = min(d, (hit[1] - Vector((c.x, c.y, 1.55))).length - 0.4)
    pos = Vector((c.x, c.y, 1.55)) + n * d
    room = lo.get('room', f'logo{k}'); slug = re.sub(r'[^a-z0-9]+', '-', room.lower()).strip('-')
    plan.append({'name': f'{A.tenant}_CAM_{slug}_logo', 'room': room, 'kind': 'hero', 'label': f'{room}: the logo wall', 'position': list(pos), 'target': [c.x, c.y, 1.45],
                 'hfov_deg': 62, 'shift_y': 0.04, 'pitch_deg': 0})
    # reverse: from 0.9 m in front of the logo wall, looking back into the room
    p2 = Vector((c.x, c.y, 1.55)) + n * 0.9 + Vector((0, 0, 0)); t2 = p2 + n * 6
    plan.append({'name': f'{A.tenant}_CAM_{slug}_reverse_hero', 'room': room, 'kind': 'hero', 'label': f'{room}: looking back from the logo wall', 'position': list(p2), 'target': [t2.x, t2.y, 1.3],
                 'hfov_deg': 75, 'shift_y': 0.05, 'pitch_deg': 0})
src = os.path.join(A.out, f'{A.tenant}_cameras_plan.json'); P = json.load(open(src)); P = P.get('cameras', P) if isinstance(P, dict) else P
if A.pick: plan += [c for c in P if re.search(A.pick, c['name'])]
json.dump({'cameras': plan}, open(os.path.join(A.out, f'{A.tenant}_hero_cameras_plan.json'), 'w'), indent=1)
print('hero cameras:', [c['name'] for c in plan])
