#!/bin/bash
# The drone shot, rendered in passes so a complete cut exists early:
#   pass 1 every 6th frame, pass 2 fills to every 3rd, pass 3 fills the rest.
# drone.py skips frames already on disk, so this can be re-run after a restart.
#   nohup scripts/te/render_drone.sh SITE_DIR OUT_DIR > queue.log 2>&1 &
SITE=${1:-.w3d/te/site}; OUT=${2:-.w3d/te/drone}; PY=${PY:-.w3d/bin/python}; SAMPLES=${SAMPLES:-12}
cd "$(dirname "$0")/../.."
$PY scripts/te/drone.py "$SITE" "$OUT" --frames 1-288 --step 6 --samples $SAMPLES
$PY scripts/te/drone.py "$SITE" "$OUT" --frames 4-288 --step 6 --samples $SAMPLES
$PY scripts/te/drone.py "$SITE" "$OUT" --frames 1-288 --step 1 --samples $SAMPLES
echo "queue done"
