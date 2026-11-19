"""Tileable true-scale textures for the RTP exterior, generated with numpy (no downloads, no satellite imagery).
usage: venv/bin/python -I textures.py <out dir>
Writes PNGs plus textures.json (name -> metres covered by one tile, so the builder can set UVs to true scale)."""
import json, os, sys, math
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.image as mpimg

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
R = np.random.default_rng(1911)
META = {}

def noise(n, beta=2.0, seed=None, m=None):
    """Periodic 1/f^beta noise in [0, 1] (tileable by construction)."""
    m = m or n; g = np.random.default_rng(seed) if seed is not None else R
    fx = np.fft.fftfreq(m)[None, :]; fy = np.fft.fftfreq(n)[:, None]; f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    spec = (g.normal(size=(n, m)) + 1j * g.normal(size=(n, m))) / f ** (beta / 2); spec[0, 0] = 0
    a = np.real(np.fft.ifft2(spec)); a = (a - a.min()) / (a.max() - a.min() + 1e-9); return a

def save(name, rgb, metres, alpha=None):
    a = np.clip(rgb, 0, 1)
    if alpha is not None: a = np.dstack([a, np.clip(alpha, 0, 1)])
    mpimg.imsave(os.path.join(OUT, name + ".png"), a)
    META[name] = {"tile_m": metres, "px": [a.shape[1], a.shape[0]]}

def col(hexs):
    h = hexs.lstrip("#"); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])

def mix(c1, c2, t): return c1[None, None, :] * (1 - t[..., None]) + c2[None, None, :] * t[..., None]

N = 1024
# ---------------------------------------------------------------- ground
def asphalt():
    n1 = noise(N, 1.2); n2 = noise(N, 2.6); speck = (R.random((N, N)) > 0.985) * 0.15
    base = 0.17 + 0.07 * (n1 - 0.5) + 0.05 * (n2 - 0.5) + speck
    patch = (noise(N, 3.2) > 0.72) * 0.035
    v = base - patch
    save("asphalt", np.dstack([v, v * 0.99, v * 0.97]), [6, 6])
asphalt()

def pavers(name, tile_m, p_m, c1, c2, joint=0.008):
    n = N; px = n / tile_m; nx = int(tile_m / p_m)
    y, x = np.mgrid[0:n, 0:n] / px
    jx = np.abs(((x / p_m) % 1) - 0.0); jy = np.abs(((y / p_m) % 1))
    jmask = ((np.minimum(jx, 1 - jx) * p_m) < joint) | ((np.minimum(jy, 1 - jy) * p_m) < joint)
    cell = (np.floor(x / p_m) + 31 * np.floor(y / p_m)).astype(int)
    rnd = np.random.default_rng(3).random(cell.max() + 1)[cell]
    t = 0.35 * noise(n, 1.5) + 0.25 * rnd + 0.4 * noise(n, 2.8)
    rgb = mix(col(c1), col(c2), t)
    rgb[jmask] *= 0.55
    save(name, rgb, [tile_m, tile_m])
pavers("paving", 4.8, 0.6, "#9d9b96", "#82807b")
pavers("court_paving", 4.8, 0.4, "#8f8a84", "#75706a")

def ground(name, tile, c1, c2, c3=None, beta=1.8, spots=0.0):
    n1 = noise(N, beta); n2 = noise(N, 2.8); t = np.clip(0.6 * n1 + 0.4 * n2, 0, 1)
    rgb = mix(col(c1), col(c2), t)
    if c3 is not None:
        m = np.clip((noise(N, 3.0) - 0.55) * 4, 0, 1); rgb = rgb * (1 - m[..., None]) + col(c3)[None, None, :] * m[..., None]
    rgb *= (0.92 + 0.16 * noise(N, 0.8))[..., None]
    save(name, rgb, [tile, tile])
