# RTP 603/604 semantic interior — implementation handoff

The editable scene and web model were rebuilt from a frozen snapshot in `source/`. Source CAD files were not modified. Geometry remains the FreeCAD tessellation, transformed to the existing rtp_local frame.

## Delivered assets

- `rtp6c_603_604_review.blend`: 1,240 architecture meshes, plus the previously CAD-matched 1,408 chairs and 1,057 desks. Materials and the separate softbox light rig are visualization assumptions.
- `web/rtp6c_review.glb`: 4.77 MB, 63 mesh primitives, 73,836 triangles. All primitives retain `_ELEMENT`; 682 stable element IDs are mapped in `web/manifest.json`. This export is uncompressed glTF 2.0 and already below the 15 MB budget.
- `web/furniture.json`: retained chair/desk positions, orientations, IDs and alignment errors. The experience renders these as lightweight instanced visual proxies without adding seats.
- `captures/presentation/interior_axon.png`, `interior_header_detail.png`: Cycles render rig and neutral assumed presentation finishes; markers omitted, architecture retained.
- `tools/web_asset_validation.json`: binary GLB checks and source-hash verification. The actual vendored three.js GLTFLoader also successfully parses all 63 meshes and all element attributes. Browser rendering is checked through the experience separately.

## Geometry vs design confidence

The frozen CAD verification contains 5,589 passing checks and zero geometry failures. This proves conformance to its specification, not that default heights, headers, finishes or widths are architect-approved. D006 and D009 now carry CAD-sourced opening/frame width 0.750 m, clear width 0.650 m and leaf width 0.681 m. Their stale default-width markers were removed. Thirteen other doors have source-derived default/unresolved dimension flags. Actual geometry is never hidden in presentation mode; only markers and diagnostic colors change. Unknown walls remain documented as unsettled.

The rebuilt scene still matches semantic wall/column plan boxes within 1.0 mm (540 checked; curtain-wall mullions excluded from that comparison).

## Door header audit

`tools/door_coverage_audit.json` checks each of the 97 doors against the frozen mesh. All 76 expected headers are present, including POP headers for D006 and D009. The other 21 doors specify `none_open_above` (intentional cubicle cases). There are zero expected-header mismatches. All 97 expected frames are present. Twenty-one solid timber doors combine their frame and leaf in a single material mesh; connected-component inspection identifies the frame rather than falsely classifying these as missing. Thirty-two glazed frames continue above the leaf into the transom, so frame existence is checked against a minimum head extent rather than an exact top-at-head assumption. There are zero expected frame or header mismatches. No header/frame geometry was added manually.

## Experience integration

`experience/js/xp/interior.js` exports `loadSemanticInterior(layout)` and loads the actual GLB rather than rebuilding approximate architecture from the old layout. The GLB is already Y-up `(east, height-above-floor, -north)`; the loader adds only the manifest floor elevation (22.2 m).

Runtime controls are exposed on the returned group's `userData`:

- `setReviewMode(boolean)`: diagnostic markers/colors on or off; never removes architectural geometry.
- `setCeiling(boolean)`: false-ceiling visibility for cutaway/reveal.
- `manifest`, `ceilingMeshes`, `reviewMarkers`, `furnitureCounts`, `source`, `status`.

The parent implementation owns camera choreography, labels and UI controls.

## Reproducibility

Run Blender headless using `tools/build_review.py -- source interior-semantic`, then `tools/export_web.py` against that same frozen snapshot. Restore CAD-matched furniture with `tools/finish_presentation.py` from the prior furniture scene; it also writes the light web instances. Presentation rendering uses `tools/render_presentation.py`. `tools/repair_missing_images.py` replaces one missing inherited screen image with a neutral material, documenting that substitution instead of shipping a magenta/missing texture.

Rendering required running installed Blender outside the execution sandbox because its background initialization crashed inside the sandbox. No network keys or external services were used.

## Late provenance correction

The current CAD hashes matched the frozen snapshot throughout; the earlier D006/D009 warning text was hardcoded stale metadata. Review conditions and reasons are now derived from source width fields. The 21-frame concern was a material-group counting error, not missing architecture. `audit_door_parts.py` checks actual mesh connected components. Presentation architecture and renders did not change, so film image hardlinks were left untouched.
