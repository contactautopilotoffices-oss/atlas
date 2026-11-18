# RTP 6th floor, Option A (Units 601 & 602) — layers and blocks

Source: `20261118_6TH FLOOR.dwg` (read-only; not copied into git). Floor 6.

- DWG version **AC1032**, read directly with `@node-projects/acad-ts` (no converter needed).
- Units: **INSUNITS = 4 (mm)**. Not mm. Plan metres = inches x 0.0254. The drafter's notes are mm (LIFT 2025X2025) and feet-inches (passages, workstation sizes); both agree with the geometry at that scale (see `rtp6-a_checks.json`).
- Plan window used (drawing inches): [5296000, 5845000, 5439500, 5968500]. The file also holds stray far-away entities (orphan dimensions, a 3D face set near (5.84e6, -6.68e6), a plain outline copy) that are not part of this plan.
- Paper-space sheets: PROPOSED INTERIOR LAYOUT FOR
6TH FLOOR 601 & 602  RELIABLE TECH PARK,AIROLI..

## What the drawing contains (and does not)

| Item | In this DWG? | Evidence |
|---|---|---|
| Reflected ceiling plan | no | 0 2'x2' grid tiles (APO-MODULAR-GRID CEILING), 0 gypsum regions (APO- Gypsum celing); paper-space legend: none |
| Light fixtures | no | {} (blocks ; loose AE-LITE-CLNG circles / 2'x2' panel outlines where present) |
| AC grilles / diffusers | yes | blocks/layers with entities: AC-Altr Duct |
| Section / elevation / ceiling height | no | no section or elevation views, no level marks, no ceiling-height note (texts matched: KITCHEN; Chargeable Area :- 35,488 Sqft.; KITCHEN) |
| Floor-to-floor height | stair note only | none: total rise per floor in mm / number of risers. Not a section. |
| Lockers | not drawn as such | no locker blocks or labels |

## Mapping (category -> layers)

- **walls**: `walls`, `WALL`, `PARTITION`, `PR-FULL HT`, `duct`, `ELE`, `OUTER DIM`, `Column`
- **glass**: `WINDOW`, `STRUCTURAL GLAZING`, `PR- GLASS`, `PR-LINE`
- **doors**: `DOOR`, `DR-GLASS`
- **columns**: `Column`, `Structural Column`, `column-hatch`
- **stairs**: `STAIR`, `RAILING`
- **lifts / core**: `ELE`, `duct`
- **WC / MEP fixtures**: `FIXT`, `SAN-FIX`
- **workstations / furniture**: `I-FURN`, `FURN-TOA`, `FURNITURE m`, `FURN`, `BREAKOUT`
- **planters**: `plants`
- **annotation**: `TEXT`, `Defpoints`, `HATCH`
- **room boundary only** (closes rooms, not built as walls): `RAILING`
- **chairs, workstations, tables, doors, lighting, WC/MEP**: by block name (table below), whatever layer the block sits on.

## Layers (58)

Counts are entities after exploding blocks (nested entities count on their own layer). 'In plan' = inside the plan window.

