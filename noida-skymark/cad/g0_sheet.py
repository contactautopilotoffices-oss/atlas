"""G0 sign-off sheet (CAD read): one image and one plain-English markdown file per plan.

Reads what the earlier steps wrote (rooms.json, seats.json, legend.json, egress.json, walkways.json,
daylight.json, the tenant json) and puts on one page: the seat table and the legend line by line, the
room areas against the sheet's carpet area, entries, exits and walking distances, walkway widths,
daylight by true facade, the hand fixes, the flags and the assumptions. The plan is drawn true north up.

Writes <out>/<tenant>_G0.png, <out>/<tenant>_G0.md and <out>/<tenant>_G0.json (the numbers).
"""
import json, os, sys, re, math, collections, textwrap
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import affinity
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MPoly, FancyArrow
from common import args, outname, offer_clip

a = args(); C = a.cfg
J = lambda n: json.load(open(os.path.join(a.work, n))) if os.path.exists(os.path.join(a.work, n)) else None
R, S = J('rooms.json'), J('seats.json'); LG, EG, WK, DL = J('legend.json'), J('egress.json'), J('walkways.json'), J('daylight.json')
SQ = 10.7639
mk = lambda p, h=None: Polygon(p, h or []).buffer(0)
plate = mk(R['plate']); nd = unary_union([mk(n['poly'], n.get('holes')) for n in R['not_demised']]) if R['not_demised'] else Polygon()
clip = offer_clip(C); offer = (plate if clip is None else plate.intersection(clip)).difference(nd)
GN = {'W': 'Work (desk + chair)', 'M': 'Meeting', 'T': 'Training', 'C': 'Cafeteria', 'L': 'Reception, lounge, visitor', 'K': 'Cabin (desk chair + visitors)', 'O': 'Operator'}
GC = {'W': '#d6452b', 'M': '#2b62d6', 'T': '#7a3fc4', 'C': '#1f9a55', 'L': '#d68a1f', 'K': '#a0522d', 'O': '#888'}
KC = {'work': '#f6d5cc', 'meeting': '#cfdcf7', 'training': '#e2d4f3', 'cafe': '#cdeedb', 'reception': '#f7e3c4', 'lounge': '#f7e9c9', 'wc': '#d9eef2',
      'service': '#e8e3d6', 'core': '#d0d0d0', 'other': '#eeeeee', 'circulation': '#ffffff', 'cabin': '#ecd9cf'}
inoff = lambda g: g.intersection(offer).area > 0.5 * g.area
# ------------------------------------------------------------- seats
seats = [s for s in S if offer.buffer(0.5).contains(Point(s['x_m'], s['y_m']))]
cnt = collections.Counter(s['grp'] for s in seats)
by_room = collections.defaultdict(collections.Counter)
for s in seats: by_room[s['grp']][s['room']] += 1
# ------------------------------------------------------------- areas
area = collections.Counter(); rooms_in = []
for r in R['rooms']:
    g = mk(r['poly'], r.get('holes'))
    if not inoff(g): continue
    k = 'cabin' if re.search(C.get('cabin_rooms', '^$'), r['name'], re.I) else r['kind']
    area[k] += g.intersection(offer).area; rooms_in.append((r, g, k))
circ = [mk(c['poly'], c.get('holes')) for c in R['circulation']]
circ = [g for g in circ if inoff(g)]
area['circulation'] = sum(g.intersection(offer).area for g in circ)
carpet_m2 = sum(v for k, v in area.items() if k != 'core'); core_m2 = area['core']
sheet = C.get('sheet_areas_sqft') or {}
sheet_carpet = sheet.get('carpet'); sheet_charge = sheet.get('chargeable')
area_res = {'by_kind_m2': {k: round(v, 1) for k, v in sorted(area.items(), key=lambda t: -t[1])}, 'measured_carpet_m2': round(carpet_m2, 1),
            'measured_carpet_sqft': round(carpet_m2 * SQ), 'core_in_offer_m2': round(core_m2, 1), 'offer_gross_m2': round(offer.area, 1), 'offer_gross_sqft': round(offer.area * SQ),
            'sheet_carpet_sqft': sheet_carpet, 'sheet_chargeable_sqft': sheet_charge,
            'diff_vs_sheet_carpet_pct': round((carpet_m2 * SQ - sheet_carpet) / sheet_carpet * 100, 1) if sheet_carpet else None,
            'carpet_incl_partitions_m2': round(offer.area - core_m2, 1), 'carpet_incl_partitions_sqft': round((offer.area - core_m2) * SQ),
            'incl_partitions_vs_sheet_carpet_pct': round(((offer.area - core_m2) * SQ - sheet_carpet) / sheet_carpet * 100, 1) if sheet_carpet else None,
            'gross_vs_sheet_carpet_pct': round((offer.area * SQ - sheet_carpet) / sheet_carpet * 100, 1) if sheet_carpet else None,
            'gross_vs_sheet_chargeable_pct': round((offer.area * SQ - sheet_charge) / sheet_charge * 100, 1) if sheet_charge else None,
            'sheet_chargeable_over_carpet': round(sheet_charge / sheet_carpet, 4) if sheet_carpet and sheet_charge else None,
            'definition': 'measured carpet = every closed room, open-plan zone and circulation polygon inside the offer, except lift wells, stairs, shafts, lift lobbies and fire-rescue balconies (kind "core"); inner partitions and columns are not counted (the polygons are the free floor between them). Gross = the plate outline inside the offer.'}
