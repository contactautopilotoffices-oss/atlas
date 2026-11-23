#!/usr/bin/env python3
"""Shortest walking paths on OpenStreetMap for the three route clips.

Input : data/osm_walk_raw.json  (Overpass `out geom`: every highway way in Andheri East, metro ways,
        station ways, stop and entrance nodes; fetched 23 Nov 2026 from overpass.kumi.systems)
Output: data/routes/<id>.geojson  (the walk, a LineString from the top of the station stairs to the
        building door, with the measured length and the canonical figure in its properties)
        data/routes/summary.json

The graph is every OSM highway way a person can walk (motorways, construction and foot=no are left
out; private campus service roads stay in, because the office campuses are reached on them). Edge
weight is the geodesic length. The walk starts on the station's own stairs (OSM `highway=steps`
ways that meet the station's concourse) and ends at the building door: the canonical pin, joined to
the nearest walkable way by a short straight connector (the forecourt). Stairs are counted at their
plan length.

  python3 tools/route.py
"""
import json, math, heapq, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, 'data', 'osm_walk_raw.json')
OUT = os.path.join(ROOT, 'data', 'routes')

R_EARTH = 6371008.8
def hav(a, b):  # (lat, lng) pairs -> metres
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R_EARTH * math.asin(math.sqrt(h))

# local metres around Andheri East for projections (same constants as .w3d/data/scene.json)
KX, KY, LNG0, LAT0 = 105184.7, 110540.0, 72.867, 19.111
def xy(p): return ((p[1] - LNG0) * KX, (p[0] - LAT0) * KY)
def ll(x, y): return (LAT0 + y / KY, LNG0 + x / KX)

NO_WALK = {'motorway', 'motorway_link', 'construction', 'proposed', 'raceway', 'bus_guideway', 'elevator'}

def load(door=None, private_radius=150.0):
    """private ways (access=private: other companies' campuses) are left out, except inside the
    destination's own campus: a private way with a node within `private_radius` m of the door"""
    d = json.load(open(RAW))
    nodes, adj, ways = {}, {}, {}
    for e in d['elements']:
        if e['type'] != 'way' or 'highway' not in e.get('tags', {}):
            continue
        t = e['tags']
        if t['highway'] in NO_WALK or t.get('foot') == 'no' or t.get('access') == 'no':
            continue
        ids, geo = e['nodes'], e['geometry']
        if t.get('access') in ('private', 'customers', 'delivery') and t.get('foot') not in ('yes', 'designated', 'permissive'):
            if door is None or min(hav(door, (g['lat'], g['lon'])) for g in geo) > private_radius:
                continue
        ways[e['id']] = t
        for i, (nid, g) in enumerate(zip(ids, geo)):
            nodes[nid] = (g['lat'], g['lon'])
            if i:
                a, b = ids[i - 1], nid
                w = hav(nodes[a], nodes[b])
                adj.setdefault(a, []).append((b, w, e['id']))
                adj.setdefault(b, []).append((a, w, e['id']))
    repair(nodes, adj, ways)
    return nodes, adj, ways

def repair(nodes, adj, ways, tol=18.0):
    """OSM gaps: a way that ends a few metres short of the street it obviously meets (the Atul Corporate
    Avenue gate road stops 14 m short of Guru Hargovindji Road). Join every dead end that lies within
    `tol` metres of another way's edge to the nearest point on that edge. Each join is printed."""
    ends = [n for n, lst in adj.items() if len(lst) == 1]
    edges = []
    for a, lst in adj.items():
        for b, w, wid in lst:
            if a < b:
                edges.append((a, b, wid))
    for n in ends:
        own = adj[n][0][2]
        px, py = xy(nodes[n]); best = None
        for a, b, wid in edges:
            if wid == own or n in (a, b):
                continue
            ax, ay = xy(nodes[a]); bx, by = xy(nodes[b]); dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy or 1e-9
            k = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
            dd = math.hypot(px - ax - k * dx, py - ay - k * dy)
            if dd < tol and (best is None or dd < best[0]):
                best = (dd, a, b, k, wid)
        if best and best[0] > 0.5:
            dd, a, b, k, wid = best
            ax, ay = xy(nodes[a]); bx, by = xy(nodes[b])
            q = ll(ax + k * (bx - ax), ay + k * (by - ay)); vq = f'join:{n}'
            nodes[vq] = q
            for u in (a, b):
                w = hav(nodes[u], q); adj[u].append((vq, w, wid)); adj.setdefault(vq, []).append((u, w, wid))
            adj[n].append((vq, dd, 'join')); adj[vq].append((n, dd, 'join'))
            JOINS.append((ways[own].get('highway'), own, wid, round(dd, 1)))

