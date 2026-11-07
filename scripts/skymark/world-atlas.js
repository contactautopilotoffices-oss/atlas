/* Skymark F-1 in the 3D explorer (/skymark/world): the atlas the explorer reads.

     node scripts/skymark/world-atlas.js ROUTES.json

   Writes examples/skymark.bundle.json (what scripts/world/prep.py --region reads) and
   engine/atlases/skymark.js (what engine/world.js loads). The building's facts are the ones
   the /skymark page already shows (engine/atlases/skymark-f1.js, from Skymark's own listing);
   the walk to the metro comes from scripts/skymark/routes.py over the OpenStreetMap streets.
   Same sign-in as /skymark. */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..", "..");
const SK = JSON.parse(fs.readFileSync(path.join(ROOT, "engine/atlases/skymark-f1.js"), "utf8").replace(/^[^=]*=\s*/, "").replace(/;\s*$/, ""));
const routes = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ACCESS = { id: "SKYMARKDEMO", pass: "SKY1234" };   // the /skymark sign-in
const hash = crypto.createHash("sha256").update(`${ACCESS.id}:${ACCESS.pass}`.toUpperCase().replace(/[\s-]/g, "")).digest("hex");
const B = SK.building, f = Object.fromEntries(B.facts);
const option = {
  id: "skymark-f1", n: 1, name: B.name, lat: B.lat, lng: B.lng, precision: "building", micro: "sector-6",
  reason: "Floor 1st · Volt · Design & build by Autopilot · G+4 · 90,551 sq ft leasable",
  address: B.address, locality: "Sector 6, Noida",
  routes: routes.map((r) => ({ ...r, src: "https://www.openstreetmap.org" })),
  facts: [
    { k: "Configuration", v: f["Configuration"] }, { k: "Total floors", v: "G+4" }, { k: "Floor / Unit", v: "1st" },
    { k: "Tenant", v: "Volt (first floor, design and build by Autopilot)" }, { k: "Total leasable area", v: f["Total leasable area"] },
    { k: "Plot size", v: f["Plot size"] }, { k: "Developer", v: "Skymark Group" }, { k: "Address", v: B.address },
  ],
};
const atlas = {
  slug: "skymark", path: "/skymark", gate: { hash },
  meta: {
    title: "Skymark F-1", sub: "Sector 6, Noida", city: "Noida", center: [B.lng, B.lat], zoom: 16,
    world: { href: "/skymark/world", data: "/media/skymark-f1/world/", sky: "sky.hdr", poster: "hero.jpg",
      thumbs: { "skymark-f1": "r/skymark-f1-close.jpg" }, renders: { "skymark-f1": "r/skymark-f1-street.jpg" },
      brand: { kicker: "SKYMARK · NOIDA", title: "SECTOR 6, NOIDA" },
      theme: { acc: "#f2922b", accInk: "#1b1006", glass: "rgba(18,20,23,.58)" },
      lines: { L1: ["#2a6fd0", "Blue Line", "Blue"] },
      floors: { ground: B.storeys.ground, typical: B.storeys.typical } },
  },
  options: [option],
  copy: { connect: { note: "Walking distance from the entrance to the nearest Blue Line station, along the streets in OpenStreetMap (Overture Maps 2026-10-21)." } },
};
fs.writeFileSync(path.join(ROOT, "examples/skymark.bundle.json"), JSON.stringify({ options: [option] }, null, 1));
fs.writeFileSync(path.join(ROOT, "engine/atlases/skymark.js"), "window.ATLAS = " + JSON.stringify(atlas) + ";\n");
console.log("wrote examples/skymark.bundle.json and engine/atlases/skymark.js:", option.routes.map((r) => `${r.name} ${r.m} m`).join(", "));