area_ok = area_res['diff_vs_sheet_carpet_pct'] is not None and abs(area_res['diff_vs_sheet_carpet_pct']) <= 3
area_ok_partitions = area_res['incl_partitions_vs_sheet_carpet_pct'] is not None and abs(area_res['incl_partitions_vs_sheet_carpet_pct']) <= 3
area_res['pass_free_floor'] = area_ok if sheet_carpet else None; area_res['pass_incl_partitions'] = area_ok_partitions if sheet_carpet else None
# ------------------------------------------------------------- flags (differences and open points), computed
flags = []
if LG:
    for r in LG['rows']:
        if r['cad'] is not None and r['cad'] != r['prov']:
            flags.append(f"Legend '{r['item']}': sheet says {r['prov']} provided ({r['req']} required); the CAD shows {r['cad']}. {r['cad_evidence']}")
if sheet_carpet:
    if not area_ok:
        flags.append(f"Area: the rooms measure {carpet_m2 * SQ:,.0f} sq ft of free floor ({area_res['diff_vs_sheet_carpet_pct']:+.1f} %) and {area_res['carpet_incl_partitions_sqft']:,} sq ft with the inner partitions ({area_res['incl_partitions_vs_sheet_carpet_pct']:+.1f} %) against the sheet's {sheet_carpet:,} sq ft carpet: " + ('outside the 3 % rule on both counts.' if not area_ok_partitions else 'within 3 % only when the partitions are counted.')
                     + (f" The gross area inside the offer ({area_res['offer_gross_sqft']:,} sq ft, facade line to facade line) is {area_res['gross_vs_sheet_carpet_pct']:+.1f} % from it." if abs(area_res['gross_vs_sheet_carpet_pct']) <= 5 else '')
                     + (f" The sheet's chargeable {sheet_charge:,} sq ft is {area_res['gross_vs_sheet_chargeable_pct']:+.1f} % from that gross area." if sheet_charge and abs(area_res['gross_vs_sheet_chargeable_pct']) <= 5 else '')
                     + (f" The sheet's chargeable area is exactly {area_res['sheet_chargeable_over_carpet']:.3f} x its carpet area, so the sheet's carpet figure looks like chargeable / 1.5 (a 50 % loading), not a measured area." if area_res['sheet_chargeable_over_carpet'] and abs(area_res['sheet_chargeable_over_carpet'] - 1.5) < 0.002 else ''))
else:
    flags.append('Area: the sheet states no area for this plan, so there is nothing to check the measured area against.')
if EG:
    st = EG['stats']
    one = st.get('seats_with_one_exit_only_by_room') or {}
    if len(one) > 3:
        flags.append(f"Exits: {sum(one.values())} of {st['seats']} seats reach only one exit stair ({', '.join(st['exits_used'])}) on the drawn walls and doors" + (f" inside the walk area ({C['egress_why']})" if C.get('egress_why') else '') + ". A second exit route is not drawn.")
    else:
        for room, n in one.items():
            flags.append(f"Exits: {n} seats in {room} reach only one exit stair on the drawn walls and doors (a second route was not found). Check for a door missing from the drawing.")
    if st.get('seats_with_no_exit'): flags.append(f"Exits: {st['seats_with_no_exit']} seats reach no exit stair at all on the drawn walls and doors.")
    k45 = next((k for k in st if k.startswith('seats_over_') and str(int(st['limit_m'])) in k), None)
    if k45 and st[k45]: flags.append(f"Exits: {st[k45]} seats are more than {st['limit_m']:.0f} m walk from the nearest exit stair.")
    for b in EG['entries']['lift_banks']:
        if b['reachable'] and b.get('walk_to_reception_m') is None and EG['entries']['reception']:
            flags.append(f"Entry: the lift bank at ({b['at'][0]:.0f}, {b['at'][1]:.0f}) ({b['lifts']} lifts{', ' + b['lobby_label'] if b['lobby_label'] else ''}) has no walking route to the reception on the drawn doors.")
if WK:
    for l in WK['labels']:
        if l['measured_m'] is not None and l['measured_m'] < l['label_m'] - 0.05:
            flags.append(f"Walkway: '{l['label']}' at ({l['at'][0]:.0f}, {l['at'][1]:.0f}) measures {l['measured_m']:.2f} m between chairs at their desks (median of 5 points; {l['desk_to_desk_m']} m desk to desk).")
