"""Facades for the Andheri-Kurla Road corridor, painted to match what Street View shows (Feb 2026).

  python scripts/world/tex_corridor.py TEX_DIR

Painted from observation only; no Google imagery is used. Three tileable modules, each <name>.jpg and
<name>_r.jpg (roughness), at 128 px per metre like scripts/world/textures.py:

  shophouse   6 x 12 m, 3 m storeys: a worn 1970s-90s commercial block. Grey-beige concrete with monsoon
              streaks, deep chajja sunshades, wide sliding windows behind grills, split AC units, balcony
              slabs. (Andheri-Kurla Road no. 111; the long block opposite Times Square.)
  signs       6 x 4.5 m: the ground and first-floor band of those blocks. Rolling shutters, glazed shopfronts
              and the dense backlit signboards (red, blue, yellow, green, white) that line the road.
  glass_grid  6 x 4.1 m: a beige concrete frame around a dark glass grid (the mid-rise office east of
              Makwana Road).
"""
import os, sys, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

OUT = sys.argv[1] if len(sys.argv) > 1 else "tex"; os.makedirs(OUT, exist_ok=True)
PX = 128

def noise(w, h, scale, seed, amp=1.0):
    r = random.Random(seed); s = Image.new("L", (max(2, w // scale), max(2, h // scale)))
    s.putdata([int(128 + (r.random() - 0.5) * 255 * amp) for _ in range(s.size[0] * s.size[1])]); return s.resize((w, h), Image.BICUBIC)

def concrete(w, h, col, seed, k=0.72):
    base = Image.new("RGB", (w, h), col); dark = Image.new("RGB", (w, h), tuple(int(c * k) for c in col))
    m = ImageChops.add(noise(w, h, 3, seed, 0.35), noise(w, h, 40, seed + 1, 0.6), 2, -128).filter(ImageFilter.GaussianBlur(0.8))
    return Image.composite(base, dark, m.point(lambda v: min(255, max(0, v + 40))))

def streaks(img, seed, n=40, k=0.6):
    r = random.Random(seed); w, h = img.size; m = Image.new("L", (w, h), 0); d = ImageDraw.Draw(m)
    for _ in range(n):
        x = r.uniform(0, w); y0 = r.uniform(0, h); ln = r.uniform(0.6, 2.8) * PX
        for i in range(int(ln)): d.line([(x, y0 + i), (x + r.uniform(-1, 1), y0 + i)], fill=int(110 * (1 - i / ln)), width=max(1, int(r.uniform(3, 14))))
    return Image.composite(Image.eval(img, lambda v: int(v * k)), img, m.filter(ImageFilter.GaussianBlur(4)))

def rough(img, name, glass_mask=None):
    g = img.convert("L").point(lambda v: 200 + (v % 40))
    if glass_mask: g.paste(40, mask=glass_mask)
    g.save(os.path.join(OUT, name + "_r.jpg"), quality=85)

def shophouse():
    W, H, F = 6 * PX, 12 * PX, 3 * PX; r = random.Random(11)
    img = concrete(W, H, (168, 160, 146), 11); d = ImageDraw.Draw(img); gm = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(gm)
    for f in range(4):
        y = f * F
        d.rectangle([0, y + F - 26, W, y + F], fill=(132, 126, 116))                       # slab edge
        d.rectangle([0, y + 24, W, y + 44], fill=(150, 143, 131))                          # chajja
        d.rectangle([0, y + 44, W, y + 60], fill=(92, 88, 82))                             # its shadow
        for bx in (0.35, 3.35):
            x0, x1 = int(bx * PX), int((bx + 2.3) * PX); y0, y1 = y + 72, y + F - 60
            d.rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], fill=(120, 116, 108))
            gl = tuple(int(c * r.uniform(0.75, 1.15)) for c in (52, 62, 70)); d.rectangle([x0, y0, x1, y1], fill=gl); gd.rectangle([x0, y0, x1, y1], fill=255)
            if r.random() < 0.45: d.rectangle([x0, y0, (x0 + x1) // 2, y1], fill=r.choice([(196, 186, 164), (170, 176, 178), (204, 196, 180), (150, 140, 124)]))   # curtain / open sash
            for gx in range(x0, x1, 16): d.line([(gx, y0), (gx, y1)], fill=(48, 48, 46), width=2)
            for gy in range(y0, y1, 30): d.line([(x0, gy), (x1, gy)], fill=(48, 48, 46), width=2)
            if r.random() < 0.7:                                                            # split AC unit under the window
                ax = r.randint(x0, x1 - 110); d.rectangle([ax, y1 + 14, ax + 104, y1 + 58], fill=(214, 212, 204)); d.rectangle([ax + 8, y1 + 22, ax + 60, y1 + 50], outline=(150, 150, 146), width=2)
    img = streaks(img, 12, 60, 0.58)
    img.save(os.path.join(OUT, "shophouse.jpg"), quality=86); rough(img, "shophouse", gm)

def signs():
    W, H = 6 * PX, int(4.5 * PX); r = random.Random(21)
    img = concrete(W, H, (150, 144, 134), 21); d = ImageDraw.Draw(img)
    COLS = [(184, 36, 40), (24, 70, 150), (226, 180, 40), (30, 120, 70), (236, 234, 226), (220, 90, 30), (110, 30, 110)]
    x = 0
    while x < W:   # shop bays 2-3.2 m wide
        bw = int(r.uniform(2.0, 3.2) * PX); bw = min(bw, W - x)
        col = r.choice(COLS); d.rectangle([x + 4, int(2.9 * PX), x + bw - 4, int(3.9 * PX)], fill=col)        # signboard
        tc = (255, 255, 255) if sum(col) < 450 else (30, 30, 30)
        for ln in range(2):                                                                                 # text blocks
            ty = int((3.08 + ln * 0.42) * PX); tw = int(bw * r.uniform(0.45, 0.8)); tx = x + (bw - tw) // 2
            for cx in range(tx, tx + tw, 22): d.rectangle([cx, ty, cx + r.randint(10, 18), ty + (36 if ln == 0 else 22)], fill=tc)
        if r.random() < 0.55:                                                                               # shutter, half up or down
            d.rectangle([x + 14, int(0.0 * PX), x + bw - 14, int(2.8 * PX)], fill=(118, 120, 122))
            for sy in range(0, int(2.8 * PX), 9): d.line([(x + 14, sy), (x + bw - 14, sy)], fill=(92, 94, 96), width=2)
        else:                                                                                               # lit shopfront
            d.rectangle([x + 14, 0, x + bw - 14, int(2.8 * PX)], fill=(196, 186, 160)); d.rectangle([x + 30, int(0.4 * PX), x + bw - 30, int(2.5 * PX)], fill=(232, 222, 196))
            for sx in range(x + 40, x + bw - 40, 46): d.rectangle([sx, int(0.9 * PX), sx + 30, int(2.2 * PX)], fill=tuple(int(c * 0.55 + 90) for c in r.choice(COLS)))   # goods on shelves
        d.rectangle([x, 0, x + 12, H], fill=(128, 122, 114)); x += bw
    d.rectangle([0, int(3.95 * PX), W, int(4.1 * PX)], fill=(110, 106, 98))
    img = streaks(img, 22, 14, 0.7).transpose(Image.FLIP_TOP_BOTTOM)   # drawn from the pavement up; the image's top row is the top of the wall
    img.save(os.path.join(OUT, "signs.jpg"), quality=86); rough(img, "signs")

def glass_grid():
    W, H = 6 * PX, int(4.1 * PX); img = concrete(W, H, (200, 188, 164), 31, 0.85); d = ImageDraw.Draw(img); gm = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(gm)
    r = random.Random(31)
    d.rectangle([0, H - 60, W, H], fill=(186, 174, 150))
    for i in range(4):
        x0 = 20 + i * (W - 40) // 4; x1 = x0 + (W - 40) // 4 - 18
        for j in range(3):
            y0 = 24 + j * (H - 100) // 3; y1 = y0 + (H - 100) // 3 - 8
            g = tuple(int(c * r.uniform(0.8, 1.15)) for c in (30, 38, 46)); d.rectangle([x0, y0, x1, y1], fill=g); gd.rectangle([x0, y0, x1, y1], fill=255)
        d.rectangle([x1, 16, x1 + 18, H - 60], fill=(24, 26, 28))
    img.save(os.path.join(OUT, "glass_grid.jpg"), quality=86); rough(img, "glass_grid", gm)

shophouse(); signs(); glass_grid(); print("corridor facades in", OUT)
