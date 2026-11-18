# RTP 4th floor, fitted suite — layers and blocks

Source: `20261118_4TH FLOO.dwg` (read-only; not copied into git). Floor 4.

- DWG version **AC1032**, read directly with `@node-projects/acad-ts` (no converter needed).
- Units: **INSUNITS = 4 (mm)**. Not mm. Plan metres = inches x 0.0254. The drafter's notes are mm (LIFT 2025X2025) and feet-inches (passages, workstation sizes); both agree with the geometry at that scale (see `rtp4-suite_checks.json`).
- Plan window used (drawing inches): [5673000, 5625000, 5814500, 5739500]. The file also holds stray far-away entities (orphan dimensions, a 3D face set near (5.84e6, -6.68e6), a plain outline copy) that are not part of this plan.
- Paper-space sheets: none named.

## What the drawing contains (and does not)

| Item | In this DWG? | Evidence |
|---|---|---|
| Reflected ceiling plan | no | 0 2'x2' grid tiles (APO-MODULAR-GRID CEILING), 0 gypsum regions (APO- Gypsum celing); paper-space legend: none |
| Light fixtures | no | {} (blocks ; loose AE-LITE-CLNG circles / 2'x2' panel outlines where present) |
| AC grilles / diffusers | no | no block or drawn entity for AC grilles, diffusers or FCUs |
| Section / elevation / ceiling height | no | no section or elevation views, no level marks, no ceiling-height note (texts matched: CHARGEABLE AREA
     9905. SQ.FT) |
| Floor-to-floor height | stair note only | none: total rise per floor in mm / number of risers. Not a section. |
| Lockers | not drawn as such | no locker blocks or labels |

## Mapping (category -> layers)

- **walls**: `walls`, `WALL`, `WS-WALL-PRTN`, `duct`, `OUTER DIM`, `OUTER DIM 1`, `Column`
- **glass**: `WINDOW`, `STRUCTURAL GLAZING`, `WS-DOOR-GLAZ`
- **doors**: `DOOR`, `WS-DOOR-GLAZ`
- **columns**: `Column`, `Structural Column`, `column-hatch`
- **stairs**: `STAIR`, `RAILING`
- **lifts / core**: `ELE`, `duct`
- **workstations / furniture**: `WS-FURN`
- **annotation**: `WS-ANNO-LABL`, `WS-ANNO-TEXT`, `TEXT`, `Defpoints`, `DIM`, `HATCH`
- **room boundary only** (closes rooms, not built as walls): `RAILING`, `ELE`
- **chairs, workstations, tables, doors, lighting, WC/MEP**: by block name (table below), whatever layer the block sits on.

## Layers (52)

Counts are entities after exploding blocks (nested entities count on their own layer). 'In plan' = inside the plan window.

