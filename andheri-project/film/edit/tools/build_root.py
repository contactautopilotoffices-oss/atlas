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

def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except ValueError: return 0.0

def shot(name):
    fr = sorted(glob.glob(os.path.join(SH, name, "f_*.png")))
    out = os.path.join(A, "shots", name + ".mp4")
    if not fr: return None
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(fr[-1]):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", "24", "-i", os.path.join(SH, name, "f_%04d.png"),
                        "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "15",
                        "-r", "24", out], check=True)
    return "assets/shots/" + name + ".mp4"

def mapclip(name):
    src = os.path.join(MP, name + ".mp4")
    if not os.path.exists(src): return None
    shutil.copy(src, os.path.join(A, "maps", name + ".mp4")); return "assets/maps/" + name + ".mp4"

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
els, audio, cues, missing = [], [], [], []
for i, (kind, name, t0, t1, overlay) in enumerate(SCHED):
    L = round(t1 - t0, 2)
    if kind == "comp":
        els.append(f'<div id="b{i}-{name}" class="clip" data-composition-id="{name}" data-composition-src="compositions/{name}.html" data-start="{t0}" data-duration="{L}" data-track-index="0" data-track-kind="graphics"></div>')
    else:
        src = shot(name) if kind == "shot" else mapclip(name)
        if not src: missing.append(name); continue
        nat = dur(os.path.join(E, src))
        rate = round(max(0.6, min(1.0, nat / L)), 3)      # a short clip plays slower to fill its slot (never below 0.6x)
        if name == "close_pullback":
            subprocess.run(["python3", os.path.join(E, "tools/build_cards.py"), "--pins-stretch", str(round(1 / rate, 4)), "--pins-dur", str(L)], check=True)
        els.append(f'<video id="b{i}-{name}" class="clip" src="{src}" muted playsinline data-start="{t0}" data-duration="{L}" data-track-index="0" data-playback-rate="{rate}"></video>')
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
#sig{{position:absolute;inset:auto;right:56px;top:48px;z-index:20;opacity:.85}}#sig img{{height:26px;width:auto;display:block}}</style></head><body>
<div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="{TOTAL}">
{chr(10).join(els)}
<div id="sig" class="clip" data-start="8" data-duration="{round(TOTAL - 24, 2)}" data-track-index="6" data-layout-ignore="true"><img src="assets/brand/autopilot-white.png" alt="Autopilot"></div>
{chr(10).join(audio)}
</div><script>const tl=gsap.timeline({{paused:true}});tl.to({{}},{{duration:{TOTAL}}});window.__timelines.main=tl;</script></body></html>"""
open(os.path.join(E, "index.html"), "w").write(html)
json.dump({"total": TOTAL, "cues": cues}, open(os.path.join(E, "timeline.json"), "w"), indent=1)
print("film", TOTAL, "s;", len(els), "picture elements;", len(audio), "audio elements")
