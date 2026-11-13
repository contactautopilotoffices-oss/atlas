"""Facade skins for the Flipkart Andheri East options, one storey (4.1 m) per tile, 6 m wide.

  python scripts/world/tex_facades.py TEX_DIR

cw_<name>      a curtain wall: glass with a sky gradient and a faint lit interior, a spandrel
               band at the slab line. Tints: teal (blue-green), blue, grey, silver.
ribbon_<name>  ribbon windows: a band of glass between solid cladding at every floor
               (red ACP for Landmark, white ACP for Vaman Techno Centre).
Each gets a roughness map (_r): dark where it is glass, so the page and Blender make it reflect.
Run scripts/world/normals.py on the new files after.
"""
import os, sys, random
from PIL import Image, ImageDraw, ImageFilter

D = sys.argv[1]
W, H = 512, 350   # 6 m x 4.1 m

def glass(px, y0, y1, top, bot, rr, lights=True):
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0)
        px.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bot)))
    if lights:
        for _ in range(9):
            x0 = rr.randint(0, W - 70); yy = y0 + int((y1 - y0) * 0.14)
            px.rectangle([x0, yy, x0 + rr.randint(30, 90), yy + 5], fill=tuple(min(255, c + 34) for c in top))

CW = {"teal": ((92, 128, 132), (40, 66, 72), (52, 62, 66)),
      "blue": ((88, 112, 140), (34, 50, 72), (44, 52, 62)),
      "grey": ((120, 128, 134), (58, 64, 70), (70, 74, 78)),
      "silver": ((150, 160, 168), (86, 96, 104), (196, 198, 200))}
for name, (top, bot, spandrel) in CW.items():
    rr = random.Random(name)
    im = Image.new("RGB", (W, H)); r = Image.new("L", (W, H), 28); px, dr = ImageDraw.Draw(im), ImageDraw.Draw(r)
    slab = int(H * 0.84)
    glass(px, 0, slab, top, bot, rr)
    px.rectangle([0, slab, W, H], fill=spandrel); dr.rectangle([0, slab, W, H], fill=120)
    im.filter(ImageFilter.GaussianBlur(0.6)).save(os.path.join(D, f"cw_{name}.jpg"), quality=90); r.save(os.path.join(D, f"cw_{name}_r.jpg"), quality=90)

RIB = {"red": ((176, 52, 46), (90, 122, 128), (38, 62, 70)),     # red ACP, blue-green glass
       "white": ((232, 232, 228), (96, 124, 150), (40, 58, 82))}   # white ACP, blue glass
for name, (acp, top, bot) in RIB.items():
    rr = random.Random(name)
    im = Image.new("RGB", (W, H), acp); r = Image.new("L", (W, H), 150); px, dr = ImageDraw.Draw(im), ImageDraw.Draw(r)
    g0, g1 = int(H * 0.18), int(H * 0.72)
    glass(px, g0, g1, top, bot, rr)
    dr.rectangle([0, g0, W, g1], fill=26)
    for x in range(0, W, W // 4):   # window mullions
        px.rectangle([x, g0, x + 3, g1], fill=tuple(int(c * 0.8) for c in acp))
    for x in range(0, W, 64):       # ACP panel joints
        px.line([(x, 0), (x, g0)], fill=tuple(int(c * 0.88) for c in acp)); px.line([(x, g1), (x, H)], fill=tuple(int(c * 0.88) for c in acp))
    im.filter(ImageFilter.GaussianBlur(0.6)).save(os.path.join(D, f"ribbon_{name}.jpg"), quality=90); r.save(os.path.join(D, f"ribbon_{name}_r.jpg"), quality=90)
print("facade skins in", D)