| Layer | Category | All entities | In plan | By type |
|---|---|---:|---:|---|
| `0` | unmapped (not used) | 565 | 469 | LwPolyline 224, INS 165, HATCH 80, Line 64, Arc 32 |
| `A.C.P. CLADDING` | unmapped (not used) | 20 | 10 | Spline 12, LwPolyline 8 |
| `A.C.P.CLADDING` | unmapped (not used) | 208 | 104 | LwPolyline 140, Arc 44, Line 24 |
| `CAR` | unmapped (not used) | 0 | 0 |  |
| `colno` | unmapped (not used) | 4 | 2 | AttributeEntity 4 |
| `Column` | walls | 568 | 282 | LwPolyline 484, Line 76, HATCH 4, INS 4 |
| `Column No.` | unmapped (not used) | 872 | 434 | TextEntity 440, LwPolyline 428, INS 4 |
| `column-hatch` | columns | 412 | 206 | HATCH 408, Solid 4 |
| `CONST` | unmapped (not used) | 5 | 0 | MText 5 |
| `Defpoints` | annotation | 0 | 0 |  |
| `DIM` | annotation | 0 | 0 |  |
| `DOOR` | doors | 578 | 292 | Line 489, INS 51, Ellipse 38 |
| `Door No.` | unmapped (not used) | 0 | 0 |  |
| `duct` | walls | 816 | 408 | Line 656, LwPolyline 148, Arc 12 |
| `ELE` | lifts / core | 276 | 138 | LwPolyline 132, Arc 60, Line 60, Spline 24 |
| `Expansion Joint` | unmapped (not used) | 40 | 20 | LwPolyline 30, Line 10 |
| `HAA` | unmapped (not used) | 0 | 0 |  |
| `HACH1` | unmapped (not used) | 0 | 0 |  |
| `HATCH` | annotation | 96 | 48 | Line 80, LwPolyline 16 |
| `HATCH-WALL` | unmapped (not used) | 1 | 0 | HATCH 1 |
| `HATCH1` | unmapped (not used) | 0 | 0 |  |
| `M.S.STEEL` | unmapped (not used) | 12 | 6 | LwPolyline 12 |
| `NTEXT` | unmapped (not used) | 0 | 0 |  |
| `OUTER DIM` | walls | 0 | 0 |  |
| `OUTER DIM 1` | walls | 165 | 80 | LwPolyline 67, Line 64, MText 17, Arc 14, HATCH 3 |
| `OUTER DIM2` | unmapped (not used) | 0 | 0 |  |
| `RAILING` | stairs | 196 | 96 | LwPolyline 86, Line 44, Arc 42, Spline 24 |
| `RCC  FINS` | unmapped (not used) | 64 | 32 | Line 64 |
| `section` | unmapped (not used) | 826 | 413 | Line 678, HATCH 116, Circle 32 |
| `sheet format` | unmapped (not used) | 0 | 0 |  |
| `STAIR` | stairs | 908 | 454 | Line 868, LwPolyline 40 |
| `STRUCTURAL ASSEMBLY` | unmapped (not used) | 240 | 120 | LwPolyline 160, Arc 56, Spline 16, Line 4, Ellipse 4 |
| `Structural Column` | columns | 136 | 68 | HATCH 68, Circle 68 |
| `STRUCTURAL GLAZING` | glass | 268 | 134 | Arc 124, LwPolyline 96, Spline 40, Line 8 |
| `SUNK LAYER` | unmapped (not used) | 0 | 0 |  |
| `TEXT` | annotation | 0 | 0 |  |
| `TITLE` | unmapped (not used) | 0 | 0 |  |
| `W.D. DIM.` | unmapped (not used) | 0 | 0 |  |
| `W.D.TEXT` | unmapped (not used) | 1162 | 581 | TextEntity 1142, MText 16, Arc 4 |
| `WALL` | walls | 0 | 0 |  |
| `wall hatch` | unmapped (not used) | 619 | 309 | HATCH 439, Line 180 |
| `walls` | walls | 3484 | 1731 | Line 3138, LwPolyline 254, Arc 68, HATCH 24 |
| `WDDIM` | unmapped (not used) | 93 | 46 | Line 56, LwPolyline 32, TextEntity 4, MText 1 |
| `WINDOW` | glass | 1092 | 546 | Line 652, LwPolyline 440 |
| `Window No.` | unmapped (not used) | 0 | 0 |  |
| `WS-ANNO-LABL` | annotation | 20 | 20 | MText 20 |
| `WS-ANNO-TEXT` | annotation | 0 | 0 |  |
| `WS-ANNO-TTLB` | unmapped (not used) | 0 | 0 |  |
| `WS-DOOR-GLAZ` | glass | 31 | 31 | INS 16, LwPolyline 15 |
| `WS-FURN` | workstations / furniture | 4197 | 4071 | Arc 1750, Line 1068, LwPolyline 815, Ellipse 360, INS 204 |
| `WS-WALL` | unmapped (not used) | 0 | 0 |  |
| `WS-WALL-PRTN` | walls | 41 | 41 | LwPolyline 40, HATCH 1 |

## Block names (16)

'Instances' = every insert, nested ones included; 'top' = inserted directly in model space; 'in plan' = instances whose drawn centre is in the plan window (one record each in inst.json, never merged). Anonymous `*U` names are resolved to their dynamic-block source where the DWG records it.

| Block | Category | Instances | Top | In plan | Layer(s) |
|---|---|---:|---:|---:|---|
| `A$C136922d8` | chairs (task chair, by_room) | 153 | 0 | 153 | 0 (153) |
| `STHGSERTHESRTHSDRTH` | tables (training desk (block, chair nested)) | 126 | 126 | 126 | WS-FURN (126) |
| `A$C9bee9767` | chairs (waiting / induction chair, by_room) | 30 | 30 | 30 | WS-FURN (30) |
| `A$C62789d74` | workstations (3'x2' workstation (block, chair nested)) | 27 | 27 | 27 | WS-FURN (27) |
| `D-750` | doors | 32 | 32 | 16 | DOOR (32) |
| `DOOR_SNGL` | doors | 16 | 16 | 16 | WS-DOOR-GLAZ (16) |
| `A$Cd2419d53` | chairs (meeting chair, by_room) | 12 | 12 | 12 | WS-FURN (12) |
| `A$Ce16c1cc4` | chairs (conference chair, meeting) | 12 | 12 | 12 | 0 (12) |
| `ASDFASDF` | by layer: doors | 19 | 19 | 10 | DOOR (19) |
| `A$Cba813c9e` | chairs (interview chair, by_room) | 4 | 0 | 4 | WS-FURN (4) |
| `Column` | by layer: walls | 4 | 0 | 2 | Column (4) |
| `TB` | unmapped (not counted) | 4 | 4 | 2 | Column No. (4) |
| `A$Caf36b24f` | by layer: workstations / furniture | 2 | 2 | 2 | WS-FURN (2) |
| `*U104` | chairs (receptionist chair, lounge) | 1 | 0 | 1 | WS-FURN (1) |
| `A$C99a14c5c` | by layer: workstations / furniture | 1 | 1 | 1 | WS-FURN (1) |
| `A$Ce8a8cead` | by layer: workstations / furniture | 1 | 0 | 1 | WS-FURN (1) |
