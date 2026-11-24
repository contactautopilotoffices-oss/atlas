"""Assemble the film: lay every scene, clip, voice line, music and sound on the timeline (index.html).

  python3 andheri-project/film/edit/tools/build_root.py

Inputs (missing ones are skipped, so a partial cut still builds):
  shots     andheri-project/film/shots/out/<shot>/f_####.png -> encoded to assets/shots/<shot>.mp4 (1080p, lanczos)
  maps      andheri-project/film/maps/out/*.mp4
  voice     andheri-project/film/narration-v4/vo.json (one file per script line, with durations)
  audio     andheri-project/film/audio/ (music bed, SFX)
Each beat's length is the larger of its picture's natural length and its voice line plus air, so no line is cut.
"""
import os, json, glob, shutil, subprocess
E = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT = os.path.abspath(os.path.join(E, "../../.."))
SH = os.path.join(ROOT, "andheri-project/film/shots/out"); MP = os.path.join(ROOT, "andheri-project/film/maps/out")
NV = os.path.join(ROOT, "andheri-project/film/narration-v4"); AU = os.path.join(ROOT, "andheri-project/film/audio")
A = os.path.join(E, "assets"); os.makedirs(os.path.join(A, "shots"), exist_ok=True); os.makedirs(os.path.join(A, "maps"), exist_ok=True)
os.makedirs(os.path.join(A, "audio"), exist_ok=True); os.makedirs(os.path.join(A, "brand"), exist_ok=True)


from concurrent.futures import ThreadPoolExecutor
NCPU = os.cpu_count() or 8

def par_interp(src_args, vf, out, seconds):
    """minterpolate runs on one core; cut the clip into NCPU time chunks, interpolate them at once, join them."""
    n = max(1, min(NCPU, int(seconds // 0.75)))
    tmp = out + ".parts"; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    edges = [round(seconds * i / n, 4) for i in range(n + 1)]
    def job(i):
        part = os.path.join(tmp, "p%02d.mp4" % i)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *src_args, "-ss", str(edges[i]), "-t", str(edges[i + 1] - edges[i]),
                        "-vf", vf, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-r", "24", part], check=True)
        return part
    with ThreadPoolExecutor(n) as ex: parts = list(ex.map(job, range(n)))
    lst = os.path.join(tmp, "list.txt"); open(lst, "w").write("".join(f"file '{q}'\n" for q in parts))
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out], check=True)
    shutil.rmtree(tmp, ignore_errors=True)

def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except ValueError: return 0.0

# per-shot grade at encode time (numbers only: the afternoon drone reads darker than the sunrise, mean 87 vs 130 of 255)
GRADE = {"corp_drone": "eq=gamma=1.12:contrast=1.02:saturation=1.03"}

def shot(name):
    fr = sorted(glob.glob(os.path.join(SH, name, "f_*.png")))
    out = os.path.join(A, "shots", name + ".mp4")
    if not fr: return None
    if not os.path.exists(out) or os.path.getmtime(out) < max(os.path.getmtime(f) for f in fr):
        nums = sorted(int(os.path.basename(f)[2:6]) for f in fr)
        if nums == list(range(1, nums[-1] + 1)):
            src, vf = ["-framerate", "24", "-i", os.path.join(SH, name, "f_%04d.png")], "scale=1920:1080:flags=lanczos,format=yuv420p"
        else:
            # a shot rendered every other frame (--frame-step 2) and not yet filled: the odd frames at 12 fps, with
            # motion-compensated in-betweens back to 24 fps (the camera moves slowly and steadily, so they hold up)
            tmp = os.path.join(A, "shots", "_" + name); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
            odd = [n for n in nums if n % 2 == 1]
            for i, n in enumerate(odd): os.symlink(os.path.join(SH, name, "f_%04d.png" % n), os.path.join(tmp, "f_%04d.png" % (i + 1)))
            src = ["-framerate", "12", "-i", os.path.join(tmp, "f_%04d.png")]
            vf = "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=1920:1080:flags=lanczos,format=yuv420p"
            print(name, "has gaps:", len(nums), "of", nums[-1], "frames; using", len(odd), "odd frames, interpolated")
        if name in GRADE: vf = GRADE[name] + "," + vf
        if "minterpolate" in vf:
            # output time: the source frames at their input rate
            par_interp(src, vf, out, len(odd) / 12)
        else:
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *src, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "15",
                            "-r", "24", out], check=True)
    return "assets/shots/" + name + ".mp4"

