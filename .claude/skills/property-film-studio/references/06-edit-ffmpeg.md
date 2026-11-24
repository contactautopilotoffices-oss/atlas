# 06: The edit. ffmpeg plus HyperFrames, on every core.

The edit lives in `andheri-project/film/edit/`, a HyperFrames project.
`tools/build_root.py` writes `index.html` from the shots, the map clips,
the cards and the plans. Read the `hyperframes` skill for the composition
contract.

## Frames to clips (ffmpeg)

- **Grade per shot**, kept as a small dictionary in `build_root.py`
  (`GRADE`):

  ```
  corp_drone: eq=gamma=1.12:contrast=1.02:saturation=1.03
  ```

  Keep it light. Fine grain and a 0.3 px blur take off the razor-CG look.
- **Retime with motion compensation, not with the playback rate.** A clip
  that has to fill N seconds becomes `<shot>_fit.mp4` via
  `setpts=...,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1`.
  - Never use `data-playback-rate`; it stutters.
  - A pass-1 render (odd frames only) is read at 12 fps and interpolated up
    to 24.
- **minterpolate is single-threaded, so chunk it.** `par_interp(src_args,
  vf, out, seconds)`:
  - splits the clip into `NCPU` time ranges;
  - runs them in a `ThreadPool`, each its own ffmpeg with `-ss/-t`;
  - then concats them with `-c copy`.

  On the M5 this takes the step from minutes to seconds. Use the same
  pattern for any slow filter.
- **Encode masters** in H.264 High, CRF 14 to 16, `yuv420p`, BT.709 tags,
  24 fps (the rate of the Blender shots). For the web, add a
  `-movflags +faststart` copy at about 8 to 10 Mbit/s (the Andheri film is
  140 s and 76 MB).
- **Fallbacks.** While a shot is still rendering, `FALLBACK` uses a still
  with the card overlays, so the provisional cut is always complete.
- Copy map clips only when they change (`copy2` after a compare), so the
  edit isn't invalidated for nothing.

## Graphics in HyperFrames

- **Cards** (`build_cards.py`):
  - the property name, its key figures and the walk;
  - title tweens use scale, not letter-spacing, which jitters;
  - reading text at 28 px or more at 1080p.
- **Plans** (`build_plans.py`, `plan_svg.py`): floor plates drawn from the
  CAD as SVG, with a slow `.push` scale and the workstation counts.
- **Count-up figures:**

  ```js
  function odoTo(tl,id,value,at,dur){const el=document.getElementById(id),st=(window.__odo=window.__odo||{}),from=st[id]||0;st[id]=value;const p={v:from};
    tl.fromTo(p,{v:from},{v:value,duration:dur+0.25,ease:'power3.out',immediateRender:false,
      onUpdate:()=>{el.textContent=Math.round(p.v).toLocaleString('en-US');}},at);}
  ```

  Use `font-variant-numeric: tabular-nums`, right alignment and
  `min-width: <chars>*0.55em`.
- **Pins:** label cards projected from the `pins` in `shots.json` follow
  the building, frame by frame.
- **Logos:** use transparent SVG or PNG. No corner logo for the whole film
  (it flickered on the cuts); put the brand lockup at the end instead.
- **Render:**

  ```bash
  npx hyperframes render --fps 24 --quality delivery --workers 10
  ```

  Then mux in the final mix:

  ```bash
  ffmpeg -i video.mp4 -i mix.wav -c:v copy -c:a aac -b:a 256k -shortest out.mp4
  ```

## Checks before calling it done

- **By numbers:**
  - no black frames (`blackdetect`);
  - no frozen stretches (`freezedetect` and the repeated-frame count);
  - no clipping (`signalstats` YMAX under 250);
  - loudness at −16 LUFS (`ebur128`).
- **By eye:** watch contact sheets every 2 s (`ffmpeg -vf fps=0.5,tile=6x4`),
  then the whole film at full size.
- **Truth:** every on-screen figure matches the canonical table.
