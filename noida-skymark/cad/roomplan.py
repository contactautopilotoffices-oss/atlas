"""Room plan: closed, non-overlapping room polygons from the free-space faces.

Input faces are the regions closed by walls, glass, railings, columns, door leaves and any hand
closures listed in the tenant config ('closures', each with a reason). Then, per face:

* other tenants' space (a face labelled OCCUPIED, or a large enclosed face with no furniture at all,
  e.g. Volt's zone on Paytm's plan) -> `not_demised`, never a room;
* an enclosed face with one room label -> that room, whole face (labels just outside a small room
  are moved into it first, as before);
* a face holding work desks -> the desk clusters become work-hall zones (one per cluster, bounded by
  the face), named by the work label in the face or "Open workstations n";
* other labels left in an open face (pantry, lounge, collab, reception...) -> a zone around their own
  furniture (hull of chairs/tables near the label, clipped to the face), or a small area round the label;
* everything left over in an open face -> `circulation`, each piece with a centreline.
No Voronoi wedges: every polygon edge is a wall/glass line, a door leaf, a closure, or the edge of a
furniture cluster.
"""
import math, re, collections
from shapely.geometry import Point, Polygon, LineString, MultiPoint, box, MultiLineString
from shapely.ops import unary_union, linemerge, voronoi_diagram
import geom

CLOSED_KINDS = {'meeting', 'training', 'service', 'operator', 'wc', 'core'}


def polys(g):
    if g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    return [x for x in getattr(g, 'geoms', []) if x.geom_type == 'Polygon']


def clean(g, eps=0.25):
    """Drop slivers narrower than ~2*eps and tiny bits."""
    g = g.buffer(-eps, join_style=2).buffer(eps, join_style=2).intersection(g) if not g.is_empty else g
    return [p for p in polys(g.buffer(0)) if p.area > 0.6]


def centreline(pg, step=0.35, trim=0.4):
    """Approximate medial axis: Voronoi edges of the densified boundary that stay well inside."""
    try:
        b = pg.exterior
        pts = [b.interpolate(i * step) for i in range(int(b.length / step) + 1)]
        for h in pg.interiors: pts += [h.interpolate(i * step) for i in range(int(h.length / step) + 1)]
        vd = voronoi_diagram(MultiPoint(pts), edges=True)
        inner = pg.buffer(-trim)
        if inner.is_empty: inner = pg.buffer(-trim / 3)
        segs = [e for e in getattr(vd, 'geoms', [vd]) for e in (getattr(e, 'geoms', [e])) if inner.contains(e)]
        if not segs: return []
        m = linemerge(unary_union(segs))
        out = [l.simplify(0.15) for l in (m.geoms if hasattr(m, 'geoms') else [m]) if l.length > 1.0]
        return [[[round(x, 2), round(y, 2)] for x, y in l.coords] for l in out]
    except Exception:
        return []


