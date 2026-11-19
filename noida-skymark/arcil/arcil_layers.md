# ARCIL — layers and blocks

Source: `20260923_SKY MARK NOIDA_2nd floor_ARCIL.dwg` (read-only; not copied into git). Floor 2.

- DWG version **AC1032**, read directly with `@node-projects/acad-ts` (no converter needed).
- Units: **INSUNITS = 1 (inch)**. Not mm. Plan metres = inches x 0.0254. The drafter's notes are mm (LIFT 2025X2025) and feet-inches (passages, workstation sizes); both agree with the geometry at that scale (see `arcil_checks.json`).
- Plan window used (drawing inches): [2921050, -3343450, 2923800, -3342150]. The file also holds stray far-away entities (orphan dimensions, a 3D face set near (5.84e6, -6.68e6), a plain outline copy) that are not part of this plan.
- Paper-space sheets: PROPOSED LAYOUT FOR ARCIL, RCP LAYOUT FOR ARCIL, SKY_MARK_NOIDA_2ND
FLOOR_LAYOUT.

## What the drawing contains (and does not)

| Item | In this DWG? | Evidence |
|---|---|---|
| Reflected ceiling plan | yes, on the same plan copy | 971 2'x2' grid tiles (APO-MODULAR-GRID CEILING), 56 gypsum regions (APO- Gypsum celing); paper-space legend: RCP LAYOUT FOR ARCIL; GYPSUM CEILING; 2' X 2' GRID CEILING TILE; 2' X 2' PANEL LIGHT; CIRCULAR DOWNLIGHT |
| Light fixtures | yes | {'panel600': 85, 'downlight': 110, 'linear': 1} (blocks BLCK_LITE_EW WALL, 2' X 2' LED LIGHT, LINEAR LIGHT; loose AE-LITE-CLNG circles / 2'x2' panel outlines where present) |
| AC grilles / diffusers | no | no block or drawn entity for AC grilles, diffusers or FCUs; layers `AC Grill`, `AC-RA-GRILLE` exist but are empty (0 entities) |
| Section / elevation / ceiling height | no | no section or elevation views, no level marks, no ceiling-height note |
| Floor-to-floor height | stair note only | RISER-3900/ 25, RISER-3900/24: total rise per floor in mm / number of risers. Not a section. |
| Lockers | yes | unit rectangles on APO-AKJNFAFS, tiers only in the labels |

## Mapping (category -> layers)

- **walls**: `AR WALL`, `AR-WALL`, `WS-WALL`, `WS-WALL-PRTN`, `L-WALL`, `APO- BLOCK WALL`, `I- Partition- Jaali Stall`, `WALL HATCH`, `ELE-DEEP`, `e4`, `e7`
- **glass**: `WS-GLAZ-GLAS`, `STR. GLAZING`, `AR-WINDOW`, `AR-WINCILL`
- **doors**: `WS-DOOR`, `WS-DOOR-FIRE`, `WS-DOOR-GLAZ`, `DOOR`, `I- Door`, `TEXT DW`
- **columns**: `column`, `RCC COLUMN`, `COL`, `col hat`
- **stairs**: `STAIR`, `RAILING`, `TEXT LVL`, `HIDDEN LINE`
- **lifts / core**: `AR-TEXT`, `ELE-DEEP`, `STONE`, `HATCH`
- **ceiling**: `APO-MODULAR-GRID CEILING`, `APO- Gypsum celing`, `ACP LAYER`, `A-FLDROP`
- **lighting**: `CD-2' x 2' led light`, `AE-LITE-CLNG`, `WS-FIXT`, `AR-LIGHT`
- **storage / lockers**: `APO-AKJNFAFS`
- **WC / MEP fixtures**: `MEP- Plumb- Fixtures`
- **workstations / furniture**: `WS-FURN`, `APO- FURN`, `I- Furn- Modular Offsite`, `PDF_Furniture`, `PDF_XD-Furniture`, `APO- FURDIM`
- **planters**: `WS-TREE`, `APO- PLANTERS`
- **annotation**: `WS-ANNO-LABL`, `WS-ANNO-TEXT`, `WS-ANNO-DIMS`, `TEXT`, `AR-TEXT`, `Defpoints`, `Dim-INT`, `LEADER`, `APO- DIMLINE`, `APO- FLOORING`, `FORMAT-A1`, `FORMAT-A1-TEXT`, `CD-Format`, `prodima`, `hiiden layer`, `HATCH`, `PDF_XD-Hatch`
- **room boundary only** (closes rooms, not built as walls): `RAILING`, `AR-WINCILL`, `A-FLDROP`
- Note: A-FLDROP (4 double polylines) is drawn where the 16 PAX conference room meets the server/UPS rooms; it is treated as a partition for room splitting.
- **chairs, workstations, tables, doors, lighting, WC/MEP**: by block name (table below), whatever layer the block sits on.

