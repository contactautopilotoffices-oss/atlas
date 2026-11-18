"""G2 clay views: grey Workbench renders (no Cycles, so no render lock) of a built floor.

    Blender -b OUT/<t>_geometry.blend --python clay_views.py -- --tenant <t> --out OUT [--cameras OUT/<t>_cameras_plan.json] [--max 8]

Renders a top view of the whole floor (orthographic, ceilings hidden so the furniture shows) and eye-level views
from the authored cameras (or, before the cameras stage, from the reception and the largest work hall), every
material shown as plain grey clay with cavity shading, so geometry faults (floating, sunk, missing pieces,
doubled surfaces) are what you see. Writes OUT/review/clay_*.png and OUT/<t>_clay_views.json.
"""
import bpy, json, math, os, sys, argparse
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import twin_lib as TL

ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--cameras', default=''); ap.add_argument('--max', type=int, default=8); ap.add_argument('--res', default='1600x900')
A = ap.parse_args(TL.script_args())
sc = bpy.context.scene; os.makedirs(os.path.join(A.out, 'review'), exist_ok=True)
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.72, 0.72, 0.70)
sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.show_shadows = True; sh.shadow_intensity = 0.35; sh.show_object_outline = False
sc.display.render_aa = '8'
w, h = map(int, A.res.split('x')); sc.render.resolution_x, sc.render.resolution_y = w, h; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
for o in sc.objects:
    if o.get('twin_layer') == 'CONTEXT' or o.type == 'LIGHT': o.hide_render = True
out = {'views': []}
def shoot(cam, path):
    sc.camera = cam; sc.render.filepath = path; bpy.ops.render.render(write_still=True); out['views'].append(os.path.basename(path))
# top view: hide ceilings, soffit, lights, HVAC
hidden = [o for o in sc.objects if o.get('twin_layer') in ('CEILING', 'LIGHT', 'HVAC', 'SOFFIT') or 'soffit' in o.name.lower() or 'slababove' in o.name.lower()]
for o in hidden: o.hide_render = True
xs, ys = [], []
for o in sc.objects:
    if o.type == 'MESH' and o.get('twin_layer') in ('FLOOR', 'SLAB'):
        for c in o.bound_box: p = o.matrix_world @ Vector(c); xs.append(p.x); ys.append(p.y)
if xs:
    cd = bpy.data.cameras.new('clay_top'); cd.type = 'ORTHO'; span = max(max(xs) - min(xs), (max(ys) - min(ys)) * w / h) * 1.04; cd.ortho_scale = span; cd.clip_end = 200
    ct = bpy.data.objects.new('clay_top', cd); sc.collection.objects.link(ct); ct.location = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, 60); ct.rotation_euler = (0, 0, 0)
    shoot(ct, os.path.join(A.out, 'review', 'clay_top.png'))
for o in hidden: o.hide_render = False
# eye-level views
cams = []
cp = A.cameras or os.path.join(A.out, f'{A.tenant}_cameras_plan.json')
if os.path.exists(cp):
    plan = json.load(open(cp)); plan = plan.get('cameras', plan) if isinstance(plan, dict) else plan
    pri = {'entry': 0, 'feature': 1, 'reverse': 2, 'detail': 3}
    cams = sorted([c for c in plan if isinstance(c, dict) and 'position' in c], key=lambda c: (pri.get(c.get('kind'), 9), c.get('room', '')))
else:
    cams = [o for o in sc.objects if o.type == 'CAMERA' and not o.name.startswith('clay')]
n = 0
for c in cams:
    if n >= A.max: break
    if isinstance(c, dict):
        cd = bpy.data.cameras.new('clay'); cd.lens_unit = 'FOV'; cd.angle = math.radians(c.get('hfov_deg', 75)); cd.shift_y = c.get('shift_y', 0.0); cd.clip_start = 0.1
        co = bpy.data.objects.new('clay_cam', cd); sc.collection.objects.link(co); co.location = Vector(c['position'])
        d = Vector(c['target']) - Vector(c['position']); d.z = 0; co.rotation_euler = (math.pi / 2, 0, math.atan2(d.y, d.x) - math.pi / 2)
        name = c.get('name', f'cam{n}')
    else:
        co = c; name = c.name
    shoot(co, os.path.join(A.out, 'review', f'clay_{n:02d}_{name.replace(" ", "_")[:60]}.png')); n += 1
json.dump(out, open(os.path.join(A.out, f'{A.tenant}_clay_views.json'), 'w'), indent=1)
print('clay views:', out['views'], flush=True)