| Layer | Category | All entities | In plan | By type |
|---|---|---:|---:|---|
| `0` | unmapped (not used) | 3789 | 404 | Line 3189, Arc 343, LwPolyline 208, Ellipse 24, HATCH 24, TextEntity 1 |
| `2C50120` | unmapped (not used) | 0 | 0 |  |
| `A-DETL-LLIN` | unmapped (not used) | 0 | 0 |  |
| `A.C.P. CLADDING` | unmapped (not used) | 42 | 21 | Line 40, Arc 2 |
| `A.C.P.CLADDING` | unmapped (not used) | 266 | 133 | Line 224, Arc 42 |
| `A_Fixt` | unmapped (not used) | 46 | 0 | INS 46 |
| `AC-Altr Duct` | unmapped (not used) | 4 | 4 | INS 4 |
| `BREAKOUT` | workstations / furniture | 55 | 0 | Circle 16, LwPolyline 13, Line 13, INS 7, Arc 6 |
| `CH` | unmapped (not used) | 28 | 7 | LwPolyline 20, Arc 8 |
| `Chairs` | unmapped (not used) | 4 | 1 | INS 4 |
| `colno` | unmapped (not used) | 2 | 1 | AttributeEntity 2 |
| `Column` | walls | 280 | 140 | LwPolyline 244, Line 34, INS 2 |
| `column-hatch` | columns | 200 | 100 | HATCH 198, Solid 2 |
| `CTS` | unmapped (not used) | 0 | 0 |  |
| `Defpoints` | annotation | 0 | 0 |  |
| `DOOR` | doors | 787 | 338 | Line 448, LwPolyline 172, INS 63, Circle 43, Arc 43, Ellipse 18 |
| `DR-GLASS` | doors | 43 | 18 | INS 43 |
| `duct` | walls | 506 | 253 | Line 502, Arc 4 |
| `ELE` | walls | 140 | 68 | Line 83, Arc 53, Spline 4 |
| `Expansion Joint` | unmapped (not used) | 6 | 3 | Line 6 |
| `FIXT` | WC / MEP fixtures | 1664 | 704 | Ellipse 1612, INS 52 |
| `FURN` | workstations / furniture | 47 | 19 | Line 27, Arc 18, LwPolyline 2 |
| `FURN-TOA` | workstations / furniture | 1758 | 736 | Line 966, LwPolyline 694, INS 82, Circle 16 |
| `FURNITURE` | unmapped (not used) | 46 | 0 | INS 46 |
| `FURNITURE m` | workstations / furniture | 2758 | 954 | Arc 1480, Line 1278 |
| `G-ANNO-TTLB` | unmapped (not used) | 0 | 0 |  |
| `HATCH` | annotation | 62 | 31 | Line 54, Spline 8 |
| `HATCH-WALL` | unmapped (not used) | 1 | 0 | HATCH 1 |
| `I FURN` | unmapped (not used) | 0 | 0 |  |
| `I-FURN` | workstations / furniture | 49747 | 22940 | Line 26539, LwPolyline 13735, Ellipse 5336, Spline 1608, INS 1539, Arc 984, HATCH 3, Circle 2, DIM 1 |
| `I-FURN-PNLS` | unmapped (not used) | 48 | 24 | Line 48 |
| `LOUNGE AREA SEATING` | unmapped (not used) | 0 | 0 |  |
| `OUTER DIM` | walls | 375 | 189 | Line 215, LwPolyline 88, INS 72 |
| `PARTITION` | walls | 86 | 37 | LwPolyline 80, Line 6 |
| `plants` | planters | 3620 | 1810 | Line 3610, INS 10 |
| `PR- GLASS` | glass | 38 | 22 | LwPolyline 21, INS 13, Line 4 |
| `PR-ALU SECTION` | unmapped (not used) | 1378 | 428 | Line 1170, Spline 156, INS 26, LwPolyline 26 |
| `PR-FULL HT` | walls | 144 | 48 | INS 72, LwPolyline 72 |
| `PR-HATCH` | unmapped (not used) | 72 | 41 | HATCH 72 |
| `PR-LINE` | glass | 13 | 7 | LwPolyline 13 |
| `RAILING` | stairs | 165 | 82 | Line 123, Arc 38, Spline 4 |
| `RCC  FINS` | unmapped (not used) | 28 | 14 | Line 28 |
| `SAN-FIX` | WC / MEP fixtures | 28 | 9 | INS 28 |
| `section` | unmapped (not used) | 1321 | 661 | Line 1321 |
| `STAIR` | stairs | 490 | 245 | Line 490 |
| `STRUCTURAL ASSEMBLY` | unmapped (not used) | 218 | 109 | Line 138, Arc 76, Spline 4 |
| `Structural Column` | columns | 468 | 234 | Line 444, Circle 24 |
| `STRUCTURAL GLAZING` | glass | 152 | 76 | Arc 106, Line 32, Spline 14 |
| `TEXT` | annotation | 86 | 38 | MText 86 |
| `TREES` | unmapped (not used) | 0 | 0 |  |
| `W.D.TEXT` | unmapped (not used) | 141 | 73 | TextEntity 133, Line 8 |
| `WALL` | walls | 78 | 28 | MText 50, LwPolyline 28 |
| `wall hatch` | unmapped (not used) | 10066 | 5064 | Line 10066 |
| `walls` | walls | 1779 | 882 | Line 1720, Arc 36, HATCH 23 |
| `WDDIM` | unmapped (not used) | 53 | 27 | Line 53 |
| `WINDOW` | glass | 433 | 217 | Line 432, Arc 1 |
| `Workstation` | unmapped (not used) | 0 | 0 |  |
| `WS CHAIR` | unmapped (not used) | 5438 | 2126 | LwPolyline 5272, INS 166 |

## Block names (36)

'Instances' = every insert, nested ones included; 'top' = inserted directly in model space; 'in plan' = instances whose drawn centre is in the plan window (one record each in inst.json, never merged). Anonymous `*U` names are resolved to their dynamic-block source where the DWG records it.