ground("dirt", 10, "#87735a", "#6c5b46", "#6f7449")
ground("dry_grass", 12, "#6f7a45", "#566434", "#857852")
ground("lawn", 8, "#5d8a3c", "#4b7731", "#6e9645", beta=2.2)
ground("forest_floor", 12, "#4e6a34", "#3b5428", "#6b6a3e")
ground("scrub", 12, "#66733f", "#4c5e30", "#7d6e50")
ground("crop", 14, "#76804a", "#5d6c38", "#80734f")
ground("compound", 8, "#8f8a82", "#77726b", "#6d6253")
ground("industrial_yard", 10, "#9a968e", "#7c786f", "#6e5f4e")
ground("construction", 10, "#a47f57", "#8a6a48", "#9b9488")
ground("mud", 6, "#5b4c38", "#463a2b")
ground("gravel", 3, "#9d9a93", "#77746d", beta=0.6)
ground("ballast", 3, "#7d7871", "#5d5852", beta=0.5)
ground("water", 20, "#2e4a4e", "#22383b", beta=2.5)

# kerb: Indian black-and-yellow painted kerb, 1 m tile (0.5 m stripes)
k = np.zeros((128, 256, 3)); x = np.arange(256)[None, :] / 256.0
stripe = ((x * 2) % 1.0) < 0.5
k[:] = np.where(stripe[..., None], col("#d9b62c")[None, None, :], col("#1c1c1c")[None, None, :])
k *= (0.85 + 0.15 * noise(128, 1.5, m=256))[..., None]
save("kerb", k, [1.0, 0.3])

# ---------------------------------------------------------------- facades (tint multiplies the render colour)
def win_grid(w_m, h_m, px_per_m, bays, floors, win_w, win_h, sill, frame=0.06, seed=0, lit_frac=0.35, lit_col="#ffd9a0",
             base="#ffffff", glass="#202428", grille=False, shade_frac=0.3, balcony=False):
    W, H = int(w_m * px_per_m), int(h_m * px_per_m); g = np.random.default_rng(seed)
    y, x = np.mgrid[0:H, 0:W] / px_per_m; y = h_m - y      # y up
    rgb = np.ones((H, W, 3)) * col(base)[None, None, :]
    dirt = noise(H, 1.6, seed=seed + 1, m=W); streak = noise(H, 3.0, seed=seed + 2, m=W)
    rgb *= (0.86 + 0.14 * dirt)[..., None]
    emit = np.zeros((H, W, 3))
    bw = w_m / bays; fh = h_m / floors
    for f in range(floors):
        for b in range(bays):
            x0 = b * bw + (bw - win_w) / 2; y0 = f * fh + sill
            m = (x >= x0) & (x < x0 + win_w) & (y >= y0) & (y < y0 + win_h)
            mi = (x >= x0 + frame) & (x < x0 + win_w - frame) & (y >= y0 + frame) & (y < y0 + win_h - frame)
            rgb[m] = col("#d8d6d0") if not grille else col("#3a3a3a")
            gl = col(glass) * (0.8 + 0.4 * g.random())
            rgb[mi] = gl
            if g.random() < shade_frac:        # curtain / blind inside
                cm = mi & (y > y0 + win_h * g.uniform(0.3, 0.9)); rgb[cm] = col(g.choice(["#c9b79a", "#9fb0b8", "#d6c8b5", "#8c7a6a"])) * 0.6
            if grille:
                gm = mi & ((((x - x0) / 0.12) % 1 < 0.15) | (((y - y0) / 0.25) % 1 < 0.08)); rgb[gm] = col("#2b2b2b")
            if g.random() < lit_frac:
                e = col(lit_col) * g.uniform(0.6, 1.0); emit[mi] = e[None, :] * (0.75 + 0.25 * ((y[mi] - y0) / win_h))[:, None]
        if balcony:
            bm = (y >= f * fh) & (y < f * fh + 0.12); rgb[bm] *= 0.7
        sl = (y >= f * fh + sill - 0.06) & (y < f * fh + sill); rgb[sl] *= 0.75     # sill shadow line
    rgb *= (1 - 0.12 * np.clip((streak - 0.6) * 3, 0, 1) * (y / h_m))[..., None]     # rain streaks
    return rgb, emit

