#!/usr/bin/env node
/* Renders the hex-field backdrop for a study's sign-in page: the study area
   as a field of hexagons (one per 750 m), rail traced in its colours, and
   tall glowing cells at every shortlisted building and today's office.
   Every position comes from the study's data.js, so the backdrop matches
   the map behind the gate.

     NODE_PATH=$(npm root -g) node render_backdrop.js path/to/study-folder

   Writes media/hexfield-wide.(webp|jpg) and media/hexfield-tall.(webp|jpg)
   inside the folder. Needs Playwright with Chromium; nothing else.

   Optional, in data.js meta.backdrop:
     sea:   "east" | "west" | "north" | "south"   which side of the coast is water
     coast: [[lat, lng], ...]                     the coastline, in order
   Without them every cell is land, which suits an inland city. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { chromium } = require("playwright");

const DIR = path.resolve(process.argv[2] || ".");
const OUT = path.join(DIR, "media");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(DIR, "data.js"), "utf8"), ctx);
const W = ctx.window, M = W.ATLAS_META, EX = W.ATLAS_EXISTING;
const FITS = M.fits || { best: { color: "#2e7d5b" }, value: { color: "#b7791f" }, conditional: { color: "#7b6a5c" } };
const zoneColor = (k) => ((W.ATLAS_ZONES || []).find(z => z.key === k) || {}).color || "#a3502c";
const data = {
  options: W.ATLAS_OPTIONS.map(o => ({ lat: o.lat, lng: o.lng, color: (FITS[o.fit] || {}).color || zoneColor(o.micro) })),
  existing: EX ? { lat: EX.lat, lng: EX.lng } : null,
  lines: (W.ATLAS_TRANSIT.lines || []).map(L => ({ color: L.color, stations: L.stations.map(s => ({ lat: s.lat, lng: s.lng, open: !!s.open })) })),
  city: M.center, bd: M.backdrop || {}
};
/* Frame: the shortlist's centre, scaled so its spread fills about half the
   picture whatever the city. */
const pts = data.options.concat(data.existing ? [data.existing] : []);
const geo = [pts.reduce((t, p) => t + p.lng, 0) / pts.length, pts.reduce((t, p) => t + p.lat, 0) / pts.length];
const KM_LNG = 111.32 * Math.cos(geo[1] * Math.PI / 180), KM_LAT = 110.6;
const spanX = Math.max(4, ...pts.map(p => Math.abs(p.lng - geo[0]) * KM_LNG * 2));
const spanY = Math.max(4, ...pts.map(p => Math.abs(p.lat - geo[1]) * KM_LAT * 2));

