"""Turns the client's ranking sheet (.xlsx or .csv) into the options of a
study.json, so nothing is retyped by hand.

    python3 -I sheet_to_json.py ranking.xlsx study.json [--sheet "Sheet1"]

If study.json exists, options are matched by name (or id) and only the
sheet's fields are updated; positions, facts and anything you added stay.
If it does not exist, a skeleton is written with every option unplaced
(lat/lng null), which pack_data.js will refuse until each one is pinned.

Columns are matched by header, case-insensitively:
  rank            Rank, #, S.No, Sr
  name            Property, Building, Name, Project, Asset
  sheetMicro      Micro-market, Micromarket, Location, Locality, Area
  roadKm          Distance, Road distance, Km
  driveText       Drive time, Travel time, Time
  pricingScore    Pricing score, Price score, Commercial score
  ecoScore        Ecosystem score, Eco score
  fit             Fit, Fit group, Category, Classification
  reason          Reason, Client-facing reason, Rationale, Remarks
  address         Address
Any other column is kept on the option under "_sheet" (a builder's note
that pack_data.js does not ship), so rent, CAM or area never reach the page
unless you decide to show them, and the client has confirmed them.
"""
import argparse, csv, json, os, re

ap = argparse.ArgumentParser()
ap.add_argument("sheet"); ap.add_argument("study"); ap.add_argument("--sheet-name", dest="sheet_name")
a = ap.parse_args()

ALIASES = {
    "rank": ["rank", "#", "s.no", "sno", "sr", "sr.no", "no"],
    "name": ["property", "building", "name", "project", "asset", "property name"],
    "sheetMicro": ["micro-market", "micromarket", "micro market", "location", "locality", "area", "sub-market"],
    "roadKm": ["distance", "road distance", "km", "distance (km)", "distance from current office"],
    "driveText": ["drive time", "travel time", "time", "commute"],
    "pricingScore": ["pricing score", "price score", "commercial score", "pricing"],
    "ecoScore": ["ecosystem score", "eco score", "ecosystem"],
    "fit": ["fit", "fit group", "category", "classification", "fit category"],
    "reason": ["reason", "client-facing reason", "client facing reason", "rationale", "remarks", "comments"],
    "address": ["address"],
}
def key_of(h):
    h = " ".join(str(h or "").strip().lower().split())
    for k, al in ALIASES.items():
        if h in al: return k
    for k, al in ALIASES.items():
        if any(x in h for x in al if len(x) > 4): return k
    return None

def read_rows():
    if a.sheet.lower().endswith(".csv"):
        with open(a.sheet, encoding="utf-8-sig") as f:
            return [r for r in csv.reader(f)]
    import openpyxl
    wb = openpyxl.load_workbook(a.sheet, data_only=True)
    ws = wb[a.sheet_name] if a.sheet_name else wb.worksheets[0]
    return [list(r) for r in ws.iter_rows(values_only=True)]

rows = [r for r in read_rows() if any(c not in (None, "") for c in r)]
# the header is the first row that names a property column
hi = next(i for i, r in enumerate(rows) if any(key_of(c) == "name" for c in r))
body = rows[hi + 1:]
# keep only columns that hold something, and name the unnamed ones
used = [j for j in range(len(rows[hi])) if rows[hi][j] not in (None, "") or any(j < len(r) and r[j] not in (None, "") for r in body)]
head = [rows[hi][j] if rows[hi][j] not in (None, "") else f"column {j + 1}" for j in used]
body = [[r[j] if j < len(r) else None for j in used] for r in body]
cols = [key_of(h) for h in head]
# A column with no header whose cells read like "Best fit" is the fit group
# (sheets often leave that header blank).
for j in range(len(head)):
    vals = [str(r[j]) for r in body if r[j] not in (None, "")]
    if not cols[j] and "fit" not in cols and vals and sum(bool(re.search(r"\bfit\b", v, re.I)) for v in vals) >= .8 * len(vals):
        cols[j] = "fit"
print("columns:", ", ".join(f"{h!s} -> {c or '(kept as _sheet)'}" for h, c in zip(head, cols)))

# En and em dashes become plain hyphens: "20-25 min" between numbers, " - " elsewhere.
DASH = "[" + chr(0x2013) + chr(0x2014) + "]"
def dash(s):
    if s is None: return s
    s = re.sub(r"(\d)\s*" + DASH + r"\s*(\d)", r"\1-\2", str(s))
    return re.sub(r"\s*" + DASH + r"\s*", " - ", s).strip()
slug = lambda s: re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(s).lower())).strip("-")
def num(v):
    if isinstance(v, (int, float)): return v
    m = re.search(r"\d+(\.\d+)?", str(v or ""))
    return float(m.group()) if m else None
def fit_key(v):
    w = re.sub(r"\bfit\b", "", str(v or "").lower()).split()
    return w[0] if w else None

opts = []
for r in body:
    rec, extra = {}, {}
    for h, c, v in zip(head, cols, r):
        if v in (None, ""): continue
        if c: rec[c] = v
        else: extra[str(h)] = dash(v) if isinstance(v, str) else v
    if not rec.get("name"): continue
    o = {"id": slug(rec["name"]), "name": dash(rec["name"]), "sheetName": dash(rec["name"])}
    if "rank" in rec: o["n"] = int(num(rec["rank"]))
    for k in ("sheetMicro", "driveText", "reason", "address"):
        if k in rec: o[k] = dash(rec[k])
    for k in ("roadKm", "pricingScore", "ecoScore"):
        if k in rec and num(rec[k]) is not None: o[k] = num(rec[k])
    if "fit" in rec: o["fit"] = fit_key(rec["fit"]); o["_fitLabel"] = dash(rec["fit"])
    if extra: o["_sheet"] = extra
    opts.append(o)
for i, o in enumerate(opts):
    o.setdefault("n", i + 1)

if os.path.exists(a.study):
    study = json.load(open(a.study, encoding="utf-8"))
    have = {x.get("sheetName", x["name"]).lower(): x for x in study.get("options", [])}
    have.update({x["id"]: x for x in study.get("options", [])})
    merged = []
    for o in opts:
        old = have.get(o["sheetName"].lower()) or have.get(o["id"])
        if old: old.update({k: v for k, v in o.items() if k != "id"}); merged.append(old)
        else: merged.append({**o, "lat": None, "lng": None, "precision": "locality", "micro": ""}); print("new option:", o["name"])
    dropped = [x["name"] for x in study.get("options", []) if x not in merged]
    if dropped: print("no longer on the sheet (removed):", ", ".join(dropped))
    study["options"] = merged
else:
    study = {"meta": {}, "existing": None, "options": [{**o, "lat": None, "lng": None, "precision": "locality", "micro": ""} for o in opts],
             "zones": [], "transit": {"lines": []}, "bus": None, "places": [], "facts": {}}
json.dump(study, open(a.study, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
fits = sorted({(o.get("fit"), o.get("_fitLabel")) for o in opts if o.get("fit")})
print(f"{len(opts)} options written to {a.study}")
if fits: print("fit groups on the sheet:", "; ".join(f"{k} = {l!r}" for k, l in fits), "(define meta.fits if these are not best/value/conditional)")