def ground_floor(rgb, em, w_m, h_m, px_per_m, fh, kind, seed):
    """Overwrite the bottom floor of a facade tile: 'shops' (rolling shutters, sign boards, a few open lit shops) or 'stilts' (CIDCO stilt parking)."""
    g = np.random.default_rng(seed); H, W = rgb.shape[:2]; y, x = np.mgrid[0:H, 0:W] / px_per_m; y = h_m - y
    gf = y < fh
    if kind == "stilts":
        rgb[gf] = col("#1a1a1a"); pil = gf & ((x % 4.0) < 0.35); rgb[pil] = col("#cfcac0")
        beam = (y > fh - 0.45) & (y < fh); rgb[beam] = col("#d8d3c8")
        return
    bw = 3.0
    for b in range(int(w_m / bw)):
        x0 = b * bw + 0.15; x1 = (b + 1) * bw - 0.15
        m = gf & (x >= x0) & (x < x1) & (y < fh - 0.75) & (y > 0.05)
        if g.random() < 0.35:     # open shop, lit at night
            rgb[m] = col("#3a3328") * g.uniform(0.7, 1.2); em[m] = col("#ffe0b0") * g.uniform(0.6, 1.0)
        else:
            sh = col(g.choice(["#8d9397", "#6e7f8c", "#5f7a63", "#9a8f7e", "#7b8794"])); ripple = 0.85 + 0.15 * np.sin(2 * np.pi * y[m] / 0.08)
            rgb[m] = sh[None, :] * ripple[:, None]
        sb = gf & (x >= x0) & (x < x1) & (y >= fh - 0.72) & (y < fh - 0.15)
        c = col(g.choice(["#c0392b", "#f1c40f", "#2e86c1", "#1e8449", "#f39c12", "#ffffff", "#8e44ad"])); rgb[sb] = c * 0.9
        em[sb] = c * (0.5 if g.random() < 0.6 else 0.0)
        tx = sb & ((((x - x0) * 6) % 1) < 0.45) & (np.abs(y - (fh - 0.43)) < 0.12); rgb[tx] = (1 - c) * 0.8 + 0.1
for i, (nm, base) in enumerate((("house_wall_a", "#ffffff"), ("house_wall_b", "#f4efe6"))):
    rgb, em = win_grid(12, 12, 85, 4, 4, 1.1, 1.2, 0.9, seed=10 + i, lit_frac=0.4, base=base, grille=True, shade_frac=0.5)
    if i == 1: ground_floor(rgb, em, 12, 12, 85, 3.0, "shops", 15)
    save(nm, rgb, [12, 12]); save(nm + "_emit", em, [12, 12])
rgb, em = win_grid(12, 12.4, 82, 4, 4, 1.6, 1.35, 0.85, seed=20, lit_frac=0.45, base="#ffffff", grille=False, shade_frac=0.6, balcony=True)
ground_floor(rgb, em, 12, 12.4, 82, 3.1, "stilts", 21)
save("block_wall", rgb, [12, 12.4]); save("block_wall_emit", em, [12, 12.4])
# office punched (concrete + ribbon windows)
rgb, em = win_grid(14.4, 14.4, 70, 6, 4, 2.2, 1.9, 0.9, seed=30, lit_frac=0.55, lit_col="#e8f0ff", base="#cfccc4", glass="#2a3a40", shade_frac=0.1)
save("office_punched", rgb, [14.4, 14.4]); save("office_punched_emit", em, [14.4, 14.4])

