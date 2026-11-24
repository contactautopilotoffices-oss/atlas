"""Step 2. Apply rules.json to the drawing evidence and write the assembly file (the single source the
3D model, IFC, DXF and JSON are generated from).

    python -I infer.py <work_dir> <out_assemblies.json>

Every attribute is {value, source, confidence, ...}: source = cad (with the entity handles and layer),
designer, client or default. Defaults carry the id of the question in ASK_DESIGNER.md that would settle them.
"""
import math, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # our own code folder only (-I drops it)
from shapely.geometry import LineString, Point, Polygon, box as sbox
from shapely.ops import unary_union
from lib import load_json, save_json, cfg, rules, inbox, attr, centroid, seg_len, to_rtp_local

WORK, OUT = sys.argv[1], sys.argv[2]
C = cfg(); R = rules(); D = R['defaults']
pz = load_json(os.path.join(WORK, 'pieces.json'))
flat = load_json(os.path.join(WORK, 'flat.json.gz'))
SCOPE = C['offer_clip_m'] if C.get('scope') == 'offer' else C['plan_window_m']
F = {'FC': D['false_ceiling_m'], 'SOFFIT': D['soffit_m'], 'F2F': D['floor_to_floor_m']}


def H(expr):
    """'FC-0.05' -> number, from the default heights."""
    s = str(expr)
    for k, v in F.items():
        s = s.replace(k, repr(v))
    return round(float(eval(s, {'__builtins__': {}})), 4)


def match(rule, pc):
    w = rule.get('when', {})
    if 'in_column_frac_gt' in w and not pc['in_column_frac'] > w['in_column_frac_gt']:
        return False
    if 'layer_in' in w and pc['layer'] not in w['layer_in']:
        return False
    if 'thickness_mm' in w:
        t = pc['thickness_m'] * 1000
        if not (w['thickness_mm'][0] <= t <= w['thickness_mm'][1]):
            return False
    if 'hatch_lines_per_m_ge' in w and pc['hatch_lines_per_m'] < w['hatch_lines_per_m_ge']:
        return False
    return True


texts = [r for r in flat['rec'] if r['t'] in ('TEXT', 'MTEXT') and inbox(r['p'][0], r['p'][1], SCOPE)]

walls, dropped = [], []
counter = collections.Counter()
for pc in pz['pieces']:
    if not inbox(pc['centre'][0], pc['centre'][1], SCOPE):
        continue
    rule = next(r for r in R['wall_rules'] if match(r, pc))
    if rule.get('drop'):
        dropped.append({'pid': pc['pid'], 'layer': pc['layer'], 'rule': rule['id'], 'why': rule['drop'],
                        'faces': [f['handle'] for f in pc['faces']]})
        continue
    wtype = rule['type']
    counter[wtype] += 1
    wid = f"W{len(walls) + 1:04d}"
    handles = [f['handle'] for f in pc['faces']]
    tops = sorted({(f['top'] or {}).get('name') for f in pc['faces'] if f.get('top')})
    ev = {'layers': sorted({f['layer'] for f in pc['faces']}), 'face_handles': handles, 'in_blocks': tops,
          'block_insert_handles': sorted({f['top']['handle'] for f in pc['faces'] if f.get('top')}),
          'spacing_mm': round(pc['thickness_m'] * 1000, 1), 'hatch_lines_between_faces': pc['hatch_lines'],
          'hatch_lines_per_m': pc['hatch_lines_per_m'], 'hatch_fills': pc['hatch_fills'][:3], 'texts_near': pc['texts'],
          'coincident_other_layers': [{'layer': c['layer'], 'overlap_m': c['overlap_m']} for c in pc['coincident']]}
    walls.append({
        'id': wid, 'pid': pc['pid'],
        'type': attr(wtype, 'cad', rule['confidence'], rule=rule['id'], why=rule['why'], layer=pc['layer'], handles=handles),
        'axis': attr(pc['axis'], 'cad', 0.95, handles=handles, why='centre line between the two drawn faces' + (' (concentric arcs)' if pc['kind'] == 'arc' else '')),
        'curved': pc['kind'] == 'arc', 'arc': pc.get('arc'),
        'length_m': attr(pc['length_m'], 'cad', 0.95, handles=handles),
        'thickness_m': attr(pc['thickness_m'], 'cad', 0.95, handles=handles, why=f"spacing of the two face lines: {round(pc['thickness_m'] * 1000)} mm"),
        'cad': ev | {'_faces': pc['faces']},
    })

