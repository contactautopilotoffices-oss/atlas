"""Gate sheet (G2 clay and the build gates after it) for one plan: an image and a plain-English markdown file.

    python3 gate_sheet.py --tenant rtp6-a --out <build dir> --gate G2 [--name "RTP 6th floor, Option A"] [--dest <dir>]

Reads what the builder wrote in <out>: <t>_placement.json (placement check), <t>_coplanar.json (2 mm coplanar
scan), <t>_greycard.json / <t>_windows.json (light), <t>_cameras_report.json, <t>_timings.json, the clay views
(review/clay_*.png) and, for the build gates, the bake and export manifests. A gate passes only on its checks.
Writes <dest>/<t>_<gate>.png and <dest>/<t>_<gate>.md (dest defaults to <out>).
"""
import json, os, sys, glob, argparse, textwrap
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
import matplotlib.image as mpimg

ap = argparse.ArgumentParser(); ap.add_argument('--tenant', required=True); ap.add_argument('--out', required=True); ap.add_argument('--gate', default='G2')
ap.add_argument('--name', default=''); ap.add_argument('--dest', default=''); ap.add_argument('--notes', default='', help='json list of extra lines')
A = ap.parse_args(); t = A.tenant; O = A.out; D = A.dest or O; os.makedirs(D, exist_ok=True)
J = lambda f: json.load(open(os.path.join(O, f))) if os.path.exists(os.path.join(O, f)) else None
pl, cp, tm = J(f'{t}_placement.json'), J(f'{t}_coplanar.json'), J(f'{t}_timings.json')
gc, wn, cr, vw = J(f'{t}_greycard.json'), J(f'{t}_windows.json'), J(f'{t}_cameras_report.json'), J(f'export/{t}_viewer.json') or J(f'{t}_viewer.json')
checks = []
def chk(name, ok, detail): checks.append({'check': name, 'pass': bool(ok), 'detail': detail})
if pl is not None:
    iss = pl.get('issues') or pl.get('problems') or []
    chk('Placement: nothing floating, sunk, inside a wall or another object; walkways >= 1.2 m', pl.get('ok'),
        f"{len(iss)} issue(s)" + ('' if not iss else ': ' + '; '.join(str(i.get('what', i))[:110] for i in iss[:6])) + (f"; nudges applied: {len(pl.get('nudged', []))}" if pl.get('nudged') else ''))
if cp is not None:
    chk('No two coplanar faces closer than 2 mm (flicker)', cp['ok'], f"{cp['n_hits']} overlapping pairs among {cp['faces_checked']:,} faces" + ('' if cp['ok'] else ': ' + '; '.join(f"{p['a']} / {p['b']} x{p['n']}" for p in cp['by_object_pair'][:5])))
if A.gate != 'G2':
    if gc is not None: chk('Light: exposure from grey cards; previews not blown or crushed', not gc.get('fails'), json.dumps({k: gc[k] for k in list(gc)[:4]})[:220])
    if cr is not None:
        nv = sum(1 for r in cr.values() if isinstance(r, dict) and r.get('views')); nf = sum(1 for r in cr.values() if isinstance(r, dict) and r.get('error'))
        chk('Cameras: every shown room has a ray-checked view', nf == 0, f"{nv} rooms with views, {nf} without")
    if vw is not None: chk('Export: web model written (GLB, LOD GLB, viewer.json, lightmaps)', True, f"camera near {vw.get('camera', {}).get('near')} m; files: {len(vw.get('files', []))}")
ok = all(c['pass'] for c in checks) and bool(checks)
clays = sorted(glob.glob(os.path.join(O, 'review', 'clay_*.png')))
top = [c for c in clays if c.endswith('clay_top.png')]; eyes = [c for c in clays if not c.endswith('clay_top.png')][:6]
fig = plt.figure(figsize=(23.4, 16.5), dpi=100)
fig.text(0.01, 0.985, f"{A.gate} {'CLAY MODEL' if A.gate == 'G2' else 'BUILD'}  |  {A.name or t}  |  {'PASS' if ok else 'FAIL'} on its automated checks", fontsize=18, weight='bold', va='top', color='#0a7d2c' if ok else '#c00')
y = 0.955
for c in checks:
    for i, ln in enumerate(textwrap.wrap(('PASS  ' if c['pass'] else 'FAIL  ') + c['check'] + ': ' + c['detail'], 210)):
        fig.text(0.01, y, ('      ' if i else '') + ln, fontsize=9, va='top', color='#0a7d2c' if c['pass'] else '#c00', family='DejaVu Sans Mono'); y -= 0.016
if tm: fig.text(0.01, y - 0.004, 'Stage times (s): ' + ', '.join(f"{k} {v['seconds']:.0f}" for k, v in tm.items()), fontsize=8.5, va='top', color='#444'); y -= 0.02
if top:
    ax = fig.add_axes([0.01, 0.33, 0.62, y - 0.34]); ax.imshow(mpimg.imread(top[0])); ax.axis('off'); ax.set_title('Top view, ceilings off (north up)', fontsize=10)
for k, p in enumerate(eyes):
    ax = fig.add_axes([0.64 + (k % 2) * 0.18, 0.66 - (k // 2) * 0.165, 0.175, 0.155] if k < 4 else [0.01 + (k - 4) * 0.31, 0.01, 0.30, 0.30]); ax.imshow(mpimg.imread(p)); ax.axis('off'); ax.set_title(os.path.basename(p)[5:-4][:50], fontsize=7)
notes = json.loads(A.notes) if A.notes else []
yy = 0.30
for ln in notes:
    for i, l2 in enumerate(textwrap.wrap(ln, 120)): fig.text(0.64, yy, ('   ' if i else '- ') + l2, fontsize=8.5, va='top', color='#333'); yy -= 0.015
fig.savefig(os.path.join(D, f'{t}_{A.gate}.png'), facecolor='white'); plt.close(fig)
md = [f"# {A.gate} sheet: {A.name or t}", '', f"**Result: {'PASS' if ok else 'FAIL'} on the automated checks.** Image: `{t}_{A.gate}.png`.", '', '| Check | Result | Detail |', '|---|---|---|']
md += [f"| {c['check']} | {'pass' if c['pass'] else '**FAIL**'} | {c['detail']} |" for c in checks]
if tm: md += ['', 'Stage times (s): ' + ', '.join(f"{k} {v['seconds']:.0f}" for k, v in tm.items())]
md += ['', '## Notes', ''] + [f"- {n}" for n in notes] + ['', f"Clay views: {', '.join(os.path.basename(c) for c in clays)}", '']
open(os.path.join(D, f'{t}_{A.gate}.md'), 'w').write('\n'.join(md))
json.dump({'gate': A.gate, 'pass': ok, 'checks': checks}, open(os.path.join(D, f'{t}_{A.gate}.json'), 'w'), indent=1)
print(A.gate, 'PASS' if ok else 'FAIL'); [print(' ', 'pass' if c['pass'] else 'FAIL', c['check'], '|', c['detail'][:200]) for c in checks]
