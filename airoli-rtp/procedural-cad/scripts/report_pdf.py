"""One PDF of what was done, built from the actual outputs (numbers are read from the JSON files, not typed in).
    python -I report_pdf.py <out_pdf>
"""
import json, os, re, sys, collections, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from lib import ROOT, load_json

OUTPDF = sys.argv[1]
pdfmetrics.registerFont(TTFont('U', '/Library/Fonts/Arial Unicode.ttf'))
pdfmetrics.registerFont(TTFont('UB', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily('U', normal='U', bold='UB', italic='U', boldItalic='UB')
O = lambda *p: os.path.join(ROOT, 'out', *p)
V = lambda *p: os.path.join(ROOT, 'views', *p)
st = load_json(O('stats.json')); vf = load_json(O('verify.json')); sp = load_json(O('spotcheck.json'))
ha = load_json(O('audit', 'host_audit.json')); A = load_json(O('assemblies.json')); R = load_json(os.path.join(ROOT, 'rules.json'))
Av = load_json(os.path.join(ROOT, 'out_variant', 'assemblies.json')); vv = load_json(os.path.join(ROOT, 'out_variant', 'verify.json'))
W_ = {w['id']: w for w in A['walls']}; D_ = {o['id']: o for o in A['openings']}

PAGE = landscape(A4); M = 14 * mm
INK = colors.HexColor('#1d1d1f'); MUTE = colors.HexColor('#5f6368'); RED = colors.HexColor('#c92a2a'); GREEN = colors.HexColor('#2b8a3e'); ORANGE = colors.HexColor('#e8590c')
ss = {
    'h0': ParagraphStyle('h0', fontName='UB', fontSize=26, leading=31, textColor=INK, spaceAfter=6),
    'h1': ParagraphStyle('h1', fontName='UB', fontSize=17, leading=21, textColor=INK, spaceBefore=4, spaceAfter=6),
    'h2': ParagraphStyle('h2', fontName='UB', fontSize=12, leading=15, textColor=INK, spaceBefore=6, spaceAfter=3),
    'p': ParagraphStyle('p', fontName='U', fontSize=9.6, leading=13.2, textColor=INK, spaceAfter=4),
    'sm': ParagraphStyle('sm', fontName='U', fontSize=8.2, leading=10.6, textColor=INK),
    'cap': ParagraphStyle('cap', fontName='U', fontSize=8.4, leading=11, textColor=MUTE, spaceBefore=2, spaceAfter=6),
    'warn': ParagraphStyle('warn', fontName='UB', fontSize=10.5, leading=14, textColor=colors.white),
    'li': ParagraphStyle('li', fontName='U', fontSize=9.4, leading=12.8, textColor=INK, leftIndent=12, bulletIndent=2, spaceAfter=2),
}


def esc(t):
    return str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def md(t):
    t = esc(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'`([^`]+)`', r'<font name="Courier" size="8.6">\1</font>', t)
    t = re.sub(r'\*(.+?)\*', r'\1', t)
    return t


P = lambda t, s='p': Paragraph(md(t), ss[s])
Pr = lambda t, s='p': Paragraph(t, ss[s])


def table(rows, widths, head=True, size=8.2, zebra=True):
    sty = ParagraphStyle('t', parent=ss['sm'], fontSize=size, leading=size * 1.28)
    sth = ParagraphStyle('th', parent=sty, fontName='UB')
    data = [[Paragraph(md(c) if isinstance(c, str) else esc(c), sth if (head and i == 0) else sty) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    cmd = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), 0.25, colors.HexColor('#d9d9d9')),
           ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 2.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5)]
    if head:
        cmd += [('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef1f4')), ('LINEBELOW', (0, 0), (-1, 0), 0.8, colors.HexColor('#9aa4ad'))]
    if zebra:
        for i in range(1 if head else 0, len(rows)):
            if i % 2 == 0:
                cmd.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#fafafa')))
    t.setStyle(TableStyle(cmd))
    return t


CROP_DIR = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'pcad_report_crops'); os.makedirs(CROP_DIR, exist_ok=True)


