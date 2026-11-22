#!/bin/zsh
# Overnight shot renders for the Andheri film. Run from the repo root. Each shot: PNG frames + pins.json in andheri-project/film/shots/out/<shot>/
cd "$(dirname $0)/../../.."
B=(env PYTHONPATH=$PWD/.w3d/bpylib /Applications/Blender.app/Contents/MacOS/Blender -b --python-use-system-env --python scripts/world/diorama.py --)
D=(.w3d/data/scene.json .w3d/data/world.json .w3d/tex)
O=andheri-project/film/shots/out
Q=(--far-field 2500 --sky-mode physical --sky-cam 0.12 --samples 24 --pct 75)
PRV=(--slab-min 1100 --hero-blend .w3d/privilon_hero.blend --hero-fit --neighbour-hero 723-avenue=andheri-project/_build/exteriors/723-avenue.blend)
A723=(--slab-min 1100 --hero-blend andheri-project/_build/exteriors/723-avenue.blend --roof-garden --lobby --glow-floors 13,14 --glow-k 9 --neighbour-hero privilon=.w3d/privilon_hero.blend)
SUNRISE=(--hdri .w3d/assets/zwartkops_start_morning_4k.hdr --sun-az 114 --sun-el 5.4 --sky 0.8 --sun 3 --night 0.25 --exposure 0.2 --haze 0.00035)
DUSK=(--hdri .w3d/assets/cedar_bridge_sunset_2_4k.hdr --sun-az 250 --sun-el -4 --sky 0.12 --night 1.4 --exposure 1.4 --haze 0.0003)
shot() { echo "== $1 $(date +%H:%M)"; "${B[@]}" "${D[@]}" $2 $O "${@:3}" "${Q[@]}" --anim andheri-project/film/shots/shots.json $1 2>&1 | grep -E "LOGIC|ANIM|Error|Traceback" ; }
shot prv_sunrise privilon "${PRV[@]}" "${SUNRISE[@]}"
shot prv_dusk privilon "${PRV[@]}" "${DUSK[@]}"
shot a723_rise 723-avenue "${A723[@]}" "${DUSK[@]}"
shot close_pullback privilon "${PRV[@]}" "${DUSK[@]}"
echo "== queue done $(date +%H:%M)"
