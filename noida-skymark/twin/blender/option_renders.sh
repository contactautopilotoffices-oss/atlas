#!/bin/zsh
# True per-option renders: rebuild the floor with each choice of a style option group, light it with the main set's
# exposure and daylight (so options compare fairly), render the same camera(s).
#   option_renders.sh <tenant> <layout> <style> <out> <group> "<choice1 choice2 ...>" "<camera-name regex>"

T=$1; L=$2; S=$3; OUT=$4; G=$5; CHOICES=(${=6}); CAMS=$7
B=/Applications/Blender.app/Contents/MacOS/Blender; HERE=${0:A:h}
EV=$(python3 -c "import json;print(json.load(open('$OUT/${T}_greycard.json'))['exposure_ev'])")
DS=$(python3 -c "import json,os;p='$OUT/${T}_windows.json';print(json.load(open(p)).get('daylight_scale',1.0) if os.path.exists(p) else 1.0)")
mkdir -p $OUT/review $OUT/options
for c in $CHOICES; do
  O=$OUT/options/$G-$c; t0=$(date +%s)
  $B -b --factory-startup --python $HERE/build_floor.py -- --tenant $T --layout $L --style $S --out $O --option $G=$c --stage geometry,light --exposure-ev $EV --daylight-scale $DS > $O.log 2>&1 || { echo "build failed: $c"; tail -5 $O.log; continue; }
  $B -b --factory-startup --python $HERE/build_floor.py -- --tenant $T --layout $L --style $S --out $O --option $G=$c --stage stills --cameras-from $OUT/${T}_cameras_plan.json --camera-names "$CAMS" --stills-kinds entry,feature,reverse,detail >> $O.log 2>&1
  for f in $O/stills/*.png(N); do case $f in *_mask_*) ;; *) cp $f $OUT/review/option_${G}-${c}_${f:t}; esac; done
  echo "$G=$c: $(( $(date +%s) - t0 )) s"
done