def curtain(name, w_m, h_m, px_per_m, mod, ftf, tint, spandrel, seed, lit_frac=0.6, lit="#eef4ff"):
    W, H = int(w_m * px_per_m), int(h_m * px_per_m); g = np.random.default_rng(seed)
    y, x = np.mgrid[0:H, 0:W] / px_per_m; y = h_m - y
    n = noise(H, 2.2, seed=seed, m=W)
    rgb = np.ones((H, W, 3)) * col(tint)[None, None, :] * (0.85 + 0.3 * n)[..., None]
    # sky-gradient fake reflection per panel (slight variation, reads as glass at distance)
    fl = np.floor(y / ftf); pn = np.floor(x / mod)
    var = np.random.default_rng(seed + 5).random((int(h_m / ftf) + 2, int(w_m / mod) + 2))[fl.astype(int), pn.astype(int)]
    rgb *= (0.88 + 0.22 * var)[..., None]
    yy = y % ftf
    sp = (yy < 0.9); rgb[sp] = col(spandrel)[None, :] * (0.9 + 0.1 * n[sp])[:, None]
    mull = ((x % mod) < 0.06) | ((x % mod) > mod - 0.02) | (np.abs(yy - 0.9) < 0.04) | (yy < 0.05)
    rgb[mull] = col("#8d9296")
    emit = np.zeros_like(rgb)
    for f in range(int(h_m / ftf)):
        floor_on = g.random() < lit_frac
        for b in range(int(w_m / (mod * 3))):
            if (floor_on and g.random() < 0.85) or (not floor_on and g.random() < 0.08):
                m = (fl == f) & (x >= b * mod * 3) & (x < (b + 1) * mod * 3) & (yy > 0.95) & ~mull
                emit[m] = col(lit)[None, :] * g.uniform(0.55, 1.0) * (0.6 + 0.4 * ((yy[m] - 0.9) / (ftf - 0.9)))[:, None]
    return rgb, emit
rgb, em = curtain("office_glass", 14.4, 14.4, 70, 1.2, 3.6, "#3f6670", "#5a6468", 40)
save("office_glass", rgb, [14.4, 14.4]); save("office_glass_emit", em, [14.4, 14.4])
rgb, em = curtain("office_glass_b", 14.4, 14.4, 70, 1.5, 3.6, "#4c5f6e", "#a9adb0", 41, lit_frac=0.5, lit="#fff2dc")
save("office_glass_b", rgb, [14.4, 14.4]); save("office_glass_b_emit", em, [14.4, 14.4])

# industrial ribbed cladding (vertical trapezoidal ribs every 0.2 m) and perforated parking louvres
W = 512; x = np.arange(W)[None, :] / W * 4.0; y = np.arange(W)[:, None] / W * 4.0
rib = 0.5 + 0.5 * np.cos(2 * np.pi * x / 0.2)
v = (0.78 + 0.16 * rib) * (0.9 + 0.1 * noise(W, 1.5))
dirt = np.clip((noise(W, 2.5) - 0.5) * 2, 0, 1) * (1 - y / 4.0) * 0.25
v = np.broadcast_to(v, (W, W))
save("cladding", np.dstack([v - dirt, v - dirt, v - dirt * 0.8]), [4, 4])
lv = np.ones((W, W, 3)) * col("#8d9093")[None, None, :]
holes = np.broadcast_to(((((x * 12) % 1) - 0.5) ** 2 + (((y * 12) % 1) - 0.5) ** 2) < 0.09, (W, W))
lv[holes] = col("#202224"); lv[np.broadcast_to((y % 3.0) < 0.25, (W, W))] = col("#b5b3ae")
save("louvre", lv, [4, 4])

