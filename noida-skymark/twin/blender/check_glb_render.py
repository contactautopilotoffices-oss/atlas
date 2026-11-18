"""Render the EXPORTED web GLB (not the .blend) from named cameras, to look at what the viewer gets.
   Blender -b --python check_glb_render.py -- <tenant> <out> <glb> "<camera regex>"   -> <out>/review/glb_<camera>.png
EEVEE, a plain grey world + sun; lightmapped meshes shown with their lightmap multiplied in, like the viewer."""
import bpy, sys, os, json, math, re
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import twin_lib as TL
T, OUT, GLB, RX = TL.script_args()[:4]
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
man = json.load(open(os.path.join(os.path.dirname(GLB), f"{T}_viewer.json")))
lm = man["lightmapped_meshes"]["nodes"]
for o in list(sc.objects):
    if o.get("collision"): o.hide_render = True
    ud = lm.get(o.name) or (lm.get(o.parent.name) if o.parent else None)
    if o.type == "MESH" and ud and len(o.data.uv_layers) > 1:      # unlit: albedo x lightmap x intensity / pi (the viewer's rule)
        img = bpy.data.images.load(os.path.join(os.path.dirname(GLB), ud["lightmap"]), check_existing=True)
        for i, m in enumerate(o.data.materials):
            mm = m.copy(); nt = mm.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"); out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
            uv = nt.nodes.new("ShaderNodeUVMap"); uv.uv_map = o.data.uv_layers[1].name; tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = img; nt.links.new(uv.outputs[0], tx.inputs[0])
            mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1
            bc = b.inputs["Base Color"]
            if bc.is_linked: nt.links.new(bc.links[0].from_socket, mx.inputs[6])
            else: mx.inputs[6].default_value = bc.default_value
            nt.links.new(tx.outputs[0], mx.inputs[7]); em = nt.nodes.new("ShaderNodeEmission"); em.inputs[1].default_value = ud["lightMapIntensity"] / math.pi
            nt.links.new(mx.outputs[2], em.inputs[0]); nt.links.new(em.outputs[0], out.inputs[0]); o.data.materials[i] = mm
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.6, 0.6, 0.62, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.render.engine = "BLENDER_EEVEE"; sc.render.resolution_x, sc.render.resolution_y = 960, 540
sc.view_settings.view_transform = "AgX"; sc.view_settings.exposure = man["renderer"]["exposure_ev"]
cams = json.load(open(os.path.join(OUT, f"{T}_cameras.json")))["rooms"]
os.makedirs(os.path.join(OUT, "review"), exist_ok=True)
for room, vs in cams.items():
    for c in vs:
        if not re.search(RX, c["name"]): continue
        p = Vector(c["position"]); t = Vector(c["target"])          # glTF frame already = Blender's import frame after Y-up conversion
        P = Vector((p.x, -p.z, p.y)); Tg = Vector((t.x, -t.z, t.y))
        cam = bpy.data.objects.new(c["name"], bpy.data.cameras.new(c["name"])); sc.collection.objects.link(cam); sc.camera = cam
        cam.data.sensor_fit = "HORIZONTAL"; cam.data.lens = 18 / math.tan(math.radians(c["hfov_deg"]) / 2); cam.location = P
        cam.rotation_euler = (Tg - P).to_track_quat("-Z", "Y").to_euler(); cam.data.clip_start = 0.05
        sc.render.filepath = os.path.join(OUT, "review", f"glb_{c['name']}.png"); bpy.ops.render.render(write_still=True); print("rendered", sc.render.filepath)
