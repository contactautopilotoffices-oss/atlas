"""Plain-English assumptions for a plan's twin page (the viewer's Assumptions panel): <out>/<tenant>_assumptions.md.

usage: python -I twin_assumptions.py --tenant rtp6-a --floor 6 --out airoli-rtp/rtp6-a --build <build dir> --style <style json>
Reads the G0 numbers (<t>_G0.json), the twin layout report, the placement check of the built model, and the style.
Everything the drawing does not say is listed here, with where the number came from.
"""
import json, os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import args, outname

a = args([(('--build',), {'required': True}), (('--style',), {'required': True})])
C = a.cfg; TW = C.get('twin', {}); H = TW.get('heights', {})
J = lambda p: json.load(open(p)) if os.path.exists(p) else None
G0 = J(outname(a, '_G0.json')) or {}; TR = J(outname(a, '_twin_layout_report.json')) or {}
PL = J(os.path.join(a.build, f'{a.tenant}_placement.json')) or {}
ST = json.load(open(a.style)); T = J(outname(a, f"-floor{a.floor}.twin.layout.json")) or {}
fr = T.get('frame', {}); lvl = TW.get('level', a.floor); ffl = H.get('ffl_base_m', 0.6) + H.get('floor_to_floor', 3.6) * lvl
L = [f"# {C['name']}: what is assumed", '',
     f"The model is built from the fit-out drawing `{C.get('dwg_name')}` ({C.get('plan_label', '')}). "
     "Anything the drawing does not show is listed here, with where it came from. Seat counts come from the drawing's own chair blocks and are not affected by any of this.", '',
     '## Heights (not in the drawing)', '',
     f"- **Ceiling 3.05 m clear (10 ft), soffit 3.35 m (11 ft), 3.6 m floor to floor.** Instruction from the client team, 19 Nov 2026; the drawings have no section or ceiling level.",
     f"- **This floor's finished floor level: {ffl:.1f} m above ground** (0.6 m plinth + 3.6 m x {lvl}). The landlord's section drawing is needed to confirm the floor count and heights.",
     "- Desks 0.75 m, partitions full height to the ceiling, glass partitions 3.05 m; standard fit-out heights.", '',
     '## Position and orientation', '',
     f"- **North up.** The plan is turned {abs(fr.get('rotation_deg', -91.0)):.2f} degrees clockwise from the drawing to true north, fitted to the building's footprint on OpenStreetMap (91 % overlap) and registered on the 185 structural columns, so the floors stack within 1 cm (median {fr.get('median_residual_m', 0.006)} m).",
     "- Coordinates are metres east and north of the Google Maps pin for Reliable Tech Park, B Wing (19.16922 N, 73.00177 E).", '',
     '## Look (Altruist)', '',
     "- Finishes are matched to five photos of Altruist's current Noida office, not to a design for this space: charcoal 600 x 1200 reception wall with the built, backlit Altruist logo; white reception desk with a royal-blue front; dark grey 600 tiles at reception and polished beige marble in the lobbies; charcoal streaked carpet in the work halls; white desks, royal-blue fabric screens, kraft side screens, black mesh chairs; white walls with black skirting and columns; glass partitions in thin black frames with a frosted stripe band from 0.9 to 1.8 m; 600 grid ceilings with 600 LED panels and square AC diffusers; an olive fabric wall in the cabins.",
     "- Light fittings, AC diffusers and their layout are assumed (the drawing has no ceiling plan): LED panels on a 1.8 m grid, downlights at reception, a diffuser every fourth tile.",
     "- Daylight is a clear-sky sun for Airoli; the glass is clear; there are no blinds.",
     "- The reception tile area is built to the outline the drawing gives it (an octagon on the 6th floor), inside the corridor carpet; the drawing does not say whether the tile runs wall to wall.",
     "- Two downlights over the logo wall and the backlit halo of the logo letters are assumed from the Noida photos.",
     "- The view out of the windows shows the neighbouring buildings as plain white blocks (from OpenStreetMap heights), not as photographs.",
     ] + [f"- Not built yet: {g}." for g in ST.get('brief_gaps', [])] + ['',
     '## What the model changes from the drawing (all small, all logged)', '']
fw = TR.get('fit_to_walls', {})
pretty = {'desks_cut_back_from_walls': 'desks cut back where the drawing puts them into a wall (the model draws each wall line as a 70 mm solid)',
          'tables_cut_back_from_walls': 'tables cut back the same way', 'fixtures_given_clearance': 'basins and urinals moved off the wall face (the 3D fittings are deeper than the drawing symbols)',
          'fixtures_dropped_inside_walls': 'basins or urinals left out because the drawing places them inside a wall',
          'fixtures_moved_off_walls': 'washroom fittings moved out of a wall', 'plants_left_out': 'decor pot plants left out (they stood in the 1.2 m walkways)',
          'chairs_moved_clear': 'chairs moved up to 0.4 m clear of a wall or table', 'chairs_still_touching': 'chairs that could not be moved clear (their table gave way instead)',
          'tables_trimmed_for_a_chair': 'tables trimmed by up to 30 mm so a chair fits', 'chairs_spread_to_0_6m': 'chair moves of up to 30 mm so neighbouring chairs do not overlap (rows drawn at 0.57 m)',
          'desk_kept_as_drawn': 'desks kept exactly as drawn'}
L += [f"- {v} x {pretty.get(k, k)}" for k, v in fw.items()]
L += ["- Every desk and table is inset by 4 mm so outlines that touch in the drawing do not overlap in 3D.",
      "- The cut edge of the offer and any gap in the facade line are closed by a plain wall (marked as assumed in the model).", '']
nr = PL.get('narrow_routes', [])
if nr:
    ws = [r['min_width_m'] for r in nr]
    L += ['## For the designer: walkways under 1.2 m (from the drawing)', '',
          f"**Walkways: {len(nr)} CAD pinch points ({min(ws):.2f}–{max(ws):.2f} m), from the drawing.**", '',
          f"The model keeps the drawing's desks and walls where they are. On the routes from the entrance to every door, these {len(nr)} stretches are narrower than 1.2 m "
          "(measured on the model, between desks, tables, walls and fixed furniture; chairs are moved by people and are not counted; the model's walls are 35 mm thicker on each face than the drawn lines, "
          "so the drawn clear width is 35 to 70 mm more):", '']
    for r in nr:
        L.append(f"- {r['min_width_m']:.2f} m over {r['length_m']:.1f} m in {r['room']}, at ({r['at'][0]:.1f}, {r['at'][1]:.1f}) m" + (f", between {', '.join(o.split('_', 2)[-1] for o in r['nearby_objects'][:3])}" if r['nearby_objects'] else ' (wall to wall)') + '.')
    L.append('')
if G0.get('flags'):
    L += ['## Open points from the CAD read (G0)', ''] + [f"- {f}" for f in G0['flags'][:20]] + ['']
if G0.get('assumptions'):
    L += ['## How the drawing was read (G0)', ''] + [f"- {s}" for s in G0['assumptions']] + ['']
open(outname(a, '_assumptions.md'), 'w').write('\n'.join(L))
print(outname(a, '_assumptions.md'), len(L), 'lines')
