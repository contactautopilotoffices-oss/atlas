# Paytm — layers and blocks

Source: `20261105_SKY MARK NOIDA_1ST_PAYTM.dwg` (read-only; not copied into git). Floor 1.

- DWG version **AC1018**, read directly with `@node-projects/acad-ts` (no converter needed).
- Units: **INSUNITS = 1 (inch)**. Not mm. Plan metres = inches x 0.0254. The drafter's notes are mm (LIFT 2025X2025) and feet-inches (passages, workstation sizes); both agree with the geometry at that scale (see `paytm_checks.json`).
- Plan window used (drawing inches): [2997950, -3380250, 3000700, -3378900]. The file also holds stray far-away entities (orphan dimensions, a 3D face set near (5.84e6, -6.68e6), a plain outline copy) that are not part of this plan.
- Paper-space sheets: LINE LAYOUT, LINE LAYOUT FOR PAYTM- ENTITY 01 & 02, PROPOSED LAYOUT, PROPOSED LAYOUT FOR PAYTM- ENTITY 01 & 02, RCP LAYOUT FOR PAYTM- ENTITY 01 & 02.

## What the drawing contains (and does not)

| Item | In this DWG? | Evidence |
|---|---|---|
| Reflected ceiling plan | yes, on the same plan copy | 128 2'x2' grid tiles (APO-MODULAR-GRID CEILING), 58 gypsum regions (APO- Gypsum celing); paper-space legend: RCP LAYOUT FOR PAYTM- ENTITY 01 & 02 |
| Light fixtures | yes | {'downlight': 114, 'linear': 25} (blocks BLCK_LITE_EW WALL, LINEAR LIGHT, LINEAR LIGHT1, li, L; loose AE-LITE-CLNG circles / 2'x2' panel outlines where present) |
| AC grilles / diffusers | no | no block or drawn entity for AC grilles, diffusers or FCUs |
| Section / elevation / ceiling height | no | no section or elevation views, no level marks, no ceiling-height note (texts matched: ENGINEERING
15 PAX+1VP) |
| Floor-to-floor height | stair note only | RISER-3900/ 25: total rise per floor in mm / number of risers. Not a section. |
| Lockers | not drawn as such | no locker blocks or labels |

## Mapping (category -> layers)

- **walls**: `AR WALL`, `AR-WALL`, `WS-WALL`, `WS-WALL-PRTN`, `L-WALL`, `APO- BLOCK WALL`, `I- Partition- Jaali Stall`, `WALL HATCH`, `ELE-DEEP`, `e4`, `e7`
- **glass**: `WS-GLAZ-GLAS`, `STR. GLAZING`, `AR-WINDOW`, `AR-WINCILL`
- **doors**: `WS-DOOR`, `WS-DOOR-FIRE`, `WS-DOOR-GLAZ`, `DOOR`, `I- Door`, `TEXT DW`
- **columns**: `column`, `RCC COLUMN`, `COL`, `col hat`
- **stairs**: `STAIR`, `RAILING`, `TEXT LVL`, `HIDDEN LINE`
- **lifts / core**: `AR-TEXT`, `ELE-DEEP`, `STONE`, `HATCH`
- **ceiling**: `APO-MODULAR-GRID CEILING`, `APO- Gypsum celing`, `ACP LAYER`, `A-FLDROP`
- **lighting**: `AE-LITE-CLNG`, `WS-FIXT`, `AR-LIGHT`
- **storage / lockers**: `APO-AKJNFAFS`
- **WC / MEP fixtures**: `MEP- Plumb- Fixtures`, `cad-block.com`
- **workstations / furniture**: `WS-FURN`, `APO- FURN`, `I-FURN`, `I-FURN-PNLS`, `I- Furn- Modular Offsite`, `PDF_Furniture`, `PDF_XD-Furniture`, `PDF4_Geometry`, `WS-FURN-PATT`, `PDF_0`
- **planters**: `WS-TREE`, `APO- PLANTERS`
- **annotation**: `WS-ANNO-LABL`, `WS-ANNO-TEXT`, `WS-ANNO-DIMS`, `TEXT`, `AR-TEXT`, `Defpoints`, `Dim-INT`, `LEADER`, `DIM`, `APO- FLOORING`, `FORMAT-A1`, `FORMAT-A1-TEXT`, `prodima`, `hiiden layer`, `HATCH`, `PDF_XD-Hatch`
- **room boundary only** (closes rooms, not built as walls): `RAILING`, `AR-WINCILL`
- **chairs, workstations, tables, doors, lighting, WC/MEP**: by block name (table below), whatever layer the block sits on.

