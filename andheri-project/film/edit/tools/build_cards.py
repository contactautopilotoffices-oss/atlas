"""Build the film's title, building name cards, tracked pins and the Autopilot close (HyperFrames compositions).

  python3 andheri-project/film/edit/tools/build_cards.py

The pins over the closing pull-back follow the buildings: their screen positions come from the Blender render
(andheri-project/film/shots/out/close_pullback/pins.json, one entry per frame).
"""
import os, json
E = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT = os.path.abspath(os.path.join(E, "../../.."))
FONTS = """@font-face{font-family:Urbanist;src:url('assets/fonts/Urbanist.ttf')}
@font-face{font-family:'Instrument Serif';src:url('assets/fonts/InstrumentSerif-Regular.ttf')}"""

def comp(cid, dur, style, body, js):
    return f"""<template><style>{FONTS}
#root{{width:1920px;height:1080px;position:relative;overflow:hidden;font-family:Urbanist,sans-serif;color:#fff}}{style}</style>
<div id="root" data-composition-id="{cid}" data-width="1920" data-height="1080" data-duration="{dur}">
<div id="{cid}-stage" class="clip" data-start="0" data-duration="{dur}" data-track-index="1" data-layout-allow-overflow data-layout-allow-overlap>{body}</div></div>
<script>(function(){{const tl=gsap.timeline({{paused:true}});{js}
window.__timelines['{cid}']=tl;}})();</script></template>"""

def save(name, s): open(os.path.join(E, "compositions", name + ".html"), "w").write(s)

# ------------------------------------------------------------ title (on black)
save("title", comp("title", 8, """
#title-stage{background:#000}
.t1{position:absolute;left:0;right:0;top:430px;text-align:center;font-size:128px;font-weight:300;letter-spacing:.34em;padding-left:.34em}
.rule{position:absolute;left:810px;width:300px;top:600px;height:1px;background:linear-gradient(90deg,transparent,#ffc200,transparent);transform-origin:center}
.t2{position:absolute;left:0;right:0;top:628px;text-align:center;font-family:'Instrument Serif',serif;font-style:italic;font-size:48px;color:#c9d1dc}""",
"""<div class="t1" id="t1">ANDHERI EAST</div><div class="rule" id="rule"></div><div class="t2" id="t2">Marol · Chakala</div>""",
"""tl.from('#t1',{opacity:0,letterSpacing:'0.6em',filter:'blur(10px)',duration:2.6,ease:'power2.out'},0.6)
.from('#rule',{scaleX:0,duration:1.4,ease:'power3.inOut'},1.8)
.from('#t2',{opacity:0,y:14,duration:1.2,ease:'power2.out'},2.4)
.to('#t1,#rule,#t2',{opacity:0,duration:1.0,ease:'power1.in'},6.8);"""))

# ------------------------------------------------------------ building name cards (over the footage)
CARDS = {
 "privilon": ("01 · The commute", "Privilon", "Marol · Grade A · G+15 · beside Marol Naka metro"),
 "corporate": ("02 · Speed", "Corporate Avenue", "Chakala · gated office campus · 3rd and 4th floors, ready now"),
 "a723": ("03 · The view from the top", "723 Avenue", "Marol · Grade A · 13th and 14th floors with the terrace"),
}
for key, (eb, name, line) in CARDS.items():
    save("card-" + key, comp("card-" + key, 6, """
.shade{position:absolute;left:0;right:0;bottom:0;height:520px;background:linear-gradient(0deg,#000000b0,#00000000)}
.eb{position:absolute;left:120px;bottom:250px;font-size:24px;letter-spacing:.22em;text-transform:uppercase;color:#ffc200;font-weight:600}
.nm{position:absolute;left:116px;bottom:140px;font-family:'Instrument Serif',serif;font-style:italic;font-size:120px;line-height:1}
.ln{position:absolute;left:120px;bottom:96px;font-size:30px;color:#dfe4ea;letter-spacing:.02em}
.bar{position:absolute;left:120px;bottom:232px;width:64px;height:2px;background:#ffc200;transform-origin:left}""",
f"""<div class="shade" id="sh"></div><div class="bar" id="bar"></div><div class="eb" id="eb">{eb}</div><div class="nm" id="nm">{name}</div><div class="ln" id="ln">{line}</div>""",
"""tl.from('#sh',{opacity:0,duration:0.8},0).from('#bar',{scaleX:0,duration:0.7,ease:'power3.out'},0.3)
.from('#eb',{opacity:0,x:-16,duration:0.7,ease:'power3.out'},0.45).from('#nm',{opacity:0,y:30,filter:'blur(8px)',duration:1.0,ease:'power3.out'},0.55)
.from('#ln',{opacity:0,y:14,duration:0.8,ease:'power2.out'},0.9)
.to('#sh,#bar,#eb,#nm,#ln',{opacity:0,duration:0.6,ease:'power1.in'},5.2);"""))

