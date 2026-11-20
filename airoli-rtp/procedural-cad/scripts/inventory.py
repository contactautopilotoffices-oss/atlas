"""Step 1b. Full inventory of the drawing: every layer, block, line, polyline, hatch, text and dimension,
plus every wall-like line pair with its spacing, and the door/window blocks with their sizes.

    python -I inventory.py <work_dir> <out_dir>

Writes <out_dir>/inventory.json, <out_dir>/INVENTORY.md and <out_dir>/inventory_entities.csv (one row per
drawing entity in the plan window: handle, layer, type, block, position, length).
"""
import csv, math, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # our own code folder only (-I drops it)
from lib import load_json, save_json, cfg, rules, inbox, centroid, pts_of

WORK, OUT = sys.argv[1], sys.argv[2]
C = cfg(); R = rules()
flat = load_json(os.path.join(WORK, 'flat.json.gz'))
pz = load_json(os.path.join(WORK, 'pieces.json'))
WIN = C['plan_window_m']; OFF = C['offer_clip_m']
recs = flat['rec']


def where(r):
    p = pts_of(r)
    if not p:
        return None
    return centroid(p)


def length(r):
    p = pts_of(r)
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(p[:-1], p[1:])) if len(p) > 1 else 0.0


# ------------------------------------------------ per-entity table (plan window)
rows = []
by_layer = collections.defaultdict(lambda: collections.Counter())
by_layer_off = collections.defaultdict(lambda: collections.Counter())
len_layer = collections.Counter()
total_types = collections.Counter(r['t'] for r in recs)
for r in recs:
    c = where(r)
    if c is None or not inbox(c[0], c[1], WIN):
        continue
    inoff = inbox(c[0], c[1], OFF)
    by_layer[r['L']][r['t']] += 1
    if inoff:
        by_layer_off[r['L']][r['t']] += 1
    L = length(r) if r['t'] not in ('TEXT', 'MTEXT', 'INSERT', 'DIMENSION') else 0
    len_layer[r['L']] += L
    rows.append({'handle': r['h'], 'layer': r['L'], 'type': r['t'], 'in_block': (r['top'] if r['ch'] else ''),
                 'block_insert_handle': (r['th'] if r['ch'] else ''), 'x': round(c[0], 3), 'y': round(c[1], 3),
                 'length_m': round(L, 3), 'in_offer_603_604': inoff,
                 'text': (r.get('txt') or '').replace('\n', ' | ')[:80], 'name': r.get('name', '')})
with open(os.path.join(OUT, 'inventory_entities.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)

layers = []
LT = {l['name']: l for l in flat['layers']}
for name in sorted(set(LT) | set(by_layer)):
    l = LT.get(name, {})
    layers.append({'layer': name, 'color': l.get('color'), 'linetype': l.get('linetype'), 'on': l.get('on'), 'frozen': l.get('frozen'),
                   'entities_in_window': sum(by_layer[name].values()), 'entities_in_offer': sum(by_layer_off[name].values()),
                   'by_type_in_window': dict(by_layer[name]), 'line_length_m_in_window': round(len_layer[name], 1)})

# ------------------------------------------------ blocks and inserts
ins = [r for r in recs if r['t'] == 'INSERT' and r['depth'] == 0 and inbox(r['p'][0], r['p'][1], WIN)]
ext = {}
for r in recs:
    if r['t'] == 'INSERT' or not r['ch']:
        continue
    for q in pts_of(r):
        e = ext.setdefault(r['ch'][0], [1e9, 1e9, -1e9, -1e9])
        e[0] = min(e[0], q[0]); e[1] = min(e[1], q[1]); e[2] = max(e[2], q[0]); e[3] = max(e[3], q[1])
blk = collections.defaultdict(lambda: {'n': 0, 'n_offer': 0, 'layers': collections.Counter(), 'sizes_m': collections.Counter(), 'handles': []})
for r in ins:
    b = blk[r['name']]; b['n'] += 1; b['n_offer'] += inbox(r['p'][0], r['p'][1], OFF); b['layers'][r['L']] += 1
    e = ext.get(r['id'])
    if e:
        b['sizes_m'][f"{e[2] - e[0]:.2f} x {e[3] - e[1]:.2f}"] += 1
    if len(b['handles']) < 6:
        b['handles'].append(r['h'])
blocks = []
DEF = {b['name']: b for b in flat['blocks']}
for name, b in sorted(blk.items(), key=lambda x: -x[1]['n']):
    blocks.append({'block': name, 'inserts_in_window': b['n'], 'inserts_in_offer': b['n_offer'], 'insert_layers': dict(b['layers']),
                   'plan_sizes_m': dict(b['sizes_m'].most_common(5)), 'example_handles': b['handles'],
                   'definition': DEF.get(name, {}).get('types'), 'door_rule': (R['door_blocks'].get(f"{name}@{list(b['layers'])[0]}") or R['door_blocks'].get(name) or {}).get('kind')})

texts = [{'handle': r['h'], 'layer': r['L'], 'text': r['txt'], 'at': r['p'], 'height_m': r['hgt'], 'in_offer': inbox(r['p'][0], r['p'][1], OFF)}
         for r in recs if r['t'] in ('TEXT', 'MTEXT') and inbox(r['p'][0], r['p'][1], WIN)]
dims = [{'handle': r['h'], 'layer': r['L'], 'measured_m': r.get('meas'), 'override_text': r.get('txt'), 'p1': r.get('p1'), 'p2': r.get('p2')}
        for r in recs if r['t'] == 'DIMENSION']
hatches = []
for r in recs:
    if r['t'] != 'HATCH' or not r['rings']:
        continue
    c = centroid(r['rings'][0])
    if not inbox(c[0], c[1], WIN):
        continue
    a = 0.0
    for ring in r['rings']:
        a += abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))) / 2
    hatches.append({'handle': r['h'], 'layer': r['L'], 'pattern': r['pat'], 'solid': r['solid'], 'in_block': r['top'] if r['ch'] else None,
                    'area_m2': round(a, 3), 'at': [round(c[0], 2), round(c[1], 2)], 'in_offer': inbox(c[0], c[1], OFF)})
