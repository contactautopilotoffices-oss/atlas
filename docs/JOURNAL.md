# Atlas — Development Journal

## 2026-11-21 — Atlas: Andheri district twin, first realism checkpoint

**Tested whether Google can supply a real 3D Andheri (it cannot), then upgraded the existing Andheri district builder: 723 Avenue now matches the photograph and the city around it is weathered and hazy. Two checkpoint stills are ready for review.**

- **Why:** the founder wants the area around 723 Avenue, Corporate Avenue and Privilon to feel like a real place, as Google's 3D city does in New York. ChatGPT's attempt produced either a lone tower or a flat satellite map.
- **What was established:**
  - Google's Map Tiles API was tested with the founder's key. At New York the finest tiles stand up to 265 m (real buildings). At 723 Avenue, Marol Naka, Times Square, Privilon, Corporate Avenue and even BKC they are flat, 18 m at most. Google has no 3D buildings for Mumbai, so no import tool or key can produce that look here. The city must be modelled.
  - The OpenStreetMap file the founder offered holds only about 1,500 buildings for this strip. The builder uses Overture Maps instead (OpenStreetMap plus Google's and Microsoft's building outlines), with heights read from the Copernicus satellite surface model.
- **Structural decisions:**
  - Reused the existing district builder (`scripts/world`) instead of writing a new one. It already models roads, footpaths, the Line 1 viaduct, stations, water tanks and trees. A fresh build would have repeated that work.
  - The generated 723 tower is replaced by the earlier photo-matched facade study (dark fins, opaque divisions, WADHWA crown). It lands on the same footprint within 4 cm.
  - New photographic aerial stills (GPU, real haze, no tilt-shift), so the scene reads as a drone photograph, not a model on a table.
  - All new behaviour is behind options (`--slab-min`, `--hero-blend`, `--render aerial aerial2`), so the live explorer's existing outputs are unchanged.
