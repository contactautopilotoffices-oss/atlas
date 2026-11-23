# 02: The site, from a latitude and longitude

The aim is a metric scene of the real district around the pin, checked
against reality before any modelling starts.

## 1. The region file

`scripts/world/regions/<site>.json`. For an example, see `noida-skymark.json`:

```json
{ "about": "...", "lng0": 77.318977, "lat0": 28.591317, "ky": 110950.0,
  "clip": [W, S, E, N], "bundle": "examples/<client>.bundle.json",
  "deck_floors": {"<id>": 16}, "floor_h": 4.1, "ground_h": 6.0,
  "metro": {"L1": ["Line 1", "elevated", "#2a6fd0", "Line 1"]}, "station_line": "L1",
  "towers": true, "max_h": 160 }
```

- The scene is in metres, with its origin at (lng0, lat0), x pointing east
  and y north.
- Keep the clip box to about 1 to 3 km around the properties.

## 2. Open data (no key needed)

- **`scripts/world/fetch.py OUT`** reads the following straight from the
  public S3 bucket:
  - Overture Maps: buildings, road segments, water, land use and
    infrastructure. It keeps only the row groups whose bounding boxes touch
    the clip box.
  - The Copernicus GLO-30 surface model, used for heights.

  Set `BB` (the box) and `REL` (the newest Overture release) first.
- **`scripts/world/prep.py DATA OUT.json --region regions/<site>.json`**
  projects everything to metres.
  - It reads heights off the surface model: the highest 30 m cell over the
    footprint, minus the ground.
  - It caps small footprints, since a chawl can't be 40 m tall.
  - The deck's floors override the height of each property.
- OSM via Overpass is used for walking networks and stations (`maps/tools/route.py`).
- India has no Google Photorealistic 3D Tiles coverage. Don't promise a
  captured city mesh; build a reconstructed district instead.

## 3. Taking the surroundings before modelling (the survey)

Open data is incomplete: a campus block was missing from both Overture
and OSM. So before modelling, look at the street.

- **Street View in the browser.**
  - Look at each property and each landmark. Record the coordinates,
    heading, facade style, colour, height cues, entrances and station form
    as text in `scripts/world/refs/<area>.json` (`buildings`, `stations`,
    `added`, and one block per hero).
  - **Nothing is copied into the model; only observations are recorded.**
- **Satellite tracing.** A missing block is traced as a polygon in scene
  metres, with `basis` saying where it came from.
- **Headless capture.**
  - Headless Blender renders the "before" views of the empty site (the
    hero camera, the street camera and the station camera) with
    `diorama.py --render hero street station --fast`.
  - Compare them side by side with the Street View notes before building
    the hero.
- Each entry in `refs` overrides the facade and height of the nearest
  footprint. A building in `added` is new geometry.

## 4. Property zoning (how the Privilon plot was settled)

A hero building has to own its plot cleanly.

1. **Footprint from the CAD.**
   - Privilon was fitted to the developer CAD floor plate (22.4 × 67.3 m),
     not to the OSM blob.
   - When the outline is irregular, take the wall angle as the
     length-weighted edge angle (mod 90). That is `--hero-fit` in
     `diorama.py`; a minimum rectangle gave a −11.6° skew.
2. **Fixed outline in refs.**
   - Record the final polygon and height in `refs/<area>.json` under the
     property key (`privilon`, `corporate-avenue`), with a `note` that
     explains the decision.
   - The builder uses this polygon and nothing else.
3. **Clear the neighbours.**
   - Any context footprint that overlaps the property is removed or
     trimmed. The trim is recorded with `note_trim`, for example "campus
     long block cut back 9 m".
   - Small footprints standing on a road are dropped: `_on>0.6`, or
     `area<100 and _on>0.5`.
4. **The zones on the building itself** come from the developer's render or
   brochure (`privilon_hero.py`):
   - fin zones whose tops step down across a face;
   - recessed balcony slots;
   - a double-height glazed base on columns;
   - a glass crown.

   Write every dimension you estimated into the docstring.
5. **Orientation.**
   - Check which face is the main facade and which face is on the road.
   - The Corporate model once flipped, so verify north and west in a top
     render.

## 5. Satellite verification overlay (private)

```bash
GOOGLE_MAPS_KEY=$KEY python3 scripts/world/verify_overlay.py SCENE.json refs/<area>.json LAT LNG 250 /tmp/overlay.png "x,y;x,y"
```

- The map is satellite tiles at zoom 19 from the Map Tiles API, with:
  - cyan for the builder's footprints;
  - magenta for buildings added from the survey;
  - yellow for property outlines and surveyed dots;
  - red for gates.
- Show it to the founder. It is the "is it standing in the right place"
  check.
- **The PNG never enters the repo, a model or the explorer.** Keep it in
  /tmp or the scratchpad.

## 6. The logic gate

`scripts/world/check_logic.py` runs inside `diorama.py` after the build,
and fails the build when:
1. a surveyed building is missing, or not at its surveyed height;
2. a footprint is mostly road;
3. the property is missing, or a neighbour overlaps it;
4. two buildings overlap by more than a sliver;
5. a station model or its clearance is broken;
6. a camera starts inside a building, which renders a black frame.

Extend the gate whenever a new kind of mistake reaches the founder. Never
ship with `--allow-logic-fail`.
