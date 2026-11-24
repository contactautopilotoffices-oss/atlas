## 2026-11-20 — Atlas: procedural semantic CAD proof for RTP 603 & 604

**The 6th-floor fit-out drawing for Offices 603 & 604 now becomes a FreeCAD/IFC model and a semantic DXF. Every wall and door carries its type, size, build-up and header, and records where each value came from.**

*(For the main session to paste into `docs/JOURNAL.md`: this side session was limited to `airoli-rtp/procedural-cad/`.)*

- **Why:** a 2D layout does not say whether a line is glass or POP, how tall a wall is, or what sits above a door, so our 3D models were guessing. This shows the guessing can be replaced by rules that read the drawing, with every assumption marked and listed for the designer.

- **Structural decisions:**
  - One schema-checked file (`assemblies.json`) sits between the drawing and every output. The 3D model, IFC, DXF and web JSON are all generated from it. The alternative, typing walls inside the 3D builder, lost because nothing could then be traced or checked.
  - Every value carries a source (`cad` or `default`) and a confidence.
  - Door openings are read from the swing the designer drew, not from the block's outline. The outline version cut away cubicle panels that should have stayed.
  - Doors that do not line up with a drawn wall are built standing on their own, not forced onto the nearest wall.

- **What works now:**
  - One command (`run.sh`) reads the DWG and rebuilds everything in about 35 seconds.
  - 95% of the 512 wall pieces are typed from drawing evidence (layer, line spacing, hatch), and every door's kind and width come from the drawing.
  - Every door has a header (glass transom, POP bulkhead or lintel), except cubicle doors, which have nothing above them by rule.
  - A checker measures the built model against the specification, and the build reports failure when a check fails.
  - The final build passes all 7,044 checks with 0 failures (variant: 7,199 with 0). Those include a cross-check that every door header in the exported records has a matching 3D piece of the same material.
  - One build on the way failed 6 checks, because a default door frame cut the ends off two walls. The checker caught it, it was fixed, and the floor was rebuilt.
  - The trace page lets anyone click a wall and see the drawing lines it came from.
  - Changing one rule regenerates the whole floor. The demonstration run sets the door head to 2.4 m and turns the meeting-room partitions into POP + glass + POP. It is hypothetical, not from the drawing.

- **Left undone:**
  - Heights, vertical build-ups and header types are all defaults, because the drawing has none.
  - 40 of 97 doors have no host wall in the drawing: 20 are toilet-cubicle doors, and one double door is only half read.
  - 25 walls cannot be typed (21 of them are drawn on the furniture layer).
  - The exact opening size is unresolved for 18 doors: the leaf is known, but the leaf is not the opening.
  - Wall corners are not joined.
  - The Blender builder's door headers are only a proposal (`BLENDER_HEADER_PROPOSAL.md`), because another worker is editing that folder.
  - Nothing committed or published.

- **Open questions for the founder:**
  - False ceiling 2.90 m (your range) or 3.05 m (what the web twin uses)?
  - Should the designer be asked to adopt the layer and tag standard in FEASIBILITY.md for future drawings?
  - Who sends the 25 questions in ASK_DESIGNER.md to the designer?
