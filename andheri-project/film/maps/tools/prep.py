#!/usr/bin/env python3
"""Metro geometry for the map clips, from the same OSM extract as the walks (data/osm_walk_raw.json).

Writes data/metro.geojson:
  - line L1  Mumbai Metro Line 1 (viaduct), one track of OSM way 49180854
  - line L3  Mumbai Metro Line 3 (Aqua, underground), one tunnel of OSM way 1303500408
  - station polygons: Marol Naka L1 (way 311841876), Chakala - J.B. Nagar (way 331824153)
  - station points: the canonical coordinates from OVERNIGHT-BRIEF.md (Marol Naka L1, Chakala) and the
    OSM station node for Marol Naka Line 3 (5787704197), plus Airport Road (L1) between them

  python3 tools/prep.py
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
d = json.load(open(os.path.join(ROOT, 'data', 'osm_walk_raw.json')))
W = {e['id']: e for e in d['elements'] if e['type'] == 'way'}
N = {e['id']: e for e in d['elements'] if e['type'] == 'node'}
line = lambda wid: [[round(g['lon'], 7), round(g['lat'], 7)] for g in W[wid]['geometry']]
feats = []
feats.append(dict(type='Feature', properties=dict(kind='line', id='L1', name='Metro Line 1', osm=49180854), geometry=dict(type='LineString', coordinates=line(49180854))))
feats.append(dict(type='Feature', properties=dict(kind='line', id='L3', name='Metro Line 3', osm=1303500408), geometry=dict(type='LineString', coordinates=line(1303500408))))
for wid, name in [(311841876, 'Marol Naka'), (331824153, 'Chakala (J B Nagar)')]:
    ring = line(wid)
    if ring[0] != ring[-1]: ring.append(ring[0])
    feats.append(dict(type='Feature', properties=dict(kind='station_area', name=name, osm=wid), geometry=dict(type='Polygon', coordinates=[ring])))
n3 = N[5787704197]
for sid, name, line_id, lng, lat in [
    ('marol-l1', 'Marol Naka', 'L1', 72.879536, 19.108195),
    ('marol-l3', 'Marol Naka', 'L3', round(n3['lon'], 7), round(n3['lat'], 7)),
    ('chakala', 'Chakala (J B Nagar)', 'L1', 72.867696, 19.112045),
    ('airport-road', 'Airport Road', 'L1', 72.87475, 19.11027),
]:
    feats.append(dict(type='Feature', properties=dict(kind='station', id=sid, name=name, line=line_id), geometry=dict(type='Point', coordinates=[lng, lat])))
out = os.path.join(ROOT, 'data', 'metro.geojson')
json.dump(dict(type='FeatureCollection', features=feats, properties=dict(source='© OpenStreetMap contributors (ODbL), Overpass 23 Nov 2026')), open(out, 'w'))
print('wrote', out, len(feats), 'features')
