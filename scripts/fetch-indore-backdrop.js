/* Copies the Indore sign-in backdrop (generated with Higgsfield) into
   media/indore/ at build time, so the page serves it from this site instead
   of hotlinking Higgsfield's CDN. Never fails the build: if the download does
   not work, the page falls back to the CDN URL and then to its gradient. */
const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT = path.join(__dirname, "..", "media", "indore");
const FILES = {
  "backdrop-wide.webp": "https://d8j0ntlcm91z4.cloudfront.net/user_3Fo7i4SvZozV6ke0Djuea827rgj/hf_20260930_052823_8e4eed0a-51d0-40fb-945e-8a78aeae19fb_min.webp",
  "backdrop-tall.webp": "https://d8j0ntlcm91z4.cloudfront.net/user_3Fo7i4SvZozV6ke0Djuea827rgj/hf_20260930_052821_229f2ecc-8cb5-4c46-89f6-e033184efa7c_min.webp"
};

function get(url, dest) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(`HTTP ${res.statusCode}`); }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 1000) return resolve("too small");
        fs.writeFileSync(dest, buf); resolve(null);
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => resolve(e.message));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, url] of Object.entries(FILES)) {
    const err = await get(url, path.join(OUT, name));
    console.log(err ? `Indore backdrop ${name}: skipped (${err}); the page will use the CDN copy.` : `Indore backdrop ${name}: copied.`);
  }
})();
