// The floor plan with you on it, a standard part of every tenant floor (ported from the Volt page's CAD locator,
// but drawn from the layout JSON alone, so any tenant gets it with no extra files):
//   - the plan: demise, rooms tinted by kind, walls, glass, doors, desks, room names; areas not in this fit-out hatched;
//     another tenant on the same plate in grey with its name;
//   - "you are here": a dot with the view cone, live while walking, gliding or touring;
//   - "where you're heading next": the planned route as a line during glides and the tour, the destination room outlined,
//     and the next authored view marked;
//   - tap a room = glide there along the route (never a jump).
// Coordinates are the tenant's plan frame (metres, x east, y north); the canvas draws y up.
import { inRings, centroid } from './nav.js';

const KIND_FILL = { work: 'rgba(214,69,43,.20)', meeting: 'rgba(66,120,232,.24)', training: 'rgba(120,96,220,.24)', cafe: 'rgba(31,154,85,.24)',
  lounge: 'rgba(214,138,31,.24)', reception: 'rgba(160,110,220,.26)', operator: 'rgba(255,255,255,.10)', wc: 'rgba(255,255,255,.07)', core: 'rgba(255,255,255,.12)', service: 'rgba(255,255,255,.09)' };
const PXM = 24;                                           // static plan resolution, px per metre

