# Questions for the designer (Offices 603 & 604, RTP 6th floor)

The drawing gives every wall's position, length and thickness, and every door's position and width. It does not give heights, build-ups, what sits above doors, or whether anything is arched. Until the designer answers, the model uses the default in each question (the founder's instruction of 19 November 2026: use common Indian office fit-out defaults and mark them). Every default is tagged `source: default` in the model, the IFC, the DXF and the trace page.

Each question is written so that one answer settles every wall or door listed against it. Answers go into `rules.json` (the `defaults` and `assemblies` sections); re-running `run.sh` rebuilds everything.

In all: 512 wall pieces (1280.7 m), 97 doors, 71 columns.

## Heights

**Q-H1.** What is the false-ceiling height (finished floor to underside of ceiling) in 603/604? We used 2.90 m (the web twin uses 3.05 m from an earlier client-team note).  
*Default used:* 2.90 m. *One answer settles:* 58 wall pieces, 151 m; levels.

**Q-H2.** Slab soffit and floor-to-floor height? We used soffit 3.35 m, floor to floor 3.60 m, so 0.25 m of slab and screed.  
*Default used:* 3.35 m / 3.60 m. *One answer settles:* column, levels.

## Doors

**Q-D1.** Door head height (top of the door leaf/frame) for all doors? We used 2.10 m.  
*Default used:* 2.10 m. *One answer settles:* 97 doors.

**Q-D2.** Above glass doors in glass partitions: glass transom up to the false ceiling (our default), a POP bulkhead, or a full-height door?  
*Default used:* glass transom to false ceiling. *One answer settles:* 32 doors.

**Q-D3.** Above doors in dry-wall partitions and block walls: the wall continues above the door (POP bulkhead / lintel, our default), or a glass fanlight?  
*Default used:* POP bulkhead (dry wall) / RCC lintel (block). *One answer settles:* 44 doors.

**Q-D4.** Door frame and beading: glass doors in 45 x 75 mm aluminium (the drawing draws 44 x 75 mm jambs), solid doors in 50 x 100 mm hardwood with 12 mm beading?  
*Default used:* as stated. *One answer settles:* 11 doors.

**Q-D5.** Door leaves: 12 mm toughened glass for glazed doors, 35 mm flush for solid doors? Any fire-rated doors (none are marked)?  
*Default used:* as stated, none fire-rated. *One answer settles:* 97 doors.

**Q-D6.** 40 doors are drawn with no wall piece ending at their swing (list in out/audit/HOST_AUDIT.md): 20 toilet-cubicle doors (their side panels are drawn only as 20 x 79 mm stubs), 4 'Glass Door' blocks, 6 'D-750', 8 'DOOR_SNGL', 1 small door and the double door near (89.3, 92.3), of which only one leaf is read. Which wall does each sit in? Please draw the wall ends or cubicle side panels up to the door.  
*Default used:* built freestanding on the drawn swing line, no wall linked. *One answer settles:* 39 doors.

**Q-D7.** Door sizes: for each door type, please give four widths: the structural (rough) opening, the frame outside size, the clear passage width, and the leaf width. The drawing fixes the opening only where wall ends or jambs are drawn. Elsewhere we know only the leaf (from the swing; for example 0.681 m in a block named 'D-750'), and the block name is not reliable: 'D-750' is inserted at three sizes.  
*Default used:* structural opening = leaf + one default frame width each side; clear width unknown. *One answer settles:* 13 doors.

## Arches

**Q-A1.** Are any openings arched (or arch plus window)? The plan has no arch marks, so none were built. If yes, give spring height and radius per opening, or mark them on a layer A-OPEN-ARCH.  
*Default used:* no arches. *One answer settles:* 97 doors.

## Glass partitions

**Q-G1.** Glass partitions (WS-GLAZ-GLAS, drawn 75 mm deep): 12 mm toughened clear glass in a 75 mm aluminium channel top and bottom, floor to false ceiling? Any frosted band or film (height range)? Anything above the false ceiling?  
*Default used:* 12 mm clear, 50 mm channels, floor to false ceiling, nothing above. *One answer settles:* 58 wall pieces, 151 m.

## Dry-wall partitions

**Q-P1.** Partitions on WS-WALL-PRTN (drawn 75 mm): gypsum board on metal studs or POP on block? Board layers and stud size?  
*Default used:* 2 x 12.5 mm gypsum on 50 mm studs, POP finish. *One answer settles:* 40 wall pieces, 240 m.

**Q-P2.** Do dry-wall partitions run to the slab soffit (our default, for sound) or stop at the false ceiling?  
*Default used:* to soffit. *One answer settles:* 40 wall pieces, 240 m.

**Q-P3.** Is any partition a POP + glass + POP wall (solid below, glass vision panel, solid above)? If so, which ones and the band heights (we would use 0-0.9 / 0.9-2.4 / 2.4-ceiling).  
*Default used:* none (the drawing shows no mixed walls). *One answer settles:* 31 wall pieces, 117 m.

## Core and wet-area walls

**Q-M1.** Core and toilet walls on layer 'walls' (150/225/300 mm): block, brick or RCC? Unhatched ones especially.  
*Default used:* concrete block, plastered, to soffit. *One answer settles:* 172 wall pieces, 227 m.

**Q-M2.** RCC fins on the north face: confirm size and full height.  
*Default used:* RCC, floor to soffit. *One answer settles:* 4 wall pieces, 17 m.

## Facade

**Q-F1.** Structural glazing: glass make-up, mullion spacing and spandrel/back-pan at the slab edge? We built plain glass slab to slab.  
*Default used:* clear glass slab to slab, no mullions. *One answer settles:* 43 wall pieces, 258 m.

**Q-F2.** ACP cladding: which bands of the facade are ACP and their heights? We built the ACP lines full height.  
*Default used:* full storey height. *One answer settles:* 24 wall pieces, 60 m.

**Q-F3.** Windows on layer WINDOW: sill height, head height and frame? We built glass from floor to soffit.  
*Default used:* glass floor to soffit. *One answer settles:* 66 wall pieces, 55 m.

**Q-F4.** Railing height and type at the facade and balconies?  
*Default used:* 1.0 m steel railing. *One answer settles:* 10 wall pieces, 28 m.

## Toilets

**Q-W1.** Toilet cubicles (WS-WALL-PHRT, 20 mm): HPL panels 0.15-2.1 m above floor?  
*Default used:* HPL 20 mm, 0.15 to 2.10 m. *One answer settles:* 39 wall pieces, 45 m; 21 doors.

## Unclear lines

**Q-U1.** Lines on the 'walls' layer only 30-99 mm apart (shaft and lift-well linings?): what are they?  
*Default used:* built as 'type not settled' in magenta. *One answer settles:* 25 wall pieces, 84 m.

**Q-U2.** The lobby and toilet-block walls around (70-100, 106-111) are drawn on the furniture layer I-FURN, 100 mm apart: what are they (block, dry wall, glass)? Please move them to a wall layer.  
*Default used:* built as 'type not settled' in magenta. *One answer settles:* 25 wall pieces, 84 m.

## Columns

**Q-C1.** Columns: RCC, full height to soffit, plastered/boxed? Any column cladding?  
*Default used:* RCC, floor to soffit, no cladding. *One answer settles:* 71 columns, column.

## Slab and ceiling

**Q-S1.** False-ceiling type per zone (grid, gypsum, open) and the plate edge: we approximated the slab outline from the facade lines.  
*Default used:* one flat ceiling over the whole offer. *One answer settles:* slab.

## For the next drawing: how to make these questions unnecessary

Draw each wall type on its own layer (for example `A-WALL-GLASS`, `A-WALL-POP`, `A-WALL-BLOCK`, `A-WALL-MIXED`) and put a short type tag (for example `GP1`, `DW2`) on each wall, with a legend that gives the build-up and band heights per tag. Draw doors as blocks with attributes for head height and header type. `DRAWING_STANDARD` in FEASIBILITY.md has the full list.

