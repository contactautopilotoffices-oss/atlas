"""Seat proof: <tenant>_seats.csv and <tenant>_summary.json (and summary.json, same content).

Every chair block instance is a row (sofas: one row per place). Groups, in Volt's order:
  W work seat     a work chair (task / director / supervisor / staff) not in an operator room
  M meeting       meeting, conference and interview chairs
  T training      training-room chairs (new group; Volt had none)
  C cafe          cafe chairs and stools, and any chair in a pantry/cafe room
  L lounge        lounge, collab, reception and visitor seating
  O operator      any chair in a room matching the tenant's 'operator_rooms' (Autopilot cabin, its reception)
The summary also compares the CAD with the design deck (tenants/<t>.json 'deck_claims'); the CAD wins.
"""
import json, os, sys, csv, collections, re, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import args, load_flat, Frame, outname, is_poly
from geom import clean_text

a = args(); C = a.cfg; F = Frame(C)
S = json.load(open(os.path.join(a.work, 'seats.json')))
R = json.load(open(os.path.join(a.work, 'rooms.json')))
I = json.load(open(os.path.join(a.work, 'inst.json')))
d = load_flat(a)['rec']
NAMES = {'W': 'Work seats (desk + chair)', 'M': 'Meeting room seats', 'T': 'Training room seats', 'C': 'Cafeteria seats',
         'L': 'Lounge, collab and visitor seats', 'O': 'Operator (Autopilot cabin, reception)'}
order = {r['name']: i for i, r in enumerate(sorted(R['rooms'], key=lambda r: (-r['poly'][0][1], r['poly'][0][0])))}
S.sort(key=lambda r: ('WMTCLO'.index(r['grp']), order.get(r['room'], 999), -round(r['y_in'] / 6), r['x_in']))
cnt = collections.Counter()
for r in S: cnt[r['grp']] += 1; r['seat_id'] = f"{r['grp']}{cnt[r['grp']]}"
json.dump(S, open(os.path.join(a.work, 'seats.json'), 'w'))
cols = ['seat_id', 'group', 'room', 'kind', 'at_desk', 'block', 'parent_block', 'x_in', 'y_in', 'instance', 'room_kind', 'desk_pair', 'x_m', 'y_m', 'place']
with open(outname(a, '_seats.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(cols)
    for r in S: w.writerow([r['seat_id'], NAMES[r['grp']], r['room'], r['kind'], r['at_desk'], r['block'], r['parent_block'], r['x_in'], r['y_in'], r['handle'],
                            r['room_kind'], r['desk_pair'], r['x_m'], r['y_m'], f"{r['place']}/{r['places']}"])
by = collections.defaultdict(collections.Counter)
for r in S: by[r['grp']][r['room']] += 1
summary = {NAMES[g]: {'total': sum(by[g].values()), 'rooms': dict(by[g])} for g in 'WMTCLO' if by[g]}

# ------------------------------------------------------------- inventory the deck is checked against
DK = C['desks']
desks = collections.Counter(DK[o['name']] for o in I if o['name'] in DK)
def dupes(name):
    xs = [(o['cx'], o['cy']) for o in I if o['name'] == name]
    return sum(1 for i, p in enumerate(xs) for q in xs[:i] if math.dist(p, q) < 4)      # within 4 inches = drawn twice
labels = [l for l in R['labels']]
def label_rooms(rx):
    u = []
    for l in labels:
        if re.search(rx, l['t'], re.I) and not any(v['t'] == l['t'] and math.dist((v['x'], v['y']), (l['x'], l['y'])) < 1.0 for v in u): u.append(l)
    return u
rooms_by_kind = collections.Counter(r['kind'] for r in R['rooms'])
work_paired = sum(1 for s in S if s['grp'] == 'W' and (s['at_desk'] or s['desk_pair']))
inv = {'desk_blocks': dict(desks), 'desk_block_duplicates': {n: dupes(n) for n in DK if any(o['name'] == n for o in I)},
       'work_seats_paired_with_desk': work_paired, 'work_seats_without_desk_nearby': cnt['W'] - work_paired,
       'room_kinds': dict(rooms_by_kind), 'chairs_by_kind': dict(collections.Counter(s['kind'] for s in S))}

# lockers: unit rectangles on the locker layer; tiers are not drawn in plan, so tiers = label count / units in that run
lock = None
if C.get('lockers'):
    LL = C['lockers']['layer']; units = []
    for r in d:
        if is_poly(r) and r['L'] == LL and F.inwin(r['p'][0]):
            P = [F.m(*q) for q in r['p']]; xs = [p[0] for p in P]; ys = [p[1] for p in P]
            w_, h_ = max(xs) - min(xs), max(ys) - min(ys)
            if 0.2 < min(w_, h_) < 0.6 and max(w_, h_) < 0.8: units.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, round(w_, 3), round(h_, 3)))
    runs = collections.defaultdict(list)
    for u in units: runs[round(u[0], 1)].append(u)
    lab = [(l, int(re.search(r'(\d+)\s*nos', l['t'], re.I).group(1))) for l in labels if re.search(r'LOCKERS?\s*(\d+)\s*nos', l['t'], re.I)]
    rr = []
    for x, us in sorted(runs.items()):
        cy = sum(u[1] for u in us) / len(us)
        l, nlab = min(lab, key=lambda t: math.dist((t[0]['x'], t[0]['y']), (x, cy))) if lab else (None, None)
        rr.append({'x_m': x, 'units_in_plan': len(us), 'unit_size_m': list(us[0][2:]), 'label': l['t'] if l else None, 'label_count': nlab,
                   'tiers_implied': round(nlab / len(us), 2) if nlab else None})
    lock = {'units_in_plan': len(units), 'runs': rr, 'lockers_by_labels': sum(n for _, n in lab),
            'note': 'Locker units are drawn once in plan (one rectangle per column of lockers). Tiers are not in a 2D plan; the label counts divided by the drawn units give 6 tiers in every run.'}
    inv['lockers'] = lock

