"""Step 3a. Assembly file -> build spec for the FreeCAD builder (fc_build.py). Pure translation: no value is
changed or added here; every element keeps its CAD handles, layer, rule, source and confidence as IFC properties.

    python -I to_spec.py <assemblies.json> <out_spec.json>
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import load_json, save_json, rules

A = load_json(sys.argv[1]); R = rules()
MAT = R['materials']
# IFC class per wall type (FreeCAD IfcType names) and the IfcWallTypeEnum where it is a wall
IFC = {'glass_partition': ('Wall', 'PARTITIONING'), 'full_height_glass': ('Wall', 'PARTITIONING'), 'pop_gypsum': ('Wall', 'PARTITIONING'),
       'mixed': ('Wall', 'PARTITIONING'), 'brick_block': ('Wall', 'SOLIDWALL'), 'rcc': ('Wall', 'SHEAR'), 'acp': ('Covering', 'CLADDING'),
       'curtain_wall': ('Curtain Wall', None), 'window_glazing': ('Window', 'WINDOW'), 'panel_partial_height': ('Wall', 'PARTITIONING'),
       'railing': ('Railing', 'GUARDRAIL'), 'unknown': ('Wall', 'NOTDEFINED')}
# the builder's material keys
MKEY = {'glass_clear_12': 'glass', 'gypsum_pop': 'pop', 'masonry_block': 'brick', 'rcc': 'rcc', 'acp': 'acp', 'aluminium': 'aluminium',
        'hpl_panel': 'hpl', 'steel_railing': 'steel', 'plaster': 'plaster', 'gypsum_board': 'gypsum_board', 'stud_cavity': 'stud_cavity', 'unknown': 'unknown', 'door_solid': 'door_leaf', 'hardwood_frame': 'timber', 'slab': 'slab', 'ceiling': 'ceiling'}


def s(v):
    return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)


def props_of(el, extra=None):
    p = {}
    for k, v in el.items():
        if isinstance(v, dict) and 'source' in v and 'value' in v:
            p[f'{k}.value'] = s(v['value'])[:240]
            p[f'{k}.source'] = v['source']
            p[f'{k}.confidence'] = v['confidence']
            if v.get('rule'): p[f'{k}.rule'] = v['rule']
            if v.get('q'): p[f'{k}.question'] = s(v['q'])
    if extra: p.update(extra)
    return p


materials = {}
for k, m in MAT.items():
    materials[MKEY.get(k, k)] = {'color': m['color'], 'transparency': m['transparency'], 'ifc_name': m['label']}

walls = []
for w in A['walls']:
    t = w['type']['value']
    cad = w['cad']
    ifc_type, predef = IFC[t]
    walls.append({
        'id': w['id'], 'type': t, 'ifc_type': ifc_type, 'predefined': predef,
        'centreline': w['axis']['value'], 'thickness_m': max(w['thickness_m']['value'], 0.01),
        'base_z_m': w['base_z_m']['value'], 'height_m': w['height_m']['value'],
        'bands': [{'material': MKEY[b['material']], 'z0_m': b['z0_m'], 'z1_m': b['z1_m']} for b in w['bands']['value']],
        'layers': [{'material': MKEY[l['material']], 'thickness_m': l['thickness_m'], 'name': l['label']} for l in w['layers']['value']] if w.get('layers') else None,
        'props': props_of(w, {'cad_handle': ','.join(h for h in cad['face_handles'] if h), 'cad_layer': ','.join(cad['layers']),
                              'source': w['type']['source'], 'confidence': w['type']['confidence'], 'rule': w['type'].get('rule', ''),
                              'spacing_mm': cad['spacing_mm'], 'hatch_lines': cad['hatch_lines_between_faces'],
                              'texts_near': '; '.join(x['text'] for x in cad['texts_near'])[:200]}),
    })

KIND = {'glass_door': 'glass_door', 'solid_door': 'door_single', 'cubicle_door': 'door_single', 'double_door': 'door_double'}
openings = []
for o in A['openings']:
    (x0, y0), (x1, y1) = o['line']['value']
    hdr = o['header']['value']; fr = o['frame']['value']; leaf = o['leaf']['value']
    openings.append({
        'id': o['id'], 'host_wall_id': o['host']['value'], 'kind': 'door_double' if o['leaves']['value'] == 2 else KIND[o['kind']['value']], 'semantic_kind': o['kind']['value'],
        'line': [[x0, y0], [x1, y1]], 'centre': [(x0 + x1) / 2, (y0 + y1) / 2], 'width_m': o['width_m']['value'],
        'sill_m': o['sill_m']['value'], 'head_m': o['head_m']['value'],
        'header': {'kind': hdr['kind'], 'z0_m': hdr['z0_m'], 'z1_m': hdr['z1_m'], 'material': MKEY.get(hdr.get('material', ''), None)},
        'frame': {'profile_mm': f"{fr['profile_mm'][0]}x{fr['profile_mm'][1]}" if fr['profile_mm'][0] else '20x20', 'material': 'aluminium' if 'alumin' in str(fr['material']) else 'timber'},
        'leaf_material': MKEY[leaf['material']], 'leaf_thickness_mm': leaf['thickness_mm'], 'leaf_z0_m': leaf.get('z0_m', 0.0),
        'arch': o['arch']['value'] if o.get('arch') else None,
        'props': props_of(o, {'cad_handle': o['cad']['insert_handle'], 'cad_layer': o['cad']['layer'], 'block_name': o['cad']['block'],
                              'source': o['kind']['source'], 'confidence': o['kind']['confidence'],
                              'host_found': bool(o['host']['value']), 'jamb_handles': ','.join(o['cad']['jamb_sections'])}),
    })

columns = [{'id': c['id'], 'poly': c['poly']['value'], 'height_m': c['height_m']['value'], 'material': 'rcc',
            'props': props_of(c, {'cad_handle': ','.join(c['poly']['handles']), 'cad_layer': c['poly'].get('layer', ''),
                                  'source': c['type']['source'], 'confidence': c['type']['confidence']})} for c in A['columns']]
lv = A['levels']
slab = {'id': 'SLAB', 'poly': A['slab']['poly']['value'], 'thickness_m': lv['slab_m']['value'], 'top_z_m': 0.0, 'material': 'slab',
        'props': {'source': 'default', 'confidence': A['slab']['poly']['confidence'], 'why': A['slab']['poly']['why'], 'question': 'Q-S1'}}
ceiling = {'id': 'FALSE_CEILING', 'poly': A['ceiling']['poly']['value'], 'z_m': lv['false_ceiling_m']['value'], 'thickness_m': 0.0125, 'material': 'ceiling',
           'props': {'source': lv['false_ceiling_m']['source'], 'confidence': lv['false_ceiling_m']['confidence'], 'question': 'Q-H1'}}
spec = {'name': 'rtp6_floor6', 'storey': {'name': 'Level 6 (Offices 603 & 604), z = 0 at this floor; FFL %.2f m above ground (default)' % lv['ffl_above_ground_m']['value'], 'elevation_m': 0.0},
        'materials': materials, 'walls': walls, 'openings': openings, 'columns': columns, 'slab': slab, 'ceiling': ceiling,
        'about': 'Generated from assemblies.json by to_spec.py. Plan metres from the drawing origin.'}
save_json(spec, sys.argv[2])
print('spec: walls', len(walls), 'openings', len(openings), 'columns', len(columns))
