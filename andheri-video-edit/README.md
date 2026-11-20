# Andheri East property walkthroughs

`edit-plan.json` is the reproducible cut list. `render.py` assembles the source windows, labels, short fades and rendered Autopilot outro. It leaves original MOVs unchanged.

Use an FFmpeg build with `zscale`, `tonemap`, `overlay` and libx264, plus Python Pillow. Set `FFMPEG` to its absolute path when the default FFmpeg lacks zscale. The font is the macOS Arial font at the path declared in `render.py`.

The outro is an editable two-second HyperFrames composition in `index.html`, using the existing Autopilot logo. Run the HyperFrames skill's launcher in this directory for check, preview and render; render to `renders/outro.mp4`, then run:

```
FFMPEG=/path/to/full/ffmpeg python3 render.py
python3 upload.py --env ../.env
python3 upload.py --env ../.env --upload
node ../scripts/examples/flipkart-andheri.js
```

Uploads require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Keep them in the ignored root `.env`. The upload script checks the expected Atlas project and existing public `atlas-cms` bucket, uploads to content-derived immutable paths, verifies public sizes and content types, and updates `examples/flipkart-andheri-east.media.json`. It does not alter database rows or storage permissions. No originals are uploaded.

The generated Andheri East bundle contains the three shortlisted properties. Other studies keep their existing inventory. Videos are stored in Supabase rather than Git; posters/photos remain available locally as well.