## Layers (127)

Counts are entities after exploding blocks (nested entities count on their own layer). 'In plan' = inside the plan window.

| Layer | Category | All entities | In plan | By type |
|---|---|---:|---:|---|
| `0` | unmapped (not used) | 23855 | 23029 | Line 22139, LwPolyline 417, HATCH 275, Arc 266, Face3D 260, INS 251, Ellipse 138, Circle 77, Polyline3D 13, Spline 11, MText 8 |
| `0- Anno- Detail` | unmapped (not used) | 0 | 0 |  |
| `0- Anno- Label` | unmapped (not used) | 0 | 0 |  |
| `2` | unmapped (not used) | 0 | 0 |  |
| `A MARK LINE` | unmapped (not used) | 0 | 0 |  |
| `A MARK LINE2` | unmapped (not used) | 0 | 0 |  |
| `A- Door Partition Tagging` | unmapped (not used) | 0 | 0 |  |
| `A-FLDROP` | ceiling | 4 | 4 | LwPolyline 4 |
| `A-FURNTOI` | unmapped (not used) | 0 | 0 |  |
| `A-WIN` | unmapped (not used) | 0 | 0 |  |
| `AC Grill` | unmapped (not used) | 0 | 0 |  |
| `AC-RA-GRILLE` | unmapped (not used) | 0 | 0 |  |
| `ACP LAYER` | ceiling | 6 | 4 | LwPolyline 6 |
| `AE-LITE` | unmapped (not used) | 0 | 0 |  |
| `AE-LITE-CLNG` | lighting | 220 | 220 | Line 110, Circle 110 |
| `APO- BLOCK WALL` | walls | 7 | 0 | LwPolyline 6, HATCH 1 |
| `APO- DIM` | unmapped (not used) | 0 | 0 |  |
| `APO- DIMLINE` | annotation | 233 | 0 | DIM 233 |
| `APO- FLOORING` | annotation | 75 | 0 | DIM 75 |
| `APO- FORMAT` | unmapped (not used) | 0 | 0 |  |
| `APO- FURDIM` | workstations / furniture | 194 | 1 | DIM 193, LwPolyline 1 |
| `APO- FURN` | workstations / furniture | 360 | 344 | INS 327, LwPolyline 19, MText 10, Line 3, Circle 1 |
| `APO- Gypsum celing` | ceiling | 89 | 87 | LwPolyline 73, HATCH 14, DIM 2 |
| `APO- PLANTERS` | planters | 46 | 46 | INS 45, LwPolyline 1 |
| `APO-AKJNFAFS` | storage / lockers | 36 | 35 | LwPolyline 36 |
| `APO-MODULAR-GRID CEILING` | ceiling | 1956 | 1956 | INS 979, LwPolyline 977 |
| `AR WALL` | walls | 196 | 160 | Line 173, LwPolyline 23 |
| `AR-DIM` | unmapped (not used) | 0 | 0 |  |
| `AR-DOOR` | unmapped (not used) | 0 | 0 |  |
| `AR-LIGHT` | lighting | 0 | 0 |  |
| `AR-TEXT` | lifts / core | 14 | 8 | MText 8, LwPolyline 4, TextEntity 2 |
| `AR-WALL` | walls | 134 | 105 | Line 131, LwPolyline 3 |
| `AR-WINCILL` | glass | 79 | 69 | Line 65, LwPolyline 12, INS 2 |
| `AR-WINDOW` | glass | 33 | 31 | Line 29, LwPolyline 4 |
| `AR_025_TEXT` | unmapped (not used) | 6 | 0 | LwPolyline 6 |
| `AR_DIMENSION` | unmapped (not used) | 0 | 0 |  |
| `C- Furn- Door` | unmapped (not used) | 0 | 0 |  |
| `C- Furn- Modular` | unmapped (not used) | 0 | 0 |  |
| `C.L.` | unmapped (not used) | 0 | 0 |  |
| `CD-2' x 2' led light` | lighting | 343 | 258 | LwPolyline 173, INS 85, HATCH 85 |
| `CD-Format` | annotation | 0 | 0 |  |
| `CD-MODULAR-GRID CEILING` | unmapped (not used) | 0 | 0 |  |
| `COL` | columns | 1 | 1 | LwPolyline 1 |
| `col hat` | columns | 52 | 38 | HATCH 52 |
| `column` | columns | 48 | 35 | LwPolyline 48 |
| `Defpoints` | annotation | 2 | 2 | LwPolyline 2 |
| `DETAIL` | unmapped (not used) | 0 | 0 |  |
| `DETAIL MARK` | unmapped (not used) | 0 | 0 |  |
| `DIM GRID` | unmapped (not used) | 0 | 0 |  |
| `DIM INT` | unmapped (not used) | 0 | 0 |  |
| `Dim-INT` | annotation | 1 | 1 | Line 1 |
| `dim. grid` | unmapped (not used) | 0 | 0 |  |
| `DOOR` | doors | 1 | 1 | INS 1 |
| `Drawing` | unmapped (not used) | 0 | 0 |  |
| `E-EXIT LIGHT` | unmapped (not used) | 9 | 0 | INS 9 |
| `e4` | walls | 4 | 4 | Line 4 |
| `e7` | walls | 18 | 12 | Line 12, LwPolyline 6 |
| `ELE DEEP` | unmapped (not used) | 0 | 0 |  |
| `ELE-DEEP` | walls | 11 | 6 | Line 8, LwPolyline 3 |
| `Elec- Appliance` | unmapped (not used) | 0 | 0 |  |
| `FIXTURE` | unmapped (not used) | 0 | 0 |  |
| `format logo` | unmapped (not used) | 0 | 0 |  |
| `FORMAT-A1` | annotation | 0 | 0 |  |
| `FORMAT-A1-TEXT` | annotation | 0 | 0 |  |
| `FORMAT-OUTER` | unmapped (not used) | 0 | 0 |  |
| `GRID TEXT` | unmapped (not used) | 0 | 0 |  |
| `HATCH` | lifts / core | 10 | 10 | LwPolyline 10 |
| `HIDDEN LINE` | stairs | 32 | 18 | Line 32 |
| `hiiden layer` | annotation | 1 | 1 | LwPolyline 1 |
| `I- Ceiling- Profile` | unmapped (not used) | 0 | 0 |  |
| `I- Ceiling- Text` | unmapped (not used) | 0 | 0 |  |
| `I- Door` | doors | 21 | 8 | LwPolyline 10, INS 9, Line 2 |
| `I- Flooring- Dim` | unmapped (not used) | 0 | 0 |  |
| `I- Flooring-Text` | unmapped (not used) | 1 | 0 | MText 1 |
| `I- Furn- Modular Offsite` | workstations / furniture | 0 | 0 |  |
| `I- Partition- Glass` | unmapped (not used) | 8 | 0 | INS 8 |
| `I- Partition- Gypsum & Dry Wall` | unmapped (not used) | 32 | 0 | INS 32 |
| `I- Partition- Jaali Stall` | walls | 21 | 5 | INS 16, Arc 4, HATCH 1 |
| `I-Anno-Text-L` | unmapped (not used) | 0 | 0 |  |
| `L-WALL` | walls | 4 | 2 | Line 4 |
| `L.HT.WALL` | unmapped (not used) | 0 | 0 |  |
| `Layer1` | unmapped (not used) | 0 | 0 |  |
| `LEADER` | annotation | 5 | 3 | LwPolyline 5 |
| `LEGEND TABLE` | unmapped (not used) | 0 | 0 |  |
| `LEGEND TEXT` | unmapped (not used) | 0 | 0 |  |
| `LOW HT. WALL` | unmapped (not used) | 0 | 0 |  |
| `MEP- Plumb- Fixtures` | WC / MEP fixtures | 37 | 27 | INS 32, LwPolyline 5 |
| `MEP- Smoke- Detector Above Ceiling` | unmapped (not used) | 0 | 0 |  |
| `PDF4_0` | unmapped (not used) | 0 | 0 |  |
| `PDF_Furniture` | workstations / furniture | 216 | 216 | LwPolyline 126, Arc 90 |
| `PDF_Hatch` | unmapped (not used) | 0 | 0 |  |
| `PDF_TXTB` | unmapped (not used) | 0 | 0 |  |
| `PDF_XD-Dimension` | unmapped (not used) | 0 | 0 |  |
| `PDF_XD-Furniture` | workstations / furniture | 24 | 24 | LwPolyline 18, Arc 6 |
| `PDF_XD-Hatch` | annotation | 12 | 12 | LwPolyline 12 |
| `prodima` | annotation | 3 | 3 | Line 3 |
| `RAILING` | stairs | 35 | 25 | Line 35 |
| `RCC COLUMN` | columns | 6 | 6 | LwPolyline 6 |
| `Remark- Text` | unmapped (not used) | 0 | 0 |  |
| `S- Plaster` | unmapped (not used) | 0 | 0 |  |
| `S- Wall- Brick` | unmapped (not used) | 20 | 0 | INS 20 |
| `STAIR` | stairs | 88 | 60 | Line 82, LwPolyline 6 |
| `STONE` | lifts / core | 6 | 4 | Line 5, LwPolyline 1 |
| `STR. GLAZING` | glass | 20 | 14 | Line 20 |
| `TEXT` | annotation | 4 | 3 | MText 4 |
| `TEXT DW` | doors | 42 | 39 | INS 14, Ellipse 14, AttributeEntity 14 |
| `TEXT LVL` | stairs | 3 | 3 | TextEntity 2, MText 1 |
| `WALL HATCH` | walls | 38 | 25 | HATCH 38 |
| `WIN` | unmapped (not used) | 17 | 0 | Line 17 |
| `WS-ANNO-DIMS` | annotation | 2 | 2 | LwPolyline 2 |
| `WS-ANNO-LABL` | annotation | 32 | 32 | MText 32 |
| `WS-ANNO-TEXT` | annotation | 0 | 0 |  |
| `WS-ANNO-TTLB` | unmapped (not used) | 0 | 0 |  |
| `WS-ANNO-VPRT` | unmapped (not used) | 0 | 0 |  |
| `WS-DOOR` | doors | 2 | 2 | INS 2 |
| `WS-DOOR-FIRE` | doors | 8 | 6 | INS 8 |
| `WS-DOOR-GLAZ` | doors | 38 | 26 | INS 37, LwPolyline 1 |
| `WS-FIXT` | lighting | 551 | 550 | Circle 220, INS 111, Line 110, HATCH 110 |
| `WS-FURN` | workstations / furniture | 7513 | 7414 | Arc 3570, Line 2362, LwPolyline 1365, Circle 133, HATCH 37, INS 20, Ellipse 7, Spline 7, TextEntity 6, DIM 4, Polyline3D 2 |
| `WS-GLAZ-GLAS` | glass | 49 | 25 | LwPolyline 49 |
| `WS-SANR-FIXT` | unmapped (not used) | 0 | 0 |  |
| `WS-TREE` | planters | 704 | 704 | Line 700, INS 4 |
| `WS-WALL` | walls | 46 | 40 | LwPolyline 42, INS 4 |
| `WS-WALL-PATT` | unmapped (not used) | 0 | 0 |  |
| `WS-WALL-PHRT` | unmapped (not used) | 0 | 0 |  |
| `WS-WALL-PRTN` | walls | 316 | 288 | HATCH 248, LwPolyline 68 |
| `Xref- Dwg` | unmapped (not used) | 0 | 0 |  |

