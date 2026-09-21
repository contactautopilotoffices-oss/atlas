/* ATLAS client routing manifest.
   Demo ID + password are looked up here; the matching client's config/data/geo
   files are loaded after a successful login. This keeps the public URL clean:
   anyone can be sent atlas.autopilotoffices.com and will be routed by their
   own credentials. */
window.CLIENT_MANIFEST = {
  "FLIPDEMOACC": { slug: "flipkart-andheri", pass: "FLIP1234" },
  "VFSDEMOACC":  { slug: "vfs-bkc",          pass: "VFS1234" },
  "CPDEMOACC":   { slug: "cp-delhi",         pass: "CP1234" },
  "INVDEMOACC":  { slug: "invesco-andheri",  pass: "INV1234" },
  "FLYDEMOACC":  { slug: "basilic-fly",      pass: "FLY1234" },  // PLACEHOLDER pass — rotate before deploy (real one supplied out of band)
  "DIGDEMOACC":  { slug: "digitide-noida",   pass: "DIG1234" }   // PLACEHOLDER pass — rotate before deploy
};
/* The Digitide GROUP command centre (pan-India portfolio view) is a separate
   app at /digitide/ with its own gate — DIGGRPACC, defined in digitide/app.js.
   It is not routed through this manifest because it is not a mapbox_app client. */