for r, g, k in rooms_in:            # a label that states a capacity (60 SEAT, 04 PAX, 12 SEATER) against the chairs drawn there
    m = re.search(r'(\d+)\s*(?:-\s*)?(SEAT(?:ER)?|PAX)\b', r['name'], re.I) or re.search(r'\b(\d+)\s*SEATER', r['name'], re.I)
    if not m: continue
    n_lab = int(m.group(1)); n_cad = sum(1 for s in seats if s['room'] == r['name'])
    if n_lab != n_cad:
        flags.append(f"Capacity: '{re.sub(r' [(][0-9]+[)]$', '', r['name'])}' says {n_lab}; {n_cad} chairs are drawn in it" + (' (the room outline is an open-plan zone, so nearby chairs may fall outside it)' if not r.get('enclosed', True) else '') + '.')
for u in R.get('unplaced_labels', []):
    flags.append(f"Label not placed in a room: '{u['t']}' at ({u['x']:.0f}, {u['y']:.0f}){' - ' + u['note'] if u.get('note') else ''}.")
flags += C.get('g0_flags', [])
# hand fixes (traceable)
fixes = [f"Closing line {c['a']} to {c['b']}{' (zone line, no wall)' if c.get('virtual') else ''}: {c['why']}" for c in C.get('closures', [])]
fixes += [f"Not part of the offer: the space at {n['at']}: {n['why']}" for n in C.get('not_demised_at', [])]
fixes += [f"Label {'moved' if f_.get('move_to') else 'changed'} near {f_['at']}: {f_['why']}" for f_ in C.get('label_fixes', [])]
fixes += [f"Label added '{f_['t']}' at {f_['at']}: {f_['why']}" for f_ in C.get('label_adds', [])]
if C.get('offer_poly_why'): fixes.append('Offer outline: ' + C['offer_poly_why'])
if C.get('chair_at_insert_why'): fixes.append('Chair position: ' + C['chair_at_insert_why'])
n_auto = sum(1 for c in R.get('closures', []) if c.get('source') == 'auto')
# ------------------------------------------------------------- assumptions (plain English)
tn = C.get('true_north', {})
assume = [
    f"True north: the drawing is turned {tn.get('rotate_cw_deg', 0):.0f} degrees clockwise to put north up ({tn.get('source', '')}). The sheet's own north arrow sits in paper space and was not read.",
    "Heights are not in the drawing (no section, no ceiling level): ceiling 2.85 m and full-height partitions are assumed; the floor-to-floor height is unknown and needs the landlord's section.",
    "Carpet area is measured as the free floor between walls (see the area note). The landlord's own method (for example, whether toilets, the lift lobby or wall thickness count) is not known.",
    "Walking distances follow the drawn walls and doors on a 0.2 m grid, with furniture ignored (people use the aisles), so they are slightly short for seats deep in a cluster. Every door is taken as usable; door direction and fire rating are not checked.",
    f"Exit stairs are the staircases drawn on the STAIR layer and entered by their E.D. / F.D. doors. Travel limits are NBC 2016 business occupancy: {EG['stats']['limit_m']:.0f} m with sprinklers, {EG['stats']['limit_unsprinklered_m']:.0f} m without; a fire consultant must confirm which applies." if EG else "Exits not computed.",
    "Walkway width = the clear gap between desks, tables and partitions with the chairs where they are drawn (lounge seats ignored), measured at the CAD's own passage labels.",
    "Daylight: distance from each work seat to the nearest facade glass line; the facade glass type, sill height and shading are not in the drawing.",
    "Seats are counted from chair blocks, one per chair (two per two-seat sofa). A work seat is a chair at a desk; the room a chair stands in decides meeting, training, cafeteria and lounge.",
    f"{n_auto} short openings without a door block (toilet entries, lift doorways, bays) were closed automatically where two wall ends face each other 0.55 to 1.15 m apart, for room outlines only; walking routes may pass through them.",
] + C.get('g0_assumptions', [])
# ------------------------------------------------------------- numbers file
G0 = {'plan': C['name'], 'dwg': C.get('dwg_name'), 'sheet': C.get('plan_label'), 'seats': {'work': cnt['W'], 'all': len(seats), 'by_group': {GN[g]: cnt[g] for g in 'WMTCLKO' if cnt[g]},
      'by_room': {GN[g]: dict(by_room[g].most_common()) for g in 'WMTCLKO' if by_room[g]}}, 'legend': LG, 'areas': area_res, 'area_check_pass': area_ok if sheet_carpet else None, 'area_check_pass_incl_partitions': area_ok_partitions if sheet_carpet else None,
      'egress': EG and {k: EG[k] for k in ('exits', 'fire_exit_doors', 'fire_rescue_balconies', 'stats')}, 'entries': EG and EG['entries'],
      'walkways': WK and {k: WK[k] for k in ('labels', 'labels_checked', 'labels_at_least_as_wide', 'scan')}, 'daylight': DL, 'flags': flags, 'hand_fixes': fixes, 'assumptions': assume}
