"""Step 6. Proof that the 3D model is what the drawing + rules specify. Reads the FreeCAD output back (the
tessellated mesh of every FreeCAD object, and the IFC file) and compares it element by element with the
assembly file. Nothing here trusts the builder: it measures what was built.

Checks per wall: IFC class and IfcMaterial per band; each band's z range in 3D = the specified band (2 mm);
thickness in 3D = drawn line spacing (2 mm, straight walls); 3D centre line on the CAD centre line (5 mm);
the original entity handles are on the IFC element. Per door: an IfcDoor exists, it fills an opening in the
host wall, the header piece exists with the specified z range. Per column: IfcColumn with the CAD outline.

    python -I verify.py <assemblies.json> <out_dir>     -> <out_dir>/verify.json, exit 1 on any failure
"""
import collections, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ifcopenshell, ifcopenshell.util.element as ue
from lib import load_json, save_json, rules

A = load_json(sys.argv[1]); OUT = sys.argv[2]; R = rules()
mesh = load_json(os.path.join(OUT, 'rtp6_floor6.mesh.json'))
f = ifcopenshell.open(os.path.join(OUT, 'rtp6_floor6.ifc'))
TOL_Z, TOL_T, TOL_AX = 0.002, 0.002, 0.005
IFC_CLASS = {'glass_partition': 'IfcWall', 'full_height_glass': 'IfcWall', 'pop_gypsum': 'IfcWall', 'mixed': 'IfcWall', 'brick_block': 'IfcWall',
             'rcc': 'IfcWall', 'acp': 'IfcCovering', 'curtain_wall': 'IfcCurtainWall', 'window_glazing': 'IfcWindow',
             'panel_partial_height': 'IfcWall', 'railing': 'IfcRailing', 'unknown': 'IfcWall'}
LABEL = {k: v['label'] for k, v in R['materials'].items()}

by_id = collections.defaultdict(list)
for m in mesh['meshes']:
    by_id[m['id']].append(m)
ifc_by = collections.defaultdict(list)
for e in f.by_type('IfcProduct'):
    ps = ue.get_psets(e)
    sid = ps.get('Pset_SemanticCAD', {}).get('spec_id')
    if sid:
        ifc_by[sid].append((e, ps))


def zr(ms):
    zs = [m['positions'][i] for m in ms for i in range(2, len(m['positions']), 3)]
    return (min(zs), max(zs)) if zs else (None, None)


def xy(ms):
    return [(m['positions'][i], m['positions'][i + 1]) for m in ms for i in range(0, len(m['positions']), 3)]


def mat_names(e):
    out = set()
    for rel in getattr(e, 'HasAssociations', []) or []:
        if rel.is_a('IfcRelAssociatesMaterial'):
            m = rel.RelatingMaterial
            if m.is_a('IfcMaterial'): out.add(m.Name)
            elif m.is_a('IfcMaterialLayerSetUsage'): out |= {l.Material.Name for l in m.ForLayerSet.MaterialLayers}
            elif m.is_a('IfcMaterialLayerSet'): out |= {l.Material.Name for l in m.MaterialLayers}
            elif m.is_a('IfcMaterialConstituentSet'): out |= {c.Material.Name for c in m.MaterialConstituents}
    return out


checks = collections.defaultdict(lambda: [0, 0]); fails = []


def check(name, ok, el, detail=''):
    checks[name][0 if ok else 1] += 1
    if not ok and len(fails) < 300:
        fails.append({'check': name, 'element': el, 'detail': detail})


