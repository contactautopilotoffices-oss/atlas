"""<out>/<tenant>_assumptions.md: everything the 3D floor shows that is NOT in the CAD drawing, in
plain English, for the web page's "Assumptions" section. Reads the layout, the seat summary and the
tenant config, so the numbers stay in step with the drawing."""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import args, outname

a = args(); C = a.cfg
L = json.load(open(outname(a, f"-floor{a.floor}.layout.json")))
SM = json.load(open(outname(a, '_summary.json')))['_proof']
H = L['heights']; cp = L['ceiling_plan']; st = L['storeys']
wins = L['shell']['windows']
virt = [c for c in L.get('closures', []) if c.get('source') == 'tenant config' and c.get('virtual')]
gaps = [c for c in L.get('closures', []) if c.get('source') == 'tenant config' and not c.get('virtual')]
auto = [c for c in L.get('closures', []) if c.get('source') == 'auto']
fixes = C.get('label_fixes', []) + [dict(x, to=x['t']) for x in C.get('label_adds', [])]
lk = SM['inventory'].get('lockers')
open_rooms = [r['name'] for r in L['rooms'] if not r['enclosed']]
W = [f"# {C['name']}, floor {a.floor}: assumptions\n",
     f"The 3D floor is built from the fit-out drawing `{C.get('dwg_name')}`. Everything below is **not** in that drawing and was assumed or inferred. Seat counts are not affected by any of it: they come from the chair blocks in the drawing ({SM['work_seats']} work seats, {SM['all_seats']} seats in all).\n",
     "## Heights",
     f"- **Ceiling height {H['ceiling']} m: assumed.** The drawing is a plan only. It has no section, no elevation and no ceiling level mark.",
     f"- **Wall and partition height {H['wall']} m: assumed** (full height to the ceiling).",
     f"- **Desks {H['desk']} m, high desks {H['high_desk']} m, coffee tables {H['coffee']} m, planters {H['planter']} m: standard furniture heights, assumed.**",
     f"- **Floor-to-floor height.** The stair notes in the drawing say `RISER-3900`, i.e. a 3.9 m rise per floor. The building model (made from photos) uses 4.1 m, and the 3D view keeps 4.1 m so this floor lines up with the building. The difference (0.2 m per floor) is not resolved; nothing in the drawing gives a section to settle it.",
     f"- **Window sill and head heights: not in the drawing.** {len(wins)} facade openings are read from the plan (position and width only). The 3D facade uses full-height glazing between the sill line and the ceiling, which is an assumption.",
     "",
     "## Ceiling and services",
     (f"- **Ceiling types are from the drawing's reflected ceiling plan** (2'x2' grid tiles and gypsum regions). Where a room shows neither, it is marked 'open / not drawn' and is shown as a plain flat ceiling." if cp['present'] else "- **No reflected ceiling plan** in this drawing: every ceiling is a plain flat ceiling, assumed."),
     f"- **Light fixtures are the ones drawn** ({', '.join(f'{v} {k}' for k, v in cp['lights_by_kind'].items()) or 'none'}). Light output, colour temperature and mounting height are not in the drawing and are assumed.",
     "- **AC grilles, diffusers and indoor units are not drawn.**" + (" The file has layers named `AC Grill` and `AC-RA-GRILLE` but they are empty." if C['name'] == 'ARCIL' else "") + " None are shown in 3D.",
     "- **Sprinklers, smoke detectors, speakers and access-control devices are not drawn** and are not shown.",
     "",
     "## Rooms and boundaries",
     "- Room outlines follow the drawing's wall, glass and railing lines, with doors closed along their leaves. Where the drawing leaves a gap, a closing line was added; every one is listed in `cad/tenants/" + a.tenant + ".json` with its reason:",
     *[f"  - wall gap closed: {c['why']}" for c in gaps],
     *[f"  - zone line (no wall exists; shown as open floor): {c['why']}" for c in virt],
     f"- {len(auto)} short openings with no door block (toilet entries, lift doorways, gaps at the facade bays) were closed automatically where two wall ends face each other across 0.55 to 1.15 m; they are listed in the layout file under `closures`.",
     *[f"- Label change: {x.get('why', '')}" for x in fixes if x.get('why')],
     (f"- Open-plan areas are zones, not walled rooms: {', '.join(open_rooms)}. Their edges follow the desk clusters or furniture groups; what is left is shown as circulation." if open_rooms else ""),
     "- Areas the drawing marks as another tenant's (" + "; ".join(sorted({n['why'] for n in L.get('not_demised', [])})) + ") are shown as `not demised` and are not part of this floor's rooms." if L.get('not_demised') else "",
     "- Some 'feature walls' are inferred: an unnamed 1.09 x 0.09 m block drawn against meeting-room walls is taken to be a wall-mounted screen. The drawing does not name it.",
     "",
     "## Furniture and fittings",
     f"- Lockers: the plan draws {lk['units_in_plan']} locker columns; the number of tiers (6) is taken from the drawing's labels ({lk['lockers_by_labels']} lockers). The locker height is assumed." if lk else "",
     "- Chairs, desks, tables, sofas and plants are placed exactly where the drawing places them; their 3D shapes are generic models of the right size, not the specified products.",
     "- Finishes (carpet, wood, tile, stone, vinyl) are chosen by room type. The drawing has no finishes schedule.",
     "- Basins, mirrors and cubicle partitions in the toilets are not all drawn as blocks; only the WC, urinal and health-faucet blocks are placed.",
     "",
     "## Position in the building",
     f"- This floor is placed on level {st['level']} of the building model by matching the drawing's columns to the first-floor drawings (Volt and Paytm), then using Volt's fit to the building's map footprint. See `cad/plate_fit.md`.",
     ("- The drawing's second floor reaches the street front like the first floor, but the photo-based building model sets its front facade further back above the two-storey annex. The drawing is followed here: the floor outline is exported as drawn, and the part outside the building model is listed as `twin_overhang` (" + str(L.get('twin_overhang', {}).get('area_m2')) + " m2)." if L.get('twin_overhang') else "- Where the drawing's floor runs past the photo-based building model, a two-storey glass block (the 'podium') closes the gap, as for Volt."),
     "- Units: the drawing is in inches (converted at 25.4 mm). Its mm notes (lift 2025 x 2025, stair width 1500) agree with the geometry at that scale.",
     ]
open(outname(a, '_assumptions.md'), 'w').write("\n".join(x for x in W if x is not None) + "\n")
print(outname(a, '_assumptions.md'))
