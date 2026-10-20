/* Local runner for the Atlas guide: serves the static site and mounts
   /api/guide/ask the way Vercel does, so the study pages and their guide can
   be tried before deploying.

     ANTHROPIC_API_KEY=... node scripts/guide-dev.js
     then open http://localhost:8091/chennai/  (or /noida/, /whitefield/)    */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.PORT || 8091;
const ROUTES = { "/api/guide/ask": require("../api/guide/ask.js") };
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".md": "text/plain",
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const handler = ROUTES[url.pathname.replace(/\/$/, "")];
  if (handler) return handler(req, res);
  if (url.pathname.startsWith("/api/")) { res.statusCode = 404; return res.end(); }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
  });
}).listen(PORT, () => console.log(`Atlas guide at http://localhost:${PORT}/chennai/`));