for w in A['walls']:
    wid = w['id']; t = w['type']['value']; ms = by_id.get(wid, []); ie = ifc_by.get(wid, [])
    check('wall exists in 3D', bool(ms), wid)
    check('wall exists in IFC', bool(ie), wid)
    if not ms:
        continue
    classes = {e.is_a() for e, ps in ie if ps.get('Pset_SemanticCAD', {}).get('role') not in ('assembly',)}
    check('IFC class matches wall type', IFC_CLASS[t] in classes, wid, f'{t}: {classes}')
    if len(w['bands']['value']) > 1:
        check('banded wall is an IfcElementAssembly', any(e.is_a('IfcElementAssembly') for e, _ in ie), wid)
    handles = ','.join(h for h in w['cad']['face_handles'] if h)
    check('CAD handles carried into IFC', any(ps.get('Pset_CADSource', {}).get('cad_handle') == handles for e, ps in ie), wid)
    if t == 'curtain_wall':
        z0, z1 = zr(ms)
        half = 0.025 + TOL_Z      # FreeCAD centres the 50 mm head and sill mullions on the slab-to-slab lines
        check('curtain wall z range (3D = spec, mullions centred on the edges)', abs(z0) <= half and abs(z1 - w['height_m']['value']) <= half, wid, f'{z0:.3f}-{z1:.3f}')
        continue
    bands = w['bands']['value']
    for i, b in enumerate(bands):
        bm = [m for m in ms if m['role'] == (f'band{i}' if len(bands) > 1 else 'wall')]
        if not bm:
            check('band z range (3D = spec)', False, wid, f'band {i} missing'); continue
        z0, z1 = zr(bm)
        check('band z range (3D = spec)', abs(z0 - b['z0_m']) <= TOL_Z and abs(z1 - b['z1_m']) <= TOL_Z, wid, f"band {i} {b['material']}: spec {b['z0_m']}-{b['z1_m']}, 3D {z0:.4f}-{z1:.4f}")
        if len(bands) > 1:
            be = [e for e, ps in ie if ps.get('Pset_SemanticCAD', {}).get('role') == f'band{i}']
            check('band material in IFC', bool(be) and LABEL[b['material']] in mat_names(be[0]), wid, f"band {i}: want {LABEL[b['material']]}, got {mat_names(be[0]) if be else None}")
    if len(bands) == 1:
        we = [e for e, ps in ie if ps.get('Pset_SemanticCAD', {}).get('role') == 'wall']
        want = {LABEL[l['material']] for l in w['layers']['value']} if w.get('layers') else {LABEL[bands[0]['material']]}
        got = mat_names(we[0]) if we else set()
        check('material / layer set in IFC', want <= got, wid, f'want {want}, got {got}')
        if w.get('layers') and we:
            usage = [rel.RelatingMaterial for rel in we[0].HasAssociations if rel.is_a('IfcRelAssociatesMaterial')]
            ok = bool(usage) and usage[0].is_a('IfcMaterialLayerSetUsage')
            if ok:
                tot = sum(l.LayerThickness for l in usage[0].ForLayerSet.MaterialLayers)
                ok = abs(tot - w['thickness_m']['value']) <= TOL_T
            check('IfcMaterialLayerSet sums to drawn thickness', ok, wid)
    ax = w['axis']['value']
    if len(ax) == 2 and not w.get('curved'):
        (x0, y0), (x1, y1) = ax; L = math.hypot(x1 - x0, y1 - y0)
        if L > 0.05:
            ux, uy = (x1 - x0) / L, (y1 - y0) / L; nx, ny = -uy, ux
            pts = xy([m for m in ms if m['role'] in ('wall', 'band0', 'band1', 'band2', 'band3')])
            offs = [(px - x0) * nx + (py - y0) * ny for px, py in pts]
            if offs:
                th3 = max(offs) - min(offs); mid = (max(offs) + min(offs)) / 2
                check('thickness in 3D = drawn line spacing', abs(th3 - w['thickness_m']['value']) <= TOL_T, wid, f"drawn {w['thickness_m']['value']:.4f}, 3D {th3:.4f}")
                check('3D centre line on CAD centre line', abs(mid) <= TOL_AX, wid, f'offset {mid:.4f} m')
                ts = [(px - x0) * ux + (py - y0) * uy for px, py in pts]
                check('3D length = drawn length', abs((max(ts) - min(ts)) - L) <= 0.005, wid, f'drawn {L:.3f}, 3D {max(ts) - min(ts):.3f}')

