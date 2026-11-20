"""Step 4b. The two non-3D outputs, generated from the same assembly file the FreeCAD model is built from:

  rtp6_floor6.semantic.dxf   : 2D plan for the designer, in the drawing's own millimetre coordinates (it overlays the
                               original DWG exactly), one clean layer per wall type, door headers on their own layer,
                               and a tag block with attributes on every wall and door (type, thickness, height, bands,
                               source, confidence, original entity handles). Every element also carries XDATA.
  rtp6_floor6.semantic.json  : the same elements in the web twin's frame (rtp_local metres, z from this floor's level).

    python -I semantic_out.py <assemblies.json> <out_dir>
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ezdxf
from ezdxf.enums import TextEntityAlignment
from shapely.geometry import LineString, Polygon
from lib import load_json, save_json, cfg, rules, to_rtp_local

A = load_json(sys.argv[1]); OUT = sys.argv[2]; C = cfg(); R = rules()
OX, OY = C['origin_drawing_units']
K = 1000.0                                            # plan metres -> drawing mm
mm = lambda p: (p[0] * K + OX, p[1] * K + OY)
LAYER = {'glass_partition': ('A-WALL-GLASS', 4), 'full_height_glass': ('A-WALL-GLASS-FULL', 140), 'pop_gypsum': ('A-WALL-POP', 2),
         'mixed': ('A-WALL-MIXED', 30), 'brick_block': ('A-WALL-BLOCK', 1), 'rcc': ('A-WALL-RCC', 8), 'curtain_wall': ('A-GLAZ-CURT', 5),
         'window_glazing': ('A-GLAZ-WIND', 151), 'acp': ('A-WALL-ACP', 6), 'panel_partial_height': ('A-WALL-PRHT', 200),
         'railing': ('A-RAIL', 250), 'unknown': ('A-WALL-UNKN', 210)}
APP = 'AUTOPILOT_SEMCAD'

doc = ezdxf.new('R2018', setup=True)
doc.header['$INSUNITS'] = 4
doc.appids.add(APP)
for name, col in list(LAYER.values()) + [('A-COLS', 8), ('A-DOOR', 3), ('A-DOOR-HEADER', 30), ('A-DOOR-FRAME', 9), ('A-ANNO-WTAG', 7),
                                         ('A-ANNO-DTAG', 7), ('A-SLAB-EDGE', 9), ('A-ANNO-NOTE', 7)]:
    doc.layers.add(name, color=col)
doc.layers.get('A-DOOR-HEADER').dxf.linetype = 'DASHED'
msp = doc.modelspace()

wt = doc.blocks.new('WALLTAG')
wt.add_circle((0, 0), 60, dxfattribs={'layer': '0'})
for i, tag in enumerate(['ID', 'TYPE', 'THK_MM', 'HEIGHT_M', 'BANDS', 'LAYERS', 'SOURCE', 'CONF', 'RULE', 'CAD_HANDLES', 'CAD_LAYER', 'QUESTIONS']):
    wt.add_attdef(tag, (80, -i * 90), dxfattribs={'height': 70, 'layer': '0', 'invisible': i > 1})
dt = doc.blocks.new('DOORTAG')
dt.add_lwpolyline([(-70, -70), (70, -70), (70, 70), (-70, 70)], close=True, dxfattribs={'layer': '0'})
for i, tag in enumerate(['ID', 'KIND', 'WIDTH_MM', 'OPENING_MM', 'FRAME_OUT_MM', 'CLEAR_MM', 'LEAF_MM', 'NOMINAL', 'HEAD_MM', 'HEADER', 'HEADER_Z_MM', 'FRAME', 'LEAF', 'HOST', 'SOURCE', 'CAD_HANDLE', 'BLOCK', 'QUESTIONS']):
    dt.add_attdef(tag, (90, -i * 90), dxfattribs={'height': 70, 'layer': '0', 'invisible': i > 1})


def xdata(e, items):
    e.set_xdata(APP, [(1000, f'{k}={v}'[:250]) for k, v in items])


def footprint(axis, t):
    g = LineString(axis).buffer(max(t, 0.01) / 2, cap_style=2, join_style=2)
    return list(g.exterior.coords)


semantic = {'about': 'Semantic layout of ' + C['project'] + ' in the web twin frame. Generated from assemblies.json by scripts/semantic_out.py. '
                     'x, y = rtp_local metres (x east, y north from the Maps pin); z = metres above this floor\'s finished floor; '
                     'add levels.ffl_above_ground_m for height above ground. Every element keeps source and confidence.',
            'frame': 'rtp_local', 'cad_m_to_rtp_local': C['cad_m_to_rtp_local'], 'drawing': A['drawing'],
            'levels': {k: {'value': v['value'], 'source': v['source']} for k, v in A['levels'].items()},
            'walls': [], 'openings': [], 'columns': []}
org_m = [OX / 1000, OY / 1000]
M = C['cad_m_to_rtp_local']
rl = lambda p: to_rtp_local(M, p[0], p[1], org_m)

for w in A['walls']:
    t = w['type']['value']; L, _ = LAYER[t]
    fp = footprint(w['axis']['value'], w['thickness_m']['value'])
    pl = msp.add_lwpolyline([mm(p) for p in fp[:-1]], close=True, dxfattribs={'layer': L})
    bands = ' / '.join(f"{b['material']} {b['z0_m']:.2f}-{b['z1_m']:.2f}" for b in w['bands']['value'])
    lay = ' / '.join(f"{l['material']} {l['thickness_m'] * 1000:.1f}" for l in w['layers']['value']) if w.get('layers') else ''
    items = [('id', w['id']), ('type', t), ('type_source', w['type']['source']), ('type_conf', w['type']['confidence']), ('rule', w['type'].get('rule')),
             ('thickness_mm', round(w['thickness_m']['value'] * 1000, 1)), ('height_m', w['height_m']['value']), ('height_source', w['height_m']['source']),
             ('thickness_source', w['thickness_m']['source']), ('axis_source', w['axis']['source']),
             ('bands', bands), ('bands_source', w['bands']['source']), ('layers', lay), ('layers_source', w['layers']['source'] if w.get('layers') else ''), ('cad_handles', ','.join(h for h in w['cad']['face_handles'] if h)),
             ('cad_layer', ','.join(w['cad']['layers'])), ('questions', ' '.join(w['questions']))]
    xdata(pl, items)
    ax = w['axis']['value']; mid = LineString(ax).interpolate(0.5, normalized=True)
    ref = msp.add_blockref('WALLTAG', mm((mid.x, mid.y)), dxfattribs={'layer': 'A-ANNO-WTAG', 'xscale': 1, 'yscale': 1})
    ref.add_auto_attribs({'ID': w['id'], 'TYPE': t, 'THK_MM': str(round(w['thickness_m']['value'] * 1000)), 'HEIGHT_M': f"{w['height_m']['value']:.2f}",
                          'BANDS': bands, 'LAYERS': lay, 'SOURCE': f"type {w['type']['source']} / thickness {w['thickness_m']['source']} / height {w['height_m']['source']} / bands {w['bands']['source']}" + (f" / layers {w['layers']['source']}" if w.get('layers') else ''),
                          'CONF': str(w['type']['confidence']), 'RULE': w['type'].get('rule', ''), 'CAD_HANDLES': ','.join(h for h in w['cad']['face_handles'] if h),
                          'CAD_LAYER': ','.join(w['cad']['layers']), 'QUESTIONS': ' '.join(w['questions'])})
    semantic['walls'].append({'id': w['id'], 'type': t, 'type_source': w['type']['source'], 'type_confidence': w['type']['confidence'],
                              'axis': [rl(p) for p in ax], 'footprint': [rl(p) for p in fp[:-1]], 'thickness_m': w['thickness_m']['value'],
                              'height_m': w['height_m']['value'], 'bands': w['bands']['value'], 'layers': w['layers']['value'] if w.get('layers') else None,
                              'source': {'type': w['type']['source'], 'axis': w['axis']['source'], 'thickness': w['thickness_m']['source'], 'height': w['height_m']['source'],
                                         'bands': w['bands']['source'], 'layers': w['layers']['source'] if w.get('layers') else None},
                              'confidence': {'type': w['type']['confidence'], 'height': w['height_m']['confidence'], 'bands': w['bands']['confidence']},
                              'cad_handles': w['cad']['face_handles'], 'cad_layers': w['cad']['layers'], 'questions': w['questions']})

for o in A['openings']:
    (x0, y0), (x1, y1) = o['line']['value']
    hdr = o['header']['value']; fr = o['frame']['value']
    L = math.hypot(x1 - x0, y1 - y0) or 1; ux, uy = (x1 - x0) / L, (y1 - y0) / L; nx, ny = -uy, ux
    host = next((w for w in A['walls'] if w['id'] == o['host']['value']), None)
    t = host['thickness_m']['value'] if host else 0.1
    msp.add_line(mm((x0, y0)), mm((x1, y1)), dxfattribs={'layer': 'A-DOOR'})
    # door leaf shown closed in the opening, as a thin rectangle
    lt = (o['leaf']['value']['thickness_mm'] or 20) / 1000
    leaf = [(x0 + nx * lt / 2, y0 + ny * lt / 2), (x1 + nx * lt / 2, y1 + ny * lt / 2), (x1 - nx * lt / 2, y1 - ny * lt / 2), (x0 - nx * lt / 2, y0 - ny * lt / 2)]
    msp.add_lwpolyline([mm(p) for p in leaf], close=True, dxfattribs={'layer': 'A-DOOR'})
    if hdr['kind'] != 'none_open_above':
        hp = [(x0 + nx * t / 2, y0 + ny * t / 2), (x1 + nx * t / 2, y1 + ny * t / 2), (x1 - nx * t / 2, y1 - ny * t / 2), (x0 - nx * t / 2, y0 - ny * t / 2)]
        he = msp.add_lwpolyline([mm(p) for p in hp], close=True, dxfattribs={'layer': 'A-DOOR-HEADER'})
        xdata(he, [('opening', o['id']), ('header', hdr['kind']), ('z0_m', hdr['z0_m']), ('z1_m', hdr['z1_m']), ('source', o['header']['source']),
                   ('detail', hdr.get('detail', ''))])
    fw = (fr['profile_mm'][0] or 0) / 1000
    if fw:
        for (px, py), sgn in (((x0, y0), 1), ((x1, y1), -1)):
            jp = [(px, py), (px + ux * fw * sgn, py + uy * fw * sgn)]
            jp = [(jp[0][0] + nx * t / 2, jp[0][1] + ny * t / 2), (jp[1][0] + nx * t / 2, jp[1][1] + ny * t / 2),
                  (jp[1][0] - nx * t / 2, jp[1][1] - ny * t / 2), (jp[0][0] - nx * t / 2, jp[0][1] - ny * t / 2)]
            msp.add_lwpolyline([mm(p) for p in jp], close=True, dxfattribs={'layer': 'A-DOOR-FRAME'})
    ref = msp.add_blockref('DOORTAG', mm(((x0 + x1) / 2 + nx * 0.4, (y0 + y1) / 2 + ny * 0.4)), dxfattribs={'layer': 'A-ANNO-DTAG'})
    mmv = lambda a: ('?' if a is None or a.get('value') is None else str(round(a['value'] * 1000))) + ('' if a is None else f" ({a['source']})")
    ref.add_auto_attribs({'ID': o['id'], 'KIND': o['kind']['value'], 'WIDTH_MM': str(round(o['width_m']['value'] * 1000)),
                          'OPENING_MM': mmv(o['opening_width_m']), 'FRAME_OUT_MM': mmv(o['frame_outside_width_m']), 'CLEAR_MM': mmv(o['clear_width_m']),
                          'LEAF_MM': mmv(o['leaf_width_m']), 'NOMINAL': (f"{o['nominal_width_m']['value']['by_block_name_m'] * 1000:.0f} by block name" if o.get('nominal_width_m') else ''), 'HEAD_MM': str(round(o['head_m']['value'] * 1000)),
                          'HEADER': hdr['kind'], 'HEADER_Z_MM': f"{hdr['z0_m'] * 1000:.0f}-{hdr['z1_m'] * 1000:.0f}",
                          'FRAME': f"{fr['profile_mm'][0]} x {fr['profile_mm'][1]} mm, " + str(fr['material']).split(' ')[0], 'LEAF': f"{o['leaf']['value']['material']} {o['leaf']['value']['thickness_mm']} mm",
                          'HOST': o['host']['value'] or 'none found', 'SOURCE': f"kind {o['kind']['source']} / width {o['width_m']['source']} / host {o['host']['source']} / head {o['head_m']['source']} / header {o['header']['source']} / frame {o['frame']['source']} / leaf {o['leaf']['source']}",
                          'CAD_HANDLE': o['cad']['insert_handle'], 'BLOCK': o['cad']['block'], 'QUESTIONS': 'Q-D1 Q-D2 Q-D3 Q-D4 Q-D5'})
    semantic['openings'].append({'id': o['id'], 'kind': o['kind']['value'], 'host': o['host']['value'], 'line': [rl((x0, y0)), rl((x1, y1))],
                                 'width_m': o['width_m']['value'], 'head_m': o['head_m']['value'],
                                 'widths': {k: (o[k] and {'value': o[k]['value'], 'source': o[k]['source']}) for k in ('opening_width_m', 'frame_outside_width_m', 'clear_width_m', 'leaf_width_m', 'nominal_width_m')}, 'header': hdr, 'frame': fr, 'leaf': o['leaf']['value'],
                                 'source': {k: o[k]['source'] for k in ('kind', 'width_m', 'opening_width_m', 'frame_outside_width_m', 'clear_width_m', 'leaf_width_m', 'head_m', 'header', 'frame', 'leaf', 'host')},
                                 'cad_handle': o['cad']['insert_handle'], 'cad_block': o['cad']['block'], 'cad_layer': o['cad']['layer']})
for c in A['columns']:
    pl = msp.add_lwpolyline([mm(p) for p in c['poly']['value']], close=True, dxfattribs={'layer': 'A-COLS'})
    xdata(pl, [('id', c['id']), ('type', c['type']['value']), ('type_source', c['type']['source']), ('height_m', c['height_m']['value']), ('cad_handles', ','.join(c['poly']['handles']))])
    semantic['columns'].append({'id': c['id'], 'poly': [rl(p) for p in c['poly']['value']], 'height_m': c['height_m']['value'], 'type': c['type']['value'],
                                'source': {'outline': 'cad', 'type': c['type']['source'], 'height': c['height_m']['source']}, 'cad_handles': c['poly']['handles']})
msp.add_lwpolyline([mm(p) for p in A['slab']['poly']['value']], close=True, dxfattribs={'layer': 'A-SLAB-EDGE'})
semantic['slab'] = {'poly': [rl(p) for p in A['slab']['poly']['value']], 'source': 'default', 'note': A['slab']['poly']['why']}
note = msp.add_mtext('SEMANTIC PLAN generated from ' + A['drawing'] + ' by procedural-cad (scripts/semantic_out.py). Layers = wall type. '
                     'Tags carry type, thickness, height, bands, source (cad/default) and the original entity handles. '
                     'Dashed A-DOOR-HEADER = what sits above each door. Values marked default are listed in ASK_DESIGNER.md.',
                     dxfattribs={'layer': 'A-ANNO-NOTE', 'char_height': 250, 'width': 30000})
note.set_location(mm((C['offer_clip_m'][0] + 1, C['offer_clip_m'][3] + 2)))
LEG = ['LEGEND (layer = wall type)'] + [f"{v[0]}  {k.replace('_', ' ')}" for k, v in LAYER.items()] + [
    'A-COLS  RCC columns', 'A-DOOR  door opening and leaf (closed)', 'A-DOOR-HEADER (dashed)  what sits above each door: glass transom / POP bulkhead / lintel',
    'A-DOOR-FRAME  jambs', 'SOURCE codes on every tag: cad = read from the drawing (original handles given); default = assumed, see ASK_DESIGNER.md; designer / client = answered']
leg = msp.add_mtext('\\P'.join(LEG), dxfattribs={'layer': 'A-ANNO-NOTE', 'char_height': 200, 'width': 16000})
leg.set_location(mm((C['offer_clip_m'][2] - 16, C['offer_clip_m'][3] + 6)))
doc.saveas(os.path.join(OUT, 'rtp6_floor6.semantic.dxf'))
save_json(semantic, os.path.join(OUT, 'rtp6_floor6.semantic.json'))
print('dxf + json: walls', len(semantic['walls']), 'openings', len(semantic['openings']), 'columns', len(semantic['columns']))
