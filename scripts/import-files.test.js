#!/usr/bin/env node
/* ============================================================================
   ATLAS · several files into one atlas, with no key and no network

     node scripts/import-files.test.js

   The import box on Create an atlas takes up to six files of any mix. This
   builds one of each the way they arrive in practice (an inventory PDF, a
   Word note with a table, a spreadsheet with one centre per column, the
   filled Atlas workbook), reads them with the same code the CMS uses, and
   checks what the model is handed, that the workbook's pins survive the
   model, that a lone workbook never needs a model at all, that a plan a
   person edits builds into exactly what they typed, and what Enhance sends
   and keeps.
   ============================================================================ */
"use strict";
process.env.ATLAS_METRO = "off";   // no public services in tests; scripts/metro.test.js covers the metro
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const JSZip = require("jszip");
const { importSources, plan, workbookRows, readSource, docxText, kindOf, MAX_FILES } = require("../api/cms/_sources");
const { MAX_CHARS, build, askFor, promotePlaces } = require("../api/cms/_pdf");
const brief = require("../api/cms/_brief");
const model = require("../api/cms/_llm");
const { askModel } = require("../api/cms/_pdf");
const { tinyPdf } = require("../api/cms/_preflight");
const { readWorkbook } = require("./lib/workbook");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 400)}` : ""}`); } };
const threw = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

/* A Word document is a zip with word/document.xml; that is all docxText reads. */
async function makeDocx(paras, table) {
  const zip = new JSZip();
  const p = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  const tr = (cells) => `<w:tr>${cells.map(c => `<w:tc>${p(c)}</w:tc>`).join("")}</w:tr>`;
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.map(p).join("")}<w:tbl>${table.map(tr).join("")}</w:tbl></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

/* Visited centres the way a team keeps them: field names down column A,
   one centre per column. */