fills = {rel.RelatedBuildingElement.id(): rel.RelatingOpeningElement for rel in f.by_type('IfcRelFillsElement')}
for o in A['openings']:
    oid = o['id']; ie = ifc_by.get(oid, []); ms = by_id.get(oid, [])
    doors = [e for e, ps in ie if e.is_a('IfcDoor')]
    check('door exists in IFC (IfcDoor)', bool(doors), oid)
    if o['host']['value'] and doors:
        op = fills.get(doors[0].id())
        host_ok = False
        if op is not None:
            for rel in op.VoidsElements:
                hps = ue.get_psets(rel.RelatingBuildingElement).get('Pset_SemanticCAD', {})
                host_ok = host_ok or hps.get('spec_id') == o['host']['value']
        check('hosted door fills an opening cut in its host wall', host_ok, oid)
    hdr = o['header']['value']
    hm = [m for m in ms if m['role'] == 'header']
    if hdr['kind'] == 'none_open_above' or hdr['z1_m'] <= hdr['z0_m'] + 0.001:
        check('header as specified (none above cubicle door)', not hm, oid)
    else:
        z0, z1 = zr(hm) if hm else (None, None)
        top = hdr['z1_m'] - (0.045 if hdr['kind'] == 'glass_transom' else 0)     # transom glass sits under a 45 mm frame head
        ok = bool(hm) and abs(z0 - hdr['z0_m']) <= TOL_Z and abs(z1 - top) <= TOL_Z + 0.006
        check('header piece above door (3D = spec)', ok, oid, f"{hdr['kind']} spec {hdr['z0_m']}-{hdr['z1_m']}, 3D {z0}-{z1}")
        he = [e for e, ps in ie if ps.get('Pset_SemanticCAD', {}).get('role') == 'header']
        want = 'IfcPlate' if hdr['kind'] == 'glass_transom' else 'IfcWall'
        check('header has its own IFC element', bool(he) and he[0].is_a(want) and (he[0].ObjectType or '').startswith('DOOR_HEADER'), oid)
    dm = [m for m in ms if m['role'] == 'door']
    if dm:
        z0, z1 = zr(dm)
        check('door leaf/frame top at the specified head or header', abs(z1 - o['head_m']['value']) <= TOL_Z or abs(z1 - hdr['z1_m']) <= TOL_Z, oid, f'3D top {z1:.3f}')

# ---------------------------------------------------------------- exported records vs exported meshes (what a consumer reads)
SEM = load_json(os.path.join(OUT, 'rtp6_floor6.semantic.json'))
MK = {'gypsum_pop': 'pop', 'masonry_block': 'brick', 'glass_clear_12': 'glass', 'rcc': 'rcc', 'hpl_panel': 'hpl', 'door_solid': 'door_leaf'}
for o in SEM['openings']:
    oid = o['id']; ms = by_id.get(oid, [])
    hm = [m for m in ms if m['role'] == 'header']
    hk = o['header']['kind']
    if hk == 'none_open_above':
        check('semantic.json header matches the header mesh (none above, no mesh)', not hm, oid, f'{len(hm)} header meshes')
    else:
        want = MK.get(o['header'].get('material'), o['header'].get('material'))
        got = sorted({m['material'] for m in hm}, key=str)
        check('semantic.json header matches the header mesh (present, same material)', bool(hm) and got == [want], oid, f'{hk}: want material {want}, meshes {got}')
    dm = [m for m in ms if m['role'] == 'door']
    parts = ' '.join(str(m.get('part')) for m in dm)
    check('door exported with a named Frame mesh and a named Leaf mesh', 'Frame' in parts and 'Leaf' in parts, oid, parts)
for m in mesh['meshes']:
    if m['role'] not in ('void', 'assembly'):
        check('every exported mesh has a material', m.get('material') is not None, m['id'], f"role {m['role']}")

# ---------------------------------------------------------------- door cuts, measured as lost wall volume in 3D
def mesh_volume(ms):
    v = 0.0
    for m in ms:
        P_, I_ = m['positions'], m['indices']
        for k in range(0, len(I_), 3):
            a, b, c = (P_[3 * I_[k]:3 * I_[k] + 3], P_[3 * I_[k + 1]:3 * I_[k + 1] + 3], P_[3 * I_[k + 2]:3 * I_[k + 2] + 3])
            v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6.0
    return abs(v)


W_by = {w['id']: w for w in A['walls']}
hosted = collections.defaultdict(list)
for o in A['openings']:
    if o['host']['value']:
        hosted[o['host']['value']].append(o)