| Block | Category | Instances | Top | In plan | Layer(s) |
|---|---|---:|---:|---:|---|
| `WS CHAIR` | chairs (WS chair, by_room) | 1318 | 1213 | 511 | I-FURN (1152), WS CHAIR (166) |
| `Cafeteria Chair 3 - Cafeteria Chair 3-468-Level 1` | chairs (cafe chair, cafe) | 116 | 0 | 56 | I-FURN (116) |
| `Cafeteria Chair 3 - Cafeteria Chair 3-469-Level 1` | chairs (cafe chair, cafe) | 116 | 0 | 56 | I-FURN (116) |
| `PARTITION` | by layer: walls | 72 | 72 | 41 | PR-FULL HT (72) |
| `A$C237876BF` | workstations (4'x2' workstation (block, chair nested)) | 72 | 72 | 36 | OUTER DIM (72) |
| `A$C225A0E04` | chairs (meeting chair, meeting) | 68 | 0 | 28 | FURN-TOA (68) |
| `D-750` | doors | 63 | 63 | 28 | DOOR (63) |
| `4` | by layer: workstations / furniture | 58 | 58 | 28 | I-FURN (58) |
| `Cafeteria Table Rectangular4_ 0 - Cafeteria Table Rectangular-467-Level 1` | by layer: workstations / furniture | 58 | 0 | 28 | I-FURN (58) |
| `456` | WC / MEP (wash basin) | 52 | 52 | 22 | FIXT (52) |
| `Glass Door` | doors | 43 | 43 | 18 | DR-GLASS (43) |
| `A$C5DA27531` | WC / MEP (urinal) | 28 | 28 | 9 | SAN-FIX (28) |
| `Sofa Two Seater - Sofa Two Seater_1-102-Level 1` | chairs (2-seat sofa, lounge, 2 places) | 18 | 18 | 9 | I-FURN (18) |
| `GLASS PATCH` | unmapped (not counted) | 26 | 0 | 8 | PR-ALU SECTION (26) |
| `GLASS PARTITION` | by layer: glass | 13 | 13 | 7 | PR- GLASS (13) |
| `Corner Table - Corner Table 1_ 6_ X 1_ 6_ X 1_ 4__1-208-Level 1` | by layer: workstations / furniture | 12 | 12 | 6 | I-FURN (12) |
| `A$C39337867` | planters | 10 | 10 | 5 | plants (10) |
| `U7` | unmapped (not counted) | 4 | 4 | 4 | AC-Altr Duct (4) |
| `CIRCLE 4 SEATER` | by layer: workstations / furniture | 4 | 4 | 2 | FURN-TOA (4) |
| `WS 1050 X 600` | workstations (1050x600 workstation (block, chair nested)) | 2 | 2 | 2 | I-FURN (2) |
| `1500 X 750` | by layer: workstations / furniture | 4 | 4 | 1 | FURN-TOA (4) |
| `Ch` | chairs (receptionist chair, lounge) | 4 | 0 | 1 | Chairs (4) |
| `A$C4C3625EB` | by layer: workstations / furniture | 2 | 2 | 1 | FURN-TOA (2) |
| `Column` | by layer: walls | 2 | 2 | 1 | Column (2) |
| `Reception Table - Reception Table 6_ 0-442-Level 1` | by layer: workstations / furniture | 2 | 0 | 1 | FURN-TOA (2) |
| `concealed flush valve` | unmapped (not counted) | 46 | 0 | 0 | A_Fixt (46) |
| `wc` | WC / MEP (wc) | 46 | 46 | 0 | FURNITURE (46) |
| `bloque1` | by layer: workstations / furniture | 6 | 6 | 0 | BREAKOUT (6) |
| `gfg g` | by layer: workstations / furniture | 3 | 3 | 0 | I-FURN (3) |
| `A$C52DD72D6` | by layer: workstations / furniture | 1 | 1 | 0 | FURN-TOA (1) |
| `AR-FURN-SNOOKER` | by layer: workstations / furniture | 1 | 1 | 0 | BREAKOUT (1) |
| `R` | by layer: workstations / furniture | 1 | 0 | 0 | FURN-TOA (1) |
| `SD` | by layer: workstations / furniture | 1 | 1 | 0 | I-FURN (1) |
| `dfs` | by layer: workstations / furniture | 1 | 1 | 0 | I-FURN (1) |
| `double door` | doors | 1 | 1 | 0 | I-FURN (1) |
| `dsf` | by layer: workstations / furniture | 1 | 1 | 0 | I-FURN (1) |
