# Master prompt: F1 Skymark client-ready digital twin (local Blender)

Paste this whole file as the first message of a new local Claude Code session in this repo,
on the Mac that runs Blender with the Blender MCP connected.

---

## 1. The goal

Build a **client-ready digital twin of F1 Skymark, Sector 6, Noida**: the building, and each
Autopilot client's floor inside it, true to the 2D CAD, photoreal, and walkable.

The audience is a large occupier (a GCC or a 150 to 200+ production-seat client). They want to
see what their space at F1 Skymark will really look like, before spending anything. So every
picture and every walkthrough must be the real model of the real CAD. Nothing may be an AI
image dressed up as a render, or a set of photos dressed up as a 3D walkthrough.

Tomorrow's demo: F1 Skymark with **Volt (done), ARCIL and Paytm** in the same twin, each on its
own floor, each walkable.

## 2. Two workflows, and when each is allowed

| | Workflow A: Blender twin (this prompt) | Workflow B: low-poly + AI video |
|---|---|---|
| Use for | Serious prospects, GCCs, 150+ seat deals | First-iteration business development only |
| How | CAD to Blender model, baked lighting, Cycles renders, cinematography, web walkthrough | Low-poly model true to the CAD, then an AI video model (Seedance, Higgsfield) for look and feel |
| Must be true | Elevations, column sizes, heights, proportions, seat counts, materials | Elevations, column sizes, heights and proportions to the CAD |
| Can do | Material swaps, lighting schemes, walk-to-move walkthrough, film | Mood images and clips only |
| Cannot do | | Material swap, a real walkthrough. Never present its output as a render or a walkthrough |

Rule: Workflow B output is always labelled "concept visual". Workflow A is the only thing we call
a render, a twin or a walkthrough.

## 3. What already exists (start from here, do not rebuild)

Live, no login:
- 2D ATLAS of F1 Skymark: https://atlas.autopilotoffices.com/noida-skymark/
- 3D building + Volt floor + walkthrough: https://atlas.autopilotoffices.com/noida-skymark/volt/
- Landlord page (shows both inside it): https://atlas.autopilotoffices.com/landlord/

In this repo:
- `noida-skymark/reconstruction/` building twin from one photo + G+4 count (Blender script, Overture
  context within 650 m). Placement and scale are NOT surveyed (see `validation_report.json`).
- `noida-skymark/volt/cad/` the CAD pipeline for Volt: `flatten.mjs` (reads the DWG with acad-ts,
  explodes blocks), `inst.py` (one record per block), `rooms.py` (seats per room), `proof.py`
  (seat count proof: 116 work seats, 213 seats in total), `layout.py` (writes
  `volt-floor1.layout.json`), `fit_to_twin.py` (places the floor in the building), `open_glass.py`.
  Source DWG: `20260915_SKY_MARK_NOIDA_1ST_VOLT_ENERGY_R16.dwg` (AutoCAD 2010 format, not in git).
- `noida-skymark/volt/blender/` render package: `volt_render.py` (builds the floor from the layout,
  stairs from the CAD STAIR layer, WC fixtures from MEP blocks, assumed downlights, part masks for
  panels, seating, floor, surfaces, walls, soft, cafe), `variants.json`, camera files and the five
  `.command` launchers.
- `noida-skymark/volt/volt.js` the web viewer (three.js r169): floor picker, tour, free walk, 360
  photo spots, presenter remote (`remote.js`, `present.js`), design studio (`studio.js`).
- Skills to follow: `.claude/skills/archviz-quality-bar`, `blender-hyperrealism`,
  `archviz-blender-photorealism`, `3d-virtual-tour`, `archviz-facade-to-interior`,
  `archviz-floor-zoom`, `archviz-sales-configurator`.

## 4. What was wrong last time (each one is now a rule)

1. **Rendered on a cloud Blender.** Headless, no GPU, low samples, no live look at the scene. The
   result looked toned down. Rule: render only on the local Mac, through the Blender MCP, and look
   at the viewport and every render before anything is shared.
2. **Lighting not baked properly.** Flat, grey, wrong exposure, light that did not match the
   fixtures. Rule: light from the CAD's reflected ceiling plan (real fixture positions and
   types), daylight through the real windows, AgX view transform, exposure checked on a grey
   card, then bake lightmaps (Cycles bake, denoised) for the walkthrough.
3. **Ceiling not done right.** Rule: ceiling from the CAD (grid tiles, open ceiling, bulkheads,
   baffles, light fixtures, AC grilles, sprinklers) per room. Never one flat plane.
4. **Assets merged into one another.** Furniture clubbed, meshes joined, overlaps and z-fighting.
   Rule: one Blender object per CAD block instance, named `<tenant>_<layer>_<block>_<n>`, in a
   collection per layer. No joined meshes. A clearance check flags any two objects that overlap.
5. **Mixed walkthrough types.** Some were first-person walks, some were click-to-hop 360 photos.
   Rule: **every walkthrough is walk-to-move**: WASD and mouse on desktop, a joystick and drag on
   phones, collision with walls, eye height 1.6 m. No click-to-move-ahead and no jump cuts
   anywhere. The quick views in section 5 glide the camera; they never teleport it. 360 photos may
   stay only as optional "photo spots", never as the way to move.
