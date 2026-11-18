# Reliable Tech Park: exterior twin plan (building + 500 m context)

Draft, 19 Nov 2026. The 2D plans are signed off: both 6th-floor options and the 4th-floor suite are
shown to the client as "on offer".

## 1. What we know now (from the survey on 19 Nov)

- **Pin:** 19.16922 N, 73.00177 E, Thane-Belapur Road, MIDC Airoli.
- **Footprint and true north: solved.** OpenStreetMap has the building ("Reliable Tech Park", way
  1072909784). The CAD outline, rotated 91 degrees clockwise, sits on it with a 91 % overlap. So the
  **CAD's "up" is true east**. The real building is an L:
  - a long **east arm** (about 133 m, running north-south, rounded south end, where the pin is);
  - a **north arm** (about 100 m, running east-west, rounded west end);
  - the chamfered inner corner faces south-west, onto the campus court.
  - Plot: `review/north_fit.png` (local only).
- **Facade, from public photos (2016 to 2022):**
  - blue-green reflective curtain wall in horizontal bands;
  - silver bands at each slab edge (A.C.P. cladding);
  - stacked, rounded and terraced ends;
  - cylindrical drums on the roof at the rounded ends, with a white dome over one;
  - a red **RELIABLE** sign with an "R" logo;
  - pink and violet uplighting at night;
  - palms and a car park on the court side.

  The CAD has the facade layers too: STRUCTURAL GLAZING, A.C.P. CLADDING, RCC FINS, STRUCTURAL ASSEMBLY,
  RAILING and M.S. STEEL. So the facade can be built from the drawing, not guessed.
- **Neighbours within 650 m:** 2,260 OSM buildings. The named ones: Sutherland and BSV (two slab
  blocks), Clover Infotech, Universal Sompo, Lumina CloudInfra data centre, Gramercy Techpark, Liberty
  Tower (10 floors), Empire Tower, Mindspace Airoli buildings 1 to 4, the 220 kV Kalwa substation with
  its transmission pylons, and a pond to the north-west. East of Central Road is dense low-rise housing
  (Gavate Wadi, Yadav Nagar); MIDC sheds are to the south. Only 1 of 2,260 has a height in OSM, so
  heights come from the Copernicus 30 m surface model plus photos.
- **Floor count:** about 8 floors plus roof drums, from photos. **Not confirmed.** This is needed from
  the landlord (section drawing or brochure) before the facade is final.

## 2. Why the Volt / Skymark exterior looked cartoonish

1. **Neighbours were plain extrusions on a flat ground plane.** They had no windows, no roof clutter,
   no material response, and every block had the same grey.
2. **The ground was empty.** There were no road markings, kerbs, medians, footpaths, trees, cars,
   pylons, signage or dirt.
3. **No atmosphere.** There was no haze or aerial perspective, so the distance looked as sharp and
   clean as the foreground.
4. **The glass reflected nothing real.** Glass without a matching environment map reads as flat blue
   plastic.
5. **One light state.** The same light everywhere means nothing changes, so nothing feels real.

Each of these gets a rule and a check below.

## 3. The plan, in the traditional Blender order

### E1. Massing true to the facts (gate: fit sheet)
- Hero building from the CAD outline, every floor as its own group (slab, facade band, glass, fins),
  so any floor can later slide out for the floor-plate reveal.
- Floor heights from the landlord's section. Until then: an assumed floor-to-floor height, checked
  against the surface model's height and the number of bands in the photos, and logged.
- Terrain from Copernicus GLO-30 out to 3 km, so the Parsik hills to the east form a real skyline.
- Neighbours: Overture/OSM footprints, height from the surface model, sorted into classes:
  - **Class A** (hero): RTP itself.
  - **Class B** (named, within about 200 m): Sutherland, BSV, Clover, Lumina DC, Gramercy, Liberty
    Tower, and the substation. Each gets its real facade type (glass curtain wall, punched windows,
    or industrial cladding) from photos.
  - **Class C** (the rest of the 500 m): procedural low-rise roofs (tin, terracotta, terrace water
    tanks) for the housing east of Central Road, and shed roofs for MIDC. These are instanced, never
    bare boxes.