function page(spec) {
  return `<!doctype html><html><body style="margin:0;background:#120c08"><canvas id="c" width="${spec.w}" height="${spec.h}"></canvas><script>
  const D = ${JSON.stringify(data)}, SPEC = ${JSON.stringify(spec)};
  const c = document.getElementById("c"), g = c.getContext("2d"), Wd = SPEC.w, Hd = SPEC.h;
  const KM_LAT = ${KM_LAT}, KM_LNG = ${KM_LNG};
  const pxKm = SPEC.pxKm, TILT = SPEC.tilt, [cx, cy] = SPEC.centre, [clng, clat] = SPEC.geo;
  const toXY = (lng, lat) => [cx + (lng - clng) * KM_LNG * pxKm, cy - (lat - clat) * KM_LAT * pxKm * TILT];
  const toGeo = (x, y) => [clng + (x - cx) / pxKm / KM_LNG, clat - (y - cy) / (pxKm * TILT) / KM_LAT];
  const km = (a, b) => Math.hypot((a[0] - b[0]) * KM_LNG, (a[1] - b[1]) * KM_LAT);
  /* sea: the coast as a polyline; cells past it on the sea side stay dark */
  const COAST = D.bd.coast || null, SEA = D.bd.sea || null;
  const along = (t, i0, i1) => { for (let i = 0; i < COAST.length - 1; i++) { const a = COAST[i][i0], b = COAST[i + 1][i0];
    if ((t <= a && t >= b) || (t >= a && t <= b)) return COAST[i][i1] + (COAST[i + 1][i1] - COAST[i][i1]) * (t - a) / ((b - a) || 1); } return null; };
  const isSea = (lng, lat) => {
    if (!COAST || !SEA) return false;
    if (SEA === "east" || SEA === "west") { const x = along(lat, 0, 1); return x != null && (SEA === "east" ? lng > x : lng < x); }
    const y = along(lng, 1, 0); return y != null && (SEA === "north" ? lat > y : lat < y);
  };
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(Wd, Hd) * .85);
  bg.addColorStop(0, "#3a2a1f"); bg.addColorStop(.5, "#22180f"); bg.addColorStop(1, "#100b07");
  g.fillStyle = bg; g.fillRect(0, 0, Wd, Hd);
  const heat = (lng, lat) => {
    let h = 0;
    for (const o of D.options) { const d = km([lng, lat], [o.lng, o.lat]); h += Math.exp(-((d / 1.5) ** 2)); }
    if (D.existing) { const de = km([lng, lat], [D.existing.lng, D.existing.lat]); h += .9 * Math.exp(-((de / 1.2) ** 2)); }
    return Math.min(1.3, h);
  };
  const railNear = (lng, lat) => { let m = 9; for (const L of D.lines) for (const s of L.stations) if (s.open) m = Math.min(m, km([lng, lat], [s.lng, s.lat])); return Math.exp(-((m / .9) ** 2)); };
  const city = (lng, lat) => Math.exp(-((km([lng, lat], D.city) / 20) ** 2));
  const nearestOpt = (lng, lat) => { let best = null, bd = 1e9; for (const o of D.options) { const d = km([lng, lat], [o.lng, o.lat]); if (d < bd) { bd = d; best = o; } } return best; };
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, k))));
  const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const css = (a, al) => "rgba(" + a.join(",") + "," + al.toFixed(3) + ")";
  const cellKm = SPEC.cellKm, R = cellKm / Math.sqrt(3), HW = cellKm, VH = 1.5 * R;
  const corners = (lng, lat, k) => { const out = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30);
    out.push(toXY(lng + k * R * Math.cos(a) / KM_LNG, lat - k * R * Math.sin(a) / KM_LAT)); } return out; };
  const poly = (pts, dy = 0) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y - dy) : g.moveTo(x, y - dy)); g.closePath(); };
  const [gx0, gy0] = toGeo(-80, Hd + 200), [gx1, gy1] = toGeo(Wd + 80, -200);
  const cells = [];
  for (let row = 0, lat = gy0; lat < gy1; row++, lat = gy0 + row * VH / KM_LAT) {
    for (let col = 0, lng = gx0; lng < gx1; col++, lng = gx0 + (col * HW + (row & 1 ? HW / 2 : 0)) / KM_LNG) {
      const sea = isSea(lng, lat);
      cells.push({ lng, lat, sea, h: sea ? 0 : heat(lng, lat), r: sea ? 0 : railNear(lng, lat), cty: city(lng, lat), n: rnd() });
    }
  }
  for (const k of cells) if (k.sea) { poly(corners(k.lng, k.lat, .9)); g.strokeStyle = css([110, 150, 170], .07 + k.n * .04); g.lineWidth = 1; g.stroke(); }
  for (const k of cells) {
    if (k.sea) continue;
    poly(corners(k.lng, k.lat, .9));
    g.fillStyle = css(mix([60, 44, 33], [140, 90, 60], k.cty + k.r), .08 + k.cty * .12 + k.n * .06 + k.r * .12); g.fill();
    g.strokeStyle = css([233, 180, 143], .12 + k.cty * .12 + k.r * .16); g.lineWidth = 1; g.stroke();
  }
  g.lineCap = "round"; g.lineJoin = "round";
  for (const L of D.lines) for (let i = 0; i < L.stations.length - 1; i++) {
    const a = L.stations[i], b = L.stations[i + 1], open = a.open && b.open;
    const [x1, y1] = toXY(a.lng, a.lat), [x2, y2] = toXY(b.lng, b.lat);
    g.save(); g.setLineDash(open ? [] : [10, 9]); g.strokeStyle = L.color; g.globalAlpha = open ? .75 : .45;
    g.lineWidth = open ? 3.2 : 2.2; g.shadowColor = L.color; g.shadowBlur = open ? 14 : 0;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
  }
  const H = SPEC.towerPx;
  for (const k of cells.filter(k => !k.sea && k.h > .12).sort((a, b) => b.lat - a.lat)) {
    const t = Math.min(1, k.h), o = nearestOpt(k.lng, k.lat), tint = mix([200, 105, 58], rgb(o.color), .45);
    const top = mix([90, 60, 42], tint, t * 1.2), side = top.map(v => Math.round(v * .5));
    const pts = corners(k.lng, k.lat, .9), dh = H * (t ** 1.6) * (.85 + k.n * .3);
    for (const [i, j] of [[0, 1], [1, 2]]) {
      g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); g.lineTo(pts[j][0], pts[j][1] - dh); g.lineTo(pts[i][0], pts[i][1] - dh); g.closePath();
      g.fillStyle = css(i === 0 ? side : side.map(v => Math.round(v * .8)), .55 + t * .4); g.fill();
    }
    poly(pts, dh); g.fillStyle = css(top, .35 + t * .6); g.fill();
    g.strokeStyle = css([247, 226, 207], .12 + t * .5); g.lineWidth = 1; g.stroke();
  }
  const towers = D.options.map(o => ({ ...o, me: false })).concat(D.existing ? [{ ...D.existing, color: "#f7f2ea", me: true }] : []).sort((a, b) => b.lat - a.lat);
  for (const o of towers) {
    const pts = corners(o.lng, o.lat, 1), dh = H * (o.me ? 1.25 : 1.15), col = rgb(o.color);
    g.save(); g.shadowColor = o.color; g.shadowBlur = 28;
    for (const [i, j] of [[0, 1], [1, 2]]) {
      g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); g.lineTo(pts[j][0], pts[j][1] - dh); g.lineTo(pts[i][0], pts[i][1] - dh); g.closePath();
      g.fillStyle = css(col.map(v => Math.round(v * (i === 0 ? .62 : .48))), .96); g.fill();
    }
    g.restore();
    poly(pts, dh); g.fillStyle = css(mix(col, [255, 240, 225], o.me ? .3 : .18), 1); g.fill();
    g.strokeStyle = "rgba(255,244,232,.9)"; g.lineWidth = 1.6; g.stroke();
    const [bx, by] = toXY(o.lng, o.lat), grd = g.createLinearGradient(bx, by - dh, bx, by - dh - H * 1.3);
    grd.addColorStop(0, css(mix(col, [255, 255, 255], .4), .35)); grd.addColorStop(1, css(col, 0));
    g.fillStyle = grd; g.fillRect(bx - 1.5, by - dh - H * 1.3, 3, H * 1.3);
  }
  const v = g.createRadialGradient(cx, cy, Math.min(Wd, Hd) * .3, cx, cy, Math.max(Wd, Hd) * .8);
  v.addColorStop(0, "rgba(10,7,5,0)"); v.addColorStop(1, "rgba(10,7,5,.72)");
  g.fillStyle = v; g.fillRect(0, 0, Wd, Hd);
  const img = g.getImageData(0, 0, Wd, Hd), px = img.data;
  for (let i = 0; i < px.length; i += 4) { const n = (rnd() - .5) * 9; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
  g.putImageData(img, 0, 0);
  window.OUT = { webp: c.toDataURL("image/webp", .72), jpg: c.toDataURL("image/jpeg", .76) };
  document.title = "done";
  </script></body></html>`;
}

