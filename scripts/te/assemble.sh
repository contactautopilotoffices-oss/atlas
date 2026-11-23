#!/bin/bash
# The drone shot from whatever frames have rendered so far:
#   1. find the finest regular step the rendered frames cover (6, 3 or 1);
#   2. motion-interpolate that sequence up to the full 24 fps (ffmpeg minterpolate, motion compensated);
#   3. clouds and grade (clouds.py);
#   4. encode H.264, CRF 16, BT.709, plus a poster.
#   scripts/te/assemble.sh RENDER_DIR WORK_DIR OUT.mp4
set -e
R=${1:-.w3d/te/drone}; W=${2:-.w3d/te/work}; OUT=${3:-.w3d/te/te_drone.mp4}; PY=${PY:-.w3d/bin/python}
N=288
rm -rf "$W/seq" "$W/full" "$W/graded"; mkdir -p "$W/seq" "$W/full" "$W/graded"
for STEP in 1 3 6; do
  ok=1; for ((f=1; f<=N; f+=STEP)); do [ -f "$R/$(printf %04d $f).png" ] || { ok=0; break; }; done
  [ $ok = 1 ] && break
done
[ $ok = 1 ] || { echo "not even every 6th frame yet"; exit 1; }
echo "using every ${STEP} frame(s)"
i=1; for ((f=1; f<=N; f+=STEP)); do ln -s "$(realpath "$R/$(printf %04d $f).png")" "$W/seq/$(printf %04d $i).png"; i=$((i+1)); done
if [ $STEP = 1 ]; then
  for x in "$W/seq/"*.png; do ln -s "$(realpath "$x")" "$W/full/$(basename "$x")"; done
else
  ffmpeg -v error -y -framerate $(echo "24/$STEP" | bc -l) -i "$W/seq/%04d.png" \
    -vf "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" -frames:v $N -start_number 1 "$W/full/%04d.png"
fi
$PY scripts/te/clouds.py "$W/full" "$W/graded" --frames $N --clear 84
ffmpeg -v error -y -framerate 24 -i "$W/graded/%04d.png" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart "$OUT"
cp "$W/graded/0288.png" "${OUT%.mp4}_poster.png"
echo "wrote $OUT"
