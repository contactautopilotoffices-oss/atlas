# Hand-pinned cameras

`<tenant>.json` here wins over the automatic cameras for the same room and kind
(`make_cameras.py` reads it on every `--stage cameras` run).

```json
{"cameras": [
  {"room": "RECEPTION", "kind": "entry", "frame": "plan",
   "position": [53.2, 14.6, 1.55], "target": [51.0, 11.2, 1.3], "hfov_deg": 75, "label": "Reception: arrival"}
]}
```

- `room`: the layout's room name, exactly. `kind`: entry, feature, reverse or detail.
- `frame`: `plan` (x east, y north, z up from the finished floor, metres; what the layout uses) or `glb`
  (the exported GLB / three.js frame: x east, y up, z = -north). Default `plan`.
- `position` is the lens, `target` any point on the view axis; the camera is kept level and the downward look is
  made with lens shift.
- A pinned view is still scored; the report says if it fails a gate, but it is kept.
