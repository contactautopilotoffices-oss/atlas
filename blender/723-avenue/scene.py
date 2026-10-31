"""723 Avenue, Marol: orbit render set-up for Blender.

Run it in Blender after Google's Photorealistic 3D Tiles are imported with the
Blosm add-on (Scripting workspace, open this file, Run Script). It:

  * finds the roof of 723 Avenue at the site's coordinates and puts an
    Autopilot pin and a "723 Avenue" label above it (our own objects; nothing
    is traced from Google's mesh);
  * adds a camera that circles the building once;
  * sets a 1080p MP4 render of DURATION_S seconds, kept at 30 s or less;
  * burns the attribution into every frame.

Google's Map Tiles API policies allow promotional videos of 30 seconds or
less, with no Street View imagery, carrying Google's attribution. Copy the
exact attribution text Blosm shows for your import into ATTRIBUTION, and add
the Google logo in the edit. The imported tiles must not be exported, saved
for reuse or hosted.

Works with Blender 4.2 to 5.x.
"""
import math

import bpy

SITE_NAME = "723 Avenue"
SITE_LAT, SITE_LON = 19.109713, 72.884422  # Wadhwa 723 Avenue, Marol (plus code 4V5M+VQM)

DURATION_S = 24          # must stay at or under 30 for Google's terms
FPS = 30
ORBIT_RADIUS_M = 420
ORBIT_HEIGHT_M = 260     # above the roof
PIN_CLEARANCE_M = 25     # pin sits this far above the roof
ACCENT = (0.64, 0.31, 0.17, 1.0)  # Autopilot terracotta, #a3502c
ATTRIBUTION = "Google  |  Imagery and map data (c) 2026 Google"
OUTPUT = "//renders/723-avenue-orbit"

assert DURATION_S <= 30, "Google allows promotional videos of 30 seconds or less"
scene = bpy.context.scene


def site_xy():
    """The site's position in scene metres, from Blosm's projection origin."""
    lat0, lon0 = scene.get("lat"), scene.get("lon")
    if lat0 is None or lon0 is None:
        print("No Blosm origin on the scene: assuming the site is at the origin.")
        return 0.0, 0.0
    r = 6378137.0
    x = math.radians(SITE_LON - lon0) * r * math.cos(math.radians(lat0))
    y = math.radians(SITE_LAT - lat0) * r
    return x, y


def roof_z(x, y):
    """Height of the highest surface at (x, y), or 0 if nothing is there."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    hit, loc, *_ = scene.ray_cast(depsgraph, (x, y, 5000.0), (0.0, 0.0, -1.0))
    return loc.z if hit else 0.0


def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = ACCENT
    em.inputs["Strength"].default_value = 3.0
    m.node_tree.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


def collection(name):
    old = bpy.data.collections.get(name)
    if old:
        for ob in list(old.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def link(ob, col):
    for c in ob.users_collection:
        c.objects.unlink(ob)
    col.objects.link(ob)
    return ob


def build():
    col = collection("723 Avenue overlay")
    x, y = site_xy()
    roof = roof_z(x, y)
    top = roof + PIN_CLEARANCE_M
    mat = material("Autopilot accent")

    bpy.ops.mesh.primitive_cone_add(radius1=6, depth=18, location=(x, y, top + 9), rotation=(math.pi, 0, 0))
    pin = link(bpy.context.object, col)
    pin.name = "Pin"
    bpy.ops.mesh.primitive_uv_sphere_add(radius=8, location=(x, y, top + 22))
    head = link(bpy.context.object, col)
    head.name = "Pin head"
    bpy.ops.object.text_add(location=(x, y, top + 40))
    label = link(bpy.context.object, col)
    label.name = "Label"
    label.data.body = SITE_NAME
    label.data.align_x = "CENTER"
    label.data.size = 14
    for ob in (pin, head, label):
        ob.data.materials.append(mat)

    bpy.ops.object.empty_add(location=(x, y, roof))
    pivot = link(bpy.context.object, col)
    pivot.name = "Orbit pivot"
    bpy.ops.object.camera_add(location=(x + ORBIT_RADIUS_M, y, roof + ORBIT_HEIGHT_M))
    cam = link(bpy.context.object, col)
    cam.name = "Orbit camera"
    cam.data.lens = 35
    cam.data.clip_end = 20000
    cam.parent = pivot
    cam.matrix_parent_inverse = pivot.matrix_world.inverted()
    aim = cam.constraints.new("TRACK_TO")
    aim.target = head
    aim.track_axis = "TRACK_NEGATIVE_Z"
    aim.up_axis = "UP_Y"
    face = label.constraints.new("TRACK_TO")
    face.target = cam
    face.track_axis = "TRACK_Z"
    face.up_axis = "UP_Y"
    scene.camera = cam

    frames = DURATION_S * FPS
    scene.frame_start, scene.frame_end = 1, frames
    scene.render.fps = FPS
    pivot.rotation_euler = (0, 0, 0)
    pivot.keyframe_insert("rotation_euler", index=2, frame=1)
    pivot.rotation_euler = (0, 0, 2 * math.pi)
    pivot.keyframe_insert("rotation_euler", index=2, frame=frames + 1)
    fcurves = getattr(pivot.animation_data.action, "fcurves", None)
    if fcurves is not None:  # Blender 4.x; 5.x layered actions keep the default easing
        for fc in fcurves:
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"


def render_settings():
    r = scene.render
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            r.engine = engine
            break
        except TypeError:
            continue
    r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
    s = r.image_settings
    if hasattr(s, "media_type"):  # Blender 5.x
        s.media_type = "VIDEO"
    s.file_format = "FFMPEG"
    r.ffmpeg.format = "MPEG4"
    r.ffmpeg.codec = "H264"
    r.ffmpeg.constant_rate_factor = "HIGH"
    r.filepath = OUTPUT

    r.use_stamp = True
    for prop in dir(r):
        if prop.startswith("use_stamp_") and prop not in ("use_stamp_note", "use_stamp_labels"):
            setattr(r, prop, False)
    r.use_stamp_labels = False
    r.use_stamp_note = True
    r.stamp_note_text = ATTRIBUTION
    r.stamp_font_size = 22


build()
render_settings()
print(f"{SITE_NAME}: {DURATION_S} s orbit set up. Render > Render Animation writes {OUTPUT}.mp4")
