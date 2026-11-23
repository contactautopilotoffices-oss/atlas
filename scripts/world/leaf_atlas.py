"""Leaf atlases for the explorer's trees: RGBA cut-out cards, generated (no third-party art).

  python scripts/world/leaf_atlas.py TEX_DIR [name ...]

Each card is a spray of leaves drawn at 2048 px and reduced to 512 px (the cut-out edge is clean after the reduction; the
page and Blender both alpha-test at 0.5). The trees are built from crossed and outward-facing cards of these, so what a card
shows is what a crown looks like: light tips and darker, shaded leaves inside, every leaf lit on one half and shaded on the
other, a pale midrib, gaps to see the sky through. Light colours on purpose: the first version read as flat dark blobs.

  leaves_a      broadleaf (neem / jamun style): pinnate sprays of glossy leaflets, fresh green
  leaves_young  the same crown's new flush: yellow-green, for the sunlit outer and upper clusters
  leaves_b      ashoka (Polyalthia): long narrow wavy leaves hanging in layers
  leaves_palm   one palm frond, pinnate, leaflets drooping
  leaves_shrub  hedge and shrub: small glossy rounded leaves, tight
  leaves_gul    gulmohar / rain tree: fine bipinnate sprays, light and feathery (an umbrella crown of small leaflets)

The card layout (what the models' UVs expect) is unchanged from hero_textures.py: leaves_a, _b, _shrub fill the card;
leaves_palm is one frond along the card's x axis at mid height.
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw

SS = 2048   # draw size; the card is 512


def _col(c, k=0.0, j=0, rng=None):
    v = (rng.uniform(-j, j) if rng is not None and j else 0)
    return tuple(int(np.clip(x * (1 + k) + v, 0, 255)) for x in c) + (255,)


def _mixc(a, b, t): return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def leaf_pts(cx, cy, length, width, ang, n=12, curve=0.0, tip=0.0, side=0):
    """Outline of one leaf (or one half of it, side = +1 / -1): pointed at the tip, widest a third of the way along."""
    pts = []
    sides = (1, -1) if side == 0 else (side,)
    for sd in sides:
        rng_ = range(n + 1) if sd == sides[0] else range(n, -1, -1)
        for i in rng_:
            t = i / n; w = width * (math.sin(math.pi * t ** 0.75) ** 0.9)
            px = t * length; py = (sd * w / 2 if side == 0 or True else 0) + curve * length * t * t
            if side != 0 and False: py = 0
            pts.append((cx + px * math.cos(ang) - py * math.sin(ang), cy + px * math.sin(ang) + py * math.cos(ang)))
    if side != 0:   # a half leaf closes along the midrib
        mid = [(cx + (t * length) * math.cos(ang) - (curve * length * t * t) * math.sin(ang), cy + (t * length) * math.sin(ang) + (curve * length * t * t) * math.cos(ang)) for t in np.linspace(0, 1, n + 1)]
        pts = [mid[0]] + [p for p in pts[:n + 1]] + mid[::-1][:-1]
        # the outline above ran base to tip along the outer edge; the midrib runs tip to base
    return pts


def leaflet(d, cx, cy, ang, L, W, base, light, rng, curve=0.12):
    """One glossy leaflet: lit upper half, shaded lower half, a pale midrib, darker rim."""
    n = 10
    up, lo = [], []
    for i in range(n + 1):
        t = i / n; w = W * (math.sin(math.pi * t ** 0.78) ** 0.95) / 2
        mx_, my_ = t * L, curve * L * t * t
        for sd, arr in ((1, up), (-1, lo)):
            px, py = mx_, my_ + sd * w
            arr.append((cx + px * math.cos(ang) - py * math.sin(ang), cy + px * math.sin(ang) + py * math.cos(ang)))
    mid = [(cx + (t * L) * math.cos(ang) - (curve * L * t * t) * math.sin(ang), cy + (t * L) * math.sin(ang) + (curve * L * t * t) * math.cos(ang)) for t in np.linspace(0, 1, n + 1)]
    lit = _mixc(base, light, 0.55); shade = tuple(c * 0.82 for c in base)
    d.polygon(up + mid[::-1], fill=tuple(int(c) for c in lit) + (255,))
    d.polygon(lo + mid[::-1], fill=tuple(int(c) for c in shade) + (255,))
    d.line(mid, fill=tuple(int(c) for c in _mixc(light, (235, 240, 190), 0.5)) + (255,), width=max(1, int(W * 0.06)))


def spray(d, rng, x0, y0, x1, y1, bow, n, palette, leaf_len, leaf_w, pairs=(6, 9), layers=1):
    """A twig from (x0, y0) to (x1, y1), bowed sideways, with n compound leaves along it; tips light, base dark."""
    dark, mid, light = palette
    tw = [((1 - t) ** 2 * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2 + bow) + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2) + t * t * y1) for t in np.linspace(0, 1, 40)]
    d.line(tw, fill=_col((86, 74, 44)), width=int(SS * 0.006))
    for i in range(n):
        t = (i + 0.7) / (n + 0.4); k = int(t * 39); px, py = tw[k]; tx, ty = tw[min(39, k + 1)][0] - px, tw[min(39, k + 1)][1] - py
        ta = math.atan2(ty, tx)
        for sd in (-1, 1):
            a = ta + sd * rng.uniform(0.75, 1.15) - sd * 0.15 * t        # leaves sweep forward toward the tip
            Lr = leaf_len * (1.15 - 0.55 * t) * rng.uniform(0.85, 1.1)
            d.line([(px, py), (px + math.cos(a) * Lr, py + math.sin(a) * Lr)], fill=_col((100, 96, 56)), width=int(SS * 0.004))
            m = int(rng.integers(pairs[0], pairs[1] + 1))
            for j in range(m):
                u = (j + 0.8) / (m + 0.6); qx, qy = px + math.cos(a) * Lr * u, py + math.sin(a) * Lr * u
                for sj in (-1, 1):
                    la = a + sj * rng.uniform(0.9, 1.25); Ll = leaf_w * (1.0 - 0.45 * u) * rng.uniform(0.85, 1.12) * 2.6
                    shade = np.clip(0.25 + 0.55 * t + rng.uniform(-0.28, 0.28), 0, 1)
                    base = _mixc(dark, mid, shade); lt = _mixc(mid, light, np.clip(shade + 0.15, 0, 1))
                    leaflet(d, qx, qy, la, Ll, Ll * 0.34, base, lt, rng)
        # terminal leaflet
    ex, ey = tw[-1]; ta = math.atan2(tw[-1][1] - tw[-4][1], tw[-1][0] - tw[-4][0])
    for k in range(3):
        leaflet(d, ex, ey, ta + (k - 1) * 0.5, leaf_w * 2.9, leaf_w * 1.0, mid, light, rng)


def finish(img, out, name):
    arr = np.array(img).astype(float); a = arr[..., 3:4] / 255
    mean = (arr[..., :3] * a).sum((0, 1)) / max(1, a.sum())
    arr[..., :3] = arr[..., :3] * a + mean * (1 - a)    # texels outside the cut-out take the leaf colour, so mip-maps do not bleed black
    im = Image.fromarray(arr.astype(np.uint8), "RGBA").resize((512, 512), Image.LANCZOS)
    im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(out, name + ".png"), optimize=True)
    print(name, round(os.path.getsize(os.path.join(out, name + ".png")) / 1024), "KB")


def card_broadleaf(seed, palette, sprays=4, young=False):
    rng = np.random.default_rng(seed); img = Image.new("RGBA", (SS, SS), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    S = SS
    for k in range(sprays):   # a fan of sprays from the card's lower edge, back ones first (darker via the palette's shade ramp)
        ang = (k - (sprays - 1) / 2) * 0.34 + rng.uniform(-0.08, 0.08)
        x0 = S * (0.5 + 0.1 * (k - (sprays - 1) / 2) * 0.8); y0 = S * 0.98
        L = S * rng.uniform(0.82, 0.95); x1 = x0 + math.sin(ang) * L; y1 = y0 - math.cos(ang) * L
        spray(d, rng, x0, y0, x1, y1, bow=S * rng.uniform(-0.07, 0.07), n=7, palette=palette, leaf_len=S * 0.26, leaf_w=S * 0.055, pairs=(5, 7))
    return img


def card_ashoka(seed):
    rng = np.random.default_rng(seed); S = SS; img = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    dark, mid, light = (34, 74, 34), (58, 110, 46), (112, 160, 76)
    order = sorted(range(420), key=lambda i: rng.random())
    for i in range(420):
        cx = rng.uniform(0.03, 0.97) * S; cy = rng.uniform(-0.02, 0.68) * S
        a = math.pi / 2 + rng.uniform(-0.35, 0.35) + 0.25 * math.sin(cx / S * 6)
        L = S * rng.uniform(0.22, 0.34); W = S * rng.uniform(0.022, 0.034)
        t = cy / S; sh = np.clip(rng.uniform(0, 1) * 0.7 + t * 0.4, 0, 1)
        base = _mixc(dark, mid, sh); lt = _mixc(mid, light, sh)
        n = 18; up, lo = [], []
        for j in range(n + 1):
            u = j / n; w = W * (math.sin(math.pi * u ** 0.7) ** 0.9) / 2; wav = 0.012 * S * math.sin(u * math.pi * 3 + cx)
            for sd, arr in ((1, up), (-1, lo)):
                px, py = u * L, wav + sd * w
                arr.append((cx + px * math.cos(a) - py * math.sin(a), cy + px * math.sin(a) + py * math.cos(a)))
        mid_l = [(cx + (j / n * L) * math.cos(a) - (0.012 * S * math.sin(j / n * math.pi * 3 + cx)) * math.sin(a), cy + (j / n * L) * math.sin(a) + (0.012 * S * math.sin(j / n * math.pi * 3 + cx)) * math.cos(a)) for j in range(n + 1)]
        d.polygon(up + mid_l[::-1], fill=tuple(int(c) for c in lt) + (255,))
        d.polygon(lo + mid_l[::-1], fill=tuple(int(c * 0.86) for c in base) + (255,))
    return img


def card_palm(seed):
    rng = np.random.default_rng(seed); S = SS; img = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.line([(S * 0.02, S * 0.5), (S * 0.98, S * 0.5)], fill=(150, 142, 84, 255), width=int(S * 0.012))
    for i in range(64):
        t = (i + 0.5) / 64; x = S * (0.03 + 0.95 * t); Ln = S * 0.47 * math.sin(math.pi * (0.12 + 0.88 * t)) ** 0.7
        for sd in (-1, 1):
            a = sd * (math.pi / 2 - 0.5 - 0.18 * t) + rng.uniform(-0.06, 0.06)
            sh = np.clip(0.3 + 0.6 * t + rng.uniform(-0.2, 0.2), 0, 1)
            base = _mixc((56, 100, 40), (96, 142, 58), sh); lt = _mixc((96, 142, 58), (150, 186, 88), sh)
            leaflet(d, x, S * 0.5, a, Ln, S * 0.022, base, lt, rng, curve=0.18 * sd * 0 + 0.0)
    return img


def card_shrub(seed, palette, n=1500, size=(0.03, 0.05)):
    rng = np.random.default_rng(seed); S = SS; img = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    dark, mid, light = palette
    pts = rng.uniform(0.02, 0.98, (n, 2)) * S
    order = np.argsort(pts[:, 1] * 0.0 + rng.random(n))
    for i in order:
        cx, cy = pts[i]; sh = np.clip(rng.uniform(0, 1) * 0.8 + (1 - cy / S) * 0.25, 0, 1)
        L = S * rng.uniform(*size); a = rng.uniform(0, math.tau)
        base = _mixc(dark, mid, sh); lt = _mixc(mid, light, sh)
        leaflet(d, cx, cy, a, L * 1.1, L * 0.62, base, lt, rng, curve=0.05)
    return img


def card_gulmohar(seed):
    """Feathery bipinnate sprays: many small narrow leaflets on fine rachises, light lime green."""
    rng = np.random.default_rng(seed); S = SS; img = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    pal = ((70, 120, 52), (116, 164, 66), (170, 206, 104))
    for k in range(5):
        ang = (k - 2) * 0.32 + rng.uniform(-0.07, 0.07); x0 = S * (0.5 + 0.07 * (k - 2)); y0 = S * 0.98; L = S * rng.uniform(0.8, 0.95)
        x1 = x0 + math.sin(ang) * L; y1 = y0 - math.cos(ang) * L
        tw = [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) for t in np.linspace(0, 1, 30)]
        d.line(tw, fill=(96, 84, 52, 255), width=int(S * 0.005))
        for i in range(9):
            t = (i + 0.6) / 9.4; px, py = tw[int(t * 29)]
            for sd in (-1, 1):
                a = ang - math.pi / 2 * sd * -1 + sd * 0.0 - math.pi / 2 + (sd > 0) * math.pi - sd * 0.0
                a = math.atan2(y1 - y0, x1 - x0) + sd * rng.uniform(0.8, 1.1)
                Lr = S * 0.2 * (1.1 - 0.5 * t)
                d.line([(px, py), (px + math.cos(a) * Lr, py + math.sin(a) * Lr)], fill=(100, 96, 56, 255), width=int(S * 0.003))
                for j in range(14):
                    u = (j + 0.7) / 14.6; qx, qy = px + math.cos(a) * Lr * u, py + math.sin(a) * Lr * u
                    for sj in (-1, 1):
                        la = a + sj * rng.uniform(1.15, 1.45); Ll = S * 0.034 * (1 - 0.3 * u)
                        sh = np.clip(0.3 + 0.6 * t + rng.uniform(-0.3, 0.3), 0, 1)
                        leaflet(d, qx, qy, la, Ll, Ll * 0.36, _mixc(pal[0], pal[1], sh), _mixc(pal[1], pal[2], sh), rng, curve=0.0)
    return img


BROAD = ((50, 92, 38), (104, 150, 56), (168, 204, 96))
YOUNG = ((92, 132, 46), (150, 188, 74), (206, 222, 118))
SHRUB = ((44, 86, 36), (86, 132, 52), (150, 186, 88))
CARDS = {
    "leaves_a": lambda: card_broadleaf(301, BROAD, 4),
    "leaves_young": lambda: card_broadleaf(302, YOUNG, 4),
    "leaves_b": lambda: card_ashoka(303),
    "leaves_palm": lambda: card_palm(304),
    "leaves_shrub": lambda: card_shrub(305, SHRUB),
    "leaves_gul": lambda: card_gulmohar(306),
}


def write(out, names=None):
    os.makedirs(out, exist_ok=True)
    for n, fn in CARDS.items():
        if names and n not in names: continue
        finish(fn(), out, n)


if __name__ == "__main__":
    write(sys.argv[1], sys.argv[2:] or None)
