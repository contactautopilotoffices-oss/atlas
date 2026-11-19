"""<out>/<tenant>_layers.md: every layer and every block name in the DWG with counts, the category
each is mapped to (walls, glass, doors, columns, workstations, chairs, tables, storage/lockers,
WC/MEP, stairs, lifts/core, ceiling, lighting, ...), and what the drawing does and does not contain
(reflected ceiling plan, light fixtures, AC grilles, sections / heights)."""
import json, os, sys, collections, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import args, load_flat, Frame, outname, is_poly

a = args(); C = a.cfg; F = Frame(C); LY = C['layers']
flat = load_flat(a); d = flat['rec']; hdr = flat.get('header', {}); paper = flat.get('paper', [])
I = json.load(open(os.path.join(a.work, 'inst.json')))
L = json.load(open(outname(a, f"-floor{a.floor}.layout.json")))
CAT = [('walls', 'walls'), ('glass', 'glass'), ('doors', 'doors'), ('columns', 'columns'), ('stairs', 'stairs'), ('lifts_core', 'lifts / core'),
       ('ceiling', 'ceiling'), ('lighting', 'lighting'), ('storage_lockers', 'storage / lockers'), ('wc_mep', 'WC / MEP fixtures'),
       ('workstations_furniture', 'workstations / furniture'), ('planters', 'planters'), ('annotation', 'annotation')]
def lcat(name):
    for k, lab in CAT:
        if name in LY.get(k, []): return lab
    if name in LY.get('room_barriers_extra', []): return 'room boundary only'
    return 'unmapped (not used)'
def where(r):
    p = r.get('p') or r.get('tp') or r.get('p1') or (r['rings'][0][0] if r.get('rings') else None)
    if p is None: return False
    q = p[0] if isinstance(p[0], list) else p
    return F.inwin(q)
lay_all = collections.defaultdict(collections.Counter); lay_win = collections.Counter()
for r in d:
    lay_all[r['L']][r['t']] += 1
    if where(r): lay_win[r['L']] += 1
for n in hdr.get('layers', []): lay_all.setdefault(n, collections.Counter())

CH, DK = C['chairs'], C['desks']; B = C['blocks']
def bcat(name, layer):
    if name in CH: return f"chairs ({CH[name][0]}, {CH[name][1]}{', ' + str(CH[name][2]) + ' places' if len(CH[name]) > 2 else ''})"
    if name in DK: return f"{'workstations' if 'workstation' in DK[name] or 'cubicle' in DK[name] else 'tables'} ({DK[name]})"
    if name in B['doors']: return 'doors'
    if name in B['lights']: return f"lighting ({B['lights'][name]})"
    if name in B['wc_mep']: return f"WC / MEP ({B['wc_mep'][name]})"
    if name in B['plants'] or name in B['planter_boxes']: return 'planters'
    if layer == 'APO-MODULAR-GRID CEILING': return 'ceiling (2x2 grid tile array)'
    if name == 'DW': return 'doors (door tag)'
    c = lcat(layer)
    return f"by layer: {c}" if not c.startswith('unmapped') else 'unmapped (not counted)'
ins_all = [r for r in d if r['t'] == 'INS']
bcount = collections.Counter(r['name'] for r in ins_all)
btop = collections.Counter(r['name'] for r in ins_all if r['depth'] == 0)
bwin = collections.Counter(o['name'] for o in I)
blay = {}
for r in ins_all: blay.setdefault(r['name'], collections.Counter())[r['L']] += 1

rcp_sheet = [p['txt'] for p in paper if re.search(r'RCP|CEILING|LIGHT|DOWNLIGHT', p['txt'], re.I)]
sheets = sorted({p['txt'] for p in paper if re.search(r'LAYOUT', p['txt'], re.I)})
cp = L['ceiling_plan']
ACRX = r'(^|[^A-Z])AC([^A-Z]|$)|GRILL|DIFFUS|HVAC|FCU|CASSETTE'
ac_blocks = [n for n in bcount if re.search(ACRX, n, re.I)]
ac_layers = [n for n in lay_all if re.search(ACRX, n, re.I)]
ac = ac_blocks + [n for n in ac_layers if sum(lay_all[n].values())]
ac_empty = [n for n in ac_layers if not sum(lay_all[n].values())]
sect = [r['txt'] for r in d if r['t'] in ('MText', 'TextEntity') and re.search(r'SECTION|ELEVATION|FFL|SOFFIT|CEILING HT|C\.?H\.?|LVL|\+\d', r.get('txt', ''), re.I)]
risers = sorted({m.group(0) for r in d if r['t'] in ('MText', 'TextEntity') for m in [re.search(r'RISER-?\s*\d+\s*/\s*\d+', r.get('txt', ''))] if m})

