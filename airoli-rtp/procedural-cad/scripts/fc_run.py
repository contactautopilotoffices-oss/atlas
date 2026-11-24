"""Run inside FreeCAD's headless interpreter:
    FC_SPEC=<spec.json> FC_OUT=<out prefix> freecadcmd fc_run.py
Builds <prefix>.FCStd, .ifc, .mesh.json, .report.json from the spec (see fc_build.py)."""
import os, sys, json, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(os.environ.get("FC_HERE") or __file__)))
sys.path.insert(0, os.environ["FC_HERE"]) if os.environ.get("FC_HERE") else None
try:
    import fc_build
    spec = json.load(open(os.environ["FC_SPEC"]))
    rep = fc_build.build(spec, os.environ["FC_OUT"])
    rep.pop("_builder", None); rep.pop("registry", None)
    print("REPORT", json.dumps({k: rep[k] for k in ("warnings", "timings", "objects") if k in rep}, default=str)[:4000])
except Exception:
    traceback.print_exc()
    sys.exit(1)
