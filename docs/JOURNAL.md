# Atlas — Development Journal

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