- **What works now:**
  - One command rebuilds a 1.1 km square of Marol around 723 Avenue (about 500 m in every direction) and renders three views in about 30 seconds:
    - an overview from across Andheri-Kurla Road;
    - a view along the road under the Line 1 viaduct;
    - a close view of 723.
  - The stills are in `media/flipkart-andheri/world/checkpoint/`.
  - After the founder's review, the milky haze was removed for clear daylight.
  - Times Square (the 8,600 m² complex north of the road) and the Le Western hotel are named landmarks in glass curtain wall.
  - Office blocks across the area now use six glass and ribbon-window facades instead of one.
  - **Street View survey** (the normal Google Maps page in Chrome, imagery Feb 2026; nothing copied into the model):
    - Six buildings along the corridor now carry what was seen there, recorded in `scripts/world/refs/marol_corridor.json` with the viewpoint for each: the three Times Square buildings, InSync Analytics, Fleet House and the Makwana Road tower.
    - The Times Square curved tower was cut from a satellite reading of 88 m to about 13 storeys (52 m).
  - **Line 1 stations now follow Marol Naka as photographed:**
    - large grey round piers on the median and blue square columns at the deck edge;
    - an opaque concourse with a billboard band in place of a glass box;
    - a near-flat grey canopy on blue columns;
    - blue stair canopies, and a white-and-blue lift core at each end.
  - The viaduct and station concrete is now weathered grey instead of near-white.
  - **Live preview:** the upgraded district loads in the walkable explorer at `/flipkart-andheri/world?preview=723-avenue#723-avenue` (3.5 MB). The published model in `d/` is unchanged until the founder approves it.
  - **Baked light in the live explorer:** Blender bakes ambient occlusion (how much open sky each surface sees) for the whole 723 district into 15 maps in about 2.5 minutes. The explorer applies them to 132 meshes, so streets, building bases, corners and the space under the viaduct darken as they do in the stills, while the sun and its shadows stay live. The 723 tower itself is not yet baked: its model has no second UV set.
  - The founder could not arrange a drone or a photo walk. Google imagery may be used only as reference, not pasted onto the models, so further realism means painting each building's facade from what Street View shows.
  - The explorer labels Times Square and Fleet House in the 3D view. The preview also uses the same AgX colour handling as the Blender stills, so its light and contrast match them more closely.
  - **Corridor facades from a Street View walk:** 16 more buildings along Andheri-Kurla Road and 723's lane are recorded in `scripts/world/refs/marol_corridor.json` (22 in all). Three new painted facades match what the road actually has: worn 3-4 storey commercial blocks, a ground-floor band of shutters and dense signboards, and a dark glass-grid office.
    - The satellite heights read these low frontage blocks 3-5 times too tall: Andheri-Kurla Rd no. 111 was 55 m and is 4 storeys. Every surveyed height is now the Street View storey count, which turns the road from a row of white towers into the low, busy frontage it is.
    - Many taller buildings set back from the road still carry satellite heights and stock facades.
  - **723 street lobby** from the developer's brochure: a glazed double-height entrance under a dark canopy with a lit soffit and the name, a stone reception desk, a timber-fin feature wall with lift doors, and a granite forecourt with steps and a ramp. In Feb 2026 Street View the ground floor is still behind hoarding, so this is the developer's design, not the as-built lobby; the interior finishes are a proposal.
  - **Privilon moved to its real plot.** The map pin had put it on Fleet House's footprint. Street View shows a concrete tower under construction behind Fleet House, north-west of Marol Naka station, and Privilon now stands there (`--opt-at 1337,-234`). Fleet House is an ordinary 7-storey neighbour again. The earlier Privilon facade study was shaped for the wrong footprint, so Privilon is now generated from the deck's floors; its facade is generic until the brochure facade is refitted.
  - From Privilon, 723 Avenue now appears as itself: the photo-matched tower with its rooftop, on its own footprint, with a yellow '723 Avenue' pin (`--neighbour-hero`). It was a generic block before.
  - **Corporate Avenue as a gated campus.** The founder confirmed that Flipkart's floors are in Atul Corporate Avenue (the south block) and that both gates are on Guru Hargovindji Road. The district now has the campus from the main road to Atul: a compound wall, two gates with pillars, boom barriers, security cabins and a CORPORATE AVENUE name beam, paved driveways and parking, and a tree line. The other campus blocks are re-skinned as office glass. There is no Street View inside the campus, so gate details and facades are estimates from the satellite layout. The earlier pale-frame facade study stays on Atul Corporate Avenue. The founder confirmed the campus's 83 m tower is real, so its satellite height stands.
  - **Layout checked against Google satellite.** `scripts/world/verify_overlay.py` uses the founder's Map Tiles key to lay the model's footprints over Google satellite tiles. The sheet is for review only and is never put into a model or published.
    - It showed Corporate Avenue's long block on the main road is missing from both Overture and OpenStreetMap; it is now traced from the imagery and added, and the two gates sit on the road either side of it.
    - It showed that a rule in the old builder deleted every building that touched the clearance around a Line 1 station, which left empty lots by Marol Naka. Buildings are now trimmed to the clearance instead; only the station buildings themselves are removed.
    - Google's Geocoding API returns no building outlines or entrances for India, so it confirms positions only.
  - The preview link takes several properties: `?preview=723-avenue,privilon`.
  - 723 Avenue now has the rooftop garden from the developer's brochure: a timber deck, a curving planted band with trees, checkerboard paving, a glazed pavilion with timber fins and a glass railing. The layout is read from the brochure; sizes are estimates. The brochure image is kept with the 723 photos.
- **Left undone:**
  - About 60 more significant buildings in the 723 to Marol Naka corridor still use generic facades; each needs its own Street View look. The Line 3 entrances are still the generic canopy.
  - The neighbouring buildings still look too clean and uniform. Every facade has the same punched windows, and the satellite heights flatten most of them to 5–8 storeys.
  - Corporate Avenue (2.5 km west) and Privilon are not yet in a checkpoint still.
  - Times Square and the Marol Naka station are in the scene but not yet framed in a shot.
  - Nothing is published to the live explorer.
  - The NotebookLM push was not attempted: `add_source` is known to be broken.
- **Open questions for the founder:**
  - Privilon's exact plot: the satellite shows a construction site with a crane beside the strip the model now uses.
  - Can the developer confirm Privilon's plot and storey count (the brochure says 14)?
  - Is this direction worth more time, given that a modelled city will never match Google's photographed New York?
  - Privilon is under construction and absent from all map data. Can someone confirm its exact plot beside Marol Naka station?
  - The Maps key was pasted in chat. Should it be restricted or replaced in Google Cloud?

## 2026-11-20 — Atlas: procedural semantic CAD proof for RTP 603 & 604

**The 6th-floor fit-out drawing for Offices 603 & 604 now becomes a FreeCAD/IFC model and a semantic DXF. Every wall and door carries its type, size, build-up and header, and records where each value came from.**


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
  - Nothing published; committed locally only, not pushed.

