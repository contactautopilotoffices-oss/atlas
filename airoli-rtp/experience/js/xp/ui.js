// The page's words: the label stack (place, display, data, source chip), the clock, the floor counter, captions,
// labels pinned to real places, and the location panel. Every figure shown carries its source.
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ timed text (from shots.json beats)
// Only lines whose status is ok or estimate are shown; [VERIFY] lines stay off screen.
export function timedText(shots, { verifiedBeats = new Set(), caps = null } = {}) {
  const items = [];
  for (const b of shots.beats) for (const t of b.text || []) {
    if (t.t0 === null || t.t0 === undefined) continue;
    // place-label positions are not shown as stack text (the labels pin to the OSM positions themselves)
    if (/VERIFY label position/i.test(t.status || '')) continue;
    if (!/^(ok|estimate)/i.test(t.status || '') && !(verifiedBeats.has(b.id) && /^VERIFY$/i.test(t.status || ''))) continue;
    if (/floor counter/i.test(t.content) || /^EXPLORE YOUR FLOORS|^Replay/i.test(t.content)) continue;
    items.push({ ...t, beat: b.id, t1: t.t1 ?? b.t1 });
  }
  if (caps && caps.length) return { items, caps: caps.map(c => ({ ...c, t1: c.t1 + .35 })) };
  caps = [];
  for (const b of shots.beats) {
    const vo = (b.vo || []).filter(v => /^ok/i.test(v.status || '') || (verifiedBeats.has(b.id) && /^VERIFY$/i.test(v.status || '')));
    // b07 has three alternative lines; the default (line C) is the only one cleared to play
    const pick = b.id === 'b07_amenities' ? vo.filter(v => /default/i.test(v.status)) : vo;
    for (const v of pick) caps.push({ t0: v.t0, t1: v.t1 + .4, line: v.line, beat: b.id });
  }
  return { items, caps };
}

const slots = { place: null, display: null, data: null, chip: null, clock: null };
export function initHud() { for (const k of Object.keys(slots)) slots[k] = $('#s-' + k); }
const fadeVal = (t, t0, t1, fin = .9, fout = .6) => Math.max(0, Math.min(1, (t - t0) / fin, (t1 - t) / fout));
export function updateTimedText(T, t, { hourLabel } = {}) {
  const want = { place: null, display: null, data: null, chip: null, clock: null };
  for (const it of T.items) { if (t < it.t0 - .01 || t > it.t1) continue;
    const slot = it.style === 'display' ? 'display' : it.style === 'data_line' ? 'data' : it.style === 'source_chip' ? 'chip' : it.style === 'clock' ? 'clock' : 'place';
    want[slot] = { text: it.content, a: fadeVal(t, it.t0, it.t1) }; }
  if (want.clock && hourLabel) want.clock.text = want.clock.text.replace(/^\d\d:\d\d/, hourLabel);
  for (const [k, el] of Object.entries(slots)) { if (!el) continue; const w = want[k];
    if (w) { if (el.textContent !== w.text) el.textContent = w.text; el.style.opacity = w.a.toFixed(3); el.style.transform = `translateY(${(1 - Math.min(1, w.a)) * 8}px)`; }
    else el.style.opacity = '0'; }
  const cap = T.caps.find(c => t >= c.t0 && t <= c.t1), ce = $('#caption');
  if (ce) { if (cap) { if (ce.textContent !== cap.line) ce.textContent = cap.line; ce.style.opacity = fadeVal(t, cap.t0, cap.t1, .35, .35).toFixed(3); } else ce.style.opacity = '0'; }
}

// ------------------------------------------------------------------ labels pinned to real places
const v = new THREE.Vector3();
export function createLabels(container) {
  const list = [];
  return {
    add(id, text, world, { kind = 'place', sub = '', lift = 0 } = {}) {
      const el = document.createElement('div'); el.className = 'pin pin-' + kind; el.dataset.id = id;
      el.innerHTML = `<span class="pin-t">${esc(text)}</span>${sub ? `<span class="pin-s">${esc(sub)}</span>` : ''}<i class="pin-stem"></i><i class="pin-dot"></i>`;
      container.appendChild(el); const o = { id, el, world: world.clone(), a: 0, want: 0, lift, kind }; list.push(o); return o;
    },
    get(id) { return list.find(o => o.id === id); },
    set(id, want) { const o = list.find(x => x.id === id); if (o) o.want = want; },
    setKind(kind, want) { for (const o of list) if (o.kind === kind) o.want = want; },
    update(camera, w, h, dt) {
      for (const o of list) {
        o.a += (o.want - o.a) * Math.min(1, dt * 3.2);
        if (o.a < .01) { if (o.el.style.display !== 'none') o.el.style.display = 'none'; continue; }
        v.copy(o.world); v.project(camera);
        if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.15) { o.el.style.display = 'none'; continue; }
        o.el.style.display = 'block';
        const x = (v.x * .5 + .5) * w, y = (-v.y * .5 + .5) * h;
        o.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; o.el.style.opacity = o.a.toFixed(3);
      }
    },
    hideAll() { for (const o of list) { o.want = 0; o.a = 0; o.el.style.display = 'none'; } },
  };
}

// ------------------------------------------------------------------ the location panel (location.json only)
export function fillPanel(loc) {
  const why = $('#why-list'), com = $('#commute');
  if (why) why.innerHTML = (loc.headlines || []).map(h => `<li><p>${esc(h.text)}</p><span class="src">${esc(shortSource(h.source))}</span></li>`).join('');
  if (com) {
    const c = loc.catchment_summary || {};
    const rowsBand = (band) => (loc.catchment || []).filter(r => r.band === band).map(r => `<li><b>${esc(r.hub)}</b><span>${r.station_to_gate_min} min</span></li>`).join('');
    const change = (loc.catchment || []).filter(r => !r.band).map(r => esc(r.hub)).join(', ');
    com.innerHTML = `
      <h4>Board, ride, walk to the gate</h4>
      <div class="band"><h5>Within 30 minutes</h5><ul>${rowsBand('30')}</ul></div>
      <div class="band"><h5>Within 45 minutes</h5><ul>${rowsBand('45')}</ul></div>
      <p class="rule">${esc(c.rule || '')}</p>
      ${change ? `<p class="rule">With a change at Thane (change time not known, so no band): ${change}.</p>` : ''}
      ${loc.metro_status && loc.metro_status.say_this ? `<p class="rule metro">${esc(loc.metro_status.say_this)}</p>` : ''}
      <span class="src">${esc(shortSource((loc.catchment || [])[0] && loc.catchment[0].source))}</span>`;
  }
}
export function shortSource(s) {
  if (!s) return '';
  if (/Google Maps/i.test(s)) return 'Google Maps walking route · 19 Nov 2026';
  if (/erail/i.test(s)) return 'erail.in suburban timetable · Thu 19 Nov 2026';
  if (/OSRM car/i.test(s)) return 'OSRM routing on OpenStreetMap · free-flow, off-peak · 19 Nov 2026';
  if (/OSRM foot/i.test(s)) return 'OSRM foot routing on OpenStreetMap · 19 Nov 2026';
  if (/OpenStreetMap/i.test(s)) return '© OpenStreetMap contributors · fetched 19 Nov 2026';
  return s.length > 90 ? s.slice(0, 88) + '…' : s;
}