JOINS = []

def dijkstra(adj, src, dst):
    dist, prev, pq, k = {src: 0.0}, {}, [(0.0, 0, src)], 0
    while pq:
        dd, _, u = heapq.heappop(pq)
        if u == dst:
            break
        if dd > dist.get(u, 1e18):
            continue
        for v, w, wid in adj.get(u, ()):
            nd = dd + w
            if nd < dist.get(v, 1e18):
                dist[v], prev[v] = nd, (u, wid)
                k += 1; heapq.heappush(pq, (nd, k, v))
    if dst not in dist:
        return None, None, None
    path, wids, u = [dst], [], dst
    while u != src:
        u, wid = prev[u]
        path.append(u); wids.append(wid)
    return dist[dst], path[::-1], wids[::-1]

def nearest_on_graph(nodes, adj, ways, p, kinds=None, only_way=None):
    """nearest point on any walkable edge -> (edge a, edge b, point, distance)"""
    px, py = xy(p)
    best = None
    seen = set()
    for a, lst in adj.items():
        for b, w, wid in lst:
            if (b, a) in seen:
                continue
            seen.add((a, b))
            if kinds and (wid not in ways or ways[wid]['highway'] not in kinds):
                continue
            if only_way and wid != only_way:
                continue
            ax, ay = xy(nodes[a]); bx, by = xy(nodes[b])
            dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy or 1e-9
            k = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
            qx, qy = ax + k * dx, ay + k * dy
            dd = math.hypot(px - qx, py - qy)
            if best is None or dd < best[3]:
                best = (a, b, ll(qx, qy), dd, wid)
    return best

def attach(nodes, adj, ways, name, p, kinds=None, only_way=None):
    """insert a virtual node on the nearest edge, plus the connector to p itself"""
    a, b, q, dd, wid = nearest_on_graph(nodes, adj, ways, p, kinds, only_way)
    vq, vp = name + ':snap', name
    nodes[vq], nodes[vp] = q, p
    for u in (a, b):
        w = hav(nodes[u], q)
        adj.setdefault(u, []).append((vq, w, wid)); adj.setdefault(vq, []).append((u, w, wid))
    w = hav(q, p)
    adj.setdefault(vq, []).append((vp, w, 'connector')); adj.setdefault(vp, []).append((vq, w, 'connector'))
    return dd

# ------------------------------------------------------------------ the three walks
# Station stairs (OSM highway=steps), their upper node is on the station concourse:
#   Marol Naka L1 (station way 311841876): NE stair 666061008 top 19.108047,72.88012; NW stair 666061005
#     top 19.108396,72.87924; SE stair 666061009 top 19.107822,72.880036; SW stair 666061006 top 19.108326,72.878758
#   Chakala (J B Nagar) (station way 331824153): W stairs 665877159 top 19.112135,72.866981 and
#     665877320 top 19.112282,72.867018; E stairs 665877507 top 19.11195,72.868264, 665877516 top 19.111795,72.868216
MAROL_STAIRS = {'NE': (19.108047, 72.88012), 'NW': (19.108396, 72.87924), 'SE': (19.107822, 72.880036), 'SW': (19.108326, 72.878758)}
CHAKALA_STAIRS = {'W1': (19.112135, 72.866981), 'W2': (19.112282, 72.867018), 'E1': (19.11195, 72.868264), 'E2': (19.111795, 72.868216)}
STATIONS = {'marol': (19.108195, 72.879536), 'chakala': (19.112045, 72.867696)}

