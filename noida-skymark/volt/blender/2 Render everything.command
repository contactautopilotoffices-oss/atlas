#!/bin/bash
# Double-click me. Renders every room: a still and a 360 degree panorama each.
# It can be stopped (Ctrl+C) and started again; finished pictures are kept.
cd "$(dirname "$0")"
BL="/Applications/Blender.app/Contents/MacOS/Blender"
if [ ! -x "$BL" ]; then echo "Blender was not found in Applications."; read -p "Press Enter to close."; exit 1; fi
caffeinate -i "$BL" -b -P volt_render.py -- --out renders --quality normal
echo; echo "Finished. The pictures are in: $(pwd)/renders"; echo "Zip the 'renders' folder and send it back."; open renders
read -p "Press Enter to close."