# ---------------------------------------------------------------- overrides (rule changes that turn one wall class into another)
applied = []
for ov in R.get('overrides', []):
    if not ov.get('enabled'):
        continue
    w = ov['when']; n = 0
    rx = re.compile(w['near_text_regex'], re.I) if 'near_text_regex' in w else None
    for wl in walls:
        if 'type' in w and wl['type']['value'] != w['type']:
            continue
        if 'ids' in w and wl['id'] not in w['ids']:
            continue
        if rx:
            ln = LineString(wl['axis']['value'])
            if not any(rx.search(t['txt']) and ln.distance(Point(*t['p'])) <= w.get('near_text_reach_m', 2.0) for t in texts):
                continue
        old = wl['type']['value']
        wl['type'] = attr(ov['set']['type'], 'default', 0.3, rule=ov['id'], why=ov['why'], was=old)
        n += 1
    applied.append({'id': ov['id'], 'walls_changed': n})

# ---------------------------------------------------------------- heights and vertical bands per type (defaults)
for wl in walls:
    a = R['assemblies'][wl['type']['value']]
    bands = [{'material': m, 'z0_m': H(z0), 'z1_m': H(z1), 'label': R['materials'][m]['label']} for m, z0, z1 in a['bands']]
    wl['height_m'] = attr(H(a['top']), 'default', 0.4, to=a['top'], q=a['q'][0], why='no height in the drawing; default build-up for this wall type')
    wl['bands'] = attr(bands, 'default', 0.4, q=a['q'], why='vertical composition: default build-up for this wall type (rules.json assemblies)')
    wl['base_z_m'] = attr(0.0, 'default', 0.6, why='walls stand on the finished floor of this level')
    if a.get('layers') and len(bands) == 1:
        t = wl['thickness_m']['value']; fixed = sum(x[1] for x in a['layers'] if x[1] != 'REST')
        if t > fixed + 0.01:
            lay = [{'material': m, 'thickness_m': round(t - fixed if th == 'REST' else th, 4), 'label': R['materials'][m]['label']} for m, th in a['layers']]
            wl['layers'] = attr(lay, 'default', 0.4, q=a['q'][0], why='build-up through the thickness: default for this wall type, fitted to the drawn thickness')
    wl['questions'] = a['q']

# ---------------------------------------------------------------- columns
columns = []
for c in pz['columns']:
    if not inbox(*centroid(c['poly']), SCOPE):
        continue
    solid = any(e.get('solid') for e in c['evidence'])
    columns.append({'id': c['id'], 'poly': attr(c['poly'], 'cad', 0.95, handles=[e['handle'] for e in c['evidence']], layer=c['evidence'][0]['layer']),
                    'size_m': c['size_m'], 'round': c['round'],
                    'type': attr('rcc', 'cad' if solid else 'default', 0.85 if solid else 0.6,
                                 why='solid fill on column-hatch: RCC column' if solid else 'column layer outline; RCC assumed', q=None if solid else 'Q-C1'),
                    'height_m': attr(D['soffit_m'], 'default', 0.5, q='Q-H2', to='SOFFIT'),
                    'cad': {'evidence': c['evidence']}})

# ---------------------------------------------------------------- doors: host wall, opening, header, frame
wall_geo = [(wl, LineString(wl['axis']['value'])) for wl in walls]
DB = R['door_blocks']


def local_frame(d):
    th = math.radians(d['rot_deg'])
    ux = (math.cos(th), math.sin(th)); uy = (-math.sin(th), math.cos(th))
    return ux, uy


def door_points(d):
    return [q for k in kids.get(d['handle'], []) for q in k]


kids = collections.defaultdict(list)          # door insert handle -> list of child point lists
jambs = collections.defaultdict(list)         # small closed rectangles (frame sections drawn in the block)
iid_by_handle = {r['h']: r['id'] for r in flat['rec'] if r['t'] == 'INSERT' and r['depth'] == 0}
hid = {v: k for k, v in iid_by_handle.items()}
for r in flat['rec']:
    if r['t'] == 'INSERT' or not r['ch']:
        continue
    h = hid.get(r['ch'][0])
    if h is None:
        continue
    p = r.get('p') or (r['rings'][0] if r.get('rings') else [])
    if not p or not isinstance(p[0], list):
        continue
    kids[h].append(p)
    # jamb / frame sections: small closed outlines (flagged closed, or first point = last point: the D-750 block draws its
    # rebated L-shaped jambs that way)
    if r['t'] == 'LWPOLYLINE' and (r.get('closed') or (len(p) >= 4 and p[0] == p[-1])) and len(p) <= 9:
        xs = [q[0] for q in p]; ys = [q[1] for q in p]
        jambs[h].append((min(xs), min(ys), max(xs), max(ys), r['h']))

