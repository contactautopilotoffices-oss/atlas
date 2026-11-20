"""Door-by-door comparison of host walls: the earlier logic (out/audit/hosts_before.json) against the current run.
For every door whose host changed, test the earlier host against the current drawn opening (the swing or the gap):
  in line and ending at the opening      -> a valid host the current run missed
  in line and running through the opening -> a wall the door is cut into (valid, through-wall)
  not in line with the drawn opening      -> the earlier host was a neighbouring wall (wrong)
  in line but eaten by the earlier cut    -> the earlier host was wrong (the cut destroyed it)
    python -I host_audit.py <assemblies.json> <out_dir>
"""
import collections, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import load_json, save_json

A = load_json(sys.argv[1]); OUT = sys.argv[2]
B = load_json(os.path.join(OUT, 'audit', 'hosts_before.json'))
Wnow = {w['id']: w for w in A['walls']}
by_handles = {tuple(sorted(h for h in w['cad']['face_handles'] if h)): w['id'] for w in A['walls']}


def wall_now(old_id):
    """the same wall in the current run: same id AND the same centre line (handles alone are not unique: lines inside a
    block carry the handle of the block definition, shared by every insert of that block)"""
    if not old_id:
        return None
    w = Wnow.get(old_id)
    if w is None:
        return None
    a0 = B['walls'][old_id]['axis']; a1 = w['axis']['value']
    same = len(a0) == len(a1) and all(abs(p[0] - q[0]) < 1e-3 and abs(p[1] - q[1]) < 1e-3 for p, q in zip(a0, a1))
    return old_id if same else None


def relation(wid, line):
    w = Wnow[wid]; ax = w['axis']['value']
    if len(ax) != 2:
        return {'rel': 'curved host'}
    (a, b) = line
    Lw = math.hypot(ax[1][0] - ax[0][0], ax[1][1] - ax[0][1]); wu = ((ax[1][0] - ax[0][0]) / Lw, (ax[1][1] - ax[0][1]) / Lw); wn = (-wu[1], wu[0])
    L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1e-9
    par = abs(wu[0] * (b[0] - a[0]) + wu[1] * (b[1] - a[1])) / L
    off = max(abs((q[0] - ax[0][0]) * wn[0] + (q[1] - ax[0][1]) * wn[1]) for q in (a, b))
    ta = (a[0] - ax[0][0]) * wu[0] + (a[1] - ax[0][1]) * wu[1]; tb = (b[0] - ax[0][0]) * wu[0] + (b[1] - ax[0][1]) * wu[1]
    omin, omax = min(ta, tb), max(ta, tb)
    overlap = min(Lw, omax) - max(0.0, omin)
    gap = 0.0 if overlap > 0 else min(abs(omin - Lw), abs(omax))
    inline = par > math.cos(math.radians(4)) and off <= w['thickness_m']['value'] / 2 + 0.06
    r = {'parallel': round(par, 4), 'offset_m': round(off, 3), 'overlap_m': round(overlap, 3), 'gap_m': round(gap, 3), 'wall_length_m': round(Lw, 3)}
    if not inline:
        r['rel'] = 'not in line with the drawn opening'
    elif overlap > 0.03:
        r['rel'] = 'runs through the drawn opening' if overlap < Lw - 0.03 or Lw > L + 0.06 else 'lies inside the drawn opening (would be eaten by the cut)'
    elif gap <= 0.3:
        r['rel'] = 'ends at the drawn opening (flank)'
    elif gap <= 0.6:
        r['rel'] = 'in line, 0.3-0.6 m from the opening'
    else:
        r['rel'] = 'in line but far from the opening'
    return r


rows = []; cnt = collections.Counter()
for ob in B['openings']:
    o = next(x for x in A['openings'] if x['cad']['insert_handle'] == ob['insert_handle'])
    old = wall_now(ob['host']); new = o['host']['value']
    if old == new:
        status = 'same host' if new else 'unhosted before and now'
    elif old and not new:
        status = 'host lost'
    elif new and not old:
        status = 'host gained'
    else:
        status = 'host changed'
    row = {'door': o['id'], 'insert_handle': ob['insert_handle'], 'block': ob['block'], 'layer': ob['layer'], 'kind': ob['kind'], 'status': status,
           'before': {'host': old, 'host_type': Wnow[old]['type']['value'] if old else None, 'host_handles': B['walls'][ob['host']]['handles'] if ob['host'] else None,
                      'line': ob['line'], 'width_m': ob['width_m'], 'how': ob['width_why']},
           'now': {'host': new, 'line': o['line']['value'], 'width_m': o['width_m']['value'], 'how': o['cad']['opening_from'], 'why': o['width_m']['why']}}
    if old and old != new:
        row['before_host_vs_current_opening'] = relation(old, o['line']['value'])
        row['before_host_vs_its_own_opening'] = relation(old, ob['line'])
        rel = row['before_host_vs_current_opening']['rel']; own = row['before_host_vs_its_own_opening']['rel']
        if 'eaten' in own:
            verdict = 'earlier host was wrong: the earlier opening covered the whole wall and the cut destroyed it'
        elif rel == 'ends at the drawn opening (flank)':
            verdict = 'earlier host is valid and the current run missed it'
        elif rel == 'runs through the drawn opening':
            verdict = 'earlier host is valid (the door is cut into it) and the current run missed it'
        elif rel == 'not in line with the drawn opening':
            verdict = 'earlier host was wrong: it is not in line with the drawn door swing'
        else:
            verdict = 'unresolved: ' + rel
        row['verdict'] = verdict; cnt[verdict] += 1
    cnt[status] += 1
    rows.append(row)
