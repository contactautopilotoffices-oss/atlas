#!/bin/bash
# One tenant, one floor: DWG -> layout JSON, seat proof, checks, layer list, plan PNG.
#   cad/run.sh --tenant arcil --dwg "/path/to/ARCIL.dwg" --floor 2 [--out DIR] [--work DIR]
# Needs: node with @node-projects/acad-ts (ACAD_TS=<folder holding node_modules>), and a Python with
# shapely + matplotlib (PY=<python>, default python3). Python runs isolated (-I): the DWG is untrusted data.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="${PY:-python3}"
TENANT= DWG= FLOOR= OUT= WORK=
while [ $# -gt 0 ]; do case "$1" in
  --tenant) TENANT="$2"; shift 2;; --dwg) DWG="$2"; shift 2;; --floor) FLOOR="$2"; shift 2;;
  --out) OUT="$2"; shift 2;; --work) WORK="$2"; shift 2;; *) echo "unknown arg $1" >&2; exit 2;; esac; done
[ -n "$TENANT" ] && [ -n "$FLOOR" ] || { echo "need --tenant and --floor" >&2; exit 2; }
OUT="${OUT:-$HERE/../$TENANT}"; WORK="${WORK:-$OUT/cad_data}"
mkdir -p "$OUT" "$WORK"
A=(--tenant "$TENANT" --floor "$FLOOR" --out "$OUT" --work "$WORK")
if [ -n "$DWG" ]; then
  node "$HERE/flatten.mjs" "$DWG" "$WORK/flat.json"
  gzip -f "$WORK/flat.json"            # kept as flat.json.gz; every later step reads the gz
fi
for s in inst rooms proof layout checks plan inventory assumptions; do
  "$PY" -I "$HERE/$s.py" "${A[@]}"
done