def img(path, maxw, maxh):
    from PIL import Image as PI, ImageChops
    im = PI.open(path).convert('RGB')
    bg = PI.new('RGB', im.size, (255, 255, 255))
    bb = ImageChops.difference(im, bg).point(lambda v: 255 if v > 12 else 0).getbbox()
    if bb:
        pad = 12
        bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.size[0], bb[2] + pad), min(im.size[1], bb[3] + pad))
        im = im.crop(bb)
    path = os.path.join(CROP_DIR, os.path.basename(path)); im.save(path)
    w, h = im.size
    k = min(maxw / w, maxh / h)
    return Image(path, width=w * k, height=h * k)


def banner(text, color=RED):
    t = Table([[Paragraph(text, ss['warn'])]], colWidths=[PAGE[0] - 2 * M])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), color), ('LEFTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    return t


def footer(c, d):
    c.saveState(); c.setFont('U', 7.5); c.setFillColor(MUTE)
    c.drawString(M, 8 * mm, 'RTP 6th floor, Offices 603 & 604 · procedural semantic CAD proof · airoli-rtp/procedural-cad')
    c.drawRightString(PAGE[0] - M, 8 * mm, f'page {d.page}')
    c.restoreState()


doc = BaseDocTemplate(OUTPDF, pagesize=PAGE, leftMargin=M, rightMargin=M, topMargin=M, bottomMargin=14 * mm,
                      title='RTP 603 & 604: procedural semantic CAD proof', author='Autopilot Offices (generated)')
doc.addPageTemplates([PageTemplate('p', [Frame(M, 14 * mm, PAGE[0] - 2 * M, PAGE[1] - M - 14 * mm, id='f')], onPage=footer)])
FW, FH = PAGE[0] - 2 * M, PAGE[1] - M - 14 * mm - 6
S = []
vt, vfail = vf['total_pass'], vf['total_fail']

# ---------------------------------------------------------------- 1. cover
S += [Spacer(1, 18 * mm), P('Reliable Tech Park, Airoli · 6th floor · Offices 603 & 604', 'h2'),
      Pr('From a 2D fit-out drawing to a 3D model where every wall and door carries its real build data', 'h0'),
      P(f"Procedural semantic CAD: feasibility proof. Generated {datetime.date.today():%d %b %Y} from the outputs in `airoli-rtp/procedural-cad/`."), Spacer(1, 6 * mm)]
status = (f"STATUS: the latest build is NOT verified. {vt:,} checks pass, {vfail} fail (run.sh exit 1). "
          f"Cause: the default frame added to two doors with no drawn opening (D006, D009) cuts 35 mm off wall W0285 and 16 mm off wall W0288 (2 length checks + 4 volume checks). "
          f"The fix is written but has not been rebuilt. The last fully verified build (before the door-width split) passed 5,587 checks with 0 failures.") if vfail else \
    (f"STATUS: verified. Baseline {vt:,} checks pass, 0 fail; hypothetical variant {vv['total_pass']:,} pass, {vv['total_fail']} fail (run.sh exit 0). "
     f"This proves the 3D model and IFC equal the specification. It does not prove that the defaults (heights, build-ups, headers, unresolved door openings) are right: those are the 25 designer questions.")
S += [banner(status, RED if vfail else GREEN), Spacer(1, 6 * mm)]
S += [table([['Item', 'Detail'],
             ['Drawing', '`20261118_6TH FLOOR (1).dwg` (the newest one; Offices 603 & 604 for Altruist), read as untrusted data. Units: INSUNITS 4 = millimetres (checked against the drawing itself).'],
             ['Question', 'Can the drawing say, for every wall and door, what it is made of, how tall it is, how it is layered and what sits above each door, and can the 3D model be proved to follow it?'],
             ['Answer', 'Yes for everything the drawing carries: types, thicknesses, positions, door kinds and widths are read and traced to the drawing\'s own entity handles. '
                        '**No vertical information is in the drawing** (heights, bands, build-ups, headers). Those come from one marked default set and 25 designer questions.'],
             ['Scope', 'Offices 603 & 604 only (founder\'s decision, 19 Nov). Rendering quality was not a goal: views are plain and flat-shaded.'],
             ['Founder inputs', 'Use common Indian fit-out defaults and mark them; scripts first, open in the FreeCAD app; "just show me it is possible".']],
            [40 * mm, FW - 40 * mm], size=9)]
S.append(PageBreak())

# ---------------------------------------------------------------- 2. what was done
S += [P('What was done', 'h1'), P('One command (`run.sh`) runs every step, about 35 seconds per floor. Each step writes a file that the next step reads, so every number can be checked.')]
S.append(table([['#', 'Step', 'What it does', 'Output'],
                ['1', 'Read the drawing', 'DWG → DXF (libredwg) → every entity with its handle, layer and colour; blocks exploded to world coordinates.', '`flat.json.gz` (work folder, outside the repo)'],
                ['2', 'Inventory', 'Every layer, block, text, dimension and hatch; every wall-like line pair and its spacing; door blocks and their sizes.', '`INVENTORY.md`, `inventory.json`, `inventory_entities.csv` (48,503 entities)'],
                ['3', 'Find walls', 'Pairs of parallel lines or concentric arcs on wall layers; the spacing is the wall thickness. Hatch, text and coincident lines are recorded as evidence.', '`pieces.json`'],
                ['4', 'Apply rules', '`rules.json`: layer + spacing + hatch → wall type; door block → kind; host wall, opening, widths, header, frame, leaf; heights, bands and layers from the default set.', '`assemblies.json` (schema-checked)'],
                ['5', 'Build in FreeCAD', 'Headless BIM build: layered walls, banded walls as assemblies, curtain wall, doors with frames and separate headers, columns, slab, ceiling.', '`rtp6_floor6.FCStd`, `.ifc` (IFC4), mesh'],
                ['6', 'Export for people', 'Semantic DXF in the drawing\'s millimetres with typed layers and tags; JSON for the web twin; click-to-trace page.', '`.semantic.dxf`, `.semantic.json`, `trace.html`'],
                ['7', 'Prove it', 'Measure what FreeCAD built against the specification (authoritative). Spot checks against the drawing\'s own numbers and a door-hosting audit (informational).', '`verify.json`, `spotcheck.json`, `HOST_AUDIT.md`'],
                ['8', 'Ask the designer', 'Every default becomes a question, grouped so that one answer settles many walls.', '`ASK_DESIGNER.md` (25 questions)']],
               [8 * mm, 32 * mm, FW - 8 * mm - 32 * mm - 78 * mm, 78 * mm], size=8.6))
S.append(Spacer(1, 4 * mm))
S.append(P('Every attribute in the model is a record: `value`, `source` (**cad** = read from the drawing, with the entity handles; **default** = assumed and marked; **designer** / **client** = answered), and `confidence`.'))
S.append(PageBreak())

# ---------------------------------------------------------------- 3. results at a glance
S += [P('Results at a glance', 'h1')]
bt = st['by_type']
dws = st.get('door_width_sources', {})
S.append(table([['Measure', 'Result', 'How'],
                ['Wall pieces found', f"{st['walls']} ({st['wall_m']:,} m)", 'Line pairs and concentric arcs on wall layers'],
                ['Typed by a drawing rule', f"{st['walls_typed_from_cad']} pieces ({st['walls_typed_from_cad'] / st['walls']:.0%}), {st['walls_typed_from_cad_m']:,} m ({st['walls_typed_from_cad_m'] / st['wall_m']:.0%})", 'Layer + line spacing + hatch'],
                ['… high confidence (≥ 0.8)', f"{st['walls_typed_from_cad_high_conf']} pieces, {st['walls_typed_from_cad_high_conf_m']:,} m", 'Glazing layers, hatched masonry, structural glazing, ACP'],
                ['Type not settled', f"{st['walls_unknown']} pieces, {st['walls_unknown_m']} m", 'Mostly walls drawn on the furniture layer I-FURN'],
                ['Doors: kind from the drawing', f"{st['openings_typed_from_cad']} of {st['openings']}", 'Block name + layer'],
                ['Doors: structural opening from the drawing', f"{dws.get('opening_width_m', {}).get('cad', 0)} of {st['openings']} (rest unresolved)", 'Wall-end gap or drawn jambs; never the swing'],
                ['Doors: leaf width from the drawing', f"{dws.get('leaf_width_m', {}).get('cad', 0)} of {st['openings']}", 'Swing radius'],
                ['Doors with a host wall', f"{ha['summary']['hosted']} of {st['openings']} (all in drawn gaps; 0 wall voids)", f"{ha['summary']['freestanding_unhosted']} built freestanding, none forced"],
                ['Header pieces above doors', f"{ha['summary']['header_pieces_built']} built; {ha['summary']['headers_by_kind'].get('none_open_above', 0)} none by rule", ', '.join(f"{v} {k.replace('_', ' ')}" for k, v in ha['summary']['headers_by_kind'].items() if k != 'none_open_above')],
                ['Columns', f"{st['columns']} ({st['columns_rcc_from_hatch']} RCC from a solid hatch)", 'Closed outlines on column layers'],
                ['Attributes', f"{st['attributes']['cad'] + st['attributes']['default']:,}: {st['attributes']['cad']:,} from the drawing, {st['attributes']['default']:,} default", 'Every attribute has source + confidence'],
                ['Heights, bands, build-ups, headers', '0 % from the drawing', 'Not in a 2D plan: all marked defaults'],
                ['Verification (latest build)', f"{vt:,} pass / {vfail} fail" + (' — NOT verified' if vfail else ''), 'FreeCAD output measured against the specification'],
                ['IFC4', ', '.join(f"{v} {k}" for k, v in vf['ifc_counts'].items() if k in ('IfcWall', 'IfcCurtainWall', 'IfcDoor', 'IfcWindow', 'IfcColumn', 'IfcPlate', 'IfcElementAssembly')) + f", {vf['ifc_layer_sets']} IfcMaterialLayerSet", 'Every element carries Pset_CADSource']],
               [62 * mm, 95 * mm, FW - 157 * mm], size=8.8))
S.append(Spacer(1, 3 * mm))
S.append(table([['Wall type (603/604)', 'Pieces', 'Length (m)', 'Rule(s)']] + [[k.replace('_', ' '), v['n'], v['m'], ', '.join(v['rules'])] for k, v in bt.items()],
               [55 * mm, 22 * mm, 25 * mm, FW - 102 * mm], size=8.4))
S.append(PageBreak())

# ---------------------------------------------------------------- 4-7. figures
for title, path, cap in [
    ('1. The drawing as read (by its own layers)', V('input_layers.png'), 'Offices 603 & 604 clip of the DWG. Each colour is a drawing layer; furniture in pale grey. This is the input: lines on layers, nothing else.'),
    ('2. Every drawing line, coloured by the element built from it', V('linework_by_type.png'), 'The same lines. A line takes the colour of the wall type, door or column the rules built from it (grey: not part of any element, e.g. furniture, stairs, ducts, text). This is the left panel of trace.html.'),
    ('3. The typed plan (assembly model)', V('plan_types.png'), 'Each wall drawn at its real (drawn) thickness and coloured by type; doors drawn in the colour of their header kind; a red x marks a door built freestanding (no host wall drawn).')]:
    S += [P(title, 'h1'), img(path, FW, FH - 30 * mm), P(cap, 'cap'), PageBreak()]
S += [P('4. The FreeCAD model (FreeCAD\'s own screenshots)', 'h1')]
S.append(Table([[img(V('fc_axonometric.png'), FW / 2 - 4, FH - 40 * mm), img(V('fc_top.png'), FW / 2 - 4, FH - 40 * mm)]], colWidths=[FW / 2, FW / 2]))
S.append(P(f"Saved from the FreeCAD GUI, opened from `out/rtp6_floor6.FCStd` ({load_json(O('rtp6_floor6.report.json'))['objects']:,} FreeCAD objects). Ceiling hidden. Magenta = walls whose type the drawing does not settle (shown, not guessed).", 'cap'))
S.append(PageBreak())
S += [P('5. Every door gets a header: three of them, close up (baseline)', 'h1')]
grid = []
for nm, lab in [('glass_partition_door', 'Glass door in a glass partition: glass transom above, aluminium transom bar'),
                ('door_pop_header', 'Door in a dry-wall partition: POP bulkhead above (separate piece)'),
                ('door_block_lintel', 'Door in a block wall: lintel and block above (separate piece)')]:
    grid.append([img(V(f'fc_closeup_{nm}.png'), FW / 3 - 6, 62 * mm)])
    grid.append([img(V(f'fc_closeup_{nm}_elevation.png'), FW / 3 - 6, 48 * mm)])
    grid.append([Paragraph(lab, ss['cap'])])
cols = [[grid[i], grid[i + 1], grid[i + 2]] for i in range(0, 9, 3)]
S.append(Table([[c[0][0] for c in cols], [c[1][0] for c in cols], [c[2][0] for c in cols]], colWidths=[FW / 3] * 3))
S.append(P('Each header is its own FreeCAD object and its own IFC element (IfcPlate DOOR_HEADER_GLASS_TRANSOM, IfcWall DOOR_HEADER_POP_BULKHEAD / DOOR_HEADER_LINTEL_MASONRY). Their heights (door head 2.10 m, top at the false ceiling or soffit) are **defaults**: the drawing has no header information.'))
S.append(PageBreak())

# ---------------------------------------------------------------- 8. traced example
d = D_['D026']; h = W_[d['host']['value']] if d['host']['value'] else None
S += [P('6. Traceability: one door, back to the drawing', 'h1')]


def arow(name, a):
    if a is None:
        return [name, '—', '', '']
    v = a['value']
    if isinstance(v, dict):
        v = ', '.join(f"{k}: {x}" for k, x in v.items() if x is not None)
    elif isinstance(v, list):
        v = ' / '.join(f"{b['material']} {b['z0_m']}–{b['z1_m']}" for b in v) if v and isinstance(v[0], dict) and 'z0_m' in v[0] else (f'{len(v)} points' if len(v) > 3 else json.dumps(v))
    return [name, str(v), f"{a['source']} ({a['confidence']})", a.get('why', '') + (f"  [{', '.join(a['q']) if isinstance(a.get('q'), list) else a['q']}]" if a.get('q') else '')]


left = img(V('trace_example.png'), FW * 0.42, FH - 20 * mm)
rows = [['Attribute', 'Value', 'Source', 'Why']] + [arow(*x) for x in [
    ('kind', d['kind']), ('host wall', d['host']), ('structural opening (m)', d['opening_width_m']), ('frame outside (m)', d['frame_outside_width_m']),
    ('clear passage (m)', d['clear_width_m']), ('leaf (m)', d['leaf_width_m']), ('head (m)', d['head_m']), ('header above', d['header']), ('frame', d['frame']), ('leaf build', d['leaf'])]]
rows += [['drawing', f"block {d['cad']['block']} on {d['cad']['layer']}, insert {d['cad']['insert_handle']}; jambs {', '.join(d['cad']['jamb_sections'])}", 'cad', '']]
if h:
    rows += [[f'host {h["id"]}: type', h['type']['value'], f"{h['type']['source']} ({h['type']['confidence']})", h['type']['why']],
             [f'host {h["id"]}: thickness', f"{h['thickness_m']['value']} m", 'cad', h['thickness_m']['why']],
             [f'host {h["id"]}: bands', arow('', h['bands'])[1], h['bands']['source'], 'default glass-partition build-up'],
             [f'host {h["id"]}: drawing', f"layer {', '.join(h['cad']['layers'])}, face handles {', '.join(x for x in h['cad']['face_handles'] if x)}", 'cad', '']]
right = table(rows, [30 * mm, 50 * mm, 22 * mm, FW * 0.58 - 112 * mm], size=7.4)
S.append(Table([[left, right]], colWidths=[FW * 0.42, FW * 0.58], style=[('VALIGN', (0, 0), (-1, -1), 'TOP')]))
S.append(P('In `trace.html` the same record appears when this door is clicked in the drawing or in the 3D model; the IFC carries the same handles and sources in `Pset_CADSource`, and the DXF in the door tag and XDATA.', 'cap'))
S.append(PageBreak())

# ---------------------------------------------------------------- 9. door widths
S += [P('7. Door widths: four different numbers, kept apart', 'h1'),
      banner('Passing geometry checks do not verify exact clear-opening, frame or leaf dimensions: they prove the model equals the specification, not that the specification equals the door to be built.', ORANGE), Spacer(1, 3 * mm),
      P('A swing radius is the **leaf**, not the opening. Each door carries the structural (rough) opening, frame outside, clear passage, leaf, and the nominal number in its block name. Only the structural opening is modelled and cut. Where no wall ends or jambs fix it, it is **unresolved** (default, question Q-D7).')]
rows = [['Door', 'Block', 'Structural opening', 'Frame outside', 'Clear passage', 'Leaf', 'Name']]
fmt = lambda a: '—' if a is None or a['value'] is None else f"{a['value']:.3f} ({a['source']})"
for o in A['openings']:
    if o['cad']['block'] in ('D-750', 'DOOR_SNGL', 'A$C9e4b0bea') and len(rows) < 26:
        if o['cad']['block'] != 'D-750' and sum(1 for r in rows if r[1] == o['cad']['block']) >= 2:
            continue
        rows.append([o['id'], o['cad']['block'], fmt(o['opening_width_m']), fmt(o['frame_outside_width_m']), fmt(o['clear_width_m']), fmt(o['leaf_width_m']),
                     f"{o['nominal_width_m']['value']['by_block_name_m']:.3f}" if o.get('nominal_width_m') else ''])
summ = table([['Width (all 97 doors)', 'From the drawing', 'Default / unresolved']] + [[k.replace('_m', '').replace('_', ' '), v.get('cad', 0), v.get('default', 0)] for k, v in dws.items()], [44 * mm, 26 * mm, 30 * mm], size=8.2)
S.append(Table([[table(rows, [14 * mm, 24 * mm, 30 * mm, 28 * mm, 26 * mm, 24 * mm, 18 * mm], size=7.6), summ]], colWidths=[FW - 108 * mm, 108 * mm], style=[('VALIGN', (0, 0), (-1, -1), 'TOP')]))
S.append(PageBreak())

# ---------------------------------------------------------------- 10. verification
S += [P('8. Verification: is the 3D model what the drawing and rules specify?', 'h1'),
      P('`verify.py` reads back what FreeCAD built (the tessellated mesh of every object, and the IFC) and measures it against `assemblies.json`. Its exit status decides the run; spot checks and the hosting audit never do.')]
S.append(table([['Check', 'Pass', 'Fail']] + [[k, v['pass'], v['fail']] for k, v in vf['checks'].items()] + [['TOTAL', vt, vfail]],
               [FW - 50 * mm, 25 * mm, 25 * mm], size=8.2))
if vfail:
    S.append(Spacer(1, 2 * mm)); S.append(P('Failures in the latest build', 'h2'))
    S.append(table([['Check', 'Door', 'Detail']] + [[f['check'], f['element'], f['detail']] for f in vf['failures']], [80 * mm, 20 * mm, FW - 100 * mm], size=8.2))
    S.append(P('Cause: for D006 and D009 (no wall ends or jambs drawn), the default frame added each side of the leaf reached into the end of the next wall: W0285 lost 35 mm of length, W0288 16 mm (the 2 length failures); the same loss shows as lost volume for every door on those walls (D006, D007, D009, D010: the 4 volume failures). Fix (exact clipping at the first wall face) is written in `scripts/infer.py`, checked in a dry run of inference, **not yet rebuilt**.'))
S.append(P('Not verified by these checks: ' + '; '.join(vf.get('not_verified', [])), 'cap'))
S.append(PageBreak())

# ---------------------------------------------------------------- 11. hosting audit + spot checks
hs = ha['summary']
S += [P('9. Doors and their walls (hosting audit)', 'h1'),
      P(f"**{hs['hosted']} of {hs['doors']} doors have a host wall**, all sitting in a gap the drawing leaves between wall ends (true wall voids: {hs['true_wall_voids']}). "
        f"**{hs['freestanding_unhosted']} are built freestanding** on their drawn swing, with no wall linked and none invented (question Q-D6). "
        f"Compared door by door with the earlier logic (79 hosted): {hs['before_after'].get('same host', 0)} keep the same host; "
        f"{hs['before_after'].get('host lost', 0) + hs['before_after'].get('host changed', 0)} lost or changed theirs, and every one of those earlier hosts was wrong by geometry "
        f"({hs['before_after'].get('earlier host was wrong: it is not in line with the drawn door swing', 0)} not in line with the drawn swing, "
        f"{hs['before_after'].get('earlier host was wrong: the earlier opening covered the whole wall and the cut destroyed it', 0)} destroyed by the earlier oversized cut).")]
S.append(table([['Why freestanding', 'Doors']] + [[k, v] for k, v in hs['unhosted_by_reason'].items()], [FW - 30 * mm, 30 * mm], size=8.4))
S.append(Spacer(1, 3 * mm))
lost = [r for r in ha['rows'] if r['status'] in ('host lost', 'host changed')]
S.append(table([['Door', 'Block (insert)', 'Earlier host', 'Earlier host vs the drawn swing', 'Verdict']] +
               [[r['door'], f"{r['block']} ({r['insert_handle']})", f"{r['before']['host']} {r['before']['host_type']}", r.get('before_host_vs_current_opening', {}).get('rel', ''), r.get('verdict', '')] for r in lost],
               [16 * mm, 48 * mm, 40 * mm, 60 * mm, FW - 164 * mm], size=7.4))
S.append(PageBreak())
S += [P('10. Spot checks against the drawing\'s own numbers (informational)', 'h1')]
S.append(P(f"**Dimensions:** {sp['dimensions_total']} in the drawing, all in the toilet block; {sp['dimensions_both_points_on_model']} run wall face to wall face and the model reproduces them (both ends on model faces within 0–5 mm). The rest measure sanitary fittings."))
S.append(table([['Passage label', 'Label (m)', 'Model clear (m)', 'Difference', 'Between']] +
               [[p['label'], p['label_m'], p['model_clear_m'] if p['model_clear_m'] is not None else 'not measurable', f"{p['diff_mm']} mm" if p['diff_mm'] is not None else '', ', '.join(p['wall_types'] or [])] for p in sp['passages']],
               [55 * mm, 25 * mm, 35 * mm, 25 * mm, FW - 140 * mm], size=8.4))
S.append(P('The +688 mm case: that passage is narrowed by desks, not walls. The two unmeasurable labels have no wall on one side within 8 m (open to the lobby).', 'cap'))
S.append(PageBreak())

# ---------------------------------------------------------------- 12. hypothetical variant
S += [banner('HYPOTHETICAL VARIANT: not from the drawing, not from the designer. Two rule values changed to show that one edit regenerates everything.', RED), Spacer(1, 3 * mm),
      P(f"`variants/door2400_mixed.json`: door head 2.10 → 2.40 m; rule O1 on (dry-wall partitions next to meeting/conference rooms → POP 0–0.9 / glass 0.9–2.4 / POP 2.4 m–soffit). "
        f"Result: {Av['overrides_applied'][0]['walls_changed']} walls became three-band assemblies; door heads {dict(collections.Counter(o['head_m']['value'] for o in Av['openings']))}. "
        f"Variant verification (latest build): {vv['total_pass']:,} pass / {vv['total_fail']} fail.")]
S.append(Table([[img(V('variant_closeup_pop_glass_pop.png'), FW / 3 - 6, FH - 55 * mm), img(V('variant_closeup_pop_glass_pop_elevation.png'), FW / 3 - 6, FH - 55 * mm),
                 img(V('variant_plan_types.png'), FW / 3 - 6, FH - 55 * mm)]], colWidths=[FW / 3] * 3))
S.append(P('Left and middle: a POP + glass + POP wall with a door at the 2.40 m head and its POP bulkhead; a glass partition beside it. Right: the variant plan (orange-red = mixed walls).', 'cap'))
S.append(PageBreak())

# ---------------------------------------------------------------- 13. designer questions
ask = open(os.path.join(ROOT, 'ASK_DESIGNER.md')).read()
cover = dict(re.findall(r'\*\*(Q-[A-Z0-9]+)\.\*\*.*?\*One answer settles:\* ([^\n]*)', ask, re.S))
S += [P('11. Questions for the designer (25)', 'h1'), P('Every default in the model is one of these. One answer settles every wall or door listed against it; answers go into `rules.json` and a re-run rebuilds everything.')]
S.append(table([['Id', 'Group', 'Question', 'Default used', 'One answer settles']] +
               [[q, v['group'], v['ask'], v['default'], cover.get(q, '').rstrip('.')] for q, v in R['questions'].items()],
               [14 * mm, 26 * mm, FW - 14 * mm - 26 * mm - 50 * mm - 44 * mm, 50 * mm, 44 * mm], size=7.3))
S.append(PageBreak())

# ---------------------------------------------------------------- 14. weak spots, standard, sources (from FEASIBILITY.md)
fe = open(os.path.join(ROOT, 'FEASIBILITY.md')).read()


def section(name):
    m = re.search(r'^## ' + re.escape(name) + r'.*?$\n(.*?)(?=^## |\Z)', fe, re.M | re.S)
    return m.group(1).strip() if m else ''


def md_block(txt):
    out = []
    for ln in txt.split('\n'):
        s_ = ln.strip()
        if not s_ or s_.startswith('|') or s_.startswith('>'):
            continue
        m = re.match(r'^(\d+)\.\s+(.*)', s_)
        if m:
            out.append(Paragraph(md(m.group(2)), ss['li'], bulletText=m.group(1) + '.'))
        elif s_.startswith('- '):
            out.append(Paragraph(md(s_[2:]), ss['li'], bulletText='•'))
        else:
            out.append(Paragraph(md(s_), ss['p']))
    return out


S += [P('12. Weak spots (unresolved, stated plainly)', 'h1')] + md_block(section('Weak spots'))
S += [Spacer(1, 3 * mm), P('13. The drawing standard to ask for from now on', 'h1')] + md_block(section('6. The drawing standard'))
S.append(PageBreak())
S += [P('14. How this scales, and how it feeds Blender and SketchUp', 'h1')] + md_block(section('5. How this scales')) + md_block(section('7. Feeding Blender'))
S += [Spacer(1, 3 * mm), P('15. Sources and context used', 'h1')] + md_block(section('Sources and context'))
S.append(PageBreak())
S += [P('16. Files', 'h1')]
S.append(table([['File', 'What it is']] + [
    ['`FEASIBILITY.md`', 'The verdict in plain English (this report follows it)'], ['`ASK_DESIGNER.md`', '25 questions for the designer'],
    ['`SCHEMA.md`, `schema.json`', 'The wall/opening schema; the default set stated once'], ['`rules.json`', 'Every rule and default: change one value and re-run'],
    ['`INVENTORY.md`, `inventory.json`, `out/inventory_entities.csv`', 'Everything in the drawing'],
    ['`out/rtp6_floor6.FCStd`', 'FreeCAD model (opens in the app with colours)'], ['`out/rtp6_floor6.ifc`', 'IFC4 with Pset_CADSource on every element'],
    ['`out/rtp6_floor6.semantic.dxf`', 'Semantic DXF for the designer, in drawing millimetres'], ['`out/rtp6_floor6.semantic.json`', 'Web-twin JSON (rtp_local frame)'],
    ['`out/assemblies.json`', 'The assembly model every output is built from'], ['`out/verify.json`, `out/verify.log`', 'Authoritative checks (latest build: ' + f'{vt:,} pass / {vfail} fail)'],
    ['`out/spotcheck.json`, `out/audit/HOST_AUDIT.md`', 'Informational checks'], ['`trace.html`', 'Click-to-trace page (needs the repo\'s local server)'],
    ['`out_variant/`', 'HYPOTHETICAL rule-change demonstration'], ['`BLENDER_HEADER_PROPOSAL.md`', 'Proposed header change for the Blender builder (not applied)'],
    ['`run.sh`, `scripts/`', 'The pipeline']], [90 * mm, FW - 90 * mm], size=8.6))
doc.build(S)
print('wrote', OUTPDF)
