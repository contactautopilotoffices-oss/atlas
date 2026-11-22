"""Build the film's three animated CAD scenes (HyperFrames compositions) from the layered plan SVGs.

  python3 andheri-project/film/edit/tools/build_plans.py

Each scene: the plan's walls draw in, zones fill, desks appear in a sweep, and counters roll into place on digit
wheels (a date-picker roll). Every figure on screen comes from the CAD totals or the deck (OVERNIGHT-BRIEF.md).
"""
import os, re, json
E = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
P = os.path.join(E, "assets/plans")

def svg(pid, cls):
    s = open(os.path.join(P, pid + ".svg")).read()
    return s.replace("<svg ", f'<svg class="plan {cls}" ', 1)

def odo(oid, digits, comma_after=None):
    cols = []
    for i in range(digits):
        strip = "".join(f"<i>{d % 10}</i>" for d in range(30))
        cols.append(f'<span class="col c{i}"><span class="strip">{strip}</span></span>')
        if comma_after is not None and i == comma_after: cols.append('<span class="comma">,</span>')
    return f'<span class="odo" id="{oid}">{"".join(cols)}</span>'

STYLE = """
@font-face{font-family:Urbanist;src:url('assets/fonts/Urbanist.ttf')}
@font-face{font-family:'Instrument Serif';src:url('assets/fonts/InstrumentSerif-Regular.ttf')}
#root{width:1920px;height:1080px;position:relative;overflow:hidden;background:radial-gradient(1200px 700px at 70% 55%,#111a28 0%,#080b11 70%);color:#f4f6fa;font-family:Urbanist,sans-serif}
.eyebrow{position:absolute;left:120px;top:118px;font-size:22px;letter-spacing:.22em;text-transform:uppercase;color:#ffc200;font-weight:600}
.head{position:absolute;left:120px;top:160px;font-family:'Instrument Serif',serif;font-style:italic;font-size:74px;line-height:1.02;color:#fff;max-width:760px}
.big{position:absolute;display:flex;align-items:baseline;gap:18px}
.odo{display:inline-flex;font-size:150px;line-height:1;height:1em;overflow:hidden;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.odo .col{display:inline-block;height:1em;overflow:hidden;width:.62em;text-align:center}
.odo .strip{display:flex;flex-direction:column}
.odo .strip i{font-style:normal;height:1em;display:block}
.odo .comma{width:.28em}
.unit{font-size:28px;color:#9aa4b2;letter-spacing:.04em}
.chips{position:absolute;display:flex;gap:12px}
.chip{padding:12px 22px;border-radius:999px;border:1px solid #ffffff2e;background:#ffffff0d;font-size:24px;color:#c9d1dc;letter-spacing:.02em}
.chip.on{background:#2a55e5;border-color:#2a55e5;color:#fff}
.plan{position:absolute;overflow:visible}
.plan .walls,.plan .glass,.plan .doors{stroke-dashoffset:1}
.plan .zone{opacity:0}.plan .desk{opacity:0}
.cap{position:absolute;font-size:22px;letter-spacing:.18em;text-transform:uppercase;color:#9aa4b2}
.src{position:absolute;right:120px;bottom:44px;font-size:22px;color:#8f99a8;letter-spacing:.03em}
.tile{position:absolute;padding:22px 28px;border-radius:18px;background:linear-gradient(135deg,#ffffff14,#ffffff06);border:1px solid #ffffff24;backdrop-filter:blur(8px)}
.tile b{display:block;font-size:30px;font-weight:600;color:#fff}.tile span{font-size:22px;color:#aab3bf}
"""

ODO_JS = """
function odoTo(tl, id, value, at, dur, digits){
  const s = String(value).padStart(digits, '0');
  for (let i = 0; i < digits; i++) {
    const d = +s[i];
    tl.to('#' + id + ' .c' + i + ' .strip', {yPercent: -(10 + d) / 30 * 100, duration: dur, ease: 'power3.out'}, at + i * 0.07);
  }
}
function drawPlan(tl, sel, at){
  tl.to(sel + ' .walls,' + sel + ' .glass,' + sel + ' .doors', {strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.15}, at);
  tl.to(sel + ' .zone', {opacity: 1, duration: 0.6, stagger: {each: 0.035, from: 'random'}, ease: 'power1.out'}, at + 0.5);
  tl.to(sel + ' .desk', {opacity: 1, duration: 0.25, stagger: {each: 0.004, from: 'start'}, ease: 'none'}, at + 1.4);
}
"""