- **Open questions for the founder:**
  - False ceiling 2.90 m (your range) or 3.05 m (what the web twin uses)?
  - Should the designer be asked to adopt the layer and tag standard in FEASIBILITY.md for future drawings?
  - Who sends the 25 questions in ASK_DESIGNER.md to the designer?

## 2026-11-19 — Atlas: Reliable Tech Park (Airoli) twin for Altruist

**A new client-ready 3D twin of Reliable Tech Park, Airoli, for Altruist: the real building and its surroundings, the 4th-floor suite and both 6th-floor layouts. Everything comes from the design team's drawings, lit by the real sun and published at a new link.**

- **Why:** Altruist is weighing office space at Reliable Tech Park, and the design team drew three fits: a 4th-floor suite and two 6th-floor layouts. The founder wanted them shown as one premium, walkable experience instead of drawings. It also had to fix what made earlier twins look weak: a cartoon-like outside, flickering floors, and checks that only ran inside Blender.
- **Structural decisions:**
  - **One shared coordinate system for every floor and the city** (metres from the Google Maps pin, true north). The 4th and 6th floor drawings are lined up on their 185 structural columns, within about 1 cm. True north comes from fitting the drawing to the real building outline in OpenStreetMap (91 % overlap). The alternative, keeping each drawing in its own coordinates, is what made floors drift and flicker before.
  - **Gated build.** CAD read, then clay model, then look, lighting, bake and web. There were automated checks at each step and a sign-off sheet per plan. Tonight the founder was asleep, so the checks stood in for sign-off and every sheet is kept for review.
  - **Split of work.** One session read the drawings and built the interiors; a separate worker built the exterior in Blender; this session planned, reviewed and assembled the page. A multi-agent review found 35 real defects in the new page before it shipped, and all were fixed.
  - **The viewer is a copy of the F1 Skymark viewer** (walk, tour, section cut, floor-plan minimap, presenter remote), not a new one, so nothing proven on Skymark was lost.
  - **The CAD view is the Volt style the founder liked:** the drawing's own lines, white on blue, with "you are here" and live coordinates.
  - **Lighting uses the building's AO bake plus the live sun**, not a single baked daytime, so one bake serves morning, golden hour and night.
- **What works now:**
  - A new page at `/airoli-rtp/twin/web/` with Altruist branding.
  - The building and its surroundings out to 500 m (terrain out to 3 km):
    - every floor a separate piece, glass bands and silver cladding, the rounded terraced ends, the dome and the RELIABLE sign;
    - the court with palms and parking, real roads, neighbouring buildings and the power substation.
  - A light slider from sunrise to night. At night the floors glow, the pink and violet uplights from the photos come on, and the city's windows and street lamps light up.
  - The 4th and 6th floors glow on the facade as the offered floors.
  - Nine finished renders of the building: morning, golden hour and night, each from the court, the road and above.
  - **Seat proofs from the drawings:**
    - 4th-floor suite: 212 seats, training-led (135 training seats, 18 work seats).
    - 6th floor, option A: 429 work seats, 670 in all. This matches the drawing's own legend of 429 desks provided (450 were required).
    - 6th floor, option B: 723 work seats, 985 in all.
  - A comparison card for the two 6th-floor layouts.
  - Every plan can be walked: in its Blender bake where delivered, otherwise in a version built straight from its CAD layout.
- **Left undone:**
  - Plans whose Blender bake was not finished by morning are shown in the CAD-built version; the morning note says which.
  - The floor count (ground plus 9) and the 3.6 m floor-to-floor height are assumptions: the photos and terrain data cannot settle them.
  - Some building details are estimated from photos: the roof drum and dome positions, the lobby chamfer and the neighbours' facades.
  - Cars in the city are simple shapes.
  - 0.022 m² of tiny overlapping surfaces remain in the surrounding city (none on Reliable Tech Park).
  - The old Volt, Skymark and landlord pages are untouched.
  - The NotebookLM push: `add_source` is known to be broken (see CLAUDE.md).
