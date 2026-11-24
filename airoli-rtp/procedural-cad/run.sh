#!/bin/zsh
# Procedural semantic CAD, one floor: DWG -> inventory -> typed assemblies -> FreeCAD model -> IFC + semantic DXF + JSON -> trace page.
#   ./run.sh --dwg "/path/20261118_6TH FLOOR (1).dwg"            full run into out/ (docs refreshed at the top level)
#   ./run.sh --variant variants/door2400_mixed.json --out out_variant   same drawing, one rule changed
#   ./run.sh --views                                              also save FreeCAD GUI screenshots into views/ (opens a FreeCAD window briefly)
# Needs: libredwg (dwg2dxf), FreeCAD 1.1 (freecadcmd), and a Python with ezdxf, shapely, matplotlib, jsonschema, ifcopenshell (PY=...).
# The DWG is untrusted data: it is converted in its own empty folder and every Python step runs isolated (-I).
set -euo pipefail
HERE=${0:A:h}; S=$HERE/scripts
PY=${PY:-python3}; FC=${FC:-/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd}
DWG= OUT=$HERE/out WORK=${WORK:-${TMPDIR:-/tmp}/procedural-cad-work} VARIANT= VIEWS=0   # work files (incl. the DXF conversion) stay OUTSIDE the repo
while [ $# -gt 0 ]; do case "$1" in
  --dwg) DWG="$2"; shift 2;; --out) OUT="${2:A}"; shift 2;; --work) WORK="${2:A}"; shift 2;;
  --variant) VARIANT="${2:A}"; shift 2;; --views) VIEWS=1; shift;; *) echo "unknown arg $1" >&2; exit 2;; esac; done
mkdir -p "$OUT" "$WORK"
cd "$WORK"                                   # never run from the data folder
if [ -n "$DWG" ]; then
  DATA="$WORK/dwg_data"; rm -rf "$DATA"; mkdir -p "$DATA"
  dwg2dxf -y -o "$DATA/drawing.dxf" "$DWG" >/dev/null 2>&1 || [ -s "$DATA/drawing.dxf" ]
  "$PY" -I $S/flatten.py "$DATA/drawing.dxf" "$WORK/flat.json.gz" $HERE/config.json 2>/dev/null | tail -1
  "$PY" -I $S/pairs.py "$WORK/flat.json.gz" "$WORK"
fi
[ -s "$WORK/pieces.json" ] || { echo "no $WORK/pieces.json: run once with --dwg" >&2; exit 2; }
if [ -n "$VARIANT" ]; then "$PY" -I $S/variant.py "$VARIANT" "$OUT/rules.variant.json"; export PCAD_RULES="$OUT/rules.variant.json"; fi
"$PY" -I $S/inventory.py "$WORK" "$OUT"
"$PY" -I $S/infer.py "$WORK" "$OUT/assemblies.json"
"$PY" -I $S/validate.py "$OUT/assemblies.json"
"$PY" -I $S/questions.py "$OUT/assemblies.json" "$OUT"
"$PY" -I $S/to_spec.py "$OUT/assemblies.json" "$OUT/spec.json"
rm -f "$OUT/rtp6_floor6.FCStd" "$OUT/rtp6_floor6.ifc" "$OUT/rtp6_floor6.mesh.json"     # never judge a run by a file left from an earlier one
set +e
FC_HERE=$S FC_SPEC="$OUT/spec.json" FC_OUT="$OUT/rtp6_floor6" "$FC" $S/fc_run.py > "$OUT/freecad.log" 2>&1; FCSTATUS=$?
set -e
grep -E "^REPORT|Traceback" "$OUT/freecad.log" | cut -c1-300 || true
if [ $FCSTATUS -ne 0 ] || [ ! -s "$OUT/rtp6_floor6.FCStd" ] || [ ! -s "$OUT/rtp6_floor6.ifc" ] || [ ! -s "$OUT/rtp6_floor6.mesh.json" ]; then
  echo "FREECAD BUILD FAILED (exit $FCSTATUS); see $OUT/freecad.log" >&2; exit 1; fi
"$PY" -I $S/semantic_out.py "$OUT/assemblies.json" "$OUT"
"$PY" -I $S/trace_data.py "$WORK" "$OUT/assemblies.json" "$OUT/trace_data.json"
"$PY" -I $S/plan_png.py "$OUT/assemblies.json" "$OUT/plan_types.png"
# verification is authoritative: its exit status decides whether this run passed
set +e
"$PY" -I $S/verify.py "$OUT/assemblies.json" "$OUT" > "$OUT/verify.log" 2>&1; VSTATUS=$?
set -e
tail -30 "$OUT/verify.log"
# informational audits (they never decide pass/fail; their own status is printed)
set +e
"$PY" -I $S/spotcheck.py "$WORK" "$OUT/assemblies.json" "$OUT" > "$OUT/spotcheck.log" 2>&1; echo "spot checks (informational, non-blocking): exit $?"; head -3 "$OUT/spotcheck.log"
if [ -s "$OUT/audit/hosts_before.json" ]; then "$PY" -I $S/host_audit.py "$OUT/assemblies.json" "$OUT" > "$OUT/audit/host_audit.log" 2>&1; echo "door host audit (informational, non-blocking): exit $?"; fi
set -e
if [ -z "$VARIANT" ] && [ "$OUT" = "$HERE/out" ]; then
  cp "$OUT/INVENTORY.md" "$OUT/inventory.json" "$OUT/ASK_DESIGNER.md" "$HERE/"
fi
if [ "$VIEWS" = 1 ]; then V=$(case "$(basename $OUT)" in out|out_next) echo fc;; out_variant|out_variant_next) echo variant;; *) basename $OUT;; esac); zsh $S/fc_views.sh "$OUT/rtp6_floor6.FCStd" "$OUT/rtp6_floor6.report.json" "$OUT/assemblies.json" "$HERE/views/$V"; rm -f "$OUT"/*.FCBak; fi
if [ $VSTATUS -ne 0 ]; then
  echo "VERIFICATION FAILED (verify.py exit $VSTATUS): $(grep TOTAL "$OUT/verify.log")  -- outputs written to $OUT but NOT verified" >&2; exit 1; fi
echo "verification PASSED: $(grep TOTAL "$OUT/verify.log") -> $OUT"