def scene(cid, dur, body, js):
    return f"""<template><style>{STYLE}</style><div id="root" data-composition-id="{cid}" data-width="1920" data-height="1080" data-duration="{dur}">
<div id="{cid}-stage" class="clip" data-start="0" data-duration="{dur}" data-track-index="1" data-layout-allow-overflow data-layout-allow-overlap>{body}</div></div>
<script>(function(){{const tl=gsap.timeline({{paused:true}});{ODO_JS}
tl.from('#{cid}-stage .eyebrow,#{cid}-stage .head',{{opacity:0,y:24,duration:0.9,stagger:0.12,ease:'power3.out'}},0.2);
{js}
tl.to('#{cid}-stage',{{opacity:0,duration:0.5}},{dur}-0.5);
window.__timelines['{cid}']=tl;}})();</script></template>"""

# ---------------- Privilon: one floor, three ways (260 / 280 / 301)
pv = "".join(f'<div class="pv-wrap" id="pv{n}" style="position:absolute;left:120px;top:520px;width:1680px;height:500px;opacity:{1 if n==260 else 0}">{svg(f"privilon-{n}-plan1", f"pv{n}")}</div>' for n in (260, 280, 301))
pv = pv.replace('<svg class="plan', '<svg style="width:1680px;height:500px" class="plan')
body = f"""<div class="eyebrow">Privilon · one floor plate</div><div class="head">One long, clear floor.<br>Drawn three ways.</div>
<div class="big" style="right:120px;top:150px">{odo('pvodo', 3)}<span class="unit">workstations</span></div>
<div class="chips" style="right:120px;top:330px"><span class="chip on" id="ch260">260</span><span class="chip" id="ch280">280</span><span class="chip" id="ch301">301</span></div>
{pv}<div class="src">Seats counted from the developer's CAD drawings · 22.4 × 67.3 m floor plate</div>"""
js = """drawPlan(tl,'.pv260',0.6); odoTo(tl,'pvodo',260,2.0,1.4,3);
tl.to('#pv260',{opacity:0,duration:0.7},5.0).to('#pv280',{opacity:1,duration:0.7},5.0);
tl.set('#pv280 .walls,#pv280 .glass,#pv280 .doors',{strokeDashoffset:0},0).set('#pv280 .zone,#pv280 .desk',{opacity:1},0);
tl.set('#pv301 .walls,#pv301 .glass,#pv301 .doors',{strokeDashoffset:0},0).set('#pv301 .zone,#pv301 .desk',{opacity:1},0);
odoTo(tl,'pvodo',280,5.1,1.0,3); tl.to('#ch260',{backgroundColor:'rgba(255,255,255,.05)',borderColor:'rgba(255,255,255,.18)',color:'#c9d1dc',duration:0.3},5.0).to('#ch280',{backgroundColor:'#2a55e5',borderColor:'#2a55e5',color:'#fff',duration:0.3},5.0);
tl.to('#pv280',{opacity:0,duration:0.7},8.0).to('#pv301',{opacity:1,duration:0.7},8.0);
odoTo(tl,'pvodo',301,8.1,1.0,3); tl.to('#ch280',{backgroundColor:'rgba(255,255,255,.05)',borderColor:'rgba(255,255,255,.18)',color:'#c9d1dc',duration:0.3},8.0).to('#ch301',{backgroundColor:'#2a55e5',borderColor:'#2a55e5',color:'#fff',duration:0.3},8.0);"""
open(os.path.join(E, "compositions/plan-privilon.html"), "w").write(scene("plan-privilon", 12, body, js))