hatch_line_layer = {L: sum(by_layer[L].values()) for L in R['hatch']['hatch_line_layers']}

# ------------------------------------------------ line pairs (wall-like) and spacing
spacing = collections.defaultdict(collections.Counter); plen = collections.Counter()
for p in pz['pieces']:
    k = p['layer']; mm = int(round(p['thickness_m'] * 1000 / 5) * 5)
    spacing[k][mm] += 1; plen[k] += p['length_m']
pairs = [{'layer': k, 'pieces': sum(v.values()), 'length_m': round(plen[k], 1), 'spacing_mm': dict(v.most_common(8))} for k, v in sorted(spacing.items(), key=lambda x: -plen[x[0]])]
unp = collections.Counter(); unp_len = collections.Counter()
for u in pz['unpaired']:
    unp[u['layer']] += 1; unp_len[u['layer']] += u['length_m']

doors = [{'handle': d['handle'], 'block': d['block'], 'layer': d['layer'], 'kind': R['door_blocks'][d['rule_key']]['kind'], 'insert': d['insert'],
          'rotation_deg': d['rot_deg'], 'plan_bbox_m': d['bbox'], 'swing_arcs': d['swings'], 'in_offer': d['in_offer']} for d in pz['doors']]

hdr = flat['header']
units_check = {
    'header_INSUNITS': hdr['insunits'], 'header_says': hdr['units'], 'factor_used_m_per_unit': hdr['unit_factor_m'],
    'checks': ["block 'D-750' (a 750 mm door) measures 750 drawing units across",
               "the plate measures about 125,000 drawing units east-west (125 m)",
               "dimension values on I-FURN read 600, 900, 1200 units: standard millimetre sizes"],
    'note': 'The brief said INSUNITS 4 means inches (x 0.0254). INSUNITS 4 is millimetres in the DWG/DXF standard, and the geometry confirms it: '
            'the factor used is 0.001. (The rtp6-c twin layout also uses millimetres: its origin is 5,822,230.6 mm = 5,822.23 m.)'}

inv = {'drawing': C['dwg_name'], 'header': hdr, 'units_check': units_check, 'plan_window_m': WIN, 'offer_clip_m': OFF,
       'entity_types_whole_file': dict(total_types), 'entities_in_window': len(rows),
       'layers': layers, 'blocks': blocks, 'texts': texts, 'dimensions': dims, 'hatches': hatches, 'hatch_line_layers': hatch_line_layer,
       'line_pairs': pairs, 'unpaired_wall_lines': {k: {'lines': unp[k], 'length_m': round(unp_len[k], 1)} for k in unp},
       'columns': {'count': len(pz['columns']), 'sizes_m': dict(collections.Counter(' x '.join(f'{v:.2f}' for v in c['size_m']) for c in pz['columns']).most_common(12))},
       'door_blocks': doors, 'paper_space_text': flat['paper']}
save_json(inv, os.path.join(OUT, 'inventory.json'))

# ------------------------------------------------ INVENTORY.md
L = []
A = L.append
A(f"# Drawing inventory: {C['dwg_name']}\n")
A(f"Everything in the drawing, read by `scripts/flatten.py` (libredwg `dwg2dxf`, then ezdxf) and listed by `scripts/inventory.py`. "
  f"The full machine-readable list is `inventory.json`; every single entity in the plan window (handle, layer, type, block, position, length) is in `inventory_entities.csv` ({len(rows):,} rows).\n")
A("## Units\n")
A(f"- Header: INSUNITS = {hdr['insunits']} ({hdr['units']}). Factor used: **{hdr['unit_factor_m']} m per drawing unit**.")
for c in units_check['checks']:
    A(f"- Check: {c}.")