## Block names (67)

'Instances' = every insert, nested ones included; 'top' = inserted directly in model space; 'in plan' = instances whose drawn centre is in the plan window (one record each in inst.json, never merged). Anonymous `*U` names are resolved to their dynamic-block source where the DWG records it.

| Block | Category | Instances | Top | In plan | Layer(s) |
|---|---|---:|---:|---:|---|
| `*U1139` | ceiling (2x2 grid tile array) | 364 | 0 | 364 | APO-MODULAR-GRID CEILING (364) |
| `*U1141` | ceiling (2x2 grid tile array) | 276 | 0 | 276 | APO-MODULAR-GRID CEILING (276) |
| `A$C136922d8` | chairs (task chair, work) | 239 | 0 | 239 | 0 (239) |
| `A$C62789d74` | workstations (3'x2' workstation) | 239 | 239 | 239 | APO- FURN (239) |
| `BLCK_LITE_EW WALL` | lighting (downlight) | 110 | 110 | 110 | WS-FIXT (110) |
| `*U1151` | ceiling (2x2 grid tile array) | 88 | 0 | 88 | APO-MODULAR-GRID CEILING (88) |
| `2' X 2' LED LIGHT` | lighting (panel600) | 85 | 85 | 85 | CD-2' x 2' led light (85) |
| `*U1252` | ceiling (2x2 grid tile array) | 63 | 0 | 63 | APO-MODULAR-GRID CEILING (63) |
| `A$C64875517` | planters | 45 | 45 | 45 | APO- PLANTERS (45) |
| `DOOR_SNGL` | doors | 47 | 47 | 33 | WS-DOOR-GLAZ (37), WS-DOOR-FIRE (8) |
| `*U1147` | ceiling (2x2 grid tile array) | 25 | 0 | 25 | APO-MODULAR-GRID CEILING (25) |
| `A$C92802071` | chairs (training chair, training) | 24 | 24 | 24 | APO- FURN (24) |
| `*U1157` | ceiling (2x2 grid tile array) | 21 | 0 | 21 | APO-MODULAR-GRID CEILING (21) |
| `*U1155` | ceiling (2x2 grid tile array) | 20 | 0 | 20 | APO-MODULAR-GRID CEILING (20) |
| `*U1243` | ceiling (2x2 grid tile array) | 20 | 0 | 20 | APO-MODULAR-GRID CEILING (20) |
| `*U1246` | ceiling (2x2 grid tile array) | 20 | 0 | 20 | APO-MODULAR-GRID CEILING (20) |
| `*U1250` | ceiling (2x2 grid tile array) | 20 | 0 | 20 | APO-MODULAR-GRID CEILING (20) |
| `FLS-WHT-5953PPSM PLAN` | WC / MEP (wc) | 20 | 20 | 20 | MEP- Plumb- Fixtures (20) |
| `A$Cb2a790fe` | chairs (conference chair, meeting) | 16 | 16 | 16 | APO- FURN (16) |
| `A$Cd2419d53` | chairs (meeting chair, meeting) | 16 | 16 | 16 | APO- FURN (16) |
| `DW` | doors (door tag) | 14 | 14 | 13 | TEXT DW (14) |
| `*U1144` | ceiling (2x2 grid tile array) | 12 | 0 | 12 | APO-MODULAR-GRID CEILING (12) |
| `*U1153` | ceiling (2x2 grid tile array) | 12 | 0 | 12 | APO-MODULAR-GRID CEILING (12) |
| `*U1240` | ceiling (2x2 grid tile array) | 12 | 0 | 12 | APO-MODULAR-GRID CEILING (12) |
| `*U1248` | ceiling (2x2 grid tile array) | 12 | 0 | 12 | APO-MODULAR-GRID CEILING (12) |
| `A$Ce658220c` | chairs (supervisor chair, work) | 10 | 0 | 10 | WS-FURN (10) |
| `WEGWG` | workstations (supervisor workstation) | 10 | 10 | 10 | APO- FURN (10) |
| `A$C445ca927` | chairs (cafe stool, cafe) | 6 | 6 | 6 | APO- FURN (6) |
| `A$Cc5b0ed80` | chairs (visitor chair, lounge) | 6 | 0 | 6 | 0 (6) |
| `CUBJ` | workstations (supervisor cubicle 5'x4'6") | 6 | 6 | 6 | APO- FURN (6) |
| `A$C4730a6c7` | planters | 5 | 5 | 5 | WS-TREE (4), APO- FURN (1) |
| `health fauscet 1` | WC / MEP (health faucet) | 5 | 5 | 5 | MEP- Plumb- Fixtures (5) |
| `A$Cba813c9e` | chairs (interview chair, meeting) | 4 | 4 | 4 | APO- FURN (4) |
| `ETHGESTGERTG` | by layer: walls | 4 | 4 | 4 | WS-WALL (4) |
| `A$Cd484c6a2` | by layer: workstations / furniture | 5 | 5 | 3 | WS-FURN (3), APO- FURN (2) |
| `A$C7e9a1dde` | by layer: workstations / furniture | 3 | 3 | 3 | APO- FURN (3) |
| `A$Cb4d34924` | tables (director desk) | 3 | 0 | 3 | 0 (3) |
| `A$Cee30255b` | chairs (director chair, work) | 3 | 0 | 3 | 0 (3) |
| `8' li` | by layer: glass | 2 | 2 | 2 | AR-WINCILL (2) |
| `URS-WHT-13253O PLAN` | WC / MEP (urinal) | 2 | 2 | 2 | MEP- Plumb- Fixtures (2) |
| `*U1140` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1142` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1145` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1148` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1152` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1154` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1156` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1158` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1241` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1244` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1247` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1249` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1251` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U1253` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `25 Stall Partition` | by layer: workstations / furniture | 1 | 1 | 1 | WS-FURN (1) |
| `A$C895ed9f2` | by layer: workstations / furniture | 1 | 0 | 1 | WS-FURN (1) |
| `A$C897f58da` | chairs (3-seat sofa, lounge, 3 places) | 1 | 1 | 1 | WS-FURN (1) |
| `A$C94a717aa` | by layer: workstations / furniture | 1 | 1 | 1 | WS-FURN (1) |
| `A$Ca354571c` | chairs (reception lounge chair, lounge) | 1 | 0 | 1 | WS-FURN (1) |
| `A$Cc2c953a5` | by layer: workstations / furniture | 1 | 1 | 1 | WS-FURN (1) |
| `A$Cd4197eec` | by layer: workstations / furniture | 1 | 0 | 1 | WS-FURN (1) |
| `Door` | doors | 1 | 1 | 1 | DOOR (1) |
| `LINEAR LIGHT` | lighting (linear) | 1 | 1 | 1 | WS-FIXT (1) |
| `` | unmapped (not counted) | 85 | 85 | 0 | I- Partition- Gypsum & Dry Wall (32), S- Wall- Brick (20) |
| `EXIT 3` | unmapped (not counted) | 8 | 8 | 0 | E-EXIT LIGHT (8) |
| `BASE FILE$0$rdg` | by layer: WC / MEP fixtures | 5 | 5 | 0 | MEP- Plumb- Fixtures (5) |
| `EXIT3` | unmapped (not counted) | 1 | 1 | 0 | E-EXIT LIGHT (1) |
