#!/bin/bash
# Double-click me. Renders one room at low quality (about a minute) to check everything works.
cd "$(dirname "$0")"
BL="/Applications/Blender.app/Contents/MacOS/Blender"
if [ ! -x "$BL" ]; then echo "Blender was not found in Applications."; read -p "Press Enter to close."; exit 1; fi
"$BL" -b -P volt_render.py -- --out renders-test --what stills --rooms open-workstations --quality preview
echo; echo "Test finished. The picture is in: $(pwd)/renders-test/stills"; open renders-test/stills
read -p "Press Enter to close."
