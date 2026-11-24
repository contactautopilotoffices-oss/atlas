"""Step 0. DXF (converted from the DWG with libredwg `dwg2dxf -y`) -> flat.json.gz.

Every model-space entity, with its ENTITY HANDLE, layer, colour and linetype; block inserts exploded
recursively into world coordinates (children keep the handle of their entity inside the block
definition plus the handle of the top-level insert, so every line can be traced back to the drawing).
Coordinates are converted to plan metres: (drawing units - origin) x unit factor. The unit factor comes
from the header ($INSUNITS) and is checked against the drawing itself in inventory.py.

    python -I flatten.py <in.dxf> <out.json.gz> <config.json>

The DXF is untrusted data: this script only reads it (run with -I, from a directory that is not the
data directory).
"""
import gzip, json, math, sys
from ezdxf import recover, path as ezpath

IN, OUT, CFG = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = json.load(open(CFG))
doc, auditor = recover.readfile(IN)
UNITS = {0: ('unitless', None), 1: ('inch', 0.0254), 2: ('foot', 0.3048), 4: ('mm', 0.001), 5: ('cm', 0.01), 6: ('m', 1.0)}
iu = doc.header.get('$INSUNITS', 0)
uname, k = UNITS.get(iu, (str(iu), None))
if cfg.get('unit_factor_override'):
    k = cfg['unit_factor_override']
OX, OY = cfg['origin_drawing_units']
FLAT = 2.0 / (k * 1000)          # chord tolerance: 2 mm, in drawing units


def P(x, y):
    return [round((x - OX) * k, 5), round((y - OY) * k, 5)]


def pts_of(e):
    try:
        return [P(v.x, v.y) for v in ezpath.make_path(e).flattening(FLAT)]
    except Exception:
        return []


def eff_name(ins):
    n = ins.dxf.name
    if not n.startswith('*U'):
        return n
    try:
        br = doc.blocks.get(n).block_record
        if br.has_xdata('AcDbBlockRepBTag'):
            for tags in br.get_xdata('AcDbBlockRepBTag'):
                if tags.code == 1005:
                    orig = doc.entitydb.get(tags.value)
                    if orig is not None:
                        return orig.dxf.name
    except Exception:
        pass
    return n


def handle_of(e):
    h = e.dxf.get('handle', None)
    if h:
        return h
    src = getattr(e, 'source_of_copy', None)
    return src.dxf.get('handle', None) if src is not None else None


out = []
IID = [0]