# ---------------- Corporate Avenue: two floors (152 + 114 = 266), 6,207 sq ft each
c1 = svg("corporate-266-plan1", "ca1").replace('<svg class="plan', '<svg style="position:absolute;left:0;top:0;width:520px;height:668px" class="plan')
c2 = svg("corporate-266-plan2", "ca2").replace('<svg class="plan', '<svg style="position:absolute;left:0;top:0;width:520px;height:668px" class="plan')
body = f"""<div class="eyebrow">Corporate Avenue · 3rd and 4th floors</div><div class="head">Two teams,<br>one stair apart.</div>
<div style="position:absolute;left:1150px;top:250px;width:520px;height:668px">{c1}</div><div class="cap" style="left:1150px;top:940px">3rd floor · {odo('caf1',3)}</div>
<div style="position:absolute;left:1620px;top:250px;width:520px;height:668px;transform:translateX(-300px)"></div>
<div style="position:absolute;left:1360px;top:250px;width:520px;height:668px;opacity:0" id="ca2wrap">{c2}</div>
<div class="big" style="left:120px;top:420px">{odo('caodo',3)}<span class="unit">workstations<br>across both floors</span></div>
<div class="big" style="left:120px;top:640px">{odo('casq',4,0).replace('font-size:150px','')}<span class="unit">sq ft carpet<br>on each floor</span></div>
<div class="chips" style="left:120px;top:860px"><span class="chip on">266</span><span class="chip">281</span><span class="chip">373</span><span class="chip" style="border:none;background:none;color:#6c7684">seat plans</span></div>
<div class="src">Seats counted from the CAD · carpet area from the deck</div>"""
body = body.replace('<div style="position:absolute;left:1620px;top:250px;width:520px;height:668px;transform:translateX(-300px)"></div>\n', '')
body = body.replace('<div class="cap" style="left:1150px;top:940px">3rd floor · ' + odo('caf1',3) + '</div>', '<div class="cap" id="cap3" style="left:860px;top:940px">3rd floor</div><div class="cap" id="cap4" style="left:1390px;top:940px;opacity:0">4th floor</div>')
body = body.replace('left:1150px;top:250px;width:520px;height:668px">', 'left:860px;top:250px;width:520px;height:668px">')
body = body.replace('left:1360px;top:250px;width:520px;height:668px;opacity:0" id="ca2wrap"', 'left:1390px;top:250px;width:520px;height:668px;opacity:0" id="ca2wrap"')
js = """drawPlan(tl,'.ca1',0.6); odoTo(tl,'caodo',152,2.0,1.3,3);
tl.to('#ca2wrap',{opacity:1,duration:0.6},4.6).to('#cap4',{opacity:1,duration:0.6},4.6); drawPlan(tl,'.ca2',4.6); odoTo(tl,'caodo',266,6.2,1.2,3);
odoTo(tl,'casq',6207,7.4,1.4,4);
tl.from('#plan-corporate-stage .chips',{opacity:0,y:16,duration:0.6},8.4);"""
open(os.path.join(E, "compositions/plan-corporate.html"), "w").write(scene("plan-corporate", 12, body.replace('class="odo" id="casq"','class="odo" id="casq" style="font-size:110px"'), js))

# ---------------- 723 Avenue: 13th and 14th floors + terrace
a1 = svg("723-284-plan1", "a1").replace('<svg class="plan', '<svg style="position:absolute;left:0;top:0;width:620px;height:390px" class="plan')
a2 = svg("723-284-plan2", "a2").replace('<svg class="plan', '<svg style="position:absolute;left:0;top:0;width:620px;height:390px" class="plan')
body = f"""<div class="eyebrow">723 Avenue · the top of the building</div><div class="head">Two floors.<br>And the terrace above.</div>
<div style="position:absolute;left:560px;top:300px;width:620px;height:390px">{a1}</div><div class="cap" style="left:560px;top:710px">13th floor</div>
<div style="position:absolute;left:1220px;top:300px;width:620px;height:390px;opacity:0" id="a2wrap">{a2}</div><div class="cap" id="cap14" style="left:1220px;top:710px;opacity:0">14th floor</div>
<div class="big" style="left:120px;top:420px">{odo('aodo',3)}<span class="unit">workstations<br>proposed plan</span></div>
<div class="tile" id="terr" style="left:560px;top:790px;width:1280px;opacity:0"><b>Terrace · Flipkart's own breakout</b><span>Open air above the 14th floor, available with the offer · bare-shell floors, ready to fit out</span></div>
<div class="src">Seats counted from the CAD</div>"""
js = """drawPlan(tl,'.a1',0.6); odoTo(tl,'aodo',168,2.0,1.3,3);
tl.to('#a2wrap,#cap14',{opacity:1,duration:0.6},3.6); drawPlan(tl,'.a2',3.6); odoTo(tl,'aodo',284,5.2,1.2,3);
tl.to('#terr',{opacity:1,y:-10,duration:0.8,ease:'power3.out'},6.4);"""
open(os.path.join(E, "compositions/plan-723.html"), "w").write(scene("plan-723", 10, body, js))
print("built plan-privilon, plan-corporate, plan-723")