for b in (G0['entries'] or {}).get('lift_banks', []): b.pop('_path', None)
json.dump(G0, open(outname(a, '_G0.json'), 'w'), indent=1, default=str)

# ------------------------------------------------------------- the image (true north up)
th = tn.get('rotate_cw_deg', 0.0); cx, cy = offer.centroid.x, offer.centroid.y
rot = lambda g: affinity.rotate(g, -th, origin=(cx, cy))
def rp(x, y):
    t = math.radians(-th); dx, dy = x - cx, y - cy
    return cx + dx * math.cos(t) - dy * math.sin(t), cy + dx * math.sin(t) + dy * math.cos(t)
fig = plt.figure(figsize=(23.4, 16.5), dpi=110)      # A2 landscape
_b = rot(offer).bounds; WIDE = (_b[2] - _b[0]) / max(_b[3] - _b[1], 1) > 1.6
if WIDE:     # a long plate (one arm): plan across the top, text in two columns below
    ax = fig.add_axes([0.01, 0.50, 0.98, 0.46]); txs = [fig.add_axes([0.005 + k * 0.333, 0.005, 0.325, 0.48]) for k in range(3)]
else:
    ax = fig.add_axes([0.01, 0.04, 0.50, 0.92]); txs = [fig.add_axes([0.52, 0.005, 0.235, 0.99]), fig.add_axes([0.765, 0.005, 0.235, 0.99])]
for t_ in txs: t_.axis('off')
pl = rot(plate)
ax.fill(*pl.exterior.xy, color='#f3f3f3', zorder=0)
for g in getattr(rot(nd), 'geoms', [rot(nd)]):
    if not g.is_empty and g.geom_type == 'Polygon': ax.fill(*g.exterior.xy, color='#e6e6e6', hatch='//', ec='#bbb', lw=0, zorder=1)
for r, g, k in rooms_in:
    gg = rot(g.intersection(offer))
    for p in getattr(gg, 'geoms', [gg]):
        if p.geom_type == 'Polygon': ax.fill(*p.exterior.xy, color=KC.get(k, '#eee'), ec='#999', lw=0.3, zorder=2)
for g in circ:
    gg = rot(g.intersection(offer))
    for p in getattr(gg, 'geoms', [gg]):
        if p.geom_type == 'Polygon': ax.fill(*p.exterior.xy, color='white', ec='#ccc', lw=0.2, zorder=2)
_vis = plate.buffer(1.0)
for l in R['wall_lines']:
    g = LineString(l)
    if _vis.contains(g): ax.plot(*rot(g).xy, color='#333', lw=0.35, zorder=3)
for l in R['glass_lines']:
    g = LineString(l)
    if _vis.contains(g): ax.plot(*rot(g).xy, color='#3aa0c8', lw=0.35, zorder=3)
ax.plot(*rot(offer.boundary).xy if offer.boundary.geom_type == 'LineString' else ([], []), color='k', lw=0.8)
for gb in getattr(offer.boundary, 'geoms', []): ax.plot(*rot(gb).xy, color='k', lw=1.0, zorder=4)
for s in seats:
    x, y = rp(s['x_m'], s['y_m']); ax.plot(x, y, 'o', ms=1.8, color=GC[s['grp']], zorder=5)
for r, g, k in rooms_in:
    if k in ('core',) or g.area < 9: continue
    n = sum(1 for s in seats if s['room'] == r['name'])
    c = rot(g.representative_point())
    ax.text(c.x, c.y, "\n".join(textwrap.wrap(re.sub(r' \(\d+\)$', '', r['name']), 16)) + (f"\n{n} seats" if n else ''), fontsize=4.6, ha='center', va='center', zorder=6, color='#222')
if EG:
    for e in EG['exits']:
        if not e['reachable']: continue
        x, y = rp(*e['c']); ax.plot(x, y, 's', ms=9, mfc='#1a9a3a', mec='white', zorder=7); ax.text(x, y, e['id'], color='white', fontsize=5.5, ha='center', va='center', weight='bold', zorder=8)
    fs = EG['stats'].get('farthest_seat')
    if fs: x, y = rp(fs['x_m'], fs['y_m']); ax.plot(x, y, '*', ms=12, color='k', zorder=8); ax.annotate(f"farthest seat: {fs['dist_1_m']:.0f} m to {fs['exit_1']}, {fs['dist_2_m'] or '-'} m to {fs['exit_2'] or '-'}", (x, y), fontsize=6, xytext=(6, 6), textcoords='offset points', zorder=9)
    rec = EG['entries'].get('reception')
    for b in EG['entries']['lift_banks']:
        if not b['reachable']: continue
        x, y = rp(*b['at']); ax.plot(x, y, 'D', ms=7, mfc='#c2187a', mec='white', zorder=7)
        if b.get('walk_to_reception_m') is not None: ax.text(x, y - 1.2, f"lifts, {b['walk_to_reception_m']:.0f} m to reception", fontsize=5, color='#c2187a', ha='center', zorder=8)
