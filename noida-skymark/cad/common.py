"""Shared helpers for the generic Skymark CAD pipeline (noida-skymark/cad).

Every script takes --tenant <name> --dwg <path> --floor <n> [--work <dir>] [--out <dir>].
The tenant's mapping (which layers are walls, which blocks are chairs, the plan window, the
design deck's claims) lives in tenants/<tenant>.json, so the code holds no tenant-specific numbers.
"""
import argparse, json, os, math, gzip

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # noida-skymark/
IN = 0.0254                                       # inch -> metre (all three Skymark DWGs: INSUNITS = 1, inch)


def args(extra=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--tenant', required=True)
    ap.add_argument('--dwg', default=None, help='source DWG (only flatten needs it; recorded in outputs)')
    ap.add_argument('--floor', type=int, required=True)
    ap.add_argument('--work', default=None, help='folder for intermediate files (default: <out>/cad_data)')
    ap.add_argument('--out', default=None, help='output folder (default: noida-skymark/<tenant>)')
    ap.add_argument('--config', default=None, help='tenant config (default: cad/tenants/<tenant>.json)')
    for a in (extra or []): ap.add_argument(*a[0], **a[1])
    a = ap.parse_args()
    a.out = a.out or os.path.join(ROOT, a.tenant)
    a.work = a.work or os.path.join(a.out, 'cad_data')
    a.config = a.config or os.path.join(HERE, 'tenants', a.tenant + '.json')
    os.makedirs(a.out, exist_ok=True); os.makedirs(a.work, exist_ok=True)
    a.cfg = load_cfg(a.config)
    return a


def merge(base, over):
    out = dict(base)
    for k, v in over.items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def load_cfg(path):
    c = json.load(open(path))
    if 'extends' in c:
        c = merge(load_cfg(os.path.join(os.path.dirname(path), c['extends'])), {k: v for k, v in c.items() if k != 'extends'})
    return c


def load_flat(a):
    p = os.path.join(a.work, 'flat.json')
    if not os.path.exists(p) and os.path.exists(p + '.gz'):
        return json.load(gzip.open(p + '.gz'))
    return json.load(open(p))


class Frame:
    """Drawing units -> plan metres. origin = the plan window's lower-left corner (config 'origin_in').
    The '_in' keys are in drawing units: inches for Skymark (the default), or whatever 'unit_m' says
    (0.001 for a millimetre drawing such as Reliable Tech Park)."""
    def __init__(self, cfg):
        self.ox, self.oy = cfg['origin_in']
        self.win = cfg['plan_window_in']          # x0, y0, x1, y1 in drawing units
        self.s = cfg.get('unit_m', IN)            # metres per drawing unit
    def m(self, x, y): return (round((x - self.ox) * self.s, 3), round((y - self.oy) * self.s, 3))
    def inwin(self, p):
        x0, y0, x1, y1 = self.win
        return x0 < p[0] < x1 and y0 < p[1] < y1


def is_poly(r): return r['t'] not in ('INS', 'DIM', 'HATCH') and 'p' in r and r['p'] and isinstance(r['p'][0], list)


def outname(a, suffix): return os.path.join(a.out, f"{a.tenant}{suffix}")


def offer_clip(cfg):
    """The plan's own unit, when the drawing does not wall it off from the rest of the floor:
    'offer_clip_m' = [x0, y0, x1, y1] or 'offer_poly_m' = [[x, y], ...] in plan metres (tenant json). None = whole plate."""
    from shapely.geometry import box, Polygon
    if cfg.get('offer_poly_m'): return Polygon(cfg['offer_poly_m']).buffer(0)
    if cfg.get('offer_clip_m'): return box(*cfg['offer_clip_m'])
    return None
