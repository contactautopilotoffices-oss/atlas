"""Brick pattern iterations for the Workcations tower, to choose from.

  .w3d/bin/python te-whitefield/world/brick_variants.py OUT_DIR

Each variant is a tileable 2.4 m square at 256 px a metre, painted procedurally with
per-brick colour, a fired-clay grain and sunk joints, so it maps at true size. Each writes
<name>_diff.jpg (colour, tint included, so it exports to the web as is), <name>_rough.jpg and <name>_h.png (height,
for a bump in Blender and normals.py). A swatch sheet with the names goes to OUT_DIR/swatches.jpg.

  stretcher       running bond, the common wall; deep red-brown as the street photograph
  flemish         Flemish bond: headers and stretchers alternate on every course
  rattrap         rat-trap bond, bricks on edge with a cavity (Bengaluru, Laurie Baker): headers read as a grid
  stack           stack bond, joints aligned both ways: a crisp contemporary facade
  jali            a brick screen with every other header left out: light and air through the wall
  wirecut_dark    running bond in dark wire-cut brick with raked joints: a deeper, more uniform tone
"""
import os, sys, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
PX = 256; S = int(2.4 * PX)                     # 256 px a metre: a 12 mm joint is 3 px, so the bond reads
L, Hh, HD, J = 0.23, 0.075, 0.11, 0.012              # brick length, height, header width, joint (m)

PAL = {
    "red_brown": [(150, 66, 40), (138, 58, 36), (160, 76, 46), (126, 54, 34), (168, 84, 52), (144, 70, 44), (118, 50, 32)],
    "dark":      [(92, 44, 32), (84, 40, 30), (100, 50, 36), (76, 36, 28), (108, 54, 38)],
}
MORTAR = {"light": (182, 168, 150), "grey": (128, 122, 114), "dark": (70, 62, 56)}

def painter(seed):
    rnd = random.Random(seed)
    col = Image.new("RGB", (S, S)); hgt = Image.new("L", (S, S), 0)
    return rnd, col, hgt, ImageDraw.Draw(col), ImageDraw.Draw(hgt)

def brick(d, dh, rnd, pal, x0, y0, x1, y1):
    c = pal[rnd.randrange(len(pal))]; k = 0.9 + 0.2 * rnd.random(); c = tuple(int(v * k) for v in c)
    j = J * PX / 2
    for dx in (0, S, -S):   # wrap so the tile repeats seamlessly
        for dy in (0, S, -S):
            d.rectangle([x0 + j + dx, y0 + j + dy, x1 - j + dx, y1 - j + dy], fill=c)
            dh.rectangle([x0 + j + dx, y0 + j + dy, x1 - j + dx, y1 - j + dy], fill=225)

def finish(name, col, hgt, mortar, rough_brick=210):
    base = Image.new("RGB", (S, S), MORTAR[mortar])
    col = Image.composite(col, base, hgt.point(lambda v: 255 if v > 0 else 0))
    grain = Image.effect_noise((S, S), 26).convert("RGB")
    col = Image.blend(col, grain, 0.07).filter(ImageFilter.GaussianBlur(0.5))
    col.save(os.path.join(OUT, f"{name}_diff.jpg"), quality=92)
    hgt.filter(ImageFilter.GaussianBlur(0.8)).save(os.path.join(OUT, f"{name}_h.png"))
    hgt.point(lambda v: rough_brick if v > 0 else 245).save(os.path.join(OUT, f"{name}_rough.jpg"), quality=90)
    return col

def running(name, pal, mortar, seed, offset=0.5):
    rnd, col, hgt, d, dh = painter(seed); bl, bh = (L + J) * PX, (Hh + J) * PX
    rows = int(round(S / bh)); bh = S / rows; n = int(round(S / bl)); bl = S / n
    for r in range(rows):
        off = (bl * offset) if r % 2 else 0
        for i in range(-1, n + 1): brick(d, dh, rnd, pal, i * bl + off, r * bh, (i + 1) * bl + off, (r + 1) * bh)
    return finish(name, col, hgt, mortar)