if WK:
    for l in WK['labels']:
        x, y = rp(*l['at']); ok = l['measured_m'] is not None and l['measured_m'] >= l['label_m'] - 0.05
        ax.text(x, y, f"{l['label_m'] * 1000:.0f}|{(l['measured_m'] or 0) * 1000:.0f}", fontsize=4.5, color='#0a7d2c' if ok else '#d00', zorder=9, bbox=dict(fc='white', ec='none', alpha=.7, pad=.3))
b0 = rot(offer).bounds; pad = 3; padl = 14         # room on the left for the north arrow and scale bar
ax.set_xlim(b0[0] - padl, b0[2] + pad); ax.set_ylim(b0[1] - pad, b0[3] + pad); ax.set_aspect('equal'); ax.axis('off')
# north arrow + scale bar
xa, ya = b0[0] - padl + 3, b0[3] + pad - 6
ax.add_patch(FancyArrow(xa, ya, 0, 4, width=0.5, head_width=1.6, head_length=1.4, color='k')); ax.text(xa, ya + 5.6, 'N (true)', ha='center', fontsize=8, weight='bold')
ax.plot([xa - 1, xa + 9], [ya - 2.5, ya - 2.5], color='k', lw=2); ax.text(xa + 4, ya - 3.8, '10 m', ha='center', fontsize=7)
hs = [plt.Line2D([], [], marker='o', ls='', color=GC[g], label=GN[g]) for g in 'WMTCLK' if cnt[g]]
hs += [plt.Line2D([], [], marker='s', ls='', mfc='#1a9a3a', mec='white', ms=9, label='exit stair'), plt.Line2D([], [], marker='D', ls='', mfc='#c2187a', mec='white', label='lift bank'),
       plt.Line2D([], [], marker='*', ls='', color='k', ms=10, label='farthest seat from an exit')]
ax.legend(handles=hs, loc='lower left', fontsize=7, frameon=True)
ax.set_title(f"{C['name']}  |  true north up  |  passage labels: label|measured mm (green = at least as wide)", fontsize=9)
# ---- text panel
L = []; WRAP = 82 if WIDE else 60
def H(t, s=12):
    for ln in textwrap.wrap(t, int(WRAP * 8.2 / s * 0.92)) or ['']: L.append((ln, s, 'bold', '#111'))
def T(t, s=8.2, c='#222'):
    for i, ln in enumerate(textwrap.wrap(t, int(WRAP * 8.2 / s)) or ['']): L.append((('    ' if i else '') + ln, s, 'normal', c))
H(f"G0 CAD READ  |  {C['name']}", 15); T(f"{C.get('dwg_name', '')}  |  {C.get('plan_label', '')}", 8, '#555'); T(C.get('building', ''), 8, '#555'); L.append(('', 5, 'normal', 'k'))
H(f"{cnt['W']} work seats  |  {len(seats)} seats in all", 16)
T('   '.join(f"{GN[g]} {cnt[g]}" for g in 'WMTCLKO' if cnt[g]), 9)
if LG:
    H('Legend, line by line (required / provided on the sheet / in the CAD)' + (' - Option A legend, for reference' if LG.get('note') else ''), 10.5)
    for r in LG['rows']:
        mark = 'OK  ' if r['cad'] == r['prov'] else 'DIFF'
        L.append((f"  {mark}  {r['item'][:30]:30} {str(r['req']):>4} {str(r['prov']):>4} {str(r['cad']):>4}", 8, 'normal', '#0a7d2c' if mark == 'OK  ' else '#c00'))
