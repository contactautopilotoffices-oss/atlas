#!/bin/bash
# Double-click me. Renders the pictures for the web design studio (studio.html): for each MVP view, the photoreal still,
# a black and white mask per part (panels, seating, floor, surfaces, walls, soft seating, cafe) and the four designer
# palettes in variants.json as full renders of the same view.
cd "$(dirname "$0")"
BL="/Applications/Blender.app/Contents/MacOS/Blender"
if [ ! -x "$BL" ]; then echo "Blender was not found in Applications."; read -p "Press Enter to close."; exit 1; fi
caffeinate -i "$BL" -b -P volt_render.py -- --out renders_mvp --quality normal --cameras mvp_cameras.json --what none --masks --variants variants.json
echo; echo "Finished. The studio pictures are in: $(pwd)/renders_mvp/configurator"; echo "Zip the 'configurator' folder and send it back."; open renders_mvp/configurator
read -p "Press Enter to close."
