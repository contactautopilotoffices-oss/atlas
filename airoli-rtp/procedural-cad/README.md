# Procedural semantic CAD: RTP 6th floor, Offices 603 & 604

This is a feasibility proof. It shows that a designer's 2D DWG can become a 3D/BIM model in which every wall and door carries its real build data. Each value says where it came from (`cad` or `default`), and the 3D model is checked against the specification, element by element. The verdict is in **FEASIBILITY.md**.

## Run

```bash
PY=<python with ezdxf, shapely, matplotlib, jsonschema, ifcopenshell> ./run.sh --dwg "/Users/lohit/Downloads/20261118_6TH FLOOR (1).dwg" --views
```

```bash
PY=... ./run.sh --variant variants/door2400_mixed.json --out out_variant --views
```

- **The first command** is the baseline: it writes `out/`, refreshes `INVENTORY.md`, `inventory.json` and `ASK_DESIGNER.md`, and saves FreeCAD screenshots in `views/`.
- **The second command** is the hypothetical demonstration. It reuses the same drawing and changes the rules in `variants/door2400_mixed.json`.

Needs: libredwg (`dwg2dxf`), FreeCAD 1.1 (`freecadcmd`, plus the GUI binary for `--views`), and a Python with the five packages above. Python runs isolated (`-I`), because the DWG is untrusted data. The DXF conversion and the other work files go to `$TMPDIR/procedural-cad-work`, never into the repo.

**Exit status:**
- `run.sh` exits non-zero when the FreeCAD build or `verify.py` fails.
- The spot checks and the door-hosting audit are informational: they print their own status and never decide pass or fail.
- The last line says `verification PASSED` or `VERIFICATION FAILED`.

To open the model, run `open -a FreeCAD out/rtp6_floor6.FCStd`. The trace page is at `http://127.0.0.1:8137/airoli-rtp/procedural-cad/trace.html` (add `?data=out_variant/` for the variant), served by this command from the repo root:

```bash
python3 noida-skymark/twin/web/tools/serve_nocache.py 8137
```

## Steps (`scripts/`)

| Script | Does |
|---|---|
| `flatten.py` | DXF → every entity with its handle, layer and colour; blocks exploded into world coordinates (children keep the definition handle and the insert handle). |
| `pairs.py` | Wall-like line pairs and concentric arcs, with their spacing and the hatch, text and coincident lines around them. Also columns and door blocks. |
| `inventory.py` | `inventory.json`, `INVENTORY.md`, `inventory_entities.csv`. |
| `infer.py` | Applies `rules.json`: wall type, thickness, height, bands, layers; doors with host, opening, width, header, frame and leaf; columns, slab, ceiling → `assemblies.json`. |
| `validate.py` | Checks `assemblies.json` against `schema.json`. |
| `questions.py` | `ASK_DESIGNER.md` and `stats.json`. |
| `to_spec.py` | Translates to the FreeCAD build spec (no values change). |
| `fc_build.py` + `fc_run.py` | FreeCAD BIM build (headless) → `.FCStd`, IFC4 (FreeCAD exportIFC plus an ifcopenshell post-pass for layer sets, door fills and sizes), and a mesh. |
| `semantic_out.py` | Semantic DXF (drawing millimetres, typed layers, tags with attributes, XDATA, legend) and web JSON (rtp_local). |
| `trace_data.py` | Data for `trace.html`. |
| `plan_png.py` | Plan coloured by type. |
| `verify.py` | Authoritative: measures the FreeCAD output and the IFC against `assemblies.json`. |
| `spotcheck.py` | Informational: compares the model with the drawing's dimensions, passage labels and door names. |
| `host_audit.py` | Informational: door-by-door hosting compared with the earlier logic (`out/audit/`). |
| `fc_views.py` / `fc_views.sh` | FreeCAD GUI screenshots. They also store colours and visibility in the FCStd, so it opens cleanly in the app. |
| `variant.py` | Builds a merged rules file for a what-if run. |

`fc_build.py` started as a scratch prototype (headless Arch walls, banded walls as IfcElementAssembly, doors with headers, curtain wall, IFC post-pass). It is adapted here for the real floor: IFC class per wall type, freestanding doors, lintel headers, and leaf thickness from the spec.

## Not touched

`airoli-rtp/demo/`, `airoli-rtp/twin/`, `airoli-rtp/experience/` and `noida-skymark/` were not edited. The Blender header change is written up as a proposal in `BLENDER_HEADER_PROPOSAL.md`. Nothing has been committed.