# roofs
W = 1024; y, x = np.mgrid[0:W, 0:W] / W * 6.0
corr = 0.5 + 0.5 * np.sin(2 * np.pi * x / 0.076)
seams = ((y % 2.4) < 0.03)
rust = np.clip((noise(W, 2.0) - 0.45) * 2.2, 0, 1)
base = np.where((np.floor(x / 0.9) + np.floor(y / 2.4)).astype(int)[..., None] % 7 == 0, col("#8f9aa1")[None, None, :], col("#a9adb0")[None, None, :])
tin = base * (0.8 + 0.2 * corr)[..., None]
tin = tin * (1 - rust[..., None]) + mix(col("#7a4b2c"), col("#5b3a26"), noise(W, 2.6))[...] * rust[..., None] * (0.8 + 0.2 * corr)[..., None]
tin[seams] *= 0.6
blue = np.clip((noise(W, 3.0, seed=7) - 0.8) * 8, 0, 1)                 # occasional blue tarpaulin patches
tin = tin * (1 - blue[..., None]) + col("#2b5fa8")[None, None, :] * blue[..., None]
save("tin_roof", tin, [6, 6])
W = 1024; y, x = np.mgrid[0:W, 0:W] / W * 4.0
row = np.floor(y / 0.34); xs = x + (row % 2) * 0.12
tile = ((xs % 0.24) / 0.24); ty = ((y % 0.34) / 0.34)
shape = (0.55 + 0.45 * np.sin(np.pi * tile)) * (0.75 + 0.25 * ty)
terra = mix(col("#a1502e"), col("#7d3a22"), noise(W, 2.0)) * shape[..., None]
moss = np.clip((noise(W, 2.4, seed=9) - 0.6) * 3, 0, 1) * 0.6
terra = terra * (1 - moss[..., None]) + col("#3b3a2a")[None, None, :] * moss[..., None]
save("terracotta_roof", terra, [4, 4])
W = 1024; n1 = noise(W, 1.4); n2 = noise(W, 2.8)
ter = mix(col("#b4aea3"), col("#8f877b"), 0.5 * n1 + 0.5 * n2)
stain = np.clip((noise(W, 2.2, seed=11) - 0.55) * 3, 0, 1); ter = ter * (1 - 0.35 * stain[..., None])
wp = np.clip((noise(W, 3.0, seed=12) - 0.75) * 6, 0, 1); ter = ter * (1 - wp[..., None]) + col("#e8e6e0")[None, None, :] * wp[..., None]
save("terrace_roof", ter, [8, 8])

# RTP materials: ACP (silver-grey satin, joints on the curtain-wall module), RCC / render, slab soffit
mod = float(sys.argv[2]) if len(sys.argv) > 2 else 1.368
W = 1024; Hh = 256; x = np.arange(W)[None, :] / W * (mod * 6); y = np.arange(Hh)[:, None] / Hh * 1.0
acp = np.ones((Hh, W, 3)) * col("#a3a8ac")[None, None, :] * (0.95 + 0.05 * noise(Hh, 1.2, m=W))[..., None]
j = ((x % (mod * 2)) < 0.012) | (np.abs(y - 0.5) < 0.004)
acp[np.broadcast_to(j, (Hh, W))] *= 0.55
save("acp", acp, [mod * 6, 1.0])
W = 1024; cc = mix(col("#b8b3aa"), col("#9e988e"), 0.6 * noise(W, 1.3) + 0.4 * noise(W, 3.0))
save("concrete", cc, [4, 4])
save("render_grey", mix(col("#8e9397"), col("#7c8186"), noise(W, 1.6)), [4, 4])

