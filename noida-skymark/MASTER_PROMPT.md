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
   phones, collision with walls, eye height 1.6 m. No click-to-move-ahead anywhere. 360 photos may
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

## 5. Working setup

- Machine: the user's local Mac. Blender 4.2 or newer, driven live through the Blender MCP.
- Never render on the cloud container. Use the cloud only for git, web code and deploys.
- After every build step, take a viewport screenshot through the MCP and check it before going on.
- Keep each tenant in its own `.blend` collection set, linked into one building file
  `skymark_twin.blend`, so floors can be rendered and exported on their own.
- Commit scripts, layout JSON, camera files and final web assets. Never commit `.blend` files or
  raw renders over 2 MB (see `.gitignore`).

## 6. Tomorrow's task: ARCIL and Paytm floors in the same twin

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
7. **Bake and export** the walkable model (glTF with lightmaps, meshopt), and render the stills and
   a short film from fixed cameras.
8. **Add it to the web twin**: the floor picker lists the tenant on its floor with its seat count,
   "Enter" opens the walk-to-move walkthrough, the gallery holds the stills.

Building-level:
- One building, one floor picker, every tenant on its floor. Empty floors stay grey and say
  "Available", not blank.
- The same ATLAS link keeps working: https://atlas.autopilotoffices.com/noida-skymark/

## 7. The quality bar (check before anything is shown)

- Geometry: every wall, column, door and desk within 20 mm of the CAD. Heights from the section or
  stated as assumed.
- Lighting: matches the fixtures in the CAD, no blown-out windows, no black corners, exposure
  consistent across rooms.
- Materials: physically based, with real texture scale (a 600 mm carpet tile looks 600 mm), no
  stretched or tiled-looking surfaces.
- Detail: bevels on furniture edges, skirting, door frames, switch plates, cable trays where the
  ceiling is open. No floating objects, no gaps at wall joins.
- Walkthrough: walk-to-move only, 30+ frames per second on a MacBook Air and a mid-range phone,
  loads in under 10 seconds on office Wi-Fi.
- Honesty: anything assumed (heights, finishes not in the CAD) is listed on the page under
  "Assumptions".

## 8. What done looks like for tomorrow

- [ ] F1 Skymark twin with Volt, ARCIL and Paytm, each on its correct floor
- [ ] Seat count proof and a dimension check report for each tenant
- [ ] Photoreal stills per tenant (reception, workstations, meeting room, cafeteria, washroom)
- [ ] One walk-to-move walkthrough per tenant, with baked lighting, no click-to-hop
- [ ] Material options that are true renders (at least reception and workstations per tenant)
- [ ] Live on the same ATLAS link, no login, also shown inside https://atlas.autopilotoffices.com/landlord/
- [ ] A screenshot review of every view by the user before the client sees it

## 9. Confirm before starting

1. **Floors.** The landlord page data lists Altruist and ARCIL on the 2nd floor, Volt and Paytm on
   the 1st. The user said the other two clients are on the 2nd floor. Confirm each tenant's floor.
2. **Tenants.** Tomorrow is ARCIL and Paytm (Altruist later)? Confirm.
3. **Paytm design option.** The presentation has several workstation ceiling options; which one is
   built?
4. **Heights.** Floor to floor and floor to ceiling for each floor, if a section drawing exists.

## 10. Never

- Never show an AI-generated image or clip as a render or a walkthrough.
- Never recolour pixels and call it a material change.
- Never use click-to-move navigation.
- Never render on the cloud container.
- Never merge furniture into one mesh.
- Never ship a view the user has not seen.
