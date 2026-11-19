#!/bin/zsh
# Run a command while holding the shared Cycles lock (one Cycles job at a time on this Mac).
LOCK=/Users/lohit/.cache/atlas-blender-render.lock
until mkdir $LOCK 2>/dev/null; do sleep 60; done
trap 'rmdir $LOCK 2>/dev/null' EXIT INT TERM
echo "lock taken $(date +%T)"
"$@"
rc=$?
echo "lock released $(date +%T) rc=$rc"
exit $rc
