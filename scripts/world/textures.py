"""Facade textures for the Andheri East dioramas, painted procedurally.

  python scripts/world/textures.py OUT_DIR

Each style is one tileable facade module at a known real size, so a wall
maps it at true scale (u = metres along the wall / module width, v = metres
up / module height). Every style writes <name>.jpg (colour) and
<name>_r.jpg (roughness: glass is smooth, plaster is rough). Mumbai details:
plaster with grain and monsoon streaks under every sill, window grills,
chajja sunshades with their shadow, split AC units, rolling shutters at
street level, and tin and brick walls for the chawls.
"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

OUT = sys.argv[1] if len(sys.argv) > 1 else "tex"
os.makedirs(OUT, exist_ok=True)
PX = 128  # pixels per metre

# name: (module width m, module height m, storey m)
STYLES = {
    "res_cream": (6.0, 12.0, 3.0), "res_peach": (6.0, 12.0, 3.0), "res_grey": (6.0, 12.0, 3.0), "res_ochre": (6.0, 12.0, 3.0),
    "res_tower": (6.0, 12.0, 3.0), "com_ribbon": (8.0, 16.0, 4.0), "com_glass": (6.0, 16.0, 4.0), "shop": (6.0, 4.5, 4.5),
    "chawl": (4.0, 3.0, 3.0), "opt_glass": (6.0, 16.4, 4.1), "opt_plaster": (6.0, 16.4, 4.1),
}

def noise(w, h, scale, seed, amp=1.0):
    r = random.Random(seed); small = Image.new("L", (max(2, w // scale), max(2, h // scale)))
    small.putdata([int(128 + (r.random() - 0.5) * 255 * amp) for _ in range(small.size[0] * small.size[1])])
    return small.resize((w, h), Image.BICUBIC)

def plaster(w, h, col, seed):
    base = Image.new("RGB", (w, h), col)
    grain = ImageChops.add(noise(w, h, 2, seed, 0.25), noise(w, h, 24, seed + 1, 0.35), 2, -128).filter(ImageFilter.GaussianBlur(0.6))
    dark = Image.new("RGB", (w, h), tuple(int(c * 0.78) for c in col))
    return Image.composite(base, dark, grain.point(lambda v: min(255, max(0, v + 60))))

def streaks(img, xs, y0, length, seed, k=0.55):
    """Monsoon run-off: darker streaks under sills and slabs."""
    r = random.Random(seed); w, h = img.size; m = Image.new("L", (w, h), 0); d = ImageDraw.Draw(m)
    for x in xs:
        for _ in range(6):
            sx = x + r.uniform(-0.5, 0.5) * PX; ln = length * r.uniform(0.4, 1.0); wd = r.uniform(0.04, 0.16) * PX
            for i in range(int(ln)):
                a = int(90 * (1 - i / ln) ** 1.4 * r.uniform(0.6, 1)); d.line([(sx, y0 + i), (sx + r.uniform(-1, 1), y0 + i)], fill=a, width=max(1, int(wd)))
    m = m.filter(ImageFilter.GaussianBlur(3))
    dark = Image.eval(img, lambda v: int(v * k))
    return Image.composite(dark, img, m)

def window(d, x0, y0, x1, y1, glass=(44, 56, 66), frame=(210, 210, 205), grill=True, r=None):
    d.rectangle([x0 - 6, y0 - 6, x1 + 6, y1 + 10], fill=frame)                      # frame and sill
    g = tuple(int(c * (0.85 + 0.3 * r.random())) for c in glass) if r else glass
    d.rectangle([x0, y0, x1, y1], fill=g)
    d.line([((x0 + x1) // 2, y0), ((x0 + x1) // 2, y1)], fill=frame, width=5)          # sash
    if r and r.random() < 0.4: d.rectangle([x0, y0, (x0 + x1) // 2, y1], fill=tuple(min(255, c + 70) for c in g))  # a curtain
    if grill:
        for gx in range(x0, x1, 14): d.line([(gx, y0), (gx, y1)], fill=(60, 60, 58), width=2)
        for gy in range(y0, y1, 34): d.line([(x0, gy), (x1, gy)], fill=(60, 60, 58), width=2)

def residential(name, col, seed, tower=False):
    mw, mh, st = STYLES[name]; W, H = int(mw * PX), int(mh * PX); r = random.Random(seed)
    img = plaster(W, H, col, seed); d = ImageDraw.Draw(img); sills = []
    for f in range(int(mh / st)):
        top = int(H - (f + 1) * st * PX); bot = int(H - f * st * PX)
        d.rectangle([0, bot - int(0.22 * PX), W, bot], fill=tuple(int(c * 0.9) for c in col))   # slab band
        for b in range(2):
            cx = int((b + 0.5) * W / 2); ww = int(1.5 * PX); wh = int(1.35 * PX)
            x0, y0 = cx - ww // 2, top + int(0.75 * PX)
            # chajja: a sunshade slab with its shadow
            d.rectangle([x0 - 22, y0 - 26, x0 + ww + 22, y0 - 10], fill=tuple(int(c * 0.82) for c in col))
            d.rectangle([x0 - 10, y0 - 10, x0 + ww + 10, y0 + 18], fill=tuple(int(c * 0.62) for c in col))
            window(d, x0, y0, x0 + ww, y0 + wh, grill=not tower, r=r)
            sills.append((cx, y0 + wh + 10))
            if r.random() < 0.45:   # split AC unit under the window
                ax = x0 + int(r.uniform(0, 0.5) * ww); ay = y0 + wh + 26
                d.rectangle([ax, ay, ax + 96, ay + 58], fill=(222, 222, 216)); d.rectangle([ax + 6, ay + 8, ax + 60, ay + 50], fill=(150, 150, 146))
    for (x, y) in sills: img = streaks(img, [x], y, 0.9 * PX * r.uniform(0.6, 1.2), seed + x + y)
    return img

def commercial_ribbon(name, seed):
    mw, mh, st = STYLES[name]; W, H = int(mw * PX), int(mh * PX); r = random.Random(seed)
    img = plaster(W, H, (214, 212, 204), seed); d = ImageDraw.Draw(img)
    for f in range(int(mh / st)):
        bot = int(H - f * st * PX); y0 = bot - int(st * PX) + int(1.15 * PX); y1 = bot - int(0.55 * PX)
        d.rectangle([0, y0, W, y1], fill=(58, 74, 86))
        for x in range(0, W, int(1.6 * PX)): d.rectangle([x, y0, x + 8, y1], fill=(150, 156, 160))
        sh = Image.new("L", (W, y1 - y0), 0); ImageDraw.Draw(sh).polygon([(0, 0), (W, 0), (W, (y1 - y0) // 3), (0, (y1 - y0) // 2)], fill=60)
        img.paste(Image.new("RGB", (W, y1 - y0), (120, 160, 190)), (0, y0), sh)
        img = streaks(img, [r.uniform(0, W) for _ in range(3)], y1 + 4, 0.6 * PX, seed + f, 0.7); d = ImageDraw.Draw(img)
    return img

def curtain(name, seed, tint=(70, 102, 118), spandrel=(46, 58, 66)):
    mw, mh, st = STYLES[name]; W, H = int(mw * PX), int(mh * PX); r = random.Random(seed)
    img = Image.new("RGB", (W, H), tint); d = ImageDraw.Draw(img)
    for f in range(int(round(mh / st))):
        bot = int(H - f * st * PX)
        for i, x in enumerate(range(0, W, int(1.5 * PX))):
            k = 0.85 + 0.3 * r.random(); c = tuple(int(v * k) for v in tint)
            d.rectangle([x, bot - int(st * PX), x + int(1.5 * PX), bot], fill=c)
            g = Image.new("L", (int(1.5 * PX), int(st * PX)), 0); ImageDraw.Draw(g).polygon([(0, 0), (int(1.5 * PX), 0), (0, int(st * PX))], fill=int(40 * r.random()))
            img.paste(Image.new("RGB", g.size, (200, 220, 235)), (x, bot - int(st * PX)), g)
        d.rectangle([0, bot - int(0.9 * PX), W, bot], fill=spandrel)                     # spandrel at the slab
        for x in range(0, W + 1, int(1.5 * PX)): d.rectangle([x - 5, bot - int(st * PX), x + 5, bot], fill=(190, 196, 198))
        d.rectangle([0, bot - 6, W, bot + 6], fill=(190, 196, 198))
    return img

def shopfront(seed):
    mw, mh, st = STYLES["shop"]; W, H = int(mw * PX), int(mh * PX); r = random.Random(seed)
    img = plaster(W, H, (196, 190, 178), seed); d = ImageDraw.Draw(img)
    signs = [(196, 40, 40), (30, 90, 170), (240, 190, 40), (30, 130, 70), (230, 230, 225), (120, 40, 120)]
    for b in range(2):
        x0 = int(b * W / 2 + 0.25 * PX); x1 = int((b + 1) * W / 2 - 0.25 * PX)
        d.rectangle([x0, int(0.35 * PX), x1, int(1.1 * PX)], fill=signs[r.randrange(len(signs))])          # sign board
        for k in range(4): d.rectangle([x0 + 30 + k * 60, int(0.55 * PX), x0 + 30 + k * 60 + 40, int(0.9 * PX)], fill=(250, 250, 245))
        if r.random() < 0.5:   # shutter down
            for y in range(int(1.3 * PX), H, 10): d.line([(x0, y), (x1, y)], fill=(150 + r.randrange(20), 152, 150), width=6)
        else:                  # open: the shop inside, warm
            d.rectangle([x0, int(1.3 * PX), x1, H], fill=(70, 58, 46)); d.rectangle([x0 + 20, int(2.2 * PX), x1 - 20, int(2.6 * PX)], fill=(200, 150, 90))
    d.rectangle([0, int(1.15 * PX), W, int(1.3 * PX)], fill=(120, 116, 108))
    return img

def chawl(seed):
    mw, mh, st = STYLES["chawl"]; W, H = int(mw * PX), int(mh * PX); r = random.Random(seed)
    cols = [(168, 82, 60), (62, 110, 170), (190, 180, 160), (90, 150, 120), (200, 160, 90)]
    img = plaster(W, H, cols[r.randrange(len(cols))], seed); d = ImageDraw.Draw(img)
    d.rectangle([int(1.2 * PX), int(1.0 * PX), int(2.0 * PX), int(2.0 * PX)], fill=(40, 46, 52))
    d.rectangle([int(2.6 * PX), int(0.6 * PX), int(3.4 * PX), H], fill=(92, 70, 50))      # a door
    return streaks(img, [int(1.6 * PX), int(3.0 * PX)], int(2.0 * PX), 0.8 * PX, seed)

def rough(img, glass_dark=True):
    g = img.convert("L"); return g.point(lambda v: 60 if v < 90 else 215)

def save(name, img):
    img.save(os.path.join(OUT, name + ".jpg"), quality=86)
    rough(img).resize((img.size[0] // 2, img.size[1] // 2)).save(os.path.join(OUT, name + "_r.jpg"), quality=80)

save("res_cream", residential("res_cream", (226, 214, 188), 1))
save("res_peach", residential("res_peach", (222, 186, 160), 2))
save("res_grey", residential("res_grey", (196, 196, 190), 3))
save("res_ochre", residential("res_ochre", (214, 186, 120), 4))
save("res_tower", residential("res_tower", (232, 230, 224), 5, tower=True))
save("com_ribbon", commercial_ribbon("com_ribbon", 6))
save("com_glass", curtain("com_glass", 7))
save("opt_glass", curtain("opt_glass", 8, tint=(64, 98, 116), spandrel=(38, 48, 56)))
save("opt_plaster", commercial_ribbon("opt_plaster", 9))
save("shop", shopfront(10))
save("chawl", chawl(11))
# roof: concrete with tar patches; asphalt; pavers; grass; soil for the plinth
def tile(name, size, col, seed, spots=None):
    img = plaster(size, size, col, seed)
    if spots:
        d = ImageDraw.Draw(img); r = random.Random(seed)
        for _ in range(spots[0]):
            x, y, s = r.uniform(0, size), r.uniform(0, size), r.uniform(4, spots[1]); d.ellipse([x - s, y - s, x + s, y + s], fill=tuple(int(c * 0.8) for c in col))
        img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(os.path.join(OUT, name + ".jpg"), quality=86)
tile("roof", 512, (170, 166, 156), 20, (40, 30))
tile("asphalt", 512, (64, 65, 68), 21, (80, 12))
tile("pavers", 512, (176, 168, 152), 22)
tile("grass", 512, (96, 122, 62), 23, (120, 18))
tile("soil", 512, (112, 86, 62), 24, (60, 20))
d = ImageDraw.Draw(img := Image.open(os.path.join(OUT, "pavers.jpg")))
for k in range(0, 512, 64): d.line([(k, 0), (k, 512)], fill=(150, 142, 128), width=2); d.line([(0, k), (512, k)], fill=(150, 142, 128), width=2)
img.save(os.path.join(OUT, "pavers.jpg"), quality=86)
print("textures", sorted(os.listdir(OUT)))

# foliage: a card of leaves with real cut-outs (alpha), for tree crowns made of
# crossed cards; rain-tree and ashoka greens, sunlit and shaded leaves mixed
def leaves(name, seed, cols, n=1400, size=(18, 9)):
    W = 512; img = Image.new("RGBA", (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(img); r = random.Random(seed)
    for _ in range(n):
        cx, cy = r.gauss(W / 2, W / 4.2), r.gauss(W / 2, W / 4.2)
        if (cx - W / 2) ** 2 + (cy - W / 2) ** 2 > (W * 0.47) ** 2: continue
        a = r.uniform(0, math.pi); lw, lh = size[0] * r.uniform(0.7, 1.3), size[1] * r.uniform(0.7, 1.3)
        c = cols[r.randrange(len(cols))]; k = r.uniform(0.75, 1.15); col = tuple(int(min(255, v * k)) for v in c) + (255,)
        pts = [(cx + math.cos(a) * lw * math.cos(t) - math.sin(a) * lh * math.sin(t), cy + math.sin(a) * lw * math.cos(t) + math.cos(a) * lh * math.sin(t)) for t in [i / 10 * math.tau for i in range(10)]]
        d.polygon(pts, fill=col)
    for _ in range(14):   # twigs
        x0, y0 = W / 2 + r.uniform(-60, 60), W / 2 + r.uniform(-60, 60); x1, y1 = x0 + r.uniform(-200, 200), y0 + r.uniform(-200, 200)
        d.line([(x0, y0), (x1, y1)], fill=(70, 55, 40, 255), width=3)
    img.save(os.path.join(OUT, name + ".png"))
leaves("leaves_a", 31, [(58, 92, 40), (74, 112, 48), (92, 128, 56), (44, 74, 34), (110, 140, 70)])
leaves("leaves_b", 32, [(40, 78, 36), (52, 96, 44), (66, 110, 52), (34, 64, 30)], n=1700, size=(22, 6))
print("leaves")
