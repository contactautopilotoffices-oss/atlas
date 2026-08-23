#!/usr/bin/env node
/* ATLAS media ingest — archives -> media/<propertyId>/ + data/media-manifest.json
   Rules: dedupe by CONTENT HASH (filenames are meaningless UUIDs and carry ` 2`
   duplicate suffixes), never trust extensions, record native dimensions so the
   gallery can lay out mixed portrait/landscape without cropping facades. */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { execSync } = require("child_process");

const SRC = process.argv[2];
const OUT = path.join(__dirname, "..", "media");
const MANIFEST = path.join(__dirname, "..", "data", "media-manifest.json");

// archive folder name -> property id in clients/basilic-fly/data.js
const MAP = {
  "Star mark Camelot": "starmark",
  "Primeco union city": "primeco",
  "Sumadhura Capitol": "sumadhura",
};

const IMG = /\.(jpe?g|png|heic)$/i, VID = /\.(mp4|mov|m4v)$/i;

function dims(f) {
  try {
    const o = execSync(`sips -g pixelWidth -g pixelHeight ${JSON.stringify(f)} 2>/dev/null`).toString();
    const w = +(o.match(/pixelWidth:\s*(\d+)/) || [])[1];
    const h = +(o.match(/pixelHeight:\s*(\d+)/) || [])[1];
    return w && h ? { w, h } : null;
  } catch { return null; }
}

const manifest = {};
for (const [folder, pid] of Object.entries(MAP)) {
  const dir = path.join(SRC, folder);
  if (!fs.existsSync(dir)) { console.log(`skip ${folder} (not found)`); continue; }

  const seen = new Map();          // hash -> record
  const files = fs.readdirSync(dir)
    .filter(f => !f.startsWith(".") && !f.includes("__MACOSX"))
    .map(f => path.join(dir, f))
    .filter(f => fs.statSync(f).isFile());

  for (const f of files) {
    const buf = fs.readFileSync(f);
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
    if (seen.has(hash)) continue;                    // exact duplicate, drop silently
    const isImg = IMG.test(f), isVid = VID.test(f);
    if (!isImg && !isVid) continue;                  // extensionless siblings -> drop
    seen.set(hash, { hash, src: f, kind: isImg ? "photo" : "video", bytes: buf.length });
  }

  const outDir = path.join(OUT, pid);
  fs.mkdirSync(outDir, { recursive: true });
  const recs = [];
  let n = 0;
  for (const r of seen.values()) {
    const ext = r.kind === "photo" ? ".jpg" : path.extname(r.src).toLowerCase();
    const name = `${pid}-${String(++n).padStart(2, "0")}-${r.hash.slice(0, 8)}${ext}`;
    const dest = path.join(outDir, name);
    fs.copyFileSync(r.src, dest);
    const d = r.kind === "photo" ? dims(dest) : null;
    recs.push({
      file: `media/${pid}/${name}`,
      kind: r.kind,
      hash: r.hash,
      bytes: r.bytes,
      width: d?.w ?? null,
      height: d?.h ?? null,
      orientation: d ? (d.w > d.h ? "landscape" : d.w < d.h ? "portrait" : "square") : null,
      source: "Supplied by Autopilot Offices, origin unstated",
      captured_at: null,
      confidence: "unconfirmed",
      confirmations: ["supplied-by-client"],
    });
  }
  recs.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "photo" ? -1 : 1));
  manifest[pid] = recs;
  const p = recs.filter(r => r.kind === "photo").length, v = recs.length - p;
  console.log(`${pid.padEnd(10)} ${String(p).padStart(2)} photos  ${String(v).padStart(2)} videos  (${files.length} raw -> ${recs.length} unique)`);
}

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log("\nmanifest -> data/media-manifest.json");
