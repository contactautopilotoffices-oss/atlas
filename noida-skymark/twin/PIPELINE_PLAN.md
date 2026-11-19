# DWG to website: a gated pipeline (draft plan, 2026-11-18)

Status: draft for the founder. Waiting on the Langflow export and Altruist's past designs.

## 1. Why the mistakes happened

| Mistake | Likely cause | Why nobody caught it |
| --- | --- | --- |
| Sofa in a walkway, floating sofa (Volt) | Furniture placed from CAD blocks with no physical check | The placement check came after Volt shipped |
| ARCIL carpet flickers in patches | Two floor surfaces too close together in the web model (z-fighting), or the camera's depth range too coarse | Every check ran inside Blender, and Blender renders fine. Nobody compared the browser with Blender |
| ARCIL chair bases broken | Furniture was decimated and instanced for the web, which breaks thin parts such as star bases | Same reason: no browser-side check after export |
| Paytm reception white slivers | Gaps or seams in the floor's lightmap, or a gap between floor finishes that shows the slab | Same reason |
| "No errors" reported while the page looked wrong | Success meant "loads without console errors", not "looks like the Blender render" | There is no picture-based gate |

**Root cause.** The checks measure geometry, not what a person sees. They run only in Blender, at the end, and no stage needs a sign-off before the next one starts.

## 2. The fix: gates, each with an automated check and a sign-off

Each gate writes a sign-off sheet (one image page plus its numbers). The next stage will not run until `signoff.json` has your approval for that gate. This makes the traditional Blender order (model, then materials, then light, then bake, then web) a hard rule instead of a habit.

| # | Gate | What you look at | What the machine checks first |
| --- | --- | --- | --- |
| G0 | CAD read | Seat proof, room list, assumptions | Seat counts match the deck; dimensions close; every block is accounted for |
| G1 | 2D plan | Coloured plan, circulation | 1.2 m walkways, egress, density (the Langflow validator rules) |
| G2 | Clay model | Grey renders from fixed cameras, top view | Nothing floating or inside a wall, no gaps, the enclosure closes, ceiling heights as assumed |
| G3 | Look | 3 to 5 look options for the hero rooms | Nothing; this is your taste call |
| G4 | Materials | Chosen look on the clay model, true-scale textures | Texture scale (a 600 mm tile is 600 mm), no stretched UVs, no missing maps |
| G5 | Lighting | Stills plus a grey-card exposure report | No blown or crushed pixels; the window view stays within 3 stops |
| G6 | Bake | Baked vs path-traced side by side | Lightmap texel density, seams, margin bleed, no black or white islands |
| G7 | Web parity | Browser frame next to the Blender frame, same camera | Picture match score per camera; flicker test; mesh check after export |
| G8 | Performance and deploy | Frame rate on a MacBook Air and a phone, load size | Frame rate and download budget met; then deploy |

Gates G2 and G7 are new, and they would have caught every item in section 1.

### The new automated checks (G6 and G7)

- **Flicker test.** Render 30 browser frames while the camera moves by millimetres. Any static surface whose pixels change from frame to frame is flagged with a heat map.
- **Coplanar-surface scan.** In the exported model, find any two surfaces facing the same way less than 2 mm apart. Fix them in Blender at the source, never with a browser offset.
- **Blender vs browser match.** Headless Chrome renders each authored camera, and the result is compared with Blender's baked render of the same camera. A low match score, or a hot spot on the difference map, fails the gate.
- **Mesh check after export.** Compare the decimated and instanced furniture with its source mesh for holes, flipped normals and lost thin parts. Hero furniture (chairs, reception desk) is never decimated.
- **Sliver check.** Raster the floor coverage from the top camera in the web model. Any pixel with no floor finish is a gap.

## 3. Where AI is used (and where it is not)

The rule: **AI proposes, deterministic code checks, a person signs off.** Your Langflow graph already works this way (planner prompt, then model, then command validator, then apply).

| Use AI for | Do not use AI for |
| --- | --- |
| 2D layout proposals (Langflow CAD_OS) | Geometry, seat counts, dimensions |
| Look options at G3 (Higgsfield) | The final renders (Blender does those, so they stay true to the CAD) |
| Turning a past design (Altruist) into a style file | Lighting, baking, export |
| Triage: spotting odd regions in renders for a person to check | Approving any gate |

### Higgsfield order (proposed)

Higgsfield draws from the clay model, not the other way round:

1. G2: Blender renders a grey clay still of each hero room, true to the CAD.
2. G3: Higgsfield image-to-image restyles those stills in 3 to 5 looks, keeping the geometry. This is cheap, takes minutes, and you pick one.
3. G4 and G5: Blender rebuilds the chosen look with real materials and real light, so the final picture is still physically true.

Higgsfield cannot be the final render, because it invents geometry. Desks and walls move, and seat counts break. It can only be the mood target.

## 4. Procedural modelling with Blender nodes

The builder is already procedural (Python, CAD in, model out). Geometry Nodes add live, adjustable families:

- Desk clusters, ceiling grids, baffles, fluted panels, carpet-tile patterns and skirting become node groups with sliders (spacing, colour, height). You can change a slider in Blender and see the result straight away.
- Python still reads the CAD and places the instances, because that is where the truth is.
- Before baking, the nodes are applied (instances made real) so the bake and the export see plain meshes.

Altruist's past designs become a style file (`styles/altruist.json`) plus a few node-group assets taken from their signature elements, then go through G0 to G8 like every other tenant.

## 5. A more premium web experience (three.js)

- Keep three.js (r169, already in place). The issues are in the data, not the engine.
- HDR lightmaps (KTX2) instead of 8-bit ones: deeper shadows, no banding.
- A tighter camera depth range per floor, plus the coplanar fix at the source. This removes flicker.
- Light ambient occlusion and anti-aliasing after rendering, adjusted by the parity check so it does not drift from Blender.
- Optional, for hero moments: a Gaussian splat of the finished Blender scene (a reception fly-through), loaded only where it earns its weight.

## 6. Order of work once the files arrive

1. Fix ARCIL flicker and chair bases and Paytm slivers through the new G6 and G7 checks. This proves the checks on known bugs.
2. Add `signoff.json` and sign-off sheets to the builder, so stages refuse to run without approval.
3. Connect Langflow CAD_OS output to the builder's layout format (G1).
4. Altruist: DWG (already in Downloads: `20260923_SKY MARK NOIDA_2nd floor_Altruist.dwg`) plus past designs, through G0 to G8, with Higgsfield at G3.
5. Convert repeated families to Geometry Nodes as each tenant needs them, not all at once.

## Open questions for the founder

- Sign-off cadence: every gate (G0 to G8), or only G1 (plan), G3 (look) and G7 (web)?
- Higgsfield: is it acceptable to send clay renders of a client's floor to an outside service? They show the layout but no names.
- Which Altruist past designs count as "the look": a deck, renders, photos of a built office?