W = []
W.append(f"# {C['name']} — layers and blocks\n")
W.append(f"Source: `{C.get('dwg_name')}` (read-only; not copied into git). Floor {a.floor}.\n")
W.append(f"- DWG version **{hdr.get('version')}**, read directly with `@node-projects/acad-ts` (no converter needed).")
W.append(f"- Units: **INSUNITS = {hdr.get('insunits')} ({hdr.get('units')})**. Not mm. Plan metres = inches x 0.0254. The drafter's notes are mm (LIFT 2025X2025) and feet-inches (passages, workstation sizes); both agree with the geometry at that scale (see `{a.tenant}_checks.json`).")
W.append(f"- Plan window used (drawing inches): {C['plan_window_in']}. The file also holds stray far-away entities (orphan dimensions, a 3D face set near (5.84e6, -6.68e6), a plain outline copy) that are not part of this plan.")
W.append(f"- Paper-space sheets: {', '.join(sheets) if sheets else 'none named'}.\n")
W.append("## What the drawing contains (and does not)\n")
W.append(f"| Item | In this DWG? | Evidence |\n|---|---|---|")
W.append(f"| Reflected ceiling plan | {'yes, on the same plan copy' if cp['present'] and not C.get('rcp_offset_in') else 'yes, as a separate copy (offset ' + str(C.get('rcp_offset_in')) + ' in)' if cp['present'] else 'no'} | {cp['grid_tiles']} 2'x2' grid tiles (APO-MODULAR-GRID CEILING), {cp['gypsum_regions']} gypsum regions (APO- Gypsum celing); paper-space legend: {'; '.join(rcp_sheet) if rcp_sheet else 'none'} |")
W.append(f"| Light fixtures | {'yes' if L['lights'] else 'no'} | {cp['lights_by_kind']} (blocks {', '.join(n for n in B['lights'] if bcount.get(n))}; loose AE-LITE-CLNG circles / 2'x2' panel outlines where present) |")
W.append(f"| AC grilles / diffusers | {'yes' if ac else 'no'} | {'blocks/layers with entities: ' + ', '.join(ac) if ac else 'no block or drawn entity for AC grilles, diffusers or FCUs'}{'; layers ' + ', '.join('`' + n + '`' for n in ac_empty) + ' exist but are empty (0 entities)' if ac_empty else ''} |")
W.append(f"| Section / elevation / ceiling height | no | no section or elevation views, no level marks, no ceiling-height note{(' (texts matched: ' + '; '.join(sect[:5]) + ')') if sect else ''} |")
W.append(f"| Floor-to-floor height | stair note only | {', '.join(risers) if risers else 'none'}: total rise per floor in mm / number of risers. Not a section. |")
W.append(f"| Lockers | {'yes' if C.get('lockers') else 'not drawn as such'} | {'unit rectangles on ' + C['lockers']['layer'] + ', tiers only in the labels' if C.get('lockers') else 'no locker blocks or labels'} |\n")
W.append("## Mapping (category -> layers)\n")
for k, lab in CAT:
    ls = [n for n in LY.get(k, []) if n in lay_all]
    if ls: W.append(f"- **{lab}**: {', '.join('`' + n + '`' for n in ls)}")
if LY.get('room_barriers_extra'): W.append(f"- **room boundary only** (closes rooms, not built as walls): {', '.join('`' + n + '`' for n in LY['room_barriers_extra'] if n in lay_all)}")
if LY.get('layers_note'): W.append(f"- Note: {LY['layers_note']}")
W.append("- **chairs, workstations, tables, doors, lighting, WC/MEP**: by block name (table below), whatever layer the block sits on.\n")
W.append(f"## Layers ({len(lay_all)})\n\nCounts are entities after exploding blocks (nested entities count on their own layer). 'In plan' = inside the plan window.\n")
W.append("| Layer | Category | All entities | In plan | By type |\n|---|---|---:|---:|---|")
for n in sorted(lay_all, key=lambda s: s.lower()):
    c = lay_all[n]
    W.append(f"| `{n}` | {lcat(n)} | {sum(c.values())} | {lay_win.get(n, 0)} | {', '.join(f'{k} {v}' for k, v in c.most_common())} |")
W.append(f"\n## Block names ({len(bcount)})\n\n'Instances' = every insert, nested ones included; 'top' = inserted directly in model space; 'in plan' = instances whose drawn centre is in the plan window (one record each in inst.json, never merged). Anonymous `*U` names are resolved to their dynamic-block source where the DWG records it.\n")
W.append("| Block | Category | Instances | Top | In plan | Layer(s) |\n|---|---|---:|---:|---:|---|")
for n, v in sorted(bcount.items(), key=lambda kv: (-bwin.get(kv[0], 0), -kv[1], kv[0])):
    ly = blay[n].most_common(2); cat = bcat(n, ly[0][0])
    W.append(f"| `{n}` | {cat} | {v} | {btop.get(n, 0)} | {bwin.get(n, 0)} | {', '.join(f'{k} ({c})' for k, c in ly)} |")
open(outname(a, '_layers.md'), 'w').write("\n".join(W) + "\n")
print(outname(a, '_layers.md'), len(lay_all), 'layers', len(bcount), 'blocks')
