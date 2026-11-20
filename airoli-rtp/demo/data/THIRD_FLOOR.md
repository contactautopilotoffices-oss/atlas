# Third-floor CAD import

Source: `20261015_3RD FLOOR.dwg`, supplied by the user, who confirmed this is the
third floor. The drawing itself also says “RELIABLE TECH PARK” and “3RD FLOOR PLAN”.
Its separate reference drawing labelled “3RD,4TH,5TH & 9TH FLOOR PLAN” is excluded.

The public plan is `plan_rtp3.json`. The original DWG stays outside the repository;
its SHA-256 and drawing handles are recorded in the plan for traceability.
LibreDWG converts to DXF, the existing isolated `flatten.py` preserves block
transforms, and `tools/import_third_floor.py` builds the web data. The header uses
millimetres; coordinates are converted to metres. Nested layer-0 entities inherit
their containing insert's layer, preserving the doors and furniture correctly.

The west-arm fit-out window is explicitly recorded. It contains 27 primary spaces
and 12 supporting spaces. Twenty labels have an unambiguous enclosure made from
the drawing's existing wall, glass and door edges. Their areas include door swings
and their displayed dimensions are overall enclosure bounds. No missing boundary
is closed by hand. Other spaces use location markers with unverified dimensions
and area. Repeated cabin/conference labels retain distinct CAD handles.

Seat figures come only from the drawing's text, including New Ramp 283, Others 108,
Growth 88, Corporate 36 and the marked meeting/conference capacities. No complete
seat audit or third-floor client requirement sheet was supplied, so the floor
total and unmarked room capacities remain unknown. They are never presented as 0.
The tab retains the user-requested “Client requirement” label, matching the other
floors; this label does not turn the CAD figures into a separate verified brief.

The third floor is registered with a plan-only field in `building.json`. It does
not add a tenant manifest or claim a new 3D interior. Existing fourth/sixth-floor
data, cinematic entry and CAD handoff remain in place.

Rebuild after converting and flattening the supplied DWG:

```sh
python -I airoli-rtp/tools/import_third_floor.py flat.json.gz source.dwg \
  airoli-rtp/demo/data/plan_rtp3.json provenance.json
npm run test:rtp
```
