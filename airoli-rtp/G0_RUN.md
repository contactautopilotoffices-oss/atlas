# Reliable Tech Park: how the G0 outputs are made

Plans: `rtp6-a` (6th, Option A, Units 601 & 602), `rtp6-b` (6th, Option B), `rtp4-suite` (4th, fitted suite).
Plan files: `noida-skymark/cad/tenants/_rtp.json` (building) and `rtp6-a.json`, `rtp6-b.json`, `rtp4-suite.json`.
Every hand fix (closing line, label move, unit outline) is in those files with its reason.

Toolchain (not in the repo): `npm i @node-projects/acad-ts` in a folder (ACAD_TS), and a Python venv with
shapely, matplotlib, numpy, pyarrow and scipy (PY). The DWGs are untrusted: Python runs with `-I`, and the
DWGs are never copied into the repo.

```
cd noida-skymark
STEPS="inst rooms proof layout plan inventory legend egress walkways daylight g0_sheet"
ACAD_TS=... PY=... cad/run.sh --tenant rtp6-a --floor 6 --dwg "/Users/lohit/Downloads/20261118_6TH FLOOR.dwg" --out ../airoli-rtp/rtp6-a --steps "$STEPS"
# Option B reads the same DWG: copy rtp6-a/cad_data/flat.json.gz to rtp6-b/cad_data/ and run without --dwg
PY=... cad/run.sh --tenant rtp6-b --floor 6 --out ../airoli-rtp/rtp6-b --steps "$STEPS"
ACAD_TS=... PY=... cad/run.sh --tenant rtp4-suite --floor 4 --dwg "/Users/lohit/Downloads/20261118_4TH FLOO.dwg" --out ../airoli-rtp/rtp4-suite --steps "$STEPS"
```

Outputs per plan: `<plan>_G0.md` (the sign-off sheet), `<plan>_G0.png` (same, as an image; local only,
images are not committed), `<plan>_G0.json` (numbers), `<plan>_seats.csv`, `_legend.csv`, `_egress.csv`
(every seat's two nearest exits), `_walkways.csv`, `_daylight.csv`, `_layers.md`, `-floor<n>.layout.json`.
`cad_data/` (the flattened DWG) stays local.

Clusters (from `tools/clusters.py`, 19 Nov run): 6th cluster 3 = Option A, cluster 50 = Option B
(origin = A's + 303,211 mm, so plan coordinates match); 4th cluster 22 = fitted suite.
