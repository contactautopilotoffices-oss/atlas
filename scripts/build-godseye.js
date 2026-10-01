/* Bundles the God's Eye React app (godseye/src) into godseye/dist/app.js.
   Runs in `npm run build` on Vercel and before `npm run godseye` locally. */
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
esbuild.build({
  entryPoints: [path.join(root, "godseye/src/main.jsx")],
  outfile: path.join(root, "godseye/dist/app.js"),
  bundle: true,
  minify: true,
  sourcemap: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  loader: { ".js": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
}).catch(() => process.exit(1));
