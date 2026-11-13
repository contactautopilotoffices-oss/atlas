# CAD floor plan (DWG/DXF) to 3D model and interior elevations: open-source survey (as of 11 Nov 2026)

Scope: turning one office fit-out plan (Volt, 1st floor of a G+4 building, about 100 seats) into a 3D model (walls, glass partitions, doors, columns, ceilings, furniture from block INSERTs) and into interior elevations and sections, headless on Ubuntu 24.04 / Python 3.13 / Node 22 / no GPU, ending in Blender (pip `bpy` 5.2.3) and three.js.

Method note: GitHub's REST API was blocked in this session, so "last commit" dates come from shallow `git clone` of each repo on 2026-11-11. PyPI and npm metadata came from their JSON registries. Hosts `extensions.blender.org` and `ezdxf.mozman.at` could not be fetched (DNS blocked in this sandbox), so their content comes from search snippets or from the docs folder in the cloned repo. The key file paths in the IfcOpenShell, FreeCAD, ezdxf and dxf-viewer repos were read from the clones.

## Q1. Which repos and tools convert DXF/DWG plans to 3D, and how mature are they?

### Takeaway
No open-source tool turns an architectural DXF into a semantic 3D office (walls, glazing, doors, columns, furniture) in one step. The realistic headless route is a custom script, roughly 500 to 1,500 lines. Step 1: read the DXF with **ezdxf** (MIT, Python 3.13 supported, active). Step 2: turn the wall, glazing and column layers into polygons with **shapely**. Step 3: either build the meshes directly in **bpy** or first write IFC with **IfcOpenShell** (LGPL, py313 wheels, very active) and convert. DWG input needs a converter before any of this: **LibreDWG** `dwg2dxf` (GPL-3, active) or the proprietary-freeware **ODA File Converter** through ezdxf's `odafc` add-on. The Blender DXF importer is no longer bundled with Blender. It is a "limited support" extension, and it imports 2D linework, not walls. Image-based tools (FloorplanToBlender3d, CubiCasa5k, FloorplanTransformation) are the wrong fit for a vector DWG.

### Cited Findings

