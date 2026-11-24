"""Fit the friend's Privilon (SM_PrivilonMumbai.glb, Nov 2026) to the Andheri pipeline's Privilon.

  Blender -b --python andheri-project/privilon-sm/fit_privilon_sm.py -- IN.glb OUT.glb [--extra 3] [--pitch 4.1] [--cut 37.0]

His model: a 3.6 m stone base, 12 typical floors at 3.143 m (13 painted on the elevations), roof about 43.7 m,
plan 82.9 x 31.85 m. The glass is one full-height panel per bay carrying a painted elevation image.
Ours (deck and developer CAD): G+15 at 4.1 m typical floors, floor plate 22.4 x 67.3 m.

  1. EXTRA floors are added at CUT (high on the tower, above the step in the fin zones): everything above goes
     up by EXTRA floors, faces inside the band below the cut are copied into the gap, and full-height panels
     and fins stretch over it;
  2. the same floors are added to the painted images: the pixel band for those floors is copied in, and the
     glass is re-mapped (v from height), so painted floors stay on the modelled slabs;
  3. the height is scaled so a typical floor is PITCH m, and the plan to the CAD plate (67.3 x 22.4 m).
Materials are kept as he made them."""
import bpy, bmesh, sys, numpy as np
A = sys.argv[sys.argv.index("--") + 1:]
IN, OUT = A[0], A[1]
opt = lambda k, d: type(d)(A[A.index(k) + 1]) if k in A else d
EXTRA, PITCH, ZC = opt("--extra", 3), opt("--pitch", 4.1), opt("--cut", 37.0)
SRC_PITCH, LONG, SHORT = 3.1433, 67.3, 22.4
D = EXTRA * SRC_PITCH; eps = 0.02

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
o = [x for x in bpy.data.objects if x.type == "MESH"][0]; me = o.data
bm = bmesh.new(); bm.from_mesh(me); uvl = bm.loops.layers.uv.active

# painted materials: their image and the linear v(z) of their projection
painted = {}
for i, m in enumerate(me.materials):
    tex = [n for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]
    if not tex: continue
    Z = []; V = []
    for f in bm.faces:
        if f.material_index == i:
            for l in f.loops: Z.append(l.vert.co.z); V.append(l[uvl].uv.y)
    a, b = np.polyfit(Z, V, 1); err = np.abs(np.polyval([a, b], Z) - V).max()
    painted[i] = dict(img=tex[0].image, a=a, b=b)
    print(f"FIT {m.name}: v = {a:.5f} z + {b:.4f} (max err {err:.4f}), image {tex[0].image.name} {tuple(tex[0].image.size)}")

# 1. geometry
band = [f for f in bm.faces if all(ZC - D - eps <= v.co.z <= ZC + eps for v in f.verts)]
crossing = {}
for f in bm.faces:
    zs = [v.co.z for v in f.verts]
    if min(zs) < ZC - eps and max(zs) > ZC + eps: n = me.materials[f.material_index].name; crossing[n] = crossing.get(n, 0) + 1
for v in bm.verts:
    if v.co.z > ZC + eps: v.co.z += D
dup = bmesh.ops.duplicate(bm, geom=band)
bmesh.ops.translate(bm, verts=[e for e in dup["geom"] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0, D))
print(f"FIT {len(band)} faces copied up, stretched across the cut: {crossing}")

# 2. images: copy the band's pixel rows in, then re-map v (Blender rows run bottom-up)
done = {}
for i, P in painted.items():
    im = P["img"]; W, H = im.size
    if im.name not in done:
        px = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)
        r0, r1 = int(round((P["a"] * (ZC - D) + P["b"]) * H)), int(round((P["a"] * ZC + P["b"]) * H))
        new = np.concatenate([px[:r1], px[r0:r1], px[r1:]], axis=0)
        im.scale(W, new.shape[0]); im.pixels.foreach_set(new.ravel()); im.update(); im.pack()
        done[im.name] = (H, new.shape[0], r1 - r0)
        print(f"FIT image {im.name}: rows {r0}-{r1} copied, {H} -> {new.shape[0]} px")
    H0, H1, hb = done[im.name]
    for f in bm.faces:
        if f.material_index != i: continue
        for l in f.loops:
            z = l.vert.co.z
            p = (P["a"] * z + P["b"]) * H0 if z <= ZC + eps else (P["a"] * (z - D) + P["b"]) * H0 + hb
            l[uvl].uv.y = p / H1

# 3. scale to the deck and the CAD plate
xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]
sx, sy, sz = LONG / (max(xs) - min(xs)), SHORT / (max(ys) - min(ys)), PITCH / SRC_PITCH
cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
for v in bm.verts: v.co.x = (v.co.x - cx) * sx; v.co.y = (v.co.y - cy) * sy; v.co.z *= sz
bm.normal_update(); bm.to_mesh(me); bm.free(); me.update()
zs = [v.co.z for v in me.vertices]
print(f"FIT scale x{sx:.3f} y{sy:.3f} z{sz:.3f}; height {max(zs):.1f} m; G+{12 + EXTRA}; verts {len(me.vertices)}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_image_format="JPEG", export_image_quality=90)
