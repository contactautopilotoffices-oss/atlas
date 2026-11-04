# Skymark F-1, Sector 6, Noida (`/skymark`)

This is a showcase for builders. It shows the real building in its real
street, and opens one floor as a dollhouse with the tenant's fit-out in 3D.
The MVP covers Volt's first floor, taken from Autopilot's design and build
deck (21 Aug 2026). The login is `SKYMARKDEMO` / `SKY1234`, either on the
page itself or through the site's front page.

## What is real

- **The building**
  - Plot F-01, Sector 6, G+4 with basements, 90,551 sq ft leasable, on a
    2,940 sq m plot. Source: Skymark Group.
  - Its footprint (1,784 sq m) comes from Overture Maps.
  - Storey heights are not published. The model uses 4.5 m for the ground
    floor and 3.9 m for typical floors.
- **The context**
  - With `GOOGLE_MAPS_BROWSER_KEY` set in Vercel, the page streams Google's
    photorealistic 3D tiles: the real Skymark and the real 1 km around it.
    The key needs billing on, and the Map Tiles API enabled.
  - Without the key, the page uses our own model of every Overture footprint
    within 1 km (`context.py`). Those heights are estimated.
- **Volt's floor**
  - Traced to scale from the deck's layout. The 116'-10" dimension gives
    1 px = 1.80 cm.
  - The rooms, walls, columns, atrium and furniture follow the drawing, and
    the counts follow its legend.
  - Each room links to the deck's render of it.
  - Where Volt sits on the floor plate is indicative (the south-east end,
    full width). A key plan would fix it.
- **Street View** is the client's panorama, embedded without a key.

## Build

```bash
python3 scripts/world/fetch.py /tmp/skydata
```

Set the box to 77.3092-77.3292 E, 28.5821-28.6001 N first, and the surface
model tile to N28 E077.

```bash
.w3d/bin/python scripts/skymark/context.py /tmp/skydata /tmp/skyout
```

```bash
npx @gltf-transform/cli@4 weld /tmp/skyout/context.glb /tmp/skyout/w.glb
```

```bash
npx @gltf-transform/cli@4 meshopt /tmp/skyout/w.glb media/skymark-f1/context.glb --level high
```

```bash
node scripts/skymark/build.js
```

## Next

- Turn Google's mesh of Skymark flat when a floor opens
  (`TileFlatteningPlugin`). The code is in place but untested until the key
  works.
- High-poly furniture from the deck's renders (Meshy), Cycles stills, and a
  facade-to-floor flythrough (see `.claude/skills/archviz-*`).
- Paytm and the other floors, when their layouts come in.
