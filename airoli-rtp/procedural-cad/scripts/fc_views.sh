#!/bin/zsh
# usage: fc_views.sh <FCStd> <report.json> <assemblies.json> <out_prefix>
# Opens the model in the FreeCAD GUI with its own config folder (the user's FreeCAD settings are untouched), saves PNGs, quits.
HERE=${0:A:h}; U=${TMPDIR:-/tmp}/procedural-cad-fcuser; mkdir -p $U ${4:h}
rm -f $4.log
FREECAD_USER_HOME=$U FC_FILE=$1 FC_REPORT=$2 FC_ASM=$3 FC_SHOT_PREFIX=$4 /Applications/FreeCAD.app/Contents/Resources/bin/freecad $HERE/fc_views.py > $4.stdout.txt 2>&1 &
PID=$!
for i in {1..240}; do kill -0 $PID 2>/dev/null || break; sleep 1; done
kill -0 $PID 2>/dev/null && { echo "timeout, killing FreeCAD"; kill $PID; }
wait $PID 2>/dev/null; cat $4.log 2>/dev/null | tail -12