cut_rows = []
for wid, ops in hosted.items():
    w = W_by[wid]
    if len(w['axis']['value']) != 2 or w['type']['value'] == 'curtain_wall':
        continue
    ms = [m for m in by_id.get(wid, []) if m['role'] in ('wall', 'band0', 'band1', 'band2', 'band3', 'band4')]
    t = w['thickness_m']['value']; L = w['length_m']['value']
    full = sum(t * L * (b['z1_m'] - b['z0_m']) for b in w['bands']['value'])
    deficit = 0.0
    for o in ops:
        if o['cad'].get('host_relation') != 'through':
            continue
        hdr = o['header']['value']
        top = max(o['head_m']['value'], hdr['z1_m']) if hdr['kind'] in ('pop_bulkhead', 'glass_transom', 'full_height', 'lintel_masonry') else o['head_m']['value']
        top = min(top, w['height_m']['value'])
        (x0, y0), (x1, y1) = o['line']['value']
        ax = w['axis']['value']; Lw = math.hypot(ax[1][0] - ax[0][0], ax[1][1] - ax[0][1]); wu = ((ax[1][0] - ax[0][0]) / Lw, (ax[1][1] - ax[0][1]) / Lw)
        ts = sorted([(q[0] - ax[0][0]) * wu[0] + (q[1] - ax[0][1]) * wu[1] for q in ((x0, y0), (x1, y1))])
        inside = max(0.0, min(Lw, ts[1]) - max(0.0, ts[0]))
        deficit += inside * (top - o['sill_m']['value']) * t
    actual = mesh_volume(ms)
    want = full - deficit
    ok = abs(actual - want) <= 0.01 * full + 0.0005      # max seen 0.53 %: a frame-sized sliver at most
    rel = sorted({o['cad'].get('host_relation') for o in ops})
    for o in ops:
        name = 'through-wall door cuts its host (lost volume = opening)' if o['cad'].get('host_relation') == 'through' else 'gap door leaves its flanking host whole (no volume lost)'
        check(name, ok, o['id'], f"host {wid}: full {full:.4f} m3, expected {want:.4f}, 3D {actual:.4f}")
    cut_rows.append({'wall': wid, 'doors': [o['id'] for o in ops], 'relations': rel, 'full_m3': round(full, 4), 'expected_m3': round(want, 4), '3d_m3': round(actual, 4), 'ok': ok})

for c in A['columns']:
    ie = ifc_by.get(c['id'], []); ms = by_id.get(c['id'], [])
    check('column exists in IFC (IfcColumn)', any(e.is_a('IfcColumn') for e, _ in ie), c['id'])
    if ms:
        z0, z1 = zr(ms)
        check('column height (3D = spec)', abs(z1 - c['height_m']['value']) <= TOL_Z, c['id'])

counts = collections.Counter(e.is_a() for e in f.by_type('IfcProduct'))
res = {'checks': {k: {'pass': v[0], 'fail': v[1]} for k, v in checks.items()}, 'total_pass': sum(v[0] for v in checks.values()),
       'total_fail': sum(v[1] for v in checks.values()), 'failures': fails, 'ifc_counts': dict(counts),
       'ifc_layer_sets': len(f.by_type('IfcMaterialLayerSet')), 'ifc_element_assemblies': len(f.by_type('IfcElementAssembly')),
       'ifc_rel_fills': len(f.by_type('IfcRelFillsElement')), 'tolerances_m': {'z': TOL_Z, 'thickness': TOL_T, 'axis': TOL_AX},
       'door_cuts': cut_rows,
       'not_verified': ['exact clear-opening, frame and leaf dimensions: the checks prove the model equals the specification, not that the '
                        'specification equals the built door; widths marked default (Q-D7) are not drawing facts',
                        'heights, bands, build-ups and headers are verified as built to the default set, not against the designer']}
save_json(res, os.path.join(OUT, 'verify.json'))
for k, v in checks.items():
    print(f'{v[0]:5d} pass {v[1]:4d} fail  {k}')
print('TOTAL', res['total_pass'], 'pass', res['total_fail'], 'fail')
for x in fails[:12]:
    print('  FAIL', x)
sys.exit(1 if res['total_fail'] else 0)
