// Volt design studio. One photoreal Blender render of a room, seen from one fixed line of sight, recoloured part by part
// like a car configurator: panels, seating, floor, surfaces, walls, soft seating, cafe, then "Good to go".
// Each part has a black and white mask rendered from the same camera (volt_render.py --masks). A colour is applied
// only inside its mask and keeps the render's own light and shade, so any colour looks lit. "Designer palettes" are
// full re-renders of the same view (volt_render.py --variants), shown as they are.
const $ = (s) => document.querySelector(s);
const CFG = '/media/noida-skymark/volt/configurator/';
const STEPS = [
  { k: 'panels', name: 'Panels', hint: 'The acoustic screens on the desks and the feature panels.', sw: [['Volt orange', '#dd8d36'], ['Sunflower', '#e8c547'], ['Teal', '#2f7d74'], ['Navy', '#2c4a7a'], ['Sage', '#8aa37b'], ['Stone grey', '#9a9690'], ['Terracotta', '#c4553f']] },
  { k: 'seating', name: 'Seating', hint: 'The task chairs at every desk.', sw: [['Graphite', '#1d1d1f'], ['Slate', '#3b3f46'], ['Navy', '#22324f'], ['Forest', '#2f5d58'], ['Oxblood', '#6b2f2f']] },
  { k: 'floor', name: 'Floor', hint: 'Carpet tiles.', sw: [['Charcoal', '#4a4744'], ['Warm grey', '#8d877f'], ['Blue grey', '#6f7a80'], ['Sand', '#b9a48d'], ['Moss', '#6e7a62']] },
  { k: 'surfaces', name: 'Surfaces', hint: 'Desk and table tops.', sw: [['Light oak', '#d8bf9b'], ['Natural', '#c8a27c'], ['Walnut', '#8a6a52'], ['White', '#e9e4dc'], ['Graphite', '#5e5a55']] },
  { k: 'walls', name: 'Walls', hint: 'Painted walls.', sw: [['Warm white', '#efece7'], ['Greige', '#e7e1d6'], ['Sage white', '#e4e9e1'], ['Cloud', '#dde3ea'], ['Blush', '#efe6e1']] },
  { k: 'soft', name: 'Soft seating', hint: 'Sofas and lounge chairs.', sw: [['Pebble', '#a69687'], ['Teal', '#286e7a'], ['Orange', '#d98733'], ['Navy', '#2c4a7a'], ['Olive', '#7d8a6e']] },
  { k: 'cafe', name: 'Cafe', hint: 'Cafe chairs and stools.', sw: [['Orange', '#dd8d36'], ['Yellow', '#e8c547'], ['White', '#f3f1ec'], ['Teal', '#2f7d74'], ['Black', '#1d1d1f']] },
  { k: 'done', name: 'Good to go' },
];
const PRESETS = [   // the same four as blender/variants.json; until those are rendered in full they are applied live
  { name: 'volt', label: 'Volt as designed', palette: {} },
  { name: 'sunlit', label: 'Sunlit yellow', palette: { panels: '#e8c547', seating: '#3b3f46', floor: '#8d877f', surfaces: '#e9e4dc', walls: '#f4efe6', soft: '#b8b2a9', cafe: '#e8c547' } },
  { name: 'calm', label: 'Calm sage', palette: { panels: '#8aa37b', seating: '#22324f', floor: '#6f7a80', surfaces: '#c8a27c', walls: '#e4e9e1', soft: '#2f5d58', cafe: '#f3f1ec' } },
  { name: 'deep', label: 'Deep navy', palette: { panels: '#2c4a7a', seating: '#1d1d1f', floor: '#3b3d42', surfaces: '#8a6a52', walls: '#ebe7e1', soft: '#2c4a7a', cafe: '#1d1d1f' } },
];
const palettes = () => (view && view.variants && view.variants.length) ? view.variants : PRESETS;
const pick = {};                     // part -> hex
let cfg = null, view = null, step = 0, base = null, lum = null, masks = {}, ref = {}, cv = $('#cv'), g = cv.getContext('2d', { willReadFrequently: true });
const toLin = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
const toSrgb = (v) => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055); };
const hexLin = (h) => [1, 3, 5].map(i => toLin[parseInt(h.slice(i, i + 2), 16)]);
const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