H('Areas', 10.5)
T(f"Measured carpet (free floor, cores excluded): {carpet_m2:,.0f} m2 = {carpet_m2 * SQ:,.0f} sq ft.  Cores inside the offer: {core_m2:,.0f} m2.  Plate inside the offer (gross): {offer.area:,.0f} m2 = {offer.area * SQ:,.0f} sq ft.")
if sheet_carpet: T(f"Sheet: carpet {sheet_carpet:,} sq ft{', chargeable ' + format(sheet_charge, ',') + ' sq ft' if sheet_charge else ''}.  Free floor vs sheet carpet: {area_res['diff_vs_sheet_carpet_pct']:+.1f} %; with partitions: {area_res['incl_partitions_vs_sheet_carpet_pct']:+.1f} %  ->  {'PASS' if area_ok else ('PASS only with partitions' if area_ok_partitions else 'FAIL (outside 3 %, see flags)')}." + (f"  Gross vs chargeable: {area_res['gross_vs_sheet_chargeable_pct']:+.1f} %." if sheet_charge else ''), 8.2, '#0a7d2c' if area_ok else '#c00')
else: T('The sheet states no area for this plan.')
T('By use (m2): ' + ', '.join(f"{k} {v:,.0f}" for k, v in area_res['by_kind_m2'].items()))
if EG:
    st = EG['stats']; H('Entries and exits', 10.5)
    for b in EG['entries']['lift_banks']:
        if b['reachable']: T(f"Lift bank, {b['lifts']} lifts at ({b['at'][0]:.0f}, {b['at'][1]:.0f}){', ' + b['lobby_label'] if b['lobby_label'] else ''}: " + (f"{b['walk_to_reception_m']:.0f} m walk to {EG['entries']['reception']['name']}" + (f", front door {b['front_door']['block']} {b['front_door']['width_m']:.2f} m at ({b['front_door']['at'][0]:.0f}, {b['front_door']['at'][1]:.0f})" if b.get('front_door') else ', no door on the way (reception open to the lobby)') if b.get('walk_to_reception_m') is not None else 'no route to the reception on the drawn doors'))
    T(f"Exit stairs reached: {', '.join(st['exits_used'])} ({len(st['exits_used'])}).  Seats with two exits: {st['seats_with_two_exits']} of {st['seats']}.  Nearest exit: median {st['nearest_exit_m']['median'] or 0:.0f} m, worst {st['nearest_exit_m']['max'] or 0:.0f} m.  Second exit: median {st['second_exit_m']['median'] or 0:.0f} m, worst {st['second_exit_m']['max'] or 0:.0f} m.")
    T(f"Seats beyond {st['limit_m']:.0f} m (sprinklered limit): {st[[k for k in st if k.startswith('seats_over_') and str(int(st['limit_m'])) in k][0]]}.  Beyond {st['limit_unsprinklered_m']:.0f} m (no sprinklers): {st[[k for k in st if k.startswith('seats_over_') and str(int(st['limit_unsprinklered_m'])) in k][0]]}.  Fire exit doors: {len(EG['fire_exit_doors'])}; fire-rescue balconies: {len(EG['fire_rescue_balconies'])} (fire-fighter access, not exits).")
if WK:
    H('Walkways (CAD label vs measured, chairs at desks)', 10.5)
    T(f"{WK['labels_at_least_as_wide']} of {WK['labels_checked']} passage labels are at least as wide as labelled. Pinch points under 1.2 m on circulation centrelines (doors excluded): {WK['scan']['n_under_1_2_m']}.")
    T('  '.join(f"{l['label_m'] * 1000:.0f}->{(l['measured_m'] or 0) * 1000:.0f}" for l in WK['labels']), 7.5)
if DL:
    H('Daylight (work seats within 6 m of facade glass)', 10.5)
    T(f"{DL['within_6_m']} of {DL['work_seats']} work seats ({(DL['share_within_6_m'] or 0) * 100:.0f} %) are within 6 m of a window; by facade: " + ', '.join(f"{k} {v}" for k, v in sorted(DL['within_6_m_by_facade'].items(), key=lambda t: -t[1])) + f". Median distance {DL['median_dist_m']} m, farthest {DL['max_dist_m']} m.")
    T('Glazed facade length inside the offer (m): ' + ', '.join(f"{k} {v:.0f}" for k, v in sorted(DL['glazed_length_m_by_facade'].items(), key=lambda t: -t[1])))
H(f'Flags and differences ({len(flags)})', 10.5)
for f_ in flags[:14]: T('- ' + f_, 7.4, '#a00')
if len(flags) > 14: T(f"... and {len(flags) - 14} more in the markdown sheet", 7.6, '#a00')
if WIDE:
    T(f"Hand fixes ({len(fixes)}) and assumptions ({len(assume)}): listed in full in the markdown sheet.", 8.0, '#444')
else:
  H(f'Hand fixes ({len(fixes)})', 10.5)
  for f_ in fixes[:6]: T('- ' + f_, 7.0, '#444')
  if len(fixes) > 6: T(f'... {len(fixes) - 6} more in the markdown sheet', 7.0, '#444')
  H('Assumptions', 10.5)
  for f_ in assume: T('- ' + f_, 7.0, '#444')
H_ = 0.48 if WIDE else 0.98                       # axes height in figure units: line step scales with it
step = lambda s_: (s_ / 640 + 0.0035) / H_
col, y = 0, 0.995
for t, s_, wt, c in L:
    if y - step(s_) < 0.003 and col < len(txs) - 1: col, y = col + 1, 0.995
    txs[col].text(0, y, t, fontsize=s_, weight=wt, color=c, va='top', family='DejaVu Sans Mono' if t.startswith(('  OK', '  DIFF')) else 'DejaVu Sans', clip_on=False); y -= step(s_)
fig.savefig(outname(a, '_G0.png'), facecolor='white'); plt.close(fig)

