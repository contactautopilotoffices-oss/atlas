/* Renders the hex field backdrop for the Chennai sign-in page.

   The image is the study area itself: Chennai drawn as a field of hexagons
   (one cell for every 750 m), the Bay of Bengal left dark, the rail
   lines traced in their colours, and the cells lit by the nineteen
   shortlisted buildings and the current office. Every position comes from
   chennai/data.js, so the backdrop matches the map behind the gate.

   The output is committed to media/chennai/, so the sign-in page never
   depends on an outside service for its backdrop. Re-run after the
   shortlist changes:

     NODE_PATH=$(npm root -g) node scripts/render-chennai-hexfield.js

   Needs Playwright and Python with Pillow (for the WebP and JPEG copies). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "media", "chennai");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "chennai", "data.js"), "utf8"), ctx);
const W = ctx.window;
const data = {
  options: W.CHN_OPTIONS.map(o => ({ lat: o.lat, lng: o.lng, color: W.CHN_ZONES.find(z => z.key === o.micro).color })),
  existing: { lat: W.CHN_EXISTING.lat, lng: W.CHN_EXISTING.lng },
  lines: W.CHN_TRANSIT.lines.map(L => ({ color: L.color, stations: L.stations.map(s => ({ lat: s.lat, lng: s.lng, open: !!s.open })) }))
};

/* Approximate Chennai coastline, north to south (lat, lng). Only used to
   leave the sea dark; a few hundred metres either way does not show. */
const COAST = [[13.30, 80.330], [13.20, 80.316], [13.12, 80.298], [13.08, 80.290], [13.05, 80.283], [13.02, 80.277],
  [13.00, 80.272], [12.98, 80.266], [12.95, 80.259], [12.92, 80.254], [12.88, 80.250], [12.84, 80.247], [12.78, 80.246], [12.70, 80.240]];

