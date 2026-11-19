// The 2D plan: the floor's own CAD linework, its processes (6th) or rooms (4th) colour-coded with a gap between
// each, and the numbers for whatever is clicked. Smooth pan and zoom (every input moves a goal; the view eases to it).
const NS = 'http://www.w3.org/2000/svg';
const $ = (s) => document.querySelector(s);
const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const fmt = (n) => Number(n).toLocaleString('en-IN');
const ftin = (m) => { let i = Math.round(m / .0254), f = Math.floor(i / 12); i -= f * 12; return `${f}'${i}"`; };
const size = (d) => d ? `${ftin(d[0])} × ${ftin(d[1])}` : '';
const cache = {};
export const loadPlan = (id) => cache[id] || (cache[id] = fetch(`data/plan_${id}.json`).then(r => r.json()));

let P = null, view = null, goal = null, raf = 0, sel = null;
const wrap = $('#svgwrap'), svg = $('#svg');

function fitBox(b, pad = 1.06) {
  const W = wrap.clientWidth || 800, H = wrap.clientHeight || 600, w = (b[2] - b[0]) * pad, h = (b[3] - b[1]) * pad;
  const s = Math.max(w / W, h / H); return { cx: (b[0] + b[2]) / 2, cy: -(b[1] + b[3]) / 2, s };   // s = metres per pixel
}
function apply() {
  const W = wrap.clientWidth, H = wrap.clientHeight;
  svg.setAttribute('viewBox', `${view.cx - W * view.s / 2} ${view.cy - H * view.s / 2} ${W * view.s} ${H * view.s}`);
  const lab = svg.querySelector('#labels'); if (lab) lab.style.display = '';
  svg.style.setProperty('--px', view.s);
}
function tick() {
  raf = 0; const k = 0.22;
  view.cx += (goal.cx - view.cx) * k; view.cy += (goal.cy - view.cy) * k; view.s *= Math.pow(goal.s / view.s, k);
  apply();
  if (Math.abs(goal.cx - view.cx) > view.s * .3 || Math.abs(goal.cy - view.cy) > view.s * .3 || Math.abs(Math.log(goal.s / view.s)) > .002) raf = requestAnimationFrame(tick);
  else { Object.assign(view, goal); apply(); }
}
const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
const clampS = (s) => Math.min(Math.max(s, P.s0 / 14), P.s0 * 1.6);
function zoomAt(f, px, py) {          // f < 1 zooms in, around the screen point (px, py)
  const W = wrap.clientWidth, H = wrap.clientHeight, s1 = clampS(goal.s * f), mx = goal.cx + (px - W / 2) * goal.s, my = goal.cy + (py - H / 2) * goal.s;
  goal.cx = mx - (px - W / 2) * s1; goal.cy = my - (py - H / 2) * s1; goal.s = s1; kick();
}

// ------------------------------------------------------------------ build
// Two views of a floor, one toggle: the client's requirement (the processes on the 6th, the brief's rooms on the 4th)
// and the inventory (every supporting space the drawing has: meeting rooms, server and electrical rooms, washrooms,
// pantry, lockers, lobby and waiting). Each item is clickable and shows its seats, width x depth and area.
const INV = { meeting: ['Meeting rooms', '#8e6fd1'], service: ['Server, electrical & storage', '#e07b39'], wc: ['Washrooms', '#4aa3c8'], cafe: ['Pantry', '#d9a52b'],
  lounge: ['Breakout & landscape', '#5aa64a'], reception: ['Reception & waiting', '#2fb4d6'], core: ['Lobby & core', '#8c8680'] };