# ------------------------------------------------------------- deck vs CAD
claims = C.get('deck_claims', {}); cmp_ = []
def line(item, deck, cad, how):
    ok = (str(deck) == str(cad)); cmp_.append({'item': item, 'deck': deck, 'cad': cad, 'match': ok, 'cad_evidence': how})
if a.tenant == 'arcil':
    ws = desks.get("3'x2' workstation", 0)
    in_tr = sum(1 for s_ in S if s_['parent_block'] == 'A$C62789d74' and s_['room_kind'] == 'training')
    line('Workstations', claims['workstations'], ws - in_tr, f"{ws} 3'x2' workstation blocks (A$C62789d74, each with a nested task chair, none drawn twice); {in_tr} of them is the trainer's desk inside the training room, leaving {ws - in_tr} open-plan workstations. Plan label: WORKSTATION - 238 NOS. Sheet tables: 239 on the two furniture layouts, 238 on the RCP sheet.")
    sv = desks.get('supervisor workstation', 0)
    line('Supervisor stations', claims['supervisor_stations'], sv, f"{sv} WEGWG blocks (supervisor workstation, nested supervisor chair, 'SUPERVISOR' text). Separately {desks.get(DK.get('CUBJ',''), 0)} CUBJ supervisor cubicles (5'x4'6\") with no chair block.")
    cab = label_rooms(r'^CABIN')
    line('Cabins', claims['cabins'], len(cab), f"labels {', '.join(l['t'] for l in cab)}; {sum(1 for o in I if o['name']=='A$C7e9a1dde')} cabin furniture sets (director desk + chair + 2 visitor chairs)")
    mt = label_rooms(r'MEETING|CONFERENCE')
    line('Meeting / conference rooms', claims['meeting_conference_rooms'], len(mt), f"labels {', '.join(l['t'] for l in mt)} (both 8-pax rooms are labelled 'RM 02' in the CAD)")
    iv = label_rooms(r'INTERVIEW')
    line('Interview rooms', claims['interview_rooms'], len(iv), ', '.join(l['t'] for l in iv))
    tr = [s for s in S if s['room_kind'] == 'training']
    tc = sum(1 for s in tr if s['grp'] == 'T'); tw = sum(1 for s in tr if s['grp'] == 'W')
    line('Training room seats', claims['training_room_seats'], f"{tc}+{tw}", f"{tc} training chairs (A$C92802071) + {tw} trainer desk chair inside the TRAINING ROOM polygon")
    line('Lockers', claims['lockers'], lock['lockers_by_labels'] if lock else None,
         f"labels {' + '.join(str(r['label_count']) for r in lock['runs'])}; plan shows {lock['units_in_plan']} locker columns ({' + '.join(str(r['units_in_plan']) for r in lock['runs'])}) x 6 tiers" if lock else '')
elif a.tenant == 'paytm':
    ws = sum(v for k, v in desks.items() if 'workstation' in k)
    lab = sum(int(m.group(1)) for l in label_rooms(r'WORKSTATION') for m in [re.search(r'(\d+)\s*NOS', l['t'])] if m)
    line('Workstations (CAD labels)', lab, cnt['W'], f"{cnt['W']} work seats; desk blocks {dict(desks)} (3 of the 3'x2' desks are in the Autopilot cabin)")
elif a.tenant == 'volt':
    line('Work seats (live Volt pipeline)', claims.get('work_seats'), cnt['W'], 'generic pipeline re-run on the Volt DWG')
    line('All seats (live Volt pipeline)', claims.get('all_seats'), len(S), 'generic pipeline re-run on the Volt DWG')
meta = {'tenant': C['name'], 'floor': a.floor, 'dwg': C.get('dwg_name'), 'work_seats': cnt['W'], 'all_seats': len(S),
        'seats_by_group': {NAMES[g]: cnt[g] for g in 'WMTCLO' if cnt[g]}, 'deck_vs_cad': cmp_, 'inventory': inv,
        'unplaced_room_labels': [l['t'] for l in R.get('unplaced_labels', [])],
        'method': 'One row per chair block instance (sofas: one per place). Room = the CAD room polygon containing the chair (rooms are the spaces closed by wall, glass and column lines with doors closed, named by the CAD text inside). Work seat = a work chair not in an operator room; desk pairing (chair nested in a desk block, or a desk block within 1.0 m) is reported per seat in desk_pair.'}
summary['_proof'] = meta
for p in (outname(a, '_summary.json'), os.path.join(a.out, 'summary.json')): json.dump(summary, open(p, 'w'), indent=1)
print(json.dumps({k: v for k, v in meta.items() if k in ('work_seats', 'all_seats', 'seats_by_group', 'deck_vs_cad')}, indent=1))
