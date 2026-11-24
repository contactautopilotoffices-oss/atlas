# Can a 2D fit-out drawing become a fully specified 3D model? Verdict for RTP 6th floor, Offices 603 & 604

**Short answer: yes, with one condition.** Everything the drawing knows reaches the 3D model unchanged, and this is checked, not assumed. Every wall, door and column in the FreeCAD model, the IFC and the semantic DXF can be traced back to the exact lines of the designer's DWG, with a rule and a confidence attached.

The condition: **a 2D plan does not carry heights, vertical make-ups or what sits above doors.** On this floor those come entirely from one marked default set, which is listed for the designer in `ASK_DESIGNER.md`. Once the designer answers those questions, or draws to the standard at the end of this note, the gap closes. A rule change rebuilds the whole floor in about 35 seconds.

This is a feasibility proof on one floor. Rendering quality was not the goal.

## What was built (all in `airoli-rtp/procedural-cad/`)

| Output | File | What it is |
|---|---|---|
| Inventory | `INVENTORY.md`, `inventory.json`, `out/inventory_entities.csv` | Every layer, block, text, dimension and hatch, every wall-like line pair with its spacing, and every door block with its size. The CSV has 48,503 drawing entities. |
| Schema | `schema.json`, `SCHEMA.md` | Every attribute carries `value`, `source` (cad / designer / client / default) and `confidence`. |
| Rules | `rules.json` | Line pairs → wall type; door blocks → door kind; build-ups, heights, headers and defaults. One file. |
| Designer questions | `ASK_DESIGNER.md` | 25 questions, grouped so that one answer settles many walls. |
| Assembly model | `out/assemblies.json` | 512 wall pieces, 97 doors and 71 columns. Schema-valid. |
| FreeCAD model | `out/rtp6_floor6.FCStd` | Layered walls with materials, banded walls as assemblies, curtain wall, doors with frames and headers, columns, slab and false ceiling. It opens in the FreeCAD app with colours. |
| IFC4 | `out/rtp6_floor6.ifc` | 529 IfcWall, 43 IfcCurtainWall, 97 IfcDoor, 66 IfcWindow, 71 IfcColumn, 32 IfcPlate (glass transoms), 247 IfcMaterialLayerSet and 58 IfcElementAssembly. Every element carries `Pset_CADSource` (drawing handle, layer, rule, and the source and confidence of every attribute). 0 schema issues under ifcopenshell. |
| Semantic DXF | `out/rtp6_floor6.semantic.dxf` | For the designer, in the drawing's own millimetre coordinates, so it overlays the original. Layers `A-WALL-GLASS`, `A-WALL-POP`, `A-WALL-MIXED`, `A-WALL-BLOCK`, `A-GLAZ-CURT`, `A-DOOR`, `A-DOOR-HEADER` (dashed), `A-DOOR-FRAME`, and so on. A tag with attributes sits on every wall and door, plus XDATA and a legend. |
| Web JSON | `out/rtp6_floor6.semantic.json` | The same elements in the web twin's rtp_local frame. |
| Trace page | `trace.html` | The drawing's linework coloured by inferred type, beside the FreeCAD model. Click a line or an element to see its CAD source, assembly and confidence. |
| Views | `views/` | `plan_types.png` (plan coloured by type); FreeCAD's own screenshots (`fc_axonometric`, `fc_top`, and close-ups of a glass door with its glass transom, a door in dry wall with its POP bulkhead, and a door in block with its lintel); the variant's POP + glass + POP close-up. |
| Checks | `out/verify.json`, `out/spotcheck.json`, `out/audit/HOST_AUDIT.md` | Proof that the model matches the specification; spot checks against the drawing's own numbers; a door-by-door hosting audit. |

## 1. How much was typed automatically, and from what

