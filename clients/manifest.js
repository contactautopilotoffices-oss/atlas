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
  /* Digitide Noida office study, a separate app at /noida/ with its own gate
     (it replaced the older map view of this client). Only the password's
     SHA-256 is stored, as for Indore and Chennai. */
  "DIGDEMOACC":  { redirect: "/noida/",     passHash: "62ffad2586cdaaca43fe963237ace65edc2da7627fe23c231b94e96b724a824d" },
  /* The Digitide GROUP command centre is a separate app at /digitide/ with its
     own gate. It is listed here with a `redirect` rather than a `slug` so that
     signing in at the site root sends you there instead of failing with
     "Invalid Demo ID", which is what happened when the root URL was tried. */
  "DIGITIDE-GRP":{ redirect: "/digitide/",  pass: "K2SY-2K5J" },
  /* Indore office study, a separate app at /indore/ with its own gate. Only
     a SHA-256 of the normalised password is stored, never the password. */
  "INDORE-AP":   { redirect: "/indore/",    passHash: "a4b32dba4f102ad7427f1651b09b05151026178ede1e5503f22f477b0ad2f45d" },
  /* Chennai office study, a separate app at /chennai/ with its own gate,
     built the same way as Indore: only the password's SHA-256 is stored. */
  "CHENNAI-AP":  { redirect: "/chennai/",   passHash: "b617cb70f6c6ffda4062e5e585ca3318cf20aceebe2b837cd4bc1919084eef6b" },
  /* Whitefield atlas for Total Environment, a separate app at /whitefield/
     with its own gate. Only a SHA-256 of the normalised password is stored. */
  "TE-WHITEFIELD": { redirect: "/whitefield/", passHash: "c069467f5e0b9eae595ece10bcba43a548ecb2f30f9e1d65deed2bcc86c315a1" }
};