# ------------------------------------------------------------ pins that track the closing pull-back
def tracked(cid, shot, labels, dur, fps=24, stretch=1.0):
    pj = os.path.join(ROOT, "andheri-project/film/shots/out", shot, "pins.json")
    if not os.path.exists(pj): print("no pins yet for", shot); return
    P = json.load(open(pj)); frames = sorted(int(k) for k in P["pins"])
    body, js = [], []
    for i, (pname, sub) in enumerate(labels.items()):
        body.append(f'<div class="pin" id="pin{i}"><div class="chip"><b>{pname}</b><span>{sub}</span></div><div class="stem"></div><div class="dot"></div></div>')
        for f in frames:
            x, y, z = P["pins"][str(f)].get(pname, [0, 0, -1])
            t = round((f - 1) / fps * stretch, 4)
            if t >= dur: break
            vis = 1 if (z > 0 and 0.03 < x < 0.97 and 0.06 < y < 0.97) else 0
            js.append(f"tl.set('#pin{i}',{{x:{round(x*1920,1)},y:{round((1-y)*1080,1)},opacity:{vis}}},{t});")
        js.append(f"tl.from('#pin{i} .chip',{{opacity:0,y:10,duration:0.6,ease:'power3.out'}},{0.8 + i * 0.5});")
    save(cid, comp(cid, dur, """
.pin{position:absolute;left:0;top:0;width:0;height:0;opacity:0}
.pin .dot{position:absolute;left:-7px;top:-7px;width:14px;height:14px;border-radius:50%;background:#ffc200;box-shadow:0 0 0 6px #ffc20040,0 0 24px #ffc200}
.pin .stem{position:absolute;left:-1px;top:-70px;width:2px;height:64px;background:linear-gradient(#ffffffcc,#ffffff00)}
.pin .chip{position:absolute;left:-150px;top:-148px;width:300px;text-align:center;padding:14px 18px;border-radius:16px;background:#0b1220d9;border:1px solid #ffffff30;box-shadow:0 10px 30px #0008}
.pin .chip b{display:block;font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;font-size:40px;line-height:1.05}
.pin .chip span{font-size:22px;color:#c9d1dc;letter-spacing:.02em}""", "".join(body), "\n".join(js)))
    print("tracked pins:", cid, len(frames), "frames")

import sys
_st = float(sys.argv[sys.argv.index("--pins-stretch") + 1]) if "--pins-stretch" in sys.argv else 1.0
_pd = float(sys.argv[sys.argv.index("--pins-dur") + 1]) if "--pins-dur" in sys.argv else 8.0
tracked("pins-close", "close_pullback", {"Privilon": "Marol · beside the metro", "723 Avenue": "Marol · 13th + 14th floors"}, _pd, stretch=_st)

# ------------------------------------------------------------ the Autopilot close
LOGO_AP = "assets/brand/autopilot-white.png"; LOGO_FK = "assets/brand/flipkart-logo-reverse.svg"
def odo(oid, digits, comma_after=None):
    cols = []
    for i in range(digits):
        cols.append('<span class="col c%d"><span class="strip">%s</span></span>' % (i, "".join(f"<i>{d % 10}</i>" for d in range(30))))
        if comma_after is not None and i == comma_after: cols.append('<span class="comma">,</span>')
    return f'<span class="odo" id="{oid}">{"".join(cols)}</span>'
