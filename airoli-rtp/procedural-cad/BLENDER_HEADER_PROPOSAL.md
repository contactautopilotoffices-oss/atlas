# Proposal: door headers in the Blender builder (not applied)

This is a proposal only. `noida-skymark/twin/blender/` was not edited: another worker has uncommitted changes there. The line numbers below refer to the committed version of `geometry.py` (HEAD).

## What the builder does today

`Geometry.doors()` (`noida-skymark/twin/blender/geometry.py`, lines 330–378 at HEAD) builds three things for every door:

- **The leaf:** always 2.08 m tall (line 362).
- **The frame:** jambs plus a head at 2.15 m, built only when it finds the opening (lines 371–376).
- **The header above:** a painted solid block 100 mm deep, from 2.2 m to the slab soffit (lines 374–375). It is built only when it finds the opening.

## The gaps

1. **No header when the opening is not found.** The opening search looks for wall or glass just past both ends of the leaf. When it fails (`best is None`), the leaf is built with nothing above it: no frame and no header. This is the "glass door with nothing above it" that the founder flagged. The search also reads only the plan geometry, so a door in a glass run often fails it.
2. **The header is always painted wall.** Over a glass door in a glass partition, a 100 mm painted block runs from 2.2 m to the soffit, while the glass partition next to it stops at `glass.top` (2.4 m by default). A glazed front should get a glass transom up to the partition top; a dry-wall partition should get a POP bulkhead; a block wall should get a lintel.
3. **Heights are fixed in code.** The 2.08, 2.15 and 2.2 m values do not come from one door-head rule, so they cannot be changed in one place.
4. **The header depth is fixed at 100 mm.** It should follow the host wall's thickness (75 mm glass and dry wall here, 150 mm block).
5. **No traceability.** Nothing records which drawing entity, or which rule, the door, frame or header came from.

## Proposed change

The procedural pipeline already writes every door with its header in the web twin's own frame: `airoli-rtp/procedural-cad/out/rtp6_floor6.semantic.json`, under `openings[]`. Each record gives:

- `kind`, `host` and `line` (the drawn opening, in rtp_local);
- `width_m` and `head_m`;
- `header {kind, z0_m, z1_m, material}`;
- `frame {profile_mm, material}`, `leaf {material, thickness_mm}`;
- `source` for each value, plus `cad_handle`.

The proposal is for the Blender builder to read those fields instead of searching for the opening itself:

```python
# geometry.py, Geometry.doors(): replace the fixed heights and the painted header (sketch)
SEM = self.S.get("semantic_openings")          # loaded from rtp6_floor6.semantic.json when the plan has one
for d in self.L["doors"]:
    o = SEM.get(d["handle"]) if SEM else None  # match on the door block's insert handle
    if o is None:
        ...                                    # today's search, kept as the fallback
        continue
    (ax, ay), (bx, by) = o["line"]; w = o["width_m"]; head = o["head_m"]
    ox, oy = (ax + bx) / 2, (ay + by) / 2; oa = math.atan2(by - ay, bx - ax)
    t = host_thickness(o["host"]) or 0.1       # header depth = host wall thickness
    fw, fd = (v / 1000 for v in o["frame"]["profile_mm"])
    # leaf to the head, frame jambs and head at the drawn opening
    m = self.mb(); m.box(w - 2 * fw, o["leaf"]["thickness_mm"] / 1000, head - fw, T(0, 0, 0), leaf_mat(o))
    fm = self.mb()
    for e in (-1, 1): fm.box(fw, fd, head, T(e * (w - fw) / 2, 0, 0), frame_mat(o))
    fm.box(w, fd, fw, T(0, 0, head - fw), frame_mat(o))
    h = o["header"]
    if h["kind"] == "glass_transom":           # glass over the door, up to the partition top
        hm = self.mb(); hm.box(w - 2 * fw, 0.012, h["z1_m"] - h["z0_m"], T(0, 0, h["z0_m"]), "partition_glass")
    elif h["kind"] in ("pop_bulkhead", "lintel_masonry"):   # the wall continues above the door
        hm = self.mb(); hm.box(w, t, h["z1_m"] - h["z0_m"], T(0, 0, h["z0_m"]), self.mat("walls", "paint", "paint"))
    else:                                      # none_open_above (cubicles) or full_height
        hm = None
    # put leaf / frame / header with props={"cad_handle": o["cad_handle"], "header": h["kind"], "source": o["source"]["header"]}
```

### What changes for a viewer of the twin

- Every door has a header, and it matches its host: glass above glass doors, wall above doors in walls, nothing above cubicle doors.
- The door head is one number (`rules.json` → `defaults.door_head_m`). Changing it and re-running both pipelines moves every door, frame and header together.
- Each piece carries the drawing handle and its source (`cad` or `default`), so the web twin can show the same trace as `trace.html`.

### Risks, and checks before merging

- **Coordinates.** The semantic JSON is in rtp_local; the Blender builder reads the generic pipeline's layout. Both use the same `cad_m_to_rtp_local` matrix (`airoli-rtp/rtp6-c/rtp6-c-floor6.twin.layout.json`), but this should be checked on three doors before relying on it.
- **Freestanding doors.** 40 of the 97 doors have no host wall in the procedural model: 20 toilet cubicle doors, plus doors whose swing does not line up with a drawn wall end. For those, keep today's search as the fallback and log which path each door took.
- **Approval.** The approver review and the founder's yes still apply before any change reaches `web/models`.
