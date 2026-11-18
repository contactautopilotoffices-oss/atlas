# Atlas — Development Journal

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