6. **Walkthrough showed a white model.** Rule: the walk uses the baked, textured model, so what the
   client walks through matches the renders.
7. **Material swap was a colour overlay** on top of a render, not a real material change. Rule:
   every option a client picks is a true render (pre-rendered per part and per view, combined with
   object masks) or a real material swap on the baked model. No recolouring of pixels.
8. **The floor was cut open to the next building and showed half a floor.** Rule: the walk is
   enclosed by the real facade, slab and ceiling of that floor only.
9. **Doors, stairs and logos were missing at first.** Rule: every door from the CAD has a leaf and
   a frame, stairs come from the CAD STAIR layer, each tenant's logo is on its reception wall.

### Defects the user found in the live Volt walkthrough (17 Nov 2026)

10. **Furniture baked into the walking path.** Lounge sofas stood in the circulation, half inside a
    glass balustrade and floating off the floor. Rule: every object sits on the floor (snap to
    the slab), never intersects a wall, glass or railing, and keeps a clear walkway of at least
    1.2 m on every route the CAD shows as circulation. A placement check lists every overlap,
    every floating object and every walkway narrower than 1.2 m, and must be empty before export.
11. **The floor highlight on the building was messy.** The orange layer marking the selected floor
    showed through the glass, overlapped the facade and read as a smear. Rule: mark the selected
    floor with one clean band along its slab edge, or cut the building open at that floor (a
    section with the floors above lifted away). No translucent coloured layers drawn over the
    facade.
12. **Camera angles were bad.** Rooms opened looking at a wall, at the ceiling, into a grey void, or
    from inside the furniture, and the presenter had to drag and zoom to show the space. Rule:
    see section 5. Every stop has an authored camera, checked by screenshot.
13. **The floor flickered.** Two surfaces at the same height (carpet over slab, rug over carpet)
    fought each other. Rule: no coplanar faces. Layered floors sit at least 2 mm apart, the camera
    near plane is no closer than 0.1 m, and the slab under a finish is removed where the finish
    covers it.
14. **The point of view was wrong.** The camera sat too high or too close, so a meeting table
    filled the screen. Rule: eye height 1.6 m, never spawned within 0.8 m of furniture, and the
    whole room readable from the first frame.

## 5. Camera and movement standard (the premium feel)

Read these first, they are in this repo and hold the reference videos' lessons:
`.claude/skills/archviz-quality-bar`, `archviz-facade-to-interior`, `archviz-floor-zoom`,
`3d-virtual-tour`, `archviz-facade-detail`. Ask the user for more video references only if a shot
type is not covered there.

**Authored views, per room.** Every room has 3 to 4 authored viewpoints, set in Blender as named
cameras and exported with the model:
1. **Entry view**, the hero: standing at the door, eye height 1.5 to 1.6 m, looking about 45
   degrees across the room toward its main feature (the reception desk, the window wall, the
   table). Pitch 5 to 10 degrees down. Horizontal field of view 70 to 80 degrees: wide enough to
   read the whole room, never fisheye.
2. **Feature view**: closer on what sells the room (the logo wall, the workstation rows, the
   cafeteria counter).
3. **Reverse view**: from the far corner back toward the door, so the client sees the room both
   ways.
4. **Detail view** (optional): a material or finish worth showing, used with material swapping.

**Rules for every authored view.**
- The horizon is level. Vertical lines stay vertical (two-point perspective, no camera roll).
- No view opens on a blank wall, the ceiling, a void or the inside of an object.
- The room's name card never covers the subject; frame the subject in the left two thirds when a
  card sits on the right.
- Every view is screenshotted and approved before it ships.

**Movement.**
- Free walk is always available: walk-to-move, eye height 1.6 m, collision on.
- Quick views: Next and Prev (and the 1 to 4 keys) glide the camera to the room's next authored
  view along the walkway, eased, 1 to 1.5 seconds. No jump cuts, no teleporting.
- Going to another room glides through the door along the real route, never through walls.
- Tour mode plays the authored views as slow, premium shots: 4 to 6 seconds each, gentle dolly or
  pan, eased in and out, no sudden turns.
- Arriving in a room lands on its entry view. The presenter should never need to drag or zoom to
  show a space.
- After the quick views, the room's material options open (rule 7 in section 4).

**The building.**
- The opening shot is a slow orbit of the building at a three-quarter angle, not a static top view.
- Choosing a floor glides down to it and opens it as a clean section (rule 11), then lands on the
  floor's reception entry view.

## 6. Working setup

- Machine: the user's local Mac. Blender 4.2 or newer, driven live through the Blender MCP.
- Never render on the cloud container. Use the cloud only for git, web code and deploys.
- After every build step, take a viewport screenshot through the MCP and check it before going on.
- Keep each tenant in its own `.blend` collection set, linked into one building file
  `skymark_twin.blend`, so floors can be rendered and exported on their own.