**DXF/DWG reading (Python)**
- ezdxf: latest PyPI release is 1.4.5 (uploaded 2026-10-16), `requires_python >=3.10`, with classifiers for Python 3.11 to 3.15. Last commit was 2026-11-08 and the licence is MIT. — [PyPI ezdxf](https://pypi.org/project/ezdxf/), [GitHub mozman/ezdxf](https://github.com/mozman/ezdxf)
- ezdxf ships add-ons for `odafc` (ODA File Converter wrapper), a native `dwg` loader, `drawing` back-ends (`svg.py`, `pymupdf.py`), `meshex`, `openscad`, `geo` and `r12writer`. — [ezdxf src/ezdxf/addons](https://github.com/mozman/ezdxf/tree/HEAD/src/ezdxf/addons)
- ezdxf's own DWG loader doc says it "convert[s] DWG data into DXF tags" and cannot export DWG. Its doc file is named `dwg.rs_`, which suggests it is excluded from the published docs and is not a supported path. — [ezdxf docs/source/addons/dwg.rs_](https://github.com/mozman/ezdxf/blob/HEAD/docs/source/addons/dwg.rs_)
- ezdxf `odafc` add-on: the ODA File Converter "has to be installed by the user". It is available as Linux DEB/RPM and as an AppImage, set through config `unix_exec_path`. "on Linux you may have to install the `xvfb` package" to suppress its GUI. The docs also warn that running an external application "is a big security issue". — [ezdxf docs/source/addons/odafc.rst](https://github.com/mozman/ezdxf/blob/HEAD/docs/source/addons/odafc.rst)
- LibreDWG is GPL-3.0-or-later (GNU project) and ships `dwg2dxf`. Its README still says "R2010-R2018 writing leads to CRC errors", which concerns writing DWG, not reading. Last commit was 2026-11-11 ("out_dxf, out_dxfb: write xdata strings…"). — [GitHub LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)
- A WASM build of LibreDWG for Node/browser exists: npm `@mlightcad/libredwg-web` 0.8.8, published 2026-11-10, GPL-3.0. — [npm @mlightcad/libredwg-web](https://www.npmjs.com/package/@mlightcad/libredwg-web)
- On this Ubuntu 24.04.5 image, `apt-cache policy` shows no candidate for `libredwg-tools`, `libredwg-utils` or `freecad`. `blender` resolves to 4.0.2. — local `apt-cache policy` check, 2026-11-11 (not a web source)

**Blender**
- `bpy` on PyPI: versions 5.2.0 to 5.2.4 and 5.3.0 exist. The latest, 5.3.0, was uploaded 2026-11-10, with `requires_python ==3.13.*` and licence GPL-3.0. — [PyPI bpy](https://pypi.org/project/bpy/)
- The official "Import AutoCAD DXF" add-on (io_import_dxf) is now an extension on extensions.blender.org. It lists compatibility with Blender 4.2 and newer, version 0.9.10, and says it "was part of Blender 4.1 bundled add-ons" and "is now offered as it is, with limited support". Reviews report a traceback in Blender 4.4 and failures on cadmapper DXFs. A tracker issue reports "distorted and incorrectly merged edges" on QGIS DXFs. — [extensions.blender.org listing](https://extensions.blender.org/add-ons/import-autocad-dxf-format-dxf), [reviews](https://extensions.blender.org/add-ons/import-autocad-dxf-format-dxf/reviews), [issue #2](https://projects.blender.org/extensions/io_import_dxf/issues/2) (via search snippets; the host was not fetchable)
- The archived `blender/blender-addons` repo (last commit 2024-05-13) still contains only `io_export_dxf`, so the importer has moved to its own extension repo. — [GitHub blender/blender-addons](https://github.com/blender/blender-addons)
- Third-party alternatives: CAD2CUBE 1.5.0 (Blender 4.2 LTS+) "removed native DWG support via ODA converter", is now DXF-only, and has a filter for anonymous dimension blocks. "DWG Import" on Superhive is paid and claims Blender 4.2 to 5.2. — [CAD2CUBE](https://extensions.blender.org/add-ons/cad2cube/), [Superhive DWG Import](https://superhivemarket.com/products/dwg-import)

**IFC / BIM route**
- ifcopenshell 0.9.0.post1 on PyPI (2026-10-15) has `py313-none-manylinux_2_31_x86_64` wheels and requires Python `<3.16,>=3.10`. The IfcOpenShell repo's last commit was 2026-11-11. Bonsai tags run up to `bonsai-0.8.5.post1`. — [PyPI ifcopenshell](https://pypi.org/project/ifcopenshell/), [GitHub IfcOpenShell](https://github.com/IfcOpenShell/IfcOpenShell)
- IfcOpenShell's Python API has wall and opening builders: `api/geometry/add_wall_representation.py`, `add_door_representation.py`, `add_window_representation.py`, `add_slab_representation.py`, `connect_path.py`, `connect_wall.py`, `clip_solid.py`. — [ifcopenshell/api/geometry](https://github.com/IfcOpenShell/IfcOpenShell/tree/HEAD/src/ifcopenshell-python/ifcopenshell/api/geometry)
- The bundled `src/bonsai/scripts/dxf2ifc.py` (GPL-3, ezdxf + ifcopenshell) only converts `POLYLINE` poly-face meshes into `IfcBuildingElementProxy` named after the layer. It prints "Skipping unsupported entity" for everything else, so it is a skeleton, not a 2D-plan-to-walls converter. — [dxf2ifc.py](https://github.com/IfcOpenShell/IfcOpenShell/blob/HEAD/src/bonsai/scripts/dxf2ifc.py)
- An IfcOpenShell GitHub discussion on DXF-to-IFC points to that same script as "a good starting point". An OSArch thread notes the converter was "tested on one simple file". — [IfcOpenShell discussion #4293](https://www.github.com/IfcOpenShell/IfcOpenShell/discussions/4293), [OSArch Blender 2D dxf to ifc](https://wiki.osarch.org/blender-2d-dxf-to-ifc/)

**FreeCAD**
- FreeCAD's DXF import has two paths: a legacy Python importer (`src/Mod/Draft/importDXF.py`, which downloads `dxfLibrary`/`dxfReader` helper files at runtime) and a C++ importer (`src/Mod/Import/App/dxf/ImpExpDxf.cpp`). Blocks become shapes cached in a `blockshapes` dict, and `*`-anonymous blocks are skipped unless `dxfStarBlocks` is set. BIM has `ArchWall.py` and `ArchSectionPlane.py`. Last commit was 2026-11-11. — [importDXF.py](https://github.com/FreeCAD/FreeCAD/blob/HEAD/src/Mod/Draft/importDXF.py), [Mod/BIM](https://github.com/FreeCAD/FreeCAD/tree/HEAD/src/Mod/BIM)
- The FreeCAD wiki says FreeCADCmd "executes the code and then immediately exits" and that not all workbench modules are available headless. — [Headless FreeCAD wiki](https://wiki.freecad.org/Headless_FreeCAD)

**three.js / Node**
- vagran/dxf-viewer is a "DXF 2D viewer component" in WebGL via three.js. It batches geometry, uses instanced rendering for block INSERTs and supports layers. MPL-2.0, npm 1.0.51 published 2026-11-11, last commit 2026-11-11, depends on `three ^0.186.0`. It relies on `dxf-parser` (no stream parsing) and ignores text styles. It is 2D only, with no extrusion. — [GitHub vagran/dxf-viewer](https://github.com/vagran/dxf-viewer), [npm dxf-viewer](https://www.npmjs.com/package/dxf-viewer)
- three-dxf: npm 1.3.1, last published 2021-10-22, last commit 2021-10-21, MIT. It is effectively unmaintained. — [npm three-dxf](https://www.npmjs.com/package/three-dxf), [GitHub gdsestimating/three-dxf](https://github.com/gdsestimating/three-dxf)
- dxf-parser: npm 1.1.2, last published 2021-11-12, MIT. npm `dxf` 5.3.1 was published 2025-09-01, MIT. three itself is at 0.187.0 (2026-10-30). — [npm dxf-parser](https://www.npmjs.com/package/dxf-parser), [npm dxf](https://www.npmjs.com/package/dxf), [npm three](https://www.npmjs.com/package/three)

**Image or raster-based tools (poor fit for a vector DWG)**
- FloorplanToBlender3d: last commit 2024-10-09. GPL-3.0 per README. Needs "Blender3d > 2.93" and Python >= 3.8, and recommends Docker "to avoid any version related problems". It detects walls, rooms, doors and windows from images with OpenCV. — [GitHub grebtsew/FloorplanToBlender3d](https://github.com/grebtsew/FloorplanToBlender3d)
- CubiCasa5k: last commit 2019-05-24. Licence CC BY-NC 4.0, which is non-commercial. — [GitHub CubiCasa/CubiCasa5k](https://github.com/CubiCasa/CubiCasa5k)
- FloorplanTransformation (Raster-to-Vector, Liu et al.): last commit 2019-06-28. Torch7 plus Python 2.7, with an unevaluated PyTorch port. — [GitHub art-programmer/FloorplanTransformation](https://github.com/art-programmer/FloorplanTransformation)
- DeepFloorplan: last commit 2021-07-26. — [GitHub zlzeng/DeepFloorplan](https://github.com/zlzeng/DeepFloorplan)

**Utilities**
- shapely 2.2.0 (2026-10-07, py>=3.11) and trimesh 5.2.0 (MIT) are current on PyPI. — [PyPI shapely](https://pypi.org/project/shapely/), [PyPI trimesh](https://pypi.org/project/trimesh/)

**Wall-detection algorithms (literature)**
- Two classic strategies appear in the literature: (a) treat walls as parallel line pairs (Lu et al. 2007; Park and Kwon 2003), or (b) build closed polygons or loops directly. The general pipeline is opening detection, then loop search, then loop extrusion. A TU Delft thesis also covers a "Generalized Wall Adjacency Graph" for multiple close parallel segments. — [TU Delft repository thesis](https://repository.tudelft.nl/file/File_febdfaf5-34ca-45f0-8712-a46190ad327b)
- Wu et al. (*Technique et Science Informatiques* 35:303–316) cluster CAD wall lines by slope to remove overlaps, then "restore walls where doors and windows create gaps" before building 3D components. — [IIETA paper](https://iieta.org/journals/ts/paper/10.3166/TS.35.303-316)
- Cambeiro Barreiro et al. (Fraunhofer HHI, arXiv 2306.01642) use semantic segmentation instead of geometric rules because plans vary so much. That approach is for scanned or raster plans. — [arXiv 2306.01642](https://arxiv.org/pdf/2306.01642v1.pdf)

### Inferences
- **Recommended headless chain:** DWG → `dwg2dxf` (LibreDWG, built from git because apt has no package on this image) or ODA FC + `xvfb-run` → ezdxf → layer classification → shapely polygons → (a) bpy meshes directly, or (b) IfcOpenShell IFC, then geometry or GLB export → Blender (materials, lighting, furniture assets) → glTF → three.js. Option (b) costs more but is what makes Q3's elevations from IfcOpenShell possible.
- **Fit for the Volt plan:** for a clean fit-out drawing (wall layers drawn as double lines or hatches), building walls by polygonising the closed loops is more robust than pairing parallel lines. Union all segments on the wall layer, close the gaps at door jambs, then `shapely.polygonize` or buffer-union. Use parallel-line pairing only where walls are open line pairs.
- **What to avoid for walls:** the Blender DXF extension, three-dxf and dxf-viewer only give linework, which is useful as a 2D underlay in three.js (dxf-viewer) but not for walls. Raster tools would throw away exact geometry.
- **Licence check if outputs are distributed:** LibreDWG (GPL-3) and Bonsai scripts (GPL-3) are only a concern if the code itself is redistributed; running them in a server pipeline does not create obligations for the output files. CubiCasa5k's NC licence rules out commercial use.

### Gaps
- I found no maintained open-source "dxf2gltf" or "dxf-to-glb" converter that produces extruded walls. The search found none, and no candidate names resolved.
- I could not read the extensions.blender.org page directly (host blocked), so I could not confirm the Blender 5.x compatibility statement or the licence of io_import_dxf 0.9.10.
- I did not test LibreDWG read fidelity on a real DWG from 2018 or later (proxy objects, dynamic blocks, xrefs). Dynamic block parameters are a known weak spot in open-source DWG readers, but I found no source for that in this session.
- I did not check whether FreeCAD 1.1 can be installed via pip or conda on Python 3.13. apt has no candidate, so it would need an AppImage or conda.

## Q2. How do you recognise elements from layers and block names, and place 3D furniture at INSERT points?

### Takeaway
Classify by layer name, using an AIA/NCS-style layer map with a per-project override table. Classify furniture by block name. For each INSERT, take the full transform from ezdxf `Insert.matrix44()` rather than rebuilding it from `insert` + `rotation` + `xscale`, because the matrix already handles OCS extrusion, mirroring and nested blocks. Use `virtual_entities()` when you need a block's 2D outline, and ATTRIB text (`get_attrib_text`) for tags such as seat IDs. Map each block name to a GLB asset, and use instancing in Blender and three.js for the ~100 workstations.

### Cited Findings
- ezdxf's `Insert` entity exposes `dxf.insert`, `dxf.xscale`/`yscale`/`zscale`, `dxf.rotation`, `attribs`, `get_attrib`, `get_attrib_text`, `add_auto_attribs`, `virtual_entities()`, `multi_insert()` (for MINSERT arrays), `explode()`, `ucs()` and `matrix44()`. — [ezdxf docs/source/blocks/insert.rst](https://github.com/mozman/ezdxf/blob/HEAD/docs/source/blocks/insert.rst)
- "A-WALL" is the common layer convention for IfcWall in an IFC-to-DXF layer mapping discussed on OSArch, consistent with the AIA CAD layer standard. — [OSArch thread](https://community.osarch.org/discussion/1942/)
- FreeCAD's importer caches block geometry per block name (`blockshapes[blockref.name]`) and skips anonymous `*` blocks (dimensions, hatches, dynamic block variants) by default. — [FreeCAD importDXF.py](https://github.com/FreeCAD/FreeCAD/blob/HEAD/src/Mod/Draft/importDXF.py)
- CAD2CUBE has a filter for anonymous dimension blocks, which confirms that `*D…`/`*U…` anonymous blocks pollute naive imports. — [CAD2CUBE listing](https://extensions.blender.org/add-ons/cad2cube/) (search snippet)
- dxf-viewer renders repeated block INSERTs with instanced rendering in a single draw call, the same approach to use for 100 chairs and desks in three.js. — [vagran/dxf-viewer README](https://github.com/vagran/dxf-viewer)
- IfcConvert's SVG serializer has a `draw_door_arcs_` option, so door swings are drawn from IfcDoor semantics rather than read from the plan. — [svg_serializer.h](https://github.com/IfcOpenShell/IfcOpenShell/blob/HEAD/src/serializers/svg_serializer.h)
- The Wu et al. pipeline explicitly restores wall continuity across door and window gaps before extrusion. — [IIETA paper](https://iieta.org/journals/ts/paper/10.3166/TS.35.303-316)

### Inferences
- **Proposed rule table** (to adjust after listing `doc.layers` and `doc.blocks` of the real Volt DWG):
  - **Walls:** `A-WALL*`, `*WALL*`, `*PARTITION*`, `*DRYWALL*`, giving full-height solid walls.
  - **Glazing:** `A-GLAZ*`, `*GLASS*`, `*GLAZING*`, `*CURTAIN*`, giving a thin slab with a glass material and mullions every ~1.2 m.
  - **Doors:** `A-DOOR*`, plus ARC entities on door layers. The arc radius gives the leaf width and the arc centre gives the hinge, which together give an opening cut and a door leaf.
  - **Columns:** `S-COLS*`, `*COLUMN*`, or small closed squares and circles on a structural layer.
  - **Ceilings:** `A-CLNG*`/RCP layers, or a fallback flat ceiling at a given height.
  - **Furniture:** `I-FURN*`/`A-FURN*`, plus blocks whose names match `WS*`, `CHAIR*`, `DESK*`, `TABLE*`, `SOFA*`.
- **Units:** read `$INSUNITS` (ezdxf `doc.units`) and scale to metres. Indian fit-out DWGs are typically in mm.
- **Placing furniture:** for each INSERT, compute `M = insert.matrix44()` and convert to a Blender `Matrix` (transpose: ezdxf is row-major). Link an instance of the library asset chosen for `insert.dxf.name`, with the asset's origin and front axis normalised to the block's base point. A negative determinant means a mirrored block, so flip the asset or the face normals.
- **Nested blocks:** recurse with `virtual_entities()`, carrying the parent matrix down.
- **Dynamic blocks:** they appear as anonymous `*U` blocks. Recover the original name from the `AcDbBlockRepresentation` extension dictionary, or match by bounding box.
- **Asset choice:** pick assets by footprint. Compare the block's 2D bounding box from `virtual_entities()` against each asset's footprint to choose 1200 mm vs 1400 mm desks and to scale chairs, which also catches mislabelled blocks.
- **Seat count:** check the extracted inserts against the 100-seat target; this is a cheap sanity test.

### Gaps
- I found no maintained open-source library that ships a ready-made AIA-layer to IFC-class classifier for DXF import. All of the above is custom code.
- The ezdxf online docs page on block transforms and the OCS could not be fetched (host blocked). The `matrix44()` behaviour is taken from the method list in the repo docs, not from the full prose.

## Q3. How can elevations and sections be generated from the 3D model?

### Takeaway
The most automatable headless option is **IfcOpenShell's SVG serializer**, available as `python -m ifcopenshell.draw` (CLI built from the `draw_settings` dataclass) or as IfcConvert with `.svg` output. It does hidden-line removal and supports auto sections and elevations, door arcs and space labels. Elevations at chosen positions come from `IfcAnnotation` objects with `ObjectType=DRAWING`, which is what Bonsai's drawing system (and the ifcpatch `GenerateGeneralArrangementDrawings` recipe) builds on. Blender orthographic cameras with Freestyle or Line Art also work headless for rendered or line elevations, but SVG export of Line Art from orthographic cameras has a long-standing bug report, and Freestyle SVG files can be bloated. FreeCAD TechDraw can produce SVG, but reports differ on whether it runs truly headless, and it likely needs xvfb. Unfolded interior elevations (all four walls of a room laid out side by side) have no off-the-shelf open-source tool.

### Cited Findings
- `ifcopenshell.draw` defines `draw_settings` with: `width=297`, `height=420` (A3 mm), `scale=1/100`, `auto_elevation`, `auto_section`, `auto_floorplan=True`, `space_names`, `space_areas`, `door_arcs`, `subtract_before_hlr`, `css`, `storey_heights`, `storey_filter`, `include_entities`, `exclude_entities="IfcOpeningElement"`, `drawing_guid`, `drawing_object_type`, `hlr_poly`, `prefilter`, `include_curves`, `arrange_spaces`, `mirror_y`, among others. It instantiates `ifcopenshell.geom.serializers.svg`. It has an `if __name__ == "__main__"` argparse CLI that generates `--name`/`--no-name` flags from the dataclass. — [ifcopenshell/draw.py](https://github.com/IfcOpenShell/IfcOpenShell/blob/HEAD/src/ifcopenshell-python/ifcopenshell/draw.py)
- The C++ SVG serializer carries `section_ref_`, `elevation_ref_`, `elevation_ref_guid_`, `auto_section_`, `auto_elevation_`, `with_section_heights_from_storey_`, `print_space_names_`, `print_space_areas_`, `draw_door_arcs_` and `space_name_transform_`, and it does projection with hidden-line handling (`view_direction_`, `large_ortho_faces_`). — [svg_serializer.h](https://github.com/IfcOpenShell/IfcOpenShell/blob/HEAD/src/serializers/svg_serializer.h)
- Example command from the community: `IfcConvert input.ifc output.svg -qy --plan --model --section-height-from-storeys --section-height=1.2 --door-arcs --print-space-names --auto-section --auto-elevation`.
  - Users first got empty SVGs until the IfcBuildingStorey had an Elevation set.
  - Auto mode does not let you choose the section plane or depth. The suggested fix is a manually placed `IfcAnnotation(ObjectType=DRAWING)`.
  - Options reportedly need to come after the filenames.
  - — [OSArch "svg from IfcConvert"](https://community.osarch.org/discussion/comment/22402)
- Sources disagree on whether IfcSpace is included in SVG output by default. The IfcOpenShell wiki says spaces and openings are excluded by default. — [OSArch thread](https://community.osarch.org/discussion/comment/22402), [IfcOpenShell wiki](https://www.github.com/IfcOpenShell/IfcOpenShell/wiki/Home/2a5cf65342fc3defdad9e9f201e2fa2a258dc2eb)
- ifcpatch ships a `GenerateGeneralArrangementDrawings` recipe. It creates drawing contexts and documents through `ifcopenshell.api.drawing`/`document` and writes into `drawings/`, `layouts/` and `layouts/titleblocks/` with CSS, marker, symbol and pattern SVG assets, plus metric and imperial scale tables. — [GenerateGeneralArrangementDrawings.py](https://github.com/IfcOpenShell/IfcOpenShell/blob/HEAD/src/ifcpatch/ifcpatch/recipes/GenerateGeneralArrangementDrawings.py)
- Bonsai's drawing module (`bonsai/bim/module/drawing/`: `annotation.py`, `decoration.py`, `sheeter.py`, `svgwriter.py`, `scheduler.py`) produces SVG drawings and sheets. Its guide says drafting "is still in early development" and "heavily based on SVG files". — [Bonsai drawing module](https://github.com/IfcOpenShell/IfcOpenShell/tree/HEAD/src/bonsai/bonsai/bim/module/drawing), [Bonsai drawings guide](https://github.com/IfcOpenShell/IfcOpenShell/blob/HEAD/src/bonsai/docs/guides/drawings/index.rst)
- A third-party mirror (`dev.glassvision.dedyn.io`) shows recent SvgSerializer commits: "Classify projection edges in SVG elevations", "optionally draw occluded linework as hidden lines", "only draw door swing arcs on the storey where the door is cut", "don't let one bad element abort an entire drawing print". These suggest active work on elevations, but they come from a fork mirror and I did not confirm they are upstream. — [commit f0970b90](https://dev.glassvision.dedyn.io/Glassvision/IfcOpenShell/src/commit/f0970b90b07426342f99299cc94a54fdbb8da36d), [hidden-lines branch](https://dev.glassvision.dedyn.io/Glassvision/IfcOpenShell/src/branch/bonsai-6424-hidden-lines)
- Blender Grease Pencil SVG/PDF export:
  - It works only in Object Mode, and by 4.4 it exports "from the view of the largest 3D Viewport", which is awkward headless.
  - A bug report says SVG/PDF export "does not export line art when the camera is in orthographic mode", with no confirmed fix in the thread.
  - Another issue says screen-space line weight is ignored on SVG export.
  - The Freestyle SVG exporter "produces thousands of very small lines".
  - — [Blender manual 4.4 GP SVG](https://docs.blender.org/manual/ru/4.4/files/import_export/grease_pencil_svg.html), [T86942](https://developer.blender.org/T86942), [#103061](https://projects.blender.org/blender/blender/issues/103061), [blender-addons #105203](https://projects.blender.org/blender/blender-addons/issues/105203)
- FreeCAD TechDraw headless: some community skill pages claim it runs under freecadcmd, while another says TechDraw HLR and SVG export need `xvfb-run` because of an OpenGL context. These are not official sources. A 2017 tracker note says page-level SVG export needed extra Python and `TechDraw.viewPartAsSvg` exists per view. — [FreeCAD tracker 3077](https://tracker.freecad.org/view.php?id=3077), [Headless FreeCAD wiki](https://wiki.freecad.org/Headless_FreeCAD)
- ezdxf's `drawing` add-on has SVG and PyMuPDF (PDF) back-ends. These are useful for rendering the original 2D plan or a generated 2D elevation DXF to SVG/PDF without a GUI. — [ezdxf addons/drawing](https://github.com/mozman/ezdxf/tree/HEAD/src/ezdxf/addons/drawing)

### Inferences
- **Interior elevations for Volt.** For each room polygon, and each wall segment of it, place a drawing camera just inside the room, facing the wall. In IFC this is an `IfcAnnotation` with `ObjectType=DRAWING`, used with `elevation_ref`/`drawing_guid`; in Blender it is an orthographic camera, rotated so it looks along the wall's inward normal, with its clip range set to the room depth and its ortho scale set to the wall length. Render each camera, then compose the panels left to right in perimeter order to get the "unfolded" sheet. Doing that composition in SVG is straightforward (translate each panel's `<g>`).
- **Dimensions are computed, not rendered.** No renderer adds them automatically outside Bonsai's GUI annotation tools. Generate them in code: wall length, ceiling height and opening widths are all known from the model. Write them as SVG `<line>`/`<text>` or as ezdxf DIMENSION entities, then render through ezdxf's drawing add-on.
- **Two drawing styles.** Use the Blender route (Workbench or EEVEE ortho render plus Freestyle as a raster PNG) for presentation elevations with materials. Use IfcOpenShell `draw` for crisp vector linework. CPU-only Workbench/EEVEE needs software GL in a headless bpy build; Cycles CPU always works but is slower.
- **Effort estimates.** IFC route: about 2–4 days to get dependable automated interior elevations once a clean IFC exists. Blender-only raster elevations: about 1 day. FreeCAD: the least attractive here, because there is no apt package, headless TechDraw is uncertain, and it is a third toolchain.

### Gaps
- I found no open-source tool that automatically "unfolds" room walls into interior elevation sheets. This needs custom code.
- I could not confirm whether the `--svg-project`, `--elevation-ref` and `--section-ref` CLI flag spellings in IfcConvert 0.8/0.9 match the C++ member names. The members exist in `svg_serializer.h`, but the option strings were not in `IfcConvert.cpp` (they appear to live in shared settings code that I did not locate).
- I did not verify whether bpy 5.2.x headless (no GPU) can run EEVEE or Workbench renders with Freestyle, or whether it needs Cycles. This needs a local test.
- I did not confirm whether the T86942 orthographic Line Art SVG bug is fixed in Grease Pencil v3 (Blender 4.3+).

## Q4. Licences, maintenance, version support, headless use and pitfalls

### Takeaway
Everything core to the pipeline is actively maintained as of November 2026, with commits within the last week: ezdxf, IfcOpenShell/Bonsai, LibreDWG, FreeCAD and dxf-viewer. Everything on the image-AI side is stale (2019–2024). Licences are permissive (ezdxf MIT, three MIT, shapely BSD, trimesh MIT), weak copyleft (dxf-viewer MPL-2.0, IfcOpenShell LGPL-3) or GPL (bpy, Bonsai, LibreDWG, FloorplanToBlender3d). All of the core can run on Python 3.13 headless. The main pitfalls are: DWG conversion (ODA FC needs xvfb and is proprietary, LibreDWG needs a source build), anonymous and dynamic blocks, units, the Blender DXF extension's "limited support" status, and IfcConvert producing empty SVGs when storeys lack an elevation.

### Cited Findings

| Tool | Version / date | Licence | Python/Node | Headless | Source |
|---|---|---|---|---|---|
| ezdxf | 1.4.5, 2026-10-16; commit 2026-11-08 | MIT | py 3.10+ (3.11–3.15 classifiers) | yes | [PyPI](https://pypi.org/project/ezdxf/), [GitHub](https://github.com/mozman/ezdxf) |
| ifcopenshell | 0.9.0.post1, 2026-10-15; commit 2026-11-11 | LGPL-3 (IfcOpenShell); Bonsai GPL-3 (per file header) | py 3.10–3.15, cp313 manylinux_2_31 wheel | yes (`python -m ifcopenshell.draw`) | [PyPI](https://pypi.org/project/ifcopenshell/), [dxf2ifc.py header](https://github.com/IfcOpenShell/IfcOpenShell/blob/HEAD/src/bonsai/scripts/dxf2ifc.py) |
| bpy | 5.2.3 / 5.2.4; 5.3.0 on 2026-11-10 | GPL-3.0 | py ==3.13.* | yes | [PyPI](https://pypi.org/project/bpy/) |
| LibreDWG | commit 2026-11-11 | GPL-3+ | C, CLI `dwg2dxf` | yes | [GitHub](https://github.com/LibreDWG/libredwg) |
| @mlightcad/libredwg-web | 0.8.8, 2026-11-10 | GPL-3.0 | Node/WASM | yes | [npm](https://www.npmjs.com/package/@mlightcad/libredwg-web) |
| ODA File Converter (via ezdxf odafc) | n/a | proprietary freeware | Linux DEB/RPM/AppImage | needs xvfb | [odafc.rst](https://github.com/mozman/ezdxf/blob/HEAD/docs/source/addons/odafc.rst) |
| dxf-viewer | 1.0.51, 2026-11-11 | MPL-2.0 | three ^0.186 | browser (2D only) | [npm](https://www.npmjs.com/package/dxf-viewer) |
| three-dxf | 1.3.1, 2021-10-22 | MIT | — | browser | [npm](https://www.npmjs.com/package/three-dxf) |
| FreeCAD | commit 2026-11-11 | LGPL (FreeCAD project) | own Python | FreeCADCmd; TechDraw may need xvfb | [GitHub](https://github.com/FreeCAD/FreeCAD), [wiki](https://wiki.freecad.org/Headless_FreeCAD) |
| io_import_dxf (Blender ext.) | 0.9.10, Blender 4.2+ | (not confirmed) | inside Blender | via `--background` | [listing](https://extensions.blender.org/add-ons/import-autocad-dxf-format-dxf) |
| FloorplanToBlender3d | commit 2024-10-09 | GPL-3 | py >=3.8, Blender >2.93 | Docker | [GitHub](https://github.com/grebtsew/FloorplanToBlender3d) |
| CubiCasa5k | commit 2019-05-24 | CC BY-NC 4.0 | PyTorch | — | [GitHub](https://github.com/CubiCasa/CubiCasa5k) |
| FloorplanTransformation | commit 2019-06-28 | (see repo) | Torch7 + Py2.7 | — | [GitHub](https://github.com/art-programmer/FloorplanTransformation) |

- **Pitfall: storey elevation.** IfcConvert SVG comes out empty unless IfcBuildingStorey has an Elevation set. — [OSArch](https://community.osarch.org/discussion/comment/22402)
- **Pitfall: ODA FC opens a GUI on Linux** unless xvfb is used. — [odafc.rst](https://github.com/mozman/ezdxf/blob/HEAD/docs/source/addons/odafc.rst)
- **Pitfall: the Blender DXF importer** has distorted or merged edges and face-creation tracebacks in 4.4, and is offered "as it is". — [extensions listing (snippet)](https://extensions.blender.org/add-ons/import-autocad-dxf-format-dxf/reviews), [issue #2](https://projects.blender.org/extensions/io_import_dxf/issues/2)
- **Pitfall: dxf-viewer** buffers the whole file (no stream parsing) and ignores DXF text styles. — [dxf-viewer README](https://github.com/vagran/dxf-viewer)
- **Pitfall: FloorplanToBlender3d** only guarantees correct behaviour with the Dockerfile versions. — [README](https://github.com/grebtsew/FloorplanToBlender3d)

### Inferences
- **Version pinning:** pin `bpy==5.2.3` (as the target states), even though 5.2.4 and 5.3.0 now exist. Pin `ifcopenshell==0.9.0.post1` and `ezdxf==1.4.5`. All three install from PyPI on Python 3.13 in one venv, so the IFC and Blender steps can share a process.
- **Licensing pattern:** keep GPL tools (LibreDWG, bpy, Bonsai scripts) as separate CLI or pipeline stages. Ship only their outputs (GLB, SVG) to the three.js front end; the three.js app itself is unaffected by GPL.
- **Biggest practical risk:** CAD hygiene in the real Volt DWG matters more than tool choice. Examples are walls on mixed layers, exploded blocks, xrefs (the base-building core and shell are often xref'd) and unclosed linework. Budget a manual layer-mapping pass of about half a day, and a QA overlay comparing the extruded model with the plan in dxf-viewer.

### Gaps
- I could not confirm the exact licence string for io_import_dxf 0.9.10 or for FloorplanTransformation (the LICENSE file exists but was not read).
- I could not determine the exact IfcOpenShell licence for the ifcopenshell-python package itself from PyPI metadata (the `license` field is empty). LGPL-3 is the project's long-standing licence, but I did not verify it in this session.