def mapclip(name):
    src = os.path.join(MP, name + ".mp4")
    if not os.path.exists(src): return None
    dst = os.path.join(A, "maps", name + ".mp4")
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src): shutil.copy2(src, dst)   # keep the time: an unchanged clip is not re-fitted
    return "assets/maps/" + name + ".mp4"

for f in ("autopilot-white.png", "flipkart-logo-reverse.svg", "flipkart-logo.svg"):
    if os.path.exists(os.path.join(ROOT, "media/flipkart-andheri/brand", f)): shutil.copy(os.path.join(ROOT, "media/flipkart-andheri/brand", f), os.path.join(A, "brand", f))
# the picture follows the audio mix (andheri-project/film/audio/mix_provisional.wav), whose voice lines sit on the
# script's slots: (kind, source, start, end, overlay)
SCHED = [
 ("comp", "title", 0.0, 8.0, None),
 ("map", "descent", 8.0, 20.0, None),
 ("map", "interchange", 20.0, 27.3, None),
 ("shot", "prv_sunrise", 27.3, 32.1, "card-privilon"),
 ("map", "route_privilon", 32.1, 37.0, None),
 ("shot", "prv_dusk", 37.0, 44.2, None),
 ("comp", "plan-privilon", 44.2, 56.0, None),
 ("shot", "corp_drone", 56.0, 64.4, "card-corporate"),
 ("comp", "plan-corporate", 64.4, 77.0, None),
 ("map", "route_corporate", 77.0, 82.8, None),
 ("shot", "a723_rise", 82.8, 91.4, "card-a723"),
 ("comp", "plan-723", 91.4, 100.0, None),
 ("map", "route_723", 100.0, 105.2, None),
 ("shot", "close_pullback", 105.2, 116.2, "pins-close"),
 ("comp", "close", 116.2, 140.0, None),
]
# a still that stands in (slow push, no pins) while a shot is still rendering: missing, or under half its slot
FALLBACK = {"corp_drone": "media/flipkart-andheri/world/checkpoint/corporate-campus.jpg",
            "close_pullback": "media/flipkart-andheri/world/film-stills/privilon-dusk.jpg"}
