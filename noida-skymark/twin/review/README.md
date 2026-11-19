# Review before publish

Nothing is copied to a live `web/models/` folder until the approver has passed it (see `../blender/APPROVAL_CHECKLIST.md`) and the founder has said yes.

1. Stage the build's export (GLB, LOD GLB, viewer.json, cameras.json, lightmaps/) in a staging dir as `<stage>/<plan>/`.
2. Serve the Atlas folder read-only, with that plan's models taken from the stage:
   `python3 serve_review.py /Users/lohit/Downloads/Atlas <stage> 8765 <shots dir>`
3. Capture every room view the viewer offers, in headless Chrome:
   `node capture.mjs "http://127.0.0.1:8765/airoli-rtp/twin/web/#tenant=<plan>" <plan>`
   Each shot is checked: walk mode is off, the camera is at the view, and the image differs from the previous one. A view whose image is identical to the one before is a duplicate pose in the viewer data, not a capture fault.
4. Give the shots, the checklist and the client's reference photos to a fresh reviewer agent. Do not give it the builder's notes.
5. Publish only after APPROVED and the founder's yes, in one batch.

Notes: the viewer's Enter button turns on walk mode at the orbit camera's position, which overrides every glide; `capture.mjs` leaves walk mode before touring. The desktop app's built-in browser pane cannot be used for this: while it is hidden the page loses WebGL and its animation frames stop.
