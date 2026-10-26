/* ============================================================================
   ATLAS CMS · research: what the files leave out, found on the web (Exa)

   After a plan is read from the files, research fills the gaps:
     - each property or centre with no address and no pin is searched for by
       name and area, so it can be placed instead of left off the map;
     - the area as a whole is searched for the facts an atlas is read for:
       office rents, vacancy, coworking prices, recent deals, new supply,
       metro and infrastructure.
   One model call turns what the searches found into additions to the plan:
   addresses on the rows that lacked them, and facts with their source link
   and date. It never overwrites what the files said, never invents a figure
   and never writes a coordinate (Build places pins from the addresses).

   Without EXA_API_KEY nothing happens and the plan comes back as it was,
   with a note: research helps an atlas, it is never needed for one.
   ============================================================================ */
"use strict";
const llm = require("./_llm");

const BASE = () => (process.env.EXA_BASE_URL || "https://api.exa.ai").replace(/\/+$/, "");
const enabled = () => !!process.env.EXA_API_KEY;
const MAX_GAPS = 12, PARALLEL = 6;

async function exaSearch(query, { num = 5, days = 400, fetchFn = fetch } = {}) {
  const q = String(query || "").slice(0, 300).trim();
  if (!q) return { query: q, results: [] };
  try {
    const r = await fetchFn(BASE() + "/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.EXA_API_KEY },
      body: JSON.stringify({
        query: q, type: "auto", numResults: num, userLocation: "IN",
        ...(days ? { startPublishedDate: new Date(Date.now() - days * 86400e3).toISOString() } : {}),
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { query: q, error: r.status === 401 || r.status === 403 ? "the Exa key was refused" : `Exa answered ${r.status}`, results: [] };
    const j = await r.json();
    return { query: q, results: (j.results || []).filter(x => x.url).map(x => ({ title: String(x.title || "").slice(0, 200), url: x.url, published: x.publishedDate ? String(x.publishedDate).slice(0, 10) : null, highlights: (x.highlights || []).slice(0, 2).map(h => String(h).replace(/\s+/g, " ").trim().slice(0, 400)) })) };
  } catch (e) { return { query: q, error: String(e.message || e).slice(0, 120), results: [] }; }
}

/* Run searches a few at a time. */
async function searchAll(jobs, opts) {
  const out = [];
  for (let i = 0; i < jobs.length; i += PARALLEL) out.push(...await Promise.all(jobs.slice(i, i + PARALLEL).map(j => exaSearch(j.query, { ...opts, ...j }))));
  return out;
}

const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const pinned = (r) => has(r["Latitude"]) && has(r["Longitude"]);
const most = (list) => { const c = new Map(); for (const x of list.filter(Boolean)) c.set(x, (c.get(x) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]); };

/* What to search for, from the plan as it stands. The atlas type changes
   it: a place is researched around its site (who competes there, what was
   leased, what is coming), a network city by city. */
function queriesFor(rows, { requirement = "", brief = null, type = "decide" } = {}) {
  const atlas = rows["Atlas"] || {};
  const opts = rows["Options"] || [];
  const cities = most(opts.map(o => o["City"]));
  const city = atlas["City"] || cities[0] || (brief && brief["Where"] && [].concat(brief["Where"])[0]) || "";
  const areas = most(opts.map(o => o["Locality"] || o["Micro-market"])).slice(0, 3);
  const place = [areas[0], city].filter(Boolean).join(", ") || city || String(requirement).slice(0, 60);
  const gaps = opts.filter(o => !pinned(o) && !has(o["Address"])).slice(0, MAX_GAPS)
    .map(o => ({ id: o["ID"], query: `${o["Property name"] || o["ID"]} ${o["Locality"] || areas[0] || ""} ${o["City"] || city} address`.replace(/\s+/g, " ").trim(), num: 3, days: 0 }));
  if (type === "network") {
    const top = (cities.length ? cities : [city]).filter(Boolean).slice(0, 4);
    return { gaps, market: top.flatMap(c => [{ query: `${c} office rent per sq ft vacancy 2026`, num: 3 }, { query: `${c} office leasing absorption 2026`, num: 3 }]), place: top.join(", ") || place, city };
  }
  if (type === "place" && opts[0]) {
    const site = opts[0], near = [site["Locality"] || areas[0], site["City"] || city].filter(Boolean).join(", ") || place;
    return { gaps, place: near, city, market: [
      { query: `coworking centres near ${site["Property name"] || ""} ${near}`.replace(/\s+/g, " "), num: 8, days: 0 },
      { query: `${near} coworking flex operators centres list`, num: 8, days: 0 },
      { query: `${near} office leasing deals 2026 sq ft tenant` },
      { query: `${near} new office supply Grade A 2026` },
      { query: `${near} office rent per sq ft vacancy 2026` },
      { query: `${near} metro station infrastructure 2026` },
    ] };
  }
  const market = place ? [
    { query: `${place} office rent per sq ft vacancy 2026` },
    { query: `${place} coworking flex price per seat 2026` },
    { query: `${place} office leasing deals 2026 sq ft tenant` },
    { query: `${place} new office supply Grade A 2026` },
    { query: `${place} metro station infrastructure 2026` },
    ...areas.slice(1).map(a => ({ query: `${a}, ${city} office market rent 2026`, num: 3 })),
  ] : [];
  return { gaps, market, place, city };
}

const RULES = `You add what web search results say to an Atlas plan: the rows a property atlas is built from. You get the plan (properties on "Options", other rows on "Places") and search results, each with its URL and date.

Reply with ONE JSON object and nothing else:
{
  "Options": [ { "ID": "<an ID from the plan>", "Address": "...", "Locality": "...", "Source": "<url of the result that says it>" } ],
  "Places": [ { "Kind": "flex | office | deal | employer | ...", "Name": "...", "Operator": "...", "Address": "...", "Locality": "...", "Second line": "...", "Source": "<url>" } ],
  "Facts": [ { "Group": "market | transit | supply | deals | flex", "Label": "...", "Value": "...", "As of": "YYYY-MM", "Source": "<url>", "How firm": "high | medium | low" } ]
}

Rules:
- Use only what the results state. Never invent a figure, a name or a date. Every row you add carries the URL of the result it came from.
- "Options": only for an ID in the plan whose address is missing, and only when a result gives that building's address. Never change an ID, never write a latitude or longitude, never touch a value the plan already has.
- "Facts": figures about the area a person deciding on an office would want: rents and how they moved, vacancy, coworking prices per seat, notable recent deals (who, how much space, where), new supply, metro and infrastructure with dates. Short labels, values in the source's words with their units, "As of" from the result's date. Prefer the newest figure; leave out anything older than two years unless nothing newer exists.
- "Places": only when THE ATLAS SHOWS ONE SITE (said below the plan). Then add the coworking and office centres, and recent deals, that the results name in the site's area and that the plan does not already have: Kind "flex" for coworking and managed offices, "office" for office buildings, "deal" for a leasing deal; "Operator" the brand that runs it; "Address" as the result gives it; seats, prices or area in "Second line". Otherwise return an empty list.
- If a result is about another city or area, leave it out. If nothing useful was found, return empty lists.
- Plain words, no em dashes, no commentary.`;

/* The plan, compactly, for the model: what it needs to match IDs. */
const planBrief = (rows) => JSON.stringify({
  Atlas: { Title: (rows["Atlas"] || {})["Title"], City: (rows["Atlas"] || {})["City"] },
  Options: (rows["Options"] || []).slice(0, 80).map(o => ({ ID: o["ID"], "Property name": o["Property name"], Locality: o["Locality"], City: o["City"] || undefined, Address: o["Address"] || undefined })),
  ...((rows["Places"] || []).length ? { Places: rows["Places"].slice(0, 120).map(p => ({ Name: p["Name"], Kind: p["Kind"], Operator: p["Operator"] || undefined })) } : {}),
});
const SHOWS = {
  place: "THE ATLAS SHOWS ONE SITE: the first row on Options, and everything around it. Add the centres and deals around it on Places.",
  network: "THE ATLAS SHOWS A NETWORK of locations across cities. Facts about a city take the city's name as their Group. Return an empty Places list.",
};

/* Research the plan. Returns the plan with additions, and notes. */
async function research({ rows, requirement = "", brief = null, type = "decide" }, { search = searchAll, complete = llm.complete, fetchFn } = {}) {
  const out = JSON.parse(JSON.stringify(rows || {}));
  if (!enabled() && search === searchAll) return { rows: out, notes: ["Web research is off: set EXA_API_KEY in Vercel to fill missing addresses and add market facts with sources."], added: { addresses: 0, facts: 0 }, sources: [] };
  const { gaps, market, place } = queriesFor(out, { requirement, brief, type });
  if (!gaps.length && !market.length) return { rows: out, notes: ["Nothing to research yet: the plan names no place."], added: { addresses: 0, facts: 0 }, sources: [] };

  const found = await search([...gaps, ...market], fetchFn ? { fetchFn } : {});
  const failed = found.filter(f => f.error);
  const results = found.flatMap(f => (f.results || []).map(r => ({ query: f.query, ...r })));
  const sources = [...new Map(results.map(r => [r.url, { title: r.title, url: r.url, published: r.published }])).values()];
  const notes = [];
  if (failed.length && failed.length === found.length) return { rows: out, notes: [`Web research did not work (${failed[0].error}). The plan is unchanged.`], added: { addresses: 0, facts: 0 }, sources: [] };
  if (!results.length) return { rows: out, notes: [`Web research found nothing new about ${place}.`], added: { addresses: 0, facts: 0 }, sources: [] };

  const r = await complete({
    system: RULES, maxTokens: 16000, effort: "low",
    user: `THE PLAN\n${planBrief(out)}\n\n${SHOWS[type] ? `${SHOWS[type]}\n\n` : "THE ATLAS COMPARES the rows on Options. Return an empty Places list.\n\n"}${requirement ? `THE REQUIREMENT\n${String(requirement).slice(0, 2000)}\n\n` : ""}SEARCH RESULTS\n${JSON.stringify(results).slice(0, 90000)}`,
  });
  const add = r.json && typeof r.json === "object" ? r.json : {};
  const urls = new Set(results.map(x => x.url));
  const sourced = (x) => x && typeof x === "object" && has(x["Source"]) && urls.has(String(x["Source"]).trim());

  /* Addresses only where the plan had none, and only with a source. */
  let addresses = 0;
  const byId = new Map((out["Options"] || []).map(o => [String(o["ID"] || "").toLowerCase(), o]));
  for (const a of Array.isArray(add["Options"]) ? add["Options"] : []) {
    if (!sourced(a)) continue;
    const o = byId.get(String(a["ID"] || "").toLowerCase());
    if (!o || pinned(o) || has(o["Address"])) continue;
    if (has(a["Address"])) { o["Address"] = String(a["Address"]).trim(); addresses++; }
    if (!has(o["Locality"]) && has(a["Locality"])) o["Locality"] = String(a["Locality"]).trim();
    if (!has(o["Address source"])) o["Address source"] = a["Source"];
  }
  /* Facts with a source, not already there by label. */
  const seen = new Set((out["Facts"] || []).map(f => `${f["Group"]}|${f["Label"]}`.toLowerCase()));
  const facts = (Array.isArray(add["Facts"]) ? add["Facts"] : []).filter(f => sourced(f) && has(f["Label"]) && has(f["Value"]))
    .map(f => ({ "Group": has(f["Group"]) ? String(f["Group"]).trim().toLowerCase() : "market", "Label": String(f["Label"]).trim(), "Value": String(f["Value"]).trim(), "As of": f["As of"] || undefined, "How firm": f["How firm"] || "medium", "Source": String(f["Source"]).trim(), "Note": "Found by web research; check before quoting." }))
    .filter(f => { const k = `${f["Group"]}|${f["Label"]}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  if (facts.length) out["Facts"] = [...(out["Facts"] || []), ...facts];

  /* Around one site: the centres and deals the results name nearby, by
     name, never twice, never with a coordinate (Build places them). */
  let places = 0;
  if (type === "place") {
    const known = new Set([...(out["Options"] || []).map(o => o["Property name"]), ...(out["Places"] || []).map(p => p["Name"])].filter(Boolean).map(n => String(n).trim().toLowerCase()));
    const add2 = (Array.isArray(add["Places"]) ? add["Places"] : []).filter(p => sourced(p) && has(p["Name"]) && !known.has(String(p["Name"]).trim().toLowerCase()) && known.add(String(p["Name"]).trim().toLowerCase()))
      .slice(0, 60).map(p => {
        const r = { "Kind": has(p["Kind"]) ? String(p["Kind"]).trim().toLowerCase() : "flex", "Name": String(p["Name"]).trim() };
        for (const k of ["Operator", "Address", "Locality", "Second line"]) if (has(p[k])) r[k] = String(p[k]).trim();
        r["Source"] = String(p["Source"]).trim(); r["Note"] = "Found by web research; check before quoting.";
        return r;
      });
    if (add2.length) { out["Places"] = [...(out["Places"] || []), ...add2]; places = add2.length; }
  }

  notes.push(`Web research (Exa) ran ${found.length} search${found.length === 1 ? "" : "es"} about ${place}: ${addresses} address${addresses === 1 ? "" : "es"} found for properties that had none, ${facts.length} market fact${facts.length === 1 ? "" : "s"} added${type === "place" ? `, ${places} centre${places === 1 ? "" : "s"} or deal${places === 1 ? "" : "s"} found around the site` : ""}, each with its source.`);
  if (failed.length) notes.push(`${failed.length} search${failed.length === 1 ? "" : "es"} did not work (${failed[0].error}).`);
  return { rows: out, notes, added: { addresses, facts: facts.length, places }, sources, model: r.model, provider: r.provider };
}

/* A few searches for Enhance: what the web says about the place in the
   requirement, as text the brief can draw on. */
async function webContext(requirement, { search = searchAll, fetchFn } = {}) {
  if (!enabled() && search === searchAll) return "";
  const q = String(requirement || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!q) return "";
  const found = await search([{ query: `${q} office market rent 2026`, num: 4 }, { query: `${q} coworking price per seat 2026`, num: 3 }], fetchFn ? { fetchFn } : {});
  const res = found.flatMap(f => f.results || []);
  if (!res.length) return "";
  return res.map(r => `- ${r.title} (${r.published || "undated"}) ${r.url}\n  ${r.highlights.join(" ")}`).join("\n").slice(0, 20000);
}

/* No files, only a requirement in words: find candidate buildings and
   centres on the web, with their sources, as the starting plan. */
const DISCOVER = `You start an Atlas plan from web search results, for a person who described what they need but sent no files. Reply with ONE JSON object and nothing else:
{
  "Atlas": { "Title": "...", "City": "...", "Subtitle": "who it is for and what they need" },
  "Options": [ { "ID": "short-lower-case-slug", "Property name": "...", "Address": "...", "Locality": "...", "Kind": "office building | coworking centre | business park", "Source": "<url>", ...any figure the result gives, in its own column with the unit in the heading } ],
  "Facts": [ { "Group": "market", "Label": "...", "Value": "...", "As of": "YYYY-MM", "Source": "<url>" } ]
}
Rules:
- Options are real buildings or centres the results name, in or near the place asked for, that could suit the requirement. Between 5 and 25 of them. Every one carries the URL of the result that names it, and its address as the result gives it.
- Use only what the results state. Never invent a building, a figure or an address; never write a latitude or longitude.
- Facts: the market figures the results give for the area (rents, vacancy, coworking prices), each with its URL.
- Plain words, no em dashes.`;

const DISCOVER_TYPE = {
  place: `THIS ATLAS SHOWS ONE SITE and everything around it. "Options" is that site alone (one row; the building, campus or address the person named), with its address and the URL of a result that names it. Also return "Places": the coworking and office centres, and recent leasing deals, the results name around it, each { "Kind": "flex | office | deal", "Name": "...", "Operator": "<brand>", "Address": "...", "Locality": "...", "Second line": "seats, price or area", "Source": "<url>" }.`,
  network: `THIS ATLAS SHOWS A NETWORK: every location (office, centre, branch, facility) of the organisation or portfolio the person named, across cities. "Options" is one row per location the results name, each with "City", "Locality", its address as given and its URL. As many as the results name.`,
};
const DISCOVER_QUERIES = {
  place: (q) => [
    { query: `${q} address location`, num: 5, days: 0 },
    { query: `coworking centres near ${q}`, num: 8, days: 0 },
    { query: `office buildings near ${q} Grade A`, num: 6, days: 0 },
    { query: `${q} office leasing deals 2026`, num: 4 },
    { query: `${q} office rent per sq ft 2026`, num: 4 },
  ],
  network: (q) => [
    { query: `${q} offices locations cities India`, num: 8, days: 0 },
    { query: `${q} centres list address`, num: 8, days: 0 },
    { query: `${q} new office opening city 2026`, num: 6 },
  ],
};

async function discover({ requirement, brief = null, type = "decide" }, { search = searchAll, complete = llm.complete, fetchFn } = {}) {
  const req = String(requirement || "").replace(/\s+/g, " ").trim();
  if (!req) throw Object.assign(new Error("Describe what you need, or add a file."), { status: 400 });
  if (!enabled() && search === searchAll) throw Object.assign(new Error("Starting from words alone needs web research: set EXA_API_KEY in Vercel. Or add a file (a list of buildings, an inventory, a survey)."), { status: 503 });
  const where = brief && brief["Where"] ? [].concat(brief["Where"]).join(" ") : "";
  const q = `${req} ${where}`.slice(0, 220);
  const found = await search(DISCOVER_QUERIES[type] ? DISCOVER_QUERIES[type](q) : [
    { query: `${q} office space for lease building`, num: 8, days: 0 },
    { query: `${q} coworking centres seats price`, num: 8, days: 0 },
    { query: `${q} Grade A office buildings list address`, num: 6, days: 0 },
    { query: `${q} office rent per sq ft 2026`, num: 4 },
  ], fetchFn ? { fetchFn } : {});
  const results = found.flatMap(f => (f.results || []).map(r => ({ query: f.query, ...r })));
  if (!results.length) throw Object.assign(new Error(`The web search found nothing for "${req.slice(0, 80)}". Add a file, or say the area and city.`), { status: 422 });
  const r = await complete({ system: DISCOVER, maxTokens: 16000, effort: "low", user: `${DISCOVER_TYPE[type] ? `${DISCOVER_TYPE[type]} These lines win over the rules.\n\n` : ""}THE REQUIREMENT\n${req}${brief ? `\n\nTHE BRIEF\n${JSON.stringify(brief).slice(0, 4000)}` : ""}\n\nSEARCH RESULTS\n${JSON.stringify(results).slice(0, 90000)}` });
  const urls = new Set(results.map(x => x.url));
  const rows = r.json && typeof r.json === "object" ? r.json : {};
  rows["Options"] = (Array.isArray(rows["Options"]) ? rows["Options"] : []).filter(o => o && has(o["Property name"]) && has(o["Source"]) && urls.has(String(o["Source"]).trim()));
  rows["Facts"] = (Array.isArray(rows["Facts"]) ? rows["Facts"] : []).filter(f => f && has(f["Source"]) && urls.has(String(f["Source"]).trim()));
  rows["Places"] = type === "place" ? (Array.isArray(rows["Places"]) ? rows["Places"] : []).filter(p => p && has(p["Name"]) && has(p["Source"]) && urls.has(String(p["Source"]).trim())) : [];
  if (!rows["Places"].length) delete rows["Places"];
  for (const o of [...rows["Options"], ...(rows["Places"] || [])]) { delete o["Latitude"]; delete o["Longitude"]; }
  if (!rows["Options"].length) throw Object.assign(new Error("The web search found no buildings or centres to start from. Add a file, or name the area and city."), { status: 422 });
  const n = rows["Options"].length, np = (rows["Places"] || []).length;
  const said = type === "place" ? `the site${np ? ` and ${np} centre${np === 1 ? "" : "s"} or deal${np === 1 ? "" : "s"} around it` : ""}` : type === "network" ? `${n} location${n === 1 ? "" : "s"}` : `${n} building${n === 1 ? "" : "s"} or centre${n === 1 ? "" : "s"}`;
  return { rows, notes: [`Started from your words: web research found ${said}, each with the page that names it. Check them before you share the atlas.`], sources: [...new Map(results.map(x => [x.url, { title: x.title, url: x.url, published: x.published }])).values()], model: r.model, provider: r.provider };
}

module.exports = { research, discover, webContext, exaSearch, queriesFor, enabled, RULES };