os.makedirs(os.path.join(A, "stills"), exist_ok=True)
els, audio, cues, missing, pushes = [], [], [], [], []
for i, (kind, name, t0, t1, overlay) in enumerate(SCHED):
    L = round(t1 - t0, 2)
    if kind == "comp":
        els.append(f'<div id="b{i}-{name}" class="clip" data-composition-id="{name}" data-composition-src="compositions/{name}.html" data-start="{t0}" data-duration="{L}" data-track-index="0" data-track-kind="graphics"></div>')
    else:
        src = shot(name) if kind == "shot" else mapclip(name)
        nat = dur(os.path.join(E, src)) if src else 0.0
        if nat < 0.5 * L and name in FALLBACK and os.path.exists(os.path.join(ROOT, FALLBACK[name])):
            fb = "assets/stills/" + os.path.basename(FALLBACK[name]); shutil.copy(os.path.join(ROOT, FALLBACK[name]), os.path.join(E, fb))
            els.append(f'<div id="b{i}-{name}" class="clip" data-start="{t0}" data-duration="{L}" data-track-index="0"><img id="p{i}" src="{fb}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 50%"></div>')
            pushes.append(f"tl.fromTo('#p{i}',{{scale:1.0}},{{scale:1.07,duration:{L},ease:'none',immediateRender:false}},{t0});")
            missing.append(name + " (still stands in)"); cues.append({"beat": name, "start": t0, "end": t1, "fallback": fb})
            if overlay and overlay.startswith("card") and os.path.exists(os.path.join(E, "compositions", overlay + ".html")):
                els.append(f'<div id="o{i}-{overlay}" class="clip" data-composition-id="{overlay}" data-composition-src="compositions/{overlay}.html" data-start="{round(t0 + 0.4, 2)}" data-duration="{round(min(6.0, L - 0.4), 2)}" data-track-index="1" data-track-kind="graphics"></div>')
            continue
        if not src: missing.append(name); continue
        rate = round(max(0.6, min(1.5, nat / L)), 3)      # the clip is fitted whole to its slot (0.6x-1.5x), so a route's last frame (the walk time) always shows
        if abs(rate - 1) > 0.004:
            # re-timed here with motion-compensated frames at a steady 24 fps; a playback rate on the page repeats or
            # skips source frames unevenly, which reads as a stutter
            rt = os.path.join(E, src[:-4] + "_fit.mp4")
            if not os.path.exists(rt) or os.path.getmtime(rt) < os.path.getmtime(os.path.join(E, src)):
                par_interp(["-i", os.path.join(E, src)], f"setpts={1/rate:.5f}*(PTS-STARTPTS),minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p", rt, nat)
            src = src[:-4] + "_fit.mp4"; nat = dur(rt)
        if name == "close_pullback":
            subprocess.run(["python3", os.path.join(E, "tools/build_cards.py"), "--pins-stretch", str(round(1 / rate, 4)), "--pins-dur", str(L)], check=True)
        els.append(f'<video id="b{i}-{name}" class="clip" src="{src}" muted playsinline data-start="{t0}" data-duration="{L}" data-track-index="0"></video>')
        cues.append({"beat": name, "natural_s": round(nat, 2), "rate": rate})
    if overlay and os.path.exists(os.path.join(E, "compositions", overlay + ".html")):
        od = min(6.0, L - 0.4) if overlay.startswith("card") else L
        els.append(f'<div id="o{i}-{overlay}" class="clip" data-composition-id="{overlay}" data-composition-src="compositions/{overlay}.html" data-start="{round(t0 + 0.4, 2)}" data-duration="{round(od, 2)}" data-track-index="1" data-track-kind="graphics"></div>')
    cues.append({"beat": name, "start": t0, "end": t1})
TOTAL = SCHED[-1][3]
mix = os.path.join(AU, "mix_provisional.wav")
if os.path.exists(mix):
    shutil.copy(mix, os.path.join(A, "audio", "mix.wav"))
    audio.append(f'<audio id="mix" class="clip" src="assets/audio/mix.wav" data-start="0" data-duration="{TOTAL}" data-track-index="2" data-volume="1"></audio>')
print("missing picture:", missing)
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Flipkart × Autopilot · Andheri East</title><script src="assets/gsap.min.js"></script>
<style>*{{box-sizing:border-box}}html,body{{margin:0;background:#000}}#root{{position:relative;width:100%;height:100%;overflow:hidden}}.clip{{position:absolute;inset:0}}video.clip{{width:100%;height:100%;object-fit:cover}}
</style></head><body>
<div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="{TOTAL}">
{chr(10).join(els)}
{chr(10).join(audio)}
</div><script>const tl=gsap.timeline({{paused:true}});tl.to({{}},{{duration:{TOTAL}}});{"".join(pushes)}window.__timelines.main=tl;</script></body></html>"""
open(os.path.join(E, "index.html"), "w").write(html)
json.dump({"total": TOTAL, "cues": cues}, open(os.path.join(E, "timeline.json"), "w"), indent=1)
print("film", TOTAL, "s;", len(els), "picture elements;", len(audio), "audio elements")