| | Count | Share | Evidence |
|---|---:|---:|---|
| Wall pieces found (pairs of parallel lines or concentric arcs) | 512 (1,281 m) | | Line spacing = wall thickness |
| Typed by a drawing rule | 487 (1,197 m) | **95 % of pieces, 93 % of length** | Layer + spacing + hatch, e.g. `WS-GLAZ-GLAS` 75 mm → glass partition; `walls` 150 mm with masonry hatch → block |
| … of which high confidence (≥ 0.8) | 328 (731 m) | 64 % / 57 % | Glazing layers, hatched masonry, structural glazing, ACP |
| Not settled ("unknown", built in magenta) | 25 (84 m) | 5 % / 7 % | 21 are walls drawn on the furniture layer `I-FURN`; 4 are 30–99 mm lines on `walls` |
| Door kind from the drawing (glass / solid / cubicle) | 97 of 97 | 100 % | Block name + layer |
| Door **structural opening** from the drawing | 89 of 97 | 92 % | The gap between the wall ends either side, or the outer faces of the two jambs drawn in the block. The other 8 (all `Glass Door` blocks) are **unresolved** (default: leaf + one default frame each side; Q-D7) |
| Door **frame outside** and **clear passage** widths from the drawing | 84 of 97 | 87 % | Outer and inner faces of the drawn jambs. The other 13 are not drawn (Q-D7) |
| Door **leaf** width from the drawing | 97 of 97 | 100 % | Radius of the drawn swing |
| Door frame section from the drawing | 86 of 97 | 89 % | Jamb sections drawn inside the block |
| RCC columns from a solid hatch | 65 of 71 | 92 % | `column-hatch` SOLID |
| Heights, vertical bands, through-wall build-ups, headers | 0 | **0 %** | Not in the drawing. All are marked defaults. |

Of all 5,422 attributes in the model, 3,066 come from the drawing and 2,356 are marked defaults.

The types in 603/604 by length: POP / dry wall 357 m, structural glazing 258 m, block 227 m, glass partitions 151 m, ACP 60 m, window glazing 55 m, toilet cubicle panels 45 m, railing 28 m, RCC fins 17 m.

## 2. Is the 3D model exactly what the drawing and rules specify?

`scripts/verify.py` does not trust the builder. It reads back what FreeCAD built (the tessellated mesh of every object, and the IFC) and measures it against the assembly file.

> **Current status: passes all checks. Not every opening is known.**
>
> - **The latest build** (20 Nov 2026, 21:46) passes: baseline **7,044 checks, 0 fail**; variant **7,199, 0 fail**. It was built in `out_next/` and swapped into `out/` only after it passed; the previous build is kept in `out_prev/`.
> - **Door headers and parts were cross-checked** (20 Nov, 21:46). Every one of the 97 doors is exported with a named Frame mesh and a named Leaf mesh. Each of the 76 doors with a header in `semantic.json` has a header mesh of the same material, and the 21 cubicle doors (`none_open_above`) have none, by design. The previous build had all the header meshes but gave 21 of them no material (headers over layered walls, D006 and D009 among them) and 4 the host's "unknown" material. It also exported solid doors' frame and leaf as one mesh. `verify.py` now checks all three, so this cannot pass silently again.
> - **What passing means:** the model and IFC equal the specification.
> - **What it does not mean:** that the defaults are right. These are review items, not verified facts:
>   - 8 door openings are default/unresolved (D001, D003, D004, D011, D013, D014, D016, D017, all `Glass Door` blocks: each draws one stile and a line across the opening, but no second jamb);
>   - 13 doors have default frame and clear widths;
>   - 39 doors are freestanding;
>   - every height, build-up and header is a default.
> - **D006 and D009 are now settled from the drawing.** Each D-750 block draws both of its jambs (handles `136E37` and `136E38`), giving a 0.750 m structural opening and frame outside and a 0.650 m clear passage. They had been missed because those outlines are not flagged "closed". Walls W0285 and W0288 keep their full drawn length (checked).
> - **D012** is now a 1.80 m double door in W0197.
> - **D089** is now 0.631 m, from its own jambs.

The checks:

- **Position and size:** thickness in 3D equals the drawn line spacing (2 mm); the 3D centre line sits on the CAD centre line (5 mm); 3D length equals drawn length (5 mm).
- **Heights:** every band's height range equals the specification (2 mm). The curtain wall is allowed half a mullion (25 mm), because FreeCAD centres its frame on the slab lines.
- **IFC:** the class matches the type; each band and layer material is present; each IfcMaterialLayerSet sums to the drawn thickness; each banded wall is an IfcElementAssembly; the CAD handles are carried into IFC.
- **Doors:** every door exists as an IfcDoor; every header piece exists with its specified height range and its own IFC element; every door top sits at the head or the header.
- **Cuts:** every door's effect on its host wall is measured as lost wall volume. A through-wall door must remove exactly its opening. A gap door must remove nothing from the walls beside it, within 1 % (the largest seen is 0.5 %).

