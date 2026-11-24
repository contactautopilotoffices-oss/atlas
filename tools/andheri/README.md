# Andheri rebuild helpers

These operate on the agreed three properties. The purchased add-on and original DWGs stay outside Git. Commands below run from the repository root. Use a Python environment with `requirements.txt` for extraction/preparation, and Blender's Python for scene building.

## PBF → native Concept Studio OSM

```sh
python extract_contexts.py --help
```

Or from the repository root:

```sh
python tools/andheri/extract_contexts.py --source /path/to/western-zone.osm.pbf --output /tmp/andheri-contexts
```

This scans the local PBF with complete multipolygon assembly and a temporary disk-backed node index. It writes source JSON and provenance per property; it does not download map data. Allow temporary disk space for the node index.

For each property, run the adapter below with its existing pin. It uses the licensed package's original terrain/OSM operators, saves an editable `.blend` and native Float32 `.glb`, and retains source data separately. A DEM download may be needed unless cached. No global preferences are saved.

```sh
Blender --background --factory-startup --python-exit-code 1 --python tools/andheri/import_context.py -- --addon-path /path/to/addon-parent --site 723-avenue --lat 19.109713 --lon 72.884422 --radius 600 --output /tmp/andheri-contexts/723-avenue
```

Other pins: Corporate `19.110625,72.859637`; Privilon `19.108207,72.879563`. `--addon-path` must contain the licensed `concept_studio_osm` directory. Optional `--cache` points to an existing terrain cache.

## Checked semantic CAD → editable Blender interiors

The checked-in `*-semantic.json` and `*-furniture.json` files preserve the reviewed DWG-derived XY geometry. They are the inputs to this presentation build. Importing another DWG requires a separate source extraction/plan-window review; these helpers do not claim arbitrary CAD ingestion.

```sh
python tools/andheri/prepare_interiors.py --input media/flipkart-andheri/cad --extras media/flipkart-andheri/cad --output /tmp/andheri-prepared
Blender --background --factory-startup --python-exit-code 1 --python tools/andheri/build_interiors.py -- --input /tmp/andheri-prepared --output /tmp/andheri-models
```

The build keeps role/material groups and per-object CAD IDs in the editable master. Display floors, verticals, finishes and ceilings remain explicit review assumptions. Ceilings are separate GLBs. `--id` restricts a build; `--render` adds the two representative proof sets.

## Output checks

```sh
node tools/andheri/check_outputs.mjs
node airoli-rtp/demo/tests/floors.test.mjs
```

Web output uses native Float32 geometry. There is no lossy compression stage. The source PBF is not uploaded; only the three local extracts and their generated models are served.
