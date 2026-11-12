#!/bin/bash
# Build the zip to hand over: bash pack.sh <out.zip>
set -e; cd "$(dirname "$0")"; T=$(mktemp -d); D="$T/volt-blender"; mkdir -p "$D/models"
cp volt_render.py cameras.json mvp_cameras.json nodes_cameras.json make_nodes.py README.md "1 Quick test.command" "2 Render everything.command" "3 MVP renders.command" "4 Design studio.command" variants.json "$D/"; cp ../volt-floor1.layout.json "$D/"; cp models/*.glb "$D/models/"
OUT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; rm -f "$OUT"; (cd "$T" && zip -qr "$OUT" volt-blender); echo "$OUT"
