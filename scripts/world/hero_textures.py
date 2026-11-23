"""Premium material and foliage textures for the explorer, generated (no third-party assets).

  python scripts/world/hero_textures.py TEX_DIR

Every texture tiles. Each material is a set: NAME.jpg (colour), NAME_r.jpg (roughness, in the green
channel as three.js reads it), NAME_n.jpg (tangent-space normal, OpenGL convention), made from one
height field so colour, roughness and relief agree. Physical sizes are given per texture; the models
map UVs in metres divided by that size (scripts/world/magnus_hero.py).

  hero_glass     6.0 x 8.0 m   vision glass, two floors of four 1.5 m panes: a reflective tint over a
                               fake interior (ceiling band with linear lights, blinds at random heights,
                               dim desks), so glass has depth in daylight
  hero_spandrel  3.0 x 3.0 m   back-painted spandrel glass, graphite
  hero_alu       2.4 x 2.4 m   champagne aluminium composite panels, 1.2 x 2.4 m with 12 mm joints
  hero_stone     2.4 x 2.4 m   honed sandstone cladding, 0.6 x 1.2 m stack bond, 6 mm joints
  hero_concrete  4.8 x 4.8 m   fair-face concrete, 2.4 x 1.2 m formwork panels and tie holes
  hero_roof      4.0 x 4.0 m   grey waterproofing membrane, 1 m laps
  hero_pavers    2.0 x 2.0 m   interlocking concrete pavers, 200 x 100 mm basket weave, two greys
  hero_asphalt   4.0 x 4.0 m   bitumen with aggregate
  hero_lawn      4.0 x 4.0 m   cut lawn, mown stripes and tonal patches
  hero_mulch     2.0 x 2.0 m   planting bed: bark mulch over soil
  hero_bark      1.0 x 2.0 m   tree bark
  ground_noida   8.0 x 8.0 m   open ground in a Noida sector: dusty soil, patchy dry grass, gravel
  leaves_a       neem-like broadleaf (compound leaves of small serrated leaflets)       RGBA, cut-out
  leaves_b       ashoka (Polyalthia longifolia: long, narrow, wavy, drooping leaves)    RGBA
  leaves_palm    palm frond leaflets on a rachis                                         RGBA
  leaves_shrub   dense small-leaved shrub and hedge (Murraya, boxwood)                  RGBA
  leaves_bloom   bougainvillea: leaves with magenta bracts                               RGBA
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
R = np.random.default_rng(20261123)

# ---------------------------------------------------------------- helpers
def pnoise(w, h, cells, seed, octaves=4, persistence=0.5):
    """Periodic value noise (fBm): tiles in both directions."""
    rng = np.random.default_rng(seed); out = np.zeros((h, w)); amp = 1.0; tot = 0
    cx, cy = cells if isinstance(cells, tuple) else (cells, cells)
    for o in range(octaves):
        gx, gy = cx * 2 ** o, cy * 2 ** o
        g = rng.random((gy, gx))
        ys = np.arange(h) / h * gy; xs = np.arange(w) / w * gx
        y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int); fy = ys - y0; fx = xs - x0
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        y1 = (y0 + 1) % gy; x1 = (x0 + 1) % gx; y0 %= gy; x0 %= gx
        a = g[y0][:, x0]; b = g[y0][:, x1]; c = g[y1][:, x0]; d = g[y1][:, x1]
        out += amp * ((a * (1 - fx) + b * fx) * (1 - fy[:, None]) + (c * (1 - fx) + d * fx) * fy[:, None]); tot += amp; amp *= persistence
    return out / tot

def normal_from_height(hgt, strength):
    dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5 * strength
    dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5 * strength
    n = np.dstack([-dx, dy, np.ones_like(hgt)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)

def save_set(name, col, rough, hgt=None, strength=4.0, size=None):
    col = np.clip(col, 0, 255).astype(np.uint8)
    im = Image.fromarray(col)
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".jpg"), quality=88, optimize=True, progressive=True)
    r = np.clip(rough * 255, 0, 255).astype(np.uint8); rim = Image.fromarray(np.dstack([r, r, r]))
    if size: rim = rim.resize(size, Image.LANCZOS)
    rim.save(os.path.join(OUT, name + "_r.jpg"), quality=80, optimize=True)
    if hgt is not None:
        nim = Image.fromarray(normal_from_height(hgt, strength))
        if size: nim = nim.resize(size, Image.LANCZOS)
        nim.save(os.path.join(OUT, name + "_n.jpg"), quality=82, optimize=True)
    print(name, col.shape[1], "x", col.shape[0])

def rgb(*c): return np.array(c, dtype=float)
def mix(a, b, t): t = t[..., None] if np.ndim(t) == 2 else t; return a * (1 - t) + b * t
def grid_lines(w, h, nx, ny, width_px, ox=0, oy=0):
    """1 on joint lines of an nx x ny grid (in texels), 0 elsewhere, soft-edged."""
    y, x = np.mgrid[0:h, 0:w]
    dx = np.minimum((x - ox) % (w / nx), (w / nx) - (x - ox) % (w / nx))
    dy = np.minimum((y - oy) % (h / ny), (h / ny) - (y - oy) % (h / ny))
    return np.clip(1 - np.minimum(dx, dy) / width_px, 0, 1)

# ---------------------------------------------------------------- hero_glass (6 m x 8 m: four panes, two floors)
def glass():
    W, H = 1024, 1366; img = np.zeros((H, W, 3)); rough = np.full((H, W), 0.06); hgt = np.zeros((H, W))
    floor_px = H / 2; pane_px = W / 4
    base_hi, base_lo = rgb(64, 84, 98), rgb(30, 42, 52)
    y, x = np.mgrid[0:H, 0:W]
    for f in range(2):
        y0, y1 = int(f * floor_px), int((f + 1) * floor_px)
        fy = (y[y0:y1] - y0) / floor_px   # 0 at the top of the floor (texture v runs down), 1 at the floor
        # interior seen through the glass: ceiling band and lights at the top, desks low, darker middle
        inter = np.zeros((y1 - y0, W, 3))
        inter[:] = mix(rgb(70, 72, 74), rgb(38, 40, 44), np.clip(fy * 1.4, 0, 1))
        ceil = fy < 0.16; inter[ceil] = rgb(150, 150, 146)
        for k in range(4):   # linear lights across each pane
            cxp = (k + 0.5) * pane_px
            lit = ceil & (np.abs(x[y0:y1] - cxp) < pane_px * 0.32) & (np.abs(fy - 0.09) < 0.012)
            inter[lit] = rgb(235, 236, 228)
        desks = (fy > 0.72) & (fy < 0.78); inter[desks] = rgb(58, 54, 50)
        # blinds: each pane drawn down to its own height
        for k in range(4):
            drop = R.uniform(0.0, 0.55); x0, x1 = int(k * pane_px), int((k + 1) * pane_px)
            m = (fy < drop)[:, x0:x1]
            slat = (np.sin((y[y0:y1, x0:x1] - y0) / floor_px * 260) > 0).astype(float)
            blind = mix(rgb(176, 174, 166), rgb(150, 148, 142), slat)
            reg = inter[:, x0:x1]; reg[m] = blind[m]
            hgt[y0:y1, x0:x1][m] = slat[m] * 0.2
            rough[y0:y1, x0:x1][m] = 0.12
        # the glass: a tinted reflection of a sky gradient over the interior (interior shows ~35%)
        tint = mix(base_hi, base_lo, fy * 0.9)
        pane_var = np.zeros(W)
        for k in range(4): pane_var[int(k * pane_px):int((k + 1) * pane_px)] = R.uniform(-6, 6)
        img[y0:y1] = tint * 0.65 + inter * 0.35 + pane_var[None, :, None]
    # slight waviness of tempered glass in the normals
    hgt += pnoise(W, H, (2, 3), 5, 3) * 0.6
    save_set("hero_glass", img, rough, hgt, strength=2.0, size=(768, 1024))

# ---------------------------------------------------------------- spandrel
def spandrel():
    W = 512; n = pnoise(W, W, 4, 11, 4)
    col = mix(rgb(44, 48, 52), rgb(58, 62, 66), n); rough = 0.14 + n * 0.08
    save_set("hero_spandrel", col, rough, n * 0.3, 1.0)

# ---------------------------------------------------------------- aluminium composite panels
def alu():
    W = 1024; n = pnoise(W, W, 3, 21, 5)
    col = mix(rgb(176, 166, 146), rgb(196, 186, 166), n)   # champagne anodised
    brushed = pnoise(W, W, (64, 2), 22, 2); col += (brushed[..., None] - 0.5) * 10
    joints = grid_lines(W, W, 2, 1, 2.2)                  # 1.2 m vertical joints, 2.4 m horizontal (tile edge)
    col = mix(col, rgb(70, 66, 60), joints * 0.9); hgt = -joints * 1.0 + n * 0.05
    rough = 0.34 + n * 0.08 + joints * 0.3
    save_set("hero_alu", col, rough, hgt, 6.0)

# ---------------------------------------------------------------- sandstone cladding
def stone():
    W = 1024; img = np.zeros((W, W, 3)); y, x = np.mgrid[0:W, 0:W]
    tw, th = W / 2, W / 4          # 1.2 m x 0.6 m tiles on a 2.4 m texture
    col_i = (x // tw).astype(int); row_i = (y // th).astype(int)
    rng = np.random.default_rng(31); tone = rng.uniform(-14, 14, (4, 2)); hue = rng.uniform(-6, 6, (4, 2))
    base = rgb(196, 176, 142)
    grain = pnoise(W, W, (24, 6), 32, 4); fine = pnoise(W, W, 64, 33, 2)
    for r in range(4):
        for c in range(2):
            m = (row_i == r) & (col_i == c)
            img[m] = base + tone[r, c] + np.array([hue[r, c], 0, -hue[r, c]])
    img += ((grain - 0.5) * 26)[..., None] + ((fine - 0.5) * 10)[..., None]
    jv = np.clip(1 - np.minimum(x % tw, tw - x % tw) / 1.6, 0, 1); jh = np.clip(1 - np.minimum(y % th, th - y % th) / 1.6, 0, 1); joints = np.maximum(jv, jh)
    img = mix(img, rgb(120, 108, 90), joints * 0.85)
    hgt = -joints + grain * 0.15; rough = 0.62 + grain * 0.15 + joints * 0.2
    save_set("hero_stone", img, rough, hgt, 5.0)

# ---------------------------------------------------------------- fair-face concrete
def concrete():
    W = 1024; n = pnoise(W, W, 4, 41, 6); m = pnoise(W, W, 16, 42, 3)
    col = mix(rgb(160, 158, 152), rgb(190, 188, 182), n); col += ((m - 0.5) * 14)[..., None]
    # rain streaks under the formwork joints
    st = pnoise(W, W, (40, 1), 43, 2); col -= (np.clip(st - 0.6, 0, 1) * 40)[..., None]
    joints = grid_lines(W, W, 2, 4, 1.6); col = mix(col, rgb(120, 118, 114), joints * 0.6)
    y, x = np.mgrid[0:W, 0:W]; holes = np.zeros((W, W))
    for cx in np.arange(W / 8, W, W / 4):
        for cy in np.arange(W / 16, W, W / 8): holes = np.maximum(holes, np.clip(1 - np.hypot(x - cx, y - cy) / 5, 0, 1))
    col = mix(col, rgb(110, 108, 104), holes); hgt = n * 0.3 - joints * 0.6 - holes
    save_set("hero_concrete", col, 0.78 + m * 0.1, hgt, 3.0)

def roof():
    W = 512; n = pnoise(W, W, 4, 51, 5)
    col = mix(rgb(150, 152, 150), rgb(176, 178, 174), n); seams = grid_lines(W, W, 4, 1, 1.4)
    col = mix(col, rgb(120, 122, 120), seams * 0.7); dirt = pnoise(W, W, 3, 52, 3)
    col -= (np.clip(dirt - 0.55, 0, 1) * 60)[..., None]
    save_set("hero_roof", col, 0.7 + n * 0.1, n * 0.2 - seams * 0.5, 3.0)

def pavers():
    W = 1024; y, x = np.mgrid[0:W, 0:W]; cell = W / 10   # 200 mm cells on a 2 m texture
    cx, cy = (x // cell).astype(int), (y // cell).astype(int); horiz = (cx + cy) % 2 == 0
    lx, ly = x % cell, y % cell
    half = cell / 2
    sub = np.where(horiz, (ly // half).astype(int), (lx // half).astype(int))
    rng = np.random.default_rng(61); tone = rng.uniform(-12, 12, (10, 10, 2))
    shade = np.where(((cx + 3 * cy) % 7 == 0)[..., None], rgb(150, 112, 98), rgb(150, 150, 146))   # a few red-tinted cells, the Noida pattern
    col = shade + tone[cy % 10, cx % 10, sub][..., None]
    d_edge = np.where(horiz, np.minimum(np.minimum(ly % half, half - ly % half), np.minimum(lx, cell - lx)), np.minimum(np.minimum(lx % half, half - lx % half), np.minimum(ly, cell - ly)))
    joint = np.clip(1 - d_edge / 3.0, 0, 1); n = pnoise(W, W, 30, 62, 2)
    col = mix(col, rgb(90, 88, 84), joint * 0.8) + ((n - 0.5) * 16)[..., None]
    bevel = np.clip(d_edge / 6.0, 0, 1)
    save_set("hero_pavers", col, 0.82 + n * 0.1, bevel + n * 0.1, 4.0)

def asphalt():
    W = 1024; n = pnoise(W, W, 8, 71, 5); g = R.random((W, W))
    col = mix(rgb(58, 58, 60), rgb(76, 76, 78), n); stones = (g > 0.985).astype(float)
    col = mix(col, rgb(120, 118, 114), stones * 0.7); wear = pnoise(W, W, 2, 72, 2)
    col += ((wear - 0.5) * 18)[..., None]
    save_set("hero_asphalt", col, 0.88 - stones * 0.2, n * 0.3 + stones * 0.6, 3.0)

def lawn():
    W = 1024; blades = R.random((W, W)); blades = np.array(Image.fromarray((blades * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))) / 255.0
    patches = pnoise(W, W, 3, 81, 4); x = np.mgrid[0:W, 0:W][1]
    stripes = (np.sin(x / W * math.tau * 4) > 0).astype(float) * 0.5 + 0.5
    col = mix(rgb(70, 104, 44), rgb(108, 138, 60), patches); col = mix(col, rgb(124, 128, 70), np.clip(patches - 0.7, 0, 1) * 2)
    col *= (0.86 + 0.14 * stripes)[..., None]; col *= (0.8 + 0.4 * blades)[..., None]
    save_set("hero_lawn", col, 0.9 + blades * 0.05, blades * 0.6 + patches * 0.2, 4.0)

def mulch():
    W = 512; img = Image.new("RGB", (W, W), (74, 52, 36)); d = ImageDraw.Draw(img); rng = np.random.default_rng(91)
    for _ in range(2600):
        x, y = rng.uniform(0, W, 2); a = rng.uniform(0, math.pi); L = rng.uniform(4, 14); w = rng.uniform(1.5, 4)
        c = tuple(int(v) for v in rng.choice([(96, 66, 42), (120, 84, 52), (62, 44, 30), (140, 100, 62)]))
        for ox in (-W, 0, W):
            for oy in (-W, 0, W):
                d.line([(x + ox - math.cos(a) * L / 2, y + oy - math.sin(a) * L / 2), (x + ox + math.cos(a) * L / 2, y + oy + math.sin(a) * L / 2)], fill=c, width=int(w))
    col = np.array(img, dtype=float); h = col.mean(axis=2) / 255
    save_set("hero_mulch", col, 0.95 - h * 0.1, h, 4.0)

def bark():
    W, H = 512, 1024; n = pnoise(W, H, (24, 3), 101, 4); m = pnoise(W, H, (6, 2), 102, 3)
    col = mix(rgb(70, 58, 46), rgb(120, 104, 86), n); col = mix(col, rgb(150, 146, 132), np.clip(m - 0.65, 0, 1) * 2)
    save_set("hero_bark", col, 0.9 + n * 0.05, n, 6.0)

def ground_noida():
    W = 1024; soil = pnoise(W, W, 4, 111, 6); grass = pnoise(W, W, 6, 112, 5); g = R.random((W, W))
    col = mix(rgb(168, 150, 120), rgb(190, 174, 146), soil)                  # dusty alluvial soil
    gm = np.clip((grass - 0.48) * 4, 0, 1)
    col = mix(col, mix(rgb(118, 126, 72), rgb(146, 140, 84), soil), gm * (0.7 + 0.3 * g))   # patchy dry grass
    pebbles = (g > 0.992).astype(float); col = mix(col, rgb(206, 200, 188), pebbles * 0.6)
    save_set("ground_noida", col, 0.95 - gm * 0.05, soil * 0.4 + gm * g * 0.4, 3.0)

# ---------------------------------------------------------------- foliage atlases (RGBA cut-outs)
def leaf_poly(cx, cy, length, width, ang, serr=0, wav=0, n=14):
    pts = []
    for side in (1, -1):
        rng_ = range(n + 1) if side == 1 else range(n, -1, -1)
        for i in rng_:
            t = i / n; w = width * math.sin(math.pi * t) ** 0.8 * (1 + (serr * (i % 2)))
            off = wav * math.sin(t * math.pi * 3) * width
            px, py = t * length, side * w / 2 + off
            pts.append((cx + px * math.cos(ang) - py * math.sin(ang), cy + px * math.sin(ang) + py * math.cos(ang)))
    return pts

def atlas(name, draw_fn, size=1024, out=512):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0)); draw_fn(ImageDraw.Draw(img), size)
    # fill transparent texels with the average leaf colour so mip-mapping does not bleed black
    arr = np.array(img).astype(float); a = arr[..., 3:4] / 255
    mean = (arr[..., :3] * a).sum((0, 1)) / max(1, a.sum())
    arr[..., :3] = arr[..., :3] * a + mean * (1 - a)
    Image.fromarray(arr.astype(np.uint8), "RGBA").resize((out, out), Image.LANCZOS).quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(OUT, name + ".png"), optimize=True)
    print(name)

def shade(rng, base, k=26):
    v = rng.uniform(-k, k); return tuple(int(np.clip(c + v + rng.uniform(-6, 6), 0, 255)) for c in base) + (255,)

def neem(d, S):   # compound leaves: a rachis with 9-15 small, slightly sickle-shaped serrated leaflets, layered
    rng = np.random.default_rng(201); greens = [(70, 112, 42), (88, 128, 50), (56, 92, 36), (104, 140, 62), (46, 78, 30)]
    for _ in range(150):
        cx, cy = rng.uniform(0.08, 0.92, 2) * S; a = rng.uniform(0, math.tau); L = rng.uniform(0.16, 0.26) * S
        base = greens[rng.integers(len(greens))]
        d.line([(cx, cy), (cx + math.cos(a) * L, cy + math.sin(a) * L)], fill=shade(rng, (60, 80, 36), 10), width=2)
        for i in range(int(rng.integers(5, 8))):
            t = (i + 0.6) / 7.5
            px, py = cx + math.cos(a) * L * t, cy + math.sin(a) * L * t
            for side in (-1, 1):
                la = a + side * rng.uniform(0.7, 1.0) - side * 0.1
                d.polygon(leaf_poly(px, py, S * rng.uniform(0.045, 0.06), S * 0.014, la, serr=0.25), fill=shade(rng, base))

def ashoka(d, S):  # long, narrow, wavy leaves hanging in layers
    rng = np.random.default_rng(202); greens = [(40, 84, 36), (52, 100, 44), (32, 68, 30), (66, 112, 52)]
    for _ in range(320):
        cx, cy = rng.uniform(0.04, 0.9) * S, rng.uniform(0.0, 0.7) * S
        a = math.pi / 2 + rng.uniform(-0.45, 0.45)
        d.polygon(leaf_poly(cx, cy, S * rng.uniform(0.18, 0.3), S * rng.uniform(0.02, 0.03), a, wav=0.35, n=20), fill=shade(rng, greens[rng.integers(len(greens))], 18))

def palm(d, S):    # frond leaflets along a rachis, drooping tips (the card is one frond seen from above)
    rng = np.random.default_rng(203)
    d.line([(S * 0.02, S * 0.5), (S * 0.98, S * 0.5)], fill=(120, 116, 70, 255), width=6)
    for i in range(70):
        t = (i + 0.5) / 70; x = S * (0.03 + 0.95 * t); Ln = S * 0.46 * math.sin(math.pi * (0.15 + 0.85 * t)) ** 0.7
        for side in (-1, 1):
            a = side * (math.pi / 2 - 0.55) + rng.uniform(-0.08, 0.08)
            d.polygon(leaf_poly(x, S * 0.5, Ln, S * 0.018, a, n=16), fill=shade(rng, (78, 118, 46), 16))

def shrub(d, S):   # small oval leaves, dense
    rng = np.random.default_rng(204); greens = [(46, 86, 36), (60, 102, 44), (38, 70, 30), (74, 116, 52)]
    for _ in range(2200):
        cx, cy = rng.uniform(0.02, 0.98, 2) * S
        d.polygon(leaf_poly(cx, cy, S * rng.uniform(0.025, 0.04), S * 0.016, rng.uniform(0, math.tau), n=10), fill=shade(rng, greens[rng.integers(len(greens))], 16))

def bloom(d, S):   # bougainvillea: heart-shaped leaves and clusters of magenta papery bracts
    rng = np.random.default_rng(205)
    for _ in range(900):
        cx, cy = rng.uniform(0.02, 0.98, 2) * S
        d.polygon(leaf_poly(cx, cy, S * rng.uniform(0.03, 0.045), S * 0.024, rng.uniform(0, math.tau), n=10), fill=shade(rng, (62, 104, 44), 14))
    for _ in range(170):
        cx, cy = rng.uniform(0.04, 0.96, 2) * S
        for k in range(3):
            a = k * math.tau / 3 + rng.uniform(0, 1)
            d.polygon(leaf_poly(cx, cy, S * 0.028, S * 0.024, a, n=10), fill=shade(rng, (198, 40, 120), 22))

glass(); spandrel(); alu(); stone(); concrete(); roof(); pavers(); asphalt(); lawn(); mulch(); bark(); ground_noida()
atlas("leaves_a", neem); atlas("leaves_b", ashoka); atlas("leaves_palm", palm); atlas("leaves_shrub", shrub); atlas("leaves_bloom", bloom)
print("done")