- **Open questions for the founder:**
  - Can the landlord supply a section or elevation drawing (the floor count and floor-to-floor height)?
  - **6th floor, option A:** the measured floor is about 26 % larger than the sheet's 23,659 sq ft carpet. Is the sheet using a different carpet definition?
  - **6th floor, option A, exits:** 112 seats (mostly the cafeteria) have only one exit route. Does the fire consultant need to see this?
  - **6th floor, option A, walkways:** five desk-cluster corners sit 0.85–1.15 m from the service walls, below the 1.2 m walkway rule. Should the designer adjust them?
  - Can Altruist's logo and the RELIABLE sign be shown in client material?
  - Which floors are actually available today? The drawings date from 2020 and name earlier tenants.

## 2026-11-18 — Atlas: F1 Skymark twin gets Paytm and ARCIL floors

**Paytm (1st floor) and ARCIL (2nd floor) were added to the F1 Skymark digital twin next to Volt, each proven from its own CAD drawing, built and lit in Blender on the Mac, and walkable in a new building viewer.**

- **Why:** large occupiers (GCCs, 150–200+ seat deals) want to see their real space before committing. Volt was the only tenant in the twin; the demo needs ARCIL and Paytm on their real floors, true to the CAD, photoreal and walkable.
- **Structural decisions:**
  - One CAD pipeline for every tenant (`noida-skymark/cad/`) instead of Volt's one-off scripts. It takes a tenant name and a drawing and produces the seat proof, the dimension checks, a room plan and the assumptions list. Re-running it on Volt's drawing gives Volt's original numbers (116 work / 213 total), which is how we know it is right.
  - One Blender builder for every tenant (`noida-skymark/twin/blender/`): ceilings, lights from the drawing's ceiling plan, doors, a placement check (nothing floating, nothing inside walls, 1.2 m walkways), automatic cameras with hand overrides, a light bake, stills and a web export. The alternative, hand-building each floor, would not scale past three tenants.
  - One building viewer for all tenants (`noida-skymark/twin/web/`) instead of a page per tenant. It uses the same photo-based building and neighbourhood as the live Volt page. The live Volt page was left untouched; the new viewer replaces it only when approved.
  - Rendering is done only on the local Mac (Blender 5.2, Metal GPU), never in the cloud.
  - Work was split: the Fable session advised and reviewed; Opus and Sonnet workers did the building.
- **What works now (on this Mac, not yet live):**
  - Seat proof from the drawings. ARCIL: 252 work seats, 328 in all; every line of the design deck matches except lockers (deck 210, drawing 204). Paytm: 244 work seats, 313 in all.
  - Paytm and Volt shown side by side on the first floor (their drawings share one plate; they only share the east service strip). ARCIL on the second floor, with Altruist's area marked "later".
  - Finished 1080p stills: Paytm 9, ARCIL 10, plus Paytm's five ceiling options and ARCIL's teal and violet meeting-room options as true renders.
  - A walk-to-move walkthrough per tenant with baked lighting, collision, gliding between authored views, a tour, and a 2D plan inset showing where you are and where you are heading (now standard for every floor).
  - Building view: slow orbit, a floor picker with "Available" floors, a clean band on the selected floor, a section cut, and clear see-through facade glass.
- **Left undone:**
  - Not deployed; the ATLAS link and the landlord page still show the old Volt page. Needs the user's screenshot approval first.
  - Volt not rebuilt with the new builder (its placement check still lists the sofa-in-walkway and floating sofa problems the user found, plus small furniture contacts).
  - Furniture and props are generic. Better assets (Poly Haven materials, real office chairs, Apple MacBook/iMac models) are proposed but not downloaded; they wait for the user's go-ahead and, for paid models, a purchase.
  - Paytm's blue reception desk is not built: the Paytm drawing has no reception desk.
  - ARCIL brand graphics (logo artwork, skyline wall, training-room icon wall) use plain "Arcil" text until the artwork is supplied.
  - Small rooms (pantries, washrooms) still have weak camera views; two ARCIL corridors have none.
  - 26 ARCIL desks stand 0.15 m over the edge of Altruist's area in the drawing; reported, not moved.
  - Frame rate not yet measured on a MacBook Air or a phone.
- **Open questions for the founder:**
  - About 242 m² of ARCIL's floor runs past the photo-based building at the street front, and the street-side lifts and stairs in the Paytm drawing sit outside it. Should the building model be corrected to the drawings?
  - Floor-to-floor height: the stair notes say 3.9 m, the twin uses 4.1 m. No drawing gives ceiling heights; 2.85 m is assumed. Can the landlord supply a section?
  - Which Paytm ceiling option is the client's choice? (Navy open ceiling is the default; four others are rendered.)
  - Budget for paid 3D models (Apple products, branded furniture)?
