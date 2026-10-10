/* ============================================================================
   ATLAS CMS · runtime (loaded by every Atlas link, and by /admin/)

   1. Tracking. A random visitor id (localStorage) and session id
      (sessionStorage); events view, signin, heartbeat (every 30 s while the
      tab is in front, for at most 4 hours), open, tab and signout go to
      /api/cms/track with sendBeacon. Nothing personal is sent. Visits from
      the Autopilot team are not counted once someone has signed in to
      /admin/ on that browser (localStorage "atlas-team").

   2. Published content. At start-up the link asks /api/cms/config for its
      status and published overrides, waiting at most 1.8 s; it then falls
      back to the last copy it saw, and then to its built-in data. A failure
      here can only ever mean "show the built-in data", never a broken page.

   3. Applying overrides to the link's own data before its app starts:
      field values, hidden properties, extra market updates from brokers,
      new properties, facts and sources, features (tabs, filters, layers,
      presets, toolbar buttons, effects), notice banner, 3D models.
      Every text value has < and > replaced, so nothing published here can
      inject markup into a page that renders data as HTML.

   4. Paused links show a paused screen instead of the data. ?cms-preview=1
      shows the unpublished draft to a signed-in admin, with a ribbon.
   ============================================================================ */
(function () {
  "use strict";
  var API = "/api/cms";

  /* -------------------------------------------------------- adapters --
     How each link keeps its data, and what can be switched off. The admin
     panel reads the same table, so both sides always agree. */
  var F = function (list, group) { return list.map(function (x) { return { key: x[0], label: x[1], group: group }; }); };
  var FEATURES = {
    chennai: [].concat(
      F([["tab:markets", "Micro-markets"], ["tab:connect", "Connectivity"], ["tab:distance", "Distances"], ["tab:talent", "Talent"], ["tab:priorities", "Your priorities"], ["tab:conclusion", "Conclusion"], ["tab:compare", "Compare all"]], "Tabs"),
      F([["filter:best", "Best fit"], ["filter:value", "Value-driven fit"], ["filter:conditional", "Conditional fit"], ["filter:near", "Rail within 1 km"]], "Filters"),
      F([["layer:existing", "Current office"], ["layer:zones", "Micro-markets"], ["layer:rail", "Rail open"], ["layer:future", "Upcoming metro (indicative)"], ["layer:bus", "Bus stops"], ["layer:links", "Distances"], ["layer:studio", "VFX studios"], ["layer:it", "IT parks"], ["layer:edu", "Institutes"], ["layer:res", "Homes"], ["layer:rings", "Drive rings"], ["layer:sat", "Satellite"]], "Map layers"),
      F([["preset:sheet", "Sheet scores only"], ["preset:team", "Keep the team"], ["preset:rail", "Commute by rail"], ["preset:hire", "Hire at scale"], ["preset:cost", "Keep cost down"], ["preset:future", "Built for 2030"]], "Priority presets")),
    indore: [].concat(
      F([["tab:priorities", "Priorities"], ["tab:talent", "Talent & catchment"], ["tab:transit", "Transit"], ["tab:market", "Market & incentives"], ["tab:deck", "Deck map"], ["tab:compare", "Compare all"]], "Tabs"),
      F([["filter:A", "Grade A"], ["filter:B", "Grade B"], ["filter:ready", "Ready now"], ["filter:metro", "Metro within 1 km"], ["filter:sbd", "SBD"], ["filter:pbd", "Super Corridor"]], "Filters"),
      F([["layer:existing", "NRK Star (existing)"], ["layer:zones", "Zones"], ["layer:metro", "Metro"], ["layer:walk", "Walk 0.5/1 km"], ["layer:bus", "iBus"], ["layer:edu", "Institutions"], ["layer:emp", "Employers"], ["layer:res", "Homes"], ["layer:rings", "Drive rings"]], "Map layers"),
      F([["preset:commute", "Commute first"], ["preset:speed", "Move in fast"], ["preset:scale", "Room to scale"], ["preset:talent", "Hire at volume"], ["preset:premium", "Premium & efficient"]], "Priority presets")),
    "digitide-noida": [].concat(
      F([["tab:markets", "Micro-markets"], ["tab:connect", "Connectivity"], ["tab:distance", "Distances"], ["tab:talent", "Talent"], ["tab:conclusion", "Conclusion"], ["tab:compare", "Compare all"]], "Tabs"),
      F([["filter:short", "Autopilot's shortlist"], ["filter:s5758", "Sectors 57-58"], ["filter:s5960", "Sectors 59-60"], ["filter:s62", "Sector 62"], ["filter:s6364", "Sectors 63-64"], ["filter:s67", "Sector 67"], ["filter:near", "Metro within 1 km"]], "Filters"),
      F([["layer:existing", "Current office"], ["layer:sat", "Satellite"], ["layer:zones", "Micro-markets"], ["layer:rail", "Metro"], ["layer:links", "Distances"], ["layer:bpo", "BPO employers"], ["layer:edu", "Institutes"], ["layer:res", "Homes"], ["layer:pg", "PG and co-living"], ["layer:rings", "Distance rings"]], "Map layers")),
    client: [].concat(
      F([["flag:rain", "Rain effect"], ["flag:trees", "Street trees"], ["flag:lamps", "Street lamps"], ["flag:metroLine", "Metro lines drawn on the map"], ["flag:tierColors", "Fit colours on buildings (scored views)"], ["flag:walkthrough", "Walkthrough buttons (scored views)"], ["flag:shortlist", "Shortlist button (scored views)"]], "Map and card"),
      F([["btn:t-cine", "Cinematic"], ["btn:t-theme", "Theme"], ["btn:t-labels", "Labels"], ["btn:t-dist", "Metro distance"], ["btn:t-traffic", "Traffic"], ["btn:t-filters", "Brief filters"], ["btn:t-reset", "Reset view"], ["btn:winnerBtn", "Fly to the winner"]], "Toolbar buttons"))
  };
  /* What a broker can report. A key the link already has (for example
     "condition") updates that field; anything else is shown under
     "Latest from the market" on the property, labelled broker-stated. */
  var BROKER_FIELDS = [
    { key: "askingRent", label: "Asking rent (INR per sq ft per month)", type: "number" },
    { key: "availableArea", label: "Available area (sq ft)", type: "number" },
    { key: "floorsAvailable", label: "Floors available", type: "text" },
    { key: "availability", label: "Available from", type: "text" },
    { key: "condition", label: "Condition (bare shell, warm shell, furnished)", type: "text" },
    { key: "parking", label: "Parking", type: "text" },
    { key: "powerBackup", label: "Power backup", type: "text" },
    { key: "maintenance", label: "Maintenance / CAM (INR per sq ft per month)", type: "number" },
    { key: "lockIn", label: "Lock-in and escalation", type: "text" },
    { key: "marketNote", label: "Anything else the client should know", type: "long" }
  ];
  var ADAPTERS = {
    chennai: { kind: "study", scripts: ["/chennai/data.js"], props: "CHN_OPTIONS", id: "id", name: "name", facts: "CHN_FACTS",
      factGroups: { market: "Office market", talent: "Talent", transit: "Transit" }, additions: true,
      locked: ["id", "n", "micro", "precision"], features: FEATURES.chennai },
    indore: { kind: "study", scripts: ["/indore/data.js"], props: "IND_OPTIONS", id: "id", name: "name", facts: "IND_FACTS",
      factGroups: { metro: "Metro", bus: "Buses", talent: "Talent", market: "Office market", incentives: "Incentives", living: "Living", employers: "Employers" },
      locked: ["id", "n", "micro", "precision", "page", "photo", "handoverKind", "handoverISO"], features: FEATURES.indore },
    "digitide-noida": { kind: "study", scripts: ["/noida/data.js"], props: "NOI_OPTIONS", id: "id", name: "name", facts: "NOI_FACTS",
      factGroups: { market: "Office market", talent: "Talent", transit: "Transit" },
      locked: ["id", "n", "pick", "micro", "precision", "photo", "thumb"], features: FEATURES["digitide-noida"] },
    digitide: { kind: "study", scripts: [], props: null, features: [] },
    godseye: { kind: "tool", scripts: [], props: null, features: [] }
  };
  function adapterFor(slug, kind) {
    if (ADAPTERS[slug]) return ADAPTERS[slug];
    if (kind === "client" || (!kind && slug)) return { kind: "client", client: true,
      scripts: ["/clients/" + slug + "/config.js", "/clients/" + slug + "/data.js", "/clients/" + slug + "/geo.js"],
      props: "BKC.OPTIONS", id: "bldg", name: "name", models3d: true, locked: ["bldg", "rank", "fit", "score", "bar", "hops"], features: FEATURES.client };
    return { kind: kind, scripts: [], props: null, features: [] };
  }
  var humanize = function (k) {
    var b = BROKER_FIELDS.filter(function (f) { return f.key === k; })[0];
    if (b) return b.label.replace(/ \(.*$/, "");
    return String(k).replace(/Src$/, " source").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, function (c) { return c.toUpperCase(); });
  };
  var clean = function (v) { return typeof v === "string" ? v.replace(/</g, "‹").replace(/>/g, "›").replace(/javascript:/gi, "") : v; };
  var num = function (v) { var n = typeof v === "number" ? v : parseFloat(String(v).replace(/[, ]/g, "")); return isFinite(n) ? n : null; };
  var getPath = function (root, path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, root); };
  /* Legacy (scored) client views list a building once per unit, so a unit is
     keyed by building and rank; truth-first views have one row per building. */
  function clientKey(D) {
    var tf = D && D.OPTIONS && D.OPTIONS.some(function (o) { return o.coordSrc !== undefined; });
    return tf ? function (o) { return o.bldg; } : function (o) { return o.bldg + "@" + o.rank; };
  }

  /* ----------------------------------------------------------- state -- */
  var S = { link: null, doc: {}, status: "live", version: 0, preview: false, access: null, started: Date.now(), q: [], timer: null, hb: null };
  var store = {
    get: function (s, k) { try { return s.getItem(k); } catch (e) { return null; } },
    set: function (s, k, v) { try { s.setItem(k, v); } catch (e) {} }
  };
  function rid() {
    var a = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function ids() {
    var v = store.get(localStorage, "atlas-vid"); if (!v) { v = rid(); store.set(localStorage, "atlas-vid", v); }
    var s = store.get(sessionStorage, "atlas-sid"); if (!s) { s = rid(); store.set(sessionStorage, "atlas-sid", s); }
    return { v: v, s: s };
  }
  var noTrack = function () { return store.get(localStorage, "atlas-team") === "1" || /[?&]notrack\b/.test(location.search) || /[?&]cms-preview=1/.test(location.search); };

  /* -------------------------------------------------------- tracking -- */
  function flush() {
    clearTimeout(S.timer); S.timer = null;
    while (S.q.length) {
      var body = JSON.stringify({ events: S.q.splice(0, 25) });
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(API + "/track", new Blob([body], { type: "text/plain" }))) continue;
      } catch (e) {}
      try { fetch(API + "/track", { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }); } catch (e) {}
    }
  }
  function track(e, meta) {
    if (!S.link || noTrack()) return;
    var i = ids();
    var ev = { e: e, link: S.link, v: i.v, s: i.s, p: location.pathname };
    if (S.access) ev.a = S.access;
    if (e === "view" && document.referrer) ev.r = document.referrer;
    if (meta) ev.m = meta;
    S.q.push(ev);
    if (e === "view" || e === "signin" || e === "signout") flush();
    else if (!S.timer) S.timer = setTimeout(flush, 2500);
  }
  function startTracking(link) {
    if (S.link === link && S.hb) return;
    S.link = link; S.started = Date.now();
    track("view");
    clearInterval(S.hb);
    S.hb = setInterval(function () {
      if (document.visibilityState === "visible" && Date.now() - S.started < 4 * 3600000) track("heartbeat");
    }, 30000);
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
  }
  function signin(accessId) {
    if (accessId) { S.access = String(accessId).trim().toUpperCase().slice(0, 40); store.set(sessionStorage, "atlas-access-id", S.access); }
    track("signin");
  }

  /* ---------------------------------------------------------- config -- */
  function fetchTimeout(url, opts, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {})).finally(function () { clearTimeout(t); });
  }
  function load(link) {
    var preview = /[?&]cms-preview=1/.test(location.search);
    var key = "atlas-cms:" + link, cached = null;
    try { cached = JSON.parse(store.get(localStorage, key) || "null"); } catch (e) {}
    var url = API + "/config?link=" + encodeURIComponent(link) + (preview ? "&draft=1" : "");
    var get = function () {
      return fetchTimeout(url, { credentials: "same-origin", cache: preview ? "no-store" : "default" }, 1800).then(function (r) {
        return r.json().then(function (j) {
          if (r.ok && !preview && j && j.doc) store.set(localStorage, key, JSON.stringify({ at: Date.now(), res: j }));
          if (!r.ok && preview) j.previewError = j.error || "Sign in to /admin/ to preview the draft.";
          return j;
        });
      });
    };
    var fallback = function () { return cached ? cached.res : { status: "live", doc: {} }; };
    /* A copy under two minutes old is used straight away and refreshed behind
       the scenes, so a repeat visit never waits on the network. */
    if (!preview && cached && Date.now() - cached.at < 120000) { get().catch(function () {}); return Promise.resolve(cached.res); }
    return get().then(function (j) { return j && j.doc ? j : fallback(); }).catch(fallback);
  }

  /* ------------------------------------------------------------ apply -- */
  function mergeFields(o, fields, prov, locked) {
    var extra = (o.cmsExtra || []).slice();
    Object.keys(fields || {}).forEach(function (k) {
      if (locked && locked.indexOf(k) >= 0) return;
      var v = fields[k], p = prov && prov[k];
      if (Object.prototype.hasOwnProperty.call(o, k)) {
        var cur = o[k];
        if (typeof cur === "number") { var n = num(v); if (n != null) o[k] = n; }
        else if (typeof cur === "boolean") o[k] = v === true || v === "true" || v === "yes";
        else if (Array.isArray(cur)) o[k] = (Array.isArray(v) ? v : String(v).split(",")).map(function (x) { return clean(String(x).trim()); }).filter(Boolean);
        else o[k] = clean(v);
      } else {
        var f = BROKER_FIELDS.filter(function (b) { return b.key === k; })[0];
        var val = typeof v === "number" && f && /INR/.test(f.label) ? "INR " + v.toLocaleString("en-IN") + (/month/.test(f.label) ? " / sq ft / month" : "") : typeof v === "number" && k === "availableArea" ? v.toLocaleString("en-IN") + " sq ft" : String(v);
        extra = extra.filter(function (x) { return x.key !== k; });
        extra.push({ key: k, label: humanize(k), value: clean(val), by: p ? clean(p.by) : null, asOf: p && p.at ? new Date(p.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null });
      }
    });
    if (extra.length) o.cmsExtra = extra;
  }
  function applyProperties(arr, A, doc, keyOf) {
    var P = doc.properties || {};
    keyOf = keyOf || function (o) { return o[A.id]; };
    for (var i = arr.length - 1; i >= 0; i--) { var h = P[keyOf(arr[i])]; if (h && h.hidden) arr.splice(i, 1); }
    arr.forEach(function (o) {
      var p = P[keyOf(o)];
      if (!p) return;
      if (p.fields) mergeFields(o, p.fields, p.provenance, A.locked);
      if (p.lists) applyLists(o, p.lists);
    });
  }
  /* Lists of sourced facts on a property (label, value, source link), for
     example the Developer, Size and Status rows on a Chennai card. */
  var URLOK = /^https?:\/\/[^\s"'<>]+$/;
  function applyLists(o, lists) {
    Object.keys(lists).forEach(function (k) {
      if (!Array.isArray(o[k]) || !Array.isArray(lists[k])) return;
      o[k] = lists[k].filter(function (f) { return f && f.k && f.v; }).map(function (f) {
        var x = { k: clean(String(f.k)), v: clean(String(f.v)) };
        if (URLOK.test(f.src || "")) x.src = f.src;
        return x;
      });
    });
  }
  function nearestZone(a) {
    var Z = window.CHN_ZONES || [], best = null, bd = 1e9;
    Z.forEach(function (z) {
      var c = z.shape.type === "band" ? [(z.shape.from[0] + z.shape.to[0]) / 2, (z.shape.from[1] + z.shape.to[1]) / 2] : z.shape.c;
      var d = Math.pow(c[0] - a.lng, 2) + Math.pow(c[1] - a.lat, 2);
      if (d < bd) { bd = d; best = z; }
    });
    return best;
  }
  /* New properties approved from broker links. Only links whose app can draw
     a property from a name and a position take them (Chennai today); for the
     rest an approved proposal stays a lead in the admin panel. */
  function addChennai(arr, a) {
    var lat = num(a.lat), lng = num(a.lng);
    if (!a.name || lat == null || lng == null) return;
    var Z = window.CHN_ZONES || [];
    var zone = Z.filter(function (z) { return z.key === a.micro; })[0] || nearestZone({ lat: lat, lng: lng });
    if (!zone) return;
    var prov = a._provenance || {};
    var o = { id: "cms-" + String(a.id || a.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36), n: arr.reduce(function (m, x) { return Math.max(m, x.n || 0); }, 0) + 1,
      name: clean(a.name), sheetName: clean(a.name), micro: zone.key, sheetMicro: clean(a.sheetMicro || zone.label), address: clean(a.address || ""),
      lat: lat, lng: lng, precision: ["building", "street", "locality"].indexOf(a.precision) >= 0 ? a.precision : "street",
      geoNote: "Added to the study from broker information" + (prov.by ? " (" + clean(prov.by) + ")" : "") + ". Position as supplied; confirm on a site visit.",
      geoSrc: /^https:\/\//.test(a.geoSrc || "") ? a.geoSrc : "", facts: [] };
    if (arr.some(function (x) { return x.id === o.id; })) return;
    var rest = {}; Object.keys(a).forEach(function (k) { if (!(k in o) && k !== "id" && k !== "micro" && k.charAt(0) !== "_") rest[k] = a[k]; });
    var pv = {}; Object.keys(rest).forEach(function (k) { pv[k] = prov; });
    mergeFields(o, rest, pv, []);
    arr.push(o);
  }
  function applyFacts(A, doc) {
    var root = A.facts && window[A.facts];
    if (!root || !doc.facts) return;
    Object.keys(doc.facts).forEach(function (g) {
      var list = doc.facts[g];
      if (!Array.isArray(list) || !(g in root)) return;
      root[g] = list.filter(function (f) { return f && f.k && f.v; }).map(function (f) {
        return { k: clean(f.k), v: clean(f.v), asOf: clean(f.asOf || ""), conf: ["high", "medium", "low"].indexOf(f.conf) >= 0 ? f.conf : "medium",
          src: URLOK.test(f.src || "") ? f.src : "", note: f.note ? clean(f.note) : undefined };
      });
    });
  }
  function applyStudy(link, doc) {
    var A = adapterFor(link, "study");
    var arr = A.props && getPath(window, A.props);
    if (Array.isArray(arr)) {
      applyProperties(arr, A, doc);
      if (A.additions && Array.isArray(doc.additions) && link === "chennai") doc.additions.forEach(function (a) { addChennai(arr, a); });
    }
    applyFacts(A, doc);
  }
  var MODES = ["extrusion", "custom-model", "gltf-model"];
  function cleanModel(m) {
    var out = {};
    if (MODES.indexOf(m.renderMode) >= 0) out.renderMode = m.renderMode;
    if (m.modelUrl && /^(https:\/\/|\/|\.\/)[^\s"'<>]+$/.test(m.modelUrl)) out.modelUrl = m.modelUrl;
    ["heightMeters"].forEach(function (k) { var n = num(m[k]); if (n != null && n > 0) out[k] = n; });
    if (m.footprintName) out.footprintName = clean(m.footprintName);
    if (/^#[0-9a-f]{6}$/i.test(m.color || "")) out.color = m.color;
    if (m.transform) {
      var t = {}; ["rotationDegrees", "uniformScale", "offsetX", "offsetZ"].forEach(function (k) { var n = num(m.transform[k]); if (n != null) t[k] = n; });
      if (Object.keys(t).length) out.transform = t;
    }
    return out;
  }
  function applyClient(slug, doc) {
    var C = window.CLIENT = window.CLIENT || {}, D = window.BKC, f = doc.features || {};
    var A = adapterFor(slug, "client");
    var has = function (k) { return Object.prototype.hasOwnProperty.call(f, k); };
    ["rain", "metroLine", "tierColors", "walkthrough", "shortlist"].forEach(function (k) { if (has("flag:" + k)) C[k] = !!f["flag:" + k]; });
    if (has("flag:trees") || has("flag:lamps")) {
      var curT = C.props !== false && !(C.props && C.props.trees === false), curL = C.props !== false && !(C.props && C.props.lamps === false);
      var t = has("flag:trees") ? !!f["flag:trees"] : curT, l = has("flag:lamps") ? !!f["flag:lamps"] : curL;
      C.props = !t && !l ? false : { trees: t, lamps: l };
    }
    if (Array.isArray(C.poiLayers)) C.poiLayers = C.poiLayers.filter(function (p) { return f["poi:" + p.key] !== false; });
    var hide = Object.keys(f).filter(function (k) { return k.indexOf("btn:") === 0 && f[k] === false; }).map(function (k) { return "#" + k.slice(4).replace(/[^A-Za-z0-9_-]/g, ""); });
    if (hide.length) { var st = document.createElement("style"); st.textContent = hide.join(",") + "{display:none!important}"; document.head.appendChild(st); }
    var T = doc.texts || {};
    if (T.winnerBtnText) C.winnerBtnText = clean(T.winnerBtnText);
    if (T.hint) C.hint = clean(T.hint);
    if (T.competitorLabel) C.competitorLabel = clean(T.competitorLabel);
    if (T.competitorRadius) C.competitorRadius = clean(T.competitorRadius);
    if (T["lb.title"] || T["lb.why"]) C.lb = Object.assign({}, C.lb || {}, T["lb.title"] ? { title: clean(T["lb.title"]) } : {}, T["lb.why"] ? { why: clean(T["lb.why"]) } : {});
    if (T["brand.sub"]) C.brand = Object.assign({}, C.brand || {}, { sub: clean(T["brand.sub"]) });
    if (doc.models3d) {
      C.registryPatch = {};
      Object.keys(doc.models3d).forEach(function (id) { var m = cleanModel(doc.models3d[id] || {}); if (Object.keys(m).length) C.registryPatch[id] = m; });
    }
    if (D && Array.isArray(D.OPTIONS)) {
      var keyOf = clientKey(D);
      applyProperties(D.OPTIONS, A, doc, keyOf);
      var P = doc.properties || {};
      (D.BUILDINGS || []).forEach(function (b) {
        var bp = P[b.id] && P[b.id].building;
        if (bp) {
          if (bp.name) b.name = clean(bp.name);
          var la = num(bp.lat), lo = num(bp.lng);
          if (la != null && lo != null) { b.lat = la; b.lng = lo; }
        }
        if (b.isOption && !D.OPTIONS.some(function (o) { return o.bldg === b.id; })) b.isOption = false;
      });
      if (D.META && D.META.winner && !D.OPTIONS.some(function (o) { return o.bldg === D.META.winner; })) D.META.winner = null;
    }
  }

  /* ----------------------------------------------------------- chrome -- */
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function pausedScreen() {
    var n = el('<div id="cms-paused" role="dialog" aria-label="Paused" style="position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#1f1610;color:#f7f2ea;font:15px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:24px;text-align:center">'
      + '<div style="max-width:440px"><img src="/autopilot-logo-trimmed.png" alt="Autopilot" style="width:150px;filter:invert(1) brightness(1.4);margin-bottom:22px">'
      + '<div style="font:500 28px/1.2 Georgia,serif;margin-bottom:10px">This study is paused</div>'
      + '<div style="color:rgba(247,242,234,.75)">It is being updated and will be back shortly. For anything urgent, please contact your Autopilot team.</div></div></div>');
    (document.body || document.documentElement).appendChild(n);
  }
  function ribbon(text, tone) {
    var n = el('<div id="cms-ribbon" style="position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147482000;background:' + (tone === "warn" ? "#b23b2a" : "#2a1e16") + ';color:#f7f2ea;font:600 12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:8px 14px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25)">' + esc(text) + ' · <a href="' + esc(location.pathname) + '" style="color:#f2c9a8">Exit preview</a></div>');
    document.body.appendChild(n);
  }
  function banner(link, b) {
    if (!b || !b.text) return;
    var k = "atlas-banner-x:" + link + ":" + String(b.text).length + String(b.text).slice(0, 24);
    if (store.get(sessionStorage, k)) return;
    var warn = b.tone === "warn";
    var n = el('<div id="cms-banner" role="status" style="position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:150;max-width:min(640px,calc(100% - 24px));display:flex;gap:12px;align-items:flex-start;background:' + (warn ? "#fff4e5" : "#faf6f0") + ';color:#2a1e16;border:1px solid ' + (warn ? "rgba(183,121,31,.45)" : "rgba(60,40,25,.15)") + ';border-left:4px solid ' + (warn ? "#b7791f" : "#a3502c") + ';border-radius:10px;padding:10px 12px;box-shadow:0 12px 32px rgba(42,30,22,.16);font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">'
      + '<div style="flex:1">' + esc(b.text) + "</div>"
      + '<button type="button" aria-label="Dismiss" style="border:0;background:transparent;font-size:18px;line-height:1;cursor:pointer;color:#6c5b4d;padding:0 2px">×</button></div>');
    n.querySelector("button").onclick = function () { store.set(sessionStorage, k, "1"); n.remove(); };
    document.body.appendChild(n);
  }
  function chrome(link, res) {
    var doc = res.doc || {};
    if (res.draft) ribbon("Draft preview, not live");
    else if (res.previewError) ribbon(res.previewError, "warn");
    banner(link, doc.banner);
  }
  function loadScript(src) {
    return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.body.appendChild(s); });
  }

  /* --------------------------------------------------------- entry points */
  /* Standalone studies and tools: track, apply, then start the app. */
  function boot(link, opts) {
    opts = opts || {};
    startTracking(link);
    var saved = store.get(sessionStorage, "atlas-access-id"); if (saved) S.access = saved;
    return load(link).then(function (res) {
      S.doc = res.doc || {}; S.status = res.status; S.version = res.version || 0; S.preview = !!res.draft;
      if (res.status === "paused" && !res.draft) { pausedScreen(); return false; }
      try { applyStudy(link, S.doc); } catch (e) { console.warn("[atlas-cms] apply", e); }
      var go = function () { chrome(link, res); return opts.app ? loadScript(opts.app).then(function () { return true; }) : true; };
      return document.body ? go() : new Promise(function (ok) { document.addEventListener("DOMContentLoaded", function () { ok(go()); }); });
    });
  }
  /* Client views on the root map: called after the client's scripts load and
     before mapbox_app.js. Resolves false when the link is paused. */
  function prepareClient(slug, accessId, isNewSignin) {
    startTracking(slug);
    if (accessId) { if (isNewSignin) signin(accessId); else S.access = String(accessId).toUpperCase(); }
    return load(slug).then(function (res) {
      S.doc = res.doc || {}; S.status = res.status; S.version = res.version || 0; S.preview = !!res.draft;
      if (res.status === "paused" && !res.draft) { pausedScreen(); return false; }
      try { applyClient(slug, S.doc); } catch (e) { console.warn("[atlas-cms] apply", e); }
      chrome(slug, res);
      return true;
    });
  }
  function on(key) { var f = S.doc.features || {}; return f[key] !== false; }

  window.AtlasCMS = {
    boot: boot, prepareClient: prepareClient, on: on,
    signin: signin,
    signout: function () { track("signout"); flush(); },
    open: function (item, label) { track("open", label ? { item: String(item).slice(0, 80), label: String(label).slice(0, 80) } : { item: String(item).slice(0, 80) }); },
    tab: function (tab) { track("tab", { tab: String(tab).slice(0, 40) }); },
    /* shared with /admin/ and /broker/ */
    ADAPTERS: ADAPTERS, FEATURES: FEATURES, BROKER_FIELDS: BROKER_FIELDS, adapterFor: adapterFor, humanize: humanize,
    clientKey: clientKey, getPath: getPath,
    _apply: { study: applyStudy, client: applyClient }
  };
})();