# RTP interior glow: ceiling panel rows, desk clutter silhouettes, partitions, occasional dark bays. 40 m x 2.75 m (vision glass height)
W, Hh = 4096, 280; px = W / 40.0
x = np.arange(W)[None, :] / px; y = (Hh - np.arange(Hh)[:, None]) / Hh * 2.75
g = np.random.default_rng(77)
em = np.zeros((Hh, W, 3)); warmth = col("#fff1dc"); cool = col("#e9f1ff")
ceil = np.clip(1 - np.abs(y - 2.62) / 0.12, 0, 1)                       # ceiling plane glow
panels = ((x % 1.2) < 0.6) & (np.abs(y - 2.70) < 0.04)
bay = np.floor(x / 4.1).astype(int); bayv = g.random(bay.max() + 2)[bay]
lit = bayv > 0.18
desk = (y < 1.05) & (y > 0.72) & (((x * 3.1) % 1.8) < 1.2)
person = (y < 1.45) & (y > 0.75) & (((x + 0.7) % 3.3) < 0.35) & (g.random((1, W)) > 0.0)
partition = (((x + 2.0) % 12.3) < 0.15)
interior = 0.32 + 0.25 * (y / 2.75) + 0.6 * ceil
col_mix = np.where((bay % 3 == 0)[..., None], cool[None, None, :], warmth[None, None, :])
em = col_mix * interior[..., None]
em[np.broadcast_to(panels, em.shape[:2])] = col("#ffffff") * 1.6
em[np.broadcast_to(desk, em.shape[:2])] *= 0.35
em[np.broadcast_to(person & (y < 1.45), em.shape[:2])] *= 0.4
em[np.broadcast_to(partition, em.shape[:2])] *= 0.15
em *= np.where(np.broadcast_to(lit, em.shape[:2]), 1.0, 0.04)[..., None]
em = np.clip(em / 1.6, 0, 1)
save("rtp_interior_emit", em, [40.0, 2.75])
alb = np.clip(0.06 + 0.10 * (y / 2.75) + 0.0 * x, 0, 1); alb = np.broadcast_to(alb, (Hh, W))
dk = np.dstack([alb * 0.9, alb * 0.95, alb]); dk[np.broadcast_to(desk, (Hh, W))] *= 0.6
save("rtp_interior_base", dk, [40.0, 2.75])

# foliage: palm frond (RGBA, frond along x) and broadleaf leaf-cluster card
W, Hh = 512, 128; x = np.arange(W)[None, :] / W; y = np.arange(Hh)[:, None] / Hh - 0.5
rachis = np.abs(y) < 0.02
leaflet_len = 0.48 * np.sin(np.pi * np.clip(x * 1.05, 0, 1)) ** 0.7
phase = (x * 60) % 1.0
leaflet = (np.abs(y) < leaflet_len) & (np.abs(phase - 0.5 - np.abs(y) * 0.8 % 1) < 0.28)
a = (leaflet | rachis).astype(float)
c = mix(col("#4f7a2e"), col("#2f5320"), noise(Hh, 2.0, m=W)) * (0.8 + 0.4 * (0.5 - np.abs(y)))[..., None]
c[np.broadcast_to(rachis, (Hh, W))] = col("#6b7a3a")
tipdry = np.clip((x - 0.8) * 5, 0, 1) * 0.5; c = c * (1 - tipdry[..., None]) + col("#8a7d45") * tipdry[..., None]
save("palm_frond", c, [1, 1], alpha=a)
W = 512; yy, xx = np.mgrid[0:W, 0:W] / W
alpha = np.zeros((W, W)); cc = np.zeros((W, W, 3))
for i in range(260):
    cx, cy = g.random(), g.random(); r = g.uniform(0.02, 0.05); ang = g.uniform(0, np.pi)
    dx, dy = xx - cx, yy - cy; u = dx * np.cos(ang) + dy * np.sin(ang); v = -dx * np.sin(ang) + dy * np.cos(ang)
    m = (u / r) ** 2 + (v / (r * 0.5)) ** 2 < 1
    m &= ((xx - 0.5) ** 2 + (yy - 0.5) ** 2) < 0.22
    alpha[m] = 1; cc[m] = mix(col("#4b7a30"), col("#2c4d1d"), np.full((1, 1), g.random()))[0, 0] * g.uniform(0.75, 1.15)
save("leaf_card", cc, [1, 1], alpha=alpha)

# sign face (red, slightly brighter centre) and emissive strips
# opaque textures also as JPEG (what the builder and the GLBs use); foliage keeps PNG alpha
from PIL import Image
for k in META:
    if k in ("palm_frond", "leaf_card"): META[k]["file"] = k + ".png"; continue
    Image.open(os.path.join(OUT, k + ".png")).convert("RGB").save(os.path.join(OUT, k + ".jpg"), quality=86, optimize=True); META[k]["file"] = k + ".jpg"
json.dump(META, open(os.path.join(OUT, "textures.json"), "w"), indent=1)
print(len(META), "textures ->", OUT)