# ------------------------------------------------------------- the markdown sheet
md = [f"# G0 sign-off sheet: {C['name']}", '',
      f"CAD read of `{C.get('dwg_name')}` ({C.get('plan_label', '')}). {C.get('building', '')}.", f"Image: `{os.path.basename(outname(a, '_G0.png'))}` (true north up). Numbers: `{os.path.basename(outname(a, '_G0.json'))}`.", '',
      '## Headline', '',
      f"- **{cnt['W']} work seats, {len(seats)} seats in all.** " + ', '.join(f"{GN[g]} {cnt[g]}" for g in 'WMTCLKO' if cnt[g]) + '.',
      f"- **Area:** measured carpet {carpet_m2:,.0f} m2 ({carpet_m2 * SQ:,.0f} sq ft) of free floor, {(offer.area - core_m2) * SQ:,.0f} sq ft with the inner partitions" + (f", against the sheet's {sheet_carpet:,} sq ft: {area_res['diff_vs_sheet_carpet_pct']:+.1f} % / {area_res['incl_partitions_vs_sheet_carpet_pct']:+.1f} %: {'pass' if area_ok else ('pass only with partitions' if area_ok_partitions else 'fail')} on the 3 % rule." if sheet_carpet else '; the sheet states no area for this plan.'),
      ]
if EG:
    st = EG['stats']
    md.append(f"- **Exits:** {len(st['exits_used'])} exit stairs reached; {st['seats_with_two_exits']} of {st['seats']} seats have two. Nearest exit: median {st['nearest_exit_m']['median'] or 0:.0f} m, worst {st['nearest_exit_m']['max'] or 0:.0f} m.")
if DL: md.append(f"- **Daylight:** {(DL['share_within_6_m'] or 0) * 100:.0f} % of work seats within 6 m of a window.")
md.append(f"- **Flags:** {len(flags)} differences or open points (below).")
md += ['', '## Seats', '', '| Group | Seats | Where |', '|---|---:|---|']
for g in 'WMTCLKO':
    if cnt[g]: md.append(f"| {GN[g]} | {cnt[g]} | " + ', '.join(f"{k} {v}" for k, v in by_room[g].most_common(10)) + (' ...' if len(by_room[g]) > 10 else '') + ' |')
if LG:
    md += ['', '## The sheet legend, line by line', '']
    if LG.get('note'): md += [f"_{LG['note']}._", '']
    md += ['| Legend line | Required | Provided (sheet) | In the CAD | Same? | How the CAD was counted |', '|---|---:|---:|---:|---|---|']
    for r in LG['rows']: md.append(f"| {r['item']} | {r['req']} | {r['prov']} | {r['cad']} | {'yes' if r['cad'] == r['prov'] else '**no**'} | {r['cad_evidence']} |")
md += ['', '## Areas', '', f"{area_res['definition']}", '', '| Use | m2 | sq ft |', '|---|---:|---:|']
for k, v in area_res['by_kind_m2'].items(): md.append(f"| {k} | {v:,.0f} | {v * SQ:,.0f} |")
md += [f"| **Measured carpet, free floor (all but core)** | **{carpet_m2:,.0f}** | **{carpet_m2 * SQ:,.0f}** |", f"| Measured carpet with inner partitions (gross less cores) | {offer.area - core_m2:,.0f} | {(offer.area - core_m2) * SQ:,.0f} |", f"| Gross plate inside the offer | {offer.area:,.0f} | {offer.area * SQ:,.0f} |", '']
if sheet_carpet: md.append(f"Sheet: carpet {sheet_carpet:,} sq ft" + (f", chargeable {sheet_charge:,} sq ft (chargeable / carpet = {area_res['sheet_chargeable_over_carpet']})" if sheet_charge else '') + f". Source: {sheet.get('source', '')}. Free floor vs sheet carpet: **{area_res['diff_vs_sheet_carpet_pct']:+.1f} %** ({'pass' if area_ok else 'fail'} against the 3 % rule); with the inner partitions ({area_res['carpet_incl_partitions_sqft']:,} sq ft): **{area_res['incl_partitions_vs_sheet_carpet_pct']:+.1f} %** ({'pass' if area_ok_partitions else 'fail'}); gross inside the offer: {area_res['gross_vs_sheet_carpet_pct']:+.1f} %." + (f" Gross vs chargeable: {area_res['gross_vs_sheet_chargeable_pct']:+.1f} %." if sheet_charge else ''))
if EG:
    st = EG['stats']; md += ['', '## Entries', '']
    for b in EG['entries']['lift_banks']:
        if not b['reachable']: continue
        md.append(f"- Lift bank of {b['lifts']} at ({b['at'][0]:.0f}, {b['at'][1]:.0f}){' (' + b['lobby_label'] + ')' if b['lobby_label'] else ''}: " + (f"{b['walk_to_reception_m']:.0f} m walk to the reception" + (f"; front door: {b['front_door']['block']}, {b['front_door']['width_m']:.2f} m, at ({b['front_door']['at'][0]:.0f}, {b['front_door']['at'][1]:.0f}); doors on the way: {len(b['doors_on_route'])}" if b.get('front_door') else '; no door on the way (the reception is open to it)') if b.get('walk_to_reception_m') is not None else '**no walking route to the reception on the drawn doors**') + '.')
    if EG['entries']['reception']: md.append(f"- Reception: {EG['entries']['reception']['name']} at ({EG['entries']['reception']['at'][0]:.0f}, {EG['entries']['reception']['at'][1]:.0f}), {EG['entries']['reception']['area_m2']:.0f} m2.")
    md += ['', '## Exits and walking distances', '', f"{EG['method']}", '', '| Exit | Where | Doors / labels | Reached from this plan |', '|---|---|---|---|']
    for e in EG['exits']: md.append(f"| {e['id']} | ({e['c'][0]:.0f}, {e['c'][1]:.0f}) | {', '.join(e['door_labels']) or '-'} | {'yes' if e['reachable'] else 'no'} |")
    md += ['', f"- Seats with two exits: **{st['seats_with_two_exits']} of {st['seats']}**; with one only: {sum((st.get('seats_with_one_exit_only_by_room') or {}).values())} ({', '.join(f'{k} {v}' for k, v in (st.get('seats_with_one_exit_only_by_room') or {}).items()) or 'none'}); with none: {st['seats_with_no_exit']}.",
           f"- Walk to the nearest exit: median {st['nearest_exit_m']['median'] or 0:.1f} m, worst {st['nearest_exit_m']['max'] or 0:.1f} m. To the second exit: median {st['second_exit_m']['median'] or 0:.1f} m, worst {st['second_exit_m']['max'] or 0:.1f} m.",
           f"- Farthest seat: {st['farthest_seat']['seat_id']} in {st['farthest_seat']['room']}, {st['farthest_seat']['dist_1_m']} m to {st['farthest_seat']['exit_1']} and {st['farthest_seat']['dist_2_m']} m to {st['farthest_seat']['exit_2']}." if st.get('farthest_seat') else '',
           f"- {st['limit_note']}", f"- Fire exit doors: {', '.join(EG['fire_exit_doors']) or 'none'}. Fire-rescue balconies (fire-fighter access, not exits): {', '.join(EG['fire_rescue_balconies']) or 'none'}.",
           f"- Every seat's two nearest exits and distances: `{os.path.basename(outname(a, '_egress.csv'))}`; heat map: `{os.path.basename(outname(a, '_egress.png'))}`."]
