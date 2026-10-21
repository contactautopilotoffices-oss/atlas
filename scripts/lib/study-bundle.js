/* ============================================================================
   ATLAS · read a committed study as a bundle

   The five studies in this repo predate engine/SCHEMA.md. This module loads a
   study's data.js in a sandbox and maps its globals onto the bundle shape, so
   the schema can be tested against real, shipped data rather than against an
   example someone wrote to pass.

   It is a migration and test aid. The engine never uses it: the engine reads a
   bundle. Once a study is migrated its entry here can go.

   Whitefield is deliberately not here. It is a different kind of Atlas (one
   site with its market around it, not a set of options compared), and
   WF.meta has no centre. It maps onto a bundle as a single-option study, but
   that is a conversion to make on purpose, not a mapping to infer.
   ============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");

/* data.js files only assign to window.*, so a bare object is enough of a DOM. */
function loadGlobals(file) {
  const win = {};
  const ctx = { window: win, console: { log() {}, warn() {}, error() {} } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { timeout: 30000 });
  return win;
}

/* Only the blocks that are actually present, so an absent block stays absent
   rather than becoming an empty one the validator would then complain about. */
function pick(out, key, value) {
  if (value !== undefined && value !== null) out[key] = value;
  return out;
}

const STUDIES = {
  chennai: {
    file: "chennai/data.js",
    build: w => {
      const out = {};
      pick(out, "meta", w.CHN_META);
      pick(out, "existing", w.CHN_EXISTING);
      pick(out, "options", w.CHN_OPTIONS);
      pick(out, "zones", w.CHN_ZONES);
      pick(out, "transit", w.CHN_TRANSIT);
      pick(out, "bus", w.CHN_BUS);
      pick(out, "places", w.CHN_PLACES);
      pick(out, "facts", w.CHN_FACTS);
      return out;
    }
  },
  noida: {
    file: "noida/data.js",
    build: w => {
      const out = {};
      pick(out, "meta", w.NOI_META);
      pick(out, "existing", w.NOI_EXISTING);
      pick(out, "options", w.NOI_OPTIONS);
      pick(out, "zones", w.NOI_ZONES);
      pick(out, "transit", w.NOI_TRANSIT);
      pick(out, "places", w.NOI_PLACES);
      pick(out, "facts", w.NOI_FACTS);
      return out;
    }
  },
  indore: {
    file: "indore/data.js",
    /* Indore keeps one metro line as a flat object, and its zones carry no
       pros or cons. Both map straight onto the schema. */
    build: w => {
      const out = {};
      pick(out, "meta", w.IND_META);
      pick(out, "existing", w.IND_EXISTING);
      pick(out, "options", w.IND_OPTIONS);
      pick(out, "zones", w.IND_ZONES);
      if (w.IND_METRO) out.transit = {
        asOf: w.IND_META && w.IND_META.asOf,
        lines: [{
          key: "metro", name: w.IND_METRO.name, short: "M", mode: "metro",
          status: "open", src: w.IND_METRO.src,
          stations: (w.IND_METRO.stations || []).map(s => ({
            name: s.name, lat: s.lat, lng: s.lng, open: s.open, alias: s.alias
          }))
        }]
      };
      if (w.IND_BUS) out.bus = { name: w.IND_BUS.name, src: w.IND_BUS.src, path: w.IND_BUS.path };
      pick(out, "places", w.IND_PLACES);
      pick(out, "facts", w.IND_FACTS);
      return out;
    }
  },
  andheri: {
    /* Andheri compares seven buildings and also plots 22 competitor centres.
       The centres are context, so they become places with their own layer. */
    file: "andheri/data.js",
    build: w => {
      const out = {};
      pick(out, "meta", w.AND_META);
      pick(out, "options", w.AND_OPTIONS);
      pick(out, "zones", w.AND_ZONES);
      if (w.AND_STATIONS) out.transit = {
        asOf: w.AND_META && w.AND_META.asOf,
        lines: [{
          key: "rail", name: "Mumbai rail and metro", short: "R", mode: "rail", status: "open",
          stations: w.AND_STATIONS.map(s => ({ name: s.name, lat: s.lat, lng: s.lng, open: true, src: s.src }))
        }]
      };
      if (w.AND_CENTRES) out.places = w.AND_CENTRES.map(c => ({
        id: c.id, kind: "coworking",
        name: c.building || c.operator,
        sub: c.building ? c.operator : undefined,
        lat: c.lat, lng: c.lng, precision: c.precision, src: c.geoSrc,
        note: c.priceText || (c.price ? `INR ${c.price} per seat` : undefined)
      }));
      return out;
    }
  }
};

function names() { return Object.keys(STUDIES); }

function bundleFor(name) {
  const s = STUDIES[name];
  if (!s) throw new Error(`Unknown study "${name}". Known: ${names().join(", ")}`);
  return s.build(loadGlobals(s.file));
}

module.exports = { names, bundleFor, loadGlobals, STUDIES };