- **Check:** footprints within 1 m of OSM; RTP's height within 3 m of the surface model; no
  untextured box within 300 m.

### E2. Facade detail (gate: photo-match sheet)
- Curtain-wall bands, mullion rhythm from STRUCTURAL ASSEMBLY, A.C.P. bands, RCC fins, rounded
  terraces, roof drums and dome, the RELIABLE sign, the entrance canopy, and the court-side car park.
- **Photo-match test:** for 6 to 8 reference photos, a Blender camera is matched to the photo
  (vanishing points), and the render is laid over the photo. Proportion, band count and silhouette
  must line up. Each sheet shows the photo, the render and the overlay. This is the exterior's version
  of the "browser vs Blender" check, and it is the gate that stops "cartoonish".

### E3. Ground and life (gate: street-level stills)
- Roads from OSM at their real widths: Thane-Belapur Road as a divided arterial with a planted median,
  Central Road, MIDC Road, and the campus loop. Kerbs, lane markings and footpaths included.
- Ground surface by land use (paved, dirt, grass, water) with procedural materials. Google satellite
  imagery is **not** used as a texture, because its terms forbid it. Sentinel-2 (free, 10 m) may tint
  the colour at a distance.
- Trees from OSM, plus scatter on green areas (palms on the court, as in the photos). Transmission
  pylons and lines from the substation, street lamps, parked cars on the court, and buses on
  Thane-Belapur Road.

### E4. Light and atmosphere, baked (gate: time-of-day sheet)
Real sun position for 19.17 N, 73.00 E, in five states, rendered and baked:

| State | Sky | Building | Context |
| --- | --- | --- | --- |
| Morning (09:30) | Clear, low east sun over Parsik hill | East arm lit, court in shade | Long shadows west |
| Midday (13:00) | High sun, light haze | Glass reflects sky | Short shadows |
| Golden hour (17:45) | Warm west sun | North arm's west end glows | Haze, warm aerial perspective |
| Blue hour (18:45) | Deep blue | Interior floors lit, uplights on, RELIABLE sign on | Street lamps on |
| Night / moonlight | Moonlit haze, no stars (city glow) | Pink-violet uplighting as in the photos | Sodium and LED lamps, car lights |

Optional sixth state: monsoon overcast, because Mumbai clients know it.

- Blender: physical sky, volumetric haze for aerial perspective, emissive interiors per floor.
- Web: per state, a baked lightmap set for Class A and B, a sky dome, and **an environment map
  rendered from RTP's position**, so the glass reflects the real neighbours. States cross-fade.
- **Check:** each state is scored for blown or crushed pixels (as the interior's grey card does),
  and the glass reflection must show neighbours, not a gradient.

### E5. Web bundle (gate: browser parity + frame rate)
- three.js, the same viewer as F1 Skymark. Class A is detailed, Class B is medium, Class C is
  instanced; terrain and haze are in the shader.
- The checks from the pipeline plan (flicker, overlapping surfaces, browser vs Blender match) run on
  the exterior too, plus the frame rate on a MacBook Air and a phone.
- Then the floor-plate reveal: the offered floor (4th or 6th) slides out of the facade and opens into
  the signed-off 2D plan.

## 4. Who does what

- **This session (advisor):** gates, reviews and sign-off sheets.
- **Exterior worker (Opus, one session):** E1 to E5 in Blender.
- **Interior worker (Opus, one session):** G0 to G2 for the 4th-floor suite and both 6th options; the
  brief is in `AGENT_BRIEF_INTERIOR.md`.
- One Mac, 16 GB: **never two Cycles jobs at once.** The workers take turns on renders and bakes; data
  prep and modelling can overlap.

## 5. Needed from the founder or landlord

1. Floor count, floor-to-floor height, or a section or elevation drawing.
2. Any brochure renders or drone photos of RTP (better references than public photos).
3. Is the RELIABLE sign and logo allowed in client material?