function page(spec) {
  return `<!doctype html><html><body style="margin:0;background:#120c08"><canvas id="c" width="${spec.w}" height="${spec.h}"></canvas><script>
  const D = ${JSON.stringify(data)}, COAST = ${JSON.stringify(COAST)}, SPEC = ${JSON.stringify(spec)};
  const c = document.getElementById("c"), g = c.getContext("2d"), Wd = SPEC.w, Hd = SPEC.h;
  const KM_LAT = 110.6, KM_LNG = 111.32 * Math.cos(12.98 * Math.PI / 180);
  /* The ground plane is tilted (north squeezed by TILT) and cells rise
     straight up, so the field reads in 2.5D like a hexbin map. */
  const pxKm = SPEC.pxKm, TILT = SPEC.tilt, [cx, cy] = SPEC.centre, [clng, clat] = SPEC.geo;
  const toXY = (lng, lat) => [cx + (lng - clng) * KM_LNG * pxKm, cy - (lat - clat) * KM_LAT * pxKm * TILT];
  const toGeo = (x, y) => [clng + (x - cx) / pxKm / KM_LNG, clat - (y - cy) / (pxKm * TILT) / KM_LAT];
  const coastLng = (lat) => { for (let i = 0; i < COAST.length - 1; i++) { const [a, al] = COAST[i], [b, bl] = COAST[i + 1]; if (lat <= a && lat >= b) return al + (bl - al) * (lat - a) / (b - a); } return 80.3; };
  const km = (a, b) => Math.hypot((a[0] - b[0]) * KM_LNG, (a[1] - b[1]) * KM_LAT);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  /* background */
  const bg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(Wd, Hd) * .85);
  bg.addColorStop(0, "#3a2a1f"); bg.addColorStop(.5, "#22180f"); bg.addColorStop(1, "#100b07");
  g.fillStyle = bg; g.fillRect(0, 0, Wd, Hd);
  /* fields: heat from the shortlist and the current office; a soft city
     field so every land cell has some light */
  const heat = (lng, lat) => {
    let h = 0;
    for (const o of D.options) { const d = km([lng, lat], [o.lng, o.lat]); h += Math.exp(-((d / 1.5) ** 2)); }
    const de = km([lng, lat], [D.existing.lng, D.existing.lat]); h += .9 * Math.exp(-((de / 1.2) ** 2));
    return Math.min(1.3, h);
  };
  const railNear = (lng, lat) => { let m = 9; for (const L of D.lines) for (const s of L.stations) if (s.open) m = Math.min(m, km([lng, lat], [s.lng, s.lat])); return Math.exp(-((m / .9) ** 2)); };
  const city = (lng, lat) => Math.exp(-((km([lng, lat], [80.22, 13.0]) / 20) ** 2));
  const nearestOpt = (lng, lat) => { let best = null, bd = 1e9; for (const o of D.options) { const d = km([lng, lat], [o.lng, o.lat]); if (d < bd) { bd = d; best = o; } } return best; };
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, k))));
  const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const css = (a, al) => "rgba(" + a.join(",") + "," + al.toFixed(3) + ")";
  /* pointy-top hex grid in ground (km) space */
  const cellKm = SPEC.cellKm, R = cellKm / Math.sqrt(3), HW = cellKm, VH = 1.5 * R;
  const corners = (lng, lat, k) => { const out = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30);
    out.push(toXY(lng + k * R * Math.cos(a) / KM_LNG, lat - k * R * Math.sin(a) / KM_LAT)); } return out; };
  const poly = (pts, dy = 0) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y - dy) : g.moveTo(x, y - dy)); g.closePath(); };
  const [gx0, gy0] = toGeo(-80, Hd + 200), [gx1, gy1] = toGeo(Wd + 80, -200);
  const cells = [];
  for (let row = 0, lat = gy0; lat < gy1; row++, lat = gy0 + row * VH / KM_LAT) {
    for (let col = 0, lng = gx0; lng < gx1; col++, lng = gx0 + (col * HW + (row & 1 ? HW / 2 : 0)) / KM_LNG) {
      const sea = lng > coastLng(lat);
      cells.push({ lng, lat, sea, h: sea ? 0 : heat(lng, lat), r: sea ? 0 : railNear(lng, lat), cty: city(lng, lat), n: rnd() });
    }
  }
  /* 1. sea: faint cool outlines */
  for (const k of cells) if (k.sea) { poly(corners(k.lng, k.lat, .9)); g.strokeStyle = css([110, 150, 170], .07 + k.n * .04); g.lineWidth = 1; g.stroke(); }
  /* 2. land floor: every cell drawn, lit by city density and a little noise */
  for (const k of cells) {
    if (k.sea) continue;
    const base = .08 + k.cty * .12 + k.n * .06 + k.r * .12;
    poly(corners(k.lng, k.lat, .9));
    g.fillStyle = css(mix([60, 44, 33], [140, 90, 60], k.cty + k.r), base); g.fill();
    g.strokeStyle = css([233, 180, 143], .12 + k.cty * .12 + k.r * .16); g.lineWidth = 1; g.stroke();
  }
  /* 3. rail on the ground */
  g.lineCap = "round"; g.lineJoin = "round";
  for (const L of D.lines) for (let i = 0; i < L.stations.length - 1; i++) {
    const a = L.stations[i], b = L.stations[i + 1], open = a.open && b.open;
    const [x1, y1] = toXY(a.lng, a.lat), [x2, y2] = toXY(b.lng, b.lat);
    g.save(); g.setLineDash(open ? [] : [10, 9]); g.strokeStyle = L.color; g.globalAlpha = open ? .75 : .45;
    g.lineWidth = open ? 3.2 : 2.2; g.shadowColor = L.color; g.shadowBlur = open ? 14 : 0;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
  }
  /* 4. columns: cells near the shortlist rise; back to front */
  const H = SPEC.towerPx;
  const cols = cells.filter(k => !k.sea && k.h > .12).sort((a, b) => b.lat - a.lat);
  for (const k of cols) {
    const t = Math.min(1, k.h), o = nearestOpt(k.lng, k.lat), tint = mix([200, 105, 58], rgb(o.color), .45);
    const top = mix([90, 60, 42], tint, t * 1.2), side = top.map(v => Math.round(v * .5));
    const pts = corners(k.lng, k.lat, .9), dh = H * (t ** 1.6) * (.85 + k.n * .3);
    /* the two front faces (between the lower corners) */
    for (const [i, j] of [[0, 1], [1, 2]]) {
      g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); g.lineTo(pts[j][0], pts[j][1] - dh); g.lineTo(pts[i][0], pts[i][1] - dh); g.closePath();
      g.fillStyle = css(i === 0 ? side : side.map(v => Math.round(v * .8)), .55 + t * .4); g.fill();
    }
    poly(pts, dh); g.fillStyle = css(top, .35 + t * .6); g.fill();
    g.strokeStyle = css([247, 226, 207], .12 + t * .5); g.lineWidth = 1; g.stroke();
  }
  /* 5. the shortlist: the tallest, brightest cells; the current office as a cream column */
  const towers = D.options.map(o => ({ ...o, me: false })).concat([{ ...D.existing, color: "#f7f2ea", me: true }]).sort((a, b) => b.lat - a.lat);
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
    /* a light beam above each, fading up */
    const [bx, by] = toXY(o.lng, o.lat), grd = g.createLinearGradient(bx, by - dh, bx, by - dh - H * 1.3);
    grd.addColorStop(0, css(mix(col, [255, 255, 255], .4), .35)); grd.addColorStop(1, css(col, 0));
    g.fillStyle = grd; g.fillRect(bx - 1.5, by - dh - H * 1.3, 3, H * 1.3);
  }
  /* vignette and grain */
  const v = g.createRadialGradient(cx, cy, Math.min(Wd, Hd) * .3, cx, cy, Math.max(Wd, Hd) * .8);
  v.addColorStop(0, "rgba(10,7,5,0)"); v.addColorStop(1, "rgba(10,7,5,.72)");
  g.fillStyle = v; g.fillRect(0, 0, Wd, Hd);
  const img = g.getImageData(0, 0, Wd, Hd), px = img.data;
  for (let i = 0; i < px.length; i += 4) { const n = (rnd() - .5) * 9; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
  g.putImageData(img, 0, 0);
  document.title = "done";
  </script></body></html>`;
}

