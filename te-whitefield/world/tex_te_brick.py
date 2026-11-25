"""The Rhapsody tower facade for the dollhouse: Total Environment's brick, as the sales model shows the township towers.

  .w3d/bin/python te-whitefield/world/tex_te_brick.py ASSET_DIR TEX_DIR

One tileable module 6 m wide and 12 m tall (four 3 m storeys) at 128 px a metre, like scripts/world/textures.py:
brick piers from the Poly Haven scan large_red_bricks (CC0, about 1.8 m a tile, tinted to the street photograph's
red-brown), and on every storey a recessed window band with a planted balcony ledge in front of it.
Writes te_brick.jpg (colour) and te_brick_r.jpg (roughness); scripts/world/normals.py makes te_brick_n.jpg.
"""
import os, sys, random
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ASSETS, OUT = sys.argv[1], sys.argv[2]
PX, W, H, ST = 128, 6.0, 12.0, 3.0
w, h = int(W * PX), int(H * PX)
rnd = random.Random(5)

scan = Image.open(os.path.join(ASSETS, "brick_b_diff_2k.jpg")).convert("RGB")
tile = int(1.8 * PX); scan = scan.resize((tile, tile), Image.LANCZOS)
brick = Image.new("RGB", (w, h))
for y in range(0, h, tile):
    for x in range(0, w, tile): brick.paste(scan, (x, y))
r, g, b = brick.split()   # tint to the deep red-brown of the street photograph
brick = Image.merge("RGB", (r.point(lambda v: int(v * 0.66)), g.point(lambda v: int(v * 0.46)), b.point(lambda v: int(v * 0.40))))

col = brick.copy(); d = ImageDraw.Draw(col)
rough = Image.new("L", (w, h), 215); dr = ImageDraw.Draw(rough)
for s in range(int(H / ST)):
    z0 = h - int((s + 1) * ST * PX)                       # top of this storey (image y grows down)
    wy0, wy1 = z0 + int(0.55 * PX), z0 + int(2.35 * PX)   # window band
    wx0, wx1 = int(0.9 * PX), int(5.1 * PX)               # brick piers either side
    d.rectangle([wx0, wy0, wx1, wy1], fill=(34, 40, 44))
    for k in range(5):                                    # mullions and a warm lit room behind some panes
        x0 = wx0 + k * (wx1 - wx0) // 5
        if rnd.random() < 0.35: d.rectangle([x0 + 6, wy0 + 10, x0 + (wx1 - wx0) // 5 - 6, wy1 - 8], fill=(112, 86, 56))
        d.rectangle([x0, wy0, x0 + 4, wy1], fill=(58, 60, 62))
    dr.rectangle([wx0, wy0, wx1, wy1], fill=40)
    # the balcony ledge: a pale slab edge with planting spilling over it
    ly = wy1 + int(0.05 * PX)
    d.rectangle([wx0 - 10, ly, wx1 + 10, ly + int(0.22 * PX)], fill=(214, 208, 198))
    for k in range(70):
        cx = rnd.randint(wx0, wx1); cy = ly + rnd.randint(-int(0.35 * PX), int(0.1 * PX)); rr = rnd.randint(6, 16)
        c = rnd.choice([(46, 78, 30), (36, 64, 24), (62, 96, 38), (30, 54, 20)])
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=c)
    dr.rectangle([wx0 - 10, ly - int(0.35 * PX), wx1 + 10, ly + int(0.22 * PX)], fill=190)
col = col.filter(ImageFilter.GaussianBlur(0.6))
col = ImageEnhance.Contrast(col).enhance(1.05)
os.makedirs(OUT, exist_ok=True)
col.save(os.path.join(OUT, "te_brick.jpg"), quality=90)
rough.filter(ImageFilter.GaussianBlur(1)).save(os.path.join(OUT, "te_brick_r.jpg"), quality=90)
print("te_brick", w, h)
