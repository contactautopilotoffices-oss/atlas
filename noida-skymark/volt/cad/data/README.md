# CAD pipeline data

Intermediate files from reading the Volt DWG (`20260915_SKY_MARK_NOIDA_1ST_VOLT_ENERGY_R16.dwg`, not stored here):

- `flat.json.gz`: every entity of the DWG with blocks exploded, written by `../flatten.mjs` (acad-ts). Unzip with `gunzip -k flat.json.gz`.
- `inst.json`: one record per block instance (name, layer, centre, size, rotation), from `../inst.py`.
- `volt_seats.csv`: every seat with its block and room, from `../rooms.py`.

With these, `layout.py`, `fit_to_twin.py` and `open_glass.py` can be re-run without the DWG reader.