The run script returns non-zero when verification fails. This was tested by altering one band in a copy: the check failed, as it should. Spot checks and the hosting audit are reported separately and never decide pass or fail.

**How the zero was reached.** The earlier runs had 10 failures. They were not tolerances to loosen: each was a real fault in my own door logic.

- Cubicle doors took the whole 1.37 m cubicle front (the block's edge) as their opening, and the cut deleted five 20 mm panels.
- Two 150 mm stubs at the ends of cubicle rows were eaten the same way.
- One 0.17 m partition return lost 20 mm where a one-sided opening overlapped it.

The fixes:

- The opening now comes from the drawn swing, and the closed side is the swing end that lines up with a gap between walls.
- A one-sided opening is clipped at the wall end.
- A wall that runs through the opening is never treated as a flank.
- Arc centres inside mirrored blocks are now converted to world coordinates. They had been read in the block's own flipped coordinates.

### Spot checks against the drawing's own numbers (`out/spotcheck.json`)

- **Dimensions:** the drawing has 26 dimensions, all in the toilet block. Only 4 run wall face to wall face. For those 4, both ends land on faces of the model's walls within 0–5 mm, so the model reproduces the dimension. The other 22 measure sanitary fittings.
- **Passage labels:**
  - "5'6" PASSAGE WIDE" (1.676 m): 1.682 m between the model's glass partitions (+6 mm).
  - "6' PASSAGE WIDE" (1.829 m): 1.800 m between dry-wall partitions (−29 mm).
  - A second "6'" label measures 2.517 m between walls: that passage is narrowed by desks, not walls.
  - Two "5'6"" labels have no wall on one side within 8 m (open to the lobby), so they cannot be measured.
- **Door widths are four different numbers, and the model keeps them apart.** Each door carries five width attributes, each with its own source:
  - `opening_width_m`: the structural (rough) opening. This is the only width that is modelled and cut.
  - `frame_outside_width_m`: the outside of the frame.
  - `clear_width_m`: the clear passage between the frame faces.
  - `leaf_width_m`: the leaf, from the swing.
  - `nominal_width_m`: the number in the block name. This is evidence only; it is never used as a size.

  A swing radius is never used as an opening. The 12 `D-750` blocks show why:
  - every one has a **0.681 m leaf** (0.544 m in the scaled-down inserts);
  - where wall ends are drawn, the **structural opening is 0.850 m** (D005, D007, D008, D010);
  - the outer faces of the block's own drawn jambs give a **0.750 m frame outside** and a **0.650 m clear passage** (0.600 m / 0.520 m in the scaled-down inserts).

  The name "750" matches none of these.
- **What the checks do not prove.** The passing checks prove the 3D model equals the specification. They do not prove the specification equals the built door. In particular, **exact clear-opening, frame and leaf dimensions are not verified**: wherever those widths are `default`, they are open questions, not drawing facts.

## 3. Doors: what is solved and what is not (`out/audit/HOST_AUDIT.md`)

- **58 of 97 doors have a host wall.** All 58 sit in a gap the drawing leaves between wall ends. None has a wall drawn continuous across it, so **true wall voids = 0**. The IFC still links each of the 57 to its wall (IfcOpeningElement + IfcRelFillsElement). In 3D the volume check confirms that nothing is cut from the walls beside them.
- **39 doors are built freestanding, on their drawn swing line, with no host wall.** This is a real limitation, kept visible rather than hidden:
  - 20 toilet-cubicle doors: the cubicle side panels are drawn only as 20 × 79 mm stubs, too short to be read as walls;
  - 8 `DOOR_SNGL`, 6 `D-750`, 4 `Glass Door` and 1 small door: no wall piece ends at their swing;

  None of these was forced onto a wall, and no wall was invented. They are designer question Q-D6.
- **Compared door by door with the earlier run** (79 hosted): 58 keep the same host and 21 lost one. Of those 21:
  - 15 earlier hosts were neighbouring walls not in line with the drawn swing (cubicle back panels, row-end stubs, one window strip);
  - 6 lay entirely inside the earlier oversized opening, and that cut destroyed them;
  - D012 (double door) has its host again: it is now read from the 1.80 m frame line drawn across both leaves.

  None of the 22 is a valid host that the current run misses.
- **Headers:** 76 header pieces are built: 35 POP bulkheads, 32 glass transoms and 9 block lintels, each its own IFC element and each a separate object in FreeCAD. 21 doors have nothing above them by rule (toilet cubicles). Every header's type and height is a **default**: the drawing says nothing about headers.
- **Arches:** none. The drawing has no arch mark, text or block. The schema and the FreeCAD builder support arch and arch-plus-window, tested on a sample in the prototype, but none was built on this floor because none is drawn.

## 4. Baseline and demonstration variant are separate

- `out/` is the **baseline**: only drawing evidence plus the marked default set.
- `out_variant/` is a **hypothetical rule demonstration**, not drawing or designer evidence. It changes two values (`variants/door2400_mixed.json`): the door head goes from 2.10 m to 2.40 m, and rule O1 is switched on, turning the 31 dry-wall partitions next to meeting and conference rooms into POP 0–0.9 m / glass 0.9–2.4 m / POP 2.4 m to the soffit.

  One command rebuilt everything: 76 doors moved to 2.40 m, 21 doors stayed at 2.10 m because their cubicle panels stop there, and 31 walls became three-band assemblies. The run passes 7,199 checks with 0 failures.

  The trace page shows a red "hypothetical variant" banner when it opens `out_variant/`. The variant's images are prefixed `variant_`, and it carries its merged rules as `out_variant/rules.variant.json`.

## 5. How this scales to other floors and buildings

- **Same building, other floors:** change `config.json` (drawing name, origin, offer clip, frame matrix) and run. The rules key on the designer's layer names (`WS-WALL-PRTN`, `WS-GLAZ-GLAS`, `WS-DOOR-GLAZ` …), which follow a Discipline-Major-Minor naming. Any drawing from the same designer office should type the same way. The run takes about 35 seconds per floor, including FreeCAD and IFC.
- **Other designers:** the layer names will differ. Each designer needs one layer map in `rules.json` (an hour's work), and the line-pair, hatch, swing and gap logic carries over. Skymark's drawings (in `noida-skymark/cad/`) use different layers again.
- **The real cost is the questions, not the computing.** The 25 questions in ASK_DESIGNER.md are mostly per designer standard, not per floor. Answered once, they apply to every later drawing in that standard.

## 6. The drawing standard to ask for from now on

To make the questions unnecessary, ask designers to deliver:

1. **One layer per wall type**, with no walls on furniture layers: `A-WALL-GLASS`, `A-WALL-GLASS-FULL`, `A-WALL-POP`, `A-WALL-BLOCK`, `A-WALL-RCC`, `A-WALL-MIXED`, `A-WALL-PRHT` (partial height), `A-GLAZ-CURT`, `A-WALL-ACP`.
2. **A type tag on every wall** (e.g. `GP1`, `DW2`, `MX1`), with a legend per tag giving the build-up through the thickness and the vertical bands (e.g. MX1 = POP 0–900 / 12 mm glass 900–2400 / POP to soffit).
3. **Door blocks with attributes:** `HEAD` (mm), `HEADER` (transom / bulkhead / full height / lintel), `FRAME` (profile, material), `LEAF`, `FIRE`. Blocks unscaled, or their true width as an attribute (`D-750` inserted at 600 mm is ambiguous). One block per opening, no stacked duplicates. Draw the wall ends up to every door, including cubicle side panels.
4. **Arches on `A-OPEN-ARCH`**, with `SPRING` and `RADIUS` attributes.
5. **Heights stated once per floor**: finished floor, false ceiling per zone, soffit. A small section or a legend table is enough.
6. **Units in millimetres, with the header set to match.** This drawing's header says millimetres (INSUNITS 4), which is right. The brief said INSUNITS 4 was inches (× 0.0254); that is not what the drawing holds. A 750 mm door measures 750 units and the plate is 125,000 units across, so the factor used is 0.001.

With that standard, almost every `default` in this model would become `cad`. The pipeline already reads attributes and tags; the rules would simply have more to read.

## 7. Feeding Blender and SketchUp from the same schema

- **Blender (the twin's builder):** read `out/rtp6_floor6.semantic.json`. It is already in the twin's rtp_local frame, with bands, layers, headers and frames per element. `BLENDER_HEADER_PROPOSAL.md` sets out the exact change to `noida-skymark/twin/blender/geometry.py` that gives every door the right header. It was not applied: another worker is editing that folder. Blender can also open the IFC directly through the Bonsai (BlenderBIM) add-on, keeping the property sets.
- **SketchUp:** SketchUp Pro imports IFC and keeps the IFC classes as classifications. A short Ruby script could also read `semantic.json` and make one group per wall band, with the attributes as dynamic-component attributes. Neither was tested here.
- **CAD and BOQ:** the semantic DXF goes back to the designer. Quantities per type and band (metres of glass partition, square metres of POP, number of glass transoms) are a sum over `assemblies.json` or the IFC.

## Weak spots (unresolved, stated plainly)

1. **No vertical information comes from the drawing.** Every height, band, through-wall build-up and header is a marked default (founder's instruction of 19 Nov: common Indian fit-out defaults).
2. **The false ceiling is 2.90 m here**, inside the founder's 2.7–2.9 m range, but the web twin uses 3.05 m from an earlier client-team note. One number in `rules.json` reconciles them (Q-H1).
3. **39 freestanding doors and 0 true wall voids** (section 3).
4. **Exact door opening sizes are not all known.** The structural opening is unresolved for 8 doors (D001, D003, D004, D011, D013, D014, D016, D017: all `Glass Door` blocks), and the frame and clear widths for 13 (those 8 plus D002, D012, D018, D094, D097). The leaf is known for all 97, but the leaf is not the opening (Q-D7). Passing geometry checks do not verify clear-opening dimensions.
5. **25 walls whose type is not settled**, 21 of them drawn on the furniture layer `I-FURN` (Q-U2). 835 wall-layer lines have no partner and so no thickness: mostly the chords of single curves and furniture lines.
6. **Wall junctions are not joined.** Pieces meet as separate solids, so L and T corners are not mitred. The curved facade is faceted at about 0.6 m. The curtain wall uses default mullions and exports as one IfcCurtainWall solid, not separate members and panels.
7. **The slab outline is traced** around the drawn walls and columns (about ±0.5 m). It is not taken from a plate line.
8. **Handles inside blocks are not unique.** A line inside a block carries its block-definition handle, shared by every insert, so each wall also records the block's insert handle.
9. **FreeCAD prints "Unable to modify the base object of this wall" 8 times** during a build. All 512 walls are present and pass every geometry check; the cause was not investigated.
10. **IFC openings for gap doors are relational.** The 58 IfcOpeningElements tie each door to its wall but remove no material, because the drawing already leaves the gap.

## Sources and context used

- **The DWG:** `20261118_6TH FLOOR (1).dwg` (newest, Offices 603 & 604), read as untrusted data via libredwg and ezdxf. It was never copied into the repo; work files stay outside it.
- **The founder's NotebookLM "Cad x LLM":** its gist was relayed by the main session; it was not read here directly. It aligns with this build: one schema-valid JSON in the middle, a deterministic builder, doors snapped to host walls, validation with geometry checks. It has nothing on material wall types, bands, headers or arches, so that part of the schema is new work.
- **The founder's PDF:** `/Users/lohit/Downloads/tower-full-en.pdf`, "How to build an interactive tower that sells" (Hyliox). It is **34 pages**, not 36. I skimmed every page and read pages 19, 22 and 33 in full. It is a three.js sales-tower walkthrough, so only three points bear on this work:
  - p22: walls are made from the plan with two fixed thicknesses (0.24 m against the core, 0.11 m inside) and openings typed as open, framed door or closed. That is the simpler version of what this schema does with real line spacing, types and headers.
  - p19: its plan failures came from a loose geometry rule and were fixed by putting walls on the building grid.
  - p33, rule 01: give agents the building rules before any visual feedback. That is the approach here: `rules.json` first, pictures last.

  It says nothing about wall material types, vertical bands, door headers or IFC.