async function makeVisited() {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Sheet1");
  [["Sr. No", 1, 2], ["Operator", "Rush Co-works", "Quest Coworks"], ["Building Name", "Boston House", "Technopolis"],
   ["Location", "Andheri East", "Andheri East"], ["Total Seats", 125, 1800], ["Per Seat Cost", "18000 + GST", "18000 + GST"],
   ["Image Link", { text: "photos", hyperlink: "https://drive.example.com/rush" }, "https://drive.example.com/quest"]].forEach(r => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const GEO = { "boston house": [72.8689, 19.1171, "building"], "technopolis": [72.8667, 19.1153, "building"], "lighthall": [72.8951, 19.1192, "building"] };
const geocoder = async (q) => { const k = Object.keys(GEO).find(k => q.toLowerCase().includes(k)); return k ? { lng: GEO[k][0], lat: GEO[k][1], precision: GEO[k][2], label: q } : null; };

(async () => {
  let e;
  console.log("\nImport several files");
  const atlasBuf = fs.readFileSync(path.join(__dirname, "..", "examples", "andheri-flex.xlsx"));
  const example = (await readWorkbook(atlasBuf)).bundle;
  const pdfBuf = tinyPdf("Proposed Inventory: Corporate Avenue, Chakala, rent Rs 300 on carpet");
  const docBuf = await makeDocx(["Flex operators in Andheri", "Prices &amp; grades as quoted"], [["Operator", "Building", "Location"], ["Incuspaze", "Lighthall", "Chandivali"]]);
  const visBuf = await makeVisited();

  /* ---- what kind of file is it ---- */
  ok("a PDF is known by its first bytes, whatever its name", kindOf("scan.bin", pdfBuf) === "pdf");
  ok("Word and Excel files are told apart by name once they look like a zip", kindOf("note.docx", docBuf) === "docx" && kindOf("visited.xlsx", visBuf) === "xlsx");
  ok("an old .doc is refused with what to do", /Save it as \.docx/.test(kindOf("old.doc", Buffer.from("xx")).unsupported));
  ok("a picture is refused, naming what is read", /Excel \(\.xlsx, \.csv\), PDF or Word/.test(kindOf("site.png", Buffer.from("xx")).unsupported));

  /* ---- reading each ---- */
  const dt = await docxText(docBuf);
  ok("Word: paragraphs become lines and a table row reads as cells", /Flex operators in Andheri/.test(dt) && /Incuspaze \| Lighthall \| Chandivali/.test(dt), dt);
  ok("Word: entities are decoded", /Prices & grades/.test(dt), dt);
  const vis = await readSource({ name: "Visited.xlsx", buf: visBuf });
  ok("a spreadsheet with one centre per column keeps its shape for the model", vis.kind === "xlsx" && /\[sheet "Sheet1"\]/.test(vis.text) && /Operator\tRush Co-works\tQuest Coworks/.test(vis.text), vis.text);
  ok("a cell's link text and a plain link both survive", /photos/.test(vis.text) && /drive\.example\.com\/quest/.test(vis.text), vis.text);
  const at = await readSource({ name: "andheri-flex.xlsx", buf: atlasBuf });
  ok("the filled Atlas workbook is recognised as one", at.kind === "atlas" && at.atlas.bundle.options.length === example.options.length);
  const pd = await readSource({ name: "Proposed_Inventory.pdf", buf: pdfBuf });
  ok("a PDF's text is read page by page", pd.kind === "pdf" && pd.pages === 1 && /--- page 1 ---/.test(pd.text) && /Corporate Avenue/.test(pd.text) && pd.base64 === null, pd.text);

  /* ---- a lone workbook needs no model ---- */
  const noModel = async () => { throw new Error("the model was called"); };
  const lone = await importSources([{ name: "andheri-flex.xlsx", buf: atlasBuf }], { llm: noModel, geocoder });
  ok("a lone Atlas workbook is read directly, no model", lone.direct === true && lone.bundle.options.length === example.options.length && lone.report.ok, JSON.stringify(lone.report && lone.report.errors));
  ok("and reports the file it read", lone.files.length === 1 && lone.files[0].kind === "Atlas workbook");
  const direct = JSON.stringify(example), round = JSON.stringify((await build(await workbookRows(atlasBuf), { geocoder })).bundle);
  ok("a workbook opened as a plan and built again is the same atlas, field for field", direct === round, `${direct.length} vs ${round.length}`);
  let steered = null;
  await plan([{ name: "andheri-flex.xlsx", buf: atlasBuf }], { llm: async (a) => { steered = a; return { rows: { "Options": [] } }; }, requirement: "120 seats near the metro" });
  ok("the same workbook with a requirement to apply goes to the model with it", steered && steered.requirement === "120 seats near the metro");

  /* ---- four files together ---- */
  const keepId = example.options[0].id, keepPin = [example.options[0].lat, example.options[0].lng];
  let seen = null;
  const llm = async (args) => {
    seen = args;
    return { model: "fake", provider: "test", rows: {
      "Atlas": { "Title": "Andheri options and flex centres", "City": "Mumbai", "Data current to": "2026-10" },
      "Options": [
        { "ID": keepId, "Property name": example.options[0].name, "Address": "Chakala, Andheri East, Mumbai", "Rent on carpet (Rs per sq ft)": 300 },
        ...example.options.slice(1, 3).map(o => ({ "ID": o.id, "Property name": o.name, "Address": "Andheri East, Mumbai" })),
      ],
      "Places": [
        { "ID": "rush-boston-house", "Kind": "flex", "Name": "Rush Co-works, Boston House", "Address": "Boston House, Andheri East, Mumbai", "Note": "125 seats, visited", "Source": "https://drive.example.com/rush" },
        { "ID": "quest-technopolis", "Kind": "flex", "Name": "Quest Coworks, Technopolis", "Address": "Technopolis, Andheri East, Mumbai" },
        { "ID": "incuspaze-lighthall", "Kind": "flex", "Name": "Incuspaze, Lighthall", "Address": "Lighthall, Chandivali, Mumbai" },
      ],
    } };
  };
  const files = [
    { name: "Proposed_Inventory.pdf", buf: pdfBuf },
    { name: "Flex operators.docx", buf: docBuf },
    { name: "Visited.xlsx", buf: visBuf },
    { name: "andheri-flex.xlsx", buf: atlasBuf },
  ];
  const BRIEF = { "Seats": 120, "Where": ["Chakala", "Marol"] };
  const p = await plan(files, { llm, requirement: "120 seats, near the metro", brief: BRIEF });
  ok("the plan carries the requirement and the brief to the model", seen.requirement === "120 seats, near the metro" && seen.brief === BRIEF);
  const ask = askFor(seen.requirement, seen.brief);
  ok("and the model's prompt sets out both, the brief winning", /THE REQUIREMENT, IN THE PERSON'S WORDS\n120 seats/.test(ask) && /THE BRIEF \(structured.*it wins/.test(ask) && /"Seats": 120/.test(ask), ask);
  const pKept = p.rows["Options"].find(r => r["ID"] === keepId);
  ok("a plan already has the workbook's pins in it, before anything is built", pKept && pKept["Latitude"] === keepPin[0] && pKept["Longitude"] === keepPin[1]);
  ok("a plan geocodes nothing: new places wait for Build", p.rows["Places"].every(r => r["Latitude"] == null || example.places.some(x => x.id === r["ID"])));
  ok("the plan hands back the files' text, for Enhance to use without uploading again", /===== FILE 4 of 4/.test(p.text) && p.label.startsWith("4 files"));
  const out = await importSources(files, { llm, geocoder });
  ok("the model is called once with every file, each under its own heading", seen && [1, 2, 3, 4].every(n => seen.text.includes(`===== FILE ${n} of 4:`)) && files.every(f => seen.text.includes(`"${f.name}"`)), seen && seen.text.slice(0, 300));
  ok("each file's kind is in its heading", /\(PDF, 1 page\)/.test(seen.text) && /\(Word document\)/.test(seen.text) && /\(Excel workbook\)/.test(seen.text) && /\(Atlas workbook\)/.test(seen.text));
  ok("the workbook is marked to be kept as it is", /This is a filled Atlas workbook: keep its rows as they are/.test(seen.text));
  ok("the model gets all four names and no scans to look at", seen.fileNames.length === 4 && seen.documents.length === 0 && seen.scanned.length === 0);
  const kept = out.bundle.options.find(o => o.id === keepId);
  ok("a pin from the workbook comes back exactly, not geocoded", kept && kept.lat === keepPin[0] && kept.lng === keepPin[1] && kept.precision === example.options[0].precision, JSON.stringify(kept));
  ok("the workbook's figures and the new column ride together", kept && Object.values(kept).includes(300), JSON.stringify(kept));
  const rush = out.bundle.places.find(p => p.id === "rush-boston-house");
  ok("places from the other files are pinned from their addresses", rush && Math.abs(rush.lat - 19.1171) < 1e-6 && out.bundle.places.length === 3, JSON.stringify(out.bundle.places.map(p => [p.id, p.lat])));
  const keptCount = 3 + ["rush-boston-house", "quest-technopolis", "incuspaze-lighthall"].filter(id => example.places.some(p => p.id === id)).length;
  ok("every workbook pin was kept and said so", out.notes.some(n => n.includes(`${keptCount} pins were kept exactly`)), out.notes.join(" | "));
  ok("a property the model left out is named, not lost silently", out.notes.some(n => n.includes(example.options[3].id) && /did not come back/.test(n)), out.notes.join(" | "));
  ok("the atlas title says what was combined, and the bundle draws", out.bundle.meta.title === "Andheri options and flex centres" && out.report.ok, JSON.stringify(out.report.errors));
  ok("the filled workbook comes back to check, and reads", typeof out.workbook === "string" && (await readWorkbook(Buffer.from(out.workbook, "base64"))).bundle.options.length === 3);
  ok("a summary of each file read comes back", out.files.map(f => f.kind).join(",") === "PDF,Word document,Excel workbook,Atlas workbook" && out.files[0].pages === 1);

  /* ---- a plan as a person edits it ---- */
  const edited = JSON.parse(JSON.stringify(p.rows));
  edited["Options"][0]["Property name"] = "Corporate Avenue (renamed in the plan)";
  edited["Options"].push({ "ID": "typed-in", "Property name": "A building typed in by hand", "Latitude": 19.112, "Longitude": 72.871 });
  edited["Places"][0]["Seats"] = 125;
  const built = await build(edited, { geocoder, fileName: "edited" });
  ok("an edited name is what the atlas shows", built.bundle.options.some(o => o.name === "Corporate Avenue (renamed in the plan)"));
  ok("a row typed in by hand is in the atlas, with its pin", built.bundle.options.some(o => o.id === "typed-in" && o.lat === 19.112));
  ok("a column a person adds on Places is kept", built.bundle.places.some(x => x.seats === 125), JSON.stringify(built.bundle.places[0]));
  ok("Build hands the rows back with the pins it placed, for the editor", built.rows["Places"].some(r => r["Latitude"] === 19.1171) && built.report.ok, JSON.stringify(built.report.errors));

  /* ---- Enhance ---- */
  let call = null;
  const fake = async (a) => { call = a; return { model: "fake", provider: "test", json: {
    "Client": "A fintech \u2014 moving from BKC", "Seats": "120", "Area (sq ft)": "7,800", "Where": "Chakala; Marol", "Must have": ["Metro within 500 m", ""],
    "Rank on": ["rent", "metro distance"], "Assumptions": ["65 sq ft of carpet a seat"], "Made up key": "dropped" } }; };
  const en = await brief.enhance({ requirement: "120 seats near metro, under 18k", text: "===== FILE 1 of 1: \"inv.pdf\" =====\nCorporate Avenue Rs 300", brief: { "Budget": "Rs 18,000 a seat" } }, { complete: fake });
  ok("Enhance runs looser than reading", call.temperature === brief.TEMPERATURE && brief.TEMPERATURE > 0.5);
  ok("it sends the requirement, the current brief and the files' text", /120 seats near metro/.test(call.user) && /THE CURRENT BRIEF[\s\S]*Rs 18,000/.test(call.user) && /Corporate Avenue Rs 300/.test(call.user));
  ok("numbers come back as numbers, lists as lists", en.brief["Seats"] === 120 && en.brief["Area (sq ft)"] === 7800 && en.brief["Where"].join("|") === "Chakala|Marol" && en.brief["Must have"].length === 1);
  ok("unknown keys are dropped and em dashes are taken out", !("Made up key" in en.brief) && !/\u2014/.test(JSON.stringify(en.brief)), JSON.stringify(en.brief));
  ok("the instructions ask for assumptions to be listed and no em dashes", /Assumptions/.test(brief.RULES) && /no em dashes/.test(brief.RULES));
  e = await threw(() => brief.enhance({ requirement: "" }, { complete: fake }));
  ok("nothing to enhance is a plain message", e && e.status === 400 && /Describe the requirement/.test(e.message));
  e = await threw(() => brief.enhance({ requirement: "x" }, { complete: async () => ({ json: {} }) }));
  ok("an empty answer asks to press Enhance again", e && e.status === 502 && /Enhance again/.test(e.message));

  /* ---- a list of centres and nothing proposed ----
     A coworking market survey names no building on offer. Filed under
     Places, it would leave the atlas nothing to compare; the centres are
     the options. */
  const surveyBuf = Buffer.from("Operator,Building,Location,Pricing,Occupancy,Grade\nAWFIS,Skyline Icon,Marol,Rs. 13000 per seat + taxes,80% - 85%,Grade A\nWe Work,Light Bridge,Chandivali,Rs. 25000 per seat + taxes,75% - 80%,Grade A\n");
  const onlyPlaces = async () => ({ rows: { "Atlas": { "Title": "Coworking operators" }, "Places": [
    { "ID": "awfis-skyline-icon", "Kind": "flex", "Name": "AWFIS, Skyline Icon", "Second line": "Rs 13,000 a seat + taxes", "Address": "Skyline Icon, Marol, Mumbai", "Occupancy": "80% - 85%" },
    { "ID": "wework-light-bridge", "Kind": "flex", "Name": "WeWork, Light Bridge", "Second line": "Rs 25,000 a seat + taxes", "Address": "Light Bridge, Chandivali, Mumbai" },
  ] } });
  const sp = await plan([{ name: "Coworking_Operators.csv", buf: surveyBuf }], { llm: onlyPlaces });
  ok("a survey filed only as places comes back with the centres as the options", sp.rows["Options"].length === 2 && sp.rows["Places"].length === 0 && sp.notes.some(n => /nothing proposed/.test(n)), JSON.stringify(sp.rows["Options"]).slice(0, 200));
  ok("each centre keeps its name, figures and address as an option", sp.rows["Options"][0]["Property name"] === "AWFIS, Skyline Icon" && sp.rows["Options"][0]["Details"] === "Rs 13,000 a seat + taxes" && sp.rows["Options"][0]["Occupancy"] === "80% - 85%" && !("Kind" in sp.rows["Options"][0]));
  const sb = await build(sp.rows, { geocoder: async (q) => /skyline/i.test(q) ? { lat: 19.119, lng: 72.882, precision: "building", label: q } : { lat: 19.114, lng: 72.9, precision: "building", label: q } });
  ok("and it builds into an atlas of two options", sb.report.ok && sb.bundle.options.length === 2, JSON.stringify(sb.report.errors));
  const mixed = { "Options": [{ "ID": "a", "Property name": "A" }], "Places": [{ "ID": "p", "Kind": "flex", "Name": "P" }] };
  ok("places stay places when there are options to compare", promotePlaces(mixed) === 0 && mixed["Places"].length === 1);

  /* ---- the Claude call itself ----
     Current models think before they answer, and the thinking counts
     against max_tokens: a tight limit leaves the answer no room ("did not
     return JSON"). This stands in for the SDK client to check what is sent
     and how each way of stopping reads. */
  const fakeClient = (answers) => {
    const calls = [];
    return { calls, messages: { stream: (params) => { calls.push(params); const a = answers.shift(); return { finalMessage: async () => { if (a instanceof Error) throw a; return a; } }; } } };
  };
  const msg = (text, stop = "end_turn") => ({ model: "m", stop_reason: stop, content: [{ type: "thinking", thinking: "" }, ...(text == null ? [] : [{ type: "text", text }])] });
  let fc = fakeClient([msg('{"Client": "A fintech"}')]);
  const viaComplete = await model.complete({ system: "s", user: "u", maxTokens: 4000, effort: "medium", client: fc }, "claude");
  ok("Claude is streamed with room to think and an explicit effort", fc.calls[0].max_tokens >= 16000 && fc.calls[0].output_config.effort === "medium" && !("temperature" in fc.calls[0]), JSON.stringify(fc.calls[0]).slice(0, 200));
  ok("the answer is read after the thinking block", viaComplete.json.Client === "A fintech");
  fc = fakeClient([Object.assign(new Error("400 output_config.effort: not supported on this model"), { status: 400 }), msg('{"a":1}')]);
  const older = await model.claude({ model: "older", content: "x", effort: "low", client: fc });
  ok("a model that does not take an effort is asked again without one", fc.calls.length === 2 && fc.calls[0].output_config && !fc.calls[1].output_config && older.text === '{"a":1}');
  fc = fakeClient([msg(null, "max_tokens")]);
  e = await threw(() => model.complete({ system: "s", user: "u", client: fc }, "claude"));
  ok("an answer that ran out of room says so, not just 'no JSON'", e && e.status === 502 && /ran out of room/.test(e.message), e && e.message);
  fc = fakeClient([msg('{"Options": [{"ID": "a"', "max_tokens")]);
  e = await threw(() => model.complete({ system: "s", user: "u", client: fc }, "claude"));
  ok("JSON cut off half way says to use fewer or shorter files", e && /cut off before its JSON was finished/.test(e.message), e && e.message);
  fc = fakeClient([msg("I can't help with that.", "refusal")]);
  e = await threw(() => model.complete({ system: "s", user: "u", client: fc }, "claude"));
  ok("a refusal is named as one", e && e.status === 422 && /declined/.test(e.message), e && e.message);
  e = await threw(() => model.parseJSON("Here is the brief you asked for."));
  ok("prose instead of JSON quotes what came back", e && /it wrote: "Here is the brief/.test(e.message), e && e.message);
  fc = fakeClient([msg('{"Options": []}')]);
  await askModel({ text: "Corporate Avenue", scanned: [], fileName: "a.pdf", documents: [] }, "claude", { client: fc });
  ok("reading files asks for low effort and leaves 32,000 tokens of room", fc.calls[0].output_config.effort === "low" && fc.calls[0].max_tokens === 32000 && fc.calls[0].system.length > 100);
  fc = fakeClient([msg('{"Options": []}')]);
  await askModel({ text: "x", scanned: [2], fileName: "scan.pdf", documents: [{ name: "scan.pdf", base64: "JVBERi0=" }] }, "claude", { client: fc });
  ok("a scanned page still goes to Claude as the document itself", fc.calls[0].messages[0].content[0].type === "document" && fc.calls[0].messages[0].content[0].source.data === "JVBERi0=");
  let enhanceCall = null;
  await brief.enhance({ requirement: "120 seats" }, { complete: async (a) => { enhanceCall = a; return { json: { "Seats": 120 } }; } });
  ok("Enhance asks for more room and a higher effort than reading", enhanceCall.maxTokens >= 16000 && enhanceCall.effort === "medium");

  /* ---- limits ---- */
  const seven = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ name: `f${i}.csv`, buf: Buffer.from("a,b\n1,2") }));
  e = await threw(() => importSources(seven, { llm, geocoder }));
  ok(`more than ${MAX_FILES} files is refused`, e && e.status === 400 && /Up to 6 files/.test(e.message), e && e.message);
  e = await threw(() => importSources([{ name: "notes.pages", buf: Buffer.from("x") }, { name: "a.pdf", buf: pdfBuf }], { llm, geocoder }));
  ok("an unreadable kind among the files stops the import and names it", e && e.status === 400 && /"notes\.pages"/.test(e.message), e && e.message);
  e = await threw(() => importSources([], { llm, geocoder }));
  ok("no files is a plain message", e && e.status === 400 && /at least one file/.test(e.message));
  const big = Buffer.from("name,address\n" + "Some Centre,Some Road Andheri East Mumbai\n".repeat(Math.ceil(MAX_CHARS / 40) + 10));
  let longText = null;
  const cut = await importSources([{ name: "long.csv", buf: big }], { llm: async (a) => { longText = a.text; return { rows: { "Options": [{ "ID": "x", "Property name": "X", "Latitude": 19.1, "Longitude": 72.87 }] } }; }, geocoder });
  ok("very long text is cut at the limit, with a note", longText.length === MAX_CHARS && cut.notes.some(n => /was cut at/.test(n)), cut.notes.join(" | "));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
