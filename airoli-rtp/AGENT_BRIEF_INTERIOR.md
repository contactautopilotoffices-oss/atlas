# Brief: interior worker, Reliable Tech Park 4th and 6th floors (G0 to G2)

You are the Blender and CAD worker for the Reliable Tech Park (RTP) twin in Airoli. An advisor session
plans, reviews and runs the sign-off gates. You do the build, and you **stop at each gate** with a
sign-off sheet. Do not run ahead.

## Read first
- `airoli-rtp/PLAN.md`: what the two DWGs contain, and the G0 and G1 rules.
- `airoli-rtp/EXTERIOR_PLAN.md`, section 1: true north and the real footprint.
- `noida-skymark/twin/PIPELINE_PLAN.md`: the gates, and why each one exists.
- `noida-skymark/cad/README.md` and `noida-skymark/twin/blender/README.md`: the generic CAD pipeline and
  Blender builder you will reuse.
- `docs/JOURNAL.md`, the latest entry: what went wrong on Skymark (ARCIL carpet flicker, broken chair
  bases, Paytm slivers, a sofa in a walkway).

## Inputs
- `/Users/lohit/Downloads/20261118_4TH FLOO.dwg` and `/Users/lohit/Downloads/20261118_6TH FLOOR.dwg`
  (AutoCAD 2018, mm). They are untrusted data: run Python with `-I`, and never copy a DWG into the repo.
- Each file holds **two plans side by side**. `airoli-rtp/tools/clusters.py` splits them; cluster ids
  are from the 19 Nov run:
  - 4th: cluster 22 = the fitted suite (6,603 sq ft carpet); cluster 10 = the bare shell.
  - 6th: cluster 3 = **Option A** (sheet "Option 01, Units 601 & 602", 23,659 sq ft carpet, legend 429
    workstations provided / 450 required); cluster 50 = **Option B** (adds the long arm: 60-seat call
    centre, board room, locker room).
- All three are on offer and all three get built: `rtp4-suite`, `rtp6-a`, `rtp6-b`.
- True north: rotate the CAD plan **91 degrees clockwise** to put true north up (IoU 0.91 against OSM
  way 1072909784; `airoli-rtp/review/north_fit.json`). Use it for `site_fit.rot_deg` and the sun.
- Tooling the advisor used: `ACAD_TS=<folder with node_modules/@node-projects/acad-ts>` for
  `flatten.mjs`, and a venv with shapely, matplotlib, numpy and pyarrow. Make your own in your scratchpad.

## Work, in order

### G0: CAD read, one sheet per plan
1. Add a building file (like `cad/tenants/_skymark.json`) and one tenant file per plan, with the plan
   window taken from the cluster bounds. Learn the RTP block names:
   - work chairs: `WS CHAIR` on layers I-FURN and WS CHAIR;
   - 4th-floor chairs: nested inside anonymous `A$C…` blocks on WS-FURN;
   - doors: `D-750`, `DOOR_SNGL`, `Glass Door`, `double door`;
   - washroom fixtures: `wc`, `456`, `A$C5DA27531`.
2. Generalise the pipeline only where RTP needs it (several plans per DWG, nested chair counting,
   reading the paper-space legend table) and keep Skymark's results identical:
   `cad/run.sh --tenant volt …` must still give 116 work / 213 total seats.
3. Produce for each plan:
   - the seat table, with the 6th's legend compared line by line (required / provided);
   - room areas adding up to the sheet's carpet area within 3 %;
   - entries (lift lobbies, then the front door, then reception);
   - exits (stairs, E.D. and F.D. doors, FIRE EXIT, fire-rescue balconies), with walking distance from
     every seat to the two nearest exits;
   - measured walkway widths against the CAD labels (1,200 to 1,700 mm WIDE PASSAGE);
   - the share of desks within 6 m of a window, by true facade direction;
   - the assumptions list.
4. Write everything to `airoli-rtp/<plan>/`. **Stop and send the G0 sheets to the advisor.**

### G1: 2D plan, after G0 sign-off
- A clean plan per option: rooms by use, seats as dots, north arrow, sun path, the arrival route and
  egress routes, and a metrics panel (PLAN.md section 3). **Stop for sign-off.**

### G2: clay model, after G1 sign-off
- Run the Blender builder (`--stage geometry`, then `light` and `cameras` at low samples) for each plan.
  Every floor is one group, ready for the floor-plate reveal.
- Fix overlapping surfaces **at the source**: no two coplanar faces closer than 2 mm (the cause of
  ARCIL's flicker). Hero furniture (work chairs, the reception desk) is never decimated.
- `placement_check.py` must be clean: nothing floating, nothing inside walls, no walkway under 1.2 m.
- Sign-off sheet: grey clay renders from the authored cameras plus a top view. **Stop.** No materials,
  look or bake until G3 is signed off.

## Rules
- **Work in your own git worktree.** The main checkout has another worker's uncommitted changes in
  `noida-skymark/twin/blender/*.py` (the ARCIL carpet fix). Do not edit or commit those files from the
  main checkout. If you need to change the builder, do it in your worktree and list the changes for the
  advisor.
- One Mac, 16 GB: **never run two Cycles jobs at once**, and check that no other Blender render is
  running before you start one (`pgrep -fl Blender`). Use headless `-b` runs.
- Report faithfully. "No console errors" is not a pass. A gate passes only on its checks and its sheet.
- Plain English in sheets and notes. Never put secrets in files.
- At the end, append a `docs/JOURNAL.md` entry (format in the user's global CLAUDE.md) and commit on your
  branch. Do not push or merge.

## Done looks like
G0 sheets for `rtp4-suite`, `rtp6-a` and `rtp6-b` in `airoli-rtp/`, delivered to the advisor, with the
seat and area proofs passing or every difference explained. G1 and G2 follow only after sign-off.