## Layers (85)

Counts are entities after exploding blocks (nested entities count on their own layer). 'In plan' = inside the plan window.

| Layer | Category | All entities | In plan | By type |
|---|---|---:|---:|---|
| `0` | unmapped (not used) | 2266 | 1721 | Line 733, Face3D 520, INS 283, Arc 251, LwPolyline 247, HATCH 125, Circle 77, Polyline3D 26, Ellipse 2, Spline 2 |
| `A-FLDROP` | ceiling | 0 | 0 |  |
| `ACP LAYER` | ceiling | 5 | 5 | LwPolyline 5 |
| `AE-LITE` | unmapped (not used) | 0 | 0 |  |
| `AE-LITE-CLNG` | lighting | 228 | 228 | Line 114, Circle 114 |
| `APO- BLOCK WALL` | walls | 8 | 8 | LwPolyline 7, HATCH 1 |
| `APO- FLOORING` | annotation | 0 | 0 |  |
| `APO- FURN` | workstations / furniture | 0 | 0 |  |
| `APO- Gypsum celing` | ceiling | 63 | 63 | LwPolyline 49, HATCH 14 |
| `APO- PLANTERS` | planters | 1 | 0 | INS 1 |
| `APO-AKJNFAFS` | storage / lockers | 0 | 0 |  |
| `APO-MODULAR-GRID CEILING` | ceiling | 263 | 263 | INS 135, LwPolyline 128 |
| `AR WALL` | walls | 161 | 159 | Line 143, LwPolyline 18 |
| `AR-LIGHT` | lighting | 1 | 1 | Line 1 |
| `AR-TEXT` | lifts / core | 14 | 8 | MText 8, LwPolyline 4, TextEntity 2 |
| `AR-WALL` | walls | 108 | 73 | Line 104, LwPolyline 4 |
| `AR-WINCILL` | glass | 50 | 50 | Line 49, LwPolyline 1 |
| `AR-WINDOW` | glass | 31 | 28 | Line 27, LwPolyline 4 |
| `cad-block.com` | WC / MEP fixtures | 1 | 1 | INS 1 |
| `COL` | columns | 5 | 4 | LwPolyline 4, INS 1 |
| `col hat` | columns | 84 | 36 | HATCH 84 |
| `column` | columns | 68 | 29 | LwPolyline 67, HATCH 1 |
| `Defpoints` | annotation | 0 | 0 |  |
| `DIM` | annotation | 128 | 128 | DIM 125, LwPolyline 2, INS 1 |
| `Dim-INT` | annotation | 1 | 1 | Line 1 |
| `DOOR` | doors | 1 | 1 | INS 1 |
| `e4` | walls | 4 | 4 | Line 4 |
| `e7` | walls | 12 | 12 | Line 8, LwPolyline 4 |
| `ELE-DEEP` | walls | 6 | 6 | Line 4, LwPolyline 2 |
| `equipments` | unmapped (not used) | 0 | 0 |  |
| `FORMAT-A1` | annotation | 2 | 2 | Circle 1, LwPolyline 1 |
| `FORMAT-A1-TEXT` | annotation | 1 | 1 | TextEntity 1 |
| `HATCH` | lifts / core | 7 | 7 | Line 5, LwPolyline 2 |
| `HIDDEN LINE` | stairs | 18 | 18 | Line 18 |
| `hiiden layer` | annotation | 0 | 0 |  |
| `I- Door` | doors | 10 | 10 | LwPolyline 8, Line 2 |
| `I- Furn- Modular Offsite` | workstations / furniture | 1 | 1 | Line 1 |
| `I- Partition- Jaali Stall` | walls | 9 | 9 | HATCH 5, Arc 4 |
| `I-FURN` | workstations / furniture | 149 | 149 | Line 94, LwPolyline 23, Ellipse 15, Spline 8, Arc 7, INS 2 |
| `I-FURN-PNLS` | workstations / furniture | 12 | 12 | Line 9, Spline 2, INS 1 |
| `L-WALL` | walls | 3 | 3 | Line 3 |
| `LEADER` | annotation | 0 | 0 |  |
| `MEP- Plumb- Fixtures` | WC / MEP fixtures | 38 | 28 | INS 32, LwPolyline 6 |
| `PDF4_Geometry` | workstations / furniture | 153 | 153 | LwPolyline 129, Arc 24 |
| `PDF_0` | workstations / furniture | 1 | 0 | INS 1 |
| `PDF_Furniture` | workstations / furniture | 0 | 0 |  |
| `PDF_XD-Furniture` | workstations / furniture | 0 | 0 |  |
| `PDF_XD-Hatch` | annotation | 0 | 0 |  |
| `prodima` | annotation | 2 | 2 | Line 2 |
| `RAILING` | stairs | 36 | 36 | Line 35, LwPolyline 1 |
| `RCC COLUMN` | columns | 6 | 6 | LwPolyline 6 |
| `SB+A-INT-CABIN TEXT` | unmapped (not used) | 0 | 0 |  |
| `SB+A-INT-CHAIRS` | unmapped (not used) | 0 | 0 |  |
| `SB+A-INT-FURNITURE` | unmapped (not used) | 0 | 0 |  |
| `SB+A-INT-REVISED LAYOUT GUIDELINES 16122022` | unmapped (not used) | 0 | 0 |  |
| `STAIR` | stairs | 60 | 60 | Line 54, LwPolyline 6 |
| `STONE` | lifts / core | 4 | 4 | Line 3, LwPolyline 1 |
| `STR. GLAZING` | glass | 12 | 12 | Line 12 |
| `TEXT` | annotation | 7 | 6 | MText 7 |
| `TEXT DW` | doors | 38 | 9 | Ellipse 13, AttributeEntity 13, INS 12 |
| `TEXT LVL` | stairs | 2 | 2 | TextEntity 2 |
| `WALL HATCH` | walls | 40 | 40 | HATCH 39, LwPolyline 1 |
| `WS-ANNO-DIMS` | annotation | 293 | 27 | INS 262, LwPolyline 20, HATCH 11 |
| `WS-ANNO-LABL` | annotation | 46 | 45 | MText 46 |
| `WS-ANNO-LEGN` | unmapped (not used) | 0 | 0 |  |
| `WS-ANNO-SYMB` | unmapped (not used) | 0 | 0 |  |
| `WS-ANNO-TEXT` | annotation | 0 | 0 |  |
| `WS-ANNO-TTLB` | unmapped (not used) | 0 | 0 |  |
| `WS-COLS` | unmapped (not used) | 0 | 0 |  |
| `WS-DOOR` | doors | 2 | 2 | INS 2 |
| `WS-DOOR-FIRE` | doors | 5 | 5 | INS 5 |
| `WS-DOOR-GLAZ` | doors | 16 | 16 | INS 15, LwPolyline 1 |
| `WS-FIXT` | lighting | 631 | 624 | Circle 236, HATCH 122, Line 118, INS 111, LwPolyline 44 |
| `WS-FLOR-HRAL` | unmapped (not used) | 0 | 0 |  |
| `WS-FLOR-STRS` | unmapped (not used) | 0 | 0 |  |
| `WS-FURN` | workstations / furniture | 8973 | 8900 | LwPolyline 3538, Arc 3239, Line 1774, Solid 160, Circle 133, HATCH 54, INS 48, Spline 10, Ellipse 9, TextEntity 6, Polyline3D 2 |
| `WS-FURN-PATT` | workstations / furniture | 7 | 7 | HATCH 7 |
| `WS-GLAZ` | unmapped (not used) | 0 | 0 |  |
| `WS-GLAZ-GLAS` | glass | 28 | 28 | LwPolyline 24, Line 2, INS 2 |
| `WS-SANR-FIXT` | unmapped (not used) | 0 | 0 |  |
| `WS-TREE` | planters | 2121 | 2121 | Line 1960, LwPolyline 140, INS 21 |
| `WS-WALL` | walls | 36 | 32 | LwPolyline 32, INS 4 |
| `WS-WALL-PATT` | unmapped (not used) | 0 | 0 |  |
| `WS-WALL-PHRT` | unmapped (not used) | 0 | 0 |  |
| `WS-WALL-PRTN` | walls | 33 | 33 | LwPolyline 33 |