def flemish(name, pal, mortar, seed):
    rnd, col, hgt, d, dh = painter(seed); unit = (L + HD + 2 * J) * PX; bh = (Hh + J) * PX
    rows = int(round(S / bh)); bh = S / rows; n = int(round(S / unit)); unit = S / n
    sl = unit * (L + J) / (L + HD + 2 * J)
    for r in range(rows):
        off = unit / 2 if r % 2 else 0
        for i in range(-1, n + 1):
            x = i * unit + off
            brick(d, dh, rnd, pal, x, r * bh, x + sl, (r + 1) * bh)
            brick(d, dh, rnd, [tuple(int(v * 0.86) for v in c) for c in pal], x + sl, r * bh, x + unit, (r + 1) * bh)   # headers darker (burnt ends)
    return finish(name, col, hgt, mortar)

def rattrap(name, pal, mortar, seed):
    rnd, col, hgt, d, dh = painter(seed); bh = (HD + J) * PX; cell = (L + HD + 2 * J) * PX
    rows = int(round(S / bh)); bh = S / rows; n = int(round(S / cell)); cell = S / n
    sl = cell * (L + J) / (L + HD + 2 * J)
    for r in range(rows):
        for i in range(-1, n + 1):
            x = i * cell
            if r % 2 == 0: brick(d, dh, rnd, pal, x, r * bh, x + cell, (r + 1) * bh)          # brick on edge, full length
            else:
                brick(d, dh, rnd, pal, x, r * bh, x + cell - sl, (r + 1) * bh)               # header bridging the cavity
                brick(d, dh, rnd, pal, x + cell - sl, r * bh, x + cell, (r + 1) * bh)
    return finish(name, col, hgt, mortar)

def stack(name, pal, mortar, seed):
    rnd, col, hgt, d, dh = painter(seed); bl, bh = (L + J) * PX, (Hh + J) * PX
    rows = int(round(S / bh)); bh = S / rows; n = int(round(S / bl)); bl = S / n
    for r in range(rows):
        for i in range(n): brick(d, dh, rnd, pal, i * bl, r * bh, (i + 1) * bl, (r + 1) * bh)
    return finish(name, col, hgt, mortar)

def jali(name, pal, mortar, seed):
    rnd, col, hgt, d, dh = painter(seed); bl, bh = (L + J) * PX, (Hh + J) * PX
    rows = int(round(S / bh)); bh = S / rows; n = int(round(S / bl)); bl = S / n
    for r in range(rows):
        off = bl / 2 if r % 2 else 0
        for i in range(-1, n + 1):
            if r % 2 and i % 2: continue                                                    # the open cells of the screen
            brick(d, dh, rnd, pal, i * bl + off, r * bh, (i + 1) * bl + off, (r + 1) * bh)
    col = finish(name, col, hgt, "dark")                                                   # the voids read dark (shade behind)
    return col

VARIANTS = [
    ("stretcher", lambda: running("stretcher", PAL["red_brown"], "light", 1)),
    ("flemish", lambda: flemish("flemish", PAL["red_brown"], "light", 2)),
    ("rattrap", lambda: rattrap("rattrap", PAL["red_brown"], "grey", 3)),
    ("stack", lambda: stack("stack", PAL["red_brown"], "light", 4)),
    ("jali", lambda: jali("jali", PAL["red_brown"], "dark", 5)),
    ("wirecut_dark", lambda: running("wirecut_dark", PAL["dark"], "dark", 6)),
]
tiles = [(nm, fn()) for nm, fn in VARIANTS]
# the swatch sheet: each variant at about 1.2 m square (the true scale reads), with its name
sw = 360; sheet = Image.new("RGB", (sw * 3 + 40, (sw + 50) * 2 + 20), (245, 243, 238)); dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("DejaVuSans-Bold.ttf", 22)
except Exception: font = ImageFont.load_default()
for i, (nm, t) in enumerate(tiles):
    x, y = 10 + (i % 3) * (sw + 10), 10 + (i // 3) * (sw + 50)
    sheet.paste(t.crop((0, 0, S // 2 + 1, S // 2 + 1)).resize((sw, sw), Image.LANCZOS), (x, y))
    dr.text((x + 4, y + sw + 10), f"{i + 1}. {nm.replace('_', ' ')}", fill=(30, 30, 30), font=font)
sheet.save(os.path.join(OUT, "swatches.jpg"), quality=92)
print("variants", [n for n, _ in tiles])
