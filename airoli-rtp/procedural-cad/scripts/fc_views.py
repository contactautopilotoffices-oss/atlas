"""Open the floor FCStd in the FreeCAD GUI, colour by material, save PNG views (whole floor + close-ups), quit.
(Adapted from the scratch prototype gui_shots.py.)
Run (window appears briefly; isolated config so the user's FreeCAD prefs are untouched):
  FREECAD_USER_HOME=<scratch>/fcuser FC_FILE=out/sample.FCStd FC_REPORT=out/sample.report.json \
  FC_SHOT_PREFIX=out/shot /Applications/FreeCAD.app/Contents/Resources/bin/freecad gui_shots.py"""
import os, json, traceback
import FreeCAD, FreeCADGui
from PySide import QtCore

P, OUT, REP, ASM = os.environ["FC_FILE"], os.environ["FC_SHOT_PREFIX"], os.environ["FC_REPORT"], os.environ["FC_ASM"]
LOG = OUT + ".log"


def log(*a):
    with open(LOG, "a") as fh:
        fh.write(" ".join(str(x) for x in a) + "\n")


def colour(doc, rep):
    reg, mats = rep["registry"], rep["materials"]

    def fm(key):
        m = mats.get(key) or {"color": [0.7, 0.7, 0.7], "transparency": 0}
        mat = FreeCAD.Material()
        mat.DiffuseColor = tuple(m["color"])
        mat.Transparency = m["transparency"] / 100.0
        return mat

    for o in doc.Objects:
        vo = o.ViewObject
        if vo is None:
            continue
        if o.TypeId == "App::GeometryPython" and hasattr(o, "Shape"):
            # BuildingParts (storey, building, band assemblies) draw a grey compound of all their
            # children on top of them when the FCStd was written headless (no GuiDocument.xml).
            # Hiding the BuildingPart does NOT hide its children.
            vo.Visibility = False
            continue
        r = reg.get(o.Name)
        if r is None:
            if o.TypeId == "Part::Feature":
                vo.Visibility = False  # axis wires, window profiles, cut volumes
            continue
        if r["role"] in ("void", "assembly") or not hasattr(o, "Shape") or o.Shape.isNull():
            if r["role"] == "void":
                vo.Visibility = False
            continue
        sol = o.Shape.Solids
        pm = r.get("part_materials")
        if r.get("curtain"):
            nm = o.VerticalMullionNumber + o.HorizontalMullionNumber + o.DiagonalMullionNumber
            keys = [r["curtain"]["mullion_material"] if i < nm else r["curtain"]["panel_material"] for i in range(len(sol))]
        elif pm and len(pm) == len(sol):
            keys = pm
        else:
            keys = [r.get("material") or (pm[0] if pm else None)] * len(sol)
        try:
            if hasattr(vo, "UseMaterialColor"):
                vo.UseMaterialColor = False  # Arch VPs would re-apply the (multi)material colour
            if len(set(keys)) == 1:
                m = mats.get(keys[0]) or {"color": [0.7, 0.7, 0.7], "transparency": 0}
                vo.ShapeColor = tuple(m["color"])
                vo.Transparency = int(m["transparency"])
            else:
                per_face = []
                for s, k in zip(sol, keys):
                    per_face += [fm(k)] * len(s.Faces)
                if len(per_face) == len(o.Shape.Faces):
                    vo.ShapeAppearance = per_face
                else:
                    log("face count mismatch", o.Label, len(per_face), len(o.Shape.Faces))
        except Exception as e:
            log("colour failed", o.Label, e)


def targets(asm):
    W = {w["id"]: w for w in asm["walls"]}
    t = []
    def pick(name, cond):
        best = None
        for o in asm["openings"]:
            h = W.get(o["host"]["value"])
            if h and len(o["cad"]["flanking_walls"]) == 2 and cond(o, h) and len(h["axis"]["value"]) == 2:
                if best is None or h["length_m"]["value"] > W[best["host"]["value"]]["length_m"]["value"]:
                    best = o
        if best:
            t.append((name, best, {best["id"], best["host"]["value"], *best["cad"]["flanking_walls"]}))
    pick("closeup_glass_partition_door", lambda o, h: h["type"]["value"] == "glass_partition" and o["header"]["value"]["kind"] == "glass_transom")
    pick("closeup_door_pop_header", lambda o, h: h["type"]["value"] == "pop_gypsum" and o["header"]["value"]["kind"] == "pop_bulkhead")
    pick("closeup_door_block_lintel", lambda o, h: h["type"]["value"] == "brick_block" and o["header"]["value"]["kind"] == "lintel_masonry")
    pick("closeup_pop_glass_pop", lambda o, h: h["type"]["value"] == "mixed")
    if not any(n == "closeup_pop_glass_pop" for n, _, _ in t):
        mw = sorted([w for w in asm["walls"] if w["type"]["value"] == "mixed"], key=lambda w: -w["length_m"]["value"])
        if mw:
            t.append(("closeup_pop_glass_pop", {"line": {"value": mw[0]["axis"]["value"][:2]}, "id": mw[0]["id"]}, {mw[0]["id"]}))
    return t


def run():
    try:
        FreeCAD.ParamGet("User parameter:BaseApp/Preferences/View").SetBool("UseNavigationAnimations", False)
        rep = json.load(open(REP)); asm = json.load(open(ASM))
        doc = FreeCAD.openDocument(P)
        doc.recompute()
        FreeCADGui.updateGui()
        colour(doc, rep)
        gdoc = FreeCADGui.getDocument(doc.Name)
        v = gdoc.ActiveView
        reg = rep["registry"]
        if os.environ.get("FC_SAVE_GUI", "1") == "1":
            # store the colours and visibility in the file, so it opens cleanly in the FreeCAD app (a headless save has no view data)
            for o in doc.Objects:
                if reg.get(o.Name, {}).get("role") == "ceiling" and o.ViewObject:
                    o.ViewObject.Visibility = False
            v.viewIsometric(); v.fitAll()
            doc.save(); log("saved view data into", P)
        shown = [o for o in doc.Objects if o.ViewObject and o.ViewObject.Visibility and hasattr(o, "Shape") and not o.Shape.isNull()]
        ceil = [o for o in shown if reg.get(o.Name, {}).get("role") in ("ceiling",)]

        def show_only(pred):
            for o in shown:
                o.ViewObject.Visibility = bool(pred(o))
            FreeCADGui.updateGui()

        def shot(name, fn, w=1800, h=1100):
            fn(); FreeCADGui.updateGui(); v.fitAll(); FreeCADGui.updateGui()
            path = f"{OUT}_{name}.png"
            v.saveImage(path, w, h, "White")
            log("saved", path, os.path.getsize(path))

        show_only(lambda o: o not in ceil)
        shot("axonometric", v.viewIsometric)
        shot("top", v.viewTop)
        for name, o, ids in targets(asm):
            (x0, y0), (x1, y1) = o["line"]["value"]
            along_x = abs(x1 - x0) >= abs(y1 - y0)
            show_only(lambda ob: reg.get(ob.Name, {}).get("id") in ids)
            shot(name, v.viewIsometric, 1600, 1100)
            shot(name + "_elevation", v.viewFront if along_x else v.viewRight, 1600, 1100)
            log("target", name, sorted(ids))
        log("OK")
    except Exception:
        log(traceback.format_exc())
    finally:
        os._exit(0)


QtCore.QTimer.singleShot(2000, run)