- Commit scripts, layout JSON, camera files and final web assets. Never commit `.blend` files or
  raw renders over 2 MB (see `.gitignore`).

## 7. Tomorrow's task: ARCIL and Paytm floors in the same twin

Inputs the user will give: for each of ARCIL and Paytm, the 2D CAD (DWG) and the 3D renders made by
the design team (Paytm's design presentation is `20261104_PAYTM_DESIGN_PRESENTATION.pdf`).

Steps, per tenant:
1. **Read the CAD** with the Volt pipeline (`flatten.mjs`, `inst.py`, `rooms.py`), made generic so
   it takes a tenant name and a DWG path. List every layer and block name first, and map them to
   walls, glass, doors, columns, workstations, chairs, tables, fixtures, ceiling and lighting.
2. **Prove the seat count** with `proof.py`: work seats and all seats, per room, written to
   `<tenant>_seats.csv`.
3. **Check dimensions against the CAD**: column sizes, wall lengths, door widths, room areas,
   floor to ceiling height. Write `<tenant>_checks.json`, pass or fail per item, before rendering.
4. **Build the floor in Blender** with the rules in section 4, reusing Volt's asset library
   (chairs, desks, tables, fixtures) where the CAD block matches, and new assets only where needed.
5. **Match the design team's renders** for materials, colours, ceiling and lighting. Where the CAD
   and the renders disagree, the CAD wins for geometry and the renders win for finishes. Log every
   disagreement.
6. **Place it in the building** on its real floor with `fit_to_twin.py`, so the facade, lifts,
   stairs and core line up with the floors below and above.
7. **Set the authored views**: 3 to 4 named cameras per room as section 5 describes, plus the
   placement check (rule 10). Screenshot every view for the user to approve.
8. **Bake and export** the walkable model (glTF with lightmaps, meshopt), and render the stills and
   a short film from fixed cameras.
9. **Add it to the web twin**: the floor picker lists the tenant on its floor with its seat count,
   "Enter" lands on the reception entry view of the walk-to-move walkthrough, the gallery holds
   the stills.

Building-level:
- One building, one floor picker, every tenant on its floor. Empty floors stay grey and say
  "Available", not blank.
- The same ATLAS link keeps working: https://atlas.autopilotoffices.com/noida-skymark/

## 8. The quality bar (check before anything is shown)

- Geometry: every wall, column, door and desk within 20 mm of the CAD. Heights from the section or
  stated as assumed.
- Lighting: matches the fixtures in the CAD, no blown-out windows, no black corners, exposure
  consistent across rooms.
- Materials: physically based, with real texture scale (a 600 mm carpet tile looks 600 mm), no
  stretched or tiled-looking surfaces.
- Detail: bevels on furniture edges, skirting, door frames, switch plates, cable trays where the
  ceiling is open. No floating objects, no gaps at wall joins.
- Placement: the placement check (rule 10) is empty: nothing floating, nothing inside a wall, glass
  or railing, every walkway at least 1.2 m.
- Views: every room has its 3 to 4 authored views (section 5), each approved by screenshot.
- No flicker anywhere (rule 13), checked by walking every room.
- Walkthrough: walk-to-move only, 30+ frames per second on a MacBook Air and a mid-range phone,
  loads in under 10 seconds on office Wi-Fi.
- Honesty: anything assumed (heights, finishes not in the CAD) is listed on the page under
  "Assumptions".

## 9. What done looks like for tomorrow

- [ ] F1 Skymark twin with Volt, ARCIL and Paytm, each on its correct floor
- [ ] Seat count proof and a dimension check report for each tenant
- [ ] Photoreal stills per tenant (reception, workstations, meeting room, cafeteria, washroom)
- [ ] One walk-to-move walkthrough per tenant, with baked lighting, no click-to-hop
- [ ] 3 to 4 authored views per room, landing on the entry view, gliding between views
- [ ] Clean selected-floor marking on the building (slab band or section cut)
- [ ] Material options that are true renders (at least reception and workstations per tenant)
- [ ] Live on the same ATLAS link, no login, also shown inside https://atlas.autopilotoffices.com/landlord/
- [ ] A screenshot review of every view by the user before the client sees it

## 10. Confirm before starting

1. **Floors.** The landlord page data lists Altruist and ARCIL on the 2nd floor, Volt and Paytm on
   the 1st. The user said the other two clients are on the 2nd floor. Confirm each tenant's floor.
2. **Tenants.** Tomorrow is ARCIL and Paytm (Altruist later)? Confirm.
3. **Paytm design option.** The presentation has several workstation ceiling options; which one is
   built?
4. **Heights.** Floor to floor and floor to ceiling for each floor, if a section drawing exists.

## 11. Never

- Never show an AI-generated image or clip as a render or a walkthrough.
- Never recolour pixels and call it a material change.
- Never use click-to-move navigation.
- Never render on the cloud container.
- Never merge furniture into one mesh.
- Never open a room on a wall, the ceiling, a void or inside furniture.
- Never leave furniture in a walkway or floating off the floor.
- Never draw translucent coloured layers over the facade.
- Never ship a view the user has not seen.
