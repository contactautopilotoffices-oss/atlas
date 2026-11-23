#!/bin/zsh
# Second overnight pass (07:00): Corporate Avenue drone first, then the closing pull-back, which slows to 60-80 s a
# frame as the camera widens. The pull-back renders every other frame first (a usable cut), then fills the gaps.
cd "$(dirname $0)/../../.."
B=(env PYTHONPATH=$PWD/.w3d/bpylib /Applications/Blender.app/Contents/MacOS/Blender -b --python-use-system-env --python scripts/world/diorama.py --)
D=(.w3d/data/scene.json .w3d/data/world.json .w3d/tex)
O=andheri-project/film/shots/out
Q=(--far-field 2500 --sky-mode physical --sky-cam 0.12 --samples 24 --pct 75)
PRV=(--slab-min 1100 --hero-blend .w3d/privilon_hero.blend --hero-fit --neighbour-hero 723-avenue=andheri-project/_build/exteriors/723-avenue.blend)
CA=(--slab-min 1100 --hero-blend .w3d/corporate_hero.blend --hero-fit --campus --campus-road -768,44 --campus-box -865,-60,-735,60 --campus-gates "-796.6,58.1;-741.6,58.1")
DUSK=(--hdri .w3d/assets/cedar_bridge_sunset_2_4k.hdr --sun-az 250 --sun-el -4 --sky 0.12 --night 1.4 --exposure 1.4 --haze 0.0003)
AFTERNOON=(--hdri .w3d/assets/cedar_bridge_sunset_1_4k.hdr --sun-az 245 --sun-el 18 --sky 0.8 --sun 3 --night 0.1 --exposure 0.1 --haze 0.0003)
shot() { echo "== $1 $(date +%H:%M)"; "${B[@]}" "${D[@]}" $2 $O "${@:3}" "${Q[@]}" --anim andheri-project/film/shots/shots.json $1 2>&1 | grep -E "LOGIC|ANIM|hero fit|Error|Traceback" ; }
# pass 1: every other frame of both shots (a complete film early), then pass 2 fills the gaps
shot corp_drone corporate-avenue "${CA[@]}" "${AFTERNOON[@]}" --samples 16 --frames 1-200 --frame-step 2
shot close_pullback privilon "${PRV[@]}" "${DUSK[@]}" --samples 16 --frames 1-192 --frame-step 2
echo "== pass 1 done $(date +%H:%M)"
shot corp_drone corporate-avenue "${CA[@]}" "${AFTERNOON[@]}" --samples 16 --frames 2-200 --frame-step 2
shot close_pullback privilon "${PRV[@]}" "${DUSK[@]}" --samples 16 --frames 2-192 --frame-step 2
echo "== queue2 done $(date +%H:%M)"
