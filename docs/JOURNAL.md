# Atlas — Development Journal

## 2026-11-19 — Atlas: Reliable Tech Park (Airoli) G0 CAD read for three offers

**The two Reliable Tech Park drawings were read into seat counts, room areas, entries, exits with walking distances, walkway widths and daylight, for the 6th-floor Option A, the 6th-floor Option B and the 4th-floor suite, each with a plain-English sign-off sheet.**

- **Why:** a large occupier is being shown three offers in Reliable Tech Park, B Wing. The build is gated so that mistakes found late on Skymark (furniture in walkways, flicker, broken chairs) are caught on paper first. G0 proves what the drawings actually contain before any 2D plan or 3D model is made.
- **Structural decisions:**
  - The Skymark CAD pipeline was extended, not copied. Every new behaviour is switched on from the plan's own settings file (millimetre drawings, two plans in one drawing, desks drawn as loose lines, the paper-space legend, a unit outline where the drawing does not wall the unit off). Skymark is untouched: Volt's run gives exactly the same files as before (116 work seats, 213 in all).
  - Five new steps were added: the legend reader, exits and walking distances, walkway widths, daylight by true facade, and the sign-off sheet. The alternative, a one-off script for this building, would have had to be rewritten for the next one.
  - Walking distances follow the drawn walls and doors on a fine grid, so a missing door shows up as a missing route instead of being hidden by straight-line distances.
  - Option B uses the same plan coordinates as Option A (the two copies on the sheet line up exactly), so the two can be compared room by room.
  - The flattened drawings and the sheet images stay on this Mac (not in git), as agreed for client drawings.
- **What works now:**
  - 6th floor, Option A: 429 work seats, exactly the sheet legend's 429 provided (against 450 required); 670 seats in all. Exits: 5 stairs; worst walk to the nearest exit 33 m. 25 % of desks within 6 m of a window.
  - 6th floor, Option B (whole floor): 723 work seats, 985 in all; 9 exit stairs; worst walk 34 m.
  - 4th floor suite: 18 work seats, 135 training seats, 212 in all; its area matches the sheet's 6,603 sq ft within 2.2 % when partitions are counted.
  - Each offer has a sign-off sheet (`airoli-rtp/<plan>/<plan>_G0.md` and an image) listing every difference from the drawing's own claims.
- **Left undone:**
  - G1 (the 2D plan) and G2 (the clay model) were not started: they wait for the founder's sign-off of G0.
  - The 6th-floor area check fails: the sheet's carpet figure is exactly its chargeable figure divided by 1.5, so it looks like a commercial conversion, not a measured area. It cannot be matched without the landlord's own area method.
  - A few room outlines are still open-plan zones (some repro, store and Option B east-arm rooms); their labels are listed on the sheets. Seat totals do not depend on them.
  - The sheet's own north arrow (in paper space) was not read; north comes from the building-footprint fit.
- **Open questions for the founder:**
  - The 6th-floor drawing shows the cafeteria and its lift lobby with no door to the work floor; is a door missing, or is the cafeteria meant to be reached from the lifts only?
  - The 4th-floor suite reaches only one exit stair without crossing other tenants' space. Is there a common corridor to a second stair that the drawing does not show?
  - Option B's "Call centre, 60 seats" area has no chairs drawn. Should it be shown as 60 seats?
  - Which area basis should the client see: the sheet's carpet, the measured free floor, or the landlord's chargeable area?

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
