#!/bin/bash
# Double-click me. Renders the MVP: the 9 most important places of the office, in walking order,
# each as a high-quality still and a 360 degree panorama:
# lift lobby, reception, entry, open workstations, 6-seater meeting, 18-seater conference, cafeteria, gents and ladies washrooms.
cd "$(dirname "$0")"
BL="/Applications/Blender.app/Contents/MacOS/Blender"
if [ ! -x "$BL" ]; then echo "Blender was not found in Applications."; read -p "Press Enter to close."; exit 1; fi
caffeinate -i "$BL" -b -P volt_render.py -- --out renders_mvp --quality normal --cameras mvp_cameras.json --what stills,panos
echo; echo "Finished. The pictures are in: $(pwd)/renders_mvp"; echo "Zip the 'renders_mvp' folder and send it back."; open renders_mvp
read -p "Press Enter to close."