async function start() {
  try { cfg = await (await fetch(CFG + 'configurator.json', { cache: 'no-cache' })).json(); } catch (e) { $('#msg').classList.add('show'); return; }
  if (!cfg.views || !cfg.views.length) { $('#msg').classList.add('show'); return; }
  const m = location.hash.match(/p=([^&]+)/); if (m) m[1].split(',').forEach(p => { const [k, c] = p.split(':'); if (k && /^[0-9a-f]{6}$/i.test(c || '')) pick[k] = '#' + c; });
  const vm = location.hash.match(/v=([\w-]+)/);
  $('#views').innerHTML = ''; cfg.views.forEach(v => { const b = document.createElement('button'); b.textContent = v.room.replace(' / command centre', ''); b.onclick = () => load(v); b.dataset.slug = v.slug; $('#views').appendChild(b); });
  drawSteps(); await load(cfg.views.find(v => vm && v.slug === vm[1]) || cfg.views[0]);
}
async function load(v) {
  view = v; document.querySelectorAll('#views button').forEach(b => b.classList.toggle('on', b.dataset.slug === v.slug)); $('#vname').textContent = `${v.room} · Volt, first floor, Skymark F-1`;
  const dir = CFG + v.slug + '/', b = await img(dir + v.beauty);
  cv.width = b.naturalWidth; cv.height = b.naturalHeight; g.drawImage(b, 0, 0); base = g.getImageData(0, 0, cv.width, cv.height);
  const n = cv.width * cv.height, d = base.data; lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = .2126 * toLin[d[i * 4]] + .7152 * toLin[d[i * 4 + 1]] + .0722 * toLin[d[i * 4 + 2]];
  masks = {}; ref = {};
  for (const [k, f] of Object.entries(v.masks || {})) {
    try { const mi = await img(dir + f); const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.drawImage(mi, 0, 0, cv.width, cv.height);
      const md = x.getImageData(0, 0, cv.width, cv.height).data, a = new Uint8Array(n); let s = 0, w = 0;
      for (let i = 0; i < n; i++) { a[i] = md[i * 4]; if (a[i] > 128) { s += lum[i]; w++; } }
      masks[k] = a; ref[k] = w ? s / w : .18;                // the part's average brightness in the render: a new colour keeps each pixel's brightness relative to it
    } catch (e) { /* this part has no mask in this view */ }
  }
  $('#vimg').classList.remove('on'); paint(); drawSteps(); drawPanel();
}
function paint(show = true) {
  if (!base) return; const out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height), o = out.data, n = base.width * base.height;
  if (show) for (const [k, hex] of Object.entries(pick)) {
    const a = masks[k]; if (!a) continue; const [r, gg, b] = hexLin(hex), R = Math.max(ref[k] || .18, 1e-4);
    for (let i = 0; i < n; i++) { const m = a[i]; if (!m) continue; const t = m / 255, s = lum[i] / R, j = i * 4;      // keep this pixel's light and shade, change only the colour
      o[j] = o[j] * (1 - t) + toSrgb(r * s) * t; o[j + 1] = o[j + 1] * (1 - t) + toSrgb(gg * s) * t; o[j + 2] = o[j + 2] * (1 - t) + toSrgb(b * s) * t; }
  }
  g.putImageData(out, 0, 0);
}
function drawSteps() {
  $('#steps').innerHTML = STEPS.map((s, i) => `<button data-i="${i}" class="${i === step ? 'on' : ''} ${s.k !== 'done' && pick[s.k] ? 'done' : ''}"><i>${s.k !== 'done' && pick[s.k] ? '✓' : i + 1}</i>${s.name}</button>`).join('');
  document.querySelectorAll('#steps button').forEach(b => b.onclick = () => { step = +b.dataset.i; drawSteps(); drawPanel(); });
}
function share() { const h = 'p=' + Object.entries(pick).map(([k, c]) => k + ':' + c.slice(1)).join(',') + (view ? '&v=' + view.slug : ''); try { history.replaceState(null, '', '#' + h); } catch (e) {} return location.href; }
function drawPanel() {
  const s = STEPS[step], P = $('#panel');
  if (s.k === 'done') {
    const rows = STEPS.filter(x => x.sw).map(x => { const c = pick[x.k], nm = c ? (x.sw.find(q => q[1] === c) || [c])[0] : 'As designed'; return `<div><b style="background:${c || 'transparent'}"></b>${x.name}: ${nm}</div>`; }).join('');
    P.innerHTML = `<h3>Good to go</h3><p>Your choices for this office. Share the link, or call and we will render it properly.</p><div id="sum">${rows}</div>
      <p style="margin-top:12px">Designer palettes:</p><div id="pal">${palettes().map(v => `<button data-v="${v.name}">${v.label}</button>`).join('')}</div>
      <div class="row"><button class="btn" id="back">&larr; Back</button><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn w" id="share">Copy link to this design</button><a class="btn p" href="tel:+919004363328" style="text-decoration:none">Call 90043 63328</a><a class="btn" href="./" style="text-decoration:none">Walk the floor</a></span></div>`;
    document.querySelectorAll('#pal button').forEach(b => b.onclick = () => showVariant(b.dataset.v));
    $('#share').onclick = async () => { const u = share(); try { await navigator.clipboard.writeText(u); $('#share').textContent = 'Link copied'; } catch (e) { prompt('Copy this link', u); } };
  } else {
    const has = !!masks[s.k];
    P.innerHTML = `<div id="pal" style="margin:0 0 10px">${palettes().map(v => `<button data-v="${v.name}">${v.label}</button>`).join('')}</div><h3>${step + 1}. ${s.name}</h3><p>${s.hint}${has ? '' : ' (not in this view; pick another room above to see it)'}</p>
      <div class="sw">${s.sw.map(([n, c]) => `<button data-c="${c}" style="background:${c}" class="${pick[s.k] === c ? 'on' : ''}" title="${n}"><span>${n}</span></button>`).join('')}<button data-c="" style="background:conic-gradient(#ddd 0 25%,#999 0 50%,#ddd 0 75%,#999 0)" title="As designed" class="${!pick[s.k] ? 'on' : ''}"><span>As designed</span></button></div>
      <div class="row"><button class="btn" id="back" ${step ? '' : 'disabled style="opacity:.4"'}>&larr; Back</button><button class="btn p" id="next">${step === STEPS.length - 2 ? 'Good to go' : 'Next'} &rarr;</button></div>`;
    document.querySelectorAll('#pal button').forEach(b => b.onclick = () => showVariant(b.dataset.v));
    P.querySelectorAll('.sw button').forEach(b => b.onclick = () => { if (b.dataset.c) pick[s.k] = b.dataset.c; else delete pick[s.k]; $('#vimg').classList.remove('on'); paint(); share(); drawSteps(); drawPanel(); });
    $('#next').onclick = () => { step = Math.min(STEPS.length - 1, step + 1); drawSteps(); drawPanel(); };
  }
  const bk = $('#back'); if (bk) bk.onclick = () => { step = Math.max(0, step - 1); drawSteps(); drawPanel(); };
}
async function showVariant(name) {
  const v = palettes().find(x => x.name === name); if (!v) return;
  Object.keys(pick).forEach(k => delete pick[k]); Object.assign(pick, v.palette); share();
  const el = $('#vimg'); el.classList.remove('on');
  if (v.file) { el.src = CFG + view.slug + '/' + v.file; await el.decode().catch(() => {}); el.classList.add('on'); }      // a full render of this palette, when there is one
  paint(); drawSteps(); drawPanel();
  document.querySelectorAll('#pal button').forEach(b => b.classList.toggle('btn', true));
}
const hold = $('#hold');
const down = () => { paint(false); $('#vimg').style.opacity = 0; }, up = () => { paint(true); $('#vimg').style.opacity = ''; };
hold.addEventListener('pointerdown', down); hold.addEventListener('pointerup', up); hold.addEventListener('pointerleave', up);
start();