let mode = 'req';
export async function openPlan(id, onBack) {
  P = await loadPlan(id); $('#plan').classList.add('on'); sel = null; mode = 'req';
  $('#ptitle').textContent = P.title; $('#psub').textContent = '';
  svg.innerHTML = '';
  const root = el('g', {}, svg);
  el('path', { d: P.plate, fill: '#ffffff', stroke: 'none' }, root);
  const pas = el('g', { 'pointer-events': 'none' }, root);
  for (const o of P.others) if (o.kind === 'passage') el('path', { d: o.d, fill: '#ece8e1', stroke: 'none' }, pas);
  P.items = {}; P.inv = [];
  const ig = el('g', { id: 'invg' }, root);
  P.others.forEach((o, i) => { if (o.kind === 'passage' || !INV[o.kind]) return;
    const it = { ...o, id: 'inv-' + i, kind: 'inv', type: o.kind, group: INV[o.kind][0], color: INV[o.kind][1] }; P.inv.push(it);
    const g = el('g', { class: 'z', 'data-id': it.id }, ig);
    if (o.dims_m) el('path', { d: o.d, fill: it.color, 'fill-opacity': .16, stroke: 'none' }, g);
    else el('circle', { cx: o.label[0], cy: -o.label[1], r: .55, fill: it.color, 'fill-opacity': .16, stroke: it.color, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, g);   // outline not closed in the drawing: a marker, not a guessed shape
    g.addEventListener('click', (e) => { if (P.moved || mode !== 'inv') return; e.stopPropagation(); select(it.id, false); });
    P.items[it.id] = { z: it, g }; });
  const zg = el('g', { id: 'zoneg' }, root);
  for (const z of P.zones) {
    const g = el('g', { class: 'z', 'data-id': z.id }, zg);
    el('path', { class: 'f', d: z.d, fill: z.color, 'fill-opacity': .42, stroke: z.color, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }, g);
    g.addEventListener('click', (e) => { if (P.moved || mode !== 'req') return; e.stopPropagation(); select(z.id, false); });
    g.addEventListener('mouseenter', () => { if (!sel && mode === 'req') g.querySelector('path').setAttribute('fill-opacity', .6); });
    g.addEventListener('mouseleave', () => { if (!sel && mode === 'req') g.querySelector('path').setAttribute('fill-opacity', .42); });
    P.items[z.id] = { z, g };
  }
  const C = P.cad, cg = el('g', { 'pointer-events': 'none', fill: 'none', 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, root);
  const L = (d, c, w) => d && el('path', { d, stroke: c, 'stroke-width': w, 'vector-effect': 'non-scaling-stroke' }, cg);
  L(C.hatch, '#d8d4cc', .4); L(C.furn, '#7d7a75', .45); L(C.doors, '#8a8780', .6); L(C.glass, '#2f86b4', .9); L(C.walls, '#1d1c1a', 1.25);
  // labels: the name and the overall width x depth, sized to fit each space
  const lz = el('g', { id: 'labz' }, root), li = el('g', { id: 'labi' }, root);
  const label = (z, g, parent, fs, w1 = 800) => {
    const t = el('text', { x: z.label[0], y: -z.label[1], 'text-anchor': 'middle', 'font-size': fs, 'font-weight': w1, fill: '#1d1c1a', 'stroke-width': fs * .28 }, parent); t.textContent = z.name;
    const t2 = el('text', { x: z.label[0], y: -z.label[1] + fs * 1.05, 'text-anchor': 'middle', 'font-size': fs * .78, 'font-weight': 600, fill: '#3f3c38', 'stroke-width': fs * .24 }, parent); t2.textContent = z.dims_m ? size(z.dims_m) : (z.cad_sqft ? `${z.cad_sqft} sq ft` : '');
    fitLabel(g, t, t2, fs); };
  for (const z of P.zones) label(z, P.items[z.id].g, lz, Math.max(.55, Math.min(1.5, Math.sqrt(z.area_m2) / 7.5)));
  for (const it of P.inv) if (it.label) label(it, P.items[it.id].g, li, Math.max(.3, Math.min(.8, Math.sqrt(it.area_sqft / 10.76) / 6)), 700);
  setMode('req');
  requestAnimationFrame(() => { P.s0 = fitBox(P.bounds).s; view = fitBox(P.bounds); goal = { ...view }; view.s *= 1.15; apply(); kick(); });
  $('#back').onclick = () => { closePlan(); onBack && onBack(); };
}
// shrink a space's two label lines until they sit inside it (long names in small rooms)
function fitLabel(g, t, t2, fs) {
  try {
    const zb = g.getBBox(), ring = !g.querySelector('path'), w = (ring ? Math.max(zb.width, 3.5) : zb.width) * .9, h = (ring ? Math.max(zb.height, 1.6) : zb.height) * .8; let b1 = t.getBBox(), b2 = t2.getBBox();
    const k = Math.min(1, w / Math.max(b1.width, b2.width, 1e-3), h / Math.max(b1.height + b2.height, 1e-3));
    if (k < 1) { const f = Math.max(fs * k, .14); t.setAttribute('font-size', f); t.setAttribute('stroke-width', f * .28); t2.setAttribute('font-size', f * .78); t2.setAttribute('stroke-width', f * .24); }
    const y0 = +t.getAttribute('y'), f1 = +t.getAttribute('font-size'); t.setAttribute('y', y0 - f1 * .2); t2.setAttribute('y', y0 - f1 * .2 + f1 * 1.05);
  } catch (e) { }
}
export function closePlan() { $('#plan').classList.remove('on'); sel = null; }

function setMode(m) {
  mode = m; sel = null; $('#sel').classList.remove('on');
  $('#mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  const req = m === 'req';
  svg.querySelector('#zoneg').style.pointerEvents = req ? '' : 'none'; svg.querySelector('#invg').style.pointerEvents = req ? 'none' : '';
  svg.querySelector('#labz').style.display = req ? '' : 'none'; svg.querySelector('#labi').style.display = req ? 'none' : '';
  paint(); sidebar();
}
function paint() {
  const req = mode === 'req';
  for (const [k, { z, g }] of Object.entries(P.items)) {
    const p = g.querySelector('path,circle'), mine = (z.kind === 'inv') !== req, on = !sel || k === sel;
    if (!mine) { p.setAttribute('fill-opacity', z.kind === 'inv' ? .16 : .08); g.style.opacity = 1; if (z.kind !== 'inv') p.setAttribute('stroke-width', .6); continue; }
    p.setAttribute('fill-opacity', !sel ? (z.kind === 'inv' ? .55 : .42) : k === sel ? .8 : .1); g.style.opacity = on ? 1 : .55;
    if (z.kind !== 'inv') p.setAttribute('stroke-width', k === sel ? 3.2 : 1.6);
  }
}
function sidebar() {
  const row = (z) => `<button class="row" data-id="${z.id}"><i style="background:${z.color}"></i><span>${z.name}</span><em>${z.seats || '–'}</em><small>${z.kind === 'inv' && !z.dims_m ? (z.cad_sqft ? fmt(z.cad_sqft) + ' sq ft' : '–') : fmt(z.area_sqft) + ' sq ft'}</small></button>`;
  if (mode === 'req') $('#list').innerHTML = P.zones.slice().sort((a, b) => b.seats - a.seats).map(row).join('');
  else { const by = {}; for (const k of Object.keys(INV)) by[INV[k][0]] = []; for (const it of P.inv) by[it.group].push(it);
    $('#list').innerHTML = Object.entries(by).filter(([, l]) => l.length).map(([g, l]) => `<div class="grp k">${g} · ${l.length}</div>` + l.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(row).join('')).join('') || '<div class="grp">No supporting spaces in this drawing.</div>'; }
  $('#list').querySelectorAll('.row').forEach(b => b.onclick = () => select(b.dataset.id, true));
  $('#foot').textContent = mode === 'req' ? 'Seats: one chair block per seat in the drawing. Sizes: overall width × depth of the zone outline.' : 'Every supporting space in the drawing, with its overall width × depth and area.';
}
function select(id, zoom) {
  if (sel === id) id = null; sel = id; paint();
  $('#list').querySelectorAll('.row').forEach(b => b.classList.toggle('cur', b.dataset.id === id));
  const s = $('#sel'); if (!id) { s.classList.remove('on'); return; }
  const z = P.items[id].z; s.classList.add('on');
  const perSeat = z.seats ? Math.round(z.area_sqft / z.seats) : null, sz = z.dims_m ? `${size(z.dims_m)} (${z.dims_m[0]} × ${z.dims_m[1]} m)` : 'outline not closed in the drawing';
  const rows = z.kind === 'process'
    ? [['Seats drawn (CAD)', z.seats], ['Brief: required', z.sheet_required], ['Brief: achieved', z.sheet_achieved], ['Desk size (brief)', z.desk], ['Width × depth', sz], ['Area', `${fmt(z.area_sqft)} sq ft (${z.area_m2} m²)`], ['Area per seat', perSeat ? `${perSeat} sq ft` : '–']]
    : z.kind === 'inv' ? [['Type', z.group], ['Seats drawn (CAD)', z.seats || '–'], ['Width × depth', sz], ['Area', z.dims_m ? `${fmt(z.area_sqft)} sq ft` + (z.approx ? ' (approx.)' : '') : (z.cad_sqft ? `${fmt(z.cad_sqft)} sq ft (per the drawing's label)` : '–')]]
    : [['Room type', z.group], ['Seats drawn (CAD)', z.seats || '–'], ['Width × depth', sz], ['Area', `${fmt(z.area_sqft)} sq ft (${z.area_m2} m²)`], ...(z.brief ? [['On the brief', z.brief]] : [])];
  const note = z.kind === 'process' && z.seats !== z.sheet_achieved ? `<div class="note">The drawing shows ${z.seats} seats; the brief says ${z.sheet_achieved} achieved.</div>` : '';
  s.innerHTML = `<h3><i style="background:${z.color}"></i>${z.name}</h3>
    <div class="big"><div><b>${z.seats || '–'}</b><span>Seats</span></div><div><b>${fmt(z.area_sqft)}</b><span>Sq ft</span></div></div>
    <table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>${note}`;
  const r = $('#list').querySelector(`[data-id="${id}"]`); if (r) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (zoom) { const bb = P.items[id].g.getBBox(); const f = fitBox([bb.x, -(bb.y + bb.height), bb.x + bb.width, -bb.y], 2.2); f.s = clampS(Math.max(f.s, P.s0 / 6)); Object.assign(goal, f); kick(); }
}
$('#mode').querySelectorAll('button').forEach(b => b.onclick = () => { if (P) setMode(b.dataset.m); });

// ------------------------------------------------------------------ input: drag to pan, wheel / pinch to zoom, keys
const pts = new Map(); let last = null;
wrap.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); P.moved = false; last = null; });
wrap.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId) || !goal) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 1) { const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; if (!P.moved && Math.abs(dx) + Math.abs(dy) > 2) { P.moved = true; try { wrap.setPointerCapture(e.pointerId); } catch (er) { } wrap.classList.add('drag'); } goal.cx -= dx * goal.s; goal.cy -= dy * goal.s; view.cx -= dx * view.s; view.cy -= dy * view.s; apply(); }
  else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = wrap.getBoundingClientRect(), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
    if (last) { zoomAt(last.d / d, mx, my); goal.cx -= (mx - last.mx) * goal.s; goal.cy -= (my - last.my) * goal.s; } last = { d, mx, my }; P.moved = true; }
});
const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) last = null; if (!pts.size) wrap.classList.remove('drag'); setTimeout(() => { if (P) P.moved = false; }, 0); };
wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
wrap.addEventListener('wheel', (e) => { e.preventDefault(); if (!goal) return; const r = wrap.getBoundingClientRect();
  if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? .012 : .0022)), e.clientX - r.left, e.clientY - r.top);
  else { goal.cx += e.deltaX * goal.s; kick(); } }, { passive: false });