WALKS = [
    dict(id='route_privilon', name='Privilon', door=(19.10827, 72.87968), station='Marol Naka', st='marol',
         stairs=MAROL_STAIRS, canonical_m=140, canonical_min=2),
    # Atul Corporate Avenue: the campus gate is on Guru Hargovindji Road and the gate road (OSM 681314336)
    # runs south past the building's east face, where the entrance is; the door joins that road
    dict(id='route_corporate', name='Corporate Avenue', door=(19.110625, 72.859637), station='Chakala (J B Nagar)', st='chakala', door_way=681314336,
         stairs=CHAKALA_STAIRS, canonical_m=850, canonical_min=11),
    dict(id='route_723', name='723 Avenue', door=(19.1096039, 72.8843436), station='Marol Naka', st='marol',
         stairs=MAROL_STAIRS, canonical_m=700, canonical_min=9),
]

def node_at(nodes, p, tol=0.6):
    for nid, q in nodes.items():
        if hav(p, q) < tol:
            return nid
    return None

def main():
    os.makedirs(OUT, exist_ok=True)
    summary = []
    for W in WALKS:
        nodes, adj, ways = load(W['door'])
        # the door: join the pin to the nearest street or campus way (not to a footway inside another plot)
        conn = attach(nodes, adj, ways, 'door', W['door'],
                      kinds={'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified', 'living_street', 'pedestrian', 'footway', 'path', 'tertiary_link', 'primary_link', 'secondary_link'},
                      only_way=W.get('door_way'))
        best = None
        for sname, sp in W['stairs'].items():
            nid = node_at(nodes, sp)
            if nid is None:
                print('  stair top not found in graph:', sname, sp); continue
            L, path, wids = dijkstra(adj, nid, 'door')
            if L is None:
                continue
            print(f"  {W['name']}: from stair {sname} {L:.0f} m")
            if best is None or L < best[0]:
                best = (L, path, wids, sname)
        L, path, wids, sname = best
        # the drawn walk starts at the foot of the stairs (the station's street exit): drop the leading
        # highway=steps edges, and keep the stair length for the report
        k = 0
        while k < len(wids) and isinstance(wids[k], int) and ways.get(wids[k], {}).get('highway') == 'steps':
            k += 1
        stair_m = sum(hav(nodes[path[i]], nodes[path[i + 1]]) for i in range(k))
        street = path[k:]
        coords = [[round(nodes[n][1], 7), round(nodes[n][0], 7)] for n in street]
        clean = [coords[0]] + [c for i, c in enumerate(coords[1:]) if c != coords[i]]
        exit_m = L - stair_m
        plat = hav(STATIONS[W['st']], W['stairs'][sname])
        props = dict(id=W['id'], name=W['name'], station=W['station'], exit=f'{sname} stairs, street level',
                     measured_m=round(exit_m), stairs_m=round(stair_m),
                     measured_from_stair_top_m=round(L), measured_from_platform_centre_m=round(L + plat),
                     canonical_m=W['canonical_m'], canonical_min=W['canonical_min'],
                     door_connector_m=round(conn, 1),
                     osm_ways=sorted({w for w in wids if isinstance(w, int)}),
                     gap_joins_used=sum(1 for j in wids if j == 'join'),
                     method='Dijkstra on walkable OSM highway ways (Overpass, 23 Nov 2026); drawn and measured from the foot of '
                            'the station stairs to the door; private campus roads only inside the destination campus',
                     source='© OpenStreetMap contributors (ODbL)')
        gj = dict(type='FeatureCollection', features=[dict(type='Feature', properties=props,
                  geometry=dict(type='LineString', coordinates=clean))])
        json.dump(gj, open(os.path.join(OUT, W['id'] + '.geojson'), 'w'), indent=1)
        summary.append(props)
        print(f"{W['id']}: {exit_m:.0f} m stair foot to door (canonical {W['canonical_m']} m); +{stair_m:.0f} m of stairs; "
              f"{L + plat:.0f} m from the platform centre; door connector {conn:.1f} m")
    print('gap joins in the graph:', len(JOINS))
    json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), indent=1)

if __name__ == '__main__':
    main()
