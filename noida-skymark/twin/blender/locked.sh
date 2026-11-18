#!/bin/bash
# Run one Cycles job under the shared render lock (one Cycles job at a time on the 16 GB Mac).
#   locked.sh <command ...>     takes /Users/lohit/.cache/atlas-blender-render.lock (retries every 60 s), always releases it
LOCK="${ATLAS_RENDER_LOCK:-$HOME/.cache/atlas-blender-render.lock}"
mkdir -p "$(dirname "$LOCK")"
until mkdir "$LOCK" 2>/dev/null; do echo "$(date +%H:%M:%S) waiting for the render lock" >&2; sleep 60; done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM
echo "$(date +%H:%M:%S) lock taken: $*" >&2
"$@"
