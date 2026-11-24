# Wall and opening schema

`schema.json` (JSON Schema 2020-12) defines the one file that sits between the drawing and every output: `out/assemblies.json`. The FreeCAD model, the IFC, the semantic DXF, the web JSON and the trace page are all generated from it, and from nothing else. `scripts/validate.py` checks the file against the schema on every run.

## Every value says where it came from

Each attribute is a small record:

```json
"thickness_m": {"value": 0.075, "source": "cad", "confidence": 0.95,
                "handles": ["82839C5C"], "why": "spacing of the two face lines: 75 mm"}
"height_m":    {"value": 2.9, "source": "default", "confidence": 0.4, "q": "Q-G1",
                "why": "no height in the drawing; default build-up for this wall type"}
```

| `source` | Meaning |
|---|---|
| `cad` | Read from the drawing. Carries the entity handles and layer, so anyone can find the line in the DWG. |
| `designer` | Answered by the designer (none yet). |
| `client` | Stated by the client team or the founder (none used as final values yet). |
| `default` | Assumed and marked. Carries `q`, the question in ASK_DESIGNER.md that would replace it. |

`confidence` runs from 0 to 1. It belongs to the rule that produced the value, not to a statistical model.

## Wall

| Field | What it holds |
|---|---|
| `type` | One of `glass_partition`, `full_height_glass`, `pop_gypsum`, `mixed`, `brick_block`, `rcc`, `curtain_wall`, `acp`, `window_glazing`, `panel_partial_height`, `railing`, `unknown`. `mixed` means several materials stacked vertically (POP + glass + POP). |
| `axis` | The centre line in plan metres, which is a polyline for curved walls. |
| `thickness_m` | The spacing of the two drawn faces. |
| `height_m` | The top of the wall, plus `to`: FC (false ceiling), SOFFIT or F2F (floor to floor). |
| `bands` | The vertical make-up, as a stack of `{material, z0_m, z1_m}` from the floor up, for example POP 0–0.9, glass 0.9–2.4, POP 2.4–3.35. |
| `layers` | The build-up through the thickness, for example plaster 12, block 126, plaster 12 (mm). It becomes an IfcMaterialLayerSet. |
| `cad` | The evidence behind the type: layers, face handles, line spacing, hatch lines between the faces, hatch fills, text nearby and coincident lines on other layers. |

## Opening

| Field | What it holds |
|---|---|
| `kind` | One of `glass_door`, `solid_door`, `double_door`, `cubicle_door`, `window`, `arch`, `arch_window`, `opening`. |
| `host` | The wall it sits in. It is found from the wall ends either side of the door block. |
| `line` | The opening in plan: the gap between the two wall ends. |
| `opening_width_m` | The structural (rough) opening: the gap between the wall ends, or the outer faces of the drawn jambs. It is the only width that is modelled and cut. `width_m` is an alias for it. |
| `frame_outside_width_m` | The outside of the frame. |
| `clear_width_m` | The clear passage width between the frame faces. It is null (default) when no jambs are drawn. |
| `leaf_width_m` | The leaf, from the radius of the drawn swing. It is never used as the opening. |
| `nominal_width_m` | The number in the block name (for example D-750). Evidence only. |
| `head_m` | The door head height. |
| `sill_m` | The sill height. |
| `header` | What sits above the opening: `pop_bulkhead`, `glass_transom`, `full_height`, `lintel_masonry` or `none_open_above`, with its z range. Every door has one; this is the gap the founder flagged. |
| `frame` | The frame and beading: profile in mm and material. It is taken from the drawing where the door block draws its jambs. |
| `leaf` | The door leaf: material, thickness and z0. |
| `arch` | `{spring_m, radius_m, with_window}`, or null. |

## Columns, slab, ceiling, levels

- **Columns:** outline (cad), type (cad when the drawing has a solid RCC hatch) and height.
- **Slab and false ceiling:** the outline of the offer and the ceiling level.
- **Levels:** false ceiling, soffit, floor to floor, slab, and FFL above ground.

## The default set (one coherent set, founder's instruction of 19 Nov 2026)

These are common Indian office fit-out build-ups. Every value below is `source: default` and is listed in ASK_DESIGNER.md for the designer to confirm.

| Item | Default |
|---|---|
| False ceiling | 2.90 m (the founder's range is 2.7–2.9 m; the web twin uses 3.05 m from an earlier client-team note) |
| Slab soffit / floor to floor / slab | 3.35 m / 3.60 m / 0.25 m |
| Glass partition | 12 mm toughened clear glass in a 50 mm aluminium channel top and bottom, floor to false ceiling, nothing above |
| POP / gypsum partition | 2 × 12.5 mm gypsum board on 50 mm GI studs with a POP finish, floor to soffit. 75 mm where drawn at 75 mm; 100 mm when no thickness is drawn |
| Block / brick (core, wet areas) | Concrete block with 12 mm cement plaster both faces, floor to soffit. Drawn thickness wins; 230 mm when not drawn |
| RCC (fins, columns) | Floor to soffit, 12 mm plaster |
| Facade | Clear glass slab to slab on the structural-glazing line; ACP full storey height where drawn; windows (layer WINDOW) glass floor to soffit |
| Toilet cubicles | 20 mm HPL panels from 0.15 to 2.10 m |
| Railing | 1.0 m |
| Door head | 2.10 m for every door |
| Header above a door in glass | Glass transom from the door head to the false ceiling, with a 45 × 75 mm aluminium transom bar |
| Header above a door in dry wall | POP bulkhead (the partition continues above the door) up to the soffit |
| Header above a door in block | RCC lintel and block above, up to the soffit |
| Header above a cubicle door | None: the panels stop at 2.10 m |
| Door frames | Aluminium 45 × 75 mm (glass), hardwood 50 × 100 mm with 12 mm beading (solid). The drawing's own jamb size wins where the block draws one |
| Door leaves | 12 mm toughened glass; 35 mm flush door; 20 mm HPL in cubicles |
| Arches | None (nothing in the drawing marks one) |

## Where the rules live

`rules.json` holds the whole recipe:

- `pairing`: how line pairs are found.
- `wall_rules`: an ordered list from evidence to wall type, each rule with its reason.
- `door_blocks`: from block and layer to door kind.
- `assemblies`: the bands and layers per wall type.
- `defaults`: the default values above.
- `overrides`: rule changes that switch one wall class to another, for example O1, which turns the partitions around meeting rooms into POP + glass + POP. It is off in the main run.
- `questions`: the designer questions.

Change a value and run `./run.sh` to rebuild every output.
