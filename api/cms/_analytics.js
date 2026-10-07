/* ============================================================================
   ATLAS CMS · analytics

   Turns raw events (view, signin, heartbeat, open, tab, signout) into the
   numbers on the admin dashboard. Plain JavaScript over the event rows, so
   the same code runs against Supabase and the local store and can be tested.

   Definitions, shown on the dashboard as well:
     visitor    one browser (a random id kept in localStorage)
     session    one visit in one tab (a random id kept in sessionStorage)
     signed in  a session that passed the link's sign-in
     time       last event minus first event in a session; the page sends a
                heartbeat every 30 s while it is in front, so this is time
                actually spent, not time a tab sat open in the background
     active     any event in the last 5 minutes
   Days are counted in India time (UTC+5:30).
   ============================================================================ */
"use strict";

const IST_MIN = 330;
const dayOf = (iso) => new Date(Date.parse(iso) + IST_MIN * 60000).toISOString().slice(0, 10);
const top = (map, n = 8) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, n: v }));
const bump = (map, k, by = 1) => { if (k) map.set(k, (map.get(k) || 0) + by); };

function summarise(events, { from, to, days, linkNames = {} }) {
  const nowMs = Date.parse(to);
  const liveCut = nowMs - 5 * 60000;
  const sessions = new Map();     // session id -> summary
  const visitors = new Map();     // visitor id -> { first, last, links:Set }
  const perLink = new Map();
  const perId = new Map();
  const daily = new Map();
  const countries = new Map(), cities = new Map(), devices = new Map(), refs = new Map();
  const opens = new Map(), tabs = new Map(), labels = new Map();
  const live = new Map();         // link -> Set(visitor)
  let views = 0, signins = 0, openCount = 0;

  const L = (slug) => {
    if (!perLink.has(slug)) perLink.set(slug, { slug, name: linkNames[slug] || slug, views: 0, visitors: new Set(), sessions: new Set(), signins: 0, signedSessions: new Set(), secs: 0, lastSeen: null, live: new Set(), opens: 0 });
    return perLink.get(slug);
  };
  const D = (d) => { if (!daily.has(d)) daily.set(d, { day: d, views: 0, visitors: new Set(), signins: 0 }); return daily.get(d); };

  for (const ev of events) {
    const t = Date.parse(ev.ts);
    const l = L(ev.link_slug), d = D(dayOf(ev.ts));
    l.visitors.add(ev.visitor_id); l.sessions.add(ev.session_id);
    if (!l.lastSeen || ev.ts > l.lastSeen) l.lastSeen = ev.ts;
    d.visitors.add(ev.visitor_id);
    let s = sessions.get(ev.session_id);
    if (!s) {
      s = { id: ev.session_id, link: ev.link_slug, visitor: ev.visitor_id, start: ev.ts, end: ev.ts, events: 0, opens: [], tabs: [], signedIn: false, accessId: null, country: null, city: null, device: null, ref: null };
      sessions.set(ev.session_id, s);
    }
    s.events++;
    if (ev.ts < s.start) s.start = ev.ts;
    if (ev.ts > s.end) s.end = ev.ts;
    s.country = s.country || ev.country; s.city = s.city || ev.city; s.device = s.device || ev.device; s.ref = s.ref || ev.ref_host;
    if (ev.access_id) s.accessId = ev.access_id;
    let v = visitors.get(ev.visitor_id);
    if (!v) { v = { first: ev.ts, last: ev.ts, days: new Set() }; visitors.set(ev.visitor_id, v); }
    if (ev.ts < v.first) v.first = ev.ts;
    if (ev.ts > v.last) v.last = ev.ts;
    v.days.add(dayOf(ev.ts));
    if (t >= liveCut) { l.live.add(ev.visitor_id); if (!live.has(ev.link_slug)) live.set(ev.link_slug, new Set()); live.get(ev.link_slug).add(ev.visitor_id); }

    if (ev.event === "view") { views++; l.views++; d.views++; }
    if (ev.event === "signin") {
      signins++; l.signins++; d.signins++; s.signedIn = true; l.signedSessions.add(ev.session_id);
      const id = ev.access_id || "(not recorded)";
      if (!perId.has(id)) perId.set(id, { id, signins: 0, sessions: new Set(), visitors: new Set(), lastSeen: null, links: new Set() });
      const p = perId.get(id);
      p.signins++; p.sessions.add(ev.session_id); p.visitors.add(ev.visitor_id); p.links.add(ev.link_slug);
      if (!p.lastSeen || ev.ts > p.lastSeen) p.lastSeen = ev.ts;
    }
    const m = ev.meta || {};
    if (ev.event === "open" && m.item) {
      openCount++; l.opens++; bump(opens, `${ev.link_slug}\u0000${m.item}`);
      if (m.label) labels.set(`${ev.link_slug}\u0000${m.item}`, m.label);
      s.opens.push(m.label || m.item);
    }
    if (ev.event === "tab" && m.tab) { bump(tabs, `${ev.link_slug}\u0000${m.tab}`); s.tabs.push(m.tab); }
  }

  /* per-session facts: duration, country, device, referrer */
  let secsTotal = 0, timed = 0;
  for (const s of sessions.values()) {
    s.secs = Math.max(0, Math.round((Date.parse(s.end) - Date.parse(s.start)) / 1000));
    if (s.secs > 0) { secsTotal += s.secs; timed++; }
    const l = perLink.get(s.link); if (l) l.secs += s.secs;
    bump(countries, s.country); bump(cities, s.city); bump(devices, s.device); bump(refs, s.ref);
  }

  /* daily series with zero days filled in */
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayOf(new Date(nowMs - i * 86400000).toISOString());
    const x = daily.get(d);
    series.push({ day: d, views: x ? x.views : 0, visitors: x ? x.visitors.size : 0, signins: x ? x.signins : 0 });
  }

  const returning = [...visitors.values()].filter(v => v.days.size > 1).length;
  const links = [...perLink.values()].map(l => ({
    slug: l.slug, name: l.name, views: l.views, visitors: l.visitors.size, sessions: l.sessions.size,
    signins: l.signins, signedSessions: l.signedSessions.size, opens: l.opens,
    avgSessionSec: l.sessions.size ? Math.round(l.secs / l.sessions.size) : 0,
    lastSeen: l.lastSeen, activeNow: l.live.size
  })).sort((a, b) => b.visitors - a.visitors || b.views - a.views);
  const accessIds = [...perId.values()].map(p => ({ id: p.id, signins: p.signins, sessions: p.sessions.size, visitors: p.visitors.size, lastSeen: p.lastSeen, links: [...p.links] }))
    .sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || ""));
  const split = (map, a, b) => top(map, 12).map(({ k, n }) => { const [x, y] = k.split("\u0000"); return { link: x, [a]: y, n, name: linkNames[x] || x, label: labels.get(k) || null }; });
  const recent = [...sessions.values()].sort((a, b) => b.end.localeCompare(a.end)).slice(0, 60).map(s => ({
    id: s.id, link: s.link, name: linkNames[s.link] || s.link, start: s.start, end: s.end, secs: s.secs, events: s.events,
    signedIn: s.signedIn, accessId: s.accessId, country: s.country, city: s.city, device: s.device, ref: s.ref,
    opens: [...new Set(s.opens)].slice(0, 8), tabs: [...new Set(s.tabs)].slice(0, 8), live: Date.parse(s.end) >= liveCut
  }));

  return {
    range: { from, to, days },
    totals: {
      views, visitors: visitors.size, sessions: sessions.size, signins,
      signedSessions: [...sessions.values()].filter(s => s.signedIn).length,
      avgSessionSec: timed ? Math.round(secsTotal / timed) : 0,
      activeNow: new Set([...live.values()].flatMap(s => [...s])).size,
      returning, opens: openCount
    },
    daily: series, links, accessIds,
    countries: top(countries), cities: top(cities), devices: top(devices), referrers: top(refs),
    opens: split(opens, "item"), tabs: split(tabs, "tab"),
    live: [...live.entries()].map(([slug, set]) => ({ slug, name: linkNames[slug] || slug, visitors: set.size })),
    sessions: recent
  };
}

module.exports = { summarise, dayOf };
