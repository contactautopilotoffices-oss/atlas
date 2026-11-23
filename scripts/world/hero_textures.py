"""Premium material and foliage textures for the explorer, generated (no third-party assets).

  python scripts/world/hero_textures.py TEX_DIR

Every texture tiles. Each material is a set: NAME.jpg (colour), NAME_r.jpg (roughness, in the green
channel as three.js reads it), NAME_n.jpg (tangent-space normal, OpenGL convention), made from one
height field so colour, roughness and relief agree. Physical sizes are given per texture; the models
map UVs in metres divided by that size (scripts/world/hero_building.py).

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

JindalX Noida facade sets (python scripts/world/hero_textures.py TEX_DIR --facades [names]; also written by a full run).
Tile sizes in metres (w x h); the builder maps UV = metres / tile. Same list, with notes, in TEX_DIR/TILES.json. 1024 px each.

  hero_acp_white        3.6 x 3.0 m  white ACP, 1.2 x 3.0 m panels, 12 mm gaps, oil-canning, run-off streaks (Magnus, A-14 fascia)
  hero_acp_charcoal     3.6 x 3.0 m  A104 charcoal ACP, 1.2 x 3.0 m panels, dust, staining
  hero_acp_copper       3.6 x 3.0 m  A-14 copper/bronze anodised ACP, 1.2 x 1.5 m panels, vertical brushed grain (use metalness ~0.7)
  hero_acp_grey         2.4 x 2.4 m  A-14 dark grey crown/cornice ACP, 1.2 x 1.2 m panels
  hero_glass_dark       6.0 x 8.0 m  Magnus dark glazing, four 1.5 m bays, two 4 m floors, white-frit spandrels (same grid as hero_glass)
  hero_glass_bluegrey   4.8 x 4.0 m  A104 blue-grey glazing, ONE storey, 1.2 m bays, awning vents, black frames
  hero_glass_green      6.0 x 4.0 m  A-14 green ribbon glazing, ONE storey, four 1.5 m bays, silver frames
  hero_glass_teal       1.8 x 2.1 m  D-1 teal window unit, white frame (map 0..1 per window or tile)
  hero_plaster_cream    2.4 x 2.0 m  D-1 cream stucco, V-groove every 0.5 m
  hero_plaster_white    2.4 x 2.4 m  white trowelled render, control joint every 1.2 m
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFile

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

def grass(d, S):   # ornamental grass (fountain grass / lemongrass clumps): tall arching blades rising from the card's foot
    rng = np.random.default_rng(206); greens = [(104, 132, 60), (126, 146, 72), (88, 116, 52), (150, 156, 92), (70, 100, 44)]
    for _ in range(260):
        x0 = S * rng.uniform(0.15, 0.85); L = S * rng.uniform(0.55, 0.95); lean = rng.uniform(-0.55, 0.55)
        pts_l, pts_r = [], []
        for i in range(13):
            t = i / 12; w = S * 0.012 * (1 - t) + 1
            x = x0 + lean * L * t * t; y = S - L * t
            pts_l.append((x - w, y)); pts_r.append((x + w, y))
        d.polygon(pts_l + pts_r[::-1], fill=shade(rng, greens[rng.integers(len(greens))], 14))
    for _ in range(40):   # buff seed heads at the tips
        x = S * rng.uniform(0.1, 0.9); y = S * rng.uniform(0.05, 0.35)
        d.polygon(leaf_poly(x, y, S * 0.08, S * 0.012, -math.pi / 2 + rng.uniform(-0.5, 0.5), n=10), fill=shade(rng, (196, 180, 132), 14))

def flowers(d, S):  # a mixed border: lavender spikes, white mounds, coral and yellow (salvia, alyssum, vinca, marigold)
    rng = np.random.default_rng(207)
    for _ in range(1500):   # foliage underneath
        cx, cy = rng.uniform(0.02, 0.98) * S, rng.uniform(0.25, 0.99) * S
        d.polygon(leaf_poly(cx, cy, S * rng.uniform(0.025, 0.04), S * 0.016, rng.uniform(0, math.tau), n=10), fill=shade(rng, (70, 110, 46), 16))
    for _ in range(46):     # lavender / salvia spikes
        x = S * rng.uniform(0.05, 0.95); y0 = S * rng.uniform(0.45, 0.95); L = S * rng.uniform(0.18, 0.32)
        for k in range(14):
            t = k / 13; r = S * 0.012 * (1 - 0.5 * t)
            px, py = x + rng.uniform(-2, 2), y0 - L * t
            d.ellipse([px - r, py - r * 0.8, px + r, py + r * 0.8], fill=shade(rng, (150, 118, 196), 18))
    for col, n in (((238, 238, 230), 60), ((236, 104, 86), 40), ((240, 186, 48), 34)):   # white, coral, marigold mounds
        for _ in range(n):
            cx, cy = rng.uniform(0.05, 0.95) * S, rng.uniform(0.3, 0.95) * S; R_ = S * rng.uniform(0.035, 0.06)
            for _ in range(16):
                a = rng.uniform(0, math.tau); rr = rng.uniform(0, R_); r = S * rng.uniform(0.008, 0.013)
                px, py = cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.7
                d.ellipse([px - r, py - r, px + r, py + r], fill=shade(rng, col, 12))

def plaster(name, base, seed):   # painted cement render, as on most Noida Grade B blocks: trowel texture, faint rain streaks
    W = 1024; n = pnoise(W, W, 6, seed, 6); fine = pnoise(W, W, 64, seed + 1, 2); st = pnoise(W, W, (48, 2), seed + 2, 2)
    col = rgb(*base) + ((n - 0.5) * 16)[..., None] + ((fine - 0.5) * 10)[..., None]
    col -= (np.clip(st - 0.62, 0, 1) * 34)[..., None]
    joints = grid_lines(W, W, 1, 2, 1.2); col = mix(col, rgb(*base) * 0.82, joints * 0.5)   # a groove every 1.2 m
    save_set(name, col, 0.86 + fine * 0.06, fine * 0.4 + n * 0.2 - joints * 0.5, 3.0)

# ================================================================ JindalX Noida facade sets (10 PBR sets)
# Everything below is procedural and tiles in both directions. Each set is generated in physical metres
# (X across, Y down) so panel sizes, joints and mullions are true scale, then written as NAME.jpg (colour),
# NAME_r.jpg (roughness, grey, three.js reads the green channel) and NAME_n.jpg (normal, OpenGL, +Y up).
# Normal maps are built from a height field in "effective millimetres": the numbers are tuned for the page's
# lighting rather than for real depth, so joints and mullions catch light as they do on the Andheri Privilon.
# The grids and the dust and streak logic repeat per tile, so nothing seams at the tile edge.

FX_NOTES = {}   # name -> [w_m, h_m, notes], written to TILES.json

def _per(a, p):
    """Signed periodic distance: a wrapped into [-p/2, p/2)."""
    return (a + p / 2) % p - p / 2

class _Grid:
    def __init__(s, tw, th, W=1024, H=1024):
        s.tw, s.th, s.W, s.H = tw, th, W, H
        s.pxx, s.pxy = W / tw, H / th          # pixels per metre across and down
        s.pxm = (s.pxx + s.pxy) / 2
        s.X = ((np.arange(W) + 0.5) / W * tw)[None, :]
        s.Y = ((np.arange(H) + 0.5) / H * th)[:, None]

def _line(coord, period, width, offset, px):
    """1 on a line `width` m wide repeating every `period` m (centred on offset), anti-aliased at `px` px per metre."""
    d = np.abs(_per(coord - offset, period))
    return np.clip(0.5 + (width / 2 - d) * px, 0, 1)

def _fblur(a, sx, sy=None):
    """Periodic Gaussian blur (FFT), sigma in pixels."""
    sy = sx if sy is None else sy
    H, W = a.shape
    fy = np.fft.fftfreq(H)[:, None]; fx = np.fft.rfftfreq(W)[None, :]
    k = np.exp(-2 * np.pi ** 2 * ((sx * fx) ** 2 + (sy * fy) ** 2))
    return np.fft.irfft2(np.fft.rfft2(a) * k, s=a.shape)

def _rn(rng, H, W, sx, sy=None):
    """Zero-mean unit-variance tileable noise with feature size ~sigma pixels."""
    n = _fblur(rng.standard_normal((H, W)), sx, sy)
    return n / n.std()

def _warp(a, dx, dy):
    H, W = a.shape
    iy = (np.arange(H)[:, None] + dy).astype(int) % H; ix = (np.arange(W)[None, :] + dx).astype(int) % W
    return a[iy, ix]

def _lut(pid, arr): return np.asarray(arr)[np.clip(pid, 0, None)]
def _sstep(a, lo, hi):
    t = np.clip((a - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t)

def _streaks(g, seed, ledges, length, cells=None, thresh=0.52, gain=3.5):
    """0..1 run-off streaks hanging below horizontal ledges at y = ledges (m); wraps with the tile."""
    cells = cells or int(g.tw * 16)
    out = np.zeros((g.H, g.W))
    for i, y0 in enumerate(ledges):
        col = pnoise(g.W, 8, (cells, 1), seed + i * 7, 3)[0:1, :]
        col = np.clip((col - thresh) * gain, 0, 1)
        d = (g.Y - y0) % g.th
        fall = np.exp(-d / length)
        var = pnoise(g.W, g.H, (max(2, cells // 3), 3), seed + i * 7 + 1, 3)
        out = np.maximum(out, col * fall * np.clip(0.4 + 1.0 * var, 0, 1.4))
    return np.clip(out, 0, 1)

def _nrm(g, h, gain=1.0):
    sx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * g.pxx / 1000.0
    sy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * g.pxy / 1000.0
    n = np.dstack([-sx * gain, sy * gain, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255 + 0.5).clip(0, 255).astype(np.uint8)

def _jpg(path, im, qualities, sub=None, limit=340 * 1024):
    """Save as JPEG at the first quality that fits the limit; if none does, shrink the image (1024 -> 896 -> 768 -> 640)."""
    ImageFile.MAXBLOCK = 64 * 1024 * 1024
    W, H = im.size
    for k in (1.0, 0.875, 0.75, 0.625):
        im2 = im if k == 1.0 else im.resize((int(W * k), int(H * k)), Image.LANCZOS)
        for q in qualities:
            kw = dict(quality=q, optimize=True)
            if sub is not None: kw["subsampling"] = sub
            im2.save(path, "JPEG", **kw)
            if os.path.getsize(path) <= limit: return os.path.getsize(path)
    return os.path.getsize(path)

def _fx_save(name, g, col, rough, hgt, gain=1.0):
    kb = 0
    kb += _jpg(os.path.join(OUT, name + ".jpg"), Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)), (90, 86, 82, 78, 72, 66))
    r = Image.fromarray(np.clip(rough * 255, 0, 255).astype(np.uint8), "L")
    kb += _jpg(os.path.join(OUT, name + "_r.jpg"), r, (86, 80, 74, 68))
    kb += _jpg(os.path.join(OUT, name + "_n.jpg"), Image.fromarray(_nrm(g, hgt, gain)), (88, 84, 80, 74, 68, 62), sub=0)
    return name, kb / 1024.0

# ---------------------------------------------------------------- cracks and chips (wrap-aware, PIL)
def _wrapdraw(W, H, fn):
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im)
    for ox in (-W, 0, W):
        for oy in (-H, 0, H): fn(d, ox, oy)
    return np.asarray(im, dtype=float) / 255.0

def _cracks(g, rng, n, lmin, lmax, width_px=1.3):
    segs = []
    for _ in range(n):
        x, y = rng.uniform(0, g.W), rng.uniform(0, g.H); a = rng.uniform(0, math.tau); L = rng.uniform(lmin, lmax) * g.pxm
        pts = [(x, y)]
        for _k in range(int(L / 6) + 2):
            a += rng.normal(0, 0.35); x += math.cos(a) * 6; y += math.sin(a) * 6; pts.append((x, y))
        segs.append(pts)
    def fn(d, ox, oy):
        for pts in segs: d.line([(px + ox, py + oy) for px, py in pts], fill=255, width=max(1, int(round(width_px))))
    return _fblur(_wrapdraw(g.W, g.H, fn), 0.6)

def _blobs(g, rng, n, rmin, rmax):
    items = [(rng.uniform(0, g.W), rng.uniform(0, g.H), rng.uniform(rmin, rmax) * g.pxm, rng.uniform(0.6, 1.0)) for _ in range(n)]
    def fn(d, ox, oy):
        for x, y, r, e in items:
            pts = [(x + ox + math.cos(t) * r * (1 + 0.25 * math.sin(3 * t + x)), y + oy + math.sin(t) * r * e * (1 + 0.25 * math.cos(2 * t + y))) for t in np.linspace(0, math.tau, 14)]
            d.polygon(pts, fill=255)
    return _fblur(_wrapdraw(g.W, g.H, fn), 0.8)

# ---------------------------------------------------------------- aluminium composite panels
def _acp(g, seed, pw, ph, base, tone=2.5, hue=1.5, rough0=0.34, brush="v", brush_k=0.12, gap=0.012, gapcol=(50, 52, 54),
         oil=1.0, streak=0.3, streak_col=(168, 164, 154), streak_len=0.7, dust=0.0, dust_col=(150, 142, 128),
         stain=0.0, stain_col=(92, 76, 62), flake=0.0, band=0.0, row_shift=0.0, lip=0.12, panel_dust=0.0):
    """One tile of PVDF-coated ACP: pw x ph m panels with routed-and-folded edges, 12 mm shadow gaps, oil-canning,
    brushed grain, run-off streaks hanging from each horizontal joint, dust and staining."""
    rng = np.random.default_rng(seed); W, H = g.W, g.H
    nx, ny = int(round(g.tw / pw)), int(round(g.th / ph))
    ix = np.floor(g.X / pw).astype(int) % nx; iy = np.floor(g.Y / ph).astype(int) % ny
    T = rng.normal(0, tone, (ny, nx))[iy, ix]; Hu = rng.normal(0, hue, (ny, nx))[iy, ix]
    A = (rng.uniform(0.45, 1.15, (ny, nx)) * rng.choice([-1, 1], (ny, nx)))[iy, ix]
    PD = (rng.uniform(0, 1, (ny, nx)) ** 2)[iy, ix]
    col = np.empty((H, W, 3)); col[:] = np.array(base, dtype=float)
    col += (T + row_shift * (iy % 2) * np.ones((H, W)))[..., None]; col[..., 0] += Hu; col[..., 2] -= Hu
    lx = (g.X % pw) / pw; ly = (g.Y % ph) / ph
    ex = np.minimum(g.X % pw, pw - g.X % pw); ey = np.minimum(g.Y % ph, ph - g.Y % ph)
    gx = _line(g.X, pw, gap, 0.0, g.pxx); gy = _line(g.Y, ph, gap, 0.0, g.pxy); gapm = np.maximum(gx, gy)
    # folded lip: lit on the top and left edges of each panel, shaded on the bottom and right
    lipx = np.clip(1 - (ex - gap / 2) / 0.011, 0, 1) * np.where(lx < 0.5, 1.0, -1.0)
    lipy = np.clip(1 - (ey - gap / 2) / 0.011, 0, 1) * np.where(ly < 0.5, 1.0, -1.0)
    col *= (1 + lip * (lipx + lipy))[..., None]
    # oil-canning: a shallow dished bulge with a diagonal wrinkle in every panel
    bump = (np.sin(np.pi * lx) * np.sin(np.pi * ly)) ** 1.4
    wr = np.sin(np.pi * (2 * lx + 0.6 * ly + A * 0.3)) * np.sin(np.pi * lx) * np.sin(np.pi * ly)
    h_oil = 12.0 * oil * A * (bump + 0.45 * wr)
    sx = (np.roll(h_oil, -1, 1) - np.roll(h_oil, 1, 1)) * 0.5 * g.pxx / 1000; sy = (np.roll(h_oil, -1, 0) - np.roll(h_oil, 1, 0)) * 0.5 * g.pxy / 1000
    shade = -0.6 * sx + 0.8 * sy; shade = shade / (np.abs(shade).max() + 1e-9) * 0.05 * oil
    col *= (1 + shade)[..., None]
    # brushed grain
    cells = (3, 230) if brush == "h" else (230, 3)
    br = pnoise(W, H, cells, seed + 5, 2) - 0.5
    fine = _rn(rng, H, W, 0.8)
    col *= (1 + br * brush_k * 0.5 + fine * 0.006)[..., None]
    if flake: col += (rng.random((H, W)) > 1 - flake)[..., None] * 34.0
    if band:   # anodise banding: soft horizontal bands within each panel
        col *= (1 + band * np.sin(2 * np.pi * (g.Y / ph * 2.0 + A * 0.3)) * np.ones((H, W)))[..., None]
    # run-off streaks hanging from every horizontal joint, a little dust, staining
    ledges = [i * ph for i in range(ny)]
    S = _streaks(g, seed + 11, ledges, streak_len)
    col = mix(col, np.array(streak_col, dtype=float), S * streak)
    dm = np.clip((pnoise(W, H, (4, 5), seed + 21, 5) - 0.46) * 3.0, 0, 1) * (dust + panel_dust * PD)
    dm = np.clip(dm * (0.8 + 0.3 * _rn(rng, H, W, 3.5)), 0, 1) * 0.85
    col = mix(col, np.array(dust_col, dtype=float), dm)
    ST = np.zeros((H, W))
    if stain:
        ST = _streaks(g, seed + 31, ledges, streak_len * 1.2, cells=int(g.tw * 7), thresh=0.55, gain=3.0) * stain
        ST += np.clip((pnoise(W, H, (2, 3), seed + 41, 4) - 0.55) * 3, 0, 1) * stain * 0.5
        col = mix(col, np.array(stain_col, dtype=float), np.clip(ST, 0, 0.85))
    # shadow gap: dark, with grime pushed into the joint
    grime = _fblur(gapm, 5.0) * 0.5
    col = mix(col, np.array(gapcol, dtype=float), np.clip(gapm * 0.96 + grime * 0.35, 0, 1))
    rough = rough0 + br * brush_k + fine * 0.012 + S * 0.22 * streak + dm * 0.3 + ST * 0.25 + gapm * 0.4 + 0.05 * (1 - np.abs(lipx + lipy).clip(0, 1))
    hgt = h_oil - 4.0 * _fblur(gapm, 0.7)
    return col, np.clip(rough, 0.05, 1), hgt

def fx_acp_white():
    g = _Grid(3.6, 3.0); col, r, h = _acp(g, 4101, 1.2, 3.0, (233, 234, 231), tone=1.8, hue=1.4, rough0=0.36, brush="v", brush_k=0.08,
        streak=0.34, streak_col=(166, 160, 148), streak_len=0.75, dust=0.26, dust_col=(204, 196, 178), stain=0.10, stain_col=(186, 170, 148),
        oil=1.0, gapcol=(60, 62, 64))
    return _fx_save("hero_acp_white", g, col, r, h, gain=2.5)

def fx_acp_charcoal():
    g = _Grid(3.6, 3.0); col, r, h = _acp(g, 4202, 1.2, 3.0, (50, 53, 57), tone=3.0, hue=1.6, rough0=0.34, brush="v", brush_k=0.10,
        streak=0.40, streak_col=(132, 126, 114), streak_len=0.9, dust=0.34, dust_col=(134, 128, 116), panel_dust=0.35,
        stain=0.38, stain_col=(96, 80, 66), oil=1.15, gapcol=(24, 25, 27), lip=0.20)
    return _fx_save("hero_acp_charcoal", g, col, r, h, gain=2.5)

def fx_acp_copper():
    g = _Grid(3.6, 3.0); col, r, h = _acp(g, 4303, 1.2, 1.5, (150, 108, 80), tone=3.2, hue=2.0, rough0=0.30, brush="v", brush_k=0.20,
        streak=0.12, streak_col=(120, 86, 62), streak_len=0.45, dust=0.05, dust_col=(150, 120, 96), oil=1.2, band=0.02, row_shift=-9.0,
        gapcol=(36, 28, 24), lip=0.18)
    return _fx_save("hero_acp_copper", g, col, r, h, gain=2.5)

def fx_acp_grey():
    g = _Grid(2.4, 2.4); col, r, h = _acp(g, 4404, 1.2, 1.2, (70, 75, 80), tone=2.8, hue=1.5, rough0=0.40, brush="h", brush_k=0.07,
        streak=0.26, streak_col=(120, 120, 118), streak_len=0.5, dust=0.14, dust_col=(126, 122, 114), stain=0.12, flake=0.004, oil=1.0,
        gapcol=(28, 30, 32), lip=0.16)
    return _fx_save("hero_acp_grey", g, col, r, h, gain=2.5)

# ---------------------------------------------------------------- glazing
def _layout(g, rects):
    """rects: [(cx, cy, w, h)] in metres (wrapped with the tile). Returns pane id, local fx/fy (0..1) and signed distance (m, <0 inside)."""
    H, W = g.H, g.W
    pid = np.full((H, W), -1, int); fx = np.zeros((H, W)); fy = np.zeros((H, W)); sdf = np.full((H, W), 9.0)
    for i, (cx, cy, w, h) in enumerate(rects):
        dx = _per(g.X - cx, g.tw); dy = _per(g.Y - cy, g.th)
        s = np.maximum(np.abs(dx) - w / 2, np.abs(dy) - h / 2)
        m = s < 2.0 / g.pxm
        pid = np.where(m, i, pid); fx = np.where(m, np.clip(dx / w + 0.5, 0, 1), fx); fy = np.where(m, np.clip(dy / h + 0.5, 0, 1), fy)
        sdf = np.minimum(sdf, s)
    return pid, fx, fy, sdf

def _interior(g, pid, fx, fy, npane, seed, blinds=0.5, curtains=0.0):
    """What you see through vision glass: ceiling band with linear lights, dim desks, blinds at random heights, the odd curtain."""
    rng = np.random.default_rng(seed + 77)
    drop = _lut(pid, rng.uniform(0.05, 0.6, npane) * (rng.random(npane) < blinds))
    cur = _lut(pid, (rng.random(npane) < curtains) * rng.uniform(0.22, 0.5, npane)); side = _lut(pid, rng.integers(0, 2, npane))
    inter = mix(rgb(78, 80, 82), rgb(40, 42, 46), np.clip(fy * 1.3, 0, 1))
    ceilm = np.clip((0.14 - fy) * 40, 0, 1); inter = mix(inter, rgb(150, 150, 146), ceilm)
    lit = ceilm * ((np.abs(fy - 0.07) < 0.014) & (np.abs(fx - 0.5) < 0.36)); inter = mix(inter, rgb(238, 238, 230), lit)
    inter = mix(inter, rgb(62, 56, 50), ((fy > 0.74) & (fy < 0.80)) * 1.0)
    slat = (np.sin(2 * np.pi * g.Y / 0.05) > 0) * 1.0
    blind = mix(rgb(178, 176, 168), rgb(150, 148, 142), slat)
    inter = mix(inter, blind, (fy < drop) * 1.0)
    inter = mix(inter, rgb(204, 194, 176) * (0.85 + 0.15 * np.sin(fx * 70))[..., None], (np.where(side == 1, fx, 1 - fx) < cur) * 1.0)
    return inter

def _pane_paint(g, seed, pid, fx, fy, npane, sky_hi, sky_lo, base, w_base, w_sky, w_int, tone=3.0, diag=12.0, cloud_k=0.6,
                alt=None, blinds=0.5, curtains=0.0):
    """Reflective glass: a tinted base, a sky gradient in every pane (a different reflection per pane), soft clouds, a
    diagonal specular streak, and the interior showing through at w_int."""
    rng = np.random.default_rng(seed)
    ptone = _lut(pid, rng.normal(0, tone, npane)); pc = _lut(pid, rng.uniform(0.15, 0.85, npane))
    cloud = np.clip((pnoise(g.W, g.H, (3, 2), seed + 3, 4) - 0.48) * 3.0, 0, 1)
    sky = mix(np.array(sky_hi, dtype=float), np.array(sky_lo, dtype=float), np.clip(fy, 0, 1) ** 0.85)
    if alt is not None:   # opened awning sashes reflect the ground instead of the sky
        gnd = mix(rgb(118, 112, 102), rgb(70, 66, 60), np.clip(fy, 0, 1)); sky = mix(sky, gnd, alt * 1.0)
    sky = sky * (1 + cloud_k * cloud)[..., None]
    streak = np.exp(-((fx - 0.55 * fy - pc) / 0.10) ** 2) * diag
    inter = _interior(g, pid, fx, fy, npane, seed, blinds, curtains) if w_int > 0 else 0.0
    return np.array(base, dtype=float) * w_base + sky * w_sky + inter * w_int + (streak + ptone)[..., None]

def _frame_col(sdf, base, hi=0.22, gasket=0.5):
    s = np.clip(sdf, 0, None)
    k = 1 + hi * np.exp(-((s - 0.020) / 0.007) ** 2) - gasket * np.exp(-(s / 0.0035) ** 2)
    return np.array(base, dtype=float) * k[..., None]

def _glass_finish(g, seed, pid, sdf, glass_col, frame_base, spandrel_mask=None, spandrel_col=None, frame_hi=0.22, frame_rough=0.42,
                  glass_rough=0.05, grime_k=0.22, streak_ledges=(), dust_k=0.14, wave_mm=2.0, frame_gasket=0.5, frame_bevel=5.0):
    """Composite panes over frames, add grime near frames and dust runs under transoms, and build roughness and height."""
    rng = np.random.default_rng(seed + 9)
    cov = np.clip(0.5 - sdf * g.pxm, 0, 1)
    fcol = _frame_col(sdf, frame_base, frame_hi, frame_gasket) * (1 + 0.012 * _rn(rng, g.H, g.W, 1.0))[..., None]
    inside = np.clip(-sdf, 0, None)
    grime = np.exp(-inside / 0.09)
    gl = mix(glass_col, glass_col * 0.55 + np.array([34, 32, 28.0]) * 0.45, grime * grime_k)
    S = _streaks(g, seed + 51, list(streak_ledges), 0.9, cells=int(g.tw * 9), thresh=0.50, gain=3.0) if len(streak_ledges) else np.zeros((g.H, g.W))
    gl = mix(gl, gl * 0.7 + np.array([110, 106, 98.0]) * 0.3, S * dust_k * 2.0)
    fdirt = np.exp(-np.clip(sdf, 0, None) / 0.12)
    fcol = fcol * (1 - 0.10 * fdirt[..., None])
    col = fcol * (1 - cov)[..., None] + gl * cov[..., None]
    rough = (frame_rough + 0.05 * _rn(rng, g.H, g.W, 2.5)) * (1 - cov) + (glass_rough + 0.008 * _rn(rng, g.H, g.W, 3.0) + grime * 0.30 * grime_k * 4 + S * 0.30) * cov
    wave = (pnoise(g.W, g.H, (5, 6), seed + 61, 3) - 0.5) * 2 * wave_mm
    s = np.clip(sdf, 0, None)
    rec = _fblur(1 - cov, 0.8)
    hgt = frame_bevel * rec + 2.5 * np.exp(-((s - 0.020) / 0.007) ** 2) * (1 - cov) - 1.5 * np.exp(-(s / 0.0035) ** 2) * (1 - cov) + wave * cov
    return col, np.clip(rough, 0.03, 1), hgt, cov

def _frit(g, fy_loc, p=0.05, r0=0.0125):
    """White ceramic frit dots on a staggered grid, bigger and denser toward the bottom of the spandrel (fy_loc 0 top .. 1 bottom)."""
    row = np.floor(g.Y / p).astype(int) % 2
    dxl = _per(g.X - row * p / 2 - p / 2, p); dyl = (g.Y % p) - p / 2
    dist = np.hypot(dxl, dyl)
    dens = _sstep(fy_loc, 0.05, 0.85)
    r = r0 * (0.30 + 0.70 * dens)
    return np.clip(0.5 + (r - dist) * g.pxm, 0, 1) * (dens > 0.02)

def fx_glass_dark():
    # 6 m x 8 m: four 1.5 m bays, two 4 m floors. Vision glass 2.82 m high over a 0.88 m frit spandrel.
    g = _Grid(6.0, 8.0); rects = []; kinds = []
    for f in range(2):
        for b in range(4):
            cx = (b + 0.5) * 1.5
            rects.append((cx, f * 4 + 1.51, 1.435, 2.82)); kinds.append(0)
            rects.append((cx, f * 4 + 3.48, 1.435, 0.88)); kinds.append(1)
    pid, fx, fy, sdf = _layout(g, rects); n = len(rects); kind = _lut(pid, kinds)
    gc = _pane_paint(g, 5101, pid, fx, fy, n, (98, 120, 142), (34, 46, 60), (10, 14, 18), 1.0, 0.30, 0.11, tone=2.6, diag=11.0, cloud_k=0.75, blinds=0.25)
    # spandrel: dark back-painted glass with a white frit that fades up into the vision glass
    fr = _frit(g, fy)
    sp = np.array([32, 36, 40.0]) + 0.12 * (mix(rgb(98, 120, 142), rgb(34, 46, 60), fy) - 0) * 0.25
    sp = mix(sp, rgb(226, 228, 224), fr * 0.82)
    gc = np.where((kind == 1)[..., None], sp, gc)
    ledges = [f * 4 + 3.0 for f in range(2)] + [f * 4 + 4.0 for f in range(2)]
    col, r, h, cov = _glass_finish(g, 5101, pid, sdf, gc, (30, 32, 34), frame_hi=0.30, glass_rough=0.045, grime_k=0.30,
                                   streak_ledges=ledges, dust_k=0.09, wave_mm=2.2, frame_rough=0.40)
    r = np.where((kind == 1) & (cov > 0.5), 0.12 + 0.35 * fr, r)
    h = h - 0.6 * fr * cov
    return _fx_save("hero_glass_dark", g, col, r, h, gain=2.5)

def fx_glass_bluegrey():
    # one 4 m storey, 4.8 m wide, 1.2 m bays: spandrel band across the tile edge, fixed light, awning vent, lower light
    g = _Grid(4.8, 4.0); rects = []; kinds = []; opened = []
    rng = np.random.default_rng(5202); openb = [False, True, False, False]
    for b in range(4):
        cx = (b + 0.5) * 1.2
        rects += [(cx, 0.0, 1.14, 0.84), (cx, 1.125, 1.14, 1.25), (cx, 2.28, 1.04, 0.84), (cx, 3.17, 1.14, 0.70)]
        kinds += [3, 0, 1, 2]; opened += [False, False, openb[b], False]
    pid, fx, fy, sdf = _layout(g, rects); n = len(rects); kind = _lut(pid, kinds); alt = _lut(pid, opened)
    gc = _pane_paint(g, 5202, pid, fx, fy, n, (132, 156, 182), (66, 84, 108), (48, 62, 80), 0.60, 0.40, 0.12, tone=3.8, diag=14.0, cloud_k=0.55, alt=alt, blinds=0.45, curtains=0.1)
    slab = mix(rgb(40, 46, 54), rgb(26, 30, 36), fy); gc = np.where((kind == 3)[..., None], slab + (gc - 60) * 0.12, gc)
    col, r, h, cov = _glass_finish(g, 5202, pid, sdf, gc, (22, 23, 25), frame_hi=0.26, glass_rough=0.055, grime_k=0.25,
                                   streak_ledges=[0.45, 1.80, 2.70, 3.52], dust_k=0.10, wave_mm=2.0, frame_rough=0.45, frame_bevel=6.0)
    r = np.where((kind == 3) & (cov > 0.5), 0.16, r)
    return _fx_save("hero_glass_bluegrey", g, col, r, h, gain=2.5)

def fx_glass_green():
    # 6 m x 4 m storey, four 1.5 m ribbon bays, silver aluminium frames, transom at 2.45 m, tinted spandrel across the tile edge
    g = _Grid(6.0, 4.0); rects = []; kinds = []
    for b in range(4):
        cx = (b + 0.5) * 1.5
        rects += [(cx, 0.0, 1.43, 0.88), (cx, 1.45, 1.43, 1.90), (cx, 3.00, 1.43, 1.00)]; kinds += [1, 0, 0]
    pid, fx, fy, sdf = _layout(g, rects); n = len(rects); kind = _lut(pid, kinds)
    gc = _pane_paint(g, 5303, pid, fx, fy, n, (120, 158, 144), (58, 92, 82), (36, 68, 58), 0.60, 0.40, 0.22, tone=3.4, diag=13.0, cloud_k=0.6, blinds=0.55, curtains=0.05)
    sp = mix(rgb(40, 62, 56), rgb(26, 44, 40), fy) + (gc - 70) * 0.10; gc = np.where((kind == 1)[..., None], sp, gc)
    col, r, h, cov = _glass_finish(g, 5303, pid, sdf, gc, (176, 178, 176), frame_hi=0.14, glass_rough=0.05, grime_k=0.24,
                                   streak_ledges=[0.45, 2.40, 3.50], dust_k=0.11, wave_mm=2.0, frame_rough=0.34, frame_gasket=0.55)
    r = np.where((kind == 1) & (cov > 0.5), 0.14, r)
    return _fx_save("hero_glass_green", g, col, r, h, gain=2.5)

def fx_glass_teal():
    # one window unit 1.8 x 2.1 m: fanlight over a large fixed pane, white frames (tile edges are half the frame, so neighbours join)
    g = _Grid(1.8, 2.1)
    rects = [(0.9, 0.275, 1.70, 0.45), (0.9, 1.30, 1.70, 1.47)]; kinds = [0, 0]
    pid, fx, fy, sdf = _layout(g, rects); n = len(rects)
    gc = _pane_paint(g, 5404, pid, fx, fy, n, (126, 176, 174), (54, 100, 102), (26, 70, 72), 0.55, 0.42, 0.30, tone=3.0, diag=15.0, cloud_k=0.5, blinds=0.5, curtains=0.6)
    col, r, h, cov = _glass_finish(g, 5404, pid, sdf, gc, (232, 232, 228), frame_hi=0.05, glass_rough=0.06, grime_k=0.30,
                                   streak_ledges=[0.0, 0.50, 2.05], dust_k=0.12, wave_mm=2.4, frame_rough=0.55, frame_gasket=0.30, frame_bevel=7.0)
    rng = np.random.default_rng(5405)
    # painted-frame ageing: a warm dirt wash, drips under the transom and sill
    S = _streaks(g, 5406, [0.53, 2.07], 0.5, cells=int(g.tw * 22), thresh=0.5, gain=3.0)
    col = col * (1 - (S * 0.12 * (1 - cov))[..., None]) + 0 * col
    return _fx_save("hero_glass_teal", g, col, r, h, gain=2.5)

# ---------------------------------------------------------------- render (plaster)
def fx_plaster_cream():
    g = _Grid(2.4, 2.0); rng = np.random.default_rng(6101); W, H = g.W, g.H
    P = 0.5                                                  # a stucco band every 0.5 m
    grain = _rn(rng, H, W, 0.9); mid = _rn(rng, H, W, 3.2); lump = pnoise(W, H, (9, 8), 6102, 4) - 0.5
    groove = _line(g.Y, P, 0.016, 0.0, g.pxy); v = ((g.Y % P) / P) * np.ones((H, W))   # v 0 just under a groove .. 1 just above the next
    shadow = np.exp(-((g.Y % P) / 0.020)) * np.ones((H, W))           # dark lip right under each groove
    col = np.empty((H, W, 3)); col[:] = np.array([224, 213, 190.0])
    band_tone = rng.normal(0, 2.2, int(g.th / P)); col += band_tone[(np.floor(g.Y / P).astype(int) % len(band_tone))][..., None] * np.ones((H, W, 1))
    col += (lump * 16 + mid * 2.6 + grain * 3.2)[..., None] * np.array([1.0, 0.98, 0.9])
    col[..., 2] -= (pnoise(W, H, (3, 3), 6103, 4) - 0.5) * 12                 # patchy yellowing of old limewash
    S = _streaks(g, 6104, [i * P for i in range(int(g.th / P))], 0.20, cells=int(g.tw * 40), thresh=0.50, gain=3.0)
    col = mix(col, rgb(172, 156, 130), S * 0.32)
    col *= (1 - 0.16 * shadow)[..., None]; col = mix(col, rgb(142, 128, 106), groove * 0.75)
    cr = _cracks(g, rng, 7, 0.12, 0.5, 1.2); chip = _blobs(g, rng, 6, 0.012, 0.030)
    col = mix(col, rgb(138, 126, 108), cr * 0.55); col = mix(col, rgb(166, 162, 152), np.clip(chip * 1.4, 0, 1) * 0.8)
    rough = 0.90 + grain * 0.02 + mid * 0.015 - groove * 0.02 + S * 0.04 - chip * 0.05
    hgt = -9.0 * _fblur(groove, 0.6) + 2.5 * np.sin(np.pi * v) + lump * 4 + mid * 0.9 + grain * 0.30 - 1.2 * cr - 2.0 * chip
    return _fx_save("hero_plaster_cream", g, col, rough, hgt, gain=2.2)

def fx_plaster_white():
    g = _Grid(2.4, 2.4); rng = np.random.default_rng(6201); W, H = g.W, g.H
    grain = _rn(rng, H, W, 0.8); fine = _rn(rng, H, W, 0.5)
    t = pnoise(W, H, (6, 6), 6202, 5)                        # trowel swirls: domain-warped ridge noise
    dx = _rn(rng, H, W, 20) * 14; dy = _rn(rng, H, W, 20) * 14
    tw = _warp(t, dx, dy); ridge = 1 - np.abs(2 * tw - 1)
    ridge = _fblur(ridge, 1.2)
    sweep = pnoise(W, H, (14, 9), 6203, 3) - 0.5
    joint = _line(g.Y, 1.2, 0.008, 0.0, g.pxy)               # a fine control joint every 1.2 m
    col = np.empty((H, W, 3)); col[:] = np.array([233, 232, 227.0])
    col += ((ridge - 0.6) * 9 + sweep * 5 + grain * 1.3)[..., None] * np.array([1.0, 1.0, 1.0])
    col[..., 2] -= (pnoise(W, H, (3, 3), 6204, 3) - 0.5) * 3
    S = _streaks(g, 6205, [i * 1.2 for i in range(2)], 0.85, cells=int(g.tw * 18), thresh=0.52, gain=3.0)
    rain = np.clip((pnoise(W, H, (int(g.tw * 7), 1), 6206, 2) - 0.58) * 4, 0, 1) * np.clip(pnoise(W, H, (3, 2), 6207, 2) * 1.6 - 0.4, 0, 1)
    col = mix(col, rgb(196, 194, 186), np.clip(S * 0.34 + rain * 0.16, 0, 0.7)); col = mix(col, rgb(150, 148, 142), joint * 0.7)
    col *= (1 - 0.05 * np.exp(-((g.Y % 1.2) / 0.03)))[..., None]
    rough = 0.80 + (ridge - 0.6) * 0.10 + grain * 0.02 + S * 0.05 + fine * 0.01
    hgt = (ridge - 0.6) * 5.0 + sweep * 3.0 + grain * 0.25 + fine * 0.12 - 4.0 * _fblur(joint, 0.6)
    return _fx_save("hero_plaster_white", g, col, rough, hgt, gain=2.6)

FX_SETS = [
    ("hero_acp_white", fx_acp_white, 3.6, 3.0, "white ACP, three 1.2 x 3.0 m panels across, 12 mm shadow gaps, oil-canning, run-off streaks from the horizontal joint at the tile edge. Satin PVDF: metalness ~0.3, roughness from _r"),
    ("hero_acp_charcoal", fx_acp_charcoal, 3.6, 3.0, "A104 charcoal ACP, 1.2 x 3.0 m panels, vacant-building dust, pale dust runs, rust-brown staining. Satin: metalness ~0.3"),
    ("hero_acp_copper", fx_acp_copper, 3.6, 3.0, "A-14 copper and bronze anodised ACP, 1.2 x 1.5 m panels in two alternating tones, vertical brushed grain. Metalness 0.6-0.8, roughness from _r"),
    ("hero_acp_grey", fx_acp_grey, 2.4, 2.4, "A-14 crown and cornice dark grey ACP, 1.2 x 1.2 m panels, horizontal grain, faint metallic flake. Metalness ~0.4"),
    ("hero_glass_dark", fx_glass_dark, 6.0, 8.0, "Magnus dark glass bands: four 1.5 m bays, two 4.0 m floors (same grid as hero_glass), 2.82 m vision glass over a 0.88 m white-frit spandrel, dark anodised mullions. Glass roughness ~0.05, metalness 0"),
    ("hero_glass_bluegrey", fx_glass_bluegrey, 4.8, 4.0, "A104 blue-grey glazing, ONE storey: 1.2 m bays, upper fixed light, awning vent (every 2nd bay shown open), lower fixed light, charcoal spandrel band across the tile edge, black frames. Tile vertically per storey"),
    ("hero_glass_green", fx_glass_green, 6.0, 4.0, "A-14 green-tinted ribbon glazing, ONE storey: four 1.5 m bays, silver aluminium frames, transom at 2.45 m, spandrel across the tile edge"),
    ("hero_glass_teal", fx_glass_teal, 1.8, 2.1, "D-1 teal punched window unit: fanlight over a large pane, white frame (tile edge = half a frame, so neighbours share one). Map 0..1 per window, or tile for ribbon runs"),
    ("hero_plaster_cream", fx_plaster_cream, 2.4, 2.0, "D-1 cream stucco render with a V-groove every 0.5 m (4 per tile), sand-float grain, hairline cracks, chips, grime under each lip"),
    ("hero_plaster_white", fx_plaster_white, 2.4, 2.4, "A-14 side returns and Magnus podium: white painted render, trowel swirl, rain streaks, fine control joint every 1.2 m"),
]

def _fx_job(i):
    name, fn = FX_SETS[i][0], FX_SETS[i][1]
    return fn()

def jindalx_facades(only=None):
    import json, time, multiprocessing as mp
    t0 = time.time(); idx = [i for i, s in enumerate(FX_SETS) if not only or s[0] in only]
    with mp.get_context("fork").Pool(min(len(idx), os.cpu_count() or 4)) as pool: res = pool.map(_fx_job, idx, chunksize=1)
    tot = 0.0
    for name, kb in res: print(name, "%.0f KB" % kb); tot += kb
    path = os.path.join(OUT, "TILES.json")
    try: notes = json.load(open(path))
    except Exception: notes = {}
    for name, fn, tw, th, note in FX_SETS:
        if not only or name in only: notes[name] = [tw, th, note]
    json.dump(notes, open(path, "w"), indent=1)
    print("facade sets: %d, %.0f KB total, %.1fs" % (len(res), tot, time.time() - t0))

if "--facades" in sys.argv:
    jindalx_facades([a for a in sys.argv[sys.argv.index("--facades") + 1:] if not a.startswith("-")] or None); sys.exit(0)

if __name__ == "__main__" and "--only-new" in sys.argv:
    plaster("hero_plaster", (226, 220, 206), 121); plaster("hero_plaster_b", (176, 166, 150), 131)
    atlas("leaves_grass", grass); atlas("leaves_flower", flowers); print("done"); sys.exit(0)
glass(); spandrel(); alu(); stone(); concrete(); roof(); pavers(); asphalt(); lawn(); mulch(); bark(); ground_noida()
plaster("hero_plaster", (226, 220, 206), 121); plaster("hero_plaster_b", (176, 166, 150), 131)
atlas("leaves_a", neem); atlas("leaves_b", ashoka); atlas("leaves_palm", palm); atlas("leaves_shrub", shrub); atlas("leaves_bloom", bloom)
atlas("leaves_grass", grass); atlas("leaves_flower", flowers)
jindalx_facades()
print("done")
