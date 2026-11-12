#!/bin/bash
# Double-click me. Renders the 360 degree walk: a panorama at each of 32 spots along the MVP route
# (lift lobby, reception, entry, open workstations, meeting rooms, conference room, cafeteria, washrooms),
# about 4 m apart so the walk can hop from one to the next. Output: renders_walk/panos/nXX.jpg
cd "$(dirname "$0")"
BL="/Applications/Blender.app/Contents/MacOS/Blender"
if [ ! -x "$BL" ]; then echo "Blender was not found in Applications."; read -p "Press Enter to close."; exit 1; fi
SPOTS="n01,n03,n06,n13,n16,n20,n21,n25,n26,n27,n28,n29,n30,n31,n33,n34,n35,n36,n37,n39,n40,n41,n43,n44,n45,n46,n47,n48,n49,n51,n52,n53"
caffeinate -i "$BL" -b -P volt_render.py -- --out renders_walk --quality normal --cameras nodes_cameras.json --what panos --rooms "$SPOTS"
echo; echo "Finished. The 360s are in: $(pwd)/renders_walk/panos"; echo "Zip the 'panos' folder and send it back."; open renders_walk/panos
read -p "Press Enter to close."
