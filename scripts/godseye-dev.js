/* Local runner for God's Eye: serves the static site and mounts the
   /api/godseye/* handlers the same way Vercel does, so the whole thing can be
   tried before deploying.

     ANTHROPIC_API_KEY=... GODSEYE_ACCESS_KEY=... npm run godseye
     then open http://localhost:8090/godseye/                              */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.PORT || 8090;
const ROUTES = {
  "/api/godseye/feed": require("../api/godseye/feed.js"),
  "/api/godseye/ask": require("../api/godseye/ask.js"),
};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".md": "text/plain" };

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
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
  });
}).listen(PORT, () => console.log(`God's Eye at http://localhost:${PORT}/godseye/`));