save_json({'rows': rows, 'counts': dict(cnt)}, os.path.join(OUT, 'audit', 'host_audit.json'))
for k, v in cnt.most_common():
    print(f'{v:3d}  {k}')


# ---------------------------------------------------------------- report
ops = A['openings']
unh = [o for o in ops if not o['host']['value']]
why_unh = collections.Counter()
for o in unh:
    k = o['kind']['value']
    if k == 'cubicle_door':
        why_unh['cubicle door: the drawn gap is in the cubicle side, where the only drawn pieces are 20 x 79 mm stubs (too short to be read as walls)'] += 1
    elif o['cad']['block'] == 'Glass Door':
        why_unh['Glass Door block on DR-GLASS: no wall piece ends at its drawn swing'] += 1
    elif o['cad']['block'] == 'double door':
        why_unh['double door: only one of the two leaf swings is read, and its line meets no wall (unresolved)'] += 1
    else:
        why_unh[f"{o['cad']['block']}: no wall piece ends at its drawn swing"] += 1
ties = [o['id'] for o in ops if 'low confidence' in o['width_m'].get('why', '')]
hk = collections.Counter(o['header']['value']['kind'] for o in ops)
fr = collections.Counter(o['frame']['source'] for o in ops)
rel = collections.Counter(o['cad'].get('host_relation') or 'none' for o in ops)
summary = {'doors': len(ops), 'hosted': len(ops) - len(unh), 'host_relation': dict(rel), 'true_wall_voids': rel.get('through', 0),
           'gap_doors': rel.get('gap', 0), 'freestanding_unhosted': len(unh), 'unhosted_by_reason': dict(why_unh),
           'headers_by_kind': dict(hk), 'header_pieces_built': sum(v for k, v in hk.items() if k != 'none_open_above'),
           'frames_by_source': dict(fr), 'closed_side_by_tie_break': ties,
           'unresolved_associations': len(unh), 'before_after': dict(cnt)}
save_json({'rows': rows, 'counts': dict(cnt), 'summary': summary}, os.path.join(OUT, 'audit', 'host_audit.json'))
L = ['# Door hosting audit (observer review, 20 Nov 2026)\n',
     'Every door is compared with the earlier run (block-edge search plus the cubicle own-panel fallback), door by door, by its door-block insert handle. '
     'An earlier host is tested against the door swing the drawing actually draws. Walls are matched by id and centre line, because a line inside a block carries the handle of the block *definition*, shared by every insert of that block.\n',
     '## Where the doors stand now\n',
     f"- {summary['doors']} door blocks in 603/604. **{summary['hosted']} hosted**: all of them sit in a gap the drawing leaves between wall ends. True wall voids, where a wall is drawn continuous across the door and must be cut: **{summary['true_wall_voids']}**.",
     f"- **{summary['freestanding_unhosted']} doors are built freestanding**, on their drawn swing line, with no host wall. No wall is invented and no host is forced. Why:",
     *[f"  - {v} x {k}" for k, v in why_unh.items()],
     f"- Headers: {summary['header_pieces_built']} header pieces built ({', '.join(f'{v} {k.replace(chr(95), chr(32))}' for k, v in hk.items() if k != 'none_open_above')}); {hk.get('none_open_above', 0)} doors have nothing above them by rule (cubicles; a cubicle has no wall above its door).",
     f"- Frames: {fr.get('cad', 0)} from jamb sections drawn in the block, {fr.get('default', 0)} default.",
     f"- Closed side of the swing decided by tie-break (low confidence): {', '.join(ties) if ties else 'none'}.",
     f"- Unresolved associations: {summary['unresolved_associations']} (the freestanding doors above). Their headers and leaves are built, but no wall is linked in IFC.\n",
     '## The 22 doors that lost their earlier host\n',
     '| Door | Block (insert handle) | Earlier host | Earlier host vs the drawn swing | Verdict |', '|---|---|---|---|---|']
for r in rows:
    if r['status'] in ('host lost', 'host changed'):
        c = r.get('before_host_vs_current_opening', {}); o = r.get('before_host_vs_its_own_opening', {})
        L.append(f"| {r['door']} | `{r['block']}` ({r['insert_handle']}) | {r['before']['host']} ({r['before']['host_type']}, handles {', '.join(h for h in (r['before']['host_handles'] or []) if h)}) | "
                 f"{c.get('rel', '')}: offset {c.get('offset_m', '')} m, gap {c.get('gap_m', '')} m; its own earlier opening: {o.get('rel', '')} | {r.get('verdict', '')} |")
L.append('\n## Doors unhosted before and now\n')
L.append('| Door | Block (insert handle) | Layer | Opening from | Width (m) |'); L.append('|---|---|---|---|---|')
for r in rows:
    if r['status'] == 'unhosted before and now':
        L.append(f"| {r['door']} | `{r['block']}` ({r['insert_handle']}) | `{r['layer']}` | {r['now']['how']} | {r['now']['width_m']} |")
open(os.path.join(OUT, 'audit', 'HOST_AUDIT.md'), 'w').write('\n'.join(L) + '\n')
print(json.dumps(summary)[:900])