export function createMinimap({ root, onPickRoom, onPickView }) {
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const M = { t: null, plan: null, others: [], big: false, open: false, view: null, last: 0, bp: null, cad: true };
  // Volt's CAD locator: the DWG's own lines (blueprints/<plan>.png, drawn by tools/blueprint_rtp.py) under you, in the same frame
  async function loadBlueprint(t) {
    M.bp = null; const b = t.man.blueprint; if (!b) return;
    try { const meta = await (await fetch(b.meta)).json(); const img = new Image(); img.decoding = 'async'; img.src = b.img; await img.decode(); if (M.t === t) { M.bp = { img, bounds: meta.bounds }; M.last = 0; } } catch (e) { console.warn('[mm] blueprint', e); }
  }

  // ---------------------------------------------------------------- static plan (once per tenant)
  function build(t, others) {
    const L = t.L, xs = [], ys = [];
    t.region[0].forEach(p => { xs.push(p[0]); ys.push(p[1]); });
    for (const o of others) o.ring.forEach(p => { xs.push(p[0]); ys.push(p[1]); });
    const b = [Math.min(...xs) - 1.5, Math.min(...ys) - 1.5, Math.max(...xs) + 1.5, Math.max(...ys) + 1.5];
    const c = document.createElement('canvas'); c.width = Math.ceil((b[2] - b[0]) * PXM); c.height = Math.ceil((b[3] - b[1]) * PXM);
    const g = c.getContext('2d'), X = (x) => (x - b[0]) * PXM, Y = (y) => (b[3] - y) * PXM;
    const path = (rings) => { g.beginPath(); for (const r of rings) r.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))), g.closePath(); };
    g.fillStyle = '#0f2346'; g.fillRect(0, 0, c.width, c.height);
    // another tenant on the same plate: grey, named
    // another tenant on the same plate: grey, named; then this tenant's demise over it (a strip both drawings share stays ours)
    for (const o of others) { path([o.ring]); g.fillStyle = '#58606b'; g.fill('evenodd'); }
    path(t.region); g.fillStyle = '#1b3a6b'; g.fill('evenodd');
    // areas inside the plan that are not this tenant's fit-out: hatched
    const hatch = (() => { const h = document.createElement('canvas'); h.width = h.height = 12; const hg = h.getContext('2d'); hg.strokeStyle = 'rgba(255,255,255,.22)'; hg.lineWidth = 1.5;
      hg.beginPath(); hg.moveTo(0, 12); hg.lineTo(12, 0); hg.moveTo(-3, 3); hg.lineTo(3, -3); hg.moveTo(9, 15); hg.lineTo(15, 9); hg.stroke(); return g.createPattern(h, 'repeat'); })();
    for (const nd of L.not_demised || []) { path([nd.poly, ...(nd.holes || [])]); g.fillStyle = 'rgba(15,35,70,.6)'; g.fill('evenodd'); g.fillStyle = hatch; g.fill('evenodd'); }
    // rooms by kind
    for (const r of t.rooms) { const f = KIND_FILL[r.kind]; if (!f) continue; path(r.rings); g.fillStyle = f; g.fill('evenodd'); }
    // desks and tables, faint
    g.fillStyle = 'rgba(255,255,255,.22)';
    for (const d of L.desks) { const ca = Math.cos(d.a), sa = Math.sin(d.a); g.save(); g.translate(X(d.c[0]), Y(d.c[1])); g.rotate(-d.a); g.fillRect(-d.w / 2 * PXM, -d.d / 2 * PXM, d.w * PXM, d.d * PXM); g.restore(); }
    for (const tb of L.tables) { if (tb.circle) { g.beginPath(); g.arc(X(tb.circle[0]), Y(tb.circle[1]), tb.circle[2] * PXM, 0, 7); g.fill(); } else if (!/toilet|washroom/i.test(tb.room || '')) { path([tb.poly]); g.fill(); } }
    // walls and columns
    g.fillStyle = 'rgba(236,242,250,.92)';
    for (const w of L.walls) { path([w.outer, ...(w.holes || [])]); g.fill('evenodd'); }
    for (const col of L.columns) { path([col]); g.fill(); }
    // glass
    g.strokeStyle = '#8fd3ff'; g.lineWidth = 2; g.beginPath();
    for (const [x0, y0, x1, y1] of L.glass) { g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); } g.stroke();
    // doors: the leaf (hinge to open tip when the file has it, else the drawn leaf)
    g.strokeStyle = 'rgba(255,210,122,.85)'; g.lineWidth = 1.6; g.beginPath();
    for (const d of L.doors) { if (d.hinge && d.open_leaf_tip) { g.moveTo(X(d.hinge[0]), Y(d.hinge[1])); g.lineTo(X(d.open_leaf_tip[0]), Y(d.open_leaf_tip[1])); }
      else { const ex = Math.cos(d.a) * d.w / 2, ey = Math.sin(d.a) * d.w / 2; g.moveTo(X(d.c[0] - ex), Y(d.c[1] - ey)); g.lineTo(X(d.c[0] + ex), Y(d.c[1] + ey)); } }
    g.stroke();
    return { c, b };
  }
  function setTenant(t, others = [], later = null) {
    M.later = later;
    if (!t) { M.t = null; M.plan = null; return; }
    if (M.t === t && M.others.length === others.length) return;
    M.t = t; M.others = others; M.plan = build(t, others); loadBlueprint(t);
    M.labels = t.tourRooms.filter(r => r.area > 6).map(r => ({ r, c: r.views && r.c ? labelPoint(r) : r.c }));
    M.otherLabels = others.map(o => ({ name: o.name, c: labelIn(o.ring) })).concat((t.L.not_demised || []).map(nd => ({ name: /another tenant|occupied/i.test(nd.why || '') ? (M.later || 'Another tenant') : 'Not in this fit-out', c: centroid(nd.poly), faint: true }))
      .filter(l => !others.some(o => inRings([o.ring], l.c[0], l.c[1]))));
  }
  function labelIn(ring) { const c = centroid(ring); if (inRings([ring], c[0], c[1])) return c; const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) { const x = Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * i / 10, y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * j / 10; if (inRings([ring], x, y)) return [x, y]; } return c; }
  function labelPoint(r) { const c = r.c; if (inRings(r.rings, c[0], c[1])) return c; const [x0, y0, x1, y1] = r.box; for (let k = 1; k < 8; k++) for (const [fx, fy] of [[.5, .5], [.3, .5], [.7, .5], [.5, .3], [.5, .7]]) { const x = x0 + (x1 - x0) * fx, y = y0 + (y1 - y0) * fy; if (inRings(r.rings, x, y)) return [x, y]; } return c; }

  // ---------------------------------------------------------------- per frame
  function draw(st) {
    const now = performance.now(); if (now - M.last < 45) return; M.last = now;       // ~20 fps is plenty for a map
    if (!M.t || !M.plan || !st.visible) { root.hidden = true; return; } root.hidden = false;
    const dpr = Math.min(2, devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const { c, b } = M.plan, P = st.pose, big = M.big || M.open;
    // small: follow you (about 24 m across); big: the whole floor
    const k = big ? Math.min(cw / (b[2] - b[0]), ch / (b[3] - b[1])) : cw / 24;
    const cx = big ? (b[0] + b[2]) / 2 : P.x, cy = big ? (b[1] + b[3]) / 2 : P.y;
    M.view = { k, cx, cy, cw, ch };
    const S = (x, y) => [cw / 2 + (x - cx) * k, ch / 2 - (y - cy) * k];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0b1b37'; ctx.fillRect(0, 0, cw, ch);
    if (M.cad && M.bp) { const B = M.bp.bounds, [sx, sy] = S(B[0], B[3]); ctx.imageSmoothingEnabled = true; ctx.fillStyle = '#123b7a'; ctx.fillRect(0, 0, cw, ch); ctx.drawImage(M.bp.img, sx, sy, (B[2] - B[0]) * k, (B[3] - B[1]) * k); }
    else { const [sx, sy] = S(b[0], b[3]); ctx.imageSmoothingEnabled = true; ctx.drawImage(c, sx, sy, (b[2] - b[0]) * k, (b[3] - b[1]) * k); }
    const ring = (rings) => { ctx.beginPath(); for (const r of rings) r.forEach(([x, y], i) => { const [u, v] = S(x, y); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }), ctx.closePath(); };
    // current room and destination room
    if (st.room) { ring(st.room.rings); ctx.fillStyle = 'rgba(255,170,70,.22)'; ctx.fill('evenodd'); ctx.strokeStyle = 'rgba(255,170,70,.95)'; ctx.lineWidth = 1.6; ctx.stroke(); }
    if (st.dest && st.dest !== st.room) { ring(st.dest.rings); ctx.fillStyle = 'rgba(80,220,255,.14)'; ctx.fill('evenodd'); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#5ee0ff'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.setLineDash([]); }
    // the planned route
    if (st.route && st.route.length > 1) {
      ctx.strokeStyle = '#5ee0ff'; ctx.lineWidth = 3; ctx.lineJoin = ctx.lineCap = 'round'; ctx.setLineDash([7, 5]); ctx.beginPath();
      st.route.forEach(([x, y], i) => { const [u, v] = S(x, y); i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }); ctx.stroke(); ctx.setLineDash([]);
    }
    // where a view will look from: the target view (during a glide) and the next one (Next ›)
    const viewMark = (v, col, filled) => { if (!v) return; const [u, w] = S(v.x, v.y); ctx.save(); ctx.translate(u, w); ctx.rotate(-v.a);
      ctx.fillStyle = col.replace('1)', '.28)'); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 22, -.55, .55); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); if (filled) { ctx.fillStyle = col; ctx.fill(); } ctx.stroke(); ctx.restore(); };
    viewMark(st.next, 'rgba(255,255,255,1)', false);
    viewMark(st.target, 'rgba(94,224,255,1)', true);
    // room names (screen space, only what fits)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = big ? 10.5 : 10; ctx.font = `600 ${fs}px Inter,system-ui,sans-serif`;
    const placed = [], order = [...M.labels].sort((a, b) => (b.r === st.room) - (a.r === st.room) || (b.r === st.dest) - (a.r === st.dest) || b.r.area - a.r.area);
    for (const { r, c: pc } of order) { const [u, v] = S(pc[0], pc[1]); if (u < -40 || v < -10 || u > cw + 40 || v > ch + 10) continue;
      const wpx = (r.box[2] - r.box[0]) * k; if (wpx < 34 && r !== st.room && r !== st.dest) continue;
      const txt = r.label.length > 22 && !big ? r.label.slice(0, 20) + '…' : r.label;
      const tw = ctx.measureText(txt).width, bx = [u - tw / 2 - 2, v - fs / 2 - 1, u + tw / 2 + 2, v + fs / 2 + 1];
      if (placed.some(q => q[0] < bx[2] && bx[0] < q[2] && q[1] < bx[3] && bx[1] < q[3])) continue; placed.push(bx);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,20,44,.85)'; ctx.strokeText(txt, u, v); ctx.fillStyle = r === st.room ? '#ffd29a' : r === st.dest ? '#a8f0ff' : 'rgba(255,255,255,.88)'; ctx.fillText(txt, u, v); }
    for (const o of M.otherLabels) { const [u, v] = S(o.c[0], o.c[1]); if (u < 0 || v < 0 || u > cw || v > ch) continue; ctx.font = `700 ${big ? 12 : 10.5}px Inter,system-ui,sans-serif`;
      ctx.fillStyle = o.faint ? 'rgba(255,255,255,.55)' : 'rgba(230,234,240,.9)'; ctx.fillText(o.name, u, v); }
    // you
    { const [u, v] = S(P.x, P.y); ctx.save(); ctx.translate(u, v); ctx.rotate(-P.a);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 46); gr.addColorStop(0, 'rgba(255,190,90,.75)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 46, -.6, .6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff9f2e'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(7, -4.5); ctx.lineTo(7, 4.5); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.textAlign = 'left';
    root.querySelector('.mm-here').textContent = st.room ? st.room.label.replace(/^open\s*work\s*stations?\b.*/i, 'Open workstations') : 'Passage';
    const xy = root.querySelector('.mm-xy'); if (xy) { const ft = (m) => { const i = Math.round(Math.abs(m) / .0254); return `${m < 0 ? '−' : ''}${Math.floor(i / 12)}′${i % 12}″`; }; xy.textContent = `X ${P.x.toFixed(1)} m (${ft(P.x)}) · Y ${P.y.toFixed(1)} m (${ft(P.y)})`; }
    const nx = root.querySelector('.mm-next'); nx.textContent = st.headingText || ''; nx.hidden = !st.headingText;
  }
  // ---------------------------------------------------------------- picking: a room = glide there; a view mark in this room = that view
  cv.addEventListener('pointerdown', (e) => {
    if (!M.view || !M.t) return; e.stopPropagation(); e.preventDefault();
    const r = cv.getBoundingClientRect(), v = M.view, x = v.cx + (e.clientX - r.left - v.cw / 2) / v.k, y = v.cy - (e.clientY - r.top - v.ch / 2) / v.k;
    const room = M.t.tourRooms.find(q => inRings(q.rings, x, y));
    if (room && onPickView && M.cur === room) { const i = room.views.findIndex(w => Math.hypot(w.position[0] - x, w.position[1] - y) < 14 / v.k); if (i >= 0) return onPickView(room, i); }
    if (room) onPickRoom(room);
  });
  { const cb = root.querySelector('.mm-cad'); if (cb) cb.onclick = (e) => { e.stopPropagation(); M.cad = !M.cad; cb.textContent = M.cad ? 'CAD' : 'Plan'; M.last = 0; }; }
  root.querySelector('.mm-size:not(.mm-cad)').onclick = (e) => { e.stopPropagation(); M.big = !M.big; root.classList.toggle('big', M.big); M.last = 0; };
  root.querySelector('.mm-chip').onclick = (e) => { e.stopPropagation(); M.open = !M.open; document.body.classList.toggle('mmopen', M.open); M.last = 0; };
  const screenOf = (x, y) => { const v = M.view, r = cv.getBoundingClientRect(); return v ? [r.left + v.cw / 2 + (x - v.cx) * v.k, r.top + v.ch / 2 - (y - v.cy) * v.k] : null; };
  return { screenOf, setTenant, draw: (st) => { M.cur = st.room; draw(st); }, get big() { return M.big; }, get open() { return M.open; } };
}