save("close", comp("close", 23.8, """
#close-stage{background:radial-gradient(1100px 600px at 50% 45%,#121c2c,#05070b 75%)}
.l1{position:absolute;left:0;right:0;top:250px;text-align:center;font-family:'Instrument Serif',serif;font-style:italic;font-size:84px}
.stats{position:absolute;left:0;right:0;top:400px;display:flex;justify-content:center;gap:120px}
.stat{text-align:center}.stat small{display:block;font-size:26px;color:#aab3bf;letter-spacing:.14em;text-transform:uppercase;margin-top:8px}
.odo{display:inline-flex;font-size:104px;line-height:1;height:1em;overflow:hidden;font-weight:600;font-variant-numeric:tabular-nums}
.odo .col{display:inline-block;height:1em;overflow:hidden;width:.62em;text-align:center}.odo .strip{display:flex;flex-direction:column}.odo .strip i{font-style:normal;height:1em;display:block}
.odo .comma{width:.28em}.plus{font-size:80px;color:#ffc200;font-weight:600}
.ways{position:absolute;left:0;right:0;top:640px;display:flex;justify-content:center;gap:56px;font-size:36px;color:#dfe4ea;letter-spacing:.02em}
.belief{position:absolute;left:0;right:0;top:640px;text-align:center;font-family:'Instrument Serif',serif;font-style:italic;font-size:64px;color:#ffc200}
.belief2{position:absolute;left:0;right:0;top:724px;text-align:center;font-size:30px;color:#dfe4ea;letter-spacing:.06em}
.lock{position:absolute;left:0;right:0;top:440px;display:flex;align-items:center;justify-content:center;gap:56px;opacity:0}
.lock img{height:72px;width:auto;object-fit:contain}.lock .x{font-size:44px;color:#8b95a3;font-weight:300}
.end{position:absolute;left:0;right:0;top:600px;text-align:center;font-family:'Instrument Serif',serif;font-style:italic;font-size:58px;opacity:0}
.cta{position:absolute;left:0;right:0;top:700px;text-align:center;font-size:26px;letter-spacing:.24em;text-transform:uppercase;color:#ffc200;opacity:0}""",
f"""<div id="g1"><div class="l1" id="l1">We're Autopilot.</div>
<div class="stats"><div class="stat">{odo('o1',5,1)}<span class="plus">+</span><small>seats delivered</small></div><div class="stat">{odo('o2',2)}<span class="plus">+</span><small>centres</small></div><div class="stat">{odo('o3',1)}<small>cities</small></div></div>
<div class="ways"><span id="w1">Pick the building.</span><span id="w2">Plan every seat.</span><span id="w3">Run it like our own.</span></div>
<div class="belief" id="bl">Pehle vyavahar, phir vyapar.</div><div class="belief2" id="bl2">Relationship first, business next.</div></div>
<div class="lock" id="lock"><img src="{LOGO_AP}" alt="Autopilot"><span class="x">×</span><img src="{LOGO_FK}" alt="Flipkart"></div>
<div class="end" id="end">Andheri East. Let's choose it together.</div><div class="cta" id="cta">Enter the experience</div>""",
"""function odoTo(id,value,at,dur,digits){const s=String(value).padStart(digits,'0');for(let i=0;i<digits;i++){tl.to('#'+id+' .c'+i+' .strip',{yPercent:-(10+(+s[i]))/30*100,duration:dur,ease:'power3.out'},at+i*0.07);}}
tl.from('#l1',{opacity:0,y:20,filter:'blur(6px)',duration:0.9,ease:'power3.out'},0.4);
tl.from('#close-stage .stats',{opacity:0,y:20,duration:0.7,ease:'power3.out'},1.3);
odoTo('o1',15000,1.6,1.2,5); odoTo('o2',20,3.1,1.0,2); odoTo('o3',7,4.05,0.9,1);
tl.from('#w1',{opacity:0,y:14,duration:0.6,ease:'power3.out'},5.6).from('#w2',{opacity:0,y:14,duration:0.6,ease:'power3.out'},7.1).from('#w3',{opacity:0,y:14,duration:0.6,ease:'power3.out'},9.1);
tl.to('#close-stage .ways',{opacity:0,duration:0.5},10.6);
tl.from('#bl',{opacity:0,y:18,duration:0.9,ease:'power3.out'},10.95).from('#bl2',{opacity:0,duration:0.8},13.3);
tl.to('#g1',{opacity:0,duration:0.7,ease:'power1.in'},15.1);
tl.to('#lock',{opacity:1,duration:0.9,ease:'power2.out'},15.5).from('#lock',{scale:0.96,duration:1.3,ease:'power3.out'},15.5);
tl.to('#end',{opacity:1,duration:0.8},16.0).to('#cta',{opacity:1,duration:0.8},17.4);
tl.to('#lock,#end,#cta',{opacity:0,duration:1.2},22.4);"""))
print("built title, cards, close")
