"""Fleet House (friend's model, "Fleet Building Andheri.glb", Nov 2026): stop the facade flicker, and lighten the file.

  Blender -b --python andheri-project/privilon-sm/fix_fleet_house.py -- IN.glb OUT.glb [--lift 0.03]

The three painted elevations (boulevard, service, stair and west return) are overlays only 1-2 mm in front of
equal-sized modelled panels and bands, so at a distance the browser cannot tell which is in front and the triangles
flicker (z-fighting, worse with the explorer's 0.3-6000 m depth range). The painted faces are moved LIFT m further out
along their normals, so the painting always wins, as he intended. Textures are written as JPEG."""
import bpy, bmesh, sys
A = sys.argv[sys.argv.index("--") + 1:]
IN, OUT = A[0], A[1]
LIFT = float(A[A.index("--lift") + 1]) if "--lift" in A else 0.03
PAINTED = {"Boulevard glazing and sandstone", "Service elevation and brise soleil", "Stair enclosure and west return"}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
o = [x for x in bpy.data.objects if x.type == "MESH"][0]; me = o.data
idx = {i for i, m in enumerate(me.materials) if m and m.name in PAINTED}
bm = bmesh.new(); bm.from_mesh(me)
faces = [f for f in bm.faces if f.material_index in idx]
edges = list({e for f in faces for e in f.edges if any(g.material_index not in idx for g in e.link_faces)})
bmesh.ops.split_edges(bm, edges=edges)                       # detach the painted faces from the modelled detail
moved = {}
for f in faces:
    for v in f.verts: moved.setdefault(v, []).append(f.normal.copy())
for v, ns in moved.items():                                  # each vertex goes out along its faces' mean normal
    n = sum(ns, ns[0] * 0); n.normalize(); v.co += n * LIFT
bm.normal_update(); bm.to_mesh(me); bm.free(); me.update()
print(f"FIX {len(faces)} painted faces lifted {LIFT} m ({len(edges)} edges split)")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_image_format="JPEG", export_image_quality=90)