def circle3(a, b, c):
    ax, ay = a; bx, by = b; cx, cy = c
    dd = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(dd) < 1e-9:
        return None
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / dd
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / dd
    return ux, uy, math.hypot(ax - ux, ay - uy)


def swings_of(h):
    """door swings drawn in the block (arcs or bulged polylines), from their world-coordinate points: (hinge, r, tip_a, tip_b)"""
    out = []
    for p in kids.get(h, []):
        if len(p) < 5 or p[0] == p[-1]:
            continue
        cc = circle3(p[0], p[len(p) // 2], p[-1])
        if not cc:
            continue
        ux, uy, r = cc
        if not (0.4 <= r <= 1.4) or max(abs(math.hypot(q[0] - ux, q[1] - uy) - r) for q in p) > 0.006:
            continue
        sweep = abs((math.degrees(math.atan2(p[-1][1] - uy, p[-1][0] - ux)) - math.degrees(math.atan2(p[0][1] - uy, p[0][0] - ux)) + 180) % 360 - 180)
        if 60 <= sweep <= 120:
            out.append(((ux, uy), r, tuple(p[0]), tuple(p[-1])))
    return out


def leaf_centroids(h, r):
    """door leaves drawn in the block (long thin closed outlines about one swing radius long): the OPEN position"""
    out = []
    for p in kids.get(h, []):
        if len(p) < 4 or p[0] != p[-1]:
            continue
        xs = [q[0] for q in p]; ys = [q[1] for q in p]
        try:
            mr = Polygon(p).minimum_rotated_rectangle
        except Exception:
            continue
        cs = list(mr.exterior.coords)
        e = sorted([seg_len(cs[0], cs[1]), seg_len(cs[1], cs[2])])
        if e[0] < 0.08 and abs(e[1] - r) <= 0.2 * r:
            out.append((sum(xs) / len(xs), sum(ys) / len(ys)))
    return out


def flanks_of(a, b, tol=0.06, overlapping=False):
    """straight walls in line with the opening a-b (measured on each wall's own line) that end at it (within 0.3 m)
    and do not run into it; with overlapping=True, the walls that DO run through it instead"""
    out = []
    for wl, ln in wall_geo:
        ax = wl['axis']['value']
        if len(ax) != 2 or wl['type']['value'] in ('curtain_wall', 'acp', 'railing', 'window_glazing'):
            continue
        Lw = seg_len(ax[0], ax[1])
        if Lw < 0.05:
            continue
        wu = ((ax[1][0] - ax[0][0]) / Lw, (ax[1][1] - ax[0][1]) / Lw); wn = (-wu[1], wu[0])
        if abs(abs(wu[0] * (b[0] - a[0]) + wu[1] * (b[1] - a[1])) - seg_len(a, b)) > seg_len(a, b) * (1 - math.cos(math.radians(4))) + 1e-6:
            continue                                   # not parallel within 4 degrees
        lim = wl['thickness_m']['value'] / 2 + tol
        if any(abs((q[0] - ax[0][0]) * wn[0] + (q[1] - ax[0][1]) * wn[1]) > lim for q in (a, b)):
            continue
        ta = (a[0] - ax[0][0]) * wu[0] + (a[1] - ax[0][1]) * wu[1]; tb = (b[0] - ax[0][0]) * wu[0] + (b[1] - ax[0][1]) * wu[1]
        omin, omax = min(ta, tb), max(ta, tb)
        overlap = min(Lw, omax) - max(0.0, omin)
        if overlapping:
            if overlap > 0.03:
                out.append(wl)
            continue
        if overlap > 0.03:
            continue                                   # the wall runs through the opening: not a flank
        if min(abs(omin - Lw), abs(omax - 0.0)) <= 0.3:
            out.append(wl)
    return out


def wall_along(a, b, tol=0.06):
    """the longest straight wall whose axis runs along the segment a-b (both ends within the wall strip, parallel)"""
    ang = math.atan2(b[1] - a[1], b[0] - a[0]); best = None
    for wl, ln in wall_geo:
        ax = wl['axis']['value']
        if len(ax) != 2 or wl['type']['value'] in ('curtain_wall', 'acp', 'railing', 'window_glazing'):
            continue
        wa = math.atan2(ax[1][1] - ax[0][1], ax[1][0] - ax[0][0])
        if abs((wa - ang + math.pi / 2) % math.pi - math.pi / 2) > math.radians(4):
            continue
        lim = wl['thickness_m']['value'] / 2 + tol
        if ln.distance(Point(*a)) <= lim and ln.distance(Point(*b)) <= lim:
            if best is None or wl['length_m']['value'] > best['length_m']['value']:
                best = wl
    return best


def one_jamb_opening(js, host, p0, ou, Lo):
    """one jamb drawn in the door block at one end of the opening, the host wall ending at the other end: the opening runs
    from the jamb's outer face to the wall end. Returns (start, end, jamb handle) along the opening direction, or None."""
    ts = [(q[0] - p0[0]) * ou[0] + (q[1] - p0[1]) * ou[1] for q in host['axis']['value']]
    lo_w, hi_w = min(ts), max(ts)
    for j0, j1, jh in js:
        if hi_w <= j0 + 0.05 and hi_w > -0.4:          # wall before the opening, jamb after it
            a_, b_ = hi_w, j1
        elif lo_w >= j1 - 0.05 and lo_w < Lo + 0.4:     # jamb before the opening, wall after it
            a_, b_ = j0, lo_w
        else:
            continue
        if 0.4 <= b_ - a_ <= 1.6:
            return a_, b_, jh
    return None


openings = []
for d in pz['doors']:
    if not inbox(d['insert'][0], d['insert'][1], SCOPE):
        continue
    rule = DB[d['rule_key']]
    ux, uy = local_frame(d)
    pts = door_points(d)
    if not pts:
        continue
    us = [q[0] * ux[0] + q[1] * ux[1] for q in pts]; vs = [q[0] * uy[0] + q[1] * uy[1] for q in pts]
    u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
    W = lambda u, v: (u * ux[0] + v * uy[0], u * ux[1] + v * uy[1])
    edges = [((u0, v0), (u1, v0)), ((u0, v1), (u1, v1)), ((u0, v0), (u0, v1)), ((u1, v0), (u1, v1))]
    best = None
    for (a, b) in edges:
        A_, B_ = W(*a), W(*b)
        el = LineString([A_, B_]); L = el.length
        if L < 0.3:
            continue
        ang = math.atan2(B_[1] - A_[1], B_[0] - A_[0])
        flank = []
        for wl, ln in wall_geo:
            if wl['type']['value'] in ('curtain_wall', 'acp', 'railing'):
                continue
            ax = wl['axis']['value']
            if len(ax) != 2:
                continue
            wa = math.atan2(ax[1][1] - ax[0][1], ax[1][0] - ax[0][0])
            da = abs((wa - ang + math.pi / 2) % math.pi - math.pi / 2)
            if da > math.radians(4):
                continue
            # perpendicular distance of the wall axis from the edge line
            n = (-math.sin(ang), math.cos(ang))
            off = abs((ax[0][0] - A_[0]) * n[0] + (ax[0][1] - A_[1]) * n[1])
            if off > wl['thickness_m']['value'] / 2 + 0.15:
                continue
            for end in ax:
                for k, corner in enumerate((A_, B_)):
                    gap = seg_len(end, corner)
                    if gap < 0.3:
                        # the wall must lie outside the edge interval (it flanks the opening)
                        t = ((end[0] - A_[0]) * math.cos(ang) + (end[1] - A_[1]) * math.sin(ang))
                        other = ax[1] if end is ax[0] else ax[0]
                        to = ((other[0] - A_[0]) * math.cos(ang) + (other[1] - A_[1]) * math.sin(ang))
                        if (k == 0 and to < t + 0.05) or (k == 1 and to > t - 0.05):
                            flank.append((gap, k, wl, end, off))
        sides = {}
        for f in sorted(flank, key=lambda x: x[0]):
            sides.setdefault(f[1], f)
        score = len(sides) * 10 - sum(f[0] for f in sides.values())
        if best is None or score > best[0]:
            best = (score, A_, B_, sides, L)
    score, A_, B_, sides, L = best
    host = None
    if sides:
        cand = [s[2] for s in sides.values()]
        host = max(cand, key=lambda w: w['length_m']['value'])
    swing_used = None
    if not (len(sides) == 2 and all(sd[3] is not None for sd in sides.values())):
        for hinge, r, ta, tb in swings_of(d['handle']):
            # the closed position of the leaf is the swing end that sits in a gap between walls (walls end at it, none runs through it);
            # a leaf drawn in the block only breaks a tie (blocks draw it open or closed)
            def score(tip):
                return len(flanks_of(hinge, tip)) - 10 * len(flanks_of(hinge, tip, overlapping=True))
            sa_, sb_ = score(ta), score(tb)
            if sa_ != sb_:
                closed = ta if sa_ > sb_ else tb
                how = 'the closed position is the swing end that lines up with the gap between the walls'
            else:
                leaves = leaf_centroids(d['handle'], r)
                lc = leaves[0] if leaves else None
                closed = (ta if seg_len(ta, lc) > seg_len(tb, lc) else tb) if lc else ta
                how = 'both swing ends look alike against the walls; ' + ('the drawn leaf is taken as the open position' if lc else 'first swing end taken (low confidence)')
            fl = flanks_of(hinge, closed)
            swing_used = (hinge, closed, r, max(fl, key=lambda w: w['length_m']['value']) if fl else None, how)
            break
    if swing_used:
        hinge, tip, r, wl, how = swing_used
        host = wl; p0, p1 = hinge, tip; width = r
        sides = {0: (0.0, 0, wl, None, 0.0)} if wl else {}
        w_src = attr(round(r, 3), 'cad', 0.85, handles=[d['handle']], why=f'radius of the door swing drawn in the block (hinge to the closed leaf position); {how}')
    elif len(sides) == 2 and all(sd[3] is not None for sd in sides.values()):
        e0, e1 = sides[0][3], sides[1][3]
        width = seg_len(e0, e1); p0, p1 = e0, e1
        w_src = attr(round(width, 3), 'cad', 0.9, handles=[d['handle']] + [s[2]['id'] for s in sides.values()],
                     why='gap between the two wall ends either side of the door block')
    else:
        p0, p1 = A_, B_; width = L
        why = 'edge of the door block along the wall (one or no flanking wall end found)'
        if len(sides) == 1 and list(sides.values())[0][3] is not None:
            # one flanking wall end: start the opening at that end, never inside the wall
            gap, k, wl1, end, _ = list(sides.values())[0]
            if k == 0: p0 = tuple(end)
            else: p1 = tuple(end)
            width = seg_len(p0, p1); why += '; clipped at the flanking wall end'
        w_src = attr(round(width, 3), 'cad', 0.75, handles=[d['handle']], why=why)
    # frame: jamb sections drawn inside the block
    jb = jambs.get(d['handle'], [])
    jsec = [j for j in jb if 0.015 <= min(j[2] - j[0], j[3] - j[1]) <= 0.1 and max(j[2] - j[0], j[3] - j[1]) <= 0.16]
    kind = rule['kind']
    if len(jsec) >= 2:
        sz = sorted([round(jsec[0][2] - jsec[0][0], 3), round(jsec[0][3] - jsec[0][1], 3)])
        fmat = {'glass_door': 'aluminium', 'cubicle_door': 'cubicle hardware (aluminium/HPL)'}.get(kind, 'hardwood')
        frame = attr({'profile_mm': [round(sz[0] * 1000), round(sz[1] * 1000)], 'material': fmat,
                      'beading_mm': 12 if kind == 'solid_door' else None}, 'cad', 0.75, handles=[j[4] for j in jsec[:2]],
                     why=f"jamb sections drawn in the door block: {round(sz[0]*1000)} x {round(sz[1]*1000)} mm (material assumed)", q='Q-D4')
    else:
        frame = attr({'profile_mm': [45, 75] if kind == 'glass_door' else ([0, 0] if kind == 'cubicle_door' else [50, 100]),
                      'material': D['door_frame'][kind]}, 'default', 0.4, q='Q-D4', why='no frame drawn in the block')
    dbl = None
    if rule['leaves'] == 2:
        lines2 = [k for k in kids.get(d['handle'], []) if len(k) == 2 and 1.2 <= seg_len(k[0], k[1]) <= 3.0]
        if lines2:
            fl_ = max(lines2, key=lambda k: seg_len(k[0], k[1]))
            p0, p1 = tuple(fl_[0]), tuple(fl_[1])
            fls = flanks_of(p0, p1)
            host = max(fls, key=lambda w: w['length_m']['value']) if fls else None
            sides = {i: (0.0, i, w, None, 0.0) for i, w in enumerate(fls[:2])}
            swing_used = None
            dbl = seg_len(p0, p1)
    # ---- door widths, kept apart (founder's exact-opening requirement): leaf / structural opening / frame outside /
    #      clear passage / nominal. Only the structural opening is modelled and cut; a swing radius is never used as it.
    two_flanks = len(sides) == 2 and all(sd[3] is not None for sd in sides.values())
    ou = (p1[0] - p0[0], p1[1] - p0[1]); Lo = math.hypot(*ou) or 1e-9; ou = (ou[0] / Lo, ou[1] / Lo)
    # measure along the door block's own axis when it agrees with the opening (the swing chord can be ~1 degree off)
    for ax_ in ((math.cos(math.radians(d['rot_deg'])), math.sin(math.radians(d['rot_deg']))), (-math.sin(math.radians(d['rot_deg'])), math.cos(math.radians(d['rot_deg'])))):
        dp = ax_[0] * ou[0] + ax_[1] * ou[1]
        if abs(dp) > math.cos(math.radians(5)):
            ou = (ax_[0] * (1 if dp > 0 else -1), ax_[1] * (1 if dp > 0 else -1)); break
    on = (-ou[1], ou[0])
    js = []
    for j in jsec:
        cs = [(j[0], j[1]), (j[2], j[1]), (j[2], j[3]), (j[0], j[3])]
        ss = [(c[0] - p0[0]) * ou[0] + (c[1] - p0[1]) * ou[1] for c in cs]
        dn = abs(((j[0] + j[2]) / 2 - p0[0]) * on[0] + ((j[1] + j[3]) / 2 - p0[1]) * on[1])
        if dn <= 0.2:
            js.append((min(ss), max(ss), j[4]))
    js.sort()
    jp = (js[0], js[-1]) if len(js) >= 2 and js[-1][0] - js[0][1] > 0.3 else None
    sw = swings_of(d['handle'])
    leaf_w = attr(round(sw[0][1], 3), 'cad', 0.85, handles=[d['handle']], why='radius of the drawn door swing = leaf width') if sw else \
        attr(None, 'default', 0.0, q='Q-D7', why='no swing drawn: leaf width unknown')
    fw_def = (frame['value']['profile_mm'][0] or 45) / 1000
    if dbl:
        op_w = attr(round(dbl, 3), 'cad', 0.6, handles=[d['handle']], why='double door: the frame line drawn across both leaves in the block')
    elif two_flanks:
        op_w = attr(round(seg_len(p0, p1), 3), 'cad', 0.9, why='structural opening: gap between the two wall ends either side of the door')
    elif jp:
        a_, b_ = jp[0][0], jp[1][1]
        p0, p1 = (p0[0] + ou[0] * a_, p0[1] + ou[1] * a_), (p0[0] + ou[0] * b_, p0[1] + ou[1] * b_)
        op_w = attr(round(b_ - a_, 3), 'cad', 0.8, handles=[jp[0][2], jp[1][2]], why='structural opening taken at the outer faces of the two jambs drawn in the block (fixing gap to the wall not drawn)')
    elif js and host is not None and len(host['axis']['value']) == 2 and (one := one_jamb_opening(js, host, p0, ou, Lo)):
        a_, b_, jh = one
        p0, p1 = (p0[0] + ou[0] * a_, p0[1] + ou[1] * a_), (p0[0] + ou[0] * b_, p0[1] + ou[1] * b_)
        op_w = attr(round(b_ - a_, 3), 'cad', 0.75, handles=[jh, host['id']],
                    why=f"structural opening from the one jamb drawn in the block (handle {jh}) to the end of wall {host['id']} opposite it")
    else:
        # nothing drawn that fixes the opening: leaf + a default frame each side, never reaching into a wall
        def clip_ext(end, dx, dy, length):
            """extend from end along (dx, dy) by up to length, stopping exactly at the first in-line wall face"""
            allowed = length
            for wl, ln in wall_geo:
                ax = wl['axis']['value']
                if len(ax) != 2 or wl['type']['value'] in ('curtain_wall', 'acp', 'railing', 'window_glazing'):
                    continue
                Lw = seg_len(ax[0], ax[1])
                if Lw < 0.02:
                    continue
                wu = ((ax[1][0] - ax[0][0]) / Lw, (ax[1][1] - ax[0][1]) / Lw)
                if abs(wu[0] * dx + wu[1] * dy) < math.cos(math.radians(4)):
                    continue
                wn = (-wu[1], wu[0])
                if abs((end[0] - ax[0][0]) * wn[0] + (end[1] - ax[0][1]) * wn[1]) > wl['thickness_m']['value'] / 2 + 0.06:
                    continue
                t0, t1 = sorted([(q[0] - end[0]) * dx + (q[1] - end[1]) * dy for q in ax])
                if t1 > 1e-4 and t0 < allowed:
                    allowed = max(0.0, t0)
            return (end[0] + dx * allowed, end[1] + dy * allowed)
        p0 = clip_ext(p0, -ou[0], -ou[1], fw_def)
        p1 = clip_ext(p1, ou[0], ou[1], fw_def)
        op_w = attr(round(seg_len(p0, p1), 3), 'default', 0.3, q='Q-D7',
                    why='UNRESOLVED: no wall ends or jambs fix the opening; modelled as the drawn ' + ('swing (leaf)' if sw else 'block edge') + f' plus a default {fw_def * 1000:.0f} mm frame each side where no wall is in the way')
    fo_w = attr(round(jp[1][1] - jp[0][0], 3), 'cad', 0.8, handles=[jp[0][2], jp[1][2]], why='outer faces of the drawn jambs') if jp else \
        attr(op_w['value'], 'default', 0.3, q='Q-D7', why='no jambs drawn: taken equal to the structural opening')
    cl_w = attr(round(jp[1][0] - jp[0][1], 3), 'cad', 0.75, handles=[jp[0][2], jp[1][2]], why='between the inner faces of the drawn jambs (door stops / rebates not drawn)') if jp else \
        attr(None, 'default', 0.0, q='Q-D7', why='not drawn: clear passage width needs the frame and stop sizes')
    mname = re.search(r'(\d{3,4})', d['block'])
    nom = attr({'by_block_name_m': int(mname.group(1)) / 1000, 'insert_scale': d['scale']}, 'cad', 0.4, handles=[d['handle']],
               why=f"number in the block name '{d['block']}'; evidence only (the same block is inserted at several sizes)") if (mname and d['block'].upper().startswith('D-')) else None
    width = op_w['value']; w_src = dict(op_w); w_src['why'] = 'modelled opening = structural opening. ' + op_w['why']
    host_type = host['type']['value'] if host else ('panel_partial_height' if rule['kind'] == 'cubicle_door' else '_none')
    hdr_rule = D['header_by_host'].get(host_type, D['header_by_host']['_none'])
    host_top = host['height_m']['value'] if host else (D['cubicle_panel']['z1_m'] if rule['kind'] == 'cubicle_door' else D['false_ceiling_m'])
    head = min(D['door_head_m'], host_top)
    if hdr_rule['kind'] == 'none_open_above':
        header = attr({'kind': 'none_open_above', 'z0_m': head, 'z1_m': head, 'detail': hdr_rule['frame']}, 'default', 0.4, q='Q-W1',
                      why='cubicle door: panels stop at the door head, nothing above')
    else:
        header = attr({'kind': hdr_rule['kind'], 'z0_m': head, 'z1_m': host_top, 'detail': hdr_rule['frame'],
                       'material': 'glass_clear_12' if hdr_rule['kind'] == 'glass_transom' else ('masonry_block' if hdr_rule['kind'] == 'lintel_masonry' else 'gypsum_pop')},
                      'default', 0.45, q='Q-D2' if hdr_rule['kind'] == 'glass_transom' else 'Q-D3',
                      why=f"header above the door from the {head:.2f} m door head to the top of the {host_type.replace('_', ' ')} host ({host_top:.2f} m)")
    # how the door sits in its host: 'through' = the host wall is drawn continuous across the opening (the model must cut it);
    # 'gap' = the host ends at the opening (the drawing already leaves the gap; nothing may be cut)
    host_rel = None
    if host and len(host['axis']['value']) == 2:
        ax = host['axis']['value']; Lw = seg_len(ax[0], ax[1]) or 1e-9
        wu = ((ax[1][0] - ax[0][0]) / Lw, (ax[1][1] - ax[0][1]) / Lw)
        ts = sorted([(q[0] - ax[0][0]) * wu[0] + (q[1] - ax[0][1]) * wu[1] for q in (p0, p1)])
        host_rel = 'through' if min(Lw, ts[1]) - max(0.0, ts[0]) > 0.03 else 'gap'
    oid = f"D{len(openings) + 1:03d}"
    openings.append({
        'id': oid, 'kind': attr(kind, 'cad', 0.85, rule=d['rule_key'], why=rule['evidence'], handles=[d['handle']], layer=d['layer']),
        'leaves': attr(rule['leaves'], 'cad', 0.8, why='door block'),
        'host': attr(host['id'] if host else None, 'cad' if host else 'default', 0.85 if len(sides) == 2 else (0.6 if host else 0.2), q=None if host else 'Q-D6',
                     why=(f"opening read from the drawn door swing; " if swing_used else '') + (f"{len(sides)} flanking wall end(s) found" if sides else 'no wall piece ends at the drawn opening (built freestanding, nothing cut)')),
        'line': attr([[round(p0[0], 4), round(p0[1], 4)], [round(p1[0], 4), round(p1[1], 4)]], op_w['source'], 0.85 if op_w['source'] == 'cad' else 0.3, handles=[d['handle']], q=op_w.get('q')),
        'width_m': w_src,
        'opening_width_m': op_w, 'frame_outside_width_m': fo_w, 'clear_width_m': cl_w, 'leaf_width_m': leaf_w, 'nominal_width_m': nom,
        'head_m': attr(head, 'default', 0.45, q='Q-D1', why='door head height: default'),
        'sill_m': attr(0.0, 'default', 0.7, why='doors start at the finished floor'),
        'header': header, 'frame': frame,
        'leaf': attr({'material': 'glass_clear_12' if kind == 'glass_door' else ('hpl_panel' if kind == 'cubicle_door' else 'door_solid'),
                      'thickness_mm': D['door_leaf_mm'][kind], 'z0_m': D['cubicle_panel']['z0_m'] if kind == 'cubicle_door' else 0.0}, 'default', 0.45, q='Q-D5'),
        'arch': None,
        'cad': {'block': d['block'], 'layer': d['layer'], 'insert_handle': d['handle'], 'host_relation': host_rel, 'opening_from': ('swing arc' if swing_used else ('two flanking wall ends' if len(sides) == 2 else ('one flanking wall end' if sides else 'block edge'))), 'insert': d['insert'], 'rotation_deg': d['rot_deg'],
                'scale': d['scale'], 'jamb_sections': [j[4] for j in jsec], 'swings': d['swings'], 'flanking_walls': [s[2]['id'] for s in sides.values()]},
    })

# ---------------------------------------------------------------- slab and false ceiling (approximate outline of the offer)
geo = [LineString(w['axis']['value']).buffer(1.0) for w in walls if w['type']['value'] in ('curtain_wall', 'acp', 'window_glazing', 'brick_block', 'railing', 'rcc', 'glass_partition', 'pop_gypsum')] + [Polygon(c['poly']['value']).buffer(1.0) for c in columns]
plate = unary_union(geo).buffer(8.0).buffer(-9.0).intersection(sbox(*SCOPE))   # closing: fills open halls, keeps convex corners
if plate.geom_type == 'MultiPolygon':
    plate = max(plate.geoms, key=lambda g: g.area)
plate = Polygon(plate.exterior).simplify(0.05)
slab_poly = [[round(x, 3), round(y, 3)] for x, y in list(plate.exterior.coords)[:-1]]
levels = {
    'ffl_above_ground_m': attr(D['ffl_above_ground_m'], 'default', 0.5, q='Q-H2', why='0.6 m plinth + 3.6 m x 6 floors (client-team note, not in the drawing)'),
    'false_ceiling_m': attr(D['false_ceiling_m'], 'default', 0.4, q='Q-H1', why=D['false_ceiling_note']),
    'soffit_m': attr(D['soffit_m'], 'default', 0.5, q='Q-H2'),
    'floor_to_floor_m': attr(D['floor_to_floor_m'], 'default', 0.5, q='Q-H2'),
    'slab_m': attr(D['slab_m'], 'default', 0.5, q='Q-H2', why='floor to floor minus soffit'),
}
slab = {'poly': attr(slab_poly, 'default', 0.5, q='Q-S1', why='outline traced around the drawn walls, facade and columns of the offer (approximate, +/- 0.5 m)'),
        'area_m2': round(plate.area, 1)}
ceiling = {'poly': attr(slab_poly, 'default', 0.4, q='Q-S1'), 'z_m': levels['false_ceiling_m']}

M = C['cad_m_to_rtp_local']; org = [v * 0.001 for v in C['origin_drawing_units']]
doc = {
    'about': 'Semantic assembly model of ' + C['project'] + '. Generated by scripts/infer.py from the drawing evidence (pieces.json) and rules.json. '
             'Plan metres from the drawing origin; z from this floor\'s finished floor. Every attribute: {value, source: cad|designer|client|default, confidence 0-1}.',
    'schema': 'schema.json', 'drawing': C['dwg_name'], 'scope': C.get('scope_note'),
    'frame': {'plan': 'x, y metres from drawing point ' + str(C['origin_drawing_units']) + ' (drawing units are mm: INSUNITS 4)', 'cad_m_to_rtp_local': M,
              'origin_m': org, 'how': 'rtp_local = M @ [x + origin_m[0], y + origin_m[1], 1]'},
    'levels': levels, 'slab': slab, 'ceiling': ceiling,
    'walls': walls, 'openings': openings, 'columns': columns,
    'dropped_pieces': dropped, 'overrides_applied': applied,
    'rule_counts': dict(counter),
}
for wl in walls:
    wl['cad'].pop('_faces', None)
save_json(doc, OUT)
print('walls', len(walls), dict(counter), 'openings', len(openings), 'hosted', sum(1 for o in openings if o['host']['value']),
      'columns', len(columns), 'dropped', len(dropped), 'overrides', applied)
