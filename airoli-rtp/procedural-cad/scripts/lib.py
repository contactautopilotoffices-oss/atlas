"""Shared helpers: loading the flattened drawing, geometry, attribute records."""
import gzip, json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_json(p):
    return json.load(gzip.open(p, 'rt') if p.endswith('.gz') else open(p))


def save_json(obj, p, indent=1):
    with (gzip.open(p, 'wt') if p.endswith('.gz') else open(p, 'w')) as f:
        json.dump(obj, f, indent=indent, ensure_ascii=False)


def cfg():
    return load_json(os.path.join(ROOT, 'config.json'))


def rules():
    # PCAD_RULES points at a merged rules file for a variant run (see scripts/variant.py); default: rules.json
    return load_json(os.environ.get('PCAD_RULES') or os.path.join(ROOT, 'rules.json'))


def inbox(x, y, b):
    return b[0] <= x <= b[2] and b[1] <= y <= b[3]


def centroid(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def pts_of(r):
    p = r.get('p')
    if not p:
        return r['rings'][0] if r.get('rings') else []
    return [p] if isinstance(p[0], (int, float)) else p


def to_rtp_local(M, x_plan, y_plan, origin_m):
    X = x_plan + origin_m[0]; Y = y_plan + origin_m[1]
    return [round(M[0][0] * X + M[0][1] * Y + M[0][2], 4), round(M[1][0] * X + M[1][1] * Y + M[1][2], 4)]


def attr(value, source, confidence, **kw):
    """One attribute of a wall or opening. source: cad | designer | client | default."""
    assert source in ('cad', 'designer', 'client', 'default'), source
    d = {'value': value, 'source': source, 'confidence': round(float(confidence), 2)}
    d.update({k: v for k, v in kw.items() if v is not None})
    return d


def seg_len(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])
