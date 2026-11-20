# Third-floor CAD import

Source: `20261015_3RD FLOOR.dwg`, confirmed by the user as the third floor.
The separate old reference drawing is excluded. Original DWGs remain outside the
repository; the plan records source SHA-256, CAD labels and handles.

LibreDWG/DXF flattening preserves the displayed CAD linework. Native
`@node-projects/acad-ts` 3.9.0 reads the DWG for area analysis and chair counting.
The native reader samples curves before applying nested block transforms, so
mirrored door arcs retain their handedness. Drawing units are millimetres,
converted to metres. Layer-0 children inherit their containing insert layer.

The recorded west-arm window contains 27 primary and 12 supporting spaces.
Thirty have closed enclosures from original wall, facade, glass and door edges,
noded at 1 mm precision. MTEXT attachment points identify labels inside rooms.
These are CAD enclosure areas including drawn door swings, not certified carpet
areas. Displayed dimensions are overall enclosure bounds. No boundary is invented.
Other seating, reception/waiting, one locker bank and six passages need boundary
review. Their location markers do not claim measured floor areas.

The audit counts 773 physical chair blocks, allocated once each: 515 workstations,
160 training, 24 conference, 12 meeting, 18 cabin, 10 HR, 4 interview and 30 waiting
chairs. Human symbols and desk blocks are excluded. Training rooms 01–08 have
19, 21, 18, 18, 21, 21, 21 and 21 chairs respectively; the brief requests 20 each.
Counts reflect CAD chairs rather than silently replacing them with brief capacity.

`rtp3_requirements.json` transcribes the user-supplied requirement image and records
its SHA-256. It requests 340 workstations and reports 515 achieved; independently
counted process chairs reconcile to Corporate 36, Other 108, New Ramp 283 and Extra
WS 88. Desk footprint figures exclude circulation and are not room floor areas.
Shared third/sixth-floor room requirements retain their shared scope. CAD labels
show two HR rooms while the brief lists HR and Admin separately; neither is
renamed without confirmation.

The user-confirmed server room area is **122 sq ft**, taking precedence over the
CAD calculation. The original calculated area and geometry remain traceable.

The floor is registered as a plan-only entry in `building.json`. Existing fourth
and sixth floor data and the cinematic entry are preserved. The uploaded October
sixth-floor DWG is an older, different fit-out than the November source already in
Atlas; it does not replace the current 1,400-workstation plan.

Rebuild after preparing the isolated DXF flatten and installing acad-ts:

```sh
ACAD_TS=/path/to/workspace node airoli-rtp/tools/read_acad_ts.mjs source.dwg native.json
python -I airoli-rtp/tools/import_third_floor.py flat.json.gz source.dwg \
  airoli-rtp/demo/data/plan_rtp3.json provenance.json native.json
npm run test:rtp
```

The importer requires Shapely. Its analysis checks unique allocation of all 773
chairs and reconciliation of process counts with the supplied requirement sheet.