const SPECS = [
  /* Wide: the shortlist sits right of centre, between the copy and the card. */
  { name: "hexfield-wide", w: 2400, h: 1350, pxKm: 46, tilt: .62, cellKm: .75, towerPx: 70, centre: [1180, 760], geo: [80.18, 12.955] },
  /* Tall (phones): the map fills the top half, above the stacked copy and card. */
  { name: "hexfield-tall", w: 1080, h: 2000, pxKm: 44, tilt: .62, cellKm: .75, towerPx: 64, centre: [560, 700], geo: [80.18, 12.955] }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const spec of SPECS) {
    const p = await browser.newPage({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: 1 });
    p.on("pageerror", e => console.error("pageerror", e.message)); p.on("console", m => console.log("console", m.text()));
    await p.setContent(page(spec));
    await p.waitForFunction(() => document.title === "done", null, { timeout: 60000 });
    const png = path.join(OUT, spec.name + ".png");
    await p.locator("#c").screenshot({ path: png });
    execFileSync("python3", ["-I", "-c", `
import sys
from PIL import Image
src, base = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im.save(base + ".webp", "WEBP", quality=78, method=6)
im.save(base + ".jpg", "JPEG", quality=80, optimize=True, progressive=True)
`, png, path.join(OUT, spec.name)]);
    fs.unlinkSync(png);
    console.log("rendered", spec.name);
    await p.close();
  }
  await browser.close();
})();