def build(faces, labels, C, desks, seats_xy, furn_xy):
    """faces: [Polygon]; labels: [{t,x,y}]; desks: [(Polygon, kind)]; seats_xy: [(x, y, role)];
    furn_xy: [(x, y)] non-desk furniture centres (tables, sofas, lounge chairs)."""
    ign = re.compile(C['labels']['ignore'], re.I); circ = re.compile(C['labels']['circulation'], re.I)
    rules = C['room_kinds']; kind = lambda t: geom.classify(t, rules)
    work_lab = re.compile(r'WORKSTATION|OFFICE|CALLING|FINANCE|STAFF|CONTROL|CUBIC|SUPERVISOR', re.I)
    # ---- labels per face (dedupe; ignore drawing notes)
    per = []
    for f in faces:
        L = []
        for l in labels:
            if ign.search(l['t']) or not f.contains(Point(l['x'], l['y'])): continue
            if not any(u['t'] == l['t'] and math.dist((u['x'], u['y']), (l['x'], l['y'])) < 1.0 for u in L): L.append(l)
        per.append(L)
    # labels just outside a small room move into it (closed-kind labels from open faces first)
    for i, f in enumerate(faces):
        named = [l for l in per[i] if not circ.search(l['t'])]
        if len(named) < 2 and not (named and kind(named[0]['t']) in CLOSED_KINDS and f.area > 120): continue
        for l in sorted(named, key=lambda l: (kind(l['t']) not in CLOSED_KINDS, l['t'])):
            p = Point(l['x'], l['y'])
            cand = [(faces[j].distance(p), j) for j in range(len(faces)) if j != i and not per[j]
                    and 2.5 < faces[j].area < 120 and faces[j].distance(p) < 1.5]
            if cand: _, j = min(cand); per[i].remove(l); per[j].append(dict(l, moved_in=True))
    rooms, not_dem, circs, unplaced = [], [], [], []
    hall_n = collections.Counter(); un_n = [0]
    def add(name, pg, k, enclosed, lab=None, how=''):
        for p in polys(pg):
            rooms.append({'name': name, 'poly': p, 'kind': k, 'enclosed': enclosed, 'labels': [lab] if lab else [], 'how': how})
    for i, f in enumerate(faces):
        L = per[i]; named = [l for l in L if not circ.search(l['t'])]
        has_desk = [dp for dp, _ in desks if f.contains(dp.centroid)]
        has_seat = any(f.contains(Point(x, y)) for x, y, _ in seats_xy)
        if any(kind(l['t']) == 'occupied' for l in named):
            not_dem.append({'poly': f, 'why': 'labelled ' + ', '.join(l['t'] for l in named if kind(l['t']) == 'occupied') + ' on this plan (another tenant)'}); continue
        if f.area > 150 and not has_desk and not has_seat and not named:
            not_dem.append({'poly': f, 'why': 'large enclosed area with no furniture on this plan (not fitted out for this tenant)'}); continue
        # -------- work halls from desk clusters
        halls = []
        if len(has_desk) >= 4:
            cl = unary_union([dp.buffer(0.8, join_style=2) for dp in has_desk]).buffer(0.5, join_style=2).buffer(-0.5, join_style=2)
            halls = [h for h in clean(cl.intersection(f), 0.3) if sum(1 for dp in has_desk if h.contains(dp.centroid)) >= 4]
        rest = f.difference(unary_union(halls)) if halls else f
        rest_big = [p for p in clean(rest, 0.45) if p.area > 6]
        whole = (len(named) <= 1 and (not halls or not rest_big or f.area < 80 or (len(named) == 1 and kind(named[0]['t']) in CLOSED_KINDS)))
        if whole:
            if named:
                add(named[0]['t'], f, kind(named[0]['t']), True, named[0], 'enclosed face, one label')
            elif halls:
                hall_n['x'] += 1; add(f"Open workstations {hall_n['x']}", f, 'work', True, None, 'enclosed face with desks, no label')
            elif L or f.area > 25 or (f.area > 4 and 2 * f.area / f.length < 1.25):
                circs.append(f)            # passage label, large empty area, or a thin empty strip (corridor)
            elif f.area < 3.5:
                un_n[0] += 1; add(f"Shaft or duct {un_n[0]} (unlabelled)", f, 'core', True, None, 'small enclosed face, no label, no furniture: shaft, duct or wall cavity')
            else:
                un_n[0] += 1; add(f"Unlabelled space {un_n[0]}", f, 'other', True, None, 'enclosed face, no label, no furniture')
            continue
        # -------- open face: halls + label zones + circulation
        wl_ = [l for l in named if work_lab.search(l['t'])]
        used = set()
        for h in halls:
            near = sorted(wl_, key=lambda l: h.distance(Point(l['x'], l['y'])))
            lab = next((l for l in near if id(l) not in used and h.distance(Point(l['x'], l['y'])) < 4.0), None)
            if lab: used.add(id(lab)); add(lab['t'], h, 'work', False, lab, 'desk cluster in an open area, nearest work label')
            else: hall_n['x'] += 1; add(f"Open workstations {hall_n['x']}", h, 'work', False, None, 'desk cluster in an open area, no label')
        free = rest
        for l in named:
            if id(l) in used or work_lab.search(l['t']): continue
            p = Point(l['x'], l['y'])
            comp = next((c for c in polys(free) if c.buffer(0.3).contains(p)), None)
            if comp is None: unplaced.append(l); continue
            comp0 = next((c for c in polys(rest) if c.buffer(0.3).contains(p)), comp)     # the piece before any zone was cut out
            others = [m for m in named if m is not l and id(m) not in used and not work_lab.search(m['t']) and comp0.buffer(0.3).contains(Point(m['x'], m['y']))]
            if not others and comp.area < 150:      # the only label in this piece of open space: it names the whole piece
                add(l['t'], comp, kind(l['t']), False, l, 'open area: the whole piece of open space holding this label')
                free = free.difference(comp.buffer(0.01)); continue
            pts = [q for q in furn_xy if comp.contains(Point(q)) and math.dist(q, (l['x'], l['y'])) < 5.0]
            pts += [(x, y) for x, y, r in seats_xy if r != 'work' and comp.contains(Point(x, y)) and math.dist((x, y), (l['x'], l['y'])) < 5.0]
            if len(pts) >= 2:
                z = MultiPoint(pts + [(l['x'], l['y'])]).convex_hull.buffer(0.9, join_style=2).intersection(comp)
                how = 'open area: hull of its own furniture'
            else:
                z = p.buffer(1.8, join_style=2).intersection(comp); how = 'open area: no furniture, 1.8 m round the label'
            z = max(polys(z), key=lambda g: g.area, default=None)
            if z is None or z.area < 1: unplaced.append(l); continue
            k = kind(l['t'])
            if k in CLOSED_KINDS and k not in ('wc', 'core'): unplaced.append(dict(l, note='closed-room label in an open area: needs a closure'));
            add(l['t'], z, k, False, l, how)
            free = free.difference(z.buffer(0.01))
        for p in clean(free, 0.2):
            if p.area > 1.0: circs.append(p)
    # duplicate names -> numbered
    cnt = collections.Counter(r['name'] for r in rooms); seen = collections.Counter()
    for r in rooms:
        if cnt[r['name']] > 1 and not r['name'].startswith(('Unlabelled', 'Open workstations')):
            seen[r['name']] += 1; r['name'] = f"{r['name']} ({seen[r['name']]})"
    circulation = [{'name': f'Circulation {i + 1}', 'poly': p, 'kind': 'circulation', 'centreline': centreline(p)} for i, p in enumerate(circs)]
    return rooms, not_dem, circulation, unplaced
