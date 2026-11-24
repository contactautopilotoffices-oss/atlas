"""Step 2b. ASK_DESIGNER.md: every question that would replace a default, grouped so one answer covers
many walls, with how many walls/doors (and metres of wall) each answer settles. Also writes the
typing statistics used in FEASIBILITY.md (stats.json).

    python -I questions.py <assemblies.json> <out_dir>
"""
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import load_json, save_json, rules

A = load_json(sys.argv[1]); OUT = sys.argv[2]; R = rules()
Q = R['questions']
hits = collections.defaultdict(lambda: {'walls': set(), 'openings': set(), 'm': 0.0, 'other': set()})


def collect(el, kind, length=0.0):
    seen = set()
    def walk(o):
        if isinstance(o, dict):
            if o.get('source') == 'default' and o.get('q'):
                for q in (o['q'] if isinstance(o['q'], list) else [o['q']]):
                    seen.add(q)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(el)
    for q in seen:
        h = hits[q]
        if kind == 'wall':
            h['walls'].add(el['id']); h['m'] += length
        elif kind == 'opening':
            h['openings'].add(el['id'])
        else:
            h['other'].add(kind)


for w in A['walls']:
    collect(w, 'wall', w['length_m']['value'])
for o in A['openings']:
    collect(o, 'opening')
for c in A['columns']:
    collect(c, 'column')
for k, v in A['levels'].items():
    collect({'id': k, 'v': v}, 'levels')
collect({'id': 'slab', 'v': A['slab']}, 'slab')
for o in A['openings']:                     # arches: every opening is affected by the arch question
    hits['Q-A1']['openings'].add(o['id'])
hits['Q-C1']['other'].add(f"{len(A['columns'])} columns")

# ---------------------------------------------------------------- typing statistics
W = A['walls']; O = A['openings']
tot_m = sum(w['length_m']['value'] for w in W)
cad_typed = [w for w in W if w['type']['source'] == 'cad' and w['type']['value'] != 'unknown']
conf_hi = [w for w in cad_typed if w['type']['confidence'] >= 0.8]
by_type = collections.defaultdict(lambda: {'n': 0, 'm': 0.0, 'rules': collections.Counter()})
for w in W:
    b = by_type[w['type']['value']]; b['n'] += 1; b['m'] += w['length_m']['value']; b['rules'][w['type'].get('rule')] += 1
by_rule = collections.Counter(w['type'].get('rule') for w in W)
n_attr = collections.Counter()
def walk(o):
    if isinstance(o, dict):
        if 'source' in o and 'value' in o and 'confidence' in o:
            n_attr[o['source']] += 1
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(A)
stats = {
    'walls': len(W), 'wall_m': round(tot_m, 1),
    'walls_typed_from_cad': len(cad_typed), 'walls_typed_from_cad_m': round(sum(w['length_m']['value'] for w in cad_typed), 1),
    'walls_typed_from_cad_high_conf': len(conf_hi), 'walls_typed_from_cad_high_conf_m': round(sum(w['length_m']['value'] for w in conf_hi), 1),
    'walls_unknown': sum(1 for w in W if w['type']['value'] == 'unknown'), 'walls_unknown_m': round(sum(w['length_m']['value'] for w in W if w['type']['value'] == 'unknown'), 1),
    'by_type': {k: {'n': v['n'], 'm': round(v['m'], 1), 'rules': dict(v['rules'])} for k, v in sorted(by_type.items(), key=lambda x: -x[1]['m'])},
    'by_rule': dict(by_rule),
    'openings': len(O), 'openings_typed_from_cad': sum(1 for o in O if o['kind']['source'] == 'cad'),
    'openings_by_kind': dict(collections.Counter(o['kind']['value'] for o in O)),
    'openings_hosted': sum(1 for o in O if o['host']['value']),
    'openings_hosted_both_sides': sum(1 for o in O if len(o['cad']['flanking_walls']) == 2),
    'openings_with_header': sum(1 for o in O if o['header']['value']['kind'] != 'none_open_above'),
    'headers_by_kind': dict(collections.Counter(o['header']['value']['kind'] for o in O)),
    'frames_from_cad': sum(1 for o in O if o['frame']['source'] == 'cad'),
    'door_width_sources': {k: dict(collections.Counter(o[k]['source'] for o in O)) for k in ('opening_width_m', 'frame_outside_width_m', 'clear_width_m', 'leaf_width_m')},
    'doors_with_nominal_from_name': sum(1 for o in O if o.get('nominal_width_m')),
    'arches': sum(1 for o in O if o.get('arch')),
    'columns': len(A['columns']), 'columns_rcc_from_hatch': sum(1 for c in A['columns'] if c['type']['source'] == 'cad'),
    'attributes': dict(n_attr), 'dropped_pieces': len(A['dropped_pieces']), 'overrides_applied': A['overrides_applied'],
}
save_json(stats, os.path.join(OUT, 'stats.json'))

# ---------------------------------------------------------------- ASK_DESIGNER.md
groups = collections.OrderedDict()
for qid, q in Q.items():
    groups.setdefault(q['group'], []).append(qid)
L = ["# Questions for the designer (Offices 603 & 604, RTP 6th floor)\n",
     "The drawing gives every wall's position, length and thickness, and every door's position and width. It does not give "
     "heights, build-ups, what sits above doors, or whether anything is arched. Until the designer answers, the model uses the "
     "default in each question (the founder's instruction of 19 November 2026: use common Indian office fit-out defaults and mark them). "
     "Every default is tagged `source: default` in the model, the IFC, the DXF and the trace page.\n",
     "Each question is written so that one answer settles every wall or door listed against it. "
     "Answers go into `rules.json` (the `defaults` and `assemblies` sections); re-running `run.sh` rebuilds everything.\n",
     f"In all: {stats['walls']} wall pieces ({stats['wall_m']} m), {stats['openings']} doors, {stats['columns']} columns.\n"]
n = 0
for g, qids in groups.items():
    L.append(f"## {g}\n")
    for qid in qids:
        h = hits.get(qid)
        cover = []
        if h:
            if h['walls']: cover.append(f"{len(h['walls'])} wall pieces, {h['m']:.0f} m")
            if h['openings']: cover.append(f"{len(h['openings'])} doors")
            if h['other']: cover.append(', '.join(sorted(h['other'])))
        n += 1
        L.append(f"**{qid}.** {Q[qid]['ask']}  ")
        L.append(f"*Default used:* {Q[qid]['default']}. *One answer settles:* {'; '.join(cover) if cover else 'nothing in this drawing yet'}.\n")
L.append("## For the next drawing: how to make these questions unnecessary\n")
L.append("Draw each wall type on its own layer (for example `A-WALL-GLASS`, `A-WALL-POP`, `A-WALL-BLOCK`, `A-WALL-MIXED`) and put a short "
         "type tag (for example `GP1`, `DW2`) on each wall, with a legend that gives the build-up and band heights per tag. Draw doors "
         "as blocks with attributes for head height and header type. `DRAWING_STANDARD` in FEASIBILITY.md has the full list.\n")
open(os.path.join(OUT, 'ASK_DESIGNER.md'), 'w').write('\n'.join(L) + '\n')
print('questions', n, '| stats:', json.dumps({k: stats[k] for k in ('walls', 'walls_typed_from_cad', 'walls_unknown', 'openings', 'openings_hosted', 'openings_with_header')}))