wrap.addEventListener('dblclick', (e) => { const r = wrap.getBoundingClientRect(); zoomAt(.5, e.clientX - r.left, e.clientY - r.top); });
svg.addEventListener('click', () => { if (!P.moved && sel) select(sel, false); });
$('#zin').onclick = () => zoomAt(.6, wrap.clientWidth / 2, wrap.clientHeight / 2);
$('#zout').onclick = () => zoomAt(1.6, wrap.clientWidth / 2, wrap.clientHeight / 2);
$('#zfit').onclick = () => { Object.assign(goal, fitBox(P.bounds)); kick(); };
addEventListener('keydown', (e) => {
  if (!$('#plan').classList.contains('on') || !goal) return; const st = 60 * goal.s;
  const m = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.code];
  if (m) { goal.cx += m[0]; goal.cy += m[1]; kick(); e.preventDefault(); }
  if (e.key === '+' || e.key === '=') zoomAt(.7, wrap.clientWidth / 2, wrap.clientHeight / 2);
  if (e.key === '-') zoomAt(1.4, wrap.clientWidth / 2, wrap.clientHeight / 2);
  if (e.code === 'Escape') { if (sel) select(sel, false); else $('#back').click(); }
});
addEventListener('resize', () => { if (P && view && $('#plan').classList.contains('on')) { P.s0 = fitBox(P.bounds).s; apply(); } });