if WK:
    md += ['', '## Walkways', '', WK.get('method', ''), '', '| CAD label | At | Label (m) | Measured, chairs at desks (m) | Desk to desk (m) | At least as wide? |', '|---|---|---:|---:|---:|---|']
    for l in WK['labels']: md.append(f"| {l['label']} | ({l['at'][0]:.0f}, {l['at'][1]:.0f}) | {l['label_m']:.2f} | {l['measured_m']} | {l['desk_to_desk_m']} | {'yes' if l['at_least_label'] else '**no**'} |")
    md += ['', f"Pinch points under 1.2 m found on circulation centrelines (door openings excluded): {WK['scan']['n_under_1_2_m']} of {WK['scan']['points']} sample points" + (': ' + '; '.join(f"{p['width_m']:.2f} m at ({p['at'][0]:.0f}, {p['at'][1]:.0f})" for p in WK['scan']['under_1_2_m'][:12]) if WK['scan']['n_under_1_2_m'] else '') + '. Most are strips along the facade or beside a column, not walking routes; they are listed for the G1 check.']
if DL:
    md += ['', '## Daylight by true facade', '', DL['method'] + '.', '',
           f"- {DL['within_6_m']} of {DL['work_seats']} work seats ({(DL['share_within_6_m'] or 0) * 100:.0f} %) are within 6 m of facade glass. By facade: " + ', '.join(f"{k} {v}" for k, v in sorted(DL['within_6_m_by_facade'].items(), key=lambda t: -t[1])) + '.',
           f"- Nearest facade for all work seats: " + ', '.join(f"{k} {v}" for k, v in sorted(DL['nearest_facade_all_work_seats'].items(), key=lambda t: -t[1])) + f". Median distance to glass {DL['median_dist_m']} m, farthest {DL['max_dist_m']} m.",
           f"- Glazed facade length inside the offer (m): " + ', '.join(f"{k} {v:.0f}" for k, v in sorted(DL['glazed_length_m_by_facade'].items(), key=lambda t: -t[1])) + '.']
md += ['', '## Flags and differences', ''] + [f"{i + 1}. {f_}" for i, f_ in enumerate(flags)]
md += ['', '## Hand fixes (each one is in the plan file with its reason)', ''] + [f"- {f_}" for f_ in fixes] + [f"- {n_auto} automatic closures of short door-less openings (room outlines only)."]
md += ['', '## Assumptions', ''] + [f"- {f_}" for f_ in assume]
md += ['', '## Sign-off', '', '- [ ] Seats and legend accepted, or differences explained', '- [ ] Areas accepted (or the landlord\'s area method requested)', '- [ ] Entries and exits accepted (flags sent to the designer)', '- [ ] Assumptions accepted', '', 'G1 (the 2D plan) starts only after this sheet is signed off.', '']
open(outname(a, '_G0.md'), 'w').write('\n'.join(md))
print(outname(a, '_G0.png')); print(outname(a, '_G0.md')); print('flags', len(flags))
for f_ in flags: print(' -', f_[:200])
