"""Facade textures for House of Wadhwa 723 Avenue, from the reference image.

  python scripts/world/tex_723.py TEX_DIR

glass723      the tower's curtain wall behind the fins: dark blue-grey glass, one
              storey (4.1 m) per tile, a slab band at the floor line and a faint
              lit interior so the glass has depth.
retail723     the ground floor "High Street Retail" front: tall glass bays in a
              dark frame, the glass printed with the pastel mosaic seen in the
              image, a transom and a dark base.
Each gets a roughness map (_r): dark where it is glass, so the page and Blender
make those parts reflect. Run scripts/world/normals.py on the folder after.
"""
import os, sys, random
from PIL import Image, ImageDraw, ImageFilter

D = sys.argv[1]
rr = random.Random(723)

# --- curtain wall: 6 m x 4.1 m per tile, 512 x 350 px ---
W, H = 512, 350
im = Image.new("RGB", (W, H)); r = Image.new("L", (W, H), 30)
px, dr = ImageDraw.Draw(im), ImageDraw.Draw(r)
for y in range(H):   # sky reflection: lighter at the top of each pane
    t = y / H
    px.line([(0, y), (W, y)], fill=(int(58 - 22 * t), int(74 - 24 * t), int(92 - 26 * t)))
for i in range(10):   # faint interior: ceiling lights and desks behind the glass
    x0 = rr.randint(0, W - 60); px.rectangle([x0, 46, x0 + rr.randint(30, 90), 52], fill=(96, 104, 112))
slab = int(H * 0.86)
px.rectangle([0, slab, W, H], fill=(34, 38, 44)); dr.rectangle([0, slab, W, H], fill=150)   # the slab edge band
im = im.filter(ImageFilter.GaussianBlur(0.6))
im.save(os.path.join(D, "glass723.jpg"), quality=90); r.save(os.path.join(D, "glass723_r.jpg"), quality=90)

# --- retail front: 7.2 m x 5.6 m per tile (three 2.4 m bays), 600 x 466 px ---
W, H = 600, 466
im = Image.new("RGB", (W, H), (30, 33, 36)); r = Image.new("L", (W, H), 170)
px, dr = ImageDraw.Draw(im), ImageDraw.Draw(r)
PAL = [(236, 170, 182), (168, 210, 222), (244, 214, 150), (190, 222, 176), (214, 186, 230), (250, 236, 220), (150, 196, 236), (240, 196, 160)]
bay, frame = W // 3, 8
base, transom = int(H * 0.95), int(H * 0.60)
for b in range(3):
    x0, x1 = b * bay + frame, (b + 1) * bay - frame
    for (y0, y1) in ((frame, transom - frame // 2), (transom + frame // 2, base)):
        cell = 26
        for yy in range(y0, y1, cell):        # the printed mosaic on the glass
            for xx in range(x0, x1, cell):
                c = rr.choice(PAL); k = rr.uniform(0.82, 1.0)
                px.rectangle([xx, yy, min(x1, xx + cell - 2), min(y1, yy + cell - 2)], fill=tuple(int(v * k) for v in c))
        dr.rectangle([x0, y0, x1, y1], fill=24)
px.rectangle([0, base, W, H], fill=(46, 48, 50))
im = im.filter(ImageFilter.GaussianBlur(0.8))
im.save(os.path.join(D, "retail723.jpg"), quality=90); r.save(os.path.join(D, "retail723_r.jpg"), quality=90)
print("723 textures in", D)
