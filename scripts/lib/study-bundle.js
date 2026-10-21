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

/* Chennai's priority chooser, written as data.

   The app hard-codes seven measures (PARTS) and seven presets (PRESETS), with
   a scoring function behind each. This is the same seven expressed through the
   four measure kinds in engine/SCHEMA.md, and it is the test of whether that
   block can carry a real chooser rather than a toy one. The labels, questions
   and notes are copied from the app so nothing is lost in the move.

   Two things came out of writing it down. "Metro coming" counts only metro
   stations, so nearestStation needed a `mode`; that is now in the schema. And
   the app discounts a planned station by how far off its target year is, which
   no kind expresses: this declares a plain nearestStation, and the engine
   needs an `etaDiscount` option to match the app exactly. That is the one gap
   between these seven lines and the app's own scoring. */
const CHENNAI_MEASURES = [
  { key: "price", kind: "column", column: "pricingScore", higherIsBetter: true,
    label: "Price", question: "How much does the price matter?",
    of: "the pricing score out of 10 on the revised sheet" },
  { key: "eco", kind: "column", column: "ecoScore", higherIsBetter: true,
    label: "Ecosystem", question: "How much does the business ecosystem around the building matter?",
    of: "the ecosystem score out of 10 on the revised sheet" },
  { key: "rail", kind: "nearestStation", status: "open",
    label: "Rail today", question: "Can people walk to an open metro, MRTS or suburban station?",
    of: "distance to the nearest open station" },
  { key: "home", kind: "fromExisting",
    label: "Close to today's office", question: "Should today's team keep roughly the same commute?",
    of: "road distance from the current office (the sheet's figure)" },
  { key: "talent", kind: "nearestPlace", placeKind: ["edu", "res"], rings: [15, 30, 45],
    label: "Talent pool", question: "Do you want colleges and homes within a 30 minute drive?",
    of: "institutes and residential belts by drive time" },
  { key: "studios", kind: "nearestPlace", placeKind: "studio", rings: [15, 30, 45],
    label: "Studio talent nearby", question: "Do you want experienced VFX and post artists already working nearby?",
    of: "VFX, animation and post studios by drive time" },
  { key: "future", kind: "nearestStation", status: "planned", mode: "metro",
    label: "Metro coming", question: "Does a Phase 2 metro station opening close by matter?",
    of: "distance to the nearest Phase 2 station" }
];
const CHENNAI_PRESETS = [
  { key: "balanced", label: "Balanced", default: true,
    note: "The sheet's price and ecosystem scores lead, then rail access; the team, talent, studios and the metro pipeline count a little.",
    levels: { price: 4, eco: 3, rail: 2, home: 1, talent: 1, studios: 1, future: 1 } },
  { key: "sheet", label: "Sheet scores only",
    note: "Only the revised sheet's pricing and ecosystem scores, nothing from the map.",
    levels: { price: 3, eco: 3, rail: 0, home: 0, talent: 0, studios: 0, future: 0 } },
  { key: "team", label: "Keep the team",
    note: "Today's people stay: the shortest move from the current office, then rail, price and nearby studios.",
    levels: { price: 2, eco: 1, rail: 2, home: 4, talent: 1, studios: 2, future: 1 } },
  { key: "rail", label: "Commute by rail",
    note: "Staff arrive by metro, MRTS or train: an open station on foot first, a Phase 2 station next.",
    levels: { price: 2, eco: 1, rail: 4, home: 1, talent: 2, studios: 1, future: 3 } },
  { key: "hire", label: "Hire at scale",
    note: "Grow the team fast: colleges, homes and experienced studio artists within 30 minutes.",
    levels: { price: 1, eco: 2, rail: 2, home: 1, talent: 4, studios: 3, future: 1 } },
  { key: "cost", label: "Keep cost down",
    note: "The best price on the sheet leads; the ecosystem and access still count.",
    levels: { price: 4, eco: 2, rail: 1, home: 1, talent: 1, studios: 1, future: 0 } },
  { key: "future", label: "Built for 2030",
    note: "Bet on where the metro is going and where talent is growing.",
    levels: { price: 1, eco: 2, rail: 2, home: 1, talent: 3, studios: 2, future: 4 } }
];

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
      out.measures = CHENNAI_MEASURES;
      out.presets = CHENNAI_PRESETS;
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
