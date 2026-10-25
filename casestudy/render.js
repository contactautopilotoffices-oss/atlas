/* ============================================================================
   ATLAS · case study renderer

   Turns a case bundle (casestudy/SCHEMA.md) into pages. Every page is a
   function of the bundle; every money figure comes from costing.js; every
   chart is inline SVG drawn from the Series sheet. Sections the bundle
   does not have are not drawn, and the contents page numbers itself from
   what is.

   The page order, when everything is present, follows the Andheri
   Business Case Study 2026:

     cover · contents and "read this first"
     01 the options: terms, costing, earns, a seat, occupancy, levers
     02 the assets: opener, side by side, getting there
     03 market: opener, one page per market point, catchment, pools
     04 infrastructure · 05 why here · 06 plan (pipeline 1, pipelines 2+)
     07 risks · 08 rivals: opener, next door, corridor, openings,
        occupancy, ladder · 09 the decision · back
   ============================================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./costing"));
  else root.CaseRender = factory(root.Costing);
})(typeof self !== "undefined" ? self : this, function (Costing) {
  "use strict";
  var inr = Costing.inr, pc = Costing.pc;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var nl = function (s) { return esc(s).replace(/\n/g, "<br>"); };
  var fmt = function (n) { return Math.round(n).toLocaleString("en-IN"); };
  var L = function (n) { return inr(n, { unit: "L" }); }, Cr = function (n) { return inr(n, { unit: "Cr", dp: 2 }); }, R = function (n) { return inr(n, { plain: true }); };
  var SECTION_TITLES = { options: "The two options", assets: "The assets", market: "Market research and analysis", infrastructure: "Key infrastructure", why: "Why it works", plan: "Speculative commercialisation plan", risks: "Top risks", rivals: "Competitive landscape", decision: "The decision on one page" };
  var SECTION_SUBS = { options: "the terms, the costing, what each floor earns, how full it must be", assets: "the buildings, what stage they are at, how people get there", market: "rents, landlord power, deals, flex demand and the occupier pool", infrastructure: "metro, airports and the roads that matter", why: "the reasons, in one page", plan: "the pipelines and the ad budget", risks: "occupancy, price and the buildings themselves", rivals: "who they are, what they charge, how full they are", decision: "the buildings scored, and our read" };
  var COLORS = ["#a3502c", "#3b5a7a", "#2e7d5b", "#b7791f", "#5b3aa7", "#4a4a4a"];

  /* ------------------------------------------------------------ helpers -- */
  function copy(b, key, role) { return ((b.copy || {})[key] || []).filter(function (c) { return !role || (c.role || "means") === role; }).map(function (c) { return c.text; }); }
  function means(b, key, extra) {
    var lines = copy(b, key, "means").concat(extra || []);
    if (!lines.length) return "";
    return '<div class="means"><b>What it means for us</b>' + lines.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>";
  }
  function src(b, key) { return ((b.sources || {})[key] || []).join(" "); }
  function kpi(v, l, s) { return '<div class="kpi"><div class="v">' + esc(v) + '</div><div class="l">' + esc(l) + "</div>" + (s ? '<div class="s">' + esc(s) + "</div>" : "") + "</div>"; }
  function img(b, slot, cls) {
    var im = (b.images || {})[slot] || {};
    var style = im.url ? ' style="background-image:url(' + esc(im.url) + ')"' : "";
    return '<div class="img ' + (cls || "") + '"' + style + '><span class="cap">' + esc(im.caption || "AI-generated illustration") + "</span></div>";
  }
  function walk(m, a) { return Math.max(1, Math.round(m / (Costing.num(a && a.walkMPerMin, 80)))); }
  function median(xs) { var s = xs.slice().sort(function (p, q) { return p - q; }); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; }
  function byOpt(c, id) { for (var i = 0; i < c.options.length; i++) if (c.options[i].id === id) return c.options[i]; return c.options[0]; }

  /* Codes a KPI or a decision row may carry instead of a figure. */
  function code(b, c, v, optId) {
    var o = optId ? byOpt(c, optId) : c.options[0];
    var rivals = b.rivals || [], prices = rivals.map(function (r) { return r.price; }).filter(isFinite);
    switch (String(v)) {
      case "price": return o ? R(o.price) : "";
      case "priceLow": return R(c.priceLow); case "priceHigh": return R(c.priceHigh);
      case "breakEven": return pc(c.breakEven);
      case "seats": return c.options.map(function (x) { return fmt(x.seats); }).join(" · ");
      case "carpet": return o ? fmt(o.inputs.carpet) + " sq ft" : "";
      case "cost": return o ? L(o.total) : ""; case "commitment": return o ? Cr(o.commitment) : "";
      case "rivals": return String(rivals.length);
      case "rivalsMedian": return R(median(prices));
      case "rivalsRange": return prices.length ? inr(Math.min.apply(null, prices), { plain: true }).replace(/,000$/, "K") + " to " + inr(Math.max.apply(null, prices), { plain: true }).replace(/,000$/, "K") : "";
      case "brokerage": return pc(o ? o.inputs.brokeragePct : 0.1);
      case "ads": return L(Costing.num((b.assumptions || {}).adsFloorPerMonth, (b.assumptions || {}).adsPerMonth || 0));
      default: return String(v);
    }
  }

  /* --------------------------------------------------------------- SVG -- */
  function svg(w, h, inner) { return '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" preserveAspectRatio="xMidYMid meet">' + inner + "</svg>"; }
  function lineChart(pts, opts) {
    opts = opts || {};
    var w = opts.w || 300, h = opts.h || 130, pl = 36, pr = 10, pt = 16, pb = 22;
    var vals = pts.map(function (p) { return p.value; });
    var lo = opts.min != null ? opts.min : Math.min.apply(null, vals), hi = opts.max != null ? opts.max : Math.max.apply(null, vals);
    if (hi === lo) hi = lo + 1;
    var pad = (hi - lo) * 0.15; lo = opts.min != null ? lo : lo - pad; hi += pad;
    /* the end points sit inset, so their value labels clear the y-axis labels */
    var inset = 16, X = function (i) { return pl + (pts.length === 1 ? (w - pl - pr) / 2 : inset + i * (w - pl - pr - 2 * inset) / (pts.length - 1)); };
    var Y = function (v) { return pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo)); };
    var out = "", g = 4;
    for (var i = 0; i <= g; i++) { var yv = lo + (hi - lo) * i / g; out += '<line class="grid" x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(yv) + '" y2="' + Y(yv) + '"/><text class="ax" x="' + (pl - 4) + '" y="' + (Y(yv) + 2.5) + '" text-anchor="end">' + (opts.fmt || String)(yv) + "</text>"; }
    out += '<polyline fill="none" stroke="' + (opts.color || COLORS[0]) + '" stroke-width="2" points="' + pts.map(function (p, i) { return X(i) + "," + Y(p.value); }).join(" ") + '"/>';
    pts.forEach(function (p, i) {
      out += '<circle cx="' + X(i) + '" cy="' + Y(p.value) + '" r="3" fill="' + (opts.color || COLORS[0]) + '"/>';
      out += '<text class="val" x="' + X(i) + '" y="' + (Y(p.value) - 6) + '" text-anchor="middle">' + esc((opts.fmt || String)(p.value)) + "</text>";
      out += '<text class="ax" x="' + X(i) + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(p.label) + "</text>";
    });
    return svg(w, h, out);
  }
  function barChart(pts, opts) {
    opts = opts || {};
    var w = opts.w || 300, h = opts.h || 130, pl = 8, pr = 8, pt = 18, pb = 22;
    var vals = pts.map(function (p) { return Math.max(p.value, p.value2 || 0); });
    var ranged = pts.some(function (p) { return p.value2 != null; });
    var hi = opts.max || Math.max.apply(null, vals) * 1.15, lo = opts.min || 0;
    /* Ranges float: start the scale just under the lowest range, or every bar is a sliver at the top. */
    if (ranged && opts.min == null) {
      var lowest = Math.min.apply(null, pts.map(function (p) { return p.value; })), top = Math.max.apply(null, vals), spread = Math.max(1e-9, top - lowest), step = Math.pow(10, Math.floor(Math.log10(spread)));
      lo = Math.max(0, Math.floor((lowest - spread * 0.15) / step) * step);
      if (!opts.max) hi = top + spread * 0.12;
    }
    var n = pts.length, bw = (w - pl - pr) / n, barW = Math.min(bw * 0.62, 44), pt = ranged ? 30 : pt;
    var Y = function (v) { return pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo)); };
    var out = "";
    pts.forEach(function (p, i) {
      var x = pl + bw * i + (bw - barW) / 2, col = p.flag === "ours" ? COLORS[2] : p.flag === "highlight" ? COLORS[3] : (opts.color || COLORS[0]);
      var dash = p.flag === "projection" ? ' stroke="' + col + '" stroke-dasharray="4 3" fill="' + col + '" fill-opacity=".25"' : ' fill="' + col + '"';
      if (p.value2 != null) out += '<rect x="' + x + '" y="' + Y(p.value2) + '" width="' + barW + '" height="' + (Y(p.value) - Y(p.value2)) + '"' + dash + ' rx="1.5"/>';
      else out += '<rect x="' + x + '" y="' + Y(p.value) + '" width="' + barW + '" height="' + (Y(lo) - Y(p.value)) + '"' + dash + ' rx="1.5"/>';
      var label = p.value2 != null ? (opts.fmt || String)(p.value) + " to " + (opts.fmt || String)(p.value2) : (opts.fmt || String)(p.value);
      var ty = Y(p.value2 != null ? p.value2 : p.value) - 4;
      /* A range label wider than its slot goes on two lines. */
      if (p.value2 != null && label.length * 5.6 > bw - 4) out += '<text class="val" x="' + (x + barW / 2) + '" y="' + (ty - 10) + '" text-anchor="middle">' + esc((opts.fmt || String)(p.value) + " to") + '</text><text class="val" x="' + (x + barW / 2) + '" y="' + ty + '" text-anchor="middle">' + esc((opts.fmt || String)(p.value2)) + "</text>";
      else out += '<text class="val" x="' + (x + barW / 2) + '" y="' + ty + '" text-anchor="middle">' + esc(label) + "</text>";
      out += '<text class="ax" x="' + (x + barW / 2) + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(p.label) + "</text>";
    });
    if (opts.refLine != null) { var y = Y(opts.refLine); out += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + y + '" y2="' + y + '" stroke="' + COLORS[0] + '" stroke-dasharray="3 3" stroke-width="1"/><text class="ax" x="' + (w - pr) + '" y="' + (y - 3) + '" text-anchor="end" fill="' + COLORS[0] + '">' + esc(opts.refLabel || "") + "</text>"; }
    return svg(w, h, out);
  }
  function hbars(rows, opts) {
    /* rows: [{label, value, color, note}] horizontal, sorted as given */
    opts = opts || {};
    var w = opts.w || 300, rowH = opts.rowH || 14, pl = opts.pl || 90, pr = 50, h = rows.length * rowH + 4;
    var hi = opts.max || Math.max.apply(null, rows.map(function (r) { return r.value; })) * 1.05;
    var out = "";
    rows.forEach(function (r, i) {
      var y = 2 + i * rowH, bw = (w - pl - pr) * (r.value / hi);
      out += '<text class="lbl" x="' + (pl - 5) + '" y="' + (y + rowH * 0.68) + '" text-anchor="end">' + esc(r.label) + "</text>";
      out += '<rect x="' + pl + '" y="' + (y + 2) + '" width="' + Math.max(0, bw) + '" height="' + (rowH - 5) + '" fill="' + (r.color || COLORS[0]) + '" rx="1.5"/>';
      out += '<text class="val" x="' + (pl + bw + 4) + '" y="' + (y + rowH * 0.68) + '">' + esc(r.note || (opts.fmt || String)(r.value)) + "</text>";
    });
    if (opts.refLine != null) {
      /* the label runs left of the line when running right would leave the chart */
      var x = pl + (w - pl - pr) * (opts.refLine / hi), left = x + 3 + (opts.refLabel || "").length * 5.1 > w;
      out += '<line x1="' + x + '" x2="' + x + '" y1="0" y2="' + h + '" stroke="' + COLORS[0] + '" stroke-dasharray="3 3"/><text class="ax" x="' + (left ? x - 3 : x + 3) + '" y="' + (h + 8) + '"' + (left ? ' text-anchor="end"' : "") + ' fill="' + COLORS[0] + '">' + esc(opts.refLabel || "") + "</text>";
    }
    return svg(w, h + (opts.refLine != null ? 12 : 0), out);
  }
  /* Stacked horizontal bars: one row per option, segments in order. */
  function stacked(rows, segs, opts) {
    opts = opts || {};
    var w = opts.w || 420, rowH = 34, pl = 70, pr = 70, h = rows.length * rowH + 22;
    var hi = Math.max.apply(null, rows.map(function (r) { return r.total; })) * 1.02;
    var X = function (v) { return pl + (w - pl - pr) * (v / hi); };
    var out = "";
    rows.forEach(function (r, i) {
      var y = i * rowH + 4, x = pl;
      out += '<text class="lbl" x="' + (pl - 6) + '" y="' + (y + 14) + '" text-anchor="end" font-weight="600">' + esc(r.label) + "</text>";
      out += '<text class="ax" x="' + (pl - 6) + '" y="' + (y + 24) + '" text-anchor="end">' + esc(r.sub || "") + "</text>";
      segs.forEach(function (s, k) {
        var v = r.values[k], bw = X(v) - pl;
        out += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="20" fill="' + s.color + '"/>';
        if (bw > 26) out += '<text class="val" x="' + (x + bw / 2) + '" y="' + (y + 13.5) + '" text-anchor="middle" fill="#fff">' + esc((opts.fmt || String)(v)) + "</text>";
        x += bw;
      });
      out += '<text class="val" x="' + (x + 5) + '" y="' + (y + 13.5) + '">' + esc(r.note || (opts.fmt || String)(r.total)) + "</text>";
    });
    var g = 5; for (var i = 0; i <= g; i++) { var v = hi * i / g; out += '<text class="ax" x="' + X(v) + '" y="' + (h - 4) + '" text-anchor="middle">' + esc((opts.axisFmt || opts.fmt || String)(v)) + "</text>"; }
    return svg(w, h, out) + '<div class="leg">' + segs.map(function (s) { return "<span><i style=\"background:" + s.color + '"></i>' + esc(s.label) + "</span>"; }).join("") + "</div>";
  }
  /* The occupancy scale: 60% to 100%, with the thresholds marked. Labels
     above the bar stack in as many rows as they need, so none touches
     another label or crosses another threshold's leader line. */
  function occScale(c, a, opts) {
    var w = 820, pl = 30, pr = 30, lo = 0.6, hi = 1.0, rowH = 14, gap = 6;
    var X = function (v) { return pl + (w - pl - pr) * ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)); };
    var be = c.breakEven, rc = c.options[0] ? c.options[0].runningCovered : 0, ads = c.options[0] ? c.options[0].breakEvenWithAds : 0;
    var rl = Costing.num(a.rivalsLow, 75) / 100, rh = Costing.num(a.rivalsHigh, 80) / 100;
    var lines = [
      { x: X(rc), text: pc(rc) + " running costs covered", col: COLORS[3] },
      { x: X(be), text: pc(be) + " every cost covered", col: COLORS[2] }
    ];
    if (ads) lines.push({ x: X(ads), text: pc(ads) + " with ads", col: COLORS[4] });
    /* side: 0 centred on x, 1 running right of it, -1 running left of it */
    var span = function (l, cw, side) { var wd = l.text.length * cw, at = side > 0 ? l.x + 4 : side < 0 ? l.x - 4 - wd : l.x - wd / 2; l.left = Math.max(0, Math.min(w - wd, at)); l.right = l.left + wd; };
    var hits = function (x, l) { return x >= l.left - gap && x <= l.right + gap; };
    /* The rivals label sits on the row next to the bar, slid sideways off any leader line. */
    var box = { x: (X(rl) + X(rh)) / 2, text: "most rivals · " + Math.round(rl * 100) + " to " + Math.round(rh * 100) + "%" };
    span(box, 5.1);
    var bw0 = box.right - box.left, cx = box.x;
    for (var k = 0; k <= 40 && lines.some(function (l) { return hits(l.x, box); }); k++) {
      var dx = Math.ceil(k / 2) * 8 * (k % 2 ? -1 : 1);
      box.left = Math.max(0, Math.min(w - bw0, cx - bw0 / 2 + dx)); box.right = box.left + bw0;
    }
    /* Threshold labels stack upwards from row 1; none overlaps another or
       another's leader line. There are at most three, so every row and side
       is tried and the lowest, most centred layout wins. */
    lines.sort(function (p, q) { return p.x - q.x; });
    var fits = function (l, p) {
      if (p.row === l.row) return l.left > p.right + gap || l.right < p.left - gap;
      return p.row > l.row ? !hits(p.x, l) : !hits(l.x, p);
    };
    var best = null, bestScore = Infinity;
    (function tryAt(i, done) {
      if (i === lines.length) {
        var score = done.reduce(function (m, l) { return Math.max(m, l.row); }, 0) * 10 + done.filter(function (l) { return l.side; }).length;
        if (score < bestScore) { bestScore = score; best = done.map(function (l) { return { x: l.x, text: l.text, col: l.col, row: l.row, side: l.side, left: l.left, right: l.right }; }); }
        return;
      }
      var l = lines[i];
      for (var r = 1; r <= lines.length; r++) [0, 1, -1].forEach(function (side) {
        l.row = r; l.side = side; span(l, 5.6, side);
        if (done.every(function (p) { return fits(l, p); })) tryAt(i + 1, done.concat([{ x: l.x, text: l.text, col: l.col, row: r, side: side, left: l.left, right: l.right }]));
      });
    })(0, []);
    /* no clean layout: one row each, centred */
    var placed = best || lines.map(function (l, i) { span(l, 5.6, 0); l.row = i + 1; return l; });
    var top = Math.max.apply(null, placed.map(function (l) { return l.row; }));
    var by = 23 + top * rowH, h = by + 56;
    var out = "";
    out += '<rect x="' + X(lo) + '" y="' + by + '" width="' + (X(rc) - X(lo)) + '" height="16" fill="' + COLORS[0] + '" fill-opacity=".85"/>';
    out += '<rect x="' + X(rc) + '" y="' + by + '" width="' + (X(be) - X(rc)) + '" height="16" fill="' + COLORS[3] + '" fill-opacity=".85"/>';
    out += '<rect x="' + X(be) + '" y="' + by + '" width="' + (X(hi) - X(be)) + '" height="16" fill="' + COLORS[2] + '" fill-opacity=".85"/>';
    out += '<rect x="' + X(rl) + '" y="' + (by - 4) + '" width="' + (X(rh) - X(rl)) + '" height="24" fill="none" stroke="#2a1e16" stroke-dasharray="3 2"/>';
    var zone = function (x0, x1, t, s) { out += '<text class="t" x="' + ((x0 + x1) / 2) + '" y="' + (by + 30) + '" text-anchor="middle">' + t + '</text><text class="ax" x="' + ((x0 + x1) / 2) + '" y="' + (by + 39) + '" text-anchor="middle">' + s + "</text>"; };
    zone(X(lo), X(rc), "Losing money", "rent and running costs not covered");
    zone(X(rc), X(be), "Paying back", "the fit-out");
    zone(X(be), X(hi), "Earning", "every cost covered");
    for (var v = 0.6; v <= 1.001; v += 0.05) out += '<text class="ax" x="' + X(v) + '" y="' + (by + 54) + '" text-anchor="middle">' + Math.round(v * 100) + "%</text>";
    out += '<text class="ax" x="' + box.left + '" y="' + (by - 9) + '">' + esc(box.text) + "</text>";
    placed.forEach(function (l) {
      var y = by - 9 - l.row * rowH;
      out += '<line x1="' + l.x + '" x2="' + l.x + '" y1="' + (y + 3) + '" y2="' + (by + 16) + '" stroke="' + l.col + '" stroke-width="1.2"/>';
      out += '<text class="val" x="' + l.left + '" y="' + y + '" fill="' + l.col + '">' + esc(l.text) + "</text>";
    });
    return svg(w, h, out);
  }
  /* The price ladder: one dot per rival in bands, our prices as lines. */
  function ladder(b, c) {
    var rivals = (b.rivals || []).filter(function (r) { return isFinite(r.price); });
    if (!rivals.length) return "";
    var band = 2000, lo = Math.floor(Math.min.apply(null, rivals.map(function (r) { return r.price; })) / band) * band;
    var hi = Math.ceil(Math.max(Math.max.apply(null, rivals.map(function (r) { return r.price; })), c.priceHigh) / band) * band + band;
    var nO = c.options.length, w = 820, pl = 16, pr = 16, pb = 26, pt = 20 + (nO + 1) * 13, h = pt + 140, X = function (p) { return pl + (w - pl - pr) * ((p - lo) / (hi - lo)); };
    var cols = {}; rivals.forEach(function (r) { var k = Math.floor(r.price / band) * band; (cols[k] = cols[k] || []).push(r); });
    var out = "", maxN = Math.max.apply(null, Object.keys(cols).map(function (k) { return cols[k].length; }));
    var dy = Math.min(13, (h - pt - pb) / maxN);
    Object.keys(cols).forEach(function (k) {
      cols[k].forEach(function (r, i) {
        var cx = X(+k + band / 2), cy = h - pb - 6 - i * dy;
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="4.5" fill="' + (r.sameBuilding ? COLORS[3] : COLORS[1]) + '"' + (r.sameBuilding ? ' stroke="#2a1e16" stroke-width="1.5"' : "") + "><title>" + esc(r.operator + (r.building ? ", " + r.building : "") + ": " + R(r.price)) + "</title></circle>";
      });
      out += '<text class="val" x="' + X(+k + band / 2) + '" y="' + (h - pb - 10 - cols[k].length * dy) + '" text-anchor="middle">' + cols[k].length + "</text>";
    });
    for (var p = lo; p <= hi; p += 5000) out += '<text class="ax" x="' + X(p) + '" y="' + (h - 8) + '" text-anchor="middle">' + inr(p, { plain: true }).replace(/,000$/, "K") + "</text>";
    var med = median(rivals.map(function (r) { return r.price; }));
    /* Rows from the top: one per option, then "Middle". A line runs down from
       its own row, so a label avoids the lines of the rows above it. */
    var ourX = c.options.map(function (o) { return X(o.price); }), cw = 5.6;
    var side = function (x, wd, avoid) {
      var clear = function (l) { return avoid.every(function (ax) { return ax < l - 4 || ax > l + wd + 4; }); };
      if (x + 4 + wd <= w && clear(x + 4)) return x + 4;
      if (x - 4 - wd >= 0 && clear(x - 4 - wd)) return x - 4 - wd;
      return Math.min(x + 4, w - wd);
    };
    c.options.forEach(function (o, i) {
      var y = 12 + i * 13, t = o.name + " " + R(o.price);
      out += '<line x1="' + ourX[i] + '" x2="' + ourX[i] + '" y1="' + (y + 3) + '" y2="' + (h - pb) + '" stroke="' + COLORS[0] + '" stroke-width="1.5"/><text class="val" x="' + side(ourX[i], t.length * cw, ourX.slice(0, i)) + '" y="' + y + '" fill="' + COLORS[0] + '">' + esc(t) + "</text>";
    });
    var mt = "Middle " + R(med), mw = mt.length * 5.1, mx = X(med) - mw / 2;
    if (!ourX.every(function (ax) { return ax < mx - 4 || ax > mx + mw + 4; })) mx = side(X(med), mw, ourX);
    out += '<line x1="' + X(med) + '" x2="' + X(med) + '" y1="' + (15 + nO * 13) + '" y2="' + (h - pb) + '" stroke="#2a1e16" stroke-dasharray="3 3"/><text class="ax" x="' + mx + '" y="' + (12 + nO * 13) + '">' + esc(mt) + "</text>";
    return svg(w, h, out);
  }

  /* --------------------------------------------------------------- pages -- */
  function Deck(b, c) {
    this.b = b; this.c = c; this.pages = []; this.secNo = 0; this.toc = [];
    this.hdrText = (b.meta.title || "").toUpperCase();
  }
  Deck.prototype.add = function (opts) {
    /* opts: { cls, body, src, section (for header), noHdr } */
    this.pages.push(opts);
    return this.pages.length;
  };
  Deck.prototype.section = function (key, title, sub, kpis, slot) {
    this.secNo++;
    var n = String(this.secNo).padStart(2, "0");
    this.toc.push({ n: n, title: title, sub: sub, page: this.pages.length + 1 });
    var body = img(this.b, slot) + '<div class="over"><div class="secnum">' + n + '</div><h1 style="margin-top:4mm">' + esc(title) + '</h1><p class="mut" style="font-size:11pt;max-width:170mm;margin-top:3mm">' + esc(sub) + '</p><div class="kpis">' + kpis.join("") + "</div></div>";
    this.add({ cls: "dark", body: body, noHdr: true, sec: n });
    return n + " · " + title.toUpperCase();
  };

  function render(b, mount) {
    b = b || {}; b.meta = b.meta || {}; var a = b.assumptions || {};
    var c = Costing.caseCosting(b.options || [], a);
    var d = new Deck(b, c);
    var sym = b.meta.currency || "₹";
    var names = c.options.map(function (o) { return o.name; });
    var cover = (b.kpis || []).filter(function (k) { return k.section === "cover"; });
    var kp = function (k) { return kpi(code(b, c, k.value, k.option), k.label, k.sub); };
    var secK = function (s) { return (b.kpis || []).filter(function (k) { return k.section === s; }).map(kp); };

    /* ---- cover ---- */
    d.add({ cls: "dark", noHdr: true, body: img(b, "cover") + '<div class="over"><div class="eyebrow" style="color:#e8a87c">' + esc((b.meta.kind || "Business case") + " · " + (b.meta.asOf || "")) + '</div><h1 style="font-size:40pt;max-width:200mm">' + esc(b.meta.title) + '</h1><p style="font-size:12.5pt;margin-top:4mm;max-width:190mm" class="mut">' + esc(b.meta.sub || "") + '</p><p class="small mut">' + esc(b.meta.tagline || "") + '</p><div class="kpis">' + cover.map(kp).join("") + "</div></div>" });

    /* ---- contents: filled in at the end, once the pages are known ---- */
    var tocIndex = d.add({ hdr: "CONTENTS", body: "" });

    /* ---- 01 options ---- */
    if (c.options.length) {
      var h = d.section("options", c.options.length === 2 ? "The two options" : "The options", copy(b, "options", "intro")[0] || SECTION_SUBS.options, secK("options"), "options");
      /* terms table */
      var o0 = b.options, terms = [
        ["Usable floor (carpet)", function (o, x) { return '<td class="big">' + fmt(x.inputs.carpet) + ' sq ft</td>'; }, "The area we fit out and sell."],
        ["Built-up area", function (o, x) { return "<td>" + fmt(x.builtup) + " sq ft<br><span class='tiny mut'>at " + pc(x.inputs.efficiency) + " usable</span></td>"; }, "What the landlord's figure is on, when it is not carpet."],
        ["Rent", function (o, x) { return '<td class="big">' + sym + fmt(x.inputs.rentRate) + "<br><span class='tiny mut'>a sq ft of " + (x.inputs.rentBasis === "builtup" ? "built-up area = " + sym + fmt(x.rentOnCarpet) + " on carpet" : "carpet") + ", a month</span></td>"; }, "On the same footing (carpet), the dearer option costs more for every usable sq ft."],
        ["Rent a month", function (o, x) { return '<td class="big">' + L(x.rent) + "</td>"; }, "What goes to the landlord every month: the biggest cost by far."],
        ["Fit-out", function (o, x) { return '<td class="big">' + Cr(x.fitout) + "<br><span class='tiny mut'>" + sym + fmt(x.inputs.fitoutRate) + " a sq ft</span></td>"; }, "Our one-time spend to build the office, recovered over the lock-in."],
        ["Running costs", function (o, x) { return "<td>" + L(x.running) + "<br><span class='tiny mut'>" + sym + fmt(x.inputs.runningRate) + " a sq ft, a month</span></td>"; }, "Power, housekeeping, security, staff, internet."],
        ["Lock-in", function (o, x) { return "<td>" + x.inputs.lockinMonths + " months</td>"; }, "We cannot leave before it ends."],
        ["Seats we can sell", function (o, x) { return '<td class="big">' + fmt(x.seats) + "<br><span class='tiny mut'>one seat per " + x.inputs.sqftPerSeat + " sq ft of carpet</span></td>"; }, "More seats to sell, and to fill."],
        ["Can we move in?", function (o) { return "<td><b>" + esc(o.built || "") + "</b><br><span class='tiny mut'>" + esc(o.builtNote || "") + "</span></td>"; }, "As the records show; to confirm with the landlord."],
      ];
      d.add({ hdr: h, src: src(b, "options"), body: "<h2>The options, in plain words</h2><p class='small mut'>" + esc(copy(b, "options", "note")[0] || "") + "</p><table><thead><tr><th>Term</th>" + names.map(function (n) { return "<th>" + esc(n) + "</th>"; }).join("") + "<th>What it means for us</th></tr></thead><tbody>" +
        terms.map(function (t) { return "<tr><td><b>" + esc(t[0]) + "</b></td>" + c.options.map(function (x, i) { return t[1](o0[i], x); }).join("") + "<td class='small mut'>" + esc(t[2]) + "</td></tr>"; }).join("") + "</tbody></table>" });
      /* costing line by line */
      var line = function (label, how, f, cls) { return "<tr><td><b>" + esc(label) + "</b> <span class='tiny mut'>" + esc(how) + "</span></td>" + c.options.map(function (x) { return '<td class="n' + (cls ? " " + cls : "") + '">' + f(x) + "</td>"; }).join("") + "</tr>"; };
      var notIn = (a.notInSheet || []).length ? '<div class="box" style="margin-top:3mm"><b class="t">Not in the sheet</b>' + esc(a.notInSheet.join(" · ")) + "<br><span class='tiny mut'>Each one moves the price. Ask for all of them in writing.</span></div>" : "";
      d.add({ hdr: h, src: src(b, "costing"), body: "<h2>The costing, line by line</h2><div class='cols c32'><div><table class='tight'><thead><tr><th>Line</th>" + names.map(function (n) { return '<th class="n">' + esc(n) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        "<tr class='hd'><td colspan='9'>What we pay, every month</td></tr>" +
        line("Carpet area", "the usable floor", function (x) { return fmt(x.inputs.carpet) + " sq ft"; }) +
        line("Built-up area", "carpet ÷ efficiency", function (x) { return x.inputs.rentBasis === "builtup" ? fmt(x.builtup) + " sq ft" : "<span class='dim'>not used</span>"; }) +
        line("Rent rate", "a sq ft, a month", function (x) { return sym + fmt(x.inputs.rentRate) + " on " + (x.inputs.rentBasis === "builtup" ? "built-up · " + sym + fmt(x.rentOnCarpet) + " on carpet" : "carpet"); }) +
        line("Rent", "area × rate", function (x) { return R(x.rent); }) +
        line("Fit-out (one-time)", "carpet × rate", function (x) { return R(x.fitout); }) +
        line("Fit-out recovered", "fit-out ÷ " + (a.lockinMonths || 60) + "-month lock-in", function (x) { return R(x.fitoutMonthly); }) +
        line("Running costs", "carpet × " + sym + (a.runningRate || 75), function (x) { return R(x.running); }) +
        "<tr class='sum'><td><b>Total cost a month</b> <span class='tiny mut'>rent + fit-out + running</span></td>" + c.options.map(function (x) { return '<td class="n">' + R(x.total) + "</td>"; }).join("") + "</tr>" +
        "<tr class='hd'><td colspan='9'>What we must bill</td></tr>" +
        line("Our margin", pc(c.options[0].inputs.margin) + " of cost", function (x) { return R(x.margin); }) +
        "<tr class='sum'><td><b>Billed a month</b> <span class='tiny mut'>cost + margin</span></td>" + c.options.map(function (x) { return '<td class="n">' + R(x.billed) + "</td>"; }).join("") + "</tr>" +
        line("Seats", "carpet ÷ " + c.options[0].inputs.sqftPerSeat, function (x) { return fmt(x.seats); }) +
        "<tr class='sum'><td><b>Price a seat, a month</b> <span class='tiny mut'>billed ÷ seats</span></td>" + c.options.map(function (x) { return '<td class="n big">' + R(x.price) + "</td>"; }).join("") + "</tr>" +
        line("Price a sq ft of carpet", "billed ÷ carpet", function (x) { return R(x.pricePerSqft); }) +
        "<tr class='hd'><td colspan='9'>If we add sales costs</td></tr>" +
        line("With " + pc(c.options[0].inputs.brokeragePct) + " brokerage", "billed × " + (1 + c.options[0].inputs.brokeragePct).toFixed(2), function (x) { return R(x.withBrokerage.price) + " a seat · " + R(x.withBrokerage.pricePerSqft) + " a sq ft"; }) +
        line("With ads, " + L(c.options[0].inputs.adsPerMonth) + " a month", "billed + " + R(c.options[0].inputs.adsPerMonth), function (x) { return R(x.withAds.price) + " a seat · " + R(x.withAds.pricePerSqft) + " a sq ft"; }) +
        "</tbody></table></div><div><div class='box'><b class='t'>Read it like this</b>" + copy(b, "costing", "note").map(function (t) { return "<p class='small'>" + esc(t) + "</p>"; }).join("") + "</div>" + notIn + (a.adsNote ? '<div class="box" style="margin-top:3mm"><b class="t">Ad budget</b><span class="small">' + esc(a.adsNote) + "</span></div>" : "") + "</div></div>" });
      /* what each floor earns */
      var segs = [{ label: "Rent", color: COLORS[0] }, { label: "Running costs", color: COLORS[1] }, { label: "Fit-out recovered", color: COLORS[3] }, { label: "Our " + pc(c.options[0].inputs.margin) + " margin", color: COLORS[2] }];
      var rows = c.options.map(function (x) { return { label: x.name, sub: fmt(x.seats) + " seats billed", values: [x.rent / 1e5, x.running / 1e5, x.fitoutMonthly / 1e5, x.margin / 1e5], total: x.billed / 1e5, note: L(x.billed) + " a month" }; });
      var earnsCards = c.options.map(function (x) { return '<div class="box"><b class="t">' + esc(x.name) + '</b><div class="kpi"><div class="v" style="font-size:20pt">' + R(x.price) + '</div><div class="l">a seat a month, every seat sold</div></div><p class="small" style="margin-top:2mm"><b>Profit a month, full</b> ' + L(x.profitFull) + " · about " + Cr(x.profitFullYear) + ' a year<br><b>Fit-out spend</b> ' + Cr(x.fitout) + ' one-time<br><b>Locked in for ' + x.inputs.lockinMonths + ' months</b> ' + Cr(x.commitment) + ' <span class="mut">rent + fit-out, no escalation</span></p></div>'; }).join("");
      var earnsAuto = []; if (c.options.length >= 2) { var p0 = c.options[0], p1 = c.options[1], dearer = p0.price > p1.price ? p0 : p1, cheaper = dearer === p0 ? p1 : p0; earnsAuto.push(dearer.name + " earns " + L(Math.abs(dearer.profitFull - cheaper.profitFull)) + " more a month when full, but costs " + L(dearer.total - cheaper.total) + " more a month and needs " + R(dearer.price - cheaper.price) + " more for every seat."); }
      d.add({ hdr: h, src: src(b, "earns"), body: "<h2>What each floor must earn, and what it keeps</h2><div class='cols c32'><div><div class='t tiny mut' style='letter-spacing:.1em;text-transform:uppercase'>Every month, every seat sold · " + sym + " lakh</div>" + stacked(rows, segs, { fmt: function (v) { return v.toFixed(2); }, axisFmt: function (v) { return Math.round(v); } }) + "<div style='margin-top:4mm'>" + means(b, "earns", copy(b, "earns").length ? [] : earnsAuto) + "</div></div><div style='display:flex;flex-direction:column;gap:3mm'>" + earnsCards + "</div></div>" });
      /* one seat */
      var seatRows = []; c.options.forEach(function (x) {
        seatRows.push({ label: x.name + " · sheet price", value: x.price, color: COLORS[0], note: R(x.price) });
        seatRows.push({ label: "+ ads, " + L(x.inputs.adsPerMonth) + " a month", value: x.withAds.price, color: COLORS[1], note: R(x.withAds.price) });
        seatRows.push({ label: "+ " + pc(x.inputs.brokeragePct) + " brokerage", value: x.withBrokerage.price, color: COLORS[3], note: R(x.withBrokerage.price) });
      });
      var rivalsAll = (b.rivals || []).filter(function (r) { return isFinite(r.price); });
      if (rivalsAll.length) { seatRows.push({ label: "Rival middle", value: median(rivalsAll.map(function (r) { return r.price; })), color: "#8a7a6c", note: R(median(rivalsAll.map(function (r) { return r.price; }))) }); rivalsAll.filter(function (r) { return r.sameBuilding || r.near; }).slice(0, 3).forEach(function (r) { seatRows.push({ label: r.operator + (r.sameBuilding ? ", inside " + byOpt(c, r.sameBuilding).name : r.building ? ", " + r.building : ""), value: r.price, color: "#8a7a6c", note: R(r.price) }); }); }
      var seatAuto = []; if (rivalsAll.length) c.options.forEach(function (x) { var above = rivalsAll.filter(function (r) { return r.price < x.price; }).length; seatAuto.push("At " + R(x.price) + ", " + x.name + " prices above " + above + " of the " + rivalsAll.length + " rival centres."); });
      d.add({ hdr: h, src: src(b, "seat"), body: "<h2>What one seat costs us, and what we must charge</h2><div class='cols c32'><div><div class='t tiny mut' style='letter-spacing:.1em;text-transform:uppercase'>One seat, one month · " + sym + "</div>" + hbars(seatRows, { pl: 150, w: 420, rowH: 15, fmt: R }) + "</div><div><div class='kpis' style='margin:0 0 4mm'>" + c.options.map(function (x) { return kpi(pc(x.rentShareOfPrice), "of every " + x.name + " seat goes straight to the landlord", "rent " + R(x.perSeat.rent) + " of " + R(x.price)); }).join("") + "</div>" + means(b, "seat", copy(b, "seat").length ? [] : seatAuto) + "</div></div>" });
      /* occupancy */
      var occPts = [0.75, 0.8, 0.85, 0.9, 1].map(function (occ) { return { occ: occ }; });
      var occTable = "<table><thead><tr><th>How full</th>" + names.map(function (n) { return '<th class="n">' + esc(n) + "</th>"; }).join("") + "</tr></thead><tbody>" + occPts.map(function (p) { return "<tr><td>" + pc(p.occ) + (Math.abs(p.occ - c.breakEven) < 0.03 ? " <span class='tiny mut'>break-even " + pc(c.breakEven) + "</span>" : "") + "</td>" + c.options.map(function (x) { var v = Costing.atOccupancy(x, p.occ); return '<td class="n" style="color:' + (v < 0 ? "var(--bad)" : "var(--ok)") + '">' + inr(v, { unit: "L", sign: true }) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
      var occAuto = ["The " + pc(c.options[0].inputs.margin) + " only appears when the floor is full. At " + pc(Costing.num(a.rivalsHigh, 80) / 100) + " full, " + c.options.map(function (x) { return x.name + " loses " + L(-Costing.atOccupancy(x, Costing.num(a.rivalsHigh, 80) / 100)) + " a month"; }).join(" and ") + "."];
      d.add({ hdr: h, src: src(b, "occupancy"), body: "<h2>How full each floor must be</h2><div class='t tiny mut' style='letter-spacing:.1em;text-transform:uppercase'>Occupancy at the sheet's price · same thresholds for every floor</div>" + occScale(c, a) + "<div class='cols c2' style='margin-top:4mm;flex:0 0 auto'><div><div class='kpis' style='margin:0 0 3mm'>" + kpi(pc(c.breakEven) + " full", "every cost covered at", c.options.map(function (x) { return x.breakEvenSeats + " of " + x.seats + " seats at " + x.name; }).join(" · ")) + kpi(Costing.num(a.rivalsLow, 75) + " to " + Costing.num(a.rivalsHigh, 80) + "%", "most rival centres here run at", a.rivalsNote || "") + "</div>" + (a.nationalLow ? "<p class='small mut'>" + esc(a.nationalNote ? a.nationalNote.replace(/\.$/, "") : "Listed operators report " + a.nationalLow + " to " + a.nationalHigh + "% full") + ".</p>" : "") + "</div><div><div class='t tiny mut' style='letter-spacing:.1em;text-transform:uppercase'>Profit or loss a month at the sheet's price</div>" + occTable + "</div></div><div style='margin-top:3mm'>" + means(b, "occupancy", copy(b, "occupancy").length ? [] : occAuto) + "</div>" });
      /* levers */
      var lvRows = c.options[0].levers.map(function (l, i) { return "<tr><td><b>" + esc(l.label) + "</b><br><span class='tiny mut'>" + esc(l.sub) + "</span></td>" + c.options.map(function (x) { var m = x.levers[i]; return '<td class="n">−' + R(m.saving) + (m.rent ? "<br><span class='tiny mut'>" + sym + Math.round(m.rent.quoted) + " a sq ft " + (x.inputs.rentBasis === "builtup" ? "built-up" : "carpet") + "</span>" : "") + "</td>"; }).join("") + "</tr>"; }).join("");
      var askFor = ((b.lists || {}).askFor || []).map(function (x) { return "<li>" + esc(x.item || x) + "</li>"; }).join("");
      d.add({ hdr: h, src: src(b, "levers"), body: "<h2>Levers to negotiate before we sign</h2><p class='small mut'>" + esc(copy(b, "levers", "intro")[0] || "") + "</p><div class='cols c32'><div><table><thead><tr><th>Lever</th>" + names.map(function (n) { return '<th class="n">' + esc(n) + "</th>"; }).join("") + "</tr></thead><tbody><tr><td><b>Sheet price</b></td>" + c.options.map(function (x) { return '<td class="n big">' + R(x.price) + "</td>"; }).join("") + "</tr>" + lvRows + "</tbody></table><p class='tiny mut' style='margin-top:2mm'>Rule of thumb: every " + sym + "1 a sq ft a month of cost moves the seat price by " + sym + Math.round(c.options[0].perSqftPerSeat) + " (" + c.options[0].inputs.sqftPerSeat + " sq ft × " + (1 + c.options[0].inputs.margin).toFixed(1) + ").</p></div><div>" + (askFor ? "<div class='box'><b class='t'>What to ask for</b><ul class='small'>" + askFor + "</ul></div>" : "") + "<div style='margin-top:3mm'>" + means(b, "levers") + "</div></div></div>" });
    }

    /* ---- 02 assets ---- */
    var hasAssets = (b.options || []).some(function (o) { return o.stage || o.reraId || o.developer; }) || (b.access || []).length;
    if (hasAssets) {
      var h2 = d.section("assets", "The assets", copy(b, "assets", "intro")[0] || SECTION_SUBS.assets, secK("assets"), "assets");
      var params = [["Full name", "fullName"], ["Developer", "developer"], ["Address", "address"], ["Stage today", "stage"], ["RERA completion", "reraDate"], ["Floors", "floors"], ["Offices in total", "offices"], ["Floor plate", "floorPlate"], ["Green rating", "green"], ["Amenities", "amenities"], ["Who is there now", "occupant"]];
      var extraKeys = []; var known = ["id", "name", "carpet", "rentRate", "rentBasis", "efficiency", "fitoutRate", "runningRate", "lockinMonths", "fullName", "developer", "address", "locality", "floorsOffered", "stage", "built", "builtNote", "reraId", "reraDate", "floors", "offices", "floorPlate", "green", "amenities", "occupant", "verdict", "verdictText", "marketRent", "canOpen", "rivalInside", "src"];
      b.options.forEach(function (o) { Object.keys(o).forEach(function (k) { if (known.indexOf(k) < 0 && extraKeys.indexOf(k) < 0) extraKeys.push(k); }); });
      var ptab = "<table><thead><tr><th>Parameter</th>" + names.map(function (n) { return "<th>" + esc(n) + "</th>"; }).join("") + "</tr></thead><tbody>" + params.concat(extraKeys.map(function (k) { return [k.replace(/([A-Z])/g, " $1").replace(/^./, function (ch) { return ch.toUpperCase(); }), k]; })).filter(function (p) { return b.options.some(function (o) { return o[p[1]]; }); }).map(function (p) { return "<tr><td><b>" + esc(p[0]) + "</b></td>" + b.options.map(function (o) { return "<td class='small'>" + esc(o[p[1]] == null ? "" : o[p[1]]) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
      var verdicts = b.options.filter(function (o) { return o.verdict; }).map(function (o) { return "<div class='box'><b class='t'>" + esc(o.verdict) + "</b><span class='small'>" + esc(o.verdictText || "") + "</span></div>"; }).join("<div style='height:3mm'></div>");
      var rera = b.options.filter(function (o) { return o.reraId; }).map(function (o) { return "<span class='mono'>" + esc(o.reraId) + "</span> (" + esc(o.name) + ")"; }).join("<br>");
      d.add({ hdr: h2, src: src(b, "assets"), body: "<h2>The buildings, side by side</h2><div class='cols c32'><div>" + ptab + "</div><div>" + verdicts + (rera ? "<div class='box' style='margin-top:3mm'><b class='t'>Check on RERA</b><span class='small'>" + rera + "</span></div>" : "") + "</div></div>" });
      if ((b.access || []).length) {
        var accCols = c.options.map(function (x) { var rows = (b.access || []).filter(function (r) { return r.option === x.id; }).sort(function (p, q) { return p.distanceM - q.distanceM; }); if (!rows.length) return ""; return "<div><h3>" + esc(x.name) + "</h3><table><thead><tr><th>Stop or station</th><th class='n'>Distance</th><th class='n'>Walk</th><th>Line</th></tr></thead><tbody>" + rows.map(function (r) { return "<tr><td>" + esc(r.name) + (r.note ? "<br><span class='tiny mut'>" + esc(r.note) + "</span>" : "") + "</td><td class='n'>" + (r.distanceM >= 1000 ? (r.distanceM / 1000).toFixed(1) + " km" : r.distanceM + " m") + "</td><td class='n'>" + walk(r.distanceM, a) + " min</td><td class='small'>" + esc(r.line || "") + "</td></tr>"; }).join("") + "</tbody></table></div>"; }).join("");
        d.add({ hdr: h2, src: src(b, "access"), body: "<h2>Getting there</h2><p class='small mut'>Walking time at " + Costing.num(a.walkMPerMin, 80) + " m a minute.</p><div class='cols c" + Math.min(3, c.options.length) + "' style='flex:0 0 auto'>" + accCols + "</div><div style='margin-top:4mm'>" + means(b, "access") + "</div>" });
      }
    }

    /* ---- 03 market ---- */
    var mpts = (b.points || []).filter(function (p) { return p.section === "market"; }).sort(function (p, q) { return (p.n || 0) - (q.n || 0); });
    var series = function (chart) { return (b.series || []).filter(function (s) { return s.chart === chart; }); };
    if (mpts.length || (b.series || []).length || (b.deals || []).length || (b.occupiers || []).length || (b.pools || []).length) {
      var h3 = d.section("market", "Market research and analysis", copy(b, "market", "intro")[0] || SECTION_SUBS.market, secK("market"), "market");
      /* big: the page's only chart, drawn wider and taller to fill its column. */
      var chartFor = function (key, big) {
        var sz = big ? { w: 460, h: 210 } : {};
        var pts = series(key); if (!pts.length) return "";
        var title = { vacancy: "Vacancy", rent: "Average rent · " + sym + " a sq ft a month", topBand: "Office rent, top Grade-A buildings · " + sym + " a sq ft a month · dashed = projection", flexSeats: "Flex seats leased, first half of each year", operatorOccupancy: "Settled centres are this full", absorptionShare: "Share of net absorption" }[key] || key;
        var body;
        if (key === "vacancy" || key === "rent") body = lineChart(pts, { w: sz.w, h: sz.h, fmt: key === "vacancy" ? function (v) { return (+v).toFixed(1) + "%"; } : function (v) { return sym + Math.round(v); }, color: key === "vacancy" ? COLORS[1] : COLORS[0] });
        else if (key === "operatorOccupancy") body = hbars(pts.map(function (p) { return { label: p.label, value: p.value, note: p.value + "%" }; }), { max: 100, refLine: c.breakEven * 100, refLabel: "our break-even " + pc(c.breakEven), pl: 80, rowH: big ? 26 : 15, w: sz.w });
        else body = barChart(pts, { w: sz.w, h: sz.h, fmt: function (v) { return key === "flexSeats" ? fmt(v) : key === "topBand" ? sym + Math.round(v) : (+v).toFixed(+v % 1 ? 1 : 0) + (key === "absorptionShare" ? "%" : ""); }, color: key === "flexSeats" ? COLORS[2] : COLORS[0] });
        var note = pts.filter(function (p) { return p.note; }).map(function (p) { return p.label + ": " + p.note; }).join(" · ");
        return "<div" + (big ? " class='chart-big'" : "") + "><div class='t tiny mut' style='letter-spacing:.1em;text-transform:uppercase;margin-bottom:1mm'>" + esc(title) + "</div>" + body + (note ? "<div class='tiny mut' style='margin-top:1mm'>" + esc(note) + "</div>" : "") + "</div>";
      };
      var usedCharts = [];
      mpts.forEach(function (p) {
        var charts = [p.chart].filter(Boolean);
        /* the first market point also carries the paired chart (vacancy + rent) */
        if (p.chart === "vacancy" && series("rent").length) charts.push("rent");
        if (p.chart === "vacancy" && series("absorptionShare").length) charts.push("absorptionShare");
        if (p.chart === "flexSeats" && series("operatorOccupancy").length) charts.push("operatorOccupancy");
        usedCharts = usedCharts.concat(charts);
        var chartHtml = charts.map(function (k) { return chartFor(k, charts.length === 1); }).join("");
        var kpiHtml = p.kpi ? "<div class='kpi' style='margin-bottom:3mm'><div class='v' style='font-size:22pt'>" + esc(code(b, c, p.kpi)) + "</div><div class='l'>" + esc(p.kpiLabel || "") + "</div></div>" : "";
        var meansHtml = "<div class='means'><b>What it means for us</b><p>" + esc(p.text) + "</p></div>";
        var layout;
        if (charts.length >= 2) layout = "<div class='cols c2'><div class='cols c" + Math.min(charts.length, 3) + "' style='grid-column:1 / -1;flex:0 0 auto'>" + chartHtml + "</div><div style='grid-column:1 / -1'>" + kpiHtml + meansHtml + "</div></div>";
        /* one chart: the chart takes the wide column, the figure and its meaning sit beside it */
        else if (charts.length === 1) layout = "<div class='cols c32' style='align-items:center'>" + chartHtml + "<div>" + kpiHtml + meansHtml + "</div></div>";
        /* no chart: a statement page, the figure large beside what it means, centred in the page */
        else layout = "<div class='statement" + (p.kpi ? "" : " solo") + "'>" + (p.kpi ? "<div class='kpi'><div class='v'>" + esc(code(b, c, p.kpi)) + "</div><div class='l'>" + esc(p.kpiLabel || "") + "</div></div>" : "") + meansHtml + "</div>";
        d.add({ hdr: h3, src: src(b, "market") + (p.chart === "flexSeats" ? " " + src(b, "flex") : ""), body: "<h2><span class='pt'><span class='n'>" + String(p.n || "").padStart(2, "0") + "</span></span>" + esc(p.title) + "</h2>" + layout });
      });
      /* deals */
      if ((b.deals || []).length) {
        d.add({ hdr: h3, src: src(b, "deals"), body: "<h2>Recent deals in and around " + esc(b.meta.place || "the area") + "</h2><div class='cols " + (means(b, "deals") ? "c21" : "") + "'><table><thead><tr><th>Who</th><th>Building</th><th class='n'>Area</th><th class='n'>Rent</th><th>When</th><th>Kind</th></tr></thead><tbody>" + b.deals.map(function (x) { return "<tr><td><b>" + esc(x.who) + "</b>" + (x.note ? "<br><span class='tiny mut'>" + esc(x.note) + "</span>" : "") + "</td><td class='small'>" + esc(x.building || "") + "</td><td class='n'>" + esc(x.area) + "</td><td class='n'>" + esc(x.rent || "") + "</td><td class='small'>" + esc(x.when || "") + "</td><td class='small'>" + esc(x.kind || "") + "</td></tr>"; }).join("") + "</tbody></table><div>" + means(b, "deals") + "</div></div>" });
      }
      /* catchment */
      if ((b.occupiers || []).length) {
        d.add({ hdr: h3, src: src(b, "catchment"), body: "<h2>Who is in the catchment, by sector</h2><div class='pts' style='grid-template-columns:1fr 1fr 1fr;flex:0 0 auto'>" + b.occupiers.map(function (o) { return "<div class='pt'><h3>" + esc(o.sector) + "</h3><p class='tiny mut'>" + esc(o.share || "") + (o.fit ? " · " + esc(o.fit) + " fit" : "") + "</p>" + (o.within5.length ? "<p class='tiny'><b>Within 5 km</b> · " + esc(o.within5.join(" · ")) + "</p>" : "") + (o.within10.length ? "<p class='tiny'><b>Within 10 km</b> · " + esc(o.within10.join(" · ")) + "</p>" : "") + "</div>"; }).join("") + "</div><div style='margin-top:3mm'>" + means(b, "catchment") + "</div>" });
      }
      if ((b.pools || []).length) {
        var calls = ((b.lists || {}).firstCalls || []).map(function (x) { return esc(x.item || x); }).join(" · ");
        d.add({ hdr: h3, src: src(b, "pools"), body: "<h2>Demand catchment</h2><div class='cols c" + Math.min(3, b.pools.length) + "' style='flex:0 0 auto'>" + b.pools.map(function (p, i) { return "<div class='pt'><h3><span class='n'>" + String(i + 1).padStart(2, "0") + "</span>" + esc(p.title) + "</h3><div class='chain'>" + p.chain.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div><p class='small'>" + esc(p.text || "") + "</p>" + (p.kpi ? "<div class='kpi'><div class='v' style='font-size:20pt'>" + esc(p.kpi) + "</div><div class='l'>" + esc(p.kpiLabel || "") + "</div></div>" : "") + "</div>"; }).join("") + "</div>" + (calls ? "<div class='box' style='margin-top:4mm'><b class='t'>Best-fit first calls</b><span class='small'>" + calls + "</span></div>" : "") + "<div style='margin-top:3mm'>" + means(b, "pools") + "</div>" });
      }
    }

    /* ---- numbered-point sections: infrastructure, why ---- */
    var pointPage = function (sec, title, slot, srcKey, extraHtml) {
      var pts = (b.points || []).filter(function (p) { return p.section === sec; }).sort(function (p, q) { return (p.n || 0) - (q.n || 0); });
      if (!pts.length) return;
      var h = d.section(sec, title, copy(b, sec, "intro")[0] || SECTION_SUBS[sec], secK(sec), slot);
      var kp = secK(sec);
      d.add({ hdr: h, src: src(b, srcKey || sec), body: "<h2>" + esc(copy(b, sec, "intro")[0] || title) + "</h2><div class='pts lg' style='grid-template-columns:repeat(" + (pts.length > 4 ? 3 : 2) + ",1fr);flex:0 0 auto'>" + pts.map(function (p) { return "<div class='pt'><h3><span class='n'>" + String(p.n || "").padStart(2, "0") + "</span>" + esc(p.title) + "</h3><p>" + esc(p.text) + "</p>" + (p.kpi ? "<div class='kpi'><div class='v' style='font-size:18pt'>" + esc(code(b, c, p.kpi)) + "</div><div class='l'>" + esc(p.kpiLabel || "") + "</div></div>" : "") + "</div>"; }).join("") + "</div><div class='foot'>" + means(b, sec) + (extraHtml || "") + "</div>" });
    };
    pointPage("infrastructure", "Key infrastructure around " + (b.meta.place || "the site"), "infrastructure");
    pointPage("why", "Why " + (b.meta.place || "here") + " works", "why");

    /* ---- plan ---- */
    var plan = (b.points || []).filter(function (p) { return p.section === "plan"; }).sort(function (p, q) { return (p.n || 0) - (q.n || 0); });
    if (plan.length) {
      var h6 = d.section("plan", "Speculative commercialisation plan", copy(b, "plan", "intro")[0] || SECTION_SUBS.plan, secK("plan"), "plan");
      var first = plan[0], rest = plan.slice(1);
      var pack = ((b.lists || {}).pack || []).map(function (x) { return esc(x.item || x); }).join(" · ");
      var steps = first.text.split(/(?=\b(?:Curate|Activate|Incentivise|Step \d)\b:?)/).filter(Boolean);
      var brokerKpis = c.options.length ? "<div class='kpis' style='margin:0'>" + kpi(pc(c.options[0].inputs.brokeragePct), "brokerage in the sheet", "of the monthly bill, for as long as we bill") + kpi(c.options.map(function (x) { return R(x.perSeat.brokerage); }).join(" · "), "what it adds to a seat", names.join(" · ")) + kpi(c.options.map(function (x) { return R(x.withBrokerage.price); }).join(" · "), "price with brokerage", names.join(" · ")) + "</div>" : "";
      d.add({ hdr: h6, src: src(b, "plan"), body: "<h2>Pipeline 1: " + esc(first.title) + "</h2><div class='cols lg c" + Math.min(3, steps.length) + "' style='flex:0 0 auto'>" + steps.map(function (s, i) { var m = s.match(/^([A-Za-z ]+?):\s*(.*)$/s); return "<div class='pt'><h3><span class='n'>" + (i + 1) + "</span>" + esc(m ? m[1] : "Step " + (i + 1)) + "</h3><p class='small'>" + esc(m ? m[2] : s) + "</p></div>"; }).join("") + "</div>" + brokerKpis + "<div class='foot'>" + means(b, "plan") + (pack ? "<div class='box' style='margin-top:3mm'><b class='t'>The broker pack</b><span class='small'>" + pack + "</span></div>" : "") + "</div>" });
      if (rest.length) {
        var adsLine = a.adsPerMonth ? "<div class='kpis' style='margin:0'>" + kpi(L(a.adsFloorPerMonth || a.adsPerMonth), "a month, minimum: one ad, one location", a.adsNote || "") + kpi(c.options.map(function (x) { return R(x.perSeat.ads); }).join(" to "), "what ads add to a seat", "") + "</div>" : "";
        d.add({ hdr: h6, src: src(b, "pipelines"), body: "<h2>Pipelines " + (first.n ? first.n + 1 : 2) + " to " + (plan[plan.length - 1].n || plan.length) + "</h2><div class='pts lg' style='flex:0 0 auto'>" + rest.map(function (p) { return "<div class='pt'><h3>Pipeline " + esc(p.n) + ": " + esc(p.title) + "</h3><p class='small'>" + esc(p.text) + "</p></div>"; }).join("") + "</div>" + adsLine + "<div class='foot'>" + means(b, "pipelines") + "</div>" });
      }
    }

    /* ---- risks ---- */
    var risks = (b.points || []).filter(function (p) { return p.section === "risks"; }).sort(function (p, q) { return (p.n || 0) - (q.n || 0); });
    if (risks.length) {
      var h7 = d.section("risks", "Top " + (risks.length === 3 ? "three " : "") + "risks", copy(b, "risks", "intro")[0] || SECTION_SUBS.risks, secK("risks"), "risks");
      var watch = ((b.lists || {}).watchlist || []).map(function (x) { return "<li>" + esc(x.item || x) + "</li>"; }).join("");
      d.add({ hdr: h7, src: src(b, "risks"), body: "<h2>Top risks: " + esc(b.meta.place || "") + "</h2><div class='cols lg c" + Math.min(3, risks.length) + "' style='flex:0 0 auto'>" + risks.map(function (p) { return "<div class='pt'><h3><span class='n'>" + String(p.n || "").padStart(2, "0") + "</span>" + esc(p.title) + "</h3>" + (p.kpi ? "<div class='kpi' style='margin-bottom:2mm'><div class='v' style='font-size:22pt'>" + esc(code(b, c, p.kpi)) + "</div><div class='l'>" + esc(p.kpiLabel || "") + "</div></div>" : "") + "<p class='small'>" + esc(p.text) + "</p>" + (p.mitigate ? "<div class='mit'><b>How we reduce it</b>" + esc(p.mitigate) + "</div>" : "") + "</div>"; }).join("") + "</div>" + (watch ? "<div class='foot'><div class='box'><b class='t'>Also on the watch list</b><ul class='small'>" + watch + "</ul></div></div>" : "") });
    }

    /* ---- rivals ---- */
    var rivals = (b.rivals || []).filter(function (r) { return isFinite(r.price); });
    if (rivals.length || (b.openings || []).length) {
      var h8 = d.section("rivals", "Competitive landscape", copy(b, "rivals", "intro")[0] || SECTION_SUBS.rivals, secK("rivals"), "rivals");
      var occTxt = function (r) { return r.occLow != null ? r.occLow + (r.occHigh != null && r.occHigh !== r.occLow ? " to " + r.occHigh : "") + "%" : "<span class='dim'>not shared</span>"; };
      var near = rivals.filter(function (r) { return r.near || r.sameBuilding; }).sort(function (p, q) { return q.price - p.price; });
      if (near.length) {
        var allRows = near.map(function (r) { return { name: r.operator, bld: r.building + (r.sameBuilding ? " <span class='tiny mut'>inside " + esc(byOpt(c, r.sameBuilding).name) + "</span>" : ""), grade: r.grade, price: r.price, occ: occTxt(r), ours: false }; }).concat(c.options.map(function (x) { return { name: "Autopilot, needed", bld: x.name, grade: (b.options.filter(function (o) { return o.id === x.id; })[0] || {}).grade || "", price: x.price, occ: "our break-even " + pc(c.breakEven), ours: true }; })).sort(function (p, q) { return q.price - p.price; });
        d.add({ hdr: h8, src: src(b, "rivals"), body: "<h2>Who sells managed offices next to our buildings</h2><div class='cols c32'><table><thead><tr><th>Operator</th><th>Building</th><th>Grade</th><th class='n'>Price a seat, a month</th><th>How full</th></tr></thead><tbody>" + allRows.map(function (r) { return "<tr" + (r.ours ? " style='background:var(--accbg)'" : "") + "><td><b>" + esc(r.name) + "</b></td><td class='small'>" + (r.ours ? esc(r.bld) : r.bld) + "</td><td>" + esc(r.grade || "") + "</td><td class='n'>" + R(r.price) + "</td><td class='small'>" + r.occ + "</td></tr>"; }).join("") + "</tbody></table><div>" + means(b, "rivals") + "</div></div>" });
      }
      var corridor = rivals.filter(function (r) { return !(r.near || r.sameBuilding); });
      if (corridor.length) {
        var groups = {}; corridor.forEach(function (r) { (groups[r.locality || "Other"] = groups[r.locality || "Other"] || []).push(r); });
        var gk = Object.keys(groups).sort(function (p, q) { return groups[q].length - groups[p].length; });
        d.add({ hdr: h8, src: src(b, "corridor"), body: "<h2>The wider corridor: " + corridor.length + " more centres</h2><p class='small mut'>Prices per seat a month, plus taxes. Grouped by locality, dearest first.</p><div class='pts' style='grid-template-columns:1fr 1fr 1fr;gap:3mm 6mm;flex:0 0 auto'>" + gk.map(function (k) { var rows = groups[k].slice().sort(function (p, q) { return q.price - p.price; }); return "<div class='grp'><div class='t tiny' style='letter-spacing:.1em;text-transform:uppercase;color:var(--acc);font-weight:600'>" + esc(k) + " · " + rows.length + " centre" + (rows.length === 1 ? "" : "s") + " · middle " + R(median(rows.map(function (r) { return r.price; }))) + "</div><table class='ladder'><tbody>" + rows.map(function (r) { return "<tr><td class='small'><b>" + esc(r.operator) + "</b></td><td class='tiny mut'>" + esc(r.building || "building not named") + (r.grade && r.grade !== "A" ? " · " + esc(r.grade) : "") + "</td><td class='n small'>" + R(r.price) + "</td><td class='tiny mut'>" + occTxt(r) + "</td></tr>"; }).join("") + "</tbody></table></div>"; }).join("") + "</div>" });
      }
      if ((b.openings || []).length) {
        var seatsSum = b.openings.reduce(function (s, o) { return s + (isFinite(o.seats) ? o.seats : 0); }, 0), noSeats = b.openings.filter(function (o) { return !isFinite(o.seats); }).length;
        var oursOpen = c.options.map(function (x) { return fmt(x.seats) + " at " + x.name; }).join(" or ");
        d.add({ hdr: h8, src: src(b, "openings"), body: "<h2>More operators are opening here every year</h2><div class='cols c21'><div><table><thead><tr><th>Operator</th><th class='n'>Seats</th><th>Area</th><th>Where</th><th>When</th></tr></thead><tbody>" + b.openings.map(function (o) { return "<tr><td><b>" + esc(o.operator) + "</b>" + (o.note ? "<br><span class='tiny mut'>" + esc(o.note) + "</span>" : "") + "</td><td class='n'>" + (isFinite(o.seats) ? fmt(o.seats) : "<span class='dim'>n/p</span>") + "</td><td class='small'>" + esc(o.area || "") + "</td><td class='small'>" + esc(o.building || "") + "</td><td class='small'>" + esc(o.when || "") + "</td></tr>"; }).join("") + "<tr style='background:var(--accbg)'><td><b>Autopilot (us)</b></td><td class='n'>" + esc(oursOpen) + "</td><td class='small'>planned</td><td></td><td></td></tr></tbody></table></div><div><div class='kpi' style='margin-bottom:4mm'><div class='v'>" + fmt(seatsSum) + "+</div><div class='l'>seats we could count, in " + (b.openings.length - noSeats) + " centres" + (noSeats ? ", plus " + noSeats + " site" + (noSeats === 1 ? "" : "s") + " with no seat count" : "") + "</div></div>" + means(b, "openings") + "</div></div>" });
      }
      var withOcc = rivals.filter(function (r) { return r.occLow != null; });
      if (withOcc.length) {
        var bands = {}; withOcc.forEach(function (r) { var k = r.occLow + " to " + (r.occHigh || r.occLow) + "%"; (bands[k] = bands[k] || []).push(r); });
        var bk = Object.keys(bands).sort(function (p, q) { return parseInt(p, 10) - parseInt(q, 10); });
        var above = withOcc.filter(function (r) { return (r.occLow / 100) >= c.breakEven; }).length;
        d.add({ hdr: h8, src: src(b, "occupancyRivals"), body: "<h2>How full rival centres run, and who runs fullest</h2><div class='cols c32'><div><div class='cols' style='grid-template-columns:repeat(" + bk.length + ",1fr);gap:3mm;flex:0;align-items:end'>" + bk.map(function (k) { return "<div><div class='val' style='font-family:var(--serif);font-size:16pt;text-align:center'>" + bands[k].length + "</div><div style='background:" + (parseInt(k, 10) / 100 >= c.breakEven ? COLORS[2] : COLORS[1]) + ";height:" + Math.min(42, 4 + bands[k].length * 2.8) + "mm;border-radius:3px;opacity:.85'></div><div class='tiny mut' style='text-align:center;margin-top:1mm'><b>" + esc(k) + " full</b></div><div class='who'>" + bands[k].map(function (r) { return esc(r.operator + (r.building ? " · " + r.building : "")); }).join("<br>") + "</div></div>"; }).join("") + "</div></div><div><div class='kpis' style='margin:0 0 3mm'>" + kpi(above + " of " + withOcc.length, "above our break-even of " + pc(c.breakEven), "none reports more than " + Math.max.apply(null, withOcc.map(function (r) { return r.occHigh || r.occLow; })) + "%") + "</div>" + means(b, "occupancyRivals") + "</div></div>" });
      }
      d.add({ hdr: h8, src: src(b, "ladder"), body: "<h2>Where we sit on the price ladder</h2><div class='t tiny mut' style='letter-spacing:.1em;text-transform:uppercase'>Each dot is one rival centre (" + rivals.length + "), stacked in " + sym + "2,000 bands · price a seat a month, plus taxes · ringed = inside one of our buildings</div>" + ladder(b, c) + "<div class='cols c2' style='margin-top:3mm;flex:0 0 auto'><div class='box'><b class='t'>Why this matters</b><span class='small'>" + esc(rivals.filter(function (r) { return r.price <= median(rivals.map(function (x) { return x.price; })); }).length + " of " + rivals.length + " centres sell at " + R(median(rivals.map(function (x) { return x.price; }))) + " or less.") + " " + c.options.map(function (x) { return x.name + " is dearer than " + rivals.filter(function (r) { return r.price < x.price; }).length + " of them"; }).join("; ") + ".</span></div>" + means(b, "ladder") + "</div>" });
    }

    /* ---- decision ---- */
    if ((b.decision || []).length || copy(b, "decision", "read").length) {
      var h9 = d.section("decision", "The decision", SECTION_SUBS.decision, secK("decision"), "back");
      var dec = (b.decision || []).map(function (q) {
        var cells = c.options.map(function (x) {
          var typed = (q.answers || {})[x.id];
          if (typed) return typed;
          switch (q.code) {
            case "seats": return fmt(x.seats); case "cost": return L(x.total) + " a month"; case "fitout": return Cr(x.fitout); case "price": return R(x.price);
            case "profit": return L(x.profitFull); case "breakEven": return pc(x.breakEven); case "commitment": return Cr(x.commitment);
            case "walk": var m = (b.access || []).filter(function (r) { return r.option === x.id && r.mode === "metro"; }).sort(function (p, q2) { return p.distanceM - q2.distanceM; })[0]; return m ? m.distanceM + " m · " + walk(m.distanceM, a) + " min" : "";
            default: return "";
          }
        });
        return "<tr><td><b>" + esc(q.question) + "</b></td>" + cells.map(function (t) { return "<td class='small'>" + esc(t) + "</td>"; }).join("") + "<td>" + (q.edge ? "<span class='edge" + (q.edge === "level" ? " level" : "") + "'>" + esc(q.edge === "level" ? "level" : byOpt(c, q.edge).name) + "</span>" : "") + "</td></tr>";
      });
      var score = c.options.map(function (x) { return (b.decision || []).filter(function (q) { return q.edge === x.id; }).length; });
      var questions = ((b.lists || {}).questions || []).map(function (x) { return "<li>" + esc(x.item || x) + "</li>"; }).join("");
      d.add({ hdr: h9, src: src(b, "decision"), body: "<h2>The decision on one page</h2><div class='cols c32'><div><table><thead><tr><th>Question</th>" + names.map(function (n) { return "<th>" + esc(n) + "</th>"; }).join("") + "<th>Edge</th></tr></thead><tbody>" + dec.join("") + ((b.decision || []).length ? "<tr class='sum'><td>Score</td>" + score.map(function (s) { return "<td>" + s + " edge" + (s === 1 ? "" : "s") + "</td>"; }).join("") + "<td></td></tr>" : "") + "</tbody></table></div><div>" + (copy(b, "decision", "read").length ? "<div class='means'><b>Our read</b>" + copy(b, "decision", "read").map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>" : "") + (questions ? "<div class='box' style='margin-top:3mm'><b class='t'>Open questions</b><ul class='small'>" + questions + "</ul></div>" : "") + "</div></div>" });
    }

    /* ---- back ---- */
    var backK = (b.kpis || []).filter(function (k) { return k.section === "back"; });
    d.add({ cls: "dark", noHdr: true, body: img(b, "back") + '<div class="over"><h1 style="font-size:28pt;max-width:220mm;margin-top:auto">' + nl(b.meta.backTitle || b.meta.title) + '</h1><div class="kpis" style="margin-top:8mm">' + backK.map(kp).join("") + '</div><p class="tiny mut" style="margin-top:8mm">' + esc(b.meta.credits || "") + (b.meta.by ? " · " + esc(b.meta.by) : "") + "</p></div>" });

    /* ---- contents, now that the pages are numbered ---- */
    var readFirst = copy(b, "readFirst", "intro");
    d.pages[tocIndex - 1].body = "<h2>What is inside</h2><div class='cols c21'><div class='toc'>" + d.toc.map(function (t) { return "<div class='row'><span class='n'>" + t.n + "</span><span class='t'><b>" + esc(t.title) + "</b><span>" + esc(t.sub) + "</span></span><span class='p'>" + t.page + "</span></div>"; }).join("") + "</div><div>" + (readFirst.length ? "<div class='box'><b class='t'>Read this first: " + (["one", "two", "three", "four", "five"][readFirst.length - 1] || readFirst.length) + " things the numbers say</b>" + readFirst.map(function (t) { return "<p class='small'>" + esc(t) + "</p>"; }).join("") + "</div>" : "") + (b.meta.credits ? "<p class='tiny mut' style='margin-top:4mm'>" + esc(b.meta.credits) + "</p>" : "") + "</div></div>";

    /* ---- out ---- */
    var html = d.pages.map(function (p, i) {
      var n = i + 1;
      return '<section class="page ' + (p.cls || "") + '" data-page="' + n + '">' + (p.noHdr ? "" : '<div class="hdr"><b>' + esc(d.hdrText) + "</b><span>" + esc(p.hdr || "") + "</span></div>") + '<div class="body">' + p.body + "</div>" + (p.noHdr && !p.sec ? "" : '<div class="ftr"><span class="src">' + (p.src ? "Source: " + esc(p.src) : "") + '</span><span class="num">' + n + "</span></div>") + "</section>";
    }).join("");
    if (mount) mount.innerHTML = html;
    return { html: html, pages: d.pages.length, toc: d.toc, costing: c };
  }

  return { render: render, charts: { lineChart: lineChart, barChart: barChart, hbars: hbars, stacked: stacked, ladder: ladder, occScale: occScale } };
});