A(f"- {units_check['note']}\n")
A(f"## What is in the file\n")
A(f"- {sum(total_types.values()):,} entities after exploding blocks ({', '.join(f'{v:,} {k}' for k, v in total_types.most_common())}).")
A(f"- {len(rows):,} of them in the plan window of the 6th floor; Offices 603 & 604 are the clip {OFF} (plan metres).")
A(f"- {len(flat['layers'])} layers, {len(flat['blocks'])} block definitions, {len(texts)} texts in the window, {len(dims)} dimensions, {len(hatches)} hatch fills in the window, "
  f"{sum(hatch_line_layer.values()):,} exploded hatch lines on layer `wall hatch`.\n")
A("## Layers that carry building elements\n")
A("| Layer | Entities in window | In 603/604 | Line length (m) | Types |")
A("|---|---:|---:|---:|---|")
for l in sorted(layers, key=lambda x: -x['entities_in_window']):
    if l['entities_in_window'] == 0:
        continue
    A(f"| `{l['layer']}` | {l['entities_in_window']:,} | {l['entities_in_offer']:,} | {l['line_length_m_in_window']:,} | {', '.join(f'{k} {v}' for k, v in sorted(l['by_type_in_window'].items(), key=lambda x: -x[1]))} |")
A(f"\nLayers with nothing in the plan window: {', '.join('`' + l['layer'] + '`' for l in layers if l['entities_in_window'] == 0)}.\n")
A("## Wall-like line pairs (two parallel lines or two concentric arcs on the same layer)\n")
A("The spacing between the two lines is the wall thickness as drawn.\n")
A("| Layer | Pieces | Length (m) | Spacing (mm: count) |")
A("|---|---:|---:|---|")
for p in pairs:
    A(f"| `{p['layer']}` | {p['pieces']} | {p['length_m']} | {', '.join(f'{k}: {v}' for k, v in p['spacing_mm'].items())} |")
A("\nWall-layer lines with no parallel partner (no thickness can be measured; mostly the chords of single curved lines and furniture on `I-FURN`):\n")
A(", ".join(f"`{k}` {v['lines']} lines / {v['length_m']} m" for k, v in sorted(inv['unpaired_wall_lines'].items(), key=lambda x: -x[1]['length_m'])) + "\n")
A("## Hatch\n")
hc = collections.Counter((h['layer'], h['pattern'], h['in_block']) for h in hatches)
A("| Layer | Pattern | Inside block | Count |")
A("|---|---|---|---:|")
for (ly, pt, ib), n in hc.most_common():
    A(f"| `{ly}` | {pt} | {ib or '-'} | {n} |")
A(f"\nPlus {sum(hatch_line_layer.values()):,} loose lines on `wall hatch`: an exploded masonry hatch between the faces of the base-building walls (used as evidence of masonry).\n")
A("## Blocks (inserts in the plan window)\n")
A("| Block | Inserts | In 603/604 | Layer(s) | Plan size (m) | Read as |")
A("|---|---:|---:|---|---|---|")
for b in blocks:
    A(f"| `{b['block']}` | {b['inserts_in_window']} | {b['inserts_in_offer']} | {', '.join(b['insert_layers'])} | {'; '.join(f'{k} ({v})' for k, v in b['plan_sizes_m'].items())} | {b['door_rule'] or ''} |")
A("\n## Doors and windows\n")
dk = collections.Counter((d['block'], d['layer'], d['kind'], d['in_offer']) for d in doors)
A("| Block | Layer | Read as | In 603/604 | Count |")
A("|---|---|---|---|---:|")
for (b, ly, k, io), n in sorted(dk.items(), key=lambda x: -x[1]):
    A(f"| `{b}` | `{ly}` | {k} | {'yes' if io else 'no'} | {n} |")
A("\nThere are no window blocks: windows are drawn as 75 mm line pairs on layer `WINDOW`. There is no arch mark, arch text or arch block anywhere in the drawing.\n")
A("## Texts in the plan window\n")
A("| Handle | Layer | Text | At (m) |")
A("|---|---|---|---|")
for t in texts:
    A(f"| {t['handle']} | `{t['layer']}` | {t['text'].replace(chr(10), ' / ').replace('|', '/')} | {t['at'][0]:.1f}, {t['at'][1]:.1f} |")
A("\nNo text in the drawing names a wall type, a material, a height or a door head. The texts are room and tenant names, passage widths and core labels.\n")
A("## Dimensions\n")
A("| Handle | Layer | Measured (m) |")
A("|---|---|---:|")
for d in dims:
    A(f"| {d['handle']} | `{d['layer']}` | {d['measured_m']} |")
A("\n## Sheet text (paper space)\n")
A("; ".join(sorted({p['txt'].replace(chr(10), ' ') for p in flat['paper'] if p['txt']})[:80]) + "\n")
open(os.path.join(OUT, 'INVENTORY.md'), 'w').write('\n'.join(L) + '\n')
print('inventory: entities', len(rows), 'layers', len(layers), 'blocks', len(blocks), 'texts', len(texts), 'dims', len(dims), 'hatches', len(hatches))
