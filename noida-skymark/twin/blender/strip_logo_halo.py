"""Remove the halo plate (faces with the logo halo material) from the logo objects of a built .blend and save it.
Used to correct a model already baked with a visible halo plate (rtp6-a, 19 Nov 2026) without a second bake.
    Blender -b OUT/<t>_baked.blend --python strip_logo_halo.py -- --material logo_halo"""
import bpy, bmesh, sys
mat = sys.argv[sys.argv.index('--material') + 1] if '--material' in sys.argv else 'logo_halo'
n = 0
for o in bpy.data.objects:
    if o.type != 'MESH' or o.get('twin_layer') != 'LOGO': continue
    idx = [i for i, m in enumerate(o.data.materials) if m and m.name.startswith(mat)]
    if not idx: continue
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = [f for f in bm.faces if f.material_index in idx]; n += len(kill)
    bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(o.data); bm.free(); o.data.update()
print('halo faces removed:', n); bpy.ops.wm.save_mainfile()
