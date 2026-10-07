/* Local runner for the whole site with every API route mounted the way
   Vercel mounts them: God's Eye and the CMS (admin panel, broker links,
   visit tracking, published overrides).

     npm run dev:cms
     then open http://localhost:8090/admin/

   With no Supabase settings the CMS keeps its data in a local JSON file
   (CMS_DEV_STORE, default .cms-dev-store.json, git-ignored). The first
   admin is created with the setup key "dev-setup".                         */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.CMS_DEV_STORE) process.env.CMS_DEV_STORE = path.join(ROOT, ".cms-dev-store.json");
const PORT = +process.env.PORT || 8090;
const ROUTES = {
  "/api/godseye/feed": () => require("../api/godseye/feed.js"),
  "/api/godseye/ask": () => require("../api/godseye/ask.js"),
  "/api/cms": () => require("../api/cms/index.js"),
  "/api/cms/config": () => require("../api/cms/config.js"),
  "/api/cms/track": () => require("../api/cms/track.js"),
};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".md": "text/plain" };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = ROUTES[url.pathname.replace(/\/$/, "")];
  if (route) return route()(req, res);
  if (url.pathname.startsWith("/api/")) { res.statusCode = 404; return res.end(); }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT) || /[\\/]\.cms-dev-store\.json$/.test(file)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.pathname.endsWith("/")) { res.statusCode = 308; res.setHeader("Location", url.pathname + "/" + url.search); return res.end(); }
    file = path.join(file, "index.html");
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
  });
}).listen(PORT, () => console.log(`ATLAS at http://localhost:${PORT}/  ·  admin at http://localhost:${PORT}/admin/`));