## Block names (53)

'Instances' = every insert, nested ones included; 'top' = inserted directly in model space; 'in plan' = instances whose drawn centre is in the plan window (one record each in inst.json, never merged). Anonymous `*U` names are resolved to their dynamic-block source where the DWG records it.

| Block | Category | Instances | Top | In plan | Layer(s) |
|---|---|---:|---:|---:|---|
| `A$C136922d8` | chairs (task chair, work) | 247 | 0 | 247 | 0 (247) |
| `RTHEDRTHEDRTHDRTHDRH` | workstations (3'x1'7" workstation) | 244 | 244 | 244 | WS-ANNO-DIMS (244) |
| `BLCK_LITE_EW WALL` | lighting (downlight) | 104 | 104 | 104 | WS-FIXT (104) |
| `A$Cd2419d53` | chairs (meeting chair, meeting) | 52 | 52 | 50 | 0 (36), WS-FURN (16) |
| `*U230` | ceiling (2x2 grid tile array) | 48 | 0 | 48 | APO-MODULAR-GRID CEILING (48) |
| `DOOR_SNGL` | doors | 24 | 24 | 24 | WS-DOOR-GLAZ (15), WS-DOOR-FIRE (5) |
| `FLS-WHT-5953PPSM PLAN` | WC / MEP (wc) | 20 | 20 | 20 | MEP- Plumb- Fixtures (20) |
| `*U222` | ceiling (2x2 grid tile array) | 16 | 0 | 16 | APO-MODULAR-GRID CEILING (16) |
| `*U224` | ceiling (2x2 grid tile array) | 16 | 0 | 16 | APO-MODULAR-GRID CEILING (16) |
| `A$C4730a6c7` | planters | 14 | 14 | 14 | WS-TREE (14) |
| `*U218` | ceiling (2x2 grid tile array) | 12 | 0 | 12 | APO-MODULAR-GRID CEILING (12) |
| `*U220` | ceiling (2x2 grid tile array) | 12 | 0 | 12 | APO-MODULAR-GRID CEILING (12) |
| `*U226` | ceiling (2x2 grid tile array) | 12 | 0 | 12 | APO-MODULAR-GRID CEILING (12) |
| `*U228` | ceiling (2x2 grid tile array) | 12 | 0 | 12 | APO-MODULAR-GRID CEILING (12) |
| `li` | lighting (linear) | 9 | 9 | 9 | WS-ANNO-DIMS (9) |
| `A$Cd484c6a2` | by layer: workstations / furniture | 8 | 8 | 8 | WS-FURN (8) |
| `LINEAR LIGHT1` | lighting (linear) | 8 | 8 | 8 | WS-ANNO-DIMS (8) |
| `A$Cfde1c821` | planters | 7 | 7 | 7 | WS-TREE (7) |
| `LINEAR LIGHT` | lighting (linear) | 7 | 7 | 7 | WS-FIXT (7) |
| `25 Stall Partition` | by layer: workstations / furniture | 5 | 5 | 5 | WS-FURN (5) |
| `health fauscet 1` | WC / MEP (health faucet) | 5 | 5 | 5 | MEP- Plumb- Fixtures (5) |
| `DW` | doors (door tag) | 13 | 13 | 3 | TEXT DW (12), WS-WALL (1) |
| `A$C62789d74` | workstations (3'x2' workstation) | 3 | 3 | 3 | WS-FURN (3) |
| `A$Cd18c31fc` | chairs (lounge armchair, lounge) | 3 | 3 | 3 | WS-FURN (3) |
| `ETHGESTGERTG` | by layer: walls | 3 | 3 | 3 | WS-WALL (3) |
| `A$C0894983f` | chairs (lounge chair, lounge) | 2 | 2 | 2 | WS-FURN (2) |
| `A$C344e7bdb` | chairs (lounge chair, lounge) | 2 | 2 | 2 | WS-FURN (2) |
| `A$C897f58da` | chairs (3-seat sofa, lounge, 3 places) | 2 | 2 | 2 | WS-FURN (2) |
| `GERGG` | by layer: workstations / furniture | 2 | 2 | 2 | WS-FURN (2) |
| `URS-WHT-13253O PLAN` | WC / MEP (urinal) | 2 | 2 | 2 | MEP- Plumb- Fixtures (2) |
| `*U180` | chairs (reception lounge chair, lounge) | 1 | 0 | 1 | WS-FURN (1) |
| `*U219` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U221` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U223` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U225` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U227` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U229` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `*U231` | ceiling (2x2 grid tile array) | 1 | 1 | 1 | APO-MODULAR-GRID CEILING (1) |
| `5555 FT TABLE` | tables (staff table) | 1 | 1 | 1 | PDF_0 (1) |
| `A$C0c49554c` | chairs (lounge chair, lounge) | 1 | 1 | 1 | WS-FURN (1) |
| `A$C7c8f7130` | by layer: annotation | 1 | 1 | 1 | DIM (1) |
| `A$C94a717aa` | by layer: workstations / furniture | 1 | 1 | 1 | WS-FURN (1) |
| `A$C99a14c5c` | by layer: workstations / furniture | 1 | 1 | 1 | WS-FURN (1) |
| `A$Ce8a8cead` | by layer: workstations / furniture | 1 | 0 | 1 | WS-FURN (1) |
| `Dishwasher 606x622_top_cad-block.com` | WC / MEP (dishwasher) | 1 | 1 | 1 | cad-block.com (1) |
| `Door` | doors | 1 | 1 | 1 | DOOR (1) |
| `HHP Member Square Hollow Pipe4 - HHP Member Square Hollow Pipe 3_ 6__1-337-Level 1` | by layer: workstations / furniture | 1 | 0 | 1 | I-FURN (1) |
| `L` | lighting (linear) | 1 | 1 | 1 | WS-ANNO-DIMS (1) |
| `Pedestal 3 Drawer1 - 3 Drawer Pedestal 1_ 6_ X 1_ 6_ X 2_ 4_5__1-133-Level 1` | by layer: workstations / furniture | 1 | 0 | 1 | I-FURN-PNLS (1) |
| `Staff Chair - Staff Chair_1-171-Level 1` | chairs (staff chair, work) | 1 | 0 | 1 | I-FURN (1) |
| `dfsf` | by layer: columns | 1 | 1 | 1 | COL (1) |
| `BASE FILE$0$rdg` | by layer: WC / MEP fixtures | 5 | 5 | 0 | MEP- Plumb- Fixtures (5) |
| `A$C64875517` | planters | 1 | 1 | 0 | APO- PLANTERS (1) |