def emit(e, top, depth, chain):
    t = e.dxftype()
    base = {'L': e.dxf.get('layer', '0'), 't': t, 'h': handle_of(e), 'top': top[0] if top else None,
            'th': top[1] if top else None, 'ch': chain, 'col': e.dxf.get('color', 256), 'lt': e.dxf.get('linetype', 'BYLAYER')}
    try:
        if t == 'INSERT':
            name = eff_name(e)
            tp = top or (name, e.dxf.handle)
            IID[0] += 1
            iid = IID[0]
            ip = e.dxf.insert
            atts = {}
            try:
                for a in e.attribs:
                    atts[a.dxf.tag] = a.dxf.text
            except Exception:
                pass
            out.append({**base, 'id': iid, 'top': tp[0], 'th': tp[1], 'name': name, 'raw_name': e.dxf.name, 'depth': depth,
                        'p': P(ip.x, ip.y), 'rot': round(e.dxf.get('rotation', 0.0), 4), 'sx': e.dxf.get('xscale', 1.0),
                        'sy': e.dxf.get('yscale', 1.0), 'att': atts})
            if depth < 6:
                for s in e.virtual_entities():
                    emit(s, tp, depth + 1, chain + [iid])
            return
        if t == 'LINE':
            s, f = e.dxf.start, e.dxf.end
            out.append({**base, 'p': [P(s.x, s.y), P(f.x, f.y)]}); return
        if t == 'ARC':
            c = e.ocs().to_wcs(e.dxf.center)        # centre in world coordinates (mirrored blocks give arcs with a flipped OCS)
            pts = pts_of(e)
            a0 = a1 = None
            if pts:
                cx_, cy_ = P(c.x, c.y)
                a0 = round(math.degrees(math.atan2(pts[0][1] - cy_, pts[0][0] - cx_)), 3)
                a1 = round(math.degrees(math.atan2(pts[-1][1] - cy_, pts[-1][0] - cx_)), 3)
            ccw = e.dxf.extrusion.z >= 0
            if not ccw: a0, a1 = a1, a0              # keep 'counter-clockwise from a0 to a1' in world coordinates
            out.append({**base, 'p': pts, 'arc': P(c.x, c.y) + [round(e.dxf.radius * k, 5), a0, a1]}); return
        if t == 'CIRCLE':
            c = e.ocs().to_wcs(e.dxf.center)
            out.append({**base, 'p': pts_of(e), 'c': P(c.x, c.y) + [round(e.dxf.radius * k, 5)]}); return
        if t in ('LWPOLYLINE', 'POLYLINE'):
            p = pts_of(e)
            closed = bool(getattr(e, 'closed', False) or (t == 'POLYLINE' and e.is_closed))
            if closed and p and p[0] != p[-1]:
                p.append(p[0])
            cw = None
            try:
                cw = e.dxf.get('const_width', None)
            except Exception:
                pass
            out.append({**base, 'p': p, 'closed': closed, 'cw': cw}); return
        if t in ('ELLIPSE', 'SPLINE'):
            out.append({**base, 'p': pts_of(e)}); return
        if t in ('MTEXT', 'TEXT', 'ATTRIB'):
            txt = e.plain_text() if t == 'MTEXT' else e.dxf.get('text', '')
            ip = e.dxf.insert
            out.append({**base, 'txt': str(txt).strip(), 'p': P(ip.x, ip.y),
                        'hgt': round(e.dxf.get('char_height' if t == 'MTEXT' else 'height', 0) * k, 4),
                        'rot': round(e.dxf.get('rotation', 0.0), 3)}); return
        if t in ('SOLID', '3DFACE', 'TRACE'):
            q = [e.dxf.get(a) for a in ('vtx0', 'vtx1', 'vtx2', 'vtx3') if e.dxf.hasattr(a)]
            out.append({**base, 'p': [P(v.x, v.y) for v in q]}); return
        if t == 'DIMENSION':
            r = {**base, 'meas': None, 'txt': e.dxf.get('text', '') or '', 'dimtype': e.dxf.get('dimtype', 0)}
            try:
                m = e.get_measurement()
                r['meas'] = round(float(m) * k, 5) if not hasattr(m, 'x') else None
            except Exception:
                pass
            for key, nm in (('defpoint2', 'p1'), ('defpoint3', 'p2'), ('text_midpoint', 'tp'), ('defpoint', 'dp')):
                if e.dxf.hasattr(key):
                    v = e.dxf.get(key); r[nm] = P(v.x, v.y)
            out.append(r); return
        if t == 'HATCH':
            rings = []
            for pa in ezpath.from_hatch(e):
                q = [P(v.x, v.y) for v in pa.flattening(FLAT * 4)]
                if len(q) > 2:
                    rings.append(q)
            out.append({**base, 'pat': e.dxf.get('pattern_name', ''), 'solid': bool(e.dxf.get('solid_fill', 0)),
                        'scale': e.dxf.get('pattern_scale', 1.0), 'angle': e.dxf.get('pattern_angle', 0.0), 'rings': rings}); return
        if t == 'POINT':
            v = e.dxf.location; out.append({**base, 'p': P(v.x, v.y)}); return
        out.append({**base, 'skipped': True})
    except Exception as err:
        out.append({**base, 'err': str(err)[:120]})


for e in doc.modelspace():
    emit(e, None, 0, [])

paper = []
for lay in doc.layouts:
    if lay.name == 'Model':
        continue
    for e in lay:
        if e.dxftype() in ('MTEXT', 'TEXT'):
            ip = e.dxf.insert
            paper.append({'sheet': lay.name, 'L': e.dxf.get('layer', '0'), 'h': e.dxf.handle,
                          'txt': (e.plain_text() if e.dxftype() == 'MTEXT' else e.dxf.get('text', '')).strip()})

layers = []
for l in doc.layers:
    layers.append({'name': l.dxf.name, 'color': l.dxf.get('color', 7), 'linetype': l.dxf.get('linetype', ''),
                   'on': l.is_on(), 'frozen': l.is_frozen(), 'plot': bool(l.dxf.get('plot', 1)), 'lineweight': l.dxf.get('lineweight', -3)})
blocks = []
for b in doc.blocks:
    if b.name.lower().startswith(('*model', '*paper')):
        continue
    ents = list(b)
    blocks.append({'name': b.name, 'n_entities': len(ents), 'layers': sorted({x.dxf.get('layer', '0') for x in ents})[:12],
                   'types': sorted({x.dxftype() for x in ents})})

header = {'insunits': iu, 'units': uname, 'unit_factor_m': k, 'dxf_version': doc.dxfversion,
          'origin_drawing_units': [OX, OY], 'extmin': list(doc.header.get('$EXTMIN', (0, 0, 0))),
          'extmax': list(doc.header.get('$EXTMAX', (0, 0, 0))), 'source': 'libredwg dwg2dxf -> ezdxf (recover mode)',
          'audit_errors': len(auditor.errors), 'audit_fixes': len(auditor.fixes)}
json.dump({'header': header, 'layers': layers, 'blocks': blocks, 'n': len(out), 'rec': out, 'paper': paper},
          gzip.open(OUT, 'wt'))
c = {}
for r in out:
    c[r['t']] = c.get(r['t'], 0) + 1
print(len(out), json.dumps(c), 'units', uname, k)