/* Wide: the shortlist right of centre, between the copy and the card.
   Tall (phones): the map fills the top half, above the copy and card. */
const fit = (w, h, share) => Math.min(46, share * w / spanX, share * h / (spanY * .62));
const SPECS = [
  { name: "hexfield-wide", w: 1920, h: 1080, tilt: .62, cellKm: .75, towerPx: 56, centre: [944, 608], geo, pxKm: fit(1920, 1080, .5) },
  { name: "hexfield-tall", w: 864, h: 1600, tilt: .62, cellKm: .75, towerPx: 51, centre: [448, 560], geo, pxKm: fit(864, 900, .7) }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const spec of SPECS) {
    const p = await browser.newPage({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: 1 });
    p.on("pageerror", e => console.error("pageerror", e.message));
    await p.setContent(page(spec));
    await p.waitForFunction(() => document.title === "done", null, { timeout: 60000 });
    const out = await p.evaluate(() => window.OUT);
    for (const [ext, url] of Object.entries(out)) fs.writeFileSync(path.join(OUT, `${spec.name}.${ext}`), Buffer.from(url.split(",")[1], "base64"));
    console.log(`rendered ${spec.name} (${spec.pxKm.toFixed(1)} px per km)`);
    await p.close();
  }
  await browser.close();
})();
